"""Unified operation definitions for REST, MCP, and agents.

This module keeps all business operations in one place so every interface
(REST, MCP, LangGraph agents) relies on the same validated logic.
"""

from api_decorators import operation
from tasks import Task, TaskCreate, TaskFilter, TaskService, TaskStats, TaskUpdate

# Service instances shared across interfaces
_task_service = TaskService()


@operation(
    name="list_tasks",
    description="List all tasks with optional filtering by completion status",
    http_method="GET",
    http_path="/api/tasks",
)
async def op_list_tasks(filter: TaskFilter = TaskFilter.ALL) -> list[Task]:
    """List tasks with optional filtering."""
    return _task_service.list_tasks(filter)


@operation(
    name="create_task",
    description="Create a new task with validation",
    http_method="POST",
    http_path="/api/tasks",
)
async def op_create_task(data: TaskCreate) -> Task:
    """Create a new task with validation."""
    return _task_service.create_task(data)


@operation(
    name="get_task",
    description="Retrieve a specific task by its unique identifier",
    http_method="GET",
    http_path="/api/tasks/{task_id}",
)
async def op_get_task(task_id: str) -> Task | None:
    """Get a task by ID."""
    return _task_service.get_task(task_id)


@operation(
    name="update_task",
    description="Update an existing task's properties",
    http_method="PUT",
    http_path="/api/tasks/{task_id}",
)
async def op_update_task(task_id: str, data: TaskUpdate) -> Task | None:
    """Update a task by ID."""
    return _task_service.update_task(task_id, data)


@operation(
    name="delete_task",
    description="Delete a task permanently by its identifier",
    http_method="DELETE",
    http_path="/api/tasks/{task_id}",
)
async def op_delete_task(task_id: str) -> bool:
    """Delete a task by ID."""
    return _task_service.delete_task(task_id)


@operation(
    name="get_task_stats",
    description="Get summary statistics for all tasks",
    http_method="GET",
    http_path="/api/tasks/stats",
)
async def op_get_task_stats() -> TaskStats:
    """Get task statistics."""
    return _task_service.get_stats()


# ============================================================================
# BOOKING OPERATIONS
# TODO: Outlook-Integration - Diese Operationen dienen als Platzhalter für
# die spätere Anbindung an Microsoft Outlook/Exchange Calendar.
# Geplante Features:
# - Synchronisation mit Outlook-Kalender
# - Verfügbarkeits-Prüfung gegen Exchange
# - Automatische Outlook-Einladungen versenden
# - Konflikt-Erkennung mit bestehenden Terminen
# ============================================================================

from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone

class BookingCreate(BaseModel):
    """Model for creating a new booking"""
    booking_date: str = Field(description="Date of appointment (YYYY-MM-DD)")
    time_slot: str = Field(description="Time slot (HH:MM format)")
    booking_type: str = Field(description="Type: für mich or für jemand anders")
    name: str = Field(min_length=1, description="Last name")
    vorname: str = Field(min_length=1, description="First name")
    email: str = Field(description="Email address of the person being booked")
    hardware: str = Field(description="Hardware needed: Ja or Nein")
    user_email: str | None = Field(default=None, description="Booker's email (if booking for someone else)")

class Booking(BaseModel):
    """Model representing a booking"""
    id: str
    booking_date: str
    time_slot: str
    booking_type: str
    name: str
    vorname: str
    email: str
    hardware: str
    user_email: str | None
    created_at: str
    ics_content: str | None = None  # iCalendar content for download

class SlotAvailability(BaseModel):
    """Model for slot availability status"""
    date: str
    time_slot: str
    available: bool
    booking_id: str | None = None

# Temporary in-memory storage
_bookings_db: dict[str, Booking] = {}
_booking_counter = 0

