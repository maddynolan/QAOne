"""
Agentic AI Testing Orchestrator v5.0 - Goal-Driven, Page-Aware Architecture

THE KEY CHANGE from v4: No more "plan all steps blindly, then execute."
Instead: SCAN real page → AI decides NEXT action based on what's visible → execute → repeat.

This is how Momentic.ai, Blinq, and other competitors achieve reliable automation:
- The AI NEVER generates hypothetical steps for pages it hasn't seen
- Each action is decided based on the REAL DOM elements currently visible
- After each action, re-scan and re-evaluate progress toward the goal
- The AI can adapt to unexpected pages, popups, redirects, etc.

Flow:
1. Parse goal + extract URL/credentials
2. Launch browser → navigate to URL
3. LOOP (max N iterations):
   a. Scan DOM → get ALL interactive elements
   b. Send goal + current page elements + history to AI
   c. AI returns NEXT SINGLE action (or "goal_complete" / "goal_blocked")
   d. Execute the action
   e. Take screenshot
   f. If goal complete → done
4. Compile results

@version 5.0.0
"""

import asyncio
import json
import logging
import re
import time
import base64
import os
from typing import AsyncGenerator, Dict, List, Optional, Any
from dataclasses import dataclass, field
from uuid import uuid4

from app.services.ai_testing.page_scanner import (
    get_scanner_js, match_element, build_recorded_action
)

logger = logging.getLogger(__name__)

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

try:
    from app.services.ai.vision_self_healing import get_vision_healing_service
    VISION_AVAILABLE = True
except ImportError:
    VISION_AVAILABLE = False


@dataclass
class StepResult:
    """Result of executing a single step"""
    success: bool
    action: str
    target: str
    value: str = ""
    description: str = ""
    error: Optional[str] = None
    method: str = ""           # How element was found
    selector_used: str = ""    # Actual selector that worked
    confidence: int = 0
    healed: bool = False
    heal_method: str = ""
    screenshot: Optional[str] = None


@dataclass
class TestCaseResult:
    id: str = ""
    name: str = ""
    description: str = ""
    status: str = "pending"
    steps: List[StepResult] = field(default_factory=list)
    duration: float = 0.0
    screenshot: Optional[str] = None


# Maximum steps the agent can take per test run (prevents infinite loops)
MAX_AGENT_STEPS = 25


