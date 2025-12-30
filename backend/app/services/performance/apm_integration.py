"""
APM Integration - Integration with Application Performance Monitoring tools
Supports Datadog, New Relic, Dynatrace, AppDynamics, etc.
"""

import logging
import aiohttp
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class APMProvider(Enum):
    """Supported APM providers"""
    DATADOG = "datadog"
    NEW_RELIC = "new_relic"
    DYNATRACE = "dynatrace"
    APP_DYNAMICS = "app_dynamics"
    PROMETHEUS = "prometheus"
    GRAFANA = "grafana"
    CUSTOM = "custom"


@dataclass
class APMConfig:
    """APM integration configuration"""
    provider: APMProvider
    api_key: Optional[str] = None
    api_url: Optional[str] = None
    app_id: Optional[str] = None
    custom_headers: Dict[str, str] = None
    
    def __post_init__(self):
        if self.custom_headers is None:
            self.custom_headers = {}


class APMIntegration:
    """
    APM Integration Framework
    Integrates with external APM tools for comprehensive monitoring
    """
    
    def __init__(self):
        self.configs: Dict[str, APMConfig] = {}
        self.enabled: bool = False
    
    def configure(
        self,
        provider: APMProvider,
        api_key: Optional[str] = None,
        api_url: Optional[str] = None,
        app_id: Optional[str] = None,
        custom_headers: Optional[Dict[str, str]] = None
    ) -> str:
        """Configure APM integration"""
        config_id = f"{provider.value}_integration"
        
        config = APMConfig(
            provider=provider,
            api_key=api_key,
            api_url=api_url,
            app_id=app_id,
            custom_headers=custom_headers or {}
        )
        
        self.configs[config_id] = config
        self.enabled = True
        
        logger.info(f"Configured APM integration: {provider.value}")
        return config_id
    
    async def send_metrics(
        self,
        config_id: str,
        metrics: Dict[str, Any],
        test_id: Optional[str] = None
    ):
        """Send metrics to APM provider"""
        if config_id not in self.configs:
            logger.warning(f"APM config not found: {config_id}")
            return
        
        config = self.configs[config_id]
        
        try:
            if config.provider == APMProvider.DATADOG:
                await self._send_to_datadog(config, metrics, test_id)
            elif config.provider == APMProvider.NEW_RELIC:
                await self._send_to_newrelic(config, metrics, test_id)
            elif config.provider == APMProvider.DYNATRACE:
                await self._send_to_dynatrace(config, metrics, test_id)
            elif config.provider == APMProvider.PROMETHEUS:
                await self._send_to_prometheus(config, metrics, test_id)
            else:
                logger.warning(f"APM provider {config.provider.value} not fully implemented")
        
        except Exception as e:
            logger.error(f"Error sending metrics to APM: {e}")
    
    async def _send_to_datadog(
        self,
        config: APMConfig,
        metrics: Dict[str, Any],
        test_id: Optional[str]
    ):
        """Send metrics to Datadog"""
        if not config.api_key or not config.api_url:
            return
        
        url = f"{config.api_url}/api/v1/series"
        
        # Format metrics for Datadog
        series = []
        
        # Response time metrics
        if "response_time" in metrics:
            rt = metrics["response_time"]
            series.extend([
                {
                    "metric": "performance.response_time.avg",
                    "points": [[int(metrics.get("timestamp", 0)), rt.get("avg", 0)]],
                    "tags": [f"test_id:{test_id}"] if test_id else []
                },
                {
                    "metric": "performance.response_time.p95",
                    "points": [[int(metrics.get("timestamp", 0)), rt.get("p95", 0)]],
                    "tags": [f"test_id:{test_id}"] if test_id else []
                }
            ])
        
        # Error rate
        if "iterations" in metrics:
            error_rate = metrics["iterations"].get("error_rate", 0)
            series.append({
                "metric": "performance.error_rate",
                "points": [[int(metrics.get("timestamp", 0)), error_rate]],
                "tags": [f"test_id:{test_id}"] if test_id else []
            })
        
        # Throughput
        if "throughput" in metrics:
            rps = metrics["throughput"].get("rps", 0)
            series.append({
                "metric": "performance.throughput.rps",
                "points": [[int(metrics.get("timestamp", 0)), rps]],
                "tags": [f"test_id:{test_id}"] if test_id else []
            })
        
        if series:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json={"series": series},
                    headers={
                        "DD-API-KEY": config.api_key,
                        "Content-Type": "application/json",
                        **config.custom_headers
                    }
                ) as response:
                    if response.status != 202:
                        logger.error(f"Datadog API error: {response.status}")
    
    async def _send_to_newrelic(
        self,
        config: APMConfig,
        metrics: Dict[str, Any],
        test_id: Optional[str]
    ):
        """Send metrics to New Relic"""
        if not config.api_key:
            return
        
        url = "https://metric-api.newrelic.com/metric/v1"
        
        # Format metrics for New Relic
        metrics_data = []
        
        if "response_time" in metrics:
            rt = metrics["response_time"]
            metrics_data.append({
                "name": "performance.response_time.avg",
                "value": rt.get("avg", 0),
                "timestamp": metrics.get("timestamp", 0)
            })
        
        if metrics_data:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    json=[{"metrics": metrics_data}],
                    headers={
                        "Api-Key": config.api_key,
                        "Content-Type": "application/json",
                        **config.custom_headers
                    }
                ) as response:
                    if response.status != 202:
                        logger.error(f"New Relic API error: {response.status}")
    
    async def _send_to_dynatrace(
        self,
        config: APMConfig,
        metrics: Dict[str, Any],
        test_id: Optional[str]
    ):
        """Send metrics to Dynatrace"""
        if not config.api_url or not config.api_key:
            return
        
        url = f"{config.api_url}/api/v2/metrics/ingest"
        
        # Format metrics for Dynatrace
        # Implementation depends on Dynatrace API format
        logger.info("Dynatrace integration - format metrics according to API spec")
    
    async def _send_to_prometheus(
        self,
        config: APMConfig,
        metrics: Dict[str, Any],
        test_id: Optional[str]
    ):
        """Send metrics to Prometheus"""
        # Prometheus typically uses pushgateway or direct instrumentation
        # This is a placeholder for Prometheus integration
        logger.info("Prometheus integration - use pushgateway or direct instrumentation")
    
    def get_integrations(self) -> List[Dict[str, Any]]:
        """Get list of configured integrations"""
        return [
            {
                "config_id": config_id,
                "provider": config.provider.value,
                "api_url": config.api_url,
                "app_id": config.app_id
            }
            for config_id, config in self.configs.items()
        ]




