/**
 * Flowstral Landing Page - Premium Visual Design
 * 
 * Features highlighted based on competitive analysis:
 * - Smart Recording with element recognition
 * - Visual Test Builder with 53 generators
 * - Test Management (6 modules)
 * - Performance Testing (record→load, SRM, Lighthouse, scenario mix; all built-in)
 * - API Testing (multi-protocol, security scanning)
 * - Visual Testing (6 modes)
 * - Accessibility (WCAG 2.1)
 * - Salesforce Native (20+ tools)
 * - Works without AI + Optional AI boost
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  Play, Zap, Shield, Users, BarChart3, Code2, Workflow, Target,
  CheckCircle2, ArrowRight, Sparkles, Globe, Lock, Eye, 
  Bot, Layers, GitBranch, FileText, Bug, Activity, Clock, Gauge,
  ChevronRight, Star, Building2, Rocket, Database, RefreshCw, MousePointer,
  Type, Wand2, Blocks, ArrowDown,
  Settings2, ClipboardCheck,
  TrendingUp, Server,
  MonitorCheck, Laptop, LineChart, AlertTriangle,
  Search, Folder, Calendar,
  Lightbulb, FileJson, Link2, Timer,
  Accessibility, BrainCircuit,
  ShieldAlert, Cable, FlaskConical,
  Diff, Image as ImageIcon, Mail, Phone, MapPin,
  Twitter, Linkedin, Github, Youtube,
  PauseCircle, Square, CheckSquare, XCircle, Circle,
  Pencil, Trash2, Copy, MoreHorizontal, Filter, Download,
  FileSpreadsheet, TestTube, Beaker, Microscope,
  Smartphone, Wifi, Map, Compass, Navigation, Route,
  SlidersHorizontal, Plug
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { LandingPluginsProvider, useLandingPlugins, type LandingPlugins, type PluginKey, pluginMetadata } from '@/contexts/LandingPluginsContext';

// ═══════════════════════════════════════════════════════════════════════════
// HERO SECTION WITH INTERACTIVE PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

function HeroSection() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'record' | 'build' | 'execute' | 'analyze'>('record');

  const tabs = [
    { id: 'record' as const, label: 'Record', color: 'amber' },
    { id: 'build' as const, label: 'Build', color: 'blue' },
    { id: 'execute' as const, label: 'Execute', color: 'emerald' },
    { id: 'analyze' as const, label: 'Analyze', color: 'violet' },
  ];

  // Auto-cycle through tabs (4.5s for readability)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTab(prev => {
        const order: ('record' | 'build' | 'execute' | 'analyze')[] = ['record', 'build', 'execute', 'analyze'];
        const currentIdx = order.indexOf(prev);
        return order[(currentIdx + 1) % 4];
      });
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-violet-50/50">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[500px] h-[500px] bg-gradient-to-br from-blue-400/20 to-violet-400/20 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-gradient-to-br from-emerald-400/20 to-teal-400/20 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-gradient-to-br from-violet-400/5 to-blue-400/5 rounded-full blur-[120px]" />
        
        {/* Subtle Grid */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-28 pb-16">
        {/* Top Badge */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/80 backdrop-blur-sm border border-slate-200/80 shadow-sm">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm font-medium text-slate-700">Enterprise QA Platform — Free to Start</span>
          </div>
        </div>

        {/* FLOWSTRAL Breakdown Teaser */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex items-center gap-1 p-2 rounded-2xl bg-white/60 backdrop-blur-sm border border-slate-200/50 shadow-sm">
            <span className="px-3 py-1.5 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-500 to-cyan-500 text-white">FLOW</span>
            <span className="text-slate-300">+</span>
            <span className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-violet-100 text-violet-700" title="System Testing">ST</span>
            <span className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-700" title="Regression">R</span>
            <span className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-pink-100 text-pink-700" title="API & Accessibility">A</span>
            <span className="px-2 py-1.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-700" title="Load Testing">L</span>
            <span className="px-3 py-1.5 text-slate-400 text-sm">=</span>
            <span className="px-3 py-1.5 text-sm font-bold bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">FLOWSTRAL</span>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left Content */}
          <div className="space-y-8 text-center lg:text-left">
            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight">
                One Platform.
                <span className="block mt-2">Every Test Type.</span>
                <span className="block mt-2 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 bg-clip-text text-transparent pb-2" style={{ lineHeight: '1.2' }}>
                  Zero Code.
                </span>
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                Browser, API, Performance, Visual, Accessibility, Mobile & Salesforce testing — <span className="font-semibold text-violet-600">all unified in one platform</span>.
              </p>
            </div>

            {/* Stats Row */}
            <div className="flex flex-wrap justify-center lg:justify-start gap-x-8 gap-y-4">
              {[
                { value: '8', label: 'Testing Types' },
                { value: '10k+', label: 'Virtual Users' },
                { value: '0', label: 'Code Required' },
                { value: '60+', label: 'Step Types' },
              ].map((stat, idx) => (
                <div key={idx} className="text-center lg:text-left">
                  <div className="text-2xl font-bold text-slate-800">{stat.value}</div>
                  <div className="text-xs text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* CTAs - Three aligned buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-emerald-50 to-emerald-100 border-2 border-emerald-300 shadow-sm hover:shadow-md transition-shadow cursor-default">
                <div className="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-emerald-800">100% Without AI</div>
                  <div className="text-xs text-emerald-600">End-to-end test automation</div>
                </div>
              </div>
              <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-gradient-to-r from-fuchsia-50 to-pink-50 border-2 border-fuchsia-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate('/products/flowpilot')}>
                <div className="w-9 h-9 rounded-full bg-gradient-to-r from-fuchsia-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Compass className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-fuchsia-800 flex items-center gap-1">
                    Flowpilot
                  </div>
                  <div className="text-xs text-fuchsia-600">Goal-based AI agents that test for you</div>
                </div>
                <ArrowRight className="w-4 h-4 text-fuchsia-400 group-hover:translate-x-1 transition-transform" />
              </div>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate('/demo')}
                className="h-auto py-3 px-6 border-slate-200 bg-white/80 text-slate-700 hover:bg-white rounded-xl"
              >
                <Play className="w-5 h-5 mr-2" />
                Watch Demo
              </Button>
            </div>
          </div>

          {/* Right - Interactive Preview */}
          <div className="relative">
            <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-slate-200/50 overflow-hidden">
              {/* Browser Chrome */}
              <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-amber-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 bg-white rounded-md border border-slate-200 text-xs text-slate-400">
                    flowstral.app
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex gap-1 p-3 bg-slate-50/50 border-b border-slate-100">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all duration-300",
                      activeTab === tab.id 
                        ? tab.color === 'amber' ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30" :
                          tab.color === 'blue' ? "bg-blue-500 text-white shadow-lg shadow-blue-500/30" :
                          tab.color === 'emerald' ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" :
                          "bg-violet-500 text-white shadow-lg shadow-violet-500/30"
                        : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Content Area */}
              <div className="relative h-[340px] overflow-hidden">
                {/* Record Tab */}
                <div className={cn(
                  "absolute inset-0 p-5 transition-all duration-500 ease-out",
                  activeTab === 'record' 
                    ? "opacity-100 translate-x-0" 
                    : "opacity-0 -translate-x-8 pointer-events-none"
                )}>
                  <div className="flex gap-4 h-full">
                    {/* Recording Steps */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700">Recording...</span>
                        <Badge className="bg-red-100 text-red-600 border-0 animate-pulse">● REC</Badge>
                      </div>
                      {[
                        { step: 1, action: 'Navigate to login', done: true },
                        { step: 2, action: 'Fill username', done: true },
                        { step: 3, action: 'Fill password', done: true },
                        { step: 4, action: 'Click "Sign In"', done: false, active: true },
                      ].map((item, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl transition-all duration-300",
                            item.active 
                              ? "bg-amber-50 border-2 border-amber-400 shadow-sm" 
                              : "bg-slate-50 border border-slate-100"
                          )}
                          style={{ animationDelay: `${idx * 100}ms` }}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center text-sm font-medium",
                            item.done ? "bg-emerald-100 text-emerald-600" : 
                            item.active ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-500"
                          )}>
                            {item.done ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                          </div>
                          <span className={cn(
                            "text-sm",
                            item.active ? "font-medium text-amber-700" : "text-slate-600"
                          )}>{item.action}</span>
                        </div>
                      ))}
                    </div>

                    {/* Smart Suggestions Panel */}
                    <div className="w-48 p-3 bg-gradient-to-b from-blue-50 to-violet-50 rounded-xl border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-semibold text-slate-700">Smart Suggestions</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2">Contextual actions for current step</div>
                      <div className="space-y-1.5">
                        {['Assert element visible', 'Verify text content', 'Wait for network', 'Take screenshot', 'Add validation'].map((s, i) => (
                          <div key={i} className="px-2.5 py-1.5 bg-white rounded-lg text-[11px] text-slate-600 border border-slate-100 cursor-pointer hover:border-blue-300 hover:bg-blue-50 transition-all">
                            + {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Build Tab */}
                <div className={cn(
                  "absolute inset-0 p-5 transition-all duration-500 ease-out",
                  activeTab === 'build' 
                    ? "opacity-100 translate-x-0" 
                    : "opacity-0 translate-x-8 pointer-events-none"
                )}>
                  <div className="flex gap-4 h-full">
                    {/* Visual Steps */}
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-700">Test Steps</span>
                        <Button size="sm" className="h-7 bg-blue-500 hover:bg-blue-600 text-xs">+ Add Step</Button>
                      </div>
                      {[
                        { icon: Globe, step: 'Navigate', value: 'https://app.example.com' },
                        { icon: Type, step: 'Fill Input', value: 'user@company.com' },
                        { icon: Lock, step: 'Fill Input', value: '••••••••' },
                        { icon: MousePointer, step: 'Click', value: 'Sign In Button' },
                      ].map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 group hover:border-blue-200 transition-all">
                          <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                            <item.icon className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs text-slate-500">{item.step}</div>
                            <div className="text-sm text-slate-700 truncate">{item.value}</div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-blue-500" />
                            <Trash2 className="w-3.5 h-3.5 text-slate-400 cursor-pointer hover:text-red-500" />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Smart Fill Data Generators */}
                    <div className="w-48 p-3 bg-gradient-to-b from-amber-50 to-orange-50 rounded-xl border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Wand2 className="w-4 h-4 text-amber-600" />
                        <span className="text-xs font-semibold text-slate-700">Smart Fill</span>
                      </div>
                      <div className="text-[10px] text-slate-500 mb-2">Auto-generate test data</div>
                      <div className="space-y-1">
                        {[
                          { name: 'First Name', example: 'John' },
                          { name: 'Email', example: 'test@mail.com' },
                          { name: 'Phone', example: '+1-555-0123' },
                          { name: 'Address', example: '123 Main St' },
                          { name: 'Credit Card', example: '4111...1111' },
                        ].map((g, i) => (
                          <div key={i} className="flex items-center justify-between px-2 py-1.5 bg-white rounded-lg text-[11px] border border-slate-100 cursor-pointer hover:border-amber-300 hover:bg-amber-50 transition-all">
                            <span className="text-slate-700">{g.name}</span>
                            <span className="text-slate-400 text-[10px]">{g.example}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-amber-600 text-center mt-2 font-medium">50+ data generators</div>
                    </div>
                  </div>
                </div>

                {/* Execute Tab */}
                <div className={cn(
                  "absolute inset-0 p-5 transition-all duration-500 ease-out",
                  activeTab === 'execute' 
                    ? "opacity-100 translate-x-0" 
                    : "opacity-0 translate-x-8 pointer-events-none"
                )}>
                  <div className="space-y-4">
                    {/* Progress */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Test Execution</span>
                      <Badge className="bg-emerald-100 text-emerald-600 border-0">Running</Badge>
                    </div>
                    
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-emerald-700 font-medium">Login Flow Test</span>
                        <span className="text-xs text-emerald-600">Step 3/4</span>
                      </div>
                      <div className="h-2 bg-emerald-200 rounded-full overflow-hidden">
                        <div className="h-full w-3/4 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000" />
                      </div>
                    </div>

                    {/* Live Results */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Passed', value: '3', color: 'emerald' },
                        { label: 'Running', value: '1', color: 'blue' },
                        { label: 'Pending', value: '0', color: 'slate' },
                      ].map((stat, idx) => (
                        <div key={idx} className={cn(
                          "p-3 rounded-xl text-center",
                          stat.color === 'emerald' ? "bg-emerald-50" :
                          stat.color === 'blue' ? "bg-blue-50" : "bg-slate-50"
                        )}>
                          <div className={cn(
                            "text-2xl font-bold",
                            stat.color === 'emerald' ? "text-emerald-600" :
                            stat.color === 'blue' ? "text-blue-600" : "text-slate-400"
                          )}>{stat.value}</div>
                          <div className="text-xs text-slate-500">{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Execution Mode */}
                    <div className="flex gap-2">
                      <div className="flex-1 p-3 bg-violet-50 rounded-xl border border-violet-200 text-center">
                        <Bot className="w-5 h-5 text-violet-600 mx-auto mb-1" />
                        <div className="text-xs font-medium text-violet-700">Automated</div>
                      </div>
                      <div className="flex-1 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                        <MousePointer className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                        <div className="text-xs text-slate-500">Manual</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Analyze Tab */}
                <div className={cn(
                  "absolute inset-0 p-5 transition-all duration-500 ease-out",
                  activeTab === 'analyze' 
                    ? "opacity-100 translate-x-0" 
                    : "opacity-0 translate-x-8 pointer-events-none"
                )}>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-700">Test Results</span>
                      <Badge className="bg-emerald-100 text-emerald-600 border-0">
                        <CheckCircle2 className="w-3 h-3 mr-1" /> All Passed
                      </Badge>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100">
                        <div className="text-3xl font-bold text-emerald-600">100%</div>
                        <div className="text-xs text-slate-500">Pass Rate</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
                        <div className="text-3xl font-bold text-blue-600">2.3s</div>
                        <div className="text-xs text-slate-500">Duration</div>
                      </div>
                    </div>

                    {/* Test Results */}
                    <div className="space-y-2">
                      {[
                        { name: 'Navigate to login', time: '0.4s', pass: true },
                        { name: 'Fill credentials', time: '0.8s', pass: true },
                        { name: 'Submit form', time: '0.6s', pass: true },
                        { name: 'Verify dashboard', time: '0.5s', pass: true },
                      ].map((test, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-lg">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                          <span className="text-sm text-slate-700 flex-1">{test.name}</span>
                          <span className="text-xs text-slate-400">{test.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating Badge */}
            <div className="absolute -bottom-4 -right-4 px-4 py-2 bg-white rounded-xl shadow-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800">87%</div>
                  <div className="text-[10px] text-slate-500">Coverage</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOWSTRAL METHODOLOGY SHOWCASE
// ═══════════════════════════════════════════════════════════════════════════

function FlowstralSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();
  
  const flowstralParts = [
    {
      letters: 'FLOW',
      title: 'Flow',
      subtitle: 'Intelligent Workflow Engine',
      description: 'The foundation that powers everything. Visual test workflows, smart recording, and seamless orchestration.',
      icon: Workflow,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'from-blue-100 to-cyan-100',
      borderColor: 'border-blue-300',
      textColor: 'text-blue-600',
      href: '/products/visual-builder'
    },
    {
      letters: 'ST',
      title: 'System Testing',
      subtitle: 'End-to-End Validation',
      description: 'Complete system testing with intelligent element detection, self-healing locators, and cross-browser support.',
      icon: MonitorCheck,
      color: 'from-violet-500 to-purple-500',
      bgColor: 'from-violet-100 to-purple-100',
      borderColor: 'border-violet-300',
      textColor: 'text-violet-600',
      href: '/products/test-management'
    },
    {
      letters: 'R',
      title: 'Regression',
      subtitle: 'Automated Change Validation',
      description: 'Robust regression testing with smart test selection, impact analysis, and self-healing locators. Includes visual regression with 6 comparison modes.',
      icon: RefreshCw,
      color: 'from-amber-500 to-orange-500',
      bgColor: 'from-amber-100 to-orange-100',
      borderColor: 'border-amber-300',
      textColor: 'text-amber-600',
      href: '/products/smart-recorder'
    },
    {
      letters: 'A',
      title: 'API & Accessibility',
      subtitle: 'Multi-Protocol & WCAG 2.1',
      description: 'REST, GraphQL, SOAP testing with security scanning. Plus WCAG 2.1 accessibility validation.',
      icon: Cable,
      color: 'from-pink-500 to-rose-500',
      bgColor: 'from-pink-100 to-rose-100',
      borderColor: 'border-pink-300',
      textColor: 'text-pink-600',
      href: '/products/api-testing'
    },
    {
      letters: 'L',
      title: 'Load Testing',
      subtitle: 'Record → Load, SRM & Lighthouse',
      description: 'Record once, load test at scale. Server Resource Monitoring (SRM) and Lighthouse in one place—better than k6 for integrated observability. Scenario mix, ramp-up, and distributed runs.',
      icon: Activity,
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-100 to-teal-100',
      borderColor: 'border-emerald-300',
      textColor: 'text-emerald-600',
      href: '/products/performance'
    },
  ];

  // Auto-cycle through parts (smooth 4s interval)
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % flowstralParts.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-b from-white via-slate-50 to-blue-50/50">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] bg-blue-400/20 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-violet-400/20 rounded-full blur-[150px]" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-400/10 rounded-full blur-[120px]" />
        
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
          backgroundSize: '80px 80px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gradient-to-r from-blue-100 to-violet-100 text-violet-700 border-violet-200 px-4 py-1.5">
            <Sparkles className="w-3 h-3 mr-1.5" /> The FLOWSTRAL Methodology
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            One Platform.{' '}
            <span className="bg-gradient-to-r from-blue-600 via-violet-600 to-emerald-600 bg-clip-text text-transparent">
              Complete Coverage.
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Every letter in FLOWSTRAL represents a critical testing dimension. Together, they form the complete QA lifecycle.
          </p>
        </div>

        {/* FLOWSTRAL Word Display */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-1 sm:gap-2 p-3 rounded-2xl bg-white/80 backdrop-blur-sm border border-slate-200 shadow-lg">
            {flowstralParts.map((part, idx) => (
              <button
                key={idx}
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  "relative px-3 sm:px-5 py-3 rounded-xl font-bold text-xl sm:text-3xl tracking-wider transition-all duration-500",
                  activeIndex === idx 
                    ? `bg-gradient-to-r ${part.color} text-white shadow-lg scale-110`
                    : "text-slate-400 hover:text-slate-600"
                )}
              >
                {part.letters}
                {activeIndex === idx && (
                  <div className={cn(
                    "absolute -bottom-1 left-1/2 -translate-x-1/2 w-1/2 h-1 rounded-full bg-gradient-to-r",
                    part.color
                  )} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Flow Visualization - Horizontal Journey */}
        <div className="relative mb-16">
          {/* Connection Line */}
          <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-slate-300 to-transparent -translate-y-1/2 hidden lg:block" />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-6">
            {flowstralParts.map((part, idx) => {
              const Icon = part.icon;
              const isActive = activeIndex === idx;
              
              return (
                <div
                  key={idx}
                  onClick={() => {
                    setActiveIndex(idx);
                    navigate(part.href);
                  }}
                  className={cn(
                    "relative group cursor-pointer transition-all duration-500",
                    isActive ? "scale-105 z-10" : "hover:scale-102"
                  )}
                >
                  {/* Card */}
                  <div className={cn(
                    "relative p-6 rounded-2xl border backdrop-blur-sm transition-all duration-500 h-full",
                    isActive 
                      ? `bg-gradient-to-b ${part.bgColor} ${part.borderColor} shadow-xl`
                      : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-md"
                  )}>
                    {/* Glow effect */}
                    {isActive && (
                      <div className={cn(
                        "absolute -inset-px rounded-2xl bg-gradient-to-r opacity-30 blur-sm -z-10",
                        part.color
                      )} />
                    )}
                    
                    {/* Icon */}
                    <div className={cn(
                      "w-14 h-14 rounded-xl mb-4 flex items-center justify-center transition-all duration-500",
                      isActive 
                        ? `bg-gradient-to-r ${part.color} shadow-lg`
                        : "bg-slate-100"
                    )}>
                      <Icon className={cn(
                        "w-7 h-7 transition-colors",
                        isActive ? "text-white" : "text-slate-500"
                      )} />
                    </div>

                    {/* Letter badge */}
                    <div className={cn(
                      "inline-flex items-center gap-1 px-3 py-1 rounded-lg mb-3 text-sm font-bold",
                      isActive 
                        ? `bg-gradient-to-r ${part.color} text-white`
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {part.letters}
                    </div>

                    {/* Title */}
                    <h3 className={cn(
                      "text-lg font-bold mb-1 transition-colors",
                      isActive ? "text-slate-900" : "text-slate-700"
                    )}>
                      {part.title}
                    </h3>

                    {/* Subtitle */}
                    <p className={cn(
                      "text-xs mb-3 transition-colors font-medium",
                      isActive ? part.textColor : "text-slate-400"
                    )}>
                      {part.subtitle}
                    </p>

                    {/* Description */}
                    <p className={cn(
                      "text-sm leading-relaxed transition-all duration-300",
                      isActive ? "text-slate-700 opacity-100" : "text-slate-500 opacity-80"
                    )}>
                      {part.description}
                    </p>

                    {/* Arrow connector (hidden on mobile) */}
                    {idx < flowstralParts.length - 1 && (
                      <div className="hidden lg:flex absolute -right-3 top-1/2 -translate-y-1/2 z-20">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all duration-500 bg-white border",
                          isActive || activeIndex === idx + 1
                            ? "border-slate-300 text-slate-600"
                            : "border-slate-200 text-slate-400"
                        )}>
                          <ChevronRight className="w-4 h-4" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Feature Callout for Active Section */}
        <div className="max-w-3xl mx-auto">
          <div className={cn(
            "p-8 rounded-3xl border backdrop-blur-sm transition-all duration-500 bg-gradient-to-r shadow-lg",
            flowstralParts[activeIndex].bgColor,
            flowstralParts[activeIndex].borderColor
          )}>
            <div className="flex flex-col sm:flex-row items-start gap-6">
              <div className={cn(
                "w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-r shadow-xl flex-shrink-0",
                flowstralParts[activeIndex].color
              )}>
                {React.createElement(flowstralParts[activeIndex].icon, { className: "w-8 h-8 text-white" })}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn(
                    "text-3xl font-black bg-gradient-to-r bg-clip-text text-transparent",
                    flowstralParts[activeIndex].color
                  )}>
                    {flowstralParts[activeIndex].letters}
                  </span>
                  <span className="text-2xl font-bold text-slate-900">
                    {flowstralParts[activeIndex].title}
                  </span>
                </div>
                <p className="text-slate-600 mb-4">
                  {flowstralParts[activeIndex].description}
                </p>
                <Button 
                  onClick={() => navigate(flowstralParts[activeIndex].href)}
                  className={cn(
                    "bg-gradient-to-r text-white border-0 hover:opacity-90 shadow-md",
                    flowstralParts[activeIndex].color
                  )}
                >
                  Learn More
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="flex justify-center gap-2 mt-8">
          {flowstralParts.map((part, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                activeIndex === idx 
                  ? `w-8 bg-gradient-to-r ${part.color}`
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FEATURES SHOWCASE - Premium Cards
// ═══════════════════════════════════════════════════════════════════════════

type PluginKey = keyof LandingPlugins;

const features: Array<{
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  gradient: string;
  bgGradient: string;
  highlights: string[];
  href: string;
  plugin?: PluginKey;
}> = [
  {
    icon: MousePointer,
    title: 'Smart Recorder',
    description: 'Record browser interactions with intelligent element detection. Get contextual suggestions as you record.',
    gradient: 'from-amber-500 to-orange-500',
    bgGradient: 'from-amber-50 to-orange-50',
    highlights: ['Element Detection', 'Smart Suggestions', 'Auto-Wait'],
    href: '/products/smart-recorder'
  },
  {
    icon: Blocks,
    title: 'Visual Builder',
    description: 'Build tests with drag-and-drop. Smart Fill with 50+ data generators for realistic test data.',
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-50 to-cyan-50',
    highlights: ['Drag & Drop', '50+ Generators', 'Reusable Steps'],
    href: '/products/visual-builder'
  },
  {
    icon: Compass,
    title: 'Flowpilot',
    description: 'Goal-based AI agents that explore, test, and validate autonomously. Flowmap, Explorer, and more.',
    gradient: 'from-fuchsia-500 to-pink-500',
    bgGradient: 'from-fuchsia-50 to-pink-50',
    highlights: ['Goal-Driven', 'Flowmap', 'Explorer', 'Self-Healing'],
    href: '/products/flowpilot'
  },
  {
    icon: Smartphone,
    title: 'Mobile Testing',
    description: 'Test on 50+ real device profiles. Network throttling, touch gestures, and native app support.',
    gradient: 'from-sky-500 to-indigo-500',
    bgGradient: 'from-sky-50 to-indigo-50',
    highlights: ['50+ Devices', 'Network Throttling', 'Native Apps'],
    href: '/products/mobile-testing',
    plugin: 'mobile'
  },
  {
    icon: ClipboardCheck,
    title: 'Test Management',
    description: 'Complete test lifecycle. Cases, Suites, Plans, Releases, Runs, Defects - all connected.',
    gradient: 'from-violet-500 to-purple-500',
    bgGradient: 'from-violet-50 to-purple-50',
    highlights: ['6 Modules', 'Manual + Auto', 'Traceability'],
    href: '/products/test-management'
  },
  {
    icon: Globe,
    title: 'API Testing',
    description: 'Test REST, GraphQL, SOAP APIs. Chain requests and scan for security vulnerabilities.',
    gradient: 'from-pink-500 to-rose-500',
    bgGradient: 'from-pink-50 to-rose-50',
    highlights: ['Multi-Protocol', 'Security Scan', 'Chaining'],
    href: '/products/api-testing',
    plugin: 'api'
  },
  {
    icon: Activity,
    title: 'Performance',
    description: 'Load test with 10,000+ virtual users. Auto-correlation and multiple load patterns.',
    gradient: 'from-emerald-500 to-teal-500',
    bgGradient: 'from-emerald-50 to-teal-50',
    highlights: ['10k+ VUs', 'Auto-Correlation', 'Load Patterns'],
    href: '/products/performance',
    plugin: 'perf'
  },
  {
    icon: Eye,
    title: 'Visual Testing',
    description: 'Catch visual regressions with 6 comparison modes. Pixel-perfect validation.',
    gradient: 'from-indigo-500 to-violet-500',
    bgGradient: 'from-indigo-50 to-violet-50',
    highlights: ['6 Modes', 'Pixel Diff', 'Baselines'],
    href: '/products/visual-testing'
  },
  {
    icon: Accessibility,
    title: 'Accessibility',
    description: 'WCAG 2.1 scanning. Identify issues by severity with remediation guidance.',
    gradient: 'from-teal-500 to-emerald-500',
    bgGradient: 'from-teal-50 to-emerald-50',
    highlights: ['WCAG 2.1', 'Fix Guides', 'Reports'],
    href: '/products/accessibility',
    plugin: 'a11y'
  },
];

function FeaturesSection() {
  const navigate = useNavigate();
  const { isAvailable, isLicensed } = useLandingPlugins();
  const visibleFeatures = features.filter((f) => !f.plugin || isAvailable(f.plugin));

  return (
    <section id="features" className="py-24 bg-white relative">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-blue-100 text-blue-700 border-0 px-4 py-1.5">
            Complete QA Platform
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">
            Everything You Need in <span className="text-blue-600">One Platform</span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Free to start. Enterprise-ready when you scale. No hidden costs.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {visibleFeatures.map((feature, idx) => (
            <div 
              key={idx}
              onClick={() => navigate(feature.href)}
              className="group relative p-6 rounded-2xl bg-white border border-slate-200 hover:border-transparent hover:shadow-xl transition-all duration-300 hover:-translate-y-1 cursor-pointer"
            >
              {/* Gradient Border on Hover */}
              <div className={cn(
                "absolute inset-0 rounded-2xl bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity -z-10 blur-sm",
                feature.gradient
              )} />
              
              <div className={cn(
                "w-14 h-14 rounded-2xl bg-gradient-to-r mb-5 flex items-center justify-center shadow-lg",
                feature.gradient
              )}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              
              <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
              <p className="text-sm text-slate-500 mb-4 leading-relaxed">{feature.description}</p>
              
              <div className="flex flex-wrap gap-1.5">
                {feature.highlights.map((h, i) => (
                  <Badge key={i} className={cn("text-[10px] border-0 bg-gradient-to-r", feature.bgGradient)}>
                    {h}
                  </Badge>
                ))}
              </div>
              
              <div className="mt-4 text-xs text-slate-400 group-hover:text-blue-600 transition-colors flex items-center gap-1">
                Learn more <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PERFORMANCE & API SHOWCASE
// ═══════════════════════════════════════════════════════════════════════════

function PerformanceAPISection() {
  const [activeMetric, setActiveMetric] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveMetric(prev => (prev + 1) % 5);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const metrics = [
    { label: 'Virtual Users', value: '10k+', color: 'emerald' },
    { label: 'Requests/sec', value: '2.4k+', color: 'blue' },
    { label: 'Avg Latency', value: '45ms', color: 'amber' },
    { label: 'Error Rate', value: '0.02%', color: 'violet' },
    { label: 'SRM + Lighthouse', value: 'Built-in', color: 'emerald' },
  ];

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Performance Testing */}
          <div className="space-y-6">
            <Badge className="bg-emerald-100 text-emerald-700 border-0">Performance Testing</Badge>
            <h3 className="text-3xl font-bold text-slate-900">
              Integrated Load + SRM + Lighthouse — <span className="text-emerald-600">All Built-In</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Record once, load test at scale. Server Resource Monitoring (SRM) and Lighthouse built in—no scripting needed.
              Scenario mix, ramp-up, distributed runs. Real-time metrics and threshold-based validation.
            </p>

            {/* Metrics Display */}
            <div className="grid grid-cols-2 gap-4">
              {metrics.map((metric, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all duration-500 ease-out",
                    activeMetric === idx 
                      ? metric.color === 'emerald' ? "bg-emerald-50 border-emerald-300 scale-[1.02]" :
                        metric.color === 'blue' ? "bg-blue-50 border-blue-300 scale-[1.02]" :
                        metric.color === 'amber' ? "bg-amber-50 border-amber-300 scale-[1.02]" :
                        "bg-violet-50 border-violet-300 scale-[1.02]"
                      : "bg-white border-slate-200"
                  )}
                >
                  <div className={cn(
                    "text-2xl font-bold transition-colors duration-300",
                    activeMetric === idx
                      ? metric.color === 'emerald' ? "text-emerald-600" :
                        metric.color === 'blue' ? "text-blue-600" :
                        metric.color === 'amber' ? "text-amber-600" :
                        "text-violet-600"
                      : "text-slate-700"
                  )}>{metric.value}</div>
                  <div className="text-sm text-slate-500">{metric.label}</div>
                </div>
              ))}
            </div>

            {/* Load Patterns + SRM/Lighthouse */}
            <div className="p-4 bg-slate-50 rounded-xl">
              <div className="text-sm font-medium text-slate-700 mb-3">Load patterns & observability</div>
              <div className="flex flex-wrap gap-2">
                {['⚡ Spike', '🔥 Stress', '⏱️ Endurance', '🎯 Breakpoint', '📊 SRM', '🔦 Lighthouse'].map((p, i) => (
                  <Badge key={i} className="bg-white border border-slate-200 text-slate-600 transition-transform hover:scale-105">{p}</Badge>
                ))}
              </div>
            </div>
          </div>

          {/* API Testing */}
          <div className="space-y-6">
            <Badge className="bg-pink-100 text-pink-700 border-0">API Testing</Badge>
            <h3 className="text-3xl font-bold text-slate-900">
              Multi-Protocol with <span className="text-pink-600">Security</span>
            </h3>
            <p className="text-slate-600 leading-relaxed">
              Test REST, GraphQL, and SOAP APIs in one place. Chain requests together, validate responses 
              against schemas, and scan for security vulnerabilities automatically.
            </p>

            {/* Protocol Tabs */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex border-b border-slate-200">
                {['REST', 'GraphQL', 'SOAP'].map((p, i) => (
                  <div key={i} className={cn(
                    "flex-1 py-3 text-center text-sm font-medium",
                    i === 0 ? "bg-pink-50 text-pink-700 border-b-2 border-pink-500" : "text-slate-500"
                  )}>{p}</div>
                ))}
              </div>
              <div className="p-4 space-y-2">
                {[
                  { method: 'POST', path: '/auth/login', status: '200' },
                  { method: 'GET', path: '/users/me', status: '200' },
                  { method: 'PUT', path: '/users/{id}', status: '200' },
                ].map((req, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                    <Badge className={cn(
                      "text-xs border-0",
                      req.method === 'POST' ? "bg-green-100 text-green-700" :
                      req.method === 'GET' ? "bg-blue-100 text-blue-700" :
                      "bg-amber-100 text-amber-700"
                    )}>{req.method}</Badge>
                    <code className="text-sm text-slate-600 flex-1">{req.path}</code>
                    <Badge className="bg-emerald-100 text-emerald-700 text-xs border-0">{req.status}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Security Features */}
            <div className="flex flex-wrap gap-2">
              {['SQL Injection', 'XSS', 'CSRF', 'Auth Testing', 'Schema Validation'].map((s, i) => (
                <Badge key={i} className="bg-slate-100 text-slate-600 border-0">
                  <ShieldAlert className="w-3 h-3 mr-1" /> {s}
                </Badge>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL & A11Y SECTION
// ═══════════════════════════════════════════════════════════════════════════

function VisualA11ySection() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Visual Testing */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-indigo-50 via-violet-50 to-purple-50 border border-indigo-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 flex items-center justify-center shadow-lg">
                <Eye className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Visual Testing</h3>
                <p className="text-sm text-slate-500">6 comparison modes</p>
              </div>
            </div>

            {/* Visual Diff Preview */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              {['Baseline', 'Current', 'Diff'].map((label, i) => (
                <div key={i} className="text-center">
                  <div className={cn(
                    "h-24 rounded-xl flex items-center justify-center border",
                    i === 2 ? "bg-red-50 border-red-200" : "bg-white border-slate-200"
                  )}>
                    {i === 2 ? <Diff className="w-6 h-6 text-red-400" /> : <ImageIcon className="w-6 h-6 text-slate-300" />}
                  </div>
                  <div className={cn("text-xs mt-2", i === 2 ? "text-red-500 font-medium" : "text-slate-500")}>{label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {['Strict', 'Layout', 'Content', 'Anti-Alias', 'Colors', 'Zones'].map((m, i) => (
                <Badge key={i} className={cn(
                  "text-xs justify-center border-0",
                  i === 0 ? "bg-indigo-100 text-indigo-700" : "bg-white text-slate-600"
                )}>{m}</Badge>
              ))}
            </div>
          </div>

          {/* Accessibility */}
          <div className="p-8 rounded-3xl bg-gradient-to-br from-teal-50 via-emerald-50 to-green-50 border border-teal-100">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 flex items-center justify-center shadow-lg">
                <Accessibility className="w-7 h-7 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800">Accessibility</h3>
                <p className="text-sm text-slate-500">WCAG 2.1 scanning</p>
              </div>
            </div>

            {/* Issues Preview */}
            <div className="space-y-3 mb-6">
              {[
                { level: 'Critical', count: 2, color: 'red' },
                { level: 'Serious', count: 5, color: 'orange' },
                { level: 'Moderate', count: 3, color: 'amber' },
              ].map((issue, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-100">
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm",
                    issue.color === 'red' ? "bg-red-500" :
                    issue.color === 'orange' ? "bg-orange-500" : "bg-amber-500"
                  )}>{issue.count}</div>
                  <span className={cn(
                    "text-sm font-medium",
                    issue.color === 'red' ? "text-red-600" :
                    issue.color === 'orange' ? "text-orange-600" : "text-amber-600"
                  )}>{issue.level}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-teal-100">
              <span className="text-sm text-slate-600">247 elements</span>
              <Badge className="bg-emerald-100 text-emerald-700 border-0">
                <CheckCircle2 className="w-3 h-3 mr-1" /> 237 passed
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FLOWPILOT - GOAL-BASED AGENTIC TESTING
// ═══════════════════════════════════════════════════════════════════════════

function FlowpilotSection() {
  const navigate = useNavigate();
  const [activeAgent, setActiveAgent] = useState(0);
  
  const agents = [
    {
      name: 'Flowmap',
      icon: Map,
      description: 'Visualize and explore all possible user journeys. Discover untested paths automatically.',
      color: 'from-fuchsia-500 to-pink-500',
      bgColor: 'from-fuchsia-50 to-pink-50',
      features: ['Journey Discovery', 'Path Visualization', 'Coverage Gaps']
    },
    {
      name: 'Explorer',
      icon: Compass,
      description: 'AI-powered autonomous exploration. Let the agent find bugs while you sleep.',
      color: 'from-violet-500 to-purple-500',
      bgColor: 'from-violet-50 to-purple-50',
      features: ['Auto-Exploration', 'Bug Detection', 'Edge Cases']
    },
    {
      name: 'Self-Healer',
      icon: RefreshCw,
      description: 'Automatic locator repair when elements change. Zero maintenance overhead.',
      color: 'from-emerald-500 to-teal-500',
      bgColor: 'from-emerald-50 to-teal-50',
      features: ['Auto-Repair', 'Smart Locators', 'Zero Flakes']
    },
    {
      name: 'Generator',
      icon: Sparkles,
      description: 'Generate tests from goals. Describe what to test, AI creates the steps.',
      color: 'from-amber-500 to-orange-500',
      bgColor: 'from-amber-50 to-orange-50',
      features: ['NLP Input', 'Test Generation', 'Goal-to-Test']
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveAgent(prev => (prev + 1) % agents.length);
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 relative overflow-hidden bg-gradient-to-b from-white via-fuchsia-50/30 to-white">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-fuchsia-400/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-violet-400/10 rounded-full blur-[120px]" />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.015]" style={{
          backgroundImage: `linear-gradient(rgba(0,0,0,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,1) 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }} />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16">
          <Badge className="mb-4 bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0 px-4 py-1.5 shadow-lg">
            <BrainCircuit className="w-4 h-4 mr-1.5 inline" /> Flowpilot
          </Badge>
          <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
            Goal-Based{' '}
            <span className="bg-gradient-to-r from-fuchsia-500 via-pink-500 to-violet-500 bg-clip-text text-transparent">
              Agentic Testing
            </span>
          </h2>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            The first QA platform with <span className="text-fuchsia-600 font-semibold">Flowpilot</span> — 
            autonomous AI agents that understand goals, explore intelligently, and test purposefully.
          </p>
        </div>

        {/* Agent Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {agents.map((agent, idx) => {
            const Icon = agent.icon;
            const isActive = activeAgent === idx;
            
            return (
              <div
                key={idx}
                onClick={() => setActiveAgent(idx)}
                className={cn(
                  "relative p-6 rounded-2xl cursor-pointer transition-all duration-500",
                  isActive 
                    ? `bg-gradient-to-b ${agent.bgColor} border-2 border-fuchsia-200 shadow-xl scale-105`
                    : "bg-white border border-slate-200 hover:border-fuchsia-200 hover:shadow-md"
                )}
              >
                {isActive && (
                  <div className={cn(
                    "absolute -inset-px rounded-2xl bg-gradient-to-r opacity-30 blur-sm -z-10",
                    agent.color
                  )} />
                )}
                
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-all",
                  isActive 
                    ? `bg-gradient-to-r ${agent.color} shadow-lg`
                    : "bg-slate-100"
                )}>
                  <Icon className={cn(
                    "w-6 h-6 transition-colors",
                    isActive ? "text-white" : "text-slate-500"
                  )} />
                </div>

                <h3 className={cn(
                  "text-lg font-bold mb-2 transition-colors",
                  isActive ? "text-slate-900" : "text-slate-700"
                )}>
                  {agent.name}
                </h3>

                <p className={cn(
                  "text-sm mb-4 transition-colors",
                  isActive ? "text-slate-600" : "text-slate-500"
                )}>
                  {agent.description}
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {agent.features.map((f, i) => (
                    <Badge 
                      key={i} 
                      className={cn(
                        "text-[10px] border-0 transition-all",
                        isActive 
                          ? `bg-gradient-to-r ${agent.color} text-white`
                          : "bg-slate-100 text-slate-600"
                      )}
                    >
                      {f}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-12">
          {agents.map((agent, idx) => (
            <button
              key={idx}
              onClick={() => setActiveAgent(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-500",
                activeAgent === idx 
                  ? `w-8 bg-gradient-to-r ${agent.color}`
                  : "w-2 bg-slate-300 hover:bg-slate-400"
              )}
            />
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <Button 
            size="lg"
            onClick={() => navigate('/products/flowpilot')}
            className="h-14 px-10 bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 text-white font-semibold rounded-xl shadow-lg shadow-fuchsia-500/30 transition-all hover:scale-105"
          >
            <BrainCircuit className="w-5 h-5 mr-2" />
            Explore Flowpilot
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MOBILE TESTING SECTION
// ═══════════════════════════════════════════════════════════════════════════

function MobileTestingSection() {
  const navigate = useNavigate();
  const [selectedDevice, setSelectedDevice] = useState(0);
  
  const devices = [
    { name: 'iPhone 15 Pro', viewport: '393×852', category: 'iOS' },
    { name: 'iPhone 14', viewport: '390×844', category: 'iOS' },
    { name: 'Pixel 8', viewport: '412×915', category: 'Android' },
    { name: 'Galaxy S24', viewport: '360×780', category: 'Android' },
    { name: 'iPad Pro', viewport: '1024×1366', category: 'Tablet' },
  ];

  const networkPresets = [
    { name: '4G LTE', speed: '12 Mbps', icon: '📶' },
    { name: '3G', speed: '1.5 Mbps', icon: '📱' },
    { name: 'Slow 3G', speed: '400 Kbps', icon: '🐢' },
    { name: 'Offline', speed: '—', icon: '✈️' },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setSelectedDevice(prev => (prev + 1) % devices.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-sky-400/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-400/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Content */}
          <div>
            <Badge className="mb-4 bg-gradient-to-r from-sky-500 to-indigo-500 text-white border-0 px-4 py-1.5 shadow-md">
              <Smartphone className="w-4 h-4 mr-1.5 inline" /> Mobile Testing
            </Badge>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">
              Test on{' '}
              <span className="bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">
                50+ Real Devices
              </span>
            </h2>
            <p className="text-lg text-slate-600 mb-8">
              Complete mobile web emulation with real device profiles, network throttling, 
              and native app testing via Maestro integration.
            </p>

            {/* Device Categories */}
            <div className="space-y-4 mb-8">
              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-sky-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">iOS Devices</div>
                  <div className="text-sm text-slate-500">iPhone 15, 14, 13, SE, iPad Pro & more</div>
                </div>
                <Badge className="ml-auto bg-sky-100 text-sky-700 border-0">20+ devices</Badge>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Android Devices</div>
                  <div className="text-sm text-slate-500">Pixel, Galaxy, OnePlus, Xiaomi & more</div>
                </div>
                <Badge className="ml-auto bg-emerald-100 text-emerald-700 border-0">25+ devices</Badge>
              </div>

              <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-violet-600" />
                </div>
                <div>
                  <div className="font-semibold text-slate-800">Network Conditions</div>
                  <div className="text-sm text-slate-500">4G, 3G, Slow 3G, Offline simulation</div>
                </div>
                <Badge className="ml-auto bg-violet-100 text-violet-700 border-0">6 presets</Badge>
              </div>
            </div>

            <Button 
              size="lg"
              onClick={() => navigate('/products/mobile-testing')}
              className="h-12 px-8 bg-gradient-to-r from-sky-500 to-indigo-500 text-white font-semibold rounded-xl shadow-lg transition-all hover:scale-105"
            >
              <Smartphone className="w-5 h-5 mr-2" />
              Explore Mobile Testing
            </Button>
          </div>

          {/* Right - Device Preview */}
          <div className="relative flex justify-center">
            {/* Phone Frame */}
            <div className="relative w-[280px] h-[560px] bg-slate-900 rounded-[40px] p-3 shadow-2xl">
              {/* Notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-7 bg-slate-900 rounded-b-2xl z-10" />
              
              {/* Screen */}
              <div className="w-full h-full bg-white rounded-[32px] overflow-hidden relative">
                {/* Status Bar */}
                <div className="flex items-center justify-between px-6 py-2 bg-slate-100">
                  <span className="text-xs text-slate-600">9:41</span>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3 h-3 text-slate-600" />
                    <div className="w-6 h-3 bg-slate-600 rounded-sm" />
                  </div>
                </div>

                {/* Device Info */}
                <div className="p-4 bg-gradient-to-r from-sky-500 to-indigo-500 text-white">
                  <div className="text-lg font-bold">{devices[selectedDevice].name}</div>
                  <div className="text-sm text-white/80">{devices[selectedDevice].viewport}</div>
                  <Badge className="mt-2 bg-white/20 text-white border-0 text-xs">
                    {devices[selectedDevice].category}
                  </Badge>
                </div>

                {/* Network Preview */}
                <div className="p-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Network</div>
                  <div className="grid grid-cols-2 gap-2">
                    {networkPresets.map((n, i) => (
                      <div key={i} className="p-2 bg-slate-50 rounded-lg text-center">
                        <div className="text-lg">{n.icon}</div>
                        <div className="text-xs font-medium text-slate-700">{n.name}</div>
                        <div className="text-[10px] text-slate-400">{n.speed}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recording indicator */}
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl text-white text-center shadow-lg">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    <span className="text-sm font-semibold">Recording on {devices[selectedDevice].name}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating badges */}
            <div className="absolute -right-4 top-20 bg-white p-3 rounded-xl shadow-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-800">Touch Events</div>
              <div className="text-xs text-slate-500">Tap, Swipe, Pinch</div>
            </div>
            
            <div className="absolute -left-4 bottom-32 bg-white p-3 rounded-xl shadow-lg border border-slate-200">
              <div className="text-sm font-bold text-slate-800">Native Apps</div>
              <div className="text-xs text-slate-500">Maestro Integration</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL PROOF SECTION
// ═══════════════════════════════════════════════════════════════════════════

function SocialProofSection() {
  const replacedTools = ['Selenium Grid', 'Postman', 'JMeter', 'Applitools', 'axe DevTools', 'Sauce Labs'];

  return (
    <section className="py-20 bg-slate-50 border-y border-slate-200/60">
      <div className="max-w-7xl mx-auto px-6">
        {/* Trusted By */}
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-8">
            Trusted by QA teams at innovative companies
          </p>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="w-32 h-12 rounded-lg bg-slate-200/60 flex items-center justify-center text-sm text-slate-400 font-medium"
              >
                Logo
              </div>
            ))}
          </div>
        </div>

        {/* Replace Your Stack */}
        <div className="text-center mt-16">
          <h3 className="text-xl font-bold text-slate-900 mb-6">
            Replace your entire testing stack
          </h3>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {replacedTools.map((tool, idx) => (
              <span
                key={idx}
                className="px-3 py-1.5 rounded-full bg-red-50 text-red-400 text-sm line-through decoration-red-300"
              >
                {tool}
              </span>
            ))}
            <ArrowRight className="w-5 h-5 text-slate-400 mx-2" />
            <span className="px-4 py-1.5 rounded-full bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 text-white text-sm font-bold shadow-md">
              Flowstral
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CTA SECTION
// ═══════════════════════════════════════════════════════════════════════════

function CTASection() {
  const navigate = useNavigate();
  
  return (
    <section className="py-24 bg-gradient-to-r from-blue-600 via-violet-600 to-purple-600 relative overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/10 rounded-full blur-[100px]" />
      </div>
      
      <div className="relative max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
          Replace 5-8 Testing Tools with One Platform
        </h2>
        <p className="text-xl text-white/80 mb-10">
          Start free with unlimited test building. Upgrade to Enterprise for the full AI-powered suite.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
          <Button 
            size="lg"
            onClick={() => navigate('/signup')}
            className="h-14 px-10 bg-white text-violet-600 hover:bg-white/90 font-semibold rounded-xl shadow-lg transition-all hover:scale-105"
          >
            <Rocket className="w-5 h-5 mr-2" />
            Get Started Free
          </Button>
          <Button 
            size="lg"
            variant="outline"
            onClick={() => navigate('/contact')}
            className="h-14 px-10 border-white/30 text-white hover:bg-white/10 rounded-xl"
          >
            Schedule Live Demo
          </Button>
        </div>

        <div className="flex flex-wrap justify-center gap-8 text-white/70 text-sm">
          {['Free forever plan', 'No credit card', 'Upgrade anytime', 'On-prem available'].map((item, idx) => (
            <span key={idx} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" /> {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER & FOOTER
// ═══════════════════════════════════════════════════════════════════════════

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
        : "bg-transparent"
    )}>
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <span className="text-white font-bold text-lg">F</span>
            </div>
            <span className="text-xl font-bold text-slate-800">Flowstral</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium">Features</a>
            <span onClick={() => navigate('/pricing')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer">Pricing</span>
            <span onClick={() => navigate('/download')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer">Download</span>
            <span onClick={() => navigate('/about')} className="text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium cursor-pointer">About</span>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          {/* Optional plugins: what to show on landing page (license-aware) */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-slate-900 font-medium gap-1.5"
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
                  <Badge className="text-[10px] bg-gradient-to-r from-blue-100 to-violet-100 text-violet-700 border-0">
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
                          className={cn(
                            "rounded border-slate-300",
                            !licensed && "opacity-50"
                          )}
                        />
                        <Icon className={cn(
                          "w-4 h-4",
                          licensed ? "text-slate-400" : "text-slate-300"
                        )} />
                        <span className={cn(
                          "text-sm flex-1",
                          licensed ? "text-slate-700" : "text-slate-400"
                        )}>{label}</span>
                        {!licensed && (
                          <div className="flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-500" />
                            <span className="text-[10px] text-amber-600 font-medium uppercase">
                              {requiredTier}
                            </span>
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
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs"
                      onClick={() => navigate('/pricing')}
                    >
                      <Rocket className="w-3 h-3 mr-1.5" />
                      Upgrade to unlock all features
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <Button variant="ghost" className="text-slate-600 hover:text-slate-900 font-medium" onClick={() => navigate('/signin')}>
            Sign In
          </Button>
          <Button 
            className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 shadow-lg shadow-blue-500/20 font-medium" 
            onClick={() => navigate('/signup')}
          >
            Start Free <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const navigate = useNavigate();
  
  const footerLinks = {
    Product: [
      { name: 'Smart Recorder', href: '/products/smart-recorder' },
      { name: 'Visual Builder', href: '/products/visual-builder' },
      { name: 'Flowpilot ✨', href: '/products/flowpilot' },
      { name: 'Mobile Testing ✨', href: '/products/mobile-testing' },
      { name: 'API Testing', href: '/products/api-testing' },
      { name: 'Performance', href: '/products/performance' },
      { name: 'Download Desktop', href: '/download' },
    ],
    Resources: [
      { name: 'Documentation', href: '/resources/docs' },
      { name: 'Watch Demo', href: '/demo' },
      { name: 'FAQ', href: '/faq' },
      { name: 'Community', href: '/resources/community' },
      { name: 'Support', href: '/contact' },
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-4 cursor-pointer" onClick={() => navigate('/')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-violet-500 flex items-center justify-center">
                <span className="text-white font-bold text-xl">F</span>
              </div>
              <span className="text-xl font-bold">Flowstral</span>
            </div>
            <p className="text-slate-400 text-sm mb-6">
              The complete no-code QA platform. Maximize test coverage without writing code.
            </p>
            <div className="flex gap-3">
              {[Twitter, Linkedin, Github, Youtube].map((Icon, idx) => (
                <a key={idx} href="#" className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:bg-slate-700 hover:text-white transition-all">
                  <Icon className="w-4 h-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h3 className="font-semibold mb-4">{title}</h3>
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

      {/* Bottom */}
      <div className="border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="text-sm text-slate-500">© 2026 Flowstral Inc. All rights reserved.</div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link to="/faq" className="hover:text-white transition-colors">FAQ</Link>
          </div>
        </div>
      </div>

      {/* Contact Bar */}
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

// ═══════════════════════════════════════════════════════════════════════════
// MAIN LANDING PAGE
// ═══════════════════════════════════════════════════════════════════════════

function LandingPageContent() {
  const { isAvailable } = useLandingPlugins();
  const showPerfOrApi = isAvailable('perf') || isAvailable('api');
  const showA11y = isAvailable('a11y');
  const showMobile = isAvailable('mobile');

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <FlowstralSection />
        <FlowpilotSection />
        <SocialProofSection />
        {showMobile && <MobileTestingSection />}
        <FeaturesSection />
        {showPerfOrApi && <PerformanceAPISection />}
        {showA11y && <VisualA11ySection />}
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