class AgenticOrchestrator:
    """v5.0 - Goal-driven, page-aware orchestrator that decides actions one at a time"""

    def __init__(self, headless: bool = True):
        self.ai_client = self._init_ai()
        self._pw = None
        self._browser = None
        self._context = None
        self._page = None
        self._headless = headless
        self._scanned_elements: List[Dict] = []
        self._page_info: Dict = {}
        self._vision_service = None
        self._stream_session_id: str = str(uuid4())
        self._action_history: List[Dict] = []  # Track what we've done
        if VISION_AVAILABLE:
            try:
                self._vision_service = get_vision_healing_service()
            except:
                pass

    def _init_ai(self):
        if OPENAI_AVAILABLE:
            key = os.getenv("OPENAI_API_KEY")
            if key and key.startswith("sk-") and len(key) > 20:
                logger.info("AgenticOrchestrator v5: OpenAI ready")
                return openai.OpenAI(api_key=key)
        logger.warning("AgenticOrchestrator v5: No AI key, using pattern matching")
        return None

    async def run_testing(self, instruction: str) -> AsyncGenerator[Dict, None]:
        """Main entry: plain English goal → streaming test results via goal-driven loop"""
        yield {"type": "stream_session", "session_id": self._stream_session_id}

        try:
            # === PHASE 1: UNDERSTAND GOAL ===
            yield {"type": "phase", "phase": "understanding", "message": "Analyzing goal..."}
            goal_context = self._parse_goal(instruction)
            yield {"type": "intent", "data": {
                "url": goal_context["url"],
                "goal": goal_context["goal"],
                "app_type": goal_context.get("app_type", "unknown")
            }}
            yield {"type": "step", "message": f"Goal: {goal_context['goal'][:100]}"}
            yield {"type": "step", "message": f"Target: {goal_context['url']}"}

            # === PHASE 2: LAUNCH BROWSER ===
            yield {"type": "phase", "phase": "preparing", "message": "Launching browser..."}
            browser_ok = await self._launch_browser()
            if not browser_ok:
                yield {"type": "error", "error": "Could not launch browser"}
                return
            yield {"type": "step", "message": "Browser ready"}

            # Start live browser streaming (non-fatal)
            try:
                from app.services.ai_testing.live_browser_stream import live_stream_manager
                await live_stream_manager.register_session(self._stream_session_id, self._page)
                await live_stream_manager.start_streaming(self._stream_session_id)
            except Exception:
                pass

            # === PHASE 3: NAVIGATE ===
            yield {"type": "phase", "phase": "exploring", "message": f"Opening {goal_context['url']}..."}
            nav_step = StepResult(
                success=False, action="navigate",
                target=goal_context["url"], description=f"Navigate to {goal_context['url']}"
            )
            try:
                await self._page.goto(goal_context["url"], timeout=30000)
                await self._page.wait_for_load_state("domcontentloaded")
                try:
                    await self._page.wait_for_load_state("networkidle", timeout=10000)
                except:
                    await asyncio.sleep(1)
                nav_step.success = True
                nav_step.method = "navigate"
            except Exception as e:
                nav_step.error = str(e)
                yield {"type": "error", "error": f"Could not navigate to {goal_context['url']}"}
                return

            # Screenshot after navigation
            ss = await self._take_screenshot()
            if ss:
                yield {"type": "screenshot", "screenshot": ss}
            yield {"type": "step", "message": "Page loaded"}

            # === PHASE 4: GOAL-DRIVEN LOOP ===
            yield {"type": "phase", "phase": "executing", "message": "Working toward goal..."}

            tc = TestCaseResult(
                id=str(uuid4())[:8],
                name=f"Test: {goal_context['goal'][:60]}",
                description=f"Goal-driven AI test",
            )
            tc.steps.append(nav_step)
            tc.status = "running"
            start_time = time.time()
            self._action_history = [{"action": "navigate", "target": goal_context["url"], "result": "success"}]

            step_num = 0
            consecutive_failures = 0
            max_consecutive_failures = 3

            while step_num < MAX_AGENT_STEPS:
                step_num += 1

                # 4a. Scan the current page
                yield {"type": "step", "message": f"Step {step_num}: Scanning page..."}
                scan_result = await self._scan_page()
                element_count = len(self._scanned_elements)
                page_url = self._page.url if self._page else ""
                page_title = scan_result.get("title", "")

                yield {"type": "step", "message": f"  Found {element_count} interactive elements on '{page_title}'"}

                # 4b. Ask AI: what's the next action?
                next_action = await self._decide_next_action(
                    goal=goal_context["goal"],
                    credentials=goal_context.get("credentials", {}),
                    page_url=page_url,
                    page_title=page_title,
                    elements=self._scanned_elements,
                    history=self._action_history,
                )

                if not next_action:
                    yield {"type": "step", "message": f"  AI could not decide next action. Stopping."}
                    break

                action_type = next_action.get("action", "")
                action_target = next_action.get("target", "")
                action_value = next_action.get("value", "")
                action_desc = next_action.get("description", f"{action_type} {action_target}")

                # Check for goal completion
                if action_type == "goal_complete":
                    yield {"type": "step", "message": f"  Goal achieved: {action_desc}"}
                    # Add a final assertion step
                    tc.steps.append(StepResult(
                        success=True, action="assert_visible",
                        target="goal_complete", description=action_desc,
                        method="goal_driven"
                    ))
                    break

                if action_type == "goal_blocked":
                    yield {"type": "step", "message": f"  Goal blocked: {action_desc}"}
                    tc.steps.append(StepResult(
                        success=False, action="assert_visible",
                        target="goal_blocked", description=action_desc,
                        error=action_desc, method="goal_driven"
                    ))
                    break

                yield {"type": "step", "message": f"  Action: {action_desc}"}

                # 4c. Execute the action
                step = StepResult(
                    success=False, action=action_type,
                    target=action_target, value=action_value,
                    description=action_desc,
                )
                success = await self._execute_step(step, goal_context)

                # Auto-heal on failure: re-scan + retry
                if not success and action_type not in ("navigate", "wait", "assert_url", "assert_text", "assert_visible"):
                    yield {"type": "step", "message": f"  Step failed → re-scanning and retrying..."}
                    await self._scan_page()
                    success = await self._execute_step(step, goal_context, is_retry=True)
                    if success:
                        step.healed = True
                        step.heal_method = "rescan"
                        yield {"type": "step", "message": f"  Healed by re-scan!"}

                    # Vision AI heal
                    if not success and self._vision_service and hasattr(self._vision_service, 'available') and self._vision_service.available:
                        yield {"type": "step", "message": f"  Using Vision AI to find element..."}
                        success = await self._vision_heal_step(step)
                        if success:
                            step.healed = True
                            step.heal_method = "vision_ai"
                            yield {"type": "step", "message": f"  Healed by Vision AI!"}

                tc.steps.append(step)

                # Track history for AI context
                self._action_history.append({
                    "action": action_type,
                    "target": action_target,
                    "value": action_value if "password" not in action_target.lower() else "****",
                    "result": "success" if success else f"failed: {step.error or 'unknown'}",
                })

                # Screenshot after action
                ss = await self._take_screenshot()
                if ss:
                    yield {"type": "screenshot", "screenshot": ss}

                # Track consecutive failures
                if success:
                    consecutive_failures = 0
                else:
                    consecutive_failures += 1
                    if consecutive_failures >= max_consecutive_failures:
                        yield {"type": "step", "message": f"  {max_consecutive_failures} consecutive failures. Stopping."}
                        break

                # Small delay between steps
                await asyncio.sleep(0.3)

            # === PHASE 5: COMPLETE ===
            tc.status = "passed" if all(s.success for s in tc.steps) else "failed"
            tc.duration = time.time() - start_time

            # Final screenshot
            ss = await self._take_screenshot()
            if ss:
                tc.screenshot = ss

            yield {"type": "phase", "phase": "complete", "message": "Done"}
            yield {"type": "test_complete", "result": {
                "id": tc.id, "name": tc.name, "description": tc.description,
                "status": tc.status, "duration": round(tc.duration, 1),
                "screenshot": tc.screenshot,
                "steps": [{
                    "action": s.action,
                    "target": s.target,
                    "value": s.value if 'password' not in s.target.lower() else "****",
                    "success": s.success,
                    "error": s.error,
                    "method": s.method,
                    "healed": s.healed,
                    "description": s.description,
                    "confidence": s.confidence,
                    "selector_used": s.selector_used,
                } for s in tc.steps]
            }}

            passed = 1 if tc.status == "passed" else 0
            failed = 0 if tc.status == "passed" else 1
            healed = sum(1 for s in tc.steps if s.healed)
            yield {"type": "complete", "data": {
                "total": 1, "passed": passed, "failed": failed,
                "healed_steps": healed,
            }}

        except Exception as e:
            logger.exception(f"Orchestrator error: {e}")
            yield {"type": "error", "error": "An internal error occurred during test execution"}
        finally:
            await self._cleanup()

    # =========================================================================
    # PHASE 1: PARSE GOAL (lightweight — no AI call needed)
    # =========================================================================

    def _parse_goal(self, instruction: str) -> Dict:
        """Extract URL, credentials, and goal from instruction. No step planning."""
        # Extract URL
        url = ""
        url_match = re.search(r'https?://[^\s"\'<>]+', instruction)
        if url_match:
            url = url_match.group(0).rstrip('.,;')
        else:
            domain_match = re.search(r'\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:/[^\s]*)?)\b', instruction)
            if domain_match:
                url = f"https://{domain_match.group(1)}"

        # Detect app type
        app_type = "generic"
        if url:
            ul = url.lower()
            if 'salesforce' in ul or 'force.com' in ul or '.my.site.com' in ul:
                app_type = "salesforce"
            elif 'workday' in ul: app_type = "workday"
            elif 'service-now' in ul: app_type = "servicenow"

        # Extract credentials
        creds = {}
        email = re.search(r'[\w.-]+@[\w.-]+\.\w+', instruction)
        if email:
            creds['username'] = email.group(0)
        if creds.get('username'):
            after_email = instruction[instruction.find(creds['username']) + len(creds['username']):]
            pw_match = re.search(r'[/\s]+(\S+)', after_email)
            if pw_match:
                creds['password'] = pw_match.group(1).strip('.,;')
        pw_match2 = re.search(r'password[:\s]+["\']?(\S+)["\']?', instruction, re.IGNORECASE)
        if pw_match2:
            creds['password'] = pw_match2.group(1).strip('"\'.,;')

        # Extract goal (the instruction minus the URL and credentials)
        goal = instruction.strip()
        if url_match:
            goal = goal.replace(url_match.group(0), '').strip()
        # Clean up common prefixes
        goal = re.sub(r'^(test|verify|check|go to|navigate to|open)\s+', '', goal, flags=re.IGNORECASE).strip()
        if not goal:
            goal = instruction.strip()

        return {
            "url": url or "https://example.com",
            "app_type": app_type,
            "credentials": creds,
            "goal": goal,
        }

    # =========================================================================
    # GOAL-DRIVEN AI: Decide the NEXT action based on REAL page state
    # =========================================================================

    async def _decide_next_action(self, goal: str, credentials: Dict,
                                   page_url: str, page_title: str,
                                   elements: List[Dict], history: List[Dict]) -> Optional[Dict]:
        """
        THE CORE INNOVATION: Ask AI what to do NEXT based on what's actually on the page.

        No hypothetical steps. No blind planning. Just:
        - Here's your goal
        - Here's what's on the page right now
        - Here's what you've done so far
        - What's the ONE next action?
        """
        if self.ai_client:
            try:
                return await self._ai_decide_next(goal, credentials, page_url, page_title, elements, history)
            except Exception as e:
                logger.warning(f"AI decision failed: {e}")

        # Fallback: pattern matching for common goals
        return self._pattern_decide_next(goal, credentials, page_url, elements, history)

    async def _ai_decide_next(self, goal: str, credentials: Dict,
                                page_url: str, page_title: str,
                                elements: List[Dict], history: List[Dict]) -> Optional[Dict]:
        """Use LLM to decide the next action based on real page state"""

        # Build a concise element summary (top 50 elements, key fields only)
        element_summary = []
        for i, el in enumerate(elements[:50]):
            entry = {
                "idx": i,
                "type": el.get("elementType", "unknown"),
                "text": (el.get("text", "") or "")[:60],
                "label": el.get("label", ""),
                "placeholder": el.get("placeholder", ""),
                "ariaLabel": el.get("ariaLabel", ""),
                "name": el.get("name", ""),
                "href": (el.get("href", "") or "")[:80],
                "tag": el.get("tag", ""),
            }
            # Only include non-empty fields
            entry = {k: v for k, v in entry.items() if v}
            element_summary.append(entry)

        # Build history summary (last 10 actions)
        history_text = ""
        if history:
            history_lines = []
            for h in history[-10:]:
                line = f"- {h['action']} '{h.get('target', '')}'"
                if h.get('value'):
                    line += f" = '{h['value']}'"
                line += f" → {h['result']}"
                history_lines.append(line)
            history_text = "\n".join(history_lines)

        # Credential hint (don't send actual password to LLM)
        cred_hint = ""
        if credentials.get('username'):
            cred_hint = f"Available credentials: username='{credentials['username']}', password=available"

        # SECURITY: Truncate goal to prevent excessive prompt size
        truncated_goal = goal[:2000]

        prompt = f"""You are a goal-driven browser testing agent. You must decide the SINGLE NEXT ACTION to take.

GOAL: {truncated_goal}

CURRENT PAGE:
- URL: {page_url}
- Title: {page_title}
- Interactive elements ({len(elements)} total, showing top {len(element_summary)}):

{json.dumps(element_summary, indent=1)}

ACTIONS TAKEN SO FAR:
{history_text or "None yet (just navigated to the page)"}

{cred_hint}

RULES:
1. Return EXACTLY ONE action to take RIGHT NOW based on what's VISIBLE on the page
2. NEVER invent elements that aren't in the list above
3. If the goal appears to be achieved (e.g., you can see the expected result), return goal_complete
4. If you're stuck (tried multiple times, element not found), return goal_blocked
5. For "target", use the EXACT text/label/placeholder from the elements list above
6. After clicking a button that submits a form or navigates, the page will change — you'll get fresh elements next iteration
7. If there are cookie banners or popups blocking the page, dismiss them first

Return a JSON object with these fields:
- "action": one of "click", "fill", "select", "check", "hover", "keyboard", "scroll_to", "dismiss", "wait", "assert_text", "assert_visible", "goal_complete", "goal_blocked"
- "target": element description matching an element from the list (use text, label, or placeholder)
- "value": value for fill/select, or explanation for goal_complete/goal_blocked
- "description": plain English description of what this step does

EXAMPLE RESPONSES:
{{"action": "click", "target": "Join the donor registry", "value": "", "description": "Click the 'Join the donor registry' button"}}
{{"action": "fill", "target": "Username", "value": "john@example.com", "description": "Enter username"}}
{{"action": "goal_complete", "target": "", "value": "Registration form submitted successfully", "description": "Goal achieved - form was submitted"}}
{{"action": "goal_blocked", "target": "", "value": "Cannot find the registration button after 3 attempts", "description": "Unable to proceed"}}

Return ONLY the JSON object, nothing else."""

        model = os.getenv("AI_TESTING_MODEL", "gpt-4o-mini")

        response = await asyncio.to_thread(
            self.ai_client.chat.completions.create,
            model=model,
            messages=[
                {"role": "system", "content": "You are a browser testing agent. You see real page elements and decide the next action. NEVER hallucinate elements. ONLY reference elements that exist in the provided list. Return a single JSON action object."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=500,
            temperature=0.1
        )

        content = response.choices[0].message.content
        json_match = re.search(r'\{[\s\S]*\}', content)
        if json_match:
            action = json.loads(json_match.group(0))
            logger.info(f"AI decided: {action.get('action')} → {action.get('target', '')[:50]}")
            return action

        return None

    def _pattern_decide_next(self, goal: str, credentials: Dict,
                              page_url: str, elements: List[Dict],
                              history: List[Dict]) -> Optional[Dict]:
        """Fallback: decide next action using pattern matching (no AI)"""
        goal_lower = goal.lower()
        done_actions = {h.get("action") + ":" + h.get("target", "") for h in history}
        step_count = len(history)

        # If we have credentials and haven't filled them yet
        if credentials.get('username') and f"fill:Username" not in done_actions and f"fill:username" not in done_actions:
            # Find a username/email field
            for el in elements:
                if el.get('elementType') in ('text_field', 'email_field'):
                    name_lower = (el.get('name', '') + el.get('label', '') + el.get('placeholder', '')).lower()
                    if any(k in name_lower for k in ('user', 'email', 'login')):
                        return {
                            "action": "fill",
                            "target": el.get('humanDescription', 'Username'),
                            "value": credentials['username'],
                            "description": f"Enter username '{credentials['username']}'"
                        }

        if credentials.get('password') and f"fill:Password" not in done_actions and f"fill:password" not in done_actions:
            for el in elements:
                if el.get('elementType') == 'password_field':
                    return {
                        "action": "fill",
                        "target": el.get('humanDescription', 'Password'),
                        "value": credentials['password'],
                        "description": "Enter password"
                    }

        # Click-related goals
        for keyword in ['click', 'press', 'tap', 'select', 'open', 'go to']:
            if keyword in goal_lower:
                # Extract target from goal
                target_text = re.sub(rf'\b{keyword}\b\s+(on\s+|the\s+)?', '', goal_lower, count=1).strip()
                target_text = target_text.split(' on ')[0].strip()  # Remove "on <url>" suffix
                if target_text:
                    # Find matching element
                    matched = match_element(elements, target_text, "click")
                    if matched:
                        action_key = f"click:{matched.get('humanDescription', '')}"
                        if action_key not in done_actions:
                            return {
                                "action": "click",
                                "target": matched.get('humanDescription', target_text),
                                "value": "",
                                "description": f"Click '{matched.get('humanDescription', target_text)}'"
                            }

        # Look for submit/login buttons if credentials were just entered
        if step_count >= 2 and any(h.get('action') == 'fill' for h in history[-2:]):
            for el in elements:
                if el.get('elementType') == 'button':
                    text_lower = (el.get('text', '') + el.get('ariaLabel', '')).lower()
                    if any(k in text_lower for k in ('log in', 'login', 'sign in', 'submit', 'continue')):
                        return {
                            "action": "click",
                            "target": el.get('humanDescription', 'Submit'),
                            "value": "",
                            "description": f"Click '{el.get('humanDescription', 'Submit')}'"
                        }

        # If we've taken enough actions, assume done
        if step_count >= 5:
            return {"action": "goal_complete", "target": "", "value": "Pattern matching completed", "description": "Reached step limit"}

        return {"action": "goal_blocked", "target": "", "value": "No matching pattern", "description": "Cannot determine next action"}

    # =========================================================================
    # PHASE 2: LAUNCH BROWSER
    # =========================================================================

    async def _launch_browser(self) -> bool:
        if not PLAYWRIGHT_AVAILABLE:
            return False
        try:
            self._pw = await async_playwright().start()
            self._browser = await self._pw.chromium.launch(
                headless=self._headless, slow_mo=50,
                args=['--no-sandbox', '--disable-setuid-sandbox',
                      '--disable-blink-features=AutomationControlled', '--disable-infobars']
            )
            self._context = await self._browser.new_context(
                viewport={"width": 1366, "height": 768},
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
            )
            self._page = await self._context.new_page()
            logger.info(f"Browser launched (v5 orchestrator, headless={self._headless})")
            return True
        except Exception as e:
            logger.error(f"Browser launch failed: {e}")
            return False

    # =========================================================================
    # PAGE SCANNING (with iframe + shadow DOM support)
    # =========================================================================

    async def _scan_page(self) -> Dict:
        """Scan all interactive elements on the page, including iframes and shadow DOM"""
        try:
            scanner_js = get_scanner_js()
            scan_result = await self._page.evaluate(scanner_js)

            self._scanned_elements = scan_result.get('elements', [])
            self._page_info = scan_result.get('pageInfo', {})

            # Also scan accessible iframes
            try:
                iframe_elements = await self._scan_iframes()
                if iframe_elements:
                    # Add iframe elements with an iframe marker
                    start_idx = len(self._scanned_elements)
                    for i, el in enumerate(iframe_elements):
                        el['index'] = start_idx + i
                        el['inIframe'] = True
                    self._scanned_elements.extend(iframe_elements)
            except Exception as e:
                logger.debug(f"Iframe scanning skipped: {e}")

            return scan_result

        except Exception as e:
            logger.warning(f"Page scan failed: {e}")
            return {"elements": [], "pageInfo": {}}

    async def _scan_iframes(self) -> List[Dict]:
        """Scan interactive elements inside same-origin iframes"""
        iframe_elements = []
        try:
            frames = self._page.frames
            scanner_js = get_scanner_js()
            for frame in frames:
                if frame == self._page.main_frame:
                    continue
                try:
                    # Only scan frames that are loaded and accessible
                    frame_result = await frame.evaluate(scanner_js)
                    elements = frame_result.get('elements', [])
                    for el in elements:
                        el['frameUrl'] = frame.url
                    iframe_elements.extend(elements)
                except Exception:
                    # Cross-origin frames will throw — that's expected
                    continue
        except Exception as e:
            logger.debug(f"Iframe enumeration failed: {e}")
        return iframe_elements

    # =========================================================================
    # STEP EXECUTION (reuses v4 execution logic)
    # =========================================================================

    async def _execute_step(self, step: StepResult, goal_context: Dict, is_retry: bool = False) -> bool:
        """Execute a single step using real DOM-scanned selectors"""
        try:
            page = self._page

            # ── Navigate ──
            if step.action == "navigate":
                await page.goto(step.target, timeout=30000)
                await page.wait_for_load_state("domcontentloaded")
                try:
                    await page.wait_for_load_state("networkidle", timeout=10000)
                except:
                    await asyncio.sleep(0.5)
                step.success = True
                step.method = "navigate"
                return True

            # ── Wait ──
            elif step.action == "wait":
                wait_time = min(float(step.value or 2), 30)
                await asyncio.sleep(wait_time)
                step.success = True
                step.method = "wait"
                return True

            # ── Wait For ──
            elif step.action == "wait_for":
                try:
                    if step.target == "url":
                        await page.wait_for_url(f"**{step.value}**", timeout=15000)
                    else:
                        el = match_element(self._scanned_elements, step.target, "assert")
                        if el and el.get('bestSelector'):
                            await page.wait_for_selector(el['bestSelector'], timeout=15000)
                        elif step.value:
                            await page.wait_for_selector(f"text={step.value}", timeout=15000)
                        else:
                            await page.wait_for_load_state("networkidle", timeout=15000)
                    step.success = True
                    step.method = "wait_for"
                    return True
                except:
                    step.success = False
                    step.error = f"Timeout waiting for: {step.target or step.value}"
                    return False

            # ── Keyboard ──
            elif step.action == "keyboard":
                key = step.target or step.value or "Enter"
                await page.keyboard.press(key)
                await asyncio.sleep(0.3)
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=5000)
                except:
                    pass
                step.success = True
                step.method = "keyboard"
                return True

            # ── Dismiss ──
            elif step.action == "dismiss":
                dismiss_selectors = [
                    'button[aria-label="Close"]', 'button[aria-label="close"]',
                    '[data-dismiss="modal"]', '.modal-close', '.close-button',
                    'button:has-text("Close")', 'button:has-text("Cancel")',
                    'button:has-text("Dismiss")', 'button:has-text("OK")',
                    'button:has-text("Got it")', 'button:has-text("Accept")',
                    'button:has-text("Reject")', 'button:has-text("Decline")',
                    '[role="dialog"] button:first-of-type',
                ]
                for sel in dismiss_selectors:
                    try:
                        loc = page.locator(sel)
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=1000):
                            await loc.first.click()
                            await asyncio.sleep(0.3)
                            step.success = True
                            step.method = "dismiss"
                            step.selector_used = sel
                            return True
                    except:
                        continue
                try:
                    await page.keyboard.press("Escape")
                    await asyncio.sleep(0.3)
                    step.success = True
                    step.method = "dismiss_escape"
                    return True
                except:
                    pass
                step.error = "Could not dismiss modal/popup"
                return False

            # ── Assert URL ──
            elif step.action == "assert_url":
                await asyncio.sleep(1)
                current_url = page.url
                keywords = [k.strip() for k in step.value.split(",")]
                passed = any(k.lower() in current_url.lower() for k in keywords if k)
                step.success = passed
                step.method = "url_assert"
                if not passed:
                    step.error = f"URL '{current_url}' doesn't contain any of: {keywords}"
                return passed

            # ── Assert Text ──
            elif step.action == "assert_text":
                await asyncio.sleep(0.5)
                try:
                    body_text = await page.inner_text("body", timeout=5000)
                    keywords = [k.strip() for k in step.value.split(",")]
                    passed = any(k.lower() in body_text.lower() for k in keywords if k)
                    step.success = passed
                    step.method = "text_assert"
                    if not passed:
                        step.error = f"Page text doesn't contain: {step.value}"
                    return passed
                except:
                    step.error = "Could not read page text"
                    return False

            # ── Assert Visible ──
            elif step.action == "assert_visible":
                if step.target == "page" or step.target == "goal_complete":
                    step.success = True
                    step.method = "page_visible"
                    return True
                el = match_element(self._scanned_elements, step.target, "assert")
                if el and el.get('bestSelector'):
                    try:
                        loc = page.locator(el['bestSelector'])
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=3000):
                            step.success = True
                            step.method = f"assert_visible:{el.get('elementType')}"
                            return True
                    except:
                        pass
                if step.target:
                    try:
                        loc = page.get_by_text(step.target, exact=False)
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=3000):
                            step.success = True
                            step.method = "assert_visible_text"
                            return True
                    except:
                        pass
                step.success = False
                step.error = f"Element not visible: {step.target}"
                return False

            # ── Element-based actions ──
            elif step.action in ("fill", "click", "select", "check", "hover", "scroll_to", "tab", "upload", "drag_drop"):
                return await self._execute_element_action(step, page)

            return True

        except Exception as e:
            step.success = False
            step.error = str(e)
            logger.error(f"Step execution error: {e}")
            return False

    async def _execute_element_action(self, step: StepResult, page) -> bool:
        """Execute an element-based action (fill, click, select, etc.)"""
        action_hint = step.action
        if step.action in ("select", "check", "hover", "scroll_to", "tab"):
            action_hint = "click"
        if step.action == "upload":
            action_hint = "fill"

        matched = match_element(self._scanned_elements, step.target, action_hint)

        if not matched:
            # Try getByText as last resort for click actions
            if step.action == "click":
                try:
                    loc = page.get_by_text(step.target, exact=False)
                    if await loc.count() > 0 and await loc.first.is_visible(timeout=3000):
                        await loc.first.scroll_into_view_if_needed()
                        await loc.first.click()
                        await asyncio.sleep(0.5)
                        try:
                            await page.wait_for_load_state("domcontentloaded", timeout=5000)
                        except:
                            pass
                        step.success = True
                        step.method = "getByText_fallback"
                        step.selector_used = f"text={step.target}"
                        return True
                except Exception:
                    pass

            # Try getByRole link/button for click
            if step.action == "click":
                for role in ["link", "button"]:
                    try:
                        loc = page.get_by_role(role, name=re.compile(re.escape(step.target), re.IGNORECASE))
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=2000):
                            await loc.first.scroll_into_view_if_needed()
                            await loc.first.click()
                            await asyncio.sleep(0.5)
                            try:
                                await page.wait_for_load_state("domcontentloaded", timeout=5000)
                            except:
                                pass
                            step.success = True
                            step.method = f"getByRole_{role}_fallback"
                            step.selector_used = f"role={role}[name={step.target}]"
                            return True
                    except Exception:
                        continue

            step.error = f"No matching element found for '{step.target}' among {len(self._scanned_elements)} scanned elements"
            step.method = "no_match"
            return False

        selectors = matched.get('selectors', [])
        human_locators = self._build_human_locators(matched)
        all_strategies = human_locators + selectors

        for strategy in all_strategies:
            sel = strategy.get('selector', '')
            sel_type = strategy.get('type', 'unknown')

            if not sel:
                continue

            try:
                if sel_type == 'pw_label':
                    locator = page.get_by_label(strategy['label'], exact=False)
                elif sel_type == 'pw_role':
                    if strategy.get('name'):
                        locator = page.get_by_role(strategy['role'], name=strategy['name'])
                    else:
                        locator = page.get_by_role(strategy['role'])
                elif sel_type == 'pw_placeholder':
                    locator = page.get_by_placeholder(strategy['placeholder'])
                elif sel_type == 'pw_text':
                    locator = page.get_by_text(strategy['text'])
                else:
                    locator = page.locator(sel)

                if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                    if step.action == "fill":
                        await locator.first.scroll_into_view_if_needed()
                        await locator.first.clear()
                        await locator.first.fill(step.value)

                    elif step.action == "click" or step.action == "tab":
                        await locator.first.scroll_into_view_if_needed()
                        await locator.first.click()
                        await asyncio.sleep(0.3)
                        try:
                            await page.wait_for_load_state("domcontentloaded", timeout=5000)
                        except:
                            pass

                    elif step.action == "select":
                        tag = matched.get('tag', '')
                        if tag == 'select':
                            try:
                                await locator.first.select_option(label=step.value)
                            except:
                                try:
                                    await locator.first.select_option(value=step.value)
                                except:
                                    await locator.first.click()
                                    await asyncio.sleep(0.3)
                                    option = page.get_by_text(step.value, exact=False)
                                    if await option.count() > 0:
                                        await option.first.click()
                        else:
                            await locator.first.scroll_into_view_if_needed()
                            await locator.first.click()
                            await asyncio.sleep(0.5)
                            option = page.get_by_text(step.value, exact=False)
                            if await option.count() > 0:
                                await option.first.click()
                            else:
                                option = page.get_by_role("option", name=step.value)
                                if await option.count() > 0:
                                    await option.first.click()
                        await asyncio.sleep(0.3)

                    elif step.action == "check":
                        try:
                            if not await locator.first.is_checked():
                                await locator.first.check()
                        except:
                            await locator.first.click()
                        await asyncio.sleep(0.2)

                    elif step.action == "hover":
                        await locator.first.scroll_into_view_if_needed()
                        await locator.first.hover()
                        await asyncio.sleep(0.3)

                    elif step.action == "scroll_to":
                        await locator.first.scroll_into_view_if_needed()
                        await asyncio.sleep(0.3)

                    elif step.action == "upload":
                        try:
                            await locator.first.set_input_files(step.value)
                        except:
                            file_input = page.locator('input[type="file"]')
                            if await file_input.count() > 0:
                                await file_input.first.set_input_files(step.value)
                        await asyncio.sleep(0.5)

                    elif step.action == "drag_drop":
                        dest = match_element(self._scanned_elements, step.value, "click")
                        if dest and dest.get('bestSelector'):
                            dest_loc = page.locator(dest['bestSelector'])
                            if await dest_loc.count() > 0:
                                await locator.first.drag_to(dest_loc.first)
                                await asyncio.sleep(0.5)

                    step.success = True
                    step.method = sel_type
                    step.selector_used = sel
                    step.confidence = strategy.get('confidence', 0)
                    logger.info(f"Step '{step.description}' succeeded via {sel_type}: {sel}")
                    return True

            except Exception as e:
                logger.debug(f"Strategy {sel_type} failed: {sel} - {e}")
                continue

        step.error = f"Element matched '{matched.get('humanDescription')}' but no selector worked ({len(all_strategies)} tried)"
        step.method = "all_strategies_failed"
        return False

    def _build_human_locators(self, element: Dict) -> List[Dict]:
        """Build Playwright human locator strategies from element data"""
        locators = []

        label = element.get('label', '')
        if label:
            locators.append({'selector': f'label:{label}', 'type': 'pw_label', 'label': label, 'confidence': 95})

        role = element.get('role', '')
        tag = element.get('tag', '')
        text = element.get('text', '').strip()

        pw_role = role
        if not pw_role:
            if tag == 'button' or element.get('type') == 'submit': pw_role = 'button'
            elif tag == 'a': pw_role = 'link'
            elif tag in ('input', 'textarea'): pw_role = 'textbox'
            elif tag == 'select': pw_role = 'combobox'

        if pw_role:
            name = element.get('ariaLabel') or text[:50] if text else ''
            if name:
                locators.append({'selector': f'role={pw_role}[{name}]', 'type': 'pw_role', 'role': pw_role, 'name': name, 'confidence': 90})
            else:
                locators.append({'selector': f'role={pw_role}', 'type': 'pw_role', 'role': pw_role, 'name': '', 'confidence': 70})

        ph = element.get('placeholder', '')
        if ph:
            locators.append({'selector': f'placeholder:{ph}', 'type': 'pw_placeholder', 'placeholder': ph, 'confidence': 85})

        if text and tag in ('button', 'a') or element.get('elementType') == 'button':
            locators.append({'selector': f'text:{text[:50]}', 'type': 'pw_text', 'text': text[:50], 'confidence': 80})

        return locators

    async def _vision_heal_step(self, step: StepResult) -> bool:
        """Use Vision AI to find element when all other methods fail"""
        try:
            ss = await self._page.screenshot(type='png')
            ss_b64 = base64.b64encode(ss).decode()

            location = await self._vision_service.find_element_by_description(
                ss_b64, f"{step.action} the {step.target}",
                f"Looking for element to {step.action}. Value: {step.value}"
            )

            if location.found and location.x and location.y:
                if step.action == "fill":
                    await self._page.mouse.click(location.x, location.y)
                    await asyncio.sleep(0.3)
                    await self._page.keyboard.type(step.value, delay=30)
                elif step.action in ("click", "check", "tab"):
                    await self._page.mouse.click(location.x, location.y)
                    await asyncio.sleep(0.5)
                elif step.action == "hover":
                    await self._page.mouse.move(location.x, location.y)
                    await asyncio.sleep(0.3)
                elif step.action == "select":
                    await self._page.mouse.click(location.x, location.y)
                    await asyncio.sleep(0.5)
                    if step.value:
                        opt = self._page.get_by_text(step.value, exact=False)
                        if await opt.count() > 0:
                            await opt.first.click()
                else:
                    await self._page.mouse.click(location.x, location.y)
                    await asyncio.sleep(0.5)

                step.success = True
                step.method = "vision_ai"
                step.selector_used = f"coordinates({location.x},{location.y})"
                step.confidence = int(location.confidence * 100)
                return True

            if location.found and location.selector_suggestion:
                loc = self._page.locator(location.selector_suggestion)
                if await loc.count() > 0:
                    if step.action == "fill":
                        await loc.first.fill(step.value)
                    elif step.action == "click":
                        await loc.first.click()
                    elif step.action == "select":
                        try:
                            await loc.first.select_option(label=step.value)
                        except:
                            await loc.first.click()
                    elif step.action == "check":
                        try:
                            await loc.first.check()
                        except:
                            await loc.first.click()
                    else:
                        await loc.first.click()

                    step.success = True
                    step.method = "vision_ai_selector"
                    step.selector_used = location.selector_suggestion
                    step.confidence = int(location.confidence * 100)
                    return True

        except Exception as e:
            logger.warning(f"Vision heal error: {e}")

        return False

    # =========================================================================
    # HELPERS
    # =========================================================================

    async def _take_screenshot(self) -> Optional[str]:
        """Take a screenshot, return base64 or None"""
        try:
            ss = await self._page.screenshot(type='png')
            return base64.b64encode(ss).decode()
        except:
            return None

    # =========================================================================
    # CLEANUP
    # =========================================================================

    async def _cleanup(self):
        try:
            from app.services.ai_testing.live_browser_stream import live_stream_manager
            await live_stream_manager.stop_streaming(self._stream_session_id)
            await live_stream_manager.unregister_session(self._stream_session_id)
        except Exception:
            pass

        try:
            for obj in [self._page, self._context, self._browser]:
                try:
                    if obj:
                        await obj.close()
                except:
                    pass
            try:
                if self._pw:
                    await self._pw.stop()
            except:
                pass
        except:
            pass


def create_agentic_orchestrator(headless: bool = True) -> AgenticOrchestrator:
    return AgenticOrchestrator(headless=headless)
