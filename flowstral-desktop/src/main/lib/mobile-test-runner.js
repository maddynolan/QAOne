/**
 * Mobile Test Runner - Unified Interface for QAAI
 * 
 * This module provides a unified interface for running tests on:
 * 1. Desktop browsers (default - backward compatible)
 * 2. Mobile web (Playwright device emulation)
 * 3. Native mobile apps (Maestro integration)
 * 
 * Key Design: "Record Once, Run Anywhere"
 * - Tests recorded on desktop can run on mobile web without changes
 * - Tests can be converted to native app tests with smart mapping
 * 
 * @author QAAI Team
 * @version 1.0.0
 */

const { MOBILE_DEVICES, getDevice, getDeviceCategories, NETWORK_PRESETS, getNetworkPreset } = require('./mobile-devices');
const { MaestroRunner, convertToMaestroFlow, validateMaestroSetup } = require('./maestro-integration');

// =============================================================================
// TEST TARGET TYPES
// =============================================================================

const TEST_TARGETS = {
  DESKTOP: 'desktop',
  MOBILE_WEB: 'mobile-web',
  NATIVE_IOS: 'native-ios',
  NATIVE_ANDROID: 'native-android'
};

// =============================================================================
// MOBILE TEST RUNNER CLASS
// =============================================================================

class MobileTestRunner {
  /**
   * @param {object} playwrightRecorder - Instance of PlaywrightRecorder
   * @param {object} options - Configuration options
   */
  constructor(playwrightRecorder, options = {}) {
    this.recorder = playwrightRecorder;
    this.debug = options.debug || false;
    
    // Mobile web options
    this.currentDevice = null;
    this.currentNetwork = null;
    
    // Native app options
    this.maestroRunner = null;
    this.appId = options.appId || null;
    
    // Callbacks
    this.onProgress = options.onProgress || (() => {});
    this.onStepComplete = options.onStepComplete || (() => {});
    this.onError = options.onError || (() => {});
  }
  
  /**
   * Get available test targets based on current system
   * @returns {object} Available targets with their status
   */
  static getAvailableTargets() {
    const targets = {
      desktop: { available: true, name: 'Desktop Browser' },
      mobileWeb: { available: true, name: 'Mobile Web (Emulation)' },
      nativeIos: { available: false, name: 'Native iOS App' },
      nativeAndroid: { available: false, name: 'Native Android App' }
    };
    
    // Check Maestro availability
    const maestroStatus = validateMaestroSetup();
    
    if (maestroStatus.installed) {
      targets.nativeAndroid.available = maestroStatus.androidAvailable;
      targets.nativeIos.available = maestroStatus.iosAvailable;
    }
    
    targets.maestroStatus = maestroStatus;
    
    return targets;
  }
  
  /**
   * Get all available devices for mobile web testing
   * @returns {object} Device categories and devices
   */
  static getAvailableDevices() {
    return {
      categories: getDeviceCategories(),
      devices: MOBILE_DEVICES,
      networks: NETWORK_PRESETS
    };
  }
  
  // ===========================================================================
  // MOBILE WEB EMULATION (Phase 1)
  // ===========================================================================
  
  /**
   * Configure mobile web emulation
   * This prepares the recorder to use mobile device emulation
   * @param {string} deviceName - Name of device from MOBILE_DEVICES
   * @param {object} options - Additional options
   * @returns {object} Device configuration
   */
  configureMobileWeb(deviceName, options = {}) {
    const device = getDevice(deviceName);
    
    if (!device) {
      throw new Error(`Unknown device: ${deviceName}. Use MobileTestRunner.getAvailableDevices() to see options.`);
    }
    
    this.currentDevice = {
      name: deviceName,
      config: { ...device },
      // Override with custom options
      ...(options.viewport && { viewport: options.viewport }),
      ...(options.userAgent && { userAgent: options.userAgent }),
      ...(options.geolocation && { geolocation: options.geolocation }),
      ...(options.permissions && { permissions: options.permissions })
    };
    
    // Network throttling
    if (options.network) {
      const networkPreset = getNetworkPreset(options.network);
      if (networkPreset) {
        this.currentNetwork = { name: options.network, config: networkPreset };
      }
    }
    
    console.log(`[MobileTestRunner] Configured for: ${deviceName}`);
    if (this.currentNetwork) {
      console.log(`[MobileTestRunner] Network: ${this.currentNetwork.name}`);
    }
    
    return this.currentDevice;
  }
  
  /**
   * Get the context options for Playwright
   * Used when creating browser context
   * @returns {object} Playwright context options
   */
  getContextOptions() {
    if (!this.currentDevice) {
      return {}; // Desktop mode - no special options
    }
    
    return {
      viewport: this.currentDevice.config.viewport,
      deviceScaleFactor: this.currentDevice.config.deviceScaleFactor,
      isMobile: this.currentDevice.config.isMobile,
      hasTouch: this.currentDevice.config.hasTouch,
      userAgent: this.currentDevice.config.userAgent,
      // Optional extras
      ...(this.currentDevice.geolocation && { 
        geolocation: this.currentDevice.geolocation,
        permissions: ['geolocation']
      }),
      ...(this.currentDevice.permissions && { permissions: this.currentDevice.permissions })
    };
  }
  
