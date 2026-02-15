/**
 * Sidepanel Data Constraints Management helpers
 * Extracted from SidebarController — loaded via <script> before sidepanel.js
 * These are standalone functions invoked by one-liner delegates in the class.
 */

/**
 * Open the constraints modal.
 * @param {object} ctx - SidebarController instance
 */
function spOpenConstraintsModal(ctx) {
  const modal = document.getElementById('constraintsModal');
  if (modal) {
    modal.style.display = 'flex';
    spLoadActiveConstraints(ctx);
  }
}

/**
 * Close the constraints modal.
 */
function spCloseConstraintsModal() {
  const modal = document.getElementById('constraintsModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

/**
 * Apply a preset constraint configuration.
 */
async function spApplyPreset(ctx, presetName) {
  const presets = {
    'adult18-35': {
      year: { minAge: 18, maxAge: 35, description: 'Age 18-35 years' },
      birthDate: { minAge: 18, maxAge: 35 }
    },
    'adult18-65': {
      year: { minAge: 18, maxAge: 65, description: 'Age 18-65 years' },
      birthDate: { minAge: 18, maxAge: 65 }
    },
    'senior65+': {
      year: { minAge: 65, maxAge: 100, description: 'Age 65+ years' },
      birthDate: { minAge: 65, maxAge: 100 }
    },
    'usStates': {
      state: {
        options: [
          'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
          'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
          'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
          'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
          'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
        ].map(s => ({ value: s, text: s })),
        description: 'All 50 US States'
      }
    }
  };

  const preset = presets[presetName];
  if (!preset) return;

  // Save constraints
  ctx.dataConstraints = { ...ctx.dataConstraints, ...preset };
  spSaveDataConstraints(ctx);

  // Update UI
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === presetName);
  });

  spLoadActiveConstraints(ctx);
  ctx.addLog('success', `Applied preset: ${presetName}`);
}

/**
 * Add a custom constraint from the modal form.
 */
function spAddConstraint(ctx) {
  const fieldType = document.getElementById('constraintFieldType')?.value;
  const minVal = document.getElementById('constraintMin')?.value;
  const maxVal = document.getElementById('constraintMax')?.value;

  if (!fieldType) {
    ctx.addLog('error', 'Please select a field type');
    return;
  }

  const constraint = {};
  if (minVal) {
    constraint.minAge = parseInt(minVal);
    constraint.min = parseInt(minVal);
  }
  if (maxVal) {
    constraint.maxAge = parseInt(maxVal);
    constraint.max = parseInt(maxVal);
  }

  if (Object.keys(constraint).length === 0) {
    ctx.addLog('error', 'Please enter min or max value');
    return;
  }

  constraint.description = `${fieldType}: ${minVal || '?'} - ${maxVal || '?'}`;

  // Save constraint
  if (!ctx.dataConstraints) ctx.dataConstraints = {};
  ctx.dataConstraints[fieldType] = constraint;
  spSaveDataConstraints(ctx);

  // Clear form
  document.getElementById('constraintFieldType').value = '';
  document.getElementById('constraintMin').value = '';
  document.getElementById('constraintMax').value = '';

  spLoadActiveConstraints(ctx);
  ctx.addLog('success', `Added rule for ${fieldType}`);
}

/**
 * Load and display active constraints.
 */
function spLoadActiveConstraints(ctx) {
  // Load from storage if not loaded
  if (!ctx.dataConstraints) {
    const stored = localStorage.getItem('qaai_sidebar_constraints');
    ctx.dataConstraints = stored ? JSON.parse(stored) : {};
  }

  const container = document.getElementById('activeConstraintsList');
  if (!container) return;

  const constraints = ctx.dataConstraints;
  const keys = Object.keys(constraints);

  if (keys.length === 0) {
    container.innerHTML = '<div style="color: rgba(255,255,255,0.5); font-size: 11px; padding: 8px;">No rules set</div>';
    return;
  }

  container.innerHTML = keys.map(key => {
    const c = constraints[key];
    let desc = c.description || '';
    if (!desc) {
      if (c.minAge || c.maxAge) {
        desc = `Age ${c.minAge || '?'} - ${c.maxAge || '?'}`;
      } else if (c.min || c.max) {
        desc = `${c.min || '?'} - ${c.max || '?'}`;
      } else if (c.options) {
        desc = `${c.options.length} options`;
      }
    }

    return `
      <div class="constraint-item">
        <span><strong>${key}</strong>: ${desc}</span>
        <button class="remove-btn" data-key="${key}" title="Remove">\u2715</button>
      </div>
    `;
  }).join('');

  // Add remove handlers
  container.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = e.target.dataset.key;
      delete ctx.dataConstraints[key];
      spSaveDataConstraints(ctx);
      spLoadActiveConstraints(ctx);
      ctx.addLog('info', `Removed rule for ${key}`);
    });
  });
}

/**
 * Save constraints to localStorage.
 */
function spSaveDataConstraints(ctx) {
  localStorage.setItem('qaai_sidebar_constraints', JSON.stringify(ctx.dataConstraints || {}));
}

/**
 * Get constraint for a field when generating data.
 */
function spGetDataConstraint(ctx, fieldType) {
  if (!ctx.dataConstraints) {
    const stored = localStorage.getItem('qaai_sidebar_constraints');
    ctx.dataConstraints = stored ? JSON.parse(stored) : {};
  }
  return ctx.dataConstraints[fieldType] || null;
}
