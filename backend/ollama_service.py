"""
Ollama LLM Integration Module

This module provides integration with Ollama for local LLM inference:
- Type-safe data models with automatic validation
- Self-documenting schemas for REST and MCP
- Consolidated business logic for LLM operations
- Async HTTP client for efficient Ollama API communication

Following "Grokking Simplicity" and "A Philosophy of Software Design":
- Deep module: Simple interface, complex implementation
- Separation of pure functions (calculations) from I/O (actions)
- Clear separation: Data models, Service layer
"""

from pydantic import BaseModel, Field, field_validator
from typing import Optional, Literal
from datetime import datetime
import httpx
from enum import Enum
import os
import json
from openai import AzureOpenAI


# ============================================================================
# DATA MODELS - Pydantic for validation and schema generation
# ============================================================================

class ChatMessage(BaseModel):
    """
    Single message in a conversation.
    
    Ollama uses a simple role/content format compatible with
    most LLM chat APIs (OpenAI, Anthropic, etc.).
    """
    role: Literal["user", "assistant", "system"] = Field(
        ..., 
        description="Message role: 'user' for user input, 'assistant' for AI responses, 'system' for system prompts"
    )
    content: str = Field(
        ..., 
        min_length=1, 
        max_length=32000,
        description="Message content"
    )

    @field_validator('content')
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        """Ensure content is not just whitespace."""
        if not v.strip():
            raise ValueError('Message content cannot be empty or whitespace')
        return v.strip()

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "role": "user",
                "content": "What is the capital of France?"
            }]
        }
    }


class ChatRequest(BaseModel):
    """
    Request to generate a chat completion.
    
    Supports conversation history via messages array.
    """
    messages: list[ChatMessage] = Field(
        ..., 
        min_length=1,
        description="Conversation messages (at least one required)"
    )
    model: str = Field(
        default="llama3.2:1b",
        description="Model to use for generation (default: llama3.2:1b for fast testing)"
    )
    temperature: Optional[float] = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature (0.0-2.0). Lower = more focused, higher = more creative"
    )
    stream: bool = Field(
        default=False,
        description="Whether to stream the response (not yet implemented)"
    )

    @field_validator('messages')
    @classmethod
    def messages_not_empty(cls, v: list[ChatMessage]) -> list[ChatMessage]:
        if not v:
            raise ValueError('At least one message is required')
        return v

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "messages": [
                    {"role": "user", "content": "What is Python?"}
                ],
                "model": "llama3.2:1b",
                "temperature": 0.7
            }]
        }
    }


class ChatResponse(BaseModel):
    """
    Response from chat completion.
    
    Contains the generated message and metadata about the generation.
    """
    message: ChatMessage = Field(..., description="Generated assistant message")
    model: str = Field(..., description="Model used for generation")
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Response timestamp"
    )
    done: bool = Field(default=True, description="Whether generation is complete")
    total_duration: Optional[int] = Field(
        None, 
        description="Total duration in nanoseconds"
    )
    eval_count: Optional[int] = Field(
        None,
        description="Number of tokens generated"
    )

    model_config = {
        "json_schema_extra": {
            "examples": [{
                "message": {
                    "role": "assistant",
                    "content": "Python is a high-level programming language..."
                },
                "model": "llama3.2:1b",
                "created_at": "2025-11-26T12:00:00",
                "done": True
            }]
        }
    }


class ModelInfo(BaseModel):
    """Information about an available Ollama model."""
    name: str = Field(..., description="Model name")
    modified_at: Optional[datetime] = Field(None, description="Last modification time")
    size: Optional[int] = Field(None, description="Model size in bytes")
    digest: Optional[str] = Field(None, description="Model digest/hash")
    
    model_config = {
        "json_schema_extra": {
            "examples": [{
                "name": "llama3.2:1b",
                "size": 1300000000,
                "modified_at": "2025-11-26T12:00:00"
            }]
        }
    }


