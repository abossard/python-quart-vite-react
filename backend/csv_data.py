"""
CSV Ticket Data Source

Provides an alternative ticket source by reading from CSV files
exported from BMC Remedy / ITSM systems.

Maps CSV columns to the Ticket Pydantic model for unified handling.

Following "Grokking Simplicity":
- Data: CSVTicketRow (raw CSV structure)
- Calculations: csv_row_to_ticket (pure transformation)
- Actions: load_tickets_from_csv (I/O)
"""

import csv
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import NAMESPACE_DNS, UUID, uuid5

from pydantic import BaseModel, Field
from tickets import Ticket, TicketPriority, TicketStatus, TicketWithDetails

# ============================================================================
# CSV COLUMN MAPPING - Maps CSV headers to normalized field names
# ============================================================================

CSV_COLUMN_MAP = {
    # Core identifiers
    "Entry ID": "entry_id",
    "Incident ID*+": "incident_id",
    
    # Summary and description
    "Summary*": "summary",
    "Notes": "notes",
    "Resolution": "resolution",
    
    # Status and priority
    "Status*": "status",
    "Status-PPL": "status_ppl",
    "Priority*": "priority",
    "Urgency*": "urgency",
    "Impact*": "impact",
    
    # Assignment
    "Assignee+": "assignee",
    "Assigned Group*+": "assigned_group",
    "Support Organization": "support_organization",
    "Owner Group+": "owner_group",
    
    # Requester info
    "Full Name": "full_name",
    "First Name+": "first_name",
    "Last Name+": "last_name",
    "Internet E-mail": "email",
    "Customer Phone*+": "phone",
    "Company": "company",
    "Company*+": "company_alt",
    "Organization": "department",
    
    # Location
    "City": "city",
    "Country": "country",
    "Site ID": "site_id",
    "Desk Location": "desk_location",
    "Street": "street",
    "Zip/Postal Code": "zip_code",
    
    # Service and product info
    "Service*+": "service",
    "Incident Type*": "incident_type",
    "Reported Source": "reported_source",
    
    # Product details
    "Product Name+": "product_name",
    "Manufacturer": "manufacturer",
    "Model/Version": "model_version",
    "CI Name": "ci_name",
    "CI+": "ci",
    
    # Categories
    "Operational Categorization Tier 1+": "op_cat_tier1",
    "Operational Categorization Tier 2": "op_cat_tier2",
    "Operational Categorization Tier 3": "op_cat_tier3",
    "Product Categorization Tier 1": "prod_cat_tier1",
    "Product Categorization Tier 2": "prod_cat_tier2",
    "Product Categorization Tier 3": "prod_cat_tier3",
    
    # Timestamps
    "Reported Date+": "reported_date",
    "Reported Date": "reported_date_alt",
    "Last Modified Date": "last_modified_date",
    "Responded Date+": "responded_date",
    "Last Resolved Date": "resolved_date",
    "Closed Date": "closed_date",
    
    # Additional fields
    "Corporate ID": "corporate_id",
    "Event ID": "event_id",
}


# ============================================================================
# RAW CSV ROW MODEL - Matches CSV structure exactly
# ============================================================================

