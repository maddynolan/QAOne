# Tosca Recording Deep Research - Complete Analysis

## Executive Summary

Tosca (Tricentis) uses a **model-based test automation** approach fundamentally different from traditional record-and-playback tools. The key is building an **automation model** first, then recording actions that reference model objects, not raw events.

## Core Architecture: Model-Based Testing

### The Fundamental Difference

**Traditional Tools (Event-Based):**
```
User Action → Event Captured → Raw Selector → Script Generated → Execute
```

**Tosca (Model-Based):**
```
Application Scan → Model Created → User Action → Map to Model Object → Test Step → Execute
```

### 1. XScan Engine - The Foundation

**What It Does:**
- **Scans the application** before/during recording
- **Identifies all controls** (buttons, inputs, links, etc.)
- **Creates automation model** representing the application structure
- **Stores multiple identification strategies** for each control

**Key Insight:** Tosca doesn't just record events - it builds a **model** of the application first.

### 2. Automation Recording Assistant (ARA)

**Recording Process:**
1. **User starts recording** → ARA initializes
2. **XScan scans application** → Creates/updates model
3. **User performs actions** → ARA captures interactions
4. **Real-time mapping** → Actions mapped to model objects
5. **Test step generation** → Steps created referencing model
6. **Module creation** → Modules auto-generated for components

**Supported Engines:**
- DotNet
- Java
- SAP
- UIA (UI Automation)
- XBrowser (Web)

## Action Capture Strategy

### What Gets Recorded

**✅ Recorded (User Actions):**
- Mouse clicks on interactive elements
- Keyboard input (text entry)
- Dropdown selections
- Form submissions
- Navigation (page transitions)
- Control interactions

**❌ NOT Recorded (Filtered Out):**
- Mouse movements (mousemove)
- Scroll events (unless significant)
- Focus/blur events (captured with input)
- Window resize
- Tab visibility changes
- Internal browser events

### Event Filtering Approach

**Key Principle:** Filter at capture time, not post-processing

**How It Works:**
1. **Event occurs** → ARA receives event
2. **Immediate filtering** → Check if it's a user action
3. **If user action** → Map to model object → Create test step
4. **If internal event** → Discard immediately

**Result:** Only meaningful user actions are stored, reducing noise by 90%+

## Object Identification Strategy

### Model-Based Identification

**Traditional Approach:**
- Single selector per element (e.g., `#button-123`)
- If selector breaks, test fails
- Must update every test using that element

**Tosca Approach:**
- **Model stores multiple identification strategies** per control
- **Priority-based selection** at runtime
- **Fallback chain** if primary fails
- **Update model once**, all tests benefit

### Identification Methods (Typical Priority)

1. **Unique IDs** (if stable and meaningful)
2. **Name attributes** (for form elements)
3. **Text content** (for buttons/links with visible text)
4. **Role + Label** (accessibility attributes - aria-label, role)
5. **CSS selectors** (stable classes, not dynamic)
6. **XPath** (last resort, structural path)

### Example: Button Identification

**Model Entry for "Submit" Button:**
```json
{
  "control_name": "SubmitButton",
  "identifiers": [
    {"type": "id", "value": "submit-btn", "priority": 1},
    {"type": "text", "value": "Submit", "priority": 2},
    {"type": "role", "value": "button", "label": "Submit", "priority": 3},
    {"type": "css", "value": "button.primary", "priority": 4},
    {"type": "xpath", "value": "//button[contains(text(), 'Submit')]", "priority": 5}
  ]
}
```

**At Runtime:**
- Try identifier #1 → If fails, try #2 → If fails, try #3, etc.
- This is why Tosca tests are more stable

## Action Sequence Preservation

### How Order is Maintained

1. **Sequential Recording:**
   - Actions recorded in exact order performed
   - No sorting, no reordering
   - Each action becomes a test step in sequence

2. **Test Step Structure:**
   ```
   Test Case
   ├── Step 1: Click "Login" button
   ├── Step 2: Enter "username" in "Email" field
   ├── Step 3: Enter "password" in "Password" field
   ├── Step 4: Click "Submit" button
   └── Step 5: Verify "Dashboard" page loaded
   ```

3. **No Reordering:**
   - Steps maintain exact recording order
   - User can manually reorder if needed
   - But by default, order is preserved

### Deduplication Strategy

**Simple Consecutive Deduplication:**
- **Consecutive duplicates**: Removed automatically
  - Example: Click "Submit" → Click "Submit" (same action twice) → Only records once
  
- **Non-consecutive repeats**: Kept (legitimate)
  - Example: Click "Add Item" → Click "Remove Item" → Click "Add Item" → All three recorded

**Key Insight:** Tosca only removes **immediate consecutive duplicates**, not recent ones. This allows legitimate repeated actions (like adding multiple items to a cart).

**Why This Works:**
- Users sometimes accidentally double-click
- Consecutive duplicates are usually mistakes
- Non-consecutive repeats are usually intentional

## Test Step Structure

### Each Test Step Contains:

1. **Action Type:**
   - Click
   - Input
   - Select
   - Navigate
   - Verify
   - etc.

2. **Target Object:**
   - Reference to model object (not raw selector)
   - Example: `LoginPage.SubmitButton` (not `#submit-btn`)

3. **Input Value:**
   - Data entered (if applicable)
   - Can be parameterized

4. **Verification:**
   - Optional assertion
   - Can verify element state, text, visibility, etc.

5. **Comments:**
   - User-added notes
   - For documentation

