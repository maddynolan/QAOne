// Flowstral Extension - Side Panel UI
// Enhanced UI for Flowstral recording with better UX

const API_BASE_URL = 'http://localhost:8000';

// State
let currentSession = {
    isActive: false,
    sessionId: null,
    projectId: null,
    userId: null,
    startTime: null,
    stepCount: 0
};

let durationInterval = null;
let currentTab = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Flowstral Side Panel: Initialized');
    
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
        currentTab = tabs[0];
        checkDomainAllowlist(currentTab.url);
    }
    
    // Load saved session state
    await loadSessionState();
    
    // Attach event listeners
    document.getElementById('btnStart').addEventListener('click', startFlowstral);
    document.getElementById('btnStop').addEventListener('click', stopFlowstral);
    
    // Load saved project/user IDs
    const stored = await chrome.storage.local.get(['flowstral_project_id', 'flowstral_user_id']);
    if (stored.flowstral_project_id) {
        document.getElementById('projectId').value = stored.flowstral_project_id;
    }
    if (stored.flowstral_user_id) {
        document.getElementById('userId').value = stored.flowstral_user_id;
    }
    
    // Listen for session updates from background
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes.flowstral_session) {
            updateSessionState(changes.flowstral_session.newValue);
        }
    });
    
    // Check for active session
    checkActiveSession();
    
    log('Side panel ready. Navigate to a website and click "Start Flowstral" to begin recording.');
});

// Check domain allowlist
async function checkDomainAllowlist(url) {
    if (!url) return;
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        // Get allowlist from storage
        const stored = await chrome.storage.local.get(['flowstral_allowed_domains']);
        const allowedDomains = stored.flowstral_allowed_domains || [];
        
        const domainCheckEl = document.getElementById('domainCheck');
        
        if (allowedDomains.length === 0) {
            // No allowlist configured - allow all
            domainCheckEl.style.display = 'none';
            return;
        }
        
        const isAllowed = allowedDomains.some(allowed => {
            if (allowed.startsWith('*.')) {
                const baseDomain = allowed.substring(2);
                return domain === baseDomain || domain.endsWith('.' + baseDomain);
            }
            return domain === allowed;
        });
        
        if (isAllowed) {
            domainCheckEl.className = 'domain-check domain-allowed';
            domainCheckEl.textContent = `✅ Domain allowed: ${domain}`;
            domainCheckEl.style.display = 'block';
        } else {
            domainCheckEl.className = 'domain-check domain-blocked';
            domainCheckEl.textContent = `❌ Domain blocked: ${domain}. Add to allowlist in settings.`;
            domainCheckEl.style.display = 'block';
            document.getElementById('btnStart').disabled = true;
        }
    } catch (e) {
        console.error('Flowstral Side Panel: Error checking domain', e);
    }
}

// Load session state
async function loadSessionState() {
    try {
        const stored = await chrome.storage.local.get('flowstral_session');
        if (stored.flowstral_session) {
            updateSessionState(stored.flowstral_session);
        }
    } catch (e) {
        console.error('Flowstral Side Panel: Error loading session state', e);
    }
}

// Update session state
function updateSessionState(session) {
    if (!session) return;
    
    currentSession.isActive = session.isActive || false;
    currentSession.sessionId = session.sessionId || null;
    currentSession.projectId = session.projectId || null;
    currentSession.userId = session.userId || null;
    currentSession.stepCount = session.stepCount || 0;
    
    if (session.startTime) {
        currentSession.startTime = new Date(session.startTime);
    }
    
    updateUI();
}

// Check for active session
async function checkActiveSession() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'FLOWSTRAL_GET_SESSION',
            data: {}
        });
        
        if (response && response.success && response.data) {
            updateSessionState(response.data);
        }
    } catch (e) {
        console.error('Flowstral Side Panel: Error checking active session', e);
    }
}

