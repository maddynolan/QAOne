# Performance Testing Tool

Enterprise-grade performance testing tool similar to NeoLoad and LoadRunner, integrated with Flowstral. Now with comprehensive enterprise features for production-ready performance testing.

## Features

### Core Capabilities

1. **Load Generation Engine**
   - Virtual user management
   - Realistic user behavior simulation
   - Ramp-up/ramp-down control
   - Think time with variance
   - Iteration-based or duration-based tests

2. **Test Scenario Designer**
   - Code-less scenario creation
   - Import from Flowstral recordings
   - HTTP/HTTPS request steps
   - WebSocket support
   - Validation and correlation steps
   - Loop and transaction support
   - Export/import JSON scenarios

3. **Protocol Support**
   - HTTP/HTTPS (REST APIs, GraphQL, SOAP)
   - WebSocket (WS/WSS)
   - GraphQL (queries and mutations)
   - gRPC (with grpcio library)
   - MQTT (with aiomqtt library)
   - Extensible for additional protocols

4. **Real-Time Monitoring**
   - Live metrics dashboard
   - Response time percentiles (p50, p75, p90, p95, p99)
   - Throughput (requests per second)
   - Error rate tracking
   - Virtual user status
   - Metrics history
   - SLA threshold monitoring
   - Anomaly detection

5. **Correlation Engine**
   - Automatic correlation extraction
   - JSONPath, Regex, Header, Cookie extraction
   - Auto-detection of common patterns (session IDs, CSRF tokens, auth tokens)
   - Variable substitution in requests
   - Session-scoped correlation data

6. **Distributed Load Generation**
   - Multi-node load generation
   - Automatic load distribution
   - Node capacity management
   - Heartbeat monitoring

### Enterprise Features

7. **Advanced Load Profiles**
   - Linear ramp-up/ramp-down
   - Step-wise load patterns
   - Spike testing (sudden load increases)
   - Stress testing (gradual increase to failure point)
   - Endurance testing (long-running stability)
   - Capacity planning tests
   - Custom load patterns

8. **Data Parameterization**
   - CSV and JSON data sources
   - Sequential, random, unique, and shared access modes
   - Dynamic data substitution in requests
   - Data pool management
   - Support for large datasets

9. **System Resource Monitoring**
   - CPU usage (per-core and aggregate)
   - Memory usage and trends
   - Disk I/O metrics
   - Network traffic monitoring
   - Process count tracking
   - Load average (Unix systems)
   - Real-time system dashboard

10. **Advanced Reporting & Analytics**
    - Comprehensive test reports
    - Per-scenario breakdown
    - Threshold validation
    - Performance score calculation
    - Historical trend analysis
    - Baseline comparison
    - Regression detection
    - Performance recommendations
    - JSON export
    - Comparison reports (multiple test runs)

11. **Alerting System**
    - Email notifications
    - Slack integration
    - Webhook support
    - Configurable alert conditions
    - Severity levels (info, warning, error, critical)
    - Cooldown periods
    - Alert history

12. **Test Scheduling**
    - One-time scheduled tests
    - Cron-based recurring tests
    - Interval-based tests
    - Maximum run limits
    - Automatic test execution
    - Schedule management

13. **Transaction Analysis**
    - Detailed transaction breakdown
    - Transaction-level metrics
    - Error categorization
    - Root cause analysis
    - Error summary statistics
    - Performance bottleneck identification

14. **Test Templates**
    - Pre-built test scenarios
    - API load test template
    - Spike test template
    - Stress test template
    - Endurance test template
    - Capacity test template
    - Smoke test template
    - Customizable templates

15. **Network Simulation**
    - Bandwidth throttling
    - Latency simulation
    - Packet loss simulation
    - Jitter (latency variance)
    - Predefined network profiles (3G, 4G, Cable, DSL, etc.)
    - Custom network conditions

16. **APM Integration**
    - Datadog integration
    - New Relic integration
    - Dynatrace integration
    - Prometheus integration
    - Grafana support
    - Custom APM providers
    - Real-time metric forwarding

17. **CI/CD Integration**
    - RESTful API for automation
    - Webhook support
    - Test result integration
    - Automated reporting
    - Pipeline-friendly design

## Architecture

```
PerformanceEngine (Main Orchestrator)
├── LoadGenerator (Virtual Users, Scenarios)
├── ScenarioDesigner (Test Design)
├── MonitoringService (Real-time Metrics)
├── ProtocolHandler (HTTP, WebSocket)
├── CorrelationEngine (Dynamic Values)
└── DistributedController (Multi-node)
```

## API Endpoints

