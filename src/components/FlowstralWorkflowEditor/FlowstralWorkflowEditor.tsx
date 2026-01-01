import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Play, Save, Download, Trash2, Plus, Code, MousePointer, 
  Type, Navigation, Clock, CheckCircle, GitBranch, Repeat,
  Zap, Eye, Move, ZoomIn, ZoomOut, Upload, FileText, Import,
  Loader2, AlertCircle, Copy, ArrowUp, ArrowDown, List
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/lib/api-config';
import { ApplicationDetector, ApplicationType } from '@/lib/application-detector';
import LocatorBuilder from './LocatorBuilder';
import TestRunner from './TestRunner';

interface Node {
  id: string;
  position: { x: number; y: number };
  data: {
    type: 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'condition' | 'loop';
    label: string;
    selector?: string;
    value?: string;
    url?: string;
    duration?: number;
    elementData?: {
      tagName?: string;
      attributes?: Record<string, string>;
      textContent?: string;
      className?: string;
    };
  };
  stepNumber?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
}

interface FlowstralWorkflowEditorProps {
  sessionId?: string;
  importSource?: string;  // 'extension' for auto-import from extension
  onExport?: (workflow: any) => void;
  onImport?: (workflow: any) => void;
}

// Node Component
const NodeComponent = ({ node, isSelected, onClick, onDragStart }: {
  node: Node;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) => {
  const getIcon = () => {
    switch (node.data.type) {
      case 'navigate': return <Navigation className="h-4 w-4" />;
      case 'click': return <MousePointer className="h-4 w-4" />;
      case 'input': return <Type className="h-4 w-4" />;
      case 'wait': return <Clock className="h-4 w-4" />;
      case 'assert': return <CheckCircle className="h-4 w-4" />;
      case 'condition': return <GitBranch className="h-4 w-4" />;
      case 'loop': return <Repeat className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getColor = () => {
    switch (node.data.type) {
      case 'navigate': return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
      case 'click': return 'border-green-500 bg-green-50 dark:bg-green-950';
      case 'input': return 'border-purple-500 bg-purple-50 dark:bg-purple-950';
      case 'wait': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
      case 'assert': return 'border-red-500 bg-red-50 dark:bg-red-950';
      case 'condition': return 'border-orange-500 bg-orange-50 dark:bg-orange-950';
      case 'loop': return 'border-pink-500 bg-pink-50 dark:bg-pink-950';
      default: return 'border-gray-500 bg-gray-50 dark:bg-gray-900';
    }
  };

  const getIconColor = () => {
    switch (node.data.type) {
      case 'navigate': return 'bg-blue-500';
      case 'click': return 'bg-green-500';
      case 'input': return 'bg-purple-500';
      case 'wait': return 'bg-yellow-500';
      case 'assert': return 'bg-red-500';
      case 'condition': return 'bg-orange-500';
      case 'loop': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        cursor: 'move'
      }}
      className={`
        px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-900 shadow-md min-w-[200px] max-w-[250px]
        ${isSelected ? 'border-blue-600 dark:border-amber-500 shadow-lg ring-2 ring-blue-200 dark:ring-amber-500/30' : getColor()}
        hover:shadow-lg transition-all
      `}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-full hover:border-blue-500 dark:hover:border-amber-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className={`${getIconColor()} text-white p-1.5 rounded`}>
          {getIcon()}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{node.data.label}</div>
        </div>
        {/* Step number badge */}
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {node.stepNumber || '?'}
        </div>
      </div>
      
      {node.data.selector && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          {node.data.selector}
        </div>
      )}
      
      {node.data.value && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          Value: {node.data.value}
        </div>
      )}
      
      {node.data.url && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          {node.data.url}
        </div>
      )}
      
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-full hover:border-blue-500 dark:hover:border-amber-500" />
    </div>
  );
};

