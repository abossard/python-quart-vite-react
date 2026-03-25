#!/usr/bin/env python3
"""Generate DSPy training datasets from the project's CSV ticket data."""
import pandas as pd
import json
from pathlib import Path

CSV_PATH = Path(__file__).parent.parent.parent / "csv" / "data.csv"
OUTPUT_DIR = Path(__file__).parent


def generate_ticket_routing():
    """Generate ticket_routing.json for Task 12: Ticket Classification & Routing."""
    df = pd.read_csv(CSV_PATH, encoding="latin-1")
    examples = []
    for _, row in df.iterrows():
        summary = row.get("Summary*")
        priority = row.get("Priority*")
        category = row.get("Operational Categorization Tier 1+")
        group = row.get("Assigned Group*+")
        if pd.notna(summary) and pd.notna(priority):
            examples.append({
                "summary": str(summary).strip(),
                "category": str(category).strip() if pd.notna(category) else "Unknown",
                "priority": str(priority).strip(),
                "assigned_group": str(group).strip() if pd.notna(group) else "General",
            })
    # Take up to 50 diverse examples
    examples = examples[:50]
    with open(OUTPUT_DIR / "ticket_routing.json", "w") as f:
        json.dump(examples, f, indent=2)
    print(f"Generated ticket_routing.json with {len(examples)} examples")


def generate_report_generation():
    """Generate report_generation.json for Task 13."""
    df = pd.read_csv(CSV_PATH, encoding="latin-1")
    examples = []
    if "Assigned Group*+" in df.columns and "Priority*" in df.columns:
        for group in df["Assigned Group*+"].dropna().unique()[:10]:
            group_df = df[df["Assigned Group*+"] == group]
            data_points = f"Team: {group}, Total tickets: {len(group_df)}"
            if "Priority*" in group_df.columns:
                priority_dist = group_df["Priority*"].value_counts().to_dict()
                data_points += f", Priority distribution: {priority_dist}"
            report = f"Report for {group}: The team handled {len(group_df)} tickets. "
            report += f"Priority breakdown: {priority_dist}."
            examples.append({
                "data_points": data_points,
                "report_type": "team_summary",
                "report": report,
            })
    with open(OUTPUT_DIR / "report_generation.json", "w") as f:
        json.dump(examples, f, indent=2)
    print(f"Generated report_generation.json with {len(examples)} examples")


def generate_search_agent_qa():
    """Generate search_agent_qa.json for Task 17: Search Agent Q&A."""
    df = pd.read_csv(CSV_PATH, encoding="latin-1")
    examples = []

    if "Priority*" in df.columns:
        for priority in df["Priority*"].dropna().unique():
            count = len(df[df["Priority*"] == priority])
            examples.append({
                "question": f"How many tickets have priority '{priority}'?",
                "answer": str(count),
                "sources": "ticket_database"
            })

    if "Assigned Group*+" in df.columns:
        top_group = df["Assigned Group*+"].value_counts().index[0]
        top_count = df["Assigned Group*+"].value_counts().iloc[0]
        examples.append({
            "question": "Which team handles the most tickets?",
            "answer": f"{top_group} with {top_count} tickets",
            "sources": "ticket_database"
        })

    if "Status*" in df.columns:
        for status in df["Status*"].dropna().unique()[:5]:
            count = len(df[df["Status*"] == status])
            examples.append({
                "question": f"How many tickets have status '{status}'?",
                "answer": str(count),
                "sources": "ticket_database"
            })

    with open(OUTPUT_DIR / "search_agent_qa.json", "w") as f:
        json.dump(examples, f, indent=2)
    print(f"Generated search_agent_qa.json with {len(examples)} examples")


if __name__ == "__main__":
    generate_ticket_routing()
    generate_report_generation()
    generate_search_agent_qa()
    print("Done! All datasets generated.")
