/**
 * Test Execution Utilities
 *
 * Pure functions for converting test steps from Builder format
 * to Executor format (qword-based).
 */

/**
 * Convert a step from Builder format to Executor format (qword-based).
 *
 * Maps step types like 'navigate', 'click', 'fill' etc. to their
 * corresponding qword actions like 'GoTo', 'ClickText', 'Fill'.
 * Also builds the args array from step properties when not provided.
 */
export function convertStepToExecutorFormat(step: any): any {
  // If step has test_data, parse it to get the actual step object
  let actualStep = step;
  if (step.test_data && typeof step.test_data === 'string') {
    try {
      actualStep = { ...step, ...JSON.parse(step.test_data) };
    } catch (e) {
      console.warn('[Convert] Failed to parse test_data:', e);
    }
  }

  // Map Builder step types to Executor qword actions
  const typeToQword: Record<string, string> = {
    'navigate': 'GoTo',
    'goto': 'GoTo',
    'click': 'ClickText', // Default to ClickText for better compatibility
    'fill': 'Fill',
    'input': 'Fill',
    'type': 'Fill',
    'select': 'Select',
    'hover': 'Hover',
    'wait': 'Wait',
    'wait_for_element': 'WaitForElement',
    'wait_for_text': 'WaitForText',
    'assert': 'AssertText',
    'assert_text': 'AssertText',
    'assert_element': 'AssertElement',
    'screenshot': 'Screenshot',
    'press': 'Press',
    'keyboard': 'Press',
    'scroll': 'Scroll',
  };

  // Get the action type - check multiple possible properties
  // Priority: qword (recorder format) > type (builder format) > action
  const stepType = actualStep.qword || actualStep.type || 'unknown';
  let qword = actualStep.qword || typeToQword[stepType.toLowerCase()] || stepType;

  // If qword is still undefined/unknown, try to infer from name/description
  if (qword === 'unknown' || !qword) {
    const name = (actualStep.name || actualStep.description || '').toLowerCase();
    if (name.includes('navigate') || name.includes('goto') || name.includes('go to')) {
      qword = 'GoTo';
    } else if (name.includes('fill') || name.includes('type') || name.includes('input')) {
      qword = 'Fill';
    } else if (name.includes('click')) {
      qword = 'ClickText';
    } else if (name.includes('wait')) {
      qword = 'Wait';
    } else if (name.includes('assert')) {
      qword = 'AssertText';
    }
  }

  // Build args array based on step type
  let args: string[] = actualStep.args || [];
  if (args.length === 0) {
    // Build args from step properties
    if (qword === 'GoTo') {
      args = [actualStep.url || actualStep.value || ''];
    } else if (qword === 'Fill') {
      // Fill needs selector and value
      const selector = actualStep.selector || actualStep.selectorObj?.selector ||
                      actualStep.selectorObj?.name || actualStep.target || '';
      args = [selector, actualStep.value || ''];
    } else if (qword === 'ClickElement') {
      args = [actualStep.selector || actualStep.selectorObj?.selector || actualStep.target || ''];
    } else if (qword === 'ClickText') {
      // Extract text from name like 'Click "Log In"' or from target
      const name = actualStep.name || '';
      const textMatch = name.match(/[Cc]lick\s*"([^"]+)"/);
      const clickText = textMatch ? textMatch[1] : (actualStep.value || actualStep.text || actualStep.target || '');
      args = [clickText];
    } else if (qword === 'Wait') {
      args = [String(actualStep.waitTime || actualStep.value || 1000)];
    } else if (qword === 'AssertText') {
      args = [actualStep.value || actualStep.expectedResult || ''];
    } else if (qword === 'Select') {
      args = [actualStep.selector || actualStep.selectorObj?.selector || '', actualStep.value || ''];
    } else if (qword === 'Press') {
      args = [actualStep.value || actualStep.key || 'Enter'];
    }
  }

  const converted = {
    id: actualStep.id,
    qword: qword,
    type: stepType, // Keep original type as fallback
    args: args,
    selector: actualStep.selector,
    selectorObj: actualStep.selectorObj,
    value: actualStep.value,
    url: actualStep.url,
    enabled: actualStep.enabled !== false,
    description: actualStep.name || actualStep.description || `${qword} ${args[0] || ''}`,
    assertion: actualStep.assertion,
  };

  console.log('[Convert] Step:', actualStep.name, '-> qword:', converted.qword, 'args:', converted.args);
  return converted;
}
