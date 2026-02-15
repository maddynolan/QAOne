/**
 * Computer Vision - Visual element fingerprinting
 * Captures visual properties of elements for self-healing selectors
 * Extracted from content.js for modularity
 *
 * Exposes: window._FlowstralComputerVision
 */

(function() {
  'use strict';

  class ComputerVision {
    constructor() {
      this.fingerprints = new Map();
    }

    captureFingerprint(element) {
      try {
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        const styles = window.getComputedStyle(element);

        return {
          bounds: {
            width: Math.round(rect.width),
            height: Math.round(rect.height),
            aspectRatio: (rect.width / rect.height).toFixed(2),
          },
          styles: {
            backgroundColor: styles.backgroundColor,
            color: styles.color,
            fontSize: styles.fontSize,
            borderRadius: styles.borderRadius,
          },
          position: {
            xPercent: ((rect.left + rect.width / 2) / window.innerWidth).toFixed(3),
            yPercent: ((rect.top + rect.height / 2) / window.innerHeight).toFixed(3),
            quadrant: this.getQuadrant(rect),
          },
          textHash: this.hashText(element.textContent || ''),
          tagName: element.tagName.toLowerCase(),
          structure: this.getStructureHash(element),
        };
      } catch (e) {
        return null;
      }
    }

    getQuadrant(rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const mx = window.innerWidth / 2;
      const my = window.innerHeight / 2;
      if (cx < mx && cy < my) return 'top-left';
      if (cx >= mx && cy < my) return 'top-right';
      if (cx < mx && cy >= my) return 'bottom-left';
      return 'bottom-right';
    }

    hashText(text) {
      const normalized = text.trim().toLowerCase().substring(0, 50);
      let hash = 0;
      for (let i = 0; i < normalized.length; i++) {
        hash = ((hash << 5) - hash) + normalized.charCodeAt(i);
        hash = hash & hash;
      }
      return hash;
    }

    getStructureHash(element) {
      const children = element.children.length;
      const tag = element.tagName.toLowerCase();
      const depth = this.getDepth(element);
      return `${tag}-${children}-${depth}`;
    }

    getDepth(element, max = 5) {
      let depth = 0;
      let current = element;
      while (current.parentElement && depth < max) {
        depth++;
        current = current.parentElement;
      }
      return depth;
    }

    highlightElement(element) {
      const overlay = document.createElement('div');
      overlay.className = 'cv-highlight';
      const rect = element.getBoundingClientRect();
      Object.assign(overlay.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        border: '2px solid #667eea',
        pointerEvents: 'none',
        zIndex: '2147483646',
        borderRadius: '4px',
      });
      document.body.appendChild(overlay);
      setTimeout(() => overlay.remove(), 300);
    }
  }

  window._FlowstralComputerVision = ComputerVision;
})();
