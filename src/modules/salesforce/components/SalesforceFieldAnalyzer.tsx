/**
 * Salesforce Field Usage Analyzer
 * 
 * Analyze field usage across records.
 * Features:
 * - Field population rates
 * - Identify unused fields
 * - Value distribution analysis
 * - Data quality metrics
 * - Export recommendations
 */

import { useState, useCallback, useMemo } from 'react';
import {
  BarChart3, PieChart, RefreshCw, Download, Loader2,
  CheckCircle, AlertCircle, AlertTriangle, TrendingUp,
  Database, Filter, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe } from '@/modules/salesforce/lib/salesforce-api';
import { STANDARD_OBJECT_TEMPLATES } from '@/modules/salesforce/lib/salesforce-test-data-factory';

interface FieldAnalysis {
  fieldName: string;
  fieldLabel: string;
  fieldType: string;
  populationRate: number;
  nullCount: number;
  nonNullCount: number;
  uniqueValues: number;
  sampleValues: any[];
  isRequired: boolean;
  isCustom: boolean;
}

interface AnalysisResult {
  objectName: string;
  totalRecords: number;
  analyzedRecords: number;
  fields: FieldAnalysis[];
  timestamp: string;
}

interface SalesforceFieldAnalyzerProps {
  isConnected: boolean;
}

