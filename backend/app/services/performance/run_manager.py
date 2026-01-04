"""
Run Manager - Test Run State Machine and Persistent Storage
Enterprise-grade run tracking with PASS/FAIL gates
"""

import logging
import json
import asyncio
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
from enum import Enum
from pathlib import Path
import uuid

logger = logging.getLogger(__name__)


class RunState(Enum):
    """Test run states (state machine)"""
    CREATED = "created"        # Run created, not started
    QUEUED = "queued"          # Waiting for workers
    STARTING = "starting"      # Workers initializing
    RUNNING = "running"        # Active load generation
    STOPPING = "stopping"      # Graceful shutdown
    FINISHED = "finished"      # Completed successfully
    FAILED = "failed"          # Failed with errors
    CANCELLED = "cancelled"    # User cancelled


class ThresholdOperator(Enum):
    """Threshold comparison operators"""
    LT = "<"
    LTE = "<="
    GT = ">"
    GTE = ">="
    EQ = "=="


@dataclass
class Threshold:
    """Pass/Fail threshold definition"""
    metric: str              # e.g., "response_time.p95"
    operator: ThresholdOperator
    value: float
    name: str = ""           # Human-readable name
    critical: bool = False   # If true, fails entire run
    
    def evaluate(self, actual_value: float) -> bool:
        """Check if threshold passes"""
        if self.operator == ThresholdOperator.LT:
            return actual_value < self.value
        elif self.operator == ThresholdOperator.LTE:
            return actual_value <= self.value
        elif self.operator == ThresholdOperator.GT:
            return actual_value > self.value
        elif self.operator == ThresholdOperator.GTE:
            return actual_value >= self.value
        elif self.operator == ThresholdOperator.EQ:
            return abs(actual_value - self.value) < 0.001
        return False


@dataclass
class ThresholdResult:
    """Result of threshold evaluation"""
    threshold: Threshold
    actual_value: float
    passed: bool
    message: str


@dataclass
class TestRun:
    """Complete test run with state tracking"""
    run_id: str
    scenario_id: str
    scenario_name: str
    state: RunState = RunState.CREATED
    
    # Configuration
    virtual_users: int = 10
    duration_seconds: int = 60
    ramp_up_seconds: int = 10
    ramp_down_seconds: int = 10
    target_url: str = ""
    
    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    stopped_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    
    # Metrics (final)
    metrics: Dict[str, Any] = field(default_factory=dict)
    system_metrics: Dict[str, Any] = field(default_factory=dict)
    
    # Thresholds & Verdict
    thresholds: List[Threshold] = field(default_factory=list)
    threshold_results: List[ThresholdResult] = field(default_factory=list)
    verdict: str = "PENDING"  # PASS, FAIL, PENDING, ERROR
    verdict_reason: str = ""
    
    # Errors
    errors: List[Dict[str, Any]] = field(default_factory=list)
    
    # Metadata
    created_by: str = ""
    tags: List[str] = field(default_factory=list)
    notes: str = ""


