import os, re, json, imaplib, email
import html as html_lib
from datetime import datetime, timedelta
from email.header import decode_header
from email.utils import parsedate_to_datetime, parseaddr

from config import GMAIL_CRED_PATH, GMAIL_FETCH_DAYS, GMAIL_MAX_INBOX, GMAIL_MAX_SENT
from db import get_conn


_EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def _imap_date(dt):
    """IMAP SINCE date — always English months, regardless of system locale."""
    return f"{dt.day:02d}-{_EN_MONTHS[dt.month - 1]}-{dt.year}"

# ================= Credentials =================

def load_credentials():
    if not os.path.exists(GMAIL_CRED_PATH):
        return None
    try:
        return json.load(open(GMAIL_CRED_PATH))
    except Exception:
        return None


def save_credentials(email_addr, app_password):
    data = {"email": email_addr, "app_password": app_password}
    # best-effort chmod 600
    with open(GMAIL_CRED_PATH, "w") as f:
        json.dump(data, f)
    try:
        os.chmod(GMAIL_CRED_PATH, 0o600)
    except Exception:
        pass


def delete_credentials():
    if os.path.exists(GMAIL_CRED_PATH):
        os.remove(GMAIL_CRED_PATH)


def test_connection(email_addr, app_password):
    """Return (ok, message)."""
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(email_addr, app_password)
        mail.logout()
        return True, "OK"
    except imaplib.IMAP4.error as e:
        return False, f"Login failed: {e}"
    except Exception as e:
        return False, f"Connection error: {e}"


# ================= Helpers =================

def _decode_header(raw):
    if not raw:
        return ""
    parts = decode_header(raw)
    out = []
    for content, enc in parts:
        if isinstance(content, bytes):
            try:
                out.append(content.decode(enc or "utf-8", errors="ignore"))
            except Exception:
                out.append(content.decode("utf-8", errors="ignore"))
        else:
            out.append(content)
    return " ".join(str(part) for part in out).strip()


def _clean_snippet(text):
    """Marketing mail is often single-part HTML (or text/plain + CSS); never show raw markup."""
    text = html_lib.unescape(text)
    text = re.sub(r"(?is)<(script|style)\b.*?</\1>", " ", text)
    text = re.sub(
        r"(?:(?:[.#]?[A-Za-z][\w-]*|\*)(?:\s*[,>+~]\s*(?:[.#]?[A-Za-z][\w-]*|\*))*\s*)\{[^{}]*\}",
        " ",
        text,
    )
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def _get_body_snippet(msg, max_chars=400):
    if msg.is_multipart():
        for part in msg.walk():
            if part.get_content_type() == "text/plain":
                try:
                    payload = part.get_payload(decode=True)
                    if payload:
                        text = payload.decode(part.get_content_charset() or "utf-8", errors="ignore")
                        return _clean_snippet(text)[:max_chars]
                except Exception:
                    continue
    else:
        try:
            payload = msg.get_payload(decode=True)
            if payload:
                text = payload.decode(msg.get_content_charset() or "utf-8", errors="ignore")
                return _clean_snippet(text)[:max_chars]
        except Exception:
            pass
    return ""


def _normalize_subject(subject):
    """Strip Re:, Fwd:, Fw:, [tags], lowercase, collapse spaces — for threading."""
    if not subject:
        return ""
    s = subject.lower()
    s = re.sub(r"^(\s*(re|fw|fwd)\s*:\s*)+", "", s)
    s = re.sub(r"\[[^\]]{1,40}\]", "", s)   # [List], [tag]
    s = re.sub(r"\s+", " ", s).strip()
    return s[:120]


# ================= Classification =================

KNOWN_COMPANIES = [
    "Infosys", "TCS", "Wipro", "Accenture", "Cognizant", "Capgemini", "HCL",
    "Amazon", "Google", "Microsoft", "Meta", "Apple", "Netflix",
    "Flipkart", "Swiggy", "Zomato", "Razorpay", "CRED", "Paytm", "PhonePe",
    "Picklix", "Freshworks", "Zoho", "Atlassian", "Adobe", "Uber", "Ola",
    "Meesho", "Nykaa", "Groww", "Zerodha", "Postman", "BrowserStack",
    "PayPal", "Salesforce", "Oracle", "SAP", "IBM", "Deloitte", "PwC", "EY", "KPMG",
]

