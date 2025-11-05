"""
Accessibility Compliance Templates (WCAG 2.1 AA)
Hardcoded templates - no inference needed
Based on WCAG 2.1 Level AA requirements
"""

# WCAG 2.1 AA Compliance Checklist
WCAG_21_AA_CHECKLIST = {
    "1.1.1_NonTextContent": {
        "name": "Non-text Content Has Text Alternative",
        "description": "All images, icons, and non-text content must have alt text",
        "tests": [
            {
                "name": "Image_AltText_Present",
                "description": "Verify all images have alt text attribute",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check all img tags have alt attribute", "expectedResult": "All images have alt text"},
                    {"action": "Verify decorative images have empty alt", "expectedResult": "Decorative images use alt=''"}
                ],
                "priority": "critical",
                "tags": ["accessibility", "wcag", "images"]
            }
        ]
    },
    "1.3.1_InfoAndRelationships": {
        "name": "Information and Relationships",
        "description": "Structure content with proper headings, lists, and landmarks",
        "tests": [
            {
                "name": "Heading_Hierarchy_Correct",
                "description": "Verify heading hierarchy (h1-h6) is logical",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check heading structure", "expectedResult": "Headings follow h1 -> h2 -> h3 hierarchy"},
                    {"action": "Verify no skipped levels", "expectedResult": "No h3 without h2, no h2 without h1"}
                ],
                "priority": "high",
                "tags": ["accessibility", "wcag", "headings"]
            }
        ]
    },
    "1.4.3_Contrast": {
        "name": "Contrast (Minimum)",
        "description": "Text contrast ratio at least 4.5:1 for normal text, 3:1 for large text",
        "tests": [
            {
                "name": "Text_Contrast_Ratio_Valid",
                "description": "Verify all text meets contrast requirements",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check text contrast ratios", "expectedResult": "Normal text >= 4.5:1, large text >= 3:1"},
                    {"action": "Test with contrast checker tool", "expectedResult": "All text passes WCAG AA"}
                ],
                "priority": "high",
                "tags": ["accessibility", "wcag", "contrast"]
            }
        ]
    },
    "2.1.1_Keyboard": {
        "name": "Keyboard Accessible",
        "description": "All functionality available via keyboard",
        "tests": [
            {
                "name": "Keyboard_Navigation_Complete",
                "description": "Verify all interactive elements accessible via keyboard",
                "steps": [
                    {"action": "Navigate to page using Tab key", "expectedResult": "Can access all interactive elements"},
                    {"action": "Test form inputs with keyboard", "expectedResult": "All inputs focusable and usable"},
                    {"action": "Test buttons with Enter/Space", "expectedResult": "All buttons trigger with keyboard"}
                ],
                "priority": "critical",
                "tags": ["accessibility", "wcag", "keyboard"]
            }
        ]
    },
    "2.4.1_BypassBlocks": {
        "name": "Bypass Blocks",
        "description": "Skip navigation links for repetitive content",
        "tests": [
            {
                "name": "Skip_Navigation_Link_Present",
                "description": "Verify skip navigation link exists",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check for skip navigation link", "expectedResult": "Skip link present and visible on focus"},
                    {"action": "Test skip link functionality", "expectedResult": "Skip link jumps to main content"}
                ],
                "priority": "high",
                "tags": ["accessibility", "wcag", "navigation"]
            }
        ]
    },
    "2.4.2_PageTitled": {
        "name": "Page Titled",
        "description": "Pages have descriptive titles",
        "tests": [
            {
                "name": "Page_Title_Descriptive",
                "description": "Verify page has meaningful title",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check page title tag", "expectedResult": "Title is descriptive and unique"},
                    {"action": "Verify title describes page purpose", "expectedResult": "Title clearly identifies page content"}
                ],
                "priority": "medium",
                "tags": ["accessibility", "wcag", "seo"]
            }
        ]
    },
    "2.4.3_FocusOrder": {
        "name": "Focus Order",
        "description": "Focus order follows logical sequence",
        "tests": [
            {
                "name": "Focus_Order_Logical",
                "description": "Verify tab order is logical",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Tab through all interactive elements", "expectedResult": "Focus order follows visual layout"},
                    {"action": "Verify no focus traps", "expectedResult": "All elements reachable via Tab"}
                ],
                "priority": "high",
                "tags": ["accessibility", "wcag", "keyboard"]
            }
        ]
    },
    "3.2.1_OnFocus": {
        "name": "On Focus",
        "description": "No context changes on focus",
        "tests": [
            {
                "name": "Focus_No_Context_Change",
                "description": "Verify focus doesn't trigger unexpected changes",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Focus on form fields", "expectedResult": "No page refresh or navigation"},
                    {"action": "Focus on links", "expectedResult": "No automatic navigation"}
                ],
                "priority": "medium",
                "tags": ["accessibility", "wcag", "focus"]
            }
        ]
    },
    "4.1.1_Parsing": {
        "name": "Parsing",
        "description": "Markup is valid and well-formed",
        "tests": [
            {
                "name": "HTML_Valid_Markup",
                "description": "Verify HTML is valid",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Validate HTML markup", "expectedResult": "No parsing errors"},
                    {"action": "Check for unclosed tags", "expectedResult": "All tags properly closed"}
                ],
                "priority": "medium",
                "tags": ["accessibility", "wcag", "markup"]
            }
        ]
    },
    "4.1.2_NameRoleValue": {
        "name": "Name, Role, Value",
        "description": "UI components have accessible names and roles",
        "tests": [
            {
                "name": "ARIA_Labels_Present",
                "description": "Verify form controls have accessible names",
                "steps": [
                    {"action": "Navigate to page", "expectedResult": "Page loads"},
                    {"action": "Check form inputs have labels", "expectedResult": "All inputs have associated labels or aria-label"},
                    {"action": "Verify buttons have accessible names", "expectedResult": "All buttons have text or aria-label"}
                ],
                "priority": "critical",
                "tags": ["accessibility", "wcag", "aria"]
            }
        ]
    }
}


def get_accessibility_test_cases(requirement: str = None) -> List[Dict[str, Any]]:
    """
    Get all WCAG 2.1 AA compliance test cases
    No inference needed - all hardcoded
    """
    all_tests = []
    
    for criterion_id, criterion_data in WCAG_21_AA_CHECKLIST.items():
        for test in criterion_data["tests"]:
            test_case = {
                "name": test["name"],
                "description": f"{criterion_data['name']}: {test['description']}",
                "steps": test["steps"],
                "priority": test["priority"],
                "tags": test["tags"] + [criterion_id],
                "wcag_criterion": criterion_id,
                "wcag_level": "AA",
                "wcag_version": "2.1"
            }
            all_tests.append(test_case)
    
    return all_tests


def get_accessibility_test_by_criterion(criterion_id: str) -> List[Dict[str, Any]]:
    """Get test cases for specific WCAG criterion"""
    if criterion_id in WCAG_21_AA_CHECKLIST:
        return WCAG_21_AA_CHECKLIST[criterion_id]["tests"]
    return []


# Export for use in endpoints
__all__ = [
    "WCAG_21_AA_CHECKLIST",
    "get_accessibility_test_cases",
    "get_accessibility_test_by_criterion"
]

