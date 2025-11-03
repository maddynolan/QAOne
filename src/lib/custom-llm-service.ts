// Custom LLM Service for QA AI Platform
// This integrates with the QAOne backend API

export interface TestCaseGenerationRequest {
  feature: string;
  description: string;
  requirements?: string;
  testType: 'api' | 'ui' | 'e2e' | 'performance' | 'manual';
  complexity: 'simple' | 'medium' | 'complex';
  context?: string;
}

export interface TestCaseGenerationResponse {
  testCase: {
    name: string;
    description: string;
    steps: Array<{
      action: string;
      expectedResult: string;
    }>;
    preconditions: string[];
    testData: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
    tags: string[];
    automationScript?: string;
  };
  suggestions: string[];
  estimatedTime: number;
  confidence: number;
}

export interface DefectAnalysisRequest {
  errorMessage: string;
  testContext: string;
  stackTrace?: string;
  environment: string;
  testType: string;
}

export interface DefectAnalysisResponse {
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  rootCause: string;
  suggestedFix: string;
  similarIssues: string[];
  confidence: number;
  investigationSteps: string[];
}

export interface TestPlanGenerationRequest {
  projectDescription: string;
  features: string[];
  testTypes: string[];
  coverage: 'basic' | 'comprehensive' | 'exhaustive';
  timeline?: string;
  resources?: string[];
}

export interface TestPlanGenerationResponse {
  testPlan: {
    name: string;
    description: string;
    testCases: Array<{
      name: string;
      description: string;
      priority: string;
      type: string;
      estimatedTime: number;
    }>;
    estimatedDuration: number;
    coverage: string;
    riskAssessment: string;
  };
  recommendations: string[];
  resourceRequirements: string[];
}

export interface OptimizationSuggestionRequest {
  testResults: any[];
  performanceMetrics?: any;
  coverageData?: any;
}

export interface OptimizationSuggestionResponse {
  suggestions: string[];
  impactEstimate: 'low' | 'medium' | 'high';
  priority: 'low' | 'medium' | 'high';
}

