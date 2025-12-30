# CDP-Based Recorder Architecture (No Extension Required)

## How Enterprise Tools Work Without Browser Extensions

### 1. **Tricentis Tosca**
- **Desktop Agent**: Installed application that launches browsers with debugging enabled
- **CDP Connection**: Connects via Chrome DevTools Protocol (CDP) port 9222
- **DOM Scanner**: Injects JavaScript via `Runtime.evaluate` for element discovery
- **Screen Capture**: Uses CDP's `Page.captureScreenshot` for visual validation

### 2. **Testim.io**
- **Controlled Browser Launch**: Opens Chrome/Edge with `--remote-debugging-port`
- **WebSocket CDP**: Connects to `ws://localhost:9222/devtools/page/{id}`
- **Smart Locators**: ML model runs in their cloud, receives DOM snapshots
- **Self-Healing**: Stores multiple locator strategies per element

### 3. **Mabl**
- **Cloud Browser Farm**: User interacts with remote browser via their web app
- **Trainer Mode**: WebRTC-style streaming of remote browser to user
- **All Recording Server-Side**: No local browser control needed

### 4. **Provar (Salesforce-specific)**
- **Eclipse Desktop App**: Java application that controls browser
- **Selenium + CDP**: Uses WebDriver with CDP extensions
- **Salesforce Metadata API**: Pulls field definitions, validation rules
- **Object Repository**: Stores Salesforce component patterns

### 5. **Copado Robotic Testing**
- **Browser-in-Browser**: Embeds controlled browser in their web UI
- **Cloud Execution**: Tests run on their managed infrastructure
- **Salesforce-Native**: Deep integration with Salesforce metadata

---

## Our Implementation Options

### Option A: CDP Web Recorder (Recommended)
**No extension needed - works in any browser**

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Web UI        │────▶│  Backend Server  │────▶│  CDP Browser    │
│   (React)       │◀────│  (Python/FastAPI)│◀────│  (Playwright)   │
└─────────────────┘     └──────────────────┘     └─────────────────┘
      │                        │                        │
      │  WebSocket             │  CDP/WebSocket         │
      │  (live view)           │  (control)             │  Target App
      ▼                        ▼                        ▼
   User sees              Records all              Salesforce
   live browser           interactions             (or any app)
```

**How it works:**
1. User clicks "Start Recording" in web UI
2. Backend launches Playwright browser with CDP enabled
3. Backend injects recording script via CDP
4. User interacts with the browser window
5. All clicks/inputs captured via injected event listeners
6. Events sent to backend via CDP → stored as test steps
7. Live DOM snapshots sent to UI for visual feedback

### Option B: Desktop Electron App
**Full OS-level control like Tosca**

```
┌─────────────────────────────────────────────┐
│           Electron Desktop App              │
│  ┌─────────────┐    ┌─────────────────────┐│
│  │  Web UI     │    │  Embedded Chromium  ││
│  │  (React)    │───▶│  (Full CDP Control) ││
│  └─────────────┘    └─────────────────────┘│
│         │                    │              │
│         ▼                    ▼              │
│   Recording        Target Application       │
│   Controls         (Salesforce, etc.)       │
└─────────────────────────────────────────────┘
```

### Option C: Proxy-Based Recording
**Works with ANY browser without launching new one**

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  User's     │────▶│  MITM Proxy      │────▶│  Target App     │
│  Browser    │◀────│  (mitmproxy)     │◀────│  (Salesforce)   │
└─────────────┘     └──────────────────┘     └─────────────────┘
                           │
                           │ Injects recording JS
                           │ Captures all traffic
                           ▼
                    ┌──────────────────┐
                    │  Backend Server  │
                    │  (Records steps) │
                    └──────────────────┘
```

---

## Recommended: Option A - CDP Web Recorder

### Implementation Plan

#### Phase 1: Core CDP Recorder Service (2-3 days)

