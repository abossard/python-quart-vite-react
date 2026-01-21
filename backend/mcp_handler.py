"""
MCP JSON-RPC 2.0 Handler

This module provides the MCP (Model Context Protocol) JSON-RPC endpoint handler.
It uses the unified operation system to serve the same operations as REST.

Clean separation:
- api_decorators.py: Operation definitions and parsing/serialization logic
- mcp.py: MCP-specific JSON-RPC protocol handling
- app.py: HTTP routing and application setup
"""

from api_decorators import get_mcp_tools, get_operation
from pydantic import ValidationError
from quart import jsonify, request


async def handle_mcp_request():
    """
    Handle MCP JSON-RPC 2.0 requests.

    Uses the SAME operations as REST, with schemas auto-generated from Pydantic!

    Supported methods:
    - initialize: Initialize MCP session
    - tools/list: List available tools (generated from @operation decorators + Pydantic)
    - tools/call: Execute a tool (uses same functions as REST)
    """
    try:
        data = await request.get_json()

        if not data or "jsonrpc" not in data:
            return jsonify({
                "jsonrpc": "2.0",
                "error": {"code": -32600, "message": "Invalid Request"},
                "id": data.get("id") if data else None
            }), 400

        method = data.get("method")
        params = data.get("params", {})
        request_id = data.get("id")

        # Notifications (no response required but we acknowledge for logs)
        if method == "notifications/initialized":
            return jsonify({
                "jsonrpc": "2.0",
                "result": None,
                "id": request_id
            }), 200

        # Initialize
        if method == "initialize":
            return jsonify({
                "jsonrpc": "2.0",
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {
                        "name": "quart-pydantic-task-server",
                        "version": "2.0.0"
                    }
                },
                "id": request_id
            })

        # List tools (auto-generated from Pydantic models!)
        elif method == "tools/list":
            tools = get_mcp_tools()
            return jsonify({
                "jsonrpc": "2.0",
                "result": {"tools": tools},
                "id": request_id
            })

        # Call tool with Pydantic validation
        elif method == "tools/call":
            tool_name = params.get("name")
            arguments = params.get("arguments", {})

            op = get_operation(tool_name)
            if not op:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32601, "message": f"Tool not found: {tool_name}"},
                    "id": request_id
                }), 404

            try:
                # Parse arguments using the operation's built-in parser
                parsed_args = op.parse_arguments(arguments)
                
                # Call operation with validation
                result = await op.handler(**parsed_args)

                # Serialize result using the operation's built-in serializer
                result_text = op.serialize_result(result)

                return jsonify({
                    "jsonrpc": "2.0",
                    "result": {
                        "content": [{
                            "type": "text",
                            "text": result_text
                        }]
                    },
                    "id": request_id
                })

            except ValidationError as e:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32602, "message": f"Validation error: {str(e)}"},
                    "id": request_id
                }), 400
            except Exception as e:
                return jsonify({
                    "jsonrpc": "2.0",
                    "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
                    "id": request_id
                }), 500

        else:
            return jsonify({
                "jsonrpc": "2.0",
                "error": {"code": -32601, "message": f"Method not found: {method}"},
                "id": request_id
            }), 404

    except Exception as e:
        return jsonify({
            "jsonrpc": "2.0",
            "error": {"code": -32603, "message": f"Internal error: {str(e)}"},
            "id": None
        }), 500
