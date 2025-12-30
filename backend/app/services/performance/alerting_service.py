"""
Alerting Service - Email, Slack, Webhook notifications
Enterprise alerting for SLA violations and anomalies
"""

import logging
import aiohttp
import json
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

logger = logging.getLogger(__name__)


class AlertSeverity(Enum):
    """Alert severity levels"""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class Alert:
    """Alert definition"""
    alert_id: str
    name: str
    condition: str  # e.g., "error_rate > 0.01"
    severity: AlertSeverity
    enabled: bool = True
    channels: List[str] = field(default_factory=list)  # email, slack, webhook
    recipients: List[str] = field(default_factory=list)  # Email addresses, Slack channels
    webhook_url: Optional[str] = None
    cooldown_seconds: int = 300  # Don't send same alert more than once per cooldown period
    last_triggered: Optional[datetime] = None


class AlertingService:
    """
    Alerting Service
    Sends notifications via email, Slack, webhooks for SLA violations and anomalies
    """
    
    def __init__(self):
        self.alerts: Dict[str, Alert] = {}
        self.alert_history: List[Dict[str, Any]] = []
        self.email_config: Optional[Dict[str, Any]] = None
        self.slack_config: Optional[Dict[str, Any]] = None
    
    def configure_email(
        self,
        smtp_host: str,
        smtp_port: int,
        username: str,
        password: str,
        from_email: str
    ):
        """Configure email settings"""
        self.email_config = {
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "username": username,
            "password": password,
            "from_email": from_email
        }
        logger.info("Email alerting configured")
    
    def configure_slack(
        self,
        webhook_url: str
    ):
        """Configure Slack webhook"""
        self.slack_config = {
            "webhook_url": webhook_url
        }
        logger.info("Slack alerting configured")
    
    def create_alert(
        self,
        alert_id: str,
        name: str,
        condition: str,
        severity: AlertSeverity,
        channels: List[str],
        recipients: Optional[List[str]] = None,
        webhook_url: Optional[str] = None,
        cooldown_seconds: int = 300
    ) -> Alert:
        """Create a new alert"""
        alert = Alert(
            alert_id=alert_id,
            name=name,
            condition=condition,
            severity=severity,
            channels=channels,
            recipients=recipients or [],
            webhook_url=webhook_url,
            cooldown_seconds=cooldown_seconds
        )
        
        self.alerts[alert_id] = alert
        logger.info(f"Created alert: {name} ({alert_id})")
        return alert
    
    async def check_alerts(
        self,
        metrics: Dict[str, Any],
        test_id: Optional[str] = None
    ):
        """Check all alerts against current metrics"""
        for alert in self.alerts.values():
            if not alert.enabled:
                continue
            
            # Check cooldown
            if alert.last_triggered:
                elapsed = (datetime.utcnow() - alert.last_triggered).total_seconds()
                if elapsed < alert.cooldown_seconds:
                    continue
            
            # Evaluate condition
            if self._evaluate_condition(alert.condition, metrics):
                await self._trigger_alert(alert, metrics, test_id)
                alert.last_triggered = datetime.utcnow()
    
    def _evaluate_condition(self, condition: str, metrics: Dict[str, Any]) -> bool:
        """Evaluate alert condition against metrics"""
        try:
            # Simple condition evaluation
            # Supports: metric_path operator value
            # e.g., "response_time.p95 > 1000", "error_rate > 0.01"
            
            # Parse condition
            parts = condition.split()
            if len(parts) != 3:
                return False
            
            metric_path = parts[0]
            operator = parts[1]
            threshold_value = float(parts[2])
            
            # Get metric value
            metric_value = self._get_metric_value(metrics, metric_path)
            
            # Evaluate
            if operator == ">":
                return metric_value > threshold_value
            elif operator == ">=":
                return metric_value >= threshold_value
            elif operator == "<":
                return metric_value < threshold_value
            elif operator == "<=":
                return metric_value <= threshold_value
            elif operator == "==":
                return abs(metric_value - threshold_value) < 0.001
            else:
                return False
        
        except Exception as e:
            logger.error(f"Error evaluating condition '{condition}': {e}")
            return False
    
    def _get_metric_value(self, metrics: Dict[str, Any], path: str) -> float:
        """Get metric value from nested path"""
        parts = path.split(".")
        value = metrics
        
        for part in parts:
            if isinstance(value, dict):
                value = value.get(part, 0)
            else:
                return 0.0
        
        return float(value) if value else 0.0
    
    async def _trigger_alert(
        self,
        alert: Alert,
        metrics: Dict[str, Any],
        test_id: Optional[str]
    ):
        """Trigger an alert through configured channels"""
        alert_data = {
            "alert_id": alert.alert_id,
            "name": alert.name,
            "severity": alert.severity.value,
            "condition": alert.condition,
            "test_id": test_id,
            "timestamp": datetime.utcnow().isoformat(),
            "metrics": metrics
        }
        
        # Send to each channel
        for channel in alert.channels:
            try:
                if channel == "email":
                    await self._send_email(alert, alert_data)
                elif channel == "slack":
                    await self._send_slack(alert, alert_data)
                elif channel == "webhook":
                    await self._send_webhook(alert, alert_data)
            except Exception as e:
                logger.error(f"Error sending alert via {channel}: {e}")
        
        # Record in history
        self.alert_history.append(alert_data)
        logger.warning(f"Alert triggered: {alert.name} ({alert.severity.value})")
    
    async def _send_email(self, alert: Alert, alert_data: Dict[str, Any]):
        """Send email alert"""
        if not self.email_config:
            logger.warning("Email not configured")
            return
        
        # In production, use aiohttp with SMTP or email service
        # For now, log the alert
        logger.info(f"Email alert: {alert.name} to {alert.recipients}")
        # TODO: Implement actual email sending
    
    async def _send_slack(self, alert: Alert, alert_data: Dict[str, Any]):
        """Send Slack alert"""
        if not self.slack_config:
            logger.warning("Slack not configured")
            return
        
        webhook_url = self.slack_config.get("webhook_url")
        if not webhook_url:
            return
        
        # Format Slack message
        severity_emoji = {
            "info": "ℹ️",
            "warning": "⚠️",
            "error": "❌",
            "critical": "🚨"
        }
        
        emoji = severity_emoji.get(alert.severity.value, "📢")
        
        message = {
            "text": f"{emoji} Performance Alert: {alert.name}",
            "blocks": [
                {
                    "type": "header",
                    "text": {
                        "type": "plain_text",
                        "text": f"{emoji} {alert.name}"
                    }
                },
                {
                    "type": "section",
                    "fields": [
                        {
                            "type": "mrkdwn",
                            "text": f"*Severity:* {alert.severity.value.upper()}"
                        },
                        {
                            "type": "mrkdwn",
                            "text": f"*Condition:* `{alert.condition}`"
                        }
                    ]
                }
            ]
        }
        
        if alert_data.get("test_id"):
            message["blocks"].append({
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"*Test ID:* `{alert_data['test_id']}`"
                }
            })
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(webhook_url, json=message) as response:
                    if response.status != 200:
                        logger.error(f"Slack webhook failed: {response.status}")
        except Exception as e:
            logger.error(f"Error sending Slack alert: {e}")
    
    async def _send_webhook(self, alert: Alert, alert_data: Dict[str, Any]):
        """Send webhook alert"""
        webhook_url = alert.webhook_url
        if not webhook_url:
            return
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    webhook_url,
                    json=alert_data,
                    headers={"Content-Type": "application/json"}
                ) as response:
                    if response.status not in [200, 201, 204]:
                        logger.error(f"Webhook failed: {response.status}")
        except Exception as e:
            logger.error(f"Error sending webhook alert: {e}")
    
    def get_alert_history(
        self,
        limit: int = 100,
        severity: Optional[AlertSeverity] = None
    ) -> List[Dict[str, Any]]:
        """Get alert history"""
        history = self.alert_history.copy()
        
        if severity:
            history = [a for a in history if a.get("severity") == severity.value]
        
        return history[-limit:]
    
    def list_alerts(self) -> List[Dict[str, Any]]:
        """List all alerts"""
        return [
            {
                "alert_id": alert.alert_id,
                "name": alert.name,
                "condition": alert.condition,
                "severity": alert.severity.value,
                "enabled": alert.enabled,
                "channels": alert.channels,
                "last_triggered": alert.last_triggered.isoformat() if alert.last_triggered else None
            }
            for alert in self.alerts.values()
        ]




