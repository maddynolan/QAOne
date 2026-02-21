/**
 * ChainResultsView - Waterfall display of chain execution results.
 * Shows step-by-step pass/fail, timings, extracted values, assertion results,
 * and collapsible response body + headers per step.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CheckCircle2, XCircle, Clock, ArrowDownToLine, SkipForward,
  AlertTriangle, ChevronDown, ChevronRight, Copy, FileJson, FileText,
} from "lucide-react";
import type { ChainResult, ChainStepResult } from "./constants";

/** Backend returns "success" for passed steps/chains — normalize to "passed" for UI */
function normalizeStatus(status: string): string {
  if (status === "success") return "passed";
  return status;
}

/** Round response time to clean integer */
function formatMs(ms: number): string {
  return Math.round(ms).toString();
}

interface ChainResultsViewProps {
  result: ChainResult;
}

export default function ChainResultsView({ result }: ChainResultsViewProps) {
  const chainStatus = normalizeStatus(result.status);
  const passRate = result.total_steps > 0
    ? ((result.passed_steps / result.total_steps) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Badge
                variant="outline"
                className={
                  chainStatus === "passed"
                    ? "border-green-500 text-green-600 bg-green-500/10 text-base px-3 py-1"
                    : "border-red-500 text-red-600 bg-red-500/10 text-base px-3 py-1"
                }
              >
                {chainStatus === "passed" ? (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1.5" />
                )}
                {chainStatus.toUpperCase()}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {result.chain_name}
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="text-center">
                <span className="text-2xl font-bold">{result.total_steps}</span>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-green-600">{result.passed_steps}</span>
                <p className="text-xs text-muted-foreground">Passed</p>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-red-600">{result.failed_steps}</span>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold text-yellow-600">{result.skipped_steps}</span>
                <p className="text-xs text-muted-foreground">Skipped</p>
              </div>
              <div className="text-center">
                <span className="text-2xl font-bold">{passRate}%</span>
                <p className="text-xs text-muted-foreground">Pass Rate</p>
              </div>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-mono">{formatMs(result.total_duration_ms)}ms</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step waterfall */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Step Results</CardTitle>
          <CardDescription>Execution timeline with response data, extractions, and assertions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {result.step_results.map((sr, idx) => (
              <StepResultRow key={sr.step_id} stepResult={sr} index={idx} />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Variables panel — only user-defined extractions, filter out auto-generated step metadata */}
      {(() => {
        const stepIds = new Set(result.step_results.map((sr) => sr.step_id));
        const autoSuffixes = ["_status_code", "_response_time"];
        const userVars = Object.entries(result.final_variables).filter(
          ([key]) => !Array.from(stepIds).some((sid) =>
            autoSuffixes.some((suffix) => key === `${sid}${suffix}`)
          )
        );
        if (userVars.length === 0) return null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <ArrowDownToLine className="w-5 h-5" />
                Extracted Variables
              </CardTitle>
              <CardDescription>Values extracted during chain execution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {userVars.map(([key, value]) => (
                  <div key={key} className="p-2 bg-muted rounded-lg">
                    <p className="text-xs font-medium text-muted-foreground">${`{${key}}`}</p>
                    <p className="text-sm font-mono truncate" title={String(value)}>
                      {String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })()}
    </div>
  );
}

function StepResultRow({ stepResult, index }: { stepResult: ChainStepResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const stepStatus = normalizeStatus(stepResult.status);

  const statusIcon =
    stepStatus === "passed" ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : stepStatus === "failed" ? (
      <XCircle className="w-5 h-5 text-red-500" />
    ) : (
      <SkipForward className="w-5 h-5 text-yellow-500" />
    );

  const barWidth = stepResult.response_time_ms > 0
    ? Math.min(100, Math.max(5, (stepResult.response_time_ms / 2000) * 100))
    : 0;

  const hasResponseData = stepResult.response_body != null || (stepResult.response_headers && Object.keys(stepResult.response_headers).length > 0);

  const formatBody = (body: any): string => {
    if (body == null) return "";
    if (typeof body === "string") {
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    }
    return JSON.stringify(body, null, 2);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  return (
    <div className={`rounded-lg border ${
      stepStatus === "passed"
        ? "border-green-500/20 bg-green-500/5"
        : stepStatus === "failed"
          ? "border-red-500/20 bg-red-500/5"
          : "border-yellow-500/20 bg-yellow-500/5"
    }`}>
      {/* Header row — clickable to expand */}
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-xs text-muted-foreground font-mono w-5">{index + 1}</span>
        {statusIcon}
        <span className="text-sm font-medium flex-1">{stepResult.step_name}</span>

        {stepResult.status_code > 0 && (
          <Badge variant="outline" className="font-mono text-xs">
            {stepResult.status_code}
          </Badge>
        )}

        {hasResponseData && (
          <Badge variant="secondary" className="text-xs">
            <FileJson className="w-3 h-3 mr-1" />
            Response
          </Badge>
        )}

        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {formatMs(stepResult.response_time_ms)}ms
        </span>
      </div>

      {/* Timing bar */}
      {barWidth > 0 && (
        <div className="mx-3 mb-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              stepStatus === "passed" ? "bg-green-500" : "bg-red-500"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      {/* Extracted values — always visible */}
      {Object.keys(stepResult.extracted_values || {}).length > 0 && (
        <div className="mx-3 mb-2 flex flex-wrap gap-1">
          {Object.entries(stepResult.extracted_values).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-xs font-mono">
              {key} = {String(value).substring(0, 30)}
              {String(value).length > 30 ? "..." : ""}
            </Badge>
          ))}
        </div>
      )}

      {/* Assertion results — always visible */}
      {stepResult.assertion_results && stepResult.assertion_results.length > 0 && (
        <div className="mx-3 mb-2 space-y-1">
          {stepResult.assertion_results.map((ar, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              {ar.passed ? (
                <CheckCircle2 className="w-3 h-3 text-green-500" />
              ) : (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
              <span className={ar.passed ? "text-green-600" : "text-red-600"}>
                {ar.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Error — always visible */}
      {stepResult.error && (
        <div className="mx-3 mb-2 flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{stepResult.error}</span>
        </div>
      )}

      {/* Expanded: Response Body & Headers */}
      {expanded && hasResponseData && (
        <div className="border-t mx-3 mb-3 pt-3">
          <Tabs defaultValue="body" className="w-full">
            <TabsList className="h-8">
              <TabsTrigger value="body" className="text-xs h-7 gap-1">
                <FileJson className="w-3 h-3" />
                Response Body
              </TabsTrigger>
              <TabsTrigger value="headers" className="text-xs h-7 gap-1">
                <FileText className="w-3 h-3" />
                Headers {stepResult.response_headers ? `(${Object.keys(stepResult.response_headers).length})` : ""}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="body" className="mt-2">
              {stepResult.response_body != null ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 z-10 h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(formatBody(stepResult.response_body));
                    }}
                    title="Copy response body"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <div className="max-h-[400px] overflow-auto rounded-lg border bg-muted/50">
                    <pre className="text-xs font-mono p-3 whitespace-pre">
{formatBody(stepResult.response_body)}
                    </pre>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic p-3">No response body</p>
              )}
            </TabsContent>

            <TabsContent value="headers" className="mt-2">
              {stepResult.response_headers && Object.keys(stepResult.response_headers).length > 0 ? (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute top-1 right-1 z-10 h-7 w-7 p-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(
                        Object.entries(stepResult.response_headers)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join("\n")
                      );
                    }}
                    title="Copy headers"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <div className="max-h-[300px] overflow-auto rounded-lg border bg-muted/50">
                    <div className="space-y-0.5 p-2 min-w-max">
                      {Object.entries(stepResult.response_headers).map(([name, value]) => (
                        <div key={name} className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted/80 group">
                          <span className="font-mono text-xs font-semibold text-primary whitespace-nowrap">{name}:</span>
                          <span className="font-mono text-xs text-muted-foreground whitespace-nowrap">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic p-3">No response headers</p>
              )}
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Click hint when not expanded and has data */}
      {!expanded && hasResponseData && (
        <div className="mx-3 mb-2">
          <p className="text-xs text-muted-foreground italic">Click to expand response body & headers</p>
        </div>
      )}
    </div>
  );
}
