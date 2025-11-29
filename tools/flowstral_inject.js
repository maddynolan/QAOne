// Flowstral Auto-Injection Script
// This script is loaded on pages after navigation to re-inject Flowstral

(function() {
    // Prevent double injection
    if (window.flowstralPanelInjected) {
        console.log('Flowstral: Panel already injected');
        return;
    }
    window.flowstralPanelInjected = true;
    
    console.log('Flowstral: Injection script loaded');
    
    console.log('Flowstral: Starting auto-injection...');
    
    // Check for saved session
    const saved = sessionStorage.getItem('flowstral_session');
    if (!saved) {
        console.log('Flowstral: No saved session found');
        return;
    }
    
    let sessionData;
    try {
        sessionData = JSON.parse(saved);
    } catch (e) {
        console.error('Flowstral: Failed to parse session data', e);
        return;
    }
    
    if (!sessionData.isActive || !sessionData.sessionId) {
        console.log('Flowstral: Session not active');
        return;
    }
    
    // Create Flowstral panel
    const panel = document.createElement('div');
    panel.id = 'flowstral-panel';
    panel.style.cssText = 'position:fixed;top:10px;right:10px;width:400px;background:white;border:2px solid #4CAF50;border-radius:12px;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:999999;max-height:90vh;overflow-y:auto;font-family:Arial,sans-serif;';
    
    panel.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;padding-bottom:15px;border-bottom:2px solid #e0e0e0;">
            <div style="font-size:24px;font-weight:bold;color:#4CAF50;">⭐ Flowstral</div>
            <div id="flowstral-status" style="padding:6px 12px;border-radius:20px;font-size:12px;font-weight:bold;background:#e8f5e9;color:#2e7d32;">🔴 Active</div>
        </div>
        <div style="margin-bottom:15px;">
            <div style="font-size:12px;color:#666;margin-bottom:10px;">
                ✅ Flowstral reconnected! Continue recording...
            </div>
            <div style="font-size:11px;color:#999;">
                Session: ${sessionData.sessionId.substring(0, 8)}...
            </div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:15px;">
            <button id="flowstral-stop-btn" style="flex:1;padding:12px;background:#f44336;color:white;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">⏹ Stop</button>
        </div>
        <div style="font-size:11px;color:#666;padding:10px;background:#f9f9f9;border-radius:4px;">
            <strong>Stats:</strong><br>
            Nodes: <span id="flowstral-nodes">${sessionData.nodes?.length || 0}</span>
        </div>
    `;
    
    document.body.appendChild(panel);
    
    // Set up event listeners
    let eventListeners = [];
    
    const clickHandler = async (e) => {
        if (!sessionData.isActive) return;
        console.log('Flowstral: Click captured', e.target);
        await captureEvent('click', e, sessionData);
    };
    
    const inputHandler = async (e) => {
        if (!sessionData.isActive) return;
        console.log('Flowstral: Input captured', e.target);
        await captureEvent('input', e, sessionData);
    };
    
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('input', inputHandler, true);
    eventListeners.push({type: 'click', handler: clickHandler});
    eventListeners.push({type: 'input', handler: inputHandler});
    
    // Stop button handler
    document.getElementById('flowstral-stop-btn').addEventListener('click', async () => {
        try {
            const apiEndpoint = sessionData.apiEndpoint.replace('/start', '/stop');
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(sessionData.apiKey ? {'Authorization': sessionData.apiKey.startsWith('Bearer ') ? sessionData.apiKey : `Bearer ${sessionData.apiKey}`} : {})
                },
                body: JSON.stringify({
                    session_id: sessionData.sessionId,
                    project_id: sessionData.projectId
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                alert(`Flowstral stopped! Generated ${Object.keys(result.artifacts || {}).length} artifacts.`);
                sessionStorage.removeItem('flowstral_session');
                panel.remove();
                eventListeners.forEach(({type, handler}) => {
                    document.removeEventListener(type, handler, true);
                });
            }
        } catch (error) {
            console.error('Flowstral: Stop error', error);
            alert(`Failed to stop: ${error.message}`);
        }
    });
    
    // Capture event function
    async function captureEvent(eventType, event, session) {
        const apiEndpoint = session.apiEndpoint.replace('/start', '/capture-event');
        const element = event.target;
        
        // Generate selector
        function generateSelector(el) {
            if (!el) return 'unknown';
            if (el.id) return `#${el.id}`;
            if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
            if (el.name) return `[name="${el.name}"]`;
            if (el.className) {
                const classes = el.className.split(' ').filter(c => c).join('.');
                if (classes) return `${el.tagName.toLowerCase()}.${classes}`;
            }
            return el.tagName.toLowerCase();
        }
        
        const eventData = {
            html: document.documentElement.outerHTML.substring(0, 50000),
            url: window.location.href,
            interacted_element: element ? {
                tag_name: element.tagName,
                id: element.id,
                class_name: element.className,
                text_content: element.textContent?.substring(0, 100),
                selector: generateSelector(element)
            } : null,
            action_description: `${eventType}: ${element ? (element.tagName + (element.id ? '#' + element.id : '')) : 'unknown'}`,
            value: eventType === 'input' && element ? element.value : undefined,
            page_metrics: { lcp: 0, fcp: 0, cls: 0 }
        };
        
        try {
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session.apiKey ? {'Authorization': session.apiKey.startsWith('Bearer ') ? session.apiKey : `Bearer ${session.apiKey}`} : {})
                },
                body: JSON.stringify({
                    session_id: session.sessionId,
                    event_type: eventType,
                    event_data: eventData
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Flowstral: Event captured successfully', result);
                session.nodes = session.nodes || [];
                if (result.result && result.result.node_id) {
                    session.nodes.push(result.result.node_id);
                }
                const nodesEl = document.getElementById('flowstral-nodes');
                if (nodesEl) {
                    nodesEl.textContent = session.nodes.length;
                }
            } else {
                const errorText = await response.text();
                console.error('Flowstral: Capture failed', response.status, errorText);
            }
        } catch (error) {
            console.error('Flowstral: Capture error', error);
        }
    }
    
    console.log('Flowstral: Panel injected and event listeners attached!');
    console.log('Flowstral: Ready to capture events. Click around to test!');
})();

