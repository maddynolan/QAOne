/**
 * Maestro Integration for QAAI
 * 
 * Converts QAAI test steps to Maestro YAML format for native mobile app testing.
 * Maestro is an open-source mobile UI testing framework that works with
 * iOS simulators and Android emulators - NO device farm required!
 * 
 * Key Features:
 * - Convert QAAI QWord actions to Maestro commands
 * - Support for iOS and Android
 * - Run tests on simulators/emulators
 * - Generate Maestro flow files
 * 
 * @see https://maestro.mobile.dev/
 */

const fs = require('fs');
const path = require('path');
const { execSync, exec, spawn } = require('child_process');
const yaml = require('js-yaml') || { dump: JSON.stringify, load: JSON.parse };

// =============================================================================
// MAESTRO COMMAND MAPPING
// =============================================================================

/**
 * Map QAAI QWord actions to Maestro commands
 */
const QWORD_TO_MAESTRO = {
  // Click actions
  'ClickText': (args) => ({ tapOn: args[0] }),
  'ClickElement': (args, step) => {
    // Use testId if available, otherwise text
    if (step.testId) {
      return { tapOn: { id: step.testId } };
    }
    if (step.selector?.includes('[data-testid')) {
      const match = step.selector.match(/data-testid="([^"]+)"/);
      if (match) return { tapOn: { id: match[1] } };
    }
    return { tapOn: args[0] };
  },
  
  // Fill/Input actions
  'Fill': (args, step) => {
    const commands = [];
    // First tap on the field
    if (step.testId) {
      commands.push({ tapOn: { id: step.testId } });
    } else if (args[0]) {
      commands.push({ tapOn: args[0] });
    }
    // Then input text
    if (args[1]) {
      commands.push({ inputText: args[1] });
    }
    return commands;
  },
  
  // Navigation
  'GoTo': (args) => ({ openLink: args[0] }),
  'Navigate': (args) => ({ openLink: args[0] }),
  
  // Assertions
  'AssertText': (args) => ({ assertVisible: args[0] }),
  'AssertElement': (args, step) => {
    if (step.testId) {
      return { assertVisible: { id: step.testId } };
    }
    return { assertVisible: args[0] };
  },
  'AssertUrl': () => null, // Not supported in native apps
  
  // Select/Dropdown
  'Select': (args, step) => {
    const commands = [];
    // Tap dropdown trigger
    commands.push({ tapOn: args[0] });
    // Small wait for dropdown to open
    commands.push({ waitForAnimationToEnd: true });
    // Tap option
    if (step.value) {
      commands.push({ tapOn: step.value });
    }
    return commands;
  },
  
  // Wait
  'Wait': (args) => {
    const ms = parseInt(args[0]) || 1000;
    return { wait: { milliseconds: ms } };
  },
  'WaitForElement': (args) => ({ 
    waitForVisible: args[0],
    timeout: 10000 
  }),
  
  // Scroll
  'Scroll': (args, step) => {
    const direction = step.direction || 'down';
    return { scroll: direction.toUpperCase() };
  },
  'ScrollToElement': (args) => ({ scrollUntilVisible: args[0] }),
  
  // Keyboard
  'Press': (args) => {
    const key = args[0]?.toLowerCase();
    if (key === 'enter' || key === 'return') {
      return { pressKey: 'Enter' };
    }
    if (key === 'back' || key === 'escape') {
      return { pressKey: 'Back' };
    }
    return { pressKey: key };
  },
  
  // Hover (becomes tap on mobile)
  'Hover': (args) => ({ tapOn: args[0] }),
  
  // Screenshot
  'Screenshot': (args) => ({ 
    takeScreenshot: args[0] || `screenshot_${Date.now()}` 
  }),
  
  // Check/Uncheck
  'Check': (args) => ({ tapOn: args[0] }),
  'Uncheck': (args) => ({ tapOn: args[0] }),
  
  // Swipe gestures (mobile-specific)
  'SwipeLeft': () => ({ swipe: { direction: 'LEFT' } }),
  'SwipeRight': () => ({ swipe: { direction: 'RIGHT' } }),
  'SwipeUp': () => ({ swipe: { direction: 'UP' } }),
  'SwipeDown': () => ({ swipe: { direction: 'DOWN' } }),
  
  // App lifecycle
  'LaunchApp': (args) => ({ launchApp: { appId: args[0] } }),
  'CloseApp': () => ({ stopApp: true }),
  'ClearAppData': (args) => ({ clearState: { appId: args[0] } })
};

