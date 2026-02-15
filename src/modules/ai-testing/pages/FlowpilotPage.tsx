/**
 * FlowpilotPage - Goal-Based Agentic Testing Interface
 * 
 * Flowpilot agents:
 * - Flowmap: Journey discovery and path visualization
 * - Explorer: Autonomous AI exploration
 * - Self-Healer: Auto-repair broken locators
 * - Generator: NLP-based test generation
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Compass,
  Map,
  RefreshCw,
  Sparkles,
  Target,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Zap,
  Brain,
  Eye,
  Wand2,
  Settings,
  ChevronRight,
  Code,
} from 'lucide-react';

// Agent definitions
const agents = [
  {
    id: 'flowmap',
    name: 'Flowmap',
    icon: Map,
    description: 'Visualize and explore all possible user journeys',
    features: ['Journey Discovery', 'Path Visualization', 'Coverage Gaps'],
    color: 'fuchsia',
  },
  {
    id: 'explorer',
    name: 'Explorer',
    icon: Compass,
    description: 'AI-powered autonomous exploration of your app',
    features: ['Auto-Exploration', 'Bug Detection', 'Edge Cases'],
    color: 'violet',
  },
  {
    id: 'self-healer',
    name: 'Self-Healer',
    icon: RefreshCw,
    description: 'Automatic locator repair when elements change',
    features: ['Auto-Repair', 'Smart Locators', 'Zero Flakes'],
    color: 'emerald',
  },
  {
    id: 'generator',
    name: 'Generator',
    icon: Sparkles,
    description: 'Generate tests from natural language goals',
    features: ['NLP Input', 'Test Generation', 'Goal-to-Test'],
    color: 'amber',
  },
];

export default function FlowpilotPage() {
  const { theme } = useTheme();
  const [selectedAgent, setSelectedAgent] = useState(agents[3]); // Start with Generator
  const [goal, setGoal] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [generatedSteps, setGeneratedSteps] = useState<string[]>([]);
  const [processingStage, setProcessingStage] = useState<string>('');

  const colorMap = {
    fuchsia: {
      bg: theme === 'light' ? 'bg-fuchsia-100' : 'bg-fuchsia-500/20',
      text: theme === 'light' ? 'text-fuchsia-700' : 'text-fuchsia-400',
      border: theme === 'light' ? 'border-fuchsia-300' : 'border-fuchsia-500',
      gradient: 'from-fuchsia-500 to-pink-500',
    },
    violet: {
      bg: theme === 'light' ? 'bg-violet-100' : 'bg-violet-500/20',
      text: theme === 'light' ? 'text-violet-700' : 'text-violet-400',
      border: theme === 'light' ? 'border-violet-300' : 'border-violet-500',
      gradient: 'from-violet-500 to-purple-500',
    },
    emerald: {
      bg: theme === 'light' ? 'bg-emerald-100' : 'bg-emerald-500/20',
      text: theme === 'light' ? 'text-emerald-700' : 'text-emerald-400',
      border: theme === 'light' ? 'border-emerald-300' : 'border-emerald-500',
      gradient: 'from-emerald-500 to-teal-500',
    },
    amber: {
      bg: theme === 'light' ? 'bg-amber-100' : 'bg-amber-500/20',
      text: theme === 'light' ? 'text-amber-700' : 'text-amber-400',
      border: theme === 'light' ? 'border-amber-300' : 'border-amber-500',
      gradient: 'from-amber-500 to-orange-500',
    },
  };

  const handleExecuteGoal = async () => {
    if (!goal.trim()) return;
    
    setIsProcessing(true);
    setGeneratedSteps([]);
    
    // Simulate AI processing stages
    const stages = [
      'Analyzing goal...',
      'Scanning target page...',
      'Identifying elements...',
      'Planning actions...',
      'Generating test steps...',
      'Optimizing locators...',
    ];
    
    for (let i = 0; i < stages.length; i++) {
      setProcessingStage(stages[i]);
      await new Promise(r => setTimeout(r, 800));
    }
    
    // Simulate generated steps based on goal
    const steps = generateStepsFromGoal(goal);
    setGeneratedSteps(steps);
    setIsProcessing(false);
    setProcessingStage('');
  };

  const generateStepsFromGoal = (goal: string): string[] => {
    // Simple heuristic-based step generation for demo
    const lowerGoal = goal.toLowerCase();
    const steps: string[] = [];
    
    if (lowerGoal.includes('login') || lowerGoal.includes('sign in')) {
      steps.push('Navigate to login page');
      steps.push('Fill username field');
      steps.push('Fill password field');
      steps.push('Click "Sign In" button');
      if (lowerGoal.includes('invalid') || lowerGoal.includes('wrong')) {
        steps.push('Assert error message is displayed');
      } else {
        steps.push('Assert successful redirect to dashboard');
      }
    } else if (lowerGoal.includes('checkout') || lowerGoal.includes('cart')) {
      steps.push('Navigate to product page');
      steps.push('Add item to cart');
      steps.push('Click cart icon');
      steps.push('Click "Checkout" button');
      steps.push('Fill shipping information');
      steps.push('Select payment method');
      steps.push('Assert order confirmation');
    } else if (lowerGoal.includes('search')) {
      steps.push('Locate search input');
      steps.push('Enter search query');
      steps.push('Click search button or press Enter');
      steps.push('Wait for results to load');
      steps.push('Assert search results are displayed');
    } else {
      // Generic steps
      steps.push(`Navigate to target URL`);
      steps.push(`Analyze page for relevant elements`);
      steps.push(`Execute action: ${goal}`);
      steps.push(`Verify expected outcome`);
    }
    
    return steps;
  };

  return (
    <div className={cn(
      "min-h-screen p-6",
      theme === 'light' ? 'bg-gray-50' : 'bg-gray-950'
    )}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={cn(
              "text-2xl font-bold",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              Flowpilot
            </h1>
            <p className={cn(
              "text-sm",
              theme === 'light' ? 'text-gray-500' : 'text-gray-400'
            )}>
              Goal-based agentic testing powered by AI
            </p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0">
            <Brain className="w-3 h-3 mr-1" /> AI-Powered
          </Badge>
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Agent Selection */}
        <div className="space-y-3">
          <h3 className={cn(
            "text-sm font-semibold",
            theme === 'light' ? 'text-gray-900' : 'text-white'
          )}>
            Select Agent
          </h3>
          {agents.map((agent) => {
            const Icon = agent.icon;
            const colors = colorMap[agent.color as keyof typeof colorMap];
            const isSelected = selectedAgent.id === agent.id;
            
            return (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent)}
                className={cn(
                  "w-full p-4 rounded-xl border text-left transition-all",
                  isSelected
                    ? cn(colors.bg, colors.border, "border-2")
                    : theme === 'light'
                      ? "bg-white border-gray-200 hover:border-gray-300"
                      : "bg-gray-900 border-gray-800 hover:border-gray-700"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    isSelected
                      ? `bg-gradient-to-r ${colors.gradient}`
                      : theme === 'light' ? 'bg-gray-100' : 'bg-gray-800'
                  )}>
                    <Icon className={cn(
                      "w-5 h-5",
                      isSelected ? "text-white" : theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    )} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-semibold",
                      isSelected ? colors.text : theme === 'light' ? 'text-gray-900' : 'text-white'
                    )}>
                      {agent.name}
                    </div>
                    <div className={cn(
                      "text-xs truncate",
                      theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                    )}>
                      {agent.description}
                    </div>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className={cn("w-5 h-5 flex-shrink-0", colors.text)} />
                  )}
                </div>
                
                {isSelected && (
                  <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-current/10">
                    {agent.features.map((feature) => (
                      <Badge
                        key={feature}
                        className={cn("text-[10px]", colors.bg, colors.text, "border-0")}
                      >
                        {feature}
                      </Badge>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {/* Goal Input */}
          <div className={cn(
            "rounded-xl border p-6",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center gap-2 mb-4">
              <Target className={cn(
                "w-5 h-5",
                colorMap[selectedAgent.color as keyof typeof colorMap].text
              )} />
              <h3 className={cn(
                "font-semibold",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                Define Your Goal
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className={cn(
                  "text-sm font-medium mb-2 block",
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                )}>
                  Target URL
                </label>
                <Input
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://example.com"
                  className={cn(
                    theme === 'light'
                      ? "bg-white border-gray-200"
                      : "bg-gray-800 border-gray-700"
                  )}
                />
              </div>
              
              <div>
                <label className={cn(
                  "text-sm font-medium mb-2 block",
                  theme === 'light' ? 'text-gray-700' : 'text-gray-300'
                )}>
                  Test Goal (Natural Language)
                </label>
                <Textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  placeholder="Describe what you want to test in plain English...
Example: 'Test login with invalid credentials and verify error message'"
                  rows={4}
                  className={cn(
                    theme === 'light'
                      ? "bg-white border-gray-200"
                      : "bg-gray-800 border-gray-700"
                  )}
                />
              </div>
              
              <div className="flex gap-3">
                <Button
                  onClick={handleExecuteGoal}
                  disabled={!goal.trim() || isProcessing}
                  className={cn(
                    "flex-1",
                    `bg-gradient-to-r ${colorMap[selectedAgent.color as keyof typeof colorMap].gradient}`,
                    "hover:opacity-90 text-white"
                  )}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Processing...
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-4 h-4 mr-2" /> Execute with {selectedAgent.name}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <Settings className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Processing Status */}
          {isProcessing && (
            <div className={cn(
              "rounded-xl border p-6",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center gap-3 mb-4">
                <div className={cn(
                  "w-10 h-10 rounded-lg flex items-center justify-center animate-pulse",
                  `bg-gradient-to-r ${colorMap[selectedAgent.color as keyof typeof colorMap].gradient}`
                )}>
                  <Brain className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className={cn(
                    "font-semibold",
                    theme === 'light' ? 'text-gray-900' : 'text-white'
                  )}>
                    {selectedAgent.name} is Working...
                  </h3>
                  <p className={cn(
                    "text-sm",
                    colorMap[selectedAgent.color as keyof typeof colorMap].text
                  )}>
                    {processingStage}
                  </p>
                </div>
              </div>
              
              {/* Progress indicators */}
              <div className="space-y-2">
                {['Analyzing', 'Scanning', 'Planning', 'Generating'].map((stage, idx) => (
                  <div key={stage} className="flex items-center gap-2">
                    <div className={cn(
                      "w-5 h-5 rounded-full flex items-center justify-center",
                      idx <= 2
                        ? `bg-gradient-to-r ${colorMap[selectedAgent.color as keyof typeof colorMap].gradient}`
                        : theme === 'light' ? 'bg-gray-200' : 'bg-gray-700'
                    )}>
                      {idx <= 2 ? (
                        <CheckCircle2 className="w-3 h-3 text-white" />
                      ) : (
                        <Loader2 className={cn(
                          "w-3 h-3 animate-spin",
                          theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                        )} />
                      )}
                    </div>
                    <span className={cn(
                      "text-sm",
                      idx <= 2
                        ? theme === 'light' ? 'text-gray-900' : 'text-white'
                        : theme === 'light' ? 'text-gray-400' : 'text-gray-500'
                    )}>
                      {stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Generated Steps */}
          {generatedSteps.length > 0 && !isProcessing && (
            <div className={cn(
              "rounded-xl border p-6",
              theme === 'light'
                ? "bg-white border-gray-200"
                : "bg-gray-900 border-gray-800"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Code className={cn(
                    "w-5 h-5",
                    colorMap[selectedAgent.color as keyof typeof colorMap].text
                  )} />
                  <h3 className={cn(
                    "font-semibold",
                    theme === 'light' ? 'text-gray-900' : 'text-white'
                  )}>
                    Generated Test Steps
                  </h3>
                  <Badge className={cn(
                    colorMap[selectedAgent.color as keyof typeof colorMap].bg,
                    colorMap[selectedAgent.color as keyof typeof colorMap].text,
                    "border-0"
                  )}>
                    {generatedSteps.length} steps
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className={cn(
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <Play className="w-3 h-3 mr-1" /> Run Test
                </Button>
              </div>
              
              <div className={cn(
                "rounded-lg p-4 font-mono text-sm space-y-2",
                theme === 'light' ? 'bg-gray-900 text-gray-100' : 'bg-gray-950 text-gray-100'
              )}>
                {generatedSteps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <span className="text-gray-500 w-6 text-right">{idx + 1}.</span>
                    <span className="text-emerald-400">{step}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex gap-2 mt-4">
                <Button
                  className={cn(
                    `bg-gradient-to-r ${colorMap[selectedAgent.color as keyof typeof colorMap].gradient}`,
                    "hover:opacity-90 text-white"
                  )}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Save as Test Case
                </Button>
                <Button
                  variant="outline"
                  className={cn(
                    theme === 'light'
                      ? "border-gray-200 hover:bg-gray-100"
                      : "border-gray-700 hover:bg-gray-800"
                  )}
                >
                  <RefreshCw className="w-4 h-4 mr-2" /> Regenerate
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
