/**
 * CodeEditor — Monaco Editor wrapper for API testing
 *
 * Replaces plain <Textarea> with syntax-highlighted code editor.
 * Supports JSON, XML, GraphQL, HTML, and plain text.
 * Dark theme by default, matches the app's dark UI.
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import Editor, { type OnMount, type Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';

/** Detect current theme from document root class (synced with ThemeContext) */
function useDocumentTheme(): 'light' | 'dark' {
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark') ? 'dark' : 'light'
  );
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setTheme(root.classList.contains('dark') ? 'dark' : 'light');
    });
    observer.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

// Map body types to Monaco language IDs
const LANGUAGE_MAP: Record<string, string> = {
  json: 'json',
  xml: 'xml',
  graphql: 'graphql',
  html: 'html',
  form: 'plaintext',
  multipart: 'plaintext',
  binary: 'plaintext',
  raw: 'plaintext',
  text: 'plaintext',
  none: 'plaintext',
};

interface CodeEditorProps {
  /** Current content */
  value: string;
  /** Called on content change */
  onChange: (value: string) => void;
  /** Language mode (json, xml, graphql, html, form, raw) */
  language?: string;
  /** Placeholder text shown when empty */
  placeholder?: string;
  /** Editor height (CSS value) */
  height?: string;
  /** Minimum height in pixels */
  minHeight?: number;
  /** Read-only mode for response display */
  readOnly?: boolean;
  /** Font size in pixels */
  fontSize?: number;
  /** Show minimap */
  minimap?: boolean;
  /** Show line numbers */
  lineNumbers?: 'on' | 'off' | 'relative';
  /** Callback for Ctrl+Enter (send request) */
  onCtrlEnter?: () => void;
  /** Callback for Ctrl+S (save) */
  onCtrlS?: () => void;
  /** Additional CSS class */
  className?: string;
  /** Word wrap */
  wordWrap?: 'on' | 'off' | 'wordWrapColumn' | 'bounded';
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'json',
  placeholder,
  height = '200px',
  minHeight,
  readOnly = false,
  fontSize = 13,
  minimap = false,
  lineNumbers = 'on',
  onCtrlEnter,
  onCtrlS,
  className = '',
  wordWrap = 'on',
}) => {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoLang = LANGUAGE_MAP[language] || 'plaintext';
  const appTheme = useDocumentTheme();
  const monacoTheme = appTheme === 'dark' ? 'vs-dark' : 'light';

  const handleEditorMount: OnMount = useCallback((editor: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    editorRef.current = editor;

    // Register Ctrl+Enter keybinding for send request
    if (onCtrlEnter) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onCtrlEnter();
      });
    }

    // Register Ctrl+S keybinding for save
    if (onCtrlS) {
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        onCtrlS();
      });
    }

    // Register Ctrl+Shift+F (or Alt+Shift+F) for format
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL, () => {
      editor.getAction('editor.action.formatDocument')?.run();
    });

    // Focus the editor if it's not read-only
    if (!readOnly) {
      // Small delay to avoid stealing focus on mount
      setTimeout(() => {
        // Don't auto-focus, let user click
      }, 0);
    }
  }, [onCtrlEnter, onCtrlS, readOnly]);

  const handleChange = useCallback((val: string | undefined) => {
    onChange(val ?? '');
  }, [onChange]);

  return (
    <div
      className={`border rounded-md overflow-hidden bg-background ${className}`}
      style={{ minHeight: minHeight ? `${minHeight}px` : undefined }}
    >
      <Editor
        height={height}
        language={monacoLang}
        value={value}
        onChange={handleChange}
        onMount={handleEditorMount}
        theme={monacoTheme}
        options={{
          readOnly,
          fontSize,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, 'Courier New', monospace",
          minimap: { enabled: minimap },
          lineNumbers,
          wordWrap,
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          formatOnPaste: true,
          formatOnType: language === 'json',
          bracketPairColorization: { enabled: true },
          padding: { top: 8, bottom: 8 },
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
          renderLineHighlight: readOnly ? 'none' : 'line',
          contextmenu: !readOnly,
          // Placeholder-like behavior: show text when empty
          ...(placeholder && !value ? {} : {}),
        }}
        loading={
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm p-4">
            Loading editor...
          </div>
        }
      />
    </div>
  );
};

/**
 * Compact code editor for chain steps and smaller contexts
 */
export const CompactCodeEditor: React.FC<Omit<CodeEditorProps, 'height' | 'fontSize' | 'lineNumbers'> & {
  height?: string;
}> = (props) => (
  <CodeEditor
    {...props}
    height={props.height || '120px'}
    fontSize={12}
    lineNumbers="off"
    minimap={false}
  />
);

/**
 * Read-only code viewer for response bodies
 */
export const ResponseCodeViewer: React.FC<{
  value: string;
  language?: string;
  height?: string;
  className?: string;
}> = ({ value, language = 'json', height = '350px', className }) => {
  // Auto-detect language from content
  let detectedLang = language;
  if (language === 'json' || language === 'auto') {
    const trimmed = value.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      detectedLang = 'json';
    } else if (trimmed.startsWith('<?xml') || trimmed.startsWith('<')) {
      detectedLang = 'xml';
    } else if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
      detectedLang = 'html';
    } else {
      detectedLang = 'plaintext';
    }
  }

  return (
    <CodeEditor
      value={value}
      onChange={() => {}}
      language={detectedLang}
      height={height}
      readOnly
      lineNumbers="on"
      fontSize={12}
      className={className}
      wordWrap="on"
    />
  );
};

export default CodeEditor;
