from db import get_conn
from rag import reindex_all

# Clean any spend chunks with broken IDs
conn = get_conn()
conn.execute("DELETE FROM chunks WHERE source_type = 'spend'")
conn.commit()
conn.close()
print("Cleared old spend chunks")

# Rebuild all chunks (files, emails, events, manual, people, spends, patterns)
reindex_all()
print("Done")