// Start Flowstral
async function startFlowstral() {
    log('🔄 Starting Flowstral session...');
    
    const projectId = document.getElementById('projectId').value.trim();
    const userId = document.getElementById('userId').value.trim() || 'default';
    
    if (!projectId) {
        log('❌ Error: Project ID is required');
        alert('Please enter a Project ID');
        return;
    }
    
    // Check domain allowlist
    if (currentTab) {
        const isAllowed = await checkDomainBeforeStart(currentTab.url);
        if (!isAllowed) {
            log('❌ Error: Domain not in allowlist');
            return;
        }
    }
    
    // Save project/user IDs
    await chrome.storage.local.set({
        flowstral_project_id: projectId,
        flowstral_user_id: userId
    });
    
    try {
        log('📤 Sending start request...');
        
        const response = await chrome.runtime.sendMessage({
            type: 'FLOWSTRAL_START',
            data: {
                project_id: projectId,
                user_id: userId,
                initial_url: currentTab?.url || window.location.href,
                tab_id: currentTab?.id
            }
        });
        
        if (response && response.success) {
            log('✅ Flowstral started successfully!');
            log('📝 Start interacting with the page to record actions.');
            
            if (response.data && response.data.session_id) {
                currentSession.sessionId = response.data.session_id;
                currentSession.projectId = projectId;
                currentSession.userId = userId;
                currentSession.isActive = true;
                currentSession.startTime = new Date();
                currentSession.stepCount = 0;
                
                // Start duration timer
                startDurationTimer();
                
                updateUI();
            }
        } else {
            log(`❌ Failed to start: ${response?.error || 'Unknown error'}`);
            alert(`Failed to start Flowstral: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        log(`❌ Error: ${error.message}`);
        console.error('Flowstral Side Panel: Start error', error);
        alert(`Error starting Flowstral: ${error.message}`);
    }
}

// Stop Flowstral
async function stopFlowstral() {
    log('🛑 Stopping Flowstral session...');
    
    // Get session from storage
    const stored = await chrome.storage.local.get('flowstral_session');
    const sessionId = stored.flowstral_session?.sessionId || currentSession.sessionId;
    const projectId = stored.flowstral_session?.projectId || document.getElementById('projectId').value;
    
    if (!sessionId) {
        log('⚠️ No active session found');
        currentSession.isActive = false;
        updateUI();
        return;
    }
    
    try {
        const btnStop = document.getElementById('btnStop');
        if (btnStop) {
            btnStop.disabled = true;
            btnStop.textContent = 'Stopping...';
        }
        
        log('📤 Sending stop request...');
        
        // Connect to WebSocket for progress updates
        const wsUrl = `ws://localhost:8000/api/flowstral/ws/${sessionId}`;
        let ws = null;
        let progressInterval = null;
        
        try {
            ws = new WebSocket(wsUrl);
            
            ws.onopen = () => {
                log('📡 Connected to progress stream');
                updateProgressUI(0, 'Connecting...');
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'progress') {
                        const progress = data.progress || 0;
                        const message = data.message || '';
                        const artifact = data.artifact || '';
                        const status = data.status || 'processing';
                        
                        log(`📊 Progress: ${progress}% - ${message}`);
                        updateProgressUI(progress, message, artifact, status);
                    } else if (data.type === 'connected') {
                        log('✅ Progress stream connected');
                        updateProgressUI(0, 'Starting artifact generation...');
                    } else if (data.type === 'heartbeat') {
                        // Keep connection alive
                    }
                } catch (e) {
                    console.warn('Flowstral Side Panel: Failed to parse WebSocket message', e);
                }
            };
            
            ws.onerror = (error) => {
                console.error('Flowstral Side Panel: WebSocket error', error);
                log('⚠️ Progress updates unavailable (WebSocket error)');
            };
            
            ws.onclose = () => {
                log('📡 Progress stream closed');
                if (progressInterval) {
                    clearInterval(progressInterval);
                }
            };
        } catch (error) {
            console.warn('Flowstral Side Panel: Failed to create WebSocket', error);
            log('⚠️ Progress updates unavailable');
        }
        
        const response = await chrome.runtime.sendMessage({
            type: 'FLOWSTRAL_STOP',
            data: {
                session_id: sessionId,
                project_id: projectId || 'default'
            }
        });
        
        if (response && response.success) {
            log('✅ Session stopped successfully!');
            log('📊 Generating artifacts...');
            updateProgressUI(5, 'Artifact generation started...');
            
            // Stop duration timer
            stopDurationTimer();
            
            // Extract artifacts
            const responseData = response.data || {};
            const artifactsWrapper = responseData.artifacts || {};
            let artifacts = {};
            
            if (artifactsWrapper.artifacts) {
                artifacts = artifactsWrapper.artifacts;
            } else if (artifactsWrapper.action_graph || artifactsWrapper.playwright_script) {
                artifacts = artifactsWrapper;
            } else {
                artifacts = artifactsWrapper;
            }
            
            const artifactKeys = Object.keys(artifacts).filter(k => {
                const artifact = artifacts[k];
                return artifact && typeof artifact === 'object' && !artifact.error;
            });
            
            log(`📦 Generated ${artifactKeys.length} artifacts`);
            
            if (artifactKeys.length > 0) {
                log('🚀 Opening artifacts window...');
                showArtifacts(artifacts);
            } else {
                log('⚠️ No artifacts generated. Check console for details.');
            }
            
            // Reset session
            currentSession.isActive = false;
            currentSession.sessionId = null;
            currentSession.stepCount = 0;
            updateUI();
        } else {
            log(`❌ Failed to stop: ${response?.error || 'Unknown error'}`);
            alert(`Failed to stop Flowstral: ${response?.error || 'Unknown error'}`);
        }
    } catch (error) {
        log(`❌ Error: ${error.message}`);
        console.error('Flowstral Side Panel: Stop error', error);
        alert(`Error stopping Flowstral: ${error.message}`);
    } finally {
        const btnStop = document.getElementById('btnStop');
        if (btnStop) {
            btnStop.disabled = false;
            btnStop.textContent = 'Stop & Generate';
        }
    }
}

