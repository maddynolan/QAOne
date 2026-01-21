/**
 * Element Recipe - A human-centric way to identify elements
 * 
 * Instead of storing selectors like "[data-testid='cart']", we store descriptions:
 * "A tab with text 'Cart' in the tablist, position 2"
 * 
 * This approach is:
 * - Framework agnostic (works on Radix, Salesforce, SAP, etc.)
 * - Self-healing (if testId disappears, role+text still works)
 * - Human readable (developers can understand what the step does)
 * 
 * @author Flowstral
 * @version 2.0.0
 */

// ============================================================================
// ROLE INFERENCE - Map HTML tags and custom elements to ARIA roles
// ============================================================================

const TAG_TO_ROLE = {
  // Standard HTML - Interactive
  button: 'button',
  a: 'link',
  input: null, // Depends on type
  select: 'combobox',
  option: 'option',
  optgroup: 'group',
  textarea: 'textbox',
  
  // Semantic Structure
  nav: 'navigation',
  main: 'main',
  header: 'banner',
  footer: 'contentinfo',
  form: 'form',
  dialog: 'dialog',
  article: 'article',
  aside: 'complementary',
  section: 'region',
  
  // Tables
  table: 'table',
  thead: 'rowgroup',
  tbody: 'rowgroup',
  tfoot: 'rowgroup',
  tr: 'row',
  th: 'columnheader',
  td: 'cell',
  
  // Lists
  ul: 'list',
  ol: 'list',
  li: 'listitem',
  dl: 'list',
  dt: 'term',
  dd: 'definition',
  menu: 'menu',
  menuitem: 'menuitem',
  
  // Media & Graphics
  img: 'img',
  figure: 'figure',
  figcaption: 'caption',
  canvas: null,     // Can be interactive but needs explicit role
  svg: 'img',       // When meaningful, has implicit img role
  video: null,      // Has native controls
  audio: null,      // Has native controls
  picture: null,    // Container for img
  
  // Interactive
  details: 'group',
  summary: 'button',
  
  // Form Display
  output: 'status',
  meter: 'meter',
  progress: 'progressbar',
  datalist: 'listbox',
  fieldset: 'group',
  legend: null,
  
  // Headings
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  
  // Embedded
  iframe: null,
  embed: null,
  object: null,
  area: 'link',     // Image map areas are links
};

const INPUT_TYPE_TO_ROLE = {
  text: 'textbox',
  email: 'textbox',
  password: 'textbox',
  search: 'searchbox',
  tel: 'textbox',
  url: 'textbox',
  number: 'spinbutton',
  checkbox: 'checkbox',
  radio: 'radio',
  submit: 'button',
  button: 'button',
  reset: 'button',
  range: 'slider',
  file: 'button',
  color: 'button',         // Color picker trigger
  date: 'textbox',         // Date input
  time: 'textbox',         // Time input
  'datetime-local': 'textbox',
  month: 'textbox',
  week: 'textbox',
  hidden: null,            // Not interactive
};

// Elements that might be contenteditable
const CONTENTEDITABLE_ROLES = {
  'contenteditable': 'textbox',
  'true': 'textbox',
  '': 'textbox',  // Empty string means editable
};

