/**
 * Shared types for Flowpilot tab components.
 */

export interface TestStep {
  action: string;
  target: string;
  value?: string;
  success: boolean;
  error?: string;
  screenshot?: string;
  method?: string;
  healed?: boolean;
  heal_method?: string;
  confidence?: number;
  selector_used?: string;
  description?: string;
}

export interface TestResult {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'failed' | 'warning' | 'running';
  steps: TestStep[];
  duration: number;
  screenshot?: string;
}

export interface ExplorationDefect {
  id?: string;
  type: string;
  severity: string;
  title?: string;
  description: string;
  page_url?: string;
  url?: string;
  element?: string;
  screenshot?: string;
  wcag_criterion?: string;
  evidence?: Record<string, any>;
}

export interface ExplorationResult {
  session_id: string;
  status: 'running' | 'completed' | 'error' | 'stopped';
  progress: number;
  pages_visited: number;
  defects_found: number;
  defects: ExplorationDefect[];
  current_activity: string;
  duration: number;
  pages_queued?: number;
  summary?: Record<string, any>;
  generated_tests?: GeneratedTestSuite | null;
}

export interface GeneratedTestSuite {
  test_count: number;
  tests: Array<{
    title: string;
    description: string;
    steps: any[];
    tags: string[];
    priority: string;
  }>;
  summary: {
    smoke_tests: number;
    form_tests: number;
    regression_tests: number;
  };
}

export interface CapabilityPage {
  id: string;
  url: string;
  title: string;
  headings: string[];
  buttons: { text: string; selector: string }[];
  forms: { id: string; fields: any[] }[];
  links: string[];
  entities: string[];
  actions: string[];
}

export interface FlowmapResult {
  base_url: string;
  total_pages: number;
  pages: CapabilityPage[];
  llm_analysis?: any;
  total_defects: number;
}

export interface FlowpilotSettings {
  model: string;
  headless: boolean;
  maxSteps: number;
  timeout: number;
}

export const DEFAULT_SETTINGS: FlowpilotSettings = {
  model: 'gpt-4o-mini',
  headless: true,
  maxSteps: 20,
  timeout: 30,
};

export const SETTINGS_KEY = 'flowstral-ai-settings';
export const HISTORY_KEY = 'flowstral-ai-test-history';
export const MAX_HISTORY_ENTRIES = 50;

export type AgentId = 'flowmap' | 'explorer' | 'self-healer' | 'generator';

export interface HistoryEntry {
  id: string;
  timestamp: string;
  instruction: string;
  agentId: AgentId;
  results: TestResult[];
  passed: number;
  failed: number;
  total: number;
  duration: number;
}

export interface ExplorerConfig {
  authType: 'none' | 'cookie' | 'bearer' | 'basic' | 'form_login';
  bearerToken: string;
  cookieJson: string;
  basicUsername: string;
  basicPassword: string;
  loginUrl: string;
  loginUsername: string;
  loginPassword: string;
  usernameSelector: string;
  passwordSelector: string;
  submitSelector: string;
  maxPages: number;
  maxDepth: number;
  concurrency: number;
}

export const DEFAULT_EXPLORER_CONFIG: ExplorerConfig = {
  authType: 'none',
  bearerToken: '',
  cookieJson: '',
  basicUsername: '',
  basicPassword: '',
  loginUrl: '',
  loginUsername: '',
  loginPassword: '',
  usernameSelector: '#username',
  passwordSelector: '#password',
  submitSelector: "button[type='submit']",
  maxPages: 50,
  maxDepth: 5,
  concurrency: 3,
};

export interface SSEEvent {
  type: string;
  phase?: string;
  message?: string;
  screenshot?: string;
  result?: TestResult;
  data?: any;
  tests?: number;
  error?: string;
  intent?: any;
  session_id?: string;
}

export function loadSettings(): FlowpilotSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: FlowpilotSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}

export function loadHistory(): HistoryEntry[] {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [];
}

export function saveHistory(history: HistoryEntry[]) {
  try {
    const trimmed = history.slice(0, MAX_HISTORY_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* ignore */ }
}
