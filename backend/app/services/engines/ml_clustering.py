"""
ML Clustering Engine - Layer 4
Clusters similar forms and learns patterns from data.
"""

import logging
from typing import Dict, List, Any, Optional
from collections import defaultdict
import hashlib

logger = logging.getLogger(__name__)

# Try to import scikit-learn (optional)
try:
    from sklearn.cluster import DBSCAN, KMeans
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False


class MLClusteringEngine:
    """
    Clusters similar forms and learns patterns.
    
    Layer 4 Components:
    1. Clustering similar forms
    2. Identify common patterns
    3. Learn from historical data
    """
    
    def __init__(self):
        self.form_clusters = {}
        self.pattern_library = defaultdict(list)
    
    def cluster_forms(
        self,
        forms: List[Dict[str, Any]],
        method: str = "signature"
    ) -> Dict[str, Any]:
        """
        Cluster similar forms together.
        
        Returns:
        {
            "clusters": [{
                "cluster_id": str,
                "forms": [Dict],
                "common_pattern": Dict,
                "size": int
            }],
            "outliers": [Dict]
        }
        """
        if method == "signature":
            return self._cluster_by_signature(forms)
        elif method == "ml" and HAS_SKLEARN:
            return self._cluster_by_ml(forms)
        else:
            return self._cluster_by_signature(forms)
    
    def _cluster_by_signature(self, forms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Cluster forms by their field signature."""
        clusters = defaultdict(list)
        
        for form in forms:
            # Create signature from field names and types
            fields = form.get("fields", [])
            signature_parts = []
            for field in fields:
                field_name = (field.get("name") or field.get("id") or "").lower()
                field_type = (field.get("type") or "text").lower()
                signature_parts.append(f"{field_name}:{field_type}")
            
            signature = "|".join(sorted(signature_parts))
            signature_hash = hashlib.md5(signature.encode()).hexdigest()[:8]
            
            clusters[signature_hash].append({
                "form": form,
                "signature": signature
            })
        
        # Convert to cluster format
        cluster_list = []
        for cluster_id, form_list in clusters.items():
            if len(form_list) > 1:  # Only clusters with multiple forms
                # Find common pattern
                common_pattern = self._extract_common_pattern([f["form"] for f in form_list])
                
                cluster_list.append({
                    "cluster_id": cluster_id,
                    "forms": [f["form"] for f in form_list],
                    "common_pattern": common_pattern,
                    "size": len(form_list)
                })
        
        # Outliers are forms that don't cluster
        outliers = [f["form"] for cluster in clusters.values() if len(cluster) == 1 for f in cluster]
        
        return {
            "clusters": cluster_list,
            "outliers": outliers
        }
    
    def _cluster_by_ml(self, forms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Cluster forms using ML (scikit-learn)."""
        if not HAS_SKLEARN:
            return self._cluster_by_signature(forms)
        
        # Convert forms to feature vectors
        form_texts = []
        for form in forms:
            fields = form.get("fields", [])
            field_text = " ".join([
                f"{f.get('name', '')} {f.get('type', '')} {f.get('label', '')}"
                for f in fields
            ])
            form_texts.append(field_text)
        
        # Vectorize
        vectorizer = TfidfVectorizer(max_features=100)
        vectors = vectorizer.fit_transform(form_texts)
        
        # Cluster using DBSCAN
        clustering = DBSCAN(eps=0.3, min_samples=2)
        labels = clustering.fit_predict(vectors)
        
        # Group by cluster
        clusters = defaultdict(list)
        for idx, label in enumerate(labels):
            if label != -1:  # Not an outlier
                clusters[label].append(forms[idx])
        
        cluster_list = []
        for cluster_id, form_list in clusters.items():
            common_pattern = self._extract_common_pattern(form_list)
            cluster_list.append({
                "cluster_id": f"ml_{cluster_id}",
                "forms": form_list,
                "common_pattern": common_pattern,
                "size": len(form_list)
            })
        
        outliers = [forms[idx] for idx, label in enumerate(labels) if label == -1]
        
        return {
            "clusters": cluster_list,
            "outliers": outliers
        }
    
    def _extract_common_pattern(self, forms: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract common pattern from a cluster of forms."""
        if not forms:
            return {}
        
        # Find common fields
        all_field_names = set()
        field_types = defaultdict(list)
        
        for form in forms:
            for field in form.get("fields", []):
                field_name = (field.get("name") or field.get("id") or "").lower()
                field_type = field.get("type", "text")
                all_field_names.add(field_name)
                field_types[field_name].append(field_type)
        
        # Common fields appear in most forms
        common_fields = []
        threshold = len(forms) * 0.7  # 70% of forms
        
        for field_name in all_field_names:
            count = sum(1 for form in forms 
                       if any((f.get("name") or f.get("id") or "").lower() == field_name 
                             for f in form.get("fields", [])))
            if count >= threshold:
                # Get most common type
                types = field_types[field_name]
                most_common_type = max(set(types), key=types.count) if types else "text"
                
                common_fields.append({
                    "name": field_name,
                    "type": most_common_type,
                    "frequency": count / len(forms)
                })
        
        return {
            "common_fields": common_fields,
            "form_count": len(forms),
            "pattern_type": self._identify_pattern_type(common_fields)
        }
    
    def _identify_pattern_type(self, fields: List[Dict[str, Any]]) -> str:
        """Identify pattern type from common fields."""
        field_names = [f["name"] for f in fields]
        field_names_str = " ".join(field_names)
        
        if "user" in field_names_str and "pass" in field_names_str:
            return "login"
        elif "email" in field_names_str and "pass" in field_names_str and "confirm" in field_names_str:
            return "registration"
        elif "search" in field_names_str:
            return "search"
        elif "checkout" in field_names_str or "payment" in field_names_str:
            return "checkout"
        else:
            return "generic_form"
    
    def learn_from_clusters(self, clusters: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Learn patterns from clusters and update pattern library."""
        learned_patterns = {}
        
        for cluster in clusters:
            pattern = cluster.get("common_pattern", {})
            pattern_type = pattern.get("pattern_type", "unknown")
            
            if pattern_type not in learned_patterns:
                learned_patterns[pattern_type] = {
                    "count": 0,
                    "fields": defaultdict(int),
                    "validation_rules": defaultdict(int)
                }
            
            learned_patterns[pattern_type]["count"] += cluster.get("size", 0)
            
            # Learn field frequencies
            for field in pattern.get("common_fields", []):
                field_name = field.get("name")
                learned_patterns[pattern_type]["fields"][field_name] += 1
        
        return learned_patterns


