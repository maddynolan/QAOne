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
import { SalesforceContextPanel } from "@/components/SalesforceContextPanel";
import { SoqlEditor } from "@/components/SoqlEditor";
import { salesforceApi } from "@/lib/salesforce-api";
// AI Test Generator
import { AITestGenerator } from "@/components/AITestGenerator";
// AI Explorer Agent - Autonomous test discovery
import { AIExplorerAgent } from "@/components/AIExplorerAgent";
// AI Flow Explorer - Full flow discovery with navigation graph
import { AIFlowExplorer } from "@/components/AIFlowExplorer";
// New SF Components
import { SFContextDashboard } from "@/components/salesforce/SFContextDashboard";
import { SmartSOQLBuilder } from "@/components/salesforce/SmartSOQLBuilder";
import { MetadataAssertions } from "@/components/salesforce/MetadataAssertions";
import { StageTransitionTester } from "@/components/salesforce/StageTransitionTester";
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
} from "@/lib/automation-linking";
// Element Repair Wizard - Visual element picker for fixing failed steps
import ElementRepairWizard from "@/components/ElementRepairWizard";
import SimpleStepEditor from "@/components/SimpleStepEditor";
// Confidence System - Shows reliability of element identification
import { StepConfidenceIndicator, ConfidenceLevel } from "@/components/confidence";
// Failure classification — plain-language messages for no-code UX
import { classifyFailure, flakyLabel, flakyScoreColor } from "@/lib/failureClassification";
// AI Enhancements — independent module for persistence, flaky detection, AI multi-fix
// All methods are fail-safe: returns defaults if backend unreachable
import {
  saveFalsePositive as saveFalsePositiveApi,
  getFalsePositives as getFalsePositivesApi,
  removeFalsePositive as removeFalsePositiveApi,
  resolveFalsePositive as resolveFalsePositiveApi,
  recordStepResults as recordStepResultsApi,
  getFlakySteps as getFlakyStepsApi,
  explainFailure as explainFailureApi,
  type FalsePositiveFlag as ApiFalsePositiveFlag,
  type FlakyStepInfo,
  type FailureExplanation,
  type FixOption as ApiFixOption,
  detectFalsePositive as detectFalsePositiveApi,
} from "@/lib/aiEnhancements";
import { API_BASE_URL } from "@/lib/api-config";

// Types
interface StepConfidence {
  score: number;
  level: ConfidenceLevel;
  reasons?: string[];
  deductions?: string[];
  recommendation?: string | null;
}

interface MatchAnalysis {
  totalMatches: number;
  usedPosition: number;
  matchDetails?: Array<{
    position: number;
    text: string;
    context: string | null;
  }>;
}

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
  value?: string; // Fill value for input steps
  // Confidence system fields
  confidence?: StepConfidence;
  matchAnalysis?: MatchAnalysis;
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
  inputType?: string; // 'text', 'email', 'password', 'tel', etc.
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

// Cross-origin user action - for manual selector input
interface CrossOriginUserAction {
  id: string;
  type: 'click' | 'fill' | 'select' | 'wait';
  findBy: 'text' | 'css' | 'xpath' | 'testId' | 'coords';
  selector: string;
  coords?: { x: number; y: number };
  value?: string;
  description?: string;
}

// Helper to detect cross-origin placeholder actions
const isCrossOriginAction = (action: RecordedAction): boolean => {
  const type = (action.type || action.qword || '').toLowerCase();
  const desc = (action.description || '').toLowerCase();
  return type === 'crossoriginplaceholder' || 
         type === 'crossorigin' || 
         desc.includes('external tab') ||
         desc.includes('cross-origin');
};

// Check if running in Electron
const isElectron = () => !!(window as any).flowstral?.playwrightRecorder || !!(window as any).electronAPI;

