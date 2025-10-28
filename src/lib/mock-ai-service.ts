// Mock AI Service for Development
// This provides realistic AI responses for testing before custom LLM is ready

export interface MockAIConfig {
  useMock: boolean;
  delay: number; // Simulate API delay
  successRate: number; // Simulate occasional failures
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

class MockAIService {
  private config: MockAIConfig;

  constructor(config: MockAIConfig = { useMock: true, delay: 2000, successRate: 0.95 }) {
    this.config = config;
  }

  async generateTestCase(request: TestGenerationRequest): Promise<TestGenerationResponse> {
    if (!this.config.useMock) {
      throw new Error('Mock AI service is disabled');
    }

    await this.simulateDelay();
    this.simulateRandomFailure();

    return this.generateMockTestCase(request);
  }

  async analyzeDefect(request: DefectAnalysisRequest): Promise<DefectAnalysisResponse> {
    if (!this.config.useMock) {
      throw new Error('Mock AI service is disabled');
    }

    await this.simulateDelay();
    this.simulateRandomFailure();

    return this.generateMockDefectAnalysis(request);
  }

  async generateTestPlan(request: TestPlanRequest): Promise<TestPlanResponse> {
    if (!this.config.useMock) {
      throw new Error('Mock AI service is disabled');
    }

    await this.simulateDelay();
    this.simulateRandomFailure();

    return this.generateMockTestPlan(request);
  }

  async optimizeTestSuite(testResults: any[]): Promise<string[]> {
    if (!this.config.useMock) {
      throw new Error('Mock AI service is disabled');
    }

    await this.simulateDelay();
    this.simulateRandomFailure();

    return this.generateMockOptimizations(testResults);
  }

