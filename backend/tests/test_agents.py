"""Tests for operation registry and LangChain tool conversion."""

from api_decorators import LANGCHAIN_AVAILABLE, get_langchain_tools, get_operations


def test_operation_registry():
    """Test that operations are properly registered."""
    ops = get_operations()
    assert len(ops) > 0, "No operations registered!"


def test_langchain_integration():
    """Test LangChain tool conversion."""
    if not LANGCHAIN_AVAILABLE:
        import pytest

        pytest.skip("LangChain not available")

    tools = get_langchain_tools()
    assert len(tools) > 0
