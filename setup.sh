#!/bin/bash

# Setup Script for Quart + React Demo Application
# This script automates the initial setup process

set -e

echo "🎯 Quart + React Demo - Automated Setup"
echo "========================================"
echo ""

# Check Python
echo "📝 Checking Python installation..."
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is not installed!"
    echo "Please install Python 3.10+ first:"
    echo "  sudo apt update"
    echo "  sudo apt install python3 python3-pip python3-venv"
    exit 1
fi

PYTHON_VERSION=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1,2)
echo "✅ Found Python $PYTHON_VERSION"

# Check Node.js
echo "📝 Checking Node.js installation..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed!"
    echo "Please install Node.js 18+ first:"
    echo "  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -"
    echo "  sudo apt install -y nodejs"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Found Node.js $NODE_VERSION"

echo ""
echo "🐍 Setting up Python backend..."

# Create virtual environment at repo root
if [ -d ".venv" ]; then
    echo "⚠️  Virtual environment already exists at .venv, skipping..."
else
    echo "Creating virtual environment at .venv..."
    python3 -m venv .venv
fi

# Activate and install dependencies
echo "Installing Python dependencies..."
source .venv/bin/activate
pip install --upgrade pip
pip install -r backend/requirements.txt
deactivate

echo "✅ Backend setup complete!"

echo ""
echo "⚛️  Setting up React frontend..."
cd frontend

# Install npm dependencies
echo "Installing npm dependencies..."
npm install

echo "✅ Frontend setup complete!"

cd ..

echo ""
echo "🎭 Setting up Playwright..."
npm install
npx playwright install chromium

echo ""
echo "✅ Setup complete!"
echo ""
echo "🚀 Next steps:"
echo ""
echo "Option 1 - Use the start script (easiest):"
echo "  ./start-dev.sh"
echo ""
echo "Option 2 - Run manually in separate terminals:"
echo "  Terminal 1: source .venv/bin/activate && cd backend && python app.py"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Option 3 - Use VSCode:"
echo "  Open in VSCode, press F5, and select 'Full Stack: Backend + Frontend'"
echo ""
echo "Then open: http://localhost:3001"
echo ""
