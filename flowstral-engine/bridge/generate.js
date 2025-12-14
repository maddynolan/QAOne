#!/usr/bin/env node
/**
 * Flowstral TypeScript Engine Bridge
 * Node.js script to generate Playwright scripts from session data
 * 
 * This script bridges Python Flowstral backend with TypeScript Flowstral Engine
 */

const fs = require('fs');
const path = require('path');

// Check if TypeScript engine is compiled
const distPath = path.join(__dirname, '..', 'dist');
if (!fs.existsSync(distPath)) {
  console.error(JSON.stringify({
    error: 'TypeScript Flowstral Engine not compiled. Run: cd flowstral-engine && npm run build',
    code: 'ENGINE_NOT_BUILT'
  }));
  process.exit(1);
}

// Try to import Flowstral Engine (compiled to JavaScript)
let FlowstralEngine, ApplicationDetector, PlaywrightScriptGenerator;
try {
  // Try CommonJS import
  const engineModule = require(path.join(distPath, 'core', 'FlowstralEngine.js'));
  FlowstralEngine = engineModule.FlowstralEngine || engineModule.default;
  
  const detectorModule = require(path.join(distPath, 'detection', 'ApplicationDetector.js'));
  ApplicationDetector = detectorModule.ApplicationDetector || detectorModule.default;
  
  const generatorModule = require(path.join(distPath, 'generator', 'PlaywrightScriptGenerator.js'));
  PlaywrightScriptGenerator = generatorModule.PlaywrightScriptGenerator || generatorModule.default;
} catch (error) {
  console.error(JSON.stringify({
    error: `Failed to import TypeScript engine: ${error.message}`,
    code: 'IMPORT_ERROR',
    hint: 'Make sure TypeScript engine is built: cd flowstral-engine && npm run build'
  }));
  process.exit(1);
}

/**
 * Main function to generate script from session data
 */
function generateScript(sessionDataPath) {
  const startTime = Date.now();
  
  try {
    // Read session data
    const sessionData = JSON.parse(fs.readFileSync(sessionDataPath, 'utf-8'));
    
    // Initialize engine
    const engine = new FlowstralEngine({
      generatePageObjects: false, // Disable for now, can enable later
      includeAutoHealing: true,
      includeComments: true,
      testFramework: 'playwright'
    });
    
    // Start session
    const sessionId = sessionData.sessionId || `session_${Date.now()}`;
    const context = engine.startSession(sessionId, sessionData.initialUrl || '');
    
    // Process detection if application is provided
    let fingerprint = null;
    if (sessionData.application && sessionData.application !== 'unknown') {
      fingerprint = engine.processDetectionResult(sessionId, {
        application: sessionData.application,
        confidence: 95,
        shadowDom: sessionData.application === 'salesforce' || 
                   sessionData.application === 'servicenow' ||
                   sessionData.application === 'workday'
      });
    } else {
      // Try to detect from nodes
      const detector = new ApplicationDetector();
      // For now, use default fingerprint
      fingerprint = {
        application: 'unknown',
        confidence: 0,
        shadowDomEnabled: false
      };
    }
    
    // Process nodes (actions and elements)
    const processedElements = new Map();
    const processedActions = [];
    
    for (const node of sessionData.nodes || []) {
      // Process element if present
      if (node.element) {
        const element = engine.processElement(sessionId, node.element);
        processedElements.set(element.id, element);
      }
      
      // Process action
      if (node.type && node.type !== 'navigate') {
        const action = engine.processAction(sessionId, {
          id: node.id,
          type: node.type,
          element: node.element, // Pass element object, not just ID
          timestamp: node.timestamp,
          value: node.value
        });
        processedActions.push(action);
      }
    }
    
    // End session and generate script
    // endSession() already generates the script internally
    const result = engine.endSession(sessionId);
    
    // Output result as JSON
    const output = {
      script: result.script || '',
      pageObject: result.pageObject || null,
      application: fingerprint?.application || sessionData.application || 'unknown',
      confidence: fingerprint?.confidence || 95,
      locatorStrategies: [], // Will be populated from script analysis if needed
      generationTimeMs: Date.now() - startTime,
      warnings: []
    };
    
    console.log(JSON.stringify(output, null, 2));
    
  } catch (error) {
    console.error(JSON.stringify({
      error: error.message,
      stack: error.stack
    }));
    process.exit(1);
  }
}

// Main execution
if (require.main === module) {
  const sessionDataPath = process.argv[2];
  if (!sessionDataPath) {
    console.error('Usage: node generate.js <session-data.json>');
    process.exit(1);
  }
  
  generateScript(sessionDataPath);
}

module.exports = { generateScript };

