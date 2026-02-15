/**
 * Sidepanel AI Assist & Desktop Integration helpers
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * These are standalone functions invoked by one-liner delegates in the class.
 */

// ============================================
// OPEN IN DESKTOP RECORDER
// ============================================

/**
 * Save session and open in Desktop Recorder.
 * @param {object} ctx - SidebarController instance
 */
async function spOpenInDesktopRecorder(ctx) {
  if (ctx.state.actions.length === 0) {
    ctx.addLog('warn', 'No actions recorded yet');
    return;
  }

  ctx.addLog('info', 'Saving session and opening in Desktop Recorder...');

  try {
    // Save session to backend first
    const sessionId = `ext_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const sessionData = {
      session_id: sessionId,
      actions: ctx.state.actions,
      metadata: {
        source: 'extension',
        appType: ctx.options.appType,
        startUrl: ctx.options.baseUrl,
        recordedAt: new Date().toISOString(),
      },
    };

    const serverUrl = ctx.options.serverUrl || (typeof getServerUrl === 'function' ? getServerUrl() : 'http://localhost:8000');
    const response = await fetch(`${serverUrl}/api/flowstral/save-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sessionData),
    });

    if (!response.ok) {
      throw new Error(`Save failed: ${response.status}`);
    }

    // Open in desktop recorder
    const frontendUrl = ctx.options.frontendUrl || (typeof getFrontendUrl === 'function' ? getFrontendUrl() : 'http://localhost:8080');
    const desktopUrl = `${frontendUrl}/recorder?sessionId=${encodeURIComponent(sessionId)}`;
    chrome.tabs.create({ url: desktopUrl });

    ctx.addLog('success', `Opened in Desktop Recorder (session: ${sessionId.substring(0, 12)}...)`);
  } catch (error) {
    ctx.addLog('error', `Failed to open in Desktop: ${error.message}`);
    console.error('[Sidebar] openInDesktopRecorder error:', error);
  }
}

// ============================================
// AI AUTO-FIX — Fix broken step selectors
// ============================================

/**
 * Run AI auto-fix for a broken step.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step to fix
 */
async function spHandleAiFix(ctx, stepIndex) {
  const action = ctx.state.actions[stepIndex];
  if (!action) return;

  ctx.addLog('info', `\u{1F916} Running AI auto-fix for step ${stepIndex + 1}...`);

  // Show spinner on the action item
  const items = ctx.elements.actionsList.querySelectorAll('.action-item');
  const item = items[stepIndex];
  if (item) {
    const fixBtn = item.querySelector('[onclick*="handleAiFix"]');
    if (fixBtn) {
      fixBtn.textContent = '\u23F3';
      fixBtn.disabled = true;
    }
  }

  try {
    if (typeof aiAutoFixStep !== 'function') {
      throw new Error('AI enhancements module not loaded');
    }

    const sessionId = `ext_${Date.now()}`;
    const result = await aiAutoFixStep({
      test_id: sessionId,
      step_id: action.id || `step-${stepIndex}`,
      step_index: stepIndex,
      step_label: action.description || ctx.getActionDescription(action),
      failed_selector: action.selector?.primary?.css || action.selector?.selector || '',
      error_message: action._error || 'Element not found',
      step_info: {
        type: action.type,
        selector: action.selector,
        value: action.value,
      },
      page_url: action.url || ctx.options.baseUrl,
    });

    if (result.success && result.fixed_selector) {
      // Apply the fixed selector
      if (!action.selector) action.selector = {};
      action.selector.primary = { css: result.fixed_selector };
      action.selector.selector = result.fixed_selector;
      action._status = 'healed';
      ctx.addLog('success', `\u2705 Step ${stepIndex + 1} fixed: ${result.strategy_used} (${Math.round(result.confidence * 100)}% confidence)`);
    } else {
      // AI failed — show Manual Assist inline
      ctx.addLog('warn', `\u26A0\uFE0F AI couldn't fix step ${stepIndex + 1}. Try Manual Assist.`);
      ctx.manualAssistStepIndex = stepIndex;
    }

    ctx.renderActionsList();
  } catch (error) {
    ctx.addLog('error', `AI Fix failed: ${error.message}`);
    ctx.manualAssistStepIndex = stepIndex;
    ctx.renderActionsList();
  }
}

