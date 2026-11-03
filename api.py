"""



api.py — JSON API router for the Context React frontend.



All endpoints return {ok: true, ...data} on success or {ok: false, error: "..."} on failure.



Mount at prefix="/api" in app.py.



"""



import os



import traceback



from datetime import datetime



from fastapi import APIRouter, HTTPException, UploadFile, File



from fastapi.responses import JSONResponse



from pydantic import BaseModel



from typing import Optional, Union, List, Any







from db import get_conn



from config import PORT







# ── domain imports ─────────────────────────────────────────────────────────────



from dots import find_forgotten_files, find_connections



from jobsearch import job_search_brief



from calendar_import import (



    index_ics, calendar_brief, clear_events, events_between, collisions_in_range, add_event, delete_event,



)



from gmail_import import (



    test_connection, save_credentials, delete_credentials,



    index_emails, gmail_brief, load_credentials,



)



from activity import recent_activity



from manual import parse_and_store, save_note



from capture import capture_entry



from ask import ask as ask_question



from groq_client import (



    test_key as groq_test_key,



    save_key as groq_save_key,



    delete_key as groq_delete_key,



    has_key as groq_has_key,



)



from people import (



    people_brief, get_person, extract_people_from_emails,



    mark_contacted, add_fact,



)



from spends import (
    spend_brief,
    add_spend,
    update_spend,
    delete_spend,
    summary as spends_summary,
    set_budget,
    delete_budget,
)



from habits import (



    add_habit, archive_habit, log_habit, clear_habit_log, update_habit,



    get_habit, list_habits, habit_streak, habit_insights,



)



from patterns import (



    detect_all as detect_patterns,



    patterns_brief,



    dismiss_pattern,



)



from jobsearch import apply_oneliner



from subscriptions import (



    add_subscription,



    update_subscription,



    delete_subscription,



    get_subscription,



    list_subscriptions,



    renew_subscription,



    subscriptions_summary,



)



from review import generate_weekly_review

from savings import (
    add_goal as savings_add_goal,
    update_goal as savings_update_goal,
    add_funds as savings_add_funds,
    delete_goal as savings_delete_goal,
    savings_summary,
)
from journal import (

    get_entry as journal_get_entry,

    save_entry as journal_save_entry,

    delete_entry as journal_delete_entry,

    list_entries as journal_list_entries,

    mood_matrix as journal_mood_matrix,

)

from debts import (



    add_debt,



    update_debt,



    settle_debt,



    delete_debt,



    get_debt,



    list_debts,



    debts_summary,



)



from vault import (



    get_salt as vault_get_salt,
    get_config as vault_get_config,
    reset_passphrase as vault_reset_passphrase,



    init_vault as vault_init,



    add_item as vault_add_item,



    update_item as vault_update_item,



    delete_item as vault_delete_item,



    list_items as vault_list_items,



    get_item as vault_get_item,



    wipe_vault as vault_wipe,



)







router = APIRouter()











# ═══════════════════════════════════════════════════════════════════════════════



# Helpers



# ═══════════════════════════════════════════════════════════════════════════════







def ok(**data):



    return {"ok": True, **data}











def err(msg: str, status: int = 400):



    return JSONResponse(status_code=status, content={"ok": False, "error": msg})











def _db_counts():



    conn = get_conn()



    counts = {k: conn.execute(f"SELECT COUNT(*) FROM {k}").fetchone()[0]



              for k in ["files", "history", "events", "emails", "chunks", "people", "spends"]}



    conn.close()



    return counts











# ═══════════════════════════════════════════════════════════════════════════════



# 1. GET /api/home  — full dashboard context



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/home")



