// Flowstral Extension - Popup UI Script

let currentSession = {
    sessionId: null,
    isActive: false,
    nodes: []
};

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Flowstral Popup: Initializing...');
    
    try {
        // Attach event listeners to buttons
        const btnStart = document.getElementById('btnStart');
        const btnStop = document.getElementById('btnStop');
        
        if (btnStart) {
            btnStart.addEventListener('click', startFlowstral);
            console.log('Flowstral Popup: Start button listener attached');
        } else {
            console.error('Flowstral Popup: Start button not found!');
        }
        
        if (btnStop) {
            btnStop.addEventListener('click', stopFlowstral);
            console.log('Flowstral Popup: Stop button listener attached');
        }
        
        // Check for existing session
        const stored = await chrome.storage.local.get('flowstral_session');
        console.log('Flowstral Popup: Stored session', stored);
        
        if (stored.flowstral_session && stored.flowstral_session.isActive) {
            currentSession = {
                sessionId: stored.flowstral_session.sessionId,
                isActive: true,
                nodes: []
            };
            updateUI();
            log('Found active session - recording is active!');
        }
        
        // Get current tab URL
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]) {
            log(`Current page: ${tabs[0].url}`);
            console.log('Flowstral Popup: Current tab', tabs[0]);
        } else {
            log('⚠️ No active tab found');
        }
        
        // Test background script connection
        try {
            const testResponse = await chrome.runtime.sendMessage({ type: 'PING' });
            console.log('Flowstral Popup: Background script connection test', testResponse);
            if (testResponse && testResponse.success) {
                log('✅ Background script connected');
            }
        } catch (e) {
            console.warn('Flowstral Popup: Background script may not be ready', e);
            log('⚠️ Background script not responding - try reloading extension');
        }
    } catch (error) {
        console.error('Flowstral Popup: Initialization error', error);
        log(`❌ Initialization error: ${error.message}`);
    }
});

// Start Flowstral
async function startFlowstral() {
    if (currentSession.isActive) {
        log('Flowstral is already active!');
        return;
    }
    
    const projectId = document.getElementById('projectId').value.trim();
    if (!projectId) {
        alert('Please enter a Project ID');
        return;
    }
    
    try {
        log('Starting Flowstral session...');
        console.log('Flowstral Popup: Starting with project ID:', projectId);
        
        // Get current tab
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
            throw new Error('No active tab found');
        }
        
        const currentUrl = tabs[0].url;
        const tabId = tabs[0].id;
        
        log(`Current tab: ${currentUrl}`);
        console.log('Flowstral Popup: Current tab ID:', tabId, 'URL:', currentUrl);
        
        // Check if URL is a chrome:// or extension page (content scripts don't work there)
        if (currentUrl.startsWith('chrome://') || currentUrl.startsWith('chrome-extension://') || currentUrl.startsWith('edge://')) {
            throw new Error('Cannot record on browser pages (chrome://, edge://). Please navigate to a website like saucedemo.com first.');
        }
        
        // Disable button while processing
        document.getElementById('btnStart').disabled = true;
        document.getElementById('btnStart').textContent = 'Starting...';
        
        // Send message to background script with timeout
        const response = await Promise.race([
            chrome.runtime.sendMessage({
                type: 'FLOWSTRAL_START',
                data: {
                    project_id: projectId,
                    user_id: 'extension_user',
                    initial_url: currentUrl,
                    tab_id: tabId
                }
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout - background script may not be responding')), 10000)
            )
        ]);
        
        console.log('Flowstral Popup: Received response:', response);
        
        if (!response) {
            throw new Error('No response from background script. Check if backend is running on localhost:8000');
        }
        
        if (response.success) {
            currentSession.sessionId = response.data.session.session_id;
            currentSession.isActive = true;
            
            // Store in extension storage
            await chrome.storage.local.set({
                flowstral_session: {
                    sessionId: currentSession.sessionId,
                    projectId: projectId,
                    isActive: true,
                    tabId: tabId,
                    startTime: Date.now()
                }
            });
            
            updateUI();
            log(`✅ Flowstral started! Session: ${currentSession.sessionId.substring(0, 8)}...`);
            log('💡 Interact with the page - events are being captured!');
            log('💡 Look for green indicator in top-right corner!');
            log('💡 Extension popup can be closed - recording continues!');
            
            // Re-enable button
            document.getElementById('btnStart').disabled = false;
            document.getElementById('btnStart').textContent = '▶ Start';
        } else {
            throw new Error(response.error || 'Failed to start session');
        }
    } catch (error) {
        console.error('Flowstral Popup: Start error:', error);
        log(`❌ Error: ${error.message}`);
        
        // Re-enable button
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStart').textContent = '▶ Start';
        
        // Show detailed error
        const errorMsg = error.message.includes('timeout') 
            ? 'Background script not responding. Try:\n1. Reload extension\n2. Check backend is running\n3. Check console for errors'
            : `Failed to start: ${error.message}\n\nCheck:\n1. Backend running on localhost:8000?\n2. Console for errors\n3. Network tab for API calls`;
        
        alert(errorMsg);
    }
}

