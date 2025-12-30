import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  Play, Save, Download, Trash2, Plus, Code, MousePointer, 
  Type, Navigation, Clock, CheckCircle, GitBranch, Repeat,
  Zap, Eye, Move, ZoomIn, ZoomOut, Upload
} from 'lucide-react';

// Node Component
const NodeComponent = ({ node, isSelected, onClick, onDragStart }) => {
  const getIcon = () => {
    switch (node.data.type) {
      case 'navigate': return <Navigation className="h-4 w-4" />;
      case 'click': return <MousePointer className="h-4 w-4" />;
      case 'input': return <Type className="h-4 w-4" />;
      case 'wait': return <Clock className="h-4 w-4" />;
      case 'assert': return <CheckCircle className="h-4 w-4" />;
      case 'condition': return <GitBranch className="h-4 w-4" />;
      case 'loop': return <Repeat className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getColor = () => {
    switch (node.data.type) {
      case 'navigate': return 'border-blue-500 bg-blue-50';
      case 'click': return 'border-green-500 bg-green-50';
      case 'input': return 'border-purple-500 bg-purple-50';
      case 'wait': return 'border-yellow-500 bg-yellow-50';
      case 'assert': return 'border-red-500 bg-red-50';
      case 'condition': return 'border-orange-500 bg-orange-50';
      case 'loop': return 'border-pink-500 bg-pink-50';
      default: return 'border-gray-500 bg-gray-50';
    }
  };

  const getIconColor = () => {
    switch (node.data.type) {
      case 'navigate': return 'bg-blue-500';
      case 'click': return 'bg-green-500';
      case 'input': return 'bg-purple-500';
      case 'wait': return 'bg-yellow-500';
      case 'assert': return 'bg-red-500';
      case 'condition': return 'bg-orange-500';
      case 'loop': return 'bg-pink-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        cursor: 'move'
      }}
      className={`
        px-4 py-3 rounded-lg border-2 bg-white shadow-md min-w-[200px] max-w-[250px]
        ${isSelected ? 'border-blue-600 shadow-lg ring-2 ring-blue-200' : getColor()}
        hover:shadow-lg transition-all
      `}
    >
      {/* Connection Point Top */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full hover:border-blue-500" />
      
      <div className="flex items-center gap-2 mb-1">
        <div className={`${getIconColor()} text-white p-1.5 rounded`}>
          {getIcon()}
        </div>
        <div className="font-semibold text-sm text-gray-800">{node.data.label}</div>
      </div>
      
      {node.data.selector && (
        <div className="text-xs text-gray-600 mt-1 truncate">
          {node.data.selector}
        </div>
      )}
      
      {node.data.value && (
        <div className="text-xs text-gray-600 mt-1 truncate">
          Value: {node.data.value}
        </div>
      )}
      
      {node.data.url && (
        <div className="text-xs text-gray-600 mt-1 truncate">
          {node.data.url}
        </div>
      )}
      
      {/* Connection Point Bottom */}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-gray-400 rounded-full hover:border-blue-500" />
    </div>
  );
};

// Main Component
export default function VisualWorkflowEditor() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [workflowName, setWorkflowName] = useState('My Workflow');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draggingNode, setDraggingNode] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  const canvasRef = useRef(null);

  // Sample initial workflow
  useEffect(() => {
    const sampleNodes = [
      {
        id: '1',
        position: { x: 250, y: 50 },
        data: { 
          type: 'navigate',
          label: 'Navigate to Login',
          url: 'https://example.com/login'
        },
      },
      {
        id: '2',
        position: { x: 250, y: 180 },
        data: { 
          type: 'input',
          label: 'Enter Email',
          selector: "page.getByLabel('Email')",
          value: 'user@example.com'
        },
      },
      {
        id: '3',
        position: { x: 250, y: 310 },
        data: { 
          type: 'input',
          label: 'Enter Password',
          selector: "page.getByLabel('Password')",
          value: '••••••••'
        },
      },
      {
        id: '4',
        position: { x: 250, y: 440 },
        data: { 
          type: 'click',
          label: 'Click Login Button',
          selector: "page.getByRole('button', { name: 'Login' })"
        },
      },
      {
        id: '5',
        position: { x: 250, y: 570 },
        data: { 
          type: 'assert',
          label: 'Verify Dashboard',
          selector: "page.getByText('Welcome')"
        },
      },
    ];

    const sampleEdges = [
      { id: 'e1-2', source: '1', target: '2' },
      { id: 'e2-3', source: '2', target: '3' },
      { id: 'e3-4', source: '3', target: '4' },
      { id: 'e4-5', source: '4', target: '5' },
    ];

    setNodes(sampleNodes);
    setEdges(sampleEdges);
  }, []);

  // Handle node dragging
  const handleNodeDragStart = (node, e) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    const offsetX = e.clientX - rect.left - node.position.x * zoom - pan.x * zoom;
    const offsetY = e.clientY - rect.top - node.position.y * zoom - pan.y * zoom;
    
    setDraggingNode(node);
    setDragOffset({ x: offsetX, y: offsetY });
    setSelectedNode(node);
  };

  const handleCanvasMouseMove = (e) => {
    if (draggingNode) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x * zoom - dragOffset.x) / zoom;
      const y = (e.clientY - rect.top - pan.y * zoom - dragOffset.y) / zoom;

      setNodes(nds =>
        nds.map(node =>
          node.id === draggingNode.id
            ? { ...node, position: { x: Math.round(x), y: Math.round(y) } }
            : node
        )
      );
    } else if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      setPan({ x: pan.x + dx / zoom, y: pan.y + dy / zoom });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
    setIsPanning(false);
  };

  const handleCanvasMouseDown = (e) => {
    if (e.target === canvasRef.current || e.target.tagName === 'svg') {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      setSelectedNode(null);
    }
  };

  // Render edges/arrows
  const renderEdges = () => {
    return edges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      
      if (!sourceNode || !targetNode) return null;

      const startX = sourceNode.position.x + 125; // center of node (250px / 2)
      const startY = sourceNode.position.y + 80; // bottom of node
      const endX = targetNode.position.x + 125;
      const endY = targetNode.position.y - 10; // top of node

      return (
        <g key={edge.id}>
          <path
            d={`M ${startX} ${startY} L ${endX} ${endY}`}
            stroke="#94a3b8"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        </g>
      );
    });
  };

  const addNode = (type) => {
    const nodeConfig = {
      navigate: { label: 'New Navigate', icon: '🔗' },
      click: { label: 'New Click', icon: '👆' },
      input: { label: 'New Input', icon: '⌨️' },
      wait: { label: 'New Wait', icon: '⏱️' },
      assert: { label: 'New Assert', icon: '✓' },
      condition: { label: 'New Condition', icon: '?' },
      loop: { label: 'New Loop', icon: '🔄' },
    };

    const config = nodeConfig[type] || nodeConfig.click;

    const newNode = {
      id: `${Date.now()}`,
      position: { 
        x: 250, 
        y: nodes.length > 0 ? Math.max(...nodes.map(n => n.position.y)) + 150 : 50
      },
      data: {
        type,
        label: config.label,
        selector: '',
        value: '',
      },
    };
    
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);

    // Auto-connect to last node
    if (nodes.length > 0) {
      const lastNode = nodes[nodes.length - 1];
      const newEdge = {
        id: `e${lastNode.id}-${newNode.id}`,
        source: lastNode.id,
        target: newNode.id
      };
      setEdges(eds => [...eds, newEdge]);
    }
  };

  const deleteNode = () => {
    if (!selectedNode) return;
    
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => 
      e.source !== selectedNode.id && e.target !== selectedNode.id
    ));
    setSelectedNode(null);
  };

  const updateNodeData = (field, value) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) =>
        node.id === selectedNode.id
          ? { 
              ...node, 
              data: { ...node.data, [field]: value } 
            }
          : node
      )
    );
    
    setSelectedNode(prev => ({
      ...prev,
      data: { ...prev.data, [field]: value }
    }));
  };

  const exportToPlaywright = () => {
    let script = `// Playwright Test Script\n`;
    script += `// Generated from: ${workflowName}\n\n`;
    script += `import { test, expect } from '@playwright/test';\n\n`;
    script += `test('${workflowName}', async ({ page }) => {\n`;

    const sortedNodes = [...nodes].sort((a, b) => a.position.y - b.position.y);

    sortedNodes.forEach((node) => {
      const { type, label, selector, value, url } = node.data;
      
      script += `  // ${label}\n`;
      
      switch (type) {
        case 'navigate':
          script += `  await page.goto('${url || 'https://example.com'}');\n`;
          break;
        case 'click':
          script += `  await ${selector || "page.locator('button')"}.click();\n`;
          break;
        case 'input':
          script += `  await ${selector || "page.locator('input')"}.fill('${value || ''}');\n`;
          break;
        case 'wait':
          script += `  await page.waitForTimeout(${value || 1000});\n`;
          break;
        case 'assert':
          script += `  await expect(${selector || "page.locator('body')"}).toBeVisible();\n`;
          break;
        case 'condition':
          script += `  // TODO: Add condition logic\n`;
          break;
        case 'loop':
          script += `  // TODO: Add loop logic\n`;
          break;
      }
      script += '\n';
    });

    script += `});\n`;

    const blob = new Blob([script], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}.spec.ts`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const saveWorkflow = () => {
    const workflow = {
      name: workflowName,
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.data.type,
        label: n.data.label,
        selector: n.data.selector,
        value: n.data.value,
        url: n.data.url,
        position: n.position
      })),
      edges: edges.map(e => ({
        source: e.source,
        target: e.target
      }))
    };
    
    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_')}_workflow.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importWorkflow = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workflow = JSON.parse(e.target.result);
        setWorkflowName(workflow.name || 'Imported Workflow');
        setNodes(workflow.nodes || []);
        setEdges(workflow.edges || []);
        setSelectedNode(null);
      } catch (error) {
        alert('Error importing workflow: ' + error.message);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            className="text-xl font-semibold border-0 border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-2 py-1"
          />
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {nodes.length} steps
          </span>
        </div>

        <div className="flex items-center gap-2">
          <label className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 cursor-pointer">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".json"
              onChange={importWorkflow}
              className="hidden"
            />
          </label>
          <button
            onClick={saveWorkflow}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Save className="h-4 w-4" />
            Save
          </button>
          <button
            onClick={exportToPlaywright}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Code className="h-4 w-4" />
            Export
          </button>
          <button
            onClick={() => alert('Executing workflow... (This would run the Playwright script)')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Execute
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        <div className="w-64 bg-white border-r p-4 overflow-y-auto">
          <h3 className="font-semibold mb-4 text-gray-700">Add Actions</h3>
          <div className="space-y-2">
            {[
              { type: 'navigate', icon: <Navigation className="h-4 w-4" />, label: 'Navigate', color: 'blue' },
              { type: 'click', icon: <MousePointer className="h-4 w-4" />, label: 'Click', color: 'green' },
              { type: 'input', icon: <Type className="h-4 w-4" />, label: 'Input', color: 'purple' },
              { type: 'wait', icon: <Clock className="h-4 w-4" />, label: 'Wait', color: 'yellow' },
              { type: 'assert', icon: <CheckCircle className="h-4 w-4" />, label: 'Assert', color: 'red' },
              { type: 'condition', icon: <GitBranch className="h-4 w-4" />, label: 'Condition', color: 'orange' },
              { type: 'loop', icon: <Repeat className="h-4 w-4" />, label: 'Loop', color: 'pink' },
            ].map((action) => (
              <button
                key={action.type}
                onClick={() => addNode(action.type)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 bg-white hover:bg-gray-50 flex items-center gap-3 transition-all text-gray-700 font-medium"
              >
                <div className={`bg-${action.color}-500 text-white p-1.5 rounded`}>
                  {action.icon}
                </div>
                {action.label}
              </button>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <h4 className="font-semibold text-sm text-blue-900 mb-2">💡 Integration</h4>
            <p className="text-xs text-blue-700">
              Import recordings from Flowstral Recorder or build workflows from scratch. Export to Playwright when ready.
            </p>
          </div>
        </div>

        {/* Canvas */}
        <div 
          ref={canvasRef}
          className="flex-1 relative overflow-hidden bg-gray-50"
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseDown={handleCanvasMouseDown}
          style={{ 
            backgroundImage: 'radial-gradient(circle, #d1d5db 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            cursor: isPanning ? 'grabbing' : 'grab'
          }}
        >
          {/* SVG for arrows */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0'
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="10"
                refX="9"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
              </marker>
            </defs>
            {renderEdges()}
          </svg>

          {/* Nodes */}
          <div 
            className="absolute inset-0"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: '0 0'
            }}
          >
            {nodes.map((node) => (
              <NodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNode?.id === node.id}
                onClick={() => setSelectedNode(node)}
                onDragStart={(e) => handleNodeDragStart(node, e)}
              />
            ))}
          </div>

          {/* Mini Controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-2 bg-white rounded-lg shadow-lg p-2">
            <button
              onClick={() => setZoom(z => Math.min(z + 0.1, 2))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))}
              className="p-2 hover:bg-gray-100 rounded"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
              className="p-2 hover:bg-gray-100 rounded text-xs"
              title="Reset View"
            >
              {Math.round(zoom * 100)}%
            </button>
          </div>

          {/* Instructions */}
          <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg p-3">
            <div className="text-xs text-gray-600 space-y-1">
              <div className="flex items-center gap-2">
                <Move className="h-3 w-3" />
                <span>Drag nodes to move • Drag canvas to pan</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3" />
                <span>Click nodes to edit properties</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sidebar - Properties */}
        {selectedNode && (
          <div className="w-80 bg-white border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-700">Properties</h3>
              <button
                onClick={deleteNode}
                className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                title="Delete node"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Step Name
                </label>
                <input
                  type="text"
                  value={selectedNode.data.label}
                  onChange={(e) => updateNodeData('label', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Selector */}
              {['click', 'input', 'assert'].includes(selectedNode.data.type) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Locator
                  </label>
                  <textarea
                    value={selectedNode.data.selector}
                    onChange={(e) => updateNodeData('selector', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    rows={3}
                    placeholder="page.getByRole('button', { name: 'Submit' })"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use Playwright locator syntax
                  </p>
                </div>
              )}

              {/* Value */}
              {selectedNode.data.type === 'input' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Value
                  </label>
                  <input
                    type="text"
                    value={selectedNode.data.value}
                    onChange={(e) => updateNodeData('value', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Text to enter"
                  />
                </div>
              )}

              {/* URL */}
              {selectedNode.data.type === 'navigate' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL
                  </label>
                  <input
                    type="url"
                    value={selectedNode.data.url}
                    onChange={(e) => updateNodeData('url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="https://example.com"
                  />
                </div>
              )}

              {/* Duration */}
              {selectedNode.data.type === 'wait' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Duration (ms)
                  </label>
                  <input
                    type="number"
                    value={selectedNode.data.value || 1000}
                    onChange={(e) => updateNodeData('value', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="1000"
                  />
                </div>
              )}

              {/* Preview */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                <pre className="text-xs text-gray-600 overflow-x-auto whitespace-pre-wrap">
{selectedNode.data.type === 'navigate' && `await page.goto('${selectedNode.data.url || 'URL'}');`}
{selectedNode.data.type === 'click' && `await ${selectedNode.data.selector || 'locator'}.click();`}
{selectedNode.data.type === 'input' && `await ${selectedNode.data.selector || 'locator'}.fill('${selectedNode.data.value || 'value'}');`}
{selectedNode.data.type === 'wait' && `await page.waitForTimeout(${selectedNode.data.value || 1000});`}
{selectedNode.data.type === 'assert' && `await expect(${selectedNode.data.selector || 'locator'}).toBeVisible();`}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