def api_home(q: str = ""):



    try:



        conn = get_conn()



        if q:



            file_rows = conn.execute(



                "SELECT name, category, snippet(files, 3, '<b>', '</b>', '…', 20) AS snip, "



                "path, downloaded FROM files WHERE files MATCH ? LIMIT 25", (q,),



            ).fetchall()



            hist_rows = conn.execute(



                "SELECT title, url, snippet(history, 2, '<b>', '</b>', '…', 20) AS snip, "



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







        return ok(



            q=q,



            counts=counts,



            files=[dict(r) for r in file_rows],



            history=[dict(r) for r in hist_rows],



            forgotten=find_forgotten_files(),



            connections=find_connections(),



            job=job_search_brief(),



            cal=calendar_brief(),



            gmail=gmail_brief(),



            activity=recent_activity(15),



            has_groq=groq_has_key(),



            people=people_brief(),



            spend=spend_brief(),



            patterns=patterns_brief(),



        )



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 2. POST /api/ask



# ═══════════════════════════════════════════════════════════════════════════════







class AskBody(BaseModel):



    question: str











@router.post("/ask")



def api_ask(body: AskBody):



    try:



        # Statements such as "I spent 40 rupees yesterday" are data, not



        # questions. Store them first and skip the model entirely.



        action = capture_entry(body.question)



        if action:



            return ok(answer=action["message"], sources=[], action=action)



        if not groq_has_key():



            return err("Groq key not configured. Add one via /api/groq/connect.")



        answer, sources = ask_question(body.question)



        return ok(answer=answer, sources=sources)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 3. POST /api/quick



# ═══════════════════════════════════════════════════════════════════════════════







class QuickBody(BaseModel):



    line: str











@router.post("/quick")



def api_quick(body: QuickBody):



    line = (body.line or "").strip()



    if not line:



        return err("line is required")



    try:



        # Accept the same natural-language statements as the ask box.



        action = capture_entry(line)



        if action:



            return ok(message=action["message"], action=action)



        if parse_and_store(line):



            return ok(message="Stored via parser")



        if apply_oneliner(line):



            return ok(message="Stored as job action")



        save_note(line)



        return ok(message="Saved as note")



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 4. POST /api/ignore



# ═══════════════════════════════════════════════════════════════════════════════







class IgnoreBody(BaseModel):



    path: str











@router.post("/ignore")



def api_ignore(body: IgnoreBody):



    try:



        conn = get_conn()



        conn.execute(



            "INSERT OR IGNORE INTO ignored_files (path, ignored_at) VALUES (?, ?)",



            (body.path, datetime.now().isoformat(timespec="seconds")),



        )



        conn.commit()



        conn.close()



        return ok(message="File ignored")



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 5. POST /api/rescan



# ═══════════════════════════════════════════════════════════════════════════════







@router.post("/rescan")



def api_rescan():



    try:



        from indexer import run as run_indexer



        from rag import index_everything



        run_indexer()



        index_everything()



        detect_patterns()



        return ok(message="Rescan complete")



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 6. GET /api/config



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/config")



def api_config():



    creds = load_credentials()



    counts = _db_counts()



    return ok(



        currency="INR",



        symbol="₹",



        has_groq=groq_has_key(),



        gmail_connected=creds is not None,



        gmail_email=creds["email"] if creds else None,



        counts=counts,



    )











# ═══════════════════════════════════════════════════════════════════════════════



# 7. Calendar endpoints



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/calendar")



def api_calendar(start: str = "", end: str = ""):



    try:



        brief = calendar_brief()



        if start and end:



            brief["events"] = events_between(start, end)



            brief["collisions"] = collisions_in_range(start, end)



            brief["range"] = {"start": start, "end": end}

            conn = get_conn()
            spends_rows = conn.execute(
                "SELECT id, amount, merchant, category, spent_at, created_at FROM spends "
                "WHERE spent_at BETWEEN ? AND ? ORDER BY spent_at ASC",
                (start, end),
            ).fetchall()
            brief["spends"] = [dict(r) for r in spends_rows]
            
            debts_rows = conn.execute(
                "SELECT id, person, direction, amount, taken_at, due_date, settled, notes FROM debts "
                "WHERE (substr(taken_at, 1, 10) BETWEEN ? AND ?) OR (due_date IS NOT NULL AND substr(due_date, 1, 10) BETWEEN ? AND ?) "
                "ORDER BY taken_at ASC",
                (start, end, start, end),
            ).fetchall()
            brief["debts"] = [dict(r) for r in debts_rows]

            job_rows = conn.execute(
                "SELECT id, company, role, applied_at, status, cv_file, url, jd FROM applications "
                "WHERE substr(applied_at, 1, 10) BETWEEN ? AND ? ORDER BY applied_at ASC",
                (start[:10], end[:10]),
            ).fetchall()
            brief["applications"] = [dict(r) for r in job_rows]

            interview_rows = conn.execute(
                "SELECT id, company, scheduled_at, prep_docs FROM interviews WHERE scheduled_at IS NOT NULL",
            ).fetchall()
            brief["interviews"] = [dict(r) for r in interview_rows]
            conn.close()



        return ok(**brief)



    except Exception as e:



        return err(str(e), 500)











@router.post("/calendar/upload")



async def api_calendar_upload(file: UploadFile = File(...)):



    try:



        tmp = os.path.join(os.environ.get("TEMP", "/tmp"), f"ctx_{file.filename}")



        with open(tmp, "wb") as f:



            f.write(await file.read())



        count = index_ics(tmp, source_name=file.filename)



        from rag import index_all_events



        index_all_events()



        detect_patterns()



        return ok(message=f"Indexed {count} events", count=count)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/calendar/clear")



def api_calendar_clear():



    try:



        clear_events()



        return ok(message="All events cleared")



    except Exception as e:



        return err(str(e), 500)



class CalendarEventAddBody(BaseModel):
    title: str
    start_at: str
    end_at: Optional[str] = None
    category: str = "personal"
    location: Optional[str] = ""
    description: Optional[str] = ""


@router.post("/calendar/events")
def api_calendar_add_event(body: CalendarEventAddBody):
    if not body.title.strip():
        return err("Event title is required")
    try:
        ev = add_event(
            title=body.title.strip(),
            start_at=body.start_at,
            end_at=body.end_at,
            category=body.category,
            location=body.location or "",
            description=body.description or "",
        )
        return ok(event=ev, message=f"Scheduled '{body.title}'")
    except Exception as e:
        return err(str(e), 500)


@router.delete("/calendar/events/{event_id}")
def api_calendar_delete_event(event_id: int):
    try:
        deleted = delete_event(event_id)
        if not deleted:
            return err("Event not found", 404)
        return ok(message="Event deleted successfully")
    except Exception as e:
        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 8. Gmail endpoints



# ═══════════════════════════════════════════════════════════════════════════════







class GmailConnectBody(BaseModel):



    email: str



    app_password: str











@router.post("/gmail/connect")



def api_gmail_connect(body: GmailConnectBody):



    email_addr = body.email.strip()



    password = body.app_password.replace(" ", "").strip()



    ok_conn, msg = test_connection(email_addr, password)



    if not ok_conn:



        return err(msg)



    save_credentials(email_addr, password)



    result = index_emails()



    if result.get("ok"):



        from rag import index_all_emails, index_all_people



        index_all_emails()



        extract_people_from_emails()



        index_all_people()



        return ok(



            message="Gmail connected and emails indexed",



            new_inbox=result.get("new_inbox", 0),



            sent=result.get("sent", 0),



        )



    return err(result.get("error", "Fetch failed after connecting"))











@router.post("/gmail/fetch")



def api_gmail_fetch():



    result = index_emails()



    if result.get("ok"):



        from rag import index_all_emails, index_all_people



        index_all_emails()



        extract_people_from_emails()



        index_all_people()



        return ok(



            message=f"Fetched {result.get('new_inbox', 0)} inbox, {result.get('sent', 0)} sent",



            new_inbox=result.get("new_inbox", 0),



            sent=result.get("sent", 0),



        )



    return err(result.get("error", "Fetch failed"))











@router.post("/gmail/disconnect")



def api_gmail_disconnect():



    delete_credentials()



    return ok(message="Gmail disconnected")











@router.get("/email")



def api_email(filter: str = "all"):



    try:



        creds = load_credentials()



        conn = get_conn()



        counts = {



            "all": conn.execute("SELECT COUNT(*) FROM emails").fetchone()[0],



            "needs_reply": conn.execute(



                "SELECT COUNT(*) FROM emails WHERE needs_reply = 1 AND source = 'inbox'"



            ).fetchone()[0],



            "promises": conn.execute(



                "SELECT COUNT(*) FROM promises WHERE resolved = 0"



            ).fetchone()[0],



            "applications": conn.execute(



                "SELECT COUNT(*) FROM emails "



                "WHERE category IN ('application','interview','offer','rejection')"



            ).fetchone()[0],



        }



        if not creds:



            conn.close()



            return ok(connected=False, emails=[], promises=[], counts=counts)







        cols = ("id, from_addr, from_name, to_addr, subject, body_snippet, "



                "received_at, category, needs_reply, replied, thread_key, source")



        if filter == "needs_reply":



            rows = conn.execute(



                f"SELECT {cols} FROM emails WHERE needs_reply = 1 AND source = 'inbox' "



                "ORDER BY received_at DESC LIMIT 100"



            ).fetchall()



        elif filter == "applications":



            rows = conn.execute(



                f"SELECT {cols} FROM emails "



                "WHERE category IN ('application','interview','offer','rejection') "



                "ORDER BY received_at DESC LIMIT 100"



            ).fetchall()



        elif filter == "promises":



            rows = []



        else:



            rows = conn.execute(



                f"SELECT {cols} FROM emails ORDER BY received_at DESC LIMIT 100"



            ).fetchall()







        promises = conn.execute(



            "SELECT id, who, what, by_when, created_at FROM promises "



            "WHERE resolved = 0 ORDER BY created_at DESC LIMIT 50"



        ).fetchall()



        conn.close()



        return ok(



            connected=True,



            email=creds["email"],



            emails=[dict(r) for r in rows],



            promises=[dict(r) for r in promises],



            counts=counts,



        )



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 9. Groq endpoints



# ═══════════════════════════════════════════════════════════════════════════════







class GroqConnectBody(BaseModel):



    api_key: str











@router.post("/groq/connect")



def api_groq_connect(body: GroqConnectBody):



    key = body.api_key.strip()



    ok_key, msg = groq_test_key(key)



    if not ok_key:



        return err(msg)



    groq_save_key(key)



    return ok(message="Groq connected")











@router.post("/groq/disconnect")



def api_groq_disconnect():



    groq_delete_key()



    return ok(message="Groq disconnected")











# ═══════════════════════════════════════════════════════════════════════════════



# 10. Patterns endpoints



# ═══════════════════════════════════════════════════════════════════════════════







@router.post("/patterns/refresh")



def api_patterns_refresh():



    try:



        detect_patterns()



        brief = patterns_brief()



        return ok(**brief)



    except Exception as e:



        return err(str(e), 500)











class DismissBody(BaseModel):



    id: int











@router.post("/patterns/dismiss")



def api_patterns_dismiss(body: DismissBody):



    try:



        dismiss_pattern(body.id)



        return ok(message="Pattern dismissed")



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 11. Habits — dashboard tracker



# ═══════════════════════════════════════════════════════════════════════════════







class HabitAddBody(BaseModel):



    name: str



    emoji: Optional[str] = None



    color: Optional[str] = None



    target_per_week: Optional[int] = 7











class HabitLogBody(BaseModel):



    name: Optional[str] = None



    id: Optional[int] = None



    date: str = "today"



    status: str = "done"



    note: Optional[str] = None











class HabitRefBody(BaseModel):



    name: Optional[str] = None



    id: Optional[int] = None











class HabitClearBody(BaseModel):



    name: Optional[str] = None



    id: Optional[int] = None



    date: str = "today"











class HabitUpdateBody(BaseModel):



    name: Optional[str] = None



    id: Optional[int] = None



    new_name: Optional[str] = None



    emoji: Optional[str] = None



    color: Optional[str] = None



    target_per_week: Optional[int] = None











def _habit_ref(name, habit_id):



    return habit_id if habit_id is not None else name











@router.get("/habits")



def api_habits():



    try:



        return ok(habits=list_habits(), insights=habit_insights())



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/habits/add")



def api_habits_add(body: HabitAddBody):



    try:



        habit = add_habit(



            body.name,



            emoji=body.emoji,



            color=body.color,



            target_per_week=body.target_per_week,



        )



        return ok(habit=habit)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/habits/log")



def api_habits_log(body: HabitLogBody):



    ref = _habit_ref(body.name, body.id)



    if not ref:



        return err("name or id is required")



    if body.status not in ("done", "skipped"):



        return err("status must be 'done' or 'skipped'")



    try:



        habit = log_habit(ref, body.date, body.status, note=body.note)



        return ok(



            habit=habit,



            streak=habit["streak"],



            completion_this_week=habit["completion_this_week"],



        )



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/habits/clear")



def api_habits_clear(body: HabitClearBody):



    ref = _habit_ref(body.name, body.id)



    if not ref:



        return err("name or id is required")



    try:



        habit = clear_habit_log(ref, body.date)



        return ok(habit=habit)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/habits/update")



def api_habits_update(body: HabitUpdateBody):



    ref = _habit_ref(body.name, body.id)



    if not ref:



        return err("name or id is required")



    try:



        habit = update_habit(



            ref,



            new_name=body.new_name,



            emoji=body.emoji,



            color=body.color,



            target_per_week=body.target_per_week,



        )



        if not habit:



            return err("habit not found", 404)



        return ok(habit=habit)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/habits/archive")



def api_habits_archive(body: HabitRefBody):



    ref = _habit_ref(body.name, body.id)



    if not ref:



        return err("name or id is required")



    try:



        if not archive_habit(ref):



            return err("habit not found", 404)



        return ok()



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.get("/habits/{name}")



def api_habit_detail(name: str):



    try:



        habit = get_habit(name)



        if not habit:



            return err("habit not found", 404)



        return ok(habit=habit, logs=habit.get("logs", []))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 11b. Secure Personal Vault (Client-Side Encrypted)



# ═══════════════════════════════════════════════════════════════════════════════







class VaultSetupBody(BaseModel):
    salt: str
    verifier_ciphertext: Optional[str] = None
    verifier_iv: Optional[str] = None
    recovery_salt: Optional[str] = None
    encrypted_vek: Optional[str] = None
    encrypted_vek_iv: Optional[str] = None
    recovery_encrypted_vek: Optional[str] = None
    recovery_encrypted_vek_iv: Optional[str] = None


class VaultResetPassphraseBody(BaseModel):
    salt: str
    encrypted_vek: str
    encrypted_vek_iv: str
    verifier_ciphertext: str
    verifier_iv: str











class VaultItemAddBody(BaseModel):



    title: str



    category: str



    ciphertext: str



    iv: str











class VaultItemUpdateBody(BaseModel):



    title: Optional[str] = None



    category: Optional[str] = None



    ciphertext: Optional[str] = None



    iv: Optional[str] = None











class VaultWipeBody(BaseModel):



    confirm: str











@router.get("/vault/config")



def api_vault_config():



    try:



        cfg = vault_get_config()
        if not cfg or not cfg.get("salt"):
            return ok(
                exists=False,
                salt=None,
                verifier_ciphertext=None,
                verifier_iv=None,
                recovery_salt=None,
                encrypted_vek=None,
                encrypted_vek_iv=None,
                recovery_encrypted_vek=None,
                recovery_encrypted_vek_iv=None,
            )
        return ok(
            exists=True,
            salt=cfg["salt"],
            verifier_ciphertext=cfg.get("verifier_ciphertext"),
            verifier_iv=cfg.get("verifier_iv"),
            recovery_salt=cfg.get("recovery_salt"),
            encrypted_vek=cfg.get("encrypted_vek"),
            encrypted_vek_iv=cfg.get("encrypted_vek_iv"),
            recovery_encrypted_vek=cfg.get("recovery_encrypted_vek"),
            recovery_encrypted_vek_iv=cfg.get("recovery_encrypted_vek_iv"),
        )



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











class VaultVerifierBody(BaseModel):
    verifier_ciphertext: str
    verifier_iv: str


@router.put("/vault/verifier")
def api_vault_verifier(body: VaultVerifierBody):
    try:
        conn = get_conn()
        conn.execute(
            "UPDATE vault_config SET verifier_ciphertext = ?, verifier_iv = ? WHERE id = 1",
            (body.verifier_ciphertext, body.verifier_iv),
        )
        conn.commit()
        conn.close()
        return ok(message="verifier updated")
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)


