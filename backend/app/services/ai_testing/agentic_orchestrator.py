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
    """v5.1 - Goal-driven orchestrator: LLM decides WHAT, deterministic code finds HOW"""

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
        self._last_page_state: str = ""  # Track URL+title for stale detection
        self._selector_cache: Dict[str, str] = {}  # Cache successful selectors
        self._goal_blocked_retries: int = 0  # Counter for goal_blocked auto-heal attempts
        self._active_frame = None  # Track if we switched to an iframe
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
            goal_completed_by_ai = False  # Track if AI explicitly said "goal_complete"

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

                # ── LOOP DETECTION: catch repeated identical actions on same page ──
                current_page_state = f"{page_url}|{page_title}"
                if self._action_history:
                    repeat_key = f"{action_type}:{action_target}"
                    # Count how many times this exact action was done on the SAME page state
                    recent_repeats = 0
                    for h in self._action_history[-5:]:
                        h_key = f"{h['action']}:{h.get('target','')}"
                        h_page = h.get('page_state', '')
                        if h_key == repeat_key and h_page == current_page_state:
                            recent_repeats += 1
                    if recent_repeats >= 2:
                        yield {"type": "step", "message": f"  ⚠ Loop detected: '{action_desc}' repeated {recent_repeats + 1} times on same page. Stopping."}
                        tc.steps.append(StepResult(
                            success=False, action="loop_detected",
                            target=action_target, description=f"Loop: repeated '{action_desc}' {recent_repeats + 1} times on same page",
                            error=f"Agent stuck in loop repeating: {action_type} '{action_target}'",
                            method="loop_detection"
                        ))
                        break

                # Check for goal completion
                if action_type == "goal_complete":
                    yield {"type": "step", "message": f"  Goal achieved: {action_desc}"}
                    goal_completed_by_ai = True
                    tc.steps.append(StepResult(
                        success=True, action="assert_visible",
                        target="goal_complete", description=action_desc,
                        method="goal_driven"
                    ))
                    break

                if action_type == "goal_blocked":
                    # ── AUTO-HEAL: Don't trust goal_blocked immediately ──
                    # AI said it can't find the element, but it might be:
                    #   - Below viewport (needs scroll)
                    #   - Inside an iframe (needs frame traversal)
                    #   - Loading asynchronously (needs wait)
                    #   - A non-standard element the scanner missed
                    blocked_healed = False
                    blocked_target = action_value or action_desc  # What we're looking for

                    # Extract the element name from messages like "clicking the '18-35 button'"
                    import re as _re
                    name_match = _re.search(r"'([^']+)'", blocked_target)
                    search_text = name_match.group(1) if name_match else blocked_target

                    if not getattr(self, '_goal_blocked_retries', 0):
                        self._goal_blocked_retries = 0

                    if self._goal_blocked_retries < 3:
                        self._goal_blocked_retries += 1
                        retry_num = self._goal_blocked_retries
                        yield {"type": "step", "message": f"  AI says blocked — auto-healing attempt {retry_num}/3: looking for '{search_text}'..."}

                        page = self._page

                        # Attempt 1: Scroll down to reveal hidden elements
                        if retry_num >= 1 and not blocked_healed:
                            try:
                                yield {"type": "step", "message": f"  Scrolling page to find '{search_text}'..."}
                                # Try scrolling down in increments
                                for scroll_i in range(3):
                                    await page.evaluate("window.scrollBy(0, 400)")
                                    await asyncio.sleep(0.3)
                                    # Check if element appeared
                                    try:
                                        loc = page.get_by_text(search_text, exact=True)
                                        if await loc.count() > 0 and await loc.first.is_visible(timeout=1000):
                                            yield {"type": "step", "message": f"  Found '{search_text}' after scrolling!"}
                                            blocked_healed = True
                                            break
                                    except:
                                        pass
                                if not blocked_healed:
                                    # Scroll back to top
                                    await page.evaluate("window.scrollTo(0, 0)")
                                    await asyncio.sleep(0.3)
                            except Exception as e:
                                logger.debug(f"Scroll heal failed: {e}")

                        # Attempt 2: Wait for dynamic content (LWC/React async render)
                        if retry_num >= 1 and not blocked_healed:
                            try:
                                yield {"type": "step", "message": f"  Waiting for dynamic content..."}
                                await asyncio.sleep(2)
                                # Re-check after wait
                                loc = page.get_by_text(search_text, exact=True)
                                if await loc.count() > 0 and await loc.first.is_visible(timeout=2000):
                                    yield {"type": "step", "message": f"  Found '{search_text}' after waiting!"}
                                    blocked_healed = True
                            except:
                                pass

                        # Attempt 3: Check iframes
                        if retry_num >= 2 and not blocked_healed:
                            try:
                                yield {"type": "step", "message": f"  Checking iframes for '{search_text}'..."}
                                frames = page.frames
                                for frame in frames:
                                    if frame == page.main_frame:
                                        continue
                                    try:
                                        loc = frame.get_by_text(search_text, exact=True)
                                        if await loc.count() > 0 and await loc.first.is_visible(timeout=1500):
                                            yield {"type": "step", "message": f"  Found '{search_text}' in iframe!"}
                                            # Switch to this frame for subsequent actions
                                            self._active_frame = frame
                                            blocked_healed = True
                                            break
                                    except:
                                        continue
                            except Exception as e:
                                logger.debug(f"Iframe heal failed: {e}")

                        # Attempt 4: Try direct element resolution (bypass AI, use 5-layer pipeline)
                        if not blocked_healed:
                            yield {"type": "step", "message": f"  Trying direct element resolution for '{search_text}'..."}
                            await self._scan_page()
                            direct_step = StepResult(
                                success=False, action="click",
                                target=search_text, description=f"Click on the {search_text}",
                            )
                            direct_ok = await self._execute_element_action(direct_step, page)
                            if direct_ok:
                                yield {"type": "step", "message": f"  ✓ Direct resolution found '{search_text}' via {direct_step.method}!"}
                                direct_step.healed = True
                                direct_step.heal_method = f"goal_blocked_heal_{direct_step.method}"
                                tc.steps.append(direct_step)
                                blocked_healed = True
                                # Reset blocked retries on success
                                self._goal_blocked_retries = 0
                                # Track in history
                                self._action_history.append({
                                    "action": "click", "target": search_text,
                                    "value": "", "result": "success (healed from goal_blocked)",
                                    "page_url": page_url, "page_state": current_page_state,
                                })
                                continue  # Continue the goal loop

                        if blocked_healed:
                            # Re-scan and let the AI try again
                            yield {"type": "step", "message": f"  Element found — re-scanning and continuing..."}
                            await self._scan_page()
                            continue  # Continue the goal loop

                    # All retries exhausted — truly blocked
                    yield {"type": "step", "message": f"  Goal blocked after {self._goal_blocked_retries} heal attempts: {action_desc}"}
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

                # ── AUTO-HEAL on failure: multi-strategy retry ──
                if not success and action_type not in ("navigate", "wait", "assert_url", "assert_text", "assert_visible"):
                    # Heal 1: Wait for dynamic content + re-scan
                    yield {"type": "step", "message": f"  Step failed → waiting + re-scanning..."}
                    await asyncio.sleep(1.5)
                    await self._scan_page()
                    success = await self._execute_step(step, goal_context, is_retry=True)
                    if success:
                        step.healed = True
                        step.heal_method = "rescan_wait"
                        yield {"type": "step", "message": f"  ✓ Healed by wait + re-scan!"}

                    # Heal 2: Scroll to find off-screen elements
                    if not success:
                        try:
                            yield {"type": "step", "message": f"  Scrolling to find element..."}
                            for _ in range(3):
                                await page.evaluate("window.scrollBy(0, 350)")
                                await asyncio.sleep(0.3)
                            await self._scan_page()
                            success = await self._execute_step(step, goal_context, is_retry=True)
                            if success:
                                step.healed = True
                                step.heal_method = "scroll_heal"
                                yield {"type": "step", "message": f"  ✓ Healed by scroll!"}
                            else:
                                # Scroll back
                                await page.evaluate("window.scrollTo(0, 0)")
                        except:
                            pass

                    # Heal 3: Check iframes
                    if not success:
                        try:
                            frames = page.frames
                            if len(frames) > 1:
                                yield {"type": "step", "message": f"  Checking {len(frames)-1} iframe(s)..."}
                                for frame in frames:
                                    if frame == page.main_frame:
                                        continue
                                    try:
                                        loc = frame.get_by_text(step.target, exact=True)
                                        if await loc.count() > 0 and await loc.first.is_visible(timeout=1500):
                                            ok = await self._perform_action(loc.first, step, page)
                                            if ok:
                                                step.healed = True
                                                step.heal_method = "iframe_heal"
                                                step.method = "iframe_text"
                                                success = True
                                                yield {"type": "step", "message": f"  ✓ Healed via iframe!"}
                                                break
                                    except:
                                        continue
                        except:
                            pass

                    # Heal 4: Vision AI (last resort)
                    if not success and self._vision_service and hasattr(self._vision_service, 'available') and self._vision_service.available:
                        yield {"type": "step", "message": f"  Using Vision AI to find element..."}
                        success = await self._vision_heal_step(step)
                        if success:
                            step.healed = True
                            step.heal_method = "vision_ai"
                            yield {"type": "step", "message": f"  ✓ Healed by Vision AI!"}

                tc.steps.append(step)

                # Track history for AI context + loop detection
                self._action_history.append({
                    "action": action_type,
                    "target": action_target,
                    "value": action_value if "password" not in action_target.lower() else "****",
                    "result": "success" if success else f"failed: {step.error or 'unknown'}",
                    "page_url": page_url,
                    "page_state": current_page_state,
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
            # A test only passes if:
            # 1. AI explicitly declared "goal_complete", AND
            # 2. All executed steps succeeded
            # If the loop ended because we hit MAX_AGENT_STEPS or loop detection, that's a failure.
            all_steps_ok = all(s.success for s in tc.steps)
            tc.status = "passed" if (goal_completed_by_ai and all_steps_ok) else "failed"
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

        # Build history summary (ALL actions, not just last 10)
        history_text = ""
        if history:
            history_lines = []
            for i, h in enumerate(history):
                line = f"{i+1}. {h['action']} '{h.get('target', '')}'"
                if h.get('value'):
                    line += f" = '{h['value']}'"
                line += f" → {h['result']}"
                history_lines.append(line)
            history_text = "\n".join(history_lines)

        # Detect if the same action has been repeated recently
        repeat_warning = ""
        if len(history) >= 2:
            last_action = f"{history[-1].get('action')}:{history[-1].get('target','')}"
            second_last = f"{history[-2].get('action')}:{history[-2].get('target','')}" if len(history) >= 2 else ""
            if last_action == second_last:
                repeat_warning = f"\n⚠ WARNING: You just repeated '{history[-1].get('action')} {history[-1].get('target','')}' twice. DO NOT repeat it again. Either try a DIFFERENT action or return goal_blocked.\n"

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
{repeat_warning}
{cred_hint}

CRITICAL RULES:
1. Return EXACTLY ONE action to take RIGHT NOW based on what's VISIBLE on the page
2. NEVER invent elements that aren't in the list above — only reference elements you can see
3. NEVER repeat the same action+target combination you already did. If you already clicked 'Next', DO NOT click 'Next' again unless the page has clearly changed (different URL or title)
4. Work through the goal STEP BY STEP. The goal may have multiple parts (e.g., "1. Click X, 2. Click Y, 3. Click Z"). Check which parts you've completed in the history, and do the NEXT uncompleted part
5. If the goal mentions clicking a specific element (e.g., "Click on 18-35 button"), you MUST find and click THAT element before proceeding to subsequent steps
6. If the goal appears to be fully achieved (ALL parts completed), return goal_complete
7. If you're stuck (can't find the right element after looking at the list), return goal_blocked — do NOT keep clicking random buttons
8. For "target", use the EXACT text/label/placeholder from the elements list above
9. After clicking a button that submits a form or navigates, the page will change — you'll get fresh elements next iteration
10. If there are cookie banners or popups blocking the page, dismiss them first

Return a JSON object with these fields:
- "action": one of "click", "fill", "select", "check", "hover", "keyboard", "scroll_to", "dismiss", "wait", "assert_text", "assert_visible", "goal_complete", "goal_blocked"
- "target": element description matching an element from the list (use text, label, or placeholder)
- "value": value for fill/select, or explanation for goal_complete/goal_blocked
- "description": plain English description of what this step does

Return ONLY the JSON object, nothing else."""

        model = os.getenv("AI_TESTING_MODEL", "gpt-4o-mini")

        response = await asyncio.to_thread(
            self.ai_client.chat.completions.create,
            model=model,
            messages=[
                {"role": "system", "content": "You are a browser testing agent. You see real page elements and decide the next action. CRITICAL RULES: 1) NEVER hallucinate elements — ONLY reference elements in the provided list. 2) NEVER repeat the same action you already performed — check the history carefully. 3) Work through multi-step goals IN ORDER — don't skip steps. 4) If an element from the goal isn't visible in the elements list, return goal_blocked instead of clicking something else. Return a single JSON action object."},
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

        # If we've taken enough actions without finding a match, we're stuck — don't false-pass
        if step_count >= 5:
            return {"action": "goal_blocked", "target": "", "value": "Pattern matching exhausted without completing all goal steps", "description": "Cannot determine next action"}

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
        """
        Execute an element-based action using a 5-layer resolution pipeline:

        Layer 1: Selector cache (instant — reuse previous success)
        Layer 2: Direct Playwright locators (getByRole, getByText, getByLabel — fast, reliable)
        Layer 3: PageScanner match_element + ranked selectors (13 strategies)
        Layer 4: App-specific CSS selectors (Salesforce/Workday/ServiceNow)
        Layer 5: Vision AI (screenshot → GPT-4V → coordinates)

        The LLM decides WHAT to do. This function finds HOW.
        """
        target = step.target
        action = step.action

        # ── LAYER 1: Selector cache (0ms) ──
        cache_key = f"{action}:{target.lower()}"
        if cache_key in self._selector_cache:
            cached_sel = self._selector_cache[cache_key]
            try:
                loc = page.locator(cached_sel)
                if await loc.count() > 0 and await loc.first.is_visible(timeout=1500):
                    ok = await self._perform_action(loc.first, step, page)
                    if ok:
                        step.method = "cache"
                        step.selector_used = cached_sel
                        step.confidence = 99
                        return True
            except:
                del self._selector_cache[cache_key]

        # ── LAYER 2: Direct Playwright human locators (100ms, free, most reliable) ──
        pw_strategies = self._build_playwright_strategies(target, action)
        for strat in pw_strategies:
            try:
                locator = strat["locator_fn"]()
                if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                    ok = await self._perform_action(locator.first, step, page)
                    if ok:
                        step.method = strat["method"]
                        step.selector_used = strat["desc"]
                        step.confidence = strat["confidence"]
                        self._selector_cache[cache_key] = strat.get("cache_sel", strat["desc"])
                        logger.info(f"Step '{step.description}' → {strat['method']}: {strat['desc']}")
                        return True
            except Exception as e:
                logger.debug(f"Playwright strategy {strat['method']} failed: {e}")
                continue

        # ── LAYER 3: PageScanner match_element + ranked selectors ──
        action_hint = action if action not in ("select", "check", "hover", "scroll_to", "tab") else "click"
        if action == "upload":
            action_hint = "fill"

        matched = match_element(self._scanned_elements, target, action_hint)
        if matched:
            # Use PageScanner's confidence-sorted selectors + human locators
            human_locators = self._build_human_locators(matched)
            scanner_selectors = matched.get('selectors', [])
            # Sort by confidence (highest first)
            all_strategies = sorted(
                human_locators + scanner_selectors,
                key=lambda s: s.get('confidence', 0),
                reverse=True
            )

            for strategy in all_strategies:
                sel = strategy.get('selector', '')
                sel_type = strategy.get('type', 'unknown')
                if not sel:
                    continue

                try:
                    if sel_type == 'pw_label':
                        locator = page.get_by_label(strategy['label'], exact=False)
                    elif sel_type == 'pw_role':
                        locator = page.get_by_role(strategy['role'], name=strategy['name']) if strategy.get('name') else page.get_by_role(strategy['role'])
                    elif sel_type == 'pw_placeholder':
                        locator = page.get_by_placeholder(strategy['placeholder'])
                    elif sel_type == 'pw_text':
                        locator = page.get_by_text(strategy['text'])
                    else:
                        locator = page.locator(sel)

                    if await locator.count() > 0 and await locator.first.is_visible(timeout=2000):
                        ok = await self._perform_action(locator.first, step, page, matched=matched)
                        if ok:
                            step.method = sel_type
                            step.selector_used = sel
                            step.confidence = strategy.get('confidence', 0)
                            self._selector_cache[cache_key] = sel
                            logger.info(f"Step '{step.description}' → PageScanner {sel_type}: {sel}")
                            return True
                except Exception as e:
                    logger.debug(f"Scanner strategy {sel_type} failed: {sel} - {e}")
                    continue

        # ── LAYER 4: App-specific CSS selectors ──
        app_type = self._page_info.get('app_type', 'generic')
        if not app_type or app_type == 'generic':
            # Auto-detect from URL
            url = page.url.lower()
            if 'salesforce' in url or 'force.com' in url or '.my.site.com' in url:
                app_type = 'salesforce'
            elif 'workday' in url:
                app_type = 'workday'
            elif 'service-now' in url:
                app_type = 'servicenow'

        try:
            from app.services.ai_testing.human_element_finder import APP_ATTRIBUTES, NL_TO_ELEMENT
            # Classify what type of element we're looking for
            target_lower = target.lower()
            element_type = None
            for pattern, etype in NL_TO_ELEMENT.items():
                if re.search(pattern, target_lower):
                    element_type = etype
                    break

            if element_type:
                app_selectors = APP_ATTRIBUTES.get(app_type, {}).get(element_type, [])
                generic_selectors = APP_ATTRIBUTES.get("generic", {}).get(element_type, [])
                for sel in app_selectors + generic_selectors:
                    try:
                        loc = page.locator(sel)
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=1500):
                            ok = await self._perform_action(loc.first, step, page)
                            if ok:
                                step.method = f"app_specific_{app_type}"
                                step.selector_used = sel
                                step.confidence = 85
                                self._selector_cache[cache_key] = sel
                                return True
                    except:
                        continue
        except ImportError:
            pass

        # ── LAYER 5: Vision AI (screenshot → LLM → coordinates) ──
        # Uses the SAME OpenAI client as _decide_next_action — no separate service needed
        if self.ai_client:
            ok = await self._vision_find_element(step, page, target, action)
            if ok:
                return True

        # Legacy vision service fallback
        if self._vision_service and hasattr(self._vision_service, 'available') and self._vision_service.available:
            ok = await self._vision_heal_step(step)
            if ok:
                return True

        # ── LAYER 6: LLM Re-interpretation (BLINQ-style) ──
        # Ask the LLM to suggest an alternative way to identify this element
        if self.ai_client:
            ok = await self._llm_reinterpret_and_retry(step, page, target, action)
            if ok:
                return True

        step.error = f"Could not find '{target}' — tried roles, text, selectors, CSS, app-specific, Vision AI, and LLM re-interpretation"
        step.method = "all_layers_failed"
        return False

    def _build_playwright_strategies(self, target: str, action: str) -> List[Dict]:
        """
        Build direct Playwright locator strategies from the raw target text.
        These are tried BEFORE PageScanner — they work even if the scanner
        didn't categorize the element correctly.
        """
        page = self._page
        strategies = []
        target_clean = target.strip()

        if not target_clean:
            return strategies

        # For click actions: try getByRole(button/link) first — most reliable
        if action in ("click", "check", "tab", "hover", "scroll_to"):
            for role in ["button", "link", "menuitem", "tab"]:
                strategies.append({
                    "locator_fn": lambda r=role: page.get_by_role(r, name=re.compile(re.escape(target_clean), re.IGNORECASE)),
                    "method": f"pw_role_{role}",
                    "desc": f"getByRole('{role}', name='{target_clean}')",
                    "confidence": 90,
                    "cache_sel": f"role={role}[name=/{re.escape(target_clean)}/i]",
                })

        # getByLabel — works for form fields
        if action in ("fill", "select", "check"):
            strategies.append({
                "locator_fn": lambda: page.get_by_label(target_clean, exact=False),
                "method": "pw_label",
                "desc": f"getByLabel('{target_clean}')",
                "confidence": 95,
                "cache_sel": f"label={target_clean}",
            })

        # getByPlaceholder — works for inputs
        if action in ("fill",):
            strategies.append({
                "locator_fn": lambda: page.get_by_placeholder(re.compile(re.escape(target_clean), re.IGNORECASE)),
                "method": "pw_placeholder",
                "desc": f"getByPlaceholder('{target_clean}')",
                "confidence": 88,
                "cache_sel": f"placeholder=/{re.escape(target_clean)}/i",
            })

        # getByText exact — most reliable for short labels like "18-35", "Next", "Submit"
        strategies.append({
            "locator_fn": lambda: page.get_by_text(target_clean, exact=True),
            "method": "pw_text_exact",
            "desc": f"getByText('{target_clean}', exact=True)",
            "confidence": 85,
            "cache_sel": f"text={target_clean}",
        })

        # getByText fuzzy — broader fallback (works for any visible text)
        strategies.append({
            "locator_fn": lambda: page.get_by_text(target_clean, exact=False),
            "method": "pw_text",
            "desc": f"getByText('{target_clean}')",
            "confidence": 78,
            "cache_sel": f"text={target_clean}",
        })

        # CSS attribute selectors — catches elements with title, aria-label, or data attributes
        if action in ("click", "fill"):
            for attr in ["title", "aria-label", "data-label", "value"]:
                strategies.append({
                    "locator_fn": lambda a=attr: page.locator(f'[{a}="{target_clean}" i]'),
                    "method": f"css_{attr}",
                    "desc": f'[{attr}="{target_clean}"]',
                    "confidence": 75,
                    "cache_sel": f'[{attr}="{target_clean}" i]',
                })

        # Partial text match for links/buttons — handles whitespace/icon text issues
        if action == "click" and len(target_clean) > 3:
            strategies.append({
                "locator_fn": lambda: page.locator(f'a:has-text("{target_clean}"), button:has-text("{target_clean}")'),
                "method": "css_has_text",
                "desc": f'a/button:has-text("{target_clean}")',
                "confidence": 70,
                "cache_sel": f'a:has-text("{target_clean}"), button:has-text("{target_clean}")',
            })

        # ── CUSTOM ELEMENT / NON-STANDARD BUTTON STRATEGIES ──
        # Salesforce LWC, custom components, divs styled as buttons, etc.
        if action == "click":
            # Any element with matching text content (div, span, li, etc.)
            # Use :text() pseudo-selector which matches direct text content
            strategies.append({
                "locator_fn": lambda: page.locator(f':text("{target_clean}")'),
                "method": "css_text_pseudo",
                "desc": f':text("{target_clean}")',
                "confidence": 65,
                "cache_sel": f':text("{target_clean}")',
            })

            # Any visible element containing this text — broadest catch-all
            # CSS *:has-text matches any element type
            strategies.append({
                "locator_fn": lambda: page.locator(f'*:has-text("{target_clean}")').last,
                "method": "css_any_has_text_last",
                "desc": f'*:has-text("{target_clean}").last',
                "confidence": 55,
                "cache_sel": f'*:has-text("{target_clean}")',
            })

            # XPath text match — finds exact text nodes in any element
            strategies.append({
                "locator_fn": lambda: page.locator(f'xpath=//*[normalize-space(text())="{target_clean}"]'),
                "method": "xpath_exact_text",
                "desc": f'xpath: text()="{target_clean}"',
                "confidence": 60,
                "cache_sel": f'xpath=//*[normalize-space(text())="{target_clean}"]',
            })

        return strategies

    async def _vision_find_element(self, step: StepResult, page, target: str, action: str) -> bool:
        """
        LAYER 5: Vision AI — Screenshot → GPT-4o-mini → Click coordinates.

        Like Momentic/TestRigor: take a screenshot, ask the vision model
        "where is the element labeled '18-35'?", get (x, y) coordinates,
        and click there directly. No CSS selectors needed.
        """
        try:
            logger.info(f"Vision AI: Looking for '{target}' in screenshot")
            ss = await page.screenshot(type='jpeg', quality=60)
            ss_b64 = base64.b64encode(ss).decode()

            response = self.ai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": f"""Find the UI element "{target}" in this screenshot.
I need to {action} it. Return ONLY a JSON object with:
- "found": true/false
- "x": pixel x-coordinate of center (from left edge)
- "y": pixel y-coordinate of center (from top edge)
- "description": what you see at that location
If the element is NOT visible in the screenshot, return {{"found": false}}.
Return ONLY the JSON, no markdown."""},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{ss_b64}", "detail": "low"}},
                    ]
                }],
                max_tokens=150,
                temperature=0,
            )

            text = response.choices[0].message.content.strip()
            # Parse JSON from response
            text = text.replace("```json", "").replace("```", "").strip()
            import json
            result = json.loads(text)

            if result.get("found") and result.get("x") and result.get("y"):
                x, y = int(result["x"]), int(result["y"])
                logger.info(f"Vision AI found '{target}' at ({x}, {y}): {result.get('description', '')}")

                if action == "fill":
                    await page.mouse.click(x, y)
                    await asyncio.sleep(0.3)
                    await page.keyboard.type(step.value or "", delay=30)
                elif action in ("click", "check", "tab"):
                    await page.mouse.click(x, y)
                    await asyncio.sleep(0.5)
                elif action == "hover":
                    await page.mouse.move(x, y)
                    await asyncio.sleep(0.3)
                else:
                    await page.mouse.click(x, y)
                    await asyncio.sleep(0.5)

                # Wait for potential page changes
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=3000)
                except:
                    pass

                step.success = True
                step.method = "vision_ai"
                step.selector_used = f"coordinates({x},{y})"
                step.confidence = 85
                step.healed = True
                step.heal_method = "vision_ai_gpt4o"
                return True

        except Exception as e:
            logger.debug(f"Vision AI failed: {e}")
        return False

    async def _llm_reinterpret_and_retry(self, step: StepResult, page, target: str, action: str) -> bool:
        """
        LAYER 6: LLM Re-interpretation (BLINQ-style regeneration).

        Ask the LLM: "I'm looking for '18-35 button' but can't find it.
        Here are the elements on the page. Which one is it?"

        This is fundamentally different from Layer 2-4 because the LLM
        can understand SEMANTIC meaning — "18-35" might be rendered as
        "Ages 18 to 35" or be inside a radio group labeled "Age Range".
        """
        try:
            # Build a compact element list for the LLM
            el_summary = []
            for i, el in enumerate(self._scanned_elements[:40]):
                text = (el.get("text", "") or "")[:60]
                label = el.get("label", "")
                tag = el.get("tag", "")
                el_type = el.get("elementType", "")
                aria = el.get("ariaLabel", "")
                best_sel = ""
                sels = el.get("selectors", [])
                if sels:
                    best_sel = sels[0].get("selector", "")

                entry = f"{i}. [{el_type}] text='{text}'"
                if label: entry += f" label='{label}'"
                if aria: entry += f" aria='{aria}'"
                if best_sel: entry += f" sel='{best_sel[:60]}'"
                el_summary.append(entry)

            prompt = f"""I'm trying to {action} an element described as "{target}" but I can't find it.
Here are the interactive elements currently on the page:

{chr(10).join(el_summary)}

Which element (by index number) is the best match for "{target}"?
Consider:
- Semantic similarity (e.g., "18-35" might be "Ages 18 to 35")
- Partial text matches
- Elements that serve the same purpose

Return ONLY a JSON object:
{{"match_index": <number or null>, "selector": "<CSS selector to try>", "reason": "<why this matches>"}}
If no element matches, return {{"match_index": null}}."""

            response = self.ai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                max_tokens=150,
                temperature=0,
            )

            text = response.choices[0].message.content.strip()
            text = text.replace("```json", "").replace("```", "").strip()
            import json
            result = json.loads(text)

            match_idx = result.get("match_index")
            suggested_sel = result.get("selector", "")
            reason = result.get("reason", "")

            if match_idx is not None and 0 <= match_idx < len(self._scanned_elements):
                matched_el = self._scanned_elements[match_idx]
                logger.info(f"LLM re-interpretation: '{target}' → element {match_idx} ({reason})")

                # Try the matched element's selectors
                for sel_info in matched_el.get("selectors", []):
                    sel = sel_info.get("selector", "")
                    if not sel:
                        continue
                    try:
                        loc = page.locator(sel)
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=2000):
                            ok = await self._perform_action(loc.first, step, page, matched=matched_el)
                            if ok:
                                step.method = "llm_reinterpret"
                                step.selector_used = sel
                                step.confidence = 80
                                step.healed = True
                                step.heal_method = f"llm_semantic: {reason[:50]}"
                                cache_key = f"{action}:{target.lower()}"
                                self._selector_cache[cache_key] = sel
                                return True
                    except:
                        continue

                # Try getByText with the matched element's text
                matched_text = (matched_el.get("text", "") or "").strip()
                if matched_text:
                    try:
                        loc = page.get_by_text(matched_text, exact=True)
                        if await loc.count() > 0 and await loc.first.is_visible(timeout=2000):
                            ok = await self._perform_action(loc.first, step, page)
                            if ok:
                                step.method = "llm_reinterpret_text"
                                step.selector_used = f"text={matched_text}"
                                step.confidence = 75
                                step.healed = True
                                step.heal_method = f"llm_semantic: {reason[:50]}"
                                return True
                    except:
                        pass

            # Also try the LLM-suggested selector directly
            if suggested_sel:
                try:
                    loc = page.locator(suggested_sel)
                    if await loc.count() > 0 and await loc.first.is_visible(timeout=2000):
                        ok = await self._perform_action(loc.first, step, page)
                        if ok:
                            step.method = "llm_suggested_selector"
                            step.selector_used = suggested_sel
                            step.confidence = 70
                            step.healed = True
                            step.heal_method = f"llm_selector: {reason[:50]}"
                            return True
                except:
                    pass

        except Exception as e:
            logger.debug(f"LLM re-interpretation failed: {e}")
        return False

    async def _perform_action(self, element, step: StepResult, page, matched: Dict = None) -> bool:
        """Execute the actual action on a resolved element. Shared by all layers."""
        try:
            await element.scroll_into_view_if_needed()

            if step.action == "fill":
                await element.clear()
                await element.fill(step.value)

            elif step.action in ("click", "tab"):
                await element.click()
                await asyncio.sleep(0.3)
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=5000)
                except:
                    pass

            elif step.action == "select":
                tag = matched.get('tag', '') if matched else ''
                if tag == 'select':
                    try:
                        await element.select_option(label=step.value)
                    except:
                        try:
                            await element.select_option(value=step.value)
                        except:
                            await element.click()
                            await asyncio.sleep(0.3)
                            option = page.get_by_text(step.value, exact=False)
                            if await option.count() > 0:
                                await option.first.click()
                else:
                    await element.click()
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
                    if not await element.is_checked():
                        await element.check()
                except:
                    await element.click()
                await asyncio.sleep(0.2)

            elif step.action == "hover":
                await element.hover()
                await asyncio.sleep(0.3)

            elif step.action == "scroll_to":
                await asyncio.sleep(0.3)

            elif step.action == "upload":
                try:
                    await element.set_input_files(step.value)
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
                        await element.drag_to(dest_loc.first)
                        await asyncio.sleep(0.5)

            step.success = True
            return True

        except Exception as e:
            logger.debug(f"Action failed: {step.action} on element - {e}")
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
