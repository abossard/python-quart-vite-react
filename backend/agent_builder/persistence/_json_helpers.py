"""
Agent Builder — JSON & datetime helpers for persistence.

Centralizes tolerant JSON loading and datetime parsing so repository
implementations don't duplicate error handling.
"""

import json
from datetime import datetime
from typing import Any


def safe_json_loads_list(raw: Any) -> list:
    """Parse a JSON string as a list, returning [] on any failure."""
    if isinstance(raw, list):
        return raw
    if not isinstance(raw, str):
        return []
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except (json.JSONDecodeError, TypeError):
        return []


def safe_json_loads_dict(raw: Any) -> dict:
    """Parse a JSON string as a dict, returning {} on any failure."""
    if isinstance(raw, dict):
        return raw
    if not isinstance(raw, str):
        return {}
    try:
        result = json.loads(raw)
        return result if isinstance(result, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


def parse_datetime(raw: Any) -> datetime:
    """Parse an ISO-format datetime string, returning datetime.now() on failure."""
    if isinstance(raw, datetime):
        return raw
    if not isinstance(raw, str) or not raw:
        return datetime.now()
    try:
        return datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return datetime.now()


def parse_datetime_optional(raw: Any) -> datetime | None:
    """Parse an ISO-format datetime string, returning None on failure or empty."""
    if isinstance(raw, datetime):
        return raw
    if not isinstance(raw, str) or not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except (ValueError, TypeError):
        return None


def to_iso(dt: datetime | None) -> str | None:
    """Convert a datetime to ISO string, or None if absent."""
    return dt.isoformat() if dt else None