RE_APPLICATION = re.compile(
    r"(thank(s| you) for (your )?appl|we('ve| have)? received your appl|"
    r"your application (to|for|has|was)|application (received|submitted|successfully)|"
    r"successfully applied|we've got your application)",
    re.I,
)
RE_INTERVIEW = re.compile(
    r"(invite (you )?to (an )?interview|would like to schedule (an )?interview|"
    r"interview (invitation|scheduled|slot|call|round)|"
    r"schedule (a |an )?(call|meeting) to discuss your appl)",
    re.I,
)
RE_REJECTION = re.compile(
    r"(regret to inform|unfortunately.{0,120}(not moving forward|decided not to|other candidates)|"
    r"we('ve| have)? decided not to proceed|not (moving forward|selected|shortlisted))",
    re.I,
)
RE_OFFER = re.compile(
    r"(pleased to offer|happy to offer|offer letter|job offer|extend(ing)? an offer)",
    re.I,
)
RE_NEWSLETTER = re.compile(r"(unsubscribe|newsletter|webinar|promotional|mailing list)", re.I)
RE_NOTIFICATION = re.compile(
    r"(noreply|no-reply|do-not-reply|notification|github|linkedin alert|"
    r"instagram|facebook|twitter|google alert|medium daily|quora digest)",
    re.I,
)


def classify_email(from_addr, from_name, subject, body):
    """Return one of: application | interview | rejection | offer | receipt
    | newsletter | notification | normal."""
    text = f"{subject} {body}"
    addr = (from_addr or "").lower()

    if RE_NEWSLETTER.search(text) or RE_NEWSLETTER.search(addr):
        return "newsletter"
    if RE_NOTIFICATION.search(addr) or RE_NOTIFICATION.search(text[:200]):
        return "notification"
    if RE_OFFER.search(text):
        return "offer"
    if RE_REJECTION.search(text):
        return "rejection"
    if RE_INTERVIEW.search(text):
        return "interview"
    if RE_APPLICATION.search(text):
        return "application"
    return "normal"


def detect_company_from_addr(from_addr, subject):
    text = f"{from_addr} {subject}".lower()
    for c in KNOWN_COMPANIES:
        if c.lower() in text:
            return c
    return None


# ================= Promise detection (from Sent) =================

RE_PROMISE = re.compile(
    r"\b(?:i['’]ll|i will)\s+"
    r"(send|share|get|do|check|review|look at|introduce|forward|prepare|"
    r"follow up|reply|respond|update|finish|complete)",
    re.I,
)


def extract_promise(body):
    if not body:
        return None
    m = RE_PROMISE.search(body)
    if not m:
        return None
    # Grab a sentence-ish window around the match
    start = max(0, m.start() - 20)
    end = min(len(body), m.end() + 120)
    snippet = body[start:end].strip()
    return snippet[:200]


# ================= IMAP fetch =================

def _open_mail():
    creds = load_credentials()
    if not creds:
        return None, "Not connected"
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(creds["email"], creds["app_password"])
        return mail, None
    except Exception as e:
        return None, f"Login failed: {e}"


def _find_sent_folder(mail):
    for name in ["[Gmail]/Sent Mail", "[Gmail]/Sent", "Sent", "Sent Items"]:
        status, _ = mail.select(f'"{name}"', readonly=True)
        if status == "OK":
            return name
    return None


