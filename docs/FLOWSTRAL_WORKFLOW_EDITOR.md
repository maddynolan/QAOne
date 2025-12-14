# Flowstral Workflow Editor

A visual drag-and-drop workflow editor integrated with Flowstral for building and editing test automation workflows.

## Features

- 🎨 **Visual Workflow Builder** - Drag and drop nodes to create test workflows
- 🔄 **Flowstral Integration** - Import/export workflows from Flowstral sessions
- 📝 **Playwright Export** - Generate Playwright test scripts from workflows
- 💾 **Save/Load** - Save workflows as JSON files
- 🎯 **Node Types** - Navigate, Click, Input, Wait, Assert actions
- 🔍 **Property Editor** - Edit node properties with live preview
- 📐 **Zoom & Pan** - Navigate large workflows easily

## Getting Started

### Accessing the Editor

1. Navigate to **Flowstral** page
2. Click **"Open Workflow Editor"** in Quick Actions
3. Or go directly to `/flowstral/workflow-editor`

### With Flowstral Session

To load an existing Flowstral recording:
1. Start a Flowstral session and record some actions
2. Open Workflow Editor with session ID: `/flowstral/workflow-editor?sessionId=<session-id>`
3. Click **"Load from Flowstral"** to import the action graph

## Usage

### Adding Nodes

1. Click on action buttons in the left sidebar:
   - **Navigate** - Navigate to a URL
   - **Click** - Click on an element
   - **Input** - Fill in a form field
   - **Wait** - Wait for a duration
   - **Assert** - Assert element visibility

2. Nodes are automatically connected in sequence

### Editing Nodes

1. Click on a node to select it
2. Edit properties in the right sidebar:
   - **Step Name** - Human-readable label
   - **Locator** - Playwright locator (for click/input/assert)
   - **Value** - Input value or wait duration
   - **URL** - Navigation URL

3. See live preview of generated Playwright code

### Moving Nodes

- **Drag nodes** to reposition them
- **Drag canvas** (empty area) to pan the view
- Use zoom controls in bottom-right corner

### Importing Workflows

#### From Flowstral Session
1. Click **"Import"** button
2. Select **"Flowstral Session"**
3. Enter session ID or use current session
4. Click **"Load from Flowstral"**

#### From JSON File
1. Click **"Import"** button
2. Select **"JSON File"**
3. Upload a workflow JSON file
4. Or drag and drop a JSON file onto the canvas

### Exporting Workflows

#### To Playwright Script
1. Click **"Export Playwright"** button
2. Generated `.spec.ts` file will download
3. Ready to run with Playwright

#### To Flowstral
1. Ensure you have an active session ID
2. Click **"Export to Flowstral"** button
3. Workflow will be saved to Flowstral session
4. Can be used for further processing

#### To JSON File
1. Click **"Save"** button
2. Workflow saved as JSON file
3. Can be imported later

## Node Types

### Navigate
- **Purpose**: Navigate to a URL
- **Properties**:
  - URL: Target URL (e.g., `https://example.com`)
- **Generated Code**:
  ```typescript
  await page.goto('https://example.com');
  await page.waitForLoadState('networkidle');
  ```

### Click
- **Purpose**: Click on an element
- **Properties**:
  - Locator: Playwright locator (e.g., `page.getByRole('button', { name: 'Submit' })`)
- **Generated Code**:
  ```typescript
  await page.getByRole('button', { name: 'Submit' }).click();
  ```

### Input
- **Purpose**: Fill in a form field
- **Properties**:
  - Locator: Playwright locator
  - Value: Text to enter
- **Generated Code**:
  ```typescript
  await page.getByLabel('Email').fill('user@example.com');
  ```

### Wait
- **Purpose**: Wait for a duration
- **Properties**:
  - Duration: Milliseconds to wait
- **Generated Code**:
  ```typescript
  await page.waitForTimeout(1000);
  ```

### Assert
- **Purpose**: Assert element visibility
- **Properties**:
  - Locator: Playwright locator
- **Generated Code**:
  ```typescript
  await expect(page.getByText('Welcome')).toBeVisible();
  ```

## Workflow JSON Format

```json
{
  "name": "My Workflow",
  "nodes": [
    {
      "id": "node-1",
      "type": "navigate",
      "label": "Navigate to Login",
      "url": "https://example.com/login",
      "position": { "x": 250, "y": 50 }
    },
    {
      "id": "node-2",
      "type": "input",
      "label": "Enter Email",
      "selector": "page.getByLabel('Email')",
      "value": "user@example.com",
      "position": { "x": 250, "y": 180 }
    }
  ],
  "edges": [
    {
      "source": "node-1",
      "target": "node-2"
    }
  ]
}
```

## Integration with Flowstral

### Importing from Flowstral

When you import from a Flowstral session:
- Action graph nodes are converted to workflow nodes
- Event types are mapped:
  - `navigate` → Navigate node
  - `click` / `click_button` → Click node
  - `input` / `fill_field` → Input node
  - `wait` → Wait node
  - `assert` → Assert node
- Selectors and values are preserved
- Workflow is ready to edit

### Exporting to Flowstral

When you export to Flowstral:
- Workflow nodes are converted to action graph format
- Compatible with Flowstral's action graph structure
- Can be used for artifact generation
- Preserves all node metadata

## Keyboard Shortcuts

- **Delete**: Delete selected node (when node is selected)
- **Drag**: Move nodes around
- **Pan**: Drag empty canvas area
- **Zoom**: Use zoom controls or mouse wheel (if implemented)

## Tips & Best Practices

1. **Use Semantic Locators**: Prefer `page.getByRole()` and `page.getByLabel()` over CSS selectors
2. **Name Your Steps**: Use descriptive labels for better readability
3. **Test Locators**: Verify locators work before exporting
4. **Save Frequently**: Save your work as JSON files
5. **Import from Flowstral**: Start with a Flowstral recording, then edit visually

## Troubleshooting

### Nodes not appearing
- Check that nodes are within canvas bounds
- Try resetting zoom (click zoom percentage)

### Import fails
- Verify JSON file format is correct
- Check that session ID is valid (for Flowstral import)

### Export fails
- Ensure all required properties are filled
- Check network connection for Flowstral export

## Architecture

The workflow editor is built with:
- **React** - Component framework
- **TypeScript** - Type safety
- **shadcn/ui** - UI components
- **Canvas-based rendering** - For nodes and edges
- **SVG** - For connection arrows

## Future Enhancements

- [ ] Conditional branches
- [ ] Loops and iterations
- [ ] Variable support
- [ ] Test data integration
- [ ] Screenshot capture nodes
- [ ] API call nodes
- [ ] Database query nodes
- [ ] Real-time collaboration



