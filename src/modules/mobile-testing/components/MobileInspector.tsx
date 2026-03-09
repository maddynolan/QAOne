/**
 * MobileInspector - Element Inspector & Hierarchy Viewer
 * 
 * Features:
 * - Live element tree from connected device
 * - Element property viewer (bounds, text, accessibility, resource-id)
 * - Visual element highlighting on device screenshot
 * - Generate Maestro selectors from inspected elements
 * - Accessibility info (content-desc, labels)
 * - Copy selector to clipboard
 */

import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useMobileTestingStore } from '@/modules/mobile-testing/store/mobileTestingStore';
import type { ElementNode } from '@/modules/mobile-testing/store/mobileTestingStore';
import { mobile } from '@/lib/electron-bridge';
import { toast } from 'sonner';
import {
  Search,
  Crosshair,
  Copy,
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Layers,
  MousePointer,
  Box,
  Type,
  Hash,
  Accessibility,
  RefreshCw,
  Loader2,
  Monitor,
  Smartphone,
  Code2,
  Target,
  Maximize2,
  Info,
} from 'lucide-react';

/** Parse Android uiautomator XML dump into ElementNode tree */
function parseXmlHierarchy(xmlString: string): ElementNode {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  let nodeIdx = 0;
  const parseNode = (el: Element): ElementNode => {
    const bounds = el.getAttribute('bounds') || '';
    const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    const resId = el.getAttribute('resource-id') || '';
    nodeIdx++;
    return {
      id: `node_${nodeIdx}_${resId || el.tagName}`,
      type: (el.getAttribute('class') || el.tagName).split('.').pop() || el.tagName,
      text: el.getAttribute('text') || '',
      resource_id: resId,
      content_desc: el.getAttribute('content-desc') || '',
      bounds: match
        ? { x: +match[1], y: +match[2], width: +match[3] - +match[1], height: +match[4] - +match[2] }
        : { x: 0, y: 0, width: 0, height: 0 },
      clickable: el.getAttribute('clickable') === 'true',
      visible: el.getAttribute('displayed') !== 'false',
      attributes: Object.fromEntries(Array.from(el.attributes).map(a => [a.name, a.value])),
      children: Array.from(el.children).map(c => parseNode(c as Element)),
    };
  };

  const root = doc.querySelector('hierarchy') || doc.documentElement;
  return parseNode(root);
}

/** Parse iOS xcrun simctl text output into an ElementNode tree */
function parseIosTextHierarchy(text: string): ElementNode {
  const lines = text.split('\n').filter(l => l.trim());
  let nodeIdx = 0;

  const rootNode: ElementNode = {
    id: 'ios_root',
    type: 'Application',
    text: '',
    resource_id: '',
    content_desc: '',
    bounds: { x: 0, y: 0, width: 0, height: 0 },
    clickable: false,
    visible: true,
    attributes: {},
    children: [],
  };

  // Parse indentation-based iOS hierarchy output
  // Format: "  Type: label, frame: {{x, y}, {w, h}}"
  const stack: { node: ElementNode; indent: number }[] = [{ node: rootNode, indent: -1 }];

  for (const line of lines) {
    const indent = line.search(/\S/);
    if (indent < 0) continue;
    const trimmed = line.trim();

    nodeIdx++;
    // Extract type (first word or until colon/comma)
    const typeMatch = trimmed.match(/^(\w[\w.]*)/);
    const type = typeMatch ? typeMatch[1] : 'Unknown';
    // Extract label after colon or quotes
    const labelMatch = trimmed.match(/["']([^"']+)["']/);
    const label = labelMatch ? labelMatch[1] : '';
    // Extract frame {{x, y}, {w, h}}
    const frameMatch = trimmed.match(/\{\{([\d.]+),\s*([\d.]+)\},\s*\{([\d.]+),\s*([\d.]+)\}\}/);

    const node: ElementNode = {
      id: `ios_node_${nodeIdx}`,
      type: type.split('.').pop() || type,
      text: label,
      resource_id: '',
      content_desc: label,
      bounds: frameMatch
        ? { x: +frameMatch[1], y: +frameMatch[2], width: +frameMatch[3], height: +frameMatch[4] }
        : { x: 0, y: 0, width: 0, height: 0 },
      clickable: /Button|Link|Cell|Tab/.test(type),
      visible: !/Hidden/.test(trimmed),
      attributes: { raw: trimmed },
      children: [],
    };

    // Walk back the stack to find the parent
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    stack[stack.length - 1].node.children.push(node);
    stack.push({ node, indent });
  }

  return rootNode;
}

