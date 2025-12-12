"""
Pydantic models for Grabit device management system.
Mirrors database schema with validation and serialization.
"""

from datetime import datetime, date
from enum import Enum
from typing import Optional, Any
from pydantic import BaseModel, Field, field_validator, ConfigDict


# ============================================================================
# Enums
# ============================================================================

class UserRole(str, Enum):
    """User role hierarchy: servicedesk < user < editor < redakteur < admin"""
    SERVICEDESK = "servicedesk"
    USER = "user"
    EDITOR = "editor"
    REDAKTEUR = "redakteur"
    ADMIN = "admin"


class DeviceStatus(str, Enum):
    """Device availability status"""
    AVAILABLE = "available"
    BORROWED = "borrowed"
    RESERVED = "reserved"
    MISSING = "missing"


# ============================================================================
# Location Models
# ============================================================================

class LocationBase(BaseModel):
    """Base location model with common fields"""
    name: str = Field(..., max_length=100)
    address: Optional[str] = Field(None, max_length=200)


class LocationCreate(LocationBase):
    """Model for creating a new location"""
    pass


class Location(LocationBase):
    """Complete location model with ID"""
    id: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Department Models
# ============================================================================

class DepartmentBase(BaseModel):
    """Base department model with common fields"""
    name: str = Field(..., max_length=100)
    full_name: Optional[str] = Field(None, max_length=200)


class DepartmentCreate(DepartmentBase):
    """Model for creating a new department"""
    pass


class Department(DepartmentBase):
    """Complete department model with ID"""
    id: int
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Amt Models
# ============================================================================

class AmtBase(BaseModel):
    """Base amt (office) model with common fields"""
    name: str = Field(..., max_length=100)
    department_id: int = Field(..., gt=0)


class AmtCreate(AmtBase):
    """Model for creating a new amt"""
    pass


class Amt(AmtBase):
    """Complete amt model with ID"""
    id: int
    department: Optional['Department'] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# User Models
# ============================================================================

class UserBase(BaseModel):
    """Base user model with common fields"""
    username: str = Field(..., max_length=50)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    role: UserRole = UserRole.USER
    location_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    amt_id: Optional[int] = None
    amt_name: Optional[str] = None


class UserCreate(UserBase):
    """Model for creating a new user (requires password)"""
    password: str = Field(..., min_length=6)


class UserUpdate(BaseModel):
    """Model for updating user data (all fields optional)"""
    username: Optional[str] = Field(None, max_length=50)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
    role: Optional[UserRole] = None
    location_id: Optional[int] = None
    department_id: Optional[int] = None
    department_name: Optional[str] = None
    amt_id: Optional[int] = None
    amt_name: Optional[str] = None


class User(UserBase):
    """Complete user model (no password hash exposed)"""
    id: int
    created_at: datetime
    
    # Related entities (populated via JOINs) - using different names to avoid conflict
    location: Optional[Location] = None
    department: Optional[str] = None  # Department name from JOIN
    amt: Optional[str] = None  # Amt name from JOIN
    
    model_config = ConfigDict(from_attributes=True)


class UserWithPassword(User):
    """Internal user model including password hash (for auth only)"""
    password_hash: str


# ============================================================================
# Device Models
# ============================================================================

