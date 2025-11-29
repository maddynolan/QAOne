"""
Field Type Classifier - Layer 4
Trains classification models to predict field types and validation rules.
"""

import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
import re

logger = logging.getLogger(__name__)

# Try to import scikit-learn (optional)
try:
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.feature_extraction import DictVectorizer
    from sklearn.model_selection import train_test_split
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class FieldTypeClassifier:
    """
    Classifies field types and predicts validation rules.
    
    Layer 4 Components:
    1. Train classifier for field types
    2. Predict validation rules
    3. Anomaly detection
    """
    
    def __init__(self):
        self.classifier = None
        self.feature_vectorizer = None
        self.training_data = []
        
        # Field type features
        self.field_type_features = {
            "email": ["email", "mail", "e-mail", "@"],
            "password": ["password", "pass", "pwd", "secret"],
            "username": ["username", "user", "login", "account"],
            "phone": ["phone", "tel", "telephone", "mobile"],
            "date": ["date", "birthday", "dob", "birth"],
            "url": ["url", "website", "link", "uri"],
            "number": ["number", "count", "quantity", "amount", "price"],
            "zip": ["zip", "postal", "postcode"],
            "credit_card": ["card", "credit", "cvv", "cvc"]
        }
    
    def extract_features(self, field: Dict[str, Any]) -> Dict[str, Any]:
        """Extract features from field for classification."""
        field_name = (field.get("name") or field.get("id") or "").lower()
        field_type = (field.get("type") or "text").lower()
        label = (field.get("label") or "").lower()
        placeholder = (field.get("placeholder") or "").lower()
        
        features = {
            "has_name": 1 if field_name else 0,
            "has_label": 1 if label else 0,
            "has_placeholder": 1 if placeholder else 0,
            "name_length": len(field_name),
            "label_length": len(label),
            "html_type": field_type,
            "required": 1 if field.get("required") else 0
        }
        
        # Keyword features
        combined_text = f"{field_name} {label} {placeholder}"
        for field_type_key, keywords in self.field_type_features.items():
            keyword_count = sum(1 for keyword in keywords if keyword in combined_text)
            features[f"keyword_{field_type_key}"] = keyword_count
        
        # Pattern features
        features["has_at_symbol"] = 1 if "@" in combined_text else 0
        features["has_digits"] = 1 if re.search(r'\d', combined_text) else 0
        features["has_special_chars"] = 1 if re.search(r'[!@#$%^&*]', combined_text) else 0
        
        return features
    
    def predict_field_type(self, field: Dict[str, Any]) -> Dict[str, Any]:
        """
        Predict field type and validation rules.
        
        Returns:
        {
            "predicted_type": str,
            "confidence": float,
            "validation_rules": [str],
            "anomaly_score": float
        }
        """
        features = self.extract_features(field)
        
        # Rule-based prediction (fallback if ML not available)
        predicted_type = self._predict_by_rules(field, features)
        confidence = self._calculate_confidence(field, predicted_type, features)
        validation_rules = self._predict_validation_rules(field, predicted_type)
        anomaly_score = self._detect_anomaly(field, predicted_type, features)
        
        # ML-based prediction if available
        if HAS_SKLEARN and self.classifier:
            try:
                # Convert features to vector
                feature_vector = self._features_to_vector(features)
                if feature_vector:
                    ml_prediction = self.classifier.predict([feature_vector])[0]
                    ml_confidence = max(self.classifier.predict_proba([feature_vector])[0])
                    
                    # Use ML if confidence is higher
                    if ml_confidence > confidence:
                        predicted_type = ml_prediction
                        confidence = ml_confidence
            except Exception as e:
                logger.warning(f"ML prediction failed: {e}, using rule-based")
        
        return {
            "predicted_type": predicted_type,
            "confidence": confidence,
            "validation_rules": validation_rules,
            "anomaly_score": anomaly_score
        }
    
    def _predict_by_rules(self, field: Dict[str, Any], features: Dict[str, Any]) -> str:
        """Predict field type using rule-based approach."""
        field_name = (field.get("name") or field.get("id") or "").lower()
        label = (field.get("label") or "").lower()
        placeholder = (field.get("placeholder") or "").lower()
        html_type = (field.get("type") or "text").lower()
        
        combined_text = f"{field_name} {label} {placeholder}"
        
        # Check HTML type first
        if html_type in ["email", "password", "tel", "url", "date", "number"]:
            return html_type
        
        # Check keywords
        for field_type, keywords in self.field_type_features.items():
            if any(keyword in combined_text for keyword in keywords):
                return field_type
        
        return "text"
    
    def _calculate_confidence(
        self,
        field: Dict[str, Any],
        predicted_type: str,
        features: Dict[str, Any]
    ) -> float:
        """Calculate confidence score for prediction."""
        confidence = 0.5  # Base confidence
        
        # Increase confidence if HTML type matches
        html_type = (field.get("type") or "text").lower()
        if html_type == predicted_type:
            confidence += 0.3
        
        # Increase confidence if keywords match
        field_name = (field.get("name") or field.get("id") or "").lower()
        label = (field.get("label") or "").lower()
        combined_text = f"{field_name} {label}".lower()
        
        keywords = self.field_type_features.get(predicted_type, [])
        if any(keyword in combined_text for keyword in keywords):
            confidence += 0.2
        
        return min(confidence, 1.0)
    
    def _predict_validation_rules(
        self,
        field: Dict[str, Any],
        field_type: str
    ) -> List[str]:
        """Predict validation rules based on field type."""
        rules = []
        
        if field.get("required"):
            rules.append("required")
        
        if field_type == "email":
            rules.append("email_format")
        elif field_type == "password":
            rules.append("minLength:8")
            rules.append("complexity")
        elif field_type == "phone":
            rules.append("phone_format")
        elif field_type == "url":
            rules.append("url_format")
        elif field_type == "date":
            rules.append("date_format")
        elif field_type == "number":
            min_val = field.get("min")
            max_val = field.get("max")
            if min_val is not None:
                rules.append(f"min:{min_val}")
            if max_val is not None:
                rules.append(f"max:{max_val}")
        
        return rules
    
    def _detect_anomaly(
        self,
        field: Dict[str, Any],
        predicted_type: str,
        features: Dict[str, Any]
    ) -> float:
        """Detect anomalies in field configuration."""
        anomaly_score = 0.0
        
        # Anomaly: HTML type doesn't match predicted type
        html_type = (field.get("type") or "text").lower()
        if html_type != predicted_type and html_type != "text":
            anomaly_score += 0.3
        
        # Anomaly: Required field without label
        if field.get("required") and not field.get("label"):
            anomaly_score += 0.2
        
        # Anomaly: Password field not masked
        if predicted_type == "password" and html_type != "password":
            anomaly_score += 0.5
        
        return min(anomaly_score, 1.0)
    
    def _features_to_vector(self, features: Dict[str, Any]) -> Optional[List[float]]:
        """Convert features dict to vector (simplified)."""
        # This would use DictVectorizer in real implementation
        # Simplified version for now
        return None
    
    def train_classifier(self, training_data: List[Dict[str, Any]]):
        """Train ML classifier on historical data."""
        if not HAS_SKLEARN or not training_data:
            logger.warning("Cannot train classifier: scikit-learn not available or no training data")
            return
        
        # Extract features and labels
        X = []
        y = []
        
        for sample in training_data:
            field = sample.get("field", {})
            true_type = sample.get("true_type", "text")
            
            features = self.extract_features(field)
            X.append(features)
            y.append(true_type)
        
        # Convert to vectors
        vectorizer = DictVectorizer(sparse=False)
        X_vectorized = vectorizer.fit_transform(X)
        
        # Train classifier
        self.classifier = RandomForestClassifier(n_estimators=100, random_state=42)
        self.classifier.fit(X_vectorized, y)
        self.feature_vectorizer = vectorizer
        
        logger.info(f"Trained classifier on {len(training_data)} samples")


