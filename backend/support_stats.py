"""
IT Support Dashboard - Data Models and Service

Pydantic models and service layer for generating realistic mock IT support statistics.
All data is randomly generated on-the-fly with no persistence.

Architecture:
- Pydantic models for type safety and validation
- SupportService class with random data generators
- Realistic patterns (peak hours, variance, correlations)
"""

import random
from datetime import datetime, timedelta
from enum import Enum
from typing import Literal

from pydantic import BaseModel, Field


# ============================================================================
# ENUMS
# ============================================================================

class TechnicianStatus(str, Enum):
    """Technician availability status"""
    ONLINE = "online"
    AWAY = "away"
    OFFLINE = "offline"


class CategoryName(str, Enum):
    """Ticket category types"""
    HARDWARE = "Hardware"
    SOFTWARE = "Software"
    NETWORK = "Network"
    SECURITY = "Security"
    OTHER = "Other"


# ============================================================================
# PYDANTIC MODELS
# ============================================================================

class TicketStats(BaseModel):
    """Overall ticket statistics for various time periods"""
    total_24h: int = Field(..., description="Total tickets in last 24 hours")
    total_7d: int = Field(..., description="Total tickets in last 7 days")
    total_30d: int = Field(..., description="Total tickets in last 30 days")
    open: int = Field(..., description="Currently open tickets")
    in_progress: int = Field(..., description="Tickets being worked on")
    resolved_24h: int = Field(..., description="Tickets resolved in last 24 hours")
    avg_resolution_time_minutes: int = Field(..., description="Average resolution time in minutes")
    avg_first_response_minutes: int = Field(..., description="Average first response time in minutes")
    satisfaction_score: float = Field(..., ge=0, le=5, description="Customer satisfaction score (0-5)")
    uptime_percent: float = Field(..., ge=0, le=100, description="System uptime percentage")


class Category(BaseModel):
    """Single category with ticket count and metadata"""
    name: str = Field(..., description="Category name")
    count: int = Field(..., ge=0, description="Number of tickets")
    percentage: float = Field(..., ge=0, le=100, description="Percentage of total tickets")
    color: str = Field(..., description="Hex color code for UI")


class CategoryBreakdown(BaseModel):
    """Breakdown of tickets by category"""
    categories: list[Category] = Field(..., description="List of categories with counts")
    total: int = Field(..., ge=0, description="Total number of tickets across all categories")


class SeverityLevel(BaseModel):
    """Ticket severity level with count"""
    level: str = Field(..., description="Severity level name")
    count: int = Field(..., ge=0, description="Number of tickets")
    percentage: float = Field(..., ge=0, le=100, description="Percentage of total tickets")
    color: str = Field(..., description="Hex color code for UI")


class SeverityMetrics(BaseModel):
    """Breakdown of tickets by severity"""
    levels: list[SeverityLevel] = Field(..., description="List of severity levels with counts")
    total: int = Field(..., ge=0, description="Total number of tickets")


class TechnicianPerformance(BaseModel):
    """Individual technician performance metrics"""
    name: str = Field(..., description="Technician name")
    resolved_24h: int = Field(..., ge=0, description="Tickets resolved in last 24 hours")
    avg_time_minutes: int = Field(..., ge=0, description="Average resolution time in minutes")
    rating: float = Field(..., ge=0, le=5, description="Customer rating (0-5)")
    status: TechnicianStatus = Field(..., description="Current availability status")


class TimeSeriesPoint(BaseModel):
    """Single data point in time series"""
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    created: int = Field(..., ge=0, description="Tickets created")
    resolved: int = Field(..., ge=0, description="Tickets resolved")
    escalated: int = Field(..., ge=0, description="Tickets escalated")


class TimeSeriesData(BaseModel):
    """Time series data for ticket trends"""
    period: Literal["24h", "7d", "30d"] = Field(..., description="Time period")
    interval: str = Field(..., description="Data interval (hourly, daily)")
    data: list[TimeSeriesPoint] = Field(..., description="Time series data points")


class SystemHealth(BaseModel):
    """Real-time system health metrics"""
    uptime: float = Field(..., ge=0, le=100, description="System uptime percentage")
    avg_response_time_ms: int = Field(..., ge=0, description="Average response time in milliseconds")
    active_connections: int = Field(..., ge=0, description="Number of active connections")
    queue_depth: int = Field(..., ge=0, description="Number of tickets in queue")
    error_rate: float = Field(..., ge=0, le=100, description="Error rate percentage")


# ============================================================================
# SERVICE LAYER
# ============================================================================

