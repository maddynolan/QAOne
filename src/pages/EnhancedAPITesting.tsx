import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Upload, FileText, Code, Download, CheckCircle2, AlertCircle, 
  Database, Play, BarChart3, Server, Settings, TrendingUp,
  Zap, Shield, Activity, Globe, Loader2, Eye, Copy, X,
  FileCode, Rocket, BookOpen, Network, MessageSquare, Radio,
  Workflow, RefreshCw, Link, ExternalLink, Trash2, Plus,
  Send, Link2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestBuilder from "@/components/api-testing/RequestBuilder";
import RequestChainBuilder from "@/components/api-testing/RequestChainBuilder";
import TabErrorBoundary from "@/components/api-testing/TabErrorBoundary";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const ECOMMERCE_TEST_URL = "http://localhost:8002";

// Protocol Templates for quick-start
const PROTOCOL_TEMPLATES = {
  rest_openapi: {
    name: "REST API (OpenAPI)",
    icon: "🌐",
    protocol: "REST",
    format: "openapi",
    description: "E-commerce REST API specification",
    baseUrl: ECOMMERCE_TEST_URL,
    spec: {
      openapi: "3.1.0",
      info: { title: "Test E-Commerce API", version: "1.0.0" },
      servers: [{ url: ECOMMERCE_TEST_URL }],
      paths: {
        "/health": {
          get: { summary: "Health check", operationId: "healthCheck", responses: { "200": { description: "OK" } } }
        },
        "/api/products": {
          get: { 
            summary: "Get products", 
            operationId: "getProducts", 
            parameters: [
              { name: "skip", in: "query", schema: { type: "integer", default: 0 } },
              { name: "limit", in: "query", schema: { type: "integer", default: 20 } }
            ],
            responses: { "200": { description: "List of products" } } 
          }
        },
        "/api/products/{id}": {
          get: { summary: "Get product by ID", operationId: "getProduct", parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }], responses: { "200": { description: "Product" } } }
        },
        "/api/categories": {
          get: { summary: "Get categories", operationId: "getCategories", responses: { "200": { description: "List of categories" } } }
        },
        "/api/auth/register": {
          post: { 
            summary: "Register user", 
            operationId: "register",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      email: { type: "string" },
                      username: { type: "string" },
                      password: { type: "string" },
                      full_name: { type: "string" }
                    },
                    required: ["email", "username", "password"]
                  }
                }
              }
            },
            responses: { "200": { description: "User registered" } }
          }
        },
        "/api/auth/login": {
          post: { summary: "Login", operationId: "login", responses: { "200": { description: "Token" } } }
        },
        "/api/search": {
          get: { summary: "Search", operationId: "search", parameters: [{ name: "q", in: "query", required: true, schema: { type: "string" } }], responses: { "200": { description: "Results" } } }
        }
      }
    }
  },
  graphql: {
    name: "GraphQL API",
    icon: "⬢",
    protocol: "GraphQL",
    format: "graphql",
    description: "GraphQL schema for products, users, orders",
    baseUrl: `${ECOMMERCE_TEST_URL}/graphql`,
    spec: `
type Query {
  products(skip: Int = 0, limit: Int = 20): [Product!]!
  product(id: ID!): Product
  categories: [Category!]!
  me: User
}

type Mutation {
  login(username: String!, password: String!): AuthPayload!
  addToCart(productId: ID!, quantity: Int = 1): CartItem!
}

type Product {
  id: ID!
  name: String!
  description: String!
  price: Float!
  stock: Int!
  categoryId: Int!
}

type Category {
  id: ID!
  name: String!
  slug: String!
}

type User {
  id: ID!
  email: String!
  username: String!
}

type CartItem {
  id: ID!
  productId: Int!
  quantity: Int!
}

type AuthPayload {
  accessToken: String!
  tokenType: String!
}
`
  },
  soap: {
    name: "SOAP Service",
    icon: "📨",
    protocol: "SOAP",
    format: "wsdl",
    description: "SOAP WSDL for product operations",
    baseUrl: `${ECOMMERCE_TEST_URL}/soap`,
    spec: `<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
             xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
             xmlns:tns="http://testwebsite.com/soap"
             xmlns:xsd="http://www.w3.org/2001/XMLSchema"
             targetNamespace="http://testwebsite.com/soap">
  <types>
    <xsd:schema targetNamespace="http://testwebsite.com/soap">
      <xsd:complexType name="GetProductRequest">
        <xsd:sequence>
          <xsd:element name="product_id" type="xsd:int"/>
        </xsd:sequence>
      </xsd:complexType>
    </xsd:schema>
  </types>
  <message name="GetProductRequest">
    <part name="parameters" element="tns:GetProductRequest"/>
  </message>
  <portType name="TestWebsitePortType">
    <operation name="GetProduct">
      <input message="tns:GetProductRequest"/>
    </operation>
  </portType>
  <service name="TestWebsiteSOAPService">
    <port name="TestWebsitePort" binding="tns:TestWebsiteBinding">
      <soap:address location="${ECOMMERCE_TEST_URL}/soap"/>
    </port>
  </service>
</definitions>`
  },
};

