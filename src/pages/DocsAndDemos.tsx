import { Play, BookOpen, Video, Code, Zap, Users, BarChart3, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function DocsAndDemos() {
  const [activeTab, setActiveTab] = useState('overview');
  const navigate = useNavigate();

  const demoSections = [
    {
      id: 'ai-generation',
      title: 'AI Test Generation',
      description: 'See how AI generates comprehensive test cases from requirements',
      icon: <Zap className="h-6 w-6" />,
      features: [
        'Natural language requirements input',
        'Automated test case generation',
        'Multiple test types support',
        'Context-aware generation'
      ],
      action: () => {
        navigate('/cases/create');
        toast.success("Try AI test generation in the Create Test Case page!");
      }
    },
    {
      id: 'test-execution',
      title: 'Test Execution',
      description: 'Experience automated test execution with Playwright',
      icon: <Play className="h-6 w-6" />,
      features: [
        'Playwright automation',
        'Real-time execution monitoring',
        'Screenshot capture',
        'Detailed execution logs'
      ],
      action: () => {
        navigate('/runs');
        toast.success("Create a test run to see automated execution!");
      }
    },
    {
      id: 'analytics',
      title: 'Analytics Dashboard',
      description: 'Explore comprehensive test analytics and reporting',
      icon: <BarChart3 className="h-6 w-6" />,
      features: [
        'Success rate tracking',
        'Trend analysis',
        'Performance metrics',
        'Custom dashboards'
      ],
      action: () => {
        navigate('/analytics');
        toast.success("Check out the analytics dashboard!");
      }
    },
    {
      id: 'self-healing',
      title: 'Self-Healing Tests',
      description: 'Discover automated test failure recovery',
      icon: <Shield className="h-6 w-6" />,
      features: [
        'Automatic selector updates',
        'Wait time optimization',
        'Retry mechanisms',
        'Failure pattern detection'
      ],
      action: () => {
        navigate('/self-healing');
        toast.success("Explore self-healing capabilities!");
      }
    }
  ];

  const quickStartSteps = [
    {
      step: 1,
      title: 'Create Test Cases',
      description: 'Generate test cases using AI or create them manually',
      action: 'Go to Test Cases',
      route: '/cases'
    },
    {
      step: 2,
      title: 'Run Tests',
      description: 'Execute your test suite and monitor results',
      action: 'Go to Test Runs',
      route: '/runs'
    },
    {
      step: 3,
      title: 'Analyze Results',
      description: 'Review test results and analytics',
      action: 'Go to Analytics',
      route: '/analytics'
    },
    {
      step: 4,
      title: 'Configure Integrations',
      description: 'Set up Jira integration and CI/CD pipelines',
      action: 'Go to Settings',
      route: '/settings'
    }
  ];

  const apiExamples = [
    {
      title: 'Generate Test Cases',
      description: 'Use AI to generate test cases from requirements',
      code: `// Generate test cases with AI
const testCases = await customLLMService.generateTestCase({
  feature: "User Login",
  description: "Users should be able to log in with email and password",
  testType: "functional",
  complexity: "medium"
});

console.log('Generated test cases:', testCases);`
    },
    {
      title: 'Run Test Execution',
      description: 'Execute tests using Playwright runner',
      code: `// Execute tests via API
const response = await fetch('/api/tests/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    org_id: 'your-org-id',
    project_id: 'your-project-id',
    test_cases: [{
      id: "test_001",
      title: "User Login Test",
      steps: [
        { action: "Navigate to login page", expected: "Login page loads" },
        { action: "Enter credentials", expected: "Credentials entered" },
        { action: "Click login button", expected: "User logged in" }
      ]
    }]
  })
});

const result = await response.json();
console.log('Test execution result:', result);`
    },
    {
      title: 'Analyze Test Failure',
      description: 'Use AI to analyze test failures and get recommendations',
      code: `// Analyze test failure
const analysis = await customLLMService.analyzeDefect({
  errorMessage: "Element not found: #login-button",
  testContext: "Login Flow",
  environment: "Production",
  testType: "UI Test"
});

console.log('Failure analysis:', analysis);`
    }
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold gradient-text">Documentation & Demos</h1>
        <p className="text-muted-foreground mt-1">Learn how to use QAOne platform effectively</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="demos">Interactive Demos</TabsTrigger>
          <TabsTrigger value="quickstart">Quick Start</TabsTrigger>
          <TabsTrigger value="api">API Examples</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Platform Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  QAOne is an AI-powered QA platform that provides comprehensive test automation, 
                  AI-driven test generation, and intelligent failure analysis.
                </p>
                <div className="space-y-2">
                  <h4 className="font-semibold">Key Features:</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>AI-powered test case generation</li>
                    <li>Automated test execution with Playwright</li>
                    <li>Intelligent failure analysis and triage</li>
                    <li>Self-healing test capabilities</li>
                    <li>Comprehensive analytics and reporting</li>
                    <li>Jira integration for defect management</li>
                    <li>CI/CD pipeline integration</li>
                    <li>Security and secrets management</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Target Users
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold">QA Engineers</h4>
                    <p className="text-sm text-muted-foreground">
                      Automate test creation and execution, reduce manual effort
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Developers</h4>
                    <p className="text-sm text-muted-foreground">
                      Integrate testing into development workflow
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">DevOps Engineers</h4>
                    <p className="text-sm text-muted-foreground">
                      Set up CI/CD pipelines with quality gates
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold">Product Managers</h4>
                    <p className="text-sm text-muted-foreground">
                      Monitor quality metrics and test coverage
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Getting Started Video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Demo Video Coming Soon</h3>
                  <p className="text-muted-foreground">
                    Watch our comprehensive demo video to see QAOne in action
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Interactive Demos */}
        <TabsContent value="demos" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {demoSections.map((demo) => (
              <Card key={demo.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {demo.icon}
                    {demo.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{demo.description}</p>
                  
                  <div className="space-y-2">
                    <h4 className="font-semibold">Features:</h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      {demo.features.map((feature, index) => (
                        <li key={index}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <Button onClick={demo.action} className="w-full">
                    <Play className="h-4 w-4 mr-2" />
                    Try Demo
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Quick Start */}
        <TabsContent value="quickstart" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Start Guide
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {quickStartSteps.map((step) => (
                  <div key={step.step} className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center font-semibold">
                      {step.step}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold">{step.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2"
                        onClick={() => navigate(step.route)}
                      >
                        {step.action}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* API Examples */}
        <TabsContent value="api" className="space-y-6">
          <div className="space-y-6">
            {apiExamples.map((example, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    {example.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground">{example.description}</p>
                  
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm overflow-x-auto">
                      <code>{example.code}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Resources */}
        <TabsContent value="resources" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Getting Started</h4>
                  <p className="text-sm text-muted-foreground">
                    Learn the basics of QAOne platform
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">API Reference</h4>
                  <p className="text-sm text-muted-foreground">
                    Complete API documentation and examples
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Best Practices</h4>
                  <p className="text-sm text-muted-foreground">
                    Guidelines for effective test automation
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Troubleshooting</h4>
                  <p className="text-sm text-muted-foreground">
                    Common issues and solutions
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Community & Support
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Community Forum</h4>
                  <p className="text-sm text-muted-foreground">
                    Connect with other users and get help
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Support Tickets</h4>
                  <p className="text-sm text-muted-foreground">
                    Submit issues and get technical support
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Training Sessions</h4>
                  <p className="text-sm text-muted-foreground">
                    Attend live training and webinars
                  </p>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Status Page</h4>
                  <p className="text-sm text-muted-foreground">
                    Check platform status and uptime
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-2">Security Features</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>End-to-end encryption</li>
                    <li>Role-based access control</li>
                    <li>Secrets management</li>
                    <li>Audit logging</li>
                    <li>Vulnerability scanning</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Compliance</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    <li>SOC 2 Type II</li>
                    <li>GDPR compliant</li>
                    <li>ISO 27001</li>
                    <li>HIPAA ready</li>
                    <li>Regular security audits</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
