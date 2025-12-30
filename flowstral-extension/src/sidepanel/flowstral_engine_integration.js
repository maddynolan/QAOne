/**
 * FLOWSTRAL ENGINE INTEGRATION
 * ============================
 * 
 * This module integrates the browser extension with the new Flowstral Engine.
 * Include this file in sidepanel.html AFTER sidepanel.js
 * 
 * Features:
 * - Generates robust, self-healing tests using the Flowstral Engine
 * - Leverages PageAnalyzer data from Suggest tab
 * - Multiple selector fallbacks per element
 * - Salesforce-specific pattern detection
 * 
 * Usage:
 *   // In sidepanel.js, call:
 *   FlowstralEngineIntegration.generateRobustTest(actions, options);
 */

const FlowstralEngineIntegration = {
  
  /**
   * Configuration
   */
  config: {
    enabled: true,  // Enable Flowstral Engine by default
    endpoint: '/flowstral',  // New API endpoints
  },
  
  /**
   * Generate robust test using Flowstral Engine
   * Call this instead of the regular generateScript when Engine mode is enabled
   */
  async generateRobustTest(sidebar) {
    const serverUrl = sidebar.options.serverUrl || 'http://localhost:8000';
    const actions = sidebar.state.actions || [];
    const testName = sidebar.elements.testCaseName?.value || 'Recorded Test';
    const baseUrl = sidebar.options.baseUrl || sidebar.state.actions[0]?.url || '';
    
    console.log('[FlowstralEngine] generateRobustTest called:');
    console.log('[FlowstralEngine]   - serverUrl:', serverUrl);
    console.log('[FlowstralEngine]   - actions:', actions.length);
    console.log('[FlowstralEngine]   - testName:', testName);
    console.log('[FlowstralEngine]   - baseUrl:', baseUrl);
    
    if (actions.length === 0) {
      sidebar.addLog('error', 'No actions to generate');
      console.log('[FlowstralEngine] No actions - returning null');
      return null;
    }
    
    sidebar.addLog('info', '🚀 Generating with Flowstral Engine...');
    
    const endpoint = `${serverUrl}${this.config.endpoint}/build-from-recording`;
    console.log('[FlowstralEngine] Calling endpoint:', endpoint);
    
    try {
      const convertedActions = actions.map(a => this._convertAction(a));
      console.log('[FlowstralEngine] Converted actions sample:', JSON.stringify(convertedActions.slice(0, 2)));
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: testName,
          url: baseUrl,
          actions: convertedActions,
          app_type: sidebar.options.appType || 'auto'
        })
      });
      
      console.log('[FlowstralEngine] Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[FlowstralEngine] Server error:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText.substring(0, 200)}`);
      }
      
      const result = await response.json();
      console.log('[FlowstralEngine] Response result:', result.success, result.test_name);
      
      if (result.success) {
        sidebar.addLog('success', `✓ Generated robust test: ${result.test_name}`);
        sidebar.addLog('info', `App type: ${result.detected_app_type}`);
        return result.test_code;
      } else {
        throw new Error(result.detail || 'Generation failed');
      }
      
    } catch (error) {
      console.error('[FlowstralEngine] Error:', error);
      sidebar.addLog('error', `Engine generation failed: ${error.message}`);
      sidebar.addLog('info', 'Falling back to standard generation...');
      return null;  // Fall back to regular generation
    }
  },
  
  /**
   * Generate test from Suggest tab analysis
   * This uses the PageAnalyzer data for smarter test generation
   */
  async generateFromAnalysis(sidebar, analysis) {
    const serverUrl = sidebar.options.serverUrl || 'http://localhost:8000';
    const testName = sidebar.elements.testCaseName?.value || 'Analysis Test';
    
    if (!analysis) {
      sidebar.addLog('error', 'No page analysis available');
      return null;
    }
    
    sidebar.addLog('info', '🔍 Generating from page analysis...');
    
    try {
      const response = await fetch(`${serverUrl}${this.config.endpoint}/generate-from-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          test_name: testName,
          analysis: analysis,
          suggestions: sidebar.state.suggestions || []
        })
      });
      
      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        sidebar.addLog('success', `✓ Generated test from analysis: ${result.test_name}`);
        sidebar.addLog('info', `Page type: ${result.page_type}, App: ${result.app_type}`);
        return result.test_code;
      } else {
        throw new Error(result.detail || 'Generation failed');
      }
      
    } catch (error) {
      sidebar.addLog('error', `Analysis generation failed: ${error.message}`);
      return null;
    }
  },
  
  /**
   * Get suggested actions from current page analysis
   */
  async getSuggestedActions(sidebar) {
    const serverUrl = sidebar.options.serverUrl || 'http://localhost:8000';
    const analysis = sidebar.state.pageAnalysis;
    
    if (!analysis) {
      return null;
    }
    
    try {
      const response = await fetch(`${serverUrl}${this.config.endpoint}/suggest-actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis: analysis,
          suggestions: sidebar.state.suggestions || []
        })
      });
      
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('[FlowstralEngine] Failed to get suggestions:', error);
    }
    
    return null;
  },
  
  /**
   * Convert recorded action to Flowstral Engine format
   */
  _convertAction(action) {
    const converted = {
      type: action.type || 'click',
      description: action.description || action.text || '',
      selector: this._extractSelector(action.selector || action.selectorObj),
      value: action.value || action.inputValue || '',
      url: action.url || '',
    };
    
    // Add text content
    if (action.text) {
      converted.text = action.text;
    }
    
    // Add label for inputs
    if (action.label) {
      converted.label = action.label;
    }
    
    // Add placeholder for inputs
    if (action.placeholder) {
      converted.placeholder = action.placeholder;
    }
    
    // Add fallback selectors if available
    if (action.selectorObj?.fallbacks) {
      converted.fallback_selectors = action.selectorObj.fallbacks;
    }
    
    return converted;
  },
  
  /**
   * Extract selector string from various formats
   */
  _extractSelector(selectorObj) {
    if (!selectorObj) return '';
    
    if (typeof selectorObj === 'string') {
      return selectorObj;
    }
    
    // Priority: playwright > css > xpath > first available
    return selectorObj.playwright || 
           selectorObj.css || 
           selectorObj.xpath || 
           selectorObj.selector ||
           Object.values(selectorObj)[0] || '';
  },
  
  /**
   * Enhanced script generation that tries Flowstral Engine first
   * Patch this into the existing generateScript function
   */
  async enhancedGenerateScript(sidebar, originalGenerateScript) {
    // Check if Flowstral Engine mode is enabled
    const useEngine = sidebar.options.useFlowstralEngine ?? true;
    
    console.log('[FlowstralEngine] enhancedGenerateScript called, useEngine:', useEngine);
    
    if (useEngine) {
      console.log('[FlowstralEngine] Attempting to generate with Flowstral Engine...');
      
      // Try Flowstral Engine first
      const engineScript = await this.generateRobustTest(sidebar);
      
      if (engineScript) {
        console.log('[FlowstralEngine] ✓ Successfully generated with Engine!');
        sidebar.state.script = engineScript;
        
        // Display the script in the preview area
        if (sidebar.elements.scriptPreview) {
          sidebar.elements.scriptPreview.textContent = engineScript;
        }
        if (sidebar.elements.scriptEditor) {
          sidebar.elements.scriptEditor.value = engineScript;
        }
        
        // Switch to Script tab
        const scriptTab = document.querySelector('[data-tab="script"]');
        if (scriptTab) scriptTab.click();
        
        // Re-enable button
        if (sidebar.elements.generateBtn) {
          sidebar.elements.generateBtn.disabled = false;
          sidebar.elements.generateBtn.textContent = '⚡ Generate';
        }
        
        // Update UI
        if (typeof sidebar.updateUI === 'function') {
          sidebar.updateUI();
        }
        return;
      }
      
      // Fall through to original if engine fails
      console.log('[FlowstralEngine] Engine returned null, falling back to standard...');
      sidebar.addLog('info', 'Using standard generation...');
    } else {
      console.log('[FlowstralEngine] Engine disabled, using standard generation');
    }
    
    // Call original generateScript
    await originalGenerateScript.call(sidebar);
  },
  
  /**
   * Install the integration into the sidebar
   * Call this after SidebarController is initialized
   */
  install(sidebar) {
    console.log('[FlowstralEngine] Installing integration into sidebar...');
    console.log('[FlowstralEngine] sidebar.options:', sidebar.options);
    console.log('[FlowstralEngine] sidebar.generateScript exists:', typeof sidebar.generateScript);
    
    // Add option to sidebar
    sidebar.options.useFlowstralEngine = true;
    console.log('[FlowstralEngine] Set useFlowstralEngine = true');
    
    // Store original generateScript
    const originalGenerateScript = sidebar.generateScript.bind(sidebar);
    console.log('[FlowstralEngine] Stored original generateScript');
    
    // Replace generateScript with enhanced version
    sidebar.generateScript = async function() {
      console.log('[FlowstralEngine] >>> generateScript intercepted!');
      await FlowstralEngineIntegration.enhancedGenerateScript(this, originalGenerateScript);
    };
    
    console.log('[FlowstralEngine] Replaced generateScript with enhanced version');
    
    // Add method to generate from analysis
    sidebar.generateFromAnalysis = async function() {
      const analysis = this.state.pageAnalysis;
      if (!analysis) {
        this.addLog('error', 'No page analysis. Click "Refresh Analysis" in Suggest tab first.');
        return;
      }
      
      const script = await FlowstralEngineIntegration.generateFromAnalysis(this, analysis);
      if (script) {
        this.state.script = script;
        // Display the script
        if (this.elements.scriptPreview) {
          this.elements.scriptPreview.textContent = script;
        }
        if (this.elements.scriptEditor) {
          this.elements.scriptEditor.value = script;
        }
        // Switch to Script tab
        document.querySelector('[data-tab="script"]')?.click();
      }
    };
    
    // Add button for "Generate from Analysis" in Suggest tab
    this._addAnalysisGenerateButton(sidebar);
    
    console.log('[FlowstralEngine] Integration installed!');
  },
  
  /**
   * Add "Generate Robust Test" button to Suggest tab
   */
  _addAnalysisGenerateButton(sidebar) {
    const suggestTab = document.getElementById('tab-suggest');
    if (!suggestTab) return;
    
    // Find controls section or create one
    let controls = suggestTab.querySelector('.controls');
    if (!controls) {
      controls = document.createElement('div');
      controls.className = 'controls';
      controls.style.marginBottom = '12px';
      suggestTab.insertBefore(controls, suggestTab.firstChild.nextSibling);
    }
    
    // Add button
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.flex = '1';
    btn.innerHTML = '🚀 Generate Robust Test';
    btn.title = 'Generate test using Flowstral Engine with all discovered elements';
    btn.addEventListener('click', () => sidebar.generateFromAnalysis());
    
    controls.appendChild(btn);
  }
};

