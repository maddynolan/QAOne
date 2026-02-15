/**
 * @module api-testing
 * @page EnhancedAPITesting
 *
 * Main multi-protocol API testing page (~200KB). Full-featured API testing
 * environment supporting REST, SOAP, GraphQL, gRPC, Kafka, MQTT, WebSocket,
 * and AMQP protocols with collections, environments, request chaining, and
 * Monaco code editor.
 *
 * @features
 * - Multi-protocol API request builder (8 protocols)
 * - Collection and folder organization with drag-drop
 * - Environment variable management and substitution
 * - Request chaining with variable extraction (JSONPath, regex)
 * - Monaco editor for request/response body
 * - 11 assertion types with pass/fail display
 * - OpenAPI/Swagger/Postman/HAR spec import
 * - Inline rename for folders and requests
 *
 * @api /api/v2/testing/* - Multi-protocol API testing (46 endpoints)
 * @api /api/import/* - Spec import (9 endpoints)
 * @api /api/chain/* - Request chaining (9 endpoints)
 *
 * @dependencies EnhancedAPITesting uses apiTestingStore (Zustand), Monaco Editor, shadcn/ui
 */
import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, FileText, Code, Download, CheckCircle2, AlertCircle, 
  Database, Play, BarChart3, Server, Settings, TrendingUp,
  Zap, Shield, Activity, Globe, Loader2, Eye, Copy, X,
  FileCode, Rocket, BookOpen, Network, MessageSquare, Radio,
  Workflow, RefreshCw, Link, ExternalLink, Trash2, Plus,
  Send, Link2, ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, FolderOpen, Folder
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestBuilder, { type InitialRequestData } from "@/modules/api-testing/components/RequestBuilder";
import RequestChainBuilder from "@/modules/api-testing/components/RequestChainBuilder";
import TabErrorBoundary from "@/modules/api-testing/components/TabErrorBoundary";
import EnvironmentManagerComponent, { type EnvironmentConfig, normalizeVariables, resolveVariables } from "@/modules/api-testing/components/EnvironmentManager";
import CollectionSidebar from "@/modules/api-testing/components/CollectionSidebar";
import { CodeEditor, ResponseCodeViewer } from "@/modules/api-testing/components/CodeEditor";
import DataDrivenPanel from "@/modules/api-testing/components/DataDrivenPanel";
import MockServerPanel from "@/modules/api-testing/components/MockServerPanel";
import SecurityScanPanel from "@/modules/api-testing/components/SecurityScanPanel";
import WebSocketClient from "@/modules/api-testing/components/WebSocketClient";
import { useApiTestingStore } from "@/modules/api-testing/store/apiTestingStore";

import { API_BASE_URL } from "@/lib/api-config";
import { ensureTestSuiteFolders } from "@/modules/api-testing/lib/api-testing-utils";
import { PROTOCOL_TEMPLATES } from "@/modules/api-testing/constants/protocol-templates";
import { INLINE_ASSERTION_TYPES, INLINE_ASSERTION_OPERATORS } from "@/modules/api-testing/constants/assertion-constants";
import {
  exportAsJUnitXML as _exportJUnit,
  exportAsHTML as _exportHTML,
  exportAsJSON as _exportJSON,
  exportAsAllure as _exportAllure,
  generateJUnitXMLContent,
  generateHTMLContent,
  generateAllureContent,
} from "@/modules/api-testing/lib/report-export";
import { exportToPostman as _exportToPostman, exportToHAR as _exportToHAR } from "@/modules/api-testing/lib/collection-export";
import {
  loadPersistedEnvironments,
  saveEnvironmentsToLocalStorage,
  saveEnvironmentToDb,
  loadEnvironments as _loadEnvironments,
} from "@/modules/api-testing/lib/environment-persistence";

