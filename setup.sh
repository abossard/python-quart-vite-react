#!/usr/bin/env bash

# Setup Script for Quart + React Demo Application
# This script automates the initial setup process and works on Ubuntu Linux.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${ROOT_DIR}"

MIN_PYTHON="3.10"
MIN_NODE_MAJOR=18

info() {
    echo "✅ $1"
}

warn() {
    echo "⚠️  $1"
}

fail() {
    echo "❌ $1"
    exit 1
}

version_ge() {
    # usage: version_ge "actual" "minimum"
    [ "$(printf '%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

echo "🎯 Quart + React Demo - Automated Setup"
echo "========================================"
echo ""

[ -f "backend/requirements.txt" ] || fail "Run this script from the repository root."
[ -f "frontend/package.json" ] || fail "Missing frontend/package.json. Repository checkout looks incomplete."

echo "📝 Checking Python installation..."
if ! command -v python3 >/dev/null 2>&1; then
    fail "Python 3 is not installed.
Install it first (Ubuntu): sudo apt update && sudo apt install -y python3 python3-pip python3-venv"
fi

PYTHON_VERSION="$(python3 --version | awk '{print $2}')"
if ! version_ge "${PYTHON_VERSION}" "${MIN_PYTHON}"; then
    fail "Python ${MIN_PYTHON}+ required, found ${PYTHON_VERSION}."
fi
info "Found Python ${PYTHON_VERSION}"

echo "📝 Checking Node.js installation..."
if ! command -v node >/dev/null 2>&1; then
    fail "Node.js is not installed.
Install Node.js 18+ (Ubuntu):
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs"
fi

NODE_VERSION="$(node --version)"
NODE_MAJOR="$(echo "${NODE_VERSION}" | sed 's/^v//' | cut -d'.' -f1)"
if [ "${NODE_MAJOR}" -lt "${MIN_NODE_MAJOR}" ]; then
    fail "Node.js ${MIN_NODE_MAJOR}+ required, found ${NODE_VERSION}."
fi
info "Found Node.js ${NODE_VERSION}"

echo ""
echo "🐍 Setting up Python backend..."

if [ -d ".venv" ]; then
    VENV_PY=".venv/bin/python"
    if [ -x "${VENV_PY}" ] && "${VENV_PY}" -c "import sys; print(sys.version)" >/dev/null 2>&1; then
        warn "Virtual environment already exists at .venv, reusing it."
    else
        warn "Existing .venv is incompatible with this OS/Python. Recreating it."
        rm -rf .venv
        echo "Creating virtual environment at .venv..."
        python3 -m venv .venv
    fi
else
    echo "Creating virtual environment at .venv..."
    python3 -m venv .venv
fi

VENV_PY=".venv/bin/python"
if [ ! -x "${VENV_PY}" ]; then
    fail "Virtual environment Python not found at ${VENV_PY} after creation."
fi

echo "Installing Python dependencies..."
"${VENV_PY}" -m pip install --upgrade pip
"${VENV_PY}" -m pip install -r backend/requirements.txt
info "Backend setup complete"

echo ""
echo "⚛️  Setting up React frontend..."
cd frontend

echo "Installing frontend npm dependencies..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

info "Frontend setup complete"
cd ..

echo ""
echo "🎭 Setting up Playwright..."
if [ -f "package-lock.json" ]; then
    npm ci
else
    npm install
fi

if [ "$(uname -s)" = "Linux" ] && command -v apt-get >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    echo "Installing Playwright browser + Linux dependencies (root detected)..."
    npx playwright install --with-deps chromium
else
    npx playwright install chromium
    if [ "$(uname -s)" = "Linux" ]; then
        warn "On Linux, browser runtime deps may still be missing. If tests fail, run: npx playwright install --with-deps chromium"
    fi
fi

echo ""
info "Setup complete"
echo ""

echo "📓 Setting up DSPy Playground notebooks..."
if [ -f "notebooks/requirements.txt" ]; then
    echo "Installing notebook dependencies into notebooks/.venv..."
    (cd notebooks && bash start.sh --install-only 2>/dev/null) || {
        # If --install-only isn't supported, just create venv + install deps
        if [ ! -d "notebooks/.venv" ]; then
            python3 -m venv notebooks/.venv
        fi
        notebooks/.venv/bin/pip install --quiet --upgrade pip
        notebooks/.venv/bin/pip install --quiet -r notebooks/requirements.txt
    }
    info "Notebook setup complete"
else
    warn "notebooks/requirements.txt not found, skipping notebook setup"
fi
echo ""
echo "🚀 Next steps:"
echo ""
echo "Option 1 - Start the web app:"
echo "  ./start-dev.sh"
echo ""
echo "Option 2 - Start the DSPy Playground notebooks:"
echo "  cd notebooks && ./start.sh"
echo ""
echo "Option 3 - Run manually in separate terminals:"
echo "  Terminal 1: source .venv/bin/activate && cd backend && python app.py"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Then open:"
echo "  http://localhost:3001/usecase_demo_1"
echo ""
echo "LLM backend: LiteLLM with GitHub Copilot (default, no config needed)"
echo "To use OpenAI instead: set OPENAI_API_KEY in .env"
echo ""
