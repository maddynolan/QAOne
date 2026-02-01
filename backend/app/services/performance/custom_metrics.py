"""
Custom Metrics - User-defined metrics for performance testing
Comparable to k6's Trend, Counter, Gauge, Rate metrics

Features:
- Counter: Cumulative count of events
- Gauge: Point-in-time value (keeps latest)
- Rate: Percentage/ratio (pass/fail rate)
- Trend: Statistical distribution (min, max, avg, percentiles)
- Tags for filtering and grouping
- Real-time streaming
"""

import logging
import time
import statistics
import threading
from typing import Dict, List, Any, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime
from collections import defaultdict

logger = logging.getLogger(__name__)


class MetricType(Enum):
    """Types of custom metrics"""
    COUNTER = "counter"  # Cumulative count
    GAUGE = "gauge"  # Point-in-time value
    RATE = "rate"  # Pass/fail rate
    TREND = "trend"  # Distribution with percentiles


@dataclass
class MetricValue:
    """Single metric data point"""
    value: float
    timestamp: datetime = field(default_factory=datetime.utcnow)
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricDefinition:
    """Definition of a custom metric"""
    name: str
    metric_type: MetricType
    description: str = ""
    unit: str = ""  # e.g., "ms", "bytes", "requests"
    threshold: Optional[float] = None
    threshold_operator: str = "<"  # <, >, <=, >=, ==


class CounterMetric:
    """
    Counter Metric - Cumulative count
    Only increases (or resets to 0)
    
    Usage:
        requests = CounterMetric("requests")
        requests.add(1)
        requests.add(5)
        print(requests.value)  # 6
    """
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.metric_type = MetricType.COUNTER
        self._value: float = 0
        self._values_by_tag: Dict[str, float] = defaultdict(float)
        self._lock = threading.Lock()
        self._history: List[MetricValue] = []
    
    def add(self, value: float = 1, tags: Dict[str, str] = None):
        """Add to the counter"""
        with self._lock:
            self._value += value
            
            if tags:
                tag_key = self._tags_to_key(tags)
                self._values_by_tag[tag_key] += value
            
            self._history.append(MetricValue(
                value=self._value,
                tags=tags or {}
            ))
    
    @property
    def value(self) -> float:
        """Get current value"""
        with self._lock:
            return self._value
    
    def get_by_tags(self, tags: Dict[str, str]) -> float:
        """Get value for specific tags"""
        with self._lock:
            tag_key = self._tags_to_key(tags)
            return self._values_by_tag.get(tag_key, 0)
    
    def reset(self):
        """Reset counter to 0"""
        with self._lock:
            self._value = 0
            self._values_by_tag.clear()
            self._history.clear()
    
    def _tags_to_key(self, tags: Dict[str, str]) -> str:
        """Convert tags dict to string key"""
        return ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metric summary"""
        with self._lock:
            return {
                "name": self.name,
                "type": self.metric_type.value,
                "value": self._value,
                "by_tags": dict(self._values_by_tag)
            }


class GaugeMetric:
    """
    Gauge Metric - Point-in-time value
    Can go up or down, represents current state
    
    Usage:
        active_users = GaugeMetric("active_users")
        active_users.set(100)
        active_users.add(5)
        active_users.sub(3)
        print(active_users.value)  # 102
    """
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.metric_type = MetricType.GAUGE
        self._value: float = 0
        self._min: float = float('inf')
        self._max: float = float('-inf')
        self._lock = threading.Lock()
        self._history: List[MetricValue] = []
    
    def set(self, value: float, tags: Dict[str, str] = None):
        """Set the gauge to a specific value"""
        with self._lock:
            self._value = value
            self._min = min(self._min, value)
            self._max = max(self._max, value)
            
            self._history.append(MetricValue(
                value=value,
                tags=tags or {}
            ))
    
    def add(self, value: float = 1):
        """Add to the gauge"""
        with self._lock:
            self._value += value
            self._min = min(self._min, self._value)
            self._max = max(self._max, self._value)
            
            self._history.append(MetricValue(value=self._value))
    
    def sub(self, value: float = 1):
        """Subtract from the gauge"""
        self.add(-value)
    
    @property
    def value(self) -> float:
        """Get current value"""
        with self._lock:
            return self._value
    
    def reset(self):
        """Reset gauge"""
        with self._lock:
            self._value = 0
            self._min = float('inf')
            self._max = float('-inf')
            self._history.clear()
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metric summary"""
        with self._lock:
            return {
                "name": self.name,
                "type": self.metric_type.value,
                "value": self._value,
                "min": self._min if self._min != float('inf') else None,
                "max": self._max if self._max != float('-inf') else None
            }


