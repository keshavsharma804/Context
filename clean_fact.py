from db import get_conn

conn = get_conn()
cur = conn.execute("DELETE FROM person_facts WHERE fact LIKE '%promoted at work met%'")
deleted = cur.rowcount
conn.commit()
conn.close()
print(f"Deleted {deleted} bad fact(s)")