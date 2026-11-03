import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

"""Turn short statements into stored records.



The floating ask box is used for questions, but people also type things like

"I spent 40 rupees yesterday". Those are data, not questions, so they are

captured before the language model is called. This keeps the action fast,

works without a Groq key, and guarantees the entry is actually saved.

"""



import re

import difflib

from datetime import datetime, timedelta



from services.manual import _infer_spend_category, save_note

from services.spends import add_spend

from services.habits import list_habits, log_habit

from services.debts import add_debt

from services.subscriptions import add_subscription

from services.people import mark_contacted





MONTHS = {

    "jan": 1, "january": 1,

    "feb": 2, "february": 2,

    "mar": 3, "march": 3,

    "apr": 4, "april": 4,

    "may": 5,

    "jun": 6, "june": 6,

    "jul": 7, "july": 7,

    "aug": 8, "august": 8,

    "sep": 9, "sept": 9, "september": 9,

    "oct": 10, "october": 10,

    "nov": 11, "november": 11,

    "dec": 12, "december": 12,

}



WEEKDAYS = {

    "monday": 0,

    "tuesday": 1,

    "wednesday": 2,

    "thursday": 3,

    "friday": 4,

    "saturday": 5,

    "sunday": 6,

}



_CURRENCY = r"(?:₹|rs\.?|inr|rup{1,2}e{1,2}s{0,2})"



# ─── Omni Capture Patterns (Debts, Subscriptions, Notes, Catch-ups) ───────────

LENT_TO_RE = re.compile(

    r"\b(?:i\s+)?lent\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?\s+to\s+([A-Za-z0-9_\s]+?)(?:\s+(?:for|on)\s+(.+))?$",

    re.I,

)

LENT_PERSON_RE = re.compile(

    r"\b(?:i\s+)?lent\s+([A-Za-z0-9_]+)\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?(?:\s+(?:for|on)\s+(.+))?$",

    re.I,

)

OWES_ME_RE = re.compile(

    r"\b([A-Za-z0-9_]+)\s+owes\s+me\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?(?:\s+(?:for|on)\s+(.+))?$",

    re.I,

)

BORROWED_FROM_RE = re.compile(

    r"\b(?:i\s+)?borrowed\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?\s+from\s+([A-Za-z0-9_\s]+?)(?:\s+(?:for|on)\s+(.+))?$",

    re.I,

)

I_OWE_RE = re.compile(

    r"\b(?:i\s+)?owe\s+([A-Za-z0-9_]+)\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?(?:\s+(?:for|on)\s+(.+))?$",

    re.I,

)

NOTE_RE = re.compile(

    r"^(?:note|todo|task|remember|idea):\s*(.+)$",

    re.I,

)

SUB_RE = re.compile(

    r"^(?:new\s+)?sub(?:scri(?:be|bed|pt|ption))?(?:\s+to)?\s+([A-Za-z0-9\s]+?)\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?(?:\s+(monthly|yearly|quarterly|weekly))?$",

    re.I,

)

CONTACTED_RE = re.compile(

    r"^(?:i\s+)?(?:met(?:\s+with)?|caught\s+up\s+with|called|texted|talked\s+to|spoke\s+to|visited)\s+([A-Za-z0-9_]+)(?:\s+(?:today|yesterday))?$",

    re.I,

)



SPEND_RE = re.compile(

    r"\b(?:i\s+)?(?:spent|spend|paid)\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?\s*(.*)$",

    re.I,

)



BOUGHT_RE = re.compile(

    r"\b(?:i\s+)?(?:bought|purchased)\s+(.+?)\s+(?:for|at)\s+"

    rf"{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?\s*(.*)$",

    re.I,

)



# "add 40 rupees on coffee yesterday", "log 40 for auto"

ADD_SPEND_RE = re.compile(

    r"^(?:add|log|record|save)\s+(?:an?\s+)?(?:expense|spend|payment)?\s*"

    rf"(?:of\s+)?{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*"

    rf"{_CURRENCY}?\s*(.*)$",

    re.I,

)



# "40 rupees on coffee yesterday" (bare amount with a currency word)

BARE_SPEND_RE = re.compile(

    rf"^{_CURRENCY}?\s*([\d,]+(?:\.\d{{1,2}})?)\s*{_CURRENCY}\s+"

    r"(?:on|for|at)\s+(.+)$",

    re.I,

)



