import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import os, sqlite3, shutil, re
from datetime import datetime, timedelta
import fitz
from docx import Document as DocxDocument
from core.config import (
    DOWNLOADS, DOCUMENTS, CHROME_USER_DATA,
    MAX_PDF_CHARS, MAX_FILE_MB, HISTORY_DAYS, HISTORY_PER_PROFILE,
)
from core.db import get_conn


# ---------- Categorization ----------
def categorize(name):
    n = name.lower()
    if re.search(r"invoice|bill|receipt", n): return "invoice"
    if re.search(r"ticket|boarding|pnr|itinerary", n): return "ticket"
    # CV / resume — must be a whole word (delimited by start/space/underscore/dash/dot)
    if re.search(r"\bresume\b", n) or re.search(r"(^|[\s_\-])cv([\s_\-.]|$)", n):
        return "resume"
    if re.search(r"syllabus|assignment|brief|homework|exam", n): return "academic"
    if re.search(r"report|deck|slides|presentation|thesis", n): return "report"
    if n.endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")): return "image"
    if n.endswith(".pdf"): return "pdf"
    if n.endswith((".docx", ".doc")): return "doc"
    if n.endswith((".py", ".js", ".ts", ".html", ".css", ".json")): return "code"
    return "other"


# ---------- Text extraction ----------
def extract_text(path):
    try:
        if path.lower().endswith(".pdf"):
            doc = fitz.open(path)
            return " ".join(p.get_text() for p in doc)[:MAX_PDF_CHARS]
        if path.lower().endswith((".docx", ".doc")):
            d = DocxDocument(path)
            return " ".join(p.text for p in d.paragraphs)[:MAX_PDF_CHARS]
        if path.lower().endswith((".txt", ".md", ".py", ".js", ".ts", ".html", ".css", ".json")):
            return open(path, errors="ignore").read()[:MAX_PDF_CHARS]
    except Exception as e:
        print(f"  [extract fail] {os.path.basename(path)}: {e}")
    return ""


# ---------- Index one file ----------
def index_file(path):
    if not os.path.isfile(path):
        return
    name = os.path.basename(path)
    try:
        size_mb = os.path.getsize(path) / (1024 * 1024)
    except OSError:
        return
    if size_mb > MAX_FILE_MB:
        return
    try:
        stat = os.stat(path)
    except OSError:
        return

    cat = categorize(name)
    content = extract_text(path)
    downloaded = datetime.fromtimestamp(stat.st_ctime).isoformat(timespec="seconds")
    last_opened = datetime.fromtimestamp(stat.st_atime).isoformat(timespec="seconds")

    conn = get_conn()
    conn.execute("DELETE FROM files WHERE path = ?", (path,))
    conn.execute(
        "INSERT INTO files (path, name, category, content, downloaded, last_opened, size_kb) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (path, name, cat, content, downloaded, last_opened, int(stat.st_size / 1024)),
    )
    conn.commit()
    conn.close()


# ---------- Index a folder ----------
def index_folder(folder):
    if not os.path.isdir(folder):
        print(f"  (skip — not found: {folder})")
        return 0
    count = 0
    for f in os.listdir(folder):
        full = os.path.join(folder, f)
        if os.path.isfile(full):
            index_file(full)
            count += 1
    return count


# ---------- Chrome profiles ----------
def chrome_profiles():
    if not os.path.isdir(CHROME_USER_DATA):
        print(f"  (skip — Chrome user-data dir not found: {CHROME_USER_DATA})")
        return []
    profiles = []
    for name in os.listdir(CHROME_USER_DATA):
        if name == "Default" or re.match(r"^Profile \d+$", name):
            hist = os.path.join(CHROME_USER_DATA, name, "History")
            if os.path.exists(hist):
                profiles.append((name, hist))
    profiles.sort(key=lambda x: (x[0] != "Default", x[0]))
    return profiles


def chrome_history_path():
    profiles = chrome_profiles()
    return profiles[0][1] if profiles else None


# ---------- Index Chrome history ----------
def index_chrome_history():
    profiles = chrome_profiles()
    if not profiles:
        print("  (skip — no Chrome profiles found)")
        return 0

    CHROME_EPOCH_OFFSET = 11644473600000000
    cutoff_us = (
        int((datetime.now() - timedelta(days=HISTORY_DAYS)).timestamp() * 1_000_000)
        + CHROME_EPOCH_OFFSET
    )
    tmp_dir = os.environ.get("TEMP", "/tmp") if os.name == "nt" else "/tmp"

    conn = get_conn()
    conn.execute("DELETE FROM history")
    total = 0

    for profile_name, hist_path in profiles:
        safe_name = profile_name.replace(" ", "_")
        tmp = os.path.join(tmp_dir, f"context_history_{safe_name}")
        try:
            shutil.copy2(hist_path, tmp)
        except Exception as e:
            print(f"  [skip {profile_name}] could not copy: {e}")
            continue
        try:
            conn_h = sqlite3.connect(tmp)
            rows = conn_h.execute(
                "SELECT url, title, visit_count, last_visit_time FROM urls "
                "WHERE last_visit_time > ? ORDER BY last_visit_time DESC LIMIT ?",
                (cutoff_us, HISTORY_PER_PROFILE),
            ).fetchall()
            conn_h.close()
        except Exception as e:
            print(f"  [skip {profile_name}] query failed: {e}")
            continue

        for url, title, visits, lvt in rows:
            try:
                ts = datetime(1970, 1, 1) + timedelta(microseconds=lvt - CHROME_EPOCH_OFFSET)
                ts_iso = ts.isoformat(timespec="seconds")
            except Exception:
                ts_iso = ""
            conn.execute(
                "INSERT INTO history (url, title, content, last_visit, visits) "
                "VALUES (?, ?, ?, ?, ?)",
                (url, title or "", "", ts_iso, visits or 0),
            )
        print(f"  {profile_name}: {len(rows)} rows")
        total += len(rows)

    conn.commit()
    conn.close()
    print(f"  indexed {total} history rows total (last {HISTORY_DAYS} days, {len(profiles)} profiles)")
    return total


# ---------- Full run ----------
def run():
    print("Indexing Downloads...")
    index_folder(DOWNLOADS)
    print("Indexing Documents...")
    index_folder(DOCUMENTS)
    print("Indexing Chrome history...")
    index_chrome_history()
    print("Done.")