/**
 * Visual Testing Dashboard
 * ========================
 * 
 * Robust visual regression testing with:
 * - Multiple comparison modes (pixel, perceptual, structural)
 * - Baseline management workflow
 * - Side-by-side diff viewer
 * - Ignore regions configuration
 * - Batch comparison support
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Eye, Upload, Download, Trash2, Check, X, RefreshCw, 
  Image as ImageIcon, Settings, Layers, GitCompare, 
  AlertCircle, CheckCircle, Clock, Maximize2, ZoomIn,
  Plus, Search, Filter, MoreVertical, ChevronDown, 
  FileImage, Target, Box, Palette, Activity
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import axios from 'axios';

const API_BASE = 'http://localhost:8000/api/visual-testing';

// Types
interface Baseline {
  test_name: string;
  path: string;
  file_size: number;
  modified_at: string;
  dimensions?: [number, number];
  perceptual_hash_ahash?: string;
  created_at?: string;
}

interface IgnoreRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  reason: string;
}

interface ComparisonResult {
  passed: boolean;
  diff_percentage: number;
  diff_pixel_count: number;
  total_pixels: number;
  mode: string;
  threshold: number;
  baseline_path: string;
  actual_path: string;
  diff_path?: string;
  diff_image_base64?: string;
  execution_time_ms: number;
  ssim_score?: number;
  perceptual_hash_baseline?: string;
  perceptual_hash_actual?: string;
  error?: string;
}

interface DiffImage {
  filename: string;
  path: string;
  created_at: string;
  size: number;
}

// Comparison Modes
const COMPARISON_MODES = [
  { 
    value: 'anti_aliased', 
    label: 'Anti-Aliased (Recommended)', 
    description: 'Tolerates anti-aliasing differences between browsers',
    icon: <Palette className="w-4 h-4" />
  },
  { 
    value: 'pixel_perfect', 
    label: 'Pixel Perfect', 
    description: 'Strict pixel-by-pixel comparison',
    icon: <Target className="w-4 h-4" />
  },
  { 
    value: 'perceptual', 
    label: 'Perceptual Hash', 
    description: 'Uses perceptual hashing - tolerant of minor changes',
    icon: <Eye className="w-4 h-4" />
  },
  { 
    value: 'structural', 
    label: 'Structural (SSIM)', 
    description: 'Structural Similarity Index - measures perceived quality',
    icon: <Box className="w-4 h-4" />
  },
  { 
    value: 'layout', 
    label: 'Layout Only', 
    description: 'Focus on layout changes, ignore content',
    icon: <Layers className="w-4 h-4" />
  },
  { 
    value: 'ai_semantic', 
    label: 'AI Semantic (Claude Vision)', 
    description: 'AI-powered analysis that understands visual meaning',
    icon: <Activity className="w-4 h-4" />
  },
];

export default function VisualTestingPage() {
  // State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [diffs, setDiffs] = useState<DiffImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Compare state
  const [compareMode, setCompareMode] = useState('anti_aliased');
  const [threshold, setThreshold] = useState(0.1);
  const [baselineImage, setBaselineImage] = useState<string | null>(null);
  const [actualImage, setActualImage] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState(false);
  
  // Capture state
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureTestName, setCaptureTestName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Selected baseline for detail view
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [selectedBaselineImage, setSelectedBaselineImage] = useState<string | null>(null);
  
  // Ignore regions
  const [ignoreRegions, setIgnoreRegions] = useState<IgnoreRegion[]>([]);
  
  // Dialog states
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCompareDialog, setShowCompareDialog] = useState(false);
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);
  
  // Upload state
  const [uploadTestName, setUploadTestName] = useState('');
  const [uploadImage, setUploadImage] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Load baselines on mount
  useEffect(() => {
    loadBaselines();
    loadDiffs();
  }, []);

  const loadBaselines = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/baselines`);
      setBaselines(response.data.baselines || []);
    } catch (error) {
      console.error('Error loading baselines:', error);
      toast.error('Failed to load baselines');
    } finally {
      setLoading(false);
    }
  };

  const loadDiffs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/diffs?limit=20`);
      setDiffs(response.data.diffs || []);
    } catch (error) {
      console.error('Error loading diffs:', error);
    }
  };

  const handleFileUpload = useCallback((file: File, setter: (val: string) => void) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = (e.target?.result as string)?.split(',')[1];
      setter(base64);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCompare = async () => {
    if (!baselineImage || !actualImage) {
      toast.error('Please select both baseline and actual images');
      return;
    }

    try {
      setIsComparing(true);
      const response = await axios.post(`${API_BASE}/compare`, {
        baseline: baselineImage,
        actual: actualImage,
        mode: compareMode,
        threshold: threshold,
        ignore_regions: ignoreRegions,
        test_name: 'manual_comparison'
      });

      setComparisonResult(response.data.result);
      setShowResultDialog(true);
      loadDiffs(); // Refresh diff list
    } catch (error: any) {
      console.error('Error comparing images:', error);
      toast.error(error.response?.data?.detail || 'Comparison failed');
    } finally {
      setIsComparing(false);
    }
  };

  const handleUploadBaseline = async () => {
    if (!uploadTestName || !uploadImage) {
      toast.error('Please provide test name and image');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = (e.target?.result as string)?.split(',')[1];
        
        await axios.post(`${API_BASE}/baselines`, {
          test_name: uploadTestName,
          image: base64,
          metadata: {}
        });

        toast.success('Baseline uploaded successfully');
        setShowUploadDialog(false);
        setUploadTestName('');
        setUploadImage(null);
        setUploadPreview(null);
        loadBaselines();
      };
      reader.readAsDataURL(uploadImage);
    } catch (error: any) {
      console.error('Error uploading baseline:', error);
      toast.error(error.response?.data?.detail || 'Upload failed');
    }
  };

  const handleDeleteBaseline = async (testName: string) => {
    if (!confirm(`Delete baseline "${testName}"?`)) return;

    try {
      await axios.delete(`${API_BASE}/baselines/${testName}`);
      toast.success('Baseline deleted');
      loadBaselines();
    } catch (error) {
      console.error('Error deleting baseline:', error);
      toast.error('Failed to delete baseline');
    }
  };

  const handleViewBaseline = async (baseline: Baseline) => {
    try {
      const response = await axios.get(`${API_BASE}/baselines/${baseline.test_name}`);
      setSelectedBaseline(baseline);
      setSelectedBaselineImage(response.data.image_base64);
    } catch (error) {
      console.error('Error loading baseline:', error);
      toast.error('Failed to load baseline image');
    }
  };

  const handleCaptureScreenshot = async () => {
    if (!captureUrl || !captureTestName) {
      toast.error('Please provide URL and test name');
      return;
    }

    try {
      setIsCapturing(true);
      const response = await axios.post(`${API_BASE}/capture`, 
        new URLSearchParams({
          url: captureUrl,
          test_name: captureTestName,
          full_page: 'true',
          viewport_width: '1920',
          viewport_height: '1080',
          save_as_baseline: 'true'
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      toast.success('Screenshot captured and saved as baseline');
      setShowCaptureDialog(false);
      setCaptureUrl('');
      setCaptureTestName('');
      loadBaselines();
    } catch (error: any) {
      console.error('Error capturing screenshot:', error);
      toast.error(error.response?.data?.detail || 'Capture failed');
    } finally {
      setIsCapturing(false);
    }
  };

  const filteredBaselines = baselines.filter(b => 
    b.test_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg">
            <Eye className="w-6 h-6 " />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Visual Testing</h1>
            <p className="text-sm text-muted-foreground">Robust visual regression testing with AI</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadBaselines}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => setShowCaptureDialog(true)}
          >
            <Target className="w-4 h-4 mr-2" />
            Capture URL
          </Button>
          
          <Button 
            onClick={() => setShowUploadDialog(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload Baseline
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard">
            <Layers className="w-4 h-4 mr-2" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="compare">
            <GitCompare className="w-4 h-4 mr-2" />
            Compare
          </TabsTrigger>
          <TabsTrigger value="baselines">
            <ImageIcon className="w-4 h-4 mr-2" />
            Baselines ({baselines.length})
          </TabsTrigger>
          <TabsTrigger value="diffs">
            <Activity className="w-4 h-4 mr-2" />
            Recent Diffs
          </TabsTrigger>
        </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Baselines</p>
                      <p className="text-3xl font-bold">{baselines.length}</p>
                    </div>
                    <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-lg">
                      <ImageIcon className="w-6 h-6 text-violet-600 dark:text-violet-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Recent Diffs</p>
                      <p className="text-3xl font-bold">{diffs.length}</p>
                    </div>
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                      <GitCompare className="w-6 h-6 text-amber-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Comparison Modes</p>
                      <p className="text-3xl font-bold ">5</p>
                    </div>
                    <div className="p-3 bg-emerald-500/20 rounded-lg">
                      <Settings className="w-6 h-6 text-emerald-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Storage Used</p>
                      <p className="text-3xl font-bold ">
                        {formatFileSize(baselines.reduce((acc, b) => acc + b.file_size, 0))}
                      </p>
                    </div>
                    <div className="p-3 bg-blue-500/20 rounded-lg">
                      <Box className="w-6 h-6 text-blue-400" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-2 gap-6">
              <Card className="">
                <CardHeader>
                  <CardTitle className=" flex items-center gap-2">
                    <GitCompare className="w-5 h-5 text-violet-400" />
                    Quick Compare
                  </CardTitle>
                  <CardDescription>Compare images using any comparison mode</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <Label className="text-foreground">Comparison Mode</Label>
                      <Select value={compareMode} onValueChange={setCompareMode}>
                        <SelectTrigger className="bg-background border-border  mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-background border-border">
                          {COMPARISON_MODES.map(mode => (
                            <SelectItem key={mode.value} value={mode.value} className="">
                              <div className="flex items-center gap-2">
                                {mode.icon}
                                <span>{mode.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-foreground">Threshold: {(threshold * 100).toFixed(0)}%</Label>
                      <Slider
                        value={[threshold * 100]}
                        onValueChange={([val]) => setThreshold(val / 100)}
                        max={50}
                        step={1}
                        className="mt-2"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum allowed difference percentage
                      </p>
                    </div>
                    
                    <Button 
                      onClick={() => setShowCompareDialog(true)}
                      className="w-full bg-violet-600 hover:bg-violet-500"
                    >
                      <GitCompare className="w-4 h-4 mr-2" />
                      Start Comparison
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="">
                <CardHeader>
                  <CardTitle className=" flex items-center gap-2">
                    <Eye className="w-5 h-5 text-emerald-400" />
                    Comparison Modes
                  </CardTitle>
                  <CardDescription>Choose the right mode for your use case</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {COMPARISON_MODES.map(mode => (
                      <div 
                        key={mode.value}
                        className={`p-3 rounded-lg border cursor-pointer transition-all ${
                          compareMode === mode.value 
                            ? 'border-violet-500 bg-violet-500/10' 
                            : 'border-border hover:border-primary'
                        }`}
                        onClick={() => setCompareMode(mode.value)}
                      >
                        <div className="flex items-center gap-2 ">
                          {mode.icon}
                          <span className="font-medium">{mode.label}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{mode.description}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Baselines */}
            <Card className="">
              <CardHeader>
                <CardTitle className=" flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Recent Baselines
                </CardTitle>
              </CardHeader>
              <CardContent>
                {baselines.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No baselines yet</p>
                    <p className="text-sm mt-1">Upload images or capture screenshots to create baselines</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {baselines.slice(0, 8).map(baseline => (
                      <div 
                        key={baseline.test_name}
                        className="group relative bg-card rounded-lg border border-border/50 overflow-hidden cursor-pointer hover:border-violet-500/50 transition-all"
                        onClick={() => handleViewBaseline(baseline)}
                      >
                        <div className="aspect-video bg-muted flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="p-3">
                          <p className="text-sm font-medium  truncate">{baseline.test_name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(baseline.file_size)}</p>
                        </div>
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button size="sm" variant="secondary">
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Compare Tab */}
          <TabsContent value="compare" className="space-y-6">
            <Card className="">
              <CardHeader>
                <CardTitle className="">Image Comparison</CardTitle>
                <CardDescription>
                  Upload or select baseline and actual images to compare
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  {/* Baseline Image */}
                  <div className="space-y-4">
                    <Label className=" text-lg">Baseline Image</Label>
                    <div 
                      className={`aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                        baselineImage ? 'border-emerald-500 bg-emerald-500/10' : 'border-border hover:border-primary'
                      }`}
                      onClick={() => document.getElementById('baseline-input')?.click()}
                    >
                      {baselineImage ? (
                        <img 
                          src={`data:image/png;base64,${baselineImage}`} 
                          alt="Baseline" 
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Upload className="w-8 h-8 mx-auto mb-2" />
                          <p>Click to upload baseline</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="baseline-input"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, setBaselineImage);
                      }}
                    />
                    {baselineImage && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setBaselineImage(null)}
                        className="border-border text-foreground"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>

                  {/* Actual Image */}
                  <div className="space-y-4">
                    <Label className=" text-lg">Actual Image</Label>
                    <div 
                      className={`aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all ${
                        actualImage ? 'border-blue-500 bg-blue-500/10' : 'border-border hover:border-primary'
                      }`}
                      onClick={() => document.getElementById('actual-input')?.click()}
                    >
                      {actualImage ? (
                        <img 
                          src={`data:image/png;base64,${actualImage}`} 
                          alt="Actual" 
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <div className="text-center text-muted-foreground">
                          <Upload className="w-8 h-8 mx-auto mb-2" />
                          <p>Click to upload actual</p>
                        </div>
                      )}
                    </div>
                    <input 
                      id="actual-input"
                      type="file" 
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file, setActualImage);
                      }}
                    />
                    {actualImage && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setActualImage(null)}
                        className="border-border text-foreground"
                      >
                        <X className="w-4 h-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Comparison Settings */}
                <Separator className="my-6 bg-slate-700" />
                
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <Label className="text-foreground">Comparison Mode</Label>
                    <Select value={compareMode} onValueChange={setCompareMode}>
                      <SelectTrigger className="bg-background border-border  mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border-border">
                        {COMPARISON_MODES.map(mode => (
                          <SelectItem key={mode.value} value={mode.value} className="">
                            <div className="flex items-center gap-2">
                              {mode.icon}
                              <span>{mode.label}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="text-foreground">Threshold: {(threshold * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[threshold * 100]}
                      onValueChange={([val]) => setThreshold(val / 100)}
                      max={50}
                      step={1}
                      className="mt-4"
                    />
                  </div>
                  
                  <div className="flex items-end">
                    <Button 
                      onClick={handleCompare}
                      disabled={!baselineImage || !actualImage || isComparing}
                      className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500"
                    >
                      {isComparing ? (
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <GitCompare className="w-4 h-4 mr-2" />
                      )}
                      {isComparing ? 'Comparing...' : 'Compare Images'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Comparison Result */}
            {comparisonResult && (
              <Card className={`border-2 ${
                comparisonResult.passed 
                  ? 'bg-emerald-500/10 border-emerald-500/50' 
                  : 'bg-red-500/10 border-red-500/50'
              }`}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {comparisonResult.passed ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-emerald-400" />
                        <span className="text-emerald-400">Comparison Passed</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-6 h-6 text-red-400" />
                        <span className="text-red-400">Comparison Failed</span>
                      </>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Difference</p>
                      <p className="text-2xl font-bold ">
                        {(comparisonResult.diff_percentage * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Threshold</p>
                      <p className="text-2xl font-bold ">
                        {(comparisonResult.threshold * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Mode</p>
                      <p className="text-lg font-medium  capitalize">
                        {comparisonResult.mode.replace('_', ' ')}
                      </p>
                    </div>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Time</p>
                      <p className="text-2xl font-bold ">
                        {comparisonResult.execution_time_ms}ms
                      </p>
                    </div>
                  </div>

                  {comparisonResult.diff_image_base64 && (
                    <div className="mt-4">
                      <Label className=" mb-2 block">Diff Image (Baseline | Diff | Actual)</Label>
                      <div className="bg-slate-900 rounded-lg p-4 overflow-auto">
                        <img 
                          src={`data:image/png;base64,${comparisonResult.diff_image_base64}`}
                          alt="Diff"
                          className="max-w-full"
                        />
                      </div>
                    </div>
                  )}

                  {comparisonResult.ssim_score !== undefined && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">SSIM Score</p>
                      <p className="text-2xl font-bold ">
                        {(comparisonResult.ssim_score * 100).toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground">Higher is more similar (100% = identical)</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Baselines Tab */}
          <TabsContent value="baselines" className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search baselines..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-muted border-border "
                />
              </div>
              <Button 
                variant="outline" 
                className="border-border text-foreground"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>

            {filteredBaselines.length === 0 ? (
              <Card className="">
                <CardContent className="py-12 text-center text-muted-foreground">
                  <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg">No baselines found</p>
                  <p className="text-sm mt-2">Upload images or capture screenshots to create baselines</p>
                  <Button 
                    className="mt-4"
                    onClick={() => setShowUploadDialog(true)}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload First Baseline
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {filteredBaselines.map(baseline => (
                  <Card 
                    key={baseline.test_name}
                    className=" hover:border-violet-500/50 transition-all cursor-pointer group"
                    onClick={() => handleViewBaseline(baseline)}
                  >
                    <div className="aspect-video bg-slate-900 relative overflow-hidden">
                      <div className="absolute inset-0 flex items-center justify-center">
                        <ImageIcon className="w-12 h-12 text-slate-700" />
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <Button size="sm" variant="secondary">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteBaseline(baseline.test_name);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium  truncate">{baseline.test_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatFileSize(baseline.file_size)} • {formatDate(baseline.modified_at)}
                          </p>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent className="bg-background border-border">
                            <DropdownMenuItem 
                              className=""
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewBaseline(baseline);
                              }}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem className="">
                              <Download className="w-4 h-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-700" />
                            <DropdownMenuItem 
                              className="text-red-400"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteBaseline(baseline.test_name);
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Diffs Tab */}
          <TabsContent value="diffs" className="space-y-6">
            <Card className="">
              <CardHeader>
                <CardTitle className="">Recent Diff Images</CardTitle>
                <CardDescription>Visual diffs from recent comparisons</CardDescription>
              </CardHeader>
              <CardContent>
                {diffs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No diff images yet</p>
                    <p className="text-sm mt-1">Run comparisons to generate diff images</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {diffs.map(diff => (
                      <div 
                        key={diff.filename}
                        className="flex items-center justify-between p-4 bg-card rounded-lg border border-border/50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 bg-muted rounded flex items-center justify-center">
                            <FileImage className="w-6 h-6 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium ">{diff.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(diff.size)} • {formatDate(diff.created_at)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-border text-foreground"
                            onClick={() => window.open(`${API_BASE}/diffs/${diff.filename}`, '_blank')}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="border-border text-foreground"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      {/* Upload Baseline Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="bg-background border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="">Upload Baseline</DialogTitle>
            <DialogDescription>
              Upload an image to use as a baseline for visual regression testing
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-foreground">Test Name</Label>
              <Input 
                value={uploadTestName}
                onChange={(e) => setUploadTestName(e.target.value)}
                placeholder="e.g., homepage_hero_section"
                className="bg-muted border-border  mt-2"
              />
            </div>
            
            <div>
              <Label className="text-foreground">Image</Label>
              <div 
                className="mt-2 aspect-video border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary"
                onClick={() => document.getElementById('upload-input')?.click()}
              >
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="max-h-full max-w-full object-contain" />
                ) : (
                  <div className="text-center text-muted-foreground">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <p>Click to select image</p>
                  </div>
                )}
              </div>
              <input 
                id="upload-input"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setUploadImage(file);
                    const reader = new FileReader();
                    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
                    reader.readAsDataURL(file);
                  }
                }}
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowUploadDialog(false)}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleUploadBaseline}
              disabled={!uploadTestName || !uploadImage}
              className="bg-emerald-600 hover:bg-emerald-500"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Baseline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Screenshot Dialog */}
      <Dialog open={showCaptureDialog} onOpenChange={setShowCaptureDialog}>
        <DialogContent className="bg-background border-border max-w-lg">
          <DialogHeader>
            <DialogTitle className="">Capture Screenshot</DialogTitle>
            <DialogDescription>
              Capture a screenshot from a URL and save it as a baseline
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label className="text-foreground">URL</Label>
              <Input 
                value={captureUrl}
                onChange={(e) => setCaptureUrl(e.target.value)}
                placeholder="https://example.com"
                className="bg-muted border-border  mt-2"
              />
            </div>
            
            <div>
              <Label className="text-foreground">Test Name</Label>
              <Input 
                value={captureTestName}
                onChange={(e) => setCaptureTestName(e.target.value)}
                placeholder="e.g., example_homepage"
                className="bg-muted border-border  mt-2"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowCaptureDialog(false)}
              className="border-border text-foreground"
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCaptureScreenshot}
              disabled={!captureUrl || !captureTestName || isCapturing}
              className="bg-violet-600 hover:bg-violet-500"
            >
              {isCapturing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Target className="w-4 h-4 mr-2" />
              )}
              {isCapturing ? 'Capturing...' : 'Capture & Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baseline Detail Dialog */}
      <Dialog open={!!selectedBaseline} onOpenChange={() => {
        setSelectedBaseline(null);
        setSelectedBaselineImage(null);
      }}>
        <DialogContent className="bg-background border-border max-w-4xl">
          <DialogHeader>
            <DialogTitle className="">{selectedBaseline?.test_name}</DialogTitle>
            <DialogDescription>
              Baseline image details
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {selectedBaselineImage && (
              <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[60vh]">
                <img 
                  src={`data:image/png;base64,${selectedBaselineImage}`}
                  alt={selectedBaseline?.test_name}
                  className="max-w-full"
                />
              </div>
            )}
            
            {selectedBaseline && (
              <div className="grid grid-cols-3 gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">File Size</p>
                  <p className=" font-medium">{formatFileSize(selectedBaseline.file_size)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Modified</p>
                  <p className=" font-medium">{formatDate(selectedBaseline.modified_at)}</p>
                </div>
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-xs text-muted-foreground">Path</p>
                  <p className=" font-medium text-xs truncate">{selectedBaseline.path}</p>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => handleDeleteBaseline(selectedBaseline?.test_name || '')}
              className="border-red-700 text-red-400 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
            <Button 
              variant="outline"
              className="border-border text-foreground"
              onClick={() => {
                if (selectedBaselineImage) {
                  setBaselineImage(selectedBaselineImage);
                  setActiveTab('compare');
                  setSelectedBaseline(null);
                  setSelectedBaselineImage(null);
                }
              }}
            >
              <GitCompare className="w-4 h-4 mr-2" />
              Use for Comparison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