// ============================================
// FLAG / UNFLAG FALSE POSITIVE
// ============================================

/**
 * Toggle false positive flag on a step.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step to flag
 */
async function spHandleFlag(ctx, stepIndex) {
  const action = ctx.state.actions[stepIndex];
  if (!action) return;

  const stepId = action.id || `step-${stepIndex}`;
  const testId = `ext_session`;

  if (ctx.falsePositiveFlags.has(stepId)) {
    // Unflag
    if (typeof aiRemoveFalsePositive === 'function') {
      await aiRemoveFalsePositive(testId, stepId);
    }
    ctx.falsePositiveFlags.delete(stepId);
    ctx.addLog('info', `Step ${stepIndex + 1} unflagged`);
  } else {
    // Flag as false positive
    if (typeof aiSaveFalsePositive === 'function') {
      await aiSaveFalsePositive({
        test_id: testId,
        step_id: stepId,
        step_index: stepIndex,
        step_label: action.description || ctx.getActionDescription(action),
        reason: 'Flagged from extension',
      });
    }
    ctx.falsePositiveFlags.set(stepId, true);
    ctx.addLog('info', `\u{1F6A9} Step ${stepIndex + 1} flagged as false positive`);
  }

  ctx.renderActionsList();
}

// ============================================
// MANUAL ASSIST — Toggle inline card
// ============================================

/**
 * Toggle manual assist card for a step.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step
 */
function spHandleManualAssist(ctx, stepIndex) {
  if (ctx.manualAssistStepIndex === stepIndex) {
    // Toggle off
    ctx.manualAssistStepIndex = null;
  } else {
    ctx.manualAssistStepIndex = stepIndex;
  }
  ctx.renderActionsList();
}

/**
 * Create the inline Manual Assist card DOM for a step.
 * Two modes: Paste Element and Enter Selector.
 * @param {object} ctx - SidebarController instance
 * @param {object} action - The action object
 * @param {number} stepIndex - Index of the step
 */
