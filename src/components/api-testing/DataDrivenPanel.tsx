/**
 * DataDrivenPanel - Upload CSV/JSON/Excel data, preview rows, run data-driven API tests.
 * Backend: POST /api/v2/testing/data-driven/source, POST /api/v2/testing/data-driven/execute
 */

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Play, Loader2, CheckCircle2, AlertCircle, Trash2,
  FileText, Database, Filter, Shuffle, StopCircle,
} from "lucide-react";
import { API_BASE_URL } from "./constants";

interface DataSource {
  id: string;
  name: string;
  type: string;
  columns: string[];
  total_rows: number;
  preview_rows: Array<Record<string, any>>;
}

interface IterationResult {
  row_index: number;
  data_row: Record<string, any>;
  status: string;
  passed: boolean;
  error?: string;
}

interface ExecutionResult {
  execution_id: string;
  status: string;
  iterations: IterationResult[];
  summary: {
    total_iterations: number;
    passed: number;
    failed: number;
    skipped: number;
    pass_rate: number;
  };
}

interface DataDrivenPanelProps {
  testSuite?: any;
}

export default function DataDrivenPanel({ testSuite }: DataDrivenPanelProps) {
  const { toast } = useToast();
  const [dataSource, setDataSource] = useState<DataSource | null>(null);
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [filterExpr, setFilterExpr] = useState("");
  const [sampleSize, setSampleSize] = useState<number | null>(null);
  const [shuffleRows, setShuffleRows] = useState(false);
  const [stopOnFailure, setStopOnFailure] = useState(false);
  const [inlineData, setInlineData] = useState("");

  // Upload file data source
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const text = await file.text();
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      const sourceType = ext === "json" ? "json" : ext === "csv" ? "csv" : ext === "xlsx" || ext === "xls" ? "excel" : "csv";

      const response = await fetch(`${API_BASE_URL}/api/v2/testing/data-driven/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          source_type: sourceType,
          content: text,
        }),
      });

      if (!response.ok) throw new Error(`Upload failed: ${response.statusText}`);
      const data = await response.json();

      setDataSource({
        id: data.source_id,
        name: file.name,
        type: sourceType,
        columns: data.preview?.columns || [],
        total_rows: data.preview?.total_rows || 0,
        preview_rows: data.preview?.preview_rows || [],
      });
      setResult(null);
      toast({ title: "Data loaded", description: `${data.preview?.total_rows || 0} rows from ${file.name}` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Upload inline JSON/CSV data
  const handleInlineData = useCallback(async () => {
    if (!inlineData.trim()) return;
    setLoading(true);
    try {
      // Auto-detect JSON vs CSV
      const trimmed = inlineData.trim();
      const isJson = trimmed.startsWith("[") || trimmed.startsWith("{");
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/data-driven/source`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Inline Data",
          source_type: isJson ? "json" : "csv",
          content: inlineData,
        }),
      });
      if (!response.ok) throw new Error(`Failed: ${response.statusText}`);
      const data = await response.json();
      setDataSource({
        id: data.source_id,
        name: "Inline Data",
        type: isJson ? "json" : "csv",
        columns: data.preview?.columns || [],
        total_rows: data.preview?.total_rows || 0,
        preview_rows: data.preview?.preview_rows || [],
      });
      setResult(null);
      toast({ title: "Data loaded", description: `${data.preview?.total_rows || 0} rows loaded` });
    } catch (err: any) {
      toast({ title: "Failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [inlineData, toast]);

  // Execute data-driven tests
  const handleExecute = useCallback(async () => {
    if (!dataSource || !testSuite) {
      toast({ title: "Missing data", description: "Upload a data source and generate a test suite first", variant: "destructive" });
      return;
    }

    setExecuting(true);
    setResult(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/data-driven/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_suite: testSuite,
          source_id: dataSource.id,
          execution_config: {
            filter: filterExpr || undefined,
            sample_size: sampleSize || undefined,
            shuffle: shuffleRows,
            stop_on_failure: stopOnFailure,
          },
        }),
      });
      if (!response.ok) throw new Error(`Execution failed: ${response.statusText}`);
      const data = await response.json();
      setResult(data);
      toast({
        title: "Execution complete",
        description: `${data.summary?.passed || 0}/${data.summary?.total_iterations || 0} passed (${(data.summary?.pass_rate || 0).toFixed(1)}%)`,
      });
    } catch (err: any) {
      toast({ title: "Execution failed", description: err.message, variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  }, [dataSource, testSuite, filterExpr, sampleSize, shuffleRows, stopOnFailure, toast]);

  return (
    <div className="space-y-4">
      {/* Data Source Upload */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="w-4 h-4" />
            Data Source
          </CardTitle>
          <CardDescription>Upload CSV, JSON, or Excel to parameterize your API tests</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label className="text-xs">Upload File</Label>
              <Input
                type="file"
                accept=".csv,.json,.xlsx,.xls"
                className="cursor-pointer mt-1"
                onChange={handleFileUpload}
                disabled={loading}
              />
            </div>
            <div className="text-xs text-muted-foreground self-end pb-2">or</div>
            <div className="flex-1">
              <Label className="text-xs">Paste Data (CSV/JSON)</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  placeholder='[{"name":"Test1"},{"name":"Test2"}]'
                  value={inlineData}
                  onChange={e => setInlineData(e.target.value)}
                  className="font-mono text-xs"
                />
                <Button size="sm" variant="outline" onClick={handleInlineData} disabled={loading || !inlineData.trim()}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </div>

          {dataSource && (
            <div className="border rounded-lg p-3 bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium">{dataSource.name}</span>
                  <Badge variant="secondary" className="text-xs">{dataSource.type.toUpperCase()}</Badge>
                  <Badge variant="outline" className="text-xs">{dataSource.total_rows} rows</Badge>
                  <Badge variant="outline" className="text-xs">{dataSource.columns.length} columns</Badge>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setDataSource(null); setResult(null); }}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Preview Table */}
              <ScrollArea className="h-[200px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-xs">#</TableHead>
                      {dataSource.columns.map(col => (
                        <TableHead key={col} className="text-xs font-mono">{col}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dataSource.preview_rows.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                        {dataSource.columns.map(col => (
                          <TableCell key={col} className="text-xs font-mono max-w-[150px] truncate">
                            {String(row[col] ?? "")}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>

              <p className="text-[10px] text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{`{{column_name}}`}</code> in your API request URL, headers, or body to substitute data values per row.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Config */}
      {dataSource && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Play className="w-4 h-4" />
              Execution Config
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs flex items-center gap-1"><Filter className="w-3 h-3" /> Filter Expression</Label>
                <Input
                  placeholder='e.g., status == "active" or age > 18'
                  value={filterExpr}
                  onChange={e => setFilterExpr(e.target.value)}
                  className="text-xs mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Sample Size (random N rows)</Label>
                <Input
                  type="number"
                  placeholder={`All ${dataSource.total_rows} rows`}
                  value={sampleSize ?? ""}
                  onChange={e => setSampleSize(e.target.value ? parseInt(e.target.value) : null)}
                  className="text-xs mt-1"
                  min={1}
                  max={dataSource.total_rows}
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={shuffleRows} onChange={e => setShuffleRows(e.target.checked)} />
                  <Shuffle className="w-3 h-3" /> Shuffle rows
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={stopOnFailure} onChange={e => setStopOnFailure(e.target.checked)} />
                  <StopCircle className="w-3 h-3" /> Stop on failure
                </label>
              </div>
              <div className="flex items-center justify-end">
                <Button onClick={handleExecute} disabled={executing || !testSuite}>
                  {executing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  Run {sampleSize ? `${sampleSize} rows` : `All ${dataSource.total_rows} rows`}
                </Button>
              </div>
            </div>
            {!testSuite && (
              <Alert className="mt-3">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  Generate a test suite from the Import tab first, then come here to run it with data.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              Results
              <Badge variant={result.summary.failed === 0 ? "default" : "destructive"} className="text-xs">
                {result.summary.pass_rate.toFixed(1)}% passed
              </Badge>
            </CardTitle>
            <CardDescription>
              {result.summary.passed} passed, {result.summary.failed} failed, {result.summary.skipped} skipped — {result.summary.total_iterations} iterations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Progress
              value={result.summary.pass_rate}
              className="h-2 mb-3"
            />
            <ScrollArea className="h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10 text-xs">Row</TableHead>
                    <TableHead className="w-16 text-xs">Status</TableHead>
                    {dataSource?.columns.slice(0, 4).map(col => (
                      <TableHead key={col} className="text-xs font-mono">{col}</TableHead>
                    ))}
                    <TableHead className="text-xs">Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.iterations.map((iter, i) => (
                    <TableRow key={i} className={iter.passed ? "" : "bg-red-500/5"}>
                      <TableCell className="text-xs">{iter.row_index + 1}</TableCell>
                      <TableCell>
                        {iter.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-red-500" />
                        )}
                      </TableCell>
                      {dataSource?.columns.slice(0, 4).map(col => (
                        <TableCell key={col} className="text-xs font-mono max-w-[120px] truncate">
                          {String(iter.data_row?.[col] ?? "")}
                        </TableCell>
                      ))}
                      <TableCell className="text-xs text-red-600 max-w-[200px] truncate">
                        {iter.error || ""}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
