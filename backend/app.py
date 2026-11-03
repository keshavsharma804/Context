import os
import sys

backend_dir = os.path.dirname(os.path.abspath(__file__))
for d in (backend_dir, os.path.join(backend_dir, "core"), os.path.join(backend_dir, "services"), os.path.join(backend_dir, "routes")):
    if d not in sys.path:
        sys.path.insert(0, d)

import os
from pathlib import PureWindowsPath, PurePosixPath

from fastapi import FastAPI, Request, Form, File, UploadFile
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import uvicorn

from core.config import DOWNLOADS, DOCUMENTS, PORT, TEMPLATES_DIR
from core.db import init_db, get_conn
from services.indexer import run as run_indexer, index_file
from services.dots import find_forgotten_files, find_connections
from services.jobsearch import job_search_brief, apply_oneliner
from services.calendar_import import index_ics, calendar_brief, clear_events
from services.gmail_import import (
    test_connection, save_credentials, delete_credentials, index_emails, gmail_brief,
)
from services.activity import ActivityTracker, recent_activity
from services.manual import parse_and_store, save_note
from services.ask import ask as ask_question
from services.groq_client import (
    test_key as groq_test_key, save_key as groq_save_key,
    delete_key as groq_delete_key, has_key as groq_has_key,
)
from services.people import people_brief, get_person, extract_people_from_emails
from services.spends import spend_brief
from services.patterns import detect_all as detect_patterns, patterns_brief, dismiss_pattern

# ── JSON API router (React frontend) ─────────────────────────────────────────
from routes.api import router as api_router


def to_file_url(path: str) -> str:
    if os.name == "nt" or (len(path) > 1 and path[1] == ":"):
        p = PureWindowsPath(path).as_posix()
        if not p.startswith("/"):
            p = "/" + p
        return "file://" + p
    return "file://" + PurePosixPath(path).as_posix()


app = FastAPI()

# Mount the JSON API router
app.include_router(api_router, prefix="/api")

templates = Jinja2Templates(directory=TEMPLATES_DIR)


class NewFileHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            index_file(event.src_path)
    def on_moved(self, event):
        if not event.is_directory:
            index_file(event.dest_path)


def start_watchers():
    obs = Observer()
    for folder in (DOWNLOADS, DOCUMENTS):
        if os.path.isdir(folder):
            obs.schedule(NewFileHandler(), folder, recursive=False)
    obs.start()
    return obs


def _build_home_context(request, q="", answer="", question="", sources=None, flash="", error=""):
    conn = get_conn()
    if q:
        file_rows = conn.execute(
            "SELECT name, category, snippet(files, 3, '<b>', '</b>', '\u2026', 20) AS snip, "
            "path, downloaded FROM files WHERE files MATCH ? LIMIT 25", (q,),
        ).fetchall()
        hist_rows = conn.execute(
            "SELECT title, url, snippet(history, 2, '<b>', '</b>', '\u2026', 20) AS snip, "
            "last_visit FROM history WHERE history MATCH ? LIMIT 15", (q,),
        ).fetchall()
    else:
        file_rows = conn.execute(
            "SELECT name, category, '' AS snip, path, downloaded "
            "FROM files ORDER BY downloaded DESC LIMIT 25"
        ).fetchall()
        hist_rows = conn.execute(
            "SELECT title, url, '' AS snip, last_visit "
            "FROM history ORDER BY last_visit DESC LIMIT 15"
        ).fetchall()

    counts = {k: conn.execute(f"SELECT COUNT(*) FROM {k}").fetchone()[0]
              for k in ["files", "history", "events", "emails", "chunks", "people", "spends"]}
    conn.close()
    file_rows = [{**dict(r), "file_url": to_file_url(r["path"])} for r in file_rows]

    return templates.TemplateResponse(
        request=request, name="index.html",
        context={
            "request": request, "q": q, "answer": answer, "question": question,
            "sources": sources or [], "flash": flash, "error": error,
            "file_rows": file_rows, "hist_rows": hist_rows,
            "total_files": counts["files"], "total_hist": counts["history"],
            "total_events": counts["events"], "total_emails": counts["emails"],
            "total_chunks": counts["chunks"],
            "forgotten": find_forgotten_files(),
            "connections": find_connections(),
            "job": job_search_brief(),
            "cal": calendar_brief(),
            "gmail": gmail_brief(),
            "activity": recent_activity(15),
            "has_groq": groq_has_key(),
            "people": people_brief(),
            "spend": spend_brief(),
            "patterns": patterns_brief(),
        },
    )


@app.get("/", response_class=HTMLResponse)
def home(request: Request, q: str = "", answer: str = "", question: str = "",
         flash: str = "", error: str = ""):
    return _build_home_context(request, q=q, answer=answer, question=question,
                               flash=flash, error=error)


