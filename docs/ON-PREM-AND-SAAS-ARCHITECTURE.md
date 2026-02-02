# QAAI Deployment Models: SaaS vs On-Prem

> **Purpose:** Architecture options for metrics collection across different deployment models

---

## 1. Deployment Model Comparison

| Aspect | Full SaaS | Hybrid (On-Prem Agent) | Full On-Prem |
|--------|-----------|------------------------|--------------|
| **Test Execution** | QAAI Cloud | Customer Server | Customer Server |
| **Results Storage** | QAAI Cloud | QAAI Cloud | Customer Server |
| **Dashboard** | QAAI Cloud | QAAI Cloud | Customer Network |
| **Setup Complexity** | None | Low | High |
| **Data Privacy** | Standard | High | Maximum |
| **Typical Users** | SMB, Startups | Mid-Market | Enterprise, Regulated |

---

## 2. How Other Tools Do It

### ReportPortal Model
```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Environment                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  Test Framework │     │     ReportPortal Agent      │   │
│  │  (pytest, etc)  │────▶│  - Collects results         │   │
│  └─────────────────┘     │  - Formats JSON             │   │
│                          │  - Sends via HTTP/HTTPS     │   │
│                          └───────────────┬─────────────┘   │
│                                          │                  │
└──────────────────────────────────────────┼──────────────────┘
                                           │
                              HTTPS (Results Only)
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    ReportPortal Cloud                        │
│  - Dashboard                                                 │
│  - Analytics                                                 │
│  - Defect Tracking                                          │
│  - AI Analysis                                              │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Only **results/metrics** leave customer network
- No source code or test scripts transmitted
- Agent is a simple config (pip install reportportal-client)

### Sauce Labs / BrowserStack Model
```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Environment                      │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐                                        │
│  │   CI/CD System  │  (Jenkins, GitHub Actions, etc)        │
│  │                 │                                        │
│  │  1. Trigger     │────────────────────────────────────────┤
│  │     Test Run    │                                        │
│  └─────────────────┘                                        │
└──────────────────────────────────────────────────────────────┘
                              │
           Sauce Connect Tunnel (Secure)
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Sauce Labs Cloud                          │
│  - Execute tests on cloud browsers                          │
│  - Record videos, screenshots                               │
│  - Store results                                            │
│  - Dashboard & Analytics                                    │
└─────────────────────────────────────────────────────────────┘
```

**Key Points:**
- Tests execute on cloud infrastructure
- Customer uses "Sauce Connect" tunnel for private apps
- All data stored in cloud

### Datadog / APM Model (Most Flexible)
```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Environment                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐     ┌─────────────────────────────┐   │
│  │  Application    │     │     Datadog Agent           │   │
│  │  + Tests        │────▶│  - Lightweight daemon       │   │
│  └─────────────────┘     │  - Collects metrics         │   │
│                          │  - API Key auth             │   │
│                          │  - Configurable what to send│   │
│                          └───────────────┬─────────────┘   │
└──────────────────────────────────────────┼──────────────────┘
                                           │
                           HTTPS (API Key Auth)
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       Datadog Cloud                          │
│  - Dashboards                                               │
│  - Alerts                                                   │
│  - Analytics                                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. QAAI Recommended Architecture

### Option A: Full SaaS (Simplest)

```
┌─────────────────────────────────────────────────────────────┐
│                         QAAI Cloud                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              QAAI Web Platform                       │   │
│  │  - Record Tests                                      │   │
│  │  - Execute on Cloud Browsers                         │   │
│  │  - View Results & Analytics                          │   │
│  │  - Manage Defects                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Parallel Execution Grid                 │   │
│  │  - Docker workers                                    │   │
│  │  - Auto-scaling                                      │   │
│  │  - Multi-browser support                             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Pros:** Zero setup, always updated, scales automatically  
**Cons:** Data in cloud, requires internet

---

### Option B: Hybrid Model (ReportPortal-Style) - RECOMMENDED

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Environment                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 QAAI Desktop App                       │  │
│  │  - Record tests locally                               │  │
│  │  - Execute on local browsers                          │  │
│  │  - Test against internal apps (no tunnel needed)      │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
│                          │ Results Only                      │
│                          │ (JSON, ~1KB per test)            │
│                          ▼                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              QAAI Results Agent                        │  │
│  │                                                        │  │
│  │  Config (qaai-agent.yaml):                            │  │
│  │  ┌──────────────────────────────────────────────────┐ │  │
│  │  │ api_key: "customer-api-key-xxx"                  │ │  │
│  │  │ endpoint: "https://api.qaai.cloud/v1/results"    │ │  │
│  │  │ # What to send                                   │ │  │
│  │  │ send_screenshots: true                           │ │  │
│  │  │ send_videos: false  # Optional                   │ │  │
│  │  │ send_logs: true                                  │ │  │
│  │  │ anonymize_data: true  # Strip PII                │ │  │
│  │  └──────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────┘  │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
          HTTPS (Outbound only, encrypted)
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                       QAAI Cloud                             │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Results Ingestion API                   │   │
│  │  POST /api/v1/results                               │   │
│  │  - Validates API key                                │   │
│  │  - Stores in customer tenant                        │   │
│  │  - Triggers analytics                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              QAAI Dashboard (Web)                    │   │
│  │  - View all results                                 │   │
│  │  - Analytics & trends                               │   │
│  │  - Flaky test detection                             │   │
│  │  - Team collaboration                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Implementation Required:**

1. **Results Agent (Client-side)**

```javascript
// qaai-results-agent.js (runs on customer side)
const axios = require('axios');
const fs = require('fs');

