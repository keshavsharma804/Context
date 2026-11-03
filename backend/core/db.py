import os

import sqlite3

try:
    from core.config import DB_PATH
except ImportError:
    from .config import DB_PATH





def get_conn():

    conn = sqlite3.connect(DB_PATH)

    conn.row_factory = sqlite3.Row

    return conn





def init_db():

    conn = get_conn()

    c = conn.cursor()



    c.execute("""

        CREATE VIRTUAL TABLE IF NOT EXISTS files USING fts5(

            path, name, category, content, downloaded, last_opened,

            size_kb UNINDEXED

        )

    """)

    c.execute("""

        CREATE VIRTUAL TABLE IF NOT EXISTS history USING fts5(

            url, title, content, last_visit UNINDEXED, visits UNINDEXED

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS manual (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            kind TEXT, payload TEXT, created_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS patterns (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            kind TEXT, detail TEXT, seen_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS applications (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            company TEXT NOT NULL, role TEXT, cv_file TEXT,

            applied_at TEXT, status TEXT DEFAULT 'applied',

            notes TEXT, url TEXT, jd TEXT, created_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS interviews (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            company TEXT NOT NULL, scheduled_at TEXT,

            interview_type TEXT, prep_docs TEXT, notes TEXT, created_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS companies (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT UNIQUE NOT NULL, source TEXT, detected_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS events (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            uid TEXT UNIQUE, title TEXT, start_at TEXT, end_at TEXT,

            location TEXT, description TEXT, category TEXT, company TEXT,

            source TEXT, created_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_events_start ON events(start_at)")

    c.execute("""

        CREATE TABLE IF NOT EXISTS emails (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            uid TEXT UNIQUE, from_addr TEXT, from_name TEXT, to_addr TEXT,

            subject TEXT, body_snippet TEXT, received_at TEXT,

            category TEXT, needs_reply INTEGER DEFAULT 0, replied INTEGER DEFAULT 0,

            thread_key TEXT, source TEXT, created_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_emails_thread ON emails(thread_key)")

    c.execute("CREATE INDEX IF NOT EXISTS idx_emails_needs ON emails(needs_reply)")

    c.execute("""

        CREATE TABLE IF NOT EXISTS promises (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            who TEXT, what TEXT, by_when TEXT, source TEXT,

            resolved INTEGER DEFAULT 0, created_at TEXT

        )

    """)

    c.execute("""

        CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(

            title, content, source_type UNINDEXED,

            source_id UNINDEXED, metadata UNINDEXED

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS activity_log (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            kind TEXT, target TEXT, detail TEXT, timestamp TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_activity_ts ON activity_log(timestamp DESC)")

    c.execute("""

        CREATE TABLE IF NOT EXISTS ignored_files (

            path TEXT PRIMARY KEY, ignored_at TEXT

        )

    """)



    # ============ NEW: People ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS people (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT UNIQUE NOT NULL COLLATE NOCASE,

            birthday TEXT,

            tags TEXT,

            last_contacted TEXT,

            source TEXT,

            created_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS person_facts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            person_id INTEGER NOT NULL,

            fact TEXT,

            category TEXT,

            source TEXT,

            resolved INTEGER DEFAULT 0,

            created_at TEXT,

            FOREIGN KEY (person_id) REFERENCES people(id)

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_person_facts ON person_facts(person_id)")



    # ============ NEW: Spends + budgets ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS spends (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            amount REAL,

            merchant TEXT,

            category TEXT,

            spent_at TEXT,

            created_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_spends_date ON spends(spent_at)")

    c.execute("""

        CREATE TABLE IF NOT EXISTS budgets (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            category TEXT UNIQUE NOT NULL,

            amount REAL,

            period TEXT DEFAULT 'month',

            created_at TEXT

        )

    """)



    # ============ NEW: Detected patterns ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS patterns_detected (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            kind TEXT,

            title TEXT,

            detail TEXT,

            severity TEXT,

            detected_at TEXT,

            dismissed INTEGER DEFAULT 0

        )

    """)



    # ============ NEW: Habits + daily logs ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS habits (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL UNIQUE COLLATE NOCASE,

            emoji TEXT DEFAULT '●',

            color TEXT DEFAULT '#8b5cf6',

            target_per_week INTEGER DEFAULT 7,

            created_at TEXT,

            archived INTEGER DEFAULT 0

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS habit_logs (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            habit_id INTEGER NOT NULL,

            date TEXT NOT NULL,

            status TEXT NOT NULL,

            note TEXT,

            created_at TEXT,

            UNIQUE(habit_id, date),

            FOREIGN KEY (habit_id) REFERENCES habits(id)

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_habit_logs_habit ON habit_logs(habit_id)")

    c.execute("CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date)")



    # ============ NEW: Secure Vault ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS vault_config (

            id INTEGER PRIMARY KEY CHECK (id = 1),

            salt TEXT NOT NULL,

            recovery_salt TEXT,

            encrypted_vek TEXT,

            encrypted_vek_iv TEXT,

            recovery_encrypted_vek TEXT,

            recovery_encrypted_vek_iv TEXT,

            verifier_ciphertext TEXT,

            verifier_iv TEXT,

            created_at TEXT

        )

    """)

    c.execute("""

        CREATE TABLE IF NOT EXISTS vault_items (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            category TEXT NOT NULL,

            ciphertext TEXT NOT NULL,

            iv TEXT NOT NULL,

            created_at TEXT,

            updated_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_vault_items_category ON vault_items(category)")

    c.execute("CREATE INDEX IF NOT EXISTS idx_vault_items_title ON vault_items(title)")



    # ============ NEW: Subscriptions & Renewals ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS subscriptions (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            name TEXT NOT NULL,

            amount REAL NOT NULL,

            billing_cycle TEXT NOT NULL DEFAULT 'monthly',

            category TEXT DEFAULT 'entertainment',

            next_renewal TEXT NOT NULL,

            payment_method TEXT,

            auto_renew INTEGER DEFAULT 1,

            notes TEXT,

            created_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_subs_renewal ON subscriptions(next_renewal)")



    # ============ NEW: Debts & IOUs ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS debts (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            person TEXT NOT NULL,

            direction TEXT NOT NULL,

            amount REAL NOT NULL,

            due_date TEXT,

            taken_at TEXT NOT NULL,

            settled INTEGER DEFAULT 0,

            settled_at TEXT,

            notes TEXT,

            created_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_debts_person ON debts(person)")

    c.execute("CREATE INDEX IF NOT EXISTS idx_debts_settled ON debts(settled)")



    # ============ NEW: Saving Goals ============

    # ============ NEW: Journal and Mood ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS journal (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            date TEXT NOT NULL UNIQUE,

            mood INTEGER DEFAULT 3,

            headline TEXT,

            content TEXT,

            tags TEXT,

            created_at TEXT,

            updated_at TEXT

        )

    """)

    c.execute("CREATE INDEX IF NOT EXISTS idx_journal_date ON journal(date)")



    # ============ NEW: Saving Goals ============

    c.execute("""

        CREATE TABLE IF NOT EXISTS saving_goals (

            id INTEGER PRIMARY KEY AUTOINCREMENT,

            title TEXT NOT NULL,

            target_amount REAL NOT NULL,

            current_amount REAL DEFAULT 0,

            target_date TEXT,

            category TEXT DEFAULT 'purchase',

            emoji TEXT DEFAULT '🎯',

            notes TEXT,

            created_at TEXT

        )

    """)





    # ============ NEW: User Accounts & Authentication ============
    c.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            name TEXT,
            password_hash TEXT,
            avatar TEXT,
            provider TEXT DEFAULT 'email',
            role TEXT DEFAULT 'Owner',
            created_at TEXT,
            last_sign_in_at TEXT
        )
    """)
    c.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)")

    conn.commit()
    conn.close()





def reset_db():

    if os.path.exists(DB_PATH):

        os.remove(DB_PATH)

    init_db()