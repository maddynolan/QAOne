/**
 * Salesforce Context Panel
 * 
 * A sidebar panel that shows context-aware suggestions during test recording.
 * Integrates with the test recording flow to provide:
 * 1. Current Salesforce context (object, page type)
 * 2. Relevant validation rules that might trigger
 * 3. Flows that could execute
 * 4. Smart assertion suggestions
 * 5. Test data generation
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Shield, Zap, Database, AlertTriangle, CheckCircle, Plus,
  Copy, RefreshCw, Loader2, ChevronDown, ChevronRight,
  Target, Sparkles, FileText, Eye, Code, ExternalLink,
  Play, TestTube, Info, Lightbulb, Wand2, ListChecks
} from 'lucide-react';
import { toast } from 'sonner';
import { 
  salesforceTestIntegration, 
  SalesforceContext, 
  TestSuggestion,
  ValidationRuleInfo,
  FlowInfo
} from '@/lib/salesforce-test-integration';
import { salesforceApi } from '@/lib/salesforce-api';
import { cn } from '@/lib/utils';

interface SalesforceContextPanelProps {
  currentUrl?: string;
  isRecording?: boolean;
  onAddAssertion?: (code: string) => void;
  onAddAction?: (code: string) => void;
  onGenerateTestData?: (data: any) => void;
  className?: string;
}

export function SalesforceContextPanel({
  currentUrl = '',
  isRecording = false,
  onAddAssertion,
  onAddAction,
  onGenerateTestData,
  className
}: SalesforceContextPanelProps) {
  const [context, setContext] = useState<SalesforceContext | null>(null);
  const [suggestions, setSuggestions] = useState<TestSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['context', 'suggestions', 'rules'])
  );
  
  const isConnected = !!salesforceApi.getCurrentOrg();

  // Load context when URL changes
  useEffect(() => {
    if (!currentUrl || !isConnected) return;
    
    const loadContext = async () => {
      setIsLoading(true);
      try {
        const ctx = await salesforceTestIntegration.getFullContext(currentUrl);
        setContext(ctx);
        
        if (ctx.currentObject) {
          const newSuggestions = salesforceTestIntegration.generateSuggestions({
            url: currentUrl,
            title: document.title,
            actions: [],
            currentObject: ctx.currentObject,
            currentRecordId: ctx.currentRecordId,
          });
          setSuggestions(newSuggestions);
        }
      } catch (e) {
        console.error('Failed to load context:', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadContext();
  }, [currentUrl, isConnected]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied to clipboard');
  };

  const handleAddToTest = (suggestion: TestSuggestion) => {
    if (suggestion.code) {
      if (suggestion.type === 'assertion' || suggestion.type === 'validation') {
        onAddAssertion?.(suggestion.code);
      } else {
        onAddAction?.(suggestion.code);
      }
      toast.success('Added to test');
    }
  };

  const generateTestData = async () => {
    const data = await salesforceTestIntegration.generateContextualTestData(3);
    if (data.length > 0) {
      onGenerateTestData?.(data);
      toast.success(`Generated ${data.length} test records`);
    } else {
      toast.error('No context available for test data');
    }
  };

  const coverage = useMemo(() => {
    return salesforceTestIntegration.calculateCoverage([]);
  }, [context]);

  if (!isConnected) {
    return (
      <div className={cn("p-4 text-center", className)}>
        <div className="text-slate-500 text-sm">
          <Shield className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>Connect to Salesforce to see context-aware suggestions</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-foreground text-sm">SF Context</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => salesforceTestIntegration.clearCache()}
          className="h-7 px-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <>
            {/* Current Context */}
            <CollapsibleSection
              title="Current Context"
              icon={<Target className="w-4 h-4 text-blue-400" />}
              isExpanded={expandedSections.has('context')}
              onToggle={() => toggleSection('context')}
            >
              {context?.currentObject ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">Object:</span>
                    <Badge className="bg-blue-600">{context.currentObject}</Badge>
                  </div>
                  {context.currentPage && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Page:</span>
                      <Badge variant="outline" className="text-slate-300 border-border">
                        {context.currentPage}
                      </Badge>
                    </div>
                  )}
                  {context.currentRecordId && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Record:</span>
                      <code className="text-xs text-muted-foreground">
                        {context.currentRecordId.slice(0, 10)}...
                      </code>
                    </div>
                  )}
                  {context.fields && (
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-500">Fields:</span>
                      <span className="text-xs text-muted-foreground">
                        {context.fields.length} ({context.fields.filter(f => f.required).length} required)
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  Navigate to a Salesforce page to see context
                </p>
              )}
            </CollapsibleSection>

            {/* Validation Rules */}
            {context?.validationRules && context.validationRules.length > 0 && (
              <CollapsibleSection
                title={`Validation Rules (${context.validationRules.length})`}
                icon={<Shield className="w-4 h-4 text-yellow-400" />}
                isExpanded={expandedSections.has('rules')}
                onToggle={() => toggleSection('rules')}
                badge={
                  <Badge className="bg-yellow-600/20 text-yellow-400 text-xs">
                    Active
                  </Badge>
                }
              >
                <div className="space-y-2">
                  {context.validationRules.slice(0, 5).map((rule) => (
                    <RuleCard
                      key={rule.id}
                      rule={rule}
                      onGenerateTest={() => {
                        const suggestion = suggestions.find(s => s.relatedRule === rule.name);
                        if (suggestion) handleAddToTest(suggestion);
                      }}
                    />
                  ))}
                  {context.validationRules.length > 5 && (
                    <p className="text-xs text-slate-500 text-center">
                      +{context.validationRules.length - 5} more rules
                    </p>
                  )}
                </div>
              </CollapsibleSection>
            )}

            {/* Flows */}
            {context?.flows && context.flows.length > 0 && (
              <CollapsibleSection
                title={`Flows (${context.flows.length})`}
                icon={<Zap className="w-4 h-4 text-green-400" />}
                isExpanded={expandedSections.has('flows')}
                onToggle={() => toggleSection('flows')}
              >
                <div className="space-y-2">
                  {context.flows.slice(0, 5).map((flow) => (
                    <FlowCard key={flow.id} flow={flow} />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Smart Suggestions */}
            {suggestions.length > 0 && (
              <CollapsibleSection
                title={`Suggestions (${suggestions.length})`}
                icon={<Lightbulb className="w-4 h-4 text-purple-400" />}
                isExpanded={expandedSections.has('suggestions')}
                onToggle={() => toggleSection('suggestions')}
              >
                <div className="space-y-2">
                  {suggestions.slice(0, 8).map((suggestion) => (
                    <SuggestionCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onAdd={() => handleAddToTest(suggestion)}
                      onCopy={() => suggestion.code && handleCopyCode(suggestion.code)}
                    />
                  ))}
                </div>
              </CollapsibleSection>
            )}

            {/* Coverage */}
            {context?.currentObject && (
              <CollapsibleSection
                title="Test Coverage"
                icon={<Target className="w-4 h-4 text-cyan-400" />}
                isExpanded={expandedSections.has('coverage')}
                onToggle={() => toggleSection('coverage')}
              >
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-500">Overall</span>
                      <span className="text-slate-300">{coverage.overallPercentage}%</span>
                    </div>
                    <Progress value={coverage.overallPercentage} className="h-1.5" />
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded bg-secondary">
                      <div className="text-sm font-medium text-foreground">
                        {coverage.validationRulesCovered}/{coverage.validationRulesTotal}
                      </div>
                      <div className="text-xs text-slate-500">Rules</div>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <div className="text-sm font-medium text-foreground">
                        {coverage.flowsCovered}/{coverage.flowsTotal}
                      </div>
                      <div className="text-xs text-slate-500">Flows</div>
                    </div>
                    <div className="p-2 rounded bg-secondary">
                      <div className="text-sm font-medium text-foreground">
                        {coverage.fieldsCovered}/{coverage.fieldsTotal}
                      </div>
                      <div className="text-xs text-slate-500">Fields</div>
                    </div>
                  </div>
                </div>
              </CollapsibleSection>
            )}

            {/* Quick Actions */}
            <div className="pt-2 border-t border-border">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={generateTestData}
                  disabled={!context?.currentObject}
                  className="text-xs text-slate-300 border-border h-8"
                >
                  <Database className="w-3 h-3 mr-1" />
                  Gen Data
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const assertions = salesforceTestIntegration.generateAssertions();
                    if (assertions.length > 0) {
                      handleCopyCode(assertions.join('\n'));
                    }
                  }}
                  disabled={!context?.currentObject}
                  className="text-xs text-slate-300 border-border h-8"
                >
                  <Code className="w-3 h-3 mr-1" />
                  Assertions
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ========== SUB-COMPONENTS ==========

interface CollapsibleSectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}

function CollapsibleSection({
  title,
  icon,
  isExpanded,
  onToggle,
  badge,
  children
}: CollapsibleSectionProps) {
  return (
    <div className="rounded-lg bg-secondary border border-border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-2 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-slate-200">{title}</span>
          {badge}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-500" />
        )}
      </button>
      {isExpanded && (
        <div className="p-2 pt-0 border-t border-border/50">
          {children}
        </div>
      )}
    </div>
  );
}

