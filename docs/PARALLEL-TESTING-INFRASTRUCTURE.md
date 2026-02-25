# Parallel Testing Infrastructure for SaaS

> **Purpose:** Guide for setting up cost-effective parallel test execution infrastructure like Sauce Labs/BrowserStack

---

## Current Implementation Status (v3.14.0)

### TestExecutorQueue

The queue system supports dual backends selected at startup based on the `REDIS_URL` environment variable:

| Backend | Selection | Use Case |
|---------|-----------|----------|
| **Redis** | `REDIS_URL` is set | Production, multi-worker, crash recovery |
| **InMemory** | No `REDIS_URL` | Development, single-process demo |

**Core dataclass:**

```python
@dataclass
class TestJob:
    job_id: str           # UUID
    test_run_id: str      # Links to test_runs table
    test_case_id: str     # Links to test_cases table
    project_id: str       # Tenant isolation
    status: str           # QUEUED | RUNNING | COMPLETED | FAILED
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    result: Optional[dict]
    error: Optional[str]
```

**Queue methods:**

| Method | Purpose |
|--------|---------|
| `save_job(job)` | Persist job metadata (Redis hash or in-memory dict) |
| `enqueue(job)` | Add job to tail of queue (`RPUSH` / `asyncio.Queue.put`) |
| `dequeue()` | Atomic pop from queue (`RPOPLPUSH` / `asyncio.Queue.get`) |
| `task_done(job_id)` | Remove from processing list, mark complete |
| `update_job(job_id, updates)` | Update job fields (status, result, error) |
| `get_job(job_id)` | Retrieve job by ID |
| `restore_pending_jobs()` | On startup, move crashed jobs from processing list back to queue (Redis only) |

### Worker Entry Point

```bash
python -m app.workers.test_worker
```

Defined in `Dockerfile.worker`. Each worker:
1. Connects to Redis (or uses in-memory queue in single-process mode)
2. Calls `dequeue()` in a loop (blocks until a job is available)
3. Launches Playwright browser for the job
4. Executes test steps, captures screenshots, reports via WebSocket
5. Calls `task_done()` + `update_job()` on completion or failure

### Trigger-to-Execution Flow

```
User clicks "Run" in UI
        |
        | POST /test-runs/execute  { test_case_id, environment, browser }
        v
test_runs_api.py
        |
        | 1. Create test_run row in PostgreSQL (status: "queued")
        | 2. Build TestJob dataclass
        | 3. save_job(job) → persist metadata
        | 4. enqueue(job) → push to queue
        v
TestExecutorQueue
        |
        +--- Redis: RPUSH "test_queue" job_id
        |           RPOPLPUSH "test_queue" "processing" (worker side)
        |
        +--- InMemory: asyncio.Queue.put(job)
        |              asyncio.Queue.get() (worker side)
        v
test_worker.py (loop)
        |
        | dequeue() → TestJob
        | update_job(status="RUNNING")
        v
PlaywrightRunner.execute(test_case)
        |
        | Launch browser (Chromium/Firefox/WebKit)
        | For each step:
        |   - Navigate / click / fill / assert
        |   - Capture screenshot
        |   - Send WebSocket: step_start, step_complete, screenshot
        |   - If selector fails → HealingOrchestrator (4-layer chain)
        v
update_job(status="COMPLETED", result={...})
task_done(job_id)
        |
        | WebSocket: execution_complete
        v
Frontend shows results in real-time
```

### What Works Today

- TestExecutorQueue with Redis and InMemory backends
- TestJob dataclass with full lifecycle tracking
- Worker process via `python -m app.workers.test_worker`
- WebSocket real-time progress (step_start, step_complete, screenshot, self_healing, execution_complete)
- Self-healing during execution via HealingOrchestrator
- Crash recovery: `restore_pending_jobs()` on worker restart (Redis only)

### Planned

- Horizontal auto-scaling of workers via Kubernetes HPA
- Priority queues (critical tests run first)
- Test sharding (split large suites across workers automatically)
- Cross-browser matrix execution (run same test on Chromium + Firefox + WebKit in parallel)
- Execution dashboard with per-worker utilization metrics

---

## 1. Architecture Options

### Option A: Playwright Cloud (Recommended for Start)

**Cost:** FREE for self-hosted, pay for cloud execution

```
┌─────────────────────────────────────────────────────────────┐
│                    QAAI SaaS Platform                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Submits Test Run                                       │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │           Test Orchestrator (Backend)            │        │
│  │  - Receives test queue                           │        │
│  │  - Distributes to workers                        │        │
│  │  - Collects results                              │        │
│  └─────────────────────────────────────────────────┘        │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │           Worker Pool (Docker Containers)        │        │
│  │                                                   │        │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐│        │
│  │  │Worker 1 │ │Worker 2 │ │Worker 3 │ │Worker N ││        │
│  │  │Playwright│ │Playwright│ │Playwright│ │Playwright│        │
│  │  │Chromium │ │Firefox  │ │WebKit  │ │Chromium ││        │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘│        │
│  └─────────────────────────────────────────────────┘        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**

```yaml
# docker-compose.parallel.yml
version: '3.8'

