"""
Performance Testing Agent - Wrapper around k6 executor with metrics storage
Phase 3.1: Specialized Agents
"""

import logging
import asyncio
from typing import Dict, List, Any, Optional
from datetime import datetime
import time

from app.schemas.agent_schemas import (
    AgentTaskRequest, AgentTaskResult, AgentType, AgentStatus
)
from app.services.llm.model_gateway import get_model_gateway, GenerationRequest
from app.services.executors.k6_executor import K6Executor

logger = logging.getLogger(__name__)


class PerformanceAgent:
    """
    Agent for performance testing:
    - Executes k6 performance tests
    - Stores metrics in time-series database
    - Tracks SLA violations
    - Generates performance recommendations
    """
    
    def __init__(self):
        self.k6_executor = K6Executor()
        self.model_gateway = get_model_gateway()
    
    async def execute_performance_test(
        self,
        test_script: str,
        options: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        requirement_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Execute a performance test and store results"""
        # Execute k6 test
        result = await self.k6_executor.execute_test(test_script, options)
        
        # Store run metadata
        run_id = await self._store_perf_run(
            project_id=project_id,
            tenant_id=tenant_id,
            requirement_id=requirement_id,
            test_script=test_script,
            options=options or {},
            result=result
        )
        
        # Store metrics
        if result.get("metrics"):
            await self._store_metrics(run_id, result["metrics"], tenant_id)
        
        # Check SLA violations
        sla_violations = await self._check_sla_violations(run_id, result, tenant_id)
        
        # Generate recommendations
        recommendations = await self._generate_recommendations(result, tenant_id)
        
        return {
            "status": "success",
            "run_id": run_id,
            "result": result,
            "sla_violations": sla_violations,
            "recommendations": recommendations
        }
    
    async def generate_k6_script(
        self,
        endpoints: List[Dict[str, Any]],
        load_profile: Optional[Dict[str, Any]] = None,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Generate k6 script from endpoints using LLM"""
        load_profile = load_profile or {
            "stages": [
                {"duration": "30s", "target": 10},
                {"duration": "1m", "target": 50},
                {"duration": "30s", "target": 0}
            ]
        }
        
        endpoints_desc = "\n".join([
            f"- {ep.get('method', 'GET')} {ep.get('url', '')}: {ep.get('description', '')}"
            for ep in endpoints
        ])
        
        prompt = f"""Generate a k6 performance test script for the following endpoints:

{endpoints_desc}

Load profile:
{load_profile}

Generate a complete k6 script in JavaScript that:
1. Tests all endpoints
2. Implements the load profile
3. Collects metrics (response time, throughput, error rate)
4. Includes proper error handling
5. Uses realistic test data

Respond with ONLY the k6 script code, no explanations."""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            task_type="performance"
        )
        
        result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        return {
            "status": "success",
            "script": result.response,
            "model": result.model
        }
    
    async def get_performance_metrics(
        self,
        run_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get performance metrics"""
        metrics = await self._get_metrics(
            run_id=run_id,
            project_id=project_id,
            tenant_id=tenant_id,
            start_date=start_date,
            end_date=end_date
        )
        
        return {
            "status": "success",
            "metrics": metrics
        }
    
    async def get_sla_status(
        self,
        project_id: str,
        tenant_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Get SLA compliance status"""
        sla_config = await self._get_sla_config(project_id, tenant_id)
        recent_runs = await self._get_recent_runs(project_id, tenant_id, limit=10)
        
        violations = []
        for run in recent_runs:
            run_metrics = await self._get_metrics(run_id=run.get("id"))
            violations.extend(await self._check_sla_violations(run.get("id"), {"metrics": run_metrics}, tenant_id))
        
        return {
            "status": "success",
            "sla_config": sla_config,
            "violations": violations,
            "compliance_rate": 1.0 - (len(violations) / max(len(recent_runs), 1))
        }
    
    # ==================== Helper Methods ====================
    
    async def _store_perf_run(
        self,
        project_id: Optional[str],
        tenant_id: Optional[str],
        requirement_id: Optional[str],
        test_script: str,
        options: Dict[str, Any],
        result: Dict[str, Any]
    ) -> str:
        """Store performance run in database"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        from uuid import uuid4
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return str(uuid4())
        
        run_id = str(uuid4())
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_perf_run_sync,
                pool,
                run_id,
                project_id,
                tenant_id,
                requirement_id,
                test_script,
                options,
                result
            )
        
        return run_id
    
    def _store_perf_run_sync(
        self,
        pool,
        run_id: str,
        project_id: Optional[str],
        tenant_id: Optional[str],
        requirement_id: Optional[str],
        test_script: str,
        options: Dict[str, Any],
        result: Dict[str, Any]
    ):
        """Synchronous perf run insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO perf_runs
                    (id, project_id, requirement_id, test_script, options, result, tenant_id, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
                    """,
                    (
                        run_id,
                        project_id,
                        requirement_id,
                        test_script,
                        json.dumps(options),
                        json.dumps(result),
                        tenant_id
                    )
                )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _store_metrics(self, run_id: str, metrics: Dict[str, Any], tenant_id: Optional[str]):
        """Store performance metrics"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            await loop.run_in_executor(
                executor,
                self._store_metrics_sync,
                pool,
                run_id,
                metrics,
                tenant_id
            )
    
    def _store_metrics_sync(self, pool, run_id: str, metrics: Dict[str, Any], tenant_id: Optional[str]):
        """Synchronous metrics insert"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                for metric_name, metric_data in metrics.items():
                    cur.execute(
                        """
                        INSERT INTO perf_metrics
                        (run_id, metric_name, value, unit, timestamp, tenant_id, created_at)
                        VALUES (%s, %s, %s, %s, NOW(), %s, NOW())
                        """,
                        (
                            run_id,
                            metric_name,
                            metric_data.get("value"),
                            metric_data.get("unit", ""),
                            tenant_id
                        )
                    )
                conn.commit()
        finally:
            pool.putconn(conn)
    
    async def _check_sla_violations(
        self,
        run_id: str,
        result: Dict[str, Any],
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Check for SLA violations"""
        # Get SLA config
        sla_config = await self._get_sla_config(None, tenant_id)
        if not sla_config:
            return []
        
        violations = []
        metrics = result.get("metrics", {})
        
        # Check response time
        if "http_req_duration" in metrics:
            avg_duration = metrics["http_req_duration"].get("avg", 0)
            max_duration = sla_config.get("max_response_time_ms", 1000)
            if avg_duration > max_duration:
                violations.append({
                    "type": "response_time",
                    "metric": "http_req_duration",
                    "value": avg_duration,
                    "threshold": max_duration,
                    "severity": "high" if avg_duration > max_duration * 2 else "medium"
                })
        
        # Check error rate
        if "http_req_failed" in metrics:
            error_rate = metrics["http_req_failed"].get("rate", 0)
            max_error_rate = sla_config.get("max_error_rate", 0.01)
            if error_rate > max_error_rate:
                violations.append({
                    "type": "error_rate",
                    "metric": "http_req_failed",
                    "value": error_rate,
                    "threshold": max_error_rate,
                    "severity": "critical" if error_rate > 0.1 else "high"
                })
        
        return violations
    
    async def _generate_recommendations(
        self,
        result: Dict[str, Any],
        tenant_id: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Generate performance recommendations using LLM"""
        metrics_summary = "\n".join([
            f"{name}: {data.get('avg', 0)} {data.get('unit', '')}"
            for name, data in result.get("metrics", {}).items()
        ])
        
        prompt = f"""Analyze these performance test results and provide recommendations:

Metrics:
{metrics_summary}

Provide 3-5 actionable recommendations to improve performance.
Format as JSON array:
[
  {{
    "priority": "high|medium|low",
    "category": "caching|database|code|infrastructure",
    "recommendation": "...",
    "expected_impact": "..."
  }}
]"""

        gen_request = GenerationRequest(
            prompt=prompt,
            mode="ui",
            validate_json=True
        )
        
        llm_result = await self.model_gateway.generate(gen_request, tenant_id=tenant_id)
        
        import json
        try:
            recommendations = json.loads(llm_result.response)
            return recommendations if isinstance(recommendations, list) else []
        except:
            return []
    
    async def _get_sla_config(
        self,
        project_id: Optional[str],
        tenant_id: Optional[str]
    ) -> Optional[Dict[str, Any]]:
        """Get SLA configuration"""
        # Default SLA config
        return {
            "max_response_time_ms": 1000,
            "max_error_rate": 0.01,
            "min_throughput_rps": 100
        }
    
    async def _get_recent_runs(
        self,
        project_id: str,
        tenant_id: Optional[str],
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get recent performance runs"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        import json
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_recent_runs_sync,
                pool,
                project_id,
                tenant_id,
                limit
            )
        return results
    
    def _get_recent_runs_sync(
        self,
        pool,
        project_id: str,
        tenant_id: Optional[str],
        limit: int
    ) -> List[Dict[str, Any]]:
        """Synchronous recent runs query"""
        import json
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT * FROM perf_runs WHERE project_id = %s"
                params = [project_id]
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                query += " ORDER BY created_at DESC LIMIT %s"
                params.append(limit)
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                results = []
                
                for row in cur.fetchall():
                    result = dict(zip(columns, row))
                    if result.get("options"):
                        result["options"] = json.loads(result["options"]) if isinstance(result["options"], str) else result["options"]
                    if result.get("result"):
                        result["result"] = json.loads(result["result"]) if isinstance(result["result"], str) else result["result"]
                    results.append(result)
                
                return results
        finally:
            pool.putconn(conn)
    
    async def _get_metrics(
        self,
        run_id: Optional[str] = None,
        project_id: Optional[str] = None,
        tenant_id: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get performance metrics"""
        import concurrent.futures
        from app.services.storage.postgres_direct import get_postgres_pool
        
        pool = get_postgres_pool()
        if not pool:
            return []
        
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            results = await loop.run_in_executor(
                executor,
                self._get_metrics_sync,
                pool,
                run_id,
                project_id,
                tenant_id,
                start_date,
                end_date
            )
        return results
    
    def _get_metrics_sync(
        self,
        pool,
        run_id: Optional[str],
        project_id: Optional[str],
        tenant_id: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str]
    ) -> List[Dict[str, Any]]:
        """Synchronous metrics query"""
        conn = pool.getconn()
        try:
            with conn.cursor() as cur:
                query = "SELECT * FROM perf_metrics WHERE 1=1"
                params = []
                
                if run_id:
                    query += " AND run_id = %s"
                    params.append(run_id)
                
                if project_id:
                    query += " AND run_id IN (SELECT id FROM perf_runs WHERE project_id = %s)"
                    params.append(project_id)
                
                if tenant_id:
                    query += " AND tenant_id = %s"
                    params.append(tenant_id)
                
                if start_date:
                    query += " AND timestamp >= %s"
                    params.append(start_date)
                
                if end_date:
                    query += " AND timestamp <= %s"
                    params.append(end_date)
                
                query += " ORDER BY timestamp DESC"
                
                cur.execute(query, params)
                columns = [desc[0] for desc in cur.description]
                return [dict(zip(columns, row)) for row in cur.fetchall()]
        finally:
            pool.putconn(conn)


# Agent handler function
async def performance_agent_handler(request: AgentTaskRequest) -> AgentTaskResult:
    """Handler for Performance Agent tasks"""
    import asyncio
    start_time = time.time()
    
    agent = PerformanceAgent()
    operation = request.input_data.get("operation")
    
    try:
        if operation == "execute":
            result = await agent.execute_performance_test(
                test_script=request.input_data.get("test_script"),
                options=request.input_data.get("options"),
                project_id=request.project_id,
                tenant_id=request.tenant_id,
                requirement_id=request.input_data.get("requirement_id")
            )
        
        elif operation == "generate_script":
            result = await agent.generate_k6_script(
                endpoints=request.input_data.get("endpoints", []),
                load_profile=request.input_data.get("load_profile"),
                tenant_id=request.tenant_id
            )
        
        elif operation == "metrics":
            result = await agent.get_performance_metrics(
                run_id=request.input_data.get("run_id"),
                project_id=request.project_id,
                tenant_id=request.tenant_id,
                start_date=request.input_data.get("start_date"),
                end_date=request.input_data.get("end_date")
            )
        
        elif operation == "sla_status":
            result = await agent.get_sla_status(
                project_id=request.project_id or "",
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
        logger.error(f"Performance agent task failed: {e}", exc_info=True)
        return AgentTaskResult(
            task_id=request.task_id,
            agent_type=request.agent_type,
            status=AgentStatus.FAILED,
            error=str(e),
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            duration_ms=(time.time() - start_time) * 1000
        )

