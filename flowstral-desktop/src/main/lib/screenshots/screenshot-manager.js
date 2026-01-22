/**
 * Screenshot Manager
 * 
 * Handles capturing, storing, and retrieving screenshots.
 * Uses in-memory storage with optional file persistence.
 * 
 * @author Flowstral QA Team
 * @version 1.0.0
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
    
    this.cropper = new ElementCropper({ debug: this.debug });
    
    // Track total size for memory management
    this.totalSize = 0;
    this.maxSize = options.maxSize || 50 * 1024 * 1024; // 50MB default max
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
   * Generate unique screenshot ID
   */
  _generateId() {
    return `screenshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Capture element screenshot (cropped around element)
   * 
   * @param {Page} page - Playwright page
   * @param {Object} action - The action/recipe
   * @param {string} reason - Why screenshot was captured ('manual', 'warning', 'failure')
   * @returns {Object|null} Screenshot object or null on failure
   */
  async captureElement(page, action, reason = 'manual') {
    try {
      const recipe = action.recipe || action.target || action;
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

      // Capture full page screenshot as buffer
      const buffer = await page.screenshot({ type: 'png' });
      
      // Get crop info (but keep full image)
      let cropInfo = null;
      if (boundingBox) {
        cropInfo = await this.cropper.crop(buffer, boundingBox, { padding: 50 });
      }

      const id = this._generateId();
      const screenshot = {
        id,
        type: boundingBox ? 'element' : 'fullpage',
        reason,
        description,
        boundingBox,
        cropInfo,
        timestamp: Date.now(),
        data: buffer.toString('base64'),
        size: buffer.length
      };

      // Check memory limit
      if (this.totalSize + buffer.length > this.maxSize) {
        this._evictOldest();
      }

      this.screenshots.set(id, screenshot);
      this.totalSize += buffer.length;
      
      this.log(`Captured ${screenshot.type} screenshot: ${id} (${Math.round(buffer.length / 1024)}KB) - ${reason}`);

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
      const buffer = await page.screenshot({ type: 'png', fullPage: false });
      
      const id = this._generateId();
      const screenshot = {
        id,
        type: 'fullpage',
        reason,
        timestamp: Date.now(),
        data: buffer.toString('base64'),
        size: buffer.length
      };

      // Check memory limit
      if (this.totalSize + buffer.length > this.maxSize) {
        this._evictOldest();
      }

      this.screenshots.set(id, screenshot);
      this.totalSize += buffer.length;
      
      this.log(`Captured fullpage screenshot: ${id} (${Math.round(buffer.length / 1024)}KB) - ${reason}`);

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
   * Get screenshots for a specific reason
   */
  getByReason(reason) {
    return Array.from(this.screenshots.values()).filter(s => s.reason === reason);
  }

  /**
   * Get screenshot count and size
   */
  getStats() {
    return {
      count: this.screenshots.size,
      totalSize: this.totalSize,
      totalSizeKB: Math.round(this.totalSize / 1024),
      totalSizeMB: (this.totalSize / (1024 * 1024)).toFixed(2),
      byReason: {
        manual: this.getByReason('manual').length,
        warning: this.getByReason('warning').length,
        failure: this.getByReason('failure').length
      }
    };
  }

  /**
   * Clear all screenshots
   */
  clearAll() {
    const count = this.screenshots.size;
    this.screenshots.clear();
    this.totalSize = 0;
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
        this.totalSize -= screenshot.size;
        this.screenshots.delete(id);
        count++;
      }
    }
    this.log(`Cleared ${count} screenshots with reason: ${reason}`);
    return count;
  }

  /**
   * Delete a single screenshot
   */
  delete(id) {
    const screenshot = this.screenshots.get(id);
    if (screenshot) {
      this.totalSize -= screenshot.size;
      this.screenshots.delete(id);
      this.log(`Deleted screenshot: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Evict oldest screenshots to free memory
   */
  _evictOldest() {
    const screenshots = Array.from(this.screenshots.values())
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest 20% 
    const toRemove = Math.ceil(screenshots.length * 0.2);
    for (let i = 0; i < toRemove; i++) {
      this.delete(screenshots[i].id);
    }
    
    this.log(`Evicted ${toRemove} oldest screenshots to free memory`);
  }

  /**
   * Save screenshots to disk
   */
  async persist(testId) {
    this._ensureStorageDir();
    
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
        description: screenshot.description,
        timestamp: screenshot.timestamp,
        boundingBox: screenshot.boundingBox
      });
    }

    fs.writeFileSync(
      path.join(testDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2)
    );

    this.log(`Persisted ${manifest.length} screenshots to ${testDir}`);
    return testDir;
  }

  /**
   * Load screenshots from disk
   */
  async load(testId) {
    const testDir = path.join(this.storageDir, testId);
    const manifestPath = path.join(testDir, 'manifest.json');
    
    if (!fs.existsSync(manifestPath)) {
      this.log(`No screenshots found for test: ${testId}`);
      return 0;
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    
    for (const entry of manifest) {
      const filepath = path.join(testDir, entry.filename);
      if (fs.existsSync(filepath)) {
        const buffer = fs.readFileSync(filepath);
        const screenshot = {
          ...entry,
          data: buffer.toString('base64'),
          size: buffer.length
        };
        this.screenshots.set(entry.id, screenshot);
        this.totalSize += buffer.length;
      }
    }

    this.log(`Loaded ${manifest.length} screenshots from ${testDir}`);
    return manifest.length;
  }

  async _findElementLocator(page, recipe) {
    const { what, which } = recipe;
    
    try {
      if (which?.testId) {
        const locator = page.locator(`[data-testid="${which.testId}"]`);
        if (await locator.count() > 0) return locator.first();
      }
      if (what?.role && what?.text) {
        const locator = page.getByRole(what.role, { name: what.text });
        if (await locator.count() > 0) {
          if (which?.position) {
            return locator.nth(which.position - 1);
          }
          return locator.first();
        }
      }
      if (what?.text) {
        const locator = page.getByText(what.text);
        if (await locator.count() > 0) return locator.first();
      }
    } catch (e) {
      // Ignore errors, return null
    }
    
    return null;
  }
}

module.exports = ScreenshotManager;
