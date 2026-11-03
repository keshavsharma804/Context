import json
import time
import urllib.request

BASE = "http://127.0.0.1:3000/api"

for attempt in range(30):
    try:
        with urllib.request.urlopen(BASE + "/habits", timeout=2) as res:
            data = json.loads(res.read().decode())
        break
    except Exception:
        time.sleep(0.4)
else:
    raise SystemExit("backend did not come up")

print("insights:", data["insights"])
for habit in data["habits"]:
    print(
        habit["name"],
        "| streak", habit["streak"],
        "| week", habit["completion_this_week"],
        "| month", habit["completion_this_month"],
        "| today", habit["today_status"],
    )
