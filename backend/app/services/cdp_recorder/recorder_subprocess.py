"""
Standalone Playwright recording subprocess.
This script runs independently from FastAPI to avoid threading/greenlet issues.
It communicates via JSON files.
"""

import json
import sys
import time
import os
import base64
from pathlib import Path
from datetime import datetime

# The recorder script - handles Shadow DOM and uses lower-level events
RECORDER_SCRIPT = """
(() => {
    // Skip if already installed
    if (window.__qaaiRecorderInstalled__) return;
    
    window.__qaaiRecorderInstalled__ = true;
    window.__qaaiRecordedActions__ = [];
    
    console.log('[CDP Recorder] Installing recorder...');
    
    // Helper to get element text/identifier
    function getElementIdentifier(el) {
        if (!el) return 'unknown';
        
        try {
            const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
            if (ariaLabel) return ariaLabel.substring(0, 30);
            
            const title = el.getAttribute && el.getAttribute('title');
            if (title) return title.substring(0, 30);
            
            const placeholder = el.getAttribute && el.getAttribute('placeholder');
            if (placeholder) return placeholder.substring(0, 30);
            
            const name = el.getAttribute && el.getAttribute('name');
            if (name) return name;
            
            // For Lightning components, try to find meaningful text
            const text = el.innerText || el.textContent;
            if (text) {
                const cleanText = text.trim().replace(/\\s+/g, ' ');
                if (cleanText.length > 0 && cleanText.length < 50) {
                    return cleanText.substring(0, 30);
                }
            }
            
            return el.tagName ? el.tagName.toLowerCase() : 'element';
        } catch (e) {
            return 'element';
        }
    }
    
    // Generate selectors for element - handles Shadow DOM
    function generateSelectors(el) {
        if (!el) return [];
        const selectors = [];
        
        try {
            // ID (skip dynamic Salesforce IDs with colons)
            if (el.id && !el.id.includes(':') && !el.id.match(/^\\d/)) {
                selectors.push('#' + el.id);
            }
            
            // Data attributes (common in modern frameworks)
            const testId = el.getAttribute && el.getAttribute('data-testid');
            if (testId) selectors.push('[data-testid="' + testId + '"]');
            
            const dataId = el.getAttribute && el.getAttribute('data-id');
            if (dataId) selectors.push('[data-id="' + dataId + '"]');
            
            const dataKey = el.getAttribute && el.getAttribute('data-key');
            if (dataKey) selectors.push('[data-key="' + dataKey + '"]');
            
            // Name (for form fields)
            const name = el.getAttribute && el.getAttribute('name');
            if (name) selectors.push('[name="' + name + '"]');
            
            // Aria-label
            const ariaLabel = el.getAttribute && el.getAttribute('aria-label');
            if (ariaLabel) selectors.push('[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]');
            
            // Title
            const title = el.getAttribute && el.getAttribute('title');
            if (title && title.length < 50) selectors.push('[title="' + title.replace(/"/g, '\\\\"') + '"]');
            
            // Placeholder
            const placeholder = el.getAttribute && el.getAttribute('placeholder');
            if (placeholder) selectors.push('[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]');
            
            // Type for inputs
            if (el.tagName === 'INPUT') {
                const type = el.getAttribute('type') || 'text';
                selectors.push('input[type="' + type + '"]');
            }
            
            // Text content for clickable elements
            const text = (el.innerText || el.textContent || '').trim();
            if (text && text.length > 0 && text.length < 40) {
                selectors.push('text="' + text.replace(/"/g, '\\\\"').substring(0, 30) + '"');
            }
            
            // Role
            const role = el.getAttribute && el.getAttribute('role');
            if (role) selectors.push('[role="' + role + '"]');
            
            // CSS class (first stable class only)
            if (el.className && typeof el.className === 'string') {
                const classes = el.className.split(' ').filter(function(c) {
                    return c && c.length > 2 && 
                           !c.includes('hover') && !c.includes('focus') && 
                           !c.includes('active') && !c.includes('--');
                });
                if (classes.length > 0) {
                    selectors.push('.' + classes[0]);
                }
            }
        } catch (e) {
            console.log('[CDP Recorder] Selector error:', e);
        }
        
        return selectors;
    }
    
    // Record action
    function recordAction(type, el, value) {
        try {
            const identifier = getElementIdentifier(el);
            const selectors = generateSelectors(el);
            
            let description = '';
            switch(type) {
                case 'click':
                    description = 'Click "' + identifier + '"';
                    break;
                case 'fill':
                    const displayVal = value && value.length > 20 ? value.substring(0, 17) + '...' : (value || '');
                    description = 'Fill ' + identifier + ': "' + displayVal + '"';
                    break;
                case 'select':
                    description = 'Select "' + (value || '') + '" in ' + identifier;
                    break;
                case 'check':
                case 'uncheck':
                    description = type.charAt(0).toUpperCase() + type.slice(1) + ' ' + identifier;
                    break;
                case 'press':
                    description = 'Press ' + (value || 'key');
                    break;
                default:
                    description = type + ' on ' + identifier;
            }
            
            const action = {
                type: type,
                description: description,
                selectors: selectors,
                value: value || null,
                tagName: el && el.tagName ? el.tagName : null,
                timestamp: new Date().toISOString()
            };
            
            window.__qaaiRecordedActions__.push(action);
            console.log('[CDP Recorder] Recorded:', action.description, '| Selectors:', selectors.slice(0, 2).join(', '));
        } catch (e) {
            console.log('[CDP Recorder] Record error:', e);
        }
    }
    
    // Debounce helper
    function debounce(func, wait) {
        var timeout;
        return function() {
            var context = this, args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function() {
                func.apply(context, args);
            }, wait);
        };
    }
    
    // ==================== EVENT HANDLERS ====================
    
    // Track last click to avoid duplicates
    var lastClickTime = 0;
    var lastClickEl = null;
    
    // Click handler using mouseup (more reliable than click for Shadow DOM)
    function handleMouseUp(e) {
        try {
            var el = e.target;
            var now = Date.now();
            
            // Debounce - ignore clicks within 100ms on same element
            if (el === lastClickEl && now - lastClickTime < 100) return;
            lastClickTime = now;
            lastClickEl = el;
            
            // Skip text inputs and textareas (we record fill instead)
            if (el.tagName === 'INPUT') {
                var type = (el.getAttribute('type') || 'text').toLowerCase();
                if (['text', 'password', 'email', 'search', 'tel', 'url', 'number'].indexOf(type) >= 0) {
                    return;
                }
            }
            if (el.tagName === 'TEXTAREA') return;
            
            // Record the click
            recordAction('click', el, null);
        } catch (e) {
            console.log('[CDP Recorder] MouseUp error:', e);
        }
    }
    
    // Input tracking - ONLY record on blur (field exit) to avoid duplicates
    var recordedInputs = new WeakMap();  // Track what we've already recorded
    
    function handleInput(e) {
        // Just track the element, don't record yet
        // Recording happens on blur only
    }
    
    function handleBlur(e) {
        try {
            var el = e.target;
            if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) {
                var lastRecorded = recordedInputs.get(el);
                // Only record if value changed since last recording
                if (lastRecorded !== el.value) {
                    recordAction('fill', el, el.value);
                    recordedInputs.set(el, el.value);
                }
            }
        } catch (e) {
            console.log('[CDP Recorder] Blur error:', e);
        }
    }
    
    function handleChange(e) {
        try {
            var el = e.target;
            if (el.tagName === 'SELECT') {
                var opt = el.options && el.options[el.selectedIndex];
                recordAction('select', el, opt ? opt.text : el.value);
            } else if (el.tagName === 'INPUT' && el.type === 'checkbox') {
                recordAction(el.checked ? 'check' : 'uncheck', el, null);
            } else if (el.tagName === 'INPUT' && el.type === 'radio') {
                recordAction('check', el, el.value);
            }
        } catch (e) {
            console.log('[CDP Recorder] Change error:', e);
        }
    }
    
    function handleKeyDown(e) {
        try {
            if (e.key === 'Enter') {
                var el = e.target;
                // Record the input value before Enter if not already recorded
                if ((el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && el.value) {
                    var lastRecorded = recordedInputs.get(el);
                    if (lastRecorded !== el.value) {
                        recordAction('fill', el, el.value);
                        recordedInputs.set(el, el.value);
                    }
                }
                recordAction('press', el, 'Enter');
            }
        } catch (e) {
            console.log('[CDP Recorder] KeyDown error:', e);
        }
    }
    
    // ==================== ATTACH EVENT LISTENERS ====================
    
    // Use capture phase on window (catches more events)
    window.addEventListener('mouseup', handleMouseUp, true);
    window.addEventListener('input', handleInput, true);
    window.addEventListener('blur', handleBlur, true);
    window.addEventListener('change', handleChange, true);
    window.addEventListener('keydown', handleKeyDown, true);
    
    // Also listen on document for redundancy
    document.addEventListener('mouseup', handleMouseUp, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('blur', handleBlur, true);
    document.addEventListener('change', handleChange, true);
    document.addEventListener('keydown', handleKeyDown, true);
    
    // ==================== SHADOW DOM SUPPORT ====================
    
    // Recursively add listeners to shadow roots
    function addListenersToShadowRoots(root) {
        try {
            // Find all elements with shadow roots
            var elements = root.querySelectorAll('*');
            for (var i = 0; i < elements.length; i++) {
                var el = elements[i];
                if (el.shadowRoot && !el.shadowRoot.__qaaiListenersAdded__) {
                    el.shadowRoot.__qaaiListenersAdded__ = true;
                    
                    el.shadowRoot.addEventListener('mouseup', handleMouseUp, true);
                    el.shadowRoot.addEventListener('input', handleInput, true);
                    el.shadowRoot.addEventListener('blur', handleBlur, true);
                    el.shadowRoot.addEventListener('change', handleChange, true);
                    el.shadowRoot.addEventListener('keydown', handleKeyDown, true);
                    
                    // Recurse into shadow root
                    addListenersToShadowRoots(el.shadowRoot);
                }
            }
        } catch (e) {
            // Shadow root access might be restricted
        }
    }
    
    // Initial scan for shadow roots (after DOM is ready)
    function initShadowRootScanning() {
        try {
            addListenersToShadowRoots(document);
            
            // Watch for new shadow roots via MutationObserver
            var targetNode = document.body || document.documentElement;
            if (targetNode) {
                var shadowObserver = new MutationObserver(function(mutations) {
                    addListenersToShadowRoots(document);
                });
                
                shadowObserver.observe(targetNode, {
                    childList: true,
                    subtree: true
                });
                console.log('[CDP Recorder] MutationObserver attached');
            }
        } catch (e) {
            console.log('[CDP Recorder] Shadow init warning:', e.message);
        }
    }
    
    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initShadowRootScanning);
    } else {
        initShadowRootScanning();
    }
    
    // ==================== API FUNCTIONS ====================
    
    window.__qaaiGetActions__ = function() {
        var actions = window.__qaaiRecordedActions__.slice();
        window.__qaaiRecordedActions__ = [];
        return actions;
    };
    
    window.__qaaiRecorderReady__ = function() {
        return true;
    };
    
    console.log('[CDP Recorder] Recorder installed successfully!');
    console.log('[CDP Recorder] Shadow DOM support enabled. Listening on window, document, and shadow roots.');
})();
"""


