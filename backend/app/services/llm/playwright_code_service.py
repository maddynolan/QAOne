"""
Playwright Code Generation Service
Uses OpenAI to generate high-quality Playwright TypeScript code from action graphs.
Supports both OpenAI (cloud) and Ollama (local) providers with fallback.
"""

import logging
import json
import os
import time
import asyncio
import re
from typing import Dict, Any, Optional, Tuple

from app.services.llm.ollama_service import OllamaService
from app.services.llm.openai_service import get_openai_service
from app.services.automation.locator_engine import get_locator_engine
from app.services.automation.auto_healing_service import get_auto_healing_service
from app.services.automation.script_converter import get_script_converter
from app.services.automation.robust_element_discovery import (
    RobustElementDiscovery,
    ElementSignature,
    get_robust_element_discovery
)
from app.services.automation.intelligent_self_healing import (
    IntelligentSelfHealing,
    ElementContext,
    get_intelligent_self_healing
)

logger = logging.getLogger(__name__)


class PlaywrightCodeService:
    """
    Service for generating Playwright TypeScript code from action graphs using LLM.
    Supports both OpenAI (gpt-4o-mini) and Ollama (local models) providers.
    """
    
    def __init__(self):
        self.ollama_service = OllamaService()
        self.openai_service = get_openai_service()
        self.locator_engine = get_locator_engine()
        self.auto_healing_service = get_auto_healing_service()
        self.script_converter = get_script_converter()
        self.robust_discovery = get_robust_element_discovery()
        self.intelligent_healing = get_intelligent_self_healing()
        
        # Provider selection: "ollama", "openai", or "auto" (try OpenAI first, fallback to Ollama)
        self.provider = os.getenv("PLAYWRIGHT_LLM_PROVIDER", "auto").lower()
        
        logger.info(f"PlaywrightCodeService initialized with provider: {self.provider}")
        logger.info("✅ LocatorEngine, AutoHealingService, ScriptConverter, RobustDiscovery, and IntelligentHealing initialized")
        if self.provider == "openai" and not self.openai_service.is_available():
            logger.warning("OpenAI provider requested but not available - will fallback to Ollama")
        if self.provider == "ollama":
            logger.info("Using Ollama provider (local models) for Playwright generation")
        elif self.provider == "openai":
            logger.info("Using OpenAI provider (gpt-4o-mini) for Playwright generation")
        else:
            logger.info("Using auto provider selection (OpenAI first, Ollama fallback) for Playwright generation")
    
    def _build_prompts(self, action_graph: Dict[str, Any]) -> tuple[str, str]:
        """
        Build the prompts for LLM code generation.
        
        Returns:
            Tuple of (system_prompt, user_message)
        """
        system_prompt = """You are an expert Playwright test automation engineer following industry best practices.

Your job:
- Generate production-ready, executable Playwright TypeScript code from an action graph.
- Use @playwright/test framework with proper imports.
- Implement industry-standard locator strategies with auto-healing fallbacks.
- Add comprehensive assertions for each action to verify expected outcomes.
- Use best practices: explicit waits, proper error handling, Page Object Model principles.

LOCATOR STRATEGY (Industry Standard Priority):
1. data-testid attributes (HIGHEST PRIORITY - most stable)
2. ARIA attributes (aria-label, aria-labelledby, role)
3. Stable IDs (non-dynamic, semantic IDs)
4. Name attributes (for form elements)
5. Stable CSS selectors (semantic classes, not utility classes)
6. Text content (with :has-text() - use sparingly)
7. XPath (LAST RESORT - avoid if possible)

AUTO-HEALING REQUIREMENTS:
- Implement fallback locator chains for each element
- Use try-catch blocks to handle locator failures
- Try fallback locators automatically if primary fails
- Log which locator succeeded for future optimization
- Handle overlays/modals/loading spinners that intercept clicks
- Wait for overlays to disappear before clicking elements
- Use force: true as last resort for stubborn overlays

CODE REQUIREMENTS:
- Use async/await syntax throughout
- Add explicit waits: await element.waitFor({ state: 'visible' })
- Include expect() assertions for each action
- Handle errors gracefully with try-catch
- Use descriptive test names and comments
- Implement Page Object Model principles (extract selectors)
- Add screenshots on failure: await page.screenshot({ path: 'screenshot.png' })
- Use proper timeout values (default: 30s, explicit: 5s for waits)

BEST PRACTICES:
- Use page.locator() instead of page.$() or page.$$()
- Prefer getByRole(), getByLabel(), getByText() when possible
- Use data-testid for test-specific elements
- Avoid hard-coded waits (page.waitForTimeout) - use waitFor instead
- Group related actions in logical blocks
- Add comments explaining complex flows
- Use fixtures for test setup/teardown when appropriate

Return ONLY valid TypeScript code (no markdown, no code blocks, no explanations).
Start directly with: import { test, expect } from '@playwright/test';"""

        # Format action graph for prompt (limit size to avoid token limits)
        graph_summary = self._summarize_action_graph(action_graph)
        
        # Generate optimal locators for each edge using LocatorEngine
        enhanced_edges = []
        for edge in graph_summary.get("edges", []):
            # Extract element info from edge
            selector = edge.get("locators") or ""
            action_type = edge.get("action_type", "")
            target_text = edge.get("description", "") or ""
            
            # Generate optimal locators with fallbacks
            if selector:
                try:
                    # Parse selector to extract element info
                    locator_info = self.locator_engine.generate_optimal_locator(
                        element_html=f'<element selector="{selector}">',
                        element_text=target_text,
                        element_attributes={"selector": selector},
                        context={"action": action_type}
                    )
                    
                    # Add locator info to edge
                    edge["optimal_locators"] = {
                        "primary": locator_info.get("primary"),
                        "fallbacks": locator_info.get("fallbacks", [])[:3],  # Limit to 3 fallbacks
                        "strategy": locator_info.get("strategy"),
                        "confidence": locator_info.get("confidence")
                    }
                    logger.debug(f"Generated optimal locators for {selector}: {edge['optimal_locators']}")
                except Exception as e:
                    logger.warning(f"Failed to generate optimal locator for {selector}: {e}")
                    edge["optimal_locators"] = {"primary": selector, "fallbacks": []}
            else:
                edge["optimal_locators"] = {"primary": "", "fallbacks": []}
            
            enhanced_edges.append(edge)
        
        graph_summary["edges"] = enhanced_edges
        
        user_message = f"""Generate a complete Playwright test script from this action graph with ROBUST SELECTORS and AUTO-HEALING:

{json.dumps(graph_summary, indent=2)}

CRITICAL REQUIREMENTS (MUST FOLLOW):
1. ALWAYS use clickWithFallback() and fillWithFallback() helper functions
   - NEVER use page.click() or page.fill() directly
   - These functions handle overlays, modals, and fallback locators automatically

2. Include these helper functions at the top of your code:
   - waitForOverlaysToDisappear() - waits for ReactModal, ModalDrawer, overlays, etc.
   - clickWithFallback() - handles clicks with overlay detection and force click fallback
   - fillWithFallback() - handles form fills with overlay detection

3. For EACH click/fill action:
   - Use clickWithFallback(page, [primary_locator, ...fallbacks]) instead of page.click()
   - Use fillWithFallback(page, [primary_locator, ...fallbacks], value) instead of page.fill()
   - Use optimal_locators from the edges provided

4. Overlay handling:
   - Detect ReactModal__Overlay, ModalDrawer, Dialog components
   - Wait for them to disappear before clicking
   - Use force: true if click is intercepted

5. Other requirements:
   - Create a single test() block with descriptive name
   - Include all user interactions (clicks, types, selects, navigations)
   - Add comprehensive assertions (expect) to verify each step
   - Handle navigation between pages with proper waits
   - Include error handling with try-catch blocks
   - Add screenshots on failure
   - Use explicit waits (waitFor) instead of hard-coded timeouts

Example structure:
```typescript
import {{ test, expect }} from '@playwright/test';

test('Descriptive Test Name', async ({{ page }}) => {{
  // Navigation with wait
  await page.goto('url');
  await expect(page).toHaveURL('expected-url');
  
  // Element interaction with auto-healing
  const element = await getElementWithFallback(page, [
    '[data-testid="button"]',  // Primary
    '[aria-label="Button"]',   // Fallback 1
    'button:has-text("Click")' // Fallback 2
  ]);
  await element.click();
  await expect(element).toBeVisible();
  
  // Assertions after each action
  // Error handling
  // Screenshots on failure
}});
```"""
        
        return system_prompt, user_message
    
    def _summarize_action_graph(self, action_graph: Dict[str, Any]) -> Dict[str, Any]:
        """Summarize action graph to reduce token usage while keeping essential info."""
        nodes = action_graph.get("nodes", [])[:50]  # Limit to first 50 nodes
        edges = action_graph.get("edges", [])[:50]  # Limit to first 50 edges
        
        # Extract only essential fields
        summarized_nodes = []
        for node in nodes:
            summarized_nodes.append({
                "id": node.get("id"),
                "event_type": node.get("event_type"),
                "url": node.get("url"),
                "target_selector": node.get("target_selector"),
                "target_text": node.get("target_text"),
                "action_description": node.get("action_description")
            })
        
        summarized_edges = []
        for edge in edges:
            summarized_edges.append({
                "from_node_id": edge.get("from_node_id"),
                "to_node_id": edge.get("to_node_id"),
                "action": edge.get("action"),
                "action_type": edge.get("action_type"),
                "locators": edge.get("locators", {}).get("primary") if edge.get("locators") else None
            })
        
        return {
            "nodes": summarized_nodes,
            "edges": summarized_edges,
            "total_nodes": len(action_graph.get("nodes", [])),
            "total_edges": len(action_graph.get("edges", []))
        }
    
    async def generate_playwright_code(
        self,
        action_graph: Dict[str, Any],
        test_name: str = "Flowstral Recorded Test",
        timeout: float = 60.0,
        provider: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate Playwright TypeScript code from action graph using LLM.
        
        Args:
            action_graph: Action graph dictionary
            test_name: Name for the test
            timeout: Timeout in seconds
            provider: Override provider selection ("ollama", "openai", "auto")
            
        Returns:
            Dict with:
                - code: Generated Playwright code
                - provider: Provider used
                - model: Model used
                - latency_ms: Generation time in milliseconds
                - tokens_used: Tokens used (if available)
                - cost_usd: Cost in USD (if available)
        """
        start_time = time.time()
        provider_used = provider or self.provider
        metrics = {
            "provider": None,
            "model": None,
            "latency_ms": 0.0,
            "tokens_used": None,
            "cost_usd": None,
            "success": False
        }
        
        try:
            # Build prompts
            system_prompt, user_message = self._build_prompts(action_graph)
            
            # Determine which provider to use (check availability dynamically)
            use_openai = False
            openai_available = self.openai_service.is_available()
            
            if provider_used == "openai":
                if not openai_available:
                    logger.warning("OpenAI provider requested but not available - falling back to Ollama")
                use_openai = openai_available
            elif provider_used == "auto":
                # Try OpenAI first if available, fallback to Ollama
                use_openai = openai_available
                if use_openai:
                    logger.info("[AUTO] OpenAI is available, using OpenAI for Playwright generation")
                else:
                    logger.info("[AUTO] OpenAI not available, using Ollama for Playwright generation")
            
            # Call appropriate provider
            response_text = ""
            if use_openai and openai_available:
                logger.info("Using OpenAI (gpt-4o-mini) to generate Playwright code")
                try:
                    # For Playwright code, we need text output, not JSON
                    # Use a modified version of rewrite_test_case that returns text
                    result = await self._call_openai_for_code(
                        system_prompt=system_prompt,
                        user_message=user_message,
                        timeout=timeout
                    )
                    
                    response_text = result.get("response", "")
                    metrics.update({
                        "provider": "openai",
                        "model": result.get("model", "gpt-4o-mini"),
                        "latency_ms": result.get("latency_ms", 0.0),
                        "tokens_used": result.get("tokens_used"),
                        "cost_usd": result.get("cost_usd"),
                        "success": True
                    })
                    
                except Exception as e:
                    logger.warning(f"OpenAI generation failed: {e}, falling back to Ollama")
                    # Fallback to Ollama
                    use_openai = False
            
            if not use_openai:
                # Use Ollama
                logger.info("Using Ollama to generate Playwright code")
                full_prompt = f"{system_prompt}\n\n{user_message}"
                
                # Add explicit timeout to prevent hanging
                try:
                    result = await asyncio.wait_for(
                        self.ollama_service.generate(
                            prompt=full_prompt,
                            mode="quick",
                            validate_json=False,
                            use_fast_model=True,  # Use 7B model for speed
                            task_type="automation"
                        ),
                        timeout=timeout
                    )
                except asyncio.TimeoutError:
                    logger.error(f"Ollama generation timed out after {timeout}s")
                    raise TimeoutError(f"Ollama API call timed out after {timeout}s")
                
                response_text = result.get("response", "")
                metrics.update({
                    "provider": "ollama",
                    "model": result.get("model", "qwen2.5-coder:7b"),
                    "latency_ms": result.get("latency_ms", (time.time() - start_time) * 1000),
                    "tokens_used": result.get("tokens_used"),
                    "success": True
                })
            
            if not response_text:
                raise ValueError("LLM returned empty response")
            
            # Clean up the response (remove markdown code blocks if present)
            code = self._extract_code_from_response(response_text)
            
            # Validate code structure
            if not self._validate_playwright_code(code):
                logger.warning("Generated code failed validation, attempting to fix...")
                code = self._fix_playwright_code(code, action_graph)
            
            # Add metrics
            metrics["latency_ms"] = (time.time() - start_time) * 1000
            
            logger.info(
                f"✅ Successfully generated Playwright code "
                f"({metrics['provider']}, {metrics['latency_ms']:.0f}ms, "
                f"{metrics.get('tokens_used', 'N/A')} tokens)"
            )
            
            return {
                "code": code,
                "test_name": test_name,
                "metrics": metrics
            }
            
        except Exception as e:
            metrics["success"] = False
            metrics["latency_ms"] = (time.time() - start_time) * 1000
            logger.error(f"Failed to generate Playwright code: {e}", exc_info=True)
            raise
    
    async def _call_openai_for_code(
        self,
        system_prompt: str,
        user_message: str,
        timeout: float = 60.0
    ) -> Dict[str, Any]:
        """Call OpenAI API for code generation (text output, not JSON)."""
        if not self.openai_service.is_available():
            raise ValueError("OpenAI service not available")
        
        start_time = time.time()
        
        try:
            # Call OpenAI API with timeout (text output, not JSON)
            response = await asyncio.wait_for(
                self.openai_service._client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message}
                    ],
                    temperature=0.2,
                    max_tokens=4000,  # Larger for code generation
                ),
                timeout=timeout
            )
            
            latency_ms = (time.time() - start_time) * 1000
            
            # Extract response
            content = response.choices[0].message.content
            usage = response.usage
            
            # Calculate cost
            input_tokens = usage.prompt_tokens if usage else 0
            output_tokens = usage.completion_tokens if usage else 0
            total_tokens = usage.total_tokens if usage else 0
            
            cost_usd = (
                (input_tokens / 1_000_000) * 0.15 +
                (output_tokens / 1_000_000) * 0.60
            )
            
            logger.info(
                f"OpenAI code generation completed: model=gpt-4o-mini, "
                f"tokens={total_tokens} (in={input_tokens}, out={output_tokens}), "
                f"latency={latency_ms:.0f}ms, cost=${cost_usd:.6f}"
            )
            
            return {
                "response": content,
                "model": "gpt-4o-mini",
                "provider": "openai",
                "tokens_used": total_tokens,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "latency_ms": latency_ms,
                "cost_usd": cost_usd
            }
            
        except asyncio.TimeoutError:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"OpenAI API call timed out after {timeout}s")
            raise TimeoutError(f"OpenAI API call timed out after {timeout}s")
        except Exception as e:
            latency_ms = (time.time() - start_time) * 1000
            logger.error(f"OpenAI API call failed: {e}", exc_info=True)
            raise
    
    def _extract_code_from_response(self, response: str) -> str:
        """Extract code from LLM response (remove markdown code blocks if present)."""
        # Try to extract code from markdown code blocks
        code_match = re.search(
            r'```(?:typescript|ts|javascript|js)?\s*(.*?)\s*```',
            response,
            re.DOTALL
        )
        if code_match:
            code = code_match.group(1).strip()
        else:
            # If no code block, return as-is (might already be code)
            code = response.strip()
        
        # Sanitize code to fix common syntax errors
        code = self._sanitize_playwright_code(code)
        
        return code
    
    def _sanitize_playwright_code(self, code: str) -> str:
        """Fix common syntax errors in generated Playwright code."""
        # Fix malformed text= locators: "text="Black Friday Deals"" -> getByText("Black Friday Deals").first()
        # Pattern: page.click("text="...""") or page.click('text="..."')
        # Handle single closing quote
        text_locator_pattern = r'page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        
        def replace_text_locator(match):
            quote_char = match.group(1)
            text_content = match.group(2)
            # Convert to getByText() call with .first() to handle multiple matches
            return f'page.getByText({quote_char}{text_content}{quote_char}).first().click()'
        
        code = re.sub(text_locator_pattern, replace_text_locator, code)
        
        # Handle double closing quotes: "text="text""
        text_locator_pattern_double = r'page\.click\(["\']text=(["\'])([^"\']+)\1\1["\']\)'
        def replace_text_locator_double(match):
            quote_char = match.group(1)
            text_content = match.group(2)
            return f'page.getByText({quote_char}{text_content}{quote_char}).first().click()'
        code = re.sub(text_locator_pattern_double, replace_text_locator_double, code)
        
        # Handle with await prefix
        text_locator_pattern_await = r'await\s+page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        def replace_text_locator_await(match):
            quote_char = match.group(1)
            text_content = match.group(2)
            return f'await page.getByText({quote_char}{text_content}{quote_char}).first().click()'
        code = re.sub(text_locator_pattern_await, replace_text_locator_await, code)
        
        # Handle with await and double closing quotes
        text_locator_pattern_await_double = r'await\s+page\.click\(["\']text=(["\'])([^"\']+)\1\1["\']\)'
        def replace_text_locator_await_double(match):
            quote_char = match.group(1)
            text_content = match.group(2)
            return f'await page.getByText({quote_char}{text_content}{quote_char}).first().click()'
        code = re.sub(text_locator_pattern_await_double, replace_text_locator_await_double, code)
        
        # Fix other malformed text= patterns in different contexts
        # Pattern: locator("text="...""") -> getByText("...")
        text_locator_pattern2 = r'\.(?:click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\1["\']\)'
        code = re.sub(text_locator_pattern2, lambda m: f'.getByText({m.group(1)}{m.group(2)}{m.group(1)}).{m.group(0).split("(")[0].split(".")[-1]}()', code)
        
        # Fix nested quote issues: "text="..." -> getByText("...")
        # More general pattern for text= with nested quotes
        nested_text_pattern = r'["\']text=(["\'])([^"\']+)\1["\']'
        def fix_nested_text(match):
            inner_quote = match.group(1)
            text = match.group(2)
            return f'{inner_quote}{text}{inner_quote}'
        
        # But we need to be more careful - only fix in click/fill contexts
        # Let's fix the specific case: page.click("text="Black Friday Deals"")
        specific_pattern = r'page\.(click|fill|selectOption)\(["\']text=(["\'])([^"\']+)\2["\']\)'
        def fix_specific_text_locator(match):
            method = match.group(1)
            quote = match.group(2)
            text = match.group(3)
            if method == 'click':
                return f'page.getByText({quote}{text}{quote}).click()'
            elif method == 'fill':
                # For fill, we need the value too - this is more complex
                # For now, just fix the selector part
                return f'page.getByText({quote}{text}{quote}).fill(...)'
            else:
                return f'page.getByText({quote}{text}{quote}).{method}()'
        
        code = re.sub(specific_pattern, fix_specific_text_locator, code)
        
        # Fix: page.click('text="..."') -> page.getByText("...").click()
        text_with_quotes_pattern = r'page\.click\(["\']text=(["\'])([^"\']+)\1["\']\)'
        code = re.sub(text_with_quotes_pattern, lambda m: f'page.getByText({m.group(1)}{m.group(2)}{m.group(1)}).click()', code)
        
        return code
    
    def _validate_playwright_code(self, code: str) -> bool:
        """Validate that generated code has basic Playwright structure."""
        required_patterns = [
            r"import.*@playwright/test",
            r"(test|describe)\s*\(",
            r"async\s*\(\s*\{\s*page\s*\}\s*\)"
        ]
        
        for pattern in required_patterns:
            if not re.search(pattern, code, re.IGNORECASE):
                logger.warning(f"Code validation failed: missing pattern '{pattern}'")
                return False
        
        return True
    
    def _fix_playwright_code(self, code: str, action_graph: Dict[str, Any]) -> str:
        """Attempt to fix invalid Playwright code by wrapping in proper structure with auto-healing."""
        logger.warning("Attempting to fix invalid Playwright code structure with auto-healing")
        
        # Generate auto-healing helper function with overlay handling
        auto_healing_helper = """// Wait for overlays to disappear
async function waitForOverlaysToDisappear(page) {
  // Wait for common overlay patterns to disappear
  const overlaySelectors = [
    '[class*="overlay"]',
    '[class*="modal"]',
    '[class*="loading"]',
    '[class*="spinner"]',
    '[id*="overlay"]',
    '[id*="modal"]',
    '[id*="loading"]',
    '.w_nCQt',  // Walmart-specific overlay class
    '.ReactModal__Overlay',  // React Modal overlay
    '[class*="ReactModal"]',  // Any React Modal component
    '[class*="ModalDrawer"]',  // Modal drawer components
    '[class*="Dialog"]',  // Dialog components
    '[role="dialog"]',  // ARIA dialog role
    '[role="alertdialog"]',  // ARIA alert dialog
  ];
  
  for (const selector of overlaySelectors) {
    try {
      const overlay = page.locator(selector);
      await overlay.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
    } catch (e) {
      // Overlay not found or already hidden, continue
    }
  }
  
  // Small delay to ensure overlays are fully gone
  await page.waitForTimeout(100);
}

// ENTERPRISE-GRADE: Intelligent self-healing click with multi-strategy discovery
async function clickWithIntelligentHealing(page, elementContext) {
  // Strategy 1: Wait for overlays
  await waitForOverlaysToDisappear(page);
  
  const strategies = [
    // Strategy 1: getByRole (MOST ROBUST - works across all apps)
    async () => {
      if (elementContext.role && elementContext.text) {
        const element = page.getByRole(elementContext.role, { name: elementContext.text });
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'role_with_text' };
      } else if (elementContext.role) {
        const element = page.getByRole(elementContext.role);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'role_only' };
      }
      throw new Error('No role available');
    },
    
    // Strategy 2: getByText (text similarity)
    async () => {
      if (elementContext.text) {
        // Try exact match first
        try {
          const element = page.getByText(elementContext.text, { exact: true });
          await element.waitFor({ state: 'visible', timeout: 5000 });
          await element.click({ timeout: 5000 });
          return { success: true, strategy: 'text_exact' };
        } catch {
          // Try partial match
          const element = page.getByText(elementContext.text);
          await element.waitFor({ state: 'visible', timeout: 5000 });
          await element.click({ timeout: 5000 });
          return { success: true, strategy: 'text_partial' };
        }
      }
      throw new Error('No text available');
    },
    
    // Strategy 3: Context-aware (parent-child)
    async () => {
      if (elementContext.parentSelector && elementContext.text) {
        const element = page.locator(elementContext.parentSelector).getByText(elementContext.text);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.click({ timeout: 5000 });
        return { success: true, strategy: 'context_aware' };
      }
      throw new Error('No context available');
    },
    
    // Strategy 4: Original selector with overlay handling
    async () => {
      if (elementContext.originalSelector) {
        await waitForOverlaysToDisappear(page);
        const element = page.locator(elementContext.originalSelector);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        try {
          await element.click({ timeout: 5000 });
          return { success: true, strategy: 'original_selector' };
        } catch (clickError) {
          if (clickError.message.includes('intercepts pointer events')) {
            await element.click({ force: true, timeout: 5000 });
            return { success: true, strategy: 'original_selector_force' };
          }
          throw clickError;
        }
      }
      throw new Error('No selector available');
    },
    
    // Strategy 5: Force action (last resort)
    async () => {
      if (elementContext.originalSelector) {
        const element = page.locator(elementContext.originalSelector);
        await element.waitFor({ state: 'attached', timeout: 5000 });
        await element.click({ force: true, timeout: 5000 });
        return { success: true, strategy: 'force_action' };
      }
      throw new Error('No selector for force action');
    },
  ];
  
  // Try each strategy in order
  let lastError = null;
  for (const strategy of strategies) {
    try {
      await waitForOverlaysToDisappear(page);
      const result = await strategy();
      console.log(`[INTELLIGENT-HEAL] Success with strategy: ${result.strategy}`);
      return result;
    } catch (error) {
      lastError = error;
      console.log(`[INTELLIGENT-HEAL] Strategy failed: ${error.message}`);
      continue;
    }
  }
  
  throw new Error(`All intelligent healing strategies failed. Last error: ${lastError?.message}`);
}

// Backward compatibility alias
async function clickWithFallback(page, locators) {
  // Convert locator array to element context
  const elementContext = {
    originalSelector: locators[0] || '',
    text: null,
    role: null,
    parentSelector: null
  };
  
  return await clickWithIntelligentHealing(page, elementContext);
}

// ENTERPRISE-GRADE: Intelligent self-healing fill with multi-strategy discovery
async function fillWithIntelligentHealing(page, elementContext, value) {
  // Strategy 1: Wait for overlays
  await waitForOverlaysToDisappear(page);
  
  const strategies = [
    // Strategy 1: getByLabel (MOST ROBUST for form inputs)
    async () => {
      if (elementContext.text) {
        const element = page.getByLabel(elementContext.text);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.fill(value);
        return { success: true, strategy: 'label' };
      }
      throw new Error('No label text available');
    },
    
    // Strategy 2: getByRole for textbox
    async () => {
      if (elementContext.text) {
        const element = page.getByRole('textbox', { name: elementContext.text });
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.fill(value);
        return { success: true, strategy: 'role_textbox' };
      }
      throw new Error('No text for role-based');
    },
    
    // Strategy 3: getByPlaceholder
    async () => {
      if (elementContext.text) {
        const element = page.getByPlaceholder(elementContext.text);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.fill(value);
        return { success: true, strategy: 'placeholder' };
      }
      throw new Error('No placeholder available');
    },
    
    // Strategy 4: Original selector
    async () => {
      if (elementContext.originalSelector) {
        await waitForOverlaysToDisappear(page);
        const element = page.locator(elementContext.originalSelector);
        await element.waitFor({ state: 'visible', timeout: 5000 });
        await element.fill(value);
        return { success: true, strategy: 'original_selector' };
      }
      throw new Error('No selector available');
    },
  ];
  
  // Try each strategy in order
  let lastError = null;
  for (const strategy of strategies) {
    try {
      await waitForOverlaysToDisappear(page);
      const result = await strategy();
      console.log(`[INTELLIGENT-HEAL] Fill success with strategy: ${result.strategy}`);
      return result;
    } catch (error) {
      lastError = error;
      continue;
    }
  }
  
  throw new Error(`All fill strategies failed. Last error: ${lastError?.message}`);
}

// Backward compatibility alias
async function fillWithFallback(page, locators, value) {
  const elementContext = {
    originalSelector: locators[0] || '',
    text: null,
    role: null,
    parentSelector: null
  };
  
  return await fillWithIntelligentHealing(page, elementContext, value);
}
"""
        
        # Try to extract actions from broken code
        actions = []
        
        # CRITICAL: Always add page.goto() as first action
        # Extract page.goto calls - filter out internal browser URLs
        goto_matches = re.findall(r'page\.goto\(["\']([^"\']+)["\']', code)
        # Filter out internal browser URLs (chrome://, about:, etc.)
        valid_urls = [url for url in goto_matches if not self._is_internal_browser_url(url)]
        
        # Always ensure we have a page.goto() call
        if valid_urls:
            # Use first valid (non-internal) URL
            first_valid_url = valid_urls[0]
            actions.insert(0, f'  await page.goto("{first_valid_url}");')
            actions.insert(1, f'  await expect(page).toHaveURL(/.*{first_valid_url.split("/")[-1]}.*/);')
        else:
            # If no valid URLs found, extract from action graph
            real_url = self._extract_first_real_url(action_graph)
            if real_url:
                actions.insert(0, f'  await page.goto("{real_url}");')
                actions.insert(1, f'  await expect(page).toHaveURL(/.*{real_url.split("/")[-1]}.*/);')
            else:
                # Last resort: Add placeholder with comment
                actions.insert(0, '  // TODO: Add the website URL below')
                actions.insert(1, '  // await page.goto("https://example.com");')
                logger.warning("No valid URL found in action graph or generated code. Added placeholder.")
        
        # Extract page.click calls and enhance with auto-healing
        # Fix malformed text= locators first
        code = self._sanitize_playwright_code(code)
        
        # Extract various click patterns
        click_matches = []
        # Pattern 1: page.click("selector")
        simple_clicks = re.findall(r'page\.click\(["\']([^"\']+)["\']\)', code)
        for selector in simple_clicks:
            click_matches.append((selector, 'click'))
        
        # Pattern 2: page.getByText("text").click() - use .first() to handle multiple matches
        text_clicks = re.findall(r'page\.getByText\(["\']([^"\']+)["\']\)\.click\(\)', code)
        for text in text_clicks:
            click_matches.append((text, 'getByText'))
        
        # Fix getByText() calls that might match multiple elements - add .first()
        # This prevents "strict mode violation" errors
        # Pattern 1: page.getByText("text").click() -> page.getByText("text").first().click()
        code = re.sub(
            r'page\.getByText\((["\'])([^"\']+)\1\)\.click\(\)',
            r'page.getByText(\1\2\1).first().click()',
            code
        )
        
        # Pattern 2: await page.getByText("text").click() -> await page.getByText("text").first().click()
        code = re.sub(
            r'await\s+page\.getByText\((["\'])([^"\']+)\1\)\.click\(\)',
            r'await page.getByText(\1\2\1).first().click()',
            code
        )
        
        # Pattern 3: Any getByText() without .first() - add it
        # This catches any remaining cases
        code = re.sub(
            r'page\.getByText\((["\'])([^"\']+)\1\)(?!\.first\(\))',
            r'page.getByText(\1\2\1).first()',
            code
        )
        
        # Pattern 3: page.getByRole("role", { name: "text" }).click()
        role_clicks = re.findall(r'page\.getByRole\(["\']([^"\']+)["\'],\s*\{\s*name:\s*["\']([^"\']+)["\']', code)
        for role, name in role_clicks:
            click_matches.append((f'{role}:{name}', 'getByRole'))
        
        for selector, method in click_matches:
            # Generate optimal locators for this selector
            try:
                locator_info = self.locator_engine.generate_optimal_locator(
                    element_html=f'<element selector="{selector}">',
                    element_attributes={"selector": selector}
                )
                primary = locator_info.get("primary", selector)
                fallbacks = locator_info.get("fallbacks", [])
                
                # Build locator array
                all_locators = [primary] + fallbacks[:2]  # Limit to 3 total
                locators_str = json.dumps(all_locators)
                
                # Use intelligent healing for text-based locators
                if method == 'getByText' or 'text=' in selector.lower():
                    # Extract text from selector
                    text = selector.replace('text=', '').strip('"\'')
                    if method == 'getByText':
                        text = selector  # Already extracted by regex
                    actions.append(f'  await clickWithIntelligentHealing(page, {{ text: "{text}", role: null, originalSelector: "{selector}" }});')
                else:
                    actions.append(f'  await clickWithFallback(page, {locators_str});')
            except Exception as e:
                logger.warning(f"Failed to generate locators for {selector}: {e}")
                # Use intelligent healing as fallback for text locators
                if method == 'getByText' or 'text=' in selector.lower():
                    text = selector.replace('text=', '').strip('"\'')
                    if method == 'getByText':
                        text = selector
                    actions.append(f'  await clickWithIntelligentHealing(page, {{ text: "{text}", role: null, originalSelector: "{selector}" }});')
                else:
                    actions.append(f'  await page.locator("{selector}").click();')
        
        # Extract page.fill calls and enhance
        fill_matches = re.findall(
            r'page\.fill\(["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']',
            code
        )
        for selector, value in fill_matches:
            try:
                locator_info = self.locator_engine.generate_optimal_locator(
                    element_html=f'<input selector="{selector}">',
                    element_attributes={"selector": selector}
                )
                primary = locator_info.get("primary", selector)
                fallbacks = locator_info.get("fallbacks", [])
                all_locators = [primary] + fallbacks[:2]
                locators_str = json.dumps(all_locators)
                
                actions.append(f'  await fillWithFallback(page, {locators_str}, "{value}");')
            except Exception as e:
                logger.warning(f"Failed to generate locators for {selector}: {e}")
                actions.append(f'  await page.locator("{selector}").fill("{value}");')
        
        # Extract page.selectOption calls
        select_matches = re.findall(
            r'page\.selectOption\(["\']([^"\']+)["\'],\s*["\']([^"\']+)["\']',
            code
        )
        for selector, value in select_matches:
            actions.append(f'  await page.locator("{selector}").selectOption("{value}");')
        
        # Build proper structure with auto-healing
        if actions:
            return f"""import {{ test, expect }} from '@playwright/test';

{auto_healing_helper}

test('Flowstral Recorded Test', async ({{ page }}) => {{
{chr(10).join(actions)}
}});"""
        else:
            # Fallback: basic structure - find first real URL
            initial_url = self._extract_first_real_url(action_graph)
            if not initial_url:
                # Try one more time with more aggressive extraction
                initial_url = self._extract_first_real_url_aggressive(action_graph)
            
            if initial_url:
                return f"""import {{ test, expect }} from '@playwright/test';

{auto_healing_helper}

test('Flowstral Recorded Test', async ({{ page }}) => {{
  await page.goto('{initial_url}');
  await expect(page).toHaveURL(/.*/);
  // Generated code had issues, using fallback structure
}});"""
            else:
                # No URL found - add placeholder
                return f"""import {{ test, expect }} from '@playwright/test';

{auto_healing_helper}

test('Flowstral Recorded Test', async ({{ page }}) => {{
  // TODO: Please add the website URL below - no URL was found in the recording
  // await page.goto('https://example.com');
  // await expect(page).toHaveURL(/.*/);
  // Generated code had issues and no URL was found in action graph
}});"""
    
    def _is_internal_browser_url(self, url: str) -> bool:
        """Check if URL is an internal browser URL that should be filtered out."""
        if not url:
            return True
        
        url_lower = url.lower().strip()
        
        # Internal browser URL patterns
        internal_patterns = [
            'chrome://',
            'about:',
            'edge://',
            'firefox://',
            'opera://',
            'safari://',
            'newtab',
            'blank',
        ]
        
        # Check if URL matches any internal pattern
        for pattern in internal_patterns:
            if pattern in url_lower:
                return True
        
        return False
    
    def _extract_first_real_url(self, action_graph: Dict[str, Any]) -> Optional[str]:
        """Extract the first real (non-internal) website URL from action graph."""
        nodes = action_graph.get("nodes", [])
        edges = action_graph.get("edges", [])
        
        # Strategy 1: Check all nodes for URLs (url and url_pattern fields)
        for node in nodes:
            # Check both url and url_pattern fields
            url = node.get("url") or node.get("url_pattern", "")
            if url and not self._is_internal_browser_url(url):
                # Also filter out localhost/dev URLs if they're Flowstral/QA platform
                url_lower = url.lower()
                if 'flowstral' not in url_lower and 'qa' not in url_lower and 'platform' not in url_lower:
                    # Check for localhost with dev ports
                    if 'localhost' in url_lower or '127.0.0.1' in url_lower:
                        if not re.search(r':(8080|8081|3000|5173|4200)', url_lower):
                            return url
                    else:
                        # Real website URL
                        return url
        
        # Strategy 2: Check edges for navigation events with URLs
        for edge in edges:
            # Check if edge has URL information
            edge_url = edge.get("url") or edge.get("target_url", "")
            if edge_url and not self._is_internal_browser_url(edge_url):
                url_lower = edge_url.lower()
                if 'flowstral' not in url_lower and 'qa' not in url_lower and 'platform' not in url_lower:
                    if 'localhost' not in url_lower and '127.0.0.1' not in url_lower:
                        return edge_url
        
        # Strategy 3: Look for navigation action types
        for edge in edges:
            action_type = edge.get("action_type", "").lower()
            if "navigate" in action_type or "goto" in action_type or "url" in action_type:
                # Try to extract URL from action description or metadata
                action_desc = edge.get("action", "") or edge.get("description", "")
                # Look for URL pattern in action description
                url_match = re.search(r'https?://[^\s<>"\'\)]+', action_desc)
                if url_match:
                    url = url_match.group(0)
                    if not self._is_internal_browser_url(url):
                        return url
        
        # Strategy 4: Check if any node has a URL that starts with http/https (even if filtered before)
        for node in nodes:
            url = node.get("url") or node.get("url_pattern", "")
            if url and (url.startswith("http://") or url.startswith("https://")):
                url_lower = url.lower()
                # Only filter if it's clearly internal
                if not any(pattern in url_lower for pattern in ['chrome://', 'about:', 'edge://', 'newtab']):
                    # Return it even if localhost - better than nothing
                    return url
        
        return None
    
    def _extract_first_real_url_aggressive(self, action_graph: Dict[str, Any]) -> Optional[str]:
        """More aggressive URL extraction - looks everywhere in the action graph."""
        # Check all nodes
        nodes = action_graph.get("nodes", [])
        for node in nodes:
            # Check all possible URL fields
            for url_field in ["url", "url_pattern", "target_url", "page_url", "location"]:
                url = node.get(url_field, "")
                if url and isinstance(url, str) and len(url) > 5:
                    if url.startswith("http://") or url.startswith("https://"):
                        url_lower = url.lower()
                        # Only exclude clearly internal URLs
                        if not any(pattern in url_lower for pattern in ['chrome://', 'about:', 'edge://', 'newtab']):
                            return url
        
        # Check edges
        edges = action_graph.get("edges", [])
        for edge in edges:
            for url_field in ["url", "target_url", "navigation_url", "to_url"]:
                url = edge.get(url_field, "")
                if url and isinstance(url, str) and len(url) > 5:
                    if url.startswith("http://") or url.startswith("https://"):
                        url_lower = url.lower()
                        if not any(pattern in url_lower for pattern in ['chrome://', 'about:', 'edge://', 'newtab']):
                            return url
        
        return None


# Global instance
_playwright_code_service = None

def get_playwright_code_service() -> PlaywrightCodeService:
    """Get or create global PlaywrightCodeService instance"""
    global _playwright_code_service
    if _playwright_code_service is None:
        _playwright_code_service = PlaywrightCodeService()
    return _playwright_code_service

