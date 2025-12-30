# Quick fix script - run this to patch your test file
# Usage: python quick_fix_test.py your_test_file.py
#
# ROBUST FIXES FOR SALESFORCE:
# 1. Adds no_wait_after=True, timeout=10000 to all clicks
# 2. Replaces wait_for_page_ready with quick pause  
# 3. Adds wait_for(state="visible") before fill/type actions
# 4. Adds smart wait for App Launcher modal + robust selectors
# 5. Adds Salesforce-specific fallback selectors

import sys
import re

if len(sys.argv) < 2:
    print("Usage: python quick_fix_test.py <test_file.py>")
    sys.exit(1)

test_file = sys.argv[1]

with open(test_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Add no_wait_after=True and timeout=10000 to clicks
content = re.sub(
    r'\.click\(force=True\)(\s*\n\s*wait_for_page_ready\(page\))?',
    '.click(force=True, no_wait_after=True, timeout=10000)\n    page.wait_for_timeout(500)',
    content
)
content = re.sub(
    r'\.click\(\)(\s*\n\s*wait_for_page_ready\(page\))?',
    '.click(force=True, no_wait_after=True, timeout=10000)\n    page.wait_for_timeout(500)',
    content
)

# Fix 2: Replace wait_for_page_ready calls
content = re.sub(
    r'wait_for_page_ready\(page\)',
    'page.wait_for_timeout(500)',
    content
)

# Fix 3: Find App Launcher search input and add robust handling
# This is the key fix - replace the simple fill with a robust version
app_launcher_search_fix = '''
    # ROBUST: Wait for App Launcher modal and search input
    print("   [+] Waiting for App Launcher modal...")
    _app_launcher_found = False
    for _wait_attempt in range(5):  # Up to 5 attempts
        try:
            # Try different modal selectors
            _modal_selectors = [
                'one-app-launcher-menu',
                'div.slds-modal__content', 
                'section.slds-modal',
                '[role="dialog"]',
            ]
            for _modal in _modal_selectors:
                if page.locator(_modal).count() > 0:
                    page.locator(_modal).first.wait_for(state="visible", timeout=3000)
                    print(f"   [+] Modal found: {_modal}")
                    break
            
            # Now try to find the search input with multiple selectors
            _search_selectors = [
                'input[placeholder*="Search apps"]',
                'input[placeholder*="Search Apps"]',
                'one-app-launcher-menu input[type="search"]',
                'one-app-launcher-menu input',
                '.slds-modal input[type="search"]',
                'input.slds-input[placeholder*="Search"]',
                '[role="searchbox"]',
                'input[type="search"]',
            ]
            for _sel in _search_selectors:
                try:
                    _el = page.locator(_sel)
                    if _el.count() > 0:
                        _el.first.wait_for(state="visible", timeout=2000)
                        _el.first.fill("{SEARCH_VALUE}")
                        _app_launcher_found = True
                        print(f"   [+] Filled search with selector: {_sel}")
                        break
                except:
                    continue
            if _app_launcher_found:
                break
        except:
            pass
        print(f"   [RETRY {_wait_attempt + 1}] Waiting 2s for App Launcher...")
        page.wait_for_timeout(2000)
    
    if not _app_launcher_found:
        raise Exception("App Launcher search input not found")
'''

# Find and replace App Launcher search fill patterns
lines = content.split('\n')
new_lines = []
skip_next_fill = False

for i, line in enumerate(lines):
    # Detect App Launcher search step
    if ('Search apps' in line or 'Search Apps' in line) and ('# Step' in line or 'Fill' in line):
        # Find the value being filled
        search_value = "Accounts"  # default
        for j in range(i, min(i + 10, len(lines))):
            match = re.search(r'\.fill\([\'"]([^\'"]+)[\'"]\)', lines[j])
            if match:
                search_value = match.group(1)
                break
        
        # Add the robust search code
        robust_code = app_launcher_search_fix.replace('{SEARCH_VALUE}', search_value)
        new_lines.append(line)  # Keep the comment
        new_lines.extend(robust_code.split('\n'))
        skip_next_fill = True  # Skip the next fill line since we've handled it
        continue
    
    # Skip the original fill line if we've added robust code
    if skip_next_fill and '.fill(' in line:
        skip_next_fill = False
        continue
    
    new_lines.append(line)

content = '\n'.join(new_lines)

# Fix 4: Add wait_for(state="visible") before generic .fill() calls
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    if '.fill(' in line and 'wait_for' not in line and '_app_launcher_found' not in line:
        prev_line = new_lines[-1] if new_lines else ''
        if 'wait_for' not in prev_line and 'state="visible"' not in prev_line:
            match = re.search(r'(page\.[^.]+(?:\.[^.]+)*?)\.fill\(', line)
            if match:
                selector = match.group(1)
                indent = len(line) - len(line.lstrip())
                spaces = ' ' * indent
                new_lines.append(f'{spaces}# Wait for input to be visible')
                new_lines.append(f'{spaces}try:')
                new_lines.append(f'{spaces}    {selector}.wait_for(state="visible", timeout=5000)')
                new_lines.append(f'{spaces}except:')
                new_lines.append(f'{spaces}    pass')
    new_lines.append(line)

content = '\n'.join(new_lines)

# Fix 5: Add wait after App Launcher click (waffle icon)
content = re.sub(
    r"(\.locator\(['\"][^'\"]*waffle[^'\"]*['\"].*?\.click\([^)]*\))",
    r'\1\n    # Wait for App Launcher modal to open\n    page.wait_for_timeout(3000)',
    content,
    flags=re.IGNORECASE
)

with open(test_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"✅ Fixed: {test_file}")
print("Changes made:")
print("  ✓ Added no_wait_after=True, timeout=10000 to clicks")
print("  ✓ Replaced wait_for_page_ready with quick pause")
print("  ✓ Added wait_for(state='visible') before fill actions")
print("  ✓ Added ROBUST App Launcher search with multiple fallback selectors")
print("  ✓ Added 3s wait after App Launcher (waffle) click")
print("")
print("Run your test again!")
