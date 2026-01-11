# Frontend Reference Guide

> **React/TypeScript Application Documentation**  
> 60+ Pages, 70+ Components  
> Version 3.0 | Last Updated: January 11, 2026

## Table of Contents

1. [Overview](#overview)
2. [Directory Structure](#directory-structure)
3. [Application Entry](#application-entry)
4. [Routing](#routing)
5. [Pages Reference](#pages-reference)
6. [Components](#components)
7. [Hooks](#hooks)
8. [Services & Libraries](#services--libraries)
9. [State Management](#state-management)
10. [Styling](#styling)

---

## Overview

The QAAI frontend is a React 18 TypeScript application with:

| Component | Count |
|-----------|-------|
| **Pages** | 60+ |
| **Components** | 70+ |
| **Custom Hooks** | 5+ |
| **Services** | 10+ |
| **Contexts** | 3 |

### Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Query + Zustand** - State management
- **shadcn/ui + Tailwind** - UI components
- **React Router 6** - Navigation
- **Monaco Editor** - Code editing

---

## Directory Structure

```
src/
├── App.tsx                         # Root component with routes
├── main.tsx                        # Application entry point
├── index.css                       # Global styles (Tailwind)
│
├── components/                     # 70+ components
│   ├── Layout.tsx                  # Main layout wrapper
│   ├── StreamlinedLayout.tsx       # Sidebar + content
│   ├── AppSidebar.tsx              # Navigation sidebar
│   ├── TopNav.tsx                  # Top navigation bar
│   ├── ProtectedRoute.tsx          # Route guards
│   ├── AIConfiguration.tsx         # LLM settings
│   ├── TraceabilityMatrix.tsx      # Coverage view
│   │
│   ├── FlowstralWorkflowEditor/    # Workflow components
│   │   ├── FlowstralWorkflowEditor.tsx
│   │   ├── WorkflowNodes.tsx
│   │   ├── LocatorBuilder.tsx
│   │   ├── TestRunner.tsx
│   │   ├── VariableStore.tsx
│   │   ├── ScheduleManager.tsx
│   │   └── CICDExporter.tsx
│   │
│   ├── salesforce/                 # 15+ SF components
│   │   ├── SFContextDashboard.tsx
│   │   ├── SmartSOQLBuilder.tsx
│   │   └── StageTransitionTester.tsx
│   │
│   ├── verifications/              # Complex verifications
│   │   ├── EmailVerifyStepConfig.tsx
│   │   ├── PDFVerifyStepConfig.tsx
│   │   └── FileVerifyStepConfig.tsx
│   │
│   └── ui/                         # shadcn/ui (50+)
│       ├── button.tsx, card.tsx
│       └── ... (50+ components)
│
├── pages/                          # 60+ pages
│   ├── Dashboard.tsx
│   ├── PlaywrightRecorderPage.tsx
│   ├── UnifiedWorkflowEditor.tsx
│   ├── TestRepository.tsx
│   ├── EnhancedAPITesting.tsx
│   ├── VirtualUserGenerator.tsx
│   ├── SalesforceToolsPage.tsx
│   └── ... (50+ more)
│
├── hooks/                          # Custom hooks
│   ├── useExecutionWebSocket.ts
│   ├── use-toast.ts
│   └── use-mobile.tsx
│
├── lib/                            # Services & utilities
│   ├── api-config.ts
│   ├── data-storage.ts
│   ├── test-execution-service.ts
│   ├── results-ingestion-service.ts
│   ├── salesforce-api.ts
│   └── utils.ts
│
├── contexts/                       # React contexts
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── AIContext.tsx
│
└── types/                          # TypeScript types
    └── api.d.ts
```

---

## Application Entry

### `App.tsx`

Root component with module-based routing:

```typescript
/**
 * CORE MODULES:
 * 1. Recorder - Browser test recording (PlaywrightRecorderPage)
 * 2. Builder - Visual workflow editor (UnifiedWorkflowEditor)
 * 3. Tests - Test repository (TestRepository)
 * 4. Automation - Test execution (TestCaseExecution, TestRuns)
 * 5. Performance - Load testing (VirtualUserGenerator)
 * 6. API Testing - REST & GraphQL (EnhancedAPITesting)
 * 7. Accessibility - WCAG scanning (Accessibility)
 */

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AIProvider>
      <TooltipProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
                  {/* Routes */}
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
        </AIProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};
```

---

## Routing

### Core Modules

| Module | Path | Component |
|--------|------|-----------|
| **Recorder** | `/recorder` | PlaywrightRecorderPage |
| **Builder** | `/test-cases/builder` | UnifiedWorkflowEditor |
| **Repository** | `/test-cases` | TestRepository |
| **Execution** | `/test-runs` | TestRuns |
| **API Testing** | `/api` | EnhancedAPITesting |
| **Performance** | `/performance` | VirtualUserGenerator |
| **Salesforce** | `/salesforce` | SalesforceToolsPage |

### Full Route Map

```typescript
// Public Routes
<Route path="/" element={<LandingPage />} />
<Route path="/auth" element={<AuthPage />} />
<Route path="/pricing" element={<PricingPage />} />
<Route path="/about" element={<AboutPage />} />

// Main Application (StreamlinedLayout)
<Route path="/recorder" element={<PlaywrightRecorderPage />} />
<Route path="/test-cases" element={<TestRepository />} />
<Route path="/test-cases/builder" element={<UnifiedWorkflowEditor />} />
<Route path="/test-cases/builder/:id" element={<UnifiedWorkflowEditor />} />
<Route path="/test-cases/execute/:testCaseId" element={<TestCaseExecution />} />
<Route path="/test-runs" element={<TestRuns />} />

// API Testing
<Route path="/api" element={<EnhancedAPITesting />} />
<Route path="/api/collections" element={<EnhancedAPITesting />} />

// Performance
<Route path="/performance" element={<VirtualUserGenerator />} />
<Route path="/performance/load-test" element={<VirtualUserGenerator />} />

// Salesforce
<Route path="/salesforce" element={<SalesforceToolsPage />} />

// Quality
<Route path="/accessibility" element={<Accessibility />} />
<Route path="/visual-testing" element={<VisualTestingPage />} />
<Route path="/self-healing" element={<SelfHealing />} />

// Management
<Route path="/dashboard" element={<Dashboard />} />
<Route path="/analytics" element={<Analytics />} />
<Route path="/results" element={<Results />} />
<Route path="/suites" element={<TestSuites />} />
<Route path="/plans" element={<TestPlans />} />
<Route path="/requirements" element={<Requirements />} />
<Route path="/defects" element={<Defects />} />
<Route path="/traceability" element={<Traceability />} />

// Tools
<Route path="/code-alchemy" element={<CodeAlchemy />} />
<Route path="/framework-analyzer" element={<FrameworkAnalyzer />} />
<Route path="/elements" element={<ElementRepository />} />
<Route path="/secrets" element={<SecretsVault />} />
<Route path="/coverage" element={<APICoverageMap />} />

// Integration
<Route path="/integrations" element={<Integrations />} />
<Route path="/cicd" element={<CICDIntegration />} />
<Route path="/settings" element={<Settings />} />
```

---

## Pages Reference

### Unified Workflow Editor (`UnifiedWorkflowEditor.tsx`)

**Purpose:** Primary test building interface (3100+ lines)

**Key Features:**
- No-Code / Code View toggle
- Multi-export (Automation, API, Database, Performance, Manual)
- Save / Save As functionality
- 20+ assertion types
- Precondition import
- Documentation export (ISTQB, Gherkin, Markdown)
- Duplicate element handling (nth selector)

**State:**
```typescript
interface UnifiedTestCase {
  id: string;
  name: string;
  description: string;
  type: 'ui' | 'api' | 'database' | 'performance' | 'manual';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  steps: TestStep[];
  preconditions: PreconditionRef[];
  requirements: string[];
}

interface TestStep {
  id: string;
  type: 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'api' | 'database';
  target: string;
  selector?: string;
  value?: string;
  expectedResult?: string;
  elementIndex?: number;
  assertionType?: string;
  assertionTarget?: string;
  assertionValue?: string;
}
```

### Virtual User Generator (`VirtualUserGenerator.tsx`)

**Purpose:** Performance testing interface (2700+ lines)

**Load Patterns:**
```typescript
const LOAD_PATTERNS = {
  constant: "Constant Load",
  ramp_up: "Ramp Up",
  ramp_down: "Ramp Down",
  spike: "Spike Test",
  stress: "Stress Test",
  soak: "Soak/Endurance",
  breakpoint: "Breakpoint",
  wave: "Wave Pattern"
};
```

**User Personas:**
```typescript
const USER_PERSONAS = {
  casual: { thinkTime: { min: 3000, max: 8000 } },
  normal: { thinkTime: { min: 1000, max: 3000 } },
  power: { thinkTime: { min: 500, max: 1500 } },
  automated: { thinkTime: { min: 0, max: 100 } }
};
```

### Salesforce Tools (`SalesforceToolsPage.tsx`)

**Purpose:** SF testing tools (2500+ lines)

**15+ Tools:**
1. Multi-Org Manager
2. SOQL Builder
3. Bulk Data Loader
4. REST API Playground
5. Test Data Factory
6. Schema Browser
7. Record Inspector
8. Apex Test Runner
9. Data Seeding Templates
10. Permission Analyzer
11. Debug Log Analyzer
12. Relationship Visualizer
13. Record Cloner
14. Data Diff
15. Assertion Builder

### Enhanced API Testing (`EnhancedAPITesting.tsx`)

**Purpose:** Multi-protocol API testing

**Features:**
- Request builder
- Collection management
- Environment variables
- Request history
- Response assertions
- GraphQL support
- WebSocket testing

### Accessibility (`Accessibility.tsx`)

**Purpose:** WCAG compliance scanning

**Features:**
- URL scanning
- Component scanning
- Site-wide audit
- VPAT generation
- Violation reports
- Remediation suggestions

### Dashboard (`Dashboard.tsx`)

**Purpose:** Executive dashboard

**Metrics:**
- Pass rate
- Test execution count
- Average duration
- Automation rate
- Recent activity
- Trend charts

### Test Repository (`TestRepository.tsx`)

**Purpose:** Unified test management

**Features:**
- Test case list
- Search and filter
- Bulk operations
- Suite assignment
- Quick execution
- Import/export

---

## Components

### Layout Components

| Component | Purpose |
|-----------|---------|
| `StreamlinedLayout` | Main app layout with sidebar |
| `AppSidebar` | Navigation sidebar |
| `TopNav` | Top navigation bar |
| `Layout` | Legacy layout wrapper |

### Workflow Components

| Component | Purpose |
|-----------|---------|
| `FlowstralWorkflowEditor` | Visual workflow builder |
| `WorkflowNodes` | Node type definitions |
| `LocatorBuilder` | Selector construction |
| `TestRunner` | Execution panel |
| `VariableStore` | Variable management |
| `ScheduleManager` | Scheduled runs |
| `CICDExporter` | Pipeline export |

### Salesforce Components

| Component | Purpose |
|-----------|---------|
| `SFContextDashboard` | Org overview |
| `SmartSOQLBuilder` | Visual SOQL |
| `StageTransitionTester` | Process testing |
| `SalesforceRelationshipVisualizer` | ERD |
| `SalesforceDebugLogAnalyzer` | Log parser |
| `SalesforceAssertionBuilder` | SF assertions |
| `SalesforceRecordCloner` | Deep clone |
| `SalesforceDataDiff` | Record comparison |
| `SalesforceApexExecutor` | Anonymous Apex |
| `SalesforceFieldAnalyzer` | Field analysis |
| `SalesforceReportRunner` | Report execution |
| `SoqlEditor` | SOQL with autocomplete |

### Verification Components

| Component | Purpose |
|-----------|---------|
| `EmailVerifyStepConfig` | Email verification setup |
| `PDFVerifyStepConfig` | PDF verification setup |
| `FileVerifyStepConfig` | File verification setup |

### UI Components (shadcn/ui)

50+ components including:

| Component | Usage |
|-----------|-------|
| `Button` | Actions |
| `Card` | Containers |
| `Dialog` | Modals |
| `Input` | Text fields |
| `Select` | Dropdowns |
| `Table` | Data tables |
| `Tabs` | Tab navigation |
| `Toast` | Notifications |
| `Badge` | Status indicators |
| `Progress` | Loading bars |
| `Slider` | Range input |
| `Switch` | Toggles |
| `Checkbox` | Boolean input |
| `Textarea` | Multi-line |
| `Popover` | Floating content |

---

## Hooks

### `useExecutionWebSocket`

Real-time test execution updates:

```typescript
interface UseExecutionWebSocketOptions {
  onStepStart?: (step: number, name: string) => void;
  onStepComplete?: (step: number, status: string, duration: number) => void;
  onSelfHealing?: (step: number, original: string, healed: string) => void;
  onScreenshot?: (step: number, type: string, path?: string) => void;
  onComplete?: (status: string, total: number, passed: number, failed: number) => void;
  onLog?: (level: string, message: string) => void;
}

export function useExecutionWebSocket(options: UseExecutionWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState({...});

  const connect = useCallback((executionId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/test-runs/ws/${executionId}`);
    // Handle messages
  }, []);

  return { connect, disconnect, isConnected, progress };
}
```

### `use-toast`

Toast notifications:

```typescript
const { toast } = useToast();

toast({
  title: "Success",
  description: "Test case saved",
  variant: "default" // or "destructive"
});
```

### `use-mobile`

Responsive detection:

```typescript
const isMobile = useMobile();
```

---

## Services & Libraries

### API Configuration (`api-config.ts`)

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  TEST_CASES: `${API_BASE_URL}/test-cases`,
  TEST_RUNS: `${API_BASE_URL}/test-runs`,
  FLOWSTRAL_SESSIONS: `${API_BASE_URL}/api/flowstral/sessions`,
  FLOWSTRAL_EXECUTE: `${API_BASE_URL}/api/playwright-recorder/execute`,
  LLM_GENERATE: `${API_BASE_URL}/api/llm/generate-test`,
};
```

### Data Storage (`data-storage.ts`)

```typescript
class DataStorageService {
  async createTestCase(testCase: Omit<TestCase, 'id'>): Promise<TestCase>
  async getTestCases(planId?: string): Promise<TestCase[]>
  async updateTestCase(id: string, updates: Partial<TestCase>): Promise<TestCase>
  async deleteTestCase(id: string): Promise<void>
  initializeSampleData(): void
}

export const dataStorageService = new DataStorageService();
```

### Results Ingestion (`results-ingestion-service.ts`)

```typescript
interface TestRunData {
  id: string;
  test_case_id?: string;
  test_name?: string;
  status: 'passed' | 'failed' | 'error' | 'skipped';
  duration_ms: number;
  started_at: string;
  completed_at: string;
  metadata?: {
    failed_step?: number;
    error_message?: string;
    screenshot_path?: string;
  };
}

class ResultsIngestionService {
  async ingestResults(data: TestRunData): Promise<void>
  getAllResults(): TestRunData[]
  getResultsByStatus(status: string): TestRunData[]
  clearResults(): void
}

export const resultsIngestionService = new ResultsIngestionService();
```

### Salesforce API (`salesforce-api.ts`)

```typescript
export const salesforceApi = {
  // Connection
  getAuthStatus(): Promise<AuthStatus>
  connectOAuth(): void
  disconnect(): Promise<void>
  
  // Data
  query(soql: string): Promise<QueryResult>
  getObject(name: string): Promise<SObjectDescribe>
  createRecord(object: string, data: any): Promise<string>
  updateRecord(object: string, id: string, data: any): Promise<void>
  
  // Testing
  runApexTests(testClasses: string[]): Promise<ApexTestResult>
  executeAnonymous(code: string): Promise<ExecutionResult>
};
```

---

## State Management

### React Query (Server State)

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ['testCases'],
  queryFn: () => fetch('/test-cases').then(r => r.json())
});

const mutation = useMutation({
  mutationFn: (newCase) => fetch('/test-cases', {
    method: 'POST',
    body: JSON.stringify(newCase)
  }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['testCases'] });
  }
});
```

### Zustand (Client State)

```typescript
// Example store
const useStore = create((set) => ({
  selectedTestCase: null,
  setSelectedTestCase: (tc) => set({ selectedTestCase: tc })
}));
```

### Context (Global State)

```typescript
// AuthContext
const { user, login, logout } = useAuth();

// ThemeContext  
const { theme, setTheme } = useTheme();

// AIContext
const { provider, model, setProvider, setModel } = useAI();
```

### localStorage (Persistence)

```typescript
// Initialize from storage
const [history, setHistory] = useState(() => {
  const saved = localStorage.getItem('test_history');
    return saved ? JSON.parse(saved) : [];
});

// Save on change
useEffect(() => {
  localStorage.setItem('test_history', JSON.stringify(history));
}, [history]);
```

---

## Styling

### Tailwind CSS

```typescript
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-sm">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### CSS Variables

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --secondary: 210 40% 96%;
  --muted: 210 40% 96%;
  --accent: 210 40% 96%;
  --destructive: 0 84.2% 60.2%;
  --border: 214.3 31.8% 91.4%;
  --radius: 0.5rem;
}
```

### Dark Mode

```typescript
// ThemeContext handles dark/light toggle
const { theme, setTheme } = useTheme();

// CSS classes
className="bg-background text-foreground"
className="dark:bg-gray-900 dark:text-white"
```

---

*Last updated: January 11, 2026*
