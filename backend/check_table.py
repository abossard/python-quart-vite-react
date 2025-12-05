#!/usr/bin/env python3
"""Check devices_missing table structure."""

import sqlite3

conn = sqlite3.connect('grabit.db')
cursor = conn.cursor()

# Check table structure
cursor.execute("PRAGMA table_info(devices_missing)")
columns = cursor.fetchall()

print("devices_missing table columns:")
print("-" * 60)
for col in columns:
    print(f"  {col[1]:25} {col[2]:15} (nullable: {not col[3]})")

print("-" * 60)
print(f"Total columns: {len(columns)}")

conn.close()
