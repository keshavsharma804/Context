import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

import json, re, os
from datetime import datetime
from core.db import get_conn


KNOWN_COMPANIES = [
    "Infosys", "TCS", "Wipro", "Accenture", "Cognizant", "Capgemini", "HCL",
    "Amazon", "Google", "Microsoft", "Meta", "Apple", "Netflix",
    "Flipkart", "Swiggy", "Zomato", "Razorpay", "CRED", "Paytm", "PhonePe",
    "Picklix", "Freshworks", "Zoho", "Atlassian", "Adobe", "Uber", "Ola",
    "Meesho", "Nykaa", "Groww", "Zerodha", "Postman", "BrowserStack",
    "PayPal", "Salesforce", "Oracle", "SAP", "IBM", "Deloitte", "PwC", "EY", "KPMG",
]


# ---------- Detection ----------
def detect_companies_from_files():
    conn = get_conn()
    rows = conn.execute("SELECT name FROM files").fetchall()
    conn.close()
    detected = set()
    for r in rows:
        name = r["name"] or ""
        for company in KNOWN_COMPANIES:
            # \b before but NO \b after — allows "Infosys_" and "InfosysSucks"
            if re.search(rf"\b{re.escape(company)}", name, re.I):
                detected.add(company)
    return detected


def detect_prep_docs(company):
    conn = get_conn()
    rows = conn.execute(
        "SELECT name, path, last_opened FROM files "
        "WHERE name LIKE ? AND ("
        "  name LIKE '%interview%' OR name LIKE '%prep%' OR "
        "  name LIKE '%handbook%' OR name LIKE '%QA%' OR "
        "  name LIKE '%questions%' OR name LIKE '%topics%' OR "
        "  name LIKE '%pending%' OR name LIKE '%scenario%'"
        ") ORDER BY last_opened DESC",
        (f"%{company}%",),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def detect_cvs():
    conn = get_conn()
    rows = conn.execute(
        "SELECT name, path FROM files WHERE category = 'resume' "
        "ORDER BY downloaded DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def detect_application_forms():
    conn = get_conn()
    rows = conn.execute("SELECT name, path FROM files").fetchall()
    conn.close()
    out = []
    for r in rows:
        n = (r["name"] or "").lower()
        # "application" or "registration" anywhere, OR "form" as a whole word
        if re.search(r"application|registration", n) or \
           re.search(r"(^|[\s_\-])form([\s_\-.]|$)", n):
            out.append(dict(r))
    return out


def detect_job_portal_visits(days=30):
    conn = get_conn()
    rows = conn.execute(
        "SELECT url, title, last_visit FROM history WHERE ("
        "  url LIKE '%linkedin.com/jobs%' OR "
        "  url LIKE '%naukri%' OR "
        "  url LIKE '%instahyre%' OR "
        "  url LIKE '%cutshort%' OR "
        "  url LIKE '%wellfound%' OR "
        "  url LIKE '%angel.co%' OR "
        "  url LIKE '%hirect%' OR "
        "  url LIKE '%internshala%' OR "
        "  url LIKE '%unstop%' OR "
        "  url LIKE '%/careers/%' OR "
        "  url LIKE '%/careers' OR "
        "  url LIKE '%/jobs/%'"
        ") AND url NOT LIKE '%github.com%' "
        "ORDER BY last_visit DESC LIMIT 50"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# ---------- One-liner parser ----------
_ACTIONS = {
    "applied": "applied", "apply": "applied",
    "interview": "interview",
    "rejected": "rejected", "reject": "rejected",
    "offered": "offered", "offer": "offered",
    "followup": "followup", "follow": "followup",
}


def parse_oneliner(line):
    parts = (line or "").strip().split()
    if not parts:
        return None
    action = _ACTIONS.get(parts[0].lower())
    if not action:
        return None

    if action == "applied":
        if len(parts) < 2:
            return None
        return {"kind": "applied", "company": parts[1].title(),
                "cv_file": parts[2] if len(parts) >= 3 else None}

    if action == "interview":
        if len(parts) < 3:
            return None
        return {"kind": "interview", "company": parts[1].title(),
                "when": " ".join(parts[2:])}

    if action in ("rejected", "offered", "followup"):
        if len(parts) < 2:
            return None
        return {"kind": action, "company": parts[1].title()}

    return None


def apply_oneliner(line):
    parsed = parse_oneliner(line)
    if not parsed:
        return False
    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()

    if parsed["kind"] == "applied":
        conn.execute(
            "INSERT INTO applications (company, cv_file, applied_at, status, created_at) "
            "VALUES (?, ?, ?, 'applied', ?)",
            (parsed["company"], parsed["cv_file"], now, now),
        )
        conn.execute(
            "INSERT OR IGNORE INTO companies (name, source, detected_at) "
            "VALUES (?, 'manual', ?)", (parsed["company"], now),
        )

    elif parsed["kind"] == "interview":
        conn.execute(
            "INSERT INTO interviews (company, scheduled_at, created_at) VALUES (?, ?, ?)",
            (parsed["company"], parsed["when"], now),
        )
        conn.execute(
            "UPDATE applications SET status = 'interview' "
            "WHERE company = ? AND status = 'applied'", (parsed["company"],),
        )

    elif parsed["kind"] == "rejected":
        conn.execute(
            "UPDATE applications SET status = 'rejected' WHERE company = ?",
            (parsed["company"],),
        )

    elif parsed["kind"] == "offered":
        conn.execute(
            "UPDATE applications SET status = 'offered' WHERE company = ?",
            (parsed["company"],),
        )

    elif parsed["kind"] == "followup":
        conn.execute(
            "UPDATE applications SET notes = COALESCE(notes,'') || "
            "' [followed up ' || ? || ']' WHERE company = ?",
            (now[:10], parsed["company"]),
        )

    conn.commit()
    conn.close()
    return True

def job_search_brief():
    conn = get_conn()
    apps = conn.execute(
        "SELECT id, company, role, cv_file, applied_at, status, notes, url, jd "
        "FROM applications ORDER BY applied_at DESC"
    ).fetchall()
    interviews = conn.execute(
        "SELECT company, scheduled_at, prep_docs FROM interviews ORDER BY scheduled_at"
    ).fetchall()
    conn.close()

    detected = detect_companies_from_files()
    cvs = detect_cvs()
    forms = detect_application_forms()
    portal_visits = detect_job_portal_visits()

    # Attach prep docs to each interview — case-insensitive
    interviews_out = []
    for i in interviews:
        idict = dict(i)
        matched = next(
            (c for c in detected if c.lower() == idict["company"].lower()),
            idict["company"],
        )
        idict["prep_docs"] = detect_prep_docs(matched)
        interviews_out.append(idict)

    # Prep docs per detected company (for the "Assets detected" section)
    prep_by_company = {c: detect_prep_docs(c) for c in detected}

    return {
        "applications": [dict(a) for a in apps],
        "interviews": interviews_out,
        "detected_companies": sorted(detected),
        "cvs": cvs,
        "forms": forms,
        "prep_by_company": prep_by_company,
        "portal_visits": portal_visits[:10],
    }