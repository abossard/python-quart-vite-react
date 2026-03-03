# KBA Guidelines

This directory contains **Knowledge Base Article (KBA) guidelines** in Markdown format.

## Purpose

Guidelines are loaded by the KBA Drafter service to provide context to the LLM during draft generation.

## Structure

### System Guidelines (`system/`)
**Always loaded**, numbered for order:
- `00_system_role.md` - LLM persona and core principles
- `10_kba_structure.md` - Required fields and format
- `20_writing_style.md` - Language and tone rules
- `30_quality_checks.md` - Validation criteria
- `40_publish_rules.md` - Publishing workflow

### Category Guidelines (`categories/`)
**Selectively loaded** based on ticket categorization:
- `GENERAL.md` - Universal guidelines (fallback)
- `VPN.md` - VPN-specific troubleshooting
- `PASSWORD_RESET.md` - Password/account management
- `NETWORK.md` - Network connectivity

## Frontmatter Format

Guidelines support optional YAML frontmatter:

\`\`\`markdown
---
title: System Role & Persona
version: 1.0.0
enabled: true
priority: 0
---

# Guideline Content
...
\`\`\`

## Usage

\`\`\`python
from guidelines_loader import GuidelinesLoader

loader = GuidelinesLoader()

# Load all system guidelines (ordered by filename)
system_context = loader.load_system_guidelines()

# Load specific category guideline  
vpn_content = loader.load_guideline("VPN")

# Auto-detect from ticket and combine
categories = loader.detect_categories_from_ticket(ticket)
combined = loader.get_combined(categories)

# Full context: system + categories
full_context = loader.get_full_context(ticket)
\`\`\`

## Adding New Guidelines

### System Guideline
1. Create \`system/NN_name.md\` (NN = priority, e.g., 50_new_rule.md)
2. Add YAML frontmatter (optional)
3. Will be auto-loaded in alphabetical order

### Category Guideline
1. Create \`categories/CATEGORY_NAME.md\`
2. Add mapping in \`backend/guidelines_loader.py\` → \`CATEGORY_MAP\`
3. Will be loaded when ticket matches category
