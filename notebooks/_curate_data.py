import csv, json
from collections import Counter

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

TYPE_MAP = {
    'User Service Request': 'Service Request',
    'Infrastructure Event': 'Event NO Customer Impact',
    'User Service Restoration': 'Failure',
}

TARGET_GROUPS = [
    'SDE - Service Desk', 'OFC - Office & Collaboration', 'PRM - Premium Support',
    'CDC - Client Design & Standard SW Integration', 'OUM - Incident', 'Helpdesk',
    'Service-Center IKT', 'Service-Center IKT Bestellungen', 'Smartcard Office',
    'CBCD - Container Basierte Cloud Dienste', 'OPC - Applikationen', 'DevOps - Rein',
    'BVX - ePortal Service Line', 'IOM - Input / Output Mgmt.', 'OPM - DLC Dispatching',
    'O-SDK', 'ESTV-RSS-Stammdaten', 'FIB - BIT Store Bollwerk', 'Immobilien BAZG',
    'Bedarfsmanagement', 'Güter und Ausrüstung',
]

def build_summary(row):
    """Build a concise but informative summary."""
    parts = []
    summary = str(row.get('Summary*', '')).strip()
    if summary:
        parts.append(summary)
    
    # Add the key detail from notes (not the whole blob)
    notes = str(row.get('Notes', '')).strip()
    if notes and summary and notes.startswith(summary):
        notes = notes[len(summary):].strip()
    if notes and len(notes) > 5:
        # Take first sentence/clause only
        for sep in ['. ', '  ', '\n']:
            if sep in notes:
                notes = notes[:notes.index(sep)]
                break
        if len(notes) > 120:
            notes = notes[:120] + '...'
        if notes:
            parts.append(notes)
    
    # Company (strong routing signal — BAZG tickets go to specific groups)
    company = str(row.get('Company', '')).strip()
    if company and len(company) > 2:
        parts.append(f'[Firma: {company}]')
    
    # Service name (strongest predictor — 85% uncertainty reduction)
    service = str(row.get('Service*+', '')).strip()
    if service and len(service) > 2:
        parts.append(f'[Service: {service}]')
    
    # Product domain (Workplace vs ESTV vs Customer facing)
    prod2 = str(row.get('Product Categorization Tier 2', '')).strip()
    if prod2 and len(prod2) > 2:
        parts.append(f'[Bereich: {prod2}]')
    
    return ' — '.join(parts) if len(parts) > 1 else (parts[0] if parts else '')

def score_ticket(row):
    """Score how informative/interesting a ticket is for training."""
    score = 0
    notes = str(row.get('Notes', '')).strip()
    summary = str(row.get('Summary*', '')).strip()
    service = str(row.get('Service*+', '')).strip()
    
    if len(notes) > 20: score += 2  # Has real description
    if len(summary) > 10: score += 1  # Descriptive title
    if service: score += 1  # Has service context
    if any(kw in notes.lower() for kw in ['fehler', 'problem', 'kann nicht', 'geht nicht', 'funktioniert nicht', 'störung', 'ausfall', 'gesperrt', 'defekt']):
        score += 2  # Has error keywords
    if any(kw in notes.lower() for kw in ['bestell', 'anfrage', 'freischalt', 'zugang', 'berechtigung', 'neu', 'install']):
        score += 1  # Has request keywords
    return score

# Collect and score all matching tickets
all_tickets = []
for row in rows:
    group = str(row.get('Assigned Group*+', '')).strip()
    if group not in TARGET_GROUPS:
        continue
    
    rich_summary = build_summary(row)
    if not rich_summary or len(rich_summary) < 8:
        continue
    
    # Use Operational Categorization Tier 1 as the real category (100% filled, accurate)
    op_cat = str(row.get('Operational Categorization Tier 1+', '')).strip()
    if op_cat in ('Service Request', 'Failure', 'Event NO Customer Impact'):
        category = op_cat
    else:
        inc_type = str(row.get('Incident Type*', '')).strip()
        category = TYPE_MAP.get(inc_type, 'Service Request')
    priority = str(row.get('Priority*', 'Standard')).strip()
    if priority not in ('Standard', 'Medium', 'High'):
        priority = 'Standard'
    
    all_tickets.append({
        'summary': rich_summary,
        'category': category,
        'priority': priority,
        'assigned_group': group,
        '_score': score_ticket(row),
    })

# Pick the BEST tickets per group: 4 per group max, sorted by score
final_tickets = []
seen = set()
for group in TARGET_GROUPS:
    group_tickets = sorted(
        [t for t in all_tickets if t['assigned_group'] == group],
        key=lambda t: t['_score'],
        reverse=True
    )
    count = 0
    for t in group_tickets:
        if count >= 4:
            break
        # Skip near-duplicates
        short = t['summary'][:30]
        if short in seen:
            continue
        seen.add(short)
        ticket = {k: v for k, v in t.items() if not k.startswith('_')}
        final_tickets.append(ticket)
        count += 1

with open('datasets/ticket_routing.json', 'w') as f:
    json.dump(final_tickets, f, indent=2, ensure_ascii=False)

print(f'Total: {len(final_tickets)} curated tickets')
final_groups = Counter(t['assigned_group'] for t in final_tickets)
for g, c in sorted(final_groups.items(), key=lambda x: -x[1]):
    print(f'  {c} {g}')

print(f'\n━━━ Samples ━━━')
import random
for t in random.sample(final_tickets, min(8, len(final_tickets))):
    print(f'\n  [{t["assigned_group"]}] {t["category"]} / {t["priority"]}')
    print(f'  {t["summary"][:140]}')
