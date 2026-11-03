"""Email ownership verification through Supabase Auth; app sessions stay private."""

import os
from urllib.parse import urlsplit

import httpx


class EmailOTPError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def _request(path, payload):
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")).strip()
    parsed = urlsplit(url)
    if not key or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
        raise EmailOTPError("Email verification is not configured yet. Please contact the site owner.", 503)
    try:
        response = httpx.post(f"{url}/auth/v1/{path}", json=payload,
                              headers={"apikey": key}, timeout=15)
    except httpx.RequestError:
        raise EmailOTPError("Email verification is temporarily unavailable. Please try again.", 503) from None
    if response.status_code == 429:
        raise EmailOTPError("Too many attempts. Please wait before trying again.", 429)
    if not response.is_success:
        if path == "verify":
            raise EmailOTPError("The verification code is invalid or expired. Request a new code.")
        raise EmailOTPError("Could not send the code. Please try again later or contact the site owner.", 503)
    try:
        return response.json()
    except ValueError:
        raise EmailOTPError("Email verification is temporarily unavailable. Please try again.", 503) from None


def send_signup_code(email):
    # Supabase enforces resend, expiry, and verification limits across server instances.
    _request("otp", {"email": email, "create_user": True})


def verify_signup_code(email, code):
    result = _request("verify", {"email": email, "token": code, "type": "email"})
    user = result.get("user") or {}
    if (user.get("email", "").lower() != email or not user.get("email_confirmed_at")
            or not result.get("access_token")):
        raise EmailOTPError("Email verification failed. Request a new code.")
    # Provider tokens are never returned to the browser or used as app credentials.
