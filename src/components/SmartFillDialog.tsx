/**
 * SmartFillDialog - Searchable dialog for selecting data generators
 * 
 * Features:
 * - Search across all generators
 * - Browse by category
 * - See example values
 * - Configure constraints
 * - BATCH GENERATION: Generate 10,000+ unique values via backend API (with Faker)
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Search, Zap, RefreshCw, Check, Settings2, Download, Copy, Server, Infinity } from 'lucide-react';
import {
  SMART_FILL_GENERATORS,
  GENERATOR_CATEGORIES,
  searchGenerators,
  getGeneratorsByCategory,
  SmartFillGenerator,
  generateFromBackend,
  checkBackendCapabilities,
  generateBatchWithProgress,
} from '@/lib/smart-fill-generators';

interface SmartFillDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectValue: (value: string, generatorId: string) => void;
  onSelectBatch?: (values: string[], generatorId: string) => void;  // For batch generation
  fieldLabel?: string;  // For auto-detect suggestion
  enableBatchMode?: boolean;  // Show batch generation tab
}

export function SmartFillDialog({
  open,
  onOpenChange,
  onSelectValue,
  onSelectBatch,
  fieldLabel = '',
  enableBatchMode = true,
}: SmartFillDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedGenerator, setSelectedGenerator] = useState<SmartFillGenerator | null>(null);
  const [constraints, setConstraints] = useState<Record<string, any>>({});
  const [previewValue, setPreviewValue] = useState<string>('');
  
  // Batch generation state
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [batchCount, setBatchCount] = useState<number>(100);
  const [batchValues, setBatchValues] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [backendStatus, setBackendStatus] = useState<{
    fakerEnabled: boolean;
    maxUniqueCapability: string;
  } | null>(null);
  
  // Check backend capabilities on mount
  useEffect(() => {
    if (open && enableBatchMode) {
      checkBackendCapabilities().then(setBackendStatus);
    }
  }, [open, enableBatchMode]);

  // Filter generators based on search or category
  const filteredGenerators = useMemo(() => {
    if (searchQuery) {
      return searchGenerators(searchQuery);
    }
    if (selectedCategory) {
      return getGeneratorsByCategory(selectedCategory);
    }
    return SMART_FILL_GENERATORS;
  }, [searchQuery, selectedCategory]);

  // Generate preview value
  const refreshPreview = () => {
    if (selectedGenerator) {
      setPreviewValue(selectedGenerator.generate(constraints));
    }
  };

  // When selecting a generator
  const handleSelectGenerator = (gen: SmartFillGenerator) => {
    setSelectedGenerator(gen);
    // Initialize constraints with defaults
    const defaultConstraints: Record<string, any> = {};
    gen.constraints?.forEach(c => {
      defaultConstraints[c.key] = c.default;
    });
    setConstraints(defaultConstraints);
    setPreviewValue(gen.generate(defaultConstraints));
  };

  // Apply selected value
  const handleApply = () => {
    if (selectedGenerator) {
      const value = selectedGenerator.generate(constraints);
      onSelectValue(value, selectedGenerator.id);
      onOpenChange(false);
      // Reset state
      setSelectedGenerator(null);
      setSearchQuery('');
      setSelectedCategory(null);
    }
  };
  
  // Generate batch using backend API
  const handleGenerateBatch = async () => {
    if (!selectedGenerator?.backendType) return;
    
    setBatchLoading(true);
    setBatchProgress(0);
    setBatchValues([]);
    
    try {
      const values = await generateBatchWithProgress(
        selectedGenerator.backendType,
        batchCount,
        (generated, total) => {
          setBatchProgress((generated / total) * 100);
        },
        constraints
      );
      setBatchValues(values);
    } catch (error) {
      console.error('Batch generation failed:', error);
      // Fallback to frontend generation for smaller batches
      if (batchCount <= 100) {
        const values = Array.from({ length: batchCount }, () => 
          selectedGenerator.generate(constraints)
        );
        setBatchValues(values);
      }
    } finally {
      setBatchLoading(false);
    }
  };
  
  // Apply batch values
  const handleApplyBatch = () => {
    if (selectedGenerator && batchValues.length > 0 && onSelectBatch) {
      onSelectBatch(batchValues, selectedGenerator.id);
      onOpenChange(false);
      // Reset state
      setBatchValues([]);
      setSelectedGenerator(null);
    }
  };
  
  // Copy batch to clipboard
  const handleCopyBatch = () => {
    navigator.clipboard.writeText(batchValues.join('\n'));
  };
  
  // Download batch as CSV
  const handleDownloadBatch = () => {
    const csv = batchValues.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedGenerator?.id || 'data'}_${batchValues.length}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-500" />
            Smart Fill - Choose Generator
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Categories & Search */}
          <div className="w-64 border-r flex flex-col">
            {/* Search */}
            <div className="p-3 border-b">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search generators..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSelectedCategory(null);
                  }}
                  className="pl-9 h-9"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                <Button
                  variant={!selectedCategory && !searchQuery ? 'secondary' : 'ghost'}
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    setSelectedCategory(null);
                    setSearchQuery('');
                  }}
                >
                  <Zap className="h-4 w-4 mr-2" />
                  All Generators
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {SMART_FILL_GENERATORS.length}
                  </Badge>
                </Button>

                <div className="h-px bg-border my-2" />

                {GENERATOR_CATEGORIES.map((cat) => {
                  const count = getGeneratorsByCategory(cat.id).length;
                  return (
                    <Button
                      key={cat.id}
                      variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => {
                        setSelectedCategory(cat.id);
                        setSearchQuery('');
                      }}
                    >
                      <span className="mr-2">{cat.icon}</span>
                      {cat.name}
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        {count}
                      </Badge>
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Middle: Generator List */}
          <div className="flex-1 flex flex-col border-r">
            <div className="p-2 border-b bg-muted/50">
              <span className="text-xs text-muted-foreground">
                {filteredGenerators.length} generators
                {searchQuery && ` matching "${searchQuery}"`}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {filteredGenerators.map((gen) => (
                  <button
                    key={gen.id}
                    onClick={() => handleSelectGenerator(gen)}
                    className={`w-full text-left p-2 rounded-lg transition-colors ${
                      selectedGenerator?.id === gen.id
                        ? 'bg-violet-100 dark:bg-violet-900/30 border border-violet-300 dark:border-violet-700'
                        : 'hover:bg-muted'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{gen.name}</span>
                      {gen.constraints && gen.constraints.length > 0 && (
                        <Settings2 className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {gen.description}
                    </p>
                    <code className="text-[10px] text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-950/50 px-1.5 py-0.5 rounded mt-1 inline-block">
                      {gen.example()}
                    </code>
                  </button>
                ))}

                {filteredGenerators.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No generators found</p>
                    <p className="text-xs">Try a different search term</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Preview & Configure */}
          <div className="w-80 flex flex-col">
            {selectedGenerator ? (
              <>
                <div className="p-3 border-b">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">{selectedGenerator.name}</h3>
                    {selectedGenerator.supportsUnlimited && (
                      <Badge variant="outline" className="text-[9px] h-4">
                        <Infinity className="h-2.5 w-2.5 mr-0.5" />
                        Unlimited
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedGenerator.description}
                  </p>
                </div>

                {/* Constraints */}
                {selectedGenerator.constraints && selectedGenerator.constraints.length > 0 && (
                  <div className="p-3 border-b space-y-3">
                    <Label className="text-xs font-medium">Configure</Label>
                    {selectedGenerator.constraints.map((c) => (
                      <div key={c.key} className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">
                          {c.label}
                        </Label>
                        {c.type === 'number' && (
                          <Input
                            type="number"
                            className="h-8 text-sm"
                            value={constraints[c.key] ?? c.default}
                            onChange={(e) => {
                              setConstraints(prev => ({
                                ...prev,
                                [c.key]: parseInt(e.target.value) || c.default,
                              }));
                            }}
                          />
                        )}
                        {c.type === 'text' && (
                          <Input
                            className="h-8 text-sm"
                            placeholder={`Default: ${c.default || 'none'}`}
                            value={constraints[c.key] ?? ''}
                            onChange={(e) => {
                              setConstraints(prev => ({
                                ...prev,
                                [c.key]: e.target.value,
                              }));
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tabs: Single vs Batch */}
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'single' | 'batch')} className="flex-1 flex flex-col">
                  <TabsList className="mx-3 mt-2 grid grid-cols-2">
                    <TabsTrigger value="single" className="text-xs">Single Value</TabsTrigger>
                    <TabsTrigger 
                      value="batch" 
                      className="text-xs"
                      disabled={!enableBatchMode || !selectedGenerator.supportsUnlimited}
                    >
                      Batch (10K+)
                    </TabsTrigger>
                  </TabsList>
                  
                  {/* Single Value Tab */}
                  <TabsContent value="single" className="flex-1 flex flex-col p-3 pt-2 m-0">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-xs font-medium">Preview</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs"
                        onClick={refreshPreview}
                      >
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Regenerate
                      </Button>
                    </div>
                    <div className="p-3 bg-muted rounded-lg flex-1">
                      <code className="text-sm break-all">{previewValue}</code>
                    </div>
                    <Button className="w-full mt-3" onClick={handleApply}>
                      <Check className="h-4 w-4 mr-2" />
                      Use This Value
                    </Button>
                  </TabsContent>
                  
                  {/* Batch Generation Tab */}
                  <TabsContent value="batch" className="flex-1 flex flex-col p-3 pt-2 m-0">
                    {/* Backend status */}
                    {backendStatus && (
                      <div className="flex items-center gap-2 mb-3 text-xs">
                        <Server className={`h-3 w-3 ${backendStatus.fakerEnabled ? 'text-green-500' : 'text-yellow-500'}`} />
                        <span className="text-muted-foreground">
                          {backendStatus.fakerEnabled ? 'Faker enabled' : 'Basic mode'} — {backendStatus.maxUniqueCapability}
                        </span>
                      </div>
                    )}
                    
                    {/* Batch count */}
                    <div className="space-y-2 mb-3">
                      <Label className="text-xs font-medium">How many values?</Label>
                      <div className="flex gap-2">
                        {[100, 1000, 5000, 10000].map(n => (
                          <Button
                            key={n}
                            variant={batchCount === n ? 'default' : 'outline'}
                            size="sm"
                            className="text-xs h-7 px-2"
                            onClick={() => setBatchCount(n)}
                          >
                            {n >= 1000 ? `${n/1000}K` : n}
                          </Button>
                        ))}
                        <Input
                          type="number"
                          className="h-7 w-20 text-xs"
                          value={batchCount}
                          onChange={(e) => setBatchCount(parseInt(e.target.value) || 100)}
                          min={1}
                          max={100000}
                        />
                      </div>
                    </div>
                    
                    {/* Generate button */}
                    <Button 
                      onClick={handleGenerateBatch} 
                      disabled={batchLoading}
                      className="mb-3"
                    >
                      {batchLoading ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Zap className="h-4 w-4 mr-2" />
                          Generate {batchCount.toLocaleString()} Values
                        </>
                      )}
                    </Button>
                    
                    {/* Progress */}
                    {batchLoading && (
                      <Progress value={batchProgress} className="h-2 mb-3" />
                    )}
                    
                    {/* Results */}
                    {batchValues.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-xs font-medium">
                            Generated {batchValues.length.toLocaleString()} unique values
                          </Label>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyBatch}>
                              <Copy className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDownloadBatch}>
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-muted rounded-lg p-2 max-h-32">
                          <code className="text-[10px] text-muted-foreground">
                            {batchValues.slice(0, 10).map((v, i) => (
                              <div key={i}>{v}</div>
                            ))}
                            {batchValues.length > 10 && (
                              <div className="text-violet-500">... and {batchValues.length - 10} more</div>
                            )}
                          </code>
                        </div>
                        
                        {onSelectBatch && (
                          <Button className="w-full mt-3" onClick={handleApplyBatch}>
                            <Check className="h-4 w-4 mr-2" />
                            Use All {batchValues.length.toLocaleString()} Values
                          </Button>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-4">
                <div className="text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a generator</p>
                  <p className="text-xs mt-1">
                    Click any generator to preview and configure
                  </p>
                  {enableBatchMode && (
                    <p className="text-[10px] mt-3 text-violet-500">
                      Generators with <Infinity className="h-2.5 w-2.5 inline mx-0.5" /> support 10,000+ unique values
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}