// Custom element prefixes and their role mappings
const CUSTOM_ELEMENT_ROLES = {
  // Salesforce Lightning
  'lightning-button': 'button',
  'lightning-button-icon': 'button',
  'lightning-button-menu': 'button',
  'lightning-input': 'textbox',
  'lightning-combobox': 'combobox',
  'lightning-textarea': 'textbox',
  'lightning-checkbox': 'checkbox',
  'lightning-checkbox-group': 'group',
  'lightning-radio': 'radio',
  'lightning-radio-group': 'radiogroup',
  'lightning-select': 'combobox',
  'lightning-tab': 'tab',
  'lightning-tabset': 'tablist',
  'lightning-menu': 'menu',
  'lightning-menu-item': 'menuitem',
  'lightning-datatable': 'table',
  'lightning-tree': 'tree',
  'lightning-tree-item': 'treeitem',
  'lightning-modal': 'dialog',
  'lightning-card': 'region',
  'lightning-icon': 'img',
  'lightning-spinner': 'status',
  'lightning-badge': 'status',
  'lightning-progress-bar': 'progressbar',
  'lightning-slider': 'slider',
  
  // SAP UI5
  'ui5-button': 'button',
  'ui5-input': 'textbox',
  'ui5-select': 'combobox',
  'ui5-option': 'option',
  'ui5-checkbox': 'checkbox',
  'ui5-radio': 'radio',
  'ui5-radio-button': 'radio',
  'ui5-textarea': 'textbox',
  'ui5-table': 'table',
  'ui5-table-row': 'row',
  'ui5-table-cell': 'cell',
  'ui5-tab': 'tab',
  'ui5-tabcontainer': 'tablist',
  'ui5-dialog': 'dialog',
  'ui5-menu': 'menu',
  'ui5-menu-item': 'menuitem',
  'ui5-link': 'link',
  'ui5-icon': 'img',
  'ui5-switch': 'switch',
  'ui5-slider': 'slider',
  'ui5-progress-indicator': 'progressbar',
  'ui5-tree': 'tree',
  'ui5-tree-item': 'treeitem',
  
  // Shoelace (sl-)
  'sl-button': 'button',
  'sl-input': 'textbox',
  'sl-select': 'combobox',
  'sl-option': 'option',
  'sl-checkbox': 'checkbox',
  'sl-radio': 'radio',
  'sl-radio-group': 'radiogroup',
  'sl-tab': 'tab',
  'sl-tab-group': 'tablist',
  'sl-tab-panel': 'tabpanel',
  'sl-dialog': 'dialog',
  'sl-drawer': 'dialog',
  'sl-menu': 'menu',
  'sl-menu-item': 'menuitem',
  'sl-switch': 'switch',
  'sl-textarea': 'textbox',
  'sl-tree': 'tree',
  'sl-tree-item': 'treeitem',
  
  // Ionic (ion-)
  'ion-button': 'button',
  'ion-input': 'textbox',
  'ion-textarea': 'textbox',
  'ion-select': 'combobox',
  'ion-select-option': 'option',
  'ion-checkbox': 'checkbox',
  'ion-radio': 'radio',
  'ion-radio-group': 'radiogroup',
  'ion-toggle': 'switch',
  'ion-range': 'slider',
  'ion-tab': 'tab',
  'ion-tabs': 'tablist',
  'ion-tab-button': 'tab',
  'ion-menu': 'menu',
  'ion-item': 'listitem',
  'ion-list': 'list',
  'ion-modal': 'dialog',
  'ion-alert': 'alertdialog',
  'ion-action-sheet': 'dialog',
  'ion-fab': 'button',
  'ion-fab-button': 'button',
  'ion-searchbar': 'searchbox',
  'ion-segment': 'tablist',
  'ion-segment-button': 'tab',
  'ion-card': 'region',
  'ion-accordion': 'group',
  'ion-accordion-group': 'group',
  
  // Angular Material (mat-)
  'mat-button': 'button',
  'mat-raised-button': 'button',
  'mat-icon-button': 'button',
  'mat-fab': 'button',
  'mat-mini-fab': 'button',
  'mat-form-field': 'group',
  'mat-input': 'textbox',
  'mat-select': 'combobox',
  'mat-option': 'option',
  'mat-checkbox': 'checkbox',
  'mat-radio-button': 'radio',
  'mat-radio-group': 'radiogroup',
  'mat-slide-toggle': 'switch',
  'mat-slider': 'slider',
  'mat-tab': 'tab',
  'mat-tab-group': 'tablist',
  'mat-menu': 'menu',
  'mat-menu-item': 'menuitem',
  'mat-dialog-container': 'dialog',
  'mat-list': 'list',
  'mat-list-item': 'listitem',
  'mat-nav-list': 'navigation',
  'mat-tree': 'tree',
  'mat-tree-node': 'treeitem',
  'mat-expansion-panel': 'group',
  'mat-accordion': 'group',
  'mat-stepper': 'group',
  'mat-step': 'listitem',
  'mat-chip': 'button',
  'mat-chip-list': 'list',
  'mat-autocomplete': 'listbox',
  'mat-datepicker': 'dialog',
  'mat-progress-bar': 'progressbar',
  'mat-progress-spinner': 'progressbar',
  'mat-snack-bar-container': 'alert',
  'mat-tooltip': 'tooltip',
  
  // Material Design Components (mdc-)
  'mdc-button': 'button',
  'mdc-fab': 'button',
  'mdc-icon-button': 'button',
  'mdc-textfield': 'textbox',
  'mdc-select': 'combobox',
  'mdc-checkbox': 'checkbox',
  'mdc-radio': 'radio',
  'mdc-switch': 'switch',
  'mdc-slider': 'slider',
  'mdc-tab': 'tab',
  'mdc-tab-bar': 'tablist',
  'mdc-menu': 'menu',
  'mdc-list': 'list',
  'mdc-list-item': 'listitem',
  'mdc-dialog': 'dialog',
  'mdc-snackbar': 'alert',
  
  // Vaadin
  'vaadin-button': 'button',
  'vaadin-text-field': 'textbox',
  'vaadin-text-area': 'textbox',
  'vaadin-select': 'combobox',
  'vaadin-combo-box': 'combobox',
  'vaadin-checkbox': 'checkbox',
  'vaadin-radio-button': 'radio',
  'vaadin-radio-group': 'radiogroup',
  'vaadin-tab': 'tab',
  'vaadin-tabs': 'tablist',
  'vaadin-menu-bar': 'menubar',
  'vaadin-grid': 'grid',
  'vaadin-grid-column': 'columnheader',
  'vaadin-dialog': 'dialog',
  'vaadin-notification': 'alert',
  'vaadin-date-picker': 'textbox',
  'vaadin-time-picker': 'textbox',
  
  // Microsoft FAST
  'fast-button': 'button',
  'fast-text-field': 'textbox',
  'fast-text-area': 'textbox',
  'fast-select': 'combobox',
  'fast-option': 'option',
  'fast-checkbox': 'checkbox',
  'fast-radio': 'radio',
  'fast-radio-group': 'radiogroup',
  'fast-switch': 'switch',
  'fast-slider': 'slider',
  'fast-tab': 'tab',
  'fast-tabs': 'tablist',
  'fast-tab-panel': 'tabpanel',
  'fast-menu': 'menu',
  'fast-menu-item': 'menuitem',
  'fast-dialog': 'dialog',
  'fast-accordion': 'group',
  'fast-accordion-item': 'group',
  'fast-tree-view': 'tree',
  'fast-tree-item': 'treeitem',
  
  // Carbon Design (IBM)
  'cds-button': 'button',
  'cds-text-input': 'textbox',
  'cds-textarea': 'textbox',
  'cds-select': 'combobox',
  'cds-checkbox': 'checkbox',
  'cds-radio-button': 'radio',
  'cds-toggle': 'switch',
  'cds-slider': 'slider',
  'cds-tabs': 'tablist',
  'cds-tab': 'tab',
  'cds-modal': 'dialog',
  'cds-notification': 'alert',
  'cds-accordion': 'group',
  'cds-accordion-item': 'group',
  'cds-structured-list': 'list',
  'cds-structured-list-row': 'row',
};

