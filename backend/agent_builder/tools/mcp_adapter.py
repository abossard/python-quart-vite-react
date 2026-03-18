"""
Agent Builder — MCP Adapter

Action: converts external MCP server tools into LangChain StructuredTools.
"""

import logging
from typing import Any

from langchain_core.tools import StructuredTool

from .schema_converter import schema_to_pydantic

logger = logging.getLogger(__name__)


def mcp_tool_to_langchain(mcp_client: Any, tool: Any) -> StructuredTool:
    """
    Convert an MCP tool into a LangChain StructuredTool.

    Creates an async wrapper that calls the external MCP server via the client.
    """
    tool_name = tool.name
    tool_desc = tool.description or f"MCP tool: {tool_name}"
    input_schema = tool.inputSchema if hasattr(tool, "inputSchema") else {}

    async def call_mcp_tool(**kwargs: Any) -> str:
        import json as _json

        logger.info("MCP tool call: %s args=%s", tool_name, _json.dumps(kwargs, default=str)[:200])
        result = await mcp_client.call_tool(tool_name, kwargs)

        if hasattr(result, "content") and result.content:
            texts = [c.text for c in result.content if hasattr(c, "text")]
            response_text = "\n".join(texts) if texts else str(result)
        else:
            response_text = str(result)

        logger.info("MCP tool response: %s chars=%d", tool_name, len(response_text))
        return response_text

    args_model = schema_to_pydantic(tool_name, input_schema)

    return StructuredTool(
        name=tool_name,
        description=tool_desc,
        coroutine=call_mcp_tool,
        args_schema=args_model,
    )
