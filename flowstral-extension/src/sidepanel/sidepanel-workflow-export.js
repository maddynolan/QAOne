/**
 * Sidepanel Workflow Export & Saving helpers
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * These are standalone functions invoked by one-liner delegates in the class.
 */

/**
 * Generate script from current workflow steps — WITH ASSERTIONS.
 * @param {object} ctx - SidebarController instance
 */
async function spGenerateScriptFromWorkflow(ctx) {
  try {
    // Convert workflow to actions format - INCLUDING ASSERTIONS
    const actions = ctx.workflowSteps.map((step, idx) => ({
      type: step.type || 'click',
      selector: step.selectorObj || { playwright: step.selector },
      element: step.element,
      text: step.text,
      value: step.value,
      description: step.description,
      tagName: step.element === 'link' ? 'a' : step.element === 'button' ? 'button' : 'div',
      href: step.href,
      opensNewTab: step.opensNewTab,
      timestamp: step.timestamp,
      // NEW: Include assertion data for script generation
      assertion: step.assertion || { enabled: false },
      manualStep: step.manualStep
    }));

    // Save to background for script generation
    await chrome.runtime.sendMessage({
      type: 'SAVE_WORKFLOW',
      workflow: {
        name: `Workflow ${new Date().toLocaleString()}`,
        steps: actions,
        startUrl: ctx.state.startUrl || ctx.state.pageAnalysis?.url || '',
        createdAt: Date.now(),
        // NEW: Include assertions summary
        hasAssertions: actions.some(a => a.assertion?.enabled),
        assertionCount: actions.filter(a => a.assertion?.enabled).length
      }
    });

    // Update local state
    ctx.state.actions = actions;

    // Enable generate button
    if (ctx.elements.generateBtn) {
      ctx.elements.generateBtn.disabled = false;
    }

    // Switch to Script tab and generate
    const scriptTab = document.querySelector('[data-tab="script"]');
    if (scriptTab) scriptTab.click();

    setTimeout(() => ctx.generateScript(), 300);

  } catch (error) {
    console.error('[Sidebar] Generate script error:', error);
  }
}

/**
 * Save workflow as automated scenario/test.
 * @param {object} ctx - SidebarController instance
 */
async function spSaveWorkflowAsScenario(ctx) {
  if (ctx.workflowSteps.length === 0) {
    ctx.addLog('error', 'No steps in workflow');
    return;
  }

  try {
    // Convert workflow steps to recording actions format
    const actions = ctx.workflowSteps.map(step => ({
      type: step.type || 'click',
      selector: step.selectorObj || { playwright: step.selector },
      value: step.value,
      description: step.description || `${step.type} "${step.text}"`,
      timestamp: step.timestamp,
      text: step.text,
      opensNewTab: step.opensNewTab || false
    }));

    const workflowData = {
      name: `Flow ${new Date().toLocaleString()}`,
      steps: actions,
      startUrl: ctx.state.startUrl || ctx.state.pageAnalysis?.url || 'Unknown',
      createdAt: Date.now()
    };

    // Send to background to save as recording (for script generation)
    await chrome.runtime.sendMessage({
      type: 'SAVE_WORKFLOW',
      workflow: workflowData
    });

    // Also update local state.actions for script generation
    ctx.state.actions = actions;

    ctx.addLog('success', `Saved scenario with ${actions.length} steps`);

    // Also save to website backend if server is connected
    await spSaveToWebsiteWorkflowEditor(ctx, workflowData);

    // Enable the generate button
    if (ctx.elements.generateBtn) {
      ctx.elements.generateBtn.disabled = false;
    }

    // Switch to Script tab
    const scriptTab = document.querySelector('[data-tab="script"]');
    if (scriptTab) scriptTab.click();

    // Auto-generate script after short delay
    setTimeout(() => {
      ctx.generateScript();
    }, 300);

  } catch (error) {
    console.error('[Sidebar] Save scenario error:', error);
    ctx.addLog('error', 'Failed to save scenario: ' + error.message);
  }
}

/**
 * Save workflow to website backend for viewing in Workflow Editor.
 */
