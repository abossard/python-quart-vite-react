#!/usr/bin/env python3
"""Check device_transactions table structure."""

import sqlite3
import os

# Find the database file
db_path = 'data/grabit.db'
if not os.path.exists(db_path):
    db_path = 'grabit.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# Check table structure
cursor.execute("PRAGMA table_info(device_transactions)")
columns = cursor.fetchall()

print("device_transactions table columns:")
print("-" * 60)
for col in columns:
    print(f"  {col[1]:25} {col[2]:15} (nullable: {not col[3]})")

print("-" * 60)
print(f"Total columns: {len(columns)}")

conn.close()
