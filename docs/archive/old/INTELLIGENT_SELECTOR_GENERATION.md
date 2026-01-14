# Intelligent Selector Generation - Based on HTML Structure

## Key Insights from Screenshot Analysis

The user demonstrated that XPath `//a[contains(.,'Join the donor registry')]` works perfectly because it:
1. Uses the **tag name** (`a`) - critical for element type identification
2. Uses **text content** (`Join the donor registry`) - the actual visible text
3. Uses **contains** matching - flexible text matching

## Problems Identified

1. **Salesforce Detection**: Not detecting Salesforce apps properly (should check `/s/` URL pattern)
2. **Title Attribute**: Using truncated titles (e.g., "Join thi nor registry" instead of full text)
3. **Tag + Text Combination**: Not using XPath-like `tag[contains(text, '...')]` approach
4. **Href Attribute**: Not prioritizing `href` for Salesforce links
5. **Text Content Extraction**: May not be getting full text if it's in child elements

## Solutions Implemented

### 1. Enhanced Salesforce Detection
```python
# Before: Only checked classes
is_salesforce = any('slds-' in cls or 'lwc-' in cls for cls in classes)

# After: Multiple indicators
is_salesforce = (
    any('slds-' in cls or 'lwc-' in cls for cls in classes) or
    '/s/' in url or  # Salesforce Experience Cloud URL pattern
    'salesforce' in url.lower() or
    any('data-menubar-item' in cls or 'data-menulist-item' in cls for cls in classes)
)
```

### 2. XPath-like Tag + Text Selectors
```python
# New: Tag + text filter (like XPath //a[contains(.,'text')])
if tag_name and text_content:
    locators.append((
        f"page.locator('{tag_name}').filter({{ hasText: '{escaped_text}' }})",
        "tag_text_filter"
    ))
```

This generates: `page.locator('a').filter({ hasText: 'Join the donor registry' })`

### 3. Improved Title Handling
```python
# Only use title if it's complete (not truncated)
if len(title) > 10 and not title.endswith('...'):
    # Use title selector
```

### 4. Href Priority for Salesforce Links
```python
# For Salesforce links, href is very stable
if is_salesforce and tag_name == "a" and href:
    if href and href != "#" and not href.startswith("javascript:"):
        locators.append((
            f"page.locator('a[href=\"{escaped_href}\"]')",
            "salesforce_href"
        ))
```

### 5. Data Attributes for Salesforce
```python
# Salesforce uses data-menubar-item, data-menulist-item, etc.
data_attrs = {k: v for k, v in attributes.items() if k.startswith('data-') and v}
if data_attrs:
    selector = f'a[data-menulist-item][data-id="..."]'
```

### 6. Better Text Content Extraction
```python
# Extract from multiple sources including nested attributes
element_data["text_content"] = (
    element_data.get("text_content") or
    attrs.get("innerText") or
    attrs.get("textContent") or
    attrs.get("inner_text")
)
```

## Selector Priority Order (Updated)

For Salesforce Links (like "Join the donor registry"):
1. **Title attribute** (if complete): `a[title="Join the donor registry"]`
2. **Href attribute**: `a[href="/s/join"]`
3. **Tag + Text filter** (XPath-like): `a.filter({ hasText: 'Join the donor registry' })`
4. **Data attributes**: `a[data-menulist-item][data-id="..."]`
5. **getByRole('link')**: `page.getByRole('link', { name: 'Join the donor registry' })`
6. **getByText**: `page.getByText('Join the donor registry')`

For Salesforce Buttons (like "Next"):
1. **Title attribute** (if complete): `button[title="Next"]`
2. **Tag + Text filter**: `button.filter({ hasText: 'Next' })`
3. **getByRole('button')**: `page.getByRole('button', { name: 'Next' })`
4. **Data attributes**: `button[data-*="..."]`

## Key Principles

1. **Tag Name is Critical**: Always use tag name (`a`, `button`, `span`) as part of selector
2. **Text Content is Reliable**: Visible text is what users see and interact with
3. **XPath-like Logic**: `tag.filter({ hasText: 'text' })` is equivalent to `//tag[contains(.,'text')]`
4. **Salesforce-Specific**: Title, href, and data-* attributes are more stable than classes
5. **Fallback Chain**: Always have multiple strategies in priority order

## Example Output

For "Join the donor registry" link:
```javascript
// Priority 1: Title (if complete)
await page.locator('a[title="Join the donor registry"]').click();

// Priority 2: Href
await page.locator('a[href="/s/join"]').click();

// Priority 3: Tag + Text (XPath-like)
await page.locator('a').filter({ hasText: 'Join the donor registry' }).click();

// Priority 4: getByRole
await page.getByRole('link', { name: 'Join the donor registry' }).click();
```

## Testing

After these changes, the generator should:
1. ✅ Detect Salesforce apps from URL patterns (`/s/`)
2. ✅ Use tag + text combinations (XPath-like)
3. ✅ Prioritize href for Salesforce links
4. ✅ Use complete titles (not truncated)
5. ✅ Extract full text content from nested elements


