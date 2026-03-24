import csv
from collections import Counter

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

print(f'Total rows: {len(rows)}')
sample = rows[0]
for col in ['Summary*', 'Category', 'Priority*', 'Assigned Group*+', 'Incident Type*']:
    val = sample.get(col, 'NOT FOUND')
    print(f'  {col}: {str(val)[:60]}')

cats = Counter(r.get('Category', '') for r in rows)
prios = Counter(r.get('Priority*', '') for r in rows)
groups = Counter(r.get('Assigned Group*+', '') for r in rows)

print(f'\nCategories: {dict(cats.most_common(5))}')
print(f'Priorities: {dict(prios.most_common(5))}')
print(f'\nGroups ({len(groups)}):')
for g, c in groups.most_common(25):
    print(f'  {c:4d} {g}')
