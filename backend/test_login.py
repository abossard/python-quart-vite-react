#!/usr/bin/env python3
"""Test login functionality"""

import sqlite3
import os
import bcrypt

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

db_path = os.path.join(os.path.dirname(__file__), 'grabit.db')

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get admin user
    cursor.execute("SELECT id, username, password_hash FROM users WHERE username='admin'")
    user = cursor.fetchone()
    
    if user:
        print(f"Found user: {user[1]} (ID: {user[0]})")
        print(f"Password hash length: {len(user[2])}")
        print(f"Password hash starts with: {user[2][:20]}...")
        
        # Test password verification
        test_password = "admin"
        print(f"\nTesting password verification with: '{test_password}'")
        
        try:
            is_valid = verify_password(test_password, user[2])
            print(f"Password verification result: {is_valid}")
            
            if not is_valid:
                print("\n⚠️ Password verification FAILED!")
                print("Resetting admin password to 'admin'...")
                
                new_hash = hash_password("admin")
                cursor.execute("UPDATE users SET password_hash = ? WHERE id = ?", (new_hash, user[0]))
                conn.commit()
                
                # Verify the new password
                cursor.execute("SELECT password_hash FROM users WHERE id = ?", (user[0],))
                updated_hash = cursor.fetchone()[0]
                
                is_valid_now = verify_password("admin", updated_hash)
                print(f"New password verification result: {is_valid_now}")
                
                if is_valid_now:
                    print("✓ Admin password successfully reset to 'admin'")
                else:
                    print("✗ Password reset failed!")
            else:
                print("✓ Admin password is correct")
                
        except Exception as e:
            print(f"Error during verification: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("✗ Admin user not found")
    
    conn.close()
    
except Exception as e:
    print(f"\nERROR: {e}")
    import traceback
    traceback.print_exc()
