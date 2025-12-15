"""
Real-time Event Broadcasting System

Provides SSE (Server-Sent Events) for real-time updates across all clients.
When any data changes (device borrowed, user created, etc.), all connected
clients receive immediate updates.

Architecture:
- EventManager: Central hub for broadcasting events
- SSE endpoint in app.py streams events to clients
- Services (devices.py, app.py) emit events on data changes
"""

import asyncio
from datetime import datetime
from typing import Dict, Any, Set
from enum import Enum
from zoneinfo import ZoneInfo


class EventType(str, Enum):
    """Types of events that can be broadcast"""
    # Device events
    DEVICE_CREATED = "device:created"
    DEVICE_UPDATED = "device:updated"
    DEVICE_DELETED = "device:deleted"
    DEVICE_BORROWED = "device:borrowed"
    DEVICE_RETURNED = "device:returned"
    DEVICE_MISSING = "device:missing"
    DEVICE_FOUND = "device:found"
    
    # User events
    USER_CREATED = "user:created"
    USER_UPDATED = "user:updated"
    USER_DELETED = "user:deleted"
    
    # Department events
    DEPARTMENT_CREATED = "department:created"
    DEPARTMENT_UPDATED = "department:updated"
    DEPARTMENT_DELETED = "department:deleted"
    
    # Amt events
    AMT_CREATED = "amt:created"
    AMT_UPDATED = "amt:updated"
    AMT_DELETED = "amt:deleted"
    
    # Location events
    LOCATION_CREATED = "location:created"
    LOCATION_UPDATED = "location:updated"
    LOCATION_DELETED = "location:deleted"
    
    # Peripheral events
    PERIPHERAL_CREATED = "peripheral:created"
    PERIPHERAL_UPDATED = "peripheral:updated"
    PERIPHERAL_DELETED = "peripheral:deleted"


class EventManager:
    """
    Manages event broadcasting to all connected SSE clients.
    
    Thread-safe queue system for real-time updates.
    Each connected client gets its own queue to receive events.
    """
    
    def __init__(self):
        self._queues: Set[asyncio.Queue] = set()
        self._lock = asyncio.Lock()
    
    async def subscribe(self) -> asyncio.Queue:
        """
        Subscribe a new client to receive events.
        Returns a queue that will receive all broadcast events.
        """
        queue = asyncio.Queue(maxsize=100)
        async with self._lock:
            self._queues.add(queue)
        return queue
    
    async def unsubscribe(self, queue: asyncio.Queue):
        """Unsubscribe a client from receiving events."""
        async with self._lock:
            self._queues.discard(queue)
    
    async def broadcast(self, event_type: EventType, data: Dict[str, Any]):
        """
        Broadcast an event to all connected clients.
        
        Args:
            event_type: Type of event (device:created, user:updated, etc.)
            data: Event payload (device object, user object, etc.)
        """
        event = {
            "type": event_type.value,
            "data": data,
            "timestamp": datetime.now(ZoneInfo("Europe/Zurich")).isoformat()
        }
        
        # Get current queues under lock
        async with self._lock:
            queues = list(self._queues)
        
        # Send to all queues (outside lock to avoid blocking)
        dead_queues = []
        for queue in queues:
            try:
                # Non-blocking put with timeout
                await asyncio.wait_for(queue.put(event), timeout=0.1)
            except (asyncio.TimeoutError, asyncio.QueueFull):
                # Queue full or slow client - mark for removal
                dead_queues.append(queue)
            except Exception:
                # Other errors - also mark for removal
                dead_queues.append(queue)
        
        # Clean up dead queues
        if dead_queues:
            async with self._lock:
                for queue in dead_queues:
                    self._queues.discard(queue)
    
    def get_client_count(self) -> int:
        """Get number of currently connected clients."""
        return len(self._queues)


# Global event manager instance
_event_manager = None


def get_event_manager() -> EventManager:
    """Get the global event manager instance."""
    global _event_manager
    if _event_manager is None:
        _event_manager = EventManager()
    return _event_manager


async def broadcast_event(event_type: EventType, data: Dict[str, Any]):
    """
    Convenience function to broadcast an event.
    
    Usage in services:
        from events import broadcast_event, EventType
        await broadcast_event(EventType.DEVICE_BORROWED, device_data)
    """
    manager = get_event_manager()
    await manager.broadcast(event_type, data)
