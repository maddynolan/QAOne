"""
Requirements Intelligence Agent
Phase 2.1: Core Agents
Syncs requirements from Jira/Confluence/Azure DevOps, implements RAG, generates test cases
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import asyncio

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest, LLMProvider
from app.services.utils.rag_service import RAGService
from app.services.utils.embedding_service import EmbeddingService
from app.services.connectors.jira_connector import JiraConnector
from app.services.connectors.confluence_connector import ConfluenceConnector
from app.services.connectors.azure_devops_connector import AzureDevOpsConnector

logger = logging.getLogger(__name__)


class RequirementsAgent:
    """
    Agent for requirements intelligence:
    - Syncs requirements from external sources (Jira, Confluence, Azure DevOps)
    - Implements RAG for requirement search
    - Generates test cases from requirements
    - Builds traceability matrix
    - Detects duplicates and conflicts
    """
    
    def __init__(self):
        self.rag_service = RAGService()
        self.embedding_service = EmbeddingService()
        self.model_gateway = get_model_gateway()
        
        # Connectors (lazy initialization)
        self._jira_connector = None
        self._confluence_connector = None
        self._azure_devops_connector = None
    
    def _get_jira_connector(self) -> Optional[JiraConnector]:
        """Lazy load Jira connector"""
        if self._jira_connector is None:
            try:
                self._jira_connector = JiraConnector()
            except Exception as e:
                logger.warning(f"Jira connector not available: {e}")
        return self._jira_connector
    
    def _get_confluence_connector(self) -> Optional[ConfluenceConnector]:
        """Lazy load Confluence connector"""
        if self._confluence_connector is None:
            try:
                self._confluence_connector = ConfluenceConnector()
            except Exception as e:
                logger.warning(f"Confluence connector not available: {e}")
        return self._confluence_connector
    
    def _get_azure_devops_connector(self) -> Optional[AzureDevOpsConnector]:
        """Lazy load Azure DevOps connector"""
        if self._azure_devops_connector is None:
            try:
                self._azure_devops_connector = AzureDevOpsConnector()
            except Exception as e:
                logger.warning(f"Azure DevOps connector not available: {e}")
        return self._azure_devops_connector
    
    async def sync_jira(
        self,
        project_key: str,
        project_id: str,
        org_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Sync requirements from Jira"""
        jira = self._get_jira_connector()
        if not jira:
            raise ValueError("Jira connector not configured")
        
        issues = await jira.get_project_issues(project_key)
        synced_count = 0
        
        for issue in issues:
            requirement_data = jira.parse_issue_to_requirement(issue)
            requirement_data.update({
                "project_id": project_id,
                "org_id": org_id,
                "tenant_id": tenant_id
            })
            
            # Store requirement
            await self._store_requirement(requirement_data)
            
            # Generate embedding
            await self._generate_and_store_embedding(requirement_data, org_id, project_id, tenant_id)
            
            synced_count += 1
        
        return {
            "status": "success",
            "synced_count": synced_count,
            "source": "jira",
            "project_key": project_key
        }
    
    async def sync_confluence(
        self,
        space_key: str,
        project_id: str,
        org_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Sync requirements from Confluence"""
        confluence = self._get_confluence_connector()
        if not confluence:
            raise ValueError("Confluence connector not configured")
        
        pages = await confluence.search_pages(space_key=space_key)
        synced_count = 0
        
        for page in pages:
            requirement_data = confluence.parse_page_to_requirement(page)
            requirement_data.update({
                "project_id": project_id,
                "org_id": org_id,
                "tenant_id": tenant_id
            })
            
            await self._store_requirement(requirement_data)
            await self._generate_and_store_embedding(requirement_data, org_id, project_id, tenant_id)
            
            synced_count += 1
        
        return {
            "status": "success",
            "synced_count": synced_count,
            "source": "confluence",
            "space_key": space_key
        }
    
    async def sync_azure_devops(
        self,
        project_id: str,
        org_id: str,
        tenant_id: Optional[str] = None,
        work_item_types: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """Sync requirements from Azure DevOps"""
        azure = self._get_azure_devops_connector()
        if not azure:
            raise ValueError("Azure DevOps connector not configured")
        
        work_item_types = work_item_types or ["User Story", "Feature", "Epic"]
        wiql = f"SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType] IN ({', '.join(work_item_types)})"
        
        work_items = await azure.query_work_items(wiql)
        synced_count = 0
        
        for work_item in work_items:
            requirement_data = azure.parse_work_item_to_requirement(work_item)
            requirement_data.update({
                "project_id": project_id,
                "org_id": org_id,
                "tenant_id": tenant_id
            })
            
            await self._store_requirement(requirement_data)
            await self._generate_and_store_embedding(requirement_data, org_id, project_id, tenant_id)
            
            synced_count += 1
        
        return {
            "status": "success",
            "synced_count": synced_count,
            "source": "azure_devops"
        }
    
    async def generate_tests_from_requirement(
        self,
        requirement_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate test cases from a requirement using RAG and LLM"""
        # Get requirement
        requirement = await self._get_requirement(requirement_id)
        if not requirement:
            raise ValueError(f"Requirement {requirement_id} not found")
        
        # Get similar requirements via RAG
        similar_reqs = await self._search_similar_requirements(
            requirement.get("description", ""),
            requirement.get("org_id"),
            requirement.get("project_id"),
            tenant_id
        )
        
        # Build prompt with RAG context
        rag_context = "\n\n".join([
            f"Similar requirement: {req.get('title', '')}\n{req.get('description', '')[:500]}"
            for req in similar_reqs[:3]
        ])
        
        prompt = f"""You are an expert QA engineer. Generate comprehensive test cases for the following requirement.

Requirement:
Title: {requirement.get('title', '')}
Description: {requirement.get('description', '')}

Similar Requirements (for context):
{rag_context}

Generate an array of test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags
- test_type: "manual", "automated", or "api"

Respond ONLY with valid JSON array of test cases."""

        # Generate using Model Gateway
        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",  # Use 14B model for better quality
            validate_json=True,
            task_type="requirements"
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        # Parse and return
        import json
        test_cases = json.loads(result.response)
        
        # Generate test data for each test case (semantic test data generation)
        from app.services.core.test_data_service import get_test_data_service
        test_data_service = get_test_data_service()
        
        requirement_text = f"{requirement.get('title', '')}\n{requirement.get('description', '')}"
        test_cases_with_data = []
        
        for test_case in test_cases:
            # Generate test data for this test case
            test_data = await test_data_service.generate_test_data_for_test_case(
                test_case=test_case,
                requirement_text=requirement_text,
                tenant_id=tenant_id
            )
            
            # Attach test data to test case
            if test_data:
                test_case["test_data"] = test_data.get("payload", {})
                test_case["test_data_generated"] = test_data.get("generated_by_llm", False)
            
            test_cases_with_data.append(test_case)
        
        return {
            "status": "success",
            "requirement_id": requirement_id,
            "test_cases": test_cases_with_data,
            "similar_requirements_count": len(similar_reqs),
            "model": result.model,
            "test_data_generated": True  # Indicates test data was auto-generated
        }
    
    async def get_traceability_matrix(
        self,
        requirement_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Build traceability matrix: Requirement → Test Cases → Test Runs → Defects"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            raise ValueError("Database not available")
        
        # Build query
        query = """
            SELECT 
                r.id as requirement_id,
                r.title as requirement_title,
                r.source_ref,
                tc.id as test_case_id,
                tc.title as test_case_title,
                tr.id as test_run_id,
                tr.name as test_run_name,
                tr.status as test_run_status,
                d.id as defect_id,
                d.title as defect_title,
                d.status as defect_status
            FROM requirements r
            LEFT JOIN test_case_requirements tcr ON r.id = tcr.requirement_id
            LEFT JOIN test_cases tc ON tcr.test_case_id = tc.id
            LEFT JOIN test_runs tr ON tr.plan_id IN (
                SELECT plan_id FROM test_cases WHERE id = tc.id
            )
            LEFT JOIN defects d ON d.run_id = tr.id
            WHERE 1=1
        """
        params = []
        
        if requirement_id:
            query += " AND r.id = %s"
            params.append(requirement_id)
        
        if project_id:
            query += " AND r.project_id = %s"
            params.append(project_id)
        
        if tenant_id:
            query += " AND r.tenant_id = %s"
            params.append(tenant_id)
        
        query += " ORDER BY r.id, tc.id, tr.id"
        
        # Execute query
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._query_traceability_sync,
                pool,
                query,
                params
            )
        
        # Group by requirement
        matrix = {}
        for row in results:
            req_id = str(row["requirement_id"])
            if req_id not in matrix:
                matrix[req_id] = {
                    "requirement": {
                        "id": req_id,
                        "title": row["requirement_title"],
                        "source_ref": row["source_ref"]
                    },
                    "test_cases": [],
                    "test_runs": [],
                    "defects": []
                }
            
            req_data = matrix[req_id]
            
            if row["test_case_id"] and row["test_case_id"] not in [tc["id"] for tc in req_data["test_cases"]]:
                req_data["test_cases"].append({
                    "id": str(row["test_case_id"]),
                    "title": row["test_case_title"]
                })
            
            if row["test_run_id"] and row["test_run_id"] not in [tr["id"] for tr in req_data["test_runs"]]:
                req_data["test_runs"].append({
                    "id": str(row["test_run_id"]),
                    "name": row["test_run_name"],
                    "status": row["test_run_status"]
                })
            
            if row["defect_id"] and row["defect_id"] not in [d["id"] for d in req_data["defects"]]:
                req_data["defects"].append({
                    "id": str(row["defect_id"]),
                    "title": row["defect_title"],
                    "status": row["defect_status"]
                })
        
        return {
            "status": "success",
            "matrix": list(matrix.values()) if requirement_id else matrix,
            "count": len(matrix)
        }
    
    async def detect_duplicates(
        self,
        requirement_id: str,
        similarity_threshold: float = 0.85,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Detect duplicate or similar requirements"""
        requirement = await self._get_requirement(requirement_id)
        if not requirement:
            raise ValueError(f"Requirement {requirement_id} not found")
        
        # Search for similar requirements
        similar = await self._search_similar_requirements(
            requirement.get("description", ""),
            requirement.get("org_id"),
            requirement.get("project_id"),
            tenant_id,
            similarity_threshold=similarity_threshold
        )
        
        # Filter out self
        duplicates = [req for req in similar if str(req.get("id")) != requirement_id]
        
        return {
            "status": "success",
            "requirement_id": requirement_id,
            "duplicates": duplicates,
            "count": len(duplicates)
        }
    
    async def detect_conflicts(
        self,
        requirement_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Detect conflicts between requirements using LLM"""
        requirement = await self._get_requirement(requirement_id)
        if not requirement:
            raise ValueError(f"Requirement {requirement_id} not found")
        
        # Get related requirements
        similar = await self._search_similar_requirements(
            requirement.get("description", ""),
            requirement.get("org_id"),
            requirement.get("project_id"),
            tenant_id,
            limit=10
        )
        
        if not similar:
            return {
                "status": "success",
                "requirement_id": requirement_id,
                "conflicts": [],
                "count": 0
            }
        
        # Use LLM to detect conflicts
        prompt = f"""Analyze these requirements for conflicts, contradictions, or overlaps:

Current Requirement:
{requirement.get('title', '')}
{requirement.get('description', '')}

Related Requirements:
{chr(10).join([f"{req.get('title', '')}: {req.get('description', '')[:200]}" for req in similar[:5]])}

Identify any:
1. Contradictions (requirements that conflict)
2. Overlaps (duplicate functionality)
3. Dependencies (one requires the other)
4. Gaps (missing related requirements)

Respond in JSON format:
{{
  "conflicts": [
    {{
      "type": "contradiction|overlap|dependency|gap",
      "requirement_id": "...",
      "description": "...",
      "severity": "low|medium|high"
    }}
  ]
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        analysis = json.loads(result.response)
        
        return {
            "status": "success",
            "requirement_id": requirement_id,
            "conflicts": analysis.get("conflicts", []),
            "count": len(analysis.get("conflicts", []))
        }
    
    # ==================== Helper Methods ====================
    
    async def _store_requirement(self, requirement_data: Dict[str, Any]):
        """Store requirement in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            logger.warning("Database not available, skipping requirement storage")
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._insert_requirement_sync,
                pool,
                requirement_data
            )
    
    def _insert_requirement_sync(self, pool, data: Dict[str, Any]):
        """Synchronous requirement insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO requirements 
                    (id, project_id, source, source_ref, title, description, raw_payload, tenant_id, created_at, updated_at)
                    VALUES (uuid_generate_v4(), %s, %s, %s, %s, %s, %s, %s, NOW(), NOW())
                    ON CONFLICT (source, source_ref) DO UPDATE
                    SET title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        raw_payload = EXCLUDED.raw_payload,
                        updated_at = NOW()
                    RETURNING id
                    """,
                    (
                        data.get("project_id"),
                        data.get("source"),
                        data.get("source_ref"),
                        data.get("title"),
                        data.get("description"),
                        json.dumps(data.get("raw_payload", {})),
                        data.get("tenant_id")
                    )
                )
                return cur.fetchone()[0]
        finally:
            pool.putconn(conn)
    
    async def _generate_and_store_embedding(
        self,
        requirement_data: Dict[str, Any],
        org_id: str,
        project_id: str,
        tenant_id: Optional[str]
    ):
        """Generate and store embedding for requirement"""
        try:
            # Generate embedding
            text = f"{requirement_data.get('title', '')} {requirement_data.get('description', '')}"
            embedding = await self.embedding_service.generate_embedding(text)
            
            # Store in requirement_embeddings table
            import concurrent.futures
            from app.services.storage.postgres_direct import get_postgres_pool
            import numpy as np
            
            pool = get_postgres_pool()
            if not pool:
                return
            
            requirement_id = requirement_data.get("id")
            if not requirement_id:
                # Get ID from database
                requirement_id = await self._get_requirement_id_by_ref(
                    requirement_data.get("source"),
                    requirement_data.get("source_ref")
                )
            
            if requirement_id:
                loop = asyncio.get_event_loop()
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    await loop.run_in_executor(
                        executor,
                        self._insert_embedding_sync,
                        pool,
                        requirement_id,
                        org_id,
                        project_id,
                        embedding,
                        tenant_id
                    )
        except Exception as e:
            logger.warning(f"Failed to generate/store embedding: {e}")
    
    def _insert_embedding_sync(self, pool, requirement_id, org_id, project_id, embedding, tenant_id):
        """Synchronous embedding insert"""
        import numpy as np
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                # Convert numpy array to PostgreSQL vector format
                embedding_str = '[' + ','.join(map(str, embedding.tolist())) + ']'
                
                cur.execute(
                    """
                    INSERT INTO requirement_embeddings 
                    (requirement_id, organization_id, project_id, embedding, tenant_id, created_at, updated_at)
                    VALUES (%s, %s, %s, %s::vector, %s, NOW(), NOW())
                    ON CONFLICT (requirement_id) DO UPDATE
                    SET embedding = EXCLUDED.embedding,
                        updated_at = NOW()
                    """,
                    (requirement_id, org_id, project_id, embedding_str, tenant_id)
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _get_requirement(self, requirement_id: str) -> Optional[Dict[str, Any]]:
        """Get requirement by ID"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_requirement_sync,
                pool,
                requirement_id
            )
        return result
    
    def _get_requirement_sync(self, pool, requirement_id: str) -> Optional[Dict[str, Any]]:
        """Synchronous requirement query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM requirements WHERE id = %s",
                    (requirement_id,)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("raw_payload"):
                    result["raw_payload"] = json.loads(result["raw_payload"]) if isinstance(result["raw_payload"], str) else result["raw_payload"]
                
                return result
        finally:
            pool.putconn(conn)
    
    async def _get_requirement_id_by_ref(self, source: str, source_ref: str) -> Optional[str]:
        """Get requirement ID by source and source_ref"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_requirement_id_sync,
                pool,
                source,
                source_ref
            )
        return result
    
    def _get_requirement_id_sync(self, pool, source: str, source_ref: str) -> Optional[str]:
        """Synchronous requirement ID query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id FROM requirements WHERE source = %s AND source_ref = %s",
                    (source, source_ref)
                )
                row = cur.fetchone()
                return str(row[0]) if row else None
        finally:
            pool.putconn(conn)
    
    async def _search_similar_requirements(
        self,
        query_text: str,
        org_id: str,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        limit: int = 5,
        similarity_threshold: float = 0.7
    ) -> List[Dict[str, Any]]:
        """Search for similar requirements using RAG"""
        try:
            # Generate query embedding
            query_embedding = await self.embedding_service.generate_embedding(query_text)
            
            # Search via RAG service
            results = await self.rag_service.search_similar_requirements(
                organization_id=org_id,
                query_embedding=query_embedding,
                limit=limit,
                similarity_threshold=similarity_threshold,
                project_id=project_id
            )
            
            return results
        except Exception as e:
            logger.warning(f"RAG search failed: {e}")
            return []
    
    def _query_traceability_sync(self, pool, query: str, params: List) -> List[Dict[str, Any]]:
        """Synchronous traceability query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                results = [dict(zip(columns, row)) for row in cur.fetchall()]
                return results
        finally:
            pool.putconn(conn)
    
    async def infer_requirements_from_flow(
        self,
        recording_data: Dict[str, Any],
        test_case: Dict[str, Any],
        project_id: Optional[str] = None,
        org_id: Optional[str] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Infer implicit requirements from recorded flow and existing Jira issues
        Suggests missing acceptance criteria
        """
        # Extract flow information
        flow_description = self._extract_flow_description(recording_data, test_case)
        
        # Search existing Jira issues for similar requirements
        similar_requirements = []
        if org_id:
            similar_requirements = await self._search_similar_requirements(
                query_text=flow_description,
                org_id=org_id,
                project_id=project_id,
                tenant_id=tenant_id,
                limit=5
            )
        
        import json
        
        # Use LLM to infer requirements and suggest acceptance criteria
        prompt = f"""Analyze this user flow and infer implicit requirements:

Flow Description:
{flow_description}

Test Case:
Title: {test_case.get('title', '')}
Description: {test_case.get('description', '')}
Steps: {json.dumps(test_case.get('steps', []), indent=2)}

Existing Similar Requirements (for context):
{chr(10).join([f"- {req.get('title', '')}: {req.get('description', '')[:200]}" for req in similar_requirements[:3]])}

Based on this flow, infer:
1. Implicit functional requirements (what the user expects to happen)
2. Missing acceptance criteria (what should be validated)
3. Edge cases that might need testing

Respond in JSON format:
{{
  "requirements": [
    {{
      "title": "Requirement title",
      "description": "Detailed description",
      "type": "functional|non-functional",
      "priority": "high|medium|low"
    }}
  ],
  "suggested_acceptance_criteria": [
    "Criterion 1",
    "Criterion 2",
    ...
  ]
}}"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True,
            task_type="requirements"
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        try:
            analysis = json.loads(result.response)
            
            # Store inferred requirements
            stored_requirements = []
            for req in analysis.get("requirements", []):
                req_data = {
                    "project_id": project_id,
                    "org_id": org_id,
                    "tenant_id": tenant_id,
                    "source": "inferred",
                    "source_ref": f"flow_{recording_data.get('recording_id', 'unknown')}",
                    "title": req.get("title"),
                    "description": req.get("description"),
                    "raw_payload": req
                }
                await self._store_requirement(req_data)
                
                # Get stored requirement ID
                stored_req = await self._get_requirement_by_ref(
                    "inferred",
                    req_data["source_ref"]
                )
                if stored_req:
                    stored_requirements.append(stored_req)
            
            return {
                "status": "success",
                "requirements": stored_requirements,
                "suggested_acceptance_criteria": analysis.get("suggested_acceptance_criteria", []),
                "similar_requirements_count": len(similar_requirements)
            }
        except Exception as e:
            logger.warning(f"Failed to parse requirements inference: {e}")
            return {
                "status": "success",
                "requirements": [],
                "suggested_acceptance_criteria": [],
                "similar_requirements_count": len(similar_requirements)
            }
    
    def _extract_flow_description(
        self,
        recording_data: Dict[str, Any],
        test_case: Dict[str, Any]
    ) -> str:
        """Extract human-readable flow description"""
        url = recording_data.get("url", "")
        title = recording_data.get("title", "")
        steps = test_case.get("steps", [])
        
        steps_text = "\n".join([
            f"{i+1}. {step.get('action', '')} - Expected: {step.get('expected_result', '')}"
            for i, step in enumerate(steps)
        ])
        
        return f"""
