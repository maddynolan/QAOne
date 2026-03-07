"""
Trace Logging Middleware

Adds a trace_id to every request for issue tracking and log correlation.
- Incoming X-Trace-ID is used if present; otherwise a new UUID is generated.
- trace_id is set on request.state and in a context var so logs can include it.
- Log format is structured (key=value) so aggregators can index by trace_id.

Security:
- PIISanitizationFilter masks emails, IPs, auth tokens, and API keys in log output.
"""

import logging
import re
import uuid
from contextvars import ContextVar
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

# Context var for current trace_id (used by TraceIdFilter)
trace_id_ctx: ContextVar[str] = ContextVar("trace_id", default="")

# ── PII Sanitization patterns ──
_EMAIL_PATTERN = re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}')
_BEARER_PATTERN = re.compile(r'Bearer\s+[A-Za-z0-9\-._~+/]+=*', re.IGNORECASE)
_API_KEY_PATTERN = re.compile(r'(sk-|pk-|api[_-]?key[=:]\s*)[A-Za-z0-9\-._]{10,}', re.IGNORECASE)
_IP_V4_PATTERN = re.compile(r'\b(?:\d{1,3}\.){3}\d{1,3}\b')


def _mask_email(match: re.Match) -> str:
    email = match.group(0)
    parts = email.split("@")
    if len(parts) == 2:
        user = parts[0]
        domain = parts[1]
        return f"{user[0]}***@{domain[0]}***.{domain.split('.')[-1]}"
    return "***@***.***"


def _mask_ip(match: re.Match) -> str:
    ip = match.group(0)
    parts = ip.split(".")
    if len(parts) == 4:
        return f"{parts[0]}.{parts[1]}.x.x"
    return "x.x.x.x"


def _sanitize_log_message(msg: str) -> str:
    """Remove PII from log messages: emails, tokens, API keys, IPs."""
    msg = _EMAIL_PATTERN.sub(_mask_email, msg)
    msg = _BEARER_PATTERN.sub("Bearer [REDACTED]", msg)
    msg = _API_KEY_PATTERN.sub(lambda m: m.group(1) + "[REDACTED]", msg)
    msg = _IP_V4_PATTERN.sub(_mask_ip, msg)
    return msg


class PIISanitizationFilter(logging.Filter):
    """
    Log filter that masks PII (emails, IPs, tokens, API keys) in log output.
    Applied globally to prevent accidental PII leakage in application logs.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = _sanitize_log_message(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: _sanitize_log_message(str(v)) if isinstance(v, str) else v
                               for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    _sanitize_log_message(str(a)) if isinstance(a, str) else a
                    for a in record.args
                )
        return True


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