class QAAIResultsAgent {
  constructor(config) {
    this.apiKey = config.api_key;
    this.endpoint = config.endpoint || 'https://api.qaai.cloud/v1/results';
    this.sendScreenshots = config.send_screenshots !== false;
    this.sendVideos = config.send_videos || false;
    this.anonymize = config.anonymize_data || false;
  }

  async sendResults(testRun) {
    // Prepare payload
    const payload = {
      test_name: testRun.name,
      timestamp: testRun.timestamp,
      duration: testRun.duration,
      status: testRun.status,
      steps: testRun.steps.map(step => ({
        name: step.name,
        status: step.status,
        duration: step.duration,
        error: step.error,
        // Only send screenshot if configured
        screenshot: this.sendScreenshots ? step.screenshot : null
      })),
      metadata: {
        browser: testRun.browser,
        os: testRun.os,
        viewport: testRun.viewport
      }
    };

    // Anonymize if needed
    if (this.anonymize) {
      payload = this.anonymizePayload(payload);
    }

    // Send to QAAI cloud
    try {
      const response = await axios.post(this.endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`[QAAI Agent] Results sent: ${response.data.id}`);
      return response.data;
    } catch (error) {
      console.error(`[QAAI Agent] Failed to send: ${error.message}`);
      // Store locally for retry
      this.storeForRetry(payload);
    }
  }

  anonymizePayload(payload) {
    // Remove potential PII
    const sensitivePatterns = [
      /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // emails
      /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
      /\b\d{16}\b/g, // credit cards
    ];
    
    let json = JSON.stringify(payload);
    sensitivePatterns.forEach(pattern => {
      json = json.replace(pattern, '[REDACTED]');
    });
    
    return JSON.parse(json);
  }
}

module.exports = QAAIResultsAgent;
```

2. **Cloud Ingestion API (Server-side)**

```python
# backend/app/api/results_ingestion.py
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class TestStep(BaseModel):
    name: str
    status: str
    duration: Optional[float]
    error: Optional[str]
    screenshot: Optional[str]

class TestRunPayload(BaseModel):
    test_name: str
    timestamp: str
    duration: float
    status: str
    steps: List[TestStep]
    metadata: dict

@router.post("/v1/results")
async def ingest_results(
    payload: TestRunPayload,
    authorization: str = Header(...)
):
    # Validate API key
    api_key = authorization.replace("Bearer ", "")
    tenant = await validate_api_key(api_key)
    
    if not tenant:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    # Store results in tenant's data partition
    result_id = await store_test_result(tenant.id, payload)
    
    # Trigger analytics
    await trigger_analytics(tenant.id, result_id)
    
    return {"id": result_id, "status": "received"}
```

---

### Option C: Full On-Prem (Air-Gapped)

```
┌─────────────────────────────────────────────────────────────┐
│                    Customer Data Center                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                 QAAI Full Stack                        │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │   Frontend   │  │   Backend    │  │   Database   │ │  │
│  │  │   (React)    │  │  (FastAPI)   │  │  (Postgres)  │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │  │
│  │  │    Redis     │  │  MinIO/S3    │  │  Playwright  │ │  │
│  │  │   (Queue)    │  │  (Artifacts) │  │   Workers    │ │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │  │
│  │                                                        │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              QAAI Desktop Apps                         │  │
│  │  - Connect to internal QAAI server                    │  │
│  │  - All data stays on-prem                             │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│                    NO EXTERNAL CONNECTIONS                   │
└─────────────────────────────────────────────────────────────┘
```

**On-Prem Deployment (Docker Compose):**

```yaml
# docker-compose.on-prem.yml
version: '3.8'

services:
  frontend:
    image: qaai-frontend:${VERSION}
    ports:
      - "80:80"
      - "443:443"
    environment:
      - VITE_API_URL=http://backend:8000
    
  backend:
    image: qaai-backend:${VERSION}
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://qaai:${DB_PASSWORD}@postgres:5432/qaai
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
      - LICENSE_KEY=${LICENSE_KEY}  # Offline license validation
    depends_on:
      - postgres
      - redis
      - minio
    
  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=qaai
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=qaai
      
  redis:
    image: redis:alpine
    volumes:
      - redis_data:/data
      
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data
    environment:
      - MINIO_ROOT_USER=qaai
      - MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
      
  worker:
    image: qaai-worker:${VERSION}
    deploy:
      replicas: ${WORKER_COUNT:-4}
    environment:
      - REDIS_URL=redis://redis:6379
      - S3_ENDPOINT=http://minio:9000
    depends_on:
      - redis

