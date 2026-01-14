# AI-Powered Features Documentation

## Overview

Flowstral includes advanced AI-powered test automation features that leverage OpenAI's GPT models to autonomously explore applications, execute goals, and generate test cases.

---

## 1. AI Flow Explorer v2.1

**Location:** Flow Map button in the recorder toolbar

### Features

- **Autonomous Page Discovery**: Automatically discovers all pages in your application
- **Element Detection**: Finds all interactive elements including hidden ones (dropdowns, menus)
- **Navigation Graph**: Builds a visual map of how pages connect
- **Smart Login Handling**: Detects login pages and fills credentials automatically
- **Popup/Tab Handling**: Automatically switches to new tabs/windows when links open them
- **iFrame Support**: Detects and explores elements inside iframes
- **Test Generation**: Creates runnable test cases from discovered flows

### How to Use

1. Start a recording session
2. Click "Flow Map" button
3. Go to "Navigation Graph" tab
4. Enter your test credentials
5. Set max pages to explore
6. Click "Start Exploration"

### Configuration

| Setting | Description | Default |
|---------|-------------|---------|
| Landing Page URL | Starting URL for exploration | Current page |
| Max Pages | Maximum pages to discover | 20 |
| Test Credentials | Email/password for login | Empty |

---

## 2. AI Goal Agent (NEW)

**Location:** Flow Map → Goal Agent tab

### What is it?

The Goal Agent is a truly **agentic AI** that takes a natural language goal and autonomously figures out how to achieve it. Unlike traditional exploration that randomly clicks around, the Goal Agent:

1. **Understands your objective**
2. **Analyzes the current page**
3. **Decides the best action** to get closer to the goal
4. **Executes actions** using your test data
5. **Continues until goal is achieved**

### Example Goals

```
"Create a new Opportunity named 'Q1 Deal' worth $50,000"

"Search for 'Test Account' and update the phone number to 555-1234"

"Navigate to Reports and export the Sales Pipeline report"

"Add a new Contact with email john@test.com and link to Test Account"

"Find and delete any lead named 'Test Lead'"

"Log in and verify the dashboard shows correct user name"
```

### How to Use

1. Start a recording session
2. Click "Flow Map" button
3. You'll be on the "Goal Agent" tab (first tab)
4. Enter your goal in plain English
5. Fill in test credentials (username, password)
6. Click "Execute Goal" (green button at bottom)
7. Watch as the AI works through steps to achieve your goal

### Test Data

The Goal Agent uses your configured test data for filling forms:

| Field | Usage |
|-------|-------|
| email/username | Login fields, email inputs |
| password | Password fields |
| firstName | First name fields |
| lastName | Last name fields |
| phone | Phone number fields |
| company | Company name fields |
| amount | Currency/amount fields |
| description | Description/notes fields |

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    AI Goal Agent                         │
├─────────────────────────────────────────────────────────┤
│  1. analyzeCurrentPage()                                │
│     - Get URL, title, headings                          │
│     - Find all interactive elements                     │
│     - Categorize elements (button, input, link, etc.)   │
├─────────────────────────────────────────────────────────┤
│  2. decideNextAction() [AI Call]                        │
│     - Send page state + goal to GPT                     │
│     - AI decides: click, fill, select, check, etc.      │
│     - AI specifies which element and what value         │
├─────────────────────────────────────────────────────────┤
│  3. executeAction()                                     │
│     - Perform the decided action                        │
│     - Handle popups/new tabs                            │
│     - Wait for page to stabilize                        │
├─────────────────────────────────────────────────────────┤
│  4. Loop until goal achieved or max steps               │
├─────────────────────────────────────────────────────────┤
│  5. generateTestCase()                                  │
│     - Convert steps to QWord format                     │
│     - Save as reusable test case                        │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Manual → Auto Converter

**Location:** Flow Map → Manual → Auto tab

### Features

Converts manual test case descriptions into automated test steps.

### How to Use

1. Enter manual test steps in plain English:
   ```
   1. Go to login page
   2. Enter username "admin@test.com"
   3. Enter password "Test123!"
   4. Click Login button
   5. Verify dashboard is displayed
   ```

2. Click "Convert to Automation"

3. Get automated steps in QWord format:
   ```
   GoTo: https://example.com/login
   Fill: username, admin@test.com
   Fill: password, Test123!
   ClickText: Login
   AssertText: Dashboard
   ```

---

## Technical Details

### Files

| File | Description |
|------|-------------|
| `flowstral-desktop/src/main/lib/ai-flow-explorer.js` | Flow Explorer engine |
| `flowstral-desktop/src/main/lib/ai-goal-agent.js` | Goal Agent engine |
| `flowstral-desktop/src/main/index.js` | IPC handlers |
| `src/components/AIFlowExplorer.tsx` | UI component |

### IPC Channels

| Channel | Description |
|---------|-------------|
| `flow-explorer-start` | Start flow exploration |
| `flow-explorer-stop` | Stop exploration |
| `goal-agent-execute` | Execute a goal |
| `goal-agent-stop` | Stop goal execution |
| `goal-agent-step` | Step progress event |

### API Requirements

- OpenAI API key required
- Models used: `gpt-4o-mini` (default), `gpt-4o` for vision
- Key can be configured in Settings or stored on backend

---

## Comparison: Flow Explorer vs Goal Agent

| Feature | Flow Explorer | Goal Agent |
|---------|--------------|------------|
| **Purpose** | Discover all pages/elements | Achieve specific goal |
| **Behavior** | Explores broadly | Focuses on objective |
| **Input** | URL + max pages | Natural language goal |
| **Output** | Navigation graph + tests | Steps + test case |
| **Best For** | Understanding app structure | Automating specific flows |
| **Control** | Less control, more coverage | Full control via goal |

---

## Best Practices

### For Flow Explorer
- Start with a logged-in session for better coverage
- Set reasonable max pages (20-50)
- Provide test credentials for login pages

### For Goal Agent
- Be specific in your goals
- Include relevant details (names, values)
- Provide all test data upfront
- Start from a relevant page (not necessarily home)

### Examples of Good vs Bad Goals

| ❌ Bad | ✅ Good |
|--------|---------|
| "Test the app" | "Create a new account named 'Test Corp'" |
| "Do something" | "Search for 'John Smith' contact" |
| "Login" | "Log in with admin@test.com and verify dashboard" |
| "Make report" | "Export Sales Pipeline report as CSV" |

---

## Troubleshooting

### "Goal not achieved"
- Make goal more specific
- Ensure you're on the right starting page
- Check if test data is filled correctly

### "No API key"
- Configure in Settings > AI
- Or set OPENAI_API_KEY environment variable
- Backend automatically provides key in desktop app

### "Element not found"
- Page may have changed
- Try more specific element description in goal
- Check browser window is not minimized

---

## Future Enhancements

- [ ] Vision-based element detection
- [ ] Multi-step goal chaining
- [ ] Learning from user corrections
- [ ] Parallel goal execution
- [ ] Goal templates/presets
