/**
 * Unit Tests for Flowstral Recorder Engine
 * 
 * Run with: node recorder-engine.test.js
 * 
 * These tests verify that the shared recorder engine works correctly
 * for both web extension and desktop app.
 */

// Simple test framework (no dependencies)
const assert = {
  equal: (actual, expected, msg) => {
    if (actual !== expected) {
      throw new Error(`${msg || 'Assertion failed'}: expected ${expected}, got ${actual}`);
    }
  },
  ok: (value, msg) => {
    if (!value) {
      throw new Error(msg || 'Assertion failed: value is falsy');
    }
  },
  deepEqual: (actual, expected, msg) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`${msg || 'Deep equal failed'}: ${JSON.stringify(actual)} !== ${JSON.stringify(expected)}`);
    }
  }
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (e) {
    console.error(`✗ ${name}`);
    console.error(`  ${e.message}`);
    failed++;
  }
}

// Load the recorder engine
const Engine = require('./recorder-engine.js');

console.log('\n========== Recorder Engine Unit Tests ==========\n');

// ============================================================================
// APP SELECTOR CONFIG TESTS
// ============================================================================

test('AppSelectorConfig exists and has salesforce-lwc', () => {
  assert.ok(Engine.AppSelectorConfig, 'AppSelectorConfig should exist');
  assert.ok(Engine.AppSelectorConfig['salesforce-lwc'], 'Should have salesforce-lwc config');
  assert.equal(Engine.AppSelectorConfig['salesforce-lwc'].name, 'Salesforce LWC', 'Should have correct name');
});

test('AppSelectorConfig has all enterprise apps', () => {
  const requiredApps = [
    'salesforce-lwc', 'salesforce-aura', 'salesforce',
    'servicenow', 'workday', 'dynamics365', 'jira',
    'zendesk', 'hubspot', 'generic'
  ];
  for (const app of requiredApps) {
    assert.ok(Engine.AppSelectorConfig[app], `Should have ${app} config`);
  }
});

test('Salesforce LWC has correct strategies', () => {
  const config = Engine.AppSelectorConfig['salesforce-lwc'];
  assert.ok(config.strategies.length >= 5, 'Should have at least 5 strategies');
  
  // Check that name attribute is highest priority
  const nameStrategy = config.strategies.find(s => s.attr === 'name');
  assert.ok(nameStrategy, 'Should have name strategy');
  assert.equal(nameStrategy.priority, 100, 'Name should have priority 100');
});

test('Salesforce LWC has avoid patterns for dynamic IDs', () => {
  const config = Engine.AppSelectorConfig['salesforce-lwc'];
  assert.ok(config.avoidPatterns, 'Should have avoidPatterns');
  assert.ok(config.avoidPatterns.length >= 3, 'Should have at least 3 avoid patterns');
  
  // Test that lwc- pattern is avoided
  const lwcPattern = config.avoidPatterns.find(p => p.test('lwc-abc123'));
  assert.ok(lwcPattern, 'Should avoid lwc- dynamic IDs');
});

// ============================================================================
// ESCAPE FUNCTION TESTS
// ============================================================================

test('escapeSelector handles quotes and backslashes', () => {
  assert.equal(Engine.escapeSelector('test"value'), 'test\\"value');
  assert.equal(Engine.escapeSelector('test\\value'), 'test\\\\value');
  assert.equal(Engine.escapeSelector('normal'), 'normal');
});

test('escapeString handles single quotes', () => {
  assert.equal(Engine.escapeString("test'value"), "test\\'value");
  assert.equal(Engine.escapeString('normal'), 'normal');
});

// ============================================================================
// IS DYNAMIC TESTS
// ============================================================================

test('isDynamic detects pure numbers', () => {
  assert.ok(Engine.isDynamic('12345'), 'Pure numbers are dynamic');
  assert.ok(Engine.isDynamic('0'), 'Zero is dynamic');
});

test('isDynamic detects UUIDs', () => {
  assert.ok(Engine.isDynamic('a1b2c3d4-e5f6-7890-abcd-ef1234567890'), 'UUIDs are dynamic');
});

test('isDynamic detects LWC IDs', () => {
  assert.ok(Engine.isDynamic('lwc-abc123'), 'LWC IDs are dynamic');
  assert.ok(Engine.isDynamic('lwc-0'), 'LWC IDs are dynamic');
});

test('isDynamic accepts stable IDs', () => {
  assert.ok(!Engine.isDynamic('username'), 'username is stable');
  assert.ok(!Engine.isDynamic('Login'), 'Login is stable');
  assert.ok(!Engine.isDynamic('submit-btn'), 'submit-btn is stable');
});

