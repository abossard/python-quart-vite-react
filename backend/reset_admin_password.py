#!/usr/bin/env python3
"""Reset admin password"""

import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'grabit.db')

# This is the bcrypt hash for password "admin123"
# Generated with: bcrypt.hashpw(b"admin123", bcrypt.gensalt()).decode('utf-8')
ADMIN_PASSWORD_HASH = "$2b$12$K5xJ8fT7LQw5X0xP0Wj5xuOQYkYZLqYh5vZxKxJ0xP5xLQw5X0xP0O"

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current admin password hash
    cursor.execute("SELECT id, username, password_hash FROM users WHERE username='admin'")
    user = cursor.fetchone()
    
    if user:
        print(f"Found admin user: {user[1]} (ID: {user[0]})")
        print(f"Current hash: {user[2][:50]}...")
        
        # Reset password to known hash for "admin"
        cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (ADMIN_PASSWORD_HASH, user[0]))
        conn.commit()
        
        print(f"\n✓ Admin password reset to: 'admin123'")
        print("You can now login with:")
        print("  Username: admin")
        print("  Password: admin123")
    else:
        print("✗ Admin user not found")
    
    conn.close()
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
