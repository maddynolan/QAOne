/**
 * Flowstral Landing Page
 *
 * Redesigned to remove AI-slop patterns:
 * - Specific, honest copy instead of buzzwords
 * - Clean flat backgrounds instead of gradient-on-gradient
 * - Fewer sections, each earning its place
 * - No fake social proof or inflated numbers
 * - Technical credibility through specifics
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trackCTAClick } from '@/lib/web-analytics';
import {
  Play, Zap, Shield, BarChart3, Code2,
  CheckCircle2, ArrowRight, Globe, Lock, Eye,
  Layers, RefreshCw, MousePointer,
  Blocks,
  ClipboardCheck,
  MonitorCheck, Activity,
  Accessibility,
  Smartphone, Wifi, Compass,
  Mail, Phone, MapPin,
  Twitter, Linkedin, Github, Youtube,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MarketingHeader } from '@/components/MarketingHeader';
import { LandingPluginsProvider, useLandingPlugins, type PluginKey } from '@/contexts/LandingPluginsContext';

// ===================================================================
// HERO
// ===================================================================

function HeroSection() {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center bg-white">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-16 w-full">
        <div className="max-w-3xl">
          <Badge className="mb-4 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm px-3 py-1">
            Zero Code Required
          </Badge>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
            Record once.{' '}
            <br className="hidden sm:block" />
            Test everything.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed mb-3">
            Flowstral records your browser sessions and turns them into reliable automated tests —
            no code required. Run those tests for performance, visual regression, accessibility,
            and API coverage — all from one platform.
          </p>
          <p className="text-sm text-slate-400 mb-8 max-w-2xl font-mono">
            Flow testing + System testing + Regression + API &amp; Accessibility + Load testing = <span className="text-emerald-600 font-semibold">Flowstral</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Button
              size="lg"
              onClick={() => { trackCTAClick('start_free', '/'); navigate('/signup'); }}
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg"
            >
              Start Free
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => { trackCTAClick('watch_demo', '/'); navigate('/demo'); }}
              className="h-12 px-8 border-slate-300 text-slate-700 hover:bg-slate-50 rounded-lg"
            >
              <Play className="w-4 h-4 mr-2" />
              Watch Demo
            </Button>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm text-slate-500">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" /> No credit card required
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" /> Free forever plan
            </span>
            <span className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400" /> Desktop + Chrome Extension
            </span>
          </div>
        </div>

        {/* Right side: recording step list UI mockup */}
        <div className="hidden lg:block absolute right-6 top-1/2 -translate-y-1/2 w-[400px]">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-semibold text-slate-700">Recording: login-flow</span>
              </div>
              <span className="text-xs text-slate-400">5 steps</span>
            </div>
            {/* Steps */}
            <div className="p-3 space-y-1">
              {[
                { num: '01', label: 'Navigate to /login', icon: Globe },
                { num: '02', label: 'Fill "Email" \u2192 user@co.com', icon: Layers },
                { num: '03', label: 'Fill "Password" \u2192 \u2022\u2022\u2022\u2022\u2022\u2022', icon: Lock },
                { num: '04', label: 'Click "Sign In"', icon: MousePointer },
                { num: '05', label: 'Verify text "Dashboard"', icon: CheckCircle2 },
              ].map((step) => (
                <div key={step.num} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  <span className="text-xs font-mono text-slate-400 w-5">{step.num}</span>
                  <step.icon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700">{step.label}</span>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs text-emerald-600 font-medium">Recording...</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">5 steps captured</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// HOW IT WORKS - Simple 3-step flow
// ===================================================================

function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Record',
      description: 'Use the desktop app or Chrome extension to trace your browser interactions. Flowstral captures clicks, form fills, navigation, and network requests automatically.',
      detail: 'Self-healing element recognition that adapts to UI changes',
    },
    {
      number: '02',
      title: 'Build & Extend',
      description: 'Edit steps visually with 59 step types. Add assertions, data generators, conditional logic, and reusable modules -- no code required.',
      detail: 'Drag-and-drop visual test builder',
    },
    {
      number: '03',
      title: 'Run Everywhere',
      description: 'Execute the same tests for functional validation, load testing, visual regression, accessibility compliance, and API coverage.',
      detail: 'One recording, seven testing dimensions',
    },
  ];

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          How it works
        </h2>
        <p className="text-slate-600 mb-12 max-w-xl">
          Three steps from first recording to full test coverage.
        </p>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div key={step.number} className="relative">
              <div className="text-5xl font-bold text-slate-200 mb-4">{step.number}</div>
              <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mb-3">
                {step.description}
              </p>
              <p className="text-xs text-slate-400 italic">{step.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// CAPABILITIES - What you can test
// ===================================================================

function CapabilitiesSection() {
  const navigate = useNavigate();
  const { isAvailable } = useLandingPlugins();

  const capabilities: Array<{
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    description: string;
    specifics: string[];
    href: string;
    plugin?: PluginKey;
  }> = [
    {
      icon: MousePointer,
      title: 'Browser Testing',
      description: 'Record sessions, build tests visually, run across Chromium, Firefox, and WebKit. Self-healing selectors fix themselves when the UI changes.',
      specifics: ['Smart element recognition', 'Cross-browser (3 engines)', 'Multi-layer self-healing'],
      href: '/products/smart-recorder',
    },
    {
      icon: Blocks,
      title: 'No-Code Builder',
      description: '59 step types you can drag and drop. Built-in data generators for names, emails, addresses, credit cards. Reusable test modules.',
      specifics: ['59 step types', '50+ data generators', 'Conditional logic & loops'],
      href: '/products/visual-builder',
    },
    {
      icon: ClipboardCheck,
      title: 'Test Management',
      description: 'Cases, suites, plans, releases, runs, defects, and requirements. Full traceability matrix. Version history with diff and revert.',
      specifics: ['6 connected modules', 'Version control for tests', 'Requirements traceability'],
      href: '/products/test-management',
    },
    {
      icon: Code2,
      title: 'API Testing',
      description: 'Send requests across REST, GraphQL, SOAP, gRPC, Kafka, MQTT, WebSocket, and AMQP. Chain requests with variable extraction.',
      specifics: ['8 protocols', 'Request chaining', '12 assertion types'],
      href: '/products/api-testing',
      plugin: 'api',
    },
    {
      icon: Activity,
      title: 'Performance Testing',
      description: 'Load test with up to 10,000 virtual users. 8 load patterns including spike, soak, and breakpoint. Server-side execution for heavy loads.',
      specifics: ['10K virtual users', '8 load patterns', 'Server-side execution'],
      href: '/products/performance',
      plugin: 'perf',
    },
    {
      icon: Eye,
      title: 'Visual Regression',
      description: 'Compare screenshots with 6 modes: pixel-perfect, anti-aliased, perceptual hash, structural (SSIM), layout-only, and AI semantic.',
      specifics: ['6 comparison modes', 'Baseline management', 'Ignore regions'],
      href: '/products/visual-testing',
    },
    {
      icon: Accessibility,
      title: 'Accessibility',
      description: 'WCAG 2.1 scanning powered by axe-core. Issues classified by severity with specific remediation guidance.',
      specifics: ['WCAG 2.1 A/AA/AAA', 'axe-core engine', 'Fix guidance per issue'],
      href: '/products/accessibility',
      plugin: 'a11y',
    },
    {
      icon: Smartphone,
      title: 'Mobile Testing',
      description: '50+ real device profiles with network throttling. Native app testing via Maestro integration for iOS and Android.',
      specifics: ['50+ device profiles', 'Network throttling', 'Maestro integration'],
      href: '/products/mobile-testing',
      plugin: 'mobile',
    },
  ];

  const visibleCapabilities = capabilities.filter((c) => !c.plugin || isAvailable(c.plugin));

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          What you can test
        </h2>
        <p className="text-slate-600 mb-12 max-w-xl">
          One platform covering browser, API, performance, visual, accessibility, and mobile testing.
          Free to start. No feature gating on core functionality.
        </p>

        <div className="grid md:grid-cols-2 gap-6">
          {visibleCapabilities.map((cap, idx) => (
            <div
              key={idx}
              onClick={() => navigate(cap.href)}
              className="group p-6 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:shadow-sm transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 transition-colors">
                  <cap.icon className="w-5 h-5 text-slate-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-slate-900 mb-1">{cap.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed mb-3">
                    {cap.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {cap.specifics.map((s, i) => (
                      <span key={i} className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// SELF-HEALING EXPLAINER
// ===================================================================

function SelfHealingSection() {
  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Your tests break. We fix them automatically.
            </h2>
            <p className="text-slate-600 leading-relaxed mb-8">
              When a UI changes and a selector breaks, Flowstral's multi-layer healing engine
              finds a working alternative before you even notice. Stops at the first success — no manual maintenance.
            </p>

            <div className="space-y-4">
              {[
                { layer: 'Selector Cache', speed: '< 1ms', description: 'Instant lookup of previously-healed selectors from past successful fixes' },
                { layer: 'Smart Variants', speed: '< 1ms', description: 'Generates alternative CSS, XPath, and Playwright locators from element attributes' },
                { layer: 'Vision AI', speed: '2-5s', description: 'GPT-4 Vision analyzes a screenshot to visually locate the element (opt-in)' },
                { layer: 'OCR Fallback', speed: '~500ms', description: 'Finds elements by their visible text using OCR when other methods fail' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-4 p-4 bg-white rounded-lg border border-slate-200">
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-sm font-bold text-slate-500">
                    {idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-semibold text-slate-900">{item.layer}</span>
                      <span className="text-xs text-slate-400">{item.speed}</span>
                    </div>
                    <p className="text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Replaces your current stack
            </h3>
            <p className="text-sm text-slate-500 mb-6">
              Instead of paying for 5-8 separate testing tools, run everything from one platform.
            </p>
            <div className="space-y-3">
              {[
                { tools: 'Selenium / Cypress / Playwright', category: 'Browser automation' },
                { tools: 'Postman / SoapUI', category: 'API testing' },
                { tools: 'JMeter / k6 / Gatling', category: 'Performance testing' },
                { tools: 'Applitools / Percy', category: 'Visual regression' },
                { tools: 'axe DevTools / WAVE', category: 'Accessibility' },
                { tools: 'BrowserStack / Sauce Labs', category: 'Cross-browser & mobile' },
                { tools: 'TestRail / Zephyr', category: 'Test management' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-white">
                  <div>
                    <span className="text-sm text-slate-400 line-through">{item.tools}</span>
                  </div>
                  <span className="text-xs text-slate-500">{item.category}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// AI AGENTS — Flowpilot & Blaze Explorer
// ===================================================================

function AIAgentsSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center gap-3 mb-4">
          <Badge className="bg-violet-50 text-violet-700 border border-violet-200 text-xs px-2 py-0.5">
            AI-Powered
          </Badge>
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-4">
          Describe what to test. AI does the rest.
        </h2>
        <p className="text-slate-600 mb-12 max-w-xl">
          Two autonomous agents that go beyond record-and-playback — they think, navigate, and find defects on their own.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Flowpilot */}
          <div className="p-6 rounded-xl border border-slate-200 hover:border-violet-200 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                <Compass className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Flowpilot</h3>
                <p className="text-xs text-slate-400">One sentence to live test</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Type a plain English instruction like "Add a product to cart and checkout" —
              Flowpilot launches a real browser, navigates the app, fills forms, clicks buttons,
              and reports pass/fail with screenshots at every step.
            </p>
            <div className="space-y-2 mb-4">
              {['15+ action types (forms, tables, modals, drag-drop)', 'Self-healing selectors auto-fix broken elements', 'Handles enterprise workflows: wizards, tabs, data grids'].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-violet-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
              <p className="text-xs text-slate-400 font-mono">
                "Log in as admin, create a new project called 'Q3 Release', assign it to the QA team, and verify it appears in the dashboard"
              </p>
            </div>
          </div>

          {/* Blaze Explorer */}
          <div className="p-6 rounded-xl border border-slate-200 hover:border-orange-200 hover:shadow-sm transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <Zap className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Blaze Explorer</h3>
                <p className="text-xs text-slate-400">Autonomous crawl + defect detection</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              Give it a URL — Blaze crawls your entire application concurrently, checking every page
              for broken links, JS errors, accessibility violations (axe-core), console errors, and
              missing resources. Then auto-generates a test suite from what it found.
            </p>
            <div className="space-y-2 mb-4">
              {['Concurrent crawling with configurable depth & page limits', 'Auth support: cookies, bearer tokens, basic auth, form login', 'WCAG scanning via axe-core on every discovered page'].map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-500">
                  <CheckCircle2 className="w-3.5 h-3.5 text-orange-500 flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Auto-generates smoke tests</Badge>
              <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-xs">Form regression tests</Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// ACCESSIBILITY DEMO
// ===================================================================

function AccessibilityDemoSection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Accessibility className="w-5 h-5 text-blue-600" />
              <Badge className="bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-0.5">
                WCAG 2.1 Compliance
              </Badge>
            </div>
            <h2 className="text-3xl font-bold text-slate-900 mb-4">
              Scan any page for accessibility issues in seconds
            </h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              Powered by axe-core — the same engine used by Google, Microsoft, and the US government.
              Paste a URL, pick your compliance level, and get actionable results with severity
              classification and fix guidance.
            </p>
            <div className="space-y-3 mb-6">
              {[
                { label: 'WCAG 2.1 Level A / AA / AAA', detail: 'Choose the compliance level that matches your requirements' },
                { label: 'Severity-ranked issues', detail: 'Critical, serious, moderate, minor — fix what matters first' },
                { label: 'Element-level fix guidance', detail: 'Each issue includes the failing HTML and how to fix it' },
                { label: 'Batch scanning', detail: 'Scan multiple URLs concurrently with a single API call' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <span className="text-sm font-medium text-slate-900">{item.label}</span>
                    <p className="text-xs text-slate-400">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
            <Button
              onClick={() => { trackCTAClick('try_accessibility', '/'); navigate('/app/accessibility'); }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Try Accessibility Scanner
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>

          {/* Mock scan result UI */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Accessibility className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-slate-700">Scan Results</span>
              </div>
              <Badge className="bg-green-50 text-green-700 border-green-200 text-xs">WCAG 2.1 AA</Badge>
            </div>
            <div className="p-4 space-y-3">
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Critical', count: 2, color: 'text-red-600 bg-red-50' },
                  { label: 'Serious', count: 5, color: 'text-orange-600 bg-orange-50' },
                  { label: 'Moderate', count: 8, color: 'text-yellow-600 bg-yellow-50' },
                  { label: 'Minor', count: 3, color: 'text-blue-600 bg-blue-50' },
                ].map((item) => (
                  <div key={item.label} className={cn("rounded-lg p-2.5 text-center", item.color)}>
                    <div className="text-lg font-bold">{item.count}</div>
                    <div className="text-[10px] font-medium">{item.label}</div>
                  </div>
                ))}
              </div>
              {/* Sample issues */}
              <div className="space-y-2">
                {[
                  { rule: 'image-alt', impact: 'Critical', desc: 'Images must have alt text', el: '<img src="hero.jpg">' },
                  { rule: 'color-contrast', impact: 'Serious', desc: 'Text must meet 4.5:1 contrast', el: '<p class="light-gray">' },
                  { rule: 'label', impact: 'Serious', desc: 'Form inputs must have labels', el: '<input type="email">' },
                ].map((issue, idx) => (
                  <div key={idx} className="p-3 rounded-lg border border-slate-100 bg-slate-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-slate-700">{issue.rule}</span>
                      <Badge className={cn("text-[10px]",
                        issue.impact === 'Critical' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-orange-50 text-orange-700 border-orange-200'
                      )}>{issue.impact}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 mb-1">{issue.desc}</p>
                    <code className="text-[10px] text-slate-400 font-mono">{issue.el}</code>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 text-center">18 issues found across 47 elements scanned</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// DEPLOYMENT OPTIONS
// ===================================================================

function DeploymentSection() {
  return (
    <section className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-wrap justify-center gap-8 text-sm text-slate-500">
          <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-slate-400" /> On-prem & air-gapped ready</span>
          <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-slate-400" /> RBAC + multi-tenant</span>
          <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-slate-400" /> Docker + Kubernetes + Helm</span>
          <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-slate-400" /> Works without AI -- AI is optional</span>
        </div>
      </div>
    </section>
  );
}

// ===================================================================
// CTA
// ===================================================================

function CTASection() {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-slate-900">
      <div className="max-w-3xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
          Stop paying for seven testing tools.
        </h2>
        <p className="text-lg text-slate-400 mb-10">
          Free plan includes unlimited test building. No credit card, no time limit.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button
            size="lg"
            onClick={() => { trackCTAClick('get_started_free', '/'); navigate('/signup'); }}
            className="h-12 px-8 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-lg"
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => { trackCTAClick('schedule_demo', '/'); navigate('/contact'); }}
            className="h-12 px-8 border-slate-500 text-white hover:bg-slate-800 rounded-lg"
          >
            Talk to Sales
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-500">
          {['Free forever plan', 'No credit card', 'On-prem available'].map((item, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-slate-600" /> {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// Header: uses shared MarketingHeader component (see src/components/MarketingHeader.tsx)

// ===================================================================
// FOOTER
// ===================================================================

function Footer() {
  const navigate = useNavigate();

  const footerLinks = {
    Product: [
      { name: 'Smart Trace', href: '/products/smart-recorder' },
      { name: 'Visual Builder', href: '/products/visual-builder' },
      { name: 'Flowpilot', href: '/products/flowpilot' },
      { name: 'Mobile Testing', href: '/products/mobile-testing' },
      { name: 'API Testing', href: '/products/api-testing' },
      { name: 'Performance', href: '/products/performance' },
      { name: 'Download Desktop', href: '/download' },
    ],
    Resources: [
      { name: 'Documentation', href: '/resources/docs' },
      { name: 'Blog', href: '/blog' },
      { name: 'Watch Demo', href: '/demo' },
      { name: 'FAQ', href: '/faq' },
      { name: 'Cost Calculator', href: '/tools/cost-calculator' },
      { name: 'Support', href: '/contact' },
    ],
    Compare: [
      { name: 'vs Katalon', href: '/compare/katalon' },
      { name: 'vs Selenium', href: '/compare/selenium' },
      { name: 'vs Postman', href: '/compare/postman' },
      { name: 'vs Cypress', href: '/compare/cypress' },
      { name: 'vs Tricentis', href: '/compare/tricentis' },
    ],
    Company: [
      { name: 'About Us', href: '/about' },
      { name: 'Pricing', href: '/pricing' },
      { name: 'Contact', href: '/contact' },
      { name: 'Privacy', href: '/privacy' },
      { name: 'Terms', href: '/terms' },
    ],
  };

  return (
    <footer className="bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                <span className="text-white font-bold text-sm">F</span>
              </div>
              <span className="text-lg font-bold">Flowstral</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              Record browser sessions. Generate tests. Run them for every testing dimension.
            </p>
            <div className="flex gap-3">
              {[Twitter, Linkedin, Github, Youtube].map((Icon, idx) => (
                <a key={idx} href="#" className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold mb-4 text-sm">{title}</h3>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.name}>
                    {link.href.startsWith('/') ? (
                      <span
                        onClick={() => navigate(link.href)}
                        className="text-sm text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        {link.name}
                      </span>
                    ) : (
                      <a href={link.href} className="text-sm text-slate-400 hover:text-white transition-colors">{link.name}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">2026 Flowstral Inc.</div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
        </div>
      </div>

      <div className="bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-wrap justify-center gap-8 text-sm text-slate-500">
          <a href="mailto:sales@flowstral.com" className="flex items-center gap-2 hover:text-white transition-colors">
            <Mail className="w-4 h-4" /> sales@flowstral.com
          </a>
          <a href="mailto:support@flowstral.com" className="flex items-center gap-2 hover:text-white transition-colors">
            <Mail className="w-4 h-4" /> support@flowstral.com
          </a>
          <a href="tel:+13608783752" className="flex items-center gap-2 hover:text-white transition-colors">
            <Phone className="w-4 h-4" /> (360) 878-3752
          </a>
          <span className="flex items-center gap-2">
            <MapPin className="w-4 h-4" /> Maryland, USA
          </span>
        </div>
      </div>
    </footer>
  );
}

// ===================================================================
// MAIN PAGE
// ===================================================================

function LandingPageContent() {
  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <SelfHealingSection />
        <AIAgentsSection />
        <AccessibilityDemoSection />
        <DeploymentSection />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}

export default function LandingPage() {
  return (
    <LandingPluginsProvider>
      <LandingPageContent />
    </LandingPluginsProvider>
  );
}