// ============================================================================
// SMART SELECTOR TESTS
// ============================================================================

test('SmartSelector can be instantiated', () => {
  const selector = new Engine.SmartSelector();
  assert.ok(selector, 'SmartSelector should be instantiated');
  assert.equal(selector.currentApp, 'generic', 'Default app should be generic');
});

test('SmartSelector setApp works', () => {
  const selector = new Engine.SmartSelector();
  selector.setApp('salesforce-lwc');
  assert.equal(selector.currentApp, 'salesforce-lwc');
  assert.equal(selector.appConfig.name, 'Salesforce LWC');
});

test('SmartSelector handles invalid app gracefully', () => {
  const selector = new Engine.SmartSelector();
  selector.setApp('nonexistent-app');
  assert.equal(selector.currentApp, 'generic', 'Should stay on generic for invalid app');
});

// ============================================================================
// FIND INTERACTIVE ELEMENT TESTS
// ============================================================================

// Note: These tests would need a DOM environment (jsdom) to run properly
// For now, we test the function exists
test('findInteractiveElement function exists', () => {
  assert.ok(typeof Engine.findInteractiveElement === 'function', 'Should be a function');
});

test('findInteractiveElement returns target if no DOM', () => {
  const result = Engine.findInteractiveElement(null);
  assert.equal(result, null, 'Should return null for null input');
});

// ============================================================================
// IS GENERIC CONTAINER TESTS
// ============================================================================

test('isGenericContainer function exists', () => {
  assert.ok(typeof Engine.isGenericContainer === 'function', 'Should be a function');
});

// ============================================================================
// IS SENSITIVE FIELD TESTS
// ============================================================================

test('isSensitiveField detects password type', () => {
  const mockElement = { name: 'test', id: 'test', placeholder: '' };
  assert.ok(Engine.isSensitiveField(mockElement, 'password'), 'password type is sensitive');
});

test('isSensitiveField detects password in name', () => {
  const mockElement = { name: 'user_password', id: 'test', placeholder: '' };
  assert.ok(Engine.isSensitiveField(mockElement, 'text'), 'password in name is sensitive');
});

test('isSensitiveField detects secret in ID', () => {
  const mockElement = { name: 'test', id: 'api_secret', placeholder: '' };
  assert.ok(Engine.isSensitiveField(mockElement, 'text'), 'secret in id is sensitive');
});

test('isSensitiveField does not flag normal fields', () => {
  const mockElement = { name: 'username', id: 'email', placeholder: 'Enter email' };
  assert.ok(!Engine.isSensitiveField(mockElement, 'text'), 'username is not sensitive');
});

// ============================================================================
// GET FIELD LABEL TESTS
// ============================================================================

test('getFieldLabel function exists', () => {
  assert.ok(typeof Engine.getFieldLabel === 'function', 'Should be a function');
});

// ============================================================================
// INTERACTIVE SELECTORS CONSTANT
// ============================================================================

test('INTERACTIVE_SELECTORS includes all important selectors', () => {
  const selectors = Engine.INTERACTIVE_SELECTORS;
  assert.ok(selectors.includes('button'), 'Should include button');
  assert.ok(selectors.includes('a[href]'), 'Should include a[href]');
  assert.ok(selectors.includes('[role="button"]'), 'Should include role=button');
  assert.ok(selectors.includes('lightning-button'), 'Should include lightning-button (Salesforce)');
  assert.ok(selectors.includes('.slds-button'), 'Should include .slds-button (Salesforce)');
});

// ============================================================================
// PLAYWRIGHT SELECTOR GENERATION TESTS
// ============================================================================

test('Salesforce strategies generate correct Playwright selectors', () => {
  const config = Engine.AppSelectorConfig['salesforce-lwc'];
  const nameStrategy = config.strategies.find(s => s.attr === 'name');
  
  const playwright = nameStrategy.playwright('username');
  assert.equal(playwright, "locator('[name=\"username\"]')", 'Should generate correct locator');
});

test('Salesforce title strategy generates correct selector', () => {
  const config = Engine.AppSelectorConfig['salesforce-lwc'];
  const titleStrategy = config.strategies.find(s => s.attr === 'title');
  
  const playwright = titleStrategy.playwright('App Launcher');
  assert.equal(playwright, "locator('[title=\"App Launcher\"]')", 'Should generate correct title locator');
});

// ============================================================================
// SUMMARY
// ============================================================================

console.log('\n========== Test Summary ==========');
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);
console.log(`Total:  ${passed + failed}`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!\n');
}

