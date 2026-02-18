/**
 * CodeAlchemy - Repository to Test Case Transformer
 * 
 * Transform any automation code repository into executable test cases.
 * No code visible - just beautiful, runnable test cases in the Builder.
 * 
 * Design: Theme-aware with golden accents (alchemy theme)
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch, Github, Gitlab, Cloud, Loader2, CheckCircle2,
  AlertCircle, ArrowRight, ArrowLeft, Search, Filter, Download,
  Play, ChevronDown, ChevronRight, Sparkles, FlaskConical,
  FolderGit2, FileCode, TestTube, Zap, Eye, Package,
  Check, X, RefreshCw, ExternalLink, Copy, Wand2,
  Layers, Target, Clock, Tag, AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { API_BASE_URL as API_BASE } from '@/lib/api-config';

// Types
interface TestCasePreview {
  id: string;
  name: string;
  description: string;
  priority: string;
  tags: string[];
  stepCount: number;
  assertionCount: number;
  originalFile: string;
  originalClass: string;
}

interface AnalysisResult {
  success: boolean;
  errorMessage?: string;
  repositoryUrl: string;
  branch: string;
  provider: string;
  frameworkType: string;
  frameworkName: string;
  language: string;
  patternsUsed: string[];
  filesAnalyzed: number;
  testFilesFound: number;
  testMethodsFound: number;
  pageObjectsFound: number;
  assertionsFound: number;
  analysisId: string;
  analyzedAt: string;
  durationSeconds: number;
  domain: string;
  entities: string[];
}

interface ImportJob {
  jobId: string;
  status: string;
  totalTestCases: number;
  importedCount: number;
  failedCount: number;
  progressPercent: number;
  currentItem: string;
  errors: { testCaseId: string; name: string; error: string }[];
}

type WizardStep = 'connect' | 'analyze' | 'preview' | 'import';

// VCS Provider icons
const VCSIcons: Record<string, typeof Github> = {
  github: Github,
  gitlab: Gitlab,
  bitbucket: Cloud,
  'azure-devops': Cloud,
};

export default function CodeAlchemy() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>('connect');
  
  // Connect step state
  const [repoUrl, setRepoUrl] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main', 'master']);
  const [accessToken, setAccessToken] = useState('');
  const [detectedProvider, setDetectedProvider] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);
  
  // Analyze step state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  
  // Preview step state
  const [testCases, setTestCases] = useState<TestCasePreview[]>([]);
  const [selectedTestIds, setSelectedTestIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  
  // Import step state
  const [suiteName, setSuiteName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importJob, setImportJob] = useState<ImportJob | null>(null);
  const [importComplete, setImportComplete] = useState(false);
  
  // Detect VCS provider from URL
  useEffect(() => {
    if (repoUrl.includes('github.com')) {
      setDetectedProvider('github');
    } else if (repoUrl.includes('gitlab.com')) {
      setDetectedProvider('gitlab');
    } else if (repoUrl.includes('bitbucket.org')) {
      setDetectedProvider('bitbucket');
    } else if (repoUrl.includes('dev.azure.com') || repoUrl.includes('visualstudio.com')) {
      setDetectedProvider('azure-devops');
    } else {
      setDetectedProvider(null);
    }
  }, [repoUrl]);
  
  // Load branches when URL changes
  const loadBranches = useCallback(async () => {
    if (!repoUrl || !detectedProvider) return;
    
    setIsLoadingBranches(true);
    try {
      const response = await fetch(`${API_BASE}/api/code-alchemy/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: repoUrl, token: accessToken || undefined }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setBranches(data.branches || ['main', 'master']);
        if (data.branches?.length > 0 && !data.branches.includes(selectedBranch)) {
          setSelectedBranch(data.branches[0]);
        }
      }
    } catch (error) {
      console.error('Failed to load branches:', error);
    } finally {
      setIsLoadingBranches(false);
    }
  }, [repoUrl, detectedProvider, accessToken, selectedBranch]);
  
  // Analyze repository
  const analyzeRepository = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    setAnalysisProgress(0);
    setCurrentStep('analyze');
    
    // Simulate progress
    const progressInterval = setInterval(() => {
      setAnalysisProgress(prev => Math.min(prev + Math.random() * 15, 90));
    }, 500);
    
    try {
      const response = await fetch(`${API_BASE}/api/code-alchemy/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: repoUrl,
          branch: selectedBranch,
          token: accessToken || undefined,
        }),
      });
      
      clearInterval(progressInterval);
      setAnalysisProgress(100);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Analysis failed');
      }
      
      const result: AnalysisResult = await response.json();
      setAnalysisResult(result);
      
      // Auto-generate suite name
      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'repository';
      setSuiteName(`Imported from ${repoName}`);
      
      // Load test cases preview
      await loadTestCasesPreview(result.analysisId);
      
      toast.success(`Found ${result.testMethodsFound} test methods!`);
      
    } catch (error: any) {
      clearInterval(progressInterval);
      setAnalysisError(error.message);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  // Load test cases preview
  const loadTestCasesPreview = async (analysisId: string) => {
    setIsLoadingPreview(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/code-alchemy/analysis/${analysisId}/preview`
      );
      
      if (response.ok) {
        const data = await response.json();
        setTestCases(data.testCases || []);
        
        // Select all by default
        const allIds = new Set(data.testCases?.map((tc: TestCasePreview) => tc.id) || []);
        setSelectedTestIds(allIds);
        
        // Load available tags
        const tagsResponse = await fetch(
          `${API_BASE}/api/code-alchemy/analysis/${analysisId}/tags`
        );
        if (tagsResponse.ok) {
          const tagsData = await tagsResponse.json();
          setAvailableTags(tagsData.tags || []);
        }
        
        setCurrentStep('preview');
      }
    } catch (error) {
      console.error('Failed to load preview:', error);
    } finally {
      setIsLoadingPreview(false);
    }
  };
  
  // Filter test cases
  const filteredTestCases = testCases.filter(tc => {
    if (searchQuery && !tc.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterPriority !== 'all' && tc.priority !== filterPriority) {
      return false;
    }
    if (filterTag !== 'all' && !tc.tags.includes(filterTag)) {
      return false;
    }
    return true;
  });
  
  // Toggle test case selection
  const toggleTestCase = (id: string) => {
    const newSelected = new Set(selectedTestIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedTestIds(newSelected);
  };
  
  // Select/deselect all
  const toggleSelectAll = () => {
    if (selectedTestIds.size === filteredTestCases.length) {
      setSelectedTestIds(new Set());
    } else {
      setSelectedTestIds(new Set(filteredTestCases.map(tc => tc.id)));
    }
  };
  
  // Import test cases
  const importTestCases = async () => {
    if (!analysisResult || selectedTestIds.size === 0) return;
    
    setIsImporting(true);
    setCurrentStep('import');
    
    try {
      const response = await fetch(`${API_BASE}/api/code-alchemy/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analysisResult.analysisId,
          selected_ids: Array.from(selectedTestIds),
          target_suite_name: suiteName,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Import failed');
      }
      
      const job: ImportJob = await response.json();
      setImportJob(job);
      
      // Poll for status if not complete
      if (job.status !== 'completed' && job.status !== 'failed') {
        pollImportStatus(job.jobId);
      } else {
        // Import completed immediately - stop spinner and show success
        setIsImporting(false);
        setImportComplete(true);
        if (job.status === 'completed') {
          toast.success(`Successfully imported ${job.importedCount} test cases!`);
        } else if (job.status === 'failed') {
          toast.error(`Import failed: ${job.errors?.[0]?.error || 'Unknown error'}`);
        }
      }
      
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      setIsImporting(false);
    }
  };
  
  // Poll import status
  const pollImportStatus = async (jobId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/code-alchemy/import/${jobId}`);
      
      if (response.ok) {
        const job: ImportJob = await response.json();
        setImportJob(job);
        
        if (job.status === 'completed' || job.status === 'failed') {
          setIsImporting(false);
          setImportComplete(true);
          if (job.status === 'completed') {
            toast.success(`Successfully imported ${job.importedCount} test cases!`);
          }
        } else {
          // Continue polling
          setTimeout(() => pollImportStatus(jobId), 1000);
        }
      }
    } catch (error) {
      console.error('Failed to poll status:', error);
    }
  };
  
  // Get priority color (theme-aware)
  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      critical: isDark 
        ? 'bg-red-500/20 text-red-400 border-red-500/30' 
        : 'bg-red-50 text-red-700 border-red-200',
      high: isDark 
        ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' 
        : 'bg-orange-50 text-orange-700 border-orange-200',
      medium: isDark 
        ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' 
        : 'bg-yellow-50 text-yellow-700 border-yellow-200',
      low: isDark 
        ? 'bg-green-500/20 text-green-400 border-green-500/30' 
        : 'bg-green-50 text-green-700 border-green-200',
    };
    return colors[priority] || (isDark 
      ? 'bg-slate-500/20 text-slate-400 border-slate-500/30'
      : 'bg-slate-100 text-slate-600 border-slate-200');
  };
  
  // Get provider display info
  const getProviderInfo = (provider: string | null) => {
    const info: Record<string, { name: string; color: string }> = {
      github: { name: 'GitHub', color: isDark ? 'text-white' : 'text-slate-900' },
      gitlab: { name: 'GitLab', color: 'text-orange-500' },
      bitbucket: { name: 'Bitbucket', color: 'text-blue-500' },
      'azure-devops': { name: 'Azure DevOps', color: 'text-blue-600' },
    };
    return provider ? info[provider] : null;
  };
  
  // Render step indicator
  const renderStepIndicator = () => {
    const steps = [
      { key: 'connect', label: 'Connect', icon: FolderGit2 },
      { key: 'analyze', label: 'Analyze', icon: FlaskConical },
      { key: 'preview', label: 'Preview', icon: Eye },
      { key: 'import', label: 'Import', icon: Download },
    ];
    
    const currentIndex = steps.findIndex(s => s.key === currentStep);
    
    return (
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = step.key === currentStep;
          const isCompleted = index < currentIndex;
          
          return (
            <div key={step.key} className="flex items-center">
              <div className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full transition-all",
                isActive && (isDark 
                  ? 'bg-gradient-to-r from-amber-500/30 to-orange-500/30 border border-amber-500/50 text-amber-300'
                  : 'bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-300 text-amber-700'),
                isCompleted && (isDark
                  ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                  : 'bg-green-100 border border-green-300 text-green-700'),
                !isActive && !isCompleted && (isDark
                  ? 'bg-slate-800/50 border border-slate-700 text-slate-500'
                  : 'bg-slate-100 border border-slate-200 text-slate-400')
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                <span className="text-sm font-medium">{step.label}</span>
              </div>
              
              {index < steps.length - 1 && (
                <ChevronRight className={cn(
                  "w-4 h-4 mx-2",
                  index < currentIndex 
                    ? (isDark ? 'text-green-400' : 'text-green-600')
                    : (isDark ? 'text-slate-600' : 'text-slate-300')
                )} />
              )}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className={cn(
      "min-h-screen",
      isDark 
        ? "bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
        : "bg-gradient-to-br from-amber-50/50 via-white to-orange-50/50"
    )}>
      {/* Header */}
      <div className={cn(
        "border-b",
        isDark 
          ? "border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-transparent to-orange-500/5"
          : "border-amber-200 bg-gradient-to-r from-amber-50 via-white to-orange-50"
      )}>
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className={cn(
              "p-3 rounded-xl border",
              isDark
                ? "bg-gradient-to-br from-amber-500/20 to-orange-500/20 border-amber-500/30"
                : "bg-gradient-to-br from-amber-100 to-orange-100 border-amber-200"
            )}>
              <FlaskConical className={cn(
                "w-8 h-8",
                isDark ? "text-amber-400" : "text-amber-600"
              )} />
            </div>
            <div>
              <h1 className={cn(
                "text-2xl font-bold bg-gradient-to-r bg-clip-text text-transparent",
                isDark 
                  ? "from-amber-300 to-orange-400"
                  : "from-amber-600 to-orange-600"
              )}>
                CodeAlchemy
              </h1>
              <p className={cn(
                "text-sm",
                isDark ? "text-slate-400" : "text-slate-600"
              )}>
                Transform any repository into executable test cases
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {renderStepIndicator()}
        
        {/* Connect Step */}
        {currentStep === 'connect' && (
          <Card className={cn(
            isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isDark ? "text-amber-300" : "text-amber-700"
              )}>
                <FolderGit2 className="w-5 h-5" />
                Connect to Repository
              </CardTitle>
              <CardDescription className={isDark ? "text-slate-400" : "text-slate-500"}>
                Enter your repository URL to analyze and convert test cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* VCS Provider Selection */}
              <div className="grid grid-cols-4 gap-4">
                {['github', 'gitlab', 'bitbucket', 'azure-devops'].map(provider => {
                  const Icon = VCSIcons[provider];
                  const info = getProviderInfo(provider);
                  const isSelected = detectedProvider === provider;
                  
                  return (
                    <button
                      key={provider}
                      className={cn(
                        "p-4 rounded-xl border transition-all flex flex-col items-center gap-2",
                        isSelected && (isDark 
                          ? 'bg-amber-500/10 border-amber-500/50 text-amber-300'
                          : 'bg-amber-50 border-amber-300 text-amber-700'),
                        !isSelected && (isDark
                          ? 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:border-slate-300')
                      )}
                    >
                      <Icon className="w-6 h-6" />
                      <span className="text-sm font-medium">{info?.name}</span>
                    </button>
                  );
                })}
              </div>
              
              {/* Repository URL */}
              <div className="space-y-2">
                <Label className={isDark ? "text-slate-300" : "text-slate-700"}>Repository URL</Label>
                <Input
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repository"
                  className={cn(
                    isDark
                      ? "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                      : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                  )}
                />
                {detectedProvider && (
                  <p className={cn(
                    "text-sm flex items-center gap-1",
                    isDark ? "text-amber-400" : "text-amber-600"
                  )}>
                    <Sparkles className="w-3 h-3" />
                    Detected: {getProviderInfo(detectedProvider)?.name}
                  </p>
                )}
              </div>
              
              {/* Branch Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className={isDark ? "text-slate-300" : "text-slate-700"}>Branch</Label>
                  <div className="flex gap-2">
                    <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                      <SelectTrigger className={cn(
                        isDark
                          ? "bg-slate-800/50 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      )}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map(branch => (
                          <SelectItem key={branch} value={branch}>
                            <div className="flex items-center gap-2">
                              <GitBranch className="w-3 h-3" />
                              {branch}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={loadBranches}
                      disabled={isLoadingBranches || !repoUrl}
                      className={isDark ? "border-slate-700" : "border-slate-200"}
                    >
                      <RefreshCw className={`w-4 h-4 ${isLoadingBranches ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label className={isDark ? "text-slate-300" : "text-slate-700"}>Access Token (optional)</Label>
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="For private repositories"
                    className={cn(
                      isDark
                        ? "bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500"
                        : "bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                    )}
                  />
                </div>
              </div>
              
              {/* Quick Examples */}
              <div className="space-y-2">
                <Label className={cn("text-sm", isDark ? "text-slate-300" : "text-slate-600")}>
                  Quick Examples
                </Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { name: 'Selenium Java', url: 'https://github.com/mfaisalkhatri/selenium4poc' },
                    { name: 'Cypress', url: 'https://github.com/cypress-io/cypress-example-recipes' },
                    { name: 'Playwright', url: 'https://github.com/mxschmitt/playwright-test-coverage' },
                  ].map(example => (
                    <button
                      key={example.name}
                      onClick={() => setRepoUrl(example.url)}
                      className={cn(
                        "px-3 py-1 text-xs rounded-full border transition-colors",
                        isDark
                          ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:text-amber-300"
                          : "bg-slate-100 border-slate-200 text-slate-600 hover:border-amber-400 hover:text-amber-700"
                      )}
                    >
                      {example.name}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Start Analysis Button */}
              <Button
                onClick={analyzeRepository}
                disabled={!repoUrl}
                className={cn(
                  "w-full font-semibold",
                  isDark
                    ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                    : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                )}
              >
                <Wand2 className="w-4 h-4 mr-2" />
                Start Analysis
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}
        
        {/* Analyze Step */}
        {currentStep === 'analyze' && (
          <Card className={cn(
            isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isDark ? "text-amber-300" : "text-amber-700"
              )}>
                <FlaskConical className="w-5 h-5" />
                Analyzing Repository
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {isAnalyzing ? (
                <div className="space-y-6 py-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <FlaskConical className={cn(
                        "w-16 h-16 animate-pulse",
                        isDark ? "text-amber-400" : "text-amber-500"
                      )} />
                      <Sparkles className={cn(
                        "w-6 h-6 absolute -top-2 -right-2 animate-bounce",
                        isDark ? "text-amber-300" : "text-amber-400"
                      )} />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-slate-900"
                    )}>
                      Transmuting code into test cases...
                    </p>
                    <p className={cn(
                      "text-sm",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}>
                      Downloading repository, detecting framework, extracting tests
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto">
                    <Progress value={analysisProgress} className="h-2" />
                    <p className={cn(
                      "text-center text-sm mt-2",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}>
                      {Math.round(analysisProgress)}%
                    </p>
                  </div>
                </div>
              ) : analysisError ? (
                <div className="text-center py-8 space-y-4">
                  <AlertCircle className="w-16 h-16 text-red-400 mx-auto" />
                  <p className="text-lg text-red-400">Analysis Failed</p>
                  <p className={isDark ? "text-slate-400" : "text-slate-500"}>{analysisError}</p>
                  <Button
                    variant="outline"
                    onClick={() => setCurrentStep('connect')}
                    className={isDark ? "border-slate-700" : "border-slate-200"}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Go Back
                  </Button>
                </div>
              ) : analysisResult ? (
                <div className="space-y-6">
                  {/* Success Banner */}
                  <div className={cn(
                    "rounded-xl p-4 flex items-center gap-4",
                    isDark
                      ? "bg-green-500/10 border border-green-500/30"
                      : "bg-green-50 border border-green-200"
                  )}>
                    <CheckCircle2 className={cn(
                      "w-8 h-8 flex-shrink-0",
                      isDark ? "text-green-400" : "text-green-600"
                    )} />
                    <div>
                      <p className={cn(
                        "font-semibold",
                        isDark ? "text-green-400" : "text-green-700"
                      )}>
                        Analysis Complete!
                      </p>
                      <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                        Found {analysisResult.testMethodsFound} test methods in {analysisResult.durationSeconds.toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  
                  {/* Framework Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className={cn(
                      "rounded-xl p-4 border",
                      isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    )}>
                      <p className={isDark ? "text-slate-400" : "text-slate-500"}>Framework Detected</p>
                      <p className={cn(
                        "text-lg font-semibold",
                        isDark ? "text-white" : "text-slate-900"
                      )}>
                        {analysisResult.frameworkName}
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {analysisResult.patternsUsed.map(pattern => (
                          <Badge 
                            key={pattern} 
                            variant="outline" 
                            className={cn(
                              "text-xs",
                              isDark 
                                ? "border-amber-500/30 text-amber-300"
                                : "border-amber-300 text-amber-700"
                            )}
                          >
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    
                    <div className={cn(
                      "rounded-xl p-4 border",
                      isDark
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    )}>
                      <p className={isDark ? "text-slate-400" : "text-slate-500"}>Language</p>
                      <p className={cn(
                        "text-lg font-semibold capitalize",
                        isDark ? "text-white" : "text-slate-900"
                      )}>
                        {analysisResult.language}
                      </p>
                      {analysisResult.domain && (
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "mt-2 text-xs",
                            isDark
                              ? "border-purple-500/30 text-purple-300"
                              : "border-purple-300 text-purple-700"
                          )}
                        >
                          Domain: {analysisResult.domain}
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Statistics */}
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Test Methods', value: analysisResult.testMethodsFound, icon: TestTube, color: isDark ? 'text-amber-400' : 'text-amber-600' },
                      { label: 'Test Files', value: analysisResult.testFilesFound, icon: FileCode, color: isDark ? 'text-blue-400' : 'text-blue-600' },
                      { label: 'Page Objects', value: analysisResult.pageObjectsFound, icon: Layers, color: isDark ? 'text-purple-400' : 'text-purple-600' },
                      { label: 'Assertions', value: analysisResult.assertionsFound, icon: Target, color: isDark ? 'text-green-400' : 'text-green-600' },
                    ].map(stat => (
                      <div 
                        key={stat.label} 
                        className={cn(
                          "rounded-lg p-4 text-center",
                          isDark ? "bg-slate-800/30" : "bg-slate-100/50"
                        )}
                      >
                        <stat.icon className={`w-6 h-6 mx-auto mb-2 ${stat.color}`} />
                        <p className={cn(
                          "text-2xl font-bold",
                          isDark ? "text-white" : "text-slate-900"
                        )}>
                          {stat.value}
                        </p>
                        <p className={cn(
                          "text-xs",
                          isDark ? "text-slate-400" : "text-slate-500"
                        )}>
                          {stat.label}
                        </p>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    onClick={() => setCurrentStep('preview')}
                    className={cn(
                      "w-full font-semibold",
                      isDark
                        ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                        : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                    )}
                  >
                    View Test Cases
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
        
        {/* Preview Step */}
        {currentStep === 'preview' && (
          <div className="space-y-6">
            {/* Filters */}
            <Card className={cn(
              isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
            )}>
              <CardContent className="py-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <Search className={cn(
                      "w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2",
                      isDark ? "text-slate-400" : "text-slate-400"
                    )} />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search test cases..."
                      className={cn(
                        "pl-10",
                        isDark
                          ? "bg-slate-800/50 border-slate-700 text-white"
                          : "bg-white border-slate-200 text-slate-900"
                      )}
                    />
                  </div>
                  
                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className={cn(
                      "w-40",
                      isDark
                        ? "bg-slate-800/50 border-slate-700 text-white"
                        : "bg-white border-slate-200 text-slate-900"
                    )}>
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priorities</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <Select value={filterTag} onValueChange={setFilterTag}>
                    <SelectTrigger className={cn(
                      "w-40",
                      isDark
                        ? "bg-slate-800/50 border-slate-700 text-white"
                        : "bg-white border-slate-200 text-slate-900"
                    )}>
                      <SelectValue placeholder="Tags" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Tags</SelectItem>
                      {availableTags.map(tag => (
                        <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            
            {/* Selection Summary */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={selectedTestIds.size === filteredTestCases.length && filteredTestCases.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <span className={cn(
                  "text-sm",
                  isDark ? "text-slate-300" : "text-slate-600"
                )}>
                  {selectedTestIds.size} of {filteredTestCases.length} selected
                </span>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep('analyze')}
                  className={isDark ? "border-slate-700" : "border-slate-200"}
                >
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCurrentStep('import')}
                  disabled={selectedTestIds.size === 0}
                  className={cn(
                    "font-semibold",
                    isDark
                      ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                      : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                  )}
                >
                  Import {selectedTestIds.size} Test Cases
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
            
            {/* Test Cases List */}
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {filteredTestCases.map(tc => (
                  <Card
                    key={tc.id}
                    className={cn(
                      "transition-colors cursor-pointer",
                      isDark
                        ? "bg-slate-800/30 border-slate-700 hover:border-slate-600"
                        : "bg-white border-slate-200 hover:border-slate-300",
                      selectedTestIds.has(tc.id) && (isDark 
                        ? 'ring-1 ring-amber-500/50' 
                        : 'ring-1 ring-amber-400')
                    )}
                    onClick={() => toggleTestCase(tc.id)}
                  >
                    <CardContent className="py-3 px-4">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={selectedTestIds.has(tc.id)}
                          onCheckedChange={() => toggleTestCase(tc.id)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "font-medium truncate",
                              isDark ? "text-white" : "text-slate-900"
                            )}>
                              {tc.name}
                            </span>
                            <Badge className={`text-xs ${getPriorityColor(tc.priority)}`}>
                              {tc.priority}
                            </Badge>
                          </div>
                          
                          <p className={cn(
                            "text-sm truncate mb-2",
                            isDark ? "text-slate-400" : "text-slate-500"
                          )}>
                            {tc.description || `From ${tc.originalClass || tc.originalFile}`}
                          </p>
                          
                          <div className={cn(
                            "flex items-center gap-4 text-xs",
                            isDark ? "text-slate-500" : "text-slate-400"
                          )}>
                            <span className="flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {tc.stepCount} steps
                            </span>
                            <span className="flex items-center gap-1">
                              <Target className="w-3 h-3" />
                              {tc.assertionCount} assertions
                            </span>
                            {tc.tags.length > 0 && (
                              <div className="flex items-center gap-1">
                                <Tag className="w-3 h-3" />
                                {tc.tags.slice(0, 3).map(tag => (
                                  <span 
                                    key={tag} 
                                    className={cn(
                                      "px-1.5 py-0.5 rounded",
                                      isDark 
                                        ? "bg-slate-700 text-slate-300"
                                        : "bg-slate-100 text-slate-600"
                                    )}
                                  >
                                    {tag}
                                  </span>
                                ))}
                                {tc.tags.length > 3 && (
                                  <span className={isDark ? "text-slate-500" : "text-slate-400"}>
                                    +{tc.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                
                {filteredTestCases.length === 0 && (
                  <div className={cn(
                    "text-center py-12",
                    isDark ? "text-slate-400" : "text-slate-500"
                  )}>
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No test cases match your filters</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        )}
        
        {/* Import Step */}
        {currentStep === 'import' && (
          <Card className={cn(
            isDark ? "bg-slate-900/50 border-slate-800" : "bg-white border-slate-200 shadow-sm"
          )}>
            <CardHeader>
              <CardTitle className={cn(
                "flex items-center gap-2",
                isDark ? "text-amber-300" : "text-amber-700"
              )}>
                <Download className="w-5 h-5" />
                Import Test Cases
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isImporting && !importComplete ? (
                <>
                  {/* Import Configuration */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className={isDark ? "text-slate-300" : "text-slate-700"}>
                        Test Suite Name
                      </Label>
                      <Input
                        value={suiteName}
                        onChange={(e) => setSuiteName(e.target.value)}
                        placeholder="Enter a name for the test suite"
                        className={cn(
                          isDark
                            ? "bg-slate-800/50 border-slate-700 text-white"
                            : "bg-white border-slate-200 text-slate-900"
                        )}
                      />
                    </div>
                    
                    <div className={cn(
                      "rounded-xl p-4 border",
                      isDark
                        ? "bg-slate-800/30 border-slate-700"
                        : "bg-slate-50 border-slate-200"
                    )}>
                      <h4 className={cn(
                        "font-medium mb-3",
                        isDark ? "text-white" : "text-slate-900"
                      )}>
                        Import Summary
                      </h4>
                      <div className={cn(
                        "grid grid-cols-2 gap-4 text-sm",
                        isDark ? "text-slate-300" : "text-slate-600"
                      )}>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Test Cases:</span>
                          <span className={cn(
                            "ml-2 font-medium",
                            isDark ? "text-white" : "text-slate-900"
                          )}>
                            {selectedTestIds.size}
                          </span>
                        </div>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Source:</span>
                          <span className={cn(
                            "ml-2 font-medium",
                            isDark ? "text-white" : "text-slate-900"
                          )}>
                            {analysisResult?.frameworkName}
                          </span>
                        </div>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Repository:</span>
                          <span className={cn(
                            "ml-2 font-medium truncate block",
                            isDark ? "text-white" : "text-slate-900"
                          )}>
                            {analysisResult?.repositoryUrl.split('/').slice(-2).join('/')}
                          </span>
                        </div>
                        <div>
                          <span className={isDark ? "text-slate-400" : "text-slate-500"}>Branch:</span>
                          <span className={cn(
                            "ml-2 font-medium",
                            isDark ? "text-white" : "text-slate-900"
                          )}>
                            {analysisResult?.branch}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-2 p-3 rounded-lg border",
                      isDark
                        ? "bg-amber-500/10 border-amber-500/30"
                        : "bg-amber-50 border-amber-200"
                    )}>
                      <Zap className={cn(
                        "w-5 h-5 flex-shrink-0",
                        isDark ? "text-amber-400" : "text-amber-600"
                      )} />
                      <p className={cn(
                        "text-sm",
                        isDark ? "text-amber-300" : "text-amber-700"
                      )}>
                        Imported test cases will be <strong>fully executable</strong> in the Test Builder, 
                        just like tests you create manually!
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentStep('preview')}
                      className={isDark ? "border-slate-700" : "border-slate-200"}
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Back
                    </Button>
                    <Button
                      onClick={importTestCases}
                      className={cn(
                        "flex-1 font-semibold",
                        isDark
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      )}
                    >
                      <Wand2 className="w-4 h-4 mr-2" />
                      Import {selectedTestIds.size} Test Cases
                    </Button>
                  </div>
                </>
              ) : isImporting ? (
                <div className="space-y-6 py-8">
                  <div className="flex justify-center">
                    <Loader2 className={cn(
                      "w-16 h-16 animate-spin",
                      isDark ? "text-amber-400" : "text-amber-500"
                    )} />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className={cn(
                      "text-lg",
                      isDark ? "text-white" : "text-slate-900"
                    )}>
                      Importing test cases...
                    </p>
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      {importJob?.currentItem || 'Processing...'}
                    </p>
                  </div>
                  
                  <div className="max-w-md mx-auto">
                    <Progress value={importJob?.progressPercent || 0} className="h-2" />
                    <div className={cn(
                      "flex justify-between text-sm mt-2",
                      isDark ? "text-slate-400" : "text-slate-500"
                    )}>
                      <span>{importJob?.importedCount || 0} / {importJob?.totalTestCases || 0}</span>
                      <span>{Math.round(importJob?.progressPercent || 0)}%</span>
                    </div>
                  </div>
                </div>
              ) : importComplete ? (
                <div className="space-y-6 py-8">
                  <div className="flex justify-center">
                    <div className="relative">
                      <CheckCircle2 className={cn(
                        "w-20 h-20",
                        isDark ? "text-green-400" : "text-green-500"
                      )} />
                      <Sparkles className={cn(
                        "w-8 h-8 absolute -top-2 -right-2",
                        isDark ? "text-amber-300" : "text-amber-500"
                      )} />
                    </div>
                  </div>
                  
                  <div className="text-center space-y-2">
                    <p className={cn(
                      "text-2xl font-bold",
                      isDark ? "text-white" : "text-slate-900"
                    )}>
                      Import Complete!
                    </p>
                    <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                      Successfully imported {importJob?.importedCount || 0} test cases
                    </p>
                  </div>
                  
                  {importJob?.failedCount && importJob.failedCount > 0 && (
                    <div className={cn(
                      "rounded-lg p-4 border",
                      isDark
                        ? "bg-yellow-500/10 border-yellow-500/30"
                        : "bg-yellow-50 border-yellow-200"
                    )}>
                      <div className={cn(
                        "flex items-center gap-2 mb-2",
                        isDark ? "text-yellow-400" : "text-yellow-700"
                      )}>
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">{importJob.failedCount} test cases failed to import</span>
                      </div>
                      <ul className={cn(
                        "text-sm space-y-1",
                        isDark ? "text-slate-400" : "text-slate-500"
                      )}>
                        {importJob.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>• {err.name}: {err.error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div className="flex gap-3 justify-center">
                    <Button
                      variant="outline"
                      onClick={() => navigate('/test-cases')}
                      className={isDark ? "border-slate-700" : "border-slate-200"}
                    >
                      View Test Cases
                    </Button>
                    <Button
                      onClick={() => {
                        setCurrentStep('connect');
                        setAnalysisResult(null);
                        setTestCases([]);
                        setSelectedTestIds(new Set());
                        setImportJob(null);
                        setImportComplete(false);
                        setRepoUrl('');
                      }}
                      className={cn(
                        "font-semibold",
                        isDark
                          ? "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black"
                          : "bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white"
                      )}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Import Another Repository
                    </Button>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
