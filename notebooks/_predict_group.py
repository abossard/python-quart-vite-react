import csv
from collections import Counter, defaultdict
import math

with open('/Users/abossard/Desktop/projects/python-quart-vite-react/csv/data.csv', encoding='utf-8', errors='replace') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

TARGET_GROUPS = [
    'SDE - Service Desk', 'OFC - Office & Collaboration', 'PRM - Premium Support',
    'CDC - Client Design & Standard SW Integration', 'OUM - Incident', 'Helpdesk',
    'Service-Center IKT', 'Service-Center IKT Bestellungen', 'Smartcard Office',
    'CBCD - Container Basierte Cloud Dienste', 'OPC - Applikationen', 'DevOps - Rein',
    'BVX - ePortal Service Line', 'IOM - Input / Output Mgmt.', 'OPM - DLC Dispatching',
    'O-SDK', 'ESTV-RSS-Stammdaten', 'FIB - BIT Store Bollwerk', 'Immobilien BAZG',
    'Bedarfsmanagement',
]

matching = [r for r in rows if r.get('Assigned Group*+', '').strip() in TARGET_GROUPS]
print(f"Analyzing {len(matching)} rows matching target groups\n")

# For each candidate field, measure how well it predicts assigned_group
# using conditional entropy: H(group|field) — lower = more predictive
candidates = [
    'Service*+',
    'Product Categorization Tier 2', 
    'Product Categorization Tier 3',
    'Company',
    'Support Organization',
    'Operational Categorization Tier 1+',
    'Product Categorization Tier 1',
    'Reported Source',
]

def conditional_entropy(rows, field, target='Assigned Group*+'):
    """H(target|field) — how much uncertainty remains about target given field."""
    field_groups = defaultdict(list)
    for r in rows:
        fv = str(r.get(field, '')).strip()
        tv = str(r.get(target, '')).strip()
        if fv:
            field_groups[fv].append(tv)
    
    total = sum(len(v) for v in field_groups.values())
    h = 0
    for fv, targets in field_groups.items():
        p_field = len(targets) / total
        target_counts = Counter(targets)
        h_given = 0
        for c in target_counts.values():
            p = c / len(targets)
            if p > 0:
                h_given -= p * math.log2(p)
        h += p_field * h_given
    return h

# Unconditional entropy of assigned_group
group_counts = Counter(r.get('Assigned Group*+', '').strip() for r in matching)
h_group = -sum((c/len(matching)) * math.log2(c/len(matching)) for c in group_counts.values() if c > 0)
print(f"H(assigned_group) = {h_group:.2f} bits (baseline uncertainty)\n")

print(f"{'Field':50s} | H(group|field) | Reduction | Predictive power")
print("━" * 100)
results = []
for field in candidates:
    h_cond = conditional_entropy(matching, field)
    reduction = h_group - h_cond
    pct = reduction / h_group * 100
    results.append((field, h_cond, reduction, pct))

for field, h_cond, reduction, pct in sorted(results, key=lambda x: x[1]):
    bar = "█" * int(pct / 5) + "░" * (20 - int(pct / 5))
    print(f"  {field:48s} | {h_cond:6.2f}        | {reduction:+5.2f}     | [{bar}] {pct:.0f}%")

# Show the top field's mapping
print(f"\n━━━ Best predictor: Service*+ mapping to groups ━━━")
service_to_groups = defaultdict(Counter)
for r in matching:
    service = str(r.get('Service*+', '')).strip()
    group = str(r.get('Assigned Group*+', '')).strip()
    if service:
        service_to_groups[service][group] += 1

# Show services that map cleanly to one group
clean = 0
ambiguous = 0
for service, groups in sorted(service_to_groups.items(), key=lambda x: -sum(x[1].values()))[:15]:
    total = sum(groups.values())
    top_group, top_count = groups.most_common(1)[0]
    purity = top_count / total
    icon = "✅" if purity > 0.8 else "⚠️" if purity > 0.5 else "🔴"
    if purity > 0.8:
        clean += 1
    else:
        ambiguous += 1
    print(f"  {icon} {service:45s} → {top_group:35s} ({purity:.0%} of {total})")

print(f"\nClean mappings (>80%): {clean} | Ambiguous: {ambiguous}")
