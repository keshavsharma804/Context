import ast
import csv
import io
from datetime import date, timedelta
from pathlib import Path
from typing import Literal
from fastapi import APIRouter, FastAPI, Query, Depends, HTTPException, Response
from fastapi.testclient import TestClient

source = Path('D:/.openclaw/PMO/Product_Management_dashboard_db/backend/routes/seo_console.py').read_text(encoding='utf-8')
tree = ast.parse(source)
names = {'_custom_range', '_report_range', '_window', '_previous', 'performance', '_row_params', '_table_rows', 'performance_rows', 'performance_export'}
nodes = [n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name in names or isinstance(n, ast.Assign) and any(isinstance(t, ast.Name) and t.id in {'Range', 'SearchType', 'SortKey'} for t in n.targets)]
router = APIRouter()
def require_section(*args, **kwargs):
    return lambda: {'role': 'test'}
scope = dict(globals(), DEFAULT_SITE='example')
exec(compile(ast.Module(body=nodes, type_ignores=[]), '<seo-api>', 'exec'), scope)
calls = []
def report(site, search_type, rng, filters):
    calls.append(rng)
    start, end = scope['_window'](site, rng)
    return {'start': start, 'end': end, 'tables': {'query': [{'query': 'dress', 'clicks': 1, 'impressions': 10, 'position': 2, 'ctr': .1}]}}
scope['_perf_full'] = report
app = FastAPI()
app.include_router(router)
client = TestClient(app)
query = 'site=example&start=2026-09-16&end=2026-10-14&range=24h'
response = client.get('/performance?' + query)
assert response.status_code == 200, response.text
assert response.json()['start'] == '2026-09-16'
assert response.json()['end'] == '2026-10-14'
response = client.get('/performance/rows?' + query)
assert response.status_code == 200, response.text
assert response.json()['total'] == 1
response = client.get('/performance/export?' + query)
assert response.status_code == 200, response.text
assert 'dress,1,10,10.00%,2' in response.text
assert calls == ['2026-09-16:2026-10-14'] * 3
for invalid in ['start=invalid&end=2026-10-14', 'start=2026-10-15&end=2026-10-14', 'start=2026-10-14', 'range=unbounded']:
    response = client.get('/performance?' + invalid)
    assert response.status_code == 422, response.text
print('SEO API tests passed: exact dates reach summary, paged rows and CSV exports; invalid dates are rejected.')