QUESTION_START = re.compile(

    r"^(what|how|when|where|who|why|which|did|do|does|is|are|was|were|"

    r"can|could|should|would|show|list|tell|find|search|have|has|had)\b",

    re.I,

)



_MONTH_PATTERN = (

    r"jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|"

    r"jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|"

    r"nov(?:ember)?|dec(?:ember)?"

)





def _looks_like_question(text):

    value = (text or "").strip()

    if not value:

        return False

    if value.endswith("?"):

        return True

    return bool(QUESTION_START.match(value))





def _safe_date(year, month, day):

    try:

        return datetime(int(year), int(month), int(day)).date()

    except (TypeError, ValueError):

        return None





def _with_year(month, day):

    """Use this year, or last year when the date is still in the future."""

    today = datetime.now().date()

    result = _safe_date(today.year, month, day)

    if result and result > today:

        result = _safe_date(today.year - 1, month, day)

    return result





def _extract_date(text):

    """Return (date or None, text with the date phrase removed)."""

    today = datetime.now().date()



    def numeric_date(match):

        first = int(match.group(1))

        second = int(match.group(2))

        raw_year = match.group(3)

        year = int(raw_year) if raw_year else today.year

        if year < 100:

            year += 2000

        day, month = first, second

        if month > 12 and day <= 12:

            day, month = second, first

        return _safe_date(year, month, day)



    def day_month(match):

        day = int(match.group(1))

        month = MONTHS.get(match.group(2).lower())

        return _with_year(month, day) if month else None



    def month_day(match):

        month = MONTHS.get(match.group(1).lower())

        day = int(match.group(2))

        return _with_year(month, day) if month else None



    def last_weekday(match):

        target = WEEKDAYS.get(match.group(1).lower())

        if target is None:

            return None

        days = (today.weekday() - target) % 7

        if days == 0:

            days = 7

        return today - timedelta(days=days)



    rules = [

        (re.compile(r"\bday before yesterday\b", re.I),

         lambda _m: today - timedelta(days=2)),

        (re.compile(r"\byesterday\b", re.I),

         lambda _m: today - timedelta(days=1)),

        (re.compile(r"\btoday\b", re.I),

         lambda _m: today),

        (re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b"),

         lambda m: _safe_date(m.group(1), m.group(2), m.group(3))),

        (re.compile(r"\b(\d{1,2})\s+days?\s+ago\b", re.I),

         lambda m: today - timedelta(days=int(m.group(1)))),

        (re.compile(

            r"\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",

            re.I,

        ), last_weekday),

        (re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s+({_MONTH_PATTERN})\b", re.I),

         day_month),

        (re.compile(rf"\b({_MONTH_PATTERN})\s+(\d{{1,2}})(?:st|nd|rd|th)?\b", re.I),

         month_day),

        (re.compile(r"\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b"),

         numeric_date),

    ]



    for pattern, handler in rules:

        match = pattern.search(text)

        if not match:

            continue

        try:

            parsed = handler(match)

        except (TypeError, ValueError):

            parsed = None

        if not parsed:

            continue

        cleaned = f"{text[:match.start()]} {text[match.end():]}"

        return parsed, re.sub(r"\s+", " ", cleaned).strip()



    return None, text





def _amount(value):

    try:

        return float((value or "").replace(",", ""))

    except (TypeError, ValueError):

        return 0.0





def _clean_merchant(value):

    text = (value or "").strip()

    preposition = re.search(r"\b(?:on|at|for|from)\s+(.+)$", text, re.I)

    if preposition:

        text = preposition.group(1)

    text = re.sub(r"\b(?:today|yesterday|day before yesterday)\b", "", text, flags=re.I)

    text = re.sub(rf"\b{_CURRENCY}\b\.?", "", text, flags=re.I)

    text = re.sub(

        r"\b(?:to|in|into)\s+(?:my\s+)?(?:money|spends?|expenses?|storage)\b",

        "",

        text,

        flags=re.I,

    )

    text = re.sub(r"\b(?:on|at|for|from|to)\s*$", "", text, flags=re.I)

    text = re.sub(r"\s+", " ", text).strip(" .,-")

    return text[:60]





