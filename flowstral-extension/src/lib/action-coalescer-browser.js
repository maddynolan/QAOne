/**
 * Action Coalescer (Browser) - Combine dropdown trigger + option into single "Select" action
 * Same behavior as desktop flowstral-desktop/src/main/lib/action-coalescer.js
 * Uses DOM element for pattern detection (no Node/recipe required).
 */
(function(global) {
  'use strict';

  const MAX_DROPDOWN_DELAY_MS = 2000;

  function isDropdownTrigger(element) {
    if (!element || !element.getAttribute) return false;
    var role = element.getAttribute('role');
    var tag = element.tagName ? element.tagName.toLowerCase() : '';
    var hasPopup = element.getAttribute('aria-haspopup');
    var id = element.id || '';
    var classList = (element.className && typeof element.className === 'string') ? element.className : '';
    if (element.classList) classList = Array.prototype.slice.call(element.classList).join(' ');
    if (id.indexOf('navItem') >= 0 || id.indexOf('navigation') >= 0 ||
        classList.indexOf('flyout') >= 0 || classList.indexOf('nav-item') >= 0 ||
        classList.indexOf('menu-trigger') >= 0 || (hasPopup === 'menu' && tag === 'button')) return false;
    if (tag === 'select') return true;
    if (role === 'combobox' || role === 'listbox') return true;
    if (element.hasAttribute && (element.hasAttribute('data-radix-select-trigger') || element.hasAttribute('data-radix-select-value'))) return true;
    if (classList.indexOf('select') >= 0 && classList.indexOf('trigger') >= 0) return true;
    if (classList.indexOf('combobox') >= 0 || classList.indexOf('SelectTrigger') >= 0) return true;
    if (hasPopup === 'listbox') return true;
    return false;
  }

  function isDropdownOption(element) {
    if (!element || !element.getAttribute) return false;
    var role = element.getAttribute('role');
    var optionRoles = ['option', 'menuitem', 'menuitemcheckbox', 'menuitemradio'];
    if (role && optionRoles.indexOf(role) >= 0) return true;
    if (element.closest) {
      var listbox = element.closest('[role="listbox"], [role="menu"], [data-radix-menu-content], [data-radix-select-content], [data-radix-popper-content-wrapper], [class*="SelectContent"], [class*="select-content"]');
      if (listbox) return true;
    }
    if (element.hasAttribute && element.hasAttribute('data-radix-collection-item')) return true;
    return false;
  }

  function getOptionText(element) {
    if (!element) return 'option';
    var text = element.innerText || element.textContent;
    if (text && typeof text === 'string') return text.trim().substring(0, 200);
    return element.getAttribute('data-value') || element.value || 'option';
  }

  function ActionCoalescerBrowser(options) {
    this.debug = options && options.debug;
    this.pendingTrigger = null;
    this.pendingTimeout = null;
  }

  ActionCoalescerBrowser.prototype.log = function() {
    if (this.debug && typeof console !== 'undefined' && console.log) console.log('[ActionCoalescer]', ...arguments);
  };

  ActionCoalescerBrowser.prototype.process = function(action, element) {
    if (action.type !== 'click') return { single: action };
    if (this.pendingTrigger) {
      var completed = this.tryComplete(action, element);
      if (completed) return completed;
    }
    if (element && isDropdownTrigger(element)) {
      this.startPending(action, element);
      return { pending: true };
    }
    return { single: action };
  };

  ActionCoalescerBrowser.prototype.startPending = function(action, element) {
    var self = this;
    this.log('Pending dropdown trigger');
    this.pendingTrigger = { action: action, element: element, timestamp: Date.now() };
    if (this.pendingTimeout) clearTimeout(this.pendingTimeout);
    this.pendingTimeout = setTimeout(function() {
      self.pendingTimeout = null;
      var flushed = self.flush();
      if (flushed && self.onFlush) self.onFlush(flushed);
    }, MAX_DROPDOWN_DELAY_MS);
  };

  ActionCoalescerBrowser.prototype.tryComplete = function(action, element) {
    if (!this.pendingTrigger || action.type !== 'click') return null;
    if (!element || !isDropdownOption(element)) {
      var flushed = this.flush();
      return flushed ? { flushed: flushed, current: action } : { single: action };
    }
    var triggerAction = this.pendingTrigger.action;
    var triggerEl = this.pendingTrigger.element;
    if (this.pendingTimeout) { clearTimeout(this.pendingTimeout); this.pendingTimeout = null; }
    this.pendingTrigger = null;
    var triggerLabel = (triggerEl && (triggerEl.getAttribute('aria-label') || triggerEl.innerText || triggerEl.textContent)) || 'dropdown';
    if (typeof triggerLabel === 'string') triggerLabel = triggerLabel.trim().substring(0, 100);
    var optionText = getOptionText(element);
    var coalesced = {
      type: 'select',
      selector: triggerAction.selector,
      timestamp: action.timestamp || Date.now(),
      description: 'Select "' + optionText + '" from "' + triggerLabel + '"',
      value: { text: optionText, dataValue: element.getAttribute ? element.getAttribute('data-value') || element.value : null },
      _coalesced: { trigger: triggerAction, option: action }
    };
    this.log('Coalesced select:', coalesced.description);
    return { single: coalesced };
  };

  ActionCoalescerBrowser.prototype.flush = function() {
    if (!this.pendingTrigger) return null;
    if (this.pendingTimeout) { clearTimeout(this.pendingTimeout); this.pendingTimeout = null; }
    var action = this.pendingTrigger.action;
    this.pendingTrigger = null;
    return action;
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActionCoalescerBrowser;
  } else {
    global.ActionCoalescerBrowser = ActionCoalescerBrowser;
  }
})(typeof window !== 'undefined' ? window : self);
