"""Email OTP regressions with provider and database calls mocked."""

from pathlib import Path
import sys
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from psycopg.errors import UndefinedTable
from fastapi import FastAPI
from fastapi.testclient import TestClient
from core.auth import SessionMiddleware
from routes import api
from services import email_otp


class EmailOTPTests(unittest.TestCase):
    def setUp(self):
        self.settings = patch.dict(email_otp.os.environ, {
            'SUPABASE_URL': 'https://fixture.supabase.co',
            'SUPABASE_PUBLISHABLE_KEY': 'fixture-publishable',
        })
        self.settings.start()
        self.addCleanup(self.settings.stop)

    def test_send_uses_provider_without_exposing_code(self):
        with patch.object(email_otp.httpx, 'post', return_value=httpx.Response(200, json={})) as post:
            self.assertIsNone(email_otp.send_signup_code('user@gmail.com'))
            self.assertEqual(post.call_args.kwargs['json'], {'email': 'user@gmail.com', 'create_user': True})
            self.assertEqual(post.call_args.kwargs['timeout'], 15)

    def test_verification_requires_matching_confirmed_email(self):
        for user in ({'email': 'other@gmail.com', 'email_confirmed_at': 'now'}, {'email': 'user@gmail.com'}):
            with self.subTest(user=user), patch.object(email_otp.httpx, 'post', return_value=httpx.Response(200, json={'user': user, 'access_token': 'fixture'})):
                with self.assertRaises(email_otp.EmailOTPError):
                    email_otp.verify_signup_code('user@gmail.com', '123456')
        with patch.object(email_otp.httpx, 'post', return_value=httpx.Response(200, json={
            'user': {'email': 'user@gmail.com', 'email_confirmed_at': 'now'}, 'access_token': 'fixture',
        })):
            self.assertIsNone(email_otp.verify_signup_code('user@gmail.com', '123456'))

    def test_expired_code_and_rate_limits_have_safe_errors(self):
        for status, expected in ((403, 400), (429, 429)):
            with self.subTest(status=status), patch.object(email_otp.httpx, 'post', return_value=httpx.Response(status, json={'msg': 'private provider details'})):
                with self.assertRaises(email_otp.EmailOTPError) as error:
                    email_otp.verify_signup_code('user@gmail.com', '123456')
                self.assertEqual(error.exception.status, expected)
                self.assertNotIn('private provider', str(error.exception))

    def test_missing_settings_fail_closed(self):
        with patch.dict(email_otp.os.environ, {'SUPABASE_URL': ''}), patch.object(email_otp.httpx, 'post') as post:
            with self.assertRaises(email_otp.EmailOTPError) as error:
                email_otp.send_signup_code('user@gmail.com')
            self.assertEqual(error.exception.status, 503)
            post.assert_not_called()

    def test_malformed_settings_do_not_escape_as_500(self):
        for settings in ({'SUPABASE_URL': 'https://['}, {'SUPABASE_URL': 'https://fixture.supabase.co:wrong'},
                         {'SUPABASE_PUBLISHABLE_KEY': 'fixture\nkey'}):
            with self.subTest(settings=list(settings)), patch.dict(email_otp.os.environ, settings), patch.object(email_otp.httpx, 'post') as post:
                with self.assertRaises(email_otp.EmailOTPError) as error:
                    email_otp.send_signup_code('fixture@example.invalid')
                self.assertEqual(error.exception.status, 503)
                self.assertEqual(error.exception.code, 'EMAIL_CONFIGURATION_ERROR')
                post.assert_not_called()

    def test_unexpected_provider_json_fails_safely(self):
        with patch.object(email_otp.httpx, 'post', return_value=httpx.Response(200, json=[])):
            with self.assertRaises(email_otp.EmailOTPError) as error:
                email_otp.send_signup_code('fixture@example.invalid')
            self.assertEqual(error.exception.status, 503)


class SignupOTPRouteTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.app.include_router(api.router, prefix='/api')
        self.app.add_middleware(SessionMiddleware)
        self.client = TestClient(self.app)
        self.account = {'email': 'user@gmail.com', 'password': 'Fixture-password-123', 'name': 'Fixture', 'otp': '123456'}

    def test_database_failure_returns_reference_without_leaking_details(self):
        with patch('core.auth.get_session', return_value=None), \
             patch.object(api, 'get_admin_conn', side_effect=RuntimeError('private-connection-details')), \
             patch.object(api, 'send_signup_code') as send, self.assertLogs('context.requests', 'ERROR') as logs:
            response = self.client.post('/api/auth/signup-code', json={'email': 'fixture@example.invalid'})
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['code'], 'AUTH_DATABASE_UNAVAILABLE')
            self.assertTrue(response.json()['reference'])
            self.assertNotIn('private-connection-details', response.text + str(logs.output))
            send.assert_not_called()

    def test_missing_session_schema_fails_closed_with_safe_diagnostics(self):
        self.client.cookies.set('context_session', 'fixture-token')
        with patch('core.auth.get_session', side_effect=UndefinedTable('private-query-details')), \
             self.assertLogs('context.requests', 'ERROR') as logs:
            response = self.client.get('/api/config')
            self.assertEqual(response.status_code, 503)
            self.assertEqual(response.json()['code'], 'AUTH_DATABASE_SCHEMA_ERROR')
            self.assertNotIn('private-query-details', response.text + str(logs.output))

    def test_signup_cannot_bypass_code(self):
        with patch('core.auth.get_session', return_value=None), patch.object(api, 'verify_signup_code') as verify:
            for code in (None, '', 'abc123', '123'):
                body = dict(self.account)
                if code is None:
                    del body['otp']
                else:
                    body['otp'] = code
                self.assertEqual(self.client.post('/api/auth/register', json=body).status_code, 422)
            verify.assert_not_called()

    def test_invalid_code_never_creates_account_or_session(self):
        conn = MagicMock()
        conn.execute.return_value.fetchone.return_value = None
        with patch('core.auth.get_session', return_value=None), patch.object(api, 'get_admin_conn') as database, \
             patch.object(api, 'verify_signup_code', side_effect=email_otp.EmailOTPError('Invalid code')), \
             patch.object(api, 'create_session') as session:
            database.return_value.__enter__.return_value = conn
            response = self.client.post('/api/auth/register', json=self.account)
            self.assertEqual(response.status_code, 400)
            self.assertEqual(conn.execute.call_count, 1)
            self.assertTrue(conn.execute.call_args.args[0].startswith('SELECT'))
            session.assert_not_called()

    def test_verified_signup_creates_account_then_session(self):
        conn = MagicMock()
        row = dict(id='fixture', email='user@gmail.com', name='Fixture', avatar=None, provider='email', role='Owner', created_at='now', last_sign_in_at='now')
        conn.execute.return_value.fetchone.side_effect = [None, row]
        with patch('core.auth.get_session', return_value=None), patch.object(api, 'get_admin_conn') as database, \
             patch.object(api, 'verify_signup_code') as verify, \
             patch.object(api, 'create_session', side_effect=lambda response, *args: response) as session:
            database.return_value.__enter__.return_value = conn
            response = self.client.post('/api/auth/register', json=self.account)
            self.assertEqual(response.status_code, 200)
            verify.assert_called_once_with('user@gmail.com', '123456')
            self.assertIn('INSERT INTO context.users', conn.execute.call_args.args[0])
            session.assert_called_once()
            self.assertNotIn('access_token', response.json())

    def test_guest_can_request_code_without_receiving_session(self):
        conn = MagicMock()
        conn.execute.return_value.fetchone.return_value = None
        with patch('core.auth.get_session', return_value=None), patch.object(api, 'get_admin_conn') as database, \
             patch.object(api, 'send_signup_code') as send:
            database.return_value.__enter__.return_value = conn
            response = self.client.post('/api/auth/signup-code', json={'email': ' User@Gmail.com '})
            self.assertEqual(response.status_code, 200)
            send.assert_called_once_with('user@gmail.com')
            self.assertNotIn('set-cookie', response.headers)


if __name__ == '__main__':
    unittest.main()
