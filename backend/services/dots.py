import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import re
from collections import Counter
from datetime import datetime
from core.db import get_conn
from core.config import (
    FORGOTTEN_CATEGORIES, FORGOTTEN_MAX_AGE_DAYS, FORGOTTEN_MIN_SIZE_KB,
    FORGOTTEN_LIMIT,
)


STOPWORDS = set("""
the and for from with that this what when where which will have has had was were
been being are is am be do does did can could would should may might must shall
than then there here about into over under between through during before after
to in on at by of or not no yes you your me my we us our they them their it its
ai agent agentic project projects build built building want wants wanted give
gives given make makes made making help helps helped using use used uses better
best good great new old small large big like likely more most less least some
any all each every many much few little file files list lists tell want
""".split())

BAD_URL_SUBSTRINGS = [
    "google.com/search", "google.co.in/search", "bing.com/search",
    "duckduckgo.com/?q=", "youtube.com/results",
    "chat.openai.com", "chatgpt.com", "claude.ai", "gemini.google.com",
    "perplexity.ai", "grok.com", "x.com/i/grok", "chat.deepseek.com",
    "localhost", "127.0.0.1", "file://",
]

TERMINAL_MARKERS = [
    "PS C:", "PS D:", "PS \\\\", "fatal:", "On branch", "git status",
    "git push", "git commit", "git branch", "npm ERR", "pip install",
    "Traceback (most recent", "\\x0a", "\\x3b",
]


def _tokens(text):
    if not text:
        return set()
    words = re.findall(r"[a-z]{4,}", text.lower())
    return set(w for w in words if w not in STOPWORDS)


def _is_good_history(row):
    title = (row["title"] or "").strip()
    url = (row["url"] or "").strip()
    if not title or len(title) < 8 or len(title) > 160:
        return False
    if any(b in url for b in BAD_URL_SUBSTRINGS):
        return False
    if any(m in title for m in TERMINAL_MARKERS):
        return False
    if title.count("?") > 2 or title.count("\\") > 2:
        return False
    return True


def _same_document(a, b):
    def norm(s):
        s = (s or "").lower()
        s = re.sub(r"\.(pdf|docx?|txt|md|png|jpg|jpeg|json|zip)$", "", s)
        s = re.sub(r"\s*\(\d+\)\s*$", "", s)
        s = re.sub(r"[_\-\s]+", "", s)
        return s.strip()
    a, b = norm(a), norm(b)
    if not a or not b:
        return False
    return a == b or a.startswith(b) or b.startswith(a)


def _ignored_paths():
    conn = get_conn()
    rows = conn.execute('SELECT path FROM context.ignored_files').fetchall()
    conn.close()
    return {r["path"] for r in rows}


_CONNECTIONS_CACHE = {"data": None, "ts": 0}

def find_connections(limit=5, min_score=0.6):
    import time
    from collections import defaultdict
    now = time.time()
    if _CONNECTIONS_CACHE["data"] is not None and (now - _CONNECTIONS_CACHE["ts"]) < 60:
        return _CONNECTIONS_CACHE["data"][:limit]

    conn = get_conn()
    ignored = _ignored_paths()
    files = conn.execute(
        "SELECT name, path, content, downloaded FROM context.files WHERE content != '' ORDER BY downloaded DESC LIMIT 100"
    ).fetchall()
    raw_history = conn.execute(
        'SELECT url, title, last_visit FROM context.history ORDER BY last_visit DESC LIMIT 1000'
    ).fetchall()
    conn.close()

    history = [h for h in raw_history if _is_good_history(h)]
    history_tokens = [(h, t) for h, t in [(h, _tokens(h["title"] or "")) for h in history] if len(t) >= 3]
    if not history_tokens:
        _CONNECTIONS_CACHE["data"] = []
        _CONNECTIONS_CACHE["ts"] = now
        return []

    word_freq = Counter()
    for _, toks in history_tokens:
        for t in toks:
            word_freq[t] += 1
    noise_threshold = max(5, int(len(history_tokens) * 0.10))
    noisy = {w for w, c in word_freq.items() if c > noise_threshold}

    index = defaultdict(list)
    for idx, (h, htoks) in enumerate(history_tokens):
        ht = htoks - noisy
        if len(ht) >= 3:
            for w in ht:
                index[w].append(idx)

    results = []
    for f in files:
        if f["path"] in ignored:
            continue
        ftoks = _tokens(f["name"] + " " + (f["content"] or "")[:3000]) - noisy
        if len(ftoks) < 5:
            continue

        cand_counts = Counter()
        for w in ftoks:
            for idx in index.get(w, []):
                cand_counts[idx] += 1

        best = None
        for idx, match_count in cand_counts.items():
            if match_count < 2:
                continue
            h, htoks = history_tokens[idx]
            if _same_document(f["name"], h["title"] or ""):
                continue
            ht = htoks - noisy
            overlap = ftoks & ht
            if len(overlap) < 2:
                continue
            score = sum(1.0 / word_freq[w] for w in overlap if word_freq.get(w, 0) > 0)
            if "github.com" in h["url"]:
                score *= 1.5
            if best is None or score > best["score"]:
                best = {
                    "file": f["name"], "page": h["title"] or h["url"],
                    "url": h["url"],
                    "shared": sorted(overlap, key=lambda w: word_freq.get(w, 999))[:5],
                    "score": round(score, 2),
                }
        if best and best["score"] >= min_score:
            results.append(best)

    results.sort(key=lambda x: -x["score"])
    _CONNECTIONS_CACHE["data"] = results
    _CONNECTIONS_CACHE["ts"] = now
    return results[:limit]


def _age_days(iso):
    try:
        return (datetime.now() - datetime.fromisoformat(iso)).days
    except Exception:
        return 9999


def find_forgotten_files(limit=None):
    limit = limit or FORGOTTEN_LIMIT
    ignored = _ignored_paths()
    cat_placeholders = ",".join(["%s"] * len(FORGOTTEN_CATEGORIES))
    conn = get_conn()
    rows = conn.execute(
        f'SELECT name, path, category, downloaded, last_opened, size_kb FROM context.files WHERE category IN ({cat_placeholders}) AND size_kb >= %s ORDER BY downloaded DESC LIMIT 300',
        (*FORGOTTEN_CATEGORIES, FORGOTTEN_MIN_SIZE_KB),
    ).fetchall()
    conn.close()

    out = []
    for r in rows:
        if r["path"] in ignored:
            continue
        age = _age_days(r["downloaded"])
        if age < 2 or age > FORGOTTEN_MAX_AGE_DAYS:
            continue
        try:
            dl = datetime.fromisoformat(r["downloaded"])
            lo = datetime.fromisoformat(r["last_opened"])
            if (lo - dl).total_seconds() < 60:
                out.append({
                    "name": r["name"], "category": r["category"],
                    "age_days": age, "path": r["path"],
                    "message": f"'{r['name']}' — {age}d old, never opened.",
                })
        except Exception:
            continue
    return out[:limit]


def find_unanswered_patterns(limit=5):
    return []
