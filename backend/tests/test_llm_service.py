"""
Tests for LLM Service (OpenAI Integration)

Tests OpenAI client initialization, structured output, error handling,
and exception mapping for the KBA Drafter.
"""

import os
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import BaseModel, Field

from llm_service import LLMService, get_llm_service
from kba_exceptions import (
    LLMUnavailableError,
    LLMTimeoutError,
    LLMRateLimitError,
    LLMAuthenticationError,
)
from kba_output_models import KBAOutputSchema


# Test Pydantic Schema
class SimpleTestSchema(BaseModel):
    """Simple schema for testing"""
    title: str = Field(min_length=5)
    count: int = Field(ge=1)


class TestLLMServiceInitialization:
    """Test LLM service initialization and configuration"""
    
    def test_service_initialization_with_params(self):
        """Test service initializes with explicit parameters"""
        service = LLMService(
            api_key='explicit-key',
            model='gpt-4o',
            timeout=120
        )
        
        assert service.api_key == 'explicit-key'
        assert service.model == 'gpt-4o'
        assert service.timeout == 120
    
    def test_service_initialization_with_base_url(self):
        """Test service initializes with base URL parameter"""
        service = LLMService(
            api_key='test-key',
            model='gpt-4o-mini',
            base_url='https://custom.openai.com'
        )
        
        assert service.api_key == 'test-key'
        assert service.model == 'gpt-4o-mini'
        assert service.base_url == 'https://custom.openai.com'
    
    def test_service_initialization_no_api_key_raises_error(self):
        """Test that missing API key raises LLMAuthenticationError"""
        with patch.dict(os.environ, {}, clear=True):
            # Need to reload module to clear module-level config
            import llm_service
            from importlib import reload
            reload(llm_service)
            
            with pytest.raises(llm_service.LLMAuthenticationError, match="OpenAI API key not set"):
                llm_service.LLMService()
    
    def test_service_uses_module_level_defaults(self):
        """Test that module-level config provides defaults"""
        # This test uses whatever is set in module-level config from .env
        # We just verify that explicit params override them
        service = LLMService(api_key='override-key', model='override-model')
        assert service.api_key == 'override-key'
        assert service.model == 'override-model'
    
    def test_singleton_pattern(self):
        """Test that get_llm_service returns singleton instance"""
        # Reset singleton
        import llm_service
        llm_service._llm_service = None
        
        # Need to provide explicit params since env vars might not be set in test env
        with patch.object(llm_service, 'LLMService') as mock_llm:
            mock_instance = MagicMock()
            mock_llm.return_value = mock_instance
            
            service1 = get_llm_service()
            service2 = get_llm_service()
            
            assert service1 is service2


