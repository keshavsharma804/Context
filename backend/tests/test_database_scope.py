import sys
from pathlib import Path
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from core.db import DatabaseConnection
from core.user_context import current_user_id


class DatabaseScopeTests(unittest.TestCase):
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
