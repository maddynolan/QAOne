/**
 * Constants for VirtualUserGenerator page.
 */

// Load Test Patterns
export const LOAD_PATTERNS = {
  constant: {
    name: "Constant Load",
    icon: "\u27a1\ufe0f",
    description: "Maintain steady number of virtual users",
    color: "bg-blue-500"
  },
  ramp_up: {
    name: "Ramp Up",
    icon: "\ud83d\udcc8",
    description: "Gradually increase users over time",
    color: "bg-green-500"
  },
  ramp_down: {
    name: "Ramp Down",
    icon: "\ud83d\udcc9",
    description: "Gradually decrease users over time",
    color: "bg-orange-500"
  },
  spike: {
    name: "Spike Test",
    icon: "\u26a1",
    description: "Sudden burst of users to test resilience",
    color: "bg-red-500"
  },
  stress: {
    name: "Stress Test",
    icon: "\ud83d\udd25",
    description: "Push system beyond normal capacity",
    color: "bg-purple-500"
  },
  soak: {
    name: "Soak/Endurance",
    icon: "\ud83d\udd50",
    description: "Extended duration test for memory leaks",
    color: "bg-cyan-500"
  },
  breakpoint: {
    name: "Breakpoint",
    icon: "\ud83d\udca5",
    description: "Find system breaking point",
    color: "bg-pink-500"
  },
  wave: {
    name: "Wave Pattern",
    icon: "\ud83c\udf0a",
    description: "Cyclic load increases and decreases",
    color: "bg-indigo-500"
  }
} as const;

// User Personas
export const USER_PERSONAS = {
  casual: {
    name: "Casual Browser",
    thinkTime: { min: 3000, max: 8000 },
    clickDelay: { min: 500, max: 2000 },
    description: "Slow, exploratory user behavior"
  },
  normal: {
    name: "Normal User",
    thinkTime: { min: 1000, max: 3000 },
    clickDelay: { min: 200, max: 800 },
    description: "Average user interaction speed"
  },
  power: {
    name: "Power User",
    thinkTime: { min: 500, max: 1500 },
    clickDelay: { min: 100, max: 400 },
    description: "Fast, experienced user"
  },
  automated: {
    name: "Bot/Automated",
    thinkTime: { min: 100, max: 500 },
    clickDelay: { min: 50, max: 200 },
    description: "Machine-speed interactions"
  }
} as const;

// Quick Start API Scenarios - ONE CLICK to run (no Browser Flow here)
export const QUICK_START_SCENARIOS = [
  {
    id: "api_load",
    name: "API Load Test",
    icon: "\ud83d\ude80",
    description: "50 users hitting your API for 60 seconds",
    virtualUsers: 50,
    duration: 60,
    rampUp: 10,
    pattern: "ramp_up",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 20 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "spike_test",
    name: "Spike Test",
    icon: "\u26a1",
    description: "200 users sudden spike - test resilience",
    virtualUsers: 200,
    duration: 120,
    rampUp: 5,
    pattern: "spike",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/products/1", weight: 30 },
      { method: "GET", path: "/api/categories", weight: 20 },
    ]
  },
  {
    id: "stress_test",
    name: "Stress Test",
    icon: "\ud83d\udd25",
    description: "500 users - find breaking point",
    virtualUsers: 500,
    duration: 180,
    rampUp: 60,
    pattern: "stress",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products?limit=100", weight: 30 },
      { method: "GET", path: "/api/search?q=product", weight: 30 },
    ]
  },
  {
    id: "endurance_test",
    name: "Endurance Test",
    icon: "\u23f1\ufe0f",
    description: "30 users for 10 min - find memory leaks",
    virtualUsers: 30,
    duration: 600,
    rampUp: 30,
    pattern: "soak",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/categories", weight: 30 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "quick_smoke",
    name: "Quick Smoke Test",
    icon: "\ud83d\udca8",
    description: "5 users, 30 seconds - quick health check",
    virtualUsers: 5,
    duration: 30,
    rampUp: 5,
    pattern: "constant",
    endpoints: [
      { method: "GET", path: "/health", weight: 50 },
      { method: "GET", path: "/api/products", weight: 50 },
    ]
  }
] as const;

// Profile type mapping for backend
export const PROFILE_TYPE_MAP: Record<string, string> = {
  'constant': 'linear',
  'ramp_up': 'linear',
  'ramp_down': 'linear',
  'spike': 'spike',
  'stress': 'stress',
  'soak': 'endurance',
  'breakpoint': 'capacity',
  'wave': 'linear'
};

// Default load test metrics initial state
export const INITIAL_METRICS = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  avgResponseTime: 0,
  minResponseTime: 0,
  maxResponseTime: 0,
  p50ResponseTime: 0,
  p90ResponseTime: 0,
  p95ResponseTime: 0,
  p99ResponseTime: 0,
  requestsPerSecond: 0,
  activeUsers: 0,
  errorsPerSecond: 0,
  bytesReceived: 0,
  bytesSent: 0
} as const;