async function spSaveToWebsiteWorkflowEditor(ctx, workflowData) {
  try {
    const serverUrl = ctx.elements.serverUrl?.value || 'http://localhost:8000';

    // Convert to flowstral recording format for backend
    const recording = {
      name: workflowData.name,
      description: `Recorded workflow with ${workflowData.steps.length} steps`,
      start_url: workflowData.startUrl,
      actions: workflowData.steps.map((step, idx) => ({
        action_number: idx + 1,
        action_type: step.type || 'click',
        selector: typeof step.selector === 'object' ? step.selector : { playwright: step.selector },
        value: step.value || null,
        description: step.description,
        timestamp: step.timestamp,
        opens_new_tab: step.opensNewTab || false
      })),
      created_at: new Date().toISOString(),
      status: 'pending_review'
    };

    const response = await fetch(`${serverUrl}/api/flowstral/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recording)
    });

    if (response.ok) {
      const result = await response.json();
      ctx.addLog('success', `\u{1F4E4} Saved to Workflow Editor (ID: ${result.id || 'new'})`);
      console.log('[Sidebar] Saved to backend:', result);
    } else {
      console.warn('[Sidebar] Backend save failed:', response.status);
      ctx.addLog('info', 'Saved locally (backend unavailable)');
    }
  } catch (error) {
    console.warn('[Sidebar] Could not save to backend:', error.message);
    ctx.addLog('info', 'Saved locally (backend unavailable)');
  }
}

/**
 * Save as UNIFIED test case (both manual and automated in one).
 * This saves to the backend test_cases table.
 * @param {object} ctx - SidebarController instance
 */
async function spSaveAsUnifiedTestCase(ctx) {
  if (ctx.workflowSteps.length === 0) {
    ctx.addLog('error', 'No steps in workflow');
    return;
  }

  try {
    const serverUrl = ctx.elements.serverUrl?.value || 'http://localhost:8000';
    const testCaseName = `Test Case - ${new Date().toLocaleString()}`;

    // Build unified test case with both manual steps and automation data
    // Format matches backend schema - NOW WITH ASSERTIONS
    const testCase = {
      name: testCaseName,
      description: `Recorded test with ${ctx.workflowSteps.length} steps. Can be run in Manual or Automated mode. Includes ${ctx.workflowSteps.filter(s => s.assertion?.enabled).length} assertions.`,
      testType: 'unified',  // Can be run in manual OR automated mode
      priority: 'medium',
      status: 'active',

      // Steps in backend expected format WITH ASSERTIONS
      steps: ctx.workflowSteps.map((step, idx) => ({
        stepNumber: idx + 1,
        action: step.manualStep?.action || ctx.getManualTestAction(step),
        expectedResult: step.manualStep?.expectedResult || ctx.getExpectedResult(step),
        testData: step.value || '',

        // Include automation data in each step
        automationData: {
          actionType: step.type || 'click',
          selector: step.selectorObj || { playwright: step.selector },
          elementType: step.element,
          text: step.text,
          value: step.value,
          opensNewTab: step.opensNewTab || false
        },

        // NEW: Include assertion config for code generation
        assertion: step.assertion || { enabled: false },

        // NEW: Manual step description from workflow
        manualStep: step.manualStep
      })),

      // NEW: All assertions summary
      assertions: ctx.workflowSteps
        .filter(s => s.assertion?.enabled)
        .map(s => ({
          step: s.text || s.description,
          type: s.assertion.type,
          expected: s.assertion.expected || '',
          description: ctx.generateExpectedResult(s, s.assertion)
        })),

      // Automation metadata
      automationConfig: {
        startUrl: ctx.state.startUrl || ctx.state.pageAnalysis?.url || '',
        framework: 'playwright',
        canRunAutomated: true,
        canRunManual: true,
        hasAssertions: ctx.workflowSteps.some(s => s.assertion?.enabled)
      },

      // Tags for filtering
      tags: ['recorded', 'unified', 'can-automate', 'has-assertions'],

      // Source tracking
      source: 'flowstral-recorder'
    };

    ctx.addLog('info', 'Saving test case to backend...');

    // Save to backend - try /test-cases endpoint
    const response = await fetch(`${serverUrl}/test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase)
    });

    if (response.ok) {
      const result = await response.json();
      ctx.addLog('success', `\u2705 Test Case saved! ID: ${result.id || result.test_case_id || 'new'}`);

      // Also generate script for preview
      await ctx.generateScriptFromWorkflow();

      return result;
    } else {
      const errorText = await response.text();
      console.error('[Sidebar] Backend error:', errorText);
      ctx.addLog('error', 'Backend error: ' + (response.statusText || 'Failed to save'));

      // Try alternative endpoint
      await spSaveToAlternativeEndpoint(ctx, testCase);
    }
  } catch (error) {
    console.error('[Sidebar] Save test case error:', error);
    ctx.addLog('error', 'Could not save: ' + error.message);

    // Still generate script locally
    await ctx.generateScriptFromWorkflow();
  }
}

/**
 * Try alternative endpoints if main one fails.
 */
