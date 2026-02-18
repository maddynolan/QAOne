/**
 * StepEditor Component
 *
 * Right panel component for editing step details including selector,
 * value, assertions, verification configs, and advanced UI step properties.
 * Extracted from UnifiedWorkflowEditor.tsx.
 */

import React, { useState } from 'react';
import {
  Settings, Target, Zap, Globe, MousePointer, Type, Clock,
  CheckCircle, Navigation, AlertCircle, Wand2, ChevronRight, ChevronDown,
  Layers, RefreshCw, FileText, Monitor, Server, Gauge,
  Video, Camera, Search, X, Edit, Code, Download, File, FolderPlus, Plus, Share2,
  Database, ToggleLeft, ToggleRight,
  BookOpen, ExternalLink,
  Calendar, Calculator, Shuffle, AlertTriangle,
  Mail, Phone, Hash, User, ShieldCheck, Lightbulb,
  Building2, Plane, GraduationCap, Heart, Utensils,
  Home, Briefcase, Gamepad2, BarChart3,
  Activity, FileJson, Link2, Key, Timer,
  ClipboardList, Flag,
  Table, Move, Sliders, Keyboard, Layout, Maximize2, CheckSquare,
  Crosshair, Eye, EyeOff
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import {
  EmailVerifyStepConfig,
  PDFVerifyStepConfig,
  FileVerifyStepConfig,
  getDefaultEmailVerifyConfig
} from '@/components/verifications';
import type { EmailVerifyConfig, PDFVerifyConfig, FileVerifyConfig } from '@/components/verifications/types';
import { SmartFillDialog } from '@/modules/recorder/components/SmartFillDialog';
import {
  DOMAINS, CATEGORIES, DomainType, ValidationTemplate,
  getValidationsByDomain, getSuggestionsForField, calculateCoverage,
  groupValidations, getPriorityColor, validationToAssertion
} from '@/lib/qa-validation-templates';
import type { StepType, StepAssertion, TestStep } from '../types/workflow-editor.types';
import { getStepInfo } from '../constants/step-categories';
import { getStepDescription } from '../lib/step-helpers';
import { convertSelector } from '../lib/selector-utils';
import {
  getAssertionDescription, getAssertionSuggestions, getQuickSuggestions,
  getQuickSuggestionsLegacy, STEP_TYPE_ASSERTIONS, getAssertionsForStepType,
  shouldShowGenericAssertions
} from '../lib/assertion-helpers';
import { detectFieldType, generateSmartValue } from '../lib/test-data-generation';

interface StepEditorProps {
  step: TestStep;
  onUpdate: (updates: Partial<TestStep>) => void;
  onClose: () => void;
  onShowBlackbox: () => void;
  // All steps in test case (for variable references)
  allSteps?: TestStep[];
  // Validation props
  domain?: DomainType;
  coveredValidations?: string[];
  onToggleValidation?: (validationId: string) => void;
  activeTab?: 'details' | 'validations';
  onTabChange?: (tab: 'details' | 'validations') => void;
}

function StepEditor({
  step,
  onUpdate,
  onClose,
  onShowBlackbox,
  allSteps = [],
  domain = 'general',
  coveredValidations = [],
  onToggleValidation,
  activeTab = 'details',
  onTabChange
}: StepEditorProps) {
  // Smart Fill Dialog state
  const [showSmartFillDialog, setShowSmartFillDialog] = useState(false);
  
  // Check if step has automation data (recorded/merged)
  const hasAutomation = !!(
    (step as any).qword && 
    (step as any).args && 
    Array.isArray((step as any).args) && 
    (step as any).args.length > 0
  );
  const hasSmartSelectors = !!(step as any).selectorObj && Object.keys((step as any).selectorObj || {}).length > 0;
  const isAutomated = hasAutomation || hasSmartSelectors;
  
  // Get smart suggestions based on step content
  const fieldText = [step.name, step.target, step.selector, step.description].filter(Boolean).join(' ');
  const smartSuggestions = getSuggestionsForField(fieldText, domain);
  
  // Get step type info for better labels
  const stepTypeLabels: Record<string, { targetLabel: string; targetPlaceholder: string; targetHelp: string }> = {
    click: { 
      targetLabel: 'What to Click', 
      targetPlaceholder: 'e.g., Submit Button, Login Link, Menu Item',
      targetHelp: 'The text or name of the button/link to click. Used to find the element.'
    },
    input: { 
      targetLabel: 'Field Label', 
      targetPlaceholder: 'e.g., Email, First Name, Password',
      targetHelp: 'The label of the input field (what appears next to it or as placeholder).'
    },
    select: { 
      targetLabel: 'Dropdown Label', 
      targetPlaceholder: 'e.g., Country, State, Category',
      targetHelp: 'The label of the dropdown/select field.'
    },
    hover: { 
      targetLabel: 'Element to Hover', 
      targetPlaceholder: 'e.g., Menu, Profile Icon, Tooltip Trigger',
      targetHelp: 'The element to hover over (to reveal dropdowns, tooltips, etc.).'
    },
    assert: { 
      targetLabel: 'Element to Check', 
      targetPlaceholder: 'e.g., Success Message, Error Alert, Welcome Text',
      targetHelp: 'The element to verify exists or has specific content.'
    },
  };

  const typeInfo = stepTypeLabels[step.type] || { 
    targetLabel: 'Target Element', 
    targetPlaceholder: 'e.g., Submit Button',
    targetHelp: 'Human-readable name for this element'
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header with Tabs */}
      <div className="p-3 border-b">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Edit Step
              {isAutomated && (
                <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
                  <Zap className="h-3 w-3 mr-0.5" />
                  Automated
                </Badge>
              )}
            </h3>
            <span className="text-[10px] text-muted-foreground capitalize">{step.type} action</span>
          </div>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1">
          <Button
            variant={activeTab === 'details' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onTabChange?.('details')}
          >
            <Settings className="h-3 w-3 mr-1" />
            Details
          </Button>
          <Button
            variant={activeTab === 'validations' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs flex-1"
            onClick={() => onTabChange?.('validations')}
          >
            <Lightbulb className="h-3 w-3 mr-1" />
            Validations
            {smartSuggestions.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px]">
                {smartSuggestions.filter(s => s.priority === 'High').length}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {activeTab === 'validations' ? (
          /* Validations Tab - Smart Suggestions */
          <div className="space-y-3">
            {smartSuggestions.length > 0 ? (
              <>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                  <span>Suggested validations for this step</span>
                </div>
                
                {/* Group by category */}
                {(() => {
                  const grouped = groupValidations(smartSuggestions.slice(0, 20));
                  return Object.entries(grouped).map(([category, subcats]) => (
                    <div key={category} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{CATEGORIES[category]?.icon} {category}</span>
                      </div>
                      {Object.entries(subcats).map(([subcat, validations]) => (
                        <div key={subcat} className="pl-2 space-y-1">
                          <span className="text-[10px] text-muted-foreground">{subcat}</span>
                          {validations.map((v) => {
                            const isCovered = coveredValidations.includes(v.id);
                            return (
                              <div 
                                key={v.id}
                                className={`p-2 rounded border text-xs cursor-pointer transition-colors ${
                                  isCovered 
                                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800' 
                                    : 'hover:bg-muted'
                                }`}
                                onClick={() => onToggleValidation?.(v.id)}
                              >
                                <div className="flex items-start gap-2">
                                  <div className={`mt-0.5 h-3.5 w-3.5 rounded border flex items-center justify-center ${
                                    isCovered ? 'bg-green-500 border-green-500' : 'border-gray-300'
                                  }`}>
                                    {isCovered && <CheckCircle className="h-2.5 w-2.5 text-white" />}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">{v.validationLogic}</span>
                                      <Badge className={`h-4 px-1 text-[9px] ${getPriorityColor(v.priority)}`}>
                                        {v.priority}
                                      </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">{v.testScenario}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ShieldCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No specific validations detected</p>
                <p className="text-xs mt-1">Add more details to the step to get suggestions</p>
              </div>
            )}
          </div>
        ) : (
          /* Details Tab - Original Step Editor Content */
          <div className="space-y-4">
            {/* Step Name */}
            <div className="space-y-2">
              <Label className="text-xs">Step Name</Label>
              <Input
                value={step.name}
                onChange={(e) => onUpdate({ name: e.target.value })}
                placeholder={`${step.type === 'click' ? 'Click: ' : step.type === 'input' ? 'Input: ' : ''}...`}
                className="h-8 text-sm"
              />
            </div>

      {/* Type-specific fields */}
      {step.type === 'navigate' && (
        <div className="space-y-2">
          <Label>URL to Navigate To</Label>
          <Input
            value={step.url || ''}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="https://example.com/page"
          />
          <p className="text-xs text-muted-foreground">The full URL where the browser should go</p>
        </div>
      )}

      {step.type === 'wait' && (
        <div className="space-y-2">
          <Label>Wait Time (milliseconds)</Label>
          <Input
            type="number"
            value={step.waitTime || 1000}
            onChange={(e) => onUpdate({ waitTime: parseInt(e.target.value) })}
            placeholder="1000"
          />
          <p className="text-xs text-muted-foreground">How long to wait (1000ms = 1 second)</p>
        </div>
      )}

      {step.type === 'wait_for_element' && (
        <div className="space-y-2">
          <Label>Element to Wait For</Label>
          <Input
            value={step.target || ''}
            onChange={(e) => onUpdate({ target: e.target.value })}
            placeholder="e.g., Loading Spinner, Submit Button"
          />
          <p className="text-xs text-muted-foreground">Wait until this element appears on the page</p>
        </div>
      )}

      {['click', 'input', 'fill', 'select', 'hover', 'assert'].includes(step.type) && (
        <>
          {/* Human-readable target name - with type-specific label */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {typeInfo.targetLabel}
              <span className="text-xs font-normal text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                Used to find element
              </span>
            </Label>
            <Input
              value={step.target || ''}
              onChange={(e) => onUpdate({ target: e.target.value })}
              placeholder={typeInfo.targetPlaceholder}
            />
            <p className="text-xs text-muted-foreground">{typeInfo.targetHelp}</p>
          </div>
          
          {/* Technical selector - collapsed by default */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between text-xs">
                <span className="flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  Technical Details
                </span>
                <ChevronDown className="h-3 w-3" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Selector (for automation)</Label>
                <Textarea
                  value={step.selector || ''}
                  onChange={(e) => onUpdate({ selector: e.target.value })}
                  placeholder="Enter selector..."
                  className="font-mono text-xs"
                  rows={2}
                />
              </div>
              
              {/* Element Index for handling duplicates */}
              {['click', 'input', 'fill', 'select', 'hover'].includes(step.type) && (
                <div className="space-y-1">
                  <Label className="text-xs flex items-center gap-1">
                    Element Index
                    <span className="text-muted-foreground">(for duplicate elements)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={(step as any).elementIndex?.toString() || 'first'}
                      onValueChange={(value) => onUpdate({ 
                        elementIndex: value === 'first' ? undefined : parseInt(value) 
                      } as any)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="First" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="first">First (default)</SelectItem>
                        <SelectItem value="0">1st element</SelectItem>
                        <SelectItem value="1">2nd element</SelectItem>
                        <SelectItem value="2">3rd element</SelectItem>
                        <SelectItem value="3">4th element</SelectItem>
                        <SelectItem value="4">5th element</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-muted-foreground">
                      Use when page has multiple matching elements
                    </span>
                  </div>
                </div>
              )}
              
              <Button variant="outline" size="sm" className="w-full" onClick={onShowBlackbox}>
                <Wand2 className="h-4 w-4 mr-1" />
                Add Fallback Strategy
              </Button>
              
              {/* QA Engineer Fallback - Manual selector input when nothing else works */}
              <div className="space-y-1 mt-3 pt-3 border-t border-amber-500/30">
                <Label className="text-xs flex items-center gap-2">
                  <span className="text-amber-500">⚙️</span>
                  QA Override Selector
                  <span className="text-[10px] font-normal text-amber-600 bg-amber-50 dark:bg-amber-900/30 px-1.5 py-0.5 rounded">
                    Fallback
                  </span>
                </Label>
                <Textarea
                  value={step.qaFallbackSelector || ''}
                  onChange={(e) => onUpdate({ qaFallbackSelector: e.target.value })}
                  placeholder="// Enter XPath or CSS selector when auto-detection fails&#10;// Example: //button[@data-testid='submit']&#10;// Example: [data-qa='login-btn']"
                  className="font-mono text-xs border-amber-500/30 bg-amber-50/50 dark:bg-amber-900/10"
                  rows={3}
                />
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  💡 Use this when automatic element detection doesn't work. Supports XPath (//) or CSS selectors.
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
          
          {/* Automation Data (readonly when automated) */}
          {isAutomated && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                  Automation Script Attached
                </span>
              </div>
              <div className="text-xs text-green-600 dark:text-green-500 space-y-1">
                {hasAutomation && (
                  <>
                    <div><span className="font-medium">Action:</span> {(step as any).qword}</div>
                    <div><span className="font-medium">Args:</span> {(step as any).args?.join(', ')}</div>
                  </>
                )}
                {hasSmartSelectors && (
                  <div><span className="font-medium">Smart Selectors:</span> Available for auto-healing</div>
                )}
              </div>
              <p className="text-[10px] text-green-600/70 mt-2">
                ✓ You can edit the step name and expected result without affecting the automation script
              </p>
            </div>
          )}
        </>
      )}

      {(step.type === 'input' || step.type === 'fill') && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Value to Enter</Label>
            <div className="flex gap-1">
              {/* Quick Auto-detect */}
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => {
                  const fieldLabel = step.name || step.target || 'text';
                  const detected = detectFieldType(fieldLabel);
                  const value = generateSmartValue(detected.type, fieldLabel, detected.constraints);
                  console.log(`[Smart Fill] "${fieldLabel}" -> ${detected.type} -> "${value}"`);
                  onUpdate({ value, runtimeRandom: undefined });
                }}
                title="Auto-detect and fill based on field name"
              >
                <Wand2 className="h-3 w-3 mr-1" />
                Auto
              </Button>
              {/* Open Smart Fill Dialog */}
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowSmartFillDialog(true)}
              >
                <Zap className="h-3 w-3 mr-1" />
                Smart Fill
              </Button>
            </div>
          </div>
          
          {/* Smart Fill Dialog */}
          <SmartFillDialog
            open={showSmartFillDialog}
            onOpenChange={setShowSmartFillDialog}
            onSelectValue={(value, generatorId) => {
              console.log(`[Smart Fill Dialog] Selected: ${generatorId} -> "${value}"`);
              onUpdate({ value, runtimeRandom: undefined });
            }}
            fieldLabel={step.name || step.target || ''}
          />
          
          {/* Show current value or runtime indicator */}
          {step.runtimeRandom?.enabled ? (
            <div className="p-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 rounded-lg">
              <div className="flex items-center gap-2 text-xs">
                <RefreshCw className="h-3 w-3 text-violet-500" />
                <span className="font-medium text-violet-700 dark:text-violet-300">Runtime Random</span>
                <Badge variant="secondary" className="text-[10px]">{step.runtimeRandom.type}</Badge>
              </div>
              {step.runtimeRandom.constraints && (
                <div className="text-[10px] text-muted-foreground mt-1">
                  {step.runtimeRandom.constraints.minAge && `Min Age: ${step.runtimeRandom.constraints.minAge}`}
                  {step.runtimeRandom.constraints.maxAge && ` Max Age: ${step.runtimeRandom.constraints.maxAge}`}
                  {step.runtimeRandom.constraints.minValue !== undefined && `Min: ${step.runtimeRandom.constraints.minValue}`}
                  {step.runtimeRandom.constraints.maxValue !== undefined && ` Max: ${step.runtimeRandom.constraints.maxValue}`}
                </div>
              )}
              <p className="text-[10px] text-violet-600 dark:text-violet-400 mt-1">
                ✨ New unique value generated on each test run
              </p>
              
              {/* Constraint editors */}
              {step.runtimeRandom.type === 'year' && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Min Age</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.minAge || 18}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, minAge: parseInt(e.target.value) }
                        },
                        value: `{{runtime:year|minAge:${e.target.value}|maxAge:${step.runtimeRandom?.constraints?.maxAge || 100}}}`
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Max Age</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.maxAge || 100}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, maxAge: parseInt(e.target.value) }
                        },
                        value: `{{runtime:year|minAge:${step.runtimeRandom?.constraints?.minAge || 18}|maxAge:${e.target.value}}}`
                      })}
                    />
                  </div>
                </div>
              )}
              {step.runtimeRandom.type === 'number' && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <Label className="text-[10px]">Min</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.minValue ?? 1}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, minValue: parseInt(e.target.value) }
                        },
                        value: `{{runtime:number|min:${e.target.value}|max:${step.runtimeRandom?.constraints?.maxValue ?? 100}}}`
                      })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-[10px]">Max</Label>
                    <Input
                      type="number"
                      className="h-7 text-xs"
                      value={step.runtimeRandom.constraints?.maxValue ?? 100}
                      onChange={(e) => onUpdate({ 
                        runtimeRandom: { 
                          ...step.runtimeRandom!, 
                          constraints: { ...step.runtimeRandom?.constraints, maxValue: parseInt(e.target.value) }
                        },
                        value: `{{runtime:number|min:${step.runtimeRandom?.constraints?.minValue ?? 1}|max:${e.target.value}}}`
                      })}
                    />
                  </div>
                </div>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] mt-2 text-red-500"
                onClick={() => onUpdate({ runtimeRandom: undefined, value: '' })}
              >
                <X className="h-3 w-3 mr-1" />
                Clear Runtime
              </Button>
            </div>
          ) : (
            <>
              {/* Detect password fields by name */}
              {(() => {
                const isPasswordField = /password|pwd|^pass$|passwd/i.test(
                  (step.name || '') + (step.target || '') + (step.selector || '')
                );
                const hasCorruptedValue = (step.value || '').includes('ã') || 
                  (step.value || '').includes('Γ') || 
                  /^[•●○◦]+$/.test(step.value || '');
                
                return (
                  <div className="space-y-1">
                    <Input
                      type={isPasswordField ? 'password' : 'text'}
                      value={step.value || ''}
                      onChange={(e) => onUpdate({ value: e.target.value })}
                      placeholder={isPasswordField ? "Enter password" : "Text to enter"}
                      className={hasCorruptedValue ? 'border-amber-500' : ''}
                    />
                    {hasCorruptedValue && (
                      <p className="text-xs text-amber-600">
                        ⚠️ Password may have encoding issues. Please re-enter the correct value.
                      </p>
                    )}
                    {isPasswordField && !hasCorruptedValue && (
                      <p className="text-xs text-muted-foreground">
                        🔒 Password field detected
                      </p>
                    )}
                  </div>
                );
              })()}
            </>
          )}
          
          {/* Store As Variable (auto-shown for runtime random) */}
          {step.runtimeRandom?.enabled && (
            <div className="space-y-1 p-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
              <Label className="text-xs flex items-center gap-1">
                <FolderPlus className="h-3 w-3 text-blue-500" />
                Store As Variable
              </Label>
              <Input
                value={step.storeAs || ''}
                onChange={(e) => onUpdate({ storeAs: e.target.value })}
                placeholder="e.g., user_email"
                className="h-7 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{{' + (step.storeAs || 'variable') + '}}'}</code> in later steps or API calls
              </p>
            </div>
          )}
          
          {!step.runtimeRandom?.enabled && (
            <p className="text-xs text-muted-foreground">
              Use Smart Fill → Runtime options for unique values each run
            </p>
          )}
        </div>
      )}

      {step.type === 'wait' && (
        <div className="space-y-2">
          <Label>Wait Time (ms)</Label>
          <Input
            type="number"
            value={step.waitTime || 1000}
            onChange={(e) => onUpdate({ waitTime: parseInt(e.target.value) })}
          />
        </div>
      )}

      {step.type === 'api' && (
        <>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={step.method || 'GET'} onValueChange={(v) => onUpdate({ method: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Endpoint</Label>
            <Input
              value={step.endpoint || ''}
              onChange={(e) => onUpdate({ endpoint: e.target.value })}
              placeholder="/api/users"
            />
          </div>
          <div className="space-y-2">
            <Label>Body (JSON)</Label>
            <Textarea
              value={step.body || ''}
              onChange={(e) => onUpdate({ body: e.target.value })}
              placeholder='{"key": "value"}'
              className="font-mono text-sm"
              rows={3}
            />
          </div>
        </>
      )}

      {/* Visual Check Step Configuration */}
      {step.type === 'visual_check' && (
        <>
          <div className="space-y-2">
            <Label>Baseline Name</Label>
            <Input
              value={(step as any).baselineName || ''}
              onChange={(e) => onUpdate({ baselineName: e.target.value })}
              placeholder="login_page_baseline"
            />
            <p className="text-xs text-muted-foreground">Name of the baseline image to compare against (from Visual tab)</p>
          </div>
          <div className="space-y-2">
            <Label>Comparison Mode</Label>
            <Select value={(step as any).visualMode || 'anti_aliased'} onValueChange={(v) => onUpdate({ visualMode: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="anti_aliased">Anti-Aliased (Recommended)</SelectItem>
                <SelectItem value="pixel_perfect">Pixel Perfect</SelectItem>
                <SelectItem value="perceptual">Perceptual Hash</SelectItem>
                <SelectItem value="structural">Structural (SSIM)</SelectItem>
                <SelectItem value="layout">Layout Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Threshold: {((step as any).visualThreshold || 0.1) * 100}%</Label>
            <Slider
              value={[((step as any).visualThreshold || 0.1) * 100]}
              onValueChange={([v]) => onUpdate({ visualThreshold: v / 100 })}
              min={0}
              max={50}
              step={1}
            />
            <p className="text-xs text-muted-foreground">Maximum allowed difference percentage</p>
          </div>
          <div className="p-3 bg-violet-50 dark:bg-violet-900/20 rounded-lg border border-violet-200 dark:border-violet-800">
            <p className="text-xs text-violet-700 dark:text-violet-300">
              💡 <strong>How it works:</strong> This step captures a screenshot and compares it against the baseline. 
              If the difference exceeds the threshold, the test fails.
            </p>
          </div>
        </>
      )}

      {step.type === 'db_query' && (
        <div className="space-y-4 border-l-4 border-orange-600 pl-4">
          <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-medium">
            <Database className="h-4 w-4" />
            Database Query
          </div>
          
          {/* Connection Section */}
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400 mb-2 flex items-center gap-1">
              <Key className="h-3 w-3" />
              Connection Settings
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Database Type</Label>
                <Select value={step.dbType || 'postgres'} onValueChange={(v) => onUpdate({ dbType: v as any })}>
                  <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="postgres">PostgreSQL</SelectItem>
                    <SelectItem value="mysql">MySQL</SelectItem>
                    <SelectItem value="mongodb">MongoDB</SelectItem>
                    <SelectItem value="mssql">SQL Server</SelectItem>
                    <SelectItem value="oracle">Oracle</SelectItem>
                    <SelectItem value="salesforce_soql">Salesforce SOQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Connection Name</Label>
                <Select 
                  value={(step as any).connectionName || 'default'} 
                  onValueChange={(v) => onUpdate({ connectionName: v } as any)}
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="Select connection" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default (from env)</SelectItem>
                    <SelectItem value="primary_db">Primary Database</SelectItem>
                    <SelectItem value="replica_db">Read Replica</SelectItem>
                    <SelectItem value="test_db">Test Database</SelectItem>
                    <SelectItem value="custom">Custom Connection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {(step as any).connectionName === 'custom' && (
              <div className="mt-3 space-y-2">
                <Label className="text-xs">Connection String (ENV Variable Name)</Label>
                <Input
                  value={(step as any).connectionEnvVar || ''}
                  onChange={(e) => onUpdate({ connectionEnvVar: e.target.value } as any)}
                  placeholder="DATABASE_URL or DB_CONNECTION_STRING"
                  className="h-8 font-mono text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  🔒 Connection string is read from environment variable for security
                </p>
              </div>
            )}
            
            <p className="text-[10px] text-muted-foreground mt-2">
              💡 Configure database connections in Settings → Integrations → Databases
            </p>
          </div>

          {/* Query Section */}
          <div className="space-y-2">
            <Label>SQL Query</Label>
            <Textarea
              value={step.query || ''}
              onChange={(e) => onUpdate({ query: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder={step.dbType === 'mongodb' 
                ? '{ "collection": "users", "filter": { "email": "${user_email}" } }'
                : step.dbType === 'salesforce_soql'
                ? "SELECT Id, Name FROM Account WHERE Name = '${account_name}'"
                : "SELECT * FROM users WHERE email = '${user_email}'"
              }
              className="font-mono text-sm min-h-[80px]"
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Use <code className="bg-muted px-1 rounded">{'${variable_name}'}</code> to reference stored variables
            </p>
          </div>

          {/* Store Results */}
          <div className="space-y-2">
            <Label>Store Results As Variable</Label>
            <Input
              value={(step as any).storeResultsAs || ''}
              onChange={(e) => onUpdate({ storeResultsAs: e.target.value } as any)}
              onKeyDown={(e) => e.stopPropagation()}
              placeholder="query_results"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Access results: <code className="bg-muted px-1 rounded">{'${query_results[0].column_name}'}</code>
            </p>
          </div>

          {/* Variable Reference Helper */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <p className="text-xs font-medium mb-2">📦 Available Variables in Test:</p>
            <div className="flex flex-wrap gap-1">
              {allSteps
                .filter(s => s.id !== step.id && (
                  (s as any).variableName || 
                  (s as any).storeAs || 
                  (s as any).storeResultsAs ||
                  s.type === 'extract_variable' ||
                  s.type === 'generate_data' ||
                  s.type === 'api_extract'
                ))
                .slice(0, 8)
                .map((s, i) => {
                  const varName = (s as any).variableName || (s as any).storeAs || (s as any).storeResultsAs || 'value';
                  return (
                    <Badge 
                      key={i} 
                      variant="outline" 
                      className="text-[10px] font-mono cursor-pointer hover:bg-primary/10"
                      onClick={() => {
                        const currentQuery = step.query || '';
                        onUpdate({ query: currentQuery + '${' + varName + '}' });
                      }}
                    >
                      {'${' + varName + '}'}
                    </Badge>
                  );
                })
              }
              {allSteps.filter(s => (s as any).variableName || (s as any).storeAs).length === 0 && (
                <span className="text-[10px] text-muted-foreground">No variables stored yet. Use Extract or Generate steps first.</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========== MANUAL TESTING STEPS - Freeform Text ========== */}
      
      {/* Note/Comment - Freeform text for documentation */}
      {step.type === 'note' && (
        <div className="space-y-4 border-l-4 border-slate-500 pl-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <FileText className="h-4 w-4" />
            Note / Comment
          </div>
          <div className="space-y-2">
            <Label>Note Text</Label>
            <Textarea
              value={step.noteText || ''}
              onChange={(e) => onUpdate({ noteText: e.target.value })}
              placeholder="Write any notes, comments, or test documentation here...&#10;&#10;Examples:&#10;- Test setup requirements&#10;- Environment considerations&#10;- Edge cases to watch for"
              className="text-sm min-h-[120px]"
              rows={5}
            />
            <p className="text-xs text-muted-foreground">
              📝 This is a free-form text field for documentation purposes
            </p>
          </div>
        </div>
      )}
      
      {/* Manual Step - Action description with expected result */}
      {step.type === 'manual_step' && (
        <div className="space-y-4 border-l-4 border-slate-600 pl-4">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-medium">
            <ClipboardList className="h-4 w-4" />
            Manual Test Step
          </div>
          <div className="space-y-2">
            <Label>Action to Perform</Label>
            <Textarea
              value={step.manualAction || ''}
              onChange={(e) => onUpdate({ manualAction: e.target.value })}
              placeholder="Describe the manual action...&#10;e.g., Verify the color of the error message is red&#10;e.g., Check that the PDF downloads correctly"
              className="text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Expected Result</Label>
            <Textarea
              value={step.expectedResult || ''}
              onChange={(e) => onUpdate({ expectedResult: e.target.value })}
              placeholder="What should happen after this action?&#10;e.g., Error message displays in red (#FF0000)&#10;e.g., PDF opens with correct data"
              className="text-sm"
              rows={3}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            👆 Manual steps are for actions that cannot be automated but need to be documented and executed by a tester
          </p>
        </div>
      )}
      
      {/* Checkpoint - Verification point marker */}
      {step.type === 'checkpoint' && (
        <div className="space-y-4 border-l-4 border-amber-500 pl-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-medium">
            <Flag className="h-4 w-4" />
            Verification Checkpoint
          </div>
          <div className="space-y-2">
            <Label>Checkpoint Description</Label>
            <Textarea
              value={step.noteText || ''}
              onChange={(e) => onUpdate({ noteText: e.target.value })}
              placeholder="Describe what should be verified at this point...&#10;e.g., User is logged in and dashboard loads&#10;e.g., Cart contains the correct items"
              className="text-sm"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label>Pass Criteria</Label>
            <Input
              value={step.expectedResult || ''}
              onChange={(e) => onUpdate({ expectedResult: e.target.value })}
              placeholder="e.g., All elements visible, No errors in console"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            🚩 Checkpoints mark critical verification points in your test flow
          </p>
        </div>
      )}

      {/* ========== BLACK-BOX TESTING STEP EDITORS ========== */}
      
      {/* Date - Generate Relative Date */}
      {step.type === 'date_relative' && (
        <div className="space-y-4 border-l-4 border-indigo-500 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Generate Relative Date
          </div>
          <div className="space-y-2">
            <Label>Days from Today</Label>
            <Input
              type="number"
              value={(step as any).daysOffset || 1}
              onChange={(e) => onUpdate({ daysOffset: parseInt(e.target.value) } as any)}
              placeholder="1 = tomorrow, -1 = yesterday, 365 = next year"
            />
            <p className="text-xs text-muted-foreground">1 = tomorrow, -1 = yesterday, 365 = next year</p>
          </div>
          <div className="space-y-2">
            <Label>Date Format</Label>
            <Select value={(step as any).dateFormat || 'MM/DD/YYYY'} onValueChange={(v) => onUpdate({ dateFormat: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (US)</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (EU)</SelectItem>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (ISO)</SelectItem>
                <SelectItem value="MMMM DD, YYYY">Month DD, YYYY</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Store Result As Variable</Label>
            <Input
              value={(step as any).storeAs || 'generated_date'}
              onChange={(e) => onUpdate({ storeAs: e.target.value } as any)}
              placeholder="generated_date"
            />
          </div>
        </div>
      )}

      {/* Date - Verify Future */}
      {step.type === 'date_verify_future' && (
        <div className="space-y-4 border-l-4 border-indigo-600 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Verify Date is in Future
          </div>
          <div className="space-y-2">
            <Label>Date Element Selector</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[data-testid='booking-date'] or .date-field"
            />
            <p className="text-xs text-muted-foreground">The element containing the date to verify</p>
          </div>
        </div>
      )}

      {/* Date - Verify Sequence */}
      {step.type === 'date_verify_sequence' && (
        <div className="space-y-4 border-l-4 border-indigo-700 pl-4">
          <div className="flex items-center gap-2 text-indigo-700 font-medium">
            <Calendar className="h-4 w-4" />
            Verify Date Sequence (End {'>'} Start)
          </div>
          <div className="space-y-2">
            <Label>Start Date Selector</Label>
            <Input
              value={(step as any).startDateSelector || ''}
              onChange={(e) => onUpdate({ startDateSelector: e.target.value } as any)}
              placeholder="[data-testid='start-date']"
            />
          </div>
          <div className="space-y-2">
            <Label>End Date Selector</Label>
            <Input
              value={(step as any).endDateSelector || ''}
              onChange={(e) => onUpdate({ endDateSelector: e.target.value } as any)}
              placeholder="[data-testid='end-date']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Multiplication */}
      {step.type === 'math_verify_multiply' && (
        <div className="space-y-4 border-l-4 border-pink-500 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Multiplication (A × B = Result)
          </div>
          <div className="space-y-2">
            <Label>Factor 1 Selector (e.g., Quantity)</Label>
            <Input
              value={(step as any).factor1Selector || ''}
              onChange={(e) => onUpdate({ factor1Selector: e.target.value } as any)}
              placeholder="[data-testid='quantity']"
            />
          </div>
          <div className="space-y-2">
            <Label>Factor 2 Selector (e.g., Unit Price)</Label>
            <Input
              value={(step as any).factor2Selector || ''}
              onChange={(e) => onUpdate({ factor2Selector: e.target.value } as any)}
              placeholder="[data-testid='price']"
            />
          </div>
          <div className="space-y-2">
            <Label>Result Selector (e.g., Line Total)</Label>
            <Input
              value={(step as any).resultSelector || ''}
              onChange={(e) => onUpdate({ resultSelector: e.target.value } as any)}
              placeholder="[data-testid='total']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Sum */}
      {step.type === 'math_verify_sum' && (
        <div className="space-y-4 border-l-4 border-pink-600 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Sum of List
          </div>
          <div className="space-y-2">
            <Label>List Items Selector</Label>
            <Input
              value={(step as any).listSelector || ''}
              onChange={(e) => onUpdate({ listSelector: e.target.value } as any)}
              placeholder=".cart-item-price (selects all price elements)"
            />
            <p className="text-xs text-muted-foreground">Should match all items to sum</p>
          </div>
          <div className="space-y-2">
            <Label>Total Selector</Label>
            <Input
              value={(step as any).totalSelector || ''}
              onChange={(e) => onUpdate({ totalSelector: e.target.value } as any)}
              placeholder="[data-testid='subtotal']"
            />
          </div>
        </div>
      )}

      {/* Math - Verify Discount */}
      {step.type === 'math_verify_discount' && (
        <div className="space-y-4 border-l-4 border-pink-700 pl-4">
          <div className="flex items-center gap-2 text-pink-700 font-medium">
            <Calculator className="h-4 w-4" />
            Verify Percentage Discount
          </div>
          <div className="space-y-2">
            <Label>Original Price Selector</Label>
            <Input
              value={(step as any).originalPriceSelector || ''}
              onChange={(e) => onUpdate({ originalPriceSelector: e.target.value } as any)}
              placeholder="[data-testid='original-price']"
            />
          </div>
          <div className="space-y-2">
            <Label>Discount Percentage</Label>
            <Input
              type="number"
              value={(step as any).discountPercent || 10}
              onChange={(e) => onUpdate({ discountPercent: parseFloat(e.target.value) } as any)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Final Price Selector</Label>
            <Input
              value={(step as any).finalPriceSelector || ''}
              onChange={(e) => onUpdate({ finalPriceSelector: e.target.value } as any)}
              placeholder="[data-testid='final-price']"
            />
          </div>
        </div>
      )}

      {/* Format - Verify Format */}
      {step.type === 'format_verify' && (
        <div className="space-y-4 border-l-4 border-cyan-500 pl-4">
          <div className="flex items-center gap-2 text-cyan-700 font-medium">
            <CheckCircle className="h-4 w-4" />
            Verify Text Format
          </div>
          <div className="space-y-2">
            <Label>Element Selector</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[data-testid='email-input']"
            />
          </div>
          <div className="space-y-2">
            <Label>Format Type</Label>
            <Select value={(step as any).formatType || 'email'} onValueChange={(v) => onUpdate({ formatType: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="email">Email (user@domain.com)</SelectItem>
                <SelectItem value="phone">Phone Number</SelectItem>
                <SelectItem value="ssn">SSN (XXX-XX-XXXX)</SelectItem>
                <SelectItem value="zip">ZIP Code</SelectItem>
                <SelectItem value="credit_card">Credit Card</SelectItem>
                <SelectItem value="url">URL</SelectItem>
                <SelectItem value="password_strong">Strong Password</SelectItem>
                <SelectItem value="custom">Custom Regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(step as any).formatType === 'custom' && (
            <div className="space-y-2">
              <Label>Custom Regex Pattern</Label>
              <Input
                value={(step as any).customRegex || ''}
                onChange={(e) => onUpdate({ customRegex: e.target.value } as any)}
                placeholder="^[A-Z]{2}[0-9]{4}$"
                className="font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Random String Generator */}
      {step.type === 'random_string' && (
        <div className="space-y-4 border-l-4 border-cyan-600 pl-4">
          <div className="flex items-center gap-2 text-cyan-700 font-medium">
            <Shuffle className="h-4 w-4" />
            Generate Random String
          </div>
          <div className="space-y-2">
            <Label>String Type</Label>
            <Select value={(step as any).stringType || 'alphanumeric'} onValueChange={(v) => onUpdate({ stringType: v } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="alphanumeric">Alphanumeric (abc123)</SelectItem>
                <SelectItem value="alpha">Letters Only (abc)</SelectItem>
                <SelectItem value="numeric">Numbers Only (123)</SelectItem>
                <SelectItem value="email">Email (test_1234@example.com)</SelectItem>
                <SelectItem value="phone">Phone (+12025551234)</SelectItem>
                <SelectItem value="username">Username (user_12345)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Length</Label>
            <Input
              type="number"
              value={(step as any).length || 10}
              onChange={(e) => onUpdate({ length: parseInt(e.target.value) } as any)}
              placeholder="10"
            />
          </div>
          <div className="space-y-2">
            <Label>Store As Variable</Label>
            <Input
              value={(step as any).storeAs || 'random_value'}
              onChange={(e) => onUpdate({ storeAs: e.target.value } as any)}
              placeholder="random_value"
            />
          </div>
        </div>
      )}

      {/* Field Visibility */}
      {step.type === 'field_visibility' && (
        <div className="space-y-4 border-l-4 border-orange-500 pl-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium">
            <Eye className="h-4 w-4" />
            Verify Field Shows/Hides Based on Selection
          </div>
          <div className="space-y-2">
            <Label>Trigger Element Selector (e.g., Dropdown)</Label>
            <Input
              value={(step as any).triggerSelector || ''}
              onChange={(e) => onUpdate({ triggerSelector: e.target.value } as any)}
              placeholder="[data-testid='country-select']"
            />
          </div>
          <div className="space-y-2">
            <Label>Trigger Value (what to select)</Label>
            <Input
              value={(step as any).triggerValue || ''}
              onChange={(e) => onUpdate({ triggerValue: e.target.value } as any)}
              placeholder="USA"
            />
          </div>
          <div className="space-y-2">
            <Label>Target Field Selector</Label>
            <Input
              value={(step as any).targetSelector || ''}
              onChange={(e) => onUpdate({ targetSelector: e.target.value } as any)}
              placeholder="[data-testid='state-dropdown']"
            />
          </div>
          <div className="space-y-2">
            <Label>Expected Visibility</Label>
            <Select value={(step as any).shouldBeVisible !== false ? 'visible' : 'hidden'} onValueChange={(v) => onUpdate({ shouldBeVisible: v === 'visible' } as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="visible">Should be Visible</SelectItem>
                <SelectItem value="hidden">Should be Hidden</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Boundary Value Test */}
      {step.type === 'boundary_test' && (
        <div className="space-y-4 border-l-4 border-orange-600 pl-4">
          <div className="flex items-center gap-2 text-orange-700 font-medium">
            <AlertTriangle className="h-4 w-4" />
            Boundary Value Analysis
          </div>
          <p className="text-xs text-muted-foreground">
            Auto-tests: min-1 (fail), min (pass), max (pass), max+1 (fail)
          </p>
          <div className="space-y-2">
            <Label>Input Field Selector</Label>
            <Input
              value={(step as any).inputSelector || ''}
              onChange={(e) => onUpdate({ inputSelector: e.target.value } as any)}
              placeholder="[data-testid='age-input']"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Min Value</Label>
              <Input
                type="number"
                value={(step as any).minValue ?? 0}
                onChange={(e) => onUpdate({ minValue: parseInt(e.target.value) } as any)}
                placeholder="0"
              />
            </div>
            <div className="space-y-2">
              <Label>Max Value</Label>
              <Input
                type="number"
                value={(step as any).maxValue ?? 100}
                onChange={(e) => onUpdate({ maxValue: parseInt(e.target.value) } as any)}
                placeholder="100"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Submit Button Selector (optional)</Label>
            <Input
              value={(step as any).submitSelector || ''}
              onChange={(e) => onUpdate({ submitSelector: e.target.value } as any)}
              placeholder="[type='submit']"
            />
          </div>
          <div className="space-y-2">
            <Label>Error Message Selector (optional)</Label>
            <Input
              value={(step as any).errorSelector || ''}
              onChange={(e) => onUpdate({ errorSelector: e.target.value } as any)}
              placeholder=".error-message, [role='alert']"
            />
          </div>
        </div>
      )}

      {/* ========== ADVANCED UI STEP EDITORS ========== */}

      {/* Smart Select - Dynamic element selection */}
      {step.type === 'smart_select' && (
        <div className="space-y-4 border-l-4 border-emerald-500 pl-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
            <Target className="h-4 w-4" />
            Smart Element Selection
          </div>
          <p className="text-xs text-muted-foreground">
            Find and interact with elements dynamically by text, attribute, or other criteria. Perfect for when element positions change.
          </p>
          
          <div className="space-y-2">
            <Label>Find Element By</Label>
            <Select value={step.findBy || 'text'} onValueChange={(v) => onUpdate({ findBy: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Content (exact match)</SelectItem>
                <SelectItem value="contains">Text Contains (partial match)</SelectItem>
                <SelectItem value="attribute">Attribute Value</SelectItem>
                <SelectItem value="index">Index/Position</SelectItem>
                <SelectItem value="css">CSS Selector</SelectItem>
                <SelectItem value="xpath">XPath</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {step.findBy === 'attribute' && (
            <div className="space-y-2">
              <Label>Attribute Name</Label>
              <Input
                value={step.findAttribute || ''}
                onChange={(e) => onUpdate({ findAttribute: e.target.value })}
                placeholder="data-product-id, data-price, title, etc."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{step.findBy === 'index' ? 'Element Index (0-based)' : step.findBy === 'attribute' ? 'Attribute Value' : 'Search Criteria'}</Label>
            {step.findBy === 'index' ? (
              <Input
                type="number"
                value={step.findIndex ?? 0}
                onChange={(e) => onUpdate({ findIndex: parseInt(e.target.value) })}
                placeholder="0"
              />
            ) : (
              <Input
                value={step.findCriteria || ''}
                onChange={(e) => onUpdate({ findCriteria: e.target.value })}
                placeholder={
                  step.findBy === 'text' ? 'MacBook Pro 14"' :
                  step.findBy === 'contains' ? 'MacBook' :
                  step.findBy === 'attribute' ? '12345' :
                  step.findBy === 'css' ? '.product-card:first-child' :
                  '//div[@class="product"]'
                }
              />
            )}
          </div>

          <div className="space-y-2">
            <Label>Search Within (optional container)</Label>
            <Input
              value={step.findWithin || ''}
              onChange={(e) => onUpdate({ findWithin: e.target.value })}
              placeholder=".product-grid, #search-results, table tbody"
            />
            <p className="text-[10px] text-muted-foreground">
              Narrow down search to a specific container element
            </p>
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2">
              💡 Example Use Cases:
            </p>
            <ul className="text-[10px] text-emerald-600 dark:text-emerald-500 space-y-1">
              <li>• Select product by name: Text = "MacBook Pro 14""</li>
              <li>• Find by price: Attribute = "data-price", Value = "1999"</li>
              <li>• Click nth item: Index = 0 (first item)</li>
              <li>• Complex selection: CSS = ".product[data-stock='true']:first-child"</li>
            </ul>
          </div>
        </div>
      )}

      {/* Extract Variable - Extract value from element */}
      {step.type === 'extract_variable' && (
        <div className="space-y-4 border-l-4 border-emerald-500 pl-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
            <Download className="h-4 w-4" />
            Extract & Store Value
          </div>
          <p className="text-xs text-muted-foreground">
            Extract a value from the page and store it as a variable for later use in assertions or other steps.
          </p>
          
          <div className="space-y-2">
            <Label>Element to Extract From</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder=".price, #total-amount, [data-testid='cart-total']"
            />
          </div>

          <div className="space-y-2">
            <Label>Extract Type</Label>
            <Select value={step.extractType || 'text'} onValueChange={(v) => onUpdate({ extractType: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Content</SelectItem>
                <SelectItem value="number">Number (strips $, commas)</SelectItem>
                <SelectItem value="attribute">Attribute Value</SelectItem>
                <SelectItem value="count">Element Count</SelectItem>
                <SelectItem value="html">Inner HTML</SelectItem>
                <SelectItem value="list">List of Values</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {step.extractType === 'attribute' && (
            <div className="space-y-2">
              <Label>Attribute Name</Label>
              <Input
                value={step.extractAttribute || ''}
                onChange={(e) => onUpdate({ extractAttribute: e.target.value })}
                placeholder="href, data-id, value"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Regex Pattern (optional)</Label>
            <Input
              value={step.extractRegex || ''}
              onChange={(e) => onUpdate({ extractRegex: e.target.value })}
              placeholder="\$?([\d,]+\.?\d*)"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Extract a specific part using regex. Group 1 will be captured.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Store As Variable</Label>
            <Input
              value={step.variableName || ''}
              onChange={(e) => onUpdate({ variableName: e.target.value })}
              placeholder="product_price, cart_total, item_count"
              className="font-mono"
            />
          </div>

          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-1">
              Use in later steps:
            </p>
            <code className="text-[10px] bg-white dark:bg-slate-800 px-2 py-1 rounded border block">
              {'${'}{step.variableName || 'variable_name'}{'}'}
            </code>
          </div>
        </div>
      )}

      {/* Computed Assert - Math and string assertions */}
      {step.type === 'computed_assert' && (
        <div className="space-y-4 border-l-4 border-emerald-600 pl-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium">
            <Calculator className="h-4 w-4" />
            Computed Assertion
          </div>
          <p className="text-xs text-muted-foreground">
            Verify calculations using extracted variables. Perfect for pricing, taxes, discounts, and totals.
          </p>
          
          <div className="space-y-2">
            <Label>Left Expression</Label>
            <Input
              value={step.expression || ''}
              onChange={(e) => onUpdate({ expression: e.target.value })}
              placeholder="${subtotal} + ${tax}"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Supports: +, -, *, /, %, round(), floor(), ceil()
            </p>
          </div>

          <div className="space-y-2">
            <Label>Comparison</Label>
            <Select value={step.compareOperator || '=='} onValueChange={(v) => onUpdate({ compareOperator: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="==">Equals (==)</SelectItem>
                <SelectItem value="!=">Not Equals (!=)</SelectItem>
                <SelectItem value=">">Greater Than (&gt;)</SelectItem>
                <SelectItem value="<">Less Than (&lt;)</SelectItem>
                <SelectItem value=">=">Greater or Equal (&gt;=)</SelectItem>
                <SelectItem value="<=">Less or Equal (&lt;=)</SelectItem>
                <SelectItem value="contains">Contains (string)</SelectItem>
                <SelectItem value="matches">Matches (regex)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Right Expression / Expected Value</Label>
            <Input
              value={step.compareValue || ''}
              onChange={(e) => onUpdate({ compareValue: e.target.value })}
              placeholder="${total} or 199.99"
              className="font-mono"
            />
          </div>

          {['==', '!='].includes(step.compareOperator || '==') && (
            <div className="space-y-2">
              <Label>Tolerance (for floating point)</Label>
              <Input
                type="number"
                step="0.001"
                value={step.tolerance ?? 0.01}
                onChange={(e) => onUpdate({ tolerance: parseFloat(e.target.value) })}
                placeholder="0.01"
              />
              <p className="text-[10px] text-muted-foreground">
                Allow small differences for floating point comparison
              </p>
            </div>
          )}

          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg space-y-2">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              💡 Example Assertions:
            </p>
            <div className="text-[10px] text-emerald-600 dark:text-emerald-500 space-y-1 font-mono">
              <div>{'${price} * ${quantity}'} == {'${line_total}'}</div>
              <div>{'${subtotal} + ${tax}'} == {'${grand_total}'}</div>
              <div>{'${original} * 0.9'} == {'${discounted}'} (10% off)</div>
              <div>round({'${subtotal} * 0.0825'}, 2) == {'${tax}'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Table Find - Find row in table by column value */}
      {step.type === 'table_find' && (
        <div className="space-y-4 border-l-4 border-teal-500 pl-4">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium">
            <Table className="h-4 w-4" />
            Find Row in Table
          </div>
          <p className="text-xs text-muted-foreground">
            Find a specific row by matching a column value, then click an action button in that row.
          </p>
          
          <div className="space-y-2">
            <Label>Table Selector</Label>
            <Input
              value={step.tableSelector || 'table'}
              onChange={(e) => onUpdate({ tableSelector: e.target.value })}
              placeholder="table, .data-grid, #orders-table"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Find in Column</Label>
              <Input
                value={step.columnName || ''}
                onChange={(e) => onUpdate({ columnName: e.target.value })}
                placeholder="Order ID, Name, Status"
              />
            </div>
            <div className="space-y-2">
              <Label>Where Value Equals</Label>
              <Input
                value={step.rowCriteria || ''}
                onChange={(e) => onUpdate({ rowCriteria: e.target.value })}
                placeholder="ORD-12345, John Doe"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Then Click Button (optional)</Label>
            <Input
              value={step.actionButton || ''}
              onChange={(e) => onUpdate({ actionButton: e.target.value })}
              placeholder="Edit, Delete, View, Download"
            />
            <p className="text-[10px] text-muted-foreground">
              Button text to click in the found row
            </p>
          </div>

          <div className="p-3 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
            <p className="text-xs font-medium text-teal-700 dark:text-teal-400 mb-1">
              Example: Find order and click Edit
            </p>
            <code className="text-[10px] text-teal-600 dark:text-teal-500 block">
              Table: #orders-table | Column: "Order ID" | Value: "ORD-12345" | Click: "Edit"
            </code>
          </div>
        </div>
      )}

      {/* Table Extract - Extract data from table row */}
      {step.type === 'table_extract' && (
        <div className="space-y-4 border-l-4 border-teal-500 pl-4">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium">
            <Download className="h-4 w-4" />
            Extract Row Data from Table
          </div>
          <p className="text-xs text-muted-foreground">
            Find a row and extract values from specific columns into variables.
          </p>
          
          <div className="space-y-2">
            <Label>Table Selector</Label>
            <Input
              value={step.tableSelector || 'table'}
              onChange={(e) => onUpdate({ tableSelector: e.target.value })}
              placeholder="table, .data-grid, #products-table"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Find in Column</Label>
              <Input
                value={step.columnName || ''}
                onChange={(e) => onUpdate({ columnName: e.target.value })}
                placeholder="Product Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Where Value Equals</Label>
              <Input
                value={step.rowCriteria || ''}
                onChange={(e) => onUpdate({ rowCriteria: e.target.value })}
                placeholder="MacBook Pro"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Columns to Extract (comma-separated)</Label>
            <Input
              value={(step.extractColumns || []).join(', ')}
              onChange={(e) => onUpdate({ extractColumns: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Price, Quantity, Total"
            />
          </div>

          <div className="space-y-2">
            <Label>Store As Variable Prefix</Label>
            <Input
              value={step.variableName || 'row'}
              onChange={(e) => onUpdate({ variableName: e.target.value })}
              placeholder="product"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Variables will be: {'${'}{step.variableName || 'row'}_Price{'}'}, {'${'}{step.variableName || 'row'}_Quantity{'}'}
            </p>
          </div>
        </div>
      )}

      {/* Table Assert - Verify table data */}
      {step.type === 'table_assert' && (
        <div className="space-y-4 border-l-4 border-teal-600 pl-4">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium">
            <CheckCircle className="h-4 w-4" />
            Assert Table Data
          </div>
          <p className="text-xs text-muted-foreground">
            Verify that a table contains specific data or that a row exists.
          </p>
          
          <div className="space-y-2">
            <Label>Table Selector</Label>
            <Input
              value={step.tableSelector || 'table'}
              onChange={(e) => onUpdate({ tableSelector: e.target.value })}
              placeholder="table, .data-grid"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Column to Check</Label>
              <Input
                value={step.columnName || ''}
                onChange={(e) => onUpdate({ columnName: e.target.value })}
                placeholder="Status"
              />
            </div>
            <div className="space-y-2">
              <Label>Expected Value</Label>
              <Input
                value={step.rowCriteria || ''}
                onChange={(e) => onUpdate({ rowCriteria: e.target.value })}
                placeholder="Completed, Active"
              />
            </div>
          </div>
        </div>
      )}

      {/* Drag and Drop */}
      {step.type === 'drag_drop' && (
        <div className="space-y-4 border-l-4 border-amber-500 pl-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <Move className="h-4 w-4" />
            Drag & Drop
          </div>
          <p className="text-xs text-muted-foreground">
            Drag an element from source to target location.
          </p>
          
          <div className="space-y-2">
            <Label>Source Element (what to drag)</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder=".draggable-item, [draggable='true']"
            />
          </div>

          <div className="space-y-2">
            <Label>Target Element (where to drop)</Label>
            <Input
              value={step.targetSelector || ''}
              onChange={(e) => onUpdate({ targetSelector: e.target.value })}
              placeholder=".drop-zone, #cart-area"
            />
          </div>
        </div>
      )}

      {/* Slider */}
      {step.type === 'slider' && (
        <div className="space-y-4 border-l-4 border-amber-500 pl-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <Sliders className="h-4 w-4" />
            Set Slider Value
          </div>
          <p className="text-xs text-muted-foreground">
            Set a slider or range input to a specific value.
          </p>
          
          <div className="space-y-2">
            <Label>Slider Element</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[type='range'], .slider, #price-slider"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Min Value</Label>
              <Input
                type="number"
                value={step.sliderMin ?? 0}
                onChange={(e) => onUpdate({ sliderMin: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Value</Label>
              <Input
                type="number"
                value={step.sliderMax ?? 100}
                onChange={(e) => onUpdate({ sliderMax: parseFloat(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Set To</Label>
              <Input
                type="number"
                value={step.sliderValue ?? 50}
                onChange={(e) => onUpdate({ sliderValue: parseFloat(e.target.value) })}
              />
            </div>
          </div>
        </div>
      )}

      {/* Date Picker */}
      {step.type === 'date_picker' && (
        <div className="space-y-4 border-l-4 border-amber-600 pl-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <Calendar className="h-4 w-4" />
            Select Date
          </div>
          <p className="text-xs text-muted-foreground">
            Select a date from a date picker control.
          </p>
          
          <div className="space-y-2">
            <Label>Date Input Element</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="[type='date'], .datepicker, #departure-date"
            />
          </div>

          <div className="space-y-2">
            <Label>Date Value</Label>
            <Input
              type="date"
              value={step.dateValue || ''}
              onChange={(e) => onUpdate({ dateValue: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Date Format (for custom pickers)</Label>
            <Select value={step.dateFormat || 'YYYY-MM-DD'} onValueChange={(v) => onUpdate({ dateFormat: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="YYYY-MM-DD">YYYY-MM-DD (2024-01-15)</SelectItem>
                <SelectItem value="MM/DD/YYYY">MM/DD/YYYY (01/15/2024)</SelectItem>
                <SelectItem value="DD/MM/YYYY">DD/MM/YYYY (15/01/2024)</SelectItem>
                <SelectItem value="MMM DD, YYYY">MMM DD, YYYY (Jan 15, 2024)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Keyboard */}
      {step.type === 'keyboard' && (
        <div className="space-y-4 border-l-4 border-amber-600 pl-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <Keyboard className="h-4 w-4" />
            Press Keyboard Keys
          </div>
          <p className="text-xs text-muted-foreground">
            Press keyboard keys, optionally with modifiers (Ctrl, Shift, Alt).
          </p>
          
          <div className="space-y-2">
            <Label>Key to Press</Label>
            <Select value={step.keyToPress || 'Enter'} onValueChange={(v) => onUpdate({ keyToPress: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Enter">Enter</SelectItem>
                <SelectItem value="Tab">Tab</SelectItem>
                <SelectItem value="Escape">Escape</SelectItem>
                <SelectItem value="Backspace">Backspace</SelectItem>
                <SelectItem value="Delete">Delete</SelectItem>
                <SelectItem value="ArrowUp">Arrow Up</SelectItem>
                <SelectItem value="ArrowDown">Arrow Down</SelectItem>
                <SelectItem value="ArrowLeft">Arrow Left</SelectItem>
                <SelectItem value="ArrowRight">Arrow Right</SelectItem>
                <SelectItem value="Home">Home</SelectItem>
                <SelectItem value="End">End</SelectItem>
                <SelectItem value="PageUp">Page Up</SelectItem>
                <SelectItem value="PageDown">Page Down</SelectItem>
                <SelectItem value="a">A (for Ctrl+A)</SelectItem>
                <SelectItem value="c">C (for Ctrl+C)</SelectItem>
                <SelectItem value="v">V (for Ctrl+V)</SelectItem>
                <SelectItem value="z">Z (for Ctrl+Z)</SelectItem>
                <SelectItem value="s">S (for Ctrl+S)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Modifier Keys (optional)</Label>
            <div className="flex flex-wrap gap-2">
              {(['ctrl', 'shift', 'alt', 'meta'] as const).map((mod) => (
                <label key={mod} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={(step.keyModifiers || []).includes(mod)}
                    onChange={(e) => {
                      const current = step.keyModifiers || [];
                      if (e.target.checked) {
                        onUpdate({ keyModifiers: [...current, mod] });
                      } else {
                        onUpdate({ keyModifiers: current.filter(m => m !== mod) });
                      }
                    }}
                    className="rounded"
                  />
                  {mod === 'meta' ? 'Cmd/Win' : mod.charAt(0).toUpperCase() + mod.slice(1)}
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Select */}
      {step.type === 'multi_select' && (
        <div className="space-y-4 border-l-4 border-amber-700 pl-4">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
            <CheckSquare className="h-4 w-4" />
            Multi-Select Options
          </div>
          <p className="text-xs text-muted-foreground">
            Select multiple options from a multi-select dropdown or checkbox group.
          </p>
          
          <div className="space-y-2">
            <Label>Select Element</Label>
            <Input
              value={step.selector || ''}
              onChange={(e) => onUpdate({ selector: e.target.value })}
              placeholder="select[multiple], .checkbox-group"
            />
          </div>

          <div className="space-y-2">
            <Label>Values to Select (comma-separated)</Label>
            <Input
              value={(step.selectValues || []).join(', ')}
              onChange={(e) => onUpdate({ selectValues: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="Option 1, Option 2, Option 3"
            />
          </div>
        </div>
      )}

      {/* Frame Switch */}
      {step.type === 'frame_switch' && (
        <div className="space-y-4 border-l-4 border-fuchsia-500 pl-4">
          <div className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-400 font-medium">
            <Layout className="h-4 w-4" />
            Switch to iFrame
          </div>
          <p className="text-xs text-muted-foreground">
            Switch context to an iframe to interact with elements inside it.
          </p>
          
          <div className="space-y-2">
            <Label>Frame Selector or Index</Label>
            <Input
              value={step.frameSelector || ''}
              onChange={(e) => onUpdate({ frameSelector: e.target.value })}
              placeholder="iframe#payment, [name='checkout'], 0 (for first frame)"
            />
            <p className="text-[10px] text-muted-foreground">
              Use selector like "iframe#id" or index like "0" for first iframe
            </p>
          </div>

          <div className="p-3 bg-fuchsia-50 dark:bg-fuchsia-900/20 rounded-lg">
            <p className="text-xs text-fuchsia-700 dark:text-fuchsia-400">
              💡 Use "main" or leave empty to switch back to main page content
            </p>
          </div>
        </div>
      )}

      {/* Tab Control */}
      {step.type === 'new_tab' && (
        <div className="space-y-4 border-l-4 border-fuchsia-500 pl-4">
          <div className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-400 font-medium">
            <Maximize2 className="h-4 w-4" />
            Browser Tab Control
          </div>
          <p className="text-xs text-muted-foreground">
            Control browser tabs - create new, switch between, or close tabs.
          </p>
          
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={step.tabAction || 'new'} onValueChange={(v) => onUpdate({ tabAction: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Open New Tab</SelectItem>
                <SelectItem value="switch">Switch to Tab</SelectItem>
                <SelectItem value="close">Close Tab</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(step.tabAction === 'switch' || step.tabAction === 'close') && (
            <div className="space-y-2">
              <Label>Tab Index (0-based)</Label>
              <Input
                type="number"
                value={step.tabIndex ?? 0}
                onChange={(e) => onUpdate({ tabIndex: parseInt(e.target.value) })}
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground">
                0 = first tab, 1 = second tab, etc. Use -1 for last tab.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Alert Handle */}
      {step.type === 'alert_handle' && (
        <div className="space-y-4 border-l-4 border-fuchsia-600 pl-4">
          <div className="flex items-center gap-2 text-fuchsia-700 dark:text-fuchsia-400 font-medium">
            <AlertCircle className="h-4 w-4" />
            Handle JavaScript Alert/Confirm/Prompt
          </div>
          <p className="text-xs text-muted-foreground">
            Handle browser dialogs (alert, confirm, prompt).
          </p>
          
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={step.alertAction || 'accept'} onValueChange={(v) => onUpdate({ alertAction: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="accept">Accept (OK)</SelectItem>
                <SelectItem value="dismiss">Dismiss (Cancel)</SelectItem>
                <SelectItem value="getText">Get Text (extract message)</SelectItem>
                <SelectItem value="type">Type into Prompt</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {step.alertAction === 'type' && (
            <div className="space-y-2">
              <Label>Text to Enter</Label>
              <Input
                value={step.alertText || ''}
                onChange={(e) => onUpdate({ alertText: e.target.value })}
                placeholder="Enter value for prompt"
              />
            </div>
          )}

          {step.alertAction === 'getText' && (
            <div className="space-y-2">
              <Label>Store Message As Variable</Label>
              <Input
                value={step.variableName || 'alert_message'}
                onChange={(e) => onUpdate({ variableName: e.target.value })}
                placeholder="alert_message"
                className="font-mono"
              />
            </div>
          )}
        </div>
      )}

      {/* Condition - If/Then/Else */}
      {step.type === 'condition' && (
        <div className="space-y-4 border-l-4 border-purple-500 pl-4">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-medium">
            <Share2 className="h-4 w-4" />
            Conditional Logic (If / Then / Else)
          </div>
          <p className="text-xs text-muted-foreground">
            Execute different steps based on a condition.
          </p>
          
          <div className="space-y-2">
            <Label>Condition Expression</Label>
            <Input
              value={step.conditionExpression || ''}
              onChange={(e) => onUpdate({ conditionExpression: e.target.value })}
              placeholder="${stock} > 0, element_exists('.in-stock'), ${price} < 100"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Use variables, comparisons, or element_exists() checks
            </p>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg space-y-2">
            <p className="text-xs font-medium text-purple-700 dark:text-purple-400">
              💡 Example Conditions:
            </p>
            <div className="text-[10px] text-purple-600 dark:text-purple-500 space-y-1 font-mono">
              <div>element_exists('.in-stock-badge')</div>
              <div>{'${cart_total}'} &gt; 100</div>
              <div>{'${user_type}'} == 'premium'</div>
            </div>
          </div>

          <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded border border-green-200 dark:border-green-800">
            <p className="text-xs text-green-700 dark:text-green-400">
              ✅ <strong>Then:</strong> Add steps below this condition for the "true" branch
            </p>
          </div>
        </div>
      )}

      {/* Loop - Repeat steps */}
      {step.type === 'loop' && (
        <div className="space-y-4 border-l-4 border-purple-500 pl-4">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-medium">
            <RefreshCw className="h-4 w-4" />
            Loop (Repeat Steps)
          </div>
          <p className="text-xs text-muted-foreground">
            Repeat a set of steps a specific number of times.
          </p>
          
          <div className="space-y-2">
            <Label>Loop Type</Label>
            <Select value={step.loopType || 'count'} onValueChange={(v) => onUpdate({ loopType: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="count">Count (fixed iterations)</SelectItem>
                <SelectItem value="while">While (condition true)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {step.loopType === 'count' && (
            <div className="space-y-2">
              <Label>Number of Iterations</Label>
              <Input
                type="number"
                value={step.loopCount || 1}
                onChange={(e) => onUpdate({ loopCount: parseInt(e.target.value) })}
                placeholder="5"
              />
            </div>
          )}

          {step.loopType === 'while' && (
            <div className="space-y-2">
              <Label>While Condition</Label>
              <Input
                value={step.conditionExpression || ''}
                onChange={(e) => onUpdate({ conditionExpression: e.target.value })}
                placeholder="element_exists('.next-page'), ${counter} < 10"
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Loop Variable Name</Label>
            <Input
              value={step.loopVariable || 'i'}
              onChange={(e) => onUpdate({ loopVariable: e.target.value })}
              placeholder="i"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Use {'${'}{step.loopVariable || 'i'}{'}'} to access current iteration (0, 1, 2, ...)
            </p>
          </div>
        </div>
      )}

      {/* ForEach - Loop through elements */}
      {step.type === 'foreach' && (
        <div className="space-y-4 border-l-4 border-purple-600 pl-4">
          <div className="flex items-center gap-2 text-purple-700 dark:text-purple-400 font-medium">
            <RefreshCw className="h-4 w-4" />
            For Each Element
          </div>
          <p className="text-xs text-muted-foreground">
            Loop through all matching elements and perform actions on each.
          </p>
          
          <div className="space-y-2">
            <Label>Elements Selector</Label>
            <Input
              value={step.loopSelector || ''}
              onChange={(e) => onUpdate({ loopSelector: e.target.value })}
              placeholder=".product-card, table tbody tr, .search-result"
            />
            <p className="text-[10px] text-muted-foreground">
              All matching elements will be iterated over
            </p>
          </div>

          <div className="space-y-2">
            <Label>Current Item Variable</Label>
            <Input
              value={step.loopVariable || 'item'}
              onChange={(e) => onUpdate({ loopVariable: e.target.value })}
              placeholder="item"
              className="font-mono"
            />
            <p className="text-[10px] text-muted-foreground">
              Use {'${'}{step.loopVariable || 'item'}{'}'} to reference current element in loop body
            </p>
          </div>

          <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-xs text-purple-700 dark:text-purple-400">
              💡 Add steps after this to run on each matched element
            </p>
          </div>
        </div>
      )}

      {/* ========== COMPLEX VERIFICATION STEP EDITORS ========== */}
      
      {/* Email Verify - Full email verification configuration */}
      {step.type === 'email_verify' && (
        <div className="space-y-4 border-l-4 border-indigo-500 pl-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
            <Mail className="h-4 w-4" />
            Email Verification Configuration
          </div>
          <p className="text-xs text-muted-foreground">
            Verify that an email was received with specific content. Great for registration confirmations, OTP codes, and notification testing.
          </p>
          <EmailVerifyStepConfig
            config={(step as any).emailConfig || {
              provider: 'microsoft_365',
              inbox: '',
              timeoutSeconds: 60,
              assertions: []
            }}
            onChange={(config) => onUpdate({ emailConfig: config } as any)}
          />
        </div>
      )}

      {/* PDF Verify - Full PDF verification configuration */}
      {step.type === 'pdf_verify' && (
        <div className="space-y-4 border-l-4 border-indigo-600 pl-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
            <FileText className="h-4 w-4" />
            PDF Verification Configuration
          </div>
          <p className="text-xs text-muted-foreground">
            Verify PDF document content, page count, and extract values. Supports downloaded files or URLs.
          </p>
          <PDFVerifyStepConfig
            config={(step as any).pdfConfig || {
              source: '',
              sourceType: 'download',
              assertions: []
            }}
            onChange={(config) => onUpdate({ pdfConfig: config } as any)}
          />
        </div>
      )}

      {/* File Verify - Full file verification configuration */}
      {step.type === 'file_verify' && (
        <div className="space-y-4 border-l-4 border-indigo-700 pl-4">
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-medium">
            <File className="h-4 w-4" />
            File Verification Configuration
          </div>
          <p className="text-xs text-muted-foreground">
            Verify downloaded files: CSV, Excel, JSON, images. Check file content, size, format, and extract data.
          </p>
          <FileVerifyStepConfig
            config={(step as any).fileConfig || {
              downloadTrigger: '',
              fileType: 'auto',
              assertions: []
            }}
            onChange={(config) => onUpdate({ fileConfig: config } as any)}
          />
        </div>
      )}

      {/* Expected Result with Assertion Builder - Only show for non-complex-verify steps */}
      {shouldShowGenericAssertions(step.type) && (
      <div className="space-y-3 border-t pt-4">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Expected Result & Verification
          </Label>
          <span className="text-[10px] text-muted-foreground px-2 py-0.5 bg-green-500/10 rounded">
            {step.type.toUpperCase()} specific
          </span>
        </div>
        
        {/* Quick Suggestions - Step-type specific, shown first for easy access */}
        <div className="space-y-2 p-3 bg-gradient-to-r from-green-500/5 to-emerald-500/5 rounded-lg border border-green-500/20">
          <Label className="text-xs font-medium text-green-600 dark:text-green-400">
            ⚡ Quick Add for {step.type.charAt(0).toUpperCase() + step.type.slice(1).replace(/_/g, ' ')} Step
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {getQuickSuggestions(step.type).map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                  const newAssertion: StepAssertion = {
                    id: `assert_${Date.now()}`,
                    enabled: true,
                    type: suggestion.type,
                    expected: suggestion.expected || step.value || '',
                    target: step.selector || ''
                  };
                  const newAssertions = [...assertions, newAssertion];
                  const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                  onUpdate({
                    assertions: newAssertions,
                    assertion: newAssertions[0],
                    expectedResult: newExpectedResult
                  });
                }}
                className="text-[11px] px-2.5 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-700 dark:text-green-400 rounded-md transition-colors border border-green-500/20 hover:border-green-500/40"
                title={suggestion.text}
              >
                + {suggestion.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Multiple Assertions Support */}
        <div className="space-y-3">
          {/* Current Assertions List */}
          {(step.assertions || (step.assertion?.type ? [step.assertion] : [])).map((assertion, idx) => {
            // Find assertion details from step-type specific definitions
            const stepAssertions = getAssertionsForStepType(step.type);
            let assertionDef: { needsValue?: boolean; needsTarget?: boolean; placeholder?: string; description?: string } | undefined;
            for (const cat of stepAssertions) {
              const found = cat.assertions.find(a => a.type === assertion.type);
              if (found) { assertionDef = found; break; }
            }
            
            return (
            <div key={assertion.id || idx} className="p-3 bg-muted/50 rounded-lg border border-muted space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <CheckCircle className="h-3 w-3 text-green-500" />
                  Expected Result {idx + 1}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500"
                  onClick={() => {
                    const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                    const newAssertions = assertions.filter((_, i) => i !== idx);
                    const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                    onUpdate({ 
                      assertions: newAssertions.length > 0 ? newAssertions : undefined, 
                      assertion: newAssertions[0] || undefined,
                      expectedResult: newExpectedResult || step.expectedResult
                    });
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              
              {/* Assertion Type - Step-specific categorized dropdown */}
              <Select
                value={assertion.type || ''}
                onValueChange={(value) => {
                  const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                  const newAssertions = [...assertions];
                  newAssertions[idx] = { ...assertion, type: value, enabled: true };
                  const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                  onUpdate({ 
                    assertions: newAssertions, 
                    assertion: newAssertions[0],
                    expectedResult: newExpectedResult
                  });
                }}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="What should happen? (Select expected result...)" />
                </SelectTrigger>
                <SelectContent className="max-h-[400px]">
                  {getAssertionsForStepType(step.type).map((category, catIdx) => (
                    <div key={catIdx}>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                        {category.category}
                      </div>
                      {category.assertions.map((a) => (
                        <SelectItem key={a.type} value={a.type} className="pl-4">
                          <div className="flex flex-col">
                            <span>{a.icon || '•'} {a.label}</span>
                            <span className="text-[10px] text-muted-foreground">{a.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                  {/* Also show generic assertions if needed */}
                  <div className="border-t mt-1 pt-1">
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50">
                      📋 Generic Assertions
                    </div>
                    <SelectItem value="element_visible" className="pl-4">✓ Element visible</SelectItem>
                    <SelectItem value="element_hidden" className="pl-4">✗ Element hidden</SelectItem>
                    <SelectItem value="text_contains" className="pl-4">📝 Page contains text</SelectItem>
                    <SelectItem value="url_contains" className="pl-4">🔗 URL contains</SelectItem>
                    <SelectItem value="count_equals" className="pl-4">🔢 Element count</SelectItem>
                  </div>
                </SelectContent>
              </Select>
              
              {/* Show description of selected assertion */}
              {assertion.type && assertionDef?.description && (
                <p className="text-[10px] text-muted-foreground italic">
                  → {assertionDef.description}
                </p>
              )}
              
              {/* Expected Value - Show for types that need it */}
              {assertion.type && (assertionDef?.needsValue || !['element_visible', 'element_hidden', 'element_enabled', 'element_disabled', 'page_loaded', 'no_errors', 'loading_complete', 'url_changed', 'form_submitted', 'form_reset', 'download_starts', 'element_selected', 'element_expanded', 'confirmation_dialog', 'new_tab_opens', 'dropdown_closed', 'network_idle', 'animation_complete', 'screenshot_taken', 'visual_match', 'file_accepted', 'progress_complete', 'value_accepted', 'value_formatted', 'no_validation_error', 'field_valid', 'field_invalid', 'placeholder_hidden', 'row_count_greater', 'no_rows', 'status_200', 'status_201', 'status_2xx', 'status_4xx', 'not_empty', 'record_exists', 'record_not_exists', 'field_not_empty'].includes(assertion.type)) && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Expected Value</Label>
                  <Input
                    value={assertion.expected || ''}
                    onChange={(e) => {
                      const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                      const newAssertions = [...assertions];
                      newAssertions[idx] = { ...assertion, expected: e.target.value };
                      const newExpectedResult = generateExpectedResultFromAssertions(newAssertions, step.selector);
                      onUpdate({ 
                        assertions: newAssertions, 
                        assertion: newAssertions[0],
                        expectedResult: newExpectedResult
                      });
                    }}
                    placeholder={assertionDef?.placeholder || 'Enter expected value...'}
                    className="h-8 text-xs"
                  />
                </div>
              )}
              
              {/* Target Element - Show for types that need it */}
              {assertion.type && (assertionDef?.needsTarget || ['element_visible', 'element_hidden', 'value_contains', 'value_equals', 'text_equals', 'count_equals', 'count_greater', 'count_less', 'element_text_equals', 'element_appears', 'element_disappears', 'dependent_field_enabled', 'dependent_dropdown_updated', 'dependent_field_shown', 'dependent_field_hidden', 'price_updated'].includes(assertion.type)) && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Target Element (CSS Selector)</Label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={assertion.target || ''}
                      onChange={(e) => {
                        const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                        const newAssertions = [...assertions];
                        newAssertions[idx] = { ...assertion, target: e.target.value };
                        onUpdate({ assertions: newAssertions, assertion: newAssertions[0] });
                      }}
                      placeholder={assertionDef?.placeholder || step.selector ? `Uses: ${(step.selector || '').slice(0, 25)}...` : 'CSS selector'}
                      className="h-7 text-xs flex-1"
                    />
                    {step.selector && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => {
                          const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
                          const newAssertions = [...assertions];
                          newAssertions[idx] = { ...assertion, target: step.selector };
                          onUpdate({ assertions: newAssertions, assertion: newAssertions[0] });
                        }}
                      >
                        Use Step
                      </Button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Assertion Preview */}
              <div className="flex items-center gap-2 text-xs bg-green-500/5 p-2 rounded border border-green-500/10">
                {assertion.enabled && assertion.type && (
                  <>
                    <span className="text-green-600 dark:text-green-400 font-medium">✓ Expected:</span>
                    <span className="text-muted-foreground truncate">
                      {getAssertionDescription(assertion, step.selector)}
                    </span>
                  </>
                )}
                {!assertion.type && (
                  <span className="text-muted-foreground italic">Select what should happen after this step...</span>
                )}
              </div>
            </div>
          )})}
          
          {/* Add Assertion Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-9 text-xs border-dashed border-green-500/30 hover:border-green-500/50 hover:bg-green-500/5"
            onClick={() => {
              const assertions = step.assertions || (step.assertion?.type ? [step.assertion] : []);
              const newAssertion: StepAssertion = {
                id: `assert_${Date.now()}`,
                enabled: true,
                type: '',
                target: step.selector || '',
                expected: step.value || ''
              };
              onUpdate({ 
                assertions: [...assertions, newAssertion],
                assertion: assertions[0] || newAssertion
              });
            }}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Expected Result
          </Button>
        </div>
        
        {/* Free-form expected result */}
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Summary (auto-generated or custom)</Label>
          <Textarea
            value={step.expectedResult || ''}
            onChange={(e) => onUpdate({ expectedResult: e.target.value })}
            placeholder="Auto-generated from assertions above, or type custom expected result..."
            rows={2}
            className="text-sm"
          />
        </div>
      </div>
      )}

            {/* Store Result */}
            <div className="space-y-2">
              <Label className="text-xs">Store Result As (Variable)</Label>
              <Input
                value={step.storeAs || ''}
                onChange={(e) => onUpdate({ storeAs: e.target.value })}
                placeholder="e.g., response_data"
                className="h-8 text-sm"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default StepEditor;
