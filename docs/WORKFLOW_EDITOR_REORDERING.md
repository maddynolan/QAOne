# How to Rearrange Nodes in Workflow Editor

The Workflow Editor provides multiple ways to rearrange nodes and change their execution order.

## Methods to Rearrange Nodes

### 1. **Move Up/Down Buttons** (Easiest)

1. **Click on a node** to select it
2. **Use the ↑ and ↓ buttons** in the Properties panel (right sidebar)
3. Node moves up or down in execution order
4. Edges automatically update to reflect new order

**Visual Feedback:**
- Buttons are disabled if node is already first/last
- Toast notification confirms the move
- Step numbers update automatically

### 2. **Keyboard Shortcuts** (Fastest)

1. **Click on a node** to select it
2. **Press Ctrl+↑** (or Cmd+↑ on Mac) to move up
3. **Press Ctrl+↓** (or Cmd+↓ on Mac) to move down

**Note:** Shortcuts only work when:
- A node is selected
- You're not typing in an input field
- Focus is on the canvas

### 3. **Drag and Drop** (Visual)

1. **Click and drag a node** to a new Y position
2. Execution order is based on **Y position** (top to bottom)
3. Nodes higher on the canvas execute first
4. Edges automatically reconnect based on new order

**Tip:** Use "Auto-Arrange Vertically" to clean up positioning after manual dragging.

### 4. **Auto-Arrange** (Quick Cleanup)

1. Click **"Auto-Arrange Vertically"** button in left sidebar
2. All nodes are automatically arranged in a vertical line
3. Spacing is uniform (130px between nodes)
4. Nodes are centered at X=250
5. Edges are automatically updated

**Use when:**
- Nodes are scattered and hard to follow
- You want clean, organized layout
- After importing a workflow

## Visual Indicators

### Step Numbers
- Each node displays its **step number** (1, 2, 3, etc.)
- Step numbers are calculated based on Y position
- Numbers update automatically when you reorder

### Properties Panel
- Shows **"Step X of Y"** badge when node is selected
- Indicates current position in execution order

### Edges (Arrows)
- Arrows connect nodes in execution order
- Automatically update when you reorder
- Always point from top to bottom (execution flow)

## Execution Order Rules

1. **Top to Bottom**: Nodes higher on canvas execute first
2. **Y Position Determines Order**: Lower Y value = earlier execution
3. **Automatic Edge Updates**: Edges reconnect when order changes
4. **Script Generation**: Generated script follows execution order

## Examples

### Example 1: Move a Node Up

**Before:**
```
Step 1: Navigate
Step 2: Click Button  ← You want this first
Step 3: Fill Input
```

**Action:** Select "Click Button" → Click ↑ button

**After:**
```
Step 1: Click Button  ← Moved up
Step 2: Navigate
Step 3: Fill Input
```

### Example 2: Reorder Multiple Nodes

**Before:**
```
Step 1: Navigate
Step 2: Fill Input
Step 3: Click Button
```

**Desired Order:**
```
Step 1: Navigate
Step 2: Click Button
Step 3: Fill Input
```

**Actions:**
1. Select "Click Button" → Click ↑ (moves to Step 2)
2. Select "Fill Input" → Click ↓ (moves to Step 3)

### Example 3: Clean Up Layout

**Problem:** Nodes are scattered:
- Node 1 at (250, 50)
- Node 2 at (400, 200)
- Node 3 at (100, 350)

**Solution:** Click "Auto-Arrange Vertically"

**Result:** All nodes aligned:
- Node 1 at (250, 50)
- Node 2 at (250, 180)
- Node 3 at (250, 310)

## Tips & Best Practices

1. **Use Auto-Arrange First**: Start with auto-arrange for clean layout
2. **Use Buttons for Precision**: Buttons give exact one-step moves
3. **Use Keyboard for Speed**: Keyboard shortcuts are fastest
4. **Check Step Numbers**: Verify order by looking at step numbers
5. **Test After Reordering**: Run test to verify new order works

## Keyboard Shortcuts Reference

| Shortcut | Action |
|----------|--------|
| `Ctrl+↑` (Windows) / `Cmd+↑` (Mac) | Move selected node up |
| `Ctrl+↓` (Windows) / `Cmd+↓` (Mac) | Move selected node down |

## Troubleshooting

### Node Won't Move Up/Down
- **Check if it's first/last**: Buttons disabled at boundaries
- **Ensure node is selected**: Click node first
- **Check if in input field**: Shortcuts don't work while typing

### Step Numbers Not Updating
- **Refresh view**: Step numbers update on next render
- **Check Y positions**: Step order is based on Y position

### Edges Not Updating
- **Edges auto-update**: Should update automatically
- **Use Auto-Arrange**: Forces edge recalculation
- **Manually drag**: Dragging nodes updates edges

## How It Works

1. **Execution Order** = Nodes sorted by Y position (ascending)
2. **Step Number** = Index in sorted array + 1
3. **Edges** = Connect each node to the next in sorted order
4. **Reordering** = Swapping Y positions of adjacent nodes

The system ensures that:
- ✅ Execution order always matches visual order (top to bottom)
- ✅ Step numbers are always correct
- ✅ Edges always connect in execution sequence
- ✅ Generated script follows execution order



