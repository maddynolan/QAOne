"""
Run Matrix Service - Routing and Configuration System
Manages test routing based on tags, paths, and environments.
Reads from .qa/run-matrix.yaml (or equivalent configuration).
"""

import yaml
import os
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import logging

logger = logging.getLogger(__name__)


@dataclass
class ExecutorConfig:
    """Configuration for a test executor"""
    name: str
    image: str
    version: str = "latest"
    env_vars: Dict[str, str] = None
    resources: Dict[str, Any] = None

    def __post_init__(self):
        if self.env_vars is None:
            self.env_vars = {}
        if self.resources is None:
            self.resources = {}


@dataclass
class EnvironmentConfig:
    """Configuration for a target environment"""
    name: str
    base_url: str
    credentials: Dict[str, str] = None
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.credentials is None:
            self.credentials = {}
        if self.metadata is None:
            self.metadata = {}


@dataclass
class RoutingRule:
    """A rule for routing tests to executors"""
    when: Dict[str, Any]  # Conditions: tags, paths, etc.
    use: Dict[str, Any]  # Actions: executor, environment, etc.
    priority: int = 0  # Higher priority rules are checked first


@dataclass
class ScheduleConfig:
    """Cron-like scheduling configuration"""
    cron: str
    tags: List[str] = None
    executor: str = None
    environment: str = None

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


@dataclass
class RunMatrix:
    """Complete run matrix configuration"""
    executors: Dict[str, ExecutorConfig]
    environments: Dict[str, EnvironmentConfig]
    routing: List[RoutingRule]
    default_route: Dict[str, Any]
    schedules: List[ScheduleConfig] = None

    def __post_init__(self):
        if self.schedules is None:
            self.schedules = []