  /**
   * Apply network conditions to the context
   * @param {object} context - Playwright browser context
   */
  async applyNetworkConditions(context) {
    if (!this.currentNetwork || !context) return;
    
    const page = context.pages()[0];
    if (!page) return;
    
    try {
      const cdpSession = await context.newCDPSession(page);
      await cdpSession.send('Network.enable');
      await cdpSession.send('Network.emulateNetworkConditions', this.currentNetwork.config);
      console.log(`[MobileTestRunner] Applied network: ${this.currentNetwork.name}`);
    } catch (e) {
      console.log(`[MobileTestRunner] Could not apply network conditions:`, e.message);
    }
  }
  
  /**
   * Run a test with mobile web emulation
   * @param {Array} steps - QAAI test steps
   * @param {object} options - Run options
   * @returns {Promise<object>} Test result
   */
  async runMobileWebTest(steps, options = {}) {
    const deviceName = options.device || this.currentDevice?.name;
    
    if (deviceName) {
      this.configureMobileWeb(deviceName, options);
    }
    
    // Get context options for mobile emulation
    const contextOptions = this.getContextOptions();
    
    console.log(`[MobileTestRunner] Running mobile web test on ${deviceName || 'desktop'}`);
    console.log(`[MobileTestRunner] Viewport: ${contextOptions.viewport?.width}x${contextOptions.viewport?.height}`);
    
    // Run test through PlaywrightRecorder with mobile options
    // The recorder's runTest method accepts device options
    const result = await this.recorder.runTest(steps, {
      ...options,
      contextOptions,
      isMobile: !!deviceName
    });
    
    return {
      ...result,
      target: deviceName ? TEST_TARGETS.MOBILE_WEB : TEST_TARGETS.DESKTOP,
      device: deviceName || 'Desktop',
      viewport: contextOptions.viewport || 'default'
    };
  }
  
  // ===========================================================================
  // NATIVE APP TESTING (Phase 2)
  // ===========================================================================
  
  /**
   * Configure native app testing
   * @param {object} options - Native app options
   */
  configureNativeApp(options = {}) {
    const { appId, platform = 'android', deviceId } = options;
    
    if (!appId) {
      throw new Error('appId is required for native app testing');
    }
    
    this.appId = appId;
    
    this.maestroRunner = new MaestroRunner({
      appId,
      platform,
      deviceId,
      debug: this.debug,
      onStep: (step) => this.onStepComplete(step),
      onProgress: (progress) => this.onProgress(progress),
      onError: (error) => this.onError(error)
    });
    
    console.log(`[MobileTestRunner] Configured native app: ${appId} (${platform})`);
    
    return { appId, platform };
  }
  
  /**
   * Run a test on native mobile app
   * @param {Array} steps - QAAI test steps
   * @param {object} options - Run options
   * @returns {Promise<object>} Test result
   */
  async runNativeAppTest(steps, options = {}) {
    const appId = options.appId || this.appId;
    const platform = options.platform || 'android';
    
    if (!appId) {
      return { 
        success: false, 
        error: 'App ID is required. Use configureNativeApp() or pass appId in options.' 
      };
    }
    
    // Check if Maestro is available
    const maestroStatus = validateMaestroSetup();
    if (!maestroStatus.installed) {
      return {
        success: false,
        error: 'Maestro is not installed. Install it with: curl -Ls "https://get.maestro.mobile.dev" | bash',
        setupRequired: true
      };
    }
    
    // Check platform availability
    if (platform === 'android' && !maestroStatus.androidAvailable) {
      return {
        success: false,
        error: 'Android SDK (adb) not found. Install Android Studio.',
        setupRequired: true
      };
    }
    
    if (platform === 'ios' && !maestroStatus.iosAvailable) {
      return {
        success: false,
        error: 'iOS development tools not found. Install Xcode (macOS only).',
        setupRequired: true
      };
    }
    
    // Ensure Maestro runner is configured
    if (!this.maestroRunner) {
      this.configureNativeApp({ appId, platform, deviceId: options.deviceId });
    }
    
    console.log(`[MobileTestRunner] Running native app test on ${platform}`);
    console.log(`[MobileTestRunner] App: ${appId}`);
    console.log(`[MobileTestRunner] Steps: ${steps.length}`);
    
    // Run through Maestro
    const result = await this.maestroRunner.runTest(steps, options);
    
    return {
      ...result,
      target: platform === 'ios' ? TEST_TARGETS.NATIVE_IOS : TEST_TARGETS.NATIVE_ANDROID,
      appId,
      platform
    };
  }
  
