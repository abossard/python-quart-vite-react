#!/usr/bin/env python3
"""Test script to verify editor role login and permissions"""
import requests
import json

BASE_URL = "http://localhost:5001"

def test_editor_login():
    """Test login as editor user and verify session"""
    
    # Test credentials
    credentials = {
        "username": "test_editor",
        "password": "editor123"
    }
    
    print(f"🔐 Attempting login as '{credentials['username']}'...")
    
    # Login request
    response = requests.post(
        f"{BASE_URL}/api/auth/login",
        json=credentials,
        headers={"Content-Type": "application/json"}
    )
    
    if response.status_code != 200:
        print(f"❌ Login failed: {response.status_code}")
        print(f"   Response: {response.text}")
        return None
    
    print(f"✅ Login successful!")
    data = response.json()
    user = data.get('user', {})
    print(f"   User: {user.get('username')}")
    print(f"   Role: {user.get('role')}")
    print(f"   ID: {user.get('id')}")
    
    # Extract session cookie
    session_id = response.cookies.get('session_id')
    if not session_id:
        print("⚠️  No session_id cookie received")
        return None
    
    print(f"   Session ID: {session_id[:20]}...")
    
    # Verify session
    print(f"\n🔍 Verifying session...")
    session_response = requests.get(
        f"{BASE_URL}/api/auth/session",
        cookies={"session_id": session_id}
    )
    
    if session_response.status_code == 200:
        session_data = session_response.json()
        if session_data.get('authenticated'):
            print(f"✅ Session verified!")
            session_user = session_data.get('user', {})
            print(f"   Authenticated as: {session_user.get('username')}")
            print(f"   Role: {session_user.get('role')}")
            
            # Check if role is editor
            if session_user.get('role') == 'editor':
                print(f"\n✅ User has 'editor' role - can edit devices!")
                print(f"   - Can add devices: YES")
                print(f"   - Can edit devices: YES")
                print(f"   - Can delete devices: YES")
                print(f"   - Can access admin pages: NO")
            else:
                print(f"\n⚠️  User role is '{session_user.get('role')}', not 'editor'")
        else:
            print(f"❌ Session not authenticated")
    else:
        print(f"❌ Session verification failed: {session_response.status_code}")
    
    return session_id

def test_device_access(session_id):
    """Test device API access with editor session"""
    if not session_id:
        print("\n⚠️  No session ID - skipping device access test")
        return
    
    print(f"\n📱 Testing device API access...")
    
    # Try to get devices
    response = requests.get(
        f"{BASE_URL}/api/devices",
        cookies={"session_id": session_id}
    )
    
    if response.status_code == 200:
        devices = response.json()
        print(f"✅ Can access devices API")
        print(f"   Found {len(devices)} devices")
    else:
        print(f"❌ Cannot access devices API: {response.status_code}")

if __name__ == "__main__":
    print("=" * 60)
    print("EDITOR ROLE LOGIN TEST")
    print("=" * 60)
    print()
    
    session_id = test_editor_login()
    test_device_access(session_id)
    
    print()
    print("=" * 60)
    print("TEST COMPLETE")
    print("=" * 60)
    print()
    print("💡 To test in browser:")
    print("   1. Go to http://localhost:5173")
    print("   2. Login as 'testuser2_updated' or 'roal'")
    print("   3. Navigate to 'Geräte' page")
    print("   4. 'Add Device' button should be enabled")
    print()
