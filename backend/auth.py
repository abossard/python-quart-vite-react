"""
Authentication and Authorization module for Grabit.
Handles login, session management, password hashing, and role-based access control.
"""

import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from functools import wraps

from quart import session, request, jsonify
from models import User, UserRole, UserWithPassword, LoginRequest, LoginResponse, SessionInfo


# ============================================================================
# Password Hashing
# ============================================================================

def hash_password(password: str) -> str:
    """
    Hash password using SHA-256.
    
    Args:
        password: Plain text password
        
    Returns:
        Hashed password as hex string
    """
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    """
    Verify password against hash.
    
    Args:
        password: Plain text password
        password_hash: Stored password hash
        
    Returns:
        True if password matches
    """
    return hash_password(password) == password_hash


# ============================================================================
# Session Management
# ============================================================================

# In-memory session store (replace with Redis in production)
_sessions: dict[str, dict] = {}


def create_session(user: User, expires_in_hours: int = 24) -> str:
    """
    Create new session for user.
    
    Args:
        user: User object
        expires_in_hours: Session expiration time
        
    Returns:
        Session ID
    """
    session_id = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(hours=expires_in_hours)
    
    _sessions[session_id] = {
        'user_id': user.id,
        'username': user.username,
        'role': user.role.value,
        'expires_at': expires_at,
        'user': user.model_dump(mode='json')
    }
    
    return session_id


def get_session(session_id: str) -> Optional[dict]:
    """
    Retrieve session data.
    
    Args:
        session_id: Session ID
        
    Returns:
        Session data or None if not found/expired
    """
    if session_id not in _sessions:
        return None
    
    session_data = _sessions[session_id]
    
    # Check expiration
    if datetime.now() > session_data['expires_at']:
        del _sessions[session_id]
        return None
    
    return session_data


def destroy_session(session_id: str) -> bool:
    """
    Destroy session.
    
    Args:
        session_id: Session ID
        
    Returns:
        True if session was found and destroyed
    """
    if session_id in _sessions:
        del _sessions[session_id]
        return True
    return False


def refresh_session(session_id: str, hours: int = 24) -> bool:
    """
    Extend session expiration.
    
    Args:
        session_id: Session ID
        hours: Hours to extend
        
    Returns:
        True if session was refreshed
    """
    if session_id in _sessions:
        _sessions[session_id]['expires_at'] = datetime.now() + timedelta(hours=hours)
        return True
    return False


# ============================================================================
# Role-Based Access Control
# ============================================================================

# Role hierarchy: servicedesk < user < editor < redakteur < admin
ROLE_HIERARCHY = {
    UserRole.SERVICEDESK: 1,
    UserRole.USER: 2,
    UserRole.EDITOR: 3,
    UserRole.REDAKTEUR: 4,
    UserRole.ADMIN: 5,
}


def has_role(user_role: UserRole, required_role: UserRole) -> bool:
    """
    Check if user has required role or higher.
    
    Args:
        user_role: User's current role
        required_role: Required minimum role
        
    Returns:
        True if user has sufficient permissions
    """
    return ROLE_HIERARCHY.get(user_role, 0) >= ROLE_HIERARCHY.get(required_role, 0)


def get_current_user() -> Optional[User]:
    """
    Get current authenticated user from request context.
    
    Returns:
        User object or None if not authenticated
    """
    # Check session cookie
    session_id = request.cookies.get('session_id')
    if not session_id:
        return None
    
    session_data = get_session(session_id)
    if not session_data:
        return None
    
    # Reconstruct User from session data
    user_data = session_data['user']
    return User(**user_data)


# ============================================================================
# Authentication Decorators
# ============================================================================

def require_auth(f):
    """
    Decorator to require authentication.
    Returns 401 if not authenticated.
    """
    @wraps(f)
    async def decorated_function(*args, **kwargs):
        user = get_current_user()
        if not user:
            return jsonify({'error': 'Authentication required'}), 401
        return await f(*args, **kwargs)
    return decorated_function


def require_role(required_role: UserRole):
    """
    Decorator to require specific role or higher.
    Returns 403 if insufficient permissions.
    
    Args:
        required_role: Minimum required role
    """
    def decorator(f):
        @wraps(f)
        async def decorated_function(*args, **kwargs):
            user = get_current_user()
            if not user:
                return jsonify({'error': 'Authentication required'}), 401
            
            if not has_role(user.role, required_role):
                return jsonify({'error': 'Insufficient permissions'}), 403
            
            return await f(*args, **kwargs)
        return decorated_function
    return decorator


# Convenience decorators for specific roles
require_servicedesk = require_role(UserRole.SERVICEDESK)
require_user = require_role(UserRole.USER)
require_editor = require_role(UserRole.EDITOR)
require_redakteur = require_role(UserRole.REDAKTEUR)
require_admin = require_role(UserRole.ADMIN)


# ============================================================================
# Helper Functions
# ============================================================================

async def authenticate_user(username: str, password: str, db_conn) -> Optional[User]:
    """
    Authenticate user with username and password.
    
    Args:
        username: Username
        password: Plain text password
        db_conn: Database connection
        
    Returns:
        User object if authentication successful, None otherwise
    """
    # Query user from database
    cursor = await db_conn.cursor()
    await cursor.execute(
        """
        SELECT u.id, u.username, u.password_hash, u.role, u.location_id, 
               u.department_id, u.amt_id, u.created_at,
               l.id as loc_id, l.name as loc_name, l.address as loc_address,
               d.id as dept_id, d.name as dept_name, d.full_name as dept_full_name,
               a.id as amt_id_join, a.name as amt_name
        FROM users u
        LEFT JOIN locations l ON u.location_id = l.id
        LEFT JOIN departments d ON u.department_id = d.id
        LEFT JOIN amt a ON u.amt_id = a.id
        WHERE u.username = ?
        """,
        (username,)
    )
    
    row = await cursor.fetchone()
    await cursor.close()
    
    if not row:
        return None
    
    # Verify password
    password_hash = row[2]
    if not verify_password(password, password_hash):
        return None
    
    # Build User object
    from models import Location, Department, Amt
    
    user_data = {
        'id': row[0],
        'username': row[1],
        'role': UserRole(row[3]),
        'location_id': row[4],
        'department_id': row[5],
        'amt_id': row[6],
        'created_at': datetime.fromisoformat(row[7]) if row[7] else datetime.now(),
    }
    
    # Add related entities if available
    # Updated indices: loc (8,9,10), dept (11,12,13), amt (14,15)
    if row[8]:  # location
        user_data['location'] = Location(id=row[8], name=row[9], address=row[10])
    if row[11]:  # department
        user_data['department'] = Department(id=row[11], name=row[12], full_name=row[13])
    if row[14]:  # amt
        user_data['amt'] = Amt(id=row[14], name=row[15], department_id=row[5] or 1)
    
    return User(**user_data)


def get_session_info(session_id: str) -> Optional[SessionInfo]:
    """
    Get session information.
    
    Args:
        session_id: Session ID
        
    Returns:
        SessionInfo object or None
    """
    session_data = get_session(session_id)
    if not session_data:
        return None
    
    return SessionInfo(
        user=User(**session_data['user']),
        session_id=session_id,
        expires_at=session_data['expires_at']
    )