export default function EnhancedAPITesting() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("builder");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flowstral integration state
  const [flowstralSessions, setFlowstralSessions] = useState<any[]>([]);
  const [loadingFlowstral, setLoadingFlowstral] = useState(false);
  
  // Mock server full UI state (zero-code; no getElementById)
  const [mockServers, setMockServers] = useState<any[]>([]);
  const [selectedMockServerId, setSelectedMockServerId] = useState("");
  const [mockForm, setMockForm] = useState({
    method: "GET",
    path: "",
    status: 200,
    body: '{\n  "message": "Hello"\n}',
    dynamic: true,
  });
  const [mockLogs, setMockLogs] = useState<any[]>([]);
  const [mockLogsServerId, setMockLogsServerId] = useState<string | null>(null);
  const [mockVerifyResult, setMockVerifyResult] = useState<any>(null);
  const [mockVerifyForm, setMockVerifyForm] = useState({ method: "GET", path: "", expected_count: undefined as number | undefined, body_contains: "" });
  const [mockServerInfo, setMockServerInfo] = useState<any>(null);

  // Virtual service creation state  
  const [newVirtualService, setNewVirtualService] = useState({
    name: "",
    base_url: "",
    endpoints: [] as any[]
  });
  
  // Debug: Log component mount
  useEffect(() => {
    console.log("EnhancedAPITesting component mounted");
    return () => {
      console.log("EnhancedAPITesting component unmounted");
    };
  }, []);
  
  // Import state
  const [specFormat, setSpecFormat] = useState("openapi");
  const [protocol, setProtocol] = useState("REST");
  const [specContent, setSpecContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedSpec, setParsedSpec] = useState<any>(null);
  const [testSuite, setTestSuite] = useState<any>(null);
  // Import selection state — for selective "Add to Collection"
  const [selectedImportItems, setSelectedImportItems] = useState<Set<string>>(new Set());
  const [importBaseUrl, setImportBaseUrl] = useState("");
  const [importFetchUrl, setImportFetchUrl] = useState("");
  const [suiteLoading, setSuiteLoading] = useState(true);
  const suiteLoadedFromBackend = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Database state
  const [dbConnections, setDbConnections] = useState<any[]>([]);
  const [dbConfig, setDbConfig] = useState({
    connection_id: "",
    db_type: "postgresql",
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: ""
  });
  
  // Execution state
  const [executionMode, setExecutionMode] = useState("automated");
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [showAdvancedExec, setShowAdvancedExec] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("");
  const [reportViewTab, setReportViewTab] = useState<"summary" | "html" | "junit" | "json" | "allure">("summary");
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [executeFilter, setExecuteFilter] = useState("");
  const [viewingTestCase, setViewingTestCase] = useState<any>(null);
  const [expandedResultIdx, setExpandedResultIdx] = useState<number | null>(null);
  // Collection Runner config
  const [runIterations, setRunIterations] = useState(1);
  const [runDelay, setRunDelay] = useState(0);
  const [runBailOnError, setRunBailOnError] = useState(false);
  const [showRunnerConfig, setShowRunnerConfig] = useState(false);

  // Load testing (React state — zero-code, no getElementById)
  const [loadConfig, setLoadConfig] = useState({
    virtual_users: 10,
    duration_seconds: 30,
    ramp_up_seconds: 5,
    think_time_ms: 1000,
  });

  // Data-driven (CSV/JSON upload, preview, run — zero-code)
  const [dataDrivenSourceType, setDataDrivenSourceType] = useState<"csv" | "json">("csv");
  const [dataDrivenContent, setDataDrivenContent] = useState("");
  const [dataDrivenSourceId, setDataDrivenSourceId] = useState<string | null>(null);
  const [dataDrivenPreview, setDataDrivenPreview] = useState<any>(null);
  const [dataDrivenRunning, setDataDrivenRunning] = useState(false);
  const [dataDrivenResults, setDataDrivenResults] = useState<any>(null);

  // Variable scoping (Tier 2): global → env → collection. Resolve order in Builder.
  const VAR_GLOBAL_KEY = "api_global_variables";
  const VAR_COLLECTION_KEY = "api_collection_variables";
  const [globalVariables, setGlobalVariables] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(VAR_GLOBAL_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const [collectionVariables, setCollectionVariables] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(VAR_COLLECTION_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch { return {}; }
  });
  const persistGlobalVars = (v: Record<string, string>) => {
    setGlobalVariables(v);
    try { localStorage.setItem(VAR_GLOBAL_KEY, JSON.stringify(v)); } catch {}
  };
  const persistCollectionVars = (v: Record<string, string>) => {
    setCollectionVariables(v);
    try { localStorage.setItem(VAR_COLLECTION_KEY, JSON.stringify(v)); } catch {}
  };
  const [newGlobalVarKey, setNewGlobalVarKey] = useState("");
  const [newGlobalVarVal, setNewGlobalVarVal] = useState("");
  const [newCollVarKey, setNewCollVarKey] = useState("");
  const [newCollVarVal, setNewCollVarVal] = useState("");

  // Load API collection from backend on mount (single source of truth)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/db/api-collections/default`);
        if (cancelled) return;
        const data = await res.json().catch(() => ({}));
        const payload = data?.payload ?? {};
        if (payload && (payload.test_cases?.length || payload.folders?.length || Object.keys(payload).length > 0)) {
          setTestSuite(ensureTestSuiteFolders(payload));
        } else {
          setTestSuite(null);
        }
      } catch {
        if (!cancelled) setTestSuite(null);
      } finally {
        if (!cancelled) {
          setSuiteLoading(false);
          suiteLoadedFromBackend.current = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Legacy testSuite persistence removed — the Zustand apiTestingStore handles
  // all collection persistence via _saveCollectionNow / _debouncedSaveCollection.
  
  // Environment state
  const [environments, setEnvironments] = useState<any[]>([]);
  const [envConfig, setEnvConfig] = useState({
    name: "",
    type: "development",
    base_url: "",
    variables: {}
  });
  
  // Virtual service state
  const [virtualServices, setVirtualServices] = useState<any[]>([]);
  
  // Report state
  const [reports, setReports] = useState<any[]>([]);
  
  // Security scanning state
  const [securityScanning, setSecurityScanning] = useState(false);
  const [securityResults, setSecurityResults] = useState<any>(null);
  const [securityTargetUrl, setSecurityTargetUrl] = useState("");
  const [selectedSecurityTests, setSelectedSecurityTests] = useState<string[]>([
    "auth_matrix", "bola", "injection", "rate_limiting"
  ]);

  // Builder pre-population state (for "Try It" buttons)
  const [builderInitialRequest, setBuilderInitialRequest] = useState<any>(null);

  // ===== Zustand store integration (API testing sidebar, workspaces, collections) =====
  // CRITICAL: We use the store IMPERATIVELY (getState()) instead of hooks to avoid
  // the "getSnapshot should be cached" infinite loop in Zustand v5 + immer.
  // The sidebar (CollectionSidebar) uses its own Zustand hooks - that's fine because
  // it's wrapped in React.memo and uses targeted selectors.
  
  // Initialize store once on mount (imperative — no hook subscription)
  useEffect(() => {
    const store = useApiTestingStore.getState();
    store.initialize();
    
    // Subscribe to store changes for sidebar → builder interactions
    const unsub = useApiTestingStore.subscribe(
      (state, prevState) => {
        // When a request is opened in builder (sidebar click or openRequestInBuilder)
        // ALWAYS switch to builder tab when builder_initial_data changes
        if (state.builder_initial_data && state.builder_initial_data !== prevState?.builder_initial_data) {
          setBuilderInitialRequest(state.builder_initial_data);
          setActiveTab("builder");
        }
        // When store execution completes, route results to the Results tab
        if (state.execution_results && state.execution_results !== prevState?.execution_results && !state.executing) {
          setExecutionResults(state.execution_results);
          setActiveTab("results");
        }
      }
    );
    return unsub;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ===== END store integration =====

  // Sync page selectedEnvironment → store active_environment_id (fixes base URL resolution)
  useEffect(() => {
    if (!selectedEnvironment) return;
    const store = useApiTestingStore.getState();
    // Push the selected page environment into the store so openRequestInBuilder can find it
    const pageEnv = environments.find(e => e.environment_id === selectedEnvironment);
    if (pageEnv) {
      // Ensure this environment exists in the store (map environment_id → id)
      const storeEnvs = store.environments;
      const existsInStore = storeEnvs.some(e => e.id === pageEnv.environment_id || e.id === selectedEnvironment);
      if (!existsInStore) {
        // Push it into the store
        store.createEnvironment({
          id: pageEnv.environment_id,
          name: pageEnv.name,
          type: pageEnv.type || 'development',
          base_url: pageEnv.base_url,
          variables: Array.isArray(pageEnv.variables)
            ? Object.fromEntries(
                pageEnv.variables.filter((v: any) => v.enabled !== false).map((v: any) => [v.key, v.value])
              )
            : (pageEnv.variables && typeof pageEnv.variables === 'object' ? pageEnv.variables : {}),
        });
      }
      store.setActiveEnvironment(pageEnv.environment_id);
    }
  }, [selectedEnvironment, environments]);

  // Auto-bridge removed — users now explicitly add endpoints from the Import tab
  // via "Add to Collection" buttons. No phantom auto-population.

  // Custom test case creation state
  const [showCreateTest, setShowCreateTest] = useState(false);
  const [customTest, setCustomTest] = useState({
    title: "",
    method: "GET",
    path: "",
    expected_status: 200,
    description: "",
    test_type: "functional",
  });
  const [savingToTests, setSavingToTests] = useState(false);

  // Assertions Builder state
  const [assertions, setAssertions] = useState<any[]>([]);
  const [newAssertion, setNewAssertion] = useState({
    type: "status_code",
    name: "",
    expected: "",
    path: "",
    operator: "equals",
    schema: ""
  });

  // Assertion type definitions — imported from constants/assertion-constants.ts
  // Available as INLINE_ASSERTION_TYPES and INLINE_ASSERTION_OPERATORS

  // Add assertion to list
  const addAssertion = () => {
    if (!newAssertion.type) return;
    
    const assertion = {
      id: `assertion_${Date.now()}`,
      ...newAssertion,
      name: newAssertion.name || `${newAssertion.type} assertion`
    };
    
    setAssertions([...assertions, assertion]);
    setNewAssertion({
      type: "status_code",
      name: "",
      expected: "",
      path: "",
      operator: "equals",
      schema: ""
    });
    
    toast({
      title: "Assertion Added",
      description: `Added ${assertion.type} assertion`,
    });
  };

  // Remove assertion
  const removeAssertion = (id: string) => {
    setAssertions(assertions.filter(a => a.id !== id));
  };

  // Report export/generation — delegated to lib/report-export.ts
  const exportAsJUnitXML = () => _exportJUnit(executionResults, toast);
  const exportAsHTML = () => _exportHTML(executionResults, toast);
  const exportAsJSON = () => _exportJSON(executionResults, toast);
  const exportAsAllure = () => _exportAllure(executionResults, toast);
  
  // Pending API requests from Record tab (Quick API Test)
  const [pendingApiRequests, setPendingApiRequests] = useState<any[]>([]);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
  const [executingRequestId, setExecutingRequestId] = useState<string | null>(null);
  const [requestResults, setRequestResults] = useState<Record<string, any>>({});

  // Execute a single API request
  const executeRequest = async (req: any) => {
    setExecutingRequestId(req.id);
    const startTime = Date.now();
    
    try {
      // Fix double slashes in URL (e.g., https://api.example.com//path -> https://api.example.com/path)
      const normalizedUrl = req.url.replace(/([^:]\/)\/+/g, '$1');
      
      const response = await fetch(normalizedUrl, {
        method: req.method,
        headers: req.headers || {},
        body: req.method !== 'GET' && req.body ? req.body : undefined,
      });
      
      const responseTime = Date.now() - startTime;
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
      };
      
      setRequestResults(prev => ({ ...prev, [req.id]: result }));
      
      toast({
        title: response.ok ? "✅ Request Successful" : "❌ Request Failed",
        description: `${req.method} ${req.name} - ${response.status} (${responseTime}ms)`,
        variant: response.ok ? "default" : "destructive",
      });
      
      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result = {
        success: false,
        status: 0,
        statusText: 'Network Error',
        responseTime,
        error: error.message,
      };
      
      setRequestResults(prev => ({ ...prev, [req.id]: result }));
      
      toast({
        title: "❌ Request Failed",
        description: `${req.method} ${req.name} - ${error.message}`,
        variant: "destructive",
      });
      
      return result;
    } finally {
      setExecutingRequestId(null);
    }
  };

  // Execute all requests sequentially
  const executeAllRequests = async () => {
    toast({
      title: "🚀 Running All Requests",
      description: `Testing ${pendingApiRequests.length} endpoints...`,
    });
    
    const results: any[] = [];
    for (const req of pendingApiRequests) {
      const result = await executeRequest(req);
      results.push({ ...req, result });
    }
    
    const successful = results.filter(r => r.result.success).length;
    const failed = results.length - successful;
    
    toast({
      title: "📊 Test Complete",
      description: `${successful} passed, ${failed} failed`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  // Environment persistence — delegated to lib/environment-persistence.ts
  // loadPersistedEnvironments, saveEnvironmentsToLocalStorage, saveEnvironmentToDb
  // are imported from the module above.

  const loadCapabilities = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/capabilities`);
      const data = await response.json();
      console.log("Capabilities:", data);
    } catch (error) {
      console.error("Failed to load capabilities:", error);
    }
  };

  const loadDbConnections = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/database/connections`);
      const data = await response.json();
      if (data.status === "success") {
        setDbConnections(data.connections);
      }
    } catch (error) {
      console.error("Failed to load database connections:", error);
    }
  };

  const loadVirtualServices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service`);
      const data = await response.json();
      if (data.status === "success") {
        setVirtualServices(data.virtual_services || []);
      }
    } catch (error) {
      console.error("Failed to load virtual services:", error);
    }
  };

  const loadMockServers = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v2/testing/mock/server`);
      const data = await res.json();
      setMockServers(data.servers || []);
      if ((data.servers || []).length > 0 && !selectedMockServerId) {
        setSelectedMockServerId(data.servers[0].server_id);
      }
    } catch (e) {
      setMockServers([]);
    }
  };

  const loadFlowstralSessions = async () => {
    setLoadingFlowstral(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        setFlowstralSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to load Flowstral sessions:", error);
    } finally {
      setLoadingFlowstral(false);
    }
  };

  const importFromFlowstral = async (sessionId: string) => {
    setLoading(true);
    try {
      // Get session details
      const sessionResponse = await fetch(`${API_BASE_URL}/api/flowstral/sessions/${sessionId}`);
      if (!sessionResponse.ok) throw new Error("Failed to load session");
      
      const sessionData = await sessionResponse.json();
      
      // Extract HTTP requests from session nodes
      const httpRequests: any[] = [];
      const nodes = sessionData.nodes || [];
      
      nodes.forEach((node: any) => {
        if (node.type === 'action' && node.data?.request) {
          httpRequests.push({
            method: node.data.request.method || 'GET',
            path: node.data.request.url || node.data.url || '/',
            name: node.data.label || node.data.actionType || 'Request',
            headers: node.data.request.headers || {},
            body: node.data.request.body
          });
        }
      });

      // Generate API spec from recorded requests
      const generatedSpec = {
        openapi: "3.1.0",
        info: {
          title: `API from Flowstral Session ${sessionId.substring(0, 8)}`,
          version: "1.0.0",
          description: `Auto-generated from Flowstral recording: ${sessionData.name || sessionId}`
        },
        servers: [{ url: sessionData.initial_url || "" }],
        paths: httpRequests.reduce((acc: any, req: any, idx: number) => {
          const pathKey = req.path || `/endpoint_${idx}`;
          if (!acc[pathKey]) acc[pathKey] = {};
          acc[pathKey][req.method.toLowerCase()] = {
            summary: req.name,
            operationId: `op_${idx}`,
            responses: { "200": { description: "Success" } }
          };
          return acc;
        }, {})
      };

      setSpecContent(JSON.stringify(generatedSpec, null, 2));
      setProtocol("REST");
      setSpecFormat("openapi");
      
      // Create environment
      const envName = `Flowstral ${sessionId.substring(0, 8)}`;
      const newEnv = {
        environment_id: `env_flowstral_${sessionId}`,
        name: envName,
        type: "development",
        base_url: sessionData.initial_url || "",
        variables: {}
      };
      const updatedEnvs = [...environments.filter(e => e.environment_id !== newEnv.environment_id), newEnv];
      setEnvironments(updatedEnvs);
      saveEnvironmentsToLocalStorage(updatedEnvs);
      setSelectedEnvironment(newEnv.environment_id);
      
      toast({
        title: "Flowstral Session Imported",
        description: `Imported ${httpRequests.length} requests. Go to Import tab to generate tests.`,
      });
      
      setActiveTab("import");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import Flowstral session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createVirtualService = async () => {
    if (!newVirtualService.name || !newVirtualService.base_url) {
      toast({
        title: "Error",
        description: "Please provide name and base URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_config: {
            name: newVirtualService.name,
            base_url: newVirtualService.base_url,
            endpoints: newVirtualService.endpoints
          }
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Virtual service created",
        });
        loadVirtualServices();
        setNewVirtualService({ name: "", base_url: "", endpoints: [] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create virtual service",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteVirtualService = async (serviceId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service/${serviceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: "Success", description: "Virtual service deleted" });
        loadVirtualServices();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" });
    }
  };

  // loadEnvironments — delegated to lib/environment-persistence.ts
  const loadEnvironments = () => _loadEnvironments(setEnvironments);

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log("Initializing EnhancedAPITesting...");
        loadCapabilities();
        // Load persisted environments first (from localStorage)
        const persisted = loadPersistedEnvironments();
        if (persisted.length > 0) {
          setEnvironments(persisted);
          // Load selected environment from localStorage
          const savedEnv = localStorage.getItem("apex_selected_environment");
          if (savedEnv && persisted.find(e => e.environment_id === savedEnv)) {
            setSelectedEnvironment(savedEnv);
          } else if (persisted.length > 0) {
            // Auto-select first environment if saved one not found
            setSelectedEnvironment(persisted[0].environment_id);
            localStorage.setItem("apex_selected_environment", persisted[0].environment_id);
          }
        }
        // Then try to load from API (will merge)
        await loadEnvironments();
        await loadDbConnections();
        await loadVirtualServices();
        await loadMockServers();
        console.log("EnhancedAPITesting initialized successfully");
      } catch (error: any) {
        console.error("Error initializing EnhancedAPITesting:", error);
        setError(error?.message || "Failed to initialize");
        toast({
          title: "Error",
          description: error?.message || "Failed to initialize Enhanced API Testing",
          variant: "destructive",
        });
      }
    };
    
    initialize();
  }, []);

  // Check for pending API test requests from Record tab (Quick API Test)
  useEffect(() => {
    const pendingRequests = sessionStorage.getItem('pendingApiTestRequests');
    const pendingTimestamp = sessionStorage.getItem('pendingApiTestTimestamp');
    
    if (pendingRequests && pendingTimestamp) {
      // Only process if less than 30 seconds old
      const age = Date.now() - parseInt(pendingTimestamp);
      if (age < 30000) {
        try {
          const requests = JSON.parse(pendingRequests);
          if (Array.isArray(requests) && requests.length > 0) {
            setPendingApiRequests(requests);
            setShowPendingBanner(true);
            toast({
              title: "📡 API Requests Loaded",
              description: `${requests.length} HTTP requests imported from recording`,
            });
          }
        } catch (e) {
          console.error('Failed to parse pending API test requests:', e);
        }
      }
      
      // Clear the pending data
      sessionStorage.removeItem('pendingApiTestRequests');
      sessionStorage.removeItem('pendingApiTestTimestamp');
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);

    try {
      // First, parse the spec using old endpoint
      const formData = new FormData();
      formData.append("file", file);
      
      const filename = file.name.toLowerCase();
      let format = "openapi";
      if (filename.endsWith(".wsdl") || filename.endsWith(".xml")) {
        format = "wsdl";
      } else if (filename.includes("postman")) {
        format = "postman";
      } else if (filename.endsWith(".graphql") || filename.endsWith(".gql")) {
        format = "graphql";
      } else if (filename.endsWith(".har") || filename.endsWith(".har.json")) {
        format = "har";
      }
      
      formData.append("spec_format", format);

      const parseResponse = await fetch(`${API_BASE_URL}/api/import/spec/file`, {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        throw new Error(`Failed to import: ${parseResponse.statusText}`);
      }

      const parseData = await parseResponse.json();
      setParsedSpec(parseData.parsed_spec);
      setSelectedImportItems(new Set());
      // Auto-populate import base URL from parsed spec (file import)
      if (!importBaseUrl.trim()) {
        const ps = parseData.parsed_spec;
        let detectedBaseUrl = '';
        if (ps?.base_url) detectedBaseUrl = ps.base_url;
        else if (ps?.servers?.[0]?.url) detectedBaseUrl = ps.servers[0].url;
        else if (ps?.host) {
          const scheme = (ps.schemes && ps.schemes[0]) || 'https';
          detectedBaseUrl = `${scheme}://${ps.host}${ps.basePath || ''}`;
        }
        if (detectedBaseUrl) setImportBaseUrl(detectedBaseUrl);
      }

      const endpointCount = Object.values(parseData.parsed_spec?.paths || {}).reduce(
        (sum: number, methods: any) => sum + Object.keys(methods || {}).length, 0
      );

      toast({
        title: "Spec Parsed",
        description: `Found ${endpointCount} endpoints. Select and add them to your collection, then build assertions from live responses.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import API specification (file)",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTextImport = async () => {
    if (!specContent.trim()) {
      toast({
        title: "Error",
        description: "Please provide API specification content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Client-side base URL extraction BEFORE backend parsing (most reliable)
      if (!importBaseUrl.trim()) {
        try {
          const rawParsed = JSON.parse(specContent);
          if (rawParsed.servers && Array.isArray(rawParsed.servers) && rawParsed.servers[0]?.url) {
            setImportBaseUrl(rawParsed.servers[0].url);
          } else if (rawParsed.host) {
            const scheme = (rawParsed.schemes && rawParsed.schemes[0]) || 'https';
            setImportBaseUrl(`${scheme}://${rawParsed.host}${rawParsed.basePath || ''}`);
          }
        } catch {
          // YAML: try regex
          const serversMatch = specContent.match(/servers:\s*\n\s*-\s*url:\s*['"]?([^\s'"]+)/);
          if (serversMatch?.[1]) setImportBaseUrl(serversMatch[1]);
          const hostMatch = specContent.match(/host:\s*['"]?([^\s'"]+)/);
          const basePathMatch = specContent.match(/basePath:\s*['"]?([^\s'"]+)/);
          if (hostMatch?.[1]) {
            const schemesMatch = specContent.match(/schemes:\s*\n\s*-\s*['"]?(\w+)/);
            const scheme = schemesMatch?.[1] || 'https';
            setImportBaseUrl(`${scheme}://${hostMatch[1]}${basePathMatch?.[1] || ''}`);
          }
        }
      }

      // Parse spec - determine content type based on format
      let contentType = "json";
      if (specFormat === "wsdl") contentType = "xml";
      else if (specFormat === "graphql") contentType = "graphql";
      else if (specFormat === "har") contentType = "json";

      const parseResponse = await fetch(`${API_BASE_URL}/api/import/spec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec_content: specContent,
          spec_format: specFormat,
          content_type: contentType,
        }),
      });

      if (!parseResponse.ok) {
        throw new Error(`Failed to import: ${parseResponse.statusText}`);
      }

      const parseData = await parseResponse.json();
      setParsedSpec(parseData.parsed_spec);
      setSelectedImportItems(new Set());
      // Also try from backend parsed spec as additional fallback
      if (!importBaseUrl.trim()) {
        const ps2 = parseData.parsed_spec;
        let detectedBaseUrl2 = '';
        if (ps2?.base_url) detectedBaseUrl2 = ps2.base_url;
        else if (ps2?.servers?.[0]?.url) detectedBaseUrl2 = ps2.servers[0].url;
        else if (ps2?.host) {
          const scheme = (ps2.schemes && ps2.schemes[0]) || 'https';
          detectedBaseUrl2 = `${scheme}://${ps2.host}${ps2.basePath || ''}`;
        }
        if (detectedBaseUrl2) setImportBaseUrl(detectedBaseUrl2);
      }

      const endpointCount = Object.values(parseData.parsed_spec?.paths || {}).reduce(
        (sum: number, methods: any) => sum + Object.keys(methods || {}).length, 0
      );

      toast({
        title: "Spec Parsed",
        description: `Found ${endpointCount} endpoints. Select and add them to your collection, then build assertions from live responses.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import API specification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Collection export — delegated to lib/collection-export.ts
  const exportToPostman = () => _exportToPostman(testSuite, toast);
  const exportToHAR = () => _exportToHAR(testSuite, toast);

  const handleConnectDatabase = async () => {
    if (!dbConfig.connection_id || !dbConfig.host || !dbConfig.database) {
      toast({
        title: "Error",
        description: "Please fill in all required database fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/database/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection_id: dbConfig.connection_id,
          db_type: dbConfig.db_type,
          connection_config: {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: `Connected to ${dbConfig.db_type} database`,
      });
      
      loadDbConnections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTests = async () => {
    if (!testSuite) {
      toast({
        title: "Error",
        description: "Please generate a test suite first",
        variant: "destructive",
      });
      return;
    }

    // Get selected environment's base URL
    const selectedEnv = environments.find(e => e.environment_id === selectedEnvironment);
    const baseUrl = selectedEnv?.base_url || envConfig.base_url || "";
    
    if (!baseUrl || baseUrl === "https://api.example.com") {
      toast({
        title: "Error",
        description: "Please select an environment with a valid base URL",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setExecutionResults(null);

    try {
      // Filter test cases if any are selected
      let testSuiteToExecute = testSuite;
      
      // Get all test cases - combine test_cases and test_categories
      const baseTestCases: any[] = testSuite.test_cases || [];
      const testCategories = testSuite.test_categories || {};
      
      // Flatten all test cases from categories
      const categoryTestCases: any[] = [];
      Object.values(testCategories).forEach((categoryTests: any) => {
        if (Array.isArray(categoryTests)) {
          categoryTestCases.push(...categoryTests);
        }
      });
      
      // Combine base test cases with category test cases, avoiding duplicates
      const allTestCasesMap = new Map();
      
      // Add base test cases first
      baseTestCases.forEach((tc, idx) => {
        const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `base_${idx}`;
        allTestCasesMap.set(id, tc);
      });
      
      // Add category test cases
      categoryTestCases.forEach((tc, idx) => {
        const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `cat_${idx}`;
        allTestCasesMap.set(id, tc);
      });
      
      const allTestCases = Array.from(allTestCasesMap.values());
      const totalTestCases = allTestCases.length;
      
      console.log("Total test cases available:", totalTestCases);
      console.log("Selected test cases:", selectedTestCases.size);
      console.log("Base URL:", baseUrl);
      
      // Normalize test cases to match backend expected format
      const normalizeTestCase = (tc: any) => {
        // Extract path from various possible fields
        const path = tc.path || tc.endpoint || tc.url || 
                    (tc.request?.url) || (tc.steps?.[0]?.url) || "";
        
        // Extract method from various possible fields
        const method = tc.method || tc.http_method || 
                      (tc.request?.method) || (tc.steps?.[0]?.method) || "GET";
        
        // Get existing request body
        let requestBody = tc.request?.body || tc.body || tc.request_body || tc.payload || tc.request_payload;
        
        // Generate default request body for POST/PUT/PATCH endpoints if missing
        if (!requestBody && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
          // Generate default body based on endpoint
          if (path.includes("/auth/register")) {
            requestBody = {
              email: `test_${Date.now()}@example.com`,
              username: `testuser_${Date.now()}`,
              password: "TestPassword123!",
              full_name: "Test User"
            };
          } else if (path.includes("/auth/login")) {
            requestBody = {
              username: "testuser",
              password: "TestUser@2024!Secure#Pass"
            };
          } else if (path.includes("/products") && method === "POST") {
            requestBody = {
              name: "Test Product",
              description: "Test Description",
              price: 99.99,
              category_id: 1,
              stock: 10
            };
          } else if (path.includes("/cart")) {
            requestBody = {
              product_id: 1,
              quantity: 1
            };
          } else if (path.includes("/orders")) {
            requestBody = {
              shipping_address: {
                street: "123 Test St",
                city: "Test City",
                state: "TS",
                zip: "12345",
                country: "USA"
              },
              payment_method: "credit_card"
            };
          } else {
            // Generic default body
            requestBody = {};
          }
        }
        
        // Normalize to backend expected format
        return {
          test_case_id: tc.test_case_id || tc.test_id || tc.id || `test_${Date.now()}_${Math.random()}`,
          title: tc.title || tc.name || tc.test_name || "Untitled Test",
          method: method.toUpperCase(),
          path: path.startsWith("/") ? path : `/${path}`,
          request: {
            headers: tc.request?.headers || tc.headers || {
              "Content-Type": "application/json"
            },
            body: requestBody,
            query: tc.request?.query || tc.query || tc.query_params || {}
          },
          expected_status: tc.expected_status || tc.expectedStatusCode || 200,
          assertions: tc.assertions || [],
          test_type: tc.test_type || tc.category || "functional",
          ...tc  // Keep original fields for reference
        };
      };
      
      let testCasesToExecute = allTestCases;
      
      if (selectedTestCases.size > 0 && selectedTestCases.size < totalTestCases) {
        console.log("Selected test case IDs:", Array.from(selectedTestCases));
        console.log("First original test case:", allTestCases[0]);
        
        // Try multiple ways to match test IDs
        testCasesToExecute = allTestCases.filter((tc: any) => {
          // Try all possible ID fields
          const possibleIds = [
            tc.test_id,
            tc.name,
            tc.test_name,
            tc.test_case_id,
            tc.id,
            tc.title,
            // Generate the same ID format used in selection
            `test_${allTestCases.indexOf(tc)}`
          ].filter(id => id !== undefined && id !== null);
          
          // Check if any of the possible IDs match
          const matches = possibleIds.some(id => selectedTestCases.has(String(id)));
          
          if (matches) {
            console.log("Matched test case:", tc.name || tc.test_name || tc.title, "with IDs:", possibleIds);
          }
          
          return matches;
        });
        console.log("Filtered test cases count:", testCasesToExecute.length);
        
        if (testCasesToExecute.length === 0) {
          console.warn("No test cases matched! Selected IDs:", Array.from(selectedTestCases));
          console.warn("Available test case IDs in first 5:", allTestCases.slice(0, 5).map((tc: any, idx: number) => ({
            idx,
            test_id: tc.test_id,
            name: tc.name,
            test_name: tc.test_name,
            test_case_id: tc.test_case_id,
            id: tc.id,
            title: tc.title,
            generated_id: tc.test_id || tc.name || tc.test_name || `test_${idx}`
          })));
        }
      }

      // Normalize all test cases
      const normalizedTestCases = testCasesToExecute.map(normalizeTestCase);
      
      // Ensure test_cases array exists and has items
      if (normalizedTestCases.length === 0) {
        toast({
          title: "Error",
          description: "No test cases to execute. Please ensure test suite has test cases.",
          variant: "destructive",
        });
        setExecuting(false);
        return;
      }

      // Log first test case structure for debugging
      console.log("First normalized test case:", normalizedTestCases[0]);
      console.log("Request body in first test case:", normalizedTestCases[0]?.request?.body);
      
      // Check if POST/PUT/PATCH requests have bodies
      const requestsWithoutBodies = normalizedTestCases.filter((tc: any) => 
        ["POST", "PUT", "PATCH"].includes(tc.method) && 
        (!tc.request?.body || Object.keys(tc.request.body || {}).length === 0)
      );
      if (requestsWithoutBodies.length > 0) {
        console.warn(`Warning: ${requestsWithoutBodies.length} POST/PUT/PATCH requests have no body:`, 
          requestsWithoutBodies.map((tc: any) => ({ path: tc.path, method: tc.method })));
      }
      
      // Inject environment variables, auth, and headers into test cases
      const envVars = normalizeVariables(selectedEnv?.variables || []);
      const envAuth = selectedEnv?.auth;
      const resolvedTestCases = normalizedTestCases.map((tc: any) => {
        // Resolve {{variable}} placeholders in paths
        let resolvedPath = tc.path || "";
        for (const v of envVars) {
          if (v.enabled && v.key) {
            const escapedKey = v.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            resolvedPath = resolvedPath.replace(new RegExp(`\\{\\{${escapedKey}\\}\\}`, "g"), v.value);
          }
        }

        // Build auth headers from environment
        const envHeaders: Record<string, string> = {};
        if (envAuth && envAuth.type !== "none") {
          if (envAuth.type === "bearer" && envAuth.bearer_token) {
            envHeaders["Authorization"] = `Bearer ${envAuth.bearer_token}`;
          } else if (envAuth.type === "basic" && envAuth.basic_username) {
            envHeaders["Authorization"] = `Basic ${btoa(`${envAuth.basic_username}:${envAuth.basic_password || ""}`)}`;
          } else if (envAuth.type === "api_key" && envAuth.api_key_name && envAuth.api_key_location === "header") {
            envHeaders[envAuth.api_key_name] = envAuth.api_key_value || "";
          }
        }

        return {
          ...tc,
          path: resolvedPath,
          request: {
            ...tc.request,
            headers: { ...envHeaders, ...(tc.request?.headers || {}) },
          },
        };
      });

      testSuiteToExecute = {
        ...testSuite,
        test_cases: resolvedTestCases
      };

      // Build execution config — add load test params if in load mode
      const execConfig: any = {
        base_url: baseUrl,
        parallel: executionMode === "automated" || executionMode === "ci_cd",
        max_workers: 10
      };
      
      if (executionMode === "load") {
        execConfig.virtual_users = loadConfig.virtual_users;
        execConfig.duration_seconds = loadConfig.duration_seconds;
        execConfig.ramp_up_seconds = loadConfig.ramp_up_seconds;
        execConfig.think_time_ms = loadConfig.think_time_ms;
        execConfig.max_workers = loadConfig.virtual_users;
      }

      const requestBody = {
        test_suite: {
          ...testSuiteToExecute,
          base_url: baseUrl
        },
        execution_config: execConfig,
        mode: executionMode
      };

      console.log("Sending execution request:", {
        test_cases_count: requestBody.test_suite.test_cases?.length || 0,
        base_url: baseUrl,
        mode: executionMode,
        ...(executionMode === "load" ? { load_config: execConfig } : {})
      });

      const response = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute tests: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Execution response:", data);
      
      if (data.execution_results) {
        console.log("Execution results:", data.execution_results);
        console.log("Test results count:", data.execution_results.test_results?.length || 0);
        console.log("Summary:", data.execution_results.summary);
        setExecutionResults(data.execution_results);
        
        // Auto-switch to Results tab
        setActiveTab("results");
      } else {
        console.error("No execution_results in response:", data);
        throw new Error("Invalid response format from execution endpoint");
      }
      
      // Generate report
      const reportResponse = await fetch(`${API_BASE_URL}/api/v2/testing/report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data.execution_results),
      });

      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        setReports([...reports, reportData.report]);
      }
      
      toast({
        title: "Success",
        description: `Executed ${data.execution_results.summary?.total || 0} tests`,
      });
      
      setActiveTab("results");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute tests",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  // --- Add a custom test case to the current test suite ---
  const handleAddCustomTest = () => {
    if (!customTest.title || !customTest.path) {
      toast({ title: "Error", description: "Title and endpoint path are required", variant: "destructive" });
      return;
    }

    const newTestCase = {
      test_case_id: `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: customTest.title,
      description: customTest.description || `${customTest.method} ${customTest.path}`,
      method: customTest.method,
      path: customTest.path.startsWith("/") ? customTest.path : `/${customTest.path}`,
      expected_status: customTest.expected_status,
      test_type: customTest.test_type,
      tags: [customTest.test_type, "custom"],
      request: {
        headers: { "Content-Type": "application/json" },
        body: {},
        query: {},
      },
      assertions: [
        { type: "status_code", operator: "equals", expected: String(customTest.expected_status) },
      ],
    };

    setTestSuite((prev: any) => {
      const next = !prev
        ? { test_cases: [newTestCase], metadata: { total_test_cases: 1 } }
        : {
            ...prev,
            test_cases: [...(prev.test_cases || []), newTestCase],
            metadata: { ...prev.metadata, total_test_cases: (prev.test_cases?.length || 0) + 1 },
          };
      return ensureTestSuiteFolders(next);
    });

    setShowCreateTest(false);
    setCustomTest({ title: "", method: "GET", path: "", expected_status: 200, description: "", test_type: "functional" });
    toast({ title: "Test Added", description: `"${newTestCase.title}" added to test suite` });
  };

  // --- Save generated API tests to the main Test Cases tab ---
  const handleSaveToTestCases = async () => {
    if (!testSuite || !testSuite.test_cases || testSuite.test_cases.length === 0) {
      toast({ title: "Error", description: "No test cases to save", variant: "destructive" });
      return;
    }

    setSavingToTests(true);
    let saved = 0;
    let failed = 0;
    const errors: string[] = [];

    try {
      // Determine which tests to save: selected or all
      const allTests = testSuite.test_cases || [];
      const testsToSave = selectedTestCases.size > 0 
        ? allTests.filter((tc: any) => {
            const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id;
            return selectedTestCases.has(String(id));
          })
        : allTests;

      // All saves go to persistent database API (/api/db/test-cases)

      for (const tc of testsToSave) {
        try {
          const method = (tc.method || tc.http_method || "GET").toUpperCase();
          const path = tc.path || tc.endpoint || tc.url || "";
          const testName = tc.title || tc.name || tc.test_name || `API Test: ${method} ${path}`;
          const localId = `api_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
          
          const payload = {
            name: testName,
            title: testName,
            description: tc.description || `${method} ${path} - Expected status: ${tc.expected_status || 200}`,
            testType: "api",
            priority: "medium",
            tags: [...new Set([...(tc.tags || []), "api-testing", tc.test_type || "functional"])],
            method: method,
            endpoint: path,
            expected_status: String(tc.expected_status || 200),
            request_body: tc.request?.body ? JSON.stringify(tc.request.body) : "",
            headers: tc.request?.headers ? JSON.stringify(tc.request.headers) : "",
            steps: [
              {
                action: `Send ${method} request to ${path}` + 
                  (tc.request?.body ? ` with body: ${JSON.stringify(tc.request.body).slice(0, 100)}` : ""),
                expectedResult: `Response status is ${tc.expected_status || 200}`,
              },
            ],
          };

          // Save to persistent database API (/api/db/test-cases)
          const resp = await fetch(`${API_BASE_URL}/api/db/test-cases`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: testName,
              description: payload.description,
              steps: payload.steps,
              status: "draft",
              priority: "medium",
              category: "api",
              tags: payload.tags,
              metadata: {
                type: "automated",
                method: method,
                endpoint: path,
                expected_status: payload.expected_status,
                request_body: payload.request_body,
                headers: payload.headers,
                assertions: JSON.stringify(tc.assertions || []),
                test_type: tc.test_type || "functional",
                priority: tc.priority || "medium",
                automationStatus: "full",
              }
            }),
          });

          if (resp.ok) {
            saved++;
          } else {
            const errData = await resp.json().catch(() => ({}));
            errors.push(`${testName}: ${errData.detail || resp.statusText}`);
            failed++;
          }
        } catch (err: any) {
          failed++;
          errors.push(err.message || "Unknown error");
        }
      }

      if (failed > 0) {
        console.error("Save errors:", errors);
      }

      toast({
        title: saved > 0 ? "Saved to Test Cases" : "Save Failed",
        description: saved > 0
          ? `${saved} test case(s) saved.${failed > 0 ? ` ${failed} failed.` : ""} Go to Tests page to see them.`
          : `All ${failed} save(s) failed. ${errors[0] || "Check console for details."}`,
        variant: saved > 0 ? "default" : "destructive",
      });
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to save test cases", variant: "destructive" });
    } finally {
      setSavingToTests(false);
    }
  };

  const handleCreateEnvironment = async () => {
    if (!envConfig.name || !envConfig.base_url) {
      toast({
        title: "Error",
        description: "Please fill in environment name and base URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/environment/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          environment_config: envConfig
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create environment: ${response.statusText}`);
      }

      const result = await response.json();
      const newEnv = result.environment || {
        environment_id: `env_${Date.now()}`,
        name: envConfig.name,
        type: envConfig.type,
        base_url: envConfig.base_url,
        variables: envConfig.variables
      };
      
      // Add to local state and persist
      const updatedEnvs = [...environments, newEnv];
      setEnvironments(updatedEnvs);
      saveEnvironmentsToLocalStorage(updatedEnvs);
      
      // Auto-select if first environment
      if (environments.length === 0) {
        setSelectedEnvironment(newEnv.environment_id);
        localStorage.setItem("apex_selected_environment", newEnv.environment_id);
      }
      
      toast({
        title: "Success",
        description: `Environment "${envConfig.name}" created and saved`,
      });
      
      setEnvConfig({ name: "", type: "development", base_url: "", variables: {} });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create environment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error loading Enhanced API Testing:</strong> {error}
            <br />
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-2"
              variant="outline"
            >
              Reload Page
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Globe className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Testing</h1>
              <p className="text-sm text-gray-400">
                Multi-protocol support • Database connectivity • Comprehensive reporting
              </p>
            </div>
          </div>
          <Badge className="text-sm px-4 py-2 bg-primary/10 text-primary border border-primary/20">
            <Zap className="w-4 h-4 mr-2" />
            Enterprise Grade
          </Badge>
        </div>

      <div className="flex min-h-[420px] h-[calc(100vh-180px)] gap-0 -mx-6">
        {/* NEW: Extracted memoized sidebar with workspace/collection switching */}
        <CollectionSidebar />

        <div className="flex-1 min-w-0 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

      {/* Banner for pending API requests from Record tab */}
      {showPendingBanner && pendingApiRequests.length > 0 && (
        <Alert className="bg-violet-500/10 border-violet-500/30">
          <Zap className="h-4 w-4 text-violet-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong className="text-violet-600 dark:text-violet-400">
                {pendingApiRequests.length} HTTP requests
              </strong>{' '}
              imported from recording. Click to test each endpoint.
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowPendingBanner(false)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Test Panel - Shows captured requests */}
      {pendingApiRequests.length > 0 && (
        <Card className="border-violet-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-500" />
              Captured API Requests ({pendingApiRequests.length})
            </CardTitle>
            <CardDescription>
              HTTP requests captured during recording - click to test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {pendingApiRequests.map((req, index) => {
                const result = requestResults[req.id];
                const isExecuting = executingRequestId === req.id;
                
                return (
                  <div 
                    key={req.id || index}
                    className={`p-3 rounded-lg border transition-colors ${
                      result?.success === true ? 'bg-green-500/10 border-green-500/30' :
                      result?.success === false ? 'bg-red-500/10 border-red-500/30' :
                      'bg-secondary/50 border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="outline" 
                          className={
                            req.method === 'GET' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                            req.method === 'POST' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                            req.method === 'PUT' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                            req.method === 'DELETE' ? 'bg-red-500/10 text-red-600 border-red-500/30' :
                            'bg-gray-500/10 text-gray-600 border-gray-500/30'
                          }
                        >
                          {req.method}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{req.name || new URL(req.url).pathname}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[400px]">{req.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result && (
                          <Badge variant={result.success ? "default" : "destructive"} className="text-xs">
                            {result.status} • {result.responseTime}ms
                          </Badge>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          disabled={isExecuting}
                          onClick={() => executeRequest(req)}
                        >
                          {isExecuting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Show response preview */}
                    {result && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Response:</p>
                        <pre className="text-xs bg-black/20 p-2 rounded max-h-[100px] overflow-auto">
                          {typeof result.data === 'object' 
                            ? JSON.stringify(result.data, null, 2).slice(0, 500) 
                            : String(result.data || result.error).slice(0, 500)}
                          {(JSON.stringify(result.data)?.length > 500) && '...'}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => {
                  setPendingApiRequests([]);
                  setShowPendingBanner(false);
                  setRequestResults({});
                }}
              >
                Clear All
              </Button>
              <Button 
                onClick={executeAllRequests}
                disabled={executingRequestId !== null}
              >
                {executingRequestId ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Test All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); useApiTestingStore.getState().setActiveTab(tab); }} className="space-y-4">
        <TabsList className="flex w-full bg-card border border-border p-1 overflow-x-auto">
          <TabsTrigger value="import" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
            <Upload className="w-4 h-4 mr-1" />
            Import
          </TabsTrigger>
          <TabsTrigger value="builder" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
            <Send className="w-4 h-4 mr-1" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="chains" className="flex-1 min-w-0 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 text-muted-foreground">
            <Link2 className="w-4 h-4 mr-1" />
            Chains
          </TabsTrigger>
          <TabsTrigger value="execute" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
            <Play className="w-4 h-4 mr-1" />
            Execute
          </TabsTrigger>
          <TabsTrigger value="data-driven" className="flex-1 min-w-0 data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-600 text-muted-foreground">
            <Database className="w-4 h-4 mr-1" />
            Data
          </TabsTrigger>
          <TabsTrigger value="mock" className="flex-1 min-w-0 data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-600 text-muted-foreground">
            <Server className="w-4 h-4 mr-1" />
            Mock
          </TabsTrigger>
          <TabsTrigger value="security" className="flex-1 min-w-0 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-600 text-muted-foreground">
            <Shield className="w-4 h-4 mr-1" />
            Security
          </TabsTrigger>
          <TabsTrigger value="websocket" className="flex-1 min-w-0 data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-600 text-muted-foreground">
            <Zap className="w-4 h-4 mr-1" />
            WS
          </TabsTrigger>
          <TabsTrigger value="environments" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Env</TabsTrigger>
          <TabsTrigger value="results" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Results</TabsTrigger>
        </TabsList>

        {/* Builder Tab - Ad-hoc Request Builder */}
        <TabsContent value="builder" className="space-y-4">
          <TabErrorBoundary tabName="Builder">
            <RequestBuilder 
              initialRequest={builderInitialRequest}
              activeEnvironment={environments.find(e => e.environment_id === selectedEnvironment) || null}
              globalVariables={globalVariables}
              collectionVariables={collectionVariables}
              onSaveToChain={(req, asserts) => {
                // Switch to Chains tab and add the request as a new step
                setActiveTab("chains");
                toast({ title: "Added to Chain", description: `${req.method} ${req.url} added as a chain step` });
              }}
              onAddToTestSuite={async (testCase) => {
                const isUpdate = !!(testCase as any).editingTestCaseId;
                const editingId = (testCase as any).editingTestCaseId;

                // 1) Add or update in Execute tab test suite (in-memory)
                setTestSuite((prev: any) => {
                  if (!prev) {
                    return ensureTestSuiteFolders({ test_cases: [testCase], metadata: { total_test_cases: 1 } });
                  }
                  const idMatch = (tc: any) => String(tc.test_case_id || tc.test_id || tc.id || tc.title || tc.name) === String(editingId);
                  if (isUpdate && editingId) {
                    const updatedCases = (prev.test_cases || []).map((tc: any) => idMatch(tc) ? { ...tc, ...testCase, test_case_id: tc.test_case_id || tc.test_id || tc.id, editingTestCaseId: undefined } : tc);
                    const updatedCategories: Record<string, any[]> = {};
                    if (prev.test_categories && typeof prev.test_categories === "object") {
                      for (const [cat, list] of Object.entries(prev.test_categories)) {
                        updatedCategories[cat] = (list as any[]).map((tc: any) => idMatch(tc) ? { ...tc, ...testCase, test_case_id: tc.test_case_id || tc.test_id || tc.id, editingTestCaseId: undefined } : tc);
                      }
                    }
                    return ensureTestSuiteFolders({
                      ...prev,
                      test_cases: updatedCases,
                      test_categories: Object.keys(updatedCategories).length ? { ...prev.test_categories, ...updatedCategories } : prev.test_categories,
                      metadata: { ...prev.metadata, total_test_cases: updatedCases.length || (prev.test_cases?.length || 0) },
                    });
                  }
                  return ensureTestSuiteFolders({
                    ...prev,
                    test_cases: [...(prev.test_cases || []), testCase],
                    metadata: { ...prev.metadata, total_test_cases: (prev.test_cases?.length || 0) + 1 },
                  });
                });

                // 2) If update, also save back to the sidebar collection store (→ DB)
                if (isUpdate && editingId) {
                  try {
                    const store = useApiTestingStore.getState();
                    const coll = store.collections[store.active_collection_id || ''];
                    const existsInCollection = coll?.requests?.some((r: any) => r.id === editingId);
                    if (existsInCollection) {
                      // Use fullUrl (complete URL with base) from RequestBuilder, fall back to existing request URL
                      const existingReq = coll?.requests?.find((r: any) => r.id === editingId);
                      const resolvedUrl = testCase.fullUrl || existingReq?.url || testCase.path || testCase.endpoint || '';
                      store.updateRequest(editingId, {
                        name: testCase.title || `${testCase.method} ${testCase.path || ''}`,
                        method: testCase.method,
                        url: resolvedUrl,
                        path: testCase.path || testCase.endpoint || '',
                        headers: testCase.request?.headers
                          ? Object.entries(testCase.request.headers).map(([k, v]) => ({ key: k, value: String(v), enabled: true }))
                          : [{ key: 'Content-Type', value: 'application/json', enabled: true }],
                        body: testCase.request?.body
                          ? (typeof testCase.request.body === 'string' ? testCase.request.body : JSON.stringify(testCase.request.body))
                          : '',
                        assertions: Array.isArray(testCase.assertions) ? testCase.assertions : [],
                        expected_status: testCase.expected_status || 200,
                        description: testCase.description || '',
                      });
                      toast({ title: "Test saved", description: `"${testCase.title || testCase.method + " " + (testCase.path || "")}" saved to collection.` });
                    } else {
                      toast({ title: "Test updated", description: `"${testCase.title || testCase.method + " " + (testCase.path || "")}" updated in test suite.` });
                    }
                  } catch (err) {
                    console.error('[onAddToTestSuite] Failed to save back to collection:', err);
                    toast({ title: "Test updated", description: `Updated in test suite (collection save failed).` });
                  }
                  return;
                }
                try {
                  const testName = testCase.title || `${testCase.method} ${testCase.path}`;
                  const payload = {
                    name: testName,
                    title: testName,
                    description: testCase.description || `${testCase.method} ${testCase.path}`,
                    testType: "api",
                    priority: "medium",
                    tags: [...new Set([...(testCase.tags || []), "api-testing"])],
                    method: testCase.method,
                    endpoint: testCase.path,
                    expected_status: String(testCase.expected_status || 200),
                    request_body: testCase.request?.body ? JSON.stringify(testCase.request.body) : "",
                    headers: testCase.request?.headers ? JSON.stringify(testCase.request.headers) : "",
                    assertions: testCase.assertions || [],
                    steps: [{
                      action: `Send ${testCase.method} request to ${testCase.path}`,
                      expectedResult: `Response status is ${testCase.expected_status || 200}`,
                    }],
                  };

                  // Save to persistent database API (/api/db/test-cases)
                  // Serialize assertions to string to avoid double-serialization in metadata
                  const assertionsStr = testCase.assertions ? JSON.stringify(testCase.assertions) : "[]";
                  
                  const resp = await fetch(`${API_BASE_URL}/api/db/test-cases`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      name: testName,
                      description: payload.description,
                      steps: payload.steps,
                      status: "draft",
                      priority: "medium",
                      category: "api",
                      tags: payload.tags,
                      metadata: {
                        type: "automated",
                        method: testCase.method,
                        endpoint: testCase.path,
                        expected_status: payload.expected_status,
                        request_body: payload.request_body,
                        headers: payload.headers,
                        assertions: assertionsStr,
                        automationStatus: "full",
                      }
                    }),
                  });

                  if (!resp.ok) {
                    const errData = await resp.text().catch(() => "Unknown error");
                    console.error("Backend save failed:", resp.status, errData);
                    throw new Error(`Backend returned ${resp.status}: ${errData.substring(0, 100)}`);
                  }

                  const data = await resp.json().catch(() => ({}));
                  console.log("Test case saved to DB:", data);

                  toast({
                    title: "Test Saved to Database",
                    description: `"${testName}" saved. Visible in Tests tab and Execute tab for all team members.`,
                  });
                } catch (err: any) {
                  // Still added to execute suite even if backend save fails
                  toast({
                    title: "Added to Execute Tab",
                    description: `Added to test suite. Backend save failed: ${err.message}`,
                    variant: "destructive",
                  });
                }
              }}
            />
          </TabErrorBoundary>
        </TabsContent>


        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          {/* Quick Import samples and Templates removed for cleaner UX — import via spec/URL/file below */}
          {/* Main Import Card */}
          <Card>
            <CardHeader>
              <CardTitle>Import API Specification</CardTitle>
              <CardDescription>
                Import OpenAPI, Swagger, Postman Collection, WSDL, GraphQL, or HAR to generate test cases and add them to your collection.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select value={protocol} onValueChange={setProtocol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REST">REST</SelectItem>
                      <SelectItem value="SOAP">SOAP</SelectItem>
                      <SelectItem value="GraphQL">GraphQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={specFormat} onValueChange={(val) => {
                    setSpecFormat(val);
                    // Auto-set protocol based on format
                    if (val === "wsdl") setProtocol("SOAP");
                    else if (val === "graphql") setProtocol("GraphQL");
                    else setProtocol("REST");
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openapi">OpenAPI/Swagger</SelectItem>
                      <SelectItem value="wsdl">WSDL/SOAP</SelectItem>
                      <SelectItem value="postman">Postman Collection</SelectItem>
                      <SelectItem value="graphql">GraphQL</SelectItem>
                      <SelectItem value="har">HAR (recorded traffic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Drag & Drop File Upload */}
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("border-primary", "bg-primary/5"); }}
                onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove("border-primary", "bg-primary/5"); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("border-primary", "bg-primary/5");
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const input = document.createElement("input");
                    input.type = "file";
                    const dt = new DataTransfer();
                    dt.items.add(file);
                    input.files = dt.files;
                    const event = { target: input } as React.ChangeEvent<HTMLInputElement>;
                    handleFileUpload(event);
                  }
                }}
                onClick={() => document.getElementById("import-file-input")?.click()}
              >
                <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">Drag & drop or click to upload</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Supports: .json, .yaml, .yml, .xml, .wsdl, .graphql, .gql, .har
                </p>
                <Input
                  id="import-file-input"
                  type="file"
                  accept=".json,.yaml,.yml,.xml,.wsdl,.graphql,.gql,.har"
                  onChange={handleFileUpload}
                  disabled={loading}
                  className="hidden"
                />
              </div>
              
              {/* URL Import */}
              <div className="space-y-2">
                <Label>Or Import from URL</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://petstore.swagger.io/v2/swagger.json"
                    value={importFetchUrl}
                    onChange={(e) => setImportFetchUrl(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    disabled={loading}
                    onClick={async () => {
                      const url = importFetchUrl.trim();
                      if (!url) { toast({ title: "Error", description: "Enter a URL", variant: "destructive" }); return; }
                      setLoading(true);
                      try {
                        // Use backend proxy to avoid CORS issues
                        const proxyRes = await fetch(`${API_BASE_URL}/api/import/fetch-url?url=${encodeURIComponent(url)}`);
                        if (!proxyRes.ok) {
                          const errData = await proxyRes.json().catch(() => ({}));
                          throw new Error(errData.detail || `Failed to fetch: ${proxyRes.status}`);
                        }
                        const proxyData = await proxyRes.json();
                        const text = proxyData.content;
                        
                        // Auto-detect format and validate spec content
                        let detectedFormat = "openapi";
                        let isValidSpec = false;
                        
                        if (url.includes("wsdl") || url.endsWith(".wsdl") || text.includes("<definitions") || text.includes("<wsdl:")) { 
                          detectedFormat = "wsdl"; setProtocol("SOAP"); isValidSpec = true;
                        } else if (url.includes("graphql") || text.includes("type Query") || text.includes("type Mutation")) { 
                          detectedFormat = "graphql"; setProtocol("GraphQL"); isValidSpec = true;
                        } else if (url.includes("postman") || text.includes("_postman_id") || text.includes('"item"')) { 
                          detectedFormat = "postman"; isValidSpec = true;
                        } else {
                          // Check if it looks like an OpenAPI/Swagger spec
                          try {
                            const parsed = JSON.parse(text);
                            if (parsed.openapi || parsed.swagger || parsed.paths || parsed.components) {
                              detectedFormat = "openapi"; isValidSpec = true;
                            }
                          } catch { /* not JSON or not a spec */ }
                          // Check YAML OpenAPI
                          if (!isValidSpec && (text.includes("openapi:") || text.includes("swagger:") || text.includes("paths:"))) {
                            detectedFormat = "openapi"; isValidSpec = true;
                          }
                        }
                        
                        setSpecContent(text);
                        setSpecFormat(detectedFormat);
                        
                        if (!isValidSpec) {
                          toast({
                            title: "Not an API Specification",
                            description: "This URL returned a regular API response, not an OpenAPI/Swagger/WSDL spec. Use the Builder tab to test API endpoints directly.",
                            variant: "destructive"
                          });
                        } else {
                          // Auto-extract base URL from the spec content (client-side, before backend parsing)
                          try {
                            const parsed = JSON.parse(text);
                            // OpenAPI 3.x: servers[0].url
                            let specBaseUrl = '';
                            if (parsed.servers && Array.isArray(parsed.servers) && parsed.servers[0]?.url) {
                              specBaseUrl = parsed.servers[0].url;
                            }
                            // Swagger 2.0: host + basePath + schemes
                            if (!specBaseUrl && parsed.host) {
                              const scheme = (parsed.schemes && parsed.schemes[0]) || 'https';
                              specBaseUrl = `${scheme}://${parsed.host}${parsed.basePath || ''}`;
                            }
                            if (specBaseUrl) {
                              setImportBaseUrl(specBaseUrl);
                            }
                          } catch {
                            // For YAML specs, try regex extraction
                            const serversMatch = text.match(/servers:\s*\n\s*-\s*url:\s*['"]?([^\s'"]+)/);
                            if (serversMatch?.[1]) {
                              setImportBaseUrl(serversMatch[1]);
                            } else {
                              // Fallback to URL origin
                              try {
                                const urlObj = new URL(url);
                                setImportBaseUrl(urlObj.origin);
                              } catch { /* ignore */ }
                            }
                          }
                          toast({ title: "Fetched", description: `Loaded ${text.length} bytes from URL. Click "Parse Specification" below.` });
                        }
                      } catch (e: any) {
                        toast({ title: "Fetch Failed", description: e.message, variant: "destructive" });
                      } finally { setLoading(false); }
                    }}
                  >
                    Fetch
                  </Button>
                </div>
              </div>
              
              {/* Text Paste */}
              <div className="space-y-2">
                <Label>Or Paste Specification</Label>
                <CodeEditor
                  value={specContent}
                  onChange={(val) => setSpecContent(val)}
                  language="json"
                  placeholder="Paste your API specification here (OpenAPI JSON/YAML, Postman Collection JSON, WSDL XML, GraphQL SDL, HAR JSON)..."
                  height="200px"
                  lineNumbers="off"
                />
              </div>

              {/* Base URL override */}
              <div className="space-y-2">
                <Label>Base URL (auto-detected, editable)</Label>
                <Input
                  placeholder="https://api.example.com"
                  value={importBaseUrl}
                  onChange={(e) => setImportBaseUrl(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  This base URL will be attached to all imported endpoints including security tests.
                </p>
              </div>

              <Button onClick={handleTextImport} disabled={loading || !specContent.trim()} className="w-full">
                {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Parsing...</> : "Parse Specification"}
              </Button>
            </CardContent>
          </Card>

          {/* Parsed Spec Preview — Enhanced with selective add */}
          {parsedSpec && (() => {
            // Build flat list of endpoints from parsed spec
            const endpointList: { key: string; method: string; path: string; summary: string; op: any }[] = [];
            Object.entries(parsedSpec.paths || {}).forEach(([path, methods]: [string, any]) => {
              Object.entries(methods || {}).forEach(([method, op]: [string, any]) => {
                endpointList.push({ key: `ep_${method}_${path}`, method: method.toUpperCase(), path, summary: op?.summary || op?.operation_id || '', op });
              });
            });
            
            // Only endpoint items — auto-generated test categories removed per redesign
            const allImportItems = endpointList.map(e => e.key);
            const totalItems = allImportItems.length;
            
            // Check which endpoints already exist in the active collection
            const store = useApiTestingStore.getState();
            const activeColl = store.active_collection_id ? store.collections[store.active_collection_id] : null;
            const existingEndpoints = new Set(
              (activeColl?.requests || []).map((r: any) => `${(r.method || 'GET').toUpperCase()} ${r.path || r.url || '/'}`)
            );
            
            // Resolve base URL from ALL possible sources — 6 layers of fallback
            const resolveBaseUrl = (): string => {
              // 1) User-entered / auto-detected base URL (React state)
              if (importBaseUrl.trim()) return importBaseUrl.trim();
              // 2) Backend parsed_spec.base_url
              if (parsedSpec.base_url) return parsedSpec.base_url;
              // 3) OpenAPI 3.x servers array
              if (parsedSpec.servers && Array.isArray(parsedSpec.servers) && parsedSpec.servers[0]?.url) {
                return parsedSpec.servers[0].url;
              }
              // 4) Swagger 2.0 host + basePath
              if (parsedSpec.host) {
                const scheme = (parsedSpec.schemes && parsedSpec.schemes[0]) || 'https';
                return `${scheme}://${parsedSpec.host}${parsedSpec.basePath || ''}`;
              }
              // 5) Extract from raw spec content (client-side)
              if (specContent) {
                try {
                  const raw = JSON.parse(specContent);
                  if (raw.servers?.[0]?.url) return raw.servers[0].url;
                  if (raw.host) {
                    const scheme = (raw.schemes && raw.schemes[0]) || 'https';
                    return `${scheme}://${raw.host}${raw.basePath || ''}`;
                  }
                } catch {
                  // YAML fallback
                  const sm = specContent.match(/servers:\s*\n\s*-\s*url:\s*['"]?([^\s'"]+)/);
                  if (sm?.[1]) return sm[1];
                  const hm = specContent.match(/host:\s*['"]?([^\s'"]+)/);
                  if (hm?.[1]) {
                    const bpm = specContent.match(/basePath:\s*['"]?([^\s'"]+)/);
                    const scm = specContent.match(/schemes:\s*\n\s*-\s*['"]?(\w+)/);
                    return `${scm?.[1] || 'https'}://${hm[1]}${bpm?.[1] || ''}`;
                  }
                }
              }
              // 6) Last resort: use origin of the fetch URL (e.g. https://jsonplaceholder.typicode.com)
              if (importFetchUrl.trim()) {
                try {
                  const fetchOrigin = new URL(importFetchUrl.trim()).origin;
                  if (fetchOrigin && fetchOrigin !== 'null') return fetchOrigin;
                } catch { /* ignore */ }
              }
              return '';
            };
            const baseUrl = resolveBaseUrl();

            // Helper: add endpoints to collection (clean, one request per endpoint)
            const addItemsToCollection = (itemKeys: string[]) => {
              const baseUrlVal = resolveBaseUrl();
              console.log('[API Import] resolveBaseUrl =', baseUrlVal, '| importBaseUrl =', importBaseUrl, '| parsedSpec.base_url =', parsedSpec.base_url, '| parsedSpec.servers =', parsedSpec.servers, '| parsedSpec.host =', parsedSpec.host, '| importFetchUrl =', importFetchUrl);

              // Warn if no base URL could be resolved — endpoints will have path-only URLs
              if (!baseUrlVal) {
                toast({
                  title: "No Base URL Detected",
                  description: "Could not detect a base URL from the spec. Please enter a base URL above, or endpoints will be saved with path-only URLs.",
                  variant: "destructive",
                });
              }

              let addedCount = 0;

              for (const ek of itemKeys) {
                const ep = endpointList.find(e => e.key === ek);
                if (!ep) continue;
                const fullUrl = baseUrlVal && !ep.path.startsWith('http')
                  ? `${baseUrlVal.replace(/\/$/, '')}${ep.path.startsWith('/') ? ep.path : `/${ep.path}`}`
                  : ep.path;
                // Build sample body for write methods
                let bodyStr = '';
                if (['POST', 'PUT', 'PATCH'].includes(ep.method)) {
                  const reqBody = ep.op?.requestBody?.content?.['application/json']?.schema;
                  if (reqBody?.properties) {
                    const sample: any = {};
                    for (const [propName, propSchema] of Object.entries(reqBody.properties)) {
                      const ps = propSchema as any;
                      sample[propName] = ps.type === 'integer' ? 1 : ps.type === 'number' ? 1.0 : ps.type === 'boolean' ? true : ps.type === 'array' ? [] : `sample_${propName}`;
                    }
                    bodyStr = JSON.stringify(sample, null, 2);
                  }
                }
                useApiTestingStore.getState().addRequest({
                  method: ep.method,
                  url: fullUrl,
                  path: ep.path,
                  name: `${ep.method} ${ep.path}`,
                  body: bodyStr,
                  body_type: bodyStr ? 'json' : 'none',
                  headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
                });
                addedCount++;
              }
              
              // Store the base URL on the collection via proper store action (persists to DB + localStorage)
              const storeNow = useApiTestingStore.getState();
              const collIdNow = storeNow.active_collection_id;
              if (collIdNow && baseUrlVal) {
                storeNow.updateCollection(collIdNow, { base_url: baseUrlVal } as any);
              }
              // One save after all bulk additions
              const finalState = useApiTestingStore.getState();
              const finalCollId = finalState.active_collection_id;
              if (finalCollId) {
                finalState._saveCollectionNow(finalCollId);
              }
              
              const collName = finalState.collections[finalCollId || '']?.name || 'Collection';
              toast({
                title: "Added to Collection",
                description: `${addedCount} endpoint${addedCount !== 1 ? 's' : ''} added to "${collName}". Click any in the sidebar to open in Builder, send a request, and add assertions from the real response.`,
              });
            };
            
            return (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <CardTitle className="text-lg">Parsed Endpoints</CardTitle>
                      <CardDescription>
                        {endpointList.length} endpoints from {parsedSpec.format || specFormat} spec
                        {baseUrl ? ` | Base URL: ${baseUrl}` : ' | No base URL detected'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImportItems(new Set(allImportItems))}
                      >
                        Select All
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedImportItems(new Set())}
                      >
                        Deselect All
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Endpoints Section */}
                  {endpointList.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          Endpoints ({endpointList.length})
                        </h4>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const epKeys = endpointList.map(e => e.key);
                            setSelectedImportItems(prev => {
                              const next = new Set(prev);
                              const allSelected = epKeys.every(k => next.has(k));
                              if (allSelected) epKeys.forEach(k => next.delete(k));
                              else epKeys.forEach(k => next.add(k));
                              return next;
                            });
                          }}
                        >
                          Toggle All Endpoints
                        </Button>
                      </div>
                      <div className="max-h-48 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-10">
                                <input
                                  type="checkbox"
                                  checked={endpointList.every(e => selectedImportItems.has(e.key))}
                                  onChange={(e) => {
                                    setSelectedImportItems(prev => {
                                      const next = new Set(prev);
                                      endpointList.forEach(ep => e.target.checked ? next.add(ep.key) : next.delete(ep.key));
                                      return next;
                                    });
                                  }}
                                  className="cursor-pointer"
                                />
                              </TableHead>
                              <TableHead className="w-20">Method</TableHead>
                              <TableHead>Path</TableHead>
                              <TableHead>Summary</TableHead>
                              <TableHead className="w-32">Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {endpointList.map(ep => {
                              const alreadyAdded = existingEndpoints.has(`${ep.method} ${ep.path}`);
                              return (
                                <TableRow key={ep.key} className={alreadyAdded ? 'opacity-50' : ''}>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={selectedImportItems.has(ep.key)}
                                      onChange={() => {
                                        setSelectedImportItems(prev => {
                                          const next = new Set(prev);
                                          next.has(ep.key) ? next.delete(ep.key) : next.add(ep.key);
                                          return next;
                                        });
                                      }}
                                      className="cursor-pointer"
                                      disabled={alreadyAdded}
                                    />
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className={
                                      ep.method === "GET" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" :
                                      ep.method === "POST" ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" :
                                      ep.method === "PUT" ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" :
                                      ep.method === "DELETE" ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" :
                                      ""
                                    }>
                                      {ep.method}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="font-mono text-sm">{ep.path}</TableCell>
                                  <TableCell className="text-sm text-muted-foreground">{ep.summary || '-'}</TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-1">
                                      {alreadyAdded ? (
                                        <Badge variant="secondary" className="text-[10px]">
                                          <CheckCircle2 className="w-3 h-3 mr-1" /> Added
                                        </Badge>
                                      ) : (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          className="h-7 px-2 text-green-600 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-950"
                                          onClick={() => addItemsToCollection([ep.key])}
                                          title="Add this endpoint to collection"
                                        >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add
                                        </Button>
                                      )}
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950"
                                        onClick={() => {
                                          const fullUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}${ep.path}` : ep.path;
                                          let sampleBody: any = undefined;
                                          if (["POST", "PUT", "PATCH"].includes(ep.method)) {
                                            const reqBody = ep.op?.requestBody?.content?.["application/json"]?.schema;
                                            if (reqBody?.properties) {
                                              sampleBody = {};
                                              for (const [propName, propSchema] of Object.entries(reqBody.properties)) {
                                                const ps = propSchema as any;
                                                sampleBody[propName] = ps.type === "integer" ? 1 : ps.type === "number" ? 1.0 : ps.type === "boolean" ? true : ps.type === "array" ? [] : `sample_${propName}`;
                                              }
                                            }
                                          }
                                          setBuilderInitialRequest({ method: ep.method, url: fullUrl, headers: { "Content-Type": "application/json" }, body: sampleBody });
                                          setActiveTab("builder");
                                        }}
                                      >
                                        <Send className="w-3 h-3 mr-1" />
                                        Try
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Tip: how to add assertions */}
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-dashed">
                    <strong>Tip:</strong> Add endpoints to the collection, then click any in the sidebar to open in Builder.
                    Send the request, see the live response, and click response fields to add real assertions.
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      className="flex-1"
                      disabled={loading || totalItems === 0}
                      onClick={() => addItemsToCollection(allImportItems)}
                    >
                      <Database className="w-4 h-4 mr-2" />
                      Add All Endpoints ({totalItems})
                    </Button>
                    {selectedImportItems.size > 0 && selectedImportItems.size < totalItems && (
                      <Button
                        variant="secondary"
                        className="flex-1"
                        disabled={loading}
                        onClick={() => addItemsToCollection(Array.from(selectedImportItems))}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Selected ({selectedImportItems.size})
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </TabsContent>

        {/* Chains Tab - Request Chaining */}
        <TabsContent value="chains" className="space-y-4">
          <TabErrorBoundary tabName="Chains">
            <RequestChainBuilder />
          </TabErrorBoundary>
        </TabsContent>



        {/* Execute Tab — Collection-Driven */}
        <TabsContent value="execute" className="space-y-4">
          <TabErrorBoundary tabName="Execute">
          
          {/* Collection-driven execution: reads from sidebar collection as single source of truth */}
          {(() => {
            const store = useApiTestingStore.getState();
            const collId = store.active_collection_id;
            const coll = collId ? store.collections[collId] : null;
            const collReqs = coll?.requests || [];
            const collFolders = coll?.folders || [];
            const isExecuting = store.executing;
            
            // Get latest results for status indicators
            const testRuns = store.test_runs || [];
            const lastResultMap: Record<string, { status: string; response_status: number; time: number }> = {};
            for (const run of [...testRuns].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())) {
              if (run.status === 'passed' || run.status === 'failed') {
                for (const r of run.results) {
                  if (r.request_id && !lastResultMap[r.request_id]) {
                    lastResultMap[r.request_id] = { status: r.status, response_status: r.response_status, time: r.response_time_ms };
                  }
                }
              }
            }
            
            if (collReqs.length === 0) {
              return (
                <Card className="border-dashed border-2 border-muted-foreground/25">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Play className="w-16 h-16 text-muted-foreground/30 mb-4" />
                    <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Tests to Execute</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                      Import an API specification and add endpoints to your collection, or build requests from the Builder tab.
                    </p>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setActiveTab("import")}>
                        <Upload className="w-4 h-4 mr-2" />
                        Import Spec
                      </Button>
                      <Button variant="default" onClick={() => setActiveTab("builder")}>
                        <Zap className="w-4 h-4 mr-2" />
                        Build Request
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            
            // Apply filter
            const filterLower = executeFilter.toLowerCase();
            const filteredRequests = filterLower 
              ? collReqs.filter((req: any) => {
                  const name = (req.name || '').toLowerCase();
                  const method = (req.method || '').toLowerCase();
                  const path = (req.url || req.path || '').toLowerCase();
                  const testType = (req.test_type || '').toLowerCase();
                  return name.includes(filterLower) || method.includes(filterLower) || path.includes(filterLower) || testType.includes(filterLower);
                })
              : collReqs;
              
            // Summary stats from last run
            const passCount = Object.values(lastResultMap).filter(r => r.status === 'passed').length;
            const failCount = Object.values(lastResultMap).filter(r => r.status === 'failed' || r.status === 'error').length;
            
            return (
              <>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <CardTitle>Execute Collection Tests</CardTitle>
                        <CardDescription>
                          {collReqs.length} tests in "{coll?.name || 'Collection'}" 
                          {collFolders.length > 0 && ` • ${collFolders.length} folders`}
                          {(passCount > 0 || failCount > 0) && ` • Last run: ${passCount} passed, ${failCount} failed`}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Environment Selector */}
                    <div className="space-y-2">
                      <Label>Environment *</Label>
                      <Select 
                        value={selectedEnvironment} 
                        onValueChange={(value) => {
                          setSelectedEnvironment(value);
                          localStorage.setItem("apex_selected_environment", value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          {environments.length === 0 ? (
                            <SelectItem value="__no_env__" disabled>No environments. Create one in Env tab.</SelectItem>
                          ) : (
                            environments.map((env) => {
                              const varCount = Array.isArray(env.variables) ? env.variables.length : Object.keys(env.variables || {}).length;
                              return (
                              <SelectItem key={env.environment_id} value={env.environment_id}>
                                <span className="flex items-center gap-2">
                                  <span className={`w-2 h-2 rounded-full ${env.type === "production" ? "bg-red-500" : env.type === "staging" ? "bg-amber-500" : "bg-green-500"}`} />
                                  {env.name} ({env.base_url}){varCount > 0 ? ` [${varCount} vars]` : ""}
                                </span>
                              </SelectItem>
                              );
                            })
                          )}
                        </SelectContent>
                      </Select>
                      {selectedEnvironment && (
                        <p className="text-sm text-muted-foreground">
                          Base URL: {environments.find(e => e.environment_id === selectedEnvironment)?.base_url || "N/A"}
                        </p>
                      )}
                    </div>

                    {/* Test list with checkboxes, search, and status */}
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex gap-2 items-center">
                        <Input
                          placeholder="Filter tests..."
                          value={executeFilter}
                          onChange={(e) => setExecuteFilter(e.target.value)}
                          className="h-8 w-40 text-xs"
                        />
                        <Button variant="outline" size="sm" onClick={() => {
                          setSelectedTestCases(new Set(collReqs.map((r: any) => r.id)));
                        }}>Select All</Button>
                        <Button variant="outline" size="sm" onClick={() => setSelectedTestCases(new Set())}>Deselect</Button>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {selectedTestCases.size > 0 ? `${selectedTestCases.size} of ${collReqs.length} selected` : `${collReqs.length} tests`}
                      </span>
                    </div>

                    <div className="max-h-96 overflow-y-auto border rounded-md">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <input
                                type="checkbox"
                                checked={selectedTestCases.size === collReqs.length && collReqs.length > 0}
                                onChange={(e) => {
                                  if (e.target.checked) setSelectedTestCases(new Set(collReqs.map((r: any) => r.id)));
                                  else setSelectedTestCases(new Set());
                                }}
                                className="cursor-pointer"
                              />
                            </TableHead>
                            <TableHead className="w-14">Status</TableHead>
                            <TableHead>Test</TableHead>
                            <TableHead className="w-20">Method</TableHead>
                            <TableHead>Endpoint</TableHead>
                            <TableHead className="w-20">Type</TableHead>
                            <TableHead className="w-24">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRequests.slice(0, 100).map((req: any) => {
                            const isSelected = selectedTestCases.has(req.id);
                            const result = lastResultMap[req.id];
                            const folder = collFolders.find((f: any) => f.id === req.folder_id);
                            return (
                              <TableRow key={req.id} className={isSelected ? 'bg-blue-50 dark:bg-blue-950/30' : ''}>
                                <TableCell>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedTestCases(prev => {
                                        const next = new Set(prev);
                                        next.has(req.id) ? next.delete(req.id) : next.add(req.id);
                                        return next;
                                      });
                                    }}
                                    className="cursor-pointer"
                                  />
                                </TableCell>
                                <TableCell>
                                  {result ? (
                                    <Badge variant={result.status === 'passed' ? 'default' : 'destructive'} className="text-[10px]">
                                      {result.status === 'passed' ? '✓' : '✗'}
                                    </Badge>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-medium text-sm">
                                  <div>
                                    {req.name || `${req.method} ${req.path || req.url || '/'}`}
                                    {folder && (
                                      <span className="block text-[10px] text-muted-foreground">
                                        <Folder className="w-2.5 h-2.5 inline mr-0.5" />{folder.name}
                                      </span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs font-mono">{req.method}</Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                                  {req.path || req.url || '/'}
                                </TableCell>
                                <TableCell>
                                  {(() => {
                                    const tt = req.test_type || 'functional';
                                    const label = tt === 'negative' ? '⚠️ Neg' : tt === 'boundary' ? '📐 Bnd' : tt === 'security' ? '🔒 Sec' : tt === 'performance' ? '⚡ Perf' : tt === 'functional' ? 'Func' : tt.replace(/_/g, ' ');
                                    const cls = tt === 'negative' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' : tt === 'security' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : '';
                                    return <Badge variant="secondary" className={`text-[10px] ${cls}`}>{label}</Badge>;
                                  })()}
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0 text-green-600"
                                      title="Run this test"
                                      onClick={() => {
                                        const s = useApiTestingStore.getState();
                                        s.createTestRun(req.name || `${req.method} ${req.path}`, [req.id], s.active_environment_id || undefined)
                                          .then((createdRun) => { if (createdRun) s.executeTestRun(createdRun.id); });
                                      }}
                                    >
                                      <Play className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      title="Edit in Builder"
                                      onClick={() => {
                                        useApiTestingStore.getState().openRequestInBuilder(req.id);
                                        setActiveTab('builder');
                                      }}
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      {filteredRequests.length > 100 && (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          Showing first 100 of {filteredRequests.length} tests
                        </div>
                      )}
                      {executeFilter && filteredRequests.length === 0 && (
                        <div className="p-3 text-center text-sm text-muted-foreground">
                          No tests match "{executeFilter}"
                        </div>
                      )}
                    </div>

                    {/* Collection Runner Config */}
                    <div className="space-y-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => setShowRunnerConfig(!showRunnerConfig)}
                      >
                        <Settings className="w-3 h-3 mr-1" />
                        Runner Options
                        {runIterations > 1 && <Badge variant="secondary" className="ml-1 text-[10px] h-4">{runIterations}x</Badge>}
                        {showRunnerConfig ? <ChevronDown className="w-3 h-3 ml-1" /> : <ChevronRight className="w-3 h-3 ml-1" />}
                      </Button>
                      {showRunnerConfig && (
                        <div className="grid grid-cols-3 gap-3 p-3 border rounded-lg bg-muted/20">
                          <div>
                            <Label className="text-xs">Iterations</Label>
                            <Input
                              type="number"
                              min={1}
                              max={100}
                              value={runIterations}
                              onChange={e => setRunIterations(Math.max(1, parseInt(e.target.value) || 1))}
                              className="h-8 text-xs mt-1"
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">Run collection N times</p>
                          </div>
                          <div>
                            <Label className="text-xs">Delay (ms)</Label>
                            <Input
                              type="number"
                              min={0}
                              value={runDelay}
                              onChange={e => setRunDelay(Math.max(0, parseInt(e.target.value) || 0))}
                              className="h-8 text-xs mt-1"
                            />
                            <p className="text-[10px] text-muted-foreground mt-0.5">Delay between requests</p>
                          </div>
                          <div className="flex items-end pb-5">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={runBailOnError} onChange={e => setRunBailOnError(e.target.checked)} />
                              Stop on first error
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Execute buttons */}
                    <div className="flex gap-2">
                      <Button
                        className="flex-1"
                        disabled={isExecuting || !selectedEnvironment}
                        onClick={async () => {
                          const s = useApiTestingStore.getState();
                          const idsToRun = selectedTestCases.size > 0
                            ? Array.from(selectedTestCases)
                            : collReqs.map((r: any) => r.id);

                          for (let iter = 0; iter < runIterations; iter++) {
                            const runName = runIterations > 1
                              ? `${coll?.name || 'Collection'} — Iteration ${iter + 1}/${runIterations}`
                              : `${coll?.name || 'Collection'} - ${selectedTestCases.size > 0 ? `${selectedTestCases.size} selected` : 'Full Run'}`;

                            const createdRun = await s.createTestRun(runName, idsToRun, s.active_environment_id || undefined);
                            if (createdRun) {
                              await s.executeTestRun(createdRun.id);
                              setExecutionResults(useApiTestingStore.getState().execution_results);
                            }

                            // Check bail on error
                            if (runBailOnError) {
                              const latestResults = useApiTestingStore.getState().execution_results;
                              const hasFailure = latestResults?.some((r: any) => r.status === 'failed' || r.status === 'error');
                              if (hasFailure) break;
                            }

                            // Delay between iterations
                            if (runDelay > 0 && iter < runIterations - 1) {
                              await new Promise(r => setTimeout(r, runDelay));
                            }
                          }
                          setActiveTab("results");
                        }}
                      >
                        {isExecuting ? (
                          <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Executing...</>
                        ) : (
                          <><Play className="w-4 h-4 mr-2" />
                            {selectedTestCases.size > 0
                              ? `Execute ${selectedTestCases.size} Selected Tests`
                              : `Execute All ${collReqs.length} Tests`
                            }
                            {runIterations > 1 && ` × ${runIterations}`}
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                
                {/* Recent run results inline */}
                {testRuns.filter(r => r.collection_id === collId && r.results.length > 0).slice(0, 3).map(run => {
                  const rPassCount = run.results.filter(r => r.status === 'passed').length;
                  const rFailCount = run.results.filter(r => r.status === 'failed' || r.status === 'error').length;
                  const rTotal = run.results.length || run.request_ids.length;
                  const rPassRate = rTotal > 0 ? Math.round((rPassCount / rTotal) * 100) : 0;
                  return (
                    <Card key={run.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={run.status === 'passed' ? 'default' : run.status === 'failed' ? 'destructive' : 'outline'}>
                              {run.status}
                            </Badge>
                            <span className="font-medium text-sm">{run.name}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{run.started_at ? new Date(run.started_at).toLocaleString() : ''}</span>
                            {run.duration_ms > 0 && <span>{Math.round(run.duration_ms)}ms</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-xs">
                          <span className="text-green-600">Passed: <strong>{rPassCount}</strong></span>
                          <span className="text-red-600">Failed: <strong>{rFailCount}</strong></span>
                          <span className="text-muted-foreground">Rate: <strong>{rPassRate}%</strong></span>
                          <Progress value={rPassRate} className="h-2 flex-1 max-w-[200px]" />
                        </div>
                      </CardHeader>
                    </Card>
                  );
                })}
              </>
            );
          })()}
          </TabErrorBoundary>
        </TabsContent>


        {/* Data-Driven Testing Tab */}
        <TabsContent value="data-driven" className="space-y-4">
          <TabErrorBoundary tabName="Data-Driven">
            <DataDrivenPanel testSuite={testSuite} />
          </TabErrorBoundary>
        </TabsContent>

        {/* Mock Server Tab */}
        <TabsContent value="mock" className="space-y-4">
          <TabErrorBoundary tabName="Mock Server">
            <MockServerPanel />
          </TabErrorBoundary>
        </TabsContent>

        {/* Security Scan Tab */}
        <TabsContent value="security" className="space-y-4">
          <TabErrorBoundary tabName="Security">
            <SecurityScanPanel />
          </TabErrorBoundary>
        </TabsContent>

        {/* WebSocket Client Tab */}
        <TabsContent value="websocket" className="space-y-4">
          <TabErrorBoundary tabName="WebSocket">
            <WebSocketClient />
          </TabErrorBoundary>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments" className="space-y-4">
          {/* Variable scoping: Global & Collection (Tier 2 — zero-code) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Variable scoping</CardTitle>
              <CardDescription>
                Resolve order: Global → Environment → Collection. Use <code className="bg-muted px-1 rounded">{`{{name}}`}</code> in URL, headers, body.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Global (workspace)</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 bg-muted/20">
                    {Object.entries(globalVariables).map(([k, v]) => (
                      <div key={k} className="flex gap-2 items-center text-xs">
                        <span className="font-mono text-primary">{k}</span>
                        <span className="truncate text-muted-foreground">= {String(v).slice(0, 40)}{String(v).length > 40 ? "…" : ""}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { const next = { ...globalVariables }; delete next[k]; persistGlobalVars(next); }}>×</Button>
                      </div>
                    ))}
                    {Object.keys(globalVariables).length === 0 && <p className="text-xs text-muted-foreground">No global variables</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key"
                      className="flex-1 h-8 text-xs"
                      value={newGlobalVarKey}
                      onChange={e => setNewGlobalVarKey(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newGlobalVarKey.trim()) {
                          persistGlobalVars({ ...globalVariables, [newGlobalVarKey.trim()]: newGlobalVarVal });
                          setNewGlobalVarKey(""); setNewGlobalVarVal("");
                        }
                      }}
                    />
                    <Input
                      placeholder="Value"
                      className="flex-1 h-8 text-xs"
                      value={newGlobalVarVal}
                      onChange={e => setNewGlobalVarVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newGlobalVarKey.trim()) {
                          persistGlobalVars({ ...globalVariables, [newGlobalVarKey.trim()]: newGlobalVarVal });
                          setNewGlobalVarKey(""); setNewGlobalVarVal("");
                        }
                      }}
                    />
                    <Button size="sm" className="h-8" onClick={() => {
                      if (newGlobalVarKey.trim()) {
                        persistGlobalVars({ ...globalVariables, [newGlobalVarKey.trim()]: newGlobalVarVal });
                        setNewGlobalVarKey(""); setNewGlobalVarVal("");
                      }
                    }}>Add</Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Collection (current suite)</Label>
                  <div className="space-y-1 max-h-40 overflow-y-auto border rounded p-2 bg-muted/20">
                    {Object.entries(collectionVariables).map(([k, v]) => (
                      <div key={k} className="flex gap-2 items-center text-xs">
                        <span className="font-mono text-primary">{k}</span>
                        <span className="truncate text-muted-foreground">= {String(v).slice(0, 40)}{String(v).length > 40 ? "…" : ""}</span>
                        <Button variant="ghost" size="sm" className="h-6 px-1" onClick={() => { const next = { ...collectionVariables }; delete next[k]; persistCollectionVars(next); }}>×</Button>
                      </div>
                    ))}
                    {Object.keys(collectionVariables).length === 0 && <p className="text-xs text-muted-foreground">No collection variables</p>}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Key"
                      className="flex-1 h-8 text-xs"
                      value={newCollVarKey}
                      onChange={e => setNewCollVarKey(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCollVarKey.trim()) {
                          persistCollectionVars({ ...collectionVariables, [newCollVarKey.trim()]: newCollVarVal });
                          setNewCollVarKey(""); setNewCollVarVal("");
                        }
                      }}
                    />
                    <Input
                      placeholder="Value"
                      className="flex-1 h-8 text-xs"
                      value={newCollVarVal}
                      onChange={e => setNewCollVarVal(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && newCollVarKey.trim()) {
                          persistCollectionVars({ ...collectionVariables, [newCollVarKey.trim()]: newCollVarVal });
                          setNewCollVarKey(""); setNewCollVarVal("");
                        }
                      }}
                    />
                    <Button size="sm" className="h-8" onClick={() => {
                      if (newCollVarKey.trim()) {
                        persistCollectionVars({ ...collectionVariables, [newCollVarKey.trim()]: newCollVarVal });
                        setNewCollVarKey(""); setNewCollVarVal("");
                      }
                    }}>Add</Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <EnvironmentManagerComponent
            environments={environments}
            selectedEnvironmentId={selectedEnvironment}
            onEnvironmentsChange={(envs) => {
              setEnvironments(envs);
              saveEnvironmentsToLocalStorage(envs);
              // Note: Individual environment saves to DB are handled by EnvironmentManager itself
              // (create/update/delete). No need to re-sync ALL environments here.
            }}
            onSelectedChange={(id) => {
              setSelectedEnvironment(id);
              localStorage.setItem("apex_selected_environment", id);
            }}
          />

          {/* Database Connectivity - moved from standalone tab */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Connectivity
              </CardTitle>
              <CardDescription>
                Connect to databases for data-driven testing and assertions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Connection ID</Label>
                  <Input
                    value={dbConfig.connection_id}
                    onChange={(e) => setDbConfig({...dbConfig, connection_id: e.target.value})}
                    placeholder="db1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Database Type</Label>
                  <Select value={dbConfig.db_type} onValueChange={(v) => setDbConfig({...dbConfig, db_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="sqlite">SQLite</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                      <SelectItem value="mssql">MSSQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={dbConfig.host}
                    onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={dbConfig.port}
                    onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Database</Label>
                  <Input
                    value={dbConfig.database}
                    onChange={(e) => setDbConfig({...dbConfig, database: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>User</Label>
                  <Input
                    value={dbConfig.user}
                    onChange={(e) => setDbConfig({...dbConfig, user: e.target.value})}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={dbConfig.password}
                    onChange={(e) => setDbConfig({...dbConfig, password: e.target.value})}
                  />
                </div>
              </div>
              <Button onClick={handleConnectDatabase} disabled={loading}>
                <Database className="w-4 h-4 mr-2" />
                {loading ? "Connecting..." : "Connect"}
              </Button>
              
              {dbConnections.length > 0 && (
                <div className="mt-4">
                  <Label>Active Connections</Label>
                  <div className="space-y-2 mt-2">
                    {dbConnections.map((conn, idx) => (
                      <Badge key={idx} variant="outline" className="mr-2">
                        {conn.connection_id} ({conn.type})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>


        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <TabErrorBoundary tabName="Results">
          {executionResults && (
            <>
              {/* Export Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant={reportViewTab === "summary" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("summary")}
                  >
                    📊 Summary
                  </Button>
                  <Button 
                    variant={reportViewTab === "html" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("html")}
                  >
                    🌐 HTML Report
                  </Button>
                  <Button 
                    variant={reportViewTab === "junit" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("junit")}
                  >
                    📋 JUnit XML
                  </Button>
                  <Button 
                    variant={reportViewTab === "json" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("json")}
                  >
                    📦 JSON
                  </Button>
                  <Button 
                    variant={reportViewTab === "allure" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("allure")}
                    className="border-orange-500/30 data-[state=active]:bg-orange-500/20"
                  >
                    🔶 Allure
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={exportAsJUnitXML} title="Download JUnit XML">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsHTML} title="Download HTML">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsJSON} title="Download JSON">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsAllure} title="Download Allure">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Summary View */}
              {reportViewTab === "summary" && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Execution Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="text-2xl font-bold">{executionResults.summary?.total || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Passed</p>
                          <p className="text-2xl font-bold text-green-600">{executionResults.summary?.passed || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Failed</p>
                          <p className="text-2xl font-bold text-red-600">{executionResults.summary?.failed || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pass Rate</p>
                          <p className="text-2xl font-bold">{executionResults.summary?.pass_rate?.toFixed(1) || 0}%</p>
                        </div>
                      </div>
                      
                      {executionResults.performance_metrics && (
                        <div className="mt-4 space-y-2">
                          <Label>Performance Metrics</Label>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Avg Response Time</p>
                              <p className="font-semibold">{executionResults.performance_metrics.avg_response_time_ms?.toFixed(2)}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">P95 Response Time</p>
                              <p className="font-semibold">{executionResults.performance_metrics.p95_response_time_ms?.toFixed(2)}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Requests/sec</p>
                              <p className="font-semibold">{executionResults.performance_metrics.requests_per_second?.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Test Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Test Case</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Response Time</TableHead>
                              <TableHead>Status Code</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {executionResults.test_results && executionResults.test_results.length > 0 ? (
                              executionResults.test_results.slice(0, 100).map((result: any, idx: number) => {
                                const isExpanded = expandedResultIdx === idx;
                                return (
                                  <React.Fragment key={idx}>
                                    <TableRow 
                                      className="cursor-pointer hover:bg-muted/50"
                                      onClick={() => setExpandedResultIdx(isExpanded ? null : idx)}
                                    >
                                      <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                          <span>{result.title || result.name || result.test_name || result.test_case_name || `Test ${idx + 1}`}</span>
                                          <span className="text-xs text-muted-foreground font-mono">{result.method} {result.url?.replace(/https?:\/\/[^/]+/, '') || ''}</span>
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <Badge variant={result.status === "passed" ? "default" : "destructive"}>
                                          {result.status || "unknown"}
                                        </Badge>
                                      </TableCell>
                                      <TableCell>{result.response_time_ms?.toFixed(0) || "N/A"}ms</TableCell>
                                      <TableCell>{result.actual_status || result.status_code || "N/A"}</TableCell>
                                    </TableRow>
                                    {isExpanded && (
                                      <TableRow>
                                        <TableCell colSpan={4} className="bg-muted/30 p-4">
                                          <div className="grid grid-cols-2 gap-4 text-sm">
                                            {/* Request side */}
                                            <div className="space-y-2">
                                              <p className="font-semibold text-blue-600 dark:text-blue-400">Request</p>
                                              <div className="bg-background rounded p-3 border space-y-1">
                                                <p><span className="font-medium">URL:</span> <code className="text-xs">{result.url || "N/A"}</code></p>
                                                <p><span className="font-medium">Method:</span> {result.method || "N/A"}</p>
                                                {result.request_headers && Object.keys(result.request_headers).length > 0 && (
                                                  <div>
                                                    <p className="font-medium">Headers:</p>
                                                    <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-24 overflow-auto">{JSON.stringify(result.request_headers, null, 2)}</pre>
                                                  </div>
                                                )}
                                                {result.request_body && (
                                                  <div>
                                                    <p className="font-medium">Body:</p>
                                                    <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-32 overflow-auto">{typeof result.request_body === 'string' ? result.request_body : JSON.stringify(result.request_body, null, 2)}</pre>
                                                  </div>
                                                )}
                                              </div>
                                            </div>
                                            {/* Response side */}
                                            <div className="space-y-2">
                                              <p className="font-semibold text-green-600 dark:text-green-400">Response ({result.actual_status})</p>
                                              <div className="bg-background rounded p-3 border space-y-1">
                                                <p><span className="font-medium">Status:</span> {result.actual_status} (expected {result.expected_status})</p>
                                                <p><span className="font-medium">Time:</span> {result.response_time_ms?.toFixed(0)}ms</p>
                                                {result.response_headers && Object.keys(result.response_headers).length > 0 && (
                                                  <div>
                                                    <p className="font-medium">Headers:</p>
                                                    <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-24 overflow-auto">{JSON.stringify(result.response_headers, null, 2)}</pre>
                                                  </div>
                                                )}
                                                {result.response_body && (
                                                  <div>
                                                    <p className="font-medium">Body:</p>
                                                    <pre className="text-xs bg-muted p-2 rounded mt-1 max-h-48 overflow-auto">{typeof result.response_body === 'string' ? result.response_body : JSON.stringify(result.response_body, null, 2)}</pre>
                                                  </div>
                                                )}
                                                {result.error && (
                                                  <p className="text-red-600 dark:text-red-400"><span className="font-medium">Error:</span> {result.error}</p>
                                                )}
                                              </div>
                                            </div>
                                          </div>
                                          {/* Assertions */}
                                          {result.assertions && result.assertions.results && (
                                            <div className="mt-3">
                                              <p className="font-semibold text-sm mb-1">Assertions</p>
                                              <div className="space-y-1">
                                                {result.assertions.results.map((a: any, ai: number) => (
                                                  <div key={ai} className="flex items-center gap-2 text-xs">
                                                    {a.passed ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                                                    <span>{a.message || (a.passed ? "Passed" : "Failed")}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </React.Fragment>
                                );
                              })
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                  No test results available. Tests may not have executed successfully.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* HTML Report View */}
              {reportViewTab === "html" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🌐 HTML Report Preview
                      <Button variant="outline" size="sm" onClick={exportAsHTML}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <iframe 
                        srcDoc={generateHTMLContent(executionResults)} 
                        className="w-full h-[500px] border-0"
                        title="HTML Report Preview"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* JUnit XML View */}
              {reportViewTab === "junit" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📋 JUnit XML Report
                      <Button variant="outline" size="sm" onClick={exportAsJUnitXML}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>Compatible with CI/CD tools like Jenkins, GitHub Actions, Azure DevOps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponseCodeViewer
                      value={generateJUnitXMLContent(executionResults)}
                      language="xml"
                      height="500px"
                    />
                  </CardContent>
                </Card>
              )}

              {/* JSON View */}
              {reportViewTab === "json" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📦 JSON Results
                      <Button variant="outline" size="sm" onClick={exportAsJSON}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>Raw test execution data for custom processing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponseCodeViewer
                      value={JSON.stringify(executionResults, null, 2)}
                      language="json"
                      height="500px"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Allure View */}
              {reportViewTab === "allure" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🔶 Allure Report Data
                      <Button variant="outline" size="sm" onClick={exportAsAllure}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Download and run <code className="bg-muted px-1 rounded">allure generate allure-results-*.json</code> to view the full Allure report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Allure reports require the Allure CLI to generate. Install with: <code className="bg-muted px-1 rounded">npm install -g allure-commandline</code>
                      </AlertDescription>
                    </Alert>
                    <ResponseCodeViewer
                      value={generateAllureContent(executionResults)}
                      language="json"
                      height="400px"
                    />
                  </CardContent>
                </Card>
              )}
            </>
          )}
          
          {testSuite && !executionResults && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Test suite generated. Go to Execute tab to run tests.
              </AlertDescription>
            </Alert>
          )}
          {!testSuite && !executionResults && (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Results Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  Run API tests to see execution results, pass/fail rates, response times, and detailed reports here.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("execute")}>
                    <Play className="w-4 h-4 mr-2" />
                    Go to Execute
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("builder")}>
                    <Zap className="w-4 h-4 mr-2" />
                    Build a Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Test Case Detail Dialog */}
      <Dialog open={!!viewingTestCase} onOpenChange={(open) => !open && setViewingTestCase(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
            <DialogTitle className="text-2xl">
              {viewingTestCase?.name || viewingTestCase?.test_name || viewingTestCase?.title || "Test Case Details"}
            </DialogTitle>
            <DialogDescription>
              {viewingTestCase?.description || "View request, response, and assertion details"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="json">JSON View</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Test Case Info */}
                {viewingTestCase && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Test Type</Label>
                    <Badge variant="outline" className="mt-1">
                      {viewingTestCase.test_type || viewingTestCase.category || "functional"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Priority</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {viewingTestCase.priority || "medium"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Expected Status</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {viewingTestCase.expected_status || viewingTestCase.expectedStatusCode || 200}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Method</Label>
                    <p className="text-sm font-mono text-muted-foreground mt-1">
                      {viewingTestCase.method || "GET"}
                    </p>
                  </div>
                </div>

                {/* Endpoint */}
                <div>
                  <Label className="text-sm font-semibold">Endpoint</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <code className="text-sm break-all">
                      {viewingTestCase.method || "GET"} {viewingTestCase.endpoint || viewingTestCase.url || viewingTestCase.path || 
                       (viewingTestCase.request?.url) || (viewingTestCase.steps?.[0]?.url) || "N/A"}
                    </code>
                  </div>
                </div>

                {/* Request Headers */}
                {(viewingTestCase.request?.headers || viewingTestCase.headers) && (
                  <div>
                    <Label className="text-sm font-semibold">Request Headers</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(viewingTestCase.request?.headers || viewingTestCase.headers || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {(viewingTestCase.request?.body || viewingTestCase.body || viewingTestCase.request_body || viewingTestCase.request_payload) && (
                  <div>
                    <Label className="text-sm font-semibold">Request Body</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.request?.body || 
                          viewingTestCase.body || 
                          viewingTestCase.request_body || 
                          viewingTestCase.request_payload || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Query Parameters */}
                {(viewingTestCase.request?.query || viewingTestCase.query || viewingTestCase.query_params) && (
                  <div>
                    <Label className="text-sm font-semibold">Query Parameters</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.request?.query || 
                          viewingTestCase.query || 
                          viewingTestCase.query_params || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Assertions */}
                {viewingTestCase.assertions && viewingTestCase.assertions.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Assertions</Label>
                    <div className="mt-1 space-y-2">
                      {viewingTestCase.assertions.map((assertion: string, idx: number) => (
                        <div key={idx} className="p-2 bg-muted rounded-md text-sm">
                          <CheckCircle2 className="w-4 h-4 inline mr-2 text-green-600" />
                          {assertion}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected Response */}
                {(viewingTestCase.expected_response || viewingTestCase.expected_response_schema) && (
                  <div>
                    <Label className="text-sm font-semibold">Expected Response Schema</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.expected_response || 
                          viewingTestCase.expected_response_schema || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {viewingTestCase.tags && viewingTestCase.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Tags</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {viewingTestCase.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* OWASP Mapping */}
                {viewingTestCase.owasp_mapping && (
                  <div>
                    <Label className="text-sm font-semibold">OWASP API Security Mapping</Label>
                    <div className="mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                      <p className="text-sm">{viewingTestCase.owasp_mapping}</p>
                    </div>
                  </div>
                )}
              </>
            )}
              </TabsContent>
              
              <TabsContent value="json" className="mt-4">
                {viewingTestCase && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Complete Test Case JSON</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewingTestCase) {
                            navigator.clipboard.writeText(JSON.stringify(viewingTestCase, null, 2));
                            toast({
                              title: "Copied",
                              description: "Test case JSON copied to clipboard",
                            });
                          }
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy JSON
                      </Button>
                    </div>
                    <div className="border rounded-md bg-muted p-4 overflow-auto max-h-[60vh]">
                      <pre className="text-xs">
                        <code>{JSON.stringify(viewingTestCase, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setViewingTestCase(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
      </div>
      </div>
      </div>
    </div>
  );
}


