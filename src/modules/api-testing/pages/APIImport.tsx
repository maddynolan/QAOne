/**
 * @module api-testing
 * @page APIImport
 *
 * API specification import page for OpenAPI/Swagger, Postman, and HAR formats.
 * Supports URL fetch, file upload, and paste modes with automatic base URL
 * detection using a 5-layer resolution chain.
 *
 * @features
 * - Import from URL, file upload, or paste
 * - OpenAPI 3.x and Swagger 2.0 spec parsing
 * - Postman collection import
 * - HAR file import for recorded traffic
 * - Automatic base URL detection (5-layer chain)
 * - Parsed endpoint preview before import
 *
 * @api /api/import/spec - Import OpenAPI/Swagger spec
 * @api /api/import/spec/file - Import spec via file upload
 * @api /api/import/fetch-url - Fetch spec from URL (CORS proxy)
 * @api /api/import/har - Import HAR file
 *
 * @dependencies APIImport uses useState, shadcn/ui Card, Input, Label, Button
 */
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Code, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// Simple logger for debugging
const logger = {
  error: (message: string, error?: any) => {
    console.error(message, error);
  }
};

export default function APIImport() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("upload");
  const [loading, setLoading] = useState(false);
  const [specFormat, setSpecFormat] = useState("openapi");
  const [specContent, setSpecContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedSpec, setParsedSpec] = useState<any>(null);
  const [testSuite, setTestSuite] = useState<any>(null);
  const [testCode, setTestCode] = useState<any>(null);
  const [selectedFramework, setSelectedFramework] = useState("playwright");

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      
      // Determine format from filename
      const filename = file.name.toLowerCase();
      let format = "openapi";
      if (filename.endsWith(".wsdl") || filename.endsWith(".xml")) {
        format = "wsdl";
      } else if (filename.includes("postman")) {
        format = "postman";
      } else if (filename.endsWith(".graphql") || filename.endsWith(".gql")) {
        format = "graphql";
      }
      
      formData.append("spec_format", format);

      const response = await fetch(`${API_BASE_URL}/api/import/spec/file`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Failed to import: ${response.statusText}`);
      }

      const data = await response.json();
      setParsedSpec(data.parsed_spec);
      setTestSuite(data.test_suite);
      setSpecFormat(data.parsed_spec.format);
      
      toast({
        title: "Success",
        description: `Imported ${data.summary.total_endpoints} endpoints, generated ${data.summary.total_tests} test cases`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import API specification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTextImport = async () => {
    if (!specContent.trim()) {
      toast({
        title: "Error",
        description: "Please provide API specification content",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/import/spec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec_content: specContent,
          spec_format: specFormat,
          content_type: specFormat === "wsdl" ? "xml" : "json",
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to import: ${response.statusText}`);
      }

      const data = await response.json();
      setParsedSpec(data.parsed_spec);
      setTestSuite(data.test_suite);
      
      toast({
        title: "Success",
        description: `Imported ${data.summary.total_endpoints} endpoints, generated ${data.summary.total_tests} test cases`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import API specification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTests = async () => {
    if (!parsedSpec) {
      toast({
        title: "Error",
        description: "Please import an API specification first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/import/generate-tests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          parsed_spec: parsedSpec,
          framework: selectedFramework,
          include_negative: true,
          include_boundary: true,
          include_security: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate tests: ${response.statusText}`);
      }

      const data = await response.json();
      setTestCode(data);
      
      toast({
        title: "Success",
        description: `Generated ${data.summary.total_tests} test cases in ${data.framework} format`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to generate test code",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadTestCode = () => {
    if (!testCode?.test_code) return;

    const blob = new Blob([testCode.test_code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-tests.${testCode.language === "typescript" ? "ts" : testCode.language === "python" ? "py" : testCode.language === "java" ? "java" : "js"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Import & Test Generation</h1>
          <p className="text-muted-foreground mt-2">
            Import API specifications and generate automated test scripts
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="text">Paste Specification</TabsTrigger>
          <TabsTrigger value="results" disabled={!parsedSpec}>Results</TabsTrigger>
          <TabsTrigger value="tests" disabled={!testCode}>Generated Tests</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload API Specification File</CardTitle>
              <CardDescription>
                Upload OpenAPI, Swagger, WSDL, Postman, or GraphQL specification files
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select File</Label>
                <div className="flex items-center gap-4">
                  <Input
                    type="file"
                    accept=".json,.yaml,.yml,.xml,.wsdl,.graphql,.gql"
                    onChange={handleFileUpload}
                    disabled={loading}
                  />
                  {uploadedFile && (
                    <Badge variant="outline">
                      <FileText className="w-4 h-4 mr-2" />
                      {uploadedFile.name}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Supported formats:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>OpenAPI/Swagger (.json, .yaml, .yml)</li>
                  <li>WSDL/SOAP (.wsdl, .xml)</li>
                  <li>Postman Collection (.json)</li>
                  <li>GraphQL Schema (.graphql, .gql, .json)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Paste API Specification</CardTitle>
              <CardDescription>
                Paste your API specification content directly
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Specification Format</Label>
                <Select value={specFormat} onValueChange={setSpecFormat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openapi">OpenAPI/Swagger</SelectItem>
                    <SelectItem value="wsdl">WSDL/SOAP</SelectItem>
                    <SelectItem value="postman">Postman Collection</SelectItem>
                    <SelectItem value="graphql">GraphQL Schema</SelectItem>
                    <SelectItem value="rest">REST API</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Specification Content</Label>
                <Textarea
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  placeholder="Paste your API specification JSON/YAML/XML here..."
                  className="min-h-[300px] font-mono text-sm"
                />
              </div>
              <Button onClick={handleTextImport} disabled={loading || !specContent.trim()}>
                {loading ? "Importing..." : "Import Specification"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {parsedSpec && testSuite && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Import Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Format</p>
                      <p className="text-lg font-semibold">{parsedSpec.format.toUpperCase()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Endpoints</p>
                      <p className="text-lg font-semibold">{testSuite.total_endpoints}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Test Cases</p>
                      <p className="text-lg font-semibold">{testSuite.total_tests}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Generate Test Scripts</CardTitle>
                  <CardDescription>
                    Generate executable test code in your preferred framework
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Test Framework</Label>
                    <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="playwright">Playwright (TypeScript)</SelectItem>
                        <SelectItem value="pytest">pytest (Python)</SelectItem>
                        <SelectItem value="postman">Postman Collection</SelectItem>
                        <SelectItem value="rest_assured">REST Assured (Java)</SelectItem>
                        <SelectItem value="k6">k6 (JavaScript)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleGenerateTests} disabled={loading}>
                    {loading ? "Generating..." : "Generate Test Scripts"}
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Endpoints</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {testSuite.endpoints?.slice(0, 20).map((endpoint: any, idx: number) => (
                      <div key={idx} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <code className="text-sm">{endpoint.path}</code>
                        </div>
                        {endpoint.summary && (
                          <p className="text-sm text-muted-foreground mt-1">{endpoint.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="tests" className="space-y-4">
          {testCode && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Generated Test Code</CardTitle>
                      <CardDescription>
                        Framework: {testCode.framework} | Language: {testCode.language}
                      </CardDescription>
                    </div>
                    <Button onClick={downloadTestCode} variant="outline">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Setup Instructions</Label>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="whitespace-pre-line">
                        {testCode.setup_instructions}
                      </AlertDescription>
                    </Alert>
                  </div>
                  <div className="space-y-2">
                    <Label>Test Code</Label>
                    <Textarea
                      value={testCode.test_code}
                      readOnly
                      className="min-h-[400px] font-mono text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

