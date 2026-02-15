/**
 * Extracted: _toQWord method from PlaywrightRecorder
 * Converts actions to QWord format (EXACT SAME as browser extension).
 *
 * Receives `recorder` (the PlaywrightRecorder instance) as first param instead of `this`.
 */

/**
 * Convert action to QWord format (EXACT SAME as browser extension)
 * ENTERPRISE-GRADE: Properly preserves ALL element attributes for robust playback
 * @param {Object} recorder - The PlaywrightRecorder instance
 * @param {Object} action - The action to convert
 * @returns {Object} QWord-formatted action
 */
function _toQWord(recorder, action) {
    const element = action.element || action;
    const existingSelector = action.selector || element.selectorObj || {};

    // Get text for description
    const text = element.textContent || element.innerText || element.text || '';
    const cleanText = text.trim().substring(0, 50);

    // ════════════════════════════════════════════════════════════════════════════
    // BUILD SELECTOR OBJECT WITH ALL ELEMENT ATTRIBUTES
    // This is CRITICAL for reliable test playback!
    // Priority order: testId > name > id > ariaLabel > placeholder
    // ════════════════════════════════════════════════════════════════════════════

    // Extract all element attributes from the action
    const testId = action.testId || action.dataTestId || element.testId || element.dataTestId || '';
    const name = action.name || element.name || '';
    const id = action.id || element.id || '';
    const ariaLabel = action.ariaLabel || element.ariaLabel || '';
    const placeholder = action.placeholder || element.placeholder || '';
    const title = action.title || element.title || '';
    const role = action.role || element.role || '';
    const href = action.href || element.href || '';
    const tagName = action.tag || action.tagName || element.tagName || '';

    // Build the best CSS selector based on priority
    let bestSelector = existingSelector.selector || '';
    if (testId) {
      bestSelector = `[data-testid="${testId}"]`;
    } else if (name) {
      bestSelector = `[name="${name}"]`;
    } else if (id && !recorder._isDynamicId(id)) {
      bestSelector = `#${id}`;
    } else if (ariaLabel) {
      bestSelector = `[aria-label="${ariaLabel}"]`;
    }

    // Build comprehensive selectorObj for robust playback
    const selectorObj = {
      // Best CSS selector (PRIORITIZED)
      selector: bestSelector || existingSelector.selector || '',
      // Element attributes for multi-strategy playback
      testId: testId,                    // HIGHEST PRIORITY
      dataTestId: testId,                // Alias
      name: name,                         // HIGH PRIORITY
      id: id,
      ariaLabel: ariaLabel,
      placeholder: placeholder,
      title: title,
      role: role,
      href: href,
      tagName: tagName,
      // Text for display/fallback matching
      text: cleanText,
      innerText: cleanText,
      textContent: cleanText,
      // Preserve any existing strategies
      strategies: existingSelector.strategies || [],
      fallbacks: existingSelector.fallbacks || [],
      // Metadata
      elementIndex: action.elementIndex || 0,
      totalMatching: action.totalMatching || 1,
      app: existingSelector.app || 'generic',
    };

    let qword, args, description;

    switch (action.type) {
      case 'navigate':
        qword = 'GoTo';
        args = [action.url];
        description = action.description || `Navigate to ${action.url}`;
        break;

      case 'click':
        qword = cleanText ? 'ClickText' : 'ClickElement';
        args = [cleanText || tagName || 'element'];
        description = action.description || `Click "${cleanText || tagName}"`;
        break;

      case 'fill':
        const label = placeholder || name || id || ariaLabel || 'input';
        const displayVal = action.displayValue || action.value || '';
        qword = 'Fill';
        args = [label, action.value || ''];
        description = action.description || `Type "${displayVal}" into ${label}`;
        break;

      case 'select':
        const selectLabel = name || id || 'dropdown';
        qword = 'Select';
        args = [selectLabel, action.value || action.label || ''];
        description = action.description || `Select "${action.label}" from ${selectLabel}`;
        break;

      case 'check':
      case 'uncheck':
        const checkLabel = name || id || cleanText || 'checkbox';
        qword = action.type === 'check' ? 'Check' : 'Uncheck';
        args = [checkLabel];
        description = action.description || `${qword} "${checkLabel}"`;
        break;

      case 'submit':
        qword = 'ClickText';
        args = [cleanText || 'Submit'];
        description = action.description || `Click "${cleanText || 'Submit'}"`;
        break;

      // ════════════════════════════════════════════════════════════════════════════
      // MULTI-TAB AND CROSS-ORIGIN ACTIONS
      // ════════════════════════════════════════════════════════════════════════════
      case 'newTab':
        qword = 'NewTab';
        args = [action.url || ''];
        description = action.description || `New tab opened: ${action.url || ''}`;
        // CRITICAL: Preserve type for playback
        break;

      case 'switchTab':
        qword = 'SwitchTab';
        args = [action.tabIndex ?? 0, action.url || ''];
        description = action.description || `Switched to tab ${action.tabIndex}`;
        break;

      case 'closeTab':
        qword = 'CloseTab';
        args = [action.tabIndex ?? 0];
        description = action.description || `Closed tab ${action.tabIndex}`;
        break;

      case 'crossOriginPlaceholder':
        qword = 'CrossOrigin';
        args = [action.url || '', action.tabIndex ?? 0];
        // Safely extract hostname
        let crossOriginHost = 'unknown';
        try {
          if (action.url) crossOriginHost = new URL(action.url).hostname;
        } catch (e) { /* invalid URL, use default */ }
        description = action.description || `⚠️ Actions in external tab (${crossOriginHost}) - click to edit`;
        break;

      case 'dialog':
        qword = 'HandleDialog';
        args = [action.dialogType || 'alert', action.message || ''];
        description = action.description || `Handle ${action.dialogType}: "${(action.message || '').substring(0, 30)}"`;
        break;

      case 'closeModal':
      case 'dismissModal':
      case 'closePopup':
        qword = 'CloseModal';
        args = [action.modalTitle || action.label || ''];
        description = action.description || `Close modal: ${action.modalTitle || action.label || 'dialog'}`;
        break;

      case 'download':
        qword = 'Download';
        args = [action.filename || ''];
        description = action.description || `Download: ${action.filename || 'file'}`;
        break;

      case 'upload':
        qword = 'Upload';
        args = [action.filename || '', action.path || ''];
        description = action.description || `Upload: ${action.filename || 'file'}`;
        break;

      case 'drag':
        qword = 'DragDrop';
        args = [action.sourceSelector || '', action.targetSelector || ''];
        description = action.description || `Drag element to target`;
        break;

      case 'hover':
        qword = 'Hover';
        args = [cleanText || ariaLabel || 'element'];
        description = action.description || `Hover over "${cleanText || ariaLabel || 'element'}"`;
        break;

      default:
        qword = 'ClickText';
        args = [cleanText || 'element'];
        description = action.description || `${action.type} "${cleanText}"`;
    }

    // ========== DEVICE CONTEXT FOR CROSS-DEVICE PLAYBACK ==========
    // Stores device info at record time so playback can adapt strategies
    // Maestro-inspired: Skip coordinate strategies when playing on different device
    const deviceContext = {
      recordedOn: recorder.mobileDevice?.name || 'desktop',
      isMobile: recorder.isMobileMode || false,
      viewport: recorder.page?.viewportSize?.() || { width: 1920, height: 1080 },
      userAgent: recorder.mobileDevice?.config?.userAgent || 'desktop',
      hasTouch: recorder.mobileDevice?.config?.hasTouch || false,
    };

    return {
      id: `act_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      qword,
      args,
      description,
      selectorObj: selectorObj,
      raw: action,
      timestamp: action.timestamp || Date.now(),
      // CRITICAL: Preserve original type for playback of special actions
      type: action.type,
      // Preserve tab/frame context
      tabIndex: action.tabIndex ?? null,
      url: action.url || null,
      frameContext: action.frameContext || null,
      // For cross-origin placeholders, preserve user actions
      userActions: action.userActions || [],
      // NEW: Device context for cross-device playback (Phase 1)
      deviceContext: deviceContext,
    };
}

module.exports = { _toQWord };
