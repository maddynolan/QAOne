/**
 * Trace Page - Recording Session Manager
 * View, manage, and replay recorded browser sessions
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Play, Square, Trash2, Download, ExternalLink, Clock,
  CheckCircle, XCircle, Eye, FolderOpen, RefreshCw, Loader2,
  Sparkles, Code, FileText, Search, Filter, Calendar, MousePointer,
  Video, Zap, Plus, Edit, Copy
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { testManagementService, TestCase } from '@/lib/test-management-service';

interface RecordedSession {
  id: string;
  name: string;
  description: string;
  startUrl: string;
  actionCount: number;
  duration?: number;
  status: 'draft' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
  tags: string[];
  testType: string;
  script?: string;
  actions?: any[];
}

export default function Trace() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<RecordedSession[]>([]);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<RecordedSession | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('recordings');

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      // Load test cases from unified service (includes Flowstral recordings)
      const cases = await testManagementService.getTestCases(forceRefresh);
      setTestCases(cases);

      // Convert test cases to session format for display
      const recordedSessions: RecordedSession[] = cases
        .filter(tc => tc.automationScript || tc.testType === 'automated')
        .map(tc => ({
          id: tc.id,
          name: tc.name,
          description: tc.description,
          startUrl: tc.preconditions?.[0]?.replace('Application accessible at ', '') || '',
          actionCount: tc.steps.length,
          status: 'approved' as const,
          createdAt: tc.createdAt,
          updatedAt: tc.updatedAt,
          tags: tc.tags,
          testType: tc.testType,
          script: tc.automationScript,
          actions: tc.steps.map(s => ({ description: s.action, expectedResult: s.expectedResult })),
        }));

      // Also check localStorage for extension recordings
      try {
        const extensionActions = localStorage.getItem('flowstral_actions');
        if (extensionActions) {
          const actions = JSON.parse(extensionActions);
          if (actions.length > 0) {
            const unsavedSession: RecordedSession = {
              id: 'unsaved-recording',
              name: 'Unsaved Recording',
              description: `${actions.length} actions from current browser session`,
              startUrl: actions[0]?.url || '',
              actionCount: actions.length,
              status: 'draft',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              tags: ['unsaved'],
              testType: 'automated',
              actions,
            };
            recordedSessions.unshift(unsavedSession);
          }
        }
      } catch (e) {
        console.warn('Failed to load extension recordings:', e);
      }

      setSessions(recordedSessions);
    } catch (error: any) {
      console.error('Failed to load recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deleteSession = async (sessionId: string) => {
    if (!window.confirm('Are you sure you want to delete this recording?')) return;

    try {
      if (sessionId === 'unsaved-recording') {
        localStorage.removeItem('flowstral_actions');
        toast.success('Unsaved recording cleared');
      } else {
        await testManagementService.deleteTestCase(sessionId);
        toast.success('Recording deleted');
      }
      loadData(true);
    } catch (error) {
      toast.error('Failed to delete recording');
    }
  };

  const openInWorkflowEditor = (session: RecordedSession) => {
    // Store session data for workflow editor to import
    localStorage.setItem('workflow_import_session', JSON.stringify(session));
    // Navigate to unified builder with import=trace param
    navigate(`/builder?import=trace`);
    toast.success('Opening in Test Builder...');
  };

  const viewSessionDetails = async (session: RecordedSession) => {
    // Fetch full test case with script
    try {
      const response = await fetch(`http://localhost:8000/api/flowstral/test-cases/${session.id}`);
      if (response.ok) {
        const data = await response.json();
        const fullTestCase = data.test_case || data;
        
        // Update session with full data including script
        const fullSession: RecordedSession = {
          ...session,
          script: fullTestCase.script || fullTestCase.metadata?.script,
          actions: fullTestCase.actions || session.actions,
          description: fullTestCase.metadata?.description || session.description,
          startUrl: fullTestCase.metadata?.start_url || session.startUrl,
        };
        
        setSelectedSession(fullSession);
        setShowDetailsDialog(true);
      } else {
        // Fall back to what we have
        setSelectedSession(session);
        setShowDetailsDialog(true);
      }
    } catch (error) {
      console.error('Failed to fetch full test case:', error);
      setSelectedSession(session);
      setShowDetailsDialog(true);
    }
  };

  const runTest = async (session: RecordedSession) => {
    if (!session.script) {
      toast.error('No automation script available for this recording');
      return;
    }

    try {
      toast.info('Starting test execution...');
      
      const response = await fetch('http://localhost:8000/api/flowstral/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: session.script,
          language: 'playwright-python',
          options: { browser: 'chromium', headless: false },
        }),
      });

      const result = await response.json();
      
      if (result.success || result.status === 'passed') {
        toast.success('Test passed!');
      } else {
        toast.error(`Test failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      toast.error(`Execution failed: ${error.message}`);
    }
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesStatus = filterStatus === 'all' || session.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'draft':
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'archived':
        return <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Archived</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Video className="h-8 w-8 text-purple-500" />
            Trace - Recording Manager
          </h1>
          <p className="text-muted-foreground mt-2">
            View and manage your recorded browser sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadData(true)}
            disabled={refreshing}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button onClick={() => window.open('chrome-extension://YOUR_EXTENSION_ID/sidepanel.html', '_blank')}>
            <Sparkles className="h-4 w-4 mr-2" />
            Open Recorder
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Recordings</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <Video className="h-8 w-8 text-purple-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-green-600">
                  {sessions.filter(s => s.status === 'approved').length}
                </p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Drafts</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {sessions.filter(s => s.status === 'draft').length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Actions</p>
                <p className="text-2xl font-bold text-blue-600">
                  {sessions.reduce((acc, s) => acc + s.actionCount, 0)}
                </p>
              </div>
              <MousePointer className="h-8 w-8 text-blue-500 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="recordings">
            <Video className="h-4 w-4 mr-2" />
            Recordings ({filteredSessions.length})
          </TabsTrigger>
          <TabsTrigger value="howto">
            <Sparkles className="h-4 w-4 mr-2" />
            How to Record
          </TabsTrigger>
        </TabsList>

        <TabsContent value="recordings" className="space-y-4">
          {/* Search & Filter */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search recordings..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Recordings List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSessions.length === 0 ? (
            <Card className="p-12 text-center">
              <Video className="h-12 w-12 mx-auto text-muted-foreground opacity-20 mb-4" />
              <h3 className="text-lg font-medium mb-2">No recordings found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'Try adjusting your search' : 'Record your first test using the browser extension'}
              </p>
              {!searchQuery && (
                <Button>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Start Recording
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredSessions.map(session => (
                <Card key={session.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold truncate">{session.name}</h3>
                          {getStatusBadge(session.status)}
                          {session.id === 'unsaved-recording' && (
                            <Badge variant="destructive" className="text-xs">Unsaved</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate mb-2">
                          {session.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MousePointer className="h-3 w-3" />
                            {session.actionCount} actions
                          </span>
                          {session.startUrl && (
                            <span className="truncate max-w-[200px]">
                              {session.startUrl}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(session.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        {session.tags.length > 0 && (
                          <div className="flex gap-1 mt-2">
                            {session.tags.slice(0, 4).map((tag, i) => (
                              <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 ml-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewSessionDetails(session)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openInWorkflowEditor(session)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {session.script && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => runTest(session)}
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteSession(session.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="howto" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                How to Record Browser Sessions
              </CardTitle>
              <CardDescription>
                Follow these steps to record and save your test sessions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 border rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    1
                  </div>
                  <h3 className="font-semibold mb-2">Install Extension</h3>
                  <p className="text-sm text-muted-foreground">
                    Install the Flowstral browser extension from Chrome Web Store or load it from the extension folder.
                  </p>
                </div>
                
                <div className="text-center p-6 border rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    2
                  </div>
                  <h3 className="font-semibold mb-2">Start Recording</h3>
                  <p className="text-sm text-muted-foreground">
                    Click the extension icon, select your application type, and click "Start Recording" to begin capturing actions.
                  </p>
                </div>
                
                <div className="text-center p-6 border rounded-lg">
                  <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                    3
                  </div>
                  <h3 className="font-semibold mb-2">Save & Review</h3>
                  <p className="text-sm text-muted-foreground">
                    Stop recording, review the captured steps, and save or approve your test case.
                  </p>
                </div>
              </div>

              <div className="border-t pt-6">
                <h4 className="font-semibold mb-4">Features</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Smart Selectors</p>
                      <p className="text-sm text-muted-foreground">Automatically generates robust selectors for 20+ frameworks</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Multi-Framework Export</p>
                      <p className="text-sm text-muted-foreground">Export to Playwright, Selenium, Cypress, and more</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Self-Healing</p>
                      <p className="text-sm text-muted-foreground">Multiple fallback selectors for reliability</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <p className="font-medium">Workflow Integration</p>
                      <p className="text-sm text-muted-foreground">Import recordings into the visual Workflow Editor</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Session Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              {selectedSession?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedSession && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  {getStatusBadge(selectedSession.status)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Actions</p>
                  <p className="font-medium">{selectedSession.actionCount}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p className="font-medium">{new Date(selectedSession.createdAt).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Start URL</p>
                  <p className="font-medium truncate">{selectedSession.startUrl || '-'}</p>
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p>{selectedSession.description}</p>
              </div>

              {selectedSession.actions && selectedSession.actions.length > 0 && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Recorded Steps ({selectedSession.actions.length})</p>
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-3">
                    {selectedSession.actions.map((action: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3 text-sm">
                        <span className="text-muted-foreground w-6">{idx + 1}.</span>
                        <span>{action.description || action.action || JSON.stringify(action)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedSession.script && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Generated Script</p>
                  <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded-lg overflow-x-auto max-h-48">
                    {selectedSession.script}
                  </pre>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Close
            </Button>
            {selectedSession && (
              <>
                <Button variant="outline" onClick={() => openInWorkflowEditor(selectedSession)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit in Workflow
                </Button>
                {selectedSession.script && (
                  <Button onClick={() => runTest(selectedSession)}>
                    <Play className="h-4 w-4 mr-2" />
                    Run Test
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