// Framework-specific attributes that should be treated as testIds
const TESTID_ATTRIBUTES = [
  'data-testid',
  'data-test-id',
  'data-test',
  'data-cy',
  'data-qa',
  'data-automation-id',
  // Salesforce
  'data-target-selection-name',
  'data-refid',
  // SAP
  'stable-dom-ref',
];

// Attributes to ignore (unstable/internal)
const IGNORE_ATTRIBUTES = [
  'data-aura-rendered-by',
  'data-aura-class',
  'data-radix-collection-item',
  '__reactFiber',
  '__reactProps',
];

// Patterns for unstable IDs that should be ignored
const UNSTABLE_ID_PATTERNS = [
  /^:r[a-z0-9]+:?$/i,           // Radix: :r0:, :r1a:, etc.
  /^react-aria-?\d+/i,          // React Aria
  /^headlessui-/i,              // Headless UI
  /^radix-/i,                   // Radix
  /^mui-/i,                     // MUI
  /^chakra-/i,                  // Chakra UI
  /^mantine-/i,                 // Mantine
  /^aura\d+/i,                  // Salesforce Aura
  /^lwc-/i,                     // Lightning Web Components
  /^input-\d+$/i,               // Generic input-123
  /^radio-\d+$/i,               // Generic radio-123
  /^checkbox-\d+$/i,            // Generic checkbox-123
  /^button-\d+$/i,              // Generic button-123
  /^[a-f0-9]{8,}$/i,            // UUID-like
  /^\d{6,}$/,                   // Pure numbers
];

