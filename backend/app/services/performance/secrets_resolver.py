"""
Secrets Resolver - Resolve {{VAR}} placeholders from environment at runtime.

Never store credentials in scenarios. Use env vars (e.g. AUTH_TOKEN, API_KEY)
and reference as {{AUTH_TOKEN}} in headers/body/URL. Resolved at execution time.
"""

import os
import re
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Pattern: {{VAR_NAME}} or {{ VAR_NAME }}
PLACEHOLDER_PATTERN = re.compile(r'\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}')


def resolve_secrets(value: Any, env: Optional[Dict[str, str]] = None) -> Any:
    """
    Replace {{VAR}} in strings with os.environ[VAR] or env[VAR].
    If VAR is missing, leaves placeholder as-is (or optional: raise / empty).
    Recurses into dicts and lists.
    """
    if value is None:
        return value
    if isinstance(value, str):
        source = env if env is not None else os.environ
        def repl(match: re.Match) -> str:
            key = match.group(1)
            v = source.get(key)
            if v is not None:
                return v
            logger.debug(f"Secret placeholder {{{{{key}}}}} not set in env")
            return match.group(0)  # leave unchanged if not set
        return PLACEHOLDER_PATTERN.sub(repl, value)
    if isinstance(value, dict):
        return {k: resolve_secrets(v, env) for k, v in value.items()}
    if isinstance(value, list):
        return [resolve_secrets(v, env) for v in value]
    return value


def resolve_headers(headers: Optional[Dict[str, str]], env: Optional[Dict[str, str]] = None) -> Optional[Dict[str, str]]:
    """Resolve {{VAR}} in header values (e.g. Authorization: Bearer {{AUTH_TOKEN}})."""
    if not headers:
        return headers
    return resolve_secrets(headers, env)


def resolve_body(body: Any, env: Optional[Dict[str, str]] = None) -> Any:
    """Resolve {{VAR}} in body (string or JSON-like dict/list)."""
    return resolve_secrets(body, env)


def resolve_url(url: str, env: Optional[Dict[str, str]] = None) -> str:
    """Resolve {{VAR}} in URL (e.g. https://api.example.com?key={{API_KEY}})."""
    if not url:
        return url
    return resolve_secrets(url, env)
