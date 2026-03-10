#!/usr/bin/env python3
"""
Quick test script for Auto-Generation functionality

Tests:
1. Settings CRUD operations
2. Ticket selection logic
3. Database migration
"""

import sys
import asyncio
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from auto_gen_service import AutoGenService
from operations import _get_kba_session


async def test_auto_gen():
    """Test auto-generation components"""
    print("=" * 70)
    print("🧪 Testing Auto-Generation Functionality")
    print("=" * 70)
    
    # 1. Test database and settings
    print("\n1️⃣  Testing Settings...")
    service = AutoGenService()
    
    try:
        settings = service.get_settings()
        print(f"   ✓ Settings loaded: enabled={settings.enabled}, daily_limit={settings.daily_limit}")
    except Exception as e:
        print(f"   ✗ Failed to load settings: {e}")
        return False
    
    # 2. Test ticket selection
    print("\n2️⃣  Testing Ticket Selection...")
    try:
        tickets = service.select_tickets_for_auto_gen(limit=5)
        print(f"   ✓ Found {len(tickets)} tickets for auto-generation")
        if tickets:
            print(f"   ℹ️  First ticket: {tickets[0].incident_id} - {tickets[0].summary[:50]}...")
    except Exception as e:
        print(f"   ✗ Failed to select tickets: {e}")
        return False
    
    # 3. Test settings update
    print("\n3️⃣  Testing Settings Update...")
    try:
        updated = service.update_settings({"daily_limit": 10})
        print(f"   ✓ Settings updated: daily_limit={updated.daily_limit}")
        
        # Reset back to 5
        service.update_settings({"daily_limit": 5})
        print(f"   ✓ Settings reset to default")
    except Exception as e:
        print(f"   ✗ Failed to update settings: {e}")
        return False
    
    # 4. Check database schema
    print("\n4️⃣  Testing Database Schema...")
    try:
        from sqlmodel import text
        with _get_kba_session() as session:
            # Check if is_auto_generated column exists
            rows = list(session.exec(text("PRAGMA table_info(kba_drafts)")).all())
            columns = {row[1] for row in rows if len(row) > 1}
            
            if 'is_auto_generated' in columns:
                print(f"   ✓ is_auto_generated column exists")
            else:
                print(f"   ✗ is_auto_generated column missing")
                return False
            
            # Check if auto_gen_settings table exists
            tables = list(session.exec(text("SELECT name FROM sqlite_master WHERE type='table'")).all())
            table_names = {row[0] for row in tables}
            
            if 'auto_gen_settings' in table_names:
                print(f"   ✓ auto_gen_settings table exists")
            else:
                print(f"   ✗ auto_gen_settings table missing")
                return False
                
    except Exception as e:
        print(f"   ✗ Failed to check schema: {e}")
        return False
    
    print("\n" + "=" * 70)
    print("✅ All tests passed!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = asyncio.run(test_auto_gen())
    sys.exit(0 if success else 1)