def _date_label(value):

    try:

        spent = datetime.strptime(value, "%Y-%m-%d").date()

    except (TypeError, ValueError):

        return value or "today"

    today = datetime.now().date()

    if spent == today:

        return "today"

    if spent == today - timedelta(days=1):

        return "yesterday"

    if spent == today - timedelta(days=2):

        return "day before yesterday"

    if spent.year == today.year:

        return f"{spent.day} {spent.strftime('%b')}"

    return f"{spent.day} {spent.strftime('%b %Y')}"





_SPEND_WORDS = re.compile(r"\b(?:spent|spend|paid|bought|purchased)\b", re.I)



_HABIT_ALIASES = {

    "gym": "gym",

    "gym session": "gym",

    "workout": "workout",

    "work out": "workout",

    "worked out": "workout",

    "exercise": "workout",

    "exercised": "workout",

    "read": "reading",

    "reading": "reading",

    "book": "reading",

    "books": "reading",

    "read book": "reading",

    "sugar": "no sugar",

    "no sugar": "no sugar",

    "nosugar": "no sugar",

    "sugar free": "no sugar",

    "no junk food": "no junk food",

    "no junk": "no junk food",

    "no alcohol": "no alcohol",

    "no smoking": "no smoking",

    "no cigarettes": "no smoking",

    "no caffeine": "no caffeine",

    "no coffee": "no caffeine",

    "no soda": "no soda",

    "no social media": "no social media",

    "no sweets": "no sweets",

    "meditate": "meditation",

    "meditated": "meditation",

    "meditation": "meditation",

    "walk": "walking",

    "walked": "walking",

    "walking": "walking",

    "run": "running",

    "ran": "running",

    "running": "running",

    "jog": "jogging",

    "jogged": "jogging",

    "jogging": "jogging",

    "journal": "journaling",

    "journaled": "journaling",

    "journaling": "journaling",

    "drink water": "water",

    "drank water": "water",

    "water": "water",

    "stretch": "stretching",

    "stretched": "stretching",

    "stretching": "stretching",

    "sleep early": "sleep early",

    "early sleep": "sleep early",

    "study": "studying",

    "studied": "studying",

    "studying": "studying",

}



HABIT_PATTERNS = [

    (r"^(?:did|completed|finished)\s+(.+?)(?:\s+(?:today|yesterday|on\s+\w+))?$", "done"),

    (r"^(?:skipped|missed|didn'?t\s+do)\s+(.+?)(?:\s+(?:today|yesterday|on\s+\w+))?$", "skipped"),

    (r"^(?:no\s+(.+?))\s+(?:today|yesterday)$", "done"),  # "no sugar today"

]



_HABIT_DONE_RE = re.compile(

    r"^(?:i\s+)?(?:did|completed|finished|done)\s+(.+)$", re.I

)

_HABIT_SKIP_RE = re.compile(

    r"^(?:i\s+)?(?:skipped|missed)\s+(.+)$", re.I

)

_HABIT_DIDNT_RE = re.compile(

    r"^(?:i\s+)?(?:didn'?t|did\s+not)\s+(?:do|finish|complete)?\s*(.+)$", re.I

)

_HABIT_WENT_RE = re.compile(

    r"^(?:i\s+)?went\s+to\s+(?:the\s+)?(.+)$", re.I

)

_HABIT_NO_RE = re.compile(r"^no\s+(.+)$", re.I)

_HABIT_TRAILING_DONE_RE = re.compile(

    r"^(.+?)\s+(?:done|completed|finished)$", re.I

)

_HABIT_READ_RE = re.compile(r"^(?:i\s+)?read(?:\s+.*)?$", re.I)

_HABIT_MOVE_RE = re.compile(

    r"^(?:i\s+)?(?:went\s+)?(?:for\s+a\s+)?(walk|run|jog)(?:ged|ned|ning|s)?(?:\s+.*)?$",

    re.I,

)





def _normalize_phrase(value):

    return re.sub(r"[^a-z0-9 ]", "", (value or "").lower()).strip()





