/**
 * Frontend Application Detection
 * Detects application type from URL and DOM patterns
 */

export type ApplicationType = 'salesforce' | 'react' | 'angular' | 'vue' | 'generic' | 'unknown';

export interface SelectorRecommendation {
  selector: string;
  type: 'attribute' | 'semantic' | 'css' | 'id';
  priority: number;
  reason: string;
}

export class ApplicationDetector {
  // Salesforce detection patterns
  private static SALESFORCE_INDICATORS = [
    /lwc-\w+/,  // LWC dynamic classes
    /slds-/,  // Salesforce Lightning Design System
    /data-menubar-item/,
    /data-menulist-item/,
    /commerce-drilldown-navigation/,
    /var\(--lwc-/,  // Salesforce CSS variables
    /var\(--dxp-/,  // Salesforce Experience Cloud variables
    /\/s\//,  // Salesforce Experience Cloud URL pattern
  ];

  // React detection patterns
  private static REACT_INDICATORS = [
    /data-reactroot/,
    /__reactInternalInstance/,
    /react-/,
  ];

  // Angular detection patterns
  private static ANGULAR_INDICATORS = [
    /ng-/,
    /_ngcontent-/,
    /\[ng-reflect-/,
  ];

  // Vue detection patterns
  private static VUE_INDICATORS = [
    /data-v-/,
    /__vue__/,
  ];

  /**
   * Detect application type from URL
   */
  static detectFromUrl(url: string): ApplicationType {
    const urlLower = url.toLowerCase();
    
    // Check for Salesforce URL patterns
    if (urlLower.includes('/s/') || urlLower.includes('salesforce.com') || urlLower.includes('force.com')) {
      return 'salesforce';
    }
    
    return 'generic';
  }

  /**
   * Detect application type from HTML content
   */
  static detectFromHtml(html: string, url: string = ''): ApplicationType {
    const htmlLower = html.toLowerCase();
    const urlLower = url.toLowerCase();
    
    // Check for Salesforce
    let salesforceScore = 0;
    for (const pattern of this.SALESFORCE_INDICATORS) {
      if (pattern.test(htmlLower)) salesforceScore++;
      if (pattern.test(urlLower)) salesforceScore++;
    }
    
    if (salesforceScore >= 2) {
      return 'salesforce';
    }
    
    // Check for React
    for (const pattern of this.REACT_INDICATORS) {
      if (pattern.test(htmlLower)) return 'react';
    }
    
    // Check for Angular
    for (const pattern of this.ANGULAR_INDICATORS) {
      if (pattern.test(htmlLower)) return 'angular';
    }
    
    // Check for Vue
    for (const pattern of this.VUE_INDICATORS) {
      if (pattern.test(htmlLower)) return 'vue';
    }
    
    return 'generic';
  }

  /**
   * Analyze element and recommend selectors based on application type
   */
  static analyzeElement(
    element: {
      tagName?: string;
      attributes?: Record<string, string>;
      textContent?: string;
      className?: string;
    },
    appType: ApplicationType
  ): SelectorRecommendation[] {
    const recommendations: SelectorRecommendation[] = [];
    const tagName = (element.tagName || '').toLowerCase();
    const attributes = element.attributes || {};
    const textContent = (element.textContent || '').trim();
    const classes = (element.className || '').split(/\s+/).filter(Boolean);
    
    // Check for Salesforce LWC patterns
    const hasLwcClass = classes.some(cls => cls.startsWith('lwc-'));
    const hasSldsClass = classes.some(cls => cls.startsWith('slds-'));
    
    if (appType === 'salesforce' || hasLwcClass || hasSldsClass) {
      // Salesforce: Prioritize title, href, data-* attributes
      
      // 1. Title attribute (BEST for Salesforce)
      if (attributes.title) {
        recommendations.push({
          selector: `${tagName}[title="${attributes.title}"]`,
          type: 'attribute',
          priority: 1,
          reason: 'Title attribute is most stable in Salesforce LWC'
        });
      }
      
      // 2. Href attribute (for links)
      if (tagName === 'a' && attributes.href) {
        recommendations.push({
          selector: `a[href="${attributes.href}"]`,
          type: 'attribute',
          priority: 2,
          reason: 'Href attribute is stable in Salesforce'
        });
      }
      
      // 3. Data attributes (stable)
      const dataAttrs = Object.entries(attributes)
        .filter(([key]) => key.startsWith('data-'))
        .map(([key, value]) => ({ key, value }));
      
      if (dataAttrs.length > 0) {
        const dataSelectorParts = [tagName];
        dataAttrs.forEach(({ key, value }) => {
          if (value) {
            dataSelectorParts.push(`[${key}="${value}"]`);
          } else {
            dataSelectorParts.push(`[${key}]`);
          }
        });
        recommendations.push({
          selector: dataSelectorParts.join(''),
          type: 'attribute',
          priority: 3,
          reason: 'Data attributes are stable in Salesforce'
        });
      }
      
      // 4. Combined data attributes + href
      if (tagName === 'a' && dataAttrs.length > 0 && attributes.href) {
        const combinedParts = ['a'];
        dataAttrs.forEach(({ key, value }) => {
          if (value) {
            combinedParts.push(`[${key}="${value}"]`);
          } else {
            combinedParts.push(`[${key}]`);
          }
        });
        combinedParts.push(`[href="${attributes.href}"]`);
        recommendations.push({
          selector: combinedParts.join(''),
          type: 'attribute',
          priority: 2,
          reason: 'Combined data attributes and href (most specific)'
        });
      }
    } else {
      // Generic/Semantic selectors
      
      // 1. ID selector
      if (attributes.id && !attributes.id.includes('react') && !attributes.id.includes('angular')) {
        recommendations.push({
          selector: `#${attributes.id}`,
          type: 'id',
          priority: 1,
          reason: 'ID selector is most specific'
        });
      }
      
      // 2. Role-based (for buttons, links, etc.)
      const role = attributes.role || this.inferRole(tagName, attributes);
      if (role && textContent) {
        recommendations.push({
          selector: `page.getByRole('${role}', { name: '${textContent.substring(0, 50)}' })`,
          type: 'semantic',
          priority: 2,
          reason: 'Semantic locator with role and name'
        });
      }
      
      // 3. Label-based (for inputs)
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
        const label = attributes['aria-label'] || attributes.placeholder;
        if (label) {
          recommendations.push({
            selector: `page.getByLabel('${label}')`,
            type: 'semantic',
            priority: 2,
            reason: 'Label-based selector for form fields'
          });
        }
      }
      
      // 4. Text-based
      if (textContent && textContent.length < 100) {
        recommendations.push({
          selector: `page.getByText('${textContent}')`,
          type: 'semantic',
          priority: 3,
          reason: 'Text-based selector'
        });
      }
      
      // 5. CSS class (stable classes only)
      const stableClasses = classes.filter(cls => 
        !cls.startsWith('lwc-') && 
        !cls.startsWith('react-') && 
        !cls.startsWith('ng-') && 
        !cls.startsWith('vue-')
      );
      
      if (stableClasses.length > 0) {
        recommendations.push({
          selector: `${tagName}.${stableClasses.slice(0, 2).join('.')}`,
          type: 'css',
          priority: 4,
          reason: 'CSS class selector (stable classes only)'
        });
      }
    }
    
    // Sort by priority
    recommendations.sort((a, b) => a.priority - b.priority);
    
    return recommendations;
  }

  /**
   * Infer ARIA role from tag name and attributes
   */
  private static inferRole(tagName: string, attributes: Record<string, string>): string | null {
    // Check explicit role first
    if (attributes.role) {
      return attributes.role;
    }
    
    // Check type for inputs
    if (tagName === 'input') {
      const inputType = attributes.type || 'text';
      if (inputType === 'button' || inputType === 'submit') return 'button';
      if (inputType === 'checkbox') return 'checkbox';
      if (inputType === 'radio') return 'radio';
      return 'textbox';
    }
    
    // Map common tags to roles
    const roleMap: Record<string, string> = {
      'button': 'button',
      'a': 'link',
      'textarea': 'textbox',
      'select': 'combobox',
      'img': 'img',
      'nav': 'navigation',
      'header': 'banner',
      'footer': 'contentinfo',
    };
    
    return roleMap[tagName] || null;
  }

  /**
   * Generate Playwright locator code based on application type
   */
  static generateLocator(
    element: {
      tagName?: string;
      attributes?: Record<string, string>;
      textContent?: string;
      className?: string;
    },
    appType: ApplicationType
  ): string {
    const recommendations = this.analyzeElement(element, appType);
    
    if (recommendations.length === 0) {
      const tagName = element.tagName || 'div';
      return `page.locator('${tagName}').first()`;
    }
    
    const best = recommendations[0];
    
    // For Salesforce, prefer attribute selectors
    if (appType === 'salesforce' && best.type === 'attribute') {
      return `page.locator('${best.selector}')`;
    }
    
    // For semantic selectors, return as-is (already Playwright code)
    if (best.type === 'semantic') {
      return best.selector;
    }
    
    // For CSS/ID selectors, wrap in page.locator
    return `page.locator('${best.selector}')`;
  }
}



