with open('frontend/src/pages/Calendar.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()
for i, line in enumerate(lines):
    l = line.lower()
    if any(k in l for k in ['activedaymodal', 'spends', 'debts', 'application', 'interview']):
        clean = line.strip()[:100].encode('ascii', errors='replace').decode('ascii')
        print(f'{i+1}: {clean}')
