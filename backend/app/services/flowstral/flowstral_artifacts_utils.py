"""
Utility functions extracted from FlowstralArtifactsGenerator.
These are pure helper functions that do not depend on instance state.
"""

import re
import logging
from typing import Dict, List, Any, Optional

logger = logging.getLogger(__name__)


def extract_first_real_url_from_graph(action_graph) -> Optional[str]:
    """Extract first real URL from action graph, filtering out internal browser URLs."""
    if not action_graph or not action_graph.nodes:
        return None

    # Internal browser URL patterns
    internal_patterns = ['chrome://', 'about:', 'edge://', 'newtab', 'blank']

    for node in action_graph.nodes:
        url = node.url or (node.url_pattern if hasattr(node, 'url_pattern') else None)
        if url and isinstance(url, str) and len(url) > 5:
            url_lower = url.lower()
            # Skip internal URLs
            if any(pattern in url_lower for pattern in internal_patterns):
                continue
            # Skip localhost/dev ports if Flowstral/QA platform
            if 'flowstral' in url_lower or 'qa' in url_lower or 'platform' in url_lower:
                continue
            # Check for localhost with dev ports
            if 'localhost' in url_lower or '127.0.0.1' in url_lower:
                if re.search(r':(8080|8081|3000|5173|4200)', url_lower):
                    continue
            # Valid URL found
            if url.startswith("http://") or url.startswith("https://"):
                return url

    return None


def extract_clean_page_name(url_or_pattern: str) -> str:
    """
    Extract a clean, readable page name from URL or pattern.
    Filters out Flowstral internal patterns, GUIDs, and meaningless parts.
    """
    if not url_or_pattern or url_or_pattern == "Page":
        return "Page"

    # Remove Flowstral patterns
    text = url_or_pattern
    text = re.sub(r'Page load:\s*', '', text, flags=re.I)
    text = re.sub(r'^https?://', '', text)
    text = re.sub(r'^www\.', '', text)

    # Extract meaningful parts from URL
    # Example: "www.walmart.com/shop/deals/flash-deals" -> "Flash Deals"
    parts = text.split('/')
    if len(parts) > 1:
        # Get the last meaningful part
        last_part = parts[-1].split('?')[0]  # Remove query params
        last_part = last_part.replace('-', ' ').replace('_', ' ')
        # Capitalize words
        last_part = ' '.join(word.capitalize() for word in last_part.split() if word)
        if last_part and len(last_part) > 2:
            return last_part

    # Fallback: use domain name or first meaningful part
    domain_match = re.search(r'([a-zA-Z0-9-]+\.(com|net|org|io|edu))', text)
    if domain_match:
        domain = domain_match.group(1)
        # Extract site name (e.g., "walmart" from "walmart.com")
        site_name = domain.split('.')[0].capitalize()
        return f"{site_name} Home"

    # Final fallback
    return text[:50] if len(text) > 50 else text


def validate_playwright_code_structure(code: str) -> bool:
    """Validate that Playwright code has proper structure."""
    required_patterns = [
        r"import.*@playwright/test",
        r"(test|describe)\s*\(",
        r"async\s*\(\s*\{\s*page\s*\}\s*\)"
    ]

    for pattern in required_patterns:
        if not re.search(pattern, code, re.IGNORECASE):
            return False

    return True


def calculate_title_similarity(title1: str, title2: str) -> float:
    """Calculate similarity between two titles (0.0 to 1.0)"""
    # Simple word-based similarity
    words1 = set(title1.split())
    words2 = set(title2.split())

    if not words1 or not words2:
        return 0.0

    # Calculate Jaccard similarity
    intersection = len(words1 & words2)
    union = len(words1 | words2)

    if union == 0:
        return 0.0

    return intersection / union


def deduplicate_test_cases(test_cases: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate test cases based on title similarity"""
    if not test_cases:
        return []

    deduplicated = []
    seen_titles = set()

    for test_case in test_cases:
        title = test_case.get("title", "").lower().strip()

        # Skip if title is empty
        if not title:
            continue

        # Check for exact duplicate
        if title in seen_titles:
            logger.debug(f"Skipping duplicate test case: {test_case.get('title')}")
            continue

        # Check for similar titles (fuzzy matching)
        is_duplicate = False
        for seen_title in seen_titles:
            # If titles are very similar (80%+ overlap), consider it a duplicate
            similarity = calculate_title_similarity(title, seen_title)
            if similarity > 0.8:
                logger.debug(f"Skipping similar test case: {test_case.get('title')} (similarity: {similarity:.2f} with '{seen_title}')")
                is_duplicate = True
                break

        if not is_duplicate:
            deduplicated.append(test_case)
            seen_titles.add(title)

    return deduplicated


def generate_performance_recommendations(
    bottlenecks: List[Dict[str, Any]],
    api_matrix: Dict[str, Any]
) -> List[str]:
    """Generate performance optimization recommendations"""
    recommendations = []

    # Page-level recommendations
    page_bottlenecks = [b for b in bottlenecks if b.get("type") == "page_level"]
    if page_bottlenecks:
        recommendations.append("Optimize page load performance: reduce render-blocking resources, optimize images")

    # Component recommendations
    component_bottlenecks = [b for b in bottlenecks if b.get("type") == "component"]
    if component_bottlenecks:
        recommendations.append("Optimize component rendering: use code splitting, lazy loading, memoization")

    # API recommendations
    network_bottlenecks = [b for b in bottlenecks if b.get("type") == "network"]
    if network_bottlenecks:
        recommendations.append("Optimize API endpoints: add caching, reduce payload size, use compression")

    # Slow endpoints
    slow_endpoints = [e for e in api_matrix.values() if e.get("avg_latency", 0) > 1000]
    if slow_endpoints:
        recommendations.append(f"Optimize {len(slow_endpoints)} slow API endpoints: consider caching or query optimization")

    return recommendations


def extract_reproduction_steps(action_graph) -> List[str]:
    """Extract reproduction steps from action graph"""
    steps = []
    for i, node in enumerate(action_graph.nodes, 1):
        if node.event_type != "session_start" and node.event_type != "session_end":
            steps.append(f"{i}. {node.action_description}")
    return steps


def get_action_graph_snippet(action_graph) -> Dict[str, Any]:
    """Get a snippet of the action graph for defect context"""
    return {
        "total_nodes": len(action_graph.nodes),
        "total_edges": len(action_graph.edges),
        "event_types": list(set(node.event_type for node in action_graph.nodes)),
        "urls": list(set(node.url for node in action_graph.nodes if node.url))
    }
