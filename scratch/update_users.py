with open('db.py', 'r', encoding='utf-8') as f:
    content = f.read()

users_code = """    # ============ NEW: User Accounts & Authentication ============
    c.execute('''
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
    ''')
    c.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)')

"""

if 'CREATE TABLE IF NOT EXISTS users' not in content:
    idx = content.rfind('conn.commit()')
    new_content = content[:idx] + users_code + content[idx:]
    with open('db.py', 'w', encoding='utf-8', newline='\n') as f:
        f.write(new_content)
    print('Added users table to db.py')
else:
    print('Users table already in db.py')

import db
db.init_db()
print('db.init_db() ran successfully!')