@router.post("/vault/reset-passphrase")
def api_vault_reset_passphrase(body: VaultResetPassphraseBody):
    try:
        success = vault_reset_passphrase(
            body.salt.strip(),
            body.encrypted_vek,
            body.encrypted_vek_iv,
            body.verifier_ciphertext,
            body.verifier_iv,
        )
        return ok(message="Master passphrase updated successfully")
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)


@router.post("/vault/setup")



def api_vault_setup(body: VaultSetupBody):



    try:



        if not body.salt or not body.salt.strip():



            return err("salt is required")



        success = vault_init(
            body.salt.strip(),
            body.verifier_ciphertext,
            body.verifier_iv,
            body.recovery_salt,
            body.encrypted_vek,
            body.encrypted_vek_iv,
            body.recovery_encrypted_vek,
            body.recovery_encrypted_vek_iv,
        )



        if not success:



            return err("vault is already initialized", 400)



        return ok()



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.get("/vault/items")



def api_vault_items():



    try:



        items = vault_list_items()



        return ok(items=items)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/vault/items")



def api_vault_add_item(body: VaultItemAddBody):



    try:



        item = vault_add_item(body.title, body.category, body.ciphertext, body.iv)



        return ok(item=item)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.put("/vault/items/{item_id}")



def api_vault_update_item(item_id: int, body: VaultItemUpdateBody):



    try:



        updated = vault_update_item(



            item_id=item_id,



            title=body.title,



            category=body.category,



            ciphertext=body.ciphertext,



            iv=body.iv,



        )



        if not updated:



            return err("vault item not found", 404)



        return ok(item=updated)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.delete("/vault/items/{item_id}")



