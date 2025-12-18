"""
Ticket search service for querying external Supabase ticket API.
Follows the unified REST/MCP architecture pattern.
"""

from typing import Optional
from pydantic import BaseModel, Field
import httpx

# External API base URL
TICKET_API_BASE_URL = "https://yodrrscbpxqnslgugwow.supabase.co/functions/v1/api/a7f2b8c4-d3e9-4f1a-b5c6-e8d9f0123456"


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
    """Service for searching tickets via external Supabase API."""
    
    def __init__(self):
        self.base_url = TICKET_API_BASE_URL
        self.timeout = 10.0  # 10 second timeout
    
    async def search_ticket(self, ticket_id: str) -> Optional[Ticket]:
        """
        Search for a ticket by ticket ID or partial ID.
        
        Args:
            ticket_id: The ticket ID to search for (full UUID or partial string)
            
        Returns:
            Ticket object if found, None otherwise
            
        Raises:
            httpx.HTTPError: If the API request fails
        """
        if not ticket_id or not ticket_id.strip():
            return None
        
        search_term = ticket_id.strip()
        
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # Try direct ID lookup first (if it looks like a full UUID)
                if len(search_term) == 36 and search_term.count('-') == 4:
                    response = await client.get(
                        f"{self.base_url}/tickets/{search_term}"
                    )
                    if response.status_code == 200:
                        data = response.json()
                        if data:
                            return Ticket(**data)
                
                # Fall back to full-text search for partial IDs or non-UUID strings
                response = await client.get(
                    f"{self.base_url}/tickets",
                    params={"full_text": search_term, "page": 1, "page_size": 1}
                )
                response.raise_for_status()
                
                data = response.json()
                
                # API returns {"data": [...], "total": N}
                if data and isinstance(data, dict) and "data" in data:
                    tickets = data["data"]
                    if tickets and len(tickets) > 0:
                        return Ticket(**tickets[0])
                
                return None
                
            except httpx.HTTPStatusError as e:
                # Log error but return None for 404s (not found is valid state)
                if e.response.status_code == 404:
                    return None
                raise Exception(f"Ticket API error: {e.response.status_code}")
            except httpx.RequestError as e:
                raise Exception(f"Failed to connect to ticket API: {str(e)}")
            except Exception as e:
                raise Exception(f"Error searching tickets: {str(e)}")
