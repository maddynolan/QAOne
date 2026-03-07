/**
 * Pricing Page — Flowstral Testing Platform
 * Two-tier model: Free (Community) + Enterprise (Contact Sales)
 * Goal: land $100-150K annual enterprise deals by replacing 5-8 tools
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trackCTAClick, trackPricingView } from '@/lib/web-analytics';
import {
  Check, X, ArrowRight, Rocket, Building2, Zap,
  ChevronDown, HelpCircle, Mail, MessageSquare, Sparkles,
  TestTube, Gauge, Code, Eye, Accessibility, Cloud,
  Smartphone, Compass, Shield, Server,
  CalendarCheck, DollarSign, Layers, Lock, Globe, BarChart3
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Shared Header
function MarketingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  React.useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50" : "bg-white/80 backdrop-blur-sm"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Flowstral</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <Link to="/#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Features</Link>
            <Link to="/pricing" className="text-sm text-blue-600 font-semibold">Pricing</Link>
            <Link to="/compare/katalon" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Compare</Link>
            <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Blog</Link>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => { trackCTAClick('sign_in', '/pricing'); navigate('/signin'); }}>
            Sign In
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" onClick={() => { trackCTAClick('start_free', '/pricing'); navigate('/signup'); }}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

// 8 Testing Packs
const testingPacks = [
  { name: 'Automation', icon: TestTube, color: 'blue', desc: 'Record, build & run tests' },
  { name: 'Flowpilot', icon: Compass, color: 'fuchsia', desc: 'AI exploratory testing (Preview)', isNew: true },
  { name: 'Mobile', icon: Smartphone, color: 'sky', desc: '40+ devices & throttling', isNew: true },
  { name: 'Performance', icon: Gauge, color: 'orange', desc: 'Load & stress testing' },
  { name: 'API', icon: Code, color: 'emerald', desc: 'REST, GraphQL & more' },
  { name: 'Visual', icon: Eye, color: 'purple', desc: 'Visual regression testing' },
  { name: 'Accessibility', icon: Accessibility, color: 'pink', desc: 'WCAG compliance' },
  { name: 'Salesforce', icon: Cloud, color: 'cyan', desc: '20+ native SF tools' },
];

// Tools replaced by Flowstral
const replacedTools = [
  { name: 'Selenium / Cypress', category: 'Browser Automation', cost: '$15K-40K/yr' },
  { name: 'Postman / SoapUI', category: 'API Testing', cost: '$10K-25K/yr' },
  { name: 'JMeter / k6', category: 'Performance Testing', cost: '$15K-50K/yr' },
  { name: 'Applitools / Percy', category: 'Visual Testing', cost: '$12K-30K/yr' },
  { name: 'Axe / WAVE Pro', category: 'Accessibility', cost: '$8K-20K/yr' },
  { name: 'BrowserStack / LambdaTest', category: 'Cross-Browser / Mobile', cost: '$20K-60K/yr' },
  { name: 'Provar / Copado', category: 'Salesforce Testing', cost: '$25K-80K/yr' },
  { name: 'TestRail / Zephyr', category: 'Test Management', cost: '$10K-30K/yr' },
];

// FAQ data
const faqs = [
  {
    q: 'What happens when I exceed the Free tier limits?',
    a: 'You will receive a notification when approaching your monthly limits. Tests already in progress will complete, but new runs will be paused until the next billing cycle or until you upgrade to Enterprise.',
  },
  {
    q: 'Can I try Enterprise features before committing?',
    a: 'Absolutely. We offer a 14-day full-access Enterprise trial for qualified teams. Contact our sales team to get started with a personalized demo and trial environment.',
  },
  {
    q: 'How is Enterprise pricing determined?',
    a: 'Enterprise pricing is based on team size, testing volume, deployment model (cloud or on-prem), and which specialized packs you need. Most customers land between $100K-150K annually, which still represents significant savings compared to 5-8 separate tools.',
  },
  {
    q: 'Can I deploy Flowstral on-premises or in my private cloud?',
    a: 'Yes. Enterprise includes on-premise, air-gapped, and private cloud deployment options. We support Docker, Kubernetes with Helm charts, and can work with your infrastructure team on custom deployments.',
  },
  {
    q: 'Do you offer volume discounts for large teams?',
    a: 'Yes. Enterprise contracts include volume-based pricing. The more teams and projects you onboard, the lower your per-user cost. Multi-year agreements also receive additional discounts.',
  },
  {
    q: 'What kind of support does the Free tier include?',
    a: 'Free tier users get access to GitHub issues and comprehensive documentation. Enterprise customers receive a dedicated Customer Success Manager, 24/7 priority support, and quarterly business reviews.',
  },
  {
    q: 'How does the self-healing work across tiers?',
    a: 'Free tier includes basic self-healing with Knowledge and Deterministic layers, which handle most common selector breakages. Enterprise unlocks the full 4-layer healing chain including Vision AI and OCR, which can heal even complex dynamic UIs.',
  },
  {
    q: 'Is there a contract or commitment for the Free tier?',
    a: 'No. The Free tier is free forever with no contract, no credit card required, and no time limit. Use it as long as it meets your needs.',
  },
];

// Feature comparison table data
const comparisonSections = [
  {
    title: 'Platform Limits',
    icon: Layers,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    rows: [
      { feature: 'Team Members', free: 'Up to 3', enterprise: 'Unlimited' },
      { feature: 'Test Runs / Month', free: '1,000', enterprise: 'Unlimited' },
      { feature: 'Parallel Executions', free: '1', enterprise: 'Unlimited' },
      { feature: 'Desktop App', free: true, enterprise: true },
      { feature: 'Chrome Extension', free: true, enterprise: true },
    ],
  },
  {
    title: 'Automation Pack',
    icon: TestTube,
    iconBg: 'bg-blue-50',
    iconColor: 'text-blue-700',
    rows: [
      { feature: 'Smart Trace', free: true, enterprise: true },
      { feature: 'Visual Test Builder (60+ step types)', free: true, enterprise: true },
      { feature: 'Test Cases, Suites & Runs', free: true, enterprise: true },
      { feature: 'Test Plans & Releases', free: false, enterprise: true },
      { feature: 'Self-Healing (Knowledge + Deterministic)', free: true, enterprise: true },
      { feature: 'Self-Healing (Vision AI + OCR)', free: false, enterprise: true },
      { feature: 'Cross-Browser Testing', free: false, enterprise: true },
      { feature: 'CI/CD Export (GitHub, GitLab, Jenkins, Azure)', free: false, enterprise: true },
    ],
  },
  {
    title: 'Flowpilot Pack',
    icon: Compass,
    iconBg: 'bg-fuchsia-50',
    iconColor: 'text-fuchsia-700',
    isNew: true,
    rows: [
      { feature: 'AI Test Generation from Requirements', free: false, enterprise: true },
      { feature: 'Goal-Based Agentic Testing', free: false, enterprise: true },
      { feature: 'Autonomous Explorer', free: false, enterprise: true },
      { feature: 'Flowmap Visualization', free: false, enterprise: true },
      { feature: 'JIRA / Gherkin Import', free: false, enterprise: true },
    ],
  },
  {
    title: 'API Testing Pack',
    icon: Code,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-700',
    rows: [
      { feature: 'REST API Testing', free: true, enterprise: true },
      { feature: 'GraphQL API Testing', free: true, enterprise: true },
      { feature: 'Basic Assertions (11 types)', free: true, enterprise: true },
      { feature: 'gRPC Testing', free: false, enterprise: true },
      { feature: 'SOAP / WSDL Testing', free: false, enterprise: true },
      { feature: 'Kafka / MQTT / AMQP', free: false, enterprise: true },
      { feature: 'WebSocket Testing', free: false, enterprise: true },
      { feature: 'Request Chaining & Variables', free: false, enterprise: true },
      { feature: 'Mock Servers & Service Virtualization', free: false, enterprise: true },
      { feature: 'Contract Testing', free: false, enterprise: true },
    ],
  },
  {
    title: 'Visual Testing Pack',
    icon: Eye,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-700',
    rows: [
      { feature: 'Visual Comparisons', free: '100/mo', enterprise: 'Unlimited' },
      { feature: 'Pixel Perfect Mode', free: true, enterprise: true },
      { feature: 'Anti-Aliased Mode', free: true, enterprise: true },
      { feature: 'Layout Mode', free: true, enterprise: true },
      { feature: 'Structural (SSIM) Mode', free: false, enterprise: true },
      { feature: 'Perceptual Hash Mode', free: false, enterprise: true },
      { feature: 'AI Semantic Mode (Claude Vision)', free: false, enterprise: true },
      { feature: 'Baseline Management', free: true, enterprise: true },
    ],
  },
  {
    title: 'Accessibility Pack',
    icon: Accessibility,
    iconBg: 'bg-pink-50',
    iconColor: 'text-pink-700',
    rows: [
      { feature: 'WCAG 2.1 AA Scanning (axe-core)', free: true, enterprise: true },
      { feature: 'WCAG 2.1 AAA Scanning', free: false, enterprise: true },
      { feature: 'Basic Reports', free: true, enterprise: true },
      { feature: 'Audit-Ready Compliance Reports', free: false, enterprise: true },
      { feature: 'AI Remediation Suggestions', free: false, enterprise: true },
      { feature: 'Batch / Multi-URL Scans', free: false, enterprise: true },
    ],
  },
  {
    title: 'Performance Pack',
    icon: Gauge,
    iconBg: 'bg-orange-50',
    iconColor: 'text-orange-700',
    rows: [
      { feature: 'Load Testing', free: false, enterprise: true },
      { feature: 'Virtual Users (10,000+)', free: false, enterprise: true },
      { feature: '8 Load Patterns', free: false, enterprise: true },
      { feature: 'Real-Time Metrics & Dashboards', free: false, enterprise: true },
      { feature: 'Protocol Recording (HAR)', free: false, enterprise: true },
      { feature: 'Script Generation (k6, JMeter)', free: false, enterprise: true },
      { feature: 'SRM & Lighthouse Integration', free: false, enterprise: true },
    ],
  },
  {
    title: 'Mobile Testing Pack',
    icon: Smartphone,
    iconBg: 'bg-sky-50',
    iconColor: 'text-sky-700',
    isNew: true,
    rows: [
      { feature: 'Native App Testing (Maestro)', free: false, enterprise: true },
      { feature: '40+ Device Profiles', free: false, enterprise: true },
      { feature: 'Network Throttling', free: false, enterprise: true },
      { feature: 'Touch Gestures', free: false, enterprise: true },
      { feature: 'Device Cloud Integration', free: false, enterprise: true },
      { feature: 'Element Inspector', free: false, enterprise: true },
    ],
  },
  {
    title: 'Salesforce Pack',
    icon: Cloud,
    iconBg: 'bg-cyan-50',
    iconColor: 'text-cyan-700',
    rows: [
      { feature: 'Native SF Tools (20+)', free: false, enterprise: true },
      { feature: 'SOQL Query Builder', free: false, enterprise: true },
      { feature: 'Apex Test Execution', free: false, enterprise: true },
      { feature: 'Data Factory', free: false, enterprise: true },
      { feature: 'Org Comparison', free: false, enterprise: true },
      { feature: 'Permission Testing', free: false, enterprise: true },
    ],
  },
  {
    title: 'Platform & Support',
    icon: Shield,
    iconBg: 'bg-slate-100',
    iconColor: 'text-slate-700',
    rows: [
      { feature: 'Community Support (GitHub)', free: true, enterprise: true },
      { feature: 'Dedicated Customer Success Manager', free: false, enterprise: true },
      { feature: '24/7 Priority Support', free: false, enterprise: true },
      { feature: 'SSO / SAML / SCIM (Roadmap)', free: false, enterprise: true },
      { feature: 'RBAC & Multi-Tenancy', free: false, enterprise: true },
      { feature: 'On-Premise / Air-Gapped Deployment', free: false, enterprise: true },
      { feature: 'Custom SLA (99.9%)', free: false, enterprise: true },
      { feature: 'Training & Onboarding', free: false, enterprise: true },
      { feature: 'Quarterly Business Reviews', free: false, enterprise: true },
    ],
  },
];

// Render a cell value in the comparison table
function ComparisonCell({ value, isEnterprise }: { value: boolean | string; isEnterprise?: boolean }) {
  if (typeof value === 'string') {
    return (
      <span className={cn(
        "text-sm font-medium",
        isEnterprise ? "text-violet-600 font-semibold" : "text-slate-600"
      )}>
        {value}
      </span>
    );
  }
  if (value) {
    return <Check className="w-5 h-5 text-emerald-500 mx-auto" />;
  }
  return <X className="w-5 h-5 text-slate-300 mx-auto" />;
}

// FAQ Accordion Item
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden transition-all">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="text-base font-semibold text-slate-800 pr-4">{question}</span>
        <ChevronDown className={cn(
          "w-5 h-5 text-slate-400 flex-shrink-0 transition-transform duration-200",
          open && "rotate-180"
        )} />
      </button>
      {open && (
        <div className="px-5 pb-5">
          <p className="text-sm text-slate-600 leading-relaxed">{answer}</p>
        </div>
      )}
    </div>
  );
}

export default function PricingPage() {
  const navigate = useNavigate();

  React.useEffect(() => { trackPricingView(); }, []);

  // Compute total tool replacement savings
  const totalSavingsLow = replacedTools.reduce((sum, t) => {
    const match = t.cost.match(/\$(\d+)K/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);
  const totalSavingsHigh = replacedTools.reduce((sum, t) => {
    const match = t.cost.match(/-(\d+)K/);
    return sum + (match ? parseInt(match[1]) : 0);
  }, 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Badge className="mb-4 bg-gradient-to-r from-blue-100 to-violet-100 text-blue-700 border-0 px-4 py-1.5">
            <Sparkles className="w-3.5 h-3.5 mr-1.5 inline" />
            All-in-One Testing Platform
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            Start Free. Scale to Enterprise.
          </h1>
          <p className="text-xl text-slate-600 mb-4 max-w-2xl mx-auto">
            Replace 5-8 testing tools with one platform. No credit card required.
          </p>
          <p className="text-base text-slate-500 mb-8 max-w-xl mx-auto">
            Get started with a generous free tier, then unlock the full power of Flowstral when your team is ready.
          </p>

          {/* 8 Packs Showcase */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {testingPacks.map((pack) => (
              <div
                key={pack.name}
                className={cn(
                  "relative flex items-center gap-2 px-4 py-2 rounded-full border transition-all hover:scale-105",
                  pack.color === 'blue' && "bg-blue-50 border-blue-200 text-blue-700",
                  pack.color === 'orange' && "bg-orange-50 border-orange-200 text-orange-700",
                  pack.color === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                  pack.color === 'purple' && "bg-purple-50 border-purple-200 text-purple-700",
                  pack.color === 'pink' && "bg-pink-50 border-pink-200 text-pink-700",
                  pack.color === 'cyan' && "bg-cyan-50 border-cyan-200 text-cyan-700",
                  pack.color === 'fuchsia' && "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",
                  pack.color === 'sky' && "bg-sky-50 border-sky-200 text-sky-700",
                )}
              >
                {pack.isNew && (
                  <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0 text-[8px] font-bold px-1.5 py-0 animate-pulse">
                    NEW
                  </Badge>
                )}
                <pack.icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{pack.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-8 items-stretch">

            {/* Free Tier */}
            <div className="relative p-8 rounded-3xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:shadow-lg transition-all duration-300 flex flex-col">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 flex items-center justify-center mb-6 shadow-sm">
                <Zap className="w-7 h-7 text-emerald-600" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-1">Free</h3>
              <p className="text-sm text-slate-500 mb-6">Everything you need to start automating QA</p>

              <div className="mb-6">
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold text-slate-900">$0</span>
                  <span className="text-slate-500 font-medium">/forever</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">No credit card required</p>
              </div>

              <Button
                className="w-full h-12 rounded-xl font-semibold mb-8 bg-white border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-600 transition-all"
                onClick={() => { trackCTAClick('get_started_free', '/pricing'); navigate('/signup'); }}
              >
                Get Started Free <ArrowRight className="w-4 h-4 ml-2" />
              </Button>

              <div className="space-y-3 flex-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">What's included</p>
                {[
                  'Up to 3 users',
                  '1,000 test runs / month',
                  '1 parallel execution',
                  'Smart Trace (full)',
                  'Visual Test Builder (all 60+ step types)',
                  'Test Cases, Suites & Runs',
                  'Self-Healing Locators (basic)',
                  'REST & GraphQL API Testing',
                  'Visual Testing (100 comparisons/mo, 3 modes)',
                  'WCAG 2.1 AA Accessibility Scanning',
                  'Basic Reports',
                  'Desktop App (full)',
                  'Chrome Extension (full)',
                  'Community Support (GitHub)',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Enterprise Tier */}
            <div className="relative p-8 rounded-3xl border-2 border-violet-400 bg-gradient-to-b from-violet-50 via-white to-blue-50 shadow-xl shadow-violet-500/10 transition-all duration-300 flex flex-col lg:scale-[1.02]">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white border-0 px-4 py-1 shadow-lg">
                <Sparkles className="w-3 h-3 mr-1" />
                Recommended
              </Badge>

              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-violet-200 flex items-center justify-center mb-6 shadow-sm">
                <Building2 className="w-7 h-7 text-violet-600" />
              </div>

              <h3 className="text-2xl font-bold text-slate-900 mb-1">Enterprise</h3>
              <p className="text-sm text-slate-500 mb-6">Full platform power for teams that ship quality at scale</p>

              <div className="mb-6">
                <span className="text-3xl font-bold text-slate-900">Contact Sales</span>
                <p className="text-xs text-slate-400 mt-1">Custom annual pricing for your organization</p>
              </div>

              <div className="flex gap-3 mb-8">
                <Button
                  className="flex-1 h-12 rounded-xl font-semibold bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25 transition-all"
                  onClick={() => { trackCTAClick('talk_to_sales', '/pricing'); navigate('/contact'); }}
                >
                  Talk to Sales <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <Button
                  variant="outline"
                  className="h-12 rounded-xl font-semibold border-violet-300 text-violet-600 hover:bg-violet-50"
                  onClick={() => { trackCTAClick('request_demo', '/pricing'); navigate('/contact'); }}
                >
                  <CalendarCheck className="w-4 h-4 mr-1.5" /> Demo
                </Button>
              </div>

              <div className="space-y-3 flex-1">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Everything in Free, plus</p>
                {[
                  'Unlimited users',
                  'Unlimited test runs',
                  'Unlimited parallel executions',
                  'Full AI Self-Healing (4-layer: Vision AI + OCR)',
                  'AI Test Generation (JIRA, text, Gherkin)',
                  'Flowpilot AI Exploration (Preview)',
                  'Full API Testing (REST, GraphQL + chaining + mocks)',
                  'Performance & Load Testing (100+ VUs, server-side)',
                  'Visual Testing (unlimited, 6 modes + AI semantic)',
                  'Full WCAG 2.1 AAA + compliance reports',
                  'Mobile Testing (40+ devices, Maestro)',
                  'Salesforce Pack (20+ tools, SOQL, Apex, Data Factory)',
                  'On-Premise / Air-Gapped deployment',
                  'SSO / SAML / SCIM (Roadmap)',
                  'RBAC & Multi-Tenancy',
                  'Custom CI/CD Integrations',
                  'Dedicated Success Manager',
                  '24/7 Priority Support + Custom SLA (99.9%)',
                  'Training, Onboarding & QBRs',
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-violet-500 flex-shrink-0" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Why Enterprise — Tool Consolidation ROI */}
      <section className="py-20 px-6 bg-gradient-to-b from-slate-50 via-white to-slate-50 border-y border-slate-200/60">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <Badge className="mb-4 bg-violet-100 text-violet-700 border-violet-200 px-4 py-1.5">
              <DollarSign className="w-3.5 h-3.5 mr-1.5 inline" />
              ROI Calculator
            </Badge>
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">
              Replace 5-8 Tools. Save ${totalSavingsLow}K-${totalSavingsHigh}K/Year.
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Most enterprise QA teams spend over $200K annually on fragmented testing tools. Flowstral consolidates everything into one platform, one vendor, one contract.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {replacedTools.map((tool, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md hover:border-slate-300 transition-all">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">{tool.category}</p>
                <p className="text-slate-900 font-semibold mb-2">{tool.name}</p>
                <p className="text-emerald-600 font-bold text-lg">{tool.cost}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-violet-50 border border-blue-200/60 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-4">
                <Layers className="w-7 h-7 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">One Platform</h3>
              <p className="text-sm text-slate-600">Replace 8 separate tools with a single, unified testing platform. No more context-switching between vendors.</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200/60 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">One Contract</h3>
              <p className="text-sm text-slate-600">Eliminate procurement complexity. One vendor, one renewal, one point of contact for all your testing needs.</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-pink-50 border border-violet-200/60 rounded-2xl p-8 text-center">
              <div className="w-14 h-14 rounded-2xl bg-violet-100 flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-7 h-7 text-violet-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">One Dashboard</h3>
              <p className="text-sm text-slate-600">Unified analytics across all testing types. See quality metrics, trends, and coverage in a single view.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Trust Signals */}
      <section className="py-20 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Enterprise-Grade Security & Compliance</h2>
            <p className="text-lg text-slate-600 max-w-2xl mx-auto">
              Built for organizations with the strictest security and compliance requirements.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: Shield,
                title: 'RBAC & Multi-Tenant',
                desc: 'Role-based access control with tenant isolation, JWT auth, and audit logging built in.',
                gradient: 'from-blue-100 to-blue-200',
                iconColor: 'text-blue-600',
              },
              {
                icon: Lock,
                title: 'SSO & SCIM (Roadmap)',
                desc: 'SAML 2.0 single sign-on and SCIM provisioning are on our enterprise roadmap.',
                gradient: 'from-violet-100 to-violet-200',
                iconColor: 'text-violet-600',
              },
              {
                icon: Server,
                title: 'On-Premise Deploy',
                desc: 'Air-gapped, private cloud, or hybrid deployments with Docker and Kubernetes Helm charts.',
                gradient: 'from-emerald-100 to-emerald-200',
                iconColor: 'text-emerald-600',
              },
              {
                icon: Globe,
                title: 'Self-Hosted Flexibility',
                desc: 'Deploy anywhere your infrastructure lives. Works with Ollama for fully offline AI.',
                gradient: 'from-orange-100 to-orange-200',
                iconColor: 'text-orange-600',
              },
            ].map((badge, i) => (
              <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-slate-300 transition-all">
                <div className={cn("w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center mb-4", badge.gradient)}>
                  <badge.icon className={cn("w-6 h-6", badge.iconColor)} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{badge.title}</h3>
                <p className="text-sm text-slate-600">{badge.desc}</p>
              </div>
            ))}
          </div>

          {/* Built for enterprise teams */}
          <div className="mt-14 text-center">
            <p className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Built for teams in</p>
            <div className="flex flex-wrap justify-center gap-6">
              {['SaaS', 'Fintech', 'Healthcare', 'Insurance', 'Salesforce Orgs', 'Government'].map((label, i) => (
                <span key={i} className="px-4 py-2 rounded-full bg-slate-100 text-sm font-medium text-slate-600 border border-slate-200">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Complete Feature Comparison</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Detailed breakdown of what is included in each tier, organized by testing pack.
          </p>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-3 gap-4 p-6 bg-slate-50 border-b border-slate-200">
              <div className="font-semibold text-slate-700">Feature</div>
              <div className="text-center font-semibold text-emerald-600">Free</div>
              <div className="text-center font-semibold text-violet-600">Enterprise</div>
            </div>

            {comparisonSections.map((section, sIdx) => (
              <div key={sIdx} className="border-b border-slate-100 last:border-b-0">
                {/* Section header */}
                <div className={cn("px-6 py-3 font-semibold text-sm uppercase tracking-wider flex items-center gap-2", section.iconBg, section.iconColor)}>
                  <section.icon className="w-4 h-4" />
                  {section.title}
                  {section.isNew && (
                    <Badge className="bg-fuchsia-500 text-white border-0 text-[10px] ml-1">NEW</Badge>
                  )}
                </div>

                {section.rows.map((row, rIdx) => (
                  <div key={rIdx} className="grid grid-cols-3 gap-4 px-6 py-4 border-b border-slate-50 last:border-b-0 hover:bg-slate-50/50">
                    <div className="text-sm text-slate-700">{row.feature}</div>
                    <div className="text-center">
                      <ComparisonCell value={row.free} />
                    </div>
                    <div className="text-center">
                      <ComparisonCell value={row.enterprise} isEnterprise />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Frequently Asked Questions</h2>
          <p className="text-slate-600 text-center mb-12">
            Everything you need to know about Flowstral pricing and plans.
          </p>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.q} answer={faq.a} />
            ))}
          </div>

          <div className="mt-12 text-center">
            <p className="text-slate-500 mb-4">Still have questions?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => { trackCTAClick('chat_with_us', '/pricing'); navigate('/contact'); }}>
                <MessageSquare className="w-5 h-5 mr-2" /> Chat with Us
              </Button>
              <Button
                className="h-12 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700"
                onClick={() => { trackCTAClick('contact_sales', '/pricing'); navigate('/contact'); }}
              >
                <Mail className="w-5 h-5 mr-2" /> Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Compare Section */}
      <section className="py-16 px-6 bg-slate-50 border-t border-slate-200">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">See How Flowstral Compares</h2>
          <p className="text-slate-600 mb-8">Detailed side-by-side comparisons with tools you might be using today</p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              { name: 'vs Katalon', path: '/compare/katalon' },
              { name: 'vs Selenium', path: '/compare/selenium' },
              { name: 'vs Postman', path: '/compare/postman' },
              { name: 'vs Cypress', path: '/compare/cypress' },
              { name: 'vs Tricentis', path: '/compare/tricentis' },
            ].map(comp => (
              <Button key={comp.path} variant="outline" className="rounded-xl h-11 px-5" onClick={() => navigate(comp.path)}>
                {comp.name} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            ))}
          </div>
          <p className="mt-6 text-sm text-slate-500">
            Or try our <span className="text-blue-600 cursor-pointer hover:underline font-medium" onClick={() => navigate('/tools/cost-calculator')}>Cost Calculator</span> to see how much you'd save by consolidating
          </p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-6 bg-gradient-to-r from-blue-600 via-violet-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">
            Ready to Unify Your Testing?
          </h2>
          <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">
            Join teams that have replaced 5-8 fragmented tools with Flowstral. Start free today or talk to sales about an enterprise deployment.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              className="h-14 px-8 rounded-xl text-lg font-semibold bg-white text-blue-600 hover:bg-blue-50 shadow-lg transition-all"
              onClick={() => { trackCTAClick('get_started_free_bottom', '/pricing'); navigate('/signup'); }}
            >
              <Rocket className="w-5 h-5 mr-2" /> Get Started Free
            </Button>
            <Button
              variant="outline"
              className="h-14 px-8 rounded-xl text-lg font-semibold border-2 border-white/50 text-white hover:bg-white/10 transition-all"
              onClick={() => { trackCTAClick('talk_to_sales_bottom', '/pricing'); navigate('/contact'); }}
            >
              <Building2 className="w-5 h-5 mr-2" /> Talk to Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400 mb-4">
          <Link to="/compare/katalon" className="hover:text-white transition-colors">Compare</Link>
          <Link to="/tools/cost-calculator" className="hover:text-white transition-colors">Cost Calculator</Link>
          <Link to="/blog" className="hover:text-white transition-colors">Blog</Link>
          <Link to="/demo" className="hover:text-white transition-colors">Demo</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
        </div>
        <p className="text-slate-500 text-xs">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
