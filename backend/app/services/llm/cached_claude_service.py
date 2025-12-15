"""
Cached Claude Service - Cost-Optimized LLM Integration
=======================================================

This service implements prompt caching and smart cost optimization
for Claude API usage in the QAAI platform.

Cost Savings Strategy:
1. Prompt Caching - Cache static content (90% cheaper on cache reads)
2. Tiered Models - Use Haiku for simple tasks, Sonnet for complex
3. Response Caching - Cache identical requests locally
4. Smart Truncation - Minimize token usage while preserving quality

Usage:
    service = CachedClaudeService()
    result = await service.generate_test(page_context, user_request)
"""

import os
import json
import hashlib
import logging
import asyncio
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, List, AsyncGenerator
from functools import lru_cache
from pathlib import Path

# Load .env file
try:
    from dotenv import load_dotenv
    # Load from backend/.env
    env_path = Path(__file__).parent.parent.parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"[CachedClaudeService] Loaded .env from {env_path}")
except ImportError:
    pass  # dotenv not installed, rely on system env vars

logger = logging.getLogger(__name__)

# Try to import anthropic, graceful fallback if not installed
try:
    import anthropic
    ANTHROPIC_AVAILABLE = True
except ImportError:
    ANTHROPIC_AVAILABLE = False
    logger.warning("anthropic package not installed. Run: pip install anthropic")


