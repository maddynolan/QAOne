import type { FlowstralApiClient } from "../client.js";

/**
 * Tool definition for MCP tool listing.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Tool definitions for test management operations.
 */
export const testingToolDefinitions: ToolDefinition[] = [
  {
    name: "flowstral_list_tests",
    description:
      "List test cases from the Flowstral QA platform. Returns test case IDs, names, statuses, step counts, and last run timestamps. Use this to discover available tests before running them.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description:
            "Filter by project ID. If omitted, lists tests across all accessible projects.",
        },
        folder: {
          type: "string",
          description:
            "Filter by folder name within the project (e.g. 'regression', 'smoke').",
        },
        limit: {
          type: "number",
          description:
            "Maximum number of test cases to return. Defaults to 50.",
        },
      },
    },
  },
  {
    name: "flowstral_run_test",
    description:
      "Run a saved test case by its ID. Starts automated Playwright browser execution on the server, waits for completion, and returns the full result including pass/fail status, step details, duration, and any failure information.",
    inputSchema: {
      type: "object",
      properties: {
        test_case_id: {
          type: "string",
          description:
            "The unique ID of the test case to execute. Use flowstral_list_tests to find available test case IDs.",
        },
      },
      required: ["test_case_id"],
    },
  },
  {
    name: "flowstral_ai_generate_test",
    description:
      "Generate and execute an AI-powered browser test from a natural language instruction. The AI agent will navigate to the target URL, plan test steps, execute them in a real browser, take screenshots, and self-heal broken selectors automatically. Returns step-by-step results with pass/fail status.",
    inputSchema: {
      type: "object",
      properties: {
        instruction: {
          type: "string",
          description:
            'Natural language description of what to test (e.g. "Log in with user@example.com and verify the dashboard loads with a welcome message").',
        },
        target_url: {
          type: "string",
          description:
            "The URL of the application to test (e.g. https://myapp.com/login).",
        },
      },
      required: ["instruction", "target_url"],
    },
  },
  {
    name: "flowstral_get_results",
    description:
      "Get detailed results for a specific test run, including per-step status, selectors used, step durations, screenshots, and self-healing information.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: {
          type: "string",
          description: "The test run ID to retrieve results for.",
        },
      },
      required: ["run_id"],
    },
  },
];

/**
 * Execute a testing tool and return a text result for the MCP response.
 */
export async function handleTestingTool(
  toolName: string,
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  switch (toolName) {
    case "flowstral_list_tests":
      return handleListTests(args, client);
    case "flowstral_run_test":
      return handleRunTest(args, client);
    case "flowstral_ai_generate_test":
      return handleAIGenerateTest(args, client);
    case "flowstral_get_results":
      return handleGetResults(args, client);
    default:
      throw new Error(`Unknown testing tool: ${toolName}`);
  }
}

