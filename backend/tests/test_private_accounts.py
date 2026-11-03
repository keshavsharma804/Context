"""Opt-in PostgreSQL security regressions. All schema/data changes roll back."""

from contextlib import ExitStack
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
import app as application
from core import auth, db
from core.user_context import current_user_id
from routes import api
from services import integrations, groq_client, gmail_import, rag


class _TestLease:
    """Run real queries in one rollback-only transaction, including role changes."""
    def __init__(self, raw, admin):
        self.raw, self.admin = raw, admin

    def execute(self, query, params=None):
        self.raw.execute("RESET ROLE")
        if not self.admin:
            self.raw.execute("SELECT set_config('context.user_id',%s,true)", (current_user_id.get() or "",))
            self.raw.execute("SET LOCAL ROLE context_app")
        return self.raw.execute(query, params)

    def commit(self):
        pass

    def close(self):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


@unittest.skipUnless(os.getenv("CONTEXT_TEST_SUPABASE") == "1", "Live rollback-only tests are opt-in")
class PrivateAccountsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.connection = db.get_admin_conn()
        cls.raw = cls.connection._connection
        try:
            exists = cls.connection.execute(
                "SELECT 1 FROM context.schema_migrations WHERE version='002_private_accounts.sql'"
            ).fetchone()
            if not exists:
                cls.connection.execute((Path(__file__).resolve().parents[1] / "migrations/002_private_accounts.sql").read_text())
        except Exception:
            cls.connection.rollback()
            cls.connection.close()
            raise

    @classmethod
    def tearDownClass(cls):
        cls.connection.rollback()
        cls.connection.close()
        db.close_pool()

    def setUp(self):
        self.raw.execute("RESET ROLE")
        self.raw.execute("SAVEPOINT security_test")
        self.stack = ExitStack()
        self.stack.enter_context(patch.dict(os.environ, {
            "CONTEXT_BACKGROUND_SERVICES": "0",
            "INTEGRATION_ENCRYPTION_KEY": Fernet.generate_key().decode(),
        }))
        for name, module in list(sys.modules.items()):
            if name.startswith(("core.", "services.", "routes.")) or name == "app":
                if hasattr(module, "get_conn"):
                    self.stack.enter_context(patch.object(module, "get_conn", side_effect=lambda: _TestLease(self.raw, False)))
                if hasattr(module, "get_admin_conn"):
                    self.stack.enter_context(patch.object(module, "get_admin_conn", side_effect=lambda: _TestLease(self.raw, True)))
        self.stack.enter_context(patch.object(application, "init_db"))
        self.stack.enter_context(patch.object(application, "close_pool"))
        self.stack.enter_context(patch.object(api, "verify_signup_code"))
        self.a = self.stack.enter_context(TestClient(application.app))
        self.b = self.stack.enter_context(TestClient(application.app))
        self.guest = self.stack.enter_context(TestClient(application.app))
        self.ids = []
        for client in (self.a, self.b):
            email = uuid4().hex + "@example.invalid"
            response = client.post('/api/auth/register', json={"email": email, "password": "Fixture-password-123", "name": "Fixture", "otp": "123456"})
            self.assertEqual(response.status_code, 200)
            self.ids.append(response.json()['user']['id'])

    def tearDown(self):
        self.stack.close()
        self.raw.execute("RESET ROLE")
        self.raw.execute("ROLLBACK TO SAVEPOINT security_test")

    def post(self, client, path, body=None):
        return client.post(path, json=body or {}, headers={"X-CSRF-Token": client.cookies.get(auth.CSRF_COOKIE)})

    def test_anonymous_and_forged_identity_cannot_access_private_settings(self):
        for path in ('/api/config', '/api/home', '/api/data/export', '/api/vault/items'):
            self.assertEqual(self.guest.get(path, headers={"X-User-Id": self.ids[0]}).status_code, 401)
        self.assertIsNone(self.guest.get('/api/auth/me?email=somebody@example.invalid').json()['user'])
        self.assertEqual(self.guest.post('/api/groq/connect', json={"api_key": "fake"}).status_code, 401)

    def test_personal_ai_keys_are_encrypted_and_separate(self):
        with patch.object(api, "groq_test_key", return_value=(True, "OK")):
            self.assertEqual(self.post(self.a, '/api/groq/connect', {"api_key": "fixture-key-a"}).status_code, 200)
            self.assertFalse(self.b.get('/api/config').json()['has_groq'])
            self.assertEqual(self.post(self.b, '/api/groq/connect', {"api_key": "fixture-key-b"}).status_code, 200)
        for user_id, key in zip(self.ids, ('fixture-key-a', 'fixture-key-b')):
            token = current_user_id.set(user_id)
            try:
                self.assertEqual(integrations.load_integration('groq')['api_key'], key)
                stored = _TestLease(self.raw, False).execute('SELECT encrypted_secret FROM context.user_integrations').fetchone()[0]
                self.assertNotIn(key, stored)
            finally:
                current_user_id.reset(token)
        self.assertEqual(self.post(self.b, '/api/groq/disconnect').status_code, 200)
        self.assertTrue(self.a.get('/api/config').json()['has_groq'])
        self.assertNotIn('fixture-key-a', self.a.get('/api/config').text)

    def test_gmail_credentials_and_imported_email_are_private(self):
        for user_id, email in zip(self.ids, ('a@example.invalid', 'b@example.invalid')):
            token = current_user_id.set(user_id)
            try:
                gmail_import.save_credentials(email, 'fixture-app-password')
                _TestLease(self.raw, False).execute(
                    "INSERT INTO context.emails(uid,subject,source) VALUES ('same-uid',%s,'inbox')", (email,)
                )
            finally:
                current_user_id.reset(token)
        for client, email in zip((self.a,self.b), ('a@example.invalid','b@example.invalid')):
            self.assertEqual(client.get('/api/config').json()['gmail_email'], email)
            response = client.get('/api/email').text
            self.assertIn(email, response)
            self.assertNotIn('fixture-app-password', response)
            other = 'b@example.invalid' if email.startswith('a@') else 'a@example.invalid'
            self.assertNotIn(other, response)

    def test_csrf_logout_and_password_verification(self):
        self.assertEqual(self.a.post('/api/groq/disconnect').status_code, 403)
        session = self.a.cookies.get(auth.SESSION_COOKIE)
        self.assertEqual(self.post(self.a, '/api/auth/logout').status_code, 200)
        self.a.cookies.set(auth.SESSION_COOKIE, session)
        self.assertEqual(self.a.get('/api/config').status_code, 401)
        self.assertEqual(self.guest.post('/api/auth/login', json={
            "email": "does-not-exist@example.invalid", "password": "fixture"
        }).status_code, 401)

    def test_scoped_habits_and_singleton_vault(self):
        for client in (self.a,self.b):
            result = self.post(client, '/api/habits/add', {"name": "Same private habit"})
            self.assertEqual(result.status_code, 200)
            self.assertTrue(result.json()['ok'])
        for user_id in self.ids:
            token = current_user_id.set(user_id)
            try:
                conn = _TestLease(self.raw, False)
                conn.execute("INSERT INTO context.vault_config(id,salt) VALUES (1,%s)", (user_id,))
                self.assertEqual(conn.execute('SELECT salt FROM context.vault_config').fetchone()[0], user_id)
                self.assertEqual(conn.execute('SELECT count(*) FROM context.habits').fetchone()[0], 1)
            finally:
                current_user_id.reset(token)

    def test_missing_encryption_key_fails_closed(self):
        with patch.dict(os.environ, {"INTEGRATION_ENCRYPTION_KEY": ""}):
            response = self.post(self.a, '/api/groq/connect', {"api_key": "fixture"})
            self.assertEqual(response.status_code, 503)
        self.assertFalse(self.a.get('/api/config').json()['has_groq'])


if __name__ == '__main__':
    unittest.main()