```python
# backend/app/services/cdp_recorder/recorder_service.py

from playwright.async_api import async_playwright
import asyncio
import json

class CDPRecorderService:
    """
    Browser recorder that uses CDP - no extension required.
    Similar to how Testim/Mabl work.
    """
    
    def __init__(self):
        self.playwright = None
        self.browser = None
        self.context = None
        self.page = None
        self.recorded_actions = []
        self.recording = False
        
    async def start_session(self, start_url: str, headless: bool = False):
        """Launch browser with CDP enabled and inject recorder."""
        self.playwright = await async_playwright().start()
        
        # Launch with CDP enabled (like Testim does)
        self.browser = await self.playwright.chromium.launch(
            headless=headless,
            args=[
                '--remote-debugging-port=0',  # Auto-assign port
                '--disable-blink-features=AutomationControlled',
            ]
        )
        
        # Create persistent context (remembers MFA like Provar)
        self.context = await self.browser.new_context(
            viewport={'width': 1280, 'height': 720},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        )
        
        self.page = await self.context.new_page()
        
        # Inject recording script via CDP (like Tosca Scanner)
        await self._inject_recorder()
        
        # Navigate to start URL
        await self.page.goto(start_url)
        
        return {
            'session_id': id(self),
            'cdp_url': self.browser.contexts[0].pages[0].url,
        }
    
    async def _inject_recorder(self):
        """Inject recording script that captures all user interactions."""
        recorder_script = '''
        (() => {
            if (window.__qaaiRecorder__) return;
            
            window.__qaaiRecorder__ = {
                actions: [],
                
                getSelector: (el) => {
                    // Smart selector generation (like Testim Smart Locators)
                    const selectors = [];
                    
                    // Priority 1: ID
                    if (el.id) selectors.push({ type: 'id', value: `#${el.id}`, score: 100 });
                    
                    // Priority 2: data-testid / data-qa
                    if (el.dataset.testid) selectors.push({ type: 'testid', value: `[data-testid="${el.dataset.testid}"]`, score: 95 });
                    if (el.dataset.qa) selectors.push({ type: 'qa', value: `[data-qa="${el.dataset.qa}"]`, score: 95 });
                    
                    // Priority 3: Salesforce Lightning selectors
                    if (el.dataset.auraRenderedBy) {
                        const component = el.closest('[data-component-id]');
                        if (component) selectors.push({ type: 'sf-component', value: `[data-component-id="${component.dataset.componentId}"]`, score: 90 });
                    }
                    
                    // Priority 4: Name attribute
                    if (el.name) selectors.push({ type: 'name', value: `[name="${el.name}"]`, score: 85 });
                    
                    // Priority 5: Aria label
                    if (el.getAttribute('aria-label')) selectors.push({ type: 'aria', value: `[aria-label="${el.getAttribute('aria-label')}"]`, score: 80 });
                    
                    // Priority 6: Text content (for buttons/links)
                    if (el.textContent?.trim() && el.textContent.length < 50) {
                        selectors.push({ type: 'text', value: `text="${el.textContent.trim()}"`, score: 70 });
                    }
                    
                    // Priority 7: CSS path
                    selectors.push({ type: 'css', value: this.getCssPath(el), score: 50 });
                    
                    return selectors.sort((a, b) => b.score - a.score);
                },
                
                getCssPath: (el) => {
                    const path = [];
                    while (el && el.nodeType === 1) {
                        let selector = el.tagName.toLowerCase();
                        if (el.className) {
                            const classes = el.className.split(' ').filter(c => c && !c.includes('--')).slice(0, 2);
                            if (classes.length) selector += '.' + classes.join('.');
                        }
                        path.unshift(selector);
                        el = el.parentElement;
                        if (path.length > 4) break;
                    }
                    return path.join(' > ');
                },
                
                record: (action) => {
                    action.timestamp = Date.now();
                    action.url = window.location.href;
                    this.actions.push(action);
                    
                    // Send to parent via CDP message
                    window.__qaaiSendAction__(action);
                },
                
                init: () => {
                    // Click handler
                    document.addEventListener('click', (e) => {
                        const el = e.target;
                        this.record({
                            type: 'click',
                            selectors: this.getSelector(el),
                            tagName: el.tagName,
                            text: el.textContent?.slice(0, 100),
                            position: { x: e.clientX, y: e.clientY }
                        });
                    }, true);
                    
                    // Input handler
                    document.addEventListener('input', (e) => {
                        const el = e.target;
                        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
                            this.record({
                                type: 'input',
                                selectors: this.getSelector(el),
                                value: el.type === 'password' ? '********' : el.value,
                                inputType: el.type
                            });
                        }
                    }, true);
                    
                    // Select/dropdown handler
                    document.addEventListener('change', (e) => {
                        const el = e.target;
                        if (el.tagName === 'SELECT') {
                            this.record({
                                type: 'select',
                                selectors: this.getSelector(el),
                                value: el.value,
                                text: el.options[el.selectedIndex]?.text
                            });
                        }
                    }, true);
                    
                    console.log('[QAAI Recorder] Initialized via CDP');
                }
            };
            
            window.__qaaiRecorder__.init();
        })();
        '''
        
        # Expose function to receive actions from page
        await self.page.expose_function('__qaaiSendAction__', self._on_action)
        
        # Inject on every navigation
        await self.page.add_init_script(recorder_script)
        
        # Also inject now for current page
        await self.page.evaluate(recorder_script)
    
    async def _on_action(self, action: dict):
        """Receive recorded action from injected script."""
        self.recorded_actions.append(action)
        print(f"[CDP Recorder] Captured: {action['type']} - {action.get('text', '')[:30]}")
    
    async def stop_session(self):
        """Stop recording and return captured actions."""
        actions = self.recorded_actions.copy()
        self.recorded_actions = []
        
        if self.browser:
            await self.browser.close()
        if self.playwright:
            await self.playwright.stop()
            
        return actions
    
    async def get_screenshot(self):
        """Get current page screenshot for live preview."""
        if self.page:
            return await self.page.screenshot(type='png')
        return None
    
    async def get_dom_snapshot(self):
        """Get DOM structure for element explorer (like Tosca Scanner)."""
        if self.page:
            return await self.page.evaluate('''
                () => {
                    function getTree(el, depth = 0) {
                        if (depth > 5) return null;
                        return {
                            tag: el.tagName,
                            id: el.id,
                            classes: el.className,
                            text: el.textContent?.slice(0, 50),
                            children: Array.from(el.children).map(c => getTree(c, depth + 1)).filter(Boolean)
                        };
                    }
                    return getTree(document.body);
                }
            ''')
        return None
```

#### Phase 2: API Endpoints (1 day)

```python
# backend/app/routers/cdp_recorder_api.py

from fastapi import APIRouter, WebSocket
from ..services.cdp_recorder.recorder_service import CDPRecorderService

router = APIRouter(prefix="/cdp-recorder", tags=["CDP Recorder"])

# Global recorder instance (in production, use session management)
recorders = {}

@router.post("/start")
async def start_recording(start_url: str, headless: bool = False):
    """Start a new CDP recording session."""
    recorder = CDPRecorderService()
    session = await recorder.start_session(start_url, headless)
    recorders[session['session_id']] = recorder
    return session

@router.post("/stop/{session_id}")
async def stop_recording(session_id: str):
    """Stop recording and get captured actions."""
    recorder = recorders.get(int(session_id))
    if recorder:
        actions = await recorder.stop_session()
        del recorders[int(session_id)]
        return {"actions": actions, "count": len(actions)}
    return {"error": "Session not found"}

@router.websocket("/live/{session_id}")
async def live_preview(websocket: WebSocket, session_id: str):
    """WebSocket for live screenshot streaming."""
    await websocket.accept()
    recorder = recorders.get(int(session_id))
    
    while recorder:
        screenshot = await recorder.get_screenshot()
        if screenshot:
            await websocket.send_bytes(screenshot)
        await asyncio.sleep(0.5)  # 2 FPS preview
```

#### Phase 3: Web UI for CDP Recorder (1-2 days)

```tsx
// src/pages/CDPRecorder.tsx

import React, { useState, useEffect, useRef } from 'react';

export function CDPRecorder() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [actions, setActions] = useState([]);
  const previewRef = useRef<HTMLImageElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startRecording = async () => {
    const url = prompt('Enter starting URL:', 'https://login.salesforce.com');
    if (!url) return;
    
    const response = await fetch('/cdp-recorder/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start_url: url, headless: false })
    });
    
    const session = await response.json();
    setSessionId(session.session_id);
    setRecording(true);
    
    // Connect to live preview WebSocket
    wsRef.current = new WebSocket(`ws://localhost:8000/cdp-recorder/live/${session.session_id}`);
    wsRef.current.onmessage = (event) => {
      if (previewRef.current && event.data instanceof Blob) {
        previewRef.current.src = URL.createObjectURL(event.data);
      }
    };
  };

  const stopRecording = async () => {
    if (!sessionId) return;
    
    const response = await fetch(`/cdp-recorder/stop/${sessionId}`, { method: 'POST' });
    const result = await response.json();
    
    setActions(result.actions);
    setRecording(false);
    wsRef.current?.close();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">CDP Recorder (No Extension)</h1>
      
      <div className="flex gap-4 mb-6">
        {!recording ? (
          <button onClick={startRecording} className="bg-green-500 text-white px-4 py-2 rounded">
            Start Recording
          </button>
        ) : (
          <button onClick={stopRecording} className="bg-red-500 text-white px-4 py-2 rounded">
            Stop Recording
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-6">
        {/* Live Preview */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Live Preview</h2>
          <img ref={previewRef} className="w-full border" alt="Browser preview" />
        </div>
        
        {/* Recorded Actions */}
        <div className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Recorded Actions ({actions.length})</h2>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {actions.map((action, i) => (
              <div key={i} className="p-2 bg-gray-50 rounded text-sm">
                <span className="font-mono">{action.type}</span>: {action.text || action.value || 'element'}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

## Comparison: Extension vs CDP Approach

| Feature | Browser Extension | CDP Recorder |
|---------|------------------|--------------|
| Installation | User must install extension | None - just visit web app |
| Browser Support | Chrome/Edge only | Any Chromium browser |
| MFA Handling | Tricky - needs persistent context | Easy - browser stays open |
| Cross-Origin | Limited by extension permissions | Full access via CDP |
| Enterprise Deployment | Extension approval needed | No approval needed |
| Live Preview | Requires content script messaging | Native CDP screenshot |
| Salesforce Support | Shadow DOM challenges | Full DOM access via CDP |
| Mobile Testing | Not possible | Use emulation mode |

---

## Implementation Timeline

| Phase | Task | Days |
|-------|------|------|
| 1 | Core CDPRecorderService | 2-3 |
| 2 | API Endpoints + WebSocket | 1 |
| 3 | Web UI with Live Preview | 1-2 |
| 4 | Smart Locator ML Model | 2-3 |
| 5 | Integration with Flowstral Engine | 1 |
| **Total** | | **7-10 days** |

---

## Quick Start Demo

Once implemented, users will:

1. Go to `http://localhost:3000/cdp-recorder`
2. Click "Start Recording"
3. Enter Salesforce URL
4. A new browser window opens (controlled by our backend)
5. User performs test actions in that window
6. See live preview + recorded steps in web UI
7. Click "Stop" → Get generated Playwright test code

**No extension installation. No browser permissions. Works everywhere.**

