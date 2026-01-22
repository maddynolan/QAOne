# Confidence System Implementation Plan

**Created**: January 22, 2026  
**Status**: Planning → Implementation  
**Priority**: P0 (Critical for test reliability)

## Executive Summary

This document outlines the implementation of a **Confidence-Based Test Execution System** for QAAI. The system ensures that automated tests never silently pass when clicking the wrong element by:

1. Calculating confidence scores for each step
2. Capturing screenshots when confidence is low
3. Failing tests (not silently passing) when element identification is uncertain
4. Providing detailed reports showing which steps need attention

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Architecture](#solution-architecture)
3. [New Files to Create](#new-files-to-create)
4. [Existing Files to Modify](#existing-files-to-modify)
5. [Data Structures](#data-structures)
6. [Implementation Order](#implementation-order)
7. [Testing Plan](#testing-plan)

---

## Problem Statement

### Current Issues

1. **False Positives**: Tests show "PASS" even when they clicked the wrong element (e.g., "New Event" instead of "New Opportunity")
2. **Hidden Edit Button**: Users don't know they can fix selectors (edit button only shows on hover)
3. **No Match Information**: Users can't see "6 elements matched, clicked #3"
4. **No Confidence Visibility**: No indication of how reliable each step's element finding was
5. **No Screenshot Evidence**: When things go wrong, no visual evidence of what happened

### Solution Goals

- Make uncertainty VISIBLE, not hidden
- Capture evidence (screenshots) when confidence is low
- FAIL (not pass) when element identification is too uncertain
- Provide actionable recommendations to fix low-confidence steps

---

## Solution Architecture

### High-Level Flow

```
RECORDING PHASE
│
├── User clicks element
├── Capture recipe (what/where/which)
├── Analyze matches (how many? which one clicked?)
├── Calculate confidence score
├── If confidence < 90%: capture screenshot
├── Store step with metadata
└── Show warning badge in UI

PLAYBACK PHASE
│
├── Find element using SmartFinder
├── SmartFinder returns confidence score
├── If confidence = LOW: FAIL step (don't execute)
├── If confidence = MEDIUM: execute but warn
├── If confidence = HIGH: execute silently
├── Capture screenshot on failures/warnings
└── Generate report with recommendations
```

### Confidence Levels

| Level | Score Range | Action |
|-------|-------------|--------|
| HIGH | 90-100% | Execute silently |
| MEDIUM | 70-89% | Execute with warning, capture screenshot |
| LOW | <70% | FAIL step (default), or warn if lenient mode |

### Confidence Calculation Factors

| Factor | Impact | Example |
|--------|--------|---------|
| Unique testId match | +40 points | `data-testid="submit-btn"` |
| Single element found | +30 points | Only 1 match |
| Exact text match | +20 points | Text matches perfectly |
| relatedList context | +15 points | "Opportunities" context captured |
| Role + text match | +10 points | `getByRole('button', { name: 'New' })` |
| Position-based fallback | -20 points | Used position #3 of 6 |
| Multiple matches | -15 points | 6 elements matched |
| AI vision fallback | -30 points | Used screenshot analysis |
| Coordinate click | -40 points | Clicked at x,y coordinates |

---

## New Files to Create

### Backend Modules (Electron/Node.js)

#### 1. `flowstral-desktop/src/main/lib/confidence/index.js`

```javascript
/**
 * Confidence System - Main exports
 * 
 * Usage:
 *   const { ConfidenceCalculator, THRESHOLDS } = require('./confidence');
 */

const ConfidenceCalculator = require('./confidence-calculator');
const ConfidenceReporter = require('./confidence-reporter');
const THRESHOLDS = require('./confidence-thresholds');

module.exports = {
  ConfidenceCalculator,
  ConfidenceReporter,
  THRESHOLDS
};
```

#### 2. `flowstral-desktop/src/main/lib/confidence/confidence-thresholds.js`

```javascript
/**
 * Confidence Thresholds - Constants
 */

module.exports = {
  // Score thresholds
  HIGH_THRESHOLD: 90,
  MEDIUM_THRESHOLD: 70,
  
  // Score impacts (positive = good, negative = bad)
  SCORES: {
    UNIQUE_TESTID: 40,
    SINGLE_MATCH: 30,
    EXACT_TEXT_MATCH: 20,
    RELATED_LIST_CONTEXT: 15,
    ROLE_TEXT_MATCH: 10,
    POSITION_FALLBACK: -20,
    MULTIPLE_MATCHES: -15,
    AI_VISION_FALLBACK: -30,
    COORDINATE_CLICK: -40
  },
  
  // Level names
  LEVELS: {
    HIGH: 'HIGH',
    MEDIUM: 'MEDIUM',
    LOW: 'LOW'
  }
};
```

#### 3. `flowstral-desktop/src/main/lib/confidence/confidence-calculator.js`

```javascript
/**
 * Confidence Calculator
 * 
 * Calculates confidence scores for element finding operations.
 * 
 * Usage:
 *   const calculator = new ConfidenceCalculator();
 *   const confidence = calculator.calculate(recipe, matchAnalysis, strategyUsed);
 */

const THRESHOLDS = require('./confidence-thresholds');

class ConfidenceCalculator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Confidence]') : () => {};
  }

  /**
   * Calculate confidence score for an element finding operation
   * 
   * @param {Object} recipe - The ElementRecipe used
   * @param {Object} matchAnalysis - Analysis of matched elements
   * @param {Object} findResult - Result from SmartFinder
   * @returns {Object} Confidence result
   */
  calculate(recipe, matchAnalysis, findResult = {}) {
    let score = 50; // Base score
    const reasons = [];
    const deductions = [];

    // Factor 1: Match count
    if (matchAnalysis.totalMatches === 1) {
      score += THRESHOLDS.SCORES.SINGLE_MATCH;
      reasons.push('Single element match');
    } else if (matchAnalysis.totalMatches > 1) {
      score += THRESHOLDS.SCORES.MULTIPLE_MATCHES;
      deductions.push(`${matchAnalysis.totalMatches} elements matched`);
    }

    // Factor 2: TestId presence
    if (recipe.which?.testId) {
      score += THRESHOLDS.SCORES.UNIQUE_TESTID;
      reasons.push('Has data-testid');
    }

    // Factor 3: Related list context (Salesforce)
    if (recipe.where?.relatedList) {
      score += THRESHOLDS.SCORES.RELATED_LIST_CONTEXT;
      reasons.push(`relatedList context: ${recipe.where.relatedList}`);
    }

    // Factor 4: Strategy used
    const strategy = findResult.strategy || '';
    if (strategy.includes('testId')) {
      score += 10;
      reasons.push('Used testId strategy');
    } else if (strategy.includes('role+text')) {
      score += THRESHOLDS.SCORES.ROLE_TEXT_MATCH;
      reasons.push('Used role+text strategy');
    } else if (strategy.includes('position')) {
      score += THRESHOLDS.SCORES.POSITION_FALLBACK;
      deductions.push('Used position-based fallback');
    } else if (strategy.includes('AI') || strategy.includes('vision')) {
      score += THRESHOLDS.SCORES.AI_VISION_FALLBACK;
      deductions.push('Used AI vision fallback');
    } else if (strategy.includes('coordinate') || strategy.includes('DirectClick')) {
      score += THRESHOLDS.SCORES.COORDINATE_CLICK;
      deductions.push('Used coordinate-based click');
    }

    // Factor 5: Exact text match
    if (findResult.exactTextMatch) {
      score += THRESHOLDS.SCORES.EXACT_TEXT_MATCH;
      reasons.push('Exact text match');
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Determine level
    let level;
    if (score >= THRESHOLDS.HIGH_THRESHOLD) {
      level = THRESHOLDS.LEVELS.HIGH;
    } else if (score >= THRESHOLDS.MEDIUM_THRESHOLD) {
      level = THRESHOLDS.LEVELS.MEDIUM;
    } else {
      level = THRESHOLDS.LEVELS.LOW;
    }

    const result = {
      score: Math.round(score),
      level,
      reasons,
      deductions,
      recommendation: this._getRecommendation(level, deductions, recipe)
    };

    this.log('Calculated confidence:', result);
    return result;
  }

  /**
   * Generate recommendation based on confidence
   */
  _getRecommendation(level, deductions, recipe) {
    if (level === THRESHOLDS.LEVELS.HIGH) {
      return null;
    }

    if (deductions.some(d => d.includes('elements matched'))) {
      return 'Multiple elements found. Consider adding data-testid to the target element.';
    }

    if (deductions.some(d => d.includes('position'))) {
      return 'Position-based selection used. Element order may change. Add unique identifier.';
    }

    if (deductions.some(d => d.includes('AI') || d.includes('coordinate'))) {
      return 'Fallback strategy used. Re-record this step with better element selection.';
    }

    return 'Improve element identification for more reliable playback.';
  }

  /**
   * Summarize confidence across multiple steps
   */
  summarize(stepConfidences) {
    const summary = {
      total: stepConfidences.length,
      high: 0,
      medium: 0,
      low: 0,
      overallScore: 0,
      warnings: []
    };

    stepConfidences.forEach((conf, index) => {
      if (!conf) return;
      
      summary.overallScore += conf.score;
      
      if (conf.level === THRESHOLDS.LEVELS.HIGH) {
        summary.high++;
      } else if (conf.level === THRESHOLDS.LEVELS.MEDIUM) {
        summary.medium++;
        summary.warnings.push({
          step: index + 1,
          score: conf.score,
          reason: conf.deductions[0] || 'Medium confidence'
        });
      } else {
        summary.low++;
        summary.warnings.push({
          step: index + 1,
          score: conf.score,
          reason: conf.deductions[0] || 'Low confidence'
        });
      }
    });

    summary.overallScore = Math.round(summary.overallScore / stepConfidences.length);
    
    return summary;
  }
}

module.exports = ConfidenceCalculator;
```

#### 4. `flowstral-desktop/src/main/lib/confidence/confidence-reporter.js`

```javascript
/**
 * Confidence Reporter
 * 
 * Generates reports from test execution with confidence data.
 */

const THRESHOLDS = require('./confidence-thresholds');

class ConfidenceReporter {
  /**
   * Generate a test report with confidence analysis
   */
  generateReport(actions, stepResults) {
    const report = {
      timestamp: new Date().toISOString(),
      summary: this._generateSummary(stepResults),
      confidence: this._analyzeConfidence(stepResults),
      steps: this._formatStepResults(actions, stepResults),
      recommendations: this._generateRecommendations(stepResults),
      screenshots: this._collectScreenshots(stepResults)
    };

    // Determine overall status
    const hasFailures = stepResults.some(r => r.status === 'FAILED');
    const hasWarnings = stepResults.some(r => 
      r.status === 'PASSED' && r.confidence?.level !== THRESHOLDS.LEVELS.HIGH
    );

    report.status = hasFailures ? 'FAILED' : 
                    hasWarnings ? 'PASSED_WITH_WARNINGS' : 
                    'PASSED';

    return report;
  }

  _generateSummary(stepResults) {
    return {
      total: stepResults.length,
      passed: stepResults.filter(r => r.status === 'PASSED').length,
      failed: stepResults.filter(r => r.status === 'FAILED').length,
      skipped: stepResults.filter(r => r.status === 'SKIPPED').length
    };
  }

  _analyzeConfidence(stepResults) {
    const confidences = stepResults.map(r => r.confidence).filter(Boolean);
    
    return {
      high: confidences.filter(c => c.level === THRESHOLDS.LEVELS.HIGH).length,
      medium: confidences.filter(c => c.level === THRESHOLDS.LEVELS.MEDIUM).length,
      low: confidences.filter(c => c.level === THRESHOLDS.LEVELS.LOW).length,
      overall: confidences.length > 0 
        ? Math.round(confidences.reduce((sum, c) => sum + c.score, 0) / confidences.length)
        : 0
    };
  }

  _formatStepResults(actions, stepResults) {
    return stepResults.map((result, index) => ({
      index: index + 1,
      action: actions[index]?.description || actions[index]?.qword || 'Unknown',
      status: result.status,
      confidence: result.confidence,
      warnings: result.warnings || [],
      screenshot: result.screenshot?.id || null,
      duration: result.duration || null,
      error: result.error || null
    }));
  }

  _generateRecommendations(stepResults) {
    const recs = [];

    stepResults.forEach((result, index) => {
      if (result.confidence?.level === THRESHOLDS.LEVELS.MEDIUM) {
        recs.push({
          step: index + 1,
          priority: 'medium',
          type: 'improve_selector',
          message: result.confidence.recommendation || 
                   `Step ${index + 1} has ${result.confidence.score}% confidence. Consider improving selector.`
        });
      }

      if (result.confidence?.level === THRESHOLDS.LEVELS.LOW) {
        recs.push({
          step: index + 1,
          priority: 'high',
          type: 'fix_selector',
          message: `Step ${index + 1} has LOW confidence (${result.confidence.score}%). Requires immediate attention.`
        });
      }

      if (result.visualDrift > 50) {
        recs.push({
          step: index + 1,
          priority: 'medium',
          type: 'element_moved',
          message: `Step ${index + 1}: Element moved ${result.visualDrift}px since recording. Verify correct element.`
        });
      }
    });

    return recs.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  _collectScreenshots(stepResults) {
    return stepResults
      .filter(r => r.screenshot)
      .map(r => ({
        stepIndex: r.stepIndex,
        id: r.screenshot.id,
        type: r.screenshot.type, // 'element', 'fullpage', 'failure'
        timestamp: r.screenshot.timestamp
      }));
  }
}

module.exports = ConfidenceReporter;
```

#### 5. `flowstral-desktop/src/main/lib/screenshots/index.js`

```javascript
/**
 * Screenshot System - Main exports
 */

const ScreenshotManager = require('./screenshot-manager');
const ElementCropper = require('./element-cropper');
const VisualComparator = require('./visual-comparator');

module.exports = {
  ScreenshotManager,
  ElementCropper,
  VisualComparator
};
```

#### 6. `flowstral-desktop/src/main/lib/screenshots/screenshot-manager.js`

```javascript
/**
 * Screenshot Manager
 * 
 * Handles capturing, storing, and retrieving screenshots.
 * Uses in-memory storage with optional file persistence.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const ElementCropper = require('./element-cropper');

class ScreenshotManager {
  constructor(options = {}) {
    this.screenshots = new Map(); // id -> screenshot data
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Screenshot]') : () => {};
    
    // Storage directory for persistence
    this.storageDir = options.storageDir || this._getDefaultStorageDir();
    this._ensureStorageDir();
    
    this.cropper = new ElementCropper();
  }

  _getDefaultStorageDir() {
    const appDataDir = process.env.APPDATA || 
      (os.platform() === 'darwin' 
        ? path.join(os.homedir(), 'Library', 'Application Support') 
        : path.join(os.homedir(), '.config'));
    return path.join(appDataDir, 'flowstral', 'screenshots');
  }

  _ensureStorageDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
      this.log(`Created screenshot directory: ${this.storageDir}`);
    }
  }

  /**
   * Capture element screenshot (cropped around element)
   */
  async captureElement(page, action, reason = 'manual') {
    try {
      const recipe = action.recipe || action;
      const description = action.description || recipe.what?.text || 'element';
      
      // Get element bounding box
      let boundingBox = recipe.confirm?.boundingBox;
      
      if (!boundingBox) {
        // Try to find element and get its bounding box
        const locator = await this._findElementLocator(page, recipe);
        if (locator) {
          boundingBox = await locator.boundingBox().catch(() => null);
        }
      }

      // Capture full page screenshot
      const fullPageBuffer = await page.screenshot({ type: 'png' });
      
      // Crop to element if we have bounding box
      let buffer = fullPageBuffer;
      let type = 'fullpage';
      
      if (boundingBox) {
        buffer = await this.cropper.crop(fullPageBuffer, boundingBox, { padding: 50 });
        type = 'element';
      }

      // Generate ID and store
      const id = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const screenshot = {
        id,
        type,
        reason,
        description,
        boundingBox,
        timestamp: Date.now(),
        data: buffer.toString('base64'),
        size: buffer.length
      };

      this.screenshots.set(id, screenshot);
      this.log(`Captured ${type} screenshot: ${id} (${Math.round(buffer.length / 1024)}KB)`);

      return screenshot;
    } catch (e) {
      this.log(`Failed to capture screenshot: ${e.message}`);
      return null;
    }
  }

  /**
   * Capture full page screenshot
   */
  async captureFullPage(page, reason = 'manual') {
    try {
      const buffer = await page.screenshot({ type: 'png', fullPage: true });
      
      const id = `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const screenshot = {
        id,
        type: 'fullpage',
        reason,
        timestamp: Date.now(),
        data: buffer.toString('base64'),
        size: buffer.length
      };

      this.screenshots.set(id, screenshot);
      this.log(`Captured fullpage screenshot: ${id} (${Math.round(buffer.length / 1024)}KB)`);

      return screenshot;
    } catch (e) {
      this.log(`Failed to capture full page screenshot: ${e.message}`);
      return null;
    }
  }

  /**
   * Get screenshot by ID
   */
  get(id) {
    return this.screenshots.get(id);
  }

  /**
   * Get all screenshots
   */
  getAll() {
    return Array.from(this.screenshots.values());
  }

  /**
   * Clear all screenshots
   */
  clearAll() {
    const count = this.screenshots.size;
    this.screenshots.clear();
    this.log(`Cleared ${count} screenshots`);
    return count;
  }

  /**
   * Clear screenshots by reason (e.g., 'warning', 'failure')
   */
  clearByReason(reason) {
    let count = 0;
    for (const [id, screenshot] of this.screenshots) {
      if (screenshot.reason === reason) {
        this.screenshots.delete(id);
        count++;
      }
    }
    this.log(`Cleared ${count} screenshots with reason: ${reason}`);
    return count;
  }

  /**
   * Save screenshots to disk
   */
  async persist(testId) {
    const testDir = path.join(this.storageDir, testId);
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    const manifest = [];
    for (const [id, screenshot] of this.screenshots) {
      const filename = `${id}.png`;
      const filepath = path.join(testDir, filename);
      
      const buffer = Buffer.from(screenshot.data, 'base64');
      fs.writeFileSync(filepath, buffer);
      
      manifest.push({
        id: screenshot.id,
        filename,
        type: screenshot.type,
        reason: screenshot.reason,
        timestamp: screenshot.timestamp
      });
    }

    fs.writeFileSync(
      path.join(testDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    this.log(`Persisted ${manifest.length} screenshots to ${testDir}`);
    return testDir;
  }

  async _findElementLocator(page, recipe) {
    // Simplified element finding for screenshot purposes
    const { what, which } = recipe;
    
    try {
      if (which?.testId) {
        return page.locator(`[data-testid="${which.testId}"]`);
      }
      if (what?.role && what?.text) {
        return page.getByRole(what.role, { name: what.text });
      }
      if (what?.text) {
        return page.getByText(what.text);
      }
    } catch (e) {
      return null;
    }
    
    return null;
  }
}

module.exports = ScreenshotManager;
```

#### 7. `flowstral-desktop/src/main/lib/screenshots/element-cropper.js`

```javascript
/**
 * Element Cropper
 * 
 * Crops screenshots to show element + surrounding context.
 */

const sharp = require('sharp');

class ElementCropper {
  /**
   * Crop a screenshot buffer around a bounding box
   * 
   * @param {Buffer} imageBuffer - PNG image buffer
   * @param {Object} boundingBox - { x, y, width, height }
   * @param {Object} options - { padding: number }
   * @returns {Promise<Buffer>} Cropped image buffer
   */
  async crop(imageBuffer, boundingBox, options = {}) {
    const padding = options.padding || 50;

    try {
      const image = sharp(imageBuffer);
      const metadata = await image.metadata();

      // Calculate crop area with padding
      const left = Math.max(0, Math.floor(boundingBox.x - padding));
      const top = Math.max(0, Math.floor(boundingBox.y - padding));
      const width = Math.min(
        metadata.width - left,
        Math.ceil(boundingBox.width + padding * 2)
      );
      const height = Math.min(
        metadata.height - top,
        Math.ceil(boundingBox.height + padding * 2)
      );

      // Crop the image
      const croppedBuffer = await image
        .extract({ left, top, width, height })
        .png()
        .toBuffer();

      return croppedBuffer;
    } catch (e) {
      console.error('[ElementCropper] Crop failed:', e.message);
      // Return original if crop fails
      return imageBuffer;
    }
  }
}

module.exports = ElementCropper;
```

#### 8. `flowstral-desktop/src/main/lib/screenshots/visual-comparator.js`

```javascript
/**
 * Visual Comparator
 * 
 * Compares element positions and visual properties.
 */

class VisualComparator {
  /**
   * Calculate how much an element has moved (drift in pixels)
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

    return Math.round(drift);
  }

  /**
   * Check if element size changed significantly
   */
  hasSizeChanged(originalBox, currentBox, threshold = 0.2) {
    if (!originalBox || !currentBox) return null;

    const widthChange = Math.abs(currentBox.width - originalBox.width) / originalBox.width;
    const heightChange = Math.abs(currentBox.height - originalBox.height) / originalBox.height;

    return widthChange > threshold || heightChange > threshold;
  }

  /**
   * Compare two bounding boxes
   */
  compare(originalBox, currentBox) {
    return {
      drift: this.calculateDrift(originalBox, currentBox),
      sizeChanged: this.hasSizeChanged(originalBox, currentBox),
      original: originalBox,
      current: currentBox
    };
  }
}

module.exports = VisualComparator;
```

#### 9. `flowstral-desktop/src/main/lib/step-metadata/index.js`

```javascript
/**
 * Step Metadata System - Main exports
 */

const MetadataCollector = require('./metadata-collector');
const MatchAnalyzer = require('./match-analyzer');
const FingerprintGenerator = require('./fingerprint-generator');

module.exports = {
  MetadataCollector,
  MatchAnalyzer,
  FingerprintGenerator
};
```

#### 10. `flowstral-desktop/src/main/lib/step-metadata/metadata-collector.js`

```javascript
/**
 * Metadata Collector
 * 
 * Collects comprehensive metadata for each recorded step.
 */

const MatchAnalyzer = require('./match-analyzer');
const FingerprintGenerator = require('./fingerprint-generator');

class MetadataCollector {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Metadata]') : () => {};
    this.matchAnalyzer = new MatchAnalyzer(options);
    this.fingerprintGenerator = new FingerprintGenerator(options);
  }

  /**
   * Collect all metadata for a step
   */
  async collect(page, recipeAction) {
    const recipe = recipeAction.target || recipeAction;
    
    const [matchAnalysis, fingerprint] = await Promise.all([
      this.analyzeMatches(page, recipe),
      this.generateFingerprint(page, recipe)
    ]);

    return {
      matchAnalysis,
      fingerprint,
      collectedAt: Date.now()
    };
  }

  /**
   * Analyze how many elements match and which one was clicked
   */
  async analyzeMatches(page, recipe) {
    return this.matchAnalyzer.analyze(page, recipe);
  }

  /**
   * Generate fingerprint for element change detection
   */
  async generateFingerprint(page, recipe) {
    return this.fingerprintGenerator.generate(page, recipe);
  }
}

module.exports = MetadataCollector;
```

#### 11. `flowstral-desktop/src/main/lib/step-metadata/match-analyzer.js`

```javascript
/**
 * Match Analyzer
 * 
 * Analyzes how many elements match a recipe and provides details about each.
 */

class MatchAnalyzer {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[MatchAnalyzer]') : () => {};
  }

  /**
   * Analyze matches for a recipe
   */
  async analyze(page, recipe) {
    const { what, where, which } = recipe;
    const text = what?.text;
    const role = what?.role;

    if (!text && !role) {
      return { totalMatches: 1, usedPosition: 1, matchDetails: [] };
    }

    try {
      // Find all matching elements
      let locator;
      if (role && text) {
        locator = page.getByRole(role, { name: text });
      } else if (text) {
        locator = page.getByText(text, { exact: false });
      } else if (role) {
        locator = page.getByRole(role);
      }

      const count = await locator.count().catch(() => 0);
      
      if (count <= 1) {
        return {
          totalMatches: count,
          usedPosition: which?.position || 1,
          matchDetails: [],
          hasRelatedListContext: !!where?.relatedList,
          contextMatch: where?.relatedList || null
        };
      }

      // Get details about each match
      const matchDetails = [];
      for (let i = 0; i < Math.min(count, 10); i++) { // Limit to 10 for performance
        try {
          const element = locator.nth(i);
          const detail = await this._getElementDetail(page, element, i);
          matchDetails.push(detail);
        } catch (e) {
          // Skip elements we can't analyze
        }
      }

      return {
        totalMatches: count,
        usedPosition: which?.position || 1,
        matchDetails,
        hasRelatedListContext: !!where?.relatedList,
        contextMatch: where?.relatedList || null
      };
    } catch (e) {
      this.log(`Match analysis failed: ${e.message}`);
      return {
        totalMatches: 1,
        usedPosition: 1,
        matchDetails: [],
        error: e.message
      };
    }
  }

  async _getElementDetail(page, locator, index) {
    const detail = await locator.evaluate((el, idx) => {
      // Find related list context
      let context = null;
      const relatedList = el.closest(
        'lst-related-list-single-container, article.slds-card, lightning-card'
      );
      if (relatedList) {
        const header = relatedList.querySelector(
          '.slds-card__header-title, h2, [slot="title"]'
        );
        if (header) {
          context = header.textContent?.trim().replace(/\s*\(\d+\)\s*$/, '');
        }
      }

      return {
        position: idx + 1,
        text: el.textContent?.trim().substring(0, 50),
        context,
        href: el.getAttribute('href'),
        tagName: el.tagName.toLowerCase(),
        isVisible: el.offsetParent !== null
      };
    }, index);

    return detail;
  }
}

module.exports = MatchAnalyzer;
```

#### 12. `flowstral-desktop/src/main/lib/step-metadata/fingerprint-generator.js`

```javascript
/**
 * Fingerprint Generator
 * 
 * Creates a fingerprint of an element for change detection.
 */

class FingerprintGenerator {
  constructor(options = {}) {
    this.debug = options.debug || false;
    this.log = this.debug ? console.log.bind(console, '[Fingerprint]') : () => {};
  }

  /**
   * Generate fingerprint for an element
   */
  async generate(page, recipe) {
    const { what, which, confirm } = recipe;

    // Use bounding box from recipe if available
    let boundingBox = confirm?.boundingBox;

    // Try to get current bounding box
    if (!boundingBox) {
      try {
        const locator = await this._getLocator(page, recipe);
        if (locator) {
          boundingBox = await locator.boundingBox().catch(() => null);
        }
      } catch (e) {
        // Ignore
      }
    }

    // Generate hash from key attributes
    const hashInput = JSON.stringify({
      text: what?.text,
      role: what?.role,
      testId: which?.testId,
      position: which?.position
    });
    const hash = this._simpleHash(hashInput);

    return {
      boundingBox,
      hash,
      attributes: {
        testId: which?.testId,
        text: what?.text,
        role: what?.role
      },
      generatedAt: Date.now()
    };
  }

  async _getLocator(page, recipe) {
    const { what, which } = recipe;
    
    if (which?.testId) {
      return page.locator(`[data-testid="${which.testId}"]`);
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
    return null;
  }

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
```

---

### Frontend Components (React/TypeScript)

#### 13. `src/components/confidence/ConfidenceBadge.tsx`

```typescript
/**
 * Confidence Badge Component
 * 
 * Displays HIGH/MEDIUM/LOW confidence with color coding.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react';

interface ConfidenceBadgeProps {
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  showScore?: boolean;
  size?: 'sm' | 'md';
}

export function ConfidenceBadge({ 
  level, 
  score, 
  showScore = true,
  size = 'sm' 
}: ConfidenceBadgeProps) {
  const config = {
    HIGH: {
      icon: ShieldCheck,
      className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      label: 'High'
    },
    MEDIUM: {
      icon: ShieldAlert,
      className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      label: 'Medium'
    },
    LOW: {
      icon: ShieldX,
      className: 'bg-red-500/20 text-red-400 border-red-500/30',
      label: 'Low'
    }
  };

  const { icon: Icon, className, label } = config[level];

  return (
    <Badge 
      variant="outline" 
      className={cn(
        className,
        size === 'sm' ? 'text-[10px] h-5 px-1.5' : 'text-xs h-6 px-2'
      )}
    >
      <Icon className={cn(
        'mr-1',
        size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'
      )} />
      {showScore ? `${score}%` : label}
    </Badge>
  );
}

export default ConfidenceBadge;
```

#### 14. `src/components/confidence/MatchCountBadge.tsx`

```typescript
/**
 * Match Count Badge Component
 * 
 * Shows "1/6 matches" with warning color when multiple matches.
 */

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Target, AlertTriangle } from 'lucide-react';

interface MatchCountBadgeProps {
  used: number;
  total: number;
  showWarning?: boolean;
}

export function MatchCountBadge({ 
  used, 
  total, 
  showWarning = true 
}: MatchCountBadgeProps) {
  const hasMultiple = total > 1;
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        'text-[10px] h-5 px-1.5',
        hasMultiple && showWarning
          ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      )}
    >
      {hasMultiple && showWarning ? (
        <AlertTriangle className="h-3 w-3 mr-1" />
      ) : (
        <Target className="h-3 w-3 mr-1" />
      )}
      {used}/{total}
    </Badge>
  );
}