// =============================================================================
// MAESTRO FLOW CONVERTER
// =============================================================================

/**
 * Convert QAAI test steps to Maestro flow format
 * @param {Array} qaaiSteps - Array of QAAI test steps
 * @param {object} options - Conversion options
 * @returns {object} Maestro flow object
 */
function convertToMaestroFlow(qaaiSteps, options = {}) {
  const {
    appId = 'com.example.app',
    platform = 'android', // 'android' or 'ios'
    includeSetup = true,
    timeout = 30000
  } = options;
  
  const maestroCommands = [];
  
  // Add setup commands if requested
  if (includeSetup) {
    maestroCommands.push({ launchApp: { appId } });
  }
  
  // Convert each QAAI step
  for (const step of qaaiSteps) {
    const qword = step.qword || step.type || 'ClickText';
    const args = step.args || [step.text || step.target];
    
    // Skip navigation steps for native apps (handled by app itself)
    if (qword === 'GoTo' && !options.includeNavigation) {
      continue;
    }
    
    // Get the converter function
    const converter = QWORD_TO_MAESTRO[qword];
    
    if (converter) {
      const result = converter(args, step);
      
      if (result) {
        // Handle commands that return arrays
        if (Array.isArray(result)) {
          maestroCommands.push(...result);
        } else {
          maestroCommands.push(result);
        }
      }
    } else {
      // Fallback: treat unknown actions as tap on text
      if (args[0]) {
        console.log(`[Maestro] Unknown qword "${qword}", falling back to tapOn`);
        maestroCommands.push({ tapOn: args[0] });
      }
    }
  }
  
  return {
    appId,
    tags: ['qaai-generated', platform],
    env: {},
    onFlowStart: null,
    onFlowComplete: null,
    commands: maestroCommands
  };
}

/**
 * Convert Maestro flow to YAML string
 * @param {object} flow - Maestro flow object
 * @returns {string} YAML string
 */
function flowToYaml(flow) {
  // Maestro uses a specific YAML format with --- separator
  let yamlContent = `appId: ${flow.appId}\n`;
  
  if (flow.tags && flow.tags.length > 0) {
    yamlContent += `tags:\n${flow.tags.map(t => `  - ${t}`).join('\n')}\n`;
  }
  
  yamlContent += '---\n';
  
  // Convert commands to YAML
  for (const cmd of flow.commands) {
    yamlContent += commandToYaml(cmd) + '\n';
  }
  
  return yamlContent;
}

/**
 * Convert a single command to YAML format
 * @param {object} cmd - Maestro command
 * @returns {string} YAML line(s)
 */
function commandToYaml(cmd) {
  const key = Object.keys(cmd)[0];
  const value = cmd[key];
  
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return `- ${key}: ${JSON.stringify(value)}`;
  }
  
  if (typeof value === 'object' && value !== null) {
    const lines = [`- ${key}:`];
    for (const [k, v] of Object.entries(value)) {
      lines.push(`    ${k}: ${JSON.stringify(v)}`);
    }
    return lines.join('\n');
  }
  
  return `- ${key}`;
}

// =============================================================================
// MAESTRO RUNNER
// =============================================================================

