"""
Test Case Storage Service

Manages recorded test cases with:
- Save recordings as test cases
- List/filter test cases
- Approve/reject test cases
- Export to workflow editor
- Run tests directly
"""

import json
import os
import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)

# Storage directory
TEST_CASES_DIR = Path("data/test_cases")
TEST_CASES_DIR.mkdir(parents=True, exist_ok=True)


class TestCaseStatus:
    DRAFT = "draft"           # Just recorded, not reviewed
    PENDING = "pending"       # Submitted for review
    APPROVED = "approved"     # Approved, ready to run
    REJECTED = "rejected"     # Rejected, needs changes
    ARCHIVED = "archived"     # No longer active


class TestCaseStorage:
    """Storage service for test cases"""
    
    def __init__(self):
        self._ensure_dirs()
    
    def _ensure_dirs(self):
        """Create storage directories"""
        TEST_CASES_DIR.mkdir(parents=True, exist_ok=True)
    
    def save_test_case(
        self,
        actions: List[Dict[str, Any]],
        metadata: Dict[str, Any],
        name: str = None,
        tags: List[str] = None,
        status: str = TestCaseStatus.DRAFT
    ) -> Dict[str, Any]:
        """
        Save a recorded test case.
        
        Returns:
            The saved test case with ID
        """
        test_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().isoformat()
        
        test_case = {
            "id": test_id,
            "name": name or f"Test_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "status": status,
            "tags": tags or [],
            "created_at": timestamp,
            "updated_at": timestamp,
            "metadata": {
                "start_url": metadata.get("startUrl", ""),
                "app_type": metadata.get("appType", "generic"),
                "recorded_at": metadata.get("recordedAt", timestamp),
                "action_count": len(actions),
                "browser": metadata.get("browser", "chromium"),
                # New classification fields
                "test_type": metadata.get("testType", "automated"),  # automated or manual
                "category": metadata.get("category", "functional"),  # smoke, regression, functional, etc.
                "priority": metadata.get("priority", "medium"),  # critical, high, medium, low
                "output_format": metadata.get("outputFormat", "python"),  # python, typescript, istqb, etc.
                "description": metadata.get("description", ""),
                **{k: v for k, v in metadata.items() if k not in ["startUrl", "appType", "recordedAt", "browser", "testType", "category", "priority", "outputFormat", "description"]}
            },
            "actions": actions,
            "script": metadata.get("script"),  # Pre-generated script if available
            "execution_history": [],
            "notes": "",
            "approval": {
                "approved_by": None,
                "approved_at": None,
                "comments": []
            }
        }
        
        # Save to file
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        with open(file_path, "w") as f:
            json.dump(test_case, f, indent=2)
        
        logger.info(f"[TestCaseStorage] Saved test case: {test_id} - {test_case['name']}")
        return test_case
    
    def get_test_case(self, test_id: str) -> Optional[Dict[str, Any]]:
        """Get a test case by ID"""
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        if file_path.exists():
            with open(file_path) as f:
                return json.load(f)
        return None
    
    def list_test_cases(
        self,
        status: str = None,
        tag: str = None,
        app_type: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List test cases with optional filters"""
        test_cases = []
        
        for file_path in TEST_CASES_DIR.glob("*.json"):
            try:
                with open(file_path) as f:
                    tc = json.load(f)
                    
                    # Apply filters
                    if status and tc.get("status") != status:
                        continue
                    if tag and tag not in tc.get("tags", []):
                        continue
                    if app_type and tc.get("metadata", {}).get("app_type") != app_type:
                        continue
                    
                    # Return summary (without full actions for list view)
                    metadata = tc.get("metadata", {})
                    test_cases.append({
                        "id": tc["id"],
                        "name": tc["name"],
                        "status": tc["status"],
                        "tags": tc.get("tags", []),
                        "created_at": tc["created_at"],
                        "updated_at": tc["updated_at"],
                        "action_count": metadata.get("action_count", len(tc.get("actions", []))),
                        "start_url": metadata.get("start_url", ""),
                        "app_type": metadata.get("app_type", "generic"),
                        # New classification fields
                        "test_type": metadata.get("test_type", "automated"),
                        "category": metadata.get("category", "functional"),
                        "priority": metadata.get("priority", "medium"),
                        "output_format": metadata.get("output_format", "python"),
                        "description": metadata.get("description", ""),
                        "has_script": bool(tc.get("script")),
                        "last_run": tc.get("execution_history", [{}])[-1] if tc.get("execution_history") else None,
                    })
            except Exception as e:
                logger.error(f"Error loading test case {file_path}: {e}")
        
        # Sort by created_at descending
        test_cases.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        
        # Apply pagination
        return test_cases[offset:offset + limit]
    
    def update_test_case(
        self,
        test_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a test case"""
        test_case = self.get_test_case(test_id)
        if not test_case:
            return None
        
        # Apply updates
        allowed_updates = ["name", "status", "tags", "actions", "notes", "metadata"]
        for key in allowed_updates:
            if key in updates:
                test_case[key] = updates[key]
        
        test_case["updated_at"] = datetime.now().isoformat()
        
        # Save
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        with open(file_path, "w") as f:
            json.dump(test_case, f, indent=2)
        
        logger.info(f"[TestCaseStorage] Updated test case: {test_id}")
        return test_case
    
    def approve_test_case(
        self,
        test_id: str,
        approved_by: str = "user",
        comments: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Approve a test case"""
        test_case = self.get_test_case(test_id)
        if not test_case:
            return None
        
        test_case["status"] = TestCaseStatus.APPROVED
        test_case["updated_at"] = datetime.now().isoformat()
        test_case["approval"] = {
            "approved_by": approved_by,
            "approved_at": datetime.now().isoformat(),
            "comments": [comments] if comments else []
        }
        
        # Save
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        with open(file_path, "w") as f:
            json.dump(test_case, f, indent=2)
        
        logger.info(f"[TestCaseStorage] Approved test case: {test_id}")
        return test_case
    
    def reject_test_case(
        self,
        test_id: str,
        rejected_by: str = "user",
        reason: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Reject a test case"""
        test_case = self.get_test_case(test_id)
        if not test_case:
            return None
        
        test_case["status"] = TestCaseStatus.REJECTED
        test_case["updated_at"] = datetime.now().isoformat()
        test_case["approval"]["comments"].append({
            "type": "rejection",
            "by": rejected_by,
            "reason": reason,
            "at": datetime.now().isoformat()
        })
        
        # Save
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        with open(file_path, "w") as f:
            json.dump(test_case, f, indent=2)
        
        logger.info(f"[TestCaseStorage] Rejected test case: {test_id}")
        return test_case
    
    def record_execution(
        self,
        test_id: str,
        result: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Record test execution result"""
        test_case = self.get_test_case(test_id)
        if not test_case:
            return None
        
        execution_record = {
            "executed_at": datetime.now().isoformat(),
            "status": result.get("status", "unknown"),
            "duration": result.get("duration"),
            "browser": result.get("browser", "chromium"),
            "error": result.get("error"),
            "exit_code": result.get("exit_code")
        }
        
        test_case["execution_history"].append(execution_record)
        test_case["updated_at"] = datetime.now().isoformat()
        
        # Keep only last 20 executions
        test_case["execution_history"] = test_case["execution_history"][-20:]
        
        # Save
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        with open(file_path, "w") as f:
            json.dump(test_case, f, indent=2)
        
        return test_case
    
    def delete_test_case(self, test_id: str) -> bool:
        """Delete a test case"""
        file_path = TEST_CASES_DIR / f"{test_id}.json"
        if file_path.exists():
            file_path.unlink()
            logger.info(f"[TestCaseStorage] Deleted test case: {test_id}")
            return True
        return False
    
    def get_stats(self) -> Dict[str, Any]:
        """Get test case statistics"""
        test_cases = self.list_test_cases(limit=1000)
        
        stats = {
            "total": len(test_cases),
            "by_status": {},
            "by_app_type": {},
            "by_test_type": {},
            "by_category": {},
            "by_priority": {},
            "recent_runs": []
        }
        
        for tc in test_cases:
            # Count by status
            status = tc.get("status", "unknown")
            stats["by_status"][status] = stats["by_status"].get(status, 0) + 1
            
            # Count by app type
            app_type = tc.get("app_type", "generic")
            stats["by_app_type"][app_type] = stats["by_app_type"].get(app_type, 0) + 1
            
            # Count by test type (automated vs manual)
            test_type = tc.get("test_type", "automated")
            stats["by_test_type"][test_type] = stats["by_test_type"].get(test_type, 0) + 1
            
            # Count by category (smoke, regression, functional, etc.)
            category = tc.get("category", "functional")
            stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
            
            # Count by priority
            priority = tc.get("priority", "medium")
            stats["by_priority"][priority] = stats["by_priority"].get(priority, 0) + 1
            
            # Collect recent runs
            if tc.get("last_run"):
                stats["recent_runs"].append({
                    "test_id": tc["id"],
                    "test_name": tc["name"],
                    **tc["last_run"]
                })
        
        # Sort recent runs by date
        stats["recent_runs"].sort(key=lambda x: x.get("executed_at", ""), reverse=True)
        stats["recent_runs"] = stats["recent_runs"][:10]
        
        return stats


# Singleton instance
_storage = None

def get_storage() -> TestCaseStorage:
    global _storage
    if _storage is None:
        _storage = TestCaseStorage()
    return _storage

