/**
 * Smart Recorder - Product Feature Page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  MousePointer, Play, CheckCircle2, ArrowRight, Lightbulb,
  Zap, Target, Clock, Shield, Eye, Type, Lock, Globe,
  Layers, RefreshCw,
  Database
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MarketingHeader } from '@/components/MarketingHeader';
import { cn } from '@/lib/utils';

// How It Works Step Component
function HowItWorksStep({ step, title, description, isActive, icon: Icon }: { 
  step: number; 
  title: string; 
  description: string; 
  isActive: boolean;
  icon: any;
}) {
  return (
    <div className={cn(
      "relative p-6 rounded-2xl border-2 transition-all duration-500",
      isActive 
        ? "bg-amber-50 border-amber-300 shadow-lg scale-105" 
        : "bg-white border-slate-200 hover:border-slate-300"
    )}>
      <div className={cn(
        "absolute -top-4 -left-4 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg shadow-lg transition-all",
        isActive ? "bg-amber-500 text-white" : "bg-slate-200 text-slate-600"
      )}>
        {step}
      </div>
      <div className="pt-2">
        <Icon className={cn("w-8 h-8 mb-3", isActive ? "text-amber-600" : "text-slate-400")} />
        <h3 className={cn("text-lg font-bold mb-2", isActive ? "text-amber-800" : "text-slate-700")}>{title}</h3>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

export default function SmartRecorderPage() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [recordingStep, setRecordingStep] = useState(0);

  // Auto-cycle through steps
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Auto-cycle recording animation
  useEffect(() => {
    const interval = setInterval(() => {
      setRecordingStep((prev) => (prev + 1) % 5);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const steps = [
    { icon: Play, title: 'Start Recording', description: 'Click record and navigate to your application. The recorder captures every interaction.' },
    { icon: MousePointer, title: 'Interact Naturally', description: 'Click, type, scroll - everything is captured with smart element detection.' },
    { icon: Lightbulb, title: 'Get Suggestions', description: 'Contextual suggestions appear for assertions, waits, and validations.' },
    { icon: CheckCircle2, title: 'Build Your Test', description: 'Stop recording and your test is ready. Edit in Visual Builder if needed.' },
  ];

  const recordingSteps = [
    { action: 'Navigate to', target: 'login.example.com', icon: Globe },
    { action: 'Fill', target: 'username', icon: Type },
    { action: 'Fill', target: 'password', icon: Lock },
    { action: 'Click', target: 'Sign In button', icon: MousePointer },
    { action: 'Assert', target: 'Dashboard visible', icon: Eye },
  ];

  const suggestions = [
    'Assert element visible',
    'Verify text content',
    'Wait for network idle',
    'Take screenshot',
    'Check page title',
    'Validate form state',
  ];

  return (
    <div className="min-h-screen bg-white">
      <MarketingHeader />
      
      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-6">
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Smart Trace</p>
              <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 leading-tight">
                Trace Tests by
                <span className="block text-amber-600">Simply Using Your App</span>
              </h1>
              <p className="text-xl text-slate-600 leading-relaxed">
                No coding required. Just click trace, interact with your application naturally,
                and get a complete automated test with intelligent element detection.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  onClick={() => navigate('/signup')}
                  className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl"
                >
                  Try Smart Trace <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 rounded-xl">
                  <Play className="w-5 h-5 mr-2" /> See It In Action
                </Button>
              </div>
            </div>

            {/* Right - Animated Preview */}
            <div className="relative">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
                {/* Browser Chrome */}
                <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <Badge className="bg-red-100 text-red-600 border-0 animate-pulse">● Recording</Badge>
                  </div>
                </div>

                {/* Recording Content */}
                <div className="p-5">
                  <div className="flex gap-4">
                    {/* Steps List */}
                    <div className="flex-1 space-y-2">
                      <div className="text-sm font-semibold text-slate-700 mb-3">Recorded Steps</div>
                      {recordingSteps.map((step, idx) => (
                        <div 
                          key={idx}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl transition-all duration-500",
                            idx < recordingStep 
                              ? "bg-emerald-50 border border-emerald-200" 
                              : idx === recordingStep 
                                ? "bg-amber-50 border-2 border-amber-400 animate-pulse" 
                                : "bg-slate-50 border border-slate-100 opacity-40"
                          )}
                        >
                          <div className={cn(
                            "w-7 h-7 rounded-lg flex items-center justify-center",
                            idx < recordingStep ? "bg-emerald-500 text-white" :
                            idx === recordingStep ? "bg-amber-500 text-white" :
                            "bg-slate-200 text-slate-400"
                          )}>
                            {idx < recordingStep ? <CheckCircle2 className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                          </div>
                          <div className="flex-1">
                            <span className="text-xs text-slate-500">{step.action}</span>
                            <div className="text-sm text-slate-700 font-medium">{step.target}</div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Suggestions Panel */}
                    <div className="w-48 p-4 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="flex items-center gap-2 mb-3">
                        <Lightbulb className="w-4 h-4 text-amber-500" />
                        <span className="text-xs font-bold text-slate-700">Smart Suggestions</span>
                      </div>
                      <div className="space-y-1.5">
                        {suggestions.slice(0, 5).map((s, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "px-2.5 py-2 bg-white rounded-lg text-xs text-slate-600 border transition-all cursor-pointer",
                              i === recordingStep % 5 
                                ? "border-blue-300 bg-blue-50 shadow-sm" 
                                : "border-slate-100 hover:border-blue-200"
                            )}
                          >
                            + {s}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">How It Works</p>
            <h2 className="text-3xl font-bold text-slate-900">Four Simple Steps</h2>
          </div>
          
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((step, idx) => (
              <HowItWorksStep 
                key={idx}
                step={idx + 1}
                title={step.title}
                description={step.description}
                isActive={activeStep === idx}
                icon={step.icon}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Key Features */}
      <section className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wider mb-4">Key Features</p>
            <h2 className="text-3xl font-bold text-slate-900">What Makes It Smart</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Target, title: 'Intelligent Element Detection', desc: 'Automatically finds the most stable selectors for each element - IDs, data attributes, or smart CSS paths.' },
              { icon: Lightbulb, title: 'Contextual Suggestions', desc: 'Get relevant suggestions based on your current action - assertions for inputs, waits for navigation, etc.' },
              { icon: Clock, title: 'Auto-Wait Handling', desc: 'Smart wait detection ensures your tests handle async operations without manual timeout configuration.' },
              { icon: Database, title: 'Salesforce Context', desc: 'Special panel for Salesforce apps showing org context, available tools, and SF-specific suggestions.' },
              { icon: Shield, title: 'Self-Healing Ready', desc: 'Multiple selector strategies captured means tests can self-heal when UI changes slightly.' },
              { icon: Layers, title: 'Reusable Components', desc: 'Automatically detects repeated patterns and suggests creating reusable test components.' },
            ].map((feature, idx) => (
              <div key={idx} className="p-6 bg-white rounded-2xl border border-slate-200 hover:shadow-lg transition-all">
                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-slate-700" />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-500">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 bg-slate-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Record your first test in under 2 minutes</h2>
          <p className="text-xl text-slate-400 mb-8">No coding required. Free tier with no time limit.</p>
          <Button
            size="lg"
            onClick={() => navigate('/signup')}
            className="h-14 px-10 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-xl"
          >
            Start Free Trial <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="py-8 px-6 bg-slate-900 text-center">
        <p className="text-slate-400 text-sm">© 2024 Flowstral. All rights reserved.</p>
      </footer>
    </div>
  );
}

