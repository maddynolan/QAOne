/**
 * Debug Collector - Captures failure state for troubleshooting
 * 
 * When a step fails, this module collects:
 * 1. What strategies were attempted
 * 2. Why each strategy failed
 * 3. Similar elements that exist on the page
 * 4. Screenshot at failure point
 * 5. Page state information
 * 
 * @author Flowstral
 * @version 1.0.0
 */

/**
 * Debug Collector class
 */
class DebugCollector {
  constructor(page) {
    this.page = page;
    this.lastFailureDebug = null;
  }

  /**
   * Capture full failure state when a step fails
   * 
   * @param {Object} action - The action that failed
   * @param {Array} strategiesAttempted - List of strategies that were tried
   * @param {string} error - The error message
   */
  async captureFailureState(action, strategiesAttempted = [], error = '') {
    if (!this.page || this.page.isClosed()) {
      return { success: false, error: 'No browser page' };
    }

    try {
      const debug = {
        timestamp: new Date().toISOString(),
        action: {
          type: action.type || action.qword,
          text: action.text || action.label || action.description,
          selector: action.selector || action.selectorObj?.selector,
          recipe: action.recipe
        },
        error: error,
        strategiesAttempted: strategiesAttempted,
        pageState: await this._capturePageState(),
        similarElements: await this._findSimilarElements(action),
        screenshot: await this._captureScreenshot()
      };

      this.lastFailureDebug = debug;
      return { success: true, debug };
    } catch (e) {
      console.error('[DebugCollector] Failed to capture state:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Capture current page state
   */
  async _capturePageState() {
    try {
      const state = await this.page.evaluate(() => {
        // Count interactive elements
        const buttons = document.querySelectorAll('button, [role="button"], input[type="button"], input[type="submit"]');
        const links = document.querySelectorAll('a[href]');
        const inputs = document.querySelectorAll('input, textarea, select');
        const forms = document.querySelectorAll('form');

        // Check for common states
        const hasLoader = !!document.querySelector('.loading, .spinner, [class*="loader"], [aria-busy="true"]');
        const hasModal = !!document.querySelector('[role="dialog"], .modal, [class*="modal"]');
        const hasError = !!document.querySelector('.error, [class*="error"], [role="alert"]');

        return {
          url: window.location.href,
          title: document.title,
          loadState: document.readyState,
          elementCounts: {
            buttons: buttons.length,
            links: links.length,
            inputs: inputs.length,
            forms: forms.length
          },
          pageConditions: {
            hasLoader,
            hasModal,
            hasError,
            scrollY: window.scrollY,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight
          }
        };
      });

      return state;
    } catch (e) {
      return { error: e.message };
    }
  }

  /**
   * Find elements similar to what we were looking for
   */
  async _findSimilarElements(action) {
    try {
      const searchText = action.text || action.label || action.description || '';
      const searchRole = action.role || action.recipe?.what?.role || '';

      const similar = await this.page.evaluate(({ searchText, searchRole }) => {
        const results = [];
        const normalizedSearch = searchText.toLowerCase().trim();

        // Helper to get element summary
        const getElementSummary = (el) => ({
          tag: el.tagName.toLowerCase(),
          text: el.innerText?.trim().substring(0, 80) || '',
          id: el.id || null,
          className: (el.className || '').toString().substring(0, 100),
          role: el.getAttribute('role'),
          ariaLabel: el.getAttribute('aria-label'),
          selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase()),
          isVisible: el.offsetParent !== null
        });

        // 1. Find elements with similar text
        if (normalizedSearch) {
          const allElements = document.body.querySelectorAll('*');
          for (const el of allElements) {
            const elText = (el.innerText || '').toLowerCase().trim();
            if (elText && elText.includes(normalizedSearch.substring(0, 10))) {
              if (results.length < 5) {
                results.push({
                  reason: 'Similar text',
                  ...getElementSummary(el)
                });
              }
            }
          }
        }

        // 2. Find elements with same role
        if (searchRole) {
          const roleElements = document.querySelectorAll(`[role="${searchRole}"], ${searchRole}`);
          for (const el of roleElements) {
            if (results.length < 8 && !results.find(r => r.text === el.innerText?.trim())) {
              results.push({
                reason: `Same role (${searchRole})`,
                ...getElementSummary(el)
              });
            }
          }
        }

        // 3. Find all buttons if looking for clickable
        if (!searchRole || searchRole === 'button' || searchRole === 'link') {
          const clickables = document.querySelectorAll('button, a, [role="button"], [role="link"]');
          for (const el of clickables) {
            if (results.length < 10 && el.innerText?.trim() && !results.find(r => r.text === el.innerText?.trim())) {
              results.push({
                reason: 'Clickable element',
                ...getElementSummary(el)
              });
            }
          }
        }

        return results.slice(0, 10);
      }, { searchText, searchRole });

      return similar;
    } catch (e) {
      return [];
    }
  }

  /**
   * Capture screenshot at failure point
   */
  async _captureScreenshot() {
    try {
      const buffer = await this.page.screenshot({ 
        type: 'png',
        fullPage: false // Just viewport
      });
      return `data:image/png;base64,${buffer.toString('base64')}`;
    } catch (e) {
      return null;
    }
  }

  /**
   * Get the last failure debug info
   */
  getLastFailureDebug() {
    return this.lastFailureDebug;
  }

  /**
   * Format debug info for display
   */
  formatDebugForDisplay(debug) {
    if (!debug) return null;

    const formatted = {
      summary: `Step failed: ${debug.action.type} "${debug.action.text || 'element'}"`,
      error: debug.error,
      
      strategiesSummary: debug.strategiesAttempted.map(s => ({
        strategy: s.name || s.type,
        selector: s.selector?.substring(0, 60),
        result: s.found ? '✅ Found' : `❌ ${s.error || 'Not found'}`,
        matchCount: s.count || 0
      })),

      pageSummary: debug.pageState ? {
        url: debug.pageState.url,
        title: debug.pageState.title,
        loadState: debug.pageState.loadState,
        buttons: debug.pageState.elementCounts?.buttons,
        hasLoader: debug.pageState.pageConditions?.hasLoader,
        hasModal: debug.pageState.pageConditions?.hasModal
      } : null,

      similarElements: debug.similarElements?.map(el => ({
        text: el.text?.substring(0, 40),
        reason: el.reason,
        selector: el.selector,
        visible: el.isVisible
      })),

      screenshot: debug.screenshot
    };

    return formatted;
  }

  /**
   * Analyze why element finding failed and suggest fixes
   */
  async analyzeFaillureAndSuggest(action, strategiesAttempted) {
    const suggestions = [];

    // Check if page is still loading
    const loadState = await this.page.evaluate(() => document.readyState);
    if (loadState !== 'complete') {
      suggestions.push({
        type: 'wait',
        title: 'Page still loading',
        description: 'The page may not have fully loaded. Try adding a wait step.',
        fix: { type: 'AddWait', duration: 2000 }
      });
    }

    // Check if element exists but is hidden
    const searchText = action.text || action.label;
    if (searchText) {
      const hiddenCheck = await this.page.evaluate((text) => {
        const els = Array.from(document.body.querySelectorAll('*')).filter(el => 
          el.innerText?.includes(text)
        );
        return els.map(el => ({
          text: el.innerText?.substring(0, 50),
          display: window.getComputedStyle(el).display,
          visibility: window.getComputedStyle(el).visibility,
          hasOffset: el.offsetParent !== null
        }));
      }, searchText);

      const hiddenElement = hiddenCheck.find(el => 
        el.display === 'none' || el.visibility === 'hidden' || !el.hasOffset
      );

      if (hiddenElement) {
        suggestions.push({
          type: 'hidden',
          title: 'Element exists but is hidden',
          description: `Found "${hiddenElement.text}" but it's not visible. You may need to scroll or expand a section first.`,
          fix: { type: 'ScrollToElement' }
        });
      }
    }

    // Check if text is slightly different
    if (searchText) {
      const fuzzyMatches = await this.page.evaluate((text) => {
        const normalized = text.toLowerCase().replace(/['']/g, "'").trim();
        const results = [];
        
        document.querySelectorAll('button, a, [role="button"], [role="link"]').forEach(el => {
          const elText = (el.innerText || '').toLowerCase().trim();
          // Simple fuzzy: starts with same chars
          if (elText && elText.substring(0, 5) === normalized.substring(0, 5) && elText !== normalized) {
            results.push({
              actual: el.innerText.trim(),
              expected: text
            });
          }
        });
        
        return results.slice(0, 3);
      }, searchText);

      if (fuzzyMatches.length > 0) {
        suggestions.push({
          type: 'text-mismatch',
          title: 'Similar text found',
          description: `Looking for "${searchText}" but found "${fuzzyMatches[0].actual}". The text might have changed.`,
          fix: { type: 'UpdateText', newText: fuzzyMatches[0].actual }
        });
      }
    }

    // Check if in iframe
    const iframeCheck = await this.page.evaluate((text) => {
      const iframes = document.querySelectorAll('iframe');
      return { iframeCount: iframes.length };
    }, searchText);

    if (iframeCheck.iframeCount > 0) {
      suggestions.push({
        type: 'iframe',
        title: 'Page has iframes',
        description: `Found ${iframeCheck.iframeCount} iframe(s). The element might be inside an iframe.`,
        fix: { type: 'SearchIframes' }
      });
    }

    // Default: use element picker
    suggestions.push({
      type: 'picker',
      title: 'Use Element Picker',
      description: 'Click on the element directly to capture its selector.',
      fix: { type: 'StartPicker' }
    });

    return suggestions;
  }
}

module.exports = { DebugCollector };
