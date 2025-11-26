#!/bin/bash

# Quick test script for Ollama integration
# Tests the backend API endpoints

set -e

echo "🧪 Testing Ollama Integration"
echo "=============================="
echo ""

BACKEND_URL="http://localhost:5001"

# Test 1: List models
echo "Test 1: Listing available models..."
curl -s "$BACKEND_URL/api/ollama/models" | python3 -m json.tool
echo ""
echo "✅ Models endpoint working"
echo ""

# Test 2: Simple chat
echo "Test 2: Sending a simple chat message..."
curl -s "$BACKEND_URL/api/ollama/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Say hello in one word"}
    ],
    "model": "llama3.2:1b",
    "temperature": 0.1
  }' | python3 -m json.tool
echo ""
echo "✅ Chat endpoint working"
echo ""

# Test 3: MCP tool listing
echo "Test 3: Checking MCP tools..."
curl -s "$BACKEND_URL/mcp" \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }' | python3 -m json.tool | grep -A 5 "ollama"
echo ""
echo "✅ MCP tools exposed"
echo ""

echo "=============================="
echo "✅ All tests passed!"
echo ""
echo "Next steps:"
echo "1. Make sure the frontend is running: cd frontend && npm run dev"
echo "2. Visit http://localhost:3001"
echo "3. Click on the 'AI Chat' tab"
echo "4. Start chatting with Ollama!"
echo ""