// Check domain before start
async function checkDomainBeforeStart(url) {
    if (!url) return true;
    
    try {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        
        const stored = await chrome.storage.local.get(['flowstral_allowed_domains']);
        const allowedDomains = stored.flowstral_allowed_domains || [];
        
        if (allowedDomains.length === 0) {
            return true; // No allowlist = allow all
        }
        
        return allowedDomains.some(allowed => {
            if (allowed.startsWith('*.')) {
                const baseDomain = allowed.substring(2);
                return domain === baseDomain || domain.endsWith('.' + baseDomain);
            }
            return domain === allowed;
        });
    } catch (e) {
        console.error('Flowstral Side Panel: Error checking domain', e);
        return true; // Allow on error
    }
}

// Start duration timer
function startDurationTimer() {
    stopDurationTimer();
    durationInterval = setInterval(() => {
        if (currentSession.startTime) {
            const elapsed = Math.floor((new Date() - currentSession.startTime) / 1000);
            const durationEl = document.getElementById('duration');
            if (durationEl) {
                durationEl.textContent = `${elapsed}s`;
            }
        }
    }, 1000);
}

// Stop duration timer
function stopDurationTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
}

// Update progress UI
function updateProgressUI(progress, message, artifact, status) {
    const progressSection = document.getElementById('progressSection');
    const progressBar = document.getElementById('progressBar');
    const progressPercent = document.getElementById('progressPercent');
    const progressMessage = document.getElementById('progressMessage');
    const artifactStatus = document.getElementById('artifactStatus');
    
    if (progressSection) {
        progressSection.style.display = 'block';
    }
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
    
    if (progressPercent) {
        progressPercent.textContent = `${Math.min(100, Math.max(0, progress))}%`;
    }
    
    if (progressMessage) {
        progressMessage.textContent = message || 'Processing...';
    }
    
    if (artifactStatus && artifact) {
        const statusIcon = status === 'completed' ? '✅' : status === 'error' ? '❌' : '⏳';
        artifactStatus.textContent = `${statusIcon} ${artifact}: ${status}`;
    }
    
    // Hide progress section when complete
    if (progress >= 100) {
        setTimeout(() => {
            if (progressSection) {
                progressSection.style.display = 'none';
            }
        }, 3000);
    }
}

