/**
 * RequestChainBuilder - Visual step-by-step API test flow builder.
 * Like ReadyAPI TestSuites: chain requests with variable extraction,
 * assertions, and conditional flow control.
 */

import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Play, Save, Loader2, Trash2, ArrowDownToLine,
  Link2, Workflow, Variable, AlertCircle, Download,
  FolderOpen, FileText,
} from "lucide-react";
import ChainStepCard from "./ChainStepCard";
import ChainResultsView from "./ChainResultsView";
import {
  API_BASE_URL,
  type ChainStep,
  type ChainResult,
  type RequestConfig,
  type AssertionConfig,
  createEmptyChainStep,
  generateId,
} from "./constants";

interface SavedChain {
  id: string;
  name: string;
  steps: ChainStep[];
  savedAt: string;
}

export default function RequestChainBuilder() {
  const { toast } = useToast();
  const [chainName, setChainName] = useState("New Test Chain");
  const [chainId, setChainId] = useState(() => `chain_${Date.now()}`);
  const [steps, setSteps] = useState<ChainStep[]>([createEmptyChainStep(1)]);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ChainResult | null>(null);
  const [variables, setVariables] = useState<Record<string, any>>({});
  const [showVariables, setShowVariables] = useState(false);
  const [savedChains, setSavedChains] = useState<SavedChain[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("api_saved_chains") || "[]");
    } catch (err) { console.warn('[RequestChainBuilder] Failed to load saved chains:', err); return []; }
  });
  const [showSaved, setShowSaved] = useState(false);

  // Refs for variable input fields (replaces document.getElementById anti-pattern)
  const newVarNameRef = useRef<HTMLInputElement>(null);
  const newVarValueRef = useRef<HTMLInputElement>(null);

  // --- Step management ---
  const addStep = () => {
    setSteps([...steps, createEmptyChainStep(steps.length + 1)]);
  };

  const updateStep = (index: number, updated: ChainStep) => {
    const newSteps = [...steps];
    newSteps[index] = updated;
    setSteps(newSteps);
  };

  const removeStep = (index: number) => {
    if (steps.length <= 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const moveStep = (fromIndex: number, direction: "up" | "down") => {
    const toIndex = direction === "up" ? fromIndex - 1 : fromIndex + 1;
    if (toIndex < 0 || toIndex >= steps.length) return;
    const newSteps = [...steps];
    [newSteps[fromIndex], newSteps[toIndex]] = [newSteps[toIndex], newSteps[fromIndex]];
    setSteps(newSteps);
  };

  const addRequestToChain = useCallback((request: RequestConfig, assertions: AssertionConfig[]) => {
    const newStep = createEmptyChainStep(steps.length + 1);
    newStep.request = { ...request };
    newStep.assertions = [...assertions];
    newStep.name = `Step ${steps.length + 1} - ${request.method} ${request.url.split("/").pop() || "request"}`;
    setSteps([...steps, newStep]);
    toast({ title: "Step Added", description: `Added to chain as step ${steps.length + 1}` });
  }, [steps, toast]);

  // --- Convert to backend format ---
  const buildBackendPayload = () => {
    return {
      chain_id: chainId,
      name: chainName,
      steps: steps.filter(s => s.enabled).map(s => {
        // Build headers including auth
        const headers: Record<string, string> = {};
        s.request.headers.forEach(h => {
          if (h.enabled && h.key.trim()) headers[h.key.trim()] = h.value;
        });
        if (s.request.authType === "bearer" && s.request.authToken) {
          headers["Authorization"] = `Bearer ${s.request.authToken}`;
        } else if (s.request.authType === "basic" && s.request.authUsername) {
          headers["Authorization"] = `Basic ${btoa(`${s.request.authUsername}:${s.request.authPassword}`)}`;
        }

        return {
          id: s.id,
          name: s.name,
          method: s.request.method,
          url: s.request.url,
          headers,
          body: s.request.bodyType !== "none" && s.request.body.trim() ? s.request.body : null,
          body_type: s.request.bodyType,
          timeout: 30,
          extractions: s.extractions.map(e => ({
            name: e.name,
            method: e.method,
            expression: e.expression,
            default_value: e.defaultValue || null,
          })),
          assertions: s.assertions.map(a => ({
            source: a.path || `${s.id}_${a.type}`,
            operator: a.operator,
            expected: a.type === "status_code" ? parseInt(a.expected) || 200
              : a.type === "response_time" ? parseInt(a.expected) || 1000
              : a.expected,
            message: `${a.type}: expected ${a.operator} ${a.expected}`,
            stop_on_failure: false,
          })),
          conditions: s.conditions.map(c => ({
            source: c.source,
            operator: c.operator,
            expected: c.expected,
            goto_step: c.gotoStep || null,
            skip_step: c.skipStep || null,
          })),
          retry_on_failure: s.retryOnFailure,
          retry_count: s.retryCount,
          retry_delay: 1.0,
          delay_before: s.delayBefore,
          enabled: s.enabled,
        };
      }),
    };
  };

  // --- Execute chain ---
  const handleExecute = async () => {
    const enabledSteps = steps.filter(s => s.enabled);
    if (enabledSteps.length === 0) {
      toast({ title: "Error", description: "No enabled steps to execute", variant: "destructive" });
      return;
    }

    // Validate all steps have URLs
    const emptyUrls = enabledSteps.filter(s => !s.request.url.trim());
    if (emptyUrls.length > 0) {
      toast({ title: "Error", description: `${emptyUrls.length} step(s) have empty URLs`, variant: "destructive" });
      return;
    }

    setExecuting(true);
    setResult(null);

    try {
      // First, create the chain
      const payload = buildBackendPayload();
      const createResp = await fetch(`${API_BASE_URL}/api/request-chain/chains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!createResp.ok) {
        const errData = await createResp.json().catch(() => ({}));
        throw new Error(errData.detail || `Failed to create chain: ${createResp.statusText}`);
      }

      // Set initial variables
      if (Object.keys(variables).length > 0) {
        await fetch(`${API_BASE_URL}/api/request-chain/variables`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variables }),
        });
      }

      // Execute the chain
      const execResp = await fetch(`${API_BASE_URL}/api/request-chain/chains/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chain_id: chainId,
          variables,
        }),
      });

      if (!execResp.ok) {
        const errData = await execResp.json().catch(() => ({}));
        throw new Error(errData.detail || `Execution failed: ${execResp.statusText}`);
      }

      const data = await execResp.json();
      if (data.result) {
        setResult(data.result);
        // Update variables from result
        if (data.result.final_variables) {
          setVariables(prev => ({ ...prev, ...data.result.final_variables }));
        }
        const chainPassed = data.result.status === "passed" || data.result.status === "success";
        toast({
          title: chainPassed ? "Chain Passed" : "Chain Failed",
          description: `${data.result.passed_steps}/${data.result.total_steps} steps passed in ${Math.round(data.result.total_duration_ms)}ms`,
          variant: chainPassed ? "default" : "destructive",
        });
      }
    } catch (err: any) {
      toast({ title: "Execution Error", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  // --- Save/Load ---
  const saveChain = () => {
    const saved: SavedChain = {
      id: chainId,
      name: chainName,
      steps: [...steps],
      savedAt: new Date().toISOString(),
    };
    const existing = savedChains.filter(c => c.id !== chainId);
    const updated = [...existing, saved];
    setSavedChains(updated);
    localStorage.setItem("api_saved_chains", JSON.stringify(updated));
    toast({ title: "Chain Saved", description: `"${chainName}" saved locally` });
  };

  const loadChain = (saved: SavedChain) => {
    setChainId(saved.id);
    setChainName(saved.name);
    setSteps(saved.steps);
    setResult(null);
    setShowSaved(false);
    toast({ title: "Chain Loaded", description: `Loaded "${saved.name}"` });
  };

  const deleteChain = (id: string) => {
    const updated = savedChains.filter(c => c.id !== id);
    setSavedChains(updated);
    localStorage.setItem("api_saved_chains", JSON.stringify(updated));
  };

  const newChain = () => {
    setChainId(`chain_${Date.now()}`);
    setChainName("New Test Chain");
    setSteps([createEmptyChainStep(1)]);
    setResult(null);
    setVariables({});
  };

  const exportChainJSON = () => {
    const payload = buildBackendPayload();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chainName.replace(/\s+/g, "_").toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allStepIds = steps.map(s => ({ id: s.id, name: s.name || `Step ${steps.indexOf(s) + 1}` }));

  return (
    <div className="space-y-4">
      {/* Chain header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Workflow className="w-5 h-5 text-primary" />
            <Input
              className="flex-1 text-lg font-semibold border-none shadow-none focus-visible:ring-0 p-0 h-auto"
              value={chainName}
              onChange={e => setChainName(e.target.value)}
              placeholder="Chain name"
            />

            <Badge variant="secondary">
              {steps.length} step{steps.length !== 1 ? "s" : ""}
            </Badge>

            <div className="flex gap-1">
              <Button variant="outline" size="sm" onClick={() => setShowSaved(!showSaved)} title="Saved chains">
                <FolderOpen className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={newChain} title="New chain">
                <FileText className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={saveChain} title="Save chain">
                <Save className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={exportChainJSON} title="Export JSON">
                <Download className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowVariables(!showVariables)}
                title="Variables"
              >
                <Variable className="w-4 h-4" />
                {Object.keys(variables).length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-xs">
                    {Object.keys(variables).length}
                  </Badge>
                )}
              </Button>
            </div>

            <Button
              onClick={handleExecute}
              disabled={executing || steps.filter(s => s.enabled).length === 0}
              className="bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 min-w-[130px]"
            >
              {executing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run Chain
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Saved chains panel */}
      {showSaved && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Saved Chains ({savedChains.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {savedChains.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No saved chains yet.</p>
            ) : (
              <div className="space-y-1">
                {savedChains.map(c => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer group"
                    onClick={() => loadChain(c)}
                  >
                    <Workflow className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium flex-1">{c.name}</span>
                    <Badge variant="secondary" className="text-xs">{c.steps.length} steps</Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(c.savedAt).toLocaleDateString()}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                      onClick={e => { e.stopPropagation(); deleteChain(c.id); }}
                    >
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Variables panel */}
      {showVariables && (
        <Card className="border-blue-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Variable className="w-4 h-4" />
              Initial Variables
            </CardTitle>
            <CardDescription className="text-xs">
              Set variables before chain execution. Use <code className="bg-muted px-1 rounded">{"${name}"}</code> in step URLs, headers, and body.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(variables).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Input
                  className="flex-1 h-7 text-xs font-mono"
                  value={key}
                  readOnly
                />
                <Input
                  className="flex-1 h-7 text-xs font-mono"
                  value={String(value)}
                  onChange={e => setVariables({ ...variables, [key]: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    const newVars = { ...variables };
                    delete newVars[key];
                    setVariables(newVars);
                  }}
                >
                  <Trash2 className="w-3 h-3 text-red-500" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                className="flex-1 h-7 text-xs"
                placeholder="Variable name"
                ref={newVarNameRef}
              />
              <Input
                className="flex-1 h-7 text-xs"
                placeholder="Value"
                ref={newVarValueRef}
              />
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const nameEl = newVarNameRef.current;
                  const valueEl = newVarValueRef.current;
                  if (nameEl?.value.trim()) {
                    setVariables({ ...variables, [nameEl.value.trim()]: valueEl?.value || "" });
                    nameEl.value = "";
                    if (valueEl) valueEl.value = "";
                  }
                }}
              >
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Steps */}
      <div className="space-y-2">
        {steps.map((step, idx) => (
          <div key={step.id}>
            <ChainStepCard
              step={step}
              index={idx}
              totalSteps={steps.length}
              allStepIds={allStepIds}
              onChange={updated => updateStep(idx, updated)}
              onRemove={() => removeStep(idx)}
              onMoveUp={() => moveStep(idx, "up")}
              onMoveDown={() => moveStep(idx, "down")}
              result={result?.step_results?.find(r => r.step_id === step.id)}
            />
            {idx < steps.length - 1 && (
              <div className="flex justify-center py-1">
                <div className="w-px h-4 bg-border" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add step button */}
      <Button variant="outline" className="w-full border-dashed" onClick={addStep}>
        <Plus className="w-4 h-4 mr-2" />
        Add Step
      </Button>

      {/* Hint */}
      {steps.length === 1 && !steps[0].request.url && (
        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Link2 className="h-4 w-4 text-blue-500" />
          <AlertDescription className="text-sm">
            <strong>Tip:</strong> Build a multi-step test flow. For example: Login (extract token) → Get Profile (use token) → Update Profile → Verify Update.
            Use <code className="bg-muted px-1 rounded">{"${variable}"}</code> syntax to pass data between steps.
          </AlertDescription>
        </Alert>
      )}

      {/* Chain Results */}
      {result && <ChainResultsView result={result} />}
    </div>
  );
}
