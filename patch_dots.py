import re

with open('dots.py', 'r', encoding='utf-8') as f:
    code = f.read()

pattern = r'def find_connections\(limit=5, min_score=0\.6\):.*?return results\[:limit\]'

replacement = '''_CONNECTIONS_CACHE = {"data": None, "ts": 0}

def find_connections(limit=5, min_score=0.6):
    import time
    from collections import defaultdict
    now = time.time()
    if _CONNECTIONS_CACHE["data"] is not None and (now - _CONNECTIONS_CACHE["ts"]) < 60:
        return _CONNECTIONS_CACHE["data"][:limit]

    conn = get_conn()
    ignored = _ignored_paths()
    files = conn.execute(
        "SELECT name, path, content, downloaded FROM files WHERE content != '' ORDER BY downloaded DESC LIMIT 100"
    ).fetchall()
    raw_history = conn.execute(
        "SELECT url, title, last_visit FROM history ORDER BY last_visit DESC LIMIT 1000"
    ).fetchall()
    conn.close()

    history = [h for h in raw_history if _is_good_history(h)]
    history_tokens = [(h, _tokens(h["title"] or ""))]
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
    return results[:limit]'''

new_code, n = re.subn(pattern, replacement, code, flags=re.DOTALL)
assert n == 1, f"Expected 1 replacement, got {n}"
with open('dots.py', 'w', encoding='utf-8') as f:
    f.write(new_code)
print("dots.py successfully updated!")
