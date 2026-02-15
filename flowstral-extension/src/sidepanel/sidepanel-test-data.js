/**
 * Sidepanel Test Data Generation helpers
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * These are standalone functions invoked by one-liner delegates in the class.
 */

/**
 * Generate synthetic test data for all form fields on the page.
 * @param {object} ctx - SidebarController instance (provides addLog, state, generatedTestData, etc.)
 */
async function spGenerateTestData(ctx) {
  ctx.addLog('info', '\u{1F3B2} Generating test data...');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      ctx.addLog('error', 'No active tab found');
      return;
    }

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: 'GENERATE_TEST_DATA'
    }, { frameId: 0 });

    if (response?.success && response.testData) {
      ctx.generatedTestData = response.testData;
      spRenderTestData(ctx, response.testData);
      ctx.addLog('success', `\u2705 Generated data for ${response.testData.length} fields`);
    } else {
      // Fallback: generate from suggestions if content script fails
      spGenerateTestDataFromSuggestions(ctx);
    }
  } catch (error) {
    console.error('[Sidebar] Generate test data error:', error);
    // Fallback: use suggestions
    spGenerateTestDataFromSuggestions(ctx);
  }
}

/**
 * Fallback: Generate test data from already collected suggestions.
 */
function spGenerateTestDataFromSuggestions(ctx) {
  const inputSuggestions = (ctx.state.suggestions || []).filter(s =>
    s.element === 'input' || s.actionType === 'fill'
  );

  if (inputSuggestions.length === 0) {
    ctx.addLog('warning', 'No input fields found. Run Refresh Analysis first.');
    return;
  }

  const testData = inputSuggestions.map(input => {
    const fieldType = spDetectFieldType(input);
    return {
      fieldName: input.text || input.label || 'field',
      fieldType: fieldType,
      selector: input.selectorObj?.playwright || input.selector,
      value: spGenerateValue(ctx, fieldType),
      alternatives: [
        spGenerateValue(ctx, fieldType),
        spGenerateValue(ctx, fieldType),
        spGenerateValue(ctx, fieldType)
      ],
      confidence: input.syntheticData?.confidence || 0.7
    };
  });

  ctx.generatedTestData = testData;
  spRenderTestData(ctx, testData);
  ctx.addLog('success', `\u2705 Generated data for ${testData.length} fields (from suggestions)`);
}

/**
 * Detect field type from input suggestion.
 */
function spDetectFieldType(input) {
  if (input.syntheticData?.detectedType) return input.syntheticData.detectedType;

  const text = `${input.text || ''} ${input.label || ''} ${input.name || ''}`.toLowerCase();

  if (/email/.test(text)) return 'email';
  if (/phone|tel|mobile/.test(text)) return 'phone';
  if (/first\s*name/.test(text)) return 'firstName';
  if (/last\s*name/.test(text)) return 'lastName';
  if (/name/.test(text) && !/user|company|org/.test(text)) return 'fullName';
  if (/password/.test(text)) return 'password';
  if (/company|org/.test(text)) return 'company';
  if (/street|address/.test(text)) return 'street';
  if (/city/.test(text)) return 'city';
  if (/state/.test(text)) return 'state';
  if (/zip|postal/.test(text)) return 'zipCode';
  // Date components - check BEFORE generic date
  if (/\bmonth\b|mes\b/.test(text)) return 'month';
  if (/\bday\b|dia\b/.test(text)) return 'day';
  if (/\byear\b|a\u00f1o\b/.test(text)) return 'year';
  if (/\bdob\b|birth\s*date|date.*birth/.test(text)) return 'birthDate';
  if (/gender|sex/.test(text)) return 'gender';
  if (/date/.test(text)) return 'date';
  if (/amount|price/.test(text)) return 'currency';

  return 'text';
}

/**
 * Generate a value for a field type.
 * @param {object} ctx - SidebarController instance (provides getDataConstraint)
 */
