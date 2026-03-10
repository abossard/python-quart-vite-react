# KBA Drafter - Quick Start Guide

## Prerequisites

1. **Python 3.11+** installed
2. **Node.js 18+** installed
3. **OpenAI API Key** ([platform.openai.com/api-keys](https://platform.openai.com/api-keys))

## Installation

### 1. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Copy environment template
cp ../.env.example ../.env

# Install Python dependencies
pip install -r requirements.txt
```

### 2. OpenAI Configuration

Edit `.env` and add your OpenAI credentials:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-proj-your-key-here

# Model (required - must support structured output)
OPENAI_MODEL=gpt-4o-mini
```

**Get API Key:**
1. Go to [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Create new secret key
3. Copy key to `.env`

**Supported Models:**
- `gpt-4o-mini` (recommended - cost-effective)
- `gpt-4o` (higher quality, more expensive)

### 3. Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install Node dependencies
npm install
```

## Running the Application

### Terminal 1: Backend
```bash
cd backend
python app.py
```

Backend will start on: http://localhost:5000

### Terminal 2: Frontend
```bash
cd frontend
npm run dev
```

Frontend will start on: http://localhost:5173

## First Steps

1. **Open Browser**: Navigate to http://localhost:5173
2. **Click "KBA Drafter" Tab**: Second tab in navigation
3. **Check LLM Status**: Green badge = ready, Yellow = not available
4. **Enter Ticket UUID or INC Number**: Use a UUID or INC number from `csv/data.csv`
5. **Generate KBA**: Click "KBA Generieren" button
6. **Review & Edit**: Edit the generated draft
7. **Mark as Reviewed**: Click "Als geprüft markieren"
8. **Publish**: Click "Veröffentlichen" once reviewed

## Verify Installation

### Check OpenAI Connection

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

If `llm_available` is `false`:
- Check `OPENAI_API_KEY` in `.env`
- Verify key is valid at [platform.openai.com](https://platform.openai.com)
- Check OpenAI API status

## Configuration

### Environment Variables (.env)

```bash
# OpenAI Configuration (required)
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4o-mini

# Database (optional)
KBA_DATABASE_URL=sqlite:///./data/kba.db
```

### Changing the Model

Edit `.env`:

```bash
# Cost-effective (recommended)
OPENAI_MODEL=gpt-4o-mini

# Higher quality
OPENAI_MODEL=gpt-4o
```

**Model Requirements:**
- Must support OpenAI Structured Output
- Released after August 2024
- See [KBA_OPENAI_INTEGRATION.md](./KBA_OPENAI_INTEGRATION.md) for details

## Testing

### Test Backend API

```bash
# Health check
curl http://localhost:5000/api/kba/health

# List guidelines
curl http://localhost:5000/api/kba/guidelines

# Generate draft (replace UUID with real ticket UUID)
curl -X POST http://localhost:5000/api/kba/drafts \
  -H "Content-Type: application/json" \
  -d '{
    "ticket_id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "test@example.com"
  }'
```

### Test Frontend

1. Open DevTools Console (F12)
2. Generate a KBA draft
3. Check Network tab for API calls
4. Verify no errors in Console

## Troubleshooting

### Problem: "OPENAI_API_KEY not configured"

**Solution:**
1. Check `.env` file has `OPENAI_API_KEY=sk-proj-...`
2. Restart backend after editing `.env`
3. Verify key is valid at [platform.openai.com](https://platform.openai.com)

### Problem: "LLM service unavailable"

**Solution:**
```bash
# Check OpenAI API health
curl http://localhost:5000/api/kba/health

# Check OpenAI status page
# https://status.openai.com/
```

### Problem: "Rate limit exceeded"

**Solution:**
- Wait 60 seconds and retry
- Check your OpenAI usage at [platform.openai.com/usage](https://platform.openai.com/usage)
- Consider upgrading your OpenAI plan

### Problem: "Failed to generate KBA"

**Check:**
1. Backend logs for error details
2. OpenAI API key is valid
3. Ticket UUID exists in `csv/data.csv`
4. Guidelines files in `docs/kba_guidelines/`

### Problem: "Connection refused to backend"

**Solution:**
```bash
# Check backend is running
curl http://localhost:5000/api/health

# If not, start backend
cd backend && python app.py
```

### Problem: "Frontend blank page"

**Check:**
```bash
# Check npm is running
ps aux | grep vite

# If not, start frontend
cd frontend && npm run dev

# Check browser console for errors (F12)
```

## Architecture Overview

```
┌─────────────────┐
│   Frontend      │ React + FluentUI
│   (Port 5173)   │ 
└────────┬────────┘
         │ HTTP REST
         │
┌────────▼────────┐
│   Backend       │ Quart (async Flask)
│   (Port 5000)   │ 
└────────┬────────┘
         │
    ┌────┴────┬──────────┐
    │         │          │
┌───▼───┐ ┌──▼──────┐ ┌─▼────────┐
│ CSV   │ │ SQLite  │ │ OpenAI   │
│ Data  │ │  (KBA)  │ │ (LLM)    │
└───────┘ └─────────┘ └──────────┘
```

## Guidelines System

Guidelines are markdown files that provide context to the LLM:

```
docs/kba_guidelines/
├── GENERAL.md          # Always included
├── VPN.md              # VPN issues
├── PASSWORD_RESET.md   # Password/account
└── NETWORK.md          # Network issues
```

**Adding New Guidelines:**

1. Create `.md` file in `docs/kba_guidelines/`
2. Add frontmatter:
   ```markdown
   ---
   category: EMAIL
   priority: 10
   tags: [outlook, email]
   ---
   
   # Email Troubleshooting Guide
   ...
   ```
3. Update `CATEGORY_MAP` in `backend/guidelines_loader.py`

## Performance Tips

1. **Use gpt-4o-mini for cost-effectiveness**
2. **Guidelines caching**: Already implemented
3. **Database**: SQLite fine for <1000 drafts, use PostgreSQL for more

## Development Workflow

### Modifying Prompts

Edit `backend/kba_prompts.py`:

```python
def build_kba_prompt(...):
    return f"""
    # YOUR CUSTOM PROMPT
    ...
    """
```

### Adding New Fields

1. Update `backend/kba_models.py`:
   ```python
   class KBADraft(BaseModel):
       new_field: str = Field(description="...")
   ```

2. Update `backend/kba_schemas.py` JSON schema

3. Update prompt in `kba_prompts.py`

4. Update frontend `KBADrafterPage.jsx`

### Testing LLM Changes

```bash
# Use curl for quick tests
curl -X POST http://localhost:11434/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.2:1b",
    "prompt": "Generate a KBA for VPN issues",
    "stream": false
  }'
```

## Production Deployment

### Checklist

- [ ] Use PostgreSQL instead of SQLite
- [ ] Set proper CORS origins
- [ ] Use production WSGI server (hypercorn)
- [ ] Enable HTTPS
- [ ] Set up monitoring (audit logs)
- [ ] Configure backup for database
- [ ] Use larger LLM model for quality
- [ ] Add authentication/authorization
- [ ] Rate limiting on API

### Example Production Config

```bash
# .env.production
OPENAI_API_KEY=sk-proj-your-production-key
OPENAI_MODEL=gpt-4o
KBA_DATABASE_URL=postgresql://user:pass@db:5432/kba
```

## Next Steps

1. **Customize Guidelines**: Edit files in `docs/kba_guidelines/`
2. **Test with Real Data**: Use your actual ticket CSV
3. **Tune Prompts**: Adjust `kba_prompts.py` for your needs
4. **Add Categories**: Create category-specific guidelines
5. **Integrate Publishing**: Implement SharePoint/Confluence export

## Resources

- **Full Documentation**: [docs/KBA_DRAFTER.md](../docs/KBA_DRAFTER.md)
- **OpenAI Docs**: https://platform.openai.com/docs
- **Quart Docs**: https://quart.palletsprojects.com/
- **FluentUI**: https://react.fluentui.dev/

## Support

For issues:
1. Check backend terminal for errors
2. Check browser console (F12)
3. Review audit trail: `GET /api/kba/drafts/{id}/audit`
