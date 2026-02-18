/**
 * MobileTestStudio - Enhanced Maestro Studio Recording Component
 * 
 * Uses individual Zustand selectors to avoid infinite re-render loops.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mobile, isElectron } from '@/lib/electron-bridge';
import { useMobileTestingStore } from '@/modules/mobile-testing/store/mobileTestingStore';
import { toast } from 'sonner';
import {
  Smartphone,
  Play,
  Square,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Terminal,
  FileCode,
  Copy,
  Check,
  Video,
  CircleDot,
  Eye,
  Save,
  Apple,
  Bot,
  Cpu,
  ExternalLink,
  Trash2,
} from 'lucide-react';

export default function MobileTestStudio() {
  const { theme } = useTheme();
  const inElectron = isElectron();
  const outputRef = useRef<HTMLDivElement>(null);

  // Individual selectors — stable references, no infinite re-renders
  const isStudioRunning = useMobileTestingStore(s => s.isStudioRunning);
  const isStartingStudio = useMobileTestingStore(s => s.isStartingStudio);
  const studioOutput = useMobileTestingStore(s => s.studioOutput);
  const selectedPlatform = useMobileTestingStore(s => s.selectedPlatform);
  const selectedDevice = useMobileTestingStore(s => s.selectedDevice);
  const appBundleId = useMobileTestingStore(s => s.appBundleId);
  const nativeDevices = useMobileTestingStore(s => s.nativeDevices);
  const isLoadingDevices = useMobileTestingStore(s => s.isLoadingDevices);
  const maestroInstalled = useMobileTestingStore(s => s.maestroInstalled);
  const isCheckingMaestro = useMobileTestingStore(s => s.isCheckingMaestro);
  const isRunningTest = useMobileTestingStore(s => s.isRunningTest);

  // Actions — functions are stable references in Zustand
  const setStudioRunning = useMobileTestingStore(s => s.setStudioRunning);
  const setStartingStudio = useMobileTestingStore(s => s.setStartingStudio);
  const addStudioOutput = useMobileTestingStore(s => s.addStudioOutput);
  const clearStudioOutput = useMobileTestingStore(s => s.clearStudioOutput);
  const setSelectedPlatform = useMobileTestingStore(s => s.setSelectedPlatform);
  const setSelectedDevice = useMobileTestingStore(s => s.setSelectedDevice);
  const setAppBundleId = useMobileTestingStore(s => s.setAppBundleId);
  const setNativeDevices = useMobileTestingStore(s => s.setNativeDevices);
  const setIsLoadingDevices = useMobileTestingStore(s => s.setIsLoadingDevices);
  const setMaestroInstalled = useMobileTestingStore(s => s.setMaestroInstalled);
  const setIsCheckingMaestro = useMobileTestingStore(s => s.setIsCheckingMaestro);
  const setIsRunningTest = useMobileTestingStore(s => s.setIsRunningTest);
  const createFlow = useMobileTestingStore(s => s.createFlow);
  const addTestRun = useMobileTestingStore(s => s.addTestRun);

  const [yamlFlow, setYamlFlow] = useState(`appId: com.example.app
---
- launchApp
- tapOn: "Login"
- inputText:
    id: "email"
    text: "test@example.com"
- inputText:
    id: "password" 
    text: "password123"
- tapOn: "Submit"
- assertVisible: "Welcome"`);
  const [copiedInstall, setCopiedInstall] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  // Auto-scroll output
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [studioOutput]);

  const checkStudioStatus = useCallback(async () => {
    if (!inElectron) return;
    try {
      const status = await mobile.getStudioStatus();
      setStudioRunning(status?.running || false);
    } catch (error) {
      console.error('Failed to check Studio status:', error);
    }
  }, [inElectron, setStudioRunning]);

  const loadNativeDevices = useCallback(async () => {
    if (!inElectron) return;
    setIsLoadingDevices(true);
    try {
      const devices = await mobile.getNativeDevices(selectedPlatform);
      setNativeDevices(devices || []);
      if (devices && devices.length > 0 && !selectedDevice) {
        setSelectedDevice(devices[0]);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
      setNativeDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  }, [inElectron, selectedPlatform, selectedDevice, setIsLoadingDevices, setNativeDevices, setSelectedDevice]);

  const checkMaestro = useCallback(async () => {
    if (!inElectron) return;
    setIsCheckingMaestro(true);
    try {
      const installed = await mobile.checkMaestro();
      setMaestroInstalled(installed);
      if (installed) loadNativeDevices();
    } catch (error) {
      console.error('Failed to check Maestro:', error);
      setMaestroInstalled(false);
    } finally {
      setIsCheckingMaestro(false);
    }
  }, [inElectron, setIsCheckingMaestro, setMaestroInstalled, loadNativeDevices]);

  // Check Maestro installation on mount
  useEffect(() => {
    checkMaestro();
    checkStudioStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (maestroInstalled) loadNativeDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPlatform, maestroInstalled]);

  // Listen for real-time Studio output from Electron IPC
  useEffect(() => {
    if (!inElectron) return;
    const unsub = mobile.onStudioOutput?.((output: string) => {
      addStudioOutput(output);
    });
    return () => { unsub?.(); };
  }, [inElectron, addStudioOutput]);

  const handleStartStudio = async () => {
    if (!inElectron) {
      toast.error('Native app recording requires the desktop app');
      return;
    }
    setStartingStudio(true);
    addStudioOutput('Starting Maestro Studio...');
    try {
      const result = await mobile.startStudio(selectedDevice || undefined);
      if (result.success) {
        setStudioRunning(true);
        addStudioOutput(`Studio started at ${result.url}`);
        addStudioOutput('Click on your app to record actions');
        toast.success('Maestro Studio is running!');
      } else {
        addStudioOutput(`Failed: ${result.error}`);
        toast.error(result.error || 'Failed to start Studio');
      }
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to start Studio';
      addStudioOutput(`Error: ${errorMsg}`);
      // Detect "not installed" or "ENOENT" errors and update maestroInstalled state
      if (/not installed|ENOENT|not found|not recognized/i.test(errorMsg)) {
        setMaestroInstalled(false);
        toast.error('Maestro CLI is not installed. See instructions below to install it.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setStartingStudio(false);
    }
  };

  const handleStopStudio = async () => {
    try {
      await mobile.stopStudio();
      setStudioRunning(false);
      addStudioOutput('Studio stopped');
      toast.success('Maestro Studio stopped');
    } catch (error: any) {
      toast.error(error.message || 'Failed to stop Studio');
    }
  };

  const handleRunTest = async () => {
    if (!appBundleId) {
      toast.error('Please enter an App Bundle ID');
      return;
    }
    setIsRunningTest(true);
    clearStudioOutput();
    addStudioOutput('Starting native app test...');

    const startTime = Date.now();
    try {
      const steps = yamlFlow.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => ({ action: line.trim().substring(2) }));

      addStudioOutput(`Running ${steps.length} test steps on ${selectedPlatform}...`);

      const result = await mobile.runNativeTest(steps, appBundleId, selectedPlatform, selectedDevice);
      const duration = Date.now() - startTime;
      const passed = result.success;

      addStudioOutput(passed ? 'Test completed successfully!' : `Test failed: ${result.error}`);
      toast[passed ? 'success' : 'error'](passed ? 'Native app test completed!' : (result.error || 'Test failed'));

      addTestRun({
        flow_id: 'manual',
        flow_name: 'Manual Run',
        platform: selectedPlatform,
        device: selectedDevice || 'default',
        app_bundle_id: appBundleId,
        status: passed ? 'passed' : 'failed',
        duration_ms: duration,
        steps_total: steps.length,
        steps_passed: passed ? steps.length : 0,
        steps_failed: passed ? 0 : steps.length,
        output: [passed ? 'Test completed successfully!' : `Test failed: ${result.error}`],
        screenshots: [],
        error_message: passed ? null : (result.error || 'Unknown error'),
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
      });
    } catch (error: any) {
      addStudioOutput(`Error: ${error.message}`);
      toast.error(error.message || 'Test failed');
    } finally {
      setIsRunningTest(false);
    }
  };

  const handleSaveFlow = () => {
    if (!saveName.trim()) {
      toast.error('Please enter a name for the flow');
      return;
    }
    createFlow({
      name: saveName.trim(),
      description: '',
      folder_id: null,
      yaml: yamlFlow,
      app_bundle_id: appBundleId,
      platform: selectedPlatform,
      tags: [],
      priority: 'medium',
    });
    toast.success(`Flow "${saveName}" saved!`);
    setShowSaveDialog(false);
    setSaveName('');
  };

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('curl -Ls "https://get.maestro.mobile.dev" | bash');
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  const isDark = theme !== 'light';

  return (
    <div className="space-y-6">
      {/* Recording Hero Section */}
      <div className={cn(
        "rounded-xl border p-6",
        isStudioRunning
          ? isDark
            ? "bg-red-900/20 border-red-500/50"
            : "bg-red-50 border-red-300"
          : isDark
            ? "bg-muted border-border"
            : "bg-muted/50 border-border"
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center",
              isStudioRunning ? "bg-red-500 animate-pulse" : "bg-primary"
            )}>
              {isStudioRunning ? <CircleDot className="w-7 h-7 text-white" /> : <Video className="w-7 h-7 text-white" />}
            </div>
            <div>
              <h2 className={cn("text-xl font-bold", isDark ? 'text-white' : 'text-gray-900')}>
                {isStudioRunning ? 'Recording Native App' : 'Record Native App Actions'}
              </h2>
              <p className={cn("text-sm", isDark ? 'text-gray-400' : 'text-gray-600')}>
                {isStudioRunning
                  ? 'Maestro Studio is running - interact with your app to record actions'
                  : 'Start Maestro Studio to record interactions on iOS/Android apps'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isStudioRunning ? (
              <>
                <Button variant="outline" onClick={() => window.open('http://localhost:9999', '_blank')}
                  className={cn(isDark ? "border-gray-600 text-gray-300" : "border-gray-300 text-gray-700")}>
                  <Eye className="w-4 h-4 mr-2" /> Open Studio UI
                </Button>
                <Button variant="destructive" onClick={handleStopStudio}>
                  <Square className="w-4 h-4 mr-2" /> Stop Recording
                </Button>
              </>
            ) : (
              <Button onClick={handleStartStudio} disabled={!maestroInstalled || isStartingStudio}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6" size="lg">
                {isStartingStudio
                  ? <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Starting...</>
                  : <><CircleDot className="w-5 h-5 mr-2" /> Start Recording</>}
              </Button>
            )}
          </div>
        </div>

        {isStudioRunning && (
          <div className={cn("mt-4 p-3 rounded-lg", isDark ? 'bg-gray-900/50' : 'bg-white/80')}>
            <p className={cn("text-sm", isDark ? 'text-gray-300' : 'text-gray-700')}>
              <strong>How to use:</strong> The Maestro Studio web UI has opened in your browser.
              Click on elements in your running app to record tap, swipe, and input actions.
            </p>
          </div>
        )}

        {!maestroInstalled && maestroInstalled !== null && (
          <div className={cn("mt-4 p-3 rounded-lg", isDark ? 'bg-amber-500/10' : 'bg-amber-50')}>
            <p className={cn("text-sm", isDark ? 'text-amber-400' : 'text-amber-700')}>
              Install Maestro first to enable native app recording. See setup below.
            </p>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left Column: Setup & Config */}
        <div className="space-y-6">
          {/* Maestro Status */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                <Terminal className="w-4 h-4" /> Maestro Status
              </h3>
              <Button variant="ghost" size="sm" onClick={checkMaestro} disabled={isCheckingMaestro} className="h-7 text-xs">
                {isCheckingMaestro ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
              </Button>
            </div>

            {maestroInstalled === null ? (
              <div className={cn("p-4 rounded-lg flex items-center gap-3", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className={cn("text-sm", isDark ? 'text-gray-400' : 'text-gray-600')}>Checking Maestro...</span>
              </div>
            ) : maestroInstalled ? (
              <div className={cn("p-4 rounded-lg", isDark ? 'bg-emerald-500/10' : 'bg-emerald-50')}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className={cn("font-medium", isDark ? 'text-emerald-400' : 'text-emerald-800')}>Maestro Installed</span>
                </div>
                <p className={cn("text-xs", isDark ? 'text-emerald-400/80' : 'text-emerald-600')}>
                  Ready to run native app tests.
                </p>
              </div>
            ) : (
              <div className={cn("p-4 rounded-lg", isDark ? 'bg-amber-500/10' : 'bg-amber-50')}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className={cn("font-medium", isDark ? 'text-amber-400' : 'text-amber-800')}>Maestro Not Installed</span>
                </div>
                <div className="flex gap-2">
                  <code className={cn("flex-1 p-2 rounded text-xs font-mono", isDark ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-900')}>
                    curl -Ls "https://get.maestro.mobile.dev" | bash
                  </code>
                  <Button size="sm" variant="outline" onClick={copyInstallCommand} className="h-8">
                    {copiedInstall ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Platform & Device Selection */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <h3 className={cn("text-sm font-semibold mb-4 flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Cpu className="w-4 h-4" /> Platform & Device
            </h3>

            <div className="flex gap-2 mb-4">
              <Button variant={selectedPlatform === 'ios' ? 'default' : 'outline'} onClick={() => setSelectedPlatform('ios')}
                className="flex-1">
                <Apple className="w-4 h-4 mr-2" /> iOS Simulator
              </Button>
              <Button variant={selectedPlatform === 'android' ? 'default' : 'outline'} onClick={() => setSelectedPlatform('android')}
                className="flex-1">
                <Bot className="w-4 h-4 mr-2" /> Android Emulator
              </Button>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className={cn("text-xs font-medium", isDark ? 'text-gray-400' : 'text-gray-600')}>Available Devices</label>
                <Button variant="ghost" size="sm" onClick={loadNativeDevices} disabled={isLoadingDevices} className="h-6 text-xs">
                  <RotateCcw className={cn("w-3 h-3", isLoadingDevices && "animate-spin")} />
                </Button>
              </div>
              {isLoadingDevices ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm text-muted-foreground">Loading devices...</span>
                </div>
              ) : nativeDevices.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {nativeDevices.map((device, idx) => (
                    <button key={idx} onClick={() => setSelectedDevice(device)}
                      className={cn("w-full p-2 rounded-lg text-left text-sm transition-all",
                        selectedDevice === device
                          ? "bg-primary/20 text-primary border border-primary/50"
                          : isDark ? "bg-gray-800 text-gray-300 hover:bg-gray-700" : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                      )}>
                      <Smartphone className="w-3.5 h-3.5 inline mr-2" />{device}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={cn("p-3 rounded-lg text-center text-sm", isDark ? 'bg-gray-800 text-gray-400' : 'bg-gray-50 text-gray-500')}>
                  {maestroInstalled ? `No ${selectedPlatform === 'ios' ? 'iOS simulators' : 'Android emulators'} found.` : 'Install Maestro to detect devices'}
                </div>
              )}
            </div>

            <div>
              <label className={cn("text-xs font-medium mb-2 block", isDark ? 'text-gray-400' : 'text-gray-600')}>App Bundle ID</label>
              <Input value={appBundleId} onChange={(e) => setAppBundleId(e.target.value)}
                placeholder={selectedPlatform === 'ios' ? 'com.apple.mobilesafari' : 'com.android.chrome'}
                className={cn(isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")} />
            </div>
          </div>
        </div>

        {/* Right Column: Editor & Output */}
        <div className="space-y-6">
          {/* YAML Flow Editor */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                <FileCode className="w-4 h-4" /> Maestro Flow (YAML)
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(!showSaveDialog)} className="h-7 text-xs">
                  <Save className="w-3 h-3 mr-1" /> Save Flow
                </Button>
                <a href="https://maestro.mobile.dev/reference/commands" target="_blank" rel="noopener noreferrer"
                  className={cn("text-xs flex items-center gap-1", isDark ? 'text-primary' : 'text-primary')}>
                  Docs <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {showSaveDialog && (
              <div className={cn("mb-4 p-3 rounded-lg flex gap-2", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                <Input value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="Flow name..." className="flex-1 h-8 text-sm"
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveFlow()} />
                <Button size="sm" onClick={handleSaveFlow} className="h-8"><Save className="w-3 h-3 mr-1" /> Save</Button>
              </div>
            )}

            <Textarea value={yamlFlow} onChange={(e) => setYamlFlow(e.target.value)} rows={14}
              className={cn("font-mono text-xs", isDark ? "bg-gray-950 border-gray-700" : "bg-gray-50 border-gray-200")} />

            <div className="flex gap-2 mt-4">
              <Button onClick={handleRunTest} disabled={!maestroInstalled || isRunningTest || !appBundleId}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground">
                {isRunningTest ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</> : <><Play className="w-4 h-4 mr-2" /> Run Test</>}
              </Button>
              {isRunningTest && (
                <Button variant="destructive" onClick={() => setIsRunningTest(false)}><Square className="w-4 h-4" /></Button>
              )}
            </div>
          </div>

          {/* Output Console */}
          <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
                <Terminal className="w-4 h-4" /> Output Console
              </h3>
              <Button variant="ghost" size="sm" onClick={clearStudioOutput} className="h-7 text-xs">
                <Trash2 className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>

            <div ref={outputRef} className={cn("rounded-lg p-3 font-mono text-xs h-48 overflow-y-auto", isDark ? 'bg-gray-950 text-gray-100' : 'bg-gray-100 text-gray-900')}>
              {studioOutput.length === 0 ? (
                <span className="text-gray-500">Run a test or start recording to see output...</span>
              ) : (
                studioOutput.map((line, idx) => (
                  <div key={idx} className="mb-1">
                    <span className="text-gray-500 mr-2">[{String(idx + 1).padStart(3, '0')}]</span>
                    {line.toLowerCase().includes('success') || line.toLowerCase().includes('passed') ? (
                      <span className="text-emerald-400">{line}</span>
                    ) : line.toLowerCase().includes('fail') || line.toLowerCase().includes('error') ? (
                      <span className="text-red-400">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Commands Reference */}
      <div className={cn("rounded-xl border p-5", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
        <h3 className={cn("text-sm font-semibold mb-3", isDark ? 'text-white' : 'text-gray-900')}>Quick Maestro Commands Reference</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          {[
            { cmd: 'launchApp', desc: 'Launch the app' },
            { cmd: 'tapOn: "text"', desc: 'Tap on element' },
            { cmd: 'inputText:', desc: 'Enter text in field' },
            { cmd: 'assertVisible:', desc: 'Assert element visible' },
            { cmd: 'assertNotVisible:', desc: 'Assert not visible' },
            { cmd: 'scroll', desc: 'Scroll screen' },
            { cmd: 'swipe:', desc: 'Swipe gesture' },
            { cmd: 'waitForAnimationToEnd', desc: 'Wait for anim' },
            { cmd: 'takeScreenshot', desc: 'Capture screenshot' },
            { cmd: 'back', desc: 'Press back button' },
            { cmd: 'hideKeyboard', desc: 'Dismiss keyboard' },
            { cmd: 'clearState:', desc: 'Clear app data' },
            { cmd: 'openLink:', desc: 'Open deep link' },
            { cmd: 'pressKey: Home', desc: 'Press home' },
            { cmd: 'eraseText: 5', desc: 'Delete characters' },
            { cmd: 'repeat:', desc: 'Loop actions' },
          ].map((item, idx) => (
            <div key={idx} className={cn("p-2 rounded", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
              <code className={cn("font-mono text-[11px]", isDark ? 'text-primary' : 'text-primary')}>{item.cmd}</code>
              <p className={cn("text-[10px] mt-0.5", isDark ? 'text-gray-400' : 'text-gray-500')}>{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