async function handleListTests(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const result = await client.listTestCases(
    args.project_id as string | undefined,
    args.folder as string | undefined
  );

  const tests = Array.isArray(result) ? result : (result.test_cases as unknown[]) || (result.data as unknown[]) || [result];
  const limit = (args.limit as number) || 50;
  const limited = tests.slice(0, limit);

  if (limited.length === 0) {
    return "No test cases found. Try different filters or check that the project has test cases.";
  }

  const lines = limited.map((t: unknown) => {
    const tc = t as Record<string, unknown>;
    return [
      `- **${tc.name || tc.title || "Untitled"}** (ID: ${tc.id})`,
      tc.status ? `  Status: ${tc.status}` : "",
      tc.steps_count !== undefined ? `  Steps: ${tc.steps_count}` : "",
      tc.last_run ? `  Last run: ${tc.last_run}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  return `Found ${tests.length} test case(s)${tests.length > limit ? ` (showing first ${limit})` : ""}:\n\n${lines.join("\n\n")}`;
}

async function handleRunTest(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const testCaseId = args.test_case_id as string;
  if (!testCaseId) {
    return "Error: test_case_id is required.";
  }

  const runResult = await client.runTestCase(testCaseId);
  const runId =
    (runResult.id as string) ||
    (runResult.run_id as string) ||
    (runResult.execution_id as string);

  if (!runId) {
    return `Test run started but no run ID was returned. Response: ${JSON.stringify(runResult, null, 2)}`;
  }

  // Poll for completion (max 5 minutes)
  const maxAttempts = 60;
  const pollInterval = 5000;
  let finalResult: Record<string, unknown> | null = null;

  for (let i = 0; i < maxAttempts; i++) {
    await sleep(pollInterval);
    const status = await client.getTestRun(runId);
    const runStatus =
      (status.status as string) || (status.state as string) || "";

    if (
      ["completed", "passed", "failed", "error", "cancelled"].includes(
        runStatus.toLowerCase()
      )
    ) {
      finalResult = status;
      break;
    }
  }

  if (!finalResult) {
    return `Test run ${runId} is still in progress after 5 minutes. Use flowstral_get_results with run_id "${runId}" to check later.`;
  }

  return formatTestRunResult(finalResult, runId);
}

async function handleAIGenerateTest(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const instruction = args.instruction as string;
  const targetUrl = args.target_url as string;

  if (!instruction || !targetUrl) {
    return "Error: both instruction and target_url are required.";
  }

  const result = await client.aiGenerateTest(instruction, targetUrl);

  const lines: string[] = [
    `## AI Test Result: ${result.status.toUpperCase()}`,
    "",
  ];

  if (result.error) {
    lines.push(`**Error:** ${result.error}`, "");
  }

  if (result.summary) {
    lines.push(`**Summary:** ${result.summary}`, "");
  }

  if (result.steps.length > 0) {
    lines.push(`### Steps (${result.steps.length})`, "");
    result.steps.forEach((step, i) => {
      const icon = step.status === "passed" ? "PASS" : step.status === "failed" ? "FAIL" : step.status.toUpperCase();
      lines.push(`${i + 1}. [${icon}] ${step.action}`);
      if (step.selector) lines.push(`   Selector: \`${step.selector}\``);
      if (step.confidence !== undefined)
        lines.push(`   Confidence: ${(step.confidence * 100).toFixed(0)}%`);
      if (step.duration_ms !== undefined)
        lines.push(`   Duration: ${step.duration_ms}ms`);
      if (step.healing) lines.push(`   Self-healed: yes`);
    });
  }

  if (result.screenshots.length > 0) {
    lines.push("", `### Screenshots: ${result.screenshots.length} captured`);
  }

  return lines.join("\n");
}

async function handleGetResults(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const runId = args.run_id as string;
  if (!runId) {
    return "Error: run_id is required.";
  }

  const result = await client.getTestRun(runId);
  return formatTestRunResult(result, runId);
}

function formatTestRunResult(
  result: Record<string, unknown>,
  runId: string
): string {
  const status = (result.status as string) || (result.state as string) || "unknown";
  const testName =
    (result.test_name as string) || (result.name as string) || "Unknown test";
  const duration =
    (result.duration_ms as number) || (result.duration as number);

  const lines: string[] = [
    `## Test Run: ${testName}`,
    `**Run ID:** ${runId}`,
    `**Status:** ${status.toUpperCase()}`,
  ];

  if (duration !== undefined) {
    lines.push(
      `**Duration:** ${duration > 1000 ? `${(duration / 1000).toFixed(1)}s` : `${duration}ms`}`
    );
  }

  const steps = (result.steps as unknown[]) || (result.step_results as unknown[]);
  if (steps && Array.isArray(steps)) {
    const passed = steps.filter(
      (s) => (s as Record<string, unknown>).status === "passed"
    ).length;
    const failed = steps.length - passed;
    lines.push(`**Steps:** ${passed} passed, ${failed} failed (${steps.length} total)`);

    const failedSteps = steps.filter(
      (s) => (s as Record<string, unknown>).status !== "passed"
    );
    if (failedSteps.length > 0) {
      lines.push("", "### Failed Steps:");
      failedSteps.forEach((s) => {
        const step = s as Record<string, unknown>;
        lines.push(
          `- Step ${step.step_number || step.index || "?"}: ${step.action || step.description || "Unknown action"}`
        );
        if (step.error) lines.push(`  Error: ${step.error}`);
        if (step.selector) lines.push(`  Selector: \`${step.selector}\``);
      });
    }
  }

  return lines.join("\n");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
