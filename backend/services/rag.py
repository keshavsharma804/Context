import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import json, re
from core.db import get_conn

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 200
MAX_PER_SOURCE = 10000


QUERY_STOPWORDS = {
    "which", "what", "where", "when", "who", "why", "how",
    "have", "has", "had", "was", "were", "been", "being",
    "will", "would", "could", "should", "may", "might", "must",
    "the", "and", "for", "from", "with", "that", "this", "these", "those",
    "find", "show", "give", "tell", "list", "any", "all", "some",
    "document", "documents", "file", "files", "record", "records",
    "about", "mention", "mentions", "mentioning", "related", "regarding",
    "machine", "computer", "system", "device", "devices", "disk", "folder",
    "are", "our", "onto", "into", "over", "under",
    "there", "here", "their", "them", "they",
    "can", "you", "your", "yours", "i", "me", "my", "mine",
    "we", "us", "let", "like", "just", "very", "more", "most",
    "some", "few", "many", "much", "lot", "lots",
    "do", "does", "did", "done", "doing",
    "get", "got", "give", "gave", "given",
    "make", "made", "want", "wants", "wanted",
    "see", "saw", "seen", "look", "looked", "looking",
    "on", "in", "at", "to", "of", "is", "as", "by", "or", "if", "so", "be",
    "go", "an", "no", "it", "he", "she", "up", "am", "re",
    "his", "her", "him", "than", "then", "also", "only", "even", "still", "yet",
}

QUERY_EXPAND = {
    "cv": ["cv", "resume", "curriculum"],
    "cvs": ["cv", "resume", "curriculum"],
    "resume": ["resume", "cv"],
    "resumes": ["resume", "cv"],
    "job": ["job", "position", "role", "opening"],
    "jobs": ["job", "position", "role"],
    "money": ["money", "spent", "spend", "expense", "cost", "paid"],
    "spend": ["spend", "spent", "expense", "cost", "paid"],
    "spent": ["spend", "spent", "expense", "cost", "paid"],
    "interview": ["interview", "screen", "screening", "round"],
    "interviews": ["interview", "screen", "screening", "round"],
    "talked": ["talked", "met", "spoke", "contacted"],
    "promise": ["promise", "promised", "will send", "will share"],
}

FILE_QUERY_HINTS = {"file", "files", "document", "documents",
                    "machine", "computer", "disk", "folder", "downloads"}


def chunk_text(text):
    if not text:
        return []
    text = text[:MAX_PER_SOURCE]
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        if end >= len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


def add_chunk(source_type, source_id, title, content, metadata=None):
    if not content:
        return
    conn = get_conn()
    conn.execute(
        "DELETE FROM chunks WHERE source_type = ? AND source_id = ?",
        (source_type, str(source_id)),
    )
    conn.execute(
        "INSERT INTO chunks (title, content, source_type, source_id, metadata) "
        "VALUES (?, ?, ?, ?, ?)",
        ((title or "")[:200], content, source_type, str(source_id), json.dumps(metadata or {})),
    )
    conn.commit()
    conn.close()


def add_chunks_for_file(path, name, category, content):
    conn = get_conn()
    conn.execute("DELETE FROM chunks WHERE source_type = 'file' AND source_id = ?", (path,))
    conn.commit()
    conn.close()
    pieces = chunk_text(content) or [f"{name} ({category})"]
    conn = get_conn()
    for i, piece in enumerate(pieces):
        conn.execute(
            "INSERT INTO chunks (title, content, source_type, source_id, metadata) "
            "VALUES (?, ?, 'file', ?, ?)",
            (name[:200], piece, path, json.dumps({"category": category, "chunk": i})),
        )
    conn.commit()
    conn.close()


def _query_groups(query):
    safe = re.sub(r"[^\w\s]", " ", (query or "").lower())
    raw = [t for t in safe.split() if len(t) >= 2]
    kept = [t for t in raw if t not in QUERY_STOPWORDS]
    if not kept:
        kept = [t for t in raw if len(t) >= 3] or raw
    groups, seen = [], set()
    for t in kept:
        if t in seen:
            continue
        seen.add(t)
        groups.append(QUERY_EXPAND.get(t, [t]))
    return groups


def _build_and_query(groups):
    parts = []
    for g in groups:
        parts.append(f'"{g[0]}"' if len(g) == 1 else "(" + " OR ".join(f'"{t}"' for t in g) + ")")
    return " AND ".join(parts)


def _build_or_query(groups):
    terms = []
    for g in groups:
        terms.extend(g)
    return " OR ".join(f'"{t}"' for t in terms)


