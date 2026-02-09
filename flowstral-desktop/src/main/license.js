/**
 * License Manager
 * 
 * Handles license validation, activation, and deactivation.
 * Supports both online and offline validation.
 */

const axios = require('axios');

class LicenseManager {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'https://qaone-production.up.railway.app';
    this.deviceId = options.deviceId;
    this.store = options.store;
    
    this.licenseInfo = null;
    this.validationInterval = null;
  }

  /**
   * Validate a license key
   */
  async validate(licenseKey) {
    if (!licenseKey) {
      return { valid: false, error: 'No license key provided' };
    }

    // Try online validation first
    try {
      const response = await axios.post(`${this.serverUrl}/api/license/validate`, {
        licenseKey,
        deviceId: this.deviceId,
        productId: 'flowstral-desktop'
      }, {
        timeout: 10000
      });

      this.licenseInfo = response.data;
      this.store?.set('licenseCache', {
        ...response.data,
        cachedAt: Date.now()
      });

      return {
        valid: response.data.valid,
        type: response.data.type,
        expiresAt: response.data.expiresAt,
        features: response.data.features
      };
    } catch (error) {
      console.log('[License] Online validation failed, trying offline...');
      return this.validateOffline(licenseKey);
    }
  }

  /**
   * Offline license validation (cache-based only)
   * 
   * When the server is unreachable, we only trust cached validation results.
   * No client-side checksum verification — the server is the source of truth.
   */
  validateOffline(licenseKey) {
    try {
      // Check format: FLOWSTRAL-XXXXX-XXXXX-XXXXX-CHECKSUM
      const parts = licenseKey.split('-');
      if (parts.length !== 5 || parts[0] !== 'FLOWSTRAL') {
        return { valid: false, error: 'Invalid license format' };
      }

      // Check cached validation from a previous successful server validation
      const cache = this.store?.get('licenseCache');
      if (cache && cache.licenseKey === licenseKey) {
        const cacheAge = Date.now() - cache.cachedAt;
        // Cache valid for 7 days
        if (cacheAge < 7 * 24 * 60 * 60 * 1000) {
          this.licenseInfo = cache;
          return {
            valid: true,
            type: cache.type,
            expiresAt: cache.expiresAt,
            features: cache.features,
            offline: true
          };
        }
      }

      return { valid: false, error: 'Server unreachable and no valid cache. Please connect to the internet.' };
    } catch (error) {
      return { valid: false, error: 'License validation failed' };
    }
  }

  /**
   * Activate license on this device
   */
  async activate(licenseKey) {
    console.log('[License] Calling activate endpoint...');
    console.log('[License] Server URL:', this.serverUrl);
    console.log('[License] Device ID:', this.deviceId);
    console.log('[License] Device Name:', require('os').hostname());
    console.log('[License] License Key:', licenseKey ? licenseKey.substring(0, 20) + '...' : 'NONE');
    
    try {
      const response = await axios.post(`${this.serverUrl}/api/license/activate`, {
        licenseKey,
        deviceId: this.deviceId,
        deviceName: require('os').hostname(),
        productId: 'flowstral-desktop'
      });

      console.log('[License] Activate response:', JSON.stringify(response.data));

      if (response.data.success) {
        this.licenseInfo = response.data.license;
        this.store?.set('licenseCache', {
          ...response.data.license,
          licenseKey,
          cachedAt: Date.now()
        });
        
        // Start periodic re-validation
        this.startValidationLoop(licenseKey);
      }

      return response.data;
    } catch (error) {
      console.log('[License] Activate error:', error.message);
      if (error.response) {
        console.log('[License] Activate error response:', JSON.stringify(error.response.data));
      }
      return { success: false, error: error.message };
    }
  }

  /**
   * Deactivate license from this device
   */
  async deactivate() {
    const licenseKey = this.store?.get('licenseKey');
    
    if (!licenseKey) {
      return { success: true };
    }

    try {
      await axios.post(`${this.serverUrl}/api/license/deactivate`, {
        licenseKey,
        deviceId: this.deviceId
      });
    } catch (error) {
      console.log('[License] Deactivation request failed, clearing locally');
    }

    this.licenseInfo = null;
    this.store?.delete('licenseCache');
    this.stopValidationLoop();

    return { success: true };
  }

  /**
   * Get current license info
   */
  getInfo() {
    if (!this.licenseInfo) {
      const cache = this.store?.get('licenseCache');
      if (cache) {
        this.licenseInfo = cache;
      }
    }
    return this.licenseInfo;
  }

  /**
   * Check if a feature is available
   */
  hasFeature(featureName) {
    const info = this.getInfo();
    return info?.features?.includes(featureName) ?? false;
  }

  /**
   * Get features for license type
   */
  getFeaturesForType(type) {
    const features = {
      trial: ['recording', 'playback', 'basic-reports'],
      professional: ['recording', 'playback', 'basic-reports', 'advanced-reports', 'parallel-execution', 'api-testing'],
      enterprise: ['recording', 'playback', 'basic-reports', 'advanced-reports', 'parallel-execution', 'api-testing', 'ci-cd', 'self-healing', 'ai-suggestions'],
      unlimited: ['recording', 'playback', 'basic-reports', 'advanced-reports', 'parallel-execution', 'api-testing', 'ci-cd', 'self-healing', 'ai-suggestions', 'custom-integrations', 'dedicated-support']
    };
    return features[type] || features.trial;
  }

  /**
   * Start periodic validation
   */
  startValidationLoop(licenseKey) {
    this.stopValidationLoop();
    
    // Re-validate every 24 hours
    this.validationInterval = setInterval(async () => {
      console.log('[License] Periodic re-validation...');
      await this.validate(licenseKey);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Stop periodic validation
   */
  stopValidationLoop() {
    if (this.validationInterval) {
      clearInterval(this.validationInterval);
      this.validationInterval = null;
    }
  }
}

module.exports = LicenseManager;

