"""
Advanced Pattern Recognizer - Layer 3
ML-based UI pattern recognition and business rule inference.
"""

import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
import re

logger = logging.getLogger(__name__)


class AdvancedPatternRecognizer:
    """
    Advanced pattern recognition using ML and rule-based approaches.
    
    Layer 3 Components:
    1. ML-based UI pattern detection
    2. Business rule inference
    3. Workflow graph enhancement
    """
    
    def __init__(self):
        # Known UI patterns with signatures
        self.ui_patterns = {
            "login": {
                "signature": ["username", "password", "submit"],
                "keywords": ["login", "sign in", "authenticate"],
                "min_fields": 2
            },
            "registration": {
                "signature": ["email", "password", "confirm_password", "submit"],
                "keywords": ["register", "sign up", "create account"],
                "min_fields": 3
            },
            "checkout": {
                "signature": ["shipping", "payment", "billing", "submit"],
                "keywords": ["checkout", "purchase", "buy", "order"],
                "min_fields": 3
            },
            "search": {
                "signature": ["search_input", "search_button"],
                "keywords": ["search", "find", "query"],
                "min_fields": 1
            },
            "contact_form": {
                "signature": ["name", "email", "message", "submit"],
                "keywords": ["contact", "message", "inquiry"],
                "min_fields": 3
            },
            "password_reset": {
                "signature": ["email", "submit"],
                "keywords": ["reset", "forgot", "recover"],
                "min_fields": 1
            }
        }
    
    def recognize_ui_pattern(
        self,
        form_fields: List[Dict[str, Any]],
        page_title: Optional[str] = None,
        url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Recognize UI pattern from form structure.
        
        Returns:
        {
            "pattern": str,
            "confidence": float,
            "matched_signature": [str],
            "business_rules": [Dict]
        }
        """
        field_names = [f.get("name") or f.get("id") or "" for f in form_fields]
        field_names_lower = [name.lower() for name in field_names]
        
        best_match = None
        best_score = 0.0
        matched_signature = []
        
        # Check against known patterns
        for pattern_name, pattern_info in self.ui_patterns.items():
            signature = pattern_info["signature"]
            keywords = pattern_info["keywords"]
            min_fields = pattern_info["min_fields"]
            
            # Score based on signature match
            signature_matches = sum(1 for sig in signature if any(sig in name for name in field_names_lower))
            signature_score = signature_matches / len(signature) if signature else 0
            
            # Score based on keywords (in page title or URL)
            keyword_score = 0.0
            context_text = f"{page_title or ''} {url or ''}".lower()
            for keyword in keywords:
                if keyword in context_text:
                    keyword_score += 1.0 / len(keywords)
            
            # Combined score
            score = (signature_score * 0.7) + (keyword_score * 0.3)
            
            if score > best_score and len(field_names) >= min_fields:
                best_score = score
                best_match = pattern_name
                matched_signature = [sig for sig in signature if any(sig in name for name in field_names_lower)]
        
        # Infer business rules based on pattern
        business_rules = []
        if best_match:
            business_rules = self._infer_business_rules(best_match, form_fields)
        
        return {
            "pattern": best_match or "unknown",
            "confidence": best_score,
            "matched_signature": matched_signature,
            "business_rules": business_rules
        }
    
    def infer_business_rules(
        self,
        pattern: str,
        form_fields: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """
        Infer business rules based on recognized pattern.
        
        Returns:
        [{
            "rule_type": str,
            "field": str,
            "condition": str,
            "description": str
        }]
        """
        rules = []
        
        if pattern == "login":
            # Login rules
            username_field = next((f for f in form_fields if "user" in (f.get("name") or "").lower()), None)
            password_field = next((f for f in form_fields if "pass" in (f.get("name") or "").lower()), None)
            
            if username_field:
                rules.append({
                    "rule_type": "required",
                    "field": username_field.get("name"),
                    "condition": "Username is required",
                    "description": "User must provide username"
                })
            if password_field:
                rules.append({
                    "rule_type": "required",
                    "field": password_field.get("name"),
                    "condition": "Password is required",
                    "description": "User must provide password"
                })
                rules.append({
                    "rule_type": "security",
                    "field": password_field.get("name"),
                    "condition": "Password should be masked",
                    "description": "Password field must use type='password'"
                })
        
        elif pattern == "registration":
            # Registration rules
            email_field = next((f for f in form_fields if "email" in (f.get("name") or "").lower()), None)
            password_field = next((f for f in form_fields if "pass" in (f.get("name") or "").lower()), None)
            confirm_field = next((f for f in form_fields if "confirm" in (f.get("name") or "").lower()), None)
            
            if email_field:
                rules.append({
                    "rule_type": "format",
                    "field": email_field.get("name"),
                    "condition": "Email format validation",
                    "description": "Email must be valid format"
                })
            if password_field and confirm_field:
                rules.append({
                    "rule_type": "dependency",
                    "field": confirm_field.get("name"),
                    "condition": f"Must match {password_field.get('name')}",
                    "description": "Password confirmation must match password"
                })
        
        elif pattern == "checkout":
            # Checkout rules
            rules.append({
                "rule_type": "workflow",
                "field": "all",
                "condition": "All fields required before submission",
                "description": "Checkout requires complete information"
            })
        
        return rules
    
    def enhance_workflow_graph(
        self,
        action_graph: Any,  # ActionGraph
        recognized_patterns: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Enhance workflow graph with recognized patterns.
        
        Returns:
        {
            "enhanced_nodes": [Dict],
            "enhanced_edges": [Dict],
            "workflow_stages": [Dict]
        }
        """
        enhanced_nodes = []
        enhanced_edges = []
        workflow_stages = []
        
        # Group nodes by recognized patterns
        pattern_groups = defaultdict(list)
        for pattern_info in recognized_patterns:
            pattern_name = pattern_info.get("pattern")
            if pattern_name:
                pattern_groups[pattern_name].append(pattern_info)
        
        # Create workflow stages
        for pattern_name, pattern_infos in pattern_groups.items():
            stage = {
                "stage_name": pattern_name,
                "patterns": pattern_infos,
                "nodes": [],
                "edges": []
            }
            workflow_stages.append(stage)
        
        return {
            "enhanced_nodes": enhanced_nodes,
            "enhanced_edges": enhanced_edges,
            "workflow_stages": workflow_stages
        }


