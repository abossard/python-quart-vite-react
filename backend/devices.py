"""
Device Management Service for Grabit.
Handles all device operations: CRUD, borrowing, returning, reporting missing.
"""

import json
from datetime import datetime, date
from typing import Optional, List
from models import (
    Device, DeviceCreate, DeviceUpdate, DeviceBorrow, DeviceStatus, DeviceFull,
    MissingDevice, MissingDeviceCreate, Transaction, TransactionCreate, TransactionType,
    DeviceStats, LocationStats
)
from events import broadcast_event, EventType


class DeviceService:
    """Service class for device management operations"""
    
    def __init__(self, db_connection):
        self.db = db_connection
    
    async def list_devices(
        self, 
        status: Optional[DeviceStatus] = None,
        location_id: Optional[int] = None,
        include_missing: bool = False
    ) -> List[DeviceFull]:
        """
        List all devices with optional filtering.
        
        Args:
            status: Filter by device status
            location_id: Filter by location
            include_missing: Whether to include devices from devices_missing table
            
        Returns:
            List of DeviceFull objects
        """
        cursor = await self.db.cursor()
        
        # Build query with optional filters
        query = """
        SELECT 
            d.id, d.device_type, d.manufacturer, d.model, d.serial_number,
            d.inventory_number, d.status, d.location_id, d.borrowed_at,
            d.expected_return_date, d.borrower_name, d.borrower_email,
            d.borrower_phone, d.borrower_user_id, d.borrower_snapshot,
            d.notes, d.created_at, d.updated_at,
            l.id as loc_id, l.name as loc_name, l.address as loc_address,
            bl.id as borrower_loc_id, bl.name as borrower_loc_name, bl.address as borrower_loc_address,
            bd.id as borrower_dept_id, bd.name as borrower_dept_name, bd.full_name as borrower_dept_full_name,
            ba.id as borrower_amt_id, ba.name as borrower_amt_name,
            dd.id as device_dept_id, dd.name as device_dept_name, dd.full_name as device_dept_full_name,
            da.id as device_amt_id, da.name as device_amt_name,
            CASE 
                WHEN d.status = 'borrowed' AND d.expected_return_date < DATE('now') THEN 1
                ELSE 0
            END as is_overdue,
            CASE 
                WHEN d.status = 'borrowed' AND d.expected_return_date < DATE('now') 
                THEN JULIANDAY('now') - JULIANDAY(d.expected_return_date)
                ELSE NULL
            END as days_overdue
        FROM devices d
        LEFT JOIN locations l ON d.location_id = l.id
        LEFT JOIN departments dd ON d.department_id = dd.id
        LEFT JOIN amt da ON d.amt_id = da.id
        LEFT JOIN users u ON d.borrower_user_id = u.id
        LEFT JOIN locations bl ON u.location_id = bl.id
        LEFT JOIN departments bd ON u.department_id = bd.id
        LEFT JOIN amt ba ON u.amt_id = ba.id
        WHERE 1=1
        """
        
        params = []
        if status:
            query += " AND d.status = ?"
            params.append(status.value)
        if location_id:
            query += " AND d.location_id = ?"
            params.append(location_id)
        
        query += " ORDER BY d.created_at DESC"
        
        await cursor.execute(query, params)
        rows = await cursor.fetchall()
        await cursor.close()
        
        devices = []
        for row in rows:
            device = self._row_to_device_full(row)
            devices.append(device)
        
        return devices
    
    async def get_device(self, device_id: int) -> Optional[DeviceFull]:
        """
        Get a single device by ID.
        
        Args:
            device_id: Device ID
            
        Returns:
            DeviceFull object or None
        """
        cursor = await self.db.cursor()
        
        query = """
        SELECT 
            d.id, d.device_type, d.manufacturer, d.model, d.serial_number,
            d.inventory_number, d.status, d.location_id, d.borrowed_at,
            d.expected_return_date, d.borrower_name, d.borrower_email,
            d.borrower_phone, d.borrower_user_id, d.borrower_snapshot,
            d.notes, d.created_at, d.updated_at,
            l.id as loc_id, l.name as loc_name, l.address as loc_address,
            bl.id as borrower_loc_id, bl.name as borrower_loc_name, bl.address as borrower_loc_address,
            bd.id as borrower_dept_id, bd.name as borrower_dept_name, bd.full_name as borrower_dept_full_name,
            ba.id as borrower_amt_id, ba.name as borrower_amt_name,
            dd.id as device_dept_id, dd.name as device_dept_name, dd.full_name as device_dept_full_name,
            da.id as device_amt_id, da.name as device_amt_name,
            CASE 
                WHEN d.status = 'borrowed' AND d.expected_return_date < DATE('now') THEN 1
                ELSE 0
            END as is_overdue,
            CASE 
                WHEN d.status = 'borrowed' AND d.expected_return_date < DATE('now') 
                THEN JULIANDAY('now') - JULIANDAY(d.expected_return_date)
                ELSE NULL
            END as days_overdue
        FROM devices d
        LEFT JOIN locations l ON d.location_id = l.id
        LEFT JOIN departments dd ON d.department_id = dd.id
        LEFT JOIN amt da ON d.amt_id = da.id
        LEFT JOIN users u ON d.borrower_user_id = u.id
        LEFT JOIN locations bl ON u.location_id = bl.id
        LEFT JOIN departments bd ON u.department_id = bd.id
        LEFT JOIN amt ba ON u.amt_id = ba.id
        WHERE d.id = ?
        """
        
        await cursor.execute(query, (device_id,))
        row = await cursor.fetchone()
        await cursor.close()
        
        if not row:
            return None
        
        return self._row_to_device_full(row)
    
    async def create_device(self, data: DeviceCreate, user_id: int) -> Device:
        """
        Create a new device.
        
        Args:
            data: Device creation data
            user_id: ID of user creating the device (for transaction log)
            
        Returns:
            Created Device object
        """
        cursor = await self.db.cursor()
        
        now = datetime.now().isoformat()
        
        await cursor.execute("""
            INSERT INTO devices (
                device_type, manufacturer, model, serial_number, inventory_number,
                status, location_id, department_id, amt_id, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.device_type, data.manufacturer, data.model, data.serial_number,
            data.inventory_number, DeviceStatus.AVAILABLE.value, data.location_id,
            data.department_id, data.amt_id, data.notes, now, now
        ))
        
        device_id = cursor.lastrowid
        await self.db.commit()
        await cursor.close()
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.UPDATE,
            snapshot_before=None,
            snapshot_after=data.model_dump(mode='json'),
            notes="Device created"
        )
        
        # Return full device
        device = await self.get_device(device_id)
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEVICE_CREATED, device.model_dump(mode='json'))
        
        return device
    
    async def update_device(self, device_id: int, data: DeviceUpdate, user_id: int) -> Optional[Device]:
        """
        Update device information.
        
        Args:
            device_id: Device ID
            data: Update data
            user_id: ID of user updating the device
            
        Returns:
            Updated Device object or None
        """
        # Get current state for transaction log
        current = await self.get_device(device_id)
        if not current:
            return None
        
        cursor = await self.db.cursor()
        
        # Build update query dynamically based on provided fields
        updates = []
        params = []
        
        if data.device_type is not None:
            updates.append("device_type = ?")
            params.append(data.device_type)
        if data.manufacturer is not None:
            updates.append("manufacturer = ?")
            params.append(data.manufacturer)
        if data.model is not None:
            updates.append("model = ?")
            params.append(data.model)
        if data.serial_number is not None:
            updates.append("serial_number = ?")
            params.append(data.serial_number)
        if data.inventory_number is not None:
            updates.append("inventory_number = ?")
            params.append(data.inventory_number)
        if data.location_id is not None:
            updates.append("location_id = ?")
            params.append(data.location_id)
        if data.notes is not None:
            updates.append("notes = ?")
            params.append(data.notes)
        
        if not updates:
            await cursor.close()
            return current
        
        updates.append("updated_at = ?")
        params.append(datetime.now().isoformat())
        params.append(device_id)
        
        query = f"UPDATE devices SET {', '.join(updates)} WHERE id = ?"
        await cursor.execute(query, params)
        await self.db.commit()
        await cursor.close()
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.UPDATE,
            snapshot_before=current.model_dump(mode='json'),
            snapshot_after=data.model_dump(mode='json', exclude_none=True),
            notes="Device updated"
        )
        
        device = await self.get_device(device_id)
        
        # Broadcast event to all clients
        if device:
            await broadcast_event(EventType.DEVICE_UPDATED, device.model_dump(mode='json'))
        
        return device
    
    async def delete_device(self, device_id: int, user_id: int) -> bool:
        """
        Delete a device (soft delete by moving to devices_missing).
        
        Args:
            device_id: Device ID
            user_id: ID of user deleting the device
            
        Returns:
            True if deleted
        """
        device = await self.get_device(device_id)
        if not device:
            return False
        
        cursor = await self.db.cursor()
        
        # Log transaction before deletion
        await self._log_transaction(
            device_id, user_id, TransactionType.UPDATE,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after=None,
            notes="Device deleted"
        )
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEVICE_DELETED, {'id': device_id})
        
        await cursor.execute("DELETE FROM devices WHERE id = ?", (device_id,))
        await self.db.commit()
        await cursor.close()
        
        return True
    
    async def borrow_device(self, device_id: int, data: DeviceBorrow, user_id: int) -> Optional[Device]:
        """
        Borrow a device.
        
        Args:
            device_id: Device ID
            data: Borrowing information
            user_id: ID of user borrowing the device
            
        Returns:
            Updated Device object or None
        """
        device = await self.get_device(device_id)
        if not device:
            return None
        
        if device.status != DeviceStatus.AVAILABLE:
            raise ValueError(f"Device is not available (status: {device.status})")
        
        cursor = await self.db.cursor()
        
        # Get user snapshot for borrower_snapshot
        await cursor.execute("""
            SELECT u.id, u.username, u.role, u.location_id, u.department_id, u.amt_id,
                   l.name as location_name, d.name as department_name, a.name as amt_name
            FROM users u
            LEFT JOIN locations l ON u.location_id = l.id
            LEFT JOIN departments d ON u.department_id = d.id
            LEFT JOIN amt a ON u.amt_id = a.id
            WHERE u.id = ?
        """, (user_id,))
        user_row = await cursor.fetchone()
        
        borrower_snapshot = None
        if user_row:
            borrower_snapshot = json.dumps({
                'user_id': user_row[0],
                'username': user_row[1],
                'role': user_row[2],
                'location_id': user_row[3],
                'location_name': user_row[6],
                'department_id': user_row[4],
                'department_name': user_row[7],
                'amt_id': user_row[5],
                'amt_name': user_row[8]
            })
        
        now = datetime.now().isoformat()
        
        await cursor.execute("""
            UPDATE devices SET
                status = ?,
                borrowed_at = ?,
                expected_return_date = ?,
                borrower_name = ?,
                borrower_email = ?,
                borrower_phone = ?,
                borrower_user_id = ?,
                borrower_snapshot = ?,
                updated_at = ?
            WHERE id = ?
        """, (
            DeviceStatus.BORROWED.value, now, data.expected_return_date.isoformat(),
            data.borrower_name, data.borrower_email, data.borrower_phone,
            user_id, borrower_snapshot, now, device_id
        ))
        
        await self.db.commit()
        await cursor.close()
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.BORROW,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after=data.model_dump(mode='json'),
            notes=f"Device borrowed by {data.borrower_name}"
        )
        
        device_updated = await self.get_device(device_id)
        
        # Broadcast event to all clients
        if device_updated:
            await broadcast_event(EventType.DEVICE_BORROWED, device_updated.model_dump(mode='json'))
        
        return device_updated
    
    async def return_device(self, device_id: int, user_id: int, notes: Optional[str] = None) -> Optional[Device]:
        """
        Return a borrowed device.
        
        Args:
            device_id: Device ID
            user_id: ID of user returning the device
            notes: Optional notes about the return
            
        Returns:
            Updated Device object or None
        """
        device = await self.get_device(device_id)
        if not device:
            return None
        
        if device.status != DeviceStatus.BORROWED:
            raise ValueError(f"Device is not borrowed (status: {device.status})")
        
        cursor = await self.db.cursor()
        now = datetime.now().isoformat()
        
        await cursor.execute("""
            UPDATE devices SET
                status = ?,
                borrowed_at = NULL,
                expected_return_date = NULL,
                borrower_name = NULL,
                borrower_email = NULL,
                borrower_phone = NULL,
                borrower_user_id = NULL,
                borrower_snapshot = NULL,
                updated_at = ?
            WHERE id = ?
        """, (DeviceStatus.AVAILABLE.value, now, device_id))
        
        await self.db.commit()
        await cursor.close()
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.RETURN,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after={'status': 'available'},
            notes=notes or "Device returned"
        )
        
        device_updated = await self.get_device(device_id)
        
        # Broadcast event to all clients
        if device_updated:
            await broadcast_event(EventType.DEVICE_RETURNED, device_updated.model_dump(mode='json'))
        
        return device_updated
    
    async def report_missing(self, data: MissingDeviceCreate, user_id: int) -> MissingDevice:
        """
        Report a device as missing.
        
        Args:
            data: Missing device report data
            user_id: ID of user reporting (can override with data.reported_by_user_id)
            
        Returns:
            MissingDevice object
        """
        device = await self.get_device(data.device_id)
        if not device:
            raise ValueError(f"Device {data.device_id} not found")
        
        cursor = await self.db.cursor()
        now = datetime.now().isoformat()
        
        # Copy device to devices_missing
        await cursor.execute("""
            INSERT INTO devices_missing (
                original_device_id, device_type, manufacturer, model, serial_number,
                inventory_number, status, location_id, borrowed_at, expected_return_date,
                borrower_name, borrower_email, borrower_phone, borrower_user_id,
                borrower_snapshot, notes, reported_at, reported_by_user_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            device.id, device.device_type, device.manufacturer, device.model,
            device.serial_number, device.inventory_number, device.status.value,
            data.last_known_location_id or device.location_id,
            device.borrowed_at.isoformat() if device.borrowed_at else None,
            device.expected_return_date.isoformat() if device.expected_return_date else None,
            device.borrower_name, device.borrower_email, device.borrower_phone,
            device.borrower_user_id,
            json.dumps(device.borrower_snapshot) if device.borrower_snapshot else None,
            data.notes, now, data.reported_by_user_id or user_id
        ))
        
        missing_id = cursor.lastrowid
        
        # Delete from devices table
        await cursor.execute("DELETE FROM devices WHERE id = ?", (device.id,))
        
        await self.db.commit()
        
        # Log transaction
        await self._log_transaction(
            device.id, user_id, TransactionType.REPORT_MISSING,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after={'missing_id': missing_id},
            notes=data.notes or "Device reported missing"
        )
        
        # Get missing device
        await cursor.execute("""
            SELECT * FROM devices_missing WHERE id = ?
        """, (missing_id,))
        row = await cursor.fetchone()
        await cursor.close()
        
        missing_device = self._row_to_missing_device(row)
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEVICE_MISSING, missing_device.model_dump(mode='json'))
        
        return missing_device
    
    async def get_device_stats(self) -> DeviceStats:
        """
        Get device statistics.
        
        Returns:
            DeviceStats object
        """
        cursor = await self.db.cursor()
        
        await cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
                SUM(CASE WHEN status = 'borrowed' THEN 1 ELSE 0 END) as borrowed,
                SUM(CASE WHEN status = 'reserved' THEN 1 ELSE 0 END) as reserved,
                SUM(CASE WHEN status = 'borrowed' AND expected_return_date < DATE('now') THEN 1 ELSE 0 END) as overdue
            FROM devices
        """)
        row = await cursor.fetchone()
        
        await cursor.execute("SELECT COUNT(*) FROM devices_missing")
        missing_count = (await cursor.fetchone())[0]
        
        await cursor.close()
        
        return DeviceStats(
            total=row[0] or 0,
            available=row[1] or 0,
            borrowed=row[2] or 0,
            reserved=row[3] or 0,
            overdue=row[4] or 0,
            missing=missing_count or 0
        )
    
    async def get_location_stats(self) -> List[LocationStats]:
        """
        Get device statistics by location.
        
        Returns:
            List of LocationStats objects
        """
        cursor = await self.db.cursor()
        
        await cursor.execute("""
            SELECT 
                l.id,
                l.name,
                COUNT(d.id) as total,
                SUM(CASE WHEN d.status = 'borrowed' THEN 1 ELSE 0 END) as borrowed,
                SUM(CASE WHEN d.status = 'available' THEN 1 ELSE 0 END) as available
            FROM locations l
            LEFT JOIN devices d ON l.id = d.location_id
            GROUP BY l.id, l.name
            ORDER BY l.name
        """)
        rows = await cursor.fetchall()
        await cursor.close()
        
        return [
            LocationStats(
                location_id=row[0],
                location_name=row[1],
                total_devices=row[2] or 0,
                borrowed_devices=row[3] or 0,
                available_devices=row[4] or 0
            )
            for row in rows
        ]
    
    async def _log_transaction(
        self, device_id: int, user_id: int, transaction_type: TransactionType,
        snapshot_before: Optional[dict], snapshot_after: Optional[dict],
        notes: Optional[str] = None
    ):
        """Log a device transaction."""
        cursor = await self.db.cursor()
        
        await cursor.execute("""
            INSERT INTO device_transactions (
                device_id, user_id, transaction_type, snapshot_before,
                snapshot_after, notes, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            device_id, user_id, transaction_type.value,
            json.dumps(snapshot_before) if snapshot_before else None,
            json.dumps(snapshot_after) if snapshot_after else None,
            notes, datetime.now().isoformat()
        ))
        
        await self.db.commit()
        await cursor.close()
    
    def _row_to_device_full(self, row) -> DeviceFull:
        """Convert database row to DeviceFull object."""
        from models import Location, Department, Amt
        
        device_data = {
            'id': row[0],
            'device_type': row[1],
            'manufacturer': row[2],
            'model': row[3],
            'serial_number': row[4],
            'inventory_number': row[5],
            'status': DeviceStatus(row[6]),
            'location_id': row[7],
            'borrowed_at': datetime.fromisoformat(row[8]) if row[8] else None,
            'expected_return_date': date.fromisoformat(row[9]) if row[9] else None,
            'borrower_name': row[10],
            'borrower_email': row[11],
            'borrower_phone': row[12],
            'borrower_user_id': row[13],
            'borrower_snapshot': json.loads(row[14]) if row[14] else None,
            'notes': row[15],
            'created_at': datetime.fromisoformat(row[16]),
            'updated_at': datetime.fromisoformat(row[17]),
            'is_overdue': bool(row[34]),
            'days_overdue': int(row[35]) if row[35] else None
        }
        
        # Updated column mapping with address and full_name:
        # row[18]=loc_id, row[19]=loc_name, row[20]=loc_address
        # row[21]=borrower_loc_id, row[22]=borrower_loc_name, row[23]=borrower_loc_address
        # row[24]=borrower_dept_id, row[25]=borrower_dept_name, row[26]=borrower_dept_full_name
        # row[27]=borrower_amt_id, row[28]=borrower_amt_name
        # row[29]=device_dept_id, row[30]=device_dept_name, row[31]=device_dept_full_name
        # row[32]=device_amt_id, row[33]=device_amt_name
        # row[34]=is_overdue, row[35]=days_overdue
        
        # Add location (row[18-20])
        if row[18]:
            device_data['location'] = Location(id=row[18], name=row[19], address=row[20])
        
        # Add borrower location/department/amt
        if row[21]:
            device_data['borrower_location'] = Location(id=row[21], name=row[22], address=row[23])
        if row[24]:
            device_data['borrower_department'] = Department(id=row[24], name=row[25], full_name=row[26])
        if row[27]:
            device_data['borrower_amt'] = Amt(id=row[27], name=row[28], department_id=row[24] or 1)
        
        # Add device department/amt
        if row[29]:
            device_data['department'] = Department(id=row[29], name=row[30], full_name=row[31])
        if row[32]:
            device_data['amt'] = Amt(id=row[32], name=row[33], department_id=row[29] or 1)
        
        return DeviceFull(**device_data)
    
    def _row_to_missing_device(self, row) -> MissingDevice:
        """Convert database row to MissingDevice object."""
        return MissingDevice(
            id=row[0],
            original_device_id=row[1],
            device_type=row[2],
            manufacturer=row[3],
            model=row[4],
            serial_number=row[5],
            inventory_number=row[6],
            status=DeviceStatus(row[7]),
            location_id=row[8],
            borrowed_at=datetime.fromisoformat(row[9]) if row[9] else None,
            expected_return_date=date.fromisoformat(row[10]) if row[10] else None,
            borrower_name=row[11],
            borrower_email=row[12],
            borrower_phone=row[13],
            borrower_user_id=row[14],
            borrower_snapshot=json.loads(row[15]) if row[15] else None,
            notes=row[16],
            reported_at=datetime.fromisoformat(row[17]),
            reported_by_user_id=row[18]
        )
