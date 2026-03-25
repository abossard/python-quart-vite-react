"""
Tests for LLM Service (OpenAI + LiteLLM Dual Backend)

Tests initialization, backend selection, structured output, error handling,
and exception mapping for the KBA Drafter.
"""

import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from kba_exceptions import (LLMAuthenticationError, LLMRateLimitError,
                            LLMTimeoutError, LLMUnavailableError)
from kba_output_models import KBAOutputSchema
from llm_service import LLMService, get_llm_service
from pydantic import BaseModel, Field


# Test Pydantic Schema
class SimpleTestSchema(BaseModel):
    """Simple schema for testing"""
    title: str = Field(min_length=5)
    count: int = Field(ge=1)


class TestLLMServiceInitialization:
    """Test LLM service initialization and configuration"""
    
    def test_service_initialization_with_params(self):
        """Test service initializes with explicit parameters on OpenAI backend"""
        service = LLMService(
            api_key='explicit-key',
            model='gpt-4o',
            timeout=120,
            backend='openai'
        )
        
        assert service.api_key == 'explicit-key'
        assert service.model == 'gpt-4o'
        assert service.timeout == 120
        assert service._backend == 'openai'
    
    def test_service_initialization_with_base_url(self):
        """Test service initializes with base URL parameter"""
        service = LLMService(
            api_key='test-key',
            model='gpt-4o-mini',
            base_url='https://custom.openai.com',
            backend='openai'
        )
        
        assert service.api_key == 'test-key'
        assert service.model == 'gpt-4o-mini'
        assert service.base_url == 'https://custom.openai.com'
        assert service._backend == 'openai'
    
    def test_service_defaults_to_litellm(self):
        """Test that default backend is LiteLLM (no .env needed)"""
        service = LLMService()
        assert service._backend == 'litellm'
        assert service._client is None
    
    def test_service_forced_openai_without_key_raises(self):
        """Test that forcing openai backend without key raises error"""
        with patch('llm_service.OPENAI_API_KEY', ''):
            with pytest.raises(LLMAuthenticationError, match="OpenAI API key not set"):
                LLMService(backend="openai")
    
    def test_service_forced_litellm_backend(self):
        """Test forcing LiteLLM backend even with API key"""
        service = LLMService(
            api_key='test-key',
            model='github_copilot/gpt-4o',
            backend='litellm'
        )
        assert service._backend == 'litellm'
        assert service.model == 'github_copilot/gpt-4o'
        assert service._client is None
    
    def test_service_uses_module_level_defaults(self):
        """Test that module-level config provides defaults"""
        service = LLMService(api_key='override-key', model='override-model')
        assert service.api_key == 'override-key'
        assert service.model == 'override-model'
    
    def test_singleton_pattern(self):
        """Test that get_llm_service returns singleton instance"""
        import llm_service
        llm_service._llm_service = None
        
        with patch.object(llm_service, 'LLMService') as mock_llm:
            mock_instance = MagicMock()
            mock_llm.return_value = mock_instance
            
            service1 = get_llm_service()
            service2 = get_llm_service()
            
            assert service1 is service2