// Helper to detect password-related fields
const isPasswordField = (action: RecordedAction): boolean => {
  const qword = (action.qword || '').toLowerCase();
  // CRITICAL: args[0] could be a number (e.g., tabIndex), not a string
  const arg0Raw = action.args?.[0];
  const arg0 = (typeof arg0Raw === 'string' ? arg0Raw : '').toLowerCase();
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
const hasPasswordArtifacts = (str: unknown): boolean => {
  // Ensure we have a string
  if (!str || typeof str !== 'string') return false;
  // Detect UTF-8 encoding artifacts common in password recording
  return /[āã口¢Γ¡¥©®°±²³µ¶¹º¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏ]/.test(str) ||
         /[\u0100-\u024F]/.test(str) || // Extended Latin characters
         str.includes('ã') ||
         str.includes('Γ');
};

// Helper to mask sensitive values and fix corrupted characters
const maskSensitiveAction = (action: RecordedAction): RecordedAction => {
  const isPwField = isPasswordField(action);
  // Safely get args[1] - could be string, object, or undefined
  const arg1 = action.args?.[1];
  const arg1Str = typeof arg1 === 'string' ? arg1 : '';
  const hasArtifacts = hasPasswordArtifacts(arg1Str) || 
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

// ═══════════════════════════════════════════════════════════════════════════════
// DISPLAY HELPERS - Improve UI display without modifying underlying data
// Fixes "Click element" labels and deduplicates fill actions for display
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get a better display label from action data when args[0] is generic "element"
 * PURE FUNCTION: Only reads data, never modifies anything
 */
const getDisplayLabel = (action: RecordedAction): string => {
  if (!action) return 'element';
  
  const args = action.args || [];
  const label = args[0] || '';
  
  // If label is already good (not generic), use it as-is
  if (label && label !== 'element' && typeof label === 'string' && label.length > 1 && 
      !/^(div|span|button|input|a|li|td|tr)$/i.test(label)) {
    return label;
  }
  
  // Extract better label from selectorObj, raw, element data
  const sel = action.selectorObj || (action as any).raw?.selectorObj || {};
  const raw = (action as any).raw || {};
  const element = (action as any).element || raw.element || {};
  const recipe = (action as any).recipe || raw.recipe || (action as any).target || {};
  const recipeWhat = recipe?.what || {};
  const recipeWhere = recipe?.where || {};
  const recipeWhich = recipe?.which || {};
  
  // Priority order for finding a better label - try ALL sources
  const betterLabel = 
    // First: accessible names
    sel.title || raw.title || element.title ||
    sel.ariaLabel || raw.ariaLabel || element.ariaLabel ||
    recipeWhat.text ||
    recipeWhere.nearText ||
    // Second: form identifiers
    sel.placeholder || raw.placeholder || element.placeholder ||
    sel.name || raw.name || element.name ||
    recipeWhich.name ||
    // Third: test IDs
    sel.testId || raw.testId || element.testId ||
    sel.dataTestId || raw.dataTestId || element.dataTestId ||
    recipeWhich.testId ||
    // Fourth: text content
    sel.text || raw.text || element.text ||
    sel.innerText || raw.innerText || element.innerText ||
    element.textContent ||
    // Fifth: try to extract from description
    extractLabelFromDescription(action.description) ||
    // Sixth: role-based
    (sel.role || element.role ? `${sel.role || element.role}${sel.tagName || element.tagName ? ' (' + (sel.tagName || element.tagName) + ')' : ''}` : null) ||
    // Seventh: tag with index
    ((sel.tagName || element.tagName || raw.tag) && (sel.elementIndex !== undefined || raw.elementIndex !== undefined)
      ? `${sel.tagName || element.tagName || raw.tag} #${(sel.elementIndex || raw.elementIndex || 0) + 1}` 
      : null) ||
    // Eighth: just tag name
    sel.tagName || element.tagName || raw.tag ||
    // Last resort
    (typeof label === 'string' ? label : 'element');
  
  return betterLabel || 'element';
};

/**
 * Extract label from description text like 'Click "Login"' -> 'Login'
 */
const extractLabelFromDescription = (description?: string): string | null => {
  if (!description) return null;
  const match = description.match(/(?:Click|Fill|Select|Check|Uncheck|Type)\s*["']([^"']+)["']/i);
  if (match && match[1] && match[1] !== 'element' && match[1].length > 1) {
    return match[1];
  }
  return null;
};

/**
 * Check if a string looks like a field VALUE rather than a field LABEL
 */
const looksLikeFieldValue = (str?: string): boolean => {
  if (!str || str.length < 3) return false;
  
  // Common field label names - NOT values
  if (/^(username|user|pw|pwd|password|pass|email|mail|name|phone|tel|address|city|zip|code|input|field|text|search|query)$/i.test(str)) {
    return false;
  }
  
  // Looks like email
  if (str.includes('@') && str.includes('.')) return true;
  
  // Looks like password (mixed case + numbers/special chars, 6+ chars)
  if (str.length >= 6 && /[A-Z]/.test(str) && /[a-z]/.test(str) && /[0-9@!#$%^&*()_+\-=]/.test(str)) return true;
  
  // Contains @ but not a field name
  if (str.includes('@') && str.length > 5) return true;
  
  return false;
};

/**
 * Get field identity for deduplication (by attributes, not display label)
 */
const getFieldIdentity = (action: RecordedAction): string | null => {
  const sel = action.selectorObj || {};
  const raw = (action as any).raw?.selectorObj || (action as any).raw || {};
  const element = (action as any).element || (action as any).raw?.element || {};
  const recipe = (action as any).recipe || (action as any).target || {};
  const recipeWhich = recipe?.which || {};
  
  return sel.name || raw.name || element.name ||
         sel.id || raw.id || element.id ||
         sel.testId || raw.testId || element.testId ||
         sel.dataTestId || raw.dataTestId || element.dataTestId ||
         sel.placeholder || raw.placeholder || element.placeholder ||
         recipeWhich.name || recipeWhich.id || recipeWhich.testId ||
         null;
};

/**
 * Check if an action is a fill action (CDP or Recipe)
 */
const isFillAction = (action: RecordedAction): boolean => {
  const qword = (action.qword || '').toLowerCase();
  const type = (action.type || '').toLowerCase();
  return qword === 'fill' || type === 'fill' || type === 'input';
};

/**
 * Check if two Fill actions are for the same field
 */
const areSameFillField = (action1: RecordedAction, action2: RecordedAction): boolean => {
  if (!action1 || !action2) return false;
  if (!isFillAction(action1) || !isFillAction(action2)) return false;
  
  // Get field identifiers from multiple sources
  const id1 = getFieldIdentity(action1);
  const id2 = getFieldIdentity(action2);
  if (id1 && id2 && id1.toLowerCase() === id2.toLowerCase()) return true;
  
  // Get labels from args[0] OR fieldLabel (Recipe fills)
  const label1 = (action1.args?.[0]?.toString() || (action1 as any).fieldLabel || '').toLowerCase().trim();
  const label2 = (action2.args?.[0]?.toString() || (action2 as any).fieldLabel || '').toLowerCase().trim();
  
  // Get values
  const val1 = (action1.args?.[1] || (action1 as any).value || '').toString();
  const val2 = (action2.args?.[1] || (action2 as any).value || '').toString();
  
  // Normalize common field names (pw -> password, user -> username)
  const normalizeFieldName = (name: string): string => {
    const n = name.toLowerCase().trim();
    if (['pw', 'pwd', 'passwd', 'pass'].includes(n)) return 'password';
    if (['user', 'uname', 'usr'].includes(n)) return 'username';
    if (['mail', 'e-mail'].includes(n)) return 'email';
    return n;
  };
  
  const norm1 = normalizeFieldName(label1);
  const norm2 = normalizeFieldName(label2);
  
  // Same normalized label
  if (norm1 && norm2 && norm1 === norm2) return true;
  
  const timeDiff = Math.abs((action1.timestamp || 0) - (action2.timestamp || 0));
  
  if (timeDiff < 5000) {
    // Same value
    if (val1 && val2 && val1 === val2) return true;
    // One contains other (partial typing)
    if (val1 && val2 && (val1.includes(val2) || val2.includes(val1))) return true;
    // Label equals value (Recipe bug where label was the typed value)
    if (label1 && val2 && label1 === val2.toLowerCase()) return true;
    if (label2 && val1 && label2 === val1.toLowerCase()) return true;
    // One label is a value-like string
    if (looksLikeFieldValue(label1) && (id2 || !looksLikeFieldValue(label2))) return true;
    if (looksLikeFieldValue(label2) && (id1 || !looksLikeFieldValue(label1))) return true;
  }
  
  return false;
};

/**
 * Deduplicate actions for display (fills with same field)
 * PURE FUNCTION: Returns NEW array, NEVER modifies input
 */
const getDisplayActions = (actions: RecordedAction[]): RecordedAction[] => {
  if (!actions || actions.length === 0) return [];
  
  const result: { action: RecordedAction; originalIndex: number }[] = [];
  
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    // Check for fills from BOTH CDP (qword='Fill') AND Recipe (type='fill')
    if (isFillAction(action)) {
      const existingIndex = result.findIndex(item => areSameFillField(item.action, action));
      
      if (existingIndex !== -1) {
        const existing = result[existingIndex];
        const existingId = getFieldIdentity(existing.action);
        const newId = getFieldIdentity(action);
        // Check BOTH args[1] (CDP) AND value property (Recipe)
        const existingVal = (existing.action.args?.[1] || (existing.action as any).value || '').toString();
        const newVal = (action.args?.[1] || (action as any).value || '').toString();
        
        // Keep better one: has identity, longer value, or later timestamp
        // CRITICAL: Always prefer the one with actual value (for passwords)
        const shouldReplace = 
          (newVal.length > 0 && existingVal.length === 0) ||  // New has value, existing empty
          (!existingId && newId) ||
          (newVal.length > existingVal.length) ||
          (action.timestamp > existing.action.timestamp && newVal.length >= existingVal.length);
        
        if (shouldReplace) {
          result[existingIndex] = { action, originalIndex: i };
        }
        continue;
      }
      
      result.push({ action, originalIndex: i });
    } else {
      result.push({ action, originalIndex: i });
    }
  }
  
  result.sort((a, b) => a.originalIndex - b.originalIndex);
  return result.map(item => item.action);
};

/**
 * Get improved description for display
 */
const getDisplayDescription = (action: RecordedAction): string => {
  if (!action) return '';
  
  const qword = action.qword || action.type?.toUpperCase() || 'ACTION';
  let description = action.description || '';
  const betterLabel = getDisplayLabel(action);
  
  // If description contains generic "element", replace it
  if (description.includes('"element"') || description.includes("'element'")) {
    description = description.replace(/"element"|'element'/g, `"${betterLabel}"`);
  }
  
  // If label is still "element", try harder
  if (betterLabel === 'element' || description.includes('Click "element"')) {
    const sel = action.selectorObj || (action as any).raw?.selectorObj || {};
    const element = (action as any).element || (action as any).raw?.element || {};
    const role = sel.role || element.role;
    const tag = sel.tagName || element.tagName || (action as any).raw?.tag;
    
    if (role) {
      description = `Click ${role}${tag ? ' (' + tag + ')' : ''}`;
    } else if (tag && tag !== 'element') {
      description = `Click ${tag}`;
    }
  }
  
  // If no description, build one
  if (!description || description === qword) {
    if (qword === 'Fill') {
      const value = action.displayArgs?.[1] || action.args?.[1] || '';
      const displayVal = typeof value === 'string' && value.length > 20 ? value.substring(0, 20) + '...' : value;
      description = `Fill "${betterLabel}": "${displayVal}"`;
    } else if (qword === 'GoTo') {
      description = `Navigate to ${action.args?.[0] || (action as any).url || ''}`;
    } else {
      description = `${qword.replace(/([A-Z])/g, ' $1').trim()} "${betterLabel}"`;
    }
  }
  
  return description;
};

// ═══════════════════════════════════════════════════════════════════════════════
// END DISPLAY HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

// ============================================================================
// ROBUST STEP NORMALIZER - Option B + C Implementation
// Normalizes steps before playback for consistent, reliable test execution
// ============================================================================

/**
 * Normalizes text by removing dynamic content that may change between recordings
 * - Strips trailing numbers (badge counts like "Cart 2" → "Cart")
 * - Strips leading/trailing whitespace
 * - Handles emojis and special characters
 */
const normalizeText = (text: string | undefined): string => {
  if (!text) return '';
  return text
    .replace(/\s*\d+\s*$/, '')           // Strip trailing numbers (badge counts)
    .replace(/^\s*\d+\s*/, '')           // Strip leading numbers
    // CRITICAL: Normalize apostrophe variants to straight apostrophe (don't strip them!)
    .replace(/[\u2018\u2019\u201B\u2032\u0060\u00B4]/g, "'")  // Curly apostrophes → straight
    .replace(/[\u201C\u201D\u201E\u201F\u2033]/g, '"')        // Curly quotes → straight
    // Only strip emojis (not ALL non-ASCII - that breaks apostrophes and accented chars)
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')  // Emojis in Misc Symbols and Pictographs
    .replace(/[\u{2600}-\u{26FF}]/gu, '')    // Misc symbols
    .replace(/[\u{2700}-\u{27BF}]/gu, '')    // Dingbats
    .replace(/\s+/g, ' ')                // Normalize whitespace
    .trim();
};

/**
 * Creates robust fallback selectors from a selectorObj
 * Prioritizes: data-testid > aria-label > role > text > css
 */
const createRobustSelectors = (selectorObj: any, description: string): string[] => {
  const selectors: string[] = [];
  
  // 1. HIGHEST PRIORITY: data-testid (most stable)
  if (selectorObj?.testId) {
    selectors.push(`[data-testid="${selectorObj.testId}"]`);
  }
  
  // 2. aria-label (accessibility, stable)
  if (selectorObj?.ariaLabel) {
    selectors.push(`[aria-label="${selectorObj.ariaLabel}"]`);
  }
  
  // 3. Role + name (semantic, robust)
  if (selectorObj?.role) {
    const role = selectorObj.role;
    const name = normalizeText(selectorObj.name || selectorObj.text);
    if (name) {
      selectors.push(`role=${role}[name="${name}"]`);
      selectors.push(`role=${role}[name*="${name}"]`); // Partial match
    } else {
      selectors.push(`role=${role}`);
    }
  }
  
  // 4. Original playwright selector (if valid)
  if (selectorObj?.playwright && !selectorObj.playwright.includes('undefined')) {
    selectors.push(selectorObj.playwright);
  }
  
  // 5. Text selector - NORMALIZED (strip numbers, emojis)
  const originalText = selectorObj?.text || '';
  const normalizedText = normalizeText(originalText);
  if (normalizedText && normalizedText.length > 1) {
    selectors.push(`text="${normalizedText}"`);
    selectors.push(`text=${normalizedText}`);  // Without quotes (partial match)
  }
  
  // 6. ID selector
  if (selectorObj?.id) {
    selectors.push(`#${selectorObj.id}`);
  }
  
  // 7. Name attribute
  if (selectorObj?.name) {
    selectors.push(`[name="${selectorObj.name}"]`);
  }
  
  // 8. CSS selector from selectorObj
  if (selectorObj?.selector && typeof selectorObj.selector === 'string') {
    selectors.push(selectorObj.selector);
  }
  
  // 9. Extract from description as last resort
  // "Click "Cart"" → text="Cart"
  const descMatch = description?.match(/["']([^"']+)["']/);
  if (descMatch && descMatch[1]) {
    const descText = normalizeText(descMatch[1]);
    if (descText && descText.length > 1 && !selectors.some(s => s.includes(descText))) {
      selectors.push(`text="${descText}"`);
    }
  }
  
  // 10. Include original fallbacks
  if (selectorObj?.fallbacks && Array.isArray(selectorObj.fallbacks)) {
    selectorObj.fallbacks.forEach((fb: any) => {
      if (fb?.playwright) selectors.push(fb.playwright);
      if (fb?.selector) selectors.push(fb.selector);
    });
  }
  
  // Deduplicate and filter empty
  return [...new Set(selectors)].filter(s => s && s.length > 0);
};

/**
 * Normalizes a single step for robust playback
 * DIRECTLY REPLACES selector fields so backend uses normalized values
 */
const normalizeStepForPlayback = (action: RecordedAction): RecordedAction => {
  const selectorObj = action.selectorObj || {};
  const description = action.description || '';
  
  // Create robust selectors
  const robustSelectors = createRobustSelectors(selectorObj, description);
  
  // Normalize the primary text - CRITICAL: this replaces the original
  const originalText = selectorObj.text || '';
  const normalizedText = normalizeText(originalText);
  
  // Normalize args[0] if it contains the element name (for click actions)
  const normalizedArgs = action.args ? [...action.args] : [];
  if (normalizedArgs[0] && typeof normalizedArgs[0] === 'string') {
    normalizedArgs[0] = normalizeText(normalizedArgs[0]);
  }
  
  // Build enhanced selectorObj - REPLACE original fields, not just add new ones
  const enhancedSelectorObj = {
    ...selectorObj,
    // REPLACE text with normalized version (backend uses this!)
    text: normalizedText || selectorObj.text,
    // REPLACE selector with normalized text selector
    selector: robustSelectors[0] || selectorObj.selector,
    // REPLACE playwright with best robust selector  
    playwright: robustSelectors[0] || selectorObj.playwright,
    // Store ALL fallbacks for backend to try
    fallbacks: robustSelectors.map(sel => ({
      playwright: sel,
      selector: sel
    })),
    // Keep original for debugging
    _originalText: originalText,
    _normalized: true
  };
  
  // Normalize the description - REPLACE dynamic numbers
  const normalizedDesc = description
    .replace(/["']([^"']+)["']/g, (match, text) => {
      const normalized = normalizeText(text);
      return normalized ? `"${normalized}"` : match;
    })
    .replace(/\s+/g, ' ')
    .trim();
  
  console.log(`[Normalize] "${originalText}" → "${normalizedText}", selectors:`, robustSelectors.slice(0, 3));
  
  return {
    ...action,
    args: normalizedArgs,
    selectorObj: enhancedSelectorObj,
    description: normalizedDesc,
    // Store original for debugging
    _original: {
      description: action.description,
      selectorObj: action.selectorObj,
      args: action.args
    }
  } as RecordedAction;
};

/**
 * Checks if an action is garbage/invalid (internal framework code, etc.)
 * These get accidentally captured sometimes and should be filtered out
 */
const isGarbageAction = (action: RecordedAction): boolean => {
  const desc = (action.description || '').toLowerCase();
  const text = (action.selectorObj?.text || '').toLowerCase();
  const arg0 = (action.args?.[0] || '').toString().toLowerCase();
  
  // Patterns that indicate garbage/internal framework captures
  const garbagePatterns = [
    /import\s*\{.*\}\s*from/i,           // ES6 imports
    /@react-refr/i,                       // React refresh
    /injectintoglobalhook/i,              // React internals
    /webpack/i,                           // Webpack internals
    /hot-update/i,                        // HMR
    /\[hmr\]/i,                           // Hot Module Replacement
    /__vite/i,                            // Vite internals
    /node_modules/i,                      // Node modules paths
    /sourcemappingurl/i,                  // Source maps
    /use strict/i,                        // JS directives
    /export\s*(default|const|function)/i, // ES6 exports
    /^function\s*\(/i,                    // Raw function code
    /^\(\s*\)\s*=>/i,                     // Arrow functions
  ];
  
  const allText = `${desc} ${text} ${arg0}`;
  
  for (const pattern of garbagePatterns) {
    if (pattern.test(allText)) {
      console.log(`[Normalize] FILTERED garbage action: "${desc.slice(0, 50)}..."`);
      return true;
    }
  }
  
  return false;
};

/**
 * Normalizes all steps before playback
 * - Filters out garbage/invalid actions
 * - Normalizes selectors for robust execution
 */
const normalizeStepsForPlayback = (actions: RecordedAction[]): RecordedAction[] => {
  return actions
    .filter(action => {
      // Remove garbage actions (React internals, imports, etc.)
      if (isGarbageAction(action)) {
        return false;
      }
      return true;
    })
    .map(action => {
      // Skip if already normalized
      if ((action.selectorObj as any)?._normalized) return action;
      
      // Only normalize click/input actions that have selectors
      const actionType = (action.qword || action.type || '').toLowerCase();
      const needsNormalization = ['click', 'fill', 'type', 'input', 'select', 'check', 'hover'].includes(actionType);
      
      if (needsNormalization) {
        return normalizeStepForPlayback(action);
      }
      
      return action;
    });
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
  const [capturedNetworkRequests, setCapturedNetworkRequests] = useState<any[]>([]);
  
  // Mobile device emulation - 50+ devices
  const [selectedMobileDevice, setSelectedMobileDevice] = useState<string>('desktop');
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
  
  // Device categories for organized dropdown
  const deviceCategories = {
    'Popular': [
      { id: 'iPhone 15 Pro Max', name: 'iPhone 15 Pro Max' },
      { id: 'iPhone 14 Pro', name: 'iPhone 14 Pro' },
      { id: 'Pixel 8', name: 'Pixel 8' },
      { id: 'Galaxy S24', name: 'Galaxy S24' },
      { id: 'iPad Pro 11', name: 'iPad Pro 11"' },
    ],
    'iOS - iPhone': [
      { id: 'iPhone 15 Pro Max', name: 'iPhone 15 Pro Max' },
      { id: 'iPhone 15 Pro', name: 'iPhone 15 Pro' },
      { id: 'iPhone 15', name: 'iPhone 15' },
      { id: 'iPhone 14 Pro Max', name: 'iPhone 14 Pro Max' },
      { id: 'iPhone 14 Pro', name: 'iPhone 14 Pro' },
      { id: 'iPhone 14', name: 'iPhone 14' },
      { id: 'iPhone 13 Pro Max', name: 'iPhone 13 Pro Max' },
      { id: 'iPhone 13 Pro', name: 'iPhone 13 Pro' },
      { id: 'iPhone 13', name: 'iPhone 13' },
      { id: 'iPhone 13 Mini', name: 'iPhone 13 Mini' },
      { id: 'iPhone 12 Pro Max', name: 'iPhone 12 Pro Max' },
      { id: 'iPhone 12 Pro', name: 'iPhone 12 Pro' },
      { id: 'iPhone 12', name: 'iPhone 12' },
      { id: 'iPhone SE (3rd Gen)', name: 'iPhone SE (3rd Gen)' },
      { id: 'iPhone SE', name: 'iPhone SE' },
      { id: 'iPhone 11', name: 'iPhone 11' },
    ],
    'iOS - iPad': [
      { id: 'iPad Pro 12.9', name: 'iPad Pro 12.9"' },
      { id: 'iPad Pro 11', name: 'iPad Pro 11"' },
      { id: 'iPad Air', name: 'iPad Air' },
      { id: 'iPad Mini', name: 'iPad Mini' },
      { id: 'iPad', name: 'iPad (10th Gen)' },
    ],
    'Android - Google Pixel': [
      { id: 'Pixel 8 Pro', name: 'Pixel 8 Pro' },
      { id: 'Pixel 8', name: 'Pixel 8' },
      { id: 'Pixel 7 Pro', name: 'Pixel 7 Pro' },
      { id: 'Pixel 7', name: 'Pixel 7' },
      { id: 'Pixel 6 Pro', name: 'Pixel 6 Pro' },
      { id: 'Pixel 6', name: 'Pixel 6' },
      { id: 'Pixel 5', name: 'Pixel 5' },
    ],
    'Android - Samsung Galaxy': [
      { id: 'Galaxy S24 Ultra', name: 'Galaxy S24 Ultra' },
      { id: 'Galaxy S24+', name: 'Galaxy S24+' },
      { id: 'Galaxy S24', name: 'Galaxy S24' },
      { id: 'Galaxy S23 Ultra', name: 'Galaxy S23 Ultra' },
      { id: 'Galaxy S23', name: 'Galaxy S23' },
      { id: 'Galaxy S22 Ultra', name: 'Galaxy S22 Ultra' },
      { id: 'Galaxy S21', name: 'Galaxy S21' },
      { id: 'Galaxy A54', name: 'Galaxy A54' },
      { id: 'Galaxy A34', name: 'Galaxy A34' },
      { id: 'Galaxy Tab S9', name: 'Galaxy Tab S9' },
      { id: 'Galaxy Tab S8', name: 'Galaxy Tab S8' },
    ],
    'Android - Other Brands': [
      { id: 'OnePlus 12', name: 'OnePlus 12' },
      { id: 'OnePlus 11', name: 'OnePlus 11' },
      { id: 'Xiaomi 14 Pro', name: 'Xiaomi 14 Pro' },
      { id: 'Redmi Note 13 Pro', name: 'Redmi Note 13 Pro' },
    ],
  };
  
  const networkPresets = [
    { id: 'none', name: 'No Throttling' },
    { id: '5G', name: '5G' },
    { id: '4G LTE', name: '4G LTE' },
    { id: '4G', name: '4G' },
    { id: '3G', name: '3G' },
    { id: 'Slow 3G', name: 'Slow 3G' },
    { id: '2G', name: '2G' },
  ];
  
  // Helper to get device display name
  const getDeviceName = (deviceId: string) => {
    if (deviceId === 'desktop') return 'Desktop';
    for (const category of Object.values(deviceCategories)) {
      const device = category.find(d => d.id === deviceId);
      if (device) return device.name;
    }
    return deviceId;
  };
  
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
  const TESTS_PER_PAGE = 50;
  
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
      // Silent fail — in-memory flow still works
    });
    
    // Also load flaky step data
    getFlakyStepsApi(currentTestId).then((flakySteps) => {
      if (flakySteps && flakySteps.length > 0) {
        const ids = new Set(flakySteps.filter(s => s.is_flaky).map(s => s.step_id));
        setFlakyStepIds(ids);
      }
    }).catch(() => {});
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
          
          toast.info(`Recording for step ${context.stepIndex + 1}: ${context.stepName}`, {
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
          
          toast.info(`🔄 Re-record Mode: Recording replacement for step ${context.stepIndex + 1}`, {
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
    
    toast.success(`Step ${currentStepIndex + 1} automated with recording`);
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
            console.log(`[Recorder] Removed duplicate unified entry: ${key}`);
          }
        } catch (e) {}
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
          console.log(`[Recorder] Updated test case ${updatedTestCase.id} in PostgreSQL backend`);
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
          console.log(`[Recorder] Updated test case ${updatedTestCase.id} in SQLite scale DB`);
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
      console.log('[Recorder] Merged test saved:', updatedTestCase.id, 'status:', automationStatus, 'steps:', updatedTestCase.steps?.length);
      console.log('[Recorder] Step details:', updatedTestCase.steps?.map((s, i) => ({
        idx: i,
        type: s.type,
        qword: s.qword,
        hasArgs: !!s.args,
        hasSelector: !!s.selector || !!s.selectorObj,
        name: s.name?.substring(0, 30)
      })));
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
          console.log(`[Recorder] Stopped: ${finalActions?.length} -> ${deduplicatedRecorded.length} deduplicated + ${manualActions.length} manual`);
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
        console.log(`[Recorder] Actions reordered, refreshing list (${reorderedActions.length} actions)`);
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
          console.log('[Record] BLOCKED garbage action:', action.description?.slice(0, 50));
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

  // Convert analyze() response (from PlaywrightRecorder) to SuggestResult format
  const convertAnalyzeToSuggestResult = (suggestions: any[]): SuggestResult => {
    const result: Suggestion[] = [];
    const counts: Record<string, number> = { buttons: 0, links: 0, inputs: 0, headings: 0 };
    
    suggestions.forEach((s, idx) => {
      const type = (s.type || '').toLowerCase();
      const label = s.label || s.text || s.description || s.element || '';
      
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
        // Preserve full selectorObj from analyze (includes text, inputType, placeholder, ariaLabel, name, id)
        selectorObj: s.selectorObj || { selector: s.selector, text: label },
        inputType: s.inputType,
        count: s.duplicateCount || s.count || 1
      });
    });
    
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
      return { fill: [], click: [], link: [], heading: [], other: [] };
    }
    
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
    return Object.values(categoryCounts).reduce((a, b) => a + b, 0);
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
    setCapturedNetworkRequests([]); // Clear previous network captures

    // Build capture options
    const captureNetwork = captureForLoadTest || captureForApiTest;

    try {
      let result;
      
      // Determine if we need mobile emulation
      const isMobile = selectedMobileDevice !== 'desktop';
      const mobileDevice = isMobile ? selectedMobileDevice : null; // Use device ID directly (matches mobile-devices.js keys)
      const mobileNetwork = isMobile && selectedNetwork !== 'none' ? selectedNetwork : null;
      
      if (electronAPI?.invoke && isMobile) {
        // Use invoke API for mobile emulation (passes device settings to main process)
        result = await electronAPI.invoke('playwright-recorder-start', {
          url,
          mobileDevice,
          mobileNetwork
        });
      } else if (flowstral?.playwrightRecorder) {
        // Standard desktop recording or mobile via preload
        if (isMobile && flowstral.mobile?.setDevice) {
          await flowstral.mobile.setDevice(mobileDevice, mobileNetwork);
        }
        result = await flowstral.playwrightRecorder.start(url, { captureNetwork });
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
        toast.success(`Recording started${mobileMsg}!${captureMsg}`);
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
        console.log(`[Recorder] Captured ${filteredRequests.length} network requests`);
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
            console.log(`[Recorder] Stop: ${recordedActions.length} -> ${deduplicatedRecorded.length} deduplicated`);
            return deduplicatedRecorded.length > 0 ? deduplicatedRecorded : prev;
          }
          
          // Remove any recorded that duplicate manual actions
          const manualDescriptions = new Set(manualActions.map(a => a.description));
          const recordedOnly = deduplicatedRecorded.filter(a => !manualDescriptions.has(a.description));
          
          // Combine and sort by timestamp
          const combined = [...recordedOnly, ...manualActions].sort((a, b) => 
            (a.timestamp || 0) - (b.timestamp || 0)
          );
          
          console.log(`[Recorder] Stop: ${recordedActions.length} -> ${recordedOnly.length} deduplicated + ${manualActions.length} manual`);
          return combined;
        });
      }
      
      const networkMsg = capturedNetworkRequests.length > 0 ? ` (${capturedNetworkRequests.length} HTTP requests)` : '';
      toast.success(`Recording stopped - ${actions.length} actions${networkMsg}`);
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
          
          console.log(`[Recorder Export] Fill ${i}: fieldName="${fieldName}" from args[0]="${action.args?.[0]}" fieldLabel="${(action as any).fieldLabel}"`);
          
          if (fieldName && fieldName !== 'input') {
            // Check if we've seen this field before
            const existingIdx = seenFillFields.get(fieldName);
            if (existingIdx !== undefined) {
              // Replace with this one (later fill has more complete value)
              console.log(`[Recorder Export] ★ DEDUPING fill for "${fieldName}" - replacing index ${existingIdx}`);
              deduplicatedActions[existingIdx] = action;
              continue; // Don't add again
            }
            seenFillFields.set(fieldName, deduplicatedActions.length);
            console.log(`[Recorder Export] First fill for "${fieldName}" at index ${deduplicatedActions.length}`);
          }
        }
        
        deduplicatedActions.push(action);
      }
      
      console.log(`[Recorder Export] Deduplicated: ${actions.length} -> ${deduplicatedActions.length} actions`);
      
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
      
      console.log('[Recorder] Exporting test case with', testCase.steps.length, 'steps');
      console.log('[Recorder] Tags:', testCase.tags);
      console.log('[Recorder] Network requests:', testCase.networkData?.length || 0);

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

  // ============ LOCK LOCATORS - Save the ACTUAL working selector ============
  // SIMPLE APPROACH: Use the selector that actually worked during the test run.
  // The backend now returns workingSelector in stepResults for each passed step.
  const handleLockLocators = () => {
    if (!testExecutionResult || testExecutionResult.status !== 'passed') {
      toast.error('Can only lock locators after a successful test run');
      return;
    }
    
    // Diagnostic: Log what stepResults look like BEFORE locking
    console.log('[LockLocators] stepResults:', JSON.stringify(
      testExecutionResult.stepResults?.map((r: any) => ({
        idx: r.index, status: r.status, ws: r.workingSelector || 'NONE', st: r.strategyType || '-'
      })), null, 2
    ));
    
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
            console.log(`[LockLocators] Step ${index + 1}: Navigate step (no selector needed)`);
          } else {
            console.log(`[LockLocators] Step ${index + 1}: No working selector returned, skipping`);
            skippedCount++;
          }
          return action;
        }
        
        console.log(`[LockLocators] Step ${index + 1}: Locking actual working selector → ${workingSelector}`);
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
          
          console.log(`[LockLocators] Auto-saved ${lockedCount} locked selectors to localStorage`);
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
    console.log('[Test] Normalized steps for robust playback:', normalizedActions.length);
    
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
        console.log('[Test] Step start:', data.stepIndex);
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
        console.log('[Test] Step complete:', data.stepIndex, data.success ? '✓' : '✗', isHealed ? '[HEALED]' : '', isSkipped ? '[SKIPPED]' : '', data.aiResolved ? `[AI: ${data.aiResolved}]` : '');

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
          console.log(`[Test] 🔧 Auto-healing step ${data.stepIndex + 1}: ${data.workingSelector}`);
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
          console.log(`[Test] ⏭️ Step ${data.stepIndex + 1} auto-skipped (non-critical)`);
        }

        // =========== SMART SUGGESTIONS ON TRUE FAILURE ===========
        // Only pause and show failure UI when step truly failed
        // (NOT when healed or skipped by resilient runtime)
        if (!data.success && !isHealed && !isSkipped) {
          console.log('[Test] ❌ Step failed - showing Smart Suggestions for quick fix');

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
        console.log(`[Test] 🔄 Step ${data.stepIndex + 1} healing in progress...`);
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
        console.log('[Test] 🚩 Paused at flagged step:', data.stepIndex, data.flagReason);
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
        console.log('[Test] ✅ Test complete event received:', data.success ? 'PASSED' : 'FAILED');
        
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
          toast.error(`❌ Test Failed: ${data.error || 'Step failed'}`, { duration: 5000 });
        }
      });
      eventCleanups.push(unsubComplete);
    }
    
    // Fallback: Poll-based progress tracking if no event listeners
    let progressInterval: NodeJS.Timeout | null = null;
    if (!flowstral?.on) {
      console.log('[Test] Using fallback progress polling (no flowstral.on)');
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
      
      console.log('[Test] Result:', result);
      
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
        console.log('[Test] 🚩 Test paused at flagged step:', flaggedStepIndex);
        
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
                  `🤖 AI detected Step ${failedStep.index + 1} may be a false positive: ${fpResult.reason}`,
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
        toast.success(`✅ Test Passed! (${actions.length} steps)`, { id: 'run' });
      } else {
        const browserMsg = result?.browserKeptOpen ? ' Browser kept open for debugging.' : '';
        toast.error(`❌ Test Failed: ${result?.error || 'Unknown error'}${browserMsg}`, { id: 'run' });
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
    toast.info('⏸️ Pause requested... waiting for current step to complete', { duration: 2000 });
    
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
    
    toast.success(`▶️ Resuming from step ${resumeFromStep + 1}...`, { duration: 1500 });
    
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
      toast.info(`⏭️ Skipped step ${pausedAtStep + 1}. Test complete.`, { duration: 2000 });
    } else {
      toast.info(`⏭️ Skipped step ${pausedAtStep + 1}, continuing from step ${nextStep + 1}...`, { duration: 1500 });
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
  
  // Handle when test stops at a false positive step - auto-open element picker
  const handleFalsePositiveStop = useCallback((stepIndex: number, actionId: string, screenshot: string | null) => {
    setStoppedAtFalsePositive({ stepIndex, actionId, screenshot });
    
    // Auto-open the step editor for this step
    setEditingActionIndex(stepIndex);
    setEditSelectorModalOpen(true);
    
    toast.info(
      '🎯 Stopped at flagged step. Click the correct element to fix it.',
      { duration: 5000 }
    );
  }, []);
  
  // Clear false positive stop state when step is fixed
  const handleFalsePositiveFixed = useCallback((actionId: string) => {
    setStoppedAtFalsePositive(null);
    // Remove from false positive list since it's now fixed
    unmarkFalsePositive(actionId);
    toast.success('✅ Step fixed! Run test again to continue.');
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
    toast.info(stepByStepMode ? '▶️ Continuous mode' : '⏯️ Step-by-step mode enabled', { duration: 1500 });
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
          toast.success(`✅ Step ${pausedAtStep + 1} passed`, { id: 'single-step' });
          
          // Auto-advance to next step if there are more
          if (pausedAtStep < actions.length - 1) {
            setPausedAtStep(pausedAtStep + 1);
            setEditingPausedStep({ ...actions[pausedAtStep + 1] });
          } else {
            // Test complete
            setTestExecutionResult(prev => prev ? { ...prev, status: 'passed' } : null);
            toast.success('🎉 All steps completed!', { duration: 3000 });
          }
        } else {
          toast.error(`❌ Step ${pausedAtStep + 1} failed: ${result?.error || 'Unknown error'}`, { id: 'single-step' });
        }
      } catch (error: any) {
        toast.error(`Failed: ${error?.message}`, { id: 'single-step' });
      }
    }
  }, [pausedAtStep, editingPausedStep, actions, testExecutionResult]);
  
  // ========== END PAUSE/RESUME/DEBUG HANDLERS ==========

  const getActionIcon = (qword: string, small = false) => {
    const size = small ? "h-3 w-3" : "h-4 w-4";
    const type = qword?.toLowerCase() || '';
    
    // Salesforce-specific action types
    if (type.startsWith('sf-navigate') || type.includes('navigateto')) return <Globe className={`${size} text-blue-400`} />;
    if (type === 'sf-global-search' || type.includes('search')) return <Search className={`${size} text-purple-400`} />;
    if (type === 'sf-app-launcher') return <LayoutGrid className={`${size} text-cyan-400`} />;
    if (type === 'sf-wait' || type.includes('wait')) return <RefreshCw className={`${size} text-amber-400`} />;
    if (type.startsWith('sf-click')) return <Hand className={`${size} text-emerald-400`} />;
    
    // Standard action types
    if (type.includes('goto') || type.includes('nav')) return <Globe className={`${size} text-blue-400`} />;
    if (type.includes('fill')) return <PenLine className={`${size} text-purple-400`} />;
    if (type.includes('click')) return <Hand className={`${size} text-emerald-400`} />;
    if (type.includes('assert')) return <Eye className={`${size} text-cyan-400`} />;
    if (type.includes('screenshot')) return <Eye className={`${size} text-pink-400`} />;
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
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-slate-900 p-6">
        <Card className="max-w-lg bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
          <CardContent className="pt-8 pb-8 px-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-r from-blue-600 to-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/20">
                <Download className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-3 text-foreground">Desktop App Required</h2>
              <p className="text-muted-foreground mb-6">
                The Smart Recorder requires the Flowstral Desktop app for browser automation capabilities.
              </p>
              
              {/* Steps */}
              <div className="text-left space-y-4 mb-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                <h3 className="font-semibold text-foreground text-sm uppercase tracking-wide">Quick Setup</h3>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Download Flowstral Desktop</p>
                    <p className="text-xs text-muted-foreground">One-click installer with bundled browser</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Install & Sign In</p>
                    <p className="text-xs text-muted-foreground">Use your existing account credentials</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="text-sm font-medium text-foreground">Click Record</p>
                    <p className="text-xs text-muted-foreground">Browser launches automatically, start recording!</p>
                  </div>
                </div>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-3 mb-8 text-left">
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-800/30">
                  <MousePointer className="w-4 h-4 text-amber-600 mb-1" />
                  <p className="text-xs font-medium text-foreground">Smart Element Recognition</p>
                </div>
                <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-100 dark:border-violet-800/30">
                  <Sparkles className="w-4 h-4 text-violet-600 mb-1" />
                  <p className="text-xs font-medium text-foreground">41+ Auto Suggestions</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg border border-emerald-100 dark:border-emerald-800/30">
                  <Cloud className="w-4 h-4 text-emerald-600 mb-1" />
                  <p className="text-xs font-medium text-foreground">Salesforce Metadata Aware</p>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/30">
                  <Wand2 className="w-4 h-4 text-blue-600 mb-1" />
                  <p className="text-xs font-medium text-foreground">One-Click Test Creation</p>
                </div>
              </div>

              {/* CTA */}
              <Button 
                onClick={() => navigate('/welcome')}
                className="w-full h-12 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/20"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Desktop App
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Available for Windows, macOS & Linux
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full bg-background text-foreground flex flex-col overflow-hidden">
      {/* ============ RE-RECORD BANNER (from Builder) ============ */}
      {showRerecordBanner && rerecordContext && (
        <div className="shrink-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 flex items-center justify-between">
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
              className="h-7 text-xs bg-white text-purple-600 hover:bg-white/90"
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
                  toast.success('Step recorded! Returning to builder...');
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
      <div className="h-12 min-h-[48px] shrink-0 bg-card border-b border-gray-200 dark:border-border flex items-center justify-between px-4 overflow-visible">
        <div className="flex items-center gap-2 shrink-0">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 rounded-full border border-red-500/30">
              <div className={cn("w-2 h-2 rounded-full", isPaused ? "bg-amber-500" : "bg-red-500 animate-pulse")} />
              <span className="text-xs text-foreground">Ready</span>
              <span className="text-xs text-muted-foreground">•</span>
              <span className="text-xs text-foreground">{actions.length} steps</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground">
            <Code className="h-3.5 w-3.5 mr-1.5" />
            Code
          </Button>
          {/* Run / Debug Dropdown */}
          <Popover open={showRunMenu} onOpenChange={setShowRunMenu}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-emerald-600 hover:bg-emerald-700"
                disabled={actions.length === 0}
              >
                <Play className="h-3.5 w-3.5 mr-1.5 fill-current" />
                Run
                <ChevronDown className="h-3 w-3 ml-1.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-1">
              <button
                onClick={() => handleRunTest(false, false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-emerald-500/20 text-left transition-colors"
              >
                <Play className="h-4 w-4 text-emerald-400" />
                <div>
                  <div className="font-medium">Run</div>
                  <div className="text-[10px] text-muted-foreground">Execute with saved state</div>
                </div>
              </button>
              <button
                onClick={() => handleRunTest(false, true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-cyan-500/20 text-left transition-colors"
              >
                <RotateCcw className="h-4 w-4 text-cyan-400" />
                <div>
                  <div className="font-medium">Fresh Run</div>
                  <div className="text-[10px] text-muted-foreground">Clean browser, no cache</div>
                </div>
              </button>
              <button
                onClick={() => handleRunTest(true, false)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded hover:bg-amber-500/20 text-left transition-colors"
              >
                <Bug className="h-4 w-4 text-amber-400" />
                <div>
                  <div className="font-medium">Debug</div>
                  <div className="text-[10px] text-muted-foreground">Pause, edit, step-by-step</div>
                </div>
              </button>
              
              {/* Separator */}
              <div className="h-px bg-border my-1" />
              
              {/* Playback Speed Selector */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-2 mb-1.5">
                  <Gauge className="h-4 w-4 text-purple-400" />
                  <span className="font-medium text-xs">Playback Speed</span>
                </div>
                <div className="flex gap-1">
                  {(['0.25x', '0.5x', '1x', '2x'] as const).map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setPlaybackSpeed(speed)}
                      className={cn(
                        "flex-1 px-2 py-1 text-[10px] rounded transition-colors",
                        playbackSpeed === speed 
                          ? "bg-purple-500/30 text-purple-300 border border-purple-500/50" 
                          : "bg-secondary/50 hover:bg-secondary text-muted-foreground"
                      )}
                    >
                      {speed}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Highlight Elements Toggle */}
              <div 
                className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50 rounded transition-colors"
                onClick={() => setHighlightElements(!highlightElements)}
              >
                <div className="flex items-center gap-2">
                  <Scan className="h-4 w-4 text-yellow-400" />
                  <div>
                    <div className="font-medium text-xs">Highlight Elements</div>
                    <div className="text-[10px] text-muted-foreground">Visual indicator during run</div>
                  </div>
                </div>
                <Switch
                  checked={highlightElements}
                  onCheckedChange={setHighlightElements}
                  className="ml-2"
                />
              </div>
              
              {/* Keep Browser Open Toggle */}
              <div 
                className="w-full flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-secondary/50 rounded transition-colors"
                onClick={() => setKeepBrowserOpenOnFailure(!keepBrowserOpenOnFailure)}
              >
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-400" />
                  <div>
                    <div className="font-medium text-xs">Keep Browser Open</div>
                    <div className="text-[10px] text-muted-foreground">On failure, for debugging</div>
                  </div>
                </div>
                <Switch
                  checked={keepBrowserOpenOnFailure}
                  onCheckedChange={setKeepBrowserOpenOnFailure}
                  className="ml-2"
                />
              </div>
            </PopoverContent>
          </Popover>
                    <Button
            onClick={handleExportToBuilder}
                      size="sm"
            className="h-8 px-4 text-xs bg-primary hover:bg-primary/90"
            disabled={actions.length === 0}
                    >
            <Layers className="h-3.5 w-3.5 mr-1.5" />
            Builder
                    </Button>
          {/* AI Test Generator - Generate tests automatically */}
          <Button
            onClick={() => setShowAIGenerator(true)}
            size="sm"
            className="h-8 px-3 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
            disabled={!isRecording}
            title="AI-powered test generation"
          >
            <Bot className="h-3.5 w-3.5 mr-1" />
            AI
          </Button>
          {/* AI Explorer Agent - Autonomous test discovery - ALWAYS ENABLED FOR TESTING */}
          <Button
            onClick={() => {
              console.log('[Explorer] Button clicked, isRecording:', isRecording);
              setShowAIExplorer(true);
            }}
            size="sm"
            className="h-8 px-3 text-xs bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            title="AI Agent: Autonomous exploration and test discovery"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Explorer
          </Button>
          {/* AI Flow Explorer - Full navigation graph discovery */}
          <Button
            onClick={() => {
              console.log('[FlowExplorer] Button clicked');
              setShowAIFlowExplorer(true);
            }}
            size="sm"
            className="h-8 px-3 text-xs bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700"
            title="AI Flow Explorer: Discover ALL flows, pages, and hidden elements"
          >
            <Network className="h-3.5 w-3.5 mr-1" />
            Flow Map
          </Button>
          {/* Quick API Test - show when API toggle is ON and has actions */}
          {captureForApiTest && !isRecording && actions.length > 0 && (
            <Button
              onClick={handleQuickApiTest}
              size="sm"
              className="h-8 px-3 text-xs bg-violet-600 hover:bg-violet-700"
              title={capturedNetworkRequests.length > 0 
                ? `Test ${capturedNetworkRequests.length} captured requests in API tab`
                : "Open API tab to test recorded endpoints"
              }
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              API {capturedNetworkRequests.length > 0 && `(${capturedNetworkRequests.length})`}
            </Button>
          )}
          {/* Quick Load Test - show when Load toggle is ON and has actions */}
          {captureForLoadTest && !isRecording && actions.length > 0 && (
            <Button
              onClick={handleQuickLoadTest}
              size="sm"
              className="h-8 px-3 text-xs bg-orange-600 hover:bg-orange-700"
              title={capturedNetworkRequests.length > 0
                ? `Load test ${capturedNetworkRequests.length} captured requests in Perf tab`
                : "Open Perf tab to load test recorded endpoints"
              }
            >
              <Activity className="h-3.5 w-3.5 mr-1" />
              Perf {capturedNetworkRequests.length > 0 && `(${capturedNetworkRequests.length})`}
            </Button>
          )}
          {capturedNetworkRequests.length > 0 && !isRecording && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs border-violet-500/50 text-violet-400 hover:bg-violet-500/20"
                onClick={exportCapturedAsPostman}
                title="Download captured requests as Postman Collection"
              >
                <Download className="h-3 w-3 mr-1" />
                Postman
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 text-xs border-amber-500/50 text-amber-400 hover:bg-amber-500/20"
                onClick={exportCapturedAsHAR}
                title="Download captured requests as HAR"
              >
                <Download className="h-3 w-3 mr-1" />
                HAR
              </Button>
            </>
          )}
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
      <div ref={containerRef} className="flex-1 flex overflow-hidden min-h-0">
        {/* ============ LEFT PANEL - URL & Recorded Steps ============ */}
        <div 
          style={{ width: `${leftPanelWidth}%` }} 
          className="min-w-[400px] max-w-[75%] flex flex-col border-r border-border overflow-hidden"
        >
          {/* URL Bar */}
          <div className="p-3 border-b border-border">
            {/* Device & Network Selection - Only show when NOT recording */}
            {!isRecording && (
              <div className="flex gap-2 mb-2">
                <Select value={selectedMobileDevice} onValueChange={setSelectedMobileDevice}>
                  <SelectTrigger className="h-8 w-[200px] text-xs">
                    {selectedMobileDevice === 'desktop' ? (
                      <Monitor className="h-3.5 w-3.5 mr-1.5" />
                    ) : (
                      <Smartphone className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    <SelectValue placeholder="Device">{getDeviceName(selectedMobileDevice)}</SelectValue>
                  </SelectTrigger>
                  <SelectContent className="max-h-[400px]">
                    <SelectItem value="desktop" className="text-xs">
                      <span className="flex items-center gap-2">🖥️ Desktop (Default)</span>
                    </SelectItem>
                    {Object.entries(deviceCategories).map(([category, devices]) => (
                      <div key={category}>
                        <div className="px-2 py-1.5 text-[10px] text-muted-foreground font-semibold bg-muted/50 sticky top-0">
                          {category} ({devices.length})
                        </div>
                        {devices.map(device => (
                          <SelectItem key={device.id} value={device.id} className="text-xs pl-4">
                            {category.includes('iOS') ? '📱' : '🤖'} {device.name}
                          </SelectItem>
                        ))}
                      </div>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedMobileDevice !== 'desktop' && (
                  <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <Wifi className="h-3.5 w-3.5 mr-1.5" />
                      <SelectValue placeholder="Network" />
                    </SelectTrigger>
                    <SelectContent>
                      {networkPresets.map(network => (
                        <SelectItem key={network.id} value={network.id} className="text-xs">
                          {network.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
                {selectedMobileDevice !== 'desktop' && (
                  <Badge variant="outline" className="h-8 px-2 text-[10px] bg-sky-500/10 text-sky-500 border-sky-500/30">
                    <Smartphone className="h-3 w-3 mr-1" />
                    Mobile Mode
                  </Badge>
                )}
              </div>
            )}
            
            {/* Show active device during recording */}
            {isRecording && selectedMobileDevice !== 'desktop' && (
              <div className="flex items-center gap-2 mb-2 p-2 bg-sky-500/10 rounded-lg border border-sky-500/30">
                <Smartphone className="h-4 w-4 text-sky-500" />
                <span className="text-xs text-sky-500 font-medium">
                  Recording on {getDeviceName(selectedMobileDevice)}
                </span>
                {selectedNetwork !== 'none' && (
                  <Badge variant="outline" className="text-[10px] h-5 bg-violet-500/10 text-violet-400 border-violet-500/30">
                    <Wifi className="h-3 w-3 mr-1" />
                    {networkPresets.find(n => n.id === selectedNetwork)?.name}
                  </Badge>
                )}
              </div>
            )}
            
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
            
            {/* Network Capture Toggles - Only show when NOT recording */}
            {!isRecording && (
              <div className="mt-2 p-2 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs text-muted-foreground mb-2">Also capture network traffic for:</p>
                <div className="flex gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="capture-load"
                      checked={captureForLoadTest}
                      onCheckedChange={setCaptureForLoadTest}
                      className="scale-75"
                    />
                    <Label htmlFor="capture-load" className="text-xs cursor-pointer flex items-center gap-1">
                      📊 Load Testing
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="capture-api"
                      checked={captureForApiTest}
                      onCheckedChange={setCaptureForApiTest}
                      className="scale-75"
                    />
                    <Label htmlFor="capture-api" className="text-xs cursor-pointer flex items-center gap-1">
                      🔌 API Testing
                    </Label>
                  </div>
                </div>
                {(captureForLoadTest || captureForApiTest) && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1">
                    ⚡ HTTP traffic will be captured during recording
                  </p>
                )}
              </div>
            )}
            
            {/* Show capture status during recording */}
            {isRecording && (captureForLoadTest || captureForApiTest) && (
              <div className="mt-2 p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/30">
                <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  Capturing network traffic ({capturedNetworkRequests.length} requests)
                  {captureForLoadTest && <Badge variant="outline" className="text-[10px] h-4">Load</Badge>}
                  {captureForApiTest && <Badge variant="outline" className="text-[10px] h-4">API</Badge>}
                </div>
              </div>
            )}
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
                  <Button
                    onClick={handleA11yScan}
                    disabled={isA11yScanning || !currentUrl}
                    variant="outline"
                    className={cn(
                      "h-10 px-3 border-blue-500/50 hover:bg-blue-500/10",
                      a11yIssues.length > 0 && a11yIssues.some(p => p.summary.total > 0)
                        ? "text-amber-400 border-amber-500/50"
                        : "text-blue-400"
                    )}
                    title="Scan current page for accessibility issues"
                  >
                    {isA11yScanning ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Accessibility className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 text-xs">A11y</span>
                    {a11yIssues.length > 0 && (
                      <Badge 
                        variant="secondary" 
                        className={cn(
                          "ml-1 h-5 min-w-5 px-1 text-xs",
                          a11yIssues.reduce((acc, p) => acc + p.summary.critical, 0) > 0
                            ? "bg-red-500/20 text-red-400"
                            : a11yIssues.reduce((acc, p) => acc + p.summary.serious, 0) > 0
                            ? "bg-orange-500/20 text-orange-400"
                            : "bg-blue-500/20 text-blue-400"
                        )}
                      >
                        {a11yIssues.reduce((acc, p) => acc + p.summary.total, 0)}
                      </Badge>
                    )}
                  </Button>
                  <Button
                    onClick={handleCaptureVisualCheckpoint}
                    disabled={isCapturingVisual || !currentUrl}
                    variant="outline"
                    className="h-10 px-3 border-violet-500/50 hover:bg-violet-500/10 text-violet-400"
                    title="Capture visual checkpoint for regression testing"
                  >
                    {isCapturingVisual ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                    <span className="ml-1.5 text-xs">Visual</span>
                    {visualCheckpoints > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="ml-1 h-5 min-w-5 px-1 text-xs bg-violet-500/20 text-violet-400"
                      >
                        {visualCheckpoints}
                      </Badge>
                    )}
                  </Button>
                </>
              )}
            </div>
            </div>

          {/* Compact Linking Status Bar - Only in 'existing' mode */}
          {mode === 'existing' && selectedTestCase && (
            <div className="border-b border-border bg-purple-500/5">
              {/* Compact Status Bar */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Automating:</span>
                  </div>
                  
                  {/* Progress indicator */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-purple-500/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-emerald-500 transition-all duration-300"
                        style={{ 
                          width: `${((Object.keys(stepLinks).length || Object.keys(stepAutomation).length) / (selectedTestCase.steps?.length || 1)) * 100}%` 
                        }}
                      />
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                      {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0}
                    </Badge>
                  </div>
                </div>
                
                {/* Quick action to open Automate tab */}
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setRightPanelTab('automate')}
                  className="h-7 px-3 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                >
                  <Layers className="h-3 w-3 mr-1.5" />
                  View All Steps
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
              
              {/* Current Step Indicator */}
              {selectedTestCase.steps && selectedTestCase.steps[currentStepIndex] && (
                <div className="px-4 py-2 bg-purple-500/10 border-t border-purple-500/20 flex items-center gap-3">
                  <div className="flex items-center justify-center w-6 h-6 rounded bg-purple-500 text-white text-xs font-bold">
                    {String(currentStepIndex + 1).padStart(2, '0')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-purple-200 truncate">
                      {selectedTestCase.steps[currentStepIndex].name || selectedTestCase.steps[currentStepIndex].description || `Step ${currentStepIndex + 1}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {stepLinks[currentStepIndex]?.actions.length 
                        ? `${stepLinks[currentStepIndex].actions.length} action(s) linked` 
                        : 'Select recorded actions to link'}
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => {
                      // Go to next unlinked step
                      const steps = selectedTestCase.steps || [];
                      for (let i = currentStepIndex + 1; i < steps.length; i++) {
                        if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
                          setCurrentStepIndex(i);
                          return;
                        }
                      }
                      // Wrap to beginning if no unlinked found
                      for (let i = 0; i < currentStepIndex; i++) {
                        if (!stepLinks[i] || stepLinks[i].actions.length === 0) {
                          setCurrentStepIndex(i);
                          return;
                        }
                      }
                    }}
                    className="h-6 px-2 text-xs text-purple-400 hover:bg-purple-500/20"
                  >
                    Next Step
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              )}
              
              {/* Recording for specific step context */}
              {recordForStepContext && (
                <div className="px-3 py-2 bg-blue-500/10 border-t border-blue-500/30">
                  <div className="flex items-center gap-2 text-xs">
                    <Video className="h-3 w-3 text-blue-400 animate-pulse" />
                    <span className="text-blue-300">
                      Recording for: <strong>{recordForStepContext.stepName}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recorded Steps Header */}
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Recorded Steps</span>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30 text-xs">
                {actions.length}
              </Badge>
              {selectedActionIndices.size > 0 && (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                  {selectedActionIndices.size} selected
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-1">
              {/* Multi-select toggle */}
              {actions.length > 0 && mode === 'existing' && selectedTestCase && (
                <Button
                  variant={isMultiSelectMode ? "default" : "ghost"}
                  size="sm"
                  onClick={() => {
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) {
                      setSelectedActionIndices(new Set());
                    }
                  }}
                  className={cn(
                    "h-6 px-2 text-xs",
                    isMultiSelectMode && "bg-purple-500 hover:bg-purple-600 text-white"
                  )}
                >
                  <CheckSquare className="h-3 w-3 mr-1" />
                  Select
                </Button>
              )}
              {actions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={handleClearActions} className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          
          {/* Multi-select action bar - shown when actions are selected */}
          {isMultiSelectMode && mode === 'existing' && selectedTestCase && (
            <div className="px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={selectAllActions}
                    className="h-6 px-2 text-xs border-purple-500/30 text-purple-400 hover:bg-purple-500/20"
                  >
                    Select All
                  </Button>
                  {selectedActionIndices.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearAllSelections}
                      className="h-6 px-2 text-xs text-muted-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {selectedActionIndices.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-purple-300">Link to:</span>
                    <Select 
                      value={String(currentStepIndex)} 
                      onValueChange={(v) => setCurrentStepIndex(parseInt(v))}
                    >
                      <SelectTrigger className="h-7 w-auto min-w-[120px] text-xs bg-purple-500/20 border-purple-500/30">
                        <SelectValue placeholder="Select step" />
                      </SelectTrigger>
                      <SelectContent>
                        {(selectedTestCase.steps || []).map((step: any, idx: number) => (
                          <SelectItem key={idx} value={String(idx)} className="text-xs">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-purple-400">{String(idx + 1).padStart(2, '0')}</span>
                              <span className="truncate max-w-[150px]">{step.name || step.description || `Step ${idx + 1}`}</span>
                              {stepLinks[idx]?.actions.length > 0 && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 ml-1">
                                  {stepLinks[idx].actions.length}
                                </Badge>
                              )}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      onClick={linkSelectedActionsToStep}
                      className="h-7 px-3 text-xs bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    >
                      <Link className="h-3 w-3 mr-1.5" />
                      Link {selectedActionIndices.size}
                    </Button>
                  </div>
                )}
              </div>
              {/* Range selection hint */}
              <p className="text-[10px] text-purple-300/70 mt-1">
                💡 Hold Shift+Click for range selection
              </p>
            </div>
          )}

          {/* Recorded Steps List */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full">
            {actions.length === 0 ? (
              <div className="text-center py-12 px-4 text-muted-foreground">
                <Video className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No actions recorded yet.</p>
                <p className="text-xs mt-1">Click 'Start Recording' to begin.</p>
              </div>
            ) : (
              <div className="px-2 pb-20 space-y-1"> {/* pb-20 for fixed footer space */}
                {actions.map((action, index) => {
                  // NOTE: Duplicate fills are now removed from the array itself (in setActions),
                  // so we no longer need display-only filtering here.
                  
                  // Apply masking for sensitive fields (passwords)
                  const displayAction = maskSensitiveAction(action);
                  const isPw = isPasswordField(action);
                  const isSelected = selectedActionIndex === index;
                  const isMultiSelected = selectedActionIndices.has(index);
                  const isNewlyAdded = index === actions.length - 1;
                  
                  return (
                  <div
                    key={action.id || `action_${index}_${action.timestamp}`}
                    draggable={!isMultiSelectMode}
                    onDragStart={() => !isMultiSelectMode && handleDragStart(index)}
                    onDragOver={(e) => !isMultiSelectMode && handleDragOver(e, index)}
                    onDragEnd={() => !isMultiSelectMode && handleDragEnd()}
                    onClick={(e) => {
                      if (isMultiSelectMode) {
                        toggleActionSelection(index, e);
                      } else {
                        setSelectedActionIndex(isSelected ? null : index);
                      }
                    }}
                    className={cn(
                      "flex items-center gap-2 p-2.5 rounded-lg bg-card hover:bg-accent border group cursor-pointer transition-all",
                      !isMultiSelectMode && "active:cursor-grabbing",
                      isSelected && !isMultiSelectMode && "border-primary bg-primary/10 ring-1 ring-primary/30",
                      isMultiSelected && "border-purple-500 bg-purple-500/20 ring-1 ring-purple-500/30",
                      draggedIndex === index && "opacity-50 border-cyan-500/50",
                      dragOverIndex === index && draggedIndex !== index && "border-cyan-500 bg-cyan-500/10",
                      !isSelected && !isMultiSelected && draggedIndex === null && "border-transparent hover:border-white/5",
                      isNewlyAdded && !isMultiSelectMode && "animate-pulse-once"
                    )}
                  >
                    {/* Checkbox for multi-select mode */}
                    {isMultiSelectMode ? (
                      <div 
                        className={cn(
                          "w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors",
                          isMultiSelected 
                            ? "bg-purple-500 border-purple-500" 
                            : "border-muted-foreground/50 hover:border-purple-400"
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleActionSelection(index, e);
                        }}
                      >
                        {isMultiSelected && <Check className="h-3 w-3 text-white" />}
                      </div>
                    ) : (
                      /* Drag handle */
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
                    )}
                    <div className={cn(
                      "flex items-center justify-center w-6 h-6 rounded text-xs font-mono shrink-0",
                      isMultiSelected ? "bg-purple-500/30 text-purple-300" : "bg-white/5 text-muted-foreground"
                    )}>
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    {getActionIcon(action.qword || action.type || '')}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm text-foreground truncate flex-1 min-w-0">
                          {getDisplayDescription(displayAction)}
                          {isPw && <span className="ml-1 text-primary">🔒</span>}
                          {isCrossOriginAction(action) && (
                            <span className="ml-1 text-yellow-500">⚠️</span>
                          )}
                          {/* Flagged step indicator (false positive or wrong element) */}
                          {action.id && falsePositiveSteps.has(action.id) && (
                            <span
                              className={cn(
                                "ml-1 px-1.5 py-0.5 text-[10px] rounded border",
                                falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element')
                                  ? "bg-red-500/20 text-red-400 border-red-500/30"
                                  : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                              )}
                              title={falsePositiveSteps.get(action.id)?.reason || "Flagged — test will stop here for fixing"}
                            >
                              🚩 {falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element') ? 'Wrong Element' : 'Flagged'}
                            </span>
                          )}
                        </p>
                        {/* Confidence indicator - shows when confidence is not HIGH or multiple matches */}
                        <StepConfidenceIndicator
                          confidence={action.confidence}
                          matchAnalysis={action.matchAnalysis}
                        />
                      </div>
                      {isCrossOriginAction(action) ? (
                        <p className="text-xs text-yellow-500/80 truncate">
                          {(action as any).userActions?.length > 0 
                            ? `${(action as any).userActions.length} action(s) defined`
                            : 'Click to add selectors'}
                        </p>
                      ) : displayAction.args?.[0] && (
                        <p className="text-xs text-muted-foreground truncate">
                          {isPw ? `${displayAction.args[0]} → ••••••••` : displayAction.args.join(' → ')}
                        </p>
                      )}
                    </div>
                    {/* ============ ACTION BUTTONS - Always visible ============ */}
                    <div className="flex items-center gap-1 shrink-0 ml-auto pl-2">
                      {/* Edit button for cross-origin actions */}
                      {isCrossOriginAction(action) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-[10px] bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCrossOriginIndex(index);
                            setCrossOriginUserActions((action as any).userActions || []);
                            setShowCrossOriginEditor(true);
                          }}
                        >
                          <PenLine className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                      )}
                      {/* Quick link button - shown when hovering in existing mode */}
                      {mode === 'existing' && selectedTestCase && !isMultiSelectMode && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            linkActionToStep(currentStepIndex, action, 'recorded');
                            // Remove from actions list after linking
                            setActions(prev => prev.filter((_, i) => i !== index));
                          }}
                          title={`Link to Step ${currentStepIndex + 1}`}
                        >
                          <Link className="h-3 w-3 mr-0.5" />
                          <span className="text-[10px]">{currentStepIndex + 1}</span>
                        </Button>
                      )}
                      {/* COPY SELECTOR BUTTON - Quick copy for debugging */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-foreground hover:bg-secondary/50 opacity-0 group-hover:opacity-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          const selector = action.selectorObj?.manualOverride || 
                                          action.selectorObj?.primary || 
                                          action.selectorObj?.selector || 
                                          action.selector || '';
                          if (selector) {
                            navigator.clipboard.writeText(selector);
                            toast.success('Selector copied!', { duration: 1500 });
                          } else {
                            toast.error('No selector to copy');
                          }
                        }}
                        title="Copy selector to clipboard"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {/* EDIT SELECTOR BUTTON - Manual Override - Always visible */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditSelectorModal(index);
                        }}
                        title="Edit step - Modify selector or value"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      {/* DELETE BUTTON - Always visible */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          const actionName = action.description || action.qword || 'step';
                          setActions(prev => prev.filter((_, i) => i !== index));
                          // Also remove from selection if multi-selected
                          if (selectedActionIndices.has(index)) {
                            setSelectedActionIndices(prev => {
                              const newSet = new Set(prev);
                              newSet.delete(index);
                              // Adjust indices for items after the deleted one
                              const adjusted = new Set<number>();
                              newSet.forEach(i => adjusted.add(i > index ? i - 1 : i));
                              return adjusted;
                            });
                          }
                          toast.success(`Deleted: ${actionName}`);
                        }}
                        title="Delete step"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  );
                })}
                {/* Auto-scroll target */}
                <div ref={actionsEndRef} />
              </div>
            )}
            </ScrollArea>
          </div>
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
                <TabsTrigger value="sftools" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400">
                  <Cloud className="h-3 w-3 mr-1" />
                  SF Tools
                </TabsTrigger>
                <TabsTrigger value="sfcontext" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                  <Target className="h-3 w-3 mr-1" />
                  SF Context
                </TabsTrigger>
                <TabsTrigger value="a11y" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400">
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
                  <TabsTrigger value="automate" className="h-7 px-2.5 text-[11px] data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400">
                    <Link2 className="h-3 w-3 mr-1" />
                    Automate
                    <Badge className="ml-1 h-4 bg-purple-500/30 text-purple-400 text-[9px] px-1">
                      {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0}
                    </Badge>
                  </TabsTrigger>
                )}
              </TabsList>
            </div>

            {/* ========== SUGGESTIONS TAB ========== */}
            <TabsContent value="suggestions" className="flex-1 m-0 p-0 flex flex-col overflow-hidden data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              {/* REPLACE MODE BANNER - shown when fixing a step */}
              {editingActionIndex !== null && (
                <div className="px-3 py-2 bg-orange-500/10 border-b border-orange-500/30 flex items-center gap-2">
                  <RefreshCw className="h-4 w-4 text-orange-400" />
                  <span className="text-sm font-medium text-orange-400">
                    Replace Mode: Click an element to replace Step {editingActionIndex + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-auto h-6 px-2 text-[10px] text-orange-400 hover:bg-orange-500/20"
                    onClick={() => {
                      setEditingActionIndex(null);
                      setEditSelectorModalOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              )}
              
              {/* Compact Header Row */}
              <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
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
              <div className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap sticky top-[42px] bg-card z-10">
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
                            title={s.category === 'input' ? 'Click to highlight input on page' : 'Execute action on page'}
                          >
                            <Play className="h-3 w-3" />
                      </Button>
                      {/* Show REPLACE button when fixing a step, otherwise show ADD button */}
                      {editingActionIndex !== null ? (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={() => replaceStepWithSuggestion(editingActionIndex, s)}
                            title={`Replace step ${editingActionIndex + 1} with this element`}
                          >
                            <RefreshCw className="h-3 w-3" />
                        </Button>
                      ) : (
                      <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                            onClick={() => addToTest(s)}
                            title={s.category === 'input' ? 'Add fill step (will prompt for value)' : 'Add to test steps'}
                          >
                            <Plus className="h-3 w-3" />
                      </Button>
                      )}
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
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
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
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                    )}
                  >
                    <Zap className="h-3.5 w-3.5" />
                    Quick
                  </button>
                  <button
                    onClick={() => setSfToolsSubTab('testhelpers')}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-all border-b-2",
                      sfToolsSubTab === 'testhelpers' 
                        ? "bg-green-500/10 text-green-400 border-green-500" 
                        : "text-muted-foreground hover:text-foreground hover:bg-accent border-transparent"
                    )}
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Test
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
                      className="h-8 text-xs bg-input border-blue-500/20 text-foreground font-mono"
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
                    <div className="mt-2 bg-input rounded border border-blue-500/20 max-h-32 overflow-auto">
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
                      className="h-7 text-xs bg-input border-purple-500/20 text-foreground font-mono"
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
                    <div className="mt-2 bg-input rounded border border-purple-500/20 max-h-40 overflow-auto">
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

                {/* Test Helpers Sub-tab - Navigation & Record Operations */}
                {sfToolsSubTab === 'testhelpers' && (
                  <ScrollArea className="h-full">
                    <div className="p-2 space-y-3">
                      
                      {/* ===== NAVIGATE TO RECORD BY ID ===== */}
                      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-2.5">
                        <h4 className="text-[10px] font-medium text-green-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <MapPin className="h-3 w-3" />
                          Navigate to Record by ID
                        </h4>
                        <div className="flex gap-1.5">
                          <Input
                            value={sfToolInput}
                            onChange={(e) => setSfToolInput(e.target.value)}
                            placeholder="Enter Record ID (e.g., 001xxx, 003xxx)"
                            className="h-8 text-xs bg-input border-green-500/20 text-foreground font-mono flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 bg-green-600 hover:bg-green-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!sfToolInput.trim()) {
                                toast.error('Please enter a Record ID');
                                return;
                              }
                              const recordId = sfToolInput.trim();
                              // Determine object type from ID prefix
                              const prefix = recordId.substring(0, 3);
                              const prefixMap: Record<string, string> = {
                                '001': 'Account', '003': 'Contact', '006': 'Opportunity', '00Q': 'Lead',
                                '500': 'Case', '00T': 'Task', '00U': 'Event', '005': 'User',
                                '701': 'Campaign', '01t': 'Product2', '0Q0': 'Quote', '800': 'Contract'
                              };
                              const objectType = prefixMap[prefix] || 'sObject';
                              // Construct Lightning URL path - this will be appended to the base URL during execution
                              const lightningPath = `/lightning/r/${objectType}/${recordId}/view`;
                              const action: RecordedAction = {
                                id: `nav_${Date.now()}`,
                                qword: 'NavigateToRecordById',
                                args: [recordId, objectType, lightningPath],
                                description: `Navigate to ${objectType}: ${recordId}`,
                                timestamp: Date.now(),
                                type: 'sf-navigate-record'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success(`Added: Navigate to ${objectType} ${recordId}`);
                              setSfToolInput('');
                            }}
                          >
                            <Compass className="h-3.5 w-3.5 mr-1" />
                            Add Step
                          </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1.5">
                          Supports: Account (001), Contact (003), Opportunity (006), Lead (00Q), Case (500), User (005), and more
                        </p>
                      </div>

                      {/* ===== NAVIGATE VIA SOQL ===== */}
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-2.5">
                        <h4 className="text-[10px] font-medium text-cyan-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Database className="h-3 w-3" />
                          Navigate via SOQL Query
                        </h4>
                        <div className="space-y-2">
                          <Select value={sfToolInput2 || 'Account'} onValueChange={setSfToolInput2}>
                            <SelectTrigger className="h-7 text-xs bg-input border-cyan-500/20">
                              <SelectValue placeholder="Select Object" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Account">Account</SelectItem>
                              <SelectItem value="Contact">Contact</SelectItem>
                              <SelectItem value="Opportunity">Opportunity</SelectItem>
                              <SelectItem value="Lead">Lead</SelectItem>
                              <SelectItem value="Case">Case</SelectItem>
                              <SelectItem value="User">User</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input
                            value={sfToolInput3}
                            onChange={(e) => setSfToolInput3(e.target.value)}
                            placeholder="WHERE clause (e.g., Name = 'Acme Corp')"
                            className="h-8 text-xs bg-input border-cyan-500/20 text-foreground font-mono"
                          />
                          <Button
                            size="sm"
                            className="w-full h-8 bg-cyan-600 hover:bg-cyan-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const objectType = sfToolInput2 || 'Account';
                              const whereClause = sfToolInput3.trim();
                              // Construct SOQL query
                              const soqlQuery = whereClause 
                                ? `SELECT Id FROM ${objectType} WHERE ${whereClause} LIMIT 1`
                                : `SELECT Id FROM ${objectType} LIMIT 1`;
                              const action: RecordedAction = {
                                id: `soqlnav_${Date.now()}`,
                                qword: 'NavigateToRecordBySOQL',
                                args: [objectType, soqlQuery],
                                description: `Query ${objectType} and navigate to result`,
                                timestamp: Date.now(),
                                type: 'sf-navigate-soql'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success(`Added: Navigate to ${objectType} via SOQL`);
                              setSfToolInput3('');
                            }}
                          >
                            <Database className="h-3.5 w-3.5 mr-1.5" />
                            Add SOQL Navigate Step
                          </Button>
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-1.5">
                          Runs SOQL query to get record ID, then navigates to that record.
                        </p>
                      </div>

                      {/* ===== QUICK OBJECT NAVIGATION ===== */}
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1 flex items-center gap-1.5">
                          <Navigation className="h-3 w-3" />
                          Quick Navigate - Sales Objects
                        </h4>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { name: 'Accounts', obj: 'Account', icon: Building2, color: 'blue' },
                            { name: 'Contacts', obj: 'Contact', icon: Contact, color: 'green' },
                            { name: 'Opportunities', obj: 'Opportunity', icon: Briefcase, color: 'yellow' },
                            { name: 'Leads', obj: 'Lead', icon: Users, color: 'purple' },
                            { name: 'Campaigns', obj: 'Campaign', icon: Target, color: 'pink' },
                            { name: 'Products', obj: 'Product2', icon: FileBox, color: 'cyan' },
                            { name: 'Quotes', obj: 'Quote', icon: FileText, color: 'orange' },
                            { name: 'Contracts', obj: 'Contract', icon: FileText, color: 'teal' }
                          ].map(({ name, obj, icon: Icon, color }) => (
                            <Button
                              key={name}
                              variant="outline"
                              size="sm"
                              className={`h-9 text-[9px] border-border hover:border-${color}-500/50 hover:bg-${color}-500/5 flex-col gap-0.5 justify-center`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const lightningPath = `/lightning/o/${obj}/list`;
                                const action: RecordedAction = {
                                  id: `nav_${Date.now()}`,
                                  qword: 'NavigateToObjectList',
                                  args: [obj, lightningPath],
                                  description: `Navigate to ${name} list view`,
                                  timestamp: Date.now(),
                                  type: 'sf-navigate-list'
                                };
                                setActions(prev => [...prev, action]);
                                toast.success(`Added: Navigate to ${name}`);
                              }}
                            >
                              <Icon className="h-3.5 w-3.5" />
                              {name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* ===== SERVICE & ADMIN NAVIGATION ===== */}
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                          Quick Navigate - Service & Admin
                        </h4>
                        <div className="grid grid-cols-4 gap-1">
                          {[
                            { name: 'Cases', obj: 'Case' },
                            { name: 'Tasks', obj: 'Task' },
                            { name: 'Events', obj: 'Event' },
                            { name: 'Reports', obj: 'Report' },
                            { name: 'Dashboards', obj: 'Dashboard' },
                            { name: 'Files', obj: 'ContentDocument' },
                            { name: 'Users', obj: 'User' },
                            { name: 'Setup', obj: 'SetupOneHome' }
                          ].map(({ name, obj }) => (
                            <Button
                              key={name}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[9px] border-border hover:bg-accent"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const lightningPath = name === 'Setup' 
                                  ? '/lightning/setup/SetupOneHome/home'
                                  : `/lightning/o/${obj}/list`;
                                const action: RecordedAction = {
                                  id: `nav_${Date.now()}`,
                                  qword: 'NavigateToObjectList',
                                  args: [obj, lightningPath],
                                  description: `Navigate to ${name}`,
                                  timestamp: Date.now(),
                                  type: 'sf-navigate-list'
                                };
                                setActions(prev => [...prev, action]);
                                toast.success(`Added: Navigate to ${name}`);
                              }}
                            >
                              {name}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* ===== QUICK CREATE RECORDS ===== */}
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-2.5">
                        <h4 className="text-[10px] font-medium text-blue-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Plus className="h-3 w-3" />
                          Quick Create Record
                        </h4>
                        <div className="grid grid-cols-3 gap-1.5">
                          {[
                            { name: 'Account', prefix: '001', color: 'blue' },
                            { name: 'Contact', prefix: '003', color: 'green' },
                            { name: 'Opportunity', prefix: '006', color: 'yellow' },
                            { name: 'Lead', prefix: '00Q', color: 'purple' },
                            { name: 'Case', prefix: '500', color: 'red' },
                            { name: 'Task', prefix: '00T', color: 'cyan' }
                          ].map(({ name, prefix, color }) => (
                            <Button
                              key={name}
                              variant="outline"
                              size="sm"
                              className={`h-10 text-[10px] border-border hover:border-${color}-500/50 hover:bg-${color}-500/5 flex-col gap-0.5 justify-center`}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const lightningPath = `/lightning/o/${name}/new`;
                                const action: RecordedAction = {
                                  id: `create_${Date.now()}`,
                                  qword: 'NavigateToNewRecord',
                                  args: [name, lightningPath],
                                  description: `Create New ${name}`,
                                  timestamp: Date.now(),
                                  type: 'sf-navigate-new'
                                };
                                setActions(prev => [...prev, action]);
                                toast.success(`Added: Create New ${name}`);
                              }}
                            >
                              <Plus className="h-3 w-3" />
                              New {name}
                            </Button>
                          ))}
                        </div>
                        <p className="text-[9px] text-muted-foreground mt-2">
                          These steps navigate to the New record form. Use recording to capture field inputs.
                        </p>
                      </div>

                      {/* ===== GLOBAL SEARCH ===== */}
                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-2.5">
                        <h4 className="text-[10px] font-medium text-purple-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Search className="h-3 w-3" />
                          Global Search
                        </h4>
                        <div className="flex gap-1.5">
                          <Input
                            value={sfToolInput}
                            onChange={(e) => setSfToolInput(e.target.value)}
                            placeholder="Enter search term..."
                            className="h-8 text-xs bg-input border-purple-500/20 text-foreground flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-8 px-3 bg-purple-600 hover:bg-purple-700"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const searchTerm = sfToolInput.trim();
                              if (!searchTerm) {
                                toast.error('Please enter a search term');
                                return;
                              }
                              const action: RecordedAction = {
                                id: `gsearch_${Date.now()}`,
                                qword: 'SalesforceGlobalSearch',
                                args: [searchTerm],
                                description: `Global search for: "${searchTerm}"`,
                                timestamp: Date.now(),
                                type: 'sf-global-search'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success(`Added: Global search "${searchTerm}"`);
                              setSfToolInput('');
                            }}
                          >
                            <Search className="h-3.5 w-3.5 mr-1" />
                            Add Step
                          </Button>
                        </div>
                      </div>

                      {/* ===== COMMON TEST WORKFLOWS ===== */}
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-lg p-2.5">
                        <h4 className="text-[10px] font-medium text-orange-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <Route className="h-3 w-3" />
                          Common Test Workflows (Multi-Step)
                        </h4>
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { name: 'Account', obj: 'Account', icon: Building2 },
                            { name: 'Contact', obj: 'Contact', icon: Contact },
                            { name: 'Opportunity', obj: 'Opportunity', icon: Briefcase },
                            { name: 'Case', obj: 'Case', icon: FileBox }
                          ].map(({ name, obj, icon: Icon }) => (
                            <Button
                              key={name}
                              variant="outline"
                              size="sm"
                              className="h-11 text-[10px] border-border hover:border-orange-500/50 hover:bg-orange-500/5 flex-col gap-0.5 justify-center"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const now = Date.now();
                                const steps: RecordedAction[] = [
                                  { 
                                    id: `flow_${now}_1`, 
                                    qword: 'NavigateToObjectList', 
                                    args: [obj, `/lightning/o/${obj}/list`], 
                                    description: `Navigate to ${name}s list`, 
                                    timestamp: now, 
                                    type: 'sf-navigate-list' 
                                  },
                                  { 
                                    id: `flow_${now}_2`, 
                                    qword: 'NavigateToNewRecord', 
                                    args: [obj, `/lightning/o/${obj}/new`], 
                                    description: `Open New ${name} form`, 
                                    timestamp: now + 1, 
                                    type: 'sf-navigate-new' 
                                  },
                                  { 
                                    id: `flow_${now}_3`, 
                                    qword: 'WaitForSalesforceReady', 
                                    args: ['3000'], 
                                    description: 'Wait for form to load', 
                                    timestamp: now + 2, 
                                    type: 'sf-wait' 
                                  }
                                ];
                                setActions(prev => [...prev, ...steps]);
                                toast.success(`Added: Create ${name} workflow (3 steps)`);
                              }}
                            >
                              <Icon className="h-4 w-4 text-orange-400" />
                              <span>Create {name}</span>
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* ===== RECORD TABS NAVIGATION ===== */}
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                          Navigate Record Tabs
                        </h4>
                        <div className="grid grid-cols-5 gap-1">
                          {['Details', 'Related', 'Activity', 'News', 'Chatter'].map(tab => (
                            <Button
                              key={tab}
                              variant="outline"
                              size="sm"
                              className="h-7 text-[9px] border-border hover:bg-accent"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                const action: RecordedAction = {
                                  id: `tab_${Date.now()}`,
                                  qword: 'ClickRecordTab',
                                  args: [tab],
                                  description: `Click ${tab} tab`,
                                  timestamp: Date.now(),
                                  type: 'sf-click-tab'
                                };
                                setActions(prev => [...prev, action]);
                                toast.success(`Added: Click ${tab} tab`);
                              }}
                            >
                              {tab}
                            </Button>
                          ))}
                        </div>
                      </div>

                      {/* ===== UTILITY ACTIONS ===== */}
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                          Utility Actions
                        </h4>
                        <div className="grid grid-cols-4 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `util_${Date.now()}`,
                                qword: 'OpenAppLauncher',
                                args: [],
                                description: 'Open App Launcher',
                                timestamp: Date.now(),
                                type: 'sf-app-launcher'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Open App Launcher');
                            }}
                          >
                            <LayoutGrid className="h-3 w-3" />
                            App Launcher
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `util_${Date.now()}`,
                                qword: 'OpenGlobalSearch',
                                args: [],
                                description: 'Open Global Search',
                                timestamp: Date.now(),
                                type: 'sf-open-search'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Open Global Search');
                            }}
                          >
                            <Search className="h-3 w-3" />
                            Search
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `util_${Date.now()}`,
                                qword: 'WaitForSalesforceReady',
                                args: ['3000'],
                                description: 'Wait 3 seconds',
                                timestamp: Date.now(),
                                type: 'sf-wait'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Wait 3 seconds');
                            }}
                          >
                            <RefreshCw className="h-3 w-3" />
                            Wait 3s
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `util_${Date.now()}`,
                                qword: 'TakeScreenshot',
                                args: [`screenshot_${Date.now()}.png`],
                                description: 'Take screenshot',
                                timestamp: Date.now(),
                                type: 'screenshot'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Take screenshot');
                            }}
                          >
                            <Eye className="h-3 w-3" />
                            Screenshot
                          </Button>
                        </div>
                      </div>

                      {/* ===== SAVE/EDIT/DELETE ACTIONS ===== */}
                      <div>
                        <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1.5 px-1">
                          Record Actions
                        </h4>
                        <div className="grid grid-cols-4 gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:border-green-500/50 hover:bg-green-500/5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `rec_${Date.now()}`,
                                qword: 'ClickSaveButton',
                                args: [],
                                description: 'Click Save button',
                                timestamp: Date.now(),
                                type: 'sf-click-save'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Click Save');
                            }}
                          >
                            <Save className="h-3 w-3 mr-1 text-green-400" />
                            Save
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:border-blue-500/50 hover:bg-blue-500/5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `rec_${Date.now()}`,
                                qword: 'ClickEditButton',
                                args: [],
                                description: 'Click Edit button',
                                timestamp: Date.now(),
                                type: 'sf-click-edit'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Click Edit');
                            }}
                          >
                            <PenLine className="h-3 w-3 mr-1 text-blue-400" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:border-red-500/50 hover:bg-red-500/5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `rec_${Date.now()}`,
                                qword: 'ClickDeleteButton',
                                args: [],
                                description: 'Click Delete button',
                                timestamp: Date.now(),
                                type: 'sf-click-delete'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Click Delete');
                            }}
                          >
                            <Trash2 className="h-3 w-3 mr-1 text-red-400" />
                            Delete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] border-border hover:border-purple-500/50 hover:bg-purple-500/5"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const action: RecordedAction = {
                                id: `rec_${Date.now()}`,
                                qword: 'ClickCloneButton',
                                args: [],
                                description: 'Click Clone button',
                                timestamp: Date.now(),
                                type: 'sf-click-clone'
                              };
                              setActions(prev => [...prev, action]);
                              toast.success('Added: Click Clone');
                            }}
                          >
                            <Copy className="h-3 w-3 mr-1 text-purple-400" />
                            Clone
                          </Button>
                        </div>
                      </div>

                    </div>
                  </ScrollArea>
                )}
                {/* End Test Helpers Sub-tab */}
                
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
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Click', args: ['Global Search'], description: 'Click Global Search', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <Search className="h-3 w-3" />Search
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Click', args: ['App Launcher'], description: 'Click App Launcher', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <LayoutGrid className="h-3 w-3" />Apps
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
                      onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'Wait', args: ['2000'], description: 'Wait 2 seconds', timestamp: Date.now() }]); toast.success('Added'); }}>
                      <RefreshCw className="h-3 w-3" />Wait
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 text-[9px] border-border hover:bg-accent flex-col gap-0 p-0.5"
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
                      <Button key={obj} variant="outline" size="sm" className="h-6 text-[9px] border-border hover:bg-accent"
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
                      <Button key={obj} variant="outline" size="sm" className="h-6 text-[9px] border-border hover:bg-accent"
                        onClick={() => { setActions(prev => [...prev, { id: `action_${Date.now()}`, qword: 'NavigateTo', args: [obj], description: `Navigate to ${obj}`, timestamp: Date.now() }]); toast.success(`Added: ${obj}`); }}>
                        {obj}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Full SF Tools Link */}
                <div className="pt-1">
                  <Button variant="ghost" size="sm" className="w-full h-6 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent"
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

            {/* ========== ACCESSIBILITY TAB ========== */}
            <TabsContent value="a11y" className="flex-1 m-0 p-0 overflow-hidden flex flex-col data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
              <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                <div className="flex items-center gap-2">
                  <Accessibility className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold">Accessibility Issues</span>
                  {a11yIssues.length > 0 && (
                    <Badge className={cn(
                      "text-[10px] px-1.5",
                      a11yIssues.reduce((acc, p) => acc + p.summary.critical, 0) > 0
                        ? "bg-red-500/20 text-red-400 border-red-500/30"
                        : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                    )}>
                      {a11yIssues.reduce((acc, p) => acc + p.summary.total, 0)} total
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    onClick={handleA11yScan}
                    disabled={isA11yScanning || !currentUrl}
                    variant="outline"
                    size="sm"
                    className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    {isA11yScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
                    <span className="ml-1">Scan Page</span>
                  </Button>
                  {a11yIssues.length > 0 && (
                    <Button
                      onClick={() => setA11yIssues([])}
                      variant="outline"
                      size="sm"
                      className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                  {a11yIssues.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Accessibility className="h-12 w-12 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No accessibility scans yet</p>
                      <p className="text-xs mt-1">Click "A11y" button or "Scan Page" to check the current page</p>
                    </div>
                  ) : (
                    a11yIssues.map((pageScan, pageIdx) => (
                      <Collapsible key={pageIdx} defaultOpen={pageIdx === a11yIssues.length - 1}>
                        <CollapsibleTrigger className="w-full">
                          <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg hover:bg-secondary/80 transition-colors">
                            <div className="flex items-center gap-2 text-left">
                              <ChevronRight className="h-4 w-4 transition-transform ui-open:rotate-90" />
                              <div>
                                <p className="text-xs font-medium truncate max-w-[200px]">{pageScan.page}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(pageScan.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              {pageScan.summary.critical > 0 && (
                                <Badge className="bg-red-500/20 text-red-400 text-[9px] px-1">{pageScan.summary.critical} crit</Badge>
                              )}
                              {pageScan.summary.serious > 0 && (
                                <Badge className="bg-orange-500/20 text-orange-400 text-[9px] px-1">{pageScan.summary.serious} ser</Badge>
                              )}
                              {pageScan.summary.moderate > 0 && (
                                <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px] px-1">{pageScan.summary.moderate} mod</Badge>
                              )}
                              {pageScan.summary.minor > 0 && (
                                <Badge className="bg-blue-500/20 text-blue-400 text-[9px] px-1">{pageScan.summary.minor} min</Badge>
                              )}
                            </div>
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="mt-2 space-y-2 pl-4">
                            {pageScan.issues.map((issue, issueIdx) => (
                              <div 
                                key={issueIdx} 
                                className={cn(
                                  "p-2 rounded-lg border-l-2 bg-secondary/30",
                                  issue.impact === 'critical' ? "border-l-red-500" :
                                  issue.impact === 'serious' ? "border-l-orange-500" :
                                  issue.impact === 'moderate' ? "border-l-yellow-500" :
                                  "border-l-blue-500"
                                )}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <Badge className={cn(
                                        "text-[9px] px-1",
                                        issue.impact === 'critical' ? "bg-red-500/20 text-red-400" :
                                        issue.impact === 'serious' ? "bg-orange-500/20 text-orange-400" :
                                        issue.impact === 'moderate' ? "bg-yellow-500/20 text-yellow-400" :
                                        "bg-blue-500/20 text-blue-400"
                                      )}>
                                        {issue.impact}
                                      </Badge>
                                      <span className="text-[10px] font-medium truncate">{issue.rule}</span>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mb-1">{issue.description}</p>
                                    {issue.element && (
                                      <code className="block text-[9px] bg-black/30 px-1.5 py-0.5 rounded text-muted-foreground truncate mb-1">
                                        {issue.element.slice(0, 80)}{issue.element.length > 80 ? '...' : ''}
                                      </code>
                                    )}
                                    {issue.suggested_fix && (
                                      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5 mt-1">
                                        <p className="text-[9px] text-emerald-400 font-medium mb-0.5">✓ Fix:</p>
                                        <p className="text-[10px] text-emerald-300/80">{issue.suggested_fix}</p>
                                      </div>
                                    )}
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className="text-[9px] text-purple-400">{issue.wcag_criterion}</span>
                                      {issue.help_url && (
                                        <a 
                                          href={issue.help_url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="text-[9px] text-blue-400 hover:underline"
                                        >
                                          Learn more →
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ========== AUTOMATE TAB - Link Manual Steps with Recordings ========== */}
            {mode === 'existing' && selectedTestCase && (
              <TabsContent value="automate" className="flex-1 m-0 p-0 overflow-hidden flex flex-col data-[state=inactive]:hidden" style={{ minHeight: 0 }}>
                {/* Header with Settings */}
                <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-semibold">Link Steps</span>
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] px-1.5">
                      {Object.keys(stepLinks).length || Object.keys(stepAutomation).length}/{selectedTestCase.steps?.length || 0} linked
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Settings Popover */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] border-border">
                          <Settings className="h-3 w-3 mr-1" />
                          Settings
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent align="end" side="bottom" className="w-64 p-3">
                        <div className="space-y-3">
                          <h4 className="text-xs font-medium text-foreground">Linking Options</h4>
                          
                          <div className="flex items-center justify-between">
                            <Label htmlFor="grouping-tab" className="text-[11px] text-muted-foreground">
                              Allow action grouping
                            </Label>
                            <Switch
                              id="grouping-tab"
                              checked={groupingEnabled}
                              onCheckedChange={setGroupingEnabled}
                            />
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <Label htmlFor="autoadvance-tab" className="text-[11px] text-muted-foreground">
                              Auto-advance steps
                            </Label>
                            <Switch
                              id="autoadvance-tab"
                              checked={autoAdvance}
                              onCheckedChange={setAutoAdvance}
                            />
                          </div>
                          
                          <div className="space-y-1">
                            <Label className="text-[11px] text-muted-foreground">Link mode</Label>
                            <Select value={defaultLinkMode} onValueChange={(v) => setDefaultLinkMode(v as LinkMode)}>
                              <SelectTrigger className="h-7 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="document">📝 Document - Keep manual text</SelectItem>
                                <SelectItem value="replace">🔄 Replace - Use generated text</SelectItem>
                                <SelectItem value="hybrid">🔀 Hybrid - Both</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          
                          <p className="text-[10px] text-muted-foreground">
                            {groupingEnabled 
                              ? "Multiple recordings can be linked to one step" 
                              : "One recording per step"}
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => { setStepAutomation({}); setStepLinks({}); setCurrentStepIndex(0); }}
                      className="h-6 px-2 text-[10px] border-red-500/30 text-red-400 hover:bg-red-500/10"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset All
                    </Button>
                  </div>
                </div>

                {/* Selection Info Bar - When actions are selected on left */}
                {selectedActionIndices.size > 0 && (
                  <div className="px-3 py-2 bg-blue-500/10 border-b border-blue-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckSquare className="h-4 w-4 text-blue-400" />
                      <span className="text-sm text-blue-300">
                        {selectedActionIndices.size} recorded action{selectedActionIndices.size > 1 ? 's' : ''} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Click a step below to link</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedActionIndices(new Set())}
                        className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Clear Selection
                      </Button>
                    </div>
                  </div>
                )}

                {/* Recording Context Banner */}
                {recordForStepContext && (
                  <div className="px-3 py-2 bg-purple-500/10 border-b border-purple-500/30">
                    <div className="flex items-center gap-2 text-xs">
                      <Video className="h-3 w-3 text-purple-400 animate-pulse" />
                      <span className="text-purple-300">
                        Recording for: <strong>{recordForStepContext.stepName}</strong>
                      </span>
                    </div>
                    {recordForStepContext.manualDescription && (
                      <p className="text-[10px] text-muted-foreground mt-1 pl-5">
                        📝 {recordForStepContext.manualDescription}
                      </p>
                    )}
                  </div>
                )}

                {/* Scrollable Manual Steps List */}
                <ScrollArea className="flex-1">
                  <div className="p-3 space-y-2">
                    {(selectedTestCase.steps || []).map((step: any, idx: number) => {
                      const legacyAutomation = stepAutomation[idx];
                      const enhancedLink = stepLinks[idx];
                      const isCurrent = currentStepIndex === idx;
                      const hasEnhancedLink = enhancedLink && enhancedLink.actions.length > 0;
                      const isAutomated = hasEnhancedLink || legacyAutomation?.type === 'recorded' || legacyAutomation?.type === 'suggested';
                      const isSkipped = legacyAutomation?.type === 'skipped';
                      const actionCount = enhancedLink?.actions.length || 0;
                      const hasSelectedActions = selectedActionIndices.size > 0;
                      
                      return (
                        <div
                          key={step.id || idx}
                          onClick={() => {
                            setCurrentStepIndex(idx);
                            // If actions are selected, link them to this step
                            if (hasSelectedActions) {
                              handleLinkSelectedActions(idx);
                            }
                          }}
                          className={cn(
                            "group relative flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
                            isCurrent && "bg-purple-500/15 border-purple-500/50 ring-1 ring-purple-500/30",
                            !isCurrent && isAutomated && "bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15",
                            !isCurrent && isSkipped && "bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/15",
                            !isCurrent && !isAutomated && !isSkipped && "bg-card border-border hover:border-purple-500/30 hover:bg-purple-500/5",
                            hasSelectedActions && !isCurrent && "hover:border-blue-500/50 hover:bg-blue-500/10"
                          )}
                        >
                          {/* Step Number Badge */}
                          <div className={cn(
                            "flex items-center justify-center w-8 h-8 rounded-lg text-sm font-bold shrink-0",
                            isCurrent && "bg-purple-500 text-white",
                            !isCurrent && isAutomated && "bg-emerald-500/20 text-emerald-400",
                            !isCurrent && isSkipped && "bg-amber-500/20 text-amber-400",
                            !isCurrent && !isAutomated && !isSkipped && "bg-white/5 text-muted-foreground"
                          )}>
                            {String(idx + 1).padStart(2, '0')}
                          </div>
                          
                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {/* Status Icon */}
                              {isAutomated && <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />}
                              {isSkipped && <Circle className="h-4 w-4 text-amber-400 shrink-0" />}
                              {isCurrent && !isAutomated && !isSkipped && <ArrowRight className="h-4 w-4 text-purple-400 shrink-0 animate-pulse" />}
                              
                              {/* Step Name */}
                              <p className="text-sm font-medium truncate">{step.name || step.description || `Step ${idx + 1}`}</p>
                              
                              {/* Link Mode Badge */}
                              {hasEnhancedLink && (
                                <Badge variant="outline" className="text-[9px] h-4 px-1 border-emerald-500/30 text-emerald-400">
                                  {enhancedLink.linkMode}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Step Description (manual action) */}
                            {step.action && (
                              <p className="text-xs text-muted-foreground mb-1 line-clamp-2">
                                📝 {step.action}
                              </p>
                            )}
                            
                            {/* Linked Actions Info */}
                            {hasEnhancedLink && (
                              <div className="mt-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                                <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                                  <Layers className="h-3 w-3" />
                                  <span>{actionCount} linked action{actionCount > 1 ? 's' : ''}</span>
                                </div>
                                <div className="space-y-1">
                                  {enhancedLink.actions.slice(0, 3).map((action: any, actIdx: number) => (
                                    <div key={actIdx} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                      {getActionIcon(action.qword, true)}
                                      <span className="truncate">{action.description || action.qword}</span>
                                    </div>
                                  ))}
                                  {actionCount > 3 && (
                                    <p className="text-[10px] text-muted-foreground">+{actionCount - 3} more...</p>
                                  )}
                                </div>
                              </div>
                            )}
                            
                            {/* Legacy Automation Info */}
                            {!hasEnhancedLink && legacyAutomation?.data && (
                              <div className="mt-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/20">
                                <div className="flex items-center gap-1 text-xs text-emerald-400">
                                  {legacyAutomation.type === 'recorded' ? <Video className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
                                  <span className="truncate">{(legacyAutomation.data as any).description || (legacyAutomation.data as any).qword}</span>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            {/* Link hint when actions selected */}
                            {hasSelectedActions && (
                              <Badge className="bg-blue-500/20 text-blue-400 text-[9px] px-2 animate-pulse">
                                Click to link
                              </Badge>
                            )}
                            
                            {/* Skip button for current step */}
                            {isCurrent && !isAutomated && !isSkipped && !hasSelectedActions && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => { e.stopPropagation(); skipCurrentStep(); }}
                                className="h-7 px-2 text-xs text-amber-400 hover:text-amber-300 hover:bg-amber-500/20"
                              >
                                Skip
                              </Button>
                            )}
                            
                            {/* Clear button for automated/skipped steps */}
                            {(isAutomated || isSkipped) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={(e) => { e.stopPropagation(); clearStepAutomation(idx); }}
                                className="h-7 w-7 text-muted-foreground hover:text-red-400 hover:bg-red-500/20"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>

                {/* Bottom Help */}
                <div className="px-3 py-2 border-t border-border bg-muted/30">
                  <p className="text-xs text-muted-foreground text-center">
                    {selectedActionIndices.size > 0 
                      ? `🔗 Click any step above to link ${selectedActionIndices.size} selected action${selectedActionIndices.size > 1 ? 's' : ''}`
                      : groupingEnabled 
                        ? '💡 Select multiple recorded actions on the left panel, then click a step to link them'
                        : '💡 Select recorded actions on the left, then click a step to link'}
                  </p>
                </div>
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
                className="w-full h-10 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
              >
                <Merge className="h-4 w-4 mr-2" />
                Merge {actions.length} Actions into "{selectedTestCase.name?.slice(0, 20)}..."
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Position-based merge: Action 1 → Step 1, Action 2 → Step 2, etc.
              </p>
            </div>
          ) : (
            <Button onClick={handleSaveAsNew} className="w-full h-10 bg-gradient-to-r from-emerald-500 to-emerald-600">
              <Save className="h-4 w-4 mr-2" />
              Save as New Test Case
            </Button>
          )}
        </div>
      )}

      {/* Visual Checkpoint Dialog */}
      <Dialog open={showVisualDialog} onOpenChange={setShowVisualDialog}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Eye className="h-5 w-5 text-violet-400" />
              Capture Visual Checkpoint
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-violet-500/10 rounded-lg border border-violet-500/30">
              <p className="text-xs text-violet-300 mb-1">Current Page</p>
              <p className="text-sm text-foreground truncate">{currentUrl}</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="baseline-name" className="text-foreground">Baseline Name</Label>
              <Input
                id="baseline-name"
                value={visualBaselineName}
                onChange={(e) => setVisualBaselineName(e.target.value)}
                placeholder="e.g., login_page_hero"
                className="bg-secondary border-border text-foreground"
              />
              <p className="text-xs text-muted-foreground">
                This name will be used to reference this baseline in visual regression tests
              </p>
            </div>
            
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <p className="text-xs font-medium text-foreground">What happens next:</p>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                  Screenshot captured and saved as baseline
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                  Visual check step added to your recording
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-3 w-3 text-emerald-400" />
                  Future test runs will compare against this baseline
                </li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowVisualDialog(false)}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmVisualCapture}
              disabled={!visualBaselineName.trim() || isCapturingVisual}
              className="bg-violet-600 hover:bg-violet-700"
            >
              {isCapturingVisual ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Eye className="h-4 w-4 mr-2" />
              )}
              Capture Baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cross-Origin Step Editor Dialog */}
      <Dialog open={showCrossOriginEditor} onOpenChange={setShowCrossOriginEditor}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              Edit Cross-Origin Actions
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
              <p className="text-xs text-yellow-300">
                This step was recorded in an external tab where we couldn't capture actions automatically.
                Add selectors below to define what actions to perform during playback.
              </p>
            </div>
            
            {/* User-defined actions list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-foreground">Actions</h4>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    setCrossOriginUserActions(prev => [...prev, {
                      id: `action_${Date.now()}`,
                      type: 'click',
                      findBy: 'text',
                      selector: '',
                      description: ''
                    }]);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Action
                </Button>
              </div>
              
              {crossOriginUserActions.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground border border-dashed rounded-lg">
                  <p className="text-sm">No actions defined</p>
                  <p className="text-xs mt-1">Click "Add Action" to define how to interact with elements</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                  {crossOriginUserActions.map((userAction, idx) => (
                    <div key={userAction.id} className="p-3 bg-secondary rounded-lg border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-muted-foreground">Action {idx + 1}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => {
                            setCrossOriginUserActions(prev => prev.filter((_, i) => i !== idx));
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Action Type */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Action Type</label>
                          <Select 
                            value={userAction.type} 
                            onValueChange={(v: any) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) => 
                                i === idx ? { ...a, type: v } : a
                              ));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="click">Click</SelectItem>
                              <SelectItem value="fill">Fill / Type</SelectItem>
                              <SelectItem value="select">Select Option</SelectItem>
                              <SelectItem value="wait">Wait</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Find By</label>
                          <Select 
                            value={userAction.findBy} 
                            onValueChange={(v: any) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) => 
                                i === idx ? { ...a, findBy: v } : a
                              ));
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="text">Text Content</SelectItem>
                              <SelectItem value="css">CSS Selector</SelectItem>
                              <SelectItem value="xpath">XPath</SelectItem>
                              <SelectItem value="testId">Test ID</SelectItem>
                              <SelectItem value="coords">Coordinates (x, y)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      
                      {/* Selector/Value Input */}
                      {userAction.findBy === 'coords' ? (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">X Position</label>
                            <Input
                              type="number"
                              value={userAction.coords?.x || ''}
                              onChange={(e) => {
                                setCrossOriginUserActions(prev => prev.map((a, i) => 
                                  i === idx ? { ...a, coords: { x: parseInt(e.target.value) || 0, y: a.coords?.y || 0 } } : a
                                ));
                              }}
                              className="h-8 text-xs"
                              placeholder="450"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Y Position</label>
                            <Input
                              type="number"
                              value={userAction.coords?.y || ''}
                              onChange={(e) => {
                                setCrossOriginUserActions(prev => prev.map((a, i) => 
                                  i === idx ? { ...a, coords: { x: a.coords?.x || 0, y: parseInt(e.target.value) || 0 } } : a
                                ));
                              }}
                              className="h-8 text-xs"
                              placeholder="320"
                            />
                          </div>
                        </div>
                      ) : (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">
                            {userAction.findBy === 'text' ? 'Text to find' :
                             userAction.findBy === 'css' ? 'CSS Selector' :
                             userAction.findBy === 'xpath' ? 'XPath Expression' :
                             'Test ID'}
                          </label>
                          <Input
                            value={userAction.selector}
                            onChange={(e) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) => 
                                i === idx ? { ...a, selector: e.target.value } : a
                              ));
                            }}
                            className="h-8 text-xs font-mono"
                            placeholder={
                              userAction.findBy === 'text' ? 'Click here for more info' :
                              userAction.findBy === 'css' ? 'button.submit-btn, #login' :
                              userAction.findBy === 'xpath' ? '//button[@id="submit"]' :
                              'submit-button'
                            }
                          />
                        </div>
                      )}
                      
                      {/* Value input for fill actions */}
                      {userAction.type === 'fill' && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Value to Type</label>
                          <Input
                            value={userAction.value || ''}
                            onChange={(e) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) => 
                                i === idx ? { ...a, value: e.target.value } : a
                              ));
                            }}
                            className="h-8 text-xs"
                            placeholder="Enter value to type..."
                          />
                        </div>
                      )}
                      
                      {/* Wait duration for wait actions */}
                      {userAction.type === 'wait' && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Wait Duration (ms)</label>
                          <Input
                            type="number"
                            value={userAction.value || '2000'}
                            onChange={(e) => {
                              setCrossOriginUserActions(prev => prev.map((a, i) => 
                                i === idx ? { ...a, value: e.target.value } : a
                              ));
                            }}
                            className="h-8 text-xs"
                            placeholder="2000"
                          />
                        </div>
                      )}
                      
                      {/* Description */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Description (optional)</label>
                        <Input
                          value={userAction.description || ''}
                          onChange={(e) => {
                            setCrossOriginUserActions(prev => prev.map((a, i) => 
                              i === idx ? { ...a, description: e.target.value } : a
                            ));
                          }}
                          className="h-8 text-xs"
                          placeholder="Click the login button"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCrossOriginEditor(false);
                setEditingCrossOriginIndex(null);
                setCrossOriginUserActions([]);
              }}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Save user actions to the action
                if (editingCrossOriginIndex !== null) {
                  setActions(prev => prev.map((action, idx) => {
                    if (idx === editingCrossOriginIndex) {
                      return {
                        ...action,
                        userActions: crossOriginUserActions,
                        description: crossOriginUserActions.length > 0 
                          ? `⚠️ Cross-origin: ${crossOriginUserActions.length} action(s) defined`
                          : action.description
                      };
                    }
                    return action;
                  }));
                  toast.success(`Saved ${crossOriginUserActions.length} action(s) for cross-origin step`);
                }
                setShowCrossOriginEditor(false);
                setEditingCrossOriginIndex(null);
                setCrossOriginUserActions([]);
              }}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Actions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Picker Dialog - Enterprise Scale */}
      <Dialog open={showTestPicker} onOpenChange={setShowTestPicker}>
        <DialogContent className="max-w-4xl h-[85vh] bg-card border-border flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
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
                className="pl-10 bg-secondary border-border text-foreground"
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
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
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
                      // Reset step automation state for new test case
                      setCurrentStepIndex(0);
                      setStepAutomation({});
                      setActions([]); // Clear any previous recordings
                      toast.success(`Selected: ${tc.name} - ${tc.steps?.length || 0} steps to automate`);
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
                            <span className="font-medium text-sm text-foreground truncate">{tc.name || tc.title}</span>
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

      {/* Test Execution Result Modal - Enhanced with Pause/Resume/Debug */}
      <Dialog open={showTestResultModal} onOpenChange={(open) => {
        if (!open && testExecutionResult?.status === 'running') {
          // Don't allow closing while running - must stop first
          return;
        }
        if (!open && isTestPaused) {
          // If closing while paused, stop the test
          handleStopTest();
        }
        setShowTestResultModal(open);
      }}>
        <DialogContent className="max-w-3xl bg-card border-border overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center justify-between">
              <div className="flex items-center gap-2">
                {testExecutionResult?.status === 'running' && !isTestPaused && (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                    {isDebugMode ? (
                      <>
                        <span>Debug Mode</span>
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                          <Bug className="h-3 w-3 mr-1" />
                          Running
                        </Badge>
                      </>
                    ) : (
                      'Running Test...'
                    )}
                  </>
                )}
                {(testExecutionResult?.status === 'paused' || isTestPaused) && (
                  <>
                    <Bug className="h-5 w-5 text-amber-400" />
                    <span className="text-amber-400">Debug Paused</span>
                    <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs ml-2">
                      Step {(pausedAtStep || 0) + 1}
                    </Badge>
                  </>
                )}
                {testExecutionResult?.status === 'passed' && (
                  <>
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    Test Passed!
                    {(() => {
                      const healedCount = testExecutionResult?.stepResults?.filter((s: any) => s.healed).length || 0;
                      const skippedCount = testExecutionResult?.stepResults?.filter((s: any) => s.skipped).length || 0;
                      return (
                        <>
                          {healedCount > 0 && <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 text-xs ml-2">{healedCount} healed</Badge>}
                          {skippedCount > 0 && <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30 text-xs ml-2">{skippedCount} skipped</Badge>}
                        </>
                      );
                    })()}
                  </>
                )}
                {testExecutionResult?.status === 'failed' && !isTestPaused && (
                  <>
                    <AlertCircle className="h-5 w-5 text-red-400" />
                    Test Failed
                  </>
                )}
              </div>
              
              {/* Step-by-step mode toggle - Only in Debug mode */}
              {isDebugMode && testExecutionResult?.status === 'running' && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="step-mode" className="text-xs text-muted-foreground">Step-by-step</Label>
                  <Switch
                    id="step-mode"
                    checked={stepByStepMode}
                    onCheckedChange={toggleStepByStepMode}
                  />
                </div>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 overflow-hidden max-w-full">
            {/* Progress Bar */}
            {(testExecutionResult?.status === 'running' || isTestPaused) && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Step {(isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1} of {testExecutionResult?.totalSteps}
                  </span>
                  <span className="text-muted-foreground">
                    {Math.round(((isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={cn(
                      "h-full transition-all duration-300",
                      isTestPaused ? "bg-amber-500" : "bg-blue-500"
                    )}
                    style={{ width: `${((isTestPaused ? pausedAtStep || 0 : testExecutionResult?.currentStep || 0) + 1) / (testExecutionResult?.totalSteps || 1) * 100}%` }}
                  />
                </div>
                
                {/* Execution Controls - Only in Debug Mode */}
                {testExecutionResult?.status === 'running' && !isTestPaused && (
                  <div className="flex items-center gap-2 pt-2">
                    {isDebugMode ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handlePauseTest}
                          className="flex-1 h-8 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                        >
                          <div className="h-3 w-3 bg-amber-400 rounded-sm mr-2" />
                          Pause
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStopTest}
                          className="h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                        >
                          <Square className="h-3 w-3 mr-1" />
                          Stop
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStopTest}
                        className="h-8 px-3 border-red-500/30 text-red-400 hover:bg-red-500/10"
                      >
                        <Square className="h-3 w-3 mr-1" />
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ONE-SCREEN FAILURE CARD — step name, screenshot, one sentence, primary CTA, secondaries */}
            {/* Enhanced with AI explanation + multiple fix options (additive — existing buttons unchanged) */}
            {testExecutionResult?.status === 'failed' && !isTestPaused && (() => {
              // Determine the canonical failed step for initial display
              let canonicalFailedIdx: number | undefined;
              if (testExecutionResult.failedStepIndex !== undefined) {
                canonicalFailedIdx = testExecutionResult.failedStepIndex;
              }
              if (canonicalFailedIdx === undefined) {
                const found = testExecutionResult.stepResults?.find((r: { status: string }) => r.status === 'failed');
                canonicalFailedIdx = found?.index;
              }
              if (canonicalFailedIdx === undefined) return null;
              
              // Use failureCardStepIndex for navigation, defaulting to canonical failed step
              const viewingIdx = failureCardStepIndex ?? canonicalFailedIdx;
              const viewingResult = testExecutionResult.stepResults?.[viewingIdx];
              const viewingAction = actions[viewingIdx];
              if (!viewingAction && !viewingResult) return null;
              
              const stepLabel = viewingAction ? getDisplayLabel(viewingAction) : null;
              const isViewingFailed = viewingResult?.status === 'failed';
              const classified = isViewingFailed ? classifyFailure(viewingResult?.error, stepLabel || undefined) : null;
              const stepName = viewingAction ? getDisplayDescription(maskSensitiveAction(viewingAction)) : `Step ${viewingIdx + 1}`;
              const isStepFlaky = viewingAction?.id ? flakyStepIds.has(viewingAction.id) : false;
              const totalSteps = testExecutionResult.totalSteps || actions.length;
              const isOnCanonicalFailed = viewingIdx === canonicalFailedIdx;
              
              return (
                <div className={`p-4 ${isViewingFailed ? 'bg-red-500/10 border-red-500/30' : 'bg-zinc-500/10 border-zinc-500/30'} border rounded-lg space-y-3`}>
                  {/* Step Navigation Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={viewingIdx <= 0}
                        onClick={() => setFailureCardStepIndex(Math.max(0, viewingIdx - 1))}
                        className="h-7 w-7 p-0"
                        title="Previous step"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-xs font-medium text-muted-foreground">
                        Step {viewingIdx + 1} of {totalSteps}
                        {isViewingFailed && <span className="text-red-400 ml-1">(failed)</span>}
                        {viewingResult?.status === 'passed' && <span className="text-emerald-400 ml-1">(passed)</span>}
                        {viewingResult?.status === 'skipped' && <span className="text-gray-400 ml-1">(skipped)</span>}
                        {!viewingResult && <span className="text-gray-500 ml-1">(not reached)</span>}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={viewingIdx >= totalSteps - 1}
                        onClick={() => setFailureCardStepIndex(Math.min(totalSteps - 1, viewingIdx + 1))}
                        className="h-7 w-7 p-0"
                        title="Next step"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    {!isOnCanonicalFailed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setFailureCardStepIndex(canonicalFailedIdx!)}
                        className="text-xs text-red-400 hover:text-red-300 h-7"
                      >
                        Go to failed step
                      </Button>
                    )}
                  </div>
                  
                  {/* Step Details */}
                  <div className="flex items-start gap-3">
                    {viewingResult?.screenshot && (
                      <img src={viewingResult.screenshot} alt="Step" className="w-24 h-24 object-cover rounded border border-border shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm font-medium ${isViewingFailed ? 'text-red-200' : 'text-foreground'}`}>{stepName}</p>
                        {isStepFlaky && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 text-amber-400 rounded border border-amber-500/30">
                            Flaky
                          </span>
                        )}
                      </div>
                      {isViewingFailed && classified && (
                        <p className="text-sm text-red-300/90 mt-1">
                          {aiExplanation && isOnCanonicalFailed ? aiExplanation.plain_explanation : classified.message}
                        </p>
                      )}
                      {isViewingFailed && aiExplanation && isOnCanonicalFailed && aiExplanation?.root_cause && aiExplanation.root_cause !== 'unknown' && aiExplanation.root_cause !== aiExplanation.failure_type && (
                        <p className="text-xs text-red-400/60 mt-0.5">
                          Root cause: {aiExplanation.root_cause.replace(/_/g, ' ')}
                          {aiExplanation.confidence > 0 && ` (${Math.round(aiExplanation.confidence * 100)}% confidence)`}
                        </p>
                      )}
                      {viewingResult?.status === 'passed' && (
                        <p className={cn(
                          "text-sm mt-1",
                          viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && falsePositiveSteps.get(viewingAction.id)?.reason?.includes('Wrong element')
                            ? "text-red-400/90"
                            : "text-emerald-400/90"
                        )}>
                          {viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && falsePositiveSteps.get(viewingAction.id)?.reason?.includes('Wrong element')
                            ? "⚠️ Step passed but flagged as wrong element — may have clicked the wrong thing."
                            : "This step passed successfully."
                          }
                        </p>
                      )}
                      {!viewingResult && (
                        <p className="text-sm text-gray-400/90 mt-1">This step was not reached during execution.</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Fix buttons - available for ANY step, not just the failed one */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => {
                        setShowTestResultModal(false);
                        setEditingActionIndex(viewingIdx);
                        setRightPanelTab('suggestions');
                        switchToStepTabAndRefresh(viewingIdx);
                        toast.info('Click the correct element in the browser or pick one from Smart Suggestions.', { duration: 4000 });
                      }}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                      size="sm"
                    >
                      <MousePointer className="h-4 w-4 mr-2" />
                      Fix this step
                    </Button>
                    <Button variant="outline" size="sm" className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10" onClick={() => handleRunFromStep(viewingIdx)}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Retry from here
                    </Button>
                    {isViewingFailed && viewingAction?.id && !falsePositiveSteps.has(viewingAction.id) && (
                      <Button variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10" onClick={() => { markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null); }}>
                        Not a real failure
                      </Button>
                    )}
                    {/* False negative: step passed but hit wrong element */}
                    {viewingResult?.status === 'passed' && viewingAction?.id && !falsePositiveSteps.has(viewingAction.id) && (
                      <Button variant="outline" size="sm" className="border-red-500/30 text-red-400 hover:bg-red-500/10" onClick={() => { markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null, 'Wrong element — step passed but clicked incorrect element'); }}>
                        Wrong Element
                      </Button>
                    )}
                    {/* Unflag — for any step already flagged */}
                    {viewingAction?.id && falsePositiveSteps.has(viewingAction.id) && (
                      <Button variant="outline" size="sm" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10" onClick={() => { unmarkFalsePositive(viewingAction.id!); }}>
                        Unflag
                      </Button>
                    )}
                    {isViewingFailed && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" 
                        onClick={() => {
                          // Mark this step as passed (override false failure) and move to next step
                          setTestExecutionResult(prev => {
                            if (!prev) return prev;
                            const newResults = [...prev.stepResults];
                            newResults[viewingIdx] = { ...newResults[viewingIdx], status: 'passed', error: undefined };
                            return { ...prev, stepResults: newResults };
                          });
                          toast.success(`Step ${viewingIdx + 1} marked as passed`, { duration: 2000 });
                          // Advance to next step automatically
                          if (viewingIdx + 1 < totalSteps) {
                            setFailureCardStepIndex(viewingIdx + 1);
                          }
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Mark as Passed & Next
                      </Button>
                    )}
                    <Button variant="outline" size="sm" className="border-gray-500/30 text-gray-400 hover:bg-gray-500/10" onClick={() => handleRunFromStep(viewingIdx)}>
                      <Play className="h-4 w-4 mr-1" />
                      Run from here
                    </Button>
                  </div>
                  {/* AI MULTI-FIX — "Why did this fail?" expandable section */}
                  {/* Only shown when viewing a failed step. Loads on-demand when clicked — no AI cost until user asks */}
                  {isViewingFailed && <div className="border-t border-red-500/20 pt-2">
                    {!aiExplanation && !aiExplanationLoading && isOnCanonicalFailed && (
                      <button
                        onClick={async () => {
                          setAiExplanationLoading(true);
                          try {
                            const result = await explainFailureApi({
                              test_id: currentTestId,
                              step_id: viewingAction?.id || 'unknown',
                              step_index: viewingIdx,
                              step_label: stepLabel || '',
                              error_message: viewingResult?.error || 'Unknown error',
                              step_info: {
                                action: viewingAction?.type || 'unknown',
                                label: stepLabel || '',
                                selector: viewingAction?.selectorObj?.selector || viewingAction?.selector || '',
                                description: viewingAction?.description || '',
                                element: viewingAction?.element || {},
                              },
                              screenshot_b64: null, // Don't send screenshots (too large for API call)
                            });
                            setAiExplanation(result);
                          } catch (e) {
                            console.warn('AI explanation failed:', e);
                          } finally {
                            setAiExplanationLoading(false);
                          }
                        }}
                        className="text-xs text-red-300/70 hover:text-red-200 transition-colors flex items-center gap-1"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        Why did this fail? (More fix options)
                      </button>
                    )}
                    {aiExplanationLoading && (
                      <div className="flex items-center gap-2 text-xs text-red-300/60">
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                        Analyzing failure...
                      </div>
                    )}
                    {aiExplanation && isOnCanonicalFailed && aiExplanation.fix_options.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-red-300/70 font-medium">Fix options (ranked by likelihood):</p>
                        <div className="space-y-1.5">
                          {aiExplanation.fix_options.slice(0, 5).map((fix: ApiFixOption, i: number) => (
                            <button
                              key={fix.fix_id}
                              onClick={() => {
                                // Route each fix option to the appropriate handler
                                if (fix.fix_type === 'update_selector') {
                                  setShowTestResultModal(false);
                                  setEditingActionIndex(viewingIdx);
                                  setRightPanelTab('suggestions');
                                  handleRefreshSuggestions();
                                } else if (fix.fix_type === 'add_wait') {
                                  // Actually insert a wait step before the failing step
                                  const waitStep = {
                                    type: 'wait',
                                    value: String(fix.details?.wait_ms || 2000),
                                    description: `Wait ${(fix.details?.wait_ms || 2000) / 1000}s before step`,
                                    timestamp: Date.now(),
                                  };
                                  const newActions = [...actions];
                                  newActions.splice(viewingIdx, 0, waitStep);
                                  setActions(newActions);
                                  toast.success(`Added ${(fix.details?.wait_ms || 2000) / 1000}s wait before step ${viewingIdx + 1}. Run again to verify.`, { duration: 4000 });
                                } else if (fix.fix_type === 'retry') {
                                  handleRunFromStep(viewingIdx);
                                } else if (fix.fix_type === 'skip_step') {
                                  // Mark step as skipped and run from next step
                                  const newActions = [...actions];
                                  if (newActions[viewingIdx]) {
                                    (newActions[viewingIdx] as any)._skipped = true;
                                  }
                                  setActions(newActions);
                                  if (viewingIdx + 1 < actions.length) {
                                    handleRunFromStep(viewingIdx + 1);
                                  }
                                  toast.info(`Step ${viewingIdx + 1} marked as skipped.`, { duration: 3000 });
                                } else if (fix.fix_type === 'mark_false_positive') {
                                  markStepAsFalsePositive(viewingIdx, viewingResult?.screenshot || null);
                                } else if (fix.fix_type === 'quarantine') {
                                  // Persist quarantine — skip in future runs until manually un-quarantined
                                  const newActions = [...actions];
                                  if (newActions[viewingIdx]) {
                                    (newActions[viewingIdx] as any)._quarantined = true;
                                    (newActions[viewingIdx] as any)._quarantinedAt = new Date().toISOString();
                                  }
                                  setActions(newActions);
                                  toast.info('Step quarantined — it will be skipped in future runs until you un-quarantine it.', { duration: 4000 });
                                } else if (fix.fix_type === 'investigate') {
                                  toast.info(fix.description, { duration: 6000 });
                                } else {
                                  toast.info(fix.description, { duration: 4000 });
                                }
                              }}
                              className="w-full flex items-start gap-2 p-2 rounded-md text-left text-xs hover:bg-red-500/10 transition-colors group"
                            >
                              <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold border border-red-400/30 text-red-300/70 group-hover:border-red-400/60 group-hover:text-red-200">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-red-200 group-hover:text-red-100">{fix.title}</span>
                                <p className="text-red-300/60 mt-0.5 leading-tight">{fix.description}</p>
                              </div>
                              {fix.confidence >= 0.7 && (
                                <span className="shrink-0 px-1 py-0.5 text-[9px] bg-green-500/20 text-green-400 rounded border border-green-500/30">
                                  likely fix
                                </span>
                              )}
                              {fix.auto_applicable && (
                                <span className="shrink-0 px-1 py-0.5 text-[9px] bg-blue-500/20 text-blue-400 rounded border border-blue-500/30">
                                  auto
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                        {aiExplanation.ai_enhanced && (
                          <p className="text-[10px] text-red-400/40 mt-1">AI-enhanced analysis</p>
                        )}
                        {!aiExplanation.ai_enhanced && (
                          <p className="text-[10px] text-red-400/40 mt-1">Pattern-based analysis (add OpenAI key for AI-enhanced)</p>
                        )}
                      </div>
                    )}
                  </div>}
                </div>
              );
            })()}

            {/* FALSE POSITIVE PAUSE CARD — "Is the page correct?" Yes / No fix */}
            {isTestPaused && pausedAtStep !== null && actions[pausedAtStep]?.id && falsePositiveSteps.has(actions[pausedAtStep].id) && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-3">
                <p className="text-sm font-medium text-amber-200">You said this step isn&apos;t a real failure.</p>
                <p className="text-sm text-amber-300/90">Is the page correct now?</p>
                <div className="flex gap-2">
                  <Button onClick={handleResumeTest} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    <Check className="h-4 w-4 mr-2" />
                    Yes, continue
                  </Button>
                  <Button
                    variant="outline"
                    className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                    onClick={() => {
                      setShowTestResultModal(false);
                      setEditingActionIndex(pausedAtStep);
                      setRightPanelTab('suggestions');
                      handleRefreshSuggestions();
                      toast.info('Pick the correct element from Smart Suggestions or click it in the browser.', { duration: 4000 });
                    }}
                  >
                    <MousePointer className="h-4 w-4 mr-2" />
                    No, let me fix it
                  </Button>
                </div>
              </div>
            )}
            
            {/* PAUSED STATE - Edit Step Panel (when not showing false-positive confirmation only) */}
            {isTestPaused && editingPausedStep && pausedAtStep !== null && !(actions[pausedAtStep]?.id && falsePositiveSteps.has(actions[pausedAtStep].id)) && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded bg-amber-500 flex items-center justify-center text-amber-900 text-xs font-bold">
                      {pausedAtStep + 1}
                    </div>
                    <span className="text-sm font-medium text-amber-300">Edit Step Before Continuing</span>
                  </div>
                  <Badge className="bg-purple-500/20 text-purple-400 text-xs">Browser is open</Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  {/* Action Type */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Action</Label>
                    <Input 
                      value={editingPausedStep.qword || ''}
                      onChange={(e) => updatePausedStepField('qword', e.target.value)}
                      className="h-8 text-sm bg-background border-border"
                    />
                  </div>
                  
                  {/* Target (plain-language; no "selector" in UI) */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Target (optional)</Label>
                    <Input 
                      value={editingPausedStep.selectorObj?.selector || ''}
                      onChange={(e) => updatePausedStepField('selectorObj', { 
                        ...editingPausedStep.selectorObj, 
                        selector: e.target.value 
                      })}
                      className="h-8 text-sm bg-background border-border font-mono text-[11px]"
                      placeholder="Optional: target on page"
                    />
                  </div>
                </div>
                
                {/* Value/Args */}
                {(editingPausedStep.qword?.includes('fill') || editingPausedStep.args?.length) && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Value</Label>
                    <Input 
                      value={editingPausedStep.args?.[0] || ''}
                      onChange={(e) => updatePausedStepField('args', [e.target.value])}
                      className="h-8 text-sm bg-background border-border"
                      placeholder="Value to input"
                    />
                  </div>
                )}
                
                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Description</Label>
                  <Input 
                    value={editingPausedStep.description || ''}
                    onChange={(e) => updatePausedStepField('description', e.target.value)}
                    className="h-8 text-sm bg-background border-border"
                    placeholder="Step description"
                  />
                </div>
                
                {/* Pause Controls */}
                <div className="flex items-center gap-2 pt-2 border-t border-amber-500/20">
                  <Button
                    onClick={handleResumeTest}
                    className="flex-1 h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Resume
                  </Button>
                  <Button
                    onClick={handleRetryPausedStep}
                    variant="outline"
                    className="h-9 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Retry Step
                  </Button>
                  <Button
                    onClick={handleSkipPausedStep}
                    variant="outline"
                    className="h-9 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  >
                    <SkipForward className="h-4 w-4 mr-1" />
                    Skip
                  </Button>
                  <Button
                    onClick={handleStopTest}
                    variant="outline"
                    className="h-9 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Stop
                  </Button>
                </div>
                
                <p className="text-[10px] text-amber-400/70 text-center">
                  💡 The browser is still open. You can inspect the page, modify the step above, then Resume or Retry.
                </p>
              </div>
            )}
            
            {/* Step Results List */}
            <div className="flex gap-4 overflow-hidden max-w-full">
              <ScrollArea className={cn("flex-1 overflow-hidden", isTestPaused ? "h-[200px]" : "h-[350px]")}>
                <div className="space-y-1 pr-2 overflow-hidden max-w-full" id="execution-steps-container">
                  {actions.map((action, idx) => {
                    // DISPLAY-ONLY: Skip duplicate fills (same as recorded steps list)
                    if (action.qword === 'Fill') {
                      const myLabel = action.args?.[0]?.toString() || '';
                      const myId = getFieldIdentity(action);
                      const hasBetterFill = actions.some((other, otherIdx) => {
                        if (otherIdx === idx || other.qword !== 'Fill') return false;
                        if (!areSameFillField(action, other)) return false;
                        const otherId = getFieldIdentity(other);
                        const otherLabel = other.args?.[0]?.toString() || '';
                        if (otherId && !myId) return true;
                        if (!looksLikeFieldValue(otherLabel) && looksLikeFieldValue(myLabel)) return true;
                        if (otherIdx < idx && !looksLikeFieldValue(otherLabel)) return true;
                        return false;
                      });
                      if (hasBetterFill) return null;
                    }
                    
                    const stepResult = testExecutionResult?.stepResults.find(r => r.index === idx);
                    const isCurrent = (testExecutionResult?.status === 'running' && testExecutionResult?.currentStep === idx) || 
                                     (isTestPaused && pausedAtStep === idx);
                    const isFailed = stepResult?.status === 'failed';
                    const hasScreenshot = !!stepResult?.screenshot;
                    const isPausedHere = isTestPaused && pausedAtStep === idx;
                    
                    // Auto-scroll ref for current or failed step
                    const shouldScrollTo = isCurrent || (isFailed && !testExecutionResult?.stepResults.some((r, i) => i > idx && r.status === 'failed'));
                    
                    return (
                      <div 
                        key={action.id || idx}
                        ref={shouldScrollTo ? (el) => {
                          if (el) {
                            // Delay scroll to ensure DOM is updated
                            setTimeout(() => {
                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            }, 50);
                          }
                        } : undefined}
                        className={cn(
                          "group flex items-start gap-2 p-2 rounded-lg text-sm cursor-pointer transition-all overflow-clip relative",
                          isPausedHere && "bg-amber-500/20 border border-amber-500/50 ring-1 ring-amber-500/30",
                          isCurrent && !isPausedHere && "bg-blue-500/20 border border-blue-500/30",
                          stepResult?.status === 'passed' && "bg-emerald-500/10 hover:bg-emerald-500/20",
                          stepResult?.status === 'healed' && "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20",
                          stepResult?.status === 'healing' && "bg-amber-500/10 border border-amber-500/20 animate-pulse",
                          stepResult?.status === 'failed' && "bg-red-500/10 hover:bg-red-500/20",
                          stepResult?.status === 'skipped' && "bg-gray-500/10 opacity-60",
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
                        <span className={cn(
                          "w-6 shrink-0 pt-0.5 text-center",
                          isPausedHere ? "text-amber-400 font-bold" : "text-muted-foreground"
                        )}>{idx + 1}</span>
                        <div className="shrink-0 pt-0.5">
                          {isPausedHere && <div className="h-4 w-4 rounded-full bg-amber-500 flex items-center justify-center"><div className="h-1.5 w-1.5 bg-amber-900 rounded-sm" /></div>}
                          {isCurrent && !isPausedHere && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                          {stepResult?.status === 'passed' && !isPausedHere && <Check className="h-4 w-4 text-emerald-400" />}
                          {stepResult?.status === 'healed' && !isPausedHere && <Check className="h-4 w-4 text-violet-400" />}
                          {stepResult?.status === 'healing' && <Loader2 className="h-4 w-4 animate-spin text-amber-400" />}
                          {stepResult?.status === 'failed' && !isPausedHere && <X className="h-4 w-4 text-red-400" />}
                          {stepResult?.status === 'skipped' && <SkipForward className="h-4 w-4 text-gray-400" />}
                          {!isCurrent && !stepResult && !isPausedHere && <Circle className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "break-words flex-1",
                              isPausedHere && "text-amber-300",
                              stepResult?.status === 'passed' && !isPausedHere && "text-emerald-400",
                              stepResult?.status === 'healed' && !isPausedHere && "text-violet-400",
                              stepResult?.status === 'healing' && "text-amber-400",
                              stepResult?.status === 'failed' && !isPausedHere && "text-red-400",
                              stepResult?.status === 'skipped' && "text-gray-400",
                              !stepResult && !isPausedHere && "text-muted-foreground"
                            )}>
                              {(() => {
                                const displayAction = maskSensitiveAction(action);
                                return getDisplayDescription(displayAction);
                              })()}
                              {isPasswordField(action) && <span className="ml-1">🔒</span>}
                              {/* Show AI resolution badge when AI was used to find/verify/correct this step */}
                              {stepResult?.aiResolved && (
                                <span 
                                  className={cn(
                                    "ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5",
                                    stepResult.aiResolved === 'ai-dom' && "bg-purple-500/20 text-purple-400 border border-purple-500/30",
                                    stepResult.aiResolved === 'ai-vision' && "bg-blue-500/20 text-blue-400 border border-blue-500/30",
                                    stepResult.aiResolved === 'ai-corrected' && "bg-amber-500/20 text-amber-400 border border-amber-500/30",
                                    stepResult.aiResolved === 'ai-verified' && "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
                                  )}
                                  title={
                                    stepResult.aiResolved === 'ai-dom' ? 'AI analyzed DOM to find this element' :
                                    stepResult.aiResolved === 'ai-vision' ? 'AI used screenshot vision to find this element' :
                                    stepResult.aiResolved === 'ai-corrected' ? 'AI detected and corrected a false positive' :
                                    stepResult.aiResolved === 'ai-verified' ? 'AI verified this step (possible false positive)' :
                                    'AI assisted with this step'
                                  }
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5">
                                    <path d="M8 1a.75.75 0 0 1 .75.75v.5a3.25 3.25 0 0 1 2.5 2.5h.5a.75.75 0 0 1 0 1.5h-.5a3.25 3.25 0 0 1-2.5 2.5v.5a.75.75 0 0 1-1.5 0v-.5a3.25 3.25 0 0 1-2.5-2.5h-.5a.75.75 0 0 1 0-1.5h.5a3.25 3.25 0 0 1 2.5-2.5v-.5A.75.75 0 0 1 8 1Zm0 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3.5 12.5a.75.75 0 0 1 .75.75v.25h.25a.75.75 0 0 1 0 1.5h-.25v.25a.75.75 0 0 1-1.5 0V15h-.25a.75.75 0 0 1 0-1.5h.25v-.25a.75.75 0 0 1 .75-.75Zm9 0a.75.75 0 0 1 .75.75v.25h.25a.75.75 0 0 1 0 1.5h-.25v.25a.75.75 0 0 1-1.5 0V15h-.25a.75.75 0 0 1 0-1.5h.25v-.25a.75.75 0 0 1 .75-.75Z" />
                                  </svg>
                                  {stepResult.aiResolved === 'ai-dom' ? 'AI' :
                                   stepResult.aiResolved === 'ai-vision' ? 'AI Vision' :
                                   stepResult.aiResolved === 'ai-corrected' ? 'AI Fixed' :
                                   stepResult.aiResolved === 'ai-verified' ? 'AI Check' : 'AI'}
                                </span>
                              )}
                              {/* Show auto-healed badge */}
                              {stepResult?.status === 'healed' && (
                                <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30" title="Auto-healed: selector was broken but AI found the correct element">
                                  Healed
                                </span>
                              )}
                              {/* Show healing in progress */}
                              {stepResult?.status === 'healing' && (
                                <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse">
                                  Healing...
                                </span>
                              )}
                              {/* Show auto-skipped badge */}
                              {stepResult?.skipped && (
                                <span className="ml-1 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-gray-500/20 text-gray-400 border border-gray-500/30" title="Auto-skipped: non-critical step">
                                  Skipped
                                </span>
                              )}
                              {/* Show flag badge (false positive or wrong element) */}
                              {action.id && falsePositiveSteps.has(action.id) && (
                                <span className={cn(
                                  "ml-1 text-xs px-1 rounded",
                                  falsePositiveSteps.get(action.id)?.reason?.includes('Wrong element')
                                    ? "bg-red-500/20 text-red-400"
                                    : "bg-amber-500/20 text-amber-400"
                                )}>🚩</span>
                              )}
                            </span>
                            {/* Action buttons for FAILED steps - Fix + Flag */}
                            {isFailed && testExecutionResult?.status !== 'running' && (
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Fix button - CLOSE modal and open Smart Suggestions panel */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // CLOSE the modal so user can see Smart Suggestions
                                    setShowTestResultModal(false);
                                    setEditingActionIndex(idx);
                                    setRightPanelTab('suggestions');
                                    switchToStepTabAndRefresh(idx);
                                    toast.info('Select the correct element from Smart Suggestions to replace this step', { duration: 4000 });
                                  }}
                                  className="px-2 py-0.5 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30"
                                  title="Fix this step - use Smart Suggestions to replace"
                                >
                                  Fix
                                </button>
                                {/* Mark as false positive - for steps that fail but shouldn't */}
                                {action.id && !falsePositiveSteps.has(action.id) && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markStepAsFalsePositive(idx, stepResult?.screenshot || null);
                                      // CLOSE modal and open suggestions for fixing
                                      setShowTestResultModal(false);
                                      setEditingActionIndex(idx);
                                      setRightPanelTab('suggestions');
                                      switchToStepTabAndRefresh(idx);
                                      toast.info('Step flagged! Select correct element from Smart Suggestions.', { duration: 4000 });
                                    }}
                                    className="px-2 py-0.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 rounded border border-amber-500/30"
                                    title="Flag and fix - opens Smart Suggestions to replace selector"
                                  >
                                    🚩 Flag
                                  </button>
                                )}
                                {/* After flagging - show Fix button + Unflag option */}
                                {action.id && falsePositiveSteps.has(action.id) && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowTestResultModal(false);
                                        setEditingActionIndex(idx);
                                        setRightPanelTab('suggestions');
                                        switchToStepTabAndRefresh(idx);
                                        toast.info('Select the correct element from Smart Suggestions to replace this step', { duration: 4000 });
                                      }}
                                      className="px-2 py-0.5 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30"
                                      title="Fix this flagged step"
                                    >
                                      Fix
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        unmarkFalsePositive(action.id!);
                                      }}
                                      className="px-2 py-0.5 text-[10px] bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded border border-gray-500/30"
                                      title="Remove false positive flag"
                                    >
                                      Unflag
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                            {/* Fix/Flag buttons for PASSED steps — always visible since platform is blackbox */}
                            {stepResult?.status === 'passed' && testExecutionResult?.status !== 'running' && action.id && (
                              <div className="flex items-center gap-1 shrink-0">
                                {/* Fix button */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowTestResultModal(false);
                                    setEditingActionIndex(idx);
                                    setRightPanelTab('suggestions');
                                    switchToStepTabAndRefresh(idx);
                                    toast.info('Select the correct element from Smart Suggestions to replace this step', { duration: 4000 });
                                  }}
                                  className="px-2 py-0.5 text-[10px] bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded border border-blue-500/30"
                                  title="Fix this step - pick the correct element"
                                >
                                  Fix
                                </button>
                                {!falsePositiveSteps.has(action.id) ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markStepAsFalsePositive(idx, stepResult?.screenshot || null, 'Wrong element — step passed but clicked incorrect element');
                                    }}
                                    className="px-2 py-0.5 text-[10px] bg-red-500/10 hover:bg-red-500/30 text-red-400/70 hover:text-red-400 rounded border border-red-500/20 hover:border-red-500/30"
                                    title="Wrong element — step passed but clicked incorrect element. Test will stop here on next run for fixing."
                                  >
                                    🚩 Wrong
                                  </button>
                                ) : (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      unmarkFalsePositive(action.id!);
                                    }}
                                    className="px-2 py-0.5 text-[10px] bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 rounded border border-gray-500/30"
                                    title="Remove flag"
                                  >
                                    Unflag
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          {stepResult?.error && (
                            <p className="text-xs text-red-400 mt-1 truncate">
                              {classifyFailure(stepResult.error, getDisplayLabel(action)).message}
                            </p>
                          )}
                        </div>
                        {/* Step Duration */}
                        {stepResult?.duration && (
                          <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                            {stepResult.duration}ms
                          </span>
                        )}
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
            {testExecutionResult?.status === 'failed' && testExecutionResult?.error && !isTestPaused && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
                <p className="text-sm text-red-400">{testExecutionResult.error}</p>
              </div>
            )}
            
            {/* Summary Footer */}
            {testExecutionResult?.status !== 'running' && !isTestPaused && (
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm text-muted-foreground">
                  {testExecutionResult?.stepResults.filter(r => r.status === 'passed').length || 0} / {testExecutionResult?.totalSteps || actions.length} steps passed
                  {testExecutionResult?.stepResults.filter(r => r.status === 'skipped').length > 0 && (
                    <span className="text-gray-500 ml-2">
                      ({testExecutionResult?.stepResults.filter(r => r.status === 'skipped').length} skipped)
                    </span>
                  )}
                  {/* AI involvement summary */}
                  {(() => {
                    const aiSteps = testExecutionResult?.stepResults.filter((r: any) => r.aiResolved) || [];
                    if (aiSteps.length === 0) return null;
                    return (
                      <span className="text-purple-400 ml-2" title={`AI assisted ${aiSteps.length} step(s): ${aiSteps.map((r: any) => `#${r.index + 1} (${r.aiResolved})`).join(', ')}`}>
                        AI: {aiSteps.length} step{aiSteps.length > 1 ? 's' : ''}
                      </span>
                    );
                  })()}
                </span>
                <div className="flex items-center gap-2">
                  {testExecutionResult?.status === 'failed' && (() => {
                    // Prefer canonical failedStepIndex, fall back to finding first failed
                    const failedIdx = testExecutionResult.failedStepIndex ?? 
                      testExecutionResult.stepResults?.find((r: { status: string }) => r.status === 'failed')?.index ?? 0;
                    return (
                      <>
                        <Button
                          onClick={() => handleRunFromStep(failedIdx)}
                          variant="outline"
                          className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          title="Run from the failed step (browser must be open)"
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Run from here
                        </Button>
                        <Button
                          onClick={() => handleRunTest(false)}
                          variant="outline"
                          className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                        >
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry All
                        </Button>
                      </>
                    );
                  })()}
                  {/* Lock Locators - Only show on successful test */}
                  {testExecutionResult?.status === 'passed' && (
                    <Button
                      onClick={handleLockLocators}
                      variant="outline"
                      className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                      title="Save working selectors for faster future runs"
                    >
                      🔒 Lock Locators
                    </Button>
                  )}
                  <Button
                    onClick={() => setShowTestResultModal(false)}
                    className={testExecutionResult?.status === 'passed' ? "bg-emerald-600 hover:bg-emerald-700" : "bg-gray-600 hover:bg-gray-700"}
                  >
                    {testExecutionResult?.status === 'passed' ? "Done" : "Close"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Merge Preview Dialog - Enhanced with Link Mode visualization */}
      <Dialog open={showMergePreview} onOpenChange={setShowMergePreview}>
        <DialogContent className="max-w-3xl h-[80vh] bg-card border-border flex flex-col overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Merge className="h-5 w-5 text-purple-400" />
              Merge Preview - {selectedTestCase?.name}
            </DialogTitle>
          </DialogHeader>
          
          <div className="text-sm text-muted-foreground pb-3 border-b border-border shrink-0">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Automated ({mergedSteps.filter(s => s.qword && !s._manualOnly).length})
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Grouped ({mergedSteps.filter(s => s._hasMultipleActions).length})
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
            <div className="flex items-center gap-2 mt-2 text-xs">
              <span className="text-muted-foreground">Link Mode:</span>
              <Badge variant="outline" className="text-[10px]">{defaultLinkMode}</Badge>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">Grouping: {groupingEnabled ? 'On' : 'Off'}</span>
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
                    "p-3 rounded-lg border transition-all",
                    step._merged && "bg-emerald-500/10 border-emerald-500/30",
                    step._hasMultipleActions && "bg-blue-500/10 border-blue-500/30",
                    step._manualOnly && "bg-muted-foreground/10 border-gray-500/30",
                    step._extra && "bg-purple-500/10 border-purple-500/30",
                    !step._merged && !step._manualOnly && !step._extra && step.qword && "bg-emerald-500/10 border-emerald-500/30"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-sm text-muted-foreground w-6 shrink-0 font-mono">{String(idx + 1).padStart(2, '0')}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm truncate">
                          {step.name || step.description || `${step.qword} ${step.args?.[0] || ''}`}
                        </span>
                        {step._merged && (
                          <Badge className="bg-emerald-500/20 text-emerald-400 text-[10px]">Merged</Badge>
                        )}
                        {step._hasMultipleActions && (
                          <Badge className="bg-blue-500/20 text-blue-400 text-[10px]">
                            {step.automationActions?.length || 0} Actions
                          </Badge>
                        )}
                        {step._linkMode && (
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {step._linkMode}
                          </Badge>
                        )}
                        {step._manualOnly && (
                          <Badge className="bg-muted-foreground/20 text-muted-foreground text-[10px]">Manual</Badge>
                        )}
                        {step._extra && (
                          <Badge className="bg-purple-500/20 text-purple-400 text-[10px]">New Step</Badge>
                        )}
                      </div>
                      
                      {/* Show manual description if in document/hybrid mode */}
                      {step.manualAction && step._linkMode !== 'replace' && (
                        <div className="mt-1 text-xs text-muted-foreground bg-black/20 rounded p-1.5">
                          📝 {step.manualAction}
                        </div>
                      )}
                      
                      {/* Show automation actions */}
                      {step._hasMultipleActions && step.automationActions?.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {step.automationActions.map((action: any, actionIdx: number) => (
                            <div key={action.id || actionIdx} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="text-[10px] text-muted-foreground/60">{actionIdx + 1}.</span>
                              <Badge variant="outline" className="text-[10px] border-white/20">
                                {action.qword}
                              </Badge>
                              <span className="truncate">{action.description || action.args?.join(' → ')}</span>
                            </div>
                          ))}
                        </div>
                      ) : step.qword && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] border-white/20">
                            {step.qword}
                          </Badge>
                          <span className="truncate">{step.args?.join(' → ')}</span>
                        </div>
                      )}
                    </div>
                    {step.qword || step._hasMultipleActions ? (
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
            <div className="flex-1 text-xs text-muted-foreground">
              {mergedSteps.filter(s => s._hasMultipleActions).length > 0 && (
                <span>💡 Steps with grouped actions will execute all linked actions in sequence</span>
              )}
            </div>
            <Button variant="outline" onClick={() => setShowMergePreview(false)} className="border-white/20">
              Cancel
            </Button>
            <Button onClick={saveMergedTest} className="bg-gradient-to-r from-purple-500 to-purple-600">
              <Save className="h-4 w-4 mr-2" />
              Save Merged Test ({mergedSteps.filter(s => s.qword || s._hasMultipleActions).length}/{mergedSteps.length} automated)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SF Tools Customization Dialog */}
      <Dialog open={showSFToolDialog} onOpenChange={setShowSFToolDialog}>
        <DialogContent className="max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
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
                    className="w-full h-24 bg-secondary border border-border rounded-lg p-3 text-foreground text-sm font-mono resize-none focus:border-blue-500 focus:outline-none"
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
                    className="w-full h-32 bg-secondary border border-border rounded-lg p-3 text-foreground text-sm font-mono resize-none focus:border-emerald-500 focus:outline-none"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Record ID (optional - will use current page if empty)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="001XXXXXXXXXXXX or leave empty"
                    className="bg-secondary border-border text-foreground"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Expected Error Message (contains)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="e.g., Account Name is required"
                    className="bg-secondary border-border text-foreground"
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
                    className="bg-secondary border-border text-foreground font-mono text-sm"
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
                      className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Number of Records</label>
                  <Input
                    type="number"
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="5"
                    className="bg-secondary border-border text-foreground w-24"
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
                    className="bg-secondary border-border text-foreground"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Input Variables (JSON, optional)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"recordId": "001XXXXXXXXXXXX"}'
                    className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Test Method (optional - runs all if empty)</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="testInsertAccount"
                    className="bg-secondary border-border text-foreground"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Field Values (JSON)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"Name": "Test Account", "Industry": "Technology"}'
                    className="w-full h-20 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">CSV File Path or Variable</label>
                  <Input
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder="./test-data/accounts.csv or ${csvData}"
                    className="bg-secondary border-border text-foreground font-mono text-sm"
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
                    className="bg-secondary border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Filters (JSON, optional)</label>
                  <textarea
                    value={sfToolInput2}
                    onChange={(e) => setSfToolInput2(e.target.value)}
                    placeholder='{"column": "ACCOUNT_NAME", "operator": "contains", "value": "Test"}'
                    className="w-full h-16 bg-secondary border border-border rounded-lg p-2 text-foreground text-sm font-mono resize-none"
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
                "text-foreground",
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
            console.log('[onElementPicked] Saving manual fix:', element);
            setActions(prev => prev.map((action, idx) => {
              if (idx !== editingActionIndex) return action;
              const newSelector = element.selector || action.selectorObj?.manualOverride;
              const newText = element.text || action.selectorObj?.text;
              console.log('[onElementPicked] Updating action:', { 
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
            console.log('[ElementRepairWizard onSave] Saving:', updates);
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
        <p className="text-sm text-foreground truncate">{suggestion.element || suggestion.args?.[0] || suggestion.description}</p>
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

