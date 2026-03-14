/**
 * useTestExecution - Test execution handlers extracted from PlaywrightRecorderPage.
 *
 * Contains: handleLockLocators, handleRunTest, handlePauseTest, handleResumeTest,
 * handleSkipPausedStep, handleRetryPausedStep, handleRunFromStep,
 * markStepAsFalsePositive, unmarkFalsePositive, handleAutoFixStep,
 * handleFalsePositiveStop, handleFalsePositiveFixed, handleStopTest,
 * toggleStepByStepMode, updatePausedStepField, handleRunSingleStep.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { normalizeStepsForPlayback } from "@/modules/recorder/lib/stepNormalization";
import { getDisplayLabel } from "@/modules/recorder/lib/displayHelpers";
import {
  saveFalsePositive as saveFalsePositiveApi,
  removeFalsePositive as removeFalsePositiveApi,
  recordStepResults as recordStepResultsApi,
  getFlakySteps as getFlakyStepsApi,
  detectFalsePositive as detectFalsePositiveApi,
  autoFixStep as autoFixStepApi,
} from "@/modules/recorder/lib/aiEnhancements";
import type { RecordedAction, TestCase } from "@/modules/recorder/types/recorder.types";

interface UseTestExecutionParams {
  actions: RecordedAction[];
  setActions: React.Dispatch<React.SetStateAction<RecordedAction[]>>;
  url: string;
  testExecutionResult: any;
  setTestExecutionResult: React.Dispatch<React.SetStateAction<any>>;
  setShowTestResultModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedTestCase: TestCase | null;
  currentTestId: string;
  isTestPaused: boolean;
  setIsTestPaused: React.Dispatch<React.SetStateAction<boolean>>;
  pausedAtStep: number | null;
  setPausedAtStep: React.Dispatch<React.SetStateAction<number | null>>;
  editingPausedStep: RecordedAction | null;
  setEditingPausedStep: React.Dispatch<React.SetStateAction<RecordedAction | null>>;
  stepByStepMode: boolean;
  setStepByStepMode: React.Dispatch<React.SetStateAction<boolean>>;
  setPauseRequested: React.Dispatch<React.SetStateAction<boolean>>;
  pauseResolverRef: React.MutableRefObject<(() => void) | null>;
  falsePositiveSteps: Map<string, { stepIndex: number; screenshot: string | null; markedAt: number; reason?: string }>;
  setFalsePositiveSteps: React.Dispatch<React.SetStateAction<Map<string, { stepIndex: number; screenshot: string | null; markedAt: number; reason?: string }>>>;
  setFlakyStepIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  autoFixingSteps: Set<number>;
  setAutoFixingSteps: React.Dispatch<React.SetStateAction<Set<number>>>;
  setAutoFixResults: React.Dispatch<React.SetStateAction<Map<number, { success: boolean; message: string }>>>;
  setManualAssistStep: React.Dispatch<React.SetStateAction<number | null>>;
  setEditingActionIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setEditSelectorModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelTab: React.Dispatch<React.SetStateAction<string>>;
  setIsDebugMode: React.Dispatch<React.SetStateAction<boolean>>;
  setShowRunMenu: React.Dispatch<React.SetStateAction<boolean>>;
  setFailureCardStepIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setFailureState: React.Dispatch<React.SetStateAction<any>>;
  setBrowserKeptOpen: React.Dispatch<React.SetStateAction<boolean>>;
  browserKeptOpen: boolean;
  setStoppedAtFalsePositive: React.Dispatch<React.SetStateAction<any>>;
  playbackSpeed: string;
  highlightElements: boolean;
  keepBrowserOpenOnFailure: boolean;
  switchToStepTabAndRefresh: (stepIndex: number) => void;
  handleRefreshSuggestions: () => void;
}

export function useTestExecution(params: UseTestExecutionParams) {
  const {
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
  } = params;

  // ============ LOCK LOCATORS - Save the ACTUAL working selector ============
  // SIMPLE APPROACH: Use the selector that actually worked during the test run.
  // The backend now returns workingSelector in stepResults for each passed step.
  const handleLockLocators = () => {
    if (!testExecutionResult || testExecutionResult.status !== 'passed') {
      toast.error('Can only lock locators after a successful test run');
      return;
    }

    // Diagnostic: Log what stepResults look like BEFORE locking
    if (import.meta.env.DEV) {
      console.log('[LockLocators] stepResults:', JSON.stringify(
        testExecutionResult.stepResults?.map((r: any) => ({
          idx: r.index, status: r.status, ws: r.workingSelector || 'NONE', st: r.strategyType || '-'
        })), null, 2
      ));
    }
    
    let lockedCount = 0;
    let skippedCount = 0;
    
    // Update each action with the ACTUAL selector that worked
    setActions(prev => {
      const updatedActions = prev.map((action, index) => {
        const stepResult = testExecutionResult.stepResults?.find((r: any) => r.index === index);
        const workingSelector = stepResult?.workingSelector;
        
        if (!workingSelector) {
          // Navigate/goto steps naturally have no element selector - don't count as "skipped"
          const actionType = (action.type || action.action || '').toLowerCase();
          const isNavStep = actionType === 'navigate' || actionType === 'goto' || actionType === 'navigation';
          if (isNavStep) {
            if (import.meta.env.DEV) console.log(`[LockLocators] Step ${index + 1}: Navigate step (no selector needed)`);
          } else {
            if (import.meta.env.DEV) console.log(`[LockLocators] Step ${index + 1}: No working selector returned, skipping`);
            skippedCount++;
          }
          return action;
        }
        
        if (import.meta.env.DEV) console.log(`[LockLocators] Step ${index + 1}: Locking actual working selector`, workingSelector);
        lockedCount++;
        
        return {
          ...action,
          selectorObj: {
            ...action.selectorObj,
            optimizedSelector: workingSelector,
            optimizedAt: new Date().toISOString(),
            optimizedSource: stepResult?.strategyType || 'unknown'
          }
        };
      });
      
      // AUTO-PERSIST: Save locked selectors to localStorage so they survive page refresh.
      // This was previously missing — locked selectors were lost on refresh.
      if (lockedCount > 0 && selectedTestCase?.id) {
        try {
          // Update the test case in localStorage with locked actions
          const tcId = selectedTestCase.id;
          const updatedSteps = updatedActions.map((action: any, idx: number) => ({
            ...((selectedTestCase as any)?.steps?.[idx] || {}),
            selectorObj: action.selectorObj,
            qword: action.qword,
            args: action.args,
          }));
          
          const updatedTC = {
            ...selectedTestCase,
            steps: updatedSteps,
            updatedAt: new Date().toISOString(),
          };
          
          // Persist to all localStorage keys used by the app
          const localCases = JSON.parse(localStorage.getItem('test_cases') || '[]');
          const cleanedLocal = localCases.filter((tc: any) => tc.id !== tcId);
          cleanedLocal.push(updatedTC);
          localStorage.setItem('test_cases', JSON.stringify(cleanedLocal));
          
          const flowstralCases = JSON.parse(localStorage.getItem('flowstral_test_cases') || '[]');
          const cleanedFlowstral = flowstralCases.filter((tc: any) => tc.id !== tcId);
          cleanedFlowstral.push(updatedTC);
          localStorage.setItem('flowstral_test_cases', JSON.stringify(cleanedFlowstral));
          
          localStorage.setItem(`unified_test_case_${tcId}`, JSON.stringify(updatedTC));
          
          if (import.meta.env.DEV) console.log(`[LockLocators] Auto-saved ${lockedCount} locked selectors to localStorage`);
        } catch (e) {
          console.warn('[LockLocators] Auto-save failed (non-critical):', e);
        }
      }
      
      return updatedActions;
    });
    
    if (lockedCount > 0) {
      const message = skippedCount > 0
        ? `Locked ${lockedCount} selectors (${skippedCount} could not be locked). Auto-saved.`
        : `Locked all ${lockedCount} selectors! Re-runs will be faster. Auto-saved.`;
      toast.success(message, { duration: 4000, icon: '⚡' });
    } else {
      toast.warning('No working selectors to lock. Try running the test again.', { duration: 4000 });
    }
  };

  const handleRunTest = async (debugMode: boolean = false, freshBrowser: boolean = false) => {
    if (actions.length === 0) {
      toast.error("No steps to run");
      return;
    }
    
    // ═══ CLEAN EXECUTION STATE: Reset all debug/pause/failure state from previous runs ═══
    setIsDebugMode(debugMode);
    setShowRunMenu(false);
    setIsTestPaused(false);
    setPausedAtStep(null);

    // If debug mode, start paused at first step for step-by-step execution
    if (debugMode) {
      setStepByStepMode(true);
      toast.info('🐛 Debug mode: Step-by-step execution enabled', { duration: 2000 });
    }
    
    // If fresh browser mode, show toast
    if (freshBrowser) {
      toast.info('🧹 Fresh browser mode: Clean state, no cookies/storage', { duration: 2000 });
    }
    
    // ROBUST PLAYBACK: Normalize all steps before execution
    // This handles dynamic content like badge numbers, emojis, and creates fallback selectors
    const normalizedActions = normalizeStepsForPlayback(actions);
    if (import.meta.env.DEV) console.log('[Test] Normalized steps for robust playback:', normalizedActions.length);
    
    const flowstral = (window as any).flowstral;
    const electronAPI = (window as any).electronAPI;
    
    // Show modal with running state
    setFailureCardStepIndex(null); // Reset step browsing for new run
    setTestExecutionResult({
      status: 'running',
      currentStep: 0,
      stepResults: [],
      totalSteps: actions.length
    });
    setShowTestResultModal(true);
    
    // Real-time progress tracking via IPC events
    const eventCleanups: (() => void)[] = [];
    
    // Listen for step start events
    if (flowstral?.on) {
      const unsubStepStart = flowstral.on('playwright-test-step-start', (data: { stepIndex: number; step: any }) => {
        if (import.meta.env.DEV) console.log('[Test] Step start:', data.stepIndex);
        setTestExecutionResult(prev => {
          if (!prev || prev.status !== 'running') return prev;
          return { ...prev, currentStep: data.stepIndex };
        });
      });
      eventCleanups.push(unsubStepStart);
      
      // Listen for step complete events
      const unsubStepComplete = flowstral.on('playwright-test-step-complete', (data: { stepIndex: number; success: boolean; error?: string; screenshot?: string; workingSelector?: string; strategyType?: string; healed?: boolean; skipped?: boolean; newSelector?: string; aiResolved?: string | false; aiDetails?: any }) => {
        const isHealed = data.healed || false;
        const isSkipped = data.skipped || false;
        if (import.meta.env.DEV) console.log('[Test] Step complete:', data.stepIndex, data.success ? 'pass' : 'fail', isHealed ? '[HEALED]' : '', isSkipped ? '[SKIPPED]' : '', data.aiResolved ? `[AI: ${data.aiResolved}]` : '');

        setTestExecutionResult(prev => {
          if (!prev) return prev;
          const newResults = [...prev.stepResults];
          newResults[data.stepIndex] = {
            index: data.stepIndex,
            status: data.success ? (isHealed ? 'healed' : isSkipped ? 'skipped' : 'passed') : 'failed',
            error: data.error,
            screenshot: data.screenshot,
            workingSelector: data.workingSelector,
            strategyType: data.strategyType,
            aiResolved: data.aiResolved || false,
            aiDetails: data.aiDetails || null,
            healed: isHealed,
            skipped: isSkipped,
          };
          return {
            ...prev,
            // On success (including healed/skipped): advance currentStep
            // On failure: keep currentStep on the failed step
            currentStep: data.success ? data.stepIndex + 1 : data.stepIndex,
            stepResults: newResults
          };
        });

        // =========== AUTO-HEAL LOCKED SELECTORS ===========
        // If a locked selector failed but SmartFinder found the element,
        // auto-update the step's optimizedSelector with the new working one
        if (data.success && data.healed && data.workingSelector) {
          if (import.meta.env.DEV) console.log(`[Test] Auto-healing step ${data.stepIndex + 1}:`, data.workingSelector);
          setActions(prev => prev.map((action, idx) => {
            if (idx === data.stepIndex) {
              return {
                ...action,
                selectorObj: {
                  ...action.selectorObj,
                  optimizedSelector: data.newSelector || data.workingSelector,
                  optimizedAt: new Date().toISOString(),
                  optimizedSource: 'auto-healed'
                }
              };
            }
            return action;
          }));
          toast.success(`Step ${data.stepIndex + 1} auto-healed`, { duration: 2000 });
        }

        // Notify on auto-skipped steps
        if (data.success && isSkipped) {
          if (import.meta.env.DEV) console.log(`[Test] Step ${data.stepIndex + 1} auto-skipped (non-critical)`);
        }

        // =========== SMART SUGGESTIONS ON TRUE FAILURE ===========
        // Only pause and show failure UI when step truly failed
        // (NOT when healed or skipped by resilient runtime)
        if (!data.success && !isHealed && !isSkipped) {
          if (import.meta.env.DEV) console.log('[Test] Step failed - showing Smart Suggestions for quick fix');

          // Set paused state so user can fix
          setIsTestPaused(true);
          setPausedAtStep(data.stepIndex);
          setEditingActionIndex(data.stepIndex);
          setRightPanelTab('suggestions');

          // Show suggestions overlay in browser
          if (flowstral?.playwrightRecorder?.showSuggestionsOverlay) {
            flowstral.playwrightRecorder.showSuggestionsOverlay();
          }
          switchToStepTabAndRefresh(data.stepIndex);

          toast.error(
            `Step ${data.stepIndex + 1} failed. Click correct element in browser or use Smart Suggestions panel to fix.`,
            { duration: 8000 }
          );
        }
        
        // Auto-scroll to current step
        setTimeout(() => {
          const container = document.getElementById('execution-steps-container');
          const currentStepEl = container?.children[data.stepIndex] as HTMLElement;
          if (currentStepEl) {
            currentStepEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      });
      eventCleanups.push(unsubStepComplete);

      // Listen for resilient healing events (step is being auto-healed)
      const unsubStepHealing = flowstral.on('playwright-test-step-healing', (data: { stepIndex: number; error?: string }) => {
        if (import.meta.env.DEV) console.log(`[Test] Step ${data.stepIndex + 1} healing in progress...`);
        setTestExecutionResult(prev => {
          if (!prev) return prev;
          const newResults = [...prev.stepResults];
          newResults[data.stepIndex] = {
            ...newResults[data.stepIndex],
            index: data.stepIndex,
            status: 'healing',
          };
          return { ...prev, stepResults: newResults };
        });
      });
      eventCleanups.push(unsubStepHealing);

      // Listen for flagged step / pause events
      const unsubPaused = flowstral.on('playwright-test-paused', (data: { stepIndex: number; reason: string; flagReason?: string }) => {
        if (import.meta.env.DEV) console.log('[Test] Paused at flagged step:', data.stepIndex, data.flagReason);
        setTestExecutionResult(prev => {
          if (!prev) return prev;
          return {
            ...prev,
            status: 'paused',
            currentStep: data.stepIndex,
          };
        });
        setIsTestPaused(true);
        setPausedAtStep(data.stepIndex);
        toast.info(`🚩 Paused at flagged step ${data.stepIndex + 1}: ${data.flagReason || 'Review needed'}`, {
          duration: 5000
        });
      });
      eventCleanups.push(unsubPaused);
      
      // CRITICAL: Listen for test completion (especially after resume from pause)
      const unsubComplete = flowstral.on('playwright-test-complete', (data: { 
        success: boolean; 
        passedSteps: number; 
        failedStep?: number;
        totalSteps: number;
        stepResults?: any[];
        error?: string 
      }) => {
        if (import.meta.env.DEV) console.log('[Test] Test complete event received:', data.success ? 'PASSED' : 'FAILED');
        
        // Build step results from event data or create default
        const finalStepResults = data.stepResults?.map((s: any, i: number) => ({
          index: i,
          status: s.status || 'passed',
          error: s.error,
          screenshot: s.screenshot,
          workingSelector: s.workingSelector,
          strategyType: s.strategyType,
          healed: s.healed || false,
          skipped: s.skipped || false,
        })) || [];
        
        // Determine the canonical failed step index:
        // 1. Use failedStep from the event (most reliable, comes from backend)
        // 2. Fall back to first step with 'failed' status in stepResults
        // 3. Fall back to currentStep
        let failedIdx: number | undefined = undefined;
        if (!data.success) {
          if (data.failedStep !== undefined && data.failedStep >= 0) {
            failedIdx = data.failedStep;
          } else {
            const firstFailed = finalStepResults.find(s => s.status === 'failed');
            failedIdx = firstFailed?.index;
          }
        }
        
        setTestExecutionResult({
          status: data.success ? 'passed' : 'failed',
          currentStep: data.totalSteps - 1,
          failedStepIndex: failedIdx,
          stepResults: finalStepResults,
          totalSteps: data.totalSteps,
          error: data.success ? undefined : data.error
        });
        
        setIsTestPaused(false);
        setPausedAtStep(null);
        // Note: Running state is tracked via testExecutionResult.status, not a separate flag.
        // setIsTestRunning was removed — do NOT re-add it.
        
        if (data.success) {
          const healedCount = finalStepResults.filter(s => s.healed).length;
          const skippedCount = finalStepResults.filter(s => s.skipped).length;
          const healInfo = healedCount > 0 ? `, ${healedCount} auto-healed` : '';
          const skipInfo = skippedCount > 0 ? `, ${skippedCount} auto-skipped` : '';
          toast.success(`Test Passed! (${data.passedSteps}/${data.totalSteps} steps${healInfo}${skipInfo})`, { duration: 3000 });
        } else {
          toast.error(`Test Failed: ${data.error || 'Step failed'}`, { duration: 5000 });
        }
      });
      eventCleanups.push(unsubComplete);
    }
    
    // Fallback: Poll-based progress tracking if no event listeners
    let progressInterval: NodeJS.Timeout | null = null;
    if (!flowstral?.on) {
      if (import.meta.env.DEV) console.log('[Test] Using fallback progress polling (no flowstral.on)');
      progressInterval = setInterval(async () => {
        if (flowstral?.playwrightRecorder?.getTestProgress) {
          const progress = await flowstral.playwrightRecorder.getTestProgress();
          if (progress && progress.currentStep !== undefined) {
            setTestExecutionResult(prev => prev && prev.status === 'running' ? { 
              ...prev, 
              currentStep: progress.currentStep,
              stepResults: progress.stepResults || prev.stepResults
            } : prev);
          }
        }
      }, 500);
    }
    
    // Clear previous failure state
    setFailureState(null);
    setBrowserKeptOpen(false);
    
    try {
      let result: any;
      
      // Calculate slowMo delay based on playback speed
      const slowMoDelay = playbackSpeed === '0.25x' ? 1000 : 
                          playbackSpeed === '0.5x' ? 500 : 
                          playbackSpeed === '2x' ? 0 : 200;
      
      if (flowstral?.playwrightRecorder?.runTest) {
        // Use normalized actions for robust playback
        // freshBrowser: true = completely clean browser with no stored state
        // keepBrowserOpenOnFailure: true = don't close browser on failure (for debugging)
        
        // CRITICAL: Get flagged step IDs to pass to backend
        // If any steps are flagged as false positives, backend will pause at those steps
        const flaggedStepIds = Array.from(falsePositiveSteps.keys());
        const hasAnyFlaggedSteps = flaggedStepIds.length > 0;
        
        // V2 Simple Playback: Playwright-native element finding (3-10x faster)
        // ON by default. Disable via localStorage: localStorage.setItem('useSimplePlayback', 'false')
        const useSimplePlayback = localStorage.getItem('useSimplePlayback') !== 'false';
        
        result = await flowstral.playwrightRecorder.runTest({
          steps: normalizedActions,
          url: url,
          freshBrowser: freshBrowser,
          keepBrowserOpenOnFailure: keepBrowserOpenOnFailure || hasAnyFlaggedSteps, // Keep browser open if we have flagged steps
          slowMo: slowMoDelay,
          highlight: highlightElements,
          // NEW: Pass flagged steps so backend can pause at them
          flaggedSteps: flaggedStepIds,
          stopAtFlagged: hasAnyFlaggedSteps, // Stop at flagged steps if any exist
          // V2: Simplified Playwright-native playback
          useSimplePlayback: useSimplePlayback
        });
      } else if (electronAPI?.testRunner?.executeTest) {
        // Use normalized actions with enhanced selectorObj for fallbacks
        // CRITICAL: Pass ALL action fields - TestExecutor needs text, label, element, recipe for SmartFinder
        result = await electronAPI.testRunner.executeTest({
          name: 'Recorded Test',
          steps: normalizedActions.map(a => ({
            // Core identifiers
            id: a.id,
            type: a.type || a.qword,  // Use sf-* type if available, fallback to qword
            qword: a.qword,
            args: a.args,
            // Selectors - MANUAL OVERRIDE TAKES PRIORITY
            selector: a.selectorObj?.manualOverride || a.selectorObj?.playwright || a.selectorObj?.selector,
            selectorObj: a.selectorObj,
            // CRITICAL: Manual override selector (user-specified when automation fails)
            manualOverride: a.selectorObj?.manualOverride,
            // CRITICAL: Text/label fields needed by SmartFinder and _findElement
            // Manual text override takes priority if set
            text: a.selectorObj?.text || (a as any).text || a.args?.[0],
            label: a.selectorObj?.text || (a as any).label || a.args?.[0],
            // CRITICAL: Element data for role-based finding
            element: (a as any).element || {
              text: a.selectorObj?.text,
              role: a.selectorObj?.role,
              tagName: a.selectorObj?.tagName || a.selectorObj?.tag,
              testId: a.selectorObj?.testId,
              name: a.selectorObj?.name,
              id: a.selectorObj?.id,
              ariaLabel: a.selectorObj?.ariaLabel,
              placeholder: a.selectorObj?.placeholder,
            },
            // CRITICAL: Recipe for SmartFinder V2
            recipe: (a as any).recipe || (a as any).target,
            // Display
            description: a.description,
            displayArgs: a.displayArgs,
            // Context
            frameContext: (a as any).frameContext,
            tabIndex: (a as any).tabIndex,
            // Metadata
            timestamp: a.timestamp,
            elementIndex: (a as any).elementIndex,
          })),
          settings: { baseUrl: url }
        });
      }
      
      // Stop progress tracking (event listeners and interval)
      eventCleanups.forEach(cleanup => cleanup());
      if (progressInterval) clearInterval(progressInterval);
      
      if (import.meta.env.DEV) console.log('[Test] Result:', result);
      
      // Generate step results from the response (preserve workingSelector for Lock Locators)
      const generateStepResults = () => {
        // If result has stepResults, use those (include workingSelector + strategyType for Lock Locators)
        if (result?.stepResults && Array.isArray(result.stepResults)) {
          return result.stepResults.map((s: any, i: number) => ({
            index: s.index ?? i,
            status: s.status || 'passed',
            error: s.error,
            screenshot: s.screenshot,
            workingSelector: s.workingSelector,
            strategyType: s.strategyType,
            healed: s.healed,
            newSelector: s.newSelector
          }));
        }
        
        // If result has steps array, use that
        if (result?.steps && Array.isArray(result.steps)) {
          return result.steps.map((s: any, i: number) => ({
            index: s.index ?? i,
            status: s.status || 'passed',
            error: s.error,
            screenshot: s.screenshot,
            workingSelector: s.workingSelector,
            strategyType: s.strategyType,
            healed: s.healed,
            newSelector: s.newSelector
          }));
        }
        
        // If test passed, mark all steps as passed (no workingSelector from backend)
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
      
      // Check if test was paused at a flagged step (not failed, but paused for repair)
      const pausedAtFlagged = result?.status === 'paused_at_flagged' || result?.stoppedAtFlaggedStep;
      
      if (pausedAtFlagged) {
        // Test paused at flagged step - show repair UI
        const flaggedStepIndex = result.stoppedAtFlaggedStep?.index ?? result.failedStep;
        if (import.meta.env.DEV) console.log('[Test] Test paused at flagged step:', flaggedStepIndex);
        
        setTestExecutionResult({
          status: 'paused',
          currentStep: flaggedStepIndex,
          stepResults: stepResults.map((s, i) => ({
            ...s,
            status: i < flaggedStepIndex ? 'passed' : (i === flaggedStepIndex ? 'pending' : 'skipped')
          })),
          totalSteps: actions.length,
        });
        
        setBrowserKeptOpen(true); // Browser is kept open for repair
        setIsTestPaused(true);
        setPausedAtStep(flaggedStepIndex);
        
        // CLOSE the modal so user can see Smart Suggestions panel
        // The modal was blocking the suggestions - this fixes Issue 1
        setShowTestResultModal(false);
        
        // Auto-open the Smart Suggestions panel for replacing the step
        setEditingActionIndex(flaggedStepIndex);
        setRightPanelTab('suggestions');
        
        // Show the Smart Suggestions overlay on the browser
        const flowstralAPI = (window as any).flowstral;
        if (flowstralAPI?.playwrightRecorder?.showSuggestionsOverlay) {
          flowstralAPI.playwrightRecorder.showSuggestionsOverlay();
        }
        switchToStepTabAndRefresh(flaggedStepIndex);
        
        toast.info(
          `🚩 Paused at step ${flaggedStepIndex + 1}. Use Smart Suggestions panel (right side) or click elements in browser to replace selector.`,
          { duration: 10000 }
        );
        return; // Don't process as normal pass/fail
      }
      
      setTestExecutionResult({
        status: testPassed ? 'passed' : 'failed',
        currentStep: actions.length - 1,
        stepResults,
        totalSteps: actions.length,
        error: testPassed ? undefined : (result?.error || result?.failError || 'Test failed')
      });
      
      // Track browser and failure state for B+C Hybrid repair
      if (!testPassed) {
        setBrowserKeptOpen(result?.browserKeptOpen || false);
        if (result?.failureState) {
          setFailureState({
            stepIndex: result.failureState.stepIndex,
            step: result.failureState.step,
            error: result.failureState.error,
            screenshot: result.failureState.screenshot,
            url: result.failureState.url,
            similarElements: result.failureState.similarElements || []
          });
        }
        
        // ============ FALSE POSITIVE AUTO-REPAIR ============
        // Check if any failed step was marked as false positive
        // If so, auto-open the step editor for immediate fixing
        const failedSteps = stepResults.filter(s => s.status === 'failed');
        for (const failedStep of failedSteps) {
          const action = actions[failedStep.index];
          if (action?.id && falsePositiveSteps.has(action.id)) {
            // This was a flagged step - auto-open editor
            setTimeout(() => {
              handleFalsePositiveStop(failedStep.index, action.id!, failedStep.screenshot || null);
            }, 500); // Small delay to let UI settle
            break; // Only handle first false positive
          }
        }
      }
      
      // ============ RECORD STEP RESULTS FOR FLAKY DETECTION ============
      // Fire-and-forget: send step outcomes to backend for per-step flaky analysis
      // This runs after EVERY test completion (pass or fail) to build history
      try {
        const testId = currentTestId;
        const stepsForFlaky = stepResults.map((sr: any, idx: number) => ({
          step_id: actions[sr.index]?.id || String(sr.index),
          actionId: actions[sr.index]?.id,
          index: sr.index,
          label: actions[sr.index]?.description || actions[sr.index]?.type || `Step ${sr.index + 1}`,
          status: sr.status || 'unknown',
          error: sr.error || '',
          duration_ms: sr.duration || 0,
          healed: sr.healed || false,
        }));
        recordStepResultsApi({
          test_id: testId,
          run_id: `run_${Date.now()}`,
          step_results: stepsForFlaky,
        }).then(() => {
          // After recording, refresh flaky step info
          getFlakyStepsApi(testId).then(flakySteps => {
            const ids = new Set(flakySteps.filter(s => s.is_flaky).map(s => s.step_id));
            setFlakyStepIds(ids);
          }).catch(() => {});
        }).catch(() => {});
      } catch (e) {
        // Non-critical — flaky detection is additive
      }

      // ============ AI FALSE-POSITIVE DETECTION ============
      // For failed steps with screenshots, ask Vision AI if element is visually present
      // If so, auto-flag as false positive (selector broke but element is there)
      // Cost-controlled: max 3 checks per run
      if (!testPassed) {
        try {
          const failedWithScreenshots = stepResults
            .filter((s: any) => s.status === 'failed' && s.screenshot)
            .slice(0, 3); // Max 3 for cost control

          for (const failedStep of failedWithScreenshots) {
            const action = actions[failedStep.index];
            if (!action?.id) continue;
            // Skip if already flagged
            if (falsePositiveSteps.has(action.id)) continue;

            const screenshotB64 = (failedStep.screenshot || '').replace(/^data:image\/[a-z]+;base64,/, '');
            if (!screenshotB64) continue;

            detectFalsePositiveApi({
              test_id: currentTestId,
              step_id: action.id,
              step_index: failedStep.index,
              step_label: action.description || action.text || action.label || `Step ${failedStep.index + 1}`,
              failed_selector: action.manualSelector || action.selectorObj?.selector || action.selector || '',
              screenshot_b64: screenshotB64,
              page_url: failedStep.url || undefined,
            }).then(fpResult => {
              if (fpResult.is_false_positive && fpResult.confidence >= 0.7) {
                // Auto-flag this step
                markStepAsFalsePositive(
                  failedStep.index,
                  failedStep.screenshot || null,
                  `AI detected: ${fpResult.reason} (${Math.round(fpResult.confidence * 100)}% confidence)`
                );
                toast.info(
                  `AI detected Step ${failedStep.index + 1} may be a false positive: ${fpResult.reason}`,
                  { duration: 6000 }
                );
              }
            }).catch(() => {
              // Non-critical — AI FP detection is additive
            });
          }
        } catch (e) {
          // Non-critical — AI FP detection is additive
        }
      }

      if (testPassed) {
        toast.success(`Test Passed! (${actions.length} steps)`, { id: 'run' });
      } else {
        const browserMsg = result?.browserKeptOpen ? ' Browser kept open for debugging.' : '';
        toast.error(`Test Failed: ${result?.error || 'Unknown error'}${browserMsg}`, { id: 'run' });
      }
    } catch (error: any) {
      // Cleanup progress tracking
      eventCleanups.forEach(cleanup => cleanup());
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

  // ========== PAUSE/RESUME/DEBUG HANDLERS ==========
  // 
  // These handlers enable pausing a test mid-execution, editing steps, and resuming.
  // The key insight: Playwright keeps the browser context alive, so we can resume!
  //
  // BACKEND IMPLEMENTATION REQUIRED:
  // The Electron backend needs to implement these methods:
  //
  // 1. pauseTest() - Sets a flag that the execution loop checks after each step
  //    - When flag is set, loop pauses and waits for resume signal
  //    - Browser/page stays open (DO NOT close context!)
  //
  // 2. resumeTest({ fromStep, steps, totalSteps }) - Continues execution
  //    - Simply continues the for-loop from `fromStep` index
  //    - Uses updated `steps` array (user may have edited a step)
  //
  // 3. skipStep({ skippedStep, continueFrom, isComplete }) - Skips current step
  //    - Marks step as skipped, continues from `continueFrom`
  //    - If isComplete=true, close browser
  //
  // 4. retryStep({ step, index }) - Re-runs the current step
  //    - Execute just this one step with potentially modified data
  //    - Then pause again (or continue based on stepByStepMode)
  //
  // 5. stopTest({ closeBrowser }) - Aborts execution
  //    - Closes browser context if closeBrowser=true
  //
  // Example backend pseudo-code:
  // ```
  // let isPaused = false;
  // let currentStepIndex = 0;
  // 
  // async function runTest(steps) {
  //   for (let i = currentStepIndex; i < steps.length; i++) {
  //     await executeStep(steps[i]);
  //     currentStepIndex = i;
  //     
  //     if (isPaused) {
  //       await waitForResume(); // Returns when resumeTest() is called
  //     }
  //   }
  //   await browser.close();
  // }
  // ```
  //
  // ================================================================
  
  // Request pause during test execution
  const handlePauseTest = useCallback(() => {
    if (!testExecutionResult || testExecutionResult.status !== 'running') return;
    
    setPauseRequested(true);
    toast.info('Pause requested... waiting for current step to complete', { duration: 2000 });
    
    // Notify backend to pause after current step
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.pauseTest) {
      flowstral.playwrightRecorder.pauseTest();
    }
    
    // Update state to paused
    setIsTestPaused(true);
    setPausedAtStep(testExecutionResult.currentStep);
    setTestExecutionResult(prev => prev ? { ...prev, status: 'paused' } : null);
    
    // Set the step being edited
    if (actions[testExecutionResult.currentStep]) {
      setEditingPausedStep({ ...actions[testExecutionResult.currentStep] });
    }
  }, [testExecutionResult, actions]);

  // Resume test execution from paused state
  // This continues from the NEXT step after where we paused
  // The browser is still open with the page state preserved
  const handleResumeTest = useCallback(() => {
    if (!isTestPaused || pausedAtStep === null) return;
    
    // Apply any edits made to the paused step BEFORE resuming
    let updatedActions = actions;
    if (editingPausedStep && pausedAtStep !== null) {
      updatedActions = [...actions];
      updatedActions[pausedAtStep] = editingPausedStep;
      setActions(updatedActions);
    }
    
    // Determine which step to resume FROM
    // If current step was already executed, resume from next step
    // If current step failed/needs retry, resume from current step
    const stepResult = testExecutionResult?.stepResults.find(r => r.index === pausedAtStep);
    const resumeFromStep = stepResult?.status === 'passed' ? pausedAtStep + 1 : pausedAtStep;
    
    setIsTestPaused(false);
    setPauseRequested(false);
    setEditingPausedStep(null);
    setTestExecutionResult(prev => prev ? { 
      ...prev, 
      status: 'running',
      currentStep: resumeFromStep 
    } : null);
    
    toast.success(`Resuming from step ${resumeFromStep + 1}...`, { duration: 1500 });
    
    // Notify backend to resume execution from the specific step
    // Backend keeps the browser/page context alive during pause
    // and simply continues the execution loop from resumeFromStep
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.resumeTest) {
      flowstral.playwrightRecorder.resumeTest({
        fromStep: resumeFromStep,
        steps: updatedActions, // Pass updated steps in case user edited
        totalSteps: actions.length
      });
    }
    
    // Resolve the pause promise if using step-by-step
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, [isTestPaused, pausedAtStep, editingPausedStep, actions, testExecutionResult]);

  // Skip current step and continue from the NEXT step
  // Browser stays open, just moves to next step in queue
  const handleSkipPausedStep = useCallback(() => {
    if (!isTestPaused || pausedAtStep === null) return;
    
    const nextStep = pausedAtStep + 1;
    const isLastStep = nextStep >= actions.length;
    
    // Mark current step as skipped
    setTestExecutionResult(prev => {
      if (!prev) return null;
      const stepResults = [...prev.stepResults];
      stepResults[pausedAtStep] = { index: pausedAtStep, status: 'skipped' };
      
      // If this was the last step, test is complete
      if (isLastStep) {
        const passedCount = stepResults.filter(r => r.status === 'passed').length;
        const totalSteps = prev.totalSteps;
        return { 
          ...prev, 
          status: passedCount === totalSteps - 1 ? 'passed' : 'failed',
          currentStep: pausedAtStep,
          stepResults 
        };
      }
      
      return { 
        ...prev, 
        status: 'running',
        currentStep: nextStep,
        stepResults 
      };
    });
    
    setIsTestPaused(false);
    setPauseRequested(false);
    setEditingPausedStep(null);
    
    if (isLastStep) {
      toast.info(`Skipped step ${pausedAtStep + 1}. Test complete.`, { duration: 2000 });
    } else {
      toast.info(`Skipped step ${pausedAtStep + 1}, continuing from step ${nextStep + 1}...`, { duration: 1500 });
    }
    
    // Notify backend to skip and continue from next step
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.skipStep) {
      flowstral.playwrightRecorder.skipStep({
        skippedStep: pausedAtStep,
        continueFrom: nextStep,
        isComplete: isLastStep
      });
    }
    
    // Advance and resolve
    if (pauseResolverRef.current) {
      pauseResolverRef.current();
      pauseResolverRef.current = null;
    }
  }, [isTestPaused, pausedAtStep, actions.length]);

  // Retry the current failed/paused step
  const handleRetryPausedStep = useCallback(() => {
    if (!isTestPaused || pausedAtStep === null) return;
    
    // Apply edits first
    if (editingPausedStep) {
      setActions(prev => {
        const updated = [...prev];
        updated[pausedAtStep] = editingPausedStep;
        return updated;
      });
    }
    
    // Reset step result to pending
    setTestExecutionResult(prev => {
      if (!prev) return null;
      const stepResults = [...prev.stepResults];
      stepResults[pausedAtStep] = { index: pausedAtStep, status: 'pending' };
      return { ...prev, status: 'running', stepResults };
    });
    
    setIsTestPaused(false);
    setPauseRequested(false);
    setEditingPausedStep(null);
    
    toast.info(`🔄 Retrying step ${pausedAtStep + 1}...`, { duration: 1500 });
    
    // Notify backend to retry current step
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.retryStep) {
      flowstral.playwrightRecorder.retryStep({ 
        step: editingPausedStep || actions[pausedAtStep],
        index: pausedAtStep 
      });
    }
  }, [isTestPaused, pausedAtStep, editingPausedStep, actions]);

  // Run from a specific step (e.g. after fixing the failed step). Works when browser is still open.
  const handleRunFromStep = useCallback((stepIndex: number) => {
    if (!browserKeptOpen) {
      toast.info('Run from here works when the browser is kept open. Use Retry All to run the test again.', { duration: 4000 });
      return;
    }
    const flowstral = (window as any).flowstral;
    if (!flowstral?.playwrightRecorder?.resumeFromFailure) {
      toast.info('Run from here is not available. Use Retry All to run the test again.', { duration: 3000 });
      return;
    }
    setTestExecutionResult(prev => prev ? { ...prev, status: 'running', currentStep: stepIndex } : null);
    flowstral.playwrightRecorder.resumeFromFailure({
      fromStep: stepIndex,
      steps: actions,
      totalSteps: actions.length
    });
    toast.success(`Running from step ${stepIndex + 1}...`, { duration: 1500 });
  }, [browserKeptOpen, actions]);

  // ============ STEP FLAG HANDLERS ============
  // Flag a step as unreliable — covers both false positives and false negatives:
  // - False positive: step FAILED but shouldn't have (selector broke, element is there)
  // - False negative: step PASSED but hit the WRONG element
  // On next run, test will stop at flagged steps for the user to fix.
  // Now persists to backend so flags survive across sessions.
  const markStepAsFalsePositive = useCallback((stepIndex: number, screenshot: string | null, reason?: string) => {
    const action = actions[stepIndex];
    if (!action || !action.id) return;

    setFalsePositiveSteps(prev => {
      const newMap = new Map(prev);
      newMap.set(action.id!, {
        stepIndex,
        screenshot,
        markedAt: Date.now(),
        reason
      });
      return newMap;
    });

    // Persist to backend (fire-and-forget, non-blocking)
    const testId = currentTestId;
    saveFalsePositiveApi({
      test_id: testId,
      step_id: action.id!,
      step_index: stepIndex,
      step_label: action.description || action.type || `Step ${stepIndex + 1}`,
      screenshot: null, // Don't send screenshots to backend (too large)
      reason: reason || null,
    }).catch(() => {}); // Silent fail — in-memory still works

    const isWrongElement = reason?.includes('Wrong element');
    toast.success(
      isWrongElement
        ? `🚩 Step ${stepIndex + 1} flagged — wrong element. On next run, test will stop here for you to fix.`
        : `🚩 Step ${stepIndex + 1} flagged. On next run, test will stop here for you to fix.`,
      { duration: 4000 }
    );
  }, [actions]);
  
  // Remove false positive flag from a step
  // Now also removes from backend persistence
  const unmarkFalsePositive = useCallback((actionId: string) => {
    setFalsePositiveSteps(prev => {
      const newMap = new Map(prev);
      newMap.delete(actionId);
      return newMap;
    });
    
    // Remove from backend (fire-and-forget)
    removeFalsePositiveApi(currentTestId, actionId).catch(() => {});
    
    toast.info('False positive flag removed');
  }, [actions]);

  // ============ AI AUTO-FIX STEP HANDLER ============
  // When user clicks "Fix" on a failed step, try AI healing chain FIRST.
  // If AI finds a fix, apply it automatically (no manual intervention needed).
  // Only fall back to Smart Suggestions panel if AI can't fix it.
  const handleAutoFixStep = useCallback(async (stepIndex: number, opts?: { flagFirst?: boolean }) => {
    const action = actions[stepIndex];
    if (!action) return;

    // Mark this step as being auto-fixed (shows spinner)
    setAutoFixingSteps(prev => new Set(prev).add(stepIndex));

    // If flagFirst option is set, flag before trying fix
    if (opts?.flagFirst && action.id && !falsePositiveSteps.has(action.id)) {
      markStepAsFalsePositive(stepIndex, null);
    }

    // Get the test result for this step to extract error info
    const stepResult = testExecutionResult?.stepResults?.[stepIndex] || testExecutionResult?.step_results?.[stepIndex];
    const errorMessage = stepResult?.error || stepResult?.message || 'Element not found';
    const failedSelector = action.selector || action.selectorObj?.css || action.selectorObj?.xpath || action.args?.[0] || '';
    const screenshot = stepResult?.screenshot || null;

    try {
      toast.info(`AI is auto-fixing step ${stepIndex + 1}...`, { duration: 3000 });

      const result = await autoFixStepApi({
        test_id: currentTestId,
        step_id: action.id || `step_${stepIndex}`,
        step_index: stepIndex,
        step_label: getDisplayLabel(action),
        failed_selector: failedSelector,
        error_message: errorMessage,
        step_info: {
          qword: action.qword,
          type: action.type,
          args: action.args,
          description: action.description,
          url: action.url,
        },
        screenshot_b64: screenshot || null,
        page_url: action.url || null,
      });

      if (result.success && result.fixed_selector) {
        // AI found a fix! Apply it automatically — no manual intervention needed.
        setActions(prev => {
          const newActions = [...prev];
          if (stepIndex >= 0 && stepIndex < newActions.length) {
            const oldAction = newActions[stepIndex];
            newActions[stepIndex] = {
              ...oldAction,
              selector: result.fixed_selector!,
              selectorObj: {
                ...(oldAction.selectorObj || {}),
                css: result.fixed_selector!,
              },
              args: oldAction.args ? [result.fixed_selector!, ...oldAction.args.slice(1)] : [result.fixed_selector!],
              _aiHealed: true,
              _healStrategy: result.strategy_used,
            } as any;
          }
          return newActions;
        });

        // Clear false positive flag since we fixed it
        if (action.id && falsePositiveSteps.has(action.id)) {
          setFalsePositiveSteps(prev => {
            const newMap = new Map(prev);
            newMap.delete(action.id!);
            return newMap;
          });
        }

        setAutoFixResults(prev => new Map(prev).set(stepIndex, { success: true, message: `AI fixed: ${result.strategy_used || 'auto-healed'}` }));
        toast.success(
          `Step ${stepIndex + 1} auto-fixed by AI (${result.strategy_used || 'healed'}, ${Math.round(result.confidence * 100)}% confidence). Run test again to verify.`,
          { duration: 5000 }
        );
      } else {
        // AI couldn't fix it — show Manual Assist card inline instead of navigating away
        setAutoFixResults(prev => new Map(prev).set(stepIndex, { success: false, message: result.message || 'AI could not find a fix' }));
        setManualAssistStep(stepIndex);
        toast.warning(
          `AI couldn't auto-fix step ${stepIndex + 1}. Use Manual Assist below to paste element HTML, enter a selector, or upload a screenshot.`,
          { duration: 6000 }
        );
      }
    } catch (err) {
      console.error('[AI Auto-Fix] Error:', err);
      // On error, show Manual Assist card inline
      setAutoFixResults(prev => new Map(prev).set(stepIndex, { success: false, message: 'AI service error' }));
      setManualAssistStep(stepIndex);
      toast.warning('AI auto-fix unavailable. Use Manual Assist below to fix the step manually.', { duration: 5000 });
    } finally {
      setAutoFixingSteps(prev => {
        const next = new Set(prev);
        next.delete(stepIndex);
        return next;
      });
    }
  }, [actions, currentTestId, testExecutionResult, falsePositiveSteps, markStepAsFalsePositive]);

  // Handle when test stops at a false positive step - auto-open element picker
  const handleFalsePositiveStop = useCallback((stepIndex: number, actionId: string, screenshot: string | null) => {
    setStoppedAtFalsePositive({ stepIndex, actionId, screenshot });
    
    // Auto-open the step editor for this step
    setEditingActionIndex(stepIndex);
    setEditSelectorModalOpen(true);
    
    toast.info(
      'Stopped at flagged step. Click the correct element to fix it.',
      { duration: 5000 }
    );
  }, []);
  
  // Clear false positive stop state when step is fixed
  const handleFalsePositiveFixed = useCallback((actionId: string) => {
    setStoppedAtFalsePositive(null);
    // Remove from false positive list since it's now fixed
    unmarkFalsePositive(actionId);
    toast.success('Step fixed! Run test again to continue.');
  }, [unmarkFalsePositive]);

  // Stop test execution and close browser
  const handleStopTest = useCallback(() => {
    setIsTestPaused(false);
    setPauseRequested(false);
    setPausedAtStep(null);
    setEditingPausedStep(null);
    setStepByStepMode(false);
    
    // Mark remaining steps as skipped
    setTestExecutionResult(prev => {
      if (!prev) return null;
      const stepResults = prev.stepResults.map((r, idx) => 
        r.status === 'pending' || !r.status ? { ...r, status: 'skipped' } : r
      );
      return { ...prev, status: 'failed', stepResults, error: 'Test stopped by user' };
    });
    
    toast.info('🛑 Test stopped. Closing browser...', { duration: 2000 });
    
    // Notify backend to stop and close browser
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.stopTest) {
      flowstral.playwrightRecorder.stopTest({ closeBrowser: true });
    }
  }, []);

  // Toggle step-by-step execution mode
  const toggleStepByStepMode = useCallback(() => {
    setStepByStepMode(prev => !prev);
    toast.info(stepByStepMode ? 'Continuous mode' : '⏯️ Step-by-step mode enabled', { duration: 1500 });
  }, [stepByStepMode]);

  // Update the paused step's automation
  const updatePausedStepField = useCallback((field: keyof RecordedAction, value: any) => {
    setEditingPausedStep(prev => prev ? { ...prev, [field]: value } : null);
  }, []);

  // Run single step (for step-by-step mode)
  const handleRunSingleStep = useCallback(async () => {
    if (pausedAtStep === null || !testExecutionResult) return;
    
    const stepToRun = editingPausedStep || actions[pausedAtStep];
    
    toast.loading(`Running step ${pausedAtStep + 1}...`, { id: 'single-step' });
    
    const flowstral = (window as any).flowstral;
    if (flowstral?.playwrightRecorder?.runSingleStep) {
      try {
        const result = await flowstral.playwrightRecorder.runSingleStep({
          step: stepToRun,
          index: pausedAtStep
        });
        
        // Update step result
        setTestExecutionResult(prev => {
          if (!prev) return null;
          const stepResults = [...prev.stepResults];
          stepResults[pausedAtStep] = { 
            index: pausedAtStep, 
            status: result?.success ? 'passed' : 'failed',
            error: result?.error,
            screenshot: result?.screenshot
          };
          return { ...prev, stepResults };
        });
        
        if (result?.success) {
          toast.success(`Step ${pausedAtStep + 1} passed`, { id: 'single-step' });
          
          // Auto-advance to next step if there are more
          if (pausedAtStep < actions.length - 1) {
            setPausedAtStep(pausedAtStep + 1);
            setEditingPausedStep({ ...actions[pausedAtStep + 1] });
          } else {
            // Test complete
            setTestExecutionResult(prev => prev ? { ...prev, status: 'passed' } : null);
            toast.success('All steps completed!', { duration: 3000 });
          }
        } else {
          toast.error(`Step ${pausedAtStep + 1} failed: ${result?.error || 'Unknown error'}`, { id: 'single-step' });
        }
      } catch (error: any) {
        toast.error(`Failed: ${error?.message}`, { id: 'single-step' });
      }
    }
  }, [pausedAtStep, editingPausedStep, actions, testExecutionResult]);
  
  // ========== END PAUSE/RESUME/DEBUG HANDLERS ==========

  return {
    handleLockLocators,
    handleRunTest,
    handlePauseTest,
    handleResumeTest,
    handleSkipPausedStep,
    handleRetryPausedStep,
    handleRunFromStep,
    markStepAsFalsePositive,
    unmarkFalsePositive,
    handleAutoFixStep,
    handleFalsePositiveStop,
    handleFalsePositiveFixed,
    handleStopTest,
    toggleStepByStepMode,
    updatePausedStepField,
    handleRunSingleStep,
  };
}
