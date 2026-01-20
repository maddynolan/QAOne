/**
 * AI Vision Fallback Module
 * 
 * Provides AI-powered element finding as a last resort when all
 * deterministic strategies fail. Uses screenshot analysis to
 * locate elements by their visual description.
 * 
 * USAGE: Both PlaywrightRecorder and TestExecutor import this module
 * to ensure consistent AI fallback behavior.
 */

/**
 * Find element by description using AI vision
 * This is the LAST RESORT when all deterministic strategies fail
 * 
 * @param {Object} ctx - Context object with page, enableAIFallback, aiCallsThisRun, maxAICallsPerRun
 * @param {string} description - Human-readable element description
 * @param {string} actionType - 'click', 'fill', etc.
 * @returns {Promise<{x: number, y: number, confidence: number} | null>} - Coordinates or null
 */
async function findElementWithAI(ctx, description, actionType = 'click') {
  if (!ctx.enableAIFallback) {
    console.log('[AI Fallback] AI fallback is disabled');
    return null;
  }
  
  if ((ctx.aiCallsThisRun || 0) >= (ctx.maxAICallsPerRun || 5)) {
    console.log(`[AI Fallback] Budget exhausted (${ctx.aiCallsThisRun}/${ctx.maxAICallsPerRun} calls used)`);
    return null;
  }
  
  if (!ctx.page || ctx.page.isClosed()) {
    console.log('[AI Fallback] No page available');
    return null;
  }
  
  try {
    console.log(`[AI Fallback] 🤖 Attempting AI vision for: "${description}"`);
    ctx.aiCallsThisRun = (ctx.aiCallsThisRun || 0) + 1;
    
    // Take screenshot
    const screenshot = await ctx.page.screenshot({ type: 'png' });
    const screenshotBase64 = screenshot.toString('base64');
    
    // Get viewport dimensions (with fallback)
    let viewport = await ctx.page.viewportSize();
    if (!viewport) {
      viewport = await ctx.page.evaluate(() => ({
        width: window.innerWidth || document.documentElement.clientWidth || 1920,
        height: window.innerHeight || document.documentElement.clientHeight || 1080
      })).catch(() => ({ width: 1920, height: 1080 }));
    }
    
    // Try backend AI service first
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:8000';
    
    try {
      const response = await fetch(`${backendUrl}/api/ai/vision/find-element`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot_base64: screenshotBase64,
          description: description,
          action_type: actionType,
          viewport: viewport,
          context: {
            url: ctx.page.url(),
            title: await ctx.page.title()
          }
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        
        if (result.found && result.confidence > 0.7 && result.x && result.y) {
          console.log(`[AI Fallback] ✅ AI found element at (${result.x}, ${result.y}) with ${Math.round(result.confidence * 100)}% confidence`);
          return { x: result.x, y: result.y, confidence: result.confidence };
        }
      }
    } catch (e) {
      console.log('[AI Fallback] Backend AI service not available:', e.message);
    }
    
    // Fallback: OpenAI API directly if configured
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey) {
      const result = await callOpenAIVision(screenshotBase64, description, actionType, viewport, openaiKey);
      if (result) return result;
    }
    
    console.log('[AI Fallback] AI could not find the element');
    return null;
    
  } catch (error) {
    console.error('[AI Fallback] Error:', error.message);
    return null;
  }
}

/**
 * Call OpenAI Vision API directly
 */
async function callOpenAIVision(screenshotBase64, description, actionType, viewport, apiKey) {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a UI element locator. Given a screenshot and element description, return the PIXEL COORDINATES (x, y) of the CENTER of that element. 

IMPORTANT: Return ONLY a JSON object in this exact format:
{"found": true, "x": 123, "y": 456, "confidence": 0.9}

If you cannot find the element, return:
{"found": false, "x": null, "y": null, "confidence": 0}

The viewport is ${viewport.width}x${viewport.height} pixels. Coordinates must be within this range.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Find the element for "${actionType}" action: "${description}"`
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${screenshotBase64}` }
              }
            ]
          }
        ],
        max_tokens: 100
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      const content = result.choices?.[0]?.message?.content || '';
      
      // Parse JSON response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.found && parsed.x && parsed.y) {
          console.log(`[AI Fallback] ✅ OpenAI found element at (${parsed.x}, ${parsed.y})`);
          return { x: parsed.x, y: parsed.y, confidence: parsed.confidence || 0.8 };
        }
      }
    }
  } catch (e) {
    console.log('[AI Fallback] OpenAI API error:', e.message);
  }
  
  return null;
}

/**
 * Click at specific coordinates (used after AI finds element)
 */
async function clickAtCoordinates(page, x, y) {
  console.log(`[AI Fallback] Clicking at coordinates (${x}, ${y})`);
  await page.mouse.click(x, y);
  await page.waitForTimeout(200); // Let UI settle
}

/**
 * Fill at specific coordinates (click + type)
 */
async function fillAtCoordinates(page, x, y, value) {
  console.log(`[AI Fallback] Filling at coordinates (${x}, ${y}) with value`);
  await page.mouse.click(x, y);
  await page.waitForTimeout(100);
  await page.keyboard.type(value);
}

/**
 * Retry with exponential backoff - handles transient failures
 * @param {Function} fn - Async function to retry
 * @param {Object} options - { maxRetries, baseDelay, maxDelay, description }
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelay = 500,
    maxDelay = 5000,
    description = 'action'
  } = options;
  
  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        console.log(`[Retry] ${description} failed after ${maxRetries} attempts: ${error.message}`);
        throw error;
      }
      
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      console.log(`[Retry] ${description} attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

module.exports = {
  findElementWithAI,
  callOpenAIVision,
  clickAtCoordinates,
  fillAtCoordinates,
  retryWithBackoff
};
