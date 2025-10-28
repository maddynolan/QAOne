from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func
from typing import List, Optional, Dict, Any
import uuid
import json
from datetime import datetime

from app.models.schemas import PatchCreate, PatchResponse
from app.models.database import Patch, TriageResult as TriageResultDB, Event
from app.services.triage_service import TriageService

class PatchService:
    """Service for managing test patches and updates"""
    
    def __init__(self):
        self.triage_service = TriageService()
    
    async def create_patch(self, db: Session, patch_data: PatchCreate) -> Patch:
        """Create patches for test updates"""
        try:
            # Verify triage exists
            triage = db.query(TriageResultDB).filter(TriageResultDB.id == patch_data.triage_id).first()
            if not triage:
                raise ValueError(f"Triage with ID {patch_data.triage_id} not found")
            
            # Generate patches based on triage results
            generated_patches = await self._generate_patches(triage, patch_data.patches)
            
            # Create patch record
            patch = Patch(
                triage_id=patch_data.triage_id,
                file_path=generated_patches[0]["file"] if generated_patches else "unknown",
                unified_diff=generated_patches[0]["unified_diff"] if generated_patches else "",
                open_pr=patch_data.branch is not None,
                pr_url=None,  # Will be set when PR is created
                state="pending",
                branch=patch_data.branch,
                created_by="system"  # TODO: Get from auth context
            )
            
            db.add(patch)
            db.commit()
            db.refresh(patch)
            
            # Log event
            await self._log_event(db, "patch_created", "patch", patch.id, {
                "triage_id": str(patch_data.triage_id),
                "patch_count": len(generated_patches),
                "branch": patch_data.branch
            })
            
            return patch
            
        except Exception as e:
            db.rollback()
            raise e
    
    async def _generate_patches(self, triage: TriageResultDB, patches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Generate patches based on triage results"""
        try:
            generated_patches = []
            
            for cluster in triage.clusters:
                # Generate patch for each cluster
                patch = await self._generate_patch_for_cluster(cluster, triage)
                if patch:
                    generated_patches.append(patch)
            
            # If no patches generated, create a basic one
            if not generated_patches:
                generated_patches.append({
                    "file": "test_fix.md",
                    "path": "test_fix.md",
                    "unified_diff": self._create_basic_patch(triage)
                })
            
            return generated_patches
            
        except Exception as e:
            # Fallback to basic patch
            return [{
                "file": "test_fix.md",
                "path": "test_fix.md",
                "unified_diff": f"# Test Fix Required\n\nError: {str(e)}\n\nManual review required."
            }]
    
    async def _generate_patch_for_cluster(self, cluster: Dict[str, Any], triage: TriageResultDB) -> Optional[Dict[str, Any]]:
        """Generate a patch for a specific failure cluster"""
        try:
            root_cause = cluster["root_cause"].lower()
            
            if "timeout" in root_cause:
                return self._create_timeout_patch(cluster)
            elif "assertion" in root_cause:
                return self._create_assertion_patch(cluster)
            elif "not found" in root_cause:
                return self._create_not_found_patch(cluster)
            elif "authentication" in root_cause:
                return self._create_auth_patch(cluster)
            else:
                return self._create_generic_patch(cluster)
                
        except Exception as e:
            return None
    
    def _create_timeout_patch(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Create patch for timeout issues"""
        return {
            "file": "test_timeout_fix.js",
            "path": "test_timeout_fix.js",
            "unified_diff": f"""--- a/test_timeout_fix.js
+++ b/test_timeout_fix.js
@@ -1,5 +1,5 @@
 test('timeout test', async () => {{
-  await page.waitForSelector('.element', {{ timeout: 5000 }});
+  await page.waitForSelector('.element', {{ timeout: 30000 }});
 }});
 
 // Additional timeout fixes:
@@ -8,6 +8,7 @@ test('timeout test', async () => {{
   // - Check server performance
   // - Optimize test data
   // - Review test complexity
+  // - Consider retry logic
 }});"""
         }
    
    def _create_assertion_patch(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Create patch for assertion failures"""
        return {
            "file": "test_assertion_fix.js",
            "path": "test_assertion_fix.js",
            "unified_diff": f"""--- a/test_assertion_fix.js
+++ b/test_assertion_fix.js
@@ -1,5 +1,5 @@
 test('assertion test', async () => {{
-  expect(actualValue).toBe(expectedValue);
+  expect(actualValue).toMatch(/expectedPattern/);
 }});
 
 // Assertion fix suggestions:
@@ -8,6 +8,7 @@ test('assertion test', async () => {{
   // - Verify test data
   // - Check environment setup
   // - Review API response format
+  // - Update expected values
 }});"""
         }
    
    def _create_not_found_patch(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Create patch for not found issues"""
        return {
            "file": "test_not_found_fix.js",
            "path": "test_not_found_fix.js",
            "unified_diff": f"""--- a/test_not_found_fix.js
+++ b/test_not_found_fix.js
@@ -1,5 +1,5 @@
 test('not found test', async () => {{
-  await page.goto('/non-existent-page');
+  await page.goto('/existing-page');
 }});
 
 // Not found fix suggestions:
@@ -8,6 +8,7 @@ test('not found test', async () => {{
   // - Verify endpoint URLs
   // - Check resource availability
   // - Review API documentation
+  // - Update test paths
 }});"""
         }
    
    def _create_auth_patch(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Create patch for authentication issues"""
        return {
            "file": "test_auth_fix.js",
            "path": "test_auth_fix.js",
            "unified_diff": f"""--- a/test_auth_fix.js
+++ b/test_auth_fix.js
@@ -1,5 +1,5 @@
 test('auth test', async () => {{
-  const token = 'invalid-token';
+  const token = await getValidToken();
 }});
 
 // Auth fix suggestions:
@@ -8,6 +8,7 @@ test('auth test', async () => {{
   // - Check token expiration
   // - Verify credentials
   // - Review auth flow
+  // - Update token generation
 }});"""
         }
    
    def _create_generic_patch(self, cluster: Dict[str, Any]) -> Dict[str, Any]:
        """Create generic patch for unknown issues"""
        return {
            "file": "test_generic_fix.md",
            "path": "test_generic_fix.md",
            "unified_diff": f"""# Test Fix Required

## Root Cause
{cluster['root_cause']}

## Suggested Actions
{chr(10).join(f"- {hint}" for hint in cluster['hints'])}

## Evidence
{chr(10).join(f"- {evidence}" for evidence in cluster['evidence'])}

## Test IDs
{chr(10).join(f"- {test_id}" for test_id in cluster['test_ids'])}

## Confidence Score
{cluster['confidence']}

Manual review and implementation required."""
        }
    
    def _create_basic_patch(self, triage: TriageResultDB) -> str:
        """Create a basic patch when no specific patches can be generated"""
        return f"""# Test Fix Required

## Triage Results
- Run ID: {triage.run_id}
- Clusters: {len(triage.clusters)}
- Confidence: {triage.confidence_score}

## Suggested Fix
{triage.suggested_fix or "Manual review required"}

## Next Steps
1. Review failure clusters
2. Implement suggested fixes
3. Re-run tests
4. Verify resolution"""
    
    async def apply_patch(self, db: Session, patch_id: str) -> bool:
        """Apply a patch (mark as applied)"""
        try:
            patch = db.query(Patch).filter(Patch.id == patch_id).first()
            if patch:
                patch.state = "applied"
                patch.applied_at = datetime.utcnow()
                patch.applied_by = "system"  # TODO: Get from auth context
                db.commit()
                
                # Log event
                await self._log_event(db, "patch_applied", "patch", patch.id, {
                    "patch_id": patch_id
                })
                return True
            
            return False
            
        except Exception as e:
            db.rollback()
            raise e
    
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
