"""
Sample Data API - Load sample test data for testing and demos
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sample-data", tags=["sample-data"])

# Import shared stores from their actual routers
def _get_test_cases_store():
    from app.routers.test_management.test_cases_crud_api import _test_cases_store
    return _test_cases_store

def _get_requirements_store():
    from app.routers.platform.requirements_api import get_requirements_store
    return get_requirements_store()

def _get_defects_store():
    from app.routers.platform.defects_api import _defects_store
    return _defects_store

# Local test suites store
_test_suites_store: Dict[str, Dict[str, Any]] = {}

def get_suites_store():
    return _test_suites_store


@router.post("/load")
async def load_sample_data():
    """Load sample test cases, requirements, defects, and test suites"""
    try:
        now = datetime.now()
        
        # Get shared stores
        test_cases_store = _get_test_cases_store()
        requirements_store = _get_requirements_store()
        defects_store = _get_defects_store()
        
        # Clear existing data
        test_cases_store.clear()
        requirements_store.clear()
        defects_store.clear()
        _test_suites_store.clear()
        
        # ==================== REQUIREMENTS ====================
        requirements = [
            {"id": "REQ001", "title": "User Authentication", "type": "functional", "priority": "critical", "status": "approved",
             "description": "Users must be able to login with email and password", "acceptanceCriteria": [
                 {"id": "1", "description": "Login form accepts email and password", "verified": True},
                 {"id": "2", "description": "Invalid credentials show error message", "verified": True},
                 {"id": "3", "description": "Session persists after browser refresh", "verified": False}
             ]},
            {"id": "REQ002", "title": "Shopping Cart Management", "type": "functional", "priority": "high", "status": "approved",
             "description": "Users can add, remove, and update items in shopping cart"},
            {"id": "REQ003", "title": "Payment Processing", "type": "functional", "priority": "critical", "status": "approved",
             "description": "System must process credit card payments securely"},
            {"id": "REQ004", "title": "Order Confirmation Email", "type": "functional", "priority": "medium", "status": "approved",
             "description": "Send confirmation email after successful order"},
            {"id": "REQ005", "title": "Product Search", "type": "functional", "priority": "high", "status": "approved",
             "description": "Users can search products by name, category, and price range"},
            {"id": "REQ006", "title": "Page Load Performance", "type": "non-functional", "priority": "high", "status": "approved",
             "description": "All pages must load within 3 seconds"},
            {"id": "REQ007", "title": "Mobile Responsiveness", "type": "non-functional", "priority": "medium", "status": "draft",
             "description": "Application must work on mobile devices (320px - 768px)"},
            {"id": "REQ008", "title": "Data Encryption", "type": "non-functional", "priority": "critical", "status": "approved",
             "description": "All sensitive data must be encrypted in transit and at rest"},
            {"id": "REQ009", "title": "User Profile Management", "type": "functional", "priority": "medium", "status": "approved",
             "description": "Users can view and edit their profile information"},
            {"id": "REQ010", "title": "Password Reset", "type": "functional", "priority": "high", "status": "approved",
             "description": "Users can reset their password via email link"}
        ]
        
        for req in requirements:
            req["created_at"] = (now - timedelta(days=30)).isoformat()
            req["updated_at"] = now.isoformat()
            req["linkedTestCases"] = []
            req["source"] = req.get("source", "manual")
            req["source_ref"] = req.get("source_ref", req["id"])
            requirements_store[req["id"]] = req
        
        # ==================== TEST CASES ====================
        test_cases = [
            {"id": "TC001", "name": "Login - Valid Credentials", "type": "automated", "category": "functional", 
             "priority": "critical", "status": "active", "linkedRequirements": ["REQ001"],
             "steps": [
                 {"id": "1", "action": "Navigate to login page", "expectedResult": "Login form displayed"},
                 {"id": "2", "action": "Enter valid email", "expectedResult": "Email field populated"},
                 {"id": "3", "action": "Enter valid password", "expectedResult": "Password masked"},
                 {"id": "4", "action": "Click Login button", "expectedResult": "Redirected to dashboard"}
             ], "tags": ["login", "smoke", "critical-path"]},
            {"id": "TC002", "name": "Login - Invalid Password", "type": "automated", "category": "functional",
             "priority": "high", "status": "active", "linkedRequirements": ["REQ001"],
             "steps": [
                 {"id": "1", "action": "Enter valid email", "expectedResult": "Email accepted"},
                 {"id": "2", "action": "Enter wrong password", "expectedResult": "Password field filled"},
                 {"id": "3", "action": "Click Login", "expectedResult": "Error message: Invalid credentials"}
             ], "tags": ["login", "negative"]},
            {"id": "TC003", "name": "Add Item to Cart", "type": "automated", "category": "functional",
             "priority": "high", "status": "active", "linkedRequirements": ["REQ002"],
             "steps": [
                 {"id": "1", "action": "Navigate to product page", "expectedResult": "Product displayed"},
                 {"id": "2", "action": "Click Add to Cart", "expectedResult": "Item added, cart count updated"},
                 {"id": "3", "action": "Open cart", "expectedResult": "Item visible in cart"}
             ], "tags": ["cart", "e2e"]},
            {"id": "TC004", "name": "Remove Item from Cart", "type": "manual", "category": "functional",
             "priority": "medium", "status": "active", "linkedRequirements": ["REQ002"],
             "steps": [
                 {"id": "1", "action": "Add item to cart", "expectedResult": "Item in cart"},
                 {"id": "2", "action": "Click Remove button", "expectedResult": "Item removed, cart updated"}
             ], "tags": ["cart"]},
            {"id": "TC005", "name": "Checkout with Credit Card", "type": "automated", "category": "e2e",
             "priority": "critical", "status": "active", "linkedRequirements": ["REQ003"],
             "steps": [
                 {"id": "1", "action": "Add items to cart", "expectedResult": "Items in cart"},
                 {"id": "2", "action": "Proceed to checkout", "expectedResult": "Checkout form displayed"},
                 {"id": "3", "action": "Enter payment details", "expectedResult": "Details accepted"},
                 {"id": "4", "action": "Submit order", "expectedResult": "Order confirmed, confirmation shown"}
             ], "tags": ["checkout", "payment", "critical-path"]},
            {"id": "TC006", "name": "Search Product by Name", "type": "automated", "category": "functional",
             "priority": "high", "status": "active", "linkedRequirements": ["REQ005"],
             "steps": [
                 {"id": "1", "action": "Enter product name in search", "expectedResult": "Search suggestions appear"},
                 {"id": "2", "action": "Press Enter", "expectedResult": "Results displayed"},
                 {"id": "3", "action": "Verify results", "expectedResult": "Results match search term"}
             ], "tags": ["search"]},
            {"id": "TC007", "name": "Page Load Time < 3s", "type": "automated", "category": "performance",
             "priority": "high", "status": "active", "linkedRequirements": ["REQ006"],
             "steps": [
                 {"id": "1", "action": "Clear cache and navigate to homepage", "expectedResult": "Page loads"},
                 {"id": "2", "action": "Measure load time", "expectedResult": "Load time < 3 seconds"}
             ], "tags": ["performance", "nfr"]},
            {"id": "TC008", "name": "Password Reset Flow", "type": "manual", "category": "functional",
             "priority": "high", "status": "active", "linkedRequirements": ["REQ010"],
             "steps": [
                 {"id": "1", "action": "Click Forgot Password", "expectedResult": "Reset form displayed"},
                 {"id": "2", "action": "Enter email", "expectedResult": "Email accepted"},
                 {"id": "3", "action": "Submit", "expectedResult": "Confirmation message shown"},
                 {"id": "4", "action": "Check email", "expectedResult": "Reset link received"}
             ], "tags": ["password", "auth"]},
            {"id": "TC009", "name": "Update User Profile", "type": "manual", "category": "functional",
             "priority": "medium", "status": "draft", "linkedRequirements": ["REQ009"],
             "steps": [
                 {"id": "1", "action": "Navigate to profile", "expectedResult": "Profile page displayed"},
                 {"id": "2", "action": "Edit name field", "expectedResult": "Field editable"},
                 {"id": "3", "action": "Save changes", "expectedResult": "Success message, data persisted"}
             ], "tags": ["profile"]},
            {"id": "TC010", "name": "Mobile Responsive Layout", "type": "manual", "category": "ui",
             "priority": "medium", "status": "active", "linkedRequirements": ["REQ007"],
             "steps": [
                 {"id": "1", "action": "Open site on mobile viewport (375px)", "expectedResult": "Layout adapts"},
                 {"id": "2", "action": "Navigate through main pages", "expectedResult": "All pages accessible"},
                 {"id": "3", "action": "Test touch interactions", "expectedResult": "All buttons tappable"}
             ], "tags": ["mobile", "responsive", "ui"]}
        ]
        
        for tc in test_cases:
            tc["created_at"] = (now - timedelta(days=14)).isoformat()
            tc["updated_at"] = now.isoformat()
            tc["description"] = f"Test case for verifying {tc['name'].lower()}"
            test_cases_store[tc["id"]] = tc
            # Link back to requirements
            for req_id in tc.get("linkedRequirements", []):
                if req_id in requirements_store:
                    requirements_store[req_id]["linkedTestCases"].append(tc["id"])
        
        # ==================== DEFECTS ====================
        defects = [
            {"id": "DEF001", "title": "Payment gateway timeout on high load", "severity": "critical", "priority": "critical",
             "status": "open", "category": "functional", "linkedTestCases": ["TC005"], "linkedRequirements": ["REQ003"],
             "description": "Payment processing times out when more than 50 concurrent users", 
             "stepsToReproduce": ["Run load test with 50+ users", "Attempt checkout", "Observe timeout error"],
             "actualResult": "504 Gateway Timeout", "expectedResult": "Payment processed successfully"},
            {"id": "DEF002", "title": "Login button unresponsive on Safari", "severity": "critical", "priority": "critical",
             "status": "open", "category": "ui", "linkedTestCases": ["TC001"], "linkedRequirements": ["REQ001"],
             "description": "Login button does not respond to clicks on Safari 16+",
             "environment": {"browser": "Safari 16.4", "os": "macOS Ventura"}},
            {"id": "DEF003", "title": "Cart count not updating in header", "severity": "high", "priority": "high",
             "status": "in_progress", "category": "functional", "linkedTestCases": ["TC003"], "linkedRequirements": ["REQ002"],
             "description": "Adding items to cart doesn't update the cart badge count until page refresh"},
            {"id": "DEF004", "title": "Search results slow on large catalogs", "severity": "high", "priority": "high",
             "status": "open", "category": "performance", "linkedTestCases": ["TC006"], "linkedRequirements": ["REQ005"],
             "description": "Search takes 5+ seconds when catalog has more than 10,000 products"},
            {"id": "DEF005", "title": "Password reset email delayed", "severity": "high", "priority": "high",
             "status": "open", "category": "functional", "linkedTestCases": ["TC008"], "linkedRequirements": ["REQ010"],
             "description": "Password reset emails taking 10+ minutes to arrive"},
            {"id": "DEF006", "title": "Profile image upload fails for PNG", "severity": "medium", "priority": "medium",
             "status": "open", "category": "functional", "linkedTestCases": ["TC009"], "linkedRequirements": ["REQ009"],
             "description": "PNG images fail to upload with 'unsupported format' error"},
            {"id": "DEF007", "title": "Mobile menu overlaps content", "severity": "medium", "priority": "medium",
             "status": "resolved", "category": "ui", "linkedTestCases": ["TC010"], "linkedRequirements": ["REQ007"],
             "description": "On iPhone SE, hamburger menu overlaps main content when open"},
            {"id": "DEF008", "title": "Order confirmation email missing items", "severity": "medium", "priority": "medium",
             "status": "open", "category": "functional", "linkedTestCases": [], "linkedRequirements": ["REQ004"],
             "description": "Confirmation email only shows first 3 items regardless of order size"},
            {"id": "DEF009", "title": "Price filter not working for decimals", "severity": "low", "priority": "low",
             "status": "open", "category": "functional", "linkedTestCases": ["TC006"], "linkedRequirements": ["REQ005"],
             "description": "Entering $9.99 in price filter rounds to $10"},
            {"id": "DEF010", "title": "Typo in checkout button", "severity": "low", "priority": "low",
             "status": "resolved", "category": "ui", "linkedTestCases": ["TC005"], "linkedRequirements": ["REQ003"],
             "description": "Button says 'Procede' instead of 'Proceed'"}
        ]
        
        for defect in defects:
            defect["created_at"] = (now - timedelta(days=7)).isoformat()
            defect["updated_at"] = now.isoformat()
            defect["tags"] = [defect["category"]]
            defects_store[defect["id"]] = defect
        
        # ==================== TEST SUITES ====================
        test_suites = [
            {"id": "TS001", "name": "Smoke Test Suite", "description": "Critical path tests for quick validation",
             "test_case_ids": ["TC001", "TC003", "TC005"], "status": "active"},
            {"id": "TS002", "name": "Authentication Suite", "description": "All authentication-related tests",
             "test_case_ids": ["TC001", "TC002", "TC008"], "status": "active"},
            {"id": "TS003", "name": "E-Commerce Flow Suite", "description": "End-to-end shopping flow tests",
             "test_case_ids": ["TC003", "TC004", "TC005", "TC006"], "status": "active"},
            {"id": "TS004", "name": "Regression Suite", "description": "Full regression test coverage",
             "test_case_ids": ["TC001", "TC002", "TC003", "TC004", "TC005", "TC006", "TC007", "TC008", "TC009", "TC010"], 
             "status": "active"},
            {"id": "TS005", "name": "Performance Suite", "description": "Performance and load tests",
             "test_case_ids": ["TC007"], "status": "active"}
        ]
        
        for suite in test_suites:
            suite["created_at"] = (now - timedelta(days=21)).isoformat()
            suite["updated_at"] = now.isoformat()
            _test_suites_store[suite["id"]] = suite
        
        return {
            "status": "success",
            "message": "Sample data loaded successfully",
            "counts": {
                "test_cases": len(test_cases),
                "requirements": len(requirements),
                "defects": len(defects),
                "test_suites": len(test_suites)
            }
        }
        
    except Exception as e:
        logger.error(f"Error loading sample data: {e}")
        raise HTTPException(status_code=500, detail="Failed to load sample data")


@router.get("/defects")
async def get_sample_defects():
    """Get all defects from sample data"""
    return list(_get_defects_store().values())


@router.get("/test-suites") 
async def get_sample_suites():
    """Get all test suites from sample data"""
    return list(_test_suites_store.values())


@router.delete("/clear")
async def clear_sample_data():
    """Clear all sample data"""
    _get_test_cases_store().clear()
    _get_requirements_store().clear()
    _get_defects_store().clear()
    _test_suites_store.clear()
    return {"status": "success", "message": "All sample data cleared"}

