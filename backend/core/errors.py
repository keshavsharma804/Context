"""Useful production failures without logging credentials, queries, or request bodies."""

import logging
from uuid import uuid4

import psycopg
from psycopg_pool import PoolTimeout
from starlette.responses import JSONResponse


def request_failure(error, stage):
    reference = uuid4().hex[:12]
    sqlstate = getattr(error, 'sqlstate', None)
    database_error = isinstance(error, (psycopg.Error, PoolTimeout)) or (
        stage in {'session_lookup', 'account_operation'} and isinstance(error, RuntimeError)
    )
    if database_error:
        code = 'AUTH_DATABASE_SCHEMA_ERROR' if sqlstate and sqlstate.startswith('42') else 'AUTH_DATABASE_UNAVAILABLE'
        message = 'Account storage is temporarily unavailable. Please try again shortly.'
        status = 503
    else:
        code, message, status = 'SERVER_ERROR', 'The server could not complete this request. Please try again.', 500
    logging.getLogger('context.requests').error(
        'request_failed reference=%s stage=%s code=%s exception=%s sqlstate=%s',
        reference, stage, code, type(error).__name__, sqlstate or 'none',
    )
    return JSONResponse({'ok': False, 'error': message, 'code': code, 'reference': reference},
                        status_code=status, headers={'Cache-Control': 'no-store'})