def _clean_habit_phrase(value):

    text = (value or "").strip().strip(" .!,;")

    text = re.sub(r"^(?:i|i've|ive)\s+", "", text, flags=re.I)

    text = re.sub(

        r"\b(?:for\s+)?\d+\s*(?:mins?|minutes?|hours?|hrs?|reps?|km|kms|pages?|sets?)\b",

        "",

        text,

        flags=re.I,

    )

    text = re.sub(r"\b(?:a|an)\s+", "", text, flags=re.I)

    text = re.sub(r"\s+", " ", text).strip(" .,-!")

    return text





def _resolve_habit_name(phrase):

    clean = _clean_habit_phrase(phrase)

    if not clean:

        return ""

    key = _normalize_phrase(clean)

    target = _HABIT_ALIASES.get(key, clean)

    target_key = _normalize_phrase(target)



    try:

        existing = list_habits()

    except Exception:

        existing = []



    for habit in existing:

        if _normalize_phrase(habit["name"]) == target_key:

            return habit["name"]



    best_name = None

    best_score = 0.0

    for habit in existing:

        candidate = _normalize_phrase(habit["name"])

        if not candidate:

            continue

        if target_key in candidate or candidate in target_key:

            return habit["name"]

        score = difflib.SequenceMatcher(None, target_key, candidate).ratio()

        if score > best_score:

            best_score = score

            best_name = habit["name"]

    if best_name and best_score >= 0.78:

        return best_name



    return target





def _parse_habit(line):

    """Return (status, name) for a habit statement, ('ask', name) if bare."""

    text = re.sub(r"\s+", " ", (line or "").strip().strip(" .!"))

    if not text:

        return None



    for pattern, status in HABIT_PATTERNS:

        match = re.match(pattern, text, re.I)

        if match:

            target = match.group(1).strip()

            if pattern.startswith(r"^(?:no\s+"):

                resolved = _resolve_habit_name(f"no {target}") or _resolve_habit_name(target)

            else:

                resolved = _resolve_habit_name(target)

            if resolved:

                return (status, resolved)



    if _HABIT_DIDNT_RE.match(text):

        name = _resolve_habit_name(_HABIT_DIDNT_RE.match(text).group(1))

        return ("skipped", name) if name else None

    if _HABIT_SKIP_RE.match(text):

        name = _resolve_habit_name(_HABIT_SKIP_RE.match(text).group(1))

        return ("skipped", name) if name else None

    if _HABIT_DONE_RE.match(text):

        name = _resolve_habit_name(_HABIT_DONE_RE.match(text).group(1))

        return ("done", name) if name else None

    if _HABIT_WENT_RE.match(text):

        name = _resolve_habit_name(_HABIT_WENT_RE.match(text).group(1))

        return ("done", name) if name else None

    if _HABIT_NO_RE.match(text):

        phrase = f"no {_HABIT_NO_RE.match(text).group(1)}"

        key = _normalize_phrase(phrase)

        known = key in _HABIT_ALIASES or any(

            _normalize_phrase(h["name"]) == key for h in list_habits()

        )

        if known:

            name = _resolve_habit_name(phrase)

            return ("done", name) if name else None

    if _HABIT_TRAILING_DONE_RE.match(text):

        name = _resolve_habit_name(_HABIT_TRAILING_DONE_RE.match(text).group(1))

        return ("done", name) if name else None

    if _HABIT_READ_RE.match(text):

        return ("done", _resolve_habit_name("reading"))

    move = _HABIT_MOVE_RE.match(text)

    if move:

        verb = move.group(1).lower()

        canonical = {"walk": "walking", "run": "running", "jog": "jogging"}[verb]

        return ("done", _resolve_habit_name(canonical))



    bare = _normalize_phrase(text)

    if bare in _HABIT_ALIASES:

        return ("ask", _resolve_habit_name(bare))

    for habit in list_habits():

        if _normalize_phrase(habit["name"]) == bare:

            return ("ask", habit["name"])

    return None





