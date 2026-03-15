# Flowstral MCP Server

An MCP (Model Context Protocol) server that exposes the **Flowstral QA automation platform** as tools for AI assistants. Connect Claude Desktop, Cursor, or any MCP-compatible client to run tests, generate AI-powered browser tests, scan for accessibility issues, execute API tests, and view project health -- all through natural language.

## What is Flowstral?

Flowstral is an enterprise QA automation platform that combines browser recording, AI-powered test generation, multi-protocol API testing, performance/load testing, accessibility scanning, visual regression, and mobile testing into a unified product. It runs on a FastAPI backend with a React frontend and supports both SaaS and on-premise deployment.

## Quick Start

### 1. Install and build

```bash
cd flowstral-mcp
npm install
npm run build
```

### 2. Configure Claude Desktop

Add this to your Claude Desktop config file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "flowstral": {
      "command": "node",
      "args": ["/absolute/path/to/flowstral-mcp/dist/index.js"],
      "env": {
        "FLOWSTRAL_API_URL": "http://localhost:8000",
        "FLOWSTRAL_API_KEY": "your-api-key-here",
        "FLOWSTRAL_PROJECT_ID": "optional-default-project-id"
      }
    }
  }
}
```

### 3. Start using

Once connected, ask Claude things like:

- "List all test cases in my project"
- "Run the login test case"
- "Generate a test that verifies the checkout flow on https://myapp.com"
- "Scan https://myapp.com for accessibility issues"
- "Show me the project dashboard metrics"

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FLOWSTRAL_API_URL` | No | `http://localhost:8000` | Base URL of the Flowstral backend API |
| `FLOWSTRAL_API_KEY` | No | (none) | API key for authentication (Bearer token) |
| `FLOWSTRAL_PROJECT_ID` | No | (none) | Default project ID auto-injected into tool calls when not specified |

## Tools (10)

### Test Management

#### `flowstral_list_tests`
List test cases from the platform with optional filters.

```json
{
  "project_id": "proj-123",
  "folder": "regression",
  "limit": 20
}
```

#### `flowstral_run_test`
Run a saved test case by ID. Starts Playwright browser automation, waits for completion, and returns results.

```json
{
  "test_case_id": "tc-456"
}
```

#### `flowstral_ai_generate_test`
Generate and execute an AI-powered browser test from natural language. The AI agent navigates to the URL, plans steps, executes them in a real browser, and self-heals broken selectors.

```json
{
  "instruction": "Log in with user@example.com / password123 and verify the dashboard shows a welcome message",
  "target_url": "https://myapp.com/login"
}
```

#### `flowstral_get_results`
Get detailed results for a specific test run.

```json
{
  "run_id": "run-789"
}
```

### Scanning

#### `flowstral_scan_accessibility`
Run a WCAG accessibility scan using axe-core. Returns violations grouped by severity with suggested fixes.

```json
{
  "url": "https://myapp.com",
  "level": "AA"
}
```

#### `flowstral_explore_app`
Autonomously crawl a web application to discover pages, forms, and defects. Uses the Blaze explorer (no AI/LLM required).

```json
{
  "url": "https://myapp.com",
  "max_pages": 30
}
```

#### `flowstral_visual_compare`
Compare two images for visual regression. Supports 6 comparison modes.

```json
{
  "baseline_image": "<base64-encoded-image>",
  "actual_image": "<base64-encoded-image>",
  "mode": "anti_aliased",
  "threshold": 0.1
}
```

### API Testing

#### `flowstral_run_api_test`
Execute an API test with optional assertions. Supports REST, GraphQL, SOAP, and more.

```json
{
  "method": "POST",
  "url": "https://api.example.com/users",
  "headers": { "Content-Type": "application/json" },
  "body": "{\"name\": \"John\", \"email\": \"john@example.com\"}",
  "assertions": [
    { "type": "status_code", "operator": "equals", "expected": "201" },
    { "type": "response_time", "operator": "less_than", "expected": "2000" },
    { "type": "jsonpath", "target": "$.id", "operator": "exists" }
  ]
}
```

### Reporting

#### `flowstral_get_defects`
List tracked defects with optional severity and status filters.

```json
{
  "project_id": "proj-123",
  "severity": "critical",
  "status": "open"
}
```

#### `flowstral_get_dashboard`
Get project health metrics: pass rate, test counts, defect summary, coverage.

```json
{
  "project_id": "proj-123"
}
```

## Resources (3)

MCP resources provide read-only access to Flowstral data as JSON:

| URI Template | Description |
|---|---|
| `flowstral://test-cases/{project_id}` | JSON list of all test cases for a project |
| `flowstral://test-runs/{run_id}` | Full test run details with step-level results |
| `flowstral://dashboard/{project_id}` | Project health dashboard metrics |

## Architecture

```
flowstral-mcp/
  src/
    index.ts           # MCP server entry point (stdio transport)
    client.ts          # FlowstralApiClient - HTTP + SSE client
    tools/
      testing.ts       # Test list, run, AI generate, results (4 tools)
      scanning.ts      # Accessibility, exploration, visual (3 tools)
      api-testing.ts   # API test execution (1 tool)
      reporting.ts     # Defects, dashboard (2 tools)
    resources/
      index.ts         # MCP resource handlers (3 resources)
```

The server communicates with the Flowstral backend API over HTTP/HTTPS and exposes capabilities through the MCP stdio protocol.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run directly (for testing)
npm start

# Development with ts-node
npm run dev
```

## Troubleshooting

### "Cannot connect to Flowstral API"
- Verify `FLOWSTRAL_API_URL` points to a running Flowstral backend
- For local development: `FLOWSTRAL_API_URL=http://localhost:8000`
- Check that the backend is accessible: `curl http://localhost:8000/health`

### "Authentication failed"
- Set `FLOWSTRAL_API_KEY` to a valid API key
- The key is sent as a Bearer token in the Authorization header
- Check the key has not expired and has appropriate permissions

### "Unknown tool" errors
- Ensure you are using the exact tool names (e.g., `flowstral_run_test`, not `run_test`)
- Run `npm run build` after any source changes

### AI test generation times out
- The AI test generation endpoint streams results via SSE and has a 5-minute timeout
- Complex tests on slow applications may need the Flowstral backend timeout increased
- Check the Flowstral backend logs for errors during AI test execution

## License

Proprietary - Flowstral/QAAI Platform
