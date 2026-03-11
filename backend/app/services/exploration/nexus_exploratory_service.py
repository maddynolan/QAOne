# DEPRECATED — Scheduled for removal (v3.20.0)
# Part of the Nexus Exploratory system which is unused.
"""
Nexus Autonomous Exploratory Testing Service

An autonomous testing agent that discovers severe, non-obvious defects
in applications with zero human input after start. Uses OpenAI function calling
to orchestrate exploration, E2E flow validation, and defect detection.

Author: Inspired by ex-Google Principal SDET practices
"""

import asyncio
import json
import queue
import uuid
import heapq
import logging
from typing import List, Dict, Optional, Any
from datetime import datetime

from fastapi import HTTPException

logger = logging.getLogger(__name__)


class PriorityQueueWrapper:
    """Wrapper for priority queue that handles dict comparison issues"""
    def __init__(self):
        self._queue = []
        self._counter = 0
    
    def put(self, item):
        """Add item to queue with format (priority, counter, data)"""
        priority, data = item if isinstance(item, tuple) and len(item) == 2 else (0, item)
        heapq.heappush(self._queue, (priority, self._counter, data))
        self._counter += 1
    
    def get(self):
        """Get item from queue, returns (priority, data)"""
        if self.empty():
            raise queue.Empty()
        priority, counter, data = heapq.heappop(self._queue)
        return (priority, data)
    
    def empty(self):
        """Check if queue is empty"""
        return len(self._queue) == 0

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.services.storage.postgres_direct import execute_query
from app.services.automation.test_execution_service import get_test_execution_service
from app.services.exploration.autonomous_explorer import AutonomousExplorer, ExplorationConfig
from app.services.exploration.defect_detector_sync import detect_defects_sync
from app.services.exploration.defect_storage import DefectStorage
from app.services.exploration.nexus_storage import NexusStorage

# Load Nexus system prompt
NEXUS_PROMPT = """
You are Nexus — ex-Google Principal SDET, 18 years, zero P1/P2 escapes in production.

Mission: Autonomously discover the maximum number of severe, non-obvious defects in this application with zero human input after start.

Rules you always follow:

1. First 60 seconds: Rapidly crawl and build a complete weighted capability map of the entire application (prioritize money paths, auth, PII, admin).

2. Continuously maintain and display a live Risk Heatmap.
   - When you FIRST discover a capability (during initial crawl), set risk to "Medium" (not High) - you haven't tested it yet
   - Only set risk to "High" or "Critical" AFTER you've actually tested the capability and found defects or failures
   - Set risk to "Low" only AFTER you've successfully tested the capability with multiple E2E flows and found no issues
   - Risk levels: Critical (defects found + critical business impact), High (defects found), Medium (not yet tested or partially tested), Low (thoroughly tested with no issues)

3. Never stop until you have executed at least three full E2E happy + unhappy flows for every critical business capability.

4. Every defect you find must be validated with a reproducible steps + screenshot.

5. If you think you're "done", you must prove there are no more P1/P2 risks left or keep going.

6. Use parallel tool calls aggressively — crawl new pages while simultaneously probing APIs and running smoke tests.

You are paranoid, relentless, and slightly terrifying, but also methodical and evidence-based in your risk assessments.
"""

# Pre-defined critical E2E flows (expand as needed)
DEFAULT_E2E_FLOWS = {
    "Guest Checkout": [
        "add_to_cart",
        "proceed_to_checkout",
        "fill_shipping",
        "select_payment",
        "place_order",
        "confirm_order_received"
    ],
    "Registered Checkout": [
        "login",
        "add_to_cart",
        "proceed_to_checkout",
        "fill_shipping",
        "select_payment",
        "place_order",
        "confirm_order_received"
    ],
    "Account Creation": [
        "signup_form",
        "email_verification",
        "profile_setup"
    ],
    "Password Reset": [
        "forgot_password",
        "email_link",
        "new_password_set"
    ],
    "Product Search": [
        "search_query",
        "filter_results",
        "view_product",
        "add_to_cart"
    ],
    "User Profile": [
        "view_profile",
        "edit_profile",
        "change_password",
        "save_changes"
    ],
    "Admin Panel": [
        "admin_login",
        "view_dashboard",
        "manage_users",
        "view_reports"
    ]
}

