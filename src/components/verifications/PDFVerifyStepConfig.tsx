/**
 * PDF Verification Step Configuration UI
 * 
 * Allows users to configure PDF verification in the workflow editor.
 */

import React, { useState, useCallback } from 'react';
import { FileText, Plus, Trash2, Download, Link, Table, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PDFVerifyConfig, PDFAssertion, PDFAssertionType } from './types';
import { PDF_ASSERTION_TYPES } from './types';

interface PDFVerifyStepConfigProps {
  config: PDFVerifyConfig;
  onChange: (config: PDFVerifyConfig) => void;
  onPickElement?: (callback: (selector: string) => void) => void;
  readOnly?: boolean;
}

export function PDFVerifyStepConfig({ 
  config, 
  onChange,
  onPickElement,
  readOnly = false 
}: PDFVerifyStepConfigProps) {
  const [showExtract, setShowExtract] = useState(false);

  const updateConfig = useCallback((updates: Partial<PDFVerifyConfig>) => {
    onChange({ ...config, ...updates });
  }, [config, onChange]);

  const addAssertion = useCallback(() => {
    const newAssertion: PDFAssertion = {
      id: `pdf_assert_${Date.now()}`,
      type: 'contains_text',
      expected: '',
      enabled: true
    };
    updateConfig({ assertions: [...config.assertions, newAssertion] });
  }, [config.assertions, updateConfig]);

  const updateAssertion = useCallback((id: string, updates: Partial<PDFAssertion>) => {
    updateConfig({
      assertions: config.assertions.map(a => 
        a.id === id ? { ...a, ...updates } : a
      )
    });
  }, [config.assertions, updateConfig]);

  const removeAssertion = useCallback((id: string) => {
    updateConfig({
      assertions: config.assertions.filter(a => a.id !== id)
    });
  }, [config.assertions, updateConfig]);

  const handlePickDownloadButton = () => {
    if (onPickElement) {
      onPickElement((selector) => {
        updateConfig({ downloadTrigger: selector });
      });
    }
  };

  // Check if assertion type needs page input
  const needsPageInput = (type: PDFAssertionType) => {
    return ['contains_text', 'not_contains_text', 'text_matches', 'table_contains', 'table_cell_equals'].includes(type);
  };

  // Check if assertion type needs row/col input
  const needsTableInput = (type: PDFAssertionType) => {
    return type === 'table_cell_equals';
  };

  return (
    <div className="space-y-4">
      {/* Source Type */}
      <div className="space-y-2">
        <Label>PDF Source</Label>
        <Tabs 
          value={config.sourceType} 
          onValueChange={(v) => updateConfig({ sourceType: v as 'download' | 'url' | 'variable' })}
        >
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="download" disabled={readOnly}>
              <Download className="h-3 w-3 mr-1" />
              Download
            </TabsTrigger>
            <TabsTrigger value="url" disabled={readOnly}>
              <Link className="h-3 w-3 mr-1" />
              URL
            </TabsTrigger>
            <TabsTrigger value="variable" disabled={readOnly}>
              <span className="font-mono text-xs">{'{{var}}'}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="download" className="space-y-2 pt-2">
            <Label>Download Button Selector</Label>
            <div className="flex gap-2">
              <Input
                value={config.downloadTrigger || ''}
                onChange={(e) => updateConfig({ downloadTrigger: e.target.value })}
                placeholder="button#export-pdf"
                className="flex-1"
                disabled={readOnly}
              />
              {onPickElement && !readOnly && (
                <Button variant="outline" onClick={handlePickDownloadButton}>
                  Pick
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Click this element to trigger PDF download, then verify the downloaded file
            </p>
          </TabsContent>

          <TabsContent value="url" className="space-y-2 pt-2">
            <Label>PDF URL</Label>
            <Input
              value={config.source}
              onChange={(e) => updateConfig({ source: e.target.value })}
              placeholder="https://example.com/report.pdf"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Direct URL to the PDF file (supports variables like {'{{reportUrl}}'})
            </p>
          </TabsContent>

          <TabsContent value="variable" className="space-y-2 pt-2">
            <Label>Variable Name</Label>
            <Input
              value={config.source}
              onChange={(e) => updateConfig({ source: e.target.value })}
              placeholder="downloadedPdfPath"
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground">
              Variable containing the PDF path (from previous download step)
            </p>
          </TabsContent>
        </Tabs>
      </div>

      {/* Assertions */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">PDF Assertions</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addAssertion}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Verify PDF content, metadata, and structure
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.assertions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assertions added. Click "Add" to verify PDF content.
            </p>
          ) : (
            config.assertions.map((assertion) => (
              <div 
                key={assertion.id} 
                className="p-2 bg-muted/50 rounded-md space-y-2"
              >
                <div className="flex items-center gap-2">
                  <Switch
                    checked={assertion.enabled}
                    onCheckedChange={(checked) => updateAssertion(assertion.id, { enabled: checked })}
                    disabled={readOnly}
                  />
                  <Select
                    value={assertion.type}
                    onValueChange={(v) => updateAssertion(assertion.id, { type: v as PDFAssertionType })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PDF_ASSERTION_TYPES).map(([type, meta]) => (
                        <SelectItem key={type} value={type}>
                          {meta.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={assertion.expected}
                    onChange={(e) => updateAssertion(assertion.id, { expected: e.target.value })}
                    placeholder={PDF_ASSERTION_TYPES[assertion.type]?.description}
                    className="flex-1"
                    disabled={readOnly}
                  />
                  {!readOnly && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeAssertion(assertion.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
                
                {/* Additional inputs for page/table */}
                {(needsPageInput(assertion.type) || needsTableInput(assertion.type)) && (
                  <div className="flex gap-2 pl-10">
                    {needsPageInput(assertion.type) && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Page:</Label>
                        <Input
                          type="number"
                          min={1}
                          value={assertion.page || ''}
                          onChange={(e) => updateAssertion(assertion.id, { 
                            page: e.target.value ? parseInt(e.target.value) : undefined 
                          })}
                          placeholder="All"
                          className="w-20 h-7"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                    {needsTableInput(assertion.type) && (
                      <>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Row:</Label>
                          <Input
                            type="number"
                            min={0}
                            value={assertion.row || ''}
                            onChange={(e) => updateAssertion(assertion.id, { 
                              row: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="0"
                            className="w-16 h-7"
                            disabled={readOnly}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <Label className="text-xs">Col:</Label>
                          <Input
                            type="number"
                            min={0}
                            value={assertion.col || ''}
                            onChange={(e) => updateAssertion(assertion.id, { 
                              col: e.target.value ? parseInt(e.target.value) : undefined 
                            })}
                            placeholder="0"
                            className="w-16 h-7"
                            disabled={readOnly}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Extract Data */}
      <Collapsible open={showExtract} onOpenChange={setShowExtract}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Extract Data (Text, Tables)
            </span>
            <Badge variant="outline">{showExtract ? 'Hide' : 'Show'}</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          {/* Extract Text */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Extract Text by Pattern
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.extractText}
                  onCheckedChange={(checked) => 
                    updateConfig({ 
                      extractText: checked ? { pattern: '', storeAs: 'extractedText' } : undefined 
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">Extract text matching pattern</span>
              </div>
              {config.extractText && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">Regex Pattern</Label>
                    <Input
                      value={config.extractText.pattern}
                      onChange={(e) => updateConfig({ 
                        extractText: { ...config.extractText!, pattern: e.target.value }
                      })}
                      placeholder="Total: \$([0-9.]+)"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Page (optional)</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.extractText.page || ''}
                      onChange={(e) => updateConfig({ 
                        extractText: { 
                          ...config.extractText!, 
                          page: e.target.value ? parseInt(e.target.value) : undefined 
                        }
                      })}
                      placeholder="All pages"
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Store as variable</Label>
                    <Input
                      value={config.extractText.storeAs}
                      onChange={(e) => updateConfig({ 
                        extractText: { ...config.extractText!, storeAs: e.target.value }
                      })}
                      placeholder="extractedText"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Extract Table */}
          <Card>
            <CardHeader className="py-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Table className="h-4 w-4" />
                Extract Table Data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.extractTable}
                  onCheckedChange={(checked) => 
                    updateConfig({ 
                      extractTable: checked ? { page: 1, tableIndex: 0, storeAs: 'tableData' } : undefined 
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">Extract table data</span>
              </div>
              {config.extractTable && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div>
                    <Label className="text-xs">Page Number</Label>
                    <Input
                      type="number"
                      min={1}
                      value={config.extractTable.page}
                      onChange={(e) => updateConfig({ 
                        extractTable: { 
                          ...config.extractTable!, 
                          page: parseInt(e.target.value) || 1 
                        }
                      })}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Table Index (0-based)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={config.extractTable.tableIndex}
                      onChange={(e) => updateConfig({ 
                        extractTable: { 
                          ...config.extractTable!, 
                          tableIndex: parseInt(e.target.value) || 0 
                        }
                      })}
                      disabled={readOnly}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Store as variable</Label>
                    <Input
                      value={config.extractTable.storeAs}
                      onChange={(e) => updateConfig({ 
                        extractTable: { ...config.extractTable!, storeAs: e.target.value }
                      })}
                      placeholder="tableData"
                      disabled={readOnly}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/**
 * Default configuration for new PDF verify steps
 */
export function getDefaultPDFVerifyConfig(): PDFVerifyConfig {
  return {
    source: '',
    sourceType: 'download',
    assertions: []
  };
}

