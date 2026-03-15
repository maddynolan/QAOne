#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { FlowstralApiClient, FlowstralApiError } from "./client.js";
import {
  testingToolDefinitions,
  handleTestingTool,
} from "./tools/testing.js";
import {
  scanningToolDefinitions,
  handleScanningTool,
} from "./tools/scanning.js";
import {
  apiTestingToolDefinitions,
  handleApiTestingTool,
} from "./tools/api-testing.js";
import {
  reportingToolDefinitions,
  handleReportingTool,
} from "./tools/reporting.js";
import { resourceTemplates, readResource } from "./resources/index.js";

// ---------------------------------------------------------------------------
// Configuration from environment
// ---------------------------------------------------------------------------

const FLOWSTRAL_API_URL =
  process.env.FLOWSTRAL_API_URL || "http://localhost:8000";
const FLOWSTRAL_API_KEY = process.env.FLOWSTRAL_API_KEY || "";
const FLOWSTRAL_PROJECT_ID = process.env.FLOWSTRAL_PROJECT_ID || "";

// ---------------------------------------------------------------------------
// Combine all tool definitions
// ---------------------------------------------------------------------------

const allToolDefinitions = [
  ...testingToolDefinitions,
  ...scanningToolDefinitions,
  ...apiTestingToolDefinitions,
  ...reportingToolDefinitions,
];

// Map tool names to their handler module
const testingToolNames = new Set(testingToolDefinitions.map((t) => t.name));
const scanningToolNames = new Set(scanningToolDefinitions.map((t) => t.name));
const apiTestingToolNames = new Set(
  apiTestingToolDefinitions.map((t) => t.name)
);
const reportingToolNames = new Set(
  reportingToolDefinitions.map((t) => t.name)
);

// ---------------------------------------------------------------------------
// Create API client and MCP server
// ---------------------------------------------------------------------------

const client = new FlowstralApiClient({
  baseUrl: FLOWSTRAL_API_URL,
  apiKey: FLOWSTRAL_API_KEY || undefined,
});

const server = new Server(
  {
    name: "flowstral",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: allToolDefinitions.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const args = (request.params.arguments || {}) as Record<string, unknown>;

  // Inject default project_id if not provided and env var is set
  if (
    FLOWSTRAL_PROJECT_ID &&
    args.project_id === undefined &&
    "project_id" in
      (allToolDefinitions.find((t) => t.name === toolName)?.inputSchema
        .properties || {})
  ) {
    args.project_id = FLOWSTRAL_PROJECT_ID;
  }

  try {
    let resultText: string;

    if (testingToolNames.has(toolName)) {
      resultText = await handleTestingTool(toolName, args, client);
    } else if (scanningToolNames.has(toolName)) {
      resultText = await handleScanningTool(toolName, args, client);
    } else if (apiTestingToolNames.has(toolName)) {
      resultText = await handleApiTestingTool(toolName, args, client);
    } else if (reportingToolNames.has(toolName)) {
      resultText = await handleReportingTool(toolName, args, client);
    } else {
      return {
        content: [
          {
            type: "text" as const,
            text: `Unknown tool: ${toolName}. Available tools: ${allToolDefinitions.map((t) => t.name).join(", ")}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [{ type: "text" as const, text: resultText }],
    };
  } catch (err) {
    const message = formatError(err);
    return {
      content: [{ type: "text" as const, text: message }],
      isError: true,
    };
  }
});

// ---------------------------------------------------------------------------
// Resource handlers
// ---------------------------------------------------------------------------

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: resourceTemplates.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

  try {
    const result = await readResource(uri, client);
    return {
      contents: [
        {
          uri: result.uri,
          mimeType: result.mimeType,
          text: result.text,
        },
      ],
    };
  } catch (err) {
    throw new Error(
      `Failed to read resource ${uri}: ${err instanceof Error ? err.message : String(err)}`
    );
  }
});

// ---------------------------------------------------------------------------
// Error formatting
// ---------------------------------------------------------------------------

function formatError(err: unknown): string {
  if (err instanceof FlowstralApiError) {
    return `Flowstral API Error: ${err.message}`;
  }
  if (err instanceof Error) {
    return `Error: ${err.message}`;
  }
  return `Error: ${String(err)}`;
}

// ---------------------------------------------------------------------------
// Start the server
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it does not interfere with the MCP JSON-RPC stdio channel
  process.stderr.write(
    `Flowstral MCP Server v1.0.0 started\n` +
      `  API URL: ${FLOWSTRAL_API_URL}\n` +
      `  API Key: ${FLOWSTRAL_API_KEY ? "configured" : "not set"}\n` +
      `  Default Project: ${FLOWSTRAL_PROJECT_ID || "none"}\n`
  );
}

main().catch((err) => {
  process.stderr.write(`Fatal error starting Flowstral MCP server: ${err}\n`);
  process.exit(1);
});
