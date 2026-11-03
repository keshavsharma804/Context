"""Supabase PostgreSQL connections shared by the existing backend services."""

import atexit
import logging
from pathlib import Path
from threading import Lock
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import psycopg
from psycopg.conninfo import conninfo_to_dict
from psycopg_pool import ConnectionPool

from core.config import DATABASE_URL, DB_POOL_SIZE

_pool = None
_pool_lock = Lock()


class DatabaseRow(dict):
    """Keep both named and positional access used by the existing API."""

    def __getitem__(self, key):
        if isinstance(key, (int, slice)):
            return tuple(self.values())[key]
        return super().__getitem__(key)


def _row_factory(cursor):
    columns = [column.name for column in cursor.description or ()]
    return lambda values: DatabaseRow(zip(columns, values))


def _connection_url(value):
    """Remove dashboard/ORM-only options without changing the stored secret."""
    parts = urlsplit(value)
    client_options = {"supa", "pgbouncer", "connection_limit", "pool_timeout", "schema"}
    query = [(key, val) for key, val in parse_qsl(parts.query, keep_blank_values=True)
             if key not in client_options]
    return urlunsplit(parts._replace(query=urlencode(query)))


def _get_pool():
    global _pool
    with _pool_lock:
        if _pool is not None:
            return _pool
        if not DATABASE_URL:
            raise RuntimeError(
                "Set DATABASE_URL (or SUPABASE_DB_URL) in backend/.env to the "
                "PostgreSQL connection URL from Supabase's Connect panel. "
                "A Supabase API URL/key is not a PostgreSQL connection URL."
            )
        try:
            connection_url = _connection_url(DATABASE_URL)
            options = conninfo_to_dict(connection_url)
        except Exception:
            raise RuntimeError("Invalid PostgreSQL connection URL in backend/.env.") from None
        local = options.get("host") in ("localhost", "127.0.0.1", "::1")
        sslmode = options.get("sslmode", "require")
        if not local and sslmode not in ("require", "verify-ca", "verify-full"):
            sslmode = "require"
        # Pool diagnostics may contain credentials; callers get a fixed error.
        logging.getLogger("psycopg.pool").setLevel(logging.CRITICAL)
        pool = ConnectionPool(
            connection_url,
            min_size=1,
            max_size=max(4, min(DB_POOL_SIZE, 30)),
            timeout=15,
            max_waiting=40,
            open=False,
            kwargs={
                "row_factory": _row_factory,
                "connect_timeout": 10,
                "sslmode": sslmode,
                "prepare_threshold": None,
            },
        )
        try:
            pool.open(wait=True, timeout=15)
        except Exception:
            pool.close()
            raise RuntimeError(
                "Cannot connect to Supabase PostgreSQL. Check the connection URL, "
                "database password, network access, and pooler settings in backend/.env."
            ) from None
        _pool = pool
        return pool


class DatabaseConnection:
    """Return pooled connections safely when existing callers invoke close()."""

    def __init__(self, pool, connection):
        self._pool = pool
        self._connection = connection

    def execute(self, query, params=None):
        return self._connection.execute(query, params)

    def cursor(self):
        return self._connection.cursor()

    def commit(self):
        self._connection.commit()

    def rollback(self):
        self._connection.rollback()

    def transaction(self):
        return self._connection.transaction()

    def close(self):
        connection, self._connection = self._connection, None
        if connection is not None:
            try:
                connection.rollback()
            except psycopg.Error:
                connection.close()
            finally:
                self._pool.putconn(connection)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        try:
            if exc_type is None:
                self.commit()
        finally:
            self.close()

    def __del__(self):
        # Reclaim a lease if an older service's exception bypasses close().
        try:
            self.close()
        except Exception:
            pass


def get_conn():
    pool = _get_pool()
    try:
        connection = pool.getconn(timeout=15)
    except Exception:
        raise RuntimeError("Supabase database connection is temporarily unavailable.") from None
    return DatabaseConnection(pool, connection)


def close_pool():
    global _pool
    with _pool_lock:
        pool, _pool = _pool, None
    if pool is not None:
        pool.close()


def init_db():
    """Apply versioned, idempotent migrations in a single transaction."""
    migration_dir = Path(__file__).resolve().parents[1] / "migrations"
    with get_conn() as conn:
        conn.execute("SELECT pg_advisory_xact_lock(743920651)")
        conn.execute("CREATE SCHEMA IF NOT EXISTS context")
        conn.execute("REVOKE ALL ON SCHEMA context FROM PUBLIC")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS context.schema_migrations (
                version TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """)
        for path in sorted(migration_dir.glob("*.sql")):
            exists = conn.execute(
                "SELECT 1 FROM context.schema_migrations WHERE version = %s", (path.name,)
            ).fetchone()
            if exists:
                continue
            conn.execute(path.read_text(encoding="utf-8"))
            conn.execute(
                "INSERT INTO context.schema_migrations (version) VALUES (%s)", (path.name,)
            )


def reset_db():
    raise RuntimeError("Remote database resets are disabled. Use the explicit data-clear action.")


atexit.register(close_pool)
