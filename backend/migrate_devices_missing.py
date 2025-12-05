#!/usr/bin/env python3
"""Migration script to add department_id and amt_id columns to devices_missing table."""

import sqlite3
import sys

def migrate():
    try:
        conn = sqlite3.connect('data/grabit.db')
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(devices_missing)")
        columns = [row[1] for row in cursor.fetchall()]
        
        print(f"Current columns in devices_missing: {columns}")
        
        # Add department_id if it doesn't exist
        if 'department_id' not in columns:
            print("Adding department_id column...")
            cursor.execute("ALTER TABLE devices_missing ADD COLUMN department_id INTEGER")
            print("✅ department_id column added")
        else:
            print("⏭️  department_id column already exists")
        
        # Add amt_id if it doesn't exist
        if 'amt_id' not in columns:
            print("Adding amt_id column...")
            cursor.execute("ALTER TABLE devices_missing ADD COLUMN amt_id INTEGER")
            print("✅ amt_id column added")
        else:
            print("⏭️  amt_id column already exists")
        
        conn.commit()
        conn.close()
        
        print("\n✅ Migration completed successfully!")
        return 0
        
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(migrate())
