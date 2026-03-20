/**
 * FlowpilotPage — Thin orchestrator with top tabs.
 *
 * Three tabs: Generator (split-pane), Explorer (full-width), Flowmap (full-width).
 * Self-Healer is integrated into Generator as "Re-run with Fix" on failed tests.
 */

import React from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAI } from '@/contexts/AIContext';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Compass, Brain, FlaskConical, Search, Map, AlertCircle } from 'lucide-react';
import { GeneratorTab } from '../components/flowpilot/GeneratorTab';
import { ExplorerTab } from '../components/flowpilot/ExplorerTab';
import { FlowmapTab } from '../components/flowpilot/FlowmapTab';

function resolveDefaultTab(pathname: string): string {
  if (pathname.includes('/explorer')) return 'explorer';
  if (pathname.includes('/flowmap')) return 'flowmap';
  return 'generator';
}

export default function FlowpilotPage() {
  const { theme } = useTheme();
  const { config: aiConfig } = useAI();
  const aiAvailable = aiConfig.enabled && aiConfig.hasApiKey;
  const location = useLocation();
  const defaultTab = resolveDefaultTab(location.pathname);

  return (
    <div className={cn("min-h-screen p-6", theme === 'light' ? 'bg-gray-50' : 'bg-gray-950')}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 flex items-center justify-center">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className={cn("text-2xl font-bold", theme === 'light' ? 'text-gray-900' : 'text-white')}>
              Flowpilot
            </h1>
            <p className={cn("text-sm", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
              AI-powered testing agents -- real browser automation, real defect detection
            </p>
          </div>
          <Badge className="ml-auto bg-gradient-to-r from-fuchsia-500 to-pink-500 text-white border-0">
            <Brain className="w-3 h-3 mr-1" /> Live AI
          </Badge>
        </div>

        {!aiAvailable && (
          <div className={cn(
            "mt-3 px-4 py-2 rounded-lg border text-sm flex items-center gap-2",
            theme === 'light' ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-amber-500/10 border-amber-500/30 text-amber-400"
          )}>
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>
              Configure AI in{' '}
              <a href="/settings?tab=ai" className="underline font-medium hover:opacity-80">Settings</a>
              {' '}to enable Generator. Explorer and Flowmap work without AI.
            </span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className={cn(
          "mb-6",
          theme === 'light' ? 'bg-gray-100' : 'bg-gray-900'
        )}>
          <TabsTrigger value="generator" className="gap-1.5">
            <FlaskConical className="w-4 h-4" /> Generator
          </TabsTrigger>
          <TabsTrigger value="explorer" className="gap-1.5">
            <Search className="w-4 h-4" /> Explorer
          </TabsTrigger>
          <TabsTrigger value="flowmap" className="gap-1.5">
            <Map className="w-4 h-4" /> Flowmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generator" className="mt-0">
          <GeneratorTab aiAvailable={aiAvailable} theme={theme} />
        </TabsContent>

        <TabsContent value="explorer" className="mt-0">
          <ExplorerTab aiAvailable={aiAvailable} theme={theme} />
        </TabsContent>

        <TabsContent value="flowmap" className="mt-0">
          <FlowmapTab aiAvailable={aiAvailable} theme={theme} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
