# AI Routers

Backend API routers for all AI/LLM-powered capabilities including test generation, self-healing, vision-based analysis, OCR fallback, agent orchestration, and model management. This is the largest AI surface area with 95 endpoints.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `ai_generation_api.py` | 2,933 | `/ai` | 28 | AI test generation, triage, model gateway, natural language processing |
| `ai_enhancements_api.py` | 867 | `/api/ai/enhancements` | 14 | Auto-fix steps (4-layer healing chain), false positives, flaky detection, manual assist, failure explanation |
| `vision_healing_api.py` | 545 | `/api/ai/vision` | 9 | Vision-based self-healing using screenshot analysis |
| `ai_automation_api.py` | 474 | `/ai-automation` | 9 | Element resolution, failure analysis, budget-controlled AI calls |
| `ai_testing.py` | 358 | `/api/ai-testing` | 4 | AI-powered test execution and exploratory testing |
| `agent_websocket.py` | 313 | -- | 7 | WebSocket agent registration, commands, heartbeat |
| `llm_api.py` | 281 | `/api/llm` | 9 | LLM provider configuration, prompt management, completion |
| `ocr_fallback_api.py` | 280 | `/api/ocr` | 5 | OCR-based text extraction from screenshots (Tesseract) |
| `models_api.py` | 187 | `/ai/models` | 6 | AI model listing, selection, and configuration |
| `agents_api.py` | 94 | `/agents` | 4 | Agent lifecycle management (create, list, status, delete) |

**Total: 95 endpoints across 10 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/ai/generate-tests` | POST | ai_generation_api | Generate test cases from requirements |
| `/ai/chat` | POST | ai_generation_api | Conversational AI for test authoring |
| `/api/ai/enhancements/auto-fix-step` | POST | ai_enhancements_api | AI auto-fix broken step (4-layer healing chain) |
| `/api/ai/enhancements/manual-assist` | POST | ai_enhancements_api | Manual assist: parse HTML / validate selector / screenshot AI |
| `/api/ai/enhancements/false-positive` | POST/DELETE | ai_enhancements_api | False positive flag management |
| `/api/ai/enhancements/flaky-steps/{id}` | GET | ai_enhancements_api | Flaky step detection |
| `/api/ai/vision/heal` | POST | vision_healing_api | Vision-based selector healing |
| `/api/ocr/find-text` | POST | ocr_fallback_api | OCR text extraction from screenshot |
| `/ai-automation/resolve-element` | POST | ai_automation_api | AI element resolution with budget control |

## Self-Healing Chain (via ai_enhancements_api)

1. **Knowledge Layer** -- `SelfHealingController.get_healing_suggestions()` (0ms, JSON lookup)
2. **Deterministic Layer** -- `_generate_alternative_selectors()` (0ms, string transforms)
3. **Vision AI Layer** -- `VisionSelfHealingService.heal_broken_selector()` (2-5s, requires screenshot + OPENAI_API_KEY)
4. **OCR Layer** -- `find_text_in_screenshot()` (500ms, requires screenshot + Tesseract)

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/ai/` | Test generation, failure analysis, rewriting |
| `backend/app/services/llm/` | LLM provider abstraction, prompt caching |
| `backend/app/services/automation/` | HealingOrchestrator, vision self-healing, selector engine |
| `backend/app/services/agents/` | AI agent orchestration |

## Related Frontend Modules

- `src/modules/recorder/` -- Auto-fix, manual assist, false positive UI (via aiEnhancements.ts)
- `src/modules/ai-testing/` -- AI chat testing, explorer agent, Flowpilot
