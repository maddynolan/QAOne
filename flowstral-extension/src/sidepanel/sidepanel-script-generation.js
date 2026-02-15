/**
 * Sidepanel Script Generation, Test Execution & Workflow Editor export
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * Standalone functions invoked by one-liner delegates in the class.
 */

/**
 * Generate Playwright / multi-framework script from recorded actions.
 */
async function spGenerateScript(ctx) {
  if (ctx.state.actions.length === 0) {
    ctx.addLog('error', 'No actions to generate script from');
    return;
  }

  try {
    ctx.elements.generateBtn.disabled = true;
    ctx.elements.generateBtn.textContent = '⏳ Generating...';
    ctx.addLog('info', 'Generating script...');

    // Get fresh actions from background
    const actionsResponse = await chrome.runtime.sendMessage({ type: 'GET_ACTIONS' });
    ctx.state.actions = actionsResponse?.actions || [];

    if (ctx.state.actions.length === 0) {
      ctx.addLog('error', 'No actions found');
      return;
    }

    // Check server connection
    if (!ctx.state.serverConnected) {
      await ctx.checkServerConnection();
    }

    if (!ctx.state.serverConnected) {
      // Generate locally via background script
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_SCRIPT',
        options: { language: ctx.options.language }
      });

      if (response?.script) {
        ctx.state.script = response.script;
        ctx.addLog('success', 'Script generated (local)');
      } else {
        throw new Error('Failed to generate script locally');
      }
    } else {
      // Generate via backend API with all options
      const framework = ctx.options.language || 'playwright-python';
      const isPlaywright = framework.startsWith('playwright-');

      const generateOptions = {
        language: framework,
        // Advanced features
        selfHealing: ctx.options.selfHealing,
        smartWaits: ctx.options.smartWaits,
        screenshotOnFailure: ctx.options.screenshotOnFailure,
        generateAssertions: ctx.options.generateAssertions,
        // Enterprise features
        pageObjectModel: ctx.options.pageObjectModel,
        dataDriven: ctx.options.dataDriven,
        crossBrowser: ctx.options.crossBrowser,
        visualRegression: ctx.options.visualRegression,
      };

      // Use framework converter for non-Playwright frameworks
      // Use enhanced generator for Playwright with enterprise features
      let endpoint;
      let requestBody;

      // Get base URL from input (user-specified) or fallback to first action URL
      const baseUrl = ctx.elements.baseUrlInput?.value || ctx.state.actions[0]?.url || '';
      console.log('[Sidebar] Using base URL for test:', baseUrl);

      if (!isPlaywright) {
        // Use multi-framework converter
        endpoint = `${ctx.options.serverUrl}/api/flowstral/convert`;
        requestBody = {
          actions: ctx.state.actions,
          framework: framework,
          metadata: {
            name: ctx.elements.testCaseName?.value || 'Recorded Test',
            startUrl: baseUrl,  // Use user-specified base URL
            appType: ctx.options.appType
          },
          options: { pageObjectModel: ctx.options.pageObjectModel }
        };
      } else {
        // ALWAYS use Flowstral Engine for robust, self-healing tests
        endpoint = `${ctx.options.serverUrl}/flowstral/build-from-recording`;
        requestBody = {
          name: ctx.elements.testCaseName?.value || 'Recorded Test',
          url: baseUrl,
          actions: ctx.state.actions.map(a => ({
            type: a.type,
            selector: a.selectorObj?.playwright || a.selector?.playwright || a.selector || '',
            value: a.value || '',
            text: a.text || a.description || '',
            timestamp: a.timestamp || Date.now()
          })),
          app_type: ctx.options.appType || 'auto'
        };
        console.log('[Sidebar] Using Flowstral Engine endpoint:', endpoint);
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Handle Flowstral Engine response format
      if (result.test_code) {
        // Flowstral Engine response
        ctx.state.script = result.test_code;
        const appType = result.detected_app_type || 'auto';
        const actionCount = result.action_count || ctx.state.actions.length;
        ctx.addLog('success', `🚀 Flowstral Engine: Generated ${actionCount} steps (${appType})`);
        console.log('[Sidebar] Flowstral Engine test generated:', result.test_name);
      } else if (result.script) {
        // Legacy response format
        ctx.state.script = result.script;

        // Store additional generated content
        if (result.page_objects && Object.keys(result.page_objects).length > 0) {
          ctx.state.pageObjects = result.page_objects;
          ctx.addLog('success', `Generated POM classes: ${Object.keys(result.page_objects).join(', ')}`);
        }
        if (result.test_data && result.test_data.length > 0) {
          ctx.state.testData = result.test_data;
          ctx.addLog('info', `Extracted ${result.test_data.length} data parameters`);
        }
        if (result.config) {
          ctx.state.crossBrowserConfig = result.config;
        }

        // Handle framework-specific response
        const frameworkName = result.framework || ctx.options.language;
        const features = result.metadata?.features || [];
        let logMsg = `Script generated for ${frameworkName} (${result.action_count || ctx.state.actions.length} actions)`;
        if (features.length > 0) {
          logMsg += ` [${features.join(', ')}]`;
        }
        if (result.dependencies?.length > 0) {
          ctx.addLog('info', `Dependencies: ${result.dependencies.join(', ')}`);
        }
        if (result.setup_instructions) {
          ctx.addLog('info', `Setup: ${result.setup_instructions}`);
        }
        ctx.addLog('success', logMsg);
      } else {
        throw new Error('No script in response');
      }
    }

    ctx.updateUI();

    // Update POM and Test Data sections if they were generated
    ctx.updatePomSection();
    ctx.updateTestDataSection();

    // Switch to script tab
    document.querySelector('[data-tab="script"]').click();

  } catch (error) {
    console.error('[Sidebar] Failed to generate script:', error);
    ctx.addLog('error', `Generation failed: ${error.message}`);
  } finally {
    ctx.elements.generateBtn.disabled = ctx.state.actions.length === 0;
    ctx.elements.generateBtn.textContent = '⚡ Generate';
  }
}