def generate_ics_content(booking: Booking) -> str:
    """Generate iCalendar (.ics) file content for Outlook
    
    TODO OUTLOOK-INTEGRATION: Dies ist ein Platzhalter-Template
    Aktuell: Lokale .ics-Datei wird generiert
    Zukünftig: Direkte Outlook-Kalendererstellung über Microsoft Graph API
    - Nutze MS Graph Kalender-API statt .ics-Generierung
    - Automatischer Upload in Benutzer-Kalender
    - Meeting-Einladungen an Teilnehmer
    """
    from datetime import datetime, timedelta
    
    # Parse booking date and time
    booking_datetime = datetime.strptime(f"{booking.booking_date} {booking.time_slot}", "%Y-%m-%d %H:%M")
    end_datetime = booking_datetime + timedelta(minutes=20)
    
    # Format for iCalendar (UTC)
    dtstart = booking_datetime.strftime("%Y%m%dT%H%M%S")
    dtend = end_datetime.strftime("%Y%m%dT%H%M%S")
    dtstamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    
    # Generate ics content
    ics = f"""BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//BIT Store Zollikofen//Booking System//DE
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:{booking.id}@bit-store.ch
DTSTART:{dtstart}
DTEND:{dtend}
DTSTAMP:{dtstamp}
ORGANIZER:mailto:info@bit-store.ch
ATTENDEE;CN="{booking.vorname} {booking.name}";RSVP=TRUE:mailto:{booking.email}
SUMMARY:BIT-Store Termin - {booking.vorname} {booking.name}
DESCRIPTION:Termin im BIT-Store Zollikofen\\n\\nName: {booking.name}\\nVorname: {booking.vorname}\\nEmail: {booking.email}\\nHardware: {booking.hardware}\\nBuchungstyp: {booking.booking_type}
LOCATION:BIT-Store Zollikofen
STATUS:CONFIRMED
SEQUENCE:0
BEGIN:VALARM
TRIGGER:-PT15M
ACTION:DISPLAY
DESCRIPTION:Erinnerung: BIT-Store Termin in 15 Minuten
END:VALARM
END:VEVENT
END:VCALENDAR"""
    return ics

def is_slot_available(booking_date: str, time_slot: str) -> bool:
    """Check if a time slot is still available"""
    for booking in _bookings_db.values():
        if booking.booking_date == booking_date and booking.time_slot == time_slot:
            return False
    return True

@operation(
    name="create_booking",
    description="Create a new appointment booking",
    http_method="POST",
    http_path="/api/bookings",
)
async def op_create_booking(booking: BookingCreate) -> Booking:
    """Create a new booking"""
    global _booking_counter
    
    # Check if slot is still available
    if not is_slot_available(booking.booking_date, booking.time_slot):
        raise ValueError(f"Slot {booking.time_slot} am {booking.booking_date} ist bereits gebucht")
    
    _booking_counter += 1
    booking_id = f"booking-{_booking_counter}"
    
    new_booking = Booking(
        id=booking_id,
        booking_date=booking.booking_date,
        time_slot=booking.time_slot,
        booking_type=booking.booking_type,
        name=booking.name,
        vorname=booking.vorname,
        email=booking.email,
        hardware=booking.hardware,
        user_email=booking.user_email,
        created_at=datetime.now(timezone.utc).isoformat(),
        ics_content=None,  # Will be generated below
    )
    
    # Generate .ics content for Outlook
    new_booking.ics_content = generate_ics_content(new_booking)
    
    _bookings_db[booking_id] = new_booking
    return new_booking

@operation(
    name="list_bookings",
    description="List all bookings",
    http_method="GET",
    http_path="/api/bookings",
)
async def op_list_bookings() -> list[Booking]:
    """List all bookings"""
    return list(_bookings_db.values())

@operation(
    name="check_availability",
    description="Check slot availability for a specific date",
    http_method="GET",
    http_path="/api/bookings/availability/{booking_date}",
)
async def op_check_availability(booking_date: str) -> list[SlotAvailability]:
    """Check which slots are available for a given date"""
    # Generate all time slots (08:00 to 16:20)
    all_slots = []
    for hour in range(8, 17):
        for minute in range(0, 60, 20):
            if hour == 16 and minute > 20:
                break
            time_slot = f"{hour:02d}:{minute:02d}"
            available = is_slot_available(booking_date, time_slot)
            
            # Find booking if slot is taken
            booking_id = None
            if not available:
                for booking in _bookings_db.values():
                    if booking.booking_date == booking_date and booking.time_slot == time_slot:
                        booking_id = booking.id
                        break
            
            all_slots.append(SlotAvailability(
                date=booking_date,
                time_slot=time_slot,
                available=available,
                booking_id=booking_id
            ))
    
    return all_slots

# Export shared services for callers (REST app, CLI tools, etc.)
task_service = _task_service

__all__ = [
    "task_service",
    "op_list_tasks",
    "op_create_task",
    "op_get_task",
    "op_update_task",
    "op_delete_task",
    "op_get_task_stats",
    "op_create_booking",
    "op_list_bookings",
    "op_check_availability",
]
