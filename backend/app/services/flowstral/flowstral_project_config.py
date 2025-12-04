"""
Flowstral Project Configuration Service
Manages project-level Flowstral configuration
"""

import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
import json

logger = logging.getLogger(__name__)


@dataclass
class PipelineConfig:
    """Pipeline configuration"""
    enabled: bool = True
    mode: str = "full"  # full, light, off
    run_on: List[str] = field(default_factory=lambda: ["navigate", "page_load", "submit"])
    max_events_per_page: int = 5


@dataclass
class EventCoalescingConfig:
    """Event coalescing configuration"""
    enabled: bool = True
    window_ms: int = 500
    input_debounce_ms: int = 300
    max_click_count: int = 5


@dataclass
class StorageConfig:
    """Storage configuration"""
    retention_policy: str = "standard"  # full, standard, minimal
    retention_days: int = 90
    deduplication_enabled: bool = True
    compression_algorithm: str = "brotli"  # brotli, gzip, none
    object_storage_provider: str = "s3"  # s3, azure_blob, gcs
    object_storage_bucket: Optional[str] = None


@dataclass
class LLMConfig:
    """LLM configuration"""
    mode: str = "full"  # none, summary_only, full
    provider: str = "openai"
    model: str = "gpt-4"


@dataclass
class SelectorConfig:
    """Selector configuration"""
    validation_enabled: bool = True
    registry_enabled: bool = True
    cross_session_learning: bool = True


@dataclass
class SecurityConfig:
    """Security configuration"""
    pii_masking_enabled: bool = True
    pii_patterns: List[str] = field(default_factory=lambda: [
        "email", "phone", "ssn", "credit_card", "password"
    ])
    network_redaction_enabled: bool = True
    strip_headers: List[str] = field(default_factory=lambda: [
        "Authorization", "Cookie", "X-Auth-Token"
    ])
    sensitive_domains: List[str] = field(default_factory=list)


