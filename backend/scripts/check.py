import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from core.db import get_conn
from services.dots import find_forgotten_files, find_connections
from services.jobsearch import detect_companies_from_files, job_search_brief
from services.calendar_import import calendar_brief
from services.gmail_import import gmail_brief, load_credentials
from services.groq_client import has_key as groq_has_key
from services.activity import recent_activity

c = get_conn()
print("files:", c.execute("SELECT COUNT(*) FROM context.files").fetchone()[0])
print("history:", c.execute("SELECT COUNT(*) FROM context.history").fetchone()[0])
print("applications:", c.execute("SELECT COUNT(*) FROM context.applications").fetchone()[0])
print("interviews:", c.execute("SELECT COUNT(*) FROM context.interviews").fetchone()[0])
print("events:", c.execute("SELECT COUNT(*) FROM context.events").fetchone()[0])
print("emails:", c.execute("SELECT COUNT(*) FROM context.emails").fetchone()[0])
print("chunks:", c.execute("SELECT COUNT(*) FROM context.chunks").fetchone()[0])
print("manual:", c.execute("SELECT COUNT(*) FROM context.manual").fetchone()[0])
print("activity:", c.execute("SELECT COUNT(*) FROM context.activity_log").fetchone()[0])
print("ignored:", c.execute("SELECT COUNT(*) FROM context.ignored_files").fetchone()[0])
c.close()
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