class RateMetric:
    """
    Rate Metric - Pass/fail rate calculation
    Tracks ratio of non-zero (pass) values to total
    
    Usage:
        success_rate = RateMetric("success_rate")
        success_rate.add(True)  # Pass
        success_rate.add(False)  # Fail
        print(success_rate.rate)  # 0.5 (50%)
    """
    
    def __init__(self, name: str, description: str = ""):
        self.name = name
        self.description = description
        self.metric_type = MetricType.RATE
        self._passes: int = 0
        self._total: int = 0
        self._values_by_tag: Dict[str, tuple] = defaultdict(lambda: (0, 0))
        self._lock = threading.Lock()
        self._history: List[MetricValue] = []
    
    def add(self, passed: bool, tags: Dict[str, str] = None):
        """Add a pass/fail observation"""
        with self._lock:
            self._total += 1
            if passed:
                self._passes += 1
            
            if tags:
                tag_key = self._tags_to_key(tags)
                p, t = self._values_by_tag[tag_key]
                self._values_by_tag[tag_key] = (p + (1 if passed else 0), t + 1)
            
            self._history.append(MetricValue(
                value=1.0 if passed else 0.0,
                tags=tags or {}
            ))
    
    @property
    def rate(self) -> float:
        """Get current rate (0.0 to 1.0)"""
        with self._lock:
            return self._passes / self._total if self._total > 0 else 0.0
    
    @property
    def percentage(self) -> float:
        """Get rate as percentage (0.0 to 100.0)"""
        return self.rate * 100
    
    @property
    def passes(self) -> int:
        """Get total passes"""
        with self._lock:
            return self._passes
    
    @property
    def fails(self) -> int:
        """Get total fails"""
        with self._lock:
            return self._total - self._passes
    
    def reset(self):
        """Reset rate"""
        with self._lock:
            self._passes = 0
            self._total = 0
            self._values_by_tag.clear()
            self._history.clear()
    
    def _tags_to_key(self, tags: Dict[str, str]) -> str:
        """Convert tags dict to string key"""
        return ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metric summary"""
        with self._lock:
            return {
                "name": self.name,
                "type": self.metric_type.value,
                "rate": self.rate,
                "percentage": self.percentage,
                "passes": self._passes,
                "fails": self._total - self._passes,
                "total": self._total
            }


class TrendMetric:
    """
    Trend Metric - Statistical distribution
    Tracks min, max, avg, and percentiles
    
    Usage:
        response_time = TrendMetric("http_req_duration")
        response_time.add(100)
        response_time.add(150)
        response_time.add(200)
        print(response_time.avg)  # 150
        print(response_time.p95)  # ~200
    """
    
    def __init__(self, name: str, description: str = "", unit: str = ""):
        self.name = name
        self.description = description
        self.unit = unit
        self.metric_type = MetricType.TREND
        self._values: List[float] = []
        self._values_by_tag: Dict[str, List[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._history: List[MetricValue] = []
    
    def add(self, value: float, tags: Dict[str, str] = None):
        """Add a value to the trend"""
        with self._lock:
            self._values.append(value)
            
            if tags:
                tag_key = self._tags_to_key(tags)
                self._values_by_tag[tag_key].append(value)
            
            self._history.append(MetricValue(
                value=value,
                tags=tags or {}
            ))
    
    @property
    def count(self) -> int:
        """Get number of values"""
        with self._lock:
            return len(self._values)
    
    @property
    def min(self) -> float:
        """Get minimum value"""
        with self._lock:
            return min(self._values) if self._values else 0.0
    
    @property
    def max(self) -> float:
        """Get maximum value"""
        with self._lock:
            return max(self._values) if self._values else 0.0
    
    @property
    def avg(self) -> float:
        """Get average value"""
        with self._lock:
            return statistics.mean(self._values) if self._values else 0.0
    
    @property
    def med(self) -> float:
        """Get median value"""
        with self._lock:
            return statistics.median(self._values) if self._values else 0.0
    
    @property
    def std_dev(self) -> float:
        """Get standard deviation"""
        with self._lock:
            return statistics.stdev(self._values) if len(self._values) > 1 else 0.0
    
    def percentile(self, p: float) -> float:
        """Get specific percentile (0-100)"""
        with self._lock:
            if not self._values:
                return 0.0
            
            sorted_values = sorted(self._values)
            index = int(len(sorted_values) * p / 100)
            return sorted_values[min(index, len(sorted_values) - 1)]
    
    @property
    def p50(self) -> float:
        """Get 50th percentile (median)"""
        return self.percentile(50)
    
    @property
    def p90(self) -> float:
        """Get 90th percentile"""
        return self.percentile(90)
    
    @property
    def p95(self) -> float:
        """Get 95th percentile"""
        return self.percentile(95)
    
    @property
    def p99(self) -> float:
        """Get 99th percentile"""
        return self.percentile(99)
    
    def reset(self):
        """Reset trend"""
        with self._lock:
            self._values.clear()
            self._values_by_tag.clear()
            self._history.clear()
    
    def _tags_to_key(self, tags: Dict[str, str]) -> str:
        """Convert tags dict to string key"""
        return ",".join(f"{k}={v}" for k, v in sorted(tags.items()))
    
    def get_summary(self) -> Dict[str, Any]:
        """Get metric summary"""
        with self._lock:
            return {
                "name": self.name,
                "type": self.metric_type.value,
                "unit": self.unit,
                "count": len(self._values),
                "min": self.min,
                "max": self.max,
                "avg": self.avg,
                "med": self.med,
                "p90": self.p90,
                "p95": self.p95,
                "p99": self.p99,
                "std_dev": self.std_dev
            }


class CustomMetricsRegistry:
    """
    Registry for custom metrics.
    Provides centralized access to all metrics.
    
    Usage:
        registry = CustomMetricsRegistry()
        
        # Create metrics
        registry.counter("http_reqs")
        registry.trend("http_req_duration", unit="ms")
        registry.rate("http_req_failed")
        registry.gauge("vus")
        
        # Record values
        registry.get("http_reqs").add(1)
        registry.get("http_req_duration").add(150)
        registry.get("http_req_failed").add(False)
        registry.get("vus").set(100)
        
        # Get summary
        summary = registry.get_all_summaries()
    """
    
    def __init__(self):
        self._metrics: Dict[str, Any] = {}
        self._lock = threading.Lock()
        
        # Built-in metrics (like k6)
        self._init_builtin_metrics()
    
    def _init_builtin_metrics(self):
        """Initialize built-in metrics like k6"""
        # Request metrics
        self.counter("http_reqs", "Total HTTP requests")
        self.trend("http_req_duration", "HTTP request duration", unit="ms")
        self.trend("http_req_waiting", "HTTP request waiting time", unit="ms")
        self.trend("http_req_connecting", "HTTP connection time", unit="ms")
        self.trend("http_req_sending", "HTTP request sending time", unit="ms")
        self.trend("http_req_receiving", "HTTP response receiving time", unit="ms")
        self.trend("http_req_blocked", "HTTP request blocked time", unit="ms")
        self.rate("http_req_failed", "HTTP request failure rate")
        
        # Data metrics
        self.counter("data_sent", "Total data sent")
        self.counter("data_received", "Total data received")
        
        # VU metrics
        self.gauge("vus", "Current number of virtual users")
        self.gauge("vus_max", "Maximum number of virtual users")
        
        # Iteration metrics
        self.counter("iterations", "Total iterations completed")
        self.trend("iteration_duration", "Iteration duration", unit="ms")
        
        # Check metrics
        self.counter("checks", "Total checks executed")
        self.rate("checks_succeeded", "Check success rate")
    
    def counter(self, name: str, description: str = "") -> CounterMetric:
        """Create or get a counter metric"""
        with self._lock:
            if name not in self._metrics:
                self._metrics[name] = CounterMetric(name, description)
            return self._metrics[name]
    
    def gauge(self, name: str, description: str = "") -> GaugeMetric:
        """Create or get a gauge metric"""
        with self._lock:
            if name not in self._metrics:
                self._metrics[name] = GaugeMetric(name, description)
            return self._metrics[name]
    
    def rate(self, name: str, description: str = "") -> RateMetric:
        """Create or get a rate metric"""
        with self._lock:
            if name not in self._metrics:
                self._metrics[name] = RateMetric(name, description)
            return self._metrics[name]
    
    def trend(self, name: str, description: str = "", unit: str = "") -> TrendMetric:
        """Create or get a trend metric"""
        with self._lock:
            if name not in self._metrics:
                self._metrics[name] = TrendMetric(name, description, unit)
            return self._metrics[name]
    
    def get(self, name: str) -> Optional[Any]:
        """Get a metric by name"""
        with self._lock:
            return self._metrics.get(name)
    
    def list_metrics(self) -> List[str]:
        """List all metric names"""
        with self._lock:
            return list(self._metrics.keys())
    
    def get_summary(self, name: str) -> Optional[Dict[str, Any]]:
        """Get summary for a specific metric"""
        metric = self.get(name)
        return metric.get_summary() if metric else None
    
    def get_all_summaries(self) -> Dict[str, Any]:
        """Get summaries for all metrics"""
        with self._lock:
            return {
                name: metric.get_summary()
                for name, metric in self._metrics.items()
            }
    
    def reset_all(self):
        """Reset all metrics"""
        with self._lock:
            for metric in self._metrics.values():
                metric.reset()
    
    def export_prometheus(self) -> str:
        """Export metrics in Prometheus format"""
        lines = []
        
        with self._lock:
            for name, metric in self._metrics.items():
                summary = metric.get_summary()
                metric_name = name.replace(".", "_").replace("-", "_")
                
                if metric.metric_type == MetricType.COUNTER:
                    lines.append(f"# TYPE {metric_name} counter")
                    lines.append(f"{metric_name} {summary['value']}")
                
                elif metric.metric_type == MetricType.GAUGE:
                    lines.append(f"# TYPE {metric_name} gauge")
                    lines.append(f"{metric_name} {summary['value']}")
                
                elif metric.metric_type == MetricType.RATE:
                    lines.append(f"# TYPE {metric_name} gauge")
                    lines.append(f"{metric_name} {summary['rate']}")
                
                elif metric.metric_type == MetricType.TREND:
                    lines.append(f"# TYPE {metric_name} summary")
                    lines.append(f'{metric_name}{{quantile="0.5"}} {summary["med"]}')
                    lines.append(f'{metric_name}{{quantile="0.9"}} {summary["p90"]}')
                    lines.append(f'{metric_name}{{quantile="0.95"}} {summary["p95"]}')
                    lines.append(f'{metric_name}{{quantile="0.99"}} {summary["p99"]}')
                    lines.append(f"{metric_name}_count {summary['count']}")
                    lines.append(f"{metric_name}_sum {summary['avg'] * summary['count']}")
                
                lines.append("")
        
        return "\n".join(lines)
    
    def export_json(self) -> str:
        """Export metrics as JSON"""
        import json
        return json.dumps(self.get_all_summaries(), indent=2)


# Singleton instance
_metrics_registry: Optional[CustomMetricsRegistry] = None

def get_metrics_registry() -> CustomMetricsRegistry:
    """Get singleton metrics registry"""
    global _metrics_registry
    if _metrics_registry is None:
        _metrics_registry = CustomMetricsRegistry()
    return _metrics_registry
