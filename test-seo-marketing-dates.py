import ast
import unittest
from datetime import date, timedelta
from pathlib import Path

source = Path('D:/.openclaw/PMO/Product_Management_dashboard_db/backend/routes/seo_console.py').read_text(encoding='utf-8')
tree = ast.parse(source)
names = {'_custom_range', '_report_range', '_window', '_previous', 'performance', '_row_params', '_table_rows'}
nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
for node in nodes:
    node.decorator_list = []

class HTTPException(Exception):
    def __init__(self, status_code, detail):
        self.status_code = status_code
        super().__init__(detail)

scope = {'date': date, 'timedelta': timedelta, 'HTTPException': HTTPException,
         'Query': lambda default=None, **kw: default, 'Depends': lambda fn: fn,
         'require_section': lambda *a, **kw: lambda: None, 'DEFAULT_SITE': 'example',
         'Range': str, 'SearchType': str, 'SortKey': str, 'Literal': __import__('typing').Literal,
         '_last_day': lambda site: date(2026, 10, 30)}
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<seo-date-functions>', 'exec'), scope)

class DateTests(unittest.TestCase):
    def test_custom_window_and_previous(self):
        rng = scope['_report_range']('24h', date(2026, 9, 16), date(2026, 10, 14))
        self.assertEqual(scope['_window']('example', rng), ('2026-09-16', '2026-10-14'))
        self.assertEqual(scope['_previous']('2026-09-16', '2026-10-14'), ('2026-08-18', '2026-09-15'))

    def test_invalid_ranges(self):
        for start, end in [(date.today(), None), (None, date.today()),
                           (date(2026, 10, 2), date(2026, 10, 1)),
                           (date.today(), date.today()+timedelta(days=1)),
                           (date.today()-timedelta(days=488), date.today())]:
            with self.assertRaises(HTTPException) as ctx:
                scope['_custom_range'](start, end)
            self.assertEqual(ctx.exception.status_code, 422)

    def test_presets_unchanged(self):
        self.assertIsNone(scope['_custom_range'](None, None))
        self.assertEqual(scope['_report_range']('7d', None, None), '7d')
        self.assertEqual(scope['_window']('example', '7d'), ('2026-10-24', '2026-10-30'))

    def test_summary_and_rows_share_report(self):
        calls = []
        def report(site, search_type, rng, filters):
            calls.append(rng)
            return {'start': '2026-09-16', 'end': '2026-10-14', 'tables': {'query': [{'query': 'dress', 'clicks': 1, 'impressions': 10, 'position': 2, 'ctr': .1}]}}
        scope['_perf_full'] = report
        rng = '2026-09-16:2026-10-14'
        summary = scope['performance']('example', 'web', rng, None, {})
        params = scope['_row_params'](site='example', rng=rng)
        self.assertEqual(len(scope['_table_rows'](**params)), 1)
        self.assertEqual(summary['table_counts'], {'query': 1})
        self.assertEqual(calls, [rng, rng])

    def test_cache_and_exports_use_selected_dates(self):
        self.assertIn('seo-console:perf:{site}:{search_type}:{rng}', source)
        self.assertIn('seo-console:overview:{site}" + (f":{custom}', source)
        self.assertIn('seo-console:insights:{site}" + (f":{custom}', source)
        export = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'performance_export')
        self.assertIn('_table_rows(**p)', ast.unparse(export))

    def test_background_sync_defaults(self):
        for name in ['overview', 'insights']:
            endpoint = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
            self.assertEqual(ast.literal_eval(endpoint.args.defaults[1]), None)
            self.assertEqual(ast.literal_eval(endpoint.args.defaults[2]), None)

unittest.main()
