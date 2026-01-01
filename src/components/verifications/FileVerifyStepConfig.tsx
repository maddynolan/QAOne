/**
 * File Download Verification Step Configuration UI
 * 
 * Allows users to configure file download verification in the workflow editor.
 * Supports CSV, Excel, JSON, XML, and image files.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { File, Plus, Trash2, Download, Table, FileJson, Image, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { FileVerifyConfig, FileAssertion, FileAssertionType } from './types';
import { FILE_ASSERTION_TYPES } from './types';

interface FileVerifyStepConfigProps {
  config: FileVerifyConfig;
  onChange: (config: FileVerifyConfig) => void;
  onPickElement?: (callback: (selector: string) => void) => void;
  readOnly?: boolean;
}

export function FileVerifyStepConfig({ 
  config, 
  onChange,
  onPickElement,
  readOnly = false 
}: FileVerifyStepConfigProps) {
  const [showExtract, setShowExtract] = useState(false);
  const [showCsvOptions, setShowCsvOptions] = useState(false);

  const updateConfig = useCallback((updates: Partial<FileVerifyConfig>) => {
    onChange({ ...config, ...updates });
  }, [config, onChange]);

  // Filter assertion types based on file type
  const availableAssertionTypes = useMemo(() => {
    const fileType = config.fileType;
    return Object.entries(FILE_ASSERTION_TYPES).filter(([_, meta]) => {
      if (meta.category === 'general') return true;
      if (fileType === 'auto') return true;
      if (fileType === 'csv' && meta.category === 'csv') return true;
      if (fileType === 'excel' && (meta.category === 'csv' || meta.category === 'excel')) return true;
      if (fileType === 'json' && meta.category === 'json') return true;
      if (fileType === 'xml' && meta.category === 'json') return true; // XML uses similar assertions
      if (fileType === 'image' && meta.category === 'image') return true;
      return false;
    });
  }, [config.fileType]);

  const addAssertion = useCallback(() => {
    const defaultType = config.fileType === 'csv' ? 'csv_row_count' :
                        config.fileType === 'json' ? 'json_path_exists' :
                        config.fileType === 'image' ? 'image_format' : 'file_exists';
    
    const newAssertion: FileAssertion = {
      id: `file_assert_${Date.now()}`,
      type: defaultType as FileAssertionType,
      expected: '',
      enabled: true
    };
    updateConfig({ assertions: [...config.assertions, newAssertion] });
  }, [config.assertions, config.fileType, updateConfig]);

  const updateAssertion = useCallback((id: string, updates: Partial<FileAssertion>) => {
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

  // Check if assertion type needs row/col/sheet input
  const needsRowCol = (type: FileAssertionType) => {
    return ['csv_cell_equals', 'csv_cell_contains'].includes(type);
  };

  const needsPath = (type: FileAssertionType) => {
    return ['json_path_equals', 'json_path_exists', 'json_array_length'].includes(type);
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'csv': return <Table className="h-4 w-4" />;
      case 'excel': return <Table className="h-4 w-4 text-green-600" />;
      case 'json': return <FileJson className="h-4 w-4 text-yellow-600" />;
      case 'xml': return <FileJson className="h-4 w-4 text-orange-600" />;
      case 'image': return <Image className="h-4 w-4 text-purple-600" />;
      default: return <File className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Download Trigger */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Download Button Selector
        </Label>
        <div className="flex gap-2">
          <Input
            value={config.downloadTrigger}
            onChange={(e) => updateConfig({ downloadTrigger: e.target.value })}
            placeholder="button#export, a.download-link"
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
          Element to click that triggers the file download
        </p>
      </div>

      {/* File Type */}
      <div className="space-y-2">
        <Label>Expected File Type</Label>
        <Select 
          value={config.fileType} 
          onValueChange={(v) => updateConfig({ fileType: v as FileVerifyConfig['fileType'] })}
          disabled={readOnly}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                Auto-detect
              </div>
            </SelectItem>
            <SelectItem value="csv">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4" />
                CSV / TSV
              </div>
            </SelectItem>
            <SelectItem value="excel">
              <div className="flex items-center gap-2">
                <Table className="h-4 w-4 text-green-600" />
                Excel (.xlsx)
              </div>
            </SelectItem>
            <SelectItem value="json">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-yellow-600" />
                JSON
              </div>
            </SelectItem>
            <SelectItem value="xml">
              <div className="flex items-center gap-2">
                <FileJson className="h-4 w-4 text-orange-600" />
                XML
              </div>
            </SelectItem>
            <SelectItem value="image">
              <div className="flex items-center gap-2">
                <Image className="h-4 w-4 text-purple-600" />
                Image (PNG, JPG, etc.)
              </div>
            </SelectItem>
            <SelectItem value="any">
              <div className="flex items-center gap-2">
                <File className="h-4 w-4" />
                Any file (basic checks only)
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* CSV Options */}
      {(config.fileType === 'csv' || config.fileType === 'auto') && (
        <Collapsible open={showCsvOptions} onOpenChange={setShowCsvOptions}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Settings className="h-3 w-3" />
                CSV Options
              </span>
              <Badge variant="outline" className="text-xs">{showCsvOptions ? 'Hide' : 'Show'}</Badge>
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-md">
              <div>
                <Label className="text-xs">Delimiter</Label>
                <Input
                  value={config.csvOptions?.delimiter || ','}
                  onChange={(e) => updateConfig({ 
                    csvOptions: { ...config.csvOptions, delimiter: e.target.value }
                  })}
                  placeholder=","
                  className="h-8"
                  disabled={readOnly}
                />
              </div>
              <div>
                <Label className="text-xs">Encoding</Label>
                <Input
                  value={config.csvOptions?.encoding || 'utf-8'}
                  onChange={(e) => updateConfig({ 
                    csvOptions: { ...config.csvOptions, encoding: e.target.value }
                  })}
                  placeholder="utf-8"
                  className="h-8"
                  disabled={readOnly}
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Assertions */}
      <Card>
        <CardHeader className="py-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">File Assertions</CardTitle>
            {!readOnly && (
              <Button variant="outline" size="sm" onClick={addAssertion}>
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            )}
          </div>
          <CardDescription className="text-xs">
            Verify file properties and content
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.assertions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No assertions added. Click "Add" to verify file content.
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
                    onValueChange={(v) => updateAssertion(assertion.id, { type: v as FileAssertionType })}
                    disabled={readOnly}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableAssertionTypes.map(([type, meta]) => (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-[10px] px-1">
                              {meta.category}
                            </Badge>
                            {meta.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    value={assertion.expected}
                    onChange={(e) => updateAssertion(assertion.id, { expected: e.target.value })}
                    placeholder={FILE_ASSERTION_TYPES[assertion.type]?.description}
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
                
                {/* Additional inputs for row/col */}
                {needsRowCol(assertion.type) && (
                  <div className="flex gap-2 pl-10">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">Row:</Label>
                      <Input
                        type="number"
                        min={0}
                        value={assertion.row ?? ''}
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
                        value={assertion.col ?? ''}
                        onChange={(e) => updateAssertion(assertion.id, { 
                          col: e.target.value 
                        })}
                        placeholder="0 or Name"
                        className="w-24 h-7"
                        disabled={readOnly}
                      />
                    </div>
                    {config.fileType === 'excel' && (
                      <div className="flex items-center gap-1">
                        <Label className="text-xs">Sheet:</Label>
                        <Input
                          value={assertion.sheet ?? ''}
                          onChange={(e) => updateAssertion(assertion.id, { 
                            sheet: e.target.value || undefined 
                          })}
                          placeholder="Sheet1"
                          className="w-24 h-7"
                          disabled={readOnly}
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Path input for JSON assertions */}
                {needsPath(assertion.type) && (
                  <div className="pl-10">
                    <div className="flex items-center gap-1">
                      <Label className="text-xs">JSON Path:</Label>
                      <Input
                        value={assertion.col as string ?? ''}
                        onChange={(e) => updateAssertion(assertion.id, { 
                          col: e.target.value 
                        })}
                        placeholder="$.data[0].name"
                        className="flex-1 h-7"
                        disabled={readOnly}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Extract Value */}
      <Collapsible open={showExtract} onOpenChange={setShowExtract}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <File className="h-4 w-4" />
              Extract Value
            </span>
            <Badge variant="outline">{showExtract ? 'Hide' : 'Show'}</Badge>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardContent className="pt-4 space-y-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={!!config.extractValue}
                  onCheckedChange={(checked) => 
                    updateConfig({ 
                      extractValue: checked ? { storeAs: 'extractedValue' } : undefined 
                    })
                  }
                  disabled={readOnly}
                />
                <span className="text-sm">Extract value from file</span>
              </div>
              {config.extractValue && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {(config.fileType === 'json' || config.fileType === 'xml') && (
                    <div className="col-span-2">
                      <Label className="text-xs">JSON Path</Label>
                      <Input
                        value={config.extractValue.path || ''}
                        onChange={(e) => updateConfig({ 
                          extractValue: { ...config.extractValue!, path: e.target.value }
                        })}
                        placeholder="$.users[0].email"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                  {(config.fileType === 'csv' || config.fileType === 'excel') && (
                    <>
                      <div>
                        <Label className="text-xs">Row Index</Label>
                        <Input
                          type="number"
                          min={0}
                          value={config.extractValue.row ?? ''}
                          onChange={(e) => updateConfig({ 
                            extractValue: { 
                              ...config.extractValue!, 
                              row: e.target.value ? parseInt(e.target.value) : undefined 
                            }
                          })}
                          placeholder="0"
                          disabled={readOnly}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Column (index or name)</Label>
                        <Input
                          value={config.extractValue.col ?? ''}
                          onChange={(e) => updateConfig({ 
                            extractValue: { ...config.extractValue!, col: e.target.value }
                          })}
                          placeholder="Email"
                          disabled={readOnly}
                        />
                      </div>
                    </>
                  )}
                  {config.fileType === 'excel' && (
                    <div>
                      <Label className="text-xs">Sheet Name</Label>
                      <Input
                        value={config.extractValue.sheet || ''}
                        onChange={(e) => updateConfig({ 
                          extractValue: { ...config.extractValue!, sheet: e.target.value || undefined }
                        })}
                        placeholder="Sheet1"
                        disabled={readOnly}
                      />
                    </div>
                  )}
                  <div className={config.fileType === 'excel' ? '' : 'col-span-2'}>
                    <Label className="text-xs">Store as variable</Label>
                    <Input
                      value={config.extractValue.storeAs}
                      onChange={(e) => updateConfig({ 
                        extractValue: { ...config.extractValue!, storeAs: e.target.value }
                      })}
                      placeholder="extractedValue"
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
 * Default configuration for new file verify steps
 */
export function getDefaultFileVerifyConfig(): FileVerifyConfig {
  return {
    downloadTrigger: '',
    fileType: 'auto',
    assertions: [{
      id: 'file_assert_default',
      type: 'file_exists',
      expected: '',
      enabled: true
    }]
  };
}

