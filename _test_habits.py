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


for day in ("2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01"):
    out = call("/habits/log", {"name": "gym", "date": day, "status": "done"})
print("7 in a row ->", out["streak"], out["completion_this_week"])

out = call("/habits/log", {"name": "gym", "date": "today", "status": "skipped"})
print("skipped today ->", out["streak"])

out = call("/habits/log", {"name": "gym", "date": "today", "status": "done"})
print("done again ->", out["streak"])

for line in ("did gym today", "skipped reading", "read 20 mins", "no sugar today",
             "how much did I spend this week?", "I spent 40 on coffee", "did I spend 40 on coffee", "gym"):
    out = call("/ask", {"question": line})
    action = out.get("action") or {}
    print(repr(line), "->", action.get("kind"), "|", out.get("answer"))