class ModelListResponse(BaseModel):
    """Response containing list of available models."""
    models: list[ModelInfo] = Field(default_factory=list, description="List of available models")


class OllamaError(BaseModel):
    """Error response from Ollama operations."""
    error: str = Field(..., description="Error message")
    details: Optional[str] = Field(None, description="Additional error details")


# ============================================================================
# CONFIGURATION
# ============================================================================

OLLAMA_BASE_URL = "http://localhost:11434"
OLLAMA_TIMEOUT = 120.0  # 2 minutes for model inference


# ============================================================================
# SERVICE LAYER - Business logic with consolidated operations
# ============================================================================

class OllamaService:
    """
    Ollama service handling all LLM operations.
    
    This class consolidates all Ollama API interactions into a cohesive interface.
    Each method does substantial work: validation, API calls, error handling, response parsing.
    """

    @staticmethod
    async def chat(request: ChatRequest) -> ChatResponse:
        """
        Generate a chat completion using Ollama.
        
        Consolidated operation:
        - Validates input via Pydantic
        - Constructs Ollama API request
        - Makes async HTTP call to local Ollama server
        - Parses and validates response
        - Returns structured ChatResponse
        
        Raises:
            httpx.HTTPError: If Ollama server is unreachable or returns error
            ValueError: If response format is invalid
        """
        async with httpx.AsyncClient(timeout=OLLAMA_TIMEOUT) as client:
            try:
                # Construct Ollama API request
                ollama_request = {
                    "model": request.model,
                    "messages": [
                        {"role": msg.role, "content": msg.content}
                        for msg in request.messages
                    ],
                    "stream": request.stream
                }
                
                # Add optional parameters
                if request.temperature is not None:
                    ollama_request["options"] = {
                        "temperature": request.temperature
                    }
                
                # Call Ollama API
                response = await client.post(
                    f"{OLLAMA_BASE_URL}/api/chat",
                    json=ollama_request
                )
                response.raise_for_status()
                
                # Parse response
                data = response.json()
                
                # Extract assistant message
                assistant_message = ChatMessage(
                    role="assistant",
                    content=data.get("message", {}).get("content", "")
                )
                
                # Build structured response
                return ChatResponse(
                    message=assistant_message,
                    model=data.get("model", request.model),
                    done=data.get("done", True),
                    total_duration=data.get("total_duration"),
                    eval_count=data.get("eval_count")
                )
                
            except httpx.HTTPStatusError as e:
                # Handle HTTP errors from Ollama
                error_detail = f"Ollama API error: {e.response.status_code}"
                try:
                    error_data = e.response.json()
                    if "error" in error_data:
                        error_detail = error_data["error"]
                except Exception:
                    pass
                raise ValueError(error_detail) from e
                
            except httpx.RequestError as e:
                # Handle connection errors
                raise ValueError(
                    f"Failed to connect to Ollama server at {OLLAMA_BASE_URL}. "
                    "Make sure Ollama is running (try 'ollama serve')."
                ) from e

    @staticmethod
    async def list_models() -> ModelListResponse:
        """
        List all available Ollama models.
        
        Consolidated operation:
        - Makes async HTTP call to Ollama API
        - Parses model list
        - Returns structured ModelListResponse
        
        Raises:
            httpx.HTTPError: If Ollama server is unreachable or returns error
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                response.raise_for_status()
                
                data = response.json()
                models = []
                
                for model_data in data.get("models", []):
                    model_info = ModelInfo(
                        name=model_data.get("name", "unknown"),
                        size=model_data.get("size"),
                        digest=model_data.get("digest"),
                        modified_at=model_data.get("modified_at")
                    )
                    models.append(model_info)
                
                return ModelListResponse(models=models)
                
            except httpx.HTTPStatusError as e:
                error_detail = f"Ollama API error: {e.response.status_code}"
                raise ValueError(error_detail) from e
                
            except httpx.RequestError as e:
                raise ValueError(
                    f"Failed to connect to Ollama server at {OLLAMA_BASE_URL}. "
                    "Make sure Ollama is running (try 'ollama serve')."
                ) from e

    @staticmethod
    async def health_check() -> bool:
        """
        Check if Ollama server is running and responsive.
        
        Returns:
            bool: True if Ollama is healthy, False otherwise
        """
        async with httpx.AsyncClient(timeout=5.0) as client:
            try:
                response = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                return response.status_code == 200
            except Exception:
                return False

    @staticmethod
    async def generate_kba_azure(ticket_summary: str, ticket_description: str, 
                                 ticket_resolution: Optional[str], ticket_status: str,
                                 ticket_priority: Optional[str], ticket_id: str) -> dict:
        """
        Generate a KBA article using Azure OpenAI.
        
        Uses Azure OpenAI to generate a structured Knowledge Base Article
        with Title, Question, and Answer based on ticket information.
        
        Args:
            ticket_summary: Ticket summary
            ticket_description: Detailed ticket description
            ticket_resolution: Ticket resolution (if available)
            ticket_status: Ticket status
            ticket_priority: Ticket priority
            ticket_id: Ticket ID for reference
            
        Returns:
            dict: KBA article with title, question, answer, and ticket_id
            
        Raises:
            ValueError: If Azure OpenAI configuration is missing or request fails
        """
        # Check Azure OpenAI configuration
        endpoint = os.getenv("AZURE_OPENAI_ENDPOINT")
        api_key = os.getenv("AZURE_OPENAI_API_KEY")
        deployment = os.getenv("AZURE_OPENAI_DEPLOYMENT")
        api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-05-01-preview")
        
        if not all([endpoint, api_key, deployment]):
            raise ValueError(
                "Azure OpenAI configuration missing. Please set AZURE_OPENAI_ENDPOINT, "
                "AZURE_OPENAI_API_KEY, and AZURE_OPENAI_DEPLOYMENT in .env file."
            )
        
        # Create prompt for LLM (in German)
        prompt = f"""Basierend auf diesem Support-Ticket, erstelle einen Knowledge Base Artikel.

