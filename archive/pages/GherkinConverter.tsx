import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, CheckCircle2, AlertCircle, Copy } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function GherkinConverter() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [requirementId, setRequirementId] = useState("");
  const [requirement, setRequirement] = useState<any>(null);
  const [gherkin, setGherkin] = useState("");
  const [requirements, setRequirements] = useState<any[]>([]);
  const [selectedRequirements, setSelectedRequirements] = useState<string[]>([]);
  const [batchGherkin, setBatchGherkin] = useState<any>(null);

  useEffect(() => {
    // Fetch requirements list
    fetchRequirements();
  }, []);

  const fetchRequirements = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/requirements`);
      if (response.ok) {
        const data = await response.json();
        setRequirements(data.requirements || []);
      }
    } catch (error) {
      console.error("Failed to fetch requirements:", error);
    }
  };

  const handleConvertSingle = async () => {
    if (!requirementId.trim()) {
      toast({
        title: "Error",
        description: "Please enter a requirement ID",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGherkin("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/gherkin/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirement_id: requirementId,
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to convert requirement");
      }

      const data = await response.json();
      setGherkin(data.gherkin);
      setRequirement({
        id: data.requirement_id,
        title: data.requirement_title,
      });

      toast({
        title: "Success",
        description: "Requirement converted to Gherkin format",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert requirement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertBatch = async () => {
    if (selectedRequirements.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one requirement",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setBatchGherkin(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/gherkin/convert-batch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirement_ids: selectedRequirements,
          output_format: "feature_files",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to convert requirements");
      }

      const data = await response.json();
      setBatchGherkin(data);

      toast({
        title: "Success",
        description: `Converted ${data.total_requirements} requirements to Gherkin`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert requirements",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConvertFromText = async () => {
    const requirementText = (document.getElementById("requirement-text") as HTMLTextAreaElement)?.value;
    if (!requirementText?.trim()) {
      toast({
        title: "Error",
        description: "Please enter requirement text",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setGherkin("");

    try {
      const response = await fetch(`${API_BASE_URL}/api/gherkin/convert`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requirement: {
            title: "Custom Requirement",
            description: requirementText,
            source: "manual",
          },
          include_background: true,
          include_scenarios: true,
          max_scenarios: 5,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to convert requirement");
      }

      const data = await response.json();
      setGherkin(data.gherkin);

      toast({
        title: "Success",
        description: "Requirement converted to Gherkin format",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to convert requirement",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadGherkin = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.endsWith(".feature") ? filename : `${filename}.feature`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Gherkin content copied to clipboard",
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Requirements to Gherkin Converter</h1>
          <p className="text-muted-foreground mt-2">
            Convert requirements to Gherkin (BDD) format for behavior-driven development
          </p>
        </div>
      </div>

      <Tabs defaultValue="single" className="space-y-4">
        <TabsList>
          <TabsTrigger value="single">Single Requirement</TabsTrigger>
          <TabsTrigger value="batch">Batch Conversion</TabsTrigger>
          <TabsTrigger value="text">From Text</TabsTrigger>
        </TabsList>

        <TabsContent value="single" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convert Single Requirement</CardTitle>
              <CardDescription>
                Convert a requirement from database to Gherkin format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Requirement ID</Label>
                <div className="flex gap-2">
                  <Input
                    value={requirementId}
                    onChange={(e) => setRequirementId(e.target.value)}
                    placeholder="Enter requirement ID"
                  />
                  <Button onClick={handleConvertSingle} disabled={loading || !requirementId.trim()}>
                    {loading ? "Converting..." : "Convert"}
                  </Button>
                </div>
              </div>
              {requirement && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Converting requirement: <strong>{requirement.title}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {gherkin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Generated Gherkin</CardTitle>
                    <CardDescription>
                      Feature file for: {requirement?.title || "Requirement"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(gherkin)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadGherkin(gherkin, requirement?.title || "feature")}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={gherkin}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="batch" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Batch Conversion</CardTitle>
              <CardDescription>
                Convert multiple requirements to Gherkin format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Select Requirements</Label>
                <div className="max-h-[300px] overflow-y-auto border rounded-lg p-4 space-y-2">
                  {requirements.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No requirements found</p>
                  ) : (
                    requirements.map((req) => (
                      <div key={req.id} className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id={req.id}
                          checked={selectedRequirements.includes(req.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRequirements([...selectedRequirements, req.id]);
                            } else {
                              setSelectedRequirements(selectedRequirements.filter((id) => id !== req.id));
                            }
                          }}
                        />
                        <label htmlFor={req.id} className="text-sm cursor-pointer">
                          {req.title || req.id}
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <Button onClick={handleConvertBatch} disabled={loading || selectedRequirements.length === 0}>
                {loading ? "Converting..." : `Convert ${selectedRequirements.length} Requirements`}
              </Button>
            </CardContent>
          </Card>

          {batchGherkin && (
            <Card>
              <CardHeader>
                <CardTitle>Batch Conversion Results</CardTitle>
                <CardDescription>
                  {batchGherkin.total_requirements} requirements converted
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {Object.entries(batchGherkin.features || {}).map(([reqId, gherkinContent]: [string, any]) => (
                  <Card key={reqId}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{reqId}</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(gherkinContent)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copy
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadGherkin(gherkinContent, reqId)}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Textarea
                        value={gherkinContent}
                        readOnly
                        className="min-h-[200px] font-mono text-sm"
                      />
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="text" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Convert from Text</CardTitle>
              <CardDescription>
                Paste requirement text and convert to Gherkin format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Requirement Text</Label>
                <Textarea
                  id="requirement-text"
                  placeholder="Paste your requirement description here..."
                  className="min-h-[200px]"
                />
              </div>
              <Button onClick={handleConvertFromText} disabled={loading}>
                {loading ? "Converting..." : "Convert to Gherkin"}
              </Button>
            </CardContent>
          </Card>

          {gherkin && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Gherkin</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(gherkin)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadGherkin(gherkin, "feature")}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={gherkin}
                  readOnly
                  className="min-h-[400px] font-mono text-sm"
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