function spCreateManualAssistCard(ctx, action, stepIndex) {
  const card = document.createElement('div');
  card.className = 'manual-assist-card';
  card.style.cssText = 'background:rgba(56,189,248,0.08);border:1px solid rgba(56,189,248,0.3);border-radius:8px;padding:10px;margin:4px 0 8px 28px;';

  const stepId = action.id || `step-${stepIndex}`;
  const stepLabel = action.description || ctx.getActionDescription(action);

  card.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <span style="font-size:11px;font-weight:600;color:#38bdf8;">\u{1F527} Manual Assist</span>
      <button onclick="sidebar.handleManualAssist(${stepIndex})" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:14px;">\u2715</button>
    </div>
    <!-- Tab buttons -->
    <div style="display:flex;gap:4px;margin-bottom:8px;">
      <button class="ma-tab-btn active" data-ma-tab="paste" onclick="sidebar._switchManualAssistTab(this,'paste')" style="font-size:10px;padding:3px 8px;border:1px solid rgba(56,189,248,0.4);border-radius:4px;background:rgba(56,189,248,0.2);color:#38bdf8;cursor:pointer;">Paste Element</button>
      <button class="ma-tab-btn" data-ma-tab="selector" onclick="sidebar._switchManualAssistTab(this,'selector')" style="font-size:10px;padding:3px 8px;border:1px solid rgba(139,92,246,0.4);border-radius:4px;background:transparent;color:#a78bfa;cursor:pointer;">Enter Selector</button>
    </div>
    <!-- Paste Element tab -->
    <div class="ma-tab-content" data-ma-content="paste">
      <p style="font-size:10px;color:#94a3b8;margin-bottom:6px;">Right-click element in DevTools \u2192 Copy \u2192 Copy outerHTML, then paste below:</p>
      <textarea id="maHtmlInput_${stepIndex}" placeholder='<button class="btn" data-testid="submit">Submit</button>' style="width:100%;height:60px;font-family:monospace;font-size:10px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:white;padding:6px;resize:vertical;box-sizing:border-box;"></textarea>
      <button onclick="sidebar._submitManualAssistPaste(${stepIndex})" style="width:100%;margin-top:6px;font-size:10px;padding:5px;border:none;border-radius:4px;background:linear-gradient(135deg,#38bdf8,#8b5cf6);color:white;cursor:pointer;font-weight:600;">Generate Selectors</button>
    </div>
    <!-- Enter Selector tab -->
    <div class="ma-tab-content" data-ma-content="selector" style="display:none;">
      <div style="display:flex;gap:4px;margin-bottom:6px;">
        <select id="maSelectorType_${stepIndex}" style="font-size:10px;padding:3px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:white;">
          <option value="css">CSS</option>
          <option value="xpath">XPath</option>
          <option value="text">Text</option>
        </select>
        <input id="maSelectorInput_${stepIndex}" type="text" placeholder='[data-testid="submit"]' style="flex:1;font-family:monospace;font-size:10px;padding:3px 6px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:white;">
      </div>
      <button onclick="sidebar._submitManualAssistSelector(${stepIndex})" style="width:100%;font-size:10px;padding:5px;border:none;border-radius:4px;background:linear-gradient(135deg,#8b5cf6,#38bdf8);color:white;cursor:pointer;font-weight:600;">Apply Selector</button>
    </div>
    <!-- Results area -->
    <div id="maResults_${stepIndex}" style="margin-top:8px;display:none;"></div>
  `;

  return card;
}

/**
 * Switch between manual assist tab (paste / selector).
 */
function spSwitchManualAssistTab(btn, tabName) {
  // Update tab button styles
  const card = btn.closest('.manual-assist-card');
  card.querySelectorAll('.ma-tab-btn').forEach(b => {
    b.classList.remove('active');
    b.style.background = 'transparent';
  });
  btn.classList.add('active');
  btn.style.background = tabName === 'paste' ? 'rgba(56,189,248,0.2)' : 'rgba(139,92,246,0.2)';

  // Show/hide content
  card.querySelectorAll('.ma-tab-content').forEach(c => c.style.display = 'none');
  card.querySelector(`[data-ma-content="${tabName}"]`).style.display = 'block';
}

/**
 * Submit manual assist "paste element" mode.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step
 */
async function spSubmitManualAssistPaste(ctx, stepIndex) {
  const action = ctx.state.actions[stepIndex];
  const html = document.getElementById(`maHtmlInput_${stepIndex}`)?.value?.trim();
  if (!html) {
    ctx.addLog('warn', 'Paste the element HTML first');
    return;
  }

  const resultsEl = document.getElementById(`maResults_${stepIndex}`);
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<p style="font-size:10px;color:#94a3b8;">\u23F3 Generating selectors...</p>';

  try {
    if (typeof aiManualAssistPasteElement !== 'function') {
      throw new Error('AI module not loaded');
    }

    const result = await aiManualAssistPasteElement({
      test_id: 'ext_session',
      step_id: action.id || `step-${stepIndex}`,
      step_index: stepIndex,
      step_label: action.description || ctx.getActionDescription(action),
      html_content: html,
      failed_selector: action.selector?.primary?.css || '',
      page_url: action.url || ctx.options.baseUrl,
    });

    if (result.success && result.selectors?.length > 0) {
      spRenderManualAssistResults(ctx, resultsEl, result.selectors, stepIndex);
    } else {
      resultsEl.innerHTML = `<p style="font-size:10px;color:#f87171;">${result.message || 'No selectors generated'}</p>`;
    }
  } catch (error) {
    resultsEl.innerHTML = `<p style="font-size:10px;color:#f87171;">Error: ${error.message}</p>`;
  }
}

/**
 * Submit manual assist "enter selector" mode.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step
 */
async function spSubmitManualAssistSelector(ctx, stepIndex) {
  const action = ctx.state.actions[stepIndex];
  const selectorType = document.getElementById(`maSelectorType_${stepIndex}`)?.value || 'css';
  const selectorValue = document.getElementById(`maSelectorInput_${stepIndex}`)?.value?.trim();

  if (!selectorValue) {
    ctx.addLog('warn', 'Enter a selector first');
    return;
  }

  const resultsEl = document.getElementById(`maResults_${stepIndex}`);
  resultsEl.style.display = 'block';
  resultsEl.innerHTML = '<p style="font-size:10px;color:#94a3b8;">\u23F3 Validating selector...</p>';

  try {
    if (typeof aiManualAssistEnterSelector !== 'function') {
      throw new Error('AI module not loaded');
    }

    const result = await aiManualAssistEnterSelector({
      test_id: 'ext_session',
      step_id: action.id || `step-${stepIndex}`,
      step_index: stepIndex,
      step_label: action.description || ctx.getActionDescription(action),
      selector_type: selectorType,
      selector_value: selectorValue,
    });

    if (result.success && result.selectors?.length > 0) {
      spRenderManualAssistResults(ctx, resultsEl, result.selectors, stepIndex);
    } else {
      resultsEl.innerHTML = `<p style="font-size:10px;color:#f87171;">${result.message || 'Invalid selector'}</p>`;
    }
  } catch (error) {
    resultsEl.innerHTML = `<p style="font-size:10px;color:#f87171;">Error: ${error.message}</p>`;
  }
}

/**
 * Render manual assist selector results.
 */
function spRenderManualAssistResults(ctx, container, selectors, stepIndex) {
  let html = '';
  selectors.forEach((sel, i) => {
    const confidencePct = Math.round((sel.confidence || 0) * 100);
    const color = confidencePct >= 80 ? '#22c55e' : confidencePct >= 50 ? '#f59e0b' : '#ef4444';
    const isRecommended = i === 0;
    html += `
      <div style="display:flex;align-items:center;gap:6px;padding:4px 6px;margin-bottom:3px;background:rgba(0,0,0,0.2);border-radius:4px;${isRecommended ? 'border:1px solid rgba(34,197,94,0.4);' : ''}">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;color:white;font-family:monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(sel.selector || '').replace(/"/g, '&quot;')}">${sel.selector || sel.playwright_locator || ''}</div>
          <div style="font-size:9px;color:#94a3b8;">${sel.strategy || sel.description || ''} <span style="color:${color};">${confidencePct}%</span></div>
        </div>
        <button onclick="sidebar._applyManualAssistSelector(${stepIndex}, '${(sel.selector || '').replace(/'/g, "\\'")}')" style="font-size:9px;padding:2px 8px;border:none;border-radius:3px;background:${isRecommended ? '#22c55e' : '#6366f1'};color:white;cursor:pointer;white-space:nowrap;">Use</button>
      </div>
    `;
  });
  container.innerHTML = html;
}

/**
 * Apply a selector from manual assist results to the step.
 * @param {object} ctx - SidebarController instance
 * @param {number} stepIndex - Index of the step
 * @param {string} selector - The selector to apply
 */
function spApplyManualAssistSelector(ctx, stepIndex, selector) {
  const action = ctx.state.actions[stepIndex];
  if (!action) return;

  // Apply the selector to the action
  if (!action.selector) action.selector = {};
  action.selector.primary = { css: selector };
  action.selector.selector = selector;
  action._status = 'healed';

  // Close the manual assist card
  ctx.manualAssistStepIndex = null;

  ctx.addLog('success', `\u2705 Step ${stepIndex + 1} selector updated via Manual Assist`);
  ctx.renderActionsList();
}