def _habit_action(status, name, spent_at):

    habit = log_habit(name, spent_at.isoformat(), status)

    label = _date_label(habit and spent_at.isoformat())

    streak = habit["streak"] if habit else 0

    completion = habit["completion_this_week"] if habit else 0



    if status == "done":

        if streak >= 1:

            message = f"Logged {name} as done for {label}. 🔥 {streak}-day streak!"

        else:

            message = f"Logged {name} as done for {label}. 🔥"

    else:

        message = f"Logged {name} as skipped for {label}. Tomorrow is a fresh start."



    milestone = streak if status == "done" and streak in (7, 30, 100) else None

    return {

        "kind": "logged_habit",

        "habit": habit,

        "habit_name": habit["name"] if habit else name,

        "status": status,

        "date": spent_at.isoformat(),

        "streak": streak,

        "completion_this_week": completion,

        "milestone": milestone,

        "message": message,

        "summary": f"{name} — {status} ({label})",

    }





def _spend_action(cleaned, spent_at):

    spent_at_iso = spent_at.isoformat()

    amount = 0.0

    merchant = ""



    spend = SPEND_RE.search(cleaned)

    if spend:

        amount = _amount(spend.group(1))

        merchant = _clean_merchant(spend.group(2))

    else:

        add = ADD_SPEND_RE.match(cleaned)

        if add:

            amount = _amount(add.group(1))

            merchant = _clean_merchant(add.group(2))

        else:

            bought = BOUGHT_RE.search(cleaned)

            if bought:

                amount = _amount(bought.group(2))

                item = _clean_merchant(bought.group(1))

                extra = _clean_merchant(bought.group(3))

                merchant = item if item.lower() not in {"", "it", "that", "this"} else extra

            else:

                bare = BARE_SPEND_RE.match(cleaned)

                if bare:

                    amount = _amount(bare.group(1))

                    merchant = _clean_merchant(bare.group(2))



    if amount <= 0:

        return None



    category = _infer_spend_category(f"{merchant} {cleaned}")

    if merchant.lower() == category:

        merchant = ""

    add_spend(amount, merchant, category, spent_at=spent_at_iso)



    bits = [f"Saved ₹{amount:g} to Money"]

    if merchant:

        bits.append(f"for {merchant}")

    if category and category != "other":

        bits.append(f"({category})")

    message = " ".join(bits) + f" — {_date_label(spent_at_iso)}."



    return {

        "kind": "expense",

        "amount": round(amount, 2),

        "merchant": merchant,

        "category": category,

        "spent_at": spent_at_iso,

        "message": message,

        "summary": f"{merchant or 'Expense'} — ₹{amount:g} ({category})",

    }





def _debt_action(cleaned, spent_at):

    # 1. Lent to person

    m = LENT_TO_RE.search(cleaned)

    if m:

        amount = _amount(m.group(1))

        person = m.group(2).strip()

        desc = (m.group(3) or "").strip()

        if amount > 0 and person:

            add_debt(person=person, direction="lent", amount=amount, description=desc, taken_at=spent_at.isoformat())

            msg = f"Recorded ₹{amount:g} lent to {person}" + (f" for {desc}" if desc else "") + "."

            return {"kind": "debt", "direction": "lent", "person": person, "amount": amount, "message": msg, "summary": f"Lent ₹{amount:g} to {person}"}



    # 2. Lent person amount

    m = LENT_PERSON_RE.search(cleaned)

    if m:

        person = m.group(1).strip()

        amount = _amount(m.group(2))

        desc = (m.group(3) or "").strip()

        if amount > 0 and person:

            add_debt(person=person, direction="lent", amount=amount, description=desc, taken_at=spent_at.isoformat())

            msg = f"Recorded ₹{amount:g} lent to {person}" + (f" for {desc}" if desc else "") + "."

            return {"kind": "debt", "direction": "lent", "person": person, "amount": amount, "message": msg, "summary": f"Lent ₹{amount:g} to {person}"}



    # 3. Person owes me

    m = OWES_ME_RE.search(cleaned)

    if m:

        person = m.group(1).strip()

        amount = _amount(m.group(2))

        desc = (m.group(3) or "").strip()

        if amount > 0 and person:

            add_debt(person=person, direction="lent", amount=amount, description=desc, taken_at=spent_at.isoformat())

            msg = f"Recorded that {person} owes you ₹{amount:g}" + (f" for {desc}" if desc else "") + "."

            return {"kind": "debt", "direction": "lent", "person": person, "amount": amount, "message": msg, "summary": f"{person} owes ₹{amount:g}"}



    # 4. Borrowed from person

    m = BORROWED_FROM_RE.search(cleaned)

    if m:

        amount = _amount(m.group(1))

        person = m.group(2).strip()

        desc = (m.group(3) or "").strip()

        if amount > 0 and person:

            add_debt(person=person, direction="borrowed", amount=amount, description=desc, taken_at=spent_at.isoformat())

            msg = f"Recorded ₹{amount:g} borrowed from {person}" + (f" for {desc}" if desc else "") + "."

            return {"kind": "debt", "direction": "borrowed", "person": person, "amount": amount, "message": msg, "summary": f"Borrowed ₹{amount:g} from {person}"}



    # 5. I owe person

    m = I_OWE_RE.search(cleaned)

    if m:

        person = m.group(1).strip()

        amount = _amount(m.group(2))

        desc = (m.group(3) or "").strip()

        if amount > 0 and person:

            add_debt(person=person, direction="borrowed", amount=amount, description=desc, taken_at=spent_at.isoformat())

            msg = f"Recorded that you owe {person} ₹{amount:g}" + (f" for {desc}" if desc else "") + "."

            return {"kind": "debt", "direction": "borrowed", "person": person, "amount": amount, "message": msg, "summary": f"Owe {person} ₹{amount:g}"}



    return None





