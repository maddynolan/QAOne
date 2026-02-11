# Change Plan: AI Step Guarantor Integration

## Problem
When all deterministic element-finding strategies fail (SimpleElementFinder, SmartFinder, Iframe search), the only AI fallback is a rudimentary screenshot → pixel coordinates approach via GPT-4o-mini. This has critical gaps:
1. Returns coordinates, not selectors → not cacheable, not reusable
2. Only uses vision (expensive), never analyzes DOM (cheap)
3. No post-action verification → false positives go undetected
4. No auto-correction → user manually flags and fixes

## Root Cause Analysis
The existing `ai-fallback.js` only performs vision-based coordinate finding. There is no DOM analysis path, no post-action verification, and no strategy caching for AI-discovered selectors.

## Affected Code Paths
1. `flowstral-desktop/src/main/lib/simple-step-executor.js` — Phase 4 replaced with AI Guarantor
2. `flowstral-desktop/src/main/lib/ai-fallback.js` — Still used, but via Guarantor wrapper
3. `flowstral-desktop/src/main/lib/strategy-memory.js` — AI selectors now cached here
4. `flowstral-desktop/src/main/playwright-recorder.js` — Reset + summary + AI flags in events
5. `backend/app/routers/vision_healing_api.py` — New DOM resolution endpoint
6. `src/pages/PlaywrightRecorderPage.tsx` — AI badge display + summary footer

## Invariants Preserved
- [x] Lock Locators still tracks workingSelector + strategyType
- [x] Self-healing (healed + newSelector) unchanged
- [x] IPC events include all existing fields + new AI fields
- [x] Non-element actions still delegated unchanged
- [x] Tab switching, iframe scoping unchanged
- [x] All existing action handlers (click cascade, fill cascade, etc.) unchanged
- [x] Strategy memory persistence unchanged (AI selectors added to same store)

## New Files
| File | Purpose |
|------|---------|
| `flowstral-desktop/src/main/lib/ai-dom-resolver.js` | Pruned DOM → GPT-4o-mini → CSS selector |
| `flowstral-desktop/src/main/lib/ai-post-action-verifier.js` | Post-action verification + auto-correction |
| `flowstral-desktop/src/main/lib/ai-step-guarantor.js` | Orchestrator: DOM Resolver + Vision + Verifier |

## Modified Files
| File | Change |
|------|--------|
| `simple-step-executor.js` | Phase 4 → AI Guarantor + post-action verification |
| `playwright-recorder.js` | Reset guarantor, AI flags in events, summary log |
| `vision_healing_api.py` | New `/api/ai/dom/resolve-element` endpoint |
| `PlaywrightRecorderPage.tsx` | AI badge display, summary counter |

## Pipeline (New)
```
Phase 1: SimpleElementFinder (parallel Playwright-native, ~3-8s)
Phase 2: SmartFinder Healing (shadow DOM, SF-aware, ~8s)
Phase 3: Iframe brute-force search
Phase 4.5: AI DOM Resolver (text LLM → CSS selector, ~$0.0003)   ← NEW
Phase 5: AI Vision Fallback (screenshot → coordinates, ~$0.003)   ← ENHANCED
─── Action Execution ───
Post-Action: Verification (local DOM checks, FREE)                ← NEW
Post-Action: Auto-Correction (retry with alternative, FREE)       ← NEW
```

## Cost Analysis
| Component | Cost per call | When triggered |
|-----------|--------------|----------------|
| DOM Resolver | ~$0.0003 | When phases 1-3 fail |
| Vision Fallback | ~$0.003 | When DOM resolver also fails |
| Verification | FREE | After every element action |
| Auto-Correction | FREE | When verification catches false positive |
| **Worst case per 20-step test** | **~$0.066** | All steps need AI |
| **Typical per 20-step test** | **~$0.003** | 1-2 steps need AI |

## Risk Assessment
- **Low risk**: All AI is ADDITIVE — existing deterministic pipeline runs first
- **Low risk**: AI flags don't affect pass/fail — they're metadata only
- **Low risk**: Budget cap (15 calls/run) prevents runaway costs
- **Medium risk**: DOM pruning might miss elements in complex shadow DOM — mitigated by vision fallback
- **No risk to recording**: All changes are in playback pipeline only