export default function FlowstralWorkflowEditor({ sessionId, importSource: autoImportSource, onExport, onImport }: FlowstralWorkflowEditorProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [workflowName, setWorkflowName] = useState('Flowstral Workflow');
  const [applicationType, setApplicationType] = useState<ApplicationType>('generic');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState<Node | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize] = useState(20); // Grid cell size in pixels
  const [nodeSpacing] = useState(100); // Vertical spacing between nodes (reduced for compact view)
  const [showGrid, setShowGrid] = useState(false); // Hide grid by default for cleaner look
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas'); // Canvas or list view
  const [copiedNode, setCopiedNode] = useState<Node | null>(null); // For copy/paste
  const [loading, setLoading] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importSource, setImportSource] = useState<'flowstral' | 'file' | 'extension'>('flowstral');
  const [extensionActions, setExtensionActions] = useState<string>('');
  const [autoImported, setAutoImported] = useState(false); // Track if we've done auto-import
  const [importSessionId, setImportSessionId] = useState<string>(''); // Local state for import dialog
  const [availableSessions, setAvailableSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [generatedScript, setGeneratedScript] = useState('');
  const [showScriptViewer, setShowScriptViewer] = useState(false);
  
  const canvasRef = useRef<HTMLDivElement>(null);

  // Auto-save workflow state to localStorage (with individual node states)
  useEffect(() => {
    const saveState = () => {
      const state = {
        workflowName,
        nodes: nodes.map(node => ({
          ...node,
          // Save individual node state with metadata
          state: {
            lastModified: new Date().toISOString(),
            hasLocator: !!node.data.selector,
            isComplete: isNodeComplete(node)
          }
        })),
        edges,
        timestamp: new Date().toISOString(),
        version: '1.0'
      };
      localStorage.setItem('flowstral_workflow_state', JSON.stringify(state));
      
      // Also save individual node states for quick access
      nodes.forEach(node => {
        localStorage.setItem(`flowstral_node_${node.id}`, JSON.stringify({
          ...node,
          savedAt: new Date().toISOString()
        }));
      });
    };

    // Debounce saves (save after 1 second of inactivity)
    const timeoutId = setTimeout(saveState, 1000);
    return () => clearTimeout(timeoutId);
  }, [workflowName, nodes, edges]);

  // Helper to check if node is complete
  const isNodeComplete = (node: Node): boolean => {
    switch (node.data.type) {
      case 'navigate':
        return !!node.data.url;
      case 'click':
      case 'assert':
        return !!node.data.selector;
      case 'input':
        return !!node.data.selector && !!node.data.value;
      case 'wait':
        return !!node.data.value;
      default:
        return true;
    }
  };

  // Load saved state on mount (skip if importing from trace/extension)
  useEffect(() => {
    // Skip auto-restore when importing from another source
    if (autoImportSource) {
      console.log('[WorkflowEditor] Skipping auto-restore, importing from:', autoImportSource);
      return;
    }
    
    const savedState = localStorage.getItem('flowstral_workflow_state');
    if (savedState && nodes.length === 0) {
      try {
        const state = JSON.parse(savedState);
        setWorkflowName(state.workflowName || 'Flowstral Workflow');
        
        // Restore nodes with their individual states
        const restoredNodes = (state.nodes || []).map((node: any) => {
          // Try to load individual node state if available
          const nodeState = localStorage.getItem(`flowstral_node_${node.id}`);
          if (nodeState) {
            const individualState = JSON.parse(nodeState);
            return { ...node, ...individualState };
          }
          return node;
        });
        
        setNodes(restoredNodes);
        setEdges(state.edges || []);
        toast.success(`Workflow restored: ${restoredNodes.length} nodes loaded`);
      } catch (error) {
        console.error('Failed to load saved state:', error);
      }
    }
  }, [autoImportSource]);

  // Save individual node state when updated
  const saveNodeState = (node: Node) => {
    const nodeState = {
      ...node,
      savedAt: new Date().toISOString(),
      state: {
        lastModified: new Date().toISOString(),
        hasLocator: !!node.data.selector,
        isComplete: isNodeComplete(node)
      }
    };
    localStorage.setItem(`flowstral_node_${node.id}`, JSON.stringify(nodeState));
  };

  // Load from Flowstral session
  // Detect application type from nodes
  useEffect(() => {
    // Check navigate nodes for URL patterns
    const navigateNode = nodes.find(n => n.data.type === 'navigate' && n.data.url);
    if (navigateNode && navigateNode.data.url) {
      const detectedType = ApplicationDetector.detectFromUrl(navigateNode.data.url);
      if (detectedType !== 'generic') {
        setApplicationType(detectedType);
      }
    }
  }, [nodes]);

  // Auto-import from extension when opened with ?import=extension
  useEffect(() => {
    // Handle import from extension
    if (autoImportSource === 'extension' && !autoImported) {
      const loadFromExtension = async () => {
        try {
          // Check localStorage for pending import from extension
          const pendingImportStr = localStorage.getItem('flowstral_pending_import');
          if (pendingImportStr) {
            const pendingImport = JSON.parse(pendingImportStr);
            const actions = pendingImport.actions || [];
            
            // Check if import is recent (within last 5 minutes)
            const importAge = Date.now() - (pendingImport.timestamp || 0);
            if (importAge > 5 * 60 * 1000) {
              console.log('Pending import is too old, ignoring');
              localStorage.removeItem('flowstral_pending_import');
              return;
            }
            
            if (actions.length > 0) {
              setLoading(true);
              
              // Call backend API to convert actions to workflow nodes
              const response = await fetch(`${API_BASE_URL}/api/flowstral/workflow/import-recording`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  actions: actions,
                  metadata: pendingImport.metadata || {}
                })
              });

              if (response.ok) {
                const data = await response.json();
                const workflow = data.workflow;

                setWorkflowName(workflow.name || 'Imported from Extension');
                setNodes(workflow.nodes || []);
                setEdges(workflow.edges || []);
                setSelectedNode(null);
                toast.success(`Auto-imported ${workflow.nodes?.length || 0} actions from extension! 🎉`);
                onImport?.(workflow);
              } else {
                toast.error('Failed to import from extension');
              }
              
              // Clear the pending import
              localStorage.removeItem('flowstral_pending_import');
              setAutoImported(true);
              setLoading(false);
            }
          }
        } catch (error) {
          console.error('Failed to auto-import from extension:', error);
          toast.error('Failed to auto-import from extension');
          setLoading(false);
        }
      };
      
      loadFromExtension();
    }
    
    // Handle import from Trace page
    if (autoImportSource === 'trace' && !autoImported) {
      const loadFromTrace = () => {
        try {
          const sessionStr = localStorage.getItem('workflow_import_session');
          if (sessionStr) {
            const session = JSON.parse(sessionStr);
            console.log('[WorkflowEditor] Loading from Trace page:', session.name);
            
            // Convert session steps/actions to workflow nodes
            const actions = session.actions || [];
            const newNodes: Node[] = actions.map((action: any, index: number) => ({
              id: `node_${index}_${Date.now()}`,
              position: { x: 100, y: 80 + index * 100 },
              data: {
                type: action.type || 'click',
                label: action.description || `Step ${index + 1}`,
                selector: action.selector,
                value: action.value,
                url: action.url,
              },
              stepNumber: index + 1,
            }));
            
            const newEdges: Edge[] = newNodes.slice(0, -1).map((node, i) => ({
              id: `edge_${i}`,
              source: node.id,
              target: newNodes[i + 1].id,
            }));
            
            setWorkflowName(session.name || 'Imported from Trace');
            setNodes(newNodes);
            setEdges(newEdges);
            toast.success(`Loaded ${newNodes.length} steps from "${session.name}"`);
            
            // Clear the import data
            localStorage.removeItem('workflow_import_session');
            setAutoImported(true);
          }
        } catch (error) {
          console.error('[WorkflowEditor] Failed to load from Trace:', error);
          toast.error('Failed to load session from Trace');
        }
      };
      
      loadFromTrace();
    }
  }, [autoImportSource, autoImported, onImport]);

  // Load available sessions for selection
  const loadAvailableSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        setAvailableSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  // Load sessions when import dialog opens
  useEffect(() => {
    if (showImportDialog && importSource === 'flowstral') {
      loadAvailableSessions();
      // Pre-fill with sessionId from props if available
      if (sessionId && !importSessionId) {
        setImportSessionId(sessionId);
      }
    }
  }, [showImportDialog, importSource, loadAvailableSessions, sessionId, importSessionId]);

  // AUTO-LOAD: When sessionId is provided via URL, automatically load the session
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  
  useEffect(() => {
    // Only auto-load once, when sessionId is provided and we haven't loaded yet
    if (sessionId && !hasAutoLoaded && nodes.length === 0) {
      console.log('[WorkflowEditor] Auto-loading session:', sessionId);
      setHasAutoLoaded(true);
      // Use a small delay to ensure component is fully mounted
      const timer = setTimeout(() => {
        loadFromFlowstralDirect(sessionId);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [sessionId, hasAutoLoaded, nodes.length]);

  // Direct load function that doesn't depend on state (for auto-load)
  const loadFromFlowstralDirect = async (targetSessionId: string) => {
    setLoading(true);
    try {
      console.log('[WorkflowEditor] Loading session:', targetSessionId);
      
      // Try multiple endpoints to get session data
      let data: any = null;
      let actionGraph: any = null;
      let actions: any[] = [];
      
      // 1. Try artifacts endpoint first (has most complete data)
      try {
        const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${targetSessionId}/artifacts`);
        if (response.ok) {
          data = await response.json();
          actionGraph = data.action_graph || data.artifacts?.action_graph;
          actions = data.actions || [];
          console.log('[WorkflowEditor] Artifacts response:', { hasActionGraph: !!actionGraph, actionsCount: actions.length });
        }
      } catch (e) {
        console.log('[WorkflowEditor] Artifacts endpoint failed:', e);
      }
      
      // 2. If no action_graph, try session status endpoint
      if (!actionGraph || !actionGraph.nodes || actionGraph.nodes.length === 0) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${targetSessionId}/status`);
          if (response.ok) {
            const statusData = await response.json();
            const session = statusData.session || statusData;
            actionGraph = session.action_graph;
            actions = session.actions || actions;
            data = { ...data, ...session };
            console.log('[WorkflowEditor] Status response:', { hasActionGraph: !!actionGraph, actionsCount: actions.length });
          }
        } catch (e) {
          console.log('[WorkflowEditor] Status endpoint failed:', e);
        }
      }
      
      // Determine what data to use
      const hasValidActionGraph = actionGraph && actionGraph.nodes && actionGraph.nodes.length > 0;
      const hasValidActions = actions && actions.length > 0;
      
      console.log('[WorkflowEditor] Data available:', { hasValidActionGraph, hasValidActions, actionsCount: actions.length });
      
      // Convert to workflow nodes
      let newNodes: Node[] = [];
      
      if (hasValidActionGraph) {
        // Use action_graph nodes
        newNodes = actionGraph.nodes.map((node: any, index: number) => ({
          id: node.id || `node_${index}_${Date.now()}`,
          position: { x: 100, y: 80 + index * 100 },
          data: {
            type: node.event_type === 'input' || node.event_type === 'fill' || node.event_type === 'type' ? 'input' : 
                  node.event_type === 'navigate' ? 'navigate' : 'click',
            label: node.description || node.element_name || `Step ${index + 1}`,
            selector: node.playwright_locator || node.semantic_locator || node.selector,
            value: node.input_value,
            url: node.url,
            elementData: node.element_data,
          },
          stepNumber: index + 1,
        }));
      } else if (hasValidActions) {
        // Convert raw actions to nodes
        console.log('[WorkflowEditor] Converting actions to nodes:', actions.length);
        newNodes = actions.map((action: any, index: number) => ({
          id: `node_${index}_${Date.now()}`,
          position: { x: 100, y: 80 + index * 100 },
          data: {
            type: action.type === 'input' || action.type === 'fill' || action.type === 'type' ? 'input' : 
                  action.type === 'navigate' ? 'navigate' : 'click',
            label: action.description || `${action.type}: ${action.value || action.text || ''}`.slice(0, 50),
            selector: typeof action.selector === 'object' 
              ? (action.selector?.playwright || action.selector?.selector) 
              : action.selector,
            value: action.value,
            url: action.url,
          },
          stepNumber: index + 1,
        }));
      } else {
        toast.error('No recorded actions found in this session');
        return;
      }
      
      // Create edges connecting sequential nodes
      const newEdges: Edge[] = hasValidActionGraph && actionGraph.edges?.length > 0
        ? actionGraph.edges.map((edge: any, i: number) => ({
            id: edge.id || `edge_${i}`,
            source: edge.source,
            target: edge.target,
          }))
        : newNodes.slice(0, -1).map((node, i) => ({
            id: `edge_${i}`,
            source: node.id,
            target: newNodes[i + 1].id,
          }));
      
      setNodes(newNodes);
      setEdges(newEdges);
      setWorkflowName(data?.name || data?.metadata?.name || `Recording ${targetSessionId.substring(0, 8)}`);
      toast.success(`Loaded ${newNodes.length} steps from session`);
      setShowImportDialog(false);
      
    } catch (error: any) {
      console.error('[WorkflowEditor] Failed to load session:', error);
      toast.error(`Failed to load session: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFromFlowstral = useCallback(async (sessionIdToLoad?: string) => {
    // Use provided sessionId or the one from import dialog or prop
    const targetSessionId = sessionIdToLoad || importSessionId || sessionId;
    
    if (!targetSessionId) {
      toast.error('Please enter a Flowstral Session ID');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/session/${targetSessionId}/artifacts`);
      if (!response.ok) throw new Error('Failed to load Flowstral session');

      const data = await response.json();
      
      // Handle different response structures
      // API can return: { artifacts: { action_graph: {...} } } or { action_graph: {...} }
      const actionGraph = data.artifacts?.action_graph || data.action_graph;
      const metadata = data.metadata || data.artifacts?.metadata;
      
      if (!actionGraph || !actionGraph.nodes || actionGraph.nodes.length === 0) {
        // Check if there's a message explaining why
        if (data.message) {
          toast.error(data.message);
        } else {
          toast.error('No action graph found in session. The session may not have any recorded actions.');
        }
        console.error('No action graph in response:', data);
        return;
      }
      
      // Detect application type from session metadata or first navigate node
      if (metadata && metadata.application_type) {
        setApplicationType(metadata.application_type as ApplicationType);
      } else if (actionGraph && actionGraph.nodes) {
        const navigateNode = actionGraph.nodes.find((n: any) => n.event_type === 'navigate' && n.url);
        if (navigateNode && navigateNode.url) {
          const detectedType = ApplicationDetector.detectFromUrl(navigateNode.url);
          setApplicationType(detectedType);
        }
      }
      
      // Convert Flowstral action graph to nodes
      if (actionGraph && actionGraph.nodes) {
        const convertedNodes: Node[] = actionGraph.nodes.map((node: any, index: number) => {
          const eventType = node.event_type || 'click';
          let type: Node['data']['type'] = 'click';
          
          if (eventType === 'navigate') type = 'navigate';
          else if (eventType === 'input' || eventType === 'fill_field') type = 'input';
          else if (eventType === 'click' || eventType === 'click_button') type = 'click';
          else if (eventType === 'wait') type = 'wait';
          else if (eventType === 'assert') type = 'assert';

          // Extract element data from metadata if available
          const elementData = node.metadata?.interacted_element || node.metadata?.selector_analysis?.element || null;

          return {
            id: node.id || `node-${index}`,
            position: { 
              x: 250, 
              y: 50 + (index * 130) 
            },
            data: {
              type,
              label: node.action_description || node.event_type || 'Action',
              selector: node.target_selector,
              value: node.metadata?.value || node.metadata?.input_value,
              url: node.url,
              elementData: elementData, // Store element data for selector analysis
            }
          };
        });

        const convertedEdges: Edge[] = [];
        for (let i = 0; i < convertedNodes.length - 1; i++) {
          convertedEdges.push({
            id: `e${convertedNodes[i].id}-${convertedNodes[i + 1].id}`,
            source: convertedNodes[i].id,
            target: convertedNodes[i + 1].id
          });
        }

        setNodes(convertedNodes);
        setEdges(convertedEdges);
        setWorkflowName(data.session_name || data.artifacts?.session_name || 'Imported Flowstral Workflow');
        toast.success(`Loaded ${convertedNodes.length} actions from Flowstral`);
        setShowImportDialog(false); // Close dialog on success
        setImportSessionId(''); // Clear input
      } else {
        toast.error('No action graph nodes found in the session data');
        console.error('Response structure:', data);
      }
    } catch (error: any) {
      console.error('Failed to load Flowstral session:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      toast.error(`Failed to load from Flowstral: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [sessionId, importSessionId]);

  // Handle node dragging
  const handleNodeDragStart = (node: Node, e: React.DragEvent) => {
    e.stopPropagation();
    if (!canvasRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - node.position.x * zoom - pan.x * zoom;
    const offsetY = e.clientY - rect.top - node.position.y * zoom - pan.y * zoom;
    
    setDraggingNode(node);
    setDragOffset({ x: offsetX, y: offsetY });
    setSelectedNode(node);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    if (draggingNode) {
      const rect = canvasRef.current.getBoundingClientRect();
      const rawX = (e.clientX - rect.left - pan.x * zoom - dragOffset.x) / zoom;
      const rawY = (e.clientY - rect.top - pan.y * zoom - dragOffset.y) / zoom;

      // Snap position for smooth alignment
      const snapped = snapPosition(rawX, rawY, true);
      
      setNodes(nds =>
        nds.map(node =>
          node.id === draggingNode.id
            ? { ...node, position: { x: snapped.x, y: snapped.y } }
            : node
        )
      );
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: pan.x + dx / zoom, y: pan.y + dy / zoom });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    if (draggingNode) {
      // Final update of edges when drag ends
      updateEdgesForOrder();
    }
    setDraggingNode(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setSelectedNode(null);
    }
  };

  // Snap position to grid or align with other nodes
  const snapPosition = (x: number, y: number, isDragging: boolean = false): { x: number; y: number } => {
    let snappedX = x;
    let snappedY = y;

    if (snapToGrid) {
      // Snap to grid
      snappedX = Math.round(x / gridSize) * gridSize;
      snappedY = Math.round(y / gridSize) * gridSize;
    }

    if (isDragging) {
      // Snap to horizontal alignment with other nodes (for vertical reordering)
      const otherNodes = nodes.filter(n => n.id !== draggingNode?.id);
      const snapThreshold = 15; // pixels
      
      // Find closest Y position to align with
      for (const node of otherNodes) {
        const distance = Math.abs(y - node.position.y);
        if (distance < snapThreshold) {
          snappedY = node.position.y;
          break;
        }
      }

      // Also snap to standard node spacing intervals
      const baseY = 50; // Starting Y position
      const spacing = nodeSpacing;
      const nearestSpacing = Math.round((y - baseY) / spacing) * spacing + baseY;
      if (Math.abs(y - nearestSpacing) < snapThreshold) {
        snappedY = nearestSpacing;
      }
    }

    return { x: snappedX, y: snappedY };
  };

  // Get sorted nodes by Y position (execution order)
  const getSortedNodes = () => {
    return [...nodes].sort((a, b) => a.position.y - b.position.y);
  };

  // Get node index in execution order
  const getNodeIndex = (nodeId: string) => {
    const sorted = getSortedNodes();
    return sorted.findIndex(n => n.id === nodeId);
  };

  // Move node up in execution order
  const moveNodeUp = () => {
    if (!selectedNode) return;
    
    setNodes(nds => {
      const sorted = [...nds].sort((a, b) => a.position.y - b.position.y);
      const currentIndex = sorted.findIndex(n => n.id === selectedNode.id);
      
      if (currentIndex <= 0) {
        toast.info('Node is already first');
        return nds;
      }

      const currentY = sorted[currentIndex].position.y;
      const previousY = sorted[currentIndex - 1].position.y;
      const previousNodeId = sorted[currentIndex - 1].id;
      
      // Swap Y positions
      return nds.map(node => {
        if (node.id === selectedNode.id) {
          return { ...node, position: { ...node.position, y: previousY } };
        }
        if (node.id === previousNodeId) {
          return { ...node, position: { ...node.position, y: currentY } };
        }
        return node;
      });
    });

    // Update edges and selected node after state update
    setTimeout(() => {
      updateEdgesForOrder();
      setNodes(nds => {
        const updated = nds.find(n => n.id === selectedNode.id);
        if (updated) setSelectedNode(updated);
        return nds;
      });
    }, 10);
    
    toast.success('Node moved up');
  };

  // Move node down in execution order
  const moveNodeDown = () => {
    if (!selectedNode) return;
    
    setNodes(nds => {
      const sorted = [...nds].sort((a, b) => a.position.y - b.position.y);
      const currentIndex = sorted.findIndex(n => n.id === selectedNode.id);
      
      if (currentIndex >= sorted.length - 1) {
        toast.info('Node is already last');
        return nds;
      }

      const currentY = sorted[currentIndex].position.y;
      const nextY = sorted[currentIndex + 1].position.y;
      const nextNodeId = sorted[currentIndex + 1].id;
      
      // Swap Y positions
      return nds.map(node => {
        if (node.id === selectedNode.id) {
          return { ...node, position: { ...node.position, y: nextY } };
        }
        if (node.id === nextNodeId) {
          return { ...node, position: { ...node.position, y: currentY } };
        }
        return node;
      });
    });

    // Update edges and selected node after state update
    setTimeout(() => {
      updateEdgesForOrder();
      setNodes(nds => {
        const updated = nds.find(n => n.id === selectedNode.id);
        if (updated) setSelectedNode(updated);
        return nds;
      });
    }, 10);
    
    toast.success('Node moved down');
  };

  // Update edges based on node order
  const updateEdgesForOrder = () => {
    const sorted = getSortedNodes();
    const newEdges: Edge[] = [];
    
    for (let i = 0; i < sorted.length - 1; i++) {
      newEdges.push({
        id: `e${sorted[i].id}-${sorted[i + 1].id}`,
        source: sorted[i].id,
        target: sorted[i + 1].id
      });
    }
    
    setEdges(newEdges);
  };

  // Auto-arrange nodes vertically
  const autoArrangeNodes = () => {
    const sorted = getSortedNodes();
    const startY = 50;
    const spacing = nodeSpacing;
    const centerX = 250;
    
    setNodes(nds =>
      nds.map((node) => {
        const sortedIndex = sorted.findIndex(n => n.id === node.id);
        const snapped = snapPosition(centerX, startY + (sortedIndex * spacing));
        return {
          ...node,
          position: {
            x: snapped.x,
            y: snapped.y
          }
        };
      })
    );

    updateEdgesForOrder();
    toast.success('Nodes auto-arranged');
  };

  // Update edges when nodes change position (for reordering)
  useEffect(() => {
    // Only update edges if we're not currently dragging (to avoid excessive updates)
    if (!draggingNode && nodes.length > 0) {
      updateEdgesForOrder();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.map(n => `${n.id}:${n.position.y}`).join(',')]); // Update when Y positions change

  // Keyboard shortcuts for copy/paste/delete/reorder
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if not typing in an input
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      if (isInput) {
        // Allow copy/paste in inputs
        if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'v' || e.key === 'x')) {
          return; // Let browser handle it
        }
        // Allow delete/backspace in inputs
        if (e.key === 'Delete' || e.key === 'Backspace') {
          return; // Let browser handle it
        }
      }

      // Copy (Ctrl+C or Cmd+C) - requires selected node
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedNode && !isInput) {
          e.preventDefault();
          e.stopPropagation();
          copyNode();
          return;
        }
      }

      // Paste (Ctrl+V or Cmd+V) - works even without selected node
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        if (!isInput) {
          e.preventDefault();
          e.stopPropagation();
          pasteNode();
          return;
        }
      }

      // Delete (Delete or Backspace) - requires selected node
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode && !isInput) {
        e.preventDefault();
        e.stopPropagation();
        deleteNode();
        return;
      }

      // Move up/down (Ctrl+Arrow) - requires selected node
      if (selectedNode && (e.ctrlKey || e.metaKey) && !isInput) {
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          e.stopPropagation();
          moveNodeUp();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          e.stopPropagation();
          moveNodeDown();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNode?.id, copiedNode?.id]); // Only depend on IDs to avoid re-binding too often

  // Render edges/arrows based on sorted order - simplified for cleaner look
  const renderEdges = () => {
    const sorted = getSortedNodes();
    // Only show edges if there are fewer than 10 nodes, or use simplified view
    if (sorted.length > 10) {
      // For many nodes, show minimal vertical line
      return sorted.slice(0, -1).map((node, index) => {
        const nextNode = sorted[index + 1];
        if (!nextNode) return null;

        const centerX = node.position.x + 125;
        const startY = node.position.y + 80;
        const endY = nextNode.position.y - 10;

        return (
          <g key={`e${node.id}-${nextNode.id}`}>
            <line
              x1={centerX}
              y1={startY}
              x2={centerX}
              y2={endY}
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4,4"
            />
          </g>
        );
      });
    }
    
    // For fewer nodes, show full arrows
    return sorted.slice(0, -1).map((node, index) => {
      const nextNode = sorted[index + 1];
      if (!nextNode) return null;

      const startX = node.position.x + 125;
      const startY = node.position.y + 80;
      const endX = nextNode.position.x + 125;
      const endY = nextNode.position.y - 10;

      return (
        <g key={`e${node.id}-${nextNode.id}`}>
          <path
            d={`M ${startX} ${startY} L ${endX} ${endY}`}
            stroke="#94a3b8"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    });
  };

  // Auto-generate smart locator based on node type and context
  const generateSmartLocator = (type: Node['data']['type'], label: string): string => {
    const cleanLabel = label.replace(/^(New|Click|Enter|Fill|Wait|Assert)\s+/i, '').trim();
    
    switch (type) {
      case 'click':
        // Try button first, then link
        if (cleanLabel) {
          return `page.getByRole('button', { name: '${cleanLabel}' })`;
        }
        return `page.getByRole('button').first()`;
      
      case 'input':
        // Use label if available, otherwise use placeholder text
        if (cleanLabel) {
          return `page.getByLabel('${cleanLabel}')`;
        }
        return `page.getByRole('textbox').first()`;
      
      case 'assert':
        // Use text content for assertions
        if (cleanLabel) {
          return `page.getByText('${cleanLabel}')`;
        }
        return `page.locator('body')`;
      
      default:
        return '';
    }
  };

  const addNode = (type: Node['data']['type']) => {
    const nodeConfig: Record<string, { label: string; defaultSelector?: string }> = {
      navigate: { label: 'Navigate to Page' },
      click: { label: 'Click Button' },
      input: { label: 'Enter Text' },
      wait: { label: 'Wait' },
      assert: { label: 'Verify Element' },
      condition: { label: 'New Condition' },
      loop: { label: 'New Loop' },
    };

    const config = nodeConfig[type] || nodeConfig.click;
    
    // Auto-generate smart locator
    const smartSelector = ['click', 'input', 'assert'].includes(type) 
      ? generateSmartLocator(type, config.label)
      : '';

    const newNode: Node = {
      id: `${Date.now()}`,
      position: { 
        x: 250, 
        y: nodes.length > 0 ? Math.max(...nodes.map(n => n.position.y)) + 150 : 50
      },
      data: {
        type,
        label: config.label,
        selector: smartSelector,
        value: type === 'wait' ? '1000' : '',
        url: type === 'navigate' ? 'https://example.com' : undefined,
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);

    // Auto-connect to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const newEdge: Edge = {
        id: `e${lastNode.id}-${newNode.id}`,
        source: lastNode.id,
        target: newNode.id
      };
      setEdges(eds => [...eds, newEdge]);
    }
    
    toast.success(`${config.label} added with smart locator`);
  };

  // Copy node
  const copyNode = useCallback(() => {
    if (!selectedNode) {
      toast.info('Select a node to copy');
      return;
    }
    console.log('Copying node:', selectedNode.id);
    setCopiedNode({ ...selectedNode }); // Create a deep copy
    toast.success('Node copied! Press Ctrl+V to paste');
  }, [selectedNode]);

  // Paste node
  const pasteNode = useCallback(() => {
    if (!copiedNode) {
      toast.info('No node copied. Press Ctrl+C to copy a node first');
      return;
    }

    console.log('Pasting node:', copiedNode.id);
    const newId = `node-${Date.now()}`;
    const offsetX = 50; // Offset pasted node slightly to the right
    const offsetY = 30; // Offset pasted node slightly down
    
    const newNode: Node = {
      ...copiedNode,
      id: newId,
      position: {
        x: copiedNode.position.x + offsetX,
        y: copiedNode.position.y + offsetY
      },
      data: {
        ...copiedNode.data,
        label: copiedNode.data.label.replace(' (Copy)', '') + ' (Copy)'
      }
    };

    setNodes(nds => [...nds, newNode]);
    setSelectedNode(newNode);
    setTimeout(() => {
      updateEdgesForOrder();
    }, 10);
    toast.success('Node pasted!');
  }, [copiedNode]);

  // Delete node
  const deleteNode = useCallback(() => {
    if (!selectedNode) {
      toast.info('Select a node to delete');
      return;
    }

    console.log('Deleting node:', selectedNode.id);
    const nodeLabel = selectedNode.data.label;
    const nodeId = selectedNode.id;
    
    setNodes(nds => {
      const filtered = nds.filter(n => n.id !== nodeId);
      console.log('Nodes after delete:', filtered.length);
      return filtered;
    });
    
    setEdges(es => {
      const filtered = es.filter(
        e => e.source !== nodeId && e.target !== nodeId
      );
      console.log('Edges after delete:', filtered.length);
      return filtered;
    });
    
    setSelectedNode(null);
    
    setTimeout(() => {
      updateEdgesForOrder();
    }, 10);
    
    toast.success(`Deleted: ${nodeLabel}`);
  }, [selectedNode]);

  const updateNodeData = (field: keyof Node['data'], value: any) => {
    if (!selectedNode) return;
    
    const updatedNode = {
      ...selectedNode,
      data: { ...selectedNode.data, [field]: value }
    };
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id ? updatedNode : node
      )
    );
    
    setSelectedNode(updatedNode);
    
    // Save individual node state
    saveNodeState(updatedNode);
  };

  // Export to Flowstral format
  const exportToFlowstral = async () => {
    if (!sessionId) {
      toast.error('No session ID provided for export');
      return;
    }

    setLoading(true);
    try {
      // Convert nodes to Flowstral action graph format
      const actionGraph = {
        nodes: nodes.map((node, index) => ({
          id: node.id,
          event_type: node.data.type === 'navigate' ? 'navigate' : 
                     node.data.type === 'input' ? 'input' : 'click',
          target_selector: node.data.selector,
          target_text: node.data.value,
          action_description: node.data.label,
          url: node.data.url,
          timestamp: new Date().toISOString(),
          metadata: {
            value: node.data.value,
            input_value: node.data.value,
            interacted_element: {
              tag_name: node.data.type === 'click' ? 'button' : 'input'
            }
          }
        })),
        edges: edges
      };

      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions/${sessionId}/update-action-graph`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action_graph: actionGraph })
      });

      if (!response.ok) throw new Error('Failed to export to Flowstral');

      toast.success('Workflow exported to Flowstral successfully');
      onExport?.(actionGraph);
    } catch (error: any) {
      toast.error(`Failed to export: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate full Playwright script
  const generateFullScript = (): string => {
    // Validate nodes have required properties
    const invalidNodes = nodes.filter(node => {
      if (node.data.type === 'navigate' && !node.data.url) return true;
      if (['click', 'input', 'assert'].includes(node.data.type) && !node.data.selector) return true;
      if (node.data.type === 'input' && !node.data.value) return true;
      return false;
    });

    if (invalidNodes.length > 0) {
      toast.error(`Please complete ${invalidNodes.length} node(s) before exporting`);
      // Select first invalid node
      setSelectedNode(invalidNodes[0]);
      return;
    }

    let script = `// Playwright Test Script\n`;
    script += `// Generated from: ${workflowName}\n`;
    script += `// Auto-generated with intelligent locators\n\n`;
    script += `import { test, expect } from '@playwright/test';\n\n`;
    script += `// Configuration\n`;
    script += `const ACTION_TIMEOUT = 10000; // 10 seconds\n`;
    script += `const NETWORK_TIMEOUT = 3000; // 3 seconds\n\n`;
    script += `test('${workflowName}', async ({ page }) => {\n`;

    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    sortedNodes.forEach((node, index) => {
      const { type, label, selector, value, url } = node.data;
      
      script += `  // Step ${index + 1}: ${label}\n`;
      
      switch (type) {
        case 'navigate':
          script += `  await page.goto('${url}');\n`;
          script += `  await page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT });\n`;
          break;
        case 'click':
          // Use selector with timeout
          script += `  await ${selector}.click({ timeout: ACTION_TIMEOUT });\n`;
          // Add network wait after clicks
          script += `  await page.waitForLoadState('networkidle', { timeout: NETWORK_TIMEOUT }).catch(() => {});\n`;
          break;
        case 'input':
          // Escape value for JavaScript
          const escapedValue = (value || '').replace(/'/g, "\\'").replace(/\n/g, "\\n");
          script += `  await ${selector}.fill('${escapedValue}', { timeout: ACTION_TIMEOUT });\n`;
          break;
        case 'wait':
          script += `  await page.waitForTimeout(${value || 1000});\n`;
          break;
        case 'assert':
          script += `  await expect(${selector}).toBeVisible({ timeout: ACTION_TIMEOUT });\n`;
          break;
      }
      script += '\n';
    });

    script += `});\n`;

    return script;
  };

  // Export to Playwright with intelligent defaults
  const exportToPlaywright = () => {
    const script = generateFullScript();
    setGeneratedScript(script);
    
    const blob = new Blob([script], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}.spec.ts`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Playwright script exported with intelligent locators!');
  };

  // View full script
  const viewFullScript = () => {
    const script = generateFullScript();
    setGeneratedScript(script);
    setShowScriptViewer(true);
  };

  // Import workflow from file
  const importWorkflow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target.result as string);
        setWorkflowName(workflow.name || 'Imported Workflow');
        setNodes(workflow.nodes || []);
        setEdges(workflow.edges || []);
        setSelectedNode(null);
        toast.success('Workflow imported successfully');
        onImport?.(workflow);
      } catch (error: any) {
        toast.error(`Error importing workflow: ${error.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Import recording from extension (paste JSON actions)
  const importFromExtension = async () => {
    try {
      if (!extensionActions.trim()) {
        toast.error('Please paste the recorded actions JSON');
        return;
      }

      setLoading(true);
      const actions = JSON.parse(extensionActions);
      
      if (!Array.isArray(actions)) {
        toast.error('Invalid format: expected an array of actions');
        return;
      }

      // Call backend API to convert actions to workflow nodes
      const response = await fetch(`${API_BASE_URL}/api/flowstral/workflow/import-recording`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actions: actions,
          metadata: {
            title: workflowName || 'Imported Recording',
            startUrl: actions.find((a: any) => a.type === 'navigate')?.url || '',
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to import recording');
      }

      const data = await response.json();
      const workflow = data.workflow;

      setWorkflowName(workflow.name || 'Imported Recording');
      setNodes(workflow.nodes || []);
      setEdges(workflow.edges || []);
      setSelectedNode(null);
      toast.success(`Imported ${workflow.nodes?.length || 0} actions from recording`);
      setShowImportDialog(false);
      setExtensionActions('');
      onImport?.(workflow);
    } catch (error: any) {
      console.error('Failed to import from extension:', error);
      toast.error(`Error importing: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle drag and drop file
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workflow = JSON.parse(event.target?.result as string);
          setWorkflowName(workflow.name || 'Dropped Workflow');
          setNodes(workflow.nodes || []);
          setEdges(workflow.edges || []);
          toast.success('Workflow loaded from dropped file');
          onImport?.(workflow);
        } catch (error: any) {
          toast.error(`Error loading file: ${error.message}`);
        }
      };
      reader.readAsText(file);
    }
  }, [onImport]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <Input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-xl font-semibold border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1"
          />
          <Badge variant="outline">
            {nodes.length} steps
          </Badge>
          {sessionId && (
            <Badge variant="secondary">
              Session: {sessionId.slice(0, 8)}...
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setShowImportDialog(true)}
            disabled={loading}
          >
            <Import className="h-4 w-4 mr-2" />
            Import
          </Button>
          {sessionId && (
            <Button
              variant="outline"
              onClick={loadFromFlowstral}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Load from Flowstral
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => {
              const workflow = {
                name: workflowName,
                nodes: nodes.map(n => ({
                  id: n.id,
                  type: n.data.type,
                  label: n.data.label,
                  selector: n.data.selector,
                  value: n.data.value,
                  url: n.data.url,
                  position: n.position
                })),
                edges: edges.map(e => ({
                  source: e.source,
                  target: e.target
                }))
              };
              const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${workflowName.replace(/\s+/g, '_')}_workflow.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Save className="h-4 w-4 mr-2" />
            Save
          </Button>
          <Button
            variant="outline"
            onClick={viewFullScript}
          >
            <Code className="h-4 w-4 mr-2" />
            View Script
          </Button>
          <Button
            variant="outline"
            onClick={exportToPlaywright}
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          {sessionId && (
            <Button
              variant="outline"
              onClick={exportToFlowstral}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Export to Flowstral
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 text-gray-800 dark:text-gray-200">Add Actions</h3>
          <div className="space-y-2">
            {[
              { type: 'navigate' as const, icon: <Navigation className="h-4 w-4" />, label: 'Navigate', color: 'blue' },
              { type: 'click' as const, icon: <MousePointer className="h-4 w-4" />, label: 'Click', color: 'green' },
              { type: 'input' as const, icon: <Type className="h-4 w-4" />, label: 'Input', color: 'purple' },
              { type: 'wait' as const, icon: <Clock className="h-4 w-4" />, label: 'Wait', color: 'yellow' },
              { type: 'assert' as const, icon: <CheckCircle className="h-4 w-4" />, label: 'Assert', color: 'red' },
            ].map((action) => (
              <Button
                key={action.type}
                onClick={() => addNode(action.type)}
                variant="outline"
                className="w-full justify-start"
              >
                <div className={`bg-${action.color}-500 text-white p-1.5 rounded mr-2`}>
                  {action.icon}
                </div>
                {action.label}
              </Button>
            ))}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">💡 Flowstral Integration</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <p>
                Import recordings from Flowstral Recorder or build workflows from scratch. 
                Export to Flowstral when ready.
              </p>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm">📋 Reorder Nodes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={autoArrangeNodes}
              >
                <List className="h-4 w-4 mr-2" />
                Auto-Arrange Vertically
              </Button>
              <div className="flex items-center justify-between pt-2 border-t">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="snapToGrid"
                    checked={snapToGrid}
                    onChange={(e) => setSnapToGrid(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="snapToGrid" className="text-xs cursor-pointer">
                    Snap to Grid
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="showGrid"
                    checked={showGrid}
                    onChange={(e) => setShowGrid(e.target.checked)}
                    className="rounded"
                  />
                  <label htmlFor="showGrid" className="text-xs cursor-pointer">
                    Show Grid
                  </label>
                </div>
              </div>
              <div className="pt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  Drag nodes to reorder • Use ↑/↓ buttons for precise control
                </p>
                <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t">
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">Ctrl+C</kbd>
                    <span>Copy</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">Ctrl+V</kbd>
                    <span>Paste</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-gray-100 border border-gray-300 rounded">Del</kbd>
                    <span>Delete</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-gray-50 dark:bg-gray-950"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseDown={handleCanvasMouseDown}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{ 
            backgroundImage: showGrid ? `linear-gradient(to right, #e5e7eb 1px, transparent 1px), linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)` : 'none',
            backgroundSize: showGrid ? `${gridSize * zoom}px ${gridSize * zoom}px` : 'auto',
            cursor: isPanning ? 'grabbing' : 'grab',
            minHeight: nodes.length > 7 ? `${50 + (nodes.length * nodeSpacing)}px` : '100%'
          }}
        >
          {/* Alignment guides - show horizontal lines where nodes are positioned */}
          {draggingNode && (
            <div className="absolute inset-0 pointer-events-none" style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0'
            }}>
              {/* Show alignment lines for other nodes */}
              {nodes
                .filter(n => n.id !== draggingNode.id)
                .map(node => {
                  const distance = Math.abs(draggingNode.position.y - node.position.y);
                  const isNear = distance < 15; // Highlight when close
                  return (
                    <div
                      key={`guide-${node.id}`}
                      className={`absolute left-0 right-0 border-t-2 border-dashed transition-opacity ${
                        isNear ? 'border-blue-500 opacity-100' : 'border-blue-300 opacity-30'
                      }`}
                      style={{ top: `${node.position.y + 80}px` }}
                    />
                  );
                })}
              
              {/* Show snap target indicator */}
              {snapToGrid && (
                <div
                  className="absolute left-0 right-0 border-t-2 border-green-400 opacity-60"
                  style={{ 
                    top: `${snapPosition(draggingNode.position.x, draggingNode.position.y, true).y + 80}px`,
                    borderStyle: 'solid'
                  }}
                />
              )}
            </div>
          )}
          {/* SVG for arrows */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0'
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>
            {renderEdges()}
          </svg>

          {/* Nodes */}
          <div 
            className="absolute inset-0"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0'
            }}
          >
            {(() => {
              // Calculate step numbers once for all nodes based on current Y positions
              const sorted = getSortedNodes();
              const stepNumberMap = new Map<string, number>();
              sorted.forEach((node, index) => {
                stepNumberMap.set(node.id, index + 1);
              });
              
              return nodes.map((node) => {
                const stepNumber = stepNumberMap.get(node.id) || 0;
                const nodeWithStep = { ...node, stepNumber };
                
                return (
                  <NodeComponent
                    key={node.id}
                    node={nodeWithStep}
                    isSelected={selectedNode?.id === node.id}
                    onClick={() => {
                      // Find the latest node data from nodes array to ensure we have current state
                      const latestNode = nodes.find(n => n.id === node.id);
                      setSelectedNode(latestNode || node);
                    }}
                    onDragStart={(e) => handleNodeDragStart(node, e)}
                  />
                );
              });
            })()}
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 border border-gray-200 dark:border-gray-700">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              title="Reset View"
            >
              <span className="text-xs">{Math.round(zoom * 100)}%</span>
            </Button>
          </div>

          {/* Instructions */}
          <Card className="absolute top-4 right-4">
            <CardContent className="p-3">
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex items-center gap-2">
                  <Move className="h-3 w-3" />
                  <span>Drag nodes to move • Drag canvas to pan</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="h-3 w-3" />
                  <span>Click nodes to edit properties</span>
                </div>
                <div className="flex items-center gap-2">
                  <ArrowUp className="h-3 w-3" />
                  <span>Use ↑/↓ buttons or Ctrl+↑/↓ to reorder</span>
                </div>
                <div className="flex items-center gap-2">
                  <Upload className="h-3 w-3" />
                  <span>Drop JSON files to import</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - Properties */}
        {selectedNode && (
          <div className="w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-gray-800 dark:text-gray-200">Properties</h3>
                  {selectedNode && (
                    <Badge variant="outline" className="text-xs">
                      Step {getNodeIndex(selectedNode.id) + 1} of {nodes.length}
                    </Badge>
                  )}
                </div>
                {selectedNode && (
                  <div className="flex items-center gap-2 mt-1">
                    {isNodeComplete(selectedNode) ? (
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Complete
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Incomplete
                      </Badge>
                    )}
                    {selectedNode.data.selector && (
                      <Badge variant="outline" className="text-xs">
                        Locator Set
                      </Badge>
                    )}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={copyNode}
                  title="Copy node (Ctrl+C)"
                  disabled={!selectedNode}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={pasteNode}
                  title="Paste node (Ctrl+V)"
                  disabled={!copiedNode}
                >
                  <FileText className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={moveNodeUp}
                  title="Move up (Ctrl+↑)"
                  disabled={!selectedNode || getNodeIndex(selectedNode.id) === 0}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={moveNodeDown}
                  title="Move down (Ctrl+↓)"
                  disabled={!selectedNode || getNodeIndex(selectedNode.id) >= nodes.length - 1}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={deleteNode}
                  title="Delete node (Delete/Backspace)"
                  disabled={!selectedNode}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label>Step Name</Label>
                <Input
                  value={selectedNode.data.label}
                  onChange={(e) => updateNodeData('label', e.target.value)}
                  className="mt-1"
                />
              </div>

              {['click', 'input', 'assert'].includes(selectedNode.data.type) && (
                <div>
                  <LocatorBuilder
                    key={selectedNode.id} // Force re-render when node changes
                    nodeType={selectedNode.data.type as 'click' | 'input' | 'assert'}
                    onLocatorGenerated={(locator) => {
                      updateNodeData('selector', locator);
                      toast.success('Locator updated!');
                    }}
                    currentLocator={selectedNode.data.selector || ''}
                    applicationType={applicationType}
                    elementData={selectedNode.data.elementData}
                  />
                </div>
              )}

              {selectedNode.data.type === 'input' && (
                <div>
                  <Label>Value</Label>
                  <Input
                    value={selectedNode.data.value || ''}
                    onChange={(e) => updateNodeData('value', e.target.value)}
                    className="mt-1"
                    placeholder="Text to enter"
                  />
                </div>
              )}

              {selectedNode.data.type === 'navigate' && (
                <div>
                  <Label>URL</Label>
                  <Input
                    type="url"
                    value={selectedNode.data.url || ''}
                    onChange={(e) => updateNodeData('url', e.target.value)}
                    className="mt-1"
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {selectedNode.data.type === 'wait' && (
                <div>
                  <Label>Duration (ms)</Label>
                  <Input
                    type="number"
                    value={selectedNode.data.value || 1000}
                    onChange={(e) => updateNodeData('value', e.target.value)}
                    className="mt-1"
                    placeholder="1000"
                  />
                </div>
              )}

              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Playwright Code Preview
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap">
                      {selectedNode.data.type === 'navigate' && (
                        <>
                          {`await page.goto('${selectedNode.data.url || 'https://example.com'}');\n`}
                          {`await page.waitForLoadState('networkidle');`}
                        </>
                      )}
                      {selectedNode.data.type === 'click' && (
                        <>
                          {selectedNode.data.selector ? (
                            `await ${selectedNode.data.selector}.click({ timeout: 10000 });`
                          ) : (
                            <span className="text-muted-foreground italic">// Use Locator Builder above to generate code</span>
                          )}
                        </>
                      )}
                      {selectedNode.data.type === 'input' && (
                        <>
                          {selectedNode.data.selector && selectedNode.data.value ? (
                            `await ${selectedNode.data.selector}.fill('${selectedNode.data.value}', { timeout: 10000 });`
                          ) : (
                            <span className="text-muted-foreground italic">// Complete locator and value to generate code</span>
                          )}
                        </>
                      )}
                      {selectedNode.data.type === 'wait' && (
                        `await page.waitForTimeout(${selectedNode.data.value || 1000});`
                      )}
                      {selectedNode.data.type === 'assert' && (
                        <>
                          {selectedNode.data.selector ? (
                            `await expect(${selectedNode.data.selector}).toBeVisible({ timeout: 10000 });`
                          ) : (
                            <span className="text-muted-foreground italic">// Use Locator Builder above to generate code</span>
                          )}
                        </>
                      )}
                    </pre>
                  </div>
                  {selectedNode.data.selector && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>Ready for export</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Workflow</DialogTitle>
            <DialogDescription>
              Import from Extension Recording, Flowstral session, or upload a JSON file
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Import Source</Label>
              <select
                value={importSource}
                onChange={(e) => setImportSource(e.target.value as 'flowstral' | 'file' | 'extension')}
                className="w-full mt-1 px-3 py-2 border rounded-lg"
              >
                <option value="extension">🔴 Extension Recording (Recommended)</option>
                <option value="flowstral">Flowstral Session</option>
                <option value="file">JSON File</option>
              </select>
            </div>
            {importSource === 'extension' ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg">
                  <h4 className="font-semibold text-purple-900 mb-2">📱 How to Import from Extension:</h4>
                  <ol className="text-sm text-purple-800 space-y-2 list-decimal list-inside">
                    <li>Open the <strong>Flowstral Recorder</strong> extension sidebar</li>
                    <li>Record your actions on any website</li>
                    <li>Click the <strong>"Copy Actions"</strong> or export button</li>
                    <li>Paste the JSON here below</li>
                  </ol>
                </div>
                
                <div>
                  <Label>Paste Recorded Actions (JSON)</Label>
                  <Textarea
                    value={extensionActions}
                    onChange={(e) => setExtensionActions(e.target.value)}
                    placeholder={`[
  {"type": "navigate", "url": "https://example.com", "description": "Navigate to page"},
  {"type": "click", "description": "Click 'Login'", "selector": {"selector": "button.login"}},
  {"type": "fill", "value": "user@email.com", "description": "Enter email"}
]`}
                    className="mt-1 font-mono text-xs h-48"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: You can also paste the actions array from your browser's developer console
                  </p>
                </div>
                
                <Button
                  onClick={importFromExtension}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  disabled={loading || !extensionActions.trim()}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Import Recording to Workflow
                    </>
                  )}
                </Button>
              </div>
            ) : importSource === 'flowstral' ? (
              <div className="space-y-4">
                <div>
                  <Label>Flowstral Session ID</Label>
                  <Input
                    value={importSessionId || sessionId || ''}
                    onChange={(e) => setImportSessionId(e.target.value)}
                    placeholder="e.g., abc123-def456-ghi789"
                    className="mt-1"
                  />
                  <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-900 mb-1">💡 Where to find your Session ID:</p>
                    <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
                      <li>Go to <strong>Trace (Flowstral)</strong> page → <strong>Sessions</strong> tab</li>
                      <li>Click on a session to see its ID (shown as badge or in details)</li>
                      <li>Or copy from URL when clicking "Open Workflow Editor" button</li>
                      <li>Session ID looks like: <code className="bg-blue-100 px-1 rounded">abc123-def456-ghi789</code></li>
                    </ul>
                  </div>
                </div>
                
                {/* Show available sessions */}
                {availableSessions.length > 0 && (
                  <div>
                    <Label>Or select from recent sessions:</Label>
                    <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-2">
                      {availableSessions.slice(0, 10).map((s: any) => (
                        <div
                          key={s.session_id}
                          className="flex items-center justify-between p-2 border rounded-lg hover:bg-muted cursor-pointer transition-colors"
                          onClick={() => {
                            setImportSessionId(s.session_id);
                            loadFromFlowstral(s.session_id);
                          }}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-mono truncate">
                              {s.session_id}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {s.start_timestamp ? new Date(s.start_timestamp).toLocaleString() : 'Unknown date'}
                              {s.node_count ? ` • ${s.node_count} nodes` : ''}
                              {s.is_active ? ' • Active' : ' • Completed'}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              setImportSessionId(s.session_id);
                            }}
                          >
                            Use
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button
                  onClick={() => loadFromFlowstral()}
                  className="w-full"
                  disabled={loading || (!importSessionId && !sessionId)}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Load from Flowstral
                    </>
                  )}
                </Button>
                
                {loadingSessions && (
                  <div className="text-center py-2">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                    <p className="text-xs text-muted-foreground mt-1">Loading sessions...</p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <Label>Upload JSON File</Label>
                <Input
                  type="file"
                  accept=".json"
                  onChange={importWorkflow}
                  className="mt-1"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImportDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Script Viewer & Test Runner Dialog */}
      <Dialog open={showScriptViewer} onOpenChange={setShowScriptViewer}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Generated Playwright Script</DialogTitle>
            <DialogDescription>
              Review the generated script and run it to verify it works
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="outline">
                {nodes.length} steps • {generatedScript.split('\n').length} lines
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedScript);
                  toast.success('Script copied to clipboard!');
                }}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy
              </Button>
            </div>
            
            <div className="bg-muted p-4 rounded-lg border">
              <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {generatedScript || generateFullScript()}
              </pre>
            </div>

            <TestRunner 
              script={generatedScript || generateFullScript()} 
              workflowName={workflowName}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