def _fetch_folder(mail, folder, days, max_msgs):
    """Return list of dicts with parsed headers + body snippet."""
    print(f"  [_fetch_folder] selecting {folder!r}")
    status, _ = mail.select(f'"{folder}"', readonly=True)
    if status != "OK":
        print(f"  [_fetch_folder] select failed: {status}")
        return []

    since = _imap_date(datetime.now() - timedelta(days=days))
    print(f"  [_fetch_folder] SEARCH SINCE {since!r}")
    status, data = mail.uid("SEARCH", None, f"SINCE {since}")
    if status != "OK":
        print(f"  [_fetch_folder] SEARCH failed: {status}")
        return []

    all_uids = data[0].split() if data and data[0] else []
    uids = all_uids[-max_msgs:]
    print(f"  [_fetch_folder] {len(all_uids)} total, fetching {len(uids)}")

    out = []
    for idx, uid_b in enumerate(uids):
        uid = uid_b.decode() if isinstance(uid_b, bytes) else str(uid_b)
        try:
            # Full message: Gmail puts many Delivered-To/Received headers first,
            # so a byte-limited fetch can truncate before Subject/From/Date.
            status, msg_data = mail.uid("FETCH", uid, "(BODY.PEEK[])")
            if status != "OK" or not msg_data or not msg_data[0]:
                continue
            raw = msg_data[0][1]
            msg = email.message_from_bytes(raw)

            from_name, from_addr = parseaddr(str(msg.get("From", "") or ""))
            to_name, to_addr = parseaddr(str(msg.get("To", "") or ""))
            subject = _decode_header(str(msg.get("Subject", "") or ""))
            body = _get_body_snippet(msg, max_chars=400)

            date_raw = msg.get("Date", "")
            try:
                ts = parsedate_to_datetime(date_raw).replace(tzinfo=None).isoformat(timespec="seconds")
            except Exception:
                ts = datetime.now().isoformat(timespec="seconds")

            out.append({
                "uid": uid,
                "from_addr": from_addr[:200],
                "from_name": _decode_header(from_name)[:100],
                "to_addr": to_addr[:200],
                "subject": subject[:300],
                "body_snippet": body,
                "received_at": ts,
                "thread_key": _normalize_subject(subject),
            })
        except Exception as e:
            print(f"  [email parse fail {uid}] {e}")
            continue

        if idx % 10 == 0:
            print(f"  [_fetch_folder] {idx + 1}/{len(uids)}")

    print(f"  [_fetch_folder] done, parsed {len(out)}/{len(uids)}")
    return out


# ================= Index =================

