/**
 * AITestingPage - The World's Simplest AI Testing Interface
 * 
 * Revolutionary approach: Just describe what you want to test.
 * No recording, no scripting, no configuration.
 * AI handles everything from understanding to execution.
 * 
 * @version 1.0.0
 */

import React from 'react';
import { AIChatTesting } from '@/components/AIChatTesting';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Sparkles, 
  Wand2, 
  Bot, 
  Eye, 
  FileSearch,
  Zap
} from 'lucide-react';

export function AITestingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-2">AI Testing</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Describe what you want to test in plain English. 
            AI will explore, understand, plan, and execute comprehensive tests automatically.
          </p>
        </div>

        {/* How It Works - Simple Row */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="text-center p-4 bg-card/50">
            <Wand2 className="w-6 h-6 mx-auto mb-2 text-violet-500" />
            <p className="font-medium text-sm">Describe</p>
            <p className="text-xs text-muted-foreground">Tell AI what to test</p>
          </Card>
          <Card className="text-center p-4 bg-card/50">
            <Eye className="w-6 h-6 mx-auto mb-2 text-blue-500" />
            <p className="font-medium text-sm">Explore</p>
            <p className="text-xs text-muted-foreground">AI navigates your app</p>
          </Card>
          <Card className="text-center p-4 bg-card/50">
            <Bot className="w-6 h-6 mx-auto mb-2 text-green-500" />
            <p className="font-medium text-sm">Test</p>
            <p className="text-xs text-muted-foreground">Executes smart tests</p>
          </Card>
          <Card className="text-center p-4 bg-card/50">
            <FileSearch className="w-6 h-6 mx-auto mb-2 text-orange-500" />
            <p className="font-medium text-sm">Report</p>
            <p className="text-xs text-muted-foreground">Detailed results</p>
          </Card>
        </div>

        {/* Main Component */}
        <AIChatTesting />

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-4 py-2 rounded-full">
            <Zap className="w-4 h-4 text-yellow-500" />
            Powered by AI vision + intelligent test generation
          </div>
        </div>
      </div>
    </div>
  );
}

export default AITestingPage;
