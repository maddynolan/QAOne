"""
Trace Logging Middleware

Adds a trace_id to every request for issue tracking and log correlation.
- Incoming X-Trace-ID is used if present; otherwise a new UUID is generated.
- trace_id is set on request.state and in a context var so logs can include it.
- Log format is structured (key=value) so aggregators can index by trace_id.
"""

import logging
import uuid
from contextvars import ContextVar
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Context var for current trace_id (used by TraceIdFilter)
trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="")


class TraceIdFilter(logging.Filter):
    """Adds trace_id to every log record for traceable logs."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.trace_id = getattr(record, "trace_id", trace_id_ctx.get()) or "-"
        return True


class TraceLoggingMiddleware(BaseHTTPMiddleware):
    """
    Assigns trace_id to each request and sets it in context for structured logging.
    Response includes X-Trace-ID header so clients can report it when raising issues.
    """

    async def dispatch(self, request: Request, call_next):
        trace_id = request.headers.get("X-Trace-ID") or str(uuid.uuid4())
        request.state.trace_id = trace_id
        token = trace_id_ctx.set(trace_id)
        try:
            response = await call_next(request)
            response.headers["X-Trace-ID"] = trace_id
            return response
        finally:
            trace_id_ctx.reset(token)