Flow: {title}
URL: {url}

Steps:
{steps_text}
"""
    
    async def _get_requirement_by_ref(self, source: str, source_ref: str) -> Optional[Dict[str, Any]]:
        """Get requirement by source and source_ref"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return None
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                self._get_requirement_by_ref_sync,
                pool,
                source,
                source_ref
            )
        return result
    
    def _get_requirement_by_ref_sync(self, pool, source: str, source_ref: str) -> Optional[Dict[str, Any]]:
        """Synchronous requirement by ref query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM requirements WHERE source = %s AND source_ref = %s",
                    (source, source_ref)
                )
                row = cur.fetchone()
                if not row:
                    return None
                
                columns = [desc[0] for desc in cur.description]
                result = dict(zip(columns, row))
                
                if result.get("raw_payload"):
                    result["raw_payload"] = json.loads(result["raw_payload"]) if isinstance(result["raw_payload"], str) else result["raw_payload"]
                
                return result
        finally:
            pool.putconn(conn)


# Agent handler function for registry
async def requirements_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """
    Handler function for Requirements Agent tasks
    Registered with agent registry
    """
    import time
    start_time = time.time()
    
    agent = RequirementsAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "sync_jira":
            result = await agent.sync_jira(
                project_key=request.input_data.get("project_key"),
                project_id=request.project_id or "",
                org_id=request.org_id or "",
                tenant_id=request.tenant_id
            )
        
        elif operation == "sync_confluence":
            result = await agent.sync_confluence(
                space_key=request.input_data.get("space_key"),
                project_id=request.project_id or "",
                org_id=request.org_id or "",
                tenant_id=request.tenant_id
            )
        
        elif operation == "sync_azure_devops":
            result = await agent.sync_azure_devops(
                project_id=request.project_id or "",
                org_id=request.org_id or "",
                tenant_id=request.tenant_id,
                work_item_types=request.input_data.get("work_item_types")
            )
        
        elif operation == "generate_tests":
            result = await agent.generate_tests_from_requirement(
                requirement_id=request.input_data.get("requirement_id"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "traceability":
            result = await agent.get_traceability_matrix(
                requirement_id=request.input_data.get("requirement_id"),
                project_id=request.project_id,
                tenant_id=request.tenant_id
            )
        
        elif operation == "detect_duplicates":
            result = await agent.detect_duplicates(
                requirement_id=request.input_data.get("requirement_id"),
                similarity_threshold=request.input_data.get("similarity_threshold", 0.85),
                tenant_id=request.tenant_id
            )
        
        elif operation == "detect_conflicts":
            result = await agent.detect_conflicts(
                requirement_id=request.input_data.get("requirement_id"),
                tenant_id=request.tenant_id
            )
        
        else:
            raise ValueError(f"Unknown operation: {operation}")
        
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.COMPLETED,
            output_data=result,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )
    
    except Exception as e:
        logger.error(f"Requirements agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

