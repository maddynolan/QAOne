"""
Flowstral Snapshot Deduplication Service
Deduplicates DOM snapshots using content hashing and compression
"""

import logging
import hashlib
import gzip
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
from dataclasses import dataclass
from uuid import uuid4
import re

# Optional brotli import - fallback to gzip if not available
try:
    import brotli
    BROTLI_AVAILABLE = True
except ImportError:
    BROTLI_AVAILABLE = False

logger = logging.getLogger(__name__)

if not BROTLI_AVAILABLE:
    logger.warning("brotli module not found. Install with: pip install brotli. Falling back to gzip compression.")


@dataclass
class SnapshotReference:
    """Reference to a deduplicated snapshot"""
    snapshot_id: str
    content_hash: str
    is_reference: bool
    original_size: int
    compressed_size: int
    compression_ratio: float
    diff_metadata: Optional[Dict[str, Any]] = None


class SnapshotDeduplicator:
    """
    Deduplicates DOM snapshots using content hashing
    
    Features:
    - Content hash generation (SHA256)
    - Compression (Brotli/Gzip)
    - Reference-based storage
    - Delta storage for SPAs
    """
    
    def __init__(
        self,
        compression_algorithm: str = "brotli",  # brotli, gzip, none
        enable_delta_storage: bool = True
    ):
        # Fallback to gzip if brotli is requested but not available
        if compression_algorithm == "brotli" and not BROTLI_AVAILABLE:
            logger.warning("Brotli compression requested but module not available. Using gzip instead.")
            compression_algorithm = "gzip"
        
        self.compression_algorithm = compression_algorithm
        self.enable_delta_storage = enable_delta_storage
        self.hash_cache: Dict[str, str] = {}  # hash -> snapshot_id
    
    def generate_content_hash(self, html: str) -> str:
        """
        Generate content hash for HTML
        
        Normalizes HTML before hashing:
        - Removes whitespace
        - Normalizes attributes
        - Removes dynamic IDs/classes
        """
        normalized = self._normalize_html(html)
        return hashlib.sha256(normalized.encode('utf-8')).hexdigest()
    
    def _normalize_html(self, html: str) -> str:
        """Normalize HTML for consistent hashing"""
        # Remove extra whitespace
        html = re.sub(r'\s+', ' ', html)
        
        # Remove dynamic IDs (e.g., react-*, vue-*)
        html = re.sub(r'id="(?:react|vue|angular|ember)-[^"]*"', '', html)
        
        # Remove dynamic classes (e.g., css-xyz123)
        html = re.sub(r'class="css-[a-z0-9]+"', '', html)
        
        # Normalize attribute order (sort attributes)
        # This is a simplified version - full implementation would parse HTML
        html = re.sub(r'<(\w+)([^>]*)>', self._normalize_attributes, html)
        
        return html.strip()
    
    def _normalize_attributes(self, match) -> str:
        """Normalize attributes in tag"""
        tag_name = match.group(1)
        attrs = match.group(2)
        
        # Extract and sort attributes
        attr_pattern = r'(\w+)="([^"]*)"'
        attrs_dict = {}
        for attr_match in re.finditer(attr_pattern, attrs):
            key = attr_match.group(1)
            value = attr_match.group(2)
            # Skip dynamic attributes
            if key in ['id', 'class'] and any(p in value.lower() for p in ['react', 'vue', 'angular', 'generated']):
                continue
            attrs_dict[key] = value
        
        # Build normalized tag
        sorted_attrs = ' '.join(f'{k}="{v}"' for k, v in sorted(attrs_dict.items()))
        return f'<{tag_name} {sorted_attrs}>' if sorted_attrs else f'<{tag_name}>'
    
    def compress(self, html: str) -> bytes:
        """Compress HTML using configured algorithm"""
        html_bytes = html.encode('utf-8')
        
        if self.compression_algorithm == "brotli":
            if BROTLI_AVAILABLE:
                return brotli.compress(html_bytes, quality=6)  # Balance speed vs size
            else:
                logger.warning("Brotli requested but not available. Falling back to gzip.")
                return gzip.compress(html_bytes, compresslevel=6)
        elif self.compression_algorithm == "gzip":
            return gzip.compress(html_bytes, compresslevel=6)
        else:
            return html_bytes
    
    def decompress(self, compressed: bytes) -> str:
        """Decompress HTML"""
        if self.compression_algorithm == "brotli":
            if BROTLI_AVAILABLE:
                return brotli.decompress(compressed).decode('utf-8')
            else:
                logger.warning("Brotli decompression requested but not available. Attempting gzip.")
                try:
                    return gzip.decompress(compressed).decode('utf-8')
                except:
                    return compressed.decode('utf-8')
        elif self.compression_algorithm == "gzip":
            return gzip.decompress(compressed).decode('utf-8')
        else:
            return compressed.decode('utf-8')
    
    async def process_snapshot(
        self,
        html: str,
        previous_html: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> SnapshotReference:
        """
        Process snapshot with deduplication
        
        Args:
            html: Current HTML
            previous_html: Previous HTML (for delta storage)
            metadata: Additional metadata
            
        Returns:
            SnapshotReference with deduplication info
        """
        content_hash = self.generate_content_hash(html)
        original_size = len(html.encode('utf-8'))
        
        # Check cache
        if content_hash in self.hash_cache:
            snapshot_id = self.hash_cache[content_hash]
            return SnapshotReference(
                snapshot_id=snapshot_id,
                content_hash=content_hash,
                is_reference=True,
                original_size=original_size,
                compressed_size=0,  # Not needed for references
                compression_ratio=0.0
            )
        
        # Try delta storage if enabled and previous HTML exists
        if self.enable_delta_storage and previous_html:
            delta = self._calculate_delta(previous_html, html)
            if delta and delta['size'] < original_size * 0.5:  # Delta is smaller
                # Store delta instead of full HTML
                compressed_delta = self.compress(delta['html'])
                return SnapshotReference(
                    snapshot_id=str(uuid4()),
                    content_hash=content_hash,
                    is_reference=False,
                    original_size=original_size,
                    compressed_size=len(compressed_delta),
                    compression_ratio=len(compressed_delta) / original_size if original_size > 0 else 0.0,
                    diff_metadata={
                        "is_delta": True,
                        "base_hash": self.generate_content_hash(previous_html),
                        "delta_size": delta['size']
                    }
                )
        
        # Compress full HTML
        compressed = self.compress(html)
        compressed_size = len(compressed)
        compression_ratio = compressed_size / original_size if original_size > 0 else 0.0
        
        return SnapshotReference(
            snapshot_id=str(uuid4()),
            content_hash=content_hash,
            is_reference=False,
            original_size=original_size,
            compressed_size=compressed_size,
            compression_ratio=compression_ratio
        )
    
    def _calculate_delta(self, old_html: str, new_html: str) -> Optional[Dict[str, Any]]:
        """
        Calculate delta between two HTML snapshots
        
        Simplified implementation - in production, use proper diff algorithm
        """
        # For now, return None to use full storage
        # In production, implement proper HTML diff algorithm
        # (e.g., using difflib or specialized HTML diff library)
        return None
    
    def get_storage_stats(self) -> Dict[str, Any]:
        """Get deduplication statistics"""
        return {
            "cached_hashes": len(self.hash_cache),
            "compression_algorithm": self.compression_algorithm,
            "delta_storage_enabled": self.enable_delta_storage
        }


# Global instance
_snapshot_deduplicator: Optional[SnapshotDeduplicator] = None


def get_snapshot_deduplicator(
    compression_algorithm: str = "brotli",
    enable_delta_storage: bool = True
) -> SnapshotDeduplicator:
    """Get global snapshot deduplicator instance"""
    global _snapshot_deduplicator
    if _snapshot_deduplicator is None:
        _snapshot_deduplicator = SnapshotDeduplicator(
            compression_algorithm=compression_algorithm,
            enable_delta_storage=enable_delta_storage
        )
    return _snapshot_deduplicator

