# Performance Testing

Load testing with virtual user simulation, protocol recording, and multiple load patterns. Enables teams to identify bottlenecks, validate scalability, and establish performance baselines.

## Architecture

The module provides two main capabilities:

1. **Load Testing** -- `Performance` page configures and executes load tests with 8 load patterns (constant, ramp, spike, stress, soak, breakpoint, wave, custom). Results include response time percentiles, throughput metrics, and error rates.
2. **Virtual User Generation** -- `VirtualUserGenerator` creates configurable virtual user profiles with behavioral parameters for realistic load simulation.

The backend handles actual load generation, running concurrent virtual users against target endpoints and streaming real-time metrics back to the frontend.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/Performance.tsx` | 1,990 | Performance testing UI -- scenario configuration, execution controls, results with charts |
| `pages/VirtualUserGenerator.tsx` | 2,729 | Virtual user profile creation with configurable behavior, think times, and ramp patterns |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/performance/start` | POST | Start load test execution |
| `/performance/stop` | POST | Stop running load test |
| `/performance/results/{id}` | GET | Get test results with metrics |
| `/performance/scenarios` | GET/POST | List and create test scenarios |
| `/performance/generate-script` | POST | Generate load test script (QAAI, k6, JMeter formats) |
| `/api/protocol-recording/start` | POST | Start HTTP traffic capture during browser session |
| `/api/protocol-recording/stop` | POST | Stop capture and export HAR |

## Load Patterns

| Pattern | Description |
|---------|-------------|
| Constant | Fixed user count for steady-state testing |
| Ramp | Gradual increase to target load |
| Spike | Sudden burst of traffic |
| Stress | Push beyond expected capacity |
| Soak | Extended duration for memory leak detection |
| Breakpoint | Incrementally increase until failure |
| Wave | Oscillating load levels |
| Custom | User-defined load curve |

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`
- **External**: React 18, Tailwind CSS, Recharts (charting), Radix UI, Lucide icons

## Testing Notes

- Load test execution is backend-intensive; frontend tests can mock the `/performance/*` endpoints.
- Virtual user generator produces JSON configuration; validate generated configs against the backend schema.
- Protocol recording captures real HTTP traffic and may contain sensitive data in test scenarios.
- Results charting with Recharts should be tested with large datasets (10,000+ data points) for rendering performance.