class TestLLMServiceHealthCheck:
    """Test health check functionality"""
    
    @pytest.mark.asyncio
    async def test_health_check_success_openai(self):
        """Test successful health check with OpenAI backend"""
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(service._client.models, 'list', new_callable=AsyncMock) as mock_list:
            mock_list.return_value = MagicMock()
            result = await service.health_check()
            assert result is True
            mock_list.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_health_check_failure_openai(self):
        """Test health check handles errors gracefully"""
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(service._client.models, 'list', new_callable=AsyncMock) as mock_list:
            mock_list.side_effect = Exception("Connection failed")
            result = await service.health_check()
            assert result is False
    
    @pytest.mark.asyncio
    async def test_health_check_litellm(self):
        """Test health check with LiteLLM backend"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_completion:
            mock_resp = MagicMock()
            mock_completion.return_value = mock_resp
            result = await service.health_check()
            assert result is True


class TestLLMServiceModelCatalog:
    """Test model catalog exposure for UI selection."""

    def test_model_catalog_uses_litellm_discovery(self):
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        service._fallback_models = ['github_copilot/gpt-4o-mini']

        with patch('litellm.get_valid_models') as mock_get_valid_models:
            mock_get_valid_models.return_value = ['github_copilot/gpt-4o', 'github_copilot/claude-sonnet-4']

            catalog = service.get_model_catalog()

        assert catalog['backend'] == 'litellm'
        assert catalog['provider'] == 'github_copilot'
        assert catalog['default_model'] == 'github_copilot/gpt-4o'
        assert catalog['fallback_models'] == ['github_copilot/gpt-4o-mini']
        assert catalog['available_models'] == [
            'github_copilot/gpt-4o',
            'github_copilot/gpt-4o-mini',
            'github_copilot/claude-sonnet-4',
        ]
        assert catalog['source'] == 'litellm'

    def test_model_catalog_falls_back_to_configured_models(self):
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        service._fallback_models = ['github_copilot/gpt-4o-mini']

        with patch('litellm.get_valid_models', side_effect=Exception('boom')):
            catalog = service.get_model_catalog()

        assert catalog['available_models'] == [
            'github_copilot/gpt-4o',
            'github_copilot/gpt-4o-mini',
        ]
        assert catalog['source'] == 'configured'


class TestLLMServiceStructuredOutputOpenAI:
    """Test structured output generation with OpenAI backend"""
    
    @pytest.mark.asyncio
    async def test_structured_chat_success(self):
        """Test successful structured output generation"""
        service = LLMService(api_key='test-key', model='gpt-4o-mini', backend='openai')
        
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
            prompt_tokens=100, completion_tokens=50, total_tokens=150
        )
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
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
        service = LLMService(api_key='test-key', backend='openai')
        
        mock_message = MagicMock()
        mock_message.refusal = "Content violates policy"
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.return_value = mock_completion
            
            with pytest.raises(LLMUnavailableError, match="content policy violation"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )


class TestLLMServiceStructuredOutputLiteLLM:
    """Test structured output generation with LiteLLM backend"""
    
    @pytest.mark.asyncio
    async def test_structured_chat_litellm_success(self):
        """Test successful structured output via LiteLLM"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        
        mock_content = '{"title": "Test LiteLLM Title", "count": 7}'
        mock_message = MagicMock()
        mock_message.content = mock_content
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        mock_completion.model = 'github_copilot/gpt-4o'
        mock_completion.usage = MagicMock(
            prompt_tokens=80, completion_tokens=30, total_tokens=110
        )
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_completion
            
            result = await service.structured_chat(
                messages=[{"role": "user", "content": "Generate test data"}],
                output_schema=SimpleTestSchema
            )
            
            assert isinstance(result, SimpleTestSchema)
            assert result.title == "Test LiteLLM Title"
            assert result.count == 7
            
            mock_acompletion.assert_called_once()
            call_kwargs = mock_acompletion.call_args[1]
            assert call_kwargs['model'] == 'github_copilot/gpt-4o'
            assert call_kwargs['response_format'] == SimpleTestSchema
    
    @pytest.mark.asyncio
    async def test_structured_chat_litellm_empty_content(self):
        """Test LiteLLM backend handles empty content"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        
        mock_message = MagicMock()
        mock_message.content = ""
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_completion
            
            with pytest.raises(LLMUnavailableError, match="empty content"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_structured_chat_litellm_invalid_json(self):
        """Test LiteLLM backend handles invalid JSON from LLM"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        
        mock_message = MagicMock()
        mock_message.content = "This is not JSON at all"
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.return_value = mock_completion
            
            with pytest.raises(LLMUnavailableError, match="parse"):
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
        
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
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
        
        service = LLMService(api_key='test-key', timeout=30, backend='openai')
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
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
        
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = RateLimitError(
                message="Rate limit exceeded", response=MagicMock(), body={}
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
        
        service = LLMService(api_key='invalid-key', backend='openai')
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
        ) as mock_parse:
            mock_parse.side_effect = AuthenticationError(
                message="Invalid API key", response=MagicMock(), body={}
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
        
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(
            service._client.beta.chat.completions, 'parse', new_callable=AsyncMock
        ) as mock_parse:
            original_error = BadRequestError(
                message="Invalid schema", response=MagicMock(), body={}
            )
            mock_parse.side_effect = original_error
            
            with pytest.raises(BadRequestError):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_litellm_timeout_error_mapping(self):
        """Test LiteLLM timeout maps to LLMTimeoutError"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.side_effect = Exception("Request timeout after 60s")
            
            with pytest.raises(LLMTimeoutError, match="timed out"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
    
    @pytest.mark.asyncio
    async def test_litellm_connection_error_mapping(self):
        """Test LiteLLM connection error maps to LLMUnavailableError"""
        service = LLMService(model='github_copilot/gpt-4o', backend='litellm')
        service._fallback_models = []  # no fallbacks for this test
        
        with patch('litellm.acompletion', new_callable=AsyncMock) as mock_acompletion:
            mock_acompletion.side_effect = Exception("Connection refused")
            
            with pytest.raises(LLMUnavailableError, match="connection"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )


class TestLLMServiceFallbackChain:
    """Test LiteLLM model fallback chain"""
    
    @pytest.mark.asyncio
    async def test_fallback_to_second_model(self):
        """Test that failure on primary model falls back to second"""
        service = LLMService(model='github_copilot/claude-sonnet-4', backend='litellm')
        service._fallback_models = ['github_copilot/gpt-4o', 'github_copilot/gpt-4o-mini']
        
        mock_content = '{"title": "Fallback Title", "count": 3}'
        mock_message = MagicMock()
        mock_message.content = mock_content
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        mock_completion.model = 'github_copilot/gpt-4o'
        mock_completion.usage = MagicMock(prompt_tokens=50, completion_tokens=20, total_tokens=70)
        
        call_count = 0
        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            if kwargs['model'] == 'github_copilot/claude-sonnet-4':
                raise Exception("Connection timeout")
            return mock_completion
        
        with patch('litellm.acompletion', side_effect=mock_acompletion):
            result = await service.structured_chat(
                messages=[{"role": "user", "content": "Test"}],
                output_schema=SimpleTestSchema
            )
            
            assert isinstance(result, SimpleTestSchema)
            assert result.title == "Fallback Title"
            assert call_count == 2  # tried primary, then first fallback
    
    @pytest.mark.asyncio
    async def test_fallback_exhausts_all_models(self):
        """Test that all models are tried before giving up"""
        service = LLMService(model='model-a', backend='litellm')
        service._fallback_models = ['model-b', 'model-c']
        
        call_count = 0
        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            raise Exception("Connection refused for all")
        
        with patch('litellm.acompletion', side_effect=mock_acompletion):
            with pytest.raises(LLMUnavailableError, match="connection"):
                await service.structured_chat(
                    messages=[{"role": "user", "content": "Test"}],
                    output_schema=SimpleTestSchema
                )
            
            assert call_count == 3  # tried all three models
    
    @pytest.mark.asyncio
    async def test_primary_succeeds_no_fallback(self):
        """Test that successful primary model skips fallbacks"""
        service = LLMService(model='github_copilot/claude-sonnet-4', backend='litellm')
        service._fallback_models = ['github_copilot/gpt-4o']
        
        mock_content = '{"title": "Primary Title", "count": 1}'
        mock_message = MagicMock()
        mock_message.content = mock_content
        mock_choice = MagicMock()
        mock_choice.message = mock_message
        mock_completion = MagicMock()
        mock_completion.choices = [mock_choice]
        mock_completion.model = 'github_copilot/claude-sonnet-4'
        mock_completion.usage = MagicMock(prompt_tokens=50, completion_tokens=20, total_tokens=70)
        
        call_count = 0
        async def mock_acompletion(**kwargs):
            nonlocal call_count
            call_count += 1
            return mock_completion
        
        with patch('litellm.acompletion', side_effect=mock_acompletion):
            result = await service.structured_chat(
                messages=[{"role": "user", "content": "Test"}],
                output_schema=SimpleTestSchema
            )
            
            assert result.title == "Primary Title"
            assert call_count == 1  # only primary was called
    
    def test_fallback_chain_deduplication(self):
        """Test that fallback chain deduplicates the primary model"""
        with patch.dict(os.environ, {"LITELLM_FALLBACK_MODELS": "github_copilot/gpt-4o,github_copilot/claude-sonnet-4,github_copilot/gpt-4o"}):
            from importlib import reload

            import llm_service
            reload(llm_service)
            
            service = llm_service.LLMService(model='github_copilot/gpt-4o', backend='litellm')
            # Primary is gpt-4o, so it should be removed from fallbacks
            assert 'github_copilot/gpt-4o' not in service._fallback_models
            assert 'github_copilot/claude-sonnet-4' in service._fallback_models


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
        service = LLMService(api_key='test-key', backend='openai')
        
        with patch.object(service._client, 'close', new_callable=AsyncMock) as mock_close:
            await service.close()
            mock_close.assert_called_once()