def api_vault_delete_item(item_id: int):



    try:



        deleted = vault_delete_item(item_id)



        if not deleted:



            return err("vault item not found", 404)



        return ok()



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











@router.post("/vault/wipe")



def api_vault_wipe(body: VaultWipeBody):



    if body.confirm != "DELETE VAULT":



        return err("type DELETE VAULT to confirm")



    try:



        count = vault_wipe()



        return ok(deleted=count)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# ═══════════════════════════════════════════════════════════════════════════════



# 11c. Subscriptions & Renewals Tracker



# ═══════════════════════════════════════════════════════════════════════════════







class SubscriptionAddBody(BaseModel):



    name: str



    amount: float



    billing_cycle: str = "monthly"



    category: str = "entertainment"



    next_renewal: Optional[str] = None



    payment_method: Optional[str] = ""



    auto_renew: bool = True



    notes: Optional[str] = ""







class SubscriptionUpdateBody(BaseModel):



    name: Optional[str] = None



    amount: Optional[float] = None



    billing_cycle: Optional[str] = None



    category: Optional[str] = None



    next_renewal: Optional[str] = None



    payment_method: Optional[str] = None



    auto_renew: Optional[bool] = None



    notes: Optional[str] = None







class SubscriptionRenewBody(BaseModel):



    log_spend: bool = True







@router.get("/subscriptions")



def api_subscriptions_list():



    try:



        items = list_subscriptions()



        summary = subscriptions_summary()



        return ok(subscriptions=items, summary=summary)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.post("/subscriptions")



def api_subscriptions_add(body: SubscriptionAddBody):



    try:



        sub = add_subscription(



            name=body.name,



            amount=body.amount,



            billing_cycle=body.billing_cycle,



            category=body.category,



            next_renewal=body.next_renewal,



            payment_method=body.payment_method or "",



            auto_renew=body.auto_renew,



            notes=body.notes or "",
            is_locked=bool(body.is_locked),



        )



        return ok(subscription=sub)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.put("/subscriptions/{sub_id}")



def api_subscriptions_update(sub_id: int, body: SubscriptionUpdateBody):



    try:



        sub = update_subscription(



            sub_id=sub_id,



            name=body.name,



            amount=body.amount,



            billing_cycle=body.billing_cycle,



            category=body.category,



            next_renewal=body.next_renewal,



            payment_method=body.payment_method,



            auto_renew=body.auto_renew,



            notes=body.notes,



        )



        if not sub:



            return err("subscription not found", 404)



        return ok(subscription=sub)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.delete("/subscriptions/{sub_id}")



def api_subscriptions_delete(sub_id: int):



    try:



        deleted = delete_subscription(sub_id)



        if not deleted:



            return err("subscription not found", 404)



        return ok()



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.post("/subscriptions/{sub_id}/renew")



def api_subscriptions_renew(sub_id: int, body: SubscriptionRenewBody):



    try:



        sub = renew_subscription(sub_id, log_spend=body.log_spend)



        if not sub:



            return err("subscription not found", 404)



        return ok(subscription=sub)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 11d. Debts & IOUs Tracker



# ═══════════════════════════════════════════════════════════════════════════════







