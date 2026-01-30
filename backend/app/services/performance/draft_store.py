"""
Draft Store - Backend persistence for load-test drafts (replaces sessionStorage handoff).

Drafts are shareable, durable across reloads, and auditable.
Optional TTL for automatic cleanup.
"""

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# Default TTL seconds (24 hours). Set to 0 for no expiry.
DEFAULT_DRAFT_TTL_SECONDS = 24 * 3600


@dataclass
class DraftRecord:
    """A load-test draft (captured requests + metadata)."""
    draft_id: str
    requests: List[Dict[str, Any]]
    name: str
    source: str  # "recorder" | "api" | "manual"
    created_at: float
    created_by: Optional[str] = None
    ttl_seconds: int = 0
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_expired(self) -> bool:
        if self.ttl_seconds <= 0:
            return False
        return (time.time() - self.created_at) > self.ttl_seconds

    def to_dict(self) -> Dict[str, Any]:
        return {
            "draft_id": self.draft_id,
            "requests": self.requests,
            "name": self.name,
            "source": self.source,
            "created_at": self.created_at,
            "created_by": self.created_by,
            "ttl_seconds": self.ttl_seconds,
            "metadata": self.metadata,
            "request_count": len(self.requests),
        }


class DraftStore:
    """In-memory store for load-test drafts. Optional file persistence can be added later."""

    def __init__(self):
        self._drafts: Dict[str, DraftRecord] = {}

    def create(
        self,
        requests: List[Dict[str, Any]],
        name: str = "From Recorder",
        source: str = "recorder",
        created_by: Optional[str] = None,
        ttl_seconds: int = DEFAULT_DRAFT_TTL_SECONDS,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> DraftRecord:
        draft_id = str(uuid.uuid4())[:8]
        draft = DraftRecord(
            draft_id=draft_id,
            requests=requests,
            name=name,
            source=source,
            created_at=time.time(),
            created_by=created_by,
            ttl_seconds=ttl_seconds,
            metadata=metadata or {},
        )
        self._drafts[draft_id] = draft
        logger.info(f"[DraftStore] Created draft {draft_id} with {len(requests)} requests")
        return draft

    def get(self, draft_id: str) -> Optional[DraftRecord]:
        draft = self._drafts.get(draft_id)
        if not draft:
            return None
        if draft.is_expired():
            del self._drafts[draft_id]
            return None
        return draft

    def list_drafts(self, limit: int = 50) -> List[DraftRecord]:
        now = time.time()
        valid = []
        expired_ids = []
        for d in self._drafts.values():
            if d.is_expired():
                expired_ids.append(d.draft_id)
            else:
                valid.append(d)
        for eid in expired_ids:
            del self._drafts[eid]
        valid.sort(key=lambda d: d.created_at, reverse=True)
        return valid[:limit]

    def delete(self, draft_id: str) -> bool:
        if draft_id in self._drafts:
            del self._drafts[draft_id]
            return True
        return False


_draft_store: Optional[DraftStore] = None


def get_draft_store() -> DraftStore:
    global _draft_store
    if _draft_store is None:
        _draft_store = DraftStore()
    return _draft_store
