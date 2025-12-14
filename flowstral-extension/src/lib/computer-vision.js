/**
 * ComputerVision - Visual element detection and matching
 * Uses canvas screenshots and image analysis for robust element identification
 */

class ComputerVision {
  constructor() {
    this.visualFingerprints = new Map();
    this.screenshotCache = new Map();
    this.similarityThreshold = 0.85;
  }

  /**
   * Capture a screenshot of an element and create a visual fingerprint
   */
  async captureElementFingerprint(element) {
    try {
      const rect = element.getBoundingClientRect();
      
      // Skip if element is not visible
      if (rect.width === 0 || rect.height === 0) {
        return null;
      }

      // Create canvas for the element
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size (max 200x200 for performance)
      const maxSize = 200;
      const scale = Math.min(maxSize / rect.width, maxSize / rect.height, 1);
      canvas.width = Math.min(rect.width * scale, maxSize);
      canvas.height = Math.min(rect.height * scale, maxSize);

      // Use html2canvas approach or native screenshot
      const fingerprint = {
        // Visual properties
        bounds: {
          width: rect.width,
          height: rect.height,
          aspectRatio: rect.width / rect.height,
        },
        // Computed styles fingerprint
        styles: this.extractStyleFingerprint(element),
        // Text content hash
        textHash: this.hashText(element.textContent || ''),
        // DOM structure fingerprint
        structure: this.extractStructureFingerprint(element),
        // Color histogram (simplified)
        colorProfile: this.extractColorProfile(element),
        // Position relative to viewport
        relativePosition: this.getRelativePosition(element),
        // Timestamp
        timestamp: Date.now(),
      };

      return fingerprint;
    } catch (error) {
      console.error('Error capturing element fingerprint:', error);
      return null;
    }
  }

  /**
   * Extract computed style fingerprint
   */
  extractStyleFingerprint(element) {
    const styles = window.getComputedStyle(element);
    return {
      backgroundColor: styles.backgroundColor,
      color: styles.color,
      fontSize: styles.fontSize,
      fontFamily: styles.fontFamily,
      borderRadius: styles.borderRadius,
      padding: styles.padding,
      margin: styles.margin,
      display: styles.display,
      position: styles.position,
    };
  }

  /**
   * Extract DOM structure fingerprint
   */
  extractStructureFingerprint(element) {
    const getStructure = (el, depth = 0) => {
      if (depth > 3) return null;
      
      const children = Array.from(el.children).slice(0, 5).map(child => 
        getStructure(child, depth + 1)
      ).filter(Boolean);

      return {
        tag: el.tagName.toLowerCase(),
        childCount: el.children.length,
        children: children,
      };
    };

    return getStructure(element);
  }

  /**
   * Extract color profile from element
   */
  extractColorProfile(element) {
    const styles = window.getComputedStyle(element);
    return {
      background: this.parseColor(styles.backgroundColor),
      text: this.parseColor(styles.color),
      border: this.parseColor(styles.borderColor),
    };
  }

