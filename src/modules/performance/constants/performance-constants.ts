/**
 * Constants for the Performance testing page.
 */

import { API_BASE_URL } from '@/lib/api-config';

/** Flowstral.com production URL for website load testing */
export const FLOWSTRAL_WEBSITE_URL = "https://flowstral.com";

/** Flowstral backend API URL for API load testing (uses centralized API_BASE_URL) */
export const FLOWSTRAL_API_URL = API_BASE_URL;

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

/**
 * Flowstral.com Website Load Test Scenarios
 *
 * These scenarios target the live flowstral.com site (Vercel-hosted SPA)
 * and the Railway-hosted backend API. They simulate realistic user journeys:
 *
 * 1. Marketing Visitor — browses landing, pricing, blog, compare pages
 * 2. Backend API Health — hammers the Railway API health + core endpoints
 * 3. Conversion Funnel — landing → pricing → signup → download flow
 * 4. SEO Crawler — simulates search engine bots hitting all public pages
 * 5. Peak Traffic Spike — sudden spike on landing + pricing (Product Hunt/HN scenario)
 */
export const FLOWSTRAL_SCENARIOS = [
  {
    id: "flowstral_marketing",
    name: "🌐 Marketing Visitor",
    description: "Simulates organic visitors browsing flowstral.com: landing, pricing, blog, compare, about. Uses flowstral.com as base URL.",
    virtualUsers: 50,
    duration: 90,
    rampUp: 15,
    testType: "load",
    baseUrl: FLOWSTRAL_WEBSITE_URL,
    endpoints: [
      { method: "GET", path: "/", weight: 30 },
      { method: "GET", path: "/pricing", weight: 20 },
      { method: "GET", path: "/blog", weight: 15 },
      { method: "GET", path: "/compare/katalon", weight: 10 },
      { method: "GET", path: "/about", weight: 10 },
      { method: "GET", path: "/tools/cost-calculator", weight: 10 },
      { method: "GET", path: "/demo", weight: 5 },
    ]
  },
  {
    id: "flowstral_api_health",
    name: "🔌 Backend API Health",
    description: "Tests the Railway-hosted backend API: health check, dashboard, test-cases, accessibility endpoints. Uses Railway API URL.",
    virtualUsers: 30,
    duration: 60,
    rampUp: 10,
    testType: "load",
    baseUrl: FLOWSTRAL_API_URL,
    endpoints: [
      { method: "GET", path: "/health", weight: 40 },
      { method: "GET", path: "/api/performance/system-metrics", weight: 20 },
      { method: "GET", path: "/test-cases", weight: 15 },
      { method: "GET", path: "/dashboard/stats", weight: 15 },
      { method: "GET", path: "/api/ai-testing/status", weight: 10 },
    ]
  },
  {
    id: "flowstral_conversion",
    name: "🎯 Conversion Funnel",
    description: "Simulates the signup conversion path: landing → pricing → download → signup. Tests the critical revenue path.",
    virtualUsers: 40,
    duration: 60,
    rampUp: 10,
    testType: "load",
    baseUrl: FLOWSTRAL_WEBSITE_URL,
    endpoints: [
      { method: "GET", path: "/", weight: 30 },
      { method: "GET", path: "/pricing", weight: 25 },
      { method: "GET", path: "/download", weight: 20 },
      { method: "GET", path: "/signup", weight: 15 },
      { method: "GET", path: "/compare/selenium", weight: 10 },
    ]
  },
  {
    id: "flowstral_seo_crawler",
    name: "🤖 SEO Crawler Simulation",
    description: "Simulates search engine bots crawling all public pages, sitemap, and robots.txt. Tests Vercel CDN cache efficiency.",
    virtualUsers: 20,
    duration: 120,
    rampUp: 5,
    testType: "load",
    baseUrl: FLOWSTRAL_WEBSITE_URL,
    endpoints: [
      { method: "GET", path: "/", weight: 10 },
      { method: "GET", path: "/sitemap.xml", weight: 8 },
      { method: "GET", path: "/robots.txt", weight: 5 },
      { method: "GET", path: "/pricing", weight: 8 },
      { method: "GET", path: "/about", weight: 7 },
      { method: "GET", path: "/blog", weight: 8 },
      { method: "GET", path: "/demo", weight: 7 },
      { method: "GET", path: "/faq", weight: 7 },
      { method: "GET", path: "/compare/katalon", weight: 5 },
      { method: "GET", path: "/compare/selenium", weight: 5 },
      { method: "GET", path: "/compare/postman", weight: 5 },
      { method: "GET", path: "/compare/cypress", weight: 5 },
      { method: "GET", path: "/compare/tricentis", weight: 5 },
      { method: "GET", path: "/tools/cost-calculator", weight: 5 },
      { method: "GET", path: "/products/smart-recorder", weight: 5 },
      { method: "GET", path: "/download", weight: 5 },
    ]
  },
  {
    id: "flowstral_peak_spike",
    name: "🔥 Peak Traffic Spike",
    description: "Simulates sudden viral traffic (Product Hunt launch, Hacker News front page). 200 VUs hit landing + pricing in 5s ramp.",
    virtualUsers: 200,
    duration: 120,
    rampUp: 5,
    testType: "spike",
    baseUrl: FLOWSTRAL_WEBSITE_URL,
    endpoints: [
      { method: "GET", path: "/", weight: 45 },
      { method: "GET", path: "/pricing", weight: 25 },
      { method: "GET", path: "/download", weight: 15 },
      { method: "GET", path: "/about", weight: 10 },
      { method: "GET", path: "/signup", weight: 5 },
    ]
  },
];
