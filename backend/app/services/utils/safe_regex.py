"""
Safe Regex Utilities
====================
Provides ReDoS-safe regex operations for user-controlled patterns.

Protects against:
- Catastrophic backtracking via nested quantifiers (e.g., (a+)+, (a*)*b)
- Excessively long patterns
- Invalid regex syntax
- Long-running regex operations via thread-based timeout

Usage:
    from app.services.utils.safe_regex import safe_regex_search, safe_regex_match, validate_regex_pattern

    # Validate before use
    result = validate_regex_pattern(user_pattern)
    if not result["safe"]:
        raise ValueError(result["error"])

    # Or use safe wrappers directly (they validate + timeout internally)
    match = safe_regex_search(user_pattern, text)
    match = safe_regex_match(user_pattern, text)
"""

import re
import logging
from typing import Optional, Match, List
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError

logger = logging.getLogger(__name__)

# --- Configuration ---
MAX_REGEX_PATTERN_LENGTH = 500
REGEX_TIMEOUT_SECONDS = 2.0

# Thread pool for timeout-bounded regex execution
_regex_executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="safe-regex")

# Patterns that detect nested quantifiers which cause catastrophic backtracking.
# These match constructs like (a+)+, (a*)*b, (a+)*, (a{2,})+, etc.
# We look for a group containing a quantifier, followed by another quantifier.
_DANGEROUS_PATTERNS = [
    # Nested quantifiers: group with inner quantifier followed by outer quantifier
    # e.g., (a+)+  (a+)*  (a*)+  (a*)*  (a{2,})+  etc.
    re.compile(r'\([^)]*[+*]\)[+*?]'),
    re.compile(r'\([^)]*[+*]\)\{'),
    re.compile(r'\([^)]*\{[^}]*\}\)[+*?]'),
    re.compile(r'\([^)]*\{[^}]*\}\)\{'),
    # Nested quantifiers with non-capturing groups: (?:a+)+
    re.compile(r'\(\?:[^)]*[+*]\)[+*?]'),
    re.compile(r'\(\?:[^)]*[+*]\)\{'),
    # Overlapping alternation with quantifiers: (a|a)+
    # Simplified check: alternation inside a quantified group where branches overlap
    re.compile(r'\([^)]*\|[^)]*\)[+*]\s*$'),
]


def validate_regex_pattern(pattern: str) -> dict:
    """
    Validate a regex pattern for safety before execution.

    Returns:
        dict with keys:
            - safe (bool): True if the pattern is safe to use
            - error (str | None): Description of the problem if not safe
    """
    if not isinstance(pattern, str):
        return {"safe": False, "error": "Regex pattern must be a string"}

    if len(pattern) == 0:
        return {"safe": False, "error": "Regex pattern cannot be empty"}

    if len(pattern) > MAX_REGEX_PATTERN_LENGTH:
        return {
            "safe": False,
            "error": f"Regex pattern too long ({len(pattern)} chars, max {MAX_REGEX_PATTERN_LENGTH})"
        }

    # Check for dangerous patterns that cause catastrophic backtracking
    for dangerous in _DANGEROUS_PATTERNS:
        if dangerous.search(pattern):
            return {
                "safe": False,
                "error": (
                    "Regex pattern contains nested quantifiers that could cause "
                    "catastrophic backtracking (ReDoS). Simplify the pattern by "
                    "removing nested repetition operators like (a+)+, (a*)*."
                )
            }

    # Try compiling to catch syntax errors
    try:
        re.compile(pattern)
    except re.error as e:
        return {"safe": False, "error": f"Invalid regex syntax: {e}"}

    return {"safe": True, "error": None}


def _execute_regex_with_timeout(func, pattern: str, text: str, flags: int = 0,
                                 timeout: float = REGEX_TIMEOUT_SECONDS) -> Optional[Match]:
    """
    Execute a regex operation with a timeout using a thread pool.

    Args:
        func: The regex function to call (re.search, re.match, etc.)
        pattern: The regex pattern
        text: The text to search
        flags: Regex flags
        timeout: Maximum seconds to allow

    Returns:
        The match object, or None on timeout/error

    Raises:
        ValueError: If the pattern is unsafe or invalid
        TimeoutError: If the regex execution exceeds the timeout
    """
    compiled = re.compile(pattern, flags)
    future = _regex_executor.submit(func, compiled, text)
    try:
        return future.result(timeout=timeout)
    except FuturesTimeoutError:
        future.cancel()
        raise TimeoutError(
            f"Regex execution timed out after {timeout}s. "
            f"The pattern may be too complex for the input."
        )


def safe_regex_search(pattern: str, text: str, flags: int = 0,
                       timeout: float = REGEX_TIMEOUT_SECONDS) -> Optional[Match]:
    """
    Safe wrapper around re.search() with validation and timeout.

    Args:
        pattern: User-provided regex pattern
        text: Text to search in
        flags: Regex flags (e.g., re.IGNORECASE)
        timeout: Maximum seconds to allow for execution

    Returns:
        Match object if found, None otherwise

    Raises:
        ValueError: If the pattern is unsafe or syntactically invalid
        TimeoutError: If execution exceeds timeout
    """
    validation = validate_regex_pattern(pattern)
    if not validation["safe"]:
        raise ValueError(validation["error"])

    return _execute_regex_with_timeout(
        lambda compiled, t: compiled.search(t),
        pattern, text, flags, timeout
    )


def safe_regex_match(pattern: str, text: str, flags: int = 0,
                      timeout: float = REGEX_TIMEOUT_SECONDS) -> Optional[Match]:
    """
    Safe wrapper around re.match() with validation and timeout.

    Args:
        pattern: User-provided regex pattern
        text: Text to match against
        flags: Regex flags (e.g., re.IGNORECASE)
        timeout: Maximum seconds to allow for execution

    Returns:
        Match object if pattern matches at start, None otherwise

    Raises:
        ValueError: If the pattern is unsafe or syntactically invalid
        TimeoutError: If execution exceeds timeout
    """
    validation = validate_regex_pattern(pattern)
    if not validation["safe"]:
        raise ValueError(validation["error"])

    return _execute_regex_with_timeout(
        lambda compiled, t: compiled.match(t),
        pattern, text, flags, timeout
    )


def safe_regex_findall(pattern: str, text: str, flags: int = 0,
                        timeout: float = REGEX_TIMEOUT_SECONDS) -> List:
    """
    Safe wrapper around re.findall() with validation and timeout.

    Args:
        pattern: User-provided regex pattern
        text: Text to search in
        flags: Regex flags
        timeout: Maximum seconds to allow

    Returns:
        List of matches

    Raises:
        ValueError: If the pattern is unsafe or syntactically invalid
        TimeoutError: If execution exceeds timeout
    """
    validation = validate_regex_pattern(pattern)
    if not validation["safe"]:
        raise ValueError(validation["error"])

    compiled = re.compile(pattern, flags)
    future = _regex_executor.submit(compiled.findall, text)
    try:
        return future.result(timeout=timeout)
    except FuturesTimeoutError:
        future.cancel()
        raise TimeoutError(
            f"Regex execution timed out after {timeout}s. "
            f"The pattern may be too complex for the input."
        )
