/**
 * ResponseTreeExplorer - Browse response data tree and click-to-add assertions.
 * Shows all JSON nodes, headers, status in a collapsible tree.
 * Zero-code: click to assert, click to save as variable; breadcrumb shows nesting.
 */

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  ChevronDown, ChevronRight, Plus, Target, Hash, Copy,
  Search, CheckCircle2, Type, List, Braces, AlertCircle,
  Save, ChevronsRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type AssertionConfig, generateId } from "./constants";

interface ResponseTreeExplorerProps {
  responseBody: string;
  responseHeaders: Record<string, string>;
  responseStatus: number;
  responseTime: number;
  onAddAssertion: (assertion: AssertionConfig) => void;
  existingAssertions?: AssertionConfig[];
  /** Zero-code: save node value as variable for use in next request ({{name}}) */
  onSaveAsVariable?: (variableName: string, path: string, value: unknown) => void;
}

type JsonNodeType = "object" | "array" | "string" | "number" | "boolean" | "null";

interface TreeNode {
  key: string;
  path: string;       // JSONPath expression
  value: any;
  type: JsonNodeType;
  children?: TreeNode[];
  depth: number;
  arrayIndex?: number;
}

// Parse JSON body into a tree structure
function parseJsonTree(data: any, parentPath: string = "$", depth: number = 0): TreeNode[] {
  const nodes: TreeNode[] = [];

  if (data === null || data === undefined) {
    return [{ key: parentPath, path: parentPath, value: null, type: "null", depth }];
  }

  if (Array.isArray(data)) {
    data.forEach((item, idx) => {
      const path = `${parentPath}[${idx}]`;
      const type = getType(item);
      const node: TreeNode = {
        key: `[${idx}]`,
        path,
        value: item,
        type,
        depth,
        arrayIndex: idx,
      };
      if (type === "object" || type === "array") {
        node.children = parseJsonTree(item, path, depth + 1);
      }
      nodes.push(node);
    });
  } else if (typeof data === "object") {
    Object.entries(data).forEach(([key, val]) => {
      const path = `${parentPath}.${key}`;
      const type = getType(val);
      const node: TreeNode = {
        key,
        path,
        value: val,
        type,
        depth,
      };
      if (type === "object" || type === "array") {
        node.children = parseJsonTree(val, path, depth + 1);
      }
      nodes.push(node);
    });
  }

  return nodes;
}

function getType(val: any): JsonNodeType {
  if (val === null || val === undefined) return "null";
  if (Array.isArray(val)) return "array";
  return typeof val as JsonNodeType;
}

function getTypeColor(type: JsonNodeType): string {
  switch (type) {
    case "string": return "text-green-600 dark:text-green-400";
    case "number": return "text-blue-600 dark:text-blue-400";
    case "boolean": return "text-amber-600 dark:text-amber-400";
    case "null": return "text-gray-400";
    case "object": return "text-purple-600 dark:text-purple-400";
    case "array": return "text-orange-600 dark:text-orange-400";
    default: return "text-foreground";
  }
}

function getTypeIcon(type: JsonNodeType) {
  switch (type) {
    case "string": return <Type className="w-3 h-3" />;
    case "number": return <Hash className="w-3 h-3" />;
    case "boolean": return <CheckCircle2 className="w-3 h-3" />;
    case "object": return <Braces className="w-3 h-3" />;
    case "array": return <List className="w-3 h-3" />;
    default: return <AlertCircle className="w-3 h-3" />;
  }
}

function formatValue(val: any, type: JsonNodeType): string {
  if (type === "null") return "null";
  if (type === "string") return `"${String(val).length > 80 ? String(val).substring(0, 80) + "..." : val}"`;
  if (type === "object") return `{${Object.keys(val).length} keys}`;
  if (type === "array") return `[${val.length} items]`;
  return String(val);
}

// JSONPath to human breadcrumb (e.g. $.data.user.id → data › user › id)
function pathToBreadcrumb(path: string): string {
  if (!path || path === "$") return "root";
  const parts = path
    .replace(/^\$\.?/, "")
    .split(/\.(?![^\[]*\])/g)
    .map((p) => p.replace(/\[(\d+)\]/g, "[$1]"));
  return parts.join(" › ");
}

// Count all leaf nodes
function countLeafNodes(nodes: TreeNode[]): number {
  let count = 0;
  for (const n of nodes) {
    if (n.children) count += countLeafNodes(n.children);
    else count++;
  }
  return count;
}