# Tool definitions for OpenAI function calling
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "add_exploration_target",
            "description": "Add a new business capability or URL to explore with priority",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"},
                    "capability": {"type": "string"},
                    "priority": {"type": "string", "enum": ["P0", "P1", "P2"]}
                },
                "required": ["capability", "priority"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "validate_e2e_flow",
            "description": "Execute and validate a complete business flow end-to-end. Return success/failure + evidence.",
            "parameters": {
                "type": "object",
                "properties": {
                    "flow_name": {"type": "string"},
                    "steps": {"type": "array", "items": {"type": "string"}},
                    "negative": {"type": "boolean"}
                },
                "required": ["flow_name", "steps"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "declare_exploration_complete",
            "description": "ONLY call this when you are 100% confident no P1/P2 risks remain. You must list coverage proof.",
            "parameters": {
                "type": "object",
                "properties": {
                    "proof": {"type": "string"}
                },
                "required": ["proof"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "crawl_page",
            "description": "Crawl a page and return DOM tree + screenshots",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "detect_defects_on_page",
            "description": "Run comprehensive defect detection on a specific page (functional, UI, accessibility, security)",
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {"type": "string"}
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "update_risk_heatmap",
            "description": "Update the risk assessment for a specific capability or page. IMPORTANT: Only set 'High' or 'Critical' AFTER testing reveals defects. When first discovering a capability, use 'Medium'. Use 'Low' only after thorough testing with no issues found.",
            "parameters": {
                "type": "object",
                "properties": {
                    "capability": {"type": "string"},
                    "risk_level": {"type": "string", "enum": ["Critical", "High", "Medium", "Low"]},
                    "reason": {"type": "string", "description": "Required explanation for why this risk level was assigned (e.g., 'Defects found: X', 'E2E flows passed', 'Not yet tested')"}
                },
                "required": ["capability", "risk_level", "reason"]
            }
        }
    }
]


class NexusExploratoryService:
    """
    Autonomous exploratory testing service powered by OpenAI function calling.
    
    Uses o1-mini or gpt-4o-mini to orchestrate comprehensive application testing
    with zero human intervention after initialization.
    """
    
    def __init__(self, openai_client: Optional[Any] = None):
        if not openai_client and OpenAI:
            # Try to create client from environment
            import os
            api_key = os.getenv("OPENAI_API_KEY")
            if api_key:
                self.client = OpenAI(api_key=api_key)
            else:
                self.client = None
        else:
            self.client = openai_client
        self.sessions: Dict[str, Dict] = {}  # In-memory for dev; use DB in prod
        self.test_executor = get_test_execution_service()
        self.defect_storage = DefectStorage()
        self.nexus_storage = NexusStorage()
        self.explorer = None  # Will be initialized per session
        
    async def start_session(
        self,
        app_url: str,
        session_id: Optional[str] = None,
        project_id: Optional[str] = None,
        max_duration_minutes: int = 30
    ) -> Dict:
        """
        Start a new autonomous exploratory testing session.
        
        Args:
            app_url: Base URL of the application to test
            session_id: Optional session ID (generated if not provided)
            project_id: Optional project ID for defect storage
            max_duration_minutes: Maximum session duration
            
        Returns:
            Session initialization response
        """
        try:
            if not session_id:
                session_id = str(uuid.uuid4())
            
            # Initialize priority queue with default E2E flows
            priority_queue = PriorityQueueWrapper()
            for capability in DEFAULT_E2E_FLOWS.keys():
                priority_queue.put((0, {
                    "capability": capability,
                    "url": app_url,
                    "flow_steps": DEFAULT_E2E_FLOWS[capability]
                }))
            
            # Initialize session state
            history = [{"role": "system", "content": NEXUS_PROMPT}]
            risk_heatmap: Dict[str, str] = {}
            defects: List[Dict] = []
            
            # Initialize autonomous explorer for this session
            try:
                config = ExplorationConfig(
                    base_url=app_url,
                    max_pages=100,
                    max_depth=5,
                    headless=True,
                    screenshot=True
                )
                self.explorer = AutonomousExplorer(config)
                logger.info(f"Initialized AutonomousExplorer for {app_url}")
            except Exception as e:
                logger.error(f"Failed to initialize AutonomousExplorer: {e}", exc_info=True)
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to initialize explorer: {str(e)}"
                )
            
            self.sessions[session_id] = {
                "queue": priority_queue,
                "history": history,
                "risk_heatmap": risk_heatmap,
                "defects": defects,
                "app_url": app_url,
                "project_id": project_id,
                "started_at": datetime.utcnow(),
                "max_duration": max_duration_minutes * 60,
                "complete": False,
                "proof": None,
                # Progress tracking
                "current_activity": "Initializing...",
                "activity_log": [],
                "capabilities_tested": 0,
                "flows_executed": 0,
                "pages_crawled": 0,
                "iterations": 0,
                "last_update": datetime.utcnow().isoformat()
            }
            
            # Create session in database (non-blocking, errors are logged but don't fail)
            try:
                await self.nexus_storage.create_session(
                    session_id=session_id,
                    app_url=app_url,
                    project_id=project_id,
                    max_duration_seconds=max_duration_minutes * 60,
                    red_team_mode=False
                )
                logger.info(f"Created Nexus session {session_id} in database")
            except Exception as e:
                logger.warning(f"Failed to create session in database: {e}", exc_info=True)
                # Continue anyway - session is in memory
            
            # Kick off autonomy loop (fire and forget)
            try:
                asyncio.create_task(self.autonomy_loop(session_id))
                logger.info(f"Started autonomy loop for session {session_id}")
            except Exception as e:
                logger.error(f"Failed to start autonomy loop: {e}", exc_info=True)
                # Still return success - session is created
            
            return {
                "status": "started",
                "session_id": session_id,
                "message": "Nexus autonomous exploration started. Monitoring in background."
            }
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error in start_session: {e}", exc_info=True)
            raise HTTPException(
                status_code=500,
                detail=f"Failed to start session: {str(e)}"
            )
    
    async def autonomy_loop(self, session_id: str):
        """
        Main autonomous loop that continuously explores and tests the application.
        """
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        start_time = datetime.utcnow()
        iteration_count = 0
        max_iterations = 1000  # Safety limit
        
        while not session["complete"] and iteration_count < max_iterations:
            try:
                # Check timeout
                elapsed = (datetime.utcnow() - start_time).total_seconds()
                if elapsed > session["max_duration"]:
                    await self._force_completion_check(session_id, reason="Time limit reached")
                    break
                
                # Get next target from queue
                if session["queue"].empty():
                    # Queue empty, force completion check
                    await self._force_completion_check(session_id, reason="Queue empty")
                    break
                
                priority, target = session["queue"].get()
                
                # Update current activity
                capability = target.get("capability", "Unknown")
                session["current_activity"] = f"Testing: {capability}"
                session["last_update"] = datetime.utcnow().isoformat()
                
                # Add to activity log (keep last 50 entries)
                activity_entry = {
                    "timestamp": datetime.utcnow().isoformat(),
                    "action": "testing_capability",
                    "capability": capability,
                    "iteration": iteration_count,
                    "elapsed_seconds": elapsed
                }
                session["activity_log"].append(activity_entry)
                if len(session["activity_log"]) > 50:
                    session["activity_log"].pop(0)
                
                # Build prompt with current state
                state_prompt = f"""
Current target: {json.dumps(target)}
Risk Heatmap: {json.dumps(session['risk_heatmap'])}
Defects found: {len(session['defects'])}
Iteration: {iteration_count}
Time elapsed: {elapsed:.1f}s

What should I do next?
"""
                
                # Call OpenAI with function calling
                try:
                    # Prepare messages - ensure they're properly formatted
                    messages = session["history"] + [{"role": "user", "content": state_prompt}]
                    
                    # Validate messages format
                    for msg in messages:
                        if not isinstance(msg, dict) or "role" not in msg or "content" not in msg:
                            logger.error(f"Invalid message format: {msg}")
                            raise ValueError(f"Invalid message format in history")
                    
                    response = self.client.chat.completions.create(
                        model="gpt-4o-mini",
                        messages=messages,
                        tools=TOOLS,
                        tool_choice="auto",
                        max_tokens=4096,
                        temperature=0.7
                    )
                except Exception as e:
                    error_msg = str(e)
                    # Try to extract more details from OpenAI error
                    if hasattr(e, 'response') and hasattr(e.response, 'json'):
                        try:
                            error_details = e.response.json()
                            error_msg = f"{error_msg} - Details: {json.dumps(error_details)}"
                        except:
                            pass
                    
                    logger.error(f"OpenAI API error: {error_msg}", exc_info=True)
                    # Log the request details for debugging (truncate if too long)
                    messages_preview = messages[-3:] if len(messages) > 3 else messages
                    logger.error(f"Last messages: {json.dumps(messages_preview, indent=2)}")
                    logger.error(f"Total messages in history: {len(messages)}")
                    
                    # Don't raise - continue with next iteration to avoid breaking the loop
                    session["defects"].append({
                        "defect_type": "api_error",
                        "severity": "medium",
                        "title": "OpenAI API Error",
                        "description": error_msg,
                        "detected_at": datetime.utcnow().isoformat()
                    })
                    await asyncio.sleep(5)  # Wait longer before retry
                    continue
                
                # Handle response
                message = response.choices[0].message
                # Store assistant message with tool_calls if present
                assistant_msg = {
                    "role": "assistant",
                    "content": message.content or ""
                }
                # Include tool_calls in the message if present (required for OpenAI)
                if message.tool_calls:
                    assistant_msg["tool_calls"] = [
                        {
                            "id": call.id,
                            "type": call.type,
                            "function": {
                                "name": call.function.name,
                                "arguments": call.function.arguments
                            }
                        }
                        for call in message.tool_calls
                    ]
                session["history"].append(assistant_msg)
                
                # Execute tool calls
                if message.tool_calls:
                    # Update activity based on tool calls
                    tool_names = [call.function.name for call in message.tool_calls]
                    if "crawl_page" in tool_names:
                        session["current_activity"] = "Crawling pages..."
                        session["pages_crawled"] += tool_names.count("crawl_page")
                    elif "execute_e2e_flow" in tool_names:
                        session["current_activity"] = "Executing E2E flows..."
                        session["flows_executed"] += tool_names.count("execute_e2e_flow")
                    elif "detect_defects_on_page" in tool_names:
                        session["current_activity"] = "Detecting defects..."
                    elif "update_risk_heatmap" in tool_names:
                        session["current_activity"] = "Updating risk assessment..."
                        session["capabilities_tested"] = len(session["risk_heatmap"])
                    
                    tool_results = await self._execute_tools(message.tool_calls, session)
                    # Add tool results in the correct format for OpenAI
                    # Each tool call needs a separate tool message with matching tool_call_id
                    for i, call in enumerate(message.tool_calls):
                        tool_result = tool_results[i] if i < len(tool_results) else {"error": "No result"}
                        # Format the result as a string (OpenAI expects string content)
                        if isinstance(tool_result, dict):
                            content = json.dumps(tool_result, ensure_ascii=False)
                        else:
                            content = str(tool_result)
                        
                        session["history"].append({
                            "role": "tool",
                            "tool_call_id": call.id,
                            "content": content
                        })
                
                # Update iteration count in session
                session["iterations"] = iteration_count
                
                # Update session state in DB periodically
                if iteration_count % 10 == 0:
                    await self._save_session(session_id)
                
                iteration_count += 1
                
                # Throttle to avoid rate limits
                await asyncio.sleep(2)
                
            except Exception as e:
                # Log error, add to defects
                error_defect = {
                    "defect_type": "system_error",
                    "severity": "high",
                    "title": f"Autonomy loop error: {str(e)}",
                    "description": f"Error occurred during autonomous exploration: {str(e)}",
                    "page_url": session.get("app_url", "unknown"),
                    "detected_at": datetime.utcnow().isoformat()
                }
                session["defects"].append(error_defect)
                await self._save_session(session_id)
                await asyncio.sleep(5)  # Wait before retrying
        
        # Final save
        await self._save_session(session_id)
    
    async def stop_session(self, session_id: str) -> Dict[str, Any]:
        """
        Stop a running Nexus session gracefully.
        
        Args:
            session_id: Session ID to stop
            
        Returns:
            Status response
        """
        import logging
        logger = logging.getLogger(__name__)
        
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
        
        if session.get("complete"):
            return {
                "status": "already_stopped",
                "session_id": session_id,
                "message": "Session was already complete"
            }
        
        # Mark session as complete to stop the autonomy loop
        session["complete"] = True
        session["stopped_at"] = datetime.utcnow()
        session["stopped_reason"] = "User requested stop"
        
        logger.info(f"Stopping Nexus session {session_id}")
        
        # Save final state
        try:
            await self._save_session(session_id)
        except Exception as e:
            logger.warning(f"Failed to save session on stop: {e}")
        
        return {
            "status": "stopped",
            "session_id": session_id,
            "message": "Session stopped successfully. The autonomy loop will exit on next iteration.",
            "defects_found": len(session.get("defects", [])),
            "time_elapsed_seconds": (datetime.utcnow() - session["started_at"]).total_seconds()
        }
    
    async def _execute_tools(self, tool_calls: List, session: Dict) -> List[Dict]:
        """Execute tool calls from OpenAI function calling."""
        results = []
        
        for call in tool_calls:
            func_name = call.function.name
            try:
                args = json.loads(call.function.arguments)
            except json.JSONDecodeError:
                args = {}
            
            try:
                if func_name == "add_exploration_target":
                    priority_int = self._priority_to_int(args.get("priority", "P2"))
                    session["queue"].put((priority_int, args))
                    results.append({"tool": func_name, "result": "Target added to queue"})
                
                elif func_name == "validate_e2e_flow":
                    result = await self._run_e2e_flow(
                        args["flow_name"],
                        args["steps"],
                        args.get("negative", False),
                        session["app_url"]
                    )
                    if "defect" in result:
                        session["defects"].append(result["defect"])
                        # Store defect in database
                        if session.get("project_id"):
                            await self.defect_storage.save_defect(
                                exploration_run_id=None,  # Will be linked later
                                defect=result["defect"],
                                project_id=session["project_id"]
                            )
                    session["risk_heatmap"][args["flow_name"]] = result.get("risk", "Unknown")
                    results.append({"tool": func_name, "result": result})
                
                elif func_name == "declare_exploration_complete":
                    session["complete"] = True
                    session["proof"] = args.get("proof", "No proof provided")
                    results.append({"tool": func_name, "result": "Session marked as complete"})
                
                elif func_name == "crawl_page":
                    dom_tree = await self._crawl_url(args["url"], session)
                    results.append({"tool": func_name, "result": dom_tree})
                
                elif func_name == "detect_defects_on_page":
                    defects = await self._detect_defects_on_page(args["url"], session)
                    session["defects"].extend(defects)
                    results.append({
                        "tool": func_name,
                        "result": f"Found {len(defects)} defects",
                        "defects": defects
                    })
                
                elif func_name == "update_risk_heatmap":
                    capability = args["capability"]
                    risk_level = args["risk_level"]
                    reason = args.get("reason", "No reason provided")
                    
                    # Validate risk level assignment logic
                    current_risk = session["risk_heatmap"].get(capability)
                    
                    # If setting to High/Critical, ensure there's a valid reason
                    if risk_level in ["High", "Critical"]:
                        if not reason or ("defect" not in reason.lower() and "fail" not in reason.lower() and "error" not in reason.lower() and "issue" not in reason.lower()):
                            # If no evidence of problems, default to Medium instead
                            logger.warning(f"Nexus tried to set {capability} to {risk_level} without evidence. Defaulting to Medium.")
                            risk_level = "Medium"
                            reason = f"Risk level {args['risk_level']} requested but no defects/issues found. Defaulting to Medium until testing completes."
                    
                    session["risk_heatmap"][capability] = risk_level
                    results.append({
                        "tool": func_name,
                        "result": f"Risk updated: {capability} = {risk_level} (Reason: {reason})"
                    })
                
            except Exception as e:
                results.append({
                    "tool": func_name,
                    "error": str(e)
                })
        
        return results
    
    async def _run_e2e_flow(
        self,
        name: str,
        steps: List[str],
        negative: bool,
        base_url: str
    ) -> Dict:
        """
        Execute an E2E flow using Playwright and validate results.
        
        Returns dict with success status, evidence (screenshots), and risk level.
        """
        try:
            # Generate Playwright code for the flow
            playwright_code = self._generate_playwright_code_for_flow(name, steps, base_url)
            
            # Execute using TestExecutionService
            execution_result = await self.test_executor.execute_test(
                test_name=f"Nexus_E2E_{name}",
                playwright_code=playwright_code,
                browser="chromium"
            )
            
            if execution_result["status"] == "passed":
                return {
                    "success": True,
                    "evidence": execution_result.get("screenshots", []),
                    "risk": "Low",
                    "execution_time": execution_result.get("duration", 0)
                }
            else:
                # Test failed - this is a defect
                defect = {
                    "defect_type": "functional",
                    "severity": "high" if negative else "medium",
                    "title": f"E2E Flow Failure: {name}",
                    "description": f"Flow '{name}' failed during execution. Error: {execution_result.get('error', 'Unknown error')}",
                    "steps_to_reproduce": steps,
                    "expected_behavior": f"Flow '{name}' should complete successfully",
                    "actual_behavior": f"Flow failed: {execution_result.get('error', 'Unknown')}",
                    "evidence": execution_result.get("screenshots", []),
                    "page_url": base_url,
                    "detected_at": datetime.utcnow().isoformat()
                }
                return {
                    "success": False,
                    "evidence": execution_result.get("screenshots", []),
                    "risk": "High",
                    "defect": defect,
                    "execution_time": execution_result.get("duration", 0)
                }
        
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "risk": "High",
                "evidence": []
            }
    
    def _generate_playwright_code_for_flow(
        self,
        flow_name: str,
        steps: List[str],
        base_url: str
    ) -> str:
        """Generate Playwright TypeScript code for a flow."""
        # This is a simplified version - integrate with your existing code generator
        code_lines = [
            "import { test, expect } from '@playwright/test';",
            "",
            f"test('Nexus E2E: {flow_name}', async ({ page }) => {{",
            f"  await page.goto('{base_url}');",
            ""
        ]
        
        for step in steps:
            # Map step names to Playwright actions
            if "login" in step.lower():
                code_lines.append("  // Login step - implement based on app")
            elif "add_to_cart" in step.lower():
                code_lines.append("  await page.click('button:has-text(\"Add to Cart\")').first();")
            elif "checkout" in step.lower():
                code_lines.append("  await page.click('button:has-text(\"Checkout\")').first();")
            else:
                code_lines.append(f"  // Step: {step}")
        
        code_lines.extend([
            "  await page.waitForTimeout(2000);",
            "});"
        ])
        
        return "\n".join(code_lines)
    
    async def _crawl_url(self, url: str, session: Dict) -> Dict:
        """Crawl a URL and return DOM tree + metadata."""
        try:
            if not self.explorer:
                return {"error": "Explorer not initialized"}
            
            # Use existing autonomous explorer to crawl
            page_cap = await self.explorer._explore_page(url)
            
            return {
                "url": url,
                "title": page_cap.get("title", ""),
                "headings": page_cap.get("headings", []),
                "buttons": page_cap.get("buttons", []),
                "links": page_cap.get("links", []),
                "forms": page_cap.get("forms", []),
                "screenshot": page_cap.get("screenshot_path")
            }
        except Exception as e:
            return {"error": str(e), "url": url}
    
    async def _detect_defects_on_page(self, url: str, session: Dict) -> List[Dict]:
        """Run comprehensive defect detection on a page."""
        try:
            # For now, return empty list - defect detection requires a Playwright page object
            # This would need to be integrated with the autonomous explorer's page crawling
            # TODO: Integrate with autonomous explorer to get page object for defect detection
            return []
        except Exception as e:
            return [{
                "defect_type": "system_error",
                "severity": "medium",
                "title": f"Defect detection error: {str(e)}",
                "page_url": url
            }]
    
    async def _force_completion_check(self, session_id: str, reason: str = ""):
        """Force Nexus to check if exploration is complete."""
        session = self.sessions[session_id]
        
        prompt = f"""
Queue is empty / {reason}. 

Current state:
- Defects found: {len(session['defects'])}
- Risk Heatmap: {json.dumps(session['risk_heatmap'])}
- Coverage: {len(session['risk_heatmap'])} capabilities tested

Prove that there are no more P1/P2 risks remaining, or add more exploration targets.
"""
        
        try:
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=session["history"] + [{"role": "user", "content": prompt}],
                tools=TOOLS,
                tool_choice="auto",
                max_tokens=4096
            )
            
            message = response.choices[0].message
            session["history"].append({
                "role": "assistant",
                "content": message.content or ""
            })
            
            if message.tool_calls:
                tool_results = await self._execute_tools(message.tool_calls, session)
                session["history"].append({
                    "role": "tool",
                    "content": json.dumps(tool_results)
                })
        except Exception as e:
            # If completion check fails, mark as complete anyway
            session["complete"] = True
            session["proof"] = f"Completion check failed: {str(e)}"
    
    def _priority_to_int(self, p: str) -> int:
        """Convert priority string to integer for queue ordering."""
        return {"P0": 0, "P1": 1, "P2": 2}.get(p, 99)
    
    async def get_session_status(self, session_id: str) -> Dict:
        """Get current status of an exploratory session."""
        # First check in-memory sessions
        session = self.sessions.get(session_id)
        
        # If not in memory, try to load from database
        if not session:
            try:
                db_session = await self.nexus_storage.get_session(session_id)
                if db_session:
                    # Load defects from database
                    defects = await self.nexus_storage.get_session_defects(session_id)
                    
                    # Calculate elapsed time
                    started_at = db_session.get("started_at")
                    if started_at:
                        try:
                            if isinstance(started_at, str):
                                # Try parsing ISO format
                                started_at = datetime.fromisoformat(started_at.replace('Z', '+00:00'))
                            elif isinstance(started_at, datetime):
                                pass  # Already a datetime
                            else:
                                started_at = None
                            
                            if started_at:
                                elapsed = (datetime.utcnow() - started_at.replace(tzinfo=None)).total_seconds()
                            else:
                                elapsed = 0
                        except Exception:
                            elapsed = 0
                    else:
                        elapsed = 0
                    
                    # Reconstruct session from database
                    # Note: Full session state (queue, history) may not be recoverable
                    logger.info(f"Loaded session {session_id} from database with {len(defects)} defects")
                    return {
                        "session_id": session_id,
                        "status": db_session.get("status", "unknown"),
                        "defects_found": len(defects),
                        "risk_heatmap": {},  # Not stored in DB currently
                        "time_elapsed_seconds": elapsed,
                        "proof": db_session.get("proof"),
                        "defects": defects[:10],  # Return first 10 defects
                        "message": "Session loaded from database (session was lost due to server restart, but defects were recovered)"
                    }
            except Exception as e:
                logger.warning(f"Failed to load session from database: {e}", exc_info=True)
        
        if not session:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found. It may have been lost due to server restart.")
        
        elapsed = (datetime.utcnow() - session["started_at"]).total_seconds()
        
        # Calculate progress percentage
        total_capabilities = len(session.get("risk_heatmap", {}))
        tested_capabilities = sum(1 for risk in session.get("risk_heatmap", {}).values() if risk in ["Low", "Medium", "High", "Critical"])
        progress_percentage = (tested_capabilities / max(total_capabilities, 1)) * 100 if total_capabilities > 0 else 0
        
        # Estimate time remaining (rough estimate based on average time per capability)
        avg_time_per_capability = elapsed / max(tested_capabilities, 1) if tested_capabilities > 0 else 60
        remaining_capabilities = max(0, total_capabilities - tested_capabilities)
        estimated_remaining_seconds = remaining_capabilities * avg_time_per_capability
        
        return {
            "session_id": session_id,
            "status": "complete" if session["complete"] else "running",
            "defects_found": len(session["defects"]),
            "risk_heatmap": session["risk_heatmap"],
            "time_elapsed_seconds": elapsed,
            "proof": session.get("proof"),
            "defects": session["defects"][:10],  # Return first 10 defects
            # Progress information
            "current_activity": session.get("current_activity", "Initializing..."),
            "progress": {
                "capabilities_tested": session.get("capabilities_tested", 0),
                "total_capabilities": total_capabilities,
                "flows_executed": session.get("flows_executed", 0),
                "pages_crawled": session.get("pages_crawled", 0),
                "iterations": session.get("iterations", 0),
                "progress_percentage": round(progress_percentage, 1),
                "estimated_remaining_seconds": round(estimated_remaining_seconds, 0)
            },
            "recent_activity": session.get("activity_log", [])[-10:],  # Last 10 activities
            "last_update": session.get("last_update", datetime.utcnow().isoformat())
        }
    
    async def _save_session(self, session_id: str):
        """Save session state to database."""
        session = self.sessions.get(session_id)
        if not session:
            return
        
        try:
            # Save to database using NexusStorage
            await self.nexus_storage.update_session_status(
                session_id=session_id,
                status="complete" if session.get("complete") else "running",
                proof=session.get("proof")
            )
            
            # Save defects
            for defect in session.get("defects", []):
                try:
                    await self.nexus_storage.save_defect(
                        session_id=session_id,
                        defect_type=defect.get("defect_type", "unknown"),
                        severity=defect.get("severity", "medium"),
                        title=defect.get("title", "Untitled"),
                        description=defect.get("description", ""),
                        page_url=defect.get("page_url"),
                        evidence=defect
                    )
                except Exception as e:
                    logger.warning(f"Failed to save defect: {e}")
        except Exception as e:
            logger.warning(f"Failed to save session to database: {e}", exc_info=True)
            # Continue anyway - session is still in memory

