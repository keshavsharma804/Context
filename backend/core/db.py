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
from core.user_context import current_user_id

_pool = None
_pool_lock = Lock()


def _connection_failure_reason(error):
    """Inspect driver details locally; return only an allowlisted, non-secret code."""
    state = getattr(error, 'sqlstate', None)
    detail = str(error).lower()
    if state == '28P01' or 'password authentication failed' in detail:
        return 'DB_PASSWORD_REJECTED'
    if 'tenant or user not found' in detail:
        return 'DB_POOLER_USER_NOT_FOUND'
    if state == '53300' or any(term in detail for term in ('maxclients', 'max client', 'too many clients', 'remaining connection slots')):
        return 'DB_CONNECTION_LIMIT'
    if state == '57P03':
        return 'DB_NOT_READY'
    if state == '28000':
        return 'DB_AUTH_REJECTED'
    if 'could not translate host name' in detail or 'name or service not known' in detail or 'failed to resolve host' in detail:
        return 'DB_DNS_FAILED'
    if 'network is unreachable' in detail or 'no route to host' in detail:
        return 'DB_NETWORK_UNREACHABLE'
    if 'connection refused' in detail:
        return 'DB_CONNECTION_REFUSED'
    if 'certificate' in detail or 'ssl error' in detail:
        return 'DB_TLS_FAILED'
    if 'timeout' in detail or 'timed out' in detail:
        return 'DB_CONNECTION_TIMEOUT'
    return 'DB_CONNECTION_FAILED'


class _DiagnosedConnection(psycopg.Connection):
    failure_reason = 'DB_CONNECTION_FAILED'

    @classmethod
    def connect(cls, *args, **kwargs):
        try:
            return super().connect(*args, **kwargs)
        except Exception as error:
            cls.failure_reason = _connection_failure_reason(error)
            logging.getLogger('context.database').error('database_connect_failed reason=%s', cls.failure_reason)
            raise


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
                "Set POSTGRES_URL or DATABASE_URL in the backend environment to the "
                "PostgreSQL connection URL from Supabase's Connect panel. "
                "A Supabase API URL/key is not a PostgreSQL connection URL."
            )
        try:
            connection_url = _connection_url(DATABASE_URL)
            options = conninfo_to_dict(connection_url)
        except Exception:
            raise RuntimeError("Invalid PostgreSQL connection URL in the backend environment.") from None
        local = options.get("host") in ("localhost", "127.0.0.1", "::1")
        sslmode = options.get("sslmode", "require")
        if not local and sslmode not in ("require", "verify-ca", "verify-full"):
            sslmode = "require"
        # Pool diagnostics may contain credentials; callers get a fixed error.
        logging.getLogger("psycopg.pool").setLevel(logging.CRITICAL)
        _DiagnosedConnection.failure_reason = 'DB_CONNECTION_FAILED'
        pool = ConnectionPool(
            connection_url,
            connection_class=_DiagnosedConnection,
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
                "Cannot connect to Supabase PostgreSQL. "
                f"Diagnostic: {_DiagnosedConnection.failure_reason}. "
                "Check the backend environment's PostgreSQL URL, password, and network access."
            ) from None
        _pool = pool
        return pool


class DatabaseConnection:
    """Return pooled connections safely when existing callers invoke close()."""

    def __init__(self, pool, connection, admin=False):
        self._pool = pool
        self._connection = connection
        self._admin = admin
        self._user_id = current_user_id.get()
        self._configured = False

    def _configure(self):
        if not self._admin and not self._configured:
            self._connection.execute("SELECT set_config('context.user_id', %s, true)", (self._user_id or "",))
            self._connection.execute("SET LOCAL ROLE context_app")
            self._configured = True

    def execute(self, query, params=None):
        self._configure()
        return self._connection.execute(query, params)

    def cursor(self):
        self._configure()
        return self._connection.cursor()

    def commit(self):
        self._connection.commit()
        self._configured = False

    def rollback(self):
        self._connection.rollback()
        self._configured = False

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


def _lease(admin=False):
    pool = _get_pool()
    try:
        connection = pool.getconn(timeout=15)
    except Exception:
        raise RuntimeError("Supabase database connection is temporarily unavailable.") from None
    return DatabaseConnection(pool, connection, admin=admin)


def get_conn():
    return _lease()


def get_admin_conn():
    """Only migrations and credential-verified session/account operations use this."""
    return _lease(admin=True)


def close_pool():
    global _pool
    with _pool_lock:
        pool, _pool = _pool, None
    if pool is not None:
        pool.close()


def init_db():
    """Apply versioned, idempotent migrations in a single transaction."""
    migration_dir = Path(__file__).resolve().parents[1] / "migrations"
    with get_admin_conn() as conn:
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
