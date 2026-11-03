"""Insert 5 demo events for today + next 2 days so we can test the Today card,
collision detection, and free slots working end-to-end."""

from datetime import datetime, timedelta
from db import get_conn


def seed_demo_events():
    today = datetime.now().date()
    tomorrow = today + timedelta(days=1)
    day_after = today + timedelta(days=2)

    events = [
        # Today — includes an intentional collision (Standup 10:00-10:15 vs DBMS Lab 10:10-12:00)
        {
            "uid": "demo-1",
            "title": "Standup",
            "start_at": f"{today}T10:00",
            "end_at": f"{today}T10:15",
            "category": "office",
            "company": None,
        },
        {
            "uid": "demo-2",
            "title": "DBMS Lab",
            "start_at": f"{today}T10:10",           # collides with Standup on purpose
            "end_at": f"{today}T12:00",
            "category": "academic",
            "company": None,
        },
        {
            "uid": "demo-3",
            "title": "Infosys Technical Interview",
            "start_at": f"{today}T15:00",
            "end_at": f"{today}T16:00",
            "category": "interview",
            "company": "Infosys",
        },
        # Tomorrow
        {
            "uid": "demo-4",
            "title": "Sprint Planning",
            "start_at": f"{tomorrow}T14:00",
            "end_at": f"{tomorrow}T15:00",
            "category": "office",
            "company": None,
        },
        # Day after tomorrow
        {
            "uid": "demo-5",
            "title": "AI Project — Assignment Submission",
            "start_at": f"{day_after}T17:00",
            "end_at": f"{day_after}T17:30",
            "category": "academic",
            "company": None,
        },
    ]

    conn = get_conn()
    for ev in events:
        conn.execute("DELETE FROM events WHERE uid = ?", (ev["uid"],))
        conn.execute(
            "INSERT INTO events (uid, title, start_at, end_at, location, description, "
            "category, company, source, created_at) VALUES (?, ?, ?, ?, '', '', ?, ?, 'demo', ?)",
            (ev["uid"], ev["title"], ev["start_at"], ev["end_at"],
             ev["category"], ev["company"],
             datetime.now().isoformat(timespec="seconds")),
        )
    conn.commit()
    conn.close()
    print(f"Seeded {len(events)} demo events (today + next 2 days)")
    for ev in events:
        print(f"  [{ev['category']}] {ev['start_at'][:16]} — {ev['title']}")


if __name__ == "__main__":
    seed_demo_events()