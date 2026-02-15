/**
 * Types for FlowstralWorkflowEditor components.
 */

export interface Node {
  id: string;
  position: { x: number; y: number };
  data: {
    type: 'navigate' | 'click' | 'input' | 'wait' | 'assert' | 'condition' | 'loop';
    label: string;
    selector?: string;
    value?: string;
    url?: string;
    duration?: number;
    elementData?: {
      tagName?: string;
      attributes?: Record<string, string>;
      textContent?: string;
      className?: string;
    };
  };
  stepNumber?: number;
}

export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface FlowstralWorkflowEditorProps {
  sessionId?: string;
  importSource?: string;  // 'extension' for auto-import from extension
  onExport?: (workflow: any) => void;
  onImport?: (workflow: any) => void;
}
