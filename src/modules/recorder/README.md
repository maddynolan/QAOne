# Recorder

Browser test recording, playback, AI self-healing, and element management. This is the core module for capturing user interactions and producing reliable, maintainable Playwright test scripts with intelligent selector healing.

## Architecture

The recorder module follows a three-tier architecture:

1. **Recording** -- User interactions are captured via the Chrome extension (CDP or Playwright mode) and streamed to the backend through WebSocket/REST endpoints.
2. **Playback & Validation** -- Recorded steps are replayed via Playwright automation. Failed steps trigger the 4-layer AI healing chain (Knowledge, Deterministic, Vision AI, OCR).
3. **Repair & Assist** -- When automatic healing fails, the ManualAssistCard provides three manual repair modes (Paste Element, Enter Selector, Paste Screenshot). The ElementRepairWizard offers an advanced 4-tab dialog for complex cases.

Key state is managed locally within `PlaywrightRecorderPage` (the largest page in the codebase at ~10,800 lines) using React state and refs. AI enhancement API calls are centralized in `lib/aiEnhancements.ts`.

## File Inventory

### Pages

| File | Lines | Purpose |
|------|-------|---------|
| `pages/PlaywrightRecorderPage.tsx` | 10,858 | Main recorder page -- step list, recording controls, playback, AI auto-fix, test result modal, false positive management |
| `pages/SelfHealing.tsx` | 355 | Self-healing configuration and history dashboard |
| `pages/ElementRepository.tsx` | 678 | Stored element repository with search, tagging, and reuse |

### Components

| File | Lines | Purpose |
|------|-------|---------|
| `components/ManualAssistCard.tsx` | 466 | Inline 3-tab card (Paste Element, Enter Selector, Paste Screenshot) for manual step fixing when AI fails |
| `components/ElementRepairWizard.tsx` | 1,602 | Advanced 4-tab repair dialog (Manual, Pick, Debug, AI) for complex element repair |
| `components/AITestGenerator.tsx` | 548 | AI-powered test case generation from recorded sessions |
| `components/QuickRerecordModal.tsx` | 449 | Modal to quickly re-record a subset of failed steps |
| `components/BlackboxLocatorStrategies.tsx` | 833 | Displays and ranks locator strategies for elements |
| `components/StepAutomationLinker.tsx` | 921 | Links recorded steps to automation framework actions |
| `components/SmartFillDialog.tsx` | 523 | AI-assisted form filling dialog for test data generation |
| `components/confidence/ConfidenceBadge.tsx` | 78 | Badge showing selector confidence score |
| `components/confidence/MatchCountBadge.tsx` | 88 | Badge showing number of DOM elements matching a selector |
| `components/confidence/StepConfidenceIndicator.tsx` | 66 | Inline confidence indicator for individual test steps |
| `components/confidence/index.ts` | -- | Barrel export for confidence sub-components |

### Lib

| File | Lines | Purpose |
|------|-------|---------|
| `lib/aiEnhancements.ts` | 489 | API helpers: `autoFixStep()`, `detectFalsePositive()`, `explainFailure()`, `manualAssistPasteElement()`, `manualAssistEnterSelector()`, `manualAssistScreenshot()`, `saveFalsePositive()`, `removeFalsePositive()`, `getFalsePositives()`, `getFlakySteps()` |
| `lib/automation-linking.ts` | 636 | Automation framework linking logic -- maps recorded actions to framework-specific commands |
| `lib/failureClassification.ts` | 181 | Classifies test step failures by type (element not found, timeout, assertion, etc.) |

### Module Entry

| File | Purpose |
|------|---------|
| `index.ts` | Barrel exports for pages, components, and lib utilities |

## API Endpoints Consumed

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/playwright/recorder/events` | POST | Send recorded browser events |
| `/api/playwright/code` | GET | Retrieve generated Playwright code |
| `/api/playwright/recorder/start` | POST | Start Playwright recording session |
| `/api/playwright/recorder/stop` | POST | Stop recording session |
| `/api/flowstral/start-recording` | POST | Start Flowstral pipeline recording |
| `/api/flowstral/stop-recording` | POST | Stop Flowstral recording |
| `/api/ai/enhancements/auto-fix-step` | POST | AI auto-fix a broken step (4-layer healing chain) |
| `/api/ai/enhancements/manual-assist` | POST | Manual assist: parse HTML / validate selector / screenshot AI |
| `/api/ai/enhancements/false-positive` | POST | Save false positive flag |
| `/api/ai/enhancements/false-positive/{test_id}/{step_id}` | DELETE | Remove false positive flag |
| `/api/ai/enhancements/false-positives/{test_id}` | GET | Get all false positive flags for a test |
| `/api/ai/enhancements/flaky-steps/{test_id}` | GET | Get flaky step detection info |
| `/api/ai/enhancements/explain-failure` | POST | AI failure explanation with fix suggestions |
| `/api/ai/enhancements/detect-false-positive` | POST | Vision-based false positive detection |
| `/cdp-recorder/start` | POST | Start CDP recording |
| `/cdp-recorder/stop` | POST | Stop CDP recording |

## Dependencies

- **Internal**: `@/lib/api-config` (API base URL), `@/components/ui/*` (shadcn/ui primitives), `@/contexts/AuthContext`
- **External**: React 18, Tailwind CSS, Radix UI, Lucide icons, Axios

## Testing Notes

- The PlaywrightRecorderPage is the single largest frontend file; changes require careful regression testing of recording, playback, auto-fix, and manual assist flows.
- AI auto-fix tests require a running backend with `OPENAI_API_KEY` configured for Vision AI and OCR layers.
- False positive persistence must survive page refresh -- verify flags are loaded on mount via `getFalsePositivesApi()`.
- ManualAssistCard paste_element mode depends on `dom_element_parser.py` backend service parsing arbitrary HTML correctly.
- Confidence badge components are lightweight presentational components and can be tested in isolation.