volumes:
  postgres_data:
  redis_data:
  minio_data:
```

**License Management for On-Prem:**

```python
# backend/app/license/offline_validator.py
import hashlib
import json
from datetime import datetime
from cryptography.fernet import Fernet

class OfflineLicenseValidator:
    """Validates license without internet connection"""
    
    def __init__(self, public_key: str):
        self.public_key = public_key
    
    def validate_license(self, license_key: str) -> dict:
        """
        License key format: base64(encrypted_json)
        JSON: {
            "customer_id": "xxx",
            "features": ["parallel", "api", "performance"],
            "max_users": 50,
            "expires": "2027-01-01",
            "signature": "xxx"
        }
        """
        try:
            # Decrypt license
            license_data = self.decrypt_license(license_key)
            
            # Verify signature
            if not self.verify_signature(license_data):
                return {"valid": False, "error": "Invalid signature"}
            
            # Check expiration
            if datetime.fromisoformat(license_data["expires"]) < datetime.now():
                return {"valid": False, "error": "License expired"}
            
            return {
                "valid": True,
                "features": license_data["features"],
                "max_users": license_data["max_users"],
                "expires": license_data["expires"]
            }
        except Exception as e:
            return {"valid": False, "error": str(e)}
    
    def decrypt_license(self, license_key: str) -> dict:
        f = Fernet(self.public_key)
        decrypted = f.decrypt(license_key.encode())
        return json.loads(decrypted)
    
    def verify_signature(self, data: dict) -> bool:
        signature = data.pop("signature", None)
        expected = hashlib.sha256(
            json.dumps(data, sort_keys=True).encode()
        ).hexdigest()
        return signature == expected
```

---

## 4. Metrics Collection - Like ReportPortal

### Simple Configuration Approach

**Customer Setup (5 minutes):**

```yaml
# ~/.qaai/config.yaml (or via desktop app settings)
cloud:
  enabled: true
  api_key: "qk_live_xxxxxxxxxxxx"
  endpoint: "https://api.qaai.cloud"
  
reporting:
  # What to send to cloud
  send_results: true
  send_screenshots: true  # ~50KB each
  send_videos: false      # ~5MB each, optional
  send_logs: true         # ~10KB per test
  
  # Privacy options
  anonymize_pii: true
  redact_patterns:
    - "password"
    - "secret"
    - "api[_-]?key"
    
  # Offline mode
  offline_queue: true     # Queue results when offline
  max_queue_size: 1000    # Max results to queue
  
execution:
  # Where tests run
  local: true             # Tests run on customer machine
  # OR
  cloud: false            # Tests run on QAAI cloud
```

### What Gets Sent (Transparent)

```json
{
  "test_run": {
    "id": "run_abc123",
    "name": "Login Test Suite",
    "timestamp": "2026-01-31T10:30:00Z",
    "duration_ms": 45000,
    "status": "passed"
  },
  "results": [
    {
      "test_name": "Valid Login",
      "status": "passed",
      "duration_ms": 12000,
      "steps": [
        {"action": "navigate", "target": "[REDACTED URL]", "status": "passed"},
        {"action": "fill", "target": "#email", "status": "passed"},
        {"action": "click", "target": "button[type=submit]", "status": "passed"}
      ]
    }
  ],
  "metadata": {
    "browser": "chromium",
    "os": "Windows 10",
    "viewport": "1920x1080",
    "agent_version": "1.2.0"
  }
}
```

**What's NOT sent:**
- Source code
- Test scripts
- Full URLs (redacted)
- User credentials
- Internal network info

---

## 5. Pricing Model Suggestion

| Tier | Deployment | Test Runs/Month | Price |
|------|------------|-----------------|-------|
| **Free** | SaaS | 500 | $0 |
| **Team** | SaaS | 5,000 | $49/mo |
| **Pro** | SaaS + Desktop | 25,000 | $199/mo |
| **Business** | Hybrid Agent | 100,000 | $499/mo |
| **Enterprise** | On-Prem | Unlimited | Custom |

---

## 6. Implementation Priority

### Phase 1: Results Agent (Week 1)
- [ ] Create QAAI Results Agent (npm package / Python package)
- [ ] Add cloud ingestion API endpoint
- [ ] Dashboard to view ingested results

### Phase 2: Configuration UI (Week 2)
- [ ] Settings page for cloud sync config
- [ ] API key management
- [ ] Privacy controls UI

### Phase 3: On-Prem Package (Week 3-4)
- [ ] Air-gapped Docker Compose
- [ ] Offline license validation
- [ ] Installation documentation

---

*Document maintained by QAAI team. Last updated: January 31, 2026*