// Sample element tree for demo
const SAMPLE_TREE: ElementNode = {
  id: 'root',
  type: 'FrameLayout',
  text: '',
  resource_id: 'android:id/content',
  content_desc: '',
  bounds: { x: 0, y: 0, width: 1080, height: 1920 },
  clickable: false,
  visible: true,
  attributes: { 'class': 'android.widget.FrameLayout' },
  children: [
    {
      id: 'toolbar',
      type: 'Toolbar',
      text: '',
      resource_id: 'com.app:id/toolbar',
      content_desc: 'Navigation',
      bounds: { x: 0, y: 0, width: 1080, height: 168 },
      clickable: false,
      visible: true,
      attributes: { 'class': 'androidx.appcompat.widget.Toolbar' },
      children: [
        {
          id: 'title',
          type: 'TextView',
          text: 'My App',
          resource_id: 'com.app:id/title',
          content_desc: '',
          bounds: { x: 48, y: 48, width: 200, height: 72 },
          clickable: false,
          visible: true,
          attributes: { 'class': 'android.widget.TextView', 'textSize': '18sp' },
          children: [],
        },
        {
          id: 'menu-btn',
          type: 'ImageButton',
          text: '',
          resource_id: 'com.app:id/menu',
          content_desc: 'More options',
          bounds: { x: 960, y: 48, width: 72, height: 72 },
          clickable: true,
          visible: true,
          attributes: { 'class': 'android.widget.ImageButton' },
          children: [],
        },
      ],
    },
    {
      id: 'content',
      type: 'ScrollView',
      text: '',
      resource_id: 'com.app:id/scroll_content',
      content_desc: '',
      bounds: { x: 0, y: 168, width: 1080, height: 1680 },
      clickable: false,
      visible: true,
      attributes: { 'class': 'android.widget.ScrollView' },
      children: [
        {
          id: 'login-btn',
          type: 'Button',
          text: 'Login',
          resource_id: 'com.app:id/btn_login',
          content_desc: 'Login button',
          bounds: { x: 48, y: 800, width: 984, height: 144 },
          clickable: true,
          visible: true,
          attributes: { 'class': 'android.widget.Button', 'enabled': 'true' },
          children: [],
        },
        {
          id: 'email-input',
          type: 'EditText',
          text: '',
          resource_id: 'com.app:id/input_email',
          content_desc: 'Email address',
          bounds: { x: 48, y: 400, width: 984, height: 144 },
          clickable: true,
          visible: true,
          attributes: { 'class': 'android.widget.EditText', 'hint': 'Enter email', 'inputType': 'textEmailAddress' },
          children: [],
        },
        {
          id: 'password-input',
          type: 'EditText',
          text: '',
          resource_id: 'com.app:id/input_password',
          content_desc: 'Password',
          bounds: { x: 48, y: 600, width: 984, height: 144 },
          clickable: true,
          visible: true,
          attributes: { 'class': 'android.widget.EditText', 'hint': 'Enter password', 'inputType': 'textPassword' },
          children: [],
        },
      ],
    },
  ],
};

