# Feature: Accessibility & Visual Testing
> Automated WCAG accessibility scanning with axe-core, compliance framework mapping (PCI DSS, HIPAA, SOC 2, GDPR), and visual regression testing with 6 comparison algorithms including AI-powered semantic diff via Claude Vision.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Frontend Code Audit](#3-frontend-code-audit)
4. [Backend Code Audit](#4-backend-code-audit)
5. [API Endpoints](#5-api-endpoints)
6. [UI Walkthrough](#6-ui-walkthrough)
7. [Accessibility Scanner Deep Dive](#7-accessibility-scanner-deep-dive)
8. [Visual Comparison Engine Deep Dive](#8-visual-comparison-engine-deep-dive)
9. [Configuration](#9-configuration)
10. [Known Gaps & TODOs](#10-known-gaps--todos)

---

## 1. Overview

This document covers two related testing-output features that assess quality beyond functional correctness:

### Accessibility Testing

- **Automated WCAG scanning** via axe-core (injected into Playwright browser)
- **Two API versions:** v1 (`/api/accessibility`) with 10 endpoints (6 are stubs) and v2 (`/api/a11y`) with 6 fully-implemented endpoints
- **HTML/JSON/Markdown reports** with executive summaries
- **Compliance mapping** to 7 frameworks (PCI DSS, HIPAA, SOC 2, GDPR, ISO 27001, NIST, FedRAMP)
- **Batch scanning** with concurrency control
- **Regex fallback** when Playwright is unavailable

### Visual Testing

- **6 comparison algorithms:** Pixel Perfect, Anti-Aliased, Perceptual Hash, Structural (SSIM), Layout Only, AI Semantic (Claude Vision)
- **Baseline management** with history and archiving
- **Diff image generation** (side-by-side composite with magenta highlights)
- **Ignore regions** for masking dynamic content
- **Screenshot capture** via Playwright from URLs
- **15 fully-implemented API endpoints** — zero stubs

---

## 2. Architecture

### Accessibility

```
Accessibility.tsx (348 lines)
    │
    ├── POST /api/accessibility/scan
    │       │
    │       ▼
    │   accessibility_api.py
    │       ├── axe_scanner.py (subprocess)
    │       │       └── Playwright → inject axe-core CDN → run violations
    │       └── WCAGPipeline analysis
    │
    └── POST /api/a11y/scan (V2 — preferred)
            │
            ▼
        accessibility_scan_api.py
            ├── AxeCoreScanner
            │       ├── Playwright sync (Windows thread pool)
            │       ├── Playwright async (Linux/Mac)
            │       └── HTTP + regex fallback
            └── AccessibilityReportGenerator
                    ├── HTML (styled, print-ready)
                    ├── JSON
                    └── Markdown
```

### Visual Testing

```
VisualTestingPage.tsx (1,324 lines)
    │
    ├── POST /api/visual-testing/compare
    ├── POST /api/visual-testing/baselines
    ├── POST /api/visual-testing/capture
    │       │
    │       ▼
    │   visual_testing_api.py (700 lines)
    │       │
    │       ▼
    │   VisualTestingEngine (1,083 lines)
    │       ├── 6 comparison modes
    │       │       ├── Pixel Perfect (NumPy diff)
    │       │       ├── Anti-Aliased (Sobel edge + tolerance)
    │       │       ├── Perceptual (aHash + dHash)
    │       │       ├── Structural (SSIM)
    │       │       ├── Layout (edge extraction)
    │       │       └── AI Semantic (Claude Vision)
    │       ├── Baseline management (PNG + metadata JSON)
    │       ├── Diff image generation
    │       └── Ignore region masking
    │
    └── Compliance
            │
            ▼
        compliance_api.py
            ├── ComplianceReporter (PostgreSQL)
            └── FrameworkMapper (7 frameworks)
```

---

## 3. Frontend Code Audit

| File | Lines | Status | Role |
|------|-------|--------|------|
| `src/pages/Accessibility.tsx` | 348 | **Fully implemented** | URL input, scan type (full page/component), WCAG level selector (A/AA/AAA), results display with severity badges, JSON export. Calls `POST /api/accessibility/scan`. |
| `src/pages/VisualTestingPage.tsx` | 1,324 | **Fully implemented** | 4-tab dashboard (Dashboard, Compare, Baselines, Recent Diffs). 6 comparison modes. Upload/capture screenshots. Baseline CRUD. Diff viewer. Stats. Falls back to 6 sample baselines when backend offline. |

### Accessibility.tsx

**Key State:** `url`, `scanType`, `wcagLevel`, `scanning`, `results` (issues array), `recentScans`

**Backend Communication:** `POST ${API_BASE_URL}/api/accessibility/scan` with `{url, scan_type, wcag_level}`

**Display:** Each issue shows impact badge (critical/serious/moderate/minor), WCAG criterion, affected element code snippet, suggested fix, and help URL.

### VisualTestingPage.tsx

**Key State:** `baselines[]`, `diffs[]`, `comparisonResult`, `loading`, `activeTab`

**6 Comparison Modes:**
1. Anti-Aliased (Recommended)
2. Pixel Perfect
3. Perceptual Hash
4. Structural (SSIM)
5. Layout Only
6. AI Semantic (Claude Vision)

**Backend Communication:**
- `GET /api/visual-testing/baselines` — list baselines
- `GET /api/visual-testing/diffs?limit=20` — recent diffs
- `POST /api/visual-testing/compare` — compare two images
- `POST /api/visual-testing/baselines` — save baseline
- `DELETE /api/visual-testing/baselines/{name}` — delete baseline
- `GET /api/visual-testing/baselines/{name}` — view baseline
- `POST /api/visual-testing/capture` — screenshot from URL

---

## 4. Backend Code Audit

### Accessibility Routers

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/accessibility_api.py` | 496 | `/api/accessibility` | 10 | **Mixed** — `/scan` and `/issues/{id}/fix` are real; 6 endpoints are stubs with TODO comments |
| `backend/app/routers/accessibility_scan_api.py` | 304 | `/api/a11y` | 6 | **Fully implemented** |
| `backend/app/routers/compliance_api.py` | 114 | `/api/compliance` | 3 | **Fully implemented** (requires PostgreSQL) |

### Accessibility Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/accessibility/axe_scanner.py` | 83 | **Fully implemented** | Standalone subprocess: launches Playwright, injects axe-core CDN, runs `axe.run()`, returns violations + HTML |
| `backend/app/services/accessibility/axe_core_scanner.py` | 832 | **Fully implemented** | Production scanner: Playwright sync (Windows), Playwright async (Linux/Mac), HTTP+regex fallback. Fix examples, WCAG criteria mapping, executive summary generation. |
| `backend/app/services/accessibility/accessibility_report_generator.py` | 744 | **Fully implemented** | HTML (styled with CSS, score circle, violation cards, print support), JSON, Markdown reports |

### Compliance Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/compliance/compliance_reporter.py` | 198 | **Fully implemented** | Generates compliance reports from PostgreSQL test run data. Stores in `compliance_reports` table. |
| `backend/app/services/compliance/framework_mapper.py` | 302 | **Fully implemented** | Maps 16 test types to 5 compliance frameworks. NIST and FedRAMP are in enum but have no requirements loaded. |

### Visual Testing Router

| File | Lines | Prefix | Endpoints | Status |
|------|-------|--------|-----------|--------|
| `backend/app/routers/visual_testing_api.py` | 700 | `/api/visual-testing` | 15 | **All fully implemented** — zero stubs |

### Visual Testing Services

| File | Lines | Status | Role |
|------|-------|--------|------|
| `backend/app/services/automation/visual_testing_engine.py` | 1,083 | **Fully implemented** | Core engine: 6 comparison algorithms, perceptual hashing (aHash + dHash), SSIM calculator, baseline CRUD with history, diff image generation, ignore region masking, AI semantic comparison via Claude Vision |
| `backend/app/services/automation/visual_regression_service.py` | 312 | **Fully implemented** | Generates Playwright test scripts with visual regression assertions. Uses separate storage path (`screenshots/`) from main engine (`visual_testing/`). |
| `backend/app/services/engines/screenshot_analyzer.py` | 316 | **Mostly implemented** | OCR via Tesseract or Google Vision. Page title/button/label extraction. `detect_visual_changes()` is a **stub** (returns `{"changed": True, "confidence": 0.0}`). |

### Baseline Storage

| Path | Contents |
|------|----------|
| `backend/visual_testing/baselines/` | Baseline PNG images |
| `backend/visual_testing/metadata/` | Metadata JSON files (with perceptual hashes) |
| `backend/visual_testing/diffs/` | Generated diff images |
| `screenshots/baselines/` | Alternative storage path used by `visual_regression_service.py` |

---

## 5. API Endpoints

### Accessibility V1 (`/api/accessibility`) — 10 Endpoints

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| POST | `/scan` | **Real** | Run axe-core scan via subprocess + WCAG pipeline |
| POST | `/scan/site-wide` | **Stub** | TODO: Implement site-wide scanning |
| GET | `/scans` | **Stub** | TODO: Query database for scans (returns empty) |
| GET | `/scans/{scan_id}` | **Stub** | TODO: Query database for scan (returns None) |
| GET | `/issues` | **Stub** | TODO: Query database for issues (returns empty) |
| GET | `/issues/{issue_id}` | **Stub** | TODO: Query database for issue (returns None) |
| POST | `/issues/{issue_id}/fix` | **Real** | AI-generated fix suggestions |
| POST | `/vpat/generate` | **Stub** | TODO: Implement VPAT generation |
| GET | `/compliance/{project_id}` | **Stub** | TODO: Calculate compliance (returns zeros) |
| GET | `/debt/{project_id}` | **Stub** | TODO: Calculate debt (returns zeros) |

### Accessibility V2 (`/api/a11y`) — 6 Endpoints (All Real)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/a11y/scan` | Full axe-core scan via AxeCoreScanner |
| GET | `/api/a11y/report/{scan_id}` | HTML, JSON, or Markdown report |
| GET | `/api/a11y/report/{scan_id}/download` | File download with Content-Disposition |
| POST | `/api/a11y/batch-scan` | Concurrent scanning with semaphore |
| GET | `/api/a11y/batch/{batch_id}` | Batch status check |
| GET | `/api/a11y/quick-check` | Lightweight pass/fail only |

### Compliance (`/api/compliance`) — 3 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/compliance/report` | Generate compliance report (requires DB + permissions) |
| GET | `/api/compliance/report/{report_id}` | Retrieve stored report |
| GET | `/api/compliance/frameworks` | List 7 supported frameworks |

### Visual Testing (`/api/visual-testing`) — 15 Endpoints (All Real)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/compare` | Compare two images (6 modes, threshold, ignore regions) |
| POST | `/compare-by-name` | Compare against stored baseline |
| POST | `/batch-compare` | Batch comparison |
| GET | `/baselines` | List all baselines |
| GET | `/baselines/{test_name}` | Get baseline info + base64 image |
| GET | `/baselines/{test_name}/image` | Raw image file response |
| POST | `/baselines` | Save new baseline |
| PUT | `/baselines/{test_name}` | Update baseline (archives old) |
| DELETE | `/baselines/{test_name}` | Delete baseline |
| GET | `/diffs` | List diff images |
| GET | `/diffs/{filename}` | Serve diff image |
| GET | `/config` | Engine configuration |
| POST | `/upload/compare` | Multipart upload + compare |
| POST | `/upload/baseline` | Multipart upload baseline |
| POST | `/capture` | Playwright screenshot capture from URL |

---

## 6. UI Walkthrough

### Running an Accessibility Scan

1. Navigate to **Accessibility** from the sidebar.
2. Enter the target URL (e.g., `https://myapp.com`).
3. Select scan type: **Full Page** or **Component** (with CSS selector).
4. Select WCAG level: **A**, **AA** (default), or **AAA**.
5. Click **Scan** — backend runs axe-core via Playwright.
6. Results display with:
   - **Impact badges:** Critical (red), Serious (orange), Moderate (yellow), Minor (blue)
   - **WCAG criterion** (e.g., "4.1.2 Name, Role, Value")
   - **Affected element** code snippet
   - **Suggested fix** with help URL
7. Click **Export** to download JSON report.

### Visual Regression Testing

1. Navigate to **Visual Testing** from the sidebar.
2. **Create a baseline:**
   - In the **Baselines** tab, click **Add Baseline**.
   - Upload an image or enter a URL to capture a screenshot.
   - Name the baseline (e.g., "homepage_desktop").
3. **Compare:**
   - In the **Compare** tab, select comparison mode (Anti-Aliased recommended).
   - Upload or capture the "actual" screenshot.
   - Select the baseline to compare against.
   - Set threshold (default 0.1 = 10% diff tolerance).
   - Optionally define ignore regions (x, y, width, height) for dynamic content.
   - Click **Compare**.
4. **View results:**
   - Diff percentage and SSIM score.
   - Side-by-side diff image (Baseline | Diff Highlights | Actual).
   - Mismatch regions identified.
   - Pass/fail based on threshold.

---

## 7. Accessibility Scanner Deep Dive

### AxeCoreScanner (Production Scanner — 832 lines)

Three scanning strategies with automatic fallback:

| Strategy | Platform | How |
|----------|----------|-----|
| **Playwright sync** | Windows | Runs in thread pool (`asyncio.to_thread`) to avoid greenlet issues |
| **Playwright async** | Linux/Mac | Direct `async_playwright` usage |
| **HTTP + regex fallback** | Any (no Playwright) | Fetches HTML via `aiohttp`, applies regex-based checks |

**Regex fallback checks:**
- Images missing `alt` attribute
- Inputs missing labels or `aria-label`
- Buttons/links with no accessible text
- Missing `<html lang="...">`
- Missing `<title>`
- Heading hierarchy issues
- Missing ARIA landmarks

**Report generation:** Each scan produces:
- Issue count by impact (critical/serious/moderate/minor)
- Compliance score (0-100)
- Per-violation details with fix examples
- WCAG criteria descriptions
- Executive summary (Markdown)

### Compliance Framework Mapping

| Framework | Requirements Loaded | Test Types Mapped |
|-----------|-------------------|-------------------|
| PCI DSS | Yes | 16 test types |
| HIPAA | Yes | 16 test types |
| SOC 2 | Yes | 16 test types |
| GDPR | Yes | 16 test types |
| ISO 27001 | Yes | 16 test types |
| NIST | In enum only | **No requirements loaded** |
| FedRAMP | In enum only | **No requirements loaded** |

---

## 8. Visual Comparison Engine Deep Dive

### 6 Comparison Algorithms

| Algorithm | Library | Description | Best For |
|-----------|---------|-------------|----------|
| **Pixel Perfect** | NumPy | Exact pixel-by-pixel diff | Strict regression checks |
| **Anti-Aliased** | NumPy + Sobel | Edge detection + anti-aliasing tolerance (like pixelmatch) | **Recommended default** — ignores rendering differences |
| **Perceptual Hash** | PIL | aHash + dHash with Hamming distance | Same image, different encoding |
| **Structural (SSIM)** | NumPy | Structural Similarity Index (luminance, contrast, structure) | Human perception alignment |
| **Layout Only** | PIL | `ImageFilter.FIND_EDGES` + comparison | Checking layout without styling |
| **AI Semantic** | Anthropic Claude Vision | Sends both images to Claude with structured JSON prompt | Understanding what changed semantically |

### Baseline Storage Format

Each baseline consists of two files:
- `baselines/{test_name}.png` — The image file
- `metadata/{test_name}.json` — Metadata including:
  - `test_name`, `created_at`, `updated_at`
  - `viewport` (width, height)
  - `perceptual_hashes` (aHash, dHash for quick comparison)
  - `file_size`, `dimensions`
  - `history[]` — Previous versions (archived on update)

### Diff Image Format

Three-panel composite image:
```
┌─────────────┬─────────────┬─────────────┐
│  Baseline   │    Diff     │   Actual    │
│  (original) │ (magenta    │  (current)  │
│             │  highlights) │             │
└─────────────┴─────────────┴─────────────┘
```

### Ignore Regions

Define rectangular regions to mask before comparison:

```python
ignore_regions = [
    {"x": 10, "y": 10, "width": 200, "height": 50},  # Banner
    {"x": 0, "y": 400, "width": 800, "height": 100}   # Dynamic footer
]
```

Regions are painted with a neutral color before comparison to eliminate false positives from dynamic content.

---

## 9. Configuration

### Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | VisualTestingEngine | Required for AI Semantic comparison mode (Claude Vision) |
| `GOOGLE_CLOUD_VISION_KEY` | ScreenshotAnalyzer | Required for Google Vision OCR (alternative to Tesseract) |
| `DATABASE_URL` | ComplianceReporter | PostgreSQL for compliance report storage |

### Visual Testing Engine Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| `storage_path` | `visual_testing` | Base directory for baselines, metadata, diffs |
| `default_threshold` | 0.1 (10%) | Diff tolerance — below = pass, above = fail |
| `default_mode` | `anti_aliased` | Comparison algorithm |
| `aa_tolerance` | 3 | Anti-aliasing pixel tolerance |
| `color_threshold` | 0.1 | Color difference threshold |

### Dependencies

| Library | Required For | Status |
|---------|-------------|--------|
| PIL/Pillow | All visual modes | Required |
| NumPy | Anti-aliased, SSIM | Required for advanced modes |
| Playwright | Screenshot capture, axe-core scanning | Required for full scanning |
| Tesseract | OCR text extraction | Optional (falls back to regex) |
| anthropic | AI Semantic comparison | Optional |
| msal | MS 365 accessibility scanning auth | Optional |

---

## 10. Known Gaps & TODOs

### Accessibility Stubs (V1 API)

| Endpoint | Issue |
|----------|-------|
| `POST /api/accessibility/scan/site-wide` | **Stub** — `TODO: Implement site-wide scanning` |
| `GET /api/accessibility/scans` | **Stub** — returns empty list |
| `GET /api/accessibility/scans/{id}` | **Stub** — returns None |
| `GET /api/accessibility/issues` | **Stub** — returns empty list |
| `GET /api/accessibility/issues/{id}` | **Stub** — returns None |
| `POST /api/accessibility/vpat/generate` | **Stub** — `TODO: Implement VPAT generation` |
| `GET /api/accessibility/compliance/{id}` | **Stub** — returns zeros |
| `GET /api/accessibility/debt/{id}` | **Stub** — returns zeros |

**Recommendation:** Use the V2 API (`/api/a11y/*`) which is fully implemented.

### Visual Testing Stubs

| Component | Issue |
|-----------|-------|
| `screenshot_analyzer.py` `detect_visual_changes()` | **Stub** — returns `{"changed": True, "confidence": 0.0}` |

### Architecture Concerns

| Issue | Details |
|-------|---------|
| **Two parallel accessibility APIs** | V1 (`/api/accessibility/`) has 6 stubs; V2 (`/api/a11y/`) is complete. Should deprecate V1. |
| **Two parallel baseline storage paths** | `visual_testing_engine.py` uses `visual_testing/` directory; `visual_regression_service.py` uses `screenshots/`. Can cause confusion. |
| **In-memory scan results** | V2 scanner stores results in `_scan_results` dict with comment "in production, use Redis or DB." Lost on restart. |
| **Compliance DB table** | `compliance_reports` table may need migration — not listed in deployment rule's 15 tables. |
| **NIST and FedRAMP** | Listed in compliance framework enum but have **no requirements loaded** in `_load_framework_requirements()`. |
| **Debug logging** | `Accessibility.tsx` contains `console.log('[A11y Debug]')` statements that should be removed for production. |

---

*Last updated: 2026-02-08*
*Generated by code audit of the Flowstral accessibility and visual testing features.*
