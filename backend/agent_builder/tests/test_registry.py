"""Tests for ToolRegistry — the dependency injection boundary."""

import pytest

from agent_builder.tools import ToolRegistry
from .conftest import FakeTool


class TestToolRegistry:
    def test_register_and_resolve(self):
        reg = ToolRegistry()
        tool = FakeTool("my_tool")
        reg.register(tool)
        assert reg.has("my_tool")
        assert reg.resolve(["my_tool"]) == [tool]

    def test_register_all(self):
        reg = ToolRegistry()
        reg.register_all([FakeTool("a"), FakeTool("b"), FakeTool("c")])
        assert len(reg) == 3
        assert reg.available_names() == ["a", "b", "c"]

    def test_resolve_skips_missing(self):
        reg = ToolRegistry()
        reg.register(FakeTool("a"))
        assert len(reg.resolve(["a", "nonexistent"])) == 1

    def test_overwrites_duplicate_name(self):
        reg = ToolRegistry()
        t1, t2 = FakeTool("x"), FakeTool("x")
        reg.register(t1)
        reg.register(t2)
        assert len(reg) == 1
        assert reg.resolve(["x"]) == [t2]

    @pytest.mark.parametrize("bad_tool", [
        object(),
        type("Bad", (), {"name": 42})(),
    ], ids=["no_name", "non_string_name"])
    def test_rejects_invalid_tool(self, bad_tool):
        reg = ToolRegistry()
        with pytest.raises(ValueError):
            reg.register(bad_tool)
