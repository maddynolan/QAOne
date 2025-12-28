/**
 * Playwright Recorder Page - Full Featured UI
 * 
 * Layout (matching original UI):
 * - Left Panel: Recorded Steps with test steps
 * - Right Panel: Tabs for Suggestions, SF Tools, SF Context
 * 
 * Features:
 * - Record New: Create new automated tests from scratch
 * - Automate Existing: Merge recording with existing manual test cases
 * - Smart suggestions with element discovery
 * - SF-aware context panel for Salesforce pages
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Play, Square, Trash2, Download, ExternalLink, Save,
  CheckCircle, Loader2, Video, Globe, Search, Filter,
  Folder, Tag, Calendar, ChevronDown, ChevronRight,
  Zap, FileText, ArrowLeft, Merge, RotateCcw, X,
  AlertCircle, Check, Layers, RefreshCw, Lightbulb,
  MousePointer, Keyboard, Eye, Target, Cloud, Link,
  Hash, Type, CircleDot, FormInput, Database, Copy,
  Shield, Wand2, CheckSquare, Plus, Settings
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
import { SalesforceContextPanel } from "@/components/SalesforceContextPanel";

interface RecordedAction {
  id: string;
  qword: string;
  args: string[];
  displayArgs?: string[];
  description: string;
  timestamp: number;
  selectorObj?: any;
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
  releaseId?: string;
  planId?: string;
  tags?: string[];
  automationStatus?: 'none' | 'partial' | 'full';
  createdAt?: string;
  updatedAt?: string;
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
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  
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
  const [releases, setReleases] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  
  // Filters for scalable test picker
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'manual' | 'partial' | 'automated'>('all');
  const [folderFilter, setFolderFilter] = useState<string>('all');
  const [releaseFilter, setReleaseFilter] = useState<string>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  
  // Merge state
  const [mergedSteps, setMergedSteps] = useState<TestStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Detect if current URL is Salesforce
  const isSalesforceUrl = useMemo(() => {
    const urlToCheck = currentUrl || url;
    return urlToCheck.includes('salesforce.com') || 
           urlToCheck.includes('.force.com') || 
           urlToCheck.includes('lightning.force') ||
           urlToCheck.includes('.my.salesforce');
  }, [currentUrl, url]);

  // Load test data on mount
  useEffect(() => {
    loadTestData();
  }, []);

  const loadTestData = useCallback(async () => {
    try {
      // Load from localStorage first
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
      
      // Merge and dedupe by ID
      const allCases = [...localCases];
      flowstralCases.forEach((tc: TestCase) => {
        if (!allCases.some(c => c.id === tc.id)) {
          allCases.push(tc);
        }
      });
      
      // Try to load from Electron storage too
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.localStorage) {
        try {
          const electronCases = await electronAPI.localStorage.get('test_cases');
          if (electronCases && Array.isArray(electronCases)) {
            electronCases.forEach((tc: TestCase) => {
              if (!allCases.some(c => c.id === tc.id)) {
                allCases.push(tc);
              }
            });
          }
        } catch (e) {
          console.log('[Recorder] Could not load from Electron storage');
        }
      }
      
      // Calculate automation status for each test case
      const casesWithStatus = allCases.map(tc => ({
        ...tc,
        automationStatus: calculateAutomationStatus(tc)
      }));
      
      setAllTestCases(casesWithStatus);
      console.log(`[Recorder] Loaded ${casesWithStatus.length} test cases`);
      
      // Load folders
      const localFolders = JSON.parse(localStorage.getItem('test_repository_folders') || '[]');
      setFolders(localFolders);
      
      // Load releases and plans
      const localReleases = JSON.parse(localStorage.getItem('test_releases') || '[]');
      const localPlans = JSON.parse(localStorage.getItem('test_plans') || '[]');
      setReleases(localReleases);
      setPlans(localPlans);
      
    } catch (error) {
      console.error('[Recorder] Error loading test data:', error);
    }
  }, []);

  // Calculate automation status
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

  // Get unique tags from all test cases
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allTestCases.forEach(tc => {
      (tc.tags || []).forEach(tag => tags.add(tag));
    });
    return Array.from(tags).sort();
  }, [allTestCases]);

  // Filter and paginate test cases
  const filteredTestCases = useMemo(() => {
    let filtered = allTestCases;
    
    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(tc => 
        (tc.name || tc.title || '').toLowerCase().includes(query) ||
        (tc.description || '').toLowerCase().includes(query) ||
        tc.id.toLowerCase().includes(query)
      );
    }
    
    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(tc => {
        const status = tc.automationStatus || 'none';
        if (statusFilter === 'manual') return status === 'none';
        if (statusFilter === 'partial') return status === 'partial';
        if (statusFilter === 'automated') return status === 'full';
        return true;
      });
    }
    
    // Folder filter
    if (folderFilter !== 'all') {
      filtered = filtered.filter(tc => tc.folderId === folderFilter);
    }
    
    // Release filter
    if (releaseFilter !== 'all') {
      filtered = filtered.filter(tc => tc.releaseId === releaseFilter);
    }
    
    // Tag filter
    if (tagFilter !== 'all') {
      filtered = filtered.filter(tc => (tc.tags || []).includes(tagFilter));
    }
    
    return filtered;
  }, [allTestCases, searchQuery, statusFilter, folderFilter, releaseFilter, tagFilter]);

  // Paginated results
  const paginatedTestCases = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTestCases.slice(start, start + PAGE_SIZE);
  }, [filteredTestCases, currentPage]);

  const totalPages = Math.ceil(filteredTestCases.length / PAGE_SIZE);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, folderFilter, releaseFilter, tagFilter]);

  // Listen for actions from Playwright recorder
  useEffect(() => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (flowstral) {
      // Listen for individual actions
      const unsubAction = flowstral.on?.('playwright-recorder-action', (action: RecordedAction) => {
        console.log('[PlaywrightRecorder] Action:', action);
        setActions(prev => {
          if (prev.some(a => a.id === action.id)) return prev;
          return [...prev, action];
        });
      });

      // Listen for recording stopped
      const unsubStopped = flowstral.on?.('playwright-recorder-stopped', ({ actions: finalActions }: { actions: RecordedAction[] }) => {
        console.log('[PlaywrightRecorder] Stopped with', finalActions?.length, 'actions');
        if (finalActions?.length > 0) {
          setActions(finalActions);
        }
        setIsRecording(false);
      });

      // Check if already recording
      flowstral.playwrightRecorder?.isRecording?.().then((recording: boolean) => {
        setIsRecording(recording);
        if (recording) {
          flowstral.playwrightRecorder.getActions().then((acts: RecordedAction[]) => {
            if (acts?.length > 0) setActions(acts);
          });
        }
      });

      return () => {
        unsubAction?.();
        unsubStopped?.();
      };
    }
    
    // Electron API handlers
    if (electronAPI) {
      const unsubAction = electronAPI.on?.('action-recorded', (action: RecordedAction) => {
        console.log('[ElectronRecorder] Action:', action);
        setActions(prev => [...prev, action]);
      });

      const unsubUrl = electronAPI.on?.('browser-url-changed', (newUrl: string) => {
        setCurrentUrl(newUrl);
        if (newUrl.startsWith('http')) setUrl(newUrl);
      });

      return () => {
        unsubAction?.();
        unsubUrl?.();
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
      } else if (flowstral?.suggestActions) {
        result = await flowstral.suggestActions();
      }
      
      if (result) {
        setSuggestResult(result);
        if (result.total > 0) {
          toast.success(`Found ${result.total} suggestions`);
        } else {
          toast.info("No suggestions found on this page");
        }
      }
    } catch (error) {
      console.error('[Recorder] Failed to get suggestions:', error);
      toast.error("Failed to get suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Filter suggestions
  const filteredSuggestions = useMemo(() => {
    if (!suggestResult?.suggestions) return [];
    
    return suggestResult.suggestions.filter(s => {
      // Category filter
      if (elementFilter !== 'all') {
        const category = s.category?.toLowerCase() || s.type?.toLowerCase() || '';
        if (elementFilter === 'buttons' && !category.includes('button')) return false;
        if (elementFilter === 'links' && !category.includes('link')) return false;
        if (elementFilter === 'inputs' && !category.includes('input') && s.qword !== 'Fill') return false;
        if (elementFilter === 'headings' && !category.includes('heading')) return false;
      }
      // Search filter
      if (suggestionSearch.trim()) {
        const query = suggestionSearch.toLowerCase();
        return s.description?.toLowerCase().includes(query) || 
               s.element?.toLowerCase().includes(query) ||
               s.args?.some(a => a.toLowerCase().includes(query));
      }
      return true;
    });
  }, [suggestResult, elementFilter, suggestionSearch]);

  // Toggle suggestion selection
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

  // Select all suggestions
  const selectAllSuggestions = () => {
    if (!filteredSuggestions.length) return;
    setSelectedSuggestions(new Set(filteredSuggestions.map((_, i) => i)));
  };

  // Add selected suggestions to test
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
    toast.success(`Added ${newActions.length} actions to test`);
    setSelectedSuggestions(new Set());
  };

  const handleStartRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (!flowstral?.playwrightRecorder && !electronAPI?.startRecording) {
      toast.error("Recorder not available");
      return;
    }

    if (!url || url === 'https://' || url === 'http://' || !url.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a complete URL (e.g., https://example.com)");
      return;
    }

    setIsStarting(true);
    setActions([]);
    setMergedSteps([]);

    try {
      let result;
      if (electronAPI?.startRecording) {
        result = await electronAPI.startRecording(url);
      } else if (flowstral?.playwrightRecorder) {
        result = await flowstral.playwrightRecorder.start(url);
      }
      
      if (result?.success !== false) {
        setIsRecording(true);
        setCurrentUrl(url);
        toast.success("Browser opened - start interacting!");
      } else {
        setIsRecording(false);
        toast.error(result?.error || "Failed to start recording");
      }
    } catch (error: any) {
      console.error('[PlaywrightRecorder] Start error:', error);
      setIsRecording(false);
      toast.error("Failed to start browser");
    } finally {
      setIsStarting(false);
    }
  };

  const handleStopRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    try {
      let result;
      if (electronAPI?.stopRecording) {
        result = await electronAPI.stopRecording();
      } else if (flowstral?.playwrightRecorder) {
        result = await flowstral.playwrightRecorder.stop();
      }
      
      setIsRecording(false);
      
      const finalActions = result?.actions || result;
      if (Array.isArray(finalActions) && finalActions.length > 0) {
        setActions(finalActions);
        toast.success(`Recorded ${finalActions.length} actions`);
        
        // Auto-merge if in existing mode
        if (mode === 'existing' && selectedTestCase) {
          performMerge(finalActions);
        }
      } else {
        toast.info("No actions recorded");
      }
    } catch (error) {
      console.error('[PlaywrightRecorder] Stop error:', error);
      toast.error("Failed to stop recording");
    }
  };

  const handleClearActions = () => {
    setActions([]);
    setMergedSteps([]);
    (window as any).flowstral?.playwrightRecorder?.clearActions?.();
    (window as any).electronAPI?.clearActions?.();
    toast.info("Actions cleared");
  };

  // Perform merge: Position-based mapping
  const performMerge = (recordedActions: RecordedAction[]) => {
    if (!selectedTestCase) return;
    
    const existingSteps = selectedTestCase.steps || [];
    const merged: TestStep[] = [];
    
    // Position-based merge: Action 1 → Step 1, Action 2 → Step 2, etc.
    const maxLength = Math.max(existingSteps.length, recordedActions.length);
    
    for (let i = 0; i < maxLength; i++) {
      const existingStep = existingSteps[i];
      const action = recordedActions[i];
      
      if (existingStep && action) {
        // Both exist: Merge automation into existing step
        merged.push({
          ...existingStep,
          qword: action.qword,
          args: action.args,
          selectorObj: action.selectorObj,
          automationStatus: 'recorded'
        });
      } else if (existingStep) {
        // Only manual step exists (more manual steps than recorded)
        merged.push({
          ...existingStep,
          automationStatus: 'manual'
        });
      } else if (action) {
        // Only recorded action exists (more recorded than manual)
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
    console.log(`[Merge] Merged ${merged.length} steps (${existingSteps.length} manual + ${recordedActions.length} recorded)`);
  };

  // Save merged test case
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
      
      // Save to localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const idx = localCases.findIndex((tc: TestCase) => tc.id === selectedTestCase.id);
      if (idx >= 0) {
        localCases[idx] = updatedTestCase;
      } else {
        localCases.push(updatedTestCase);
      }
      localStorage.setItem('test_cases', JSON.stringify(localCases));
      
      // Also save to flowstral_test_cases for compatibility
      const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
      const fIdx = flowstralCases.findIndex((tc: TestCase) => tc.id === selectedTestCase.id);
      if (fIdx >= 0) {
        flowstralCases[fIdx] = updatedTestCase;
      } else {
        flowstralCases.push(updatedTestCase);
      }
      localStorage.setItem('flowstral_test_cases', JSON.stringify(flowstralCases));
      
      // Save to Electron storage
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.localStorage) {
        try {
          await electronAPI.localStorage.set('test_cases', localCases);
        } catch (e) {
          console.log('[Recorder] Could not save to Electron storage');
        }
      }
      
      toast.success(`Saved "${selectedTestCase.name}" with ${mergedSteps.length} steps`);
      
      // Reset state
      setSelectedTestCase(null);
      setMergedSteps([]);
      setActions([]);
      setMode('new');
      
      // Reload test data
      loadTestData();
      
    } catch (error) {
      console.error('[Recorder] Save error:', error);
      toast.error("Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Export to Builder (for new tests)
  const handleExportToBuilder = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    try {
      if (electronAPI?.exportToTestBuilder) {
        await electronAPI.exportToTestBuilder("Recorded Test");
      } else if (flowstral?.export) {
        await flowstral.export.toTestBuilder("Recorded Test");
      }
      toast.success("Exported to Test Builder");
    } catch (error) {
      console.error('[PlaywrightRecorder] Export error:', error);
      toast.error("Failed to export");
    }
  };

  // Save as new test case
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
        type: action.qword.toLowerCase(),
        qword: action.qword,
        args: action.args,
        selectorObj: action.selectorObj,
        automationStatus: 'recorded' as const,
        expectedResult: `Action: ${action.qword}`
      })),
      automationStatus: 'full',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Save to localStorage
    const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localCases.push(newTestCase);
    localStorage.setItem('test_cases', JSON.stringify(localCases));
    
    toast.success(`Created new test case with ${actions.length} steps`);
    
    // Navigate to test repository
    navigate('/test-cases');
  };

  const getActionIcon = (qword: string) => {
    switch (qword) {
      case 'GoTo': return <Globe className="h-4 w-4 text-blue-400" />;
      case 'ClickText':
      case 'ClickElement': return <MousePointer className="h-4 w-4 text-green-400" />;
      case 'Fill': return <Type className="h-4 w-4 text-purple-400" />;
      case 'AssertText': return <Eye className="h-4 w-4 text-cyan-400" />;
      default: return <CircleDot className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusBadge = (status?: 'none' | 'partial' | 'full') => {
    switch (status) {
      case 'full':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Automated</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Partial</Badge>;
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
            <p className="text-gray-400">
              The Playwright Recorder is only available in the Flowstral Desktop app.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex">
      {/* ============ LEFT PANEL - Recorded Steps ============ */}
      <div className="w-1/2 flex flex-col border-r border-white/10 overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-white/10">
          <h1 className="text-xl font-bold mb-1 flex items-center gap-2">
            <Video className="h-5 w-5 text-purple-500" />
            Playwright Recorder
          </h1>
          <p className="text-sm text-gray-500">
            Record browser interactions and create automated tests
          </p>
        </div>

        {/* Mode Selector */}
        <div className="px-4 py-3 border-b border-white/10">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
            <TabsList className="grid w-full grid-cols-2 bg-[#1a1a25]">
              <TabsTrigger value="new" className="text-sm data-[state=active]:bg-purple-600 data-[state=active]:text-white">
                <Play className="h-4 w-4 mr-2" />
                Record New Test
              </TabsTrigger>
              <TabsTrigger value="existing" className="text-sm data-[state=active]:bg-blue-600 data-[state=active]:text-white">
                <Merge className="h-4 w-4 mr-2" />
                Automate Existing
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Automate Existing - Test Case Selection */}
        {mode === 'existing' && (
          <div className="px-4 py-3 border-b border-white/10">
            <p className="text-xs text-gray-400 mb-2">
              Select an existing manual test case and record automation to merge with it.
            </p>
            {selectedTestCase ? (
              <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <FileText className="h-5 w-5 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{selectedTestCase.name}</div>
                  <div className="text-xs text-gray-400">
                    {selectedTestCase.steps?.length || 0} steps
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTestPicker(true)}
                  className="h-7 text-xs text-blue-400"
                >
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedTestCase(null)}
                  className="h-7 w-7 text-gray-400"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => setShowTestPicker(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 h-9"
              >
                <Search className="h-4 w-4 mr-2" />
                Select Test Case to Automate
              </Button>
            )}
          </div>
        )}

        {/* URL Input */}
        <div className="px-4 py-3 border-b border-white/10">
          <label className="block text-xs text-gray-400 mb-2">Starting URL</label>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
                disabled={isRecording}
                className="pl-10 h-10 bg-[#1a1a25] border-white/10 text-white"
              />
            </div>
            {!isRecording ? (
              <Button
                onClick={handleStartRecording}
                disabled={isStarting || !url.startsWith('http') || (mode === 'existing' && !selectedTestCase)}
                className="bg-green-600 hover:bg-green-700 h-10 px-6"
              >
                {isStarting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Start Recording
              </Button>
            ) : (
              <Button
                onClick={handleStopRecording}
                className="bg-red-600 hover:bg-red-700 h-10 px-6"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop
              </Button>
            )}
          </div>
          
          {isRecording && (
            <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Recording in progress...
            </div>
          )}
        </div>

        {/* Recorded Steps Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Recorded Steps</span>
            <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
              {actions.length}
            </Badge>
          </div>
          {actions.length > 0 && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearActions}
                className="h-7 px-2 text-xs text-gray-400 hover:text-white"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              {mode === 'new' && (
                <Button
                  size="sm"
                  onClick={handleSaveAsNew}
                  className="h-7 px-3 text-xs bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="h-3 w-3 mr-1" />
                  Save
                </Button>
              )}
              {mode === 'existing' && mergedSteps.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleSaveMerged}
                  disabled={isSaving}
                  className="h-7 px-3 text-xs bg-green-600 hover:bg-green-700"
                >
                  {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}
                  Save Merged
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Recorded Steps List */}
        <ScrollArea className="flex-1">
          {actions.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No actions recorded yet.</p>
              <p className="text-xs mt-1">
                {isRecording 
                  ? "Interact with the browser window to record actions."
                  : "Click 'Start Recording' to begin."}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {actions.map((action, index) => (
                <div
                  key={action.id || index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#12121a] hover:bg-[#1a1a25] transition-colors border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-xs text-gray-500 font-medium">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  {getActionIcon(action.qword)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {action.description || `${action.qword} ${action.args?.[0] || ''}`}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {action.args?.join(' → ')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs border-white/20">
                    {action.qword}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer Actions */}
        {actions.length > 0 && (
          <div className="p-3 border-t border-white/10">
            <Button
              onClick={handleExportToBuilder}
              className="w-full h-10 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Export to Test Builder
            </Button>
          </div>
        )}
      </div>

      {/* ============ RIGHT PANEL - Suggestions & SF Context ============ */}
      <div className="w-1/2 flex flex-col overflow-hidden">
        <Tabs value={rightPanelTab} onValueChange={setRightPanelTab} className="flex-1 flex flex-col">
          {/* Tab Headers */}
          <div className="px-4 py-3 border-b border-white/10">
            <TabsList className="h-9 bg-[#1a1a25] p-1">
              <TabsTrigger 
                value="suggestions" 
                className="h-7 px-4 text-sm data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Suggestions
                {suggestResult?.total && (
                  <Badge className="ml-2 h-5 bg-amber-500/30 text-amber-300 text-[10px]">
                    {suggestResult.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="sftools" 
                className="h-7 px-4 text-sm data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              >
                <Cloud className="h-4 w-4 mr-2" />
                SF Tools
              </TabsTrigger>
              <TabsTrigger 
                value="sfcontext" 
                className="h-7 px-4 text-sm data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              >
                <Target className="h-4 w-4 mr-2" />
                SF Context
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========== SUGGESTIONS TAB ========== */}
          <TabsContent value="suggestions" className="flex-1 m-0 overflow-hidden flex flex-col">
            {/* Suggestions Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-semibold">Suggested Actions</span>
                  {suggestResult?.total && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                      {suggestResult.total} ITEMS
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleRefreshSuggestions}
                  variant="outline"
                  size="sm"
                  className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  disabled={isLoadingSuggestions}
                >
                  {isLoadingSuggestions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Category Filter Badges */}
              <div className="flex gap-2 flex-wrap">
                {['all', 'buttons', 'links', 'inputs', 'headings'].map((cat) => (
                  <Badge 
                    key={cat}
                    variant="outline" 
                    className={cn(
                      "cursor-pointer transition-colors text-xs",
                      elementFilter === cat
                        ? cat === 'buttons' ? "bg-green-500/20 border-green-500/50 text-green-400"
                        : cat === 'links' ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                        : cat === 'inputs' ? "bg-purple-500/20 border-purple-500/50 text-purple-400"
                        : cat === 'headings' ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                        : "bg-cyan-500/20 border-cyan-500/50 text-cyan-400"
                        : "border-white/20 text-gray-400 hover:border-white/40"
                    )}
                    onClick={() => setElementFilter(cat)}
                  >
                    {cat === 'buttons' && <CircleDot className="h-3 w-3 mr-1" />}
                    {cat === 'links' && <Link className="h-3 w-3 mr-1" />}
                    {cat === 'inputs' && <FormInput className="h-3 w-3 mr-1" />}
                    {cat === 'headings' && <Hash className="h-3 w-3 mr-1" />}
                    {cat.charAt(0).toUpperCase() + cat.slice(1)} {suggestResult?.counts?.[cat] || 0}
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
                className="h-8 border-green-500/30 text-green-400 hover:bg-green-500/10"
                disabled={!filteredSuggestions.length}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addSelectedToTest}
                className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                disabled={selectedSuggestions.size === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                disabled={!filteredSuggestions.length}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Enhance
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="px-4 py-2 border-b border-white/10 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={suggestionSearch}
                  onChange={(e) => setSuggestionSearch(e.target.value)}
                  placeholder="Search elements..."
                  className="pl-10 h-9 bg-[#1a1a25] border-white/10 text-white text-sm"
                />
              </div>
              <Select value={elementFilter} onValueChange={setElementFilter}>
                <SelectTrigger className="w-36 h-9 bg-[#1a1a25] border-white/10 text-white text-sm">
                  <SelectValue placeholder="All Elements" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a25] border-white/10">
                  <SelectItem value="all">All Elements</SelectItem>
                  <SelectItem value="buttons">Buttons</SelectItem>
                  <SelectItem value="links">Links</SelectItem>
                  <SelectItem value="inputs">Inputs</SelectItem>
                  <SelectItem value="headings">Headings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Suggestions List */}
            <ScrollArea className="flex-1 p-4">
              {!suggestResult ? (
                <div className="text-center py-12 text-gray-500">
                  <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Start recording to see suggestions</p>
                  <p className="text-xs mt-1 text-gray-600">
                    Click Refresh to analyze current page
                  </p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No matching elements found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => toggleSuggestionSelection(index)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        selectedSuggestions.has(index)
                          ? "bg-cyan-500/10 border-cyan-500/50"
                          : "bg-[#12121a] border-transparent hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        selectedSuggestions.has(index)
                          ? "bg-cyan-500 border-cyan-500"
                          : "border-gray-600"
                      )}>
                        {selectedSuggestions.has(index) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </div>
                      
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center",
                        suggestion.qword === 'ClickText' && "bg-green-500/20 text-green-400",
                        suggestion.qword === 'Fill' && "bg-purple-500/20 text-purple-400",
                        suggestion.qword === 'AssertText' && "bg-cyan-500/20 text-cyan-400",
                        !['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && "bg-gray-500/20 text-gray-400"
                      )}>
                        {suggestion.qword === 'ClickText' && <MousePointer className="h-4 w-4" />}
                        {suggestion.qword === 'Fill' && <Keyboard className="h-4 w-4" />}
                        {suggestion.qword === 'AssertText' && <Eye className="h-4 w-4" />}
                        {!['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && <CircleDot className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{suggestion.description}</p>
                        <p className="text-xs text-gray-500 truncate">{suggestion.element || suggestion.args?.[0]}</p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/20"
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
                          toast.success('Added to test');
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* ========== SF TOOLS TAB ========== */}
          <TabsContent value="sftools" className="flex-1 m-0 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="text-center py-6">
                <Cloud className="h-10 w-10 mx-auto mb-3 text-blue-400 opacity-50" />
                <h3 className="text-lg font-semibold mb-1">Salesforce Tools</h3>
                <p className="text-sm text-gray-400">
                  Quick access to Salesforce-specific testing tools
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-[#12121a] border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Database className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                    <p className="text-sm font-medium">Query Builder</p>
                    <p className="text-xs text-gray-500">Build SOQL queries</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-green-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium">Apex Runner</p>
                    <p className="text-xs text-gray-500">Execute Apex code</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-purple-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Copy className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                    <p className="text-sm font-medium">Record Cloner</p>
                    <p className="text-xs text-gray-500">Clone test data</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-amber-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                    <p className="text-sm font-medium">Validation Rules</p>
                    <p className="text-xs text-gray-500">View active rules</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========== SF CONTEXT TAB ========== */}
          <TabsContent value="sfcontext" className="flex-1 m-0 overflow-hidden">
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
                className="h-full"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4 h-full">
                <div className="text-center">
                  <Target className="h-12 w-12 mx-auto mb-3 text-purple-400 opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">SF Context</h3>
                  <p className="text-sm text-gray-400">
                    Navigate to a Salesforce page to see context-aware suggestions
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Test Case Picker Dialog - Scalable with Filters */}
      <Dialog open={showTestPicker} onOpenChange={setShowTestPicker}>
        <DialogContent className="max-w-4xl max-h-[80vh] bg-[#12121a] border-white/10">
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
          <div className="grid grid-cols-5 gap-3 pb-4 border-b border-white/10">
            {/* Search */}
            <div className="col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Search by name, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-[#1a1a25] border-white/10 text-white"
                />
              </div>
            </div>
            
            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="bg-[#1a1a25] border-white/10 text-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="manual">Manual Only</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="automated">Automated</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Folder Filter */}
            <Select value={folderFilter} onValueChange={setFolderFilter}>
              <SelectTrigger className="bg-[#1a1a25] border-white/10 text-white">
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Folders</SelectItem>
                {folders.map(folder => (
                  <SelectItem key={folder.id} value={folder.id}>
                    <span className="flex items-center gap-2">
                      <Folder className="h-3 w-3" />
                      {folder.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Tag Filter */}
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="bg-[#1a1a25] border-white/10 text-white">
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
              <SelectContent className="bg-[#1a1a25] border-white/10">
                <SelectItem value="all">All Tags</SelectItem>
                {allTags.map(tag => (
                  <SelectItem key={tag} value={tag}>
                    <span className="flex items-center gap-2">
                      <Tag className="h-3 w-3" />
                      {tag}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          {/* Test Case List */}
          <ScrollArea className="h-[400px]">
            {paginatedTestCases.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No test cases found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
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
                      "p-4 rounded-lg border cursor-pointer transition-all",
                      "hover:border-purple-500 hover:bg-white/5",
                      selectedTestCase?.id === tc.id
                        ? "border-purple-500 bg-purple-500/10"
                        : "border-white/10 bg-white/5"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-white">{tc.name || tc.title}</div>
                        {tc.description && (
                          <div className="text-sm text-gray-400 mt-1 line-clamp-1">
                            {tc.description}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="text-xs border-white/20">
                            {tc.steps?.length || 0} steps
                          </Badge>
                          {tc.folderId && (
                            <Badge variant="outline" className="text-xs border-white/20">
                              <Folder className="h-3 w-3 mr-1" />
                              {folders.find(f => f.id === tc.folderId)?.name || 'Folder'}
                            </Badge>
                          )}
                          {(tc.tags || []).slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs border-white/20">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        {getStatusBadge(tc.automationStatus)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-white/10">
              <div className="text-sm text-gray-400">
                Page {currentPage} of {totalPages} ({filteredTestCases.length} results)
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="border-white/20"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="border-white/20"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowTestPicker(false)}
              className="border-white/20"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
