# QAAI/ArisTrace User Manual

> **Complete User Guide**  
> From First Test to Production Deployment  
> Version 3.0 | Last Updated: January 11, 2026

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Recording Your First Test](#recording-your-first-test)
3. [Building Tests Manually](#building-tests-manually)
4. [Running Tests](#running-tests)
5. [API Testing](#api-testing)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [Visual Testing](#visual-testing)
9. [Salesforce Testing](#salesforce-testing)
10. [AI Features](#ai-features)
11. [Test Management](#test-management)
12. [Integrations](#integrations)
13. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- **Node.js** 18+ 
- **Python** 3.10+
- **Chrome** browser (for recording extension)

### Quick Start (5 Minutes)

```bash
# 1. Start Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 2. Start Frontend (new terminal)
npm install
npm run dev

# 3. Open Browser
# Frontend: http://localhost:8080
# API Docs: http://localhost:8000/docs
```

### Install Browser Extension

1. Open Chrome → `chrome://extensions`
2. Enable "Developer mode" (top-right toggle)
3. Click "Load unpacked"
4. Select the `flowstral-extension` folder
5. Pin the extension to your toolbar

---

## Recording Your First Test

### Step 1: Start Recording

1. Navigate to your test website
2. Click the **Flowstral** extension icon in Chrome toolbar
3. Click **Start Recording**
4. The sidepanel opens showing recording status

### Step 2: Perform Actions

Perform your test scenario. The recorder captures:

| Action | Captured As |
|--------|-------------|
| Click | Click step with selector |
| Type text | Input step with value |
| Navigate | Navigate step with URL |
| Scroll | Scroll step with position |
| Select dropdown | Select step with value |

### Step 3: Stop and Edit

1. Click **Stop Recording**
2. Click **Open in Workflow Editor**
3. Review captured steps
4. Edit selectors or add assertions

### Step 4: Save Test Case

1. Click **Save Test Case**
2. Enter a name and description
3. Set priority and tags
4. Click **Save**

---

## Building Tests Manually

### Using the Visual Builder

1. Navigate to **Test Cases → Builder**
2. Click **Add Step**
3. Choose step type:
   - **Navigate** - Go to URL
   - **Click** - Click element
   - **Input** - Enter text
   - **Wait** - Wait for time/element
   - **Assert** - Verify condition
   - **API** - Make API call
   - **Database** - Execute query

### Step Configuration

For each step, configure:

| Field | Description |
|-------|-------------|
| **Target** | Human-readable description |
| **Selector** | Technical CSS/XPath selector |
| **Value** | Input value or expected result |
| **Expected Result** | What should happen |

### Adding Assertions

1. Click **Add Step** → **Assert**
2. Choose assertion type:

| Type | Description |
|------|-------------|
| `element_visible` | Element is visible |
| `element_hidden` | Element is hidden |
| `text_equals` | Text exactly matches |
| `text_contains` | Text contains substring |
| `url_equals` | URL matches |
| `url_contains` | URL contains |
| `title_equals` | Page title matches |
| `element_count` | Number of elements |
| `value_equals` | Input value matches |
| `checked` | Checkbox is checked |

### Using Variables

1. Open **Variable Store** panel
2. Add variables:
   ```
   {{username}} = testuser@example.com
   {{password}} = Test123!
   ```
3. Use in steps: `Input: {{username}}`

### Importing Preconditions

1. Click **Import Test Case**
2. Select existing test to use as setup
3. Precondition runs before main test

---

## Running Tests

### Single Test Execution

1. Open test case in Builder
2. Click **Run** button
3. Watch real-time progress:
   - Green checkmarks = passed steps
   - Red X = failed steps
   - Yellow = self-healed selectors

### Batch Execution

1. Navigate to **Test Suites**
2. Create or select a suite
3. Click **Run All**
4. View results in **Test Runs**

### Execution Options

| Option | Description |
|--------|-------------|
| **Browser** | Chromium, Firefox, WebKit |
| **Headed/Headless** | Show browser or run hidden |
| **Parallel** | Run tests concurrently |
| **Environment** | Dev, Staging, Production |

### Self-Healing

When a selector fails, QAAI automatically:

1. Detects the failure pattern
2. Applies healing strategies:
   - AI-based regeneration
   - Text-based fallback
   - Role-based fallback
   - Attribute matching
3. Retries with healed selector
4. Updates the test case

---

## API Testing

### Creating API Tests

1. Navigate to **API Testing**
2. Click **New Request**
3. Configure request:

| Field | Description |
|-------|-------------|
| **Method** | GET, POST, PUT, DELETE, PATCH |
| **URL** | API endpoint |
| **Headers** | Request headers |
| **Body** | Request body (JSON, XML, Form) |
| **Auth** | Basic, Bearer, OAuth2 |

### Request Chaining

1. Create multiple requests in sequence
2. Use property transfer:
   ```
   Step 1: POST /login → Extract token
   Step 2: GET /profile (use {{token}})
   ```

### Assertions

Add response assertions:

| Type | Example |
|------|---------|
| Status code | `200 OK` |
| JSONPath | `$.data.id == "123"` |
| Response time | `< 500ms` |
| Header | `Content-Type: application/json` |

### Import Specifications

1. Click **Import**
2. Upload OpenAPI/Swagger spec
3. Tests auto-generated for all endpoints

### Supported Protocols

- REST
- SOAP (WSDL import)
- GraphQL (queries, mutations)
- gRPC (protobuf)
- Kafka (producer/consumer)
- MQTT (pub/sub)
- WebSocket

---

## Performance Testing

### Creating Load Tests

1. Navigate to **Performance**
2. Click **New Scenario**
3. Add HTTP requests or import from Flowstral

### Load Patterns

| Pattern | Use Case |
|---------|----------|
| **Constant** | Steady baseline |
| **Ramp Up** | Gradual user increase |
| **Ramp Down** | Graceful decrease |
| **Spike** | Sudden traffic burst |
| **Stress** | Beyond normal capacity |
| **Soak** | Extended duration (memory leaks) |
| **Breakpoint** | Find system limits |
| **Wave** | Cyclic load |

### Configuration

```yaml
Virtual Users: 100
Duration: 5 minutes
Ramp Up: 1 minute
Think Time: 1-3 seconds
```

### User Personas

| Persona | Behavior |
|---------|----------|
| **Casual** | Slow, exploratory |
| **Normal** | Average interaction |
| **Power** | Fast, experienced |
| **Bot** | Machine speed |

### Metrics

- Response time (avg, p50, p95, p99)
- Throughput (requests/sec)
- Error rate
- Active users
- Resource utilization

---

## Accessibility Testing

### Running Scans

1. Navigate to **Accessibility**
2. Enter URL to scan
3. Select scan type:
   - **Full Page** - Entire page
   - **Component** - Specific element
   - **Site Audit** - Multiple pages

### WCAG Standards

| Standard | Levels |
|----------|--------|
| WCAG 2.0 | A, AA, AAA |
| WCAG 2.1 | A, AA, AAA |
| Section 508 | Full |

### Understanding Results

Violations categorized by:

| Severity | Description |
|----------|-------------|
| **Critical** | Blocks access |
| **Serious** | Major barriers |
| **Moderate** | Some difficulty |
| **Minor** | Best practice |

### VPAT Generation

1. Run site-wide audit
2. Click **Generate VPAT**
3. Download compliance document

---

## Visual Testing

### Creating Baselines

1. Navigate to **Visual Testing**
2. Click **Capture Baseline**
3. Enter test name and URL
4. Screenshot saved as baseline

### Running Comparisons

1. Select baseline
2. Click **Compare**
3. Enter actual URL or upload image
4. View diff results

### Comparison Modes

| Mode | Best For |
|------|----------|
| **Pixel Perfect** | Exact match required |
| **Anti-Aliased** | Font rendering tolerance |
| **Perceptual** | Minor changes OK |
| **Structural** | Layout focus |
| **Layout** | Ignore content changes |

### Ignore Regions

Mark areas to ignore (timestamps, ads):

```json
{
  "x": 10,
  "y": 10,
  "width": 100,
  "height": 50,
  "reason": "timestamp"
}
```

---

## Salesforce Testing

### Connecting Your Org

1. Navigate to **Salesforce Tools**
2. Click **Connect via OAuth**
3. Log in to your Salesforce org
4. Authorize the connected app

### Multi-Org Management

1. Add multiple orgs (Dev, QA, Prod)
2. Color-code for visual distinction
3. Switch orgs in one click

### Available Tools

| Tool | Usage |
|------|-------|
| **SOQL Builder** | Visual query building |
| **Schema Browser** | Explore objects/fields |
| **Test Data Factory** | Generate realistic data |
| **Apex Test Runner** | Run and monitor tests |
| **Debug Log Analyzer** | Parse log files |
| **Record Cloner** | Deep clone records |
| **Permission Analyzer** | Check user access |

### Running Apex Tests

1. Go to **Apex Test Runner** tab
2. Select test classes
3. Click **Run Tests**
4. View results and code coverage

### Smart Recording for Salesforce

The recorder has optimized selectors for:
- Lightning components
- LWC elements
- Classic UI
- Process Builder
- Flows

---

## AI Features

### Test Generation from Requirements

1. Navigate to **Test Cases → Create**
2. Enter natural language requirement:
   ```
   User should be able to login with valid credentials
   and see their dashboard with profile information
   ```
3. Click **Generate with AI**
4. Review generated steps
5. Edit and save

### AI Test Improvement

1. Open existing test case
2. Click **Improve with AI**
3. Select improvement type:
   - Add assertions
   - Handle edge cases
   - Improve selectors
   - Add data variations

### Configuring AI

1. Navigate to **Settings → AI**
2. Choose provider:
   - Anthropic Claude (cloud)
   - Ollama (local)
   - OpenAI (cloud)
3. Enter API key
4. Select model

### AI Agents

Specialized agents for:

| Agent | Purpose |
|-------|---------|
| Test Design | Create test strategies |
| Requirements | Parse requirements |
| Defect | Triage bugs |
| Performance | Analyze results |
| Security | Review findings |
| Accessibility | WCAG guidance |

---

## Test Management

### Test Cases

- Create, edit, clone, delete
- Organize by type, priority, tags
- Link to requirements
- Track execution history

### Test Suites

- Group related test cases
- Configure execution order
- Set suite-level variables
- Run as batch

### Test Plans

- Release-based planning
- Assign test cases to cycles
- Track progress and coverage
- Schedule automated runs

### Test Runs

- View execution history
- Analyze pass/fail trends
- Review self-healing events
- Export reports

### Traceability

View the complete matrix:
```
Requirements → Test Plans → Test Cases → Test Runs → Defects
```

Coverage metrics:
- Requirements without tests (gaps)
- Tests without requirements (orphans)
- Requirements with failing tests (risks)

---

## Integrations

### CI/CD Pipelines

Export configurations for:

| Platform | Format |
|----------|--------|
| GitHub Actions | YAML |
| GitLab CI | YAML |
| Jenkins | Groovy |
| Azure DevOps | YAML |
| CircleCI | YAML |

### Issue Trackers

| Platform | Features |
|----------|----------|
| Jira | Create/link issues |
| Azure Boards | Work item sync |
| GitHub Issues | Auto-create |

### Documentation

- Confluence integration
- Markdown export
- ISTQB format
- Gherkin/BDD

### Notifications

- Slack alerts
- Teams messages
- Email notifications

---

## Troubleshooting

### Backend Won't Start

```bash
# Check Python version
python --version  # Should be 3.10+

# Install dependencies
pip install -r requirements.txt

# Check for port conflicts
netstat -an | findstr 8000
```

### Extension Not Recording

1. Refresh the target page
2. Reload extension in `chrome://extensions`
3. Check console for errors
4. Verify backend is running

### Tests Failing

1. Check **Test Runs** for error details
2. Review screenshots on failure
3. Check backend logs:
   ```powershell
   Get-Content backend\logs\app.log -Tail 100
   ```

### WebSocket Disconnecting

1. Verify backend is running on port 8000
2. Check firewall settings
3. Ensure no proxy blocking WebSocket

### Self-Healing Not Working

1. Enable in **Settings → Execution**
2. Check if AI provider is configured
3. Verify LLM is accessible

### Salesforce Connection Failed

1. Check OAuth credentials
2. Verify connected app permissions
3. Re-authenticate via OAuth flow

### Common Errors

| Error | Solution |
|-------|----------|
| "Element not found" | Selector changed - run self-healing |
| "Timeout exceeded" | Increase wait time or check page load |
| "Connection refused" | Start backend server |
| "Unauthorized" | Check API keys |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save test case |
| `Ctrl+R` | Run test |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Delete` | Remove selected step |
| `Ctrl+D` | Duplicate step |
| `Ctrl+↑/↓` | Move step up/down |

---

## Best Practices

### Test Design

1. **Keep tests atomic** - One scenario per test
2. **Use meaningful names** - Describe what's being tested
3. **Add assertions** - Verify expected outcomes
4. **Handle setup/teardown** - Use preconditions
5. **Use variables** - Avoid hardcoded values

### Selectors

1. **Prefer data-testid** - Most stable
2. **Use role-based selectors** - Accessible and stable
3. **Avoid indexes** - `nth(0)` breaks easily
4. **Combine strategies** - Text + role + attribute

### Execution

1. **Run in headed mode** - Debug failures visually
2. **Use screenshots** - Document failures
3. **Monitor self-healing** - Review healed selectors
4. **Schedule regularly** - Catch regressions early

### Maintenance

1. **Review test results** - Address failures promptly
2. **Update baselines** - When UI changes intentionally
3. **Clean up unused tests** - Keep repository organized
4. **Document changes** - Track test modifications

---

## Quick Reference

### URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:8080 |
| Backend | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |

### Default Ports

| Service | Port |
|---------|------|
| Frontend (Vite) | 8080 |
| Backend (FastAPI) | 8000 |
| Ollama | 11434 |

### File Locations

| Item | Path |
|------|------|
| Backend logs | `backend/logs/app.log` |
| Database | `backend/qa_platform.db` |
| Screenshots | `backend/screenshots/` |
| Extension | `flowstral-extension/` |

---

## Getting Help

- **Documentation**: `/docs` folder
- **API Reference**: `http://localhost:8000/docs`
- **Logs**: `backend/logs/app.log`
- **Community**: GitHub Issues

---

*Last updated: January 11, 2026*
