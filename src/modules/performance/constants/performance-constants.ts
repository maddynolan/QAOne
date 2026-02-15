/**
 * Constants for the Performance testing page.
 */

/** Test website endpoint for quick-start scenarios */
export const ECOMMERCE_TEST_URL = "http://localhost:8002";

/** In-browser runner: quick validation only. For real load use Go runner or k6. */
export const MAX_BROWSER_VUS = 20;

/** Quick-start scenario presets for e-commerce testing */
export const QUICK_START_SCENARIOS = [
  {
    id: "api_load",
    name: "🚀 API Load Test",
    description: "Standard load test on REST API endpoints (products, categories)",
    virtualUsers: 50,
    duration: 60,
    rampUp: 10,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 20 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "spike_test",
    name: "⚡ Spike Test",
    description: "Sudden traffic spike to test system resilience",
    virtualUsers: 200,
    duration: 120,
    rampUp: 5,
    testType: "spike",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/products/1", weight: 30 },
      { method: "GET", path: "/api/categories", weight: 20 },
    ]
  },
  {
    id: "stress_test",
    name: "🔥 Stress Test",
    description: "Find the breaking point - gradually increase load until failure",
    virtualUsers: 500,
    duration: 180,
    rampUp: 60,
    testType: "stress",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 40 },
      { method: "GET", path: "/api/products?limit=100", weight: 30 },
      { method: "GET", path: "/api/search?q=product", weight: 30 },
    ]
  },
  {
    id: "endurance_test",
    name: "⏱️ Endurance Test",
    description: "Long-running test to find memory leaks and stability issues",
    virtualUsers: 30,
    duration: 600,
    rampUp: 30,
    testType: "endurance",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 50 },
      { method: "GET", path: "/api/categories", weight: 30 },
      { method: "GET", path: "/health", weight: 20 },
    ]
  },
  {
    id: "mixed_workload",
    name: "🔀 Mixed Workload",
    description: "Realistic user behavior with reads and writes",
    virtualUsers: 100,
    duration: 120,
    rampUp: 20,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/api/products", weight: 30 },
      { method: "GET", path: "/api/products/1", weight: 20 },
      { method: "GET", path: "/api/categories", weight: 15 },
      { method: "GET", path: "/api/search?q=test", weight: 15 },
      { method: "GET", path: "/api/performance/load?iterations=100", weight: 10 },
      { method: "GET", path: "/api/performance/delay/0.1", weight: 10 },
    ]
  },
  {
    id: "pwa_load",
    name: "📱 PWA Load",
    description: "Load test PWA start URL (document + shell). Use your PWA base URL in Custom Config.",
    virtualUsers: 30,
    duration: 60,
    rampUp: 10,
    testType: "load",
    endpoints: [
      { method: "GET", path: "/", weight: 80 },
      { method: "GET", path: "/manifest.json", weight: 10 },
      { method: "GET", path: "/service-worker.js", weight: 10 },
    ]
  }
];
