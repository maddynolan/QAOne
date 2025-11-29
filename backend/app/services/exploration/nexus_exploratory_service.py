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
from typing import List, Dict, Optional, Any
from datetime import datetime

from fastapi import HTTPException

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None

from app.services.storage.postgres_direct import execute_query
from app.services.automation.test_execution_service import TestExecutionService
from app.services.exploration.autonomous_explorer import AutonomousExplorer, ExplorationConfig
from app.services.exploration.defect_detector_sync import detect_defects_sync
from app.services.exploration.defect_storage import DefectStorage
from app.services.exploration.nexus_storage import NexusStorage
from app.services.exploration.nexus_storage import NexusStorage

# Load Nexus system prompt
NEXUS_PROMPT = """
You are Nexus — ex-Google Principal SDET, 18 years, zero P1/P2 escapes in production.

Mission: Autonomously discover the maximum number of severe, non-obvious defects in this application with zero human input after start.

Rules you always follow:

1. First 60 seconds: Rapidly crawl and build a complete weighted capability map of the entire application (prioritize money paths, auth, PII, admin).

2. Continuously maintain and display a live Risk Heatmap.

3. Never stop until you have executed at least three full E2E happy + unhappy flows for every critical business capability.

4. Every defect you find must be validated with a reproducible steps + screenshot.

5. If you think you're "done", you must prove there are no more P1/P2 risks left or keep going.

6. Use parallel tool calls aggressively — crawl new pages while simultaneously probing APIs and running smoke tests.

You are paranoid, relentless, and slightly terrifying.
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
            "description": "Update the risk assessment for a specific capability or page",
            "parameters": {
                "type": "object",
                "properties": {
                    "capability": {"type": "string"},
                    "risk_level": {"type": "string", "enum": ["Critical", "High", "Medium", "Low"]},
                    "reason": {"type": "string"}
                },
                "required": ["capability", "risk_level"]
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
        self.test_executor = TestExecutionService()
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
        if not session_id:
            session_id = str(uuid.uuid4())
        
        # Initialize priority queue with default E2E flows
        priority_queue = queue.PriorityQueue()
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
        config = ExplorationConfig(
            base_url=app_url,
            max_pages=100,
            max_depth=5,
            headless=True,
            screenshot=True
        )
        self.explorer = AutonomousExplorer(config)
        
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
            "proof": None
        }
        
        # Store session in database
        await self._save_session(session_id)
        
        # Kick off autonomy loop
        asyncio.create_task(self.autonomy_loop(session_id))
        
        return {
            "status": "started",
            "session_id": session_id,
            "message": "Nexus autonomous exploration started. Monitoring in background."
        }
    
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
                response = self.client.chat.completions.create(
                    model="gpt-4o-mini",  # Using gpt-4o-mini (o1-mini not available yet)
                    messages=session["history"] + [{"role": "user", "content": state_prompt}],
                    tools=TOOLS,
                    tool_choice="auto",
                    max_tokens=4096,
                    temperature=0.7
                )
                
                # Handle response
                message = response.choices[0].message
                session["history"].append({
                    "role": "assistant",
                    "content": message.content or ""
                })
                
                # Execute tool calls
                if message.tool_calls:
                    tool_results = await self._execute_tools(message.tool_calls, session)
                    session["history"].append({
                        "role": "tool",
                        "content": json.dumps(tool_results)
                    })
                
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
                    session["risk_heatmap"][args["capability"]] = args["risk_level"]
                    results.append({
                        "tool": func_name,
                        "result": f"Risk updated: {args['capability']} = {args['risk_level']}"
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
        session = self.sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        elapsed = (datetime.utcnow() - session["started_at"]).total_seconds()
        
        return {
            "session_id": session_id,
            "status": "complete" if session["complete"] else "running",
            "defects_found": len(session["defects"]),
            "risk_heatmap": session["risk_heatmap"],
            "time_elapsed_seconds": elapsed,
            "proof": session.get("proof"),
            "defects": session["defects"][:10]  # Return first 10 defects
        }
    
    async def _save_session(self, session_id: str):
        """Save session state to database."""
        session = self.sessions.get(session_id)
        if not session:
            return
        
        # TODO: Implement database persistence
        # For now, sessions are in-memory
        pass

