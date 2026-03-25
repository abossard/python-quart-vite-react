"""Tests for engine helpers — extract_tools_used and ReactRunner."""

from unittest.mock import patch

from agent_builder.engine.react_runner import extract_tools_used


class _MockToolCallMessage:
    """Simulates a LangGraph AI message with tool_calls."""
    def __init__(self, tool_names: list[str]):
        self.tool_calls = [{"name": n} for n in tool_names]


class _MockToolMessage:
    """Simulates a LangGraph ToolMessage."""
    def __init__(self, name: str):
        self.type = "tool"
        self.name = name


class _MockFinalMessage:
    """Simulates a final AI message."""
    def __init__(self, content: str):
        self.content = content


class TestExtractToolsUsed:
    def test_extracts_from_tool_calls(self):
        messages = [
            _MockToolCallMessage(["csv_ticket_stats"]),
            _MockFinalMessage("Done"),
        ]
        assert extract_tools_used(messages) == ["csv_ticket_stats"]

    def test_extracts_from_tool_messages(self):
        messages = [
            _MockToolMessage("csv_list_tickets"),
            _MockFinalMessage("Done"),
        ]
        assert extract_tools_used(messages) == ["csv_list_tickets"]

    def test_deduplicates(self):
        messages = [
            _MockToolCallMessage(["csv_ticket_stats"]),
            _MockToolCallMessage(["csv_ticket_stats"]),
            _MockFinalMessage("Done"),
        ]
        assert extract_tools_used(messages) == ["csv_ticket_stats"]

    def test_preserves_order(self):
        messages = [
            _MockToolCallMessage(["tool_b"]),
            _MockToolCallMessage(["tool_a"]),
            _MockToolCallMessage(["tool_b"]),
            _MockFinalMessage("Done"),
        ]
        assert extract_tools_used(messages) == ["tool_b", "tool_a"]

    def test_empty_messages(self):
        assert extract_tools_used([]) == []

    def test_no_tool_calls(self):
        messages = [_MockFinalMessage("Hello")]
        assert extract_tools_used(messages) == []

    def test_mixed_sources(self):
        messages = [
            _MockToolCallMessage(["tool_a"]),
            _MockToolMessage("tool_b"),
            _MockFinalMessage("Done"),
        ]
        result = extract_tools_used(messages)
        assert "tool_a" in result
        assert "tool_b" in result


class TestBuildLlmSelection:
    def test_defaults_to_litellm_even_with_api_key(self, monkeypatch):
        monkeypatch.delenv("AGENT_BACKEND", raising=False)

        with patch("langchain_litellm.ChatLiteLLM") as mock_litellm:
            from agent_builder.engine.react_runner import build_llm

            build_llm("openai/nvidia/nemotron-3-nano-4b", api_key="test-key")

        mock_litellm.assert_called_once()
        assert mock_litellm.call_args.kwargs["model"] == "openai/nvidia/nemotron-3-nano-4b"

    def test_uses_openai_when_explicitly_forced(self, monkeypatch):
        monkeypatch.setenv("AGENT_BACKEND", "openai")

        with patch("langchain_openai.ChatOpenAI") as mock_openai:
            from agent_builder.engine.react_runner import build_llm

            build_llm("gpt-4o-mini", api_key="test-key", base_url="http://localhost:1234/v1")

        mock_openai.assert_called_once()
        assert mock_openai.call_args.kwargs["model"] == "gpt-4o-mini"
