"""
Scenario Compiler - Converts HAR, recordings, and manual steps to CompiledScenario JSON

This is the bridge between the UI/recording and the Go runner.
"""

import json
import logging
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict

logger = logging.getLogger(__name__)


@dataclass
class Extractor:
    """Value extractor definition"""
    name: str
    from_: str  # "json", "header", "cookie", "regex", "body", "status"
    path: Optional[str] = None
    key: Optional[str] = None
    regex: Optional[str] = None
    default: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "from": self.from_,
            "path": self.path,
            "key": self.key,
            "regex": self.regex,
            "default": self.default
        }


@dataclass
class Assertion:
    """Test assertion definition"""
    type: str  # "status", "body_contains", "json_path", "header", "response_time"
    expected: Any
    path: Optional[str] = None
    key: Optional[str] = None
    operator: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Step:
    """Test step definition"""
    id: str
    name: str
    type: str  # "http", "think", "loop", "condition"
    
    # HTTP fields
    method: Optional[str] = None
    url: Optional[str] = None
    headers: Optional[Dict[str, str]] = None
    body: Optional[Any] = None
    form_data: Optional[Dict[str, str]] = None
    
    # Correlation
    extract: List[Extractor] = field(default_factory=list)
    
    # Assertions
    assertions: List[Assertion] = field(default_factory=list)
    
    # Think time
    think_time_ms: Optional[int] = None
    
    # Loop
    loop_count: Optional[int] = None
    loop_steps: List["Step"] = field(default_factory=list)
    
    # Condition
    condition: Optional[str] = None
    then_steps: List["Step"] = field(default_factory=list)
    else_steps: List["Step"] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        result = {
            "id": self.id,
            "name": self.name,
            "type": self.type
        }
        
        if self.method:
            result["method"] = self.method
        if self.url:
            result["url"] = self.url
        if self.headers:
            result["headers"] = self.headers
        if self.body:
            result["body"] = self.body
        if self.form_data:
            result["form_data"] = self.form_data
        if self.extract:
            result["extract"] = [e.to_dict() for e in self.extract]
        if self.assertions:
            result["assertions"] = [a.to_dict() for a in self.assertions]
        if self.think_time_ms:
            result["think_time_ms"] = self.think_time_ms
        if self.loop_count:
            result["loop_count"] = self.loop_count
        if self.loop_steps:
            result["loop_steps"] = [s.to_dict() for s in self.loop_steps]
        if self.condition:
            result["condition"] = self.condition
        if self.then_steps:
            result["then_steps"] = [s.to_dict() for s in self.then_steps]
        if self.else_steps:
            result["else_steps"] = [s.to_dict() for s in self.else_steps]
        
        return result


@dataclass
class Threshold:
    """Pass/fail threshold"""
    metric: str  # e.g., "http_req_duration_p95"
    op: str  # "<", ">", "<=", ">=", "=="
    value: float
    critical: bool = True
    name: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class DataPool:
    """Data parameterization source"""
    id: str
    name: str
    file: Optional[str] = None
    mode: str = "sequential"  # "sequential", "random", "unique", "shared"
    columns: List[str] = field(default_factory=list)
    inline_data: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class Config:
    """Load test configuration. Supports stages (ramp/spike/step/soak) and think-time distribution."""
    virtual_users: int = 10
    duration_seconds: int = 60
    ramp_up_seconds: int = 10
    ramp_down_seconds: int = 10
    target_url: str = ""
    enable_http2: bool = True
    connection_timeout_ms: int = 10000
    request_timeout_ms: int = 30000
    think_time_min_ms: int = 1000
    think_time_max_ms: int = 3000
    # Workload modeling: stages = [[duration_seconds, target_vus], ...] e.g. [[30, 10], [60, 50], [30, 0]]
    stages: List[List[int]] = field(default_factory=list)
    # Optional: arrival rate (requests/sec) as alternative to VU count
    arrival_rate: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        out = {
            "virtual_users": self.virtual_users,
            "duration_seconds": self.duration_seconds,
            "ramp_up_seconds": self.ramp_up_seconds,
            "ramp_down_seconds": self.ramp_down_seconds,
            "target_url": self.target_url,
            "enable_http2": self.enable_http2,
            "connection_timeout_ms": self.connection_timeout_ms,
            "request_timeout_ms": self.request_timeout_ms,
            "think_time_min_ms": self.think_time_min_ms,
            "think_time_max_ms": self.think_time_max_ms
        }
        if self.stages:
            out["stages"] = self.stages
        if self.arrival_rate is not None:
            out["arrival_rate"] = self.arrival_rate
        return out


