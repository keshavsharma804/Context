import re, json
from datetime import datetime
from db import get_conn
from groq_client import chat, has_key


# --- spend: "spent 340 swiggy lunch" / "paid 120 auto ride" / "spent 50 chai" ---
RE_SPENT = re.compile(r"^(?:spent|spend|paid)\s+([\d.]+)\s+(.+)$", re.I)

# --- income: "income 5000 salary" ---
RE_INCOME = re.compile(r"^(?:income|earn|earned|got)\s+([\d.]+)(?:\s+(.+))?$", re.I)

RE_NOTE = re.compile(r"^note[:\s]+(.+)$", re.I)
RE_TASK = re.compile(r"^task[:\s]+(.+)$", re.I)
RE_URL = re.compile(r"^url[:\s]+(https?://\S+)$", re.I)
RE_IGNORE = re.compile(r"^ignore[:\s]+(.+)$", re.I)
RE_BUDGET = re.compile(r"^budget\s+(\w+)\s+([\d.]+)$", re.I)
RE_BIRTHDAY = re.compile(r"^birthday\s+([A-Za-z][A-Za-z\s]*?)[:\s]+(.+)$", re.I)
RE_PERSON = re.compile(r"^person\s+([A-Za-z][A-Za-z\s]*?)[:\s]+(.+)$", re.I)

# met/talked to: supports "met Priya: training", "talked to Tom yesterday", "saw Maya about marathon"
RE_MET = re.compile(
    r"^(?:met|talked to|spoke to|saw|contacted)\s+([A-Z][a-zA-Z]+)"
    r"(?:\s*[:\s]\s*(.+))?$",
    re.I,
)

# category keyword map for spends
SPEND_CATEGORY_HINTS = {
    "food": ["swiggy", "zomato", "restaurant", "cafe", "coffee", "chai",
             "lunch", "dinner", "breakfast", "snack", "food", "groceries",
             "grocery", "pizza", "burger", "biryani", "meal"],
    "transport": ["uber", "ola", "auto", "taxi", "cab", "metro", "bus",
                  "train", "flight", "petrol", "fuel", "diesel", "parking"],
    "shopping": ["amazon", "flipkart", "myntra", "ajio", "shop", "store",
                 "mall", "clothes", "shoes", "shopping"],
    "subscriptions": ["netflix", "spotify", "youtube", "prime", "hotstar",
                      "subscription", "sub", "renew", "github", "chatgpt"],
    "bills": ["electricity", "water", "internet", "broadband", "rent",
              "insurance", "mobile", "recharge", "bill"],
    "health": ["pharmacy", "medicine", "doctor", "hospital", "gym", "health"],
    "entertainment": ["movie", "cinema", "pvr", "inox", "concert", "game"],
}


def _infer_spend_category(text):
    text = (text or "").lower()
    for cat, words in SPEND_CATEGORY_HINTS.items():
        if any(w in text for w in words):
            return cat
    return "other"


def _split_merchant_category(rest):
    """'swiggy lunch' -> ('swiggy', 'food'). 'amazon shopping' -> ('amazon', 'shopping')."""
    parts = rest.strip().split()
    if not parts:
        return ("", "other")
    merchant = parts[0]
    remainder = " ".join(parts[1:]) if len(parts) > 1 else ""
    category = _infer_spend_category(rest)
    return (merchant, category)


def _save(kind, payload):
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO manual (kind, payload, created_at) VALUES (?, ?, ?)",
        (kind, json.dumps(payload), now),
    )
    manual_id = cur.lastrowid
    conn.commit()
    conn.close()
    try:
        from rag import add_chunk
        add_chunk("manual", str(manual_id), f"{kind}: {payload.get('summary', '')[:80]}",
                  json.dumps(payload), {"kind": kind, "created_at": now})
    except Exception:
        pass
    return manual_id


def save_note(text):
    return _save("note", {"content": text, "summary": text[:80]})


