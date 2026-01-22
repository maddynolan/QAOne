/**
 * Visual Comparator
 * 
 * Compares element positions and visual properties between recording and playback.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

class VisualComparator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[VisualComparator]') : () => {};
  }

  /**
   * Calculate how much an element has moved (drift in pixels)
   * 
   * @param {Object} originalBox - { x, y, width, height } from recording
   * @param {Object} currentBox - { x, y, width, height } from playback
   * @returns {number|null} Drift in pixels, or null if cannot calculate
   */
  calculateDrift(originalBox, currentBox) {
    if (!originalBox || !currentBox) return null;

    const centerOriginal = {
      x: originalBox.x + originalBox.width / 2,
      y: originalBox.y + originalBox.height / 2
    };

    const centerCurrent = {
      x: currentBox.x + currentBox.width / 2,
      y: currentBox.y + currentBox.height / 2
    };

    const drift = Math.sqrt(
      Math.pow(centerCurrent.x - centerOriginal.x, 2) +
      Math.pow(centerCurrent.y - centerOriginal.y, 2)
    );

    const result = Math.round(drift);
    this.log(`Drift calculated: ${result}px`);
    return result;
  }

  /**
   * Check if element size changed significantly
   * 
   * @param {Object} originalBox - Original bounding box
   * @param {Object} currentBox - Current bounding box
   * @param {number} threshold - Percentage change threshold (0-1, default 0.2 = 20%)
   * @returns {boolean|null}
   */
  hasSizeChanged(originalBox, currentBox, threshold = 0.2) {
    if (!originalBox || !currentBox) return null;

    const widthChange = Math.abs(currentBox.width - originalBox.width) / originalBox.width;
    const heightChange = Math.abs(currentBox.height - originalBox.height) / originalBox.height;

    const changed = widthChange > threshold || heightChange > threshold;
    
    if (changed) {
      this.log(`Size changed: width ${(widthChange * 100).toFixed(1)}%, height ${(heightChange * 100).toFixed(1)}%`);
    }

    return changed;
  }

  /**
   * Check if element is still visible (not zero-sized or off-screen)
   */
  isVisible(boundingBox, viewportWidth = 1920, viewportHeight = 1080) {
    if (!boundingBox) return false;

    // Check for zero size
    if (boundingBox.width <= 0 || boundingBox.height <= 0) {
      return false;
    }

    // Check if completely off-screen
    if (boundingBox.x + boundingBox.width < 0 || boundingBox.x > viewportWidth) {
      return false;
    }
    if (boundingBox.y + boundingBox.height < 0 || boundingBox.y > viewportHeight) {
      return false;
    }

    return true;
  }

  /**
   * Full comparison of two bounding boxes
   * 
   * @param {Object} originalBox - From recording
   * @param {Object} currentBox - From playback
   * @returns {Object} Comparison result
   */
  compare(originalBox, currentBox) {
    const drift = this.calculateDrift(originalBox, currentBox);
    const sizeChanged = this.hasSizeChanged(originalBox, currentBox);
    
    // Determine severity
    let severity = 'none';
    if (drift !== null) {
      if (drift > 100) severity = 'high';
      else if (drift > 50) severity = 'medium';
      else if (drift > 20) severity = 'low';
    }
    if (sizeChanged) {
      severity = severity === 'none' ? 'medium' : severity;
    }

    return {
      drift,
      sizeChanged,
      severity,
      original: originalBox,
      current: currentBox,
      isVisible: this.isVisible(currentBox),
      warnings: this._generateWarnings(drift, sizeChanged)
    };
  }

  _generateWarnings(drift, sizeChanged) {
    const warnings = [];
    
    if (drift !== null && drift > 50) {
      warnings.push(`Element moved ${drift}px from original position`);
    }
    
    if (sizeChanged) {
      warnings.push('Element size changed significantly');
    }

    return warnings;
  }
}

module.exports = VisualComparator;
