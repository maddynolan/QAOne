/**
 * Action validation and sanitization utilities for the recorder.
 * Pure functions for detecting cross-origin actions, password fields,
 * corrupted characters, and masking sensitive values.
 *
 * Extracted from PlaywrightRecorderPage.tsx.
 */

import type { RecordedAction } from '@/modules/recorder/types/recorder.types';

/** Detect cross-origin placeholder actions */
export const isCrossOriginAction = (action: RecordedAction): boolean => {
  const type = (action.type || action.qword || '').toLowerCase();
  const desc = (action.description || '').toLowerCase();
  return type === 'crossoriginplaceholder' ||
         type === 'crossorigin' ||
         desc.includes('external tab') ||
         desc.includes('cross-origin');
};

/** Check if running in Electron */
export const isElectron = () => !!(window as any).flowstral?.playwrightRecorder || !!(window as any).electronAPI;

/** Detect password-related fields */
export const isPasswordField = (action: RecordedAction): boolean => {
  const qword = (action.qword || '').toLowerCase();
  // CRITICAL: args[0] could be a number (e.g., tabIndex), not a string
  const arg0Raw = action.args?.[0];
  const arg0 = (typeof arg0Raw === 'string' ? arg0Raw : '').toLowerCase();
  const desc = (action.description || '').toLowerCase();
  const selector = JSON.stringify(action.selectorObj || {}).toLowerCase();

  // Check if this is a fill/input action on a password field
  const isInputAction = ['fill', 'type', 'input'].includes(qword);
  const hasPasswordIndicator =
    /password|passwd|pwd|^pw$|secret|token|pin/i.test(arg0) ||
    /password|passwd|pwd|secret|token|pin/i.test(desc) ||
    /type="password"|type='password'|inputtype.*password/i.test(selector) ||
    action.type === 'password';

  return isInputAction && hasPasswordIndicator;
};

/** Detect garbled/corrupted characters from password encoding */
export const hasPasswordArtifacts = (str: unknown): boolean => {
  // Ensure we have a string
  if (!str || typeof str !== 'string') return false;
  // Detect UTF-8 encoding artifacts common in password recording
  return /[āã口¢Γ¡¥©®°±²³µ¶¹º¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ]/.test(str) ||
         /[\u0100-\u024F]/.test(str) || // Extended Latin characters
         str.includes('ã') ||
         str.includes('Γ');
};

/** Mask sensitive values and fix corrupted characters */
export const maskSensitiveAction = (action: RecordedAction): RecordedAction => {
  const isPwField = isPasswordField(action);
  // Safely get args[1] - could be string, object, or undefined
  const arg1 = action.args?.[1];
  const arg1Str = typeof arg1 === 'string' ? arg1 : '';
  const hasArtifacts = hasPasswordArtifacts(arg1Str) ||
                       hasPasswordArtifacts(action.description || '');

  // If not a password field and no artifacts, return as-is
  if (!isPwField && !hasArtifacts) return action;

  // Mask the password value in args[1] and description
  const maskedArgs = [...(action.args || [])];
  if (maskedArgs[1]) {
    maskedArgs[1] = '••••••••';
  }

  // Build a clean description
  let maskedDesc = action.description || '';

  // Strategy 1: Replace any quoted values after the field name with mask
  maskedDesc = maskedDesc.replace(/["'][^"']+["']/g, (match, offset) => {
    // Only mask values after the field name (typically after offset 10)
    if (offset > 8) return `"••••••••"`;
    return match;
  });

  // Strategy 2: For "Type X" or "Fill field: X" patterns, mask the value part
  // Match patterns like "Type Tenet@123" -> "Type ••••••••"
  if (isPwField || hasArtifacts) {
    // Pattern: "Type <value>" without quotes
    maskedDesc = maskedDesc.replace(/^(Type|Fill|Input)\s+([^"'\s:]+)$/i, '$1 ••••••••');
    // Pattern: "Type '<value>'" or 'Fill "<value>"'
    maskedDesc = maskedDesc.replace(/^(Type|Fill|Input)\s+["']([^"']+)["']$/i, '$1 "••••••••"');
    // Pattern: "Fill 'field': <value>" without quotes on value
    maskedDesc = maskedDesc.replace(/^(Fill|Type)\s+["']([^"']+)["']:\s+(\S+)$/i, '$1 "$2": "••••••••"');
    // Pattern: "Type "value" into field"
    maskedDesc = maskedDesc.replace(/(into\s+\w+)$/i, '••••••••" $1');

    // Fallback: If description still has artifacts, fully rebuild it
    if (hasPasswordArtifacts(maskedDesc)) {
      const fieldName = action.args?.[0] || 'password';
      maskedDesc = `Fill "${fieldName}": "••••••••"`;
    }
  }

  return {
    ...action,
    args: maskedArgs,
    displayArgs: maskedArgs,
    description: maskedDesc
  };
};

/** Detect corrupted UTF-8 characters */
export const hasCorruptedChars = (str: string): boolean => {
  if (!str) return false;
  return /[āã口¢Γ]/.test(str);
};

/** Clean corrupted string or mask password */
export const cleanCorruptedString = (str: string, isPassword: boolean): string => {
  if (!str) return str;
  if (hasCorruptedChars(str) || isPassword) {
    return '••••••••';
  }
  return str;
};
