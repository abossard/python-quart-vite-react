#!/usr/bin/env python3
"""Test restore_missing_device functionality"""

import asyncio
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

from database import get_db
from devices import DeviceService

async def test_restore():
    """Test restoring a missing device"""
    
    from database import init_db
    await init_db()
    
    db = get_db()
    service = DeviceService(db)
    
    # Get all missing devices
    print("=== MISSING DEVICES ===")
    missing_devices = await service.get_missing_devices()
    
    if not missing_devices:
        print("No missing devices found!")
        return
    
    for device in missing_devices:
        print(f"ID: {device.id}, Type: {device.device_type}, Model: {device.model}")
    
    # Try to restore the first one
    first_device = missing_devices[0]
    print(f"\n=== ATTEMPTING TO RESTORE DEVICE {first_device.id} ===")
    
    try:
        restored = await service.restore_missing_device(first_device.id, user_id=1)
        print(f"✓ Successfully restored device!")
        print(f"  New device ID: {restored.id}")
        print(f"  Type: {restored.device_type}")
        print(f"  Model: {restored.model}")
        print(f"  Status: {restored.status}")
    except Exception as e:
        print(f"✗ Failed to restore device:")
        print(f"  Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    asyncio.run(test_restore())
