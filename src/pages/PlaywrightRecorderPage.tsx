/**
 * Playwright Recorder Page - Full Featured UI
 * 
 * Matches the original design with:
 * - Top toolbar: Settings, Code, Run, Builder, Export
 * - Left: Recorded Steps list
 * - Right: Suggestions panel with SF Tools and SF Context tabs
 * - Auto-loading suggestions during recording
 * - Play/Execute and Add buttons for each suggestion
 */

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Play, Square, Pause, Trash2, Download, ExternalLink, Save,
  CheckCircle, Video, Globe, Search, Filter, Loader2,
  Folder, Tag, ChevronDown, ChevronRight, Settings, Code,
  Zap, FileText, Merge, RotateCcw, X, Sparkles,
  AlertCircle, Check, Layers, RefreshCw, Lightbulb,
  MousePointer, Keyboard, Eye, Target, Cloud, Link,
  Hash, Type, CircleDot, FormInput, Database, Copy,
  Shield, Wand2, CheckSquare, Plus, Circle, Hand,
  PenLine, LayoutGrid, ArrowRight, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { SoqlEditor } from "@/components/SoqlEditor";
import { salesforceApi } from "@/lib/salesforce-api";
// New SF Components
import { SFContextDashboard } from "@/components/salesforce/SFContextDashboard";
import { SmartSOQLBuilder } from "@/components/salesforce/SmartSOQLBuilder";
import { MetadataAssertions } from "@/components/salesforce/MetadataAssertions";
import { StageTransitionTester } from "@/components/salesforce/StageTransitionTester";

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
  count?: number; // For "X FOUND" badge
}

interface SuggestResult {
  suggestions: Suggestion[];
  categories: Record<string, Suggestion[]>;
  counts: Record<string, number>;
  timing: string;
  total: number;
}

interface TestCase {
  id: string;
  name: string;
  title?: string;
  description?: string;
  steps: any[];
  folderId?: string;
  tags?: string[];
  automationStatus?: 'none' | 'partial' | 'full';
}

// Check if running in Electron
const isElectron = () => !!(window as any).flowstral?.playwrightRecorder || !!(window as any).electronAPI;

// Helper to detect password-related fields
const isPasswordField = (action: RecordedAction): boolean => {
  const qword = (action.qword || '').toLowerCase();
  const arg0 = (action.args?.[0] || '').toLowerCase();
  const desc = (action.description || '').toLowerCase();
  const selector = JSON.stringify(action.selectorObj || {}).toLowerCase();
  
  // Check if this is a fill/input action on a password field
  const isInputAction = ['fill', 'type', 'input'].includes(qword);
  const hasPasswordIndicator = 
    /password|passwd|pwd|^pw$|secret|token|pin/i.test(arg0) ||
    /password|passwd|pwd|secret|token|pin/i.test(desc) ||
    /type="password"|type='password'|inputtype.*password/i.test(selector) ||
    action.type === 'password';
  
  return isInputAction && hasPasswordIndicator;
};

// Helper to detect garbled/corrupted characters from password encoding
const hasPasswordArtifacts = (str: string): boolean => {
  if (!str) return false;
  // Detect UTF-8 encoding artifacts common in password recording
  return /[āã口¢Γ¡¥©®°±²³µ¶¹º¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ]/.test(str) ||
         /[\u0100-\u024F]/.test(str) || // Extended Latin characters
         str.includes('ã') ||
         str.includes('Γ');
};

