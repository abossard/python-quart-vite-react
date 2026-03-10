"""
Integration tests for LiteLLM with GitHub Copilot structured output.

These tests call the actual LLM API — run manually after authenticating:
    1. Run once to trigger OAuth: python -c "import litellm; litellm.completion(model='github_copilot/gpt-4o', messages=[{'role':'user','content':'hi'}], max_tokens=5)"
    2. Authenticate at https://github.com/login/device with the displayed code
    3. Run tests: ../.venv/bin/python -m pytest tests/test_litellm_integration.py -v -s

Requires: Active GitHub Copilot subscription.
Skips automatically if not authenticated.
"""

import asyncio
import os
import sys
import pytest
from pydantic import BaseModel, Field
from typing import Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from llm_service import LLMService
from kba_output_models import KBAOutputSchema


# ============================================================================
# Test Schemas
# ============================================================================

class SimpleAnswer(BaseModel):
    """Minimal schema for quick tests"""
    answer: str = Field(description="Short answer")
    confidence: float = Field(ge=0.0, le=1.0, description="Confidence 0-1")


class TicketKBA(BaseModel):
    """Realistic KBA schema matching production use"""
    title: str = Field(min_length=10, max_length=200, description="KBA title")
    symptoms: list[str] = Field(min_length=1, description="Observable symptoms")
    cause: Optional[str] = Field(default="", description="Root cause")
    resolution_steps: list[str] = Field(min_length=1, description="Fix steps")
    tags: list[str] = Field(min_length=2, description="Lowercase tags")


# ============================================================================
# Helpers
# ============================================================================

def _is_copilot_authenticated() -> bool:
    """Check if GitHub Copilot OAuth tokens exist"""
    token_dir = os.path.expanduser("~/.config/litellm/github_copilot")
    return os.path.exists(os.path.join(token_dir, "api-key.json"))


skip_if_no_auth = pytest.mark.skipif(
    not _is_copilot_authenticated(),
    reason="GitHub Copilot not authenticated. Run OAuth device flow first."
)


# ============================================================================
# Tests
# ============================================================================

@skip_if_no_auth
class TestLiteLLMCopilotStructuredOutput:
    """Live integration tests against GitHub Copilot via LiteLLM"""

    @pytest.mark.asyncio
    async def test_simple_structured_output(self):
        """Test minimal structured output with a fast model"""
        service = LLMService(model='github_copilot/gpt-4o-mini', backend='litellm', timeout=30)

        result = await service.structured_chat(
            messages=[{"role": "user", "content": "What is 2+2? Answer with the number and your confidence."}],
            output_schema=SimpleAnswer
        )

        assert isinstance(result, SimpleAnswer)
        assert "4" in result.answer
        assert 0.0 <= result.confidence <= 1.0
        print(f"\n  answer={result.answer}, confidence={result.confidence}")

    @pytest.mark.asyncio
    async def test_kba_structured_output(self):
        """Test realistic KBA generation with structured output"""
        service = LLMService(model='github_copilot/gpt-4o-mini', backend='litellm', timeout=60)

        result = await service.structured_chat(
            messages=[{"role": "user", "content": (
                "Create a KBA for this IT ticket:\n"
                "Summary: VPN connection drops after Windows 11 update\n"
                "Notes: User reports VPN disconnects every 5 minutes since KB5034441 update\n"
                "Resolution: Reinstalled VPN client v4.2, applied firewall exception\n"
                "Be concise. Use German for the title."
            )}],
            output_schema=TicketKBA
        )

        assert isinstance(result, TicketKBA)
        assert len(result.title) >= 10
        assert len(result.symptoms) >= 1
        assert len(result.resolution_steps) >= 1
        assert len(result.tags) >= 2
        assert all(tag == tag.lower() for tag in result.tags)
        print(f"\n  title={result.title}")
        print(f"  symptoms={result.symptoms}")
        print(f"  steps={result.resolution_steps}")
        print(f"  tags={result.tags}")

    @pytest.mark.asyncio
    async def test_fallback_chain_live(self):
        """Test that fallback chain works with a bad primary model"""
        service = LLMService(model='github_copilot/nonexistent-model-xyz', backend='litellm', timeout=30)
        service._fallback_models = ['github_copilot/gpt-4o-mini']

        result = await service.structured_chat(
            messages=[{"role": "user", "content": "What color is the sky? Answer with one word and confidence."}],
            output_schema=SimpleAnswer
        )

        assert isinstance(result, SimpleAnswer)
        assert len(result.answer) > 0
        print(f"\n  Fallback worked: answer={result.answer}")

    @pytest.mark.asyncio
    async def test_health_check_live(self):
        """Test health check against live Copilot API"""
        service = LLMService(model='github_copilot/gpt-4o-mini', backend='litellm', timeout=15)
        healthy = await service.health_check()
        assert healthy is True
        print("\n  Health check: OK")

    @pytest.mark.asyncio
    async def test_full_kba_output_schema(self):
        """Test with the actual production KBAOutputSchema"""
        service = LLMService(model='github_copilot/gpt-4o-mini', backend='litellm', timeout=60)

        result = await service.structured_chat(
            messages=[{"role": "user", "content": (
                "Du bist ein technischer Redakteur. Erstelle einen KBA aus diesem Ticket:\n"
                "Incident-ID: INC000016349815\n"
                "Zusammenfassung: Outlook startet nicht nach Windows-Update\n"
                "Notizen: Nach Installation von KB5035853 lässt sich Outlook nicht mehr öffnen. "
                "Fehlermeldung: 'MAPI-Initialisierung fehlgeschlagen'.\n"
                "Lösung: Office-Reparatur über Systemsteuerung, dann Outlook-Profil neu erstellt.\n"
                "Kategorie: Software > Microsoft Office\n"
                "Priorität: high\n"
                "Antworte auf Deutsch."
            )}],
            output_schema=KBAOutputSchema
        )

        assert isinstance(result, KBAOutputSchema)
        assert len(result.title) >= 10
        assert len(result.symptoms) >= 1
        assert len(result.resolution_steps) >= 1
        assert len(result.tags) >= 2
        print(f"\n  title={result.title}")
        print(f"  symptoms={len(result.symptoms)} items")
        print(f"  steps={len(result.resolution_steps)} items")
        print(f"  tags={result.tags}")
        if result.cause:
            print(f"  cause={result.cause[:80]}...")