class RunManager:
    """
    Run Manager - Orchestrates test runs with state machine
    Provides Pass/Fail gates and persistent storage
    """
    
    def __init__(self, storage_path: str = "data/performance_runs"):
        self.runs: Dict[str, TestRun] = {}
        self.storage_path = Path(storage_path)
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._load_runs()
    
    def _load_runs(self):
        """Load runs from disk on startup"""
        try:
            runs_file = self.storage_path / "runs_index.json"
            if runs_file.exists():
                with open(runs_file, 'r') as f:
                    runs_data = json.load(f)
                for run_data in runs_data:
                    run = self._dict_to_run(run_data)
                    self.runs[run.run_id] = run
                logger.info(f"Loaded {len(self.runs)} historical runs")
        except Exception as e:
            logger.error(f"Error loading runs: {e}")
    
    def _save_runs(self):
        """Persist runs to disk"""
        try:
            runs_data = [self._run_to_dict(run) for run in self.runs.values()]
            runs_file = self.storage_path / "runs_index.json"
            with open(runs_file, 'w') as f:
                json.dump(runs_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Error saving runs: {e}")
    
    def _run_to_dict(self, run: TestRun) -> dict:
        """Convert TestRun to dict for serialization"""
        return {
            "run_id": run.run_id,
            "scenario_id": run.scenario_id,
            "scenario_name": run.scenario_name,
            "state": run.state.value,
            "virtual_users": run.virtual_users,
            "duration_seconds": run.duration_seconds,
            "ramp_up_seconds": run.ramp_up_seconds,
            "ramp_down_seconds": run.ramp_down_seconds,
            "target_url": run.target_url,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "started_at": run.started_at.isoformat() if run.started_at else None,
            "stopped_at": run.stopped_at.isoformat() if run.stopped_at else None,
            "finished_at": run.finished_at.isoformat() if run.finished_at else None,
            "metrics": run.metrics,
            "system_metrics": run.system_metrics,
            "thresholds": [
                {"metric": t.metric, "operator": t.operator.value, "value": t.value, 
                 "name": t.name, "critical": t.critical}
                for t in run.thresholds
            ],
            "threshold_results": [
                {"metric": r.threshold.metric, "actual": r.actual_value, 
                 "passed": r.passed, "message": r.message}
                for r in run.threshold_results
            ],
            "verdict": run.verdict,
            "verdict_reason": run.verdict_reason,
            "errors": run.errors,
            "created_by": run.created_by,
            "tags": run.tags,
            "notes": run.notes
        }
    
    def _dict_to_run(self, data: dict) -> TestRun:
        """Convert dict to TestRun"""
        thresholds = [
            Threshold(
                metric=t["metric"],
                operator=ThresholdOperator(t["operator"]),
                value=t["value"],
                name=t.get("name", ""),
                critical=t.get("critical", False)
            )
            for t in data.get("thresholds", [])
        ]
        
        return TestRun(
            run_id=data["run_id"],
            scenario_id=data["scenario_id"],
            scenario_name=data["scenario_name"],
            state=RunState(data.get("state", "created")),
            virtual_users=data.get("virtual_users", 10),
            duration_seconds=data.get("duration_seconds", 60),
            ramp_up_seconds=data.get("ramp_up_seconds", 10),
            ramp_down_seconds=data.get("ramp_down_seconds", 10),
            target_url=data.get("target_url", ""),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            stopped_at=datetime.fromisoformat(data["stopped_at"]) if data.get("stopped_at") else None,
            finished_at=datetime.fromisoformat(data["finished_at"]) if data.get("finished_at") else None,
            metrics=data.get("metrics", {}),
            system_metrics=data.get("system_metrics", {}),
            thresholds=thresholds,
            threshold_results=[],
            verdict=data.get("verdict", "PENDING"),
            verdict_reason=data.get("verdict_reason", ""),
            errors=data.get("errors", []),
            created_by=data.get("created_by", ""),
            tags=data.get("tags", []),
            notes=data.get("notes", "")
        )
    
    # ========================
    # Run Lifecycle Methods
    # ========================
    
    def create_run(
        self,
        scenario_id: str,
        scenario_name: str,
        virtual_users: int = 10,
        duration_seconds: int = 60,
        ramp_up_seconds: int = 10,
        target_url: str = "",
        thresholds: Optional[List[Dict[str, Any]]] = None,
        created_by: str = "",
        tags: Optional[List[str]] = None
    ) -> TestRun:
        """Create a new test run (state: CREATED)"""
        run_id = f"run_{uuid.uuid4().hex[:12]}"
        
        # Parse thresholds
        parsed_thresholds = []
        if thresholds:
            for t in thresholds:
                parsed_thresholds.append(Threshold(
                    metric=t["metric"],
                    operator=ThresholdOperator(t.get("operator", "<")),
                    value=float(t["value"]),
                    name=t.get("name", t["metric"]),
                    critical=t.get("critical", False)
                ))
        
        run = TestRun(
            run_id=run_id,
            scenario_id=scenario_id,
            scenario_name=scenario_name,
            state=RunState.CREATED,
            virtual_users=virtual_users,
            duration_seconds=duration_seconds,
            ramp_up_seconds=ramp_up_seconds,
            target_url=target_url,
            thresholds=parsed_thresholds,
            created_by=created_by,
            tags=tags or []
        )
        
        self.runs[run_id] = run
        self._save_runs()
        
        logger.info(f"Created run {run_id} for scenario {scenario_name}")
        return run
    
    def transition_state(self, run_id: str, new_state: RunState):
        """Transition run to new state"""
        if run_id not in self.runs:
            raise ValueError(f"Run not found: {run_id}")
        
        run = self.runs[run_id]
        old_state = run.state
        
        # Validate transitions
        valid_transitions = {
            RunState.CREATED: [RunState.QUEUED, RunState.STARTING, RunState.CANCELLED],
            RunState.QUEUED: [RunState.STARTING, RunState.CANCELLED],
            RunState.STARTING: [RunState.RUNNING, RunState.FAILED, RunState.CANCELLED],
            RunState.RUNNING: [RunState.STOPPING, RunState.FINISHED, RunState.FAILED],
            RunState.STOPPING: [RunState.FINISHED, RunState.FAILED],
            RunState.FINISHED: [],  # Terminal
            RunState.FAILED: [],    # Terminal
            RunState.CANCELLED: []  # Terminal
        }
        
        if new_state not in valid_transitions.get(old_state, []):
            logger.warning(f"Invalid state transition: {old_state.value} -> {new_state.value}")
            # Allow it anyway for flexibility
        
        run.state = new_state
        
        # Update timestamps
        if new_state == RunState.STARTING:
            run.started_at = datetime.utcnow()
        elif new_state == RunState.STOPPING:
            run.stopped_at = datetime.utcnow()
        elif new_state in [RunState.FINISHED, RunState.FAILED, RunState.CANCELLED]:
            run.finished_at = datetime.utcnow()
        
        self._save_runs()
        logger.info(f"Run {run_id}: {old_state.value} -> {new_state.value}")
    
    def update_metrics(self, run_id: str, metrics: Dict[str, Any]):
        """Update run metrics"""
        if run_id not in self.runs:
            return
        
        self.runs[run_id].metrics = metrics
        self._save_runs()
    
    def add_error(self, run_id: str, error: Dict[str, Any]):
        """Add error to run"""
        if run_id not in self.runs:
            return
        
        self.runs[run_id].errors.append({
            **error,
            "timestamp": datetime.utcnow().isoformat()
        })
        self._save_runs()
    
    # ========================
    # Pass/Fail Gates
    # ========================
    
    def evaluate_thresholds(self, run_id: str) -> str:
        """
        Evaluate all thresholds and determine PASS/FAIL verdict
        Returns: "PASS", "FAIL", or "ERROR"
        """
        if run_id not in self.runs:
            return "ERROR"
        
        run = self.runs[run_id]
        
        if not run.thresholds:
            run.verdict = "PASS"
            run.verdict_reason = "No thresholds defined"
            self._save_runs()
            return "PASS"
        
        if not run.metrics:
            run.verdict = "ERROR"
            run.verdict_reason = "No metrics available for evaluation"
            self._save_runs()
            return "ERROR"
        
        # Evaluate each threshold
        results = []
        failed_count = 0
        critical_failures = []
        
        for threshold in run.thresholds:
            actual_value = self._get_metric_value(run.metrics, threshold.metric)
            passed = threshold.evaluate(actual_value)
            
            result = ThresholdResult(
                threshold=threshold,
                actual_value=actual_value,
                passed=passed,
                message=f"{threshold.name or threshold.metric}: {actual_value:.2f} {threshold.operator.value} {threshold.value} → {'✅ PASS' if passed else '❌ FAIL'}"
            )
            results.append(result)
            
            if not passed:
                failed_count += 1
                if threshold.critical:
                    critical_failures.append(threshold.name or threshold.metric)
        
        run.threshold_results = results
        
        # Determine verdict
        if critical_failures:
            run.verdict = "FAIL"
            run.verdict_reason = f"Critical threshold(s) failed: {', '.join(critical_failures)}"
        elif failed_count > 0:
            run.verdict = "FAIL"
            run.verdict_reason = f"{failed_count} of {len(run.thresholds)} thresholds failed"
        else:
            run.verdict = "PASS"
            run.verdict_reason = f"All {len(run.thresholds)} thresholds passed"
        
        self._save_runs()
        logger.info(f"Run {run_id} verdict: {run.verdict} ({run.verdict_reason})")
        
        return run.verdict
    
    def _get_metric_value(self, metrics: Dict[str, Any], path: str) -> float:
        """Get metric value from nested path (e.g., 'response_time.p95')"""
        parts = path.split(".")
        value = metrics
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part, 0)
            else:
                return 0.0
        
        return float(value) if value else 0.0
    
    # ========================
    # Default Thresholds
    # ========================
    
    @staticmethod
    def get_default_thresholds() -> List[Dict[str, Any]]:
        """Get sensible default thresholds"""
        return [
            {"metric": "response_time.p95", "operator": "<", "value": 800, 
             "name": "P95 Response Time < 800ms", "critical": False},
            {"metric": "response_time.p99", "operator": "<", "value": 2000, 
             "name": "P99 Response Time < 2s", "critical": False},
            {"metric": "iterations.error_rate", "operator": "<", "value": 0.01, 
             "name": "Error Rate < 1%", "critical": True},
            {"metric": "throughput.rps", "operator": ">", "value": 10, 
             "name": "Throughput > 10 RPS", "critical": False}
        ]
    
    # ========================
    # Query Methods
    # ========================
    
    def get_run(self, run_id: str) -> Optional[TestRun]:
        """Get run by ID"""
        return self.runs.get(run_id)
    
    def get_run_summary(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get run summary for API response"""
        run = self.get_run(run_id)
        if not run:
            return None
        
        return self._run_to_dict(run)
    
    def list_runs(
        self,
        scenario_id: Optional[str] = None,
        state: Optional[RunState] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List runs with filtering"""
        runs = list(self.runs.values())
        
        # Filter by scenario
        if scenario_id:
            runs = [r for r in runs if r.scenario_id == scenario_id]
        
        # Filter by state
        if state:
            runs = [r for r in runs if r.state == state]
        
        # Sort by created_at descending
        runs.sort(key=lambda x: x.created_at, reverse=True)
        
        # Paginate
        runs = runs[offset:offset + limit]
        
        return [self._run_to_dict(r) for r in runs]
    
    def get_run_history(
        self,
        scenario_id: str,
        days: int = 30
    ) -> List[Dict[str, Any]]:
        """Get run history for trend analysis"""
        cutoff = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        cutoff = cutoff.replace(day=cutoff.day - days) if days < cutoff.day else cutoff.replace(month=cutoff.month - 1, day=1)
        
        runs = [
            r for r in self.runs.values()
            if r.scenario_id == scenario_id 
            and r.state == RunState.FINISHED
            and r.created_at >= cutoff
        ]
        
        runs.sort(key=lambda x: x.created_at)
        
        return [
            {
                "run_id": r.run_id,
                "created_at": r.created_at.isoformat(),
                "duration": r.duration_seconds,
                "virtual_users": r.virtual_users,
                "verdict": r.verdict,
                "metrics": {
                    "p95": r.metrics.get("response_time", {}).get("p95", 0),
                    "error_rate": r.metrics.get("iterations", {}).get("error_rate", 0),
                    "throughput": r.metrics.get("throughput", {}).get("rps", 0)
                }
            }
            for r in runs
        ]
    
    def compare_runs(self, run_ids: List[str]) -> Dict[str, Any]:
        """Compare multiple runs"""
        runs = [self.get_run(rid) for rid in run_ids if self.get_run(rid)]
        
        if len(runs) < 2:
            return {"error": "Need at least 2 runs to compare"}
        
        comparison = {
            "runs": [],
            "metrics_comparison": {}
        }
        
        for run in runs:
            comparison["runs"].append({
                "run_id": run.run_id,
                "created_at": run.created_at.isoformat(),
                "verdict": run.verdict,
                "virtual_users": run.virtual_users
            })
        
        # Compare key metrics
        metrics_to_compare = ["response_time.p95", "response_time.p99", 
                             "iterations.error_rate", "throughput.rps"]
        
        for metric in metrics_to_compare:
            values = [self._get_metric_value(r.metrics, metric) for r in runs]
            comparison["metrics_comparison"][metric] = {
                "values": values,
                "min": min(values) if values else 0,
                "max": max(values) if values else 0,
                "avg": sum(values) / len(values) if values else 0,
                "best_run": run_ids[values.index(min(values))] if "error" in metric or "time" in metric 
                           else run_ids[values.index(max(values))]
            }
        
        return comparison


# Global instance
run_manager = RunManager()

