import axios, { AxiosInstance, AxiosError } from "axios";
import { createParser, type EventSourceMessage } from "eventsource-parser";

/**
 * Represents an individual SSE event from the AI testing stream.
 */
export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Aggregated result from AI test generation via SSE streaming.
 */
export interface AITestResult {
  status: "passed" | "failed" | "error";
  steps: Array<{
    action: string;
    selector?: string;
    status: string;
    duration_ms?: number;
    screenshot?: string;
    healing?: Record<string, unknown>;
    confidence?: number;
  }>;
  screenshots: string[];
  summary?: string;
  error?: string;
  events: SSEEvent[];
}

/**
 * Options for constructing the Flowstral API client.
 */
export interface FlowstralClientOptions {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

/**
 * A typed error class for Flowstral API errors with actionable messages.
 */
export class FlowstralApiError extends Error {
  public readonly statusCode?: number;
  public readonly endpoint: string;

  constructor(message: string, endpoint: string, statusCode?: number) {
    super(message);
    this.name = "FlowstralApiError";
    this.endpoint = endpoint;
    this.statusCode = statusCode;
  }
}

/**
 * FlowstralApiClient wraps the Flowstral QA Platform REST API.
 *
 * It provides typed methods for test management, AI testing, accessibility
 * scanning, API testing, visual regression, defect tracking, and dashboards.
 */
export class FlowstralApiClient {
  private readonly http: AxiosInstance;
  private readonly baseUrl: string;