@dataclass
class CompiledScenario:
    """Universal scenario format for Go runner"""
    scenario_id: str
    name: str
    source: str  # "har", "recorder", "builder", "manual"
    version: str = "1.0"
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    
    config: Config = field(default_factory=Config)
    thresholds: List[Threshold] = field(default_factory=list)
    variables: Dict[str, Any] = field(default_factory=dict)
    data_pools: List[DataPool] = field(default_factory=list)
    steps: List[Step] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "scenario_id": self.scenario_id,
            "name": self.name,
            "source": self.source,
            "version": self.version,
            "created_at": self.created_at,
            "config": self.config.to_dict(),
            "thresholds": [t.to_dict() for t in self.thresholds],
            "variables": self.variables,
            "data_pools": [d.to_dict() for d in self.data_pools],
            "steps": [s.to_dict() for s in self.steps]
        }
    
    def to_json(self, indent: int = 2) -> str:
        return json.dumps(self.to_dict(), indent=indent)
    
    def to_bytes(self) -> bytes:
        return self.to_json().encode('utf-8')


class ScenarioCompiler:
    """
    Compiles various input formats into CompiledScenario for the Go runner.
    
    Supported sources:
    - HAR files (HTTP Archive)
    - Recorded browser sessions
    - Builder steps
    - Manual API definitions
    """
    
    def __init__(self):
        self.default_thresholds = [
            Threshold(metric="http_req_duration_p95", op="<", value=800, name="P95 Response Time"),
            Threshold(metric="http_req_duration_p99", op="<", value=2000, name="P99 Response Time"),
            Threshold(metric="error_rate", op="<", value=0.01, critical=True, name="Error Rate"),
        ]
    
    def compile_from_har(self, har_content: str, name: str = "HAR Import", 
                         config: Optional[Config] = None) -> CompiledScenario:
        """Compile a HAR file into a scenario"""
        try:
            har_data = json.loads(har_content)
        except json.JSONDecodeError as e:
            raise ValueError(f"Invalid HAR JSON: {e}")
        
        scenario = CompiledScenario(
            scenario_id=str(uuid.uuid4()),
            name=name,
            source="har",
            config=config or Config()
        )
        
        # Extract entries
        entries = har_data.get("log", {}).get("entries", [])
        
        for i, entry in enumerate(entries):
            request = entry.get("request", {})
            method = request.get("method", "GET")
            url = request.get("url", "")
            
            # Skip non-HTTP requests
            if not url.startswith(("http://", "https://")):
                continue
            
            # Extract headers
            headers = {}
            for header in request.get("headers", []):
                name_lower = header.get("name", "").lower()
                # Skip browser-specific headers
                if name_lower not in ["host", "connection", "user-agent", "accept-encoding", 
                                      "accept-language", "sec-ch-ua", "sec-ch-ua-mobile",
                                      "sec-ch-ua-platform", "sec-fetch-dest", "sec-fetch-mode",
                                      "sec-fetch-site", "cache-control", "pragma"]:
                    headers[header.get("name")] = header.get("value")
            
            # Extract body
            body = None
            post_data = request.get("postData", {})
            if post_data:
                body = post_data.get("text", "")
                if not body:
                    params = post_data.get("params", [])
                    if params:
                        body = "&".join(f"{p.get('name')}={p.get('value')}" for p in params)
            
            # Create step
            step = Step(
                id=f"step_{i+1}",
                name=f"{method} {self._extract_path(url)}",
                type="http",
                method=method,
                url=url,
                headers=headers if headers else None,
                body=body if body else None
            )
            
            # Add auto-extraction for common patterns
            step.extract = self._generate_extractors(url)
            
            scenario.steps.append(step)
            
            # Add think time between steps (simulates user behavior)
            if i < len(entries) - 1:
                scenario.steps.append(Step(
                    id=f"think_{i+1}",
                    name="Think Time",
                    type="think",
                    think_time_ms=1000
                ))
        
        # Add default thresholds
        scenario.thresholds = self.default_thresholds.copy()
        
        # Infer target URL from first request
        if scenario.steps:
            first_url = scenario.steps[0].url
            if first_url:
                from urllib.parse import urlparse
                parsed = urlparse(first_url)
                scenario.config.target_url = f"{parsed.scheme}://{parsed.netloc}"
        
        logger.info(f"Compiled HAR to scenario: {len(scenario.steps)} steps")
        return scenario
    
    def compile_from_recording(self, recorded_steps: List[Dict], 
                               network_requests: List[Dict],
                               name: str = "Recorded Session",
                               config: Optional[Config] = None) -> CompiledScenario:
        """Compile recorded browser session into a scenario"""
        scenario = CompiledScenario(
            scenario_id=str(uuid.uuid4()),
            name=name,
            source="recorder",
            config=config or Config()
        )
        
        # Process network requests for performance testing
        for i, req in enumerate(network_requests):
            method = req.get("method", "GET")
            url = req.get("url", "")
            
            if not url or not url.startswith(("http://", "https://")):
                continue
            
            step = Step(
                id=f"step_{i+1}",
                name=f"{method} {self._extract_path(url)}",
                type="http",
                method=method,
                url=url,
                headers=req.get("headers"),
                body=req.get("body")
            )
            
            step.extract = self._generate_extractors(url)
            scenario.steps.append(step)
            
            # Add think time
            if i < len(network_requests) - 1:
                scenario.steps.append(Step(
                    id=f"think_{i+1}",
                    name="Think Time",
                    type="think",
                    think_time_ms=1000
                ))
        
        scenario.thresholds = self.default_thresholds.copy()
        
        logger.info(f"Compiled recording to scenario: {len(scenario.steps)} steps")
        return scenario
    
    def compile_from_builder(self, builder_steps: List[Dict],
                             name: str = "Builder Scenario",
                             config: Optional[Config] = None) -> CompiledScenario:
        """Compile builder steps into a scenario"""
        scenario = CompiledScenario(
            scenario_id=str(uuid.uuid4()),
            name=name,
            source="builder",
            config=config or Config()
        )
        
        for i, step_data in enumerate(builder_steps):
            step_type = step_data.get("type", "http")
            
            if step_type == "http" or step_data.get("method"):
                step = Step(
                    id=f"step_{i+1}",
                    name=step_data.get("name", f"Step {i+1}"),
                    type="http",
                    method=step_data.get("method", "GET"),
                    url=step_data.get("url", ""),
                    headers=step_data.get("headers"),
                    body=step_data.get("body"),
                    form_data=step_data.get("form_data")
                )
                
                # Add extractors
                if step_data.get("extract"):
                    for ext in step_data["extract"]:
                        step.extract.append(Extractor(
                            name=ext.get("name"),
                            from_=ext.get("from", "json"),
                            path=ext.get("path"),
                            key=ext.get("key"),
                            regex=ext.get("regex"),
                            default=ext.get("default")
                        ))
                
                # Add assertions
                if step_data.get("assertions"):
                    for asrt in step_data["assertions"]:
                        step.assertions.append(Assertion(
                            type=asrt.get("type", "status"),
                            expected=asrt.get("expected"),
                            path=asrt.get("path"),
                            key=asrt.get("key"),
                            operator=asrt.get("operator")
                        ))
                
            elif step_type == "think":
                step = Step(
                    id=f"step_{i+1}",
                    name="Think Time",
                    type="think",
                    think_time_ms=step_data.get("think_time_ms", 1000)
                )
                
            else:
                continue
            
            scenario.steps.append(step)
        
        scenario.thresholds = self.default_thresholds.copy()
        
        logger.info(f"Compiled builder to scenario: {len(scenario.steps)} steps")
        return scenario
    
    def compile_from_api_requests(self, requests: List[Dict],
                                  name: str = "API Test",
                                  config: Optional[Config] = None) -> CompiledScenario:
        """Compile API requests (from API tab) into a scenario"""
        scenario = CompiledScenario(
            scenario_id=str(uuid.uuid4()),
            name=name,
            source="manual",
            config=config or Config()
        )
        
        for i, req in enumerate(requests):
            step = Step(
                id=req.get("id", f"step_{i+1}"),
                name=req.get("name", f"{req.get('method', 'GET')} {self._extract_path(req.get('url', ''))}"),
                type="http",
                method=req.get("method", "GET"),
                url=req.get("url", ""),
                headers=req.get("headers"),
                body=req.get("body")
            )
            
            step.extract = self._generate_extractors(req.get("url", ""))
            scenario.steps.append(step)
        
        scenario.thresholds = self.default_thresholds.copy()
        
        logger.info(f"Compiled API requests to scenario: {len(scenario.steps)} steps")
        return scenario
    
    def add_data_pool(self, scenario: CompiledScenario, 
                      name: str, data: List[Dict],
                      mode: str = "sequential") -> DataPool:
        """Add a data pool for parameterization"""
        if not data:
            raise ValueError("Data pool cannot be empty")
        
        columns = list(data[0].keys())
        
        pool = DataPool(
            id=str(uuid.uuid4()),
            name=name,
            mode=mode,
            columns=columns,
            inline_data=data
        )
        
        scenario.data_pools.append(pool)
        return pool
    
    def add_threshold(self, scenario: CompiledScenario,
                      metric: str, operator: str, value: float,
                      critical: bool = True, name: str = None) -> Threshold:
        """Add a custom threshold"""
        threshold = Threshold(
            metric=metric,
            op=operator,
            value=value,
            critical=critical,
            name=name or f"{metric} {operator} {value}"
        )
        scenario.thresholds.append(threshold)
        return threshold
    
    def _extract_path(self, url: str) -> str:
        """Extract path from URL for step naming"""
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path = parsed.path or "/"
        # Truncate long paths
        if len(path) > 50:
            path = path[:47] + "..."
        return path
    
    def _generate_extractors(self, url: str) -> List[Extractor]:
        """Generate auto-extractors based on URL patterns"""
        extractors = []
        
        # Common API patterns
        if "/api/" in url or "/v1/" in url or "/v2/" in url:
            # Auto-extract common tokens
            extractors.append(Extractor(
                name="auto_token",
                from_="json",
                path="$.token",
                default=""
            ))
            extractors.append(Extractor(
                name="auto_id",
                from_="json",
                path="$.id",
                default=""
            ))
        
        return extractors


# Singleton instance
_compiler_instance = None

def get_scenario_compiler() -> ScenarioCompiler:
    """Get singleton compiler instance"""
    global _compiler_instance
    if _compiler_instance is None:
        _compiler_instance = ScenarioCompiler()
    return _compiler_instance

