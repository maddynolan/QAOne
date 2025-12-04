# Flowstral Template Engine Implementation

## Overview

The Flowstral Template Engine implements a sophisticated, LLM-free approach to generating fluent, natural-language test cases from action graphs. It uses phrase banks, page type dictionaries, control mappings, and scenario templates to create human-readable test descriptions without requiring LLM calls.

## Core Components

### 1. Configuration File (`flowstral_templates.json`)

Contains all the static data needed for generation:

- **Page Types**: URL patterns and labels for identifying page types
- **Controls**: Selector patterns and element mappings
- **Action Phrases**: Multiple variations of action descriptions (with randomness)
- **Expected Phrases**: Multiple variations of expected results
- **Scenario Templates**: Metadata templates that match specific flow patterns

### 2. FlowstralTemplateEngine Class

Main engine that implements the algorithm:

```python
generate_test_cases_from_action_graph(action_graph) -> Dict
```

**Algorithm Steps:**
1. **Enrich Events**: Add context variables (page_type, control_id, element_name, product_type, user_role, intent)
2. **Segment into Scenarios**: Break action sequence into logical flows
3. **Match Scenario Templates**: Identify which template best matches each scenario
4. **Generate Fluent Language**: Use phrase banks with random selection for variation

### 3. Integration with TestCaseSynthesizer

The engine is integrated as an enhancement layer:

- Initializes in `TestCaseSynthesizer.__init__()`
- Called in `_synthesize_single_test_case()` after post-processing
- Enhances action text, expected results, titles, and descriptions

## Key Features

### Context Variables

The engine enriches each event with:
- `page_label`: Human-readable page name (e.g., "Walmart home page")
- `product_type`: Inferred from context (e.g., "tire", "product", "item")
- `user_role`: Inferred from flow (e.g., "user", "unauthenticated user")
- `intent`: Action intent (e.g., "login", "checkout", "add_to_cart")
- `control_id`: Matched control identifier
- `element_name`: Clean element name

### Phrase Banks with Randomness

Each action type has multiple phrase variations:
```json
"click_nav_menu": [
  "Click on the '{element_name}' header menu item.",
  "Select the '{element_name}' option from the top navigation.",
  "Open the '{element_name}' menu from the navigation bar."
]
```

Random selection ensures natural variation and avoids robotic repetition.

### Smart Mapping Rules

The engine uses rule-based classification:
- `click_nav_menu` → Navigation menu clicks
- `click_add_to_cart` → Add to cart actions
- `click_checkout` → Checkout button clicks
- `fill_input` → Form input actions
- etc.

### Scenario Template Matching

Templates match based on:
- Page types included in scenario
- Controls present
- Event types
- Exclusion rules

Example template:
```json
{
  "id": "cart_remove_and_checkout_redirect",
  "when": {
    "includes_page_types": ["cart", "login"],
    "includes_controls_any": ["remove_item", "checkout_button"]
  },
  "title": "Remove Tire from Cart and Proceed to Checkout (Unauthenticated User)",
  "description": "Verify that a user can remove a tire from the cart...",
  "test_type": "functional",
  "priority": "high"
}
```

## Usage

The engine is automatically used when generating test cases:

```python
# In TestCaseSynthesizer
test_case = self._synthesize_single_test_case(...)
# Automatically enhanced with Flowstral language
```

Or use directly:

```python
from app.services.engines.flowstral_template_engine import FlowstralTemplateEngine

engine = FlowstralTemplateEngine()
result = engine.generate_test_cases_from_action_graph(action_graph)
test_cases = result["test_cases"]["manual"]
```

## Example Output

**Before (basic template):**
```
Step 1: Click on Services
Step 2: Click on Buy Tires & Schedule Installation
```

**After (Flowstral enhanced):**
```
Step 1: Click on the 'Services' header menu item.
Step 2: Choose 'Buy Tires & Schedule Installation' from the list.
```

**Expected Results:**
```
Step 1 Expected: The Services menu opens showing available options.
Step 2 Expected: User is navigated to the car tires browse page.
```

## Benefits

1. **No LLM Dependency**: Fast, deterministic, no API costs
2. **Natural Language**: Fluent, human-readable descriptions
3. **Variation**: Random phrase selection prevents repetition
4. **Maintainable**: Easy to add new phrases, page types, controls
5. **Extensible**: Can be customized per domain/application

## Customization

To add support for a new application:

1. **Add Page Types** in `flowstral_templates.json`:
```json
{
  "id": "product_detail",
  "match": ["/products/", "/item/"],
  "label": "product detail page"
}
```

2. **Add Controls**:
```json
{
  "id": "add_to_wishlist",
  "selector_contains": ["wishlist", "favorite"],
  "text_contains": ["Add to Wishlist"],
  "element_name": "Add to Wishlist",
  "type": "button"
}
```

3. **Add Action Phrases**:
```json
"click_wishlist": [
  "Click the '{element_name}' button to add to wishlist.",
  "Add the item to your wishlist by clicking '{element_name}'."
]
```

4. **Add Scenario Templates** for new flows

## Architecture

```
ActionGraph
    ↓
FlowstralTemplateEngine.enrich_events()
    ↓ (adds page_type, control_id, element_name, etc.)
Enriched Events
    ↓
FlowstralTemplateEngine.segment_into_scenarios()
    ↓ (logical flow breaks)
Scenarios
    ↓
FlowstralTemplateEngine._match_scenario_template()
    ↓ (template matching)
Matched Templates
    ↓
FlowstralTemplateEngine._generate_test_case_for_scenario()
    ↓ (phrase bank selection + template filling)
Fluent Test Cases
```

## Future Enhancements

1. **Domain-Specific Templates**: Load different templates per application domain
2. **Learning from User Edits**: Track which phrases users prefer
3. **Multi-language Support**: Phrase banks in different languages
4. **Context-Aware Variation**: More sophisticated randomness based on context
5. **Template Versioning**: Support multiple template versions




