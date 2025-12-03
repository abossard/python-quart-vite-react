-- Grabit Database Schema
-- Initial Migration: Core Tables for Device Management System
-- Created: 2025-11-27

-- ============================================================================
-- 1. LOCATIONS - Standorte
-- ============================================================================
CREATE TABLE IF NOT EXISTS locations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  address VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 2. DEPARTMENTS - Departemente (Oberste Organisationseinheit)
-- ============================================================================
CREATE TABLE IF NOT EXISTS departments (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,        -- Kurzname, z.B. "EDI"
  full_name VARCHAR(255),             -- Voller Name, z.B. "Eidgenössisches Departement des Innern"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 3. AMT - Ämter (Untereinheit von Departments)
-- ============================================================================
CREATE TABLE IF NOT EXISTS amt (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,        -- Kurzname, z.B. "BIT"
  full_name VARCHAR(255),             -- Voller Name
  department_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  INDEX idx_department (department_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 4. USERS - Benutzerverwaltung
-- ============================================================================
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  role ENUM('servicedesk','user','editor','redakteur','admin') DEFAULT 'user',
  location_id INT,
  short_code VARCHAR(20),              -- Optional: Kürzel für schnellen Zugriff
  reset_token VARCHAR(100),            -- Passwort-Reset Token
  reset_expires DATETIME,              -- Token-Ablaufzeit
  is_active BOOLEAN DEFAULT TRUE,      -- Account aktiv/deaktiviert
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  last_login TIMESTAMP NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  INDEX idx_username (username),
  INDEX idx_email (email),
  INDEX idx_role (role),
  INDEX idx_location (location_id),
  INDEX idx_reset_token (reset_token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 5. DEVICES - Verfügbare Geräte
-- ============================================================================
CREATE TABLE IF NOT EXISTS devices (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(150) NOT NULL,              -- z.B. "Laptop", "Beamer"
  model VARCHAR(100) NOT NULL,              -- Modellbezeichnung
  device_type VARCHAR(50) NOT NULL,         -- z.B. "G10", "USB-C 65W"
  cm_number VARCHAR(50),                    -- Configuration Manager Nummer
  department_id INT NOT NULL,
  amt_id INT NOT NULL,
  location_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'in',          -- 'in' (verfügbar) oder 'out' (ausgeliehen)
  borrower_name VARCHAR(100),               -- Name des Ausleihers
  borrower_client_id INT,                   -- ID aus externem Client-System
  borrower_email VARCHAR(190),
  borrower_u_nummer VARCHAR(100),           -- Personalnummer
  borrower_snapshot LONGTEXT,               -- JSON: vollständige Ausleih-Info
  office_version VARCHAR(50),               -- z.B. "M365", "Office 2019"
  extra_info TEXT,                          -- Zusätzliche Notizen
  last_action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (amt_id) REFERENCES amt(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  INDEX idx_status (status),
  INDEX idx_location (location_id),
  INDEX idx_title (title),
  INDEX idx_cm_number (cm_number),
  INDEX idx_borrower_client_id (borrower_client_id),
  INDEX idx_last_action (last_action_date),
  INDEX idx_department (department_id),
  INDEX idx_amt (amt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 6. DEVICES_MISSING - Vermisste Geräte
-- ============================================================================
-- Identische Struktur wie devices - Geräte werden bei Verlust hierher verschoben
CREATE TABLE IF NOT EXISTS devices_missing (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_device_id INT,                   -- Original ID aus devices-Tabelle
  title VARCHAR(150) NOT NULL,
  model VARCHAR(100) NOT NULL,
  device_type VARCHAR(50) NOT NULL,
  cm_number VARCHAR(50),
  department_id INT NOT NULL,
  amt_id INT NOT NULL,
  location_id INT NOT NULL,
  status VARCHAR(20) DEFAULT 'in',
  borrower_name VARCHAR(100),
  borrower_client_id INT,
  borrower_email VARCHAR(190),
  borrower_u_nummer VARCHAR(100),
  borrower_snapshot LONGTEXT,
  office_version VARCHAR(50),
  extra_info TEXT,
  last_action_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  missing_since TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  missing_reason TEXT,                      -- Grund für Vermisst-Meldung
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (amt_id) REFERENCES amt(id) ON DELETE RESTRICT,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT,
  INDEX idx_original_device_id (original_device_id),
  INDEX idx_location (location_id),
  INDEX idx_missing_since (missing_since)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 7. DEVICE_TRANSACTIONS - Transaktions-Log
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  device_id INT,                            -- Kann NULL sein wenn Gerät gelöscht wurde
  snapshot LONGTEXT,                        -- JSON-Snapshot des Gerätezustands
  action VARCHAR(20) NOT NULL,              -- 'issue', 'return', 'missing', 'restore', 'create', 'update', 'delete'
  username VARCHAR(50) NOT NULL,            -- Wer hat die Aktion durchgeführt
  user_id INT,                              -- Optional: User-ID für referenzielle Integrität
  notes TEXT,                               -- Optional: Notizen zur Transaktion
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_device_id (device_id),
  INDEX idx_action (action),
  INDEX idx_username (username),
  INDEX idx_created_at (created_at),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- 8. PASSWORD_RESETS - Passwort-Zurücksetzung
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
  id INT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(190) NOT NULL,
  token VARCHAR(255) NOT NULL,
  used BOOLEAN DEFAULT FALSE,               -- Token bereits verwendet
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  INDEX idx_token (token),
  INDEX idx_email (email),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================================
-- SEED DATA - Basis-Konfiguration
-- ============================================================================

-- Default Locations
INSERT INTO locations (name, address) VALUES
('Bollwerk', 'Bollwerk 85, 3013 Bern'),
('Zollikofen', 'Eichenweg 1, 3052 Zollikofen'),
('Guisanplatz', 'Guisanplatz 1, 3014 Bern')
ON DUPLICATE KEY UPDATE name=name;

-- Default Departments
INSERT INTO departments (name, full_name) VALUES
('EDI', 'Eidgenössisches Departement des Innern'),
('EFD', 'Eidgenössisches Finanzdepartement'),
('EJPD', 'Eidgenössisches Justiz- und Polizeidepartement')
ON DUPLICATE KEY UPDATE name=name;

-- Default Amts (Beispiele)
INSERT INTO amt (name, full_name, department_id) VALUES
('BIT', 'Bundesamt für Informatik und Telekommunikation', 1),
('BAG', 'Bundesamt für Gesundheit', 1),
('BSV', 'Bundesamt für Sozialversicherungen', 1),
('BAZL', 'Bundesamt für Zivilluftfahrt', 2),
('EFK', 'Eidgenössische Finanzkontrolle', 2)
ON DUPLICATE KEY UPDATE name=name;

-- Default Admin User
-- Passwort: admin123 (MUSS nach erstem Login geändert werden!)
-- Hash generiert mit: password_hash('admin123', PASSWORD_DEFAULT)
INSERT INTO users (first_name, last_name, username, password_hash, email, role, location_id) VALUES
('Admin', 'User', 'admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@grabit.local', 'admin', 1)
ON DUPLICATE KEY UPDATE username=username;

-- Demo Test User
INSERT INTO users (first_name, last_name, username, password_hash, email, role, location_id) VALUES
('Test', 'User', 'testuser', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'test@grabit.local', 'user', 1)
ON DUPLICATE KEY UPDATE username=username;

-- ============================================================================
-- DEMO DEVICES
-- ============================================================================
INSERT INTO devices (title, model, device_type, cm_number, department_id, amt_id, location_id, status, office_version, extra_info) VALUES
('Laptop', 'ThinkPad X1', 'G10', 'CM012345', 1, 1, 1, 'in', 'M365', 'Neu, noch in Folie'),
('Laptop', 'Dell XPS 15', 'Standard', 'CM012346', 1, 1, 1, 'in', 'M365', ''),
('Beamer', 'Epson EB-2250U', 'Standard', 'CM012347', 1, 1, 2, 'in', '', 'Full HD, HDMI + VGA'),
('Headset', 'Plantronics Blackwire', '2 Ohr USB', '', 1, 1, 1, 'in', '', ''),
('Headset', 'Jabra Evolve2 65', 'Bluetooth', '', 1, 1, 2, 'in', '', 'Noise Cancelling'),
('USB-C Dock', 'Dell WD19', '180W', 'CM012348', 1, 1, 1, 'in', '', 'Mit Power Delivery'),
('Monitor', 'Dell U2720Q', '27" 4K', 'CM012349', 1, 1, 3, 'in', '', 'USB-C, höhenverstellbar'),
('Maus', 'Logitech MX Master 3', 'Wireless', '', 1, 1, 1, 'in', '', 'Ergonomisch'),
('Tastatur', 'Logitech MX Keys', 'Wireless', '', 1, 1, 1, 'in', '', 'Beleuchtet'),
('Webcam', 'Logitech C920', 'Full HD', 'CM012350', 1, 1, 2, 'in', '', '1080p, Stereo-Mikrofon')
ON DUPLICATE KEY UPDATE title=title;

-- ============================================================================
-- VIEWS - Hilfs-Views für häufige Queries
-- ============================================================================

-- Vollständige Device-Info mit Department und Amt Namen
CREATE OR REPLACE VIEW v_devices_full AS
SELECT 
  d.*,
  dep.name AS department_name,
  dep.full_name AS department_full_name,
  a.name AS amt_name,
  a.full_name AS amt_full_name,
  l.name AS location_name,
  l.address AS location_address,
  CASE 
    WHEN d.status = 'out' AND d.last_action_date <= DATE_SUB(NOW(), INTERVAL 7 DAY) 
    THEN TRUE 
    ELSE FALSE 
  END AS is_overdue,
  CASE 
    WHEN d.status = 'out' 
    THEN DATEDIFF(NOW(), d.last_action_date) 
    ELSE 0 
  END AS days_out
FROM devices d
JOIN departments dep ON dep.id = d.department_id
JOIN amt a ON a.id = d.amt_id
JOIN locations l ON l.id = d.location_id;

-- Überfällige Geräte
CREATE OR REPLACE VIEW v_overdue_devices AS
SELECT 
  d.*,
  DATEDIFF(NOW(), d.last_action_date) AS days_out
FROM devices d
WHERE d.status = 'out'
  AND d.last_action_date <= DATE_SUB(NOW(), INTERVAL 7 DAY)
ORDER BY d.last_action_date ASC;

-- ============================================================================
-- COMPLETE
-- ============================================================================
-- Migration 001 abgeschlossen
