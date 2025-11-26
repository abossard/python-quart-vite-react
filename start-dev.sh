#!/bin/bash

# Start Development Servers
# This script starts backend, frontend, and Ollama servers

set -e

echo "🚀 Starting Quart + React Demo Application"
echo ""

# Check if Python virtual environment exists
if [ ! -d ".venv" ]; then
    echo "❌ Virtual environment not found!"
    echo "Please run setup first:"
    echo "  python3 -m venv .venv"
    echo "  source .venv/bin/activate"
    echo "  pip install -r backend/requirements.txt"
    exit 1
fi

# Check if node_modules exists
if [ ! -d "frontend/node_modules" ]; then
    echo "❌ Frontend dependencies not found!"
    echo "Please run: cd frontend && npm install"
    exit 1
fi

echo "✅ Dependencies found"
echo ""

# Function to cleanup background processes
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    if [ -n "$OLLAMA_PID" ]; then
        kill $OLLAMA_PID 2>/dev/null
    fi
    exit
}

trap cleanup SIGINT SIGTERM

# Check if Ollama is installed
if command -v ollama &> /dev/null; then
    echo "🤖 Checking Ollama status..."
    
    # Check if Ollama is already running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama is already running"
        OLLAMA_PID=""
    else
        echo "🤖 Starting Ollama server..."
        ollama serve > /dev/null 2>&1 &
        OLLAMA_PID=$!
        
        # Wait for Ollama to start
        echo "   Waiting for Ollama to be ready..."
        for i in {1..10}; do
            if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
                echo "✅ Ollama is ready"
                break
            fi
            if [ $i -eq 10 ]; then
                echo "⚠️  Ollama failed to start, continuing without it"
                OLLAMA_PID=""
            fi
            sleep 1
        done
    fi
else
    echo "⚠️  Ollama not found - LLM features will not be available"
    echo "   Install with: curl -fsSL https://ollama.com/install.sh | sh"
    echo "   Then run: npm run ollama:pull"
    OLLAMA_PID=""
fi

echo ""

# Start backend
echo "🐍 Starting Python Quart backend..."
source .venv/bin/activate
cd backend
python app.py &
BACKEND_PID=$!
cd ..
deactivate

# Wait a bit for backend to start
sleep 2

# Start frontend
echo "⚛️  Starting React frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "✨ Servers are starting!"
echo ""
echo "📍 Backend:  http://localhost:5001"
echo "📍 Frontend: http://localhost:3001"
if [ -n "$OLLAMA_PID" ] || curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "📍 Ollama:   http://localhost:11434"
fi
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