class MaestroRunner {
  /**
   * Get augmented PATH that includes common Maestro install locations
   * @returns {object} env object with augmented PATH
   */
  static getAugmentedEnv() {
    const os = require('os');
    const homeDir = os.homedir();
    const extraPaths = [
      path.join(homeDir, '.maestro', 'bin'),
      path.join(homeDir, 'AppData', 'Local', 'maestro', 'bin'),
      '/usr/local/bin',
      '/opt/homebrew/bin',
    ];
    const sep = process.platform === 'win32' ? ';' : ':';
    return {
      ...process.env,
      PATH: extraPaths.join(sep) + sep + (process.env.PATH || '')
    };
  }

  constructor(options = {}) {
    this.platform = options.platform || 'android';
    this.appId = options.appId || null;
    this.deviceId = options.deviceId || null;
    this.timeout = options.timeout || 60000;
    // Use app userData dir (writable) instead of process.cwd() (may be C:\Program Files)
    const { app } = require('electron');
    const userDataDir = app?.getPath?.('userData') || require('os').tmpdir();
    this.outputDir = options.outputDir || path.join(userDataDir, '.maestro-output');
    this.debug = options.debug || false;
    this.studioProcess = null;
    
    // Callbacks
    this.onStep = options.onStep || (() => {});
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.onStudioOutput = options.onStudioOutput || (() => {});
    
    // Ensure output directory exists
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }
  