function spGenerateValue(ctx, fieldType) {
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const randomNum = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
  const currentYear = new Date().getFullYear();

  // Get any user-defined constraints for this field type
  const constraint = ctx.getDataConstraint(fieldType) || {};

  // If constraint has options (dropdown), pick from them
  if (constraint.options?.length > 0) {
    const opt = constraint.options[randomNum(0, constraint.options.length - 1)];
    return opt.value || opt.text || opt;
  }

  const generators = {
    email: () => `test.user${uniqueId}@example.com`,
    phone: () => `+1${randomNum(200, 999)}${randomNum(200, 999)}${randomNum(1000, 9999)}`,
    firstName: () => ['John', 'Jane', 'Michael', 'Sarah', 'David', 'Emily'][randomNum(0, 5)],
    lastName: () => ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia'][randomNum(0, 5)],
    fullName: () => `${generators.firstName()} ${generators.lastName()}`,
    username: () => `user_${uniqueId}`,
    password: () => `Test@${uniqueId}123!`,
    company: () => ['Acme Corp', 'TechStart Inc', 'Global Solutions'][randomNum(0, 2)],
    street: () => `${randomNum(100, 9999)} ${['Main St', 'Oak Ave', 'Maple Dr'][randomNum(0, 2)]}`,
    city: () => ['New York', 'Los Angeles', 'Chicago', 'Houston'][randomNum(0, 3)],
    state: () => {
      // Use constraint options if set, else default
      if (constraint.options) {
        const opt = constraint.options[randomNum(0, constraint.options.length - 1)];
        return opt.value || opt;
      }
      return ['CA', 'TX', 'FL', 'NY', 'PA'][randomNum(0, 4)];
    },
    zipCode: () => `${randomNum(10000, 99999)}`,
    // Date components with constraint support
    month: () => {
      const min = constraint.min || 1;
      const max = constraint.max || 12;
      return `${randomNum(min, max)}`;
    },
    day: () => {
      const min = constraint.min || 1;
      const max = constraint.max || 28;
      return `${randomNum(min, max)}`;
    },
    year: () => {
      // Use minAge/maxAge constraints
      const minAge = constraint.minAge || constraint.min || 18;
      const maxAge = constraint.maxAge || constraint.max || 65;
      return `${currentYear - randomNum(minAge, maxAge)}`;
    },
    birthDate: () => {
      const minAge = constraint.minAge || 18;
      const maxAge = constraint.maxAge || 65;
      const y = currentYear - randomNum(minAge, maxAge);
      const m = randomNum(1, 12).toString().padStart(2, '0');
      const d = randomNum(1, 28).toString().padStart(2, '0');
      return `${y}-${m}-${d}`;
    },
    gender: () => ['Male', 'Female', 'Other'][randomNum(0, 2)],
    age: () => {
      const min = constraint.minAge || constraint.min || 18;
      const max = constraint.maxAge || constraint.max || 80;
      return `${randomNum(min, max)}`;
    },
    date: () => new Date(Date.now() + randomNum(-365, 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    currency: () => {
      const min = constraint.min || 10;
      const max = constraint.max || 10000;
      return `${randomNum(min, max)}.${randomNum(0, 99).toString().padStart(2, '0')}`;
    },
    number: () => {
      const min = constraint.min || 1;
      const max = constraint.max || 1000;
      return `${randomNum(min, max)}`;
    },
    text: () => ['Test input', 'Sample data', 'Lorem ipsum', 'Test entry'][randomNum(0, 3)]
  };

  return (generators[fieldType] || generators.text)();
}

/**
 * Render test data in the UI.
 */
function spRenderTestData(ctx, testData) {
  const container = document.getElementById('testDataList');
  const section = document.getElementById('testDataSection');

  if (!container || !section) return;

  // Show section
  section.style.display = 'block';

  if (!testData || testData.length === 0) {
    container.innerHTML = '<div class="empty-state"><p>No test data generated</p></div>';
    return;
  }

  // Add "Fill All Fields" button at the top
  container.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
      <button class="btn btn-primary fill-all-btn" style="flex: 1; padding: 8px; font-size: 12px; background: linear-gradient(135deg, #8B5CF6, #38BDF8); border: none; border-radius: 6px; color: white; cursor: pointer;">
        \u2728 Fill All Fields on Page
      </button>
      <button class="btn btn-secondary add-all-steps-btn" style="flex: 1; padding: 8px; font-size: 12px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 6px; color: white; cursor: pointer;">
        + Add to Workflow
      </button>
    </div>
  ` + testData.map((data, idx) => `
    <div class="action-item" style="padding: 8px; margin-bottom: 6px; background: rgba(255,255,255,0.05); border-radius: 6px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 500; color: #fff; font-size: 12px;">
          ${ctx.escapeHtml(data.fieldName)}
        </span>
        <span style="font-size: 10px; background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px;">
          ${data.fieldType}
        </span>
      </div>
      <div style="display: flex; gap: 4px; align-items: center;">
        <input type="text" value="${ctx.escapeHtml(data.value)}"
               class="form-control test-data-input"
               data-index="${idx}"
               style="flex: 1; font-size: 11px; padding: 4px 8px;"
        />
        <button class="btn btn-sm regenerate-btn" data-index="${idx}" data-type="${data.fieldType}" title="Regenerate">\u{1F504}</button>
        <button class="btn btn-sm use-value-btn" data-index="${idx}" title="Use this value">\u2713</button>
      </div>
      ${data.confidence < 0.7 ? `<div style="font-size: 9px; color: rgba(255,255,255,0.4); margin-top: 2px;">\u26A0\uFE0F Low confidence detection</div>` : ''}
    </div>
  `).join('');

  // Add event listeners for regenerate buttons
  container.querySelectorAll('.regenerate-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.target.dataset.index);
      const fieldType = e.target.dataset.type;
      const newValue = spGenerateValue(ctx, fieldType);
      const input = container.querySelector(`input[data-index="${idx}"]`);
      if (input) {
        input.value = newValue;
        ctx.generatedTestData[idx].value = newValue;
      }
    });
  });

  // Add event listeners for use value buttons
  container.querySelectorAll('.use-value-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idx = parseInt(e.target.dataset.index);
      const data = ctx.generatedTestData[idx];
      const input = container.querySelector(`input[data-index="${idx}"]`);
      const value = input?.value || data.value;

      // Try to fill the field on the page
      await spFillFieldWithValue(ctx, data, value);
    });
  });

  // Add event listener for "Fill All Fields" button
  const fillAllBtn = container.querySelector('.fill-all-btn');
  if (fillAllBtn) {
    fillAllBtn.addEventListener('click', async () => {
      ctx.addLog('info', '\u2728 Filling all fields...');
      let filledCount = 0;
      let errorCount = 0;

      for (let idx = 0; idx < ctx.generatedTestData.length; idx++) {
        const data = ctx.generatedTestData[idx];
        const input = container.querySelector(`input[data-index="${idx}"]`);
        const value = input?.value || data.value;

        try {
          await spFillFieldWithValue(ctx, data, value);
          filledCount++;
          // Small delay between fills to allow page updates
          await new Promise(r => setTimeout(r, 100));
        } catch (e) {
          errorCount++;
        }
      }

      if (errorCount > 0) {
        ctx.addLog('warning', `Filled ${filledCount} fields, ${errorCount} failed`);
      } else {
        ctx.addLog('success', `\u2705 Filled all ${filledCount} fields!`);
      }
    });
  }

  // Add event listener for "Add to Workflow" button
  const addAllBtn = container.querySelector('.add-all-steps-btn');
  if (addAllBtn) {
    addAllBtn.addEventListener('click', () => {
      ctx.addLog('info', '\u2795 Adding all fields to workflow...');

      for (const data of ctx.generatedTestData) {
        // Add as input step to workflow
        ctx.addToWorkflow({
          type: 'fill',
          element: 'input',
          text: data.fieldName,
          label: data.fieldName,
          selector: data.selector,
          value: data.value,
          description: `Fill "${data.fieldName}" with test data`
        }, { value: data.value });
      }

      ctx.addLog('success', `\u2705 Added ${ctx.generatedTestData.length} input steps to workflow`);
    });
  }
}

/**
 * Fill a field on the page with the generated value.
 */
async function spFillFieldWithValue(ctx, fieldData, value) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    await chrome.tabs.sendMessage(tab.id, {
      type: 'FILL_FIELD',
      selector: fieldData.selector,
      value: value
    }, { frameId: 0 });

    ctx.addLog('success', `Filled "${fieldData.fieldName}" with value`);
  } catch (error) {
    console.error('[Sidebar] Fill field error:', error);
    ctx.addLog('error', 'Could not fill field: ' + error.message);
  }
}

/**
 * Copy test data as JSON.
 */
function spCopyTestDataAsJSON(ctx) {
  if (!ctx.generatedTestData || ctx.generatedTestData.length === 0) {
    ctx.addLog('warning', 'No test data to copy');
    return;
  }

  const jsonData = JSON.stringify(ctx.generatedTestData.map(d => ({
    field: d.fieldName,
    type: d.fieldType,
    value: d.value,
    selector: d.selector
  })), null, 2);

  navigator.clipboard.writeText(jsonData).then(() => {
    ctx.addLog('success', '\u{1F4CB} Test data copied to clipboard!');
  }).catch(err => {
    console.error('[Sidebar] Copy error:', err);
  });
}

/**
 * Download test data as CSV.
 */
function spDownloadTestDataAsCSV(ctx) {
  if (!ctx.generatedTestData || ctx.generatedTestData.length === 0) {
    ctx.addLog('warning', 'No test data to download');
    return;
  }

  // Build CSV content
  const headers = ['Field Name', 'Field Type', 'Value', 'Alt Value 1', 'Alt Value 2', 'Selector'];
  const rows = ctx.generatedTestData.map(d => [
    d.fieldName,
    d.fieldType,
    d.value,
    d.alternatives?.[0] || '',
    d.alternatives?.[1] || '',
    d.selector || ''
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // Download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `test_data_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  ctx.addLog('success', '\u{1F4E5} Test data downloaded as CSV!');
}

/**
 * Clear test data.
 */
function spClearTestData(ctx) {
  ctx.generatedTestData = [];
  const section = document.getElementById('testDataSection');
  const container = document.getElementById('testDataList');

  if (section) section.style.display = 'none';
  if (container) container.innerHTML = '';

  ctx.addLog('info', 'Test data cleared');
}
