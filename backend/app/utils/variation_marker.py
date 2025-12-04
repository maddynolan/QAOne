"""
Variation Marker Utility
Encodes and decodes variation information for passing between services
"""

import logging
from typing import Dict, Any, List, Optional
from app.schemas.requirement_schemas import ScenarioSkeleton

logger = logging.getLogger(__name__)


class VariationMarker:
    """
    Utility for encoding and decoding variation information.
    Standardizes how variations are passed between services.
    """
    
    # Variation marker prefixes
    PREFIX_QUARTERLY = "VARIATION:QUARTERLY_FREQUENCY"
    PREFIX_YEARLY = "VARIATION:YEARLY_FREQUENCY"
    PREFIX_SPECIFIC_END_DATE = "VARIATION:SPECIFIC_END_DATE"
    PREFIX_NEW_PAYEE = "VARIATION:NEW_PAYEE"
    PREFIX_TITLE = "TITLE:"
    
    @staticmethod
    def encode_variations(skeleton: ScenarioSkeleton) -> str:
        """
        Encode variation information from a scenario skeleton into high_level_intent format.
        
        Args:
            skeleton: Scenario skeleton with variation information
            
        Returns:
            Encoded high_level_intent string with variation markers
        """
        parts = [skeleton.kind]
        
        # Extract variation keywords from title
        title_lower = skeleton.title.lower()
        
        if "quarterly" in title_lower:
            parts.append(f"{VariationMarker.PREFIX_QUARTERLY} (NOT Monthly or Yearly)")
        elif "yearly" in title_lower:
            parts.append(f"{VariationMarker.PREFIX_YEARLY} (NOT Monthly or Quarterly)")
        
        if "specific end date" in title_lower or ("end date" in title_lower and "until cancelled" not in title_lower and "specific" in title_lower):
            parts.append(f"{VariationMarker.PREFIX_SPECIFIC_END_DATE} (NOT until cancelled)")
        
        if "new payee" in title_lower or "add new" in title_lower:
            parts.append(f"{VariationMarker.PREFIX_NEW_PAYEE} (NOT saved payee)")
        
        # Include the full title for LLM context
        if skeleton.title:
            parts.append(f"{VariationMarker.PREFIX_TITLE}{skeleton.title}")
        
        return " | ".join(parts)
    
    @staticmethod
    def decode_variations(high_level_intent: str) -> Dict[str, Any]:
        """
        Decode variation information from high_level_intent string.
        
        Args:
            high_level_intent: Encoded high_level_intent string
            
        Returns:
            Dictionary with variation information
        """
        result = {
            "has_quarterly": False,
            "has_yearly": False,
            "has_specific_end_date": False,
            "has_new_payee": False,
            "skeleton_title": ""
        }
        
        intent_lower = high_level_intent.lower()
        
        # Check for explicit variation markers
        if VariationMarker.PREFIX_QUARTERLY.lower() in intent_lower:
            result["has_quarterly"] = True
        if VariationMarker.PREFIX_YEARLY.lower() in intent_lower:
            result["has_yearly"] = True
        if VariationMarker.PREFIX_SPECIFIC_END_DATE.lower() in intent_lower:
            result["has_specific_end_date"] = True
        if VariationMarker.PREFIX_NEW_PAYEE.lower() in intent_lower:
            result["has_new_payee"] = True
        
        # Extract skeleton title if present
        if VariationMarker.PREFIX_TITLE in high_level_intent:
            title_part = high_level_intent.split(VariationMarker.PREFIX_TITLE)[-1].strip()
            result["skeleton_title"] = title_part.split(" | ")[0] if " | " in title_part else title_part
        
        return result
    
    @staticmethod
    def extract_variation_hints(high_level_intent: str) -> List[str]:
        """
        Extract variation hints from high_level_intent for LLM prompt.
        
        Args:
            high_level_intent: Encoded high_level_intent string
            
        Returns:
            List of variation hint strings for LLM
        """
        hints = []
        variations = VariationMarker.decode_variations(high_level_intent)
        
        if variations["has_quarterly"]:
            hints.append("⚠️ CRITICAL: This test case MUST use QUARTERLY frequency (NOT Monthly or Yearly). Title must say 'QUARTERLY'.")
        
        if variations["has_yearly"]:
            hints.append("⚠️ CRITICAL: This test case MUST use YEARLY frequency (NOT Monthly or Quarterly). Title must say 'YEARLY'.")
        
        if variations["has_specific_end_date"]:
            hints.append("⚠️ CRITICAL: This test case MUST use a SPECIFIC END DATE (NOT 'until cancelled'). Title must say 'specific end date'.")
        
        if variations["has_new_payee"]:
            hints.append("⚠️ CRITICAL: This test case MUST involve ADDING A NEW PAYEE (NOT selecting a saved one). Title must say 'new payee'.")
        
        return hints