export function SalesforceFieldAnalyzer({ isConnected }: SalesforceFieldAnalyzerProps) {
  const [selectedObject, setSelectedObject] = useState('Account');
  const [sampleSize, setSampleSize] = useState(1000);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'population' | 'type'>('population');
  const [filterType, setFilterType] = useState<'all' | 'populated' | 'empty' | 'custom'>('all');

  const objectOptions = useMemo(() => STANDARD_OBJECT_TEMPLATES.map(t => ({
    value: t.apiName,
    label: t.label,
  })), []);

  const analyzeObject = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    setIsAnalyzing(true);
    try {
      // Get object describe
      const describe = await salesforceApi.describeSObject(selectedObject);
      
      // Get total count
      const countResult = await salesforceApi.query(`SELECT COUNT() FROM ${selectedObject}`);
      const totalRecords = countResult.totalSize;

      // Get field names (excluding certain system fields)
      const fieldsToAnalyze = describe.fields
        .filter(f => 
          f.name !== 'Id' && 
          !f.name.endsWith('__pc') && 
          f.type !== 'address' && 
          f.type !== 'location'
        )
        .slice(0, 50); // Limit to 50 fields for performance

      // Build query with all fields
      const fieldNames = fieldsToAnalyze.map(f => f.name).join(', ');
      const query = `SELECT ${fieldNames} FROM ${selectedObject} LIMIT ${sampleSize}`;
      
      const records = await salesforceApi.queryAll(query);
      
      // Analyze each field
      const fieldAnalyses: FieldAnalysis[] = fieldsToAnalyze.map(field => {
        const values = records.map(r => r[field.name]);
        const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== '');
        const uniqueValues = new Set(nonNullValues.map(v => JSON.stringify(v)));
        
        return {
          fieldName: field.name,
          fieldLabel: field.label,
          fieldType: field.type,
          populationRate: records.length > 0 ? (nonNullValues.length / records.length) * 100 : 0,
          nullCount: values.length - nonNullValues.length,
          nonNullCount: nonNullValues.length,
          uniqueValues: uniqueValues.size,
          sampleValues: Array.from(uniqueValues).slice(0, 5).map(v => JSON.parse(v)),
          isRequired: !field.nillable,
          isCustom: field.custom,
        };
      });

      setAnalysisResult({
        objectName: selectedObject,
        totalRecords,
        analyzedRecords: records.length,
        fields: fieldAnalyses,
        timestamp: new Date().toISOString(),
      });

      toast.success(`Analyzed ${records.length} records with ${fieldsToAnalyze.length} fields`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsAnalyzing(false);
    }
  }, [isConnected, selectedObject, sampleSize]);

  const sortedAndFilteredFields = useMemo(() => {
    if (!analysisResult) return [];
    
    let fields = [...analysisResult.fields];
    
    // Filter
    switch (filterType) {
      case 'populated':
        fields = fields.filter(f => f.populationRate > 50);
        break;
      case 'empty':
        fields = fields.filter(f => f.populationRate < 10);
        break;
      case 'custom':
        fields = fields.filter(f => f.isCustom);
        break;
    }
    
    // Sort
    switch (sortBy) {
      case 'name':
        fields.sort((a, b) => a.fieldLabel.localeCompare(b.fieldLabel));
        break;
      case 'population':
        fields.sort((a, b) => b.populationRate - a.populationRate);
        break;
      case 'type':
        fields.sort((a, b) => a.fieldType.localeCompare(b.fieldType));
        break;
    }
    
    return fields;
  }, [analysisResult, sortBy, filterType]);

  const summaryStats = useMemo(() => {
    if (!analysisResult) return null;
    
    const fields = analysisResult.fields;
    const wellPopulated = fields.filter(f => f.populationRate >= 80).length;
    const partiallyPopulated = fields.filter(f => f.populationRate >= 20 && f.populationRate < 80).length;
    const sparselyPopulated = fields.filter(f => f.populationRate < 20).length;
    const avgPopulation = fields.reduce((sum, f) => sum + f.populationRate, 0) / fields.length;
    
    return {
      wellPopulated,
      partiallyPopulated,
      sparselyPopulated,
      avgPopulation,
    };
  }, [analysisResult]);

  const getPopulationColor = (rate: number) => {
    if (rate >= 80) return 'text-green-600 dark:text-green-400';
    if (rate >= 50) return 'text-yellow-600 dark:text-yellow-400';
    if (rate >= 20) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getPopulationBgColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 50) return 'bg-yellow-500';
    if (rate >= 20) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const exportAnalysis = useCallback(() => {
    if (!analysisResult) return;
    
    const csv = [
      ['Field Name', 'Label', 'Type', 'Population Rate', 'Non-Null Count', 'Unique Values', 'Required', 'Custom'].join(','),
      ...analysisResult.fields.map(f => [
        f.fieldName,
        `"${f.fieldLabel}"`,
        f.fieldType,
        f.populationRate.toFixed(1) + '%',
        f.nonNullCount,
        f.uniqueValues,
        f.isRequired ? 'Yes' : 'No',
        f.isCustom ? 'Yes' : 'No',
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedObject}_field_analysis.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Analysis exported');
  }, [analysisResult, selectedObject]);

  return (
    <div className="space-y-4">
      {/* Configuration */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground">Field Usage Analyzer</CardTitle>
          <CardDescription>Analyze field population and data quality</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Object</Label>
              <Select value={selectedObject} onValueChange={setSelectedObject}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {objectOptions.map(obj => (
                    <SelectItem key={obj.value} value={obj.value}>
                      {obj.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sample Size</Label>
              <Select value={String(sampleSize)} onValueChange={(v) => setSampleSize(parseInt(v))}>
                <SelectTrigger className="bg-input border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 records</SelectItem>
                  <SelectItem value="500">500 records</SelectItem>
                  <SelectItem value="1000">1,000 records</SelectItem>
                  <SelectItem value="5000">5,000 records</SelectItem>
                  <SelectItem value="10000">10,000 records</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button
                onClick={analyzeObject}
                disabled={!isConnected || isAnalyzing}
                className="gap-2 w-full"
              >
                {isAnalyzing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <BarChart3 className="w-4 h-4" />
                )}
                Analyze
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {analysisResult && summaryStats && (
        <div className="grid grid-cols-5 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-foreground">{analysisResult.totalRecords.toLocaleString()}</div>
              <div className="text-xs text-slate-400">Total Records</div>
            </CardContent>
          </Card>
          <Card className="bg-card border-border">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-foreground">{analysisResult.fields.length}</div>
              <div className="text-xs text-slate-400">Fields Analyzed</div>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10 border-green-500/30">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summaryStats.wellPopulated}</div>
              <div className="text-xs text-green-600 dark:text-green-400">Well Populated (≥80%)</div>
            </CardContent>
          </Card>
          <Card className="bg-yellow-500/10 border-yellow-500/30">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{summaryStats.partiallyPopulated}</div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400">Partial (20-80%)</div>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30">
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summaryStats.sparselyPopulated}</div>
              <div className="text-xs text-red-600 dark:text-red-400">Sparse (&lt;20%)</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Field Analysis Results */}
      {analysisResult && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground text-sm">Field Analysis Results</CardTitle>
                <CardDescription>
                  Analyzed {analysisResult.analyzedRecords.toLocaleString()} of {analysisResult.totalRecords.toLocaleString()} records
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                  <SelectTrigger className="w-[130px] bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Fields</SelectItem>
                    <SelectItem value="populated">Well Populated</SelectItem>
                    <SelectItem value="empty">Sparse</SelectItem>
                    <SelectItem value="custom">Custom Only</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                  <SelectTrigger className="w-[130px] bg-input border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="population">By Population</SelectItem>
                    <SelectItem value="name">By Name</SelectItem>
                    <SelectItem value="type">By Type</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" onClick={exportAnalysis} className="gap-2 text-muted-foreground border-border hover:text-foreground hover:bg-secondary">
                  <Download className="w-4 h-4" />
                  Export
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="max-h-[500px] overflow-y-auto space-y-2">
              {sortedAndFilteredFields.map(field => (
                <div
                  key={field.fieldName}
                  className="p-3 rounded-lg bg-secondary hover:bg-card"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-foreground font-medium">{field.fieldLabel}</span>
                      <span className="text-slate-500 text-xs font-mono">{field.fieldName}</span>
                      {field.isRequired && (
                        <Badge variant="outline" className="text-[10px] border-red-500/50 text-red-600 dark:text-red-400">
                          Required
                        </Badge>
                      )}
                      {field.isCustom && (
                        <Badge variant="outline" className="text-[10px] border-orange-500/50 text-orange-600 dark:text-orange-400">
                          Custom
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] text-cyan-700 dark:text-cyan-300 border-cyan-500/50">
                        {field.fieldType}
                      </Badge>
                      <span className={`text-sm font-bold ${getPopulationColor(field.populationRate)}`}>
                        {field.populationRate.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  
                  <div className="h-2 bg-secondary rounded-full overflow-hidden mb-2">
                    <div
                      className={`h-full ${getPopulationBgColor(field.populationRate)}`}
                      style={{ width: `${field.populationRate}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{field.nonNullCount.toLocaleString()} populated / {field.nullCount.toLocaleString()} empty</span>
                    <span>{field.uniqueValues.toLocaleString()} unique values</span>
                  </div>
                  
                  {field.sampleValues.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {field.sampleValues.map((val, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px]">
                          {String(val).slice(0, 20)}{String(val).length > 20 ? '...' : ''}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceFieldAnalyzer;

