/**
 * MobileTestingPage - Full Mobile App Testing Suite
 * 
 * A comprehensive mobile testing hub with 6 integrated sub-modules:
 * 
 * 1. TEST STUDIO - Maestro Studio recording, YAML editor, run tests
 * 2. TEST FLOWS - Saved test flow management (CRUD, folders, import/export)
 * 3. DEVICE LAB - Device management, app install, screenshots, logs
 * 4. TEST RUNS - Execution history, reports, pass/fail analytics
 * 5. INSPECTOR - Element hierarchy viewer & selector generator
 * 6. ADVANCED TOOLS - Deep links, push notifications, biometrics, network, geolocation
 */

import React, { useMemo, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useMobileTestingStore, computeTestRunStats } from '@/stores/mobileTestingStore';
import { shallow } from 'zustand/shallow';
import type { MobileTab } from '@/stores/mobileTestingStore';
import {
  MobileTestStudio,
  MobileTestFlows,
  MobileDeviceLab,
  MobileTestRuns,
  MobileInspector,
  MobileAdvancedTools,
} from '@/components/mobile-testing';
import {
  MonitorSmartphone,
  Video,
  FileCode,
  Smartphone,
  Activity,
  Layers,
  Wrench,
  CheckCircle2,
  XCircle,
  CircleDot,
} from 'lucide-react';

interface TabConfig {
  id: MobileTab;
  label: string;
  icon: React.FC<any>;
  description: string;
}

export default function MobileTestingPage() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Use individual selectors — NEVER destructure the whole store
  const activeTab = useMobileTestingStore(s => s.activeTab);
  const setActiveTab = useMobileTestingStore(s => s.setActiveTab);
  const isStudioRunning = useMobileTestingStore(s => s.isStudioRunning);
  const isRunningTest = useMobileTestingStore(s => s.isRunningTest);
  const flowsCount = useMobileTestingStore(s => s.flows.length);
  const testRuns = useMobileTestingStore(s => s.testRuns);

  // Compute stats with useMemo to avoid creating new objects on every render
  const stats = useMemo(() => computeTestRunStats(testRuns), [testRuns]);

  const tabs: TabConfig[] = useMemo(() => [
    { id: 'studio' as const, label: 'Test Studio', icon: Video, description: 'Record & run native app tests' },
    { id: 'flows' as const, label: 'Test Flows', icon: FileCode, description: 'Manage saved test flows' },
    { id: 'device-lab' as const, label: 'Device Lab', icon: Smartphone, description: 'Manage devices & apps' },
    { id: 'runs' as const, label: 'Test Runs', icon: Activity, description: 'Execution history & reports' },
    { id: 'inspector' as const, label: 'Inspector', icon: Layers, description: 'Element hierarchy & selectors' },
    { id: 'tools' as const, label: 'Advanced Tools', icon: Wrench, description: 'Deep links, notifications & more' },
  ], []);

  const renderBadge = useCallback((tabId: MobileTab) => {
    switch (tabId) {
      case 'studio':
        if (isStudioRunning) return <Badge className="text-[9px] h-4 bg-red-500 text-white animate-pulse ml-1">REC</Badge>;
        if (isRunningTest) return <Badge className="text-[9px] h-4 bg-sky-500 text-white ml-1">Running</Badge>;
        return null;
      case 'flows':
        return flowsCount > 0 ? <Badge variant="outline" className="text-[9px] h-4 ml-1">{flowsCount}</Badge> : null;
      case 'runs':
        if (testRuns.length > 0) {
          return (
            <span className="flex items-center gap-1 ml-1.5">
              {stats.passed > 0 && <span className="flex items-center text-emerald-500 text-[10px]"><CheckCircle2 className="w-3 h-3 mr-0.5" />{stats.passed}</span>}
              {stats.failed > 0 && <span className="flex items-center text-red-500 text-[10px]"><XCircle className="w-3 h-3 mr-0.5" />{stats.failed}</span>}
            </span>
          );
        }
        return null;
      default:
        return null;
    }
  }, [isStudioRunning, isRunningTest, flowsCount, testRuns.length, stats.passed, stats.failed]);

  const renderTabContent = useCallback(() => {
    switch (activeTab) {
      case 'studio': return <MobileTestStudio />;
      case 'flows': return <MobileTestFlows />;
      case 'device-lab': return <MobileDeviceLab />;
      case 'runs': return <MobileTestRuns />;
      case 'inspector': return <MobileInspector />;
      case 'tools': return <MobileAdvancedTools />;
      default: return <MobileTestStudio />;
    }
  }, [activeTab]);

  return (
    <div className={cn("min-h-screen", isDark ? 'bg-gray-950' : 'bg-gray-50')}>
      {/* Header */}
      <div className={cn(
        "border-b px-6 py-4",
        isDark ? 'bg-gray-900/50 border-gray-800' : 'bg-white border-gray-200'
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br from-violet-500 to-purple-600">
              <MonitorSmartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className={cn("text-xl font-bold", isDark ? 'text-white' : 'text-gray-900')}>
                Mobile App Testing
              </h1>
              <p className={cn("text-xs", isDark ? 'text-gray-400' : 'text-gray-500')}>
                Full native app testing suite — iOS & Android with Maestro
              </p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4">
            {isStudioRunning && (
              <div className="flex items-center gap-2">
                <CircleDot className="w-4 h-4 text-red-500 animate-pulse" />
                <span className={cn("text-xs font-medium", isDark ? 'text-red-400' : 'text-red-500')}>Studio Recording</span>
              </div>
            )}
            {testRuns.length > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className={cn("font-medium", isDark ? 'text-gray-400' : 'text-gray-500')}>
                  {stats.total} runs
                </span>
                <span className="text-emerald-500 font-medium">{stats.passRate}% pass rate</span>
              </div>
            )}
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 mt-4 -mb-4 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all relative",
                  "border-b-2 -mb-[1px]",
                  isActive
                    ? isDark
                      ? "text-violet-400 border-violet-400"
                      : "text-violet-600 border-violet-600"
                    : isDark
                      ? "text-gray-400 border-transparent hover:text-gray-300 hover:border-gray-700"
                      : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                )}
                title={tab.description}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {renderBadge(tab.id)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {renderTabContent()}
      </div>
    </div>
  );
}
