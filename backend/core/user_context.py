from contextvars import ContextVar

# Copied into FastAPI's worker threads; never read identity from request parameters.
current_user_id = ContextVar("current_user_id", default=None)