@app.post("/ask", response_class=HTMLResponse)
def ask_route(request: Request, question: str = Form(...)):
    answer, sources = ask_question(question)
    return _build_home_context(request, answer=answer, question=question, sources=sources)


@app.get("/rescan")
def rescan():
    run_indexer()
    from services.rag import index_everything
    index_everything()
    detect_patterns()
    return RedirectResponse(url="/", status_code=303)


@app.post("/quick")
def quick_add(line: str = Form(...)):
    if parse_and_store(line):
        return RedirectResponse(url="/", status_code=303)
    if apply_oneliner(line):
        return RedirectResponse(url="/", status_code=303)
    save_note(line)
    return RedirectResponse(url="/", status_code=303)


@app.post("/ignore")
def ignore_file(path: str = Form(...)):
    from datetime import datetime
    conn = get_conn()
    conn.execute("INSERT OR IGNORE INTO ignored_files (path, ignored_at) VALUES (?, ?)",
                 (path, datetime.now().isoformat(timespec="seconds")))
    conn.commit()
    conn.close()
    return RedirectResponse(url="/", status_code=303)


@app.post("/calendar/upload")
async def calendar_upload(file: UploadFile = File(...)):
    tmp = os.path.join(os.environ.get("TEMP", "/tmp"), f"ctx_{file.filename}")
    with open(tmp, "wb") as f:
        f.write(await file.read())
    index_ics(tmp, source_name=file.filename)
    from rag import index_all_events
    index_all_events()
    detect_patterns()
    return RedirectResponse(url="/", status_code=303)


@app.post("/calendar/clear")
def calendar_clear():
    clear_events()
    return RedirectResponse(url="/", status_code=303)


@app.post("/gmail/connect")
def gmail_connect(email: str = Form(...), app_password: str = Form(...)):
    ok, msg = test_connection(email.strip(), app_password.replace(" ", "").strip())
    if not ok:
        return RedirectResponse(url=f"/?error={msg[:200]}", status_code=303)
    save_credentials(email.strip(), app_password.replace(" ", "").strip())
    result = index_emails()
    if result.get("ok"):
        from rag import index_all_emails
        index_all_emails()
        extract_people_from_emails()
        from rag import index_all_people
        index_all_people()
        return RedirectResponse(url="/?flash=Gmail connected", status_code=303)
    return RedirectResponse(url=f"/?error={result.get('error','fetch failed')[:200]}", status_code=303)


@app.post("/gmail/fetch")
def gmail_fetch():
    result = index_emails()
    if result.get("ok"):
        from rag import index_all_emails, index_all_people
        index_all_emails()
        extract_people_from_emails()
        index_all_people()
        return RedirectResponse(url=f"/?flash=Fetched {result['new_inbox']} inbox, {result['sent']} sent",
                                status_code=303)
    return RedirectResponse(url=f"/?error={result.get('error','fetch failed')[:200]}", status_code=303)


@app.post("/gmail/disconnect")
def gmail_disconnect():
    delete_credentials()
    return RedirectResponse(url="/", status_code=303)


@app.post("/groq/connect")
def groq_connect(api_key: str = Form(...)):
    ok, msg = groq_test_key(api_key.strip())
    if not ok:
        return RedirectResponse(url=f"/?error={msg[:200]}", status_code=303)
    groq_save_key(api_key.strip())
    return RedirectResponse(url="/?flash=Groq connected", status_code=303)


@app.post("/groq/disconnect")
def groq_disconnect():
    groq_delete_key()
    return RedirectResponse(url="/", status_code=303)


@app.post("/patterns/refresh")
def patterns_refresh():
    detect_patterns()
    return RedirectResponse(url="/?flash=Patterns refreshed", status_code=303)


@app.post("/patterns/dismiss")
def patterns_dismiss(id: int = Form(...)):
    dismiss_pattern(id)
    return RedirectResponse(url="/", status_code=303)


@app.get("/people/{name}", response_class=HTMLResponse)
def person_page(request: Request, name: str):
    p = get_person(name)
    if not p:
        return RedirectResponse(url="/?error=Person not found", status_code=303)
    return templates.TemplateResponse(
        request=request, name="person.html",
        context={"request": request, "person": p},
    )


if __name__ == "__main__":
    init_db()
    print("First indexing pass...")
    run_indexer()

    conn = get_conn()
    chunk_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]
    conn.close()
    if chunk_count == 0:
        print("Building searchable index (one-time)...")
        from services.rag import index_everything
        index_everything()

    print("Detecting patterns...")
    detect_patterns()

    tracker = ActivityTracker()
    tracker.start()
    print("Activity tracker started")

    obs = start_watchers()
    print(f"\n  Context is running -> http://localhost:{PORT}\n")

    try:
        uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
    finally:
        tracker.stop_flag = True
        obs.stop()
        obs.join()
