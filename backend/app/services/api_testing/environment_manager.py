"""
Environment and Configuration Management
Manage test environments, configurations, and variables
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime
from uuid import uuid4
import json
import os

logger = logging.getLogger(__name__)


class EnvironmentManager:
    """
    Environment and configuration manager for API testing
    Supports multiple environments (dev, staging, prod) and variable management
    """
    
    def __init__(self):
        self.environments: Dict[str, Any] = {}
        self.configurations: Dict[str, Any] = {}
    
    def create_environment(
        self,
        environment_config: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a test environment
        
        Args:
            environment_config: Environment configuration
            
        Returns:
            Environment definition
        """
        env_id = environment_config.get("environment_id") or str(uuid4())
        name = environment_config.get("name", f"Environment {env_id}")
        
        environment = {
            "environment_id": env_id,
            "name": name,
            "type": environment_config.get("type", "development"),  # development, staging, production
            "base_url": environment_config.get("base_url", ""),
            "variables": environment_config.get("variables", {}),
            "authentication": environment_config.get("authentication", {}),
            "headers": environment_config.get("headers", {}),
            "timeouts": environment_config.get("timeouts", {
                "connection_timeout_seconds": 30,
                "read_timeout_seconds": 30
            }),
            "created_at": datetime.utcnow().isoformat(),
            "updated_at": datetime.utcnow().isoformat()
        }
        
        self.environments[env_id] = environment
        
        logger.info(f"Created environment: {name} ({env_id})")
        return environment
    
    def update_environment(
        self,
        environment_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an environment"""
        if environment_id not in self.environments:
            raise ValueError(f"Environment {environment_id} not found")
        
        environment = self.environments[environment_id]
        
        # Update fields
        for key, value in updates.items():
            if key in ["name", "type", "base_url", "variables", "authentication", "headers", "timeouts"]:
                environment[key] = value
        
        environment["updated_at"] = datetime.utcnow().isoformat()
        
        logger.info(f"Updated environment: {environment_id}")
        return environment
    
    def get_environment(self, environment_id: str) -> Dict[str, Any]:
        """Get environment configuration"""
        if environment_id not in self.environments:
            raise ValueError(f"Environment {environment_id} not found")
        
        return self.environments[environment_id]
    
    def list_environments(self) -> List[Dict[str, Any]]:
        """List all environments"""
        return [
            {
                "environment_id": env_id,
                "name": env["name"],
                "type": env["type"],
                "base_url": env["base_url"]
            }
            for env_id, env in self.environments.items()
        ]
    
    def delete_environment(self, environment_id: str) -> bool:
        """Delete an environment"""
        if environment_id in self.environments:
            del self.environments[environment_id]
            logger.info(f"Deleted environment: {environment_id}")
            return True
        return False
    
    def resolve_variables(
        self,
        environment_id: str,
        template: str
    ) -> str:
        """
        Resolve variables in a template string
        
        Args:
            environment_id: Environment identifier
            template: Template string with variables (e.g., "{{base_url}}/api/users")
            
        Returns:
            Resolved string
        """
        if environment_id not in self.environments:
            raise ValueError(f"Environment {environment_id} not found")
        
        environment = self.environments[environment_id]
        variables = environment.get("variables", {})
        
        # Replace variables in template
        resolved = template
        for var_name, var_value in variables.items():
            # Support both {{var}} and ${var} syntax
            resolved = resolved.replace(f"{{{{{var_name}}}}}", str(var_value))
            resolved = resolved.replace(f"${{{var_name}}}", str(var_value))
        
        return resolved
    
    def create_configuration(
        self,
        config_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a test configuration
        
        Args:
            config_data: Configuration data
            
        Returns:
            Configuration definition
        """
        config_id = config_data.get("configuration_id") or str(uuid4())
        
        configuration = {
            "configuration_id": config_id,
            "name": config_data.get("name", f"Configuration {config_id}"),
            "environment_id": config_data.get("environment_id"),
            "test_options": config_data.get("test_options", {}),
            "execution_options": config_data.get("execution_options", {}),
            "reporting_options": config_data.get("reporting_options", {}),
            "created_at": datetime.utcnow().isoformat()
        }
        
        self.configurations[config_id] = configuration
        
        logger.info(f"Created configuration: {config_id}")
        return configuration
    
    def get_configuration(self, configuration_id: str) -> Dict[str, Any]:
        """Get configuration"""
        if configuration_id not in self.configurations:
            raise ValueError(f"Configuration {configuration_id} not found")
        
        return self.configurations[configuration_id]
    
    def list_configurations(self) -> List[Dict[str, Any]]:
        """List all configurations"""
        return [
            {
                "configuration_id": config_id,
                "name": config["name"],
                "environment_id": config.get("environment_id")
            }
            for config_id, config in self.configurations.items()
        ]
    
    # Credential-like keys that must be redacted on export
    _SENSITIVE_KEYS = {
        'password', 'api_key', 'apikey', 'api-key', 'secret', 'client_secret',
        'token', 'access_token', 'refresh_token', 'bearer', 'private_key',
        'secret_key', 'auth_token', 'authorization', 'credentials',
        'connection_string', 'database_url', 'db_password',
    }

    @classmethod
    def _redact_sensitive_dict(cls, d: dict) -> dict:
        """Recursively redact sensitive keys from a dictionary."""
        redacted = {}
        for key, value in d.items():
            if key.lower() in cls._SENSITIVE_KEYS:
                redacted[key] = "***REDACTED***"
            elif isinstance(value, dict):
                redacted[key] = cls._redact_sensitive_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    cls._redact_sensitive_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                redacted[key] = value
        return redacted

    def export_environment(self, environment_id: str) -> str:
        """Export environment as JSON with all sensitive fields redacted"""
        if environment_id not in self.environments:
            raise ValueError(f"Environment {environment_id} not found")

        import copy
        env = copy.deepcopy(self.environments[environment_id])

        # Redact sensitive data recursively across all fields
        env = self._redact_sensitive_dict(env)

        # Additionally redact any sensitive-looking values in variables
        if "variables" in env and isinstance(env["variables"], dict):
            for var_name, var_value in env["variables"].items():
                if any(s in var_name.lower() for s in self._SENSITIVE_KEYS):
                    env["variables"][var_name] = "***REDACTED***"

        return json.dumps(env, indent=2)
    
    def import_environment(self, environment_json: str) -> Dict[str, Any]:
        """Import environment from JSON"""
        env_data = json.loads(environment_json)
        return self.create_environment(env_data)


# Global instance
_environment_manager = None

def get_environment_manager() -> EnvironmentManager:
    """Get or create global EnvironmentManager instance"""
    global _environment_manager
    if _environment_manager is None:
        _environment_manager = EnvironmentManager()
    return _environment_manager




