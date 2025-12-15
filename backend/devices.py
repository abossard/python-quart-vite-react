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
            d.id, d.asset_tag, d.device_type, d.model,
            d.inventory_number, d.windows_version, d.status, d.location_id, d.department_id, d.amt_id,
            d.borrowed_at, d.expected_return_date, d.borrower_name, d.borrower_email,
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
        AND d.status != 'missing'
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
            d.id, d.asset_tag, d.device_type, d.model,
            d.inventory_number, d.windows_version, d.status, d.location_id, d.department_id, d.amt_id,
            d.borrowed_at, d.expected_return_date, d.borrower_name, d.borrower_email,
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
                asset_tag, device_type, model, inventory_number, windows_version,
                status, location_id, department_id, amt_id, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            data.asset_tag, data.device_type, data.model,
            data.inventory_number, data.windows_version, DeviceStatus.AVAILABLE.value, 
            data.location_id, data.department_id, data.amt_id, data.notes, now, now
        ))
        
        device_id = cursor.lastrowid
        await self.db.commit()
        await cursor.close()
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.CREATE,
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
        # Debug logging
        print(f"UPDATE DEVICE: device_id={device_id}, data={data.model_dump()}")
        
        # Get current state for transaction log
        current = await self.get_device(device_id)
        if not current:
            return None
        
        cursor = await self.db.cursor()
        
        # Build update query dynamically based on provided fields
        updates = []
        params = []
        
        if data.asset_tag is not None:
            updates.append("asset_tag = ?")
            params.append(data.asset_tag)
        if data.device_type is not None:
            updates.append("device_type = ?")
            params.append(data.device_type)
        if data.model is not None:
            updates.append("model = ?")
            params.append(data.model)
        if data.inventory_number is not None:
            updates.append("inventory_number = ?")
            params.append(data.inventory_number)
        if data.windows_version is not None:
            updates.append("windows_version = ?")
            params.append(data.windows_version)
        if data.location_id is not None:
            updates.append("location_id = ?")
            params.append(data.location_id)
        # Always update department_id and amt_id even if None (to allow clearing)
        if 'department_id' in data.model_dump(exclude_unset=True):
            updates.append("department_id = ?")
            params.append(data.department_id)
        if 'amt_id' in data.model_dump(exclude_unset=True):
            updates.append("amt_id = ?")
            params.append(data.amt_id)
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
        print(f"SQL QUERY: {query}")
        print(f"SQL PARAMS: {params}")
        await cursor.execute(query, params)
        await self.db.commit()
        await cursor.close()
        
        # Get updated device for snapshot
        device = await self.get_device(device_id)
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.UPDATE,
            snapshot_before=current.model_dump(mode='json'),
            snapshot_after=device.model_dump(mode='json') if device else None,
            notes="Device updated"
        )
        
        # Broadcast event to all clients
        if device:
            await broadcast_event(EventType.DEVICE_UPDATED, device.model_dump(mode='json'))
        
        return device
    
    async def delete_device(self, device_id: int, user_id: int) -> bool:
        """
        Delete a device completely (removes device and all its transaction history).
        
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
        
        # Delete all transactions for this device first (to avoid FK constraint)
        await cursor.execute("""
            DELETE FROM device_transactions WHERE device_id = ?
        """, (device_id,))
        
        # Broadcast event to all clients
        await broadcast_event(EventType.DEVICE_DELETED, {'id': device_id})
        
        # Delete the device
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
        
        # If department/organization provided from admindir, add to snapshot
        if data.borrower_department or data.borrower_organization:
            snapshot_dict = json.loads(borrower_snapshot) if borrower_snapshot else {}
            if data.borrower_department:
                snapshot_dict['department_name'] = data.borrower_department
            if data.borrower_organization:
                snapshot_dict['organization_name'] = data.borrower_organization
            borrower_snapshot = json.dumps(snapshot_dict)
        
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
        
        # Get updated device for snapshot
        device_updated = await self.get_device(device_id)
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.BORROW,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after=device_updated.model_dump(mode='json') if device_updated else None,
            notes=f"Device borrowed by {data.borrower_name}"
        )
        
        # Broadcast event to all clients
        if device_updated:
            await broadcast_event(EventType.DEVICE_BORROWED, device_updated.model_dump(mode='json'))
        
        return device_updated
    
    async def return_device(self, device_id: int, user_id: int, user_location_id: Optional[int] = None, notes: Optional[str] = None) -> Optional[Device]:
        """
        Return a borrowed device.
        
        Args:
            device_id: Device ID
            user_id: ID of user returning the device
            user_location_id: Location ID of the user returning the device (for inventory tracking)
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
        
        # If no user location provided, keep device at its current location
        return_location_id = user_location_id if user_location_id is not None else device.location_id
        
        # Update device status and location to user's location (or keep current if user has none)
        await cursor.execute("""
            UPDATE devices SET
                status = ?,
                location_id = ?,
                borrowed_at = NULL,
                expected_return_date = NULL,
                borrower_name = NULL,
                borrower_email = NULL,
                borrower_phone = NULL,
                borrower_user_id = NULL,
                borrower_snapshot = NULL,
                updated_at = ?
            WHERE id = ?
        """, (DeviceStatus.AVAILABLE.value, return_location_id, now, device_id))
        
        await self.db.commit()
        await cursor.close()
        
        # Get updated device for snapshot
        device_updated = await self.get_device(device_id)
        
        # Log transaction
        await self._log_transaction(
            device_id, user_id, TransactionType.RETURN,
            snapshot_before=device.model_dump(mode='json'),
            snapshot_after=device_updated.model_dump(mode='json') if device_updated else None,
            notes=notes or "Device returned"
        )
        
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
        cursor = await self.db.cursor()
        
        try:
            # Get device object for snapshot
            device = await self.get_device(data.device_id)
            if not device:
                await cursor.close()
                raise ValueError(f"Device {data.device_id} not found")
            
            # Get device data directly from database for copying to missing table
            await cursor.execute("SELECT * FROM devices WHERE id = ?", (data.device_id,))
            device_row = await cursor.fetchone()
            
            # Use the provided reported_by_user_id or fall back to user_id
            reporter_id = data.reported_by_user_id if data.reported_by_user_id else user_id
            
            # Copy device to devices_missing (using raw column positions from devices table)
            # devices columns: id, asset_tag, device_type, model, inventory_number, windows_version,
            # status, location_id, department_id, amt_id, borrowed_at, expected_return_date,
            # borrower_name, borrower_email, borrower_phone, borrower_user_id, borrower_snapshot,
            # notes, created_at, updated_at
            
            # Get location_id - must not be NULL
            location_id = data.last_known_location_id or device_row[7]
            if not location_id:
                await cursor.close()
                raise ValueError("Device must have a location_id to be reported as missing")
            
            # Convert status to string if it's numeric
            status_value = device_row[6]
            if isinstance(status_value, int):
                # Map numeric status to string: 0=available, 1=borrowed, 2=reserved
                status_map = {0: 'available', 1: 'borrowed', 2: 'reserved'}
                status_value = status_map.get(status_value, 'available')
            
            await cursor.execute("""
                INSERT INTO devices_missing (
                    original_device_id, asset_tag, device_type, model,
                    inventory_number, windows_version, status, location_id, department_id, amt_id,
                    borrowed_at, expected_return_date,
                    borrower_name, borrower_email, borrower_phone, borrower_user_id,
                    borrower_snapshot, notes, reported_by_user_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                device_row[0],  # id -> original_device_id
                device_row[1],  # asset_tag
                device_row[2],  # device_type
                device_row[3],  # model
                device_row[4],  # inventory_number
                device_row[5],  # windows_version
                status_value,   # status (converted to string)
                location_id,    # location_id (validated not NULL)
                device_row[8],  # department_id
                device_row[9],  # amt_id
                device_row[10],  # borrowed_at
                device_row[11],  # expected_return_date
                device_row[12],  # borrower_name
                device_row[13],  # borrower_email
                device_row[14],  # borrower_phone
                device_row[15],  # borrower_user_id
                device_row[16],  # borrower_snapshot
                (device_row[17] or '') + '\n' + (data.notes or ''),  # notes + missing reason
                reporter_id  # reported_by_user_id
            ))
            
            missing_id = cursor.lastrowid
            
            # Create snapshot_after with device info and missing status
            snapshot_after = device.model_dump(mode='json')
            snapshot_after['status'] = 'missing'
            snapshot_after['missing_id'] = missing_id
            
            # Log transaction before updating status
            await self._log_transaction(
                data.device_id, user_id, TransactionType.REPORT_MISSING,
                snapshot_before=device.model_dump(mode='json'),
                snapshot_after=snapshot_after,
                notes=data.notes or "Device reported missing"
            )
            
            # Update device status to 'missing' instead of deleting
            # (Can't delete due to FOREIGN KEY constraint with device_transactions)
            await cursor.execute("""
                UPDATE devices 
                SET status = 'missing',
                    updated_at = ?
                WHERE id = ?
            """, (datetime.now().isoformat(), data.device_id))
            
            await self.db.commit()
        except Exception as e:
            await self.db.rollback()
            await cursor.close()
            import traceback
            traceback.print_exc()
            raise ValueError(f"Failed to report device as missing: {str(e)}")
        
        # Get missing device
        await cursor.execute("""
            SELECT * FROM devices_missing WHERE id = ?
        """, (missing_id,))
        row = await cursor.fetchone()
        await cursor.close()
        
        missing_device = self._row_to_missing_device(row)
        
        # Broadcast events to all clients
        # First notify that device was deleted from active devices
        await broadcast_event(EventType.DEVICE_DELETED, {'id': data.device_id})
        # Then notify about new missing device
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
        
        # Get username for the transaction
        await cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        user_row = await cursor.fetchone()
        username = user_row[0] if user_row else "Unknown"
        
        await cursor.execute("""
            INSERT INTO device_transactions (
                device_id, user_id, transaction_type,
                snapshot_before, snapshot_after, notes, created_at
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
            'asset_tag': row[1],
            'device_type': row[2],
            'model': row[3],
            'inventory_number': row[4],
            'windows_version': row[5],
            'status': DeviceStatus(row[6]),
            'location_id': row[7],
            'department_id': row[8],
            'amt_id': row[9],
            'borrowed_at': datetime.fromisoformat(row[10]) if row[10] else None,
            'expected_return_date': date.fromisoformat(row[11]) if row[11] else None,
            'borrower_name': row[12],
            'borrower_email': row[13],
            'borrower_phone': row[14],
            'borrower_user_id': row[15],
            'borrower_snapshot': json.loads(row[16]) if row[16] else None,
            'notes': row[17],
            'is_overdue': bool(row[36]),
            'days_overdue': int(row[37]) if row[37] else None
        }
        
        # Parse timestamps with fallback for invalid formats
        try:
            device_data['created_at'] = datetime.fromisoformat(row[18]) if row[18] else datetime.now()
        except (ValueError, TypeError):
            device_data['created_at'] = datetime.now()
        
        try:
            device_data['updated_at'] = datetime.fromisoformat(row[19]) if row[19] else datetime.now()
        except (ValueError, TypeError):
            device_data['updated_at'] = datetime.now()
        
        # Updated column mapping (without manufacturer and serial_number):
        # row[20]=loc_id, row[21]=loc_name, row[22]=loc_address
        # row[23]=borrower_loc_id, row[24]=borrower_loc_name, row[25]=borrower_loc_address
        # row[26]=borrower_dept_id, row[27]=borrower_dept_name, row[28]=borrower_dept_full_name
        # row[29]=borrower_amt_id, row[30]=borrower_amt_name
        # row[31]=device_dept_id, row[32]=device_dept_name, row[33]=device_dept_full_name
        # row[34]=device_amt_id, row[35]=device_amt_name
        # row[36]=is_overdue, row[37]=days_overdue
        
        # Add location (row[20-22])
        if row[20]:
            device_data['location'] = Location(id=row[20], name=row[21], address=row[22])
        
        # Add borrower location/department/amt from JOINs or borrower_snapshot
        borrower_snapshot = device_data.get('borrower_snapshot')
        
        if row[23]:
            device_data['borrower_location'] = Location(id=row[23], name=row[24], address=row[25])
        elif borrower_snapshot and borrower_snapshot.get('location_id'):
            device_data['borrower_location'] = Location(
                id=borrower_snapshot['location_id'],
                name=borrower_snapshot.get('location_name', ''),
                address=None
            )
        
        if row[26]:
            device_data['borrower_department'] = Department(id=row[26], name=row[27], full_name=row[28])
        
        if row[29]:
            device_data['borrower_amt'] = Amt(id=row[29], name=row[30], department_id=row[26] or 1)
        
        # Add display-only fields from borrower_snapshot (admindir data)
        if borrower_snapshot:
            if borrower_snapshot.get('department_name') and not row[26]:
                device_data['borrower_department_name'] = borrower_snapshot.get('department_name')
            if borrower_snapshot.get('organization_name') and not row[29]:
                device_data['borrower_organization_name'] = borrower_snapshot.get('organization_name')
        
        # Add device department/amt
        if row[31]:
            device_data['department'] = Department(id=row[31], name=row[32], full_name=row[33])
        if row[34]:
            device_data['amt'] = Amt(id=row[34], name=row[35], department_id=row[31] or 1)
        
        return DeviceFull(**device_data)
    
    def _row_to_missing_device(self, row) -> MissingDevice:
        """Convert database row to MissingDevice object."""
        # Convert status to DeviceStatus enum, handling both string and numeric values
        status_value = row[7]
        if isinstance(status_value, int):
            # Map numeric status to string: 0=available, 1=borrowed, 2=reserved
            status_map = {0: 'available', 1: 'borrowed', 2: 'reserved'}
            status_value = status_map.get(status_value, 'available')
        
        return MissingDevice(
            id=row[0],
            original_device_id=row[1],
            asset_tag=row[2],
            device_type=row[3],
            model=row[4],
            inventory_number=row[5],
            windows_version=row[6],
            status=DeviceStatus(status_value),
            location_id=row[8],
            borrowed_at=datetime.fromisoformat(row[11]) if row[11] else None,
            expected_return_date=date.fromisoformat(row[12]) if row[12] else None,
            borrower_name=row[13],
            borrower_email=row[14],
            borrower_phone=row[15],
            borrower_user_id=row[16],
            borrower_snapshot=json.loads(row[17]) if row[17] else None,
            notes=row[18],
            reported_at=datetime.fromisoformat(row[19]),
            reported_by_user_id=row[20]
        )
    
    async def restore_missing_device(self, missing_device_id: int, user_id: int) -> DeviceFull:
        """
        Restore a missing device back to the devices table.
        
        Args:
            missing_device_id: ID of the missing device record
            user_id: ID of the user performing the restore
            
        Returns:
            Restored DeviceFull object
            
        Raises:
            ValueError: If missing device not found
        """
        cursor = await self.db.cursor()
        
        try:
            # Get missing device data
            await cursor.execute("""
                SELECT * FROM devices_missing WHERE id = ?
            """, (missing_device_id,))
            missing_row = await cursor.fetchone()
            
            if not missing_row:
                raise ValueError(f"Missing device with id {missing_device_id} not found")
            
            # Extract data from missing device (row indices match devices_missing schema)
            # Correct schema: id(0), original_device_id(1), asset_tag(2), device_type(3), 
            #                 model(4), inventory_number(5), windows_version(6), status(7), 
            #                 location_id(8), department_id(9), amt_id(10),
            #                 borrowed_at(11), expected_return_date(12),
            #                 borrower_name(13), borrower_email(14), borrower_phone(15),
            #                 borrower_user_id(16), borrower_snapshot(17), notes(18),
            #                 reported_at(19), reported_by_user_id(20)
            
            # Validate Foreign Keys exist, use first available if missing
            location_id = missing_row[8]
            if location_id:
                await cursor.execute("SELECT id FROM locations WHERE id = ?", (location_id,))
                if not await cursor.fetchone():
                    await cursor.execute("SELECT id FROM locations LIMIT 1")
                    fallback = await cursor.fetchone()
                    location_id = fallback[0] if fallback else None
            
            if not location_id:
                raise ValueError("No valid location found - cannot restore device")
            
            # Validate department_id (required - use fallback if missing)
            department_id = missing_row[9]
            if department_id:
                await cursor.execute("SELECT id FROM departments WHERE id = ?", (department_id,))
                if not await cursor.fetchone():
                    # Use first available department as fallback
                    await cursor.execute("SELECT id FROM departments LIMIT 1")
                    fallback = await cursor.fetchone()
                    department_id = fallback[0] if fallback else None
            else:
                # No department_id set - use first available
                await cursor.execute("SELECT id FROM departments LIMIT 1")
                fallback = await cursor.fetchone()
                department_id = fallback[0] if fallback else None
            
            if not department_id:
                raise ValueError("No valid department found - cannot restore device")
            
            # Validate amt_id (required - use fallback if missing)
            amt_id = missing_row[10]
            if amt_id:
                await cursor.execute("SELECT id FROM amt WHERE id = ?", (amt_id,))
                if not await cursor.fetchone():
                    # Use first available amt as fallback
                    await cursor.execute("SELECT id FROM amt LIMIT 1")
                    fallback = await cursor.fetchone()
                    amt_id = fallback[0] if fallback else None
            else:
                # No amt_id set - use first available
                await cursor.execute("SELECT id FROM amt LIMIT 1")
                fallback = await cursor.fetchone()
                amt_id = fallback[0] if fallback else None
            
            if not amt_id:
                raise ValueError("No valid amt found - cannot restore device")
            
            # Insert back into devices (status set to 'available')
            # Note: created_at and updated_at have DEFAULT values, so we don't set them
            await cursor.execute("""
                INSERT INTO devices (
                    asset_tag, device_type, model, inventory_number, windows_version,
                    status, location_id, department_id, amt_id,
                    borrowed_at, expected_return_date, borrower_name, borrower_email,
                    borrower_phone, borrower_user_id, borrower_snapshot, notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                missing_row[2],  # asset_tag
                missing_row[3],  # device_type
                missing_row[4],  # model
                missing_row[5],  # inventory_number
                missing_row[6],  # windows_version
                'available',     # status (reset to available)
                location_id,     # location_id (validated)
                department_id,   # department_id (validated, can be NULL)
                amt_id,          # amt_id (validated, can be NULL)
                None,            # borrowed_at (clear borrowing info)
                None,            # expected_return_date
                None,            # borrower_name
                None,            # borrower_email
                None,            # borrower_phone
                None,            # borrower_user_id
                None,            # borrower_snapshot
                missing_row[18]  # notes (CORRECTED INDEX)
            ))
            
            new_device_id = cursor.lastrowid
            
            # Delete from devices_missing
            await cursor.execute("""
                DELETE FROM devices_missing WHERE id = ?
            """, (missing_device_id,))
            
            await self.db.commit()
            
            # Fetch the restored device with full details
            restored_device = await self.get_device(new_device_id)
            
            # Create snapshot_before with device info from missing_row
            # Row indices: [0]=id, [1]=original_device_id, [2]=asset_tag, [3]=device_type,
            # [4]=model, [5]=inventory_number, [6]=windows_version, [7]=status, [8]=location_id,
            # [9]=department_id, [10]=amt_id, [18]=notes
            snapshot_before = {
                'missing_device_id': missing_device_id,
                'status': 'missing',
                'asset_tag': missing_row[2],
                'device_type': missing_row[3],
                'model': missing_row[4],
                'inventory_number': missing_row[5],
                'windows_version': missing_row[6]
            }
            
            # Log transaction AFTER getting full device data
            await self._log_transaction(
                device_id=new_device_id,
                user_id=user_id,
                transaction_type=TransactionType.FOUND,
                snapshot_before=snapshot_before,
                snapshot_after=restored_device.model_dump(mode='json') if restored_device else None,
                notes=f"Device restored from missing devices (original ID: {missing_row[1]})"
            )
            
            if not restored_device:
                raise ValueError(f"Failed to retrieve restored device with id {new_device_id}")
            
            # Broadcast event
            await broadcast_event(EventType.DEVICE_FOUND, {
                'device_id': new_device_id,
                'missing_device_id': missing_device_id,
                'user_id': user_id
            })
            
            return restored_device
            
        except Exception as e:
            await self.db.rollback()
            import traceback
            traceback.print_exc()
            print(f"ERROR restoring device: {e}")
            raise
        finally:
            await cursor.close()
    
    async def delete_missing_device(self, missing_device_id: int, user_id: int) -> bool:
        """
        Permanently delete a missing device record.
        
        Args:
            missing_device_id: ID of the missing device record
            user_id: ID of the user performing the deletion
            
        Returns:
            True if deleted successfully
            
        Raises:
            ValueError: If missing device not found
        """
        cursor = await self.db.cursor()
        
        try:
            # Check if device exists
            await cursor.execute("""
                SELECT * FROM devices_missing WHERE id = ?
            """, (missing_device_id,))
            missing_row = await cursor.fetchone()
            
            if not missing_row:
                raise ValueError(f"Missing device with id {missing_device_id} not found")
            
            # Note: Logging is done in the endpoint via log_system_action
            # We don't log to device_transactions because device_id is NOT NULL
            
            # Delete from devices_missing
            await cursor.execute("""
                DELETE FROM devices_missing WHERE id = ?
            """, (missing_device_id,))
            
            await self.db.commit()
            
            # Broadcast event
            await broadcast_event(EventType.DEVICE_DELETED, {
                'missing_device_id': missing_device_id,
                'user_id': user_id
            })
            
            return True
            
        except Exception:
            await self.db.rollback()
            raise
        finally:
            await cursor.close()
