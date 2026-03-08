/**
 * ExtractorEditor — Standalone editor for correlation/extraction rules.
 *
 * Allows users to define extractors that capture dynamic values from HTTP
 * responses during load testing (e.g., session tokens, CSRF tokens, IDs).
 *
 * Supported extractor types: JSONPath, Regex, Boundary (LB/RB), Header, Cookie, XPath.
 */
import React, { useCallback } from 'react';
import { Plus, Trash2, Variable } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Extractor {
  id: string;
  type: string;
  variableName: string;
  pattern: string;
  scope: string;
}

interface ExtractorEditorProps {
  extractors: Extractor[];
  onExtractorsChange: (extractors: Extractor[]) => void;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const EXTRACTOR_TYPES = [
  { value: 'jsonpath', label: 'JSONPath' },
  { value: 'regex', label: 'Regex' },
  { value: 'boundary', label: 'Boundary (LB/RB)' },
  { value: 'header', label: 'Header' },
  { value: 'cookie', label: 'Cookie' },
  { value: 'xpath', label: 'XPath' },
] as const;

const EXTRACTOR_SCOPES = [
  { value: 'response_body', label: 'Response Body' },
  { value: 'response_header', label: 'Response Header' },
  { value: 'cookie', label: 'Cookie' },
] as const;

const PATTERN_PLACEHOLDERS: Record<string, string> = {
  jsonpath: '$.data.token',
  regex: '[A-Za-z0-9]+',
  boundary: 'LB=csrf_token=" RB="',
  header: 'X-Session-Id',
  cookie: 'session_id',
  xpath: '//input[@name="token"]/@value',
};

// ─── Component ───────────────────────────────────────────────────────────────

const ExtractorEditor: React.FC<ExtractorEditorProps> = ({
  extractors,
  onExtractorsChange,
}) => {
  const addExtractor = useCallback(() => {
    const newExtractor: Extractor = {
      id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'jsonpath',
      variableName: '',
      pattern: '',
      scope: 'response_body',
    };
    onExtractorsChange([...extractors, newExtractor]);
  }, [extractors, onExtractorsChange]);

  const updateExtractor = useCallback(
    (id: string, field: keyof Extractor, value: string) => {
      onExtractorsChange(
        extractors.map((ext) =>
          ext.id === id ? { ...ext, [field]: value } : ext,
        ),
      );
    },
    [extractors, onExtractorsChange],
  );

  const removeExtractor = useCallback(
    (id: string) => {
      onExtractorsChange(extractors.filter((ext) => ext.id !== id));
    },
    [extractors, onExtractorsChange],
  );

  if (extractors.length === 0) {
    return (
      <div className="flex items-center justify-between rounded-md border border-dashed p-3">
        <p className="text-xs text-muted-foreground">
          No extractors. Add one to capture dynamic values from responses.
        </p>
        <Button size="sm" variant="outline" onClick={addExtractor}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Extractor
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {extractors.map((extractor) => (
        <div
          key={extractor.id}
          className="flex items-start gap-2 rounded-md border bg-muted/30 p-2.5"
        >
          <Variable className="h-4 w-4 text-muted-foreground mt-2 shrink-0" />

          <div className="flex-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Type */}
            <Select
              value={extractor.type}
              onValueChange={(v) => updateExtractor(extractor.id, 'type', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                {EXTRACTOR_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Variable name */}
            <Input
              value={extractor.variableName}
              onChange={(e) =>
                updateExtractor(extractor.id, 'variableName', e.target.value)
              }
              placeholder="e.g., session_token"
              className="h-8 text-xs font-mono"
            />

            {/* Pattern */}
            <Input
              value={extractor.pattern}
              onChange={(e) =>
                updateExtractor(extractor.id, 'pattern', e.target.value)
              }
              placeholder={PATTERN_PLACEHOLDERS[extractor.type] || 'Pattern...'}
              className="h-8 text-xs font-mono"
            />

            {/* Scope */}
            <Select
              value={extractor.scope}
              onValueChange={(v) => updateExtractor(extractor.id, 'scope', v)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Scope" />
              </SelectTrigger>
              <SelectContent>
                {EXTRACTOR_SCOPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Delete */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 mt-0.5 text-destructive hover:text-destructive"
            onClick={() => removeExtractor(extractor.id)}
            title="Remove extractor"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}

      <Button size="sm" variant="outline" onClick={addExtractor} className="w-full">
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Extractor
      </Button>
    </div>
  );
};

export default ExtractorEditor;