export default function EnhancedAPITesting() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("builder");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Flowstral integration state
  const [flowstralSessions, setFlowstralSessions] = useState<any[]>([]);
  const [loadingFlowstral, setLoadingFlowstral] = useState(false);
  
  // Virtual service creation state  
  const [newVirtualService, setNewVirtualService] = useState({
    name: "",
    base_url: "",
    endpoints: [] as any[]
  });
  
  // Debug: Log component mount
  useEffect(() => {
    console.log("EnhancedAPITesting component mounted");
    return () => {
      console.log("EnhancedAPITesting component unmounted");
    };
  }, []);
  
  // Import state
  const [specFormat, setSpecFormat] = useState("openapi");
  const [protocol, setProtocol] = useState("REST");
  const [specContent, setSpecContent] = useState("");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedSpec, setParsedSpec] = useState<any>(null);
  const [testSuite, setTestSuite] = useState<any>(null);
  
  // Database state
  const [dbConnections, setDbConnections] = useState<any[]>([]);
  const [dbConfig, setDbConfig] = useState({
    connection_id: "",
    db_type: "postgresql",
    host: "",
    port: 5432,
    database: "",
    user: "",
    password: ""
  });
  
  // Execution state
  const [executionMode, setExecutionMode] = useState("automated");
  const [executionResults, setExecutionResults] = useState<any>(null);
  const [executing, setExecuting] = useState(false);
  const [selectedEnvironment, setSelectedEnvironment] = useState<string>("");
  const [reportViewTab, setReportViewTab] = useState<"summary" | "html" | "junit" | "json" | "allure">("summary");
  const [selectedTestCases, setSelectedTestCases] = useState<Set<string>>(new Set());
  const [viewingTestCase, setViewingTestCase] = useState<any>(null);
  
  // Environment state
  const [environments, setEnvironments] = useState<any[]>([]);
  const [envConfig, setEnvConfig] = useState({
    name: "",
    type: "development",
    base_url: "",
    variables: {}
  });
  
  // Virtual service state
  const [virtualServices, setVirtualServices] = useState<any[]>([]);
  
  // Report state
  const [reports, setReports] = useState<any[]>([]);
  
  // Security scanning state
  const [securityScanning, setSecurityScanning] = useState(false);
  const [securityResults, setSecurityResults] = useState<any>(null);
  const [securityTargetUrl, setSecurityTargetUrl] = useState(ECOMMERCE_TEST_URL);
  const [selectedSecurityTests, setSelectedSecurityTests] = useState<string[]>([
    "auth_matrix", "bola", "injection", "rate_limiting"
  ]);

  // Assertions Builder state
  const [assertions, setAssertions] = useState<any[]>([]);
  const [newAssertion, setNewAssertion] = useState({
    type: "status_code",
    name: "",
    expected: "",
    path: "",
    operator: "equals",
    schema: ""
  });

  // Assertion type definitions
  const ASSERTION_TYPES = [
    { value: "status_code", label: "Status Code", icon: "🔢", description: "Validate HTTP status code" },
    { value: "response_time", label: "Response Time", icon: "⏱️", description: "Check response time (ms)" },
    { value: "jsonpath", label: "JSONPath", icon: "📍", description: "Extract and validate JSON values" },
    { value: "schema", label: "JSON Schema", icon: "📋", description: "Validate against JSON Schema" },
    { value: "contains", label: "Contains", icon: "🔍", description: "Response contains text" },
    { value: "not_contains", label: "Not Contains", icon: "🚫", description: "Response doesn't contain text" },
    { value: "regex", label: "Regex Match", icon: "🎯", description: "Match regular expression" },
    { value: "header", label: "Header Value", icon: "📨", description: "Validate response header" },
    { value: "equals", label: "Equals", icon: "⚖️", description: "Exact value match" },
    { value: "xpath", label: "XPath", icon: "🏷️", description: "Extract and validate XML values" },
  ];

  const ASSERTION_OPERATORS = [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Not Equals" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Not Contains" },
    { value: "greater_than", label: "Greater Than" },
    { value: "less_than", label: "Less Than" },
    { value: "matches_regex", label: "Matches Regex" },
    { value: "exists", label: "Exists" },
    { value: "not_exists", label: "Not Exists" },
  ];

  // Add assertion to list
  const addAssertion = () => {
    if (!newAssertion.type) return;
    
    const assertion = {
      id: `assertion_${Date.now()}`,
      ...newAssertion,
      name: newAssertion.name || `${newAssertion.type} assertion`
    };
    
    setAssertions([...assertions, assertion]);
    setNewAssertion({
      type: "status_code",
      name: "",
      expected: "",
      path: "",
      operator: "equals",
      schema: ""
    });
    
    toast({
      title: "Assertion Added",
      description: `Added ${assertion.type} assertion`,
    });
  };

  // Remove assertion
  const removeAssertion = (id: string) => {
    setAssertions(assertions.filter(a => a.id !== id));
  };

  // Export results as JUnit XML
  const exportAsJUnitXML = () => {
    if (!executionResults) return;
    
    const testResults = executionResults.test_results || [];
    const summary = executionResults.summary || {};
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Test Suite" tests="${summary.total || 0}" failures="${summary.failed || 0}" errors="0" time="${(summary.total_duration_ms || 0) / 1000}">
${testResults.map((result: any, idx: number) => `  <testcase name="${result.title || result.name || `Test ${idx + 1}`}" classname="api.tests" time="${(result.response_time_ms || 0) / 1000}">
${result.status !== 'passed' ? `    <failure message="${result.error_message || 'Test failed'}" type="${result.error_type || 'AssertionError'}">
      Expected: ${result.expected_status || 200}
      Actual: ${result.actual_status || 'N/A'}
    </failure>` : ''}
  </testcase>`).join('\n')}
</testsuite>`;
    
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-results-${new Date().toISOString().split('T')[0]}.xml`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "JUnit XML report downloaded",
    });
  };

  // Export results as HTML report
  const exportAsHTML = () => {
    if (!executionResults) return;
    
    const testResults = executionResults.test_results || [];
    const summary = executionResults.summary || {};
    
    const html = `<!DOCTYPE html>
<html>
<head>
  <title>API Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 30px 0; }
    .stat { text-align: center; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 36px; font-weight: bold; }
    .stat-label { color: #666; margin-top: 5px; }
    .passed { color: #22c55e; }
    .failed { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .timestamp { color: #888; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>API Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
      <div class="stat">
        <div class="stat-value">${summary.total || 0}</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat">
        <div class="stat-value passed">${summary.passed || 0}</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat">
        <div class="stat-value failed">${summary.failed || 0}</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.pass_rate?.toFixed(1) || 0}%</div>
        <div class="stat-label">Pass Rate</div>
      </div>
    </div>
    
    <h2>Test Results</h2>
    <table>
      <thead>
        <tr>
          <th>Test Case</th>
          <th>Status</th>
          <th>Response Time</th>
          <th>Status Code</th>
        </tr>
      </thead>
      <tbody>
        ${testResults.map((result: any, idx: number) => `
        <tr>
          <td>${result.title || result.name || `Test ${idx + 1}`}</td>
          <td><span class="badge ${result.status === 'passed' ? 'badge-pass' : 'badge-fail'}">${result.status || 'unknown'}</span></td>
          <td>${result.response_time_ms?.toFixed(2) || 'N/A'}ms</td>
          <td>${result.actual_status || result.status_code || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-report-${new Date().toISOString().split('T')[0]}.html`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "HTML report downloaded",
    });
  };

  // Export results as JSON
  const exportAsJSON = () => {
    if (!executionResults) return;
    
    const blob = new Blob([JSON.stringify(executionResults, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-test-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "JSON results downloaded",
    });
  };

  // Export results in Allure format
  const exportAsAllure = () => {
    if (!executionResults) return;
    
    const testResults = executionResults.test_results || [];
    const executionId = executionResults.execution_id || `exec_${Date.now()}`;
    
    // Generate Allure-compatible JSON files
    const allureResults: any[] = testResults.map((result: any, idx: number) => {
      const uuid = `${executionId}_${idx}_${Date.now()}`;
      const startTime = result.start_time ? new Date(result.start_time).getTime() : Date.now() - (result.response_time_ms || 0);
      const stopTime = startTime + (result.response_time_ms || 0);
      
      return {
        uuid: uuid,
        historyId: `${result.test_case_id || result.title || `test_${idx}`}`,
        name: result.title || result.name || `Test ${idx + 1}`,
        fullName: `api.tests.${result.test_case_id || `test_${idx}`}`,
        status: result.status === 'passed' ? 'passed' : 'failed',
        statusDetails: result.status !== 'passed' ? {
          message: result.error_message || 'Test failed',
          trace: result.stack_trace || ''
        } : undefined,
        stage: 'finished',
        start: startTime,
        stop: stopTime,
        labels: [
          { name: 'suite', value: 'API Test Suite' },
          { name: 'subSuite', value: result.category || 'functional' },
          { name: 'host', value: 'localhost' },
          { name: 'thread', value: 'main' },
          { name: 'package', value: 'api.tests' },
          { name: 'testMethod', value: result.method || 'GET' },
          { name: 'severity', value: result.priority || 'normal' },
          ...(result.tags || []).map((tag: string) => ({ name: 'tag', value: tag }))
        ],
        parameters: [
          { name: 'endpoint', value: result.endpoint || result.url || '' },
          { name: 'method', value: result.method || 'GET' },
          { name: 'expected_status', value: String(result.expected_status || 200) },
          { name: 'actual_status', value: String(result.actual_status || result.status_code || '') }
        ],
        attachments: result.response_body ? [
          {
            name: 'Response Body',
            source: `${uuid}-response.json`,
            type: 'application/json'
          }
        ] : [],
        steps: [
          {
            name: `${result.method || 'GET'} ${result.endpoint || result.url || '/'}`,
            status: result.status === 'passed' ? 'passed' : 'failed',
            start: startTime,
            stop: stopTime,
            attachments: [],
            parameters: []
          }
        ]
      };
    });

    // Create a ZIP-like structure with all results
    const allureContainer = {
      uuid: executionId,
      name: 'API Test Suite',
      children: allureResults.map(r => r.uuid),
      befores: [],
      afters: [],
      start: Math.min(...allureResults.map(r => r.start)),
      stop: Math.max(...allureResults.map(r => r.stop))
    };

    // Export as single JSON file (can be used with allure generate)
    const allureExport = {
      _meta: {
        format: 'allure2',
        version: '2.0',
        generated: new Date().toISOString()
      },
      container: allureContainer,
      results: allureResults
    };
    
    const blob = new Blob([JSON.stringify(allureExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `allure-results-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({
      title: "Exported",
      description: "Allure format results downloaded. Use 'allure generate' to create the report.",
    });
  };

  // Generate report content for inline viewing
  const generateJUnitXMLContent = (): string => {
    if (!executionResults) return '';
    const testResults = executionResults.test_results || [];
    const summary = executionResults.summary || {};
    return `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="API Test Suite" tests="${summary.total || 0}" failures="${summary.failed || 0}" errors="0" time="${(summary.total_duration_ms || 0) / 1000}">
${testResults.map((result: any, idx: number) => `  <testcase name="${result.title || result.name || `Test ${idx + 1}`}" classname="api.tests" time="${(result.response_time_ms || 0) / 1000}">
${result.status !== 'passed' ? `    <failure message="${result.error_message || 'Test failed'}" type="${result.error_type || 'AssertionError'}">
      Expected: ${result.expected_status || 200}
      Actual: ${result.actual_status || 'N/A'}
    </failure>` : ''}
  </testcase>`).join('\n')}
</testsuite>`;
  };

  const generateHTMLContent = (): string => {
    if (!executionResults) return '';
    const testResults = executionResults.test_results || [];
    const summary = executionResults.summary || {};
    return `<!DOCTYPE html>
<html>
<head>
  <title>API Test Report - ${new Date().toLocaleDateString()}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 100%; background: white; padding: 24px; border-radius: 8px; }
    h1 { color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px; font-size: 1.5rem; }
    h2 { font-size: 1.2rem; margin-top: 20px; }
    .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 20px 0; }
    .stat { text-align: center; padding: 16px; background: #f8f9fa; border-radius: 8px; }
    .stat-value { font-size: 28px; font-weight: bold; }
    .stat-label { color: #666; margin-top: 4px; font-size: 12px; }
    .passed { color: #22c55e; }
    .failed { color: #ef4444; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f8f9fa; font-weight: 600; }
    .badge { padding: 3px 10px; border-radius: 12px; font-size: 11px; display: inline-block; }
    .badge-pass { background: #dcfce7; color: #166534; }
    .badge-fail { background: #fee2e2; color: #991b1b; }
    .timestamp { color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>🧪 API Test Report</h1>
    <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>
    <div class="summary">
      <div class="stat"><div class="stat-value">${summary.total || 0}</div><div class="stat-label">Total Tests</div></div>
      <div class="stat"><div class="stat-value passed">${summary.passed || 0}</div><div class="stat-label">Passed</div></div>
      <div class="stat"><div class="stat-value failed">${summary.failed || 0}</div><div class="stat-label">Failed</div></div>
      <div class="stat"><div class="stat-value">${summary.pass_rate?.toFixed(1) || 0}%</div><div class="stat-label">Pass Rate</div></div>
    </div>
    <h2>Test Results</h2>
    <table>
      <thead><tr><th>Test Case</th><th>Status</th><th>Response Time</th><th>Status Code</th></tr></thead>
      <tbody>
        ${testResults.map((result: any, idx: number) => `
        <tr>
          <td>${result.title || result.name || `Test ${idx + 1}`}</td>
          <td><span class="badge ${result.status === 'passed' ? 'badge-pass' : 'badge-fail'}">${result.status || 'unknown'}</span></td>
          <td>${result.response_time_ms?.toFixed(2) || 'N/A'}ms</td>
          <td>${result.actual_status || result.status_code || 'N/A'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;
  };

  const generateAllureContent = (): string => {
    if (!executionResults) return '';
    const testResults = executionResults.test_results || [];
    const executionId = executionResults.execution_id || `exec_${Date.now()}`;
    const allureResults = testResults.map((result: any, idx: number) => {
      const uuid = `${executionId}_${idx}`;
      const startTime = result.start_time ? new Date(result.start_time).getTime() : Date.now();
      return {
        uuid, name: result.title || result.name || `Test ${idx + 1}`,
        status: result.status === 'passed' ? 'passed' : 'failed',
        start: startTime, stop: startTime + (result.response_time_ms || 0),
        labels: [{ name: 'suite', value: 'API Test Suite' }],
        parameters: [
          { name: 'endpoint', value: result.endpoint || result.url || '' },
          { name: 'method', value: result.method || 'GET' }
        ]
      };
    });
    return JSON.stringify({ format: 'allure2', results: allureResults }, null, 2);
  };
  
  // Pending API requests from Record tab (Quick API Test)
  const [pendingApiRequests, setPendingApiRequests] = useState<any[]>([]);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
  const [executingRequestId, setExecutingRequestId] = useState<string | null>(null);
  const [requestResults, setRequestResults] = useState<Record<string, any>>({});

  // Execute a single API request
  const executeRequest = async (req: any) => {
    setExecutingRequestId(req.id);
    const startTime = Date.now();
    
    try {
      // Fix double slashes in URL (e.g., http://localhost:8002//api/cart -> http://localhost:8002/api/cart)
      const normalizedUrl = req.url.replace(/([^:]\/)\/+/g, '$1');
      
      const response = await fetch(normalizedUrl, {
        method: req.method,
        headers: req.headers || {},
        body: req.method !== 'GET' && req.body ? req.body : undefined,
      });
      
      const responseTime = Date.now() - startTime;
      let responseData;
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
      
      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        responseTime,
        data: responseData,
        headers: Object.fromEntries(response.headers.entries()),
      };
      
      setRequestResults(prev => ({ ...prev, [req.id]: result }));
      
      toast({
        title: response.ok ? "✅ Request Successful" : "❌ Request Failed",
        description: `${req.method} ${req.name} - ${response.status} (${responseTime}ms)`,
        variant: response.ok ? "default" : "destructive",
      });
      
      return result;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      const result = {
        success: false,
        status: 0,
        statusText: 'Network Error',
        responseTime,
        error: error.message,
      };
      
      setRequestResults(prev => ({ ...prev, [req.id]: result }));
      
      toast({
        title: "❌ Request Failed",
        description: `${req.method} ${req.name} - ${error.message}`,
        variant: "destructive",
      });
      
      return result;
    } finally {
      setExecutingRequestId(null);
    }
  };

  // Execute all requests sequentially
  const executeAllRequests = async () => {
    toast({
      title: "🚀 Running All Requests",
      description: `Testing ${pendingApiRequests.length} endpoints...`,
    });
    
    const results: any[] = [];
    for (const req of pendingApiRequests) {
      const result = await executeRequest(req);
      results.push({ ...req, result });
    }
    
    const successful = results.filter(r => r.result.success).length;
    const failed = results.length - successful;
    
    toast({
      title: "📊 Test Complete",
      description: `${successful} passed, ${failed} failed`,
      variant: failed > 0 ? "destructive" : "default",
    });
  };

  const loadPersistedEnvironments = (): any[] => {
    try {
      const saved = localStorage.getItem("apex_environments");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      console.error("Failed to load persisted environments:", error);
    }
    return [];
  };

  const saveEnvironmentsToLocalStorage = (envs: any[]) => {
    try {
      localStorage.setItem("apex_environments", JSON.stringify(envs));
    } catch (error) {
      console.error("Failed to save environments:", error);
    }
  };

  const loadCapabilities = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/capabilities`);
      const data = await response.json();
      console.log("Capabilities:", data);
    } catch (error) {
      console.error("Failed to load capabilities:", error);
    }
  };

  const loadDbConnections = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/database/connections`);
      const data = await response.json();
      if (data.status === "success") {
        setDbConnections(data.connections);
      }
    } catch (error) {
      console.error("Failed to load database connections:", error);
    }
  };

  const loadVirtualServices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service`);
      const data = await response.json();
      if (data.status === "success") {
        setVirtualServices(data.virtual_services || []);
      }
    } catch (error) {
      console.error("Failed to load virtual services:", error);
    }
  };

  const loadFlowstralSessions = async () => {
    setLoadingFlowstral(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/flowstral/sessions`);
      if (response.ok) {
        const data = await response.json();
        setFlowstralSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to load Flowstral sessions:", error);
    } finally {
      setLoadingFlowstral(false);
    }
  };

  const importFromFlowstral = async (sessionId: string) => {
    setLoading(true);
    try {
      // Get session details
      const sessionResponse = await fetch(`${API_BASE_URL}/api/flowstral/sessions/${sessionId}`);
      if (!sessionResponse.ok) throw new Error("Failed to load session");
      
      const sessionData = await sessionResponse.json();
      
      // Extract HTTP requests from session nodes
      const httpRequests: any[] = [];
      const nodes = sessionData.nodes || [];
      
      nodes.forEach((node: any) => {
        if (node.type === 'action' && node.data?.request) {
          httpRequests.push({
            method: node.data.request.method || 'GET',
            path: node.data.request.url || node.data.url || '/',
            name: node.data.label || node.data.actionType || 'Request',
            headers: node.data.request.headers || {},
            body: node.data.request.body
          });
        }
      });

      // Generate API spec from recorded requests
      const generatedSpec = {
        openapi: "3.1.0",
        info: {
          title: `API from Flowstral Session ${sessionId.substring(0, 8)}`,
          version: "1.0.0",
          description: `Auto-generated from Flowstral recording: ${sessionData.name || sessionId}`
        },
        servers: [{ url: sessionData.initial_url || ECOMMERCE_TEST_URL }],
        paths: httpRequests.reduce((acc: any, req: any, idx: number) => {
          const pathKey = req.path || `/endpoint_${idx}`;
          if (!acc[pathKey]) acc[pathKey] = {};
          acc[pathKey][req.method.toLowerCase()] = {
            summary: req.name,
            operationId: `op_${idx}`,
            responses: { "200": { description: "Success" } }
          };
          return acc;
        }, {})
      };

      setSpecContent(JSON.stringify(generatedSpec, null, 2));
      setProtocol("REST");
      setSpecFormat("openapi");
      
      // Create environment
      const envName = `Flowstral ${sessionId.substring(0, 8)}`;
      const newEnv = {
        environment_id: `env_flowstral_${sessionId}`,
        name: envName,
        type: "development",
        base_url: sessionData.initial_url || ECOMMERCE_TEST_URL,
        variables: {}
      };
      const updatedEnvs = [...environments.filter(e => e.environment_id !== newEnv.environment_id), newEnv];
      setEnvironments(updatedEnvs);
      saveEnvironmentsToLocalStorage(updatedEnvs);
      setSelectedEnvironment(newEnv.environment_id);
      
      toast({
        title: "Flowstral Session Imported",
        description: `Imported ${httpRequests.length} requests. Go to Import tab to generate tests.`,
      });
      
      setActiveTab("import");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to import Flowstral session",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createVirtualService = async () => {
    if (!newVirtualService.name || !newVirtualService.base_url) {
      toast({
        title: "Error",
        description: "Please provide name and base URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          service_config: {
            name: newVirtualService.name,
            base_url: newVirtualService.base_url,
            endpoints: newVirtualService.endpoints
          }
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Virtual service created",
        });
        loadVirtualServices();
        setNewVirtualService({ name: "", base_url: "", endpoints: [] });
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create virtual service",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteVirtualService = async (serviceId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/virtual-service/${serviceId}`, {
        method: "DELETE",
      });
      if (response.ok) {
        toast({ title: "Success", description: "Virtual service deleted" });
        loadVirtualServices();
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete service", variant: "destructive" });
    }
  };

  const loadEnvironments = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/environment`);
      const data = await response.json();
      if (data.status === "success") {
        // Merge with persisted environments from localStorage
        const persisted = loadPersistedEnvironments();
        const merged = [...(data.environments || []), ...persisted];
        // Remove duplicates by environment_id
        const unique = merged.filter((env, index, self) => 
          index === self.findIndex((e) => e.environment_id === env.environment_id)
        );
        setEnvironments(unique);
        saveEnvironmentsToLocalStorage(unique);
      }
    } catch (error) {
      console.error("Failed to load environments:", error);
      // Fallback to localStorage if API fails
      const persisted = loadPersistedEnvironments();
      if (persisted.length > 0) {
        setEnvironments(persisted);
      }
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        console.log("Initializing EnhancedAPITesting...");
        loadCapabilities();
        // Load persisted environments first (from localStorage)
        const persisted = loadPersistedEnvironments();
        if (persisted.length > 0) {
          setEnvironments(persisted);
          // Load selected environment from localStorage
          const savedEnv = localStorage.getItem("apex_selected_environment");
          if (savedEnv && persisted.find(e => e.environment_id === savedEnv)) {
            setSelectedEnvironment(savedEnv);
          } else if (persisted.length > 0) {
            // Auto-select first environment if saved one not found
            setSelectedEnvironment(persisted[0].environment_id);
            localStorage.setItem("apex_selected_environment", persisted[0].environment_id);
          }
        }
        // Then try to load from API (will merge)
        await loadEnvironments();
        await loadDbConnections();
        await loadVirtualServices();
        console.log("EnhancedAPITesting initialized successfully");
      } catch (error: any) {
        console.error("Error initializing EnhancedAPITesting:", error);
        setError(error?.message || "Failed to initialize");
        toast({
          title: "Error",
          description: error?.message || "Failed to initialize Enhanced API Testing",
          variant: "destructive",
        });
      }
    };
    
    initialize();
  }, []);

  // Check for pending API test requests from Record tab (Quick API Test)
  useEffect(() => {
    const pendingRequests = sessionStorage.getItem('pendingApiTestRequests');
    const pendingTimestamp = sessionStorage.getItem('pendingApiTestTimestamp');
    
    if (pendingRequests && pendingTimestamp) {
      // Only process if less than 30 seconds old
      const age = Date.now() - parseInt(pendingTimestamp);
      if (age < 30000) {
        try {
          const requests = JSON.parse(pendingRequests);
          if (Array.isArray(requests) && requests.length > 0) {
            setPendingApiRequests(requests);
            setShowPendingBanner(true);
            toast({
              title: "📡 API Requests Loaded",
              description: `${requests.length} HTTP requests imported from recording`,
            });
          }
        } catch (e) {
          console.error('Failed to parse pending API test requests:', e);
        }
      }
      
      // Clear the pending data
      sessionStorage.removeItem('pendingApiTestRequests');
      sessionStorage.removeItem('pendingApiTestTimestamp');
    }
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setLoading(true);

    try {
      // First, parse the spec using old endpoint
      const formData = new FormData();
      formData.append("file", file);
      
      const filename = file.name.toLowerCase();
      let format = "openapi";
      if (filename.endsWith(".wsdl") || filename.endsWith(".xml")) {
        format = "wsdl";
      } else if (filename.includes("postman")) {
        format = "postman";
      } else if (filename.endsWith(".graphql") || filename.endsWith(".gql")) {
        format = "graphql";
      } else if (filename.endsWith(".har") || filename.endsWith(".har.json")) {
        format = "har";
      }
      
      formData.append("spec_format", format);

      const parseResponse = await fetch(`${API_BASE_URL}/api/import/spec/file`, {
        method: "POST",
        body: formData,
      });

      if (!parseResponse.ok) {
        throw new Error(`Failed to import: ${parseResponse.statusText}`);
      }

      const parseData = await parseResponse.json();
      setParsedSpec(parseData.parsed_spec);
      
      // Now generate enhanced test suite
      const enhanceResponse = await fetch(`${API_BASE_URL}/api/v2/testing/test-suite/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_spec: parseData.parsed_spec,
          spec_format: format === "har" ? "openapi" : format,
          protocol: protocol,
          test_options: {}
        }),
      });

      if (!enhanceResponse.ok) {
        throw new Error(`Failed to generate enhanced test suite: ${enhanceResponse.statusText}`);
      }

      const enhanceData = await enhanceResponse.json();
      setTestSuite(enhanceData.test_suite);
      
      toast({
        title: "Success",
        description: `Generated ${enhanceData.summary?.total_test_cases ?? enhanceData.test_suite?.metadata?.total_test_cases ?? 0} comprehensive test cases`,
      });
      
      setActiveTab("execute");
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
      // Parse spec - determine content type based on format
      let contentType = "json";
      if (specFormat === "wsdl") contentType = "xml";
      else if (specFormat === "graphql") contentType = "graphql";
      else if (specFormat === "har") contentType = "json";
      
      const parseResponse = await fetch(`${API_BASE_URL}/api/import/spec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spec_content: specContent,
          spec_format: specFormat,
          content_type: contentType,
        }),
      });

      if (!parseResponse.ok) {
        throw new Error(`Failed to import: ${parseResponse.statusText}`);
      }

      const parseData = await parseResponse.json();
      setParsedSpec(parseData.parsed_spec);
      
      // Generate enhanced test suite (HAR parses to openapi-like)
      const enhanceResponse = await fetch(`${API_BASE_URL}/api/v2/testing/test-suite/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_spec: parseData.parsed_spec,
          spec_format: specFormat === "har" ? "openapi" : specFormat,
          protocol: protocol,
          test_options: {}
        }),
      });

      if (!enhanceResponse.ok) {
        throw new Error(`Failed to generate enhanced test suite: ${enhanceResponse.statusText}`);
      }

      const enhanceData = await enhanceResponse.json();
      setTestSuite(enhanceData.test_suite);
      
      toast({
        title: "Success",
        description: `Generated ${enhanceData.summary?.total_test_cases ?? enhanceData.test_suite?.metadata?.total_test_cases ?? 0} comprehensive test cases`,
      });
      
      setActiveTab("execute");
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

  const exportToPostman = async () => {
    if (!testSuite?.test_cases?.length) {
      toast({ title: "No test suite", description: "Import a spec or HAR first", variant: "destructive" });
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/import/export-postman`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test_suite: testSuite, name: "QAAI API Collection" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const blob = new Blob([data.collection_json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "qaai-postman-collection.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported", description: "Postman collection downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export Postman", variant: "destructive" });
    }
  };

  const exportToHAR = async () => {
    if (!testSuite?.test_cases?.length) {
      toast({ title: "No test suite", description: "Import a spec or HAR first", variant: "destructive" });
      return;
    }
    try {
      const baseUrl = testSuite.base_url || "";
      const requests = (testSuite.test_cases || []).map((tc: any, i: number) => {
        const req = tc.request || {};
        const url = req.url || (baseUrl + (tc.path || ""));
        return {
          url,
          method: tc.method || "GET",
          headers: req.headers || {},
          body: req.body,
          statusCode: tc.expected_status || 200,
          duration: 0,
          timestamp: Date.now() / 1000,
        };
      });
      const res = await fetch(`${API_BASE_URL}/api/import/export-har`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests, creator_name: "QAAI" }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      const blob = new Blob([data.har_json], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "qaai-export.har.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast({ title: "Exported", description: "HAR file downloaded" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Failed to export HAR", variant: "destructive" });
    }
  };

  const handleConnectDatabase = async () => {
    if (!dbConfig.connection_id || !dbConfig.host || !dbConfig.database) {
      toast({
        title: "Error",
        description: "Please fill in all required database fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/database/connect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          connection_id: dbConfig.connection_id,
          db_type: dbConfig.db_type,
          connection_config: {
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: dbConfig.password
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.statusText}`);
      }

      const data = await response.json();
      
      toast({
        title: "Success",
        description: `Connected to ${dbConfig.db_type} database`,
      });
      
      loadDbConnections();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to connect to database",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteTests = async () => {
    if (!testSuite) {
      toast({
        title: "Error",
        description: "Please generate a test suite first",
        variant: "destructive",
      });
      return;
    }

    // Get selected environment's base URL
    const selectedEnv = environments.find(e => e.environment_id === selectedEnvironment);
    const baseUrl = selectedEnv?.base_url || envConfig.base_url || "http://localhost:8002";
    
    if (!baseUrl || baseUrl === "https://api.example.com") {
      toast({
        title: "Error",
        description: "Please select an environment with a valid base URL",
        variant: "destructive",
      });
      return;
    }

    setExecuting(true);
    setExecutionResults(null);

    try {
      // Filter test cases if any are selected
      let testSuiteToExecute = testSuite;
      
      // Get all test cases - combine test_cases and test_categories
      const baseTestCases: any[] = testSuite.test_cases || [];
      const testCategories = testSuite.test_categories || {};
      
      // Flatten all test cases from categories
      const categoryTestCases: any[] = [];
      Object.values(testCategories).forEach((categoryTests: any) => {
        if (Array.isArray(categoryTests)) {
          categoryTestCases.push(...categoryTests);
        }
      });
      
      // Combine base test cases with category test cases, avoiding duplicates
      const allTestCasesMap = new Map();
      
      // Add base test cases first
      baseTestCases.forEach((tc, idx) => {
        const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `base_${idx}`;
        allTestCasesMap.set(id, tc);
      });
      
      // Add category test cases
      categoryTestCases.forEach((tc, idx) => {
        const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `cat_${idx}`;
        allTestCasesMap.set(id, tc);
      });
      
      const allTestCases = Array.from(allTestCasesMap.values());
      const totalTestCases = allTestCases.length;
      
      console.log("Total test cases available:", totalTestCases);
      console.log("Selected test cases:", selectedTestCases.size);
      console.log("Base URL:", baseUrl);
      
      // Normalize test cases to match backend expected format
      const normalizeTestCase = (tc: any) => {
        // Extract path from various possible fields
        const path = tc.path || tc.endpoint || tc.url || 
                    (tc.request?.url) || (tc.steps?.[0]?.url) || "";
        
        // Extract method from various possible fields
        const method = tc.method || tc.http_method || 
                      (tc.request?.method) || (tc.steps?.[0]?.method) || "GET";
        
        // Get existing request body
        let requestBody = tc.request?.body || tc.body || tc.request_body || tc.payload || tc.request_payload;
        
        // Generate default request body for POST/PUT/PATCH endpoints if missing
        if (!requestBody && ["POST", "PUT", "PATCH"].includes(method.toUpperCase())) {
          // Generate default body based on endpoint
          if (path.includes("/auth/register")) {
            requestBody = {
              email: `test_${Date.now()}@example.com`,
              username: `testuser_${Date.now()}`,
              password: "TestPassword123!",
              full_name: "Test User"
            };
          } else if (path.includes("/auth/login")) {
            requestBody = {
              username: "testuser",
              password: "TestUser@2024!Secure#Pass"
            };
          } else if (path.includes("/products") && method === "POST") {
            requestBody = {
              name: "Test Product",
              description: "Test Description",
              price: 99.99,
              category_id: 1,
              stock: 10
            };
          } else if (path.includes("/cart")) {
            requestBody = {
              product_id: 1,
              quantity: 1
            };
          } else if (path.includes("/orders")) {
            requestBody = {
              shipping_address: {
                street: "123 Test St",
                city: "Test City",
                state: "TS",
                zip: "12345",
                country: "USA"
              },
              payment_method: "credit_card"
            };
          } else {
            // Generic default body
            requestBody = {};
          }
        }
        
        // Normalize to backend expected format
        return {
          test_case_id: tc.test_case_id || tc.test_id || tc.id || `test_${Date.now()}_${Math.random()}`,
          title: tc.title || tc.name || tc.test_name || "Untitled Test",
          method: method.toUpperCase(),
          path: path.startsWith("/") ? path : `/${path}`,
          request: {
            headers: tc.request?.headers || tc.headers || {
              "Content-Type": "application/json"
            },
            body: requestBody,
            query: tc.request?.query || tc.query || tc.query_params || {}
          },
          expected_status: tc.expected_status || tc.expectedStatusCode || 200,
          assertions: tc.assertions || [],
          test_type: tc.test_type || tc.category || "functional",
          ...tc  // Keep original fields for reference
        };
      };
      
      let testCasesToExecute = allTestCases;
      
      if (selectedTestCases.size > 0 && selectedTestCases.size < totalTestCases) {
        console.log("Selected test case IDs:", Array.from(selectedTestCases));
        console.log("First original test case:", allTestCases[0]);
        
        // Try multiple ways to match test IDs
        testCasesToExecute = allTestCases.filter((tc: any) => {
          // Try all possible ID fields
          const possibleIds = [
            tc.test_id,
            tc.name,
            tc.test_name,
            tc.test_case_id,
            tc.id,
            tc.title,
            // Generate the same ID format used in selection
            `test_${allTestCases.indexOf(tc)}`
          ].filter(id => id !== undefined && id !== null);
          
          // Check if any of the possible IDs match
          const matches = possibleIds.some(id => selectedTestCases.has(String(id)));
          
          if (matches) {
            console.log("Matched test case:", tc.name || tc.test_name || tc.title, "with IDs:", possibleIds);
          }
          
          return matches;
        });
        console.log("Filtered test cases count:", testCasesToExecute.length);
        
        if (testCasesToExecute.length === 0) {
          console.warn("No test cases matched! Selected IDs:", Array.from(selectedTestCases));
          console.warn("Available test case IDs in first 5:", allTestCases.slice(0, 5).map((tc: any, idx: number) => ({
            idx,
            test_id: tc.test_id,
            name: tc.name,
            test_name: tc.test_name,
            test_case_id: tc.test_case_id,
            id: tc.id,
            title: tc.title,
            generated_id: tc.test_id || tc.name || tc.test_name || `test_${idx}`
          })));
        }
      }

      // Normalize all test cases
      const normalizedTestCases = testCasesToExecute.map(normalizeTestCase);
      
      // Ensure test_cases array exists and has items
      if (normalizedTestCases.length === 0) {
        toast({
          title: "Error",
          description: "No test cases to execute. Please ensure test suite has test cases.",
          variant: "destructive",
        });
        setExecuting(false);
        return;
      }

      // Log first test case structure for debugging
      console.log("First normalized test case:", normalizedTestCases[0]);
      console.log("Request body in first test case:", normalizedTestCases[0]?.request?.body);
      
      // Check if POST/PUT/PATCH requests have bodies
      const requestsWithoutBodies = normalizedTestCases.filter((tc: any) => 
        ["POST", "PUT", "PATCH"].includes(tc.method) && 
        (!tc.request?.body || Object.keys(tc.request.body || {}).length === 0)
      );
      if (requestsWithoutBodies.length > 0) {
        console.warn(`Warning: ${requestsWithoutBodies.length} POST/PUT/PATCH requests have no body:`, 
          requestsWithoutBodies.map((tc: any) => ({ path: tc.path, method: tc.method })));
      }
      
      testSuiteToExecute = {
        ...testSuite,
        test_cases: normalizedTestCases
      };

      const requestBody = {
        test_suite: {
          ...testSuiteToExecute,
          base_url: baseUrl  // Add base_url to test_suite as well
        },
        execution_config: {
          base_url: baseUrl,
          parallel: true,
          max_workers: 10
        },
        mode: executionMode
      };

      console.log("Sending execution request:", {
        test_cases_count: requestBody.test_suite.test_cases?.length || 0,
        base_url: baseUrl,
        mode: executionMode
      });

      const response = await fetch(`${API_BASE_URL}/api/v2/testing/execute`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Failed to execute tests: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Execution response:", data);
      
      if (data.execution_results) {
        console.log("Execution results:", data.execution_results);
        console.log("Test results count:", data.execution_results.test_results?.length || 0);
        console.log("Summary:", data.execution_results.summary);
        setExecutionResults(data.execution_results);
        
        // Auto-switch to Results tab
        setActiveTab("results");
      } else {
        console.error("No execution_results in response:", data);
        throw new Error("Invalid response format from execution endpoint");
      }
      
      // Generate report
      const reportResponse = await fetch(`${API_BASE_URL}/api/v2/testing/report/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data.execution_results),
      });

      if (reportResponse.ok) {
        const reportData = await reportResponse.json();
        setReports([...reports, reportData.report]);
      }
      
      toast({
        title: "Success",
        description: `Executed ${data.execution_results.summary?.total || 0} tests`,
      });
      
      setActiveTab("results");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to execute tests",
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleCreateEnvironment = async () => {
    if (!envConfig.name || !envConfig.base_url) {
      toast({
        title: "Error",
        description: "Please fill in environment name and base URL",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/v2/testing/environment/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          environment_config: envConfig
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create environment: ${response.statusText}`);
      }

      const result = await response.json();
      const newEnv = result.environment || {
        environment_id: `env_${Date.now()}`,
        name: envConfig.name,
        type: envConfig.type,
        base_url: envConfig.base_url,
        variables: envConfig.variables
      };
      
      // Add to local state and persist
      const updatedEnvs = [...environments, newEnv];
      setEnvironments(updatedEnvs);
      saveEnvironmentsToLocalStorage(updatedEnvs);
      
      // Auto-select if first environment
      if (environments.length === 0) {
        setSelectedEnvironment(newEnv.environment_id);
        localStorage.setItem("apex_selected_environment", newEnv.environment_id);
      }
      
      toast({
        title: "Success",
        description: `Environment "${envConfig.name}" created and saved`,
      });
      
      setEnvConfig({ name: "", type: "development", base_url: "", variables: {} });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create environment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Error loading Enhanced API Testing:</strong> {error}
            <br />
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-2"
              variant="outline"
            >
              Reload Page
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-white dark:bg-gray-950">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-lg shadow-primary/25">
              <Globe className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">API Testing</h1>
              <p className="text-sm text-gray-400">
                Multi-protocol support • Database connectivity • Comprehensive reporting
              </p>
            </div>
          </div>
          <Badge className="text-sm px-4 py-2 bg-primary/10 text-primary border border-primary/20">
            <Zap className="w-4 h-4 mr-2" />
            Enterprise Grade
          </Badge>
        </div>

      {/* Banner for pending API requests from Record tab */}
      {showPendingBanner && pendingApiRequests.length > 0 && (
        <Alert className="bg-violet-500/10 border-violet-500/30">
          <Zap className="h-4 w-4 text-violet-500" />
          <AlertDescription className="flex items-center justify-between">
            <span>
              <strong className="text-violet-600 dark:text-violet-400">
                {pendingApiRequests.length} HTTP requests
              </strong>{' '}
              imported from recording. Click to test each endpoint.
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => setShowPendingBanner(false)}
              >
                Dismiss
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Quick Test Panel - Shows captured requests */}
      {pendingApiRequests.length > 0 && (
        <Card className="border-violet-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="w-5 h-5 text-violet-500" />
              Captured API Requests ({pendingApiRequests.length})
            </CardTitle>
            <CardDescription>
              HTTP requests captured during recording - click to test
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {pendingApiRequests.map((req, index) => {
                const result = requestResults[req.id];
                const isExecuting = executingRequestId === req.id;
                
                return (
                  <div 
                    key={req.id || index}
                    className={`p-3 rounded-lg border transition-colors ${
                      result?.success === true ? 'bg-green-500/10 border-green-500/30' :
                      result?.success === false ? 'bg-red-500/10 border-red-500/30' :
                      'bg-secondary/50 border-border hover:border-primary/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge 
                          variant="outline" 
                          className={
                            req.method === 'GET' ? 'bg-green-500/10 text-green-600 border-green-500/30' :
                            req.method === 'POST' ? 'bg-blue-500/10 text-blue-600 border-blue-500/30' :
                            req.method === 'PUT' ? 'bg-orange-500/10 text-orange-600 border-orange-500/30' :
                            req.method === 'DELETE' ? 'bg-red-500/10 text-red-600 border-red-500/30' :
                            'bg-gray-500/10 text-gray-600 border-gray-500/30'
                          }
                        >
                          {req.method}
                        </Badge>
                        <div>
                          <p className="font-medium text-sm">{req.name || new URL(req.url).pathname}</p>
                          <p className="text-xs text-muted-foreground truncate max-w-[400px]">{req.url}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {result && (
                          <Badge variant={result.success ? "default" : "destructive"} className="text-xs">
                            {result.status} • {result.responseTime}ms
                          </Badge>
                        )}
                        <Button 
                          size="sm" 
                          variant="ghost"
                          disabled={isExecuting}
                          onClick={() => executeRequest(req)}
                        >
                          {isExecuting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    {/* Show response preview */}
                    {result && (
                      <div className="mt-2 pt-2 border-t border-border/50">
                        <p className="text-xs text-muted-foreground mb-1">Response:</p>
                        <pre className="text-xs bg-black/20 p-2 rounded max-h-[100px] overflow-auto">
                          {typeof result.data === 'object' 
                            ? JSON.stringify(result.data, null, 2).slice(0, 500) 
                            : String(result.data || result.error).slice(0, 500)}
                          {(JSON.stringify(result.data)?.length > 500) && '...'}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
              <Button 
                variant="outline" 
                onClick={() => {
                  setPendingApiRequests([]);
                  setShowPendingBanner(false);
                  setRequestResults({});
                }}
              >
                Clear All
              </Button>
              <Button 
                onClick={executeAllRequests}
                disabled={executingRequestId !== null}
              >
                {executingRequestId ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Play className="w-4 h-4 mr-2" />
                )}
                Test All
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="flex w-full bg-card border border-border p-1 overflow-x-auto">
          <TabsTrigger value="builder" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
            <Send className="w-4 h-4 mr-1" />
            Builder
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">
            <Rocket className="w-4 h-4 mr-1" />
            Templates
          </TabsTrigger>
          <TabsTrigger value="import" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Import</TabsTrigger>
          <TabsTrigger value="chains" className="flex-1 min-w-0 data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-500 text-muted-foreground">
            <Link2 className="w-4 h-4 mr-1" />
            Chains
          </TabsTrigger>
          <TabsTrigger value="execute" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Execute</TabsTrigger>
          <TabsTrigger value="security" className="flex-1 min-w-0 data-[state=active]:bg-red-500/20 data-[state=active]:text-red-500 text-muted-foreground">
            <Shield className="w-4 h-4 mr-1" />
            Security
          </TabsTrigger>
          <TabsTrigger value="environments" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Env</TabsTrigger>
          <TabsTrigger value="mock" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Mock</TabsTrigger>
          <TabsTrigger value="results" className="flex-1 min-w-0 data-[state=active]:bg-primary/20 data-[state=active]:text-primary text-muted-foreground">Results</TabsTrigger>
        </TabsList>

        {/* Builder Tab - Ad-hoc Request Builder */}
        <TabsContent value="builder" className="space-y-4">
          <TabErrorBoundary tabName="Builder">
            <RequestBuilder />
          </TabErrorBoundary>
        </TabsContent>

        {/* Templates Tab - Quick Start */}
        <TabsContent value="templates" className="space-y-4">
          <Alert className="bg-card border-border text-foreground">
            <Rocket className="h-4 w-4 text-primary" />
            <AlertDescription>
              <strong className="text-foreground">Quick Start:</strong> Load pre-configured protocol templates for the e-commerce test site at <code className="bg-secondary px-1 rounded text-primary">{ECOMMERCE_TEST_URL}</code>
            </AlertDescription>
          </Alert>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(PROTOCOL_TEMPLATES).map(([key, template]) => (
              <Card key={key} className="bg-white dark:bg-gray-900 border-gray-700 cursor-pointer hover:border-amber-500/50 transition-all">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-gray-900 dark:text-white">
                    <span className="text-2xl">{template.icon}</span>
                    {template.name}
                  </CardTitle>
                  <CardDescription className="text-gray-400">{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Protocol:</span>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">{template.protocol}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Format:</span>
                      <Badge variant="outline" className="border-gray-600 text-gray-300">{template.format}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Base URL:</span>
                      <span className="text-xs font-mono truncate max-w-[150px] text-gray-400">{template.baseUrl}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-500 text-primary-foreground"
                      onClick={async () => {
                        setProtocol(template.protocol);
                        setSpecFormat(template.format);
                        
                        // Set spec content
                        if (typeof template.spec === 'string') {
                          setSpecContent(template.spec);
                        } else {
                          setSpecContent(JSON.stringify(template.spec, null, 2));
                        }
                        
                        // Create environment for this template
                        const envName = `${template.name} - Test`;
                        const existingEnv = environments.find(e => e.name === envName);
                        if (!existingEnv) {
                          const newEnv = {
                            environment_id: `env_${key}_${Date.now()}`,
                            name: envName,
                            type: "development",
                            base_url: template.baseUrl,
                            variables: {}
                          };
                          const updatedEnvs = [...environments, newEnv];
                          setEnvironments(updatedEnvs);
                          saveEnvironmentsToLocalStorage(updatedEnvs);
                          setSelectedEnvironment(newEnv.environment_id);
                        }
                        
                        toast({
                          title: "Template Loaded",
                          description: `${template.name} loaded. Go to Import tab to generate tests.`,
                        });
                        
                        setActiveTab("import");
                      }}
                    >
                      <FileCode className="w-4 h-4 mr-2" />
                      Load
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        const content = typeof template.spec === 'string' 
                          ? template.spec 
                          : JSON.stringify(template.spec, null, 2);
                        navigator.clipboard.writeText(content);
                        toast({
                          title: "Copied",
                          description: "Template copied to clipboard",
                        });
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                How to Use Templates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">1</span>
                    Load Template
                  </div>
                  <p className="text-muted-foreground">Click "Load" on any template above to load its specification</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">2</span>
                    Generate Tests
                  </div>
                  <p className="text-muted-foreground">Go to Import tab and click "Import Specification" to generate tests</p>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <div className="font-semibold mb-2 flex items-center gap-2">
                    <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs">3</span>
                    Execute
                  </div>
                  <p className="text-muted-foreground">Go to Execute tab, select environment, and run your tests</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Import Tab */}
        <TabsContent value="import" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Import API Specification</CardTitle>
              <CardDescription>
                Import OpenAPI, Swagger, WSDL, Postman, GraphQL, or HAR (from recorder/desktop)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Protocol</Label>
                  <Select value={protocol} onValueChange={setProtocol}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="REST">REST</SelectItem>
                      <SelectItem value="SOAP">SOAP</SelectItem>
                      <SelectItem value="GraphQL">GraphQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Format</Label>
                  <Select value={specFormat} onValueChange={setSpecFormat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openapi">OpenAPI/Swagger</SelectItem>
                      <SelectItem value="wsdl">WSDL/SOAP</SelectItem>
                      <SelectItem value="postman">Postman</SelectItem>
                      <SelectItem value="graphql">GraphQL</SelectItem>
                      <SelectItem value="har">HAR (recorded traffic)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Upload File</Label>
                <Input
                  type="file"
                  accept=".json,.yaml,.yml,.xml,.wsdl,.graphql,.gql,.har"
                  onChange={handleFileUpload}
                  disabled={loading}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Or Paste Specification</Label>
                <Textarea
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  placeholder="Paste your API specification here..."
                  className="min-h-[200px] font-mono text-sm"
                />
                <Button onClick={handleTextImport} disabled={loading || !specContent.trim()}>
                  {loading ? "Importing..." : "Import Specification"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Chains Tab - Request Chaining */}
        <TabsContent value="chains" className="space-y-4">
          <TabErrorBoundary tabName="Chains">
            <RequestChainBuilder />
          </TabErrorBoundary>
        </TabsContent>

        {/* Execute Tab */}
        <TabsContent value="execute" className="space-y-4">
          <TabErrorBoundary tabName="Execute">
          {!testSuite && (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Play className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Test Suite Ready</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  Import an API specification or use a template to generate test cases before executing.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("templates")}>
                    <Rocket className="w-4 h-4 mr-2" />
                    Load Template
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("import")}>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Spec
                  </Button>
                  <Button variant="default" onClick={() => setActiveTab("builder")}>
                    <Zap className="w-4 h-4 mr-2" />
                    Build Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Execute Tests</CardTitle>
              <CardDescription>
                Execute test suite in various modes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Environment Selector */}
              <div className="space-y-2">
                <Label>Environment *</Label>
                <Select 
                  value={selectedEnvironment} 
                  onValueChange={(value) => {
                    setSelectedEnvironment(value);
                    localStorage.setItem("apex_selected_environment", value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select environment" />
                  </SelectTrigger>
                  <SelectContent>
                    {environments.length === 0 ? (
                      <SelectItem value="__no_env__" disabled>No environments. Create one in Env tab.</SelectItem>
                    ) : (
                      environments.map((env) => (
                        <SelectItem key={env.environment_id} value={env.environment_id}>
                          {env.name} ({env.base_url})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {selectedEnvironment && (
                  <p className="text-sm text-muted-foreground">
                    Base URL: {environments.find(e => e.environment_id === selectedEnvironment)?.base_url || "N/A"}
                  </p>
                )}
              </div>

              {/* Execution Mode */}
              <div className="space-y-2">
                <Label>Execution Mode</Label>
                <Select value={executionMode} onValueChange={setExecutionMode}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="automated">Automated</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="ci_cd">CI/CD</SelectItem>
                    <SelectItem value="load">Load Testing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {testSuite && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Test suite ready: {testSuite.metadata?.total_test_cases || testSuite.test_cases?.length || 0} test cases
                  </AlertDescription>
                </Alert>
              )}

              {/* Test Cases View/Selector */}
              {testSuite && (() => {
                // Get all test cases - combine test_cases and test_categories
                const baseTestCases: any[] = testSuite.test_cases || [];
                const testCategories = testSuite.test_categories || {};
                
                // Flatten all test cases from categories
                const categoryTestCases: any[] = [];
                Object.values(testCategories).forEach((categoryTests: any) => {
                  if (Array.isArray(categoryTests)) {
                    categoryTestCases.push(...categoryTests);
                  }
                });
                
                // Combine base test cases with category test cases, avoiding duplicates
                const allTestCasesMap = new Map();
                
                // Add base test cases first
                baseTestCases.forEach((tc, idx) => {
                  const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `base_${idx}`;
                  allTestCasesMap.set(id, tc);
                });
                
                // Add category test cases (they may override base ones if same ID, which is fine)
                categoryTestCases.forEach((tc, idx) => {
                  const id = tc.test_id || tc.test_case_id || tc.name || tc.test_name || tc.title || tc.id || `cat_${idx}`;
                  allTestCasesMap.set(id, tc);
                });
                
                const allTestCases = Array.from(allTestCasesMap.values());
                const totalCount = allTestCases.length;
                
                if (totalCount === 0) return null;
                
                return (
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Test Cases ({totalCount})</CardTitle>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const allIds = new Set(allTestCases.map((tc: any, idx: number) => 
                                tc.test_id || tc.name || tc.test_name || `test_${idx}`
                              ));
                              setSelectedTestCases(allIds);
                            }}
                          >
                            Select All
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTestCases(new Set())}
                          >
                            Deselect All
                          </Button>
                        </div>
                      </div>
                      <CardDescription>
                        {selectedTestCases.size === 0 
                          ? `All ${totalCount} test cases will run`
                          : `${selectedTestCases.size} of ${totalCount} test cases selected`
                        }
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-96 overflow-y-auto border rounded-md">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-12">
                                <input
                                  type="checkbox"
                                  checked={selectedTestCases.size === totalCount && totalCount > 0}
                                  onChange={(e) => {
                                  if (e.target.checked) {
                                    const allIds = new Set(allTestCases.map((tc: any, idx: number) => 
                                      tc.test_id || 
                                      tc.test_case_id || 
                                      tc.name || 
                                      tc.test_name || 
                                      tc.title ||
                                      tc.id ||
                                      `test_${idx}`
                                    ));
                                    setSelectedTestCases(allIds);
                                    } else {
                                      setSelectedTestCases(new Set());
                                    }
                                  }}
                                  className="cursor-pointer"
                                />
                              </TableHead>
                              <TableHead>Test Case</TableHead>
                              <TableHead>Type</TableHead>
                              <TableHead>Endpoint</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {allTestCases.slice(0, 100).map((testCase: any, idx: number) => {
                              // Generate consistent test ID - must match filtering logic
                              const testId = testCase.test_id || 
                                           testCase.test_case_id || 
                                           testCase.name || 
                                           testCase.test_name || 
                                           testCase.title ||
                                           testCase.id ||
                                           `test_${idx}`;
                              const isSelected = selectedTestCases.has(testId);
                              return (
                                <TableRow key={testId} className={isSelected ? "bg-blue-50" : ""}>
                                  <TableCell>
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={(e) => {
                                        const newSet = new Set(selectedTestCases);
                                        if (e.target.checked) {
                                          newSet.add(testId);
                                        } else {
                                          newSet.delete(testId);
                                        }
                                        setSelectedTestCases(newSet);
                                      }}
                                      className="cursor-pointer"
                                    />
                                  </TableCell>
                                  <TableCell className="font-medium">
                                    <div className="flex items-center gap-2">
                                      <span className="flex-1">
                                        {testCase.name || testCase.test_name || testCase.title || `Test ${idx + 1}`}
                                        {testCase.test_type && testCase.test_type !== "functional" && (
                                          <span className="ml-2 text-xs text-muted-foreground">
                                            ({testCase.test_type})
                                          </span>
                                        )}
                                      </span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 w-8 p-0 flex-shrink-0 hover:bg-blue-100 dark:hover:bg-blue-900"
                                        onClick={() => setViewingTestCase(testCase)}
                                        title="View test case details"
                                      >
                                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline">
                                      {testCase.test_type || testCase.category || "functional"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-sm text-muted-foreground">
                                    <span className="font-mono text-xs">
                                      {testCase.method || "GET"} {testCase.endpoint || testCase.url || testCase.path || 
                                       (testCase.request?.url) || (testCase.steps?.[0]?.url) || "N/A"}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                        {totalCount > 100 && (
                          <div className="p-4 text-center text-sm text-muted-foreground">
                            Showing first 100 of {totalCount} test cases
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })()}
              
              <Button 
                onClick={handleExecuteTests} 
                disabled={!testSuite || executing || !selectedEnvironment}
                className="w-full"
              >
                {executing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    {selectedTestCases.size > 0 && selectedTestCases.size < (testSuite?.test_cases?.length || 0)
                      ? `Execute ${selectedTestCases.size} Selected Tests`
                      : "Execute All Tests"
                    }
                  </>
                )}
              </Button>
              {testSuite?.test_cases?.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={exportToPostman} title="Export as Postman Collection v2.1">
                    <Download className="w-4 h-4 mr-1" />
                    Export to Postman
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportToHAR} title="Export as HAR (HTTP Archive)">
                    <Download className="w-4 h-4 mr-1" />
                    Export to HAR
                  </Button>
                </div>
              )}
              {!selectedEnvironment && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Please select an environment before executing tests
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          </TabErrorBoundary>
        </TabsContent>

        {/* Security Tab - OWASP API Security Testing */}
        <TabsContent value="security" className="space-y-4">
          <Alert className="bg-red-500/10 border-red-500/30">
            <Shield className="h-4 w-4 text-red-500" />
            <AlertDescription>
              <strong className="text-red-600 dark:text-red-400">OWASP API Security Top 10 Scanner</strong> - 
              Automated security testing for broken authentication, authorization, injection, and more.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Security Config */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-red-500" />
                  Security Scan Config
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Target URL</Label>
                  <Input
                    value={securityTargetUrl}
                    onChange={(e) => setSecurityTargetUrl(e.target.value)}
                    placeholder="https://api.example.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Security Tests</Label>
                  <div className="space-y-2">
                    {[
                      { id: "auth_matrix", label: "Auth Matrix (401/403 checks)", desc: "Test no auth, wrong role, expired token" },
                      { id: "bola", label: "BOLA (API1:2023)", desc: "Broken Object Level Authorization" },
                      { id: "injection", label: "Injection Testing", desc: "SQL, NoSQL, Command injection" },
                      { id: "rate_limiting", label: "Rate Limiting (429)", desc: "Detect throttling detection" },
                      { id: "ssrf", label: "SSRF (API7:2023)", desc: "Server-Side Request Forgery" },
                      { id: "mass_assignment", label: "Mass Assignment", desc: "Extra properties accepted unexpectedly" },
                    ].map((test) => (
                      <div key={test.id} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                        <input
                          type="checkbox"
                          id={test.id}
                          checked={selectedSecurityTests.includes(test.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedSecurityTests([...selectedSecurityTests, test.id]);
                            } else {
                              setSelectedSecurityTests(selectedSecurityTests.filter(t => t !== test.id));
                            }
                          }}
                          className="mt-1"
                        />
                        <label htmlFor={test.id} className="text-sm cursor-pointer">
                          <div className="font-medium">{test.label}</div>
                          <div className="text-xs text-muted-foreground">{test.desc}</div>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button 
                  className="w-full bg-red-600 hover:bg-red-700"
                  disabled={securityScanning || !securityTargetUrl}
                  onClick={async () => {
                    setSecurityScanning(true);
                    setSecurityResults(null);
                    try {
                      const response = await fetch(`${API_BASE_URL}/api/v2/testing/security/scan`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          target_url: securityTargetUrl,
                          tests: selectedSecurityTests,
                          api_spec: parsedSpec
                        })
                      });
                      const data = await response.json();
                      setSecurityResults(data);
                      toast({
                        title: data.findings?.length > 0 ? "⚠️ Vulnerabilities Found" : "✅ Scan Complete",
                        description: `Found ${data.findings?.length || 0} security issues`,
                        variant: data.findings?.length > 0 ? "destructive" : "default"
                      });
                    } catch (error: any) {
                      toast({
                        title: "Scan Failed",
                        description: error.message,
                        variant: "destructive"
                      });
                    } finally {
                      setSecurityScanning(false);
                    }
                  }}
                >
                  {securityScanning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Run Security Scan
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Security Results */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5" />
                    Security Findings
                  </span>
                  {securityResults && (
                    <Badge variant={securityResults.findings?.length > 0 ? "destructive" : "default"}>
                      {securityResults.findings?.length || 0} Issues
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!securityResults ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Shield className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>Run a security scan to see findings</p>
                  </div>
                ) : securityResults.findings?.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-green-500" />
                    <p className="text-green-600 font-medium">No vulnerabilities detected!</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Scanned {securityResults.total_tests || 0} security tests
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[500px] overflow-y-auto">
                    {securityResults.findings?.map((finding: any, idx: number) => (
                      <div 
                        key={idx} 
                        className={`p-4 rounded-lg border ${
                          finding.severity === 'critical' ? 'border-red-500 bg-red-500/10' :
                          finding.severity === 'high' ? 'border-orange-500 bg-orange-500/10' :
                          finding.severity === 'medium' ? 'border-yellow-500 bg-yellow-500/10' :
                          'border-gray-500 bg-gray-500/10'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className={
                                finding.severity === 'critical' ? 'border-red-500 text-red-500' :
                                finding.severity === 'high' ? 'border-orange-500 text-orange-500' :
                                finding.severity === 'medium' ? 'border-yellow-500 text-yellow-500' :
                                'border-gray-500 text-gray-500'
                              }>
                                {finding.severity?.toUpperCase()}
                              </Badge>
                              <span className="font-medium">{finding.title}</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{finding.description}</p>
                            {finding.endpoint && (
                              <code className="text-xs bg-muted px-2 py-1 rounded mt-2 inline-block">
                                {finding.method} {finding.endpoint}
                              </code>
                            )}
                          </div>
                        </div>
                        {finding.remediation && (
                          <div className="mt-3 pt-3 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground">Remediation:</p>
                            <p className="text-sm">{finding.remediation}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* OWASP Categories Reference */}
          <Card>
            <CardHeader>
              <CardTitle>OWASP API Security Top 10 (2023)</CardTitle>
              <CardDescription>Security categories covered by our scanner</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                {[
                  { id: "API1", name: "BOLA", color: "red" },
                  { id: "API2", name: "Broken Auth", color: "red" },
                  { id: "API3", name: "Property Auth", color: "orange" },
                  { id: "API4", name: "Resource Limit", color: "yellow" },
                  { id: "API5", name: "Function Auth", color: "orange" },
                  { id: "API6", name: "Business Flow", color: "yellow" },
                  { id: "API7", name: "SSRF", color: "red" },
                  { id: "API8", name: "Misconfig", color: "orange" },
                  { id: "API9", name: "Inventory", color: "yellow" },
                  { id: "API10", name: "Unsafe APIs", color: "orange" },
                ].map((cat) => (
                  <div key={cat.id} className={`p-2 rounded text-center bg-${cat.color}-500/10 border border-${cat.color}-500/30`}>
                    <div className="font-bold">{cat.id}</div>
                    <div className="text-muted-foreground">{cat.name}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Environments Tab */}
        <TabsContent value="environments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Environment Management</CardTitle>
              <CardDescription>
                Create and manage test environments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Environment Name</Label>
                  <Input
                    value={envConfig.name}
                    onChange={(e) => setEnvConfig({...envConfig, name: e.target.value})}
                    placeholder="Production"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={envConfig.type} onValueChange={(v) => setEnvConfig({...envConfig, type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="development">Development</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="production">Production</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Base URL</Label>
                  <Input
                    value={envConfig.base_url}
                    onChange={(e) => setEnvConfig({...envConfig, base_url: e.target.value})}
                    placeholder="https://api.example.com"
                  />
                </div>
              </div>
              <Button onClick={handleCreateEnvironment} disabled={loading}>
                <Settings className="w-4 h-4 mr-2" />
                Create Environment
              </Button>
              
              {environments.length > 0 && (
                <div className="mt-4">
                  <Label>Environments</Label>
                  <div className="space-y-2 mt-2">
                    {environments.map((env, idx) => (
                      <Card key={idx} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold">{env.name}</p>
                            <p className="text-sm text-muted-foreground">{env.base_url}</p>
                          </div>
                          <Badge variant="outline">{env.type}</Badge>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Database Connectivity - moved from standalone tab */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5" />
                Database Connectivity
              </CardTitle>
              <CardDescription>
                Connect to databases for data-driven testing and assertions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Connection ID</Label>
                  <Input
                    value={dbConfig.connection_id}
                    onChange={(e) => setDbConfig({...dbConfig, connection_id: e.target.value})}
                    placeholder="db1"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Database Type</Label>
                  <Select value={dbConfig.db_type} onValueChange={(v) => setDbConfig({...dbConfig, db_type: v})}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="postgresql">PostgreSQL</SelectItem>
                      <SelectItem value="mysql">MySQL</SelectItem>
                      <SelectItem value="sqlite">SQLite</SelectItem>
                      <SelectItem value="mongodb">MongoDB</SelectItem>
                      <SelectItem value="mssql">MSSQL</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Host</Label>
                  <Input
                    value={dbConfig.host}
                    onChange={(e) => setDbConfig({...dbConfig, host: e.target.value})}
                    placeholder="localhost"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Port</Label>
                  <Input
                    type="number"
                    value={dbConfig.port}
                    onChange={(e) => setDbConfig({...dbConfig, port: parseInt(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Database</Label>
                  <Input
                    value={dbConfig.database}
                    onChange={(e) => setDbConfig({...dbConfig, database: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>User</Label>
                  <Input
                    value={dbConfig.user}
                    onChange={(e) => setDbConfig({...dbConfig, user: e.target.value})}
                  />
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Password</Label>
                  <Input
                    type="password"
                    value={dbConfig.password}
                    onChange={(e) => setDbConfig({...dbConfig, password: e.target.value})}
                  />
                </div>
              </div>
              <Button onClick={handleConnectDatabase} disabled={loading}>
                <Database className="w-4 h-4 mr-2" />
                {loading ? "Connecting..." : "Connect"}
              </Button>
              
              {dbConnections.length > 0 && (
                <div className="mt-4">
                  <Label>Active Connections</Label>
                  <div className="space-y-2 mt-2">
                    {dbConnections.map((conn, idx) => (
                      <Badge key={idx} variant="outline" className="mr-2">
                        {conn.connection_id} ({conn.type})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mock Services Tab (renamed from Virtual) */}
        <TabsContent value="mock" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Create Virtual Service</CardTitle>
              <CardDescription>
                Create mock API endpoints for testing when real services are unavailable
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Service Name</Label>
                  <Input
                    value={newVirtualService.name}
                    onChange={(e) => setNewVirtualService({...newVirtualService, name: e.target.value})}
                    placeholder="My Mock Service"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={newVirtualService.base_url}
                    onChange={(e) => setNewVirtualService({...newVirtualService, base_url: e.target.value})}
                    placeholder="http://localhost:9000"
                  />
                </div>
              </div>
              <Button onClick={createVirtualService} disabled={loading}>
                <Plus className="w-4 h-4 mr-2" />
                Create Virtual Service
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Virtual Services</CardTitle>
              <CardDescription>
                Manage your mock API services
              </CardDescription>
            </CardHeader>
            <CardContent>
              {virtualServices.length > 0 ? (
                <div className="space-y-3">
                  {virtualServices.map((service: any, idx: number) => (
                    <Card key={idx} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{service.name}</p>
                          <p className="text-sm text-muted-foreground">{service.base_url}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{service.endpoints_count || 0} endpoints</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteVirtualService(service.service_id || service.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Server className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No virtual services created yet</p>
                  <p className="text-sm text-muted-foreground mt-2">Create one above to mock API responses</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-4">
          <TabErrorBoundary tabName="Results">
          {executionResults && (
            <>
              {/* Export Buttons */}
              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  <Button 
                    variant={reportViewTab === "summary" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("summary")}
                  >
                    📊 Summary
                  </Button>
                  <Button 
                    variant={reportViewTab === "html" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("html")}
                  >
                    🌐 HTML Report
                  </Button>
                  <Button 
                    variant={reportViewTab === "junit" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("junit")}
                  >
                    📋 JUnit XML
                  </Button>
                  <Button 
                    variant={reportViewTab === "json" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("json")}
                  >
                    📦 JSON
                  </Button>
                  <Button 
                    variant={reportViewTab === "allure" ? "default" : "outline"} 
                    size="sm" 
                    onClick={() => setReportViewTab("allure")}
                    className="border-orange-500/30 data-[state=active]:bg-orange-500/20"
                  >
                    🔶 Allure
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={exportAsJUnitXML} title="Download JUnit XML">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsHTML} title="Download HTML">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsJSON} title="Download JSON">
                    <Download className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={exportAsAllure} title="Download Allure">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Summary View */}
              {reportViewTab === "summary" && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Execution Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-4 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Total</p>
                          <p className="text-2xl font-bold">{executionResults.summary?.total || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Passed</p>
                          <p className="text-2xl font-bold text-green-600">{executionResults.summary?.passed || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Failed</p>
                          <p className="text-2xl font-bold text-red-600">{executionResults.summary?.failed || 0}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pass Rate</p>
                          <p className="text-2xl font-bold">{executionResults.summary?.pass_rate?.toFixed(1) || 0}%</p>
                        </div>
                      </div>
                      
                      {executionResults.performance_metrics && (
                        <div className="mt-4 space-y-2">
                          <Label>Performance Metrics</Label>
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Avg Response Time</p>
                              <p className="font-semibold">{executionResults.performance_metrics.avg_response_time_ms?.toFixed(2)}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">P95 Response Time</p>
                              <p className="font-semibold">{executionResults.performance_metrics.p95_response_time_ms?.toFixed(2)}ms</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Requests/sec</p>
                              <p className="font-semibold">{executionResults.performance_metrics.requests_per_second?.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Test Results</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[400px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Test Case</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Response Time</TableHead>
                              <TableHead>Status Code</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {executionResults.test_results && executionResults.test_results.length > 0 ? (
                              executionResults.test_results.slice(0, 100).map((result: any, idx: number) => (
                                <TableRow key={idx}>
                                  <TableCell className="font-medium">
                                    {result.title || result.name || result.test_name || result.test_case_name || `Test ${idx + 1}`}
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={result.status === "passed" ? "default" : "destructive"}>
                                      {result.status || "unknown"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>{result.response_time_ms?.toFixed(2) || "N/A"}ms</TableCell>
                                  <TableCell>{result.actual_status || result.status_code || "N/A"}</TableCell>
                                </TableRow>
                              ))
                            ) : (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                  No test results available. Tests may not have executed successfully.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </>
              )}

              {/* HTML Report View */}
              {reportViewTab === "html" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🌐 HTML Report Preview
                      <Button variant="outline" size="sm" onClick={exportAsHTML}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden bg-white">
                      <iframe 
                        srcDoc={generateHTMLContent()} 
                        className="w-full h-[500px] border-0"
                        title="HTML Report Preview"
                      />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* JUnit XML View */}
              {reportViewTab === "junit" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📋 JUnit XML Report
                      <Button variant="outline" size="sm" onClick={exportAsJUnitXML}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>Compatible with CI/CD tools like Jenkins, GitHub Actions, Azure DevOps</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <pre className="text-xs bg-muted p-4 rounded-lg font-mono overflow-x-auto">
                        {generateJUnitXMLContent()}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* JSON View */}
              {reportViewTab === "json" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      📦 JSON Results
                      <Button variant="outline" size="sm" onClick={exportAsJSON}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>Raw test execution data for custom processing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-[500px]">
                      <pre className="text-xs bg-muted p-4 rounded-lg font-mono overflow-x-auto">
                        {JSON.stringify(executionResults, null, 2)}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}

              {/* Allure View */}
              {reportViewTab === "allure" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      🔶 Allure Report Data
                      <Button variant="outline" size="sm" onClick={exportAsAllure}>
                        <Download className="w-4 h-4 mr-2" /> Download
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Download and run <code className="bg-muted px-1 rounded">allure generate allure-results-*.json</code> to view the full Allure report
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className="mb-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Allure reports require the Allure CLI to generate. Install with: <code className="bg-muted px-1 rounded">npm install -g allure-commandline</code>
                      </AlertDescription>
                    </Alert>
                    <ScrollArea className="h-[400px]">
                      <pre className="text-xs bg-muted p-4 rounded-lg font-mono overflow-x-auto">
                        {generateAllureContent()}
                      </pre>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )}
            </>
          )}
          
          {testSuite && !executionResults && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Test suite generated. Go to Execute tab to run tests.
              </AlertDescription>
            </Alert>
          )}
          {!testSuite && !executionResults && (
            <Card className="border-dashed border-2 border-muted-foreground/25">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <BarChart3 className="w-16 h-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-xl font-semibold text-muted-foreground mb-2">No Results Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mb-6">
                  Run API tests to see execution results, pass/fail rates, response times, and detailed reports here.
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setActiveTab("execute")}>
                    <Play className="w-4 h-4 mr-2" />
                    Go to Execute
                  </Button>
                  <Button variant="outline" onClick={() => setActiveTab("builder")}>
                    <Zap className="w-4 h-4 mr-2" />
                    Build a Request
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
          </TabErrorBoundary>
        </TabsContent>
      </Tabs>

      {/* Test Case Detail Dialog */}
      <Dialog open={!!viewingTestCase} onOpenChange={(open) => !open && setViewingTestCase(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
            <DialogTitle className="text-2xl">
              {viewingTestCase?.name || viewingTestCase?.test_name || viewingTestCase?.title || "Test Case Details"}
            </DialogTitle>
            <DialogDescription>
              {viewingTestCase?.description || "View request, response, and assertion details"}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="json">JSON View</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details" className="space-y-6 mt-4">
                {/* Test Case Info */}
                {viewingTestCase && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-semibold">Test Type</Label>
                    <Badge variant="outline" className="mt-1">
                      {viewingTestCase.test_type || viewingTestCase.category || "functional"}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Priority</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {viewingTestCase.priority || "medium"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Expected Status</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {viewingTestCase.expected_status || viewingTestCase.expectedStatusCode || 200}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-semibold">Method</Label>
                    <p className="text-sm font-mono text-muted-foreground mt-1">
                      {viewingTestCase.method || "GET"}
                    </p>
                  </div>
                </div>

                {/* Endpoint */}
                <div>
                  <Label className="text-sm font-semibold">Endpoint</Label>
                  <div className="mt-1 p-3 bg-muted rounded-md">
                    <code className="text-sm break-all">
                      {viewingTestCase.method || "GET"} {viewingTestCase.endpoint || viewingTestCase.url || viewingTestCase.path || 
                       (viewingTestCase.request?.url) || (viewingTestCase.steps?.[0]?.url) || "N/A"}
                    </code>
                  </div>
                </div>

                {/* Request Headers */}
                {(viewingTestCase.request?.headers || viewingTestCase.headers) && (
                  <div>
                    <Label className="text-sm font-semibold">Request Headers</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(viewingTestCase.request?.headers || viewingTestCase.headers || {}, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Request Body */}
                {(viewingTestCase.request?.body || viewingTestCase.body || viewingTestCase.request_body || viewingTestCase.request_payload) && (
                  <div>
                    <Label className="text-sm font-semibold">Request Body</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.request?.body || 
                          viewingTestCase.body || 
                          viewingTestCase.request_body || 
                          viewingTestCase.request_payload || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Query Parameters */}
                {(viewingTestCase.request?.query || viewingTestCase.query || viewingTestCase.query_params) && (
                  <div>
                    <Label className="text-sm font-semibold">Query Parameters</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.request?.query || 
                          viewingTestCase.query || 
                          viewingTestCase.query_params || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Assertions */}
                {viewingTestCase.assertions && viewingTestCase.assertions.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Assertions</Label>
                    <div className="mt-1 space-y-2">
                      {viewingTestCase.assertions.map((assertion: string, idx: number) => (
                        <div key={idx} className="p-2 bg-muted rounded-md text-sm">
                          <CheckCircle2 className="w-4 h-4 inline mr-2 text-green-600" />
                          {assertion}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Expected Response */}
                {(viewingTestCase.expected_response || viewingTestCase.expected_response_schema) && (
                  <div>
                    <Label className="text-sm font-semibold">Expected Response Schema</Label>
                    <div className="mt-1 p-3 bg-muted rounded-md overflow-x-auto">
                      <pre className="text-xs">
                        {JSON.stringify(
                          viewingTestCase.expected_response || 
                          viewingTestCase.expected_response_schema || 
                          {}, 
                          null, 
                          2
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                {/* Tags */}
                {viewingTestCase.tags && viewingTestCase.tags.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold">Tags</Label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {viewingTestCase.tags.map((tag: string, idx: number) => (
                        <Badge key={idx} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* OWASP Mapping */}
                {viewingTestCase.owasp_mapping && (
                  <div>
                    <Label className="text-sm font-semibold">OWASP API Security Mapping</Label>
                    <div className="mt-1 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                      <p className="text-sm">{viewingTestCase.owasp_mapping}</p>
                    </div>
                  </div>
                )}
              </>
            )}
              </TabsContent>
              
              <TabsContent value="json" className="mt-4">
                {viewingTestCase && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-semibold">Complete Test Case JSON</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (viewingTestCase) {
                            navigator.clipboard.writeText(JSON.stringify(viewingTestCase, null, 2));
                            toast({
                              title: "Copied",
                              description: "Test case JSON copied to clipboard",
                            });
                          }
                        }}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy JSON
                      </Button>
                    </div>
                    <div className="border rounded-md bg-muted p-4 overflow-auto max-h-[60vh]">
                      <pre className="text-xs">
                        <code>{JSON.stringify(viewingTestCase, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
          <DialogFooter className="px-6 py-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={() => setViewingTestCase(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}


