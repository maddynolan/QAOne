/**
 * Safe Assertion Evaluator
 *
 * Replaces dangerous eval() usage in assertion expressions.
 * Supports comparison operations without arbitrary code execution.
 *
 * SECURITY: This module intentionally does NOT support:
 * - require() / import()
 * - process / child_process / fs access
 * - Function constructor
 * - __proto__ / constructor access
 * - Any form of code execution beyond simple comparisons
 */

'use strict';

const BLOCKED_PATTERNS = [
  'require', 'import', 'process', 'child_process', 'fs', 'eval',
  'Function', '__proto__', 'constructor', 'globalThis', 'window',
  'document', 'module', 'exports', 'Buffer', 'setTimeout',
  'setInterval', 'fetch', 'XMLHttpRequest', 'WebSocket'
];

function safeEvaluateAssertion(expression, context = {}) {
  if (!expression || typeof expression !== 'string') {
    return false;
  }

  const trimmed = expression.trim();

  // Security check: block dangerous patterns
  for (const pattern of BLOCKED_PATTERNS) {
    if (trimmed.includes(pattern)) {
      console.error(`[SafeAssert] BLOCKED: Expression contains forbidden pattern "${pattern}": ${trimmed}`);
      throw new Error(`Assertion expression contains forbidden pattern: ${pattern}`);
    }
  }

  // Block function calls (parentheses that aren't part of grouping)
  if (/[a-zA-Z_]\s*\(/.test(trimmed)) {
    console.error(`[SafeAssert] BLOCKED: Expression contains function call: ${trimmed}`);
    throw new Error('Assertion expressions cannot contain function calls');
  }

  // Try to parse as: <left> <operator> <right>
  const comparisonMatch = trimmed.match(
    /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/
  );

  if (comparisonMatch) {
    const [, leftStr, operator, rightStr] = comparisonMatch;
    const left = resolveValue(leftStr.trim(), context);
    const right = resolveValue(rightStr.trim(), context);

    switch (operator) {
      case '===': return left === right;
      case '!==': return left !== right;
      case '==': return left == right;
      case '!=': return left != right;
      case '>': return left > right;
      case '<': return left < right;
      case '>=': return left >= right;
      case '<=': return left <= right;
      default: return false;
    }
  }

  // Simple truthy check: just a variable name
  if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return !!resolveValue(trimmed, context);
  }

  // Negation: !variable
  if (/^!\s*[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    const varName = trimmed.replace(/^!\s*/, '');
    return !resolveValue(varName, context);
  }

  console.warn(`[SafeAssert] Could not parse expression: ${trimmed}`);
  return false;
}

function resolveValue(str, context) {
  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return parseFloat(str);
  }

  // Quoted string (single or double)
  if (/^["'].*["']$/.test(str)) {
    return str.slice(1, -1);
  }

  // Boolean literals
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (str === 'undefined') return undefined;

  // Variable from context
  if (context.hasOwnProperty(str)) {
    return context[str];
  }

  // Dot notation (e.g., result.status) - limited depth
  if (str.includes('.')) {
    const parts = str.split('.');
    if (parts.length <= 3) { // Max 3 levels deep
      let value = context;
      for (const part of parts) {
        if (value == null || typeof value !== 'object') return undefined;
        if (part === '__proto__' || part === 'constructor' || part === 'prototype') {
          throw new Error('Access to prototype chain is forbidden');
        }
        value = value[part];
      }
      return value;
    }
  }

  // Return as string if nothing else matches
  return str;
}

module.exports = { safeEvaluateAssertion, resolveValue };
