"""
Agent Builder — Event Bus

Pub/sub for real-time agent activity events using AG-UI protocol format.
Subscribers receive events via asyncio.Queue; a history buffer
provides catch-up for new SSE connections.

Data: AgentEvent dataclass (carries AG-UI typed event dicts)
Action: publish / subscribe / unsubscribe (I/O via queues)
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

MAX_HISTORY = 200


@dataclass
class AgentEvent:
    """A single AG-UI event from an agent run."""
    run_id: str
    event_type: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_sse_dict(self) -> dict[str, Any]:
        """Return the AG-UI event dict for SSE serialization."""
        return {
            "type": self.event_type,
            "runId": self.run_id,
            "timestamp": int(self.timestamp * 1000),
            **self.data,
        }


class AgentEventBus:
    """Simple in-process pub/sub for agent execution events.

    Thread-safe: ``publish()`` can be called from any thread (e.g. LangChain
    callback handlers running on executor threads).  It uses
    ``loop.call_soon_threadsafe`` to schedule the actual ``put_nowait`` on
    the event-loop thread, which is required because ``asyncio.Queue`` is
    **not** thread-safe.
    """

    def __init__(self, max_history: int = MAX_HISTORY) -> None:
        self._subscribers: list[asyncio.Queue[AgentEvent]] = []
        self._history: list[AgentEvent] = []
        self._max_history = max_history
        self._loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        """Capture the running event loop (call once at startup)."""
        self._loop = loop

    def subscribe(self) -> asyncio.Queue[AgentEvent]:
        q: asyncio.Queue[AgentEvent] = asyncio.Queue(maxsize=500)
        self._subscribers.append(q)
        logger.debug("EventBus: subscriber added (total=%d)", len(self._subscribers))
        return q

    def unsubscribe(self, q: asyncio.Queue[AgentEvent]) -> None:
        try:
            self._subscribers.remove(q)
            logger.debug("EventBus: subscriber removed (total=%d)", len(self._subscribers))
        except ValueError:
            pass

    def _dispatch(self, event: AgentEvent) -> None:
        """Put event into all subscriber queues.  MUST run on the event-loop thread."""
        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("EventBus: subscriber queue full, dropping event")

    def publish(self, event: AgentEvent) -> None:
        """Publish an event to all subscribers and history buffer.

        Thread-safe — can be called from LangChain callback handlers that
        run on background executor threads.
        """
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        loop = self._loop
        if loop is None:
            # Fallback: try to get the running loop (works when called from
            # the event-loop thread itself).
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                pass

        if loop is not None and loop.is_running():
            # Schedule queue puts on the event-loop thread so asyncio.Queue
            # internals are never touched from a foreign thread.
            loop.call_soon_threadsafe(self._dispatch, event)
        else:
            # No loop available (unlikely in production) — direct dispatch.
            self._dispatch(event)

    def get_history(self) -> list[AgentEvent]:
        return list(self._history)


# Global singleton
agent_event_bus = AgentEventBus()
