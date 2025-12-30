#!/usr/bin/env python3
"""
Manual test to show expected Playwright output
This simulates what the generator should produce
"""

# Sample action graph nodes (based on your scenario)
nodes = [
    {"event_type": "session_start", "target_selector": None, "target_text": None, "url": None},
    {"event_type": "navigate", "target_selector": None, "target_text": None, "url": "https://my.nmdp.org/s/?language=en_US"},
    {"event_type": "click", "target_selector": "span.slds-checkbox_faux", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "CLICK: SPAN span.slds-checkbox_faux"},
    {"event_type": "click", "target_selector": "INPUT#checkbox-84", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "CLICK: INPUT#checkbox-84", "metadata": {"value": None}},
    {"event_type": "input", "target_selector": "INPUT#checkbox-84", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "FILL_INPUT: INPUT#checkbox-84[Blood_Cancer_or_Disorder__c]", "metadata": {"value": "true"}},
    {"event_type": "click", "target_selector": "span.slds-checkbox_faux", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "CLICK: SPAN span.slds-checkbox_faux"},
    {"event_type": "click", "target_selector": "INPUT#checkbox-87", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "CLICK: INPUT#checkbox-87", "metadata": {"value": None}},
    {"event_type": "input", "target_selector": "INPUT#checkbox-87", "target_text": None, "url": "https://my.nmdp.org/s/create-account-medical?language=en_US", "action_description": "FILL_INPUT: INPUT#checkbox-87[Brain_Injury_Concussion_or_Surgery__c]", "metadata": {"value": "true"}},
    {"event_type": "session_end", "target_selector": None, "target_text": None, "url": None},
]

def escape_selector(selector):
    """Escape selector for JavaScript"""
    if not selector:
        return ""
    return selector.replace("'", "\\'").replace('"', '\\"')

def simplify_selector(selector):
    """Simplify selector (e.g., INPUT#checkbox-84 -> #checkbox-84)"""
    if not selector:
        return None
    if selector.startswith("INPUT#"):
        return selector.replace("INPUT#", "#")
    if selector.startswith("INPUT"):
        return selector.replace("INPUT", "")
    return selector

def generate_playwright_script(nodes):
    """Generate Playwright script manually"""
    script_lines = [
        "import { test, expect } from '@playwright/test';",
        "",
        "// Configuration",
        "const ACTION_TIMEOUT = 10000;  // 10 seconds",
        "const NETWORK_TIMEOUT = 3000;  // 3 seconds",
        "",
        "test('Flowstral Recorded Test', async ({ page }) => {"
    ]
    
    # Get initial URL
    initial_url = None
    for node in nodes:
        if node.get("url"):
            initial_url = node["url"]
            break
    
    if initial_url:
        script_lines.append(f"  // Navigate to initial page")
        script_lines.append(f"  await page.goto('{initial_url}');")
        script_lines.append(f"  await page.waitForLoadState('networkidle');")
        script_lines.append("")
    
    step_index = 0
    processed_count = 0
    
    for node in nodes:
        event_type = node.get("event_type")
        
        # Skip internal events
        if event_type in ["session_start", "session_end", "wcag_scan", "dom_snapshot", "page_load"]:
            continue
        
        target_selector = node.get("target_selector")
        target_text = node.get("target_text")
        action_desc = node.get("action_description", "")
        value = node.get("metadata", {}).get("value")
        
        # Generate locator
        if target_selector:
            # Simplify selector
            simplified = simplify_selector(target_selector)
            escaped = escape_selector(simplified or target_selector)
            locator = f"page.locator('{escaped}')"
        elif target_text:
            escaped_text = target_text.replace("'", "\\'")
            locator = f"page.getByText('{escaped_text}')"
        else:
            # Skip if no locator
            continue
        
        # Generate action code
        if event_type == "navigate":
            url = node.get("url")
            if url:
                script_lines.append(f"  // Navigate to: {url}")
                script_lines.append(f"  await page.goto('{url}');")
                script_lines.append(f"  await page.waitForLoadState('networkidle');")
                script_lines.append("")
                processed_count += 1
        
        elif event_type == "click":
            script_lines.append(f"  // Step: Click - {action_desc}")
            script_lines.append(f"  try {{")
            script_lines.append(f"    const element = {locator};")
            script_lines.append(f"    await element.waitFor({{ state: 'visible', timeout: ACTION_TIMEOUT }});")
            script_lines.append(f"    await expect(element).toBeVisible();")
            script_lines.append(f"    await expect(element).toBeEnabled();")
            script_lines.append(f"    await element.click();")
            script_lines.append(f"    // Wait for any side effects")
            script_lines.append(f"    await Promise.race([")
            script_lines.append(f"      page.waitForLoadState('networkidle', {{ timeout: NETWORK_TIMEOUT }}).catch(() => {{}}),")
            script_lines.append(f"      page.waitForTimeout(500)")
            script_lines.append(f"    ]);")
            script_lines.append(f"  }} catch (finalError) {{")
            script_lines.append(f"    await page.screenshot({{ path: `failure-step-{step_index}.png`, fullPage: true }});")
            script_lines.append(f"    throw new Error(`Step {step_index} failed: Could not click element - ${{finalError.message}}`);")
            script_lines.append(f"  }}")
            script_lines.append("")
            step_index += 1
            processed_count += 1
        
        elif event_type in ["input", "type"]:
            input_value = value if value and value != "***MASKED***" else "TEST_VALUE"
            escaped_value = input_value.replace("'", "\\'")
            
            script_lines.append(f"  // Step: Fill - {action_desc}")
            script_lines.append(f"  try {{")
            script_lines.append(f"    const element = {locator};")
            script_lines.append(f"    await element.waitFor({{ state: 'visible', timeout: ACTION_TIMEOUT }});")
            script_lines.append(f"    await expect(element).toBeVisible();")
            script_lines.append(f"    await element.clear();")
            script_lines.append(f"    await element.fill('{escaped_value}');")
            script_lines.append(f"    await expect(element).toHaveValue('{escaped_value}');")
            script_lines.append(f"  }} catch (finalError) {{")
            script_lines.append(f"    await page.screenshot({{ path: `failure-step-{step_index}.png`, fullPage: true }});")
            script_lines.append(f"    throw new Error(`Step {step_index} failed: Could not fill input - ${{finalError.message}}`);")
            script_lines.append(f"  }}")
            script_lines.append("")
            step_index += 1
            processed_count += 1
    
    script_lines.append("});")
    
    return "\n".join(script_lines), processed_count

if __name__ == "__main__":
    print("=" * 80)
    print("EXPECTED PLAYWRIGHT SCRIPT OUTPUT")
    print("=" * 80)
    print()
    
    script, action_count = generate_playwright_script(nodes)
    
    print(script)
    print()
    print("=" * 80)
    print(f"Generated {action_count} actions")
    print("=" * 80)



