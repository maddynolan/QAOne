/**
 * Salesforce Templates Component
 * 
 * A comprehensive UI for browsing, customizing, and inserting
 * Salesforce standard object test case templates.
 * 
 * Features:
 * - Browse templates by category (Sales, Service, Marketing, Common)
 * - Preview template steps
 * - Customize fields to include
 * - Generate smart fill test data
 * - Insert into current recording or create new test case
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Building2, User, Target, DollarSign, Clipboard, CheckCircle,
  Calendar, Megaphone, ChevronRight, ChevronDown, Sparkles,
  Plus, Play, Eye, Settings, RefreshCw, Copy, Download,
  Search, Filter, Layers, Zap, ArrowRight, Info, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  SALESFORCE_TEMPLATES,
  SalesforceObjectTemplate,
  SalesforceField,
  generateTestDataForTemplate,
  templateToTestSteps,
  getRequiredFields,
  generateValueForType,
  getAllTemplateNames
} from '@/modules/salesforce/lib/salesforce-templates';

// ============================================================================
// TYPES
// ============================================================================

interface SalesforceTemplatesProps {
  onInsertSteps?: (steps: any[]) => void;
  onCreateTestCase?: (testCase: any) => void;
  isRecording?: boolean;
  currentUrl?: string;
}

interface TemplateConfig {
  includeNavigation: boolean;
  includeVerification: boolean;
  selectedFields: string[];
  testData: Record<string, string>;
}

// ============================================================================
// CATEGORY ICONS
// ============================================================================

const CATEGORY_ICONS: Record<string, any> = {
  sales: DollarSign,
  service: Clipboard,
  marketing: Megaphone,
  common: Layers
};

const OBJECT_ICONS: Record<string, any> = {
  Account: Building2,
  Contact: User,
  Lead: Target,
  Opportunity: DollarSign,
  Case: Clipboard,
  Task: CheckCircle,
  Event: Calendar,
  Campaign: Megaphone
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function SalesforceTemplates({
  onInsertSteps,
  onCreateTestCase,
  isRecording = false,
  currentUrl = ''
}: SalesforceTemplatesProps) {
  // State
  const [selectedTemplate, setSelectedTemplate] = useState<SalesforceObjectTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [config, setConfig] = useState<TemplateConfig>({
    includeNavigation: true,
    includeVerification: true,
    selectedFields: [],
    testData: {}
  });

  // Filtered templates
  const filteredTemplates = useMemo(() => {
    return SALESFORCE_TEMPLATES.filter(t => {
      const matchesSearch = searchQuery === '' ||
        t.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [searchQuery, categoryFilter]);

  // Grouped by category
  const groupedTemplates = useMemo(() => {
    const groups: Record<string, SalesforceObjectTemplate[]> = {
      sales: [],
      service: [],
      marketing: [],
      common: []
    };
    filteredTemplates.forEach(t => {
      groups[t.category].push(t);
    });
    return groups;
  }, [filteredTemplates]);

  // Handle template selection
  const handleSelectTemplate = useCallback((template: SalesforceObjectTemplate) => {
    setSelectedTemplate(template);
    
    // Initialize config with all required fields and some common ones
    const requiredFields = template.fields.filter(f => f.required).map(f => f.apiName);
    const commonFields = template.fields.slice(0, 6).map(f => f.apiName);
    const selectedFields = [...new Set([...requiredFields, ...commonFields])];
    
    // Generate initial test data
    const testData = generateTestDataForTemplate(template);
    
    setConfig({
      includeNavigation: !isRecording, // Skip navigation if already recording on SF page
      includeVerification: true,
      selectedFields,
      testData
    });
    
    setShowConfigDialog(true);
  }, [isRecording]);

  // Regenerate all test data
  const handleRegenerateAll = useCallback(() => {
    if (!selectedTemplate) return;
    const newData = generateTestDataForTemplate(selectedTemplate);
    setConfig(prev => ({ ...prev, testData: newData }));
    toast.success('Test data regenerated!');
  }, [selectedTemplate]);

  // Regenerate single field
  const handleRegenerateField = useCallback((field: SalesforceField) => {
    const newValue = generateValueForType(field.smartFillType, field);
    setConfig(prev => ({
      ...prev,
      testData: { ...prev.testData, [field.apiName]: newValue }
    }));
  }, []);

  // Toggle field selection
  const handleToggleField = useCallback((apiName: string) => {
    setConfig(prev => {
      const newSelected = prev.selectedFields.includes(apiName)
        ? prev.selectedFields.filter(f => f !== apiName)
        : [...prev.selectedFields, apiName];
      return { ...prev, selectedFields: newSelected };
    });
  }, []);

  // Update field value
  const handleUpdateFieldValue = useCallback((apiName: string, value: string) => {
    setConfig(prev => ({
      ...prev,
      testData: { ...prev.testData, [apiName]: value }
    }));
  }, []);

  // Generate and insert steps
  const handleInsertSteps = useCallback(() => {
    if (!selectedTemplate) return;
    
    const steps = templateToTestSteps(selectedTemplate, config.testData, {
      includeNavigation: config.includeNavigation,
      includeVerification: config.includeVerification,
      fieldsToInclude: config.selectedFields
    });
    
    if (onInsertSteps) {
      onInsertSteps(steps);
      toast.success(`Inserted ${steps.length} steps for ${selectedTemplate.label}!`);
    }
    
    setShowConfigDialog(false);
  }, [selectedTemplate, config, onInsertSteps]);

  // Create new test case
  const handleCreateTestCase = useCallback(() => {
    if (!selectedTemplate) return;
    
    const steps = templateToTestSteps(selectedTemplate, config.testData, {
      includeNavigation: config.includeNavigation,
      includeVerification: config.includeVerification,
      fieldsToInclude: config.selectedFields
    });
    
    const testCase = {
      id: `sf_${selectedTemplate.apiName.toLowerCase()}_${Date.now()}`,
      name: `Create ${selectedTemplate.label}`,
      description: selectedTemplate.description,
      tags: ['salesforce', selectedTemplate.category, selectedTemplate.apiName.toLowerCase()],
      steps,
      category: 'salesforce-template',
      templateSource: selectedTemplate.apiName,
      createdAt: new Date().toISOString(),
      metadata: {
        source: 'salesforce-templates',
        templateVersion: '1.0',
        objectType: selectedTemplate.apiName
      }
    };
    
    if (onCreateTestCase) {
      onCreateTestCase(testCase);
      toast.success(`Created test case: "Create ${selectedTemplate.label}"!`);
    }
    
    setShowConfigDialog(false);
  }, [selectedTemplate, config, onCreateTestCase]);

  // Copy steps as JSON
  const handleCopyAsJSON = useCallback(() => {
    if (!selectedTemplate) return;
    
    const steps = templateToTestSteps(selectedTemplate, config.testData, {
      includeNavigation: config.includeNavigation,
      includeVerification: config.includeVerification,
      fieldsToInclude: config.selectedFields
    });
    
    navigator.clipboard.writeText(JSON.stringify(steps, null, 2));
    toast.success('Steps copied to clipboard!');
  }, [selectedTemplate, config]);

  // Preview steps
  const previewSteps = useMemo(() => {
    if (!selectedTemplate) return [];
    return templateToTestSteps(selectedTemplate, config.testData, {
      includeNavigation: config.includeNavigation,
      includeVerification: config.includeVerification,
      fieldsToInclude: config.selectedFields
    });
  }, [selectedTemplate, config]);

  // Detect if on Salesforce
  const isSalesforcePage = useMemo(() => {
    return currentUrl.includes('salesforce.com') || 
           currentUrl.includes('force.com') ||
           currentUrl.includes('lightning.force.com');
  }, [currentUrl]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-slate-900 to-slate-950 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Salesforce Templates</h3>
            <p className="text-xs text-slate-400">Pre-built test cases for standard objects</p>
          </div>
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 bg-card border-border text-muted-foreground text-sm"
          />
        </div>
        
        {/* Category filters */}
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <Button
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'ghost'}
            onClick={() => setCategoryFilter('all')}
            className="h-7 text-xs"
          >
            All
          </Button>
          {Object.entries(CATEGORY_ICONS).map(([cat, Icon]) => (
            <Button
              key={cat}
              size="sm"
              variant={categoryFilter === cat ? 'default' : 'ghost'}
              onClick={() => setCategoryFilter(cat)}
              className="h-7 text-xs gap-1"
            >
              <Icon className="w-3 h-3" />
              {cat.charAt(0).toUpperCase() + cat.slice(1)}
            </Button>
          ))}
        </div>
      </div>

      {/* Salesforce Detection Banner */}
      {isSalesforcePage && (
        <div className="mx-4 mt-3 p-2 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-400 text-xs">
            <CheckCircle className="w-4 h-4" />
            <span>Salesforce detected! Navigation steps will be optimized.</span>
          </div>
        </div>
      )}

      {/* Templates List */}
      <div className="flex-1 p-4 overflow-y-auto">
        {Object.entries(groupedTemplates).map(([category, templates]) => {
          if (templates.length === 0) return null;
          const CategoryIcon = CATEGORY_ICONS[category];
          
          return (
            <div key={category} className="mb-4">
              <div className="flex items-center gap-2 mb-2">
                <CategoryIcon className="w-4 h-4 text-slate-400" />
                <h4 className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {category}
                </h4>
                <Badge variant="secondary" className="text-[10px] h-4">
                  {templates.length}
                </Badge>
              </div>
              
              <div className="space-y-2">
                {templates.map(template => {
                  const Icon = OBJECT_ICONS[template.apiName] || Layers;
                  const requiredCount = template.fields.filter(f => f.required).length;
                  
                  return (
                    <Card
                      key={template.apiName}
                      className="bg-card border-border/50 hover:border-blue-500/50 transition-all cursor-pointer group"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">{template.icon}</span>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h5 className="text-sm font-medium text-foreground group-hover:text-blue-400 transition-colors">
                                Create {template.label}
                              </h5>
                              <ArrowRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5 truncate">
                              {template.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className="text-[10px] h-5 border-border text-slate-400">
                                {template.fields.length} fields
                              </Badge>
                              <Badge variant="outline" className="text-[10px] h-5 border-orange-600/50 text-orange-400">
                                {requiredCount} required
                              </Badge>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        
        {filteredTemplates.length === 0 && (
          <div className="text-center py-8">
            <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">No templates found</p>
            <p className="text-slate-500 text-xs mt-1">Try a different search term</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-3 border-t border-border/50 bg-secondary">
        <div className="text-xs text-slate-400 mb-2">Quick Create:</div>
        <div className="flex gap-2 flex-wrap">
          {['Account', 'Contact', 'Opportunity', 'Case'].map(objName => {
            const template = SALESFORCE_TEMPLATES.find(t => t.apiName === objName);
            if (!template) return null;
            return (
              <Button
                key={objName}
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-slate-500 bg-slate-800 text-slate-100 hover:border-blue-400 hover:text-blue-300 hover:bg-blue-500/20"
                onClick={() => handleSelectTemplate(template)}
              >
                <span>{template.icon}</span>
                <span className="text-slate-100">{objName}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Configuration Dialog */}
      <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] bg-input border-border">
          {selectedTemplate && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-foreground">
                  <span className="text-2xl">{selectedTemplate.icon}</span>
                  <div>
                    <div>Create {selectedTemplate.label}</div>
                    <div className="text-sm font-normal text-slate-400">
                      Configure test data and field selection
                    </div>
                  </div>
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="fields" className="mt-4">
                <TabsList className="bg-slate-800">
                  <TabsTrigger value="fields">Fields & Data</TabsTrigger>
                  <TabsTrigger value="options">Options</TabsTrigger>
                  <TabsTrigger value="preview">Preview ({previewSteps.length})</TabsTrigger>
                </TabsList>
                
                <TabsContent value="fields" className="mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <div className="text-sm text-slate-400">
                      {config.selectedFields.length} of {selectedTemplate.fields.length} fields selected
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerateAll}
                      className="h-7 text-xs gap-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      Regenerate All
                    </Button>
                  </div>
                  
                  <div className="h-[400px] pr-4 overflow-y-auto">
                    <div className="space-y-3">
                      {selectedTemplate.fields.map(field => (
                        <div
                          key={field.apiName}
                          className={`p-3 rounded-lg border transition-colors ${
                            config.selectedFields.includes(field.apiName)
                              ? 'bg-slate-800/80 border-blue-500/50'
                              : 'bg-slate-800/30 border-border/50'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox
                              id={field.apiName}
                              checked={config.selectedFields.includes(field.apiName)}
                              onCheckedChange={() => handleToggleField(field.apiName)}
                              disabled={field.required}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Label
                                  htmlFor={field.apiName}
                                  className="text-sm text-foreground font-medium cursor-pointer"
                                >
                                  {field.label}
                                </Label>
                                {field.required && (
                                  <Badge variant="destructive" className="text-[10px] h-4">
                                    Required
                                  </Badge>
                                )}
                                <Badge variant="secondary" className="text-[10px] h-4">
                                  {field.type}
                                </Badge>
                              </div>
                              
                              {config.selectedFields.includes(field.apiName) && (
                                <div className="flex gap-2 mt-2">
                                  <Input
                                    value={config.testData[field.apiName] || ''}
                                    onChange={(e) => handleUpdateFieldValue(field.apiName, e.target.value)}
                                    placeholder={`Enter ${field.label}...`}
                                    className="flex-1 h-8 text-sm bg-input border-border text-foreground placeholder:text-slate-500"
                                  />
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRegenerateField(field)}
                                    className="h-8 w-8 p-0"
                                    title="Regenerate value"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="options" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                      <div>
                        <div className="text-sm font-medium text-foreground">Include Navigation Steps</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          App Launcher → Search → Select Object → New Button
                        </div>
                      </div>
                      <Checkbox
                        checked={config.includeNavigation}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, includeNavigation: !!checked }))
                        }
                      />
                    </div>
                    
                    <div className="flex items-center justify-between p-4 rounded-lg bg-card border border-border">
                      <div>
                        <div className="text-sm font-medium text-foreground">Include Verification Steps</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          Verify toast message and record creation
                        </div>
                      </div>
                      <Checkbox
                        checked={config.includeVerification}
                        onCheckedChange={(checked) => 
                          setConfig(prev => ({ ...prev, includeVerification: !!checked }))
                        }
                      />
                    </div>
                    
                    <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                      <div className="flex items-start gap-2">
                        <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                        <div className="text-sm text-blue-300">
                          <strong>Tip:</strong> If you're already on a Salesforce page with 
                          the New {selectedTemplate.label} form open, uncheck navigation steps.
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="preview" className="mt-4">
                  <div className="h-[400px] pr-4 overflow-y-auto">
                    <div className="space-y-2">
                      {previewSteps.map((step, idx) => (
                        <div
                          key={step.id}
                          className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border"
                        >
                          <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0 text-xs font-medium text-slate-300">
                            {idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant="outline" 
                                className={`text-[10px] h-5 ${
                                  step.type === 'click' ? 'border-purple-500/50 text-purple-400' :
                                  step.type === 'fill' ? 'border-blue-500/50 text-blue-400' :
                                  step.type === 'assert' ? 'border-green-500/50 text-green-400' :
                                  'border-slate-500/50 text-slate-400'
                                }`}
                              >
                                {step.type.toUpperCase()}
                              </Badge>
                              <span className="text-sm text-foreground truncate">
                                {step.name}
                              </span>
                            </div>
                            {step.value && (
                              <div className="text-xs text-slate-400 mt-1 truncate">
                                Value: "{step.value}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="mt-4 gap-2">
                <Button
                  variant="outline"
                  onClick={handleCopyAsJSON}
                  className="gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy JSON
                </Button>
                
                {onCreateTestCase && (
                  <Button
                    variant="secondary"
                    onClick={handleCreateTestCase}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Test Case
                  </Button>
                )}
                
                {onInsertSteps && (
                  <Button
                    onClick={handleInsertSteps}
                    className="gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                  >
                    <Play className="w-4 h-4" />
                    Insert {previewSteps.length} Steps
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SalesforceTemplates;