// ============================================================================
// ELEMENT RECIPE MODEL
// ============================================================================

/**
 * @typedef {Object} ElementWhat
 * @property {string} [role] - ARIA role (button, tab, textbox, etc.)
 * @property {string} [text] - Visible text content
 * @property {string} [tag] - HTML tag name
 * @property {string} [type] - Input type (for input elements)
 */

/**
 * @typedef {Object} ElementWhere
 * @property {string} [landmark] - Nearest landmark (header, main, nav, form, dialog)
 * @property {string} [within] - Parent with role (tablist, menu, listbox, toolbar)
 * @property {string} [nearText] - Nearby label or heading
 * @property {string} [formLabel] - Associated form label
 */

/**
 * @typedef {Object} ElementWhich
 * @property {number} [position] - Position among similar siblings (1-based)
 * @property {string} [testId] - data-testid or equivalent
 * @property {string} [id] - HTML id (only if stable)
 * @property {string} [name] - name attribute
 * @property {string} [ariaLabel] - aria-label
 * @property {string} [placeholder] - placeholder text
 * @property {boolean} [uniqueText] - Is text unique in context?
 */

/**
 * @typedef {Object} ElementRecipe
 * @property {ElementWhat} what - What the element IS
 * @property {ElementWhere} where - Where the element is located
 * @property {ElementWhich} which - Which one (disambiguation)
 * @property {Object} [confirm] - Optional confirmation data
 * @property {Object} [confirm.boundingBox] - Bounding box for visual verification
 * @property {string} [confirm.cssSelector] - Fallback CSS selector
 */

// ============================================================================
// ELEMENT ANALYZER - Runs in page context to analyze an element
// ============================================================================

/**
 * Get the element analyzer script to inject into the page
 * This runs in the browser context and returns an ElementRecipe
 */