// Update UI
function updateUI() {
    const statusEl = document.getElementById('status');
    const btnStart = document.getElementById('btnStart');
    const btnStop = document.getElementById('btnStop');
    const sessionIdEl = document.getElementById('sessionId');
    const stepCountEl = document.getElementById('stepCount');
    
    if (currentSession.isActive) {
        statusEl.className = 'status status-active';
        statusEl.innerHTML = `
            <div>🟢 <strong>Recording Active</strong></div>
            <div class="session-info">
                <span>Session:</span>
                <strong>${currentSession.sessionId ? currentSession.sessionId.substring(0, 8) + '...' : '-'}</strong>
            </div>
            <div class="session-info">
                <span>Steps:</span>
                <strong>${currentSession.stepCount}</strong>
            </div>
            <div class="session-info">
                <span>Duration:</span>
                <strong id="duration">0s</strong>
            </div>
        `;
        btnStart.disabled = true;
        btnStop.disabled = false;
    } else {
        statusEl.className = 'status status-inactive';
        statusEl.innerHTML = `
            <div>🔴 <strong>Not Recording</strong></div>
            <div class="session-info">
                <span>Session:</span>
                <strong>-</strong>
            </div>
            <div class="session-info">
                <span>Steps:</span>
                <strong>0</strong>
            </div>
            <div class="session-info">
                <span>Duration:</span>
                <strong>0s</strong>
            </div>
        `;
        btnStart.disabled = false;
        btnStop.disabled = true;
    }
    
    if (sessionIdEl) {
        sessionIdEl.textContent = currentSession.sessionId ? currentSession.sessionId.substring(0, 8) + '...' : '-';
    }
    if (stepCountEl) {
        stepCountEl.textContent = currentSession.stepCount;
    }
}

// Show artifacts
function showArtifacts(artifacts) {
    try {
        const newWindow = window.open('', '_blank', 'width=1200,height=800');
        
        if (!newWindow) {
            alert('Artifacts window blocked. Please allow popups for this extension.');
            console.log('Artifacts:', artifacts);
            return;
        }
        
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Flowstral Artifacts</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
                    .artifact { background: white; padding: 20px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                    .artifact h2 { color: #667eea; margin-bottom: 12px; }
                    pre { background: #1e1e1e; color: #d4d4d4; padding: 16px; border-radius: 4px; overflow-x: auto; }
                    .error { color: #ef4444; }
                </style>
            </head>
            <body>
                <h1>⭐ Flowstral Artifacts</h1>
                <p>Generated: ${new Date().toLocaleString()}</p>
                ${Object.entries(artifacts).map(([key, artifact]) => `
                    <div class="artifact">
                        <h2>${key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</h2>
                        ${artifact.error ? `<p class="error">Error: ${artifact.error}</p>` : ''}
                        <pre>${JSON.stringify(artifact, null, 2)}</pre>
                    </div>
                `).join('')}
            </body>
            </html>
        `);
        newWindow.document.close();
    } catch (error) {
        console.error('Flowstral Side Panel: Error showing artifacts', error);
        alert(`Error displaying artifacts: ${error.message}`);
    }
}

// Log function
function log(message) {
    const logArea = document.getElementById('logArea');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    logArea.appendChild(entry);
    logArea.scrollTop = logArea.scrollHeight;
    console.log('Flowstral Side Panel:', message);
}

