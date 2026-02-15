# Visual Testing

Visual regression testing with 6 comparison modes, baseline management, ignore regions, and diff visualization. Detects unintended visual changes between application versions by comparing screenshots against stored baselines.

## Architecture

The module provides a single comprehensive page with 4 tabs:

1. **Dashboard** -- Overview of visual test status, recent comparisons, and pass/fail trends.
2. **Compare** -- Upload or capture screenshots and compare against baselines using one of 6 comparison modes.
3. **Baselines** -- Manage stored baseline images with metadata (dimensions, file size, creation date).
4. **Recent Diffs** -- Browse diff images with highlighted mismatch regions.

The backend `VisualTestingEngine` dispatches comparisons to the appropriate algorithm based on the selected mode. Image processing uses PIL/Pillow and NumPy.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/VisualTestingPage.tsx` | 1,324 | Dashboard, Compare, Baselines, Recent Diffs tabs with full comparison workflow |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for the VisualTestingPage |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/visual-testing/compare` | POST | Compare two uploaded images |
| `/api/visual-testing/compare-by-name` | POST | Compare against stored baseline by test name |
| `/api/visual-testing/baselines` | GET/POST | List all baselines / upload new baseline |
| `/api/visual-testing/baselines/{name}` | GET/DELETE | Get or delete specific baseline |
| `/api/visual-testing/capture` | POST | Capture screenshot from URL via headless browser |
| `/api/visual-testing/batch-compare` | POST | Batch comparison of multiple image pairs |
| `/api/visual-testing/diffs` | GET | List generated diff images |

## Comparison Modes

| Mode | Algorithm | Description |
|------|-----------|-------------|
| `pixel_perfect` | Exact pixel diff | Exact pixel-by-pixel comparison; any difference fails |
| `anti_aliased` | Tolerant pixel diff | Ignores anti-aliasing artifacts (recommended default) |
| `perceptual` | Average Hash (aHash) | Robust against scaling and compression; 16x16 grid |
| `structural` | SSIM | Structural Similarity Index for perceptual quality |
| `layout` | Layout analysis | Compares layout structure, ignoring text/image content |
| `ai_semantic` | Claude Vision | AI-powered semantic comparison using LLM vision |

## Key Types

```typescript
interface Baseline { test_name: string; path: string; file_size: number; modified_at: string; dimensions: string; created_at: string }
interface IgnoreRegion { x: number; y: number; width: number; height: number; name: string; reason: string }
interface ComparisonResult { passed: boolean; diff_percentage: number; diff_pixel_count: number; total_pixels: number; mode: string; threshold: number; ssim_score?: number; perceptual_hash_baseline?: string; perceptual_hash_actual?: string; mismatch_regions: any[]; diff_image_base64?: string }
```

## Dependencies

- **Internal**: `@/lib/api-config`, `@/components/ui/*`
- **External**: React 18, Tailwind CSS, Radix UI, Lucide icons

## Testing Notes

- Image comparison results depend on the selected mode and threshold; test each mode with known diff/match pairs.
- `ai_semantic` mode requires an active Claude API key and incurs LLM costs per comparison.
- Ignore regions should be tested with overlapping regions and edge cases (region at image boundary).
- Baseline management should verify that uploading a new baseline with the same name replaces the old one.
- Diff images are stored temporarily; verify cleanup behavior.
