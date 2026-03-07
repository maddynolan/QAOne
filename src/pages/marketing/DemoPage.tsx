/**
 * Watch Demo Page - Interactive Product Demo
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { trackCTAClick } from '@/lib/web-analytics';
import {
  ArrowRight, Play, Pause, SkipForward, RotateCcw, CheckCircle2,
  MousePointer, Type, Eye, Zap, Database, BarChart3, Shield, Workflow,
  ChevronRight, ChevronLeft, Maximize2, Volume2, VolumeX, Code,
  Compass, Map, Sparkles, RefreshCw, Target, Smartphone, Wifi, Globe
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
            <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
            <Link to="/compare/katalon" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Compare</Link>
            <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Blog</Link>
            <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => { trackCTAClick('sign_in', '/demo'); navigate('/signin'); }}>
            Sign In
          </Button>
          <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700" onClick={() => { trackCTAClick('start_free', '/demo'); navigate('/signup'); }}>
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

const demoSteps = [
  {
    id: 'recorder',
    title: 'Smart Trace',
    subtitle: 'Trace tests with intelligent recognition',
    description: 'Watch how Flowstral captures your interactions and automatically generates robust test steps with smart element recognition.',
    duration: 45,
    highlights: [
      'Click to record your browser interactions',
      'Intelligent element locators generated automatically',
      'Real-time suggestions for assertions',
      'Salesforce metadata awareness for SF apps'
    ],
    icon: MousePointer,
    color: 'amber'
  },
  {
    id: 'builder',
    title: 'Visual Builder',
    subtitle: 'Build tests without code',
    description: 'See how easy it is to create and edit test cases using our drag-and-drop visual builder with 50+ smart data generators.',
    duration: 60,
    highlights: [
      'Drag and drop test steps',
      '50+ smart data generators (names, emails, dates)',
      'Conditional logic and loops',
      'Reusable components and modules'
    ],
    icon: Workflow,
    color: 'blue'
  },
  {
    id: 'management',
    title: 'Test Management',
    subtitle: 'Unified test lifecycle',
    description: 'Discover how test cases seamlessly work for both manual and automated execution, maximizing your test coverage.',
    duration: 50,
    highlights: [
      'Same test runs manually or automated',
      'Test suites, plans, and releases',
      'Full traceability to requirements',
      'Defect management integration'
    ],
    icon: Database,
    color: 'emerald'
  },
  {
    id: 'api',
    title: 'API Testing',
    subtitle: 'Multi-protocol API testing',
    description: 'Learn how to test REST, GraphQL, and SOAP APIs with request chaining and security scanning.',
    duration: 55,
    highlights: [
      'REST, GraphQL, SOAP support',
      'Request chaining and variables',
      'Schema validation',
      'Security scanning (SQL injection, OWASP)'
    ],
    icon: Zap,
    color: 'violet'
  },
  {
    id: 'performance',
    title: 'Performance Testing',
    subtitle: 'Scale to 50k+ virtual users',
    description: 'See how to create load tests with auto-correlation and real-time metrics visualization.',
    duration: 65,
    highlights: [
      'Generate up to 50,000+ virtual users',
      'Auto-correlation for dynamic values',
      'Multiple load patterns (spike, stress, etc.)',
      'Real-time performance dashboards'
    ],
    icon: BarChart3,
    color: 'rose'
  },
  {
    id: 'dashboards',
    title: 'Actionable Dashboards',
    subtitle: 'Beautiful insights at a glance',
    description: 'Explore our beautiful, actionable dashboards that provide instant visibility into test coverage and quality trends.',
    duration: 40,
    highlights: [
      'Real-time test execution status',
      'Coverage metrics and trends',
      'Team performance analytics',
      'Customizable widgets and reports'
    ],
    icon: Shield,
    color: 'cyan'
  },
  {
    id: 'flowpilot',
    title: 'Flowpilot',
    subtitle: 'Goal-based agentic testing',
    description: 'Watch autonomous AI agents explore your app, find bugs, and generate tests from natural language goals.',
    duration: 55,
    highlights: [
      'Describe goals in natural language',
      'AI agents autonomously explore your app',
      'Auto-generate test steps from discoveries',
      'Self-healing locators that adapt to changes'
    ],
    icon: Compass,
    color: 'fuchsia'
  },
  {
    id: 'mobile',
    title: 'Mobile Testing',
    subtitle: 'Test on 50+ real devices',
    description: 'See how to test mobile web apps with real device emulation, network throttling, and native app testing.',
    duration: 45,
    highlights: [
      '50+ iOS and Android device profiles',
      'Network throttling (4G, 3G, Offline)',
      'Touch events and gestures',
      'Native app testing with Maestro'
    ],
    icon: Smartphone,
    color: 'sky'
  },
];

function DemoVisualizer({ step, isPlaying, progress }: { step: typeof demoSteps[0]; isPlaying: boolean; progress: number }) {
  const [animationStep, setAnimationStep] = useState(0);

  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setAnimationStep(prev => (prev + 1) % 7);
    }, 1800);
    return () => clearInterval(interval);
  }, [isPlaying]);

  const colorClasses = {
    amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-300', light: 'bg-amber-50' },
    blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-300', light: 'bg-blue-50' },
    emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-300', light: 'bg-emerald-50' },
    violet: { bg: 'bg-violet-500', text: 'text-violet-600', border: 'border-violet-300', light: 'bg-violet-50' },
    rose: { bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-300', light: 'bg-rose-50' },
    cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-300', light: 'bg-cyan-50' },
    fuchsia: { bg: 'bg-fuchsia-500', text: 'text-fuchsia-600', border: 'border-fuchsia-300', light: 'bg-fuchsia-50' },
    sky: { bg: 'bg-sky-500', text: 'text-sky-600', border: 'border-sky-300', light: 'bg-sky-50' },
  };

  const colors = colorClasses[step.color as keyof typeof colorClasses];

  // Recorded steps data (generic masked)
  const recordedSteps = [
    { num: '01', icon: '🌐', action: 'Navigate to', target: 'app.salesforce.com', url: 'https://app.salesforce.com/' },
    { num: '02', icon: '👆', action: 'Click', target: '"Username"', detail: 'Username' },
    { num: '03', icon: '✏️', action: 'Fill "username":', target: '"user@company.com"', detail: 'username → user@company.com' },
    { num: '04', icon: '✏️', action: 'Fill "password":', target: '"••••••••"', detail: 'password → ••••••••', locked: true },
    { num: '05', icon: '👆', action: 'Click', target: '"Log In"', detail: 'Log In' },
    { num: '06', icon: '🌐', action: 'Navigate to', target: 'app.lightning.force.com', url: 'https://app.lightning.force.com/one/one.app' },
    { num: '07', icon: '🌐', action: 'Navigate to', target: 'lightning/Welcome', url: 'https://app.lightning.force.com/lightning/n/Welcome' },
  ];

  // Smart suggestions (login page context)
  const suggestions = [
    { name: 'Username Input', type: 'Fill', icon: '✏️' },
    { name: 'Password Input', type: 'Fill', icon: '🔒' },
    { name: 'Log In Button', type: 'Click', icon: '👆' },
    { name: 'Forgot Password', type: 'Click', icon: '🔗' },
    { name: 'Remember Me', type: 'Check', icon: '☑️' },
    { name: 'SSO Login', type: 'Click', icon: '🔐' },
    { name: 'Help Link', type: 'Click', icon: '❓' },
    { name: 'Create Account', type: 'Click', icon: '➕' },
  ];

  // Recorder-specific visualization (light theme)
  if (step.id === 'recorder') {
    return (
      <div className="relative w-full h-[420px] bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
        {/* Top Toolbar */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <div className={cn(
              "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium",
              isPlaying ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}>
              <div className={cn("w-2 h-2 rounded-full", isPlaying ? "bg-emerald-500 animate-pulse" : "bg-slate-400")} />
              {isPlaying ? 'Recording' : 'Ready'} • {recordedSteps.length} steps
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5" /> Code
            </button>
            <button className="px-3 py-1.5 text-xs bg-emerald-500 hover:bg-emerald-600 rounded-lg text-white flex items-center gap-1.5">
              <Play className="w-3.5 h-3.5" /> Run
            </button>
            <button className="px-3 py-1.5 text-xs bg-blue-500 hover:bg-blue-600 rounded-lg text-white flex items-center gap-1.5">
              <Workflow className="w-3.5 h-3.5" /> Builder
            </button>
          </div>
        </div>

        <div className="flex h-[calc(100%-44px)]">
          {/* Left Panel - Recorded Steps */}
          <div className="w-[55%] border-r border-slate-200 overflow-hidden">
            {/* URL Bar */}
            <div className="px-4 py-2 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-500">
                <div className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center text-[8px]">🌐</div>
                https://app.salesforce.com/
              </div>
            </div>

            {/* Control Buttons */}
            <div className="px-4 py-2 flex gap-2">
              <button className="flex-1 py-2 bg-red-500 hover:bg-red-600 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-1.5">
                <div className="w-2 h-2 bg-white rounded-sm" /> Stop
              </button>
              <button className="px-4 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white text-xs font-medium flex items-center justify-center gap-1.5">
                <Pause className="w-3.5 h-3.5" /> Pause
              </button>
            </div>

            {/* Steps Header */}
            <div className="px-4 py-2 flex items-center justify-between border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">Recorded Steps</span>
                <Badge className="bg-blue-100 text-blue-700 text-[10px]">{recordedSteps.length}</Badge>
              </div>
              <button className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                🗑️ Clear
              </button>
            </div>

            {/* Steps List */}
            <div className="overflow-y-auto max-h-[200px] px-2">
              {recordedSteps.map((step, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-lg mb-1 transition-all duration-300",
                    isPlaying && animationStep === idx 
                      ? "bg-blue-50 border border-blue-300 shadow-sm" 
                      : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] text-slate-400 w-5">{step.num}</span>
                    <span className="text-sm">{step.icon}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-800 truncate">
                      {step.action} {step.target}
                      {step.locked && <span className="ml-1 text-amber-500">🔒</span>}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">{step.detail || step.url}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Save Button */}
            <div className="absolute bottom-0 left-0 w-[55%] p-3 bg-white border-t border-slate-200">
              <button className="w-full py-2.5 bg-blue-500 hover:bg-blue-600 rounded-lg text-white text-sm font-medium flex items-center justify-center gap-2">
                📋 Save as New Test Case
              </button>
            </div>
          </div>

          {/* Right Panel - Suggestions */}
          <div className="w-[45%] bg-slate-50 overflow-hidden flex flex-col">
            {/* Tabs */}
            <div className="flex border-b border-slate-200 bg-white">
              <button className="flex-1 px-4 py-2.5 text-xs font-medium text-blue-600 border-b-2 border-blue-500 bg-blue-50 flex items-center justify-center gap-1.5">
                💡 Suggestions <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">{suggestions.length}</Badge>
              </button>
              <button className="flex-1 px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700">
                SF Tools
              </button>
              <button className="flex-1 px-4 py-2.5 text-xs font-medium text-slate-500 hover:text-slate-700">
                SF Context
              </button>
            </div>

            {/* Suggestion Header */}
            <div className="px-3 py-2 bg-white border-b border-slate-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  ✨ Suggested Actions <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">{suggestions.length}</Badge>
                </span>
                <div className="flex gap-1">
                  <button className="p-1 text-slate-400 hover:text-slate-600"><Eye className="w-3 h-3" /></button>
                  <button className="p-1 text-slate-400 hover:text-slate-600"><RotateCcw className="w-3 h-3" /></button>
                </div>
              </div>
              {/* Filter Pills */}
              <div className="flex flex-wrap gap-1">
                <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">● Buttons 21</Badge>
                <Badge className="bg-blue-100 text-blue-700 text-[9px]">● Links 0</Badge>
                <Badge className="bg-amber-100 text-amber-700 text-[9px]">● Inputs 0</Badge>
                <Badge className="bg-violet-100 text-violet-700 text-[9px]">● Headings 1</Badge>
              </div>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              {suggestions.map((sug, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg mb-1 transition-all duration-300",
                    isPlaying && animationStep % suggestions.length === idx 
                      ? "bg-emerald-50 border border-emerald-300" 
                      : "bg-white hover:bg-slate-50 border border-slate-100"
                  )}
                >
                  <div className="w-6 h-6 rounded bg-emerald-100 flex items-center justify-center text-xs">
                    {sug.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-800">{sug.name}</div>
                    <div className="text-[10px] text-slate-400">{sug.type}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Default visualization for other steps (keep dark theme for variety)
  const renderDefaultContent = () => {
    switch (step.id) {
      case 'builder':
        return (
          <div className="h-full bg-white rounded-lg p-4 overflow-hidden border border-slate-200">
            <div className="space-y-2">
              {['Navigate to URL', 'Click Button', 'Fill Form', 'Assert Text'].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-3 rounded-lg transition-all duration-500 border",
                    isPlaying && animationStep % 4 === idx 
                      ? "bg-blue-50 border-blue-300 translate-x-2" 
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <div className={cn("w-3 h-3 rounded-full", isPlaying && animationStep % 4 === idx ? "bg-blue-500" : "bg-slate-300")} />
                  <span className="text-sm text-slate-700">{item}</span>
                  {isPlaying && animationStep % 4 === idx && (
                    <Badge className="ml-auto text-[10px] bg-blue-500 text-white border-0">Editing</Badge>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
              <div className="text-[11px] text-emerald-600 font-medium mb-1">Smart Fill Preview</div>
              <div className="text-sm text-emerald-700 font-mono">
                {isPlaying ? ['John Smith', 'john@acme.com', '(555) 123-4567', '123 Main St'][animationStep % 4] : 'Click to generate...'}
              </div>
            </div>
          </div>
        );

      case 'management':
        return (
          <div className="h-full bg-white rounded-lg p-4 overflow-hidden border border-slate-200">
            <div className="flex items-center gap-2 text-sm text-slate-800 mb-3">
              <Workflow className="w-4 h-4 text-emerald-500" />
              <span className="font-medium">Login Test Suite</span>
              <Badge className="ml-auto bg-emerald-100 text-emerald-700">12 Tests</Badge>
            </div>
            {['Valid Login', 'Invalid Password', 'Remember Me', 'SSO Flow'].map((test, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-center gap-2 pl-6 py-2 rounded-lg mb-1 transition-all",
                  isPlaying && animationStep % 4 === idx ? "bg-emerald-50 text-emerald-700" : "text-slate-600"
                )}
              >
                {isPlaying && animationStep % 4 === idx ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border border-slate-300" />
                )}
                <span className="text-sm">{test}</span>
              </div>
            ))}
          </div>
        );

      case 'api':
        return (
          <div className="h-full bg-white rounded-lg p-3 overflow-hidden border border-slate-200">
            {/* Request/Response */}
            <div className="flex items-center gap-2 mb-2">
              <Badge className={cn("text-[10px]", isPlaying ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600")}>
                {isPlaying ? 'POST' : 'GET'}
              </Badge>
              <span className="text-xs text-slate-500 font-mono">/api/v1/users</span>
              {isPlaying && <Badge className="ml-auto text-[9px] bg-emerald-100 text-emerald-700">200 OK</Badge>}
            </div>
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-4 gap-1.5 mb-2">
              {[
                { label: 'Latency', value: isPlaying ? '42ms' : '--', color: 'blue' },
                { label: 'Size', value: isPlaying ? '2.4KB' : '--', color: 'violet' },
                { label: 'Time', value: isPlaying ? '156ms' : '--', color: 'amber' },
                { label: 'DNS', value: isPlaying ? '12ms' : '--', color: 'emerald' },
              ].map((m, i) => (
                <div key={i} className="p-1.5 bg-slate-50 rounded text-center border border-slate-100">
                  <div className={cn("text-xs font-bold", `text-${m.color}-600`)}>{m.value}</div>
                  <div className="text-[8px] text-slate-400">{m.label}</div>
                </div>
              ))}
            </div>

            {/* Response Preview */}
            <div className="bg-slate-900 rounded p-2 text-[10px] font-mono h-16 overflow-hidden">
              <div className="text-slate-400">// Response</div>
              <div className="text-emerald-400">{"{"} "users": [{"{"}"id": 1, "name": "John"{"}"}...] {"}"}</div>
            </div>

            {/* Validations */}
            {isPlaying && (
              <div className="mt-2 flex flex-wrap gap-1">
                <Badge className="text-[8px] bg-emerald-100 text-emerald-700 border-0">✓ Schema Valid</Badge>
                <Badge className="text-[8px] bg-blue-100 text-blue-700 border-0">✓ Headers OK</Badge>
                <Badge className="text-[8px] bg-violet-100 text-violet-700 border-0">✓ No SQLi</Badge>
              </div>
            )}
          </div>
        );

      case 'performance':
        return (
          <div className="h-full bg-white rounded-lg p-3 overflow-hidden border border-slate-200">
            {/* Response Time Graph */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-medium">Response Time Distribution</span>
              {isPlaying && <Badge className="text-[8px] bg-emerald-100 text-emerald-700">Live</Badge>}
            </div>
            <div className="flex items-end gap-0.5 h-12 mb-2">
              {[20, 35, 55, 70, 90, 85, 75, 60, 45, 30, 25, 20].map((height, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex-1 rounded-t transition-all duration-300",
                    isPlaying && idx <= animationStep * 2 ? "bg-gradient-to-t from-rose-500 to-rose-400" : "bg-slate-200"
                  )}
                  style={{ height: `${isPlaying ? height : 20}%` }}
                />
              ))}
            </div>
            
            {/* Key Metrics - 2 rows */}
            <div className="grid grid-cols-3 gap-1.5 mb-2">
              {[
                { label: 'VUs', value: isPlaying ? `${(animationStep + 1) * 2500}` : '0', color: 'rose' },
                { label: 'Throughput', value: isPlaying ? '1,847/s' : '--', color: 'blue' },
                { label: 'Error Rate', value: isPlaying ? '0.02%' : '--', color: 'emerald' },
              ].map((m, i) => (
                <div key={i} className="p-1.5 bg-slate-50 rounded text-center border border-slate-100">
                  <div className={cn("text-sm font-bold", `text-${m.color}-600`)}>{m.value}</div>
                  <div className="text-[8px] text-slate-400">{m.label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { label: 'P50', value: isPlaying ? '45ms' : '--', color: 'emerald' },
                { label: 'P90', value: isPlaying ? '128ms' : '--', color: 'amber' },
                { label: 'P95', value: isPlaying ? '245ms' : '--', color: 'orange' },
                { label: 'P99', value: isPlaying ? '512ms' : '--', color: 'rose' },
              ].map((m, i) => (
                <div key={i} className="p-1 bg-slate-50 rounded text-center border border-slate-100">
                  <div className={cn("text-xs font-bold", `text-${m.color}-600`)}>{m.value}</div>
                  <div className="text-[7px] text-slate-400">{m.label}</div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'dashboards':
        return (
          <div className="h-full bg-white rounded-lg p-4 overflow-hidden border border-slate-200">
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Passed', value: isPlaying ? '847' : '--', color: 'emerald' },
                { label: 'Failed', value: isPlaying ? '12' : '--', color: 'red' },
                { label: 'Coverage', value: isPlaying ? '94%' : '--', color: 'cyan' },
              ].map((stat, idx) => (
                <div key={idx} className={cn("p-3 rounded-lg text-center", `bg-${stat.color}-50 border border-${stat.color}-200`)}>
                  <div className={cn("text-lg font-bold", `text-${stat.color}-600`)}>{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
            <div className="h-16 flex items-end gap-0.5">
              {[30, 45, 40, 55, 60, 70, 65, 80, 75, 90].map((h, idx) => (
                <div
                  key={idx}
                  className={cn("flex-1 rounded-t transition-all duration-300", isPlaying ? "bg-cyan-500" : "bg-slate-200")}
                  style={{ height: `${isPlaying ? h : 30}%`, transitionDelay: `${idx * 100}ms` }}
                />
              ))}
            </div>
          </div>
        );

      case 'flowpilot':
        return (
          <div className="h-full bg-white rounded-lg p-3 overflow-hidden border border-slate-200">
            {/* Goal Input */}
            <div className="flex items-center gap-2 mb-3 p-2 bg-fuchsia-50 rounded-lg border border-fuchsia-200">
              <Target className="w-4 h-4 text-fuchsia-500" />
              <span className="text-xs text-fuchsia-700 font-medium">
                {isPlaying ? '"Test user login with invalid credentials"' : 'Enter your test goal...'}
              </span>
              {isPlaying && (
                <Badge className="ml-auto text-[8px] bg-fuchsia-500 text-white border-0 animate-pulse">
                  AI Processing
                </Badge>
              )}
            </div>

            {/* Agent Activity */}
            <div className="space-y-2 mb-3">
              {[
                { agent: 'Explorer', action: 'Scanning login page...', icon: Compass, status: animationStep > 0 },
                { agent: 'Generator', action: 'Creating test steps...', icon: Sparkles, status: animationStep > 2 },
                { agent: 'Self-Healer', action: 'Optimizing locators...', icon: RefreshCw, status: animationStep > 4 },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded-lg border transition-all",
                    isPlaying && item.status 
                      ? "bg-emerald-50 border-emerald-300" 
                      : "bg-slate-50 border-slate-200"
                  )}
                >
                  <item.icon className={cn(
                    "w-4 h-4",
                    isPlaying && item.status ? "text-emerald-500" : "text-slate-400"
                  )} />
                  <div className="flex-1">
                    <div className="text-xs font-medium text-slate-700">{item.agent}</div>
                    <div className="text-[10px] text-slate-500">{isPlaying && item.status ? item.action : 'Waiting...'}</div>
                  </div>
                  {isPlaying && item.status && (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  )}
                </div>
              ))}
            </div>

            {/* Generated Steps */}
            {isPlaying && animationStep > 3 && (
              <div className="p-2 bg-slate-900 rounded-lg">
                <div className="text-[9px] text-slate-400 mb-1">Generated Test Steps</div>
                <div className="text-[10px] font-mono text-emerald-400 space-y-0.5">
                  <div>1. Navigate to /login</div>
                  <div>2. Fill username: "test@demo.com"</div>
                  <div>3. Fill password: "wrong123"</div>
                  <div className={cn(animationStep > 5 ? "opacity-100" : "opacity-0", "transition-opacity")}>
                    4. Click "Sign In" button
                  </div>
                  <div className={cn(animationStep > 5 ? "opacity-100" : "opacity-0", "transition-opacity")}>
                    5. Assert error: "Invalid credentials"
                  </div>
                </div>
              </div>
            )}
          </div>
        );

      case 'mobile':
        return (
          <div className="h-full bg-white rounded-lg p-3 overflow-hidden border border-slate-200">
            {/* Device Selector */}
            <div className="flex items-center gap-2 mb-3">
              <div className="flex gap-1">
                {['iPhone 15', 'Pixel 8', 'iPad Pro'].map((device, idx) => (
                  <button
                    key={device}
                    className={cn(
                      "px-2 py-1 text-[10px] rounded-lg border transition-all",
                      isPlaying && animationStep % 3 === idx
                        ? "bg-sky-500 text-white border-sky-500"
                        : "bg-white text-slate-600 border-slate-200 hover:border-sky-300"
                    )}
                  >
                    {device}
                  </button>
                ))}
              </div>
            </div>

            {/* Phone Frame */}
            <div className="flex gap-3">
              <div className="flex-shrink-0">
                <div className="w-24 h-44 bg-slate-900 rounded-xl p-1 relative">
                  <div className="absolute top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-slate-700 rounded-full" />
                  <div className="w-full h-full bg-gradient-to-b from-sky-100 to-white rounded-lg overflow-hidden flex flex-col">
                    <div className="h-4 bg-sky-500 flex items-center justify-center">
                      <span className="text-[6px] text-white font-medium">app.example.com</span>
                    </div>
                    <div className="flex-1 p-1.5 space-y-1">
                      <div className="h-2 bg-slate-200 rounded w-3/4" />
                      <div className="h-2 bg-slate-200 rounded w-1/2" />
                      <div className={cn(
                        "h-4 rounded flex items-center justify-center transition-all",
                        isPlaying ? "bg-sky-500" : "bg-slate-300"
                      )}>
                        <span className="text-[5px] text-white font-medium">Login</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Network & Touch Info */}
              <div className="flex-1 space-y-2">
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Wifi className="w-3 h-3 text-sky-500" />
                    <span className="text-[10px] font-medium text-slate-700">Network</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {['4G LTE', '3G', 'Slow 3G', 'Offline'].map((net, idx) => (
                      <div
                        key={net}
                        className={cn(
                          "px-1.5 py-0.5 text-[8px] rounded text-center transition-all",
                          isPlaying && animationStep % 4 === idx
                            ? "bg-sky-500 text-white"
                            : "bg-white text-slate-500 border border-slate-200"
                        )}
                      >
                        {net}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-3 h-3 text-emerald-500" />
                    <span className="text-[10px] font-medium text-slate-700">Touch Events</span>
                  </div>
                  <div className="flex gap-1">
                    {['Tap', 'Swipe', 'Pinch', 'Long Press'].map((touch, idx) => (
                      <Badge
                        key={touch}
                        className={cn(
                          "text-[7px] border-0",
                          isPlaying && animationStep === idx + 1
                            ? "bg-emerald-500 text-white animate-pulse"
                            : "bg-emerald-100 text-emerald-700"
                        )}
                      >
                        {touch}
                      </Badge>
                    ))}
                  </div>
                </div>

                {isPlaying && (
                  <div className="flex items-center gap-1.5 p-1.5 bg-emerald-50 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    <span className="text-[9px] text-emerald-700 font-medium">
                      Recording on {['iPhone 15', 'Pixel 8', 'iPad Pro'][animationStep % 3]}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="relative w-full h-[420px] bg-gradient-to-br from-slate-50 to-white rounded-2xl overflow-hidden border border-slate-200 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shadow-lg", colors.bg)}>
            <step.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-slate-800 font-semibold">{step.title}</h3>
            <p className="text-slate-500 text-xs">{step.subtitle}</p>
          </div>
        </div>
        {isPlaying && (
          <Badge className={cn("animate-pulse shadow-sm", colors.bg, "text-white border-0")}>
            <div className="w-2 h-2 rounded-full bg-white mr-1.5 animate-pulse" />
            Live Demo
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-6 h-[calc(100%-130px)] grid grid-cols-5 gap-4">
        <div className="col-span-3">
          {renderDefaultContent()}
        </div>
        <div className="col-span-2 bg-slate-50 rounded-xl p-4 border border-slate-200">
          <div className="text-xs text-slate-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> Key Features
          </div>
          <div className="space-y-2">
            {step.highlights.map((highlight, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex items-start gap-2 p-2 rounded-lg transition-all duration-500 border",
                  animationStep >= idx 
                    ? `${colors.light} ${colors.border}`
                    : "bg-white border-slate-100 opacity-60"
                )}
              >
                {animationStep >= idx ? (
                  <CheckCircle2 className={cn("w-4 h-4 mt-0.5 flex-shrink-0", colors.text)} />
                ) : (
                  <div className="w-4 h-4 mt-0.5 rounded-full border border-slate-300 flex-shrink-0" />
                )}
                <span className={cn(
                  "text-xs leading-tight",
                  animationStep >= idx ? "text-slate-700" : "text-slate-400"
                )}>
                  {highlight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 right-0 px-6 pb-4">
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div 
            className={cn("h-full transition-all duration-300 rounded-full", colors.bg)}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// Map feature page names to demo step IDs
const featureToStepMap: Record<string, string> = {
  'visual-builder': 'builder',
  'test-management': 'management',
  'api-testing': 'api',
  'performance': 'performance',
  'dashboards': 'dashboards',
  'smart-recorder': 'recorder',
  'flowpilot': 'flowpilot',
  'mobile-testing': 'mobile',
};

export default function DemoPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Handle feature query parameter to auto-select step
  useEffect(() => {
    const feature = searchParams.get('feature');
    if (feature) {
      const stepId = featureToStepMap[feature] || feature;
      const stepIndex = demoSteps.findIndex(s => s.id === stepId);
      if (stepIndex >= 0) {
        setCurrentStep(stepIndex);
        setIsPlaying(true); // Auto-play when coming from feature page
      }
    }
  }, [searchParams]);

  const step = demoSteps[currentStep];

  useEffect(() => {
    if (!isPlaying) return;
    
    const duration = step.duration * 1000;
    const startTime = Date.now();
    
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        if (currentStep < demoSteps.length - 1) {
          setCurrentStep(prev => prev + 1);
          setProgress(0);
        } else {
          setIsPlaying(false);
        }
      }
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, currentStep, step.duration]);

  const handlePlayPause = () => setIsPlaying(!isPlaying);
  const handleNext = () => {
    if (currentStep < demoSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
      setProgress(0);
    }
  };
  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
      setProgress(0);
    }
  };
  const handleRestart = () => {
    setCurrentStep(0);
    setProgress(0);
    setIsPlaying(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-blue-50">
      <MarketingHeader />

      {/* Hero */}
      <section className="pt-32 pb-8 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <Badge className="mb-4 bg-violet-100 text-violet-700 border-violet-200 px-4 py-1.5">
            <Play className="w-4 h-4 mr-1 inline" /> Interactive Demo
          </Badge>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            See Flowstral in Action
          </h1>
          <p className="text-xl text-slate-600 mb-8">
            Explore how Flowstral transforms your QA workflow in this interactive demo
          </p>
        </div>
      </section>

      {/* Demo Player */}
      <section className="pb-12 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Video Player Area */}
          <div className="bg-white rounded-3xl p-6 shadow-2xl border border-slate-200">
            <DemoVisualizer step={step} isPlaying={isPlaying} progress={progress} />
            
            {/* Controls */}
            <div className="flex items-center justify-between mt-6">
              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-500 hover:text-slate-900"
                  onClick={handlePrev}
                  disabled={currentStep === 0}
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  size="lg"
                  onClick={handlePlayPause}
                  className={cn(
                    "w-14 h-14 rounded-full shadow-lg",
                    isPlaying 
                      ? "bg-slate-100 text-slate-900 hover:bg-slate-200" 
                      : "bg-violet-600 text-white hover:bg-violet-700"
                  )}
                >
                  {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-500 hover:text-slate-900"
                  onClick={handleNext}
                  disabled={currentStep === demoSteps.length - 1}
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="text-center">
                <p className="text-slate-800 font-medium">{step.title}</p>
                <p className="text-sm text-slate-500">{currentStep + 1} of {demoSteps.length}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-500 hover:text-slate-900"
                  onClick={handleRestart}
                >
                  <RotateCcw className="w-5 h-5" />
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-500 hover:text-slate-900"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </Button>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="text-slate-500 hover:text-slate-900"
                >
                  <Maximize2 className="w-5 h-5" />
                </Button>
              </div>
            </div>
          </div>

          {/* Step Description */}
          <div className="mt-8 p-6 bg-white rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-xl font-bold text-slate-900 mb-2">{step.title}</h3>
            <p className="text-slate-600 mb-4">{step.description}</p>
            <div className="flex flex-wrap gap-2">
              {step.highlights.map((highlight, idx) => (
                <Badge key={idx} variant="outline" className="border-slate-300 text-slate-600 bg-slate-50">
                  {highlight}
                </Badge>
              ))}
            </div>
          </div>

          {/* Step Navigation */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-8">
            {demoSteps.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => {
                  setCurrentStep(idx);
                  setProgress(0);
                }}
                className={cn(
                  "p-4 rounded-xl border transition-all text-left",
                  currentStep === idx
                    ? "bg-violet-50 border-violet-300 text-violet-700 shadow-sm"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                )}
              >
                <s.icon className={cn("w-5 h-5 mb-2", currentStep === idx ? "text-violet-500" : "text-slate-400")} />
                <p className="text-sm font-medium truncate">{s.title}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 bg-gradient-to-r from-blue-600 to-violet-600">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Get Started?</h2>
          <p className="text-white/80 mb-8">
            Experience the power of Flowstral firsthand. Start your free trial today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button
              size="lg"
              onClick={() => { trackCTAClick('start_free_trial', '/demo'); navigate('/signup'); }}
              className="h-12 px-8 bg-white text-violet-600 hover:bg-slate-100 shadow-lg"
            >
              Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              onClick={() => { trackCTAClick('schedule_live_demo', '/demo'); navigate('/contact'); }}
              className="h-12 px-8 border-white/30 text-white hover:bg-white/10"
            >
              Schedule Live Demo
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-slate-200 text-center bg-white">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-6 text-sm">
          <Link to="/privacy" className="text-slate-500 hover:text-slate-800 transition-colors">Privacy Policy</Link>
          <span className="text-slate-300">•</span>
          <Link to="/terms" className="text-slate-500 hover:text-slate-800 transition-colors">Terms of Service</Link>
          <span className="text-slate-300">•</span>
          <Link to="/contact" className="text-slate-500 hover:text-slate-800 transition-colors">Contact</Link>
        </div>
        <p className="text-slate-400 text-xs mt-4">© {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}