### Scenarios
- `POST /api/performance/scenarios` - Create scenario
- `POST /api/performance/scenarios/from-flowstral` - Import from Flowstral
- `GET /api/performance/scenarios` - List scenarios
- `GET /api/performance/scenarios/{scenario_id}` - Get scenario
- `POST /api/performance/scenarios/{scenario_id}/steps` - Add step
- `POST /api/performance/scenarios/{scenario_id}/export` - Export scenario
- `POST /api/performance/scenarios/import` - Import scenario

### Test Execution
- `POST /api/performance/tests/run` - Run load test
- `POST /api/performance/tests/{test_id}/stop` - Stop test
- `GET /api/performance/tests/{test_id}/status` - Get status
- `GET /api/performance/tests/{test_id}/report` - Get report

### Metrics
- `GET /api/performance/metrics/realtime` - Real-time dashboard
- `GET /api/performance/metrics/history` - Metrics history

### Correlation
- `POST /api/performance/correlation/rules` - Add correlation rule

## Usage Examples

### 1. Create Scenario from Flowstral Recording

```python
# Import Flowstral session
response = await client.post("/api/performance/scenarios/from-flowstral", json={
    "flowstral_session": {
        "session_id": "session_123",
        "action_graph": {
            "nodes": [...]
        }
    },
    "scenario_name": "Login Flow"
})

scenario_id = response.json()["scenario_id"]
```

### 2. Create Scenario Manually

```python
# Create scenario
response = await client.post("/api/performance/scenarios", json={
    "name": "API Load Test",
    "description": "Test API endpoints under load"
})

scenario_id = response.json()["scenario_id"]

# Add HTTP request step
await client.post(f"/api/performance/scenarios/{scenario_id}/steps", json={
    "step_type": "http_request",
    "name": "Login",
    "method": "POST",
    "url": "/api/auth/login",
    "body": {
        "username": "${username}",
        "password": "${password}"
    },
    "correlation_rules": [
        {
            "variable_name": "auth_token",
            "extract_type": "jsonpath",
            "extract_value": "$.token"
        }
    ]
})
```

### 3. Run Load Test

```python
# Run test
response = await client.post("/api/performance/tests/run", json={
    "scenario_id": scenario_id,
    "virtual_users": 100,
    "ramp_up_seconds": 60,
    "duration_seconds": 300,
    "think_time_ms": 2000,
    "base_url": "https://api.example.com",
    "thresholds": {
        "response_time_p95": {"operator": "<", "value": 500},
        "error_rate": {"operator": "<", "value": 0.01}
    },
    "sla_thresholds": {
        "max_response_time_ms": 1000,
        "max_error_rate": 0.01,
        "min_throughput_rps": 50
    }
})

test_id = response.json()["test_id"]
```

### 4. Monitor Test

```python
# Get real-time metrics
metrics = await client.get("/api/performance/metrics/realtime")
print(metrics.json())

# Get test status
status = await client.get(f"/api/performance/tests/{test_id}/status")
print(status.json())
```

### 5. Get Test Report

```python
# Get final report
report = await client.get(f"/api/performance/tests/{test_id}/report")
print(report.json())
```

## Integration with Flowstral

The performance testing tool seamlessly integrates with Flowstral:

1. **Record User Flow** - Use Flowstral to record real user interactions
2. **Import to Performance Tool** - Convert Flowstral action graph to performance test scenario
3. **Configure Load Profile** - Set virtual users, ramp-up, duration
4. **Run Load Test** - Execute performance test with realistic user behavior
5. **Analyze Results** - Get comprehensive performance metrics and reports

## Comparison with Neoload/LoadRunner

| Feature | Neoload/LoadRunner | This Tool |
|---------|------------------|-----------|
| Code-less Design | ✅ | ✅ |
| Protocol Support | 50+ protocols | HTTP, WebSocket (extensible) |
| Real-time Monitoring | ✅ | ✅ |
| Correlation | ✅ | ✅ |
| Distributed Testing | ✅ | ✅ |
| CI/CD Integration | ✅ | Via API |
| Flowstral Integration | ❌ | ✅ |
| Web Vitals | Limited | ✅ (from Flowstral) |

## Future Enhancements

- [ ] Additional protocols (gRPC, GraphQL, MQTT)
- [ ] Visual scenario designer UI
- [ ] Advanced parameterization (CSV, database)
- [ ] Chaos engineering scenarios
- [ ] Integration with Grafana/Prometheus
- [ ] Machine learning-based anomaly detection
- [ ] Automatic threshold recommendations
- [ ] Performance regression detection

## Dependencies

- `aiohttp` - Async HTTP client
- `asyncio` - Async operations
- Standard library modules

## Notes

- The tool is designed to work alongside Flowstral for comprehensive testing
- All metrics are collected in real-time and stored in memory (can be extended to time-series DB)
- Distributed testing requires additional infrastructure setup
- Correlation rules support common patterns out of the box

