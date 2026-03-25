import csv
from collections import Counter

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Fields we already use: Summary*, Notes, Service*+, Product Categorization Tier 3, Priority*, Assigned Group*+, Incident Type*
# What else could be interesting?

interesting = [
    # Organization context
    ('Company', 'Which department/org filed it'),
    ('Organization', 'Sub-org of the requester'),
    ('Support Organization', 'Support org handling it'),
    
    # Categorization
    ('Operational Categorization Tier 1+', 'OpCat level 1'),
    ('Operational Categorization Tier 2', 'OpCat level 2'),
    ('Operational Categorization Tier 3', 'OpCat level 3'),
    ('Product Categorization Tier 1', 'Product level 1'),
    ('Product Categorization Tier 2', 'Product level 2'),
    ('Product Categorization Tier 3', 'Product level 3'),
    
    # Service info
    ('Service*+', 'Service name'),
    ('CI+', 'Configuration Item'),
    ('CI Name', 'CI readable name'),
    
    # Resolution (could teach what worked)
    ('Resolution', 'How it was resolved'),
    ('Resolution Categorization Tier 1', 'Resolution cat'),
    
    # Impact/urgency
    ('Urgency*', 'How urgent'),
    ('Impact*', 'How impactful'),
    
    # Source
    ('Reported Source', 'How was it reported'),
    
    # Status
    ('Status*', 'Current status'),
    ('Status Reason', 'Why this status'),
]

print("Field analysis (first 20 rows sampled):\n")
for field, desc in interesting:
    values = [str(r.get(field, '')).strip() for r in rows[:100] if str(r.get(field, '')).strip()]
    unique = len(set(values))
    if values:
        top = Counter(values).most_common(3)
        sample = values[0][:60]
        fill_rate = len(values) / min(100, len(rows))
        print(f"  {field:45s} | {fill_rate:3.0%} filled | {unique:3d} unique | {desc}")
        print(f"    Top: {", ".join(f"{v[:30]}({c})" for v,c in top)}")
        print()