// Stop Flowstral
async function stopFlowstral() {
    console.log('=== STOP FLOWSTRAL FUNCTION CALLED ===');
    log('🛑 Stopping Flowstral session...');
    
    try {
        // Get session from storage (more reliable than currentSession state)
        const stored = await chrome.storage.local.get('flowstral_session');
        const sessionId = stored.flowstral_session?.sessionId || currentSession.sessionId;
        const projectId = stored.flowstral_session?.projectId || document.getElementById('projectId').value;
        
        console.log('Flowstral Popup: Retrieved session from storage', { sessionId, projectId });
        log(`📋 Session ID: ${sessionId ? sessionId.substring(0, 8) + '...' : 'none'}`);
        
        if (!sessionId) {
            log('⚠️ No active session found to stop');
            console.warn('Flowstral Popup: No session ID found');
            // Clear UI state anyway
            currentSession.isActive = false;
            currentSession.sessionId = null;
            await chrome.storage.local.remove('flowstral_session');
            updateUI();
            return;
        }
        
        console.log('Flowstral Popup: Stopping session', { sessionId, projectId });
        log('📤 Sending stop request to background...');
        
        // Disable button while processing
        document.getElementById('btnStop').disabled = true;
        document.getElementById('btnStop').textContent = 'Stopping...';
        
        console.log('Flowstral Popup: Sending message to background script...');
        const response = await Promise.race([
            chrome.runtime.sendMessage({
                type: 'FLOWSTRAL_STOP',
                data: {
                    session_id: sessionId,
                    project_id: projectId || 'default'
                }
            }),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout - background script not responding')), 15000)
            )
        ]);
        
        console.log('Flowstral Popup: Received response from background');
        log('📥 Received response from background');
        
        // Aggressive logging - these should always show
        console.log('=== FLOWSTRAL STOP RESPONSE ===');
        console.log('Flowstral Popup: Stop response', response);
        console.log('Flowstral Popup: Response success?', response?.success);
        console.log('Flowstral Popup: Response data exists?', !!response?.data);
        
        if (response && response.data) {
            console.log('Flowstral Popup: Full response data', JSON.stringify(response.data, null, 2));
        }
        
        // Also log to popup UI
        log('📋 Processing stop response...');
        
        if (response && response.success) {
            log('✅ Stop response successful');
            // Response structure: response.data.artifacts.artifacts (double nested)
            const responseData = response.data || {};
            const artifactsWrapper = responseData.artifacts || {};
            
            console.log('=== ARTIFACT EXTRACTION ===');
            console.log('Flowstral Popup: Response data keys', Object.keys(responseData));
            console.log('Flowstral Popup: Response data', responseData);
            console.log('Flowstral Popup: Artifacts wrapper', artifactsWrapper);
            console.log('Flowstral Popup: Artifacts wrapper keys', Object.keys(artifactsWrapper));
            
            log('🔍 Extracting artifacts from response...');
            
            // Extract artifacts - they're nested in artifactsWrapper.artifacts
            let artifacts = {};
            if (artifactsWrapper.artifacts) {
                // Structure: {artifacts: {artifacts: {action_graph: ..., playwright_script: ...}}}
                artifacts = artifactsWrapper.artifacts;
                console.log('Flowstral Popup: Found artifacts at artifactsWrapper.artifacts');
            } else if (artifactsWrapper.action_graph || artifactsWrapper.playwright_script) {
                // Structure: {artifacts: {action_graph: ..., playwright_script: ...}}
                artifacts = artifactsWrapper;
                console.log('Flowstral Popup: Found artifacts at artifactsWrapper level');
            } else {
                artifacts = artifactsWrapper;
                console.log('Flowstral Popup: Using artifactsWrapper as-is');
            }
            
            console.log('Flowstral Popup: Extracted artifacts keys', Object.keys(artifacts));
            
            // Count valid artifacts (not errors)
            const artifactKeys = Object.keys(artifacts).filter(k => {
                const artifact = artifacts[k];
                return artifact && typeof artifact === 'object' && !artifact.error;
            });
            
            log(`✅ Flowstral stopped! Generated ${artifactKeys.length} artifacts.`);
            
            // Log artifact details
            if (artifactKeys.length > 0) {
                log(`📊 Artifacts: ${artifactKeys.join(', ')}`);
                console.log('Flowstral Popup: Artifacts summary', artifactKeys.map(k => ({
                    key: k,
                    hasData: !!artifacts[k],
                    isError: artifacts[k]?.error ? true : false
                })));
            } else {
                log('⚠️ No valid artifacts found in response');
                console.warn('Flowstral Popup: Full artifacts structure', artifacts);
            }
            
            currentSession.isActive = false;
            currentSession.sessionId = null;
            
            // Clear from storage
            await chrome.storage.local.remove('flowstral_session');
            
            updateUI();
            
            // Show artifacts in new window - always try to show if we have any data
            console.log('=== ARTIFACT DISPLAY CHECK ===');
            console.log('Flowstral Popup: Checking if should show artifacts...');
            console.log('Flowstral Popup: artifactKeys.length:', artifactKeys.length);
            console.log('Flowstral Popup: artifactKeys:', artifactKeys);
            console.log('Flowstral Popup: Object.keys(artifacts).length:', Object.keys(artifacts).length);
            console.log('Flowstral Popup: Object.keys(artifacts):', Object.keys(artifacts));
            console.log('Flowstral Popup: artifacts object:', artifacts);
            
            log(`📊 Found ${artifactKeys.length} valid artifacts, ${Object.keys(artifacts).length} total keys`);
            
            if (artifactKeys.length > 0 || Object.keys(artifacts).length > 0) {
                console.log('=== CALLING showArtifacts ===');
                console.log('Flowstral Popup: ✅ Calling showArtifacts');
                console.log('Flowstral Popup: Valid artifact keys:', artifactKeys);
                console.log('Flowstral Popup: All artifact keys:', Object.keys(artifacts));
                log('🚀 Opening artifacts window...');
                showArtifacts(artifacts);
            } else {
                console.error('=== NO ARTIFACTS FOUND ===');
                console.error('Flowstral Popup: ❌ Not showing artifacts - no artifacts found');
                console.error('Flowstral Popup: Full response data:', JSON.stringify(responseData, null, 2));
                console.error('Flowstral Popup: Artifacts wrapper:', JSON.stringify(artifactsWrapper, null, 2));
                log('⚠️ Artifacts window not opened - no artifacts in response');
                log('💡 Check console (F12) for full response structure');
                
                // Also show in alert so user definitely sees it
                setTimeout(() => {
                    alert(`No artifacts found in response.\n\nCheck popup console (right-click popup → Inspect) for details.\n\nResponse keys: ${Object.keys(responseData).join(', ')}`);
                }, 100);
            }
            
            // Re-enable button
            document.getElementById('btnStop').disabled = false;
            document.getElementById('btnStop').textContent = '⏹ Stop';
        } else {
            // Even if backend says session not found, clear local state
            const errorMsg = response?.error || 'Failed to stop session';
            if (errorMsg.includes('not found') || errorMsg.includes('not active')) {
                log('⚠️ Session already stopped or expired - clearing local state');
                currentSession.isActive = false;
                currentSession.sessionId = null;
                await chrome.storage.local.remove('flowstral_session');
                updateUI();
            } else {
                throw new Error(errorMsg);
            }
            
            // Re-enable button
            document.getElementById('btnStop').disabled = false;
            document.getElementById('btnStop').textContent = '⏹ Stop';
        }
    } catch (error) {
        console.error('Flowstral Popup: Stop error', error);
        log(`❌ Error: ${error.message}`);
        
        // Re-enable button
        document.getElementById('btnStop').disabled = false;
        document.getElementById('btnStop').textContent = '⏹ Stop';
        
        // Clear local state even on error (session might be gone)
        currentSession.isActive = false;
        currentSession.sessionId = null;
        await chrome.storage.local.remove('flowstral_session');
        updateUI();
        
        // Only show alert for non-recoverable errors
        if (!error.message.includes('not found') && !error.message.includes('not active')) {
            alert(`Failed to stop Flowstral: ${error.message}\n\nSession may have already been stopped.`);
        }
    }
}

