"""
Ticket search service using real ticket data from CSV file.
Follows the unified REST/MCP architecture pattern.
"""

from typing import Optional, List, Dict
from pydantic import BaseModel, Field
import csv
import os


# Pydantic Models
class Ticket(BaseModel):
    """Ticket model representing a support ticket."""
    id: str = Field(..., description="Ticket identifier")
    assignee: Optional[str] = Field(default=None, description="Assigned person")
    summary: str = Field(..., description="Brief summary")
    description: str = Field(..., description="Detailed description")
    resolution: Optional[str] = Field(default=None, description="Resolution text")
    status: str = Field(..., description="Ticket status")
    priority: Optional[str] = Field(default=None, description="Priority level")
    service: Optional[str] = Field(default=None, description="Service type")
    city: Optional[str] = Field(default=None, description="City")
    created_at: Optional[str] = Field(default=None, description="Creation timestamp")
    updated_at: Optional[str] = Field(default=None, description="Update timestamp")


class KBAArticle(BaseModel):
    """Knowledge Base Article generated from a ticket."""
    title: str = Field(..., description="KBA article title")
    question: str = Field(..., description="The problem/question being addressed")
    answer: str = Field(..., description="The solution/answer to the problem")
    ticket_id: str = Field(..., description="Source ticket ID")


class TicketService:
    """Sevice for searching tickets from CSV data.Test"""
    
    def __init__(self):
        self._tickets: Dict[str, Ticket] = {}
        self._load_tickets()
    
    def _load_tickets(self):
        """Load tickets from CSV file into memory."""
        # Get path to CSV file (relative to this file)
        csv_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "csv", "data.csv")
        
        if not os.path.exists(csv_path):
            print(f"Warning: Ticket CSV file not found at {csv_path}")
            return
        
        try:
            with open(csv_path, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    # Extract relevant fields from CSV
                    # Use Entry ID (the INC number) as the primary identifier
                    ticket_id = row.get("Entry ID", "").strip()
                    if not ticket_id:
                        continue
                    
                    ticket = Ticket(
                        id=ticket_id,
                        assignee=row.get("Assignee+", "").strip() or None,
                        summary=row.get("Summary*", "").strip(),
                        description=row.get("Notes", "").strip() or row.get("Additional Information", "").strip(),
                        resolution=row.get("Resolution", "").strip() or None,
                        status=row.get("Status*", "").strip(),
                        priority=row.get("Priority*", "").strip() or None,
                        service=row.get("Service*+", "").strip() or None,
                        city=row.get("City", "").strip() or None,
                        created_at=row.get("Submit Date", "").strip() or None,
                        updated_at=row.get("Last Modified Date", "").strip() or None
                    )
                    
                    self._tickets[ticket_id] = ticket
            
            print(f"Loaded {len(self._tickets)} tickets from CSV")
        
        except Exception as e:
            print(f"Error loading tickets from CSV: {e}")
    
    async def search_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """
        Search for a ticket by ticket ID or partial ID.
        
        Args:
            ticket_id: The ticket ID to search for (full or partial string)
            
        Returns:
            Ticket object if found, None otherwise
        """
        if not ticket_id or not ticket_id.strip():
            return None
        
        search_term = ticket_id.strip().upper()
        
        # Try exact match first
        if search_term in self._tickets:
            return self._tickets[search_term]
        
        # Try partial match
        for ticket_id_key, ticket in self._tickets.items():
            if search_term in ticket_id_key:
                return ticket
        
        # Try case-insensitive search in summary and description
        for ticket in self._tickets.values():
            if (search_term.lower() in ticket.summary.lower() or 
                search_term.lower() in ticket.description.lower()):
                return ticket
        
        return None
