"""
Test FastMCP client integration with external MCP server.

Tests:
1. Connect to MCP server and list tools
2. Convert MCP tools to LangChain format
3. Run agent with MCP tools

Usage:
    cd backend && python test_mcp_client.py
"""

import asyncio

# Import from agents module
from agents import MCP_SERVER_URL, AgentRequest, AgentService, _mcp_tool_to_langchain
from fastmcp import Client as MCPClient


async def test_mcp_connection():
    """Test basic connection to MCP server."""
    print("=" * 60)
    print("TEST 1: Connect to MCP server")
    print("=" * 60)
    
    async with MCPClient(MCP_SERVER_URL) as client:
        await client.ping()
        print(f"✓ Connected to {MCP_SERVER_URL}")
        
        # List tools
        tools = await client.list_tools()
        print(f"✓ Found {len(tools)} tools:")
        for tool in tools:
            desc = tool.description[:50] + "..." if len(tool.description or "") > 50 else tool.description
            print(f"  - {tool.name}: {desc}")
        
        return tools


async def test_tool_conversion():
    """Test converting MCP tools to LangChain format."""
    print("\n" + "=" * 60)
    print("TEST 2: Convert MCP tools to LangChain")
    print("=" * 60)
    
    async with MCPClient(MCP_SERVER_URL) as client:
        tools = await client.list_tools()
        
        lc_tools = []
        for tool in tools:
            lc_tool = _mcp_tool_to_langchain(client, tool)
            lc_tools.append(lc_tool)
            print(f"✓ Converted: {lc_tool.name}")
            if hasattr(lc_tool.args_schema, 'model_fields'):
                print(f"    Args schema: {list(lc_tool.args_schema.model_fields.keys())}")
        
        print(f"\n✓ Converted {len(lc_tools)} tools to LangChain format")
        return lc_tools


async def test_call_mcp_tool():
    """Test calling an MCP tool directly."""
    print("\n" + "=" * 60)
    print("TEST 3: Call MCP tool directly")
    print("=" * 60)
    
    async with MCPClient(MCP_SERVER_URL) as client:
        tools = await client.list_tools()
        
        if not tools:
            print("✗ No tools available to test")
            return
        
        # Try to find a simple tool to call (e.g., list or get)
        test_tool = None
        for tool in tools:
            if "list" in tool.name.lower() or "get" in tool.name.lower():
                test_tool = tool
                break
        
        if not test_tool:
            test_tool = tools[0]
        
        print(f"Calling tool: {test_tool.name}")
        print(f"Input schema: {test_tool.inputSchema}")
        
        try:
            # Call with empty args (may fail if required params)
            result = await client.call_tool(test_tool.name, {})
            print(f"✓ Result: {result}")
        except Exception as e:
            print(f"✗ Tool call failed (may need args): {e}")


async def test_agent_with_mcp():
    """Test running agent with MCP tools loaded."""
    print("\n" + "=" * 60)
    print("TEST 4: Run agent with MCP tools")
    print("=" * 60)
    
    service = AgentService()
    
    # First run will load MCP tools
    result = await service.run_agent(
        AgentRequest(prompt="List all available tools and briefly describe what each one does")
    )
    
    print(f"Agent response:\n{result.result[:500]}..." if len(result.result) > 500 else f"Agent response:\n{result.result}")
    print(f"\nTools used: {result.tools_used}")
    print(f"Error: {result.error}")
    
    # Clean up
    await service.close()
    
    return result


async def main():
    """Run all tests."""
    print("\n🧪 FastMCP Client Integration Tests\n")
    print(f"MCP Server: {MCP_SERVER_URL}\n")
    
    try:
        await test_mcp_connection()
        await test_tool_conversion()
        await test_call_mcp_tool()
        await test_agent_with_mcp()
        
        print("\n" + "=" * 60)
        print("✓ All tests completed!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n✗ Test failed with error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