def index_emails(days=None):
    """Fetch inbox + sent, classify, store, auto-create applications/interviews/promises."""
    days = days or GMAIL_FETCH_DAYS
    print(f"[gmail] starting fetch (last {days} days)")
    mail, err = _open_mail()
    if not mail:
        print(f"[gmail] open failed: {err}")
        return {"ok": False, "error": err}

    print("[gmail] fetching INBOX")
    inbox = _fetch_folder(mail, "INBOX", days, GMAIL_MAX_INBOX)
    print(f"[gmail] inbox parsed: {len(inbox)}")

    sent_folder = _find_sent_folder(mail)
    print(f"[gmail] sent folder: {sent_folder!r}")
    sent = _fetch_folder(mail, sent_folder, days, GMAIL_MAX_SENT) if sent_folder else []
    print(f"[gmail] sent parsed: {len(sent)}")

    mail.logout()
    print("[gmail] logged out, writing to DB")

    # Build reply map: thread_key -> set of sent timestamps
    sent_by_thread = {}
    for s in sent:
        sent_by_thread.setdefault(s["thread_key"], []).append(s["received_at"])

    conn = get_conn()
    now = datetime.now().isoformat(timespec="seconds")

    new_count = 0
    apps_created = 0
    interviews_created = 0
    promises_found = 0

    # Store sent emails (source=sent, no needs_reply)
    for s in sent:
        conn.execute("DELETE FROM emails WHERE uid = ?", (s["uid"],))
        conn.execute(
            "INSERT INTO emails (uid, from_addr, from_name, to_addr, subject, "
            "body_snippet, received_at, category, needs_reply, replied, "
            "thread_key, source, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, 'normal', 0, 1, ?, 'sent', ?)",
            (s["uid"], s["from_addr"], s["from_name"], s["to_addr"],
             s["subject"], s["body_snippet"], s["received_at"],
             s["thread_key"], now),
        )

        # Detect promise in sent body
        promise = extract_promise(s["body_snippet"])
        if promise:
            existing = conn.execute(
                "SELECT id FROM promises WHERE source = ?", (s["uid"],)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO promises (who, what, by_when, source, created_at) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (s["to_addr"], promise, None, s["uid"], now),
                )
                promises_found += 1

    # Store inbox emails with classification
    for i in inbox:
        cat = classify_email(i["from_addr"], i["from_name"], i["subject"], i["body_snippet"])

        # Reply detection
        replies = sent_by_thread.get(i["thread_key"], [])
        replied = any(ts > i["received_at"] for ts in replies)
        age_hours = 0
        try:
            age_hours = (datetime.now() - datetime.fromisoformat(i["received_at"])).total_seconds() / 3600
        except Exception:
            pass
        needs_reply = (
            not replied
            and age_hours >= 24
            and cat not in ("newsletter", "notification")
            and "noreply" not in i["from_addr"].lower()
            and "no-reply" not in i["from_addr"].lower()
        )

        conn.execute("DELETE FROM emails WHERE uid = ?", (i["uid"],))
        conn.execute(
            "INSERT INTO emails (uid, from_addr, from_name, to_addr, subject, "
            "body_snippet, received_at, category, needs_reply, replied, "
            "thread_key, source, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inbox', ?)",
            (i["uid"], i["from_addr"], i["from_name"], i["to_addr"],
             i["subject"], i["body_snippet"], i["received_at"], cat,
             1 if needs_reply else 0, 1 if replied else 0,
             i["thread_key"], now),
        )
        new_count += 1

        # Auto-create application / interview from relevant emails
        company = detect_company_from_addr(i["from_addr"], i["subject"])
        if company and cat in ("application", "interview"):
            existing = conn.execute(
                "SELECT id FROM applications WHERE company = ? "
                "AND status IN ('applied','interview')", (company,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO applications (company, status, applied_at, "
                    "notes, created_at) VALUES (?, 'applied', ?, ?, ?)",
                    (company, i["received_at"][:10],
                     f"auto-detected from email: {i['subject'][:100]}", now),
                )
                apps_created += 1

        if company and cat == "interview":
            existing = conn.execute(
                "SELECT id FROM interviews WHERE company = ?", (company,)
            ).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO interviews (company, scheduled_at, notes, created_at) "
                    "VALUES (?, ?, ?, ?)",
                    (company, "TBD (see email)",
                     f"from: {i['subject'][:150]}", now),
                )
                interviews_created += 1

    conn.commit()
    conn.close()

    return {
        "ok": True,
        "inbox": len(inbox),
        "sent": len(sent),
        "new_inbox": new_count,
        "apps_created": apps_created,
        "interviews_created": interviews_created,
        "promises_found": promises_found,
    }


# ================= Brief =================

def gmail_brief():
    creds = load_credentials()
    if not creds:
        return {"connected": False, "email": None, "unanswered": [],
                "recent_promises": [], "total_emails": 0, "recent_app_email": []}

    conn = get_conn()
    total = conn.execute("SELECT COUNT(*) FROM emails").fetchone()[0]

    unanswered = conn.execute(
        "SELECT from_addr, from_name, subject, body_snippet, received_at "
        "FROM emails WHERE needs_reply = 1 AND source = 'inbox' "
        "ORDER BY received_at DESC LIMIT 8"
    ).fetchall()

    recent_promises = conn.execute(
        "SELECT who, what, by_when, created_at FROM promises "
        "WHERE resolved = 0 ORDER BY created_at DESC LIMIT 8"
    ).fetchall()

    recent_app_email = conn.execute(
        "SELECT from_addr, subject, received_at FROM emails "
        "WHERE source = 'inbox' AND category IN ('application','interview','offer','rejection') "
        "ORDER BY received_at DESC LIMIT 6"
    ).fetchall()

    conn.close()
    return {
        "connected": True,
        "email": creds["email"],
        "total_emails": total,
        "unanswered": [dict(r) for r in unanswered],
        "recent_promises": [dict(r) for r in recent_promises],
        "recent_app_email": [dict(r) for r in recent_app_email],
    }