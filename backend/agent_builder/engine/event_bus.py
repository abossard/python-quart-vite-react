"""
Agent Builder — Event Bus

Pub/sub for real-time agent activity events.
Subscribers receive events via asyncio.Queue; a history buffer
provides catch-up for new SSE connections.

Data: AgentEvent dataclass
Action: publish / subscribe / unsubscribe (I/O via queues)
"""

import asyncio
import logging
import time
from dataclasses import asdict, dataclass, field
from typing import Any

logger = logging.getLogger(__name__)

MAX_HISTORY = 200


@dataclass
class AgentEvent:
    """A single event from an agent run."""
    run_id: str
    event_type: str
    data: dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_sse_dict(self) -> dict[str, Any]:
        return asdict(self)


class AgentEventBus:
    """Simple in-process pub/sub for agent execution events."""

    def __init__(self, max_history: int = MAX_HISTORY) -> None:
        self._subscribers: list[asyncio.Queue[AgentEvent]] = []
        self._history: list[AgentEvent] = []
        self._max_history = max_history

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

    def publish(self, event: AgentEvent) -> None:
        """Publish an event to all subscribers and history buffer.

        Synchronous — safe to call from LangChain BaseCallbackHandler methods
        because asyncio.Queue.put_nowait() doesn't require awaiting.
        """
        self._history.append(event)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history:]

        for q in self._subscribers:
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("EventBus: subscriber queue full, dropping event")

    def get_history(self) -> list[AgentEvent]:
        return list(self._history)


# Global singleton
agent_event_bus = AgentEventBus()