class UsageTracker:
    """Track API usage and cost savings"""
    
    def __init__(self):
        self.stats = {
            "total_requests": 0,
            "cache_hits": 0,
            "cache_writes": 0,
            "local_cache_hits": 0,
            "tokens_input": 0,
            "tokens_output": 0,
            "tokens_cached_read": 0,
            "tokens_cached_write": 0,
            "estimated_cost_usd": 0.0,
            "estimated_savings_usd": 0.0,
            "requests_by_model": {},
            "requests_by_task": {},
            "start_time": datetime.utcnow().isoformat()
        }
        self._load_stats()
    
    def _stats_file(self) -> Path:
        return Path(__file__).parent / "usage_stats.json"
    
    def _load_stats(self):
        """Load stats from file if exists"""
        try:
            if self._stats_file().exists():
                with open(self._stats_file(), 'r') as f:
                    saved = json.load(f)
                    self.stats.update(saved)
        except Exception as e:
            logger.warning(f"Could not load usage stats: {e}")
    
    def _save_stats(self):
        """Save stats to file"""
        try:
            with open(self._stats_file(), 'w') as f:
                json.dump(self.stats, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not save usage stats: {e}")
    
    def log_request(
        self, 
        model: str, 
        task_type: str,
        usage: Dict[str, int],
        from_local_cache: bool = False
    ):
        """Log a request and calculate costs"""
        self.stats["total_requests"] += 1
        
        if from_local_cache:
            self.stats["local_cache_hits"] += 1
            return  # No API cost for local cache hits
        
        # Track by model
        if model not in self.stats["requests_by_model"]:
            self.stats["requests_by_model"][model] = 0
        self.stats["requests_by_model"][model] += 1
        
        # Track by task
        if task_type not in self.stats["requests_by_task"]:
            self.stats["requests_by_task"][task_type] = 0
        self.stats["requests_by_task"][task_type] += 1
        
        # Token counts
        input_tokens = usage.get("input_tokens", 0)
        output_tokens = usage.get("output_tokens", 0)
        cache_read = usage.get("cache_read_input_tokens", 0)
        cache_write = usage.get("cache_creation_input_tokens", 0)
        
        self.stats["tokens_input"] += input_tokens
        self.stats["tokens_output"] += output_tokens
        self.stats["tokens_cached_read"] += cache_read
        self.stats["tokens_cached_write"] += cache_write
        
        if cache_read > 0:
            self.stats["cache_hits"] += 1
        if cache_write > 0:
            self.stats["cache_writes"] += 1
        
        # Cost calculation (Claude Sonnet 3.5 pricing)
        # Input: $3/1M tokens, Output: $15/1M tokens
        # Cache read: $0.30/1M tokens (90% off), Cache write: $3.75/1M tokens
        PRICES = {
            "claude-sonnet-4-20250514": {"input": 3.0, "output": 15.0, "cache_read": 0.30, "cache_write": 3.75},
            "claude-3-5-sonnet-20241022": {"input": 3.0, "output": 15.0, "cache_read": 0.30, "cache_write": 3.75},
            "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25, "cache_read": 0.025, "cache_write": 0.30},
        }
        
        prices = PRICES.get(model, PRICES["claude-sonnet-4-20250514"])
        
        cost = (
            (input_tokens / 1_000_000) * prices["input"] +
            (output_tokens / 1_000_000) * prices["output"] +
            (cache_read / 1_000_000) * prices["cache_read"] +
            (cache_write / 1_000_000) * prices["cache_write"]
        )
        
        # Calculate savings (what it would have cost without caching)
        cost_without_cache = (
            ((input_tokens + cache_read) / 1_000_000) * prices["input"] +
            (output_tokens / 1_000_000) * prices["output"]
        )
        savings = cost_without_cache - cost
        
        self.stats["estimated_cost_usd"] += cost
        self.stats["estimated_savings_usd"] += max(0, savings)
        
        # Save periodically
        if self.stats["total_requests"] % 10 == 0:
            self._save_stats()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get usage summary"""
        total = self.stats["total_requests"]
        cache_hits = self.stats["cache_hits"] + self.stats["local_cache_hits"]
        
        return {
            **self.stats,
            "cache_hit_rate": f"{(cache_hits / max(1, total)) * 100:.1f}%",
            "avg_cost_per_request": f"${self.stats['estimated_cost_usd'] / max(1, total):.4f}",
            "total_tokens": self.stats["tokens_input"] + self.stats["tokens_output"],
        }


class LocalResponseCache:
    """
    Wrapper for the new PromptCache system.
    Provides backward compatibility while using SQLite-backed persistent cache.
    """
    
    def __init__(self, max_size: int = 10000, ttl_minutes: int = 1440):
        # Use the new PromptCache
        try:
            from app.services.llm.prompt_cache import get_prompt_cache
            self._cache = get_prompt_cache()
            self._use_new_cache = True
            logger.info("Using new SQLite-backed PromptCache")
        except Exception as e:
            logger.warning(f"Could not initialize PromptCache, using fallback: {e}")
            self._use_new_cache = False
            self._fallback_cache: Dict[str, Dict[str, Any]] = {}
            self.max_size = max_size
            self.ttl = timedelta(minutes=ttl_minutes)
    
    def get(self, prompt: str, model: str, task_type: str = "test_generation") -> Optional[str]:
        """Get cached response if exists"""
        if self._use_new_cache:
            import asyncio
            try:
                # Run async get in sync context
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Create new loop for sync execution
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor() as pool:
                        future = pool.submit(asyncio.run, self._cache.get(prompt, model, task_type))
                        result = future.result(timeout=5)
                else:
                    result = asyncio.run(self._cache.get(prompt, model, task_type))
                
                if result:
                    return result.get("response")
            except Exception as e:
                logger.warning(f"Cache get error: {e}")
        else:
            # Fallback to in-memory
            key = hashlib.sha256(f"{model}:{prompt}".encode()).hexdigest()[:32]
            if key in self._fallback_cache:
                return self._fallback_cache[key].get("response")
        
        return None
    
    async def get_async(self, prompt: str, model: str, task_type: str = "test_generation") -> Optional[str]:
        """Async get cached response"""
        if self._use_new_cache:
            result = await self._cache.get(prompt, model, task_type)
            if result:
                return result.get("response")
        return None
    
    def set(self, prompt: str, model: str, response: str, task_type: str = "test_generation"):
        """Cache a response"""
        if self._use_new_cache:
            import asyncio
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    # Schedule without waiting
                    asyncio.create_task(self._cache.set(prompt, model, task_type, response))
                else:
                    asyncio.run(self._cache.set(prompt, model, task_type, response))
            except Exception as e:
                logger.warning(f"Cache set error: {e}")
        else:
            # Fallback
            key = hashlib.sha256(f"{model}:{prompt}".encode()).hexdigest()[:32]
            self._fallback_cache[key] = {
                "response": response,
                "timestamp": datetime.utcnow().isoformat()
            }
    
    async def set_async(self, prompt: str, model: str, response: str, task_type: str = "test_generation"):
        """Async cache a response"""
        if self._use_new_cache:
            await self._cache.set(prompt, model, task_type, response)
    
    def get_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        if self._use_new_cache:
            return self._cache.get_stats()
        return {"fallback_mode": True, "entries": len(self._fallback_cache)}


class CachedClaudeService:
    """
    Cost-optimized Claude API service with prompt caching.
    
    Features:
    - Prompt caching for static content (90% cost reduction)
    - Local response caching for identical requests (100% cost reduction)
    - Tiered model selection based on task complexity
    - Smart DOM truncation to minimize tokens
    - Usage tracking and cost monitoring
    - Rate limiting to avoid API limits
    """
    
    # Rate limiting settings
    MAX_REQUESTS_PER_MINUTE = 50  # Conservative limit
    MIN_REQUEST_INTERVAL = 1.2   # Seconds between requests
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("ANTHROPIC_API_KEY")
        self._last_request_time = 0
        self._request_count_this_minute = 0
        self._minute_start = datetime.now()
        # Rate limit tracking
        self._rate_limit_until: Optional[datetime] = None
        self._last_rate_limit_error: Optional[datetime] = None
        
        if ANTHROPIC_AVAILABLE and self.api_key:
            self.client = anthropic.Anthropic(api_key=self.api_key)
            self.async_client = anthropic.AsyncAnthropic(api_key=self.api_key)
        else:
            self.client = None
            self.async_client = None
            logger.warning("Claude client not initialized. Set ANTHROPIC_API_KEY.")
        
        # Initialize caching and tracking
        self.usage_tracker = UsageTracker()
        self.response_cache = LocalResponseCache()
        
        # Load static context (cacheable content)
        self.static_context = self._build_static_context()
        
        logger.info(f"CachedClaudeService initialized. Static context: {len(self.static_context)} chars")
    
    def _build_static_context(self) -> str:
        """
        Build the static context that will be cached.
        This should include all content that doesn't change between requests.
        """
        parts = []
        
        # 1. System persona
        parts.append("""
## Role & Expertise

You are an expert QA automation engineer with deep expertise in:
- Playwright test automation (Python & TypeScript)
- Enterprise application testing (Salesforce, Workday, SAP, ServiceNow, etc.)
- Self-healing selectors and robust locator strategies
- Test case design and best practices
- Accessibility and performance testing

You write clean, maintainable, production-ready test code.
""")
        
        # 2. App-specific selector strategies
        parts.append(self._get_selector_strategies())
        
        # 3. Playwright best practices
        parts.append(self._get_playwright_patterns())
        
        # 4. Test templates
        parts.append(self._get_test_templates())
        
        return "\n\n".join(parts)
    
    def _get_selector_strategies(self) -> str:
        """Enterprise app selector strategies - CACHED"""
        return """
## Enterprise Application Selector Strategies

### Salesforce Lightning/LWC
- PREFER: [name="fieldName"], [title="..."], getByLabel(), getByRole()
- AVOID: lwc-* dynamic IDs, data-id with numbers, radio-123-456 patterns
- WAIT: Use 'domcontentloaded' (not 'networkidle' - causes timeouts)
- Example: `page.locator('[name="Email"]')` or `page.getByLabel('Email')`

### Salesforce Aura (Classic)
- PREFER: [data-aura-id="..."], [name="..."]
- AVOID: data-aura-rendered-by attributes (dynamic)
- Example: `page.locator('[data-aura-id="emailField"]')`

### Workday
- PREFER: [data-automation-id="..."] (stable across releases)
- AVOID: Dynamic class names, numeric IDs
- Example: `page.locator('[data-automation-id="firstName"]')`

### SAP Fiori / UI5
- PREFER: [id*="--fieldName"], sap.ui.* stable IDs
- AVOID: __xmlview prefixes, __component patterns
- Example: `page.locator('[id$="--emailInput"]')`

### ServiceNow
- PREFER: [data-field="..."], [ng-model="..."]
- AVOID: sys_* dynamic IDs
- Example: `page.locator('[data-field="email"]')`

### Oracle Cloud
- PREFER: [id*="field_name"], [name="..."]
- AVOID: _afrLoop parameters, dynamic row IDs

### Microsoft Dynamics 365
- PREFER: [data-id="..."], [aria-label="..."]
- AVOID: GUID-based IDs

### Generic Web (React, Angular, Vue)
- PREFER: [data-testid="..."], [data-cy="..."], getByRole()
- AVOID: Dynamic class names, index-based selectors
"""
    
    def _get_playwright_patterns(self) -> str:
        """Playwright best practices - CACHED"""
        return """
## Playwright Best Practices

### Robust Selectors (Priority Order)
1. `getByRole('button', { name: 'Submit' })` - Accessibility-first
2. `getByLabel('Email')` - For form inputs
3. `getByText('Welcome')` - For content assertions
4. `locator('[data-testid="submit-btn"]')` - Test IDs
5. `locator('[name="email"]')` - Stable attributes

### Smart Waits
```python
# Wait for page to be ready
await page.wait_for_load_state('domcontentloaded')

# Wait for specific element
await page.locator('.content').wait_for(state='visible')

# Wait for network idle (use sparingly)
await page.wait_for_load_state('networkidle')

# Custom wait for dynamic content
await page.wait_for_function('() => document.querySelector(".loaded")')
```

### Self-Healing Patterns
```python
async def safe_click(page, selectors: list, timeout=10000):
    '''Try multiple selectors until one works'''
    for selector in selectors:
        try:
            await page.locator(selector).click(timeout=timeout)
            return True
        except:
            continue
    raise Exception(f"None of the selectors worked: {selectors}")
```

### Error Handling
```python
try:
    await page.locator('#submit').click()
except TimeoutError:
    # Take screenshot for debugging
    await page.screenshot(path='error.png')
    raise
```
"""
    
    def _get_test_templates(self) -> str:
        """Test templates - CACHED"""
        return """
## Test Templates

### Basic Test Structure (Python)
```python
import pytest
from playwright.sync_api import Page, expect

def test_feature_name(page: Page):
    '''Clear description of what this tests'''
    # Arrange
    page.goto('https://example.com')
    
    # Act
    page.get_by_label('Email').fill('test@example.com')
    page.get_by_role('button', { name: 'Submit' }).click()
    
    # Assert
    expect(page.get_by_text('Success')).to_be_visible()
```

### Page Object Pattern
```python
class LoginPage:
    def __init__(self, page: Page):
        self.page = page
        self.email = page.get_by_label('Email')
        self.password = page.get_by_label('Password')
        self.submit = page.get_by_role('button', name='Login')
    
    def login(self, email: str, password: str):
        self.email.fill(email)
        self.password.fill(password)
        self.submit.click()
```

### Data-Driven Test
```python
@pytest.mark.parametrize("email,password,expected", [
    ("valid@test.com", "Pass123!", "Welcome"),
    ("invalid@test.com", "wrong", "Invalid credentials"),
])
def test_login_scenarios(page: Page, email, password, expected):
    page.goto('/login')
    page.get_by_label('Email').fill(email)
    page.get_by_label('Password').fill(password)
    page.get_by_role('button', name='Login').click()
    expect(page.get_by_text(expected)).to_be_visible()
```
"""
    
    def _select_model(self, task_type: str) -> str:
        """Select appropriate model based on task complexity"""
        
        # Simple tasks - use Haiku (cheapest)
        simple_tasks = [
            "selector_generation",
            "simple_assertion",
            "element_description",
            "basic_validation"
        ]
        
        # Complex tasks - use Sonnet
        complex_tasks = [
            "test_generation",
            "flow_analysis",
            "debugging",
            "refactoring",
            "multi_step_test"
        ]
        
        if task_type in simple_tasks:
            return "claude-3-haiku-20240307"
        else:
            return "claude-sonnet-4-20250514"
    
    def _truncate_dom(self, dom_content: str, max_chars: int = 8000) -> str:
        """
        Smart DOM truncation to reduce tokens while preserving essential elements.
        """
        if len(dom_content) <= max_chars:
            return dom_content
        
        import re
        
        # Remove scripts, styles, comments
        dom_content = re.sub(r'<script[^>]*>.*?</script>', '', dom_content, flags=re.DOTALL | re.IGNORECASE)
        dom_content = re.sub(r'<style[^>]*>.*?</style>', '', dom_content, flags=re.DOTALL | re.IGNORECASE)
        dom_content = re.sub(r'<!--.*?-->', '', dom_content, flags=re.DOTALL)
        dom_content = re.sub(r'<noscript[^>]*>.*?</noscript>', '', dom_content, flags=re.DOTALL | re.IGNORECASE)
        
        # Remove excessive whitespace
        dom_content = re.sub(r'\s+', ' ', dom_content)
        
        # If still too long, truncate with notice
        if len(dom_content) > max_chars:
            dom_content = dom_content[:max_chars] + "\n... [truncated for brevity]"
        
        return dom_content
    
    async def _enforce_rate_limit(self):
        """Enforce rate limiting to avoid API rate limit errors."""
        import time
        
        now = datetime.now()
        
        # Check if we're in a rate limit cooldown period
        if self._rate_limit_until and now < self._rate_limit_until:
            wait_seconds = (self._rate_limit_until - now).total_seconds()
            logger.warning(f"Rate limit active. Waiting {wait_seconds:.1f}s until {self._rate_limit_until.strftime('%H:%M:%S')}")
            await asyncio.sleep(wait_seconds)
            self._rate_limit_until = None  # Clear after waiting
        
        # Reset counter if a minute has passed
        if (now - self._minute_start).total_seconds() >= 60:
            self._request_count_this_minute = 0
            self._minute_start = now
        
        # Check if we've exceeded requests this minute
        if self._request_count_this_minute >= self.MAX_REQUESTS_PER_MINUTE:
            wait_time = 60 - (now - self._minute_start).total_seconds()
            if wait_time > 0:
                logger.warning(f"Internal rate limit: waiting {wait_time:.1f}s before next request")
                await asyncio.sleep(wait_time)
                self._request_count_this_minute = 0
                self._minute_start = datetime.now()
        
        # Ensure minimum interval between requests
        time_since_last = time.time() - self._last_request_time
        if time_since_last < self.MIN_REQUEST_INTERVAL:
            await asyncio.sleep(self.MIN_REQUEST_INTERVAL - time_since_last)
        
        self._last_request_time = time.time()
        self._request_count_this_minute += 1
    
    def get_rate_limit_status(self) -> Dict[str, Any]:
        """Get current rate limit status"""
        now = datetime.now()
        
        # Initialize attributes if they don't exist (for backwards compatibility)
        if not hasattr(self, '_rate_limit_until'):
            self._rate_limit_until = None
        if not hasattr(self, '_last_rate_limit_error'):
            self._last_rate_limit_error = None
        
        status = {
            "rate_limit_active": False,
            "can_resume_at": None,
            "seconds_until_resume": 0,
            "internal_requests_this_minute": self._request_count_this_minute,
            "internal_max_per_minute": self.MAX_REQUESTS_PER_MINUTE,
            "last_rate_limit_error": self._last_rate_limit_error.isoformat() if self._last_rate_limit_error else None
        }
        
        if self._rate_limit_until and now < self._rate_limit_until:
            status["rate_limit_active"] = True
            status["can_resume_at"] = self._rate_limit_until.isoformat()
            status["seconds_until_resume"] = int((self._rate_limit_until - now).total_seconds())
        
        return status

    async def generate_test(
        self,
        page_context: str,
        user_request: str,
        app_type: str = "generic",
        task_type: str = "test_generation",
        use_cache: bool = True
    ) -> Dict[str, Any]:
        """
        Generate a test with prompt caching optimization.
        
        Args:
            page_context: Current page DOM/elements
            user_request: What the user wants to test
            app_type: Application type (salesforce, workday, etc.)
            task_type: Type of task for model selection
            use_cache: Whether to use local response cache
        
        Returns:
            Dict with 'content', 'usage', 'model', 'from_cache'
        """
        if not self.async_client:
            return {
                "content": "Error: Claude API not configured. Set ANTHROPIC_API_KEY.",
                "usage": {},
                "model": None,
                "from_cache": False,
                "error": True
            }
        
        # Select model based on task
        model = self._select_model(task_type)
        
        # Truncate DOM to save tokens
        truncated_context = self._truncate_dom(page_context)
        
        # Build the dynamic prompt
        dynamic_prompt = f"""
## Current Page Context
App Type: {app_type}

### Page Elements:
{truncated_context}

## User Request
{user_request}

## Instructions
Generate a robust, production-ready Playwright test based on the request.
Use the appropriate selector strategies for {app_type} applications.
Include proper waits, error handling, and assertions.
"""
        
        # Check local cache first (100% free if hit)
        if use_cache:
            cached = await self.response_cache.get_async(dynamic_prompt, model, task_type)
            if cached:
                self.usage_tracker.log_request(model, task_type, {}, from_local_cache=True)
                logger.info(f"💰 CACHE HIT - Saved API call! Task: {task_type}")
                return {
                    "content": cached,
                    "usage": {"from_local_cache": True},
                    "model": model,
                    "from_cache": True
                }
        
        try:
            # Enforce rate limiting before API call
            await self._enforce_rate_limit()
            
            # Make API call with prompt caching
            response = await self.async_client.messages.create(
                model=model,
                max_tokens=4096,
                system=[
                    {
                        "type": "text",
                        "text": self.static_context,
                        "cache_control": {"type": "ephemeral"}  # Enable caching
                    }
                ],
                messages=[
                    {
                        "role": "user",
                        "content": dynamic_prompt
                    }
                ]
            )
            
            # Extract response
            content = response.content[0].text
            
            # Build usage dict
            usage = {
                "input_tokens": response.usage.input_tokens,
                "output_tokens": response.usage.output_tokens,
                "cache_read_input_tokens": getattr(response.usage, 'cache_read_input_tokens', 0),
                "cache_creation_input_tokens": getattr(response.usage, 'cache_creation_input_tokens', 0),
            }
            
            # Track usage
            self.usage_tracker.log_request(model, task_type, usage)
            
            # Cache response locally (persistent SQLite cache)
            if use_cache:
                await self.response_cache.set_async(dynamic_prompt, model, content, task_type)
                logger.info(f"💾 Response cached for future use (task: {task_type})")
            
            logger.info(
                f"Claude API call: model={model}, "
                f"input={usage['input_tokens']}, output={usage['output_tokens']}, "
                f"cache_read={usage['cache_read_input_tokens']}, cache_write={usage['cache_creation_input_tokens']}"
            )
            
            return {
                "content": content,
                "usage": usage,
                "model": model,
                "from_cache": False
            }
            
        except Exception as e:
            error_str = str(e)
            error_type = type(e).__name__
            
            # Check for rate limit errors
            is_rate_limit = (
                "rate limit" in error_str.lower() or
                "429" in error_str or
                "too many requests" in error_str.lower() or
                error_type == "RateLimitError"
            )
            
            # Try to extract retry-after information
            retry_after = None
            if is_rate_limit:
                # Check if error has retry_after attribute (Anthropic SDK)
                if hasattr(e, 'retry_after'):
                    retry_after = e.retry_after
                elif hasattr(e, 'response') and hasattr(e.response, 'headers'):
                    retry_after_header = e.response.headers.get('retry-after')
                    if retry_after_header:
                        try:
                            retry_after = int(retry_after_header)
                        except:
                            pass
                
                # Calculate resume time
                wait_seconds = retry_after or 60  # Default 60s if not specified
                resume_time = datetime.now() + timedelta(seconds=wait_seconds)
                
                # Store rate limit info for future requests
                self._rate_limit_until = resume_time
                self._last_rate_limit_error = datetime.now()
                
                logger.warning(
                    f"⚠️ Rate limit hit! Resume at {resume_time.strftime('%H:%M:%S')} "
                    f"({wait_seconds}s from now)"
                )
                
                return {
                    "content": f"⚠️ Rate limit exceeded. Resume at {resume_time.strftime('%H:%M:%S')} ({wait_seconds}s wait).\n\nTo avoid this:\n1. Use local cache (already enabled)\n2. Reduce request frequency\n3. Upgrade Anthropic plan for higher limits",
                    "usage": {},
                    "model": model,
                    "from_cache": False,
                    "error": True,
                    "error_type": "rate_limit",
                    "retry_after": wait_seconds,
                    "resume_time": resume_time.isoformat()
                }
            
            logger.error(f"Claude API error: {e}")
            return {
                "content": f"Error calling Claude API: {error_str}",
                "usage": {},
                "model": model,
                "from_cache": False,
                "error": True,
                "error_type": error_type
            }
    
    async def generate_selector(
        self,
        element_html: str,
        app_type: str = "generic"
    ) -> Dict[str, Any]:
        """
        Generate robust selector for an element.
        Uses Haiku (cheaper) for this simple task.
        """
        return await self.generate_test(
            page_context=element_html,
            user_request="Generate the most robust Playwright selector for this element. Provide primary selector and 2-3 fallbacks.",
            app_type=app_type,
            task_type="selector_generation"
        )
    
    async def analyze_test_failure(
        self,
        error_message: str,
        test_code: str,
        page_context: str
    ) -> Dict[str, Any]:
        """
        Analyze a test failure and suggest fixes.
        """
        return await self.generate_test(
            page_context=f"Error: {error_message}\n\nTest Code:\n{test_code}\n\nPage:\n{page_context}",
            user_request="Analyze this test failure and provide: 1) Root cause, 2) Fix suggestions, 3) Updated test code",
            task_type="debugging"
        )
    
    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics and cost summary"""
        usage_stats = self.usage_tracker.get_summary()
        cache_stats = self.response_cache.get_stats()
        
        return {
            **usage_stats,
            "cache_stats": cache_stats,
            "cost_optimization": {
                "local_cache_hit_rate": cache_stats.get("session_stats", {}).get("hit_rate_percent", 0),
                "anthropic_cache_read_tokens": usage_stats.get("tokens_cached_read", 0),
                "anthropic_cache_write_tokens": usage_stats.get("tokens_cached_write", 0),
                "estimated_savings_usd": usage_stats.get("estimated_savings_usd", 0),
                "tips": [
                    "✅ SQLite-backed cache persists across restarts",
                    "✅ Semantic matching finds similar prompts",
                    "✅ Per-task TTL optimizes cache lifetime",
                    "💡 Use 'selector_generation' task type for longest cache (7 days)",
                    "💡 Similar prompts will hit cache automatically"
                ]
            }
        }
    
    def clear_local_cache(self, task_type: Optional[str] = None):
        """Clear the local response cache"""
        try:
            from app.services.llm.prompt_cache import get_prompt_cache
            cache = get_prompt_cache()
            cache.clear(task_type)
            logger.info(f"Cache cleared (task_type={task_type})")
        except Exception as e:
            logger.warning(f"Could not clear cache: {e}")


# Singleton instance
_cached_claude_service: Optional[CachedClaudeService] = None

def get_cached_claude_service() -> CachedClaudeService:
    """Get or create the cached Claude service singleton"""
    global _cached_claude_service
    if _cached_claude_service is None:
        _cached_claude_service = CachedClaudeService()
    return _cached_claude_service



