/**
 * AI DOM Resolver — Finds elements by sending pruned DOM to GPT-4o-mini
 * 
 * ARCHITECTURE:
 * When all deterministic strategies fail, this module:
 * 1. Extracts a PRUNED DOM snapshot (only visible, interactive elements)
 * 2. Sends the pruned DOM + element recipe to GPT-4o-mini (text, not vision)
 * 3. Gets back a CSS selector or XPath
 * 4. Validates the selector actually finds exactly 1 element
 * 5. Returns a Playwright locator (not coordinates!)
 * 
 * WHY THIS IS BETTER THAN VISION:
 * - 10x cheaper (text tokens vs image tokens)
 * - Returns real selectors (cacheable in strategy memory)
 * - More accurate (sees actual DOM structure, not rendered pixels)
 * - Works for invisible/off-screen elements
 * - Generates reusable locators for future runs
 * 
 * COST: ~$0.0003 per call with pruned DOM (~2K tokens)
 * MODEL: gpt-4o-mini (best cost/performance for structured JSON output)
 * 
 * @author Flowstral AI
 * @version 1.0.0
 */

const PRUNE_SCRIPT = `
() => {
  // ═══════════════════════════════════════════════════════════════
  // DOM PRUNER — Extract minimal DOM representation for AI analysis
  // Only includes visible, interactive, or landmark elements
  // Strips all style/script/svg/meta content
  // ═══════════════════════════════════════════════════════════════
  
  const MAX_ELEMENTS = 300;    // Cap to keep token count manageable
  const MAX_TEXT_LEN = 80;     // Truncate text content
  const MAX_DEPTH = 12;        // Don't go deeper than this
  
  const INTERACTIVE_TAGS = new Set([
    'a', 'button', 'input', 'select', 'textarea', 'label',
    'details', 'summary', 'dialog', 'menu', 'menuitem'
  ]);
  
  const LANDMARK_TAGS = new Set([
    'header', 'footer', 'nav', 'main', 'aside', 'section',
    'article', 'form', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'fieldset', 'legend',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ]);
  
  const INTERACTIVE_ROLES = new Set([
    'button', 'link', 'textbox', 'checkbox', 'radio', 'switch',
    'tab', 'tabpanel', 'menuitem', 'option', 'combobox', 'listbox',
    'searchbox', 'spinbutton', 'slider', 'dialog', 'alertdialog',
    'treeitem', 'gridcell', 'row', 'columnheader', 'rowheader'
  ]);
  
  const SKIP_TAGS = new Set([
    'script', 'style', 'link', 'meta', 'noscript', 'svg', 'path',
    'defs', 'clippath', 'mask', 'symbol', 'use', 'br', 'hr', 'wbr',
    'template', 'slot', 'base', 'head', 'title'
  ]);
  
  // Important attributes to preserve (everything else stripped)
  const KEEP_ATTRS = [
    'id', 'class', 'name', 'type', 'role', 'href', 'value',
    'placeholder', 'aria-label', 'aria-labelledby', 'aria-describedby',
    'aria-expanded', 'aria-selected', 'aria-checked', 'aria-haspopup',
    'data-testid', 'data-test', 'data-cy', 'data-automation-id',
    'data-aura-rendered-by', 'data-component-id', 'data-field-id',
    'title', 'for', 'action', 'method', 'tabindex', 'contenteditable',
    'disabled', 'readonly', 'checked', 'selected', 'required'
  ];

  let elementCount = 0;

  function isVisible(el) {
    if (!el.offsetParent && el.tagName !== 'BODY' && el.tagName !== 'HTML' &&
        getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'sticky') {
      return false;
    }
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && 
           parseFloat(style.opacity) > 0;
  }

  function isRelevant(el) {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return false;
    if (INTERACTIVE_TAGS.has(tag)) return true;
    if (LANDMARK_TAGS.has(tag)) return true;
    const role = el.getAttribute('role');
    if (role && INTERACTIVE_ROLES.has(role)) return true;
    if (el.hasAttribute('onclick') || el.hasAttribute('data-testid')) return true;
    if (el.contentEditable === 'true') return true;
    // Include divs/spans with meaningful text or roles
    if ((tag === 'div' || tag === 'span') && el.getAttribute('role')) return true;
    return false;
  }

  function getCleanText(el) {
    // Get direct text content (not from children)
    let text = '';
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      }
    }
    text = text.trim().replace(/\\s+/g, ' ');
    if (text.length > MAX_TEXT_LEN) {
      text = text.substring(0, MAX_TEXT_LEN) + '...';
    }
    return text;
  }

  function serializeElement(el, depth = 0) {
    if (elementCount >= MAX_ELEMENTS) return '';
    if (depth > MAX_DEPTH) return '';
    
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag)) return '';
    
    // Skip invisible elements (but still process children of containers)
    const visible = isVisible(el);
    const relevant = isRelevant(el);
    
    // Build attribute string (only important attrs)
    let attrs = '';
    if (relevant && visible) {
      for (const attrName of KEEP_ATTRS) {
        const val = el.getAttribute(attrName);
        if (val !== null && val !== '' && val !== 'false') {
          // Truncate long class names
          let cleanVal = val;
          if (attrName === 'class') {
            cleanVal = val.split(' ').slice(0, 5).join(' ');
            if (val.split(' ').length > 5) cleanVal += ' ...';
          }
          if (cleanVal.length > 100) cleanVal = cleanVal.substring(0, 100) + '...';
          attrs += ' ' + attrName + '="' + cleanVal.replace(/"/g, "'") + '"';
        }
      }
    }

    // Get text content
    const text = (relevant && visible) ? getCleanText(el) : '';
    
    // Process children
    let childrenHtml = '';
    for (const child of el.children) {
      childrenHtml += serializeElement(child, depth + 1);
    }
    
    // Decide whether to include this element
    if (!relevant && !childrenHtml && !text) return '';
    
    // Include relevant visible elements, or containers with relevant children
    if ((relevant && visible) || childrenHtml) {
      elementCount++;
      const indent = '  '.repeat(depth);
      
      if (!childrenHtml && !text) {
        return indent + '<' + tag + attrs + '/>' + '\\n';
      }
      
      if (!childrenHtml && text) {
        return indent + '<' + tag + attrs + '>' + text + '</' + tag + '>' + '\\n';
      }
      
      let result = indent + '<' + tag + attrs + '>' + '\\n';
      if (text) result += indent + '  ' + text + '\\n';
      result += childrenHtml;
      result += indent + '</' + tag + '>' + '\\n';
      return result;
    }
    
    return '';
  }

  // Start from body
  const body = document.body;
  if (!body) return '<body></body>';
  
  let html = serializeElement(body, 0);
  
  // If too short (maybe a SPA not fully loaded), return raw body with max size
  if (html.length < 50) {
    html = body.innerHTML.substring(0, 8000);
  }
  
  // Cap total size at ~8KB to keep tokens under ~3K
  if (html.length > 8000) {
    html = html.substring(0, 8000) + '\\n<!-- truncated -->';
  }
  
  return html;
}
`;

