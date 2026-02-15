/**
 * Salesforce Anonymous Apex Executor
 * 
 * Execute Apex code directly.
 * Features:
 * - Code editor with syntax highlighting
 * - Debug log viewer
 * - Common snippets library
 * - Execution history
 * - Variable inspection
 */

import { useState, useCallback, useMemo } from 'react';
import {
  Play, Code, FileText, Clock, Copy, Save,
  Loader2, CheckCircle, AlertCircle, Trash2, Download,
  ChevronDown, ChevronRight, BookOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { salesforceApi } from '@/modules/salesforce/lib/salesforce-api';

interface ExecutionResult {
  success: boolean;
  compileProblem?: string;
  exceptionMessage?: string;
  exceptionStackTrace?: string;
  line?: number;
  column?: number;
  debugLog?: string;
}

interface ExecutionHistoryItem {
  id: string;
  code: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

interface CodeSnippet {
  name: string;
  description: string;
  code: string;
  category: string;
}

interface SalesforceApexExecutorProps {
  isConnected: boolean;
}

const CODE_SNIPPETS: CodeSnippet[] = [
  {
    name: 'Query Accounts',
    description: 'Query first 10 accounts',
    category: 'Query',
    code: `List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 10];
for(Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`,
  },
  {
    name: 'Create Test Account',
    description: 'Insert a test account',
    category: 'DML',
    code: `Account testAcc = new Account(
    Name = 'Test Account ' + DateTime.now().format()
);
insert testAcc;
System.debug('Created Account: ' + testAcc.Id);`,
  },
  {
    name: 'Update Records',
    description: 'Update account names',
    category: 'DML',
    code: `List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for(Account acc : accounts) {
    acc.Description = 'Updated at ' + DateTime.now();
}
update accounts;
System.debug('Updated ' + accounts.size() + ' accounts');`,
  },
  {
    name: 'Delete Test Data',
    description: 'Delete test accounts',
    category: 'DML',
    code: `List<Account> testAccounts = [SELECT Id FROM Account WHERE Name LIKE 'Test%' LIMIT 10];
if(!testAccounts.isEmpty()) {
    delete testAccounts;
    System.debug('Deleted ' + testAccounts.size() + ' test accounts');
} else {
    System.debug('No test accounts found');
}`,
  },
  {
    name: 'Check Governor Limits',
    description: 'Print current limits',
    category: 'Debug',
    code: `System.debug('SOQL Queries: ' + Limits.getQueries() + '/' + Limits.getLimitQueries());
System.debug('DML Statements: ' + Limits.getDmlStatements() + '/' + Limits.getLimitDmlStatements());
System.debug('CPU Time: ' + Limits.getCpuTime() + '/' + Limits.getLimitCpuTime());
System.debug('Heap Size: ' + Limits.getHeapSize() + '/' + Limits.getLimitHeapSize());`,
  },
  {
    name: 'HTTP Callout',
    description: 'Make HTTP request',
    category: 'Integration',
    code: `Http http = new Http();
HttpRequest request = new HttpRequest();
request.setEndpoint('https://api.example.com/data');
request.setMethod('GET');
request.setHeader('Content-Type', 'application/json');

try {
    HttpResponse response = http.send(request);
    System.debug('Status: ' + response.getStatusCode());
    System.debug('Body: ' + response.getBody());
} catch(Exception e) {
    System.debug('Error: ' + e.getMessage());
}`,
  },
  {
    name: 'JSON Parsing',
    description: 'Parse JSON string',
    category: 'Utility',
    code: `String jsonString = '{"name": "Test", "value": 123}';
Map<String, Object> data = (Map<String, Object>) JSON.deserializeUntyped(jsonString);
System.debug('Name: ' + data.get('name'));
System.debug('Value: ' + data.get('value'));`,
  },
  {
    name: 'Batch Job Status',
    description: 'Check batch job status',
    category: 'Debug',
    code: `List<AsyncApexJob> jobs = [
    SELECT Id, Status, JobType, ApexClass.Name, 
           NumberOfErrors, JobItemsProcessed, TotalJobItems
    FROM AsyncApexJob
    ORDER BY CreatedDate DESC
    LIMIT 10
];
for(AsyncApexJob job : jobs) {
    System.debug(job.ApexClass.Name + ': ' + job.Status + 
                 ' (' + job.JobItemsProcessed + '/' + job.TotalJobItems + ')');
}`,
  },
  {
    name: 'User Context',
    description: 'Get current user info',
    category: 'Debug',
    code: `User currentUser = [SELECT Id, Name, Email, Profile.Name, UserRole.Name 
                       FROM User WHERE Id = :UserInfo.getUserId()];
System.debug('User: ' + currentUser.Name);
System.debug('Email: ' + currentUser.Email);
System.debug('Profile: ' + currentUser.Profile.Name);
System.debug('Role: ' + currentUser.UserRole?.Name);`,
  },
  {
    name: 'Describe Object',
    description: 'Get object metadata',
    category: 'Metadata',
    code: `Schema.DescribeSObjectResult accountDescribe = Account.SObjectType.getDescribe();
System.debug('Object: ' + accountDescribe.getName());
System.debug('Label: ' + accountDescribe.getLabel());
System.debug('Fields: ' + accountDescribe.fields.getMap().keySet().size());
System.debug('Createable: ' + accountDescribe.isCreateable());
System.debug('Key Prefix: ' + accountDescribe.getKeyPrefix());`,
  },
];

export function SalesforceApexExecutor({ isConnected }: SalesforceApexExecutorProps) {
  const [code, setCode] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [history, setHistory] = useState<ExecutionHistoryItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showSnippets, setShowSnippets] = useState(false);

  const categories = useMemo(() => {
    const cats = new Set(CODE_SNIPPETS.map(s => s.category));
    return Array.from(cats);
  }, []);

  const filteredSnippets = useMemo(() => {
    if (!selectedCategory) return CODE_SNIPPETS;
    return CODE_SNIPPETS.filter(s => s.category === selectedCategory);
  }, [selectedCategory]);

  const executeCode = useCallback(async () => {
    if (!isConnected) {
      toast.error('Please connect to a Salesforce org first');
      return;
    }

    if (!code.trim()) {
      toast.error('Please enter some Apex code');
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const execResult = await salesforceApi.executeAnonymousApex(code);
      
      const newResult: ExecutionResult = {
        success: execResult.success,
        compileProblem: execResult.compileProblem,
        exceptionMessage: execResult.exceptionMessage,
        exceptionStackTrace: execResult.exceptionStackTrace,
        line: execResult.line,
        column: execResult.column,
      };

      setResult(newResult);

      // Add to history
      const historyItem: ExecutionHistoryItem = {
        id: `exec_${Date.now()}`,
        code,
        timestamp: new Date().toISOString(),
        success: execResult.success,
        error: execResult.compileProblem || execResult.exceptionMessage,
      };
      setHistory(prev => [historyItem, ...prev].slice(0, 20));

      if (execResult.success) {
        toast.success('Apex executed successfully');
      } else {
        toast.error(execResult.compileProblem || execResult.exceptionMessage || 'Execution failed');
      }
    } catch (error: any) {
      setResult({
        success: false,
        exceptionMessage: error.message,
      });
      toast.error(error.message);
    } finally {
      setIsExecuting(false);
    }
  }, [isConnected, code]);

  const loadSnippet = useCallback((snippet: CodeSnippet) => {
    setCode(snippet.code);
    setShowSnippets(false);
    toast.success(`Loaded: ${snippet.name}`);
  }, []);

  const loadFromHistory = useCallback((item: ExecutionHistoryItem) => {
    setCode(item.code);
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    toast.success('History cleared');
  }, []);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
    toast.success('Code copied');
  }, [code]);

  return (
    <div className="space-y-4">
      {/* Code Editor */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Anonymous Apex Executor</CardTitle>
              <CardDescription>Execute Apex code directly in your org</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSnippets(!showSnippets)}
              className="gap-2 text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            >
              <BookOpen className="w-4 h-4" />
              Snippets
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Snippets Panel */}
          {showSnippets && (
            <div className="mb-4 p-4 bg-secondary rounded-lg">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm text-muted-foreground">Categories:</span>
                <Badge
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Badge>
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto">
                {filteredSnippets.map(snippet => (
                  <div
                    key={snippet.name}
                    className="p-2 rounded bg-card cursor-pointer hover:bg-accent"
                    onClick={() => loadSnippet(snippet)}
                  >
                    <div className="text-sm text-foreground font-medium">{snippet.name}</div>
                    <div className="text-xs text-muted-foreground">{snippet.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="// Enter your Apex code here&#10;System.debug('Hello, World!');"
            className="font-mono text-sm bg-input border-border min-h-[300px] text-foreground placeholder:text-muted-foreground"
          />

          <div className="flex items-center gap-2 mt-4">
            <Button
              onClick={executeCode}
              disabled={!isConnected || isExecuting || !code.trim()}
              className="gap-2"
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Execute
            </Button>
            <Button variant="outline" onClick={copyCode} disabled={!code} className="text-muted-foreground border-border hover:text-foreground hover:bg-accent">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="outline" onClick={() => setCode('')} className="text-muted-foreground border-border hover:text-foreground hover:bg-accent">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Execution Result */}
      {result && (
        <Card className={`border ${result.success ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <CardTitle className={result.success ? 'text-green-400' : 'text-red-400'}>
                {result.success ? 'Execution Successful' : 'Execution Failed'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {result.compileProblem && (
              <div className="mb-3">
                <div className="text-sm text-red-400 font-medium">Compile Error:</div>
                <div className="text-sm text-foreground font-mono bg-secondary p-2 rounded mt-1">
                  {result.compileProblem}
                  {result.line && result.column && (
                    <span className="text-muted-foreground ml-2">
                      (Line {result.line}, Column {result.column})
                    </span>
                  )}
                </div>
              </div>
            )}
            
            {result.exceptionMessage && (
              <div className="mb-3">
                <div className="text-sm text-red-400 font-medium">Exception:</div>
                <div className="text-sm text-foreground font-mono bg-secondary p-2 rounded mt-1">
                  {result.exceptionMessage}
                </div>
              </div>
            )}
            
            {result.exceptionStackTrace && (
              <div>
                <div className="text-sm text-red-400 font-medium">Stack Trace:</div>
                <pre className="text-xs text-muted-foreground font-mono bg-secondary p-2 rounded mt-1 overflow-auto max-h-[200px]">
                  {result.exceptionStackTrace}
                </pre>
              </div>
            )}

            {result.success && !result.compileProblem && !result.exceptionMessage && (
              <div className="text-sm text-green-400">
                Code executed successfully. Check debug logs for System.debug() output.
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Execution History */}
      {history.length > 0 && (
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-foreground text-sm">Execution History</CardTitle>
              <Button variant="ghost" size="sm" onClick={clearHistory}>
                Clear
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {history.map(item => (
                <div
                  key={item.id}
                  className={`p-2 rounded cursor-pointer hover:bg-accent ${
                    item.success ? 'bg-green-500/5' : 'bg-red-500/5'
                  }`}
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {item.success ? (
                        <CheckCircle className="w-3 h-3 text-green-400" />
                      ) : (
                        <AlertCircle className="w-3 h-3 text-red-400" />
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-foreground font-mono truncate mt-1">
                    {item.code.split('\n')[0]}
                  </div>
                  {item.error && (
                    <div className="text-xs text-red-400 truncate mt-1">
                      {item.error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SalesforceApexExecutor;

