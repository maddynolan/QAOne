# Frontend Reference Guide

> **React/TypeScript Application Documentation**  
> UI Components, Pages, Hooks, and Services

## Table of Contents

1. [Directory Structure](#directory-structure)
2. [Application Entry](#application-entry)
3. [Routing](#routing)
4. [Pages Reference](#pages-reference)
5. [Components](#components)
6. [Hooks](#hooks)
7. [Services & Libraries](#services--libraries)
8. [State Management](#state-management)
9. [Styling](#styling)

---

## Directory Structure

```
src/
├── App.tsx                         # Root component, route definitions
├── main.tsx                        # Application entry point
├── index.css                       # Global styles (Tailwind CSS)
├── vite-env.d.ts                   # Vite type declarations
│
├── components/
│   ├── Layout.tsx                  # Main layout wrapper with sidebar
│   ├── AppSidebar.tsx              # Navigation sidebar (sidebar.tsx)
│   ├── TopNav.tsx                  # Top navigation bar
│   ├── ProtectedRoute.tsx          # Route guards (auth)
│   ├── MetricCard.tsx              # Dashboard metric display
│   ├── QualityRating.tsx           # Quality score display
│   ├── TraceabilityMatrix.tsx      # Requirements traceability view
│   ├── WorkspaceSwitcher.tsx       # Organization/project switcher
│   ├── AIConfiguration.tsx         # LLM settings panel
│   ├── EditAndImprove.tsx          # AI improvement suggestions
│   │
│   ├── FlowstralWorkflowEditor/    # Workflow editor components
│   │   ├── index.ts                # Exports
│   │   ├── FlowstralWorkflowEditor.tsx
│   │   ├── WorkflowNodes.tsx       # Node type definitions
│   │   ├── LocatorBuilder.tsx      # Selector builder UI
│   │   ├── TestRunner.tsx          # Test execution panel
│   │   ├── TestSuiteManager.tsx    # Suite organization
│   │   ├── VariableStore.tsx       # Variable management
│   │   ├── ScheduleManager.tsx     # Scheduled run config
│   │   └── CICDExporter.tsx        # CI/CD pipeline export
│   │
│   ├── TestCaseGenerator/
│   │   └── TestCaseGenerator.tsx   # AI test generation UI
│   │
│   └── ui/                         # shadcn/ui components (50+)
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── select.tsx
│       ├── table.tsx
│       ├── tabs.tsx
│       ├── toast.tsx
│       └── ... (45+ more)
│
├── pages/                          # Route components (60+)
│   ├── Dashboard.tsx               # Main dashboard
│   ├── TestCases.tsx               # Test case list
│   ├── CreateTestCase.tsx          # Test case creation
│   ├── EditTestCase.tsx            # Test case editing
│   ├── EnhancedWorkflowEditor.tsx  # Visual test builder (2700+ lines)
│   ├── TestResultsDashboard.tsx    # Analytics dashboard
│   ├── TestRuns.tsx                # Test run list
│   ├── TestRunDetail.tsx           # Single run details
│   ├── Trace.tsx                   # Recording interface
│   ├── Requirements.tsx            # Requirements management
│   └── ... (50+ more pages)
│
├── hooks/
│   ├── useExecutionWebSocket.ts    # Real-time test updates
│   ├── use-toast.ts                # Toast notifications
│   └── use-mobile.tsx              # Mobile detection
│
├── lib/
│   ├── api-config.ts               # API endpoint configuration
│   ├── data-storage.ts             # Data persistence layer
│   ├── test-execution-service.ts   # Test execution client
│   ├── test-management-service.ts  # Test case CRUD
│   ├── self-healing-service.ts     # Self-healing client
│   ├── ai-service.ts               # AI generation client
│   ├── utils.ts                    # Utility functions
│   └── types.ts                    # Shared TypeScript types
│
├── contexts/
│   └── AuthContext.tsx             # Authentication state
│
├── integrations/
│   └── supabase/
│       ├── client.ts               # Supabase client config
│       └── types.ts                # Supabase type definitions
│
└── types/
    └── api.d.ts                    # API type declarations
```

---

## Application Entry

### `main.tsx`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

### `App.tsx`

The root component sets up:
- React Query provider
- Toast providers (both Toaster and Sonner)
- Tooltip provider
- Authentication provider
- BrowserRouter with all routes

```typescript
const App = () => {
  useEffect(() => {
    dataStorageService.initializeSampleData();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              {/* Routes defined here */}
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};
```

---

## Routing

### Route Structure

| Path | Component | Description |
|------|-----------|-------------|
| `/` | Dashboard | Main dashboard |
| `/auth` | AuthPage | Login/signup |
| `/onboarding` | OnboardingPage | New user setup |
| `/plans` | TestPlans | Test plan list |
| `/plans/create` | CreateTestPlan | New test plan |
| `/plans/:id` | TestPlanDetail | Plan details |
| `/cases` | TestCases | Test case list |
| `/cases/create` | CreateTestCase | New test case |
| `/cases/:id/edit` | EditTestCase | Edit test case |
| `/runs` | TestRuns | Test run list |
| `/runs/create` | CreateTestRun | New test run |
| `/runs/:id` | TestRunDetail | Run details |
| `/workflow-editor` | EnhancedWorkflowEditor | Visual builder |
| `/results-dashboard` | TestResultsDashboard | Analytics |
| `/trace` | Trace | Recording interface |
| `/requirements` | Requirements | Requirements list |
| `/defects` | Defects | Defect tracking |
| `/self-healing` | SelfHealing | Self-healing config |
| `/integrations` | Integrations | External integrations |
| `/settings` | Settings | Application settings |

### Protected Routes

```typescript
<Route path="/" element={
  <ProtectedRoute>
    <Layout><Dashboard /></Layout>
  </ProtectedRoute>
} />
```

### Public Routes

```typescript
<Route path="/auth" element={
  <PublicRoute><AuthPage /></PublicRoute>
} />
```

---

## Pages Reference

### Dashboard (`pages/Dashboard.tsx`)

**Purpose:** Main landing page with key metrics and quick actions.

**Key Features:**
- Summary statistics (test cases, runs, pass rate)
- Recent test runs
- Quick action buttons
- Trend charts

### Enhanced Workflow Editor (`pages/EnhancedWorkflowEditor.tsx`)

**Purpose:** Visual test case builder with multi-framework export.

**File Size:** ~2700 lines

**Key State:**

```typescript
// Workflow state
const [workflowName, setWorkflowName] = useState('New Workflow');
const [appType, setAppType] = useState('generic');
const [framework, setFramework] = useState('playwright-python');
const [nodes, setNodes] = useState<WorkflowNode[]>([]);
const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);

// Mode state
const [testMode, setTestMode] = useState<'manual' | 'automated' | 'both'>('both');
const [blackboxMode, setBlackboxMode] = useState(false);

// Execution state
const [isRunning, setIsRunning] = useState(false);
const [runResult, setRunResult] = useState<any>(null);
const [executionProgress, setExecutionProgress] = useState({...});

// Save state
const [savedTestCaseId, setSavedTestCaseId] = useState<string | null>(null);
```

**Key Functions:**

```typescript
// Convert JS selectors to framework-specific
const convertSelectorToFramework = useCallback((sel: string): string => {
  // Handles: getByRole, getByText, getByLabel, page.getByX, CSS selectors
});

// Generate code for single node
const generateNodeCode = useCallback((node: WorkflowNode): string => {
  switch (framework) {
    case 'playwright-python': // Python syntax
    case 'playwright-typescript': // TS syntax
    case 'selenium-java': // Java syntax
    case 'cypress': // Cypress syntax
  }
});

// Run the workflow
const runWorkflow = async () => {
  // 1. Generate full script
  // 2. Connect WebSocket
  // 3. POST to /api/playwright-recorder/execute
  // 4. Update progress from WebSocket
  // 5. Handle results
};

// Save test case
const saveUnifiedTestCase = useCallback(async (customName?: string) => {
  // POST to /test-cases (create) or PUT (update)
});
```

**Node Types:**

| Type | Description |
|------|-------------|
| navigate | Go to URL |
| click | Click element |
| input | Enter text |
| wait | Wait for time/element |
| assert | Verify condition |
| api | Make API call |
| database | Query database |
| condition | If/else branch |
| loop | Repeat steps |
| screenshot | Capture screen |

**Assertion Types:**

| Type | Description |
|------|-------------|
| visible | Element is visible |
| hidden | Element is hidden |
| enabled | Element is enabled |
| disabled | Element is disabled |
| text_equals | Text exactly matches |
| text_contains | Text contains substring |
| url_equals | URL matches |
| url_contains | URL contains |
| title_equals | Page title matches |
| element_count | Number of elements |
| value_equals | Input value matches |
| checked | Checkbox is checked |

### Test Cases (`pages/TestCases.tsx`)

**Purpose:** List and manage test cases.

**Data Loading:**

```typescript
const loadTestCases = async () => {
  const allCases: TestCase[] = [];
  
  // 1. Load from localStorage (instant)
  const local = JSON.parse(localStorage.getItem('test_cases') || '[]');
  allCases.push(...local);
  
  // 2. Fetch from backend (with timeout)
  const response = await fetch(`${API_BASE_URL}/test-cases`, {
    signal: AbortSignal.timeout(3000)
  });
  
  if (response.ok) {
    const data = await response.json();
    const backendCases = Array.isArray(data) ? data : (data.value || data.test_cases || []);
    // Merge, dedupe by ID
  }
  
  setTestCases(allCases);
};
```

### Test Results Dashboard (`pages/TestResultsDashboard.tsx`)

**Purpose:** Comprehensive analytics and self-healing statistics.

**Data Sources:**
- Backend API (`/test-runs`)
- localStorage (`workflow_test_history`)

**Key Metrics:**
- Total runs, pass rate
- Average duration
- Self-healing count and success rate
- Runs by environment
- Screenshot gallery

### Trace (Recording) (`pages/Trace.tsx`)

**Purpose:** Interface for Flowstral recording sessions.

**Key Features:**
- Session management
- Event visualization
- Script preview
- Export to Workflow Editor

---

## Components

### Layout (`components/Layout.tsx`)

Wraps pages with consistent layout:

```typescript
export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <TopNav />
          <main className="flex-1 p-6 bg-gray-50 overflow-auto">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
```

### AppSidebar (`components/AppSidebar.tsx`)

Navigation sidebar with sections:

```typescript
const navItems = [
  // OVERVIEW
  { title: "Dashboard", url: "/", icon: Home },
  { title: "Projects", url: "/projects", icon: Folder },
  { title: "Analytics", url: "/analytics", icon: BarChart2 },
  
  // CREATE & BUILD
  { title: "Trace (Record)", url: "/trace", icon: Video },
  { title: "Workflow Editor", url: "/workflow-editor", icon: Workflow },
  
  // EXECUTE
  { title: "Test Execution", url: "/test-execution", icon: Play },
  { title: "Results Dashboard", url: "/results-dashboard", icon: BarChart3 },
  { title: "Test Cases", url: "/cases", icon: FileText },
  
  // QUALITY
  { title: "Self-Healing", url: "/self-healing", icon: Wrench },
  { title: "Requirements", url: "/requirements", icon: ClipboardList },
  { title: "Defects", url: "/defects", icon: Bug },
  
  // SETTINGS
  { title: "Integrations", url: "/integrations", icon: Plug },
  { title: "Settings", url: "/settings", icon: Settings },
];
```

### UI Components (`components/ui/`)

Based on [shadcn/ui](https://ui.shadcn.com/), includes:

| Component | Usage |
|-----------|-------|
| Button | Actions, submit, cancel |
| Card | Content containers |
| Dialog | Modal windows |
| Input | Text input fields |
| Select | Dropdown selection |
| Table | Data tables |
| Tabs | Tabbed content |
| Toast | Notifications |
| Badge | Status indicators |
| Progress | Loading/progress bars |

**Example Usage:**

```typescript
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Card>
  <CardHeader>
    <CardTitle>Test Results</CardTitle>
  </CardHeader>
  <CardContent>
    <Button onClick={runTest}>Run Test</Button>
  </CardContent>
</Card>
```

---

## Hooks

### `useExecutionWebSocket`

Real-time test execution updates via WebSocket.

**File:** `hooks/useExecutionWebSocket.ts`

```typescript
interface UseExecutionWebSocketOptions {
  onStepStart?: (step: number, name: string) => void;
  onStepComplete?: (step: number, status: string, duration: number, error?: string, screenshot?: string) => void;
  onSelfHealing?: (step: number, original: string, healed: string) => void;
  onScreenshot?: (step: number, type: string, data?: string, path?: string) => void;
  onComplete?: (status: string, totalSteps: number, passedSteps: number, failedSteps: number) => void;
  onLog?: (level: string, message: string) => void;
}

export function useExecutionWebSocket(options: UseExecutionWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState({...});
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback((executionId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/test-runs/ws/${executionId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'step_start':
          options.onStepStart?.(data.step, data.name);
          break;
        case 'step_complete':
          options.onStepComplete?.(data.step, data.status, data.duration_ms);
          break;
        case 'self_healing':
          options.onSelfHealing?.(data.step, data.original_selector, data.healed_selector);
          break;
        case 'execution_complete':
          options.onComplete?.(data.status, data.total_steps, data.passed_steps, data.failed_steps);
          break;
      }
    };
    
    wsRef.current = ws;
  }, [options]);

  const disconnect = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    setIsConnected(false);
  }, []);

  return { connect, disconnect, isConnected, progress, reset };
}
```

**Usage:**

```typescript
const { connect, disconnect, isConnected, progress } = useExecutionWebSocket({
  onStepStart: (step, name) => {
    setExecutionProgress(prev => ({ ...prev, currentStep: step, stepName: name }));
  },
  onStepComplete: (step, status, duration) => {
    // Update step result
  },
  onSelfHealing: (step, original, healed) => {
    toast.info(`Step ${step}: Selector healed`);
  },
  onComplete: (status) => {
    setIsRunning(false);
    if (status === 'passed') toast.success('Test passed!');
  }
});
```

### `use-toast`

Toast notification hook (from shadcn/ui).

```typescript
import { useToast } from "@/hooks/use-toast";

const { toast } = useToast();

toast({
  title: "Success",
  description: "Test case saved",
  variant: "default" // or "destructive"
});
```

---

## Services & Libraries

### API Configuration (`lib/api-config.ts`)

```typescript
export const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  // Test Cases
  TEST_CASES: `${API_BASE_URL}/test-cases`,
  TEST_CASE: (id: string) => `${API_BASE_URL}/test-cases/${id}`,
  
  // Test Runs
  TEST_RUNS: `${API_BASE_URL}/test-runs`,
  TEST_RUN: (id: string) => `${API_BASE_URL}/test-runs/${id}`,
  
  // Flowstral
  FLOWSTRAL_SESSIONS: `${API_BASE_URL}/api/flowstral/sessions`,
  FLOWSTRAL_EXECUTE: `${API_BASE_URL}/api/playwright-recorder/execute`,
  
  // LLM
  LLM_GENERATE: `${API_BASE_URL}/api/llm/generate-test`,
};
```

### Data Storage (`lib/data-storage.ts`)

Handles data persistence with backend fallback.

```typescript
class DataStorageService {
  private baseUrl = API_BASE_URL;

  async createTestCase(testCase: Omit<TestCase, 'id'>): Promise<TestCase> {
    const response = await fetch(`${this.baseUrl}/test-cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testCase)
    });
    return response.json();
  }

  async getTestCases(planId?: string): Promise<TestCase[]> {
    // Fetch from multiple sources, merge, dedupe
  }

  initializeSampleData(): void {
    // Initialize sample data for demo
  }
}

export const dataStorageService = new DataStorageService();
```

### Test Execution Service (`lib/test-execution-service.ts`)

Client for test execution API.

```typescript
class TestExecutionService {
  async executeTest(request: ExecuteTestRequest): Promise<ExecutionResult> {
    const response = await fetch(`${API_BASE_URL}/api/playwright-recorder/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    return response.json();
  }

  async getTestRun(id: string): Promise<TestRun> {
    const response = await fetch(`${API_BASE_URL}/test-runs/${id}`);
    return response.json();
  }
}

export const testExecutionService = new TestExecutionService();
```

---

## State Management

### Pattern: useState + useCallback

Most components use React hooks for local state:

```typescript
// Simple state
const [items, setItems] = useState<Item[]>([]);
const [loading, setLoading] = useState(false);

// Computed state via useMemo
const filteredItems = useMemo(() => 
  items.filter(i => i.name.includes(search)),
  [items, search]
);

// Actions via useCallback
const addItem = useCallback((item: Item) => {
  setItems(prev => [...prev, item]);
}, []);
```

### Pattern: React Query (Async Data)

For server data fetching:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['testCases'],
  queryFn: () => fetch('/test-cases').then(r => r.json())
});

// Mutations
const queryClient = useQueryClient();
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

### Pattern: Context (Global State)

For cross-component state like auth:

```typescript
// contexts/AuthContext.tsx
interface AuthContextType {
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>(null!);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  
  const login = async (credentials: Credentials) => {
    // API call, set user
  };
  
  const logout = () => {
    setUser(null);
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Pattern: localStorage Persistence

For persisting state across sessions:

```typescript
// Initialize from localStorage
const [testHistory, setTestHistory] = useState<TestHistoryEntry[]>(() => {
  try {
    const saved = localStorage.getItem('workflow_test_history');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
});

// Save to localStorage on change
useEffect(() => {
  localStorage.setItem('workflow_test_history', JSON.stringify(testHistory));
}, [testHistory]);
```

---

## Styling

### Tailwind CSS

Primary styling via Tailwind utility classes:

```typescript
<div className="flex items-center gap-4 p-6 bg-white rounded-lg shadow-sm">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

### CSS Variables (Theme)

Defined in `index.css`:

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --popover: 0 0% 100%;
  --popover-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222.2 47.4% 11.2%;
  --muted: 210 40% 96%;
  --muted-foreground: 215.4 16.3% 46.9%;
  --accent: 210 40% 96%;
  --accent-foreground: 222.2 47.4% 11.2%;
  --destructive: 0 84.2% 60.2%;
  --destructive-foreground: 210 40% 98%;
  --border: 214.3 31.8% 91.4%;
  --input: 214.3 31.8% 91.4%;
  --ring: 222.2 84% 4.9%;
  --radius: 0.5rem;
}
```

### Custom Classes

```css
.gradient-text {
  background: linear-gradient(135deg, #3b82f6, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

---

*Last updated: December 2024*
