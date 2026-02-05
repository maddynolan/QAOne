/**
 * License Manager
 * 
 * Handles license validation, activation, and deactivation.
 * Supports both online and offline validation.
 */

const crypto = require('crypto');
const axios = require('axios');
const CryptoJS = require('crypto-js');

class LicenseManager {
  constructor(options = {}) {
    this.serverUrl = options.serverUrl || 'https://qaone-production.up.railway.app';
    this.deviceId = options.deviceId;
    this.store = options.store;
    
    this.licenseInfo = null;
    this.validationInterval = null;
    
    // Secret for offline validation (should match server)
    this.offlineSecret = 'flowstral-offline-2024';
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
   * Offline license validation (for on-premise deployments)
   */
  validateOffline(licenseKey) {
    try {
      // Check format: FLOWSTRAL-XXXXX-XXXXX-XXXXX-CHECKSUM
      const parts = licenseKey.split('-');
      if (parts.length !== 5 || parts[0] !== 'FLOWSTRAL') {
        return { valid: false, error: 'Invalid license format' };
      }

      const checksum = parts[4];
      const dataToCheck = parts.slice(0, 4).join('-');
      
      // Verify checksum
      const expectedChecksum = this.generateChecksum(dataToCheck);
      if (checksum !== expectedChecksum.substring(0, 5).toUpperCase()) {
        return { valid: false, error: 'Invalid license checksum' };
      }

      // Decode license type and expiry from middle parts
      const typeCode = parts[1][0];
      const licenseType = this.decodeLicenseType(typeCode);
      
      // Extract expiry (encoded in parts[3])
      const expiryInfo = this.decodeExpiry(parts[3]);

      if (expiryInfo.expired) {
        return { valid: false, error: 'License has expired' };
      }

      // Check cached validation
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

      // Create license info
      this.licenseInfo = {
        valid: true,
        licenseKey,
        type: licenseType,
        expiresAt: expiryInfo.expiresAt,
        features: this.getFeaturesForType(licenseType),
        offline: true
      };

      return this.licenseInfo;
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
   * Generate license checksum
   */
  generateChecksum(data) {
    return CryptoJS.HmacSHA256(data, this.offlineSecret).toString();
  }

  /**
   * Decode license type from code
   */
  decodeLicenseType(code) {
    const types = {
      'T': 'trial',
      'P': 'professional',
      'E': 'enterprise',
      'U': 'unlimited'
    };
    return types[code] || 'trial';
  }

  /**
   * Decode expiry date from license part
   */
  decodeExpiry(code) {
    // Format: YYMM (e.g., 2512 = December 2025)
    const year = 2000 + parseInt(code.substring(0, 2));
    const month = parseInt(code.substring(2, 4)) - 1;
    const expiresAt = new Date(year, month + 1, 0).toISOString();
    const expired = new Date() > new Date(year, month + 1, 0);
    
    return { expiresAt, expired };
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

/**
 * Generate a license key (for server-side use)
 */
function generateLicenseKey(type = 'T', expiryYear = 25, expiryMonth = 12) {
  const secret = 'flowstral-offline-2024';
  const typeCode = type.toUpperCase();
  const expiry = `${String(expiryYear).padStart(2, '0')}${String(expiryMonth).padStart(2, '0')}`;
  
  // Generate random segments
  const seg1 = typeCode + crypto.randomBytes(2).toString('hex').toUpperCase();
  const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase() + 'A';
  const seg3 = expiry + crypto.randomBytes(0.5).toString('hex').toUpperCase().substring(0, 1);
  
  const dataToSign = `FLOWSTRAL-${seg1}-${seg2}-${seg3}`;
  const checksum = CryptoJS.HmacSHA256(dataToSign, secret).toString().substring(0, 5).toUpperCase();
  
  return `${dataToSign}-${checksum}`;
}

module.exports = LicenseManager;
module.exports.generateLicenseKey = generateLicenseKey;

