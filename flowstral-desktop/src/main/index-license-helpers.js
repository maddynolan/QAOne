/**
 * License Helper Functions
 * Extracted from index.js for modularity.
 *
 * These functions handle license status communication and feature gating.
 * They require external state (licenseManager, storedLicenseKey, etc.) to be
 * passed in or set via init().
 */

// State references set by init()
let _licenseManager = null;
let _storedLicenseKey = null;
let _sendToWebapp = null;

/**
 * Initialize license helpers with references to shared state.
 * Must be called before using sendLicenseStatusToWebapp or checkLicenseForFeature.
 * @param {Object} opts
 * @param {Object} opts.licenseManager - LicenseManager instance
 * @param {Function} opts.getStoredLicenseKey - Getter for stored license key
 * @param {Function} opts.sendToWebapp - Function to send IPC messages to webapp
 */
function init(opts) {
  _licenseManager = opts.licenseManager || null;
  _storedLicenseKey = opts.getStoredLicenseKey || (() => null);
  _sendToWebapp = opts.sendToWebapp || (() => {});
}

/**
 * Send current license status to webapp (called after webapp loads).
 */
function sendLicenseStatusToWebapp() {
  if (!_licenseManager) {
    console.log('[License] No license manager, skipping status send');
    return;
  }

  const info = _licenseManager.getInfo();
  const storedKey = typeof _storedLicenseKey === 'function' ? _storedLicenseKey() : _storedLicenseKey;
  console.log('[License] Sending status to webapp:', info ? `valid=${info.valid}` : 'no info');

  if (info) {
    _sendToWebapp('license-status', {
      valid: info.valid,
      key: storedKey,
      type: info.type,
      expiresAt: info.expiresAt,
      features: info.features,
      message: info.valid ? null : 'License required'
    });

    // If license is expiring soon (within 7 days), notify
    if (info.valid && info.expiresAt) {
      const daysLeft = Math.ceil((new Date(info.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 7 && daysLeft > 0) {
        _sendToWebapp('license-expiring-soon', { daysLeft });
      }
    }
  } else {
    // No license info - user needs to activate
    _sendToWebapp('license-status', { valid: false, key: null, message: 'Please enter a license key' });
  }
}

/**
 * Check if license allows using the app for a given feature.
 * @param {string} feature - Feature name to check (default: 'basic')
 * @returns {{ allowed: boolean, reason?: string, message?: string, daysLeft?: number }}
 */
function checkLicenseForFeature(feature = 'basic') {
  // If no license manager, allow (development mode)
  if (!_licenseManager) return { allowed: true };

  const info = _licenseManager.getInfo();

  // No license info at all
  if (!info) {
    return {
      allowed: false,
      reason: 'no_license',
      message: 'Please enter a valid license key to use this feature.'
    };
  }

  // License explicitly invalid
  if (!info.valid) {
    return {
      allowed: false,
      reason: 'invalid_license',
      message: 'Your license key is invalid. Please enter a valid license.'
    };
  }

  // Check expiry
  if (info.expiresAt) {
    const expiry = new Date(info.expiresAt);
    const now = new Date();
    if (now > expiry) {
      return {
        allowed: false,
        reason: 'expired',
        message: `Your license expired on ${expiry.toLocaleDateString()}. Please renew to continue using the app.`
      };
    }

    // Warn if expiring soon (within 3 days)
    const daysLeft = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
    if (daysLeft <= 3 && daysLeft > 0) {
      console.log(`[License] Warning: License expires in ${daysLeft} day(s)`);
    }
  }

  // Check if feature is available for this license type
  if (feature !== 'basic' && info.features && !info.features.includes(feature)) {
    return {
      allowed: false,
      reason: 'feature_not_available',
      message: `This feature requires a higher license tier.`
    };
  }

  return { allowed: true, daysLeft: info.expiresAt ? Math.ceil((new Date(info.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)) : null };
}

module.exports = {
  init,
  sendLicenseStatusToWebapp,
  checkLicenseForFeature
};