class SupportService:
    """
    Service for generating realistic mock IT support data.
    
    All data is randomly generated with realistic constraints:
    - Business hours patterns (peak 9-11 AM, 2-4 PM)
    - Weekend dips (~40% less activity)
    - Realistic variance (±15%)
    - Correlated metrics (resolved lags created by ~10-20%)
    """
    
    # Technician pool
    TECHNICIAN_NAMES = [
        "Sarah Chen",
        "Mike Rodriguez",
        "Emily Watson",
        "James Kim",
        "Lisa Patel",
        "Tom Anderson",
        "Nina Williams",
        "Alex Kumar"
    ]
    
    # Category configuration with target percentages and colors
    CATEGORY_CONFIG = {
        CategoryName.HARDWARE: {"target_pct": 0.35, "variance": 0.03, "color": "#0078d4"},
        CategoryName.SOFTWARE: {"target_pct": 0.30, "variance": 0.03, "color": "#8764b8"},
        CategoryName.NETWORK: {"target_pct": 0.20, "variance": 0.02, "color": "#107c10"},
        CategoryName.SECURITY: {"target_pct": 0.10, "variance": 0.02, "color": "#d13438"},
        CategoryName.OTHER: {"target_pct": 0.05, "variance": 0.01, "color": "#605e5c"},
    }
    
    # Severity configuration
    SEVERITY_CONFIG = {
        "Critical": {"target_pct": 0.03, "variance": 0.01, "color": "#d13438"},
        "High": {"target_pct": 0.185, "variance": 0.035, "color": "#f7630c"},
        "Medium": {"target_pct": 0.485, "variance": 0.035, "color": "#fde300"},
        "Low": {"target_pct": 0.30, "variance": 0.035, "color": "#107c10"},
    }
    
    def get_ticket_stats(self) -> TicketStats:
        """Generate random ticket statistics with realistic constraints"""
        return TicketStats(
            total_24h=random.randint(140, 180),
            total_7d=random.randint(850, 950),
            total_30d=random.randint(4000, 4500),
            open=random.randint(35, 55),
            in_progress=random.randint(18, 28),
            resolved_24h=random.randint(95, 125),
            avg_resolution_time_minutes=random.randint(210, 330),
            avg_first_response_minutes=random.randint(8, 18),
            satisfaction_score=round(random.uniform(3.8, 4.5), 1),
            uptime_percent=round(random.uniform(99.85, 99.99), 2)
        )
    
    def get_category_breakdown(self) -> CategoryBreakdown:
        """Generate random category breakdown with realistic distribution"""
        # Generate random total tickets
        total = random.randint(1400, 1600)
        
        categories = []
        remaining = total
        
        # Generate counts for each category
        for category_name, config in self.CATEGORY_CONFIG.items():
            # Last category gets the remainder to ensure exact total
            if category_name == CategoryName.OTHER:
                count = remaining
            else:
                # Apply variance to target percentage
                target_pct = config["target_pct"]
                variance = config["variance"]
                actual_pct = random.uniform(target_pct - variance, target_pct + variance)
                count = int(total * actual_pct)
                remaining -= count
            
            percentage = round((count / total) * 100, 1)
            
            categories.append(Category(
                name=category_name.value,
                count=count,
                percentage=percentage,
                color=config["color"]
            ))
        
        return CategoryBreakdown(categories=categories, total=total)
    
    def get_severity_metrics(self) -> SeverityMetrics:
        """Generate random severity metrics with realistic distribution"""
        # Generate random total
        total = random.randint(400, 500)
        
        levels = []
        remaining = total
        
        for severity_name, config in self.SEVERITY_CONFIG.items():
            # Last severity gets the remainder
            if severity_name == "Low":
                count = remaining
            else:
                target_pct = config["target_pct"]
                variance = config["variance"]
                actual_pct = random.uniform(target_pct - variance, target_pct + variance)
                count = int(total * actual_pct)
                remaining -= count
            
            percentage = round((count / total) * 100, 1)
            
            levels.append(SeverityLevel(
                level=severity_name,
                count=count,
                percentage=percentage,
                color=config["color"]
            ))
        
        return SeverityMetrics(levels=levels, total=total)
    
    def get_technician_performance(self) -> list[TechnicianPerformance]:
        """Generate random technician performance data"""
        technicians = []
        
        for name in self.TECHNICIAN_NAMES:
            # Randomly assign status with realistic distribution
            status_roll = random.random()
            if status_roll < 0.60:
                status = TechnicianStatus.ONLINE
            elif status_roll < 0.85:
                status = TechnicianStatus.AWAY
            else:
                status = TechnicianStatus.OFFLINE
            
            technicians.append(TechnicianPerformance(
                name=name,
                resolved_24h=random.randint(10, 22),
                avg_time_minutes=random.randint(200, 350),
                rating=round(random.uniform(4.0, 5.0), 1),
                status=status
            ))
        
        return technicians
    
    def get_time_series_data(self, period: Literal["24h", "7d", "30d"]) -> TimeSeriesData:
        """
        Generate realistic time series data with patterns.
        
        Patterns:
        - Peak hours: 9-11 AM, 2-4 PM (1.5-2.0x multiplier)
        - Low activity: 12-6 AM (0.3-0.5x multiplier)
        - Weekend dip: ~40% less tickets
        - Random variance: ±15%
        - Occasional spikes: 5% chance of 2-3x spike
        """
        if period == "24h":
            interval = "hourly"
            data_points = self._generate_hourly_data()
        elif period == "7d":
            interval = "daily"
            data_points = self._generate_weekly_data()
        else:  # 30d
            interval = "daily"
            data_points = self._generate_monthly_data()
        
        return TimeSeriesData(
            period=period,
            interval=interval,
            data=data_points
        )
    
    def get_system_health(self) -> SystemHealth:
        """Generate random system health metrics with realistic bounds"""
        # 10% chance of spike in various metrics
        has_spike = random.random() < 0.10
        
        if has_spike:
            response_time = random.randint(250, 400)
            queue_depth = random.randint(20, 35)
            error_rate = round(random.uniform(0.8, 1.5), 2)
        else:
            response_time = random.randint(120, 180)
            queue_depth = random.randint(5, 12)
            error_rate = round(random.uniform(0.05, 0.20), 2)
        
        return SystemHealth(
            uptime=round(random.uniform(99.85, 99.99), 2),
            avg_response_time_ms=response_time,
            active_connections=random.randint(200, 280),
            queue_depth=queue_depth,
            error_rate=error_rate
        )
    
    # ========================================================================
    # PRIVATE HELPER METHODS
    # ========================================================================
    
    def _generate_hourly_data(self) -> list[TimeSeriesPoint]:
        """Generate 24 hours of data with realistic hourly patterns"""
        # Base pattern for 24 hours (midnight to 11 PM)
        base_pattern = [
            3, 3, 2, 2, 2, 1, 2, 4,     # Midnight-7AM (low activity)
            8, 12, 14, 12,               # 8AM-11AM (morning peak)
            10, 9, 11, 13,               # Noon-3PM (afternoon activity)
            12, 10, 8, 6,                # 4PM-7PM (end of day)
            5, 4, 4, 3                   # 8PM-11PM (evening decline)
        ]
        
        now = datetime.now()
        data_points = []
        
        for hour in range(24):
            timestamp = (now - timedelta(hours=23-hour)).replace(minute=0, second=0, microsecond=0)
            base_value = base_pattern[hour]
            
            # Add variance and occasional spikes
            created = self._apply_variance(base_value)
            resolved = int(created * random.uniform(0.70, 0.95))
            escalated = int(created * random.uniform(0.02, 0.08))
            
            data_points.append(TimeSeriesPoint(
                timestamp=timestamp.isoformat(),
                created=created,
                resolved=resolved,
                escalated=escalated
            ))
        
        return data_points
    
    def _generate_weekly_data(self) -> list[TimeSeriesPoint]:
        """Generate 7 days of data with weekend dip"""
        # Mon, Tue, Wed, Thu, Fri, Sat, Sun
        base_pattern = [140, 155, 148, 162, 158, 95, 82]
        
        now = datetime.now()
        data_points = []
        
        for day in range(7):
            timestamp = (now - timedelta(days=6-day)).replace(hour=0, minute=0, second=0, microsecond=0)
            base_value = base_pattern[day]
            
            created = self._apply_variance(base_value)
            resolved = int(created * random.uniform(0.75, 0.90))
            escalated = int(created * random.uniform(0.03, 0.07))
            
            data_points.append(TimeSeriesPoint(
                timestamp=timestamp.isoformat(),
                created=created,
                resolved=resolved,
                escalated=escalated
            ))
        
        return data_points
    
    def _generate_monthly_data(self) -> list[TimeSeriesPoint]:
        """Generate 30 days of data with realistic daily variance"""
        now = datetime.now()
        data_points = []
        
        for day in range(30):
            timestamp = (now - timedelta(days=29-day)).replace(hour=0, minute=0, second=0, microsecond=0)
            
            # Weekends have lower activity
            is_weekend = timestamp.weekday() >= 5  # Saturday=5, Sunday=6
            base_value = random.randint(85, 105) if is_weekend else random.randint(130, 170)
            
            created = self._apply_variance(base_value)
            resolved = int(created * random.uniform(0.75, 0.90))
            escalated = int(created * random.uniform(0.03, 0.07))
            
            data_points.append(TimeSeriesPoint(
                timestamp=timestamp.isoformat(),
                created=created,
                resolved=resolved,
                escalated=escalated
            ))
        
        return data_points
    
    def _apply_variance(self, base_value: int) -> int:
        """
        Apply realistic variance to base value.
        
        - Normal variance: ±15%
        - 5% chance of spike: 2-3x multiplier
        """
        # Check for spike
        if random.random() < 0.05:
            multiplier = random.uniform(2.0, 3.0)
            return int(base_value * multiplier)
        
        # Normal variance
        return int(base_value * random.uniform(0.85, 1.15))
