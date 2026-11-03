import os
import sys

_backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for _d in (_backend_dir, os.path.join(_backend_dir, "core"), os.path.join(_backend_dir, "services")):
    if _d not in sys.path:
        sys.path.insert(0, _d)

from core.db import get_conn
from services.rag import reindex_all

# Clean any spend chunks with broken IDs
conn = get_conn()
conn.execute("DELETE FROM context.chunks WHERE source_type = 'spend'")
conn.commit()
conn.close()
print("Cleared old spend chunks")

# Rebuild all chunks (files, emails, events, manual, people, spends, patterns)
reindex_all()
print("Done")