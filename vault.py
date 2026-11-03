"""Secure Personal Vault backend storage.

CRITICAL SECURITY RULES:
- All sensitive data is encrypted CLIENT-SIDE with Web Crypto AES-GCM + PBKDF2.
- The server NEVER sees plaintext sensitive data, passphrases, or derived keys.
- Ciphertext and IV are stored as opaque base64 strings without inspection.
"""

from datetime import datetime
from db import get_conn


VALID_CATEGORIES = {"bank", "card", "id", "password", "upi", "note"}


def get_config() -> dict | None:
    """Return the vault's configuration dict or None if not initialized."""
    conn = get_conn()
    row = conn.execute("SELECT * FROM vault_config WHERE id = 1").fetchone()
    conn.close()
    if not row:
        return None
    r = dict(row)
    return {
        "salt": r.get("salt"),
        "recovery_salt": r.get("recovery_salt"),
        "encrypted_vek": r.get("encrypted_vek"),
        "encrypted_vek_iv": r.get("encrypted_vek_iv"),
        "recovery_encrypted_vek": r.get("recovery_encrypted_vek"),
        "recovery_encrypted_vek_iv": r.get("recovery_encrypted_vek_iv"),
        "verifier_ciphertext": r.get("verifier_ciphertext"),
        "verifier_iv": r.get("verifier_iv"),
    }


def get_salt() -> str | None:
    """Return the vault's salt (base64) or None if not initialized."""
    cfg = get_config()
    return cfg["salt"] if cfg else None


def init_vault(
    salt: str,
    verifier_ciphertext: str | None = None,
    verifier_iv: str | None = None,
    recovery_salt: str | None = None,
    encrypted_vek: str | None = None,
    encrypted_vek_iv: str | None = None,
    recovery_encrypted_vek: str | None = None,
    recovery_encrypted_vek_iv: str | None = None,
) -> bool:
    """Initialize the vault with master salt, recovery key, and auth verifier."""
    clean_salt = (salt or "").strip()
    if not clean_salt:
        raise ValueError("salt is required")

    conn = get_conn()
    existing = conn.execute("SELECT id FROM vault_config WHERE id = 1").fetchone()
    if existing:
        conn.close()
        return False

    now = datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "INSERT INTO vault_config ("
        "id, salt, recovery_salt, encrypted_vek, encrypted_vek_iv, "
        "recovery_encrypted_vek, recovery_encrypted_vek_iv, verifier_ciphertext, verifier_iv, created_at"
        ") VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            clean_salt,
            recovery_salt,
            encrypted_vek,
            encrypted_vek_iv,
            recovery_encrypted_vek,
            recovery_encrypted_vek_iv,
            verifier_ciphertext,
            verifier_iv,
            now,
        ),
    )
    conn.commit()
    conn.close()
    return True


def reset_passphrase(
    salt: str,
    encrypted_vek: str,
    encrypted_vek_iv: str,
    verifier_ciphertext: str,
    verifier_iv: str,
) -> bool:
    """Update the master passphrase encryption of the vault key while keeping the recovery key."""
    conn = get_conn()
    conn.execute(
        "UPDATE vault_config SET "
        "salt = ?, encrypted_vek = ?, encrypted_vek_iv = ?, verifier_ciphertext = ?, verifier_iv = ? "
        "WHERE id = 1",
        (salt, encrypted_vek, encrypted_vek_iv, verifier_ciphertext, verifier_iv),
    )
    conn.commit()
    conn.close()
    return True


def add_item(title: str, category: str, ciphertext: str, iv: str) -> dict:
    """Insert an encrypted vault item.

    Returns { id, title, category, created_at }.
    """
    clean_title = (title or "").strip()
    clean_category = (category or "").strip().lower()
    clean_ciphertext = (ciphertext or "").strip()
    clean_iv = (iv or "").strip()

    if not clean_title:
        raise ValueError("title is required")
    if clean_category not in VALID_CATEGORIES:
        clean_category = "note"
    if not clean_ciphertext or not clean_iv:
        raise ValueError("ciphertext and iv are required")

    now = datetime.now().isoformat(timespec="seconds")
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO vault_items (title, category, ciphertext, iv, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (clean_title, clean_category, clean_ciphertext, clean_iv, now, now),
    )
    conn.commit()
    item_id = cur.lastrowid
    conn.close()

    return {
        "id": item_id,
        "title": clean_title,
        "category": clean_category,
        "created_at": now,
        "updated_at": now,
    }


def update_item(
    item_id: int,
    title: str | None = None,
    category: str | None = None,
    ciphertext: str | None = None,
    iv: str | None = None,
) -> dict | None:
    """Update an existing vault item.

    Allows ciphertext and iv to be None to keep existing (e.g. for title-only edits).
    """
    conn = get_conn()
    existing = conn.execute(
        "SELECT * FROM vault_items WHERE id = ?", (item_id,)
    ).fetchone()
    if not existing:
        conn.close()
        return None

    next_title = (title.strip() if title is not None else existing["title"])
    if not next_title:
        conn.close()
        raise ValueError("title cannot be empty")

    next_cat = (category.strip().lower() if category is not None else existing["category"])
    if next_cat not in VALID_CATEGORIES:
        next_cat = existing["category"]

    next_cipher = ciphertext.strip() if ciphertext is not None else existing["ciphertext"]
    next_iv = iv.strip() if iv is not None else existing["iv"]
    now = datetime.now().isoformat(timespec="seconds")

    conn.execute(
        "UPDATE vault_items SET title = ?, category = ?, ciphertext = ?, iv = ?, updated_at = ? "
        "WHERE id = ?",
        (next_title, next_cat, next_cipher, next_iv, now, item_id),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM vault_items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_item(item_id: int) -> bool:
    """Delete a single vault item by id."""
    conn = get_conn()
    cur = conn.execute("DELETE FROM vault_items WHERE id = ?", (item_id,))
    conn.commit()
    deleted = cur.rowcount > 0
    conn.close()
    return deleted


def list_items() -> list[dict]:
    """Return all vault items.

    Ciphertext and IV are included so client can decrypt in browser memory.
    """
    conn = get_conn()
    rows = conn.execute(
        "SELECT id, title, category, ciphertext, iv, created_at, updated_at "
        "FROM vault_items ORDER BY created_at DESC, id DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_item(item_id: int) -> dict | None:
    """Return a single vault item by id."""
    conn = get_conn()
    row = conn.execute(
        "SELECT id, title, category, ciphertext, iv, created_at, updated_at "
        "FROM vault_items WHERE id = ?",
        (item_id,),
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def delete_all_items() -> int:
    """Delete all items from the vault."""
    conn = get_conn()
    cur = conn.execute("DELETE FROM vault_items")
    conn.commit()
    count = cur.rowcount
    conn.close()
    return count


def wipe_vault() -> int:
    """Completely wipe the vault: deletes all items AND the salt configuration.

    After wipe, the vault returns to the uninitialized setup state.
    """
    conn = get_conn()
    cur = conn.execute("DELETE FROM vault_items")
    deleted_items = cur.rowcount
    conn.execute("DELETE FROM vault_config")
    conn.commit()
    conn.close()
    return deleted_items
