import csv, json
from collections import Counter

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Check Incident Type as category proxy
inc_types = Counter(r.get('Incident Type*', '') for r in rows)
print(f'Incident Types: {dict(inc_types.most_common(10))}')

# Map Incident Type to our categories
TYPE_MAP = {
    'User Service Request': 'Service Request',
    'Infrastructure Event': 'Event NO Customer Impact',
    'User Service Restoration': 'Failure',
}

# Get the groups that exist in our current dataset
with open('datasets/ticket_routing.json') as f:
    existing = json.load(f)
existing_groups = set(d['assigned_group'] for d in existing)
print(f'\nExisting groups in JSON: {len(existing_groups)}')

# Find CSV rows that match our groups
matching = [r for r in rows if r.get('Assigned Group*+', '').strip() in existing_groups]
print(f'CSV rows matching existing groups: {len(matching)}')

# For each group, count how many CSV rows we have
groups = Counter(r.get('Assigned Group*+', '').strip() for r in matching)
print(f'\nCSV data per existing group:')
for g in sorted(existing_groups):
    csv_count = groups.get(g, 0)
    existing_count = sum(1 for d in existing if d['assigned_group'] == g)
    print(f'  {csv_count:4d} CSV | {existing_count:2d} JSON | {g}')

# Generate new JSON from CSV - take up to 5 per group for underrepresented ones
new_tickets = []
for group in existing_groups:
    group_rows = [r for r in rows if r.get('Assigned Group*+', '').strip() == group]
    existing_count = sum(1 for d in existing if d['assigned_group'] == group)
    need = max(0, 5 - existing_count)  # Want at least 5 per group
    
    for r in group_rows[:need]:
        summary = r.get('Summary*', '').strip()
        if not summary or len(summary) < 3:
            continue
        inc_type = r.get('Incident Type*', '').strip()
        category = TYPE_MAP.get(inc_type, 'Service Request')
        priority = r.get('Priority*', 'Standard').strip()
        if priority not in ('Standard', 'Medium', 'High'):
            priority = 'Standard'
        
        # Skip if already in existing
        if any(d['summary'] == summary for d in existing):
            continue
        
        new_tickets.append({
            'summary': summary,
            'category': category,
            'priority': priority,
            'assigned_group': group,
        })

print(f'\nNew tickets to add: {len(new_tickets)}')
for t in new_tickets[:10]:
    print(f'  {t["assigned_group"]:40s} | {t["category"]:20s} | {t["priority"]:10s} | {t["summary"][:50]}')
if len(new_tickets) > 10:
    print(f'  ... and {len(new_tickets) - 10} more')

# Write updated dataset
existing.extend(new_tickets)
with open('datasets/ticket_routing.json', 'w') as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)
print(f'\nUpdated dataset: {len(existing)} tickets (was {len(existing) - len(new_tickets)})')

# Final stats
final_groups = Counter(d['assigned_group'] for d in existing)
single = sum(1 for c in final_groups.values() if c == 1)
print(f'Groups with only 1 example: {single} (was 14)')
