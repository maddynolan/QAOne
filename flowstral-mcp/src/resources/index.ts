import type { FlowstralApiClient } from "../client.js";

/**
 * MCP resource definition (for ListResources response).
 */
export interface ResourceDefinition {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

/**
 * Defines the static resources exposed by the Flowstral MCP server.
 *
 * These use URI templates that the client can fill in with parameters.
 * The resources are listed as templates; actual reading resolves the template.
 */
export const resourceTemplates: ResourceDefinition[] = [
  {
    uri: "flowstral://test-cases/{project_id}",
    name: "Test Cases",
    description:
      "JSON list of all test cases for a project. Replace {project_id} with the target project ID.",
    mimeType: "application/json",
  },
  {
    uri: "flowstral://test-runs/{run_id}",
    name: "Test Run Details",
    description:
      "Full JSON details of a specific test run including per-step results, screenshots, and timing. Replace {run_id} with the test run ID.",
    mimeType: "application/json",
  },
  {
    uri: "flowstral://dashboard/{project_id}",
    name: "Dashboard Metrics",
    description:
      "Project health dashboard metrics as JSON including pass rate, test count, defect summary, and coverage. Replace {project_id} with the project ID.",
    mimeType: "application/json",
  },
];

/**
 * Read the contents of a Flowstral resource by its URI.
 *
 * Parses the URI template pattern and fetches the corresponding data from
 * the Flowstral API.
 */
export async function readResource(
  uri: string,
  client: FlowstralApiClient
): Promise<{ uri: string; mimeType: string; text: string }> {
  const parsed = parseFlowstralUri(uri);

  if (!parsed) {
    throw new Error(
      `Invalid Flowstral resource URI: ${uri}. Expected format: flowstral://<resource-type>/<id>`
    );
  }

  let data: unknown;

  switch (parsed.type) {
    case "test-cases": {
      data = await client.listTestCases(parsed.id);
      break;
    }
    case "test-runs": {
      data = await client.getTestRun(parsed.id);
      break;
    }
    case "dashboard": {
      data = await client.getDashboard(parsed.id);
      break;
    }
    default:
      throw new Error(`Unknown resource type: ${parsed.type}`);
  }

  return {
    uri,
    mimeType: "application/json",
    text: JSON.stringify(data, null, 2),
  };
}

/**
 * Parse a flowstral:// URI into its component parts.
 */
function parseFlowstralUri(
  uri: string
): { type: string; id: string } | null {
  const match = uri.match(/^flowstral:\/\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}
