import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from groq import Groq
from core.config import GROQ_MODEL
from services.integrations import load_integration, save_integration, delete_integration, integration_label


def _load_key():
    credentials = load_integration("groq")
    return credentials.get("api_key") if credentials else None


def get_client():
    key = _load_key()
    if not key:
        raise RuntimeError("Add your personal Groq API key in Settings > Integrations")
    # Request-local client: never reuse another user's key through a module global.
    return Groq(api_key=key)


def has_key():
    return integration_label("groq") is not None


def save_key(key):
    save_integration("groq", {"api_key": key}, "Groq")


def delete_key():
    delete_integration("groq")


def test_key(key):
    try:
        client = Groq(api_key=key)
        client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": "say ok"}],
            max_tokens=5,
        )
        return True, "OK"
    except Exception as e:
        return False, "Could not verify this API key. Check the key and provider access."


def chat(system, user, temperature=0.2, max_tokens=1000):
    client = get_client()
    r = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=temperature,
        max_tokens=max_tokens,
        reasoning_effort="low",   # ← add this line
    )
    return r.choices[0].message.content.strip()