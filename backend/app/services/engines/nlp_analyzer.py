"""
NLP Analyzer - Layer 3
Uses NLP for label/text semantic analysis to understand field types and meanings.
"""

import logging
import re
from typing import Dict, List, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)

# Try to import spaCy (optional)
try:
    import spacy
    nlp_model = spacy.load("en_core_web_sm")
    HAS_SPACY = True
except (ImportError, OSError):
    HAS_SPACY = False
    nlp_model = None


class NLPAnalyzer:
    """
    Uses NLP for semantic analysis of labels and text.
    
    Layer 3 Components:
    1. NLP on labels/text analysis
    2. Semantic understanding
    3. Field type inference from labels
    """
    
    def __init__(self):
        # Field type keywords
        self.field_type_patterns = {
            "email": ["email", "e-mail", "mail", "correo"],
            "password": ["password", "pass", "pwd", "secret", "key"],
            "username": ["username", "user", "login", "account", "userid"],
            "phone": ["phone", "telephone", "tel", "mobile", "cell"],
            "date": ["date", "birthday", "dob", "birth"],
            "url": ["url", "website", "web", "link", "uri"],
            "number": ["number", "count", "quantity", "amount", "price", "cost"],
            "zip": ["zip", "postal", "postcode", "code"],
            "address": ["address", "street", "location"],
            "name": ["name", "firstname", "lastname", "fullname"],
            "credit_card": ["card", "credit", "payment", "cvv", "cvc"],
            "ssn": ["ssn", "social", "security"]
        }
    
    def analyze_label_semantics(self, label_text: str) -> Dict[str, Any]:
        """
        Analyze label text to extract semantic meaning.
        
        Returns:
        {
            "field_type": str,
            "confidence": float,
            "keywords": [str],
            "semantic_meaning": str,
            "validation_hints": [str]
        }
        """
        if not label_text:
            return {"field_type": "text", "confidence": 0.0}
        
        label_lower = label_text.lower()
        
        # Find matching field type
        best_match = None
        best_score = 0.0
        matched_keywords = []
        
        for field_type, keywords in self.field_type_patterns.items():
            score = 0.0
            matched = []
            for keyword in keywords:
                if keyword in label_lower:
                    score += 1.0
                    matched.append(keyword)
            
            if score > best_score:
                best_score = score
                best_match = field_type
                matched_keywords = matched
        
        # Use spaCy if available for deeper analysis
        semantic_meaning = label_text
        if HAS_SPACY and nlp_model:
            doc = nlp_model(label_text)
            # Extract entities
            entities = [ent.text for ent in doc.ents]
            # Extract key phrases
            key_phrases = [chunk.text for chunk in doc.noun_chunks]
            semantic_meaning = " ".join(key_phrases[:3]) if key_phrases else label_text
        else:
            # Fallback: extract key words
            words = re.findall(r'\b\w+\b', label_lower)
            semantic_meaning = " ".join(words[:5])
        
        # Infer validation hints
        validation_hints = self._infer_validation_hints(label_text, best_match)
        
        confidence = min(best_score / 3.0, 1.0) if best_match else 0.0
        
        return {
            "field_type": best_match or "text",
            "confidence": confidence,
            "keywords": matched_keywords,
            "semantic_meaning": semantic_meaning,
            "validation_hints": validation_hints
        }
    
    def extract_business_rules(self, text_content: List[str]) -> List[Dict[str, Any]]:
        """
        Extract business rules from text content (labels, descriptions, etc.).
        
        Returns:
        [{
            "rule_type": str,  # "required", "format", "range", "dependency"
            "field": str,
            "condition": str,
            "description": str
        }]
        """
        rules = []
        
        combined_text = " ".join(text_content).lower()
        
        # Pattern 1: Required fields
        required_patterns = [
            r'required',
            r'must\s+be\s+filled',
            r'cannot\s+be\s+empty',
            r'mandatory'
        ]
        for pattern in required_patterns:
            if re.search(pattern, combined_text, re.IGNORECASE):
                rules.append({
                    "rule_type": "required",
                    "field": "unknown",
                    "condition": "field must have value",
                    "description": "Field is required"
                })
                break
        
        # Pattern 2: Format requirements
        format_patterns = [
            (r'email\s+format', 'email'),
            (r'phone\s+format', 'phone'),
            (r'date\s+format', 'date'),
            (r'(\d+)\s*characters?', 'length')
        ]
        for pattern, format_type in format_patterns:
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                rules.append({
                    "rule_type": "format",
                    "field": "unknown",
                    "condition": f"Must match {format_type} format",
                    "description": match.group(0)
                })
        
        # Pattern 3: Range requirements
        range_patterns = [
            (r'between\s+(\d+)\s+and\s+(\d+)', 'range'),
            (r'minimum\s+(\d+)', 'min'),
            (r'maximum\s+(\d+)', 'max')
        ]
        for pattern, range_type in range_patterns:
            match = re.search(pattern, combined_text, re.IGNORECASE)
            if match:
                rules.append({
                    "rule_type": range_type,
                    "field": "unknown",
                    "condition": match.group(0),
                    "description": f"Value must be {match.group(0)}"
                })
        
        return rules
    
    def _infer_validation_hints(self, label_text: str, field_type: Optional[str]) -> List[str]:
        """Infer validation hints from label and field type."""
        hints = []
        
        if field_type == "email":
            hints.append("Must contain @ and domain")
            hints.append("Format: user@domain.com")
        elif field_type == "password":
            hints.append("Minimum 8 characters")
            hints.append("May require uppercase, lowercase, numbers, special chars")
        elif field_type == "phone":
            hints.append("Format: (XXX) XXX-XXXX or similar")
        elif field_type == "date":
            hints.append("Format: MM/DD/YYYY or YYYY-MM-DD")
        elif field_type == "url":
            hints.append("Must start with http:// or https://")
        elif field_type == "zip":
            hints.append("5 digits (US) or format varies by country")
        elif field_type == "credit_card":
            hints.append("13-19 digits")
            hints.append("Luhn algorithm validation")
        
        # Check label for specific hints
        label_lower = label_text.lower()
        if "minimum" in label_lower or "min" in label_lower:
            min_match = re.search(r'min(?:imum)?\s*:?\s*(\d+)', label_lower)
            if min_match:
                hints.append(f"Minimum length: {min_match.group(1)}")
        
        if "maximum" in label_lower or "max" in label_lower:
            max_match = re.search(r'max(?:imum)?\s*:?\s*(\d+)', label_lower)
            if max_match:
                hints.append(f"Maximum length: {max_match.group(1)}")
        
        return hints


