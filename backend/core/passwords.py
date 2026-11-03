"""Password hashing for the existing account API; never store raw passwords."""

import hashlib
import hmac
import secrets

_ROUNDS = 600_000


def hash_password(password):
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _ROUNDS)
    return f"pbkdf2_sha256${_ROUNDS}${salt}${digest.hex()}"


def verify_password(password, stored):
    try:
        algorithm, rounds, salt, digest = stored.split("$")
        if algorithm != "pbkdf2_sha256" or int(rounds) != _ROUNDS:
            return False
        candidate = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt), _ROUNDS)
        return hmac.compare_digest(candidate.hex(), digest)
    except (AttributeError, TypeError, ValueError):
        return False