interface RuleCardProps {
  rule: ValidationRuleInfo;
  onGenerateTest: () => void;
}

function RuleCard({ rule, onGenerateTest }: RuleCardProps) {
  return (
    <div className="p-2 rounded bg-secondary border border-border">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{rule.name}</p>
          {rule.errorMessage && (
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {rule.errorMessage}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={onGenerateTest}
          className="h-6 px-1.5 text-muted-foreground hover:text-foreground shrink-0"
          title="Generate test for this rule"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

interface FlowCardProps {
  flow: FlowInfo;
}

function FlowCard({ flow }: FlowCardProps) {
  return (
    <div className="p-2 rounded bg-secondary border border-border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{flow.name}</p>
          <p className="text-xs text-slate-500">{flow.type}</p>
        </div>
        <Badge variant="outline" className="text-green-400 border-green-400/30 text-xs shrink-0">
          Active
        </Badge>
      </div>
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: TestSuggestion;
  onAdd: () => void;
  onCopy: () => void;
}

function SuggestionCard({ suggestion, onAdd, onCopy }: SuggestionCardProps) {
  const typeColors = {
    assertion: 'bg-blue-600',
    action: 'bg-green-600',
    data: 'bg-purple-600',
    flow: 'bg-yellow-600',
    validation: 'bg-red-600',
  };

  const priorityColors = {
    high: 'text-red-400',
    medium: 'text-yellow-400',
    low: 'text-muted-foreground',
  };

  return (
    <div className="p-2 rounded bg-secondary border border-border hover:border-border transition-colors">
      <div className="flex items-start gap-2">
        <Badge className={cn("text-xs shrink-0", typeColors[suggestion.type])}>
          {suggestion.type}
        </Badge>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground">{suggestion.title}</p>
          <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
            {suggestion.description}
          </p>
        </div>
      </div>
      {suggestion.code && (
        <div className="flex gap-1 mt-2 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={onCopy}
            className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
          >
            <Copy className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onAdd}
            className="h-6 px-1.5 text-green-400 hover:text-green-300"
          >
            <Plus className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}




