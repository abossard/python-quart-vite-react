"""
Agent Builder — AG-UI Event Conversion

Calculations: pure functions that convert ReAct execution data
into AG-UI protocol events. No I/O, no database, no side effects.
Each function takes data in, returns AG-UI event(s) out.
"""

import json
import uuid
from typing import Any, Optional

from ag_ui.core import (
    CustomEvent,
    EventType,
    RunErrorEvent,
    RunFinishedEvent,
    RunStartedEvent,
    StepFinishedEvent,
    StepStartedEvent,
    TextMessageContentEvent,
    TextMessageEndEvent,
    TextMessageStartEvent,
    ToolCallArgsEvent,
    ToolCallEndEvent,
    ToolCallResultEvent,
    ToolCallStartEvent,
    StateSnapshotEvent,
)
from ag_ui.encoder import EventEncoder


# Shared encoder — stateless, safe to reuse
_encoder = EventEncoder()


# ---------------------------------------------------------------------------
# Pure conversion functions
# ---------------------------------------------------------------------------

def run_started_event(thread_id: str, run_id: str) -> RunStartedEvent:
    return RunStartedEvent(
        type=EventType.RUN_STARTED,
        thread_id=thread_id,
        run_id=run_id,
    )


def run_finished_event(thread_id: str, run_id: str) -> RunFinishedEvent:
    return RunFinishedEvent(
        type=EventType.RUN_FINISHED,
        thread_id=thread_id,
        run_id=run_id,
    )


def run_error_event(message: str) -> RunErrorEvent:
    return RunErrorEvent(
        type=EventType.RUN_ERROR,
        message=message,
    )


def text_message_start(message_id: str, role: str = "assistant") -> TextMessageStartEvent:
    return TextMessageStartEvent(
        type=EventType.TEXT_MESSAGE_START,
        message_id=message_id,
        role=role,
    )


def text_message_content(message_id: str, delta: str) -> TextMessageContentEvent:
    return TextMessageContentEvent(
        type=EventType.TEXT_MESSAGE_CONTENT,
        message_id=message_id,
        delta=delta,
    )


def text_message_end(message_id: str) -> TextMessageEndEvent:
    return TextMessageEndEvent(
        type=EventType.TEXT_MESSAGE_END,
        message_id=message_id,
    )


def text_message_events(content: str, message_id: Optional[str] = None) -> list:
    """Convert a complete text into the three-event TEXT_MESSAGE sequence."""
    msg_id = message_id or str(uuid.uuid4())
    return [
        text_message_start(msg_id, role="assistant"),
        text_message_content(msg_id, content),
        text_message_end(msg_id),
    ]


def tool_call_start(tool_call_id: str, tool_name: str, parent_message_id: Optional[str] = None) -> ToolCallStartEvent:
    return ToolCallStartEvent(
        type=EventType.TOOL_CALL_START,
        tool_call_id=tool_call_id,
        tool_call_name=tool_name,
        parent_message_id=parent_message_id,
    )


def tool_call_args(tool_call_id: str, args: Any) -> ToolCallArgsEvent:
    args_str = json.dumps(args) if not isinstance(args, str) else args
    return ToolCallArgsEvent(
        type=EventType.TOOL_CALL_ARGS,
        tool_call_id=tool_call_id,
        delta=args_str,
    )


def tool_call_end(tool_call_id: str) -> ToolCallEndEvent:
    return ToolCallEndEvent(
        type=EventType.TOOL_CALL_END,
        tool_call_id=tool_call_id,
    )


def tool_call_result(tool_call_id: str, content: str, message_id: Optional[str] = None) -> ToolCallResultEvent:
    msg_id = message_id or str(uuid.uuid4())
    return ToolCallResultEvent(
        type=EventType.TOOL_CALL_RESULT,
        message_id=msg_id,
        tool_call_id=tool_call_id,
        content=content,
        role="tool",
    )


def tool_call_events(
    tool_name: str,
    args: Any,
    result: str,
    tool_call_id: Optional[str] = None,
    parent_message_id: Optional[str] = None,
) -> list:
    """Convert a complete tool invocation into the four-event TOOL_CALL sequence."""
    tc_id = tool_call_id or str(uuid.uuid4())
    return [
        tool_call_start(tc_id, tool_name, parent_message_id),
        tool_call_args(tc_id, args),
        tool_call_end(tc_id),
        tool_call_result(tc_id, result),
    ]


def step_started_event(step_name: str) -> StepStartedEvent:
    return StepStartedEvent(
        type=EventType.STEP_STARTED,
        step_name=step_name,
    )


def step_finished_event(step_name: str) -> StepFinishedEvent:
    return StepFinishedEvent(
        type=EventType.STEP_FINISHED,
        step_name=step_name,
    )


def state_snapshot_event(snapshot: dict[str, Any]) -> StateSnapshotEvent:
    return StateSnapshotEvent(
        type=EventType.STATE_SNAPSHOT,
        snapshot=snapshot,
    )


def structured_output_event(
    output: Any,
    schema: Optional[dict[str, Any]] = None,
) -> CustomEvent:
    """Emit structured agent output as a CUSTOM event with widget metadata.

    The frontend uses the schema's x-ui annotations to pick the right
    CopilotKit tool render for each field.
    """
    return CustomEvent(
        type=EventType.CUSTOM,
        name="structured_output",
        value={
            "output": output,
            "schema": schema or {},
        },
    )


# ---------------------------------------------------------------------------
# SSE encoding — thin wrapper, still a pure calculation
# ---------------------------------------------------------------------------

def encode_event(event: Any) -> str:
    """Serialize an AG-UI event to an SSE data line."""
    return _encoder.encode(event)