// Flatten for search
function flattenNodes(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const n of nodes) {
    result.push(n);
    if (n.children) result.push(...flattenNodes(n.children));
  }
  return result;
}

export default function ResponseTreeExplorer({
  responseBody,
  responseHeaders,
  responseStatus,
  responseTime,
  onAddAssertion,
  existingAssertions = [],
  onSaveAsVariable,
}: ResponseTreeExplorerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["$"]));
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState<"body" | "headers" | "meta">("body");
  const [saveVarNode, setSaveVarNode] = useState<{ path: string; value: unknown } | null>(null);
  const [saveVarName, setSaveVarName] = useState("");

  // Parse the response body
  const bodyTree = useMemo(() => {
    try {
      const parsed = typeof responseBody === "string" ? JSON.parse(responseBody) : responseBody;
      return parseJsonTree(parsed);
    } catch {
      return [];
    }
  }, [responseBody]);

  const allNodes = useMemo(() => flattenNodes(bodyTree), [bodyTree]);
  const leafCount = useMemo(() => countLeafNodes(bodyTree), [bodyTree]);

  // Filter nodes by search
  const matchesSearch = (node: TreeNode): boolean => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      node.key.toLowerCase().includes(term) ||
      node.path.toLowerCase().includes(term) ||
      (node.type !== "object" && node.type !== "array" && String(node.value).toLowerCase().includes(term))
    );
  };

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const expandAll = () => {
    const allPaths = new Set(allNodes.filter(n => n.children).map(n => n.path));
    allPaths.add("$");
    setExpandedPaths(allPaths);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(["$"]));
  };

  // Create assertion from a node (leaf or parent — parent gets "exists")
  const createAssertionFromNode = (node: TreeNode) => {
    const isParent = node.type === "object" || node.type === "array";
    const assertion: AssertionConfig = {
      id: generateId(),
      type: "jsonpath",
      name: isParent ? `Assert ${node.key} exists` : `Assert ${node.key}`,
      path: node.path,
      operator: isParent ? "exists" : node.type === "string" || node.type === "number" ? "equals" : "exists",
      expected: isParent ? "" : node.type === "object" || node.type === "array" ? "" : String(node.value),
      schema: "",
    };
    onAddAssertion(assertion);
  };

  const handleSaveAsVariable = (node: TreeNode) => {
    setSaveVarNode({ path: node.path, value: node.value });
    setSaveVarName(node.key.replace(/[^a-zA-Z0-9_]/g, "_"));
  };

  const confirmSaveVariable = () => {
    if (!saveVarNode || !saveVarName.trim()) return;
    const name = saveVarName.trim().replace(/^\{+|\}+$/g, "");
    onSaveAsVariable?.(name, saveVarNode.path, saveVarNode.value);
    setSaveVarNode(null);
    setSaveVarName("");
  };

  // Create assertion for a header
  const createHeaderAssertion = (headerName: string, headerValue: string) => {
    const assertion: AssertionConfig = {
      id: generateId(),
      type: "header",
      name: `Assert header ${headerName}`,
      path: headerName,
      operator: "equals",
      expected: headerValue,
      schema: "",
    };
    onAddAssertion(assertion);
  };

  // Create assertion for status code
  const createStatusAssertion = () => {
    const assertion: AssertionConfig = {
      id: generateId(),
      type: "status_code",
      name: "Assert status code",
      path: "",
      operator: "equals",
      expected: String(responseStatus),
      schema: "",
    };
    onAddAssertion(assertion);
  };

  // Create assertion for response time
  const createTimeAssertion = () => {
    const assertion: AssertionConfig = {
      id: generateId(),
      type: "response_time",
      name: "Assert response time",
      path: "",
      operator: "less_than",
      expected: String(Math.max(responseTime * 2, 1000)),
      schema: "",
    };
    onAddAssertion(assertion);
  };

  // Check if an assertion already exists for a path
  const hasAssertion = (path: string) =>
    existingAssertions.some(a => a.path === path);

  // Render a tree node
  const renderNode = (node: TreeNode): JSX.Element | null => {
    if (!matchesSearch(node) && !node.children?.some(c => matchesSearch(c))) {
      // Show parent nodes if any child matches
      if (!node.children?.some(c => {
        const flat = flattenNodes([c]);
        return flat.some(matchesSearch);
      })) return null;
    }

    const isExpandable = !!node.children;
    const isExpanded = expandedPaths.has(node.path);
    const alreadyAsserted = hasAssertion(node.path);

    return (
      <div key={node.path}>
        <div
          className={`flex items-center gap-1 py-0.5 px-1 rounded hover:bg-muted/50 group text-sm ${
            alreadyAsserted ? "bg-green-500/5" : ""
          }`}
          style={{ paddingLeft: `${node.depth * 16 + 4}px` }}
        >
          {/* Expand/collapse toggle */}
          {isExpandable ? (
            <button className="w-4 h-4 flex-shrink-0" onClick={() => toggleExpand(node.path)}>
              {isExpanded
                ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
          ) : (
            <span className="w-4 flex-shrink-0" />
          )}

          {/* Type icon */}
          <span className={`flex-shrink-0 ${getTypeColor(node.type)}`}>
            {getTypeIcon(node.type)}
          </span>

          {/* Key */}
          <span className="font-mono text-xs font-medium text-foreground">
            {node.arrayIndex !== undefined ? `[${node.arrayIndex}]` : node.key}
          </span>
          <span className="text-muted-foreground text-xs">:</span>

          {/* Value */}
          <span className={`font-mono text-xs truncate flex-1 ${getTypeColor(node.type)}`}>
            {formatValue(node.value, node.type)}
          </span>

          {/* Breadcrumb (human path) - zero-code clarity */}
          <span className="hidden sm:inline text-[10px] text-muted-foreground truncate max-w-[120px]" title={node.path}>
            <ChevronsRight className="w-3 h-3 inline mr-0.5" />
            {pathToBreadcrumb(node.path)}
          </span>

          {/* Add assertion (any node: leaf = value assert, parent = exists) */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-5 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
              alreadyAsserted ? "text-green-500" : "text-primary"
            }`}
            onClick={() => createAssertionFromNode(node)}
            title={alreadyAsserted ? "Assertion exists - click to add another" : `Assert ${node.path}`}
          >
            {alreadyAsserted ? (
              <CheckCircle2 className="w-3 h-3" />
            ) : (
              <Plus className="w-3 h-3" />
            )}
          </Button>

          {/* Save as variable - zero-code store for next request */}
          {onSaveAsVariable && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 opacity-0 group-hover:opacity-100 transition-opacity text-amber-600"
              onClick={() => handleSaveAsVariable(node)}
              title={`Save as variable (use {{name}} in next request)`}
            >
              <Save className="w-3 h-3" />
            </Button>
          )}

          {/* Copy path */}
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => navigator.clipboard.writeText(node.path)}
            title={`JSONPath: ${node.path}`}
          >
            <Copy className="w-3 h-3 text-muted-foreground" />
          </Button>
        </div>

        {/* Children */}
        {isExpandable && isExpanded && node.children?.map(child => renderNode(child))}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          <Button
            variant={viewMode === "body" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode("body")}
          >
            <Braces className="w-3 h-3 mr-1" />
            Body ({leafCount})
          </Button>
          <Button
            variant={viewMode === "headers" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode("headers")}
          >
            Headers ({Object.keys(responseHeaders).length})
          </Button>
          <Button
            variant={viewMode === "meta" ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setViewMode("meta")}
          >
            <Target className="w-3 h-3 mr-1" />
            Quick Assert
          </Button>
        </div>

        <div className="flex-1" />

        {viewMode === "body" && (
          <>
            <div className="relative w-48">
              <Search className="absolute left-2 top-1.5 w-3 h-3 text-muted-foreground" />
              <Input
                className="h-7 text-xs pl-7"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={expandAll}>
              Expand All
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={collapseAll}>
              Collapse
            </Button>
          </>
        )}
      </div>

      {/* Body Tree */}
      {viewMode === "body" && (
        <ScrollArea className="h-[350px] border rounded-lg p-2 bg-muted/20">
          {bodyTree.length > 0 ? (
            <div>
              {/* Root indicator */}
              <div className="flex items-center gap-1 py-0.5 px-1 text-xs text-muted-foreground mb-1">
                <button onClick={() => toggleExpand("$")} className="w-4 h-4">
                  {expandedPaths.has("$")
                    ? <ChevronDown className="w-3.5 h-3.5" />
                    : <ChevronRight className="w-3.5 h-3.5" />}
                </button>
                <Braces className="w-3 h-3" />
                <span className="font-mono">$ (root)</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1">
                  {allNodes.length} nodes
                </Badge>
              </div>
              {expandedPaths.has("$") && bodyTree.map(node => renderNode(node))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <AlertCircle className="w-8 h-8 mb-2 opacity-30" />
              <p className="text-sm">Response is not valid JSON</p>
              <p className="text-xs">Tree view requires a JSON response body</p>
            </div>
          )}
        </ScrollArea>
      )}

      {/* Headers View */}
      {viewMode === "headers" && (
        <ScrollArea className="h-[350px] border rounded-lg p-2 bg-muted/20">
          <div className="space-y-0.5">
            {Object.entries(responseHeaders).map(([name, value]) => (
              <div
                key={name}
                className="flex items-center gap-2 py-1 px-2 rounded hover:bg-muted/50 group"
              >
                <span className="font-mono text-xs font-medium text-primary min-w-[160px] truncate">{name}</span>
                <span className="font-mono text-xs text-muted-foreground flex-1 truncate">{value}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-1 opacity-0 group-hover:opacity-100"
                  onClick={() => createHeaderAssertion(name, value)}
                  title={`Assert header "${name}" equals "${value}"`}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {Object.keys(responseHeaders).length === 0 && (
              <p className="text-center text-xs text-muted-foreground py-8">No headers available</p>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Quick Assert Panel */}
      {viewMode === "meta" && (
        <div className="border rounded-lg p-4 bg-muted/20 space-y-3">
          <p className="text-xs text-muted-foreground mb-3">
            Click to instantly add common assertions based on this response:
          </p>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={createStatusAssertion}
            >
              <Hash className="w-4 h-4 mr-2 text-green-500" />
              <span className="flex-1 text-left">Status = {responseStatus}</span>
              <Badge variant="secondary" className="text-xs">status_code</Badge>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="justify-start"
              onClick={createTimeAssertion}
            >
              <Target className="w-4 h-4 mr-2 text-blue-500" />
              <span className="flex-1 text-left">Time &lt; {Math.max(responseTime * 2, 1000)}ms</span>
              <Badge variant="secondary" className="text-xs">response_time</Badge>
            </Button>

            {/* Auto-suggest assertions for common patterns in body */}
            {bodyTree.length > 0 && (() => {
              const suggestions: { path: string; key: string; value: any; type: JsonNodeType }[] = [];
              const addSuggestion = (node: TreeNode) => {
                if (suggestions.length >= 8) return;
                if (!node.children && node.type !== "null") {
                  suggestions.push({ path: node.path, key: node.key, value: node.value, type: node.type });
                }
                if (node.children && suggestions.length < 8) {
                  // Only first few children of first level
                  node.children.slice(0, 3).forEach(addSuggestion);
                }
              };
              bodyTree.slice(0, 5).forEach(addSuggestion);

              return suggestions.map(s => (
                <Button
                  key={s.path}
                  variant="outline"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    onAddAssertion({
                      id: generateId(),
                      type: "jsonpath",
                      name: `Assert ${s.key}`,
                      path: s.path,
                      operator: "equals",
                      expected: String(s.value),
                      schema: "",
                    });
                  }}
                >
                  <span className={`mr-2 ${getTypeColor(s.type)}`}>{getTypeIcon(s.type)}</span>
                  <span className="flex-1 text-left truncate font-mono text-xs">
                    {s.key} = {String(s.value).substring(0, 30)}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">jsonpath</Badge>
                </Button>
              ));
            })()}
          </div>

          {/* Bulk add all first-level fields */}
          {bodyTree.length > 0 && (
            <div className="pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  let count = 0;
                  bodyTree.forEach(node => {
                    if (!node.children && node.type !== "null") {
                      onAddAssertion({
                        id: generateId(),
                        type: "jsonpath",
                        name: `Assert ${node.key}`,
                        path: node.path,
                        operator: "equals",
                        expected: String(node.value),
                        schema: "",
                      });
                      count++;
                    }
                  });
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Assert All Top-Level Fields ({bodyTree.filter(n => !n.children).length})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Save as variable dialog (zero-code) */}
      <Dialog open={!!saveVarNode} onOpenChange={(open) => !open && setSaveVarNode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save as variable</DialogTitle>
            <DialogDescription>
              Use in next request or chain as <code className="bg-muted px-1 rounded">{`{{variable_name}}`}</code>. Path: {saveVarNode?.path}
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Variable name (e.g. user_id)"
            value={saveVarName}
            onChange={(e) => setSaveVarName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && confirmSaveVariable()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveVarNode(null)}>Cancel</Button>
            <Button onClick={confirmSaveVariable} disabled={!saveVarName.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
