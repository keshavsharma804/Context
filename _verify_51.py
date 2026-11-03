"""Phase 5.1 verification against the checklist."""
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
    try:
        with urllib.request.urlopen(req) as res:
            return res.status, json.loads(res.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode())


results = []


def check(label, condition, detail=""):
    results.append(("PASS" if condition else "FAIL", label, detail))


# 1. add habit
status, out = call("/habits/add", {"name": "gym", "emoji": "\U0001f4aa", "color": "#8b5cf6"})
check("POST /habits/add creates habit", status == 200 and out.get("ok") and out["habit"]["name"] == "gym", str(out)[:200])

# 2. log today done
status, out = call("/habits/log", {"name": "gym", "date": "today", "status": "done"})
check("POST /habits/log done today", status == 200 and out.get("ok"), str(out)[:200])

# 3. GET list shows streak + week completion
status, out = call("/habits")
habits = out.get("habits", []) if status == 200 else []
gym = next((h for h in habits if h["name"].lower() == "gym"), None)
check("GET /habits returns gym", gym is not None, str(habits)[:200])
check("streak >= 1 after logging", bool(gym) and gym["streak"] >= 1, f"streak={gym and gym['streak']}")
check("completion_this_week >= 1", bool(gym) and gym["completion_this_week"] >= 1, f"week={gym and gym['completion_this_week']}")
check("insights is a list", isinstance(out.get("insights"), list), str(out.get("insights"))[:200])

# 4. detail endpoint
status, out = call("/habits/gym")
check("GET /habits/{name} detail", status == 200 and out.get("ok") and "logs" in out.get("habit", {}), str(out)[:150])

# 5. NL capture tests
nl_cases = [
    ("did gym today", "logged_habit"),
    ("skipped reading", "logged_habit"),
    ("read 20 mins", "logged_habit"),
    ("no sugar today", "logged_habit"),
    ("how much did I spend this week?", None),
    ("I spent 40 on coffee", "logged_spend"),
    ("gym", "habit_question"),
]
for text, expected in nl_cases:
    status, out = call("/ask", {"question": text})
    kind = (out.get("action") or {}).get("kind")
    check(f"ask {text!r} -> {expected}", kind == expected, f"got {kind} | {str(out.get('answer'))[:90]}")

# 6. streak reset on skip: log 7 days then skip
from datetime import date, timedelta
today = date.today()
for i in range(1, 7):
    call("/habits/log", {"name": "gym", "date": (today - timedelta(days=i)).isoformat(), "status": "done"})
call("/habits/log", {"name": "gym", "date": "today", "status": "done"})
status, out = call("/habits/log", {"name": "gym", "date": "today", "status": "done"})
check("7 in a row -> streak 7", out.get("streak") == 7, f"streak={out.get('streak')} week={out.get('completion_this_week')}")
call("/habits/log", {"name": "gym", "date": (today - timedelta(days=2)).isoformat(), "status": "skipped"})
status, out = call("/habits/log", {"name": "gym", "date": "today", "status": "skipped"})
check("skip today -> streak 0", out.get("streak") == 0, f"streak={out.get('streak')}")
# restore
call("/habits/log", {"name": "gym", "date": "today", "status": "done"})
call("/habits/log", {"name": (today - timedelta(days=2)).isoformat() and "gym", "date": (today - timedelta(days=2)).isoformat(), "status": "done"})

print()
width = max(len(label) for _, label, _ in results)
for state, label, detail in results:
    print(f"[{state}] {label.ljust(width)}  {detail}")
print()
print(f"{sum(1 for s, _, _ in results if s == 'PASS')}/{len(results)} passed")
