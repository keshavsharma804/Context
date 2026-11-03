"""Email ownership verification through Supabase Auth; app sessions stay private."""

import os
import logging
from urllib.parse import urlsplit

import httpx


class EmailOTPError(Exception):
    def __init__(self, message, status=400, code='EMAIL_VERIFICATION_FAILED'):
        super().__init__(message)
        self.status = status
        self.code = code


def _request(path, payload):
    url = os.getenv("SUPABASE_URL", "").strip().rstrip("/")
    key = (os.getenv("SUPABASE_PUBLISHABLE_KEY") or os.getenv("SUPABASE_ANON_KEY", "")).strip()
    try:
        parsed = urlsplit(url)
        valid_url = (parsed.scheme == 'https' and parsed.hostname and not parsed.username
                     and not parsed.password and parsed.path in ('', '/') and not parsed.query
                     and not parsed.fragment and parsed.port in (None, 443))
    except ValueError:
        valid_url = False
    if not key or not valid_url or any(ord(char) <= 32 or ord(char) > 126 for char in key):
        raise EmailOTPError("Email verification is not configured correctly. Please contact the site owner.", 503, 'EMAIL_CONFIGURATION_ERROR')
    try:
        response = httpx.post(f"{url}/auth/v1/{path}", json=payload,
                              headers={"apikey": key}, timeout=15)
    except httpx.RequestError:
        raise EmailOTPError("Email verification is temporarily unavailable. Please try again.", 503) from None
    except (httpx.InvalidURL, ValueError):
        raise EmailOTPError("Email verification is not configured correctly. Please contact the site owner.", 503, 'EMAIL_CONFIGURATION_ERROR') from None
    if not response.is_success:
        logging.getLogger('context.email').warning('email_otp_failed operation=%s provider_status=%s', path, response.status_code)
    if response.status_code in (401, 403) and path != 'verify':
        raise EmailOTPError('Email verification settings were rejected. Please contact the site owner.', 503, 'EMAIL_CONFIGURATION_ERROR')
    if response.status_code == 429:
        raise EmailOTPError("Too many attempts. Please wait before trying again.", 429)
    if not response.is_success:
        if path == "verify":
            raise EmailOTPError("The verification code is invalid or expired. Request a new code.")
        raise EmailOTPError("Could not send the code. Please try again later or contact the site owner.", 503)
    try:
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError('Unexpected response shape')
        return result
    except ValueError:
        raise EmailOTPError("Email verification is temporarily unavailable. Please try again.", 503) from None


def send_signup_code(email):
    # Supabase enforces resend, expiry, and verification limits across server instances.
    _request("otp", {"email": email, "create_user": True})


def verify_signup_code(email, code):
    result = _request("verify", {"email": email, "token": code, "type": "email"})
    user = result.get("user") or {}
    if not isinstance(user, dict):
        raise EmailOTPError('Email verification failed. Request a new code.')
    if (not isinstance(user.get('email'), str) or user['email'].lower() != email or not user.get("email_confirmed_at")
            or not result.get("access_token")):
        raise EmailOTPError("Email verification failed. Request a new code.")
    # Provider tokens are never returned to the browser or used as app credentials.
