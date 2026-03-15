/**
 * Visual Testing Dashboard — Applitools-class visual regression testing
 * =====================================================================
 *
 * Features (v3.12.25+):
 * - 6 comparison modes (pixel, anti-aliased, perceptual, structural, layout, AI semantic)
 * - 3 diff viewer modes: side-by-side, slider overlay, onion-skin blend
 * - Ignore regions with visual drawing UI
 * - Floating regions (allow element drift within pixel bounds)
 * - Match-level regions (apply different modes to different areas)
 * - Responsive viewport matrix (compare across mobile/tablet/desktop)
 * - Approval workflow with inline accept/reject + auto-baseline promotion
 * - Batch URL testing with progress
 * - Comparison history with pass/fail trend chart
 * - Dynamic content detection toggle
 * - Contrast accessibility check (WCAG contrast advisor)
 * - Baseline versioning with branch support
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Eye, Upload, Download, Trash2, Check, X, RefreshCw,
  Image as ImageIcon, Settings, Layers, GitCompare,
  AlertCircle, CheckCircle, Clock,
  Plus, Search, MoreVertical,
  FileImage, Target, Box, Palette, Activity,
  SlidersHorizontal, Blend, Columns,
  Smartphone, Tablet, Monitor, Tv, Grid3X3,
  MousePointer, LayoutGrid, Crosshair,
  TrendingUp, BarChart3, Percent, Timer, Loader2
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
import { toast } from 'sonner';
import axios from 'axios';
import { API_BASE_URL } from '@/lib/api-config';

const API_BASE = `${API_BASE_URL}/api/visual-testing`;

// ─── Types ──────────────────────────────────────────────────────────────────
interface Baseline {
  test_name: string;
  path: string;
  file_size: number;
  modified_at: string;
  dimensions?: [number, number];
  perceptual_hash_ahash?: string;
  created_at?: string;
  branch?: string;
  version?: number;
}

interface IgnoreRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  reason: string;
  type: 'ignore' | 'floating' | 'strict' | 'layout' | 'content';
  floatOffset?: number; // pixels allowed to drift for floating regions
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
  mismatch_regions?: { x: number; y: number; width: number; height: number }[];
  error?: string;
}

interface DiffImage {
  filename: string;
  path: string;
  created_at: string;
  size: number;
}

interface ViewportPreset {
  name: string;
  width: number;
  height: number;
  icon: React.ReactNode;
  checked: boolean;
}

type DiffViewMode = 'side-by-side' | 'slider' | 'onion-skin';

// ─── Sample Data ────────────────────────────────────────────────────────────
const SAMPLE_BASELINES: Baseline[] = [
  { test_name: 'login_page_hero', path: '/baselines/login_page_hero.png', file_size: 145000, modified_at: new Date(Date.now() - 86400000 * 2).toISOString(), dimensions: [1920, 1080], created_at: new Date(Date.now() - 86400000 * 5).toISOString(), version: 3 },
  { test_name: 'dashboard_overview', path: '/baselines/dashboard_overview.png', file_size: 234000, modified_at: new Date(Date.now() - 86400000).toISOString(), dimensions: [1920, 1080], created_at: new Date(Date.now() - 86400000 * 3).toISOString(), version: 5 },
  { test_name: 'checkout_form', path: '/baselines/checkout_form.png', file_size: 189000, modified_at: new Date(Date.now() - 3600000 * 5).toISOString(), dimensions: [1920, 1080], created_at: new Date(Date.now() - 86400000 * 2).toISOString(), version: 2 },
  { test_name: 'product_catalog_grid', path: '/baselines/product_catalog_grid.png', file_size: 312000, modified_at: new Date(Date.now() - 3600000 * 12).toISOString(), dimensions: [1920, 1080], created_at: new Date(Date.now() - 86400000).toISOString(), version: 1 },
  { test_name: 'user_profile_settings', path: '/baselines/user_profile_settings.png', file_size: 167000, modified_at: new Date().toISOString(), dimensions: [1920, 1080], created_at: new Date(Date.now() - 3600000 * 8).toISOString(), version: 4 },
  { test_name: 'mobile_navigation_menu', path: '/baselines/mobile_navigation_menu.png', file_size: 98000, modified_at: new Date(Date.now() - 3600000 * 2).toISOString(), dimensions: [375, 812], created_at: new Date(Date.now() - 86400000 * 4).toISOString(), version: 1 },
];

const SAMPLE_IMAGE_PLACEHOLDER = `PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjQ1MCIgdmlld0JveD0iMCAwIDgwMCA0NTAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI4MDAiIGhlaWdodD0iNDUwIiBmaWxsPSIjMWUyOTNiIi8+CjxyZWN0IHg9IjUwIiB5PSI1MCIgd2lkdGg9IjcwMCIgaGVpZ2h0PSIxMDAiIHJ4PSI4IiBmaWxsPSIjMzM0MTU1Ii8+CjxyZWN0IHg9IjcwIiB5PSI3NSIgd2lkdGg9IjEyMCIgaGVpZ2h0PSI1MCIgcng9IjQiIGZpbGw9IiM2MzY2ZjEiLz4KPHJlY3QgeD0iMjEwIiB5PSI4NSIgd2lkdGg9IjgwIiBoZWlnaHQ9IjMwIiByeD0iNCIgZmlsbD0iIzQ3NTU2OSIvPgo8cmVjdCB4PSIzMTAiIHk9Ijg1IiB3aWR0aD0iODAiIGhlaWdodD0iMzAiIHJ4PSI0IiBmaWxsPSIjNDc1NTY5Ii8+CjxyZWN0IHg9IjQxMCIgeT0iODUiIHdpZHRoPSI4MCIgaGVpZ2h0PSIzMCIgcng9IjQiIGZpbGw9IiM0NzU1NjkiLz4KPHJlY3QgeD0iNjMwIiB5PSI3NSIgd2lkdGg9IjEwMCIgaGVpZ2h0PSI1MCIgcng9IjI1IiBmaWxsPSIjMTBiOTgxIi8+CjxyZWN0IHg9IjUwIiB5PSIxODAiIHdpZHRoPSIzNDAiIGhlaWdodD0iMjIwIiByeD0iOCIgZmlsbD0iIzMzNDE1NSIvPgo8cmVjdCB4PSI0MTAiIHk9IjE4MCIgd2lkdGg9IjM0MCIgaGVpZ2h0PSIyMjAiIHJ4PSI4IiBmaWxsPSIjMzM0MTU1Ii8+CjxyZWN0IHg9IjcwIiB5PSIyMDAiIHdpZHRoPSIzMDAiIGhlaWdodD0iMTIwIiByeD0iNCIgZmlsbD0iIzQ3NTU2OSIvPgo8cmVjdCB4PSI0MzAiIHk9IjIwMCIgd2lkdGg9IjMwMCIgaGVpZ2h0PSIxMjAiIHJ4PSI0IiBmaWxsPSIjNDc1NTY5Ii8+CjxyZWN0IHg9IjcwIiB5PSIzNDAiIHdpZHRoPSIxNDAiIGhlaWdodD0iNDAiIHJ4PSI0IiBmaWxsPSIjNjM2NmYxIi8+CjxyZWN0IHg9IjQzMCIgeT0iMzQwIiB3aWR0aD0iMTQwIiBoZWlnaHQ9IjQwIiByeD0iNCIgZmlsbD0iIzYzNjZmMSIvPgo8dGV4dCB4PSI0MDAiIHk9IjQzNSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1mYW1pbHk9InN5c3RlbS11aSIgZm9udC1zaXplPSIxMiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+U2FtcGxlIEJhc2VsaW5lIEltYWdlPC90ZXh0Pgo8L3N2Zz4=`;

// ─── Constants ──────────────────────────────────────────────────────────────
const COMPARISON_MODES = [
  { value: 'anti_aliased', label: 'Anti-Aliased (Recommended)', description: 'Tolerates anti-aliasing differences between browsers', icon: <Palette className="w-4 h-4" /> },
  { value: 'pixel_perfect', label: 'Pixel Perfect', description: 'Strict pixel-by-pixel comparison', icon: <Target className="w-4 h-4" /> },
  { value: 'perceptual', label: 'Perceptual Hash', description: 'Uses perceptual hashing — tolerant of minor changes', icon: <Eye className="w-4 h-4" /> },
  { value: 'structural', label: 'Structural (SSIM)', description: 'Structural Similarity Index — measures perceived quality', icon: <Box className="w-4 h-4" /> },
  { value: 'layout', label: 'Layout Only', description: 'Focus on layout/position, ignore text & images', icon: <Layers className="w-4 h-4" /> },
  { value: 'ai_semantic', label: 'AI Semantic (Claude Vision)', description: 'AI-powered semantic understanding of visual meaning', icon: <Activity className="w-4 h-4" /> },
  { value: 'ignore_colors', label: 'Ignore Colors', description: 'Like Strict but ignores color differences (theme testing)', icon: <Blend className="w-4 h-4" /> },
  { value: 'dynamic', label: 'Dynamic Content', description: 'Auto-suppress diffs from dates, timestamps, counters', icon: <Clock className="w-4 h-4" /> },
];

const REGION_TYPES = [
  { value: 'ignore', label: 'Ignore Region', description: 'Skip comparison in this area', color: 'bg-gray-500/40 border-gray-400' },
  { value: 'floating', label: 'Floating Region', description: 'Allow element to move within bounds', color: 'bg-blue-500/40 border-blue-400' },
  { value: 'strict', label: 'Strict Region', description: 'Apply Strict matching to this area', color: 'bg-red-500/40 border-red-400' },
  { value: 'layout', label: 'Layout Region', description: 'Apply Layout matching to this area', color: 'bg-amber-500/40 border-amber-400' },
  { value: 'content', label: 'Content Region', description: 'Apply Content matching (ignore colors)', color: 'bg-purple-500/40 border-purple-400' },
];

// ─── Component ──────────────────────────────────────────────────────────────
export default function VisualTestingPage() {
  // Core state
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
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>('side-by-side');
  const [sliderPosition, setSliderPosition] = useState(50);
  const [onionOpacity, setOnionOpacity] = useState(50);
  const [dynamicContentDetection, setDynamicContentDetection] = useState(false);

  // Regions state
  const [ignoreRegions, setIgnoreRegions] = useState<IgnoreRegion[]>([]);
  const [isDrawingRegion, setIsDrawingRegion] = useState(false);
  const [drawingRegionType, setDrawingRegionType] = useState<IgnoreRegion['type']>('ignore');
  const [drawStart, setDrawStart] = useState<{x: number; y: number} | null>(null);
  const [currentDraw, setCurrentDraw] = useState<{x: number; y: number; w: number; h: number} | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Capture state
  const [captureUrl, setCaptureUrl] = useState('');
  const [captureTestName, setCaptureTestName] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);

  // Viewport matrix
  const [viewportPresets, setViewportPresets] = useState<ViewportPreset[]>([
    { name: 'Mobile', width: 375, height: 812, icon: <Smartphone className="w-4 h-4" />, checked: false },
    { name: 'Tablet', width: 768, height: 1024, icon: <Tablet className="w-4 h-4" />, checked: false },
    { name: 'Laptop', width: 1366, height: 768, icon: <Monitor className="w-4 h-4" />, checked: false },
    { name: 'Desktop', width: 1920, height: 1080, icon: <Tv className="w-4 h-4" />, checked: true },
  ]);

  // Viewport matrix comparison results
  const [viewportResults, setViewportResults] = useState<{viewport: string; width: number; height: number; result?: ComparisonResult; status: 'pending' | 'running' | 'done' | 'error'}[]>([]);
  const [isMatrixTesting, setIsMatrixTesting] = useState(false);

  // Selected baseline for detail view
  const [selectedBaseline, setSelectedBaseline] = useState<Baseline | null>(null);
  const [selectedBaselineImage, setSelectedBaselineImage] = useState<string | null>(null);

  // Dialog states
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showCaptureDialog, setShowCaptureDialog] = useState(false);

  // Upload state
  const [uploadTestName, setUploadTestName] = useState('');
  const [uploadImage, setUploadImage] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);

  // Approval workflow (localStorage backed)
  const [approvedDiffs, setApprovedDiffs] = useState<Record<string, 'accepted' | 'rejected'>>(() => {
    try { return JSON.parse(localStorage.getItem('flowstral-visual-approvals') || '{}'); } catch { return {}; }
  });

  // Batch URL testing
  const [batchTestUrls, setBatchTestUrls] = useState('');
  const [batchTestResults, setBatchTestResults] = useState<{url: string; status: string; diffPct?: number; testName?: string}[]>([]);
  const [isBatchTesting, setIsBatchTesting] = useState(false);

  // Comparison history (localStorage backed)
  const [comparisonHistory, setComparisonHistory] = useState<{testName: string; passed: boolean; diffPct: number; mode: string; timestamp: string}[]>(() => {
    try { return JSON.parse(localStorage.getItem('flowstral-visual-history') || '[]'); } catch { return []; }
  });

  // Diff review filter
  const [diffFilter, setDiffFilter] = useState<'all' | 'unreviewed' | 'accepted' | 'rejected'>('all');

  // Persist states
  useEffect(() => { try { localStorage.setItem('flowstral-visual-approvals', JSON.stringify(approvedDiffs)); } catch {} }, [approvedDiffs]);
  useEffect(() => { try { localStorage.setItem('flowstral-visual-history', JSON.stringify(comparisonHistory.slice(0, 100))); } catch {} }, [comparisonHistory]);

  // Load on mount
  useEffect(() => { loadBaselines(); loadDiffs(); }, []);

  // Cleanup upload preview data URL on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      if (uploadPreview && uploadPreview.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreview);
      }
    };
  }, [uploadPreview]);

  // ─── API Calls ──────────────────────────────────────────────────────────
  const loadBaselines = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE}/baselines`);
      const apiBaselines = response.data.baselines || [];
      setBaselines(apiBaselines.length > 0 ? apiBaselines : SAMPLE_BASELINES);
    } catch {
      setBaselines(SAMPLE_BASELINES);
      toast.info('Showing sample baselines (backend not connected)');
    } finally { setLoading(false); }
  };

  const loadDiffs = async () => {
    try {
      const response = await axios.get(`${API_BASE}/diffs?limit=50`);
      setDiffs(response.data.diffs || []);
    } catch (error) {
      // Backend may not be connected; leave diffs empty but don't silently swallow
      if (axios.isAxiosError(error) && !error.response) {
        // Network error — backend not connected, expected during local dev
      } else {
        toast.error('Failed to load diff images');
      }
    }
  };

  // Constants for file validation
  const MAX_UPLOAD_SIZE = 50 * 1024 * 1024; // 50MB matches backend MAX_IMAGE_SIZE
  const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/bmp', 'image/gif'];

  const handleFileUpload = useCallback((file: File, setter: (val: string) => void) => {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(`Invalid file type: ${file.type || 'unknown'}. Allowed: PNG, JPEG, WebP, BMP, GIF`);
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error(`File too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string | undefined;
      if (result) {
        const base64Part = result.split(',')[1];
        if (base64Part) {
          setter(base64Part);
        } else {
          toast.error('Failed to process image file');
        }
      }
    };
    reader.onerror = () => {
      toast.error('Failed to read file');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleCompare = async () => {
    if (!baselineImage || !actualImage) { toast.error('Select both images'); return; }
    try {
      setIsComparing(true);
      const response = await axios.post(`${API_BASE}/compare`, {
        baseline: baselineImage,
        actual: actualImage,
        mode: dynamicContentDetection ? 'dynamic' : compareMode,
        threshold,
        ignore_regions: ignoreRegions.map(r => ({ x: r.x, y: r.y, width: r.width, height: r.height, name: r.name, reason: r.reason })),
        test_name: 'manual_comparison'
      });
      setComparisonResult(response.data.result);
      loadDiffs();
      setComparisonHistory(prev => [{ testName: 'manual_comparison', passed: response.data.result?.passed ?? false, diffPct: response.data.result?.diff_percentage ?? 0, mode: compareMode, timestamp: new Date().toISOString() }, ...prev].slice(0, 100));
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      toast.error(message || 'Comparison failed');
    } finally { setIsComparing(false); }
  };

  const handleUploadBaseline = async () => {
    if (!uploadTestName || !uploadImage) { toast.error('Provide test name and image'); return; }
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = (e.target?.result as string)?.split(',')[1];
          if (result) resolve(result); else reject(new Error('Failed to read file'));
        };
        reader.onerror = () => reject(new Error('File reading failed'));
        reader.readAsDataURL(uploadImage);
      });
      await axios.post(`${API_BASE}/baselines`, { test_name: uploadTestName, image: base64, metadata: {} });
      toast.success('Baseline uploaded');
      setShowUploadDialog(false);
      setUploadTestName(''); setUploadImage(null);
      // Revoke blob URL to prevent memory leak
      if (uploadPreview && uploadPreview.startsWith('blob:')) {
        URL.revokeObjectURL(uploadPreview);
      }
      setUploadPreview(null);
      loadBaselines();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      toast.error(message || 'Upload failed');
    }
  };

  const handleDeleteBaseline = async (testName: string) => {
    if (!testName) return;
    if (!confirm(`Delete baseline "${testName}"?`)) return;
    try {
      await axios.delete(`${API_BASE}/baselines/${encodeURIComponent(testName)}`);
      toast.success(`Baseline "${testName}" deleted`);
      loadBaselines();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      toast.error(message || 'Delete failed');
    }
  };

  const [isLoadingBaselineImage, setIsLoadingBaselineImage] = useState(false);

  const handleViewBaseline = async (baseline: Baseline) => {
    const isSample = SAMPLE_BASELINES.some(s => s.test_name === baseline.test_name);
    if (isSample) { setSelectedBaseline(baseline); setSelectedBaselineImage(SAMPLE_IMAGE_PLACEHOLDER); return; }
    setSelectedBaseline(baseline);
    setSelectedBaselineImage(null);
    setIsLoadingBaselineImage(true);
    try {
      const response = await axios.get(`${API_BASE}/baselines/${encodeURIComponent(baseline.test_name)}`);
      setSelectedBaselineImage(response.data.image_base64);
    } catch (error: unknown) {
      setSelectedBaselineImage(SAMPLE_IMAGE_PLACEHOLDER);
      if (axios.isAxiosError(error) && error.response?.status !== 404) {
        toast.error('Failed to load baseline image');
      }
    }
    finally { setIsLoadingBaselineImage(false); }
  };

  const handleCaptureScreenshot = async () => {
    if (!captureUrl || !captureTestName) { toast.error('Provide URL and test name'); return; }
    const vps = viewportPresets.filter(v => v.checked);
    if (vps.length === 0) { toast.error('Select at least one viewport'); return; }
    try {
      setIsCapturing(true);
      let count = 0;
      const errors: string[] = [];
      for (const vp of vps) {
        const name = vps.length > 1 ? `${captureTestName}_${vp.name.toLowerCase()}` : captureTestName;
        try {
          await axios.post(`${API_BASE}/capture`, new URLSearchParams({ url: captureUrl, test_name: name, full_page: 'true', viewport_width: String(vp.width), viewport_height: String(vp.height), save_as_baseline: 'true' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
          count++;
        } catch (error: unknown) {
          const detail = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
          errors.push(`${vp.name}: ${detail || 'capture failed'}`);
        }
      }
      if (count > 0) {
        toast.success(`${count} screenshot(s) captured`);
        if (errors.length > 0) {
          toast.warning(`${errors.length} viewport(s) failed: ${errors.join('; ')}`);
        }
      } else {
        toast.error(`All captures failed: ${errors[0] || 'Unknown error'}`);
      }
      setShowCaptureDialog(false); setCaptureUrl(''); setCaptureTestName(''); loadBaselines();
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
      toast.error(message || 'Capture failed');
    }
    finally { setIsCapturing(false); }
  };

  // ─── Region Drawing ───────────────────────────────────────────────────
  const handleRegionMouseDown = (e: React.MouseEvent) => {
    if (!isDrawingRegion) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDrawStart({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const handleRegionMouseMove = (e: React.MouseEvent) => {
    if (!drawStart || !isDrawingRegion) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    setCurrentDraw({ x: Math.min(drawStart.x, cx), y: Math.min(drawStart.y, cy), w: Math.abs(cx - drawStart.x), h: Math.abs(cy - drawStart.y) });
  };

  const handleRegionMouseUp = () => {
    if (!currentDraw || currentDraw.w < 5 || currentDraw.h < 5) { setDrawStart(null); setCurrentDraw(null); return; }
    const newRegion: IgnoreRegion = {
      x: Math.round(currentDraw.x), y: Math.round(currentDraw.y),
      width: Math.round(currentDraw.w), height: Math.round(currentDraw.h),
      name: `Region ${ignoreRegions.length + 1}`,
      reason: `${drawingRegionType} region`,
      type: drawingRegionType,
      floatOffset: drawingRegionType === 'floating' ? 10 : undefined,
    };
    setIgnoreRegions(prev => [...prev, newRegion]);
    setDrawStart(null); setCurrentDraw(null); setIsDrawingRegion(false);
  };

  // ─── Viewport Matrix Test ─────────────────────────────────────────────
  const runViewportMatrix = async () => {
    if (!captureUrl) { toast.error('Enter a URL for viewport matrix test'); return; }
    const vps = viewportPresets.filter(v => v.checked);
    if (vps.length < 2) { toast.error('Select at least 2 viewports'); return; }
    setIsMatrixTesting(true);
    const results = vps.map(v => ({ viewport: v.name, width: v.width, height: v.height, status: 'pending' as const }));
    setViewportResults(results);

    for (let i = 0; i < results.length; i++) {
      results[i] = { ...results[i], status: 'running' };
      setViewportResults([...results]);
      try {
        const testName = `matrix_${captureUrl.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)}_${results[i].viewport.toLowerCase()}`;
        const captureRes = await axios.post(`${API_BASE}/capture`, new URLSearchParams({ url: captureUrl, test_name: testName, full_page: 'true', viewport_width: String(results[i].width), viewport_height: String(results[i].height), save_as_baseline: 'false' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
        const actualBase64 = captureRes.data?.image_base64;
        if (actualBase64) {
          try {
            const cmp = await axios.post(`${API_BASE}/compare-by-name`, { test_name: testName, actual: actualBase64, mode: compareMode, threshold });
            results[i] = { ...results[i], status: 'done', result: cmp.data?.result || cmp.data };
          } catch (_compareErr) {
            // Comparison failed but capture succeeded — show as done without result
            results[i] = { ...results[i], status: 'done' };
          }
        } else {
          results[i] = { ...results[i], status: 'error' };
        }
      } catch (_captureErr) {
        results[i] = { ...results[i], status: 'error' };
      }
      setViewportResults([...results]);
    }
    setIsMatrixTesting(false);
    toast.success('Viewport matrix test complete');
  };

  // ─── Helpers (memoized to avoid recalculation on every render) ──────
  const filteredBaselines = useMemo(
    () => baselines.filter(b => b.test_name.toLowerCase().includes(searchQuery.toLowerCase())),
    [baselines, searchQuery]
  );
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);
  const formatDate = useCallback((dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid date';
    }
  }, []);
  const passRate = useMemo(
    () => comparisonHistory.length > 0 ? Math.round((comparisonHistory.filter(h => h.passed).length / comparisonHistory.length) * 100) : 0,
    [comparisonHistory]
  );
  const regionColorClass = useCallback(
    (type: string) => REGION_TYPES.find(r => r.value === type)?.color || 'bg-gray-500/40 border-gray-400',
    []
  );

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between" role="banner">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary rounded-lg" aria-hidden="true"><Eye className="w-6 h-6" /></div>
          <div>
            <h1 className="text-2xl font-bold">Visual Testing</h1>
            <p className="text-sm text-muted-foreground">Applitools-class visual regression with AI</p>
          </div>
        </div>
        <div className="flex items-center gap-3" role="toolbar" aria-label="Visual testing actions">
          <Button variant="outline" size="sm" onClick={() => { loadBaselines(); loadDiffs(); }} aria-label="Refresh baselines and diffs">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />Refresh
          </Button>
          <Button variant="outline" onClick={() => setShowCaptureDialog(true)} aria-label="Capture screenshot from URL">
            <Target className="w-4 h-4 mr-2" aria-hidden="true" />Capture URL
          </Button>
          <Button onClick={() => setShowUploadDialog(true)} aria-label="Upload baseline image">
            <Upload className="w-4 h-4 mr-2" aria-hidden="true" />Upload Baseline
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList>
          <TabsTrigger value="dashboard"><BarChart3 className="w-4 h-4 mr-2" />Dashboard</TabsTrigger>
          <TabsTrigger value="compare"><GitCompare className="w-4 h-4 mr-2" />Compare</TabsTrigger>
          <TabsTrigger value="baselines"><ImageIcon className="w-4 h-4 mr-2" />Baselines ({baselines.length})</TabsTrigger>
          <TabsTrigger value="regions"><Grid3X3 className="w-4 h-4 mr-2" />Regions</TabsTrigger>
          <TabsTrigger value="matrix"><LayoutGrid className="w-4 h-4 mr-2" />Viewport Matrix</TabsTrigger>
          <TabsTrigger value="diffs">
            <Activity className="w-4 h-4 mr-2" />Review Diffs
            {diffs.filter(d => !approvedDiffs[d.filename]).length > 0 && (
              <Badge variant="destructive" className="ml-2 text-[10px] px-1.5 py-0">{diffs.filter(d => !approvedDiffs[d.filename]).length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════ DASHBOARD TAB ═══════════════════ */}
        <TabsContent value="dashboard" className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-5 gap-4">
            {[
              { label: 'Baselines', value: baselines.length, icon: <ImageIcon className="w-5 h-5 text-primary" />, bg: 'bg-primary/10' },
              { label: 'Pending Review', value: diffs.filter(d => !approvedDiffs[d.filename]).length, icon: <AlertCircle className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-500/10' },
              { label: 'Pass Rate', value: `${passRate}%`, icon: <TrendingUp className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-500/10' },
              { label: 'Comparisons', value: comparisonHistory.length, icon: <GitCompare className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-500/10' },
              { label: 'Match Modes', value: COMPARISON_MODES.length, icon: <Settings className="w-5 h-5 text-purple-500" />, bg: 'bg-purple-500/10' },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-2.5 rounded-lg ${stat.bg}`}>{stat.icon}</div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Comparison History Trend */}
          {comparisonHistory.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Comparison Trend</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs text-destructive h-7" onClick={() => { setComparisonHistory([]); localStorage.removeItem('flowstral-visual-history'); }}>Clear</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-0.5 h-12">
                  {comparisonHistory.slice(0, 50).reverse().map((h, i) => (
                    <div key={i} className={`flex-1 rounded-t-sm min-w-[4px] transition-all hover:opacity-80 ${h.passed ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ height: `${Math.max(20, Math.min(100, 100 - h.diffPct * 100))}%` }}
                      title={`${h.testName}: ${h.passed ? 'Pass' : 'Fail'} (${(h.diffPct * 100).toFixed(1)}% diff)`} />
                  ))}
                </div>
                <div className="flex gap-6 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />{comparisonHistory.filter(h => h.passed).length} passed</span>
                  <span className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-red-500" />{comparisonHistory.filter(h => !h.passed).length} failed</span>
                  <span>Avg diff: {(comparisonHistory.reduce((a, h) => a + h.diffPct, 0) / comparisonHistory.length * 100).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><GitCompare className="w-5 h-5 text-primary" />Quick Compare</CardTitle>
                <CardDescription>Compare images with any mode</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Comparison Mode</Label>
                  <Select value={compareMode} onValueChange={setCompareMode}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPARISON_MODES.map(m => (
                        <SelectItem key={m.value} value={m.value}>
                          <div className="flex items-center gap-2">{m.icon}<span>{m.label}</span></div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Threshold: {(threshold * 100).toFixed(0)}%</Label>
                  <Slider value={[threshold * 100]} onValueChange={([v]) => setThreshold(v / 100)} max={50} step={1} className="mt-2" />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={dynamicContentDetection} onChange={e => setDynamicContentDetection(e.target.checked)} className="rounded" />
                    <span className="text-sm">Dynamic content detection</span>
                  </label>
                </div>
                <Button className="w-full" onClick={() => setActiveTab('compare')}>
                  <GitCompare className="w-4 h-4 mr-2" />Open Compare Tab
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-emerald-500" />Comparison Modes</CardTitle>
                <CardDescription>{COMPARISON_MODES.length} modes including AI semantic</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[300px] overflow-auto">
                  {COMPARISON_MODES.map(mode => (
                    <div key={mode.value} className={`p-2.5 rounded-lg border cursor-pointer transition-all ${compareMode === mode.value ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`} onClick={() => setCompareMode(mode.value)}>
                      <div className="flex items-center gap-2">{mode.icon}<span className="font-medium text-sm">{mode.label}</span></div>
                      <p className="text-xs text-muted-foreground mt-0.5">{mode.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Baselines */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5 text-blue-500" />Recent Baselines</CardTitle>
            </CardHeader>
            <CardContent>
              {baselines.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No baselines yet</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-4">
                  {baselines.slice(0, 8).map(b => (
                    <div key={b.test_name} className="group relative rounded-lg border overflow-hidden cursor-pointer hover:border-primary/50 transition-all" onClick={() => handleViewBaseline(b)}>
                      <div className="aspect-video bg-muted flex items-center justify-center"><ImageIcon className="w-8 h-8 text-muted-foreground" /></div>
                      <div className="p-2.5">
                        <p className="text-sm font-medium truncate">{b.test_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatFileSize(b.file_size)}</span>
                          {b.version && <Badge variant="outline" className="text-[10px] px-1 py-0">v{b.version}</Badge>}
                          {b.dimensions && <span className="text-[10px] text-muted-foreground">{b.dimensions[0]}x{b.dimensions[1]}</span>}
                        </div>
                      </div>
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button size="sm" variant="secondary"><Eye className="w-4 h-4 mr-1" />View</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ COMPARE TAB ═══════════════════ */}
        <TabsContent value="compare" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Image Comparison</CardTitle>
                  <CardDescription>Upload baseline and actual images, configure regions, then compare</CardDescription>
                </div>
                {/* Diff view mode toggle */}
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  {([['side-by-side', <Columns className="w-4 h-4" />, 'Side by Side'], ['slider', <SlidersHorizontal className="w-4 h-4" />, 'Slider'], ['onion-skin', <Blend className="w-4 h-4" />, 'Onion Skin']] as [DiffViewMode, React.ReactNode, string][]).map(([mode, icon, label]) => (
                    <Button key={mode} variant={diffViewMode === mode ? 'default' : 'ghost'} size="sm" className="h-8 gap-1.5" onClick={() => setDiffViewMode(mode)}>
                      {icon}<span className="text-xs">{label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Image upload area */}
              <div className="grid grid-cols-2 gap-6">
                {/* Baseline */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" /> Baseline Image
                  </Label>
                  <div ref={canvasRef}
                    role={baselineImage ? 'img' : 'button'}
                    tabIndex={0}
                    aria-label={baselineImage ? 'Baseline image with region drawing overlay' : 'Click or press Enter to upload baseline image'}
                    className={`relative aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all ${baselineImage ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-border hover:border-primary'} ${isDrawingRegion ? 'cursor-crosshair' : ''}`}
                    onClick={() => { if (!isDrawingRegion) document.getElementById('baseline-input')?.click(); }}
                    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isDrawingRegion) { e.preventDefault(); document.getElementById('baseline-input')?.click(); } }}
                    onMouseDown={baselineImage ? handleRegionMouseDown : undefined}
                    onMouseMove={baselineImage ? handleRegionMouseMove : undefined}
                    onMouseUp={baselineImage ? handleRegionMouseUp : undefined}
                  >
                    {baselineImage ? (
                      <>
                        <img src={`data:image/png;base64,${baselineImage}`} alt="Baseline" className="max-h-full max-w-full object-contain" />
                        {/* Rendered regions overlay */}
                        {ignoreRegions.map((r, i) => (
                          <div key={i} className={`absolute border-2 ${regionColorClass(r.type)} rounded-sm`}
                            style={{ left: r.x, top: r.y, width: r.width, height: r.height }}>
                            <span className="absolute -top-5 left-0 text-[10px] bg-background/90 px-1 rounded">{r.name}</span>
                          </div>
                        ))}
                        {/* Currently drawing region */}
                        {currentDraw && (
                          <div className={`absolute border-2 border-dashed ${regionColorClass(drawingRegionType)} rounded-sm`}
                            style={{ left: currentDraw.x, top: currentDraw.y, width: currentDraw.w, height: currentDraw.h }} />
                        )}
                      </>
                    ) : (
                      <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-2" /><p>Click to upload baseline</p></div>
                    )}
                  </div>
                  <input id="baseline-input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden" aria-label="Select baseline image file" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, setBaselineImage); e.target.value = ''; }} />
                  {baselineImage && <Button variant="outline" size="sm" onClick={() => { setBaselineImage(null); setIgnoreRegions([]); }}><X className="w-4 h-4 mr-1" />Clear</Button>}
                </div>

                {/* Actual */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" /> Actual Image
                  </Label>
                  <div className={`aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer transition-all ${actualImage ? 'border-blue-500/50 bg-blue-500/5' : 'border-border hover:border-primary'}`}
                    role={actualImage ? 'img' : 'button'}
                    tabIndex={0}
                    aria-label={actualImage ? 'Actual image for comparison' : 'Click or press Enter to upload actual image'}
                    onClick={() => document.getElementById('actual-input')?.click()}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('actual-input')?.click(); } }}>
                    {actualImage ? (
                      <img src={`data:image/png;base64,${actualImage}`} alt="Actual" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-2" /><p>Click to upload actual</p></div>
                    )}
                  </div>
                  <input id="actual-input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden" aria-label="Select actual image file" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, setActualImage); e.target.value = ''; }} />
                  {actualImage && <Button variant="outline" size="sm" onClick={() => setActualImage(null)}><X className="w-4 h-4 mr-1" />Clear</Button>}
                </div>
              </div>

              <Separator className="my-6" />

              {/* Settings row */}
              <div className="grid grid-cols-4 gap-4">
                <div>
                  <Label>Mode</Label>
                  <Select value={compareMode} onValueChange={setCompareMode}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPARISON_MODES.map(m => (<SelectItem key={m.value} value={m.value}><div className="flex items-center gap-2">{m.icon}<span>{m.label}</span></div></SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Threshold: {(threshold * 100).toFixed(0)}%</Label>
                  <Slider value={[threshold * 100]} onValueChange={([v]) => setThreshold(v / 100)} max={50} step={1} className="mt-3.5" />
                </div>
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={dynamicContentDetection} onChange={e => setDynamicContentDetection(e.target.checked)} className="rounded" />
                      <span className="text-sm">Auto-suppress dynamic content</span>
                    </label>
                  </div>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCompare} disabled={!baselineImage || !actualImage || isComparing} className="w-full">
                    {isComparing ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <GitCompare className="w-4 h-4 mr-2" />}
                    {isComparing ? 'Comparing...' : 'Compare'}
                  </Button>
                </div>
              </div>

              {/* Active regions indicator */}
              {ignoreRegions.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Grid3X3 className="w-3.5 h-3.5" />
                  {ignoreRegions.length} region(s) configured —
                  {REGION_TYPES.map(rt => {
                    const count = ignoreRegions.filter(r => r.type === rt.value).length;
                    return count > 0 ? <Badge key={rt.value} variant="outline" className="text-[10px] px-1.5 py-0 ml-1">{count} {rt.label}</Badge> : null;
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comparison Result */}
          {comparisonResult && (
            <Card className={`border-2 ${comparisonResult.passed ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-red-500/50 bg-red-500/5'}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {comparisonResult.passed ? <><CheckCircle className="w-6 h-6 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">Passed</span></> :
                      <><AlertCircle className="w-6 h-6 text-red-500" /><span className="text-red-600 dark:text-red-400">Failed</span></>}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="text-green-600 border-green-300" onClick={async () => {
                      if (!actualImage) { toast.error('No actual image to promote'); return; }
                      try {
                        // Try to update existing baseline, or save as new
                        try {
                          await axios.put(`${API_BASE}/baselines/manual_comparison`, { test_name: 'manual_comparison', image: actualImage, reason: 'Accepted via comparison review' });
                        } catch (_updateErr) {
                          await axios.post(`${API_BASE}/baselines`, { test_name: 'manual_comparison', image: actualImage, metadata: { promoted_from: 'comparison_review' } });
                        }
                        toast.success('Actual image promoted to baseline');
                        loadBaselines();
                      } catch (err: unknown) {
                        const message = axios.isAxiosError(err) ? err.response?.data?.detail : undefined;
                        toast.error(message || 'Failed to update baseline');
                      }
                    }}>
                      <Check className="w-3 h-3 mr-1" />Accept
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600 border-red-300" onClick={() => {
                      toast.info('Changes rejected - visual diff preserved for review');
                    }}>
                      <X className="w-3 h-3 mr-1" />Reject
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Metrics */}
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {[
                    { label: 'Difference', value: `${(comparisonResult.diff_percentage * 100).toFixed(2)}%`, icon: <Percent className="w-4 h-4" /> },
                    { label: 'Threshold', value: `${(comparisonResult.threshold * 100).toFixed(0)}%`, icon: <Target className="w-4 h-4" /> },
                    { label: 'Mode', value: comparisonResult.mode.replace(/_/g, ' '), icon: <Settings className="w-4 h-4" /> },
                    { label: 'Time', value: `${Math.round(comparisonResult.execution_time_ms)}ms`, icon: <Timer className="w-4 h-4" /> },
                    { label: 'SSIM', value: comparisonResult.ssim_score !== undefined ? `${(comparisonResult.ssim_score * 100).toFixed(1)}%` : 'N/A', icon: <Box className="w-4 h-4" /> },
                  ].map(m => (
                    <div key={m.label} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-1.5 text-muted-foreground mb-1">{m.icon}<span className="text-xs">{m.label}</span></div>
                      <p className="text-lg font-bold capitalize">{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Comparison Warning / Error */}
                {comparisonResult.error && (
                  <div className="mb-4 p-3 rounded-lg border border-amber-500/50 bg-amber-500/10 flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Comparison Warning</p>
                      <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-0.5">{comparisonResult.error}</p>
                    </div>
                  </div>
                )}

                {/* Diff Viewer */}
                {comparisonResult.diff_image_base64 && baselineImage && actualImage && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm font-semibold">Diff Viewer</Label>
                      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                        {([['side-by-side', 'Side by Side'], ['slider', 'Slider'], ['onion-skin', 'Onion Skin']] as [DiffViewMode, string][]).map(([mode, label]) => (
                          <button key={mode} className={`px-2 py-1 rounded text-xs transition-colors ${diffViewMode === mode ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setDiffViewMode(mode)}>{label}</button>
                        ))}
                      </div>
                    </div>

                    {diffViewMode === 'side-by-side' && (
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: 'Baseline', src: baselineImage, color: 'emerald' },
                          { label: 'Diff', src: comparisonResult.diff_image_base64, color: 'amber' },
                          { label: 'Actual', src: actualImage, color: 'blue' },
                        ].map(img => (
                          <div key={img.label}>
                            <p className="text-xs font-medium mb-1.5 flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full bg-${img.color}-500`} />{img.label}
                            </p>
                            <div className="bg-muted rounded-lg p-2 overflow-auto max-h-[400px]">
                              <img src={`data:image/png;base64,${img.src}`} alt={img.label} className="max-w-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {diffViewMode === 'slider' && (
                      <div className="space-y-2">
                        <div
                          className="relative overflow-hidden rounded-lg bg-muted select-none"
                          style={{ maxHeight: 500 }}
                          onMouseDown={(e) => {
                            const rect = e.currentTarget.getBoundingClientRect();
                            const updatePos = (clientX: number) => {
                              const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
                              setSliderPosition(pct);
                            };
                            updatePos(e.clientX);
                            const onMove = (ev: MouseEvent) => updatePos(ev.clientX);
                            const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
                            document.addEventListener('mousemove', onMove);
                            document.addEventListener('mouseup', onUp);
                          }}
                        >
                          <img src={`data:image/png;base64,${actualImage}`} alt="Actual" className="w-full block pointer-events-none" />
                          <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ width: `${sliderPosition}%` }}>
                            <img src={`data:image/png;base64,${baselineImage}`} alt="Baseline" className="w-full block" style={{ minWidth: canvasRef.current?.offsetWidth || '100%' }} />
                          </div>
                          <div className="absolute top-0 bottom-0 w-1 bg-primary pointer-events-none" style={{ left: `${sliderPosition}%` }}>
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg">
                              <SlidersHorizontal className="w-4 h-4 text-primary-foreground" />
                            </div>
                          </div>
                          <div className="absolute top-2 left-2 bg-emerald-600 text-emerald-50 text-[10px] px-2 py-0.5 rounded pointer-events-none font-medium">Baseline</div>
                          <div className="absolute top-2 right-2 bg-blue-600 text-blue-50 text-[10px] px-2 py-0.5 rounded pointer-events-none font-medium">Actual</div>
                        </div>
                        <Slider value={[sliderPosition]} onValueChange={([v]) => setSliderPosition(v)} max={100} step={1} />
                      </div>
                    )}

                    {diffViewMode === 'onion-skin' && (
                      <div className="space-y-2">
                        <div className="relative overflow-hidden rounded-lg bg-muted" style={{ maxHeight: 500 }}>
                          <img src={`data:image/png;base64,${baselineImage}`} alt="Baseline" className="w-full block" />
                          <img src={`data:image/png;base64,${actualImage}`} alt="Actual" className="absolute inset-0 w-full block" style={{ opacity: onionOpacity / 100 }} />
                          <div className="absolute top-2 left-2 bg-black/70 text-neutral-100 text-[10px] px-2 py-0.5 rounded font-medium">
                            Baseline &larr; &rarr; Actual ({onionOpacity}%)
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">Baseline</span>
                          <Slider value={[onionOpacity]} onValueChange={([v]) => setOnionOpacity(v)} max={100} step={1} className="flex-1" />
                          <span className="text-xs text-muted-foreground">Actual</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Mismatch regions */}
                {comparisonResult.mismatch_regions && comparisonResult.mismatch_regions.length > 0 && (
                  <div className="mt-4">
                    <Label className="text-sm font-semibold mb-2 block">Mismatch Regions ({comparisonResult.mismatch_regions.length})</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {comparisonResult.mismatch_regions.slice(0, 8).map((r, i) => (
                        <div key={i} className="p-2 bg-red-500/10 border border-red-500/20 rounded text-xs">
                          <span className="font-mono">({r.x}, {r.y})</span> <span className="text-muted-foreground">{r.width}x{r.height}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Batch URL Testing */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Layers className="w-5 h-5" />Batch URL Testing</CardTitle>
              <CardDescription>Capture and compare multiple URLs against baselines in bulk</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea className="w-full h-28 rounded-md border bg-muted px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={"https://example.com\nhttps://example.com/about\nhttps://example.com/pricing"}
                aria-label="URLs to test, one per line"
                value={batchTestUrls} onChange={e => setBatchTestUrls(e.target.value)} />
              <div className="flex items-center gap-3">
                <Button onClick={async () => {
                  const urls = batchTestUrls.split('\n').map(u => u.trim()).filter(u => u.startsWith('http'));
                  if (urls.length === 0) { toast.error('Enter at least one URL'); return; }
                  setIsBatchTesting(true); setBatchTestResults([]);
                  const results: typeof batchTestResults = [];
                  for (const url of urls) {
                    const testName = url.replace(/https?:\/\//, '').replace(/[^a-zA-Z0-9]/g, '-').slice(0, 60);
                    try {
                      // Capture screenshot and get base64
                      const captureRes = await axios.post(`${API_BASE}/capture`, new URLSearchParams({ url, test_name: testName, full_page: 'true', viewport_width: '1920', viewport_height: '1080', save_as_baseline: 'false' }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
                      const actualBase64 = captureRes.data?.image_base64;
                      if (actualBase64) {
                        try {
                          const cmp = await axios.post(`${API_BASE}/compare-by-name`, { test_name: testName, actual: actualBase64, mode: compareMode, threshold });
                          const result = cmp.data?.result || {};
                          results.push({ url, status: result.passed ? 'passed' : (result.is_new_baseline ? 'new-baseline' : 'failed'), diffPct: result.diff_percentage, testName });
                        } catch (_cmpErr) { results.push({ url, status: 'error', testName }); }
                      } else {
                        results.push({ url, status: 'error', testName });
                      }
                    } catch (_captureErr) { results.push({ url, status: 'error', testName }); }
                    setBatchTestResults([...results]);
                  }
                  setIsBatchTesting(false);
                  toast.success(`Batch: ${results.filter(r => r.status === 'passed').length} pass, ${results.filter(r => r.status === 'failed').length} fail`);
                }} disabled={isBatchTesting || !batchTestUrls.trim()}>
                  {isBatchTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testing...</> : <><Layers className="w-4 h-4 mr-2" />Run Batch</>}
                </Button>
                <span className="text-xs text-muted-foreground">{batchTestUrls.split('\n').filter(u => u.trim().startsWith('http')).length} URL(s)</span>
              </div>
              {batchTestResults.length > 0 && (
                <div className="border rounded-lg overflow-auto max-h-[300px]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-muted sticky top-0"><tr>
                      <th className="text-left px-3 py-2 font-medium">URL</th>
                      <th className="text-left px-3 py-2 font-medium w-24">Status</th>
                      <th className="text-left px-3 py-2 font-medium w-20">Diff %</th>
                    </tr></thead>
                    <tbody>
                      {batchTestResults.map((r, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2 font-mono text-xs truncate max-w-[300px]" title={r.url}>{r.url}</td>
                          <td className="px-3 py-2">
                            {r.status === 'passed' && <Badge className="bg-green-500/20 text-green-600 border-green-500/30"><CheckCircle className="w-3 h-3 mr-1" />Pass</Badge>}
                            {r.status === 'failed' && <Badge className="bg-red-500/20 text-red-600 border-red-500/30"><AlertCircle className="w-3 h-3 mr-1" />Fail</Badge>}
                            {r.status === 'new-baseline' && <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30"><Plus className="w-3 h-3 mr-1" />New</Badge>}
                            {r.status === 'error' && <Badge className="bg-yellow-500/20 text-yellow-600 border-yellow-500/30">Error</Badge>}
                          </td>
                          <td className="px-3 py-2 text-xs">{r.diffPct !== undefined ? `${(r.diffPct * 100).toFixed(1)}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ BASELINES TAB ═══════════════════ */}
        <TabsContent value="baselines" className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search baselines..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10" aria-label="Search baselines by test name" />
            </div>
            <Badge variant="outline">{filteredBaselines.length} baselines</Badge>
          </div>
          {filteredBaselines.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">No baselines found</p>
                <Button className="mt-4" onClick={() => setShowUploadDialog(true)}><Upload className="w-4 h-4 mr-2" />Upload Baseline</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {filteredBaselines.map(b => (
                <Card key={b.test_name} className="hover:border-primary/50 transition-all cursor-pointer group" onClick={() => handleViewBaseline(b)}>
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    <div className="absolute inset-0 flex items-center justify-center"><ImageIcon className="w-12 h-12 text-muted-foreground/30" /></div>
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button size="sm" variant="secondary"><Eye className="w-4 h-4" /></Button>
                      <Button size="sm" variant="destructive" onClick={e => { e.stopPropagation(); handleDeleteBaseline(b.test_name); }}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium truncate">{b.test_name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">{formatFileSize(b.file_size)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(b.modified_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          {b.dimensions && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{b.dimensions[0]}x{b.dimensions[1]}</Badge>}
                          {b.version && <Badge variant="outline" className="text-[10px] px-1.5 py-0">v{b.version}</Badge>}
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}><MoreVertical className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); handleViewBaseline(b); }}><Eye className="w-4 h-4 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={async e => {
                            e.stopPropagation();
                            try {
                              const res = await axios.get(`${API_BASE}/baselines/${encodeURIComponent(b.test_name)}`);
                              if (res.data.image_base64) {
                                const a = document.createElement('a');
                                a.href = `data:image/png;base64,${res.data.image_base64}`;
                                a.download = `${b.test_name}.png`;
                                a.click();
                                toast.success('Downloaded');
                              } else {
                                toast.error('No image data available');
                              }
                            } catch (error: unknown) {
                              const message = axios.isAxiosError(error) ? error.response?.data?.detail : undefined;
                              toast.error(message || 'Download failed');
                            }
                          }}><Download className="w-4 h-4 mr-2" />Download</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={e => { e.stopPropagation(); handleDeleteBaseline(b.test_name); }}><Trash2 className="w-4 h-4 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ═══════════════════ REGIONS TAB ═══════════════════ */}
        <TabsContent value="regions" className="space-y-6">
          <div className="grid grid-cols-3 gap-6">
            {/* Region types */}
            <Card className="col-span-1">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Grid3X3 className="w-5 h-5" />Region Types</CardTitle>
                <CardDescription>Draw regions on the baseline image to customize comparison behavior per-area</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {REGION_TYPES.map(rt => (
                  <div key={rt.value} className={`p-3 rounded-lg border cursor-pointer transition-all ${drawingRegionType === rt.value && isDrawingRegion ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/40'}`}
                    onClick={() => { setDrawingRegionType(rt.value as IgnoreRegion['type']); setIsDrawingRegion(true); }}>
                    <div className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded border ${rt.color}`} />
                      <span className="font-medium text-sm">{rt.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{rt.description}</p>
                  </div>
                ))}
                {isDrawingRegion && (
                  <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg text-center">
                    <Crosshair className="w-5 h-5 mx-auto mb-1 text-primary animate-pulse" />
                    <p className="text-xs font-medium">Draw on the baseline image</p>
                    <Button variant="ghost" size="sm" className="mt-1 h-6 text-xs" onClick={() => setIsDrawingRegion(false)}>Cancel</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Active regions list */}
            <Card className="col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">Active Regions ({ignoreRegions.length})</CardTitle>
                  {ignoreRegions.length > 0 && <Button variant="ghost" size="sm" className="text-xs text-destructive h-7" onClick={() => setIgnoreRegions([])}>Clear All</Button>}
                </div>
              </CardHeader>
              <CardContent>
                {ignoreRegions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MousePointer className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No regions configured</p>
                    <p className="text-xs mt-1">Select a region type and draw on the baseline image, or add manually below</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {ignoreRegions.map((r, i) => (
                      <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-4 h-4 rounded border ${regionColorClass(r.type)}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{r.name}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">{r.type}</Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">({r.x}, {r.y}) {r.width}x{r.height}</span>
                            {r.floatOffset && <span className="text-xs text-blue-500 ml-2">drift: ±{r.floatOffset}px</span>}
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" aria-label={`Remove region ${r.name}`} onClick={() => setIgnoreRegions(prev => prev.filter((_, j) => j !== i))}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Manual region add */}
                <Separator className="my-4" />
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Add Region Manually</Label>
                  <div className="grid grid-cols-5 gap-2">
                    <Input placeholder="X" type="number" id="reg-x" className="text-sm" />
                    <Input placeholder="Y" type="number" id="reg-y" className="text-sm" />
                    <Input placeholder="Width" type="number" id="reg-w" className="text-sm" />
                    <Input placeholder="Height" type="number" id="reg-h" className="text-sm" />
                    <Button variant="outline" size="sm" onClick={() => {
                      const x = parseInt((document.getElementById('reg-x') as HTMLInputElement).value) || 0;
                      const y = parseInt((document.getElementById('reg-y') as HTMLInputElement).value) || 0;
                      const w = parseInt((document.getElementById('reg-w') as HTMLInputElement).value) || 100;
                      const h = parseInt((document.getElementById('reg-h') as HTMLInputElement).value) || 100;
                      setIgnoreRegions(prev => [...prev, { x, y, width: w, height: h, name: `Region ${prev.length + 1}`, reason: 'manual', type: drawingRegionType, floatOffset: drawingRegionType === 'floating' ? 10 : undefined }]);
                      toast.success('Region added');
                    }}><Plus className="w-4 h-4 mr-1" />Add</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════════════════ VIEWPORT MATRIX TAB ═══════════════════ */}
        <TabsContent value="matrix" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><LayoutGrid className="w-5 h-5" />Responsive Viewport Matrix</CardTitle>
              <CardDescription>Test a single URL across multiple viewports simultaneously — like Applitools Ultrafast Grid</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target URL</Label>
                  <Input value={captureUrl} onChange={e => setCaptureUrl(e.target.value)} placeholder="https://example.com" className="mt-1.5" />
                </div>
                <div>
                  <Label>Comparison Mode</Label>
                  <Select value={compareMode} onValueChange={setCompareMode}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COMPARISON_MODES.map(m => (<SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Viewport selection */}
              <div>
                <Label className="mb-2 block">Select Viewports</Label>
                <div className="grid grid-cols-4 gap-3">
                  {viewportPresets.map((vp, i) => (
                    <label key={vp.name} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${vp.checked ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                      <input type="checkbox" checked={vp.checked} onChange={e => { const nv = [...viewportPresets]; nv[i] = { ...vp, checked: e.target.checked }; setViewportPresets(nv); }} className="rounded" />
                      {vp.icon}
                      <div>
                        <span className="text-sm font-medium">{vp.name}</span>
                        <p className="text-xs text-muted-foreground">{vp.width}x{vp.height}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <Button onClick={runViewportMatrix} disabled={isMatrixTesting || !captureUrl} className="w-full">
                {isMatrixTesting ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Testing viewports...</> : <><LayoutGrid className="w-4 h-4 mr-2" />Run Viewport Matrix Test</>}
              </Button>

              {/* Results grid */}
              {viewportResults.length > 0 && (
                <div className="grid grid-cols-2 gap-4 mt-4">
                  {viewportResults.map((vr, i) => (
                    <Card key={i} className={`${vr.status === 'done' && vr.result ? (vr.result.passed ? 'border-emerald-500/30' : 'border-red-500/30') : ''}`}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {viewportPresets.find(v => v.name === vr.viewport)?.icon}
                            <span className="font-medium">{vr.viewport}</span>
                            <span className="text-xs text-muted-foreground">{vr.width}x{vr.height}</span>
                          </div>
                          {vr.status === 'pending' && <Badge variant="outline" className="text-xs">Pending</Badge>}
                          {vr.status === 'running' && <Badge className="bg-blue-500/20 text-blue-600 text-xs"><RefreshCw className="w-3 h-3 mr-1 animate-spin" />Running</Badge>}
                          {vr.status === 'done' && vr.result && (
                            vr.result.passed ? <Badge className="bg-green-500/20 text-green-600 text-xs"><CheckCircle className="w-3 h-3 mr-1" />Pass</Badge> :
                            <Badge className="bg-red-500/20 text-red-600 text-xs"><AlertCircle className="w-3 h-3 mr-1" />Fail</Badge>
                          )}
                          {vr.status === 'done' && !vr.result && <Badge variant="outline" className="text-xs">New Baseline</Badge>}
                          {vr.status === 'error' && <Badge className="bg-yellow-500/20 text-yellow-600 text-xs">Error</Badge>}
                        </div>
                        {vr.result && (
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 bg-muted rounded"><span className="text-muted-foreground">Diff:</span> <span className="font-mono">{(vr.result.diff_percentage * 100).toFixed(1)}%</span></div>
                            <div className="p-2 bg-muted rounded"><span className="text-muted-foreground">Time:</span> <span className="font-mono">{Math.round(vr.result.execution_time_ms)}ms</span></div>
                            {vr.result.ssim_score !== undefined && <div className="p-2 bg-muted rounded"><span className="text-muted-foreground">SSIM:</span> <span className="font-mono">{(vr.result.ssim_score * 100).toFixed(1)}%</span></div>}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════ REVIEW DIFFS TAB ═══════════════════ */}
        <TabsContent value="diffs" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Review Visual Diffs</CardTitle>
                  <CardDescription>Accept changes to update baselines, or reject to flag bugs</CardDescription>
                </div>
                {diffs.length > 0 && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                      onClick={() => { const n = { ...approvedDiffs }; diffs.forEach(d => { n[d.filename] = 'accepted'; }); setApprovedDiffs(n); toast.success('All accepted'); }}>
                      <Check className="w-3 h-3 mr-1" />Accept All
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-900/20"
                      onClick={() => { const n = { ...approvedDiffs }; diffs.forEach(d => { n[d.filename] = 'rejected'; }); setApprovedDiffs(n); toast.success('All rejected'); }}>
                      <X className="w-3 h-3 mr-1" />Reject All
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {diffs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <GitCompare className="w-12 h-12 mx-auto mb-4 opacity-50" /><p>No diffs to review</p><p className="text-sm mt-1">Run comparisons to generate diffs</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Filter bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={diffFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setDiffFilter('all')}>All ({diffs.length})</Badge>
                    <Badge variant={diffFilter === 'unreviewed' ? 'default' : 'outline'} className="cursor-pointer text-amber-600 dark:text-amber-400" onClick={() => setDiffFilter('unreviewed')}>Unreviewed ({diffs.filter(d => !approvedDiffs[d.filename]).length})</Badge>
                    <Badge variant={diffFilter === 'accepted' ? 'default' : 'outline'} className="cursor-pointer text-emerald-600 dark:text-emerald-400" onClick={() => setDiffFilter('accepted')}>Accepted ({diffs.filter(d => approvedDiffs[d.filename] === 'accepted').length})</Badge>
                    <Badge variant={diffFilter === 'rejected' ? 'default' : 'outline'} className="cursor-pointer text-red-600 dark:text-red-400" onClick={() => setDiffFilter('rejected')}>Rejected ({diffs.filter(d => approvedDiffs[d.filename] === 'rejected').length})</Badge>
                  </div>

                  {diffs.filter(d => {
                    if (diffFilter === 'unreviewed') return !approvedDiffs[d.filename];
                    if (diffFilter === 'accepted') return approvedDiffs[d.filename] === 'accepted';
                    if (diffFilter === 'rejected') return approvedDiffs[d.filename] === 'rejected';
                    return true;
                  }).map(diff => {
                    const approval = approvedDiffs[diff.filename];
                    return (
                      <div key={diff.filename} className={`flex items-center justify-between p-4 rounded-lg border transition-all ${approval === 'accepted' ? 'border-green-500/30 bg-green-500/5' : approval === 'rejected' ? 'border-red-500/30 bg-red-500/5' : 'border-border bg-card hover:border-primary/30'}`}>
                        <div className="flex items-center gap-4">
                          <div className="w-16 h-12 bg-muted rounded flex items-center justify-center"><FileImage className="w-6 h-6 text-muted-foreground" /></div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{diff.filename}</p>
                              {approval === 'accepted' && <Badge className="bg-green-500 text-[10px] px-1.5">Accepted</Badge>}
                              {approval === 'rejected' && <Badge variant="destructive" className="text-[10px] px-1.5">Rejected</Badge>}
                              {!approval && <Badge variant="outline" className="text-[10px] px-1.5 text-amber-500 border-amber-300">Pending</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{formatFileSize(diff.size)} &middot; {formatDate(diff.created_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => window.open(`${API_BASE}/diffs/${diff.filename}`, '_blank')}><Eye className="w-4 h-4 mr-1" />View</Button>
                          <Button size="sm" variant={approval === 'accepted' ? 'default' : 'outline'}
                            className={approval === 'accepted' ? 'bg-green-600 hover:bg-green-500' : 'text-green-600 border-green-300'}
                            onClick={async () => {
                              setApprovedDiffs(prev => ({ ...prev, [diff.filename]: 'accepted' }));
                              try {
                                const testName = diff.filename.replace(/^diff_/, '').replace(/\.png$/, '').replace(/_\d+$/, '');
                                const r = await axios.get(`${API_BASE}/baselines/${encodeURIComponent(testName)}`);
                                if (r.data?.image_base64) { await axios.post(`${API_BASE}/baselines`, { test_name: testName, image: r.data.image_base64 }); toast.success('Promoted to new baseline'); loadBaselines(); }
                                else toast.success('Accepted');
                              } catch (_promoteErr) { toast.success('Accepted (baseline promotion skipped)'); }
                            }}><Check className="w-3 h-3 mr-1" />Accept</Button>
                          <Button size="sm" variant={approval === 'rejected' ? 'destructive' : 'outline'}
                            className={approval !== 'rejected' ? 'text-red-600 border-red-300' : ''}
                            onClick={() => { setApprovedDiffs(prev => ({ ...prev, [diff.filename]: 'rejected' })); toast.info('Rejected'); }}>
                            <X className="w-3 h-3 mr-1" />Reject</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════ DIALOGS ═══════════════════ */}

      {/* Upload Baseline Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Baseline</DialogTitle>
            <DialogDescription>Upload an image as a visual regression baseline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Test Name</Label><Input value={uploadTestName} onChange={e => setUploadTestName(e.target.value)} placeholder="homepage_hero_section" className="mt-1.5" /></div>
            <div>
              <Label>Image</Label>
              <div className="mt-1.5 aspect-video border-2 border-dashed rounded-lg flex items-center justify-center cursor-pointer hover:border-primary"
                role="button"
                tabIndex={0}
                aria-label="Click or press Enter to select image file"
                onClick={() => document.getElementById('upload-input')?.click()}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); document.getElementById('upload-input')?.click(); } }}>
                {uploadPreview ? <img src={uploadPreview} alt="Preview of selected baseline image" className="max-h-full max-w-full object-contain" /> : <div className="text-center text-muted-foreground"><Upload className="w-8 h-8 mx-auto mb-2" aria-hidden="true" /><p>Click to select</p></div>}
              </div>
              <input id="upload-input" type="file" accept="image/png,image/jpeg,image/webp,image/bmp,image/gif" className="hidden" aria-label="Select baseline image to upload" onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  if (!ALLOWED_IMAGE_TYPES.includes(f.type)) {
                    toast.error(`Invalid file type: ${f.type || 'unknown'}. Allowed: PNG, JPEG, WebP, BMP, GIF`);
                    return;
                  }
                  if (f.size > MAX_UPLOAD_SIZE) {
                    toast.error(`File too large (${(f.size / (1024 * 1024)).toFixed(1)}MB). Maximum: ${MAX_UPLOAD_SIZE / (1024 * 1024)}MB`);
                    return;
                  }
                  // Revoke previous preview URL to prevent memory leak
                  if (uploadPreview && uploadPreview.startsWith('blob:')) {
                    URL.revokeObjectURL(uploadPreview);
                  }
                  setUploadImage(f);
                  const r = new FileReader();
                  r.onload = ev => setUploadPreview(ev.target?.result as string);
                  r.onerror = () => toast.error('Failed to read image file');
                  r.readAsDataURL(f);
                }
                e.target.value = '';
              }} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadDialog(false)}>Cancel</Button>
            <Button onClick={handleUploadBaseline} disabled={!uploadTestName || !uploadImage}><Upload className="w-4 h-4 mr-2" />Upload</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Capture Screenshot Dialog */}
      <Dialog open={showCaptureDialog} onOpenChange={setShowCaptureDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Capture Screenshot</DialogTitle>
            <DialogDescription>Capture from URL and save as baseline</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>URL</Label><Input value={captureUrl} onChange={e => setCaptureUrl(e.target.value)} placeholder="https://example.com" className="mt-1.5" /></div>
            <div><Label>Test Name</Label><Input value={captureTestName} onChange={e => setCaptureTestName(e.target.value)} placeholder="example_homepage" className="mt-1.5" /></div>
            <div>
              <Label className="mb-2 block">Viewports</Label>
              <div className="grid grid-cols-2 gap-2">
                {viewportPresets.map((vp, i) => (
                  <label key={vp.name} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${vp.checked ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40'}`}>
                    <input type="checkbox" checked={vp.checked} onChange={e => { const nv = [...viewportPresets]; nv[i] = { ...vp, checked: e.target.checked }; setViewportPresets(nv); }} className="rounded" />
                    <span className="text-sm">{vp.name}</span>
                    <span className="text-xs text-muted-foreground">({vp.width}x{vp.height})</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCaptureDialog(false)}>Cancel</Button>
            <Button onClick={handleCaptureScreenshot} disabled={!captureUrl || !captureTestName || isCapturing || viewportPresets.filter(v => v.checked).length === 0}>
              {isCapturing ? <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Capturing...</> : <><Target className="w-4 h-4 mr-2" />Capture</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Baseline Detail Dialog */}
      <Dialog open={!!selectedBaseline} onOpenChange={() => { setSelectedBaseline(null); setSelectedBaselineImage(null); }}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedBaseline?.test_name}
              {selectedBaseline?.version && <Badge variant="outline">v{selectedBaseline.version}</Badge>}
            </DialogTitle>
            <DialogDescription>Baseline details and management</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {isLoadingBaselineImage ? (
              <div className="bg-muted rounded-lg p-4 flex items-center justify-center min-h-[200px]">
                <div className="text-center text-muted-foreground">
                  <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p className="text-sm">Loading baseline image...</p>
                </div>
              </div>
            ) : selectedBaselineImage ? (
              <div className="bg-muted rounded-lg p-4 overflow-auto max-h-[60vh]">
                <img src={`data:image/png;base64,${selectedBaselineImage}`} alt={`Baseline image for test: ${selectedBaseline?.test_name || 'unknown'}`} className="max-w-full" />
              </div>
            ) : null}
            {selectedBaseline && (
              <div className="grid grid-cols-4 gap-3">
                <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">Size</p><p className="font-medium text-sm">{formatFileSize(selectedBaseline.file_size)}</p></div>
                <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">Modified</p><p className="font-medium text-sm">{formatDate(selectedBaseline.modified_at)}</p></div>
                <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">Dimensions</p><p className="font-medium text-sm">{selectedBaseline.dimensions ? `${selectedBaseline.dimensions[0]}x${selectedBaseline.dimensions[1]}` : 'Unknown'}</p></div>
                <div className="p-3 bg-muted rounded-lg"><p className="text-xs text-muted-foreground">Version</p><p className="font-medium text-sm">v{selectedBaseline.version || 1}</p></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10" disabled={!selectedBaseline?.test_name} aria-label={`Delete baseline ${selectedBaseline?.test_name || ''}`} onClick={() => { if (selectedBaseline?.test_name) handleDeleteBaseline(selectedBaseline.test_name); }}><Trash2 className="w-4 h-4 mr-2" />Delete</Button>
            <Button variant="outline" onClick={() => { if (selectedBaselineImage) { setBaselineImage(selectedBaselineImage); setActiveTab('compare'); setSelectedBaseline(null); setSelectedBaselineImage(null); } }}>
              <GitCompare className="w-4 h-4 mr-2" />Use for Comparison
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
