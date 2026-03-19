# Demo Recording Guide — Step-by-Step Scripts

> Use these scripts to record short GIF/video demos of each Flowstral feature.
> Save recordings to `public/demos/` — they auto-appear on the marketing website.

---

## Setup

**Tool:** [ScreenToGif](https://www.screentogif.com/downloads) (free, portable — no install needed)

**Settings:**
- Frame rate: 15 fps (good balance of quality vs file size)
- Resize: 800px wide in editor before saving
- Format: GIF (or WebM for smaller files)
- Delete bad frames in the editor before saving

**Demo target websites:**
- **Login/Forms:** https://www.saucedemo.com (creds: `standard_user` / `secret_sauce`)
- **E-commerce:** https://automationexercise.com (full e-commerce flow)
- **API testing:** https://reqres.in (REST API with docs)
- **Accessibility:** https://www.w3.org/WAI/demos/bad/before/home.html (intentionally bad a11y)
- **General forms:** https://demoqa.com (forms, modals, dropdowns)

---

## Recording 1: Smart Trace (Recorder)

**File:** `public/demos/recording-flow.gif`
**Used on:** Landing page hero + Smart Recorder page hero + Demo page "Smart Trace" step
**Duration:** 12-15 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Record"** in the top nav
2. You should see the Recorder page with:
   - URL input bar at top
   - "Start Recording" button
   - Empty step list on the left
3. **Type URL** `https://www.saucedemo.com` in the URL bar
4. **Click "Start Recording"** → browser window opens with SauceDemo login page
5. **In the opened browser:**
   - Type `standard_user` in the Username field
   - Type `secret_sauce` in the Password field
   - Click the "Login" button
6. **Watch the Flowstral step list populate** — each action appears as a numbered step:
   - Step 1: Navigate to saucedemo.com
   - Step 2: Fill "Username" → standard_user
   - Step 3: Fill "Password" → ••••••
   - Step 4: Click "Login"
7. **Click "Stop Recording"** in Flowstral

### What to Capture
- Start recording ScreenToGif from **step 3** (typing the URL) through **step 6** (seeing steps appear)
- The key visual: steps populating in real-time as you interact with the browser
- End with the completed step list visible

---

## Recording 2: Visual Test Builder

**File:** `public/demos/test-builder.gif`
**Used on:** Demo page "Visual Builder" step
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Build"** in the top nav
2. You should see the Visual Test Builder with:
   - Step type palette on the left (Navigate, Click, Type Text, etc.)
   - Workflow canvas in the center
   - "Run Test" button in the top right
3. **Start ScreenToGif recording**
4. **Click "Navigate"** in the left panel → a Navigate step card appears in the workflow
5. **Type** `https://www.saucedemo.com` in the URL field of the step
6. **Click "Click"** in the left panel → a Click step appears
7. **Click "Type Text"** in the left panel → a Type step appears
8. **Scroll down** the left panel to show the "Verify" section (Element Visible, Text Content, etc.)
9. **Click "Element Visible"** → verification step appears
10. **Stop ScreenToGif recording**

### What to Capture
- The left panel showing all available step types (Actions + Verify sections)
- Steps being added to the workflow canvas
- The drag-and-drop feel of building a test visually

---

## Recording 3: API Testing

**File:** `public/demos/api-testing.gif`
**Used on:** Demo page "API Testing" step
**Duration:** 12-15 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"API"** in the top nav
2. You should see the API Testing page with:
   - Collection sidebar on the left
   - Request builder in the center (URL bar, method dropdown, tabs for Params/Headers/Body)
   - "Send" button
3. **Start ScreenToGif recording**
4. **Select "GET"** from the method dropdown (should already be selected)
5. **Type** `https://reqres.in/api/users?page=1` in the URL bar
6. **Click "Send"**
7. **Wait for response** — you should see:
   - Status: 200 OK (green badge)
   - Response time shown
   - JSON response body with user data in the response panel
8. **Click the "Assertions" tab** below the response
9. **Stop ScreenToGif recording**

### What to Capture
- The full request builder UI
- Typing the URL and hitting Send
- The response appearing with status code, time, and JSON body
- The professional look of the response viewer

### Alternative: Import an OpenAPI Spec
If the API page has an Import section:
1. Click "Import" tab
2. Paste `https://petstore.swagger.io/v2/swagger.json`
3. Show the parsed endpoints populating

---

## Recording 4: Accessibility Scanning

**File:** `public/demos/accessibility-scan.gif`
**Used on:** Demo page "Accessibility" step
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"A11y"** in the top nav
2. You should see the Accessibility page with:
   - URL input field
   - WCAG level selector (A / AA / AAA)
   - "Scan" button
3. **Start ScreenToGif recording**
4. **Type** `https://www.w3.org/WAI/demos/bad/before/home.html` in the URL field
   (This is the W3C's intentionally inaccessible demo page — will find many issues)
5. **Select "AA"** as the WCAG level
6. **Click "Scan"**
7. **Wait for results** — you should see:
   - Summary cards: total issues, critical, serious, moderate, minor
   - Issue list with severity badges (red for critical, orange for serious)
   - Each issue showing the element and suggested fix
8. **Scroll down** to show a few issues in the list
9. **Stop ScreenToGif recording**

### What to Capture
- The clean scan setup UI
- Results populating with severity badges
- The summary cards showing issue counts
- A few issues with their element descriptions

---

## Recording 5: Performance / Load Testing

**File:** `public/demos/performance-testing.gif`
**Used on:** Demo page "Performance Testing" step (future)
**Duration:** 12-15 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Perf"** in the top nav
2. You should see the Performance Testing page with:
   - Configuration section (URL, VUs, duration, pattern)
   - Results area (charts, metrics)
3. **Start ScreenToGif recording**
4. **Type** `https://reqres.in/api/users` in the Target URL field
5. **Set Virtual Users** to `10`
6. **Set Duration** to `30` seconds
7. **Select load pattern** "Ramp" (gradual increase)
8. **Click "Start Test"**
9. **Watch the real-time charts** populate:
   - Response time graph
   - Throughput graph
   - Active VU count
   - Error rate
10. **Wait ~5-8 seconds** of chart data showing
11. **Stop ScreenToGif recording**

### What to Capture
- The configuration UI with VU/duration/pattern selectors
- The "Start" moment
- Real-time charts animating with live data

---

## Recording 6: Test Management (Repository)

**File:** `public/demos/test-management.gif`
**Used on:** Demo page "Test Management" step (future)
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Tests"** in the top nav
2. You should see the Test Repository with:
   - Folder tree on the left (Smoke Tests, Regression, Integration, End-to-End)
   - Test case list in the center
   - Tabs: Test Cases, Suites, Plans, Releases, Runs, Defects
3. **Start ScreenToGif recording**
4. **Click on "Smoke Tests"** folder → shows tests in that folder
5. **Click on the "Suites"** tab → shows test suites
6. **Click on "Runs"** tab → shows test execution history
7. **Click on "Defects"** tab → shows linked defects
8. **Stop ScreenToGif recording**

### What to Capture
- The folder tree structure
- Switching between tabs to show the breadth of test management
- The professional UI with badges, filters, and status indicators

---

## Recording 7: Dashboard

**File:** `public/demos/dashboard.gif`
**Used on:** Demo page "Actionable Dashboards" step (future)
**Duration:** 8-10 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Dashboard"** in the top nav
2. You should see dashboard widgets:
   - Test execution summary (pass/fail/skip)
   - Coverage metrics
   - Recent runs
   - Trend charts
3. **Start ScreenToGif recording**
4. **Just let it sit for 2 seconds** showing the full dashboard
5. **Scroll down slowly** to reveal more widgets/charts
6. **Stop ScreenToGif recording**

### What to Capture
- The overview at a glance — cards, charts, metrics
- A slow scroll to show depth of information

---

## Recording 8: Flowpilot (AI Testing)

**File:** `public/demos/flowpilot.gif`
**Used on:** Future Flowpilot marketing (highest-value feature)
**Duration:** 12-15 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Flowpilot"** in the top nav
2. You should see the Flowpilot page with:
   - 4 agent cards: Generator, Self-Healer, Explorer, Flowmap
   - Text input for goals
3. **Start ScreenToGif recording**
4. **Click on "Generator"** agent card
5. **Type** in the goal field: `Test login flow on saucedemo.com with valid and invalid credentials`
6. **Click "Start"**
7. **Watch the SSE streaming output:**
   - Phase indicators (Understand → Launch → Navigate → Plan → Execute)
   - Live screenshots appearing
   - Test steps being generated and executed
8. **Stop ScreenToGif recording** after a few steps appear

### What to Capture
- The natural language input (just type and go)
- The AI phases progressing
- Live screenshots showing the browser being automated
- The "magic" of text → automated test

---

## Recording 9: Mobile Testing

**File:** `public/demos/mobile-testing.gif`
**Used on:** Demo page "Mobile Testing" step (future)
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Mobile"** in the top nav
2. You should see tabs: Studio, Flows, Device Lab, Runs, Inspector, Tools
3. **Start ScreenToGif recording**
4. **Click "Device Lab"** tab → shows device profiles (iPhone, Samsung, Pixel, etc.)
5. **Click on a device** (e.g., iPhone 15 Pro) → shows device details
6. **Click "Flows"** tab → shows saved test flows
7. **Click "Tools"** tab → shows advanced tools (Deep Links, Push Notifications, Biometrics, etc.)
8. **Stop ScreenToGif recording**

### What to Capture
- The 50+ device profiles
- The breadth of mobile testing tools
- The tab navigation showing multiple capabilities

---

## Recording 10: Salesforce Testing

**File:** `public/demos/salesforce-testing.gif`
**Used on:** Demo page (future Salesforce marketing)
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"SF"** in the top nav
2. You should see Salesforce-specific tools:
   - Connection setup
   - Object explorer
   - Data generator
   - Test templates
3. **Start ScreenToGif recording**
4. **Browse through the Salesforce panels** — click on different sections to show:
   - Object schema browser
   - Bulk data generation settings
   - SF-specific test templates
5. **Stop ScreenToGif recording**

### What to Capture
- The Salesforce-specific UI elements
- The enterprise-grade tooling for SF testing

---

## Recording 11: Visual Regression Testing

**File:** `public/demos/visual-testing.gif`
**Used on:** Future visual testing marketing
**Duration:** 10-12 seconds

### Steps to Record

1. **Open Flowstral Desktop** → click **"Visual"** in the top nav
2. You should see tabs: Dashboard, Compare, Baselines, Recent Diffs
3. **Start ScreenToGif recording**
4. **Click "Compare"** tab
5. **Enter** a URL to capture: `https://www.saucedemo.com`
6. **Click "Capture"** to take a screenshot
7. **Show the comparison modes** dropdown (Pixel Perfect, Anti-Aliased, Perceptual, Structural, Layout, AI Semantic)
8. **Stop ScreenToGif recording**

### What to Capture
- The 6 comparison modes
- The baseline management UI
- The visual diff viewer

---

## Priority Order

Record in this order (highest marketing impact first):

| # | Recording | Marketing Impact | Estimated Time |
|---|-----------|-----------------|----------------|
| 1 | **Smart Trace (Recorder)** | Highest — hero of landing page | 3 min |
| 2 | **API Testing** | High — key differentiator | 2 min |
| 3 | **Visual Builder** | High — no-code appeal | 2 min |
| 4 | **Accessibility** | Medium — compliance selling point | 2 min |
| 5 | **Flowpilot** | Highest feature value — but needs AI backend running | 3 min |
| 6 | **Performance** | Medium — load testing visual | 2 min |
| 7 | **Dashboard** | Low effort, good for overview | 1 min |
| 8 | **Test Management** | Medium — enterprise feature | 2 min |
| 9 | **Mobile Testing** | Medium — shows breadth | 2 min |
| 10 | **Visual Testing** | Lower — niche audience | 2 min |
| 11 | **Salesforce** | Niche — enterprise only | 2 min |

**Total estimated time: ~25 minutes for all 11 recordings**

---

## File Naming Convention

```
public/demos/
├── recording-flow.gif        ← Recording 1 (REQUIRED - serves landing + recorder page)
├── test-builder.gif          ← Recording 2 (REQUIRED - serves demo page)
├── api-testing.gif           ← Recording 3 (REQUIRED - serves demo page)
├── accessibility-scan.gif    ← Recording 4 (REQUIRED - serves demo page)
├── performance-testing.gif   ← Recording 5 (optional - future)
├── test-management.gif       ← Recording 6 (optional - future)
├── dashboard.gif             ← Recording 7 (optional - future)
├── flowpilot.gif             ← Recording 8 (optional - future)
├── mobile-testing.gif        ← Recording 9 (optional - future)
├── salesforce-testing.gif    ← Recording 10 (optional - future)
└── visual-testing.gif        ← Recording 11 (optional - future)
```

The first 4 are **already wired into the marketing pages** and will appear immediately once the GIF files are added. Recordings 5-11 can be wired in later with a single `gifSrc` addition per demo step.

---

## Tips for Clean Recordings

1. **Maximize the Flowstral window** before recording (but not full-screen — leave a small border)
2. **Close other tabs/notifications** — clean desktop
3. **Use a light theme** (default) — better contrast in GIFs
4. **Move slowly** — GIF frame rates are low, fast mouse movements look janky
5. **Pause for 1-2 seconds** after each major action so viewers can read what happened
6. **Don't record the ScreenToGif toolbar** — position the capture frame inside the app window
7. **In the ScreenToGif editor** before saving:
   - Delete the first/last 2-3 frames (usually mouse-positioning noise)
   - Resize to 800px width
   - Set frame delay to 80-100ms (10-12 fps) for smooth but small files
   - Use "Save As" → GIF with quality 85%
