/**
 * Match Analyzer
 * 
 * Analyzes how many elements match a recipe and provides details about each.
 * This is critical for confidence scoring - multiple matches = lower confidence.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

class MatchAnalyzer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[MatchAnalyzer]') : () => {};
  }

  /**
   * Analyze matches for a recipe
   * 
   * @param {Page} page - Playwright page
   * @param {Object} recipe - ElementRecipe
   * @returns {Object} Match analysis
   */
  async analyze(page, recipe) {
    const { what, where, which } = recipe;
    const text = what?.text;
    const role = what?.role;

    if (!text && !role) {
      return this._defaultAnalysis(which);
    }

    try {
      // Find all matching elements
      let locator;
      let searchStrategy = '';
      
      if (role && text) {
        locator = page.getByRole(role, { name: text });
        searchStrategy = `role:${role}+text`;
      } else if (text) {
        locator = page.getByText(text, { exact: false });
        searchStrategy = 'text';
      } else if (role) {
        locator = page.getByRole(role);
        searchStrategy = `role:${role}`;
      }

      const count = await locator.count().catch(() => 0);
      
      this.log(`Found ${count} elements matching ${searchStrategy}`);

      if (count <= 1) {
        return {
          totalMatches: count,
          usedPosition: which?.position || 1,
          matchDetails: [],
          hasRelatedListContext: !!where?.relatedList,
          contextMatch: where?.relatedList || null,
          searchStrategy,
          isUnique: count === 1
        };
      }

      // Get details about each match (limit to 10 for performance)
      const matchDetails = [];
      const maxDetails = Math.min(count, 10);
      
      for (let i = 0; i < maxDetails; i++) {
        try {
          const element = locator.nth(i);
          const detail = await this._getElementDetail(element, i);
          matchDetails.push(detail);
        } catch (e) {
          this.log(`Could not analyze match ${i}: ${e.message}`);
        }
      }

      return {
        totalMatches: count,
        usedPosition: which?.position || 1,
        matchDetails,
        hasRelatedListContext: !!where?.relatedList,
        contextMatch: where?.relatedList || null,
        searchStrategy,
        isUnique: false,
        hasMoreMatches: count > 10
      };
    } catch (e) {
      this.log(`Match analysis failed: ${e.message}`);
      return {
        totalMatches: 1,
        usedPosition: which?.position || 1,
        matchDetails: [],
        error: e.message
      };
    }
  }

  /**
   * Analyze matches during recording (simpler, faster)
   */
  async analyzeForRecording(page, recipe) {
    const { what, where, which } = recipe;

    // If we already have totalMatching from recording, use it
    if (which?.totalMatching !== undefined) {
      return {
        totalMatches: which.totalMatching,
        usedPosition: which.position || 1,
        hasRelatedListContext: !!where?.relatedList,
        isUnique: which.totalMatching === 1
      };
    }

    // Otherwise do quick count
    try {
      let count = 1;
      
      if (what?.role && what?.text) {
        count = await page.getByRole(what.role, { name: what.text }).count();
      } else if (what?.text) {
        count = await page.getByText(what.text, { exact: false }).count();
      }

      return {
        totalMatches: count,
        usedPosition: which?.position || 1,
        hasRelatedListContext: !!where?.relatedList,
        isUnique: count === 1
      };
    } catch (e) {
      return {
        totalMatches: 1,
        usedPosition: 1,
        error: e.message
      };
    }
  }

  _defaultAnalysis(which) {
    return {
      totalMatches: which?.totalMatching || 1,
      usedPosition: which?.position || 1,
      matchDetails: [],
      hasRelatedListContext: false,
      isUnique: (which?.totalMatching || 1) === 1
    };
  }

  async _getElementDetail(locator, index) {
    const detail = await locator.evaluate((el, idx) => {
      // Find related list context (Salesforce-specific)
      let context = null;
      const relatedList = el.closest(
        'lst-related-list-single-container, lst-related-list-container, article.slds-card, lightning-card, [data-component-id*="Related"]'
      );
      if (relatedList) {
        const header = relatedList.querySelector(
          '.slds-card__header-title, h2, [slot="title"], .header-title'
        );
        if (header) {
          context = (header.textContent || '').trim().replace(/\s*\(\d+\)\s*$/, '');
        }
      }

      // Get element info
      const rect = el.getBoundingClientRect();
      
      return {
        position: idx + 1,
        text: (el.textContent || '').trim().substring(0, 100),
        context,
        href: el.getAttribute('href'),
        tagName: el.tagName.toLowerCase(),
        isVisible: el.offsetParent !== null,
        testId: el.getAttribute('data-testid'),
        ariaLabel: el.getAttribute('aria-label'),
        boundingBox: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        }
      };
    }, index);

    return detail;
  }

  /**
   * Find which match was likely clicked based on position
   */
  findClickedMatch(matchDetails, clickPosition) {
    if (!matchDetails || matchDetails.length === 0) {
      return null;
    }

    // If we have position, use it directly
    if (clickPosition !== undefined) {
      return matchDetails.find(m => m.position === clickPosition) || matchDetails[0];
    }

    // Otherwise try to match by bounding box or return first
    return matchDetails[0];
  }

  /**
   * Determine if matches are ambiguous (similar text in different contexts)
   */
  isAmbiguous(matchDetails) {
    if (!matchDetails || matchDetails.length <= 1) {
      return false;
    }

    // Check if all matches have the same context
    const contexts = matchDetails
      .map(m => m.context)
      .filter(Boolean);

    if (contexts.length === 0) {
      // No context info - ambiguous
      return true;
    }

    const uniqueContexts = new Set(contexts);
    
    // Multiple different contexts = ambiguous
    return uniqueContexts.size > 1;
  }
}

module.exports = MatchAnalyzer;