services:
  orchestrator:
    image: qaai-orchestrator:latest
    environment:
      - REDIS_URL=redis://redis:6379
      - WORKER_COUNT=4
    depends_on:
      - redis
    
  worker:
    image: mcr.microsoft.com/playwright:v1.40.0-jammy
    deploy:
      replicas: 4
    environment:
      - ORCHESTRATOR_URL=http://orchestrator:8000
    volumes:
      - ./tests:/tests
      - ./results:/results
    
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
```

**Cost Estimate:**
| Setup | Monthly Cost |
|-------|-------------|
| 4 workers on DigitalOcean | ~$80/mo |
| 8 workers on DigitalOcean | ~$160/mo |
| 4 workers on AWS ECS | ~$100/mo |
| Serverless (Lambda) | ~$50-200/mo (usage based) |

---

### Option B: Selenium Grid (Kubernetes)

**Cost:** Higher but more scalable

```
┌─────────────────────────────────────────────────────────────┐
│                  Kubernetes Cluster                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────┐          │
│  │             Selenium Grid Hub                  │          │
│  │  - Manages browser pool                        │          │
│  │  - Routes requests to nodes                    │          │
│  └───────────────────────────────────────────────┘          │
│              │                                               │
│    ┌─────────┼─────────┬─────────┬─────────┐                │
│    ▼         ▼         ▼         ▼         ▼                │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐               │
│  │Chrome│  │Chrome│  │Firefox│ │Firefox│ │Edge │               │
│  │Node 1│  │Node 2│  │Node 1│ │Node 2│ │Node 1│               │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘               │
│                                                              │
│  Auto-scaling: Min 2, Max 20 nodes                          │
└─────────────────────────────────────────────────────────────┘
```

**Helm Chart:**

```yaml
# helm/selenium-grid/values.yaml
hub:
  replicas: 1
  resources:
    requests:
      memory: "512Mi"
      cpu: "500m"

chromeNode:
  replicas: 4
  maxSessions: 2
  resources:
    requests:
      memory: "1Gi"
      cpu: "1"

firefoxNode:
  replicas: 2
  maxSessions: 2

autoscaling:
  enabled: true
  minReplicas: 2
  maxReplicas: 20
  targetCPUUtilization: 70
```

**Cost Estimate:**
| Setup | Monthly Cost |
|-------|-------------|
| GKE (4 nodes) | ~$200/mo |
| EKS (4 nodes) | ~$250/mo |
| AKS (4 nodes) | ~$180/mo |

---

### Option C: Serverless (Most Cost-Effective for Variable Load)

**Cost:** Pay per test execution

```
┌─────────────────────────────────────────────────────────────┐
│               Serverless Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Test Queue (SQS/Redis)                                      │
│         │                                                    │
│         ▼                                                    │
│  ┌─────────────────────────────────────────────────┐        │
│  │     AWS Lambda / Cloud Run / Azure Functions    │        │
│  │                                                   │        │
│  │  • Spawns on demand                              │        │
│  │  • Auto-scales to 1000s of concurrent tests     │        │
│  │  • Pay only when running                         │        │
│  │  • Uses headless browsers (Playwright)          │        │
│  └─────────────────────────────────────────────────┘        │
│         │                                                    │
│         ▼                                                    │
│  Results Storage (S3/GCS)                                    │
│  • Screenshots                                               │
│  • Videos                                                    │
│  • Logs                                                      │
│  • Reports                                                   │
└─────────────────────────────────────────────────────────────┘
```

**AWS Lambda Implementation:**

```python
# lambda_test_runner.py
import json
from playwright.sync_api import sync_playwright

def handler(event, context):
    test_config = json.loads(event['body'])
    
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()
        
        results = []
        for step in test_config['steps']:
            try:
                # Execute step
                result = execute_step(page, step)
                results.append(result)
            except Exception as e:
                results.append({'status': 'failed', 'error': str(e)})
                break
        
        browser.close()
    
    return {
        'statusCode': 200,
        'body': json.dumps({'results': results})
    }
```

**Cost Estimate:**
| Usage | Monthly Cost |
|-------|-------------|
| 1,000 tests/day | ~$30/mo |
| 10,000 tests/day | ~$150/mo |
| 100,000 tests/day | ~$800/mo |

---

## 2. Recommended Approach by Stage

### Stage 1: MVP (0-100 customers)
**Use: Docker Compose on single VPS**

```bash
# Start 4 parallel workers
docker-compose -f docker-compose.parallel.yml up -d --scale worker=4
```

**Cost:** $40-80/month
**Capacity:** ~500 parallel tests/hour

---

### Stage 2: Growth (100-1000 customers)
**Use: Kubernetes with auto-scaling**

```bash
# Deploy Selenium Grid
helm install selenium-grid selenium-chart/ -f values.yaml

