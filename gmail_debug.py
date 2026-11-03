import imaplib
from datetime import datetime, timedelta
from gmail_import import load_credentials

creds = load_credentials()
print("Account:", creds["email"])

mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
mail.login(creds["email"], creds["app_password"])
print("Login: OK\n")

# 1. INBOX
status, data = mail.select("INBOX", readonly=True)
print("SELECT INBOX:", status, data)

# 2. SEARCH with current date format
since = (datetime.now() - timedelta(days=30)).strftime("%d-%b-%Y")
print(f"SEARCH SINCE {since!r}")
status, data = mail.uid("SEARCH", None, f"SINCE {since}")
count = len(data[0].split()) if data and data[0] else 0
print(f"  → status={status}, results={count}")

# 3. SEARCH ALL (baseline — should never be 0)
status, data = mail.uid("SEARCH", None, "ALL")
count_all = len(data[0].split()) if data and data[0] else 0
print(f"SEARCH ALL → results={count_all}")

# 4. List folders
print("\nFolders:")
status, folders = mail.list()
for f in folders:
    if b"\\HasNoChildren" in f or b"Sent" in f or b"INBOX" in f:
        print("  ", f.decode(errors="ignore"))

# 5. Try each sent folder candidate
print("\nSent folder probes:")
for name in ["[Gmail]/Sent Mail", "[Gmail]/Sent", "Sent", "Sent Items"]:
    status, _ = mail.select(f'"{name}"', readonly=True)
    print(f"  {name!r}: {status}")

mail.logout()
print("\nDone.")