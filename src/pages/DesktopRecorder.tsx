/**
 * Desktop Recorder Panel - Full Featured UI
 * 
 * Layout:
 * - Left Panel: URL bar, Record controls, Recorded Steps
 * - Right Panel: Tabs for Suggestions, SF Tools, SF Context
 */

import { useState, useEffect, useRef } from "react";
import { 
  Play, Square, Lightbulb, ChevronRight, Trash2, Plus,
  ExternalLink, Globe, ArrowLeft, ArrowRight, RefreshCw,
  Download, FileCode, Copy, CheckCircle, Loader2, Video,
  MousePointer, Keyboard, Navigation, Eye, ZoomIn, ZoomOut,
  Sparkles, Shield, Zap, Target, Database, Search, Filter,
  CheckSquare, Wand2, Settings, Cloud, Link, Type, Hash,
  LayoutGrid, List, ChevronDown, CircleDot, FormInput
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { SalesforceContextPanel } from "@/components/SalesforceContextPanel";

interface RecordedAction {
  id: string;
  qword: string;
  args: string[];
  displayArgs?: string[];
  description: string;
  timestamp: number;
  selector?: {
    type: string;
    value: string;
    confidence: number;
  };
}

interface Suggestion {
  type: string;
  qword: string;
  args: string[];
  description: string;
  element: string;
  category: string;
  selector?: string;
  selectorObj?: {
    primary: string;
    type: string;
    value: string;
    text: string;
  };
}

interface SuggestResult {
  suggestions: Suggestion[];
  categories: Record<string, Suggestion[]>;
  counts: Record<string, number>;
  timing: string;
  total: number;
}

// Check if running in Electron
const isElectron = () => {
  return !!(window as any).electronAPI;
};

export default function DesktopRecorder() {
  const [url, setUrl] = useState("https://");
  const [isRecording, setIsRecording] = useState(false);
  const [actions, setActions] = useState<RecordedAction[]>([]);
  const [suggestResult, setSuggestResult] = useState<SuggestResult | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [browserReady, setBrowserReady] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const [rightPanelTab, setRightPanelTab] = useState<string>('suggestions');
  const [elementFilter, setElementFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const urlInputRef = useRef<HTMLInputElement | null>(null);
  
  // Detect if current URL is Salesforce
  const isSalesforceUrl = currentUrl.includes('salesforce.com') || 
                          currentUrl.includes('.force.com') || 
                          currentUrl.includes('lightning.force') ||
                          currentUrl.includes('.my.salesforce');

  // Initialize on mount
  useEffect(() => {
    const api = (window as any).electronAPI;
    if (!api) {
      console.log('[DesktopRecorder] Not running in Electron');
      return;
    }

    api.focusWebapp?.();

    const unsubAction = api.on('action-recorded', (action: RecordedAction) => {
      console.log('[DesktopRecorder] Action received:', action);
      setActions(prev => [...prev, action]);
    });

    const unsubUrl = api.on('browser-url-changed', (newUrl: string) => {
      setCurrentUrl(newUrl);
      setUrl(newUrl);
      if (!browserReady) setBrowserReady(true);
    });

    const unsubRecording = api.on('recording-status', ({ recording, actions: recordedActions }: { recording: boolean; actions?: RecordedAction[] }) => {
      setIsRecording(recording);
      if (recordedActions?.length) {
        setActions(recordedActions);
      }
    });

    setBrowserReady(true);
    console.log('[DesktopRecorder] Initialized');

    setTimeout(() => {
      urlInputRef.current?.focus();
    }, 300);

    return () => {
      unsubAction?.();
      unsubUrl?.();
      unsubRecording?.();
    };
  }, [browserReady]);

  const handleNavigate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const api = (window as any).electronAPI;
    if (!api || !url) return;

    try {
      const navigatedUrl = await api.navigateEmbeddedBrowser(url);
      if (navigatedUrl) {
        setCurrentUrl(navigatedUrl);
        toast.success(`Navigated to ${new URL(navigatedUrl).hostname}`);
      }
    } catch (error) {
      console.error('[DesktopRecorder] Navigation failed:', error);
      toast.error("Failed to navigate");
    }
  };

  const handleStartRecording = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    try {
      setActions([]);
      await api.startRecording();
      setIsRecording(true);
      
      setTimeout(async () => {
        const initialActions = await api.getActions?.();
        if (initialActions?.length > 0) {
          setActions(initialActions);
        }
      }, 100);
      
      toast.success("Recording started - interact with the page");
    } catch (error) {
      console.error('[DesktopRecorder] Failed to start recording:', error);
      toast.error("Failed to start recording");
    }
  };

  const handleStopRecording = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    try {
      const recordedActions = await api.stopRecording();
      setIsRecording(false);
      if (recordedActions?.length > 0) {
        setActions(recordedActions);
        toast.success(`Recording stopped - ${recordedActions.length} actions captured`);
      } else {
        toast.info("Recording stopped - no actions captured");
      }
    } catch (error) {
      console.error('[DesktopRecorder] Failed to stop recording:', error);
      toast.error("Failed to stop recording");
    }
  };

  const handleSuggest = async () => {
    const api = (window as any).electronAPI;
    if (!api) return;

    setIsLoadingSuggestions(true);
    try {
      const result: SuggestResult = await api.suggestActions();
      setSuggestResult(result);
      
      if (result?.total > 0) {
        toast.success(`Found ${result.total} suggestions in ${result.timing}`);
      } else {
        toast.info("No suggestions found on this page");
      }
    } catch (error) {
      console.error('[DesktopRecorder] Failed to get suggestions:', error);
      toast.error("Failed to get suggestions");
    } finally {
      setIsLoadingSuggestions(false);
    }
  };

  const handleClearActions = () => {
    setActions([]);
    setSuggestResult(null);
    toast.info("Cleared all actions");
  };

  const handleExportToBuilder = async () => {
    const api = (window as any).electronAPI;
    if (!api || actions.length === 0) {
      toast.error("No actions to export");
      return;
    }

    try {
      const result = await api.exportToTestBuilder("Recorded Test");
      if (result?.success) {
        toast.success("Exported to Test Builder!");
      } else {
        toast.error(result?.error || "Export failed");
      }
    } catch (error) {
      console.error('[DesktopRecorder] Export failed:', error);
      toast.error("Failed to export");
    }
  };

  const handleBack = () => {
    const api = (window as any).electronAPI;
    api?.browserBack();
  };

  const handleForward = () => {
    const api = (window as any).electronAPI;
    api?.browserForward();
  };

  const handleRefresh = () => {
    const api = (window as any).electronAPI;
    api?.browserRefresh();
  };

  const getActionIcon = (qword: string) => {
    switch (qword) {
      case 'GoTo':
        return <Navigation className="h-4 w-4 text-blue-400" />;
      case 'ClickText':
      case 'ClickElement':
        return <MousePointer className="h-4 w-4 text-green-400" />;
      case 'Fill':
        return <Type className="h-4 w-4 text-purple-400" />;
      case 'AssertText':
        return <Eye className="h-4 w-4 text-cyan-400" />;
      default:
        return <CircleDot className="h-4 w-4 text-gray-400" />;
    }
  };

  const toggleSuggestionSelection = (index: number) => {
    setSelectedSuggestions(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const selectAllSuggestions = () => {
    if (!suggestResult) return;
    const all = new Set(suggestResult.suggestions.map((_, i) => i));
    setSelectedSuggestions(all);
  };

  const addSelectedToTest = async () => {
    if (!suggestResult || selectedSuggestions.size === 0) return;
    
    const api = (window as any).electronAPI;
    if (!api) return;
    
    for (const index of selectedSuggestions) {
      const suggestion = suggestResult.suggestions[index];
      if (suggestion) {
        const addedAction = await api.addAction({
          qword: suggestion.qword,
          args: suggestion.args,
          selector: suggestion.selector,
          selectorObj: suggestion.selectorObj,
          description: suggestion.description
        });
        if (addedAction) {
          setActions(prev => [...prev, addedAction]);
        }
      }
    }
    
    toast.success(`Added ${selectedSuggestions.size} actions to test`);
    setSelectedSuggestions(new Set());
  };

  // Filter suggestions
  const filteredSuggestions = suggestResult?.suggestions.filter(s => {
    if (elementFilter !== 'all') {
      const category = s.category?.toLowerCase() || s.type?.toLowerCase() || '';
      if (elementFilter === 'buttons' && !category.includes('button')) return false;
      if (elementFilter === 'links' && !category.includes('link')) return false;
      if (elementFilter === 'inputs' && !category.includes('input') && s.qword !== 'Fill') return false;
      if (elementFilter === 'headings' && !category.includes('heading')) return false;
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return s.description.toLowerCase().includes(query) || 
             s.element?.toLowerCase().includes(query) ||
             s.args?.some(a => a.toLowerCase().includes(query));
    }
    return true;
  }) || [];

  // Not in Electron - show message
  if (!isElectron()) {
    return (
      <div className="h-screen bg-[#0a0a0f] flex items-center justify-center p-4">
        <Card className="max-w-md bg-[#12121a] border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Video className="h-5 w-5 text-cyan-400" />
              Desktop Recorder
            </CardTitle>
          </CardHeader>
          <CardContent className="text-gray-400">
            <p className="mb-4">
              This recorder requires Flowstral Desktop to work.
            </p>
            <Button 
              onClick={() => window.open('https://flowstral.dev/download', '_blank')}
              className="bg-gradient-to-r from-cyan-500 to-purple-500 text-white"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Flowstral Desktop
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleContainerClick = () => {
    const api = (window as any).electronAPI;
    api?.focusWebapp?.();
  };

  return (
    <div 
      className="h-screen bg-[#0d0d14] flex overflow-hidden"
      style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      onClick={handleContainerClick}
    >
      {/* ==================== LEFT PANEL ==================== */}
      <div className="w-[400px] flex flex-col border-r border-white/10 bg-[#0a0a0f]">
        {/* Status Bar */}
        <div className="h-10 px-4 flex items-center gap-2 border-b border-white/10 bg-[#0d0d14]">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
          )} />
          <span className="text-xs text-gray-400">
            {isRecording ? 'Recording' : 'Ready'}
          </span>
          <span className="text-xs text-gray-600 ml-auto">
            {actions.length} steps
          </span>
        </div>

        {/* URL Bar */}
        <div className="p-3 border-b border-white/10">
          <form onSubmit={handleNavigate} className="flex gap-2">
            <div className="flex gap-1">
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white" onClick={handleBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white" onClick={handleForward}>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-gray-400 hover:text-white" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex-1 relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                ref={urlInputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onFocus={(e) => e.target.select()}
                placeholder="https://..."
                className="pl-10 h-9 bg-[#1a1a25] border-white/10 text-white text-sm"
              />
            </div>
          </form>
        </div>

        {/* Record Controls */}
        <div className="p-3 border-b border-white/10 flex gap-2">
          {!isRecording ? (
            <Button
              onClick={handleStartRecording}
              className="flex-1 h-10 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-medium"
              disabled={!currentUrl}
            >
              <CircleDot className="h-4 w-4 mr-2" />
              Start Recording
            </Button>
          ) : (
            <Button
              onClick={handleStopRecording}
              variant="destructive"
              className="flex-1 h-10 font-medium"
            >
              <Square className="h-4 w-4 mr-2" />
              Stop Recording
            </Button>
          )}
          
          <Button
            onClick={() => {/* Navigate to automate existing */}}
            variant="outline"
            className="flex-1 h-10 border-purple-500/50 text-purple-400 hover:bg-purple-500/10 font-medium"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Automate Existing
          </Button>
        </div>

        {/* Recorded Steps Header */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-white">Recorded Steps</span>
            <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
              {actions.length}
            </Badge>
          </div>
          {actions.length > 0 && (
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-gray-400 hover:text-white"
                onClick={handleClearActions}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-cyan-400 hover:text-cyan-300"
                onClick={handleExportToBuilder}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Export
              </Button>
            </div>
          )}
        </div>

        {/* Recorded Steps List */}
        <div className="flex-1 overflow-y-auto">
          {actions.length === 0 ? (
            <div className="text-center py-12 px-4 text-gray-500">
              <Video className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No steps recorded yet</p>
              <p className="text-xs mt-1 text-gray-600">
                {currentUrl ? "Click Start Recording to begin" : "Navigate to a URL first"}
              </p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {actions.map((action, index) => (
                <div
                  key={action.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-[#12121a] hover:bg-[#1a1a25] transition-colors border border-transparent hover:border-white/5"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-full bg-white/5 text-xs text-gray-500 font-medium">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  {getActionIcon(action.qword)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">
                      {action.description || `${action.qword} ${action.args?.[0] || ''}`}
                    </p>
                    {action.args && action.args.length > 0 && (
                      <p className="text-xs text-gray-500 truncate">
                        {action.args.join(' → ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-3 border-t border-white/10 bg-[#0d0d14]">
          <Button
            onClick={handleExportToBuilder}
            className="w-full h-10 bg-gradient-to-r from-cyan-500 to-purple-500 hover:from-cyan-600 hover:to-purple-600 text-white font-medium"
            disabled={actions.length === 0}
          >
            <FileCode className="h-4 w-4 mr-2" />
            Export to Test Builder
          </Button>
        </div>
      </div>

      {/* ==================== RIGHT PANEL ==================== */}
      <div className="flex-1 flex flex-col bg-[#0d0d14] overflow-hidden">
        {/* Tabs */}
        <Tabs value={rightPanelTab} onValueChange={setRightPanelTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-white/10">
            <TabsList className="h-9 bg-[#1a1a25] p-1">
              <TabsTrigger 
                value="suggestions" 
                className="h-7 px-4 text-sm data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-400"
              >
                <Lightbulb className="h-4 w-4 mr-2" />
                Suggestions
                {suggestResult?.total && (
                  <Badge className="ml-2 h-5 bg-amber-500/30 text-amber-300 text-xs">
                    {suggestResult.total}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger 
                value="sftools" 
                className="h-7 px-4 text-sm data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
              >
                <Cloud className="h-4 w-4 mr-2" />
                SF Tools
              </TabsTrigger>
              <TabsTrigger 
                value="sfcontext" 
                className="h-7 px-4 text-sm data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-400"
              >
                <Target className="h-4 w-4 mr-2" />
                SF Context
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ========== SUGGESTIONS TAB ========== */}
          <TabsContent value="suggestions" className="flex-1 m-0 overflow-hidden flex flex-col">
            {/* Suggestions Header */}
            <div className="px-4 py-3 border-b border-white/10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-amber-400" />
                  <span className="text-sm font-semibold text-white">Suggested Actions</span>
                  {suggestResult?.total && (
                    <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                      {suggestResult.total} ITEMS
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleSuggest}
                  variant="outline"
                  size="sm"
                  className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                  disabled={!currentUrl || isLoadingSuggestions}
                >
                  {isLoadingSuggestions ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Refresh
                </Button>
              </div>

              {/* Category Filter Badges */}
              <div className="flex gap-2 flex-wrap">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-colors",
                    elementFilter === 'all' 
                      ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" 
                      : "border-white/20 text-gray-400 hover:border-white/40"
                  )}
                  onClick={() => setElementFilter('all')}
                >
                  All
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-colors",
                    elementFilter === 'buttons' 
                      ? "bg-green-500/20 border-green-500/50 text-green-400" 
                      : "border-white/20 text-gray-400 hover:border-white/40"
                  )}
                  onClick={() => setElementFilter('buttons')}
                >
                  <CircleDot className="h-3 w-3 mr-1" />
                  Buttons {suggestResult?.counts?.buttons || 0}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-colors",
                    elementFilter === 'links' 
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400" 
                      : "border-white/20 text-gray-400 hover:border-white/40"
                  )}
                  onClick={() => setElementFilter('links')}
                >
                  <Link className="h-3 w-3 mr-1" />
                  Links {suggestResult?.counts?.links || 0}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-colors",
                    elementFilter === 'inputs' 
                      ? "bg-purple-500/20 border-purple-500/50 text-purple-400" 
                      : "border-white/20 text-gray-400 hover:border-white/40"
                  )}
                  onClick={() => setElementFilter('inputs')}
                >
                  <FormInput className="h-3 w-3 mr-1" />
                  Inputs {suggestResult?.counts?.inputs || 0}
                </Badge>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "cursor-pointer transition-colors",
                    elementFilter === 'headings' 
                      ? "bg-amber-500/20 border-amber-500/50 text-amber-400" 
                      : "border-white/20 text-gray-400 hover:border-white/40"
                  )}
                  onClick={() => setElementFilter('headings')}
                >
                  <Hash className="h-3 w-3 mr-1" />
                  Headings {suggestResult?.counts?.headings || 0}
                </Badge>
              </div>
            </div>

            {/* Action Buttons Row */}
            <div className="px-4 py-2 border-b border-white/10 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={selectAllSuggestions}
                className="h-8 border-green-500/30 text-green-400 hover:bg-green-500/10"
                disabled={!suggestResult?.suggestions?.length}
              >
                <CheckSquare className="h-4 w-4 mr-2" />
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={addSelectedToTest}
                className="h-8 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10"
                disabled={selectedSuggestions.size === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                disabled={!suggestResult?.suggestions?.length}
              >
                <Wand2 className="h-4 w-4 mr-2" />
                AI Enhance
              </Button>
            </div>

            {/* Search and Filter */}
            <div className="px-4 py-2 border-b border-white/10 flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search elements..."
                  className="pl-10 h-9 bg-[#1a1a25] border-white/10 text-white text-sm"
                />
              </div>
              <Select value={elementFilter} onValueChange={setElementFilter}>
                <SelectTrigger className="w-36 h-9 bg-[#1a1a25] border-white/10 text-white text-sm">
                  <SelectValue placeholder="All Elements" />
                </SelectTrigger>
                <SelectContent className="bg-[#1a1a25] border-white/10">
                  <SelectItem value="all">All Elements</SelectItem>
                  <SelectItem value="buttons">Buttons</SelectItem>
                  <SelectItem value="links">Links</SelectItem>
                  <SelectItem value="inputs">Inputs</SelectItem>
                  <SelectItem value="headings">Headings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Suggestions List */}
            <div className="flex-1 overflow-y-auto p-4">
              {!suggestResult ? (
                <div className="text-center py-12 text-gray-500">
                  <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Start recording to see suggestions</p>
                  <p className="text-xs mt-1 text-gray-600">
                    Click Refresh to analyze current page
                  </p>
                </div>
              ) : filteredSuggestions.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Search className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No matching elements found</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredSuggestions.map((suggestion, index) => (
                    <div
                      key={index}
                      onClick={() => toggleSuggestionSelection(index)}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        selectedSuggestions.has(index)
                          ? "bg-cyan-500/10 border-cyan-500/50"
                          : "bg-[#12121a] border-transparent hover:border-white/10"
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                        selectedSuggestions.has(index)
                          ? "bg-cyan-500 border-cyan-500"
                          : "border-gray-600"
                      )}>
                        {selectedSuggestions.has(index) && (
                          <CheckCircle className="h-3 w-3 text-white" />
                        )}
                      </div>
                      
                      <div className={cn(
                        "w-8 h-8 rounded flex items-center justify-center",
                        suggestion.qword === 'ClickText' && "bg-green-500/20 text-green-400",
                        suggestion.qword === 'Fill' && "bg-purple-500/20 text-purple-400",
                        suggestion.qword === 'AssertText' && "bg-cyan-500/20 text-cyan-400",
                        !['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && "bg-gray-500/20 text-gray-400"
                      )}>
                        {suggestion.qword === 'ClickText' && <MousePointer className="h-4 w-4" />}
                        {suggestion.qword === 'Fill' && <Keyboard className="h-4 w-4" />}
                        {suggestion.qword === 'AssertText' && <Eye className="h-4 w-4" />}
                        {!['ClickText', 'Fill', 'AssertText'].includes(suggestion.qword) && <CircleDot className="h-4 w-4" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{suggestion.description}</p>
                        <p className="text-xs text-gray-500 truncate">{suggestion.element || suggestion.args?.[0]}</p>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const api = (window as any).electronAPI;
                            if (!api) return;
                            
                            toast.loading(`Executing...`, { id: 'exec' });
                            try {
                              const result = await api.executeAction({
                                qword: suggestion.qword,
                                args: suggestion.args,
                                selector: suggestion.selector,
                                selectorObj: suggestion.selectorObj
                              });
                              if (result?.success) {
                                toast.success(`Done!`, { id: 'exec' });
                              } else {
                                toast.error(result?.error || 'Failed', { id: 'exec' });
                              }
                            } catch (err) {
                              toast.error('Failed', { id: 'exec' });
                            }
                          }}
                        >
                          <Play className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-400 hover:text-green-300 hover:bg-green-500/20"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const api = (window as any).electronAPI;
                            if (!api) return;
                            
                            const addedAction = await api.addAction({
                              qword: suggestion.qword,
                              args: suggestion.args,
                              selector: suggestion.selector,
                              selectorObj: suggestion.selectorObj,
                              description: suggestion.description
                            });
                            
                            if (addedAction) {
                              setActions(prev => [...prev, addedAction]);
                              toast.success(`Added to test`);
                            }
                          }}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Info */}
            {suggestResult && (
              <div className="px-4 py-2 border-t border-white/10 bg-[#0a0a0f]">
                <p className="text-xs text-gray-500 text-center">
                  Found {suggestResult.total} elements in {suggestResult.timing}
                </p>
              </div>
            )}
          </TabsContent>

          {/* ========== SF TOOLS TAB ========== */}
          <TabsContent value="sftools" className="flex-1 m-0 overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="text-center py-8">
                <Cloud className="h-12 w-12 mx-auto mb-3 text-blue-400 opacity-50" />
                <h3 className="text-lg font-semibold text-white mb-2">Salesforce Tools</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Quick access to Salesforce-specific testing tools
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Card className="bg-[#12121a] border-white/10 hover:border-blue-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Database className="h-8 w-8 mx-auto mb-2 text-blue-400" />
                    <p className="text-sm font-medium text-white">Query Builder</p>
                    <p className="text-xs text-gray-500">Build SOQL queries</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-green-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 mx-auto mb-2 text-green-400" />
                    <p className="text-sm font-medium text-white">Apex Runner</p>
                    <p className="text-xs text-gray-500">Execute Apex code</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-purple-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Copy className="h-8 w-8 mx-auto mb-2 text-purple-400" />
                    <p className="text-sm font-medium text-white">Record Cloner</p>
                    <p className="text-xs text-gray-500">Clone test data</p>
                  </CardContent>
                </Card>
                <Card className="bg-[#12121a] border-white/10 hover:border-amber-500/30 cursor-pointer transition-colors">
                  <CardContent className="p-4 text-center">
                    <Shield className="h-8 w-8 mx-auto mb-2 text-amber-400" />
                    <p className="text-sm font-medium text-white">Validation Rules</p>
                    <p className="text-xs text-gray-500">View active rules</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          {/* ========== SF CONTEXT TAB ========== */}
          <TabsContent value="sfcontext" className="flex-1 m-0 overflow-hidden">
            {isSalesforceUrl ? (
              <SalesforceContextPanel
                currentUrl={currentUrl}
                isRecording={isRecording}
                onAddAssertion={(code) => {
                  const action = {
                    id: `assert_${Date.now()}`,
                    qword: 'AssertText',
                    args: [code],
                    description: `Assert: ${code.slice(0, 30)}...`,
                    timestamp: Date.now()
                  };
                  setActions(prev => [...prev, action as RecordedAction]);
                  toast.success('Assertion added');
                }}
                onAddAction={(code) => {
                  const action = {
                    id: `action_${Date.now()}`,
                    qword: 'Custom',
                    args: [code],
                    description: code.slice(0, 50),
                    timestamp: Date.now()
                  };
                  setActions(prev => [...prev, action as RecordedAction]);
                  toast.success('Action added');
                }}
                onGenerateTestData={(data) => {
                  toast.success(`Generated ${data.length} test records`);
                }}
                className="h-full"
              />
            ) : (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Target className="h-12 w-12 mx-auto mb-3 text-purple-400 opacity-50" />
                  <h3 className="text-lg font-semibold text-white mb-2">SF Context</h3>
                  <p className="text-sm text-gray-400">
                    Navigate to a Salesforce page to see context-aware suggestions
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
