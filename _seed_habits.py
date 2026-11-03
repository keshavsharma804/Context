import json
import urllib.request

BASE = "http://127.0.0.1:3000/api"


def call(path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        BASE + path,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST" if data else "GET",
    )
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read().decode())


result = call("/habits/update", {"name": "gym", "emoji": "💪"})
print("gym emoji:", result["habit"]["emoji"])

# A little history for a readable heatmap (all real rows, no UI-only fixture).
for day, status in (
    ("2026-10-18", "done"),
    ("2026-10-19", "done"),
    ("2026-10-20", "skipped"),
    ("2026-10-21", "done"),
    ("2026-10-22", "done"),
    ("2026-10-23", "skipped"),
    ("2026-10-24", "done"),
    ("2026-10-25", "done"),
    ("2026-10-26", "skipped"),
):
    call("/habits/log", {"name": "gym", "date": day, "status": status})

# A habit with no logs yet, to show the honest empty-data state in the drawer.
call("/habits/add", {"name": "meditation", "emoji": "🧘", "color": "#14b8a6", "target_per_week": 5})

# Remove the two ₹40 verification spends made by capture tests.
from db import get_conn  # noqa: E402

conn = get_conn()
rows = conn.execute(
    "SELECT id FROM spends WHERE amount = 40 AND merchant = 'coffee'"
).fetchall()
ids = [row["id"] for row in rows]
if ids:
    conn.execute(
        f"DELETE FROM spends WHERE id IN ({','.join('?' for _ in ids)})", ids
    )
    conn.commit()
conn.close()
print("deleted test spends:", len(ids))

data = call("/habits")
for habit in data["habits"]:
    print(habit["name"], habit["emoji"], habit["streak"], habit["completion_this_week"])
print("insights:", data["insights"])