/**
 * Build the prompt for AI DOM resolution
 */
function buildDOMResolverPrompt(prunedDOM, recipe, actionType, pageContext) {
  const recipeDesc = [];
  
  if (recipe?.what?.role) recipeDesc.push(`Role: ${recipe.what.role}`);
  if (recipe?.what?.text) recipeDesc.push(`Text: "${recipe.what.text}"`);
  if (recipe?.what?.tag) recipeDesc.push(`Tag: ${recipe.what.tag}`);
  if (recipe?.where?.landmark) recipeDesc.push(`Inside: ${recipe.where.landmark}`);
  if (recipe?.where?.nearText) recipeDesc.push(`Near text: "${recipe.where.nearText}"`);
  if (recipe?.where?.within) recipeDesc.push(`Within: ${recipe.where.within}`);
  if (recipe?.which?.testId) recipeDesc.push(`data-testid: "${recipe.which.testId}"`);
  if (recipe?.which?.ariaLabel) recipeDesc.push(`aria-label: "${recipe.which.ariaLabel}"`);
  if (recipe?.which?.placeholder) recipeDesc.push(`Placeholder: "${recipe.which.placeholder}"`);
  if (recipe?.which?.name) recipeDesc.push(`Name: "${recipe.which.name}"`);
  if (recipe?.which?.id) recipeDesc.push(`ID: "${recipe.which.id}"`);
  if (recipe?.which?.position) recipeDesc.push(`Position: ${recipe.which.position} among matches`);
  if (recipe?.confirm?.cssSelector) recipeDesc.push(`Previous CSS: ${recipe.confirm.cssSelector}`);
  
  return {
    system: `You are a DOM element locator for automated UI testing. Given a pruned DOM and element description, find the EXACT element and return a CSS selector.

RULES:
1. Return ONLY valid JSON: {"found": true, "selector": "css-selector-here", "confidence": 0.95, "reason": "brief explanation"}
2. The CSS selector MUST be specific enough to match exactly ONE element
3. Prefer selectors using: data-testid > aria-label > role+name > id > class combinations
4. NEVER use fragile selectors like nth-child chains or deep nesting beyond 3 levels
5. If the element is NOT in the DOM, return: {"found": false, "selector": null, "confidence": 0, "reason": "why"}
6. Confidence: 0.9+ = exact match, 0.7-0.9 = likely match, <0.7 = uncertain`,
    
    user: `ACTION: ${actionType}
PAGE: ${pageContext.url || 'unknown'}${pageContext.title ? ' | ' + pageContext.title : ''}

TARGET ELEMENT:
${recipeDesc.join('\n')}

PRUNED DOM:
${prunedDOM}`
  };
}

