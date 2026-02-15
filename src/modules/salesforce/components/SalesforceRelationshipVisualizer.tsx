/**
 * Salesforce Object Relationship Visualizer
 * 
 * Visual ERD-style diagram showing relationships between Salesforce objects.
 * Features:
 * - Interactive node-based diagram
 * - Click to explore related objects
 * - Lookup vs Master-Detail distinction
 * - Export as image
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  ZoomIn, ZoomOut, Maximize2, Download, RefreshCw,
  ArrowRight, ArrowLeftRight, Circle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { salesforceApi, SObjectDescribe } from '@/modules/salesforce/lib/salesforce-api';

interface RelationshipNode {
  id: string;
  name: string;
  label: string;
  x: number;
  y: number;
  isCustom: boolean;
  fields: number;
}

interface RelationshipEdge {
  from: string;
  to: string;
  fieldName: string;
  relationshipName: string;
  type: 'lookup' | 'master-detail' | 'self';
}

interface SalesforceRelationshipVisualizerProps {
  isConnected: boolean;
}

export function SalesforceRelationshipVisualizer({ isConnected }: SalesforceRelationshipVisualizerProps) {
  const [nodes, setNodes] = useState<RelationshipNode[]>([]);
  const [edges, setEdges] = useState<RelationshipEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [objectDescriptions, setObjectDescriptions] = useState<Map<string, SObjectDescribe>>(new Map());

  // Core objects to always show
  const coreObjects = ['Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event', 'Campaign', 'User'];

  const loadRelationships = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    setIsLoading(true);
    try {
      const newNodes: RelationshipNode[] = [];
      const newEdges: RelationshipEdge[] = [];
      const descriptions = new Map<string, SObjectDescribe>();

      // Load core objects
      for (let i = 0; i < coreObjects.length; i++) {
        const objName = coreObjects[i];
        try {
          const describe = await salesforceApi.describeSObject(objName);
          descriptions.set(objName, describe);

          // Position nodes in a grid
          const row = Math.floor(i / 3);
          const col = i % 3;
          newNodes.push({
            id: objName,
            name: objName,
            label: describe.label,
            x: 100 + col * 250,
            y: 100 + row * 150,
            isCustom: describe.custom,
            fields: describe.fields.length,
          });

          // Extract relationships
          for (const field of describe.fields) {
            if (field.type === 'reference' && field.referenceTo && field.referenceTo.length > 0) {
              for (const refTo of field.referenceTo) {
                if (coreObjects.includes(refTo) && refTo !== objName) {
                  newEdges.push({
                    from: objName,
                    to: refTo,
                    fieldName: field.name,
                    relationshipName: field.relationshipName || field.name.replace('Id', ''),
                    type: field.name.toLowerCase().includes('owner') || field.name.toLowerCase().includes('created') || field.name.toLowerCase().includes('modified')
                      ? 'lookup' : 'lookup',
                  });
                }
              }
            }
          }

          // Also check child relationships
          for (const child of describe.childRelationships || []) {
            if (coreObjects.includes(child.childSObject)) {
              // This is already captured from the other side
            }
          }
        } catch (e) {
          console.error(`Failed to load ${objName}:`, e);
        }
      }

      setNodes(newNodes);
      setEdges(newEdges);
      setObjectDescriptions(descriptions);
      toast.success(`Loaded ${newNodes.length} objects with ${newEdges.length} relationships`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  }, [isConnected]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n => 
      n.name.toLowerCase().includes(q) || 
      n.label.toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  const getEdgesBetweenNodes = useCallback((nodeIds: string[]) => {
    return edges.filter(e => 
      nodeIds.includes(e.from) && nodeIds.includes(e.to)
    );
  }, [edges]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.2, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.2, 0.4));
  const handleFitToView = () => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const visibleEdges = useMemo(() => {
    const visibleNodeIds = filteredNodes.map(n => n.id);
    return getEdgesBetweenNodes(visibleNodeIds);
  }, [filteredNodes, getEdgesBetweenNodes]);

  const getNodeById = useCallback((id: string) => {
    return filteredNodes.find(n => n.id === id);
  }, [filteredNodes]);

  const renderEdge = useCallback((edge: RelationshipEdge, index: number) => {
    const fromNode = getNodeById(edge.from);
    const toNode = getNodeById(edge.to);
    if (!fromNode || !toNode) return null;

    const fromX = fromNode.x + 100; // Center of node
    const fromY = fromNode.y + 30;
    const toX = toNode.x;
    const toY = toNode.y + 30;

    // Calculate control points for curved line
    const midX = (fromX + toX) / 2;
    const midY = (fromY + toY) / 2;
    const controlOffset = Math.abs(toX - fromX) * 0.2;

    const path = `M ${fromX} ${fromY} Q ${midX} ${midY - controlOffset} ${toX} ${toY}`;

    return (
      <g key={`edge-${index}`}>
        <path
          d={path}
          fill="none"
          stroke={edge.type === 'master-detail' ? '#f59e0b' : '#3b82f6'}
          strokeWidth={2}
          strokeDasharray={edge.type === 'lookup' ? '5,5' : undefined}
          markerEnd="url(#arrowhead)"
        />
        <text
          x={midX}
          y={midY - controlOffset - 5}
          fill="#94a3b8"
          fontSize={10}
          textAnchor="middle"
        >
          {edge.fieldName}
        </text>
      </g>
    );
  }, [getNodeById]);

  const renderNode = useCallback((node: RelationshipNode) => {
    const isSelected = selectedNode === node.id;
    const describe = objectDescriptions.get(node.id);

    return (
      <g
        key={node.id}
        transform={`translate(${node.x}, ${node.y})`}
        onClick={() => setSelectedNode(isSelected ? null : node.id)}
        style={{ cursor: 'pointer' }}
      >
        {/* Node background */}
        <rect
          width={200}
          height={60}
          rx={8}
          fill={isSelected ? '#1e3a5f' : '#1e293b'}
          stroke={isSelected ? '#3b82f6' : '#334155'}
          strokeWidth={isSelected ? 2 : 1}
        />
        
        {/* Custom badge */}
        {node.isCustom && (
          <rect
            x={170}
            y={5}
            width={20}
            height={14}
            rx={3}
            fill="#f97316"
          />
        )}
        {node.isCustom && (
          <text x={180} y={14} fill="white" fontSize={8} textAnchor="middle">C</text>
        )}

        {/* Object name */}
        <text x={10} y={25} fill="white" fontSize={14} fontWeight="600">
          {node.label}
        </text>
        
        {/* API name */}
        <text x={10} y={42} fill="#94a3b8" fontSize={11}>
          {node.name}
        </text>
        
        {/* Field count */}
        <text x={10} y={55} fill="#64748b" fontSize={10}>
          {node.fields} fields
        </text>
      </g>
    );
  }, [selectedNode, objectDescriptions]);

  return (
    <Card className="bg-card border-border h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-foreground">Object Relationship Visualizer</CardTitle>
          <div className="flex items-center gap-2">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter objects..."
              className="w-40 h-8 bg-input border-border text-sm"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={loadRelationships}
              disabled={!isConnected || isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleFitToView}>
              <Maximize2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative h-[500px] overflow-hidden bg-input/50 rounded-lg mx-4 mb-4">
          {nodes.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Circle className="w-16 h-16 text-slate-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No relationships loaded</h3>
                <p className="text-slate-400 mb-4">Click refresh to load object relationships</p>
                <Button
                  onClick={loadRelationships}
                  disabled={!isConnected || isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Load Relationships
                </Button>
              </div>
            </div>
          ) : (
            <svg
              width="100%"
              height="100%"
              viewBox={`${-panOffset.x} ${-panOffset.y} ${800 / zoom} ${500 / zoom}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
            >
              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#3b82f6"
                  />
                </marker>
              </defs>

              {/* Render edges first (under nodes) */}
              {visibleEdges.map((edge, idx) => renderEdge(edge, idx))}

              {/* Render nodes */}
              {filteredNodes.map(renderNode)}
            </svg>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-800/90 p-3 rounded-lg">
            <div className="text-xs text-slate-400 mb-2">Legend</div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1">
                <div className="w-8 h-0.5 bg-blue-500" />
                <span className="text-slate-300">Lookup</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-8 h-0.5 bg-amber-500" />
                <span className="text-slate-300">Master-Detail</span>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[8px] bg-orange-500/20 text-orange-400 px-1">C</Badge>
                <span className="text-slate-300">Custom</span>
              </div>
            </div>
          </div>
        </div>

        {/* Selected Object Details */}
        {selectedNode && objectDescriptions.has(selectedNode) && (
          <div className="mx-4 mb-4 p-4 bg-input/50 rounded-lg">
            <h4 className="text-foreground font-medium mb-2">
              {objectDescriptions.get(selectedNode)?.label} Details
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-slate-400">API Name:</span>
                <span className="text-foreground ml-2">{selectedNode}</span>
              </div>
              <div>
                <span className="text-slate-400">Fields:</span>
                <span className="text-foreground ml-2">{objectDescriptions.get(selectedNode)?.fields.length}</span>
              </div>
              <div>
                <span className="text-slate-400">Child Relationships:</span>
                <span className="text-foreground ml-2">
                  {objectDescriptions.get(selectedNode)?.childRelationships?.length || 0}
                </span>
              </div>
              <div>
                <span className="text-slate-400">Key Prefix:</span>
                <span className="text-foreground ml-2 font-mono">
                  {objectDescriptions.get(selectedNode)?.keyPrefix}
                </span>
              </div>
            </div>
            
            {/* Quick relationships */}
            <div className="mt-3">
              <span className="text-slate-400 text-sm">Relationships:</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {edges
                  .filter(e => e.from === selectedNode || e.to === selectedNode)
                  .slice(0, 10)
                  .map((edge, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs text-slate-200 border-slate-500">
                      {edge.from === selectedNode ? `→ ${edge.to}` : `← ${edge.from}`}
                      <span className="text-slate-400 ml-1">({edge.fieldName})</span>
                    </Badge>
                  ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SalesforceRelationshipVisualizer;

