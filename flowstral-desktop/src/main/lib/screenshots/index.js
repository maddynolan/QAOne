/**
 * Screenshot System - Main exports
 * 
 * Provides screenshot capture, cropping, and visual comparison.
 * 
 * Usage:
 *   const { ScreenshotManager, VisualComparator } = require('./screenshots');
 *   
 *   const manager = new ScreenshotManager({ debug: true });
 *   const screenshot = await manager.captureElement(page, action, 'warning');
 *   
 *   const comparator = new VisualComparator();
 *   const drift = comparator.calculateDrift(originalBox, currentBox);
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
 */

const ScreenshotManager = require('./screenshot-manager');
const ElementCropper = require('./element-cropper');
const VisualComparator = require('./visual-comparator');

module.exports = {
  ScreenshotManager,
  ElementCropper,
  VisualComparator
};
