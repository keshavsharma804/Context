# Context

The backend stores app records in Supabase PostgreSQL. The frontend continues to
use the local FastAPI API; database credentials are never sent to the browser.

Put the PostgreSQL connection URL in `backend/.env` as `DATABASE_URL` (also accepts
`SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, `POSTGRES_URL`, or
`POSTGRES_CONNECTION_STRING`). Existing process environment variables take precedence.
Use the connection URL from the [Supabase Connect panel](https://supabase.com/docs/guides/database/connecting-to-postgres).
Project API URLs and API keys are not database connection strings.

Install backend dependencies and start the server from PowerShell:

```powershell
cd D:\context
.\venv\Scripts\python.exe -m pip install -r backend\requirements.txt
.\venv\Scripts\python.exe backend\app.py
```

In another terminal:

```powershell
cd D:\context\frontend
npm run dev
```

Startup applies versioned migrations from `backend/migrations` to the private
`context` schema. It does not modify Supabase Auth tables or copy the old SQLite
database. Connections use TLS and a bounded pool (`DB_POOL_SIZE`, default 10).
Original files remain local; indexed content and app records are stored remotely.
The API starts after database initialization. File/history indexing and the first
search-index build run in the background, so they do not block the UI.
`GET /api/health` reports the background indexing status. For an API-only startup,
set `CONTEXT_BACKGROUND_SERVICES=0` in the process environment. The manual rescan
action remains available.
Vault ciphertext remains encrypted in the browser before storage. Account
passwords are salted hashes. This uses the app's existing account API, not
Supabase Auth or Supabase OAuth.

Run backend regression tests:

```powershell
.\venv\Scripts\python.exe -B -m unittest discover -s backend\tests -v
```

Startup tests simulate slow or failed indexing without scanning local files or
changing live database records.