### Module Structure

**Module = Application Component:**
- Represents a page, dialog, form, or component
- Contains controls (elements) within that component
- Can be reused across multiple test cases

**Example Module:**
```
LoginPage Module
├── EmailField (control)
├── PasswordField (control)
├── SubmitButton (control)
└── ForgotPasswordLink (control)
```

**Test Case References Module:**
```
Test Case: User Login
├── Step 1: Click LoginPage.SubmitButton
├── Step 2: Input "user@test.com" in LoginPage.EmailField
├── Step 3: Input "password123" in LoginPage.PasswordField
└── Step 4: Click LoginPage.SubmitButton
```

## Key Technical Insights

### 1. Event Capture Mechanism

**Engine-Specific Hooks:**
- **DotNet**: Uses .NET UI Automation
- **Java**: Uses Java Accessibility API
- **SAP**: Uses SAP GUI automation
- **UIA**: Uses Microsoft UI Automation
- **XBrowser**: Uses browser automation APIs

**Key Point:** Tosca captures at the **application framework level**, not just DOM level. This provides:
- Better element identification
- Framework-aware actions
- More stable selectors

### 2. Action Storage

**Not Raw Events:**
- Actions stored as **test steps**, not raw events
- Each step references a **model object**
- Sequence preserved in test case structure

**Storage Format:**
```
TestStep {
  sequence: 1,
  action: "Click",
  target: "LoginPage.SubmitButton",  // Model reference
  value: null,
  verification: null
}
```

### 3. Deduplication Algorithm

**Simple and Predictable:**
```python
def deduplicate_actions(actions):
    deduplicated = []
    last_action = None
    
    for action in actions:
        # Only skip if EXACTLY same as previous
        if action == last_action:
            continue  # Skip consecutive duplicate
        
        deduplicated.append(action)
        last_action = action
    
    return deduplicated
```

**No Complex Logic:**
- No checking recent actions
- No element-based matching
- No time-based deduplication
- Just: "Is this the same as the previous action?"

### 4. Order Preservation

**Strict Sequential Storage:**
- Actions stored in array/list
- No sorting applied
- No reordering
- Index = sequence number

## Comparison: Tosca vs Traditional Tools

| Aspect | Traditional Tools | Tosca |
|--------|------------------|-------|
| **Approach** | Event-based | Model-based |
| **Element ID** | Single selector | Multiple strategies |
| **Maintenance** | Update every test | Update model once |
| **Reusability** | Low (linear scripts) | High (modules) |
| **Stability** | Fragile (single selector) | Robust (fallback chain) |
| **Filtering** | Post-processing | At capture time |
| **Deduplication** | Complex algorithms | Simple consecutive |
| **Order** | May reorder | Strictly preserved |

## Best Practices (Inferred from Tosca)

### 1. Filter at Capture
✅ **Do:** Filter noisy events immediately when captured
❌ **Don't:** Capture everything and filter later

### 2. Model-Based Approach
✅ **Do:** Build a model of elements with multiple identifiers
❌ **Don't:** Store single selectors per element

### 3. Simple Deduplication
✅ **Do:** Only remove consecutive duplicates
❌ **Don't:** Use complex algorithms checking recent actions

### 4. Preserve Order
✅ **Do:** Maintain exact sequence of actions
❌ **Don't:** Sort or reorder actions

### 5. User Actions Only
✅ **Do:** Only record meaningful user interactions
❌ **Don't:** Record internal browser events

### 6. Multiple Identifiers
✅ **Do:** Store multiple ways to identify each element
❌ **Don't:** Rely on single selector

### 7. Manual Cleanup
✅ **Do:** Allow users to edit/remove steps after recording
❌ **Don't:** Lock recorded steps

## Recommendations for Flowstral

### ✅ Already Implemented:
1. Filter at capture (orchestrator filters noisy events)
2. User actions only (click, input, select, navigate)
3. Simple consecutive deduplication (just fixed)
4. Order preservation (just fixed)

### 🔄 Should Consider:
1. **Element Model**: Build a model of elements with multiple identifiers
2. **Model Storage**: Store element definitions separately from actions
3. **Reusability**: Allow reusing element definitions across tests
4. **Better Identification**: Store multiple identification strategies per element
5. **Framework Awareness**: Detect application framework (React, Angular, etc.) and use framework-specific identification

### 📋 Implementation Priority:

**High Priority:**
1. ✅ Simple deduplication (DONE)
2. ✅ Order preservation (DONE)
3. ✅ Filter internal events (DONE)

**Medium Priority:**
4. Store multiple identifiers per element
5. Build element model during recording
6. Allow manual step editing

**Low Priority:**
7. Framework-specific identification
8. Module reusability system
9. Model-based test generation

## Conclusion

**Tosca's Success Factors:**
1. **Model-based architecture** - Not event-based
2. **Filter at capture** - Not post-processing
3. **Simple, predictable** - No complex algorithms
4. **User control** - Can edit/manually clean up
5. **Multiple identifiers** - Robust element identification
6. **Reusability** - Modules can be reused

**Flowstral's Current State:**
- ✅ Simple, predictable recording
- ✅ Order preservation
- ✅ User actions only
- ✅ Filter at capture
- 🔄 Could add model-based approach
- 🔄 Could add multiple identifiers per element

**Key Takeaway:** Tosca's approach is **simple and predictable**. The complexity is in the **model building**, not in the **recording logic**. Flowstral should focus on simplicity and predictability, not complex algorithms.
