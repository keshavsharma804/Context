"""Bounded PostgreSQL full-text search over the signed-in user's records."""

import json
import re
from urllib.parse import quote, urlencode, urlsplit

from fastapi import HTTPException
from core.db import get_conn


def _text(*fields):
    return " || ' ' || ".join(f"coalesce({field},'')" for field in fields)


# Table/column expressions are fixed application code, never request input.
SOURCES = {
    'expense': ('spends', _text('merchant', 'category'), "coalesce(nullif(merchant,''),'Expense')", "coalesce(category,'')", 'spent_at', 'merchant', 'amount', None),
    'note': ('manual', _text('payload'), "'Note'", 'left(payload,20000)', 'created_at', 'kind', 'NULL::double precision', "kind IN ('note','task')"),
    'person': ('people', _text('name'), 'name', "'Contact'", 'created_at', 'name', 'NULL::double precision', None),
    'event': ('events', _text('title', 'description', 'location', 'company'), 'title', "coalesce(location,'') || ' ' || coalesce(description,'')", 'start_at', 'start_at', 'NULL::double precision', None),
    'journal': ('journal', _text('headline', 'content', 'tags'), "coalesce(nullif(headline,''),'Journal entry')", "coalesce(content,'')", 'date', 'date', 'NULL::double precision', None),
    'email': ('emails', _text('subject', 'from_name', 'from_addr', 'body_snippet'), "coalesce(nullif(subject,''),'No subject')", "coalesce(from_name,'') || ' ' || coalesce(body_snippet,'')", 'received_at', 'id::text', 'NULL::double precision', None),
    'job': ('applications', _text('company', 'role', 'notes'), "company || ' ' || coalesce(role,'')", "coalesce(status,'') || ' ' || coalesce(notes,'')", 'applied_at', 'company', 'NULL::double precision', None),
    'subscription': ('subscriptions', _text('name', 'category', 'notes'), 'name', "coalesce(category,'')", 'next_renewal', 'name', 'amount', None),
    'debt': ('debts', _text('person', 'description', 'notes'), 'person', "direction || ' ' || coalesce(description,'')", 'taken_at', 'person', 'amount', None),
    'file': ('files', 'search_vector', 'name', "coalesce(content,'')", 'downloaded', 'name', 'NULL::double precision', None),
    'history': ('history', 'search_vector', "coalesce(nullif(title,''),url)", "coalesce(content,'')", 'last_visit', 'url', 'NULL::double precision', None),
}


def _href(kind, row):
    target = row['target'] or ''
    if kind == 'person':
        return '/people/' + quote(target, safe='')
    if kind == 'note':
        return f"/notes/{row['id']}"
    if kind in {'event', 'journal'}:
        return ('/calendar' if kind == 'event' else '/journal') + '?' + urlencode({'date': target[:10]})
    if kind == 'file':
        return '/files?' + urlencode({'q': target})
    if kind == 'history':
        try:
            parsed = urlsplit(target)
            if parsed.scheme in {'http', 'https'} and parsed.netloc and not parsed.username and not parsed.password:
                return target
        except ValueError:
            pass
        return '/search?' + urlencode({'q': row['title'] or '', 'kind': 'history'})
    return f"/records/{kind}/{row['id']}"