// Update UI
function updateUI() {
    if (currentSession.isActive) {
        document.getElementById('statusBadge').className = 'status-badge status-active';
        document.getElementById('statusBadge').textContent = '🔴 Active';
        document.getElementById('btnStart').disabled = true;
        document.getElementById('btnStop').disabled = false;
    } else {
        document.getElementById('statusBadge').className = 'status-badge status-stopped';
        document.getElementById('statusBadge').textContent = '⏹ Stopped';
        document.getElementById('btnStart').disabled = false;
        document.getElementById('btnStop').disabled = true;
    }
    
    document.getElementById('nodeCount').textContent = currentSession.nodes.length;
    document.getElementById('edgeCount').textContent = Math.max(0, currentSession.nodes.length - 1);
}

// Log message
function log(message) {
    const logDiv = document.getElementById('log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logDiv.appendChild(entry);
    logDiv.scrollTop = logDiv.scrollHeight;
    console.log(`[Flowstral] ${message}`);
}

// Show artifacts
function showArtifacts(artifacts) {
    console.log('=== showArtifacts FUNCTION CALLED ===');
    console.log('Flowstral Popup: showArtifacts called');
    console.log('Flowstral Popup: Artifacts keys', Object.keys(artifacts));
    console.log('Flowstral Popup: Artifacts object', artifacts);
    log('📄 Preparing artifacts window...');
    
    try {
        console.log('Flowstral Popup: Attempting to open artifacts window...');
        log('🌐 Opening new window...');
        
        // Try opening window
        const newWindow = window.open('', '_blank', 'width=1200,height=800');
        
        if (!newWindow) {
            console.error('=== POPUP BLOCKED ===');
            console.error('Flowstral Popup: Popup blocked by browser');
            log('⚠️ Popup blocked - check browser popup settings');
            log('💡 Artifacts available in console (F12)');
            console.log('Flowstral Popup: Artifacts data:', JSON.stringify(artifacts, null, 2));
            
            // Show alert immediately
            alert('Artifacts window blocked by browser.\n\nPlease allow popups for this extension, or check the console (F12) for artifacts.');
            return;
        }
        
        console.log('=== WINDOW OPENED SUCCESSFULLY ===');
        console.log('Flowstral Popup: Window opened successfully');
        log('✅ Window opened, writing content...');
        
        // Escape HTML in JSON strings
        const escapeHtml = (str) => {
            if (typeof str !== 'string') return str;
            return str.replace(/&/g, '&amp;')
                     .replace(/</g, '&lt;')
                     .replace(/>/g, '&gt;')
                     .replace(/"/g, '&quot;')
                     .replace(/'/g, '&#039;');
        };
        
        const formatArtifact = (artifact) => {
            if (!artifact || Object.keys(artifact).length === 0) {
                return '<em>No data available</em>';
            }
            if (artifact.error) {
                return `<strong style="color: red;">Error: ${escapeHtml(artifact.error)}</strong>`;
            }
            return `<pre>${escapeHtml(JSON.stringify(artifact, null, 2))}</pre>`;
        };
        
        newWindow.document.write(`
            <html>
                <head>
                    <title>Flowstral Artifacts</title>
                    <style>
                        body { font-family: Arial, sans-serif; padding: 20px; background: #f9f9f9; }
                        h1 { color: #4CAF50; }
                        h2 { margin-top: 30px; color: #333; border-bottom: 2px solid #4CAF50; padding-bottom: 5px; }
                        pre { background: #f5f5f5; padding: 15px; overflow: auto; border: 1px solid #ddd; border-radius: 4px; max-height: 400px; }
                        .artifact-section { margin-bottom: 30px; }
                        .empty { color: #999; font-style: italic; }
                        .error { color: red; }
                    </style>
                </head>
                <body>
                    <h1>⭐ Flowstral Artifacts</h1>
                    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                    
                    <div class="artifact-section">
                        <h2>1. Action Graph</h2>
                        ${formatArtifact(artifacts.action_graph)}
                    </div>
                    
                    <div class="artifact-section">
                        <h2>2. Playwright Script</h2>
                        ${artifacts.playwright_script?.code 
                            ? `<pre>${escapeHtml(artifacts.playwright_script.code)}</pre>` 
                            : formatArtifact(artifacts.playwright_script)}
                    </div>
                    
                    <div class="artifact-section">
                        <h2>3. Test Cases</h2>
                        ${formatArtifact(artifacts.test_cases)}
                    </div>
                    
                    <div class="artifact-section">
                        <h2>4. Accessibility Report</h2>
                        ${formatArtifact(artifacts.accessibility_report)}
                    </div>
                    
                    <div class="artifact-section">
                        <h2>5. Performance Report</h2>
                        ${formatArtifact(artifacts.performance_report)}
                    </div>
                    
                    <div class="artifact-section">
                        <h2>6. Defects</h2>
                        ${formatArtifact(artifacts.defects)}
                    </div>
                </body>
            </html>
        `);
        newWindow.document.close();
        console.log('=== ARTIFACTS WINDOW COMPLETE ===');
        console.log('Flowstral Popup: Artifacts window content written');
        log('✅ Artifacts window displayed!');
    } catch (error) {
        console.error('=== ERROR IN showArtifacts ===');
        console.error('Flowstral Popup: Error showing artifacts', error);
        console.error('Flowstral Popup: Error stack', error.stack);
        log(`❌ Error displaying artifacts: ${error.message}`);
        console.log('Flowstral Popup: Artifacts data:', artifacts);
        alert(`Error displaying artifacts: ${error.message}\n\nCheck console for details.`);
    }
}

// Listen for session updates from background
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.flowstral_session) {
        const newSession = changes.flowstral_session.newValue;
        if (newSession) {
            currentSession = {
                sessionId: newSession.sessionId,
                isActive: newSession.isActive,
                nodes: []
            };
            updateUI();
        } else {
            currentSession = { sessionId: null, isActive: false, nodes: [] };
            updateUI();
        }
    }
});