class DebtAddBody(BaseModel):



    person: str



    direction: str  # 'borrowed' | 'lent'



    amount: float



    description: Optional[str] = ""



    due_date: Optional[str] = None



    notes: Optional[str] = ""



    taken_at: Optional[str] = None







class DebtUpdateBody(BaseModel):



    person: Optional[str] = None



    direction: Optional[str] = None



    amount: Optional[float] = None



    description: Optional[str] = None



    due_date: Optional[str] = None



    taken_at: Optional[str] = None



    settled: Optional[bool] = None



    notes: Optional[str] = None







class DebtSettleBody(BaseModel):



    settled: bool = True







@router.get("/debts")



def api_debts_list(settled: Optional[bool] = None, direction: Optional[str] = None):



    try:



        items = list_debts(settled=settled, direction=direction)



        summary = debts_summary()



        return ok(debts=items, summary=summary)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.post("/debts")



def api_debts_add(body: DebtAddBody):



    try:



        debt = add_debt(



            person=body.person,



            direction=body.direction,



            amount=body.amount,



            description=body.description or "",



            due_date=body.due_date,



            notes=body.notes or "",



            taken_at=body.taken_at,



        )



        return ok(debt=debt)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.put("/debts/{debt_id}")



def api_debts_update(debt_id: int, body: DebtUpdateBody):



    try:



        debt = update_debt(



            debt_id=debt_id,



            person=body.person,



            direction=body.direction,



            amount=body.amount,



            description=body.description,



            due_date=body.due_date,



            taken_at=body.taken_at,



            settled=body.settled,



            notes=body.notes,



        )



        if not debt:



            return err("debt not found", 404)



        return ok(debt=debt)



    except ValueError as e:



        return err(str(e))



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.post("/debts/{debt_id}/settle")



def api_debts_settle(debt_id: int, body: DebtSettleBody = DebtSettleBody()):



    try:



        debt = settle_debt(debt_id, settled=body.settled)



        if not debt:



            return err("debt not found", 404)



        return ok(debt=debt)



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)







@router.get("/review")

def api_weekly_review():

    try:

        data = generate_weekly_review()

        return ok(review=data)

    except Exception as e:

        traceback.print_exc()

        return err(str(e), 500)





# ═══════════════════════════════════════════════════════════════════════════════

# 11f. Daily Journal & 30-Day Mood Matrix

# ═══════════════════════════════════════════════════════════════════════════════



class JournalSaveBody(BaseModel):

    date: Optional[str] = None

    mood: int = 3

    headline: Optional[str] = ""

    content: Optional[str] = ""

    tags: Optional[Union[str, List[str]]] = ""



@router.get("/journal")

def api_journal_overview(days: int = 30):

    try:

        matrix = journal_mood_matrix(days=days)

        entries = journal_list_entries(limit=days)

        return ok(matrix=matrix, entries=entries)

    except Exception as e:

        traceback.print_exc()

        return err(str(e), 500)



@router.get("/journal/{date_str}")

def api_journal_get(date_str: str):

    try:

        entry = journal_get_entry(date_str)

        return ok(entry=entry)

    except Exception as e:

        traceback.print_exc()

        return err(str(e), 500)



@router.post("/journal")

def api_journal_save(body: JournalSaveBody):

    try:

        entry = journal_save_entry(

            date_str=body.date,

            mood=body.mood,

            headline=body.headline or "",

            content=body.content or "",

            tags=body.tags or "",

        )

        return ok(entry=entry)

    except Exception as e:

        traceback.print_exc()

        return err(str(e), 500)



class SavingGoalAddBody(BaseModel):
    title: str
    target_amount: float
    current_amount: Optional[float] = 0.0
    target_date: Optional[str] = None
    category: Optional[str] = "purchase"
    emoji: Optional[str] = "🎯"
    notes: Optional[str] = ""
    is_locked: Optional[bool] = False

class SavingGoalUpdateBody(BaseModel):
    title: Optional[str] = None
    target_amount: Optional[float] = None
    current_amount: Optional[float] = None
    target_date: Optional[str] = None
    category: Optional[str] = None
    emoji: Optional[str] = None
    notes: Optional[str] = None
    is_locked: Optional[bool] = None

class SavingGoalDepositBody(BaseModel):
    amount: float


@router.get("/savings")
def api_savings_list():
    try:
        data = savings_summary()
        return ok(summary=data, goals=data["goals"])
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)

@router.post("/savings")
def api_savings_add(body: SavingGoalAddBody):
    try:
        goal = savings_add_goal(
            title=body.title,
            target_amount=body.target_amount,
            current_amount=body.current_amount or 0.0,
            target_date=body.target_date,
            category=body.category or "purchase",
            emoji=body.emoji or "🎯",
            notes=body.notes or "",
            is_locked=bool(body.is_locked),
        )
        return ok(goal=goal)
    except ValueError as e:
        return err(str(e))
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)

@router.put("/savings/{goal_id}")
def api_savings_update(goal_id: int, body: SavingGoalUpdateBody):
    try:
        goal = savings_update_goal(
            goal_id=goal_id,
            title=body.title,
            target_amount=body.target_amount,
            current_amount=body.current_amount,
            target_date=body.target_date,
            category=body.category,
            emoji=body.emoji,
            notes=body.notes,
            is_locked=body.is_locked,
        )
        if not goal:
            return err("saving goal not found", 404)
        return ok(goal=goal)
    except ValueError as e:
        return err(str(e))
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)

@router.post("/savings/{goal_id}/deposit")
def api_savings_deposit(goal_id: int, body: SavingGoalDepositBody):
    try:
        goal = savings_add_funds(goal_id, body.amount)
        if not goal:
            return err("saving goal not found", 404)
        return ok(goal=goal)
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)

@router.delete("/savings/{goal_id}")
def api_savings_delete(goal_id: int):
    try:
        deleted = savings_delete_goal(goal_id)
        if not deleted:
            return err("saving goal not found", 404)
        return ok()
    except Exception as e:
        traceback.print_exc()
        return err(str(e), 500)

# ═══════════════════════════════════════════════════════════════════════════════
# 11g. Savings Goals Body Models
# ═══════════════════════════════════════════════════════════════════════════════




@router.delete("/journal/{date_str}")

def api_journal_delete(date_str: str):

    try:

        deleted = journal_delete_entry(date_str)

        return ok(deleted=deleted)

    except Exception as e:

        traceback.print_exc()

        return err(str(e), 500)





@router.delete("/debts/{debt_id}")



