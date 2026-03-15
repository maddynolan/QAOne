import axios, { AxiosInstance, AxiosError } from 'axios';
import {
  TestCase,
  TestRun,
  Defect,
  AccessibilityScanResult,
  ExplorationResult,
  DashboardMetrics,
  ApiTestResult,
} from './types';

export class FlowstralApiClient {
  private client: AxiosInstance;
  private apiKey: string | undefined;

  constructor(baseUrl: string, apiKey?: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 120000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.client.interceptors.request.use((config) => {
      if (this.apiKey) {
        config.headers.Authorization = `Bearer ${this.apiKey}`;
      }
      return config;
    });
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  setBaseUrl(baseUrl: string): void {
    this.client.defaults.baseURL = baseUrl.replace(/\/+$/, '');
  }

  // --- Test Cases ---

  async listTestCases(projectId?: string): Promise<TestCase[]> {
    try {
      const params: Record<string, string> = {};
      if (projectId) {
        params.project_id = projectId;
      }
      const response = await this.client.get('/test-cases', { params });
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.test_cases)) {
        return data.test_cases;
      }
      if (data && Array.isArray(data.items)) {
        return data.items;
      }
      return [];
    } catch (error) {
      throw this.wrapError(error, 'Failed to list test cases');
    }
  }

  // --- Test Runs ---

  async listTestRuns(limit: number = 20): Promise<TestRun[]> {
    try {
      const response = await this.client.get('/test-runs', {
        params: { limit },
      });
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.runs)) {
        return data.runs;
      }
      if (data && Array.isArray(data.items)) {
        return data.items;
      }
      return [];
    } catch (error) {
      throw this.wrapError(error, 'Failed to list test runs');
    }
  }

  async getTestRun(runId: string): Promise<TestRun> {
    try {
      const response = await this.client.get(`/test-runs/${runId}`);
      return response.data;
    } catch (error) {
      throw this.wrapError(error, `Failed to get test run ${runId}`);
    }
  }

  async runTestCase(testCaseId: string): Promise<TestRun> {
    try {
      const response = await this.client.post('/test-runs', {
        test_case_id: testCaseId,
      });
      return response.data;
    } catch (error) {
      throw this.wrapError(error, 'Failed to run test case');
    }
  }

  // --- AI Test Generation ---

  async aiGenerateTest(
    description: string,
    targetUrl: string,
    onEvent?: (event: { type: string; data: unknown }) => void
  ): Promise<{ success: boolean; results: unknown }> {
    try {
      const response = await this.client.post(
        '/api/ai-testing/start',
        {
          goal: description,
          url: targetUrl,
        },
        {
          responseType: 'stream',
          timeout: 300000,
          adapter: 'http',
        }
      );

      const results: unknown[] = [];
      let finalResult: unknown = null;

      return new Promise((resolve, reject) => {
        let buffer = '';

        response.data.on('data', (chunk: Buffer) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('data: ')) {
              const dataStr = trimmed.slice(6);
              if (dataStr === '[DONE]') {
                continue;
              }
              try {
                const parsed = JSON.parse(dataStr);
                results.push(parsed);
                if (onEvent) {
                  onEvent({ type: parsed.type || 'data', data: parsed });
                }
                if (parsed.type === 'complete' || parsed.type === 'test_complete') {
                  finalResult = parsed;
                }
              } catch {
                // Skip unparseable lines
              }
            }
          }
        });

        response.data.on('end', () => {
          resolve({
            success: true,
            results: finalResult || results,
          });
        });

        response.data.on('error', (err: Error) => {
          reject(new Error(`SSE stream error: ${err.message}`));
        });
      });
    } catch (error) {
      // Fallback for non-streaming environments: try a plain POST
      try {
        const response = await this.client.post('/api/ai-testing/start', {
          goal: description,
          url: targetUrl,
        });
        return { success: true, results: response.data };
      } catch (fallbackError) {
        throw this.wrapError(fallbackError, 'Failed to generate AI test');
      }
    }
  }

  // --- Accessibility ---

  async scanAccessibility(url: string, level: string = 'AA'): Promise<AccessibilityScanResult> {
    try {
      const response = await this.client.post('/api/accessibility/scan', {
        url,
        level,
      });
      return response.data;
    } catch (error) {
      throw this.wrapError(error, 'Failed to scan accessibility');
    }
  }

  // --- Exploration ---

  async exploreApp(url: string, maxPages: number = 50): Promise<ExplorationResult> {
    try {
      const response = await this.client.post(
        '/api/blaze/start-sync',
        {
          url,
          max_pages: maxPages,
        },
        { timeout: 300000 }
      );
      return response.data;
    } catch (error) {
      throw this.wrapError(error, 'Failed to explore application');
    }
  }

  // --- Defects ---

  async getDefects(projectId?: string): Promise<Defect[]> {
    try {
      const params: Record<string, string> = {};
      if (projectId) {
        params.project_id = projectId;
      }
      const response = await this.client.get('/defects', { params });
      const data = response.data;
      if (Array.isArray(data)) {
        return data;
      }
      if (data && Array.isArray(data.defects)) {
        return data.defects;
      }
      if (data && Array.isArray(data.items)) {
        return data.items;
      }
      return [];
    } catch (error) {
      throw this.wrapError(error, 'Failed to get defects');
    }
  }

  // --- Dashboard ---

  async getDashboard(): Promise<DashboardMetrics> {
    try {
      const response = await this.client.get('/dashboard/metrics');
      return response.data;
    } catch (error) {
      throw this.wrapError(error, 'Failed to get dashboard metrics');
    }
  }

  // --- API Testing ---

  async executeApiTest(
    url: string,
    method: string,
    body?: string,
    headers?: Record<string, string>
  ): Promise<ApiTestResult> {
    try {
      const response = await this.client.post('/api/v2/testing/execute', {
        url,
        method: method.toUpperCase(),
        body: body ? JSON.parse(body) : undefined,
        headers: headers || {},
        protocol: 'rest',
      });
      return response.data;
    } catch (error) {
      throw this.wrapError(error, 'Failed to execute API test');
    }
  }

  // --- Health check ---

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health', { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }

  private wrapError(error: unknown, context: string): Error {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.detail || error.response?.data?.message || error.message;
      if (status === 401 || status === 403) {
        return new Error(`${context}: Authentication failed. Please check your API key.`);
      }
      if (status === 404) {
        return new Error(`${context}: Endpoint not found. Check your API URL configuration.`);
      }
      if (!error.response) {
        return new Error(
          `${context}: Cannot connect to Flowstral server. Is it running at ${this.client.defaults.baseURL}?`
        );
      }
      return new Error(`${context}: ${message} (HTTP ${status})`);
    }
    if (error instanceof Error) {
      return new Error(`${context}: ${error.message}`);
    }
    return new Error(context);
  }
}
