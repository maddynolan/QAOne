import { useState, useEffect, useRef } from "react";
import { Play, Square, Download, Code, FileText, AlertTriangle, BarChart3, Bug, History, Loader2, CheckCircle, XCircle, Clock, Eye, Save, Trash2, ExternalLink, ChevronDown, ChevronUp, RefreshCw, Zap, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL, API_ENDPOINTS } from "@/lib/api-config";
import { dataStorageService } from "@/lib/data-storage";

interface FlowstralSession {
  sessionId: string | null;
  isActive: boolean;
  nodes: string[];
  edges: number;
  playwrightCode: string[];
  testSteps: any[];
  wcagIssues: any[];
  performanceMetrics: any[];
}

export default function Flowstral() {
  const [session, setSession] = useState<FlowstralSession>({
    sessionId: null,
    isActive: false,
    nodes: [],
    edges: 0,
    playwrightCode: [],
    testSteps: [],
    wcagIssues: [],
    performanceMetrics: []
  });

  const [projectId, setProjectId] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [stats, setStats] = useState({
    nodeCount: 0,
    edgeCount: 0,
    wcagCount: 0,
    perfScore: "-"
  });

  // Progress state
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  const [artifactProgress, setArtifactProgress] = useState<Record<string, { status: string; progress: number }>>({});
  const wsRef = useRef<WebSocket | null>(null);

  // Session list state
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedTab, setSelectedTab] = useState<"artifacts" | "sessions" | "analytics">("artifacts");
  const [selectedSession, setSelectedSession] = useState<any | null>(null);
  
  // Artifacts state
  const [artifacts, setArtifacts] = useState<any | null>(null);
  const [selectedTestCase, setSelectedTestCase] = useState<any | null>(null);
  const [showTestCaseDialog, setShowTestCaseDialog] = useState(false);
  const [expandedArtifacts, setExpandedArtifacts] = useState<Record<string, boolean>>({});
  
  // Automation features state
  const [showScriptConverter, setShowScriptConverter] = useState(false);
  const [conversionSource, setConversionSource] = useState("");
  const [conversionFramework, setConversionFramework] = useState("auto");
  const [convertedScript, setConvertedScript] = useState("");
  const [isConverting, setIsConverting] = useState(false);
  const [showTestExecutor, setShowTestExecutor] = useState(false);
  const [testExecutionResult, setTestExecutionResult] = useState<any>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  
  const navigate = useNavigate();

  const eventListenersRef = useRef<any[]>([]);
  const sessionRef = useRef<FlowstralSession>(session);
  
  // Keep ref in sync with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      eventListenersRef.current.forEach(({ type, handler }) => {
        document.removeEventListener(type, handler, true);
      });
      // Close WebSocket connection
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Load sessions when switching to sessions tab
  useEffect(() => {
    if (selectedTab === "sessions" && sessions.length === 0) {
      loadSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTab]);

  // Load artifacts from most recent session on mount
  useEffect(() => {
    const loadRecentArtifacts = async () => {
      try {
        // First load sessions to get the most recent one
        const headers: HeadersInit = {
          "Content-Type": "application/json"
        };
        if (apiKey) {
          headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
        }
        
        const sessionsResponse = await fetch(
          projectId 
            ? `${API_ENDPOINTS.FLOWSTRAL_SESSIONS}?project_id=${projectId}`
            : API_ENDPOINTS.FLOWSTRAL_SESSIONS,
          { headers }
        );
        
        if (sessionsResponse.ok) {
          const sessionsData = await sessionsResponse.json();
          const recentSessions = sessionsData.sessions || [];
          
          // Get the most recent completed session
          const completedSessions = recentSessions.filter((s: any) => !s.is_active);
          if (completedSessions.length > 0) {
            const mostRecent = completedSessions[0];
            console.log("[Flowstral] Found recent session:", mostRecent.session_id);
            
            // Try to fetch artifacts for this session
            // Note: The /artifacts endpoint might need to be implemented to return actual artifacts
            // For now, we'll rely on the stop endpoint response
          }
        }
      } catch (error) {
        console.warn("[Flowstral] Failed to load recent artifacts:", error);
      }
    };
    
    // Only load if we don't have artifacts already
    if (!artifacts) {
      loadRecentArtifacts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const log = (message: string) => {
    console.log(`[Flowstral] ${message}`);
  };

  const startFlowstral = async () => {
    if (session.isActive) return;

    if (!projectId) {
      toast.error("Please enter a Project ID");
      return;
    }

    try {
      log("Starting Flowstral session...");

      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/flowstral/start`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          project_id: projectId,
          user_id: "web_user",
          initial_url: window.location.href,
          initial_dom: document.documentElement.outerHTML.substring(0, 50000)
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to start session: ${response.status}`);
      }

      const result = await response.json();
      const sessionId = result.session.session_id;

      setSession(prev => ({
        ...prev,
        sessionId,
        isActive: true
      }));

      startEventCapture();
      toast.success("Flowstral session started! Click anywhere on THIS page to record.");
      log(`✅ Flowstral session started: ${sessionId}`);
      console.log("⚠️ IMPORTANT: Flowstral only captures events on THIS page. Click on this page, not other tabs!");

    } catch (error: any) {
      log(`❌ Error: ${error.message}`);
      toast.error(`Failed to start Flowstral: ${error.message}`);
    }
  };

  const startEventCapture = () => {
    const clickHandler = async (e: MouseEvent) => {
      // Use ref to get current session state
      if (!sessionRef.current.isActive || !sessionRef.current.sessionId) {
        console.log("Flowstral: Event ignored - session not active");
        return;
      }
      console.log("Flowstral: Click event captured", e.target);
      await captureEvent("click", e);
    };

    const inputHandler = async (e: Event) => {
      // Use ref to get current session state
      if (!sessionRef.current.isActive || !sessionRef.current.sessionId) {
        console.log("Flowstral: Event ignored - session not active");
        return;
      }
      console.log("Flowstral: Input event captured", e.target);
      await captureEvent("input", e);
    };

    document.addEventListener("click", clickHandler, true);
    document.addEventListener("input", inputHandler, true);

    eventListenersRef.current = [
      { type: "click", handler: clickHandler },
      { type: "input", handler: inputHandler }
    ];

    log("Event capture started - listening for clicks and inputs");
    console.log("Flowstral: Event listeners attached");
  };

  const captureEvent = async (eventType: string, event: Event) => {
    // Use ref to get current session state
    const currentSession = sessionRef.current;
    if (!currentSession.sessionId || !currentSession.isActive) {
      console.log("Flowstral: Cannot capture event - no active session");
      return;
    }

    console.log(`Flowstral: Capturing ${eventType} event for session ${currentSession.sessionId}`);
    const element = (event.target || event) as HTMLElement;
    const selector = generateSelector(element);

    const eventData = {
      html: document.documentElement.outerHTML.substring(0, 50000),
      url: window.location.href,
      interacted_element: {
        tag_name: element.tagName,
        id: element.id,
        class_name: element.className,
        text_content: element.textContent?.substring(0, 100),
        selector: selector
      },
      action_description: `${eventType}: ${element.tagName}${element.id ? "#" + element.id : ""}`,
      value: eventType === "input" && "value" in element ? (element as HTMLInputElement).value : undefined,
      page_metrics: {
        lcp: 0,
        fcp: 0,
        cls: 0
      }
    };

    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/flowstral/capture-event`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_id: currentSession.sessionId,
          event_type: eventType,
          event_data: eventData
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log("Flowstral: Event captured successfully", result);
        updateUI(result.result, result.result.node_id);
        log(`✅ Captured ${eventType} event`);
      } else {
        const errorText = await response.text();
        console.error("Flowstral: Event capture failed", response.status, errorText);
        log(`❌ Failed to capture event: ${response.status} - ${errorText}`);
      }
    } catch (error: any) {
      console.error("Flowstral: Event capture error", error);
      log(`❌ Error capturing event: ${error.message}`);
    }
  };

  const updateUI = (result: any, nodeId?: string) => {
    const outputs = result.real_time_outputs;

    setSession(prev => {
      const newSession = { ...prev };
      
      if (nodeId) {
        newSession.nodes = [...prev.nodes, nodeId];
        newSession.edges = prev.nodes.length;
      }

      if (outputs.playwright_code) {
        newSession.playwrightCode = [...prev.playwrightCode, outputs.playwright_code];
      }

      if (outputs.test_step) {
        newSession.testSteps = [...prev.testSteps, outputs.test_step];
      }

      if (outputs.accessibility_panel) {
        const panel = outputs.accessibility_panel;
        newSession.wcagIssues = [...prev.wcagIssues, ...(panel.issues || [])];
        setStats(prevStats => ({
          ...prevStats,
          wcagCount: panel.total_issues || 0
        }));
      }

      if (outputs.performance_panel) {
        const panel = outputs.performance_panel;
        newSession.performanceMetrics = [...prev.performanceMetrics, panel];
        setStats(prevStats => ({
          ...prevStats,
          perfScore: panel.page_score || "-"
        }));
      }

      setStats(prevStats => ({
        ...prevStats,
        nodeCount: newSession.nodes.length,
        edgeCount: newSession.edges
      }));

      return newSession;
    });
  };

  const connectWebSocket = (sessionId: string) => {
    try {
      const wsUrl = API_ENDPOINTS.FLOWSTRAL_WS(sessionId);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log("Flowstral: WebSocket connected");
        setIsGenerating(true);
        setProgress(0);
        setProgressMessage("Connecting to artifact generation...");
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Flowstral: WebSocket message", data);

          if (data.type === "progress") {
            setProgress(data.progress || 0);
            setProgressMessage(data.message || "");
            
            if (data.artifact) {
              setArtifactProgress(prev => ({
                ...prev,
                [data.artifact]: {
                  status: data.status || "processing",
                  progress: data.progress || 0
                }
              }));
            }
          } else if (data.type === "connected") {
            setProgressMessage("Connected. Starting artifact generation...");
          } else if (data.type === "heartbeat") {
            // Keep connection alive
          }
        } catch (e) {
          console.error("Flowstral: Failed to parse WebSocket message", e);
        }
      };

      ws.onerror = (error) => {
        console.error("Flowstral: WebSocket error", error);
        setProgressMessage("Connection error. Progress updates may not be available.");
      };

      ws.onclose = () => {
        console.log("Flowstral: WebSocket closed");
        setIsGenerating(false);
        if (progress < 100) {
          setProgressMessage("Connection closed. Artifacts may still be generating...");
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Flowstral: Failed to create WebSocket", error);
      setIsGenerating(false);
    }
  };

  const stopFlowstral = async () => {
    const currentSession = sessionRef.current;
    if (!currentSession.isActive || !currentSession.sessionId) {
      toast.error("No active session to stop");
      return;
    }
    
    console.log(`Flowstral: Stopping session ${currentSession.sessionId}`);

    try {
      log("Stopping Flowstral session...");

      // Connect to WebSocket for progress updates
      connectWebSocket(currentSession.sessionId);

      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const response = await fetch(`${API_BASE_URL}/api/flowstral/stop`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session_id: currentSession.sessionId,
          project_id: projectId
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Flowstral: Stop failed", response.status, errorText);
        throw new Error(`Failed to stop session: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log("Flowstral: Session stopped successfully", result);

      // Remove event listeners
      eventListenersRef.current.forEach(({ type, handler }) => {
        document.removeEventListener(type, handler, true);
      });
      eventListenersRef.current = [];

      setSession(prev => ({
        ...prev,
        isActive: false
      }));

      // Wait a bit for progress updates, then show artifacts
      setTimeout(() => {
        if (wsRef.current) {
          wsRef.current.close();
        }
        setIsGenerating(false);
        setProgress(100);
        setProgressMessage("All artifacts generated successfully!");
        
        // Check if test cases were generated and stored
        const testCasesArtifact = result.artifacts?.artifacts?.test_cases;
        const storedCount = testCasesArtifact?.stored_count || 0;
        
        if (storedCount > 0) {
          toast.success(
            `Flowstral session stopped! ${storedCount} test case${storedCount > 1 ? 's' : ''} generated and saved.`,
            {
              duration: 8000,
              action: {
                label: "View Test Cases",
                onClick: () => {
                  window.location.href = "/cases";
                }
              }
            }
          );
        } else {
          toast.success("Flowstral session stopped. Artifacts generated!");
        }
        
        log(`✅ Flowstral session stopped. Generated ${Object.keys(result.artifacts?.artifacts || {}).length} artifacts.`);
        
        // Debug: Log the full response structure
        console.log("[Flowstral] Full stop response:", JSON.stringify(result, null, 2));
        console.log("[Flowstral] result.artifacts:", result.artifacts);
        console.log("[Flowstral] result.artifacts?.artifacts:", result.artifacts?.artifacts);
        
        // Try multiple paths to extract artifacts
        const artifactsData = result.artifacts?.artifacts || result.artifacts || result || {};
        console.log("[Flowstral] Extracted artifacts data:", artifactsData);
        console.log("[Flowstral] Artifacts keys:", Object.keys(artifactsData));
        console.log("[Flowstral] Full result object:", JSON.stringify(result, null, 2));

        // Store artifacts in localStorage for persistence (in case backend restarts)
        try {
          const sessionId = result.session_id || currentSession.sessionId;
          console.log(`[Flowstral] Attempting to store artifacts in localStorage for session: ${sessionId}`);
          console.log(`[Flowstral] Artifacts data type: ${typeof artifactsData}, keys: ${Object.keys(artifactsData).length}`);
          
          if (sessionId && artifactsData && Object.keys(artifactsData).length > 0) {
            // Ensure session_id is in the artifacts data
            const artifactsToStore = { ...artifactsData, session_id: sessionId };
            const storageKey = `flowstral_artifacts_${sessionId}`;
            const artifactsJson = JSON.stringify(artifactsToStore);
            
            console.log(`[Flowstral] Storing ${artifactsJson.length} bytes to localStorage key: ${storageKey}`);
            localStorage.setItem(storageKey, artifactsJson);
            
            // Verify it was stored
            const stored = localStorage.getItem(storageKey);
            if (stored) {
              console.log(`[Flowstral] ✅ Successfully stored artifacts in localStorage (${stored.length} bytes)`);
              console.log(`[Flowstral] Stored keys: ${Object.keys(JSON.parse(stored)).join(', ')}`);
            } else {
              console.error(`[Flowstral] ❌ Failed to verify storage - localStorage.getItem returned null`);
            }
          } else {
            console.warn(`[Flowstral] ⚠️ Cannot store artifacts: sessionId=${sessionId}, artifactsData=${!!artifactsData}, keys=${Object.keys(artifactsData).length}`);
          }
        } catch (e) {
          console.error("[Flowstral] ❌ Failed to store artifacts in localStorage:", e);
          console.error("[Flowstral] Error details:", e.message, e.stack);
        }

        // Show artifacts
        showArtifacts(artifactsData);
        
        // Reload sessions list
        if (selectedTab === "sessions") {
          loadSessions();
        }
      }, 2000);

    } catch (error: any) {
      console.error("Flowstral: Stop error", error);
      log(`❌ Error: ${error.message}`);
      toast.error(`Failed to stop Flowstral: ${error.message}`);
      setIsGenerating(false);
      if (wsRef.current) {
        wsRef.current.close();
      }
    }
  };

  const loadSessions = async () => {
    setLoadingSessions(true);
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const url = projectId 
        ? `${API_ENDPOINTS.FLOWSTRAL_SESSIONS}?project_id=${projectId}`
        : API_ENDPOINTS.FLOWSTRAL_SESSIONS;

      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to load sessions: ${response.status}`);
      }

      const result = await response.json();
      setSessions(result.sessions || []);
    } catch (error: any) {
      console.error("Flowstral: Failed to load sessions", error);
      toast.error(`Failed to load sessions: ${error.message}`);
    } finally {
      setLoadingSessions(false);
    }
  };

  const viewSessionDetails = async (sessionId: string) => {
    try {
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const response = await fetch(API_ENDPOINTS.FLOWSTRAL_SESSION_SUMMARY(sessionId), { headers });
      
      if (!response.ok) {
        throw new Error(`Failed to load session: ${response.status}`);
      }

      const result = await response.json();
      setSelectedSession(result.session);
      
      // Also try to load artifacts for this session
      await loadArtifactsForSession(sessionId);
    } catch (error: any) {
      console.error("Flowstral: Failed to load session details", error);
      toast.error(`Failed to load session details: ${error.message}`);
    }
  };

  const loadArtifactsForSession = async (sessionId: string) => {
    try {
      console.log(`[Flowstral] Loading artifacts for session: ${sessionId}`);
      toast.info("Loading artifacts...");
      
      // First, try to load from localStorage (in case backend was restarted)
      try {
        const cachedArtifacts = localStorage.getItem(`flowstral_artifacts_${sessionId}`);
        if (cachedArtifacts) {
          const parsed = JSON.parse(cachedArtifacts);
          console.log(`[Flowstral] Found cached artifacts in localStorage for session ${sessionId}`);
          // Still try to fetch from backend, but use cache as fallback
        }
      } catch (e) {
        console.warn("[Flowstral] Failed to read from localStorage:", e);
      }
      
      const headers: HeadersInit = {
        "Content-Type": "application/json"
      };

      if (apiKey) {
        headers["Authorization"] = apiKey.startsWith("Bearer ") ? apiKey : `Bearer ${apiKey}`;
      }

      const url = `${API_BASE_URL}/api/flowstral/session/${sessionId}/artifacts`;
      console.log(`[Flowstral] Fetching from: ${url}`);
      
      const response = await fetch(url, { headers });
      
      console.log(`[Flowstral] Response status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Flowstral] Failed to load artifacts: ${response.status}`, errorText);
        
        // Try to use cached artifacts from localStorage
        try {
          const cachedArtifacts = localStorage.getItem(`flowstral_artifacts_${sessionId}`);
          if (cachedArtifacts) {
            const parsed = JSON.parse(cachedArtifacts);
            console.log(`[Flowstral] Using cached artifacts from localStorage`);
            toast.warning("Backend session expired, using cached artifacts from browser storage.");
            showArtifacts(parsed);
            return;
          }
        } catch (e) {
          console.warn("[Flowstral] Failed to use cached artifacts:", e);
        }
        
        toast.error(`Failed to load artifacts: ${response.status}. Check console for details.`);
        return;
      }

      const result = await response.json();
      console.log("[Flowstral] Full artifacts response:", JSON.stringify(result, null, 2));
      console.log("[Flowstral] result.artifacts:", result.artifacts);
      console.log("[Flowstral] result.artifacts?.artifacts:", result.artifacts?.artifacts);
      
      // Try multiple paths to extract artifacts (handle both nested and flat structures)
      let artifactsData = result.artifacts;
      
      // If artifacts is nested (has an 'artifacts' key), extract it
      if (artifactsData && typeof artifactsData === 'object' && 'artifacts' in artifactsData) {
        artifactsData = artifactsData.artifacts;
      }
      
      // If still not found, try direct access
      if (!artifactsData || (typeof artifactsData === 'object' && Object.keys(artifactsData).length === 0)) {
        artifactsData = result.artifacts || result || {};
      }
      
      console.log("[Flowstral] Extracted artifacts data:", artifactsData);
      console.log("[Flowstral] Artifacts keys:", Object.keys(artifactsData));
      console.log("[Flowstral] Artifacts data type:", typeof artifactsData);
      
      // Check if all artifacts are placeholders - if so, try localStorage first
      const allPlaceholders = Object.values(artifactsData).every(
        v => typeof v === 'string' && v.includes('Available after')
      );
      
      if (allPlaceholders) {
        console.warn("[Flowstral] All artifacts are placeholders - checking localStorage...");
        console.log(`[Flowstral] Looking for localStorage key: flowstral_artifacts_${sessionId}`);
        
        // List all localStorage keys for debugging
        const allKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('flowstral_artifacts_')) {
            allKeys.push(key);
          }
        }
        console.log(`[Flowstral] Found ${allKeys.length} flowstral artifact keys in localStorage:`, allKeys);
        
        try {
          const storageKey = `flowstral_artifacts_${sessionId}`;
          const cachedArtifacts = localStorage.getItem(storageKey);
          if (cachedArtifacts) {
            console.log(`[Flowstral] ✅ Found cached artifacts! Size: ${cachedArtifacts.length} bytes`);
            const parsed = JSON.parse(cachedArtifacts);
            console.log(`[Flowstral] Parsed artifacts keys: ${Object.keys(parsed).join(', ')}`);
            toast.info("Backend session expired, using cached artifacts from browser storage.");
            showArtifacts(parsed);
            return;
          } else {
            console.warn(`[Flowstral] ❌ No cached artifacts found in localStorage for key: ${storageKey}`);
            console.warn(`[Flowstral] Available keys: ${allKeys.join(', ')}`);
          }
        } catch (e) {
          console.error("[Flowstral] ❌ Failed to read from localStorage:", e);
          console.error("[Flowstral] Error details:", e.message, e.stack);
        }
      }
      
      // Filter out placeholder strings and empty objects
      const realArtifacts: Record<string, any> = {};
      let placeholderCount = 0;
      
      for (const [key, value] of Object.entries(artifactsData)) {
        // Skip placeholder strings
        if (typeof value === 'string' && value.includes('Available after')) {
          placeholderCount++;
          console.log(`[Flowstral] Skipping placeholder: ${key}`);
          continue;
        }
        
        // Skip empty objects
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value) && value.length === 0) {
            console.log(`[Flowstral] Skipping empty array: ${key}`);
            continue;
          }
          if (!Array.isArray(value) && Object.keys(value).length === 0) {
            console.log(`[Flowstral] Skipping empty object: ${key}`);
            continue;
          }
          // Check if it's an error object
          if ('error' in value && Object.keys(value).length <= 2) {
            console.log(`[Flowstral] Skipping error object: ${key} - ${value.error}`);
            continue;
          }
        }
        
        // This is a real artifact
        realArtifacts[key] = value;
        console.log(`[Flowstral] Found real artifact: ${key}`, typeof value === 'object' ? `(keys: ${Object.keys(value).slice(0, 5).join(', ')})` : `(type: ${typeof value})`);
      }
      
      if (placeholderCount > 0) {
        console.warn(`[Flowstral] Found ${placeholderCount} placeholder artifacts`);
      }
      
      if (Object.keys(realArtifacts).length > 0) {
        console.log(`[Flowstral] Found ${Object.keys(realArtifacts).length} real artifacts! Showing artifacts...`);
        // Add session_id for future localStorage lookups
        realArtifacts.session_id = sessionId;
        showArtifacts(realArtifacts);
        toast.success(`Artifacts loaded! Found ${Object.keys(realArtifacts).length} artifact types.`);
      } else {
        console.warn("[Flowstral] No real artifacts found - all were placeholders or empty");
        
        // Try to use cached artifacts from localStorage as last resort
        try {
          const cachedArtifacts = localStorage.getItem(`flowstral_artifacts_${sessionId}`);
          if (cachedArtifacts) {
            const parsed = JSON.parse(cachedArtifacts);
            console.log(`[Flowstral] Using cached artifacts from localStorage as fallback`);
            toast.warning("Backend session expired, using cached artifacts from browser storage.");
            showArtifacts(parsed);
            return;
          }
        } catch (e) {
          console.warn("[Flowstral] Failed to use cached artifacts:", e);
        }
        
        toast.warning("No artifacts found for this session. They may not have been generated yet. Please stop the session again to generate artifacts.");
      }
    } catch (error: any) {
      console.error("[Flowstral] Error loading artifacts:", error);
      toast.error(`Failed to load artifacts: ${error.message}`);
    }
  };

  const showArtifacts = (artifactsData: any) => {
    // Debug: Log what we're trying to set
    console.log("[Flowstral] showArtifacts called with:", artifactsData);
    console.log("[Flowstral] Artifacts data type:", typeof artifactsData);
    console.log("[Flowstral] Artifacts data keys:", artifactsData ? Object.keys(artifactsData) : "null/undefined");
    
    // Deep log each artifact
    if (artifactsData) {
      console.log("[Flowstral] playwright_script:", artifactsData.playwright_script);
      console.log("[Flowstral] playwright_script?.code:", artifactsData.playwright_script?.code);
      console.log("[Flowstral] test_cases:", artifactsData.test_cases);
      console.log("[Flowstral] action_graph:", artifactsData.action_graph);
      console.log("[Flowstral] accessibility_report:", artifactsData.accessibility_report);
      console.log("[Flowstral] performance_report:", artifactsData.performance_report);
      console.log("[Flowstral] defects:", artifactsData.defects);
    }
    
    // Store artifacts in state and switch to artifacts tab
    if (artifactsData && (Object.keys(artifactsData).length > 0 || artifactsData.test_cases || artifactsData.playwright_script)) {
      setArtifacts(artifactsData);
      setSelectedTab("artifacts");
      toast.success("Artifacts generated! View them in the Artifacts tab.");
      console.log("[Flowstral] Artifacts set successfully");
    } else {
      console.warn("[Flowstral] Artifacts data is empty or invalid:", artifactsData);
      toast.warning("Artifacts were generated but appear to be empty. Check console for details.");
      // Still set it so user can see the empty state
      setArtifacts(artifactsData);
      setSelectedTab("artifacts");
    }
  };
  
  const handleSaveTestCase = async (testCase: any) => {
    try {
      if (!projectId) {
        toast.error("Please enter a Project ID to save test cases");
        return;
      }
      
      const testCaseData = {
        name: testCase.title || testCase.name || "Flowstral Test Case",
        description: testCase.description || "",
        steps: (testCase.steps || []).map((step: any) => ({
          action: step.action || step.step_action || "",
          expectedResult: step.expected_result || step.expectedResult || ""
        })),
        preconditions: testCase.preconditions || [],
        testData: [],
        priority: (testCase.priority || "medium").toLowerCase() as "low" | "medium" | "high" | "critical",
        tags: testCase.tags || ["flowstral", "recorded"],
        testType: testCase.test_type || "manual",
        complexity: "medium",
        estimatedTime: 15
      };
      
      await dataStorageService.createTestCase(testCaseData);
      toast.success("Test case saved successfully!");
      setShowTestCaseDialog(false);
      setSelectedTestCase(null);
    } catch (error: any) {
      console.error("Error saving test case:", error);
      toast.error(`Failed to save test case: ${error.message}`);
    }
  };
  
  const handleDeleteTestCase = (testCase: any) => {
    if (window.confirm(`Are you sure you want to remove this test case from artifacts?`)) {
      // Remove from artifacts (in-memory only, doesn't affect database)
      if (artifacts?.test_cases) {
        const updatedTestCases = {
          ...artifacts.test_cases,
          automated: artifacts.test_cases.automated?.filter((tc: any) => tc !== testCase),
          manual: artifacts.test_cases.manual?.filter((tc: any) => tc !== testCase),
          accessibility: artifacts.test_cases.accessibility?.filter((tc: any) => tc !== testCase),
          performance: artifacts.test_cases.performance?.filter((tc: any) => tc !== testCase)
        };
        setArtifacts({
          ...artifacts,
          test_cases: updatedTestCases
        });
        toast.success("Test case removed from artifacts");
      }
    }
  };
  
  const toggleArtifact = (key: string) => {
    setExpandedArtifacts(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const generateSelector = (element: HTMLElement): string => {
    if (element.id) return `#${element.id}`;
    if (element.getAttribute("data-testid")) return `[data-testid="${element.getAttribute("data-testid")}"]`;
    if ("name" in element && (element as any).name) return `[name="${(element as any).name}"]`;
    if (element.className) {
      const classes = element.className.split(" ").filter(c => c).join(".");
      if (classes) return `${element.tagName.toLowerCase()}.${classes}`;
    }
    return element.tagName.toLowerCase();
  };

  // Calculate statistics from sessions
  const totalSessions = sessions.length;
  const totalTestCases = artifacts ? [
    ...(artifacts.test_cases?.automated || []),
    ...(artifacts.test_cases?.manual || []),
    ...(artifacts.test_cases?.accessibility || []),
    ...(artifacts.test_cases?.performance || [])
  ].length : 0;
  const recentSessions = sessions.slice(0, 5);

  return (
    <div className="max-w-7xl mx-auto space-y-6 p-6">
      {/* Header with Stats Dashboard */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              ⭐ Flowstral Artifacts
            </h1>
            <p className="text-muted-foreground">Review, manage, and export your generated test artifacts</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                toast.info("Open the Flowstral Recorder extension to start a new recording");
              }}
            >
              <Play className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
            <Button
              variant="outline"
              onClick={() => loadSessions()}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Quick Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
                  <p className="text-2xl font-bold">{totalSessions}</p>
                </div>
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Test Cases</p>
                  <p className="text-2xl font-bold">{totalTestCases}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Artifacts</p>
                  <p className="text-2xl font-bold">{artifacts ? "1" : "0"}</p>
                </div>
                <Code className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Last Session</p>
                  <p className="text-sm font-bold">
                    {sessions.length > 0 
                      ? new Date(sessions[0].start_timestamp).toLocaleDateString()
                      : "Never"}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Progress Indicator */}
      {isGenerating && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Generating Artifacts...
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">{progressMessage}</span>
                <span className="font-semibold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
            <div className="space-y-2">
              {[
                { key: "action_graph", name: "Action Graph", icon: BarChart3 },
                { key: "playwright_script", name: "Playwright Script", icon: Code },
                { key: "test_cases", name: "Test Cases", icon: FileText },
                { key: "accessibility_report", name: "Accessibility Report", icon: AlertTriangle },
                { key: "performance_report", name: "Performance Report", icon: BarChart3 },
                { key: "defects", name: "Defects", icon: Bug },
              ].map((artifact) => {
                const status = artifactProgress[artifact.key];
                const Icon = artifact.icon;
                return (
                  <div key={artifact.key} className="flex items-center gap-3 text-sm">
                    {status?.status === "completed" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : status?.status === "error" ? (
                      <XCircle className="h-4 w-4 text-red-600" />
                    ) : status?.status === "processing" ? (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    ) : (
                      <Clock className="h-4 w-4 text-gray-400" />
                    )}
                    <Icon className="h-4 w-4" />
                    <span className="flex-1">{artifact.name}</span>
                    {status && (
                      <Badge variant={status.status === "completed" ? "default" : status.status === "error" ? "destructive" : "secondary"}>
                        {status.status === "completed" ? "Done" : status.status === "error" ? "Error" : "Processing..."}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Tabs: Artifacts (Primary), Sessions, Analytics */}
      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as "artifacts" | "sessions" | "analytics")}>
        <TabsList>
          <TabsTrigger value="artifacts">
            <FileText className="h-4 w-4 mr-2" />
            Artifacts {artifacts && <Badge variant="secondary" className="ml-2">
              {[
                ...(artifacts.test_cases?.automated || []),
                ...(artifacts.test_cases?.manual || []),
                ...(artifacts.test_cases?.accessibility || []),
                ...(artifacts.test_cases?.performance || [])
              ].length > 0 ? [
                ...(artifacts.test_cases?.automated || []),
                ...(artifacts.test_cases?.manual || []),
                ...(artifacts.test_cases?.accessibility || []),
                ...(artifacts.test_cases?.performance || [])
              ].length : 0}
            </Badge>}
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <History className="h-4 w-4 mr-2" />
            Sessions ({sessions.length})
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Session Activity</CardTitle>
                <CardDescription>Recent recording sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {recentSessions.length > 0 ? (
                  <div className="space-y-3">
                    {recentSessions.map((s: any) => (
                      <div key={s.session_id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div>
                          <p className="font-medium text-sm">{s.session_id.substring(0, 8)}...</p>
                          <p className="text-xs text-muted-foreground">
                            {s.start_timestamp ? new Date(s.start_timestamp).toLocaleString() : "Unknown"}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">{s.node_count} nodes</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No sessions yet</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
                <CardDescription>Common tasks and shortcuts</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    toast.info("Open the Flowstral Recorder extension to start recording");
                  }}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Start New Recording
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => {
                    if (artifacts) {
                      const dataStr = JSON.stringify(artifacts, null, 2);
                      const dataBlob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `flowstral-artifacts-${Date.now()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                      toast.success("Artifacts exported!");
                    } else {
                      toast.error("No artifacts to export");
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export All Artifacts
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => navigate("/cases")}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View All Test Cases
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4 space-y-2">
                <p className="font-semibold">📝 How to Use Flowstral:</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Open the <strong>Flowstral Recorder</strong> browser extension (side panel)</li>
                  <li>Enter your Project ID and click <strong>"Start Flowstral"</strong></li>
                  <li>Interact with the website you want to test</li>
                  <li>Click <strong>"Stop & Generate"</strong> in the extension</li>
                  <li>Artifacts will appear here in the <strong>Artifacts</strong> tab</li>
                  <li>Review and save test cases to your project</li>
                </ol>
              </div>
              <div className="mt-4 p-3 bg-green-50 rounded border border-green-200">
                <p className="text-xs font-semibold text-green-800">✨ What You'll Get:</p>
                <ul className="text-xs text-green-700 list-disc list-inside mt-1 space-y-1">
                  <li>Automated & Manual Test Cases</li>
                  <li>Playwright Automation Scripts</li>
                  <li>Accessibility Reports (WCAG compliance)</li>
                  <li>Performance Analysis Reports</li>
                  <li>Security Defect Reports</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Flowstral Sessions</CardTitle>
                  <CardDescription>View all recorded Flowstral sessions</CardDescription>
                </div>
                <Button onClick={loadSessions} disabled={loadingSessions} variant="outline" size="sm">
                  {loadingSessions ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <History className="h-4 w-4 mr-2" />
                      Refresh
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mt-2">Loading sessions...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No sessions found</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Start recording a flow to see sessions here
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {sessions.map((sess) => (
                    <Card key={sess.session_id} className="hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant={sess.is_active ? "destructive" : "secondary"}>
                                {sess.is_active ? "Active" : "Completed"}
                              </Badge>
                              <span className="text-xs font-mono text-muted-foreground">
                                {sess.session_id.substring(0, 8)}...
                              </span>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                              <div>
                                <div className="text-sm font-semibold">{sess.node_count || 0}</div>
                                <div className="text-xs text-muted-foreground">Nodes</div>
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{sess.edge_count || 0}</div>
                                <div className="text-xs text-muted-foreground">Edges</div>
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{sess.wcag_issues_count || 0}</div>
                                <div className="text-xs text-muted-foreground">WCAG Issues</div>
                              </div>
                              <div>
                                <div className="text-sm font-semibold">{sess.performance_metrics_count || 0}</div>
                                <div className="text-xs text-muted-foreground">Perf Metrics</div>
                              </div>
                            </div>
                            {sess.start_timestamp && (
                              <div className="text-xs text-muted-foreground mt-2">
                                Started: {new Date(sess.start_timestamp).toLocaleString()}
                              </div>
                            )}
                            {sess.project_id && (
                              <div className="text-xs text-muted-foreground">
                                Project: {sess.project_id}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2 ml-4">
                            <div className="flex gap-2">
                              <Button
                                onClick={() => viewSessionDetails(sess.session_id)}
                                variant="outline"
                                size="sm"
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View
                              </Button>
                              {!sess.is_active && (
                                <Button
                                  onClick={() => loadArtifactsForSession(sess.session_id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  Load Artifacts
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Session Details */}
          {selectedSession && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Session Details</CardTitle>
                  <Button onClick={() => setSelectedSession(null)} variant="ghost" size="sm">
                    Close
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Session ID</Label>
                      <div className="text-sm font-mono">{selectedSession.session_id}</div>
                    </div>
                    <div>
                      <Label>Project ID</Label>
                      <div className="text-sm">{selectedSession.project_id}</div>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <Badge variant={selectedSession.is_active ? "destructive" : "secondary"}>
                        {selectedSession.is_active ? "Active" : "Completed"}
                      </Badge>
                    </div>
                    <div>
                      <Label>Started</Label>
                      <div className="text-sm">
                        {selectedSession.start_timestamp 
                          ? new Date(selectedSession.start_timestamp).toLocaleString()
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Action Graph</Label>
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <div className="text-sm">
                        <strong>Nodes:</strong> {selectedSession.node_count || 0} | 
                        <strong> Edges:</strong> {selectedSession.edge_count || 0}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="artifacts" className="space-y-6 mt-6">
          {!artifacts ? (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No artifacts generated yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Stop a recording session to generate artifacts
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Flowstral Artifacts</h2>
                  <p className="text-muted-foreground">Review, save, and manage generated artifacts</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowScriptConverter(true)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Convert Script
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Check if we have session ID or artifacts before opening dialog
                      const sessionId = selectedSession?.session_id || session.sessionId;
                      if (!sessionId && !artifacts?.playwright_script?.code) {
                        toast.error("No session or artifacts available. Please load artifacts first.");
                        return;
                      }
                      setShowTestExecutor(true);
                    }}
                    disabled={!selectedSession?.session_id && !session.sessionId && !artifacts?.playwright_script?.code}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Execute Test
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate("/cases")}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View All Test Cases
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const dataStr = JSON.stringify(artifacts, null, 2);
                      const dataBlob = new Blob([dataStr], { type: "application/json" });
                      const url = URL.createObjectURL(dataBlob);
                      const link = document.createElement("a");
                      link.href = url;
                      link.download = `flowstral-artifacts-${Date.now()}.json`;
                      link.click();
                      URL.revokeObjectURL(url);
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download All
                  </Button>
                </div>
              </div>

              {/* Test Cases - Most Important */}
              {artifacts.test_cases && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        <CardTitle>Test Cases</CardTitle>
                        <Badge variant="secondary">
                          {[
                            ...(artifacts.test_cases.automated || []),
                            ...(artifacts.test_cases.manual || []),
                            ...(artifacts.test_cases.accessibility || []),
                            ...(artifacts.test_cases.performance || [])
                          ].length} total
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleArtifact("test_cases")}
                      >
                        {expandedArtifacts.test_cases ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                  {expandedArtifacts.test_cases && (
                    <CardContent className="space-y-4">
                      {/* Automated Test Cases */}
                      {artifacts.test_cases.automated && artifacts.test_cases.automated.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            Automated Test Cases ({artifacts.test_cases.automated.length})
                          </h3>
                          <div className="space-y-2">
                            {artifacts.test_cases.automated.map((tc: any, idx: number) => (
                              <Card key={idx} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold">{tc.title || tc.name || `Test Case ${idx + 1}`}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {tc.description || "No description"}
                                    </div>
                                    {tc.steps && tc.steps.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-2">
                                        {tc.steps.length} steps
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTestCase(tc);
                                        setShowTestCaseDialog(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Review
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSaveTestCase(tc)}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteTestCase(tc)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Manual Test Cases */}
                      {artifacts.test_cases.manual && artifacts.test_cases.manual.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            Manual Test Cases ({artifacts.test_cases.manual.length})
                          </h3>
                          <div className="space-y-2">
                            {artifacts.test_cases.manual.map((tc: any, idx: number) => (
                              <Card key={idx} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold">{tc.title || tc.name || `Manual Test ${idx + 1}`}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {tc.description || "No description"}
                                    </div>
                                    {tc.steps && tc.steps.length > 0 && (
                                      <div className="text-xs text-muted-foreground mt-2">
                                        {tc.steps.length} steps
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setSelectedTestCase(tc);
                                        setShowTestCaseDialog(true);
                                      }}
                                    >
                                      <Eye className="h-3 w-3 mr-1" />
                                      Review
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSaveTestCase(tc)}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleDeleteTestCase(tc)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Accessibility Test Cases */}
                      {artifacts.test_cases.accessibility && artifacts.test_cases.accessibility.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            Accessibility Test Cases ({artifacts.test_cases.accessibility.length})
                          </h3>
                          <div className="space-y-2">
                            {artifacts.test_cases.accessibility.map((tc: any, idx: number) => (
                              <Card key={idx} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold">{tc.title || `A11y Test ${idx + 1}`}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {tc.description || "No description"}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSaveTestCase(tc)}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Performance Test Cases */}
                      {artifacts.test_cases.performance && artifacts.test_cases.performance.length > 0 && (
                        <div>
                          <h3 className="font-semibold mb-2 flex items-center gap-2">
                            <BarChart3 className="h-4 w-4" />
                            Performance Test Cases ({artifacts.test_cases.performance.length})
                          </h3>
                          <div className="space-y-2">
                            {artifacts.test_cases.performance.map((tc: any, idx: number) => (
                              <Card key={idx} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-semibold">{tc.title || `Perf Test ${idx + 1}`}</div>
                                    <div className="text-sm text-muted-foreground mt-1">
                                      {tc.description || "No description"}
                                    </div>
                                  </div>
                                  <div className="flex gap-2 ml-4">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSaveTestCase(tc)}
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Playwright Script - Enhanced with Industry Standards */}
              {artifacts.playwright_script && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code className="h-5 w-5" />
                        <div>
                          <CardTitle>Playwright Script</CardTitle>
                          {artifacts.playwright_script.features && (
                            <div className="flex gap-2 mt-1">
                              {artifacts.playwright_script.features.optimal_locators && (
                                <Badge variant="secondary" className="text-xs">Optimal Locators</Badge>
                              )}
                              {artifacts.playwright_script.features.auto_healing && (
                                <Badge variant="secondary" className="text-xs">Auto-Healing</Badge>
                              )}
                              {artifacts.playwright_script.features.industry_standards && (
                                <Badge variant="secondary" className="text-xs">Industry Standard</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const code = artifacts.playwright_script?.code || "";
                            const blob = new Blob([code], { type: "text/javascript" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `flowstral-playwright-${Date.now()}.ts`;
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArtifact("playwright_script")}
                        >
                          {expandedArtifacts.playwright_script ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  {expandedArtifacts.playwright_script && (
                    <CardContent className="space-y-4">
                      {/* Features Info */}
                      {artifacts.playwright_script.locator_strategy && (
                        <div className="bg-muted p-3 rounded-lg">
                          <p className="text-sm font-semibold mb-2">Industry-Standard Features:</p>
                          <ul className="text-sm text-muted-foreground space-y-1">
                            <li>✓ Locator Strategy: {artifacts.playwright_script.locator_strategy}</li>
                            {artifacts.playwright_script.auto_healing_enabled && (
                              <li>✓ Auto-Healing: Enabled with fallback locator chains</li>
                            )}
                            {artifacts.playwright_script.features?.optimal_locators && (
                              <li>✓ Optimal Locators: data-testid → aria-label → id → CSS priority</li>
                            )}
                            {artifacts.playwright_script.features?.fallback_chains && (
                              <li>✓ Fallback Chains: Automatic retry with alternative locators</li>
                            )}
                          </ul>
                        </div>
                      )}
                      {/* Code Display */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm font-semibold">Generated Code</Label>
                          <Badge variant="outline" className="text-xs">
                            {artifacts.playwright_script.code?.split('\n').length || 0} lines
                          </Badge>
                        </div>
                        <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                          {(() => {
                            const code = artifacts.playwright_script?.code || artifacts.playwright_script?.playwright_script || "";
                            if (!code || code === "N/A" || code.trim() === "") {
                              console.warn("[Flowstral] Playwright code is empty. Full playwright_script object:", artifacts.playwright_script);
                              return "// No Playwright code generated yet.\n// This may happen if:\n// 1. No actions were recorded\n// 2. Code generation failed\n// 3. Session was stopped before generation completed";
                            }
                            return code;
                          })()}
                        </pre>
                      </div>
                    </CardContent>
                  )}
                </Card>
              )}

              {/* Other Artifacts (Action Graph, WCAG, Performance, Defects) */}
              {[
                { key: "action_graph", title: "Action Graph", icon: BarChart3, checkEmpty: (val: any) => {
                  if (!val || typeof val === 'string') return true;
                  if (typeof val === 'object' && Object.keys(val).length === 0) return true;
                  return false;
                }},
                { key: "accessibility_report", title: "Accessibility Report", icon: AlertTriangle },
                { key: "performance_report", title: "Performance Report", icon: BarChart3 },
                { key: "defects", title: "Defects", icon: Bug }
              ].map((artifact) => {
                const artifactData = artifacts[artifact.key];
                console.log(`[Flowstral] Rendering ${artifact.key}:`, artifactData);
                
                // Skip if artifact is missing, is a placeholder string, or is empty
                if (!artifactData) return null;
                if (typeof artifactData === 'string' && artifactData.includes('Available after')) {
                  console.log(`[Flowstral] Skipping placeholder: ${artifact.key}`);
                  return null;
                }
                if (typeof artifactData === 'object' && Object.keys(artifactData).length === 0) {
                  console.log(`[Flowstral] Skipping empty object: ${artifact.key}`);
                  return null;
                }
                
                const Icon = artifact.icon;
                return (
                  <Card key={artifact.key}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-5 w-5" />
                          <CardTitle>{artifact.title}</CardTitle>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleArtifact(artifact.key)}
                        >
                          {expandedArtifacts[artifact.key] ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    {expandedArtifacts[artifact.key] && (
                      <CardContent>
                        {(() => {
                          const artifactData = artifacts[artifact.key];
                          
                          // Check for placeholder strings
                          if (typeof artifactData === 'string' && artifactData.includes('Available after')) {
                            return (
                              <div className="text-muted-foreground text-center py-8">
                                <p>No {artifact.title.toLowerCase()} data available</p>
                                <p className="text-xs mt-2">This artifact has not been generated yet. Please stop the session to generate artifacts.</p>
                              </div>
                            );
                          }
                          
                          if (!artifactData || (typeof artifactData === 'object' && Object.keys(artifactData).length === 0)) {
                            return (
                              <div className="text-muted-foreground text-center py-8">
                                <p>No {artifact.title.toLowerCase()} data available</p>
                                <p className="text-xs mt-2">This artifact may not have been generated or is empty.</p>
                              </div>
                            );
                          }
                          // Check if it's an error object
                          if (artifactData.error) {
                            return (
                              <div className="bg-red-50 border border-red-200 p-4 rounded-lg">
                                <p className="text-red-800 font-semibold">Error generating {artifact.title}:</p>
                                <p className="text-red-700 text-sm mt-1">{artifactData.error}</p>
                              </div>
                            );
                          }
                          // Display as JSON
                          return (
                            <pre className="bg-muted p-4 rounded-lg font-mono text-sm overflow-auto max-h-96">
                              {JSON.stringify(artifactData, null, 2)}
                            </pre>
                          );
                        })()}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Script Converter Dialog */}
      <Dialog open={showScriptConverter} onOpenChange={setShowScriptConverter}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert Script to Playwright</DialogTitle>
            <DialogDescription>
              Convert test scripts from Selenium, Cypress, or WebDriverIO to Playwright
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Source Framework</Label>
              <select
                className="w-full mt-1 p-2 border rounded"
                value={conversionFramework}
                onChange={(e) => setConversionFramework(e.target.value)}
              >
                <option value="auto">Auto-detect</option>
                <option value="selenium">Selenium</option>
                <option value="cypress">Cypress</option>
                <option value="webdriverio">WebDriverIO</option>
              </select>
            </div>
            <div>
              <Label>Source Code</Label>
              <textarea
                className="w-full mt-1 p-2 border rounded font-mono text-sm"
                rows={10}
                value={conversionSource}
                onChange={(e) => setConversionSource(e.target.value)}
                placeholder="Paste your Selenium, Cypress, or WebDriverIO test code here..."
              />
            </div>
            <Button
              onClick={async () => {
                if (!conversionSource.trim()) {
                  toast.error("Please enter source code to convert");
                  return;
                }
                setIsConverting(true);
                try {
                  const response = await fetch(`${API_BASE_URL}/automation/convert-script`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      source_code: conversionSource,
                      source_framework: conversionFramework
                    })
                  });
                  const data = await response.json();
                  if (data.status === "success") {
                    setConvertedScript(data.converted_code);
                    toast.success("Script converted successfully!");
                  } else {
                    toast.error(data.message || "Conversion failed");
                  }
                } catch (error: any) {
                  toast.error(`Conversion failed: ${error.message}`);
                } finally {
                  setIsConverting(false);
                }
              }}
              disabled={isConverting || !conversionSource.trim()}
              className="w-full"
            >
              {isConverting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Converting...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Convert to Playwright
                </>
              )}
            </Button>
            {convertedScript && (
              <div>
                <Label>Converted Playwright Code</Label>
                <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-4 rounded-lg font-mono text-sm overflow-auto max-h-96 mt-1">
                  {convertedScript}
                </pre>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    const blob = new Blob([convertedScript], { type: "text/typescript" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `converted-playwright-${Date.now()}.ts`;
                    link.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download Converted Code
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Execution Dialog */}
      <Dialog open={showTestExecutor} onOpenChange={setShowTestExecutor}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Execute Playwright Test</DialogTitle>
            <DialogDescription>
              Run the generated Playwright test code and view results
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Test Code</Label>
              <pre className="bg-muted p-4 rounded-lg font-mono text-sm overflow-auto max-h-48 mt-1">
                {(() => {
                  const sessionId = selectedSession?.session_id || session.sessionId;
                  if (artifacts?.playwright_script?.code) {
                    return artifacts.playwright_script.code;
                  } else if (sessionId) {
                    return `// Test code will be loaded from session ${sessionId.substring(0, 8)}...\n// when you click Execute. The backend will fetch the Playwright script\n// directly from the session artifacts.`;
                  } else {
                    return "// No test code available.\n// Please load artifacts or select a session to execute tests.";
                  }
                })()}
              </pre>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Browser</Label>
                <select className="w-full mt-1 p-2 border rounded" id="exec-browser">
                  <option value="chromium">Chromium</option>
                  <option value="firefox">Firefox</option>
                  <option value="webkit">WebKit (Safari)</option>
                </select>
              </div>
              <div>
                <Label>Mode</Label>
                <select className="w-full mt-1 p-2 border rounded" id="exec-headless">
                  <option value="true">Headless</option>
                  <option value="false">Headed</option>
                </select>
              </div>
            </div>
            <Button
              onClick={async () => {
                setIsExecuting(true);
                try {
                  const browser = (document.getElementById("exec-browser") as HTMLSelectElement)?.value || "chromium";
                  const headless = (document.getElementById("exec-headless") as HTMLSelectElement)?.value === "true";
                  
                  // Get session ID from multiple sources
                  const sessionId = selectedSession?.session_id || session.sessionId;
                  
                  // If we have a session ID, use Flowstral endpoint (it will fetch artifacts from backend)
                  if (sessionId) {
                    console.log(`[Flowstral] Executing test for session: ${sessionId}`);
                    const response = await fetch(
                      `${API_BASE_URL}/api/flowstral/session/${sessionId}/execute-test?browser=${browser}&headless=${headless}&timeout=30000`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" }
                      }
                    );
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                      const errorMsg = errorData.detail || `Server error: ${response.status}`;
                      setTestExecutionResult({
                        status: "error",
                        error: errorMsg,
                        execution_time_seconds: 0,
                        browser: browser
                      });
                      toast.error(`Test execution failed: ${errorMsg}`);
                      console.error("[Flowstral] Test execution HTTP error:", errorData);
                      return;
                    }
                    
                    const data = await response.json();
                    
                    // Always set the result so user can see error details
                    if (data.execution_result) {
                      setTestExecutionResult(data.execution_result);
                    } else {
                      setTestExecutionResult(data);
                    }
                    
                    if (data.status === "success") {
                      toast.success("Test execution completed!");
                    } else {
                      const errorMsg = data.execution_result?.error || data.message || "Execution failed";
                      toast.error(`Test execution failed: ${errorMsg.substring(0, 100)}`);
                      console.error("[Flowstral] Test execution error:", data);
                    }
                  } else if (artifacts?.playwright_script?.code) {
                    // Fallback: Use automation endpoint with code from loaded artifacts
                    console.log(`[Flowstral] Executing test using loaded artifacts code`);
                    const response = await fetch(`${API_BASE_URL}/automation/execute-test`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        test_code: artifacts.playwright_script.code,
                        test_name: "Flowstral Test",
                        browser: browser,
                        headless: headless,
                        timeout: 30000
                      })
                    });
                    
                    if (!response.ok) {
                      const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                      const errorMsg = errorData.detail || `Server error: ${response.status}`;
                      setTestExecutionResult({
                        status: "error",
                        error: errorMsg,
                        execution_time_seconds: 0,
                        browser: browser
                      });
                      toast.error(`Test execution failed: ${errorMsg}`);
                      console.error("[Flowstral] Test execution HTTP error:", errorData);
                      return;
                    }
                    
                    const data = await response.json();
                    
                    // Always set the result so user can see error details
                    if (data.execution_result) {
                      setTestExecutionResult(data.execution_result);
                    } else {
                      setTestExecutionResult(data);
                    }
                    
                    if (data.status === "success") {
                      toast.success("Test execution completed!");
                    } else {
                      const errorMsg = data.execution_result?.error || data.message || "Execution failed";
                      toast.error(`Test execution failed: ${errorMsg.substring(0, 100)}`);
                      console.error("[Flowstral] Test execution error:", data);
                    }
                  } else {
                    // No session ID and no artifacts loaded - try to load artifacts first
                    toast.error("No session ID or test code available. Please load artifacts first or select a session.");
                    // Try to auto-load artifacts if we have a session
                    if (session.sessionId) {
                      toast.info("Attempting to load artifacts...");
                      await loadArtifactsForSession(session.sessionId);
                      // Retry after loading
                      setTimeout(() => {
                        toast.info("Please try executing again after artifacts load.");
                      }, 1000);
                    }
                  }
                } catch (error: any) {
                  console.error("[Flowstral] Test execution error:", error);
                  toast.error(`Execution failed: ${error.message}`);
                } finally {
                  setIsExecuting(false);
                }
              }}
              disabled={isExecuting}
              className="w-full"
            >
              {isExecuting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing Test...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Execute Test
                </>
              )}
            </Button>
            {testExecutionResult && (
              <div className="space-y-2">
                <Label>Execution Results</Label>
                <div className={`p-4 rounded-lg ${testExecutionResult.status === "success" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testExecutionResult.status === "success" ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span className="font-semibold">Status: {testExecutionResult.status}</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <p>Execution Time: {testExecutionResult.execution_time_seconds?.toFixed(2)}s</p>
                    <p>Browser: {testExecutionResult.browser || "N/A"}</p>
                    {testExecutionResult.error && (
                      <div className="mt-2 p-2 bg-red-100 rounded text-red-800">
                        <strong>Error:</strong>
                        <pre className="mt-1 text-xs whitespace-pre-wrap">{testExecutionResult.error}</pre>
                      </div>
                    )}
                    {testExecutionResult.status === "success" && (
                      <>
                        {testExecutionResult.screenshots && testExecutionResult.screenshots.length > 0 && (
                          <p>Screenshots: {testExecutionResult.screenshots.length}</p>
                        )}
                        {testExecutionResult.video && <p>Video: Available</p>}
                        {testExecutionResult.trace && <p>Trace: Available</p>}
                      </>
                    )}
                  </div>
                </div>
                {testExecutionResult.stdout && (
                  <div>
                    <Label>Output</Label>
                    <pre className="bg-muted p-4 rounded-lg font-mono text-xs overflow-auto max-h-48 mt-1">
                      {testExecutionResult.stdout}
                    </pre>
                  </div>
                )}
                {testExecutionResult.stderr && testExecutionResult.status !== "success" && (
                  <div>
                    <Label>Error Details</Label>
                    <pre className="bg-red-50 p-4 rounded-lg font-mono text-xs overflow-auto max-h-48 mt-1 text-red-800">
                      {testExecutionResult.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Test Case Review Dialog */}
      <Dialog open={showTestCaseDialog} onOpenChange={setShowTestCaseDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedTestCase?.title || selectedTestCase?.name || "Test Case"}</DialogTitle>
            <DialogDescription>
              {selectedTestCase?.description || "Review test case details"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTestCase?.steps && selectedTestCase.steps.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Test Steps</h3>
                <div className="space-y-2">
                  {selectedTestCase.steps.map((step: any, idx: number) => (
                    <Card key={idx} className="p-3">
                      <div className="font-semibold text-sm">Step {step.step_number || idx + 1}</div>
                      <div className="text-sm mt-1">
                        <strong>Action:</strong> {step.action || step.step_action || "N/A"}
                      </div>
                      <div className="text-sm mt-1 text-muted-foreground">
                        <strong>Expected Result:</strong> {step.expected_result || step.expectedResult || "N/A"}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            {selectedTestCase?.tags && selectedTestCase.tags.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {selectedTestCase.tags.map((tag: string, idx: number) => (
                    <Badge key={idx} variant="secondary">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            {selectedTestCase?.priority && (
              <div>
                <h3 className="font-semibold mb-2">Priority</h3>
                <Badge variant="outline">{selectedTestCase.priority}</Badge>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestCaseDialog(false)}>
              Close
            </Button>
            <Button onClick={() => handleSaveTestCase(selectedTestCase)}>
              <Save className="h-4 w-4 mr-2" />
              Save Test Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

