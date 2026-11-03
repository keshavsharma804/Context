# Context

The backend stores app records in Supabase PostgreSQL. The frontend continues to
use the local FastAPI API; database credentials are never sent to the browser.

Put the PostgreSQL connection URL in `backend/.env` as `DATABASE_URL` (also accepts
`SUPABASE_DB_URL`, `SUPABASE_DATABASE_URL`, `POSTGRES_URL`, or
`POSTGRES_CONNECTION_STRING`). Existing process environment variables take precedence.
Use the connection URL from the [Supabase Connect panel](https://supabase.com/docs/guides/database/connecting-to-postgres).
Project API URLs and API keys are not database connection strings.

Render deployments use Python 3.12, selected by `.python-version` in the repository
and backend directories. Keep the Render Root Directory set to `backend`. Remove
any Render `PYTHON_VERSION` override set to a different Python minor version;
environment overrides take precedence over the version files. The pinned PyMuPDF
release has prebuilt Linux wheels for Python 3.12, avoiding a source build.

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
The API starts after database initialization. Background local indexing is disabled
by default for hosted, account-based operation. Keep `CONTEXT_BACKGROUND_SERVICES=0`
on Vercel. The manual rescan action runs with the signed-in user's identity.
`GET /api/health` reports readiness without exposing private records.
Vault ciphertext remains encrypted in the browser before storage. Account
passwords are salted hashes. App sessions use the existing account API; Supabase
Auth sends and verifies email OTPs for new registrations.

Run backend regression tests:

```powershell
.\venv\Scripts\python.exe -B -m unittest discover -s backend\tests -v
```

Startup tests simulate slow or failed indexing without scanning local files or
changing live database records.

Signed-in users and personal integrations
---------------------------------------

Private routes require a server-verified HttpOnly session cookie. Mutations also
require a CSRF token. Browser user records and email query parameters never grant
access. Registration requires an email OTP before creating an app account; login
requires that existing account's password. OAuth and shared demo sign-in are disabled.

Migration `002_private_accounts.sql` adds owner-scoped PostgreSQL policies and
constraints. Request queries use a restricted `context_app` database role and a
transaction-local user ID, including after a commit on a reused connection.
Existing records are preserved: if exactly one account exists, it receives those
records; otherwise unowned legacy records remain hidden pending explicit ownership
assignment. Backend startup applies the migration; deploy backend and frontend
together. Existing users must sign in again.

Gmail app passwords and personal Groq API keys are encrypted in Supabase. They no
longer use shared server files or the server's `GROQ_API_KEY`. Generate a persistent
backend encryption key locally:

```powershell
.\venv\Scripts\python.exe backend\scripts\generate_integration_key.py
```

Add its output as the backend Vercel project's **secret** environment variable
`INTEGRATION_ENCRYPTION_KEY`, then redeploy the backend. For local development,
set the same variable in `backend/.env`. Keep the key stable and private; losing
it requires reconnecting the integrations. Never put it in a `VITE_` variable or
the frontend project. API credentials never return to the browser after saving.

For rollback-only multi-user database tests, set
`$env:CONTEXT_TEST_SUPABASE = '1'` before running the backend test command. Schema
changes and fixture accounts are rolled back; external Gmail/Groq calls are mocked.
Frontend navigation and preference checks: `cd frontend`, then
`node scripts/test-interface.mjs`.

Email verification for signup
-----------------------------

New visitors can view the dashboard and introduction before signing in. On Create
Account, they enter their name, email (including Gmail addresses), and password;
Send Verification Code sends an email, then Verify & Create Account verifies the
code server-side before saving the app account and issuing its private session.
The UI offers resend after 60 seconds and lets users correct their details.
Codes and password drafts are never saved to browser storage. Supabase enforces
single-use codes, expiry, resend limits, and verification attempt limits.
Existing Context accounts continue to sign in with their existing passwords.

Before deploying this flow:

1. In the backend Vercel project's environment variables, set `SUPABASE_URL` to
   the project's HTTPS URL and `SUPABASE_PUBLISHABLE_KEY` to its publishable key
   (`SUPABASE_ANON_KEY` is supported for legacy anon keys). Keep the existing
   PostgreSQL `DATABASE_URL`; it alone cannot send emails. Do not use a service
   role/secret key for this flow. Local development uses the same names in
   `backend/.env`.
2. In Supabase Authentication, enable the Email provider, new user signups, and
   email confirmations. In Email Templates, include the code in both the Magic
   Link and Confirm Signup templates, for example:
   `<p>Your Context verification code is <strong>{{ .Token }}</strong></p>`.
   The signup UI accepts numeric codes of 6–10 digits; keep the project's email
   OTP length within that range. Set an appropriate short expiry in Email settings.
3. Configure a custom SMTP provider in Supabase Authentication SMTP Settings and
   verify its sender address/domain. Supabase's built-in sender only delivers to
   authorized organization team addresses and is limited to 2 emails/hour; public
   users need custom SMTP. Configure provider and Supabase rate limits for your
   intended traffic. Never ask users for their Gmail password to receive signup OTPs.
4. Redeploy backend and frontend. Test signup with an address you control, an
   incorrect code, resend, successful verification, and later password sign-in.

Supabase Auth creates its email identity while sending the code; the private
`context.users` account is created only after successful verification. Provider
access/refresh tokens are not sent to the browser or accepted as Context sessions.
No Google OAuth configuration is required.

If hosted signup fails, check the failed request in Vercel's project-level Request
Logs with the latest Production deployment selected. `AUTH_DATABASE_UNAVAILABLE`
means the account database could not be reached; `AUTH_DATABASE_SCHEMA_ERROR`
indicates a schema/permission problem. Check that Supabase is active and the backend
Production environment has the correct `DATABASE_URL`. Supabase's Session pooler
connection string (port 5432) is an IPv4-compatible option. Copy its full username
and use the database password, not a Supabase API key or Gmail app password.
Redeploy after updating environment variables. `/api/health` is a liveness check
and does not perform a live database query. Errors include a reference matching
safe `request_failed` log lines; never paste raw connection URLs or tokens.

References: [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
and [SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp).

Vault spreadsheet imports
-------------------------

Unlock the vault and select **Import sheet**. Upload XLSX, XLS, CSV, or TSV files
(including downloads from Google Sheets), or enter a browser-readable Google
Sheets URL. Google Sheets shortcut `.gsheet` files are also accepted when they
contain a valid sheet URL. Private Sheets require downloading and uploading the
file; the app does not request Google account access or make documents public.

The first nonempty row supplies column names. Choose a workbook tab, review the
detected category and column mapping, then select **Encrypt & import**. Common
password-manager headings such as name, url, username, password, and notes map
automatically. Bank, card, ID, UPI, and note fields are supported. Unrecognized
columns can be mapped manually; unmapped columns are explicitly marked ignored.
Resolve invalid rows or duplicate destination mappings before saving.

Imports are limited to 5 MB, 1,000 data rows, and 100 columns per tab. SheetJS is
loaded only when parsing a file. Parsing and AES-GCM encryption happen in browser
memory; backend requests contain the existing vault metadata and ciphertext.
Up to three saves run concurrently. Stop finishes in-flight rows; successful
rows stay marked and are excluded from retry within the open import dialog.
Closing the dialog clears the preview. Existing entries are never overwritten.

Run parser, encrypted-save, and category regressions with
`cd frontend` then `node scripts/test-vault-import.mjs`.
