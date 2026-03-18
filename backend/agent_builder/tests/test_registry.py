"""Tests for ToolRegistry — fast, no I/O."""

import pytest

from agent_builder.tools import ToolRegistry


class _FakeTool:
    """Minimal tool stub with a .name attribute."""
    def __init__(self, name: str):
        self.name = name


class TestToolRegistry:
    def test_register_and_resolve(self):
        reg = ToolRegistry()
        tool = _FakeTool("my_tool")
        reg.register(tool)
        assert reg.has("my_tool")
        assert reg.resolve(["my_tool"]) == [tool]

    def test_register_all(self):
        reg = ToolRegistry()
        tools = [_FakeTool("a"), _FakeTool("b"), _FakeTool("c")]
        reg.register_all(tools)
        assert len(reg) == 3
        assert reg.available_names() == ["a", "b", "c"]

    def test_resolve_skips_missing(self):
        reg = ToolRegistry()
        reg.register(_FakeTool("a"))
        resolved = reg.resolve(["a", "nonexistent"])
        assert len(resolved) == 1

    def test_resolve_empty_list(self):
        reg = ToolRegistry()
        assert reg.resolve([]) == []

    def test_has_returns_false_for_missing(self):
        reg = ToolRegistry()
        assert reg.has("nonexistent") is False

    def test_reject_tool_without_name(self):
        reg = ToolRegistry()
        with pytest.raises(ValueError, match="string .name attribute"):
            reg.register(object())

    def test_reject_tool_with_non_string_name(self):
        reg = ToolRegistry()
        bad_tool = type("Bad", (), {"name": 42})()
        with pytest.raises(ValueError):
            reg.register(bad_tool)

    def test_available_tools(self):
        reg = ToolRegistry()
        t1, t2 = _FakeTool("x"), _FakeTool("y")
        reg.register(t1)
        reg.register(t2)
        available = reg.available_tools()
        assert t1 in available
        assert t2 in available

    def test_len(self):
        reg = ToolRegistry()
        assert len(reg) == 0
        reg.register(_FakeTool("a"))
        assert len(reg) == 1

    def test_overwrites_duplicate_name(self):
        reg = ToolRegistry()
        t1 = _FakeTool("x")
        t2 = _FakeTool("x")
        reg.register(t1)
        reg.register(t2)
        assert len(reg) == 1
        assert reg.resolve(["x"]) == [t2]
