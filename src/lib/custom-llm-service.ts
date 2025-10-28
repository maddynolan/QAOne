// Custom LLM Service for QA AI Platform
// This integrates with your custom LLM infrastructure
// Falls back to mock service in development mode

export interface CustomLLMConfig {
  modelEndpoint: string;
  apiKey: string;
  modelName: string;
  temperature: number;
  maxTokens: number;
}

export interface TestGenerationRequest {
  feature: string;
  description: string;
  requirements?: string;
  testType: 'api' | 'ui' | 'e2e' | 'performance';
  complexity: 'simple' | 'medium' | 'complex';
  context?: string;
}

export interface TestGenerationResponse {
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

export interface TestPlanRequest {
  projectDescription: string;
  features: string[];
  testTypes: string[];
  coverage: 'basic' | 'comprehensive' | 'exhaustive';
  timeline?: string;
  resources?: string[];
}

export interface TestPlanResponse {
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

class CustomLLMService {
  private config: CustomLLMConfig;

  constructor(config: CustomLLMConfig) {
    this.config = config;
  }

  async generateTestCase(request: TestGenerationRequest): Promise<TestGenerationResponse> {
    const prompt = this.buildTestCasePrompt(request);
    
    try {
      const response = await this.callLLM(prompt);
      return this.parseTestCaseResponse(response);
    } catch (error) {
      console.error('Error generating test case:', error);
      throw new Error('Failed to generate test case with custom LLM');
    }
  }

  async analyzeDefect(request: DefectAnalysisRequest): Promise<DefectAnalysisResponse> {
    const prompt = this.buildDefectAnalysisPrompt(request);
    
    try {
      const response = await this.callLLM(prompt);
      return this.parseDefectAnalysisResponse(response);
    } catch (error) {
      console.error('Error analyzing defect:', error);
      throw new Error('Failed to analyze defect with custom LLM');
    }
  }

  async generateTestPlan(request: TestPlanRequest): Promise<TestPlanResponse> {
    const prompt = this.buildTestPlanPrompt(request);
    
    try {
      const response = await this.callLLM(prompt);
      return this.parseTestPlanResponse(response);
    } catch (error) {
      console.error('Error generating test plan:', error);
      throw new Error('Failed to generate test plan with custom LLM');
    }
  }

  async optimizeTestSuite(testResults: any[]): Promise<string[]> {
    const prompt = this.buildOptimizationPrompt(testResults);
    
    try {
      const response = await this.callLLM(prompt);
      return this.parseOptimizationResponse(response);
    } catch (error) {
      console.error('Error optimizing test suite:', error);
      throw new Error('Failed to optimize test suite with custom LLM');
    }
  }