def main():
    if len(sys.argv) < 3:
        print("Usage: recorder_subprocess.py <session_id> <actions_file> [user_data_dir] [start_url]", flush=True)
        sys.exit(1)
    
    session_id = sys.argv[1]
    actions_file = sys.argv[2]
    user_data_dir = sys.argv[3] if len(sys.argv) > 3 and sys.argv[3] else None
    start_url = sys.argv[4] if len(sys.argv) > 4 else "about:blank"
    
    print(f"[Recorder] ========================================", flush=True)
    print(f"[Recorder] Starting session: {session_id}", flush=True)
    print(f"[Recorder] Actions file: {actions_file}", flush=True)
    print(f"[Recorder] User data dir: {user_data_dir}", flush=True)
    print(f"[Recorder] Start URL: {start_url}", flush=True)
    print(f"[Recorder] ========================================", flush=True)
    
    # Import playwright here (in subprocess)
    from playwright.sync_api import sync_playwright
    
    # Initialize actions file
    state = {
        "session_id": session_id,
        "status": "starting",
        "actions": [],
        "current_url": start_url,
        "screenshot": None,
        "app_type": "generic",
        "error": None
    }
    write_state(actions_file, state)
    
    try:
        with sync_playwright() as p:
            print(f"[Recorder] Launching browser...", flush=True)
            
            # Run with VISIBLE browser window for full interaction and MFA support
            if user_data_dir:
                context = p.chromium.launch_persistent_context(
                    user_data_dir,
                    headless=False,  # Visible browser for MFA and interaction
                    viewport={"width": 1280, "height": 720},
                    args=[
                        "--disable-blink-features=AutomationControlled",
                        "--start-maximized",
                    ]
                )
                page = context.pages[0] if context.pages else context.new_page()
            else:
                browser = p.chromium.launch(
                    headless=False,  # Visible browser
                    args=[
                        "--disable-blink-features=AutomationControlled",
                    ]
                )
                context = browser.new_context(viewport={"width": 1280, "height": 720})
                page = context.new_page()
            
            print(f"[Recorder] Browser launched", flush=True)
            
            # Inject recording script BEFORE any page loads using add_init_script
            print(f"[Recorder] Adding init script for recorder...", flush=True)
            context.add_init_script(RECORDER_SCRIPT)
            
            # Navigate to start URL
            if start_url and start_url != "about:blank":
                print(f"[Recorder] Navigating to {start_url}", flush=True)
                page.goto(start_url, wait_until="domcontentloaded", timeout=60000)
                
                # Also inject manually for current page
                try:
                    page.evaluate(RECORDER_SCRIPT)
                    print(f"[Recorder] Script injected into current page", flush=True)
                except Exception as e:
                    print(f"[Recorder] Script injection warning: {e}", flush=True)
            
            state["status"] = "recording"
            state["current_url"] = page.url
            state["app_type"] = detect_app_type(page)
            write_state(actions_file, state)
            
            print(f"[Recorder] Recording started at {page.url}", flush=True)
            print(f"[Recorder] App type: {state['app_type']}", flush=True)
            print(f"[Recorder] Interact with the browser - actions will be recorded!", flush=True)
            
            # Track last URL and action count for smart screenshots
            last_url = page.url
            last_action_count = 0
            
            # Take initial screenshot (once, no flicker)
            try:
                screenshot_bytes = page.screenshot(type="jpeg", quality=70)
                state["screenshot"] = base64.b64encode(screenshot_bytes).decode()
                write_state(actions_file, state)
                print(f"[Recorder] Initial screenshot captured", flush=True)
            except Exception as e:
                print(f"[Recorder] Initial screenshot error: {e}", flush=True)
            
            # Main recording loop
            while True:
                try:
                    # Check for stop signal
                    current_state = read_state(actions_file)
                    if current_state and current_state.get("status") == "stopping":
                        print("[Recorder] Stop signal received", flush=True)
                        break
                    
                    # Detect navigation
                    try:
                        current_url = page.url
                        if current_url != last_url:
                            print(f"[Recorder] Navigation: {current_url}", flush=True)
                            state["actions"].append({
                                "type": "navigate",
                                "url": current_url,
                                "description": f"Navigate to {current_url[:60]}",
                                "timestamp": datetime.now().isoformat(),
                                "selectors": []
                            })
                            last_url = current_url
                            state["current_url"] = current_url
                            state["app_type"] = detect_app_type(page)
                            
                            # Re-inject recorder after navigation
                            time.sleep(0.5)
                            try:
                                page.evaluate(RECORDER_SCRIPT)
                            except:
                                pass
                            
                            # Screenshot on navigation (captures new page state)
                            time.sleep(0.3)  # Brief wait for page to render
                            try:
                                screenshot_bytes = page.screenshot(type="jpeg", quality=70)
                                state["screenshot"] = base64.b64encode(screenshot_bytes).decode()
                            except:
                                pass
                            
                            write_state(actions_file, state)
                    except:
                        pass
                    
                    # Check for page analysis request
                    if current_state and current_state.get("analyze_request"):
                        print("[Recorder] Page analysis requested...", flush=True)
                        try:
                            analysis = analyze_page_elements(page)
                            state["page_analysis"] = analysis
                            state["analyze_request"] = False
                            write_state(actions_file, state)
                            print(f"[Recorder] Analysis complete: {len(analysis.get('suggestedActions', []))} actions found", flush=True)
                        except Exception as e:
                            print(f"[Recorder] Analysis error: {e}", flush=True)
                            state["analyze_request"] = False
                            write_state(actions_file, state)
                    
                    # Handle pending click from UI
                    if current_state and current_state.get("pending_click"):
                        click_data = current_state["pending_click"]
                        x, y = click_data.get("x", 0), click_data.get("y", 0)
                        print(f"[Recorder] Clicking at ({x}, {y})", flush=True)
                        try:
                            page.mouse.click(x, y)
                            # Clear the pending click in our state
                            current_state["pending_click"] = None
                            write_state(actions_file, current_state)
                        except Exception as e:
                            print(f"[Recorder] Click error: {e}", flush=True)
                    
                    # Handle pending type from UI
                    if current_state and current_state.get("pending_type"):
                        type_data = current_state["pending_type"]
                        text = type_data.get("text")
                        key = type_data.get("key")
                        if text:
                            print(f"[Recorder] Typing: {text[:20]}...", flush=True)
                            try:
                                page.keyboard.type(text, delay=30)  # Slight delay for reliability
                            except Exception as e:
                                print(f"[Recorder] Type error: {e}", flush=True)
                        elif key:
                            print(f"[Recorder] Pressing key: {key}", flush=True)
                            try:
                                page.keyboard.press(key)
                            except Exception as e:
                                print(f"[Recorder] Key error: {e}", flush=True)
                        # Clear pending type
                        current_state["pending_type"] = None
                        write_state(actions_file, current_state)
                    
                    # Handle pending key press from UI
                    if current_state and current_state.get("pending_key"):
                        key = current_state["pending_key"]
                        print(f"[Recorder] Pressing key: {key}", flush=True)
                        try:
                            page.keyboard.press(key)
                        except Exception as e:
                            print(f"[Recorder] Key error: {e}", flush=True)
                        # Clear pending key
                        current_state["pending_key"] = None
                        write_state(actions_file, current_state)
                    
                    # Poll for new actions
                    try:
                        new_actions = page.evaluate("() => window.__qaaiGetActions__ ? window.__qaaiGetActions__() : []")
                        
                        if new_actions and len(new_actions) > 0:
                            for action in new_actions:
                                state["actions"].append({
                                    "type": action.get("type", "click"),
                                    "description": action.get("description", "Unknown"),
                                    "selectors": action.get("selectors", []),
                                    "value": action.get("value"),
                                    "url": page.url,
                                    "timestamp": datetime.now().isoformat()
                                })
                                print(f"[Recorder] +Action: {action.get('description', 'unknown')[:60]}", flush=True)
                            
                            # Screenshot ONLY when new actions are recorded (NO FLICKER!)
                            # This means screenshot is taken once per user action, not continuously
                            try:
                                screenshot_bytes = page.screenshot(type="jpeg", quality=70)
                                state["screenshot"] = base64.b64encode(screenshot_bytes).decode()
                            except:
                                pass
                            
                            write_state(actions_file, state)
                    except Exception as e:
                        # Page might be navigating
                        pass
                    
                    # Only write state periodically, NOT screenshot
                    current_action_count = len(state.get("actions", []))
                    if current_action_count != last_action_count:
                        last_action_count = current_action_count
                        write_state(actions_file, state)
                    
                    time.sleep(0.5)  # Poll every 500ms for action capture
                    
                except Exception as e:
                    print(f"[Recorder] Loop error: {e}", flush=True)
                    time.sleep(1)
            
            # Recording stopped
            state["status"] = "stopped"
            write_state(actions_file, state)
            
            print(f"[Recorder] Stopped. Total: {len(state['actions'])} actions", flush=True)
            
            # Close browser
            if user_data_dir:
                context.close()
            else:
                browser.close()
                
    except Exception as e:
        print(f"[Recorder] FATAL: {e}", flush=True)
        import traceback
        traceback.print_exc()
        state["status"] = "error"
        state["error"] = str(e)
        write_state(actions_file, state)
        sys.exit(1)


