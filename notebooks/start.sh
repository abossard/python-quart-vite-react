#!/usr/bin/env bash
# Start the DSPy Playground — sets up a local venv and launches Jupyter Lab.
# Works on macOS (zsh/bash) and Ubuntu (bash).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
VENV_DIR="$SCRIPT_DIR/.venv"
REQ_FILE="$SCRIPT_DIR/requirements.txt"
STAMP_FILE="$VENV_DIR/.python-version"

# Find a Jupyter-friendly Python 3 runtime.
PYTHON=""
for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
    if command -v "$candidate" &>/dev/null; then
        candidate_version="$($candidate -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
        if [ "$candidate_version" != "3.14" ]; then
            PYTHON="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON" ] && command -v python &>/dev/null && python --version 2>&1 | grep -q "Python 3"; then
    python_version="$(python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    if [ "$python_version" != "3.14" ]; then
        PYTHON=python
    fi
fi

if [ -z "$PYTHON" ]; then
    echo "❌ Python 3 not found. Install it first:"
    echo "   macOS:  brew install python3"
    echo "   Ubuntu: sudo apt install python3 python3-venv"
    echo "   Note: this notebook setup currently avoids Python 3.14 for Jupyter compatibility."
    exit 1
fi

SELECTED_PYTHON_PATH="$(command -v "$PYTHON")"

# Recreate the venv if it was built with a different interpreter.
if [ -x "$VENV_DIR/bin/python" ]; then
    CURRENT_VENV_VERSION="$($VENV_DIR/bin/python -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    SELECTED_VERSION="$($PYTHON -c 'import sys; print(f"{sys.version_info.major}.{sys.version_info.minor}")')"
    if [ "$CURRENT_VENV_VERSION" != "$SELECTED_VERSION" ]; then
        echo "♻️ Rebuilding notebook virtual environment with Python $SELECTED_VERSION..."
        rm -rf "$VENV_DIR"
    fi
fi

# Create venv if missing
if [ ! -d "$VENV_DIR" ]; then
    echo "🐍 Creating Python virtual environment..."
    $PYTHON -m venv "$VENV_DIR"
    printf '%s\n' "$SELECTED_PYTHON_PATH" > "$STAMP_FILE"
fi

# Activate (works in both bash and zsh)
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

if [ ! -f "$STAMP_FILE" ] || [ "$(cat "$STAMP_FILE")" != "$SELECTED_PYTHON_PATH" ]; then
    printf '%s\n' "$SELECTED_PYTHON_PATH" > "$STAMP_FILE"
fi

# Install/update deps if requirements.txt is newer than the last install marker
MARKER="$VENV_DIR/.installed"
if [ ! -f "$MARKER" ] || [ "$REQ_FILE" -nt "$MARKER" ]; then
    echo "📦 Installing/updating dependencies..."
    pip install --upgrade pip
    pip install -r "$REQ_FILE"
    touch "$MARKER"
else
    echo "✅ Dependencies up to date"
fi

echo ""
echo "🚀 Launching Jupyter Lab..."
echo "   Open 01_evaluation_and_tuning.ipynb to start the learning path"
echo ""

# Support --install-only flag (used by setup.sh)
if [ "${1:-}" = "--install-only" ]; then
    echo "✅ Install complete (--install-only mode)"
    exit 0
fi

exec jupyter lab --notebook-dir="$SCRIPT_DIR"