// Auto-install when DOM is ready - with safety checks
// Uses window.sidebar since that's where SidebarController is exposed
function tryInstallFlowstralEngine() {
  try {
    // Check window.sidebar since that's where it's exposed
    const sb = window.sidebar;
    console.log('[FlowstralEngine] Checking sidebar:', !!sb, 'generateScript:', typeof sb?.generateScript);
    
    if (sb && typeof sb.generateScript === 'function') {
      // Check if already installed
      if (sb._flowstralEngineInstalled) {
        console.log('[FlowstralEngine] Already installed, skipping');
        return true;
      }
      
      FlowstralEngineIntegration.install(sb);
      sb._flowstralEngineInstalled = true;
      
      // Add visual indicator
      const badge = document.createElement('div');
      badge.id = 'flowstral-badge';
      badge.innerHTML = '🚀 Engine';
      badge.style.cssText = 'position:fixed;top:5px;right:5px;background:#10b981;color:white;padding:2px 8px;border-radius:4px;font-size:10px;z-index:9999;';
      document.body.appendChild(badge);
      
      console.log('[FlowstralEngine] ✓ Integration active!');
      return true;
    }
    return false;
  } catch (e) {
    console.error('[FlowstralEngine] Installation error:', e);
    return false;
  }
}

// Retry installation a few times until sidebar is ready
let installAttempts = 0;
const maxAttempts = 20;  // Increased attempts