def api_debts_delete(debt_id: int):



    try:



        deleted = delete_debt(debt_id)



        if not deleted:



            return err("debt not found", 404)



        return ok()



    except Exception as e:



        traceback.print_exc()



        return err(str(e), 500)











# 12. GET /api/money/summary?period=week|month



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/money/summary")



def api_money_summary(period: str = "month"):



    if period not in ("week", "month"):



        return err("period must be 'week' or 'month'")



    try:



        data = spends_summary(period)



        return ok(**data)



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 12. POST /api/money/add



# ═══════════════════════════════════════════════════════════════════════════════







class MoneyAddBody(BaseModel):
    amount: float
    merchant: str = ""
    category: str = "other"
    spent_at: Optional[str] = None


class MoneyUpdateBody(BaseModel):
    amount: Optional[float] = None
    merchant: Optional[str] = None
    category: Optional[str] = None
    spent_at: Optional[str] = None


@router.post("/money/add")
def api_money_add(body: MoneyAddBody):
    if body.amount <= 0:
        return err("amount must be positive")
    try:
        sid = add_spend(body.amount, body.merchant, body.category, body.spent_at)
        return ok(id=sid, message=f"Logged ₹{body.amount:.0f} at {body.merchant or 'unknown'}")
    except Exception as e:
        return err(str(e), 500)


@router.put("/money/spends/{spend_id}")
@router.patch("/money/spends/{spend_id}")
def api_money_update(spend_id: int, body: MoneyUpdateBody):
    try:
        updated = update_spend(
            spend_id=spend_id,
            amount=body.amount,
            merchant=body.merchant,
            category=body.category,
            spent_at=body.spent_at,
        )
        if not updated:
            return err("Spend not found", 404)
        return ok(spend=updated, message="Updated successfully")
    except Exception as e:
        return err(str(e), 500)


@router.delete("/money/spends/{spend_id}")
def api_money_delete(spend_id: int):
    try:
        deleted = delete_spend(spend_id)
        if not deleted:
            return err("Spend not found", 404)
        return ok(message="Spend deleted successfully")
    except Exception as e:
        return err(str(e), 500)


class MoneyBudgetBody(BaseModel):
    category: str
    amount: float
    period: str = "month"


@router.post("/money/budget")
@router.put("/money/budget")
def api_money_set_budget(body: MoneyBudgetBody):
    if body.amount < 0:
        return err("budget amount must be non-negative")
    try:
        set_budget(body.category, body.amount, body.period)
        return ok(message=f"Budget for {body.category} set to ₹{body.amount:.0f}")
    except Exception as e:
        return err(str(e), 500)


@router.delete("/money/budget/{category}")
def api_money_delete_budget(category: str):
    try:
        delete_budget(category)
        return ok(message=f"Budget for {category} removed")
    except Exception as e:
        return err(str(e), 500)












# ═══════════════════════════════════════════════════════════════════════════════



# 13. GET /api/people  — full list with fact_count



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/people")



def api_people():



    try:



        conn = get_conn()



        rows = conn.execute(



            "SELECT p.id, p.name, p.birthday, p.last_contacted, p.tags, p.source, "



            "p.created_at, "



            "(SELECT COUNT(*) FROM person_facts pf "



            " WHERE pf.person_id = p.id AND pf.resolved = 0) AS fact_count "



            "FROM people p ORDER BY p.name COLLATE NOCASE"



        ).fetchall()



        conn.close()



        brief = people_brief()



        return ok(



            people=[dict(r) for r in rows],



            upcoming_birthdays=brief["upcoming_birthdays"],



            needing_contact=brief["needing_contact"],



            total=len(rows),



        )



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 14. GET /api/people/{name}  — single person detail



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/people/{name}")



def api_person(name: str):



    p = get_person(name)



    if not p:



        return err(f"Person '{name}' not found", 404)



    return ok(**p)











# ═══════════════════════════════════════════════════════════════════════════════



# 15. POST /api/people/{name}/contacted



# ═══════════════════════════════════════════════════════════════════════════════







@router.post("/people/{name}/contacted")



def api_person_contacted(name: str):



    result = mark_contacted(name)



    if not result:



        return err(f"Person '{name}' not found", 404)



    return ok(message=f"Marked {name} as contacted")











# ═══════════════════════════════════════════════════════════════════════════════



# 16. GET /api/jobs



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/jobs")



def api_jobs():



    try:



        return ok(**job_search_brief())



    except Exception as e:



        return err(str(e), 500)











class JobAddBody(BaseModel):
    company: str
    role: Optional[str] = None
    cv_file: Optional[str] = None
    url: Optional[str] = None
    jd: Optional[str] = None
    status: Optional[str] = "applied"
    interview_at: Optional[str] = None

class JobScheduleInterviewBody(BaseModel):
    company: str
    role: Optional[str] = None
    scheduled_at: str
    notes: Optional[str] = ""

class JobUpdateStatusBody(BaseModel):
    id: Optional[int] = None
    company: str
    status: str

class JobDeleteBody(BaseModel):
    id: Optional[int] = None
    company: str











@router.post("/jobs/add")



def api_jobs_add(body: JobAddBody):



    company = body.company.strip().title()



    if not company:



        return err("company is required")



    try:



        now = datetime.now().isoformat(timespec="seconds")



        conn = get_conn()



        conn.execute(



            "INSERT INTO applications (company, role, cv_file, applied_at, status, url, jd, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (company, (body.role or "").strip() or None,
             (body.cv_file or "").strip() or None, now,
             (body.status or "applied").strip().lower(),
             (body.url or "").strip() or None,
             (body.jd or "").strip() or None, now),
        )

        if body.interview_at:
            conn.execute("DELETE FROM interviews WHERE company = ?", (company,))
            conn.execute("INSERT INTO interviews (company, scheduled_at, created_at) VALUES (?, ?, ?)", (company, body.interview_at, now))
            try:
                from calendar_import import add_event
                desc = f"Job Application: {company}"
                if body.url:
                    desc += f" URL: {body.url}"
                add_event(title=f"Interview: {company}" + (f" - {body.role}" if body.role else ""), start_at=body.interview_at, category="interview", company=company, description=desc)
            except Exception as ev_err:
                print(f"Could not auto-add calendar interview event: {ev_err}")



        conn.execute(



            "INSERT OR IGNORE INTO companies (name, source, detected_at) "



            "VALUES (?, 'manual', ?)", (company, now),



        )



        conn.commit()



        conn.close()



        return ok(message=f"Application to {company} added")



    except Exception as e:



        return err(str(e), 500)