# Or Playwright workers
kubectl apply -f playwright-workers.yaml
```

**Cost:** $200-500/month
**Capacity:** ~5,000 parallel tests/hour

---

### Stage 3: Scale (1000+ customers)
**Use: Hybrid (Serverless + Reserved Capacity)**

- Use Lambda/Cloud Run for burst traffic
- Keep base capacity on Kubernetes
- Multi-region deployment for latency

**Cost:** $500-2000/month (usage based)
**Capacity:** Unlimited (auto-scale)

---

## 3. Comparison with Competitors

| Feature | Sauce Labs | BrowserStack | QAAI (Self-Hosted) |
|---------|------------|--------------|-------------------|
| Parallel Tests | Unlimited* | Unlimited* | Configurable |
| Monthly Cost (100 tests/day) | $199+ | $199+ | ~$50 |
| Monthly Cost (1000 tests/day) | $899+ | $799+ | ~$150 |
| Monthly Cost (10000 tests/day) | $2999+ | $2499+ | ~$500 |
| Browser Support | All | All | Chromium, Firefox, WebKit |
| Mobile Emulation | ✅ | ✅ | ✅ (Playwright) |
| Real Devices | ✅ | ✅ | ❌ (Roadmap) |
| Video Recording | ✅ | ✅ | ✅ |
| Screenshots | ✅ | ✅ | ✅ |
| Network Throttling | ✅ | ✅ | ✅ |

*Subject to plan limits

---

## 4. Implementation Checklist

### Backend Changes Needed

- [ ] Test Queue Service (Redis-based)
- [ ] Worker Manager (orchestrates execution)
- [ ] Results Aggregator (collects from workers)
- [ ] Artifact Storage (screenshots, videos)
- [ ] WebSocket for real-time progress

### API Endpoints Needed

```python
# POST /api/parallel/queue
# Queue a batch of tests for parallel execution
{
  "tests": ["test-id-1", "test-id-2", ...],
  "workers": 4,
  "browser": "chromium",
  "headless": true
}

# GET /api/parallel/status/{run_id}
# Get real-time status of parallel run

# GET /api/parallel/results/{run_id}
# Get final results with artifacts
```

### Frontend Changes Needed

- [ ] Parallel run configuration UI
- [ ] Real-time progress dashboard
- [ ] Worker status visualization
- [ ] Results aggregation view

---

## 5. Quick Start for MVP

### Step 1: Create Worker Dockerfile

```dockerfile
# Dockerfile.worker
FROM mcr.microsoft.com/playwright:v1.40.0-jammy

WORKDIR /app
COPY worker.js .
COPY package.json .

RUN npm install

CMD ["node", "worker.js"]
```

### Step 2: Create Worker Script

```javascript
// worker.js
const { chromium } = require('playwright');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL);
const workerId = process.env.WORKER_ID || 'worker-1';

async function processTest(testConfig) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const results = [];
  
  for (const step of testConfig.steps) {
    const result = await executeStep(page, step);
    results.push(result);
    
    // Report progress
    await redis.publish('test-progress', JSON.stringify({
      testId: testConfig.id,
      stepIndex: results.length - 1,
      result
    }));
  }
  
  await browser.close();
  return results;
}

async function main() {
  console.log(`[${workerId}] Starting worker...`);
  
  while (true) {
    // Wait for test from queue
    const [, testJson] = await redis.brpop('test-queue', 0);
    const testConfig = JSON.parse(testJson);
    
    console.log(`[${workerId}] Processing: ${testConfig.name}`);
    
    try {
      const results = await processTest(testConfig);
      
      // Store results
      await redis.set(`results:${testConfig.id}`, JSON.stringify({
        status: 'completed',
        results
      }));
    } catch (error) {
      await redis.set(`results:${testConfig.id}`, JSON.stringify({
        status: 'error',
        error: error.message
      }));
    }
  }
}

main();
```

### Step 3: Deploy

```bash
# Build worker image
docker build -f Dockerfile.worker -t qaai-worker .

# Start Redis and workers
docker-compose -f docker-compose.parallel.yml up -d
```

---

## 6. Cost Optimization Tips

1. **Use Spot/Preemptible Instances** - 70% cheaper
2. **Auto-scale to Zero** - No cost when idle
3. **Regional Pricing** - Some regions are cheaper
4. **Headless Only** - Lower resource usage
5. **Test Batching** - Reuse browser sessions
6. **Caching** - Cache browser binaries, dependencies

---

## 7. Monitoring & Metrics

Track these metrics:

| Metric | Target |
|--------|--------|
| Tests/hour | >500 per worker |
| Avg test duration | <30s |
| Worker utilization | >70% |
| Queue wait time | <5s |
| Error rate | <1% |

---

*Document maintained by QAAI team. Last updated: January 31, 2026*
