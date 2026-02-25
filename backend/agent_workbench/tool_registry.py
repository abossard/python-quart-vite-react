"""
Agent Workbench - Tool Registry

Decouples the workbench from the project's specific tool implementations.
The project injects tools at startup; the workbench resolves them by name.
"""

from typing import Any


class ToolRegistry:
    """
    Maps string names to LangChain StructuredTool instances.

    The workbench itself has no knowledge of where tools come from.
    The host project registers tools at startup (dependency injection).

    Usage:
        registry = ToolRegistry()
        registry.register(my_structured_tool)      # from a StructuredTool
        registry.register_all(list_of_tools)       # bulk
        tools = registry.resolve(["csv_list_tickets", "csv_search_tickets"])
    """

    def __init__(self) -> None:
        self._tools: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Registration
    # ------------------------------------------------------------------

    def register(self, tool: Any) -> None:
        """Register a single LangChain StructuredTool (requires .name attribute)."""
        name = getattr(tool, "name", None)
        if not name or not isinstance(name, str):
            raise ValueError(f"Tool must have a string .name attribute, got: {tool!r}")
        self._tools[name] = tool

    def register_all(self, tools: list[Any]) -> None:
        """Bulk-register a list of LangChain StructuredTools."""
        for t in tools:
            self.register(t)

    # ------------------------------------------------------------------
    # Resolution
    # ------------------------------------------------------------------

    def resolve(self, names: list[str]) -> list[Any]:
        """
        Return StructuredTool instances for the requested names.

        Silently skips names that are not registered so that persisted
        AgentDefinitions don't break when a tool is unregistered.
        """
        return [self._tools[n] for n in names if n in self._tools]

    def available_names(self) -> list[str]:
        """Sorted list of all registered tool names."""
        return sorted(self._tools.keys())

    def available_tools(self) -> list[Any]:
        """All registered tools."""
        return list(self._tools.values())

    def has(self, name: str) -> bool:
        return name in self._tools

    def __len__(self) -> int:
        return len(self._tools)
