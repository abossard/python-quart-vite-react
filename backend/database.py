"""
Database connection and helper functions for Grabit.
Handles MySQL/MariaDB connection pooling and common queries.
"""

import aiosqlite
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager


# ============================================================================
# Database Configuration
# ============================================================================

# For development, we'll use SQLite as a drop-in replacement for MySQL
# In production, replace with aiomysql or asyncmy for real MySQL/MariaDB
DB_PATH = 'grabit.db'


# ============================================================================
# Connection Management
# ============================================================================

_db_connection: Optional[aiosqlite.Connection] = None


async def init_db():
    """
    Initialize database connection.
    Creates tables if they don't exist.
    """
    global _db_connection
    
    _db_connection = await aiosqlite.connect(DB_PATH)
    _db_connection.row_factory = aiosqlite.Row
    
    # Enable foreign keys
    await _db_connection.execute('PRAGMA foreign_keys = ON')
    await _db_connection.commit()
    
    # Load schema if tables don't exist
    await _ensure_schema()


async def _ensure_schema():
    """
    Create tables if they don't exist (SQLite version of MySQL schema).
    """
    cursor = await _db_connection.cursor()
    
    # Check if users table exists
    await cursor.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='users'"
    )
    if await cursor.fetchone():
        await cursor.close()
        return  # Schema already exists
    
    # Create tables (SQLite-compatible version)
    schema = """
    CREATE TABLE IF NOT EXISTS locations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        address TEXT
    );
    
    CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        full_name TEXT
    );
    
    CREATE TABLE IF NOT EXISTS amt (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        department_id INTEGER NOT NULL,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
    );
    
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        location_id INTEGER,
        department_id INTEGER,
        amt_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (amt_id) REFERENCES amt(id)
    );
    
    CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_type TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        model TEXT NOT NULL,
        serial_number TEXT,
        inventory_number TEXT,
        status TEXT NOT NULL DEFAULT 'available',
        location_id INTEGER NOT NULL,
        department_id INTEGER,
        amt_id INTEGER,
        borrowed_at TEXT,
        expected_return_date TEXT,
        borrower_name TEXT,
        borrower_email TEXT,
        borrower_phone TEXT,
        borrower_user_id INTEGER,
        borrower_snapshot TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (location_id) REFERENCES locations(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (amt_id) REFERENCES amt(id),
        FOREIGN KEY (borrower_user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS devices_missing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        original_device_id INTEGER NOT NULL,
        device_type TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        model TEXT NOT NULL,
        serial_number TEXT,
        inventory_number TEXT,
        status TEXT NOT NULL,
        location_id INTEGER NOT NULL,
        department_id INTEGER,
        amt_id INTEGER,
        borrowed_at TEXT,
        expected_return_date TEXT,
        borrower_name TEXT,
        borrower_email TEXT,
        borrower_phone TEXT,
        borrower_user_id INTEGER,
        borrower_snapshot TEXT,
        notes TEXT,
        reported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reported_by_user_id INTEGER NOT NULL,
        FOREIGN KEY (location_id) REFERENCES locations(id),
        FOREIGN KEY (department_id) REFERENCES departments(id),
        FOREIGN KEY (amt_id) REFERENCES amt(id),
        FOREIGN KEY (reported_by_user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS device_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        device_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        transaction_type TEXT NOT NULL,
        snapshot_before TEXT,
        snapshot_after TEXT,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (device_id) REFERENCES devices(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    );
    
    CREATE INDEX IF NOT EXISTS idx_devices_status ON devices(status);
    CREATE INDEX IF NOT EXISTS idx_devices_location ON devices(location_id);
    CREATE INDEX IF NOT EXISTS idx_devices_borrower ON devices(borrower_user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_device ON device_transactions(device_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON device_transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);
    """
    
    await _db_connection.executescript(schema)
    await _db_connection.commit()
    await cursor.close()
    
    # Insert seed data
    await _insert_seed_data()


