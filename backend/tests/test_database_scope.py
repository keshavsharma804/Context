import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.db import DatabaseConnection
from core import db
import psycopg
from core.user_context import current_user_id


class DatabaseScopeTests(unittest.TestCase):
    def test_connection_diagnostics_do_not_log_credentials(self):
        private = 'postgresql://fixture:private-password@private-host/postgres'
        cases = [
            ('password authentication failed ' + private, 'DB_PASSWORD_REJECTED'),
            ('Tenant or user not found ' + private, 'DB_POOLER_USER_NOT_FOUND'),
            ('Network is unreachable ' + private, 'DB_NETWORK_UNREACHABLE'),
            ('could not translate host name ' + private, 'DB_DNS_FAILED'),
            ('connection timeout expired ' + private, 'DB_CONNECTION_TIMEOUT'),
            ('MaxClientsInSessionMode ' + private, 'DB_CONNECTION_LIMIT'),
        ]
        for detail, expected in cases:
            with self.subTest(expected=expected), \
                 patch.object(psycopg.Connection, 'connect', side_effect=psycopg.OperationalError(detail)), \
                 self.assertLogs('context.database', 'ERROR') as logs:
                with self.assertRaises(psycopg.OperationalError):
                    db._DiagnosedConnection.connect('fixture')
                self.assertEqual(db._DiagnosedConnection.failure_reason, expected)
                self.assertIn(expected, str(logs.output))
                self.assertNotIn('private-password', str(logs.output))
                self.assertNotIn('private-host', str(logs.output))

    def test_startup_failure_includes_safe_diagnostic(self):
        pool = MagicMock()
        def fail(**kwargs):
            db._DiagnosedConnection.failure_reason = 'DB_PASSWORD_REJECTED'
            raise RuntimeError('private-pool-details')
        pool.open.side_effect = fail
        with patch.object(db, '_pool', None), \
             patch.object(db, 'DATABASE_URL', 'postgresql://fixture:private-password@localhost/postgres'), \
             patch.object(db, 'ConnectionPool', return_value=pool) as factory:
            with self.assertRaises(RuntimeError) as error:
                db._get_pool()
            self.assertIn('DB_PASSWORD_REJECTED', str(error.exception))
            self.assertNotIn('private-password', str(error.exception))
            self.assertNotIn('private-pool-details', str(error.exception))
            self.assertIs(factory.call_args.kwargs['connection_class'], db._DiagnosedConnection)
            pool.close.assert_called_once()

    def test_user_role_is_transaction_local_and_restored_after_commit(self):
        pool, raw = MagicMock(), MagicMock()
        token = current_user_id.set('fixture-user-a')
        try:
            conn = DatabaseConnection(pool, raw)
        finally:
            current_user_id.reset(token)
        conn.execute('SELECT 1')
        raw.execute.assert_any_call("SELECT set_config('context.user_id', %s, true)", ('fixture-user-a',))
        raw.execute.assert_any_call('SET LOCAL ROLE context_app')
        initial = raw.execute.call_count
        conn.execute('SELECT 2')
        self.assertEqual(raw.execute.call_count, initial + 1)
        conn.commit()
        conn.execute('SELECT 3')
        self.assertEqual(raw.execute.call_count, initial + 4)
        conn.close()
        pool.putconn.assert_called_once_with(raw)

    def test_anonymous_queries_use_restricted_role_without_an_identity(self):
        pool, raw = MagicMock(), MagicMock()
        conn = DatabaseConnection(pool, raw)
        conn.execute('SELECT 1')
        raw.execute.assert_any_call("SELECT set_config('context.user_id', %s, true)", ('',))
        raw.execute.assert_any_call('SET LOCAL ROLE context_app')
        conn.close()


if __name__ == '__main__':
    unittest.main()
