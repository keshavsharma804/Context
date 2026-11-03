import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import os, threading
from datetime import datetime
from core.db import get_conn
from core.config import DOWNLOADS, DOCUMENTS, ACTIVITY_POLL_SECONDS


class ActivityTracker(threading.Thread):
    def __init__(self):
        super().__init__(daemon=True)
        self.stop_flag = False
        self._stop_event = threading.Event()
        self._last_window = None

    def run(self):
        while not self.stop_flag:
            try:
                self._poll_files()
                self._poll_history()
                self._poll_window()
            except Exception as e:
                print(f"[activity] error: {e}")
            self._stop_event.wait(ACTIVITY_POLL_SECONDS)

    def stop(self):
        self.stop_flag = True
        self._stop_event.set()

    def _poll_files(self):
        conn = get_conn()
        for folder in (DOWNLOADS, DOCUMENTS):
            if not os.path.isdir(folder):
                continue
            for f in os.listdir(folder):
                if self.stop_flag:
                    break
                path = os.path.join(folder, f)
                if not os.path.isfile(path):
                    continue
                try:
                    atime = datetime.fromtimestamp(
                        os.path.getatime(path)
                    ).isoformat(timespec="seconds")
                except OSError:
                    continue
                row = conn.execute(
                    'SELECT last_opened FROM context.files WHERE path = %s', (path,)
                ).fetchone()
                if row and row["last_opened"] != atime:
                    conn.execute(
                        'INSERT INTO context.activity_log (kind, target, detail, timestamp) VALUES (%s, %s, %s, %s)',
                        ("file_open", path, f, atime),
                    )
                    conn.execute(
                        'UPDATE context.files SET last_opened = %s WHERE path = %s',
                        (atime, path),
                    )
        conn.commit()
        conn.close()

    def _poll_history(self):
        conn = get_conn()
        last = conn.execute(
            "SELECT MAX(timestamp) FROM context.activity_log WHERE kind = 'page_visit'"
        ).fetchone()[0]
        if not last:
            conn.close()
            return
        rows = conn.execute(
            'SELECT url, title, last_visit FROM context.history WHERE last_visit > %s ORDER BY last_visit DESC LIMIT 100',
            (last,),
        ).fetchall()
        for r in rows:
            conn.execute(
                'INSERT INTO context.activity_log (kind, target, detail, timestamp) VALUES (%s, %s, %s, %s)',
                ("page_visit", r["url"], r["title"], r["last_visit"]),
            )
        conn.commit()
        conn.close()

    def _poll_window(self):
        if os.name != "nt":
            return
        try:
            import win32gui
        except ImportError:
            return
        try:
            hwnd = win32gui.GetForegroundWindow()
            title = win32gui.GetWindowText(hwnd)
        except Exception:
            return
        if title and title != self._last_window:
            self._last_window = title
            now = datetime.now().isoformat(timespec="seconds")
            conn = get_conn()
            conn.execute(
                'INSERT INTO context.activity_log (kind, target, detail, timestamp) VALUES (%s, %s, %s, %s)',
                ("window", title[:200], None, now),
            )
            conn.commit()
            conn.close()


def recent_activity(limit=15):
    conn = get_conn()
    rows = conn.execute(
        'SELECT kind, target, detail, timestamp FROM context.activity_log ORDER BY timestamp DESC LIMIT %s', (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