function getElementAnalyzerScript() {
  return `
(function() {
  window.__flowstralElementAnalyzer = {
    
    // ========== ROLE INFERENCE ==========
    
    tagToRole: ${JSON.stringify(TAG_TO_ROLE)},
    inputTypeToRole: ${JSON.stringify(INPUT_TYPE_TO_ROLE)},
    customElementRoles: ${JSON.stringify(CUSTOM_ELEMENT_ROLES)},
    testIdAttributes: ${JSON.stringify(TESTID_ATTRIBUTES)},
    unstableIdPatterns: ${JSON.stringify(UNSTABLE_ID_PATTERNS.map(p => p.source))},
    
    isUnstableId: function(id) {
      if (!id) return true;
      for (var i = 0; i < this.unstableIdPatterns.length; i++) {
        if (new RegExp(this.unstableIdPatterns[i], 'i').test(id)) return true;
      }
      return false;
    },
    
    getRole: function(element) {
      // Explicit role takes precedence
      var explicitRole = element.getAttribute('role');
      if (explicitRole) return explicitRole;
      
      var tag = element.tagName.toLowerCase();
      
      // Check contenteditable (rich text editors)
      var contentEditable = element.getAttribute('contenteditable');
      if (contentEditable === 'true' || contentEditable === '' || element.isContentEditable) {
        return 'textbox';
      }
      
      // Check custom elements first
      if (this.customElementRoles[tag]) {
        return this.customElementRoles[tag];
      }
      
      // Check tag-based role
      if (tag === 'input') {
        var type = (element.type || 'text').toLowerCase();
        return this.inputTypeToRole[type] || 'textbox';
      }
      
      // SVG elements
      if (tag === 'svg' || tag === 'path' || tag === 'circle' || tag === 'rect' || tag === 'g') {
        // If SVG has aria-label or is in a button, treat as img role
        if (element.getAttribute('aria-label') || element.closest('button, a, [role="button"]')) {
          return 'img';
        }
        return null; // Not semantically significant on its own
      }
      
      // Summary element (for details/summary accordion)
      if (tag === 'summary') {
        return 'button';
      }
      
      // Progress element
      if (tag === 'progress') {
        return 'progressbar';
      }
      
      // Meter element
      if (tag === 'meter') {
        return 'meter';
      }
      
      // Output element
      if (tag === 'output') {
        return 'status';
      }
      
      return this.tagToRole[tag] || null;
    },
    
    // ========== TEXT NORMALIZATION ==========
    
    /**
     * Normalize text for consistent recording and playback
     * Handles: apostrophe variants, quote variants, whitespace
     */
    normalizeText: function(text) {
      if (!text) return text;
      return text
        // Normalize all apostrophe variants to straight apostrophe
        .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4\u02BC]/g, "'")
        // Normalize all quote variants to straight quotes
        .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')
        // Normalize whitespace (multiple spaces, tabs, newlines → single space)
        .replace(/\s+/g, ' ')
        .trim();
    },
    
    // ========== TEXT EXTRACTION ==========
    
    getVisibleText: function(element) {
      // For inputs, use label/placeholder/aria-label - NOT the value!
      // The value is what the user typed, not the field identifier
      var tag = element.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea') {
        // Priority: aria-label > associated label > placeholder > name attribute
        var ariaLabel = element.getAttribute('aria-label');
        if (ariaLabel) return this.normalizeText(ariaLabel);
        
        // Check for associated label via 'for' attribute
        if (element.id) {
          var label = document.querySelector('label[for="' + element.id + '"]');
          if (label && label.textContent) {
            return this.normalizeText(label.textContent.trim());
          }
        }
        
        // Check parent label (input inside label)
        var parentLabel = element.closest('label');
        if (parentLabel) {
          var labelText = (parentLabel.textContent || '').trim();
          // Don't include the value in the label
          if (element.value) {
            labelText = labelText.replace(element.value, '').trim();
          }
          if (labelText) return this.normalizeText(labelText);
        }
        
        // Fallback to placeholder or name (NOT value!)
        return this.normalizeText(element.placeholder || element.name || '');
      }
      
      // For buttons with just an icon, check aria-label first
      var ariaLabel = element.getAttribute('aria-label');
      
      // Get direct text content (not from children)
      var text = '';
      for (var i = 0; i < element.childNodes.length; i++) {
        var node = element.childNodes[i];
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      text = text.trim();
      
      // If no direct text, get innerText but limit length
      if (!text) {
        text = (element.innerText || element.textContent || '').trim();
        // Avoid huge text blocks - likely a container
        if (text.length > 100) {
          // Try to get just the first meaningful part
          var firstLine = text.split('\\n')[0].trim();
          if (firstLine.length > 0 && firstLine.length < 100) {
            text = firstLine;
          } else {
            text = text.substring(0, 50);
          }
        }
      }
      
      // Prefer aria-label for icon-only buttons
      if (!text && ariaLabel) {
        text = ariaLabel;
      }
      
      // DEBUG: ALWAYS log text capture for troubleshooting missing 's' issue
      // The issue: "List" becomes "Li t", "User" becomes "U er"
      if (text && text.length > 0) {
        var charCodes = [];
        for (var c = 0; c < Math.min(text.length, 50); c++) {
          charCodes.push(text.charCodeAt(c).toString(16));
        }
        // Check specifically for patterns that might indicate missing 's'
        var hasSuspiciousSpace = / [a-z]/.test(text) && !/\b[a-z]/.test(text.replace(/ [a-z]/g, ''));
        if (hasSuspiciousSpace || text.includes('Li t') || text.includes('U er') || text.includes('  ')) {
          console.log('[Flowstral Recipe] ⚠️ SUSPICIOUS TEXT:', text);
          console.log('[Flowstral Recipe] ⚠️ CharCodes:', charCodes.join(' '));
        }
      }
      
      // CRITICAL: Normalize text before returning
      // This ensures consistent apostrophe characters for recording AND playback matching
      return this.normalizeText(text);
    },
    
    // ========== LOCATION FINDING ==========
    
    findNearestLandmark: function(element) {
      var landmarks = ['header', 'main', 'nav', 'footer', 'aside', 'form', 'dialog', 'section', 'article'];
      var landmarkRoles = ['banner', 'main', 'navigation', 'contentinfo', 'complementary', 'form', 'dialog', 'region', 'article'];
      
      var current = element.parentElement;
      while (current && current !== document.body) {
        var tag = current.tagName.toLowerCase();
        var role = current.getAttribute('role');
        
        if (landmarks.indexOf(tag) >= 0) return tag;
        if (role && landmarkRoles.indexOf(role) >= 0) return role;
        
        current = current.parentElement;
      }
      return null;
    },
    
    findParentWithRole: function(element) {
      var containerRoles = ['tablist', 'menu', 'menubar', 'listbox', 'toolbar', 'tree', 'grid', 'radiogroup', 'group'];
      
      var current = element.parentElement;
      while (current && current !== document.body) {
        var role = current.getAttribute('role');
        if (role && containerRoles.indexOf(role) >= 0) {
          return role;
        }
        current = current.parentElement;
      }
      return null;
    },
    
    findNearbyLabel: function(element) {
      // Check for associated label via 'for' attribute
      var id = element.id;
      if (id) {
        var label = document.querySelector('label[for="' + id + '"]');
        if (label) return label.innerText.trim();
      }
      
      // Check for wrapping label
      var labelParent = element.closest('label');
      if (labelParent) {
        var labelText = labelParent.innerText.trim();
        // Remove the element's own text
        var elementText = this.getVisibleText(element);
        if (elementText) {
          labelText = labelText.replace(elementText, '').trim();
        }
        if (labelText) return labelText;
      }
      
      // Check for aria-labelledby
      var labelledBy = element.getAttribute('aria-labelledby');
      if (labelledBy) {
        var labelEl = document.getElementById(labelledBy);
        if (labelEl) return labelEl.innerText.trim();
      }
      
      // Look for nearby heading or label in parent
      var parent = element.parentElement;
      for (var i = 0; i < 3 && parent && parent !== document.body; i++) {
        var heading = parent.querySelector('h1, h2, h3, h4, h5, h6, label, .label, [class*="label"], legend');
        if (heading && heading !== element) {
          var headingText = heading.innerText.trim();
          if (headingText && headingText.length < 100) return headingText;
        }
        parent = parent.parentElement;
      }
      
      return null;
    },
    
    // ========== DISAMBIGUATION ==========
    
    getPositionAmongSiblings: function(element) {
      var role = this.getRole(element);
      var tag = element.tagName.toLowerCase();
      var parent = element.parentElement;
      
      if (!parent) return null;
      
      // Find siblings with same role/tag
      var siblings = [];
      for (var i = 0; i < parent.children.length; i++) {
        var child = parent.children[i];
        var childRole = this.getRole(child);
        var childTag = child.tagName.toLowerCase();
        
        if ((role && childRole === role) || (!role && childTag === tag)) {
          siblings.push(child);
        }
      }
      
      // If only one, position doesn't matter
      if (siblings.length <= 1) return null;
      
      // Find position (1-based)
      for (var j = 0; j < siblings.length; j++) {
        if (siblings[j] === element) return j + 1;
      }
      
      return null;
    },
    
    // NEW: Get position among ALL matching elements on page (for duplicate "Add to Cart" etc.)
    getGlobalPosition: function(element) {
      var role = this.getRole(element);
      var text = this.getVisibleText(element);
      
      if (!text) return null;
      
      // Find all elements with same role and text
      var selector = role ? '[role="' + role + '"]' : element.tagName.toLowerCase();
      var allMatching = [];
      
      try {
        var candidates = document.querySelectorAll(selector + ', button, a, [role="button"]');
        for (var i = 0; i < candidates.length; i++) {
          var candidate = candidates[i];
          var candidateRole = this.getRole(candidate);
          var candidateText = this.getVisibleText(candidate);
          
          // Match by role+text or just text for buttons
          if (candidateText === text && (!role || candidateRole === role)) {
            allMatching.push(candidate);
          }
        }
      } catch (e) {
        console.log('[ElementRecipe] Error in getGlobalPosition:', e);
        return null;
      }
      
      // If only one, no position needed
      if (allMatching.length <= 1) return null;
      
      // Find position (1-based)
      for (var j = 0; j < allMatching.length; j++) {
        if (allMatching[j] === element) {
          return { position: j + 1, total: allMatching.length };
        }
      }
      
      return null;
    },
    
    getTestId: function(element) {
      for (var i = 0; i < this.testIdAttributes.length; i++) {
        var attr = this.testIdAttributes[i];
        var value = element.getAttribute(attr);
        if (value) return value;
      }
      return null;
    },
    
    isTextUnique: function(element, text) {
      if (!text) return false;
      
      // Get the search scope (parent landmark or body)
      var scope = element.closest('main, header, nav, form, dialog, section') || document.body;
      
      // Count elements with same text
      var count = 0;
      var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        if (walker.currentNode.textContent.trim() === text) {
          count++;
          if (count > 1) return false;
        }
      }
      
      return count === 1;
    },
    
    // ========== MAIN ANALYZER ==========
    
    analyze: function(element) {
      if (!element || !element.tagName) return null;
      
      var tag = element.tagName.toLowerCase();
      var role = this.getRole(element);
      var text = this.getVisibleText(element);
      var testId = this.getTestId(element);
      var id = element.id;
      var name = element.getAttribute('name');
      var ariaLabel = element.getAttribute('aria-label');
      var placeholder = element.getAttribute('placeholder');
      var type = element.type || null;
      
      // Build the recipe
      var recipe = {
        what: {},
        where: {},
        which: {}
      };
      
      // WHAT is it?
      if (role) recipe.what.role = role;
      if (text) recipe.what.text = text;
      recipe.what.tag = tag;
      if (type && tag === 'input') recipe.what.type = type;
      
      // WHERE is it?
      var landmark = this.findNearestLandmark(element);
      if (landmark) recipe.where.landmark = landmark;
      
      var within = this.findParentWithRole(element);
      if (within) recipe.where.within = within;
      
      var nearText = this.findNearbyLabel(element);
      if (nearText) recipe.where.nearText = nearText;
      
      // WHICH ONE is it?
      // First try testId (most stable)
      if (testId) recipe.which.testId = testId;
      
      // Then try sibling position
      var position = this.getPositionAmongSiblings(element);
      if (position) recipe.which.position = position;
      
      // If no sibling position, try global position (for duplicate "Add to Cart" buttons etc.)
      if (!position && !testId) {
        var globalPos = this.getGlobalPosition(element);
        if (globalPos) {
          recipe.which.position = globalPos.position;
          recipe.which.totalMatching = globalPos.total;
        }
      }
      
      if (id && !this.isUnstableId(id)) {
        recipe.which.id = id;
      }
      
      if (name) recipe.which.name = name;
      if (ariaLabel && ariaLabel !== text) recipe.which.ariaLabel = ariaLabel;
      if (placeholder) recipe.which.placeholder = placeholder;
      
      recipe.which.uniqueText = this.isTextUnique(element, text);
      
      // CONFIRMATION data
      var rect = element.getBoundingClientRect();
      recipe.confirm = {
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
      
      // Generate a fallback CSS selector
      var cssSelector = this.generateFallbackSelector(element);
      if (cssSelector) recipe.confirm.cssSelector = cssSelector;
      
      return recipe;
    },
    
    generateFallbackSelector: function(element) {
      var parts = [];
      var current = element;
      
      for (var i = 0; i < 3 && current && current !== document.body; i++) {
        var tag = current.tagName.toLowerCase();
        var id = current.id;
        var testId = this.getTestId(current);
        
        if (testId) {
          parts.unshift('[data-testid="' + testId + '"]');
          break;
        }
        
        if (id && !this.isUnstableId(id)) {
          parts.unshift('#' + id);
          break;
        }
        
        // Use tag + nth-child
        var parent = current.parentElement;
        if (parent) {
          var index = Array.from(parent.children).indexOf(current) + 1;
          parts.unshift(tag + ':nth-child(' + index + ')');
        } else {
          parts.unshift(tag);
        }
        
        current = current.parentElement;
      }
      
      return parts.join(' > ');
    },
    
    // ========== DESCRIPTION GENERATOR ==========
    
    generateDescription: function(action, recipe) {
      var what = recipe.what;
      var where = recipe.where;
      
      var desc = action;
      
      // Add what
      if (what.text) {
        desc += ' "' + what.text + '"';
      } else if (what.role) {
        desc += ' ' + what.role;
      } else {
        desc += ' ' + what.tag;
      }
      
      // Add context if helpful
      if (where.nearText && !what.text) {
        desc += ' near "' + where.nearText + '"';
      }
      
      return desc;
    }
  };
  
  console.log('[Flowstral] Element Analyzer v2 loaded');
})();
`;
}

