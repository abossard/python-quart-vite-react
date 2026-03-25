"""
ACTIONS — Tool functions for agentic DSPy tasks.

These are I/O functions that read from the project's CSV ticket data.
Used by dspy.ReAct agents in Tier 4 tasks.

Following Grokking Simplicity: clearly marked as actions (side effects: file I/O).
"""
import pandas as pd
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent.parent / "csv" / "data.csv"

# Cache the dataframe to avoid re-reading on every tool call
_df_cache = None

def _load_tickets() -> pd.DataFrame:
    """Load ticket data (cached). ACTION: reads file."""
    global _df_cache
    if _df_cache is None:
        _df_cache = pd.read_csv(CSV_PATH, encoding="latin-1", low_memory=False)
    return _df_cache


def calculate(expression: str) -> str:
    """Evaluate a mathematical expression safely.
    
    Args:
        expression: A mathematical expression like '2 + 3 * 4' or '100 / 7'
    
    Returns:
        The result as a string, or an error message.
    """
    try:
        # Only allow safe math operations
        allowed = set("0123456789+-*/.() ")
        if not all(c in allowed for c in expression):
            return f"Error: expression contains invalid characters. Only numbers and +-*/.()" 
        result = eval(expression, {"__builtins__": {}}, {})
        return str(round(result, 4))
    except Exception as e:
        return f"Error evaluating '{expression}': {e}"


def search_tickets(query: str) -> str:
    """Search the ticket database for tickets matching a query.
    
    Args:
        query: Search term to find in ticket summaries
    
    Returns:
        Matching ticket summaries and details (up to 5 results).
    """
    df = _load_tickets()
    if "Summary*" not in df.columns:
        return "Error: ticket data not available"
    
    mask = df["Summary*"].astype(str).str.contains(query, case=False, na=False)
    total_matches = mask.sum()
    matches = df[mask].head(5)
    
    if total_matches == 0:
        return f"No tickets found matching '{query}'"
    
    results = []
    for _, row in matches.iterrows():
        summary = str(row.get("Summary*", "N/A"))
        priority = str(row.get("Priority*", "N/A"))
        status = str(row.get("Status*", "N/A"))
        group = str(row.get("Assigned Group*+", "N/A"))
        results.append(f"- [{priority}] {summary} (Status: {status}, Team: {group})")
    
    header = f"Found {total_matches} total matching tickets (showing first {len(matches)}):"
    return header + "\n" + "\n".join(results)


def get_ticket_stats(field: str) -> str:
    """Get statistics and distribution for a ticket field.
    
    Args:
        field: Column name to analyze, e.g. 'Priority*', 'Status*', 'Assigned Group*+'
    
    Returns:
        Value counts and basic statistics for the field.
    """
    df = _load_tickets()
    
    # Map common names to actual column names
    field_map = {
        "priority": "Priority*",
        "status": "Status*",
        "group": "Assigned Group*+",
        "team": "Assigned Group*+",
        "category": "Operational Categorization Tier 1+",
        "urgency": "Urgency*",
        "impact": "Impact*",
    }
    actual_field = field_map.get(field.lower().strip(), field)
    
    if actual_field not in df.columns:
        available = [c for c in df.columns if not c.startswith("Unnamed")]
        return f"Field '{field}' not found. Available fields: {', '.join(available[:15])}"
    
    counts = df[actual_field].value_counts()
    total = len(df)
    
    lines = [f"Statistics for '{actual_field}' ({total} total tickets):"]
    for value, count in counts.head(10).items():
        pct = count / total * 100
        lines.append(f"  {value}: {count} ({pct:.1f}%)")
    
    if len(counts) > 10:
        lines.append(f"  ... and {len(counts) - 10} more unique values")
    
    return "\n".join(lines)


def verify_answer(answer: str, expected: str) -> str:
    """Verify if an answer matches the expected answer.
    
    Args:
        answer: The answer to verify
        expected: The expected correct answer
    
    Returns:
        Verification result with explanation.
    """
    answer_clean = answer.strip().lower()
    expected_clean = expected.strip().lower()
    
    if answer_clean == expected_clean:
        return "✅ CORRECT: Answer matches exactly."
    
    # Try numeric comparison
    try:
        a_num = float(answer_clean.replace(",", ""))
        e_num = float(expected_clean.replace(",", ""))
        if abs(a_num - e_num) < 0.01:
            return f"✅ CORRECT: Numerically equivalent ({a_num} ≈ {e_num})."
        else:
            return f"❌ INCORRECT: Got {a_num}, expected {e_num}."
    except ValueError:
        pass
    
    # Partial match
    if expected_clean in answer_clean:
        return f"⚠️ PARTIAL: Answer contains expected value but has extra content."
    
    return f"❌ INCORRECT: Got '{answer}', expected '{expected}'."


# Tool registry for easy access
TOOL_REGISTRY = {
    "calculate": calculate,
    "search_tickets": search_tickets,
    "get_ticket_stats": get_ticket_stats,
    "verify_answer": verify_answer,
}
