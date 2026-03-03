# KBA Drafter - OpenAI Integration

## Overview

The KBA Drafter uses **OpenAI's native structured output** feature to generate Knowledge Base Articles from support tickets. This replaces the previous Ollama-based implementation.

## Configuration

### Required Environment Variables

Add to `.env`:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-proj-...

# Model (required - must support structured output)
OPENAI_MODEL=gpt-4o-mini
```

### Supported Models

The KBA Drafter requires models that support OpenAI's `beta.chat.completions.parse()` feature:

- ✅ `gpt-4o-mini` (recommended - cost-effective)
- ✅ `gpt-4o`
- ✅ `gpt-4o-2024-08-06` or newer

❌ **Not supported:**
- `gpt-3.5-turbo`
- `gpt-4` (older versions)
- Any model released before August 2024

## How Structured Output Works

### 1. Pydantic Schema Definition

The KBA output structure is defined as a Pydantic model in `backend/kba_output_models.py`:

```python
class KBAOutputSchema(BaseModel):
    """Schema for LLM-generated KBA content"""
    
    title: str = Field(min_length=10, max_length=200)
    symptoms: list[str] = Field(min_length=1)
    resolution_steps: list[str] = Field(min_length=1)
    tags: list[str] = Field(min_length=2, max_length=10)
    # ... more fields
```

### 2. OpenAI Native Parsing

The LLM service (`backend/llm_service.py`) uses OpenAI's native structured output:

```python
completion = await client.beta.chat.completions.parse(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": prompt}],
    response_format=KBAOutputSchema  # Pydantic model
)

# Returns validated Pydantic object
result = completion.choices[0].message.parsed
```

**Benefits:**
- ✅ Automatic JSON parsing (no regex needed)
- ✅ Guaranteed schema compliance
- ✅ Built-in Pydantic validation
- ✅ No manual retry logic needed
- ✅ Type-safe output

### 3. Validation Flow

```
Ticket Data → Prompt Builder → OpenAI API
                                    ↓
                            Structured Output
                                    ↓
                            Pydantic Validation
                                    ↓
                      @field_validator checks
                                    ↓
                            KBADraft object
```

**Validation Layers:**

1. **OpenAI Schema Enforcement:** API ensures JSON structure matches Pydantic model
2. **Pydantic Type Validation:** Checks field types (str, list, int, etc.)
3. **Field Validators:** Custom validation rules:
   - `symptoms`: Each ≥10 characters
   - `resolution_steps`: Each ≥10 characters
   - `tags`: Lowercase alphanumeric with hyphens, ≥2 characters
   - `related_tickets`: Must match `INC0001234` format

## Error Handling

The LLM service maps OpenAI exceptions to custom KBA exceptions:

| OpenAI Exception | KBA Exception | HTTP Status | Description |
|------------------|---------------|-------------|-------------|
| `APIConnectionError` | `LLMUnavailableError` | 503 | Cannot reach OpenAI API |
| `APITimeoutError` | `LLMTimeoutError` | 504 | Request timeout (default 60s) |
| `RateLimitError` | `LLMRateLimitError` | 429 | Rate limit exceeded |
| `AuthenticationError` | `LLMAuthenticationError` | 401 | Invalid API key |
| `BadRequestError` | (preserved) | 400 | Schema/request error |

Error handlers are defined in `backend/app.py`.

## Architecture

### Service Layer

```
kba_service.py (Orchestrator)
    ↓
llm_service.py (OpenAI Client)
    ↓
kba_output_models.py (Pydantic Schema)
    ↓
OpenAI API (beta.chat.completions.parse)
```

### Key Components

| Component | Purpose |
|-----------|---------|
| `llm_service.py` | OpenAI AsyncClient wrapper, structured output |
| `kba_output_models.py` | Pydantic models for validation |
| `kba_service.py` | Business logic, orchestration |
| `kba_exceptions.py` | Custom exceptions |
| `kba_prompts.py` | Prompt engineering |

### Singleton Pattern

The LLM service uses a singleton pattern for efficiency:

```python
from llm_service import get_llm_service

