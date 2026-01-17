/**
 * MobileTestingPage - Native App Testing with Maestro
 * 
 * This page is focused on NATIVE APP testing:
 * - iOS Simulator testing
 * - Android Emulator testing
 * - Maestro integration for native app automation
 * 
 * For Mobile WEB testing, use the Record tab with device selection.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { mobile, isElectron } from '@/lib/electron-bridge';
import { toast } from 'sonner';
import {
  Smartphone,
  Play,
  Square,
  RotateCcw,
  Zap,
  Globe,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  MonitorSmartphone,
  Loader2,
  ArrowRight,
  Terminal,
  FileCode,
  Download,
  ExternalLink,
  Apple,
  Bot,
  Cpu,
  List,
  Copy,
  Check,
} from 'lucide-react';

export default function MobileTestingPage() {
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [inElectron] = useState(() => isElectron());
  const [maestroInstalled, setMaestroInstalled] = useState<boolean | null>(null);
  const [isCheckingMaestro, setIsCheckingMaestro] = useState(false);
  const [appBundleId, setAppBundleId] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState<'ios' | 'android'>('ios');
  const [nativeDevices, setNativeDevices] = useState<string[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isRunningTest, setIsRunningTest] = useState(false);
  const [testOutput, setTestOutput] = useState<string[]>([]);
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

  // Check Maestro installation on mount
  useEffect(() => {
    checkMaestro();
  }, [inElectron]);

  const checkMaestro = async () => {
    if (!inElectron) return;
    setIsCheckingMaestro(true);
    try {
      const installed = await mobile.checkMaestro();
      setMaestroInstalled(installed);
      if (installed) {
        loadNativeDevices();
      }
    } catch (error) {
      console.error('Failed to check Maestro:', error);
      setMaestroInstalled(false);
    } finally {
      setIsCheckingMaestro(false);
    }
  };

  const loadNativeDevices = async () => {
    if (!inElectron) return;
    setIsLoadingDevices(true);
    try {
      const devices = await mobile.getNativeDevices(selectedPlatform);
      setNativeDevices(devices || []);
      if (devices && devices.length > 0) {
        setSelectedDevice(devices[0]);
      }
    } catch (error) {
      console.error('Failed to load devices:', error);
      setNativeDevices([]);
    } finally {
      setIsLoadingDevices(false);
    }
  };

  // Reload devices when platform changes
  useEffect(() => {
    if (maestroInstalled) {
      loadNativeDevices();
    }
  }, [selectedPlatform, maestroInstalled]);

  const handleRunTest = async () => {
    if (!appBundleId) {
      toast.error('Please enter an App Bundle ID');
      return;
    }
    
    setIsRunningTest(true);
    setTestOutput(['Starting native app test...']);
    
    try {
      // Parse YAML to extract steps (simplified)
      const steps = yamlFlow.split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => ({ action: line.trim().substring(2) }));
      
      setTestOutput(prev => [...prev, `Running ${steps.length} test steps on ${selectedPlatform}...`]);
      
      const result = await mobile.runNativeTest(steps, appBundleId, selectedPlatform, selectedDevice);
      
      if (result.success) {
        setTestOutput(prev => [...prev, '✅ Test completed successfully!']);
        toast.success('Native app test completed!');
      } else {
        setTestOutput(prev => [...prev, `❌ Test failed: ${result.error}`]);
        toast.error(result.error || 'Test failed');
      }
    } catch (error: any) {
      setTestOutput(prev => [...prev, `❌ Error: ${error.message}`]);
      toast.error(error.message || 'Test failed');
    } finally {
      setIsRunningTest(false);
    }
  };

  const copyInstallCommand = () => {
    navigator.clipboard.writeText('curl -Ls "https://get.maestro.mobile.dev" | bash');
    setCopiedInstall(true);
    setTimeout(() => setCopiedInstall(false), 2000);
  };

  return (
    <div className={cn(
      "min-h-screen p-6",
      theme === 'light' ? 'bg-gray-50' : 'bg-gray-950'
    )}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-12 h-12 rounded-xl flex items-center justify-center",
              theme === 'light'
                ? "bg-gradient-to-br from-violet-500 to-purple-600"
                : "bg-gradient-to-br from-violet-400 to-purple-500"
            )}>
              <MonitorSmartphone className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className={cn(
                "text-2xl font-bold",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                Native App Testing
              </h1>
              <p className={cn(
                "text-sm",
                theme === 'light' ? 'text-gray-500' : 'text-gray-400'
              )}>
                Test iOS & Android native apps with Maestro
              </p>
            </div>
          </div>
          
          {/* Quick Link to Mobile Web Testing */}
          <Button
            variant="outline"
            onClick={() => navigate('/recorder')}
            className={cn(
              "gap-2",
              theme === 'light'
                ? "border-sky-200 text-sky-600 hover:bg-sky-50"
                : "border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
            )}
          >
            <Globe className="w-4 h-4" />
            Mobile Web Testing
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
        
        {/* Info Banner */}
        <div className={cn(
          "mt-4 p-3 rounded-lg border flex items-center gap-3",
          theme === 'light'
            ? "bg-sky-50 border-sky-200"
            : "bg-sky-500/10 border-sky-500/30"
        )}>
          <Globe className={cn("w-5 h-5", theme === 'light' ? 'text-sky-600' : 'text-sky-400')} />
          <p className={cn("text-sm", theme === 'light' ? 'text-sky-800' : 'text-sky-300')}>
            <strong>Looking for mobile web testing?</strong> Use the <button onClick={() => navigate('/recorder')} className="underline font-semibold">Record tab</button> with 50+ device profiles for mobile browser emulation.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: Maestro Setup & Configuration */}
        <div className="space-y-6">
          {/* Maestro Status */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn(
                "text-sm font-semibold flex items-center gap-2",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                <Terminal className="w-4 h-4" /> Maestro Status
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={checkMaestro}
                disabled={isCheckingMaestro}
                className="h-7 text-xs"
              >
                {isCheckingMaestro ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <RotateCcw className="w-3 h-3" />
                )}
              </Button>
            </div>

            {maestroInstalled === null ? (
              <div className={cn(
                "p-4 rounded-lg flex items-center gap-3",
                theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
              )}>
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                <span className={cn("text-sm", theme === 'light' ? 'text-gray-600' : 'text-gray-400')}>
                  Checking Maestro installation...
                </span>
              </div>
            ) : maestroInstalled ? (
              <div className={cn(
                "p-4 rounded-lg",
                theme === 'light' ? 'bg-emerald-50' : 'bg-emerald-500/10'
              )}>
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  <span className={cn(
                    "font-medium",
                    theme === 'light' ? 'text-emerald-800' : 'text-emerald-400'
                  )}>
                    Maestro Installed
                  </span>
                </div>
                <p className={cn(
                  "text-xs",
                  theme === 'light' ? 'text-emerald-600' : 'text-emerald-400/80'
                )}>
                  Ready to run native app tests on iOS simulators and Android emulators.
                </p>
              </div>
            ) : (
              <div className={cn(
                "p-4 rounded-lg",
                theme === 'light' ? 'bg-amber-50' : 'bg-amber-500/10'
              )}>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                  <span className={cn(
                    "font-medium",
                    theme === 'light' ? 'text-amber-800' : 'text-amber-400'
                  )}>
                    Maestro Not Installed
                  </span>
                </div>
                <p className={cn(
                  "text-xs mb-3",
                  theme === 'light' ? 'text-amber-700' : 'text-amber-400/80'
                )}>
                  Install Maestro to test native iOS and Android apps:
                </p>
                <div className="flex gap-2">
                  <code className={cn(
                    "flex-1 p-2 rounded text-xs font-mono",
                    theme === 'light' ? 'bg-amber-100 text-amber-900' : 'bg-amber-500/20 text-amber-300'
                  )}>
                    curl -Ls "https://get.maestro.mobile.dev" | bash
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={copyInstallCommand}
                    className="h-8"
                  >
                    {copiedInstall ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Platform Selection */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <h3 className={cn(
              "text-sm font-semibold mb-4 flex items-center gap-2",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              <Cpu className="w-4 h-4" /> Platform & Device
            </h3>

            <div className="flex gap-2 mb-4">
              <Button
                variant={selectedPlatform === 'ios' ? 'default' : 'outline'}
                onClick={() => setSelectedPlatform('ios')}
                className={cn(
                  "flex-1",
                  selectedPlatform === 'ios' && "bg-gradient-to-r from-gray-800 to-gray-900"
                )}
              >
                <Apple className="w-4 h-4 mr-2" /> iOS Simulator
              </Button>
              <Button
                variant={selectedPlatform === 'android' ? 'default' : 'outline'}
                onClick={() => setSelectedPlatform('android')}
                className={cn(
                  "flex-1",
                  selectedPlatform === 'android' && "bg-gradient-to-r from-emerald-500 to-emerald-600"
                )}
              >
                <Bot className="w-4 h-4 mr-2" /> Android Emulator
              </Button>
            </div>

            {/* Device List */}
            <div className="mb-4">
              <label className={cn(
                "text-xs font-medium mb-2 block",
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              )}>
                Available Devices
              </label>
              {isLoadingDevices ? (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Loading devices...</span>
                </div>
              ) : nativeDevices.length > 0 ? (
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {nativeDevices.map((device, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedDevice(device)}
                      className={cn(
                        "w-full p-2 rounded-lg text-left text-sm transition-all",
                        selectedDevice === device
                          ? theme === 'light'
                            ? "bg-violet-100 text-violet-700 border border-violet-300"
                            : "bg-violet-500/20 text-violet-400 border border-violet-500"
                          : theme === 'light'
                            ? "bg-gray-50 text-gray-700 hover:bg-gray-100"
                            : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      )}
                    >
                      <Smartphone className="w-3.5 h-3.5 inline mr-2" />
                      {device}
                    </button>
                  ))}
                </div>
              ) : (
                <div className={cn(
                  "p-3 rounded-lg text-center text-sm",
                  theme === 'light' ? 'bg-gray-50 text-gray-500' : 'bg-gray-800 text-gray-400'
                )}>
                  {maestroInstalled 
                    ? `No ${selectedPlatform === 'ios' ? 'iOS simulators' : 'Android emulators'} found. Start one first.`
                    : 'Install Maestro to detect devices'}
                </div>
              )}
            </div>

            {/* App Bundle ID */}
            <div>
              <label className={cn(
                "text-xs font-medium mb-2 block",
                theme === 'light' ? 'text-gray-600' : 'text-gray-400'
              )}>
                App Bundle ID
              </label>
              <Input
                value={appBundleId}
                onChange={(e) => setAppBundleId(e.target.value)}
                placeholder={selectedPlatform === 'ios' ? 'com.apple.mobilesafari' : 'com.android.chrome'}
                className={cn(
                  theme === 'light'
                    ? "bg-white border-gray-200"
                    : "bg-gray-800 border-gray-700"
                )}
              />
            </div>
          </div>
        </div>

        {/* Right: Test Flow & Output */}
        <div className="space-y-6">
          {/* YAML Flow Editor */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <div className="flex items-center justify-between mb-4">
              <h3 className={cn(
                "text-sm font-semibold flex items-center gap-2",
                theme === 'light' ? 'text-gray-900' : 'text-white'
              )}>
                <FileCode className="w-4 h-4" /> Maestro Flow (YAML)
              </h3>
              <a
                href="https://maestro.mobile.dev/reference/commands"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "text-xs flex items-center gap-1",
                  theme === 'light' ? 'text-violet-600 hover:text-violet-700' : 'text-violet-400 hover:text-violet-300'
                )}
              >
                Docs <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <Textarea
              value={yamlFlow}
              onChange={(e) => setYamlFlow(e.target.value)}
              rows={12}
              className={cn(
                "font-mono text-xs",
                theme === 'light'
                  ? "bg-gray-50 border-gray-200"
                  : "bg-gray-950 border-gray-700"
              )}
            />

            <div className="flex gap-2 mt-4">
              <Button
                onClick={handleRunTest}
                disabled={!maestroInstalled || isRunningTest || !appBundleId}
                className="flex-1 bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 text-white"
              >
                {isRunningTest ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Running...</>
                ) : (
                  <><Play className="w-4 h-4 mr-2" /> Run Test</>
                )}
              </Button>
              {isRunningTest && (
                <Button
                  variant="destructive"
                  onClick={() => setIsRunningTest(false)}
                >
                  <Square className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Test Output */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <h3 className={cn(
              "text-sm font-semibold mb-4 flex items-center gap-2",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              <List className="w-4 h-4" /> Test Output
            </h3>

            <div className={cn(
              "rounded-lg p-3 font-mono text-xs h-48 overflow-y-auto",
              theme === 'light' ? 'bg-gray-900 text-gray-100' : 'bg-gray-950 text-gray-100'
            )}>
              {testOutput.length === 0 ? (
                <span className="text-gray-500">Run a test to see output...</span>
              ) : (
                testOutput.map((line, idx) => (
                  <div key={idx} className="mb-1">
                    {line.includes('✅') ? (
                      <span className="text-emerald-400">{line}</span>
                    ) : line.includes('❌') ? (
                      <span className="text-red-400">{line}</span>
                    ) : (
                      <span>{line}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Common Commands Reference */}
          <div className={cn(
            "rounded-xl border p-5",
            theme === 'light'
              ? "bg-white border-gray-200"
              : "bg-gray-900 border-gray-800"
          )}>
            <h3 className={cn(
              "text-sm font-semibold mb-3",
              theme === 'light' ? 'text-gray-900' : 'text-white'
            )}>
              Common Maestro Commands
            </h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { cmd: 'launchApp', desc: 'Launch the app' },
                { cmd: 'tapOn: "text"', desc: 'Tap on element' },
                { cmd: 'inputText:', desc: 'Enter text' },
                { cmd: 'assertVisible:', desc: 'Check visible' },
                { cmd: 'scroll', desc: 'Scroll screen' },
                { cmd: 'swipe', desc: 'Swipe gesture' },
                { cmd: 'waitForAnimationToEnd', desc: 'Wait for animations' },
                { cmd: 'takeScreenshot', desc: 'Capture screen' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "p-2 rounded",
                    theme === 'light' ? 'bg-gray-50' : 'bg-gray-800'
                  )}
                >
                  <code className={cn(
                    "font-mono",
                    theme === 'light' ? 'text-violet-600' : 'text-violet-400'
                  )}>
                    {item.cmd}
                  </code>
                  <p className={cn(
                    "text-[10px] mt-0.5",
                    theme === 'light' ? 'text-gray-500' : 'text-gray-400'
                  )}>
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