  private async callLLM(prompt: string): Promise<string> {
    const response = await fetch(this.config.modelEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.modelName,
        messages: [
          {
            role: 'system',
            content: 'You are an expert QA engineer with deep knowledge of testing methodologies, automation frameworks, and quality assurance best practices.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  private buildTestCasePrompt(request: TestGenerationRequest): string {
    return `
Generate a comprehensive test case for the following feature:

**Feature**: ${request.feature}
**Description**: ${request.description}
**Requirements**: ${request.requirements || 'Not specified'}
**Test Type**: ${request.testType}
**Complexity**: ${request.complexity}
**Context**: ${request.context || 'Not specified'}

Please provide a detailed test case including:
1. Clear test case name and description
2. Step-by-step test execution steps with expected results
3. Preconditions and test data requirements
4. Priority level based on risk assessment
5. Relevant tags for categorization
6. Estimated execution time
7. Optional automation script suggestions
8. Additional suggestions for edge cases

Respond in JSON format with this exact structure:
{
  "testCase": {
    "name": "string",
    "description": "string",
    "steps": [{"action": "string", "expectedResult": "string"}],
    "preconditions": ["string"],
    "testData": ["string"],
    "priority": "low|medium|high|critical",
    "tags": ["string"],
    "automationScript": "string (optional)"
  },
  "suggestions": ["string"],
  "estimatedTime": number,
  "confidence": number
}
`;
  }

  private buildDefectAnalysisPrompt(request: DefectAnalysisRequest): string {
    return `
Analyze the following test failure and provide comprehensive defect analysis:

**Error Message**: ${request.errorMessage}
**Test Context**: ${request.testContext}
**Stack Trace**: ${request.stackTrace || 'Not available'}
**Environment**: ${request.environment}
**Test Type**: ${request.testType}

Please provide:
1. Severity assessment (low/medium/high/critical)
2. Priority recommendation (low/medium/high/critical)
3. Category classification
4. Root cause analysis
5. Suggested fix or investigation steps
6. Similar known issues
7. Confidence level (0-100)
8. Step-by-step investigation plan

Respond in JSON format:
{
  "severity": "low|medium|high|critical",
  "priority": "low|medium|high|critical",
  "category": "string",
  "rootCause": "string",
  "suggestedFix": "string",
  "similarIssues": ["string"],
  "confidence": number,
  "investigationSteps": ["string"]
}
`;
  }

  private buildTestPlanPrompt(request: TestPlanRequest): string {
    return `
Create a comprehensive test plan for the following project:

**Project**: ${request.projectDescription}
**Features**: ${request.features.join(', ')}
**Test Types**: ${request.testTypes.join(', ')}
**Coverage Level**: ${request.coverage}
**Timeline**: ${request.timeline || 'Not specified'}
**Resources**: ${request.resources?.join(', ') || 'Not specified'}

Please provide:
1. Test plan name and description
2. List of test cases with priorities, types, and time estimates
3. Estimated total duration
4. Coverage assessment
5. Risk assessment
6. Recommendations for test strategy
7. Resource requirements

Respond in JSON format:
{
  "testPlan": {
    "name": "string",
    "description": "string",
    "testCases": [{"name": "string", "description": "string", "priority": "string", "type": "string", "estimatedTime": number}],
    "estimatedDuration": number,
    "coverage": "string",
    "riskAssessment": "string"
  },
  "recommendations": ["string"],
  "resourceRequirements": ["string"]
}
`;
  }

  private buildOptimizationPrompt(testResults: any[]): string {
    return `
Analyze these test results and provide optimization recommendations:

**Test Results**: ${JSON.stringify(testResults, null, 2)}

Please provide actionable suggestions for:
1. Performance optimization
2. Test coverage improvements
3. Flaky test identification and fixes
4. Resource optimization
5. Test maintenance best practices
6. Automation opportunities
7. Risk mitigation strategies

Respond as an array of specific, actionable recommendations.
`;
  }

  private parseTestCaseResponse(response: string): TestGenerationResponse {
    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error('Failed to parse test case response from LLM');
    }
  }

  private parseDefectAnalysisResponse(response: string): DefectAnalysisResponse {
    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error('Failed to parse defect analysis response from LLM');
    }
  }

  private parseTestPlanResponse(response: string): TestPlanResponse {
    try {
      return JSON.parse(response);
    } catch (error) {
      throw new Error('Failed to parse test plan response from LLM');
    }
  }

  private parseOptimizationResponse(response: string): string[] {
    try {
      return JSON.parse(response);
    } catch (error) {
      // Fallback to splitting by lines if JSON parsing fails
      return response.split('\n').filter(line => line.trim().length > 0);
    }
  }
}

// Import mock service for development
import { mockAIService, aiService as mockAIServiceInstance } from './mock-ai-service';

// Default configuration - should be moved to environment variables
const defaultConfig: CustomLLMConfig = {
  modelEndpoint: import.meta.env.VITE_LLM_ENDPOINT || 'http://localhost:8000/api/v1/llm/generate',
  apiKey: import.meta.env.VITE_LLM_API_KEY || '',
  modelName: import.meta.env.VITE_LLM_MODEL || 'qa-ai-model',
  temperature: 0.7,
  maxTokens: 2000,
};

// Development mode detection
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
const useMockService = isDevelopment && (!defaultConfig.apiKey || defaultConfig.apiKey === '');

// Export the appropriate service based on environment
export const customLLMService = useMockService ? mockAIServiceInstance : new CustomLLMService(defaultConfig);

// Export both services for manual switching if needed
export { mockAIService };
