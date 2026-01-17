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
  constructor(options = {}) {
    this.platform = options.platform || 'android';
    this.appId = options.appId || null;
    this.deviceId = options.deviceId || null;
    this.timeout = options.timeout || 60000;
    this.outputDir = options.outputDir || path.join(process.cwd(), '.maestro-output');
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
      
      const args = ['studio'];
      if (deviceId || this.deviceId) {
        args.push('--device', deviceId || this.deviceId);
      }
      
      console.log(`[Maestro] Starting Studio: maestro ${args.join(' ')}`);
      
      this.studioProcess = spawn('maestro', args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: false
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
      execSync('maestro --version', { stdio: 'pipe' });
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
      return execSync('maestro --version', { encoding: 'utf-8' }).trim();
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
        stdio: ['ignore', 'pipe', 'pipe']
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
