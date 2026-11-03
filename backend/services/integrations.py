"""Per-user encrypted integration credentials; never fall back to shared keys."""

import json
import os

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException

from core.db import get_conn
from core.user_context import current_user_id


def _cipher():
    key = os.getenv("INTEGRATION_ENCRYPTION_KEY", "")
    try:
        return Fernet(key.encode())
    except (ValueError, TypeError):
        raise HTTPException(503, "Personal integrations are temporarily unavailable. Please contact the administrator.") from None


def require_storage():
    if not current_user_id.get():
        raise HTTPException(401, "Sign in to manage personal integrations")
    _cipher()


def integration_label(provider):
    if not current_user_id.get():
        return None
    with get_conn() as conn:
        row = conn.execute("SELECT label FROM context.user_integrations WHERE provider = %s", (provider,)).fetchone()
    return row["label"] if row else None


def load_integration(provider):
    if not current_user_id.get():
        return None
    with get_conn() as conn:
        row = conn.execute("SELECT encrypted_secret FROM context.user_integrations WHERE provider = %s", (provider,)).fetchone()
    if not row:
        return None
    try:
        return json.loads(_cipher().decrypt(row["encrypted_secret"].encode()))
    except (InvalidToken, ValueError):
        raise HTTPException(503, "Reconnect your personal integration to continue.") from None


def save_integration(provider, credentials, label):
    require_storage()
    ciphertext = _cipher().encrypt(json.dumps(credentials).encode()).decode()
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO context.user_integrations(provider, encrypted_secret, label) VALUES (%s,%s,%s) "
            "ON CONFLICT(user_id,provider) DO UPDATE SET encrypted_secret=excluded.encrypted_secret, "
            "label=excluded.label, updated_at=now()", (provider, ciphertext, label)
        )


def delete_integration(provider):
    if not current_user_id.get():
        raise HTTPException(401, "Sign in to manage personal integrations")
    with get_conn() as conn:
        conn.execute("DELETE FROM context.user_integrations WHERE provider = %s", (provider,))
