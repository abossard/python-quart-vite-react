# Database Setup Instructions

## Prerequisites
- MySQL 5.7+ or MariaDB 10.3+
- Python 3.10+ with mysqlclient or pymysql

## Initial Setup

### 1. Create Database
```bash
mysql -u root -p
```

```sql
CREATE DATABASE grabit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'grabit_user'@'localhost' IDENTIFIED BY 'secure_password_here';
GRANT ALL PRIVILEGES ON grabit_db.* TO 'grabit_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### 2. Run Migration
```bash
mysql -u grabit_user -p grabit_db < database/001_initial_schema.sql
```

### 3. Verify Installation
```bash
mysql -u grabit_user -p grabit_db -e "SHOW TABLES;"
```

Expected output:
- amt
- departments
- device_transactions
- devices
- devices_missing
- locations
- password_resets
- users
- v_devices_full (view)
- v_overdue_devices (view)

## Default Credentials

**Admin User:**
- Username: `admin`
- Password: `admin123`
- Email: `admin@grabit.local`
- Role: `admin`

**Test User:**
- Username: `testuser`
- Password: `admin123`
- Email: `test@grabit.local`
- Role: `user`

⚠️ **WICHTIG**: Diese Passwörter MÜSSEN nach dem ersten Login geändert werden!

## Configuration

Update `config/app.py` or environment variables:

```python
DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'database': 'grabit_db',
    'user': 'grabit_user',
    'password': 'secure_password_here',
    'charset': 'utf8mb4'
}
```

## Database Schema Overview

### Core Tables

#### locations
- Standorte (z.B. Bollwerk, Zollikofen)

#### departments
- Oberste Organisationseinheit (z.B. EDI, EFD)

#### amt
- Ämter innerhalb von Departments (z.B. BIT, BAG)

#### users
- Benutzerverwaltung mit Rollen:
  - `servicedesk`: Nur Lesezugriff
  - `user`: Geräte ausleihen/zurückgeben
  - `editor`: + Geräte erstellen/bearbeiten
  - `redakteur`: Vollzugriff außer User-Management
  - `admin`: Vollzugriff

#### devices
- Verfügbare Geräte mit Status (in/out)
- Ausleiher-Informationen
- JSON-Snapshot für Historie

#### devices_missing
- Vermisste Geräte (gleiche Struktur wie devices)

#### device_transactions
- Audit-Log aller Geräte-Aktionen
- JSON-Snapshots für Nachvollziehbarkeit

#### password_resets
- Token-basierter Passwort-Reset

### Views

#### v_devices_full
- Vollständige Device-Info mit JOINs
- Berechnet überfällige Geräte

#### v_overdue_devices
- Nur Geräte die >7 Tage ausgeliehen sind

## Sample Data

Die Migration enthält:
- 3 Locations
- 3 Departments
- 5 Amts
- 2 Users (admin + testuser)
- 10 Demo-Geräte

## Backup & Restore

### Backup
```bash
mysqldump -u grabit_user -p grabit_db > backup_$(date +%Y%m%d).sql
```

### Restore
```bash
mysql -u grabit_user -p grabit_db < backup_20251127.sql
```

## Troubleshooting

### Connection Issues
```bash
# Test connection
mysql -u grabit_user -p -h localhost grabit_db
```

### Permission Issues
```sql
GRANT ALL PRIVILEGES ON grabit_db.* TO 'grabit_user'@'localhost';
FLUSH PRIVILEGES;
```

### Reset to Clean State
```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS grabit_db; CREATE DATABASE grabit_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u grabit_user -p grabit_db < database/001_initial_schema.sql
```
