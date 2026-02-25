"""Shared fixtures and path setup for backend tests."""
import sys
from pathlib import Path

# Ensure backend package is importable from the tests directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