/**
 * Run the generated test script against the backend.
 */
async function spRunTest(ctx) {
  if (!ctx.state.script) {
    ctx.addLog('error', 'No script to run. Generate a script first.');
    return;
  }

  // Check server connection
  if (!ctx.state.serverConnected) {
    await ctx.checkServerConnection();
  }

  if (!ctx.state.serverConnected) {
    ctx.addLog('error', 'Backend server not connected. Start the server first.');
    return;
  }

  try {
    ctx.state.running = true;
    ctx.updateUI();

    ctx.clearLogs();
    ctx.addLog('info', 'Starting test execution...');
    ctx.addLog('info', `Browser: ${ctx.options.browser}, Headed: ${ctx.options.showBrowser}`);

    // Update results UI
    ctx.elements.resultsTitle.innerHTML = '<span>⏳</span> Running test...';
    ctx.elements.resultsStats.classList.add('hidden');

    const startTime = Date.now();

    const response = await fetch(`${ctx.options.serverUrl}/api/flowstral/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        script: ctx.state.script,
        language: ctx.options.language,
        browser: ctx.options.browser,
        headless: !ctx.options.showBrowser,
        timeout: 60000
      })
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const executionResult = result.execution_result || result;
    const status = executionResult.status || result.status;

    // Update results UI
    if (status === 'passed' || status === 'success') {
      ctx.elements.resultsTitle.innerHTML = '<span>✅</span> Test Passed';
      ctx.elements.passedCount.textContent = '1';
      ctx.elements.failedCount.textContent = '0';
      ctx.addLog('success', `Test passed in ${duration}s`);
    } else {
      ctx.elements.resultsTitle.innerHTML = '<span>❌</span> Test Failed';
      ctx.elements.passedCount.textContent = '0';
      ctx.elements.failedCount.textContent = '1';

      // Show detailed error information
      const errorMsg = executionResult.error || executionResult.stderr || executionResult.stdout || 'Unknown error';
      ctx.addLog('error', `Test failed: ${errorMsg.substring(0, 1000)}`);

      // Show full stderr if available
      if (executionResult.stderr) {
        const stderrLines = executionResult.stderr.split('\n').slice(0, 20); // First 20 lines
        stderrLines.forEach(line => {
          if (line.trim()) {
            ctx.addLog('error', line.substring(0, 200));
          }
        });
      }

      // Show stdout if available (might contain useful info)
      if (executionResult.stdout && !executionResult.stderr) {
        const stdoutLines = executionResult.stdout.split('\n').slice(0, 20);
        stdoutLines.forEach(line => {
          if (line.trim() && (line.includes('Error') || line.includes('error') || line.includes('Failed') || line.includes('Traceback'))) {
            ctx.addLog('error', line.substring(0, 200));
          }
        });
      }

      // Show error details if available
      if (executionResult.error_details && executionResult.error_details.length > 0) {
        executionResult.error_details.forEach(detail => {
          ctx.addLog('error', `Test: ${detail.test || 'Unknown'}`);
          ctx.addLog('error', `Error: ${detail.error || 'Unknown error'}`);
        });
      }
    }

    ctx.elements.duration.textContent = `${duration}s`;
    ctx.elements.resultsStats.classList.remove('hidden');

  } catch (error) {
    console.error('[Sidebar] Test execution failed:', error);
    ctx.elements.resultsTitle.innerHTML = '<span>❌</span> Execution Error';
    ctx.addLog('error', `Execution error: ${error.message}`);
  } finally {
    ctx.state.running = false;
    ctx.updateUI();
  }
}

/**
 * Open recorded actions in the Unified Workflow Editor (Test Builder).
 */
async function spOpenInWorkflowEditorFromRecord(ctx) {
  if (!ctx.state.actions || ctx.state.actions.length === 0) {
    ctx.addLog('error', 'No actions to export');
    return;
  }

  try {
    // Convert recorded actions to Workflow Editor node format
    const nodes = [];
    // Use the TEST STARTING URL input field value, not state.startUrl
    const startUrl = ctx.elements.baseUrlInput?.value || ctx.state.startUrl || '';

    // Add Navigate node first if we have a start URL
    if (startUrl) {
      nodes.push({
        id: 'node-navigate',
        type: 'navigate',
        label: 'Navigate',
        position: { x: 100, y: 50 },
        data: {
          url: startUrl,
          description: `Navigate to ${startUrl}`
        }
      });
    }

    // Convert each recorded action to a node
    ctx.state.actions.forEach((action, idx) => {
      const nodeType = ctx.mapActionTypeToNodeType ?
        ctx.mapActionTypeToNodeType(action.type) :
        (action.type === 'fill' ? 'input' : action.type || 'click');
      const yPos = 50 + ((startUrl ? idx + 1 : idx) * 80);

      // Get clean label text - remove duplicate type prefixes
      let labelText = action.text || action.description || '';
      // Remove redundant patterns like "Click: Click" or "Navigate: Navigate"
      labelText = labelText.replace(/^(Click|Input|Navigate|Select):\s*\1\s*/i, '$1: ');
      // Remove any leading type prefix for clean labeling
      const textOnly = labelText.replace(/^(Click|Input|Navigate|Select):\s*/i, '').trim();
      const cleanLabel = textOnly ? `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${textOnly}` : nodeType.charAt(0).toUpperCase() + nodeType.slice(1);

      nodes.push({
        id: `node-${idx + 1}`,
        type: nodeType,
        label: cleanLabel.substring(0, 50),
        position: { x: 100, y: yPos },
        data: {
          // CRITICAL: Preserve full selectorObj for fallback support (same as Suggest)
          selector: action.selector,  // Keep original (may be object or string)
          selectorObj: action.selectorObj || (typeof action.selector === 'object' ? action.selector : null),
          selectorMethod: 'playwright',
          value: action.value || '',
          description: action.description || action.text || '',
          url: action.url || '',
          // Preserve extra attributes for fallback selectors
          text: action.text || action.innerText,
          name: action.name,
          ariaLabel: action.ariaLabel || action['aria-label'],
          id: action.id,
        }
      });
    });

    // Get protocol/network data from background if available
    let networkData = null;
    if (ctx.state.hasProtocolData || ctx.state.captureNetwork) {
      try {
        const response = await new Promise(resolve => {
          chrome.runtime.sendMessage({ type: 'GET_NETWORK_DATA' }, resolve);
        });
        if (response && response.networkData) {
          networkData = response.networkData;
          console.log('[Sidebar] Including protocol data:', networkData.requests?.length || 0, 'requests');
        }
      } catch (e) {
        console.warn('[Sidebar] Could not get network data:', e);
      }
    }

    // Build the workflow state for the editor (include startUrl and protocol data!)
    const workflowState = {
      workflowName: `Recording - ${new Date().toLocaleString()}`,
      appType: ctx.options.appType || 'generic',
      nodes: nodes,
      startUrl: startUrl,  // Include startUrl for builder
      // Include protocol data for load testing
      networkData: networkData,
      hasProtocolData: !!networkData && (networkData.requests?.length || 0) > 0,
    };

    console.log('[Sidebar] Exporting recorded actions to Test Builder:', workflowState, 'Total nodes:', nodes.length);
    if (networkData) {
      console.log('[Sidebar] Protocol data included:', networkData.requests?.length, 'requests,', networkData.correlations?.length || 0, 'correlations');
    }

    // Get frontend URL
    const frontendUrl = ctx.options.frontendUrl || 'http://localhost:8080';
    const builderUrl = `${frontendUrl}/builder`;

    // Open the unified test builder tab
    const tab = await chrome.tabs.create({ url: builderUrl });

    // Wait for tab to load then inject the data into localStorage
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        // Inject script to set localStorage (unified test case format)
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (data) => {
            console.log('[Test Builder Import] Importing from recording:', data);
            console.log('[Test Builder Import] Protocol data:', data.hasProtocolData ? 'YES' : 'NO', data.networkData?.requests?.length || 0, 'requests');

            // Convert to unified test case format
            const unifiedTestCase = {
              id: `tc_${Date.now()}`,
              name: data.workflowName || 'Recorded Test',
              description: '',
              tags: [],
              steps: data.nodes.map((node, idx) => ({
                id: `step_${Date.now()}_${idx}`,
                type: node.type || 'click',
                name: node.label || 'Step',
                // CRITICAL: Preserve full selector data for fallback support (same as Suggest)
                selector: typeof node.data?.selector === 'string' ? node.data.selector :
                          (node.data?.selector?.playwright || node.data?.selector?.selector || ''),
                selectorObj: node.data?.selectorObj || (typeof node.data?.selector === 'object' ? node.data.selector : null),
                value: node.data?.value,
                url: node.data?.url,
                enabled: true,
                expectedResult: node.data?.manualStep?.expectedResult || '',
                // Preserve extra attributes for fallback selectors
                target: node.data?.text || node.data?.description,
              })),
              variables: [],
              settings: {
                baseUrl: data.startUrl || '',
                timeout: 30000,
                retries: 0,
                parallelizable: false,
              },
              metadata: {
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                version: 1,
              },
              // PROTOCOL DATA for load testing
              network_data: data.networkData || null,
              has_protocol_data: data.hasProtocolData || false,
            };
            localStorage.setItem('unified_test_case', JSON.stringify(unifiedTestCase));
            console.log('[Test Builder Import] Saved unified_test_case with protocol data:', unifiedTestCase.has_protocol_data);
            setTimeout(() => window.location.reload(), 100);
          },
          args: [workflowState]
        }).then(() => {
          ctx.addLog('success', '✅ Recording loaded in Test Builder!' + (workflowState.hasProtocolData ? ' (with protocol data)' : ''));
        }).catch(err => {
          console.error('[Sidebar] Inject error:', err);
        });
      }
    });

    ctx.addLog('success', `Opening Test Builder with ${nodes.length} steps...`);

    if (ctx.elements.openWorkflowBtn) {
      const originalText = ctx.elements.openWorkflowBtn.textContent;
      ctx.elements.openWorkflowBtn.textContent = '✓ Opened';
      setTimeout(() => {
        ctx.elements.openWorkflowBtn.textContent = originalText;
      }, 2000);
    }

  } catch (error) {
    console.error('[Sidebar] Failed to open workflow editor:', error);
    ctx.addLog('error', `Failed to open workflow editor: ${error.message}`);
  }
}
