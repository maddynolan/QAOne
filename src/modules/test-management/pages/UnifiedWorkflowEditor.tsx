/**
 * Unified Test Builder - v3.1
 * 
 * THE ONLY test builder you need. One unified test case that can:
 * - Run as automated UI test
 * - Execute API tests
 * - Query databases
 * - Run performance tests
 * - Generate manual test documentation
 * 
 * Features:
 * - No-Code / Code toggle (framework abstracted)
 * - Recorder integration
 * - Reusable modules
 * - Blackbox fallback strategies
 * - All assertion types
 * 
 * Color scheme: Purple primary (#8B5CF6), Cyan accent (#38BDF8)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Play, Save, Download, Plus, Trash2, Copy,
  ArrowUp, ArrowDown, Eye, EyeOff, Code, Settings,
  Zap, Globe, MousePointer, Type, Clock, CheckCircle,
  Navigation, AlertCircle, Package, Wand2,
  ChevronRight, ChevronDown, MoreHorizontal, Target,
  Layers, RefreshCw, FileText, Monitor, Server, Gauge,
  Video, Camera, Search, X, XCircle, Edit,
  Database, ToggleLeft, ToggleRight, FolderPlus,
  BookOpen, Share2, Upload, ExternalLink,
  Calendar, Calculator, Shuffle, AlertTriangle,
  Mail, Phone, Hash, User, ShieldCheck, Lightbulb,
  Building2, Plane, GraduationCap, Heart, Utensils,
  Home, Briefcase, Gamepad2, BarChart3,
  Activity, FileJson, Link2, Key, Timer,
  ClipboardList, ArrowLeft, ArrowRight, Circle, CheckCircle2, XCircle as XCircleIcon, SkipForward, Ban,
  Pencil, Flag, FileDown, Cloud, File, TestTube,
  // Advanced UI icons
  Table, Move, Sliders, Keyboard, Layout, Maximize2, CheckSquare, GripVertical,
  Crosshair
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';
import { ReusableModulesManager, ModuleStep } from '@/modules/test-management/components/ReusableModulesManager';
import { BlackboxLocatorStrategies, BlackboxLocator } from '@/modules/recorder/components/BlackboxLocatorStrategies';
import { resultsIngestionService, TestRunData } from '@/lib/results-ingestion-service';
import { SmartFillDialog } from '@/modules/recorder/components/SmartFillDialog';
import { isElectron, localData, recorder as electronRecorder } from '@/lib/electron-bridge';
import { 
  DOMAINS, CATEGORIES, DomainType, ValidationTemplate,
  getValidationsByDomain, getSuggestionsForField, calculateCoverage,
  groupValidations, getPriorityColor, validationToAssertion
} from '@/lib/qa-validation-templates';
import { 
  EmailVerifyStepConfig, 
  PDFVerifyStepConfig, 
  FileVerifyStepConfig,
  getDefaultEmailVerifyConfig 
} from '@/components/verifications';
import type { EmailVerifyConfig, PDFVerifyConfig, FileVerifyConfig } from '@/components/verifications/types';
// Element Repair Wizard - Visual element picker for fixing failed steps (Builder integration)
import ElementRepairWizard from "@/modules/recorder/components/ElementRepairWizard";
// Quick Re-record Modal - Simple inline step re-recording without leaving builder
import QuickRerecordModal from "@/modules/recorder/components/QuickRerecordModal";

// ============================================================================
// EXTRACTED MODULES - Types, constants, and utility functions
// ============================================================================
import type {
  StepType, StepAssertion, SelectorObject, TestStep, TestVariable,
  PreconditionRef, UnifiedTestCase, ExportMode, ViewMode, TestEnvironment
} from '../types/workflow-editor.types';
import { Tabs as TabsPrimitive, TabsContent as TabsContentPrimitive, TabsList as TabsListPrimitive, TabsTrigger as TabsTriggerPrimitive } from '@/components/ui/tabs';
import TestEnvironmentManager from '../components/TestEnvironmentManager';
import { STEP_CATEGORIES, getStepInfo } from '../constants/step-categories';
import { convertSelector, extractSelectorString, extractSelectorObject, extractTargetName } from '../lib/selector-utils';
import { detectFieldType, generateTestValue, RANDOM_DATA, randomPick, randomString, generateSmartValue } from '../lib/test-data-generation';
import { getAssertionDescription, generateExpectedResultFromAssertions, getAssertionSuggestions, generateExpectedResultText, STEP_TYPE_ASSERTIONS, getAssertionsForStepType, shouldShowGenericAssertions, getQuickSuggestions, getQuickSuggestionsLegacy } from '../lib/assertion-helpers';
import { getStepDescription, mapEventType, cleanStepName, generateStepName, generateExpectedResult as generateExpectedResultFromEvent, convertWorkflowStep } from '../lib/step-helpers';
import { escapeForPython, generateAssertionCode, generateAPICode, generateDBCode, generatePerformanceCode, generateManualDoc, generateISTQBFormat, generateGherkinFormat, generateMarkdownFormat } from '../lib/code-generators';
import { generateAutomationCode } from '../lib/automation-code-generator';
import StepCard from '../components/StepCard';
import StepEditor from '../components/StepEditor';
import TestResultsPanel from '../components/TestResultsPanel';


// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function UnifiedWorkflowEditor() {
  const [searchParams] = useSearchParams();
  const location = useLocation(); // Track location changes to reload from localStorage
  const testCaseIdFromUrl = searchParams.get('testCaseId') || undefined;

  // Test case state
  const [testCase, setTestCase] = useState<UnifiedTestCase>(() => ({
    id: `tc_${Date.now()}`,
    name: 'New Test Case',
    description: '',
    tags: [],
    preconditions: [], // Test cases to run before this one
    steps: [],
    variables: [],
    settings: {
      timeout: 30000,
      retries: 0,
      parallelizable: false,
      retryCount: 0,
      retryDelay: 1000,
      continueOnFailure: false,
    },
    metadata: {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    },
  }));
  
  // UI state
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('no-code');
  const [exportMode, setExportMode] = useState<ExportMode>('automation');
  const [isRunning, setIsRunning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showModules, setShowModules] = useState(false);
  const [showBlackbox, setShowBlackbox] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['actions', 'verify']);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  
  // Saved state - tracks if this test case exists in backend
  const [savedTestCaseId, setSavedTestCaseId] = useState<string | null>(null);
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [saveAsName, setSaveAsName] = useState('');
  
  // Import test case as precondition
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [availableTestCases, setAvailableTestCases] = useState<Array<{ id: string; name: string; description?: string; steps?: number }>>([]);
  const [importLoading, setImportLoading] = useState(false);
  
  // Format view dialog (ISTQB/Gherkin)
  const [showFormatDialog, setShowFormatDialog] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'istqb' | 'gherkin' | 'markdown'>('istqb');

  // ═══════════════════════════════════════════════════════════════
  // MANUAL EXECUTION MODE
  // ═══════════════════════════════════════════════════════════════
  const [isManualExecution, setIsManualExecution] = useState(false);
  const [manualCurrentStep, setManualCurrentStep] = useState(0);
  const [manualResults, setManualResults] = useState<Record<string, { 
    result: 'passed' | 'failed' | 'skipped' | 'blocked';
    notes?: string;
    executedAt: string;
  }>>({});
  const [manualExecutionStartTime, setManualExecutionStartTime] = useState<Date | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // STEP REPAIR WIZARD STATE (for fixing failed steps)
  // ═══════════════════════════════════════════════════════════════
  const [repairWizardOpen, setRepairWizardOpen] = useState(false);
  const [repairStepIndex, setRepairStepIndex] = useState<number | null>(null);
  const [keepBrowserOpenOnFailure, setKeepBrowserOpenOnFailure] = useState(true);
  const [browserKeptOpen, setBrowserKeptOpen] = useState(false);

  // ═══════════════════════════════════════════════════════════════
  // TEST ENVIRONMENTS (QA/Staging/Preprod switching)
  // ═══════════════════════════════════════════════════════════════
  const [environments, setEnvironments] = useState<TestEnvironment[]>([]);
  const [selectedEnvironmentId, setSelectedEnvironmentId] = useState<string>('');
  const [failureState, setFailureState] = useState<{
    stepIndex: number;
    step: TestStep;
    error: string;
    screenshot: string | null;
    url: string | null;
    similarElements?: Array<{ id: string; text: string; selector: string }>;
  } | null>(null);
  const navigate = useNavigate();
  
  // Quick Re-record Modal state (simpler inline re-recording)
  const [quickRerecordOpen, setQuickRerecordOpen] = useState(false);
  const [quickRerecordStepIndex, setQuickRerecordStepIndex] = useState<number | null>(null);

  // QA Validation Coverage
  const [showDomainSelector, setShowDomainSelector] = useState(false);
  const [selectedDomain, setSelectedDomain] = useState<DomainType>(testCase.domain || 'general');
  const [coveredValidations, setCoveredValidations] = useState<string[]>(testCase.coveredValidations || []);
  const [showValidationPanel, setShowValidationPanel] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<'details' | 'validations'>('details');
  const [rightPanelMode, setRightPanelMode] = useState<'step' | 'protocol'>('step');
  
  // Auto-clear stale test results when steps change (add/remove/reorder)
  const prevStepCountRef = useRef(testCase.steps.length);
  useEffect(() => {
    if (testCase.steps.length !== prevStepCountRef.current && executionResult.status !== 'idle' && executionResult.status !== 'running') {
      setExecutionResult({ status: 'idle', currentStep: 0, results: [], logs: [] });
    }
    prevStepCountRef.current = testCase.steps.length;
  }, [testCase.steps.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clipboard for step copy/paste
  const [stepClipboard, setStepClipboard] = useState<TestStep[] | null>(null);
  
  // Keyboard shortcuts for steps (Delete, Ctrl+C, Ctrl+V)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      // Delete key - delete selected step
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedStepId) {
        e.preventDefault();
        const stepName = testCase.steps.find(s => s.id === selectedStepId)?.name || 'step';
        setTestCase(prev => ({
          ...prev,
          steps: prev.steps.filter(s => s.id !== selectedStepId),
        }));
        setSelectedStepId(null);
        toast.success(`Deleted step: ${stepName}`);
      }
      
      // Ctrl+C / Cmd+C - Copy selected step
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && selectedStepId) {
        e.preventDefault();
        const stepToCopy = testCase.steps.find(s => s.id === selectedStepId);
        if (stepToCopy) {
          setStepClipboard([stepToCopy]);
          toast.success(`Copied step: ${stepToCopy.name}`);
        }
      }
      
      // Ctrl+V / Cmd+V - Paste step(s)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && stepClipboard && stepClipboard.length > 0) {
        e.preventDefault();
        const timestamp = Date.now();
        const newSteps = stepClipboard.map((step, idx) => ({
          ...step,
          id: `step_${timestamp}_${idx}`,
          name: `${step.name} (Copy)`,
        }));
        
        // Insert after selected step, or at end
        setTestCase(prev => {
          const selectedIndex = selectedStepId 
            ? prev.steps.findIndex(s => s.id === selectedStepId) + 1
            : prev.steps.length;
          const newStepList = [...prev.steps];
          newStepList.splice(selectedIndex, 0, ...newSteps);
          return { ...prev, steps: newStepList };
        });
        toast.success(`Pasted ${newSteps.length} step(s)`);
      }
      
      // Ctrl+D / Cmd+D - Duplicate selected step
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedStepId) {
        e.preventDefault();
        const stepToDuplicate = testCase.steps.find(s => s.id === selectedStepId);
        if (stepToDuplicate) {
          const newStep = { 
            ...stepToDuplicate, 
            id: `step_${Date.now()}`, 
            name: `${stepToDuplicate.name} (Copy)` 
          };
          setTestCase(prev => {
            const index = prev.steps.findIndex(s => s.id === selectedStepId);
            const newSteps = [...prev.steps];
            newSteps.splice(index + 1, 0, newStep);
            return { ...prev, steps: newSteps };
          });
          setSelectedStepId(newStep.id);
          toast.success('Step duplicated');
        }
      }
      
      // Arrow keys to navigate steps
      if (e.key === 'ArrowUp' && selectedStepId) {
        e.preventDefault();
        const currentIndex = testCase.steps.findIndex(s => s.id === selectedStepId);
        if (currentIndex > 0) {
          setSelectedStepId(testCase.steps[currentIndex - 1].id);
        }
      }
      if (e.key === 'ArrowDown' && selectedStepId) {
        e.preventDefault();
        const currentIndex = testCase.steps.findIndex(s => s.id === selectedStepId);
        if (currentIndex < testCase.steps.length - 1) {
          setSelectedStepId(testCase.steps[currentIndex + 1].id);
        }
      }
      
      // Escape - Deselect step
      if (e.key === 'Escape') {
        setSelectedStepId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedStepId, stepClipboard, testCase.steps]);
  
  // Protocol/Network data for load testing
  const [protocolData, setProtocolData] = useState<{
    requests: Array<{
      requestId: string;
      url: string;
      method: string;
      statusCode: number;
      duration: number;
      type: string;
      requestHeaders?: Record<string, string>;
      responseHeaders?: Record<string, string>;
      timing?: Record<string, number>;
      linkedActionId?: string;
    }>;
    correlations: Array<{
      name: string;
      type: string;
      value: string;
      foundIn: string;
    }>;
    statistics: {
      totalRequests: number;
      successfulRequests: number;
      failedRequests: number;
      avgDuration: number;
      p95Duration: number;
    };
    linkedActions: Array<{
      actionId: string;
      requestIds: string[];
    }>;
  } | null>(null);

  // Execution state
  const [executionResult, setExecutionResult] = useState<{
    status: 'idle' | 'running' | 'passed' | 'failed';
    currentStep: number;
    results: { stepId: string; status: string; duration?: number; error?: string }[];
    logs: string[];
  }>({
    status: 'idle',
    currentStep: 0,
    results: [],
    logs: [],
  });

  // Test history
  const [testHistory, setTestHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('unified_test_history');
    return saved ? JSON.parse(saved) : [];
  });

  // Selected step
  const selectedStep = testCase.steps.find(s => s.id === selectedStepId);

  // Load from URL params or localStorage
  useEffect(() => {
    const data = searchParams.get('data');
    const importSource = searchParams.get('import');
    const sessionId = searchParams.get('sessionId');
    
    // Handle base64-encoded data from Electron export (priority)
    if (data) {
      try {
        const decoded = atob(decodeURIComponent(data));
        const importedTestCase = JSON.parse(decoded);
        console.log('[Builder] Loading from URL data param:', importedTestCase);
        console.log('[Builder] Steps count:', importedTestCase.steps?.length);
        
        // Convert steps to our format - handle qword from recorder
        const steps: TestStep[] = (importedTestCase.steps || []).map((step: any, idx: number) => {
          // Use qword if available, then type, then default to 'click'
          const rawType = step.qword || step.type || 'click';
          const mappedType = mapEventType(rawType);
          
          // Mask password values
          const isPasswordStep = /password|passwd|pwd|["']pw["']|\bpw\b/i.test(step.name || step.description || '');
          const value = isPasswordStep ? '••••••••' : (step.value || '');
          
          return {
            id: step.id || `step_${Date.now()}_${idx}`,
            type: mappedType,
            name: step.name || step.description || `Step ${idx + 1}`,
            selector: step.selector || step.selectorObj?.selector || '',
            selectorObj: step.selectorObj,
            value,
            url: step.url || (mappedType === 'navigate' ? step.args?.[0] : '') || '',
            qword: step.qword,  // Preserve qword for execution
            args: step.args,    // Preserve args for execution
            enabled: step.enabled !== false,
            expectedResult: step.expectedResult || '',
            isSensitive: isPasswordStep || step.isSensitive,
          };
        });
        
        setTestCase(prev => ({
          ...prev,
          id: importedTestCase.id || `tc_${Date.now()}`,
          name: importedTestCase.name || 'Imported Test Case',
          description: importedTestCase.description || 'Imported from Recorder',
          tags: importedTestCase.tags || [],
          steps,
          settings: {
            ...prev.settings,
            baseUrl: importedTestCase.settings?.baseUrl || '',
            timeout: importedTestCase.settings?.timeout || 30000,
          },
          metadata: {
            ...prev.metadata,
            ...importedTestCase.metadata,
            source: importedTestCase.metadata?.source || 'flowstral-desktop',
          },
        }));
        
        toast.success(`Loaded "${importedTestCase.name}" with ${steps.length} steps`);
        return; // Don't continue to other sources
      } catch (err) {
        console.error('[Builder] Error parsing URL data:', err);
      }
    }
    
    // Handle base64-encoded import from Flowstral Desktop (legacy)
    if (importSource && importSource !== 'trace') {
      try {
        // Decode base64 test case from desktop app
        const decoded = atob(decodeURIComponent(importSource));
        const desktopTestCase = JSON.parse(decoded);
        console.log('[Builder] Importing from Flowstral Desktop:', desktopTestCase);
        
        // Convert steps to our format - handle qword from recorder
        const steps: TestStep[] = (desktopTestCase.steps || []).map((step: any, idx: number) => {
          // Use qword if available, then type, then default to 'click'
          const rawType = step.qword || step.type || 'click';
          const mappedType = mapEventType(rawType);
          
          // Mask password values
          const isPasswordStep = /password|passwd|pwd|["']pw["']|\bpw\b/i.test(step.name || step.description || '');
          const value = isPasswordStep ? '••••••••' : (step.value || '');
          
          return {
            id: step.id || `step_${Date.now()}_${idx}`,
            type: mappedType,
            name: step.name || step.description || `Step ${idx + 1}`,
            selector: step.selector || step.selectorObj?.selector || '',
            selectorObj: step.selectorObj,
            value,
            url: step.url || (mappedType === 'navigate' ? step.args?.[0] : '') || '',
            qword: step.qword,  // Preserve qword for execution
            args: step.args,    // Preserve args for execution
            enabled: step.enabled !== false,
            expectedResult: step.expectedResult || '',
            isSensitive: isPasswordStep || step.isSensitive,
          };
        });
        
        setTestCase(prev => ({
          ...prev,
          id: desktopTestCase.id || `tc_${Date.now()}`,
          name: desktopTestCase.name || 'Imported from Desktop',
          description: desktopTestCase.description || 'Recorded in Flowstral Desktop',
          tags: desktopTestCase.tags || [],
          steps,
          settings: {
            ...prev.settings,
            baseUrl: desktopTestCase.settings?.baseUrl || '',
            timeout: desktopTestCase.settings?.timeout || 30000,
          },
          metadata: {
            ...prev.metadata,
            ...desktopTestCase.metadata,
            source: 'flowstral-desktop',
          },
        }));
        
        toast.success(`Imported "${desktopTestCase.name}" with ${steps.length} steps from Desktop`);
        return;
      } catch (e) {
        console.error('[Builder] Failed to decode desktop import:', e);
        // Fall through to other import methods
      }
    }
    
    // Handle import=trace from Trace page
    if (importSource === 'trace') {
      const sessionData = localStorage.getItem('workflow_import_session');
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData);
          console.log('[Builder] Importing from Trace session:', session);
          
          let steps: TestStep[] = [];
          
          // Convert session actions to steps - PRESERVE selectorObj for fallbacks
          if (session.actions && Array.isArray(session.actions)) {
            steps = session.actions.map((action: any, idx: number) => {
              const eventType = mapEventType(action.type || 'click');
              const rawName = action.description || action.name || `Step ${idx + 1}`;
              return {
                id: `step_${Date.now()}_${idx}`,
                type: eventType,
                name: cleanStepName(rawName, eventType), // Clean up redundant prefixes
                selector: extractSelectorString(action.selector),
                selectorObj: extractSelectorObject(action.selector, action.selectorObj, action), // CRITICAL: Preserve full selector
                value: action.value || '',
                displayValue: action.displayValue || action.value || '', // Masked value for display
                isSensitive: action.isSensitive || action.inputType === 'password',  // Preserve sensitive flag
                inputType: action.inputType || action.elementType || '',  // Preserve input type
                target: action.target || action.description || '',
                enabled: true,
                expectedResult: action.expectedResult || '',
              };
            });
          } else if (session.script) {
            // Has a script but no structured actions - create placeholder
            steps = [{
              id: `step_${Date.now()}_0`,
              type: 'navigate',
              name: 'Run Recorded Script',
              url: session.startUrl || '',
              enabled: true,
              expectedResult: 'Script executes successfully',
            }];
          }
          
          // Add navigate step if we have a startUrl
          if (session.startUrl && steps.length > 0 && steps[0].type !== 'navigate') {
            steps.unshift({
              id: `step_${Date.now()}_nav`,
              type: 'navigate',
              name: 'Open Application',
              url: session.startUrl,
              enabled: true,
              expectedResult: 'Page loads successfully',
            });
          }
          
          setTestCase(prev => ({
            ...prev,
            name: session.name || 'Imported Recording',
            description: session.description || `Imported from Trace - ${session.actionCount || steps.length} steps`,
            steps,
            settings: {
              ...prev.settings,
              baseUrl: session.startUrl || '',
            },
          }));
          
          // Clear the import data
          localStorage.removeItem('workflow_import_session');
          toast.success(`Imported "${session.name}" with ${steps.length} steps`);
          return;
        } catch (e) {
          console.error('Failed to import from Trace:', e);
          toast.error('Failed to import recording');
        }
      }
    }
    
    // Handle sessionId from Flowstral
    if (sessionId) {
      loadFromFlowstralSession(sessionId);
      return;
    }
    
    if (data) {
      try {
        // Try base64 decoding first (from Electron export)
        let decodedData = data;
        try {
          decodedData = atob(decodeURIComponent(data));
          console.log('[Builder] Decoded base64 data');
        } catch (b64Error) {
          // Not base64, try as URI-encoded JSON
          decodedData = decodeURIComponent(data);
        }
        
        const parsed = JSON.parse(decodedData);
        console.log('[Builder] Loading from URL data:', parsed);
        console.log('[Builder] Parsed data has', parsed.steps?.length, 'steps');
        
        // Direct test case format (from Electron export)
        if (parsed.steps && Array.isArray(parsed.steps) && parsed.steps.length > 0) {
          // Check if already in TestStep format
          if (parsed.steps[0].type) {
            console.log('[Builder] Direct test case format detected');
            // Clean up step names
            const cleanedSteps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
            
            setTestCase(prev => ({
              ...prev,
              id: parsed.id || prev.id,
              name: parsed.name || 'Traced Test',
              description: parsed.description || '',
              steps: cleanedSteps,
              settings: {
                ...prev.settings,
                baseUrl: parsed.settings?.baseUrl || '',
              },
              metadata: {
                ...prev.metadata,
                ...parsed.metadata,
              }
            }));
            console.log('[Builder] Loaded', cleanedSteps.length, 'steps from URL data');
            return; // Exit early
          }
        }
        
        // Legacy format conversion
        if (parsed.events || parsed.nodes) {
          let steps: TestStep[] = [];
          
          if (parsed.events) {
            steps = convertRecordedEvents(parsed.events, parsed.startUrl);
          } else if (parsed.nodes) {
            steps = convertWorkflowNodes(parsed.nodes, parsed.startUrl);
          } else if (parsed.steps) {
            steps = parsed.steps.map(convertWorkflowStep);
          }
          
          console.log('[Builder] Converted steps:', steps.length);
          
          setTestCase(prev => ({
            ...prev,
            name: parsed.name || parsed.workflowName || parsed.title || 'Traced Test',
            description: parsed.description || '',
            steps,
            settings: {
              ...prev.settings,
              baseUrl: parsed.startUrl || parsed.baseUrl || '',
            },
          }));
        }
      } catch (e) {
        console.error('Failed to parse URL data:', e);
      }
    } else {
      // IMPORTANT: If testCaseIdFromUrl is present, skip localStorage loading
      // because loadTestCaseById will handle it in a separate useEffect
      const testCaseIdParam = searchParams.get('testCaseId');
      if (testCaseIdParam) {
        console.log('[Builder] testCaseId in URL, skipping localStorage load - will load by ID');
        // Clear any stale localStorage data to prevent confusion
        localStorage.removeItem('unified_test_case_timestamp');
        return;
      }
      
      // Load from localStorage (recording import)
      const saved = localStorage.getItem('unified_test_case');
      const timestamp = localStorage.getItem('unified_test_case_timestamp');
      console.log('[Builder] Checking localStorage for unified_test_case:', saved ? 'FOUND' : 'NOT FOUND', 'timestamp:', timestamp);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          console.log('[Builder] Loading from localStorage:', parsed);
          console.log('[Builder] Steps count:', parsed.steps?.length, 'steps');
          
          // Clear the timestamp after reading to avoid re-loading on future visits
          if (timestamp) {
            localStorage.removeItem('unified_test_case_timestamp');
          }
          
          // Clean step names and ensure selectorObj is preserved
          if (parsed.steps && Array.isArray(parsed.steps)) {
            parsed.steps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              // Ensure selectorObj is preserved for fallback selectors
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
          }
          
          setTestCase(parsed);
          console.log('[Builder] TestCase set successfully with', parsed.steps?.length, 'steps');
        } catch (e) {
          console.error('Failed to load from localStorage:', e);
        }
      } else {
        console.log('[Builder] No saved test case in localStorage');
      }
    }
  }, [searchParams, location.key]); // Include location.key to trigger on navigation
  
  // Also listen for storage events (when another window/tab sets localStorage)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'unified_test_case' && e.newValue) {
        console.log('[Builder] Storage event detected - reloading test case');
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.steps && Array.isArray(parsed.steps)) {
            parsed.steps = parsed.steps.map((step: any) => ({
              ...step,
              name: cleanStepName(step.name, step.type),
              selectorObj: step.selectorObj || (typeof step.selector === 'object' ? step.selector : undefined),
              selector: typeof step.selector === 'string' ? step.selector : 
                        (step.selector?.playwright || step.selector?.selector || step.selectorObj?.playwright || ''),
            }));
          }
          setTestCase(parsed);
          console.log('[Builder] Loaded from storage event:', parsed.steps?.length, 'steps');
        } catch (err) {
          console.error('[Builder] Failed to parse storage event data:', err);
        }
      }
    };
    
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
  
  // Load test environments from server
  useEffect(() => {
    const loadEnvironments = async () => {
      try {
        // Use a default project ID (from the test case or fallback)
        const projectId = searchParams.get('projectId') || 'default';
        const res = await fetch(`${API_BASE_URL}/api/test-environments?project_id=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const envs: TestEnvironment[] = data.environments || [];
          setEnvironments(envs);
          // Auto-select default environment
          const defaultEnv = envs.find(e => e.is_default);
          if (defaultEnv && !selectedEnvironmentId) {
            setSelectedEnvironmentId(defaultEnv.id);
          }
        }
      } catch (e) {
        console.log('[Builder] Could not load environments (non-critical):', e);
      }
    };
    loadEnvironments();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load protocol data from localStorage (injected by recorder)
  useEffect(() => {
    // Check for unified test case with protocol data
    const unifiedTestCase = localStorage.getItem('unified_test_case');
    if (unifiedTestCase) {
      try {
        const parsed = JSON.parse(unifiedTestCase);
        
        // Check for network/protocol data
        const networkData = parsed.network_data || parsed.networkData || parsed.protocolData;
        if (networkData && networkData.requests && networkData.requests.length > 0) {
          console.log('[Builder] Found protocol data:', networkData.requests.length, 'requests');
          setProtocolData({
            requests: networkData.requests || [],
            correlations: networkData.correlations || [],
            statistics: networkData.statistics || {
              totalRequests: networkData.requests?.length || 0,
              successfulRequests: networkData.requests?.filter((r: any) => r.statusCode >= 200 && r.statusCode < 400).length || 0,
              failedRequests: networkData.requests?.filter((r: any) => r.statusCode >= 400).length || 0,
              avgDuration: Math.round((networkData.requests || []).reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / (networkData.requests?.length || 1)),
              p95Duration: 0,
            },
            linkedActions: networkData.linkedActions || [],
          });
          setRightPanelMode('protocol');
          toast.success(`Loaded ${networkData.requests.length} HTTP requests from recording!`);
        }
      } catch (e) {
        console.error('Failed to parse protocol data:', e);
      }
    }
    
    // Also check for standalone protocol data
    const standaloneProtocol = localStorage.getItem('qaai_protocol_data');
    if (standaloneProtocol) {
      try {
        const parsed = JSON.parse(standaloneProtocol);
        if (parsed.requests && parsed.requests.length > 0) {
          console.log('[Builder] Found standalone protocol data:', parsed.requests.length, 'requests');
          setProtocolData(parsed);
          setRightPanelMode('protocol');
          localStorage.removeItem('qaai_protocol_data'); // Clear after loading
          toast.success(`Loaded ${parsed.requests.length} HTTP requests!`);
        }
      } catch (e) {
        console.error('Failed to parse standalone protocol data:', e);
      }
    }
  }, []);
  
  // ═══════════════════════════════════════════════════════════════
  // CHECK FOR RE-RECORD RESULT FROM RECORDER TAB
  // ═══════════════════════════════════════════════════════════════
  useEffect(() => {
    const rerecordResult = localStorage.getItem('flowstral_rerecord_result');
    if (rerecordResult) {
      try {
        const result = JSON.parse(rerecordResult);
        // Only process if recent (within 5 minutes)
        if (result.timestamp && Date.now() - result.timestamp < 5 * 60 * 1000) {
          console.log('[Builder] Processing re-record result:', result);
          
          // Update the step with the new recorded action
          if (result.stepIndex !== undefined && result.replacementAction) {
            setTestCase(prev => ({
              ...prev,
              steps: prev.steps.map((step, idx) => {
                if (idx !== result.stepIndex) return step;
                
                // Merge the replacement action data into the step
                const replacement = result.replacementAction;
                return {
                  ...step,
                  selector: replacement.selector || replacement.selectorObj?.selector || step.selector,
                  selectorObj: replacement.selectorObj || step.selectorObj,
                  manualSelector: replacement.selector || replacement.selectorObj?.selector,
                  manualText: replacement.text || replacement.label || replacement.description,
                  // Update name if it was a significant change
                  name: replacement.description || replacement.label || step.name,
                };
              }),
            }));
            
            toast.success(`Step ${result.stepIndex + 1} updated with new recording!`, {
              description: 'The step will use the new element selector on next run.',
              duration: 5000,
            });
          }
        }
        // Clean up the result
        localStorage.removeItem('flowstral_rerecord_result');
      } catch (e) {
        console.error('[Builder] Failed to process re-record result:', e);
        localStorage.removeItem('flowstral_rerecord_result');
      }
    }
  }, []);
  
  // Load from Flowstral session
  const loadFromFlowstralSession = async (sessionId: string) => {
    console.log('[Builder] Loading from Flowstral session:', sessionId);
    try {
      // Try to get session artifacts from backend
      const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${sessionId}/artifacts`);
      if (response.ok) {
        const data = await response.json();
        console.log('[Builder] Flowstral session data:', data);
        
        let steps: TestStep[] = [];
        const actions = data.actions || data.events || data.nodes || [];
        
        if (actions.length > 0) {
          steps = actions.map((action: any, idx: number) => {
            const eventType = mapEventType(action.type || action.action_type || 'click');
            const rawName = action.label || action.description || action.name || `Step ${idx + 1}`;
            return {
              id: `step_${Date.now()}_${idx}`,
              type: eventType,
              name: cleanStepName(rawName, eventType), // Clean up redundant prefixes
              selector: extractSelectorString(action.selector),
              selectorObj: extractSelectorObject(action.selector, action.selectorObj, action), // CRITICAL: Preserve full selector
              value: action.value || action.input_value || '',
              displayValue: action.displayValue || action.value || '', // Masked value for display
              isSensitive: action.isSensitive || action.inputType === 'password',  // Preserve sensitive flag
              inputType: action.inputType || action.elementType || '',  // Preserve input type
              target: extractTargetName(action.selector, action),
              enabled: true,
              expectedResult: action.expected_result || '',
            };
          });
        }
        
        const startUrl = data.start_url || data.startUrl || data.base_url || '';
        
        // Add navigate step first
        if (startUrl && steps.length > 0 && steps[0].type !== 'navigate') {
          steps.unshift({
            id: `step_${Date.now()}_nav`,
            type: 'navigate',
            name: 'Open Application',
            url: startUrl,
            enabled: true,
            expectedResult: 'Page loads successfully',
          });
        }
        
        setTestCase(prev => ({
          ...prev,
          name: data.name || data.session_name || 'Flowstral Recording',
          description: data.description || `Imported from Flowstral session ${sessionId}`,
          steps,
          settings: {
            ...prev.settings,
            baseUrl: startUrl,
          },
        }));
        
        toast.success(`Loaded session with ${steps.length} steps`);
      } else {
        toast.error('Could not load Flowstral session');
      }
    } catch (error) {
      console.error('Failed to load Flowstral session:', error);
      toast.error('Failed to load session');
    }
  };

  // Load test case by ID from URL parameter
  const loadTestCaseById = useCallback(async (testCaseId: string) => {
    console.log('[Builder] Loading test case by ID:', testCaseId);
    
    try {
      // First try localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      let foundCase = localCases.find((tc: any) => tc.id === testCaseId);
      
      // Try scale-data backend endpoint (for scale testing data)
      if (!foundCase) {
        try {
          console.log('[Builder] Trying scale-data endpoint...');
          const scaleResponse = await fetch(`${API_BASE_URL}/test-cases/scale-data/test-case/${testCaseId}`);
          if (scaleResponse.ok) {
            foundCase = await scaleResponse.json();
            console.log('[Builder] Found in scale-data:', foundCase?.name);
          }
        } catch {
          console.log('[Builder] Scale-data endpoint not available');
        }
      }
      
      // Try regular backend endpoint
      if (!foundCase) {
        try {
          const response = await fetch(`${API_BASE_URL}/test-cases/${testCaseId}`);
          if (response.ok) {
            foundCase = await response.json();
          }
        } catch {
          console.log('Could not fetch from backend');
        }
      }

      // Try database API endpoint (for API test cases saved from API Testing page)
      if (!foundCase) {
        try {
          console.log('[Builder] Trying /api/db/test-cases endpoint...');
          const dbResponse = await fetch(`${API_BASE_URL}/api/db/test-cases/${testCaseId}`);
          if (dbResponse.ok) {
            foundCase = await dbResponse.json();
            console.log('[Builder] Found in DB:', foundCase?.name);
          }
        } catch {
          console.log('[Builder] DB test-cases endpoint not available');
        }
      }

      if (!foundCase) {
        toast.error('Test case not found');
        return;
      }

      // PRIORITY 0: API test case from DB — has metadata with method/endpoint/body
      // Convert API metadata into proper builder steps
      const meta = foundCase.metadata || {};
      if (meta.type === 'automated' && meta.method && meta.endpoint) {
        console.log('[Builder] Converting API test case from DB metadata:', meta.method, meta.endpoint);
        const apiSteps: TestStep[] = [];
        // Step 1: Navigate to the API endpoint (or set up URL)
        const endpoint = meta.endpoint;
        const method = meta.method || 'GET';
        const expectedStatus = meta.expected_status || '200';
        let bodyStr = '';
        try { bodyStr = meta.request_body || ''; } catch { /* ignore */ }
        let headersStr = '';
        try { headersStr = meta.headers || ''; } catch { /* ignore */ }

        // Create a descriptive API test step
        apiSteps.push({
          id: `step_${Date.now()}_0`,
          type: 'navigate' as StepType,
          name: `Send ${method} request to ${endpoint}`,
          description: `Send ${method} ${endpoint}${bodyStr ? ` with body` : ''} — expect status ${expectedStatus}`,
          url: endpoint.startsWith('http') ? endpoint : `{{base_url}}${endpoint}`,
          selector: '',
          value: '',
          enabled: true,
          expectedResult: `Response status is ${expectedStatus}`,
        });

        // Step 2: Assert response status
        apiSteps.push({
          id: `step_${Date.now()}_1`,
          type: 'assert' as StepType,
          name: `Verify response status ${expectedStatus}`,
          description: `Assert that HTTP response status code is ${expectedStatus}`,
          selector: '',
          value: expectedStatus,
          enabled: true,
          expectedResult: `Status code equals ${expectedStatus}`,
          assertion: { enabled: true, type: 'visible', expected: `Status ${expectedStatus}` },
        });

        // Parse assertions from metadata if available
        try {
          const assertions = meta.assertions ? (typeof meta.assertions === 'string' ? JSON.parse(meta.assertions) : meta.assertions) : [];
          if (Array.isArray(assertions)) {
            assertions.forEach((a: any, idx: number) => {
              if (a.type && a.type !== 'status_code') {
                apiSteps.push({
                  id: `step_${Date.now()}_${idx + 2}`,
                  type: 'assert' as StepType,
                  name: `Assert: ${a.type} ${a.operator || ''} ${a.expected || ''}`.trim(),
                  description: `${a.type}: ${a.path || ''} ${a.operator || ''} ${a.expected || ''}`.trim(),
                  selector: a.path || '',
                  value: a.expected || '',
                  enabled: true,
                  expectedResult: `${a.type} assertion passes`,
                });
              }
            });
          }
        } catch { /* ignore assertion parse errors */ }

        setTestCase(prev => ({
          ...prev,
          id: testCaseId,
          name: foundCase.name || foundCase.title || 'API Test Case',
          description: foundCase.description || `${method} ${endpoint}`,
          tags: foundCase.tags || [],
          steps: apiSteps,
        }));
        setSavedTestCaseId(testCaseId);
        toast.success(`Loaded API test "${foundCase.name || foundCase.title}" with ${apiSteps.length} steps`);
        return;
      }

      // PRIORITY 1: Try to load from unified_data (contains the full test case with proper step format)
      if (foundCase.unified_data) {
        try {
          const unifiedData = typeof foundCase.unified_data === 'string' 
            ? JSON.parse(foundCase.unified_data) 
            : foundCase.unified_data;
          
          if (unifiedData.steps && Array.isArray(unifiedData.steps)) {
            console.log('[Builder] Loading from unified_data:', unifiedData.steps.length, 'steps');
            setTestCase(prev => ({
              ...prev,
              id: testCaseId,
              name: unifiedData.name || foundCase.name || foundCase.title || 'Imported Test Case',
              description: unifiedData.description || foundCase.description || '',
              tags: unifiedData.tags || foundCase.tags || [],
              steps: unifiedData.steps,
              settings: unifiedData.settings || prev.settings,
              preconditions: unifiedData.preconditions || [],
            }));
            setSavedTestCaseId(testCaseId);
            toast.success(`Loaded "${unifiedData.name || foundCase.name}" with ${unifiedData.steps.length} steps`);
            return;
          }
        } catch (e) {
          console.warn('[Builder] Failed to parse unified_data, falling back to steps:', e);
        }
      }

      // PRIORITY 2: Convert test case steps to TestStep format
      const rawSteps = foundCase.steps || [];
      const convertedSteps: TestStep[] = rawSteps.map((step: any, index: number) => {
        // PRIORITY 2A: If step already has 'type' property (from merged/recorder), use it directly
        // This preserves qword, args, selectorObj for execution
        if (step.type) {
          // Clean up selector - extract the actual CSS selector if wrapped in locator()
          let selector = step.selector || step.selectorObj?.selector || '';
          if (typeof selector === 'string') {
            const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
            if (locatorMatch) {
              selector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
          }
          
          return {
            ...step,
            id: step.id || `step_${Date.now()}_${index}`,
            selector: selector,
            // Preserve execution properties
            qword: step.qword,
            args: step.args,
            selectorObj: step.selectorObj,
            // Ensure value is a simple string, not a JSON object
            value: typeof step.value === 'string' ? step.value : (step.args?.[0] || ''),
            enabled: step.enabled !== false,
          };
        }
        
        // PRIORITY 2B: Try to parse test_data as JSON to get the original step
        let originalStep: any = null;
        if (step.test_data) {
          try {
            originalStep = typeof step.test_data === 'string' 
              ? JSON.parse(step.test_data) 
              : step.test_data;
          } catch (e) {
            console.warn('[Builder] Could not parse test_data for step', index);
          }
        }
        
        // Use original step data if available
        if (originalStep && originalStep.type) {
          // Clean up selector - extract the actual CSS selector if wrapped in locator()
          let selector = originalStep.selector || '';
          if (typeof selector === 'string') {
            const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
            if (locatorMatch) {
              selector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
            }
          }
          
          return {
            ...originalStep,
            id: originalStep.id || `step_${Date.now()}_${index}`,
            selector: selector,
            // Preserve execution properties
            qword: originalStep.qword,
            args: originalStep.args,
            selectorObj: originalStep.selectorObj,
            // Ensure value is a simple string, not a JSON object
            value: typeof originalStep.value === 'string' ? originalStep.value : '',
          };
        }
        
        // PRIORITY 2C: Fallback - Parse from action text (legacy manual steps)
        const action = step.action || step.description || step.name || '';
        const actionLower = action.toLowerCase();
        
        // Determine step type from action text
        let stepType: StepType = 'click';
        if (actionLower.includes('navigate') || actionLower.includes('go to') || actionLower.includes('open')) stepType = 'navigate';
        else if (actionLower.includes('enter') || actionLower.includes('type') || actionLower.includes('input') || actionLower.includes('fill')) stepType = 'input';
        else if (actionLower.includes('wait')) stepType = 'wait';
        else if (actionLower.includes('verify') || actionLower.includes('assert') || actionLower.includes('check') || actionLower.includes('confirm')) stepType = 'assert';
        else if (actionLower.includes('select') || actionLower.includes('choose')) stepType = 'select';
        else if (actionLower.includes('hover')) stepType = 'hover';
        else if (actionLower.includes('screenshot')) stepType = 'screenshot';
        
        // Extract value from action - DO NOT use test_data as it contains the entire step JSON
        let value = '';
        // Only use step.value if it's a simple string, not test_data
        if (typeof step.value === 'string' && !step.value.startsWith('{')) {
          value = step.value;
        }
        if (!value && stepType === 'input') {
          const valueMatch = action.match(/["']([^"']+)["']|enter\s+(.+)/i);
          if (valueMatch) value = valueMatch[1] || valueMatch[2] || '';
        }
        
        // Extract URL for navigate
        let url = '';
        if (stepType === 'navigate') {
          const urlMatch = action.match(/https?:\/\/[^\s]+/i);
          if (urlMatch) url = urlMatch[0];
        }
        
        // Clean up selector - extract the actual CSS selector if wrapped in locator()
        let selector = step.selector || '';
        if (typeof selector === 'string') {
          // If selector is wrapped like locator('[name="x"]'), extract the inner part
          const locatorMatch = selector.match(/^(?:page\.)?locator\(\s*['"](.+)['"]\s*\)$/);
          if (locatorMatch) {
            selector = locatorMatch[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
          }
        } else {
          selector = '';
        }
        
        return {
          id: step.id || `step_${Date.now()}_${index}`,
          type: stepType,
          name: action.slice(0, 50) || `Step ${index + 1}`,
          description: action,
          selector: selector,
          value: value,
          url: url,
          enabled: true,
          expectedResult: step.expected_result || step.expectedResult || 'Step completes successfully',
          // Preserve execution properties if they exist (from partial merge)
          qword: step.qword,
          args: step.args,
          selectorObj: step.selectorObj,
          assertion: step.expected_result || step.expectedResult ? {
            enabled: true,
            type: 'visible',
            expected: step.expected_result || step.expectedResult,
          } : undefined,
        };
      });
      
      // Update test case state
      setTestCase(prev => ({
        ...prev,
        id: testCaseId,
        name: foundCase.name || foundCase.title || 'Imported Test Case',
        description: foundCase.description || '',
        tags: foundCase.tags || [],
        steps: convertedSteps,
      }));
      
      setSavedTestCaseId(testCaseId);
      toast.success(`Loaded "${foundCase.name || foundCase.title}" with ${convertedSteps.length} steps`);
    } catch (error: any) {
      console.error('Error loading test case:', error);
      toast.error(`Error loading test case: ${error.message}`);
    }
  }, []);

  // Track if initial load is complete to prevent auto-save race condition
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  // Auto-load test case from URL parameter
  useEffect(() => {
    if (testCaseIdFromUrl) {
      loadTestCaseById(testCaseIdFromUrl);
    }
  }, [testCaseIdFromUrl, loadTestCaseById]);

  // Mark initial load as complete after first render cycle
  useEffect(() => {
    // Small delay to ensure loading useEffects have completed
    const timer = setTimeout(() => {
      setIsInitialLoadComplete(true);
      console.log('[Builder] Initial load complete, auto-save enabled');
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Auto-save - only after initial load is complete to prevent overwriting imported data
  useEffect(() => {
    if (!isInitialLoadComplete) {
      console.log('[Builder] Skipping auto-save during initial load');
      return;
    }
    console.log('[Builder] Auto-saving test case with', testCase.steps?.length, 'steps');
    localStorage.setItem('unified_test_case', JSON.stringify(testCase));
  }, [testCase, isInitialLoadComplete]);

  // Save history
  useEffect(() => {
    localStorage.setItem('unified_test_history', JSON.stringify(testHistory));
  }, [testHistory]);

  // Convert recorded events to steps (from raw events)
  // PRESERVES selectorObj with fallbacks - same as Suggest feature
  const convertRecordedEvents = (events: any[], startUrl?: string): TestStep[] => {
    console.log('[Builder] Converting events:', events.length, 'startUrl:', startUrl);
    const steps: TestStep[] = [];

    // Always add navigate step first if we have a URL
    if (startUrl) {
      steps.push({
        id: `step_${Date.now()}_nav`,
        type: 'navigate',
        name: 'Open Application',
        url: startUrl,
        enabled: true,
        expectedResult: 'Page loads successfully',
      });
    }

    // Convert ALL events - no limit
    events.forEach((event, idx) => {
      // Extract string selector from event (may be object or string)
      const selectorStr = extractSelectorString(event.selector);
      
      // PRESERVE the full selectorObj with fallbacks (same structure as Suggest)
      const selectorObj = extractSelectorObject(event.selector, event.selectorObj, event);

      const step: TestStep = {
        id: `step_${Date.now()}_${idx}`,
        type: mapEventType(event.type),
        name: generateStepName(event),
        selector: selectorStr,
        selectorObj,  // Preserve full selector with fallbacks
        value: event.value,
        target: extractTargetName(event.selector, event),
        enabled: true,
        expectedResult: generateExpectedResultFromEvent(event),
      };
      steps.push(step);
    });

    console.log('[Builder] Converted to steps:', steps.length);
    return steps;
  };

  // Convert workflow nodes (from sidepanel)
  // PRESERVES selectorObj with fallbacks - same as Suggest feature
  const convertWorkflowNodes = (nodes: any[], startUrl?: string): TestStep[] => {
    console.log('[Builder] Converting nodes:', nodes.length, 'startUrl:', startUrl);
    const steps: TestStep[] = [];

    // Add navigate step first if we have a URL
    if (startUrl) {
      steps.push({
        id: `step_${Date.now()}_nav`,
        type: 'navigate',
        name: 'Open Application',
        url: startUrl,
        enabled: true,
        expectedResult: 'Page loads successfully',
      });
    }

    // Convert ALL nodes - no limit
    nodes.forEach((node, idx) => {
      const nodeData = node.data || node;
      // Extract string selector from node (may be object or string)
      const rawSelector = nodeData.selector || node.selector;
      const selectorStr = extractSelectorString(rawSelector);
      
      // PRESERVE the full selectorObj with fallbacks (same structure as Suggest)
      const selectorObj = extractSelectorObject(
        rawSelector,
        nodeData.selectorObj || node.selectorObj,
        nodeData
      );

      const step: TestStep = {
        id: node.id || `step_${Date.now()}_${idx}`,
        type: mapEventType(node.type || nodeData.type || 'click'),
        name: node.label || nodeData.label || generateNodeName(node),
        selector: selectorStr,
        selectorObj,  // Preserve full selector with fallbacks
        value: nodeData.value || node.value,
        url: nodeData.url || node.url,
        target: extractTargetName(rawSelector, nodeData),
        enabled: true,
        expectedResult: nodeData.manualStep?.expectedResult || nodeData.expectedResult || '',
        assertion: nodeData.assertion,
      };
      steps.push(step);
    });
    
    console.log('[Builder] Converted nodes to steps:', steps.length);
    return steps;
  };

  const generateNodeName = (node: any): string => {
    const nodeData = node.data || node;
    const type = node.type || nodeData.type || 'click';
    
    if (type === 'navigate') return 'Navigate';
    if (type === 'input' || type === 'fill') {
      const val = nodeData.value || node.value || '';
      return `Enter "${val.slice(0, 15)}${val.length > 15 ? '...' : ''}"`;
    }
    if (type === 'click') {
      const target = extractTargetName(nodeData.selector || node.selector, nodeData);
      return target ? `Click "${target}"` : 'Click element';
    }
    return type.charAt(0).toUpperCase() + type.slice(1);
  };


  // Step operations
  const addStep = (type: StepType) => {
    const info = getStepInfo(type);

    // Type-specific defaults
    const typeDefaults: Record<string, Partial<TestStep>> = {
      navigate: {
        name: 'Navigate',
        url: testCase.settings.baseUrl || '',
        expectedResult: 'Page should load successfully'
      },
      click: {
        name: 'Click: [element]',
        expectedResult: 'Element should be clicked'
      },
      input: {
        name: 'Input: [field]',
        value: '',
        expectedResult: 'Value should be entered'
      },
      select: {
        name: 'Select: [option]',
        value: '',
        expectedResult: 'Option should be selected'
      },
      hover: {
        name: 'Hover: [element]',
        expectedResult: 'Element should be hovered'
      },
      wait: {
        name: 'Wait',
        waitTime: 1000,
        expectedResult: 'Wait completed'
      },
      wait_for_element: {
        name: 'Wait for: [element]',
        expectedResult: 'Element should appear'
      },
      assert: {
        name: 'Check: Element Visible',
        expectedResult: 'Element should be visible'
      },
      assert_text: {
        name: 'Verify: Text Contains',
        expectedResult: 'Text should contain expected value'
      },
      assert_value: {
        name: 'Verify: Field Value',
        expectedResult: 'Field value should match expected'
      },
      assert_url: {
        name: 'Verify: URL',
        expectedResult: 'URL should match expected'
      },
      assert_title: {
        name: 'Verify: Page Title',
        expectedResult: 'Page title should match'
      },
      assert_count: {
        name: 'Verify: Element Count',
        expectedResult: 'Element count should match expected'
      },
      screenshot: {
        name: 'Take Screenshot',
        expectedResult: 'Screenshot captured'
      },
      log: {
        name: 'Log: [message]',
        expectedResult: 'Log entry created'
      },
      annotation: {
        name: 'Note: [description]',
        expectedResult: 'Note added to test'
      },
      api: {
        name: 'API: [endpoint]',
        method: 'GET',
        endpoint: '',
        expectedResult: 'API call should succeed'
      },
      api_validate: {
        name: 'Validate: API Response',
        expectedResult: 'Response should match expected'
      },
      api_extract: {
        name: 'Extract: [field] from Response',
        jsonPath: '',
        storeAs: 'extracted_value',
        expectedResult: 'Value extracted from response'
      },
      db_query: {
        name: 'Query: [table]',
        dbType: 'postgres',
        query: '',
        expectedResult: 'Query should return results'
      },
      db_validate: {
        name: 'Validate: DB Record',
        expectedResult: 'Database record should match expected'
      },
      condition: {
        name: 'If: [condition]',
        condition: '',
        expectedResult: 'Condition evaluated'
      },
      loop: {
        name: 'Loop: [count] times',
        loopCount: 1,
        expectedResult: 'Loop completed'
      },
      module: {
        name: 'Run Module: [name]',
        moduleId: '',
        expectedResult: 'Module executed successfully'
      },
      group: {
        name: 'Group: [steps]',
        expectedResult: 'Group of steps executed'
      },
      wait_for_text: {
        name: 'Wait for: [text]',
        expectedResult: 'Text should appear on page'
      },
      wait_for_network: {
        name: 'Wait for: Network Idle',
        expectedResult: 'Network should be idle'
      },
      set_variable: {
        name: 'Set: [variable]',
        variableName: '',
        variableValue: '',
        expectedResult: 'Variable set'
      },
      generate_data: {
        name: 'Generate: [data type]',
        dataType: 'random_string',
        storeAs: 'generated_data',
        expectedResult: 'Data generated'
      },
      extract_text: {
        name: 'Extract: Text from [element]',
        storeAs: 'extracted_text',
        expectedResult: 'Text extracted from page'
      },
      use_data_row: {
        name: 'Use: Data Row [index]',
        dataSource: '',
        rowIndex: 0,
        expectedResult: 'Data row applied'
      },
      upload: {
        name: 'Upload: [file]',
        filePath: '',
        expectedResult: 'File uploaded successfully'
      },
      // BLACK-BOX TESTING - Date & Time
      date_relative: {
        name: 'Generate Relative Date',
        daysOffset: 1, // tomorrow by default
        dateFormat: 'MM/DD/YYYY',
        storeAs: 'generated_date',
        expectedResult: 'Date generated and stored in variable'
      },
      date_verify_future: {
        name: 'Verify Date is Future',
        selector: '',
        expectedResult: 'Date should be in the future'
      },
      date_verify_sequence: {
        name: 'Verify Date Sequence',
        startDateSelector: '',
        endDateSelector: '',
        expectedResult: 'End date should be after start date'
      },
      // BLACK-BOX TESTING - Math & Calculations
      math_verify_multiply: {
        name: 'Verify Multiplication',
        factor1Selector: '',
        factor2Selector: '',
        resultSelector: '',
        expectedResult: 'Product should equal factor1 × factor2'
      },
      math_verify_sum: {
        name: 'Verify Sum of List',
        listSelector: '',
        totalSelector: '',
        expectedResult: 'Sum of all items should equal total'
      },
      math_verify_discount: {
        name: 'Verify % Discount',
        originalPriceSelector: '',
        discountPercent: 10,
        finalPriceSelector: '',
        expectedResult: 'Discount should be correctly applied'
      },
      // BLACK-BOX TESTING - Format Validation
      format_verify: {
        name: 'Verify Format',
        selector: '',
        formatType: 'email', // email, phone, ssn, zip, credit_card, date, custom
        customRegex: '',
        expectedResult: 'Value should match expected format'
      },
      random_string: {
        name: 'Generate Random String',
        length: 10,
        stringType: 'alphanumeric', // alphanumeric, alpha, numeric, email, phone
        storeAs: 'random_value',
        expectedResult: 'Random string generated and stored'
      },
      // BLACK-BOX TESTING - Cross-field & Boundary
      field_visibility: {
        name: 'Verify Field Visibility',
        triggerSelector: '',
        triggerValue: '',
        targetSelector: '',
        shouldBeVisible: true,
        expectedResult: 'Field visibility should change based on trigger'
      },
      boundary_test: {
        name: 'Boundary Value Test',
        inputSelector: '',
        minValue: 0,
        maxValue: 100,
        submitSelector: '',
        errorSelector: '',
        expectedResult: 'Boundary values should be validated correctly'
      },
      // ========== ADVANCED UI - Dynamic Selection & Extraction ==========
      smart_select: {
        name: 'Smart Select: [element]',
        findBy: 'text',
        findCriteria: '',
        findWithin: '',
        expectedResult: 'Element found and clicked'
      },
      extract_variable: {
        name: 'Extract: [value] → ${variable}',
        extractType: 'text',
        variableName: 'extracted_value',
        expectedResult: 'Value extracted and stored in variable'
      },
      computed_assert: {
        name: 'Assert: [expression]',
        expression: '',
        compareOperator: '==',
        compareValue: '',
        tolerance: 0.01,
        expectedResult: 'Computed assertion passed'
      },
      // ========== ADVANCED UI - Table Operations ==========
      table_find: {
        name: 'Table: Find row where [column] = [value]',
        tableSelector: 'table',
        columnName: '',
        rowCriteria: '',
        actionButton: '',
        expectedResult: 'Row found and action performed'
      },
      table_extract: {
        name: 'Table: Extract row data',
        tableSelector: 'table',
        columnName: '',
        rowCriteria: '',
        extractColumns: [],
        variableName: 'table_row',
        expectedResult: 'Row data extracted'
      },
      table_assert: {
        name: 'Table: Verify data',
        tableSelector: 'table',
        expectedResult: 'Table data verified'
      },
      // ========== ADVANCED UI - Complex Interactions ==========
      drag_drop: {
        name: 'Drag: [source] → [target]',
        selector: '',
        targetSelector: '',
        expectedResult: 'Element dragged to target'
      },
      slider: {
        name: 'Slider: Set to [value]',
        selector: '',
        sliderValue: 50,
        sliderMin: 0,
        sliderMax: 100,
        expectedResult: 'Slider value set'
      },
      date_picker: {
        name: 'Date: Select [date]',
        selector: '',
        dateValue: '',
        dateFormat: 'YYYY-MM-DD',
        expectedResult: 'Date selected'
      },
      keyboard: {
        name: 'Press: [key]',
        keyToPress: 'Enter',
        keyModifiers: [],
        expectedResult: 'Key pressed'
      },
      multi_select: {
        name: 'Multi-Select: [options]',
        selector: '',
        selectValues: [],
        expectedResult: 'Multiple options selected'
      },
      // ========== ADVANCED UI - Multi-Context ==========
      frame_switch: {
        name: 'Switch to Frame: [frame]',
        frameSelector: '',
        expectedResult: 'Switched to iframe'
      },
      new_tab: {
        name: 'Tab: [action]',
        tabAction: 'new',
        expectedResult: 'Tab action completed'
      },
      alert_handle: {
        name: 'Alert: [action]',
        alertAction: 'accept',
        expectedResult: 'Alert handled'
      },
      // ========== ADVANCED UI - Loops ==========
      foreach: {
        name: 'For Each: [element] in [list]',
        loopType: 'foreach',
        loopSelector: '',
        loopVariable: 'item',
        loopSteps: [],
        expectedResult: 'Loop completed for all items'
      },
    };

    const defaults = typeDefaults[type] || {};

    const newStep: TestStep = {
      id: `step_${Date.now()}`,
      type,
      name: defaults.name || info.label,
      enabled: true,
      expectedResult: defaults.expectedResult || '',
      ...defaults,
    };

    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, newStep],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    setSelectedStepId(newStep.id);
  };

  const updateStep = (stepId: string, updates: Partial<TestStep>) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  };

  const deleteStep = (stepId: string) => {
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    if (selectedStepId === stepId) setSelectedStepId(null);
  };

  const moveStep = (stepId: string, direction: 'up' | 'down') => {
    setTestCase(prev => {
      const idx = prev.steps.findIndex(s => s.id === stepId);
      if (idx === -1) return prev;
      const newIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= prev.steps.length) return prev;
      const newSteps = [...prev.steps];
      [newSteps[idx], newSteps[newIdx]] = [newSteps[newIdx], newSteps[idx]];
      return { ...prev, steps: newSteps, metadata: { ...prev.metadata, updatedAt: new Date().toISOString() } };
    });
  };

  // Drag and drop handlers for step reordering
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    
    // Reorder steps while dragging for smooth visual feedback
    setTestCase(prev => {
      const newSteps = [...prev.steps];
      const [removed] = newSteps.splice(draggedIndex, 1);
      newSteps.splice(index, 0, removed);
      return { ...prev, steps: newSteps };
    });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    // Update timestamp
    setTestCase(prev => ({
      ...prev,
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() }
    }));
  };

  /**
   * Handle "Record This Step" - Opens recorder in step-specific mode
   * Saves current test case and navigates to recorder with step context
   */
  const handleRecordStep = useCallback(async (stepId: string, stepIndex: number) => {
    const step = testCase.steps.find(s => s.id === stepId);
    if (!step) return;
    
    try {
      // Save current test case first
      const savedTestCase = {
        ...testCase,
        metadata: { ...testCase.metadata, updatedAt: new Date().toISOString() }
      };
      
      // Store in localStorage for recorder to pick up
      localStorage.setItem('recordForStep', JSON.stringify({
        testCaseId: testCase.id,
        testCaseName: testCase.name,
        stepId,
        stepIndex,
        stepName: step.name,
        stepType: step.type,
        manualDescription: (step as any).manualAction || step.description || step.name,
        expectedResult: (step as any).expectedResult,
        timestamp: Date.now(),
      }));
      
      // Also save the full test case for potential auto-save
      localStorage.setItem('pendingTestCase', JSON.stringify(savedTestCase));
      
      toast.success(`Opening trace for step ${stepIndex + 1}: ${step.name}`, {
        description: 'Trace actions to automate this step',
      });

      // Navigate to trace page — use react-router navigate for Electron HashRouter compat
      navigate(`/playwright-recorder?mode=existing&stepId=${stepId}&stepIndex=${stepIndex}`);

    } catch (err) {
      console.error('Failed to setup trace:', err);
      toast.error('Failed to open trace');
    }
  }, [testCase, navigate]);

  const duplicateStep = (stepId: string) => {
    const step = testCase.steps.find(s => s.id === stepId);
    if (!step) return;
    const newStep = { ...step, id: `step_${Date.now()}`, name: `${step.name} (Copy)` };
    const idx = testCase.steps.findIndex(s => s.id === stepId);
    setTestCase(prev => {
      const newSteps = [...prev.steps];
      newSteps.splice(idx + 1, 0, newStep);
      return { ...prev, steps: newSteps, metadata: { ...prev.metadata, updatedAt: new Date().toISOString() } };
    });
  };

  // Import module steps
  const handleImportModule = (moduleSteps: ModuleStep[]) => {
    const newSteps = moduleSteps.map((ms, idx) => ({
      id: `step_${Date.now()}_${idx}`,
      type: ms.type as StepType,
      name: ms.label,
      selector: ms.selector,
      value: ms.value,
      waitTime: ms.waitTime,
      target: extractTargetName(ms.selector),
      enabled: true,
      expectedResult: ms.description || '',
    }));
    
    setTestCase(prev => ({
      ...prev,
      steps: [...prev.steps, ...newSteps],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    toast.success(`Imported ${newSteps.length} steps from module`);
  };

  // Blackbox fallback
  const handleBlackboxLocator = (locator: BlackboxLocator, _code: string) => {
    if (selectedStepId) {
      updateStep(selectedStepId, { fallback: locator });
      toast.success(`Fallback strategy added: ${locator.type}`);
    }
    setShowBlackbox(false);
  };

  // Generate code for export
  const generateCode = useCallback((mode: ExportMode): string => {
    const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
    
    switch (mode) {
      case 'automation':
        return generateAutomationCode(testCase, safeName);
      case 'api':
        return generateAPICode(testCase, safeName);
      case 'database':
        return generateDBCode(testCase, safeName);
      case 'performance':
        return generatePerformanceCode(testCase, safeName);
      case 'manual':
        return generateManualDoc(testCase);
      default:
        return '';
    }
  }, [testCase]);

  // Load precondition test case steps
  const loadPreconditionSteps = async (preconditionId: string): Promise<TestStep[]> => {
    try {
      // First try localStorage
      const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
      let foundCase = localCases.find((tc: any) => tc.id === preconditionId);
      
      // Try backend if not found locally
      if (!foundCase) {
        try {
          const response = await fetch(`${API_BASE_URL}/test-cases/${preconditionId}`);
          if (response.ok) {
            foundCase = await response.json();
          }
        } catch {
          console.log('Could not fetch precondition from backend');
        }
      }
      
      if (!foundCase) {
        console.warn(`Precondition test case ${preconditionId} not found`);
        return [];
      }
      
      // Try to load from unified_data first
      if (foundCase.unified_data) {
        try {
          const unifiedData = typeof foundCase.unified_data === 'string' 
            ? JSON.parse(foundCase.unified_data) 
            : foundCase.unified_data;
          
          if (unifiedData.steps && Array.isArray(unifiedData.steps)) {
            console.log(`[Precondition] Loaded ${unifiedData.steps.length} steps from unified_data`);
            return unifiedData.steps;
          }
        } catch (e) {
          console.warn('Failed to parse unified_data for precondition');
        }
      }
      
      // Fallback: convert steps from raw format
      const rawSteps = foundCase.steps || [];
      return rawSteps.map((step: any, index: number) => {
        // Try to parse test_data
        let originalStep: any = null;
        if (step.test_data) {
          try {
            originalStep = typeof step.test_data === 'string' 
              ? JSON.parse(step.test_data) 
              : step.test_data;
          } catch (e) {}
        }
        
        if (originalStep && originalStep.type) {
          return {
            ...originalStep,
            id: `precond_${preconditionId}_${index}`,
          };
        }
        
        // Basic conversion
        return {
          id: `precond_${preconditionId}_${index}`,
          type: 'click' as StepType,
          name: step.action || `Step ${index + 1}`,
          selector: step.selector || '',
          value: typeof step.value === 'string' ? step.value : '',
          enabled: true,
        };
      });
    } catch (error) {
      console.error('Error loading precondition:', error);
      return [];
    }
  };

  // Run test
  const runTest = async () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to run the test');
      return;
    }

    setIsRunning(true);
    setExecutionResult({ status: 'running', currentStep: 0, results: [], logs: [] });

    try {
      // Load precondition steps and merge them
      let allSteps: TestStep[] = [];
      
      if (testCase.preconditions && testCase.preconditions.length > 0) {
        const enabledPreconditions = testCase.preconditions.filter(p => p.enabled);
        
        for (const precond of enabledPreconditions) {
          console.log(`[Run Test] Loading precondition: ${precond.testCaseName}`);
          toast.info(`Loading precondition: ${precond.testCaseName}`);
          
          const precondSteps = await loadPreconditionSteps(precond.testCaseId);
          
          if (precondSteps.length > 0) {
            // Mark these steps as precondition steps
            const markedSteps = precondSteps.map((step, idx) => ({
              ...step,
              name: `[Precond] ${step.name}`,
              _isPrecondition: true,
              _preconditionName: precond.testCaseName,
            }));
            allSteps = [...allSteps, ...markedSteps];
            console.log(`[Run Test] Added ${precondSteps.length} steps from precondition: ${precond.testCaseName}`);
          } else {
            toast.warning(`Precondition "${precond.testCaseName}" has no steps`);
          }
        }
      }
      
      // Add main test steps after precondition steps
      allSteps = [...allSteps, ...testCase.steps];
      
      // Build environment config for URL rewriting at execution time
      const envForExecution = environments.find(e => e.id === selectedEnvironmentId);
      const environmentConfig = envForExecution ? {
        test_base_url: (testCase.settings.baseUrl || '').replace(/\/+$/, ''),
        env_base_url: envForExecution.base_url.replace(/\/+$/, ''),
        env_name: envForExecution.name,
        variables: Object.fromEntries(
          envForExecution.variables.filter(v => v.enabled).map(v => [v.key, v.value])
        ),
      } : null;

      // Create merged test case for execution
      const mergedTestCase: any = {
        ...testCase,
        steps: allSteps,
        preconditions: [], // Clear preconditions since we're inlining them
        environmentConfig, // Passed to Electron TestExecutor and backend
      };
      
      // In Electron, use FAST PATH via playwrightRecorder.runTest() (same engine as Record tab)
      // This uses SimplePlayback (Playwright-native) which is 3-10x faster than TestExecutor
      if (isElectron()) {
        const flowstralApi = (window as any).flowstral;
        const electronApi = (window as any).electronAPI;

        if (flowstralApi?.playwrightRecorder?.runTest) {
          console.log('[Run Test] ⚡ Using FAST PATH: playwrightRecorder.runTest() (SimplePlayback)');
          toast.info('Running test (fast playback)...');

          // Convert Build tab TestStep[] to Record tab normalized action format
          const normalizedSteps = allSteps.filter(s => s.enabled).map((step, idx) => {
            // Extract URL from navigate steps
            const urlValue = step.type === 'navigate' ? (step.url || step.value || '') : '';
            // Build selector text from target, name, or selector
            const labelText = step.target || step.name || '';
            // Get the best available selector
            const selectorStr = step.selectorObj?.optimizedSelector || step.selectorObj?.playwright || step.selectorObj?.selector || step.selector || '';

            // Map Build tab step types to Record tab qwords
            const typeMap: Record<string, string> = {
              'click': 'click', 'input': 'fill', 'navigate': 'goto', 'select': 'selectOption',
              'hover': 'hover', 'assert': 'assert', 'wait': 'wait', 'scroll': 'scroll',
              'keyboard': 'keyboard', 'screenshot': 'screenshot', 'manual_step': 'click',
              'drag_drop': 'dragAndDrop', 'file_upload': 'setInputFiles', 'double_click': 'dblclick',
              'right_click': 'click', 'clear': 'clear', 'check': 'check', 'uncheck': 'uncheck',
            };
            const qword = typeMap[step.type] || step.type || 'click';

            return {
              id: step.id,
              qword,
              args: qword === 'goto' ? [urlValue] : qword === 'fill' ? [labelText, step.value || ''] : [labelText],
              description: step.name || step.description || `${step.type} ${labelText}`,
              timestamp: Date.now(),
              type: step.type,
              value: step.value,
              selector: selectorStr,
              selectorObj: {
                ...(step.selectorObj || {}),
                text: labelText,
                selector: selectorStr,
                playwright: step.selectorObj?.playwright || selectorStr,
                fallbacks: step.selectorObj?.fallbacks || (selectorStr ? [{ playwright: selectorStr, selector: selectorStr }] : []),
              },
            };
          });

          // Extract URL from first navigate step for the playback URL
          const firstNavStep = normalizedSteps.find(s => s.qword === 'goto' && s.args[0]);
          let playbackUrl = firstNavStep?.args[0] || '';

          // ═══════════════════════════════════════════════════════════
          // ENVIRONMENT URL REWRITING — swap base URL at execution time
          // ═══════════════════════════════════════════════════════════
          const selectedEnv = environments.find(e => e.id === selectedEnvironmentId);
          if (selectedEnv) {
            const testBaseUrl = (testCase.settings.baseUrl || '').replace(/\/+$/, '');
            const envBaseUrl = selectedEnv.base_url.replace(/\/+$/, '');

            if (testBaseUrl && envBaseUrl && testBaseUrl !== envBaseUrl) {
              console.log(`[Run Test] 🌍 Environment: "${selectedEnv.name}" — rewriting ${testBaseUrl} → ${envBaseUrl}`);

              // Helper: rewrite a single URL
              const rewriteUrl = (url: string): string => {
                if (!url) return url;
                if (url.startsWith(testBaseUrl)) {
                  return envBaseUrl + url.substring(testBaseUrl.length);
                }
                return url;
              };

              // Rewrite playback launch URL
              playbackUrl = rewriteUrl(playbackUrl);

              // Rewrite all navigate step URLs
              normalizedSteps.forEach(s => {
                if (s.qword === 'goto' && s.args[0]) {
                  s.args[0] = rewriteUrl(s.args[0]);
                }
              });

              toast.info(`Running against: ${selectedEnv.name} (${envBaseUrl})`);
            }
          }

          // Subscribe to real-time IPC events for live progress
          const stepStartUnsub = electronApi?.on?.('playwright-test-step-start', ({ index, step }: any) => {
            setExecutionResult(prev => ({
              ...prev,
              currentStep: index,
              logs: [...prev.logs, `▶ Step ${index + 1}: ${step?.description || step?.qword || 'running'}`]
            }));
          });

          const stepCompleteUnsub = electronApi?.on?.('playwright-test-step-complete', ({ index, result: stepResult }: any) => {
            const statusEmoji = stepResult?.success ? '✅' : '❌';
            const healedNote = stepResult?.healed ? ' 🔧 (healed)' : '';
            setExecutionResult(prev => ({
              ...prev,
              results: [...prev.results, {
                stepId: allSteps[index]?.id,
                status: stepResult?.success ? 'passed' : 'failed',
                error: stepResult?.error || undefined,
                healed: stepResult?.healed || false,
                workingSelector: stepResult?.workingSelector || undefined,
              }],
              logs: [...prev.logs, `${statusEmoji} Step ${index + 1}: ${stepResult?.success ? 'passed' : 'failed'}${stepResult?.error ? ' - ' + stepResult.error : ''}${healedNote}`]
            }));
          });

          try {
            const result = await flowstralApi.playwrightRecorder.runTest({
              steps: normalizedSteps,
              url: playbackUrl,
              freshBrowser: true,
              keepBrowserOpenOnFailure: keepBrowserOpenOnFailure,
              slowMo: 200, // 1x speed
              highlight: true,
              useSimplePlayback: true, // V2 fast playback (same as Record tab)
            });

            // Cleanup subscriptions
            if (stepStartUnsub) stepStartUnsub();
            if (stepCompleteUnsub) stepCompleteUnsub();

            const passed = result?.success || result?.status === 'passed';
            const duration = result?.duration || result?.totalDuration || 0;

            // Build step results from the response
            // When overall test passed, all steps are considered passed (overall result is source of truth)
            const stepResults = result?.stepResults || result?.results || [];
            const mappedResults = allSteps.filter(s => s.enabled).map((step, idx) => {
              const sr = stepResults[idx];
              const stepPassed = passed ? true : (sr ? sr.success : (idx < (result?.failedStep ?? 999)));
              return {
                stepId: step.id,
                status: stepPassed ? 'passed' : 'failed',
                error: (!stepPassed && sr?.error) ? sr.error : undefined,
                healed: sr?.healed || false,
                workingSelector: sr?.workingSelector || undefined,
              };
            });

            setExecutionResult(prev => ({
              ...prev,
              status: passed ? 'passed' : 'failed',
              results: mappedResults.length > 0 ? mappedResults : prev.results,
              logs: [...prev.logs, `\n${passed ? '✅ TEST PASSED' : '❌ TEST FAILED'} (${duration}ms)`]
            }));

            setIsRunning(false);

            if (passed) {
              toast.success('Test passed!');
              setFailureState(null);
              setBrowserKeptOpen(false);
            } else {
              toast.error(`Test failed: ${result?.error || 'See logs for details'}`);

              // Track failure state for repair wizard
              const failedIdx = result?.failedStep ?? result?.failedStepIndex;
              if (failedIdx !== undefined && failedIdx !== null) {
                const failedStepData = testCase.steps[failedIdx];
                if (failedStepData) {
                  setFailureState({
                    stepIndex: failedIdx,
                    step: failedStepData,
                    error: result?.error || 'Unknown error',
                    screenshot: result?.screenshot || null,
                    url: result?.url || null,
                    similarElements: result?.similarElements || [],
                  });
                  setBrowserKeptOpen(keepBrowserOpenOnFailure && result?.browserKeptOpen);
                }
              }
            }

            return;
          } catch (fastPathError: any) {
            // Cleanup subscriptions on error
            if (stepStartUnsub) stepStartUnsub();
            if (stepCompleteUnsub) stepCompleteUnsub();
            console.warn('[Run Test] Fast path failed, falling back to TestExecutor:', fastPathError.message);
            // Fall through to TestExecutor fallback below
          }
        }

        // Fallback to TestExecutor (slower but works when recorder isn't available)
        const api = (window as any).electronAPI;
        if (api?.testRunner) {
          console.log('[Run Test] Using Electron TestExecutor (fallback)');
          toast.info('Running test locally...');

          // Subscribe to step events
          const stepStartUnsub = api.on('test-step-start', ({ index, step }: { index: number; step: any }) => {
            setExecutionResult(prev => ({
              ...prev,
              currentStep: index,
              logs: [...prev.logs, `▶ Step ${index + 1}: ${step.name || step.type}`]
            }));
          });

          const stepCompleteUnsub = api.on('test-step-complete', ({ index, step, result }: { index: number; step: any; result: any }) => {
            const statusEmoji = result.status === 'passed' ? '✅' : result.status === 'failed' ? '❌' : '⏭️';
            setExecutionResult(prev => ({
              ...prev,
              results: [...prev.results, result],
              logs: [...prev.logs, `${statusEmoji} Step ${index + 1}: ${result.status}${result.error ? ' - ' + result.error : ''}`]
            }));
          });

          const result = await api.testRunner.executeTest(mergedTestCase);

          // Cleanup subscriptions
          if (stepStartUnsub) stepStartUnsub();
          if (stepCompleteUnsub) stepCompleteUnsub();

          setExecutionResult(prev => ({
            ...prev,
            status: result.status,
            logs: [...prev.logs, `\n${result.status === 'passed' ? 'TEST PASSED' : 'TEST FAILED'} (${result.duration}ms)`]
          }));

          setIsRunning(false);

          if (result.status === 'passed') {
            toast.success('Test passed!');
            setFailureState(null);
            setBrowserKeptOpen(false);
          } else {
            toast.error(`Test failed: ${result.error || 'See logs for details'}`);

            if (result.failedStep !== undefined && result.failedStep !== null) {
              const failedStepIdx = typeof result.failedStep === 'number' ? result.failedStep : parseInt(result.failedStep);
              const failedStepData = testCase.steps[failedStepIdx];
              if (failedStepData) {
                setFailureState({
                  stepIndex: failedStepIdx,
                  step: failedStepData,
                  error: result.error || 'Unknown error',
                  screenshot: result.screenshot || null,
                  url: result.url || null,
                  similarElements: result.similarElements || [],
                });
                setBrowserKeptOpen(keepBrowserOpenOnFailure && result.browserKeptOpen);
              }
            }
          }

          return;
        }
      }
      
      // Fallback to backend execution
      // Apply environment URL rewriting to steps before code generation
      if (environmentConfig && environmentConfig.test_base_url && environmentConfig.env_base_url
          && environmentConfig.test_base_url !== environmentConfig.env_base_url) {
        const testBase = environmentConfig.test_base_url;
        const envBase = environmentConfig.env_base_url;
        console.log(`[Run Test] 🌍 Backend fallback: rewriting ${testBase} → ${envBase}`);
        mergedTestCase.steps = mergedTestCase.steps.map((step: any) => {
          if (step.type === 'navigate' && step.url && step.url.startsWith(testBase)) {
            return { ...step, url: envBase + step.url.substring(testBase.length) };
          }
          return step;
        });
        toast.info(`Running against: ${environmentConfig.env_name} (${envBase})`);
      }
      const safeName = testCase.name.replace(/[^a-z0-9]+/gi, '_').toLowerCase();
      const code = generateAutomationCode(mergedTestCase, safeName);
      const response = await fetch(`${API_BASE_URL}/api/flowstral/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: code,
          language: 'python',
          browser: 'chromium',
          headless: false,
          workflow_name: testCase.name.replace(/[^a-z0-9]+/gi, '_'),
        }),
      });

      const responseData = await response.json();
      
      // The backend wraps the result in execution_result
      const result = responseData.execution_result || responseData;
      
      // Get output from stdout or output field
      const fullOutput = result.stdout || result.output || '';
      const logs = fullOutput ? fullOutput.split('\n') : [];
      const stderr = result.stderr || '';
      
      console.log('[Test Run] Response:', responseData);
      console.log('[Test Run] Full stdout:', fullOutput);
      console.log('[Test Run] Stderr:', stderr);
      console.log('[Test Run] Exit code:', result.exit_code, 'Status:', result.status || responseData.status);
      
      // Combine stdout and stderr for error detection
      const allOutput = fullOutput + '\n' + stderr;
      
      // Check exit code - treat undefined as success if status is 'success'
      const exitCode = result.exit_code;
      const isExitCodeFailure = exitCode !== undefined && exitCode !== null && exitCode !== 0;
      
      // More robust failure detection - check exit code AND output for failure markers
      const hasFailureMarker = 
        allOutput.includes('TEST FAILED') || 
        allOutput.includes('FAILED:') ||
        (allOutput.includes('Step') && allOutput.includes('FAILED')) ||
        allOutput.includes('Traceback') ||
        allOutput.includes('Exception:') ||
        allOutput.includes('sys.exit(1)') ||
        allOutput.includes('Error:') ||
        isExitCodeFailure;
        
      const hasSuccessMarker = 
        allOutput.includes('TEST PASSED') || 
        allOutput.includes('All steps completed successfully') ||
        allOutput.includes('Test completed successfully') ||
        ((result.status === 'success' || responseData.status === 'success') && !hasFailureMarker);
      
      // Pass if: success marker AND no explicit failure markers
      const passed = hasSuccessMarker && !hasFailureMarker;
      
      // Extract failure details from logs - check multiple patterns
      let failedStep: number | null = null;
      let errorMessage: string | null = null;
      let screenshotPath: string | null = null;
      
      // Pattern 1: "TEST FAILED at step X" or "FAILED at step X"
      const stepMatch = allOutput.match(/(?:TEST )?FAILED at step (\d+)/i);
      if (stepMatch) {
        failedStep = parseInt(stepMatch[1]);
      }
      
      // Pattern 2: "Step X FAILED:" or "✗ Step X FAILED"
      if (!failedStep) {
        const stepMatch2 = allOutput.match(/Step (\d+).*?FAILED/i);
        if (stepMatch2) {
          failedStep = parseInt(stepMatch2[1]);
        }
      }
      
      // Pattern 3: Look for "failed_step" in output
      if (!failedStep) {
        const stepMatch3 = allOutput.match(/failed_step['":\s]+(\d+)/i);
        if (stepMatch3) {
          failedStep = parseInt(stepMatch3[1]);
        }
      }
      
      // Extract error message - look for multiple patterns
      const errorPatterns = [
        /Error:\s*(.+?)(?:\n|$)/,
        /Exception:\s*(.+?)(?:\n|$)/,
        /error_message['":\s]+['"]?([^'"}\n]+)/,
        /TimeoutError:\s*(.+?)(?:\n|$)/,
        /playwright\._impl\._errors\.(\w+Error):\s*(.+?)(?:\n|$)/,
      ];
      
      for (const pattern of errorPatterns) {
        const match = allOutput.match(pattern);
        if (match) {
          errorMessage = match[2] || match[1];
          break;
        }
      }
      
      // Extract screenshot path
      const screenshotMatch = allOutput.match(/Screenshot(?:\ssaved)?:\s*(.+\.png)/i);
      if (screenshotMatch) {
        screenshotPath = screenshotMatch[1].trim();
      }
      
      // If we detected a failure but couldn't find the step, default to 1
      if (!passed && !failedStep && !hasSuccessMarker) {
        failedStep = 1; // Assume first step failed if we can't determine
      }
      
      // If no error message but we have Traceback, try to extract it
      if (!errorMessage && allOutput.includes('Traceback')) {
        const lines = allOutput.split('\n');
        const lastLine = lines.filter(l => l.trim() && !l.startsWith(' ')).pop();
        if (lastLine && lastLine.includes('Error')) {
          errorMessage = lastLine;
        }
      }
      
      console.log('[Test Run] Detected - passed:', passed, 'failedStep:', failedStep, 'error:', errorMessage);
      
      // Combine logs for display
      const allLogs = [...logs];
      if (stderr) {
        allLogs.push('--- STDERR ---');
        allLogs.push(...stderr.split('\n'));
      }
      
      setExecutionResult(prev => ({
        ...prev,
        status: passed ? 'passed' : 'failed',
        logs: allLogs,
        currentStep: failedStep || (passed ? testCase.steps.length : 1),
        results: testCase.steps.map((step, idx) => ({
          stepId: step.id,
          status: passed ? 'passed' : (failedStep && idx + 1 >= failedStep ? 'failed' : 'passed'),
          error: failedStep && idx + 1 === failedStep ? errorMessage || undefined : undefined,
        })),
      }));

      // Save to history with more details
      const runId = `run_${Date.now()}`;
      const historyEntry = {
        id: runId,
        testName: testCase.name,
        status: passed ? 'passed' : 'failed',
        timestamp: new Date().toISOString(),
        duration: result.duration || 0,
        steps: testCase.steps.length,
        failedStep: passed ? null : failedStep,
        errorMessage: passed ? null : (errorMessage?.slice(0, 100) || 'Check logs for details'),
        screenshotPath,
        logs: logs.slice(-10), // Store last 10 log lines
      };
      setTestHistory(prev => [historyEntry, ...prev.slice(0, 49)]);
      
      // Push to results ingestion service for dashboard
      const runData: TestRunData = {
        run_id: runId,
        org_id: 'local',
        project_id: 'unified-builder',
        test_name: testCase.name,
        test_cases: testCase.steps.map((step, idx) => ({
          case_id: step.id,
          status: passed ? 'passed' : (failedStep && idx + 1 >= failedStep ? 'failed' : 'passed') as 'passed' | 'failed' | 'skipped',
          duration: Math.round((result.duration || 0) / testCase.steps.length),
          error: failedStep && idx + 1 === failedStep ? errorMessage || undefined : undefined,
          step_number: idx + 1,
        })),
        metadata: {
          environment: 'local',
          browser: 'chromium',
          timestamp: new Date().toISOString(),
          duration: result.duration || 0,
          failed_step: failedStep || undefined,
          error_message: errorMessage || undefined,
          screenshot_path: screenshotPath || undefined,
        }
      };
      resultsIngestionService.ingestResults(runData);

      if (passed) {
        toast.success('Test passed!');
        // Clear failure state on success
        setFailureState(null);
        setBrowserKeptOpen(false);
      } else {
        const stepInfo = failedStep ? `step ${failedStep}` : 'test';
        const errorInfo = errorMessage?.slice(0, 40) || 'Check logs';
        toast.error(`Failed at ${stepInfo}: ${errorInfo}`);
        
        // Track failure state for repair wizard
        if (failedStep !== null && failedStep > 0) {
          const failedStepData = testCase.steps[failedStep - 1]; // Convert 1-indexed to 0-indexed
          if (failedStepData) {
            setFailureState({
              stepIndex: failedStep - 1,
              step: failedStepData,
              error: errorMessage || 'Unknown error',
              screenshot: screenshotPath,
              url: result.url || null,
            });
            // Check if browser was kept open
            setBrowserKeptOpen(keepBrowserOpenOnFailure && result.browserKeptOpen);
          }
        }
      }
    } catch (error: any) {
      console.error('[Test Run] Execution error:', error);
      const errorMsg = error?.message || String(error) || 'Unknown error';
      const errorLogs = [
        `Execution Error: ${errorMsg}`,
        '',
        'Possible causes:',
        '- Backend server not running (start with: cd backend && uvicorn app.main:app)',
        '- Network error',
        '- Invalid test code generated',
        '',
        error?.stack ? `Stack: ${error.stack}` : '',
      ].filter(Boolean);
      
      setExecutionResult(prev => ({ 
        ...prev, 
        status: 'failed', 
        logs: errorLogs
      }));
      toast.error(`Execution failed: ${errorMsg.slice(0, 50)}`);
    } finally {
      setIsRunning(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════
  // MANUAL EXECUTION FUNCTIONS
  // ═══════════════════════════════════════════════════════════════
  
  const startManualExecution = () => {
    if (testCase.steps.length === 0) {
      toast.error('Add steps to execute manually');
      return;
    }
    setIsManualExecution(true);
    setManualCurrentStep(0);
    setManualResults({});
    setManualExecutionStartTime(new Date());
    toast.info('Manual execution started. Follow each step and mark Pass/Fail.');
  };

  const endManualExecution = () => {
    setIsManualExecution(false);
    
    // Calculate summary
    const results = Object.values(manualResults);
    const passed = results.filter(r => r.result === 'passed').length;
    const failed = results.filter(r => r.result === 'failed').length;
    const skipped = results.filter(r => r.result === 'skipped').length;
    const total = testCase.steps.length;
    
    // Update step results in test case
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        const result = manualResults[step.id];
        if (result) {
          return {
            ...step,
            manualResult: result.result,
            manualNotes: result.notes,
            manualExecutedAt: result.executedAt,
          };
        }
        return step;
      }),
    }));
    
    if (failed > 0) {
      toast.error(`Manual execution completed: ${passed} passed, ${failed} failed, ${skipped} skipped`);
    } else {
      toast.success(`Manual execution completed: ${passed}/${total} passed!`);
    }
  };

  const markStepResult = (stepId: string, result: 'passed' | 'failed' | 'skipped' | 'blocked', notes?: string) => {
    setManualResults(prev => ({
      ...prev,
      [stepId]: {
        result,
        notes,
        executedAt: new Date().toISOString(),
      }
    }));
    
    // Auto-advance to next step
    if (manualCurrentStep < testCase.steps.length - 1) {
      setTimeout(() => setManualCurrentStep(prev => prev + 1), 300);
    }
  };

  const getCurrentManualStep = () => testCase.steps[manualCurrentStep];

  // ═══════════════════════════════════════════════════════════════
  // STEP REPAIR FUNCTIONS (for fixing failed steps)
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Open repair wizard for a failed step
   */
  const openRepairWizard = useCallback((stepIndex: number) => {
    setRepairStepIndex(stepIndex);
    setRepairWizardOpen(true);
  }, []);

  /**
   * Save repair updates to the step
   */
  const handleRepairSave = useCallback((updates: { manualSelector?: string; manualText?: string }) => {
    if (repairStepIndex === null) return;
    
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map((step, idx) => {
        if (idx !== repairStepIndex) return step;
        return {
          ...step,
          // Update selector with manual override
          selector: updates.manualSelector || step.selector,
          // Store manual overrides for fallback during playback
          manualSelector: updates.manualSelector,
          manualText: updates.manualText,
          // Update name/value if text changed
          ...(updates.manualText && step.type === 'click' ? { name: updates.manualText } : {}),
          ...(updates.manualText && step.type === 'input' ? { value: updates.manualText } : {}),
        };
      }),
    }));
    
    setRepairWizardOpen(false);
    setRepairStepIndex(null);
    toast.success('Step updated! Changes will apply on next run.');
  }, [repairStepIndex]);

  /**
   * Open Quick Re-record modal for inline step re-recording
   * This is the simple flow - opens browser and lets user pick element without leaving builder
   */
  const openQuickRerecord = useCallback((stepIndex: number) => {
    setQuickRerecordStepIndex(stepIndex);
    setQuickRerecordOpen(true);
  }, []);
  
  /**
   * Handle save from Quick Re-record modal
   */
  const handleQuickRerecordSave = useCallback((updates: { manualSelector?: string; manualText?: string; selectorObj?: any }) => {
    if (quickRerecordStepIndex === null) return;
    
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map((step, idx) => {
        if (idx !== quickRerecordStepIndex) return step;
        return {
          ...step,
          selector: updates.manualSelector || step.selector,
          manualSelector: updates.manualSelector,
          manualText: updates.manualText,
          selectorObj: updates.selectorObj || step.selectorObj,
          // Update name/value if text changed
          ...(updates.manualText && step.type === 'click' ? { name: updates.manualText } : {}),
          ...(updates.manualText && step.type === 'input' ? {} : {}),
        };
      }),
    }));
    
    // Clear failure state since step was fixed
    setFailureState(null);
    
    setQuickRerecordOpen(false);
    setQuickRerecordStepIndex(null);
  }, [quickRerecordStepIndex]);

  /**
   * Navigate to Recorder tab to re-record this step (full recording experience)
   * Passes step context via localStorage so recorder can pre-populate
   */
  const handleRerecordInRecorder = useCallback((stepIndex: number) => {
    const step = testCase.steps[stepIndex];
    if (!step) return;

    // Store context for recorder to pick up
    const rerecordContext = {
      source: 'unified-builder',
      testCaseId: savedTestCaseId || testCase.id,
      testCaseName: testCase.name,
      stepIndex,
      step: {
        ...step,
        // Include full step data for context
      },
      returnTo: `/builder${savedTestCaseId ? `?id=${savedTestCaseId}` : ''}`,
      timestamp: Date.now(),
    };
    
    // Save to localStorage for the recorder to pick up
    localStorage.setItem('flowstral_rerecord_context', JSON.stringify(rerecordContext));
    
    // Navigate to trace page
    navigate('/playwright-recorder?mode=rerecord');

    toast.info('🔍 Opening Smart Trace... Re-trace the step and save to update the test case.');
  }, [testCase, savedTestCaseId, navigate]);

  /**
   * Re-open browser to the failure state for manual inspection/repair
   */
  const handleReopenBrowser = useCallback(async () => {
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.reopenToFailure) {
      try {
        const result = await flowstral.playwrightRecorder.reopenToFailure();
        if (result?.success) {
          setBrowserKeptOpen(true);
          toast.success('Browser re-opened to failure state');
          return { success: true };
        }
        return { success: false, error: result?.error || 'Failed to re-open browser' };
      } catch (e: any) {
        return { success: false, error: e.message || 'Failed to re-open browser' };
      }
    }
    return { success: false, error: 'Browser re-open not available' };
  }, []);

  /**
   * Retry the failed step with updated selector/text
   */
  const handleRetryStep = useCallback(async (updates: { manualSelector?: string; manualText?: string }) => {
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.retryFailedStep) {
      try {
        const result = await flowstral.playwrightRecorder.retryFailedStep(updates);
        return result;
      } catch (e: any) {
        return { success: false, error: e.message || 'Retry failed' };
      }
    }
    return { success: false, error: 'Retry function not available' };
  }, []);

  /**
   * Resume test from the failed step (optionally skip it)
   */
  const handleResumeFromHere = useCallback(async (options?: { skipFailedStep?: boolean }) => {
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.resumeFromFailure) {
      try {
        const result = await flowstral.playwrightRecorder.resumeFromFailure(options);
        if (result?.success) {
          // Clear failure state on successful resume
          setFailureState(null);
          setBrowserKeptOpen(false);
          toast.success('Test resumed successfully!');
        }
        return result;
      } catch (e: any) {
        return { success: false, error: e.message || 'Resume failed' };
      }
    }
    return { success: false, error: 'Resume function not available' };
  }, []);

  /**
   * Close the browser that was kept open after failure
   */
  const handleCloseBrowser = useCallback(async () => {
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.closeBrowser) {
      try {
        const result = await flowstral.playwrightRecorder.closeBrowser();
        if (result?.success) {
          setBrowserKeptOpen(false);
          return { success: true };
        }
        return result;
      } catch (e: any) {
        return { success: false, error: e.message };
      }
    }
    return { success: false };
  }, []);

  // Build test case data for API
  const buildTestCaseData = (name?: string) => ({
    title: name || testCase.name,
    name: name || testCase.name,
    description: testCase.description,
    test_type: 'unified',
    steps: testCase.steps.map((s, i) => ({
      step_number: i + 1,
      action: s.name,
      expected_result: s.expectedResult || '',
      assertion_type: s.assertionType || null,
      assertion_target: s.assertionTarget || null,
      assertion_value: s.assertionValue || null,
      test_data: JSON.stringify(s),
    })),
    tags: testCase.tags,
    unified_data: JSON.stringify(testCase),
  });

  // Save test case - update if exists, create if new
  const saveTestCase = async () => {
    try {
      const testCaseData = buildTestCaseData();
      const testCaseId = savedTestCaseId || `tc_${Date.now()}`;
      
      // Create the full test case object
      const fullTestCase = {
        id: testCaseId,
        ...testCaseData,
        unified_data: testCase,
        steps: testCase.steps,
        createdAt: testCase.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      // Save to Electron local storage (JSON files) if available
      if (isElectron()) {
        await localData.saveTestCase(fullTestCase);
        console.log('[Save] Saved to Electron local storage');
      }
      
      // Also save to browser localStorage (for web and as backup)
      try {
        const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
        const existingIndex = localCases.findIndex((tc: any) => tc.id === testCaseId);
        if (existingIndex >= 0) {
          localCases[existingIndex] = fullTestCase;
        } else {
          localCases.push(fullTestCase);
        }
        localStorage.setItem('test_cases', JSON.stringify(localCases));
        console.log('[Save] Saved to browser localStorage');
      } catch (localStorageError) {
        console.warn('[Save] Could not save to localStorage:', localStorageError);
      }
      
      // Update saved ID
      if (!savedTestCaseId) {
        setSavedTestCaseId(testCaseId);
      }
      
      // Also try to save to backend (may fail if offline)
      try {
        if (savedTestCaseId) {
          // Update existing test case
          const response = await fetch(`${API_BASE_URL}/test-cases/${savedTestCaseId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testCaseData),
          });
          
          if (response.ok) {
            toast.success('Test case saved');
          } else {
            // Backend failed but already saved locally
            toast.success('Saved locally');
          }
        } else {
          // Create new test case
          const response = await fetch(`${API_BASE_URL}/test-cases`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(testCaseData),
          });

          if (response.ok) {
            const data = await response.json();
            setSavedTestCaseId(data.id);
            toast.success('Test case saved');
          } else {
            // Backend failed but already saved locally
            toast.success('Saved locally');
          }
        }
      } catch (networkError) {
        // Network error - already saved locally
        console.log('[Save] Backend unavailable, saved locally');
        toast.success('Saved locally');
      }
    } catch (error) {
      console.error('[Save] Error:', error);
      toast.error('Failed to save');
    }
  };
  
  // Save As - always create new with different name
  const saveTestCaseAs = async (newName: string) => {
    try {
      const testCaseData = buildTestCaseData(newName);
      
      const response = await fetch(`${API_BASE_URL}/test-cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCaseData),
      });

      if (response.ok) {
        const data = await response.json();
        // Update current test case name and ID
        setTestCase(prev => ({ ...prev, name: newName }));
        setSavedTestCaseId(data.id);
        toast.success(`Saved as "${newName}"`);
        setShowSaveAsDialog(false);
        setSaveAsName('');
      } else {
        toast.error('Failed to save');
      }
    } catch (error) {
      console.error('[SaveAs] Error:', error);
      toast.error('Failed to save');
    }
  };
  
  // Load available test cases for import
  const loadAvailableTestCases = async () => {
    setImportLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/test-cases?limit=100`);
      if (response.ok) {
        const data = await response.json();
        // Filter out current test case and format the list
        const testCases = (Array.isArray(data) ? data : [])
          .filter((tc: any) => tc.id !== testCase.id && tc.id !== savedTestCaseId)
          .map((tc: any) => ({
            id: tc.id,
            name: tc.name || tc.title || 'Unnamed Test',
            description: tc.description,
            steps: tc.steps?.length || 0,
          }));
        setAvailableTestCases(testCases);
      }
    } catch (error) {
      console.error('[Import] Error loading test cases:', error);
      toast.error('Failed to load test cases');
    } finally {
      setImportLoading(false);
    }
  };
  
  // Add test case as precondition
  const addPrecondition = (testCaseId: string, testCaseName: string) => {
    // Check if already added
    if (testCase.preconditions?.some(p => p.testCaseId === testCaseId)) {
      toast.error('Test case already added as precondition');
      return;
    }
    
    setTestCase(prev => ({
      ...prev,
      preconditions: [
        ...(prev.preconditions || []),
        { testCaseId, testCaseName, enabled: true }
      ],
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    toast.success(`Added "${testCaseName}" as precondition`);
  };
  
  // Remove precondition
  const removePrecondition = (testCaseId: string) => {
    setTestCase(prev => ({
      ...prev,
      preconditions: (prev.preconditions || []).filter(p => p.testCaseId !== testCaseId),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
  };
  
  // Toggle precondition enabled
  const togglePrecondition = (testCaseId: string) => {
    setTestCase(prev => ({
      ...prev,
      preconditions: (prev.preconditions || []).map(p => 
        p.testCaseId === testCaseId ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  // Generate test data for all input steps
  const generateAllTestData = (forceRegenerate = false) => {
    let count = 0;
    setTestCase(prev => ({
      ...prev,
      steps: prev.steps.map(step => {
        if ((step.type === 'input' || step.type === 'fill') && (forceRegenerate || !step.value)) {
          count++;
          // Use the step name to detect field type
          const fieldLabel = step.name || step.target || 'text';
          const detected = detectFieldType(fieldLabel);
          const newValue = generateSmartValue(detected.type, fieldLabel, detected.constraints);
          console.log(`[Fill Data] Field: "${fieldLabel}" -> Type: "${detected.type}" -> Value: "${newValue}"`);
          return {
            ...step,
            value: newValue
          };
        }
        return step;
      }),
      metadata: { ...prev.metadata, updatedAt: new Date().toISOString() },
    }));
    if (count > 0) {
      toast.success(`Generated smart test data for ${count} input fields`);
    } else {
      toast.info('No input fields to fill');
    }
  };

  // Export handler
  const handleExport = (mode: ExportMode) => {
    const code = generateCode(mode);
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    
    const ext = mode === 'manual' ? 'md' : mode === 'performance' ? 'js' : 'py';
    a.download = `${testCase.name.replace(/[^a-z0-9]+/gi, '_')}_${mode}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported as ${mode}`);
  };

  // Debug: Log state on render
  console.log('[Builder] Rendering with', testCase.steps.length, 'steps');
  
  return (
    <div className="flex flex-col overflow-hidden bg-background h-full text-foreground" style={{ maxHeight: 'calc(100vh - 4rem)', minHeight: '600px' }}>
        {/* Header */}
        <header className="flex-none border-b border-border bg-card px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Title - Expanded to show full name */}
            <div className="flex items-start gap-3 max-w-[400px]">
              <div className="p-2 rounded-lg bg-primary shadow-sm shrink-0 mt-1">
                <Layers className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0 group">
                {/* Display mode - truncated with ellipsis */}
                <div 
                  className="text-lg font-semibold text-foreground leading-7 cursor-text group-focus-within:hidden"
                  style={{ 
                    display: 'block',
                    maxHeight: '56px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: testCase.name.length > 40 ? 'normal' : 'nowrap',
                    wordBreak: 'break-word'
                  }}
                  onClick={(e) => {
                    const textarea = e.currentTarget.nextElementSibling as HTMLTextAreaElement;
                    textarea?.focus();
                  }}
                  title={testCase.name}
                >
                  {testCase.name || 'Test Case Name'}
                </div>
                {/* Edit mode - full textarea */}
                <Textarea
                  value={testCase.name}
                  onChange={(e) => setTestCase(prev => ({ ...prev, name: e.target.value }))}
                  className="text-lg font-semibold border-none p-0 min-h-[28px] max-h-[84px] bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground resize-none overflow-y-auto leading-7 opacity-0 absolute pointer-events-none focus:opacity-100 focus:relative focus:pointer-events-auto"
                  placeholder="Test Case Name"
                  rows={1}
                  onFocus={(e) => {
                    e.currentTarget.style.opacity = '1';
                    e.currentTarget.style.position = 'relative';
                    e.currentTarget.style.pointerEvents = 'auto';
                    const display = e.currentTarget.previousElementSibling as HTMLElement;
                    if (display) display.style.display = 'none';
                    // Auto-resize
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = Math.min(e.currentTarget.scrollHeight, 84) + 'px';
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.opacity = '0';
                    e.currentTarget.style.position = 'absolute';
                    e.currentTarget.style.pointerEvents = 'none';
                    const display = e.currentTarget.previousElementSibling as HTMLElement;
                    if (display) display.style.display = 'block';
                  }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = Math.min(target.scrollHeight, 84) + 'px';
                  }}
                />
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{testCase.steps.length} steps</span>
                  <span>•</span>
                  <span>v{testCase.metadata.version}</span>
                  {testCase.priority && (
                    <>
                      <span>•</span>
                      <span className={cn(
                        testCase.priority === 'critical' && 'text-red-400',
                        testCase.priority === 'high' && 'text-orange-400',
                        testCase.priority === 'medium' && 'text-yellow-400',
                        testCase.priority === 'low' && 'text-green-400',
                      )}>{testCase.priority}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Center: Test Type Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-blue-500/50 dark:border-amber-500/50 text-blue-600 dark:text-amber-400 px-3 py-1">
                <FileText className="h-3 w-3 mr-1" />
                Visual Test Builder
              </Badge>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Settings */}
              <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} className="border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                <Settings className="h-4 w-4" />
              </Button>

              {/* Export Dropdown - Formats Only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-border text-muted-foreground hover:bg-accent hover:text-foreground">
                    <Download className="h-4 w-4 mr-1.5 text-primary" />
                    Export
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-white dark:bg-gray-900 border-gray-700 min-w-[200px]">
                  <DropdownMenuLabel className="text-amber-400">Export Formats</DropdownMenuLabel>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('istqb');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <FileText className="h-4 w-4 mr-2 text-blue-400" />
                    ISTQB Format
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('gherkin');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <Code className="h-4 w-4 mr-2 text-green-400" />
                    Gherkin/BDD Format
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => {
                      setSelectedFormat('markdown');
                      setShowFormatDialog(true);
                    }}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <FileText className="h-4 w-4 mr-2 text-purple-400" />
                    Markdown Format
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-gray-700" />
                  <DropdownMenuItem 
                    onClick={() => handleExport('automation')}
                    className="hover:bg-accent text-foreground focus:bg-accent"
                  >
                    <Play className="h-4 w-4 mr-2 text-amber-400" />
                    Playwright Script
                  </DropdownMenuItem>
                  
                  {/* Electron-specific options */}
                  {isElectron() && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs text-amber-400/70">Desktop Export</DropdownMenuLabel>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const api = (window as any).electronAPI;
                            const result = await api?.localStorage?.exportToFile();
                            if (result?.success) {
                              toast.success(`Exported to ${result.filePath}`);
                            } else if (!result?.canceled) {
                              toast.error('Export failed');
                            }
                          } catch (e) {
                            toast.error('Export failed');
                          }
                        }}
                        className="hover:bg-accent text-foreground focus:bg-accent"
                      >
                        <Save className="h-4 w-4 mr-2 text-green-400" />
                        Export All to File
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={async () => {
                          try {
                            const api = (window as any).electronAPI;
                            const result = await api?.localStorage?.importFromFile();
                            if (result?.success) {
                              toast.success('Imported successfully');
                              window.location.reload();
                            } else if (!result?.canceled) {
                              toast.error(result?.error || 'Import failed');
                            }
                          } catch (e) {
                            toast.error('Import failed');
                          }
                        }}
                        className="hover:bg-accent text-foreground focus:bg-accent"
                      >
                        <FileDown className="h-4 w-4 mr-2 text-blue-400" />
                        Import from File
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Save Button - Primary action */}
              <Button 
                size="sm" 
                variant="outline"
                onClick={saveTestCase}
                className="border-blue-500/50 dark:border-amber-500/50 text-blue-600 dark:text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 px-4"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {savedTestCaseId ? 'Save' : 'Save New'}
              </Button>
              
              {/* Environment Selector (next to Run) */}
              {environments.length > 0 && (
                <Select value={selectedEnvironmentId || '__none__'} onValueChange={(v) => setSelectedEnvironmentId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs border-gray-300 dark:border-gray-600">
                    <Globe className="h-3.5 w-3.5 mr-1 text-muted-foreground shrink-0" />
                    <SelectValue placeholder="No Env" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No Environment</SelectItem>
                    {environments.map(env => (
                      <SelectItem key={env.id} value={env.id}>
                        {env.name} {env.is_default ? '⭐' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Automated Run Button with Options */}
              <div className="flex items-center">
                <Button
                  size="sm"
                  onClick={runTest}
                  disabled={isRunning || testCase.steps.length === 0}
                  className="bg-green-600 hover:bg-green-500 text-white font-medium shadow-lg shadow-green-600/40 disabled:opacity-40 px-4 rounded-r-none border-r border-green-700"
                >
                  {isRunning ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-1.5 animate-spin" />
                      <span>Running...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-1.5" />
                      <span>Run Test</span>
                    </>
                  )}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      size="sm" 
                      disabled={isRunning}
                      className="bg-green-600 hover:bg-green-500 text-white rounded-l-none px-2"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Run Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setKeepBrowserOpenOnFailure(!keepBrowserOpenOnFailure)}
                      className="flex items-center gap-2"
                    >
                      {keepBrowserOpenOnFailure ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="flex flex-col">
                        <span className="text-sm">Keep Browser Open on Failure</span>
                        <span className="text-xs text-muted-foreground">
                          Allows fixing failed steps with the repair wizard
                        </span>
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel: Compact & Focused */}
          <aside className="w-48 flex-none border-r border-border bg-card overflow-y-auto">
            <div className="p-2 space-y-2">
              {/* Test Info - Shows test name and step count */}
              <div className="p-2 border border-border rounded-md bg-secondary/50">
                <div className="flex items-center gap-2 mb-1">
                  <TestTube className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-[11px] font-medium text-foreground truncate">{testCase.name || 'Traced Test'}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {testCase.steps.length} step{testCase.steps.length !== 1 ? 's' : ''} • {testCase.steps.filter(s => s.type.startsWith('assert')).length} verifications
                </div>
              </div>

              {/* Step Palette - Clean, organized categories */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider px-1">Add Steps</p>
                
                {Object.entries(STEP_CATEGORIES).map(([key, category]) => {
                  const cat = category as any;
                  const isExpanded = expandedCategories.includes(key);
                  const CategoryIcon = cat.icon;
                  
                  // Color mapping for category headers - organized by test flow
                  const colorMap: Record<string, string> = {
                    // Core Actions
                    blue: 'border-blue-500/30 hover:border-blue-500/50 text-blue-500 dark:text-blue-400',
                    green: 'border-green-500/30 hover:border-green-500/50 text-green-500 dark:text-green-400',
                    cyan: 'border-cyan-500/30 hover:border-cyan-500/50 text-cyan-500 dark:text-cyan-400',
                    // Data & Logic
                    violet: 'border-violet-500/30 hover:border-violet-500/50 text-violet-500 dark:text-violet-400',
                    purple: 'border-purple-500/30 hover:border-purple-500/50 text-purple-500 dark:text-purple-400',
                    // Advanced
                    orange: 'border-orange-500/30 hover:border-orange-500/50 text-orange-500 dark:text-orange-400',
                    teal: 'border-teal-500/30 hover:border-teal-500/50 text-teal-500 dark:text-teal-400',
                    // Documentation
                    rose: 'border-rose-500/30 hover:border-rose-500/50 text-rose-500 dark:text-rose-400',
                    // Plugins
                    sky: 'border-sky-500/30 hover:border-sky-500/50 text-sky-500 dark:text-sky-400',
                  };
                  const headerColor = colorMap[cat.color] || 'border-border text-foreground';
                  
                  // Skip Salesforce if not a plugin user (can be enhanced with actual license check)
                  if (cat.plugin === 'salesforce' && !true) return null; // TODO: Check actual plugin license
                  
                  return (
                    <Collapsible
                      key={key}
                      open={isExpanded}
                      onOpenChange={(open) => {
                        setExpandedCategories(prev =>
                          open ? [...prev, key] : prev.filter(k => k !== key)
                        );
                      }}
                    >
                      <CollapsibleTrigger asChild>
                        <button 
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md border bg-card transition-all ${headerColor}`}
                        >
                          <CategoryIcon className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-medium flex-1 text-left">{cat.label}</span>
                          <ChevronRight className={`h-3 w-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-1.5">
                        <div className="space-y-0.5">
                          {cat.steps.map((step: any) => (
                            <button
                              key={step.type}
                              onClick={() => addStep(step.type as StepType)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded text-left hover:bg-accent transition-colors group"
                              title={step.desc}
                            >
                              <div className={`p-1 rounded ${step.color} text-white group-hover:scale-105 transition-transform flex-shrink-0`}>
                                <step.icon className="h-3 w-3" />
                              </div>
                              <span className="text-[11px] text-foreground">{step.label}</span>
                            </button>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>

              {/* Execution Status Indicator (full results shown in bottom panel) */}
              {executionResult.status !== 'idle' && (
                <div className={`mt-4 p-2 rounded-lg border text-center ${
                  executionResult.status === 'passed' ? 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/30' :
                  executionResult.status === 'failed' ? 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/30' :
                  'bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/30'
                }`}>
                  <div className="flex items-center justify-center gap-1.5">
                    {executionResult.status === 'running' && <RefreshCw className="h-3.5 w-3.5 animate-spin text-blue-600 dark:text-blue-400" />}
                    {executionResult.status === 'passed' && <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />}
                    {executionResult.status === 'failed' && <AlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
                    <span className={`text-xs font-medium ${
                      executionResult.status === 'passed' ? 'text-green-700 dark:text-green-400' :
                      executionResult.status === 'failed' ? 'text-red-700 dark:text-red-400' :
                      'text-blue-700 dark:text-blue-400'
                    }`}>
                      {executionResult.status === 'running' ? 'Running...' :
                       executionResult.status === 'passed' ? 'Passed' : 'Failed'}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">See results below ↓</div>
                </div>
              )}

              {/* Test Run History */}
              {testHistory.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center justify-between">
                    <span>Recent Runs</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-5 text-xs px-1"
                      onClick={() => setTestHistory([])}
                    >
                      Clear
                    </Button>
                  </div>
                  <div className="space-y-1 max-h-40 overflow-auto">
                    {testHistory.slice(0, 5).map((run) => (
                      <div 
                        key={run.id} 
                        className={`p-2 rounded text-xs border ${
                          run.status === 'passed' 
                            ? 'bg-green-50 border-green-200' 
                            : 'bg-red-50 border-red-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            {run.status === 'passed' 
                              ? <CheckCircle className="h-3 w-3 text-green-600" />
                              : <AlertCircle className="h-3 w-3 text-red-600" />
                            }
                            <span className="font-medium truncate max-w-[100px]">
                              {run.testName?.slice(0, 15) || 'Test'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(run.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                        {run.status === 'failed' && run.failedStep && (
                          <div className="text-[10px] text-red-600 mt-1 truncate">
                            Step {run.failedStep}: {run.errorMessage?.slice(0, 30) || 'Error'}...
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* Center: Steps List or Code View */}
          <main className="flex-1 overflow-hidden flex flex-col">
            {viewMode === 'no-code' ? (
              <div className="flex-1 overflow-y-auto p-4">
                {testCase.steps.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                    <div className="p-4 rounded-full bg-muted mb-4">
                      <Layers className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-medium mb-1">Start building your test</h3>
                    <p className="text-sm mb-4">Add steps from the left panel or record from browser</p>
                    <div className="flex gap-2">
                      <Button onClick={() => addStep('navigate')} variant="outline">
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                      <Button onClick={() => navigate('/playwright-recorder')} className="gradient-primary text-white">
                        <Video className="h-4 w-4 mr-1" />
                        Record
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 max-w-3xl mx-auto">
                    {/* Preconditions Section */}
                    {(testCase.preconditions?.length > 0 || true) && (
                      <div className="border rounded-lg p-3 bg-amber-50/50 dark:bg-amber-950/20">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <FolderPlus className="h-4 w-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                              Preconditions (Run First)
                            </span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              loadAvailableTestCases();
                              setShowImportDialog(true);
                            }}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Import Test Case
                          </Button>
                        </div>
                        
                        {testCase.preconditions?.length > 0 ? (
                          <div className="space-y-1">
                            {testCase.preconditions.map((precond, idx) => (
                              <div 
                                key={precond.testCaseId} 
                                className={`flex items-center justify-between p-2 rounded-md ${
                                  precond.enabled ? 'bg-white dark:bg-gray-100 dark:bg-gray-800' : 'bg-gray-100 dark:bg-white dark:bg-gray-900 opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                                  <input
                                    type="checkbox"
                                    checked={precond.enabled}
                                    onChange={() => togglePrecondition(precond.testCaseId)}
                                    className="h-4 w-4"
                                  />
                                  <span className={`text-sm ${!precond.enabled && 'line-through text-muted-foreground'}`}>
                                    {precond.testCaseName}
                                  </span>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => removePrecondition(precond.testCaseId)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            No preconditions. Import existing test cases to run before this test.
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Test Steps - Drag and Drop enabled */}
                    <div className="space-y-2">
                      {testCase.steps.map((step, index) => (
                        <StepCard
                          key={step.id}
                          step={step}
                          index={index}
                          isSelected={selectedStepId === step.id}
                          onSelect={() => setSelectedStepId(step.id)}
                          onUpdate={(updates) => updateStep(step.id, updates)}
                          onDelete={() => deleteStep(step.id)}
                          onMove={(dir) => moveStep(step.id, dir)}
                          onDuplicate={() => duplicateStep(step.id)}
                          onDragStart={() => handleDragStart(index)}
                          onDragOver={(e) => handleDragOver(e, index)}
                          onDragEnd={handleDragEnd}
                          isDragging={draggedIndex === index}
                          isFirst={index === 0}
                          isLast={index === testCase.steps.length - 1}
                          executionStatus={executionResult.results.find(r => r.stepId === step.id)?.status}
                          onRecordStep={handleRecordStep}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Code View */
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="flex-none px-4 py-2 border-b bg-muted/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(['automation', 'api', 'database', 'performance', 'manual'] as ExportMode[]).map(mode => (
                      <Button
                        key={mode}
                        variant={exportMode === mode ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setExportMode(mode)}
                        className={exportMode === mode ? 'bg-primary text-white' : ''}
                      >
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generateCode(exportMode));
                      toast.success('Copied to clipboard');
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copy
                  </Button>
                </div>
                <div className="flex-1 overflow-auto">
                  <pre className="p-4 text-sm font-mono bg-slate-900 text-slate-100 min-h-full whitespace-pre-wrap">
                    {generateCode(exportMode)}
                  </pre>
                </div>
              </div>
            )}

            {/* Test Results Panel - Full-width at bottom of main content */}
            <TestResultsPanel
              executionResult={executionResult}
              steps={testCase.steps}
              isRunning={isRunning}
              browserKeptOpen={browserKeptOpen}
              onFixStep={(idx) => openRepairWizard(idx)}
              onRerecordStep={(idx) => openQuickRerecord(idx)}
              onSkipAndContinue={() => handleResumeFromHere({ skipFailedStep: true })}
              onClose={() => setExecutionResult({ status: 'idle', currentStep: 0, results: [], logs: [] })}
            />
          </main>

          {/* Right Panel: Step Editor OR Protocol Panel */}
          {viewMode === 'no-code' && (selectedStep || protocolData || rightPanelMode === 'protocol') && (
            <aside className="w-80 flex-none border-l bg-card flex flex-col max-h-full overflow-hidden">
              {/* Panel Tabs */}
              <div className="p-2 border-b bg-muted/30">
                <div className="flex gap-1">
                  <Button
                    variant={rightPanelMode === 'step' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs flex-1"
                    onClick={() => setRightPanelMode('step')}
                  >
                    <Settings className="h-3 w-3 mr-1" />
                    Step
                  </Button>
                  <Button
                    variant={rightPanelMode === 'protocol' ? 'default' : 'ghost'}
                    size="sm"
                    className="h-7 text-xs flex-1 relative"
                    onClick={() => setRightPanelMode('protocol')}
                  >
                    <Activity className="h-3 w-3 mr-1" />
                    Protocol
                    {protocolData && protocolData.requests.length > 0 && (
                      <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                        {protocolData.requests.length}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>
              
              {/* Panel Content */}
              {rightPanelMode === 'step' && selectedStep ? (
                <StepEditor
                  step={selectedStep}
                  onUpdate={(updates) => updateStep(selectedStep.id, updates)}
                  onClose={() => setSelectedStepId(null)}
                  onShowBlackbox={() => setShowBlackbox(true)}
                  allSteps={testCase.steps}
                  domain={selectedDomain}
                  coveredValidations={coveredValidations}
                  onToggleValidation={(validationId) => {
                    setCoveredValidations(prev => 
                      prev.includes(validationId) 
                        ? prev.filter(id => id !== validationId)
                        : [...prev, validationId]
                    );
                  }}
                  activeTab={rightPanelTab}
                  onTabChange={setRightPanelTab}
                />
              ) : rightPanelMode === 'step' ? (
                <div className="flex-1 flex items-center justify-center p-4 text-center">
                  <div className="space-y-2">
                    <MousePointer className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Select a step to edit</p>
                  </div>
                </div>
              ) : (
                /* Protocol Panel */
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {/* Protocol Header with Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-violet-500" />
                      <span className="text-xs font-medium">Protocol Data</span>
                    </div>
                    {protocolData && protocolData.requests.length > 0 && (
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            const har = {
                              log: {
                                version: '1.2',
                                creator: { name: 'QAAI Builder', version: '1.0' },
                                entries: protocolData.requests.map(r => ({
                                  startedDateTime: new Date().toISOString(),
                                  time: r.duration,
                                  request: {
                                    method: r.method,
                                    url: r.url,
                                    httpVersion: 'HTTP/1.1',
                                    headers: Object.entries(r.requestHeaders || {}).map(([name, value]) => ({ name, value })),
                                  },
                                  response: {
                                    status: r.statusCode,
                                    statusText: '',
                                    headers: Object.entries(r.responseHeaders || {}).map(([name, value]) => ({ name, value })),
                                  },
                                  timings: r.timing || {},
                                })),
                              },
                            };
                            const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${testCase.name.replace(/\s+/g, '_')}_protocol.har`;
                            a.click();
                            URL.revokeObjectURL(url);
                            toast.success('HAR file exported!');
                          }}
                        >
                          <FileJson className="h-3 w-3 mr-1" />
                          HAR
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="h-6 text-[10px] px-2 bg-violet-600 hover:bg-violet-700"
                          onClick={() => {
                            // Navigate to load test page with protocol data
                            localStorage.setItem('qaai_load_test_protocol', JSON.stringify(protocolData));
                            navigate('/load-testing?hasProtocolData=true&source=builder');
                          }}
                        >
                          <Gauge className="h-3 w-3 mr-1" />
                          Load Test
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Protocol Content */}
                  {!protocolData || protocolData.requests.length === 0 ? (
                    <div className="text-center py-6 space-y-3">
                      <div className="w-12 h-12 mx-auto rounded-full bg-violet-100 flex items-center justify-center">
                        <Activity className="h-6 w-6 text-violet-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">No Protocol Data</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Enable "Protocol Capture" in recorder or import HAR
                        </p>
                      </div>
                      
                      {/* Import HAR Button */}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = '.har,.json';
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (file) {
                              try {
                                const text = await file.text();
                                const harData = JSON.parse(text);
                                const entries = harData?.log?.entries || [];
                                
                                if (entries.length > 0) {
                                  const requests = entries.map((entry: any, idx: number) => ({
                                    requestId: `har_${idx}`,
                                    url: entry.request?.url || '',
                                    method: entry.request?.method || 'GET',
                                    statusCode: entry.response?.status || 0,
                                    duration: entry.time || 0,
                                    type: 'fetch',
                                    requestHeaders: (entry.request?.headers || []).reduce((acc: any, h: any) => {
                                      acc[h.name] = h.value;
                                      return acc;
                                    }, {}),
                                    responseHeaders: (entry.response?.headers || []).reduce((acc: any, h: any) => {
                                      acc[h.name] = h.value;
                                      return acc;
                                    }, {}),
                                    timing: entry.timings || {},
                                  }));
                                  
                                  setProtocolData({
                                    requests,
                                    correlations: [],
                                    statistics: {
                                      totalRequests: requests.length,
                                      successfulRequests: requests.filter((r: any) => r.statusCode >= 200 && r.statusCode < 400).length,
                                      failedRequests: requests.filter((r: any) => r.statusCode >= 400).length,
                                      avgDuration: Math.round(requests.reduce((sum: number, r: any) => sum + (r.duration || 0), 0) / requests.length),
                                      p95Duration: 0,
                                    },
                                    linkedActions: [],
                                  });
                                  
                                  toast.success(`Imported ${requests.length} HTTP requests!`);
                                } else {
                                  toast.error('No requests found in HAR file');
                                }
                              } catch (err) {
                                toast.error('Invalid HAR file format');
                              }
                            }
                          };
                          input.click();
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Import HAR File
                      </Button>
                      
                      <div className="bg-violet-50 rounded-lg p-3 text-left">
                        <p className="text-xs font-medium text-violet-700 mb-2">
                          🎯 Protocol Recording Features
                        </p>
                        <ul className="text-xs text-violet-600 space-y-1">
                          <li>• No proxy setup needed</li>
                          <li>• Auto-detects tokens & session IDs</li>
                          <li>• Links UI actions to API calls</li>
                          <li>• Export to HAR, k6, JMeter</li>
                        </ul>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Statistics Summary */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-green-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-green-600">
                            {protocolData.statistics?.totalRequests || protocolData.requests.length}
                          </div>
                          <div className="text-[10px] text-green-700">Requests</div>
                        </div>
                        <div className="bg-blue-50 rounded-lg p-2 text-center">
                          <div className="text-lg font-bold text-blue-600">
                            {protocolData.statistics?.avgDuration || 0}ms
                          </div>
                          <div className="text-[10px] text-blue-700">Avg Time</div>
                        </div>
                      </div>

                      {/* Correlations Detected */}
                      {protocolData.correlations && protocolData.correlations.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                          <div className="flex items-center gap-1 mb-1">
                            <Key className="h-3 w-3 text-amber-600" />
                            <span className="text-[10px] font-medium text-amber-700">
                              Auto-Detected ({protocolData.correlations.length})
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {protocolData.correlations.slice(0, 5).map((corr, idx) => (
                              <Badge key={idx} variant="outline" className="text-[9px] bg-white">
                                {corr.name}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Request List */}
                      <div className="space-y-1">
                        <span className="text-xs font-medium">HTTP Requests</span>
                        <div className="space-y-1 max-h-[300px] overflow-y-auto">
                          {protocolData.requests.slice(0, 50).map((req, idx) => (
                            <div 
                              key={req.requestId || idx}
                              className="p-2 rounded border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                              onClick={() => {
                                // Show request details (could open a modal)
                                toast.info(`${req.method} ${new URL(req.url).pathname}\nStatus: ${req.statusCode}\nDuration: ${req.duration}ms`);
                              }}
                            >
                              <div className="flex items-center gap-2">
                                <Badge 
                                  variant="outline" 
                                  className={`text-[9px] font-mono ${
                                    req.method === 'GET' ? 'text-green-600 border-green-300' :
                                    req.method === 'POST' ? 'text-blue-600 border-blue-300' :
                                    req.method === 'PUT' ? 'text-amber-600 border-amber-300' :
                                    req.method === 'DELETE' ? 'text-red-600 border-red-300' :
                                    'text-gray-600 border-gray-300'
                                  }`}
                                >
                                  {req.method}
                                </Badge>
                                <span className="text-[10px] truncate flex-1 font-mono">
                                  {(() => {
                                    try {
                                      return new URL(req.url).pathname;
                                    } catch {
                                      return req.url;
                                    }
                                  })()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground">
                                <span className={req.statusCode >= 400 ? 'text-red-500' : 'text-green-500'}>
                                  {req.statusCode}
                                </span>
                                <span>•</span>
                                <span className="flex items-center gap-0.5">
                                  <Timer className="h-2.5 w-2.5" />
                                  {req.duration}ms
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {protocolData.requests.length > 50 && (
                          <p className="text-[10px] text-muted-foreground text-center">
                            +{protocolData.requests.length - 50} more requests
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>

        {/* Modules Dialog */}
        <Dialog open={showModules} onOpenChange={setShowModules}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Reusable Modules</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <ReusableModulesManager
                currentNodes={testCase.steps.map(s => ({ ...s, data: s }))}
                appType="generic"
                onImportModule={handleImportModule}
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Blackbox Strategies Dialog */}
        <Dialog open={showBlackbox} onOpenChange={setShowBlackbox}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Fallback Locator Strategy</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              <BlackboxLocatorStrategies
                onLocatorSelected={handleBlackboxLocator}
                framework="playwright-python"
              />
            </div>
          </DialogContent>
        </Dialog>

        {/* Domain Selector Dialog */}
        <Dialog open={showDomainSelector} onOpenChange={setShowDomainSelector}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-violet-500" />
                Select Application Domain
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-4">
              Choose your application type to get relevant validation suggestions and track test coverage.
            </p>
            <div className="grid grid-cols-3 gap-3">
              {(Object.entries(DOMAINS) as [DomainType, typeof DOMAINS[DomainType]][]).map(([key, domain]) => (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedDomain(key);
                    setShowDomainSelector(false);
                    toast.success(`Domain set to ${domain.label}`);
                  }}
                  className={`p-3 rounded-lg border text-left transition-all hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/30 ${
                    selectedDomain === key 
                      ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-2 ring-violet-500/20' 
                      : ''
                  }`}
                >
                  <div className="text-2xl mb-1">{domain.icon}</div>
                  <div className="font-medium text-sm">{domain.label}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{domain.description}</div>
                </button>
              ))}
            </div>
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground">
                <strong>Current:</strong> {DOMAINS[selectedDomain]?.icon} {DOMAINS[selectedDomain]?.label}
                <br />
                <strong>Categories:</strong> {DOMAINS[selectedDomain]?.categories.slice(0, 3).join(', ')}
                {DOMAINS[selectedDomain]?.categories.length > 3 && ` +${DOMAINS[selectedDomain].categories.length - 3} more`}
              </p>
            </div>
          </DialogContent>
        </Dialog>

        {/* Validation Coverage Panel Dialog */}
        <Dialog open={showValidationPanel} onOpenChange={setShowValidationPanel}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-violet-500" />
                Validation Coverage Details
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {(() => {
                const coverage = calculateCoverage(coveredValidations, selectedDomain);
                const domainValidations = getValidationsByDomain(selectedDomain);
                const grouped = groupValidations(domainValidations);
                
                return (
                  <div className="space-y-4">
                    {/* Summary */}
                    <div className="p-4 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">Overall Coverage</span>
                        <span className={`text-lg font-bold ${
                          coverage.percentage >= 80 ? 'text-green-600' :
                          coverage.percentage >= 50 ? 'text-amber-600' : 'text-red-600'
                        }`}>
                          {coverage.percentage}%
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            coverage.percentage >= 80 ? 'bg-green-500' :
                            coverage.percentage >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${coverage.percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{coverage.covered} covered</span>
                        <span>{coverage.total - coverage.covered} remaining</span>
                      </div>
                    </div>
                    
                    {/* Missing High Priority */}
                    {coverage.missingHigh.length > 0 && (
                      <div className="border border-red-200 bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
                        <h4 className="font-medium text-red-700 dark:text-red-400 text-sm mb-2 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          High Priority Gaps ({coverage.missingHigh.length})
                        </h4>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                          {coverage.missingHigh.slice(0, 10).map(v => (
                            <div 
                              key={v.id}
                              className="p-2 bg-white dark:bg-white dark:bg-gray-900 rounded text-xs cursor-pointer hover:ring-2 ring-red-300"
                              onClick={() => {
                                setCoveredValidations(prev => [...prev, v.id]);
                              }}
                            >
                              <div className="font-medium">{v.validationLogic}</div>
                              <div className="text-muted-foreground">{v.testScenario}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* All Categories */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-sm">All Validations by Category</h4>
                      {Object.entries(grouped).map(([category, subcats]) => {
                        const categoryValidations = Object.values(subcats).flat();
                        const categoryCovered = categoryValidations.filter(v => coveredValidations.includes(v.id)).length;
                        const categoryTotal = categoryValidations.length;
                        
                        return (
                          <Collapsible key={category}>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" className="w-full justify-between h-auto py-2">
                                <div className="flex items-center gap-2">
                                  <span>{CATEGORIES[category]?.icon}</span>
                                  <span className="text-sm">{category}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {categoryCovered}/{categoryTotal}
                                  </span>
                                  <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                    <div 
                                      className="h-full bg-violet-500"
                                      style={{ width: `${categoryTotal > 0 ? (categoryCovered / categoryTotal) * 100 : 0}%` }}
                                    />
                                  </div>
                                  <ChevronRight className="h-4 w-4" />
                                </div>
                              </Button>
                            </CollapsibleTrigger>
                            <CollapsibleContent className="pl-6 space-y-1">
                              {categoryValidations.map(v => {
                                const isCovered = coveredValidations.includes(v.id);
                                return (
                                  <div 
                                    key={v.id}
                                    className={`flex items-center gap-2 p-2 rounded text-xs cursor-pointer ${
                                      isCovered ? 'bg-green-50 dark:bg-green-950/20' : 'hover:bg-muted'
                                    }`}
                                    onClick={() => {
                                      setCoveredValidations(prev => 
                                        isCovered 
                                          ? prev.filter(id => id !== v.id)
                                          : [...prev, v.id]
                                      );
                                    }}
                                  >
                                    <div className={`h-4 w-4 rounded border flex items-center justify-center ${
                                      isCovered ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                    }`}>
                                      {isCovered && <CheckCircle className="h-3 w-3 text-white" />}
                                    </div>
                                    <span className="flex-1">{v.validationLogic}</span>
                                    <Badge className={`h-4 px-1 text-[9px] ${getPriorityColor(v.priority)}`}>
                                      {v.priority}
                                    </Badge>
                                  </div>
                                );
                              })}
                            </CollapsibleContent>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </DialogContent>
        </Dialog>

        {/* Settings Dialog — Tabbed: General + Environments */}
        <Dialog open={showSettings} onOpenChange={setShowSettings}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Test Settings</DialogTitle>
            </DialogHeader>
            <TabsPrimitive defaultValue="general" className="w-full">
              <TabsListPrimitive className="grid w-full grid-cols-2 mb-4">
                <TabsTriggerPrimitive value="general">General</TabsTriggerPrimitive>
                <TabsTriggerPrimitive value="environments">
                  Environments {environments.length > 0 && <Badge variant="secondary" className="ml-1 text-[10px] py-0 px-1">{environments.length}</Badge>}
                </TabsTriggerPrimitive>
              </TabsListPrimitive>

              {/* General Tab */}
              <TabsContentPrimitive value="general" className="space-y-4">
                <div className="space-y-2">
                  <Label>Base URL <span className="text-xs text-muted-foreground ml-1">(used for env URL matching)</span></Label>
                  <Input
                    value={testCase.settings.baseUrl || ''}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, baseUrl: e.target.value }
                    }))}
                    placeholder="https://qa.example.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    The URL this test was recorded against. Used to detect which URLs to rewrite when switching environments.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={testCase.settings.timeout}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, timeout: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Retries</Label>
                  <Input
                    type="number"
                    value={testCase.settings.retries}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, retries: parseInt(e.target.value) }
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Step Retry Count</Label>
                  <Input
                    type="number"
                    min={0}
                    max={5}
                    value={testCase.settings.retryCount ?? 0}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, retryCount: Math.min(5, Math.max(0, parseInt(e.target.value) || 0)) }
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Number of times to retry a failed step before marking it as failed (0-5).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Retry Delay (ms)</Label>
                  <Input
                    type="number"
                    min={100}
                    max={10000}
                    step={100}
                    value={testCase.settings.retryDelay ?? 1000}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, retryDelay: Math.min(10000, Math.max(100, parseInt(e.target.value) || 1000)) }
                    }))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay in milliseconds between retry attempts.
                  </p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-medium">Continue on Failure</Label>
                    <p className="text-xs text-muted-foreground">
                      Continue executing remaining steps when a step fails instead of stopping the test.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={testCase.settings.continueOnFailure ?? false}
                    onChange={(e) => setTestCase(prev => ({
                      ...prev,
                      settings: { ...prev.settings, continueOnFailure: e.target.checked }
                    }))}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea
                    value={testCase.description}
                    onChange={(e) => setTestCase(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="What does this test verify?"
                    rows={3}
                  />
                </div>
              </TabsContentPrimitive>

              {/* Environments Tab */}
              <TabsContentPrimitive value="environments">
                <TestEnvironmentManager
                  environments={environments}
                  onEnvironmentsChange={setEnvironments}
                  projectId={searchParams.get('projectId') || 'default'}
                />
              </TabsContentPrimitive>
            </TabsPrimitive>
            <DialogFooter>
              <Button onClick={() => setShowSettings(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Save As Dialog */}
        <Dialog open={showSaveAsDialog} onOpenChange={setShowSaveAsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save As New Test Case</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Test Case Name</Label>
                <Input
                  value={saveAsName}
                  onChange={(e) => setSaveAsName(e.target.value)}
                  placeholder="Enter new test case name"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSaveAsDialog(false)}>Cancel</Button>
              <Button 
                onClick={() => saveTestCaseAs(saveAsName)}
                disabled={!saveAsName.trim()}
              >
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Import Test Case Dialog */}
        <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FolderPlus className="h-5 w-5 text-amber-500" />
                Import Test Case as Precondition
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Select test cases to run before this test. They will execute in order as setup steps.
            </p>
            <div className="flex-1 overflow-y-auto border rounded-md">
              {importLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  <RefreshCw className="h-6 w-6 mx-auto animate-spin mb-2" />
                  Loading test cases...
                </div>
              ) : availableTestCases.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No saved test cases found.</p>
                  <p className="text-xs mt-1">Save some test cases first to import them here.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {availableTestCases.map(tc => (
                    <div 
                      key={tc.id}
                      className="p-3 hover:bg-muted/50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <div className="font-medium text-sm">{tc.name}</div>
                        {tc.description && (
                          <div className="text-xs text-muted-foreground line-clamp-1">{tc.description}</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          {tc.steps || 0} steps
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          addPrecondition(tc.id, tc.name);
                        }}
                        disabled={testCase.preconditions?.some(p => p.testCaseId === tc.id)}
                      >
                        {testCase.preconditions?.some(p => p.testCaseId === tc.id) ? (
                          <>
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowImportDialog(false)}>Done</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Format View Dialog (ISTQB/Gherkin) */}
        <Dialog open={showFormatDialog} onOpenChange={setShowFormatDialog}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Test Case Documentation
              </DialogTitle>
            </DialogHeader>
            <div className="flex gap-2 mb-2">
              {(['istqb', 'gherkin', 'markdown'] as const).map(fmt => (
                <Button
                  key={fmt}
                  size="sm"
                  variant={selectedFormat === fmt ? 'default' : 'outline'}
                  onClick={() => setSelectedFormat(fmt)}
                >
                  {fmt === 'istqb' ? '📋 ISTQB' : fmt === 'gherkin' ? '🥒 Gherkin' : '📝 Markdown'}
                </Button>
              ))}
            </div>
            <div className="flex-1 overflow-auto border rounded-md p-4 bg-muted/30">
              <pre className="text-sm whitespace-pre-wrap font-mono">
                {selectedFormat === 'istqb' 
                  ? generateISTQBFormat(testCase)
                  : selectedFormat === 'gherkin'
                  ? generateGherkinFormat(testCase)
                  : generateMarkdownFormat(testCase)
                }
              </pre>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  const content = selectedFormat === 'istqb' 
                    ? generateISTQBFormat(testCase)
                    : selectedFormat === 'gherkin'
                    ? generateGherkinFormat(testCase)
                    : generateMarkdownFormat(testCase);
                  navigator.clipboard.writeText(content);
                  toast.success('Copied to clipboard!');
                }}
              >
                <Copy className="h-4 w-4 mr-1" />
                Copy
              </Button>
              <Button onClick={() => setShowFormatDialog(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* MANUAL EXECUTION OVERLAY */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        {isManualExecution && (
          <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
            {/* Header */}
            <div className="flex-none border-b bg-card px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-6 w-6 text-amber-500" />
                    <h2 className="text-xl font-bold">Manual Execution</h2>
                  </div>
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Step {manualCurrentStep + 1} of {testCase.steps.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  {/* Progress */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">
                      {Object.values(manualResults).filter(r => r.result === 'passed').length}
                    </span>
                    <span className="text-red-600 font-medium">
                      {Object.values(manualResults).filter(r => r.result === 'failed').length}
                    </span>
                    <span className="text-gray-500 font-medium">
                      ⏭️ {Object.values(manualResults).filter(r => r.result === 'skipped').length}
                    </span>
                  </div>
                  <Button variant="outline" onClick={endManualExecution}>
                    <X className="h-4 w-4 mr-1" />
                    End Execution
                  </Button>
                </div>
              </div>
              
              {/* Step Navigator */}
              <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
                {testCase.steps.map((step, idx) => {
                  const result = manualResults[step.id];
                  const isCurrent = idx === manualCurrentStep;
                  return (
                    <button
                      key={step.id}
                      onClick={() => setManualCurrentStep(idx)}
                      className={`flex-none px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        isCurrent 
                          ? 'bg-amber-500 text-white ring-2 ring-amber-300' 
                          : result?.result === 'passed' 
                          ? 'bg-green-100 text-green-700' 
                          : result?.result === 'failed' 
                          ? 'bg-red-100 text-red-700' 
                          : result?.result === 'skipped' 
                          ? 'bg-gray-100 text-gray-500' 
                          : 'bg-muted hover:bg-muted/80'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 overflow-auto p-6">
              {getCurrentManualStep() && (
                <div className="max-w-3xl mx-auto space-y-6">
                  {/* Step Title */}
                  <div className="text-center">
                    <h3 className="text-2xl font-bold text-foreground">
                      {getCurrentManualStep().name}
                    </h3>
                    {getCurrentManualStep().description && (
                      <p className="text-muted-foreground mt-1">{getCurrentManualStep().description}</p>
                    )}
                  </div>
                  
                  {/* Action Card */}
                  <Card className="border-2 border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <MousePointer className="h-5 w-5 text-amber-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
                            Action to Perform
                          </h4>
                          <p className="text-lg">
                            {getCurrentManualStep().manualAction || getCurrentManualStep().name || 
                             `${getCurrentManualStep().type}: ${getCurrentManualStep().target || getCurrentManualStep().value || ''}`}
                          </p>
                          
                          {/* Test Data */}
                          {getCurrentManualStep().value && (
                            <div className="mt-3 p-3 bg-white dark:bg-white dark:bg-gray-900 rounded border">
                              <span className="text-xs text-muted-foreground">Test Data:</span>
                              <p className="font-mono text-sm mt-1">{getCurrentManualStep().value}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Expected Result Card */}
                  <Card className="border-2 border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                            Expected Result
                          </h4>
                          <p className="text-lg">
                            {getCurrentManualStep().expectedResult || 
                             (getCurrentManualStep().assertion?.expected 
                               ? `Verify: ${getCurrentManualStep().assertion.type?.replace(/_/g, ' ')} - "${getCurrentManualStep().assertion.expected}"`
                               : 'Step should complete successfully')}
                          </p>
                          
                          {/* Assertions to verify */}
                          {getCurrentManualStep().assertion?.enabled && (
                            <div className="mt-3 p-3 bg-white dark:bg-white dark:bg-gray-900 rounded border">
                              <span className="text-xs text-muted-foreground">Verify:</span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline">{getCurrentManualStep().assertion.type}</Badge>
                                <span className="font-mono text-sm">{getCurrentManualStep().assertion.expected}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Notes Input */}
                  <div>
                    <Label className="text-sm text-muted-foreground">Notes (optional)</Label>
                    <Input 
                      placeholder="Add any observations or issues..."
                      className="mt-1"
                      id={`manual-notes-${getCurrentManualStep().id}`}
                    />
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer - Action Buttons */}
            <div className="flex-none border-t bg-card px-6 py-4">
              <div className="max-w-3xl mx-auto flex items-center justify-between">
                {/* Navigation */}
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline"
                    onClick={() => setManualCurrentStep(prev => Math.max(0, prev - 1))}
                    disabled={manualCurrentStep === 0}
                  >
                    <ArrowLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setManualCurrentStep(prev => Math.min(testCase.steps.length - 1, prev + 1))}
                    disabled={manualCurrentStep === testCase.steps.length - 1}
                  >
                    Next
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                
                {/* Result Buttons */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'skipped', notes);
                    }}
                    className="border-gray-300"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'blocked', notes);
                    }}
                    className="border-orange-300 text-orange-600 hover:bg-orange-50"
                  >
                    <Ban className="h-4 w-4 mr-1" />
                    Blocked
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'failed', notes);
                    }}
                    className="border-red-300 text-red-600 hover:bg-red-50"
                  >
                    <XCircleIcon className="h-4 w-4 mr-1" />
                    Fail
                  </Button>
                  <Button
                    onClick={() => {
                      const notes = (document.getElementById(`manual-notes-${getCurrentManualStep().id}`) as HTMLInputElement)?.value;
                      markStepResult(getCurrentManualStep().id, 'passed', notes);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-6"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    Pass
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* ELEMENT REPAIR WIZARD - Fix failed steps */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <ElementRepairWizard
          open={repairWizardOpen}
          onOpenChange={(open) => {
            setRepairWizardOpen(open);
            if (!open) {
              setRepairStepIndex(null);
            }
          }}
          action={repairStepIndex !== null ? {
            type: testCase.steps[repairStepIndex]?.type,
            qword: testCase.steps[repairStepIndex]?.type,
            text: testCase.steps[repairStepIndex]?.name,
            label: testCase.steps[repairStepIndex]?.target,
            description: testCase.steps[repairStepIndex]?.name,
            selector: testCase.steps[repairStepIndex]?.selector,
            selectorObj: testCase.steps[repairStepIndex]?.selectorObj,
            manualSelector: testCase.steps[repairStepIndex]?.manualSelector,
            manualText: testCase.steps[repairStepIndex]?.manualText,
          } : null}
          actionIndex={repairStepIndex || 0}
          onSave={handleRepairSave}
          failureState={failureState ? {
            stepIndex: failureState.stepIndex,
            step: failureState.step as any,
            error: failureState.error,
            screenshot: failureState.screenshot,
            url: failureState.url,
          } : null}
          browserKeptOpen={browserKeptOpen}
          onReopenBrowser={handleReopenBrowser}
          onRetryStep={handleRetryStep}
          onResumeFromHere={handleResumeFromHere}
          onCloseBrowser={handleCloseBrowser}
        />

        {/* ═══════════════════════════════════════════════════════════════ */}
        {/* QUICK RE-RECORD MODAL - Simple inline step re-recording */}
        {/* ═══════════════════════════════════════════════════════════════ */}
        <QuickRerecordModal
          open={quickRerecordOpen}
          onOpenChange={setQuickRerecordOpen}
          step={quickRerecordStepIndex !== null ? testCase.steps[quickRerecordStepIndex] : null}
          stepIndex={quickRerecordStepIndex || 0}
          lastKnownUrl={failureState?.url || null}
          onSave={handleQuickRerecordSave}
        />
      </div>
  );
}

