// Flowstral Bookmarklet - Inject Flowstral into any website
// To use: Copy this code, create a bookmark, paste as URL, click bookmark on any website

javascript:(function(){
  if (window.flowstralInjected) {
    alert('Flowstral is already running on this page!');
    return;
  }
  window.flowstralInjected = true;
  
  const API_BASE_URL = 'http://localhost:8000';
  let flowstralSession = {
    sessionId: null,
    isActive: false,
    nodes: [],
    playwrightCode: [],
    testSteps: [],
    wcagIssues: [],
    performanceMetrics: []
  };
  
  let eventListeners = [];
  
  // Create Flowstral panel
  const panel = document.createElement('div');
  panel.id = 'flowstral-panel';
  panel.innerHTML = `
    <div style="position: fixed; top: 10px; right: 10px; width: 400px; background: white; border: 2px solid #4CAF50; border-radius: 12px; padding: 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); z-index: 999999; max-height: 90vh; overflow-y: auto; font-family: Arial, sans-serif;">
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding-bottom: 15px; border-bottom: 2px solid #e0e0e0;">
        <div style="font-size: 24px; font-weight: bold; color: #4CAF50;">⭐ Flowstral</div>
        <div id="flowstral-status" style="padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; background: #e8f5e9; color: #2e7d32;">⏹ Stopped</div>
      </div>
      
      <div style="margin-bottom: 15px;">
        <label style="display: block; font-size: 12px; font-weight: 600; margin-bottom: 5px;">Project ID:</label>
        <input type="text" id="flowstral-project-id" placeholder="Enter project ID" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;">
      </div>
      
      <div style="display: flex; gap: 8px; margin-bottom: 15px;">
        <button id="flowstral-start" style="flex: 1; padding: 12px; background: #4CAF50; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;">▶ Start</button>
        <button id="flowstral-stop" style="flex: 1; padding: 12px; background: #f44336; color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer;" disabled>⏹ Stop</button>
      </div>
      
      <div style="margin-bottom: 15px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 5px;">Stats:</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; text-align: center;">
            <div id="flowstral-nodes" style="font-size: 24px; font-weight: bold; color: #4CAF50;">0</div>
            <div style="font-size: 11px; color: #666;">Nodes</div>
          </div>
          <div style="background: #f9f9f9; padding: 12px; border-radius: 8px; text-align: center;">
            <div id="flowstral-wcag" style="font-size: 24px; font-weight: bold; color: #f44336;">0</div>
            <div style="font-size: 11px; color: #666;">WCAG Issues</div>
          </div>
        </div>
      </div>
      
      <div style="margin-bottom: 15px;">
        <div style="font-size: 12px; font-weight: 600; margin-bottom: 5px;">Playwright Code:</div>
        <div id="flowstral-code" style="background: #1e1e1e; color: #d4d4d4; padding: 15px; border-radius: 8px; font-family: 'Courier New', monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
          // Playwright code will appear here...
        </div>
      </div>
      
      <div id="flowstral-log" style="max-height: 100px; overflow-y: auto; font-size: 11px; background: #f5f5f5; padding: 10px; border-radius: 4px; margin-top: 10px;">
      </div>
    </div>
  `;
  document.body.appendChild(panel);
  
  function log(message) {
    const logDiv = document.getElementById('flowstral-log');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(`[Flowstral] ${message}`);
  }
  
  async function startFlowstral() {
    const projectId = document.getElementById('flowstral-project-id').value;
    if (!projectId) {
      alert('Please enter a Project ID');
      return;
    }
    
    try {
      log('Starting Flowstral session...');
      const response = await fetch(`${API_BASE_URL}/api/flowstral/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          user_id: 'bookmarklet_user',
          initial_url: window.location.href,
          initial_dom: document.documentElement.outerHTML.substring(0, 50000)
        })
      });
      
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      
      const result = await response.json();
      flowstralSession.sessionId = result.session.session_id;
      flowstralSession.isActive = true;
      
      document.getElementById('flowstral-status').textContent = '🔴 Active';
      document.getElementById('flowstral-status').style.background = '#ffebee';
      document.getElementById('flowstral-status').style.color = '#c62828';
      document.getElementById('flowstral-start').disabled = true;
      document.getElementById('flowstral-stop').disabled = false;
      
      startEventCapture();
      log(`✅ Session started: ${flowstralSession.sessionId.substring(0, 8)}...`);
    } catch (error) {
      log(`❌ Error: ${error.message}`);
      alert(`Failed to start: ${error.message}`);
    }
  }
  
  function startEventCapture() {
    const clickHandler = async (e) => {
      if (!flowstralSession.isActive) return;
      await captureEvent('click', e);
    };
    
    const inputHandler = async (e) => {
      if (!flowstralSession.isActive) return;
      await captureEvent('input', e);
    };
    
    document.addEventListener('click', clickHandler, true);
    document.addEventListener('input', inputHandler, true);
    eventListeners = [
      { type: 'click', handler: clickHandler },
      { type: 'input', handler: inputHandler }
    ];
    
    log('Event capture started');
  }
  
  async function captureEvent(eventType, event) {
    if (!flowstralSession.sessionId) return;
    
    const element = event.target;
    const selector = element.id ? `#${element.id}` : 
                     element.className ? `.${element.className.split(' ')[0]}` :
                     element.tagName.toLowerCase();
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/capture-event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: flowstralSession.sessionId,
          event_type: eventType,
          event_data: {
            html: document.documentElement.outerHTML.substring(0, 50000),
            url: window.location.href,
            interacted_element: {
              tag_name: element.tagName,
              id: element.id,
              class_name: element.className,
              selector: selector
            },
            action_description: `${eventType}: ${element.tagName}${element.id ? '#' + element.id : ''}`
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        const code = result.result.real_time_outputs.playwright_code;
        if (code) {
          const codeDiv = document.getElementById('flowstral-code');
          codeDiv.textContent += '\n' + code;
        }
        flowstralSession.nodes.push(result.result.node_id);
        document.getElementById('flowstral-nodes').textContent = flowstralSession.nodes.length;
        log(`✅ Captured ${eventType}`);
      }
    } catch (error) {
      log(`❌ Capture error: ${error.message}`);
    }
  }
  
  async function stopFlowstral() {
    if (!flowstralSession.sessionId) return;
    
    try {
      log('Stopping session...');
      const response = await fetch(`${API_BASE_URL}/api/flowstral/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: flowstralSession.sessionId,
          project_id: document.getElementById('flowstral-project-id').value
        })
      });
      
      if (!response.ok) throw new Error(`Failed: ${response.status}`);
      
      const result = await response.json();
      eventListeners.forEach(({type, handler}) => {
        document.removeEventListener(type, handler, true);
      });
      eventListeners = [];
      
      flowstralSession.isActive = false;
      document.getElementById('flowstral-status').textContent = '⏹ Stopped';
      document.getElementById('flowstral-status').style.background = '#e8f5e9';
      document.getElementById('flowstral-status').style.color = '#2e7d32';
      document.getElementById('flowstral-start').disabled = false;
      document.getElementById('flowstral-stop').disabled = true;
      
      log(`✅ Stopped. Generated ${Object.keys(result.artifacts || {}).length} artifacts`);
      alert('Flowstral stopped! Check console for artifacts.');
      console.log('Flowstral Artifacts:', result.artifacts);
    } catch (error) {
      log(`❌ Stop error: ${error.message}`);
    }
  }
  
  document.getElementById('flowstral-start').onclick = startFlowstral;
  document.getElementById('flowstral-stop').onclick = stopFlowstral;
  
  log('Flowstral injected! Enter Project ID and click Start.');
})();