  /**
   * Parse CSS color to RGB
   */
  parseColor(colorStr) {
    if (!colorStr || colorStr === 'transparent') return null;
    
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3]),
      };
    }
    return null;
  }

  /**
   * Get element position relative to common anchors
   */
  getRelativePosition(element) {
    const rect = element.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };

    return {
      // Position as percentage of viewport
      xPercent: (rect.left + rect.width / 2) / viewport.width,
      yPercent: (rect.top + rect.height / 2) / viewport.height,
      // Quadrant (1-4, like coordinate system)
      quadrant: this.getQuadrant(rect, viewport),
      // Near edges
      nearTop: rect.top < viewport.height * 0.2,
      nearBottom: rect.bottom > viewport.height * 0.8,
      nearLeft: rect.left < viewport.width * 0.2,
      nearRight: rect.right > viewport.width * 0.8,
    };
  }

  getQuadrant(rect, viewport) {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const midX = viewport.width / 2;
    const midY = viewport.height / 2;

    if (centerX < midX && centerY < midY) return 'top-left';
    if (centerX >= midX && centerY < midY) return 'top-right';
    if (centerX < midX && centerY >= midY) return 'bottom-left';
    return 'bottom-right';
  }

  /**
   * Simple text hash for comparison
   */
  hashText(text) {
    const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 100);
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
      const char = normalized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash;
  }

  /**
   * Find element by visual fingerprint
   */
  async findElementByFingerprint(fingerprint, candidates = null) {
    const elements = candidates || document.querySelectorAll('*');
    let bestMatch = null;
    let bestScore = 0;

    for (const element of elements) {
      const score = await this.compareFingerprints(fingerprint, element);
      if (score > bestScore && score >= this.similarityThreshold) {
        bestScore = score;
        bestMatch = element;
      }
    }

    return { element: bestMatch, score: bestScore };
  }

  /**
   * Compare fingerprint with an element
   */
  async compareFingerprints(fingerprint, element) {
    const currentFingerprint = await this.captureElementFingerprint(element);
    if (!currentFingerprint) return 0;

    let totalScore = 0;
    let weights = 0;

    // Compare bounds (weight: 2)
    const boundsScore = this.compareBounds(fingerprint.bounds, currentFingerprint.bounds);
    totalScore += boundsScore * 2;
    weights += 2;

    // Compare styles (weight: 3)
    const styleScore = this.compareStyles(fingerprint.styles, currentFingerprint.styles);
    totalScore += styleScore * 3;
    weights += 3;

    // Compare text hash (weight: 4)
    const textScore = fingerprint.textHash === currentFingerprint.textHash ? 1 : 0;
    totalScore += textScore * 4;
    weights += 4;

    // Compare structure (weight: 2)
    const structureScore = this.compareStructure(fingerprint.structure, currentFingerprint.structure);
    totalScore += structureScore * 2;
    weights += 2;

    // Compare color profile (weight: 2)
    const colorScore = this.compareColors(fingerprint.colorProfile, currentFingerprint.colorProfile);
    totalScore += colorScore * 2;
    weights += 2;

    // Compare relative position (weight: 1)
    const positionScore = this.comparePosition(fingerprint.relativePosition, currentFingerprint.relativePosition);
    totalScore += positionScore * 1;
    weights += 1;

    return totalScore / weights;
  }

  compareBounds(a, b) {
    if (!a || !b) return 0;
    
    const widthDiff = Math.abs(a.width - b.width) / Math.max(a.width, b.width, 1);
    const heightDiff = Math.abs(a.height - b.height) / Math.max(a.height, b.height, 1);
    const aspectDiff = Math.abs(a.aspectRatio - b.aspectRatio) / Math.max(a.aspectRatio, b.aspectRatio, 1);

    return 1 - (widthDiff + heightDiff + aspectDiff) / 3;
  }

  compareStyles(a, b) {
    if (!a || !b) return 0;
    
    let matches = 0;
    let total = 0;

    for (const key of Object.keys(a)) {
      total++;
      if (a[key] === b[key]) matches++;
    }

    return total > 0 ? matches / total : 0;
  }

  compareStructure(a, b) {
    if (!a || !b) return 0;
    if (a.tag !== b.tag) return 0;

    let score = 0.5; // Same tag

    // Compare child count
    const childDiff = Math.abs(a.childCount - b.childCount);
    if (childDiff === 0) score += 0.3;
    else if (childDiff <= 2) score += 0.1;

    // Compare children structure
    if (a.children && b.children) {
      const minChildren = Math.min(a.children.length, b.children.length);
      if (minChildren > 0) {
        let childScore = 0;
        for (let i = 0; i < minChildren; i++) {
          childScore += this.compareStructure(a.children[i], b.children[i]);
        }
        score += (childScore / minChildren) * 0.2;
      }
    }

    return Math.min(score, 1);
  }

  compareColors(a, b) {
    if (!a || !b) return 0;

    const compareRGB = (c1, c2) => {
      if (!c1 || !c2) return 0;
      const diff = Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
      );
      return 1 - (diff / 441.67); // Max RGB distance
    };

    const bgScore = compareRGB(a.background, b.background);
    const textScore = compareRGB(a.text, b.text);
    const borderScore = compareRGB(a.border, b.border);

    return (bgScore + textScore + borderScore) / 3;
  }

  comparePosition(a, b) {
    if (!a || !b) return 0;

    let score = 0;

    // Same quadrant
    if (a.quadrant === b.quadrant) score += 0.4;

    // Similar percentage position
    const xDiff = Math.abs(a.xPercent - b.xPercent);
    const yDiff = Math.abs(a.yPercent - b.yPercent);
    if (xDiff < 0.1 && yDiff < 0.1) score += 0.4;
    else if (xDiff < 0.2 && yDiff < 0.2) score += 0.2;

    // Same edge proximity
    if (a.nearTop === b.nearTop) score += 0.05;
    if (a.nearBottom === b.nearBottom) score += 0.05;
    if (a.nearLeft === b.nearLeft) score += 0.05;
    if (a.nearRight === b.nearRight) score += 0.05;

    return score;
  }

  /**
   * Generate visual selector for Playwright
   */
  generateVisualSelector(fingerprint) {
    // Generate a composite selector based on visual properties
    const parts = [];

    // Position-based hint
    const pos = fingerprint.relativePosition;
    if (pos.nearTop) parts.push('near-top');
    if (pos.nearBottom) parts.push('near-bottom');
    if (pos.nearLeft) parts.push('near-left');
    if (pos.nearRight) parts.push('near-right');

    // Size hint
    const bounds = fingerprint.bounds;
    if (bounds.width > 200) parts.push('wide');
    if (bounds.height > 100) parts.push('tall');

    // Create a visual locator comment
    return {
      type: 'visual',
      hint: parts.join('-') || 'center',
      fingerprint: JSON.stringify(fingerprint),
      playwright: `// Visual locator: ${parts.join(', ') || 'center area'}`,
    };
  }

  /**
   * Capture full page screenshot for visual debugging
   */
  async capturePageScreenshot() {
    return new Promise((resolve) => {
      // Use chrome.tabs.captureVisibleTab in extension context
      if (typeof chrome !== 'undefined' && chrome.tabs) {
        chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
          resolve(dataUrl);
        });
      } else {
        // Fallback for content script
        resolve(null);
      }
    });
  }

  /**
   * Highlight element visually during recording
   */
  highlightElement(element, color = 'rgba(0, 212, 255, 0.3)') {
    const overlay = document.createElement('div');
    overlay.className = 'cv-highlight-overlay';
    
    const rect = element.getBoundingClientRect();
    Object.assign(overlay.style, {
      position: 'fixed',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      backgroundColor: color,
      border: '2px solid #00d4ff',
      pointerEvents: 'none',
      zIndex: '2147483646',
      transition: 'all 0.2s ease',
    });

    document.body.appendChild(overlay);

    // Remove after animation
    setTimeout(() => overlay.remove(), 500);
  }

  /**
   * Store visual fingerprint for later matching
   */
  storeFingerprint(id, fingerprint) {
    this.visualFingerprints.set(id, {
      fingerprint,
      timestamp: Date.now(),
    });
  }

  /**
   * Get stored fingerprint
   */
  getFingerprint(id) {
    return this.visualFingerprints.get(id)?.fingerprint;
  }

  /**
   * Export fingerprints for test replay
   */
  exportFingerprints() {
    const data = {};
    for (const [id, value] of this.visualFingerprints) {
      data[id] = value;
    }
    return JSON.stringify(data);
  }

  /**
   * Import fingerprints for test replay
   */
  importFingerprints(json) {
    const data = JSON.parse(json);
    for (const [id, value] of Object.entries(data)) {
      this.visualFingerprints.set(id, value);
    }
  }
}

// Export for use
if (typeof window !== 'undefined') {
  window.ComputerVision = ComputerVision;
}

if (typeof module !== 'undefined') {
  module.exports = { ComputerVision };
}