def write_state(filepath: str, state: dict):
    """Write state to JSON file atomically."""
    try:
        temp_file = filepath + ".tmp"
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False)
        os.replace(temp_file, filepath)
    except Exception as e:
        print(f"[Recorder] Write error: {e}", flush=True)


def read_state(filepath: str) -> dict:
    """Read state from JSON file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except:
        return None


def detect_app_type(page) -> str:
    """Detect the application type."""
    try:
        return page.evaluate("""() => {
            const url = window.location.href.toLowerCase();
            if (url.includes('salesforce') || url.includes('.force.com') || 
                document.querySelector('lightning-primitive-icon, one-app-nav-bar, aura-component')) {
                return 'salesforce';
            }
            if (url.includes('servicenow')) return 'servicenow';
            if (url.includes('workday')) return 'workday';
            if (url.includes('oracle')) return 'oracle';
            if (url.includes('sap.com')) return 'sap';
            return 'generic';
        }""")
    except:
        return "generic"


def analyze_page_elements(page) -> dict:
    """
    Analyze current page and find interactive elements.
    Returns suggested actions similar to browser extension's Suggest tab.
    """
    try:
        # Run page analysis script
        result = page.evaluate("""() => {
            const results = {
                url: window.location.href,
                title: document.title,
                appType: 'generic',
                elements: [],
                suggestedActions: []
            };
            
            // Detect app type
            const url = window.location.href.toLowerCase();
            if (url.includes('salesforce') || url.includes('.force.com')) {
                results.appType = 'salesforce';
            } else if (url.includes('servicenow')) {
                results.appType = 'servicenow';
            } else if (url.includes('workday')) {
                results.appType = 'workday';
            }
            
            // Helper to generate selectors
            function getSelectors(el) {
                const selectors = [];
                
                if (el.id && !el.id.includes(':')) {
                    selectors.push({strategy: 'id', value: '#' + el.id, confidence: 0.95});
                }
                
                const testId = el.getAttribute('data-testid');
                if (testId) {
                    selectors.push({strategy: 'testid', value: '[data-testid="' + testId + '"]', confidence: 0.95});
                }
                
                const name = el.getAttribute('name');
                if (name) {
                    selectors.push({strategy: 'name', value: '[name="' + name + '"]', confidence: 0.9});
                }
                
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel) {
                    selectors.push({strategy: 'aria', value: '[aria-label="' + ariaLabel.replace(/"/g, '\\\\"') + '"]', confidence: 0.85});
                }
                
                const title = el.getAttribute('title');
                if (title && title.length < 50) {
                    selectors.push({strategy: 'title', value: '[title="' + title.replace(/"/g, '\\\\"') + '"]', confidence: 0.85});
                }
                
                const placeholder = el.getAttribute('placeholder');
                if (placeholder) {
                    selectors.push({strategy: 'placeholder', value: '[placeholder="' + placeholder.replace(/"/g, '\\\\"') + '"]', confidence: 0.8});
                }
                
                const text = (el.innerText || el.textContent || '').trim();
                if (text && text.length > 0 && text.length < 40) {
                    selectors.push({strategy: 'text', value: 'text="' + text.substring(0, 30).replace(/"/g, '\\\\"') + '"', confidence: 0.75});
                }
                
                const role = el.getAttribute('role');
                if (role) {
                    selectors.push({strategy: 'role', value: '[role="' + role + '"]', confidence: 0.7});
                }
                
                return selectors.sort((a, b) => b.confidence - a.confidence);
            }
            
            // Helper to get element name
            function getElementName(el) {
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel) return ariaLabel.substring(0, 40);
                
                const title = el.getAttribute('title');
                if (title) return title.substring(0, 40);
                
                const placeholder = el.getAttribute('placeholder');
                if (placeholder) return placeholder.substring(0, 40);
                
                const text = (el.innerText || el.textContent || '').trim();
                if (text && text.length < 50) return text.substring(0, 40);
                
                const name = el.getAttribute('name');
                if (name) return name;
                
                return el.tagName.toLowerCase();
            }
            
            // Find clickable elements
            const clickables = document.querySelectorAll('button, a, [role="button"], [onclick], .slds-button, lightning-button');
            clickables.forEach((el, index) => {
                if (index > 20) return; // Limit to 20 clickables
                if (!el.offsetParent && el.offsetWidth === 0) return; // Skip invisible
                
                const name = getElementName(el);
                const selectors = getSelectors(el);
                
                if (selectors.length > 0) {
                    results.suggestedActions.push({
                        type: 'click',
                        name: 'Click "' + name + '"',
                        elementType: el.tagName.toLowerCase(),
                        selectors: selectors
                    });
                }
            });
            
            // Find input fields
            const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"], input[type="search"], input[type="tel"], input[type="url"], input:not([type]), textarea');
            inputs.forEach((el, index) => {
                if (index > 15) return; // Limit to 15 inputs
                if (!el.offsetParent && el.offsetWidth === 0) return; // Skip invisible
                
                const name = getElementName(el);
                const selectors = getSelectors(el);
                
                if (selectors.length > 0) {
                    results.suggestedActions.push({
                        type: 'fill',
                        name: 'Fill "' + name + '"',
                        elementType: el.tagName.toLowerCase(),
                        selectors: selectors
                    });
                }
            });
            
            // Find select dropdowns
            const selects = document.querySelectorAll('select, [role="combobox"], [role="listbox"]');
            selects.forEach((el, index) => {
                if (index > 10) return;
                if (!el.offsetParent && el.offsetWidth === 0) return;
                
                const name = getElementName(el);
                const selectors = getSelectors(el);
                
                if (selectors.length > 0) {
                    results.suggestedActions.push({
                        type: 'select',
                        name: 'Select in "' + name + '"',
                        elementType: el.tagName.toLowerCase(),
                        selectors: selectors
                    });
                }
            });
            
            // Find checkboxes/radios
            const checkables = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
            checkables.forEach((el, index) => {
                if (index > 10) return;
                
                const name = getElementName(el) || el.getAttribute('value') || 'checkbox';
                const selectors = getSelectors(el);
                
                if (selectors.length > 0) {
                    results.suggestedActions.push({
                        type: 'check',
                        name: 'Check "' + name + '"',
                        elementType: el.type,
                        selectors: selectors
                    });
                }
            });
            
            // Add Salesforce-specific elements
            if (results.appType === 'salesforce') {
                // Lightning tabs
                const tabs = document.querySelectorAll('lightning-tab-bar a, .slds-tabs_default__item a');
                tabs.forEach((el, index) => {
                    if (index > 10) return;
                    const name = getElementName(el);
                    const selectors = getSelectors(el);
                    
                    if (selectors.length > 0) {
                        results.suggestedActions.push({
                            type: 'click',
                            name: 'Click Tab "' + name + '"',
                            elementType: 'tab',
                            selectors: selectors
                        });
                    }
                });
                
                // Record actions (Edit, Delete, etc)
                const recordActions = document.querySelectorAll('[data-target-selection-name*="Edit"], [title*="Edit"], [title*="Delete"], [title*="New"]');
                recordActions.forEach((el, index) => {
                    if (index > 10) return;
                    const name = getElementName(el);
                    const selectors = getSelectors(el);
                    
                    if (selectors.length > 0 && !results.suggestedActions.some(a => a.name.includes(name))) {
                        results.suggestedActions.push({
                            type: 'click',
                            name: 'Click "' + name + '"',
                            elementType: 'action',
                            selectors: selectors
                        });
                    }
                });
            }
            
            return results;
        }""")
        
        return result
        
    except Exception as e:
        print(f"[Recorder] Page analysis error: {e}", flush=True)
        return {
            "url": page.url,
            "title": "",
            "appType": detect_app_type(page),
            "elements": [],
            "suggestedActions": []
        }


if __name__ == "__main__":
    main()