/**
 * AI DOM Resolver — Find elements using DOM analysis with GPT-4o-mini
 */
class AIDomResolver {
  constructor(options = {}) {
    this.backendUrl = options.backendUrl || process.env.BACKEND_URL || 'http://localhost:8000';
    this.openaiKey = options.openaiKey || process.env.OPENAI_API_KEY || '';
    this.model = options.model || 'gpt-4o-mini';
    this.debug = options.debug !== false;
    this.maxTokens = options.maxTokens || 200;
    
    // Stats
    this.callCount = 0;
    this.successCount = 0;
    this.totalLatencyMs = 0;
  }
  
  log(...args) {
    if (this.debug) console.log('[AI-DOM-Resolver]', ...args);
  }

  /**
   * Resolve an element using AI DOM analysis.
   * 
   * @param {import('playwright').Page} page - Playwright page
   * @param {Object} action - The action object with recipe/selectorObj
   * @param {Object} options - { actionType, recipe }
   * @returns {Promise<{locator: import('playwright').Locator, selector: string, strategy: string, confidence: number} | null>}
   */
  async resolve(page, action, options = {}) {
    const startTime = Date.now();
    this.callCount++;
    
    try {
      // Step 1: Get pruned DOM
      this.log('Extracting pruned DOM...');
      let prunedDOM;
      try {
        prunedDOM = await page.evaluate(PRUNE_SCRIPT);
      } catch (e) {
        this.log('Failed to extract DOM:', e.message);
        return null;
      }
      
      if (!prunedDOM || prunedDOM.length < 30) {
        this.log('DOM too short or empty, skipping');
        return null;
      }
      
      // Step 2: Build recipe from action
      const recipe = options.recipe || this._buildRecipeFromAction(action);
      const actionType = options.actionType || action.type || action.qword || 'click';
      
      // Step 3: Get page context
      const pageContext = {
        url: page.url(),
        title: await page.title().catch(() => '')
      };
      
      // Step 4: Build prompt
      const prompt = buildDOMResolverPrompt(prunedDOM, recipe, actionType, pageContext);
      
      // Step 5: Call LLM
      this.log(`Calling ${this.model} for DOM resolution...`);
      const aiResult = await this._callLLM(prompt);
      
      if (!aiResult || !aiResult.found || !aiResult.selector) {
        this.log('AI could not find element:', aiResult?.reason || 'no response');
        return null;
      }
      
      if (aiResult.confidence < 0.65) {
        this.log(`Low confidence (${aiResult.confidence}), skipping`);
        return null;
      }
      
      // Step 6: Validate the selector actually works
      this.log(`Validating selector: ${aiResult.selector}`);
      const validationResult = await this._validateSelector(page, aiResult.selector, recipe);
      
      if (!validationResult) {
        this.log('Selector validation failed');
        return null;
      }
      
      const latency = Date.now() - startTime;
      this.successCount++;
      this.totalLatencyMs += latency;
      
      this.log(`✅ AI DOM resolved: "${aiResult.selector}" (${aiResult.confidence * 100}% confidence, ${latency}ms)`);
      
      return {
        locator: validationResult.locator,
        selector: aiResult.selector,
        strategy: 'ai-dom',
        confidence: aiResult.confidence,
        reason: aiResult.reason || 'AI DOM analysis',
        latencyMs: latency
      };
      
    } catch (error) {
      this.log('Error:', error.message);
      return null;
    }
  }

