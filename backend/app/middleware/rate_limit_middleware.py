"""
Global API Rate Limiting Middleware
Enterprise security: Protects against DDoS and abuse.

Rate limits (per IP):
- Default API: 100 requests/minute
- Auth endpoints: 10 requests/minute
- AI endpoints: 20 requests/minute
- File upload: 5 requests/minute
- Health/metrics: unlimited (monitoring)

Backend selection via RATE_LIMIT_BACKEND env var:
- "memory" (default): In-memory sliding window — single process only
- "redis": Redis-backed sliding window — works across multiple workers
"""

import os
import time
import logging
from collections import defaultdict
from typing import Dict, Tuple, Optional
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Rate limit configuration: (max_requests, window_seconds)
RATE_LIMITS: Dict[str, Tuple[int, int]] = {
    "/auth": (10, 60),           # 10/min for auth
    "/api/mfa": (10, 60),        # 10/min for MFA
    "/api/ai-testing": (20, 60), # 20/min for AI testing
    "/api/ai/enhancements": (20, 60),  # 20/min for AI enhancements
    "/api/llm": (20, 60),        # 20/min for LLM calls
    "/ai": (30, 60),             # 30/min for AI generation
    "/api/import": (5, 60),      # 5/min for file uploads
    "/api/privacy": (5, 60),     # 5/min for privacy/erasure
}

DEFAULT_RATE_LIMIT = (100, 60)  # 100 requests/minute default

# Paths excluded from rate limiting
EXCLUDED_PATHS = {
    "/health",
    "/health/database",
    "/health/metrics",
    "/metrics",
    "/docs",
    "/openapi.json",
    "/redoc",
}


class InMemoryRateLimiter:
    """Simple in-memory sliding window rate limiter.

    Good for single-process development. For production with multiple
    workers/pods, use RedisRateLimiter via RATE_LIMIT_BACKEND=redis.
    """

    def __init__(self):
        self._requests: Dict[str, list] = defaultdict(list)
        self._cleanup_counter = 0

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - window_seconds
        self._requests[key] = [t for t in self._requests[key] if t > window_start]
        current_count = len(self._requests[key])

        if current_count >= max_requests:
            return True, 0

        self._requests[key].append(now)

        self._cleanup_counter += 1
        if self._cleanup_counter >= 1000:
            self._cleanup_counter = 0
            self._cleanup_stale_keys()

        return False, max_requests - current_count - 1

    def _cleanup_stale_keys(self):
        now = time.time()
        stale_keys = [
            key for key, timestamps in self._requests.items()
            if not timestamps or max(timestamps) < now - 120
        ]
        for key in stale_keys:
            del self._requests[key]


class RedisRateLimiter:
    """Redis-backed sliding window rate limiter.

    Uses sorted sets for accurate sliding window counting.
    Works across multiple backend workers/pods.
    Requires: REDIS_URL env var.
    """

    def __init__(self, redis_url: str):
        self._redis = None
        self._redis_url = redis_url
        self._connected = False

    def _get_redis(self):
        """Lazy-connect to Redis."""
        if self._redis is None:
            try:
                import redis as redis_lib
                self._redis = redis_lib.from_url(
                    self._redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=1,
                )
                self._redis.ping()
                self._connected = True
                logger.info("Rate limiter connected to Redis")
            except Exception as e:
                logger.warning(f"Redis rate limiter connection failed: {e}. Falling back to in-memory.")
                self._redis = None
                self._connected = False
        return self._redis

    def is_rate_limited(self, key: str, max_requests: int, window_seconds: int) -> Tuple[bool, int]:
        r = self._get_redis()
        if r is None:
            # Fallback: allow request if Redis is down (fail-open)
            return False, max_requests

        try:
            now = time.time()
            window_start = now - window_seconds
            pipe = r.pipeline()

            redis_key = f"ratelimit:{key}"

            # Remove entries outside the window
            pipe.zremrangebyscore(redis_key, 0, window_start)
            # Count entries in the window
            pipe.zcard(redis_key)
            # Add current request
            pipe.zadd(redis_key, {str(now): now})
            # Set expiry on the key
            pipe.expire(redis_key, window_seconds + 1)

            results = pipe.execute()
            current_count = results[1]  # zcard result

            if current_count >= max_requests:
                return True, 0

            return False, max_requests - current_count - 1

        except Exception as e:
            logger.warning(f"Redis rate limit error: {e}. Allowing request.")
            return False, max_requests


def _create_limiter():
    """Create the appropriate rate limiter based on RATE_LIMIT_BACKEND env var."""
    backend = os.getenv("RATE_LIMIT_BACKEND", "memory").lower()
    if backend == "redis":
        redis_url = os.getenv("REDIS_URL", "")
        if redis_url:
            logger.info("Using Redis-backed rate limiter")
            return RedisRateLimiter(redis_url)
        else:
            logger.warning("RATE_LIMIT_BACKEND=redis but REDIS_URL not set. Using in-memory.")
    return InMemoryRateLimiter()


# Global limiter instance
_limiter = _create_limiter()


def _get_client_ip(request: Request) -> str:
    """Extract client IP, respecting X-Forwarded-For behind proxy."""
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip
    return request.client.host if request.client else "unknown"


def _get_rate_limit(path: str) -> Tuple[int, int]:
    """Get rate limit for a given path."""
    for prefix, limit in RATE_LIMITS.items():
        if path.startswith(prefix):
            return limit
    return DEFAULT_RATE_LIMIT


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Enterprise rate limiting middleware.

    Applies per-IP rate limits with configurable limits per path prefix.
    Returns 429 Too Many Requests when limit is exceeded.
    Supports in-memory (default) and Redis backends.
    """

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Skip rate limiting for excluded paths
        if any(path.startswith(exc) for exc in EXCLUDED_PATHS):
            return await call_next(request)

        # Skip OPTIONS (CORS preflight)
        if request.method == "OPTIONS":
            return await call_next(request)

        client_ip = _get_client_ip(request)
        max_requests, window_seconds = _get_rate_limit(path)

        # Build rate limit key
        rate_key = f"{client_ip}:{path.split('/')[1] if '/' in path[1:] else 'root'}"

        is_limited, remaining = _limiter.is_rate_limited(rate_key, max_requests, window_seconds)

        if is_limited:
            logger.warning(f"Rate limit exceeded: IP={client_ip} path={path}")
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please try again later.",
                    "retry_after": window_seconds,
                },
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + window_seconds),
                },
            )

        # Process request and add rate limit headers
        response = await call_next(request)
        response.headers["X-RateLimit-Limit"] = str(max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        return response
