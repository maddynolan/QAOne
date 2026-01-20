/**
 * Mobile Device Configuration
 * 
 * Provides mobile device emulation configuration for Playwright.
 * Includes device presets, network throttling, and geolocation.
 */

const { MOBILE_DEVICES, NETWORK_PRESETS, getDevice, getNetworkPreset, getDeviceCategories } = require('./mobile-devices');

/**
 * Mobile configuration manager
 * Handles device emulation and network throttling
 */
class MobileConfig {
  constructor() {
    this.mobileDevice = null;
    this.mobileNetwork = null;
    this.isMobileMode = false;
  }

  /**
   * Configure mobile device emulation
   * @param {string} deviceName - Name of device (e.g., 'iPhone 15 Pro', 'Pixel 8')
   * @param {object} options - Additional options (geolocation, permissions)
   * @returns {object|null} Device configuration or null if not found
   */
  setDevice(deviceName, options = {}) {
    const device = getDevice(deviceName);
    
    if (!device) {
      console.warn(`[MobileConfig] Unknown device: ${deviceName}`);
      console.log('[MobileConfig] Available devices:', Object.keys(MOBILE_DEVICES).slice(0, 10).join(', ') + '...');
      return null;
    }
    
    this.mobileDevice = {
      name: deviceName,
      config: { ...device },
      ...(options.geolocation && { geolocation: options.geolocation }),
      ...(options.permissions && { permissions: options.permissions })
    };
    
    this.isMobileMode = true;
    
    console.log(`[MobileConfig] Device set: ${deviceName}`);
    console.log(`[MobileConfig] Viewport: ${device.viewport.width}x${device.viewport.height}`);
    
    return this.mobileDevice;
  }

  /**
   * Configure network throttling
   * @param {string} networkPreset - Network preset (e.g., '4G', '3G', 'Slow 3G')
   * @returns {object|null} Network configuration or null if not found
   */
  setNetwork(networkPreset) {
    const preset = getNetworkPreset(networkPreset);
    
    if (!preset) {
      console.warn(`[MobileConfig] Unknown network preset: ${networkPreset}`);
      console.log('[MobileConfig] Available presets:', Object.keys(NETWORK_PRESETS).join(', '));
      return null;
    }
    
    this.mobileNetwork = { name: networkPreset, config: preset };
    console.log(`[MobileConfig] Network throttling: ${networkPreset}`);
    
    return this.mobileNetwork;
  }

  /**
   * Clear mobile configuration (return to desktop mode)
   */
  clear() {
    this.mobileDevice = null;
    this.mobileNetwork = null;
    this.isMobileMode = false;
    console.log('[MobileConfig] Reset to desktop mode');
  }

  /**
   * Get Playwright context options for mobile emulation
   * @returns {object} Context options
   */
  getContextOptions() {
    if (!this.mobileDevice) {
      return {}; // Desktop mode
    }
    
    const device = this.mobileDevice.config;
    return {
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      userAgent: device.userAgent,
      ...(this.mobileDevice.geolocation && { 
        geolocation: this.mobileDevice.geolocation,
        permissions: ['geolocation']
      }),
      ...(this.mobileDevice.permissions && { permissions: this.mobileDevice.permissions })
    };
  }

  /**
   * Apply network throttling to a Playwright context
   * @param {object} context - Playwright browser context
   */
  async applyNetwork(context) {
    if (!this.mobileNetwork || !context) return;
    
    try {
      const page = context.pages()[0];
      if (!page) return;
      
      const cdpSession = await context.newCDPSession(page);
      await cdpSession.send('Network.enable');
      await cdpSession.send('Network.emulateNetworkConditions', this.mobileNetwork.config);
      console.log(`[MobileConfig] Applied network throttling: ${this.mobileNetwork.name}`);
    } catch (e) {
      console.log('[MobileConfig] Could not apply network conditions:', e.message);
    }
  }

  /**
   * Check if currently in mobile mode
   * @returns {boolean}
   */
  isActive() {
    return this.isMobileMode && this.mobileDevice !== null;
  }

  /**
   * Get current configuration summary
   * @returns {object|null}
   */
  getConfig() {
    if (!this.isMobileMode) return null;
    
    return {
      device: this.mobileDevice?.name,
      viewport: this.mobileDevice?.config?.viewport,
      userAgent: this.mobileDevice?.config?.userAgent,
      network: this.mobileNetwork?.name
    };
  }

  /**
   * Get available devices for UI display
   * @returns {object}
   */
  static getAvailableDevices() {
    return {
      categories: getDeviceCategories(),
      devices: MOBILE_DEVICES,
      networks: NETWORK_PRESETS
    };
  }
}

module.exports = { MobileConfig };
