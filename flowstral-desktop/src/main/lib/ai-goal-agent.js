/**
 * AI Goal Agent v3.0 - Truly Agentic Test Automation
 * 
 * KEY IMPROVEMENTS:
 * 1. PLAN FIRST - Single API call creates full action plan
 * 2. EXECUTE FAST - Local execution without API calls per step
 * 3. SMART UI HANDLING - Radix dropdowns, Shadow DOM, modals, tabs
 * 4. MEMORY - Tracks state across entire session
 * 5. BATCH ACTIONS - Executes 5-10 actions per API call
 * 6. BETTER MODEL - Uses GPT-4o for planning (smarter)
 * 
 * @version 3.0.0
 */

const axios = require('axios');

class AIGoalAgent {
  constructor(page, options = {}) {
    this.page = page;
    this.browserContext = page.context();
    this.apiKey = options.apiKey || process.env.OPENAI_API_KEY;
    this.planningModel = 'gpt-4o'; // Better model for planning
    this.executionModel = 'gpt-4o-mini'; // Cheaper model for quick decisions
    this.maxSteps = options.maxSteps || 50;
    this.timeout = options.timeout || 10000;
    this.debug = options.debug !== false;
    
    // Test data for filling forms
    this.testData = {
      email: 'test@example.com',
      username: 'testuser',
      password: 'Test123!@#',
      firstName: 'John',
      lastName: 'TestUser',
      phone: '555-123-4567',
      company: 'Test Company Inc',
      amount: '50000',
      date: new Date().toISOString().split('T')[0],
      description: 'Automated test entry',
      ...options.testData
    };
    
    // Execution state
    this.goal = null;
    this.actionPlan = []; // Pre-planned actions
    this.stepsTaken = [];
    this.currentStep = 0;
    this.goalAchieved = false;
    this.shouldStop = false;
    
    // V3: SESSION MEMORY - remembers state across execution
    this.memory = {
      visitedPages: [],
      addedToCart: [],
      removedFromCart: [],
      filledFields: {},
      clickedElements: [],
      currentPage: '',
      cartCount: 0,
      lastError: null
    };
    
    // Callbacks
    this.onStep = options.onStep || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onGoalAchieved = options.onGoalAchieved || (() => {});
    this.onError = options.onError || (() => {});
    
    // Handle new tabs/popups
    this.setupPopupHandler();
  }
  
  log(...args) {
    if (this.debug) {
      console.log('[AIGoalAgent]', ...args);
    }
  }
  
  stop() {
    this.shouldStop = true;
  }
  
  setupPopupHandler() {
    this.browserContext.on('page', async (newPage) => {
      this.log('New tab/popup detected, switching context');
      await newPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(() => {});
      this.page = newPage;
    });
  }
  
  // ==========================================================================
  // V3: DEEP PAGE ANALYSIS - Understands complex UI
  // ==========================================================================
  