@router.post("/jobs/update-status")
def api_jobs_update_status(body: JobUpdateStatusBody):
    valid_statuses = {"applied", "interview", "offered", "rejected"}
    st = body.status.lower().strip()
    if st not in valid_statuses:
        return err(f"Invalid status: {body.status}")
    conn = get_conn()
    if body.id:
        conn.execute("UPDATE applications SET status = ? WHERE id = ?", (st, body.id))
    else:
        conn.execute("UPDATE applications SET status = ? WHERE company = ?", (st, body.company.strip()))
    conn.commit()
    conn.close()
    return ok(message=f"Status updated to {st}")


@router.post("/jobs/schedule-interview")
def api_jobs_schedule_interview(body: JobScheduleInterviewBody):
    company = body.company.strip().title()
    conn = get_conn()
    now = datetime.now().isoformat(timespec="seconds")
    conn.execute("UPDATE applications SET status = 'interview' WHERE company = ?", (company,))
    conn.execute("DELETE FROM interviews WHERE company = ?", (company,))
    conn.execute("INSERT INTO interviews (company, scheduled_at, created_at) VALUES (?, ?, ?)",
                 (company, body.scheduled_at, now))
    conn.commit()
    conn.close()

    try:
        from calendar_import import add_event
        ev = add_event(
            title=f"Interview: {company}" + (f" - {body.role}" if body.role else ""),
            start_at=body.scheduled_at,
            category="interview",
            company=company,
            description=body.notes or f"Interview for {company} {body.role or ''}",
        )
        return ok(event=ev, message=f"Interview scheduled and linked to Calendar for {company}!")
    except Exception as e:
        return ok(message=f"Interview saved for {company}")

@router.post("/jobs/delete")
def api_jobs_delete(body: JobDeleteBody):
    conn = get_conn()
    if body.id:
        conn.execute("DELETE FROM applications WHERE id = ?", (body.id,))
    else:
        conn.execute("DELETE FROM applications WHERE company = ?", (body.company.strip(),))
    conn.commit()
    conn.close()
    return ok(message="Application deleted")


# ═══════════════════════════════════════════════════════════════════════════════



# 17. GET /api/onboarding/summary



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/onboarding/summary")



def api_onboarding_summary():



    try:



        conn = get_conn()



        email_count = conn.execute("SELECT COUNT(*) FROM emails").fetchone()[0]



        people_count = conn.execute("SELECT COUNT(*) FROM people").fetchone()[0]



        file_count = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]



        event_count = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]



        chunk_count = conn.execute("SELECT COUNT(*) FROM chunks").fetchone()[0]



        conn.close()







        from spends import spend_brief as _sb



        spend = _sb()







        return ok(



            patterns=patterns_brief(),



            spend_week=spend["week_total"],



            spend_month=spend["month_total"],



            people_count=people_count,



            email_count=email_count,



            file_count=file_count,



            event_count=event_count,



            chunk_count=chunk_count,



            has_groq=groq_has_key(),



            gmail_connected=load_credentials() is not None,



        )



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 18. GET /api/search?q=  — explicit search endpoint



# ═══════════════════════════════════════════════════════════════════════════════







@router.get("/search")



def api_search(q: str = ""):



    if not q.strip():



        return err("q is required")



    try:



        conn = get_conn()



        files = conn.execute(



            "SELECT name, category, snippet(files, 3, '<b>', '</b>', '…', 20) AS snip, "



            "path, downloaded FROM files WHERE files MATCH ? LIMIT 25", (q,),



        ).fetchall()



        history = conn.execute(



            "SELECT title, url, snippet(history, 2, '<b>', '</b>', '…', 20) AS snip, "



            "last_visit FROM history WHERE history MATCH ? LIMIT 15", (q,),



        ).fetchall()



        conn.close()



        return ok(



            q=q,



            files=[dict(r) for r in files],



            history=[dict(r) for r in history],



        )



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 19. GET /api/files  — browse / filter indexed files



# ═══════════════════════════════════════════════════════════════════════════════







FILE_CATEGORY_MAP = {



    "pdf": "pdf",



    "docx": "doc",



    "code": "code",



    "images": "image",



    "invoices": "invoice",



}











@router.get("/files")



@router.get("/files/search")



def api_files(q: str = "", category: str = "all", limit: int = 120):



    try:



        limit = max(1, min(int(limit), 300))



        conn = get_conn()



        where = []



        params = []



        if category and category != "all":



            mapped = FILE_CATEGORY_MAP.get(category.lower(), category.lower())



            where.append("category = ?")



            params.append(mapped)



        if q.strip():



            where.append("files MATCH ?")



            fts_query = '"' + q.strip().replace('"', "") + '"*'



            params.append(fts_query)







        base_cols = ("name, category, path, downloaded, size_kb, "



                     "snippet(files, 3, '<b>', '</b>', '…', 24) AS snip")



        sql = f"SELECT {base_cols} FROM files"



        if where:



            sql += " WHERE " + " AND ".join(where)



        sql += " ORDER BY downloaded DESC LIMIT ?"







        try:



            rows = conn.execute(sql, (*params, limit)).fetchall()



        except Exception:



            # FTS syntax can reject punctuation — fall back to a LIKE scan.



            like = f"%{q.strip()}%"



            fallback = "SELECT name, category, path, downloaded, size_kb, '' AS snip FROM files"



            fparams = []



            if category and category != "all":



                fallback += " WHERE category = ?"



                fparams.append(FILE_CATEGORY_MAP.get(category.lower(), category.lower()))



                fallback += " AND (name LIKE ? OR path LIKE ?)"



                fparams.extend([like, like])



            elif q.strip():



                fallback += " WHERE (name LIKE ? OR path LIKE ?)"



                fparams.extend([like, like])



            fallback += " ORDER BY downloaded DESC LIMIT ?"



            rows = conn.execute(fallback, (*fparams, limit)).fetchall()







        category_rows = conn.execute(



            "SELECT category, COUNT(*) AS count FROM files GROUP BY category ORDER BY count DESC"



        ).fetchall()



        total = conn.execute("SELECT COUNT(*) FROM files").fetchone()[0]



        conn.close()



        return ok(



            q=q,



            category=category,



            total=total,



            categories=[dict(r) for r in category_rows],



            files=[dict(r) for r in rows],



        )



    except Exception as e:



        return err(str(e), 500)











