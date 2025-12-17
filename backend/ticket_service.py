"""
Ticket Service - Centralized MCP Client

Single place for all external ticket MCP server interactions.
Follows "A Philosophy of Software Design": deep module hiding complexity.
"""

import json
from typing import Any

from fastmcp import Client as MCPClient

# ============================================================================
# CONFIGURATION
# ============================================================================

TICKET_MCP_SERVER_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/mcp/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"


# ============================================================================
# MCP CLIENT
# ============================================================================

async def call_mcp_tool(tool_name: str, args: dict[str, Any] | None = None) -> list[dict]:
    """
    Call a tool on the external Ticket MCP server.
    
    Args:
        tool_name: Name of the MCP tool (e.g., "list_tickets", "get_ticket")
        args: Optional dict of arguments for the tool
        
    Returns:
        List of parsed JSON results from the tool response
    """
    args = args or {}
    results = []
    
    async with MCPClient(TICKET_MCP_SERVER_URL) as client:
        response = await client.call_tool(tool_name, args)
        
        if hasattr(response, 'content') and response.content:
            for content_item in response.content:
                text = getattr(content_item, 'text', None)
                if text is not None and isinstance(text, str):
                    try:
                        results.append(json.loads(text))
                    except json.JSONDecodeError:
                        results.append({"text": text})
    
    return results


def extract_tickets_from_response(results: list[dict]) -> list[dict]:
    """
    Extract ticket list from MCP response.
    
    Handles various response shapes:
    - {"tickets": [...]}
    - [{"ticket": ...}, ...]  
    - Direct list of tickets
    """
    if not results:
        return []
    
    first_result = results[0]
    
    # Shape: {"tickets": [...]}
    if isinstance(first_result, dict) and "tickets" in first_result:
        return first_result["tickets"]
    
    # Shape: [{"ticket": {...}}, ...]
    if isinstance(first_result, dict) and "ticket" in first_result:
        return [r.get("ticket", r) for r in results if isinstance(r, dict)]
    
    # Shape: Direct list
    if isinstance(first_result, dict) and "id" in first_result:
        return results
    
    return []


# ============================================================================
# HIGH-LEVEL OPERATIONS
# ============================================================================

async def list_tickets(page_size: int = 100, **filters) -> list[dict]:
    """List tickets with optional filters."""
    args = {"page_size": page_size, **filters}
    results = await call_mcp_tool("list_tickets", args)
    return extract_tickets_from_response(results)


async def get_ticket(ticket_id: str) -> dict | None:
    """Get a single ticket by ID."""
    results = await call_mcp_tool("get_ticket", {"ticket_id": ticket_id})
    if results:
        first = results[0]
        return first.get("ticket", first) if isinstance(first, dict) else None
    return None


async def add_work_log(
    ticket_id: str,
    log_type: str,
    summary: str,
    author: str,
    details: str | None = None,
    time_spent_minutes: int = 0,
) -> dict:
    """Add a worklog entry to a ticket."""
    result = await call_mcp_tool("add_work_log", {
        "ticket_id": ticket_id,
        "log_type": log_type,
        "summary": summary,
        "author": author,
        "details": details,
        "time_spent_minutes": time_spent_minutes,
    })
    return result[0] if result else {"status": "created"}


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    "TICKET_MCP_SERVER_URL",
    "call_mcp_tool",
    "extract_tickets_from_response",
    "list_tickets",
    "get_ticket",
    "add_work_log",
]