  /**
   * Get available devices/emulators for native testing
   * @param {string} platform - 'android' or 'ios'
   * @returns {Promise<Array>} List of devices
   */
  async getAvailableNativeDevices(platform = 'android') {
    if (!this.maestroRunner) {
      const tempRunner = new MaestroRunner({ platform });
      return tempRunner.listDevices();
    }
    return this.maestroRunner.listDevices();
  }
  
  // ===========================================================================
  // UNIFIED TEST RUNNER - "Record Once, Run Anywhere"
  // ===========================================================================
  
  /**
   * Run test on specified target(s)
   * This is the main entry point for running tests
   * 
   * @param {Array} steps - QAAI test steps
   * @param {object} options - Run options
   * @param {string|string[]} options.targets - Target(s) to run on
   * @returns {Promise<object>} Combined results
   */
  async runTest(steps, options = {}) {
    const { 
      targets = [TEST_TARGETS.DESKTOP],
      parallel = false,
      ...runOptions 
    } = options;
    
    const targetList = Array.isArray(targets) ? targets : [targets];
    const results = {};
    
    console.log(`[MobileTestRunner] Running test on targets: ${targetList.join(', ')}`);
    
    if (parallel) {
      // Run all targets in parallel
      const promises = targetList.map(target => 
        this._runOnTarget(steps, target, runOptions)
          .then(result => ({ target, result }))
      );
      
      const parallelResults = await Promise.all(promises);
      for (const { target, result } of parallelResults) {
        results[target] = result;
      }
    } else {
      // Run sequentially
      for (const target of targetList) {
        results[target] = await this._runOnTarget(steps, target, runOptions);
      }
    }
    
    // Calculate overall success
    const allSuccess = Object.values(results).every(r => r.success);
    const totalPassed = Object.values(results).filter(r => r.success).length;
    
    return {
      success: allSuccess,
      totalTargets: targetList.length,
      passedTargets: totalPassed,
      results
    };
  }
  
  /**
   * Run test on a specific target
   * @private
   */
  async _runOnTarget(steps, target, options) {
    switch (target) {
      case TEST_TARGETS.DESKTOP:
        return this.recorder.runTest(steps, options);
        
      case TEST_TARGETS.MOBILE_WEB:
        return this.runMobileWebTest(steps, options);
        
      case TEST_TARGETS.NATIVE_IOS:
        return this.runNativeAppTest(steps, { ...options, platform: 'ios' });
        
      case TEST_TARGETS.NATIVE_ANDROID:
        return this.runNativeAppTest(steps, { ...options, platform: 'android' });
        
      default:
        return { success: false, error: `Unknown target: ${target}` };
    }
  }
  
  /**
   * Preview how steps would be converted for a target
   * Useful for showing users what will happen
   * @param {Array} steps - QAAI test steps  
   * @param {string} target - Target platform
   * @returns {object} Preview of converted steps
   */
  previewConversion(steps, target) {
    if (target === TEST_TARGETS.DESKTOP || target === TEST_TARGETS.MOBILE_WEB) {
      // No conversion needed - same steps work
      return {
        target,
        requiresConversion: false,
        steps: steps.map(s => ({ ...s, compatible: true }))
      };
    }
    
    // Native app - show Maestro conversion
    const flow = convertToMaestroFlow(steps, {
      appId: this.appId || 'com.example.app',
      platform: target === TEST_TARGETS.NATIVE_IOS ? 'ios' : 'android'
    });
    
    return {
      target,
      requiresConversion: true,
      originalSteps: steps.length,
      convertedCommands: flow.commands.length,
      commands: flow.commands,
      warnings: this._getConversionWarnings(steps)
    };
  }
  
  /**
   * Get warnings about steps that may not convert well
   * @private
   */
  _getConversionWarnings(steps) {
    const warnings = [];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const qword = step.qword || step.type;
      
      // Warn about navigation steps
      if (qword === 'GoTo' || qword === 'Navigate') {
        warnings.push({
          stepIndex: i,
          qword,
          message: 'Navigation steps may not work in native apps. App should handle its own navigation.'
        });
      }
      
      // Warn about URL assertions
      if (qword === 'AssertUrl') {
        warnings.push({
          stepIndex: i,
          qword,
          message: 'URL assertions are not available in native apps.'
        });
      }
      
      // Warn about CSS selectors
      if (step.selector && step.selector.startsWith('.') || step.selector?.startsWith('#')) {
        warnings.push({
          stepIndex: i,
          message: 'CSS selectors may not work in native apps. Text-based selectors are preferred.'
        });
      }
    }
    
    return warnings;
  }
  
  /**
   * Reset mobile configuration to desktop mode
   */
  reset() {
    this.currentDevice = null;
    this.currentNetwork = null;
    console.log('[MobileTestRunner] Reset to desktop mode');
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  MobileTestRunner,
  TEST_TARGETS,
  MOBILE_DEVICES,
  NETWORK_PRESETS
};