llm = get_llm_service()  # Reuses same instance
```

## Testing

### Unit Tests

Run KBA Drafter tests:

```bash
cd backend
pytest tests/test_llm_service.py -v
pytest tests/test_kba_schema.py -v
pytest tests/test_kba_publishing.py -v
```

### Health Check

Check if OpenAI API is accessible:

```bash
curl http://localhost:5000/api/kba/health
```

Expected response:
```json
{
  "llm_available": true,
  "llm_provider": "openai",
  "model": "gpt-4o-mini"
}
```

### Generate Test KBA

```bash
curl -X POST http://localhost:5000/api/kba/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "INC0001234",
    "user_id": "test@example.com"
  }'
```

## Migration from Ollama

### What Changed

**Removed:**
- ❌ `ollama_service.py` → deprecated
- ❌ `ollama_structured_output.py` → deprecated
- ❌ Manual JSON parsing with regex
- ❌ Retry logic with repair prompts
- ❌ `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT` env vars

**Added:**
- ✅ `llm_service.py` - OpenAI client
- ✅ `kba_output_models.py` - Pydantic schemas
- ✅ Native structured output
- ✅ `OPENAI_API_KEY`, `OPENAI_MODEL` env vars

**Unchanged:**
- ✅ Datenmodelle (`kba_models.py`)
- ✅ Business-Logik (`kba_service.py` orchestration)
- ✅ Audit-Logging (`kba_audit.py`)
- ✅ Publish-Flow (`kb_adapters.py`)
- ✅ UI-Flow (Frontend)

### Configuration Update

**Old (.env):**
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2:1b
OLLAMA_TIMEOUT=60
```

**New (.env):**
```bash
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
```

## Troubleshooting

### "OPENAI_API_KEY not configured"

**Cause:** Missing or empty `OPENAI_API_KEY` in `.env`

**Solution:**
1. Get API key from https://platform.openai.com/api-keys
2. Add to `.env`: `OPENAI_API_KEY=sk-proj-...`
3. Restart backend

### "LLM rate limit exceeded"

**Cause:** Too many API requests in short time

**Solutions:**
- Wait 60 seconds and retry
- Check OpenAI dashboard for rate limits
- Upgrade OpenAI plan if needed

### "LLM request timed out"

**Cause:** Request took > 60 seconds (default timeout)

**Solutions:**
- Retry request (transient issue)
- Check OpenAI status page
- Simplify prompt if too long

### Invalid Model Error

**Cause:** Using unsupported model (e.g., `gpt-3.5-turbo`)

**Solution:** Update `.env` to use supported model:
```bash
OPENAI_MODEL=gpt-4o-mini
```

### Pydantic Validation Errors

**Cause:** LLM output doesn't match expected schema

These should be rare with OpenAI's structured output. If persistent:
1. Check prompt in `kba_prompts.py`
2. Review schema in `kba_output_models.py`
3. Check OpenAI dashboard for model issues

## Cost Considerations

### Token Usage

Typical KBA generation:
- **Prompt:** ~1,000-2,000 tokens (ticket + guidelines + schema)
- **Completion:** ~500-1,000 tokens (KBA content)
- **Total:** ~1,500-3,000 tokens per generation

### Pricing (as of 2024)

**gpt-4o-mini** (recommended):
- Input: $0.150 per 1M tokens
- Output: $0.600 per 1M tokens
- ~$0.0015 per KBA generation

**gpt-4o**:
- Input: $5.00 per 1M tokens
- Output: $15.00 per 1M tokens
- ~$0.05 per KBA generation

**Recommendation:** Use `gpt-4o-mini` for cost-effectiveness. Quality is sufficient for most KBAs.

## References

- [OpenAI Structured Outputs](https://platform.openai.com/docs/guides/structured-outputs)
- [Pydantic Documentation](https://docs.pydantic.dev/)
- [KBA Drafter Implementation](./KBA_DRAFTER_IMPLEMENTATION.md)
- [KBA Drafter Quickstart](./KBA_DRAFTER_QUICKSTART.md)