def _sub_action(cleaned):

    m = SUB_RE.match(cleaned)

    if not m:

        return None

    name = m.group(1).strip()

    amount = _amount(m.group(2))

    cycle = (m.group(3) or "monthly").lower()

    if amount > 0 and name:

        add_subscription(name=name, amount=amount, billing_cycle=cycle)

        msg = f"Added subscription {name} (₹{amount:g}/{cycle})."

        return {"kind": "subscription", "name": name, "amount": amount, "cycle": cycle, "message": msg, "summary": f"Subscribed to {name}"}

    return None





def _note_action(line):

    m = NOTE_RE.match(line)

    if not m:

        return None

    body = m.group(1).strip()

    if body:

        save_note(body)

        return {"kind": "note", "content": body, "message": f'Saved note: "{body}"', "summary": f"Note: {body[:50]}"}

    return None





def _contact_action(line):

    m = CONTACTED_RE.match(line)

    if not m:

        return None

    person = m.group(1).strip()

    if person and len(person) >= 2:

        try:

            mark_contacted(person)

            return {"kind": "contact", "person": person, "message": f"Marked {person} as contacted today.", "summary": f"Contacted {person}"}

        except Exception:

            pass

    return None





def capture_entry(text):

    """Store a statement and return an action summary, or None.



    Omni Quick-Capture processes:

    - Quick Notes / Tasks ("note: remember to call mom")

    - Debts & IOUs ("lent 500 to Alex for dinner", "borrowed 1000 from Maya")

    - Subscriptions ("subscribed to Netflix 649")

    - Contacts ("met Alex today", "called Maya")

    - Spends ("spent 40 on coffee")

    - Habit logs ("did workout today")

    """

    line = (text or "").strip().strip(".")

    if not line or line.endswith("?"):

        return None



    # 1. Quick note check

    note_act = _note_action(line)

    if note_act:

        return note_act



    spent_at, cleaned = _extract_date(line)

    spent_at = spent_at or datetime.now().date()



    # 2. Debts / IOUs check

    debt_act = _debt_action(cleaned, spent_at)

    if debt_act:

        return debt_act



    # 3. Subscriptions check

    sub_act = _sub_action(cleaned)

    if sub_act:

        return sub_act



    # 4. Contact touchpoint check

    contact_act = _contact_action(cleaned)

    if contact_act:

        return contact_act



    # 5. Spend statements ("I spent 40 on coffee") win over habit matching.

    if _SPEND_WORDS.search(line):

        action = _spend_action(cleaned, spent_at)

        if action:

            return action



    # 6. Habit check

    parsed = _parse_habit(cleaned)

    if parsed:

        status, name = parsed

        if status == "ask":

            return {

                "kind": "habit_question",

                "habit_name": name,

                "message": (

                    f"Did you do {name} today? Say 'did {name} today' "

                    f"or 'skipped {name} today'."

                ),

                "summary": f"Confirm {name}",

            }

        if name:

            return _habit_action(status, name, spent_at)



    if _looks_like_question(line):

        return None



    return _spend_action(cleaned, spent_at)

