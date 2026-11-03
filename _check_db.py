from db import init_db
from config import DB_PATH
import sqlite3

init_db()
conn = sqlite3.connect(DB_PATH)
rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'habit%'").fetchall()
print([r[0] for r in rows])
conn.close()
