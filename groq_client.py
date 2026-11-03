import os, json
from groq import Groq
from config import GROQ_API_KEY, GROQ_MODEL

_client = None


def _load_key():
    if GROQ_API_KEY:
        return GROQ_API_KEY
    path = os.path.expanduser("~/.context_groq.json")
    if os.path.exists(path):
        try:
            return json.load(open(path)).get("api_key")
        except Exception:
            return None
    return None


def get_client():
    global _client
    if _client is None:
        key = _load_key()
        if not key:
            raise RuntimeError("Groq API key not set")
        _client = Groq(api_key=key)
    return _client


def has_key():
    return bool(_load_key())


def save_key(key):
    path = os.path.expanduser("~/.context_groq.json")
    with open(path, "w") as f:
        json.dump({"api_key": key}, f)
    try:
        os.chmod(path, 0o600)
    except Exception:
        pass
    global _client
    _client = None


def delete_key():
    path = os.path.expanduser("~/.context_groq.json")
    if os.path.exists(path):
        os.remove(path)
    global _client
    _client = None


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
        return False, str(e)[:200]


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