@dataclass
class ProjectConfig:
    """Complete project configuration"""
    project_id: str
    tenant_id: Optional[str] = None
    
    # Pipeline configurations
    pipelines: Dict[str, PipelineConfig] = field(default_factory=lambda: {
        "dom": PipelineConfig(enabled=True),
        "wcag": PipelineConfig(enabled=False, mode="off"),  # Disabled by default - use standalone tool
        "performance": PipelineConfig(enabled=False, mode="off"),  # Disabled by default - use standalone tool
        "defects": PipelineConfig(enabled=True)
    })
    
    # Event coalescing
    event_coalescing: EventCoalescingConfig = field(default_factory=EventCoalescingConfig)
    
    # Storage
    storage: StorageConfig = field(default_factory=StorageConfig)
    
    # LLM
    llm: LLMConfig = field(default_factory=LLMConfig)
    
    # Selectors
    selectors: SelectorConfig = field(default_factory=SelectorConfig)
    
    # Security
    security: SecurityConfig = field(default_factory=SecurityConfig)
    
    # Metadata
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "project_id": self.project_id,
            "tenant_id": self.tenant_id,
            "pipelines": {
                name: {
                    "enabled": config.enabled,
                    "mode": config.mode,
                    "run_on": config.run_on,
                    "max_events_per_page": config.max_events_per_page
                }
                for name, config in self.pipelines.items()
            },
            "event_coalescing": asdict(self.event_coalescing),
            "storage": asdict(self.storage),
            "llm": asdict(self.llm),
            "selectors": asdict(self.selectors),
            "security": asdict(self.security),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ProjectConfig':
        """Create from dictionary"""
        config = cls(
            project_id=data["project_id"],
            tenant_id=data.get("tenant_id"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )
        
        # Pipelines
        if "pipelines" in data:
            config.pipelines = {
                name: PipelineConfig(
                    enabled=p.get("enabled", True),
                    mode=p.get("mode", "full"),
                    run_on=p.get("run_on", ["navigate", "page_load", "submit"]),
                    max_events_per_page=p.get("max_events_per_page", 5)
                )
                for name, p in data["pipelines"].items()
            }
        
        # Event coalescing
        if "event_coalescing" in data:
            ec = data["event_coalescing"]
            config.event_coalescing = EventCoalescingConfig(
                enabled=ec.get("enabled", True),
                window_ms=ec.get("window_ms", 500),
                input_debounce_ms=ec.get("input_debounce_ms", 300),
                max_click_count=ec.get("max_click_count", 5)
            )
        
        # Storage
        if "storage" in data:
            s = data["storage"]
            config.storage = StorageConfig(
                retention_policy=s.get("retention_policy", "standard"),
                retention_days=s.get("retention_days", 90),
                deduplication_enabled=s.get("deduplication_enabled", True),
                compression_algorithm=s.get("compression_algorithm", "brotli"),
                object_storage_provider=s.get("object_storage_provider", "s3"),
                object_storage_bucket=s.get("object_storage_bucket")
            )
        
        # LLM
        if "llm" in data:
            llm = data["llm"]
            config.llm = LLMConfig(
                mode=llm.get("mode", "full"),
                provider=llm.get("provider", "openai"),
                model=llm.get("model", "gpt-4")
            )
        
        # Selectors
        if "selectors" in data:
            sel = data["selectors"]
            config.selectors = SelectorConfig(
                validation_enabled=sel.get("validation_enabled", True),
                registry_enabled=sel.get("registry_enabled", True),
                cross_session_learning=sel.get("cross_session_learning", True)
            )
        
        # Security
        if "security" in data:
            sec = data["security"]
            config.security = SecurityConfig(
                pii_masking_enabled=sec.get("pii_masking_enabled", True),
                pii_patterns=sec.get("pii_patterns", ["email", "phone", "ssn", "credit_card", "password"]),
                network_redaction_enabled=sec.get("network_redaction_enabled", True),
                strip_headers=sec.get("strip_headers", ["Authorization", "Cookie", "X-Auth-Token"]),
                sensitive_domains=sec.get("sensitive_domains", [])
            )
        
        return config


class ProjectConfigService:
    """
    Manages project-level Flowstral configuration
    """
    
    def __init__(self, db_service=None):
        self.db_service = db_service
        self.cache: Dict[str, ProjectConfig] = {}
    
    async def get_config(self, project_id: str) -> ProjectConfig:
        """Get project configuration with caching"""
        # Check cache first
        if project_id in self.cache:
            return self.cache[project_id]
        
        # Load from database
        if self.db_service:
            config_data = await self._load_from_db(project_id)
            if config_data:
                config = ProjectConfig.from_dict(config_data)
                self.cache[project_id] = config
                return config
        
        # Create default configuration
        config = self._create_default_config(project_id)
        self.cache[project_id] = config
        
        # Save to database
        if self.db_service:
            await self._save_to_db(config)
        
        return config
    
    async def update_config(
        self,
        project_id: str,
        updates: Dict[str, Any]
    ) -> ProjectConfig:
        """Update project configuration"""
        config = await self.get_config(project_id)
        
        # Validate updates
        self._validate_updates(updates)
        
        # Apply updates
        if "pipelines" in updates:
            for name, pipeline_updates in updates["pipelines"].items():
                if name in config.pipelines:
                    pipeline = config.pipelines[name]
                    if "enabled" in pipeline_updates:
                        pipeline.enabled = pipeline_updates["enabled"]
                    if "mode" in pipeline_updates:
                        pipeline.mode = pipeline_updates["mode"]
                    if "run_on" in pipeline_updates:
                        pipeline.run_on = pipeline_updates["run_on"]
                    if "max_events_per_page" in pipeline_updates:
                        pipeline.max_events_per_page = pipeline_updates["max_events_per_page"]
        
        if "event_coalescing" in updates:
            ec_updates = updates["event_coalescing"]
            if "enabled" in ec_updates:
                config.event_coalescing.enabled = ec_updates["enabled"]
            if "window_ms" in ec_updates:
                config.event_coalescing.window_ms = ec_updates["window_ms"]
            if "input_debounce_ms" in ec_updates:
                config.event_coalescing.input_debounce_ms = ec_updates["input_debounce_ms"]
        
        if "storage" in updates:
            s_updates = updates["storage"]
            for key, value in s_updates.items():
                if hasattr(config.storage, key):
                    setattr(config.storage, key, value)
        
        if "llm" in updates:
            llm_updates = updates["llm"]
            for key, value in llm_updates.items():
                if hasattr(config.llm, key):
                    setattr(config.llm, key, value)
        
        if "selectors" in updates:
            sel_updates = updates["selectors"]
            for key, value in sel_updates.items():
                if hasattr(config.selectors, key):
                    setattr(config.selectors, key, value)
        
        if "security" in updates:
            sec_updates = updates["security"]
            for key, value in sec_updates.items():
                if hasattr(config.security, key):
                    setattr(config.security, key, value)
        
        # Update timestamp
        config.updated_at = datetime.utcnow()
        
        # Save to database
        if self.db_service:
            await self._save_to_db(config)
        
        # Update cache
        self.cache[project_id] = config
        
        return config
    
    def _create_default_config(self, project_id: str) -> ProjectConfig:
        """Create default configuration"""
        return ProjectConfig(project_id=project_id, created_at=datetime.utcnow())
    
    def _validate_updates(self, updates: Dict[str, Any]):
        """Validate configuration updates"""
        # Validate pipeline modes
        if "pipelines" in updates:
            valid_modes = ["full", "light", "off"]
            for name, pipeline_updates in updates["pipelines"].items():
                if "mode" in pipeline_updates:
                    if pipeline_updates["mode"] not in valid_modes:
                        raise ValueError(f"Invalid pipeline mode: {pipeline_updates['mode']}")
        
        # Validate LLM mode
        if "llm" in updates and "mode" in updates["llm"]:
            valid_modes = ["none", "summary_only", "full"]
            if updates["llm"]["mode"] not in valid_modes:
                raise ValueError(f"Invalid LLM mode: {updates['llm']['mode']}")
        
        # Validate retention policy
        if "storage" in updates and "retention_policy" in updates["storage"]:
            valid_policies = ["full", "standard", "minimal"]
            if updates["storage"]["retention_policy"] not in valid_policies:
                raise ValueError(f"Invalid retention policy: {updates['storage']['retention_policy']}")
    
    async def _load_from_db(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Load configuration from database"""
        if not self.db_service:
            return None
        
        try:
            from app.services.storage.postgres_direct import execute_query
            
            query = """
                SELECT config_data, 
                       pipelines_enabled, wcag_mode, wcag_run_on, performance_mode, performance_max_events_per_page,
                       coalescing_enabled, coalescing_window_ms, input_debounce_ms, max_click_count,
                       retention_policy, retention_days, deduplication_enabled, compression_algorithm,
                       llm_mode, llm_provider, llm_model,
                       selector_validation_enabled, selector_registry_enabled, cross_session_learning,
                       pii_masking_enabled, network_redaction_enabled, sensitive_domains, strip_headers,
                       tenant_id, created_at, updated_at
                FROM flowstral_projects
                WHERE project_id = %s
            """
            result = await execute_query(query, (project_id,))
            if result and len(result) > 0:
                row = result[0]
                # Build config dict from row
                config_dict = {
                    "project_id": project_id,
                    "tenant_id": row.get("tenant_id"),
                    "created_at": row.get("created_at").isoformat() if row.get("created_at") else None,
                    "updated_at": row.get("updated_at").isoformat() if row.get("updated_at") else None
                }
                
                # Use config_data if available, otherwise build from columns
                if row.get("config_data"):
                    import json
                    if isinstance(row["config_data"], str):
                        config_dict.update(json.loads(row["config_data"]))
                    else:
                        config_dict.update(row["config_data"])
                else:
                    # Build from individual columns
                    config_dict.update({
                        "pipelines": {
                            "dom": {"enabled": True},
                            "wcag": {
                                "enabled": True,
                                "mode": row.get("wcag_mode", "full"),
                                "run_on": row.get("wcag_run_on", ["navigate", "page_load", "submit"])
                            },
                            "performance": {
                                "enabled": True,
                                "mode": row.get("performance_mode", "full"),
                                "max_events_per_page": row.get("performance_max_events_per_page", 5)
                            },
                            "defects": {"enabled": True}
                        },
                        "event_coalescing": {
                            "enabled": row.get("coalescing_enabled", True),
                            "window_ms": row.get("coalescing_window_ms", 500),
                            "input_debounce_ms": row.get("input_debounce_ms", 300),
                            "max_click_count": row.get("max_click_count", 5)
                        },
                        "storage": {
                            "retention_policy": row.get("retention_policy", "standard"),
                            "retention_days": row.get("retention_days", 90),
                            "deduplication_enabled": row.get("deduplication_enabled", True),
                            "compression_algorithm": row.get("compression_algorithm", "brotli")
                        },
                        "llm": {
                            "mode": row.get("llm_mode", "full"),
                            "provider": row.get("llm_provider", "openai"),
                            "model": row.get("llm_model", "gpt-4")
                        },
                        "selectors": {
                            "validation_enabled": row.get("selector_validation_enabled", True),
                            "registry_enabled": row.get("selector_registry_enabled", True),
                            "cross_session_learning": row.get("cross_session_learning", True)
                        },
                        "security": {
                            "pii_masking_enabled": row.get("pii_masking_enabled", True),
                            "network_redaction_enabled": row.get("network_redaction_enabled", True),
                            "sensitive_domains": row.get("sensitive_domains", []),
                            "strip_headers": row.get("strip_headers", ["Authorization", "Cookie", "X-Auth-Token"])
                        }
                    })
                
                return config_dict
        except Exception as e:
            logger.warning(f"Failed to load config from DB: {e}", exc_info=True)
        
        return None
    
    async def _save_to_db(self, config: ProjectConfig):
        """Save configuration to database"""
        if not self.db_service:
            return
        
        try:
            from app.services.storage.postgres_direct import execute_query, execute_insert
            
            config_dict = config.to_dict()
            config_json = json.dumps(config_dict)
            
            # Check if exists
            check_query = "SELECT id FROM flowstral_projects WHERE project_id = %s"
            existing = await execute_query(check_query, (config.project_id,))
            
            if existing and len(existing) > 0:
                # Update
                update_query = """
                    UPDATE flowstral_projects
                    SET config_data = %s,
                        tenant_id = %s,
                        pipelines_enabled = %s,
                        wcag_mode = %s,
                        wcag_run_on = %s,
                        performance_mode = %s,
                        performance_max_events_per_page = %s,
                        coalescing_enabled = %s,
                        coalescing_window_ms = %s,
                        input_debounce_ms = %s,
                        max_click_count = %s,
                        retention_policy = %s,
                        retention_days = %s,
                        deduplication_enabled = %s,
                        compression_algorithm = %s,
                        llm_mode = %s,
                        llm_provider = %s,
                        llm_model = %s,
                        selector_validation_enabled = %s,
                        selector_registry_enabled = %s,
                        cross_session_learning = %s,
                        pii_masking_enabled = %s,
                        network_redaction_enabled = %s,
                        sensitive_domains = %s,
                        strip_headers = %s,
                        updated_at = %s
                    WHERE project_id = %s
                """
                await execute_query(
                    update_query,
                    (
                        config_json,
                        config.tenant_id,
                        json.dumps(config.pipelines.get("wcag", {}).get("enabled", True)),
                        config.pipelines.get("wcag", {}).get("mode", "full"),
                        config.pipelines.get("wcag", {}).get("run_on", ["navigate", "page_load", "submit"]),
                        config.pipelines.get("performance", {}).get("mode", "full"),
                        config.pipelines.get("performance", {}).get("max_events_per_page", 5),
                        config.event_coalescing.enabled,
                        config.event_coalescing.window_ms,
                        config.event_coalescing.input_debounce_ms,
                        config.event_coalescing.max_click_count,
                        config.storage.retention_policy,
                        config.storage.retention_days,
                        config.storage.deduplication_enabled,
                        config.storage.compression_algorithm,
                        config.llm.mode,
                        config.llm.provider,
                        config.llm.model,
                        config.selectors.validation_enabled,
                        config.selectors.registry_enabled,
                        config.selectors.cross_session_learning,
                        config.security.pii_masking_enabled,
                        config.security.network_redaction_enabled,
                        config.security.sensitive_domains,
                        config.security.strip_headers,
                        config.updated_at or datetime.utcnow(),
                        config.project_id
                    )
                )
            else:
                # Insert
                await execute_insert("flowstral_projects", {
                    "project_id": config.project_id,
                    "tenant_id": config.tenant_id,
                    "config_data": config_json,
                    "pipelines_enabled": json.dumps({k: v.get("enabled", True) for k, v in config.pipelines.items()}),
                    "wcag_mode": config.pipelines.get("wcag", {}).get("mode", "full"),
                    "wcag_run_on": config.pipelines.get("wcag", {}).get("run_on", ["navigate", "page_load", "submit"]),
                    "performance_mode": config.pipelines.get("performance", {}).get("mode", "full"),
                    "performance_max_events_per_page": config.pipelines.get("performance", {}).get("max_events_per_page", 5),
                    "coalescing_enabled": config.event_coalescing.enabled,
                    "coalescing_window_ms": config.event_coalescing.window_ms,
                    "input_debounce_ms": config.event_coalescing.input_debounce_ms,
                    "max_click_count": config.event_coalescing.max_click_count,
                    "retention_policy": config.storage.retention_policy,
                    "retention_days": config.storage.retention_days,
                    "deduplication_enabled": config.storage.deduplication_enabled,
                    "compression_algorithm": config.storage.compression_algorithm,
                    "llm_mode": config.llm.mode,
                    "llm_provider": config.llm.provider,
                    "llm_model": config.llm.model,
                    "selector_validation_enabled": config.selectors.validation_enabled,
                    "selector_registry_enabled": config.selectors.registry_enabled,
                    "cross_session_learning": config.selectors.cross_session_learning,
                    "pii_masking_enabled": config.security.pii_masking_enabled,
                    "network_redaction_enabled": config.security.network_redaction_enabled,
                    "sensitive_domains": config.security.sensitive_domains,
                    "strip_headers": config.security.strip_headers,
                    "created_at": config.created_at or datetime.utcnow(),
                    "updated_at": config.updated_at or datetime.utcnow()
                })
        except Exception as e:
            logger.error(f"Failed to save config to DB: {e}", exc_info=True)


# Global instance
_project_config_service: Optional[ProjectConfigService] = None


def get_project_config_service(db_service=None) -> ProjectConfigService:
    """Get global project config service instance"""
    global _project_config_service
    if _project_config_service is None:
        _project_config_service = ProjectConfigService(db_service)
    return _project_config_service