/**
 * Generate a human-readable description from a recipe
 */
function generateDescription(action, recipe) {
  const { what, where } = recipe;
  
  let desc = action;
  
  // Add what
  if (what.text) {
    desc += ` "${what.text}"`;
  } else if (what.role) {
    desc += ` ${what.role}`;
  } else {
    desc += ` ${what.tag}`;
  }
  
  // Add context if helpful
  if (where.nearText && !what.text) {
    desc += ` near "${where.nearText}"`;
  }
  
  if (where.within) {
    desc += ` in ${where.within}`;
  }
  
  return desc;
}

/**
 * Convert an ElementRecipe to the legacy selectorObj format for backward compatibility
 */
function recipeToLegacySelector(recipe) {
  const { what, which, confirm } = recipe;
  
  return {
    // Primary selector (best match)
    selector: confirm?.cssSelector || null,
    // Test ID is highest priority
    testId: which.testId || null,
    dataTestId: which.testId || null,
    // Other identifiers
    id: which.id || null,
    name: which.name || null,
    ariaLabel: which.ariaLabel || what.text || null,
    placeholder: which.placeholder || null,
    // Text for fallback
    text: what.text || '',
    // Role info
    role: what.role || null,
    // The full recipe for new finder
    recipe: recipe
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Scripts
  getElementAnalyzerScript,
  
  // Utilities
  generateDescription,
  recipeToLegacySelector,
  
  // Constants (for testing/debugging)
  TAG_TO_ROLE,
  INPUT_TYPE_TO_ROLE,
  CUSTOM_ELEMENT_ROLES,
  TESTID_ATTRIBUTES,
  UNSTABLE_ID_PATTERNS,
};
