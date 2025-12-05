#!/usr/bin/env python3
"""Script to check and create devices_missing table."""

import sqlite3
import sys

def setup():
    try:
        conn = sqlite3.connect('grabit.db')
        cursor = conn.cursor()
        
        # Check existing tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"Existing tables: {tables}")
        
        if 'devices_missing' not in tables:
            print("\n❗ devices_missing table does not exist. Creating it...")
            
            # Create devices_missing table with all required columns
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS devices_missing (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    original_device_id INTEGER,
                    device_type TEXT NOT NULL,
                    manufacturer TEXT NOT NULL,
                    model TEXT NOT NULL,
                    serial_number TEXT,
                    inventory_number TEXT,
                    status TEXT DEFAULT 'missing',
                    location_id INTEGER,
                    department_id INTEGER,
                    amt_id INTEGER,
                    borrowed_at TIMESTAMP,
                    expected_return_date TIMESTAMP,
                    borrower_name TEXT,
                    borrower_email TEXT,
                    borrower_phone TEXT,
                    borrower_user_id INTEGER,
                    borrower_snapshot TEXT,
                    notes TEXT,
                    reported_by_user_id INTEGER,
                    missing_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            print("✅ devices_missing table created")
        else:
            print("\n✅ devices_missing table exists")
            
            # Check columns
            cursor.execute("PRAGMA table_info(devices_missing)")
            columns = [row[1] for row in cursor.fetchall()]
            print(f"Columns: {columns}")
            
            # Add missing columns if needed
            if 'department_id' not in columns:
                print("Adding department_id column...")
                cursor.execute("ALTER TABLE devices_missing ADD COLUMN department_id INTEGER")
                print("✅ department_id added")
            
            if 'amt_id' not in columns:
                print("Adding amt_id column...")
                cursor.execute("ALTER TABLE devices_missing ADD COLUMN amt_id INTEGER")
                print("✅ amt_id added")
        
        conn.commit()
        conn.close()
        
        print("\n✅ Setup completed successfully!")
        return 0
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(setup())
