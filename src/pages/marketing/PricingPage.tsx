/**
 * Pricing Page - ArisTrace Testing Platform
 * 6 Packs: Automation, Performance, API, Visual, Accessibility, Salesforce
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Check, X, ArrowRight, Rocket, Building2, Users, Zap,
  ChevronRight, HelpCircle, Mail, MessageSquare, Sparkles,
  TestTube, Gauge, Code, Eye, Accessibility, Cloud
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

// 6 Testing Packs
const testingPacks = [
  { name: 'Automation', icon: TestTube, color: 'blue', desc: 'Record, build & run tests' },
  { name: 'Performance', icon: Gauge, color: 'orange', desc: 'Load & stress testing' },
  { name: 'API', icon: Code, color: 'emerald', desc: 'REST, GraphQL, gRPC, SOAP' },
  { name: 'Visual', icon: Eye, color: 'purple', desc: 'Visual regression testing' },
  { name: 'Accessibility', icon: Accessibility, color: 'pink', desc: 'WCAG compliance' },
  { name: 'Salesforce', icon: Cloud, color: 'cyan', desc: '20+ native SF tools' },
];

const plans = [
  {
    name: 'Starter',
    description: 'Perfect for small teams starting their QA journey',
    price: 199,
    period: '/month',
    priceNote: 'billed annually',
    icon: Zap,
    color: 'emerald',
    highlight: false,
    features: [
      // Users & Limits
      { category: 'Platform', name: 'Up to 5 users', included: true },
      { category: 'Platform', name: '5,000 test runs/month', included: true },
      { category: 'Platform', name: '2 parallel executions', included: true },
      // Automation Pack
      { category: 'Automation', name: 'Smart Recorder', included: true },
      { category: 'Automation', name: 'Visual Test Builder', included: true },
      { category: 'Automation', name: 'Test Management', included: true },
      { category: 'Automation', name: 'Self-Healing Locators', included: true },
      // API Pack
      { category: 'API', name: 'REST & GraphQL Testing', included: true },
      { category: 'API', name: 'Basic Assertions', included: true },
      { category: 'API', name: 'gRPC & SOAP Testing', included: false },
      { category: 'API', name: 'API Chaining & Variables', included: false },
      // Visual Pack
      { category: 'Visual', name: 'Visual Testing (500/mo)', included: true },
      { category: 'Visual', name: 'Screenshot Comparison', included: true },
      // Accessibility Pack
      { category: 'Accessibility', name: 'WCAG 2.1 AA Testing', included: true },
      { category: 'Accessibility', name: 'Basic Reports', included: true },
      { category: 'Accessibility', name: 'Full WCAG AAA', included: false },
      // Performance Pack
      { category: 'Performance', name: 'Load Testing', included: false },
      { category: 'Performance', name: 'Virtual Users', included: false },
      // Salesforce Pack
      { category: 'Salesforce', name: 'Salesforce Tools (20+)', included: false },
      { category: 'Salesforce', name: 'SOQL/Apex Testing', included: false },
      // Support
      { category: 'Support', name: 'Email Support (48h)', included: true },
      { category: 'Support', name: 'Basic Integrations', included: true },
      { category: 'Support', name: 'Priority Support', included: false },
    ],
    packs: {
      automation: 'full',
      api: 'basic',
      visual: 'basic',
      accessibility: 'basic',
      performance: 'none',
      salesforce: 'none',
    },
    cta: 'Start Free Trial',
  },
  {
    name: 'Professional',
    description: 'For growing teams with advanced testing needs',
    price: 399,
    period: '/month',
    priceNote: 'billed annually',
    icon: Users,
    color: 'blue',
    highlight: true,
    features: [
      // Users & Limits
      { category: 'Platform', name: 'Up to 25 users', included: true },
      { category: 'Platform', name: '25,000 test runs/month', included: true },
      { category: 'Platform', name: '10 parallel executions', included: true },
      // Automation Pack
      { category: 'Automation', name: 'Everything in Starter', included: true },
      { category: 'Automation', name: 'Advanced Recorder Features', included: true },
      { category: 'Automation', name: 'Cross-Browser Testing', included: true },
      { category: 'Automation', name: 'Auto-Correlation', included: true },
      // API Pack
      { category: 'API', name: 'All Protocol Support', included: true },
      { category: 'API', name: 'API Chaining & Variables', included: true },
      { category: 'API', name: 'Contract Testing', included: true },
      { category: 'API', name: 'Mock Servers', included: true },
      // Visual Pack
      { category: 'Visual', name: 'Visual Testing (5,000/mo)', included: true },
      { category: 'Visual', name: 'AI-Powered Diff Detection', included: true },
      // Accessibility Pack
      { category: 'Accessibility', name: 'Full WCAG 2.1 AAA', included: true },
      { category: 'Accessibility', name: 'Detailed Compliance Reports', included: true },
      { category: 'Accessibility', name: 'Remediation Suggestions', included: true },
      // Performance Pack
      { category: 'Performance', name: 'Load Testing', included: true },
      { category: 'Performance', name: 'Up to 2,500 Virtual Users', included: true },
      { category: 'Performance', name: 'Real-Time Metrics', included: true },
      { category: 'Performance', name: 'Performance Baselines', included: true },
      // Salesforce Pack
      { category: 'Salesforce', name: 'Salesforce Tools (20+)', included: true },
      { category: 'Salesforce', name: 'SOQL & Apex Testing', included: true },
      { category: 'Salesforce', name: 'Data Factory', included: true },
      { category: 'Salesforce', name: 'Org Comparison', included: true },
      // Support
      { category: 'Support', name: 'Priority Support (24h SLA)', included: true },
      { category: 'Support', name: 'Full CI/CD Integrations', included: true },
      { category: 'Support', name: 'Slack & Teams Integration', included: true },
    ],
    packs: {
      automation: 'full',
      api: 'full',
      visual: 'full',
      accessibility: 'full',
      performance: 'full',
      salesforce: 'full',
    },
    cta: 'Start Free Trial',
  },
  {
    name: 'Enterprise',
    description: 'For large organizations with custom requirements',
    price: null,
    period: '',
    priceNote: 'Custom pricing',
    icon: Building2,
    color: 'violet',
    highlight: false,
    features: [
      // Users & Limits
      { category: 'Platform', name: 'Unlimited users', included: true },
      { category: 'Platform', name: 'Unlimited test runs', included: true },
      { category: 'Platform', name: 'Custom parallel executions', included: true },
      // Everything in Pro
      { category: 'All Packs', name: 'Everything in Professional', included: true },
      // Performance Pack Enhanced
      { category: 'Performance', name: 'Up to 10,000+ Virtual Users', included: true },
      { category: 'Performance', name: 'Dedicated Load Generators', included: true },
      // Enterprise Features
      { category: 'Enterprise', name: 'On-Premise / Air-Gapped', included: true },
      { category: 'Enterprise', name: 'SSO / SAML / SCIM', included: true },
      { category: 'Enterprise', name: 'Custom Integrations', included: true },
      { category: 'Enterprise', name: 'Private Cloud Option', included: true },
      { category: 'Enterprise', name: 'Custom SLA (99.9%)', included: true },
      // Support
      { category: 'Support', name: 'Dedicated Success Manager', included: true },
      { category: 'Support', name: '24/7 Phone & Chat Support', included: true },
      { category: 'Support', name: 'Training & Onboarding', included: true },
      { category: 'Support', name: 'Quarterly Business Reviews', included: true },
    ],
    packs: {
      automation: 'full',
      api: 'full',
      visual: 'full',
      accessibility: 'full',
      performance: 'enterprise',
      salesforce: 'full',
    },
    cta: 'Contact Sales',
  },
];

// Pack availability indicator
function PackIndicator({ status }: { status: 'none' | 'basic' | 'full' | 'enterprise' }) {
  if (status === 'none') {
    return <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-400">—</span>;
  }
  if (status === 'basic') {
    return <span className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">Basic</span>;
  }
  if (status === 'enterprise') {
    return <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 font-medium">10K+ VUs</span>;
  }
  return <Check className="w-4 h-4 text-emerald-500" />;
}

export default function PricingPage() {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(true);

  const getPrice = (basePrice: number | null) => {
    if (!basePrice) return null;
    return annual ? basePrice : Math.round(basePrice * 1.25);
  };

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
            One Platform, Six Testing Packs
          </h1>
          <p className="text-xl text-slate-600 mb-6 max-w-2xl mx-auto">
            Everything you need for comprehensive QA. Start free, scale as you grow.
          </p>

          {/* 6 Packs Showcase */}
          <div className="flex flex-wrap justify-center gap-3 mb-10">
            {testingPacks.map((pack) => (
              <div 
                key={pack.name}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full border transition-all hover:scale-105",
                  pack.color === 'blue' && "bg-blue-50 border-blue-200 text-blue-700",
                  pack.color === 'orange' && "bg-orange-50 border-orange-200 text-orange-700",
                  pack.color === 'emerald' && "bg-emerald-50 border-emerald-200 text-emerald-700",
                  pack.color === 'purple' && "bg-purple-50 border-purple-200 text-purple-700",
                  pack.color === 'pink' && "bg-pink-50 border-pink-200 text-pink-700",
                  pack.color === 'cyan' && "bg-cyan-50 border-cyan-200 text-cyan-700",
                )}
              >
                <pack.icon className="w-4 h-4" />
                <span className="text-sm font-semibold">{pack.name}</span>
              </div>
            ))}
          </div>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <span className={cn("text-sm font-medium transition-colors", !annual ? "text-slate-900" : "text-slate-400")}>Monthly</span>
            <button
              onClick={() => setAnnual(!annual)}
              className={cn(
                "relative w-14 h-7 rounded-full transition-colors shadow-inner",
                annual ? "bg-blue-600" : "bg-slate-300"
              )}
            >
              <div className={cn(
                "absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform",
                annual ? "translate-x-8" : "translate-x-1"
              )} />
            </button>
            <span className={cn("text-sm font-medium transition-colors", annual ? "text-slate-900" : "text-slate-400")}>
              Annual <Badge className="ml-1 bg-emerald-100 text-emerald-700 border-0 text-xs font-bold">Save 20%</Badge>
            </span>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-6">
            {plans.map((plan, idx) => (
              <div 
                key={idx}
                className={cn(
                  "relative p-8 rounded-3xl border-2 transition-all duration-300",
                  plan.highlight 
                    ? "bg-gradient-to-b from-blue-50 via-white to-violet-50 border-blue-400 shadow-xl shadow-blue-500/10 scale-[1.02] lg:scale-105" 
                    : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-lg"
                )}
              >
                {plan.highlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-violet-600 text-white border-0 px-4 py-1 shadow-lg">
                    <Sparkles className="w-3 h-3 mr-1" />
                    Most Popular
                  </Badge>
                )}

                <div className={cn(
                  "w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm",
                  plan.color === 'emerald' ? "bg-gradient-to-br from-emerald-100 to-emerald-200" :
                  plan.color === 'blue' ? "bg-gradient-to-br from-blue-100 to-blue-200" : "bg-gradient-to-br from-violet-100 to-violet-200"
                )}>
                  <plan.icon className={cn(
                    "w-7 h-7",
                    plan.color === 'emerald' ? "text-emerald-600" :
                    plan.color === 'blue' ? "text-blue-600" : "text-violet-600"
                  )} />
                </div>

                <h3 className="text-2xl font-bold text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-slate-500 mb-6 min-h-[40px]">{plan.description}</p>

                <div className="mb-6">
                  {plan.price ? (
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold text-slate-900">
                        ${getPrice(plan.price)}
                      </span>
                      <span className="text-slate-500 font-medium">{plan.period}</span>
                    </div>
                  ) : (
                    <span className="text-3xl font-bold text-slate-900">Contact Us</span>
                  )}
                  {plan.priceNote && (
                    <p className="text-xs text-slate-400 mt-1">{plan.price ? plan.priceNote : 'Custom pricing for your needs'}</p>
                  )}
                </div>

                <Button 
                  className={cn(
                    "w-full h-12 rounded-xl font-semibold mb-8 transition-all",
                    plan.highlight 
                      ? "bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-500/25" 
                      : "bg-white border-2 border-blue-500 text-blue-600 hover:bg-blue-50 hover:border-blue-600"
                  )}
                  onClick={() => plan.price ? navigate('/auth') : window.location.href = 'mailto:sales@flowstral.com'}
                >
                  {plan.cta} <ArrowRight className="w-4 h-4 ml-2" />
                </Button>

                {/* Pack Availability Summary */}
                <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Included Packs</p>
                  <div className="grid grid-cols-2 gap-2">
                    {testingPacks.map((pack) => (
                      <div key={pack.name} className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">{pack.name}</span>
                        <PackIndicator status={plan.packs[pack.name.toLowerCase() as keyof typeof plan.packs]} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Features */}
                <div className="space-y-3">
                  {plan.features.slice(0, 12).map((feature, fidx) => (
                    <div key={fidx} className="flex items-center gap-3">
                      {feature.included ? (
                        <Check className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-slate-300 flex-shrink-0" />
                      )}
                      <span className={cn(
                        "text-sm",
                        feature.included ? "text-slate-700" : "text-slate-400"
                      )}>{feature.name}</span>
                    </div>
                  ))}
                  {plan.features.length > 12 && (
                    <p className="text-xs text-slate-400 pt-2">+ {plan.features.length - 12} more features</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feature Comparison Table */}
      <section className="py-16 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 text-center mb-4">Compare All Features</h2>
          <p className="text-slate-600 text-center mb-12 max-w-2xl mx-auto">
            Detailed breakdown of what's included in each plan
          </p>
          
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-4 gap-4 p-6 bg-slate-50 border-b border-slate-200">
              <div className="font-semibold text-slate-700">Feature</div>
              <div className="text-center font-semibold text-slate-700">Starter</div>
              <div className="text-center font-semibold text-blue-600">Professional</div>
              <div className="text-center font-semibold text-violet-600">Enterprise</div>
            </div>
            
            {/* Platform Limits */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-slate-50 font-semibold text-sm text-slate-600 uppercase tracking-wider">
                Platform Limits
              </div>
              {[
                { feature: 'Team Members', starter: 'Up to 5', pro: 'Up to 25', enterprise: 'Unlimited' },
                { feature: 'Test Runs / Month', starter: '5,000', pro: '25,000', enterprise: 'Unlimited' },
                { feature: 'Parallel Executions', starter: '2', pro: '10', enterprise: 'Custom' },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center text-slate-600">{row.starter}</div>
                  <div className="text-center text-slate-900 font-medium">{row.pro}</div>
                  <div className="text-center text-slate-900 font-medium">{row.enterprise}</div>
                </div>
              ))}
            </div>

            {/* Automation Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-blue-50 font-semibold text-sm text-blue-700 uppercase tracking-wider flex items-center gap-2">
                <TestTube className="w-4 h-4" /> Automation Pack
              </div>
              {[
                { feature: 'Smart Recorder', starter: true, pro: true, enterprise: true },
                { feature: 'Visual Test Builder', starter: true, pro: true, enterprise: true },
                { feature: 'Self-Healing Locators', starter: true, pro: true, enterprise: true },
                { feature: 'Cross-Browser Testing', starter: false, pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center">{row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                  <div className="text-center">{row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                  <div className="text-center">{row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                </div>
              ))}
            </div>

            {/* Performance Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-orange-50 font-semibold text-sm text-orange-700 uppercase tracking-wider flex items-center gap-2">
                <Gauge className="w-4 h-4" /> Performance Pack
              </div>
              {[
                { feature: 'Load Testing', starter: '—', pro: true, enterprise: true },
                { feature: 'Virtual Users', starter: '—', pro: '2,500 VUs', enterprise: '10,000+ VUs' },
                { feature: 'Real-Time Metrics', starter: '—', pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center text-slate-400">{typeof row.starter === 'string' ? row.starter : (row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.pro === 'string' ? <span className="text-slate-900 font-medium">{row.pro}</span> : (row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.enterprise === 'string' ? <span className="text-violet-600 font-semibold">{row.enterprise}</span> : (row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                </div>
              ))}
            </div>

            {/* API Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-emerald-50 font-semibold text-sm text-emerald-700 uppercase tracking-wider flex items-center gap-2">
                <Code className="w-4 h-4" /> API Testing Pack
              </div>
              {[
                { feature: 'REST & GraphQL', starter: true, pro: true, enterprise: true },
                { feature: 'gRPC & SOAP', starter: false, pro: true, enterprise: true },
                { feature: 'API Chaining', starter: false, pro: true, enterprise: true },
                { feature: 'Contract Testing', starter: false, pro: true, enterprise: true },
                { feature: 'Mock Servers', starter: false, pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center">{row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                  <div className="text-center">{row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                  <div className="text-center">{row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                </div>
              ))}
            </div>

            {/* Visual Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-purple-50 font-semibold text-sm text-purple-700 uppercase tracking-wider flex items-center gap-2">
                <Eye className="w-4 h-4" /> Visual Testing Pack
              </div>
              {[
                { feature: 'Visual Comparisons', starter: '500/mo', pro: '5,000/mo', enterprise: 'Unlimited' },
                { feature: 'AI Diff Detection', starter: false, pro: true, enterprise: true },
                { feature: 'Baseline Management', starter: true, pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center">{typeof row.starter === 'string' ? <span className="text-slate-600">{row.starter}</span> : (row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.pro === 'string' ? <span className="text-slate-900 font-medium">{row.pro}</span> : (row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.enterprise === 'string' ? <span className="text-violet-600 font-semibold">{row.enterprise}</span> : (row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                </div>
              ))}
            </div>

            {/* Accessibility Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-pink-50 font-semibold text-sm text-pink-700 uppercase tracking-wider flex items-center gap-2">
                <Accessibility className="w-4 h-4" /> Accessibility Pack
              </div>
              {[
                { feature: 'WCAG 2.1 AA Testing', starter: true, pro: true, enterprise: true },
                { feature: 'WCAG 2.1 AAA Testing', starter: false, pro: true, enterprise: true },
                { feature: 'Compliance Reports', starter: 'Basic', pro: 'Detailed', enterprise: 'Audit-Ready' },
                { feature: 'Remediation Suggestions', starter: false, pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center">{typeof row.starter === 'string' ? <span className="text-slate-600">{row.starter}</span> : (row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.pro === 'string' ? <span className="text-slate-900 font-medium">{row.pro}</span> : (row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.enterprise === 'string' ? <span className="text-violet-600 font-semibold">{row.enterprise}</span> : (row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                </div>
              ))}
            </div>

            {/* Salesforce Pack */}
            <div className="border-b border-slate-100">
              <div className="px-6 py-3 bg-cyan-50 font-semibold text-sm text-cyan-700 uppercase tracking-wider flex items-center gap-2">
                <Cloud className="w-4 h-4" /> Salesforce Pack
              </div>
              {[
                { feature: 'Native SF Tools (20+)', starter: '—', pro: true, enterprise: true },
                { feature: 'SOQL Query Builder', starter: '—', pro: true, enterprise: true },
                { feature: 'Apex Test Execution', starter: '—', pro: true, enterprise: true },
                { feature: 'Data Factory', starter: '—', pro: true, enterprise: true },
                { feature: 'Org Comparison', starter: '—', pro: true, enterprise: true },
                { feature: 'Permission Testing', starter: '—', pro: true, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center text-slate-400">{typeof row.starter === 'string' ? row.starter : (row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                  <div className="text-center">{row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />}</div>
                </div>
              ))}
            </div>

            {/* Support & Integrations */}
            <div>
              <div className="px-6 py-3 bg-slate-100 font-semibold text-sm text-slate-700 uppercase tracking-wider">
                Support & Integrations
              </div>
              {[
                { feature: 'Support SLA', starter: '48 hours', pro: '24 hours', enterprise: 'Dedicated' },
                { feature: 'CI/CD Integrations', starter: 'Basic', pro: 'Full', enterprise: 'Custom' },
                { feature: 'SSO / SAML', starter: false, pro: false, enterprise: true },
                { feature: 'On-Premise Option', starter: false, pro: false, enterprise: true },
                { feature: 'Dedicated Success Manager', starter: false, pro: false, enterprise: true },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-slate-50 hover:bg-slate-50/50">
                  <div className="text-slate-700">{row.feature}</div>
                  <div className="text-center">{typeof row.starter === 'string' ? <span className="text-slate-600">{row.starter}</span> : (row.starter ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.pro === 'string' ? <span className="text-slate-900 font-medium">{row.pro}</span> : (row.pro ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                  <div className="text-center">{typeof row.enterprise === 'string' ? <span className="text-violet-600 font-semibold">{row.enterprise}</span> : (row.enterprise ? <Check className="w-5 h-5 text-emerald-500 mx-auto" /> : <X className="w-5 h-5 text-slate-300 mx-auto" />)}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Preview */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-8">Questions? We're Here to Help</h2>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => navigate('/faq')}>
              <HelpCircle className="w-5 h-5 mr-2" /> View FAQ
            </Button>
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => navigate('/contact')}>
              <MessageSquare className="w-5 h-5 mr-2" /> Chat with Us
            </Button>
            <Button variant="outline" className="h-12 px-6 rounded-xl" onClick={() => window.location.href = 'mailto:sales@flowstral.com'}>
              <Mail className="w-5 h-5 mr-2" /> Contact Sales
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <p className="text-slate-400 text-sm">© 2026 Flowstral. All rights reserved.</p>
      </footer>
    </div>
  );
}
