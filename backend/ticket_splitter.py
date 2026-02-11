"""
Ticket Splitter Service

Analyzes tickets for multiple problems and creates split tickets for secondary issues.
"""
from typing import Optional
from uuid import UUID, uuid4
from pydantic import BaseModel, Field
from datetime import datetime

from tickets import (
    Ticket,
    TicketCreate,
    TicketPriority,
    TicketStatus,
)
from csv_data import CSVTicketService


class SecondaryProblem(BaseModel):
    """A secondary problem identified in a ticket"""
    description: str = Field(..., description="Description of the secondary problem")
    severity: str = Field(..., description="Severity assessment (low/medium/high/critical)")
    suggested_priority: TicketPriority = Field(..., description="Suggested priority for new ticket")
    reasoning: str = Field(..., description="Why this was identified as a separate issue")


class SplitAnalysis(BaseModel):
    """Analysis result for a single ticket"""
    original_ticket_id: UUID = Field(..., description="ID of the original ticket")
    original_summary: str = Field(..., description="Summary of original ticket")
    has_multiple_problems: bool = Field(..., description="Whether multiple problems were detected")
    secondary_problems: list[SecondaryProblem] = Field(default_factory=list, description="List of secondary problems found")
    reasoning: str = Field(..., description="Overall reasoning for the analysis")


class SplitResult(BaseModel):
    """Result of splitting a ticket"""
    original_ticket_id: UUID
    created_tickets: list[Ticket] = Field(default_factory=list, description="Newly created tickets")
    success: bool
    message: str


