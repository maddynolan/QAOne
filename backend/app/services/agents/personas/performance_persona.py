"""
Blaze - Performance Testing Persona
Ex-Meta Load Testing Architect, 19 years, led performance for Instagram (2B users) and WhatsApp.
"""

import json
import logging
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, ValidationError

from app.services.agents.persona_base import AgentPersona

logger = logging.getLogger(__name__)


class PerformanceThreshold(BaseModel):
    """Performance threshold definition."""
    metric: str  # e.g., "p95_latency", "error_rate", "throughput"
    operator: str  # e.g., "<", ">", "=="
    value: float
    unit: str  # e.g., "ms", "req/s", "%"


class LoadScenario(BaseModel):
    """Individual load scenario."""
    name: str
    user_journey: str
    weight: float  # Percentage of total traffic
    think_time_ms: int
    ramp_up_seconds: int
    duration_seconds: int
    vu_count: int


class ChaosScenario(BaseModel):
    """Chaos engineering scenario."""
    name: str
    type: str  # e.g., "latency_injection", "db_slowdown", "cache_miss"
    parameters: Dict[str, Any]
    duration_seconds: int


class PerformanceTestScript(BaseModel):
    """Complete performance test script."""
    framework: str  # "k6" or "locust"
    script_content: str
    thresholds: List[PerformanceThreshold]
    scenarios: List[LoadScenario]
    chaos_scenarios: List[ChaosScenario] = Field(default_factory=list)
    grafana_dashboard_json: Optional[str] = None
    scaling_strategy: Dict[str, Any] = Field(default_factory=dict)
    connection_pooling: bool = True
    cookie_handling: bool = True


class PerformanceTestSuite(BaseModel):
    """Complete performance test suite."""
    k6_script: PerformanceTestScript
    locust_script: PerformanceTestScript
    grafana_dashboard_json: str
    scaling_strategy: Dict[str, Any]
    duration_justification: str
    vu_scaling_strategy: Dict[str, Any]


class PerformancePersona(AgentPersona[PerformanceTestSuite]):
    """
    Blaze - Performance Testing Persona
    
    Ex-Meta Load Testing Architect, 19 years, led performance for Instagram (2B users) and WhatsApp.
    """
    
    def _get_system_prompt(self) -> str:
        return """You are Blaze — ex-Meta Load Testing Architect, 19 years, led performance for Instagram (2B users) and WhatsApp.

Mission: Generate bulletproof, production-grade performance test scripts that expose real scalability bottlenecks.

Rules you always follow:

1. Never use constant arrival rate — always model real user behavior (think time, ramp-up, realistic journeys).

2. Include every critical user journey with accurate weighting based on production traffic patterns.

3. Add proper thresholds: p95 < 300ms, error rate < 0.1%, throughput matching prod traffic.

4. Include chaos scenarios: latency injection, DB slowdown, cache miss storms.

5. Generate both k6 and Locust versions with identical logic.

6. Add detailed Grafana dashboard JSON for the exact metrics you care about.

7. Include VU scaling strategy and duration justification.

8. Never forget connection pooling, cookie handling, and think time.

9. Model realistic user behavior: session management, authentication flows, data dependencies.

10. Include baseline, stress, spike, and endurance test scenarios.

You are paranoid about false positives and synthetic benchmarks. Your scripts must find the real breaking point.

Output Format (JSON):
{
  "k6_script": {
    "framework": "k6",
    "script_content": "import http from 'k6/http';...",
    "thresholds": [
      {"metric": "p95_latency", "operator": "<", "value": 300, "unit": "ms"},
      {"metric": "error_rate", "operator": "<", "value": 0.1, "unit": "%"}
    ],
    "scenarios": [
      {
        "name": "Login Flow",
        "user_journey": "Navigate -> Login -> Dashboard",
        "weight": 40.0,
        "think_time_ms": 2000,
        "ramp_up_seconds": 60,
        "duration_seconds": 300,
        "vu_count": 100
      }
    ],
    "chaos_scenarios": [
      {
        "name": "Database Latency Injection",
        "type": "latency_injection",
        "parameters": {"latency_ms": 500, "probability": 0.1},
        "duration_seconds": 60
      }
    ],
    "grafana_dashboard_json": "{...}",
    "scaling_strategy": {"min_vus": 10, "max_vus": 1000, "ramp_duration": "5m"},
    "connection_pooling": true,
    "cookie_handling": true
  },
  "locust_script": {
    "framework": "locust",
    "script_content": "from locust import HttpUser, task...",
    ...
  },
  "grafana_dashboard_json": "{...}",
  "scaling_strategy": {...},
  "duration_justification": "5 minute duration to capture steady-state behavior...",
  "vu_scaling_strategy": {...}
}"""
    
    def _get_persona_name(self) -> str:
        return "Blaze"
    
    def _get_expertise_years(self) -> int:
        return 19
    
    def _get_track_record(self) -> str:
        return "Led performance for Instagram (2B users) and WhatsApp"
    
    def get_tools(self) -> List[Dict[str, Any]]:
        """Tools for performance testing."""
        return [
            {
                "name": "simulate_load",
                "description": "Run a quick k6 simulation to validate thresholds",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "script": {"type": "string", "description": "k6 script content"},
                        "duration": {"type": "string", "description": "Test duration"}
                    }
                }
            }
        ]
    
    def parse_response(self, response: str) -> PerformanceTestSuite:
        """Parse LLM response into PerformanceTestSuite."""
        try:
            if "```json" in response:
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            elif "```" in response:
                json_start = response.find("```") + 3
                json_end = response.find("```", json_start)
                response = response[json_start:json_end].strip()
            
            data = json.loads(response)
            return PerformanceTestSuite(**data)
            
        except json.JSONDecodeError as e:
            logger.error(f"[Blaze] Failed to parse JSON response: {e}")
            raise ValueError(f"Invalid JSON response from Blaze persona: {e}")
        except ValidationError as e:
            logger.error(f"[Blaze] Validation error: {e}")
            raise ValueError(f"Invalid response structure from Blaze persona: {e}")

