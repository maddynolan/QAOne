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

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Play, Square, Pause, Trash2, Download, ExternalLink, Save,
  CheckCircle, Video, Globe, Search, Filter, Loader2,
  Folder, Tag, ChevronDown, ChevronLeft, ChevronRight, Settings, Code,
  Zap, FileText, Merge, RotateCcw, X, Sparkles,
  AlertCircle, Check, Layers, RefreshCw, Lightbulb,
  MousePointer, Keyboard, Eye, Target, Cloud, Link, Edit,
  Hash, Type, CircleDot, FormInput, Database, Copy,
  Shield, Wand2, CheckSquare, Plus, Circle, Hand, SkipForward,
  PenLine, LayoutGrid, ArrowRight, Upload, Activity,
  Navigation, Building2, Users, User, Contact, Briefcase,
  FileBox, MapPin, Compass, Route, TestTube, FlaskConical,
  Accessibility, Scan, Link2, Bug, Bot, Network, Smartphone, Wifi, Monitor,
  Timer, Gauge
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { SalesforceContextPanel } from "@/modules/salesforce/components/SalesforceContextPanel";
import { SoqlEditor } from "@/modules/salesforce/components/SoqlEditor";
import { salesforceApi } from "@/modules/salesforce/lib/salesforce-api";
// AI Test Generator
import { AITestGenerator } from "@/modules/recorder/components/AITestGenerator";
// AI Explorer Agent - Autonomous test discovery
import { AIExplorerAgent } from "@/modules/ai-testing/components/AIExplorerAgent";
// AI Flow Explorer - Full flow discovery with navigation graph
import { AIFlowExplorer } from "@/modules/ai-testing/components/AIFlowExplorer";
// New SF Components
import { SFContextDashboard } from "@/modules/salesforce/components/salesforce/SFContextDashboard";
import { SmartSOQLBuilder } from "@/modules/salesforce/components/salesforce/SmartSOQLBuilder";
import { MetadataAssertions } from "@/modules/salesforce/components/salesforce/MetadataAssertions";
import { StageTransitionTester } from "@/modules/salesforce/components/salesforce/StageTransitionTester";
// Automation Linking System
import { 
  AutomationAction, 
  LinkMode,
  LinkedStep,
  createLinkedStep,
  mergeToStep,
  generateActionDescription,
  generateGroupDescription,
  convertRecordedAction,
  calculateCoverage as calculateAutomationCoverage,
} from "@/modules/recorder/lib/automation-linking";
// Element Repair Wizard - Visual element picker for fixing failed steps
import ElementRepairWizard from "@/modules/recorder/components/ElementRepairWizard";
import SimpleStepEditor from "@/modules/test-management/components/SimpleStepEditor";
// Confidence System - Shows reliability of element identification
import { StepConfidenceIndicator } from "@/modules/recorder/components/confidence";
// Failure classification — plain-language messages for no-code UX
import { classifyFailure, flakyLabel, flakyScoreColor } from "@/modules/recorder/lib/failureClassification";
// AI Enhancements — independent module for persistence, flaky detection, AI multi-fix
// All methods are fail-safe: returns defaults if backend unreachable
import {
  getFalsePositives as getFalsePositivesApi,
  resolveFalsePositive as resolveFalsePositiveApi,
  getFlakySteps as getFlakyStepsApi,
  explainFailure as explainFailureApi,
  type FailureExplanation,
} from "@/modules/recorder/lib/aiEnhancements";
import ManualAssistCard from "@/modules/recorder/components/ManualAssistCard";
import { API_BASE_URL } from "@/lib/api-config";
// Extracted dialog components
import TestResultsDialog from "@/modules/recorder/components/TestResultsDialog";
import TestPickerDialog from "@/modules/recorder/components/TestPickerDialog";
import CrossOriginEditorDialog from "@/modules/recorder/components/CrossOriginEditorDialog";
import MergePreviewDialog from "@/modules/recorder/components/MergePreviewDialog";
import VisualCheckpointDialog from "@/modules/recorder/components/VisualCheckpointDialog";
import SFToolsDialog from "@/modules/recorder/components/SFToolsDialog";
import StepListPanel from "@/modules/recorder/components/StepListPanel";
import SFToolsTabContent from "@/modules/recorder/components/SFToolsTabContent";
import AccessibilityTabContent from "@/modules/recorder/components/AccessibilityTabContent";
import AutomateTabContent from "@/modules/recorder/components/AutomateTabContent";
import SuggestionsTabContent from "@/modules/recorder/components/SuggestionsTabContent";
import RecordingControlsPanel from "@/modules/recorder/components/RecordingControlsPanel";
import TopToolbar from "@/modules/recorder/components/TopToolbar";
import DesktopRequiredCard from "@/modules/recorder/components/DesktopRequiredCard";
// Extracted test execution hook
import { useTestExecution } from "@/modules/recorder/hooks/useTestExecution";
// Extracted constants and helpers
import {
  DEVICE_CATEGORIES, NETWORK_PRESETS, getDeviceName,
  TESTS_PER_PAGE, MANUAL_ACTION_PREFIXES, isManualActionId,
  SF_RECORD_PREFIX_MAP, qwordToStepType, FIELD_NAME_NORMALIZATIONS,
} from "@/modules/recorder/constants/recorderConstants";
import {
  convertAnalyzeToSuggestResult, convertElementsToSuggestions,
  groupSuggestions, getCategoryCounts,
} from "@/modules/recorder/lib/suggestionHelpers";
// Extracted types and utilities
import type {
  StepConfidence, MatchAnalysis, RecordedAction,
  Suggestion, SuggestResult, TestCase, CrossOriginUserAction,
} from "@/modules/recorder/types/recorder.types";
import {
  isCrossOriginAction, isElectron, isPasswordField,
  hasPasswordArtifacts, maskSensitiveAction,
} from "@/modules/recorder/lib/actionValidation";
import {
  looksLikeFieldValue,
  getFieldIdentity, areSameFillField,
  getDisplayActions, getDisplayDescription,
} from "@/modules/recorder/lib/displayHelpers";
import {
  isGarbageAction,
} from "@/modules/recorder/lib/stepNormalization";
import {
  generatePlaywrightCode, generateCypressCode,
  generateSeleniumCode, generateRobotCode, actionsToCSV,
} from "@/modules/recorder/lib/codeGenerators";

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
  
  // ============ MANUAL SELECTOR OVERRIDE STATE ============
  // When automation fails, users can manually specify how to find an element
  const [editSelectorModalOpen, setEditSelectorModalOpen] = useState(false);
  const [editingActionIndex, setEditingActionIndex] = useState<number | null>(null);
  const [manualSelectorInput, setManualSelectorInput] = useState("");
  const [manualTextInput, setManualTextInput] = useState("");
  // Use simplified editor by default (more user-friendly)
  const [useSimpleEditor, setUseSimpleEditor] = useState(true);
  
  // ============ RESIZABLE PANEL STATE ============
  // Draggable separator between steps and suggestions panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(55); // percentage
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Ref for auto-scrolling to newly added actions
  const actionsEndRef = useRef<HTMLDivElement>(null);
  const prevActionsLengthRef = useRef<number>(0);
  
  // Network capture toggles for Load/API testing
  const [captureForLoadTest, setCaptureForLoadTest] = useState(false);
  const [captureForApiTest, setCaptureForApiTest] = useState(false);
  const [capturedNetworkRequests, setCapturedNetworkRequests] = useState<Array<{ url: string; method: string; status?: number; headers?: Record<string, string> }>>([]);
  
  // Mobile device emulation - 50+ devices
  const [selectedMobileDevice, setSelectedMobileDevice] = useState<string>('desktop');
  const [selectedBrowser, setSelectedBrowser] = useState<'chromium' | 'firefox' | 'webkit'>('chromium');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('none');
  
  // ============ RE-RECORD FROM BUILDER STATE ============
  // When user clicks "Re-record" on a failed step in the builder, we load context here
  const [searchParams] = useSearchParams();
  const [rerecordContext, setRerecordContext] = useState<{
    source: string;
    testCaseId: string;
    testCaseName: string;
    stepIndex: number;
    step: any;
    returnTo: string;
    timestamp: number;
  } | null>(null);
  const [showRerecordBanner, setShowRerecordBanner] = useState(false);
  
  // Device categories and network presets — imported from constants
  const deviceCategories = DEVICE_CATEGORIES;
  const networkPresets = NETWORK_PRESETS;
  
  // Visual checkpoint state
  const [isCapturingVisual, setIsCapturingVisual] = useState(false);
  const [visualCheckpoints, setVisualCheckpoints] = useState(0);
  const [showVisualDialog, setShowVisualDialog] = useState(false);
  const [visualBaselineName, setVisualBaselineName] = useState('');
  
  // Accessibility scanning state
  const [isA11yScanning, setIsA11yScanning] = useState(false);
  const [a11yIssues, setA11yIssues] = useState<Array<{
    page: string;
    timestamp: Date;
    issues: Array<{
      id: string;
      rule: string;
      impact: 'critical' | 'serious' | 'moderate' | 'minor';
      description: string;
      element: string;
      suggested_fix: string;
      wcag_criterion: string;
      help_url: string;
    }>;
    summary: { critical: number; serious: number; moderate: number; minor: number; total: number };
  }>>([]);
  
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

  // Merge preview state
  const [showMergePreview, setShowMergePreview] = useState(false);
  const [mergedSteps, setMergedSteps] = useState<any[]>([]);
  
  // Step-by-step automation state (for "Automate Existing" mode)
  // Tracks which manual step we're currently recording for
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  // Enhanced step linking: supports multiple actions per step (many-to-one)
  const [stepLinks, setStepLinks] = useState<Record<number, {
    actions: AutomationAction[];
    linkMode: LinkMode;
    isComplete: boolean;
  }>>({});
  
  // Link mode and grouping settings
  const [defaultLinkMode, setDefaultLinkMode] = useState<LinkMode>('document');
  const [groupingEnabled, setGroupingEnabled] = useState(true);
  const [autoAdvance, setAutoAdvance] = useState(true);
  
  // Legacy compatibility - maps manual step index -> automation data
  const [stepAutomation, setStepAutomation] = useState<Record<number, {
    type: 'recorded' | 'suggested' | 'skipped';
    data?: RecordedAction | Suggestion;
  }>>({});
  
  // Test execution state
  const [showTestResultModal, setShowTestResultModal] = useState(false);
  const [testExecutionResult, setTestExecutionResult] = useState<{
    status: 'running' | 'passed' | 'failed' | 'paused';
    currentStep: number;
    failedStepIndex?: number;    // Canonical failed step index from test-complete event
    stepResults: { 
      index: number; 
      status: string; 
      error?: string; 
      screenshot?: string;
      workingSelector?: string;  // For Lock Locators
      strategyType?: string;     // What strategy found the element
      healed?: boolean;          // Self-healing: locked selector failed but SmartFinder worked
      newSelector?: string;      // The new selector that worked (auto-update)
    }[];
    totalSteps: number;
    error?: string;
    selectedScreenshot?: string;
  } | null>(null);
  
  // Pause/Resume/Debug execution state
  const [isTestPaused, setIsTestPaused] = useState(false);
  const [pausedAtStep, setPausedAtStep] = useState<number | null>(null);
  
  // Step browsing in failure card - allows navigating to any step to fix it
  const [failureCardStepIndex, setFailureCardStepIndex] = useState<number | null>(null);
  
  // Cross-origin step editor state
  const [showCrossOriginEditor, setShowCrossOriginEditor] = useState(false);
  const [editingCrossOriginIndex, setEditingCrossOriginIndex] = useState<number | null>(null);
  const [crossOriginUserActions, setCrossOriginUserActions] = useState<CrossOriginUserAction[]>([]);
  const [stepByStepMode, setStepByStepMode] = useState(false);
  const [editingPausedStep, setEditingPausedStep] = useState<RecordedAction | null>(null);
  const [pauseRequested, setPauseRequested] = useState(false);
  const pauseResolverRef = useRef<(() => void) | null>(null);
  
  // Debug Mode - when true, shows pause/edit controls during test execution
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [showRunMenu, setShowRunMenu] = useState(false);
  
  // Keep browser open on failure - allows visual debugging, element picking, AI assist
  const [keepBrowserOpenOnFailure, setKeepBrowserOpenOnFailure] = useState(true);
  // Playback speed - slows down execution for debugging
  const [playbackSpeed, setPlaybackSpeed] = useState<'0.25x' | '0.5x' | '1x' | '2x'>('1x');
  // Highlight elements during playback
  const [highlightElements, setHighlightElements] = useState(true);
  // Track if browser is currently open (after failure)
  const [browserKeptOpen, setBrowserKeptOpen] = useState(false);
  // Track failure state for B+C Hybrid repair wizard
  const [failureState, setFailureState] = useState<{
    stepIndex: number;
    step: RecordedAction;
    error: string;
    screenshot: string | null;
    url: string | null;
    similarElements?: Array<{
      id: string;
      text: string;
      selector: string;
      type?: string;
    }>;
  } | null>(null);
  
  // ============ FALSE POSITIVE WORKFLOW ============
  // Steps marked as false positive - stored per action ID
  // When a step is marked false positive:
  // 1. Screenshot is captured
  // 2. On next run, test stops at this step
  // 3. Element picker opens for easy fixing
  // 4. User clicks correct element → fix saved
  const [falsePositiveSteps, setFalsePositiveSteps] = useState<Map<string, {
    stepIndex: number;
    screenshot: string | null;
    markedAt: number;
    reason?: string;
  }>>(new Map());
  
  // Flag when test is stopped at a false positive step for repair
  const [stoppedAtFalsePositive, setStoppedAtFalsePositive] = useState<{
    stepIndex: number;
    actionId: string;
    screenshot: string | null;
  } | null>(null);
  
  // ============ AI ENHANCEMENTS STATE ============
  // AI-enhanced failure explanation (loaded on-demand when user clicks "Why?")
  const [aiExplanation, setAiExplanation] = useState<FailureExplanation | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);
  // Flaky step IDs for the current test (loaded after test run)
  const [flakyStepIds, setFlakyStepIds] = useState<Set<string>>(new Set());
  // Auto-fix state: tracks which steps are currently being auto-fixed by AI
  const [autoFixingSteps, setAutoFixingSteps] = useState<Set<number>>(new Set());
  const [autoFixResults, setAutoFixResults] = useState<Map<number, { success: boolean; message: string }>>(new Map());
  // Manual Assist: which step's ManualAssistCard is open (null = none)
  const [manualAssistStep, setManualAssistStep] = useState<number | null>(null);
  
  // Stable test ID — uses selected test case ID, or falls back to a session-unique ID
  const [sessionTestId] = useState(() => `session_${Date.now()}`);
  const currentTestId = selectedTestCase?.id || (actions as any)?._testId || sessionTestId;
  
  // ============ LOAD PERSISTED FALSE POSITIVES ON MOUNT ============
  // Restore false-positive flags from backend (survives page refresh)
  // Non-blocking: if backend is unavailable, existing in-memory flow works fine
  useEffect(() => {
    if (!currentTestId) return;
    
    getFalsePositivesApi(currentTestId).then((flags) => {
      if (flags && flags.length > 0) {
        setFalsePositiveSteps(prev => {
          const merged = new Map(prev);
          for (const flag of flags) {
            if (flag.step_id && !flag.resolved) {
              merged.set(flag.step_id, {
                stepIndex: flag.step_index,
                screenshot: null,
                markedAt: new Date(flag.flagged_at).getTime(),
                reason: flag.reason || undefined,
              });
            }
          }
          return merged;
        });
      }
    }).catch(() => {
      // Non-critical: backend unavailable — in-memory flow still works
    });

    // Also load flaky step data
    getFlakyStepsApi(currentTestId).then((flakySteps) => {
      if (flakySteps && flakySteps.length > 0) {
        const ids = new Set(flakySteps.filter(s => s.is_flaky).map(s => s.step_id));
        setFlakyStepIds(ids);
      }
    }).catch(() => {
      // Non-critical: flaky step data unavailable
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);  // Run once on mount
  
  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false);
  
  // AI Test Generator
  const [showAIGenerator, setShowAIGenerator] = useState(false);
  // AI Explorer Agent - Autonomous exploration
  const [showAIExplorer, setShowAIExplorer] = useState(false);
  // AI Flow Explorer - Full navigation graph discovery
  const [showAIFlowExplorer, setShowAIFlowExplorer] = useState(false);
  
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
  
  // Multi-select state for bulk linking recorded steps to manual steps
  const [selectedActionIndices, setSelectedActionIndices] = useState<Set<number>>(new Set());
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  
  // Clipboard for action copy/paste
  const [actionClipboard, setActionClipboard] = useState<RecordedAction[] | null>(null);
  
  // Timer ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const suggestIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Refs for event listener access to current state
  const modeRef = useRef(mode);
  const selectedTestCaseRef = useRef(selectedTestCase);
  const currentStepIndexRef = useRef(currentStepIndex);
  
  // Keep refs in sync with state
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { selectedTestCaseRef.current = selectedTestCase; }, [selectedTestCase]);
  useEffect(() => { currentStepIndexRef.current = currentStepIndex; }, [currentStepIndex]);

  // Auto-switch to Automate tab when entering 'existing' mode with a selected test case
  useEffect(() => {
    if (mode === 'existing' && selectedTestCase) {
      setRightPanelTab('automate');
    }
  }, [mode, selectedTestCase]);

  // Detect if current URL is Salesforce
  const isSalesforceUrl = useMemo(() => {
    const urlToCheck = currentUrl || url;
    return urlToCheck.includes('salesforce.com') || 
           urlToCheck.includes('.force.com') || 
           urlToCheck.includes('lightning.force') ||
           urlToCheck.includes('.my.salesforce');
  }, [currentUrl, url]);

  // State for "Record This Step" mode from Builder
  const [recordForStepContext, setRecordForStepContext] = useState<{
    testCaseId: string;
    testCaseName: string;
    stepId: string;
    stepIndex: number;
    stepName: string;
    stepType: string;
    manualDescription: string;
    expectedResult?: string;
  } | null>(null);

  // Check for "Record This Step" context from Builder on mount
  useEffect(() => {
    try {
      // Check URL params first
      const urlParams = new URLSearchParams(window.location.search);
      const modeParam = urlParams.get('mode');
      const stepIdParam = urlParams.get('stepId');
      const stepIndexParam = urlParams.get('stepIndex');
      
      if (modeParam === 'existing' && stepIdParam) {
        setMode('existing');
      }
      
      // Check localStorage for step context
      const recordForStepData = localStorage.getItem('recordForStep');
      if (recordForStepData) {
        const context = JSON.parse(recordForStepData);
        // Only use if recent (within 5 minutes)
        if (context.timestamp && Date.now() - context.timestamp < 5 * 60 * 1000) {
          setRecordForStepContext(context);
          setMode('existing');
          
          // Try to load the pending test case
          const pendingTestCase = localStorage.getItem('pendingTestCase');
          if (pendingTestCase) {
            const tc = JSON.parse(pendingTestCase);
            if (tc.id === context.testCaseId) {
              setSelectedTestCase({
                id: tc.id,
                name: tc.name,
                description: tc.description,
                steps: tc.steps || [],
                tags: tc.tags || [],
                automationStatus: tc.automationStatus || 'none',
              });
              // Set current step index
              if (typeof context.stepIndex === 'number') {
                setCurrentStepIndex(context.stepIndex);
              }
            }
          }
          
          toast.info(`Tracing for step ${context.stepIndex + 1}: ${context.stepName}`, {
            duration: 5000,
          });
        } else {
          // Clear stale data
          localStorage.removeItem('recordForStep');
        }
      }
      
      // Check for re-record context from builder (for fixing failed steps)
      const rerecordData = localStorage.getItem('flowstral_rerecord_context');
      if (rerecordData) {
        const context = JSON.parse(rerecordData);
        // Only use if recent (within 10 minutes)
        if (context.timestamp && Date.now() - context.timestamp < 10 * 60 * 1000) {
          setRerecordContext(context);
          setShowRerecordBanner(true);
          
          // Pre-populate URL if available from the failed step's context
          if (context.step?.url) {
            setUrl(context.step.url);
          }
          
          toast.info(`🔄 Re-trace Mode: Tracing replacement for step ${context.stepIndex + 1}`, {
            description: `"${context.step?.name || context.step?.type || 'Unknown step'}" in "${context.testCaseName}"`,
            duration: 8000,
          });
        } else {
          // Clear stale data
          localStorage.removeItem('flowstral_rerecord_context');
        }
      }
    } catch (e) {
      console.error('Failed to load recordForStep context:', e);
    }
  }, []);

  // ============ LOAD EXTENSION SESSION (Open in Desktop) ============
  // When user clicks "Open in Desktop" in the Chrome extension, we load the session here
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('sessionId');
    if (!sessionId) return;

    const loadExtensionSession = async () => {
      try {
        toast.info('Loading session from extension...', { duration: 3000 });
        const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions/${encodeURIComponent(sessionId)}`);
        if (!response.ok) {
          throw new Error(`Session not found: ${response.status}`);
        }
        const session = await response.json();
        const rawActions = session.actions || session.action_graph?.nodes || [];

        // Convert extension action format to desktop RecordedAction format
        const converted: RecordedAction[] = rawActions.map((a: any, i: number) => {
          const actionType = a.type || a.action || 'click';
          const selectorStr = typeof a.selector === 'string'
            ? a.selector
            : a.selector?.primary?.css || a.selector?.selector || a.selector?.playwright || '';
          return {
            id: a.id || a.node_id || `step-${i}`,
            qword: actionType,
            args: selectorStr ? [selectorStr] : [],
            description: a.description || a.label || `${actionType} ${selectorStr ? 'on ' + selectorStr.substring(0, 40) : 'step'}`,
            timestamp: a.timestamp || Date.now(),
            selector: a.selector || selectorStr,
            type: actionType,
            value: a.value || '',
          };
        });

        if (converted.length > 0) {
          setActions(converted);
          toast.success(`Loaded ${converted.length} steps from extension session`, { duration: 4000 });
        } else {
          toast.warning('Session found but contains no actions');
        }
      } catch (error: any) {
        console.error('[Recorder] Failed to load extension session:', error);
        toast.error(`Failed to load session: ${error.message}`);
      }
    };

    loadExtensionSession();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ============ PANEL RESIZE HANDLERS ============
  // Handle mouse move during resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;
      
      // Clamp between 30% and 75%
      const clampedWidth = Math.min(75, Math.max(30, newWidth));
      setLeftPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isResizing) {
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

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

  // Load test data on mount - includes scale database for enterprise data
  useEffect(() => {
    const loadTestData = async () => {
      try {
        const allCases: TestCase[] = [];
        const seenIds = new Set<string>();
        
        // 1. Try scale database first (most test cases)
        try {
          const response = await fetch(`${API_BASE_URL}/test-cases/scale-data`);
          if (response.ok) {
            const data = await response.json();
            for (const tc of (data.testCases || [])) {
              if (tc.id && !seenIds.has(tc.id)) {
                seenIds.add(tc.id);
                allCases.push({
                  id: tc.id,
                  name: tc.name,
                  description: tc.description || '',
                  folderId: tc.folder_id || null,
                  folderName: tc.folder_name,
                  priority: tc.priority || 'medium',
                  automationStatus: tc.automation_status || 'none',
                  tags: tc.tags || [],
                  steps: tc.steps || [],
                  createdAt: tc.created_at,
                  updatedAt: tc.updated_at
                });
              }
            }
          }
        } catch (e) {
          // Scale DB not available - continue with other sources
        }
        
        // 2. Try Electron storage
        const electronAPI = (window as any).electronAPI;
        if (electronAPI?.localStorage?.getAllTestCases) {
          const cases = await electronAPI.localStorage.getAllTestCases();
          for (const tc of (cases || [])) {
            if (tc.id && !seenIds.has(tc.id)) {
              seenIds.add(tc.id);
              allCases.push(tc);
            }
          }
        }
        
        // 3. Fallback to localStorage
        const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
        for (const tc of localCases) {
          if (tc.id && !seenIds.has(tc.id)) {
            seenIds.add(tc.id);
            allCases.push(tc);
          }
        }
        for (const tc of flowstralCases) {
          if (tc.id && !seenIds.has(tc.id)) {
            seenIds.add(tc.id);
            allCases.push(tc);
          }
        }
        
        // Sort by updatedAt descending (newest first)
        allCases.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
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
    
    // Sort by updatedAt (newest first) so recently merged/updated tests appear at top
    filtered.sort((a, b) => {
      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA; // Descending (newest first)
    });
    
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

  // Assign a recorded action to the current step
  const assignRecordedActionToStep = useCallback((action: RecordedAction) => {
    if (!selectedTestCase || mode !== 'existing') return;
    
    const manualSteps = selectedTestCase.steps || [];
    if (currentStepIndex >= manualSteps.length) return;
    
    setStepAutomation(prev => ({
      ...prev,
      [currentStepIndex]: { type: 'recorded', data: action }
    }));
    
    // Auto-advance to next unassigned step
    const nextIndex = findNextUnassignedStep(currentStepIndex + 1);
    if (nextIndex !== -1) {
      setCurrentStepIndex(nextIndex);
    }
    
    toast.success(`Step ${currentStepIndex + 1} automated with trace`);
  }, [selectedTestCase, mode, currentStepIndex]);
  
  // Assign a DOM suggestion to the current step
  const assignSuggestionToStep = useCallback((suggestion: Suggestion) => {
    if (!selectedTestCase || mode !== 'existing') {
      // In 'new' mode, just add as a regular action
      return false;
    }
    
    const manualSteps = selectedTestCase.steps || [];
    if (currentStepIndex >= manualSteps.length) return false;
    
    setStepAutomation(prev => ({
      ...prev,
      [currentStepIndex]: { type: 'suggested', data: suggestion }
    }));
    
    // Auto-advance to next unassigned step
    const nextIndex = findNextUnassignedStep(currentStepIndex + 1);
    if (nextIndex !== -1) {
      setCurrentStepIndex(nextIndex);
    }
    
    toast.success(`Step ${currentStepIndex + 1} automated with suggestion`);
    return true;
  }, [selectedTestCase, mode, currentStepIndex]);
  
  // Skip the current step (mark as manual)
  const skipCurrentStep = useCallback(() => {
    if (!selectedTestCase || mode !== 'existing') return;
    
    const manualSteps = selectedTestCase.steps || [];
    if (currentStepIndex >= manualSteps.length) return;
    
    setStepAutomation(prev => ({
      ...prev,
      [currentStepIndex]: { type: 'skipped' }
    }));
    
    // Auto-advance to next unassigned step
    const nextIndex = findNextUnassignedStep(currentStepIndex + 1);
    if (nextIndex !== -1) {
      setCurrentStepIndex(nextIndex);
    }
    
    toast.info(`Step ${currentStepIndex + 1} marked as manual`);
  }, [selectedTestCase, mode, currentStepIndex]);
  
  // Find next step that hasn't been assigned yet
  const findNextUnassignedStep = useCallback((startIndex: number): number => {
    if (!selectedTestCase) return -1;
    const manualSteps = selectedTestCase.steps || [];
    
    for (let i = startIndex; i < manualSteps.length; i++) {
      if (!stepAutomation[i]) {
        return i;
      }
    }
    return -1; // All steps assigned
  }, [selectedTestCase, stepAutomation]);
  
  // Clear automation for a specific step
  const clearStepAutomation = useCallback((stepIndex: number) => {
    setStepAutomation(prev => {
      const updated = { ...prev };
      delete updated[stepIndex];
      return updated;
    });
    // Also clear from enhanced links
    setStepLinks(prev => {
      const updated = { ...prev };
      delete updated[stepIndex];
      return updated;
    });
  }, []);

  // Link a recorded action to a step (enhanced - supports multiple actions)
  const linkActionToStep = useCallback((stepIndex: number, action: RecordedAction | Suggestion, source: 'recorded' | 'suggested' = 'recorded') => {
    const automationAction = convertRecordedAction({
      ...action,
      source,
    });
    
    setStepLinks(prev => {
      const existing = prev[stepIndex] || { actions: [], linkMode: defaultLinkMode, isComplete: false };
      
      // If grouping disabled, replace existing action
      if (!groupingEnabled) {
        return {
          ...prev,
          [stepIndex]: {
            ...existing,
            actions: [automationAction],
          }
        };
      }
      
      // Otherwise add to existing actions
      return {
        ...prev,
        [stepIndex]: {
          ...existing,
          actions: [...existing.actions, automationAction],
        }
      };
    });
    
    // Auto-advance to next step if enabled
    if (autoAdvance && selectedTestCase) {
      const manualSteps = selectedTestCase.steps || [];
      let nextIdx = -1;
      for (let i = stepIndex + 1; i < manualSteps.length; i++) {
        if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
          nextIdx = i;
          break;
        }
      }
      if (nextIdx !== -1) {
        setCurrentStepIndex(nextIdx);
      }
    }
    
    toast.success(`Action linked to step ${stepIndex + 1}`, { duration: 1500 });
  }, [defaultLinkMode, groupingEnabled, autoAdvance, selectedTestCase, stepLinks]);

  // Remove a specific action from a step's linked actions
  const removeActionFromStep = useCallback((stepIndex: number, actionId: string) => {
    setStepLinks(prev => {
      const existing = prev[stepIndex];
      if (!existing) return prev;
      
      const newActions = existing.actions.filter(a => a.id !== actionId);
      if (newActions.length === 0) {
        const { [stepIndex]: _, ...rest } = prev;
        return rest;
      }
      return {
        ...prev,
        [stepIndex]: { ...existing, actions: newActions }
      };
    });
  }, []);

  // ============ MANUAL SELECTOR OVERRIDE FUNCTIONS ============
  // Open the edit selector modal for an action
  const openEditSelectorModal = useCallback((index: number) => {
    const action = actions[index];
    if (!action) return;
    
    // Pre-populate with existing selectors
    const existingSelector = action.selectorObj?.manualOverride || 
                             action.selectorObj?.playwright || 
                             action.selectorObj?.selector || 
                             '';
    const existingText = action.selectorObj?.text || 
                         action.args?.[0] || 
                         '';
    
    setEditingActionIndex(index);
    setManualSelectorInput(existingSelector);
    setManualTextInput(existingText);
    setEditSelectorModalOpen(true);
  }, [actions]);

  // Save the manual selector override
  const saveManualSelector = useCallback(() => {
    if (editingActionIndex === null) return;
    
    setActions(prev => prev.map((action, idx) => {
      if (idx !== editingActionIndex) return action;
      
      // Add the manual override to selectorObj
      return {
        ...action,
        selectorObj: {
          ...action.selectorObj,
          manualOverride: manualSelectorInput.trim() || undefined,
          text: manualTextInput.trim() || action.selectorObj?.text,
        },
        // Also update args[0] if it's a click action with text
        args: manualTextInput.trim() && action.qword === 'Click' 
          ? [manualTextInput.trim(), ...(action.args?.slice(1) || [])]
          : action.args,
      };
    }));
    
    setEditSelectorModalOpen(false);
    setEditingActionIndex(null);
    toast.success('Selector updated! The playback will use your override.', { duration: 3000 });
  }, [editingActionIndex, manualSelectorInput, manualTextInput]);

  // Change link mode for a step
  const changeStepLinkMode = useCallback((stepIndex: number, mode: LinkMode) => {
    setStepLinks(prev => {
      const existing = prev[stepIndex];
      if (!existing) return prev;
      return {
        ...prev,
        [stepIndex]: { ...existing, linkMode: mode }
      };
    });
  }, []);

  // Mark step linking as complete
  const markStepComplete = useCallback((stepIndex: number) => {
    setStepLinks(prev => {
      const existing = prev[stepIndex];
      if (!existing) return prev;
      return {
        ...prev,
        [stepIndex]: { ...existing, isComplete: true }
      };
    });
  }, []);

  // Toggle selection of an action for multi-select
  const toggleActionSelection = useCallback((index: number, event?: React.MouseEvent) => {
    setSelectedActionIndices(prev => {
      const newSet = new Set(prev);
      
      // Shift+click for range selection
      if (event?.shiftKey && prev.size > 0) {
        const lastSelected = Math.max(...prev);
        const start = Math.min(lastSelected, index);
        const end = Math.max(lastSelected, index);
        for (let i = start; i <= end; i++) {
          newSet.add(i);
        }
      } else if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  // Select all actions
  const selectAllActions = useCallback(() => {
    setSelectedActionIndices(new Set(actions.map((_, i) => i)));
  }, [actions]);

  // Clear all selections
  const clearAllSelections = useCallback(() => {
    setSelectedActionIndices(new Set());
  }, []);

  // Select range of actions
  const selectActionRange = useCallback((start: number, end: number) => {
    const indices = new Set<number>();
    for (let i = start; i <= end; i++) {
      indices.add(i);
    }
    setSelectedActionIndices(indices);
  }, []);

  // Link all selected actions to the current manual step
  const linkSelectedActionsToStep = useCallback(() => {
    if (!selectedTestCase || selectedActionIndices.size === 0) return;
    
    const sortedIndices = Array.from(selectedActionIndices).sort((a, b) => a - b);
    const selectedActions = sortedIndices.map(i => actions[i]);
    
    // Convert to AutomationActions and link to current step
    const automationActions = selectedActions.map(action => convertRecordedAction({
      ...action,
      source: 'recorded',
    }));
    
    setStepLinks(prev => {
      const existing = prev[currentStepIndex] || { actions: [], linkMode: defaultLinkMode, isComplete: false };
      return {
        ...prev,
        [currentStepIndex]: {
          ...existing,
          actions: [...existing.actions, ...automationActions],
        }
      };
    });
    
    toast.success(`Linked ${selectedActionIndices.size} action(s) to step ${currentStepIndex + 1}`, {
      duration: 2000,
    });
    
    // Clear selection after linking
    setSelectedActionIndices(new Set());
    
    // Auto-advance to next step if enabled
    if (autoAdvance && selectedTestCase) {
      const manualSteps = selectedTestCase.steps || [];
      for (let i = currentStepIndex + 1; i < manualSteps.length; i++) {
        if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
          setCurrentStepIndex(i);
          break;
        }
      }
    }
  }, [selectedTestCase, selectedActionIndices, actions, currentStepIndex, defaultLinkMode, autoAdvance, stepLinks]);

  // Link selected actions to a SPECIFIC step (used when clicking a step in the Automate tab)
  const handleLinkSelectedActions = useCallback((targetStepIndex: number) => {
    if (!selectedTestCase || selectedActionIndices.size === 0) return;
    
    const sortedIndices = Array.from(selectedActionIndices).sort((a, b) => a - b);
    const selectedActions = sortedIndices.map(i => actions[i]);
    
    // Convert to AutomationActions
    const automationActions = selectedActions.map(action => convertRecordedAction({
      ...action,
      source: 'recorded',
    }));
    
    // Link to the TARGET step index (not currentStepIndex)
    setStepLinks(prev => {
      const existing = prev[targetStepIndex] || { actions: [], linkMode: defaultLinkMode, isComplete: false };
      return {
        ...prev,
        [targetStepIndex]: {
          ...existing,
          actions: [...existing.actions, ...automationActions],
        }
      };
    });
    
    const stepName = selectedTestCase.steps?.[targetStepIndex]?.name || `Step ${targetStepIndex + 1}`;
    toast.success(`Linked ${selectedActionIndices.size} action(s) to "${stepName}"`, {
      duration: 2000,
    });
    
    // Clear selection after linking
    setSelectedActionIndices(new Set());
    setIsMultiSelectMode(false);
    
    // Auto-advance to next unlinked step if enabled
    if (autoAdvance && selectedTestCase) {
      const manualSteps = selectedTestCase.steps || [];
      for (let i = targetStepIndex + 1; i < manualSteps.length; i++) {
        if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
          setCurrentStepIndex(i);
          break;
        }
      }
    }
  }, [selectedTestCase, selectedActionIndices, actions, defaultLinkMode, autoAdvance, stepLinks]);
  
  // Smart merge using enhanced step linking (supports many-to-one)
  const performMerge = useCallback(() => {
    if (!selectedTestCase) return;
    
    const manualSteps = selectedTestCase.steps || [];
    const merged: any[] = [];
    
    // Check for new enhanced step links first
    const hasEnhancedLinks = Object.keys(stepLinks).length > 0;
    const hasLegacyMappings = Object.keys(stepAutomation).length > 0;
    
    if (hasEnhancedLinks) {
      // Use enhanced linking system (supports multiple actions per step)
      for (let i = 0; i < manualSteps.length; i++) {
        const manualStep = manualSteps[i];
        const link = stepLinks[i];
        
        if (link && link.actions.length > 0) {
          // Create linked step using the automation-linking library
          const linkedStep = createLinkedStep(manualStep, link.actions, link.linkMode);
          const mergedStep = mergeToStep(linkedStep);
          
          merged.push({
            ...mergedStep,
            _merged: true,
            _hasMultipleActions: link.actions.length > 1,
            _linkMode: link.linkMode,
          });
        } else {
          // No automation - keep as manual
          merged.push({
            ...manualStep,
            automationStatus: manualStep.qword ? 'automated' : 'manual',
            _manualOnly: !manualStep.qword
          });
        }
      }
    } else if (hasLegacyMappings) {
      // Legacy step automation mappings (single action per step)
      for (let i = 0; i < manualSteps.length; i++) {
        const manualStep = manualSteps[i];
        const automation = stepAutomation[i];
        
        if (automation?.type === 'recorded' && automation.data) {
          const action = automation.data as RecordedAction;
          merged.push({
            ...manualStep,
            qword: action.qword,
            args: action.args,
            selector: action.selectorObj?.selector || action.selector,
            selectorObj: action.selectorObj,
            automationStatus: 'automated',
            _merged: true
          });
        } else if (automation?.type === 'suggested' && automation.data) {
          const suggestion = automation.data as Suggestion;
          merged.push({
            ...manualStep,
            qword: suggestion.qword,
            args: suggestion.args,
            selector: suggestion.selectorObj?.selector || suggestion.selector,
            selectorObj: suggestion.selectorObj,
            automationStatus: 'automated',
            _merged: true
          });
        } else if (automation?.type === 'skipped') {
          merged.push({
            ...manualStep,
            automationStatus: 'manual',
            _manualOnly: true
          });
        } else {
          // No automation assigned - keep as manual
          merged.push({
            ...manualStep,
            automationStatus: manualStep.qword ? 'automated' : 'manual',
            _manualOnly: !manualStep.qword
          });
        }
      }
    } else {
      // Fallback to position-based merge (legacy behavior)
      const maxLength = Math.max(manualSteps.length, actions.length);
      
      for (let i = 0; i < maxLength; i++) {
        const manualStep = manualSteps[i];
        const recordedAction = actions[i];
        
        if (manualStep && recordedAction) {
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
          merged.push({
            ...manualStep,
            automationStatus: manualStep.qword ? 'automated' : 'manual',
            _manualOnly: !manualStep.qword
          });
        } else if (recordedAction) {
          merged.push({
            id: `step_${Date.now()}_${i}`,
            name: recordedAction.description || `${recordedAction.qword} ${recordedAction.args?.[0] || ''}`,
            description: recordedAction.description,
            qword: recordedAction.qword,
            args: recordedAction.args,
            selector: recordedAction.selectorObj?.selector,
            selectorObj: recordedAction.selectorObj,
            automationStatus: 'automated',
            _extra: true
          });
        }
      }
    }
    
    if (merged.length === 0) {
      toast.error('No steps to merge');
      return;
    }
    
    setMergedSteps(merged);
    setShowMergePreview(true);
  }, [selectedTestCase, stepLinks, stepAutomation, actions]);

  // Map qword to Builder step type
  const qwordToType = (qword: string): string => {
    if (!qword) return 'click';
    const q = qword.toLowerCase();
    if (q === 'goto' || q === 'navigate') return 'navigate';
    if (q === 'fill' || q === 'type' || q === 'input') return 'input';
    if (q === 'click' || q === 'clicktext' || q === 'clickelement') return 'click';
    if (q === 'select') return 'select';
    if (q === 'hover') return 'hover';
    if (q === 'wait' || q === 'waitforelement' || q === 'waitfortext') return 'wait';
    if (q === 'asserttext' || q === 'assert' || q === 'assertelement') return 'assert';
    if (q === 'screenshot') return 'screenshot';
    if (q === 'press' || q === 'keyboard') return 'press';
    if (q === 'scroll') return 'scroll';
    return 'click';
  };

  // Save merged test case
  const saveMergedTest = async () => {
    if (!selectedTestCase || mergedSteps.length === 0) return;
    
    // Calculate automation status: full if ALL steps have automation, partial if SOME do, none if NONE do
    const stepsWithAutomation = mergedSteps.filter(s => s.qword || s.selector || s.selectorObj);
    const automationStatus: 'none' | 'partial' | 'full' = 
      stepsWithAutomation.length === 0 ? 'none' :
      stepsWithAutomation.length === mergedSteps.length ? 'full' : 'partial';
    
    // Convert merged steps to proper format for both Builder AND Executor
    // Builder needs: type, name, selector, value, url
    // Executor needs: qword, args, selectorObj
    const formattedSteps = mergedSteps.map((s, idx) => {
      const { _merged, _manualOnly, _extra, ...step } = s;
      
      // Ensure step has a proper 'type' for Builder (derived from qword if not present)
      const type = step.type || qwordToType(step.qword || '');
      
      // Extract value from args if not present
      let value = step.value || '';
      if (!value && step.args && step.args.length > 0) {
        // For Fill/Type, first arg is usually the value
        if (type === 'input' || step.qword?.toLowerCase() === 'fill') {
          value = step.args[0] || '';
        }
      }
      
      // Extract URL from args for navigate steps
      let url = step.url || '';
      if (!url && type === 'navigate' && step.args && step.args.length > 0) {
        url = step.args[0] || '';
      }
      
      return {
        ...step,
        id: step.id || `step_${Date.now()}_${idx}`,
        type: type,
        name: step.name || step.description || `Step ${idx + 1}`,
        enabled: step.enabled !== false,
        // Builder display properties
        selector: step.selector || step.selectorObj?.selector || '',
        selectorObj: step.selectorObj,
        value: value,
        url: url,
        // Executor properties (preserve for running)
        qword: step.qword,
        args: step.args,
      };
    });
    
    const updatedTestCase: TestCase = {
      ...selectedTestCase,
      steps: formattedSteps,
      automationStatus,
      updatedAt: new Date().toISOString(), // Update timestamp so it appears at top
      // Store unified_data so Builder can load with full step format preserved
      unified_data: {
        name: selectedTestCase.name,
        description: selectedTestCase.description,
        steps: formattedSteps,
        settings: selectedTestCase.settings || {},
      },
    };
    
    try {
      // Save to localStorage (test_cases) - also remove any duplicates by name
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      // Remove any entries with same name OR same ID (to avoid duplicates)
      const cleanedLocal = localCases.filter((tc: any) => 
        tc.id !== updatedTestCase.id && tc.name !== updatedTestCase.name
      );
      cleanedLocal.push(updatedTestCase);
      localStorage.setItem('test_cases', JSON.stringify(cleanedLocal));
      
      // Also update flowstral_test_cases - remove duplicates by name/ID
      const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
      const cleanedFlowstral = flowstralCases.filter((tc: any) => 
        tc.id !== updatedTestCase.id && tc.name !== updatedTestCase.name
      );
      cleanedFlowstral.push(updatedTestCase);
      localStorage.setItem('flowstral_test_cases', JSON.stringify(cleanedFlowstral));
      
      // Also update individual unified_test_case entry
      localStorage.setItem(`unified_test_case_${updatedTestCase.id}`, JSON.stringify(updatedTestCase));
      
      // Remove any legacy unified_test_case entries with same name but different ID
      const unifiedKeys = Object.keys(localStorage).filter(k => k.startsWith('unified_test_case_'));
      for (const key of unifiedKeys) {
        try {
          const tc = JSON.parse(localStorage.getItem(key) || '{}');
          if (tc.name === updatedTestCase.name && tc.id !== updatedTestCase.id) {
            localStorage.removeItem(key);
            if (import.meta.env.DEV) console.log(`[Recorder] Removed duplicate unified entry: ${key}`);
          }
        } catch {
            // Non-critical: duplicate localStorage entry could not be parsed — skip it
          }
      }
      
      // Also update backend (PostgreSQL) if available
      try {
        const backendResponse = await fetch(`${API_BASE_URL}/test-cases/${updatedTestCase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: updatedTestCase.name,
            description: updatedTestCase.description,
            steps: updatedTestCase.steps,
            automation_status: automationStatus,
            tags: updatedTestCase.tags || [],
          })
        });
        if (backendResponse.ok) {
          if (import.meta.env.DEV) console.log(`[Recorder] Updated test case ${updatedTestCase.id} in PostgreSQL backend`);
        } else {
          console.warn(`[Recorder] PostgreSQL update failed with status: ${backendResponse.status}`);
        }
      } catch (e) {
        console.warn('[Recorder] PostgreSQL update failed:', e);
      }
      
      // Also update SQLite scale database if using it
      try {
        const scaleResponse = await fetch(`${API_BASE_URL}/test-cases/scale-data/update/${updatedTestCase.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: updatedTestCase.id,
            name: updatedTestCase.name,
            automation_status: automationStatus,
            steps: updatedTestCase.steps,
            updated_at: updatedTestCase.updatedAt
          })
        });
        if (scaleResponse.ok) {
          if (import.meta.env.DEV) console.log(`[Recorder] Updated test case ${updatedTestCase.id} in SQLite scale DB`);
        }
      } catch (e) {
        // SQLite update is optional - don't warn if not available
      }
      
      // Trigger reload in Test Repository if it's open
      window.dispatchEvent(new CustomEvent('reload-test-cases'));
      
      // Update state - put updated test case first so it appears at top
      setAllTestCases(prev => {
        const filtered = prev.filter(tc => tc.id !== updatedTestCase.id);
        return [updatedTestCase, ...filtered]; // Put at front so it appears at top
      });
      
      // Log detailed step info for debugging
      if (import.meta.env.DEV) {
        console.log('[Recorder] Merged test saved:', updatedTestCase.id, 'status:', automationStatus, 'steps:', updatedTestCase.steps?.length);
        console.log('[Recorder] Step details:', updatedTestCase.steps?.map((s, i) => ({
          idx: i,
          type: s.type,
          qword: s.qword,
          hasArgs: !!s.args,
          hasSelector: !!s.selector || !!s.selectorObj,
          name: s.name?.substring(0, 30)
        })));
      }
      toast.success(`Merged ${stepsWithAutomation.length} automated steps into "${selectedTestCase.name}" (${automationStatus})`);
      setShowMergePreview(false);
      setSelectedTestCase(null);
      setActions([]);
      setStepAutomation({});  // Reset step automation mapping
      setCurrentStepIndex(0);
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
      // Always add to actions list for display
      setActions(prev => {
        if (prev.some(a => a.id === action.id)) return prev;
        return [...prev, action];
      });
      
      // In 'existing' mode, also assign to current step (use refs for current values)
      if (modeRef.current === 'existing' && selectedTestCaseRef.current) {
        const stepIdx = currentStepIndexRef.current;
        const manualSteps = selectedTestCaseRef.current.steps || [];
        if (stepIdx < manualSteps.length) {
          setStepAutomation(prev => ({
            ...prev,
            [stepIdx]: { type: 'recorded', data: action }
          }));
          // Find next unassigned step
          let nextIdx = -1;
          for (let i = stepIdx + 1; i < manualSteps.length; i++) {
            // Check if step i is not in prev automation
            // We can't access prev here easily, so just increment
            nextIdx = i;
            break;
          }
          if (nextIdx !== -1) {
            setCurrentStepIndex(nextIdx);
          }
          toast.success(`Step ${stepIdx + 1} automated`);
        }
      }
    });

    const unsubStopped = flowstral.on('playwright-recorder-stopped', ({ actions: finalActions }: { actions: RecordedAction[] }) => {
      // Merge recorded actions with manually added ones (SF Tools, Test Helpers, etc.)
      setActions(prev => {
        // Keep manually added actions - these have known prefixes from our Test Helpers panel
        const manualPrefixes = [
          'action_', 'assert_', 'nav_', 'create_', 'soqlnav_', 'gsearch_', 
          'search_', 'util_', 'rec_', 'tab_', 'flow_', 'test_helper_', 'sf_'
        ];
        
        const isManualAction = (id: string) => {
          return manualPrefixes.some(prefix => id.startsWith(prefix));
        };
        
        const manualActions = prev.filter(a => {
          const id = a.id || '';
          const isSfType = (a.type || '').startsWith('sf-');
          return isManualAction(id) || isSfType;
        });
        
        // Get recorded actions, removing duplicates
        const manualDescriptions = new Set(manualActions.map(a => a.description));
        const recordedOnly = (finalActions || []).filter(a => !manualDescriptions.has(a.description));
        
        // CRITICAL: Use getDisplayActions to deduplicate fills BEFORE storing
        // This ensures the array itself has no duplicates, not just the display
        const deduplicatedRecorded = getDisplayActions(recordedOnly);
        
        // Combine: recorded actions first, then manually added actions
        if (deduplicatedRecorded.length > 0 || manualActions.length > 0) {
          const combined = [...deduplicatedRecorded, ...manualActions].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
          );
          if (import.meta.env.DEV) console.log(`[Recorder] Stopped: ${finalActions?.length} -> ${deduplicatedRecorded.length} deduplicated + ${manualActions.length} manual`);
          return combined;
        }
        return prev;
      });
      setIsRecording(false);
      setIsPaused(false);
    });

    // Handle actions-reordered: replace entire actions list with correctly ordered list
    const unsubRefresh = flowstral.on('playwright-recorder-actions-refresh', ({ actions: reorderedActions }: { actions: RecordedAction[] }) => {
      if (reorderedActions?.length > 0) {
        if (import.meta.env.DEV) console.log(`[Recorder] Actions reordered, refreshing list (${reorderedActions.length} actions)`);
        setActions(reorderedActions);
      }
    });

      flowstral.playwrightRecorder?.isRecording?.().then((recording: boolean) => {
      setIsRecording(recording);
      if (recording) {
        flowstral.playwrightRecorder.getActions().then((acts: RecordedAction[]) => {
          if (acts?.length > 0) setActions(acts);
        });
      }
    });

      return () => { unsubAction?.(); unsubStopped?.(); unsubRefresh?.(); };
    }
    
    if (electronAPI?.on) {
      const unsubAction = electronAPI.on('action-recorded', (action: RecordedAction) => {
        // Filter out garbage actions during recording (React internals, imports, etc.)
        if (isGarbageAction(action)) {
          if (import.meta.env.DEV) console.log('[Record] BLOCKED garbage action:', action.description?.slice(0, 50));
          return;
        }
        setActions(prev => [...prev, action]);
      });
      const unsubUrl = electronAPI.on('browser-url-changed', (newUrl: string) => {
        setCurrentUrl(newUrl);
        if (newUrl.startsWith('http')) setUrl(newUrl);
      });
      return () => { unsubAction?.(); unsubUrl?.(); };
    }
  }, []);

  // Auto-scroll to newly added actions
  useEffect(() => {
    // Only scroll if a new action was added (not on initial load or removals)
    if (actions.length > prevActionsLengthRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        actionsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }
    prevActionsLengthRef.current = actions.length;
  }, [actions.length]);

  // Switch to a step's tab context before opening Smart Suggestions
  const switchToStepTabAndRefresh = async (stepIndex: number) => {
    const flowstral = (window as any).flowstral;
    const action = actions[stepIndex] as any;
    if (action?.tabIndex !== undefined && action.tabIndex >= 0) {
      try {
        if (flowstral?.playwrightRecorder?.switchTabContext) {
          await flowstral.playwrightRecorder.switchTabContext(action.tabIndex);
        }
      } catch (e) {
        console.warn('Failed to switch tab context for step', stepIndex, e);
      }
    }
    handleRefreshSuggestions();
  };

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
        rawResponse = await flowstral.playwrightRecorder.analyze();
      } else if (electronAPI?.suggestActions) {
        rawResponse = await electronAPI.suggestActions();
      } else if (electronAPI?.getPageElements) {
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
        // Only update if suggestions actually changed (prevents blinking)
        const newKey = result.suggestions.map(s => s.element || s.description).join('|');
        if (newKey !== lastSuggestionsRef.current) {
          lastSuggestionsRef.current = newKey;
          setSuggestResult(result);
        }
      } else if (!suggestResult?.suggestions?.length) {
        // Only set empty if we don't already have suggestions
        setSuggestResult({ suggestions: [], categories: {}, counts: {}, timing: 'now', total: 0 });
      }
    } catch (error) {
      console.error('[Recorder] Failed to get suggestions:', error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  // Grouped suggestions — uses imported groupSuggestions helper
  const groupedSuggestions = useMemo(
    () => groupSuggestions(suggestResult, suggestionSearch),
    [suggestResult, suggestionSearch]
  );

  // Category counts — uses imported getCategoryCounts helper
  const categoryCounts = useMemo(
    () => getCategoryCounts(suggestResult, groupedSuggestions),
    [groupedSuggestions, suggestResult]
  );

  const totalSuggestions = useMemo(() => {
    return Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  }, [categoryCounts]);

  // Execute action on page (requires active recording session)
  const executeAction = async (suggestion: Suggestion) => {
    const electronAPI = (window as any).electronAPI;
    const flowstral = (window as any).flowstral;
    
    // Check if recording is active first
    if (!isRecording) {
      toast.error('Start tracing first to execute actions', { id: 'exec', duration: 3000 });
      return;
    }
    
    try {
      toast.loading('Executing...', { id: 'exec' });
      
      let result;
      // Build action with all available metadata for robust element finding
      const actionPayload = {
        type: suggestion.type || suggestion.qword,
        qword: suggestion.qword,
        args: suggestion.args,
        label: suggestion.args?.[0] || suggestion.element,
        selector: suggestion.selector,
        selectorObj: suggestion.selectorObj,
        inputType: (suggestion as any).inputType,
        // For fill-type suggestions executed via Play button, just click/focus the input
        // (don't fill with empty string - that's confusing)
        executeMode: 'click-only'
      };
      
      if (flowstral?.playwrightRecorder?.executeAction) {
        result = await flowstral.playwrightRecorder.executeAction(actionPayload);
      } else if (electronAPI?.executeAction) {
        result = await electronAPI.executeAction(actionPayload);
      }
      
      if (result?.success !== false) {
        toast.success('Done!', { id: 'exec' });
      } else {
        const errorMsg = result?.error || 'Failed';
        // Provide more helpful error messages
        if (errorMsg.toLowerCase().includes('no browser')) {
          toast.error('Browser not active. Start tracing first.', { id: 'exec', duration: 3000 });
        } else {
          toast.error(errorMsg, { id: 'exec' });
        }
      }
    } catch (error: any) {
      const msg = error?.message || 'Failed to execute';
      if (msg.toLowerCase().includes('no browser')) {
        toast.error('Browser not active. Start tracing first.', { id: 'exec', duration: 3000 });
      } else {
        toast.error(msg, { id: 'exec' });
      }
    }
  };

  // Add suggestion to test (with fill value prompt for input-type suggestions)
  const addToTest = (suggestion: Suggestion, fillValue?: string) => {
    const isFillType = suggestion.qword === 'Fill' || suggestion.type === 'fill' || suggestion.category === 'input';
    
    // For fill-type suggestions, prompt for value if not already provided
    if (isFillType && fillValue === undefined) {
      const label = suggestion.element || suggestion.args?.[0] || 'this field';
      const value = window.prompt(`Enter value to fill in "${label}":`, '');
      if (value === null) return; // User cancelled
      fillValue = value;
    }
    
    const newAction: RecordedAction = {
      id: `action_${Date.now()}`,
      qword: suggestion.qword,
      args: isFillType 
        ? [suggestion.args?.[0] || suggestion.element || '', fillValue || '']  // [label, value]
        : suggestion.args,
      description: isFillType 
        ? `Fill "${suggestion.element || suggestion.args?.[0]}" with "${fillValue || ''}"`
        : suggestion.description,
      timestamp: Date.now(),
      selectorObj: suggestion.selectorObj,
      value: isFillType ? fillValue : undefined,
      selector: suggestion.selector
    };
    
    // In 'existing' mode, assign to current step
    if (mode === 'existing' && selectedTestCase) {
      const manualSteps = selectedTestCase.steps || [];
      if (currentStepIndex < manualSteps.length) {
        setStepAutomation(prev => ({
          ...prev,
          [currentStepIndex]: { type: 'suggested', data: { ...suggestion, value: fillValue } }
        }));
        
        // Find next unassigned step
        let nextIdx = -1;
        for (let i = currentStepIndex + 1; i < manualSteps.length; i++) {
          if (!stepAutomation[i]) {
            nextIdx = i;
            break;
          }
        }
        if (nextIdx !== -1) {
          setCurrentStepIndex(nextIdx);
        }
        
        toast.success(`Step ${currentStepIndex + 1} automated with suggestion`, { duration: 1500 });
      } else {
        // All steps assigned, just add to regular actions
        setActions(prev => [...prev, newAction]);
        toast.success('Added fill step to test', { duration: 1500 });
      }
    } else {
      // Normal mode - just add to actions
      setActions(prev => [...prev, newAction]);
      toast.success(isFillType ? `Added fill step: "${fillValue}"` : 'Added to test steps', { duration: 1500 });
    }
  };

  // Replace a failed/flagged step with a suggestion from Smart Suggestions panel
  const replaceStepWithSuggestion = (stepIndex: number, suggestion: Suggestion) => {
    const isFillType = suggestion.qword === 'Fill' || suggestion.type === 'fill' || suggestion.category === 'input';
    let fillValue: string | undefined;
    
    // For fill-type suggestions, prompt for value
    if (isFillType) {
      const label = suggestion.element || suggestion.args?.[0] || 'this field';
      // Try to get existing value from the step being replaced
      const existingValue = actions[stepIndex]?.value || actions[stepIndex]?.args?.[1] || '';
      const value = window.prompt(`Enter value to fill in "${label}":`, existingValue);
      if (value === null) return; // User cancelled
      fillValue = value;
    }
    
    const newAction: RecordedAction = {
      id: `action_${Date.now()}`,
      qword: suggestion.qword,
      args: isFillType 
        ? [suggestion.args?.[0] || suggestion.element || '', fillValue || '']
        : suggestion.args,
      description: isFillType 
        ? `Fill "${suggestion.element || suggestion.args?.[0]}" with "${fillValue || ''}"`
        : suggestion.description,
      timestamp: Date.now(),
      selectorObj: suggestion.selectorObj,
      value: isFillType ? fillValue : undefined,
      selector: suggestion.selector
    };
    
    // Replace the action at stepIndex
    setActions(prev => {
      const newActions = [...prev];
      if (stepIndex >= 0 && stepIndex < newActions.length) {
        newActions[stepIndex] = newAction;
      }
      return newActions;
    });
    
    // Clear the false positive flag if set
    const oldAction = actions[stepIndex];
    if (oldAction?.id && falsePositiveSteps.has(oldAction.id)) {
      setFalsePositiveSteps(prev => {
        const newMap = new Map(prev);
        newMap.delete(oldAction.id!);
        return newMap;
      });
    }
    
    // Close any open modals
    setEditSelectorModalOpen(false);
    setEditingActionIndex(null);
    
    toast.success(`Step ${stepIndex + 1} replaced with "${suggestion.element || suggestion.description}"`, { duration: 3000 });
  };

  const handleStartRecording = async () => {
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    if (!flowstral?.playwrightRecorder && !electronAPI?.startRecording) {
      toast.error("Trace not available");
      return;
    }

    if (!url || !url.match(/^https?:\/\/.+/)) {
      toast.error("Please enter a valid URL");
      return;
    }

    setIsStarting(true);
    setActions([]);
    setRecordingTime(0);
    setCapturedNetworkRequests([]); // Clear previous network captures

    // Build capture options
    const captureNetwork = captureForLoadTest || captureForApiTest;

    try {
      let result;
      
      // Determine if we need mobile emulation
      const isMobile = selectedMobileDevice !== 'desktop';
      const mobileDevice = isMobile ? selectedMobileDevice : null; // Use device ID directly (matches mobile-devices.js keys)
      const mobileNetwork = isMobile && selectedNetwork !== 'none' ? selectedNetwork : null;
      
      if (electronAPI?.invoke) {
        // Use invoke API (passes device settings + browser type to main process)
        result = await electronAPI.invoke('playwright-recorder-start', {
          url,
          mobileDevice,
          mobileNetwork,
          browserType: selectedBrowser,
        });
      } else if (flowstral?.playwrightRecorder) {
        // Standard desktop recording or mobile via preload
        if (isMobile && flowstral.mobile?.setDevice) {
          await flowstral.mobile.setDevice(mobileDevice, mobileNetwork);
        }
        result = await flowstral.playwrightRecorder.start(url, { captureNetwork, browserType: selectedBrowser });
      } else if (electronAPI?.startRecording) {
        await electronAPI.navigateEmbeddedBrowser?.(url);
        result = await electronAPI.startRecording({ captureNetwork });
      }
      
      if (result?.success !== false) {
        setIsRecording(true);
        setIsPaused(false);
        setCurrentUrl(url);
        const captureMsg = captureNetwork ? " (capturing network traffic)" : "";
        const mobileMsg = isMobile ? ` on ${getDeviceName(selectedMobileDevice)}` : "";
        const browserMsg = selectedBrowser !== 'chromium' ? ` [${selectedBrowser}]` : "";
        toast.success(`Trace started${mobileMsg}${browserMsg}!${captureMsg}`);
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
      
      // Capture network requests if they were recorded
      if (result?.networkRequests && (captureForLoadTest || captureForApiTest)) {
        const filteredRequests = result.networkRequests.filter((req: any) => {
          // Filter out static assets
          const url = req.url || '';
          return !url.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)(\?|$)/i);
        });
        setCapturedNetworkRequests(filteredRequests);
        if (import.meta.env.DEV) console.log(`[Recorder] Captured ${filteredRequests.length} network requests`);
      }
      
      // Merge recorded actions with manually added ones (SF Tools, Test Helpers, etc.)
      const recordedActions = result?.actions || result;
      if (Array.isArray(recordedActions)) {
        setActions(prev => {
          // Keep manually added actions - these have known prefixes from our Test Helpers panel
          const manualPrefixes = [
            'action_', 'assert_', 'nav_', 'create_', 'soqlnav_', 'gsearch_', 
            'search_', 'util_', 'rec_', 'tab_', 'flow_', 'test_helper_', 'sf_'
          ];
          
          const isManualAction = (id: string) => {
            return manualPrefixes.some(prefix => id.startsWith(prefix));
          };
          
          const manualActions = prev.filter(a => {
            const id = a.id || '';
            const isSfType = (a.type || '').startsWith('sf-');
            return isManualAction(id) || isSfType;
          });
          
          // CRITICAL: Deduplicate recorded actions FIRST using getDisplayActions
          const deduplicatedRecorded = getDisplayActions(recordedActions);
          
          if (manualActions.length === 0) {
            // No manual actions, just use deduplicated recorded
            if (import.meta.env.DEV) console.log(`[Recorder] Stop: ${recordedActions.length} -> ${deduplicatedRecorded.length} deduplicated`);
            return deduplicatedRecorded.length > 0 ? deduplicatedRecorded : prev;
          }
          
          // Remove any recorded that duplicate manual actions
          const manualDescriptions = new Set(manualActions.map(a => a.description));
          const recordedOnly = deduplicatedRecorded.filter(a => !manualDescriptions.has(a.description));
          
          // Combine and sort by timestamp
          const combined = [...recordedOnly, ...manualActions].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
          );
          
          if (import.meta.env.DEV) console.log(`[Recorder] Stop: ${recordedActions.length} -> ${recordedOnly.length} deduplicated + ${manualActions.length} manual`);
          return combined;
        });
      }
      
      const networkMsg = capturedNetworkRequests.length > 0 ? ` (${capturedNetworkRequests.length} HTTP requests)` : '';
      toast.success(`Trace stopped - ${actions.length} actions${networkMsg}`);
    } catch (error) {
      toast.error("Failed to stop trace");
    }
  };

  const handleClearActions = () => {
    setActions([]);
    (window as any).flowstral?.playwrightRecorder?.clearActions?.();
    (window as any).electronAPI?.clearActions?.();
    toast.info("Cleared");
  };

  // Visual checkpoint capture handler
  const handleCaptureVisualCheckpoint = async () => {
    if (!currentUrl) {
      toast.error("No page loaded to capture");
      return;
    }
    
    // Generate baseline name from URL
    const urlPath = new URL(currentUrl).pathname.replace(/\//g, '_').replace(/^_/, '') || 'homepage';
    const suggestedName = `${urlPath}_checkpoint_${visualCheckpoints + 1}`;
    setVisualBaselineName(suggestedName);
    setShowVisualDialog(true);
  };

  const handleConfirmVisualCapture = async () => {
    if (!visualBaselineName.trim()) {
      toast.error("Please enter a baseline name");
      return;
    }
    
    setIsCapturingVisual(true);
    setShowVisualDialog(false);
    
    try {
      // Try to capture via backend API
      const response = await fetch(`${API_BASE_URL}/api/visual-testing/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          url: currentUrl,
          test_name: visualBaselineName.trim(),
          full_page: 'true',
          viewport_width: '1920',
          viewport_height: '1080',
          save_as_baseline: 'true'
        })
      });
      
      if (!response.ok) {
        throw new Error(`Capture failed: ${response.statusText}`);
      }
      
      // Add visual_check step to recorded actions
      const newAction: RecordedAction = {
        id: `visual_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'visual_check',
        description: `Visual checkpoint: ${visualBaselineName}`,
        selector: '',
        value: visualBaselineName,
        locators: [],
        metadata: {
          baselineName: visualBaselineName,
          visualMode: 'anti_aliased',
          visualThreshold: 0.1,
          capturedAt: new Date().toISOString(),
          url: currentUrl
        }
      };
      
      setActions(prev => [...prev, newAction]);
      setVisualCheckpoints(prev => prev + 1);
      
      toast.success(`Visual checkpoint "${visualBaselineName}" captured!`, {
        description: "Baseline saved and step added to recording"
      });
    } catch (error) {
      console.error("[Visual Capture] Error:", error);
      // Still add the step even if backend fails - user can capture baseline later
      const newAction: RecordedAction = {
        id: `visual_${Date.now()}`,
        timestamp: new Date().toISOString(),
        type: 'visual_check',
        description: `Visual checkpoint: ${visualBaselineName}`,
        selector: '',
        value: visualBaselineName,
        locators: [],
        metadata: {
          baselineName: visualBaselineName,
          visualMode: 'anti_aliased',
          visualThreshold: 0.1,
          capturedAt: new Date().toISOString(),
          url: currentUrl,
          pendingCapture: true
        }
      };
      
      setActions(prev => [...prev, newAction]);
      setVisualCheckpoints(prev => prev + 1);
      
      toast.warning(`Visual checkpoint step added (baseline capture pending)`, {
        description: "Upload baseline image in Visual Testing tab later"
      });
    } finally {
      setIsCapturingVisual(false);
      setVisualBaselineName('');
    }
  };

  // Accessibility scan handler - scans current page during recording
  const handleA11yScan = async () => {
    if (!currentUrl) {
      toast.error("No page loaded to scan");
      return;
    }
    
    setIsA11yScanning(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/accessibility/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: currentUrl,
          scan_type: "full_page",
          wcag_level: "AA"
        })
      });
      
      if (!response.ok) {
        throw new Error(`Scan failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Add to accumulated issues
      setA11yIssues(prev => [...prev, {
        page: currentUrl,
        timestamp: new Date(),
        issues: result.issues || [],
        summary: result.summary || { critical: 0, serious: 0, moderate: 0, minor: 0, total: 0 }
      }]);
      
      const { critical, serious, moderate, minor, total } = result.summary || {};
      if (total === 0) {
        toast.success("✓ No accessibility issues found on this page!");
      } else {
        const severity = critical > 0 ? "error" : serious > 0 ? "warning" : "info";
        const toastFn = severity === "error" ? toast.error : severity === "warning" ? toast.warning : toast.info;
        toastFn(`Found ${total} a11y issues: ${critical} critical, ${serious} serious, ${moderate} moderate, ${minor} minor`);
      }
    } catch (error) {
      console.error("[A11y Scan] Error:", error);
      toast.error(`Accessibility scan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsA11yScanning(false);
    }
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
        toast.success("Trace resumed");
      } else {
        // Pause
        if (flowstral?.playwrightRecorder?.pause) {
          await flowstral.playwrightRecorder.pause();
        } else if (electronAPI?.pauseRecording) {
          await electronAPI.pauseRecording();
        }
        setIsPaused(true);
        toast.info("Trace paused - interact with app then resume");
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
      
      // ============================================================
      // DEDUPLICATE FILLS - Keep only the LAST fill for each field
      // This handles cases where both Recipe and CDP recorders capture
      // the same input, or partial typing creates multiple fills
      // ============================================================
      const seenFillFields = new Map<string, number>(); // fieldKey -> index
      const deduplicatedActions: RecordedAction[] = [];
      
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        const qword = (action.qword || '').toLowerCase();
        const actionType = (action.type || '').toLowerCase();
        const isFill = qword === 'fill' || qword.includes('fill') || actionType === 'fill' || actionType === 'input';
        
        if (isFill) {
          // Get field name from MULTIPLE sources:
          // - CDP fills: args[0] contains the label
          // - Recipe fills: fieldLabel property
          // - Also try raw.name, raw.placeholder, selectorObj
          let fieldName = (
            action.args?.[0] || 
            (action as any).fieldLabel || 
            action.raw?.name ||
            action.raw?.placeholder ||
            action.selectorObj?.name ||
            action.selectorObj?.placeholder ||
            ''
          ).toLowerCase().trim();
          
          // Normalize common field name variations (match playwright-recorder.js)
          const fieldNormalizations: Record<string, string> = {
            'pw': 'password', 'pwd': 'password', 'passwd': 'password', 'pass': 'password',
            'user': 'username', 'uname': 'username', 'usr': 'username',
            'mail': 'email', 'e-mail': 'email',
            'phone': 'phone', 'tel': 'phone', 'mobile': 'phone', 'cell': 'phone',
          };
          if (fieldNormalizations[fieldName]) {
            fieldName = fieldNormalizations[fieldName];
          }
          
          if (import.meta.env.DEV) console.log(`[Recorder Export] Fill ${i}: fieldName="${fieldName}" from args[0]="${action.args?.[0]}" fieldLabel="${(action as any).fieldLabel}"`);

          if (fieldName && fieldName !== 'input') {
            // Check if we've seen this field before
            const existingIdx = seenFillFields.get(fieldName);
            if (existingIdx !== undefined) {
              // Replace with this one (later fill has more complete value)
              if (import.meta.env.DEV) console.log(`[Recorder Export] DEDUPING fill for "${fieldName}" - replacing index ${existingIdx}`);
              deduplicatedActions[existingIdx] = action;
              continue; // Don't add again
            }
            seenFillFields.set(fieldName, deduplicatedActions.length);
            if (import.meta.env.DEV) console.log(`[Recorder Export] First fill for "${fieldName}" at index ${deduplicatedActions.length}`);
          }
        }

        deduplicatedActions.push(action);
      }

      if (import.meta.env.DEV) console.log(`[Recorder Export] Deduplicated: ${actions.length} -> ${deduplicatedActions.length} actions`);
      
      // Build a proper test case object with deduplicated actions
      const testCase = {
        id: `tc_${Date.now()}`,
        name: 'Recorded Test',
        description: `Recorded on ${new Date().toISOString()}`,
        steps: deduplicatedActions.map((action, idx) => {
          // Determine step type - preserve sf-* types for Salesforce helpers
          let stepType = action.type || 'click';
          const actionType = (action.type || '').toLowerCase();
          const qword = (action.qword || '').toLowerCase();
          
          // If action already has an sf-* type, preserve it exactly
          if (actionType.startsWith('sf-')) {
            stepType = action.type!;
          }
          // Otherwise infer from qword
          else if (qword.includes('goto') || qword.includes('navigate')) stepType = 'navigate';
          else if (qword.includes('fill') || qword.includes('type') || qword.includes('input')) stepType = 'input';
          else if (qword.includes('select')) stepType = 'select';
          else if (qword.includes('assert')) stepType = 'assert';
          else if (qword.includes('wait')) stepType = 'wait';
          else if (qword.includes('click')) stepType = 'click';
          else if (qword.includes('hover')) stepType = 'hover';
          else if (qword.includes('screenshot')) stepType = 'screenshot';
          // For SF Tools, use custom type
          else if (['executesoql', 'executeapex', 'createtestdata', 'createrecord', 'clonerecord', 
                    'deleterecord', 'triggerflow', 'assertvalidation', 'assertfieldvalue',
                    'managepermissionset', 'runapextest', 'bulkload', 'runreport', 'restapicall'].includes(qword)) {
            stepType = 'custom';
          }
          
          return {
            id: action.id || `step_${Date.now()}_${idx}`,
            order: idx + 1,  // Sequential step number
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
        },
        // Tags for filtering - automation is always included
        tags: [
          'automation',
          ...(captureForLoadTest ? ['load'] : []),
          ...(captureForApiTest ? ['api'] : []),
        ],
        // Network data for load/api testing (only if captured)
        networkData: (captureForLoadTest || captureForApiTest) ? capturedNetworkRequests : undefined,
      };
      
      if (import.meta.env.DEV) {
        console.log('[Recorder] Exporting test case with', testCase.steps.length, 'steps');
        console.log('[Recorder] Tags:', testCase.tags);
        console.log('[Recorder] Network requests:', testCase.networkData?.length || 0);
      }

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
      
      const tagMsg = testCase.tags.length > 1 ? ` [${testCase.tags.join(', ')}]` : '';
      toast.success(`Exported ${deduplicatedActions.length} steps to Builder!${tagMsg}`);
    } catch (error) {
      console.error('[Recorder] Export failed:', error);
      toast.error("Failed to export");
    }
  };

  // Quick test in API tab - sends captured network requests or generates from recorded URL
  const handleQuickApiTest = () => {
    let apiRequests: any[] = [];
    
    if (capturedNetworkRequests.length > 0) {
      // Use actual captured network requests
      apiRequests = capturedNetworkRequests.map((req, index) => ({
        id: `recorded-${index}-${Date.now()}`,
        name: `${req.method} ${new URL(req.url).pathname}`,
        method: req.method,
        url: req.url,
        headers: req.headers || {},
        body: req.body || '',
        timestamp: req.timestamp,
      }));
    } else {
      // Generate basic requests from the recorded URL
      // This helps users get started even without full network capture
      const baseUrl = (url || 'http://localhost:8002').replace(/\/+$/, ''); // Remove trailing slashes
      apiRequests = [
        { id: `gen-1-${Date.now()}`, name: 'GET Products', method: 'GET', url: `${baseUrl}/api/products`, headers: {}, body: '' },
        { id: `gen-2-${Date.now()}`, name: 'GET Cart', method: 'GET', url: `${baseUrl}/api/cart`, headers: {}, body: '' },
        { id: `gen-3-${Date.now()}`, name: 'POST Cart', method: 'POST', url: `${baseUrl}/api/cart`, headers: {'Content-Type': 'application/json'}, body: '{"product_id": "1", "quantity": 1}' },
        { id: `gen-4-${Date.now()}`, name: 'POST Checkout', method: 'POST', url: `${baseUrl}/api/checkout`, headers: {'Content-Type': 'application/json'}, body: '{}' },
      ];
      toast.info("Generated sample API requests from target URL. For actual traffic capture, use HAR import.");
    }
    
    sessionStorage.setItem('pendingApiTestRequests', JSON.stringify(apiRequests));
    sessionStorage.setItem('pendingApiTestTimestamp', Date.now().toString());
    
    toast.success(`Sending ${apiRequests.length} requests to API tab...`);
    
    // Navigate to API tab
    window.location.href = '/api';
  };

  // Quick test in Perf tab - sends captured network requests for load testing.
  // Prefer backend draft (shareable, durable); fallback to sessionStorage.
  const API_BASE_PERF = API_BASE_URL;
  const handleQuickLoadTest = async () => {
    let loadTestRequests: any[] = [];
    
    if (capturedNetworkRequests.length > 0) {
      loadTestRequests = capturedNetworkRequests.map((req, index) => ({
        id: `recorded-${index}-${Date.now()}`,
        method: req.method,
        url: req.url,
        headers: req.headers || {},
        body: req.body || '',
        responseTime: req.responseTime,
      }));
    } else {
      const baseUrl = (url || 'http://localhost:8002').replace(/\/+$/, '');
      loadTestRequests = [
        { id: `gen-1-${Date.now()}`, method: 'GET', url: `${baseUrl}/api/products`, headers: {}, body: '' },
        { id: `gen-2-${Date.now()}`, method: 'GET', url: `${baseUrl}/api/cart`, headers: {}, body: '' },
        { id: `gen-3-${Date.now()}`, method: 'POST', url: `${baseUrl}/api/cart`, headers: {'Content-Type': 'application/json'}, body: '{"product_id": "1", "quantity": 1}' },
      ];
      toast.info("Generated sample load test requests from target URL. For actual traffic capture, use HAR import.");
    }
    
    try {
      const res = await fetch(`${API_BASE_PERF}/api/performance/drafts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: loadTestRequests,
          name: 'From Recorder',
          source: 'recorder',
          ttl_seconds: 24 * 3600,
        }),
      });
      const data = await res.json();
      if (res.ok && data.draft_id) {
        toast.success(`Draft created. Opening Perf tab...`);
        window.location.href = `/performance?draft_id=${data.draft_id}`;
        return;
      }
    } catch (_) {
      // fallback to sessionStorage
    }
    sessionStorage.setItem('pendingLoadTestRequests', JSON.stringify(loadTestRequests));
    sessionStorage.setItem('pendingLoadTestTimestamp', Date.now().toString());
    toast.success(`Sending ${loadTestRequests.length} requests to Perf tab...`);
    window.location.href = '/performance';
  };

  const API_BASE = API_BASE_URL;
  const exportCapturedAsPostman = async () => {
    if (capturedNetworkRequests.length === 0) {
      toast.error('No captured requests');
      return;
    }
    try {
      const requests = capturedNetworkRequests.map((req: any) => ({
        url: req.url,
        method: req.method || 'GET',
        headers: req.headers || {},
        body: req.body || '',
      }));
      const res = await fetch(`${API_BASE}/api/import/export-postman`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, name: 'Recorded API Collection' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const blob = new Blob([data.collection_json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'recorded-postman-collection.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Postman collection downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
    }
  };
  const exportCapturedAsHAR = async () => {
    if (capturedNetworkRequests.length === 0) {
      toast.error('No captured requests');
      return;
    }
    try {
      const requests = capturedNetworkRequests.map((req: any) => ({
        url: req.url,
        method: req.method || 'GET',
        headers: req.headers || {},
        body: req.body || '',
        statusCode: req.statusCode ?? req.status ?? 200,
        duration: req.duration ?? req.responseTime ?? 0,
        timestamp: req.timestamp ?? Date.now() / 1000,
      }));
      const res = await fetch(`${API_BASE}/api/import/export-har`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requests, creator_name: 'QAAI Recorder' }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const blob = new Blob([data.har_json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'recorded-traffic.har.json';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('HAR file downloaded');
    } catch (e: any) {
      toast.error(e?.message || 'Export failed');
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
        type: action.type || 'click', // Preserve action type (sf-* types for Salesforce helpers)
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

  // ============ TEST EXECUTION HANDLERS (extracted to useTestExecution hook) ============
  const {
    handleLockLocators, handleRunTest, handlePauseTest, handleResumeTest,
    handleSkipPausedStep, handleRetryPausedStep, handleRunFromStep,
    markStepAsFalsePositive, unmarkFalsePositive, handleAutoFixStep,
    handleFalsePositiveStop, handleFalsePositiveFixed, handleStopTest,
    toggleStepByStepMode, updatePausedStepField, handleRunSingleStep,
  } = useTestExecution({
    actions, setActions, url, testExecutionResult, setTestExecutionResult,
    setShowTestResultModal, selectedTestCase, currentTestId,
    isTestPaused, setIsTestPaused, pausedAtStep, setPausedAtStep,
    editingPausedStep, setEditingPausedStep, stepByStepMode, setStepByStepMode,
    setPauseRequested, pauseResolverRef,
    falsePositiveSteps, setFalsePositiveSteps, setFlakyStepIds,
    autoFixingSteps, setAutoFixingSteps, setAutoFixResults, setManualAssistStep,
    setEditingActionIndex, setEditSelectorModalOpen, setRightPanelTab,
    setIsDebugMode, setShowRunMenu, setFailureCardStepIndex,
    setFailureState, setBrowserKeptOpen, browserKeptOpen,
    setStoppedAtFalsePositive,
    playbackSpeed, highlightElements, keepBrowserOpenOnFailure,
    switchToStepTabAndRefresh, handleRefreshSuggestions,
  });


  const getActionIcon = (qword: string, small = false) => {
    const size = small ? "h-3 w-3" : "h-4 w-4";
    const type = qword?.toLowerCase() || '';
    
    // Salesforce-specific action types
    if (type.startsWith('sf-navigate') || type.includes('navigateto')) return <Globe className={`${size} text-blue-400`} />;
    if (type === 'sf-global-search' || type.includes('search')) return <Search className={`${size} text-teal-500`} />;
    if (type === 'sf-app-launcher') return <LayoutGrid className={`${size} text-cyan-400`} />;
    if (type === 'sf-wait' || type.includes('wait')) return <RefreshCw className={`${size} text-amber-400`} />;
    if (type.startsWith('sf-click')) return <Hand className={`${size} text-emerald-400`} />;
    
    // Standard action types
    if (type.includes('goto') || type.includes('nav')) return <Globe className={`${size} text-blue-400`} />;
    if (type.includes('fill')) return <PenLine className={`${size} text-teal-500`} />;
    if (type.includes('click')) return <Hand className={`${size} text-emerald-400`} />;
    if (type.includes('assert')) return <Eye className={`${size} text-cyan-400`} />;
    if (type.includes('screenshot')) return <Eye className={`${size} text-slate-500`} />;
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
    return <DesktopRequiredCard />;
  }

  return (
    <div className="h-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* ============ RE-RECORD BANNER (from Builder) ============ */}
      {showRerecordBanner && rerecordContext && (
        <div className="shrink-0 bg-slate-800 text-white px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="h-4 w-4" />
            <div className="text-sm">
              <span className="font-medium">Re-recording Step {rerecordContext.stepIndex + 1}</span>
              <span className="mx-2 opacity-70">•</span>
              <span className="opacity-90">{rerecordContext.step?.name || rerecordContext.step?.type}</span>
              <span className="mx-2 opacity-70">•</span>
              <span className="text-xs opacity-70">from "{rerecordContext.testCaseName}"</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs opacity-70">Record the step, then save to update the test</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs bg-white/10 border-white/30 hover:bg-white/20"
              onClick={() => {
                // Return to builder without saving
                localStorage.removeItem('flowstral_rerecord_context');
                setShowRerecordBanner(false);
                if (rerecordContext.returnTo) {
                  navigate(rerecordContext.returnTo);
                }
              }}
            >
              Cancel & Return
            </Button>
            <Button
              size="sm"
              className="h-7 text-xs bg-white text-teal-600 hover:bg-white/90"
              disabled={actions.length === 0}
              onClick={() => {
                // Save the re-recorded step and return to builder
                if (actions.length > 0) {
                  // Get the first recorded action as the replacement
                  const replacementAction = actions[0];
                  // Save to localStorage for builder to pick up
                  localStorage.setItem('flowstral_rerecord_result', JSON.stringify({
                    ...rerecordContext,
                    replacementAction,
                    timestamp: Date.now(),
                  }));
                  localStorage.removeItem('flowstral_rerecord_context');
                  setShowRerecordBanner(false);
                  toast.success('Step traced! Returning to builder...');
                  setTimeout(() => {
                    if (rerecordContext.returnTo) {
                      navigate(rerecordContext.returnTo);
                    }
                  }, 500);
                }
              }}
            >
              <Save className="h-3 w-3 mr-1" />
              Save & Return
            </Button>
          </div>
        </div>
      )}

      {/* ============ TOP TOOLBAR ============ */}
      <TopToolbar
        isRecording={isRecording}
        isPaused={isPaused}
        actions={actions}
        showRunMenu={showRunMenu}
        setShowRunMenu={setShowRunMenu}
        handleRunTest={handleRunTest}
        handleExportToBuilder={handleExportToBuilder}
        setShowAIGenerator={setShowAIGenerator}
        setShowAIExplorer={setShowAIExplorer}
        setShowAIFlowExplorer={setShowAIFlowExplorer}
        handleQuickApiTest={handleQuickApiTest}
        handleQuickLoadTest={handleQuickLoadTest}
        captureForApiTest={captureForApiTest}
        captureForLoadTest={captureForLoadTest}
        capturedNetworkRequests={capturedNetworkRequests}
        exportCapturedAsPostman={exportCapturedAsPostman}
        exportCapturedAsHAR={exportCapturedAsHAR}
        handleExport={handleExport}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
        highlightElements={highlightElements}
        setHighlightElements={setHighlightElements}
        keepBrowserOpenOnFailure={keepBrowserOpenOnFailure}
        setKeepBrowserOpenOnFailure={setKeepBrowserOpenOnFailure}
      />

      {/* ============ MAIN CONTENT ============ */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* ============ LEFT PANEL - URL & Recorded Steps ============ */}
        <div 
          style={{ width: `${leftPanelWidth}%` }} 
          className="min-w-[400px] max-w-[75%] flex flex-col border-r border-border overflow-hidden"
        >
          <RecordingControlsPanel
            url={url}
            setUrl={setUrl}
            currentUrl={currentUrl}
            isRecording={isRecording}
            isStarting={isStarting}
            isPaused={isPaused}
            handleStartRecording={handleStartRecording}
            handleStopRecording={handleStopRecording}
            handlePauseResume={handlePauseResume}
            handleA11yScan={handleA11yScan}
            isA11yScanning={isA11yScanning}
            a11yIssues={a11yIssues}
            handleCaptureVisualCheckpoint={handleCaptureVisualCheckpoint}
            isCapturingVisual={isCapturingVisual}
            visualCheckpoints={visualCheckpoints}
            selectedMobileDevice={selectedMobileDevice}
            setSelectedMobileDevice={setSelectedMobileDevice}
            selectedNetwork={selectedNetwork}
            setSelectedNetwork={setSelectedNetwork}
            deviceCategories={deviceCategories}
            networkPresets={networkPresets}
            captureForLoadTest={captureForLoadTest}
            setCaptureForLoadTest={setCaptureForLoadTest}
            captureForApiTest={captureForApiTest}
            setCaptureForApiTest={setCaptureForApiTest}
            capturedNetworkRequests={capturedNetworkRequests}
            selectedTestCase={selectedTestCase}
            setSelectedTestCase={setSelectedTestCase}
            setMode={setMode}
            setShowTestPicker={setShowTestPicker}
            selectedBrowser={selectedBrowser}
            setSelectedBrowser={setSelectedBrowser}
            mode={mode}
            stepLinks={stepLinks}
            stepAutomation={stepAutomation}
            currentStepIndex={currentStepIndex}
            setCurrentStepIndex={setCurrentStepIndex}
            setRightPanelTab={setRightPanelTab}
            recordForStepContext={recordForStepContext}
          />

          <StepListPanel
            actions={actions}
            setActions={setActions}
            mode={mode}
            selectedTestCase={selectedTestCase}
            isMultiSelectMode={isMultiSelectMode}
            setIsMultiSelectMode={setIsMultiSelectMode}
            selectedActionIndices={selectedActionIndices}
            setSelectedActionIndices={setSelectedActionIndices}
            selectedActionIndex={selectedActionIndex}
            setSelectedActionIndex={setSelectedActionIndex}
            currentStepIndex={currentStepIndex}
            setCurrentStepIndex={setCurrentStepIndex}
            stepLinks={stepLinks}
            falsePositiveSteps={falsePositiveSteps}
            draggedIndex={draggedIndex}
            dragOverIndex={dragOverIndex}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDragEnd={handleDragEnd}
            handleClearActions={handleClearActions}
            selectAllActions={selectAllActions}
            clearAllSelections={clearAllSelections}
            linkSelectedActionsToStep={linkSelectedActionsToStep}
            toggleActionSelection={toggleActionSelection}
            linkActionToStep={linkActionToStep}
            openEditSelectorModal={openEditSelectorModal}
            setEditingCrossOriginIndex={setEditingCrossOriginIndex}
            setCrossOriginUserActions={setCrossOriginUserActions}
            setShowCrossOriginEditor={setShowCrossOriginEditor}
            getActionIcon={getActionIcon}
            actionsEndRef={actionsEndRef}
          />
        </div>

        {/* ============ RESIZABLE DIVIDER ============ */}
        <div
          className={cn(
            "w-1 bg-border hover:bg-primary/50 cursor-col-resize transition-colors flex-shrink-0 relative group",
            isResizing && "bg-primary"
          )}
          onMouseDown={(e) => {
            e.preventDefault();
            setIsResizing(true);
          }}
        >
          {/* Visual grip indicator */}
          <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="w-1 h-8 rounded-full bg-primary/50" />
          </div>
        </div>

        {/* ============ RIGHT PANEL - Suggestions ============ */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-[250px]">
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
                <TabsTrigger value="sftools" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Cloud className="h-3 w-3 mr-1" />
                  SF Tools
                </TabsTrigger>
                <TabsTrigger value="sfcontext" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Target className="h-3 w-3 mr-1" />
                  SF Context
                </TabsTrigger>
                <TabsTrigger value="a11y" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                  <Accessibility className="h-3 w-3 mr-1" />
                  A11y
                  {a11yIssues.length > 0 && a11yIssues.reduce((acc, p) => acc + p.summary.total, 0) > 0 && (
                    <Badge className={cn(
                      "ml-1 h-4 text-[9px] px-1",
                      a11yIssues.reduce((acc, p) => acc + p.summary.critical, 0) > 0
                        ? "bg-red-500/30 text-red-400"
                        : "bg-amber-500/30 text-amber-400"
                    )}>
                      {a11yIssues.reduce((acc, p) => acc + p.summary.total, 0)}
                    </Badge>
                  )}
                </TabsTrigger>
                {/* Automate Tab - Only when automating existing test */}
                {mode === 'existing' && selectedTestCase && (
                  <TabsTrigger value="automate" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-primary/20 data-[state=active]:text-primary">
                    <Link2 className="h-3 w-3 mr-1" />
                    Automate
                    <Badge className="ml-1 h-4 bg-primary/30 text-primary text-[9px] px-1">
                      {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ========== SUGGESTIONS TAB ========== */}
            <TabsContent value="suggestions" className="flex-1 m-0 p-0 flex flex-col overflow-hidden data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              <SuggestionsTabContent
                editingActionIndex={editingActionIndex}
                setEditingActionIndex={setEditingActionIndex}
                setEditSelectorModalOpen={setEditSelectorModalOpen}
                totalSuggestions={totalSuggestions}
                suggestResult={suggestResult}
                isLoadingSuggestions={isLoadingSuggestions}
                handleRefreshSuggestions={handleRefreshSuggestions}
                elementFilter={elementFilter}
                setElementFilter={setElementFilter}
                suggestionSearch={suggestionSearch}
                setSuggestionSearch={setSuggestionSearch}
                categoryCounts={categoryCounts}
                executeAction={executeAction}
                addToTest={addToTest}
                replaceStepWithSuggestion={replaceStepWithSuggestion}
              />
            </TabsContent>

            {/* ========== SF TOOLS TAB ========== */}
            <TabsContent value="sftools" className="flex-1 m-0 p-0 flex flex-col overflow-hidden data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              <SFToolsTabContent
                sfToolsSubTab={sfToolsSubTab}
                setSfToolsSubTab={setSfToolsSubTab}
                sfToolInput={sfToolInput}
                setSfToolInput={setSfToolInput}
                sfToolInput2={sfToolInput2}
                setSfToolInput2={setSfToolInput2}
                sfToolInput3={sfToolInput3}
                setSfToolInput3={setSfToolInput3}
                soqlQuery={soqlQuery}
                setSoqlQuery={setSoqlQuery}
                soqlResults={soqlResults}
                setSoqlResults={setSoqlResults}
                soqlColumns={soqlColumns}
                setSoqlColumns={setSoqlColumns}
                soqlError={soqlError}
                isQueryLoading={isQueryLoading}
                showSoqlPanel={showSoqlPanel}
                setShowSoqlPanel={setShowSoqlPanel}
                inspectRecordId={inspectRecordId}
                setInspectRecordId={setInspectRecordId}
                inspectedRecord={inspectedRecord}
                setSfToolType={setSfToolType}
                setShowSFToolDialog={setShowSFToolDialog}
                executeSOQL={executeSOQL}
                inspectRecord={inspectRecord}
                addSOQLAssertionStep={addSOQLAssertionStep}
                addFieldAssertion={addFieldAssertion}
                setActions={setActions}
              />
            </TabsContent>



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

            {/* ========== ACCESSIBILITY TAB ========== */}
            <TabsContent value="a11y" className="flex-1 m-0 p-0 overflow-hidden flex flex-col data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              <AccessibilityTabContent
                a11yIssues={a11yIssues}
                setA11yIssues={setA11yIssues}
                handleA11yScan={handleA11yScan}
                isA11yScanning={isA11yScanning}
                currentUrl={currentUrl}
              />
            </TabsContent>

            {/* ========== AUTOMATE TAB - Link Manual Steps with Recordings ========== */}
            {mode === 'existing' && selectedTestCase && (
              <TabsContent value="automate" className="flex-1 m-0 p-0 overflow-hidden flex flex-col data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
                <AutomateTabContent
                  selectedTestCase={selectedTestCase}
                  stepLinks={stepLinks}
                  stepAutomation={stepAutomation}
                  currentStepIndex={currentStepIndex}
                  setCurrentStepIndex={setCurrentStepIndex}
                  selectedActionIndices={selectedActionIndices}
                  setSelectedActionIndices={setSelectedActionIndices}
                  handleLinkSelectedActions={handleLinkSelectedActions}
                  groupingEnabled={groupingEnabled}
                  setGroupingEnabled={setGroupingEnabled}
                  autoAdvance={autoAdvance}
                  setAutoAdvance={setAutoAdvance}
                  defaultLinkMode={defaultLinkMode}
                  setDefaultLinkMode={setDefaultLinkMode}
                  setStepAutomation={setStepAutomation}
                  setStepLinks={setStepLinks}
                  recordForStepContext={recordForStepContext}
                  skipCurrentStep={skipCurrentStep}
                  clearStepAutomation={clearStepAutomation}
                  getActionIcon={getActionIcon}
                />
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Fixed Footer - Save/Merge Button - ALWAYS visible at bottom of screen */}
      {actions.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-3 border-t border-border bg-card shadow-lg" style={{ width: '55%', minWidth: '500px' }}>
          {selectedTestCase ? (
            <div className="space-y-2">
              <Button
                onClick={performMerge} 
                className="w-full h-10 bg-teal-600 hover:bg-teal-700"
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge {actions.length} Actions into "{selectedTestCase.name?.slice(0, 20)}..."
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Position-based merge: Action 1 → Step 1, Action 2 → Step 2, etc.
              </p>
            </div>
          ) : (
            <Button onClick={handleSaveAsNew} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700">
              <Save className="h-4 w-4 mr-2" />
              Save as New Test Case
            </Button>
          )}
        </div>
      )}

      {/* Visual Checkpoint Dialog */}
      <VisualCheckpointDialog
        open={showVisualDialog}
        onOpenChange={setShowVisualDialog}
        currentUrl={currentUrl}
        visualBaselineName={visualBaselineName}
        setVisualBaselineName={setVisualBaselineName}
        isCapturingVisual={isCapturingVisual}
        handleConfirmVisualCapture={handleConfirmVisualCapture}
      />

      {/* Cross-Origin Step Editor Dialog */}
      <CrossOriginEditorDialog
        open={showCrossOriginEditor}
        onOpenChange={setShowCrossOriginEditor}
        crossOriginUserActions={crossOriginUserActions}
        setCrossOriginUserActions={setCrossOriginUserActions}
        editingCrossOriginIndex={editingCrossOriginIndex}
        setEditingCrossOriginIndex={setEditingCrossOriginIndex}
        setActions={setActions}
      />

      {/* Test Picker Dialog - Enterprise Scale */}
      <TestPickerDialog
        open={showTestPicker}
        onOpenChange={setShowTestPicker}
        allTestCases={allTestCases}
        filteredTestCases={filteredTestCases}
        paginatedTestCases={paginatedTestCases}
        testSearchQuery={testSearchQuery}
        setTestSearchQuery={setTestSearchQuery}
        testStatusFilter={testStatusFilter}
        setTestStatusFilter={setTestStatusFilter}
        testFolderFilter={testFolderFilter}
        setTestFolderFilter={setTestFolderFilter}
        testTagFilter={testTagFilter}
        setTestTagFilter={setTestTagFilter}
        allFolders={allFolders}
        allTags={allTags}
        testPage={testPage}
        setTestPage={setTestPage}
        totalTestPages={totalTestPages}
        onSelectTestCase={(tc) => {
          setSelectedTestCase(tc);
          setMode('existing');
          setShowTestPicker(false);
          setCurrentStepIndex(0);
          setStepAutomation({});
          setActions([]);
          toast.success(`Selected: ${tc.name} - ${tc.steps?.length || 0} steps to automate`);
        }}
      />


      {/* Test Execution Result Modal */}
      <TestResultsDialog
        open={showTestResultModal}
        onOpenChange={(open) => {
          if (!open && testExecutionResult?.status === 'running') return;
          if (!open && isTestPaused) handleStopTest();
          setShowTestResultModal(open);
        }}
        testExecutionResult={testExecutionResult}
        setTestExecutionResult={setTestExecutionResult}
        actions={actions}
        setActions={setActions}
        isTestPaused={isTestPaused}
        isDebugMode={isDebugMode}
        pausedAtStep={pausedAtStep}
        stepByStepMode={stepByStepMode}
        toggleStepByStepMode={toggleStepByStepMode}
        editingPausedStep={editingPausedStep}
        updatePausedStepField={updatePausedStepField}
        failureCardStepIndex={failureCardStepIndex}
        setFailureCardStepIndex={setFailureCardStepIndex}
        aiExplanation={aiExplanation}
        setAiExplanation={setAiExplanation}
        aiExplanationLoading={aiExplanationLoading}
        setAiExplanationLoading={setAiExplanationLoading}
        autoFixingSteps={autoFixingSteps}
        autoFixResults={autoFixResults}
        manualAssistStep={manualAssistStep}
        setManualAssistStep={setManualAssistStep}
        setAutoFixResults={setAutoFixResults}
        falsePositiveSteps={falsePositiveSteps}
        flakyStepIds={flakyStepIds}
        currentTestId={currentTestId}
        handleStopTest={handleStopTest}
        handlePauseTest={handlePauseTest}
        handleResumeTest={handleResumeTest}
        handleRetryPausedStep={handleRetryPausedStep}
        handleSkipPausedStep={handleSkipPausedStep}
        handleRunFromStep={handleRunFromStep}
        handleRunTest={handleRunTest}
        handleAutoFixStep={handleAutoFixStep}
        handleLockLocators={handleLockLocators}
        handleRefreshSuggestions={handleRefreshSuggestions}
        markStepAsFalsePositive={markStepAsFalsePositive}
        unmarkFalsePositive={unmarkFalsePositive}
        explainFailureApi={explainFailureApi}
        switchToStepTabAndRefresh={switchToStepTabAndRefresh}
        setEditingActionIndex={setEditingActionIndex}
        setRightPanelTab={setRightPanelTab}
        setShowTestResultModal={setShowTestResultModal}
      />


      {/* Merge Preview Dialog */}
      <MergePreviewDialog
        open={showMergePreview}
        onOpenChange={setShowMergePreview}
        selectedTestCase={selectedTestCase}
        mergedSteps={mergedSteps}
        defaultLinkMode={defaultLinkMode}
        groupingEnabled={groupingEnabled}
        saveMergedTest={saveMergedTest}
      />


      {/* SF Tools Customization Dialog */}
      <SFToolsDialog
        open={showSFToolDialog}
        onOpenChange={setShowSFToolDialog}
        sfToolType={sfToolType}
        sfToolInput={sfToolInput}
        setSfToolInput={setSfToolInput}
        sfToolInput2={sfToolInput2}
        setSfToolInput2={setSfToolInput2}
        sfToolInput3={sfToolInput3}
        setSfToolInput3={setSfToolInput3}
        setActions={setActions}
      />


      {/* AI Test Generator Modal */}
      <AITestGenerator
        open={showAIGenerator}
        onOpenChange={setShowAIGenerator}
        onTestsGenerated={(tests) => {
          // Add generated tests as actions
          tests.forEach(test => {
            test.steps.forEach(step => {
              const newAction: RecordedAction = {
                id: step.id,
                qword: step.qword,
                args: step.args,
                description: step.description,
                timestamp: Date.now(),
                selectorObj: step.recipe ? { recipe: step.recipe } : {},
              };
              setActions(prev => [...prev, newAction]);
            });
          });
          toast.success(`Added ${tests.reduce((acc, t) => acc + t.steps.length, 0)} steps from ${tests.length} AI-generated tests`);
        }}
      />
      
      {/* AI Explorer Agent - Autonomous exploration and test discovery */}
      <AIExplorerAgent
        isOpen={showAIExplorer}
        onClose={() => setShowAIExplorer(false)}
        currentUrl={currentUrl || url}
        onSaveTests={(tests) => {
          // Convert AI Explorer tests to RecordedActions
          tests.forEach(test => {
            test.steps?.forEach((step: any) => {
              const newAction: RecordedAction = {
                id: `ai-explorer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                qword: step.action || 'click',
                args: [step.target, step.value].filter(Boolean),
                description: `${step.action}: ${step.target}${step.value ? ` = "${step.value}"` : ''}`,
                timestamp: Date.now(),
                selectorObj: {},
              };
              setActions(prev => [...prev, newAction]);
            });
          });
          toast.success(`Saved ${tests.length} AI-discovered tests with ${tests.reduce((acc, t) => acc + (t.steps?.length || 0), 0)} steps`);
          setShowAIExplorer(false);
        }}
      />
      
      {/* AI Flow Explorer - Full navigation graph discovery */}
      <AIFlowExplorer
        isOpen={showAIFlowExplorer}
        onClose={() => setShowAIFlowExplorer(false)}
        currentUrl={currentUrl || url}
        onSaveTests={(tests) => {
          // Convert Flow Explorer tests to RecordedActions
          tests.forEach(test => {
            test.steps?.forEach((step: any) => {
              const newAction: RecordedAction = {
                id: `flow-explorer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                qword: step.qword || 'ClickText',
                args: step.args || [step.target, step.value].filter(Boolean),
                description: step.description || `${step.qword}: ${step.args?.join(' ')}`,
                timestamp: Date.now(),
                selectorObj: {},
              };
              setActions(prev => [...prev, newAction]);
            });
          });
          toast.success(`Saved ${tests.length} flow tests with ${tests.reduce((acc, t) => acc + (t.steps?.length || 0), 0)} steps`);
          setShowAIFlowExplorer(false);
        }}
      />

      {/* ============ STEP EDITOR ============ */}
      {/* B+C Hybrid: Click to re-record + Visual selector cards */}
      {useSimpleEditor ? (
        <SimpleStepEditor
          open={editSelectorModalOpen}
          onOpenChange={(open) => {
            setEditSelectorModalOpen(open);
            if (!open) {
              setEditingActionIndex(null);
              // Clear false positive stop state if we're closing without fixing
              setStoppedAtFalsePositive(null);
            }
          }}
          step={editingActionIndex !== null ? actions[editingActionIndex] : null}
          stepIndex={editingActionIndex || 0}
          // Show failure info: prioritize false positive screenshot, then failure state
          failureScreenshot={(() => {
            if (editingActionIndex === null) return null;
            const action = actions[editingActionIndex];
            // Check false positive screenshot first
            if (action?.id && falsePositiveSteps.has(action.id)) {
              return falsePositiveSteps.get(action.id)?.screenshot || null;
            }
            // Fallback to failure state screenshot
            if (editingActionIndex === failureState?.stepIndex) {
              return failureState?.screenshot || null;
            }
            return null;
          })()}
          failureError={editingActionIndex === failureState?.stepIndex ? failureState?.error : null}
          browserOpen={browserKeptOpen}
          similarElements={editingActionIndex === failureState?.stepIndex ? (failureState?.similarElements || []) : []}
          overlaySuggestions={suggestResult?.suggestions?.slice(0, 10).map(s => ({
            text: s.element || s.description || '',
            selector: s.selector || '',
            type: s.type || 'unknown'
          })) || []}
          onElementPicked={(element) => {
            // Immediately save the picked element - update selectorObj.manualOverride for playback!
            if (editingActionIndex === null) return;
            if (import.meta.env.DEV) console.log('[onElementPicked] Saving manual fix:', element);
            setActions(prev => prev.map((action, idx) => {
              if (idx !== editingActionIndex) return action;
              const newSelector = element.selector || action.selectorObj?.manualOverride;
              const newText = element.text || action.selectorObj?.text;
              if (import.meta.env.DEV) console.log('[onElementPicked] Updating action:', {
                idx,
                newSelector,
                newText,
                selectorType: element.selectorType
              });
              return {
                ...action,
                // CRITICAL: Update selectorObj.manualOverride for playback engine
                selectorObj: {
                  ...action.selectorObj,
                  manualOverride: newSelector,
                  text: newText,
                  selector: newSelector,
                },
                // Also update args if it's a click with text
                args: newText && (action.qword === 'Click' || action.qword === 'click')
                  ? [newText, ...(action.args?.slice(1) || [])]
                  : action.args,
                // Keep backup fields for debugging
                manualSelector: newSelector,
                manualText: newText,
              };
            }));
            toast.success(`Step updated! Will use: ${element.selector || element.text}`);
            // Dialog closes automatically after pick
          }}
          onSkip={() => {
            // Mark step to skip on next run
            if (editingActionIndex !== null) {
              setActions(prev => prev.map((action, idx) => {
                if (idx !== editingActionIndex) return action;
                return { ...action, skip: true };
              }));
            }
          }}
          onStartPicker={async () => {
            const flowstral = (window as any).flowstral;
            if (flowstral?.elementPicker?.start) {
              const result = await flowstral.elementPicker.start();
              if (result?.success && result.elementInfo) {
                return {
                  success: true,
                  text: result.elementInfo.text,
                  selector: result.elementInfo.selectors?.[0]?.selector
                };
              }
              return result;
            }
            return { success: false, error: 'Picker not available' };
          }}
        />
      ) : (
        <ElementRepairWizard
          open={editSelectorModalOpen}
          onOpenChange={(open) => {
            setEditSelectorModalOpen(open);
            if (!open) {
              setEditingActionIndex(null);
            }
          }}
          action={editingActionIndex !== null ? actions[editingActionIndex] : null}
          actionIndex={editingActionIndex || 0}
          onSave={(updates) => {
            if (editingActionIndex === null) return;
            if (import.meta.env.DEV) console.log('[ElementRepairWizard onSave] Saving:', updates);
            setActions(prev => prev.map((action, idx) => {
              if (idx !== editingActionIndex) return action;
              const newSelector = updates.manualSelector || action.selectorObj?.manualOverride;
              const newText = updates.manualText || action.selectorObj?.text;
              return {
                ...action,
                // CRITICAL: Update selectorObj.manualOverride for playback engine
                selectorObj: {
                  ...action.selectorObj,
                  manualOverride: newSelector,
                  text: newText,
                  selector: newSelector,
                },
                args: newText && (action.qword === 'Click' || action.qword === 'click')
                  ? [newText, ...(action.args?.slice(1) || [])]
                  : action.args,
                manualSelector: newSelector,
                manualText: newText,
              };
            }));
            setEditSelectorModalOpen(false);
            setEditingActionIndex(null);
            toast.success(`Step updated! Will use: ${updates.manualSelector || updates.manualText}`);
          }}
          failureState={failureState}
          browserKeptOpen={browserKeptOpen}
          onReopenBrowser={async () => {
            const flowstral = (window as any).flowstral;
            if (flowstral?.playwrightRecorder?.reopenToFailure) {
              const result = await flowstral.playwrightRecorder.reopenToFailure();
              if (result?.success) setBrowserKeptOpen(true);
              return result;
            }
            return { success: false, error: 'Reopen function not available' };
          }}
          onRetryStep={async (updates) => {
            const flowstral = (window as any).flowstral;
            if (flowstral?.playwrightRecorder?.retryFailedStep) {
              return await flowstral.playwrightRecorder.retryFailedStep(updates);
            }
            return { success: false, error: 'Retry function not available' };
          }}
          onResumeFromHere={async (options) => {
            const flowstral = (window as any).flowstral;
            if (flowstral?.playwrightRecorder?.resumeFromFailure) {
              const result = await flowstral.playwrightRecorder.resumeFromFailure(options);
              if (result?.success) {
                setTestExecutionResult(prev => prev ? {
                  ...prev,
                  status: 'passed',
                  stepResults: prev.stepResults.map((s, i) => 
                    s.status === 'failed' || s.status === 'skipped' 
                      ? { ...s, status: 'passed' } 
                      : s
                  )
                } : null);
              }
              return result;
            }
            return { success: false, error: 'Resume function not available' };
          }}
          onCloseBrowser={async () => {
            const flowstral = (window as any).flowstral;
            if (flowstral?.playwrightRecorder?.closeBrowser) {
              const result = await flowstral.playwrightRecorder.closeBrowser();
              if (result?.success) setBrowserKeptOpen(false);
              return result;
            }
            return { success: false };
          }}
        />
      )}
    </div>
  );
}


