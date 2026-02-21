/**
 * Comparison Page — Dynamic "Flowstral vs X" pages for bottom-of-funnel SEO
 *
 * Route: /compare/:competitor  (e.g. /compare/katalon, /compare/selenium)
 * Each competitor has its own data config; the page renders a unified comparison layout.
 */

import React, { useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { trackCTAClick, trackEvent } from '@/lib/web-analytics';
import {
  ArrowRight, Check, X, Minus, Rocket, Building2, Zap,
  Shield, Globe, Eye, Gauge, Smartphone, Accessibility,
  Code, BarChart3, Bot, Layers, Cable
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Competitor Data ────────────────────────────────────────────────────────

interface CompetitorConfig {
  name: string;
  tagline: string;
  description: string;
  typicalCost: string;
  category: string;
  limitations: string[];
  comparison: {
    feature: string;
    flowstral: 'yes' | 'partial' | 'no';
    competitor: 'yes' | 'partial' | 'no';
    note?: string;
  }[];
  switchReasons: string[];
  seoTitle: string;
  seoDescription: string;
}

const competitors: Record<string, CompetitorConfig> = {
  katalon: {
    name: 'Katalon',
    tagline: 'Katalon covers 4 testing types. Flowstral covers 8.',
    description: 'Katalon is a popular test automation tool with web, API, mobile, and desktop testing. But it lacks performance testing, visual regression, accessibility scanning, and Salesforce-native tools — forcing teams to add 3-4 extra tools.',
    typicalCost: '$15K-60K/year',
    category: 'Test Automation',
    limitations: [
      'No built-in load/performance testing — need JMeter or k6 separately',
      'No visual regression testing — need Applitools or Percy',
      'No accessibility scanning — need Axe or WAVE',
      'No Salesforce-native testing tools',
      'AI features require cloud subscription',
      'Groovy-based scripting has steep learning curve',
    ],
    comparison: [
      { feature: 'Browser Test Recording', flowstral: 'yes', competitor: 'yes' },
      { feature: 'No-Code Visual Builder', flowstral: 'yes', competitor: 'partial', note: 'Katalon has manual/keyword mode but less visual' },
      { feature: 'API Testing (REST/GraphQL)', flowstral: 'yes', competitor: 'yes' },
      { feature: 'API Testing (SOAP/gRPC/Kafka/MQTT)', flowstral: 'partial', competitor: 'no', note: 'SOAP via HTTP; gRPC/Kafka/MQTT on roadmap' },
      { feature: 'Performance / Load Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Visual Regression Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Accessibility (WCAG) Scanning', flowstral: 'yes', competitor: 'no' },
      { feature: 'Mobile Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Salesforce Native Tools', flowstral: 'yes', competitor: 'no' },
      { feature: 'AI Self-Healing Locators', flowstral: 'yes', competitor: 'partial', note: 'Katalon SmartWait is basic' },
      { feature: 'Cross-Browser (Chromium/Firefox/WebKit)', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Desktop App (Offline)', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Free Tier (Forever)', flowstral: 'yes', competitor: 'partial', note: 'Katalon Free has limitations' },
      { feature: 'On-Premises Deployment', flowstral: 'yes', competitor: 'yes' },
    ],
    switchReasons: [
      'Consolidate 4+ tools into one platform',
      'Add performance testing without JMeter',
      'Get visual regression testing built-in',
      'Test Salesforce with native SF tools',
      'Escape Groovy scripting — use visual builder instead',
    ],
    seoTitle: 'Flowstral vs Katalon (2026) — Feature Comparison',
    seoDescription: 'Compare Flowstral and Katalon side by side. See why teams switch from Katalon to get built-in performance testing, visual regression, accessibility scanning, and Salesforce tools.',
  },

  selenium: {
    name: 'Selenium',
    tagline: 'Selenium automates browsers. Flowstral automates your entire QA process.',
    description: 'Selenium is the most widely-used browser automation framework. But it requires coding expertise, has no built-in test management, and teams need 5+ additional tools for API testing, performance, visual regression, and accessibility.',
    typicalCost: '$0 (OSS) + $50K-150K in engineering time',
    category: 'Browser Automation Framework',
    limitations: [
      'Code-only — no visual builder or recorder for non-developers',
      'No built-in test management, reporting, or dashboards',
      'No API testing — need Postman or REST Assured separately',
      'No performance testing — need JMeter, k6, or Gatling',
      'No visual regression — need Applitools or BackstopJS',
      'No accessibility testing — need Axe or Pa11y',
      'Flaky tests are the #1 complaint — no self-healing',
      'No mobile testing — need Appium separately',
    ],
    comparison: [
      { feature: 'Browser Automation', flowstral: 'yes', competitor: 'yes' },
      { feature: 'No-Code Visual Builder', flowstral: 'yes', competitor: 'no' },
      { feature: 'Smart Recording', flowstral: 'yes', competitor: 'no', note: 'Selenium IDE exists but limited' },
      { feature: 'AI Self-Healing Locators', flowstral: 'yes', competitor: 'no' },
      { feature: 'Test Management (Cases/Suites/Plans)', flowstral: 'yes', competitor: 'no' },
      { feature: 'API Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Performance Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Visual Regression Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Accessibility Scanning', flowstral: 'yes', competitor: 'no' },
      { feature: 'Mobile Testing', flowstral: 'yes', competitor: 'no', note: 'Appium is separate project' },
      { feature: 'Salesforce Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Cross-Browser', flowstral: 'yes', competitor: 'yes' },
      { feature: 'CI/CD Integration', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Requires Coding', flowstral: 'no', competitor: 'yes', note: 'Flowstral: optional. Selenium: required.' },
    ],
    switchReasons: [
      'Empower manual testers to create automated tests without code',
      'Eliminate flaky tests with 4-layer AI self-healing',
      'Replace 5+ separate tools with one platform',
      'Get built-in test management and reporting',
      'Stop spending engineering time on framework maintenance',
    ],
    seoTitle: 'Flowstral vs Selenium (2026) — Why Teams Are Switching',
    seoDescription: 'Compare Flowstral and Selenium side by side. No-code test builder, built-in API/performance/visual/accessibility testing, and AI self-healing. Free to start.',
  },

  postman: {
    name: 'Postman',
    tagline: 'Postman tests APIs. Flowstral tests everything.',
    description: 'Postman is the most popular API testing tool. But it only handles API testing — teams need 4-6 additional tools for browser automation, performance testing, visual regression, accessibility, and mobile testing.',
    typicalCost: '$10K-25K/year (Team/Enterprise)',
    category: 'API Testing',
    limitations: [
      'API-only — no browser test automation',
      'No visual regression testing',
      'No accessibility scanning',
      'No mobile testing',
      'No Salesforce-specific testing',
      'Performance testing is limited (no virtual user simulation)',
      'No test management with cases/suites/plans',
      'No self-healing locators (irrelevant for API-only)',
    ],
    comparison: [
      { feature: 'REST API Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'GraphQL Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'gRPC Testing', flowstral: 'partial', competitor: 'partial', note: 'Flowstral: on roadmap; Postman: beta' },
      { feature: 'SOAP/WSDL Testing', flowstral: 'partial', competitor: 'partial', note: 'Flowstral: SOAP via HTTP; no WSDL auto-discovery' },
      { feature: 'Kafka/MQTT/AMQP Testing', flowstral: 'partial', competitor: 'no', note: 'Flowstral: on roadmap' },
      { feature: 'WebSocket Testing', flowstral: 'partial', competitor: 'yes', note: 'Flowstral: basic support via Playwright' },
      { feature: 'Request Chaining', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Environment Variables', flowstral: 'yes', competitor: 'yes' },
      { feature: 'JSON Schema Validation', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Browser Test Automation', flowstral: 'yes', competitor: 'no' },
      { feature: 'Performance / Load Testing', flowstral: 'yes', competitor: 'partial', note: 'Postman limited to collection runner' },
      { feature: 'Visual Regression Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Accessibility Scanning', flowstral: 'yes', competitor: 'no' },
      { feature: 'Mobile Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Salesforce Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Test Management', flowstral: 'yes', competitor: 'no' },
    ],
    switchReasons: [
      'Keep API testing AND add browser, performance, visual, accessibility testing',
      'REST + GraphQL with request chaining, mocks, and schema validation',
      'Run real load tests with 100+ server-side virtual users',
      'Unified test management across all testing types',
      'One platform for your entire QA team, not just API developers',
    ],
    seoTitle: 'Flowstral vs Postman (2026) — Full QA Platform Comparison',
    seoDescription: 'Compare Flowstral and Postman. Flowstral includes everything Postman does for API testing, plus browser automation, performance, visual, accessibility, mobile, and Salesforce testing.',
  },

  cypress: {
    name: 'Cypress',
    tagline: 'Cypress is fast at E2E. Flowstral is fast at everything.',
    description: 'Cypress is a popular JavaScript-based E2E testing framework known for its developer experience. But it requires coding, only supports Chromium-based browsers, and lacks API testing, performance, visual regression, and accessibility features.',
    typicalCost: '$0 (OSS) + $75/mo-$300/mo (Cloud)',
    category: 'E2E Testing Framework',
    limitations: [
      'JavaScript/TypeScript only — excludes non-JS teams',
      'Chromium-only for most of its history (Firefox/WebKit experimental)',
      'No built-in API testing suite',
      'No performance/load testing',
      'No visual regression testing (need plugin)',
      'No accessibility scanning',
      'No mobile testing',
      'No test management or reporting dashboard',
      'No Salesforce-specific tools',
    ],
    comparison: [
      { feature: 'Browser E2E Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'No-Code Test Creation', flowstral: 'yes', competitor: 'no' },
      { feature: 'Cross-Browser (Chrome/Firefox/WebKit)', flowstral: 'yes', competitor: 'partial', note: 'Cypress WebKit is experimental' },
      { feature: 'AI Self-Healing', flowstral: 'yes', competitor: 'no' },
      { feature: 'API Testing (Multi-Protocol)', flowstral: 'yes', competitor: 'no' },
      { feature: 'Performance Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Visual Regression', flowstral: 'yes', competitor: 'no', note: 'Needs third-party plugin' },
      { feature: 'Accessibility Scanning', flowstral: 'yes', competitor: 'no' },
      { feature: 'Mobile Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Salesforce Testing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Test Management', flowstral: 'yes', competitor: 'no' },
      { feature: 'Time Travel Debugging', flowstral: 'no', competitor: 'yes' },
      { feature: 'Desktop App (Offline)', flowstral: 'yes', competitor: 'no' },
      { feature: 'Requires Coding', flowstral: 'no', competitor: 'yes' },
    ],
    switchReasons: [
      'Empower non-JavaScript team members to create tests',
      'Get full cross-browser support including WebKit (Safari)',
      'Add API, performance, visual, and accessibility testing',
      'Built-in test management instead of separate tools',
      'Self-healing locators eliminate the #1 cause of flaky tests',
    ],
    seoTitle: 'Flowstral vs Cypress (2026) — Complete Testing Comparison',
    seoDescription: 'Compare Flowstral and Cypress for test automation. No-code builder, 8 testing types, cross-browser support, and AI self-healing vs JavaScript-only E2E.',
  },

  tricentis: {
    name: 'Tricentis',
    tagline: 'Tricentis costs $300K+. Flowstral starts free.',
    description: 'Tricentis (Tosca + Testim) is a heavyweight enterprise testing platform with a $300K+ annual price tag. It offers strong SAP testing but is complex to deploy, has expensive licensing, and requires VBScript for advanced customization.',
    typicalCost: '$150K-500K/year',
    category: 'Enterprise Testing Suite',
    limitations: [
      'Extremely expensive — $150K-500K/year licensing',
      'Complex deployment and long setup cycles',
      'VBScript required for advanced Tosca customization',
      'Upgrade process is painful and time-consuming',
      'Support response times can be days, not hours',
      'Separate products (Tosca, Testim, NeoLoad) not fully unified',
      'No free tier — only expensive POCs',
    ],
    comparison: [
      { feature: 'Browser Automation', flowstral: 'yes', competitor: 'yes' },
      { feature: 'No-Code Test Builder', flowstral: 'yes', competitor: 'yes' },
      { feature: 'API Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Performance Testing', flowstral: 'yes', competitor: 'yes', note: 'NeoLoad — separate product' },
      { feature: 'Visual Regression', flowstral: 'yes', competitor: 'partial' },
      { feature: 'Accessibility Scanning', flowstral: 'yes', competitor: 'no' },
      { feature: 'Mobile Testing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Salesforce Testing', flowstral: 'yes', competitor: 'partial', note: 'Tosca has SAP focus, not SF' },
      { feature: 'AI Self-Healing', flowstral: 'yes', competitor: 'yes' },
      { feature: 'Free Tier', flowstral: 'yes', competitor: 'no' },
      { feature: 'Simple Deployment', flowstral: 'yes', competitor: 'no', note: 'Flowstral: install and go' },
      { feature: 'Transparent Pricing', flowstral: 'yes', competitor: 'no' },
      { feature: 'Fast Support', flowstral: 'yes', competitor: 'partial' },
      { feature: 'On-Premises', flowstral: 'yes', competitor: 'yes' },
    ],
    switchReasons: [
      'Save $100K-400K/year in licensing costs',
      'Deploy in hours, not months',
      'No VBScript — visual builder + optional code',
      'Transparent pricing with free tier to evaluate first',
      'Unified platform vs 3 separate Tricentis products',
    ],
    seoTitle: 'Flowstral vs Tricentis (2026) — Save 80%+ on Enterprise Testing',
    seoDescription: 'Compare Flowstral and Tricentis Tosca/Testim. Get 8 testing types in one unified platform at a fraction of the cost. Free tier available.',
  },
};

// ── Status Icon Helper ─────────────────────────────────────────────────────

function StatusIcon({ status, className }: { status: 'yes' | 'partial' | 'no'; className?: string }) {
  if (status === 'yes') return <Check className={cn('w-5 h-5 text-emerald-500', className)} />;
  if (status === 'partial') return <Minus className={cn('w-5 h-5 text-amber-500', className)} />;
  return <X className={cn('w-5 h-5 text-red-400', className)} />;
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function ComparePage() {
  const { competitor: slug } = useParams<{ competitor: string }>();
  const navigate = useNavigate();
  const config = slug ? competitors[slug] : undefined;

  useEffect(() => {
    if (config) {
      document.title = config.seoTitle;
      const desc = document.querySelector('meta[name="description"]');
      if (desc) desc.setAttribute('content', config.seoDescription);
      trackEvent('compare_view', { competitor: config.name });
    }
  }, [config]);

  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Comparison Not Found</h1>
          <p className="text-slate-600 mb-6">We don't have a comparison for that tool yet.</p>
          <div className="flex flex-wrap gap-3 justify-center">
            {Object.entries(competitors).map(([key, c]) => (
              <Button key={key} variant="outline" onClick={() => navigate(`/compare/${key}`)}>
                vs {c.name}
              </Button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-bold text-slate-800">Flowstral</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
              <Link to="/compare/katalon" className="text-sm text-blue-600 font-semibold">Compare</Link>
              <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Blog</Link>
              <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { trackCTAClick('sign_in', `/compare/${slug}`); navigate('/signin'); }}>Sign In</Button>
            <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" onClick={() => { trackCTAClick('start_free', `/compare/${slug}`); navigate('/signup'); }}>
              Start Free <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-blue-50 text-blue-700 border-blue-200">
            Comparison
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Flowstral vs {config.name}
          </h1>
          <p className="text-xl text-slate-600 mb-2">{config.tagline}</p>
          <p className="text-sm text-slate-400">
            {config.name} typical cost: {config.typicalCost} &middot; Category: {config.category}
          </p>
        </div>
      </section>

      {/* Overview */}
      <section className="pb-12 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-lg text-slate-700 leading-relaxed">{config.description}</p>
        </div>
      </section>

      {/* Comparison Table */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Feature-by-Feature Comparison</h2>
          <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-[1fr,100px,100px] sm:grid-cols-[1fr,140px,140px] bg-slate-50 border-b border-slate-200 px-4 py-3">
              <span className="text-sm font-semibold text-slate-700">Feature</span>
              <span className="text-sm font-semibold text-blue-600 text-center">Flowstral</span>
              <span className="text-sm font-semibold text-slate-500 text-center">{config.name}</span>
            </div>
            {config.comparison.map((row, i) => (
              <div key={i} className={cn(
                'grid grid-cols-[1fr,100px,100px] sm:grid-cols-[1fr,140px,140px] px-4 py-3 border-b border-slate-100 last:border-0',
                i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
              )}>
                <div>
                  <span className="text-sm text-slate-700">{row.feature}</span>
                  {row.note && <span className="block text-xs text-slate-400 mt-0.5">{row.note}</span>}
                </div>
                <div className="flex justify-center"><StatusIcon status={row.flowstral} /></div>
                <div className="flex justify-center"><StatusIcon status={row.competitor} /></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Limitations */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">{config.name} Limitations</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {config.limitations.map((item, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-red-50/50 border border-red-100">
                <X className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Switch */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Why Teams Switch from {config.name} to Flowstral</h2>
          <div className="space-y-3">
            {config.switchReasons.map((reason, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <Check className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Other Comparisons */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Other Comparisons</h2>
          <div className="flex flex-wrap gap-2">
            {Object.entries(competitors)
              .filter(([key]) => key !== slug)
              .map(([key, c]) => (
                <Button key={key} variant="outline" size="sm" onClick={() => navigate(`/compare/${key}`)}>
                  vs {c.name}
                </Button>
              ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Replace {config.name}?
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            Start free with unlimited test building. No credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              className="h-14 px-8 rounded-xl text-lg font-semibold bg-white text-blue-600 hover:bg-blue-50 shadow-lg"
              onClick={() => { trackCTAClick('get_started_free', `/compare/${slug}`); navigate('/signup'); }}
            >
              <Rocket className="w-5 h-5 mr-2" /> Try Flowstral Free
            </Button>
            <Button
              variant="outline"
              className="h-14 px-8 rounded-xl text-lg font-semibold border-2 border-white/50 text-white hover:bg-white/10"
              onClick={() => { trackCTAClick('talk_to_sales', `/compare/${slug}`); navigate('/contact'); }}
            >
              <Building2 className="w-5 h-5 mr-2" /> Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link to="/demo" className="hover:text-white transition-colors">Demo</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/tools/cost-calculator" className="hover:text-white transition-colors">Cost Calculator</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