  constructor(options: FlowstralClientOptions = {}) {
    this.baseUrl = (options.baseUrl || "https://api.flowstral.com").replace(
      /\/$/,
      ""
    );

    this.http = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout ?? 120_000,
      headers: {
        "Content-Type": "application/json",
        ...(options.apiKey
          ? { Authorization: `Bearer ${options.apiKey}` }
          : {}),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Test Cases
  // ---------------------------------------------------------------------------

  /**
   * List test cases, optionally filtered by project and folder.
   */
  async listTestCases(
    projectId?: string,
    folder?: string
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    if (folder) params.folder = folder;

    return this.get("/test-cases", params);
  }

  // ---------------------------------------------------------------------------
  // Test Runs
  // ---------------------------------------------------------------------------

  /**
   * Start a test run for a given test case.
   */
  async runTestCase(testCaseId: string): Promise<Record<string, unknown>> {
    return this.post("/test-runs", { test_case_id: testCaseId });
  }

  /**
   * Retrieve details and results of a specific test run.
   */
  async getTestRun(runId: string): Promise<Record<string, unknown>> {
    return this.get(`/test-runs/${encodeURIComponent(runId)}`);
  }

  // ---------------------------------------------------------------------------
  // AI Test Generation (SSE streaming)
  // ---------------------------------------------------------------------------

  /**
   * Generate and execute an AI-powered test from a natural language instruction.
   *
   * This endpoint returns Server-Sent Events. We consume the full stream and
   * return an aggregated result object.
   */
  async aiGenerateTest(
    instruction: string,
    targetUrl: string
  ): Promise<AITestResult> {
    const events: SSEEvent[] = [];
    const steps: AITestResult["steps"] = [];
    const screenshots: string[] = [];
    let finalResult: Record<string, unknown> | null = null;
    let errorMessage: string | undefined;

    try {
      const response = await this.http.post(
        "/api/ai-testing/start",
        { instruction, target_url: targetUrl },
        {
          responseType: "stream",
          timeout: 300_000, // 5 min for long tests
          headers: { Accept: "text/event-stream" },
        }
      );

      await new Promise<void>((resolve, reject) => {
        const parser = createParser({
          onEvent(event: EventSourceMessage) {
            try {
              const parsed = JSON.parse(event.data);
              const eventType: string = parsed.type || event.event || "unknown";
              const eventData: Record<string, unknown> = parsed.data || parsed;

              events.push({ type: eventType, data: eventData });

              switch (eventType) {
                case "step":
                  steps.push({
                    action: (eventData.action as string) || "unknown",
                    selector: eventData.selector as string | undefined,
                    status: (eventData.status as string) || "unknown",
                    duration_ms: eventData.duration_ms as number | undefined,
                    healing: eventData.healing as
                      | Record<string, unknown>
                      | undefined,
                    confidence: eventData.confidence as number | undefined,
                  });
                  break;
                case "screenshot":
                  if (eventData.data) {
                    screenshots.push(eventData.data as string);
                  } else if (eventData.screenshot) {
                    screenshots.push(eventData.screenshot as string);
                  }
                  break;
                case "test_complete":
                case "complete":
                  finalResult = eventData;
                  resolve();
                  break;
                case "error":
                  errorMessage =
                    (eventData.message as string) ||
                    (eventData.error as string) ||
                    "Unknown error during AI test generation";
                  resolve();
                  break;
              }
            } catch {
              // Ignore malformed JSON lines
            }
          },
          onError() {
            // Parsing errors are non-fatal; the stream may still continue.
          },
        });

        const stream = response.data as NodeJS.ReadableStream;
        stream.on("data", (chunk: Buffer) => {
          parser.feed(chunk.toString());
        });
        stream.on("end", () => resolve());
        stream.on("error", (err: Error) => reject(err));
      });
    } catch (err) {
      return this.handleSSEError(err, events, steps, screenshots);
    }

    const passed =
      finalResult &&
      ((finalResult as Record<string, unknown>).status === "passed" ||
        (finalResult as Record<string, unknown>).result === "passed");

    return {
      status: errorMessage ? "error" : passed ? "passed" : "failed",
      steps,
      screenshots,
      summary:
        ((finalResult as Record<string, unknown> | null)?.summary as string) ||
        undefined,
      error: errorMessage,
      events,
    };
  }

  // ---------------------------------------------------------------------------
  // Accessibility Scanning
  // ---------------------------------------------------------------------------

  /**
   * Run a WCAG accessibility scan on the given URL.
   */
  async scanAccessibility(
    url: string,
    level?: string
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { url };
    if (level) body.level = level;
    return this.post("/api/accessibility/scan", body);
  }

  // ---------------------------------------------------------------------------
  // API Testing
  // ---------------------------------------------------------------------------

  /**
   * Execute a single API test request.
   */
  async executeApiTest(
    request: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return this.post("/api/v2/testing/execute", request);
  }

  // ---------------------------------------------------------------------------
  // Exploration (Blaze)
  // ---------------------------------------------------------------------------

  /**
   * Synchronously explore an application for defects.
   */
  async exploreApp(
    url: string,
    maxPages?: number
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = { url };
    if (maxPages !== undefined) body.max_pages = maxPages;
    return this.post("/api/blaze/start-sync", body);
  }

  // ---------------------------------------------------------------------------
  // Visual Testing
  // ---------------------------------------------------------------------------

  /**
   * Compare two images for visual regression.
   */
  async visualCompare(
    baseline: string,
    actual: string,
    mode?: string,
    threshold?: number
  ): Promise<Record<string, unknown>> {
    const body: Record<string, unknown> = {
      baseline_image: baseline,
      actual_image: actual,
    };
    if (mode) body.mode = mode;
    if (threshold !== undefined) body.threshold = threshold;
    return this.post("/api/visual-testing/compare", body);
  }

  // ---------------------------------------------------------------------------
  // Defects
  // ---------------------------------------------------------------------------

  /**
   * Retrieve a list of defects, optionally filtered.
   */
  async getDefects(
    projectId?: string,
    severity?: string,
    status?: string
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    if (severity) params.severity = severity;
    if (status) params.status = status;
    return this.get("/defects", params);
  }

  // ---------------------------------------------------------------------------
  // Dashboard
  // ---------------------------------------------------------------------------

  /**
   * Retrieve dashboard health metrics for a project.
   */
  async getDashboard(
    projectId?: string
  ): Promise<Record<string, unknown>> {
    const params: Record<string, string> = {};
    if (projectId) params.project_id = projectId;
    return this.get("/dashboard/metrics", params);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async get(
    path: string,
    params?: Record<string, string>
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.http.get(path, { params });
      return response.data as Record<string, unknown>;
    } catch (err) {
      throw this.wrapError(err, `GET ${path}`);
    }
  }

  private async post(
    path: string,
    body: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    try {
      const response = await this.http.post(path, body);
      return response.data as Record<string, unknown>;
    } catch (err) {
      throw this.wrapError(err, `POST ${path}`);
    }
  }

  private wrapError(err: unknown, endpoint: string): FlowstralApiError {
    if (err instanceof AxiosError) {
      const status = err.response?.status;
      if (status === 401 || status === 403) {
        return new FlowstralApiError(
          `Authentication failed for ${endpoint}. Check that FLOWSTRAL_API_KEY is set correctly.`,
          endpoint,
          status
        );
      }
      if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
        return new FlowstralApiError(
          `Cannot connect to Flowstral API at ${this.baseUrl}. Check that FLOWSTRAL_API_URL is set correctly and the server is running.`,
          endpoint
        );
      }
      const message =
        (err.response?.data as Record<string, unknown>)?.detail ||
        (err.response?.data as Record<string, unknown>)?.message ||
        err.message;
      return new FlowstralApiError(
        `${endpoint} failed (HTTP ${status || "unknown"}): ${message}`,
        endpoint,
        status
      );
    }
    return new FlowstralApiError(
      `${endpoint} failed: ${err instanceof Error ? err.message : String(err)}`,
      endpoint
    );
  }

  private handleSSEError(
    err: unknown,
    events: SSEEvent[],
    steps: AITestResult["steps"],
    screenshots: string[]
  ): AITestResult {
    const message =
      err instanceof AxiosError
        ? err.code === "ECONNREFUSED" || err.code === "ENOTFOUND"
          ? `Cannot connect to Flowstral API at ${this.baseUrl}. Check that FLOWSTRAL_API_URL is set correctly.`
          : err.response?.status === 401 || err.response?.status === 403
            ? "Authentication failed. Check that FLOWSTRAL_API_KEY is set correctly."
            : `AI test generation request failed: ${err.message}`
        : `AI test generation failed: ${err instanceof Error ? err.message : String(err)}`;

    return {
      status: "error",
      steps,
      screenshots,
      error: message,
      events,
    };
  }
}
