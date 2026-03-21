import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronDown, ChevronRight, Copy, Check, AlertTriangle, Info } from 'lucide-react';
import type { ExplorationDefect } from './types';

interface DefectCardProps {
  defect: ExplorationDefect;
  theme: string;
}

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-500 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  minor: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
};

const typeLabels: Record<string, string> = {
  js_error: 'JavaScript Error',
  console_error: 'Console Error',
  network_error: 'Network Error',
  broken_link: 'Broken Link',
  missing_alt: 'Missing Alt Text',
  accessibility: 'Accessibility',
  performance: 'Performance',
  security: 'Security Issue',
  functional: 'Functional Issue',
  empty_link: 'Empty Link',
  form_issue: 'Form Issue',
  seo: 'SEO Issue',
};

/** Produce a human-readable impact statement from defect type + severity */
function getImpactText(defect: ExplorationDefect): string {
  const t = defect.type?.toLowerCase() || '';
  const s = defect.severity?.toLowerCase() || 'medium';

  if (t.includes('js_error') || t.includes('javascript') || t.includes('console'))
    return 'May cause broken functionality or visual glitches for end users.';
  if (t.includes('broken_link') || t.includes('empty_link'))
    return 'Users clicking this link will see a 404 or go nowhere.';
  if (t.includes('missing_alt') || t.includes('accessibility'))
    return 'Screen reader users cannot understand this content. WCAG violation.';
  if (t.includes('network'))
    return 'API or resource failed to load. May cause missing data or broken features.';
  if (t.includes('security'))
    return 'Potential security vulnerability that should be addressed immediately.';
  if (t.includes('performance'))
    return 'Slow loading degrades user experience and SEO rankings.';
  if (t.includes('form'))
    return 'Form may not submit correctly or has validation issues.';
  if (s === 'critical') return 'Critical issue that blocks core functionality.';
  if (s === 'high') return 'High-impact issue that affects many users.';
  return 'Should be reviewed and fixed to improve quality.';
}

export function DefectCard({ defect, theme }: DefectCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = defect.page_url || defect.url;
  const typeLabel = typeLabels[defect.type] || defect.type;
  const impact = getImpactText(defect);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = `[${defect.severity?.toUpperCase()}] ${typeLabel}: ${defect.title || defect.description}\nURL: ${url || 'N/A'}\nImpact: ${impact}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "rounded-lg border transition-all cursor-pointer group",
        theme === 'light' ? "bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm" : "bg-gray-900 border-gray-800 hover:border-gray-700"
      )}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row — always visible */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        {expanded
          ? <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0", theme === 'light' ? 'text-gray-400' : 'text-gray-500')} />
          : <ChevronRight className={cn("w-3.5 h-3.5 flex-shrink-0", theme === 'light' ? 'text-gray-400' : 'text-gray-500')} />
        }
        <Badge className={cn("text-[10px] border-0 flex-shrink-0", severityColors[defect.severity] || severityColors.medium)}>
          {defect.severity}
        </Badge>
        <Badge className={cn("text-[10px] border-0 flex-shrink-0",
          theme === 'light' ? "bg-gray-100 text-gray-600" : "bg-gray-800 text-gray-400"
        )}>
          {typeLabel}
        </Badge>
        {defect.wcag_criterion && (
          <Badge className="text-[10px] border-0 bg-purple-500/10 text-purple-500 flex-shrink-0">
            {defect.wcag_criterion}
          </Badge>
        )}
        <span className={cn("text-sm font-medium truncate flex-1 min-w-0", theme === 'light' ? 'text-gray-900' : 'text-white')}>
          {defect.title || defect.description}
        </span>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded",
            theme === 'light' ? 'hover:bg-gray-100' : 'hover:bg-gray-800'
          )}
          title="Copy defect details"
        >
          {copied
            ? <Check className="w-3.5 h-3.5 text-green-500" />
            : <Copy className={cn("w-3.5 h-3.5", theme === 'light' ? 'text-gray-400' : 'text-gray-500')} />
          }
        </button>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className={cn(
          "px-3 pb-3 pt-0 space-y-2.5 border-t",
          theme === 'light' ? "border-gray-100" : "border-gray-800"
        )}>
          {/* Description */}
          {defect.description && (
            <p className={cn("text-xs leading-relaxed mt-2", theme === 'light' ? 'text-gray-600' : 'text-gray-300')}>
              {defect.description}
            </p>
          )}

          {/* Impact */}
          <div className={cn(
            "flex items-start gap-2 rounded-lg px-3 py-2",
            theme === 'light' ? "bg-amber-50" : "bg-amber-500/5"
          )}>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", theme === 'light' ? 'text-amber-700' : 'text-amber-400')}>
                Impact
              </span>
              <p className={cn("text-xs mt-0.5", theme === 'light' ? 'text-amber-600' : 'text-amber-300')}>
                {impact}
              </p>
            </div>
          </div>

          {/* Element info — if available from defect data */}
          {defect.element && (
            <div className={cn(
              "rounded-lg px-3 py-2",
              theme === 'light' ? "bg-gray-50" : "bg-gray-800/50"
            )}>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wider", theme === 'light' ? 'text-gray-500' : 'text-gray-400')}>
                Element
              </span>
              <code className={cn("block text-[11px] mt-1 font-mono break-all", theme === 'light' ? 'text-gray-700' : 'text-gray-300')}>
                {defect.element}
              </code>
            </div>
          )}

          {/* Suggestion — if available */}
          {defect.suggestion && (
            <div className={cn(
              "flex items-start gap-2 rounded-lg px-3 py-2",
              theme === 'light' ? "bg-blue-50" : "bg-blue-500/5"
            )}>
              <Info className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wider", theme === 'light' ? 'text-blue-700' : 'text-blue-400')}>
                  Suggestion
                </span>
                <p className={cn("text-xs mt-0.5", theme === 'light' ? 'text-blue-600' : 'text-blue-300')}>
                  {defect.suggestion}
                </p>
              </div>
            </div>
          )}

          {/* URL — clickable */}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "flex items-center gap-1.5 text-xs hover:underline",
                theme === 'light' ? 'text-blue-600' : 'text-blue-400'
              )}
            >
              <ExternalLink className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{url}</span>
            </a>
          )}

          {/* Screenshot */}
          {defect.screenshot && (
            <img
              src={`data:image/jpeg;base64,${defect.screenshot}`}
              alt="Defect screenshot"
              className="w-full max-h-40 object-cover rounded border border-gray-200 dark:border-gray-700"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </div>
  );
}
