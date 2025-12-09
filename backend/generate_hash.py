#!/usr/bin/env python3
"""Generate correct bcrypt hash for admin123"""

import sys
import os

# Try to import bcrypt
try:
    import bcrypt
    
    password = "admin123"
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    hash_str = hashed.decode('utf-8')
    
    print(f"Generated bcrypt hash for '{password}':")
    print(hash_str)
    
    # Now update the database
    import sqlite3
    db_path = os.path.join(os.path.dirname(__file__), 'grabit.db')
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute("UPDATE users SET password_hash = ? WHERE username = 'admin'", (hash_str,))
    conn.commit()
    
    print(f"\n✓ Admin password updated in database")
    print(f"You can now login with:")
    print(f"  Username: admin")
    print(f"  Password: {password}")
    
    # Verify it works
    cursor.execute("SELECT password_hash FROM users WHERE username = 'admin'")
    stored_hash = cursor.fetchone()[0]
    
    is_valid = bcrypt.checkpw(password.encode('utf-8'), stored_hash.encode('utf-8'))
    print(f"\nPassword verification test: {'✓ PASSED' if is_valid else '✗ FAILED'}")
    
    conn.close()
    
except ImportError:
    print("ERROR: bcrypt module not found")
    print("Please install it with: pip install bcrypt")
    sys.exit(1)