  private async simulateDelay(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, this.config.delay));
  }

  private simulateRandomFailure(): void {
    if (Math.random() > this.config.successRate) {
      throw new Error('Simulated AI service failure');
    }
  }

  private generateMockTestCase(request: TestGenerationRequest): TestGenerationResponse {
    const testType = request.testType || 'manual';
    const complexity = request.complexity || 'medium';
    
    // Generate realistic test case based on input
    const testCaseName = this.generateTestCaseName(request.feature, testType);
    const steps = this.generateTestSteps(testType, complexity);
    const priority = this.determinePriority(request.description, testType);
    const tags = this.generateTags(testType, complexity);

    return {
      testCase: {
        name: testCaseName,
        description: `Comprehensive test case for ${request.feature}. ${request.description}`,
        steps: steps,
        preconditions: this.generatePreconditions(testType),
        testData: this.generateTestData(testType),
        priority: priority,
        tags: tags,
        automationScript: testType === 'api' ? this.generateAPIScript() : undefined
      },
      suggestions: this.generateSuggestions(testType, complexity),
      estimatedTime: this.estimateTime(complexity, steps.length),
      confidence: this.calculateConfidence(request.description, testType)
    };
  }

  private generateMockDefectAnalysis(request: DefectAnalysisRequest): DefectAnalysisResponse {
    const errorMessage = request.errorMessage.toLowerCase();
    const severity = this.determineSeverity(errorMessage);
    const category = this.categorizeError(errorMessage);
    const rootCause = this.generateRootCause(errorMessage, category);
    const suggestedFix = this.generateSuggestedFix(category, rootCause);

    return {
      severity: severity,
      priority: this.determinePriority(severity),
      category: category,
      rootCause: rootCause,
      suggestedFix: suggestedFix,
      similarIssues: this.generateSimilarIssues(category),
      confidence: this.calculateDefectConfidence(errorMessage),
      investigationSteps: this.generateInvestigationSteps(category, rootCause)
    };
  }

  private generateMockTestPlan(request: TestPlanRequest): TestPlanResponse {
    const testCases = this.generateTestCasesForPlan(request);
    const estimatedDuration = testCases.reduce((sum, tc) => sum + tc.estimatedTime, 0);

    return {
      testPlan: {
        name: `${request.projectDescription} - Comprehensive Test Plan`,
        description: `Complete test strategy for ${request.projectDescription} covering ${request.features.join(', ')}`,
        testCases: testCases,
        estimatedDuration: estimatedDuration,
        coverage: this.assessCoverage(request.coverage, testCases.length),
        riskAssessment: this.generateRiskAssessment(request.features, request.testTypes)
      },
      recommendations: this.generatePlanRecommendations(request),
      resourceRequirements: this.generateResourceRequirements(request)
    };
  }

  private generateMockOptimizations(testResults: any[]): string[] {
    return [
      "Consider implementing test data factories to reduce setup time",
      "Add retry mechanisms for flaky network-dependent tests",
      "Implement parallel test execution for independent test cases",
      "Add performance monitoring to identify slow-running tests",
      "Consider using test containers for better environment isolation",
      "Implement smart test selection based on code changes",
      "Add test result caching for unchanged components",
      "Consider breaking down large test suites into smaller, focused modules"
    ];
  }

  // Helper methods for generating realistic mock data
  private generateTestCaseName(feature: string, testType: string): string {
    const typePrefix = {
      'api': 'API',
      'ui': 'UI',
      'e2e': 'E2E',
      'performance': 'Performance',
      'manual': 'Manual'
    }[testType] || 'Test';

    // Generate more specific and varied names based on feature content
    const featureLower = feature.toLowerCase();
    
    if (featureLower.includes('login') || featureLower.includes('auth')) {
      const variations = ['User Authentication', 'Login Validation', 'Auth Flow', 'Credential Verification'];
      return `${typePrefix} - ${variations[Math.floor(Math.random() * variations.length)]}`;
    }
    
    if (featureLower.includes('payment') || featureLower.includes('checkout')) {
      const variations = ['Payment Processing', 'Checkout Flow', 'Transaction Handling', 'Billing Integration'];
      return `${typePrefix} - ${variations[Math.floor(Math.random() * variations.length)]}`;
    }
    
    if (featureLower.includes('search') || featureLower.includes('filter')) {
      const variations = ['Search Functionality', 'Data Filtering', 'Query Processing', 'Result Display'];
      return `${typePrefix} - ${variations[Math.floor(Math.random() * variations.length)]}`;
    }
    
    if (featureLower.includes('profile') || featureLower.includes('user')) {
      const variations = ['User Profile Management', 'Account Settings', 'User Data Handling', 'Profile Updates'];
      return `${typePrefix} - ${variations[Math.floor(Math.random() * variations.length)]}`;
    }
    
    if (featureLower.includes('form') || featureLower.includes('submit')) {
      const variations = ['Form Submission', 'Data Entry', 'Input Validation', 'Form Processing'];
      return `${typePrefix} - ${variations[Math.floor(Math.random() * variations.length)]}`;
    }

    return `${typePrefix} - ${feature}`;
  }

  private generateTestSteps(testType: string, complexity: string): Array<{action: string, expectedResult: string}> {
    const stepTemplates = {
      'api': {
        login: [
          { action: "Send POST request to /api/auth/login with valid credentials", expectedResult: "Response status 200 with JWT token" },
          { action: "Extract token from response body", expectedResult: "Valid JWT token received" },
          { action: "Use token for authenticated requests", expectedResult: "Subsequent requests succeed with token" }
        ],
        user: [
          { action: "Send GET request to /api/users/profile", expectedResult: "User profile data returned successfully" },
          { action: "Validate profile data structure", expectedResult: "All required fields present and valid" },
          { action: "Verify data accuracy", expectedResult: "Profile data matches expected values" }
        ],
        payment: [
          { action: "Send POST request to /api/payments with card details", expectedResult: "Payment processed successfully" },
          { action: "Verify payment confirmation", expectedResult: "Payment ID and status returned" },
          { action: "Check payment status", expectedResult: "Payment marked as completed" }
        ],
        search: [
          { action: "Send GET request to /api/search with query parameters", expectedResult: "Search results returned" },
          { action: "Validate result count", expectedResult: "Results match expected count" },
          { action: "Verify result relevance", expectedResult: "Results are relevant to search query" }
        ]
      },
      'ui': {
        login: [
          { action: "Navigate to login page", expectedResult: "Login form is displayed" },
          { action: "Enter valid email and password", expectedResult: "Credentials entered successfully" },
          { action: "Click login button", expectedResult: "User redirected to dashboard" },
          { action: "Verify user is logged in", expectedResult: "User profile and logout option visible" }
        ],
        form: [
          { action: "Open form page", expectedResult: "Form loads with all required fields" },
          { action: "Fill in all required information", expectedResult: "Form validation passes" },
          { action: "Submit the form", expectedResult: "Success message displayed" },
          { action: "Verify data was saved", expectedResult: "Data appears in confirmation" }
        ],
        navigation: [
          { action: "Click on main navigation menu", expectedResult: "Menu expands showing all options" },
          { action: "Select a menu item", expectedResult: "Page navigates to selected section" },
          { action: "Verify page content", expectedResult: "Correct page content is displayed" }
        ]
      },
      'e2e': {
        checkout: [
          { action: "Add items to shopping cart", expectedResult: "Items appear in cart with correct quantities" },
          { action: "Proceed to checkout", expectedResult: "Checkout page loads with cart items" },
          { action: "Enter shipping information", expectedResult: "Shipping form accepts valid data" },
          { action: "Complete payment process", expectedResult: "Order confirmation page displayed" },
          { action: "Verify order details", expectedResult: "Order summary matches cart contents" }
        ],
        registration: [
          { action: "Navigate to registration page", expectedResult: "Registration form is displayed" },
          { action: "Fill in user details", expectedResult: "Form accepts all required information" },
          { action: "Submit registration", expectedResult: "Account created successfully" },
          { action: "Verify email confirmation", expectedResult: "Confirmation email sent" },
          { action: "Login with new account", expectedResult: "User can access the application" }
        ]
      },
      'performance': {
        load: [
          { action: "Load application homepage", expectedResult: "Page loads within 2 seconds" },
          { action: "Measure resource usage", expectedResult: "Memory usage stays under 100MB" },
          { action: "Test concurrent users", expectedResult: "Application handles 100+ concurrent users" }
        ],
        api: [
          { action: "Send multiple API requests", expectedResult: "All requests complete within 500ms" },
          { action: "Monitor response times", expectedResult: "95th percentile under 1 second" },
          { action: "Test under load", expectedResult: "No degradation with increased load" }
        ]
      }
    };

    // Get random template based on test type
    const templates = stepTemplates[testType] || stepTemplates['ui'];
    const templateKeys = Object.keys(templates);
    const randomKey = templateKeys[Math.floor(Math.random() * templateKeys.length)];
    let steps = templates[randomKey] || templates[templateKeys[0]];

    // Add complexity-based steps
    if (complexity === 'complex') {
      steps = [...steps, 
        { action: "Test edge cases and boundary conditions", expectedResult: "System handles edge cases gracefully" },
        { action: "Verify error handling and recovery", expectedResult: "Appropriate error messages and recovery options" },
        { action: "Validate data integrity and consistency", expectedResult: "Data remains consistent across all operations" }
      ];
    } else if (complexity === 'simple') {
      steps = steps.slice(0, Math.min(3, steps.length));
    }

    return steps;
  }

  private determinePriority(description: string, testType: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalKeywords = ['login', 'payment', 'security', 'authentication', 'critical'];
    const highKeywords = ['user', 'profile', 'dashboard', 'main'];
    
    const text = description.toLowerCase();
    
    if (criticalKeywords.some(keyword => text.includes(keyword))) return 'critical';
    if (highKeywords.some(keyword => text.includes(keyword))) return 'high';
    if (testType === 'performance') return 'medium';
    return 'low';
  }

  private generateTags(testType: string, complexity: string): string[] {
    const baseTags = [testType, complexity];
    const additionalTags = {
      'api': ['integration', 'backend'],
      'ui': ['frontend', 'user-interface'],
      'e2e': ['end-to-end', 'workflow'],
      'performance': ['load-testing', 'metrics']
    };
    
    return [...baseTags, ...(additionalTags[testType] || [])];
  }

  private generatePreconditions(testType: string): string[] {
    const preconditions = {
      'api': ['Valid API credentials', 'Test environment accessible', 'Required test data available'],
      'ui': ['Browser environment ready', 'Test user account available', 'Application deployed'],
      'e2e': ['Complete test environment', 'All dependencies available', 'Test data prepared'],
      'performance': ['Performance test environment', 'Monitoring tools configured', 'Baseline metrics established']
    };
    
    return preconditions[testType] || ['Test environment ready'];
  }

  private generateTestData(testType: string): string[] {
    const testData = {
      'api': ['Valid user credentials', 'Test API endpoints', 'Sample request payloads'],
      'ui': ['Test user accounts', 'Sample content data', 'Valid form inputs'],
      'e2e': ['Complete user workflows', 'Test scenarios', 'Expected outcomes'],
      'performance': ['Load test parameters', 'Performance thresholds', 'Monitoring configurations']
    };
    
    return testData[testType] || ['Test data available'];
  }

  private generateAPIScript(): string {
    return `// Generated API test script
const response = await fetch('/api/endpoint', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(testData)
});
expect(response.status).toBe(200);
expect(response.data).toMatchSchema(expectedSchema);`;
  }

  private generateSuggestions(testType: string, complexity: string): string[] {
    const suggestions = [
      'Consider adding negative test cases',
      'Include boundary value testing',
      'Add data validation tests',
      'Consider performance implications'
    ];
    
    if (complexity === 'complex') {
      suggestions.push('Add security testing considerations', 'Include accessibility testing');
    }
    
    return suggestions;
  }

  private estimateTime(complexity: string, stepCount: number): number {
    const baseTime = stepCount * 5; // 5 minutes per step
    const complexityMultiplier = {
      'simple': 1,
      'medium': 1.5,
      'complex': 2
    }[complexity] || 1;
    
    return Math.round(baseTime * complexityMultiplier);
  }

  private calculateConfidence(description: string, testType: string): number {
    // Simulate confidence based on description quality and test type
    let confidence = 85;
    
    if (description.length > 100) confidence += 5;
    if (testType === 'api') confidence += 5;
    if (description.includes('error') || description.includes('validation')) confidence -= 5;
    
    return Math.min(95, Math.max(70, confidence));
  }

  private determineSeverity(errorMessage: string): 'low' | 'medium' | 'high' | 'critical' {
    if (errorMessage.includes('500') || errorMessage.includes('critical')) return 'critical';
    if (errorMessage.includes('timeout') || errorMessage.includes('connection')) return 'high';
    if (errorMessage.includes('warning') || errorMessage.includes('deprecated')) return 'low';
    return 'medium';
  }

  private categorizeError(errorMessage: string): string {
    if (errorMessage.includes('timeout')) return 'Performance Issue';
    if (errorMessage.includes('assertion') || errorMessage.includes('expected')) return 'Test Logic Error';
    if (errorMessage.includes('connection') || errorMessage.includes('network')) return 'Network Issue';
    if (errorMessage.includes('element not found')) return 'UI Element Issue';
    return 'General Error';
  }

  private generateRootCause(errorMessage: string, category: string): string {
    const rootCauses = {
      'Performance Issue': 'The application is experiencing performance degradation, likely due to resource constraints or inefficient queries.',
      'Test Logic Error': 'The test assertion is incorrect or the expected behavior has changed in the application.',
      'Network Issue': 'Network connectivity problems or service unavailability is causing the test to fail.',
      'UI Element Issue': 'The UI element is not loading properly or has changed its selector/location.',
      'General Error': 'An unexpected error occurred that requires further investigation.'
    };
    
    return rootCauses[category] || rootCauses['General Error'];
  }

  private generateSuggestedFix(category: string, rootCause: string): string {
    const fixes = {
      'Performance Issue': 'Optimize database queries, increase server resources, or implement caching mechanisms.',
      'Test Logic Error': 'Review and update test assertions to match current application behavior.',
      'Network Issue': 'Check network connectivity, verify service availability, and implement retry mechanisms.',
      'UI Element Issue': 'Update element selectors, add wait conditions, or verify element visibility.',
      'General Error': 'Review application logs, check system resources, and verify configuration settings.'
    };
    
    return fixes[category] || fixes['General Error'];
  }

  private generateSimilarIssues(category: string): string[] {
    return [
      `Similar ${category.toLowerCase()} reported last week`,
      `Related issue in ${category.toLowerCase()} category`,
      `Previous ${category.toLowerCase()} resolved with similar approach`
    ];
  }

  private calculateDefectConfidence(errorMessage: string): number {
    let confidence = 80;
    if (errorMessage.length > 50) confidence += 10;
    if (errorMessage.includes('stack trace')) confidence += 5;
    return Math.min(95, confidence);
  }

  private generateInvestigationSteps(category: string, rootCause: string): string[] {
    return [
      'Review application logs for detailed error information',
      'Check system resources and performance metrics',
      'Verify configuration settings and environment variables',
      'Test the functionality in a different environment',
      'Review recent code changes that might have caused the issue'
    ];
  }

  private generateTestCasesForPlan(request: TestPlanRequest): Array<{name: string, description: string, priority: string, type: string, estimatedTime: number}> {
    const testCases = [];
    
    request.features.forEach(feature => {
      request.testTypes.forEach(testType => {
        testCases.push({
          name: `${testType.toUpperCase()} - ${feature}`,
          description: `Test ${feature} functionality using ${testType} approach`,
          priority: this.determinePriority(feature, testType),
          type: testType,
          estimatedTime: this.estimateTime('medium', 3)
        });
      });
    });
    
    return testCases;
  }

  private assessCoverage(coverage: string, testCaseCount: number): string {
    const coverageLevels = {
      'basic': 'Basic coverage with essential test cases',
      'comprehensive': 'Comprehensive coverage including edge cases',
      'exhaustive': 'Exhaustive coverage with all possible scenarios'
    };
    
    return coverageLevels[coverage] || coverageLevels['comprehensive'];
  }

  private generateRiskAssessment(features: string[], testTypes: string[]): string {
    const riskLevel = features.length > 5 ? 'High' : features.length > 2 ? 'Medium' : 'Low';
    return `${riskLevel} risk level due to ${features.length} features requiring ${testTypes.length} different test approaches.`;
  }

  private generatePlanRecommendations(request: TestPlanRequest): string[] {
    return [
      'Start with high-priority features to ensure critical functionality is tested first',
      'Implement automated testing for repetitive test cases',
      'Consider parallel test execution to reduce overall testing time',
      'Set up continuous integration to catch issues early',
      'Establish clear test data management strategy'
    ];
  }

  private generateResourceRequirements(request: TestPlanRequest): string[] {
    return [
      'QA Engineer: 1-2 resources',
      'Test Environment: Dedicated testing infrastructure',
      'Test Data: Comprehensive test datasets',
      'Tools: Test automation and monitoring tools',
      'Time: Estimated 2-4 weeks for complete execution'
    ];
  }
}

// Export singleton instance
export const mockAIService = new MockAIService();

// Export the mock service as the default AI service for development
export const aiService = mockAIService;
