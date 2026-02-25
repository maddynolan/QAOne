"""
AI Settings Service — BYOK key management, budget tracking, and per-org/project AI configuration.

Provides centralized management for AI provider settings, encrypted API key storage,
daily budget enforcement, usage logging, and connection testing. Uses PostgreSQL
for persistence with an in-memory fallback when the database is unavailable.

Usage:
    from app.services.core.ai_settings_service import get_ai_settings_service

    service = get_ai_settings_service()
    settings = service.get_settings("org-uuid")
    service.store_api_key("org-uuid", "openai", "sk-...")
    key = service.resolve_api_key("org-uuid", provider="openai")
    allowed = service.check_budget("org-uuid")
    service.track_usage("org-uuid", "openai", "gpt-4o-mini", 500, 200, 3, True)
"""

import base64
import hashlib
import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Default org ID for unauthenticated / demo requests
DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001"

# All recognized AI feature identifiers
ALL_AI_FEATURES: List[str] = [
    "test_case_generation",
    "test_step_suggestions",
    "self_healing",
    "smart_locators",
    "api_test_generation",
    "api_mock_generation",
    "perf_analysis",
    "load_pattern_suggestions",
    "visual_analysis",
    "a11y_suggestions",
    "defect_analysis",
    "defect_triage",
    "code_generation",
    "code_optimization",
    "requirement_analysis",
    "gherkin_generation",
    "sf_test_generation",
    "sf_data_generation",
    "chat_assistant",
    "smart_fill",
]

# Default settings returned when nothing is found in DB or memory
_DEFAULT_SETTINGS: Dict[str, Any] = {
    "enabled": False,
    "provider": "openai",
    "model": "gpt-4o-mini",
    "has_api_key": False,
    "has_anthropic_key": False,
    "custom_endpoint": None,
    "max_requests_per_day": 1000,
    "max_cost_per_day_cents": 1000,
    "budget_tracking": True,
    "enabled_features": ALL_AI_FEATURES.copy(),
    "requests_today": 0,
    "cost_today_cents": 0,
}


# ---------------------------------------------------------------------------
# Encryption helpers  (Fernet-based, deterministic key derivation)
# ---------------------------------------------------------------------------

def _get_fernet():
    """
    Build a Fernet cipher from a server-side secret.

    The secret is read from ENCRYPTION_KEY (or SECRETS_ENCRYPTION_KEY as
    fallback). A SHA-256 digest is taken and base64-url-safe encoded to
    produce the 32-byte key that Fernet requires.
    """
    try:
        from cryptography.fernet import Fernet
    except ImportError:
        logger.error("[AISettings] cryptography package not installed — encryption unavailable")
        return None

    secret = os.getenv(
        "ENCRYPTION_KEY",
        os.getenv("SECRETS_ENCRYPTION_KEY", "flowstral-default-key-change-me"),
    )
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode()).digest())
    return Fernet(key)


def _encrypt(value: str) -> Optional[str]:
    """Encrypt *value* and return the cipher-text as a UTF-8 string (or None on failure)."""
    fernet = _get_fernet()
    if fernet is None:
        return None
    try:
        return fernet.encrypt(value.encode()).decode()
    except Exception as exc:
        logger.error(f"[AISettings] Encryption failed: {exc}")
        return None


def _decrypt(token: str) -> Optional[str]:
    """Decrypt a Fernet token string and return the plain-text (or None on failure)."""
    fernet = _get_fernet()
    if fernet is None:
        return None
    try:
        return fernet.decrypt(token.encode()).decode()
    except Exception as exc:
        logger.error(f"[AISettings] Decryption failed: {exc}")
        return None


# ---------------------------------------------------------------------------
# PostgreSQL connection helper  (mirrors auto_migrate.py SSL fallback chain)
# ---------------------------------------------------------------------------

def _get_connection():
    """
    Open a psycopg2 connection to PostgreSQL using the same SSL fallback
    strategy used by ``auto_migrate.py`` and ``seed_demo_data.py``.

    Returns a connection object or *None* if the database is unreachable.
    """
    try:
        import psycopg2
    except ImportError:
        return None

    db_url = os.getenv("DATABASE_URL", "")
    if not db_url:
        return None

    sep = "&" if "?" in db_url else "?"
    attempts = [
        ("sslmode=require", db_url + sep + "sslmode=require"),
        ("sslmode=prefer", db_url + sep + "sslmode=prefer"),
        ("sslmode=disable", db_url + sep + "sslmode=disable"),
        ("as-is", db_url),
    ]

    for label, dsn in attempts:
        try:
            conn = psycopg2.connect(dsn, connect_timeout=5)
            conn.autocommit = False
            return conn
        except Exception:
            continue

    return None