  async analyzePageDeep() {
    const url = this.page.url();
    const title = await this.page.title();
    
    this.log('Deep analyzing page:', title);
    
    // Comprehensive element analysis
    const analysis = await this.page.evaluate(() => {
      const results = {
        products: [],
        buttons: [],
        inputs: [],
        dropdowns: [],
        tabs: [],
        links: [],
        modals: [],
        cartInfo: null,
        pageType: 'unknown'
      };
      
      // Detect page type
      const h1 = document.querySelector('h1')?.innerText?.toLowerCase() || '';
      const url = window.location.href.toLowerCase();
      if (url.includes('product') || h1.includes('product')) results.pageType = 'products';
      else if (url.includes('cart') || h1.includes('cart')) results.pageType = 'cart';
      else if (url.includes('checkout') || h1.includes('checkout')) results.pageType = 'checkout';
      else if (url.includes('login') || h1.includes('login')) results.pageType = 'login';
      
      // Find all products with their Add to Cart buttons
      document.querySelectorAll('[data-testid*="product"], .product, .product-card, [class*="product"]').forEach(product => {
        const name = product.querySelector('h3, h4, [class*="title"], [class*="name"]')?.innerText?.trim();
        const price = product.querySelector('[class*="price"], .price')?.innerText?.trim();
        // Find add button - use valid CSS selectors only (no :has-text)
        let addBtn = product.querySelector('button[data-testid*="add"], [data-testid*="add-to-cart"]');
        if (!addBtn) {
          // Fallback: find button containing "Add" text
          const buttons = product.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.innerText?.toLowerCase().includes('add')) {
              addBtn = btn;
              break;
            }
          }
        }
        const testId = product.getAttribute('data-testid');
        
        if (name) {
          results.products.push({
            name,
            price,
            testId,
            hasAddButton: !!addBtn,
            addButtonTestId: addBtn?.getAttribute('data-testid')
          });
        }
      });
      
      // Find all buttons with context
      document.querySelectorAll('button, [role="button"], input[type="submit"]').forEach(btn => {
        const rect = btn.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const text = btn.innerText?.trim() || btn.getAttribute('aria-label') || '';
        const testId = btn.getAttribute('data-testid');
        const type = text.toLowerCase();
        
        let category = 'other';
        if (type.includes('add') && type.includes('cart')) category = 'add-to-cart';
        else if (type.includes('remove') || type.includes('delete')) category = 'remove';
        else if (type.includes('checkout') || type.includes('proceed')) category = 'checkout';
        else if (type.includes('apply')) category = 'apply';
        else if (type.includes('submit')) category = 'submit';
        
        results.buttons.push({ text, testId, category });
      });
      
      // Find dropdowns (including Radix)
      document.querySelectorAll('select, [role="combobox"], [data-radix-select-trigger], [role="listbox"]').forEach(dd => {
        const label = dd.getAttribute('aria-label') || 
                      dd.closest('label')?.innerText?.trim() ||
                      dd.closest('[class*="form"]')?.querySelector('label')?.innerText?.trim();
        const testId = dd.getAttribute('data-testid');
        const currentValue = dd.value || dd.innerText?.trim();
        
        // Get options if visible
        const options = [];
        const optionsContainer = document.querySelector('[data-radix-select-content], [role="listbox"]');
        if (optionsContainer) {
          optionsContainer.querySelectorAll('[role="option"], option').forEach(opt => {
            options.push(opt.innerText?.trim());
          });
        }
        
        results.dropdowns.push({ label, testId, currentValue, options, isRadix: !!dd.hasAttribute('data-radix-select-trigger') });
      });
      
      // Find tabs
      document.querySelectorAll('[role="tab"], [data-radix-collection-item]').forEach(tab => {
        const text = tab.innerText?.trim();
        const testId = tab.getAttribute('data-testid');
        const isActive = tab.getAttribute('data-state') === 'active' || tab.getAttribute('aria-selected') === 'true';
        results.tabs.push({ text, testId, isActive });
      });
      
      // Find cart info
      const cartCount = document.querySelector('[data-testid*="cart-count"], .cart-count, [class*="cart"] .badge')?.innerText;
      const cartItems = [];
      document.querySelectorAll('[data-testid*="cart-item"], .cart-item, [class*="cart"] [class*="item"]').forEach(item => {
        const name = item.querySelector('[class*="name"], [class*="title"], h3, h4')?.innerText?.trim();
        // Find remove button - use valid CSS selectors only (no :has-text)
        let removeBtn = item.querySelector('button[data-testid*="remove"]');
        if (!removeBtn) {
          // Fallback: find button containing "Remove" text
          const buttons = item.querySelectorAll('button');
          for (const btn of buttons) {
            if (btn.innerText?.toLowerCase().includes('remove')) {
              removeBtn = btn;
              break;
            }
          }
        }
        if (name) cartItems.push({ name, hasRemoveButton: !!removeBtn });
      });
      
      if (cartCount || cartItems.length) {
        results.cartInfo = { count: parseInt(cartCount) || cartItems.length, items: cartItems };
      }
      
      // Find active modals
      const modal = document.querySelector('[role="dialog"], [aria-modal="true"], .modal.show');
      if (modal) {
        results.modals.push({
          title: modal.querySelector('h2, [class*="title"]')?.innerText?.trim(),
          hasCloseButton: !!modal.querySelector('[aria-label*="close"], .close, [data-dismiss]')
        });
      }
      
      // Find input fields
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]), textarea').forEach(input => {
        const rect = input.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        
        const label = input.getAttribute('aria-label') || 
                      input.placeholder ||
                      document.querySelector(`label[for="${input.id}"]`)?.innerText?.trim() ||
                      input.closest('label')?.innerText?.trim();
        
        results.inputs.push({
          label,
          type: input.type,
          testId: input.getAttribute('data-testid'),
          name: input.name,
          currentValue: input.value
        });
      });
      
      return results;
    });
    
    this.memory.currentPage = analysis.pageType;
    this.log('Page type:', analysis.pageType);
    this.log('Products found:', analysis.products.length);
    this.log('Buttons found:', analysis.buttons.length);
    this.log('Dropdowns found:', analysis.dropdowns.length);
    
    return { url, title, ...analysis };
  }
  
  // ==========================================================================
  // V3: SMART PLANNING - Creates full action plan in ONE API call
  // ==========================================================================
  
  async createActionPlan(pageAnalysis) {
    const prompt = `You are an expert test automation AI. Create a COMPLETE action plan to achieve the goal.

GOAL: "${this.goal}"

CURRENT PAGE STATE:
- Page Type: ${pageAnalysis.pageType}
- URL: ${pageAnalysis.url}
- Title: ${pageAnalysis.title}

PRODUCTS ON PAGE (${pageAnalysis.products.length}):
${pageAnalysis.products.map((p, i) => `${i + 1}. "${p.name}" - ${p.price || 'no price'} ${p.hasAddButton ? '(has Add button)' : ''}`).join('\n')}

CART INFO:
${pageAnalysis.cartInfo ? `- Items in cart: ${pageAnalysis.cartInfo.count}\n- Items: ${pageAnalysis.cartInfo.items.map(i => i.name).join(', ')}` : '- Cart is empty or not visible'}

AVAILABLE TABS: ${pageAnalysis.tabs.map(t => `"${t.text}"${t.isActive ? ' (active)' : ''}`).join(', ') || 'None'}

DROPDOWNS: ${pageAnalysis.dropdowns.map(d => `"${d.label || 'unnamed'}" (current: "${d.currentValue || 'empty'}")`).join(', ') || 'None'}

BUTTONS: ${pageAnalysis.buttons.filter(b => b.category !== 'other').map(b => `"${b.text}" (${b.category})`).join(', ')}

MEMORY (what's already done):
- Added to cart: ${this.memory.addedToCart.join(', ') || 'none'}
- Removed from cart: ${this.memory.removedFromCart.join(', ') || 'none'}
- Visited pages: ${this.memory.visitedPages.join(', ') || 'none'}

TEST DATA: ${JSON.stringify(this.testData)}

Create a plan with 5-15 actions. Each action should be specific and executable.

IMPORTANT RULES:
1. To add ALL products, click each "Add to Cart" button individually
2. To remove specific products, go to Cart first, then click Remove for each
3. For Radix dropdowns: click to open, then click the option text
4. If goal says "all products", list EACH product to add
5. Be specific: "Click Add to Cart for iPhone 15 Pro" not "Add products"

Return JSON:
{
  "plan": [
    { "action": "click", "target": "Products tab", "reason": "Navigate to products" },
    { "action": "click", "target": "Add to Cart for iPhone 15 Pro", "reason": "Add first product" },
    { "action": "click", "target": "Add to Cart for MacBook Pro", "reason": "Add second product" },
    // ... continue for ALL products
    { "action": "click", "target": "Cart tab", "reason": "Go to cart" },
    { "action": "click", "target": "Remove for Nintendo Switch", "reason": "Remove as per goal" },
    { "action": "click", "target": "Shipping Method dropdown", "reason": "Open shipping dropdown" },
    { "action": "click", "target": "Express Shipping option", "reason": "Select express" },
    { "action": "verify", "target": "cart total", "reason": "Verify total is correct" }
  ],
  "expectedOutcome": "All products added, specified items removed, express shipping selected"
}`;

    try {
      this.log('Creating action plan with GPT-4o...');
      const response = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: this.planningModel, // GPT-4o for better planning
        messages: [
          { 
            role: 'system', 
            content: 'You are an expert test automation planner. Create detailed, executable action plans. Be specific about each action. Always respond with valid JSON.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 3000,
        response_format: { type: 'json_object' }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const result = JSON.parse(response.data.choices[0].message.content);
      this.log('Plan created with', result.plan.length, 'actions');
      return result.plan;
    } catch (error) {
      this.log('Planning error:', error.message);
      throw error;
    }
  }
  
  // ==========================================================================
  // V3: SMART ACTION EXECUTION - Handles complex UI without API calls
  // ==========================================================================
  
  async executeSmartAction(action) {
    const { action: actionType, target, reason } = action;
    this.log(`Executing: ${actionType} - "${target}" (${reason})`);
    
    try {
      switch (actionType) {
        case 'click':
          return await this.smartClick(target);
        case 'fill':
          return await this.smartFill(target, action.value);
        case 'select':
          return await this.smartSelect(target, action.value);
        case 'verify':
          return await this.smartVerify(target);
        case 'wait':
          await this.page.waitForTimeout(1000);
          return { success: true };
        case 'navigate':
          await this.page.goto(target, { waitUntil: 'domcontentloaded' });
          return { success: true };
        default:
          return await this.smartClick(target);
      }
    } catch (error) {
      this.log('Action failed:', error.message);
      this.memory.lastError = error.message;
      return { success: false, error: error.message };
    }
  }
  
  async smartClick(target) {
    const targetLower = target.toLowerCase();
    this.log(`SmartClick: "${target}"`);
    
    // PRIORITY 1: Handle "Add to Cart for X" pattern - MUST find specific product
    if (targetLower.includes('add to cart for') || targetLower.includes('add') && targetLower.includes('cart')) {
      const productName = target.replace(/add to cart (for )?/i, '').replace(/add (to )?cart/i, '').trim();
      this.log(`Looking for product: "${productName}"`);
      
      // Skip if already added
      if (this.memory.addedToCart.includes(productName)) {
        this.log(`Already added ${productName}, skipping`);
        return { success: true, method: 'already-added', skipped: true };
      }
      
      // Strategy A: Find product card by name, then its Add button
      // Try multiple card selectors
      const cardSelectors = [
        `[data-testid*="product"]:has-text("${productName}")`,
        `.product-card:has-text("${productName}")`,
        `[class*="product"]:has-text("${productName}")`,
        `[class*="card"]:has-text("${productName}")`,
        // Just find a div containing the product name and an Add button
        `div:has(h3:has-text("${productName}")):has(button:has-text("Add"))`,
        `div:has(h4:has-text("${productName}")):has(button:has-text("Add"))`
      ];
      
      for (const selector of cardSelectors) {
        try {
          const productCard = this.page.locator(selector).first();
          if (await productCard.count() > 0) {
            const addBtn = productCard.locator('button:has-text("Add")');
            if (await addBtn.count() > 0) {
              await addBtn.first().scrollIntoViewIfNeeded().catch(() => {});
              await addBtn.first().click({ timeout: 5000 });
              this.memory.addedToCart.push(productName);
              this.log(`✓ Added ${productName} via ${selector}`);
              return { success: true, method: 'product-card-add' };
            }
          }
        } catch (e) {
          // Try next selector
        }
      }
      
      // Strategy B: Find by data-testid pattern
      const testIdName = productName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const testIdBtn = this.page.locator(`[data-testid*="add"][data-testid*="${testIdName}"], [data-testid="add-to-cart-${testIdName}"]`);
      if (await testIdBtn.count() > 0) {
        await testIdBtn.first().click({ timeout: 5000 });
        this.memory.addedToCart.push(productName);
        this.log(`✓ Added ${productName} via testId`);
        return { success: true, method: 'testid-add' };
      }
      
      // Strategy C: Find the Nth Add to Cart button (based on how many we've added)
      const addButtons = this.page.locator('button:has-text("Add to Cart"), button:has-text("Add")');
      const btnCount = await addButtons.count();
      const alreadyAddedCount = this.memory.addedToCart.length;
      
      if (btnCount > alreadyAddedCount) {
        await addButtons.nth(alreadyAddedCount).scrollIntoViewIfNeeded().catch(() => {});
        await addButtons.nth(alreadyAddedCount).click({ timeout: 5000 });
        this.memory.addedToCart.push(productName);
        this.log(`✓ Added ${productName} via nth(${alreadyAddedCount})`);
        return { success: true, method: 'nth-add' };
      }
      
      this.log(`✗ Could not find Add button for ${productName}`);
    }
    
    // PRIORITY 2: Handle "Remove for X" pattern
    if (targetLower.includes('remove for') || targetLower.includes('remove')) {
      const itemName = target.replace(/remove (for )?/i, '').trim();
      this.log(`Looking to remove: "${itemName}"`);
      
      // Find cart item containing this name, then click its Remove button
      const itemSelectors = [
        `[data-testid*="cart-item"]:has-text("${itemName}")`,
        `.cart-item:has-text("${itemName}")`,
        `[class*="cart"]:has-text("${itemName}")`,
        `tr:has-text("${itemName}")`,
        `div:has-text("${itemName}"):has(button:has-text("Remove"))`
      ];
      
      for (const selector of itemSelectors) {
        try {
          const cartItem = this.page.locator(selector).first();
          if (await cartItem.count() > 0) {
            const removeBtn = cartItem.locator('button:has-text("Remove"), button:has-text("Delete"), [aria-label*="remove"]');
            if (await removeBtn.count() > 0) {
              await removeBtn.first().click({ timeout: 5000 });
              this.memory.removedFromCart.push(itemName);
              this.log(`✓ Removed ${itemName}`);
              return { success: true, method: 'cart-item-remove' };
            }
          }
        } catch (e) {
          // Try next
        }
      }
    }
    
    // PRIORITY 3: Handle TAB clicks (e.g., "Products tab", "Cart tab")
    if (targetLower.includes('tab')) {
      const tabName = target.replace(/\s*tab\s*/i, '').trim();
      this.log(`Looking for tab: "${tabName}"`);
      
      // Try role-based tab finding
      let locator = this.page.getByRole('tab', { name: new RegExp(tabName, 'i') });
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        this.log(`✓ Clicked tab ${tabName} via role`);
        return { success: true, method: 'role-tab' };
      }
      
      // Try Radix tabs
      locator = this.page.locator(`[data-radix-collection-item]:has-text("${tabName}")`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        this.log(`✓ Clicked tab ${tabName} via radix`);
        return { success: true, method: 'radix-tab' };
      }
      
      // Try text-based
      locator = this.page.locator(`[role="tab"]:has-text("${tabName}")`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'role-tab-text' };
      }
    }
    
    // PRIORITY 4: Handle dropdown/select
    if (targetLower.includes('dropdown') || targetLower.includes('shipping') || targetLower.includes('select')) {
      const dropdownLabel = target.replace(/(dropdown|select)/i, '').trim();
      this.log(`Looking for dropdown: "${dropdownLabel}"`);
      
      // Try Radix select trigger
      let locator = this.page.locator('[data-radix-select-trigger]');
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        this.log(`✓ Clicked Radix dropdown`);
        return { success: true, method: 'radix-trigger' };
      }
      
      // Try by role combobox
      locator = this.page.getByRole('combobox');
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'combobox' };
      }
    }
    
    // PRIORITY 5: Handle dropdown OPTION selection
    if (targetLower.includes('option') || targetLower.includes('shipping')) {
      const optionText = target.replace(/(option|shipping)/gi, '').trim();
      this.log(`Looking for option: "${optionText}"`);
      
      // Try role option
      let locator = this.page.getByRole('option', { name: new RegExp(optionText, 'i') });
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'role-option' };
      }
      
      // Try Radix select item
      locator = this.page.locator(`[data-radix-collection-item]:has-text("${optionText}")`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'radix-option' };
      }
      
      // Try text in listbox
      locator = this.page.locator(`[role="listbox"] >> text=${optionText}`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'listbox-text' };
      }
    }
    
    // FALLBACK STRATEGIES
    
    // Strategy 1: Exact text match
    let locator = this.page.getByText(target, { exact: true });
    if (await locator.count() > 0) {
      await locator.first().click({ timeout: 5000 });
      this.updateMemory('click', target);
      return { success: true, method: 'exact-text' };
    }
    
    // Strategy 2: Role-based (buttons, tabs, links)
    for (const role of ['button', 'tab', 'link', 'menuitem']) {
      locator = this.page.getByRole(role, { name: new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        this.updateMemory('click', target);
        return { success: true, method: `role-${role}` };
      }
    }
    
    // Strategy 3: Partial text match
    locator = this.page.getByText(target, { exact: false });
    if (await locator.count() > 0) {
      await locator.first().scrollIntoViewIfNeeded().catch(() => {});
      await locator.first().click({ timeout: 5000 });
      this.updateMemory('click', target);
      return { success: true, method: 'partial-text' };
    }
    
    // Strategy 4: testId patterns
    const testIdPatterns = [
      target.toLowerCase().replace(/\s+/g, '-'),
      `trigger-${target.toLowerCase().replace(/\s+/g, '-')}`
    ];
    
    for (const testId of testIdPatterns) {
      locator = this.page.locator(`[data-testid*="${testId}"]`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        this.updateMemory('click', target);
        return { success: true, method: 'testid' };
      }
    }
    
    // Strategy 8: Handle dropdown option selection
    if (targetLower.includes('option') || targetLower.includes('shipping')) {
      const optionText = target.replace(/option/i, '').trim();
      
      // Click in Radix dropdown content
      locator = this.page.locator(`[data-radix-select-content] [role="option"]:has-text("${optionText}")`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'radix-option' };
      }
      
      // Try regular select option
      locator = this.page.locator(`[role="option"]:has-text("${optionText}")`);
      if (await locator.count() > 0) {
        await locator.first().click({ timeout: 5000 });
        return { success: true, method: 'option' };
      }
    }
    
    // Strategy 9: CSS selector patterns
    const cssPatterns = [
      `button:has-text("${target}")`,
      `a:has-text("${target}")`,
      `[aria-label*="${target}" i]`,
      `[title*="${target}" i]`
    ];
    
    for (const css of cssPatterns) {
      try {
        locator = this.page.locator(css);
        if (await locator.count() > 0) {
          await locator.first().click({ timeout: 5000 });
          this.updateMemory('click', target);
          return { success: true, method: 'css' };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: `Could not find element: "${target}"` };
  }
  
  async smartFill(target, value) {
    const locators = [
      this.page.getByLabel(target, { exact: false }),
      this.page.getByPlaceholder(target, { exact: false }),
      this.page.getByRole('textbox', { name: target }),
      this.page.locator(`input[name*="${target}" i]`),
      this.page.locator(`[data-testid*="${target.toLowerCase().replace(/\s+/g, '-')}"]`)
    ];
    
    for (const locator of locators) {
      try {
        if (await locator.count() > 0) {
          await locator.first().fill(value);
          this.memory.filledFields[target] = value;
          return { success: true };
        }
      } catch (e) {
        continue;
      }
    }
    
    return { success: false, error: `Could not find field: "${target}"` };
  }
  
  async smartSelect(target, value) {
    // First click to open dropdown
    const openResult = await this.smartClick(target);
    if (!openResult.success) return openResult;
    
    await this.page.waitForTimeout(300); // Wait for dropdown to open
    
    // Then click the option
    return await this.smartClick(value);
  }
  
  async smartVerify(target) {
    // For now, just check if element exists
    const locator = this.page.getByText(target, { exact: false });
    const exists = await locator.count() > 0;
    return { success: exists, verified: exists };
  }
  
  updateMemory(action, target) {
    this.memory.clickedElements.push(target);
    
    const targetLower = target.toLowerCase();
    if (targetLower.includes('products')) {
      this.memory.visitedPages.push('products');
    } else if (targetLower.includes('cart')) {
      this.memory.visitedPages.push('cart');
    }
  }
  
  // ==========================================================================
  // MAIN EXECUTION - V3 FLOW
  // ==========================================================================
  
  async executeGoal(goal, startUrl = null) {
    console.log('[AIGoalAgent] executeGoal called with:', goal);
    console.log('[AIGoalAgent] startUrl:', startUrl);
    console.log('[AIGoalAgent] page valid:', !!this.page, this.page ? 'url:' + this.page.url() : 'no page');
    
    this.goal = goal;
    this.stepsTaken = [];
    this.currentStep = 0;
    this.goalAchieved = false;
    this.shouldStop = false;
    this.memory = {
      visitedPages: [],
      addedToCart: [],
      removedFromCart: [],
      filledFields: {},
      clickedElements: [],
      currentPage: '',
      cartCount: 0,
      lastError: null
    };
    
    this.log('='.repeat(60));
    this.log('GOAL:', goal);
    this.log('V3 AGENTIC MODE - Smart Planning + Fast Execution');
    this.log('='.repeat(60));
    
    try {
      // Verify page is valid
      if (!this.page) {
        throw new Error('No page available - browser not connected');
      }
      
      // Step 1: Navigate to start URL
      if (startUrl) {
        console.log('[AIGoalAgent] Navigating to:', startUrl);
        await this.page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.page.waitForTimeout(1000);
        console.log('[AIGoalAgent] Navigation complete');
        
        this.stepsTaken.push({
          action: 'navigate', target: startUrl, description: `Navigate to ${startUrl}`,
          qword: 'GoTo', args: [startUrl], success: true
        });
        
        this.onStep({ step: 1, action: { action: 'navigate', target: startUrl }, result: { success: true }, totalSteps: 1 });
      }
      
      // Step 2: Deep analyze the page
      this.log('\n📊 PHASE 1: Deep Page Analysis...');
      console.log('[AIGoalAgent] Starting deep page analysis...');
      let pageAnalysis = await this.analyzePageDeep();
      console.log('[AIGoalAgent] Page analysis complete, products:', pageAnalysis?.products?.length || 0);
      
      // Step 3: Create action plan (ONE API call)
      this.log('\n🧠 PHASE 2: Creating Smart Action Plan...');
      console.log('[AIGoalAgent] Creating action plan via API...');
      this.actionPlan = await this.createActionPlan(pageAnalysis);
      console.log('[AIGoalAgent] Action plan created, steps:', this.actionPlan?.length || 0);
      
      this.log('\n📋 ACTION PLAN:');
      this.actionPlan.forEach((a, i) => this.log(`  ${i + 1}. ${a.action}: ${a.target}`));
      
      if (!this.actionPlan || this.actionPlan.length === 0) {
        console.log('[AIGoalAgent] WARNING: Empty action plan!');
        throw new Error('AI returned empty action plan');
      }
      
      // Step 4: Execute plan (NO API calls, fast local execution)
      this.log('\n🚀 PHASE 3: Executing Plan...');
      
      for (let i = 0; i < this.actionPlan.length && !this.shouldStop; i++) {
        const action = this.actionPlan[i];
        this.currentStep++;
        
        this.log(`\n--- Step ${this.currentStep}/${this.actionPlan.length}: ${action.action} "${action.target}" ---`);
        
        const result = await this.executeSmartAction(action);
        
        // Record the step
        this.stepsTaken.push({
          step: this.currentStep,
          action: action.action,
          target: action.target,
          description: `${action.action} "${action.target}"`,
          success: result.success,
          qword: this.actionToQWord(action.action),
          args: [action.target]
        });
        
        this.onStep({
          step: this.currentStep,
          action: { action: action.action, target: action.target, description: `${action.action} "${action.target}"` },
          result,
          totalSteps: this.stepsTaken.length
        });
        
        // Wait for page to stabilize (shorter wait for speed)
        await this.page.waitForTimeout(500);
        
        // If action failed, try to recover
        if (!result.success) {
          this.log(`⚠️ Action failed: ${result.error}`);
          // Re-analyze page and potentially adjust remaining plan
          pageAnalysis = await this.analyzePageDeep();
        }
      }
      
      // Check if goal achieved based on memory
      this.goalAchieved = this.evaluateGoalCompletion();
      
      if (this.goalAchieved) {
        this.log('\n🎉 GOAL ACHIEVED!');
        if (this.onGoalAchieved) this.onGoalAchieved();
      }
      
      return {
        success: this.goalAchieved,
        goal: this.goal,
        steps: this.stepsTaken,
        testCase: this.generateTestCase(),
        totalSteps: this.currentStep,
        memory: this.memory,
        reason: this.goalAchieved ? 'Goal achieved' : 'Plan executed'
      };
      
    } catch (error) {
      this.log('Execution error:', error);
      this.onError({ error: error.message });
      return {
        success: false,
        goal: this.goal,
        steps: this.stepsTaken,
        error: error.message
      };
    }
  }
  
  evaluateGoalCompletion() {
    const goalLower = this.goal.toLowerCase();
    
    // Check if "all products" were added
    if (goalLower.includes('all products') && this.memory.addedToCart.length < 3) {
      return false;
    }
    
    // Check if specific items were removed
    if (goalLower.includes('remove') && this.memory.removedFromCart.length === 0) {
      return false;
    }
    
    // If most actions succeeded, consider it successful
    const successRate = this.stepsTaken.filter(s => s.success).length / this.stepsTaken.length;
    return successRate > 0.7;
  }
  
  // ==========================================================================
  // TEST CASE GENERATION
  // ==========================================================================
  
  actionToQWord(action) {
    const map = {
      'click': 'ClickText',
      'fill': 'Fill',
      'select': 'Select',
      'check': 'Check',
      'hover': 'Hover',
      'navigate': 'GoTo',
      'wait': 'Wait',
      'verify': 'Assert'
    };
    return map[action] || 'ClickText';
  }
  
  generateTestCase() {
    return {
      id: `goal_test_${Date.now()}`,
      name: `Test: ${this.goal.substring(0, 50)}`,
      description: this.goal,
      steps: this.stepsTaken.filter(s => s.success).map(s => ({
        qword: s.qword,
        args: s.args || [s.target],
        description: s.description
      })),
      generated: true,
      generatedAt: new Date().toISOString(),
      source: 'ai-goal-agent-v3',
      goalAchieved: this.goalAchieved
    };
  }
}

module.exports = { AIGoalAgent };
