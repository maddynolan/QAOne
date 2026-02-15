/**
 * Overlay script for Playwright recorder browser window.
 * Injected into the page to show recording UI, action list, suggestions, etc.
 * Shadow DOM isolated.
 */

function getOverlayScript() {
    return `
(function() {
  if (window.__flowstralOverlayInjected__) return;
  window.__flowstralOverlayInjected__ = true;
  
  var _isMinimized = false;
  var _currentSuggestions = [];
  var _elementCounts = {};
  
  // ========== HELPER: Find element by multiple strategies ==========
  function findElementByLabel(label, type) {
    if (!label) return null;
    var cleanLabel = label.replace(/"/g, '').trim();
    
    // Strategy 1: Exact text match on clickable elements
    var clickables = document.querySelectorAll('button, a, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="option"], span[tabindex], div[tabindex]');
    for (var i = 0; i < clickables.length; i++) {
      var el = clickables[i];
      var text = (el.textContent || el.innerText || '').trim();
      // Exact match
      if (text === cleanLabel) return el;
      // Short partial match
      if (text.startsWith(cleanLabel) && text.length < cleanLabel.length + 15) return el;
    }
    
    // Strategy 2: Aria-label match
    try {
      var ariaMatch = document.querySelector('[aria-label="' + cleanLabel + '"]');
      if (ariaMatch) return ariaMatch;
      ariaMatch = document.querySelector('[aria-label*="' + cleanLabel + '" i]');
      if (ariaMatch) return ariaMatch;
    } catch(e) {}
    
    // Strategy 3: Title match
    try {
      var titleMatch = document.querySelector('[title="' + cleanLabel + '"]');
      if (titleMatch) return titleMatch;
    } catch(e) {}
    
    // Strategy 4: Input by placeholder/label
    if (type === 'fill' || type === 'input') {
      try {
        var inputByPlaceholder = document.querySelector('[placeholder="' + cleanLabel + '"]');
        if (inputByPlaceholder) return inputByPlaceholder;
        inputByPlaceholder = document.querySelector('[placeholder*="' + cleanLabel + '" i]');
        if (inputByPlaceholder) return inputByPlaceholder;
      } catch(e) {}
      
      // Find label and get associated input
      var labels = document.querySelectorAll('label');
      for (var j = 0; j < labels.length; j++) {
        if (labels[j].textContent.trim().indexOf(cleanLabel) >= 0) {
          var forId = labels[j].getAttribute('for');
          if (forId) {
            var linkedInput = document.getElementById(forId);
            if (linkedInput) return linkedInput;
          }
          var nestedInput = labels[j].querySelector('input, textarea, select');
          if (nestedInput) return nestedInput;
        }
      }
    }
    
    // Strategy 5: Partial text for any element
    var allElements = document.querySelectorAll('*');
    for (var k = 0; k < allElements.length; k++) {
      var elem = allElements[k];
      if (elem.children.length === 0 || elem.tagName === 'BUTTON' || elem.tagName === 'A') {
        var elemText = (elem.textContent || elem.innerText || '').trim();
        if (elemText === cleanLabel || (elemText.indexOf(cleanLabel) >= 0 && elemText.length < 60)) {
          return elem;
        }
      }
    }
    
    return null;
  }
  
  // ========== HELPER: Click element with multiple fallbacks ==========
  function clickElement(el) {
    if (!el) return false;
    
    // Scroll into view
    el.scrollIntoView({ behavior: 'instant', block: 'center' });
    
    // Add visual highlight (green)
    var origOutline = el.style.outline;
    var origOffset = el.style.outlineOffset;
    var origBg = el.style.backgroundColor;
    el.style.outline = '4px solid #22c55e';
    el.style.outlineOffset = '3px';
    el.style.backgroundColor = 'rgba(34, 197, 94, 0.15)';
    
    // Execute click after brief highlight
    setTimeout(function() {
      // Method 1: Native click
      try { el.click(); } catch(e1) {}
      
      // Method 2: Focus + dispatch events
      try {
        el.focus();
        var rect = el.getBoundingClientRect();
        var centerX = rect.left + rect.width / 2;
        var centerY = rect.top + rect.height / 2;
        ['mousedown', 'mouseup', 'click'].forEach(function(type) {
          el.dispatchEvent(new MouseEvent(type, {
            view: window, bubbles: true, cancelable: true,
            clientX: centerX, clientY: centerY
          }));
        });
      } catch(e2) {}
      
      // Remove highlight after delay
      setTimeout(function() {
        el.style.outline = origOutline;
        el.style.outlineOffset = origOffset;
        el.style.backgroundColor = origBg;
      }, 500);
    }, 150);
    
    return true;
  }
  
  function createOverlay() {
    if (!document.body) {
      setTimeout(createOverlay, 100);
      return;
    }
    
    // Remove any existing overlay
    var existing = document.getElementById('flowstral-host');
    if (existing) existing.remove();
    
    // Create shadow host
    var host = document.createElement('div');
    host.id = 'flowstral-host';
    host.setAttribute('data-flowstral-ignore', 'true');
    host.style.cssText = 'all:initial !important; position:fixed !important; top:8px !important; right:8px !important; z-index:2147483647 !important;';
    
    // Create shadow root for style isolation
    var shadow = host.attachShadow({ mode: 'open' });
    
    shadow.innerHTML = '<style>' +
      '.fl-badge { display:flex; align-items:center; gap:6px; padding:6px 10px; background:rgba(15,15,26,0.95); border:1px solid #e94560; border-radius:20px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; color:#fff; box-shadow:0 2px 12px rgba(0,0,0,0.4); cursor:pointer; }' +
      '.fl-badge:hover { border-color:#8b5cf6; }' +
      '.fl-dot { width:8px; height:8px; background:#ef4444; border-radius:50%; animation:pulse 1s infinite; }' +
      '@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }' +
      '.fl-text { font-weight:600; }' +
      '.fl-count { background:rgba(139,92,246,0.4); padding:2px 6px; border-radius:10px; font-weight:700; }' +
    '</style>' +
    '<div class="fl-badge" id="fl-badge" data-flowstral-ignore="true" title="Click to toggle suggestions">' +
      '<div class="fl-dot" data-flowstral-ignore="true"></div>' +
      '<span class="fl-text" data-flowstral-ignore="true">REC</span>' +
      '<span class="fl-count" id="fl-count" data-flowstral-ignore="true">0</span>' +
    '</div>';
    
    document.body.appendChild(host);
    
    // Click badge to toggle suggestions
    shadow.getElementById('fl-badge').onclick = function(e) {
      e.stopPropagation();
      _isMinimized = !_isMinimized;
      if (_isMinimized) {
        var panel = document.getElementById('flowstral-suggestions-host');
        if (panel) panel.style.display = 'none';
      } else if (_currentSuggestions.length > 0) {
        window.__flowstralShowSuggestions__(_currentSuggestions);
      }
    };
    
    console.log('[Flowstral] Recording indicator attached');
  }
  
  // Update function
  window.__flowstralUpdateOverlay__ = function(data) {
    try {
      var host = document.getElementById('flowstral-host');
      if (!host || !host.shadowRoot) return;
      var count = host.shadowRoot.getElementById('fl-count');
      if (count && data.stepCount !== undefined) {
        count.textContent = data.stepCount;
      }
    } catch(e) {}
  };
  
  // Queue for actions to add to steps (communicated back to Electron)
  window.__flowstralAddToSteps__ = [];
  
  // Queue for executed actions
  window.__flowstralExecutedActions__ = [];
  
  // Show suggestions panel - ENHANCED with categories, duplicate warnings, execute buttons
  // Now preserves scroll position when updating
  window.__flowstralShowSuggestions__ = function(suggestions, counts) {
    try {
      _currentSuggestions = suggestions || [];
      _elementCounts = counts || {};
      
      // Preserve scroll position before removing panel
      var existingPanel = document.getElementById('flowstral-suggestions-host');
      var savedScrollTop = 0;
      if (existingPanel && existingPanel.shadowRoot) {
        var itemsList = existingPanel.shadowRoot.querySelector('.fl-list');
        if (itemsList) savedScrollTop = itemsList.scrollTop;
      }
      if (existingPanel) existingPanel.remove();
      
      if (!suggestions || suggestions.length === 0 || _isMinimized) return;
      
      var host = document.createElement('div');
      host.id = 'flowstral-suggestions-host';
      host.setAttribute('data-flowstral-ignore', 'true');
      host.style.cssText = 'all:initial !important; position:fixed !important; bottom:8px !important; right:8px !important; z-index:2147483647 !important; max-width:380px !important;';
      
      var shadow = host.attachShadow({ mode: 'open' });
      
      var styles = '<style>' +
        '.fl-panel { background:rgba(15,15,26,0.98); border:1px solid #444; border-radius:10px; font-family:-apple-system,BlinkMacSystemFont,sans-serif; font-size:11px; color:#fff; box-shadow:0 4px 30px rgba(0,0,0,0.7); overflow:hidden; }' +
        '.fl-header { padding:10px 14px; background:linear-gradient(135deg,#1a1a2e,#16213e); border-bottom:1px solid #333; display:flex; justify-content:space-between; align-items:center; }' +
        '.fl-header-left { display:flex; align-items:center; gap:8px; }' +
        '.fl-header-title { font-weight:700; font-size:11px; color:#fff; letter-spacing:0.5px; }' +
        '.fl-header-count { background:#22c55e; color:#000; padding:3px 10px; border-radius:12px; font-size:10px; font-weight:700; }' +
        '.fl-header-right { display:flex; align-items:center; gap:4px; }' +
        '.fl-btn { cursor:pointer; color:#888; font-size:16px; padding:4px 6px; border-radius:4px; background:transparent; border:none; }' +
        '.fl-btn:hover { color:#fff; background:rgba(139,92,246,0.3); }' +
        
        '.fl-counts { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; padding:10px 14px; background:#0d0d14; border-bottom:1px solid #222; }' +
        '.fl-count-item { display:flex; align-items:center; gap:5px; font-size:10px; }' +
        '.fl-count-dot { width:8px; height:8px; border-radius:50%; }' +
        '.fl-count-label { color:#666; }' +
        '.fl-count-num { font-weight:700; }' +
        
        '.fl-search-row { display:flex; gap:8px; padding:10px 14px; border-bottom:1px solid #222; background:#0a0a10; }' +
        '.fl-search { flex:1; background:#111; border:1px solid #333; border-radius:6px; padding:8px 12px; color:#fff; font-size:11px; outline:none; }' +
        '.fl-search:focus { border-color:#8b5cf6; box-shadow:0 0 0 2px rgba(139,92,246,0.2); }' +
        '.fl-filter { background:#111; border:1px solid #333; border-radius:6px; padding:6px 10px; color:#fff; font-size:10px; outline:none; cursor:pointer; }' +
        
        '.fl-list { max-height:400px; overflow-y:auto; }' +
        '.fl-item { padding:10px 14px; border-bottom:1px solid #1a1a1a; transition:background 0.15s; }' +
        '.fl-item:hover { background:rgba(139,92,246,0.08); }' +
        '.fl-item-header { display:flex; align-items:center; gap:8px; margin-bottom:6px; }' +
        '.fl-category { font-size:9px; font-weight:700; color:#888; text-transform:uppercase; letter-spacing:0.8px; }' +
        '.fl-location { font-size:9px; color:#666; background:#1a1a1a; padding:2px 6px; border-radius:4px; }' +
        '.fl-dup-warn { background:rgba(234,179,8,0.15); color:#eab308; border:1px solid rgba(234,179,8,0.3); padding:2px 8px; border-radius:10px; font-size:9px; font-weight:600; }' +
        
        '.fl-item-main { display:flex; align-items:center; justify-content:space-between; gap:10px; }' +
        '.fl-item-left { display:flex; align-items:center; gap:8px; flex:1; min-width:0; cursor:pointer; padding:4px 0; }' +
        '.fl-item-left:hover .fl-label { color:#a78bfa; }' +
        '.fl-icon { font-size:16px; flex-shrink:0; }' +
        '.fl-label { font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; transition:color 0.15s; }' +
        
        '.fl-item-btns { display:flex; gap:6px; flex-shrink:0; }' +
        '.fl-exec { background:rgba(34,197,94,0.15); color:#22c55e; border:1px solid rgba(34,197,94,0.3); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.15s; }' +
        '.fl-exec:hover { background:rgba(34,197,94,0.3); border-color:#22c55e; }' +
        '.fl-add { background:rgba(59,130,246,0.15); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); padding:6px 10px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600; transition:all 0.15s; }' +
        '.fl-add:hover { background:rgba(59,130,246,0.3); border-color:#3b82f6; }' +
        '.fl-added { background:rgba(100,100,100,0.15); color:#666; border-color:#444; }' +
        
        '.fl-info { padding:10px 14px; font-size:9px; color:#555; border-top:1px solid #222; background:#0a0a10; text-align:center; }' +
      '</style>';
      
      // Calculate counts from suggestions
      var btnCount = 0, linkCount = 0, inputCount = 0, headCount = 0;
      suggestions.forEach(function(s) {
        if (s.element === 'button' || (s.type === 'click' && !s.element)) btnCount++;
        else if (s.element === 'link') linkCount++;
        else if (s.type === 'fill' || s.type === 'select' || s.element === 'input') inputCount++;
        else if (s.type === 'heading') headCount++;
      });
      
      // Build items HTML with categories and action buttons
      var items = suggestions.map(function(s, i) {
        var icon = s.type === 'fill' ? '✏️' : s.element === 'link' ? '🔗' : s.element === 'tab' ? '📑' : s.element === 'menuitem' ? '📋' : s.type === 'heading' ? '📄' : '👆';
        var label = (s.label || s.text || s.description || 'Element');
        if (label.length > 38) label = label.substring(0, 35) + '...';
        
        // Category label (CLICK BUTTON, CLICK LINK, etc.)
        var actionLabel = s.type === 'click' ? 'CLICK' : s.type === 'fill' ? 'FILL' : s.type === 'select' ? 'SELECT' : s.type === 'heading' ? 'ASSERT' : 'CLICK';
        var elementLabel = (s.element || (s.type === 'fill' ? 'INPUT' : 'BUTTON')).toUpperCase();
        var categoryLabel = actionLabel + ' ' + elementLabel;
        
        // Location tag
        var locationHtml = s.location && s.location !== 'body' && s.location !== 'main' ? '<span class="fl-location">' + s.location.toUpperCase() + '</span>' : '';
        
        // Duplicate warning
        var dupHtml = s.hasDuplicates ? '<span class="fl-dup-warn">⚠ ' + s.totalDuplicates + ' FOUND</span>' : '';
        
        return '<div class="fl-item" data-flowstral-ignore="true" data-index="' + i + '">' +
          '<div class="fl-item-header" data-flowstral-ignore="true">' +
            '<span class="fl-category">' + categoryLabel + '</span>' +
            locationHtml +
            dupHtml +
          '</div>' +
          '<div class="fl-item-main" data-flowstral-ignore="true">' +
            '<div class="fl-item-left" data-flowstral-ignore="true" data-index="' + i + '" title="Click to execute">' +
              '<span class="fl-icon">' + icon + '</span>' +
              '<span class="fl-label">' + label + '</span>' +
            '</div>' +
            '<div class="fl-item-btns" data-flowstral-ignore="true">' +
              '<button class="fl-exec" data-flowstral-ignore="true" data-exec-index="' + i + '" title="Execute action">▶</button>' +
              '<button class="fl-add" data-flowstral-ignore="true" data-add-index="' + i + '" title="Add to steps">+</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      }).join('');
      
      shadow.innerHTML = styles +
        '<div class="fl-panel" data-flowstral-ignore="true">' +
          '<div class="fl-header" data-flowstral-ignore="true">' +
            '<div class="fl-header-left" data-flowstral-ignore="true">' +
              '<span class="fl-header-title">SUGGESTED ACTIONS</span>' +
              '<span class="fl-header-count">' + suggestions.length + ' ITEMS</span>' +
            '</div>' +
            '<div class="fl-header-right" data-flowstral-ignore="true">' +
              '<button class="fl-btn" id="fl-minimize" data-flowstral-ignore="true" title="Minimize">−</button>' +
              '<button class="fl-btn" id="fl-close" data-flowstral-ignore="true" title="Close">✕</button>' +
            '</div>' +
          '</div>' +
          '<div class="fl-counts" data-flowstral-ignore="true">' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#a855f7;"></div><span class="fl-count-label">Buttons</span><span class="fl-count-num" style="color:#a855f7;">' + btnCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#3b82f6;"></div><span class="fl-count-label">Links</span><span class="fl-count-num" style="color:#3b82f6;">' + linkCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#22c55e;"></div><span class="fl-count-label">Inputs</span><span class="fl-count-num" style="color:#22c55e;">' + inputCount + '</span></div>' +
            '<div class="fl-count-item"><div class="fl-count-dot" style="background:#eab308;"></div><span class="fl-count-label">Headings</span><span class="fl-count-num" style="color:#eab308;">' + headCount + '</span></div>' +
          '</div>' +
          '<div class="fl-search-row" data-flowstral-ignore="true">' +
            '<input type="text" class="fl-search" id="fl-search" placeholder="Search elements..." data-flowstral-ignore="true"/>' +
            '<select class="fl-filter" id="fl-filter" data-flowstral-ignore="true">' +
              '<option value="all">All</option>' +
              '<option value="button">Buttons</option>' +
              '<option value="link">Links</option>' +
              '<option value="input">Inputs</option>' +
              '<option value="heading">Headings</option>' +
            '</select>' +
          '</div>' +
          '<div class="fl-list" id="fl-list" data-flowstral-ignore="true">' + items + '</div>' +
          '<div class="fl-info" data-flowstral-ignore="true">▶ Execute action on page • + Add to test steps</div>' +
        '</div>';
      
      document.body.appendChild(host);
      
      // Restore scroll position if we had one saved
      if (savedScrollTop > 0) {
        var itemsList = shadow.getElementById('fl-list');
        if (itemsList) itemsList.scrollTop = savedScrollTop;
      }
      
      // Close button
      shadow.getElementById('fl-close').onclick = function(e) {
        e.stopPropagation();
        host.remove();
      };
      
      // Minimize button
      shadow.getElementById('fl-minimize').onclick = function(e) {
        e.stopPropagation();
        _isMinimized = true;
        host.style.display = 'none';
      };
      
      // Filter function
      function filterItems() {
        var query = shadow.getElementById('fl-search').value.toLowerCase();
        var filter = shadow.getElementById('fl-filter').value;
        var items = shadow.querySelectorAll('.fl-item');
        items.forEach(function(item) {
          var idx = parseInt(item.getAttribute('data-index'));
          var s = suggestions[idx];
          var text = ((s.label || '') + ' ' + (s.text || '') + ' ' + (s.description || '')).toLowerCase();
          var matchesSearch = !query || text.indexOf(query) >= 0;
          var matchesFilter = filter === 'all' ||
            (filter === 'button' && (s.element === 'button' || (s.type === 'click' && !s.element))) ||
            (filter === 'link' && s.element === 'link') ||
            (filter === 'input' && (s.type === 'fill' || s.type === 'select')) ||
            (filter === 'heading' && s.type === 'heading');
          item.style.display = (matchesSearch && matchesFilter) ? 'block' : 'none';
        });
      }
      
      // Search functionality
      var searchInput = shadow.getElementById('fl-search');
      searchInput.onclick = function(e) { e.stopPropagation(); };
      searchInput.oninput = function(e) { e.stopPropagation(); filterItems(); };
      
      // Filter dropdown
      var filterSelect = shadow.getElementById('fl-filter');
      filterSelect.onclick = function(e) { e.stopPropagation(); };
      filterSelect.onchange = function(e) { e.stopPropagation(); filterItems(); };
      
      // Execute button (▶) - Queue action for Electron to execute with robust logic
      // This ensures the same click behavior as the app suggest panel
      shadow.querySelectorAll('.fl-exec').forEach(function(execBtn) {
        execBtn.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(execBtn.getAttribute('data-exec-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Visual feedback - show pending
            execBtn.textContent = '⏳';
            execBtn.style.background = 'rgba(234,179,8,0.3)';
            execBtn.style.borderColor = '#eab308';
            
            // Queue action for Electron to execute using robust executeAction
            // This is picked up by the polling in playwright-recorder.js
            window.__flowstralExecuteQueue__ = window.__flowstralExecuteQueue__ || [];
            window.__flowstralExecuteQueue__.push({
              index: idx,
              type: suggestion.type,
              label: suggestion.label || suggestion.text,
              text: suggestion.text || suggestion.label,
              selector: suggestion.selector,
              element: suggestion.element,
              description: suggestion.description,
              execBtnId: 'exec-' + idx,
              timestamp: Date.now()
            });
            
            // Store reference to button for result callback
            window.__flowstralExecButtons__ = window.__flowstralExecButtons__ || {};
            window.__flowstralExecButtons__['exec-' + idx] = execBtn;
            
            // Also try local click as immediate feedback while Electron processes
            var label = suggestion.label || suggestion.text;
            var el = null;
            if (suggestion.selector) {
              try { el = document.querySelector(suggestion.selector); } catch(err) {}
            }
            if (!el) {
              el = findElementByLabel(label, suggestion.type);
            }
            if (el) {
              clickElement(el);
            }
            
            // Reset button after timeout (Electron callback will update if successful)
            setTimeout(function() {
              if (execBtn.textContent === '⏳') {
                execBtn.textContent = '▶';
                execBtn.style.background = '';
                execBtn.style.borderColor = '';
              }
            }, 3000);
          }
        };
      });
      
      // Also execute when clicking the label row
      shadow.querySelectorAll('.fl-item-left').forEach(function(item) {
        item.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(item.getAttribute('data-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Queue for Electron robust execution
            window.__flowstralExecuteQueue__ = window.__flowstralExecuteQueue__ || [];
            window.__flowstralExecuteQueue__.push({
              index: idx,
              type: suggestion.type,
              label: suggestion.label || suggestion.text,
              text: suggestion.text || suggestion.label,
              selector: suggestion.selector,
              element: suggestion.element,
              description: suggestion.description,
              timestamp: Date.now()
            });
            
            // Also try local click as immediate feedback
            var label = suggestion.label || suggestion.text;
            var el = null;
            if (suggestion.selector) {
              try { el = document.querySelector(suggestion.selector); } catch(err) {}
            }
            if (!el) {
              el = findElementByLabel(label, suggestion.type);
            }
            if (el) {
              clickElement(el);
            }
          }
        };
      });
      
      // Add to steps on + click
      shadow.querySelectorAll('.fl-add').forEach(function(addBtn) {
        addBtn.onclick = function(e) {
          e.stopPropagation();
          var idx = parseInt(addBtn.getAttribute('data-add-index'));
          var suggestion = suggestions[idx];
          
          if (suggestion) {
            // Mark as added
            addBtn.textContent = '✓';
            addBtn.classList.add('fl-added');
            addBtn.title = 'Added!';
            
            // Queue for Electron to pick up
            window.__flowstralAddToSteps__.push({
              type: suggestion.type,
              label: suggestion.label,
              selector: suggestion.selector,
              description: suggestion.description,
              action: suggestion.action,
              timestamp: Date.now()
            });
            
            console.log('[Flowstral] Added to steps:', suggestion.label);
            
            // Visual feedback - briefly highlight
            var item = addBtn.parentElement;
            item.style.background = 'rgba(34,197,94,0.2)';
            setTimeout(function() {
              item.style.background = '';
            }, 500);
          }
        };
      });
      
      console.log('[Flowstral] Suggestions panel shown:', suggestions.length);
    } catch(e) { console.error('[Flowstral] Suggestions panel error:', e); }
  };
  
  // Create overlay when ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createOverlay);
  } else {
    createOverlay();
  }
})();
    `;
}

module.exports = { getOverlayScript };
