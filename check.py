from db import get_conn
from dots import find_forgotten_files, find_connections
from jobsearch import detect_companies_from_files, job_search_brief
from calendar_import import calendar_brief
from gmail_import import gmail_brief, load_credentials
from groq_client import has_key as groq_has_key
from activity import recent_activity

c = get_conn()
print("files:", c.execute("SELECT COUNT(*) FROM files").fetchone()[0])
print("history:", c.execute("SELECT COUNT(*) FROM history").fetchone()[0])
print("applications:", c.execute("SELECT COUNT(*) FROM applications").fetchone()[0])
print("interviews:", c.execute("SELECT COUNT(*) FROM interviews").fetchone()[0])
print("events:", c.execute("SELECT COUNT(*) FROM events").fetchone()[0])
print("emails:", c.execute("SELECT COUNT(*) FROM emails").fetchone()[0])
print("chunks:", c.execute("SELECT COUNT(*) FROM chunks").fetchone()[0])
print("manual:", c.execute("SELECT COUNT(*) FROM manual").fetchone()[0])
print("activity:", c.execute("SELECT COUNT(*) FROM activity_log").fetchone()[0])
print("ignored:", c.execute("SELECT COUNT(*) FROM ignored_files").fetchone()[0])
print()

print("Groq:", "connected" if groq_has_key() else "not connected")
print("Gmail:", ("connected as " + (load_credentials() or {}).get("email", "?"))
      if load_credentials() else "not connected")

print("\nForgotten:", len(find_forgotten_files()))
for f in find_forgotten_files():
    print("  ·", f["message"])

print("\nConnections:", len(find_connections()))
for x in find_connections():
    print(f"  · [{x['score']}] {x['file']}  →  {x['page'][:70]}")

print("\nRecent activity:", len(recent_activity(10)))
for a in recent_activity(5):
    print(f"  · {a['timestamp']} [{a['kind']}] {(a['detail'] or a['target'] or '')[:70]}")