import type { FlowstralApiClient } from "../client.js";
import type { ToolDefinition } from "./testing.js";

/**
 * Tool definitions for scanning operations (accessibility, exploration, visual regression).
 */
export const scanningToolDefinitions: ToolDefinition[] = [
  {
    name: "flowstral_scan_accessibility",
    description:
      "Run a WCAG accessibility scan on a URL using axe-core. Returns a summary of violations by severity (critical, serious, moderate, minor) and detailed issue descriptions with suggested fixes and WCAG criteria references.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description:
            "The URL to scan for accessibility issues (e.g. https://myapp.com).",
        },
        level: {
          type: "string",
          description:
            'WCAG conformance level to scan against. One of "A", "AA", or "AAA". Defaults to "AA".',
          enum: ["A", "AA", "AAA"],
        },
      },
      required: ["url"],
    },
  },
  {
    name: "flowstral_explore_app",
    description:
      "Autonomously explore a web application by crawling pages, discovering links, detecting forms, and identifying potential defects. Uses the Blaze explorer engine which requires no AI/LLM dependency. Returns discovered pages, detected defects with severity, and form inventories.",
    inputSchema: {
      type: "object",
      properties: {
        url: {
          type: "string",
          description: "The starting URL to begin exploration from.",
        },
        max_pages: {
          type: "number",
          description:
            "Maximum number of pages to crawl. Defaults to 20. Higher values take longer but discover more.",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "flowstral_visual_compare",
    description:
      "Compare two images for visual regression differences. Supports 6 comparison modes: pixel_perfect, anti_aliased (recommended), perceptual, structural (SSIM), layout, and ai_semantic. Returns pass/fail, diff percentage, and mismatch region details.",
    inputSchema: {
      type: "object",
      properties: {
        baseline_image: {
          type: "string",
          description:
            "Base64-encoded baseline (expected) image for comparison.",
        },
        actual_image: {
          type: "string",
          description:
            "Base64-encoded actual (current) image to compare against the baseline.",
        },
        mode: {
          type: "string",
          description:
            'Comparison algorithm. Defaults to "anti_aliased".',
          enum: [
            "pixel_perfect",
            "anti_aliased",
            "perceptual",
            "structural",
            "layout",
            "ai_semantic",
          ],
        },
        threshold: {
          type: "number",
          description:
            "Allowed diff percentage before failing (0.0 to 100.0). Defaults to 0.1 (0.1%).",
        },
      },
      required: ["baseline_image", "actual_image"],
    },
  },
];

/**
 * Execute a scanning tool and return a text result for the MCP response.
 */
export async function handleScanningTool(
  toolName: string,
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  switch (toolName) {
    case "flowstral_scan_accessibility":
      return handleScanAccessibility(args, client);
    case "flowstral_explore_app":
      return handleExploreApp(args, client);
    case "flowstral_visual_compare":
      return handleVisualCompare(args, client);
    default:
      throw new Error(`Unknown scanning tool: ${toolName}`);
  }
}

async function handleScanAccessibility(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const url = args.url as string;
  if (!url) return "Error: url is required.";

  const result = await client.scanAccessibility(
    url,
    args.level as string | undefined
  );

  const summary = result.summary as Record<string, unknown> | undefined;
  const issues = (result.issues as unknown[]) || (result.violations as unknown[]) || [];

  const lines: string[] = [
    `## Accessibility Scan: ${url}`,
    "",
  ];

  if (summary) {
    lines.push(
      "### Summary",
      `- **Total issues:** ${summary.total ?? issues.length}`,
      `- Critical: ${summary.critical ?? 0}`,
      `- Serious: ${summary.serious ?? 0}`,
      `- Moderate: ${summary.moderate ?? 0}`,
      `- Minor: ${summary.minor ?? 0}`,
      ""
    );
  } else {
    lines.push(`### Total issues found: ${issues.length}`, "");
  }

  if (issues.length > 0) {
    lines.push("### Top Issues", "");

    // Show up to 15 most important issues
    const sorted = [...issues].sort((a, b) => {
      const severity: Record<string, number> = {
        critical: 0,
        serious: 1,
        moderate: 2,
        minor: 3,
      };
      const aImpact = ((a as Record<string, unknown>).impact as string) || "minor";
      const bImpact = ((b as Record<string, unknown>).impact as string) || "minor";
      return (severity[aImpact] ?? 4) - (severity[bImpact] ?? 4);
    });

    sorted.slice(0, 15).forEach((issue, i) => {
      const iss = issue as Record<string, unknown>;
      const impact = (iss.impact as string) || "unknown";
      const tag = impact.toUpperCase();
      lines.push(
        `${i + 1}. [${tag}] **${iss.rule || iss.id || "Unknown rule"}**`
      );
      if (iss.description) lines.push(`   ${iss.description}`);
      if (iss.wcag_criterion)
        lines.push(`   WCAG: ${iss.wcag_criterion}`);
      if (iss.suggested_fix) lines.push(`   Fix: ${iss.suggested_fix}`);
      if (iss.element)
        lines.push(`   Element: \`${String(iss.element).slice(0, 120)}\``);
    });

    if (issues.length > 15) {
      lines.push(
        "",
        `_...and ${issues.length - 15} more issues. Use the Flowstral dashboard for the full report._`
      );
    }
  } else {
    lines.push("No accessibility issues found. The page passes the selected WCAG level.");
  }

  return lines.join("\n");
}

async function handleExploreApp(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const url = args.url as string;
  if (!url) return "Error: url is required.";

  const result = await client.exploreApp(
    url,
    args.max_pages as number | undefined
  );

  const pages = (result.pages as unknown[]) || (result.discovered_pages as unknown[]) || [];
  const defects = (result.defects as unknown[]) || (result.issues as unknown[]) || [];
  const forms = (result.forms as unknown[]) || [];

  const lines: string[] = [
    `## App Exploration: ${url}`,
    "",
    `### Discovery`,
    `- **Pages found:** ${pages.length}`,
    `- **Defects detected:** ${defects.length}`,
    `- **Forms found:** ${forms.length}`,
    "",
  ];

  if (pages.length > 0) {
    lines.push("### Pages Discovered", "");
    pages.slice(0, 20).forEach((p) => {
      const page = p as Record<string, unknown>;
      lines.push(`- ${page.url || page.path || page.title || "Unknown page"}`);
    });
    if (pages.length > 20)
      lines.push(`  _...and ${pages.length - 20} more_`);
    lines.push("");
  }

  if (defects.length > 0) {
    lines.push("### Defects Found", "");
    defects.forEach((d, i) => {
      const defect = d as Record<string, unknown>;
      const severity = (defect.severity as string) || "medium";
      lines.push(
        `${i + 1}. [${severity.toUpperCase()}] ${defect.title || defect.description || defect.type || "Unknown defect"}`
      );
      if (defect.url || defect.page)
        lines.push(`   Page: ${defect.url || defect.page}`);
      if (defect.description && defect.title)
        lines.push(`   ${defect.description}`);
    });
    lines.push("");
  }

  if (forms.length > 0) {
    lines.push("### Forms Detected", "");
    forms.slice(0, 10).forEach((f) => {
      const form = f as Record<string, unknown>;
      lines.push(
        `- ${form.action || form.url || "Form"} (${(form.fields as unknown[])?.length || "?"} fields)`
      );
    });
  }

  return lines.join("\n");
}

async function handleVisualCompare(
  args: Record<string, unknown>,
  client: FlowstralApiClient
): Promise<string> {
  const baseline = args.baseline_image as string;
  const actual = args.actual_image as string;
  if (!baseline || !actual) {
    return "Error: both baseline_image and actual_image are required (base64-encoded).";
  }

  const result = await client.visualCompare(
    baseline,
    actual,
    args.mode as string | undefined,
    args.threshold as number | undefined
  );

  const passed = result.passed as boolean;
  const diffPct = result.diff_percentage as number;
  const mode = (result.mode as string) || (args.mode as string) || "anti_aliased";
  const threshold = result.threshold as number;

  const lines: string[] = [
    `## Visual Comparison: ${passed ? "PASSED" : "FAILED"}`,
    "",
    `- **Mode:** ${mode}`,
    `- **Diff:** ${diffPct !== undefined ? `${diffPct.toFixed(3)}%` : "N/A"}`,
  ];

  if (threshold !== undefined) {
    lines.push(`- **Threshold:** ${threshold}%`);
  }

  if (result.ssim_score !== undefined) {
    lines.push(
      `- **SSIM Score:** ${(result.ssim_score as number).toFixed(4)}`
    );
  }

  if (result.diff_pixel_count !== undefined) {
    lines.push(
      `- **Diff pixels:** ${result.diff_pixel_count} / ${result.total_pixels || "?"}`
    );
  }

  const regions = result.mismatch_regions as unknown[];
  if (regions && regions.length > 0) {
    lines.push("", "### Mismatch Regions:", "");
    regions.slice(0, 10).forEach((r, i) => {
      const region = r as Record<string, unknown>;
      lines.push(
        `${i + 1}. (${region.x}, ${region.y}) ${region.width}x${region.height}`
      );
    });
  }

  return lines.join("\n");
}
