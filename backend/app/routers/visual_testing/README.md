# Visual Testing Router

Backend API router for visual regression testing with 6 comparison modes, baseline management, screenshot capture, and diff visualization.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `visual_testing_api.py` | 700 | `/api/visual-testing` | 15 | Image comparison, baseline CRUD, screenshot capture, batch compare, diff listing |

**Total: 15 endpoints across 1 router**

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/visual-testing/compare` | POST | Compare two uploaded images using selected mode |
| `/api/visual-testing/compare-by-name` | POST | Compare against stored baseline by test name |
| `/api/visual-testing/baselines` | GET | List all stored baselines |
| `/api/visual-testing/baselines` | POST | Upload new baseline image |
| `/api/visual-testing/baselines/{name}` | GET/DELETE | Get or delete specific baseline |
| `/api/visual-testing/capture` | POST | Capture screenshot from URL via headless browser |
| `/api/visual-testing/batch-compare` | POST | Batch comparison of multiple image pairs |
| `/api/visual-testing/diffs` | GET | List generated diff images |

## Comparison Modes

| Mode | Algorithm |
|------|-----------|
| `pixel_perfect` | Exact pixel-by-pixel comparison |
| `anti_aliased` | Anti-aliasing tolerant (recommended) |
| `perceptual` | Average Hash (aHash, 16x16 grid) |
| `structural` | SSIM (Structural Similarity Index) |
| `layout` | Layout-only (ignores content) |
| `ai_semantic` | Claude Vision AI semantic comparison |

## Related Backend Services

| Service | Purpose |
|---------|---------|
| `backend/app/services/automation/visual_testing_engine.py` | VisualTestingEngine -- mode dispatching, PerceptualHasher, ComparisonResult |

**Dependencies:** PIL/Pillow (image processing), NumPy (numerical computation)

## Related Frontend Module

- `src/modules/visual-testing/` -- VisualTestingPage with Dashboard, Compare, Baselines, Diffs tabs
