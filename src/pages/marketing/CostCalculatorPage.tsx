/**
 * QA Tool Cost Calculator — Interactive savings estimator
 *
 * Route: /tools/cost-calculator
 * Users check which tools they currently use → see total cost → see Flowstral savings.
 * Captures leads via "Email me this report" CTA.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { trackCTAClick, trackEvent } from '@/lib/web-analytics';
import {
  ArrowRight, Building2, Check, Calculator, DollarSign,
  TrendingDown, BarChart3, PiggyBank
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Tool Cost Data ─────────────────────────────────────────────────────────

interface ToolEntry {
  id: string;
  name: string;
  examples: string;
  category: string;
  lowCost: number;  // annual $K
  highCost: number; // annual $K
  icon: string;
  flowstralPack: string;
}

const tools: ToolEntry[] = [
  {
    id: 'browser',
    name: 'Browser Automation',
    examples: 'Selenium, Cypress, Playwright, TestCafe',
    category: 'E2E Testing',
    lowCost: 15,
    highCost: 40,
    icon: '🌐',
    flowstralPack: 'Automation Pack (included in Free)',
  },
  {
    id: 'api',
    name: 'API Testing',
    examples: 'Postman, SoapUI, Insomnia, REST Assured',
    category: 'API Testing',
    lowCost: 10,
    highCost: 25,
    icon: '🔌',
    flowstralPack: 'API Testing Pack',
  },
  {
    id: 'performance',
    name: 'Performance / Load Testing',
    examples: 'JMeter, k6, Gatling, NeoLoad, LoadRunner',
    category: 'Performance',
    lowCost: 15,
    highCost: 50,
    icon: '⚡',
    flowstralPack: 'Performance Pack',
  },
  {
    id: 'visual',
    name: 'Visual Regression Testing',
    examples: 'Applitools, Percy, BackstopJS, Chromatic',
    category: 'Visual Testing',
    lowCost: 12,
    highCost: 30,
    icon: '👁',
    flowstralPack: 'Visual Testing Pack',
  },
  {
    id: 'accessibility',
    name: 'Accessibility Testing',
    examples: 'Axe, WAVE, Pa11y, Deque',
    category: 'Accessibility',
    lowCost: 8,
    highCost: 20,
    icon: '♿',
    flowstralPack: 'Accessibility Pack',
  },
  {
    id: 'mobile',
    name: 'Mobile Testing',
    examples: 'BrowserStack, LambdaTest, Sauce Labs, Appium',
    category: 'Mobile & Cross-Browser',
    lowCost: 20,
    highCost: 60,
    icon: '📱',
    flowstralPack: 'Mobile Testing Pack',
  },
  {
    id: 'salesforce',
    name: 'Salesforce Testing',
    examples: 'Provar, Copado Robotic Testing',
    category: 'Salesforce QA',
    lowCost: 25,
    highCost: 80,
    icon: '☁️',
    flowstralPack: 'Salesforce Pack',
  },
  {
    id: 'management',
    name: 'Test Management',
    examples: 'TestRail, Zephyr, qTest, PractiTest',
    category: 'Management',
    lowCost: 10,
    highCost: 30,
    icon: '📋',
    flowstralPack: 'Included in all plans',
  },
];

// ── Component ──────────────────────────────────────────────────────────────

export default function CostCalculatorPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [teamSize, setTeamSize] = useState(10);
  const [hasTrackedCalculation, setHasTrackedCalculation] = useState(false);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const results = useMemo(() => {
    const selectedTools = tools.filter(t => selected.has(t.id));
    const lowTotal = selectedTools.reduce((s, t) => s + t.lowCost, 0);
    const highTotal = selectedTools.reduce((s, t) => s + t.highCost, 0);
    const flowstralCost = selected.size <= 0 ? 0 : selected.size <= 3 ? 0 : 78; // $6,500/mo = $78K/yr for enterprise
    const lowSavings = Math.max(0, lowTotal - flowstralCost);
    const highSavings = Math.max(0, highTotal - flowstralCost);
    const toolCount = selectedTools.length;

    return { lowTotal, highTotal, flowstralCost, lowSavings, highSavings, toolCount, selectedTools };
  }, [selected]);

  // Track the first time a user sees meaningful results
  if (results.toolCount >= 2 && !hasTrackedCalculation) {
    trackEvent('cost_calculator_used', { tools_selected: results.toolCount, estimated_savings: results.highSavings });
    setHasTrackedCalculation(true);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center">
                <span className="text-white font-bold text-lg">F</span>
              </div>
              <span className="text-xl font-bold text-slate-900">Flowstral</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Pricing</Link>
              <Link to="/compare/katalon" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Compare</Link>
              <Link to="/blog" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Blog</Link>
              <Link to="/about" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">About</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => { trackCTAClick('sign_in', '/tools/cost-calculator'); navigate('/signin'); }}>Sign In</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { trackCTAClick('start_free', '/tools/cost-calculator'); navigate('/signup'); }}>
              Start Free <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Free Tool</p>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            QA Tool Cost Calculator
          </h1>
          <p className="text-xl text-slate-600">
            Select the tools your team uses today. See how much you could save by consolidating to Flowstral.
          </p>
        </div>
      </section>

      {/* Tool Selection */}
      <section className="pb-8 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Which tools does your team use?</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {tools.map(tool => {
              const isSelected = selected.has(tool.id);
              return (
                <button
                  key={tool.id}
                  onClick={() => toggle(tool.id)}
                  className={cn(
                    'flex items-start gap-4 p-4 rounded-xl border-2 text-left transition-all',
                    isSelected
                      ? 'border-blue-500 bg-blue-50/50 shadow-sm'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  )}
                >
                  <div className={cn(
                    'w-6 h-6 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all',
                    isSelected ? 'border-blue-500 bg-blue-500' : 'border-slate-300'
                  )}>
                    {isSelected && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{tool.icon}</span>
                      <span className="font-semibold text-slate-900">{tool.name}</span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{tool.examples}</p>
                    <p className="text-xs text-slate-400 mt-1">${tool.lowCost}K - ${tool.highCost}K/year typical</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Results */}
      {results.toolCount > 0 && (
        <section className="pb-16 px-6">
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-slate-200 bg-white shadow-lg overflow-hidden">
              <div className="bg-slate-900 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Your Savings Estimate
                </h2>
              </div>
              <div className="p-6">
                {/* Current Spend */}
                <div className="grid sm:grid-cols-3 gap-6 mb-8">
                  <div className="text-center p-4 rounded-xl bg-red-50 border border-red-100">
                    <p className="text-sm text-red-600 font-medium mb-1">Current Annual Spend</p>
                    <p className="text-3xl font-bold text-red-700">${results.lowTotal}K - ${results.highTotal}K</p>
                    <p className="text-xs text-red-500 mt-1">{results.toolCount} separate tools</p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-blue-50 border border-blue-100">
                    <p className="text-sm text-blue-600 font-medium mb-1">Flowstral Cost</p>
                    <p className="text-3xl font-bold text-blue-700">
                      {results.flowstralCost === 0 ? '$0' : `$${results.flowstralCost}K`}
                    </p>
                    <p className="text-xs text-blue-500 mt-1">
                      {results.flowstralCost === 0 ? 'Free tier covers this' : '$6,500/mo enterprise'}
                    </p>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <p className="text-sm text-emerald-600 font-medium mb-1">Annual Savings</p>
                    <p className="text-3xl font-bold text-emerald-700">
                      ${results.lowSavings}K - ${results.highSavings}K
                    </p>
                    <p className="text-xs text-emerald-500 mt-1 flex items-center justify-center gap-1">
                      <TrendingDown className="w-3 h-3" />
                      {results.highTotal > 0 ? Math.round((results.highSavings / results.highTotal) * 100) : 0}% reduction
                    </p>
                  </div>
                </div>

                {/* Breakdown */}
                <h3 className="font-semibold text-slate-900 mb-3">What Flowstral Replaces</h3>
                <div className="space-y-2 mb-6">
                  {results.selectedTools.map(tool => (
                    <div key={tool.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span>{tool.icon}</span>
                        <div>
                          <span className="text-sm font-medium text-slate-700">{tool.name}</span>
                          <span className="text-xs text-slate-400 ml-2">({tool.examples.split(',')[0]})</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-sm text-red-500 line-through">${tool.lowCost}K-${tool.highCost}K</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 inline mx-2" />
                        <span className="text-sm text-emerald-600 font-medium">{tool.flowstralPack}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Additional Savings */}
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 mb-6">
                  <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
                    <PiggyBank className="w-4 h-4" /> Hidden Savings Not Included Above
                  </h4>
                  <ul className="text-sm text-amber-700 space-y-1">
                    <li>&bull; Reduced training time: 1 tool to learn vs {results.toolCount}</li>
                    <li>&bull; Fewer vendor contracts to manage ({results.toolCount} → 1)</li>
                    <li>&bull; Less integration/glue code between tools</li>
                    <li>&bull; Faster onboarding for new QA team members</li>
                    <li>&bull; Single dashboard instead of {results.toolCount} separate reporting tools</li>
                  </ul>
                </div>

                {/* CTA */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                    onClick={() => { trackCTAClick('get_started_free', '/tools/cost-calculator'); navigate('/signup'); }}
                  >
                    Start Free — Replace {results.toolCount} Tools <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    variant="outline"
                    className="h-12 px-6 rounded-xl"
                    onClick={() => { trackCTAClick('talk_to_sales', '/tools/cost-calculator'); navigate('/contact'); }}
                  >
                    <Building2 className="w-4 h-4 mr-2" /> Talk to Sales
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Comparison Links */}
      <section className="pb-16 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">See Detailed Comparisons</h2>
          <div className="flex flex-wrap gap-2 justify-center">
            {['katalon', 'selenium', 'postman', 'cypress', 'tricentis'].map(slug => (
              <Button key={slug} variant="outline" size="sm" onClick={() => navigate(`/compare/${slug}`)}>
                vs {slug.charAt(0).toUpperCase() + slug.slice(1)}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
          <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
          <Link to="/demo" className="hover:text-white transition-colors">Demo</Link>
          <Link to="/about" className="hover:text-white transition-colors">About</Link>
          <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
        </div>
        <p className="mt-4 text-xs text-slate-500">&copy; {new Date().getFullYear()} Flowstral Inc. All rights reserved.</p>
      </footer>
    </div>
  );
}