class CSVTicketRow(BaseModel):
    """
    Raw ticket data as read from CSV.
    
    Field names match normalized CSV columns after mapping.
    All fields optional since CSV may have missing data.
    """
    # Core identifiers
    entry_id: Optional[str] = Field(None, description="BMC Entry ID (GUID)")
    incident_id: Optional[str] = Field(None, description="Incident number (INC...)")
    
    # Summary and description
    summary: Optional[str] = Field(None, description="Short issue summary")
    notes: Optional[str] = Field(None, description="Additional notes")
    resolution: Optional[str] = Field(None, description="Resolution details")
    
    # Status and priority
    status: Optional[str] = Field(None, description="Current status")
    status_ppl: Optional[str] = Field(None, description="Status from PPL field")
    priority: Optional[str] = Field(None, description="Priority level")
    urgency: Optional[str] = Field(None, description="Urgency level")
    impact: Optional[str] = Field(None, description="Impact level")
    
    # Assignment
    assignee: Optional[str] = Field(None, description="Assigned individual")
    assigned_group: Optional[str] = Field(None, description="Assigned support group")
    support_organization: Optional[str] = Field(None, description="Support org")
    owner_group: Optional[str] = Field(None, description="Owner group")
    
    # Requester info
    full_name: Optional[str] = Field(None, description="Full requester name")
    first_name: Optional[str] = Field(None, description="First name")
    last_name: Optional[str] = Field(None, description="Last name")
    email: Optional[str] = Field(None, description="Email address")
    phone: Optional[str] = Field(None, description="Phone number")
    company: Optional[str] = Field(None, description="Company name")
    company_alt: Optional[str] = Field(None, description="Alt company field")
    department: Optional[str] = Field(None, description="Department/Organization")
    
    # Location
    city: Optional[str] = Field(None, description="City")
    country: Optional[str] = Field(None, description="Country")
    site_id: Optional[str] = Field(None, description="Site ID")
    desk_location: Optional[str] = Field(None, description="Desk location")
    street: Optional[str] = Field(None, description="Street address")
    zip_code: Optional[str] = Field(None, description="Zip/Postal code")
    
    # Service and product info
    service: Optional[str] = Field(None, description="Affected service")
    incident_type: Optional[str] = Field(None, description="Incident type")
    reported_source: Optional[str] = Field(None, description="How reported")
    
    # Product details
    product_name: Optional[str] = Field(None, description="Product name")
    manufacturer: Optional[str] = Field(None, description="Manufacturer")
    model_version: Optional[str] = Field(None, description="Model/version")
    ci_name: Optional[str] = Field(None, description="CI name")
    ci: Optional[str] = Field(None, description="CI identifier")
    
    # Categories
    op_cat_tier1: Optional[str] = Field(None, description="Op category tier 1")
    op_cat_tier2: Optional[str] = Field(None, description="Op category tier 2")
    op_cat_tier3: Optional[str] = Field(None, description="Op category tier 3")
    prod_cat_tier1: Optional[str] = Field(None, description="Product category tier 1")
    prod_cat_tier2: Optional[str] = Field(None, description="Product category tier 2")
    prod_cat_tier3: Optional[str] = Field(None, description="Product category tier 3")
    
    # Timestamps (as strings from CSV)
    reported_date: Optional[str] = Field(None, description="Reported date string")
    reported_date_alt: Optional[str] = Field(None, description="Alt reported date")
    last_modified_date: Optional[str] = Field(None, description="Last modified")
    responded_date: Optional[str] = Field(None, description="Responded date")
    resolved_date: Optional[str] = Field(None, description="Resolved date")
    closed_date: Optional[str] = Field(None, description="Closed date")
    
    # Additional
    corporate_id: Optional[str] = Field(None, description="Corporate ID")
    event_id: Optional[str] = Field(None, description="Event ID")

    model_config = {"extra": "ignore"}  # Ignore unmapped CSV columns


# ============================================================================
# CALCULATIONS - Pure transformations
# ============================================================================

