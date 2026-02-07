/**
 * ChainResultsView - Waterfall display of chain execution results.
 * Shows step-by-step pass/fail, timings, extracted values, and assertion results.
 */

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Clock, ArrowDownToLine, SkipForward, AlertTriangle } from "lucide-react";
import type { ChainResult, ChainStepResult } from "./constants";

interface ChainResultsViewProps {
  result: ChainResult;
}

export default function ChainResultsView({ result }: ChainResultsViewProps) {
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
                  result.status === "passed"
                    ? "border-green-500 text-green-600 bg-green-500/10 text-base px-3 py-1"
                    : "border-red-500 text-red-600 bg-red-500/10 text-base px-3 py-1"
                }
              >
                {result.status === "passed" ? (
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                ) : (
                  <XCircle className="w-4 h-4 mr-1.5" />
                )}
                {result.status.toUpperCase()}
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
                <span className="font-mono">{result.total_duration_ms}ms</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step-by-step waterfall */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Step Results</CardTitle>
          <CardDescription>Execution timeline with extractions and assertion details</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {result.step_results.map((sr, idx) => (
                <StepResultRow key={sr.step_id} stepResult={sr} index={idx} />
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Variables panel */}
      {Object.keys(result.final_variables).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ArrowDownToLine className="w-5 h-5" />
              Final Variables
            </CardTitle>
            <CardDescription>Values extracted during chain execution</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(result.final_variables).map(([key, value]) => (
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
      )}
    </div>
  );
}

function StepResultRow({ stepResult, index }: { stepResult: ChainStepResult; index: number }) {
  const statusIcon =
    stepResult.status === "passed" ? (
      <CheckCircle2 className="w-5 h-5 text-green-500" />
    ) : stepResult.status === "failed" ? (
      <XCircle className="w-5 h-5 text-red-500" />
    ) : (
      <SkipForward className="w-5 h-5 text-yellow-500" />
    );

  const barWidth = stepResult.response_time_ms > 0
    ? Math.min(100, Math.max(5, (stepResult.response_time_ms / 2000) * 100))
    : 0;

  return (
    <div className={`p-3 rounded-lg border ${
      stepResult.status === "passed"
        ? "border-green-500/20 bg-green-500/5"
        : stepResult.status === "failed"
          ? "border-red-500/20 bg-red-500/5"
          : "border-yellow-500/20 bg-yellow-500/5"
    }`}>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground font-mono w-5">{index + 1}</span>
        {statusIcon}
        <span className="text-sm font-medium flex-1">{stepResult.step_name}</span>

        {stepResult.status_code > 0 && (
          <Badge variant="outline" className="font-mono text-xs">
            {stepResult.status_code}
          </Badge>
        )}

        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {stepResult.response_time_ms}ms
        </span>
      </div>

      {/* Timing bar */}
      {barWidth > 0 && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              stepResult.status === "passed" ? "bg-green-500" : "bg-red-500"
            }`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      )}

      {/* Extracted values */}
      {Object.keys(stepResult.extracted_values || {}).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {Object.entries(stepResult.extracted_values).map(([key, value]) => (
            <Badge key={key} variant="secondary" className="text-xs font-mono">
              {key} = {String(value).substring(0, 30)}
              {String(value).length > 30 ? "..." : ""}
            </Badge>
          ))}
        </div>
      )}

      {/* Assertion results */}
      {stepResult.assertion_results && stepResult.assertion_results.length > 0 && (
        <div className="mt-2 space-y-1">
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

      {/* Error */}
      {stepResult.error && (
        <div className="mt-2 flex items-start gap-2 text-xs text-red-600">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>{stepResult.error}</span>
        </div>
      )}
    </div>
  );
}
