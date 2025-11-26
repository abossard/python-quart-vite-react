"""
Task Overview Agent

Specialized agent that generates natural language overviews of task status
using local Ollama LLM.

Following "Grokking Simplicity":
- Calculations: Pure functions for prompt building, data formatting
- Actions: Ollama API calls, database queries
- Data: Pydantic models

Implementation strategy:
- Fetch task data from TaskService
- Build structured prompt with stats and details
- Use Ollama for natural language generation
- Return formatted, actionable overview
"""

from typing import Any

from agents import BaseAgent
from ollama_service import ChatMessage, ChatRequest, OllamaService
from tasks import TaskService


# ============================================================================
# CALCULATIONS - Pure functions for prompt building
# ============================================================================

def build_task_overview_prompt(tasks_data: dict[str, Any]) -> str:
    """
    Build a structured prompt for task overview generation.
    
    Pure function - no I/O, deterministic output.
    
    Args:
        tasks_data: Dictionary with 'stats', 'recent_tasks', 'all_tasks'
        
    Returns:
        Formatted prompt string
    """
    stats = tasks_data.get('stats', {})
    recent_tasks = tasks_data.get('recent_tasks', [])
    
    prompt = f"""You are a task analysis assistant. Analyze the following tasks and provide a concise overview.

TASK STATISTICS:
- Total tasks: {stats.get('total', 0)}
- Completed: {stats.get('completed', 0)}
- Pending: {stats.get('pending', 0)}

RECENT TASKS:
"""
    
    for task in recent_tasks[:5]:  # Show up to 5 recent tasks
        status = "✓" if task.get('completed') else "○"
        prompt += f"{status} {task.get('title', 'Untitled')}\n"
    
    prompt += """
Please provide:
1. A brief progress summary (1-2 sentences)
2. Key highlights or patterns you notice
3. One actionable insight or suggestion

Keep your response under 150 words and be encouraging yet practical."""

    return prompt


def format_tasks_for_prompt(all_tasks: list) -> dict[str, Any]:
    """
    Extract and format task data for prompt building.
    
    Pure calculation - transforms task list into structured data.
    
    Args:
        all_tasks: List of Task model instances
        
    Returns:
        Dictionary with stats and formatted task data
    """
    # Calculate stats
    total = len(all_tasks)
    completed = sum(1 for task in all_tasks if task.completed)
    pending = total - completed
    
    # Sort by created_at (most recent first)
    sorted_tasks = sorted(
        all_tasks, 
        key=lambda t: t.created_at, 
        reverse=True
    )
    
    # Format recent tasks
    recent_tasks = [
        {
            'title': task.title,
            'description': task.description,
            'completed': task.completed,
            'created_at': task.created_at.isoformat()
        }
        for task in sorted_tasks
    ]
    
    return {
        'stats': {
            'total': total,
            'completed': completed,
            'pending': pending
        },
        'recent_tasks': recent_tasks,
        'all_tasks': all_tasks
    }


# ============================================================================
# AGENT IMPLEMENTATION
# ============================================================================

class TaskOverviewAgent(BaseAgent):
    """
    Agent that generates intelligent task overviews using Ollama.
    
    Deep module implementation:
    - Fetches task data (action)
    - Builds prompt (calculation)
    - Calls LLM (action)
    - Returns formatted result
    
    All complexity hidden behind simple execute() interface.
    """

    def __init__(self):
        """Initialize with Ollama service."""
        self.ollama_service = OllamaService()

    def get_default_options(self) -> dict[str, Any]:
        """
        Default options optimized for task overview generation.
        
        - Lower temperature (0.4) for more consistent, factual output
        - Fast model (llama3.2:1b) for quick response
        """
        return {
            "model": "llama3.2:1b",
            "temperature": 0.4
        }

    async def execute(self, context: dict[str, Any], options: dict[str, Any]) -> str:
        """
        Generate task overview using Ollama.
        
        Consolidated operation:
        1. Fetch all tasks from TaskService (action)
        2. Format task data for prompt (calculation)
        3. Build structured prompt (calculation)
        4. Call Ollama LLM (action)
        5. Return formatted result
        
        Args:
            context: Optional context (not used - agent fetches tasks itself)
            options: Configuration with 'model' and 'temperature'
            
        Returns:
            Natural language task overview
            
        Raises:
            ValueError: If Ollama is unavailable or returns error
        """
        # ACTION: Fetch task data
        all_tasks = TaskService.list_tasks()
        
        # Handle empty task list
        if not all_tasks:
            return "📋 No tasks yet! Create your first task to get started with tracking your work."
        
        # CALCULATION: Format data and build prompt
        tasks_data = format_tasks_for_prompt(all_tasks)
        prompt = build_task_overview_prompt(tasks_data)
        
        # ACTION: Call Ollama LLM
        try:
            chat_request = ChatRequest(
                messages=[
                    ChatMessage(
                        role="user",
                        content=prompt
                    )
                ],
                model=options.get("model", "llama3.2:1b"),
                temperature=options.get("temperature", 0.4)
            )
            
            response = await self.ollama_service.chat(chat_request)
            
            # Return the generated overview
            return response.message.content.strip()
            
        except ValueError as e:
            # Ollama connection or API errors
            error_msg = str(e)
            if "Failed to connect" in error_msg:
                return "⚠️ AI overview unavailable: Ollama server not running. Start it with 'ollama serve' to enable AI-powered task insights."
            else:
                return f"⚠️ AI overview unavailable: {error_msg}"
        
        except Exception as e:
            # Unexpected errors
            return f"⚠️ Could not generate overview: {str(e)}"


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

__all__ = ['TaskOverviewAgent']
