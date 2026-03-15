import type { FlowstralApiClient } from "../client.js";
import type { ToolDefinition } from "./testing.js";

/**
 * Tool definitions for API testing operations.
 */
export const apiTestingToolDefinitions: ToolDefinition[] = [
  {
    name: "flowstral_run_api_test",
    description:
      "Execute an API test request against any HTTP endpoint. Supports REST, GraphQL, SOAP, and other protocols. Returns status code, response time, response body preview, and assertion results. Useful for verifying API behavior, checking health endpoints, or validating response schemas.",
    inputSchema: {
      type: "object",
      properties: {
        method: {
          type: "string",
          description:
            "HTTP method (GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD).",
          enum: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
        },
        url: {
          type: "string",
          description: "The full URL to send the request to.",
        },
        headers: {
          type: "object",
          description:
            'Optional HTTP headers as key-value pairs (e.g. {"Authorization": "Bearer token123"}).',
        },
        body: {
          type: "string",
          description:
            "Optional request body as a string (JSON, XML, form data, etc.).",
        },
        assertions: {
          type: "array",
          description:
            "Optional array of assertions to validate the response.",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                description:
                  "Assertion type: status_code, response_time, jsonpath, contains, header, schema, regex, equals.",
              },
              target: {
                type: "string",
                description:
                  'What to check (e.g. "$.data.id" for JSONPath, "Content-Type" for header).',
              },
              operator: {
                type: "string",
                description:
                  "Comparison operator: equals, not_equals, contains, greater_than, less_than, matches, exists.",
              },
              expected: {
                type: "string",
                description: "Expected value to compare against.",
              },
            },
          },
        },
      },
      required: ["method", "url"],
    },
  },
];

/**
 * Execute an API testing tool and return a text result.
 */
export async function handleApiTestingTool(
  toolName: string,
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  switch (toolName) {
    case "flowstral_run_api_test":
      return handleRunApiTest(args, client);
    default:
      throw new Error(`Unknown API testing tool: ${toolName}`);
  }
}

async function handleRunApiTest(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const method = args.method as string;
  const url = args.url as string;

  if (!method || !url) {
    return "Error: both method and url are required.";
  }

  const request: Record<string, unknown> = {
    method: method.toUpperCase(),
    url,
  };

  if (args.headers) request.headers = args.headers;
  if (args.body) request.body = args.body;
  if (args.assertions) request.assertions = args.assertions;

  const result = await client.executeApiTest(request);

  const statusCode = result.status_code as number;
  const responseTime = result.response_time as number;
  const responseBody = result.response_body || result.body;
  const assertions = result.assertion_results as unknown[] | undefined;

  const lines: string[] = [
    `## API Test Result: ${method.toUpperCase()} ${url}`,
    "",
    `- **Status Code:** ${statusCode ?? "N/A"}`,
  ];

  if (responseTime !== undefined) {
    lines.push(`- **Response Time:** ${responseTime}ms`);
  }

  if (result.content_type) {
    lines.push(`- **Content-Type:** ${result.content_type}`);
  }

  // Assertion results
  if (assertions && assertions.length > 0) {
    const passed = assertions.filter(
      (a) => (a as Record<string, unknown>).passed
    ).length;
    const failed = assertions.length - passed;

    lines.push(
      "",
      `### Assertions: ${passed} passed, ${failed} failed`,
      ""
    );

    assertions.forEach((a) => {
      const assertion = a as Record<string, unknown>;
      const status = assertion.passed ? "PASS" : "FAIL";
      lines.push(
        `- [${status}] ${assertion.type || "check"}: ${assertion.message || assertion.description || ""}`
      );
      if (!assertion.passed && assertion.actual !== undefined) {
        lines.push(`  Expected: ${assertion.expected}, Got: ${assertion.actual}`);
      }
    });
  }

  // Response body preview
  if (responseBody) {
    const bodyStr =
      typeof responseBody === "string"
        ? responseBody
        : JSON.stringify(responseBody, null, 2);
    const preview = bodyStr.length > 2000 ? bodyStr.slice(0, 2000) + "\n..." : bodyStr;
    lines.push("", "### Response Body Preview", "```", preview, "```");
  }

  return lines.join("\n");
}
