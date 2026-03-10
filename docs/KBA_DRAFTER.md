# KBA Drafter - Documentation

## Overview

The KBA Drafter is an LLM-powered Knowledge Base Article generator that uses **OpenAI** to automatically create structured KBA drafts from support tickets.

## Architecture

### Backend Components

```
backend/
├── llm_service.py            # OpenAI client with structured output
├── kba_service.py            # Core business logic
├── kba_models.py             # Pydantic data models
├── kba_schemas.py            # JSON Schema for LLM validation
├── kba_prompts.py            # Prompt engineering
├── kba_audit.py              # Audit logging service
├── kba_exceptions.py         # Custom exceptions
├── guidelines_loader.py      # Load .md guideline files
└── operations.py             # REST/MCP operations (@operation decorator)
```

### Frontend Components

```
frontend/src/features/kba-drafter/
└── KBADrafterPage.jsx        # Main UI (input, editor, list)
```

### Guidelines System

```
docs/kba_guidelines/
├── README.md                 # System overview
├── GENERAL.md                # Universal KBA structure
├── VPN.md                    # VPN-specific patterns
├── PASSWORD_RESET.md         # Password/account procedures
└── NETWORK.md                # Network diagnostics
```

## Data Models

### KBADraft

```python
{
  "id": "uuid",
  "incident_id": "INC123456",
  "ticket_uuid": "550e8400-...",
  "title": "VPN Connection Issues on Windows",
  "problem_description": "...",
  "solution_steps": ["Step 1", "Step 2", ...],
  "additional_notes": "...",
  "tags": ["VPN", "Windows", "Network"],
  "status": "draft|reviewed|published|failed",
  "created_by": "user@example.com",
  "reviewed_by": null,
  "llm_generation_time_ms": 1234,
  "created_at": "2025-01-15T10:00:00Z"
}
```

## Workflow

1. **Input**: User enters ticket UUID
2. **Data Loading**: Backend fetches ticket from CSV (`csv/data.csv`)
3. **Context Building**: 
   - Load relevant guidelines based on ticket categorization
   - Build prompt with ticket data + guidelines + JSON schema
4. **LLM Generation**: Send to OpenAI (gpt-4o-mini)
   - Uses native structured output via beta.chat.completions.parse()
   - Automatic validation and retry
5. **Parsing**: Extract validated output from OpenAI
6. **Save**: Store draft in database (`backend/data/kba.db`)
7. **Review**: User reviews and edits draft
8. **Publish**: Export to target system (file/SharePoint/etc.)

## API Endpoints

### Generate Draft
```http
POST /api/kba/drafts
Content-Type: application/json

{
  "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "user@example.com"
}
```

### Get Draft
```http
GET /api/kba/drafts/{draft_id}
```

### Update Draft
```http
PATCH /api/kba/drafts/{draft_id}
Content-Type: application/json

{
  "title": "Updated title",
  "user_id": "user@example.com"
}
```

### Publish Draft
```http
POST /api/kba/drafts/{draft_id}/publish
Content-Type: application/json

{
  "target_system": "file",
  "user_id": "user@example.com"
}
```

### List Drafts
```http
GET /api/kba/drafts?status=draft&limit=10
```

### Audit Trail
```http
GET /api/kba/drafts/{draft_id}/audit
```

### Guidelines
```http
GET /api/kba/guidelines
GET /api/kba/guidelines/{category}
```

### Health Check
```http
GET /api/kba/health
```

## Configuration

### Environment Variables (.env)

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini
```

### OpenAI Setup

1. Get API key from: https://platform.openai.com/api-keys
2. Add to `.env` file
3. Verify:
   ```bash
   curl http://localhost:5001/api/kba/health
   ```

## Guidelines System

Guidelines are markdown files in `docs/kba_guidelines/` that provide LLM context:

### Structure
- **Frontmatter**: Metadata (category, priority, tags)
- **Content**: Instructions, patterns, examples

### Auto-Detection
The system automatically loads relevant guidelines based on:
- Ticket categorization (Tier 1/2/3)
- Keywords in summary/description
- Configurable mappings in `guidelines_loader.py`

### Creating New Guidelines

1. Create `.md` file in `docs/kba_guidelines/`
2. Add frontmatter:
   ```markdown
   ---
   category: EMAIL
   priority: 10
   tags: [outlook, exchange, email]
   ---
   ```
3. Add content with examples
4. Update `CATEGORY_MAP` in `guidelines_loader.py`

## Prompt Engineering

The system uses a structured prompt format:

```
# TASK
Generate a Knowledge Base Article from this support ticket.

# TICKET DATA
{ticket information}

# GUIDELINES
{relevant guidelines}

# OUTPUT FORMAT
{JSON schema}

# INSTRUCTIONS
- Follow the guidelines precisely
- Extract root cause analysis
- Provide actionable steps
- Use clear, concise language
```

## Error Handling

### Retry Logic
- 3 attempts with exponential backoff
- Error feedback loop (LLM sees validation errors)
- Fallback parsing strategies

### Exception Hierarchy
```
KBAException
├── KBANotFoundException
├── KBAServiceException
│   ├── LLMUnavailableError
│   └── InvalidLLMOutputError
└── KBAValidationException
```

## Audit Logging

Every action is logged to audit trail:

```python
{
  "event_type": "draft_created|draft_updated|...",
  "user_id": "user@example.com",
  "draft_id": "uuid",
  "changes": {"field": "old -> new"},
  "metadata": {"llm_model": "gpt-4o-mini"},
  "timestamp": "2025-01-15T10:00:00Z"
}
```

## Testing

### Backend Tests
```bash
cd backend
pytest tests/test_kba_*.py -v
```

### Frontend Tests
```bash
cd frontend
npm test
```

### E2E Tests
```bash
npx playwright test tests/e2e/kba-drafter.spec.js
```

## Security Considerations

1. **Input Validation**: All inputs validated via Pydantic
2. **SQL Injection**: SQLModel prevents SQL injection
3. **XSS**: React auto-escapes output
4. **Audit Trail**: All changes logged with user ID
5. **API Key Security**: Store OpenAI API key in `.env` (never commit)

## Performance

- **Typical Generation Time**: 2-5 seconds (gpt-4o-mini)
- **Database**: SQLite (production: PostgreSQL recommended)
- **Caching**: Guidelines cached in memory
- **Concurrency**: Async/await throughout

## Troubleshooting

### LLM Not Available
```bash
# Check OpenAI API key is set
echo $OPENAI_API_KEY

# Test health endpoint
curl http://localhost:5001/api/kba/health
```

### LLM Generation Errors
- Check prompt length (model context limit)
- Verify JSON schema validity
- Review audit trail for error details

### Frontend Issues
- Check browser console for API errors
- Verify backend is running
- Check CORS configuration

## Future Enhancements

- [ ] Multi-language support
- [ ] SharePoint integration
- [ ] Advanced search/filter
- [ ] Batch generation
- [ ] Template customization
- [ ] A/B testing different prompts
- [ ] Fine-tuned models

## References

- **OpenAI**: https://platform.openai.com/docs
- **Pydantic**: https://docs.pydantic.dev/
- **Quart**: https://quart.palletsprojects.com/
- **FluentUI**: https://react.fluentui.dev/