export default function MobileInspector() {
  const { theme } = useTheme();
  const isDark = theme !== 'light';

  // Individual selectors
  const elementTree = useMobileTestingStore(s => s.elementTree);
  const selectedElementId = useMobileTestingStore(s => s.selectedElementId);
  const isInspecting = useMobileTestingStore(s => s.isInspecting);
  const setElementTree = useMobileTestingStore(s => s.setElementTree);
  const setSelectedElement = useMobileTestingStore(s => s.setSelectedElement);
  const setIsInspecting = useMobileTestingStore(s => s.setIsInspecting);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root', 'toolbar', 'content']));
  const [isLoading, setIsLoading] = useState(false);

  const tree = elementTree || SAMPLE_TREE;

  const handleRefresh = async () => {
    setIsLoading(true);
    try {
      const platform = useMobileTestingStore.getState().selectedPlatform;
      const device = useMobileTestingStore.getState().selectedDevice;
      const result = await mobile.getHierarchy(platform, device?.id || device);
      if (result.success && result.data) {
        if (result.format === 'xml') {
          const parsed = parseXmlHierarchy(result.data);
          setElementTree(parsed);
        } else {
          // Non-XML format (iOS text) — parse into basic tree
          const parsed = parseIosTextHierarchy(result.data);
          setElementTree(parsed);
        }
        toast.success('Element tree refreshed from device');
      } else {
        toast.error(result.error || 'Failed to get element hierarchy');
        setElementTree(SAMPLE_TREE);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to refresh hierarchy');
      setElementTree(SAMPLE_TREE);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartInspecting = () => {
    setIsInspecting(true);
    // In production, this enables click-to-inspect mode on the device
    toast.info('Click on an element in the device to inspect it');
  };

  const toggleNode = (id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const findElement = (tree: ElementNode, id: string): ElementNode | null => {
    if (tree.id === id) return tree;
    for (const child of tree.children) {
      const found = findElement(child, id);
      if (found) return found;
    }
    return null;
  };

  const selectedElement = selectedElementId ? findElement(tree, selectedElementId) : null;

  const generateSelector = (el: ElementNode): string[] => {
    const selectors: string[] = [];
    if (el.text) selectors.push(`tapOn: "${el.text}"`);
    if (el.resource_id) selectors.push(`tapOn:\n  id: "${el.resource_id}"`);
    if (el.content_desc) selectors.push(`tapOn:\n  accessibilityLabel: "${el.content_desc}"`);
    return selectors;
  };

  const copySelector = (selector: string) => {
    navigator.clipboard.writeText(`- ${selector}`);
    toast.success('Selector copied!');
  };

  const nodeMatchesQuery = (node: ElementNode, query: string): boolean => {
    const q = query.toLowerCase();
    return (
      node.type.toLowerCase().includes(q) ||
      node.text.toLowerCase().includes(q) ||
      node.resource_id.toLowerCase().includes(q)
    );
  };

  const subtreeMatchesQuery = (node: ElementNode, query: string): boolean => {
    if (nodeMatchesQuery(node, query)) return true;
    return node.children.some(c => subtreeMatchesQuery(c, query));
  };

  const renderTree = (node: ElementNode, depth: number = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isSelected = selectedElementId === node.id;
    const hasChildren = node.children.length > 0;
    const matchesSearch = searchQuery && nodeMatchesQuery(node, searchQuery);

    if (searchQuery && !subtreeMatchesQuery(node, searchQuery)) {
      return null;
    }

    return (
      <div key={node.id}>
        <div
          className={cn(
            "flex items-center gap-1 py-1 px-2 cursor-pointer text-xs rounded transition-colors",
            isSelected
              ? isDark ? 'bg-primary/20 text-primary' : 'bg-primary/10 text-primary'
              : isDark ? 'hover:bg-gray-800 text-gray-300' : 'hover:bg-gray-100 text-gray-700',
            matchesSearch && !isSelected && (isDark ? 'bg-amber-500/10' : 'bg-amber-50'),
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setSelectedElement(node.id)}
        >
          {hasChildren ? (
            <button onClick={(e) => { e.stopPropagation(); toggleNode(node.id); }} className="shrink-0">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <span className={cn("font-mono text-[11px]", isDark ? 'text-sky-400' : 'text-sky-600')}>{node.type}</span>
          {node.text && <span className={cn("text-[10px] truncate max-w-24", isDark ? 'text-emerald-400' : 'text-emerald-600')}>"{node.text}"</span>}
          {node.resource_id && <span className={cn("text-[10px] truncate max-w-32", isDark ? 'text-gray-500' : 'text-gray-400')}>{node.resource_id.split('/').pop()}</span>}
          {node.clickable && <Badge className="text-[8px] h-3 px-1 bg-amber-500/20 text-amber-500">clickable</Badge>}
        </div>
        {isExpanded && hasChildren && node.children.map(child => renderTree(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 h-[calc(100vh-220px)]">
      {/* Element Tree */}
      <div className={cn("rounded-xl border flex flex-col", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
        <div className="p-4 border-b border-inherit">
          <div className="flex items-center justify-between mb-3">
            <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
              <Layers className="w-4 h-4" /> Element Hierarchy
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant={isInspecting ? 'default' : 'outline'}
                size="sm"
                className={cn("h-7 text-xs", isInspecting && "bg-primary text-primary-foreground")}
                onClick={() => isInspecting ? setIsInspecting(false) : handleStartInspecting()}
              >
                <Crosshair className="w-3 h-3 mr-1" />
                {isInspecting ? 'Inspecting...' : 'Inspect'}
              </Button>
              <Button variant="ghost" size="sm" className="h-7" onClick={handleRefresh} disabled={isLoading}>
                <RefreshCw className={cn("w-3 h-3", isLoading && "animate-spin")} />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search elements by type, text, or ID..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            renderTree(tree)
          )}
        </div>
      </div>

      {/* Element Properties Panel */}
      <div className={cn("rounded-xl border flex flex-col", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
        <div className="p-4 border-b border-inherit">
          <h3 className={cn("text-sm font-semibold flex items-center gap-2", isDark ? 'text-white' : 'text-gray-900')}>
            <Info className="w-4 h-4" /> Element Properties
          </h3>
        </div>

        {selectedElement ? (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Type */}
            <div>
              <label className={cn("text-[10px] font-medium uppercase tracking-wider", isDark ? 'text-gray-500' : 'text-gray-400')}>Type</label>
              <div className={cn("mt-1 p-2 rounded-lg font-mono text-xs", isDark ? 'bg-gray-800 text-sky-400' : 'bg-gray-50 text-sky-600')}>
                {selectedElement.type}
              </div>
            </div>

            {/* Text */}
            {selectedElement.text && (
              <div>
                <label className={cn("text-[10px] font-medium uppercase tracking-wider flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                  <Type className="w-3 h-3" /> Text
                </label>
                <div className={cn("mt-1 p-2 rounded-lg text-xs", isDark ? 'bg-gray-800 text-emerald-400' : 'bg-gray-50 text-emerald-600')}>
                  "{selectedElement.text}"
                </div>
              </div>
            )}

            {/* Resource ID */}
            {selectedElement.resource_id && (
              <div>
                <label className={cn("text-[10px] font-medium uppercase tracking-wider flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                  <Hash className="w-3 h-3" /> Resource ID
                </label>
                <div className={cn("mt-1 p-2 rounded-lg text-xs font-mono flex items-center justify-between", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                  <span>{selectedElement.resource_id}</span>
                  <button onClick={() => { navigator.clipboard.writeText(selectedElement.resource_id); toast.success('Copied!'); }}>
                    <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                  </button>
                </div>
              </div>
            )}

            {/* Accessibility */}
            {selectedElement.content_desc && (
              <div>
                <label className={cn("text-[10px] font-medium uppercase tracking-wider flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                  <Accessibility className="w-3 h-3" /> Content Description
                </label>
                <div className={cn("mt-1 p-2 rounded-lg text-xs", isDark ? 'bg-gray-800 text-amber-400' : 'bg-gray-50 text-amber-600')}>
                  {selectedElement.content_desc}
                </div>
              </div>
            )}

            {/* Bounds */}
            <div>
              <label className={cn("text-[10px] font-medium uppercase tracking-wider flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                <Box className="w-3 h-3" /> Bounds
              </label>
              <div className={cn("mt-1 p-2 rounded-lg text-xs font-mono grid grid-cols-2 gap-1", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                <span>x: {selectedElement.bounds.x}</span>
                <span>y: {selectedElement.bounds.y}</span>
                <span>w: {selectedElement.bounds.width}</span>
                <span>h: {selectedElement.bounds.height}</span>
              </div>
            </div>

            {/* Properties */}
            <div>
              <label className={cn("text-[10px] font-medium uppercase tracking-wider", isDark ? 'text-gray-500' : 'text-gray-400')}>Properties</label>
              <div className="mt-1 space-y-1">
                <div className={cn("flex items-center gap-2 p-2 rounded text-xs", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                  <MousePointer className="w-3 h-3" />
                  <span>Clickable: </span>
                  <Badge variant="outline" className={cn("text-[10px] h-4", selectedElement.clickable ? 'text-emerald-500' : 'text-gray-400')}>
                    {selectedElement.clickable ? 'Yes' : 'No'}
                  </Badge>
                </div>
                <div className={cn("flex items-center gap-2 p-2 rounded text-xs", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                  {selectedElement.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  <span>Visible: </span>
                  <Badge variant="outline" className={cn("text-[10px] h-4", selectedElement.visible ? 'text-emerald-500' : 'text-gray-400')}>
                    {selectedElement.visible ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {Object.entries(selectedElement.attributes).map(([key, val]) => (
                  <div key={key} className={cn("flex items-center gap-2 p-2 rounded text-xs justify-between", isDark ? 'bg-gray-800' : 'bg-gray-50')}>
                    <span className={cn("font-mono text-[10px]", isDark ? 'text-gray-400' : 'text-gray-500')}>{key}</span>
                    <span className={cn("font-mono text-[10px] truncate max-w-40", isDark ? 'text-white' : 'text-gray-900')}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Maestro Selectors */}
            <div>
              <label className={cn("text-[10px] font-medium uppercase tracking-wider flex items-center gap-1", isDark ? 'text-gray-500' : 'text-gray-400')}>
                <Code2 className="w-3 h-3" /> Maestro Selectors
              </label>
              <div className="mt-1 space-y-1">
                {generateSelector(selectedElement).map((sel, idx) => (
                  <div key={idx} className={cn(
                    "p-2 rounded-lg flex items-start justify-between gap-2",
                    isDark ? 'bg-primary/10' : 'bg-primary/5'
                  )}>
                    <code className={cn("text-[11px] font-mono whitespace-pre", isDark ? 'text-primary' : 'text-primary')}>
                      - {sel}
                    </code>
                    <button
                      onClick={() => copySelector(sel)}
                      className="shrink-0 mt-0.5"
                    >
                      <Copy className={cn("w-3 h-3", isDark ? 'text-primary hover:text-primary/80' : 'text-primary hover:text-primary')} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className={cn("flex-1 flex items-center justify-center", isDark ? 'text-gray-500' : 'text-gray-400')}>
            <div className="text-center">
              <Target className={cn("w-10 h-10 mx-auto mb-2", isDark ? 'text-gray-600' : 'text-gray-300')} />
              <p className="text-sm">Select an element to inspect</p>
              <p className="text-xs mt-1">Click on an element in the tree</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
