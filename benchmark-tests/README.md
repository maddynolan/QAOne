# QA AI Platform - Benchmark Test Suite

## Overview

This benchmark suite demonstrates the **98% stability claim** by comparing:
- **Legacy Approach**: Brittle selectors (Layer 4/5) that break easily
- **QA AI Platform**: 5-layer selector strategy + self-healing (98%+ success)

## 10 Complex Enterprise Test Scenarios

1. **Financial Trading Portal** - Dynamic ID re-render
2. **B2B CMS** - Drag-and-drop (not pixel coordinates)
3. **CRM Dashboard** - Virtualized table indexing
4. **Insurance Form** - Race condition (disabled button)
5. **Healthcare Portal** - iFrame context switching
6. **Analytics Tool** - SVG icon instability
7. **E-Commerce** - Promotional pop-up interruption
8. **Job Portal** - Hidden file input
9. **Collaboration Tool** - Async content rendering
10. **Cloud Console** - Dynamic text capitalization

## Setup

### 1. Start Benchmark Application

```bash
# Option 1: Serve with Python
cd benchmark-app
python -m http.server 8080

# Option 2: Serve with Node.js
npx serve -p 8080 benchmark-app
```

### 2. Install Dependencies

```bash
pip install playwright
playwright install chromium
```

### 3. Run Tests

#### Run Legacy Tests (Expected: ~0-20% success)
```bash
cd benchmark-tests
python test_legacy_approach.py
```

#### Run QA AI Platform Tests (Expected: ~98%+ success)
```bash
python test_qaai_approach.py
```

#### Run Full Comparison
```bash
python run_benchmark_comparison.py
```

## Expected Results

### Legacy Approach
- **Success Rate**: 0-20%
- **Failure Reasons**: Dynamic IDs, pixel coordinates, XPath indexing, race conditions, etc.

### QA AI Platform
- **Success Rate**: 98%+
- **Why It Works**: 
  - Layer 2 (Role/Name) instead of Layer 5 (ID)
  - Semantic dragTo() instead of pixel coordinates
  - Text + relative locators instead of XPath
  - Dynamic waits (toBeEnabled) instead of fixed delays
  - iframe title instead of generic ID

## Benchmark Report

After running the comparison, you'll get:
- `benchmark_report.json` - Machine-readable results
- `benchmark_report.md` - Human-readable report

## Demonstration Video Script

1. Show legacy test failing (0-20% success)
2. Show same test with QA AI Platform passing (98%+ success)
3. Highlight the healing mechanisms:
   - "Notice how it uses role='button' instead of the ID"
   - "See how it waits for the button to be enabled"
   - "Watch it handle the popup automatically"

## Sales Assets

This benchmark provides:
- ✅ **Quantifiable proof** of 98% stability
- ✅ **Before/After comparison** (legacy vs QA AI)
- ✅ **Video demonstration** material
- ✅ **Technical validation** for enterprise clients

---

**Status**: Ready for testing  
**Last Updated**: 2025-01-XX

