/**
 * Playwright Recorder Page - Flowstral Desktop
 * 
 * Features:
 * - Start/Stop/Pause/Resume recording
 * - Embedded browser preview with suggestions
 * - SF-aware context for Salesforce pages
 * - Element discovery and smart suggestions
 * 
 * APIs used:
 * - window.flowstral.playwrightRecorder (for standalone browser)
 * - window.electronAPI (for embedded browser)
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Play, Square, Pause, Trash2, Download, ExternalLink, Save,
  CheckCircle, Loader2, Video, Globe, Search, Filter,
  Folder, Tag, Calendar, ChevronDown, ChevronRight,
  Zap, FileText, ArrowLeft, Merge, RotateCcw, X,
  AlertCircle, Check, Layers, RefreshCw, Lightbulb,
  MousePointer, Keyboard, Eye, Target, Cloud, Link,
  Hash, Type, CircleDot, FormInput, Database, Copy,
  Shield, Wand2, CheckSquare, Plus, Settings, ArrowRight,
  SkipForward, Circle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SalesforceContextPanel } from "@/components/SalesforceContextPanel";

// Types
interface RecordedAction {
  id: string;
  qword: string;
  args: string[];
  displayArgs?: string[];
  description: string;
  timestamp: number;
  selectorObj?: any;
  selector?: any;
  type?: string;
}

interface Suggestion {
  type: string;
  qword: string;
  args: string[];
  description: string;
  element: string;
  category: string;
  selector?: string;
  selectorObj?: any;
}

interface SuggestResult {
  suggestions: Suggestion[];
  categories: Record<string, Suggestion[]>;
  counts: Record<string, number>;
  timing: string;
  total: number;
}

interface TestStep {
  id: string;
  type?: string;
  name?: string;
  action?: string;
  expectedResult?: string;
  qword?: string;
  args?: string[];
  selectorObj?: any;
  automationStatus?: 'none' | 'recorded' | 'manual';
}

interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  steps: TestStep[];
  folderId?: string;
  folderName?: string;
  tags?: string[];
  automationStatus?: 'none' | 'partial' | 'full';
}

interface Folder {
  id: string;
  name: string;
  parentId?: string;
}

// Check if running in Electron
const isElectron = () => !!(window as any).flowstral?.playwrightRecorder || !!(window as any).electronAPI;

// Pagination config
const PAGE_SIZE = 50;

export default function PlaywrightRecorderPage() {
  const navigate = useNavigate();
  
  // Recording state
  const [url, setUrl] = useState("https://");
  const [currentUrl, setCurrentUrl] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Suggestions state
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [elementFilter, setElementFilter] = useState<string>('all');
  const [suggestionSearch, setSuggestionSearch] = useState('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  
  // Right panel tab state
  const [rightPanelTab, setRightPanelTab] = useState<string>('suggestions');
  
  // Mode state
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [showTestPicker, setShowTestPicker] = useState(false);
  
  // Test case selection for "Automate Existing"
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  
  // Filters for scalable test picker
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'manual' | 'partial' | 'automated'>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Merge state
  const [mergedSteps, setMergedSteps] = useState<TestStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Detect if current URL is Salesforce
  const isSalesforceUrl = useMemo(() => {
    const urlToCheck = currentUrl || url;
    return urlToCheck.includes('salesforce.com') || 
           urlToCheck.includes('.force.com') || 
           urlToCheck.includes('lightning.force') ||
           urlToCheck.includes('.my.salesforce');
  }, [currentUrl, url]);

  // Recording timer
  useEffect(() => {
    if (isRecording && !isPaused) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load test data on mount
  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = useCallback(async () => {
    try {
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
      
      const allCases = [...localCases];
      flowstralCases.forEach((tc: TestCase) => {
        if (!allCases.some(c => c.id === tc.id)) {
          allCases.push(tc);
        }
      });
      
      const casesWithStatus = allCases.map(tc => ({
        ...tc,
        automationStatus: calculateAutomationStatus(tc)
      }));
      
      setAllTestCases(casesWithStatus);
      
      const localFolders = JSON.parse(localStorage.getItem('test_repository_folders') || '[]');
      setFolders(localFolders);
    } catch (error) {
      console.error('[Recorder] Error loading test data:', error);
    }
  }, []);

  const calculateAutomationStatus = (tc: TestCase): 'none' | 'partial' | 'full' => {
    const steps = tc.steps || [];
    if (steps.length === 0) return 'none';
    
    const automatedSteps = steps.filter((s: TestStep) => {
      if (s.qword && s.args && s.args.length > 0) return true;
      if (s.selectorObj && Object.keys(s.selectorObj).length > 0) return true;
      if (s.automationStatus === 'recorded') return true;
      return false;
    });
    
    if (automatedSteps.length === steps.length) return 'full';
    if (automatedSteps.length > 0) return 'partial';
    return 'none';
  };

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allTestCases.forEach(tc => {
      (tc.tags || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allTestCases]);

  const filteredTestCases = useMemo(() => {
    let filtered = allTestCases;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tc => 
        (tc.name || tc.title || '').toLowerCase().includes(query) ||
        (tc.description || '').toLowerCase().includes(query) ||
        tc.id.toLowerCase().includes(query)
      );
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tc => {
        const status = tc.automationStatus || 'none';
        if (statusFilter === 'manual') return status === 'none';
        if (statusFilter === 'partial') return status === 'partial';
        if (statusFilter === 'automated') return status === 'full';
        return true;
      });
    }
    
    if (folderFilter !== 'all') {
      filtered = filtered.filter(tc => tc.folderId === folderFilter);
    }
    
    if (tagFilter !== 'all') {
      filtered = filtered.filter(tc => (tc.tags || []).includes(tagFilter));
    }
    
    return filtered;
  }, [allTestCases, searchQuery, statusFilter, folderFilter, tagFilter]);

  const paginatedTestCases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTestCases.slice(start, start + PAGE_SIZE);
  }, [filteredTestCases, currentPage]);

  const totalPages = Math.ceil(filteredTestCases.length / PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, folderFilter, tagFilter]);

  // Listen for actions from Playwright recorder
  useEffect(() => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (flowstral?.on) {
      const unsubAction = flowstral.on('playwright-recorder-action', (action: RecordedAction) => {
        console.log('[PlaywrightRecorder] Action:', action);
        setActions(prev => {
          if (prev.some(a => a.id === action.id)) return prev;
          return [...prev, action];
        });
      });

      const unsubStopped = flowstral.on('playwright-recorder-stopped', ({ actions: finalActions }: { actions: RecordedAction[] }) => {
        console.log('[PlaywrightRecorder] Stopped with', finalActions?.length, 'actions');
        if (finalActions?.length > 0) {
          setActions(finalActions);
        }
        setIsRecording(false);
        setIsPaused(false);
      });

      const unsubPaused = flowstral.on('playwright-recorder-paused', () => {
        setIsPaused(true);
      });

      const unsubResumed = flowstral.on('playwright-recorder-resumed', () => {
        setIsPaused(false);
      });

      // Check if already recording
      flowstral.playwrightRecorder?.isRecording?.().then((recording: boolean) => {
        setIsRecording(recording);
        if (recording) {
          flowstral.playwrightRecorder.getActions().then((acts: RecordedAction[]) => {
            if (acts?.length > 0) setActions(acts);
          });
          flowstral.playwrightRecorder.isPaused?.().then((paused: boolean) => {
            setIsPaused(paused);
          });
        }
      });

      return () => {
        unsubAction?.();
        unsubStopped?.();
        unsubPaused?.();
        unsubResumed?.();
      };
    }
    
    // Electron API handlers
    if (electronAPI?.on) {
      const unsubAction = electronAPI.on('action-recorded', (action: RecordedAction) => {
        console.log('[ElectronRecorder] Action:', action);
        setActions(prev => [...prev, action]);
      });

      const unsubUrl = electronAPI.on('browser-url-changed', (newUrl: string) => {
        setCurrentUrl(newUrl);
        if (newUrl.startsWith('http')) setUrl(newUrl);
      });

      const unsubStatus = electronAPI.on('recording-status', ({ recording, paused }: { recording: boolean; paused?: boolean }) => {
        setIsRecording(recording);
        if (typeof paused === 'boolean') setIsPaused(paused);
      });

      return () => {
        unsubAction?.();
        unsubUrl?.();
        unsubStatus?.();
      };
    }
  }, []);

  // Handle suggestions refresh
  const handleRefreshSuggestions = async () => {
    const electronAPI = (window as any).electronAPI;
    const flowstral = (window as any).flowstral;
    
    setIsLoadingSuggestions(true);
    
    try {
      let result: SuggestResult | null = null;
      
      if (electronAPI?.suggestActions) {
        result = await electronAPI.suggestActions();
      } else if (flowstral?.playwrightRecorder?.analyze) {
        result = await flowstral.playwrightRecorder.analyze();
      }
      
      if (result) {
        setSuggestResult(result);
        if (result.total > 0) {
          toast.success(`Found ${result.total} elements`, { duration: 2000 });
        } else {
          toast.info("No elements found on this page");
        }
      }
    } catch (error) {
      console.error('[Recorder] Failed to get suggestions:', error);
      toast.error("Failed to analyze page");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    if (!suggestResult?.suggestions) return [];
    
    return suggestResult.suggestions.filter(s => {
      if (elementFilter !== 'all') {
        const category = s.category?.toLowerCase() || s.type?.toLowerCase() || '';
        if (elementFilter === 'buttons' && !category.includes('button')) return false;
        if (elementFilter === 'links' && !category.includes('link')) return false;
        if (elementFilter === 'inputs' && !category.includes('input') && s.qword !== 'Fill') return false;
        if (elementFilter === 'headings' && !category.includes('heading')) return false;
      }
      if (suggestionSearch.trim()) {
        const query = suggestionSearch.toLowerCase();
        return s.description?.toLowerCase().includes(query) || 
               s.element?.toLowerCase().includes(query) ||
               s.args?.some(a => a.toLowerCase().includes(query));
      }
      return true;
    });
  }, [suggestResult, elementFilter, suggestionSearch]);

  const toggleSuggestionSelection = (index: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllSuggestions = () => {
    if (!filteredSuggestions.length) return;
    setSelectedSuggestions(new Set(filteredSuggestions.map((_, i) => i)));
  };

  const addSelectedToTest = async () => {
    if (selectedSuggestions.size === 0) return;
    
    const newActions: RecordedAction[] = [];
    for (const index of selectedSuggestions) {
      const suggestion = filteredSuggestions[index];
      if (suggestion) {
        newActions.push({
          id: `action_${Date.now()}_${index}`,
          qword: suggestion.qword,
          args: suggestion.args,
          description: suggestion.description,
          timestamp: Date.now(),
          selectorObj: suggestion.selectorObj
        });
      }
    }
    
    setActions(prev => [...prev, ...newActions]);
    toast.success(`Added ${newActions.length} actions`);
    setSelectedSuggestions(new Set());
  };

  const handleStartRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (!flowstral?.playwrightRecorder && !electronAPI?.startRecording) {
      toast.error("Recorder not available. Make sure you're running in Flowstral Desktop.");
      return;
    }

    if (!url || url === 'https://' || url === 'http://' || !url.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a complete URL (e.g., https://example.com)");
      return;
    }

    setIsStarting(true);
    setActions([]);
    setMergedSteps([]);
    setRecordingTime(0);

    try {
      let result;
      if (flowstral?.playwrightRecorder) {
        result = await flowstral.playwrightRecorder.start(url);
      } else if (electronAPI?.startRecording) {
        // First navigate, then start recording
        await electronAPI.navigateEmbeddedBrowser(url);
        result = await electronAPI.startRecording();
      }
      
      if (result?.success !== false) {
        setIsRecording(true);
        setIsPaused(false);
        setCurrentUrl(url);
        toast.success("Recording started - interact with the browser!");
      } else {
        setIsRecording(false);
        toast.error(result?.error || "Failed to start recording");
      }
    } catch (error: any) {
      console.error('[PlaywrightRecorder] Start error:', error);
      setIsRecording(false);
      toast.error(error?.message || "Failed to start browser");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    try {
      let result;
      if (flowstral?.playwrightRecorder) {
        result = await flowstral.playwrightRecorder.stop();
      } else if (electronAPI?.stopRecording) {
        result = await electronAPI.stopRecording();
      }
      
      setIsRecording(false);
      setIsPaused(false);
      
      const finalActions = result?.actions || result;
      if (Array.isArray(finalActions) && finalActions.length > 0) {
        setActions(finalActions);
        toast.success(`Recorded ${finalActions.length} actions`);
        
        if (mode === 'existing' && selectedTestCase) {
          performMerge(finalActions);
        }
      } else if (actions.length > 0) {
        toast.success(`Recording stopped - ${actions.length} actions`);
      } else {
        toast.info("Recording stopped - no actions captured");
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Stop error:', error);
      toast.error("Failed to stop recording");
    }
  };

  const handlePauseRecording = async () => {
    const flowstral = (window as any).flowstral;
    
    try {
      if (flowstral?.playwrightRecorder?.pause) {
        await flowstral.playwrightRecorder.pause();
        setIsPaused(true);
        toast.info("Recording paused");
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Pause error:', error);
    }
  };

  const handleResumeRecording = async () => {
    const flowstral = (window as any).flowstral;
    
    try {
      if (flowstral?.playwrightRecorder?.resume) {
        await flowstral.playwrightRecorder.resume();
        setIsPaused(false);
        toast.info("Recording resumed");
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Resume error:', error);
    }
  };

  const handleClearActions = () => {
    setActions([]);
    setMergedSteps([]);
    (window as any).flowstral?.playwrightRecorder?.clearActions?.();
    (window as any).electronAPI?.clearActions?.();
    toast.info("Actions cleared");
  };

  const performMerge = (recordedActions: RecordedAction[]) => {
    if (!selectedTestCase) return;
    
    const existingSteps = selectedTestCase.steps || [];
    const merged: TestStep[] = [];
    
    const maxLength = Math.max(existingSteps.length, recordedActions.length);
    
    for (let i = 0; i < maxLength; i++) {
      const existingStep = existingSteps[i];
      const action = recordedActions[i];
      
      if (existingStep && action) {
        merged.push({
          ...existingStep,
          qword: action.qword,
          args: action.args,
          selectorObj: action.selectorObj,
          automationStatus: 'recorded'
        });
      } else if (existingStep) {
        merged.push({
          ...existingStep,
          automationStatus: 'manual'
        });
      } else if (action) {
        merged.push({
          id: `step_${Date.now()}_${i}`,
          name: action.description || `${action.qword} ${action.args?.join(' ')}`,
          type: action.qword.toLowerCase(),
          qword: action.qword,
          args: action.args,
          selectorObj: action.selectorObj,
          automationStatus: 'recorded',
          expectedResult: `Action: ${action.qword}`
        });
      }
    }
    
    setMergedSteps(merged);
  };

  const handleSaveMerged = async () => {
    if (!selectedTestCase || mergedSteps.length === 0) {
      toast.error("Nothing to save");
      return;
    }
    
    setIsSaving(true);
    
    try {
      const updatedTestCase = {
        ...selectedTestCase,
        steps: mergedSteps,
        automationStatus: calculateAutomationStatus({ ...selectedTestCase, steps: mergedSteps }),
        updatedAt: new Date().toISOString()
      };
      
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const idx = localCases.findIndex((tc: TestCase) => tc.id === selectedTestCase.id);
      if (idx >= 0) {
        localCases[idx] = updatedTestCase;
      } else {
        localCases.push(updatedTestCase);
      }
      localStorage.setItem('test_cases', JSON.stringify(localCases));
      
      toast.success(`Saved "${selectedTestCase.name}" with ${mergedSteps.length} steps`);
      
      setSelectedTestCase(null);
      setMergedSteps([]);
      setActions([]);
      setMode('new');
      loadTestData();
    } catch (error) {
      console.error('[Recorder] Save error:', error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportToBuilder = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    try {
      if (electronAPI?.exportToTestBuilder) {
        const result = await electronAPI.exportToTestBuilder("Recorded Test");
        if (result?.success) {
          toast.success("Exported to Test Builder!");
        }
      } else if (flowstral?.export?.toTestBuilder) {
        await flowstral.export.toTestBuilder("Recorded Test");
        toast.success("Exported to Test Builder");
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Export error:', error);
      toast.error("Failed to export");
    }
  };

  const handleSaveAsNew = async () => {
    if (actions.length === 0) {
      toast.error("No actions to save");
      return;
    }
    
    const newTestCase: TestCase = {
      id: `tc_${Date.now()}`,
      name: `Recorded Test ${new Date().toLocaleString()}`,
      description: `Recorded from ${url}`,
      steps: actions.map((action, idx) => ({
        id: `step_${Date.now()}_${idx}`,
        name: action.description || `${action.qword} ${action.args?.join(' ')}`,
        type: action.qword?.toLowerCase() || action.type || 'click',
        qword: action.qword,
        args: action.args,
        selectorObj: action.selectorObj,
        automationStatus: 'recorded' as const,
        expectedResult: `Action: ${action.qword}`
      })),
      automationStatus: 'full',
    };
    
    const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localCases.push(newTestCase);
    localStorage.setItem('test_cases', JSON.stringify(localCases));
    
    toast.success(`Created new test case with ${actions.length} steps`);
    navigate('/test-cases');
  };

  const getActionIcon = (qword: string) => {
    const type = qword?.toLowerCase() || '';
    if (type.includes('goto') || type.includes('nav')) return <Globe className="h-4 w-4 text-blue-400" />;
    if (type.includes('click')) return <MousePointer className="h-4 w-4 text-emerald-400" />;
    if (type.includes('fill') || type.includes('type')) return <Type className="h-4 w-4 text-violet-400" />;
    if (type.includes('assert')) return <Eye className="h-4 w-4 text-cyan-400" />;
    return <CircleDot className="h-4 w-4 text-gray-400" />;
  };

  const getStatusBadge = (status?: 'none' | 'partial' | 'full') => {
    switch (status) {
      case 'full':
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">Automated</Badge>;
      case 'partial':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">Partial</Badge>;
      default:
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs">Manual</Badge>;
    }
  };

  if (!isElectron()) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0a0f]">
        <Card className="max-w-md bg-[#12121a] border-white/10">
          <CardContent className="pt-6 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h2 className="text-xl font-semibold mb-2 text-white">Desktop App Required</h2>
            <p className="text-gray-400 mb-4">
              The Playwright Recorder requires the Flowstral Desktop application.
            </p>
            <Button 
              onClick={() => window.open('https://flowstral.dev/download', '_blank')}
              className="bg-gradient-to-r from-cyan-500 to-violet-500"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Flowstral Desktop
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-[#0a0a0f] text-white flex overflow-hidden">
      {/* ============ LEFT PANEL - Recording Controls & Steps ============ */}
      <div className="w-[420px] flex flex-col border-r border-white/10">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold flex items-center gap-2">
              <Video className="h-5 w-5 text-red-500" />
              Playwright Recorder
            </h1>
            {isRecording && (
              <div className="flex items-center gap-2 px-2 py-1 bg-red-500/20 rounded-full border border-red-500/30">
                <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse")} />
                <span className="text-xs font-mono text-red-400">{formatTime(recordingTime)}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">Record browser interactions and create automated tests</p>
        </div>

        {/* Mode Selector */}
        <div className="px-4 py-2 border-b border-white/10">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
            <TabsList className="grid w-full grid-cols-2 h-9 bg-[#1a1a25]">
              <TabsTrigger value="new" className="text-xs data-[state=active]:bg-red-600 data-[state=active]:text-white">
                <Play className="h-3 w-3 mr-1.5" />
                Record New Test
              </TabsTrigger>
              <TabsTrigger value="existing" className="text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                <Merge className="h-3 w-3 mr-1.5" />
                Automate Existing
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Automate Existing - Test Case Selection */}
        {mode === 'existing' && (
          <div className="px-4 py-2 border-b border-white/10 bg-violet-900/10">
            {selectedTestCase ? (
              <div className="flex items-center gap-2 p-2 bg-violet-900/20 border border-violet-500/30 rounded-lg">
                <FileText className="h-4 w-4 text-violet-400" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{selectedTestCase.name}</div>
                  <div className="text-xs text-gray-400">{selectedTestCase.steps?.length || 0} steps</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowTestPicker(true)} className="h-6 text-xs text-violet-400 px-2">
                  Change
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSelectedTestCase(null)} className="h-6 w-6 text-gray-400">
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowTestPicker(true)} variant="outline" className="w-full h-8 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10">
                <Search className="h-3 w-3 mr-1.5" />
                Select Test Case to Automate
              </Button>
            )}
          </div>
        )}

        {/* URL Input */}
        <div className="px-4 py-3 border-b border-white/10">
          <label className="block text-xs text-gray-400 mb-1.5">Starting URL</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isRecording}
                className="pl-9 h-9 bg-[#1a1a25] border-white/10 text-white text-sm"
              />
            </div>
          </div>
        </div>

        {/* Recording Controls */}
        <div className="px-4 py-3 border-b border-white/10 flex gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              disabled={isStarting || !url.startsWith('http') || (mode === 'existing' && !selectedTestCase)}
              className="flex-1 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium"
            >
              {isStarting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Circle className="h-4 w-4 mr-2 fill-current" />
              )}
              Start Recording
            </Button>
          ) : (
            <>
              <Button
                onClick={isPaused ? handleResumeRecording : handlePauseRecording}
                variant="outline"
                className="flex-1 h-10 border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
              >
                {isPaused ? (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </>
                ) : (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause
                  </>
                )}
              </Button>
              <Button
                onClick={handleStopRecording}
                className="flex-1 h-10 bg-red-600 hover:bg-red-700"
              >
                <Square className="h-4 w-4 mr-2 fill-current" />
                Stop
              </Button>
            </>
          )}
        </div>

        {/* Recorded Steps Header */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Recorded Steps</span>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
              {actions.length}
            </Badge>
          </div>
          {actions.length > 0 && (
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleClearActions} className="h-6 px-2 text-xs text-gray-400 hover:text-red-400">
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Recorded Steps List */}
        <ScrollArea className="flex-1">
          {actions.length === 0 ? (
            <div className="text-center py-16 px-4 text-gray-500">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm font-medium">No actions recorded yet.</p>
              <p className="text-xs mt-1">
                {isRecording 
                  ? (isPaused ? "Recording paused. Click Resume to continue." : "Interact with the browser to record actions.")
                  : "Click 'Start Recording' to begin."}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {actions.map((action, index) => (
                <div
                  key={action.id || index}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-[#12121a] hover:bg-[#1a1a25] transition-colors border border-transparent hover:border-white/5 group"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 text-xs text-gray-500 font-mono">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  {getActionIcon(action.qword || action.type || '')}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {action.description || `${action.qword || action.type} ${action.args?.[0] || ''}`}
                    </p>
                    {action.args && action.args.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {action.args.slice(0, 2).join(' → ')}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-400"
                    onClick={() => setActions(prev => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        {actions.length > 0 && (
          <div className="p-3 border-t border-white/10 space-y-2">
            {mode === 'new' ? (
              <>
                <Button onClick={handleSaveAsNew} className="w-full h-9 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700">
                  <Save className="h-4 w-4 mr-2" />
                  Save as New Test Case
                </Button>
                <Button onClick={handleExportToBuilder} variant="outline" className="w-full h-9 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Export to Test Builder
                </Button>
              </>
            ) : (
              <Button 
                onClick={handleSaveMerged} 
                disabled={isSaving || mergedSteps.length === 0}
                className="w-full h-9 bg-gradient-to-r from-violet-500 to-violet-600"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Merged Test
              </Button>
            )}
          </div>
        )}
      </div>

      {/* ============ RIGHT PANEL - Suggestions & SF Context ============ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Tabs value={rightPanelTab} onValueChange={setRightPanelTab} className="flex-1 flex flex-col">
          {/* Tab Headers */}
          <div className="px-4 py-2 border-b border-white/10">
            <TabsList className="h-9 bg-[#1a1a25] p-1">
              <TabsTrigger value="suggestions" className="h-7 px-3 text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
                <Lightbulb className="h-3.5 w-3.5 mr-1.5" />
                Suggestions
                {suggestResult?.total ? (
                  <Badge className="ml-1.5 h-4 bg-amber-500/30 text-amber-300 text-[10px] px-1">
                    {suggestResult.total}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="sftools" className="h-7 px-3 text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                <Cloud className="h-3.5 w-3.5 mr-1.5" />
                SF Tools
              </TabsTrigger>
              <TabsTrigger value="sfcontext" className="h-7 px-3 text-xs data-[state=active]:bg-violet-500/20 data-[state=active]:text-violet-400">
                <Target className="h-3.5 w-3.5 mr-1.5" />
                SF Context
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========== SUGGESTIONS TAB ========== */}
          <TabsContent value="suggestions" className="flex-1 m-0 overflow-hidden flex flex-col">
            {/* Suggestions Header */}
            <div className="px-4 py-2 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold">Suggested Actions</span>
                  {suggestResult?.total ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs">
                      {suggestResult.total} ITEMS
                    </Badge>
                  ) : null}
                </div>
                <Button
                  onClick={handleRefreshSuggestions}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  disabled={isLoadingSuggestions}
                >
                  {isLoadingSuggestions ? (
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3 w-3 mr-1.5" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Category Filter Badges */}
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'all', label: 'All', icon: null, color: 'cyan' },
                  { key: 'buttons', label: 'Buttons', icon: CircleDot, color: 'emerald' },
                  { key: 'links', label: 'Links', icon: Link, color: 'blue' },
                  { key: 'inputs', label: 'Inputs', icon: FormInput, color: 'violet' },
                  { key: 'headings', label: 'Headings', icon: Hash, color: 'amber' },
                ].map(({ key, label, icon: Icon, color }) => (
                  <Badge 
                    key={key}
                    variant="outline" 
                    className={cn(
                      "cursor-pointer transition-colors text-[10px] px-2 py-0.5",
                      elementFilter === key
                        ? `bg-${color}-500/20 border-${color}-500/50 text-${color}-400`
                        : "border-white/20 text-gray-400 hover:border-white/40"
                    )}
                    style={elementFilter === key ? {
                      backgroundColor: `rgb(var(--${color}-500) / 0.2)`,
                      borderColor: `rgb(var(--${color}-500) / 0.5)`,
                      color: `rgb(var(--${color}-400))`
                    } : undefined}
                    onClick={() => setElementFilter(key)}
                  >
                    {Icon && <Icon className="h-2.5 w-2.5 mr-1" />}
                    {label} {suggestResult?.counts?.[key] || 0}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="px-4 py-2 border-b border-white/10 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllSuggestions}
                className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                disabled={!filteredSuggestions.length}
              >
                <CheckSquare className="h-3 w-3 mr-1.5" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addSelectedToTest}
                className="h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                disabled={selectedSuggestions.size === 0}
              >
                <Plus className="h-3 w-3 mr-1.5" />
                Add Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                disabled={!filteredSuggestions.length}
              >
                <Wand2 className="h-3 w-3 mr-1.5" />
                AI Enhance
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="px-4 py-2 border-b border-white/10 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
                <Input
                  value={suggestionSearch}
                  onChange={(e) => setSuggestionSearch(e.target.value)}
                  placeholder="Search elements..."
                  className="pl-8 h-8 bg-[#1a1a25] border-white/10 text-white text-xs"
                />
              </div>
              <Select value={elementFilter} onValueChange={setElementFilter}>
                <SelectTrigger className="w-28 h-8 bg-[#1a1a25] border-white/10 text-white text-xs">
                  <SelectValue placeholder="All Elements" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a25] border-white/10">
                  <SelectItem value="all" className="text-xs">All Elements</SelectItem>
                  <SelectItem value="buttons" className="text-xs">Buttons</SelectItem>
                  <SelectItem value="links" className="text-xs">Links</SelectItem>
                  <SelectItem value="inputs" className="text-xs">Inputs</SelectItem>
                  <SelectItem value="headings" className="text-xs">Headings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Suggestions List */}
            <ScrollArea className="flex-1">
              <div className="p-3">
                {!suggestResult ? (
                  <div className="text-center py-12 text-gray-500">
                    <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">Start recording to see suggestions</p>
                    <p className="text-xs mt-1">Click Refresh to analyze current page</p>
                  </div>
                ) : filteredSuggestions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <Search className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No matching elements found</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredSuggestions.map((suggestion, index) => (
                      <div
                        key={index}
                        onClick={() => toggleSuggestionSelection(index)}
                        className={cn(
                          "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-all",
                          selectedSuggestions.has(index)
                            ? "bg-cyan-500/10 border-cyan-500/50"
                            : "bg-[#12121a] border-transparent hover:border-white/10"
                        )}
                      >
                        <div className={cn(
                          "w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0",
                          selectedSuggestions.has(index)
                            ? "bg-cyan-500 border-cyan-500"
                            : "border-gray-600"
                        )}>
                          {selectedSuggestions.has(index) && <Check className="h-2.5 w-2.5 text-white" />}
                        </div>
                        
                        <div className={cn(
                          "w-7 h-7 rounded flex items-center justify-center shrink-0",
                          suggestion.qword === 'ClickText' && "bg-emerald-500/20 text-emerald-400",
                          suggestion.qword === 'Fill' && "bg-violet-500/20 text-violet-400",
                          suggestion.qword === 'AssertText' && "bg-cyan-500/20 text-cyan-400",
                          !['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && "bg-gray-500/20 text-gray-400"
                        )}>
                          {suggestion.qword === 'ClickText' && <MousePointer className="h-3.5 w-3.5" />}
                          {suggestion.qword === 'Fill' && <Keyboard className="h-3.5 w-3.5" />}
                          {suggestion.qword === 'AssertText' && <Eye className="h-3.5 w-3.5" />}
                          {!['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && <CircleDot className="h-3.5 w-3.5" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white truncate">{suggestion.description}</p>
                          <p className="text-[10px] text-gray-500 truncate">{suggestion.element || suggestion.args?.[0]}</p>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/20 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newAction: RecordedAction = {
                              id: `action_${Date.now()}`,
                              qword: suggestion.qword,
                              args: suggestion.args,
                              description: suggestion.description,
                              timestamp: Date.now(),
                              selectorObj: suggestion.selectorObj
                            };
                            setActions(prev => [...prev, newAction]);
                            toast.success('Added to test', { duration: 1500 });
                          }}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* ========== SF TOOLS TAB ========== */}
          <TabsContent value="sftools" className="flex-1 m-0 overflow-y-auto">
            <div className="p-4 space-y-4">
              <div className="text-center py-4">
                <Cloud className="h-10 w-10 mx-auto mb-2 text-blue-400 opacity-50" />
                <h3 className="text-base font-semibold mb-1">Salesforce Tools</h3>
                <p className="text-xs text-gray-400">Quick access to Salesforce-specific testing tools</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-[#12121a] border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Database className="h-7 w-7 mx-auto mb-2 text-blue-400" />
                    <p className="text-sm font-medium">Query Builder</p>
                    <p className="text-xs text-gray-500">Build SOQL queries</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-emerald-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Zap className="h-7 w-7 mx-auto mb-2 text-emerald-400" />
                    <p className="text-sm font-medium">Apex Runner</p>
                    <p className="text-xs text-gray-500">Execute Apex code</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-violet-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Copy className="h-7 w-7 mx-auto mb-2 text-violet-400" />
                    <p className="text-sm font-medium">Record Cloner</p>
                    <p className="text-xs text-gray-500">Clone test data</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-amber-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Shield className="h-7 w-7 mx-auto mb-2 text-amber-400" />
                    <p className="text-sm font-medium">Validation Rules</p>
                    <p className="text-xs text-gray-500">View active rules</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========== SF CONTEXT TAB ========== */}
          <TabsContent value="sfcontext" className="flex-1 m-0 overflow-hidden flex flex-col">
            {isSalesforceUrl ? (
              <SalesforceContextPanel
                currentUrl={currentUrl || url}
                isRecording={isRecording}
                onAddAssertion={(code) => {
                  const action: RecordedAction = {
                    id: `assert_${Date.now()}`,
                    qword: 'AssertText',
                    args: [code],
                    description: `Assert: ${code.slice(0, 30)}...`,
                    timestamp: Date.now()
                  };
                  setActions(prev => [...prev, action]);
                  toast.success('Assertion added');
                }}
                onAddAction={(code) => {
                  const action: RecordedAction = {
                    id: `action_${Date.now()}`,
                    qword: 'Custom',
                    args: [code],
                    description: code.slice(0, 50),
                    timestamp: Date.now()
                  };
                  setActions(prev => [...prev, action]);
                  toast.success('Action added');
                }}
                onGenerateTestData={(data) => {
                  toast.success(`Generated ${data.length} test records`);
                }}
                className="flex-1"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Target className="h-10 w-10 mx-auto mb-3 text-violet-400 opacity-50" />
                  <h3 className="text-base font-semibold mb-1">SF Context</h3>
                  <p className="text-xs text-gray-400">
                    Navigate to a Salesforce page to see<br />context-aware suggestions
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Test Case Picker Dialog */}
      <Dialog open={showTestPicker} onOpenChange={setShowTestPicker}>
        <DialogContent className="max-w-3xl max-h-[80vh] bg-[#12121a] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Search className="h-5 w-5" />
              Select Test Case to Automate
              <Badge variant="secondary" className="ml-2">
                {filteredTestCases.length} of {allTestCases.length}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {/* Filters */}
          <div className="grid grid-cols-4 gap-2 pb-3 border-b border-white/10">
            <div className="col-span-2 relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search by name, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-[#1a1a25] border-white/10 text-white text-sm"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="h-9 bg-[#1a1a25] border-white/10 text-white text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="h-9 bg-[#1a1a25] border-white/10 text-white text-sm">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Folders</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Test Case List */}
          <ScrollArea className="h-[350px]">
            {paginatedTestCases.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No test cases found</p>
              </div>
            ) : (
              <div className="space-y-2 pr-4">
                {paginatedTestCases.map(tc => (
                  <div
                    key={tc.id}
                    onClick={() => {
                      setSelectedTestCase(tc);
                      setShowTestPicker(false);
                    }}
                    className={cn(
                      "p-3 rounded-lg border cursor-pointer transition-all",
                      "hover:border-violet-500 hover:bg-white/5",
                      selectedTestCase?.id === tc.id
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-white/10 bg-white/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{tc.name || tc.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {tc.steps?.length || 0} steps
                          </Badge>
                        </div>
                      </div>
                      {getStatusBadge(tc.automationStatus)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <div className="text-xs text-gray-400">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="h-7 text-xs border-white/20"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="h-7 text-xs border-white/20"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
