/**
 * NodeComponent - Visual representation of a single workflow node on the canvas.
 */
import React from 'react';
import {
  Navigation, MousePointer, Type, Clock, CheckCircle,
  GitBranch, Repeat, Zap
} from 'lucide-react';
import type { Node } from './types';

function getIcon(type: Node['data']['type']) {
  switch (type) {
    case 'navigate': return <Navigation className="h-4 w-4" />;
    case 'click': return <MousePointer className="h-4 w-4" />;
    case 'input': return <Type className="h-4 w-4" />;
    case 'wait': return <Clock className="h-4 w-4" />;
    case 'assert': return <CheckCircle className="h-4 w-4" />;
    case 'condition': return <GitBranch className="h-4 w-4" />;
    case 'loop': return <Repeat className="h-4 w-4" />;
    default: return <Zap className="h-4 w-4" />;
  }
}

function getColor(type: Node['data']['type']) {
  switch (type) {
    case 'navigate': return 'border-blue-500 bg-blue-50 dark:bg-blue-950';
    case 'click': return 'border-green-500 bg-green-50 dark:bg-green-950';
    case 'input': return 'border-purple-500 bg-purple-50 dark:bg-purple-950';
    case 'wait': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950';
    case 'assert': return 'border-red-500 bg-red-50 dark:bg-red-950';
    case 'condition': return 'border-orange-500 bg-orange-50 dark:bg-orange-950';
    case 'loop': return 'border-pink-500 bg-pink-50 dark:bg-pink-950';
    default: return 'border-gray-500 bg-gray-50 dark:bg-gray-900';
  }
}

function getIconColor(type: Node['data']['type']) {
  switch (type) {
    case 'navigate': return 'bg-blue-500';
    case 'click': return 'bg-green-500';
    case 'input': return 'bg-purple-500';
    case 'wait': return 'bg-yellow-500';
    case 'assert': return 'bg-red-500';
    case 'condition': return 'bg-orange-500';
    case 'loop': return 'bg-pink-500';
    default: return 'bg-gray-500';
  }
}

export const NodeComponent = ({ node, isSelected, onClick, onDragStart }: {
  node: Node;
  isSelected: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}) => {
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
        px-4 py-3 rounded-lg border-2 bg-white dark:bg-gray-900 shadow-md min-w-[200px] max-w-[250px]
        ${isSelected ? 'border-blue-600 dark:border-amber-500 shadow-lg ring-2 ring-blue-200 dark:ring-amber-500/30' : getColor(node.data.type)}
        hover:shadow-lg transition-all
      `}
    >
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-full hover:border-blue-500 dark:hover:border-amber-500" />

      <div className="flex items-center gap-2 mb-1">
        <div className={`${getIconColor(node.data.type)} text-white p-1.5 rounded`}>
          {getIcon(node.data.type)}
        </div>
        <div className="flex-1">
          <div className="font-semibold text-sm text-gray-800 dark:text-gray-100">{node.data.label}</div>
        </div>
        {/* Step number badge */}
        <div className="bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {node.stepNumber || '?'}
        </div>
      </div>

      {node.data.selector && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          {node.data.selector}
        </div>
      )}

      {node.data.value && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          Value: {node.data.value}
        </div>
      )}

      {node.data.url && (
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
          {node.data.url}
        </div>
      )}

      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-white dark:bg-gray-800 border-2 border-gray-400 dark:border-gray-600 rounded-full hover:border-blue-500 dark:hover:border-amber-500" />
    </div>
  );
};
