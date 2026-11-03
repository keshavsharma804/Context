"""Opaque, revocable HttpOnly sessions with CSRF protection."""

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool
from starlette.responses import JSONResponse
from starlette.requests import Request

from core.db import get_admin_conn
from core.user_context import current_user_id

SESSION_COOKIE = "context_session"
CSRF_COOKIE = "context_csrf"


def _digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def get_session(token):
    if not token or len(token) > 128:
        return None
    with get_admin_conn() as conn:
        return conn.execute(
            "SELECT user_id, csrf_hash FROM context.auth_sessions "
            "WHERE token_hash = %s AND expires_at > now()", (_digest(token),)
        ).fetchone()


def create_session(response, request, user_id, remember=True):
    token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=30 if remember else 1)
    with get_admin_conn() as conn:
        old = request.cookies.get(SESSION_COOKIE)
        if old:
            conn.execute("DELETE FROM context.auth_sessions WHERE token_hash = %s", (_digest(old),))
        conn.execute("DELETE FROM context.auth_sessions WHERE expires_at <= now()")
        conn.execute(
            "INSERT INTO context.auth_sessions(token_hash,user_id,csrf_hash,expires_at) VALUES (%s,%s,%s,%s)",
            (_digest(token), user_id, _digest(csrf), expires),
        )
    secure = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    for name, value, http_only in ((SESSION_COOKIE, token, True), (CSRF_COOKIE, csrf, False)):
        response.set_cookie(name, value, httponly=http_only, secure=secure,
                            samesite="lax", path="/", max_age=30 * 86400 if remember else None)
    response.headers["Cache-Control"] = "no-store"
    return response


def revoke_session(request, response):
    token = request.cookies.get(SESSION_COOKIE)
    if token:
        with get_admin_conn() as conn:
            conn.execute("DELETE FROM context.auth_sessions WHERE token_hash = %s", (_digest(token),))
    response.delete_cookie(SESSION_COOKIE, path="/")
    response.delete_cookie(CSRF_COOKIE, path="/")
    response.headers["Cache-Control"] = "no-store"
    return response


class SessionMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        request = Request(scope)
        path = request.url.path.rstrip("/") or "/"
        public = path in {"/api/health", "/api/auth/login", "/api/auth/register", "/api/auth/signup-code", "/api/auth/me"}
        if path == "/api/health":
            return await self.app(scope, receive, send)
        session = await run_in_threadpool(get_session, request.cookies.get(SESSION_COOKIE))
        if not public and not session:
            return await JSONResponse({"ok": False, "error": "Sign in to continue"}, status_code=401)(scope, receive, send)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            if request.headers.get("sec-fetch-site") == "cross-site":
                return await JSONResponse({"ok": False, "error": "Cross-site request rejected"}, status_code=403)(scope, receive, send)
            if session and path not in {"/api/auth/login", "/api/auth/register", "/api/auth/signup-code"}:
                csrf = request.headers.get("x-csrf-token", "")
                if not csrf or not hmac.compare_digest(_digest(csrf), session["csrf_hash"]):
                    return await JSONResponse({"ok": False, "error": "Request verification failed"}, status_code=403)(scope, receive, send)
        context_token = current_user_id.set(session["user_id"] if session else None)
        scope.setdefault("state", {})["user_id"] = session["user_id"] if session else None

        async def no_cache(message):
            if message["type"] == "http.response.start":
                headers = [(key, val) for key, val in message.get("headers", []) if key.lower() != b"cache-control"]
                message["headers"] = headers + [(b"cache-control", b"no-store")]
            await send(message)

        try:
            await self.app(scope, receive, no_cache)
        finally:
            current_user_id.reset(context_token)
