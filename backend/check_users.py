#!/usr/bin/env python3
"""Check users table and authentication"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'grabit.db')
print(f"Database path: {db_path}")
print(f"Database exists: {os.path.exists(db_path)}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if users table exists
    print("\n=== CHECKING USERS TABLE ===")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    if cursor.fetchone():
        print("✓ Users table exists")
        
        # Get table structure
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        print("\nUsers table columns:")
        for col in columns:
            print(f"  - {col[1]} ({col[2]})")
        
        # Count users
        cursor.execute("SELECT COUNT(*) FROM users")
        count = cursor.fetchone()[0]
        print(f"\nTotal users: {count}")
        
        # List users (without passwords)
        cursor.execute("SELECT id, username, first_name, last_name, email, role FROM users")
        users = cursor.fetchall()
        print("\nUsers list:")
        for user in users:
            print(f"  ID={user[0]}, username={user[1]}, name={user[2]} {user[3]}, email={user[4]}, role={user[5]}")
        
        # Check if admin user exists
        cursor.execute("SELECT id, username, role FROM users WHERE role='admin' LIMIT 1")
        admin = cursor.fetchone()
        if admin:
            print(f"\n✓ Admin user found: {admin[1]} (ID: {admin[0]})")
        else:
            print("\n✗ No admin user found!")
    else:
        print("✗ Users table does NOT exist")
    
    conn.close()
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