  /**
   * Start Maestro Studio - Interactive recorder for native apps
   * This opens a web UI where you can click on your app and it records the actions
   * @param {string} deviceId - Optional device ID
   * @returns {Promise<object>} Studio info including URL
   */
  async startStudio(deviceId = null) {
    return new Promise((resolve, reject) => {
      if (this.studioProcess) {
        console.log('[Maestro] Studio already running');
        return resolve({ success: true, url: 'http://localhost:9999', alreadyRunning: true });
      }
      
      // Pre-flight check: is Maestro installed?
      if (!MaestroRunner.isInstalled()) {
        const installCmd = process.platform === 'win32'
          ? 'iwr -useb https://get.maestro.mobile.dev | iex'
          : 'curl -Ls "https://get.maestro.mobile.dev" | bash';
        return reject(new Error(
          `Maestro CLI is not installed or not found in PATH.\n\nInstall it by running:\n${installCmd}\n\nThen restart the app.`
        ));
      }

      const args = ['studio'];
      if (deviceId || this.deviceId) {
        args.push('--device', deviceId || this.deviceId);
      }

      console.log(`[Maestro] Starting Studio: maestro ${args.join(' ')}`);

      this.studioProcess = spawn('maestro', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false,
        shell: true,
        env: MaestroRunner.getAugmentedEnv()
      });
      
      let started = false;
      
      this.studioProcess.stdout.on('data', (data) => {
        const text = data.toString();
        console.log('[Maestro Studio]', text);
        this.onStudioOutput({ type: 'stdout', text });
        
        // Detect when Studio is ready (it outputs the URL)
        if (text.includes('localhost') || text.includes('9999')) {
          if (!started) {
            started = true;
            resolve({ 
              success: true, 
              url: 'http://localhost:9999',
              message: 'Maestro Studio is running. Open your browser to record actions.'
            });
          }
        }
      });
      
      this.studioProcess.stderr.on('data', (data) => {
        const text = data.toString();
        console.error('[Maestro Studio Error]', text);
        this.onStudioOutput({ type: 'stderr', text });
      });
      
      this.studioProcess.on('close', (code) => {
        console.log(`[Maestro] Studio closed with code ${code}`);
        this.studioProcess = null;
        if (!started) {
          reject(new Error(`Maestro Studio exited with code ${code}`));
        }
      });
      
      this.studioProcess.on('error', (err) => {
        console.error('[Maestro] Studio error:', err);
        this.studioProcess = null;
        reject(err);
      });
      
      // Timeout - if Studio doesn't start in 30 seconds, assume it's running
      setTimeout(() => {
        if (!started) {
          started = true;
          resolve({ 
            success: true, 
            url: 'http://localhost:9999',
            message: 'Maestro Studio should be running at http://localhost:9999'
          });
        }
      }, 10000);
    });
  }
  
  /**
   * Stop Maestro Studio
   */
  stopStudio() {
    if (this.studioProcess) {
      console.log('[Maestro] Stopping Studio');
      this.studioProcess.kill();
      this.studioProcess = null;
      return true;
    }
    return false;
  }
  
  /**
   * Check if Studio is running
   */
  isStudioRunning() {
    return this.studioProcess !== null;
  }
  
  /**
   * Check if Maestro is installed
   * @returns {boolean}
   */
  static isInstalled() {
    try {
      execSync('maestro --version', {
        stdio: 'pipe',
        shell: true,
        env: MaestroRunner.getAugmentedEnv(),
        timeout: 10000
      });
      return true;
    } catch (e) {
      return false;
    }
  }
  
  /**
   * Get Maestro version
   * @returns {string|null}
   */
  static getVersion() {
    try {
      return execSync('maestro --version', {
        encoding: 'utf-8',
        shell: true,
        env: MaestroRunner.getAugmentedEnv(),
        timeout: 10000
      }).trim();
    } catch (e) {
      return null;
    }
  }
  
  /**
   * Install Maestro (macOS/Linux only)
   * @returns {Promise<boolean>}
   */
  static async install() {
    return new Promise((resolve) => {
      try {
        console.log('[Maestro] Installing Maestro...');
        execSync('curl -Ls "https://get.maestro.mobile.dev" | bash', { stdio: 'inherit' });
        resolve(true);
      } catch (e) {
        console.error('[Maestro] Install failed:', e.message);
        resolve(false);
      }
    });
  }
  
  /**
   * Convert QAAI steps to Maestro flow and run
   * @param {Array} qaaiSteps - QAAI test steps
   * @param {object} options - Run options
   * @returns {Promise<object>} Test result
   */
  async runTest(qaaiSteps, options = {}) {
    const appId = options.appId || this.appId;
    const platform = options.platform || this.platform;
    
    if (!appId) {
      return { success: false, error: 'App ID is required for native app testing' };
    }
    
    // Convert to Maestro flow
    const flow = convertToMaestroFlow(qaaiSteps, {
      appId,
      platform,
      includeSetup: options.includeSetup !== false
    });
    
    // Write flow to temp file
    const flowPath = path.join(this.outputDir, `qaai-flow-${Date.now()}.yaml`);
    const yamlContent = flowToYaml(flow);
    
    if (this.debug) {
      console.log('[Maestro] Generated flow:', yamlContent);
    }
    
    fs.writeFileSync(flowPath, yamlContent);
    
    // Run Maestro
    return this.executeFlow(flowPath, options);
  }
  
  /**
   * Execute a Maestro flow file
   * @param {string} flowPath - Path to flow file
   * @param {object} options - Execution options
   * @returns {Promise<object>} Test result
   */
  async executeFlow(flowPath, options = {}) {
    return new Promise((resolve) => {
      const args = ['test', flowPath];
      
      // Add device ID if specified
      if (this.deviceId || options.deviceId) {
        args.push('--device', this.deviceId || options.deviceId);
      }
      
      // Add output format
      args.push('--format', 'junit');
      
      const outputFile = path.join(this.outputDir, `result-${Date.now()}.xml`);
      args.push('--output', outputFile);
      
      console.log(`[Maestro] Running: maestro ${args.join(' ')}`);
      
      const startTime = Date.now();
      const process = spawn('maestro', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        env: MaestroRunner.getAugmentedEnv()
      });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout.on('data', (data) => {
        const text = data.toString();
        stdout += text;
        
        // Parse progress from Maestro output
        if (text.includes('Running')) {
          this.onProgress({ status: 'running', output: text });
        }
        if (text.includes('PASSED')) {
          this.onStep({ status: 'passed', output: text });
        }
        if (text.includes('FAILED')) {
          this.onStep({ status: 'failed', output: text });
        }
      });
      
      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      
      process.on('close', (code) => {
        const duration = Date.now() - startTime;
        
        // Parse results
        let result = {
          success: code === 0,
          exitCode: code,
          duration,
          flowPath,
          stdout,
          stderr
        };
        
        // Try to read JUnit output for detailed results
        try {
          if (fs.existsSync(outputFile)) {
            result.reportPath = outputFile;
          }
        } catch (e) {}
        
        // Clean up temp flow file
        try {
          fs.unlinkSync(flowPath);
        } catch (e) {}
        
        if (code !== 0) {
          this.onError({ code, stderr });
        }
        
        resolve(result);
      });
      
      // Timeout handling
      setTimeout(() => {
        process.kill();
        resolve({
          success: false,
          error: 'Test execution timed out',
          timeout: true,
          duration: this.timeout
        });
      }, this.timeout);
    });
  }
  
  /**
   * List available devices/emulators
   * @returns {Promise<Array>} List of devices
   */
  async listDevices() {
    return new Promise((resolve) => {
      if (this.platform === 'android') {
        try {
          const output = execSync('adb devices', { encoding: 'utf-8' });
          const devices = output
            .split('\n')
            .slice(1)
            .filter(line => line.trim() && !line.includes('offline'))
            .map(line => {
              const [id, status] = line.split('\t');
              return { id: id.trim(), status: status?.trim() || 'device', platform: 'android' };
            });
          resolve(devices);
        } catch (e) {
          resolve([]);
        }
      } else {
        // iOS simulators
        try {
          const output = execSync('xcrun simctl list devices available -j', { encoding: 'utf-8' });
          const data = JSON.parse(output);
          const devices = [];
          
          for (const [runtime, sims] of Object.entries(data.devices)) {
            for (const sim of sims) {
              if (sim.state === 'Booted' || sim.isAvailable) {
                devices.push({
                  id: sim.udid,
                  name: sim.name,
                  state: sim.state,
                  runtime,
                  platform: 'ios'
                });
              }
            }
          }
          resolve(devices);
        } catch (e) {
          resolve([]);
        }
      }
    });
  }
  
  /**
   * Start an Android emulator
   * @param {string} emulatorName - Name of the emulator
   * @returns {Promise<boolean>}
   */
  async startAndroidEmulator(emulatorName) {
    return new Promise((resolve) => {
      try {
        exec(`emulator -avd ${emulatorName}`, { stdio: 'ignore' });
        // Wait for emulator to boot
        setTimeout(() => {
          execSync('adb wait-for-device', { timeout: 60000 });
          resolve(true);
        }, 5000);
      } catch (e) {
        console.error('[Maestro] Failed to start emulator:', e.message);
        resolve(false);
      }
    });
  }
  
  /**
   * Start an iOS simulator
   * @param {string} simulatorId - UDID of the simulator
   * @returns {Promise<boolean>}
   */
  async startIOSSimulator(simulatorId) {
    return new Promise((resolve) => {
      try {
        execSync(`xcrun simctl boot ${simulatorId}`, { stdio: 'pipe' });
        execSync('open -a Simulator', { stdio: 'pipe' });
        resolve(true);
      } catch (e) {
        // May already be booted
        if (e.message.includes('current state: Booted')) {
          resolve(true);
        } else {
          console.error('[Maestro] Failed to start simulator:', e.message);
          resolve(false);
        }
      }
    });
  }

  /**
   * Take a screenshot from device/emulator
   * @param {string} [deviceId] - Specific device ID
   * @returns {Promise<{success: boolean, path?: string, filename?: string, error?: string}>}
   */
  async takeScreenshot(deviceId = null) {
    const timestamp = Date.now();
    const outputDir = this.outputDir || path.join(require('os').tmpdir(), 'flowstral-mobile');
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `screenshot_${timestamp}.png`);

    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        // Pull screenshot via adb
        execSync(`adb ${deviceArg} shell screencap -p /sdcard/flowstral_screen.png`, { stdio: 'pipe', timeout: 10000 });
        execSync(`adb ${deviceArg} pull /sdcard/flowstral_screen.png "${outputPath}"`, { stdio: 'pipe', timeout: 10000 });
        execSync(`adb ${deviceArg} shell rm /sdcard/flowstral_screen.png`, { stdio: 'pipe', timeout: 5000 });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl io ${simId} screenshot "${outputPath}"`, { stdio: 'pipe', timeout: 10000 });
      }
      return { success: true, path: outputPath, filename: `screenshot_${timestamp}.png` };
    } catch (e) {
      console.error('[Maestro] Screenshot failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Start device log capture (streaming)
   * @param {string} [deviceId] - Specific device ID
   * @param {string} [filter] - Log filter tag
   * @returns {import('child_process').ChildProcess} Spawned log process
   */
  startLogCapture(deviceId = null, filter = '') {
    if (this.platform === 'android') {
      const args = [];
      if (deviceId) args.push('-s', deviceId);
      args.push('logcat');
      if (filter) args.push(`${filter}:V`, '*:S');
      else args.push('-v', 'time');
      return spawn('adb', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } else {
      const simId = deviceId || 'booted';
      return spawn('xcrun', ['simctl', 'spawn', simId, 'log', 'stream', '--level', 'info'], { stdio: ['ignore', 'pipe', 'pipe'] });
    }
  }

  /**
   * Install an app on device
   * @param {string} appPath - Path to .apk or .ipa/.app file
   * @param {string} [deviceId] - Specific device ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async installApp(appPath, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} install -r "${appPath}"`, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl install ${simId} "${appPath}"`, { encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Install failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Uninstall an app from device
   * @param {string} bundleId - App bundle/package ID
   * @param {string} [deviceId] - Specific device ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async uninstallApp(bundleId, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} uninstall "${bundleId}"`, { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl uninstall ${simId} "${bundleId}"`, { encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Uninstall failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Get element hierarchy from device (for Inspector)
   * @param {string} [deviceId] - Specific device ID
   * @returns {Promise<{success: boolean, format?: string, data?: string, error?: string}>}
   */
  async getElementHierarchy(deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} shell uiautomator dump /sdcard/ui_dump.xml`, { stdio: 'pipe', timeout: 10000 });
        const xml = execSync(`adb ${deviceArg} shell cat /sdcard/ui_dump.xml`, { encoding: 'utf-8', timeout: 10000 });
        execSync(`adb ${deviceArg} shell rm /sdcard/ui_dump.xml`, { stdio: 'pipe', timeout: 5000 });
        return { success: true, format: 'xml', data: xml };
      } else {
        const simId = deviceId || 'booted';
        try {
          const output = execSync(`xcrun simctl ui ${simId} describe-all`, { encoding: 'utf-8', timeout: 15000 });
          return { success: true, format: 'text', data: output };
        } catch (e2) {
          return { success: false, error: 'iOS element hierarchy requires Xcode Accessibility Inspector' };
        }
      }
    } catch (e) {
      console.error('[Maestro] Element hierarchy failed:', e.message);
      return { success: false, error: e.message };
    }
  }
  // =========================================================================
  // Advanced Tools Methods (Deep Links, Push, Biometrics, Geo, Network, Config)
  // =========================================================================

  /**
   * Open a deep link / URL scheme on device
   * @param {string} url - Deep link URL (e.g. myapp://screen or https://app.com/deep)
   * @param {string} [deviceId] - Specific device ID
   */
  async openDeepLink(url, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} shell am start -a android.intent.action.VIEW -d "${url}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl openurl ${simId} "${url}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Deep link failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Send a push notification to device
   * Android: uses adb shell am broadcast, iOS: uses simctl push
   * @param {string} payload - JSON string of notification payload
   * @param {string} [bundleId] - App bundle ID (required for iOS)
   * @param {string} [deviceId] - Specific device ID
   */
  async sendPushNotification(payload, bundleId, deviceId = null) {
    try {
      if (this.platform === 'android') {
        // Android: send broadcast intent with extras
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        const parsed = JSON.parse(payload);
        const title = parsed.aps?.alert?.title || parsed.title || 'Test';
        const body = parsed.aps?.alert?.body || parsed.body || 'Test notification';
        execSync(`adb ${deviceArg} shell am broadcast -a com.google.android.c2dm.intent.RECEIVE --es title "${title}" --es body "${body}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
      } else {
        // iOS: write payload to temp file then push via simctl
        const simId = deviceId || 'booted';
        const appId = bundleId || this.appBundleId || 'com.example.app';
        const tmpFile = path.join(require('os').tmpdir(), `push_${Date.now()}.json`);
        fs.writeFileSync(tmpFile, payload, 'utf-8');
        execSync(`xcrun simctl push ${simId} "${appId}" "${tmpFile}"`, { encoding: 'utf-8', timeout: 10000, stdio: 'pipe' });
        try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore cleanup errors */ }
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Push notification failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Simulate biometric authentication result
   * @param {'success'|'failure'} result
   * @param {string} [deviceId]
   */
  async simulateBiometric(result, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        if (result === 'success') {
          execSync(`adb ${deviceArg} shell am broadcast -a android.intent.action.FINGERPRINT_AUTH --ei result 0`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        } else {
          execSync(`adb ${deviceArg} shell am broadcast -a android.intent.action.FINGERPRINT_AUTH --ei result 1`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        }
      } else {
        const simId = deviceId || 'booted';
        if (result === 'success') {
          execSync(`xcrun simctl spawn ${simId} notifyutil -p com.apple.BiometricKit.enrollmentChanged`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        } else {
          execSync(`xcrun simctl spawn ${simId} notifyutil -p com.apple.BiometricKit.lockout`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        }
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Biometric simulation failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set device geolocation
   * @param {number} latitude
   * @param {number} longitude
   * @param {string} [deviceId]
   */
  async setGeoLocation(latitude, longitude, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} emu geo fix ${longitude} ${latitude}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl location ${simId} set ${latitude},${longitude}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Geolocation set failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set network condition on device (Android emulator only for full throttle)
   * @param {object} profile - { download_kbps, upload_kbps, latency_ms }
   * @param {string} [deviceId]
   */
  async setNetworkCondition(profile, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        if (profile.download_kbps === 0) {
          // Airplane mode
          execSync(`adb ${deviceArg} shell svc wifi disable`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
          execSync(`adb ${deviceArg} shell svc data disable`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        } else {
          execSync(`adb ${deviceArg} shell svc wifi enable`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
          execSync(`adb ${deviceArg} shell svc data enable`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        }
      } else {
        const simId = deviceId || 'booted';
        // iOS: use Network Link Conditioner profiles
        const profileName = profile.download_kbps === 0 ? '100% Loss' : profile.download_kbps < 200 ? 'Very Bad Network' : profile.download_kbps < 2000 ? '3G' : 'Wi-Fi';
        execSync(`xcrun simctl spawn ${simId} log config --subsystem com.apple.network --mode level:debug`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        // Note: Full iOS network conditioning requires Network Link Conditioner in Settings
      }
      return { success: true, note: this.platform === 'ios' ? 'For full network throttling on iOS, use Network Link Conditioner in Simulator Settings' : undefined };
    } catch (e) {
      console.error('[Maestro] Network condition failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set device orientation
   * @param {'portrait'|'landscape'} orientation
   * @param {string} [deviceId]
   */
  async setOrientation(orientation, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        const accelVal = orientation === 'landscape' ? '0,9.77622,0.812349' : '9.77622,0.812349,0';
        execSync(`adb ${deviceArg} shell settings put system accelerometer_rotation 0`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        execSync(`adb ${deviceArg} shell settings put system user_rotation ${orientation === 'landscape' ? '1' : '0'}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      } else {
        // iOS simulator doesn't have a direct CLI orientation command — use AppleScript or Hardware menu
        // Simulate via Cmd+Left / Cmd+Right in the Simulator.app
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Orientation change failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set device appearance (dark/light mode)
   * @param {'light'|'dark'} mode
   * @param {string} [deviceId]
   */
  async setAppearance(mode, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        const uiMode = mode === 'dark' ? 'yes' : 'no';
        execSync(`adb ${deviceArg} shell cmd uimode night ${uiMode}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl ui ${simId} appearance ${mode}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Appearance change failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set device locale
   * @param {string} locale - e.g. "en-US", "ja-JP"
   * @param {string} [deviceId]
   */
  async setLocale(locale, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        const [lang, country] = locale.split('-');
        execSync(`adb ${deviceArg} shell setprop persist.sys.locale ${lang}-${country}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
        execSync(`adb ${deviceArg} shell setprop persist.sys.language ${lang}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      } else {
        const simId = deviceId || 'booted';
        // For iOS simulators, locale is set via defaults write
        execSync(`xcrun simctl spawn ${simId} defaults write .GlobalPreferences AppleLocale -string "${locale.replace('-', '_')}"`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      }
      return { success: true, note: 'App restart may be required for locale change to take effect' };
    } catch (e) {
      console.error('[Maestro] Locale change failed:', e.message);
      return { success: false, error: e.message };
    }
  }

  /**
   * Set font scale (accessibility)
   * @param {number} scale - e.g. 0.85, 1.0, 1.3, 1.5
   * @param {string} [deviceId]
   */
  async setFontScale(scale, deviceId = null) {
    try {
      if (this.platform === 'android') {
        const deviceArg = deviceId ? `-s ${deviceId}` : '';
        execSync(`adb ${deviceArg} shell settings put system font_scale ${scale}`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      } else {
        // iOS simulator font scale is controlled through Settings app, no CLI command
        // Set via accessibility defaults
        const simId = deviceId || 'booted';
        execSync(`xcrun simctl spawn ${simId} defaults write .GlobalPreferences UIPreferredContentSizeCategoryName -string "${scale >= 1.5 ? 'UICTContentSizeCategoryAccessibilityXL' : scale >= 1.3 ? 'UICTContentSizeCategoryXL' : scale <= 0.85 ? 'UICTContentSizeCategorySmall' : 'UICTContentSizeCategoryMedium'}"`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' });
      }
      return { success: true };
    } catch (e) {
      console.error('[Maestro] Font scale change failed:', e.message);
      return { success: false, error: e.message };
    }
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate Maestro flow file from QAAI steps
 * @param {Array} qaaiSteps 
 * @param {string} outputPath 
 * @param {object} options 
 * @returns {string} Path to generated file
 */
function generateFlowFile(qaaiSteps, outputPath, options = {}) {
  const flow = convertToMaestroFlow(qaaiSteps, options);
  const yamlContent = flowToYaml(flow);
  
  fs.writeFileSync(outputPath, yamlContent);
  return outputPath;
}

/**
 * Validate that Maestro can run
 * @returns {object} Validation result
 */
function validateMaestroSetup() {
  const result = {
    installed: MaestroRunner.isInstalled(),
    version: null,
    androidAvailable: false,
    iosAvailable: false,
    errors: []
  };
  
  if (result.installed) {
    result.version = MaestroRunner.getVersion();
    
    // Check Android
    try {
      execSync('adb --version', { stdio: 'pipe' });
      result.androidAvailable = true;
    } catch (e) {
      result.errors.push('Android SDK (adb) not found');
    }
    
    // Check iOS (macOS only)
    if (process.platform === 'darwin') {
      try {
        execSync('xcrun simctl list', { stdio: 'pipe' });
        result.iosAvailable = true;
      } catch (e) {
        result.errors.push('Xcode command line tools not found');
      }
    }
  } else {
    result.errors.push('Maestro not installed. Run: curl -Ls "https://get.maestro.mobile.dev" | bash');
  }
  
  return result;
}

module.exports = {
  MaestroRunner,
  convertToMaestroFlow,
  flowToYaml,
  generateFlowFile,
  validateMaestroSetup,
  QWORD_TO_MAESTRO
};
