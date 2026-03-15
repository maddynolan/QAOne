# Flowstral - AI QA Platform for VS Code

Integrate the Flowstral enterprise QA automation platform directly into VS Code. Run tests, generate AI-powered tests, scan for accessibility issues, and explore applications without leaving your editor.

## Features

### Sidebar Panel

The Flowstral activity bar icon opens three tree views:

- **Test Cases** -- Browse all test cases organized by folder. Run any test with a single click using the inline play button.
- **Recent Runs** -- View the last 20 test executions with pass/fail status, duration, and timestamps. Click any run to see detailed results in a webview panel.
- **Defects** -- Browse defects grouped by severity (Critical, High, Medium, Low) with status information.

### Commands

Access all commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`):

| Command | Shortcut | Description |
|---------|----------|-------------|
| `Flowstral: Run Test Case` | | Select and execute a test case from your project |
| `Flowstral: AI Generate Test` | `Ctrl+Shift+T` | Describe a test in natural language and let AI generate and execute it |
| `Flowstral: Scan Accessibility` | | Run a WCAG accessibility scan on any URL |
| `Flowstral: Explore Application` | | Autonomously crawl and discover pages, forms, and defects |
| `Flowstral: Run API Test` | | Execute a quick API test with method, URL, and optional body |
| `Flowstral: Open Dashboard` | | Open the Flowstral web dashboard in your browser |
| `Flowstral: Configure` | | Set API key, open settings, or test connection |
| `Flowstral: Refresh` | | Refresh all sidebar data |

### Results Webview

Test results, accessibility scans, API tests, and exploration results open in a rich webview panel with:

- Status badges and summary cards
- Step-by-step execution details with pass/fail indicators
- Error messages and expected vs actual comparisons
- Inline screenshots from test execution
- Accessibility issues table with severity, rule, and suggested fixes
- Discovered pages, defects, and forms from exploration
- API response headers, body, and assertion results

### Status Bar

A status bar item shows your current test pass rate (e.g., `Flowstral: 142/150`). The color indicates health:

- **Green** -- Pass rate above 90%
- **Yellow** -- Pass rate between 70-90%
- **Red** -- Pass rate below 70%

Click it to open the Flowstral dashboard.

## Installation

1. Install the extension from the VS Code Marketplace or from a `.vsix` file
2. Open the Command Palette and run `Flowstral: Configure`
3. Enter your Flowstral API key when prompted
4. (Optional) Set your API URL and Project ID in Settings

## Configuration

Open VS Code Settings (`Ctrl+,`) and search for "Flowstral":

| Setting | Default | Description |
|---------|---------|-------------|
| `flowstral.apiUrl` | `https://api.flowstral.com` | URL of your Flowstral API server |
| `flowstral.projectId` | (empty) | Default project ID for filtering test cases |
| `flowstral.autoRefresh` | `true` | Automatically refresh sidebar data periodically |
| `flowstral.refreshInterval` | `30` | Auto-refresh interval in seconds |

### API Key

Your API key is stored securely using VS Code's built-in SecretStorage (OS keychain). It is never written to settings files or logs.

To update your API key:
1. Run `Flowstral: Configure` from the Command Palette
2. Select "Set API Key"
3. Enter your new key

## Requirements

- **Flowstral backend** must be running and accessible from your machine
- An API key with appropriate permissions for your project
- VS Code 1.85.0 or later

## For Self-Hosted / On-Premises Users

If running Flowstral on-premises or locally:

1. Set `flowstral.apiUrl` to your server address (e.g., `http://localhost:8000`)
2. Ensure network connectivity between VS Code and the Flowstral server

## Development

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch for changes
npm run watch

# Package as .vsix
npm run package
```

## License

Proprietary. Part of the Flowstral QA Platform.