class CustomLLMService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string = 'http://localhost:8001') {
    this.apiBaseUrl = apiBaseUrl;
  }

  async generateTestCase(request: TestCaseGenerationRequest): Promise<TestCaseGenerationResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/ai/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: JSON.stringify({
          org_id: 'demo-org', // TODO: Get from auth context
          project_id: 'demo-project', // TODO: Get from auth context
          requirements: request.description,
          test_type: request.testType === 'ui' || request.testType === 'e2e' || request.testType === 'automated' ? 'automated' : request.testType === 'api' ? 'api' : 'manual',
          context: {
            product_area: request.feature,
            acceptance_criteria: request.requirements ? [request.requirements] : [],
            app_url: request.context || 'https://www.saucedemo.com',
            prior_flaky_cases: [],
            style: 'imperative',
            test_count_hint: 1
          }
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Convert API response to our expected format
      const testCase = data.cases[0];
      return {
        testCase: {
          name: testCase.title,
          description: testCase.description,
          steps: testCase.steps.map((step: any) => ({
            action: step.action,
            expectedResult: step.expected
          })),
          preconditions: ['User is logged in and has necessary permissions'],
          testData: ['Test data will be provided during execution'],
          priority: mapPriorityFromAPI(testCase.priority),
          tags: testCase.tags,
          automationScript: data.generated_code || undefined  // Include generated code for review
        },
        generatedCode: data.generated_code || undefined,
        manualSteps: data.manual_steps || undefined,
        codeLanguage: data.code_language || 'typescript',
        suggestedWebsites: data.suggested_websites || [],
        suggestions: [
          'Consider edge cases for input validation',
          'Add performance checks for this flow',
          'Explore security vulnerabilities'
        ],
        estimatedTime: 15,
        confidence: 85
      };
    } catch (error) {
      console.error('Error generating test case:', error);
      throw new Error('Failed to generate test case with AI service');
    }
  }

  async analyzeDefect(request: DefectAnalysisRequest): Promise<DefectAnalysisResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/ai/triage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          org_id: 'demo-org', // TODO: Get from auth context
          project_id: 'demo-project', // TODO: Get from auth context
          run_id: crypto.randomUUID(),
          logs: `${request.errorMessage}\n\nContext: ${request.testContext}\nEnvironment: ${request.environment}\nTest Type: ${request.testType}`,
          artifacts: []
        }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        severity: mapSeverityFromCategory(data.category),
        priority: mapPriorityFromLikelihood(data.likelihood_flaky),
        category: data.category || 'unknown',
        rootCause: data.root_cause,
        suggestedFix: data.suggested_fixes?.[0] || 'Investigate further',
        similarIssues: data.related_cases || [],
        confidence: Math.round(data.confidence || 80),
        investigationSteps: data.suggested_fixes || ['Review logs and application state']
      };
    } catch (error) {
      console.error('Error analyzing defect:', error);
      throw new Error('Failed to analyze defect with AI service');
    }
  }

  async generateTestPlan(request: TestPlanGenerationRequest): Promise<TestPlanGenerationResponse> {
    // For now, return a mock response since we don't have a dedicated endpoint
    return {
      testPlan: {
        name: `Test Plan for ${request.projectDescription}`,
        description: `Comprehensive test plan covering ${request.features.join(', ')}`,
        testCases: request.features.map(feature => ({
          name: `Test ${feature}`,
          description: `Verify ${feature} functionality`,
          priority: 'medium',
          type: 'functional',
          estimatedTime: 30
        })),
        estimatedDuration: request.features.length * 30,
        coverage: request.coverage,
        riskAssessment: 'Medium risk - standard testing approach recommended'
      },
      recommendations: [
        'Implement automated regression testing',
        'Add performance testing for critical paths',
        'Include security testing for user-facing features'
      ],
      resourceRequirements: [
        'QA Engineer',
        'Test Environment',
        'Test Data Management'
      ]
    };
  }

  async getOptimizationSuggestions(request: OptimizationSuggestionRequest): Promise<OptimizationSuggestionResponse> {
    return {
      suggestions: [
        'Optimize database queries for frequently accessed data',
        'Implement client-side caching for static assets',
        'Reduce bundle size by lazy-loading components',
        'Review API response times and add indexing to relevant database tables'
      ],
      impactEstimate: 'high',
      priority: 'high'
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async searchSimilarTestCases(query: string): Promise<string[]> {
    // Mock implementation - would integrate with search service
    return [
      `Similar to "${query}" - Test Case A`,
      `Similar to "${query}" - Test Case B`,
      `Similar to "${query}" - Test Case C`,
    ];
  }
}

// Helper functions
function mapPriorityFromAPI(priority: string): 'low' | 'medium' | 'high' | 'critical' {
  const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    'P0': 'critical',
    'P1': 'high',
    'P2': 'medium',
    'P3': 'low'
  };
  return priorityMap[priority] || 'medium';
}

function mapSeverityFromCategory(category: string): 'low' | 'medium' | 'high' | 'critical' {
  const severityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
    'locator': 'medium',
    'timing': 'medium',
    'network': 'high',
    'data': 'high',
    'enviro': 'low'
  };
  return severityMap[category] || 'medium';
}

function mapPriorityFromLikelihood(likelihood: number): 'low' | 'medium' | 'high' | 'critical' {
  if (likelihood >= 0.8) return 'critical';
  if (likelihood >= 0.6) return 'high';
  if (likelihood >= 0.4) return 'medium';
  return 'low';
}

// Import mock service for development (not used currently)
import { mockAIService } from './mock-ai-service';

// Get API base URL from environment or use default
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

// Use real backend API
export const customLLMService = new CustomLLMService(apiBaseUrl);

// Export both services for manual switching if needed
export { mockAIService };