def parse_and_store(line):
    line = (line or "").strip()
    if not line:
        return False

    # --- budget ---
    m = RE_BUDGET.match(line)
    if m:
        cat, amount = m.groups()
        from spends import set_budget
        set_budget(cat, float(amount))
        _save("budget", {"category": cat.lower(), "amount": float(amount),
                          "summary": f"Budget {cat}: ₹{amount}"})
        print(f"[manual] budget: {cat}={amount}")
        return True

    # --- birthday ---
    m = RE_BIRTHDAY.match(line)
    if m:
        who, when = m.groups()
        from people import set_birthday
        set_birthday(who.strip(), when.strip())
        _save("birthday", {"person": who.strip(), "birthday": when.strip(),
                            "summary": f"{who.strip()} birthday {when.strip()}"})
        print(f"[manual] birthday: {who.strip()} = {when.strip()}")
        return True

    # --- person fact ---
    m = RE_PERSON.match(line)
    if m:
        who, fact = m.groups()
        from people import add_fact
        ok = add_fact(who.strip(), fact.strip())
        _save("person_fact", {"person": who.strip(), "fact": fact.strip(),
                               "summary": f"{who.strip()}: {fact.strip()[:60]}"})
        print(f"[manual] person_fact: {who.strip()} → {fact.strip()} (ok={ok})")
        return True

    # --- met/talked ---
    m = RE_MET.match(line)
    if m:
        who = m.group(1)
        rest = (m.group(2) or "").strip()
        from people import mark_contacted, add_fact
        mark_contacted(who)
        if rest:
            add_fact(who, f"Met/contacted: {rest}", category="contact")
        _save("contact", {"person": who, "note": rest,
                           "summary": f"Contacted {who}"})
        print(f"[manual] met: {who} ({rest})")
        return True

    # --- spent ---
    m = RE_SPENT.match(line)
    if m:
        amount, rest = m.groups()
        merchant, category = _split_merchant_category(rest)
        from spends import add_spend
        add_spend(float(amount), merchant, category)
        _save("expense", {"amount": float(amount), "merchant": merchant,
                          "category": category,
                          "summary": f"{merchant} — ₹{amount} ({category})"})
        print(f"[manual] spent: ₹{amount} at {merchant} ({category})")
        return True

    # --- income ---
    m = RE_INCOME.match(line)
    if m:
        amount, source = m.groups()
        _save("income", {"amount": float(amount), "source": (source or "").strip(),
                          "summary": f"Income {amount}"})
        print(f"[manual] income: {amount}")
        return True

    # --- note ---
    m = RE_NOTE.match(line)
    if m:
        _save("note", {"content": m.group(1).strip(),
                        "summary": m.group(1).strip()[:80]})
        print(f"[manual] note")
        return True

    # --- task ---
    m = RE_TASK.match(line)
    if m:
        _save("task", {"content": m.group(1).strip(),
                        "summary": m.group(1).strip()[:80]})
        print(f"[manual] task")
        return True

    # --- url ---
    m = RE_URL.match(line)
    if m:
        url = m.group(1).strip()
        _save("url", {"url": url, "summary": url[:80]})
        print(f"[manual] url: {url}")
        return True

    # --- ignore ---
    m = RE_IGNORE.match(line)
    if m:
        target = m.group(1).strip()
        conn = get_conn()
        conn.execute(
            "INSERT OR IGNORE INTO ignored_files (path, ignored_at) VALUES (?, ?)",
            (target, datetime.now().isoformat(timespec="seconds")),
        )
        conn.commit()
        conn.close()
        print(f"[manual] ignore: {target}")
        return True

    # --- groq fallback ---
    if has_key():
        try:
            result = chat(
                "Classify the user entry. Reply with JSON only.",
                f"""Entry: "{line}"

Return ONE of:
{{"kind":"expense","amount":0,"merchant":"","category":""}}
{{"kind":"income","amount":0,"source":""}}
{{"kind":"task","content":""}}
{{"kind":"note","content":""}}
{{"kind":"url","url":""}}
{{"kind":"person_fact","person":"","fact":""}}
{{"kind":"other","content":""}}

JSON:""",
                temperature=0.1, max_tokens=200,
            )
            mm = re.search(r"\{.*\}", result, re.S)
            if mm:
                parsed = json.loads(mm.group(0))
                kind = parsed.get("kind", "note")
                parsed["summary"] = line[:80]
                if kind == "person_fact" and parsed.get("person"):
                    from people import add_fact
                    add_fact(parsed["person"], parsed.get("fact", ""))
                    _save("person_fact", parsed)
                    print(f"[manual/groq] person_fact: {parsed['person']}")
                    return True
                if kind == "expense":
                    from spends import add_spend
                    add_spend(float(parsed.get("amount", 0) or 0),
                              parsed.get("merchant", ""),
                              parsed.get("category", "other"))
                    _save("expense", parsed)
                    print(f"[manual/groq] expense: {parsed}")
                    return True
                if kind in ("income", "task", "note", "url"):
                    _save(kind, parsed)
                    print(f"[manual/groq] {kind}")
                    return True
        except Exception as e:
            print(f"[manual/groq] failed: {e}")

    print(f"[manual] ✗ no match: {line!r}")
    return False