# Intelligent Locator Builder

The Flowstral Workflow Editor now includes an **Intelligent Locator Builder** that automatically generates Playwright locators using best practices, eliminating the need for manual locator entry.

## Features

### 🎯 Auto-Generation
- **Smart Defaults**: When you add a node, it automatically generates a locator based on the node type
- **Intelligent Suggestions**: Provides multiple locator strategies ranked by quality
- **Real-time Updates**: Locator updates as you type

### 🧠 Intelligent Strategies

The builder uses Playwright's best practices in priority order:

1. **Test ID** (Highest Quality)
   - `page.getByTestId('submit-button')`
   - Most stable - requires `data-testid` attribute

2. **Role + Name** (High Quality)
   - `page.getByRole('button', { name: 'Submit' })`
   - Semantic and accessible

3. **Label** (High Quality for Inputs)
   - `page.getByLabel('Email Address')`
   - Perfect for form fields

4. **Text** (Medium Quality)
   - `page.getByText('Click me')`
   - Good for buttons/links with visible text

5. **Role Only** (Medium Quality)
   - `page.getByRole('button')`
   - Works if there's only one element

6. **CSS Selector** (Low Quality - Fallback)
   - `page.locator('button.primary')`
   - Less reliable - use only if needed

## How It Works

### Auto Mode (Recommended)

1. **Fill in what you know** about the element:
   - Element Name/Text (e.g., "Submit", "Login")
   - Label Text (for inputs)
   - Test ID (if available)
   - CSS Selector (as fallback)

2. **Builder automatically generates** the best locator:
   - Analyzes all inputs
   - Generates multiple suggestions
   - Ranks them by quality
   - Selects the best one automatically

3. **See suggestions** ranked from best to worst:
   - Click any suggestion to use it
   - See quality indicators (high/medium/low)
   - Read explanations for each strategy

### Manual Mode

Choose a specific strategy:

- **Role Mode**: Select role (button, link, textbox) and enter name
- **Text Mode**: Enter the visible text content

## Usage Examples

### Example 1: Click Button

**What you enter:**
- Element Name: "Submit"

**What gets generated:**
```typescript
page.getByRole('button', { name: 'Submit' })
```

**Alternative suggestions:**
- `page.getByRole('link', { name: 'Submit' })` (if it's a link)
- `page.getByText('Submit')` (fallback)

### Example 2: Input Field

**What you enter:**
- Label Text: "Email Address"
- Element Name: "Email"

**What gets generated:**
```typescript
page.getByLabel('Email Address')
```

**Alternative suggestions:**
- `page.getByRole('textbox', { name: 'Email' })`
- `page.getByText('Email')`

### Example 3: With Test ID

**What you enter:**
- Test ID: "submit-button"

**What gets generated:**
```typescript
page.getByTestId('submit-button')
```

This is automatically selected as the best option!

## Smart Node Creation

When you add a new node, it automatically:

1. **Generates a smart locator** based on the node type:
   - Click nodes → `page.getByRole('button', { name: '...' })`
   - Input nodes → `page.getByLabel('...')`
   - Assert nodes → `page.getByText('...')`

2. **Provides sensible defaults**:
   - Navigate nodes → URL: `https://example.com`
   - Wait nodes → Duration: `1000ms`
   - Input nodes → Empty value (ready to fill)

3. **Auto-connects** to previous node

## Export Validation

Before exporting to Playwright, the editor:

1. **Validates all nodes** have required properties
2. **Highlights incomplete nodes** if any
3. **Prevents export** until all nodes are complete
4. **Shows helpful error messages**

## Best Practices Guide

The builder includes a built-in guide:

✅ **Use Test IDs**: Add `data-testid` attributes for most reliable locators
✅ **Prefer Roles**: `getByRole()` is more reliable than CSS selectors
✅ **Use Labels**: `getByLabel()` is perfect for form inputs
⚠️ **Avoid CSS**: CSS selectors break easily with UI changes

## Interactive UI

### Visual Feedback

- **Quality Badges**: See at a glance which locators are best (high/medium/low)
- **Live Preview**: See the generated Playwright code in real-time
- **Copy Button**: One-click copy of generated locator
- **Suggestion Cards**: Click any suggestion to use it

### Smart Suggestions

The builder shows up to 3 suggestions:
1. **Best option** (automatically selected)
2. **Alternative** (if available)
3. **Fallback** (if needed)

Each suggestion includes:
- Quality indicator
- Strategy description
- Reason why it's good/bad
- Click to select

## Integration with Workflow

The intelligent locator builder is seamlessly integrated:

1. **Click a node** → Properties panel opens
2. **Locator Builder appears** automatically for click/input/assert nodes
3. **Fill in information** → Locator generates automatically
4. **See preview** → Live Playwright code preview updates
5. **Export** → All locators included in generated script

## No Manual Entry Required

You **never need to manually type** Playwright locators:

1. Just describe the element (name, label, text)
2. Builder generates the locator automatically
3. Choose from suggestions if needed
4. Export and you're done!

## Tips

1. **Start with Auto Mode**: It's the easiest and most intelligent
2. **Fill in as much as you know**: More info = better locators
3. **Use Test IDs when possible**: Most reliable option
4. **Check suggestions**: See all available options
5. **Use preview**: Verify the generated code looks correct

## Example Workflow

1. Add "Click" node → Auto-generates `page.getByRole('button', { name: 'Click Button' })`
2. Click node to edit → Locator Builder opens
3. Change name to "Submit" → Locator updates to `page.getByRole('button', { name: 'Submit' })`
4. Add "Input" node → Auto-generates `page.getByLabel('Enter Text')`
5. Edit input → Enter label "Email" → Locator becomes `page.getByLabel('Email')`
6. Export → Complete Playwright script with all intelligent locators!

## Benefits

- ✅ **No manual locator entry** - Just describe the element
- ✅ **Best practices built-in** - Uses Playwright's recommended strategies
- ✅ **Multiple suggestions** - See all options ranked by quality
- ✅ **Real-time validation** - Know immediately if locator is good
- ✅ **Auto-completion** - Smart defaults for all node types
- ✅ **Export-ready** - Generated script is production-ready

The Intelligent Locator Builder makes creating Playwright tests as easy as describing what you want to click or fill!



