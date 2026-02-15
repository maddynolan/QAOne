/**
 * @module platform
 * @page DataDependencyGraph
 *
 * Data flow dependency visualization page. Displays a graph of data
 * dependencies between test cases, API endpoints, databases, and
 * environments to identify impact analysis paths.
 *
 * @features
 * - Interactive dependency graph visualization
 * - Node-level detail inspection
 * - Impact analysis for changes
 * - Dependency path tracing
 * - Filter by dependency type and module
 *
 * @dependencies DataDependencyGraph uses useState, useMemo, shadcn/ui Card, Badge, useToast
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { 
  GitBranch, ArrowRight, Play, Eye, ChevronDown, ChevronRight,
  Lock, Key, Hash, Link2, Plus
} from "lucide-react";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RequestNode {
  id: string;
  name: string;
  method: string;
  endpoint: string;
  description?: string;
  extractions: Extraction[];
  dependencies: string[];
  injections: Injection[];
}

interface Extraction {
  variableName: string;
  source: "json" | "header" | "cookie" | "regex";
  expression: string;
}

interface Injection {
  target: "header" | "body" | "url" | "query";
  location: string;
  variableName: string;
}

interface DataFlow {
  from: string;
  to: string;
  variable: string;
  type: "token" | "id" | "session" | "data";
}

const MOCK_NODES: RequestNode[] = [
  {
    id: "login", name: "Login", method: "POST", endpoint: "/api/auth/login",
    description: "Authenticate user and get access token",
    extractions: [
      { variableName: "access_token", source: "json", expression: "$.token" },
      { variableName: "user_id", source: "json", expression: "$.user.id" },
      { variableName: "session_id", source: "cookie", expression: "session" }
    ],
    dependencies: [], injections: []
  },
  {
    id: "get_profile", name: "Get Profile", method: "GET", endpoint: "/api/users/{user_id}",
    description: "Get current user profile",
    extractions: [
      { variableName: "email", source: "json", expression: "$.email" },
      { variableName: "cart_id", source: "json", expression: "$.cart_id" }
    ],
    dependencies: ["login"],
    injections: [
      { target: "header", location: "Authorization", variableName: "access_token" },
      { target: "url", location: "user_id", variableName: "user_id" }
    ]
  },
  {
    id: "list_products", name: "List Products", method: "GET", endpoint: "/api/products",
    description: "Get available products",
    extractions: [
      { variableName: "first_product_id", source: "json", expression: "$.products[0].id" },
      { variableName: "product_price", source: "json", expression: "$.products[0].price" }
    ],
    dependencies: ["login"],
    injections: [{ target: "header", location: "Authorization", variableName: "access_token" }]
  },
  {
    id: "add_to_cart", name: "Add to Cart", method: "POST", endpoint: "/api/cart/items",
    description: "Add product to shopping cart",
    extractions: [{ variableName: "cart_item_id", source: "json", expression: "$.item_id" }],
    dependencies: ["get_profile", "list_products"],
    injections: [
      { target: "header", location: "Authorization", variableName: "access_token" },
      { target: "body", location: "$.product_id", variableName: "first_product_id" },
      { target: "body", location: "$.cart_id", variableName: "cart_id" }
    ]
  },
  {
    id: "checkout", name: "Checkout", method: "POST", endpoint: "/api/orders",
    description: "Create order from cart",
    extractions: [
      { variableName: "order_id", source: "json", expression: "$.order_id" },
      { variableName: "order_status", source: "json", expression: "$.status" }
    ],
    dependencies: ["add_to_cart"],
    injections: [
      { target: "header", location: "Authorization", variableName: "access_token" },
      { target: "body", location: "$.cart_id", variableName: "cart_id" }
    ]
  },
  {
    id: "get_order", name: "Get Order Details", method: "GET", endpoint: "/api/orders/{order_id}",
    description: "Verify order was created",
    extractions: [],
    dependencies: ["checkout"],
    injections: [
      { target: "header", location: "Authorization", variableName: "access_token" },
      { target: "url", location: "order_id", variableName: "order_id" }
    ]
  }
];

const METHOD_COLORS: Record<string, string> = {
  GET: "bg-green-500", POST: "bg-blue-500", PUT: "bg-amber-500", PATCH: "bg-purple-500", DELETE: "bg-red-500",
};

const VAR_COLORS: Record<string, string> = {
  token: "text-yellow-600 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30",
  id: "text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/30",
  session: "text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/30",
  data: "text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/30",
};

function getVarType(varName: string): string {
  if (varName.includes("token") || varName.includes("auth")) return "token";
  if (varName.includes("id")) return "id";
  if (varName.includes("session")) return "session";
  return "data";
}

export default function DataDependencyGraph() {
  const { toast } = useToast();
  const { theme } = useTheme();
  const [nodes] = useState<RequestNode[]>(MOCK_NODES);
  const [selectedNode, setSelectedNode] = useState<RequestNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(["login"]));

  const dataFlows = useMemo(() => {
    const flows: DataFlow[] = [];
    nodes.forEach(node => {
      node.injections.forEach(injection => {
        const sourceNode = nodes.find(n => n.extractions.some(e => e.variableName === injection.variableName));
        if (sourceNode) {
          flows.push({ from: sourceNode.id, to: node.id, variable: injection.variableName, type: getVarType(injection.variableName) as any });
        }
      });
    });
    return flows;
  }, [nodes]);

  const flowsByTarget = useMemo(() => {
    const grouped: Record<string, DataFlow[]> = {};
    dataFlows.forEach(flow => {
      if (!grouped[flow.to]) grouped[flow.to] = [];
      grouped[flow.to].push(flow);
    });
    return grouped;
  }, [dataFlows]);

  const nodeLevels = useMemo(() => {
    const levels: Record<string, number> = {};
    const visited = new Set<string>();
    function calculateLevel(nodeId: string): number {
      if (visited.has(nodeId)) return levels[nodeId] || 0;
      visited.add(nodeId);
      const node = nodes.find(n => n.id === nodeId);
      if (!node || node.dependencies.length === 0) { levels[nodeId] = 0; return 0; }
      const maxDepLevel = Math.max(...node.dependencies.map(dep => calculateLevel(dep)));
      levels[nodeId] = maxDepLevel + 1;
      return levels[nodeId];
    }
    nodes.forEach(n => calculateLevel(n.id));
    return levels;
  }, [nodes]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const renderNode = (node: RequestNode) => {
    const level = nodeLevels[node.id] || 0;
    const isExpanded = expandedNodes.has(node.id);
    const incomingFlows = flowsByTarget[node.id] || [];

    return (
      <div key={node.id} className="relative" style={{ marginLeft: `${level * 60}px` }}>
        <Card 
          className={cn("cursor-pointer transition-all hover:shadow-md", selectedNode?.id === node.id && "ring-2 ring-primary")}
          onClick={() => setSelectedNode(node)}
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Badge className={cn(METHOD_COLORS[node.method], "text-white font-mono shrink-0")}>{node.method}</Badge>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold">{node.name}</h4>
                  <button onClick={(e) => { e.stopPropagation(); toggleExpand(node.id); }}>
                    {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
                <code className="text-xs text-muted-foreground font-mono block truncate">{node.endpoint}</code>
                {node.description && <p className="text-xs text-muted-foreground mt-1">{node.description}</p>}
                
                {incomingFlows.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {incomingFlows.map((flow, idx) => (
                      <Badge key={idx} variant="outline" className={cn("text-xs", VAR_COLORS[flow.type])}>
                        <ArrowRight className="w-3 h-3 mr-1" />{flow.variable}
                      </Badge>
                    ))}
                  </div>
                )}
                
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {node.extractions.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Extracts:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {node.extractions.map((ext, idx) => (
                            <Badge key={idx} className={cn("text-xs", VAR_COLORS[getVarType(ext.variableName)])}>
                              <Key className="w-3 h-3 mr-1" />{ext.variableName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {node.injections.length > 0 && (
                      <div>
                        <Label className="text-xs text-muted-foreground">Uses:</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {node.injections.map((inj, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              <Hash className="w-3 h-3 mr-1" />{inj.variableName} → {inj.target}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const nodesByLevel = useMemo(() => {
    const grouped: Record<number, RequestNode[]> = {};
    nodes.forEach(node => {
      const level = nodeLevels[node.id] || 0;
      if (!grouped[level]) grouped[level] = [];
      grouped[level].push(node);
    });
    return grouped;
  }, [nodes, nodeLevels]);

  return (
    <div className={cn("min-h-screen overflow-auto", theme === 'light' ? "bg-gray-50" : "bg-background")}>
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <GitBranch className="w-6 h-6 text-purple-500" />
              Data Dependency Graph
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Visualize how data flows between API requests through variable extraction and injection
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline"><Plus className="w-4 h-4 mr-2" />Add Request</Button>
            <Button><Play className="w-4 h-4 mr-2" />Run Chain</Button>
          </div>
        </div>

        {/* Legend */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-6 flex-wrap">
              <span className="text-sm text-muted-foreground">Variable Types:</span>
              {Object.entries(VAR_COLORS).map(([type, color]) => (
                <Badge key={type} className={cn("capitalize", color)}>
                  {type === "token" && <Lock className="w-3 h-3 mr-1" />}
                  {type === "id" && <Hash className="w-3 h-3 mr-1" />}
                  {type === "session" && <Key className="w-3 h-3 mr-1" />}
                  {type === "data" && <Link2 className="w-3 h-3 mr-1" />}
                  {type}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Graph View */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Request Flow</CardTitle>
                <CardDescription>Click a request to see details • Data flows left to right</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4 pr-4">
                    {Object.entries(nodesByLevel)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([level, levelNodes]) => (
                        <div key={level} className="space-y-3">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">Step {Number(level) + 1}</Badge>
                            {Number(level) > 0 && <div className="flex-1 h-px bg-border" />}
                          </div>
                          <div className="grid gap-3">
                            {levelNodes.map(node => renderNode(node))}
                          </div>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Details Panel */}
          <div>
            <Card className="sticky top-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="w-5 h-5" />
                  {selectedNode ? selectedNode.name : "Select a Request"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedNode ? (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-4 pr-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Endpoint</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={cn(METHOD_COLORS[selectedNode.method], "text-white")}>{selectedNode.method}</Badge>
                          <code className="text-sm">{selectedNode.endpoint}</code>
                        </div>
                      </div>
                      {selectedNode.description && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Description</Label>
                          <p className="text-sm mt-1">{selectedNode.description}</p>
                        </div>
                      )}
                      {selectedNode.dependencies.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Depends On</Label>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedNode.dependencies.map(dep => {
                              const depNode = nodes.find(n => n.id === dep);
                              return (
                                <Badge key={dep} variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => setSelectedNode(depNode || null)}>
                                  {depNode?.name || dep}
                                </Badge>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      <div>
                        <Label className="text-xs text-muted-foreground">Extractions ({selectedNode.extractions.length})</Label>
                        {selectedNode.extractions.length === 0 ? (
                          <p className="text-sm text-muted-foreground mt-1">No variables extracted</p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            {selectedNode.extractions.map((ext, idx) => (
                              <div key={idx} className="p-2 bg-muted rounded text-sm">
                                <Badge className={VAR_COLORS[getVarType(ext.variableName)]}>{ext.variableName}</Badge>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  <span>{ext.source}:</span> <code>{ext.expression}</code>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Injections ({selectedNode.injections.length})</Label>
                        {selectedNode.injections.length === 0 ? (
                          <p className="text-sm text-muted-foreground mt-1">No variables injected</p>
                        ) : (
                          <div className="space-y-2 mt-2">
                            {selectedNode.injections.map((inj, idx) => (
                              <div key={idx} className="p-2 bg-muted rounded text-sm">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline">{inj.variableName}</Badge>
                                  <span className="text-xs text-muted-foreground">→ {inj.target}</span>
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground"><code>{inj.location}</code></div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a request node to view its data dependencies</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Summary Stats */}
        <Card>
          <CardContent className="py-4">
            <div className="grid grid-cols-4 gap-4 text-center">
              <div><p className="text-2xl font-bold">{nodes.length}</p><p className="text-sm text-muted-foreground">Requests</p></div>
              <div><p className="text-2xl font-bold text-blue-600">{dataFlows.length}</p><p className="text-sm text-muted-foreground">Data Flows</p></div>
              <div><p className="text-2xl font-bold text-yellow-600">{new Set(nodes.flatMap(n => n.extractions.map(e => e.variableName))).size}</p><p className="text-sm text-muted-foreground">Variables</p></div>
              <div><p className="text-2xl font-bold text-green-600">{Object.keys(nodeLevels).length > 0 ? Math.max(...Object.values(nodeLevels)) + 1 : 0}</p><p className="text-sm text-muted-foreground">Chain Depth</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