async function spSaveToAlternativeEndpoint(ctx, testCase) {
  const serverUrl = ctx.elements.serverUrl?.value || 'http://localhost:8000';

  // Try flowstral recordings endpoint
  try {
    const recording = {
      name: testCase.name,
      description: testCase.description,
      start_url: testCase.automation_data.start_url,
      actions: testCase.automation_data.actions,
      manual_steps: testCase.manual_steps,
      status: 'pending_review',
      test_type: 'unified'
    };

    const response = await fetch(`${serverUrl}/api/flowstral/recordings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(recording)
    });

    if (response.ok) {
      const result = await response.json();
      ctx.addLog('success', `\u2705 Saved as recording! ID: ${result.id}`);
      return result;
    }
  } catch (e) {
    console.warn('[Sidebar] Alternative endpoint also failed:', e);
  }

  ctx.addLog('info', 'Saved locally (backend unavailable)');
}

/**
 * Open the workflow in the website's Workflow Editor.
 * Converts workflow steps to Workflow Editor format and loads them.
 * @param {object} ctx - SidebarController instance
 */
async function spOpenInWorkflowEditor(ctx) {
  // Check for workflow steps from Suggest tab
  const steps = ctx.workflowSteps || [];
  // Also check recorded actions from Record tab
  const actions = ctx.state.actions || [];

  const hasWorkflow = steps.length > 0 || actions.length > 0;

  if (!hasWorkflow) {
    ctx.addLog('error', 'No steps or actions to export');
    return;
  }

  try {
    // Convert to Workflow Editor node format
    const nodes = [];
    // Use TEST STARTING URL input field, then page analysis URL as fallback
    const startUrl = ctx.elements.baseUrlInput?.value || ctx.state.startUrl || ctx.state.pageAnalysis?.url || '';

    // Add Navigate node first if we have a URL
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

    // Convert workflow steps (from Suggest tab) with assertion support
    steps.forEach((step, idx) => {
      const nodeType = ctx.mapStepTypeToNodeType(step.type || 'click');
      const yPos = 50 + ((idx + 1) * 80);

      nodes.push({
        id: `node-${idx + 1}`,
        type: nodeType,
        label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${step.text || step.description || ''}`.substring(0, 50),
        position: { x: 100, y: yPos },
        data: {
          selector: step.selectorObj?.playwright || step.selector || '',
          selectorMethod: 'playwright',
          value: step.value || '',
          description: step.description || step.text || '',
          assertType: nodeType === 'assert' ? 'visible' : undefined,
          // NEW: Include assertion data for unified test case support
          assertion: step.assertion || {
            enabled: false,
            type: 'visible',
            target: step.selectorObj?.playwright || step.selector || ''
          },
          // NEW: Include manual step data
          manualStep: step.manualStep || {
            action: ctx.generateManualAction(step),
            expectedResult: step.assertion?.enabled ?
              ctx.generateExpectedResult(step, step.assertion) :
              'Step completes successfully'
          },
          // NEW: Element index for handling duplicates
          elementIndex: step.elementIndex,
          totalDuplicates: step.totalDuplicates,
          hasDuplicates: step.hasDuplicates
        }
      });
    });

    // Convert recorded actions (from Record tab) if no workflow steps - with assertion support
    if (steps.length === 0 && actions.length > 0) {
      actions.forEach((action, idx) => {
        const nodeType = ctx.mapActionTypeToNodeType(action.type);
        const yPos = 50 + ((idx + 1) * 80);

        // Generate auto-assertion based on action type
        const autoAssertion = ctx.generateAutoAssertion(action, {});

        nodes.push({
          id: `node-${idx + 1}`,
          type: nodeType,
          label: `${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)}: ${action.text || action.description || ''}`.substring(0, 50),
          position: { x: 100, y: yPos },
          data: {
            selector: action.selectorObj?.playwright || action.selector || '',
            selectorMethod: 'playwright',
            value: action.value || '',
            description: action.description || action.text || '',
            // NEW: Include assertion data
            assertion: action.assertion || autoAssertion,
            // NEW: Include manual step data
            manualStep: action.manualStep || {
              action: ctx.generateManualAction(action),
              expectedResult: ctx.generateExpectedResult(action, autoAssertion)
            }
          }
        });
      });
    }

    // Build the workflow state (include startUrl!)
    const workflowState = {
      workflowName: `Recorded Workflow - ${new Date().toLocaleString()}`,
      appType: ctx.options.appType || 'generic',
      nodes: nodes,
      startUrl: startUrl  // Include startUrl for builder
    };

    console.log('[Sidebar] Exporting to Test Builder:', workflowState, 'Total nodes:', nodes.length);

    // Get frontend URL
    const frontendUrl = ctx.options.frontendUrl || 'http://localhost:8080';
    const builderUrl = `${frontendUrl}/builder`;

    ctx.addLog('info', `Opening Test Builder with ${nodes.length} steps...`);

    // Open the unified test builder tab first
    const tab = await chrome.tabs.create({ url: builderUrl });

    // Wait for tab to load, then inject data into localStorage
    const self = ctx;
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === tab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        // Inject script to set localStorage (unified test case format)
        chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: (data) => {
            console.log('[Test Builder Import] Importing workflow:', data);
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
                selector: node.data?.selector,
                value: node.data?.value,
                url: node.data?.url,
                enabled: true,
                expectedResult: node.data?.manualStep?.expectedResult || '',
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
            };
            localStorage.setItem('unified_test_case', JSON.stringify(unifiedTestCase));
            // Reload to pick up the new state
            setTimeout(() => window.location.reload(), 100);
          },
          args: [workflowState]
        }).then(() => {
          self.addLog('success', '\u2705 Test loaded in builder!');
        }).catch(err => {
          console.error('[Sidebar] Inject error:', err);
          self.addLog('error', 'Could not import: ' + err.message);
        });
      }
    });

  } catch (error) {
    console.error('[Sidebar] Open test builder error:', error);
    ctx.addLog('error', 'Failed to open: ' + error.message);

    // Try to open anyway
    const frontendUrl = ctx.options.frontendUrl || 'http://localhost:8080';
    chrome.tabs.create({ url: `${frontendUrl}/builder` });
  }
}
