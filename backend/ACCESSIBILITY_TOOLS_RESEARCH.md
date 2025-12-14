# Accessibility Tools Research - Best Practices

## How Industry-Leading Tools Work

### 1. **axe-core** (Industry Standard)
- **Approach**: Rule-based engine that scans entire DOM
- **Output Format**:
  - Groups violations by rule ID
  - Provides element-specific findings with:
    - CSS selector or HTML snippet
    - Impact level (critical, serious, moderate, minor)
    - Description in plain language
    - Help text explaining the issue
    - Help URL for WCAG reference
    - Nodes array with HTML snippets
  - Provides fix suggestions per element

### 2. **WAVE (WebAIM)**
- **Approach**: Visual overlay on page + detailed report
- **Output Format**:
  - Visual indicators on page (icons, colors)
  - Structured report with:
    - Issue title (human-readable)
    - Location (element description)
    - Description (what's wrong)
    - Fix suggestion (how to fix)
    - Code example (before/after)
  - Groups by category (Errors, Alerts, Features, etc.)

### 3. **Lighthouse (Google)**
- **Approach**: Full page audit with scoring
- **Output Format**:
  - Accessibility score (0-100)
  - Grouped findings by:
    - Category (e.g., "Buttons and links", "Images", "Forms")
    - Severity (manual, needs review, passed)
  - Each finding includes:
    - Title
    - Description
    - Impact
    - Fix guidance
    - Code snippet
  - Provides "Learn more" links

### 4. **Accessibility Insights (Microsoft)**
- **Approach**: Automated + manual testing
- **Output Format**:
  - Findings grouped by:
    - Rule ID
    - Element type
    - Impact
  - Each finding has:
    - Issue description
    - Element location
    - How to fix
    - Why it matters
    - Test steps

## Common Patterns Across All Tools

### 1. **Element-Specific Reporting**
- Not just rule names, but actual element identification
- CSS selectors or HTML snippets for location
- Context about where element appears

### 2. **Grouping Strategy**
- Group by rule ID (same issue type)
- Group by element type (all buttons, all images)
- Group by severity
- Show counts (e.g., "68 buttons missing accessible names")

### 3. **Actionable Recommendations**
- Specific fix suggestions per element
- Code examples (before/after)
- Step-by-step implementation guidance
- Estimated fix time

### 4. **User Impact Focus**
- Explains how issue affects users
- Prioritizes by impact (critical > serious > moderate > minor)
- Links to WCAG criteria

### 5. **Visual Indicators**
- Icons/colors for severity
- Overlay on page showing issues
- Inline annotations

## Our Implementation Strategy

Based on this research, we should:

1. **Process axe-core results better**:
   - Extract element context from HTML snippets
   - Group violations intelligently
   - Provide element-specific descriptions

2. **Format like industry tools**:
   - Human-readable titles
   - Element location (CSS selector + context)
   - Specific fix suggestions
   - Code examples

3. **Use LLM for enhancement**:
   - Transform rule-driven violations into element-specific findings
   - Generate contextual recommendations
   - Create before/after code examples

4. **Group intelligently**:
   - By rule (same issue type)
   - By element type (all buttons together)
   - By location (same page area)