class DeviceBase(BaseModel):
    """Base device model with common fields"""
    device_type: str = Field(..., max_length=50)
    manufacturer: str = Field(..., max_length=100)
    model: str = Field(..., max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    inventory_number: Optional[str] = Field(None, max_length=100)
    location_id: int
    department_id: Optional[int] = None
    amt_id: Optional[int] = None
    notes: Optional[str] = None


class DeviceCreate(DeviceBase):
    """Model for creating a new device"""
    pass


class DeviceUpdate(BaseModel):
    """Model for updating device data (all fields optional)"""
    device_type: Optional[str] = Field(None, max_length=50)
    manufacturer: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    serial_number: Optional[str] = Field(None, max_length=100)
    inventory_number: Optional[str] = Field(None, max_length=100)
    location_id: Optional[int] = None
    department_id: Optional[int] = None
    amt_id: Optional[int] = None
    notes: Optional[str] = None


class DeviceBorrow(BaseModel):
    """Model for borrowing a device"""
    borrower_name: str = Field(..., max_length=100)
    borrower_email: str = Field(..., max_length=100)
    borrower_phone: Optional[str] = Field(default=None, max_length=50)
    borrower_department: Optional[str] = Field(default=None, max_length=200)
    borrower_organization: Optional[str] = Field(default=None, max_length=200)
    expected_return_date: date


class Device(DeviceBase):
    """Complete device model"""
    id: int
    status: DeviceStatus
    borrowed_at: Optional[datetime] = None
    expected_return_date: Optional[date] = None
    borrower_name: Optional[str] = None
    borrower_email: Optional[str] = None
    borrower_phone: Optional[str] = None
    borrower_user_id: Optional[int] = None
    borrower_snapshot: Optional[dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    
    # Related entity
    location: Optional[Location] = None
    
    model_config = ConfigDict(from_attributes=True)


class DeviceFull(Device):
    """Extended device view with calculated fields (from v_devices_full)"""
    is_overdue: bool = False
    days_overdue: Optional[int] = None
    
    # Related entities
    department: Optional[Department] = None
    amt: Optional[Amt] = None
    borrower_location: Optional[Location] = None
    borrower_department: Optional[Department] = None
    borrower_amt: Optional[Amt] = None
    
    # Display-only fields from admindir (when borrower is not a system user)
    borrower_department_name: Optional[str] = None
    borrower_organization_name: Optional[str] = None


# ============================================================================
# Missing Device Models
# ============================================================================

class MissingDeviceCreate(BaseModel):
    """Model for reporting a device as missing"""
    device_id: int
    reported_by_user_id: Optional[int] = None
    last_known_location_id: Optional[int] = None
    notes: Optional[str] = None


class MissingDevice(DeviceBase):
    """Complete missing device model (same structure as Device)"""
    id: int
    original_device_id: int
    status: DeviceStatus
    borrowed_at: Optional[datetime] = None
    expected_return_date: Optional[date] = None
    borrower_name: Optional[str] = None
    borrower_email: Optional[str] = None
    borrower_phone: Optional[str] = None
    borrower_user_id: Optional[int] = None
    borrower_snapshot: Optional[dict[str, Any]] = None
    reported_at: datetime
    reported_by_user_id: int
    
    # Related entities
    location: Optional[Location] = None
    reported_by: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Transaction Models
# ============================================================================

class TransactionType(str, Enum):
    """Device transaction types"""
    CREATE = "create"
    BORROW = "borrow"
    RETURN = "return"
    REPORT_MISSING = "report_missing"
    FOUND = "found"
    DELETE = "delete"
    LOCATION_CHANGE = "location_change"
    UPDATE = "update"


class TransactionCreate(BaseModel):
    """Model for creating a transaction (internal use)"""
    device_id: int
    user_id: int
    transaction_type: TransactionType
    snapshot_before: Optional[dict[str, Any]] = None
    snapshot_after: Optional[dict[str, Any]] = None
    notes: Optional[str] = None


class Transaction(BaseModel):
    """Complete transaction model (audit log)"""
    id: int
    device_id: int
    user_id: int
    transaction_type: TransactionType
    snapshot_before: Optional[dict[str, Any]] = None
    snapshot_after: Optional[dict[str, Any]] = None
    notes: Optional[str] = None
    created_at: datetime
    
    # Related entities
    device: Optional[Device] = None
    user: Optional[User] = None
    
    model_config = ConfigDict(from_attributes=True)


# ============================================================================
# Password Reset Models
# ============================================================================

class PasswordResetRequest(BaseModel):
    """Model for requesting a password reset"""
    email: str = Field(..., max_length=100)


class PasswordResetToken(BaseModel):
    """Model for password reset token (internal)"""
    id: int
    user_id: int
    token: str
    expires_at: datetime
    used: bool
    created_at: datetime
    
    model_config = ConfigDict(from_attributes=True)


class PasswordResetConfirm(BaseModel):
    """Model for confirming password reset with token"""
    token: str
    new_password: str = Field(..., min_length=6)


# ============================================================================
# Statistics & Dashboard Models
# ============================================================================

class DeviceStats(BaseModel):
    """Statistics for devices"""
    total: int
    available: int
    borrowed: int
    reserved: int
    overdue: int
    missing: int


class LocationStats(BaseModel):
    """Device statistics by location"""
    location_id: int
    location_name: str
    total_devices: int
    borrowed_devices: int
    available_devices: int


# ============================================================================
# Authentication Models
# ============================================================================

class LoginRequest(BaseModel):
    """Model for login request"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Model for login response"""
    user: User
    session_id: str


class SessionInfo(BaseModel):
    """Model for session information"""
    user: User
    session_id: str
    expires_at: datetime
