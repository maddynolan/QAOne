# Test Run Workflow Improvements - Proposal

## Current Issues

1. **Auto-loading all test cases**: Creates test run with all 119 test cases by default
2. **No test run details page**: Missing fields like description, environment, test plan link
3. **No test case selection UI**: Can't easily select which test cases to include
4. **Missing test plan linkage**: Test runs not properly linked to test plans
5. **Execution UI**: No per-test-case execution, no multi-select for batch execution

## Proposed Improvements

### 1. Test Run Creation Flow

#### Step 1: Test Run Details Page
**Route**: `/runs/create` or `/runs/new`

**Fields**:
- **Name**: Test run name (required)
- **Description**: Optional description
- **Test Plan**: Dropdown to select existing test plan (optional but recommended)
- **Environment**: Dropdown (Development, Staging, Production, etc.)
- **Branch/Commit**: Optional for version tracking
- **Tags**: Multi-select for categorization

**Action**: "Next: Select Test Cases" button

#### Step 2: Test Case Selection Page
**Route**: `/runs/create/select-cases`

**Two-column layout**:

**Left Column - Available Test Cases**:
- Search/filter bar
- Filter by: Priority, Tags, Test Plan, Test Type
- List of test cases with checkboxes
- Each test case shows: Name, Priority badge, Tags, Steps count
- "Select All" / "Deselect All" buttons
- Pagination (if many test cases)

**Right Column - Selected Test Cases**:
- Draggable list of selected test cases
- Can reorder by dragging
- Remove button (X) on each
- Shows count: "X test cases selected"
- "Load from Test Plan" button (if test plan selected in step 1)

**Actions**:
- "Back" button (to details)
- "Create Test Run" button (creates and navigates to detail page)

**Alternative**: Drag & Drop Interface
- Left: Available test cases (from test plans or all)
- Right: Selected test cases
- Drag test cases from left to right
- Can also use checkboxes for multi-select

### 2. Test Run Detail Page Improvements

#### Header Section
- Test run name (editable)
- Status badge
- **Link to Test Plan** (if linked): "View Test Plan →" button
- Environment, Branch info
- Created date, Started date, Completed date

#### Test Cases Section
**Enhanced Layout**:

```
┌─────────────────────────────────────────────────────────┐
│ [✓] Select All  [▶] Run Selected (3)  [Filters ▼]     │
├─────────────────────────────────────────────────────────┤
│ [✓] Test Case 1                    [▶ Start] [Status]  │
│     Description...                  Priority: High      │
│     Steps: 5 | Tags: API, Critical                      │
├─────────────────────────────────────────────────────────┤
│ [✓] Test Case 2                    [▶ Start] [Status]  │
│     Description...                  Priority: Medium    │
│     Steps: 3 | Tags: UI                                │
└─────────────────────────────────────────────────────────┘
```

**Features**:
- Checkbox for each test case (multi-select)
- "Start Execution" button next to each test case
- "Run Selected" button at top (executes selected test cases)
- Status badge per test case (Pending, Running, Passed, Failed)
- Expandable to show steps
- Filter/search test cases
- Sort by: Name, Priority, Status, Execution Time

#### Execution Flow
1. **Individual Execution**: Click "Start" next to test case → executes that one
2. **Batch Execution**: Select multiple → Click "Run Selected" → executes all selected
3. **Full Execution**: "Start All" button → executes entire test run

### 3. Database Schema Updates

#### Test Run Table
Add/Ensure fields:
- `plan_id` (UUID, FK to test_plans) - Link to test plan
- `description` (TEXT)
- `environment` (VARCHAR) - Already exists
- `branch` (VARCHAR) - Already exists
- `commit` (VARCHAR) - Already exists
- `tags` (TEXT[]) - For categorization

#### Test Case to Test Run Relationship
- Already exists via `test_run_steps.case_id` and `test_run_steps.run_id`
- Ensure `test_cases` table has `plan_id` field (for linking to test plans)

### 4. API Endpoints Needed

