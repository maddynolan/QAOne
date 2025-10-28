from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional, Dict, Any
import uuid
import json
from datetime import datetime

from app.models.schemas import TriageResultCreate, TriageResultResponse
from app.models.database import TriageResult as TriageResultDB, Run, Event
from app.services.run_service import RunService

class TriageService:
    """Service for managing failure triage and root cause analysis"""
    
    def __init__(self):
        self.run_service = RunService()
    
    async def create_triage(self, db: Session, triage_data: TriageResultCreate) -> TriageResultDB:
        """Create triage analysis for a failed run"""
        try:
            # Verify run exists and has failures
            run = await self.run_service.get_run_by_id(db, str(triage_data.run_id))
            if not run:
                raise ValueError(f"Run with ID {triage_data.run_id} not found")
            
            if run.status != "failed":
                raise ValueError(f"Run {run.run_id} is not in failed status")
            
            # Perform triage analysis
            clusters = await self._analyze_failures(run)
            
            # Generate unique triage ID
            triage_id = f"triage-{uuid.uuid4().hex[:8]}"
            
            # Create triage record
            triage = TriageResultDB(
                run_id=triage_data.run_id,
                name=triage_data.name,
                clusters=clusters,
                suggested_fix=self._generate_suggested_fix(clusters),
                confidence_score=self._calculate_confidence_score(clusters),
                status="pending",
                created_by="system"  # TODO: Get from auth context
            )
            
            db.add(triage)
            db.commit()
            db.refresh(triage)
            
            # Log event
            await self._log_event(db, "triage_created", "triage", triage.id, {
                "run_id": str(triage_data.run_id),
                "cluster_count": len(clusters)
            })
            
            return triage
            
        except Exception as e:
            db.rollback()
            raise e
    
    async def _analyze_failures(self, run: Run) -> List[Dict[str, Any]]:
        """Analyze test failures and group them into clusters"""
        try:
            clusters = []
            
            # Parse JUnit reports to extract failure information
            failure_info = self._extract_failure_info(run.reports)
            
            if not failure_info:
                # No failures found, create a generic cluster
                clusters.append({
                    "root_cause": "Unknown failure",
                    "hints": ["Check test logs for more details"],
                    "evidence": [run.logs or "No logs available"],
                    "test_ids": [],
                    "confidence": 0.1
                })
            else:
                # Group failures by type
                failure_groups = self._group_failures(failure_info)
                
                for group_type, failures in failure_groups.items():
                    cluster = {
                        "root_cause": self._identify_root_cause(group_type, failures),
                        "hints": self._generate_hints(group_type, failures),
                        "evidence": [f["error_message"] for f in failures],
                        "test_ids": [f["test_id"] for f in failures],
                        "confidence": self._calculate_cluster_confidence(group_type, failures)
                    }
                    clusters.append(cluster)
            
            return clusters
            
        except Exception as e:
            # Fallback to basic analysis
            return [{
                "root_cause": "Analysis error",
                "hints": ["Manual review required"],
                "evidence": [f"Error during analysis: {str(e)}"],
                "test_ids": [],
                "confidence": 0.0
            }]
    
    def _extract_failure_info(self, reports: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Extract failure information from JUnit reports"""
        failures = []
        
        for report in reports:
            if report.get("type") == "junit" and report.get("content"):
                # Parse JUnit XML to extract failures
                # This is a simplified parser - in production, use proper XML parsing
                xml_content = report["content"]
                
                # Extract test cases and failures
                import re
                
                # Find test cases
                test_cases = re.findall(r'<testcase[^>]*name="([^"]*)"[^>]*>', xml_content)
                
                for test_case in test_cases:
                    # Check if this test case has a failure
                    failure_pattern = rf'<testcase[^>]*name="{re.escape(test_case)}"[^>]*>.*?<failure[^>]*message="([^"]*)"[^>]*>(.*?)</failure>'
                    failure_match = re.search(failure_pattern, xml_content, re.DOTALL)
                    
                    if failure_match:
                        failures.append({
                            "test_id": test_case,
                            "error_message": failure_match.group(1),
                            "error_details": failure_match.group(2).strip()
                        })
        
        return failures
    
    def _group_failures(self, failures: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        """Group failures by type"""
        groups = {}
        
        for failure in failures:
            error_msg = failure["error_message"].lower()
            
            # Categorize failures
            if "timeout" in error_msg or "timed out" in error_msg:
                group_type = "timeout"
            elif "connection" in error_msg or "network" in error_msg:
                group_type = "network"
            elif "assertion" in error_msg or "expected" in error_msg:
                group_type = "assertion"
            elif "not found" in error_msg or "404" in error_msg:
                group_type = "not_found"
            elif "unauthorized" in error_msg or "401" in error_msg:
                group_type = "authentication"
            else:
                group_type = "other"
            
            if group_type not in groups:
                groups[group_type] = []
            groups[group_type].append(failure)
        
        return groups
    
    def _identify_root_cause(self, group_type: str, failures: List[Dict[str, Any]]) -> str:
        """Identify root cause based on failure group"""
        root_causes = {
            "timeout": "Test execution timeout - possible performance issue or resource constraint",
            "network": "Network connectivity issue - check service availability and network configuration",
            "assertion": "Test assertion failure - expected vs actual value mismatch",
            "not_found": "Resource not found - check if endpoints or pages exist",
            "authentication": "Authentication/authorization failure - check credentials and permissions",
            "other": "Unknown failure type - requires manual investigation"
        }
        
        return root_causes.get(group_type, "Unknown root cause")
    
    def _generate_hints(self, group_type: str, failures: List[Dict[str, Any]]) -> List[str]:
        """Generate helpful hints based on failure type"""
        hints_map = {
            "timeout": [
                "Increase test timeout values",
                "Check server performance and resource usage",
                "Verify test data size and complexity"
            ],
            "network": [
                "Verify service is running and accessible",
                "Check firewall and network configuration",
                "Test with curl or similar tools"
            ],
            "assertion": [
                "Review expected vs actual values",
                "Check test data and environment setup",
                "Verify API response format matches expectations"
            ],
            "not_found": [
                "Verify endpoint URLs are correct",
                "Check if resources exist in test environment",
                "Review API documentation for correct paths"
            ],
            "authentication": [
                "Verify credentials are valid",
                "Check token expiration",
                "Review authentication flow"
            ],
            "other": [
                "Review test logs for more details",
                "Check test environment setup",
                "Consider test data and configuration"
            ]
        }
        
        return hints_map.get(group_type, ["Manual review required"])
    
    def _calculate_cluster_confidence(self, group_type: str, failures: List[Dict[str, Any]]) -> float:
        """Calculate confidence score for a failure cluster"""
        base_confidence = {
            "timeout": 0.8,
            "network": 0.7,
            "assertion": 0.9,
            "not_found": 0.8,
            "authentication": 0.9,
            "other": 0.3
        }
        
        confidence = base_confidence.get(group_type, 0.3)
        
        # Adjust based on number of similar failures
        if len(failures) > 1:
            confidence += 0.1  # More failures = higher confidence
        
        return min(confidence, 1.0)
    
    def _generate_suggested_fix(self, clusters: List[Dict[str, Any]]) -> str:
        """Generate suggested fix based on clusters"""
        if not clusters:
            return "No specific fix suggested - manual review required"
        
        # Get the highest confidence cluster
        best_cluster = max(clusters, key=lambda c: c["confidence"])
        
        fixes = {
            "timeout": "Consider increasing timeout values or optimizing test performance",
            "network": "Check service availability and network connectivity",
            "assertion": "Review and update test assertions to match current behavior",
            "not_found": "Verify endpoint URLs and resource availability",
            "authentication": "Check and update authentication credentials",
            "other": "Manual review and investigation required"
        }
        
        return fixes.get(best_cluster["root_cause"].split(" - ")[0].lower(), "Manual review required")
    
    def _calculate_confidence_score(self, clusters: List[Dict[str, Any]]) -> Optional[float]:
        """Calculate overall confidence score for triage"""
        if not clusters:
            return 0.0
        
        # Weight by cluster confidence and number of tests
        total_confidence = 0.0
        total_weight = 0.0
        
        for cluster in clusters:
            weight = len(cluster["test_ids"]) if cluster["test_ids"] else 1
            total_confidence += cluster["confidence"] * weight
            total_weight += weight
        
        return total_confidence / total_weight if total_weight > 0 else 0.0
    
    async def get_triage_by_run_id(self, db: Session, run_id: str) -> Optional[TriageResultDB]:
        """Get triage results by run ID"""
        run = await self.run_service.get_run_by_id(db, run_id)
        if run:
            return db.query(TriageResultDB).filter(TriageResultDB.run_id == run.id).first()
        return None
    
    async def _log_event(
        self, 
        db: Session, 
        event_type: str, 
        entity_type: str, 
        entity_id: uuid.UUID, 
        details: dict
    ):
        """Log an event"""
        event = Event(
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id="system",  # TODO: Get from auth context
            details=details
        )
        db.add(event)
        db.commit()
