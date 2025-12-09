#!/usr/bin/env python3
"""Check devices_missing table structure and data"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'data', 'devices.db')
print(f"Database path: {db_path}")
print(f"Database exists: {os.path.exists(db_path)}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # List all tables
    print("\n=== ALL TABLES ===")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = cursor.fetchall()
    for table in tables:
        print(f"  - {table[0]}")
    
    # Check if devices_missing exists
    if any('devices_missing' in t for t in tables):
        print("\n=== devices_missing TABLE STRUCTURE ===")
        cursor.execute("PRAGMA table_info(devices_missing)")
        columns = cursor.fetchall()
        for i, col in enumerate(columns):
            nullable = 'NULL' if col[3] == 0 else 'NOT NULL'
            default = f'DEFAULT {col[4]}' if col[4] else ''
            print(f"  [{i}] {col[1]:25} {col[2]:15} ({nullable}) {default}")
        
        print("\n=== devices_missing FOREIGN KEYS ===")
        cursor.execute("PRAGMA foreign_key_list(devices_missing)")
        fks = cursor.fetchall()
        if fks:
            for fk in fks:
                print(f"  Column: {fk[3]} -> {fk[2]}.{fk[4]} (ON DELETE: {fk[5]}, ON UPDATE: {fk[6]})")
        else:
            print("  No foreign keys")
    
    # Check devices table structure too
    print("\n=== devices TABLE STRUCTURE ===")
    cursor.execute("PRAGMA table_info(devices)")
    columns = cursor.fetchall()
    for i, col in enumerate(columns):
        nullable = 'NULL' if col[3] == 0 else 'NOT NULL'
        default = f'DEFAULT {col[4]}' if col[4] else ''
        print(f"  [{i}] {col[1]:25} {col[2]:15} ({nullable}) {default}")
    
    conn.close()
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
