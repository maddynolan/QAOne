/**
 * PAGE ANALYZER PROTOTYPE
 * 
 * Run this in your browser console on any page to see:
 * 1. What elements are captured
 * 2. How fast the analysis runs
 * 3. Generated Playwright test script
 * 
 * Usage: Copy and paste into browser console, then call:
 *   analyzePageAndGenerateTest()
 */

(function() {
  'use strict';

  // ============================================================================
  // PAGE ANALYZER - Captures everything on the page
  // ============================================================================

  class PageAnalyzer {
    constructor() {
      this.timing = {};
      this.results = {};
    }

    /**
     * Main analysis function - captures everything
     */
    analyze() {
      const totalStart = performance.now();
      
      // 1. Page metadata
      this.timing.metadataStart = performance.now();
      this.results.metadata = this.getPageMetadata();
      this.timing.metadata = performance.now() - this.timing.metadataStart;

      // 2. Classify page type
      this.timing.classifyStart = performance.now();
      this.results.pageType = this.classifyPageType();
      this.timing.classify = performance.now() - this.timing.classifyStart;

      // 3. Capture all text blocks (for assertions)
      this.timing.textStart = performance.now();
      this.results.textBlocks = this.captureTextBlocks();
      this.timing.text = performance.now() - this.timing.textStart;

      // 4. Capture all buttons
      this.timing.buttonsStart = performance.now();
      this.results.buttons = this.captureButtons();
      this.timing.buttons = performance.now() - this.timing.buttonsStart;

      // 5. Capture all links
      this.timing.linksStart = performance.now();
      this.results.links = this.captureLinks();
      this.timing.links = performance.now() - this.timing.linksStart;

      // 6. Capture all form fields
      this.timing.formsStart = performance.now();
      this.results.formFields = this.captureFormFields();
      this.timing.forms = performance.now() - this.timing.formsStart;

      // 7. Capture all images
      this.timing.imagesStart = performance.now();
      this.results.images = this.captureImages();
      this.timing.images = performance.now() - this.timing.imagesStart;

      // Total time
      this.timing.total = performance.now() - totalStart;

      return this.results;
    }

    getPageMetadata() {
      return {
        url: window.location.href,
        title: document.title,
        domain: window.location.hostname,
        path: window.location.pathname,
      };
    }

    classifyPageType() {
      const url = window.location.pathname.toLowerCase();
      const pageText = (document.body?.innerText || '').toLowerCase();
      const hasForm = !!document.querySelector('form');
      const hasTable = !!document.querySelector('table, [role="grid"], [role="table"]');
      const hasLogin = /login|sign.?in|username|password/.test(pageText);
      const hasSearch = !!document.querySelector('[type="search"], [role="searchbox"], input[placeholder*="search" i]');
      
      // URL-based classification
      if (/login|signin|auth/.test(url)) return 'login';
      if (/dashboard|home|overview/.test(url)) return 'dashboard';
      if (/settings|preferences|config/.test(url)) return 'settings';
      if (/search|find|results/.test(url)) return 'search-results';
      if (/new|create|add/.test(url) && hasForm) return 'create-form';
      if (/edit|update|modify/.test(url) && hasForm) return 'edit-form';
      if (/details|view|show/.test(url)) return 'detail';
      if (/list|index|all/.test(url) && hasTable) return 'list';
      
      // Content-based classification
      if (hasLogin) return 'login';
      if (hasForm && !hasTable) return 'form';
      if (hasTable) return 'list';
      if (hasSearch) return 'search';
      
      return 'landing-page';
    }

    captureTextBlocks() {
      const textBlocks = [];
      const seen = new Set();
      
      // Headings
      document.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(el => {
        const text = (el.textContent || '').trim();
        if (text && text.length > 2 && text.length < 200 && !seen.has(text)) {
          seen.add(text);
          textBlocks.push({
            type: 'heading',
            tag: el.tagName.toLowerCase(),
            text: text,
            selector: this.generateSelector(el),
          });
        }
      });

      // Paragraphs with meaningful content
      document.querySelectorAll('p').forEach(el => {
        const text = (el.textContent || '').trim();
        if (text && text.length > 10 && text.length < 300 && !seen.has(text.substring(0, 50))) {
          seen.add(text.substring(0, 50));
          textBlocks.push({
            type: 'paragraph',
            text: text.substring(0, 150) + (text.length > 150 ? '...' : ''),
            selector: this.generateSelector(el),
          });
        }
      });

      // Labels and important text
      document.querySelectorAll('label, [role="heading"], .title, .heading').forEach(el => {
        const text = (el.textContent || '').trim();
        if (text && text.length > 2 && text.length < 100 && !seen.has(text)) {
          seen.add(text);
          textBlocks.push({
            type: 'label',
            text: text,
            selector: this.generateSelector(el),
          });
        }
      });

      return textBlocks.slice(0, 50); // Limit for performance
    }

    captureButtons() {
      const buttons = [];
      const selectors = [
        'button',
        '[role="button"]',
        'input[type="submit"]',
        'input[type="button"]',
        'a.btn',
        'a.button',
        '[class*="btn"]',
      ];

      document.querySelectorAll(selectors.join(',')).forEach(el => {
        if (!this.isVisible(el)) return;
        
        const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').trim();
        if (!text || text.length > 50) return;

        buttons.push({
          text: text,
          tag: el.tagName.toLowerCase(),
          type: el.type || null,
          disabled: el.disabled || false,
          selector: this.generateSelector(el),
          playwrightSelector: this.generatePlaywrightSelector(el, 'button'),
        });
      });

      return buttons;
    }

    captureLinks() {
      const links = [];

      document.querySelectorAll('a[href]').forEach(el => {
        if (!this.isVisible(el)) return;
        
        const text = (el.textContent || el.getAttribute('aria-label') || '').trim();
        const href = el.getAttribute('href');
        
        if (!text || text.length > 100) return;
        if (href?.startsWith('#') || href?.startsWith('javascript:')) return;

        links.push({
          text: text,
          href: href,
          isExternal: href?.startsWith('http') && !href.includes(window.location.hostname),
          selector: this.generateSelector(el),
          playwrightSelector: this.generatePlaywrightSelector(el, 'link'),
        });
      });

      return links.slice(0, 50); // Limit for performance
    }

    captureFormFields() {
      const fields = [];

      document.querySelectorAll('input, select, textarea').forEach(el => {
        if (!this.isVisible(el)) return;
        if (el.type === 'hidden') return;

        const label = this.getFieldLabel(el);
        
        fields.push({
          type: el.type || el.tagName.toLowerCase(),
          name: el.name || null,
          label: label,
          placeholder: el.placeholder || null,
          required: el.required || false,
          value: el.value?.substring(0, 50) || null,
          selector: this.generateSelector(el),
          playwrightSelector: this.generatePlaywrightSelector(el, 'input'),
        });
      });

      return fields;
    }

    captureImages() {
      const images = [];

      document.querySelectorAll('img').forEach(el => {
        if (!this.isVisible(el)) return;

        images.push({
          alt: el.alt || null,
          src: el.src?.substring(0, 100) || null,
          hasAlt: !!el.alt,
          width: el.width,
          height: el.height,
        });
      });

      return images;
    }

    // ========== SELECTOR GENERATION ==========

    generateSelector(el) {
      // Priority order: data-testid > id > aria-label > role+name > CSS
      
      // 1. data-testid
      const testId = el.getAttribute('data-testid') || el.getAttribute('data-test-id');
      if (testId) return `[data-testid="${testId}"]`;

      // 2. ID (if not dynamic)
      if (el.id && !this.isDynamicId(el.id)) {
        return `#${el.id}`;
      }

      // 3. aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.length < 50) {
        return `[aria-label="${ariaLabel}"]`;
      }

      // 4. name attribute
      const name = el.getAttribute('name');
      if (name && !this.isDynamicId(name)) {
        return `[name="${name}"]`;
      }

      // 5. CSS path (simple)
      const tag = el.tagName.toLowerCase();
      const text = (el.textContent || '').trim().substring(0, 30);
      if (text) {
        return `${tag}:has-text("${text}")`;
      }

      return tag;
    }

    generatePlaywrightSelector(el, type) {
      const text = (el.textContent || el.value || '').trim();
      const ariaLabel = el.getAttribute('aria-label');
      const placeholder = el.getAttribute('placeholder');
      const name = el.getAttribute('name');
      const testId = el.getAttribute('data-testid');

      // Priority: testId > role+name > label > placeholder > name

      if (testId) {
        return `getByTestId('${testId}')`;
      }

      if (type === 'button' && text && text.length < 50) {
        return `getByRole('button', { name: '${this.escapeQuotes(text)}' })`;
      }

      if (type === 'link' && text && text.length < 50) {
        return `getByRole('link', { name: '${this.escapeQuotes(text)}' })`;
      }

      if (ariaLabel) {
        return `getByLabel('${this.escapeQuotes(ariaLabel)}')`;
      }

      if (placeholder) {
        return `getByPlaceholder('${this.escapeQuotes(placeholder)}')`;
      }

      if (name) {
        return `locator('[name="${name}"]')`;
      }

      return `locator('${this.generateSelector(el)}')`;
    }

    isDynamicId(id) {
      if (!id) return true;
      // Common dynamic ID patterns
      return /^[a-f0-9]{8,}$/i.test(id) || 
             /^\d{6,}$/.test(id) || 
             /^:r[0-9a-z]+:$/i.test(id) ||
             /^ember\d+$/.test(id) ||
             /^react-/.test(id) ||
             /^vue-/.test(id);
    }

    getFieldLabel(el) {
      // Check aria-label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel;

      // Check for associated label
      const id = el.id;
      if (id) {
        const label = document.querySelector(`label[for="${id}"]`);
        if (label) return (label.textContent || '').trim();
      }

      // Check for parent label
      const parentLabel = el.closest('label');
      if (parentLabel) {
        return (parentLabel.textContent || '').replace(el.value || '', '').trim();
      }

      // Fallback to placeholder or name
      return el.placeholder || el.name || null;
    }

    isVisible(el) {
      if (!el) return false;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }

    escapeQuotes(str) {
      return (str || '').replace(/'/g, "\\'");
    }
  }

  // ============================================================================
  // SCRIPT GENERATOR - Creates Playwright test from analysis
  // ============================================================================

  class ScriptGenerator {
    constructor(analysis) {
      this.analysis = analysis;
    }

    generate() {
      const startTime = performance.now();
      
      let script = this.generateHeader();
      script += this.generateTextAssertions();
      script += this.generateButtonAssertions();
      script += this.generateLinkAssertions();
      script += this.generateFormAssertions();
      script += this.generateImageAssertions();
      script += this.generateFooter();

      const generationTime = performance.now() - startTime;

      return { script, generationTime };
    }

    generateHeader() {
      const { metadata, pageType } = this.analysis;
      return `"""
Auto-generated Page Validation Test
URL: ${metadata.url}
Page Type: ${pageType}
Generated: ${new Date().toISOString()}
"""
from playwright.sync_api import Page, expect


def test_page_validation(page: Page):
    # Navigate to page
    page.goto("${metadata.url}")
    page.wait_for_load_state("networkidle")

    # ==================== PAGE TITLE ====================
    expect(page).to_have_title("${metadata.title.replace(/"/g, '\\"')}")

`;
    }

    generateTextAssertions() {
      const { textBlocks } = this.analysis;
      if (textBlocks.length === 0) return '';

      let code = `    # ==================== TEXT ASSERTIONS ====================\n`;
      
      // Group by type
      const headings = textBlocks.filter(t => t.type === 'heading');
      const others = textBlocks.filter(t => t.type !== 'heading');

      // Add heading assertions
      headings.slice(0, 10).forEach(heading => {
        const escapedText = heading.text.replace(/"/g, '\\"').substring(0, 80);
        code += `    expect(page.get_by_role("heading", name="${escapedText}")).to_be_visible()\n`;
      });

      // Add other text assertions
      others.slice(0, 5).forEach(text => {
        const escapedText = text.text.replace(/"/g, '\\"').substring(0, 80);
        code += `    expect(page.get_by_text("${escapedText}")).to_be_visible()\n`;
      });

      return code + '\n';
    }

    generateButtonAssertions() {
      const { buttons } = this.analysis;
      if (buttons.length === 0) return '';

      let code = `    # ==================== BUTTON ASSERTIONS ====================\n`;
      
      buttons.slice(0, 15).forEach(btn => {
        const escapedText = btn.text.replace(/"/g, '\\"');
        code += `    expect(page.${btn.playwrightSelector.replace(/'/g, '"')}).to_be_visible()\n`;
        if (!btn.disabled) {
          code += `    expect(page.${btn.playwrightSelector.replace(/'/g, '"')}).to_be_enabled()\n`;
        }
      });

      return code + '\n';
    }

    generateLinkAssertions() {
      const { links } = this.analysis;
      if (links.length === 0) return '';

      let code = `    # ==================== LINK ASSERTIONS ====================\n`;
      
      links.slice(0, 10).forEach(link => {
        code += `    expect(page.${link.playwrightSelector.replace(/'/g, '"')}).to_be_visible()\n`;
      });

      return code + '\n';
    }

    generateFormAssertions() {
      const { formFields } = this.analysis;
      if (formFields.length === 0) return '';

      let code = `    # ==================== FORM FIELD ASSERTIONS ====================\n`;
      
      formFields.slice(0, 10).forEach(field => {
        code += `    expect(page.${field.playwrightSelector.replace(/'/g, '"')}).to_be_visible()\n`;
        if (field.required) {
          code += `    # Required field: ${field.label || field.name || 'unknown'}\n`;
        }
      });

      return code + '\n';
    }

    generateImageAssertions() {
      const { images } = this.analysis;
      if (images.length === 0) return '';

      const withAlt = images.filter(img => img.hasAlt).length;
      const withoutAlt = images.length - withAlt;

      let code = `    # ==================== IMAGE ASSERTIONS ====================\n`;
      code += `    # Found ${images.length} images (${withAlt} with alt text, ${withoutAlt} without)\n`;
      code += `    expect(page.locator("img")).to_have_count(${images.length})\n`;

      return code + '\n';
    }

    generateFooter() {
      return `    print("✅ All page validations passed!")
`;
    }
  }

  // ============================================================================
  // MAIN FUNCTION - Run analysis and show results
  // ============================================================================

  window.analyzePageAndGenerateTest = function() {
    console.clear();
    console.log('%c🔍 PAGE ANALYZER STARTING...', 'font-size: 20px; font-weight: bold; color: #667eea;');
    console.log('');

    // Run analysis
    const analyzer = new PageAnalyzer();
    const analysis = analyzer.analyze();
    const timing = analyzer.timing;

    // Generate script
    const generator = new ScriptGenerator(analysis);
    const { script, generationTime } = generator.generate();

    // ==================== DISPLAY RESULTS ====================

    console.log('%c📊 ANALYSIS RESULTS', 'font-size: 16px; font-weight: bold; color: #22c55e;');
    console.log('');

    // Page info
    console.log('%cPage Information:', 'font-weight: bold;');
    console.log(`  URL: ${analysis.metadata.url}`);
    console.log(`  Title: ${analysis.metadata.title}`);
    console.log(`  Page Type: ${analysis.pageType}`);
    console.log('');

    // Element counts
    console.log('%cElements Captured:', 'font-weight: bold;');
    console.log(`  📝 Text blocks: ${analysis.textBlocks.length}`);
    console.log(`  🔘 Buttons: ${analysis.buttons.length}`);
    console.log(`  🔗 Links: ${analysis.links.length}`);
    console.log(`  📋 Form fields: ${analysis.formFields.length}`);
    console.log(`  🖼️ Images: ${analysis.images.length}`);
    console.log('');

    // Timing breakdown
    console.log('%c⏱️ TIMING BREAKDOWN', 'font-size: 16px; font-weight: bold; color: #f59e0b;');
    console.log(`  Page metadata:    ${timing.metadata.toFixed(2)}ms`);
    console.log(`  Page classify:    ${timing.classify.toFixed(2)}ms`);
    console.log(`  Text capture:     ${timing.text.toFixed(2)}ms`);
    console.log(`  Button capture:   ${timing.buttons.toFixed(2)}ms`);
    console.log(`  Link capture:     ${timing.links.toFixed(2)}ms`);
    console.log(`  Form capture:     ${timing.forms.toFixed(2)}ms`);
    console.log(`  Image capture:    ${timing.images.toFixed(2)}ms`);
    console.log('  ─────────────────────────────');
    console.log(`  Analysis Total:   ${timing.total.toFixed(2)}ms`);
    console.log(`  Script Generation: ${generationTime.toFixed(2)}ms`);
    console.log('  ─────────────────────────────');
    console.log(`  %cGRAND TOTAL:       ${(timing.total + generationTime).toFixed(2)}ms`, 'font-weight: bold; color: #22c55e;');
    console.log('');

    // Show captured elements
    console.log('%c📋 CAPTURED ELEMENTS (first 5 of each)', 'font-size: 16px; font-weight: bold; color: #8b5cf6;');
    console.log('');
    
    console.log('HEADINGS:');
    console.table(analysis.textBlocks.filter(t => t.type === 'heading').slice(0, 5).map(t => ({ text: t.text, selector: t.selector })));
    
    console.log('BUTTONS:');
    console.table(analysis.buttons.slice(0, 5).map(b => ({ text: b.text, playwright: b.playwrightSelector })));
    
    console.log('LINKS:');
    console.table(analysis.links.slice(0, 5).map(l => ({ text: l.text, href: l.href?.substring(0, 40) })));
    
    console.log('FORM FIELDS:');
    console.table(analysis.formFields.slice(0, 5).map(f => ({ type: f.type, label: f.label, playwright: f.playwrightSelector })));

    // Show generated script
    console.log('');
    console.log('%c📜 GENERATED PLAYWRIGHT SCRIPT', 'font-size: 16px; font-weight: bold; color: #ec4899;');
    console.log('%c(Copy this to use)', 'color: #888;');
    console.log('');
    console.log(script);

    // Summary box
    console.log('');
    console.log('%c' + '═'.repeat(60), 'color: #667eea;');
    console.log('%c  SUMMARY', 'font-size: 14px; font-weight: bold; color: #667eea;');
    console.log('%c' + '═'.repeat(60), 'color: #667eea;');
    console.log(`%c  Total elements found: ${analysis.textBlocks.length + analysis.buttons.length + analysis.links.length + analysis.formFields.length + analysis.images.length}`, 'font-weight: bold;');
    console.log(`%c  Total analysis time: ${(timing.total + generationTime).toFixed(2)}ms`, 'font-weight: bold; color: #22c55e;');
    console.log('%c' + '═'.repeat(60), 'color: #667eea;');

    // Return data for programmatic access
    return {
      analysis,
      timing,
      script,
      generationTime,
    };
  };

  // Auto-run hint
  console.log('%c✨ Page Analyzer Ready!', 'font-size: 16px; font-weight: bold; color: #667eea;');
  console.log('%cRun: analyzePageAndGenerateTest()', 'font-size: 14px; color: #888;');
  console.log('');

})();















