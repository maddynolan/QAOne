/**
 * Feature Pages - Reusable Template for Product Features
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useParams } from 'react-router-dom';
import { 
  MousePointer, Play, CheckCircle2, ArrowRight, Lightbulb, 
  Zap, Target, Clock, Shield, Eye, Globe, Blocks, Activity,
  ChevronRight, Sparkles, Layers, RefreshCw, Database, Rocket,
  ClipboardCheck, BarChart3, GitBranch, Settings, FileText,
  Accessibility, TrendingUp, Lock, PieChart, LayoutDashboard,
  Users, Server, Code2, Gauge, AlertTriangle, CheckSquare,
  Smartphone, Wifi, Map, Compass, Navigation, BrainCircuit, Route
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Shared Header
function MarketingHeader() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
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
            <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
            <Link to="/resources/docs" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Docs</Link>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => navigate('/signin')}>
            Sign In
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" onClick={() => navigate('/signup')}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

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
      { icon: Sparkles, title: '50+ Data Generators', desc: 'Smart Fill with generators for names, emails, phones, addresses, dates, and more.' },
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
    gradient: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-50 to-purple-50',
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
    gradient: 'from-pink-500 to-rose-500',
    bgGradient: 'from-pink-50 to-rose-50',
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
    gradient: 'from-indigo-500 to-violet-500',
    bgGradient: 'from-indigo-50 to-violet-50',
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
  'telic-agents': {
    title: 'Telic Agents',
    tagline: 'Goal-Based Agentic Testing',
    description: 'The first QA platform with autonomous AI agents that understand goals, explore intelligently, and test purposefully. Let Telic Agents discover bugs while you sleep.',
    icon: Compass,
    gradient: 'from-fuchsia-500 to-pink-500',
    bgGradient: 'from-fuchsia-50 to-pink-50',
    features: [
      { icon: Map, title: 'Flowmap Explorer', desc: 'Visualize and explore all possible user journeys. Discover untested paths automatically.' },
      { icon: Compass, title: 'Autonomous Explorer', desc: 'AI-powered exploration that finds edge cases and bugs without human guidance.' },
      { icon: RefreshCw, title: 'Self-Healing', desc: 'Automatic locator repair when elements change. Zero maintenance, zero flakes.' },
      { icon: Sparkles, title: 'Test Generator', desc: 'Describe what to test in natural language. AI creates the complete test steps.' },
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
    <div className={cn("min-h-screen bg-gradient-to-b", config.bgGradient, "to-white")}>
      <MarketingHeader />
      
      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className={cn("mb-4 border-0 px-4 py-1.5", `bg-gradient-to-r ${config.gradient} text-white`)}>
              <Icon className="w-4 h-4 mr-2" /> {config.title}
            </Badge>
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              {config.tagline}
            </h1>
            <p className="text-xl text-slate-600 leading-relaxed mb-8">
              {config.description}
            </p>
            <div className="flex flex-wrap gap-2 justify-center mb-8">
              {config.highlights.map((h, i) => (
                <Badge key={i} className="bg-white/80 text-slate-700 border border-slate-200">{h}</Badge>
              ))}
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              <Button 
                size="lg"
                onClick={() => navigate('/signup')}
                className={cn("h-12 px-8 text-white font-semibold rounded-xl shadow-lg", `bg-gradient-to-r ${config.gradient}`)}
              >
                <Rocket className="w-5 h-5 mr-2" /> Try It Free
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
              <div key={idx} className="p-6 bg-slate-50 rounded-2xl hover:shadow-lg hover:-translate-y-1 transition-all">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-4", `bg-gradient-to-r ${config.gradient}`)}>
                  <feat.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feat.title}</h3>
                <p className="text-sm text-slate-500">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={cn("py-20 px-6", `bg-gradient-to-r ${config.gradient}`)}>
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-white/80 mb-8">Start your free trial today. No credit card required.</p>
          <Button 
            size="lg" 
            onClick={() => navigate('/signup')}
            className="h-14 px-10 bg-white text-slate-800 hover:bg-white/90 font-semibold rounded-xl shadow-lg"
          >
            <Rocket className="w-5 h-5 mr-2" /> Start Free Trial
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