def parse_csv_datetime(date_str: Optional[str]) -> Optional[datetime]:
    """Parse datetime from CSV format (DD.MM.YYYY HH:MM:SS)."""
    if not date_str or date_str.strip() == "":
        return None
    
    # Try common formats
    formats = [
        "%d.%m.%Y %H:%M:%S",  # 22.10.2025 11:53:33
        "%d.%m.%Y",           # 22.10.2025
        "%Y-%m-%d %H:%M:%S",  # ISO format
        "%Y-%m-%d",           # ISO date only
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    
    return None


def map_status(status_str: Optional[str]) -> TicketStatus:
    """Map CSV status string to TicketStatus enum."""
    if not status_str:
        return TicketStatus.NEW
    
    status_lower = status_str.lower().strip()
    
    mapping = {
        "new": TicketStatus.NEW,
        "assigned": TicketStatus.ASSIGNED,
        "in progress": TicketStatus.IN_PROGRESS,
        "pending": TicketStatus.PENDING,
        "resolved": TicketStatus.RESOLVED,
        "closed": TicketStatus.CLOSED,
        "cancelled": TicketStatus.CANCELLED,
        "canceled": TicketStatus.CANCELLED,
        # Additional BMC Remedy mappings
        "client action required": TicketStatus.PENDING,
        "work in progress": TicketStatus.IN_PROGRESS,
        "awaiting": TicketStatus.PENDING,
    }
    
    for key, value in mapping.items():
        if key in status_lower:
            return value
    
    return TicketStatus.NEW


def map_priority(priority_str: Optional[str]) -> TicketPriority:
    """Map CSV priority string to TicketPriority enum."""
    if not priority_str:
        return TicketPriority.MEDIUM
    
    priority_lower = priority_str.lower().strip()
    
    if "critical" in priority_lower or "1-" in priority_lower:
        return TicketPriority.CRITICAL
    elif "high" in priority_lower or "2-" in priority_lower:
        return TicketPriority.HIGH
    elif "low" in priority_lower or "4-" in priority_lower:
        return TicketPriority.LOW
    else:
        return TicketPriority.MEDIUM


def generate_uuid_from_incident_id(incident_id: str) -> UUID:
    """Generate deterministic UUID from incident ID."""
    return uuid5(NAMESPACE_DNS, incident_id)


def csv_row_to_ticket(row: CSVTicketRow) -> Ticket:
    """
    Convert a CSV row to a Ticket model.
    
    Pure calculation - no side effects.
    """
    # Generate deterministic UUID from incident ID
    incident_id = row.incident_id or row.entry_id or "UNKNOWN"
    ticket_id = generate_uuid_from_incident_id(incident_id)
    
    # Build requester name
    requester_name = row.full_name
    if not requester_name and (row.first_name or row.last_name):
        parts = [row.first_name or "", row.last_name or ""]
        requester_name = " ".join(p for p in parts if p).strip()
    requester_name = requester_name or "Unknown"
    
    # Parse dates
    reported_dt = parse_csv_datetime(row.reported_date) or parse_csv_datetime(row.reported_date_alt)
    modified_dt = parse_csv_datetime(row.last_modified_date)
    now = datetime.now()
    
    created_at = reported_dt or now
    updated_at = modified_dt or created_at
    
    return Ticket(
        id=ticket_id,
        incident_id=row.incident_id or row.entry_id or None,
        summary=row.summary or "No summary",
        description=row.notes or row.summary or "No description",
        status=map_status(row.status or row.status_ppl),
        priority=map_priority(row.priority),
        impact=row.impact,
        urgency=row.urgency,
        assignee=row.assignee if row.assignee and row.assignee.strip() else None,
        assigned_group=row.assigned_group,
        support_organization=row.support_organization,
        requester_name=requester_name,
        requester_email=row.email or "unknown@example.com",
        requester_phone=row.phone,
        requester_company=row.company or row.company_alt,
        requester_department=row.department,
        city=row.city,
        country=row.country,
        site=row.site_id,
        desk_location=row.desk_location,
        service=row.service,
        incident_type=row.incident_type,
        reported_source=row.reported_source,
        product_name=row.product_name,
        manufacturer=row.manufacturer,
        model_version=row.model_version,
        ci_name=row.ci_name or row.ci,
        operational_category_tier1=row.op_cat_tier1,
        operational_category_tier2=row.op_cat_tier2,
        operational_category_tier3=row.op_cat_tier3,
        product_category_tier1=row.prod_cat_tier1,
        product_category_tier2=row.prod_cat_tier2,
        product_category_tier3=row.prod_cat_tier3,
        resolution=row.resolution,
        notes=row.notes,
        event_id=row.event_id,
        correlation_key=None,
        created_at=created_at,
        updated_at=updated_at,
    )


def normalize_csv_headers(headers: list[str]) -> dict[str, str]:
    """
    Create mapping from actual CSV headers to normalized field names.
    
    Returns dict: original_header -> normalized_field_name
    """
    result = {}
    for header in headers:
        normalized = CSV_COLUMN_MAP.get(header)
        if normalized:
            result[header] = normalized
    return result


# ============================================================================
# ACTIONS - I/O operations
# ============================================================================

def load_tickets_from_csv(
    file_path: str | Path,
    encoding: str = "utf-8",
) -> list[Ticket]:
    """
    Load tickets from a CSV file.
    
    Args:
        file_path: Path to the CSV file
        encoding: File encoding (default: utf-8)
        
    Returns:
        List of Ticket models
    """
    file_path = Path(file_path)
    
    if not file_path.exists():
        raise FileNotFoundError(f"CSV file not found: {file_path}")
    
    tickets: list[Ticket] = []
    
    # Try different encodings if utf-8 fails
    encodings_to_try = [encoding, "latin-1", "cp1252", "iso-8859-1"]
    
    for enc in encodings_to_try:
        try:
            with open(file_path, "r", encoding=enc, newline="") as f:
                reader = csv.DictReader(f)
                
                for row_dict in reader:
                    # Map CSV columns to normalized names
                    normalized = {}
                    for csv_col, value in row_dict.items():
                        field_name = CSV_COLUMN_MAP.get(csv_col)
                        if field_name:
                            normalized[field_name] = value if value else None
                    
                    # Create CSVTicketRow and convert to Ticket
                    try:
                        csv_row = CSVTicketRow(**normalized)
                        ticket = csv_row_to_ticket(csv_row)
                        tickets.append(ticket)
                    except Exception as e:
                        # Log and skip malformed rows
                        print(f"Warning: Skipping row due to error: {e}")
                        continue
                
            break  # Success, exit encoding loop
            
        except UnicodeDecodeError:
            continue  # Try next encoding
    
    return tickets


def load_tickets_with_details_from_csv(
    file_path: str | Path,
    encoding: str = "utf-8",
) -> list[TicketWithDetails]:
    """
    Load tickets with empty work logs/modifications from CSV.
    
    CSV doesn't contain work log data, so those are empty.
    """
    tickets = load_tickets_from_csv(file_path, encoding)
    
    return [
        TicketWithDetails(
            **ticket.model_dump(),
            work_logs=[],
            modifications=[],
            overlay_metadata=None,
        )
        for ticket in tickets
    ]


# ============================================================================
# CSV TICKET SERVICE - Stateful service for CSV-based tickets
# ============================================================================

class CSVTicketService:
    """
    Ticket service backed by CSV file(s).
    
    Provides read-only access to tickets loaded from CSV.
    Thread-safe through immutable data pattern.
    """
    
    def __init__(self):
        self._tickets: dict[UUID, Ticket] = {}
        self._loaded_files: set[str] = set()
    
    def load_csv(self, file_path: str | Path) -> int:
        """
        Load tickets from CSV file.
        
        Returns number of tickets loaded.
        """
        file_path = Path(file_path)
        file_key = str(file_path.resolve())
        
        tickets = load_tickets_from_csv(file_path)
        
        for ticket in tickets:
            self._tickets[ticket.id] = ticket
        
        self._loaded_files.add(file_key)
        return len(tickets)
    
    def get_ticket(self, ticket_id: UUID) -> Optional[Ticket]:
        """Get ticket by ID."""
        return self._tickets.get(ticket_id)
    
    def list_tickets(
        self,
        status: Optional[TicketStatus] = None,
        assigned_group: Optional[str] = None,
        has_assignee: Optional[bool] = None,
    ) -> list[Ticket]:
        """
        List tickets with optional filtering.
        
        Args:
            status: Filter by status
            assigned_group: Filter by assigned group
            has_assignee: True = has assignee, False = no assignee
        """
        result = list(self._tickets.values())
        
        if status is not None:
            result = [t for t in result if t.status == status]
        
        if assigned_group is not None:
            result = [t for t in result if t.assigned_group == assigned_group]
        
        if has_assignee is not None:
            if has_assignee:
                result = [t for t in result if t.assignee is not None]
            else:
                result = [t for t in result if t.assignee is None]
        
        return result
    
    def get_unassigned_tickets(self) -> list[Ticket]:
        """Get tickets assigned to a group but without individual assignee."""
        return [
            t for t in self._tickets.values()
            if t.assigned_group is not None
            and t.assignee is None
            and t.status in (TicketStatus.NEW, TicketStatus.ASSIGNED, TicketStatus.IN_PROGRESS)
        ]
    
    @property
    def total_count(self) -> int:
        """Total number of loaded tickets."""
        return len(self._tickets)
    
    @property
    def loaded_files(self) -> set[str]:
        """Set of loaded file paths."""
        return self._loaded_files.copy()


# ============================================================================
# MODULE-LEVEL SINGLETON
# ============================================================================

_csv_service: Optional[CSVTicketService] = None


def get_csv_ticket_service() -> CSVTicketService:
    """Get or create the CSV ticket service singleton."""
    global _csv_service
    if _csv_service is None:
        _csv_service = CSVTicketService()
    return _csv_service


# ============================================================================
# EXPORTS
# ============================================================================

__all__ = [
    # Models
    "CSVTicketRow",
    # Calculations
    "parse_csv_datetime",
    "map_status",
    "map_priority",
    "generate_uuid_from_incident_id",
    "csv_row_to_ticket",
    "normalize_csv_headers",
    # Actions
    "load_tickets_from_csv",
    "load_tickets_with_details_from_csv",
    # Service
    "CSVTicketService",
    "get_csv_ticket_service",
    # Constants
    "CSV_COLUMN_MAP",
]
