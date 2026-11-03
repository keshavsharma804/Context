import os

# --- What to index ---
DOWNLOADS = os.path.expanduser("~/Downloads")
DOCUMENTS = os.path.expanduser("~/Documents")

def _chrome_user_data():
    candidates = [
        os.path.expanduser("~/AppData/Local/Google/Chrome/User Data"),
        os.path.expanduser("~/Library/Application Support/Google/Chrome"),
        os.path.expanduser("~/.config/google-chrome"),
    ]
    for c in candidates:
        if os.path.isdir(c):
            return c
    return candidates[0]

CHROME_USER_DATA = _chrome_user_data()

# --- DB + server ---
DB_PATH = "context.db"
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "templates")
PORT = 3000

# --- Indexing limits ---
MAX_PDF_CHARS = 50_000
MAX_FILE_MB = 20
HISTORY_DAYS = 30
HISTORY_PER_PROFILE = 5000

# --- Gmail ---
GMAIL_CRED_PATH = os.path.expanduser("~/.context_gmail.json")
GMAIL_FETCH_DAYS = 90
GMAIL_MAX_INBOX = 200
GMAIL_MAX_SENT = 50

# --- Groq (LLM) ---
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = "openai/gpt-oss-20b"
ASK_TOP_K = 15

# --- Activity tracking ---
ACTIVITY_POLL_SECONDS = 60

# --- Noise filter for "You're forgetting" ---
FORGOTTEN_CATEGORIES = ["pdf", "doc", "report", "invoice", "resume", "code"]
FORGOTTEN_MAX_AGE_DAYS = 14
FORGOTTEN_MIN_SIZE_KB = 10
FORGOTTEN_LIMIT = 5
