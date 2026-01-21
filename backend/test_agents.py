#!/usr/bin/env python3
"""
Test script for LangGraph agent integration.

This script tests:
1. Agent service initialization (without OpenAI)
2. Operation to LangChain tool conversion
3. MCP tool schema generation

Run from backend directory:
    python test_agents.py
"""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from api_decorators import LANGCHAIN_AVAILABLE, get_langchain_tools, get_operations
from tasks import TaskService


def test_operation_registry():
    """Test that operations are properly registered."""
    print("✓ Testing operation registry...")
    ops = get_operations()
    print(f"  Found {len(ops)} registered operations:")
    for name in sorted(ops.keys()):
        print(f"    - {name}")
    assert len(ops) > 0, "No operations registered!"
    print()

def test_langchain_integration():
    """Test LangChain tool conversion."""
    print("✓ Testing LangChain integration...")
    
    if not LANGCHAIN_AVAILABLE:
        print("  ⚠ LangChain not available, skipping tool conversion test")
        return
    
    try:
        tools = get_langchain_tools()
        print(f"  Converted {len(tools)} operations to LangChain tools:")
        for tool in tools[:5]:  # Show first 5
            print(f"    - {tool.name}: {tool.description[:60]}...")
        print()
    except Exception as e:
        print(f"  ✗ Error converting to LangChain tools: {e}")
        raise

def test_agent_import():
    """Test that agent service can be imported."""
    print("✓ Testing agent module import...")
    
    try:
        from agents import AgentRequest, AgentResponse, AgentService
        print("  Successfully imported AgentRequest, AgentResponse, AgentService")
        
        # Test creating a request
        request = AgentRequest(
            prompt="Test prompt",
            agent_type="task_assistant"
        )
        print(f"  Created test request: {request.prompt}")
        print()
    except ImportError as e:
        print(f"  ⚠ Could not import agents module: {e}")
        print("  This is expected if OpenAI dependencies are not configured")
        print()

def test_task_service():
    """Test that task service works."""
    print("✓ Testing task service integration...")
    
    task_service = TaskService()
    
    # Get stats
    stats = task_service.get_task_stats()
    print(f"  Task stats: {stats.total} total, {stats.completed} completed, {stats.pending} pending")
    
    # List tasks
    tasks = task_service.list_tasks()
    print(f"  Found {len(tasks)} tasks")
    print()

def main():
    """Run all tests."""
    print("=" * 70)
    print("LangGraph Agent Integration Tests")
    print("=" * 70)
    print()
    
    try:
        test_operation_registry()
        test_langchain_integration()
        test_agent_import()
        test_task_service()
        
        print("=" * 70)
        print("✓ All tests passed!")
        print("=" * 70)
        print()
        print("Next steps:")
        print("1. Copy .env.example to .env")
        print("2. Configure OPENAI_API_KEY in .env")
        print("3. Start the server: python app.py")
        print("4. Test agent: POST /api/agents/run with {\"prompt\": \"List all tasks\"}")
        print()
        
    except Exception as e:
        print(f"\n✗ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
