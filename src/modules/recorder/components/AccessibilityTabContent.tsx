/**
 * AccessibilityTabContent - Accessibility issues tab for the recorder right panel.
 *
 * Extracted from PlaywrightRecorderPage.tsx to reduce file size.
 */

import React from "react";
import {
  Accessibility, Scan, Loader2, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface A11yIssue {
  rule: string;
  impact: string;
  description: string;
  element?: string;
  suggested_fix?: string;
  wcag_criterion?: string;
  help_url?: string;
}

interface A11yPageScan {
  page: string;
  timestamp: number;
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  issues: A11yIssue[];
}

interface AccessibilityTabContentProps {
  a11yIssues: A11yPageScan[];
  setA11yIssues: React.Dispatch<React.SetStateAction<A11yPageScan[]>>;
  handleA11yScan: () => void;
  isA11yScanning: boolean;
  currentUrl: string | null;
}

export default function AccessibilityTabContent({
  a11yIssues,
  setA11yIssues,
  handleA11yScan,
  isA11yScanning,
  currentUrl,
}: AccessibilityTabContentProps) {
  return (
    <>
      <div className="px-3 py-2 border-b border-border flex items-center justify-between sticky top-0 bg-card z-10">
        <div className="flex items-center gap-2">
          <Accessibility className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold">Accessibility Issues</span>
          {a11yIssues.length > 0 && (
            <Badge className={cn(
              "text-[10px] px-1.5",
              a11yIssues.reduce((acc, p) => acc + p.summary.critical, 0) > 0
                ? "bg-red-500/20 text-red-400 border-red-500/30"
                : "bg-amber-500/20 text-amber-400 border-amber-500/30"
            )}>
              {a11yIssues.reduce((acc, p) => acc + p.summary.total, 0)} total
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            onClick={handleA11yScan}
            disabled={isA11yScanning || !currentUrl}
            variant="outline"
            size="sm"
            className="h-6 text-[10px] px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            {isA11yScanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Scan className="h-3 w-3" />}
            <span className="ml-1">Scan Page</span>
          </Button>
          {a11yIssues.length > 0 && (
            <Button
              onClick={() => setA11yIssues([])}
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-2 border-red-500/30 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {a11yIssues.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Accessibility className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No accessibility scans yet</p>
              <p className="text-xs mt-1">Click "A11y" button or "Scan Page" to check the current page</p>
            </div>
          ) : (
            a11yIssues.map((pageScan, pageIdx) => (
              <Collapsible key={pageIdx} defaultOpen={pageIdx === a11yIssues.length - 1}>
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg hover:bg-secondary/80 transition-colors">
                    <div className="flex items-center gap-2 text-left">
                      <ChevronRight className="h-4 w-4 transition-transform ui-open:rotate-90" />
                      <div>
                        <p className="text-xs font-medium truncate max-w-[200px]">{pageScan.page}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(pageScan.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {pageScan.summary.critical > 0 && (
                        <Badge className="bg-red-500/20 text-red-400 text-[9px] px-1">{pageScan.summary.critical} crit</Badge>
                      )}
                      {pageScan.summary.serious > 0 && (
                        <Badge className="bg-orange-500/20 text-orange-400 text-[9px] px-1">{pageScan.summary.serious} ser</Badge>
                      )}
                      {pageScan.summary.moderate > 0 && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 text-[9px] px-1">{pageScan.summary.moderate} mod</Badge>
                      )}
                      {pageScan.summary.minor > 0 && (
                        <Badge className="bg-blue-500/20 text-blue-400 text-[9px] px-1">{pageScan.summary.minor} min</Badge>
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-2 pl-4">
                    {pageScan.issues.map((issue, issueIdx) => (
                      <div
                        key={issueIdx}
                        className={cn(
                          "p-2 rounded-lg border-l-2 bg-secondary/30",
                          issue.impact === 'critical' ? "border-l-red-500" :
                          issue.impact === 'serious' ? "border-l-orange-500" :
                          issue.impact === 'moderate' ? "border-l-yellow-500" :
                          "border-l-blue-500"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <Badge className={cn(
                                "text-[9px] px-1",
                                issue.impact === 'critical' ? "bg-red-500/20 text-red-400" :
                                issue.impact === 'serious' ? "bg-orange-500/20 text-orange-400" :
                                issue.impact === 'moderate' ? "bg-yellow-500/20 text-yellow-400" :
                                "bg-blue-500/20 text-blue-400"
                              )}>
                                {issue.impact}
                              </Badge>
                              <span className="text-[10px] font-medium truncate">{issue.rule}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground mb-1">{issue.description}</p>
                            {issue.element && (
                              <code className="block text-[9px] bg-black/30 px-1.5 py-0.5 rounded text-muted-foreground truncate mb-1">
                                {issue.element.slice(0, 80)}{issue.element.length > 80 ? '...' : ''}
                              </code>
                            )}
                            {issue.suggested_fix && (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded p-1.5 mt-1">
                                <p className="text-[9px] text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">Fix:</p>
                                <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">{issue.suggested_fix}</p>
                              </div>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] text-purple-600 dark:text-purple-400">{issue.wcag_criterion}</span>
                              {issue.help_url && (
                                <a
                                  href={issue.help_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[9px] text-blue-400 hover:underline"
                                >
                                  Learn more
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
}
