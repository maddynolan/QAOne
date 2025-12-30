"""
SELF-HEALING CONTROLLER
=======================
Learns from failures and successes to improve element finding over time.
This is what makes enterprise tools "AI-powered".
"""

import json
import hashlib
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from datetime import datetime
from pathlib import Path


@dataclass
class ElementRecord:
    """Record of a successfully found element."""
    intent_hash: str  # Hash of the intent
    intent_description: str
    successful_strategy: str  # What worked: "semantic", "scored", "fallback"
    successful_selector: str  # The selector that worked
    attributes_snapshot: Dict[str, str]  # Element attributes at time of success
    context: Dict[str, str]  # Page URL, app type, etc.
    success_count: int = 1
    last_success: str = ""
    alternatives: List[str] = None  # Other selectors that also worked
    
    def __post_init__(self):
        if self.alternatives is None:
            self.alternatives = []
        if not self.last_success:
            self.last_success = datetime.now().isoformat()


class SelfHealingController:
    """
    Learns from element finding successes and failures.
    
    Features:
    - Records successful element finds
    - Suggests alternatives when primary selector fails
    - Adapts to UI changes over time
    - Provides healing suggestions
    """
    
    def __init__(self, storage_path: Optional[str] = None):
        """
        Initialize self-healing controller.
        
        Args:
            storage_path: Path to store learning data (JSON file)
        """
        self.storage_path = storage_path or "flowstral_healing_data.json"
        self.records: Dict[str, ElementRecord] = {}
        self._load_records()
    
    def _load_records(self):
        """Load existing records from storage."""
        try:
            path = Path(self.storage_path)
            if path.exists():
                with open(path, 'r') as f:
                    data = json.load(f)
                    for intent_hash, record_data in data.items():
                        self.records[intent_hash] = ElementRecord(**record_data)
        except:
            self.records = {}
    
    def _save_records(self):
        """Save records to storage."""
        try:
            with open(self.storage_path, 'w') as f:
                data = {k: asdict(v) for k, v in self.records.items()}
                json.dump(data, f, indent=2)
        except:
            pass
    
    def _hash_intent(self, intent_dict: Dict) -> str:
        """Create a hash for an intent to use as key."""
        # Include only stable fields in hash
        stable_fields = ['description', 'text', 'label', 'role', 'component_type']
        hash_data = {k: v for k, v in intent_dict.items() if k in stable_fields and v}
        hash_str = json.dumps(hash_data, sort_keys=True)
        return hashlib.md5(hash_str.encode()).hexdigest()[:12]
    
    def record_success(
        self,
        intent_dict: Dict,
        strategy: str,
        selector: str,
        attributes: Dict[str, str],
        context: Dict[str, str]
    ):
        """
        Record a successful element find.
        
        Args:
            intent_dict: The intent that was searched
            strategy: What worked ("semantic", "scored", "fallback")
            selector: The selector that found the element
            attributes: Element attributes at time of success
            context: Page context (URL, app type)
        """
        intent_hash = self._hash_intent(intent_dict)
        
        if intent_hash in self.records:
            # Update existing record
            record = self.records[intent_hash]
            record.success_count += 1
            record.last_success = datetime.now().isoformat()
            
            # Track alternative selectors
            if selector != record.successful_selector:
                if selector not in record.alternatives:
                    record.alternatives.append(selector)
        else:
            # Create new record
            self.records[intent_hash] = ElementRecord(
                intent_hash=intent_hash,
                intent_description=intent_dict.get('description', 'Unknown'),
                successful_strategy=strategy,
                successful_selector=selector,
                attributes_snapshot=attributes,
                context=context
            )
        
        self._save_records()
    
    def record_failure(
        self,
        intent_dict: Dict,
        failed_selectors: List[str],
        context: Dict[str, str]
    ):
        """
        Record a failed element find attempt.
        
        Args:
            intent_dict: The intent that failed
            failed_selectors: Selectors that were tried and failed
            context: Page context
        """
        # For now, just log failures
        # Future: Use this to improve strategies
        intent_hash = self._hash_intent(intent_dict)
        
        # If we have a previous success for this intent, the UI probably changed
        if intent_hash in self.records:
            record = self.records[intent_hash]
            # Mark as potentially stale
            # Future: Trigger re-learning
    
    def get_healing_suggestions(self, intent_dict: Dict) -> List[str]:
        """
        Get suggested selectors based on past successes.
        
        Args:
            intent_dict: The intent to find
            
        Returns:
            List of selector suggestions in order of confidence
        """
        intent_hash = self._hash_intent(intent_dict)
        suggestions = []
        
        if intent_hash in self.records:
            record = self.records[intent_hash]
            suggestions.append(record.successful_selector)
            suggestions.extend(record.alternatives)
        
        # Also find similar intents
        for hash_key, record in self.records.items():
            if hash_key == intent_hash:
                continue
            
            # Check if descriptions are similar
            if self._similar_description(
                intent_dict.get('description', ''),
                record.intent_description
            ):
                if record.successful_selector not in suggestions:
                    suggestions.append(record.successful_selector)
        
        return suggestions[:5]  # Return top 5
    
    def _similar_description(self, desc1: str, desc2: str) -> bool:
        """Check if two descriptions are similar."""
        if not desc1 or not desc2:
            return False
        
        words1 = set(desc1.lower().split())
        words2 = set(desc2.lower().split())
        
        if not words1 or not words2:
            return False
        
        overlap = len(words1 & words2) / min(len(words1), len(words2))
        return overlap > 0.5
    
    def get_stats(self) -> Dict[str, Any]:
        """Get statistics about learned elements."""
        total = len(self.records)
        
        if total == 0:
            return {"total_elements": 0}
        
        strategies = {}
        for record in self.records.values():
            strategy = record.successful_strategy
            strategies[strategy] = strategies.get(strategy, 0) + 1
        
        return {
            "total_elements": total,
            "strategies_breakdown": strategies,
            "most_used_elements": sorted(
                [(r.intent_description, r.success_count) for r in self.records.values()],
                key=lambda x: x[1],
                reverse=True
            )[:10]
        }
    
    def export_knowledge(self) -> Dict:
        """Export all learned knowledge for backup/transfer."""
        return {k: asdict(v) for k, v in self.records.items()}
    
    def import_knowledge(self, data: Dict):
        """Import knowledge from another instance."""
        for intent_hash, record_data in data.items():
            if intent_hash not in self.records:
                self.records[intent_hash] = ElementRecord(**record_data)
        self._save_records()

