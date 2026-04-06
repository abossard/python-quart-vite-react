"""Tests for engine helpers — extract_tools_used."""

from agent_builder.engine.react_runner import extract_tools_used


class _MockToolCallMessage:
    def __init__(self, tool_names: list[str]):
        self.tool_calls = [{"name": n} for n in tool_names]


class _MockToolMessage:
    def __init__(self, name: str):
        self.type = "tool"
        self.name = name


class _MockFinalMessage:
    def __init__(self, content: str):
        self.content = content


class TestExtractToolsUsed:
    def test_extracts_from_tool_calls(self):
        messages = [_MockToolCallMessage(["csv_ticket_stats"]), _MockFinalMessage("Done")]
        assert extract_tools_used(messages) == ["csv_ticket_stats"]

    def test_deduplicates_preserving_order(self):
        messages = [
            _MockToolCallMessage(["tool_b"]),
            _MockToolCallMessage(["tool_a"]),
            _MockToolCallMessage(["tool_b"]),
            _MockFinalMessage("Done"),
        ]
        assert extract_tools_used(messages) == ["tool_b", "tool_a"]

    def test_mixed_sources(self):
        messages = [
            _MockToolCallMessage(["tool_a"]),
            _MockToolMessage("tool_b"),
            _MockFinalMessage("Done"),
        ]
        result = extract_tools_used(messages)
        assert "tool_a" in result
        assert "tool_b" in result

    def test_empty_messages(self):
        assert extract_tools_used([]) == []

    def test_no_tool_calls(self):
        assert extract_tools_used([_MockFinalMessage("Hello")]) == []
