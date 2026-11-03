from manual import parse_and_store
from db import get_conn
from spends import spend_brief, summary
from people import people_brief, get_person

# Clear previous test entries (optional — comment out if you want to keep)
# conn = get_conn(); conn.execute("DELETE FROM spends WHERE merchant IN ('swiggy','amazon','coffee')"); conn.commit(); conn.close()

tests = [
    "spent 340 swiggy lunch",
    "spent 180 auto ride",
    "spent 900 amazon shopping",
    "spent 250 coffee",
    "budget food 3000",
    "person Priya: got new job",
    "met Priya: marathon training",
    "birthday Priya: 11-15",
]

print("=" * 60)
print("PARSING ENTRIES")
print("=" * 60)
for t in tests:
    ok = parse_and_store(t)
    print(f"  {t!r} → {'✓' if ok else '✗'}")

print()
print("=" * 60)
print("DB STATE")
print("=" * 60)
c = get_conn()
print("spends:", c.execute("SELECT COUNT(*) FROM spends").fetchone()[0])
print("people:", c.execute("SELECT COUNT(*) FROM people").fetchone()[0])
print("person_facts:", c.execute("SELECT COUNT(*) FROM person_facts").fetchone()[0])
print("budgets:", c.execute("SELECT COUNT(*) FROM budgets").fetchone()[0])
print()

print("=== Money brief ===")
sb = spend_brief()
print(f"Week total: ₹{sb['week_total']}")
print(f"Month total: ₹{sb['month_total']}")
for cat in sb["week_by_category"]:
    print(f"  {cat['category']}: ₹{cat['total']} ({cat['count']})")
print()

print("=== People brief ===")
pb = people_brief()
print(f"Total people: {pb['total']}")
print("Birthdays:", pb["upcoming_birthdays"])
print("Needing contact:", pb["needing_contact"])
print()

print("=== Priya profile ===")
p = get_person("Priya")
if p:
    print(f"Name: {p['name']}, birthday: {p['birthday']}")
    for f in p["facts"]:
        print(f"  - [{f['category']}] {f['fact']}")
else:
    print("Priya not found")
c.close()