class RunMatrixService:
    """
    Service for managing test routing and execution configuration.
    Reads from YAML configuration files.
    """

    DEFAULT_CONFIG = {
        "executors": {
            "ui": {
                "image": "playwright:latest",
                "browsers": ["chrome-latest", "firefox-latest"]
            },
            "api": {
                "image": "pytest:latest"
            },
            "perf": {
                "image": "k6:latest"
            },
            "ally": {
                "image": "axe-core:latest"
            },
            "sec": {
                "image": "zap:latest"
            }
        },
        "environments": {
            "dev": {
                "base_url": "http://localhost:3000"
            },
            "staging": {
                "base_url": "https://staging.example.com"
            },
            "preprod": {
                "base_url": "https://preprod.example.com"
            }
        },
        "routing": [
            {
                "when": {"tags": ["ui"]},
                "use": {"executor": "ui"}
            },
            {
                "when": {"tags": ["api"]},
                "use": {"executor": "api"}
            },
            {
                "when": {"path": "sec/critical/**"},
                "use": {"executor": "sec"}
            },
            {
                "when": {"tags": ["demo-staging"]},
                "use": {"executor": "ui", "env": "staging"}
            }
        ],
        "default": {
            "executor": "ui",
            "env": "dev"
        },
        "schedules": [
            {
                "cron": "0 * * * *",  # Every hour
                "tags": ["hourly"]
            }
        ]
    }

    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or ".qa/run-matrix.yaml"
        self.config: Optional[RunMatrix] = None
        self._load_config()

    def _load_config(self):
        """Load configuration from file or use default"""
        config_path = Path(self.config_path)
        
        if config_path.exists():
            try:
                with open(config_path, 'r') as f:
                    config_data = yaml.safe_load(f)
                self.config = self._parse_config(config_data)
                logger.info(f"Loaded run matrix from {config_path}")
            except Exception as e:
                logger.warning(f"Failed to load config from {config_path}: {e}. Using defaults.")
                self.config = self._parse_config(self.DEFAULT_CONFIG)
        else:
            logger.info(f"Config file not found at {config_path}. Using defaults.")
            self.config = self._parse_config(self.DEFAULT_CONFIG)

    def _parse_config(self, config_data: Dict[str, Any]) -> RunMatrix:
        """Parse configuration dictionary into RunMatrix object"""
        # Parse executors
        executors = {}
        for name, config in config_data.get("executors", {}).items():
            executors[name] = ExecutorConfig(
                name=name,
                image=config.get("image", f"{name}:latest"),
                version=config.get("version", "latest"),
                env_vars=config.get("env_vars", {}),
                resources=config.get("resources", {})
            )

        # Parse environments
        environments = {}
        for name, config in config_data.get("environments", {}).items():
            environments[name] = EnvironmentConfig(
                name=name,
                base_url=config.get("base_url", ""),
                credentials=config.get("credentials", {}),
                metadata=config.get("metadata", {})
            )

        # Parse routing rules
        routing = []
        for rule_data in config_data.get("routing", []):
            routing.append(RoutingRule(
                when=rule_data.get("when", {}),
                use=rule_data.get("use", {}),
                priority=rule_data.get("priority", 0)
            ))
        # Sort by priority (higher first)
        routing.sort(key=lambda r: r.priority, reverse=True)

        # Parse schedules
        schedules = []
        for schedule_data in config_data.get("schedules", []):
            schedules.append(ScheduleConfig(
                cron=schedule_data.get("cron", ""),
                tags=schedule_data.get("tags", []),
                executor=schedule_data.get("executor"),
                environment=schedule_data.get("environment")
            ))

        return RunMatrix(
            executors=executors,
            environments=environments,
            routing=routing,
            default_route=config_data.get("default", {"executor": "ui", "env": "dev"}),
            schedules=schedules
        )

    def route_test(
        self,
        test_case: Dict[str, Any],
        test_path: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Route a test case to the appropriate executor and environment.
        
        Args:
            test_case: Test case with tags, priority, etc.
            test_path: Optional file path of the test
            
        Returns:
            Dict with executor, environment, and configuration
        """
        if not self.config:
            raise ValueError("Run matrix not initialized")

        tags = test_case.get("tags", [])
        priority = test_case.get("priority", "medium")

        # Check routing rules in priority order
        for rule in self.config.routing:
            if self._matches_rule(rule, tags, test_path, test_case):
                executor_name = rule.use.get("executor", self.config.default_route["executor"])
                env_name = rule.use.get("env", self.config.default_route.get("env", "dev"))
                
                executor = self.config.executors.get(executor_name)
                environment = self.config.environments.get(env_name)
                
                if not executor:
                    logger.warning(f"Executor {executor_name} not found, using default")
                    executor_name = self.config.default_route["executor"]
                    executor = self.config.executors.get(executor_name)

                return {
                    "executor": executor_name,
                    "executor_config": asdict(executor) if executor else {},
                    "environment": env_name,
                    "environment_config": asdict(environment) if environment else {},
                    "matched_rule": asdict(rule)
                }

        # Use default route
        executor_name = self.config.default_route["executor"]
        env_name = self.config.default_route.get("env", "dev")
        executor = self.config.executors.get(executor_name)
        environment = self.config.environments.get(env_name)

        return {
            "executor": executor_name,
            "executor_config": asdict(executor) if executor else {},
            "environment": env_name,
            "environment_config": asdict(environment) if environment else {},
            "matched_rule": None
        }

    def _matches_rule(
        self,
        rule: RoutingRule,
        tags: List[str],
        test_path: Optional[str],
        test_case: Dict[str, Any]
    ) -> bool:
        """Check if a test matches a routing rule"""
        conditions = rule.when

        # Check tag conditions
        if "tags" in conditions:
            required_tags = conditions["tags"]
            if not any(tag in tags for tag in required_tags):
                return False

        # Check path conditions
        if "path" in conditions:
            pattern = conditions["path"]
            if not test_path:
                return False
            # Simple glob matching (can be enhanced)
            if not self._matches_path_pattern(test_path, pattern):
                return False

        # Check priority conditions
        if "priority" in conditions:
            if test_case.get("priority") != conditions["priority"]:
                return False

        return True

    def _matches_path_pattern(self, path: str, pattern: str) -> bool:
        """Simple glob pattern matching"""
        import fnmatch
        return fnmatch.fnmatch(path, pattern)

    def get_executor_config(self, executor_name: str) -> Optional[ExecutorConfig]:
        """Get executor configuration by name"""
        if not self.config:
            return None
        return self.config.executors.get(executor_name)

    def get_environment_config(self, env_name: str) -> Optional[EnvironmentConfig]:
        """Get environment configuration by name"""
        if not self.config:
            return None
        return self.config.environments.get(env_name)

    def get_schedules(self) -> List[ScheduleConfig]:
        """Get all scheduled test runs"""
        if not self.config:
            return []
        return self.config.schedules


# Global instance
run_matrix_service = RunMatrixService()