Ticket Information:
Zusammenfassung: {ticket_summary}
Beschreibung: {ticket_description}
Lösung: {ticket_resolution or 'Keine Lösung vorhanden'}
Status: {ticket_status}
Priorität: {ticket_priority}

Erstelle einen strukturierten Knowledge Base Artikel mit:
1. Einem prägnanten Titel (max. 100 Zeichen)
2. Einer klaren Frage, die das Problem beschreibt
3. Einer detaillierten Antwort/Lösung

Antworte NUR im folgenden JSON-Format (ohne Markdown-Formatierung):
{{
  "title": "Titel des Artikels",
  "question": "Die Frage/Problem",
  "answer": "Die detaillierte Antwort/Lösung"
}}"""
        
        try:
            # Check if this is a Responses API endpoint (new preview API format)
            if '/openai/responses' in endpoint:
                # Use Responses API format with httpx
                print(f"DEBUG: Using Responses API with endpoint: {endpoint}")
                print(f"DEBUG: Deployment: {deployment}")
                
                async with httpx.AsyncClient(timeout=120.0) as http_client:
                    payload = {
                        "model": deployment,
                        "input": prompt,  # Responses API uses 'input' not 'messages'
                        "temperature": 0.7,
                        "max_output_tokens": 4000  # Responses API uses 'max_output_tokens'
                    }
                    print(f"DEBUG: Request payload: {json.dumps(payload, ensure_ascii=False)[:200]}...")
                    
                    try:
                        response = await http_client.post(
                            endpoint,
                            headers={
                                "api-key": api_key,
                                "Content-Type": "application/json"
                            },
                            json=payload
                        )
                        
                        print(f"DEBUG: Response status: {response.status_code}")
                        print(f"DEBUG: Response headers: {dict(response.headers)}")
                        
                        if response.status_code != 200:
                            error_text = response.text
                            print(f"DEBUG: Error response: {error_text}")
                            raise ValueError(f"Azure API error {response.status_code}: {error_text}")
                        
                        data = response.json()
                        print(f"DEBUG: Response data keys: {list(data.keys())}")
                        print(f"DEBUG: Full response: {json.dumps(data, ensure_ascii=False)[:500]}...")
                        
                        # Extract content from Responses API format
                        # The Responses API returns: {"output": [{"content": [{"type": "output_text", "text": "..."}]}]}
                        if 'output' in data:
                            output = data['output']
                            if isinstance(output, list) and len(output) > 0:
                                # Navigate: output[0].content[0].text
                                message = output[0]
                                if 'content' in message:
                                    content_list = message['content']
                                    if isinstance(content_list, list) and len(content_list) > 0:
                                        content_item = content_list[0]
                                        if 'text' in content_item:
                                            content = content_item['text'].strip()
                                            print(f"DEBUG: Extracted from 'output[0].content[0].text'")
                                        else:
                                            raise ValueError(f"No 'text' field in content item: {content_item}")
                                    else:
                                        raise ValueError(f"Content is not a valid list: {content_list}")
                                else:
                                    raise ValueError(f"No 'content' field in message: {message}")
                            else:
                                raise ValueError(f"Output is not a valid list: {output}")
                        elif 'text' in data:
                            content = data['text'].strip()
                            print(f"DEBUG: Extracted from 'text'")
                        elif 'choices' in data and len(data['choices']) > 0:
                            choice = data['choices'][0]
                            if 'text' in choice:
                                content = choice['text'].strip()
                                print(f"DEBUG: Extracted from 'choices[0].text'")
                            elif 'message' in choice:
                                content = choice['message'].get('content', '').strip()
                                print(f"DEBUG: Extracted from 'choices[0].message.content'")
                            else:
                                raise ValueError(f"Unexpected choice format: {choice}")
                        else:
                            raise ValueError(f"Unexpected response format: {data}")
                    except httpx.TimeoutException as e:
                        print(f"DEBUG: Request timeout after 120s")
                        raise ValueError(f"Azure API request timeout: {str(e)}") from e
                    except httpx.HTTPError as e:
                        print(f"DEBUG: HTTP error: {str(e)}")
                        raise ValueError(f"Azure API HTTP error: {str(e)}") from e
            else:
                # Standard Chat Completions API
                azure_client = AzureOpenAI(
                    azure_endpoint=endpoint,
                    api_key=api_key,
                    api_version=api_version
                )
                
                response = azure_client.chat.completions.create(
                    model=deployment,
                    messages=[
                        {"role": "user", "content": prompt}
                    ],
                    temperature=0.7
                )
                
                content = response.choices[0].message.content.strip()
            
            # Remove markdown code blocks if present
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            
            content = content.strip()
            kba_data = json.loads(content)
            
            return {
                "title": kba_data["title"],
                "question": kba_data["question"],
                "answer": kba_data["answer"],
                "ticket_id": ticket_id
            }
            
        except json.JSONDecodeError:
            # Fallback if JSON parsing fails
            return {
                "title": f"KBA für: {ticket_summary}",
                "question": f"Wie löse ich: {ticket_summary}?",
                "answer": content if 'content' in locals() else ticket_description,
                "ticket_id": ticket_id
            }
        except Exception as e:
            raise ValueError(f"Azure OpenAI request failed: {str(e)}") from e


# ============================================================================
# CONVENIENCE EXPORTS
# ============================================================================

# Export service for easy importing
service = OllamaService()

# Export models for type hints
__all__ = [
    'ChatMessage',
    'ChatRequest',
    'ChatResponse',
    'ModelInfo',
    'ModelListResponse',
    'OllamaError',
    'OllamaService',
    'service',
    'OLLAMA_BASE_URL'
]
