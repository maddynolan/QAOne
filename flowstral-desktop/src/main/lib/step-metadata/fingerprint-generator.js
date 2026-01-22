/**
 * Fingerprint Generator
 * 
 * Creates a fingerprint of an element for change detection.
 * Fingerprints help detect when elements have changed between recording and playback.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

class FingerprintGenerator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Fingerprint]') : () => {};
  }

  /**
   * Generate fingerprint for an element
   * 
   * @param {Page} page - Playwright page
   * @param {Object} recipe - ElementRecipe
   * @returns {Object} Fingerprint data
   */
  async generate(page, recipe) {
    const { what, which, confirm } = recipe;

    // Use bounding box from recipe if available
    let boundingBox = confirm?.boundingBox;

    // Try to get current bounding box
    if (!boundingBox && page) {
      try {
        const locator = await this._getLocator(page, recipe);
        if (locator) {
          boundingBox = await locator.boundingBox().catch(() => null);
        }
      } catch (e) {
        this.log(`Could not get bounding box: ${e.message}`);
      }
    }

    // Generate hash from key attributes
    const hashInput = JSON.stringify({
      text: what?.text,
      role: what?.role,
      testId: which?.testId,
      ariaLabel: which?.ariaLabel,
      position: which?.position
    });
    const hash = this._simpleHash(hashInput);

    const fingerprint = {
      boundingBox,
      hash,
      attributes: {
        testId: which?.testId,
        id: which?.id,
        ariaLabel: which?.ariaLabel,
        text: what?.text,
        role: what?.role,
        position: which?.position,
        tagName: what?.tagName
      },
      generatedAt: Date.now()
    };

    this.log('Generated fingerprint:', fingerprint.hash);
    return fingerprint;
  }

  /**
   * Generate a stable identifier for an element (for strategy memory)
   */
  generateIdentifier(recipe) {
    const { what, where, which } = recipe;
    
    const parts = [
      what?.role || '',
      what?.text || '',
      where?.landmark || '',
      where?.relatedList || '',
      which?.testId || ''
    ].filter(Boolean);

    return parts.join('::') || this._simpleHash(JSON.stringify(recipe));
  }

  /**
   * Check if two fingerprints match
   */
  match(fingerprint1, fingerprint2) {
    if (!fingerprint1 || !fingerprint2) return false;
    
    // Check hash first (quick)
    if (fingerprint1.hash === fingerprint2.hash) {
      return { match: true, confidence: 'high', reason: 'Hash match' };
    }

    // Check key attributes
    const attrs1 = fingerprint1.attributes || {};
    const attrs2 = fingerprint2.attributes || {};

    // TestId match is very strong
    if (attrs1.testId && attrs1.testId === attrs2.testId) {
      return { match: true, confidence: 'high', reason: 'TestId match' };
    }

    // Role + text match
    if (attrs1.role && attrs1.text && 
        attrs1.role === attrs2.role && 
        attrs1.text === attrs2.text) {
      return { match: true, confidence: 'medium', reason: 'Role+text match' };
    }

    // Text only match
    if (attrs1.text && attrs1.text === attrs2.text) {
      return { match: true, confidence: 'low', reason: 'Text only match' };
    }

    return { match: false, confidence: 'none', reason: 'No match' };
  }

  async _getLocator(page, recipe) {
    const { what, which } = recipe;
    
    try {
      if (which?.testId) {
        return page.locator(`[data-testid="${which.testId}"]`).first();
      }
      if (what?.role && what?.text) {
        const locator = page.getByRole(what.role, { name: what.text });
        if (which?.position) {
          return locator.nth(which.position - 1);
        }
        return locator.first();
      }
      if (what?.text) {
        return page.getByText(what.text).first();
      }
    } catch (e) {
      return null;
    }
    
    return null;
  }

  /**
   * Simple hash function for fingerprinting
   */
  _simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

module.exports = FingerprintGenerator;
