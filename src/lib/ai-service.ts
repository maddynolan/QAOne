// AI Service for OpenAI integration
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
});

export interface AITestCaseRequest {
  feature: string;
  description: string;
  requirements?: string;
  testType: 'api' | 'ui' | 'e2e' | 'performance';
  complexity: 'simple' | 'medium' | 'complex';
}

export interface AITestCaseResponse {
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
  };
  suggestions: string[];
  estimatedTime: number;
}

export interface AIDefectAnalysis {
  severity: 'low' | 'medium' | 'high' | 'critical';
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  rootCause: string;
  suggestedFix: string;
  similarIssues: string[];
  confidence: number;
}

export interface AITestPlanRequest {
  projectDescription: string;
  features: string[];
  testTypes: string[];
  coverage: 'basic' | 'comprehensive' | 'exhaustive';
}

export interface AITestPlanResponse {
  testPlan: {
    name: string;
    description: string;
    testCases: Array<{
      name: string;
      description: string;
      priority: string;
      type: string;
    }>;
    estimatedDuration: number;
    coverage: string;
  };
  recommendations: string[];
}

class AIService {
  async generateTestCase(request: AITestCaseRequest): Promise<AITestCaseResponse> {
    const prompt = `
You are an expert QA engineer. Generate a comprehensive test case for the following feature:

Feature: ${request.feature}
Description: ${request.description}
Requirements: ${request.requirements || 'Not specified'}
Test Type: ${request.testType}
Complexity: ${request.complexity}

Please provide:
1. A detailed test case with clear steps and expected results
2. Preconditions and test data requirements
3. Priority level based on risk assessment
4. Relevant tags for categorization
5. Time estimation
6. Additional suggestions for edge cases

Respond in JSON format with the structure:
{
  "testCase": {
    "name": "string",
    "description": "string", 
    "steps": [{"action": "string", "expectedResult": "string"}],
    "preconditions": ["string"],
    "testData": ["string"],
    "priority": "low|medium|high|critical",
    "tags": ["string"]
  },
  "suggestions": ["string"],
  "estimatedTime": number
}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) throw new Error('No response from OpenAI');

      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating test case:', error);
      throw new Error('Failed to generate test case with AI');
    }
  }

  async analyzeDefect(errorMessage: string, testContext: string): Promise<AIDefectAnalysis> {
    const prompt = `
You are an expert QA engineer analyzing a test failure. Analyze the following defect:

Error Message: ${errorMessage}
Test Context: ${testContext}

Please provide:
1. Severity assessment (low/medium/high/critical)
2. Priority recommendation (low/medium/high/critical)
3. Category classification
4. Likely root cause analysis
5. Suggested fix or investigation steps
6. Similar known issues
7. Confidence level (0-100)

Respond in JSON format:
{
  "severity": "low|medium|high|critical",
  "priority": "low|medium|high|critical", 
  "category": "string",
  "rootCause": "string",
  "suggestedFix": "string",
  "similarIssues": ["string"],
  "confidence": number
}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: 1500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) throw new Error('No response from OpenAI');

      return JSON.parse(response);
    } catch (error) {
      console.error('Error analyzing defect:', error);
      throw new Error('Failed to analyze defect with AI');
    }
  }

  async generateTestPlan(request: AITestPlanRequest): Promise<AITestPlanResponse> {
    const prompt = `
You are an expert QA architect. Create a comprehensive test plan for:

Project: ${request.projectDescription}
Features: ${request.features.join(', ')}
Test Types: ${request.testTypes.join(', ')}
Coverage Level: ${request.coverage}

Please provide:
1. Test plan name and description
2. List of test cases with priorities and types
3. Estimated duration
4. Coverage assessment
5. Recommendations for test strategy

Respond in JSON format:
{
  "testPlan": {
    "name": "string",
    "description": "string",
    "testCases": [{"name": "string", "description": "string", "priority": "string", "type": "string"}],
    "estimatedDuration": number,
    "coverage": "string"
  },
  "recommendations": ["string"]
}
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2500,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) throw new Error('No response from OpenAI');

      return JSON.parse(response);
    } catch (error) {
      console.error('Error generating test plan:', error);
      throw new Error('Failed to generate test plan with AI');
    }
  }

  async suggestTestOptimization(testResults: any[]): Promise<string[]> {
    const prompt = `
You are an expert QA optimization specialist. Analyze these test results and suggest improvements:

Test Results: ${JSON.stringify(testResults, null, 2)}

Please provide:
1. Performance optimization suggestions
2. Test coverage improvements
3. Flaky test identification
4. Resource optimization recommendations
5. Best practices for test maintenance

Respond as an array of actionable suggestions.
`;

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.5,
        max_tokens: 1000,
      });

      const response = completion.choices[0]?.message?.content;
      if (!response) throw new Error('No response from OpenAI');

      return JSON.parse(response);
    } catch (error) {
      console.error('Error suggesting optimizations:', error);
      throw new Error('Failed to generate optimization suggestions');
    }
  }
}

export const aiService = new AIService();
