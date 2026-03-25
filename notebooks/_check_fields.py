import csv

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Check which fields have useful content for the first ticket
sample = rows[0]
useful_fields = []
for key, val in sample.items():
    val = str(val).strip()
    if val and len(val) > 5 and len(val) < 500:
        useful_fields.append((key, val[:120]))

print(f"Fields with content (5-500 chars) in first row:")
for key, val in useful_fields[:40]:
    print(f"  {key:50s} | {val}")

# Check Notes and Resolution fields specifically
print(f"\n━━━ Key content fields ━━━")
for field in ['Summary*', 'Notes', 'Resolution', 'Operational Categorization Tier 1+', 
              'Operational Categorization Tier 2', 'Operational Categorization Tier 3',
              'Product Categorization Tier 1', 'Product Categorization Tier 2',
              'Product Categorization Tier 3', 'Service*+', 'CI+', 'Incident Type*',
              'Category', 'Short Description']:
    val = str(sample.get(field, '')).strip()
    print(f"  {field:50s} | {val[:150]}")

# Check a few more rows for Notes content
print(f"\n━━━ Notes samples ━━━")
for r in rows[:5]:
    summary = str(r.get('Summary*', '')).strip()[:40]
    notes = str(r.get('Notes', '')).strip()[:100]
    resolution = str(r.get('Resolution', '')).strip()[:100]
    short_desc = str(r.get('Short Description', '')).strip()[:100]
    op_cat1 = str(r.get('Operational Categorization Tier 1+', '')).strip()
    op_cat2 = str(r.get('Operational Categorization Tier 2', '')).strip()
    service = str(r.get('Service*+', '')).strip()[:60]
    product = str(r.get('Product Categorization Tier 1', '')).strip()
    print(f"\n  Summary: {summary}")
    print(f"  Notes: {notes}")
    print(f"  Resolution: {resolution}")
    print(f"  Short Desc: {short_desc}")
    print(f"  OpCat: {op_cat1} > {op_cat2}")
    print(f"  Service: {service}")
    print(f"  Product: {product}")