def search_records(q, kind='all'):
    q = q.strip()
    if not 2 <= len(q) <= 200:
        raise HTTPException(422, 'Enter between 2 and 200 characters')
    if kind != 'all' and kind not in SOURCES:
        raise HTTPException(422, 'Choose a valid result type')
    tokens = re.findall(r'[^\W_]+', q.lower(), flags=re.UNICODE)[:10]
    if not tokens:
        return {'q': q, 'kind': kind, 'results': [], 'has_more': False}
    tsquery = ' & '.join(token[:40] + ':*' for token in tokens)
    numeric = re.fullmatch(r'(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d{1,2})?)', q, flags=re.I)
    branches, params = [], [tsquery]
    for name, (table, text, title, snippet, when, target, amount, extra) in SOURCES.items():
        if kind not in {'all', name}:
            continue
        vector = text if name in {'file', 'history'} else f"to_tsvector('simple', {text})"
        condition = f' AND {extra}' if extra else ''
        predicate = f'{vector} @@ needle.query'
        score = f'ts_rank_cd({vector}, needle.query)'
        if numeric and name in {'expense', 'subscription', 'debt'}:
            predicate = f'({predicate} OR amount = %s)'
            score = f'({score} + CASE WHEN amount = %s THEN 1 ELSE 0 END)'
            amount_value = float(numeric.group(1).replace(',', ''))
            params.extend((amount_value, amount_value))
        branches.append(
            f"(SELECT '{name}' AS kind, id::text AS id, {title} AS title, "
            f"{'left(' + snippet + ',240)' if name != 'note' else snippet} AS snippet, {when} AS occurred_at, "
            f"{target} AS target, {amount} AS amount, {score} AS score "
            f"FROM context.{table} CROSS JOIN needle WHERE {predicate}{condition} "
            f'ORDER BY score DESC, {when} DESC NULLS LAST, id DESC LIMIT 41)'
        )
    sql = "WITH needle AS (SELECT to_tsquery('simple', %s) AS query) SELECT * FROM (" + ' UNION ALL '.join(branches) + ') matches ORDER BY score DESC, occurred_at DESC NULLS LAST, kind, id LIMIT 41'
    with get_conn() as conn:
        rows = conn.execute(sql, params).fetchall()
    results = []
    for row in rows[:40]:
        item = dict(row)
        item['href'] = _href(item['kind'], item)
        if item['kind'] == 'note':
            try:
                payload = json.loads(item['snippet'] or '{}')
                content = payload.get('content', '')
                item['title'] = payload.get('summary') or content[:80] or 'Note'
                item['snippet'] = content[:240]
            except (ValueError, TypeError, AttributeError):
                item['snippet'] = (item['snippet'] or '')[:240]
        item.pop('target', None)
        item.pop('score', None)
        results.append(item)
    return {'q': q, 'kind': kind, 'results': results, 'has_more': len(rows) > 40}


def get_note(note_id):
    with get_conn() as conn:
        row = conn.execute("SELECT id,payload,created_at FROM context.manual WHERE id=%s AND kind IN ('note','task')", (note_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Note not found')
    try:
        payload = json.loads(row['payload'])
        content = payload.get('content') or payload.get('summary') or ''
    except (ValueError, TypeError, AttributeError):
        content = row['payload'] or ''
    return {'id': row['id'], 'content': str(content), 'created_at': row['created_at']}


def update_note(note_id, content):
    with get_conn() as conn:
        row = conn.execute("UPDATE context.manual SET payload=%s WHERE id=%s AND kind IN ('note','task') RETURNING id", (json.dumps({'content': content, 'summary': content[:80]}), note_id)).fetchone()
        if row:
            from services.rag import add_chunk
            add_chunk('manual', note_id, content[:80], content, {'kind': 'note'}, conn=conn)
    if not row:
        raise HTTPException(404, 'Note not found')


RECORDS = {
    'expense': ('spends', 'id,amount,merchant,category,spent_at,created_at'),
    'email': ('emails', 'id,from_name,from_addr,to_addr,subject,body_snippet,received_at,category'),
    'job': ('applications', 'id,company,role,applied_at,status,notes,url,jd'),
    'subscription': ('subscriptions', 'id,name,amount,billing_cycle,category,next_renewal,payment_method,auto_renew,notes'),
    'debt': ('debts', 'id,person,direction,amount,description,due_date,taken_at,settled,notes'),
}


def get_search_record(kind, record_id):
    if kind not in RECORDS:
        raise HTTPException(422, 'Choose a valid record type')
    table, columns = RECORDS[kind]
    with get_conn() as conn:
        row = conn.execute(f'SELECT {columns} FROM context.{table} WHERE id=%s', (record_id,)).fetchone()
    if not row:
        raise HTTPException(404, 'Record not found')
    return {'kind': kind, 'record': dict(row)}
