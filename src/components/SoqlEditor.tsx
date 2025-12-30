/**
 * SOQL Editor with Monaco
 * 
 * Rich SOQL editing experience with:
 * - Syntax highlighting for SOQL keywords
 * - Auto-completion for objects, fields, and keywords
 * - Query history
 * - Format query
 * - Keyboard shortcuts
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import Editor, { OnMount, Monaco } from '@monaco-editor/react';
import { editor, languages, Position, IRange } from 'monaco-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Play, History, Wand2, Copy, Download, Clock, ChevronDown, ChevronUp,
  Loader2, Table, Code, X
} from 'lucide-react';

// SOQL Keywords for syntax highlighting and autocomplete
const SOQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'NULL',
  'TRUE', 'FALSE', 'ORDER', 'BY', 'ASC', 'DESC', 'NULLS', 'FIRST', 'LAST',
  'LIMIT', 'OFFSET', 'GROUP', 'HAVING', 'ROLLUP', 'CUBE', 'COUNT', 'SUM',
  'AVG', 'MIN', 'MAX', 'COUNT_DISTINCT', 'INCLUDES', 'EXCLUDES', 'TYPEOF',
  'WHEN', 'THEN', 'ELSE', 'END', 'WITH', 'DATA', 'CATEGORY', 'ABOVE',
  'BELOW', 'AT', 'ABOVE_OR_BELOW', 'FOR', 'VIEW', 'REFERENCE', 'UPDATE',
  'TRACKING', 'VIEWSTAT', 'USING', 'SCOPE', 'DELEGATED', 'EVERYTHING',
  'MINE', 'MY_TEAM_TERRITORY', 'MY_TERRITORY', 'TEAM', 'YESTERDAY', 'TODAY',
  'TOMORROW', 'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK', 'LAST_MONTH', 'THIS_MONTH',
  'NEXT_MONTH', 'LAST_90_DAYS', 'NEXT_90_DAYS', 'LAST_N_DAYS', 'NEXT_N_DAYS',
  'THIS_QUARTER', 'LAST_QUARTER', 'NEXT_QUARTER', 'THIS_YEAR', 'LAST_YEAR',
  'NEXT_YEAR', 'THIS_FISCAL_QUARTER', 'LAST_FISCAL_QUARTER', 'NEXT_FISCAL_QUARTER',
  'THIS_FISCAL_YEAR', 'LAST_FISCAL_YEAR', 'NEXT_FISCAL_YEAR', 'CALENDAR_MONTH',
  'CALENDAR_QUARTER', 'CALENDAR_YEAR', 'FISCAL_MONTH', 'FISCAL_QUARTER', 'FISCAL_YEAR',
  'HOUR_IN_DAY', 'DAY_IN_MONTH', 'DAY_IN_WEEK', 'DAY_IN_YEAR', 'DAY_ONLY',
  'WEEK_IN_MONTH', 'WEEK_IN_YEAR', 'convertTimezone', 'toLabel', 'format', 'convertCurrency',
  'DISTANCE', 'GEOLOCATION'
];

// Common Salesforce standard objects
const STANDARD_OBJECTS = [
  'Account', 'Contact', 'Lead', 'Opportunity', 'Case', 'Task', 'Event',
  'Campaign', 'CampaignMember', 'User', 'Profile', 'PermissionSet',
  'Group', 'UserRole', 'RecordType', 'OpportunityLineItem', 'Product2',
  'Pricebook2', 'PricebookEntry', 'Quote', 'QuoteLineItem', 'Contract',
  'Order', 'OrderItem', 'Asset', 'Solution', 'ContentDocument', 'ContentVersion',
  'Attachment', 'Note', 'FeedItem', 'EmailMessage', 'CaseComment',
  'OpportunityContactRole', 'AccountContactRole', 'AccountTeamMember',
  'OpportunityTeamMember', 'Territory2', 'UserTerritory2Association'
];

// Common fields that exist on most objects
const COMMON_FIELDS = [
  'Id', 'Name', 'CreatedDate', 'CreatedById', 'LastModifiedDate', 'LastModifiedById',
  'SystemModstamp', 'OwnerId', 'IsDeleted', 'RecordTypeId'
];

// Field suggestions by object type
const OBJECT_FIELDS: { [key: string]: string[] } = {
  Account: ['Id', 'Name', 'Type', 'Industry', 'Phone', 'Fax', 'Website', 'Description',
    'NumberOfEmployees', 'AnnualRevenue', 'Rating', 'OwnerId', 'ParentId', 'BillingStreet',
    'BillingCity', 'BillingState', 'BillingPostalCode', 'BillingCountry', 'ShippingStreet',
    'ShippingCity', 'ShippingState', 'ShippingPostalCode', 'ShippingCountry', 'CreatedDate',
    'LastModifiedDate', 'AccountSource', 'Sic', 'TickerSymbol', 'Site'],
  Contact: ['Id', 'FirstName', 'LastName', 'Name', 'Email', 'Phone', 'MobilePhone', 'Title',
    'Department', 'AccountId', 'Account.Name', 'OwnerId', 'ReportsToId', 'MailingStreet',
    'MailingCity', 'MailingState', 'MailingPostalCode', 'MailingCountry', 'Birthdate',
    'Description', 'LeadSource', 'CreatedDate', 'LastModifiedDate'],
  Lead: ['Id', 'FirstName', 'LastName', 'Name', 'Company', 'Title', 'Email', 'Phone',
    'MobilePhone', 'Website', 'LeadSource', 'Status', 'Industry', 'Rating', 'Street',
    'City', 'State', 'PostalCode', 'Country', 'Description', 'OwnerId', 'IsConverted',
    'ConvertedAccountId', 'ConvertedContactId', 'ConvertedOpportunityId', 'CreatedDate'],
  Opportunity: ['Id', 'Name', 'AccountId', 'Account.Name', 'Amount', 'CloseDate', 'StageName',
    'Probability', 'Type', 'LeadSource', 'NextStep', 'Description', 'OwnerId', 'IsClosed',
    'IsWon', 'ForecastCategory', 'ForecastCategoryName', 'CampaignId', 'CreatedDate',
    'LastModifiedDate', 'ExpectedRevenue', 'TotalOpportunityQuantity'],
  Case: ['Id', 'CaseNumber', 'AccountId', 'Account.Name', 'ContactId', 'Contact.Name',
    'Subject', 'Description', 'Status', 'Priority', 'Origin', 'Type', 'Reason', 'OwnerId',
    'IsClosed', 'IsEscalated', 'ClosedDate', 'CreatedDate', 'LastModifiedDate'],
  Task: ['Id', 'Subject', 'Description', 'Status', 'Priority', 'ActivityDate', 'OwnerId',
    'WhoId', 'WhatId', 'IsClosed', 'IsHighPriority', 'IsRecurrence', 'CreatedDate'],
  Event: ['Id', 'Subject', 'Description', 'Location', 'StartDateTime', 'EndDateTime',
    'DurationInMinutes', 'OwnerId', 'WhoId', 'WhatId', 'IsAllDayEvent', 'IsPrivate',
    'IsRecurrence', 'CreatedDate'],
  User: ['Id', 'Username', 'FirstName', 'LastName', 'Name', 'Email', 'Phone', 'MobilePhone',
    'Title', 'Department', 'Division', 'CompanyName', 'ProfileId', 'UserRoleId', 'IsActive',
    'Alias', 'CommunityNickname', 'CreatedDate', 'LastLoginDate', 'ManagerId'],
  Campaign: ['Id', 'Name', 'Type', 'Status', 'StartDate', 'EndDate', 'Description',
    'IsActive', 'ParentId', 'OwnerId', 'ActualCost', 'BudgetedCost', 'ExpectedResponse',
    'NumberSent', 'ExpectedRevenue', 'NumberOfContacts', 'NumberOfLeads', 'CreatedDate'],
};

interface SoqlEditorProps {
  value: string;
  onChange: (value: string) => void;
  onExecute: () => void;
  isLoading?: boolean;
  objects?: Array<{ name: string; label: string }>;
  currentObjectFields?: Array<{ name: string; label: string; type: string }>;
  queryHistory?: Array<{ query: string; timestamp: string }>;
  disabled?: boolean;
}

export function SoqlEditor({
  value,
  onChange,
  onExecute,
  isLoading = false,
  objects = [],
  currentObjectFields = [],
  queryHistory = [],
  disabled = false,
}: SoqlEditorProps) {
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });

  // Register SOQL language and completions
  const handleEditorMount: OnMount = useCallback((editorInstance, monaco) => {
    editorRef.current = editorInstance;
    monacoRef.current = monaco;

    // Register SOQL language
    monaco.languages.register({ id: 'soql' });

    // Define syntax highlighting
    monaco.languages.setMonarchTokensProvider('soql', {
      ignoreCase: true,
      keywords: SOQL_KEYWORDS.map(k => k.toLowerCase()),
      operators: ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN'],
      tokenizer: {
        root: [
          // Keywords
          [/\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|ORDER|BY|ASC|DESC|LIMIT|OFFSET|GROUP|HAVING|NULL|TRUE|FALSE|NULLS|FIRST|LAST|COUNT|SUM|AVG|MIN|MAX|INCLUDES|EXCLUDES|WITH|FOR|UPDATE|YESTERDAY|TODAY|TOMORROW|LAST_WEEK|THIS_WEEK|NEXT_WEEK|LAST_MONTH|THIS_MONTH|NEXT_MONTH|LAST_90_DAYS|NEXT_90_DAYS|LAST_N_DAYS|NEXT_N_DAYS|THIS_QUARTER|LAST_QUARTER|NEXT_QUARTER|THIS_YEAR|LAST_YEAR|NEXT_YEAR)\b/i, 'keyword'],
          // Strings
          [/'[^']*'/, 'string'],
          // Numbers
          [/\b\d+(\.\d+)?\b/, 'number'],
          // Comments
          [/\/\/.*$/, 'comment'],
          // Identifiers (fields, objects)
          [/\b[A-Za-z_][A-Za-z0-9_]*(\.[A-Za-z_][A-Za-z0-9_]*)?\b/, 'identifier'],
          // Operators
          [/[=<>!]+/, 'operator'],
          // Parentheses
          [/[()]/, 'delimiter.parenthesis'],
          // Commas
          [/,/, 'delimiter'],
        ],
      },
    });

    // Define theme
    monaco.editor.defineTheme('soql-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'keyword', foreground: 'C586C0', fontStyle: 'bold' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
        { token: 'comment', foreground: '6A9955' },
        { token: 'identifier', foreground: '9CDCFE' },
        { token: 'operator', foreground: 'D4D4D4' },
      ],
      colors: {
        'editor.background': '#0F172A',
        'editor.foreground': '#E2E8F0',
        'editor.lineHighlightBackground': '#1E293B',
        'editorCursor.foreground': '#60A5FA',
        'editor.selectionBackground': '#334155',
        'editorSuggestWidget.background': '#1E293B',
        'editorSuggestWidget.border': '#334155',
        'editorSuggestWidget.selectedBackground': '#3B82F6',
      },
    });

    // Set theme
    monaco.editor.setTheme('soql-dark');

    // Register completion provider
    monaco.languages.registerCompletionItemProvider('soql', {
      triggerCharacters: [' ', '.', ','],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });

        const word = model.getWordUntilPosition(position);
        const range: IRange = {
          startLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endLineNumber: position.lineNumber,
          endColumn: word.endColumn,
        };

        const suggestions: languages.CompletionItem[] = [];
        const upperText = textUntilPosition.toUpperCase();

        // Detect context
        const afterSelect = /SELECT\s+[\w\s,\.]*$/i.test(textUntilPosition);
        const afterFrom = /FROM\s+\w*$/i.test(textUntilPosition);
        const afterWhere = /WHERE\s+[\w\s\.=<>!']*$/i.test(textUntilPosition);
        const afterDot = /\.\w*$/i.test(textUntilPosition);
        const afterOrderBy = /ORDER\s+BY\s+[\w\s,\.]*$/i.test(textUntilPosition);

        // Extract current object from query
        const fromMatch = textUntilPosition.match(/FROM\s+(\w+)/i);
        const currentObject = fromMatch ? fromMatch[1] : null;

        // After SELECT - suggest fields
        if (afterSelect && !afterFrom && !afterWhere) {
          // Get fields for current object
          const fieldsToSuggest = currentObject && OBJECT_FIELDS[currentObject] 
            ? OBJECT_FIELDS[currentObject]
            : COMMON_FIELDS;

          fieldsToSuggest.forEach(field => {
            suggestions.push({
              label: field,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: field,
              range,
              detail: 'Field',
            });
          });

          // Add aggregate functions
          ['COUNT()', 'COUNT(Id)', 'SUM()', 'AVG()', 'MIN()', 'MAX()', 'COUNT_DISTINCT()'].forEach(fn => {
            suggestions.push({
              label: fn,
              kind: monaco.languages.CompletionItemKind.Function,
              insertText: fn,
              range,
              detail: 'Aggregate Function',
            });
          });
        }

        // After FROM - suggest objects
        if (afterFrom) {
          // Add objects from props (live from org)
          if (objects.length > 0) {
            objects.forEach(obj => {
              suggestions.push({
                label: obj.name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: obj.name,
                range,
                detail: obj.label,
                documentation: `Salesforce Object: ${obj.label}`,
              });
            });
          } else {
            // Fallback to standard objects
            STANDARD_OBJECTS.forEach(obj => {
              suggestions.push({
                label: obj,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: obj,
                range,
                detail: 'Standard Object',
              });
            });
          }
        }

        // After WHERE or ORDER BY - suggest fields
        if ((afterWhere || afterOrderBy) && currentObject) {
          const fieldsToSuggest = OBJECT_FIELDS[currentObject] || COMMON_FIELDS;
          fieldsToSuggest.forEach(field => {
            suggestions.push({
              label: field,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: field,
              range,
              detail: 'Field',
            });
          });
        }

        // After dot - suggest relationship fields
        if (afterDot) {
          COMMON_FIELDS.forEach(field => {
            suggestions.push({
              label: field,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: field,
              range,
              detail: 'Relationship Field',
            });
          });
        }

        // Always suggest keywords when not in specific context
        if (!afterFrom && !afterDot) {
          SOQL_KEYWORDS.forEach(kw => {
            suggestions.push({
              label: kw,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: kw + ' ',
              range,
              detail: 'Keyword',
            });
          });
        }

        // Date literals for WHERE clauses
        if (afterWhere) {
          const dateLiterals = [
            'TODAY', 'YESTERDAY', 'TOMORROW', 'LAST_WEEK', 'THIS_WEEK', 'NEXT_WEEK',
            'LAST_MONTH', 'THIS_MONTH', 'NEXT_MONTH', 'LAST_90_DAYS', 'NEXT_90_DAYS',
            'THIS_YEAR', 'LAST_YEAR', 'NEXT_YEAR', 'THIS_QUARTER', 'LAST_QUARTER'
          ];
          dateLiterals.forEach(literal => {
            suggestions.push({
              label: literal,
              kind: monaco.languages.CompletionItemKind.Constant,
              insertText: literal,
              range,
              detail: 'Date Literal',
            });
          });
        }

        return { suggestions };
      },
    });

    // Track cursor position
    editorInstance.onDidChangeCursorPosition(e => {
      setCursorPosition({ line: e.position.lineNumber, column: e.position.column });
    });

    // Add keyboard shortcuts
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      if (!disabled && !isLoading) {
        onExecute();
      }
    });

    // Format on Shift+Alt+F
    editorInstance.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      formatQuery();
    });
  }, [objects, disabled, isLoading, onExecute]);

  // Format SOQL query
  const formatQuery = useCallback(() => {
    if (!editorRef.current) return;

    const query = value;
    // Simple SOQL formatter
    let formatted = query
      .replace(/\s+/g, ' ')
      .replace(/\bSELECT\b/gi, '\nSELECT')
      .replace(/\bFROM\b/gi, '\nFROM')
      .replace(/\bWHERE\b/gi, '\nWHERE')
      .replace(/\bAND\b/gi, '\n  AND')
      .replace(/\bOR\b/gi, '\n  OR')
      .replace(/\bORDER BY\b/gi, '\nORDER BY')
      .replace(/\bGROUP BY\b/gi, '\nGROUP BY')
      .replace(/\bHAVING\b/gi, '\nHAVING')
      .replace(/\bLIMIT\b/gi, '\nLIMIT')
      .replace(/\bOFFSET\b/gi, '\nOFFSET')
      .trim();

    onChange(formatted);
  }, [value, onChange]);

  // Insert query from history
  const insertFromHistory = useCallback((query: string) => {
    onChange(query);
    setShowHistory(false);
  }, [onChange]);

  // Copy query to clipboard
  const copyQuery = useCallback(() => {
    navigator.clipboard.writeText(value);
  }, [value]);

  return (
    <div className="flex flex-col h-full border border-slate-700 rounded-lg overflow-hidden bg-slate-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={onExecute}
            disabled={disabled || isLoading}
            className="gap-1.5 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={formatQuery}
            className="gap-1.5 text-slate-300 border-slate-600 hover:text-white hover:bg-slate-700"
          >
            <Wand2 className="w-3.5 h-3.5" />
            Format
          </Button>
          
          <Button
            size="sm"
            variant="outline"
            onClick={copyQuery}
            className="gap-1.5 text-slate-300 border-slate-600 hover:text-white hover:bg-slate-700"
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowHistory(!showHistory)}
            className={`gap-1.5 text-slate-300 border-slate-600 hover:text-white hover:bg-slate-700 ${showHistory ? 'bg-slate-700' : ''}`}
          >
            <History className="w-3.5 h-3.5" />
            History
            {showHistory ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
          <Badge variant="outline" className="text-slate-400 border-slate-600">
            Ctrl+Enter to Run
          </Badge>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && queryHistory.length > 0 && (
        <div className="max-h-48 overflow-y-auto border-b border-slate-700 bg-slate-800/30">
          {queryHistory.slice(0, 10).map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between px-3 py-2 hover:bg-slate-700/50 cursor-pointer border-b border-slate-700/50 last:border-0"
              onClick={() => insertFromHistory(item.query)}
            >
              <code className="text-xs text-slate-300 truncate flex-1 font-mono">
                {item.query.length > 80 ? item.query.slice(0, 80) + '...' : item.query}
              </code>
              <span className="text-xs text-slate-500 ml-3 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(item.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1 min-h-0">
        <Editor
          height="100%"
          defaultLanguage="soql"
          language="soql"
          value={value}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
            lineNumbers: 'on',
            wordWrap: 'on',
            automaticLayout: true,
            scrollBeyondLastLine: false,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            suggestOnTriggerCharacters: true,
            quickSuggestions: true,
            acceptSuggestionOnEnter: 'on',
            tabSize: 2,
            scrollbar: {
              vertical: 'auto',
              horizontal: 'auto',
              verticalScrollbarSize: 8,
              horizontalScrollbarSize: 8,
            },
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            smoothScrolling: true,
            readOnly: disabled,
          }}
        />
      </div>

      {/* Help bar */}
      <div className="px-3 py-1.5 bg-slate-800/30 border-t border-slate-700 text-xs text-slate-500 flex items-center gap-4">
        <span>💡 Type <code className="text-slate-400">FROM</code> for objects, fields auto-complete after object selection</span>
        <span className="ml-auto">Shift+Alt+F to format</span>
      </div>
    </div>
  );
}