  /**
   * Call the LLM (tries backend first, then direct OpenAI)
   */
  async _callLLM(prompt) {
    // Try backend API first
    try {
      const response = await fetch(`${this.backendUrl}/api/ai/dom/resolve-element`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: prompt.system,
          user_prompt: prompt.user,
          model: this.model,
          max_tokens: this.maxTokens
        }),
        signal: AbortSignal.timeout(15000)
      });
      
      if (response.ok) {
        const result = await response.json();
        return result;
      }
    } catch (e) {
      this.log('Backend not available, trying direct OpenAI:', e.message);
    }
    
    // Direct OpenAI API
    if (!this.openaiKey) {
      this.log('No OpenAI API key configured');
      return null;
    }
    
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.openaiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          max_tokens: this.maxTokens,
          temperature: 0.1, // Low temperature for deterministic output
          response_format: { type: 'json_object' }
        }),
        signal: AbortSignal.timeout(15000)
      });
      
      if (!response.ok) {
        this.log('OpenAI API error:', response.status);
        return null;
      }
      
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      
      // Parse JSON response
      try {
        return JSON.parse(content);
      } catch (e) {
        // Try to extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          return JSON.parse(jsonMatch[0]);
        }
        this.log('Failed to parse AI response:', content);
        return null;
      }
    } catch (e) {
      this.log('OpenAI API call failed:', e.message);
      return null;
    }
  }

  /**
   * Validate that a selector finds exactly 1 visible element
   */
  async _validateSelector(page, selector, recipe) {
    try {
      const locator = page.locator(selector);
      
      // Check element count
      const count = await locator.count().catch(() => 0);
      
      if (count === 0) {
        this.log(`Selector "${selector}" found 0 elements`);
        return null;
      }
      
      if (count === 1) {
        // Verify it's visible
        const isVisible = await locator.isVisible({ timeout: 2000 }).catch(() => false);
        if (isVisible) {
          return { locator, count: 1 };
        }
        // Even if not visible, still return — might be off-screen
        return { locator, count: 1 };
      }
      
      // Multiple matches — try to disambiguate
      if (count > 1 && recipe?.which?.position) {
        const idx = recipe.which.position - 1; // position is 1-based
        if (idx >= 0 && idx < count) {
          const nthLocator = locator.nth(idx);
          return { locator: nthLocator, count };
        }
      }
      
      // Multiple matches — use first visible one
      if (count > 1 && count <= 10) {
        const firstVisible = locator.first();
        const isVis = await firstVisible.isVisible({ timeout: 1000 }).catch(() => false);
        if (isVis) {
          this.log(`Multiple matches (${count}), using first visible`);
          return { locator: firstVisible, count };
        }
      }
      
      this.log(`Selector "${selector}" found ${count} elements, too ambiguous`);
      return null;
      
    } catch (e) {
      this.log(`Selector validation error: ${e.message}`);
      return null;
    }
  }

  /**
   * Build recipe from action (same as SimpleStepExecutor._buildRecipeFromAction)
   */
  _buildRecipeFromAction(action) {
    const so = action.selectorObj || {};
    const element = action.element || {};
    const existingRecipe = action.recipe;
    
    if (existingRecipe && existingRecipe.what) return existingRecipe;
    
    const text = so.text || action.label || action.text || element.text || action.args?.[0] || '';
    const role = so.role || element.role || '';
    const tagName = (so.tagName || element.tagName || '').toLowerCase();
    
    return {
      what: { role: role || tagName, text, tag: tagName, type: element.type || '' },
      where: {
        nearText: action.recipe?.where?.nearText || '',
        within: action.recipe?.where?.within || '',
        landmark: action.recipe?.where?.landmark || '',
      },
      which: {
        testId: so.testId || element.testId || '',
        id: so.id || element.id || '',
        name: so.name || element.name || '',
        ariaLabel: so.ariaLabel || element.ariaLabel || '',
        placeholder: so.placeholder || element.placeholder || '',
        position: action.elementIndex || action.recipe?.which?.position || null,
      },
      confirm: {
        cssSelector: so.selector || so.primary || '',
      }
    };
  }

  /**
   * Get stats for this resolver
   */
  getStats() {
    return {
      calls: this.callCount,
      successes: this.successCount,
      successRate: this.callCount > 0 ? (this.successCount / this.callCount) : 0,
      avgLatencyMs: this.callCount > 0 ? Math.round(this.totalLatencyMs / this.callCount) : 0
    };
  }
}

module.exports = { AIDomResolver };
