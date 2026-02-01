/**
 * Reliability Layer - Eliminates False Positives and Failures
 * 
 * This layer wraps around SmartFinder and ActionHandlers to provide:
 * 1. Pre-Action Verification (element is truly actionable)
 * 2. Post-Action Verification (action actually succeeded)
 * 3. Visual Fingerprinting (screenshot-based verification)
 * 4. Smart Disambiguation (handles multiple matches intelligently)
 * 5. Auto-Recovery (handles common failure scenarios)
 * 6. Confidence Scoring (aggregates all signals)
 * 7. Fix Suggestions (actionable guidance when things fail)
 * 
 * @author Flowstral
 */

const crypto = require('crypto');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const CONFIG = {
  // Pre-action checks
  preAction: {
    checkVisible: true,
    checkEnabled: true,
    checkNotObscured: true,
    checkStable: true,          // Element not moving/animating
    checkInViewport: true,
    stabilityWaitMs: 150,       // Wait for element to stop moving
    obscuredCheckRetries: 3,
  },
  
  // Post-action verification
  postAction: {
    verifyStateChange: true,
    verifyNoErrors: true,
    verifyNoUnexpectedNavigation: true,
    stateChangeWaitMs: 500,
  },
  
  // Visual fingerprinting
  visual: {
    enabled: true,
    similarityThreshold: 0.85,  // 85% match required
    cropPadding: 5,             // Pixels around element to capture
  },
  
  // Disambiguation
  disambiguation: {
    maxCandidates: 10,
    preferVisible: true,
    preferInViewport: true,
    preferUnobscured: true,
    useVisualHint: true,
    useContextualPosition: true,
  },
  
  // Auto-recovery
  recovery: {
    dismissOverlays: true,
    handleAuthPrompts: true,
    retryOnStale: true,
    maxRetries: 3,
    retryDelayMs: 500,
  },
  
  // Confidence thresholds
  confidence: {
    minimum: 0.7,               // Below this, fail with suggestions
    warning: 0.85,              // Below this, log warning
    excellent: 0.95,            // Above this, very confident
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// PRE-ACTION VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Comprehensive pre-action verification
 * Ensures element is truly ready to be interacted with
 */
async function verifyElementActionable(page, locator, actionType = 'click') {
  const checks = {
    exists: false,
    visible: false,
    enabled: false,
    notObscured: false,
    stable: false,
    inViewport: false,
  };
  
  const issues = [];
  
  try {
    // 1. Check element exists
    const count = await locator.count();
    if (count === 0) {
      return { 
        actionable: false, 
        checks, 
        issues: ['Element not found in DOM'],
        suggestion: 'Element may not exist yet. Try adding a wait or checking the selector.'
      };
    }
    checks.exists = true;
    
    if (count > 1) {
      issues.push(`Multiple elements found (${count}). Using first match.`);
    }
    
    // 2. Check visibility
    const isVisible = await locator.first().isVisible().catch(() => false);
    if (!isVisible) {
      issues.push('Element exists but is not visible (display:none, visibility:hidden, or zero size)');
      return {
        actionable: false,
        checks,
        issues,
        suggestion: 'Element is hidden. Check if it needs to be revealed first (expand menu, scroll into view, etc.)'
      };
    }
    checks.visible = true;
    
    // 3. Check enabled (for inputs/buttons)
    const isEnabled = await locator.first().isEnabled().catch(() => true);
    if (!isEnabled) {
      issues.push('Element is disabled');
      if (actionType !== 'hover') {
        return {
          actionable: false,
          checks,
          issues,
          suggestion: 'Element is disabled. Check if a prerequisite step is needed to enable it.'
        };
      }
    }
    checks.enabled = true;
    
    // 4. Check not obscured by overlay
    const obscuredCheck = await checkNotObscured(page, locator.first());
    if (!obscuredCheck.clear) {
      issues.push(`Element is obscured by: ${obscuredCheck.obscuredBy}`);
      
      // Try to dismiss the overlay
      if (CONFIG.recovery.dismissOverlays) {
        const dismissed = await tryDismissOverlay(page, obscuredCheck.obscuredBy);
        if (dismissed) {
          issues.push('Overlay was auto-dismissed');
          checks.notObscured = true;
        } else {
          return {
            actionable: false,
            checks,
            issues,
            suggestion: `Element is covered by "${obscuredCheck.obscuredBy}". Add a step to close/dismiss this first.`,
            overlaySelector: obscuredCheck.overlaySelector
          };
        }
      }
    } else {
      checks.notObscured = true;
    }
    
    // 5. Check stability (not animating)
    const isStable = await checkElementStability(page, locator.first());
    if (!isStable) {
      issues.push('Element is still moving/animating');
      // Wait a bit more
      await page.waitForTimeout(CONFIG.preAction.stabilityWaitMs);
      const isStableNow = await checkElementStability(page, locator.first());
      if (!isStableNow) {
        return {
          actionable: false,
          checks,
          issues,
          suggestion: 'Element is animating. Add a longer wait or wait for animation to complete.'
        };
      }
    }
    checks.stable = true;
    
    // 6. Check in viewport
    const box = await locator.first().boundingBox();
    const viewport = page.viewportSize();
    const inViewport = box && 
      box.x >= -box.width && 
      box.y >= -box.height && 
      box.x < viewport.width + box.width && 
      box.y < viewport.height + box.height;
    
    if (!inViewport) {
      issues.push('Element is outside viewport');
      // Auto-scroll into view
      await locator.first().scrollIntoViewIfNeeded().catch(() => {});
      await page.waitForTimeout(200);
    }
    checks.inViewport = true;
    
    return {
      actionable: true,
      checks,
      issues,
      confidence: calculatePreActionConfidence(checks, issues)
    };
    
  } catch (error) {
    return {
      actionable: false,
      checks,
      issues: [...issues, `Error during verification: ${error.message}`],
      suggestion: 'Unexpected error during element verification. Check if page has loaded correctly.'
    };
  }
}

/**
 * Check if element is obscured by another element
 */
async function checkNotObscured(page, locator) {
  try {
    const box = await locator.boundingBox();
    if (!box) return { clear: false, obscuredBy: 'Element has no bounding box' };
    
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    
    const result = await page.evaluate(({ x, y }) => {
      const topElement = document.elementFromPoint(x, y);
      if (!topElement) return { clear: true };
      
      // Get the target element at this position
      const targetElement = topElement;
      
      // Check if it's a common overlay
      const overlayIndicators = [
        'modal', 'overlay', 'dialog', 'popup', 'backdrop', 
        'loading', 'spinner', 'toast', 'notification',
        'cookie', 'consent', 'banner'
      ];
      
      const tagName = targetElement.tagName.toLowerCase();
      const className = (targetElement.className || '').toLowerCase();
      const id = (targetElement.id || '').toLowerCase();
      const role = targetElement.getAttribute('role') || '';
      
      const isOverlay = overlayIndicators.some(ind => 
        className.includes(ind) || id.includes(ind) || role.includes('dialog')
      );
      
      if (isOverlay) {
        return {
          clear: false,
          obscuredBy: `${tagName}${id ? '#' + id : ''}${className ? '.' + className.split(' ')[0] : ''}`,
          overlaySelector: id ? `#${id}` : className ? `.${className.split(' ')[0]}` : tagName
        };
      }
      
      // Check if the element at point is the target or a child of target
      return { clear: true };
    }, { x: centerX, y: centerY });
    
    return result;
  } catch (e) {
    return { clear: true }; // Assume clear if check fails
  }
}

/**
 * Check if element position is stable (not animating)
 */
async function checkElementStability(page, locator) {
  try {
    const box1 = await locator.boundingBox();
    await page.waitForTimeout(100);
    const box2 = await locator.boundingBox();
    
    if (!box1 || !box2) return false;
    
    // Check if position changed
    const moved = Math.abs(box1.x - box2.x) > 2 || Math.abs(box1.y - box2.y) > 2;
    return !moved;
  } catch (e) {
    return true; // Assume stable if check fails
  }
}

/**
 * Try to dismiss common overlays
 */
async function tryDismissOverlay(page, overlayDescription) {
  const dismissStrategies = [
    // Cookie banners
    { selectors: ['[aria-label*="cookie" i] button', '[class*="cookie"] button:has-text("Accept")', '#onetrust-accept-btn-handler'], name: 'cookie' },
    // Close buttons
    { selectors: ['[aria-label="Close"]', '[aria-label="Dismiss"]', 'button:has-text("Close")', 'button:has-text("×")', '.close-button'], name: 'close' },
    // Escape key
    { action: 'escape', name: 'escape' },
    // Click backdrop
    { selectors: ['.modal-backdrop', '[class*="overlay"]:not(:has(button))'], click: 'edge', name: 'backdrop' },
  ];
  
  for (const strategy of dismissStrategies) {
    try {
      if (strategy.action === 'escape') {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
        // Check if overlay is gone
        const stillObscured = await checkNotObscured(page, page.locator('body'));
        if (stillObscured.clear) {
          console.log(`[Reliability] ✓ Dismissed overlay with Escape key`);
          return true;
        }
      } else if (strategy.selectors) {
        for (const selector of strategy.selectors) {
          const btn = page.locator(selector).first();
          if (await btn.count() > 0 && await btn.isVisible()) {
            if (strategy.click === 'edge') {
              // Click outside/edge of overlay
              const box = await btn.boundingBox();
              if (box) {
                await page.mouse.click(box.x + 5, box.y + 5);
              }
            } else {
              await btn.click({ timeout: 2000 });
            }
            await page.waitForTimeout(300);
            console.log(`[Reliability] ✓ Dismissed overlay with: ${selector}`);
            return true;
          }
        }
      }
    } catch (e) {
      // Try next strategy
    }
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// POST-ACTION VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verify that an action had the expected effect
 */
async function verifyActionSucceeded(page, actionType, context = {}) {
  const verification = {
    succeeded: true,
    checks: {},
    warnings: [],
  };
  
  try {
    // Check for error messages that appeared after action
    const errorCheck = await checkForNewErrors(page);
    if (errorCheck.hasError) {
      verification.warnings.push(`Error appeared after action: "${errorCheck.errorText}"`);
      // Don't fail immediately - some errors are expected (validation errors)
    }
    verification.checks.noNewErrors = !errorCheck.hasError;
    
    // Check for unexpected navigation
    if (context.expectedUrl && CONFIG.postAction.verifyNoUnexpectedNavigation) {
      const currentUrl = page.url();
      if (!currentUrl.includes(context.expectedUrl)) {
        verification.warnings.push(`Unexpected navigation to: ${currentUrl}`);
      }
    }
    
    // Action-specific verification
    switch (actionType) {
      case 'click':
        // For buttons, check if they triggered expected state change
        if (context.expectedStateChange) {
          await page.waitForTimeout(CONFIG.postAction.stateChangeWaitMs);
          // Caller provides verification function
        }
        break;
        
      case 'fill':
        // Verify the value was actually set
        if (context.locator && context.value !== undefined) {
          const actualValue = await context.locator.inputValue().catch(() => 
            context.locator.textContent().catch(() => '')
          );
          const valueSet = actualValue.includes(context.value) || 
                          context.value.includes(actualValue);
          verification.checks.valueSet = valueSet;
          if (!valueSet) {
            verification.succeeded = false;
            verification.warnings.push(`Value not set correctly. Expected "${context.value}", got "${actualValue}"`);
          }
        }
        break;
        
      case 'select':
        // Verify selection was made
        if (context.locator && context.value) {
          await page.waitForTimeout(300);
          const selectedText = await context.locator.textContent().catch(() => '');
          const selected = selectedText.toLowerCase().includes(context.value.toLowerCase());
          verification.checks.selectionMade = selected;
          if (!selected) {
            verification.warnings.push(`Selection may not have been made. Expected "${context.value}"`);
          }
        }
        break;
        
      case 'check':
      case 'uncheck':
        // Verify checkbox state
        if (context.locator) {
          const isChecked = await context.locator.isChecked().catch(() => null);
          const expectedState = actionType === 'check';
          if (isChecked !== null && isChecked !== expectedState) {
            verification.succeeded = false;
            verification.warnings.push(`Checkbox state incorrect. Expected ${expectedState}, got ${isChecked}`);
          }
          verification.checks.correctState = isChecked === expectedState;
        }
        break;
    }
    
    return verification;
    
  } catch (error) {
    verification.warnings.push(`Verification error: ${error.message}`);
    return verification;
  }
}

/**
 * Check for new error messages on page
 */
async function checkForNewErrors(page) {
  try {
    const errorSelectors = [
      '[role="alert"]',
      '.error-message',
      '.error',
      '[class*="error"]:not([class*="no-error"])',
      '.alert-danger',
      '.notification-error',
      '[data-testid="error"]',
    ];
    
    for (const selector of errorSelectors) {
      const errors = page.locator(selector);
      const count = await errors.count();
      
      for (let i = 0; i < count; i++) {
        const error = errors.nth(i);
        if (await error.isVisible()) {
          const text = await error.textContent().catch(() => '');
          if (text && text.trim().length > 0) {
            return { hasError: true, errorText: text.trim().substring(0, 100) };
          }
        }
      }
    }
    
    return { hasError: false };
  } catch (e) {
    return { hasError: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL FINGERPRINTING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Capture visual fingerprint of an element
 */
async function captureVisualFingerprint(page, locator) {
  try {
    const screenshot = await locator.screenshot({ 
      type: 'png',
      timeout: 5000 
    });
    
    // Create hash of screenshot for quick comparison
    const hash = crypto.createHash('md5').update(screenshot).digest('hex');
    
    // Get element dimensions for size comparison
    const box = await locator.boundingBox();
    
    return {
      hash,
      screenshot: screenshot.toString('base64'),
      width: box?.width || 0,
      height: box?.height || 0,
      timestamp: Date.now()
    };
  } catch (e) {
    return null;
  }
}

/**
 * Compare visual fingerprints
 */
function compareVisualFingerprints(fp1, fp2) {
  if (!fp1 || !fp2) return { match: false, similarity: 0 };
  
  // Quick hash comparison
  if (fp1.hash === fp2.hash) {
    return { match: true, similarity: 1.0 };
  }
  
  // Size comparison
  const sizeMatch = Math.abs(fp1.width - fp2.width) < 10 && 
                    Math.abs(fp1.height - fp2.height) < 10;
  
  // For more accurate comparison, would need pixel-level analysis
  // Using size as proxy for now
  const sizeSimilarity = sizeMatch ? 0.8 : 0.5;
  
  return {
    match: sizeSimilarity >= CONFIG.visual.similarityThreshold,
    similarity: sizeSimilarity
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SMART DISAMBIGUATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * When multiple elements match, pick the best one
 */
async function disambiguateMatches(page, locator, recipe = {}, visualFingerprint = null) {
  const count = await locator.count();
  if (count <= 1) return { locator: locator.first(), index: 0, confidence: 1.0 };
  
  console.log(`[Reliability] Disambiguating ${count} matches...`);
  
  const candidates = [];
  const maxCheck = Math.min(count, CONFIG.disambiguation.maxCandidates);
  
  for (let i = 0; i < maxCheck; i++) {
    const candidate = locator.nth(i);
    const score = await scoreCandidateForDisambiguation(page, candidate, recipe, visualFingerprint, i);
    candidates.push({ locator: candidate, index: i, ...score });
  }
  
  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);
  
  const best = candidates[0];
  const secondBest = candidates[1];
  
  // Check if the best is significantly better than second best
  const confidenceGap = secondBest ? best.score - secondBest.score : 0.5;
  const confidence = Math.min(1.0, best.score + (confidenceGap * 0.5));
  
  console.log(`[Reliability] Selected candidate ${best.index} with score ${best.score.toFixed(2)} (confidence: ${confidence.toFixed(2)})`);
  console.log(`[Reliability] Reasons: ${best.reasons.join(', ')}`);
  
  return {
    locator: best.locator,
    index: best.index,
    score: best.score,
    confidence,
    reasons: best.reasons,
    allCandidates: candidates.map(c => ({ index: c.index, score: c.score, reasons: c.reasons }))
  };
}

/**
 * Score a candidate element for disambiguation
 */
async function scoreCandidateForDisambiguation(page, locator, recipe, visualFingerprint, index) {
  let score = 0;
  const reasons = [];
  
  try {
    const viewport = page.viewportSize();
    const box = await locator.boundingBox().catch(() => null);
    
    // 1. Visibility (most important)
    const isVisible = await locator.isVisible().catch(() => false);
    if (isVisible) {
      score += 0.25;
      reasons.push('visible');
    }
    
    // 2. In viewport
    if (box && box.y >= 0 && box.y < viewport.height && box.x >= 0 && box.x < viewport.width) {
      score += 0.2;
      reasons.push('in-viewport');
    }
    
    // 3. Not obscured
    const obscured = await checkNotObscured(page, locator);
    if (obscured.clear) {
      score += 0.15;
      reasons.push('not-obscured');
    }
    
    // 4. Position matches recipe hint
    if (recipe.which?.position !== undefined) {
      if (index + 1 === recipe.which.position) {
        score += 0.15;
        reasons.push(`position-match(${recipe.which.position})`);
      }
    }
    
    // 5. Visual fingerprint match
    if (visualFingerprint && CONFIG.visual.enabled) {
      const currentFP = await captureVisualFingerprint(page, locator);
      const comparison = compareVisualFingerprints(visualFingerprint, currentFP);
      if (comparison.match) {
        score += 0.2;
        reasons.push(`visual-match(${(comparison.similarity * 100).toFixed(0)}%)`);
      }
    }
    
    // 6. Context match (nearby text)
    if (recipe.where?.nearText) {
      const parent = locator.locator('xpath=ancestor::*[position()<=3]').first();
      const parentText = await parent.textContent().catch(() => '');
      if (parentText.toLowerCase().includes(recipe.where.nearText.toLowerCase())) {
        score += 0.1;
        reasons.push('context-match');
      }
    }
    
    // 7. Prefer enabled elements
    const isEnabled = await locator.isEnabled().catch(() => true);
    if (isEnabled) {
      score += 0.05;
      reasons.push('enabled');
    }
    
    return { score, reasons };
    
  } catch (e) {
    return { score: 0, reasons: ['evaluation-failed'] };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIDENCE SCORING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate overall confidence for pre-action checks
 */
function calculatePreActionConfidence(checks, issues) {
  const weights = {
    exists: 0.3,
    visible: 0.25,
    enabled: 0.15,
    notObscured: 0.15,
    stable: 0.1,
    inViewport: 0.05,
  };
  
  let confidence = 0;
  for (const [check, passed] of Object.entries(checks)) {
    if (passed && weights[check]) {
      confidence += weights[check];
    }
  }
  
  // Penalize for issues
  confidence -= issues.length * 0.05;
  
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Aggregate confidence from all signals
 */
function aggregateConfidence(preAction, disambiguation, postAction) {
  const weights = {
    preAction: 0.4,
    disambiguation: 0.3,
    postAction: 0.3,
  };
  
  let total = 0;
  let weightSum = 0;
  
  if (preAction?.confidence !== undefined) {
    total += preAction.confidence * weights.preAction;
    weightSum += weights.preAction;
  }
  
  if (disambiguation?.confidence !== undefined) {
    total += disambiguation.confidence * weights.disambiguation;
    weightSum += weights.disambiguation;
  }
  
  if (postAction?.succeeded) {
    total += 1.0 * weights.postAction;
    weightSum += weights.postAction;
  } else if (postAction) {
    total += 0.5 * weights.postAction;
    weightSum += weights.postAction;
  }
  
  return weightSum > 0 ? total / weightSum : 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// FIX SUGGESTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate actionable fix suggestions based on failure type
 */
function generateFixSuggestions(failureContext) {
  const suggestions = [];
  
  const { type, details, recipe, elementInfo } = failureContext;
  
  switch (type) {
    case 'not-found':
      suggestions.push({
        title: 'Element not found',
        fixes: [
          'Add a wait step before this action',
          'Check if the page has fully loaded',
          'Verify the selector is correct for this page version',
          'Check if element is inside an iframe',
        ],
        quickFix: {
          type: 'add-wait',
          description: 'Add "Wait for element" step before this action',
        }
      });
      break;
      
    case 'not-visible':
      suggestions.push({
        title: 'Element exists but not visible',
        fixes: [
          'Add step to reveal element (expand accordion, open dropdown, etc.)',
          'Add scroll step to bring element into view',
          'Check if element is hidden behind a tab or menu',
        ],
        quickFix: {
          type: 'scroll-into-view',
          description: 'Add scroll step to reveal element',
        }
      });
      break;
      
    case 'obscured':
      suggestions.push({
        title: 'Element is covered by overlay',
        fixes: [
          `Close the ${details.obscuredBy || 'overlay'} before this action`,
          'Add wait for overlay to disappear',
          'Dismiss cookie banner or modal first',
        ],
        quickFix: {
          type: 'dismiss-overlay',
          description: 'Add step to close overlay',
          selector: details.overlaySelector,
        }
      });
      break;
      
    case 'multiple-matches':
      suggestions.push({
        title: `Multiple elements match (${details.count} found)`,
        fixes: [
          'Add more context to make selector unique',
          'Use position index if element order is stable',
          'Add parent context to narrow down',
          'Use a data-testid if available',
        ],
        quickFix: {
          type: 'add-context',
          description: 'Re-record with more specific selector',
          candidates: details.candidates,
        }
      });
      break;
      
    case 'action-failed':
      suggestions.push({
        title: 'Action did not have expected effect',
        fixes: [
          'Check if element is truly interactive',
          'Try clicking with force option',
          'Add delay before action',
          'Check for JavaScript errors preventing interaction',
        ],
        quickFix: {
          type: 'retry-with-options',
          description: 'Retry with force click and delay',
        }
      });
      break;
      
    case 'stale-element':
      suggestions.push({
        title: 'Element reference became stale',
        fixes: [
          'Re-find the element before each action',
          'Add wait for page to stabilize after navigation',
          'Check if page reloaded unexpectedly',
        ],
        quickFix: {
          type: 'refind-element',
          description: 'Automatically re-find element',
        }
      });
      break;
  }
  
  return suggestions;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WRAPPER FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute action with full reliability layer
 */
async function executeWithReliability(ctx, action, options = {}) {
  const { page, smartFinder } = ctx;
  const { locator, recipe, visualFingerprint } = options;
  
  const result = {
    success: false,
    confidence: 0,
    preAction: null,
    disambiguation: null,
    postAction: null,
    suggestions: [],
    retries: 0,
  };
  
  let currentLocator = locator;
  let retries = 0;
  
  while (retries <= CONFIG.recovery.maxRetries) {
    try {
      // PHASE 1: Pre-action verification
      result.preAction = await verifyElementActionable(page, currentLocator, action.type);
      
      if (!result.preAction.actionable) {
        result.suggestions = generateFixSuggestions({
          type: result.preAction.issues[0]?.includes('not found') ? 'not-found' :
                result.preAction.issues[0]?.includes('not visible') ? 'not-visible' :
                result.preAction.issues[0]?.includes('obscured') ? 'obscured' : 'unknown',
          details: result.preAction,
          recipe,
        });
        
        if (retries < CONFIG.recovery.maxRetries) {
          retries++;
          result.retries = retries;
          await page.waitForTimeout(CONFIG.recovery.retryDelayMs);
          continue;
        }
        
        return result;
      }
      
      // PHASE 2: Disambiguation if multiple matches
      const count = await currentLocator.count();
      if (count > 1) {
        result.disambiguation = await disambiguateMatches(page, currentLocator, recipe, visualFingerprint);
        currentLocator = result.disambiguation.locator;
        
        if (result.disambiguation.confidence < CONFIG.confidence.minimum) {
          result.suggestions = generateFixSuggestions({
            type: 'multiple-matches',
            details: { count, candidates: result.disambiguation.allCandidates },
            recipe,
          });
        }
      }
      
      // PHASE 3: Execute the action (caller does this)
      // The actual action execution is done by the caller
      // We just return the verified locator and confidence
      
      result.success = true;
      result.verifiedLocator = currentLocator;
      result.confidence = result.disambiguation?.confidence || result.preAction.confidence;
      
      return result;
      
    } catch (error) {
      if (error.message.includes('stale') && retries < CONFIG.recovery.maxRetries) {
        retries++;
        result.retries = retries;
        await page.waitForTimeout(CONFIG.recovery.retryDelayMs);
        // Re-find element
        if (smartFinder && recipe) {
          const refound = await smartFinder.find(recipe);
          if (refound.success) {
            currentLocator = refound.locator;
            continue;
          }
        }
      }
      
      result.error = error.message;
      result.suggestions = generateFixSuggestions({
        type: 'stale-element',
        details: { error: error.message },
        recipe,
      });
      
      return result;
    }
  }
  
  return result;
}

/**
 * Verify action after execution
 */
async function verifyAfterAction(ctx, action, locator, context = {}) {
  const result = await verifyActionSucceeded(ctx.page, action.type, {
    locator,
    value: action.value,
    ...context
  });
  
  if (!result.succeeded) {
    result.suggestions = generateFixSuggestions({
      type: 'action-failed',
      details: result,
    });
  }
  
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // Configuration
  CONFIG,
  
  // Pre-action
  verifyElementActionable,
  checkNotObscured,
  checkElementStability,
  tryDismissOverlay,
  
  // Post-action
  verifyActionSucceeded,
  verifyAfterAction,
  checkForNewErrors,
  
  // Visual fingerprinting
  captureVisualFingerprint,
  compareVisualFingerprints,
  
  // Disambiguation
  disambiguateMatches,
  
  // Confidence
  calculatePreActionConfidence,
  aggregateConfidence,
  
  // Fix suggestions
  generateFixSuggestions,
  
  // Main wrapper
  executeWithReliability,
};
