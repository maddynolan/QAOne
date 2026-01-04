# 🚀 ArisTrace Performance Testing Architecture

**Version:** 1.0  
**Last Updated:** January 2026  
**Module:** Virtual User Generator (Perf Tab)

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Core Components](#core-components)
4. [Load Test Patterns](#load-test-patterns)
5. [User Personas](#user-personas)
6. [Quick Start Scenarios](#quick-start-scenarios)
7. [UI Tabs & Features](#ui-tabs--features)
8. [Metrics Collected](#metrics-collected)
9. [Test Configuration](#test-configuration)
10. [Data Flow](#data-flow)
11. [Integration Points](#integration-points)
12. [How to Use](#how-to-use)

---

## 📖 Overview

The ArisTrace Performance Testing module provides **enterprise-grade load testing** capabilities directly in the browser. Built with React and powered by a FastAPI backend, it enables:

- **Virtual User Simulation** - Simulate thousands of concurrent users
- **Multiple Load Patterns** - Constant, Ramp-up, Spike, Stress, Soak, and more
- **Real-time Metrics** - Live dashboards with response times, throughput, errors
- **HAR Import** - Import recorded network traffic for realistic scenarios
- **Protocol-Level Testing** - Direct HTTP/API testing without browser overhead
- **AI-Powered Analysis** - Intelligent performance insights and recommendations

---

## 🏗️ Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         ARISTRACE PERF MODULE                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │   Quick     │  │    HAR      │  │   Config    │  │   Steps     │   │
│  │   Start     │  │   Import    │  │   Tab       │  │   Tab       │   │
│  │   Tab       │  │   Tab       │  │             │  │             │   │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘   │
│         │                │                │                │          │
│         └────────────────┴────────┬───────┴────────────────┘          │
│                                   │                                    │
│                    ┌──────────────▼──────────────┐                    │
│                    │     Load Test Engine        │                    │
│                    │  ┌─────────────────────┐   │                    │
│                    │  │ Virtual User Pool   │   │                    │
│                    │  │  - User Spawning    │   │                    │
│                    │  │  - Think Time Sim   │   │                    │
│                    │  │  - Persona Behavior │   │                    │
│                    │  └─────────────────────┘   │                    │
│                    └──────────────┬──────────────┘                    │
│                                   │                                    │
│         ┌─────────────────────────┼─────────────────────────┐         │
│         │                         │                         │         │
│  ┌──────▼──────┐  ┌───────────────▼───────────────┐  ┌──────▼──────┐ │
│  │   Users     │  │        Metrics Tab            │  │  Results    │ │
│  │   Tab       │  │  ┌─────────────────────────┐ │  │  Tab        │ │
│  │             │  │  │ Real-time Dashboard     │ │  │             │ │
│  │ - Active VUs│  │  │ - Response Times        │ │  │ - Summary   │ │
│  │ - Status    │  │  │ - Throughput (RPS)      │ │  │ - Graphs    │ │
│  │ - Actions   │  │  │ - Error Rate            │ │  │ - Export    │ │
│  └─────────────┘  │  │ - Percentiles           │ │  └─────────────┘ │
│                    │  └─────────────────────────┘ │                   │
│                    └───────────────────────────────┘                   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BACKEND (FastAPI)                               │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Load Test  │  │   HAR       │  │  Metrics    │  │  AI         │   │
│  │  Executor   │  │   Parser    │  │  Collector  │  │  Analysis   │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         TARGET SYSTEM                                   │
│              (Your Application Under Test)                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 Core Components

### 1. Virtual User Generator (`VirtualUserGenerator.tsx`)
- **Purpose:** Main UI component for performance testing
- **Location:** `src/pages/VirtualUserGenerator.tsx`
- **Size:** ~2,500 lines of React/TypeScript

### 2. Load Test Engine
- **Purpose:** Orchestrates virtual users and executes load patterns
- **Features:**
  - Spawns/despawns virtual users dynamically
  - Applies think time and click delays
  - Handles ramp-up/ramp-down curves
  - Tracks per-user metrics

### 3. Metrics Collector
- **Purpose:** Aggregates and calculates performance statistics
- **Collected Data:**
  - Response times (min, max, avg, percentiles)
  - Throughput (requests/second)
  - Error rates
  - Bytes sent/received

### 4. HAR Parser
- **Purpose:** Import HTTP Archive files from browser recordings
- **Converts:** HAR entries to executable test steps

---

## 📊 Load Test Patterns

| Pattern | Icon | Description | Use Case |
|---------|------|-------------|----------|
| **Constant Load** | ➡️ | Maintain steady number of users | Baseline performance |
| **Ramp Up** | 📈 | Gradually increase users | Normal load testing |
| **Ramp Down** | 📉 | Gradually decrease users | Graceful degradation |
| **Spike Test** | ⚡ | Sudden burst of users | Flash sale simulation |
| **Stress Test** | 🔥 | Push beyond normal capacity | Find breaking point |
| **Soak/Endurance** | 🕐 | Extended duration test | Memory leak detection |
| **Breakpoint** | 💥 | Find system breaking point | Capacity planning |
| **Wave Pattern** | 🌊 | Cyclic load increases | Traffic pattern simulation |

### Pattern Visualization

```
Constant Load:      ────────────────────────
                    
Ramp Up:            ─────────────────/
                                    /
                                   /
                    ______________/

Spike Test:         _______/\______
                          /  \
                    _____/    \_____

Stress Test:               ___/
                          /
                    ─────/
                    
Wave Pattern:       ╱╲╱╲╱╲╱╲╱╲╱╲
```

---

## 👥 User Personas

Simulate different user behaviors with configurable timing:

| Persona | Think Time | Click Delay | Description |
|---------|------------|-------------|-------------|
| **Casual Browser** | 3-8 seconds | 500-2000ms | Slow, exploratory behavior |
| **Normal User** | 1-3 seconds | 200-800ms | Average interaction speed |
| **Power User** | 0.5-1.5 seconds | 100-400ms | Fast, experienced user |
| **Bot/Automated** | 100-500ms | 50-200ms | Machine-speed interactions |

---

## ⚡ Quick Start Scenarios

Pre-configured one-click scenarios for common testing needs:

| Scenario | Users | Duration | Pattern | Endpoints |
|----------|-------|----------|---------|-----------|
| 🚀 **API Load Test** | 50 | 60s | Ramp Up | Products, Categories, Health |
| ⚡ **Spike Test** | 200 | 120s | Spike | Products, Categories |
| 🔥 **Stress Test** | 500 | 180s | Stress | Products, Categories |
| 🕐 **Endurance Test** | 25 | 600s | Constant | All endpoints |
| 🌊 **Mixed Workload** | 100 | 300s | Wave | E-commerce flow |

---

## 🖥️ UI Tabs & Features

### Tab 1: Quick Start
- One-click scenario selection
- Target URL configuration
- Instant test launch

### Tab 2: HAR Import
- Upload HAR files from browser
- Parse recorded network traffic
- Convert to test steps automatically

### Tab 3: Config
- Load pattern selection
- Virtual users count
- Duration settings
- Ramp-up time
- User persona selection
- Think time toggle

### Tab 4: Steps
- View/edit test steps
- Add manual steps (navigate, click, type, wait, assert, API)
- Import from test library
- Step reordering

### Tab 5: Users
- Real-time virtual user status
- Active/idle/error states
- Per-user metrics
- User spawn/despawn visualization

### Tab 6: Metrics (Live Dashboard)
- **Response Time:** Min, Max, Avg
- **Throughput:** Requests/second
- **Error Rate:** Failures/second
- **Active Users:** Current count
- **Percentiles:** P50, P90, P95, P99
- **Data Transfer:** Bytes sent/received

### Tab 7: Results
- Test summary statistics
- Response time distribution
- Error breakdown
- Export to CSV/JSON
- Historical comparison

---

## 📈 Metrics Collected

### Response Time Metrics
```typescript
interface LoadTestMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;      // milliseconds
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;      // 50th percentile
  p90ResponseTime: number;      // 90th percentile
  p95ResponseTime: number;      // 95th percentile
  p99ResponseTime: number;      // 99th percentile
  requestsPerSecond: number;    // throughput
  activeUsers: number;
  errorsPerSecond: number;
  bytesReceived: number;
  bytesSent: number;
}
```

### Per-User Tracking
```typescript
interface VirtualUser {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  currentStep: number;
  completedIterations: number;
  errors: number;
  avgResponseTime: number;
  lastAction: string;
  startTime: Date;
}
```

---

## ⚙️ Test Configuration

```typescript
interface LoadTestConfig {
  name: string;              // Test name
  targetUrl: string;         // Base URL for requests
  virtualUsers: number;      // Number of concurrent users
  duration: number;          // Test duration in seconds
  rampUpTime: number;        // Time to reach full load
  pattern: string;           // Load pattern type
  persona: string;           // User behavior profile
  steps: TestStep[];         // Test steps to execute
  thinkTime: boolean;        // Enable think time simulation
  iterations: number;        // 0 = infinite until duration
}
```

---

## 🔄 Data Flow

```
1. USER CONFIGURES TEST
   └─► Select pattern, users, duration, steps

2. TEST STARTS
   └─► Virtual User Pool spawns users based on ramp-up
   
3. USERS EXECUTE STEPS
   └─► Each user executes test steps with persona timing
   └─► HTTP requests sent to target system
   
4. METRICS COLLECTED
   └─► Response times recorded per request
   └─► Aggregated in real-time
   
5. LIVE DASHBOARD UPDATES
   └─► Metrics tab shows real-time stats
   └─► Users tab shows individual status
   
6. TEST COMPLETES
   └─► Results tab shows summary
   └─► Export available (CSV, JSON)
```

---

## 🔌 Integration Points

### 1. Record Tab Integration
- Recorded browser sessions can be imported for performance testing
- Network traffic captured during recording becomes test steps

### 2. API Tab Integration
- API tests can be converted to load test scenarios
- Recorded HTTP requests available for import

### 3. Test Repository
- Import existing test cases as performance scenarios
- Filter by automation type

### 4. HAR Files
- Standard HTTP Archive format support
- Chrome/Firefox DevTools export compatibility

### 5. AI Analysis
- GPT-4o-mini powered performance insights
- Bottleneck identification
- Optimization recommendations

---

## 🎯 How to Use

### Quick Load Test (30 seconds)
1. Navigate to **Perf** tab
2. Enter your target URL
3. Click **Run** on "API Load Test" scenario
4. Watch metrics in real-time

### Custom Load Test
1. **Config** tab → Set users, duration, pattern
2. **Steps** tab → Add or import test steps
3. **Users** tab → Configure persona
4. Click **Start Test**
5. **Metrics** tab → Monitor live
6. **Results** tab → Analyze and export

### From HAR File
1. **HAR** tab → Upload HAR file
2. Review parsed requests
3. Configure load settings
4. Start test

### From Recorded Session
1. Record in **Record** tab (with network capture enabled)
2. Click **Send to Perf** (orange button)
3. Configure load parameters
4. Run performance test

---

## 📊 Performance Testing Best Practices

| Practice | Description |
|----------|-------------|
| **Start Small** | Begin with 5-10 users, scale up |
| **Baseline First** | Run constant load to establish baseline |
| **Isolate Variables** | Change one parameter at a time |
| **Monitor Server** | Check server CPU/memory alongside |
| **Realistic Personas** | Use appropriate think times |
| **Multiple Runs** | Run 3+ times for consistency |
| **Analyze Percentiles** | P95/P99 more important than avg |

---

## 🛠️ Technical Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + TypeScript |
| UI Framework | Tailwind CSS + Shadcn/UI |
| State Management | React Hooks (useState, useEffect) |
| Backend | FastAPI (Python) |
| HTTP Client | Fetch API / httpx |
| Charts | Recharts (planned) |
| AI | OpenAI GPT-4o-mini |

---

## 📁 File Structure

```
src/
├── pages/
│   └── VirtualUserGenerator.tsx    # Main Perf component (2,536 lines)
├── components/
│   └── ui/                         # Shared UI components
└── lib/
    └── api-config.ts               # API configuration

backend/
├── app/
│   ├── routers/
│   │   └── load_test_api.py        # Load test endpoints
│   └── services/
│       └── load_test_executor.py   # Test execution engine
```

---

## 📞 Support

For questions or issues with Performance Testing:
- Check the **Metrics** tab for real-time diagnostics
- Enable **AI Analysis** in Settings for intelligent recommendations
- Export results for offline analysis

---

*Document generated by ArisTrace Platform*  
*© 2026 ArisTrace - Excellence in Every QA Trace*