class TicketSplitterService:
    """Service for analyzing and splitting tickets"""
    
    def __init__(self, csv_service: CSVTicketService):
        self.csv_service = csv_service
        self._split_tickets: dict[UUID, Ticket] = {}  # In-memory storage for split tickets
    
    async def analyze_ticket_with_agent(
        self,
        ticket: Ticket,
        agent_service
    ) -> SplitAnalysis:
        """
        Analyze a single ticket using AI agent to detect multiple problems.
        
        Args:
            ticket: The ticket to analyze
            agent_service: Instance of AgentService for AI analysis
            
        Returns:
            SplitAnalysis with detected problems
        """
        # Build analysis prompt
        prompt = self._build_analysis_prompt(ticket)
        
        # Use agent to analyze
        from agents import AgentRequest
        request = AgentRequest(
            prompt=prompt,
            agent_type="task_assistant"
        )
        
        try:
            result = await agent_service.run_agent(request)
            
            # Parse agent output to extract structured analysis
            analysis = self._parse_agent_response(ticket, result.output)
            return analysis
            
        except Exception as e:
            # Return empty analysis on error
            return SplitAnalysis(
                original_ticket_id=ticket.id,
                original_summary=ticket.summary,
                has_multiple_problems=False,
                secondary_problems=[],
                reasoning=f"Analysis failed: {str(e)}"
            )
    
    def _build_analysis_prompt(self, ticket: Ticket) -> str:
        """Build prompt for agent to analyze ticket"""
        prompt = f"""Analyze the following support ticket to determine if it describes MULTIPLE DISTINCT problems that should be handled separately.

TICKET ID: {ticket.id}
SUMMARY: {ticket.summary}
DESCRIPTION: {ticket.description or "No description provided"}
NOTES: {ticket.notes or "No notes"}

Your task:
1. Determine if this ticket describes MORE THAN ONE distinct technical problem or issue
2. If multiple problems exist, identify EACH secondary problem (not the main one)
3. For each secondary problem:
   - Provide a clear description
   - Assess severity (low/medium/high/critical)
   - Suggest priority
   - Explain why it should be a separate ticket

IMPORTANT:
- Only identify TRULY SEPARATE issues, not related symptoms of the same problem
- The main/primary problem stays in the original ticket
- Only secondary problems should be extracted
- If the ticket describes only ONE problem (even if complex), respond with NO secondary problems

Respond in this EXACT JSON format:
{{
  "has_multiple_problems": true/false,
  "secondary_problems": [
    {{
      "description": "Clear description of secondary problem",
      "severity": "medium",
      "suggested_priority": "MEDIUM",
      "reasoning": "Why this should be separate"
    }}
  ],
  "reasoning": "Overall explanation of your analysis"
}}"""
        return prompt
    
    def _parse_agent_response(self, ticket: Ticket, agent_output: str) -> SplitAnalysis:
        """Parse agent response and extract structured analysis"""
        import json
        import re
        
        # Try to find JSON in the output
        json_match = re.search(r'\{.*\}', agent_output, re.DOTALL)
        if not json_match:
            return SplitAnalysis(
                original_ticket_id=ticket.id,
                original_summary=ticket.summary,
                has_multiple_problems=False,
                secondary_problems=[],
                reasoning="Could not parse agent response"
            )
        
        try:
            parsed = json.loads(json_match.group(0))
            
            secondary_problems = []
            for prob in parsed.get("secondary_problems", []):
                # Map priority string to enum
                priority_str = prob.get("suggested_priority", "MEDIUM").upper()
                try:
                    priority = TicketPriority[priority_str]
                except KeyError:
                    priority = TicketPriority.MEDIUM
                
                secondary_problems.append(SecondaryProblem(
                    description=prob.get("description", ""),
                    severity=prob.get("severity", "medium"),
                    suggested_priority=priority,
                    reasoning=prob.get("reasoning", "")
                ))
            
            return SplitAnalysis(
                original_ticket_id=ticket.id,
                original_summary=ticket.summary,
                has_multiple_problems=parsed.get("has_multiple_problems", False),
                secondary_problems=secondary_problems,
                reasoning=parsed.get("reasoning", "")
            )
            
        except json.JSONDecodeError:
            return SplitAnalysis(
                original_ticket_id=ticket.id,
                original_summary=ticket.summary,
                has_multiple_problems=False,
                secondary_problems=[],
                reasoning="Failed to parse JSON from agent response"
            )
    
    async def analyze_all_tickets(
        self,
        agent_service,
        limit: Optional[int] = None
    ) -> list[SplitAnalysis]:
        """
        Analyze all tickets (or a subset) for multiple problems.
        
        Args:
            agent_service: Instance of AgentService
            limit: Optional limit on number of tickets to analyze
            
        Returns:
            List of SplitAnalysis results
        """
        # Get all tickets from CSV
        all_tickets = self.csv_service.list_tickets()
        
        # Apply limit if specified
        tickets = all_tickets[:limit] if limit else all_tickets
        
        analyses = []
        for ticket in tickets:
            analysis = await self.analyze_ticket_with_agent(ticket, agent_service)
            analyses.append(analysis)
        
        return analyses
    
    def create_split_tickets(
        self,
        original_ticket: Ticket,
        secondary_problems: list[SecondaryProblem]
    ) -> SplitResult:
        """
        Create new tickets for secondary problems.
        
        NOTE: This creates tickets in-memory only (CSV is read-only).
        Tickets will be lost on server restart.
        
        Args:
            original_ticket: The original ticket
            secondary_problems: List of secondary problems to create tickets for
            
        Returns:
            SplitResult with created tickets
        """
        created_tickets = []
        
        for i, problem in enumerate(secondary_problems, 1):
            # Generate new ticket ID
            new_ticket_id = uuid4()
            
            # Create incident ID
            incident_id = f"INC{str(new_ticket_id.int)[:6]}"
            
            # Build summary and description
            summary = f"Secondary issue from {original_ticket.id}: {problem.description[:100]}"
            description = f"""This ticket was automatically split from original ticket {original_ticket.id}.

ORIGINAL TICKET SUMMARY:
{original_ticket.summary}

SECONDARY PROBLEM IDENTIFIED:
{problem.description}

REASONING:
{problem.reasoning}

---
Original ticket notes: {original_ticket.notes or "None"}
"""
            
            # Create new ticket with same requester, location, etc.
            new_ticket = Ticket(
                id=new_ticket_id,
                summary=summary,
                description=description,
                status=TicketStatus.NEW,
                priority=problem.suggested_priority,
                urgency=original_ticket.urgency,
                impact=original_ticket.impact,
                requester_name=original_ticket.requester_name,
                requester_email=original_ticket.requester_email,
                requester_phone=original_ticket.requester_phone,
                requester_company=original_ticket.requester_company,
                requester_department=original_ticket.requester_department,
                assigned_group=original_ticket.assigned_group,
                assignee=None,  # Unassigned initially
                site=original_ticket.site,
                city=original_ticket.city,
                country=original_ticket.country,
                service=original_ticket.service,
                operational_category_tier1=original_ticket.operational_category_tier1,
                operational_category_tier2=original_ticket.operational_category_tier2,
                operational_category_tier3=original_ticket.operational_category_tier3,
                product_category_tier1=original_ticket.product_category_tier1,
                product_category_tier2=original_ticket.product_category_tier2,
                product_category_tier3=original_ticket.product_category_tier3,
                created_at=datetime.now(),
                updated_at=datetime.now(),
                notes=f"Split from {original_ticket.id}"
            )
            
            # Store in memory
            self._split_tickets[new_ticket_id] = new_ticket
            created_tickets.append(new_ticket)
        
        return SplitResult(
            original_ticket_id=original_ticket.id,
            created_tickets=created_tickets,
            success=True,
            message=f"Created {len(created_tickets)} split ticket(s). Note: These are stored in-memory only."
        )
    
    def get_split_tickets(self) -> list[Ticket]:
        """Get all split tickets created in this session"""
        return list(self._split_tickets.values())
    
    def get_split_ticket(self, ticket_id: UUID) -> Optional[Ticket]:
        """Get a specific split ticket by ID"""
        return self._split_tickets.get(ticket_id)