# ═══════════════════════════════════════════════════════════════════════════════



# 20. POST /api/people/{name}/facts  — add a fact to a person



# ═══════════════════════════════════════════════════════════════════════════════







class FactBody(BaseModel):



    fact: str



    category: Optional[str] = None











@router.post("/people/{name}/facts")



def api_person_add_fact(name: str, body: FactBody):



    fact = body.fact.strip()



    if not fact:



        return err("fact is required")



    if not add_fact(name, fact, body.category):



        return err("could not save fact", 500)



    return ok(message="Fact added")











# ═══════════════════════════════════════════════════════════════════════════════



# 21. GET /api/data/export + POST /api/data/clear



# ═══════════════════════════════════════════════════════════════════════════════







EXPORT_TABLES = [



    "files", "history", "emails", "promises", "events", "people",



    "person_facts", "spends", "budgets", "applications", "interviews",



    "patterns_detected", "manual", "activity_log", "habits", "habit_logs",



]







CLEAR_TABLES = [



    "files", "history", "emails", "promises", "events", "people",



    "person_facts", "spends", "budgets", "applications", "interviews",



    "patterns_detected", "manual", "chunks", "activity_log",



    "habit_logs", "habits", "vault_config", "vault_items",



]











@router.get("/data/export")



def api_data_export():



    try:



        conn = get_conn()



        data = {}



        for table in EXPORT_TABLES:



            try:



                rows = conn.execute(f"SELECT * FROM {table}").fetchall()



                data[table] = [dict(r) for r in rows]



            except Exception:



                data[table] = []



        counts = {k: len(v) for k, v in data.items()}



        conn.close()



        return ok(



            exported_at=datetime.now().isoformat(timespec="seconds"),



            counts=counts,



            data=data,



        )



    except Exception as e:



        return err(str(e), 500)











class ClearBody(BaseModel):



    confirm: str











@router.post("/data/clear")



def api_data_clear(body: ClearBody):



    if body.confirm.strip().upper() != "DELETE":



        return err("type DELETE to confirm")



    try:



        conn = get_conn()



        cleared = {}



        for table in CLEAR_TABLES:



            try:



                cleared[table] = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]



                conn.execute(f"DELETE FROM {table}")



            except Exception:



                cleared[table] = 0



        conn.commit()



        conn.close()



        return ok(message="All indexed data cleared", cleared=cleared)



    except Exception as e:



        return err(str(e), 500)









# ═══════════════════════════════════════════════════════════════════════════════
# Authentication & User Accounts (SQLite Persisted)
# ═══════════════════════════════════════════════════════════════════════════════

class AuthRegisterBody(BaseModel):
    email: str
    password: str
    name: Optional[str] = None
    avatar: Optional[str] = None

class AuthLoginBody(BaseModel):
    email: str
    password: str

@router.post("/auth/register")
def auth_register(body: AuthRegisterBody):
    email = body.email.strip().lower()
    if not email:
        return err("Email is required")
    name = (body.name or "").strip() or email.split("@")[0].capitalize()
    user_id = f"usr_{int(datetime.now().timestamp())}_{email.split('@')[0][:6]}"
    now_str = datetime.now().isoformat()
    
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if row:
            conn.execute(
                "UPDATE users SET last_sign_in_at = ?, name = COALESCE(?, name) WHERE email = ?",
                (now_str, name, email)
            )
            conn.commit()
            u = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
            user_data = {
                "id": u["id"],
                "email": u["email"],
                "name": u["name"],
                "avatar": u["avatar"],
                "provider": u["provider"],
                "role": u["role"],
                "createdAt": u["created_at"],
                "lastSignInAt": u["last_sign_in_at"]
            }
            return ok(user=user_data, message="Account updated and signed in")

        conn.execute(
            """
            INSERT INTO users (id, email, name, password_hash, avatar, provider, role, created_at, last_sign_in_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (user_id, email, name, body.password, body.avatar, "email", "Owner", now_str, now_str)
        )
        conn.commit()
        user_data = {
            "id": user_id,
            "email": email,
            "name": name,
            "avatar": body.avatar,
            "provider": "email",
            "role": "Owner",
            "createdAt": now_str,
            "lastSignInAt": now_str
        }
        return ok(user=user_data, message=f"Welcome to Context, {name}!")
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()

@router.post("/auth/login")
def auth_login(body: AuthLoginBody):
    email = body.email.strip().lower()
    if not email:
        return err("Email is required")
    now_str = datetime.now().isoformat()
    
    conn = get_conn()
    try:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not row:
            user_id = f"usr_{int(datetime.now().timestamp())}_{email.split('@')[0][:6]}"
            name = email.split("@")[0].capitalize()
            conn.execute(
                """
                INSERT INTO users (id, email, name, password_hash, provider, role, created_at, last_sign_in_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (user_id, email, name, body.password, "email", "Owner", now_str, now_str)
            )
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        else:
            conn.execute("UPDATE users SET last_sign_in_at = ? WHERE email = ?", (now_str, email))
            conn.commit()
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()

        user_data = {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "avatar": row["avatar"],
            "provider": row["provider"],
            "role": row["role"],
            "createdAt": row["created_at"],
            "lastSignInAt": row["last_sign_in_at"]
        }
        return ok(user=user_data, message=f"Signed in as {row['email']}")
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()

@router.get("/auth/me")
def auth_me(email: Optional[str] = None):
    conn = get_conn()
    try:
        if email:
            row = conn.execute("SELECT * FROM users WHERE email = ?", (email.strip().lower(),)).fetchone()
        else:
            row = conn.execute("SELECT * FROM users ORDER BY last_sign_in_at DESC LIMIT 1").fetchone()
        
        if not row:
            return ok(user=None)
        
        user_data = {
            "id": row["id"],
            "email": row["email"],
            "name": row["name"],
            "avatar": row["avatar"],
            "provider": row["provider"],
            "role": row["role"],
            "createdAt": row["created_at"],
            "lastSignInAt": row["last_sign_in_at"]
        }
        return ok(user=user_data)
    except Exception as e:
        return err(str(e), 500)
    finally:
        conn.close()

@router.post("/auth/logout")
def auth_logout():
    return ok(message="Signed out successfully")