// Helper to mask sensitive values and fix corrupted characters
const maskSensitiveAction = (action: RecordedAction): RecordedAction => {
  const isPwField = isPasswordField(action);
  const hasArtifacts = hasPasswordArtifacts(action.args?.[1] || '') || 
                       hasPasswordArtifacts(action.description || '');
  
  // If not a password field and no artifacts, return as-is
  if (!isPwField && !hasArtifacts) return action;
  
  // Mask the password value in args[1] and description
  const maskedArgs = [...(action.args || [])];
  if (maskedArgs[1]) {
    maskedArgs[1] = '••••••••';
  }
  
  // Build a clean description
  let maskedDesc = action.description || '';
  
  // Strategy 1: Replace any quoted values after the field name with mask
  maskedDesc = maskedDesc.replace(/["'][^"']+["']/g, (match, offset) => {
    // Only mask values after the field name (typically after offset 10)
    if (offset > 8) return `"••••••••"`;
    return match;
  });
  
  // Strategy 2: For "Type X" or "Fill field: X" patterns, mask the value part
  // Match patterns like "Type Tenet@123" -> "Type ••••••••"
  if (isPwField || hasArtifacts) {
    // Pattern: "Type <value>" without quotes
    maskedDesc = maskedDesc.replace(/^(Type|Fill|Input)\s+([^"'\s:]+)$/i, '$1 ••••••••');
    // Pattern: "Type '<value>'" or 'Fill "<value>"'
    maskedDesc = maskedDesc.replace(/^(Type|Fill|Input)\s+["']([^"']+)["']$/i, '$1 "••••••••"');
    // Pattern: "Fill 'field': <value>" without quotes on value
    maskedDesc = maskedDesc.replace(/^(Fill|Type)\s+["']([^"']+)["']:\s+(\S+)$/i, '$1 "$2": "••••••••"');
    // Pattern: "Type "value" into field"
    maskedDesc = maskedDesc.replace(/(into\s+\w+)$/i, '••••••••" $1');
    
    // Fallback: If description still has artifacts, fully rebuild it
    if (hasPasswordArtifacts(maskedDesc)) {
      const fieldName = action.args?.[0] || 'password';
      maskedDesc = `Fill "${fieldName}": "••••••••"`;
    }
  }
  
  return {
    ...action,
    args: maskedArgs,
    displayArgs: maskedArgs,
    description: maskedDesc
  };
};

// Helper to detect and clean corrupted UTF-8 characters
const hasCorruptedChars = (str: string): boolean => {
  if (!str) return false;
  return /[āã口¢Γ]/.test(str);
};

const cleanCorruptedString = (str: string, isPassword: boolean): string => {
  if (!str) return str;
  if (hasCorruptedChars(str) || isPassword) {
    return '••••••••';
  }
  return str;
};

export default function PlaywrightRecorderPage() {
  const navigate = useNavigate();
  
  // Recording state
  const [url, setUrl] = useState("https://orgfarm-bac28d1362-dev-ed.develop.my.salesforce.com/");
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
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['fill', 'click', 'link', 'heading']));
  
  // Right panel tab state
  const [rightPanelTab, setRightPanelTab] = useState<string>('suggestions');
  
  // SF Tools sub-tab state
  const [sfToolsSubTab, setSfToolsSubTab] = useState<string>('soql');
  
  // Mode state
  const [mode, setMode] = useState<'new' | 'existing'>('new');
  const [showTestPicker, setShowTestPicker] = useState(false);
  const [selectedTestCase, setSelectedTestCase] = useState<TestCase | null>(null);
  const [allTestCases, setAllTestCases] = useState<TestCase[]>([]);
  const [allFolders, setAllFolders] = useState<{ id: string; name: string }[]>([]);
  
  // Test Picker filters (Enterprise scale)
  const [testSearchQuery, setTestSearchQuery] = useState('');
  const [testStatusFilter, setTestStatusFilter] = useState<'all' | 'none' | 'partial' | 'full'>('all');
  const [testFolderFilter, setTestFolderFilter] = useState<string>('all');
  const [testTagFilter, setTestTagFilter] = useState<string>('all');
  const [testPage, setTestPage] = useState(1);
  const TESTS_PER_PAGE = 50;
  
  // Merge preview state
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [mergedSteps, setMergedSteps] = useState<any[]>([]);
  
  // Test execution state
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [testExecutionResult, setTestExecutionResult] = useState<{
    status: 'running' | 'passed' | 'failed';
    currentStep: number;
    stepResults: { index: number; status: string; error?: string; screenshot?: string }[];
    totalSteps: number;
    error?: string;
    selectedScreenshot?: string;
  } | null>(null);
  
  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // SF Tools customization dialog
  const [showSFToolDialog, setShowSFToolDialog] = useState(false);
  const [sfToolType, setSfToolType] = useState<'soql' | 'apex' | 'clone' | 'validation' | 'api' | 'datafactory' | 'permission' | 'flow' | 'inspect' | 'schema' | 'diff' | 'bulkinsert' | null>(null);
  const [sfToolInput, setSfToolInput] = useState('');
  const [sfToolInput2, setSfToolInput2] = useState('');
  const [sfToolInput3, setSfToolInput3] = useState('');
  
  // Rich SOQL Editor state
  const [soqlQuery, setSoqlQuery] = useState('SELECT Id, Name FROM Account LIMIT 10');
  const [soqlResults, setSoqlResults] = useState<any[]>([]);
  const [soqlColumns, setSoqlColumns] = useState<string[]>([]);
  const [soqlError, setSoqlError] = useState<string | null>(null);
  const [isQueryLoading, setIsQueryLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useState<Array<{ query: string; timestamp: string }>>([]);
  const [sfObjects, setSfObjects] = useState<Array<{ name: string; label: string }>>([]);
  const [showSoqlPanel, setShowSoqlPanel] = useState(false);
  
  // Record Inspector state
  const [inspectRecordId, setInspectRecordId] = useState('');
  const [inspectedRecord, setInspectedRecord] = useState<any>(null);
  const [inspectObjectType, setInspectObjectType] = useState('');
  
  // Drag and drop for steps reordering
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Selected action for keyboard shortcuts
  const [selectedActionIndex, setSelectedActionIndex] = useState<number | null>(null);
  
  // Clipboard for action copy/paste
  const [actionClipboard, setActionClipboard] = useState<RecordedAction[] | null>(null);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Keyboard shortcuts for recorded actions (Delete, Ctrl+C, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete key - delete selected action
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedActionIndex !== null) {
        e.preventDefault();
        const actionName = actions[selectedActionIndex]?.description || 'action';
        setActions(prev => prev.filter((_, i) => i !== selectedActionIndex));
        setSelectedActionIndex(null);
        toast.success(`Deleted: ${actionName}`);
      }
      
      // Ctrl+C / Cmd+C - Copy selected action
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedActionIndex !== null) {
        e.preventDefault();
        const actionToCopy = actions[selectedActionIndex];
        if (actionToCopy) {
          setActionClipboard([actionToCopy]);
          toast.success(`Copied: ${actionToCopy.description || actionToCopy.qword}`);
        }
      }
      
      // Ctrl+V / Cmd+V - Paste action(s)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && actionClipboard && actionClipboard.length > 0) {
        e.preventDefault();
        const timestamp = Date.now();
        const newActions = actionClipboard.map((action, idx) => ({
          ...action,
          id: `action_${timestamp}_${idx}`,
          description: `${action.description || action.qword} (Copy)`,
          timestamp: timestamp + idx,
        }));
        
        // Insert after selected action, or at end
        setActions(prev => {
          const insertIndex = selectedActionIndex !== null ? selectedActionIndex + 1 : prev.length;
          const newList = [...prev];
          newList.splice(insertIndex, 0, ...newActions);
          return newList;
        });
        toast.success(`Pasted ${newActions.length} action(s)`);
      }
      
      // Ctrl+D / Cmd+D - Duplicate selected action
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedActionIndex !== null) {
        e.preventDefault();
        const actionToDuplicate = actions[selectedActionIndex];
        if (actionToDuplicate) {
          const newAction = {
            ...actionToDuplicate,
            id: `action_${Date.now()}`,
            description: `${actionToDuplicate.description || actionToDuplicate.qword} (Copy)`,
            timestamp: Date.now(),
          };
          setActions(prev => {
            const newList = [...prev];
            newList.splice(selectedActionIndex + 1, 0, newAction);
            return newList;
          });
          setSelectedActionIndex(selectedActionIndex + 1);
          toast.success('Action duplicated');
        }
      }
      
      // Arrow keys to navigate actions
      if (e.key === 'ArrowUp' && selectedActionIndex !== null && selectedActionIndex > 0) {
        e.preventDefault();
        setSelectedActionIndex(selectedActionIndex - 1);
      }
      if (e.key === 'ArrowDown' && selectedActionIndex !== null && selectedActionIndex < actions.length - 1) {
        e.preventDefault();
        setSelectedActionIndex(selectedActionIndex + 1);
      }
      
      // Escape - Deselect action
      if (e.key === 'Escape') {
        setSelectedActionIndex(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedActionIndex, actionClipboard, actions]);

  // Auto-refresh suggestions during recording (with debounce to prevent blinking)
  const lastSuggestionsRef = useRef<string>('');
  
  useEffect(() => {
    if (isRecording && !isPaused) {
      // Initial fetch after a short delay
      const initialTimeout = setTimeout(() => {
        handleRefreshSuggestions();
      }, 500);
      
      // Refresh every 5 seconds during recording (longer interval to reduce blinking)
      suggestIntervalRef.current = setInterval(() => {
        handleRefreshSuggestions();
      }, 5000);
      
      return () => {
        clearTimeout(initialTimeout);
        if (suggestIntervalRef.current) clearInterval(suggestIntervalRef.current);
      };
    } else {
      if (suggestIntervalRef.current) {
        clearInterval(suggestIntervalRef.current);
        suggestIntervalRef.current = null;
      }
    }
    return () => {
      if (suggestIntervalRef.current) clearInterval(suggestIntervalRef.current);
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Load test data on mount
  useEffect(() => {
    const loadTestData = async () => {
      try {
        // Try SQLite first (electron)
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.localStorage?.getAllTestCases) {
          const cases = await electronAPI.localStorage.getAllTestCases();
          if (cases?.length > 0) {
            setAllTestCases(cases);
            // Extract unique folders
            const folders = new Map<string, string>();
            cases.forEach((tc: any) => {
              if (tc.folderId && tc.folderName) {
                folders.set(tc.folderId, tc.folderName);
              }
            });
            setAllFolders(Array.from(folders.entries()).map(([id, name]) => ({ id, name })));
            return;
          }
        }
        
        // Fallback to localStorage
        const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
        const allCases = [...localCases];
        flowstralCases.forEach((tc: TestCase) => {
          if (!allCases.some(c => c.id === tc.id)) allCases.push(tc);
        });
        setAllTestCases(allCases);
        
        // Extract folders from localStorage
        const localFolders = JSON.parse(localStorage.getItem('test_folders') || '[]');
        setAllFolders(localFolders);
    } catch (error) {
        console.error('[Recorder] Failed to load test data:', error);
    }
    };
    loadTestData();
  }, []);

  // Filtered and paginated test cases (Enterprise scale)
  const filteredTestCases = useMemo(() => {
    let filtered = allTestCases;
    
    // Search filter
    if (testSearchQuery.trim()) {
      const query = testSearchQuery.toLowerCase();
      filtered = filtered.filter(tc => 
        tc.name?.toLowerCase().includes(query) ||
        tc.id?.toLowerCase().includes(query) ||
        tc.description?.toLowerCase().includes(query) ||
        tc.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    
    // Status filter
    if (testStatusFilter !== 'all') {
      filtered = filtered.filter(tc => {
        const status = tc.automationStatus || 
          (tc.steps?.some((s: any) => s.qword || s.selector) ? 
            (tc.steps.every((s: any) => s.qword || s.selector) ? 'full' : 'partial') : 'none');
        return status === testStatusFilter;
      });
    }
    
    // Folder filter
    if (testFolderFilter !== 'all') {
      if (testFolderFilter === 'orphan') {
        filtered = filtered.filter(tc => !tc.folderId);
      } else {
        filtered = filtered.filter(tc => tc.folderId === testFolderFilter);
      }
    }
    
    // Tag filter
    if (testTagFilter !== 'all') {
      filtered = filtered.filter(tc => tc.tags?.includes(testTagFilter));
    }
    
    return filtered;
  }, [allTestCases, testSearchQuery, testStatusFilter, testFolderFilter, testTagFilter]);

  const paginatedTestCases = useMemo(() => {
    const start = (testPage - 1) * TESTS_PER_PAGE;
    return filteredTestCases.slice(start, start + TESTS_PER_PAGE);
  }, [filteredTestCases, testPage]);

  const totalTestPages = Math.ceil(filteredTestCases.length / TESTS_PER_PAGE);

  // All unique tags from test cases
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    allTestCases.forEach(tc => tc.tags?.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [allTestCases]);

  // Reset page when filters change
  useEffect(() => {
    setTestPage(1);
  }, [testSearchQuery, testStatusFilter, testFolderFilter, testTagFilter]);

  // Position-based merge: Action N → Step N
  const performMerge = useCallback(() => {
    if (!selectedTestCase || actions.length === 0) return;
    
    const manualSteps = selectedTestCase.steps || [];
    const maxLength = Math.max(manualSteps.length, actions.length);
    const merged: any[] = [];
    
    for (let i = 0; i < maxLength; i++) {
      const manualStep = manualSteps[i];
      const recordedAction = actions[i];
      
      if (manualStep && recordedAction) {
        // Both exist: merge automation into manual step
        merged.push({
          ...manualStep,
          qword: recordedAction.qword,
          args: recordedAction.args,
          selector: recordedAction.selectorObj?.selector,
          selectorObj: recordedAction.selectorObj,
          automationStatus: 'automated',
          _merged: true
        });
      } else if (manualStep) {
        // Only manual step exists
        merged.push({
          ...manualStep,
          automationStatus: manualStep.qword ? 'automated' : 'manual',
          _manualOnly: !manualStep.qword
        });
      } else if (recordedAction) {
        // Only recorded action exists (extra automation)
        merged.push({
          id: `step_${Date.now()}_${i}`,
          name: recordedAction.description || `${recordedAction.qword} ${recordedAction.args?.[0] || ''}`,
          description: recordedAction.description,
          qword: recordedAction.qword,
          args: recordedAction.args,
          selectorObj: recordedAction.selectorObj,
          automationStatus: 'automated',
          _extra: true
        });
      }
    }
    
    setMergedSteps(merged);
    setShowMergePreview(true);
  }, [selectedTestCase, actions]);

  // Save merged test case
  const saveMergedTest = async () => {
    if (!selectedTestCase || mergedSteps.length === 0) return;
    
    const automationStatus: 'none' | 'partial' | 'full' = mergedSteps.every(s => s.qword) ? 'full' : 
                        mergedSteps.some(s => s.qword) ? 'partial' : 'none';
    const updatedTestCase: TestCase = {
      ...selectedTestCase,
      steps: mergedSteps.map(s => {
        const { _merged, _manualOnly, _extra, ...step } = s;
        return step;
      }),
      automationStatus,
    };
    
    try {
      // Save to localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      const idx = localCases.findIndex((tc: any) => tc.id === updatedTestCase.id);
      if (idx >= 0) {
        localCases[idx] = updatedTestCase;
      } else {
        localCases.push(updatedTestCase);
      }
      localStorage.setItem('test_cases', JSON.stringify(localCases));
      
      // Update state
      setAllTestCases(prev => {
        const updated = [...prev];
        const i = updated.findIndex(tc => tc.id === updatedTestCase.id);
        if (i >= 0) updated[i] = updatedTestCase;
        return updated;
      });
      
      toast.success(`Merged ${mergedSteps.filter(s => s.qword).length} automated steps into "${selectedTestCase.name}"`);
      setShowMergePreview(false);
      setSelectedTestCase(null);
      setActions([]);
      setMode('new');
    } catch (error) {
      toast.error('Failed to save merged test');
    }
  };

  // Listen for actions from recorder
  useEffect(() => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;

    if (flowstral?.on) {
    const unsubAction = flowstral.on('playwright-recorder-action', (action: RecordedAction) => {
      setActions(prev => {
        if (prev.some(a => a.id === action.id)) return prev;
        return [...prev, action];
      });
    });

    const unsubStopped = flowstral.on('playwright-recorder-stopped', ({ actions: finalActions }: { actions: RecordedAction[] }) => {
      // Merge recorded actions with manually added ones (SF Tools, etc.)
      setActions(prev => {
        // Keep manually added actions (those with id starting with 'action_' - our manual prefix)
        // Recorded actions from playwright typically have different id format
        const manualActions = prev.filter(a => {
          const id = a.id || '';
          // Our manually added actions always start with 'action_' followed by timestamp
          return id.startsWith('action_') || id.startsWith('assert_');
        });
        
        // Get recorded actions, removing any that match manual ones by description
        const manualDescriptions = new Set(manualActions.map(a => a.description));
        const recordedOnly = (finalActions || []).filter(a => !manualDescriptions.has(a.description));
        
        // Combine: recorded actions + manually added (preserve order)
        if (recordedOnly.length > 0 || manualActions.length > 0) {
          return [...recordedOnly, ...manualActions];
        }
        return prev;
      });
      setIsRecording(false);
      setIsPaused(false);
    });

      flowstral.playwrightRecorder?.isRecording?.().then((recording: boolean) => {
      setIsRecording(recording);
      if (recording) {
        flowstral.playwrightRecorder.getActions().then((acts: RecordedAction[]) => {
          if (acts?.length > 0) setActions(acts);
        });
      }
    });

      return () => { unsubAction?.(); unsubStopped?.(); };
    }
    
    if (electronAPI?.on) {
      const unsubAction = electronAPI.on('action-recorded', (action: RecordedAction) => {
        setActions(prev => [...prev, action]);
      });
      const unsubUrl = electronAPI.on('browser-url-changed', (newUrl: string) => {
        setCurrentUrl(newUrl);
        if (newUrl.startsWith('http')) setUrl(newUrl);
      });
      return () => { unsubAction?.(); unsubUrl?.(); };
    }
  }, []);

  // Handle suggestions refresh
  const handleRefreshSuggestions = async () => {
    const electronAPI = (window as any).electronAPI;
    const flowstral = (window as any).flowstral;
    
    setIsLoadingSuggestions(true);
    
    try {
      let result: SuggestResult | null = null;
      let rawResponse: any = null;
      
      // Try multiple APIs to get suggestions
      if (flowstral?.playwrightRecorder?.analyze) {
        console.log('[Recorder] Calling flowstral.playwrightRecorder.analyze');
        rawResponse = await flowstral.playwrightRecorder.analyze();
        console.log('[Recorder] analyze() response:', rawResponse);
      } else if (electronAPI?.suggestActions) {
        console.log('[Recorder] Calling electronAPI.suggestActions');
        rawResponse = await electronAPI.suggestActions();
      } else if (electronAPI?.getPageElements) {
        console.log('[Recorder] Calling electronAPI.getPageElements');
        rawResponse = await electronAPI.getPageElements();
      }
      
      // Convert raw response to SuggestResult format
      if (rawResponse) {
        // Handle { success: true, suggestions: [...] } format from analyze()
        if (rawResponse.suggestions && Array.isArray(rawResponse.suggestions)) {
          result = convertAnalyzeToSuggestResult(rawResponse.suggestions);
        } 
        // Handle direct array format
        else if (Array.isArray(rawResponse)) {
          result = convertAnalyzeToSuggestResult(rawResponse);
        }
        // Handle elements format { buttons: [...], inputs: [...] }
        else if (rawResponse.buttons || rawResponse.inputs || rawResponse.links) {
          result = convertElementsToSuggestions(rawResponse);
        }
      }
      
      if (result && result.suggestions?.length > 0) {
        console.log('[Recorder] Got suggestions:', result.suggestions.length);
        // Only update if suggestions actually changed (prevents blinking)
        const newKey = result.suggestions.map(s => s.element || s.description).join('|');
        if (newKey !== lastSuggestionsRef.current) {
          lastSuggestionsRef.current = newKey;
          setSuggestResult(result);
        }
      } else if (!suggestResult?.suggestions?.length) {
        // Only set empty if we don't already have suggestions
        console.log('[Recorder] No suggestions returned or empty');
        setSuggestResult({ suggestions: [], categories: {}, counts: {}, timing: 'now', total: 0 });
      }
    } catch (error) {
      console.error('[Recorder] Failed to get suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Convert analyze() response (from PlaywrightRecorder) to SuggestResult format
  const convertAnalyzeToSuggestResult = (suggestions: any[]): SuggestResult => {
    const result: Suggestion[] = [];
    const counts: Record<string, number> = { buttons: 0, links: 0, inputs: 0, headings: 0 };
    
    console.log('[Recorder] Converting', suggestions.length, 'raw suggestions');
    
    suggestions.forEach((s, idx) => {
      const type = (s.type || '').toLowerCase();
      const label = s.label || s.text || s.description || s.element || '';
      
      // Debug first few
      if (idx < 3) {
        console.log('[Recorder] Raw suggestion', idx, ':', { type: s.type, label, isInput: s.isInput, isButton: s.isButton, isLink: s.isLink, tag: s.tag });
      }
      
      // Categorize based on multiple indicators
      let category = 'button'; // Default
      let qword = 'Click';
      
      // Input fields
      if (type === 'fill' || type === 'input' || s.isInput || s.tag === 'INPUT' || s.tag === 'TEXTAREA') {
        category = 'input';
        qword = 'Fill';
        counts.inputs++;
      }
      // Links
      else if (type === 'link' || s.isLink || s.tag === 'A' || s.selector?.includes('link') || s.selector?.includes('href')) {
        category = 'link';
        qword = 'Click';
        counts.links++;
      }
      // Headings
      else if (s.tag?.match(/^H[1-6]$/) || s.isHeading || type === 'heading') {
        category = 'heading';
        qword = 'AssertText';
        counts.headings++;
      }
      // Buttons (default for clicks)
      else if (type === 'click' || type === 'button' || s.isButton || s.tag === 'BUTTON') {
        category = 'button';
        qword = 'Click';
        counts.buttons++;
      }
      // Default to button
      else {
        category = 'button';
        qword = 'Click';
        counts.buttons++;
      }
      
      result.push({
        type: s.type || 'click',
        qword,
        args: [label, s.selector || ''],
        description: s.description || label,
        element: label,
        category, // This is the key field for grouping!
        selector: s.selector,
        selectorObj: s.selectorObj || { selector: s.selector },
        count: s.duplicateCount || s.count || 1
      });
    });
    
    console.log('[Recorder] Converted to', result.length, 'suggestions. Counts:', counts);
    
    return {
      suggestions: result,
      categories: {},
      counts,
      timing: 'now',
      total: result.length
    };
  };

  // Convert raw page elements to suggestion format
  const convertElementsToSuggestions = (elements: any): SuggestResult => {
    const suggestions: Suggestion[] = [];
    const counts: Record<string, number> = { buttons: 0, links: 0, inputs: 0, headings: 0 };
    
    // Process buttons
    if (elements.buttons) {
      elements.buttons.forEach((btn: any) => {
        suggestions.push({
          type: 'click',
          qword: 'Click',
          args: [btn.text || btn.label || 'Button'],
          description: btn.text || btn.label || 'Button',
          element: btn.text || btn.label || 'Button',
          category: 'button',
          selector: btn.selector,
          selectorObj: btn.selectorObj,
          count: btn.count
        });
        counts.buttons++;
      });
    }
    
    // Process links
    if (elements.links) {
      elements.links.forEach((link: any) => {
        suggestions.push({
          type: 'click',
          qword: 'Click',
          args: [link.text || link.href || 'Link'],
          description: link.text || 'Link',
          element: link.text || link.href || 'Link',
          category: 'link',
          selector: link.selector,
          selectorObj: link.selectorObj,
          count: link.count
        });
        counts.links++;
      });
    }
    
    // Process inputs
    if (elements.inputs) {
      elements.inputs.forEach((input: any) => {
        suggestions.push({
          type: 'fill',
          qword: 'Fill',
          args: [input.name || input.placeholder || input.label || 'Input', ''],
          description: input.name || input.placeholder || input.label || 'Input field',
          element: input.name || input.placeholder || input.label || 'Input',
          category: 'input',
          selector: input.selector,
          selectorObj: input.selectorObj,
          count: input.count
        });
        counts.inputs++;
      });
    }
    
    // Process headings
    if (elements.headings) {
      elements.headings.forEach((h: any) => {
        suggestions.push({
          type: 'assertText',
          qword: 'AssertText',
          args: [h.text || 'Heading'],
          description: h.text || 'Heading',
          element: h.text || 'Heading',
          category: 'heading',
          selector: h.selector,
          selectorObj: h.selectorObj,
          count: h.count
        });
        counts.headings++;
      });
    }
    
    return {
      suggestions,
      categories: {},
      counts,
      timing: 'now',
      total: suggestions.length
    };
  };

  // Group suggestions by type
  const groupedSuggestions = useMemo(() => {
    if (!suggestResult?.suggestions || suggestResult.suggestions.length === 0) {
      console.log('[Recorder] No suggestions to group');
      return { fill: [], click: [], link: [], heading: [], other: [] };
    }
    
    console.log('[Recorder] Grouping', suggestResult.suggestions.length, 'suggestions');
    
    const groups: Record<string, Suggestion[]> = {
      fill: [],
      click: [],
      link: [],
      heading: [],
      other: []
    };
    
    suggestResult.suggestions.forEach(s => {
      const qword = (s.qword || s.type || '').toLowerCase();
      const category = (s.category || '').toLowerCase();
      const type = (s.type || '').toLowerCase();
      
      // More flexible grouping logic
      if (qword === 'fill' || type === 'fill' || category === 'input' || category.includes('input')) {
        groups.fill.push(s);
      } else if (category === 'button' || category.includes('button') || type === 'button') {
        groups.click.push(s);
      } else if (category === 'link' || category.includes('link') || type === 'link') {
        groups.link.push(s);
      } else if (category === 'heading' || category.includes('heading') || type === 'heading') {
        groups.heading.push(s);
      } else if (qword.includes('click') || type === 'click') {
        // Default clicks to buttons
        groups.click.push(s);
      } else {
        groups.other.push(s);
      }
    });
    
    console.log('[Recorder] Grouped - fill:', groups.fill.length, 'click:', groups.click.length, 'link:', groups.link.length, 'heading:', groups.heading.length, 'other:', groups.other.length);
    
    // Apply search filter
    if (suggestionSearch.trim()) {
      const query = suggestionSearch.toLowerCase();
      Object.keys(groups).forEach(key => {
        groups[key] = groups[key].filter(s => 
          s.description?.toLowerCase().includes(query) ||
          s.element?.toLowerCase().includes(query) ||
          s.args?.some(a => a?.toLowerCase().includes(query))
        );
      });
    }
    
    return groups;
  }, [suggestResult, suggestionSearch]);

  // Category counts - use API counts if available, otherwise count from grouped
  const categoryCounts = useMemo(() => {
    if (suggestResult?.counts) {
      return {
        buttons: suggestResult.counts.buttons || suggestResult.counts.button || groupedSuggestions.click?.length || 0,
        links: suggestResult.counts.links || suggestResult.counts.link || groupedSuggestions.link?.length || 0,
        inputs: suggestResult.counts.inputs || suggestResult.counts.input || groupedSuggestions.fill?.length || 0,
        headings: suggestResult.counts.headings || suggestResult.counts.heading || groupedSuggestions.heading?.length || 0,
      };
    }
    return {
      buttons: groupedSuggestions.click?.length || 0,
      links: groupedSuggestions.link?.length || 0,
      inputs: groupedSuggestions.fill?.length || 0,
      headings: groupedSuggestions.heading?.length || 0,
    };
  }, [groupedSuggestions, suggestResult]);

  const totalSuggestions = useMemo(() => {
    const total = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
    console.log('[Recorder] totalSuggestions:', total, 'from categoryCounts:', categoryCounts);
    return total;
  }, [categoryCounts]);

  // Execute action on page (requires active recording session)
  const executeAction = async (suggestion: Suggestion) => {
    const electronAPI = (window as any).electronAPI;
    const flowstral = (window as any).flowstral;
    
    // Check if recording is active first
    if (!isRecording) {
      toast.error('Start recording first to execute actions', { id: 'exec', duration: 3000 });
      return;
    }
    
    try {
      toast.loading('Executing...', { id: 'exec' });
      
      let result;
      if (flowstral?.playwrightRecorder?.executeAction) {
        result = await flowstral.playwrightRecorder.executeAction({
          type: suggestion.type || suggestion.qword,
          qword: suggestion.qword,
          args: suggestion.args,
          label: suggestion.args?.[0],
          selector: suggestion.selector,
          selectorObj: suggestion.selectorObj
        });
      } else if (electronAPI?.executeAction) {
        result = await electronAPI.executeAction({
          qword: suggestion.qword,
          args: suggestion.args,
          selector: suggestion.selector,
          selectorObj: suggestion.selectorObj
        });
      }
      
      if (result?.success !== false) {
        toast.success('Done!', { id: 'exec' });
      } else {
        const errorMsg = result?.error || 'Failed';
        // Provide more helpful error messages
        if (errorMsg.toLowerCase().includes('no browser')) {
          toast.error('Browser not active. Start recording first.', { id: 'exec', duration: 3000 });
        } else {
          toast.error(errorMsg, { id: 'exec' });
        }
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to execute';
      if (msg.toLowerCase().includes('no browser')) {
        toast.error('Browser not active. Start recording first.', { id: 'exec', duration: 3000 });
      } else {
        toast.error(msg, { id: 'exec' });
      }
    }
  };

  // Add suggestion to test
  const addToTest = (suggestion: Suggestion) => {
    const newAction: RecordedAction = {
      id: `action_${Date.now()}`,
      qword: suggestion.qword,
      args: suggestion.args,
      description: suggestion.description,
      timestamp: Date.now(),
      selectorObj: suggestion.selectorObj
    };
    setActions(prev => [...prev, newAction]);
    toast.success('Added to test steps', { duration: 1500 });
  };

  const handleStartRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (!flowstral?.playwrightRecorder && !electronAPI?.startRecording) {
      toast.error("Recorder not available");
      return;
    }

    if (!url || !url.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsStarting(true);
    setActions([]);
    setRecordingTime(0);

    try {
      let result;
      if (flowstral?.playwrightRecorder) {
        result = await flowstral.playwrightRecorder.start(url);
      } else if (electronAPI?.startRecording) {
        await electronAPI.navigateEmbeddedBrowser?.(url);
        result = await electronAPI.startRecording();
      }
      
      if (result?.success !== false) {
        setIsRecording(true);
        setIsPaused(false);
        setCurrentUrl(url);
        toast.success("Recording started!");
      } else {
        toast.error(result?.error || "Failed to start");
      }
    } catch (error: any) {
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
      
      // Merge recorded actions with manually added ones (SF Tools, navigation, etc.)
      const recordedActions = result?.actions || result;
      if (Array.isArray(recordedActions)) {
        setActions(prev => {
          // Keep manually added actions (those with id starting with 'action_' or 'assert_')
          const manualActions = prev.filter(a => {
            const id = a.id || '';
            return id.startsWith('action_') || id.startsWith('assert_');
          });
          
          if (manualActions.length === 0) {
            // No manual actions to preserve, just use recorded
            return recordedActions.length > 0 ? recordedActions : prev;
          }
          
          // Remove duplicates from recorded (by description)
          const manualDescriptions = new Set(manualActions.map(a => a.description));
          const recordedOnly = recordedActions.filter(a => !manualDescriptions.has(a.description));
          
          // Combine: recorded actions first, then manual actions (SF Tools, etc.)
          console.log(`[Recorder] Merging ${recordedOnly.length} recorded + ${manualActions.length} manual actions`);
          return [...recordedOnly, ...manualActions];
        });
      }
      toast.success(`Recording stopped - ${actions.length} actions`);
    } catch (error) {
      toast.error("Failed to stop recording");
    }
  };

  const handleClearActions = () => {
    setActions([]);
    (window as any).flowstral?.playwrightRecorder?.clearActions?.();
    (window as any).electronAPI?.clearActions?.();
    toast.info("Cleared");
  };

  // Drag and drop handlers for reordering steps
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newActions = [...actions];
      const [draggedItem] = newActions.splice(draggedIndex, 1);
      newActions.splice(dragOverIndex, 0, draggedItem);
      setActions(newActions);
      toast.success(`Step moved to position ${dragOverIndex + 1}`);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handlePauseResume = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    try {
      if (isPaused) {
        // Resume
        if (flowstral?.playwrightRecorder?.resume) {
          await flowstral.playwrightRecorder.resume();
        } else if (electronAPI?.resumeRecording) {
          await electronAPI.resumeRecording();
        }
        setIsPaused(false);
        toast.success("Recording resumed");
      } else {
        // Pause
        if (flowstral?.playwrightRecorder?.pause) {
          await flowstral.playwrightRecorder.pause();
        } else if (electronAPI?.pauseRecording) {
          await electronAPI.pauseRecording();
        }
        setIsPaused(true);
        toast.info("Recording paused - interact with app then resume");
      }
    } catch (error) {
      toast.error("Failed to pause/resume");
    }
  };

const handleExportToBuilder = async () => {
    if (actions.length === 0) {
      toast.error("No actions to export");
      return;
    }
    
    try {
      const electronAPI = (window as any).electronAPI;
      const flowstral = (window as any).flowstral;
      
      // Build a proper test case object with ALL actions
      const testCase = {
        id: `tc_${Date.now()}`,
        name: 'Recorded Test',
        description: `Recorded on ${new Date().toISOString()}`,
        steps: actions.map((action, idx) => {
          // Determine step type from qword
          let stepType = 'click';
          const qword = (action.qword || '').toLowerCase();
          if (qword.includes('goto') || qword.includes('navigate')) stepType = 'navigate';
          else if (qword.includes('fill') || qword.includes('type') || qword.includes('input')) stepType = 'input';
          else if (qword.includes('select')) stepType = 'select';
          else if (qword.includes('assert')) stepType = 'assert';
          else if (qword.includes('wait')) stepType = 'wait';
          else if (qword.includes('click')) stepType = 'click';
          else if (qword.includes('hover')) stepType = 'hover';
          // For SF Tools, use custom type
          else if (['executesoql', 'executeapex', 'createtestdata', 'createrecord', 'clonerecord', 
                    'deleterecord', 'triggerflow', 'assertvalidation', 'assertfieldvalue',
                    'managepermissionset', 'runapextest', 'bulkload', 'runreport', 'restapicall'].includes(qword)) {
            stepType = 'custom';
          }
          
          return {
            id: action.id || `step_${Date.now()}_${idx}`,
            type: stepType,
            name: action.description || `${action.qword || 'Action'} ${action.args?.[0] || ''}`,
            url: stepType === 'navigate' ? (action.args?.[0] || action.url || '') : '',
            selector: action.selector || action.selectorObj?.selector || '',
            selectorObj: action.selectorObj,
            value: stepType === 'input' ? (action.args?.[1] || action.value || '') : '',
            qword: action.qword,  // CRITICAL: Preserve qword for execution
            args: action.args,   // CRITICAL: Preserve args for execution
            enabled: true,
            // Preserve password masking info
            isSensitive: action.isSensitive || /password|pw/i.test(action.args?.[0] || ''),
            inputType: action.inputType,
          };
        }),
        settings: {
          baseUrl: url || '',
        },
        metadata: { 
          source: 'playwright-recorder',
          createdAt: new Date().toISOString(),
        }
      };
      
      console.log('[Recorder] Exporting test case with', testCase.steps.length, 'steps');
      console.log('[Recorder] Steps:', testCase.steps.map(s => `${s.qword}: ${s.name}`));

      if (electronAPI?.exportToTestBuilder) {
        await electronAPI.exportToTestBuilder(testCase);
      } else if (flowstral?.export?.toTestBuilder) {
        await flowstral.export.toTestBuilder(testCase);
      } else {
        // Fallback: Save to localStorage and navigate
        localStorage.setItem('unified_test_case', JSON.stringify(testCase));
        localStorage.setItem('unified_test_case_timestamp', Date.now().toString());
        window.location.href = '/test-cases/builder';
      }
      toast.success(`Exported ${actions.length} steps to Builder!`);
    } catch (error) {
      console.error('[Recorder] Export failed:', error);
      toast.error("Failed to export");
    }
  };

  // Execute SOQL Query via Electron or Backend
  const executeSOQL = async () => {
    if (!soqlQuery.trim()) {
      toast.error("Enter a SOQL query");
      return;
    }
    
    setIsQueryLoading(true);
    setSoqlError(null);
    setSoqlResults([]);
    setSoqlColumns([]);
    
    try {
      const flowstral = (window as any).flowstral;
      const electronAPI = (window as any).electronAPI;
      
      let result;
      
      // Try Electron API first (uses browser session)
      if (flowstral?.playwrightRecorder?.executeSOQL) {
        result = await flowstral.playwrightRecorder.executeSOQL(soqlQuery);
      } else if (electronAPI?.executeSOQL) {
        result = await electronAPI.executeSOQL(soqlQuery);
      } else {
        // Fallback to backend
        const backendResult = await salesforceApi.query(soqlQuery);
        result = { success: true, records: backendResult.records };
      }
      
      if (result?.success && result.records) {
        setSoqlResults(result.records);
        // Extract columns from first record
        if (result.records.length > 0) {
          const cols = Object.keys(result.records[0]).filter(k => k !== 'attributes');
          setSoqlColumns(cols);
        }
        // Add to history
        setQueryHistory(prev => [
          { query: soqlQuery, timestamp: new Date().toISOString() },
          ...prev.slice(0, 19)
        ]);
        toast.success(`Query returned ${result.records.length} records`);
      } else {
        setSoqlError(result?.error || 'Query failed');
        toast.error(result?.error || 'Query failed');
      }
    } catch (error: any) {
      setSoqlError(error.message);
      toast.error(error.message);
    } finally {
      setIsQueryLoading(false);
    }
  };
  
  // Add SOQL assertion step using query results
  const addSOQLAssertionStep = (column: string, value: string, row: number) => {
    const action: RecordedAction = {
      id: `action_${Date.now()}`,
      qword: 'ExecuteSOQL',
      args: [soqlQuery, `${column}=${value}`, String(row)],
      description: `Query: Assert ${column} = "${value}"`,
      timestamp: Date.now()
    };
    setActions(prev => [...prev, action]);
    toast.success(`Added SOQL assertion for ${column}`);
  };
  
  // Inspect a Salesforce record
  const inspectRecord = async () => {
    if (!inspectRecordId) {
      toast.error("Enter a Record ID");
      return;
    }
    
    try {
      const flowstral = (window as any).flowstral;
      
      // Detect object type from ID prefix
      const prefix = inspectRecordId.substring(0, 3);
      const prefixMap: { [key: string]: string } = {
        '001': 'Account', '003': 'Contact', '00Q': 'Lead', '006': 'Opportunity',
        '500': 'Case', '00T': 'Task', '00U': 'Event', '005': 'User'
      };
      const objectType = inspectObjectType || prefixMap[prefix] || 'Account';
      
      if (flowstral?.playwrightRecorder?.inspectRecord) {
        const result = await flowstral.playwrightRecorder.inspectRecord(inspectRecordId, objectType);
        if (result?.success) {
          setInspectedRecord(result.record);
          toast.success(`Loaded ${objectType} record`);
        }
      } else {
        // Fallback to backend
        const record = await salesforceApi.getRecord(objectType, inspectRecordId);
        setInspectedRecord(record);
        toast.success(`Loaded ${objectType} record`);
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };
  
  // Add assertion from inspected record
  const addFieldAssertion = (field: string, value: any) => {
    const action: RecordedAction = {
      id: `action_${Date.now()}`,
      qword: 'AssertFieldValue',
      args: [field, String(value)],
      description: `Assert ${field} = "${value}"`,
      timestamp: Date.now()
    };
    setActions(prev => [...prev, action]);
    toast.success(`Added field assertion for ${field}`);
  };

  const handleExport = async (format: string) => {
    if (actions.length === 0) {
      toast.error("No actions to export");
      return;
    }
    
    const flowstral = (window as any).flowstral;
    const testName = `recorded_test_${Date.now()}`;
    
    try {
      let code = '';
      let filename = '';
      
      switch (format) {
        case 'playwright':
          code = generatePlaywrightCode(actions, url);
          filename = `${testName}.spec.ts`;
          break;
        case 'cypress':
          code = generateCypressCode(actions, url);
          filename = `${testName}.cy.js`;
          break;
        case 'selenium':
          code = generateSeleniumCode(actions, url);
          filename = `${testName}_test.py`;
          break;
        case 'robot':
          if (flowstral?.export?.robotFramework) {
            await flowstral.export.robotFramework(testName);
            toast.success("Exported to Robot Framework!");
            return;
          }
          code = generateRobotCode(actions, url);
          filename = `${testName}.robot`;
          break;
        case 'json':
          code = JSON.stringify({ name: testName, url, actions }, null, 2);
          filename = `${testName}.json`;
          break;
        case 'csv':
          code = actionsToCSV(actions);
          filename = `${testName}.csv`;
          break;
        default:
          return;
      }
      
      // Download the file
      const blob = new Blob([code], { type: 'text/plain' });
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(downloadUrl);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(`Failed to export as ${format}`);
    }
  };

  // Code generators
  const generatePlaywrightCode = (acts: RecordedAction[], startUrl: string) => {
    let code = `import { test, expect } from '@playwright/test';

test('Recorded Test', async ({ page }) => {
  await page.goto('${startUrl}');
`;
    acts.forEach(action => {
      const selector = action.selectorObj?.selector || action.args?.[1] || '';
      const value = action.args?.[1] || action.args?.[0] || '';
      switch (action.qword?.toLowerCase()) {
        case 'fill':
          code += `  await page.fill('${selector}', '${value}');\n`;
          break;
        case 'click':
        case 'clicktext':
          code += `  await page.click('${selector || `text=${action.args?.[0]}`}');\n`;
          break;
        case 'goto':
          code += `  await page.goto('${action.args?.[0]}');\n`;
          break;
        default:
          code += `  // ${action.description || action.qword}\n`;
      }
    });
    code += '});\n';
    return code;
  };

  const generateCypressCode = (acts: RecordedAction[], startUrl: string) => {
    let code = `describe('Recorded Test', () => {
  it('should complete the test flow', () => {
    cy.visit('${startUrl}');
`;
    acts.forEach(action => {
      const selector = action.selectorObj?.selector || action.args?.[1] || '';
      const value = action.args?.[1] || action.args?.[0] || '';
      switch (action.qword?.toLowerCase()) {
        case 'fill':
          code += `    cy.get('${selector}').type('${value}');\n`;
          break;
        case 'click':
        case 'clicktext':
          code += `    cy.${selector ? `get('${selector}')` : `contains('${action.args?.[0]}')`}.click();\n`;
          break;
        case 'goto':
          code += `    cy.visit('${action.args?.[0]}');\n`;
          break;
        default:
          code += `    // ${action.description || action.qword}\n`;
      }
    });
    code += `  });
});
`;
    return code;
  };

  const generateSeleniumCode = (acts: RecordedAction[], startUrl: string) => {
    let code = `from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

def test_recorded():
    driver = webdriver.Chrome()
    driver.get('${startUrl}')
    wait = WebDriverWait(driver, 10)
`;
    acts.forEach(action => {
      const selector = action.selectorObj?.selector || action.args?.[1] || '';
      const value = action.args?.[1] || action.args?.[0] || '';
      switch (action.qword?.toLowerCase()) {
        case 'fill':
          code += `    driver.find_element(By.CSS_SELECTOR, '${selector}').send_keys('${value}')\n`;
          break;
        case 'click':
        case 'clicktext':
          code += `    driver.find_element(By.CSS_SELECTOR, '${selector}').click()\n`;
          break;
        case 'goto':
          code += `    driver.get('${action.args?.[0]}')\n`;
          break;
        default:
          code += `    # ${action.description || action.qword}\n`;
      }
    });
    code += `    driver.quit()
`;
    return code;
  };

  const generateRobotCode = (acts: RecordedAction[], startUrl: string) => {
    let code = `*** Settings ***
Library    SeleniumLibrary

*** Test Cases ***
Recorded Test
    Open Browser    ${startUrl}    chrome
`;
    acts.forEach(action => {
      const selector = action.selectorObj?.selector || action.args?.[1] || '';
      const value = action.args?.[1] || action.args?.[0] || '';
      switch (action.qword?.toLowerCase()) {
        case 'fill':
          code += `    Input Text    ${selector}    ${value}\n`;
          break;
        case 'click':
        case 'clicktext':
          code += `    Click Element    ${selector || `//\*[contains(text(),'${action.args?.[0]}')]`}\n`;
          break;
        case 'goto':
          code += `    Go To    ${action.args?.[0]}\n`;
          break;
        default:
          code += `    # ${action.description || action.qword}\n`;
      }
    });
    code += `    Close Browser
`;
    return code;
  };

  const actionsToCSV = (acts: RecordedAction[]) => {
    let csv = 'Step,Action,Target,Value,Description\n';
    acts.forEach((action, i) => {
      csv += `${i + 1},"${action.qword}","${action.args?.[0] || ''}","${action.args?.[1] || ''}","${action.description || ''}"\n`;
    });
    return csv;
  };

  const handleSaveAsNew = async () => {
    if (actions.length === 0) {
      toast.error("No actions to save");
      return;
    }
    
    const newTestCase = {
      id: `tc_${Date.now()}`,
      name: `Recorded Test ${new Date().toLocaleString()}`,
      description: `Recorded from ${url}`,
      steps: actions.map((action, idx) => ({
        id: `step_${Date.now()}_${idx}`,
        name: action.description || `${action.qword} ${action.args?.join(' ')}`,
        qword: action.qword,
        args: action.args,
        selectorObj: action.selectorObj,
        automationStatus: 'recorded',
      })),
      automationStatus: 'full',
    };
    
    const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
    localCases.push(newTestCase);
    localStorage.setItem('test_cases', JSON.stringify(localCases));
    
    toast.success(`Saved ${actions.length} steps!`);
    navigate('/test-cases');
  };

  const handleRunTest = async () => {
    if (actions.length === 0) {
      toast.error("No steps to run");
      return;
    }
    
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    // Show modal with running state
    setTestExecutionResult({
      status: 'running',
      currentStep: 0,
      stepResults: [],
      totalSteps: actions.length
    });
    setShowTestResultModal(true);
    
    // Simulate step progress for visual feedback (since IPC events are unreliable)
    let progressInterval: NodeJS.Timeout | null = null;
    let currentIdx = 0;
    
    progressInterval = setInterval(() => {
      if (currentIdx < actions.length) {
        setTestExecutionResult(prev => prev && prev.status === 'running' ? { 
          ...prev, 
          currentStep: currentIdx 
        } : prev);
        currentIdx++;
      }
    }, 800); // Update progress every 800ms
    
    try {
      let result: any;
      
      if (flowstral?.playwrightRecorder?.runTest) {
        result = await flowstral.playwrightRecorder.runTest({
          steps: actions,
          url: url
        });
      } else if (electronAPI?.testRunner?.executeTest) {
        result = await electronAPI.testRunner.executeTest({
          name: 'Recorded Test',
          steps: actions.map(a => ({
            type: a.qword,
            qword: a.qword,
            args: a.args,
            selector: a.selectorObj?.selector,
            selectorObj: a.selectorObj,
            description: a.description
          })),
          settings: { baseUrl: url }
        });
      }
      
      // Stop progress simulation
      if (progressInterval) clearInterval(progressInterval);
      
      console.log('[Test] Result:', result);
      
      // Generate step results from the response
      const generateStepResults = () => {
        // If result has stepResults, use those
        if (result?.stepResults && Array.isArray(result.stepResults)) {
          return result.stepResults.map((s: any, i: number) => ({
            index: i,
            status: s.status || 'passed',
            error: s.error,
            screenshot: s.screenshot
          }));
        }
        
        // If result has steps array, use that
        if (result?.steps && Array.isArray(result.steps)) {
          return result.steps.map((s: any, i: number) => ({
            index: i,
            status: s.status || 'passed',
            error: s.error,
            screenshot: s.screenshot
          }));
        }
        
        // If test passed, mark all steps as passed
        const testPassed = result?.success !== false && result?.status !== 'failed';
        const failedStep = result?.failedStep ?? (testPassed ? -1 : actions.length - 1);
        
        return actions.map((_, i) => ({
          index: i,
          status: testPassed || i < failedStep ? 'passed' : (i === failedStep ? 'failed' : 'skipped'),
          error: i === failedStep ? (result?.error || result?.failError) : undefined
        }));
      };
      
      const stepResults = generateStepResults();
      const testPassed = result?.success !== false && result?.status !== 'failed';
      
      setTestExecutionResult({
        status: testPassed ? 'passed' : 'failed',
        currentStep: actions.length - 1,
        stepResults,
        totalSteps: actions.length,
        error: testPassed ? undefined : (result?.error || result?.failError || 'Test failed')
      });
      
      if (testPassed) {
        toast.success(`✅ Test Passed! (${actions.length} steps)`, { id: 'run' });
      } else {
        toast.error(`❌ Test Failed: ${result?.error || 'Unknown error'}`, { id: 'run' });
      }
    } catch (error: any) {
      if (progressInterval) clearInterval(progressInterval);
      
      setTestExecutionResult({
        status: 'failed',
        currentStep: 0,
        stepResults: actions.map((_, i) => ({ index: i, status: 'skipped' })),
        totalSteps: actions.length,
        error: error?.message || 'Test execution error'
      });
      toast.error('Failed to run test', { id: 'run' });
    }
  };

  const getActionIcon = (qword: string, small = false) => {
    const size = small ? "h-3 w-3" : "h-4 w-4";
    const type = qword?.toLowerCase() || '';
    if (type.includes('goto') || type.includes('nav')) return <Globe className={`${size} text-blue-400`} />;
    if (type.includes('fill')) return <PenLine className={`${size} text-purple-400`} />;
    if (type.includes('click')) return <Hand className={`${size} text-emerald-400`} />;
    if (type.includes('assert')) return <Eye className={`${size} text-cyan-400`} />;
    return <CircleDot className={`${size} text-muted-foreground`} />;
  };

  // Toggle group expansion
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  };

  if (!isElectron()) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Card className="max-w-md bg-card border-border">
          <CardContent className="pt-6 text-center">
            <Video className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2 text-foreground">Desktop App Required</h2>
            <p className="text-muted-foreground">Playwright Recorder requires Flowstral Desktop.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background text-foreground flex flex-col overflow-hidden">
      {/* ============ TOP TOOLBAR ============ */}
      <div className="h-12 bg-card border-b border-gray-200 dark:border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30">
              <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse")} />
              <span className="text-xs text-foreground">Ready</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-foreground">{actions.length} steps</span>
        </div>
          )}
                      </div>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
            <Code className="h-3.5 w-3.5 mr-1.5" />
            Code
          </Button>
                    <Button
            onClick={handleRunTest}
                      size="sm"
            className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700"
            disabled={actions.length === 0}
                    >
            <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
            Run
                    </Button>
                    <Button
            onClick={handleExportToBuilder}
                      size="sm"
            className="h-8 px-4 text-xs bg-primary hover:bg-primary/90"
            disabled={actions.length === 0}
                    >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Builder
                    </Button>
          <Select onValueChange={handleExport}>
            <SelectTrigger className="h-8 w-[100px] text-xs border-white/20 bg-transparent">
              <Download className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Export" />
            </SelectTrigger>
            <SelectContent className="bg-secondary border-border">
              <SelectItem value="playwright" className="text-xs">Playwright</SelectItem>
              <SelectItem value="cypress" className="text-xs">Cypress</SelectItem>
              <SelectItem value="selenium" className="text-xs">Selenium</SelectItem>
              <SelectItem value="robot" className="text-xs">Robot Framework</SelectItem>
              <SelectItem value="json" className="text-xs">JSON</SelectItem>
              <SelectItem value="csv" className="text-xs">CSV</SelectItem>
            </SelectContent>
          </Select>
                  </div>
      </div>

      {/* ============ MAIN CONTENT ============ */}
      <div className="flex-1 flex overflow-hidden">
        {/* ============ LEFT PANEL - URL & Recorded Steps ============ */}
        <div className="w-[55%] min-w-[500px] flex flex-col border-r border-border">
          {/* URL Bar */}
          <div className="p-3 border-b border-border">
            <div className="flex items-center gap-2 p-2 bg-secondary rounded-lg border border-border">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                  disabled={isRecording}
                className="h-7 bg-transparent border-0 text-sm p-0 focus-visible:ring-0"
                />
            </div>
              </div>
              
{/* Recording Controls */}
          <div className="p-3 border-b border-border space-y-2">
            {/* Selected Test Info (Automate Existing mode) */}
            {selectedTestCase && (
              <div className="p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Automating:</span>
                    <span className="text-sm text-foreground truncate max-w-[200px]">{selectedTestCase.name}</span>
                    <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">
                      {selectedTestCase.steps?.length || 0} steps
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedTestCase(null);
                      setMode('new');
                    }}
                    className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
            
            {/* Recording Buttons */}
            <div className="flex gap-2">
              {!isRecording ? (
                <>
                <Button
                  onClick={handleStartRecording}
                    disabled={isStarting || !url.startsWith('http')}
                    className="flex-1 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 font-medium"
                >
                  {isStarting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                      <Circle className="h-4 w-4 mr-2 fill-current" />
                  )}
                  Start Recording
                  </Button>
                  {!selectedTestCase ? (
                    <Button
                      onClick={() => setShowTestPicker(true)}
                      variant="outline"
                      className="flex-1 h-10 border-purple-500/50 text-purple-400 hover:bg-purple-500/10"
                    >
                      <Sparkles className="h-4 w-4 mr-2" />
                      Automate Existing
                </Button>
              ) : (
                <Button
                      onClick={() => setShowTestPicker(true)}
                      variant="outline"
                      className="h-10 px-3 border-border text-muted-foreground hover:text-foreground"
                >
                      Change
                </Button>
                  )}
                </>
              ) : (
                <>
                  <Button onClick={handleStopRecording} className="flex-1 h-10 bg-red-600 hover:bg-red-700">
                    <Square className="h-4 w-4 mr-2 fill-current" />
                    Stop
                  </Button>
                  <Button 
                    onClick={handlePauseResume} 
                    className={cn(
                      "w-28 h-10",
                      isPaused 
                        ? "bg-emerald-600 hover:bg-emerald-700" 
                        : "bg-primary hover:bg-primary/90"
                    )}
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
                </>
              )}
            </div>
            </div>

          {/* Recorded Steps Header */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Recorded Steps</span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                {actions.length}
                </Badge>
              </div>
              {actions.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearActions} className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive">
                <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
            )}
          </div>

          {/* Recorded Steps List */}
          <ScrollArea className="flex-1">
            {actions.length === 0 ? (
              <div className="text-center py-12 px-4 text-muted-foreground">
                <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No actions recorded yet.</p>
                <p className="text-xs mt-1">Click 'Start Recording' to begin.</p>
              </div>
            ) : (
              <div className="px-2 pb-2 space-y-1">
                {actions.map((action, index) => {
                  // Apply masking for sensitive fields (passwords)
                  const displayAction = maskSensitiveAction(action);
                  const isPw = isPasswordField(action);
                  const isSelected = selectedActionIndex === index;
                  
                  return (
                  <div
                    key={action.id || index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedActionIndex(isSelected ? null : index)}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg bg-card hover:bg-accent border group cursor-pointer active:cursor-grabbing transition-all",
                      isSelected && "border-primary bg-primary/10 ring-1 ring-primary/30",
                      draggedIndex === index && "opacity-50 border-cyan-500/50",
                      dragOverIndex === index && draggedIndex !== index && "border-cyan-500 bg-cyan-500/10",
                      !isSelected && draggedIndex === null && "border-transparent hover:border-white/5"
                    )}
                  >
                    {/* Drag handle */}
                    <div className="flex flex-col gap-0.5 text-muted-foreground group-hover:text-foreground shrink-0 cursor-grab">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-current" />
                        <div className="w-1 h-1 rounded-full bg-current" />
                      </div>
                      <div className="flex gap-0.5">
                        <div className="w-1 h-1 rounded-full bg-current" />
                        <div className="w-1 h-1 rounded-full bg-current" />
                      </div>
                    </div>
                    <div className="flex items-center justify-center w-6 h-6 rounded bg-white/5 text-xs text-muted-foreground font-mono shrink-0">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    {getActionIcon(action.qword || action.type || '')}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {displayAction.description || `${action.qword || action.type} ${displayAction.args?.[0] || ''}`}
                        {isPw && <span className="ml-1 text-primary">🔒</span>}
                      </p>
                      {displayAction.args?.[0] && (
                        <p className="text-xs text-muted-foreground truncate">
                          {isPw ? `${displayAction.args[0]} → ••••••••` : displayAction.args.join(' → ')}
                        </p>
                      )}
                    </div>
                  <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => setActions(prev => prev.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="h-3 w-3" />
                  </Button>
                  </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
                  
{/* Footer - Save/Merge Button */}
              {actions.length > 0 && (
            <div className="p-3 border-t border-border space-y-2">
              {selectedTestCase ? (
                <>
                  <Button
                    onClick={performMerge} 
                    className="w-full h-10 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                  >
                    <Merge className="h-4 w-4 mr-2" />
                    Merge {actions.length} Actions into "{selectedTestCase.name?.slice(0, 20)}..."
                      </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    Position-based merge: Action 1 → Step 1, Action 2 → Step 2, etc.
                  </p>
                </>
              ) : (
                <Button onClick={handleSaveAsNew} className="w-full h-10 bg-gradient-to-r from-emerald-500 to-emerald-600">
                  <Save className="h-4 w-4 mr-2" />
                  Save as New Test Case
                </Button>
              )}
            </div>
          )}
        </div>

        {/* ============ RIGHT PANEL - Suggestions ============ */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Tabs value={rightPanelTab} onValueChange={setRightPanelTab} className="h-full flex flex-col">
            {/* Tab Headers - Compact */}
            <div className="shrink-0 px-3 py-1.5 border-b border-border">
              <TabsList className="h-8 bg-secondary p-0.5">
                <TabsTrigger value="suggestions" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Lightbulb className="h-3 w-3 mr-1" />
                  Suggestions
                  {totalSuggestions > 0 && (
                    <Badge className="ml-1 h-4 bg-primary/30 text-primary text-[9px] px-1">
                      {totalSuggestions}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="sftools" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                  <Cloud className="h-3 w-3 mr-1" />
                  SF Tools
                </TabsTrigger>
                <TabsTrigger value="sfcontext" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                  <Target className="h-3 w-3 mr-1" />
                  SF Context
                </TabsTrigger>
              </TabsList>
            </div>

            {/* ========== SUGGESTIONS TAB ========== */}
            <TabsContent value="suggestions" className="flex-1 m-0 p-0 flex flex-col overflow-hidden data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              {/* Compact Header Row */}
              <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-[#0f0f15] z-10">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Suggested Actions</span>
                  {totalSuggestions > 0 && (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] px-1.5">
                      {totalSuggestions}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-rose-500/30 text-rose-400 hover:bg-rose-500/10">
                    <CheckSquare className="h-3 w-3 mr-1" />
                    All
                  </Button>
                  <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10">
                    <Eye className="h-3 w-3 mr-1" />
                    Assert
                  </Button>
                        <Button
                    onClick={handleRefreshSuggestions}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                    disabled={isLoadingSuggestions}
                  >
                    {isLoadingSuggestions ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                  </Button>
                </div>
              </div>

              {/* Category Filter & Search Row - Combined */}
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap sticky top-[42px] bg-[#0f0f15] z-10">
                <div className="flex gap-1.5 flex-wrap">
                  <Badge 
                    className={cn(
                      "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
                      elementFilter === 'buttons' ? "bg-emerald-500/30 border-emerald-500 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400/70"
                    )}
                    onClick={() => setElementFilter(elementFilter === 'buttons' ? 'all' : 'buttons')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1" />
                    Buttons {categoryCounts.buttons}
                  </Badge>
                  <Badge 
                    className={cn(
                      "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
                      elementFilter === 'links' ? "bg-blue-500/30 border-blue-500 text-blue-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400/70"
                    )}
                    onClick={() => setElementFilter(elementFilter === 'links' ? 'all' : 'links')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1" />
                    Links {categoryCounts.links}
                  </Badge>
                  <Badge 
                    className={cn(
                      "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
                      elementFilter === 'inputs' ? "bg-purple-500/30 border-purple-500 text-purple-400" : "bg-purple-500/10 border-purple-500/30 text-purple-400/70"
                    )}
                    onClick={() => setElementFilter(elementFilter === 'inputs' ? 'all' : 'inputs')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 mr-1" />
                    Inputs {categoryCounts.inputs}
                  </Badge>
                  <Badge 
                    className={cn(
                      "cursor-pointer transition-colors text-[10px] px-1.5 py-0.5",
                      elementFilter === 'headings' ? "bg-warning/30 border-warning text-warning" : "bg-warning/10 border-warning/30 text-warning/70"
                    )}
                    onClick={() => setElementFilter(elementFilter === 'headings' ? 'all' : 'headings')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-warning mr-1" />
                    Headings {categoryCounts.headings}
                  </Badge>
                </div>
                <div className="flex-1 relative min-w-[120px]">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <Input
                    value={suggestionSearch}
                    onChange={(e) => setSuggestionSearch(e.target.value)}
                    placeholder="Search..."
                    className="pl-7 h-6 bg-input border-border text-foreground text-[10px]"
                  />
                </div>
              </div>

              {/* Suggestions List - Scrollable, fills remaining space */}
              <div className="flex-1 overflow-auto">
                <div className="p-2 min-h-full">
                {isLoadingSuggestions && !suggestResult?.suggestions?.length && (
                  <div className="text-center py-8">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin text-primary" />
                    <p className="text-xs mt-2 text-muted-foreground">Analyzing page...</p>
                  </div>
                )}
                
                {suggestResult?.suggestions && suggestResult.suggestions.length > 0 && (
                  <div className="space-y-1.5">
                    {/* Filter suggestions based on elementFilter and search */}
                    {suggestResult.suggestions
                      .filter(s => {
                        // Apply category filter
                        if (elementFilter === 'buttons' && s.category !== 'button') return false;
                        if (elementFilter === 'links' && s.category !== 'link') return false;
                        if (elementFilter === 'inputs' && s.category !== 'input') return false;
                        if (elementFilter === 'headings' && s.category !== 'heading') return false;
                        // Apply search filter
                        if (suggestionSearch.trim()) {
                          const query = suggestionSearch.toLowerCase();
                          const text = (s.element || s.description || s.args?.[0] || '').toLowerCase();
                          if (!text.includes(query)) return false;
                        }
                        return true;
                      })
                      .map((s, i) => (
                        <div 
                          key={`${s.element}-${i}`}
                          className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary hover:bg-accent border border-transparent hover:border-primary/20 group transition-colors"
                        >
                          {/* Icon based on category */}
                          <div className={cn(
                            "p-1.5 rounded shrink-0",
                            s.category === 'input' && 'bg-purple-500/20 text-purple-400',
                            s.category === 'link' && 'bg-blue-500/20 text-blue-400',
                            s.category === 'heading' && 'bg-warning/20 text-warning',
                            s.category === 'button' && 'bg-emerald-500/20 text-emerald-400',
                            !['input', 'link', 'heading', 'button'].includes(s.category || '') && 'bg-muted/20 text-muted-foreground'
                          )}>
                            {s.category === 'input' ? <PenLine className="h-3.5 w-3.5" /> :
                             s.category === 'link' ? <Link className="h-3.5 w-3.5" /> :
                             s.category === 'heading' ? <Type className="h-3.5 w-3.5" /> :
                             <Hand className="h-3.5 w-3.5" />}
                          </div>
                          
                          {/* Label */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground truncate font-medium">{s.element || s.description || s.args?.[0] || 'Unknown'}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{s.qword || s.type || s.category}</p>
                          </div>
                          
                          {/* Action buttons - always visible on mobile, hover on desktop */}
                      <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={() => executeAction(s)}
                            title="Execute action on page"
                          >
                            <Play className="h-3 w-3" />
                      </Button>
                      <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={() => addToTest(s)}
                            title="Add to test steps"
                          >
                            <Plus className="h-3 w-3" />
                      </Button>
                        </div>
                      ))}
                    
                    {/* Show message if filter results in no items */}
                    {suggestResult.suggestions.filter(s => {
                      if (elementFilter === 'buttons' && s.category !== 'button') return false;
                      if (elementFilter === 'links' && s.category !== 'link') return false;
                      if (elementFilter === 'inputs' && s.category !== 'input') return false;
                      if (elementFilter === 'headings' && s.category !== 'heading') return false;
                      if (suggestionSearch.trim()) {
                        const query = suggestionSearch.toLowerCase();
                        const text = (s.element || s.description || '').toLowerCase();
                        if (!text.includes(query)) return false;
                      }
                      return true;
                    }).length === 0 && (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-xs">No {elementFilter !== 'all' ? elementFilter : 'elements'} match{suggestionSearch ? ` "${suggestionSearch}"` : ''}</p>
                        <Button
                          onClick={() => { setElementFilter('all'); setSuggestionSearch(''); }}
                          variant="ghost"
                        size="sm"
                          className="mt-2 text-xs text-muted-foreground"
                      >
                          Clear filters
                      </Button>
                      </div>
                    )}
                  </div>
                )}
                
                {!isLoadingSuggestions && (!suggestResult?.suggestions || suggestResult.suggestions.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Lightbulb className="h-10 w-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-medium">No suggestions yet</p>
                    <p className="text-xs mt-1">Start recording to see page elements</p>
                    <Button
                      onClick={handleRefreshSuggestions}
                      variant="outline"
                      size="sm"
                      className="mt-4 text-xs border-primary/30 text-primary"
                    >
                      <RefreshCw className="h-3 w-3 mr-1.5" />
                      Analyze Page
                    </Button>
                  </div>
                )}
                </div>
              </div>
            </TabsContent>

            {/* ========== SF TOOLS TAB ========== */}
            <TabsContent value="sftools" className="flex-1 m-0 p-0 flex flex-col overflow-hidden data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              {/* SF Tools Sub-tabs bar */}
              <div className="shrink-0 bg-card border-b border-border">
                <div className="flex">
                  <button
                    onClick={() => setSfToolsSubTab('soql')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
                      sfToolsSubTab === 'soql' 
                        ? "bg-primary/10 text-primary border-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                    )}
                  >
                    <Database className="h-3.5 w-3.5" />
                    SOQL
                  </button>
                  <button
                    onClick={() => setSfToolsSubTab('assertions')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
                      sfToolsSubTab === 'assertions' 
                        ? "bg-warning/10 text-warning border-warning" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                    )}
                  >
                    <Shield className="h-3.5 w-3.5" />
                    Assert
                  </button>
                  <button
                    onClick={() => setSfToolsSubTab('stages')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
                      sfToolsSubTab === 'stages' 
                        ? "bg-cyan-500/10 text-cyan-400 border-cyan-500" 
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent"
                    )}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                    Stages
                  </button>
                  <button
                    onClick={() => setSfToolsSubTab('quick')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
                      sfToolsSubTab === 'quick' 
                        ? "bg-purple-500/10 text-purple-400 border-purple-500" 
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent"
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Quick
                  </button>
                </div>
              </div>
              
              {/* SF Tools Sub-tab Content */}
              <div className="flex-1 min-h-0 overflow-hidden">
                
                {/* SOQL Builder Sub-tab */}
                {sfToolsSubTab === 'soql' && (
                  <SmartSOQLBuilder
                    onExecute={(query, results) => {
                      setSoqlQuery(query);
                      if (results?.records) {
                        setSoqlResults(results.records);
                        setSoqlColumns(results.records.length > 0 ? Object.keys(results.records[0]).filter(k => k !== 'attributes') : []);
                      }
                    }}
                    onAddAsStep={(step) => {
                      const action: RecordedAction = {
                        id: `sf_${Date.now()}`,
                        qword: step.action,
                        args: Object.values(step.args).map(v => String(v)),
                        description: step.args.description || step.action,
                        timestamp: Date.now(),
                        type: step.type
                      };
                      setActions(prev => [...prev, action]);
                    }}
                    className="h-full w-full"
                  />
                )}
                
                {/* Metadata Assertions Sub-tab */}
                {sfToolsSubTab === 'assertions' && (
                  <MetadataAssertions
                    onAddAsStep={(step) => {
                      const action: RecordedAction = {
                        id: `sf_${Date.now()}`,
                        qword: step.action,
                        args: Object.values(step.args).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)),
                        description: step.args.description || step.action,
                        timestamp: Date.now(),
                        type: step.type
                      };
                      setActions(prev => [...prev, action]);
                    }}
                    className="h-full w-full"
                  />
                )}
                
                {/* Stage Transition Sub-tab */}
                {sfToolsSubTab === 'stages' && (
                  <StageTransitionTester
                    onAddAsStep={(step) => {
                      const action: RecordedAction = {
                        id: `sf_${Date.now()}`,
                        qword: step.action,
                        args: Object.values(step.args).map(v => String(v)),
                        description: step.args.description || step.action,
                        timestamp: Date.now(),
                        type: step.type
                      };
                      setActions(prev => [...prev, action]);
                    }}
                    className="h-full w-full"
                  />
                )}
                
                {/* Quick Tools Sub-tab - Original tools */}
                {sfToolsSubTab === 'quick' && (
              <ScrollArea className="h-full">
                <div className="p-2 space-y-3">
                
                {/* ===== QUICK SOQL SECTION ===== */}
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-blue-400 flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5" />
                      Quick SOQL Query
                    </h4>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-blue-400"
                      onClick={() => setShowSoqlPanel(!showSoqlPanel)}
                    >
                      {showSoqlPanel ? 'Hide' : 'Expand'} Editor
                    </Button>
                  </div>
                  
                  {/* Quick Query Input */}
                  <div className="flex gap-1.5">
                    <Input
                      value={soqlQuery}
                      onChange={(e) => setSoqlQuery(e.target.value)}
                      placeholder="SELECT Id, Name FROM Account LIMIT 10"
                      className="h-8 text-xs bg-[#0d0d14] border-blue-500/20 text-white font-mono"
                      onKeyDown={(e) => e.key === 'Enter' && e.ctrlKey && executeSOQL()}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3 bg-blue-600 hover:bg-blue-700"
                      onClick={executeSOQL}
                      disabled={isQueryLoading}
                    >
                      {isQueryLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </div>
                  
                  {/* Query Templates */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {[
                      { label: 'Accounts', q: 'SELECT Id, Name, Industry, Phone FROM Account LIMIT 20' },
                      { label: 'Contacts', q: 'SELECT Id, FirstName, LastName, Email, AccountId FROM Contact LIMIT 20' },
                      { label: 'Leads', q: 'SELECT Id, Name, Company, Status, Email FROM Lead LIMIT 20' },
                      { label: 'Opps', q: 'SELECT Id, Name, Amount, StageName, CloseDate FROM Opportunity LIMIT 20' },
                      { label: 'Users', q: 'SELECT Id, Name, Email, ProfileId, IsActive FROM User LIMIT 20' },
                    ].map(t => (
                      <Button
                        key={t.label}
                        size="sm"
                        variant="ghost"
                        className="h-5 px-1.5 text-[9px] text-blue-300/70 hover:text-blue-300"
                        onClick={() => setSoqlQuery(t.q)}
                      >
                        {t.label}
                      </Button>
                    ))}
                  </div>
                  
                  {/* Query Results (Compact) */}
                  {soqlResults.length > 0 && (
                    <div className="mt-2 bg-[#0d0d14] rounded border border-blue-500/20 max-h-32 overflow-auto">
                      <table className="w-full text-[9px]">
                        <thead className="bg-blue-500/10 sticky top-0">
                          <tr>
                            <th className="px-1 py-0.5 text-left text-blue-300">#</th>
                            {soqlColumns.slice(0, 4).map(col => (
                              <th key={col} className="px-1 py-0.5 text-left text-blue-300 truncate max-w-[80px]">{col}</th>
                            ))}
                            <th className="px-1 py-0.5 text-center text-blue-300">Add</th>
                          </tr>
                        </thead>
                        <tbody>
                          {soqlResults.slice(0, 10).map((row, idx) => (
                            <tr key={idx} className="border-t border-blue-500/10 hover:bg-blue-500/5">
                              <td className="px-1 py-0.5 text-muted-foreground">{idx + 1}</td>
                              {soqlColumns.slice(0, 4).map(col => (
                                <td key={col} className="px-1 py-0.5 text-foreground truncate max-w-[80px]">
                                  {String(row[col] ?? '-')}
                                </td>
                              ))}
                              <td className="px-1 py-0.5 text-center">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-4 w-4 p-0 text-green-400 hover:text-green-300"
                                  onClick={() => addSOQLAssertionStep(soqlColumns[1] || 'Id', row[soqlColumns[1]] || row.Id, idx)}
                                  title="Add as assertion"
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {soqlResults.length > 10 && (
                        <div className="text-center text-[9px] text-muted-foreground py-1">
                          +{soqlResults.length - 10} more records
                        </div>
                      )}
                    </div>
                  )}
                  
                  {soqlError && (
                    <div className="mt-2 p-1.5 bg-red-500/10 border border-red-500/30 rounded text-[10px] text-red-400">
                      {soqlError}
                    </div>
                  )}
                </div>
                
                {/* ===== RECORD INSPECTOR ===== */}
                <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2">
                  <h4 className="text-xs font-medium text-purple-400 flex items-center gap-1.5 mb-2">
                    <Eye className="h-3.5 w-3.5" />
                    Record Inspector
                  </h4>
                  <div className="flex gap-1.5">
                    <Input
                      value={inspectRecordId}
                      onChange={(e) => setInspectRecordId(e.target.value)}
                      placeholder="Enter Record ID (e.g., 001...)"
                      className="h-7 text-xs bg-[#0d0d14] border-purple-500/20 text-white font-mono"
                    />
                    <Button
                      size="sm"
                      className="h-7 px-2 bg-purple-600 hover:bg-purple-700"
                      onClick={inspectRecord}
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                  </div>
                  
                  {/* Inspected Record Fields */}
                  {inspectedRecord && (
                    <div className="mt-2 bg-[#0d0d14] rounded border border-purple-500/20 max-h-40 overflow-auto">
                      <div className="p-1">
                        {Object.entries(inspectedRecord)
                          .filter(([k]) => k !== 'attributes')
                          .slice(0, 15)
                          .map(([field, value]) => (
                          <div key={field} className="flex items-center justify-between py-0.5 px-1 text-[9px] hover:bg-purple-500/10 rounded group">
                            <span className="text-purple-300 truncate max-w-[100px]">{field}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-muted-foreground truncate max-w-[100px]">{String(value ?? 'null')}</span>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-green-400"
                                onClick={() => addFieldAssertion(field, value)}
                                title="Add assertion"
                              >
                                <Plus className="h-2.5 w-2.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* ===== DATA SETUP TOOLS ===== */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Data Setup</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-[10px] border-border hover:border-pink-500/50 hover:bg-pink-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('datafactory'); setSfToolInput('Account'); setSfToolInput2('5'); setShowSFToolDialog(true); }}
                    >
                      <Sparkles className="h-4 w-4 text-pink-400" />
                      <span>Data Factory</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-[10px] border-border hover:border-sky-500/50 hover:bg-sky-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('createrecord'); setSfToolInput('Account'); setSfToolInput2('{"Name":"Test"}'); setShowSFToolDialog(true); }}
                    >
                      <Plus className="h-4 w-4 text-sky-400" />
                      <span>Create Record</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-[10px] border-border hover:border-purple-500/50 hover:bg-purple-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('clone'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                    >
                      <Copy className="h-4 w-4 text-purple-400" />
                      <span>Clone Record</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-11 text-[10px] border-border hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('bulkload'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                    >
                      <Upload className="h-4 w-4 text-fuchsia-400" />
                      <span>Bulk Insert</span>
                    </Button>
                  </div>
                </div>
                
                {/* ===== CODE EXECUTION ===== */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Code & API</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('apex'); setSfToolInput('// Apex code\nSystem.debug(\'Test\');'); setShowSFToolDialog(true); }}
                    >
                      <Zap className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Apex</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('api'); setSfToolInput('/services/data/v59.0/sobjects/Account'); setSfToolInput2('GET'); setShowSFToolDialog(true); }}
                    >
                      <Globe className="h-3.5 w-3.5 text-cyan-400" />
                      <span>REST API</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('flow'); setSfToolInput(''); setShowSFToolDialog(true); }}
                    >
                      <ArrowRight className="h-3.5 w-3.5 text-orange-400" />
                      <span>Flow</span>
                    </Button>
                  </div>
                </div>
                
                {/* ===== ASSERTIONS & VALIDATIONS ===== */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Assertions</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-primary/50 hover:bg-primary/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('validation'); setSfToolInput(''); setSfToolInput2(''); setShowSFToolDialog(true); }}
                    >
                      <Shield className="h-3.5 w-3.5 text-primary" />
                      <span>Validation Rule</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-teal-500/50 hover:bg-teal-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => {
                        const action: RecordedAction = { id: `action_${Date.now()}`, qword: 'AssertFieldValue', args: ['FieldName', 'ExpectedValue'], description: 'Assert Field Value', timestamp: Date.now() };
                        setActions(prev => [...prev, action]);
                        toast.success('Added Field Assert - configure in Builder');
                      }}
                    >
                      <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
                      <span>Assert Field</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-blue-500/50 hover:bg-blue-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('soql'); setSfToolInput('SELECT COUNT() FROM Account'); setShowSFToolDialog(true); }}
                    >
                      <Database className="h-3.5 w-3.5 text-blue-400" />
                      <span>SOQL Assert</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('runreport'); setSfToolInput(''); setShowSFToolDialog(true); }}
                    >
                      <FileText className="h-3.5 w-3.5 text-yellow-400" />
                      <span>Report Assert</span>
                    </Button>
                  </div>
                </div>
                
                {/* ===== ADMIN & CLEANUP ===== */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Admin & Cleanup</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-[10px] border-border hover:border-indigo-500/50 hover:bg-indigo-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('permission'); setSfToolInput(''); setSfToolInput2('assign'); setShowSFToolDialog(true); }}
                    >
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      <span>Perm Set</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-[10px] border-border hover:border-lime-500/50 hover:bg-lime-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('apextest'); setSfToolInput(''); setShowSFToolDialog(true); }}
                    >
                      <Play className="h-3.5 w-3.5 text-lime-400" />
                      <span>Apex Test</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-[10px] border-border hover:border-rose-500/50 hover:bg-rose-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => {
                        const action: RecordedAction = { id: `action_${Date.now()}`, qword: 'DeleteRecord', args: ['CurrentRecord'], description: 'Delete Current Record', timestamp: Date.now() };
                        setActions(prev => [...prev, action]);
                        toast.success('Added Delete step');
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-rose-400" />
                      <span>Delete</span>
                    </Button>
                  </div>
                </div>
                
                {/* ===== NAVIGATE TO FULL SF TAB ===== */}
                <div className="pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={() => window.location.href = '/salesforce'}
                  >
                    <ExternalLink className="h-3.5 w-3.5 mr-2" />
                    Open Full Salesforce Tools
                  </Button>
                  <p className="text-[9px] text-muted-foreground text-center mt-1.5">
                    Access Schema Browser, Debug Logs, Data Diff, and 20+ more tools
                  </p>
                </div>
              </div>
              </ScrollArea>
                )}
                {/* End Quick Tools Sub-tab */}
                
              </div>
              {/* End SF Tools Sub-tab Content */}
            </TabsContent>

            {/* ========== LEGACY SF TOOLS FOR REFERENCE (HIDDEN) ========== */}
            <div style={{ display: 'none' }}>
                {/* Data & Query Tools */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Data & Query</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                        <Button
                      variant="outline"
                          size="sm"
                      className="h-12 text-[10px] border-border hover:border-blue-500/50 hover:bg-blue-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('soql'); setSfToolInput('SELECT Id, Name FROM Account LIMIT 10'); setShowSFToolDialog(true); }}
                    >
                      <Database className="h-4 w-4 text-blue-400" />
                      <span>SOQL Query</span>
                        </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-12 text-[10px] border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('apex'); setSfToolInput('// Apex code\nSystem.debug(\'Test\');'); setShowSFToolDialog(true); }}
                    >
                      <Zap className="h-4 w-4 text-emerald-400" />
                      <span>Execute Apex</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-12 text-[10px] border-border hover:border-cyan-500/50 hover:bg-cyan-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('api'); setSfToolInput('/services/data/v59.0/sobjects/Account'); setSfToolInput2('GET'); setShowSFToolDialog(true); }}
                    >
                      <Globe className="h-4 w-4 text-cyan-400" />
                      <span>REST API Call</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-12 text-[10px] border-border hover:border-pink-500/50 hover:bg-pink-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('datafactory'); setSfToolInput('Account'); setSfToolInput2('5'); setShowSFToolDialog(true); }}
                    >
                      <Sparkles className="h-4 w-4 text-pink-400" />
                      <span>Data Factory</span>
                    </Button>
            </div>
                        </div>

                {/* Record Operations */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Record Operations</h4>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-12 text-[10px] border-border hover:border-purple-500/50 hover:bg-purple-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('clone'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                    >
                      <Copy className="h-4 w-4 text-purple-400" />
                      <span>Clone Record</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-rose-500/50 hover:bg-rose-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => {
                        const action: RecordedAction = { id: `action_${Date.now()}`, qword: 'DeleteRecord', args: ['CurrentRecord'], description: 'Delete Current Record', timestamp: Date.now() };
                        setActions(prev => [...prev, action]);
                        toast.success('Added Delete step');
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-rose-400" />
                      <span>Delete Record</span>
                    </Button>
                      </div>
                        </div>

                {/* Assertions & Validation - OLD SECTION REMOVED */}

                {/* More Tools - OLD SECTION */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">More Tools</h4>
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-sky-500/50 hover:bg-sky-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('createrecord'); setSfToolInput('Account'); setSfToolInput2('{}'); setShowSFToolDialog(true); }}
                    >
                      <Plus className="h-4 w-4 text-sky-400" />
                      <span>Create Record</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-fuchsia-500/50 hover:bg-fuchsia-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('bulkload'); setSfToolInput('Account'); setSfToolInput2(''); setShowSFToolDialog(true); }}
                    >
                      <Upload className="h-4 w-4 text-fuchsia-400" />
                      <span>Bulk Load</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 text-[10px] border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 flex-col gap-0.5 justify-center"
                      onClick={() => { setSfToolType('runreport'); setSfToolInput(''); setShowSFToolDialog(true); }}
                    >
                      <FileText className="h-4 w-4 text-yellow-400" />
                      <span>Run Report</span>
                    </Button>
                      </div>
                      </div>

                {/* Quick UI Actions */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Quick Actions</h4>
                  <div className="grid grid-cols-4 gap-1">
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-white/5 flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Click', args: ['Global Search'], description: 'Click Global Search', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <Search className="h-3 w-3" />Search
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-white/5 flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Click', args: ['App Launcher'], description: 'Click App Launcher', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <LayoutGrid className="h-3 w-3" />Apps
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-white/5 flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Wait', args: ['2000'], description: 'Wait 2 seconds', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <RefreshCw className="h-3 w-3" />Wait
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-white/5 flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Screenshot', args: [`ss_${Date.now()}.png`], description: 'Take Screenshot', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <Eye className="h-3 w-3" />Screenshot
                    </Button>
                    </div>
                  </div>

                {/* Navigate To - Sales */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Navigate - Sales</h4>
                  <div className="grid grid-cols-4 gap-1">
                    {['Accounts', 'Contacts', 'Opportunities', 'Leads', 'Campaigns', 'Products', 'Quotes', 'Contracts'].map(obj => (
                      <Button key={obj} variant="outline" size="sm" className="h-6 text-[9px] border-border hover:bg-white/5"
                        onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'NavigateTo', args: [obj], description: `Navigate to ${obj}`, timestamp: Date.now() }]); toast.success(`Added: ${obj}`); }}>
                        {obj}
                      </Button>
                    ))}
                    </div>
                  </div>

                {/* Navigate To - Service */}
                <div>
                  <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">Navigate - Service & More</h4>
                  <div className="grid grid-cols-4 gap-1">
                    {['Cases', 'Tasks', 'Events', 'Reports', 'Dashboards', 'Files', 'Chatter', 'Setup'].map(obj => (
                      <Button key={obj} variant="outline" size="sm" className="h-6 text-[9px] border-border hover:bg-white/5"
                        onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'NavigateTo', args: [obj], description: `Navigate to ${obj}`, timestamp: Date.now() }]); toast.success(`Added: ${obj}`); }}>
                        {obj}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Full SF Tools Link */}
                <div className="pt-1">
                  <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-muted-foreground hover:text-white hover:bg-white/5"
                    onClick={() => navigate('/salesforce')}>
                    <ExternalLink className="h-3 w-3 mr-1" />Open Full SF Tools<ChevronRight className="h-3 w-3 ml-auto" />
                  </Button>
                </div>
            </div>
            {/* End of LEGACY SF TOOLS hidden div */}

            {/* ========== SF CONTEXT TAB - Enhanced Dashboard ========== */}
            <TabsContent value="sfcontext" className="flex-1 m-0 p-0 overflow-hidden flex flex-col data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              <SFContextDashboard
                currentUrl={currentUrl || url}
                isRecording={isRecording}
                onAddStep={(step) => {
                  const action: RecordedAction = {
                    id: `sf_${Date.now()}`,
                    qword: step.action,
                    args: Object.values(step.args).map(v => typeof v === 'object' ? JSON.stringify(v) : String(v)),
                    description: step.args.description || step.action,
                    timestamp: Date.now(),
                    type: step.type
                  };
                  setActions(prev => [...prev, action]);
                }}
                onVariableInsert={(variable) => {
                  toast.success(`Variable ${variable} copied`);
                }}
                className="h-full"
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Test Picker Dialog - Enterprise Scale */}
      <Dialog open={showTestPicker} onOpenChange={setShowTestPicker}>
        <DialogContent className="max-w-4xl h-[85vh] bg-card border-border flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>Select Test Case to Automate</span>
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                {filteredTestCases.length} of {allTestCases.length} tests
              </Badge>
            </DialogTitle>
          </DialogHeader>
          
          {/* Search & Filters */}
          <div className="space-y-3 pb-3 border-b border-border">
            {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                value={testSearchQuery}
                onChange={(e) => setTestSearchQuery(e.target.value)}
                placeholder="Search by name, ID, description, or tags..."
                className="pl-10 bg-secondary border-border text-white"
              />
            </div>
            
            {/* Filters Row */}
            <div className="flex gap-2 flex-wrap">
            {/* Status Filter */}
              <Select value={testStatusFilter} onValueChange={(v: any) => setTestStatusFilter(v)}>
                <SelectTrigger className="w-[140px] h-8 bg-secondary border-border text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all" className="text-xs">All Status</SelectItem>
                  <SelectItem value="none" className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                      Manual Only
                    </span>
                  </SelectItem>
                  <SelectItem value="partial" className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-500" />
                      Partial
                    </span>
                  </SelectItem>
                  <SelectItem value="full" className="text-xs">
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Automated
                    </span>
                  </SelectItem>
              </SelectContent>
            </Select>
            
            {/* Folder Filter */}
              <Select value={testFolderFilter} onValueChange={setTestFolderFilter}>
                <SelectTrigger className="w-[160px] h-8 bg-secondary border-border text-xs">
                  <Folder className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Folder" />
              </SelectTrigger>
                <SelectContent className="bg-secondary border-border">
                  <SelectItem value="all" className="text-xs">All Folders</SelectItem>
                  <SelectItem value="orphan" className="text-xs text-primary">⚠️ Orphaned (No Folder)</SelectItem>
                  {allFolders.map(f => (
                    <SelectItem key={f.id} value={f.id} className="text-xs">{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Tag Filter */}
              {allTags.length > 0 && (
                <Select value={testTagFilter} onValueChange={setTestTagFilter}>
                  <SelectTrigger className="w-[140px] h-8 bg-secondary border-border text-xs">
                    <Tag className="h-3 w-3 mr-1" />
                <SelectValue placeholder="Tag" />
              </SelectTrigger>
                  <SelectContent className="bg-secondary border-border">
                    <SelectItem value="all" className="text-xs">All Tags</SelectItem>
                {allTags.map(tag => (
                      <SelectItem key={tag} value={tag} className="text-xs">{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
              )}
              
              {/* Clear Filters */}
              {(testSearchQuery || testStatusFilter !== 'all' || testFolderFilter !== 'all' || testTagFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTestSearchQuery('');
                    setTestStatusFilter('all');
                    setTestFolderFilter('all');
                    setTestTagFilter('all');
                  }}
                  className="h-8 text-xs text-muted-foreground hover:text-white"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          {/* Test Cases List - Scrollable */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              {paginatedTestCases.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-10 w-10 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">
                    {allTestCases.length === 0 ? 'No test cases found' : 'No tests match your filters'}
                  </p>
                  {testSearchQuery && (
                    <p className="text-xs mt-1">Try adjusting your search or filters</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pr-4">
                {paginatedTestCases.map(tc => {
                  const status = tc.automationStatus || 
                    (tc.steps?.some((s: any) => s.qword || s.selector) ? 
                      (tc.steps.every((s: any) => s.qword || s.selector) ? 'full' : 'partial') : 'none');
                  const automatedCount = tc.steps?.filter((s: any) => s.qword || s.selector).length || 0;
                  
                  return (
                  <div
                    key={tc.id}
                    onClick={() => {
                      setSelectedTestCase(tc);
                        setMode('existing');
                      setShowTestPicker(false);
                        toast.success(`Selected: ${tc.name}`);
                      }}
                      className="p-3 rounded-lg border border-border hover:border-purple-500/50 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        {/* Status Indicator */}
                        <div className={cn(
                          "w-2 h-2 rounded-full mt-1.5 shrink-0",
                          status === 'full' && "bg-emerald-500",
                          status === 'partial' && "bg-amber-500",
                          status === 'none' && "bg-muted-foreground"
                        )} />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm text-white truncate">{tc.name || tc.title}</span>
                            {status === 'full' && (
                              <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px] px-1.5">Automated</Badge>
                            )}
                            {status === 'partial' && (
                              <Badge className="bg-amber-500/20 text-primary text-[10px] px-1.5">Partial</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{tc.steps?.length || 0} steps</span>
                            {status !== 'none' && (
                              <span className="text-emerald-400/70">{automatedCount} automated</span>
                            )}
                            {tc.folderId && allFolders.find(f => f.id === tc.folderId) && (
                              <span className="flex items-center gap-1">
                                <Folder className="h-3 w-3" />
                                {allFolders.find(f => f.id === tc.folderId)?.name}
                              </span>
                            )}
                          </div>
                          {tc.tags && tc.tags.length > 0 && (
                            <div className="flex gap-1 mt-1.5">
                              {tc.tags.slice(0, 3).map(tag => (
                                <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-muted-foreground">
                              {tag}
                            </Badge>
                          ))}
                              {tc.tags.length > 3 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/20 text-muted-foreground">
                                  +{tc.tags.length - 3}
                                </Badge>
                              )}
                        </div>
                          )}
                      </div>
                        
                        <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-purple-400 shrink-0" />
                      </div>
                    </div>
                  );
                })}
              </div>
              )}
            </ScrollArea>
          </div>
          
          {/* Pagination */}
          {totalTestPages > 1 && (
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {testPage} of {totalTestPages} • Showing {((testPage - 1) * TESTS_PER_PAGE) + 1}-{Math.min(testPage * TESTS_PER_PAGE, filteredTestCases.length)} of {filteredTestCases.length}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestPage(p => Math.max(1, p - 1))}
                  disabled={testPage === 1}
                  className="h-7 text-xs border-white/20"
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTestPage(p => Math.min(totalTestPages, p + 1))}
                  disabled={testPage === totalTestPages}
                  className="h-7 text-xs border-white/20"
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Test Execution Result Modal */}
      <Dialog open={showTestResultModal} onOpenChange={setShowTestResultModal}>
        <DialogContent className="max-w-2xl bg-card border-border overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {testExecutionResult?.status === 'running' && (
                <>
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                  Running Test...
                </>
              )}
              {testExecutionResult?.status === 'passed' && (
                <>
                  <CheckCircle className="h-5 w-5 text-emerald-400" />
                  Test Passed!
                </>
              )}
              {testExecutionResult?.status === 'failed' && (
                <>
                  <AlertCircle className="h-5 w-5 text-red-400" />
                  Test Failed
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-hidden max-w-full">
            {/* Progress */}
            {testExecutionResult?.status === 'running' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Step {(testExecutionResult?.currentStep || 0) + 1} of {testExecutionResult?.totalSteps}</span>
                  <span className="text-muted-foreground">{Math.round(((testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100)}%</span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-300"
                    style={{ width: `${((testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Step Results */}
            <div className="flex gap-4 overflow-hidden max-w-full">
              <ScrollArea className="h-[350px] flex-1 overflow-hidden">
                <div className="space-y-1 pr-2 overflow-hidden max-w-full">
                  {actions.map((action, idx) => {
                    const stepResult = testExecutionResult?.stepResults.find(r => r.index === idx);
                    const isCurrent = testExecutionResult?.status === 'running' && testExecutionResult?.currentStep === idx;
                    const hasScreenshot = !!stepResult?.screenshot;
                    
                    return (
                      <div 
                        key={action.id || idx}
                        className={cn(
                          "flex items-start gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all overflow-clip relative",
                          isCurrent && "bg-blue-500/20 border border-blue-500/30",
                          stepResult?.status === 'passed' && "bg-emerald-500/10 hover:bg-emerald-500/20",
                          stepResult?.status === 'failed' && "bg-red-500/10 hover:bg-red-500/20",
                          testExecutionResult?.selectedScreenshot === stepResult?.screenshot && "ring-2 ring-blue-500"
                        )}
                        onClick={() => {
                          if (hasScreenshot) {
                            setTestExecutionResult(prev => prev ? { 
                              ...prev, 
                              selectedScreenshot: prev.selectedScreenshot === stepResult.screenshot ? undefined : stepResult.screenshot 
                            } : null);
                          }
                        }}
                      >
                        <span className="text-muted-foreground w-6 shrink-0 pt-0.5">{idx + 1}</span>
                        <div className="shrink-0 pt-0.5">
                          {isCurrent && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                          {stepResult?.status === 'passed' && <Check className="h-4 w-4 text-emerald-400" />}
                          {stepResult?.status === 'failed' && <X className="h-4 w-4 text-red-400" />}
                          {!isCurrent && !stepResult && <Circle className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className={cn(
                            "break-words",
                            stepResult?.status === 'passed' && "text-emerald-400",
                            stepResult?.status === 'failed' && "text-red-400",
                            !stepResult && "text-muted-foreground"
                          )}>
                            {(() => {
                              const displayAction = maskSensitiveAction(action);
                              return displayAction.description || `${action.qword} ${displayAction.args?.[0] || ''}`;
                            })()}
                            {isPasswordField(action) && <span className="ml-1">🔒</span>}
                          </span>
                          {stepResult?.error && (
                            <p className="text-xs text-red-400 mt-1 truncate">{stepResult.error}</p>
                          )}
                        </div>
                        {hasScreenshot && (
                          <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
              
              {/* Screenshot Preview */}
              {testExecutionResult?.selectedScreenshot && (
                <div className="w-[300px] shrink-0 bg-gray-900 rounded-lg p-2 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-muted-foreground">Step Screenshot</span>
            <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setTestExecutionResult(prev => prev ? { ...prev, selectedScreenshot: undefined } : null)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <img 
                    src={testExecutionResult.selectedScreenshot} 
                    alt="Step screenshot" 
                    className="w-full rounded border border-border"
                  />
                </div>
              )}
            </div>
            
            {/* Error Message */}
            {testExecutionResult?.status === 'failed' && testExecutionResult?.error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{testExecutionResult.error}</p>
              </div>
            )}
            
            {/* Summary */}
            {testExecutionResult?.status !== 'running' && (
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {testExecutionResult?.stepResults.filter(r => r.status === 'passed').length || 0} / {testExecutionResult?.totalSteps || actions.length} steps passed
                </span>
            <Button
                  onClick={() => setShowTestResultModal(false)}
                  className={testExecutionResult?.status === 'passed' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700"}
                >
                  {testExecutionResult?.status === 'passed' ? "Done" : "Close"}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Preview Dialog */}
      <Dialog open={showMergePreview} onOpenChange={setShowMergePreview}>
        <DialogContent className="max-w-3xl h-[80vh] bg-card border-border flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <Merge className="h-5 w-5 text-purple-400" />
              Merge Preview - {selectedTestCase?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-sm text-muted-foreground pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Automated ({mergedSteps.filter(s => s.qword && !s._manualOnly).length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground" />
                Manual Only ({mergedSteps.filter(s => s._manualOnly).length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                Extra Recorded ({mergedSteps.filter(s => s._extra).length})
              </span>
            </div>
          </div>
          
          {/* Scrollable merged steps list */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="space-y-2 pr-4">
              {mergedSteps.map((step, idx) => (
                <div
                  key={step.id || idx}
                  className={cn(
                    "p-3 rounded-lg border",
                    step._merged && "bg-emerald-500/10 border-emerald-500/30",
                    step._manualOnly && "bg-muted-foreground/10 border-gray-500/30",
                    step._extra && "bg-purple-500/10 border-purple-500/30",
                    !step._merged && !step._manualOnly && !step._extra && step.qword && "bg-emerald-500/10 border-emerald-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-6 shrink-0">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white text-sm truncate">
                          {step.name || step.description || `${step.qword} ${step.args?.[0] || ''}`}
                        </span>
                        {step._merged && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Merged</Badge>
                        )}
                        {step._manualOnly && (
                          <Badge className="bg-muted-foreground/20 text-muted-foreground text-[10px]">Manual</Badge>
                        )}
                        {step._extra && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">New Step</Badge>
                        )}
                      </div>
                      {step.qword && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {step.qword}
                          </Badge>
                          <span className="truncate">{step.args?.join(' → ')}</span>
                        </div>
                      )}
                    </div>
                    {step.qword ? (
                      <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </div>
                </div>
              ))}
              </div>
            </ScrollArea>
          </div>
          
          <DialogFooter className="border-t border-border pt-4 shrink-0">
            <Button variant="outline" onClick={() => setShowMergePreview(false)} className="border-white/20">
              Cancel
            </Button>
            <Button onClick={saveMergedTest} className="bg-gradient-to-r from-purple-500 to-purple-600">
              <Save className="h-4 w-4 mr-2" />
              Save Merged Test ({mergedSteps.filter(s => s.qword).length}/{mergedSteps.length} automated)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SF Tools Customization Dialog */}
      <Dialog open={showSFToolDialog} onOpenChange={setShowSFToolDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              {sfToolType === 'soql' && <><Database className="h-5 w-5 text-blue-400" /> Add SOQL Query Step</>}
              {sfToolType === 'apex' && <><Zap className="h-5 w-5 text-emerald-400" /> Add Apex Execution Step</>}
              {sfToolType === 'clone' && <><Copy className="h-5 w-5 text-purple-400" /> Add Clone Record Step</>}
              {sfToolType === 'validation' && <><Shield className="h-5 w-5 text-primary" /> Add Validation Assert Step</>}
              {sfToolType === 'api' && <><Globe className="h-5 w-5 text-cyan-400" /> Add REST API Call Step</>}
              {sfToolType === 'datafactory' && <><Sparkles className="h-5 w-5 text-pink-400" /> Add Data Factory Step</>}
              {sfToolType === 'permission' && <><Layers className="h-5 w-5 text-indigo-400" /> Add Permission Set Step</>}
              {sfToolType === 'flow' && <><ArrowRight className="h-5 w-5 text-orange-400" /> Add Flow Trigger Step</>}
              {sfToolType === 'apextest' && <><Play className="h-5 w-5 text-lime-400" /> Add Apex Test Step</>}
              {sfToolType === 'createrecord' && <><Plus className="h-5 w-5 text-sky-400" /> Add Create Record Step</>}
              {sfToolType === 'bulkload' && <><Upload className="h-5 w-5 text-fuchsia-400" /> Add Bulk Load Step</>}
              {sfToolType === 'runreport' && <><FileText className="h-5 w-5 text-yellow-400" /> Add Run Report Step</>}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {sfToolType === 'soql' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">SOQL Query</label>
                  <textarea
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="SELECT Id, Name FROM Account WHERE..."
                    className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-white text-sm font-mono resize-none focus:border-blue-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">The query result will be stored and can be used in later steps</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Quick:</span>
                  {[
                    'SELECT Id, Name FROM Account LIMIT 10',
                    'SELECT Id, Email FROM Contact WHERE Email != null LIMIT 5',
                    'SELECT Id, Name FROM Opportunity WHERE StageName = \'Closed Won\'',
                  ].map((q, i) => (
                    <Button key={i} variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground" onClick={() => setSfToolInput(q)}>
                      Template {i + 1}
                    </Button>
                  ))}
                </div>
              </>
            )}

            {sfToolType === 'apex' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Apex Code (Anonymous)</label>
                  <textarea
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="// Your Apex code here&#10;System.debug('Hello');"
                    className="w-full h-32 bg-secondary border border-border rounded-lg p-3 text-white text-sm font-mono resize-none focus:border-emerald-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">Execute anonymous Apex during test - useful for data setup/cleanup</p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-[10px] text-muted-foreground">Templates:</span>
                  <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground" 
                    onClick={() => setSfToolInput('// Insert test data\nAccount acc = new Account(Name = \'Test Account\');\ninsert acc;')}>
                    Insert Record
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground"
                    onClick={() => setSfToolInput('// Delete test data\ndelete [SELECT Id FROM Account WHERE Name LIKE \'Test%\'];')}>
                    Delete Records
                  </Button>
                  <Button variant="outline" size="sm" className="h-5 text-[9px] px-1.5 border-white/20 text-muted-foreground"
                    onClick={() => setSfToolInput('// Update records\nList<Account> accs = [SELECT Id FROM Account LIMIT 5];\nfor(Account a : accs) { a.Description = \'Updated\'; }\nupdate accs;')}>
                    Update Records
                  </Button>
                </div>
              </>
            )}

            {sfToolType === 'clone' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Account, Contact, Opportunity..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Record ID (optional - will use current page if empty)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="001XXXXXXXXXXXX or leave empty"
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Clone will duplicate the record with a new ID, copying all cloneable fields</p>
              </>
            )}

            {sfToolType === 'validation' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Validation Rule Name</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="e.g., Account_Name_Required"
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Expected Error Message (contains)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="e.g., Account Name is required"
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Asserts that the expected validation error appears when triggered</p>
              </>
            )}

            {sfToolType === 'api' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">API Endpoint</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="/services/data/v59.0/sobjects/Account"
                    className="bg-secondary border-border text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">HTTP Method</label>
                  <div className="flex gap-2">
                    {['GET', 'POST', 'PATCH', 'DELETE'].map(m => (
                      <Button key={m} variant={sfToolInput2 === m ? 'default' : 'outline'} size="sm"
                        className={sfToolInput2 === m ? 'bg-cyan-600' : 'border-white/20'}
                        onClick={() => setSfToolInput2(m)}>{m}</Button>
                    ))}
                  </div>
                </div>
                {(sfToolInput2 === 'POST' || sfToolInput2 === 'PATCH') && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Request Body (JSON)</label>
                    <textarea
                      value={sfToolInput3}
                      onChange={(e) => setSfToolInput3(e.target.value)}
                      placeholder='{"Name": "Test Account"}'
                      className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-white text-sm font-mono resize-none"
                    />
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground">Make a REST API call to Salesforce - useful for data setup/cleanup</p>
              </>
            )}

            {sfToolType === 'datafactory' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Account, Contact, Lead..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Number of Records</label>
                  <Input
                    type="number"
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="5"
                    className="bg-secondary border-border text-white w-24"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Generate test records with random data - great for bulk testing</p>
              </>
            )}

            {sfToolType === 'permission' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Permission Set Name</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Sales_Cloud_Admin, Service_User..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Action</label>
                  <div className="flex gap-2">
                    <Button variant={sfToolInput2 === 'assign' ? 'default' : 'outline'} size="sm"
                      className={sfToolInput2 === 'assign' ? 'bg-indigo-600' : 'border-white/20'}
                      onClick={() => setSfToolInput2('assign')}>Assign</Button>
                    <Button variant={sfToolInput2 === 'remove' ? 'default' : 'outline'} size="sm"
                      className={sfToolInput2 === 'remove' ? 'bg-indigo-600' : 'border-white/20'}
                      onClick={() => setSfToolInput2('remove')}>Remove</Button>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Assign or remove permission sets for the current test user</p>
              </>
            )}

            {sfToolType === 'flow' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Flow API Name</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="My_Automation_Flow"
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Input Variables (JSON, optional)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"recordId": "001XXXXXXXXXXXX"}'
                    className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-white text-sm font-mono resize-none"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Manually trigger a Flow to test automation logic</p>
              </>
            )}

            {sfToolType === 'apextest' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Test Class Name</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="AccountTriggerTest, ContactServiceTest..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Test Method (optional - runs all if empty)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="testInsertAccount"
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Run Apex tests as part of your test flow - validates backend logic</p>
              </>
            )}

            {sfToolType === 'createrecord' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Account, Contact, Opportunity..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Field Values (JSON)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"Name": "Test Account", "Industry": "Technology"}'
                    className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-white text-sm font-mono resize-none"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Create a single record via API - the record ID will be stored for later use</p>
              </>
            )}

            {sfToolType === 'bulkload' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Object Type</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Account, Contact, Lead..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">CSV File Path or Variable</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="./test-data/accounts.csv or ${csvData}"
                    className="bg-secondary border-border text-white font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Operation</label>
                  <div className="flex gap-2">
                    {['insert', 'update', 'upsert', 'delete'].map(op => (
                      <Button key={op} variant={sfToolInput3 === op ? 'default' : 'outline'} size="sm"
                        className={sfToolInput3 === op ? 'bg-fuchsia-600' : 'border-white/20 capitalize'}
                        onClick={() => setSfToolInput3(op)}>{op}</Button>
                    ))}
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Bulk load data from CSV - useful for data-driven testing</p>
              </>
            )}

            {sfToolType === 'runreport' && (
              <>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Report API Name or ID</label>
                  <Input
                    value={sfToolInput}
                    onChange={(e) => setSfToolInput(e.target.value)}
                    placeholder="Monthly_Sales_Report or 00O..."
                    className="bg-secondary border-border text-white"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Filters (JSON, optional)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"column": "ACCOUNT_NAME", "operator": "contains", "value": "Test"}'
                    className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-white text-sm font-mono resize-none"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground">Run a Salesforce report and store results for assertions</p>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSFToolDialog(false)} className="border-white/20">
              Cancel
            </Button>
            <Button
              onClick={() => {
                let action: RecordedAction;
                
                if (sfToolType === 'soql') {
                  action = { id: `action_${Date.now()}`, qword: 'ExecuteSOQL', args: [sfToolInput || 'SELECT Id FROM Account LIMIT 1'], description: `SOQL: ${sfToolInput.substring(0, 50)}...`, timestamp: Date.now() };
                } else if (sfToolType === 'apex') {
                  action = { id: `action_${Date.now()}`, qword: 'ExecuteApex', args: [sfToolInput || '// Apex code', 'anonymous'], description: `Apex: ${sfToolInput.split('\n')[0].substring(0, 40)}...`, timestamp: Date.now() };
                } else if (sfToolType === 'clone') {
                  action = { id: `action_${Date.now()}`, qword: 'CloneRecord', args: [sfToolInput || 'Account', sfToolInput2 || ''], description: `Clone ${sfToolInput || 'Account'} Record`, timestamp: Date.now() };
                } else if (sfToolType === 'validation') {
                  action = { id: `action_${Date.now()}`, qword: 'AssertValidation', args: [sfToolInput || 'Rule', sfToolInput2 || 'Error'], description: `Assert Validation: ${sfToolInput || 'Rule'}`, timestamp: Date.now() };
                } else if (sfToolType === 'api') {
                  action = { id: `action_${Date.now()}`, qword: 'RestApiCall', args: [sfToolInput2 || 'GET', sfToolInput || '/services/data/v59.0/', sfToolInput3 || ''], description: `API ${sfToolInput2}: ${sfToolInput.substring(0, 40)}`, timestamp: Date.now() };
                } else if (sfToolType === 'datafactory') {
                  action = { id: `action_${Date.now()}`, qword: 'CreateTestData', args: [sfToolInput || 'Account', sfToolInput2 || '5'], description: `Create ${sfToolInput2 || 5} ${sfToolInput || 'Account'} records`, timestamp: Date.now() };
                } else if (sfToolType === 'permission') {
                  action = { id: `action_${Date.now()}`, qword: 'ManagePermissionSet', args: [sfToolInput2 || 'assign', sfToolInput || 'PermissionSet'], description: `${sfToolInput2 === 'remove' ? 'Remove' : 'Assign'} Permission Set: ${sfToolInput}`, timestamp: Date.now() };
                } else if (sfToolType === 'flow') {
                  action = { id: `action_${Date.now()}`, qword: 'TriggerFlow', args: [sfToolInput || 'FlowName', sfToolInput2 || '{}'], description: `Trigger Flow: ${sfToolInput || 'FlowName'}`, timestamp: Date.now() };
                } else if (sfToolType === 'apextest') {
                  action = { id: `action_${Date.now()}`, qword: 'RunApexTest', args: [sfToolInput || 'TestClass', sfToolInput2 || ''], description: `Run Apex Test: ${sfToolInput || 'TestClass'}${sfToolInput2 ? `.${sfToolInput2}` : ''}`, timestamp: Date.now() };
                } else if (sfToolType === 'createrecord') {
                  action = { id: `action_${Date.now()}`, qword: 'CreateRecord', args: [sfToolInput || 'Account', sfToolInput2 || '{}'], description: `Create ${sfToolInput || 'Account'} Record`, timestamp: Date.now() };
                } else if (sfToolType === 'bulkload') {
                  action = { id: `action_${Date.now()}`, qword: 'BulkLoad', args: [sfToolInput || 'Account', sfToolInput2 || '', sfToolInput3 || 'insert'], description: `Bulk ${sfToolInput3 || 'insert'} ${sfToolInput || 'Account'}`, timestamp: Date.now() };
                } else if (sfToolType === 'runreport') {
                  action = { id: `action_${Date.now()}`, qword: 'RunReport', args: [sfToolInput || 'Report', sfToolInput2 || '{}'], description: `Run Report: ${sfToolInput || 'Report'}`, timestamp: Date.now() };
                } else {
                  action = { id: `action_${Date.now()}`, qword: 'Unknown', args: [], description: 'Unknown action', timestamp: Date.now() };
                }
                
                setActions(prev => [...prev, action]);
                toast.success(`Added ${sfToolType?.toUpperCase()} step to test`);
                setShowSFToolDialog(false);
                setSfToolInput('');
                setSfToolInput2('');
                setSfToolInput3('');
              }}
              className={cn(
                "text-white",
                sfToolType === 'soql' && "bg-blue-600 hover:bg-blue-700",
                sfToolType === 'apex' && "bg-emerald-600 hover:bg-emerald-700",
                sfToolType === 'clone' && "bg-purple-600 hover:bg-purple-700",
                sfToolType === 'validation' && "bg-primary hover:bg-primary/90",
                sfToolType === 'api' && "bg-cyan-600 hover:bg-cyan-700",
                sfToolType === 'datafactory' && "bg-pink-600 hover:bg-pink-700",
                sfToolType === 'permission' && "bg-indigo-600 hover:bg-indigo-700",
                sfToolType === 'flow' && "bg-orange-600 hover:bg-orange-700",
                sfToolType === 'apextest' && "bg-lime-600 hover:bg-lime-700",
                sfToolType === 'createrecord' && "bg-sky-600 hover:bg-sky-700",
                sfToolType === 'bulkload' && "bg-fuchsia-600 hover:bg-fuchsia-700",
                sfToolType === 'runreport' && "bg-yellow-600 hover:bg-yellow-700"
              )}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add to Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Suggestion Item Component
function SuggestionItem({ 
  suggestion, 
  onExecute, 
  onAdd 
}: { 
  suggestion: Suggestion; 
  onExecute: (s: Suggestion) => void;
  onAdd: (s: Suggestion) => void;
}) {
  const getIcon = () => {
    const qword = suggestion.qword?.toLowerCase() || '';
    if (qword === 'fill') return <PenLine className="h-4 w-4 text-purple-400" />;
    if (qword.includes('click')) return <Hand className="h-4 w-4 text-emerald-400" />;
    return <CircleDot className="h-4 w-4 text-muted-foreground" />;
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-card hover:bg-accent border border-transparent hover:border-border group">
      {getIcon()}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate">{suggestion.element || suggestion.args?.[0] || suggestion.description}</p>
              </div>
      {suggestion.count && suggestion.count > 1 && (
        <Badge className="bg-amber-500/20 text-primary text-[10px] px-1.5">
          {suggestion.count} FOUND
        </Badge>
      )}
                <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400"
        onClick={(e) => { e.stopPropagation(); onExecute(suggestion); }}
        title="Execute on page"
      >
        <Play className="h-3.5 w-3.5 fill-current" />
                </Button>
                <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400"
        onClick={(e) => { e.stopPropagation(); onAdd(suggestion); }}
        title="Add to test"
      >
        <Plus className="h-3.5 w-3.5" />
                </Button>
    </div>
  );
}