#### Test Run Creation
```
POST /test-runs
Body: {
  name: string
  description?: string
  plan_id?: string (UUID)
  environment: string
  branch?: string
  commit?: string
  tags?: string[]
  test_case_ids: string[] (UUIDs of selected test cases)
}
```

#### Test Case Selection
```
GET /test-cases?plan_id={plan_id}&tags={tags}&priority={priority}
- Filter test cases by plan, tags, priority
- Return list for selection UI
```

#### Batch Execution
```
POST /test-runs/{run_id}/execute-selected
Body: {
  case_ids: string[] (UUIDs of test cases to execute)
}
```

#### Individual Test Case Execution
```
POST /test-runs/{run_id}/cases/{case_id}/execute
- Execute single test case within a run
```

### 5. UI Components Needed

1. **CreateTestRunPage** (`src/pages/CreateTestRun.tsx`)
   - Form for test run details
   - Test plan selector
   - Navigation to selection page

2. **SelectTestCasesPage** (`src/pages/SelectTestCases.tsx`)
   - Two-column layout
   - Search/filter
   - Multi-select checkboxes
   - Drag & drop (optional, using react-beautiful-dnd or @dnd-kit)

3. **TestRunDetailPage** (Enhanced existing)
   - Multi-select checkboxes
   - Per-test-case execution buttons
   - Batch execution button
   - Test plan link
   - Better status indicators

4. **TestCaseCard** (Component)
   - Reusable card for test case display
   - Checkbox, status, actions
   - Expandable steps

## Implementation Priority

### Phase 1: Core Functionality (High Priority)
1. ✅ Create test run details page with form
2. ✅ Test case selection page (checkbox-based, no drag-drop yet)
3. ✅ Update API to accept test_case_ids array
4. ✅ Link test runs to test plans
5. ✅ Show test plan link on test run detail page

### Phase 2: Enhanced Selection (Medium Priority)
1. ✅ Add search/filter to test case selection
2. ✅ "Load from Test Plan" feature
3. ✅ Drag & drop interface (optional enhancement)

### Phase 3: Execution Improvements (Medium Priority)
1. ✅ Multi-select checkboxes on test run detail
2. ✅ Per-test-case "Start" buttons
3. ✅ "Run Selected" batch execution
4. ✅ Better status indicators

### Phase 4: Polish (Low Priority)
1. ✅ Reorder test cases (drag in selection)
2. ✅ Test case grouping/filtering on detail page
3. ✅ Advanced filters (by status, priority, tags)

## User Flow Examples

### Example 1: Create Test Run from Test Plan
1. User goes to Test Plans → Selects a plan
2. Clicks "Create Test Run from Plan"
3. Fills test run details (name, environment, etc.)
4. Test cases from plan are pre-selected
5. User can add/remove test cases
6. Clicks "Create Test Run"
7. Redirected to test run detail page

### Example 2: Create Custom Test Run
1. User goes to Test Runs → "Create New Test Run"
2. Fills test run details
3. Optionally selects a test plan
4. Clicks "Next: Select Test Cases"
5. Searches/filters test cases
6. Selects desired test cases (checkboxes or drag-drop)
7. Clicks "Create Test Run"
8. Redirected to test run detail page

### Example 3: Execute Selected Test Cases
1. User views test run detail page
2. Selects 3 test cases using checkboxes
3. Clicks "Run Selected (3)" button
4. Only those 3 test cases execute
5. Status updates in real-time

## Technical Considerations

1. **State Management**: Use React state or context for test case selection
2. **Drag & Drop**: Consider @dnd-kit (modern, accessible) vs react-beautiful-dnd
3. **Performance**: Virtual scrolling for large test case lists (react-window)
4. **Real-time Updates**: WebSocket or polling for execution status
5. **Backend**: Ensure test_run_steps are created only for selected test cases

## Questions to Consider

1. Should test cases be removable from a test run after creation?
2. Can test cases be reordered in a test run?
3. Should there be a "template" feature for common test run configurations?
4. How to handle test cases that are deleted after test run is created?
5. Should test runs be editable after creation (add/remove test cases)?






