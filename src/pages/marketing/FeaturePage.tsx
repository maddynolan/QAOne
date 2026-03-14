/**
 * Feature Pages - Reusable Template for Product Features
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  MousePointer, Play, CheckCircle2, ArrowRight, Lightbulb,
  Zap, Target, Clock, Shield, Eye, Globe, Blocks, Activity,
  ChevronRight, Layers, RefreshCw, Database,
  ClipboardCheck, BarChart3, GitBranch, Settings, FileText,
  Accessibility, TrendingUp, Lock, PieChart, LayoutDashboard,
  Users, Server, Code2, Gauge, AlertTriangle, CheckSquare,
  Smartphone, Wifi, Map, Compass, Navigation, BrainCircuit, Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MarketingHeader } from '@/components/MarketingHeader';

// Feature configurations
const featureConfigs: Record<string, {
  title: string;
  tagline: string;
  description: string;
  icon: any;
  gradient: string;
  bgGradient: string;
  features: { icon: any; title: string; desc: string }[];
  highlights: string[];
}> = {
  'visual-builder': {
    title: 'Visual Builder',
    tagline: 'Build Tests Without Code',
    description: 'Drag-and-drop test creation with 50+ smart data generators. Build complex test scenarios visually with reusable components and one-click assertions.',
    icon: Blocks,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    features: [
      { icon: Blocks, title: 'Drag & Drop Interface', desc: 'Build test flows visually by dragging and connecting steps. No coding required.' },
      { icon: Database, title: '50+ Data Generators', desc: 'Smart Fill with generators for names, emails, phones, addresses, dates, and more.' },
      { icon: CheckSquare, title: 'One-Click Assertions', desc: 'Add validations instantly - verify text, check visibility, compare values.' },
      { icon: Layers, title: 'Reusable Components', desc: 'Create shared steps and use them across multiple tests for consistency.' },
      { icon: GitBranch, title: 'Conditional Logic', desc: 'Add if/else conditions, loops, and data-driven scenarios.' },
      { icon: RefreshCw, title: 'Version History', desc: 'Track changes and rollback to previous versions anytime.' },
    ],
    highlights: ['Drag & Drop', '50+ Generators', 'Smart Assertions', 'Reusable Steps', 'Conditional Logic']
  },
  'test-management': {
    title: 'Test Management',
    tagline: 'Complete Test Lifecycle',
    description: 'Manage your entire test lifecycle in one place. Test Cases, Suites, Plans, Releases, Runs, and Defects - all connected with full traceability.',
    icon: ClipboardCheck,
    gradient: 'from-slate-600 to-slate-700',
    bgGradient: 'from-slate-50 to-slate-100',
    features: [
      { icon: FileText, title: '6 Integrated Modules', desc: 'Test Cases, Suites, Plans, Releases, Runs, and Defects in one platform.' },
      { icon: Users, title: 'Manual + Automated', desc: 'Execute the same test case manually or automated - unified coverage tracking.' },
      { icon: GitBranch, title: 'Full Traceability', desc: 'Link tests to requirements, track coverage, and see impact of changes.' },
      { icon: BarChart3, title: 'Rich Dashboards', desc: 'Beautiful, actionable dashboards showing coverage, trends, and status.' },
      { icon: Target, title: 'Release Management', desc: 'Plan releases, assign test plans, and track progress to ship with confidence.' },
      { icon: AlertTriangle, title: 'Defect Tracking', desc: 'Log defects from failed tests with full context and screenshots.' },
    ],
    highlights: ['6 Modules', 'Manual + Auto', 'Traceability', 'Dashboards', 'Reports']
  },
  'api-testing': {
    title: 'API Testing',
    tagline: 'Multi-Protocol, Security-First',
    description: 'Test REST, GraphQL, and SOAP APIs in one place. Chain requests, validate schemas, and automatically scan for security vulnerabilities.',
    icon: Globe,
    gradient: 'from-teal-500 to-teal-600',
    bgGradient: 'from-teal-50 to-slate-50',
    features: [
      { icon: Globe, title: 'Multi-Protocol Support', desc: 'REST, GraphQL, and SOAP APIs - all in one testing interface.' },
      { icon: Layers, title: 'Request Chaining', desc: 'Chain API calls together, passing data between requests dynamically.' },
      { icon: Shield, title: 'Security Scanning', desc: 'Automatic checks for SQL injection, XSS, CSRF, and OWASP vulnerabilities.' },
      { icon: FileText, title: 'Schema Validation', desc: 'Validate responses against OpenAPI, GraphQL schemas automatically.' },
      { icon: Lock, title: 'Auth Testing', desc: 'Test OAuth, JWT, API keys, Basic auth, and custom authentication flows.' },
      { icon: BarChart3, title: 'Response Analytics', desc: 'Track response times, error rates, and performance trends.' },
    ],
    highlights: ['REST/GraphQL/SOAP', 'Chaining', 'Security Scan', 'Schema Validation', 'Auth Testing']
  },
  'performance': {
    title: 'Performance Testing',
    tagline: 'Scale to 10,000+ Virtual Users',
    description: 'Enterprise-grade load testing with intelligent auto-correlation. Simulate real-world traffic patterns and get real-time performance insights.',
    icon: Activity,
    gradient: 'from-emerald-500 to-teal-500',
    bgGradient: 'from-emerald-50 to-teal-50',
    features: [
      { icon: Users, title: '10,000+ Virtual Users', desc: 'Scale to thousands of concurrent users to test your application limits.' },
      { icon: RefreshCw, title: 'Auto-Correlation', desc: 'Dynamic values like session IDs and tokens are detected and handled automatically.' },
      { icon: Activity, title: '4 Load Patterns', desc: 'Spike, Stress, Endurance, and Breakpoint testing patterns built-in.' },
      { icon: Gauge, title: 'Real-Time Metrics', desc: 'Live dashboards showing response times, throughput, and error rates.' },
      { icon: Target, title: 'Smart Thresholds', desc: 'Set pass/fail criteria and get alerted when performance degrades.' },
      { icon: BarChart3, title: 'Trend Analysis', desc: 'Track performance over time and catch regressions early.' },
    ],
    highlights: ['10k+ VUs', 'Auto-Correlation', 'Load Patterns', 'Real-Time Metrics', 'Thresholds']
  },
  'visual-testing': {
    title: 'Visual Testing',
    tagline: 'Catch Every Pixel',
    description: 'Detect visual regressions with 6 comparison modes. Pixel-perfect validation with smart diff visualization and baseline management.',
    icon: Eye,
    gradient: 'from-slate-700 to-slate-800',
    bgGradient: 'from-slate-50 to-white',
    features: [
      { icon: Eye, title: '6 Comparison Modes', desc: 'Strict pixel, layout, content, anti-alias, ignore colors, and ignore zones.' },
      { icon: Layers, title: 'Baseline Management', desc: 'Easily update baselines when intentional changes are made.' },
      { icon: Target, title: 'Smart Diff', desc: 'Visual highlighting shows exactly what changed between screenshots.' },
      { icon: Settings, title: 'Ignore Zones', desc: 'Mark dynamic areas to ignore - ads, timestamps, user content.' },
      { icon: GitBranch, title: 'Cross-Browser', desc: 'Compare screenshots across different browsers and viewports.' },
      { icon: CheckCircle2, title: 'Approval Workflow', desc: 'Review and approve visual changes before updating baselines.' },
    ],
    highlights: ['6 Modes', 'Pixel Diff', 'Ignore Zones', 'Baselines', 'Approval Flow']
  },
  'accessibility': {
    title: 'Accessibility Testing',
    tagline: 'WCAG 2.1 Compliance',
    description: 'Automated accessibility scanning with clear remediation guidance. Identify issues by severity and get actionable fix suggestions.',
    icon: Accessibility,
    gradient: 'from-teal-500 to-emerald-500',
    bgGradient: 'from-teal-50 to-emerald-50',
    features: [
      { icon: Accessibility, title: 'WCAG 2.1 Scanning', desc: 'Comprehensive checks against WCAG 2.1 Level A, AA, and AAA criteria.' },
      { icon: AlertTriangle, title: 'Severity Levels', desc: 'Issues categorized as Critical, Serious, Moderate, or Minor.' },
      { icon: Lightbulb, title: 'Fix Suggestions', desc: 'Get specific code snippets and guidance to remediate each issue.' },
      { icon: FileText, title: 'Compliance Reports', desc: 'Generate reports for audits showing compliance status.' },
      { icon: TrendingUp, title: 'Progress Tracking', desc: 'Track accessibility improvements over time with trend charts.' },
      { icon: Code2, title: 'Element Inspection', desc: 'Click any issue to see the exact element and its context.' },
    ],
    highlights: ['WCAG 2.1', 'Severity Levels', 'Fix Guides', 'Reports', 'Progress Tracking']
  },
  'salesforce': {
    title: 'Salesforce Native',
    tagline: '20+ Purpose-Built Tools',
    description: 'Complete Salesforce testing toolkit. SOQL explorer, bulk operations, Apex test runner, and org management - all native to the platform.',
    icon: Database,
    gradient: 'from-sky-500 to-blue-500',
    bgGradient: 'from-sky-50 to-blue-50',
    features: [
      { icon: Database, title: 'SOQL Explorer', desc: 'Write and execute SOQL queries with autocomplete and result visualization.' },
      { icon: Layers, title: 'Bulk Operations', desc: 'Insert, update, delete, and upsert records in bulk for test data.' },
      { icon: Code2, title: 'Apex Test Runner', desc: 'Run Apex tests and see coverage reports directly in the platform.' },
      { icon: Settings, title: 'Org Management', desc: 'Connect and switch between multiple Salesforce orgs easily.' },
      { icon: Eye, title: 'Field Inspector', desc: 'View field metadata, permissions, and dependencies.' },
      { icon: RefreshCw, title: 'Data Factory', desc: 'Generate realistic Salesforce test data with proper relationships.' },
    ],
    highlights: ['20+ Tools', 'SOQL Explorer', 'Bulk Ops', 'Apex Tests', 'Org Management']
  },
  'dashboards': {
    title: 'Analytics & Dashboards',
    tagline: 'Actionable Insights',
    description: 'Beautiful, actionable dashboards that surface what matters. Track coverage, trends, and team performance at a glance.',
    icon: LayoutDashboard,
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    features: [
      { icon: PieChart, title: 'Coverage Dashboard', desc: 'See test coverage across your application at a glance.' },
      { icon: TrendingUp, title: 'Trend Analysis', desc: 'Track pass rates, execution times, and defects over time.' },
      { icon: Users, title: 'Team Metrics', desc: 'Monitor team productivity and test creation velocity.' },
      { icon: Target, title: 'Release Readiness', desc: 'Visual indicators showing release health and blockers.' },
      { icon: BarChart3, title: 'Custom Reports', desc: 'Build custom reports and schedule automated delivery.' },
      { icon: AlertTriangle, title: 'Alerts & Notifications', desc: 'Get notified when metrics cross thresholds.' },
    ],
    highlights: ['Coverage', 'Trends', 'Team Metrics', 'Custom Reports', 'Alerts']
  },
  'flowpilot': {
    title: 'Flowpilot',
    tagline: 'Goal-Based Agentic Testing',
    description: 'The first QA platform with Flowpilot — autonomous AI agents that understand goals, explore intelligently, and test purposefully. Let Flowpilot discover bugs while you sleep.',
    icon: Compass,
    gradient: 'from-teal-600 to-emerald-600',
    bgGradient: 'from-teal-50 to-emerald-50',
    features: [
      { icon: Map, title: 'Flowmap Explorer', desc: 'Visualize and explore all possible user journeys. Discover untested paths automatically.' },
      { icon: Compass, title: 'Autonomous Explorer', desc: 'AI-powered exploration that finds edge cases and bugs without human guidance.' },
      { icon: RefreshCw, title: 'Self-Healing', desc: 'Automatic locator repair when elements change. Zero maintenance, zero flakes.' },
      { icon: FileText, title: 'Test Generator', desc: 'Describe what to test in natural language. AI creates the complete test steps.' },
      { icon: BrainCircuit, title: 'Goal Understanding', desc: 'Agents understand business goals and translate them into test coverage.' },
      { icon: Route, title: 'Path Optimization', desc: 'Intelligent test path selection for maximum coverage with minimum steps.' },
    ],
    highlights: ['Flowmap', 'Explorer', 'Self-Healing', 'AI Generation', 'Goal-Driven']
  },
  'mobile-testing': {
    title: 'Mobile Testing',
    tagline: 'Test on 50+ Real Devices',
    description: 'Complete mobile web emulation with real device profiles, network throttling, touch gestures, and native app testing via Maestro integration.',
    icon: Smartphone,
    gradient: 'from-sky-500 to-indigo-500',
    bgGradient: 'from-sky-50 to-indigo-50',
    features: [
      { icon: Smartphone, title: '50+ Device Profiles', desc: 'iPhone, iPad, Pixel, Galaxy, OnePlus - all major devices with accurate viewports.' },
      { icon: Wifi, title: 'Network Throttling', desc: '4G LTE, 3G, Slow 3G, Offline - test how your app behaves on any connection.' },
      { icon: Navigation, title: 'Touch Gestures', desc: 'Tap, swipe, pinch, scroll - full touch event emulation for realistic testing.' },
      { icon: Target, title: 'Native App Testing', desc: 'Test iOS and Android native apps with Maestro integration.' },
      { icon: Layers, title: 'Viewport Emulation', desc: 'Accurate device viewports with proper device pixel ratio and user agents.' },
      { icon: Activity, title: 'Performance Metrics', desc: 'Mobile-specific performance tracking including First Contentful Paint and Time to Interactive.' },
    ],
    highlights: ['50+ Devices', 'Network Throttling', 'Touch Events', 'Native Apps', 'Maestro']
  },
};

export default function FeaturePage() {
  const navigate = useNavigate();
  const { feature } = useParams<{ feature: string }>();
  
  const config = feature ? featureConfigs[feature] : null;
  
  if (!config) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-4">Feature Not Found</h1>
          <Button onClick={() => navigate('/')}>Go Home</Button>
        </div>
      </div>
    );
  }

  const Icon = config.icon;

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      
      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">{config.title}</p>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              {config.tagline}
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed mb-8">
              {config.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {config.highlights.map((h, i) => (
                <span key={i} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">{h}</span>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button
                size="lg"
                onClick={() => navigate('/signup')}
                className="h-12 px-8 text-white font-semibold rounded-xl bg-slate-900 hover:bg-slate-800"
              >
                Try It Free <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="h-12 px-8 rounded-xl"
                onClick={() => navigate(`/demo?feature=${feature}`)}
              >
                <Play className="w-5 h-5 mr-2" /> Watch Demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Key Capabilities</h2>
            <p className="text-slate-600">Everything you need for {config.title.toLowerCase()}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {config.features.map((feat, idx) => (
              <div key={idx} className="p-6 bg-slate-50 rounded-2xl hover:shadow-md transition-shadow">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-slate-200">
                  <feat.icon className="w-6 h-6 text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to get started?</h2>
          <p className="text-xl text-slate-400 mb-8">Start your free trial today. No credit card required.</p>
          <Button
            size="lg"
            onClick={() => navigate('/signup')}
            className="h-14 px-10 bg-white text-slate-800 hover:bg-slate-100 font-semibold rounded-xl"
          >
            Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <p className="text-slate-400 text-sm">© 2024 Flowstral. All rights reserved.</p>
      </footer>
    </div>
  );
}

