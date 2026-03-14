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
  SlidersHorizontal, Plug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LandingPluginsProvider, useLandingPlugins, type LandingPlugins, type PluginKey, pluginMetadata } from '@/contexts/LandingPluginsContext';

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
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight mb-6">
            Record once.{' '}
            <br className="hidden sm:block" />
            Test everything.
          </h1>
          <p className="text-lg sm:text-xl text-slate-600 max-w-2xl leading-relaxed mb-8">
            Flowstral records your browser sessions and turns them into Playwright tests.
            Then run those tests for performance, visual regression, accessibility, and API coverage
            -- all from one platform.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 mb-12">
            <Button
              size="lg"
              onClick={() => { trackCTAClick('start_free', '/'); navigate('/signup'); }}
              className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg"
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

        {/* Right side: compact code preview */}
        <div className="hidden lg:block absolute right-6 top-1/2 -translate-y-1/2 w-[420px]">
          <div className="bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-700">
              <div className="w-3 h-3 rounded-full bg-red-500/70" />
              <div className="w-3 h-3 rounded-full bg-amber-500/70" />
              <div className="w-3 h-3 rounded-full bg-green-500/70" />
              <span className="ml-3 text-xs text-slate-500 font-mono">login-flow.spec.ts</span>
            </div>
            <div className="p-5 font-mono text-[13px] leading-relaxed">
              <div className="text-slate-500">// Auto-generated from recording</div>
              <div className="mt-2">
                <span className="text-violet-400">test</span>
                <span className="text-slate-300">(</span>
                <span className="text-emerald-400">'user can log in'</span>
                <span className="text-slate-300">, </span>
                <span className="text-violet-400">async</span>
                <span className="text-slate-300"> ({'{'}page{'}'}) =&gt; {'{'}</span>
              </div>
              <div className="ml-4 mt-1">
                <span className="text-slate-500">await</span>
                <span className="text-blue-400"> page</span>
                <span className="text-slate-300">.goto(</span>
                <span className="text-emerald-400">'/login'</span>
                <span className="text-slate-300">);</span>
              </div>
              <div className="ml-4">
                <span className="text-slate-500">await</span>
                <span className="text-blue-400"> page</span>
                <span className="text-slate-300">.fill(</span>
                <span className="text-emerald-400">'#email'</span>
                <span className="text-slate-300">, </span>
                <span className="text-emerald-400">'user@co.com'</span>
                <span className="text-slate-300">);</span>
              </div>
              <div className="ml-4">
                <span className="text-slate-500">await</span>
                <span className="text-blue-400"> page</span>
                <span className="text-slate-300">.fill(</span>
                <span className="text-emerald-400">'#password'</span>
                <span className="text-slate-300">, </span>
                <span className="text-emerald-400">'********'</span>
                <span className="text-slate-300">);</span>
              </div>
              <div className="ml-4">
                <span className="text-slate-500">await</span>
                <span className="text-blue-400"> page</span>
                <span className="text-slate-300">.click(</span>
                <span className="text-emerald-400">'button[type=submit]'</span>
                <span className="text-slate-300">);</span>
              </div>
              <div className="ml-4">
                <span className="text-slate-500">await</span>
                <span className="text-violet-400"> expect</span>
                <span className="text-slate-300">(page).toHaveURL(</span>
                <span className="text-emerald-400">'/dashboard'</span>
                <span className="text-slate-300">);</span>
              </div>
              <div className="text-slate-300">{'}'});</div>
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
      detail: 'Generates Playwright scripts with self-healing selectors',
    },
    {
      number: '02',
      title: 'Build & Extend',
      description: 'Edit steps visually with 59 step types. Add assertions, data generators, conditional logic, and reusable modules -- no code required.',
      detail: 'Or write code directly if you prefer',
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
      description: 'Record sessions, generate Playwright scripts, run across Chromium/Firefox/WebKit. Self-healing selectors fix themselves when the UI changes.',
      specifics: ['Playwright code generation', 'Cross-browser (3 engines)', '4-layer self-healing chain'],
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
              When a UI changes and a selector breaks, Flowstral's 4-layer healing chain
              finds a working alternative before you even notice. No manual maintenance.
            </p>

            <div className="space-y-4">
              {[
                { layer: 'Knowledge Base', speed: '< 1ms', description: 'Looks up previously-healed selectors from past runs' },
                { layer: 'Deterministic', speed: '< 1ms', description: 'Generates alternative CSS/XPath selectors from element attributes' },
                { layer: 'Vision AI', speed: '2-5s', description: 'Analyzes a screenshot to locate the element visually' },
                { layer: 'OCR Fallback', speed: '~500ms', description: 'Finds elements by their visible text content' },
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
            className="h-12 px-8 bg-white text-slate-900 hover:bg-slate-100 font-medium rounded-lg"
          >
            Get Started Free
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => { trackCTAClick('schedule_demo', '/'); navigate('/contact'); }}
            className="h-12 px-8 border-slate-600 text-slate-300 hover:bg-slate-800 rounded-lg"
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

// ===================================================================
// HEADER
// ===================================================================

function Header() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const { plugins, setPlugin, isLicensed, license } = useLandingPlugins();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!pluginsOpen) return;
    const close = () => setPluginsOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [pluginsOpen]);

  const pluginOptions: { key: PluginKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: 'api', label: 'API Testing', icon: Globe },
    { key: 'perf', label: 'Performance', icon: Activity },
    { key: 'a11y', label: 'Accessibility', icon: Accessibility },
    { key: 'mobile', label: 'Mobile Testing', icon: Smartphone },
  ];

  return (
    <header className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
      scrolled
        ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200/50"
        : "bg-white/80 backdrop-blur-sm"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <span className="text-white font-bold text-sm">F</span>
            </div>
            <span className="text-lg font-bold text-slate-900">Flowstral</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Features</a>
            <span onClick={() => navigate('/pricing')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">Pricing</span>
            <span onClick={() => navigate('/compare/katalon')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">Compare</span>
            <span onClick={() => navigate('/blog')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">Blog</span>
            <span onClick={() => navigate('/download')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">Download</span>
            <span onClick={() => navigate('/about')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors cursor-pointer">About</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Plugin customizer */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-500 hover:text-slate-900 gap-1.5"
              onClick={(e) => { e.stopPropagation(); setPluginsOpen((v) => !v); }}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Customize</span>
              <Plug className="w-3.5 h-3.5" />
            </Button>
            {pluginsOpen && (
              <div
                className="absolute right-0 top-full mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg py-3 z-50"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase">Show on landing</span>
                  <Badge className="text-[10px] bg-slate-100 text-slate-600 border-0">
                    {license.tier.charAt(0).toUpperCase() + license.tier.slice(1)}
                  </Badge>
                </div>
                <div className="px-2 py-1 space-y-0.5">
                  {pluginOptions.map(({ key, label, icon: Icon }) => {
                    const licensed = isLicensed(key);
                    const requiredTier = pluginMetadata[key].tier;

                    return (
                      <label
                        key={key}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                          licensed
                            ? "hover:bg-slate-50 cursor-pointer"
                            : "opacity-60 cursor-not-allowed"
                        )}
                        title={licensed ? `Toggle ${label}` : `Requires ${requiredTier} license or higher`}
                      >
                        <input
                          type="checkbox"
                          checked={plugins[key]}
                          onChange={(e) => licensed && setPlugin(key, e.target.checked)}
                          disabled={!licensed}
                          className={cn("rounded border-slate-300", !licensed && "opacity-50")}
                        />
                        <Icon className={cn("w-4 h-4", licensed ? "text-slate-400" : "text-slate-300")} />
                        <span className={cn("text-sm flex-1", licensed ? "text-slate-700" : "text-slate-400")}>{label}</span>
                        {!licensed && (
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] text-amber-600 font-medium uppercase">{requiredTier}</span>
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>
                {license.tier !== 'enterprise' && (
                  <div className="px-4 pt-3 mt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      className="w-full bg-slate-900 text-white text-xs hover:bg-slate-800"
                      onClick={() => navigate('/pricing')}
                    >
                      Upgrade to unlock all features
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900" onClick={() => { trackCTAClick('sign_in', '/'); navigate('/signin'); }}>
            Sign In
          </Button>
          <Button
            className="bg-slate-900 hover:bg-slate-800 text-white"
            onClick={() => { trackCTAClick('start_free', '/'); navigate('/signup'); }}
          >
            Start Free
          </Button>
        </div>
      </div>
    </header>
  );
}

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
      <Header />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <CapabilitiesSection />
        <SelfHealingSection />
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
