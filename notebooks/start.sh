#!/usr/bin/env bash
# Start the DSPy Playground — sets up a local venv and launches Jupyter Lab.
# Works on macOS (zsh/bash) and Ubuntu (bash).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
REQ_FILE="$SCRIPT_DIR/requirements.txt"

# Find Python 3
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    PYTHON=python
else
    echo "❌ Python 3 not found. Install it first:"
    echo "   macOS:  brew install python3"
    echo "   Ubuntu: sudo apt install python3 python3-venv"
    exit 1
fi

# Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
    echo "🐍 Creating Python virtual environment..."
    $PYTHON -m venv "$VENV_DIR"
fi

# Activate (works in both bash and zsh)
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

# Install/update deps if requirements.txt is newer than the last install marker
MARKER="$VENV_DIR/.installed"
if [ ! -f "$MARKER" ] || [ "$REQ_FILE" -nt "$MARKER" ]; then
    echo "📦 Installing/updating dependencies..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "$REQ_FILE"
    touch "$MARKER"
else
    echo "✅ Dependencies up to date"
fi

echo ""
echo "🚀 Launching Jupyter Lab..."
echo "   Open 00_introduction.ipynb to start the learning path"
echo ""
exec jupyter lab --notebook-dir="$SCRIPT_DIR"