export default MatchCountBadge;
```

#### 15. `src/components/confidence/StepConfidenceDetails.tsx`

```typescript
/**
 * Step Confidence Details Component
 * 
 * Expanded view showing why a step has its confidence level.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Lightbulb, 
  Camera,
  Edit
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfidenceBadge from './ConfidenceBadge';
import MatchCountBadge from './MatchCountBadge';

interface StepConfidence {
  score: number;
  level: 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
  deductions: string[];
  recommendation: string | null;
}

interface MatchAnalysis {
  totalMatches: number;
  usedPosition: number;
  matchDetails?: Array<{
    position: number;
    text: string;
    context: string | null;
    href: string | null;
  }>;
}

interface StepConfidenceDetailsProps {
  stepIndex: number;
  action: string;
  confidence: StepConfidence;
  matchAnalysis: MatchAnalysis;
  screenshotId?: string | null;
  onViewScreenshot?: () => void;
  onEditSelector?: () => void;
}

export function StepConfidenceDetails({
  stepIndex,
  action,
  confidence,
  matchAnalysis,
  screenshotId,
  onViewScreenshot,
  onEditSelector
}: StepConfidenceDetailsProps) {
  return (
    <Card className="border-border bg-card/50">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            Step {stepIndex}: {action}
          </CardTitle>
          <div className="flex items-center gap-2">
            <MatchCountBadge 
              used={matchAnalysis.usedPosition} 
              total={matchAnalysis.totalMatches} 
            />
            <ConfidenceBadge 
              level={confidence.level} 
              score={confidence.score} 
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="py-3 px-4 space-y-3">
        {/* Positive factors */}
        {confidence.reasons.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Positive Factors</p>
            <div className="space-y-1">
              {confidence.reasons.map((reason, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                  <span className="text-emerald-300">{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Negative factors */}
        {confidence.deductions.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">Risk Factors</p>
            <div className="space-y-1">
              {confidence.deductions.map((deduction, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <XCircle className="h-3 w-3 text-red-400" />
                  <span className="text-red-300">{deduction}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Match details */}
        {matchAnalysis.totalMatches > 1 && matchAnalysis.matchDetails && (
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">
              All Matches ({matchAnalysis.totalMatches})
            </p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {matchAnalysis.matchDetails.map((match, i) => (
                <div 
                  key={i} 
                  className={cn(
                    'flex items-center gap-2 text-xs p-1.5 rounded',
                    match.position === matchAnalysis.usedPosition
                      ? 'bg-blue-500/20 border border-blue-500/30'
                      : 'bg-secondary/30'
                  )}
                >
                  <span className="font-mono text-muted-foreground">
                    #{match.position}
                  </span>
                  <span className="truncate flex-1">
                    {match.text || 'No text'}
                  </span>
                  {match.context && (
                    <Badge variant="outline" className="text-[9px] h-4">
                      {match.context}
                    </Badge>
                  )}
                  {match.position === matchAnalysis.usedPosition && (
                    <Badge className="bg-blue-500 text-[9px] h-4">Selected</Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendation */}
        {confidence.recommendation && (
          <div className="flex items-start gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/20">
            <Lightbulb className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">{confidence.recommendation}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {screenshotId && onViewScreenshot && (
            <Button
              variant="outline"
              size="sm"
              onClick={onViewScreenshot}
              className="h-7 text-xs"
            >
              <Camera className="h-3 w-3 mr-1.5" />
              View Screenshot
            </Button>
          )}
          {onEditSelector && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEditSelector}
              className="h-7 text-xs"
            >
              <Edit className="h-3 w-3 mr-1.5" />
              Edit Selector
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default StepConfidenceDetails;
```

#### 16. `src/components/confidence/ConfidenceReport.tsx`

```typescript
/**
 * Confidence Report Component
 * 
 * Full test report with confidence breakdown.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  FileText,
  Trash2,
  Edit,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfidenceBadge from './ConfidenceBadge';
import StepConfidenceDetails from './StepConfidenceDetails';

interface TestReport {
  status: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED';
  summary: {
    total: number;
    passed: number;
    failed: number;
  };
  confidence: {
    high: number;
    medium: number;
    low: number;
    overall: number;
  };
  steps: Array<{
    index: number;
    action: string;
    status: string;
    confidence: any;
    warnings: string[];
    screenshot: string | null;
  }>;
  recommendations: Array<{
    step: number;
    priority: string;
    message: string;
  }>;
}

interface ConfidenceReportProps {
  report: TestReport;
  onClearScreenshots?: () => void;
  onExportReport?: () => void;
  onEditStep?: (stepIndex: number) => void;
}

export function ConfidenceReport({
  report,
  onClearScreenshots,
  onExportReport,
  onEditStep
}: ConfidenceReportProps) {
  const [expandedStep, setExpandedStep] = React.useState<number | null>(null);

  const statusConfig = {
    PASSED: {
      icon: CheckCircle2,
      className: 'text-emerald-400',
      label: 'Passed'
    },
    PASSED_WITH_WARNINGS: {
      icon: AlertTriangle,
      className: 'text-amber-400',
      label: 'Passed with Warnings'
    },
    FAILED: {
      icon: XCircle,
      className: 'text-red-400',
      label: 'Failed'
    }
  };

  const { icon: StatusIcon, className: statusClass, label: statusLabel } = 
    statusConfig[report.status];

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <StatusIcon className={cn('h-5 w-5', statusClass)} />
            Test {statusLabel}
          </CardTitle>
          <Badge className={cn(
            'text-sm',
            report.confidence.overall >= 90 
              ? 'bg-emerald-500/20 text-emerald-400'
              : report.confidence.overall >= 70
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-red-500/20 text-red-400'
          )}>
            {report.confidence.overall}% Overall Confidence
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <p className="text-2xl font-bold text-emerald-400">
              {report.confidence.high}
            </p>
            <p className="text-xs text-muted-foreground">High Confidence</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-2xl font-bold text-amber-400">
              {report.confidence.medium}
            </p>
            <p className="text-xs text-muted-foreground">Medium</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/20">
            <p className="text-2xl font-bold text-red-400">
              {report.confidence.low}
            </p>
            <p className="text-xs text-muted-foreground">Low</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>Confidence Distribution</span>
            <span>{report.summary.passed}/{report.summary.total} steps passed</span>
          </div>
          <div className="flex h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500" 
              style={{ width: `${(report.confidence.high / report.summary.total) * 100}%` }}
            />
            <div 
              className="bg-amber-500" 
              style={{ width: `${(report.confidence.medium / report.summary.total) * 100}%` }}
            />
            <div 
              className="bg-red-500" 
              style={{ width: `${(report.confidence.low / report.summary.total) * 100}%` }}
            />
          </div>
        </div>

        {/* Recommendations */}
        {report.recommendations.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Recommendations</p>
            <div className="space-y-2">
              {report.recommendations.map((rec, i) => (
                <div 
                  key={i}
                  className={cn(
                    'flex items-start gap-2 p-2 rounded-lg text-xs',
                    rec.priority === 'high' 
                      ? 'bg-red-500/10 border border-red-500/20'
                      : 'bg-amber-500/10 border border-amber-500/20'
                  )}
                >
                  <AlertTriangle className={cn(
                    'h-4 w-4 shrink-0 mt-0.5',
                    rec.priority === 'high' ? 'text-red-400' : 'text-amber-400'
                  )} />
                  <span>{rec.message}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 ml-auto"
                    onClick={() => onEditStep?.(rec.step - 1)}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step list */}
        <div>
          <p className="text-sm font-medium mb-2">Step Details</p>
          <div className="space-y-1">
            {report.steps.map((step) => (
              <div key={step.index}>
                <div 
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-colors',
                    step.status === 'PASSED' && step.confidence?.level === 'HIGH'
                      ? 'bg-secondary/30 hover:bg-secondary/50'
                      : step.status === 'PASSED'
                      ? 'bg-amber-500/10 hover:bg-amber-500/20'
                      : 'bg-red-500/10 hover:bg-red-500/20'
                  )}
                  onClick={() => setExpandedStep(
                    expandedStep === step.index ? null : step.index
                  )}
                >
                  {expandedStep === step.index ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="font-mono text-xs text-muted-foreground w-6">
                    {String(step.index).padStart(2, '0')}
                  </span>
                  <span className="text-sm flex-1 truncate">{step.action}</span>
                  {step.confidence && (
                    <ConfidenceBadge 
                      level={step.confidence.level} 
                      score={step.confidence.score} 
                    />
                  )}
                  {step.status === 'PASSED' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-400" />
                  )}
                </div>
                {expandedStep === step.index && step.confidence && (
                  <div className="ml-6 mt-1">
                    <StepConfidenceDetails
                      stepIndex={step.index}
                      action={step.action}
                      confidence={step.confidence}
                      matchAnalysis={step.confidence.matchAnalysis || {
                        totalMatches: 1,
                        usedPosition: 1
                      }}
                      screenshotId={step.screenshot}
                      onEditSelector={() => onEditStep?.(step.index - 1)}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-border">
          {onClearScreenshots && (
            <Button
              variant="outline"
              size="sm"
              onClick={onClearScreenshots}
              className="text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1.5" />
              Clear Screenshots
            </Button>
          )}
          {onExportReport && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportReport}
              className="text-xs"
            >
              <FileText className="h-3 w-3 mr-1.5" />
              Export Report
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ConfidenceReport;
```

---

## Existing Files to Modify

### 1. `flowstral-desktop/src/main/lib/smart-finder.js`

**Changes needed:**
- Return confidence data from `find()` method
- Track which strategy succeeded
- Return match count

```javascript
// Add to find() method return:
return {
  locator,
  confidence: {
    score: calculatedScore,
    level: 'HIGH' | 'MEDIUM' | 'LOW',
    strategy: 'role+text',
    fallbacksUsed: ['sf-related-list-scope'],
    matchCount: count,
    exactTextMatch: true
  }
};
```

### 2. `flowstral-desktop/src/main/playwright-recorder.js`

**Changes needed:**
- Import new modules (confidence, screenshots, metadata)
- Initialize in `startRecording()`
- Call metadata collector in `_processRecipeAction()`
- Call confidence calculator
- Auto-capture screenshots when confidence < 90%
- Store step metadata
- Use confidence in `executeStepWithConfidence()`
- Generate report in `generateTestReport()`

### 3. `src/pages/PlaywrightRecorderPage.tsx`

**Changes needed:**
- Import new components (ConfidenceBadge, MatchCountBadge, ConfidenceReport)
- Display confidence badge on each action row
- Display match count badge when multiple matches
- Make edit button always visible (remove `opacity-0 group-hover:opacity-100`)
- Show confidence report after test execution
- Add screenshot viewer integration

---

## Data Structures

### StepMetadata (stored per step)

```typescript
interface StepMetadata {
  confidence: {
    score: number;          // 0-100
    level: 'HIGH' | 'MEDIUM' | 'LOW';
    reasons: string[];      // Positive factors
    deductions: string[];   // Negative factors
    recommendation: string | null;
  };
  matchAnalysis: {
    totalMatches: number;
    usedPosition: number;
    matchDetails: Array<{
      position: number;
      text: string;
      context: string | null;
      href: string | null;
    }>;
    hasRelatedListContext: boolean;
    contextMatch: string | null;
  };
  fingerprint: {
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    hash: string;
    attributes: Record<string, any>;
  };
  screenshot: {
    id: string;
    type: 'element' | 'fullpage';
    reason: string;
  } | null;
  collectedAt: number;
}
```

### TestReport (generated after execution)

```typescript
interface TestReport {
  status: 'PASSED' | 'PASSED_WITH_WARNINGS' | 'FAILED';
  timestamp: string;
  duration: number;
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
  };
  confidence: {
    high: number;
    medium: number;
    low: number;
    overall: number;
  };
  steps: Array<{
    index: number;
    action: string;
    status: 'PASSED' | 'FAILED' | 'SKIPPED';
    confidence: StepConfidence;
    warnings: string[];
    screenshot: string | null;
    duration: number;
    error: string | null;
  }>;
  recommendations: Array<{
    step: number;
    priority: 'high' | 'medium' | 'low';
    type: string;
    message: string;
  }>;
  screenshots: Array<{
    id: string;
    stepIndex: number;
    type: string;
  }>;
}
```

---

## Implementation Order

### Phase 1: Backend Modules (Day 1)

1. Create `lib/confidence/` directory and files
2. Create `lib/screenshots/` directory and files  
3. Create `lib/step-metadata/` directory and files
4. Add `sharp` to package.json for image processing

### Phase 2: SmartFinder Integration (Day 1)

5. Modify `smart-finder.js` to return confidence data
6. Test confidence calculation

### Phase 3: Recorder Integration (Day 2)

7. Modify `playwright-recorder.js` to use new modules
8. Test recording with metadata collection
9. Test screenshot capture

### Phase 4: UI Components (Day 2)

10. Create `src/components/confidence/` components
11. Create `src/components/screenshots/` components

### Phase 5: UI Integration (Day 3)

12. Modify `PlaywrightRecorderPage.tsx`:
    - Make edit button visible
    - Add confidence badges
    - Add match count badges
    - Add confidence report display

### Phase 6: Testing & Polish (Day 3)

13. End-to-end testing
14. Fix edge cases
15. Documentation update

---

## Testing Plan

### Unit Tests

- [ ] ConfidenceCalculator calculates scores correctly
- [ ] MatchAnalyzer finds all matches
- [ ] ScreenshotManager captures and stores screenshots
- [ ] FingerprintGenerator creates stable fingerprints

### Integration Tests

- [ ] Recording captures confidence metadata
- [ ] Screenshots auto-captured when confidence < 90%
- [ ] Playback uses confidence for execution decisions
- [ ] Report generates correctly

### E2E Tests

- [ ] Record Salesforce test with multiple "New" buttons
- [ ] Verify match count shows "1/6"
- [ ] Verify screenshot captured for low confidence
- [ ] Verify report shows recommendations

---

## Dependencies

### New NPM Packages

```json
{
  "sharp": "^0.33.0"  // Image processing for element cropping
}
```

### Existing Packages Used

- Playwright (element finding, screenshots)
- React (UI components)
- Radix UI (component library)

---

## Rollback Plan

If issues arise:
1. All new code is in separate modules - can be disabled by not importing
2. SmartFinder changes are additive - existing behavior preserved
3. UI changes can be reverted by removing component imports

---

## Success Criteria

1. ✅ Edit button always visible on action rows
2. ✅ Match count badge shows when multiple matches
3. ✅ Confidence badge shows on each step
4. ✅ Screenshots auto-captured for low/medium confidence
5. ✅ LOW confidence steps fail by default
6. ✅ Test report shows confidence breakdown
7. ✅ Recommendations provided for low confidence steps

---

**Document Version**: 1.0  
**Last Updated**: January 22, 2026  
**Author**: QA Architecture Team
