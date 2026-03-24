import csv, json
from collections import Counter

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Map Incident Type to our categories
TYPE_MAP = {
    'User Service Request': 'Service Request',
    'Infrastructure Event': 'Event NO Customer Impact',
    'User Service Restoration': 'Failure',
}

# Get the groups we want
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
    """Build a rich summary from multiple CSV fields."""
    parts = []
    
    # Original summary/title
    summary = str(row.get('Summary*', '')).strip()
    if summary:
        parts.append(summary)
    
    # Notes (the actual ticket description - most valuable)
    notes = str(row.get('Notes', '')).strip()
    # Remove the summary if it's duplicated at the start of notes
    if notes and summary and notes.startswith(summary):
        notes = notes[len(summary):].strip()
    if notes and len(notes) > 5:
        # Truncate to reasonable length
        if len(notes) > 200:
            notes = notes[:200] + '...'
        parts.append(notes)
    
    # Service name (gives routing context)
    service = str(row.get('Service*+', '')).strip()
    if service and service != summary:
        parts.append(f'[Service: {service}]')
    
    # Product categorization (gives domain context)
    prod3 = str(row.get('Product Categorization Tier 3', '')).strip()
    if prod3:
        parts.append(f'[Produkt: {prod3}]')
    
    return ' | '.join(parts) if parts else summary

# Build new dataset
tickets = []
seen_summaries = set()

for row in rows:
    group = str(row.get('Assigned Group*+', '')).strip()
    if group not in TARGET_GROUPS:
        continue
    
    rich_summary = build_summary(row)
    if not rich_summary or len(rich_summary) < 5:
        continue
    
    # Deduplicate
    if rich_summary in seen_summaries:
        continue
    seen_summaries.add(rich_summary)
    
    inc_type = str(row.get('Incident Type*', '')).strip()
    category = TYPE_MAP.get(inc_type, 'Service Request')
    priority = str(row.get('Priority*', 'Standard')).strip()
    if priority not in ('Standard', 'Medium', 'High'):
        priority = 'Standard'
    
    tickets.append({
        'summary': rich_summary,
        'category': category,
        'priority': priority,
        'assigned_group': group,
    })

# Balance: take up to 8 per group for well-represented groups, all for others
final_tickets = []
group_counts = Counter(t['assigned_group'] for t in tickets)

for group in TARGET_GROUPS:
    group_tickets = [t for t in tickets if t['assigned_group'] == group]
    max_per_group = 8 if group_counts.get(group, 0) > 8 else len(group_tickets)
    final_tickets.extend(group_tickets[:max_per_group])

# Write
with open('datasets/ticket_routing.json', 'w') as f:
    json.dump(final_tickets, f, indent=2, ensure_ascii=False)

print(f'Total tickets: {len(final_tickets)}')
final_groups = Counter(t['assigned_group'] for t in final_tickets)
for g, c in final_groups.most_common():
    print(f'  {c:3d} {g}')

# Show some examples
print(f'\n━━━ Sample tickets ━━━')
for t in final_tickets[:5]:
    print(f'\n  Group: {t["assigned_group"]}')
    print(f'  Cat: {t["category"]} | Prio: {t["priority"]}')
    print(f'  Summary: {t["summary"][:150]}')