def search_chunks(query, limit=15, source_type=None):
    groups = _query_groups(query)
    if not groups:
        return []
    if source_type is None:
        q_lower = (query or "").lower()
        if any(h in q_lower for h in FILE_QUERY_HINTS):
            source_type = "file"

    and_q = _build_and_query(groups)
    or_q = _build_or_query(groups)
    fetch_limit = limit * 5
    conn = get_conn()
    rows = []

    def _run(q):
        try:
            if source_type:
                return conn.execute(
                    "SELECT title, content, source_type, source_id, metadata, "
                    "bm25(chunks) AS score FROM chunks "
                    "WHERE chunks MATCH ? AND source_type = ? ORDER BY score LIMIT ?",
                    (q, source_type, fetch_limit),
                ).fetchall()
            return conn.execute(
                "SELECT title, content, source_type, source_id, metadata, "
                "bm25(chunks) AS score FROM chunks "
                "WHERE chunks MATCH ? ORDER BY score LIMIT ?",
                (q, fetch_limit),
            ).fetchall()
        except Exception:
            return []

    rows = _run(and_q)
    if len(rows) < 3:
        or_rows = _run(or_q)
        seen = set((r["source_type"], r["source_id"]) for r in rows)
        for r in or_rows:
            k = (r["source_type"], r["source_id"])
            if k not in seen:
                rows.append(r)
                seen.add(k)
        rows.sort(key=lambda r: r["score"])
    conn.close()

    seen_src, deduped = set(), []
    for r in rows:
        k = (r["source_type"], r["source_id"])
        if k in seen_src:
            continue
        seen_src.add(k)
        deduped.append(dict(r))
        if len(deduped) >= limit:
            break
    return deduped


def index_all_files():
    conn = get_conn()
    rows = conn.execute("SELECT path, name, category, content FROM files").fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} files...")
    for i, r in enumerate(rows):
        add_chunks_for_file(r["path"], r["name"], r["category"], r["content"] or "")
        if i and i % 100 == 0:
            print(f"[rag] {i}/{len(rows)}")
    print(f"[rag] files done")


def index_all_emails():
    conn = get_conn()
    rows = conn.execute(
        "SELECT uid, subject, from_addr, from_name, body_snippet, received_at, category, source FROM emails"
    ).fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} emails...")
    for r in rows:
        content = (f"From: {r['from_name']} <{r['from_addr']}>\nSubject: {r['subject']}\n"
                   f"Date: {r['received_at']}\n\n{r['body_snippet']}")
        add_chunk("email", r["uid"], r["subject"], content,
                  {"from": r["from_addr"], "category": r["category"],
                   "source": r["source"], "date": r["received_at"]})
    print(f"[rag] emails done")


def index_all_events():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, start_at, end_at, category, company, location, description FROM events"
    ).fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} events...")
    for r in rows:
        content = f"Event: {r['title']}\nWhen: {r['start_at']} -> {r['end_at']}\nCategory: {r['category']}\n"
        if r["company"]:
            content += f"Company: {r['company']}\n"
        if r["location"]:
            content += f"Location: {r['location']}\n"
        if r["description"]:
            content += f"\n{r['description']}"
        add_chunk("event", str(r["id"]), r["title"], content,
                  {"start_at": r["start_at"], "category": r["category"], "company": r["company"]})
    print(f"[rag] events done")


def index_all_manual():
    conn = get_conn()
    rows = conn.execute("SELECT id, kind, payload, created_at FROM manual").fetchall()
    conn.close()
    for r in rows:
        title = f"{r['kind']}: {r['payload'][:80]}"
        add_chunk("manual", str(r["id"]), title, r["payload"],
                  {"kind": r["kind"], "created_at": r["created_at"]})


def index_all_people():
    conn = get_conn()
    rows = conn.execute(
        "SELECT p.id, p.name, p.birthday, p.last_contacted, "
        "GROUP_CONCAT(pf.fact || ' [' || pf.category || ']', ' | ') as facts "
        "FROM people p LEFT JOIN person_facts pf ON pf.person_id = p.id AND pf.resolved = 0 "
        "GROUP BY p.id"
    ).fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} people...")
    for r in rows:
        content = f"Person: {r['name']}\n"
        if r["birthday"]:
            content += f"Birthday: {r['birthday']}\n"
        if r["last_contacted"]:
            content += f"Last contacted: {r['last_contacted']}\n"
        if r["facts"]:
            content += f"Facts: {r['facts']}"
        add_chunk("person", str(r["id"]), r["name"], content,
                  {"person": r["name"], "birthday": r["birthday"]})
    print(f"[rag] people done")


def index_all_spends():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, amount, merchant, category, spent_at FROM spends ORDER BY spent_at DESC LIMIT 2000"
    ).fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} spends...")
    for r in rows:
        content = f"₹{r['amount']:.0f} spent on {r['merchant']} ({r['category']}) on {r['spent_at']}"
        add_chunk("spend", str(r["id"]), f"₹{r['amount']:.0f} {r['merchant']}", content,
                  {"amount": r["amount"], "merchant": r["merchant"],
                   "category": r["category"], "date": r["spent_at"]})
    print(f"[rag] spends done")


def index_all_patterns():
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, kind, title, detail, severity FROM patterns_detected WHERE dismissed = 0"
    ).fetchall()
    conn.close()
    print(f"[rag] indexing {len(rows)} patterns...")
    for r in rows:
        content = f"Pattern: {r['title']}\nSeverity: {r['severity']}\nDetail: {r['detail']}"
        add_chunk("pattern", str(r["id"]), r["title"], content,
                  {"kind": r["kind"], "severity": r["severity"]})
    print(f"[rag] patterns done")


def reindex_all():
    """Full rebuild — call after any data mutations."""
    index_all_files()
    index_all_emails()
    index_all_events()
    index_all_manual()
    index_all_people()
    index_all_spends()
    index_all_patterns()
    print("[rag] full reindex done")

def index_everything():
    index_all_files()
    index_all_emails()
    index_all_events()
    index_all_manual()
    index_all_people()
    index_all_spends()
    index_all_patterns()
    print("[rag] all done")