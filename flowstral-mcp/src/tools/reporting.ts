import type { FlowstralApiClient } from "../client.js";
import type { ToolDefinition } from "./testing.js";

/**
 * Tool definitions for reporting and dashboard operations.
 */
export const reportingToolDefinitions: ToolDefinition[] = [
  {
    name: "flowstral_get_defects",
    description:
      "List defects (bugs) tracked in the Flowstral platform. Returns defect IDs, titles, severities, statuses, and assignees. Useful for understanding current quality issues in a project.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description:
            "Filter defects by project ID. If omitted, returns defects across all projects.",
        },
        severity: {
          type: "string",
          description:
            'Filter by severity level.',
          enum: ["critical", "high", "medium", "low"],
        },
        status: {
          type: "string",
          description:
            'Filter by defect status.',
          enum: ["open", "in_progress", "resolved", "closed", "reopened"],
        },
      },
    },
  },
  {
    name: "flowstral_get_dashboard",
    description:
      "Get project health metrics from the Flowstral dashboard. Returns pass rate, total test count, recent run history, defect counts by severity, and test coverage metrics. Provides a high-level overview of project quality.",
    inputSchema: {
      type: "object",
      properties: {
        project_id: {
          type: "string",
          description:
            "The project ID to get dashboard metrics for. If omitted, returns aggregate metrics.",
        },
      },
    },
  },
];

/**
 * Execute a reporting tool and return a text result.
 */
export async function handleReportingTool(
  toolName: string,
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  switch (toolName) {
    case "flowstral_get_defects":
      return handleGetDefects(args, client);
    case "flowstral_get_dashboard":
      return handleGetDashboard(args, client);
    default:
      throw new Error(`Unknown reporting tool: ${toolName}`);
  }
}

async function handleGetDefects(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const result = await client.getDefects(
    args.project_id as string | undefined,
    args.severity as string | undefined,
    args.status as string | undefined
  );

  const defects = Array.isArray(result)
    ? result
    : (result.defects as unknown[]) || (result.data as unknown[]) || [result];

  if (defects.length === 0) {
    return "No defects found matching the specified filters.";
  }

  // Group by severity for summary
  const bySeverity: Record<string, number> = {};
  defects.forEach((d) => {
    const sev = ((d as Record<string, unknown>).severity as string) || "unknown";
    bySeverity[sev] = (bySeverity[sev] || 0) + 1;
  });

  const lines: string[] = [
    `## Defects: ${defects.length} found`,
    "",
    "### By Severity",
  ];

  for (const [sev, count] of Object.entries(bySeverity).sort(
    (a, b) => severityOrder(a[0]) - severityOrder(b[0])
  )) {
    lines.push(`- **${sev}:** ${count}`);
  }

  lines.push("", "### Defect List", "");

  defects.slice(0, 25).forEach((d, i) => {
    const defect = d as Record<string, unknown>;
    const severity = (defect.severity as string) || "?";
    const status = (defect.status as string) || "?";
    lines.push(
      `${i + 1}. [${severity.toUpperCase()}] **${defect.title || defect.name || "Untitled"}** (ID: ${defect.id})`
    );
    lines.push(`   Status: ${status}`);
    if (defect.assignee) lines.push(`   Assignee: ${defect.assignee}`);
    if (defect.created_at) lines.push(`   Created: ${defect.created_at}`);
  });

  if (defects.length > 25) {
    lines.push(
      "",
      `_Showing first 25 of ${defects.length} defects._`
    );
  }

  return lines.join("\n");
}

async function handleGetDashboard(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const result = await client.getDashboard(
    args.project_id as string | undefined
  );

  const lines: string[] = ["## Project Dashboard", ""];

  // Pass rate
  if (result.pass_rate !== undefined) {
    const rate = result.pass_rate as number;
    lines.push(
      `### Pass Rate: ${typeof rate === "number" ? `${(rate * 100).toFixed(1)}%` : rate}`
    );
  }

  // Test counts
  if (result.total_tests !== undefined || result.test_count !== undefined) {
    lines.push(
      `- **Total tests:** ${result.total_tests || result.test_count}`
    );
  }
  if (result.total_runs !== undefined || result.run_count !== undefined) {
    lines.push(
      `- **Total runs:** ${result.total_runs || result.run_count}`
    );
  }

  // Defect summary
  const defectCounts = result.defect_counts as Record<string, unknown> | undefined;
  if (defectCounts) {
    lines.push("", "### Defect Counts");
    for (const [key, value] of Object.entries(defectCounts)) {
      lines.push(`- **${key}:** ${value}`);
    }
  } else if (result.defects_total !== undefined) {
    lines.push(`- **Open defects:** ${result.defects_total}`);
  }

  // Coverage
  if (result.coverage !== undefined) {
    const cov = result.coverage as Record<string, unknown> | number;
    if (typeof cov === "number") {
      lines.push(`- **Coverage:** ${(cov * 100).toFixed(1)}%`);
    } else if (typeof cov === "object") {
      lines.push("", "### Coverage");
      for (const [key, value] of Object.entries(cov)) {
        lines.push(`- **${key}:** ${value}`);
      }
    }
  }

  // Recent runs
  const recentRuns = (result.recent_runs as unknown[]) || (result.latest_runs as unknown[]);
  if (recentRuns && recentRuns.length > 0) {
    lines.push("", "### Recent Runs", "");
    recentRuns.slice(0, 10).forEach((r) => {
      const run = r as Record<string, unknown>;
      const status = (run.status as string) || "?";
      lines.push(
        `- [${status.toUpperCase()}] ${run.test_name || run.name || "Unknown"} (${run.created_at || run.timestamp || ""})`
      );
    });
  }

  // If we got a flat object with metrics, just dump the key values
  if (lines.length <= 2) {
    lines.push("### Metrics", "");
    for (const [key, value] of Object.entries(result)) {
      if (typeof value !== "object" || value === null) {
        lines.push(`- **${key}:** ${value}`);
      }
    }
  }

  return lines.join("\n");
}

function severityOrder(severity: string): number {
  const order: Record<string, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  return order[severity.toLowerCase()] ?? 4;
}
