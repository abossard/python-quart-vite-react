"""
Auto-Generation Settings Models

Pydantic models for automatic KBA draft generation configuration.
Uses SQLModel for persistence.
"""

from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlmodel import SQLModel, Field as SQLField


# ============================================================================
# SETTINGS MODELS
# ============================================================================

class AutoGenSettings(BaseModel):
    """Auto-generation configuration (READ operations)"""
    id: int = 1  # Singleton - always ID 1
    enabled: bool = Field(default=False, description="Enable/disable auto-generation")
    daily_limit: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Number of drafts to generate per day"
    )
    schedule_time: str = Field(
        default="12:00",
        pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$",
        description="Time of day to run (HH:MM, 24-hour format)"
    )
    last_run_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp of last successful run"
    )
    last_run_count: Optional[int] = Field(
        default=None,
        description="Number of drafts created in last run"
    )
    updated_at: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "enabled": True,
                "daily_limit": 5,
                "schedule_time": "12:00",
                "last_run_at": "2026-03-04T12:00:15Z",
                "last_run_count": 5,
                "updated_at": "2026-03-04T10:30:00Z"
            }
        }


class AutoGenSettingsUpdate(BaseModel):
    """DTO for updating settings (PATCH /api/kba/auto-gen/settings)"""
    enabled: Optional[bool] = None
    daily_limit: Optional[int] = Field(None, ge=1, le=50)
    schedule_time: Optional[str] = Field(
        None,
        pattern=r"^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
    )
    
    class Config:
        json_schema_extra = {
            "example": {
                "enabled": True,
                "daily_limit": 10
            }
        }


class AutoGenSettingsTable(SQLModel, table=True):
    """SQLModel table for auto-generation settings (singleton)"""
    __tablename__ = "auto_gen_settings"
    
    id: int = SQLField(default=1, primary_key=True)
    enabled: bool = SQLField(default=False)
    daily_limit: int = SQLField(default=5)
    schedule_time: str = SQLField(default="12:00")
    last_run_at: Optional[datetime] = None
    last_run_count: Optional[int] = None
    updated_at: datetime = SQLField(default_factory=datetime.now)


class AutoGenRunResult(BaseModel):
    """Result of an auto-generation run"""
    success: bool
    drafts_created: int
    drafts_failed: int
    tickets_processed: int
    errors: list[str] = Field(default_factory=list)
    run_time_seconds: float
    timestamp: datetime = Field(default_factory=datetime.now)
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "drafts_created": 5,
                "drafts_failed": 0,
                "tickets_processed": 5,
                "errors": [],
                "run_time_seconds": 25.3,
                "timestamp": "2026-03-04T12:00:25Z"
            }
        }
