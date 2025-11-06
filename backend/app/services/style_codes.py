"""
Style Codes Service - Style Profiler and Template Enforcement
Analyzes test examples to extract style patterns and enforces them in generation.
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
import json
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class StyleFormat(Enum):
    GHERKIN = "gherkin"
    STEPS = "steps"
    BDD = "bdd"


class NamingConvention(Enum):
    PASCAL_CASE = "PascalCase"
    SNAKE_CASE = "snake_case"
    CAMEL_CASE = "camelCase"
    KEBAB_CASE = "kebab-case"


@dataclass
class StyleCodex:
    """Style profile extracted from examples"""
    format: StyleFormat = StyleFormat.GHERKIN
    naming_convention: NamingConvention = NamingConvention.PASCAL_CASE
    use_tags: bool = True
    tag_patterns: List[str] = None
    negative_case_policy: str = "always"  # 'always', 'optional', 'never'
    max_steps_per_test: int = 7
    min_steps_per_test: int = 3
    directory_layout: str = "feature-based"  # 'feature-based', 'type-based', 'flat'
    assertion_style: str = "explicit"  # 'explicit', 'implicit', 'mixed'
    step_verb_style: str = "action-oriented"  # 'action-oriented', 'behavior-oriented'
    include_preconditions: bool = True
    include_cleanup: bool = False
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.tag_patterns is None:
            self.tag_patterns = ["@smoke", "@regression"]
        if self.metadata is None:
            self.metadata = {}


class StyleProfiler:
    """
    Analyzes test examples to extract style patterns.
    Implements the Style Profiler from the architecture.
    """

    def __init__(self):
        self.default_codex = StyleCodex()

    def profile_from_examples(
        self,
        examples: List[Dict[str, Any]],
        min_samples: int = 5,
        max_samples: int = 50
    ) -> StyleCodex:
        """
        Analyze test examples to extract style patterns.
        
        Args:
            examples: List of test case examples (should be redacted for privacy)
            min_samples: Minimum number of samples required
            max_samples: Maximum number of samples to analyze
            
        Returns:
            StyleCodex with extracted patterns
        """
        if len(examples) < min_samples:
            logger.warning(f"Only {len(examples)} examples provided, minimum is {min_samples}")
            return self.default_codex

        # Limit to max_samples
        samples = examples[:max_samples]

        codex = StyleCodex()

        # Analyze format
        codex.format = self._detect_format(samples)

        # Analyze naming convention
        codex.naming_convention = self._detect_naming_convention(samples)

        # Analyze tag usage
        codex.use_tags = self._detect_tag_usage(samples)
        codex.tag_patterns = self._extract_tag_patterns(samples)

        # Analyze step count
        step_counts = [len(test.get("steps", [])) for test in samples]
        if step_counts:
            codex.max_steps_per_test = max(step_counts)
            codex.min_steps_per_test = min(step_counts)

        # Analyze negative case policy
        codex.negative_case_policy = self._detect_negative_case_policy(samples)

        # Analyze assertion style
        codex.assertion_style = self._detect_assertion_style(samples)

        # Analyze step verb style
        codex.step_verb_style = self._detect_step_verb_style(samples)

        # Analyze preconditions and cleanup
        codex.include_preconditions = self._detect_precondition_usage(samples)
        codex.include_cleanup = self._detect_cleanup_usage(samples)

        logger.info(f"Extracted style codex from {len(samples)} examples")
        return codex

    def _detect_format(self, samples: List[Dict[str, Any]]) -> StyleFormat:
        """Detect test format (Gherkin vs Steps)"""
        gherkin_indicators = ["Given", "When", "Then", "And", "But"]
        
        for test in samples:
            steps = test.get("steps", [])
            for step in steps:
                step_text = step.get("action", "") or step.get("description", "")
                if any(indicator in step_text for indicator in gherkin_indicators):
                    return StyleFormat.GHERKIN

        return StyleFormat.STEPS

    def _detect_naming_convention(self, samples: List[Dict[str, Any]]) -> NamingConvention:
        """Detect naming convention from test titles"""
        conventions_count = {
            NamingConvention.PASCAL_CASE: 0,
            NamingConvention.SNAKE_CASE: 0,
            NamingConvention.CAMEL_CASE: 0,
            NamingConvention.KEBAB_CASE: 0
        }

        for test in samples:
            title = test.get("title", "") or test.get("name", "")
            if not title:
                continue

            if "_" in title and not any(c.isupper() for c in title.split("_")[1:]):
                conventions_count[NamingConvention.SNAKE_CASE] += 1
            elif "-" in title:
                conventions_count[NamingConvention.KEBAB_CASE] += 1
            elif title[0].isupper() and any(c.isupper() for c in title[1:]):
                conventions_count[NamingConvention.PASCAL_CASE] += 1
            elif title[0].islower() and any(c.isupper() for c in title[1:]):
                conventions_count[NamingConvention.CAMEL_CASE] += 1

        # Return most common
        if sum(conventions_count.values()) == 0:
            return NamingConvention.PASCAL_CASE
        return max(conventions_count, key=conventions_count.get)

    def _detect_tag_usage(self, samples: List[Dict[str, Any]]) -> bool:
        """Detect if tags are used"""
        tagged_count = sum(1 for test in samples if test.get("tags"))
        return tagged_count >= len(samples) * 0.5  # 50% threshold

    def _extract_tag_patterns(self, samples: List[Dict[str, Any]]) -> List[str]:
        """Extract common tag patterns"""
        all_tags = []
        for test in samples:
            tags = test.get("tags", [])
            all_tags.extend(tags)

        # Count frequency
        tag_counts = {}
        for tag in all_tags:
            tag_counts[tag] = tag_counts.get(tag, 0) + 1

        # Return most common tags (at least 30% frequency)
        threshold = len(samples) * 0.3
        common_tags = [tag for tag, count in tag_counts.items() if count >= threshold]
        return sorted(common_tags, key=lambda t: tag_counts[t], reverse=True)[:10]

    def _detect_negative_case_policy(self, samples: List[Dict[str, Any]]) -> str:
        """Detect negative case policy"""
        negative_keywords = ["invalid", "error", "fail", "reject", "deny", "negative"]
        
        negative_count = 0
        for test in samples:
            title = (test.get("title", "") or test.get("name", "")).lower()
            description = (test.get("description", "") or "").lower()
            if any(keyword in title or keyword in description for keyword in negative_keywords):
                negative_count += 1

        ratio = negative_count / len(samples) if samples else 0
        if ratio >= 0.3:
            return "always"
        elif ratio >= 0.1:
            return "optional"
        else:
            return "never"

    def _detect_assertion_style(self, samples: List[Dict[str, Any]]) -> str:
        """Detect assertion style"""
        explicit_keywords = ["assert", "verify", "check", "expect", "should"]
        
        explicit_count = 0
        for test in samples:
            steps = test.get("steps", [])
            for step in steps:
                step_text = (step.get("action", "") or step.get("description", "")).lower()
                if any(keyword in step_text for keyword in explicit_keywords):
                    explicit_count += 1

        if explicit_count >= len(samples) * 0.7:
            return "explicit"
        elif explicit_count >= len(samples) * 0.3:
            return "mixed"
        else:
            return "implicit"

    def _detect_step_verb_style(self, samples: List[Dict[str, Any]]) -> str:
        """Detect step verb style"""
        action_verbs = ["click", "enter", "select", "navigate", "submit", "wait"]
        behavior_verbs = ["user should", "system should", "verify that", "ensure that"]
        
        action_count = 0
        behavior_count = 0
        
        for test in samples:
            steps = test.get("steps", [])
            for step in steps:
                step_text = (step.get("action", "") or step.get("description", "")).lower()
                if any(verb in step_text for verb in action_verbs):
                    action_count += 1
                if any(verb in step_text for verb in behavior_verbs):
                    behavior_count += 1

        if action_count > behavior_count * 1.5:
            return "action-oriented"
        else:
            return "behavior-oriented"

    def _detect_precondition_usage(self, samples: List[Dict[str, Any]]) -> bool:
        """Detect if preconditions are used"""
        with_preconditions = sum(1 for test in samples if test.get("preconditions") or test.get("setup"))
        return with_preconditions >= len(samples) * 0.5

    def _detect_cleanup_usage(self, samples: List[Dict[str, Any]]) -> bool:
        """Detect if cleanup steps are used"""
        with_cleanup = sum(1 for test in samples if test.get("cleanup") or test.get("teardown"))
        return with_cleanup >= len(samples) * 0.3


class StyleEnforcer:
    """
    Enforces style codex rules during test generation.
    """

    def __init__(self, codex: StyleCodex):
        self.codex = codex

    def enforce_style(self, generated_test: Dict[str, Any]) -> Dict[str, Any]:
        """Apply style codex rules to a generated test"""
        # Enforce naming convention
        generated_test["title"] = self._apply_naming_convention(generated_test.get("title", ""))

        # Enforce step count
        steps = generated_test.get("steps", [])
        if len(steps) > self.codex.max_steps_per_test:
            logger.warning(f"Test has {len(steps)} steps, max is {self.codex.max_steps_per_test}")
            # Could split into multiple tests here
        elif len(steps) < self.codex.min_steps_per_test:
            logger.warning(f"Test has {len(steps)} steps, min is {self.codex.min_steps_per_test}")

        # Enforce tags
        if self.codex.use_tags and not generated_test.get("tags"):
            generated_test["tags"] = self.codex.tag_patterns[:3]  # Add default tags

        # Enforce format
        if self.codex.format == StyleFormat.GHERKIN:
            generated_test["steps"] = self._convert_to_gherkin(steps)

        return generated_test

    def _apply_naming_convention(self, title: str) -> str:
        """Apply naming convention to title"""
        # This is a simplified version - can be enhanced
        if self.codex.naming_convention == NamingConvention.PASCAL_CASE:
            # Convert to PascalCase
            words = title.split()
            return "".join(word.capitalize() for word in words)
        elif self.codex.naming_convention == NamingConvention.SNAKE_CASE:
            return "_".join(title.lower().split())
        elif self.codex.naming_convention == NamingConvention.KEBAB_CASE:
            return "-".join(title.lower().split())
        return title

    def _convert_to_gherkin(self, steps: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert steps to Gherkin format"""
        gherkin_keywords = ["Given", "When", "Then", "And", "But"]
        # Simple conversion - can be enhanced
        converted = []
        for i, step in enumerate(steps):
            action = step.get("action", "")
            if i == 0:
                keyword = "Given"
            elif "verify" in action.lower() or "check" in action.lower():
                keyword = "Then"
            else:
                keyword = "When"
            
            converted.append({
                **step,
                "action": f"{keyword} {action}"
            })
        return converted


# Global instances
style_profiler = StyleProfiler()