def _ensure_encrypted_keys_table(conn) -> bool:
    """
    Create the ``ai_encrypted_keys`` table if it does not already exist.

    This avoids altering the migration-managed ``ai_settings`` table while
    still persisting encrypted API keys in PostgreSQL.
    """
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ai_encrypted_keys (
                    id          BIGSERIAL PRIMARY KEY,
                    org_id      UUID NOT NULL,
                    provider    TEXT NOT NULL,
                    encrypted_key TEXT NOT NULL,
                    created_at  TIMESTAMPTZ DEFAULT NOW(),
                    updated_at  TIMESTAMPTZ DEFAULT NOW(),
                    UNIQUE(org_id, provider)
                );
                CREATE INDEX IF NOT EXISTS idx_ai_encrypted_keys_org
                    ON ai_encrypted_keys(org_id);
            """)
            conn.commit()
        return True
    except Exception as exc:
        try:
            conn.rollback()
        except Exception:
            pass
        logger.debug(f"[AISettings] Could not ensure ai_encrypted_keys table: {exc}")
        return False


# ---------------------------------------------------------------------------
# AISettingsService
# ---------------------------------------------------------------------------

class AISettingsService:
    """
    Singleton service for AI provider configuration, key management,
    budget tracking, usage logging, and connection testing.

    All public methods are synchronous.  They attempt PostgreSQL first and
    fall back to an in-memory dict when the database is unavailable.
    """

    def __init__(self):
        # In-memory fallback stores
        self._settings_cache: Dict[str, Dict[str, Any]] = {}   # cache_key -> settings dict
        self._keys_cache: Dict[str, str] = {}                   # "org_id:provider" -> decrypted key
        self._usage_log: List[Dict[str, Any]] = []              # recent usage entries (circular, capped)

        self._db_tables_ensured = False
        self._max_memory_usage_entries = 10_000

        logger.info("[AISettings] Service initialized")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _cache_key(org_id: str, project_id: Optional[str] = None) -> str:
        """Build a composite key for the in-memory settings cache."""
        return f"{org_id}:{project_id or 'org'}"

    def _ensure_tables(self, conn) -> bool:
        """Ensure custom tables exist (idempotent, called once per lifetime)."""
        if self._db_tables_ensured:
            return True
        ok = _ensure_encrypted_keys_table(conn)
        if ok:
            self._db_tables_ensured = True
        return ok

    @staticmethod
    def _row_to_settings(row: Dict[str, Any]) -> Dict[str, Any]:
        """Transform a database row (from ai_settings) into the public settings dict."""
        enabled_features = row.get("enabled_features") or ALL_AI_FEATURES.copy()
        if isinstance(enabled_features, str):
            try:
                enabled_features = json.loads(enabled_features)
            except (json.JSONDecodeError, TypeError):
                enabled_features = ALL_AI_FEATURES.copy()

        return {
            "enabled": bool(row.get("enabled", False)),
            "provider": row.get("provider", "openai"),
            "model": row.get("model", "gpt-4o-mini"),
            "has_api_key": bool(row.get("api_key_secret_id")),
            "has_anthropic_key": bool(row.get("anthropic_key_secret_id")),
            "custom_endpoint": row.get("custom_endpoint"),
            "max_requests_per_day": row.get("max_requests_per_day", 1000),
            "max_cost_per_day_cents": row.get("max_cost_per_day_cents", 1000),
            "budget_tracking": bool(row.get("budget_tracking", True)),
            "enabled_features": enabled_features,
            "requests_today": row.get("requests_today", 0),
            "cost_today_cents": row.get("cost_today_cents", 0),
        }

    def _now_utc(self) -> datetime:
        return datetime.now(timezone.utc)

    # ------------------------------------------------------------------
    # 1. get_settings
    # ------------------------------------------------------------------

    def get_settings(self, org_id: str, project_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Retrieve AI settings for an organisation (and optionally a project).

        Resolution order:
            1. Project-specific row (if *project_id* supplied)
            2. Org-level row (project_id IS NULL)
            3. Hardcoded defaults

        The result is augmented with ``has_api_key`` / ``has_anthropic_key``
        booleans derived from the encrypted-keys store.
        """
        conn = _get_connection()
        settings = None

        if conn:
            try:
                self._ensure_tables(conn)
                from psycopg2.extras import RealDictCursor

                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Try project-specific first
                    if project_id:
                        cur.execute(
                            "SELECT * FROM ai_settings WHERE org_id = %s AND project_id = %s LIMIT 1",
                            (org_id, project_id),
                        )
                        row = cur.fetchone()
                        if row:
                            settings = self._row_to_settings(dict(row))

                    # Fallback to org-level
                    if settings is None:
                        cur.execute(
                            "SELECT * FROM ai_settings WHERE org_id = %s AND project_id IS NULL LIMIT 1",
                            (org_id,),
                        )
                        row = cur.fetchone()
                        if row:
                            settings = self._row_to_settings(dict(row))
            except Exception as exc:
                logger.warning(f"[AISettings] DB read failed, using in-memory fallback: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # In-memory fallback
        if settings is None:
            ck = self._cache_key(org_id, project_id)
            settings = self._settings_cache.get(ck)
            if settings is None and project_id:
                # Fall back to org-level in memory
                ck_org = self._cache_key(org_id)
                settings = self._settings_cache.get(ck_org)

        if settings is None:
            settings = _DEFAULT_SETTINGS.copy()

        # Augment with key availability from the keys cache
        openai_key = self.resolve_api_key(org_id, project_id, "openai")
        anthropic_key = self.resolve_api_key(org_id, project_id, "anthropic")
        settings["has_api_key"] = openai_key is not None
        settings["has_anthropic_key"] = anthropic_key is not None

        return settings

    # ------------------------------------------------------------------
    # 2. update_settings
    # ------------------------------------------------------------------

    def update_settings(self, org_id: str, project_id: Optional[str] = None, **updates) -> Dict[str, Any]:
        """
        Upsert AI settings for an org/project.

        Only the keys present in *updates* are written; other columns retain
        their current values.  Returns the merged settings dict.
        """
        # Allowlisted columns that callers may update
        allowed_columns = {
            "enabled", "provider", "model", "custom_endpoint",
            "max_requests_per_day", "max_cost_per_day_cents",
            "budget_tracking", "enabled_features",
        }
        filtered = {k: v for k, v in updates.items() if k in allowed_columns}
        if not filtered:
            return self.get_settings(org_id, project_id)

        # --- Attempt PostgreSQL upsert ---
        conn = _get_connection()
        if conn:
            try:
                self._ensure_tables(conn)

                # Build the dynamic SET clause for the UPSERT
                set_parts = []
                values: list = []
                for col, val in filtered.items():
                    set_parts.append(f"{col} = %s")
                    if col == "enabled_features":
                        values.append(json.dumps(val) if not isinstance(val, str) else val)
                    else:
                        values.append(val)
                set_parts.append("updated_at = NOW()")
                set_clause = ", ".join(set_parts)

                # Also include the same columns in the INSERT
                insert_cols = ["org_id", "project_id"] + list(filtered.keys()) + ["updated_at"]
                insert_placeholders = ["%s", "%s"] + ["%s"] * len(filtered) + ["NOW()"]
                insert_values = [org_id, project_id]
                for col in filtered:
                    if col == "enabled_features":
                        insert_values.append(json.dumps(filtered[col]) if not isinstance(filtered[col], str) else filtered[col])
                    else:
                        insert_values.append(filtered[col])

                sql = f"""
                    INSERT INTO ai_settings (id, {', '.join(insert_cols)})
                    VALUES (uuid_generate_v4(), {', '.join(insert_placeholders)})
                    ON CONFLICT (org_id, project_id)
                        WHERE project_id IS NOT DISTINCT FROM %s
                    DO UPDATE SET {set_clause}
                """
                # For the ON CONFLICT WHERE clause we re-use project_id
                # and for the SET clause we re-use filtered values
                # Full param list: insert_values + [project_id for WHERE] + values for SET
                all_params = insert_values + [project_id] + values

                with conn.cursor() as cur:
                    # Ensure unique partial index exists (idempotent)
                    cur.execute("""
                        CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_settings_org_project
                        ON ai_settings (org_id, COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::uuid))
                    """)
                    conn.commit()

                # The above approach is fragile with NULLable project_id unique constraints.
                # A simpler two-step upsert is more robust:
                with conn.cursor() as cur:
                    if project_id:
                        cur.execute(
                            "SELECT id FROM ai_settings WHERE org_id = %s AND project_id = %s",
                            (org_id, project_id),
                        )
                    else:
                        cur.execute(
                            "SELECT id FROM ai_settings WHERE org_id = %s AND project_id IS NULL",
                            (org_id,),
                        )
                    existing = cur.fetchone()

                    if existing:
                        row_id = existing[0]
                        set_parts_clean = []
                        set_vals: list = []
                        for col, val in filtered.items():
                            set_parts_clean.append(f"{col} = %s")
                            if col == "enabled_features":
                                set_vals.append(json.dumps(val) if not isinstance(val, str) else val)
                            else:
                                set_vals.append(val)
                        set_parts_clean.append("updated_at = NOW()")
                        set_vals.append(str(row_id))
                        cur.execute(
                            f"UPDATE ai_settings SET {', '.join(set_parts_clean)} WHERE id = %s",
                            tuple(set_vals),
                        )
                    else:
                        cols = ["id", "org_id", "project_id"]
                        vals_list: list = [str(uuid.uuid4()), org_id, project_id]
                        placeholders = ["%s", "%s", "%s"]
                        for col, val in filtered.items():
                            cols.append(col)
                            if col == "enabled_features":
                                vals_list.append(json.dumps(val) if not isinstance(val, str) else val)
                            else:
                                vals_list.append(val)
                            placeholders.append("%s")
                        cur.execute(
                            f"INSERT INTO ai_settings ({', '.join(cols)}) VALUES ({', '.join(placeholders)})",
                            tuple(vals_list),
                        )
                    conn.commit()

                logger.info(f"[AISettings] Updated settings for org={org_id} project={project_id}: {list(filtered.keys())}")
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"[AISettings] DB upsert failed, updating in-memory only: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # --- Always update in-memory cache ---
        ck = self._cache_key(org_id, project_id)
        current = self._settings_cache.get(ck, _DEFAULT_SETTINGS.copy())
        current.update(filtered)
        self._settings_cache[ck] = current

        return self.get_settings(org_id, project_id)

    # ------------------------------------------------------------------
    # 3. store_api_key
    # ------------------------------------------------------------------

    def store_api_key(self, org_id: str, provider: str, api_key: str) -> bool:
        """
        Encrypt and persist an API key for the given org and provider.

        The key is stored in the ``ai_encrypted_keys`` table (PostgreSQL) and
        also cached in memory for fast resolution.

        Args:
            org_id:   Organisation UUID.
            provider: ``"openai"`` or ``"anthropic"``.
            api_key:  The raw API key string.

        Returns:
            ``True`` on success, ``False`` on failure.
        """
        if not api_key or not api_key.strip():
            logger.warning("[AISettings] Attempted to store empty API key")
            return False

        provider = provider.lower().strip()
        encrypted = _encrypt(api_key)
        if encrypted is None:
            logger.error("[AISettings] Encryption unavailable, storing key in memory only")
            self._keys_cache[f"{org_id}:{provider}"] = api_key
            return True

        # Persist to PostgreSQL
        conn = _get_connection()
        if conn:
            try:
                self._ensure_tables(conn)
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO ai_encrypted_keys (org_id, provider, encrypted_key, updated_at)
                        VALUES (%s, %s, %s, NOW())
                        ON CONFLICT (org_id, provider)
                        DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key,
                                      updated_at    = NOW()
                    """, (org_id, provider, encrypted))
                    conn.commit()
                logger.info(f"[AISettings] Stored encrypted {provider} key for org={org_id}")
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"[AISettings] DB key storage failed: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # Always cache in memory
        self._keys_cache[f"{org_id}:{provider}"] = api_key
        return True

    # ------------------------------------------------------------------
    # 4. delete_api_key
    # ------------------------------------------------------------------

    def delete_api_key(self, org_id: str, provider: str) -> bool:
        """
        Remove a stored API key for the given org and provider.

        Deletes from both PostgreSQL and the in-memory cache.

        Returns:
            ``True`` if a key was removed from at least one store.
        """
        provider = provider.lower().strip()
        removed = False

        # Remove from PostgreSQL
        conn = _get_connection()
        if conn:
            try:
                self._ensure_tables(conn)
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM ai_encrypted_keys WHERE org_id = %s AND provider = %s",
                        (org_id, provider),
                    )
                    if cur.rowcount and cur.rowcount > 0:
                        removed = True
                    conn.commit()
                logger.info(f"[AISettings] Deleted {provider} key for org={org_id} (DB)")
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.warning(f"[AISettings] DB key deletion failed: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # Remove from memory
        cache_key = f"{org_id}:{provider}"
        if cache_key in self._keys_cache:
            del self._keys_cache[cache_key]
            removed = True

        return removed

    # ------------------------------------------------------------------
    # 5. resolve_api_key
    # ------------------------------------------------------------------

    def resolve_api_key(
        self,
        org_id: str,
        project_id: Optional[str] = None,
        provider: str = "openai",
    ) -> Optional[str]:
        """
        Resolve an API key through a multi-layer chain:

            1. In-memory cache (org+project, then org-level)
            2. PostgreSQL ``ai_encrypted_keys`` table (decrypt on read)
            3. Server environment variables (``OPENAI_API_KEY`` / ``ANTHROPIC_API_KEY``)

        Returns the plain-text key or ``None`` if nothing is found.
        """
        provider = provider.lower().strip()

        # --- Layer 1: in-memory cache ---
        if project_id:
            mem_key = f"{org_id}:{provider}"  # org-level is the key granularity
            cached = self._keys_cache.get(mem_key)
            if cached:
                return cached
        mem_key_org = f"{org_id}:{provider}"
        cached = self._keys_cache.get(mem_key_org)
        if cached:
            return cached

        # --- Layer 2: PostgreSQL ---
        conn = _get_connection()
        if conn:
            try:
                self._ensure_tables(conn)
                from psycopg2.extras import RealDictCursor

                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    cur.execute(
                        "SELECT encrypted_key FROM ai_encrypted_keys WHERE org_id = %s AND provider = %s LIMIT 1",
                        (org_id, provider),
                    )
                    row = cur.fetchone()
                    if row and row.get("encrypted_key"):
                        decrypted = _decrypt(row["encrypted_key"])
                        if decrypted:
                            # Warm the in-memory cache
                            self._keys_cache[mem_key_org] = decrypted
                            return decrypted
            except Exception as exc:
                logger.debug(f"[AISettings] DB key lookup failed: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # --- Layer 3: server environment variables ---
        env_map = {
            "openai": "OPENAI_API_KEY",
            "anthropic": "ANTHROPIC_API_KEY",
        }
        env_var = env_map.get(provider)
        if env_var:
            env_val = os.getenv(env_var)
            if env_val:
                return env_val

        return None

    # ------------------------------------------------------------------
    # 6. is_ai_enabled
    # ------------------------------------------------------------------

    def is_ai_enabled(self, org_id: str, project_id: Optional[str] = None) -> bool:
        """
        Check whether AI features are enabled for an org/project.

        Returns ``True`` only when the settings ``enabled`` flag is set **and**
        at least one provider key is resolvable.
        """
        settings = self.get_settings(org_id, project_id)
        if not settings.get("enabled", False):
            return False

        # At least one key must be available
        has_openai = self.resolve_api_key(org_id, project_id, "openai") is not None
        has_anthropic = self.resolve_api_key(org_id, project_id, "anthropic") is not None
        return has_openai or has_anthropic

    # ------------------------------------------------------------------
    # 7. check_budget
    # ------------------------------------------------------------------

    def check_budget(self, org_id: str) -> Dict[str, Any]:
        """
        Evaluate the remaining daily budget for *org_id*.

        If ``budget_reset_at`` is older than the start of today (UTC), the
        counters are automatically reset before the check.

        Returns::

            {
                "allowed": bool,
                "requests_remaining": int,
                "cost_remaining_cents": int,
                "requests_today": int,
                "cost_today_cents": int,
            }
        """
        settings = self.get_settings(org_id)

        if not settings.get("budget_tracking", True):
            return {
                "allowed": True,
                "requests_remaining": settings.get("max_requests_per_day", 1000),
                "cost_remaining_cents": settings.get("max_cost_per_day_cents", 1000),
                "requests_today": 0,
                "cost_today_cents": 0,
            }

        # --- Reset counters if budget_reset_at is before today ---
        self._maybe_reset_budget(org_id)
        # Re-read after potential reset
        settings = self.get_settings(org_id)

        max_req = settings.get("max_requests_per_day", 1000)
        max_cost = settings.get("max_cost_per_day_cents", 1000)
        req_today = settings.get("requests_today", 0)
        cost_today = settings.get("cost_today_cents", 0)

        requests_remaining = max(0, max_req - req_today)
        cost_remaining = max(0, max_cost - cost_today)
        allowed = requests_remaining > 0 and cost_remaining > 0

        return {
            "allowed": allowed,
            "requests_remaining": requests_remaining,
            "cost_remaining_cents": cost_remaining,
            "requests_today": req_today,
            "cost_today_cents": cost_today,
        }

    def _maybe_reset_budget(self, org_id: str):
        """Reset daily budget counters if the reset timestamp is stale."""
        today_start = self._now_utc().replace(hour=0, minute=0, second=0, microsecond=0)

        conn = _get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    cur.execute("""
                        UPDATE ai_settings
                        SET requests_today = 0,
                            cost_today_cents = 0,
                            budget_reset_at = NOW(),
                            updated_at = NOW()
                        WHERE org_id = %s
                          AND budget_reset_at < %s
                    """, (org_id, today_start))
                    conn.commit()
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.debug(f"[AISettings] Budget reset DB update failed: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # Also reset in-memory cache
        for ck, cached in self._settings_cache.items():
            if ck.startswith(f"{org_id}:"):
                cached["requests_today"] = 0
                cached["cost_today_cents"] = 0

    # ------------------------------------------------------------------
    # 8. track_usage
    # ------------------------------------------------------------------

    def track_usage(
        self,
        org_id: str,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        cost_cents: int,
        success: bool,
        endpoint: str = "",
        project_id: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Record an AI usage event.

        Inserts a row into ``ai_usage_log`` and increments the daily budget
        counters in ``ai_settings``.
        """
        conn = _get_connection()
        if conn:
            try:
                with conn.cursor() as cur:
                    # Insert usage log entry
                    cur.execute("""
                        INSERT INTO ai_usage_log
                            (org_id, project_id, provider, model, endpoint,
                             tokens_in, tokens_out, cost_cents, success, error_message)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        org_id, project_id, provider, model, endpoint,
                        tokens_in, tokens_out, cost_cents, success, error_message,
                    ))

                    # Increment daily counters on the org-level settings row
                    cur.execute("""
                        UPDATE ai_settings
                        SET requests_today = requests_today + 1,
                            cost_today_cents = cost_today_cents + %s,
                            updated_at = NOW()
                        WHERE org_id = %s
                          AND project_id IS NULL
                    """, (cost_cents, org_id))

                    conn.commit()
            except Exception as exc:
                try:
                    conn.rollback()
                except Exception:
                    pass
                logger.debug(f"[AISettings] DB usage tracking failed: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # In-memory tracking (always)
        entry = {
            "org_id": org_id,
            "project_id": project_id,
            "provider": provider,
            "model": model,
            "endpoint": endpoint,
            "tokens_in": tokens_in,
            "tokens_out": tokens_out,
            "cost_cents": cost_cents,
            "success": success,
            "error_message": error_message,
            "created_at": self._now_utc().isoformat(),
        }
        self._usage_log.append(entry)
        if len(self._usage_log) > self._max_memory_usage_entries:
            self._usage_log = self._usage_log[-self._max_memory_usage_entries:]

        # Update in-memory settings cache counters
        ck = self._cache_key(org_id)
        if ck in self._settings_cache:
            self._settings_cache[ck]["requests_today"] = self._settings_cache[ck].get("requests_today", 0) + 1
            self._settings_cache[ck]["cost_today_cents"] = self._settings_cache[ck].get("cost_today_cents", 0) + cost_cents

        logger.debug(
            f"[AISettings] Usage tracked: org={org_id} provider={provider} model={model} "
            f"tokens={tokens_in}+{tokens_out} cost={cost_cents}c success={success}"
        )

    # ------------------------------------------------------------------
    # 9. get_usage_stats
    # ------------------------------------------------------------------

    def get_usage_stats(self, org_id: str, days: int = 7) -> Dict[str, Any]:
        """
        Return aggregated AI usage statistics for the last *days* days.

        Returns::

            {
                "total_requests": int,
                "total_cost_cents": int,
                "total_tokens_in": int,
                "total_tokens_out": int,
                "success_count": int,
                "error_count": int,
                "by_provider": { "openai": { ... }, ... },
                "by_day": { "2026-02-24": { ... }, ... },
            }
        """
        cutoff = self._now_utc() - timedelta(days=days)
        cutoff_str = cutoff.isoformat()

        stats: Dict[str, Any] = {
            "total_requests": 0,
            "total_cost_cents": 0,
            "total_tokens_in": 0,
            "total_tokens_out": 0,
            "success_count": 0,
            "error_count": 0,
            "by_provider": {},
            "by_day": {},
        }

        # --- Try PostgreSQL first ---
        conn = _get_connection()
        if conn:
            try:
                from psycopg2.extras import RealDictCursor

                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Aggregate by provider
                    cur.execute("""
                        SELECT provider,
                               COUNT(*)            AS cnt,
                               COALESCE(SUM(cost_cents), 0)   AS total_cost,
                               COALESCE(SUM(tokens_in), 0)    AS total_in,
                               COALESCE(SUM(tokens_out), 0)   AS total_out,
                               SUM(CASE WHEN success THEN 1 ELSE 0 END) AS ok,
                               SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) AS err
                        FROM ai_usage_log
                        WHERE org_id = %s AND created_at >= %s
                        GROUP BY provider
                    """, (org_id, cutoff))

                    for row in cur.fetchall():
                        prov = row["provider"]
                        cnt = int(row["cnt"])
                        stats["total_requests"] += cnt
                        stats["total_cost_cents"] += int(row["total_cost"])
                        stats["total_tokens_in"] += int(row["total_in"])
                        stats["total_tokens_out"] += int(row["total_out"])
                        stats["success_count"] += int(row["ok"])
                        stats["error_count"] += int(row["err"])
                        stats["by_provider"][prov] = {
                            "requests": cnt,
                            "cost_cents": int(row["total_cost"]),
                            "tokens_in": int(row["total_in"]),
                            "tokens_out": int(row["total_out"]),
                        }

                    # Aggregate by day
                    cur.execute("""
                        SELECT DATE(created_at) AS day,
                               COUNT(*)         AS cnt,
                               COALESCE(SUM(cost_cents), 0) AS total_cost,
                               COALESCE(SUM(tokens_in), 0)  AS total_in,
                               COALESCE(SUM(tokens_out), 0) AS total_out
                        FROM ai_usage_log
                        WHERE org_id = %s AND created_at >= %s
                        GROUP BY DATE(created_at)
                        ORDER BY day
                    """, (org_id, cutoff))

                    for row in cur.fetchall():
                        day_str = str(row["day"])
                        stats["by_day"][day_str] = {
                            "requests": int(row["cnt"]),
                            "cost_cents": int(row["total_cost"]),
                            "tokens_in": int(row["total_in"]),
                            "tokens_out": int(row["total_out"]),
                        }

                return stats
            except Exception as exc:
                logger.debug(f"[AISettings] DB usage stats failed, falling back to memory: {exc}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass

        # --- In-memory fallback ---
        for entry in self._usage_log:
            if entry.get("org_id") != org_id:
                continue
            created = entry.get("created_at", "")
            if created < cutoff_str:
                continue

            stats["total_requests"] += 1
            stats["total_cost_cents"] += entry.get("cost_cents", 0)
            stats["total_tokens_in"] += entry.get("tokens_in", 0)
            stats["total_tokens_out"] += entry.get("tokens_out", 0)
            if entry.get("success"):
                stats["success_count"] += 1
            else:
                stats["error_count"] += 1

            prov = entry.get("provider", "unknown")
            if prov not in stats["by_provider"]:
                stats["by_provider"][prov] = {"requests": 0, "cost_cents": 0, "tokens_in": 0, "tokens_out": 0}
            stats["by_provider"][prov]["requests"] += 1
            stats["by_provider"][prov]["cost_cents"] += entry.get("cost_cents", 0)
            stats["by_provider"][prov]["tokens_in"] += entry.get("tokens_in", 0)
            stats["by_provider"][prov]["tokens_out"] += entry.get("tokens_out", 0)

            day_str = created[:10]  # "YYYY-MM-DD"
            if day_str not in stats["by_day"]:
                stats["by_day"][day_str] = {"requests": 0, "cost_cents": 0, "tokens_in": 0, "tokens_out": 0}
            stats["by_day"][day_str]["requests"] += 1
            stats["by_day"][day_str]["cost_cents"] += entry.get("cost_cents", 0)
            stats["by_day"][day_str]["tokens_in"] += entry.get("tokens_in", 0)
            stats["by_day"][day_str]["tokens_out"] += entry.get("tokens_out", 0)

        return stats

    # ------------------------------------------------------------------
    # 10. test_connection
    # ------------------------------------------------------------------

    def test_connection(
        self,
        provider: str,
        api_key: Optional[str] = None,
        org_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Test connectivity to an AI provider.

        If *api_key* is supplied it is used directly; otherwise the key is
        resolved via :meth:`resolve_api_key` for the given *org_id*.

        Returns::

            {
                "connected": bool,
                "provider": str,
                "model": str | None,
                "latency_ms": int,
                "error": str | None,
            }
        """
        import urllib.request
        import urllib.error

        provider = provider.lower().strip()
        key = api_key
        if not key and org_id:
            key = self.resolve_api_key(org_id, provider=provider)
        if not key:
            return {
                "connected": False,
                "provider": provider,
                "model": None,
                "latency_ms": 0,
                "error": "No API key available. Provide a key or configure one for the organisation.",
            }

        start = time.monotonic()

        try:
            if provider == "openai":
                return self._test_openai(key, start)
            elif provider == "anthropic":
                return self._test_anthropic(key, start)
            else:
                return {
                    "connected": False,
                    "provider": provider,
                    "model": None,
                    "latency_ms": 0,
                    "error": f"Unknown provider: {provider}",
                }
        except Exception as exc:
            latency = int((time.monotonic() - start) * 1000)
            return {
                "connected": False,
                "provider": provider,
                "model": None,
                "latency_ms": latency,
                "error": str(exc),
            }

    @staticmethod
    def _test_openai(api_key: str, start: float) -> Dict[str, Any]:
        """Verify OpenAI connectivity by listing models."""
        import urllib.request
        import urllib.error

        req = urllib.request.Request(
            "https://api.openai.com/v1/models",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                latency = int((time.monotonic() - start) * 1000)
                body = json.loads(resp.read().decode())
                # Find gpt-4o-mini in the model list to confirm access
                model_ids = [m.get("id", "") for m in body.get("data", [])]
                detected_model = "gpt-4o-mini" if "gpt-4o-mini" in model_ids else (model_ids[0] if model_ids else None)
                return {
                    "connected": True,
                    "provider": "openai",
                    "model": detected_model,
                    "latency_ms": latency,
                    "error": None,
                }
        except urllib.error.HTTPError as exc:
            latency = int((time.monotonic() - start) * 1000)
            error_body = ""
            try:
                error_body = exc.read().decode()[:500]
            except Exception:
                pass
            return {
                "connected": False,
                "provider": "openai",
                "model": None,
                "latency_ms": latency,
                "error": f"HTTP {exc.code}: {error_body}" if error_body else f"HTTP {exc.code}",
            }

    @staticmethod
    def _test_anthropic(api_key: str, start: float) -> Dict[str, Any]:
        """Verify Anthropic connectivity by sending a minimal messages request."""
        import urllib.request
        import urllib.error

        payload = json.dumps({
            "model": "claude-3-haiku-20240307",
            "max_tokens": 1,
            "messages": [{"role": "user", "content": "ping"}],
        }).encode()

        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=payload,
            headers={
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                latency = int((time.monotonic() - start) * 1000)
                body = json.loads(resp.read().decode())
                return {
                    "connected": True,
                    "provider": "anthropic",
                    "model": body.get("model", "claude-3-haiku-20240307"),
                    "latency_ms": latency,
                    "error": None,
                }
        except urllib.error.HTTPError as exc:
            latency = int((time.monotonic() - start) * 1000)
            error_body = ""
            try:
                error_body = exc.read().decode()[:500]
            except Exception:
                pass
            # 401 means bad key, but the endpoint is reachable
            return {
                "connected": False,
                "provider": "anthropic",
                "model": None,
                "latency_ms": latency,
                "error": f"HTTP {exc.code}: {error_body}" if error_body else f"HTTP {exc.code}",
            }


# ---------------------------------------------------------------------------
# Singleton accessor
# ---------------------------------------------------------------------------

_instance: Optional[AISettingsService] = None


def get_ai_settings_service() -> AISettingsService:
    """Return the global ``AISettingsService`` singleton."""
    global _instance
    if _instance is None:
        _instance = AISettingsService()
    return _instance