function attemptInstall() {
  installAttempts++;
  console.log(`[FlowstralEngine] Attempt ${installAttempts}/${maxAttempts}`);
  console.log(`[FlowstralEngine] window.sidebar exists:`, !!window.sidebar);
  console.log(`[FlowstralEngine] typeof sidebar:`, typeof window.sidebar);
  
  if (tryInstallFlowstralEngine()) {
    console.log(`[FlowstralEngine] ✓ Installed on attempt ${installAttempts}`);
    return;
  }
  
  if (installAttempts < maxAttempts) {
    setTimeout(attemptInstall, 300);  // Faster retry
  } else {
    console.error('[FlowstralEngine] ❌ Could not install after max attempts');
    // Force add a visual indicator that integration failed
    const errorBadge = document.createElement('div');
    errorBadge.innerHTML = '⚠️ Engine OFF';
    errorBadge.style.cssText = 'position:fixed;top:5px;right:5px;background:#ef4444;color:white;padding:2px 8px;border-radius:4px;font-size:10px;z-index:9999;cursor:pointer;';
    errorBadge.title = 'Flowstral Engine failed to load. Click to retry.';
    errorBadge.onclick = () => {
      installAttempts = 0;
      errorBadge.remove();
      attemptInstall();
    };
    document.body.appendChild(errorBadge);
  }
}

// Listen for sidebar ready event (primary method)
window.addEventListener('sidebarReady', (event) => {
  console.log('[FlowstralEngine] Received sidebarReady event!');
  if (event.detail?.sidebar) {
    window.sidebar = event.detail.sidebar;
    attemptInstall();
  }
});

// Start installation after DOM is ready (fallback method)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[FlowstralEngine] DOM loaded, waiting for sidebar...');
    setTimeout(attemptInstall, 800);  // Give sidepanel.js time to initialize
  });
} else {
  console.log('[FlowstralEngine] DOM already loaded, checking sidebar...');
  setTimeout(attemptInstall, 800);
}

// Export for manual usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FlowstralEngineIntegration;
}