class TestLLMServiceHealthCheck:
    """Test health check functionality"""
    
    @pytest.mark.asyncio
    async def test_health_check_success(self):
        """Test successful health check"""
        service = LLMService(api_key='test-key')
        
        with patch.object(service._client.models, 'list', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = MagicMock()
            
            result = await service.health_check()
            
            assert result is True
            mock_list.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_health_check_failure(self):
        """Test health check handles errors gracefully"""
        service = LLMService(api_key='test-key')
        
        with patch.object(service._client.models, 'list', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = Exception("Connection failed")
            
            result = await service.health_check()
            
            assert result is False


class TestLLMServiceStructuredOutput:
    """Test structured output generation with OpenAI"""
    
    @pytest.mark.asyncio
    async def test_structured_chat_success(self):
        """Test successful structured output generation"""
        service = LLMService(api_key='test-key', model='gpt-4o-mini')
        
        # Mock OpenAI response
        mock_parsed_output = SimpleTestSchema(title="Test Title", count=5)
        mock_message = MagicMock()
        mock_message.refusal = None
        mock_message.parsed = mock_parsed_output
        
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        mock_completion.model = 'gpt-4o-mini'
        mock_completion.usage = MagicMock(
            prompt_tokens=100,
            completion_tokens=50,
            total_tokens=150
        )
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = mock_completion
            
            result = await service.structured_chat(
                messages=[{"role": "user", "content": "Generate test data"}],
                output_schema=SimpleTestSchema
            )
            
            assert isinstance(result, SimpleTestSchema)
            assert result.title == "Test Title"
            assert result.count == 5
            
            mock_parse.assert_called_once()
            call_kwargs = mock_parse.call_args[1]
            assert call_kwargs['model'] == 'gpt-4o-mini'
            assert call_kwargs['response_format'] == SimpleTestSchema
    
    @pytest.mark.asyncio
    async def test_structured_chat_with_refusal(self):
        """Test handling of OpenAI content policy refusal"""
        service = LLMService(api_key='test-key')
        
        mock_message = MagicMock()
        mock_message.refusal = "Content violates policy"
        
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = mock_completion
            
            with pytest.raises(LLMUnavailableError, match="content policy violation"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )


class TestLLMServiceErrorHandling:
    """Test error handling and exception mapping"""
    
    @pytest.mark.asyncio
    async def test_connection_error_mapping(self):
        """Test APIConnectionError maps to LLMUnavailableError"""
        from openai import APIConnectionError
        
        service = LLMService(api_key='test-key')
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = APIConnectionError(request=MagicMock())
            
            with pytest.raises(LLMUnavailableError, match="Failed to connect"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_timeout_error_mapping(self):
        """Test APITimeoutError maps to LLMTimeoutError"""
        from openai import APITimeoutError
        
        service = LLMService(api_key='test-key', timeout=30)
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = APITimeoutError(request=MagicMock())
            
            with pytest.raises(LLMTimeoutError, match="timed out after 30s"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_rate_limit_error_mapping(self):
        """Test RateLimitError maps to LLMRateLimitError"""
        from openai import RateLimitError
        
        service = LLMService(api_key='test-key')
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = RateLimitError(
                message="Rate limit exceeded",
                response=MagicMock(),
                body={}
            )
            
            with pytest.raises(LLMRateLimitError, match="rate limit exceeded"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_authentication_error_mapping(self):
        """Test AuthenticationError maps to LLMAuthenticationError"""
        from openai import AuthenticationError
        
        service = LLMService(api_key='invalid-key')
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = AuthenticationError(
                message="Invalid API key",
                response=MagicMock(),
                body={}
            )
            
            with pytest.raises(LLMAuthenticationError, match="API key invalid"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_bad_request_error_preserved(self):
        """Test BadRequestError (schema issues) is not mapped"""
        from openai import BadRequestError
        
        service = LLMService(api_key='test-key')
        
        with patch.object(
            service._client.beta.chat.completions,
            'parse',
            new_callable=AsyncMock
        ) as mock_parse:
            original_error = BadRequestError(
                message="Invalid schema",
                response=MagicMock(),
                body={}
            )
            mock_parse.side_effect = original_error
            
            with pytest.raises(BadRequestError):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )


class TestKBAOutputSchemaValidation:
    """Test KBA output schema Pydantic validation"""
    
    def test_valid_kba_schema(self):
        """Test valid KBA data passes validation"""
        valid_data = {
            'title': 'Test KBA Article Title',
            'symptoms': ['Symptom 1 description', 'Symptom 2 description'],
            'cause': 'Root cause analysis',
            'resolution_steps': ['Step 1 resolution', 'Step 2 resolution'],
            'tags': ['test', 'validation']
        }
        
        kba = KBAOutputSchema(**valid_data)
        
        assert kba.title == 'Test KBA Article Title'
        assert len(kba.symptoms) == 2
        assert len(kba.tags) == 2
    
    def test_kba_schema_missing_required_field(self):
        """Test validation fails for missing required fields"""
        invalid_data = {
            'title': 'Test Title',
            'symptoms': ['Symptom 1']
            # Missing: resolution_steps, tags
        }
        
        with pytest.raises(Exception):  # Pydantic ValidationError
            KBAOutputSchema(**invalid_data)
    
    def test_kba_schema_invalid_tag_format(self):
        """Test validation fails for invalid tag format"""
        invalid_data = {
            'title': 'Test Title',
            'symptoms': ['Symptom one'],
            'resolution_steps': ['Step one'],
            'tags': ['Valid-Tag', 'UPPERCASE']  # UPPERCASE not allowed
        }
        
        with pytest.raises(ValueError, match="must be lowercase"):
            KBAOutputSchema(**invalid_data)
    
    def test_kba_schema_short_symptom(self):
        """Test validation fails for too short symptoms"""
        invalid_data = {
            'title': 'Test Title',
            'symptoms': ['Short'],  # Less than 10 chars
            'resolution_steps': ['Step one'],
            'tags': ['test', 'validation']
        }
        
        with pytest.raises(ValueError, match="at least 10 characters"):
            KBAOutputSchema(**invalid_data)
    
    def test_kba_schema_optional_fields(self):
        """Test optional fields work correctly"""
        data = {
            'title': 'Test Title',
            'symptoms': ['Symptom description here'],
            'resolution_steps': ['Resolution step here'],
            'tags': ['test', 'optional'],
            'cause': 'Root cause',
            'warnings': ['Warning message here'],
            'confidence_notes': 'High confidence'
        }
        
        kba = KBAOutputSchema(**data)
        
        assert kba.cause == 'Root cause'
        assert len(kba.warnings) == 1
        assert kba.confidence_notes == 'High confidence'


class TestLLMServiceCleanup:
    """Test cleanup and resource management"""
    
    @pytest.mark.asyncio
    async def test_close_client(self):
        """Test that close() closes the async client"""
        service = LLMService(api_key='test-key')
        
        with patch.object(service._client, 'close', new_callable=AsyncMock) as mock_close:
            await service.close()
            mock_close.assert_called_once()