async def _insert_seed_data():
    """
    Insert seed data for development/testing.
    """
    from auth import hash_password
    
    cursor = await _db_connection.cursor()
    
    # Locations with addresses
    await cursor.execute("INSERT OR IGNORE INTO locations (name, address) VALUES ('Bollwerk', 'Bollwerk 85, 3013 Bern')")
    await cursor.execute("INSERT OR IGNORE INTO locations (name, address) VALUES ('Guisanplatz', 'Guisanplatz 1, 3014 Bern')")
    await cursor.execute("INSERT OR IGNORE INTO locations (name, address) VALUES ('Zollikofen', 'Eichenweg 1, 3052 Zollikofen')")
    
    # Departments with full names
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('BK', 'Bundeskanzlei')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('EDI', 'Eidgenössisches Departement des Innern')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('EFD', 'Eidgenössisches Finanzdepartement')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('EJPD', 'Eidgenössisches Justiz- und Polizeidepartement')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('UVEK', 'Eidgenössisches Departement für Umwelt, Verkehr, Energie und Kommunikation')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('VBS', 'Eidgenössisches Departement für Verteidigung, Bevölkerungsschutz und Sport')")
    await cursor.execute("INSERT OR IGNORE INTO departments (name, full_name) VALUES ('WBF', 'Eidgenössisches Departement für Wirtschaft, Bildung und Forschung')")
    
    # Ämter (Offices) - grouped by department
    # BK (id=1)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BK', 1)")
    
    # EDI (id=2)  
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAG', 2)")  # Bundesamt für Gesundheit
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAK', 2)")  # Bundesamt für Kultur
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAR', 2)")  # Schweizerisches Bundesarchiv
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BFS', 2)")  # Bundesamt für Statistik
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BLV', 2)")  # Bundesamt für Meteorologie und Klimatologie MeteoSchweiz
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BSV', 2)")  # Bundesamt für Sozialversicherungen
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('GS-EDI', 2)")  # Generalsekretariat EDI
    
    # EFD (id=3)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BIT', 3)")  # Bundesamt für Informatik und Telekommunikation
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAZG', 3)")  # Bundesamt für Zoll und Grenzsicherheit
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('EFV', 3)")  # Eidgenössische Finanzverwaltung
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('EPA', 3)")  # Eidgenössische Personalamt
    
    # EJPD (id=4)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BJ', 4)")  # Bundesamt für Justiz
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('fedpol', 4)")  # Bundesamt für Polizei
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('SEM', 4)")  # Staatssekretariat für Migration
    
    # UVEK (id=5)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAFU', 5)")  # Bundesamt für Umwelt
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAV', 5)")  # Bundesamt für Verkehr
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BAKOM', 5)")  # Bundesamt für Kommunikation
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BFE', 5)")  # Bundesamt für Energie
    
    # VBS (id=6)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('armasuisse', 6)")
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BABS', 6)")  # Bundesamt für Bevölkerungsschutz
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BASPO', 6)")  # Bundesamt für Sport
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('swisstopo', 6)")  # Bundesamt für Landestopografie
    
    # WBF (id=7)
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('SECO', 7)")  # Staatssekretariat für Wirtschaft
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BLW', 7)")  # Bundesamt für Landwirtschaft
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('BWO', 7)")  # Bundesamt für Wohnungswesen
    await cursor.execute("INSERT OR IGNORE INTO amt (name, department_id) VALUES ('Agroscope', 7)")
    
    # Default admin user
    admin_hash = hash_password('admin123')
    await cursor.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)",
        ('admin', admin_hash, 'admin')
    )
    
    # Test user
    test_hash = hash_password('test123')
    await cursor.execute(
        "INSERT OR IGNORE INTO users (username, password_hash, role, location_id, department_id, amt_id) VALUES (?, ?, ?, 1, 1, 1)",
        ('testuser', test_hash, 'user')
    )
    
    # Sample devices
    now = datetime.now().isoformat()
    devices = [
        ('Laptop', 'Dell', 'Latitude 7490', 'SN123456', 'INV-001', 'available', 1, None, now, now),
        ('Laptop', 'HP', 'EliteBook 840', 'SN234567', 'INV-002', 'available', 1, None, now, now),
        ('Beamer', 'Epson', 'EB-X05', 'SN345678', 'INV-003', 'available', 2, None, now, now),
        ('Headset', 'Logitech', 'H390', 'SN456789', 'INV-004', 'available', 1, 'USB Headset', now, now),
        ('Monitor', 'Samsung', 'S24R350', 'SN567890', 'INV-005', 'available', 3, '24 Zoll', now, now),
        ('Tablet', 'Apple', 'iPad Pro', 'SN678901', 'INV-006', 'available', 1, '12.9 Zoll', now, now),
        ('Dockingstation', 'Dell', 'WD19', 'SN789012', 'INV-007', 'available', 2, None, now, now),
        ('Webcam', 'Logitech', 'C920', 'SN890123', 'INV-008', 'available', 1, 'Full HD', now, now),
        ('Maus', 'Logitech', 'MX Master 3', 'SN901234', 'INV-009', 'available', 2, None, now, now),
        ('Tastatur', 'Logitech', 'MX Keys', 'SN012345', 'INV-010', 'available', 3, None, now, now),
    ]
    
    for device in devices:
        await cursor.execute("""
            INSERT OR IGNORE INTO devices (
                device_type, manufacturer, model, serial_number, inventory_number,
                status, location_id, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, device)
    
    await _db_connection.commit()
    await cursor.close()


async def close_db():
    """Close database connection."""
    global _db_connection
    if _db_connection:
        await _db_connection.close()
        _db_connection = None


def get_db() -> aiosqlite.Connection:
    """
    Get database connection.
    
    Returns:
        Active database connection
    """
    if not _db_connection:
        raise RuntimeError('Database not initialized. Call init_db() first.')
    return _db_connection


@asynccontextmanager
async def db_transaction():
    """
    Context manager for database transactions.
    
    Usage:
        async with db_transaction():
            await cursor.execute(...)
            await cursor.execute(...)
    """
    conn = get_db()
    try:
        yield conn
        await conn.commit()
    except Exception:
        await conn.rollback()
        raise
