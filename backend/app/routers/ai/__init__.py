"""
AI Module Routers

AI-powered test generation, automation, self-healing, vision analysis,
LLM gateway, and agent orchestration. Includes the 4-layer healing chain
(Knowledge, Deterministic, Vision AI, OCR) and false positive detection.

Routers:
- ai_generation_api: /ai/* - AI test generation (28 endpoints)
- llm_api: /api/llm/* - LLM gateway and model management
- models_api: /api/models/* - AI model configuration
- agents_api: /api/agents/* - Agent management and orchestration
- agent_websocket: /ws/agent - Agent WebSocket communication
- ocr_fallback_api: /api/ocr/* - OCR text extraction fallback

Conditionally loaded (try/except in main.py):
- ai_automation_api: /ai-automation/* - Element resolution, failure analysis
- ai_enhancements_api: /api/ai/enhancements/* - Auto-fix, false positives, flaky detection
- ai_testing: /api/ai-testing/* - AI-powered test execution
- vision_healing_api: /api/vision/* - Vision-based selector healing
"""
from .ai_generation_api import router as ai_generation_router
from .llm_api import router as llm_router
from .models_api import router as models_router
from .agents_api import router as agents_router
from .agent_websocket import router as agent_ws_router
from .ocr_fallback_api import router as ocr_fallback_router

# These routers are loaded conditionally (try/except) in main.py
# from .ai_automation_api import router as ai_automation_router
# from .ai_enhancements_api import router as ai_enhancements_router
# from .ai_testing import router as ai_testing_router
# from .vision_healing_api import router as vision_healing_router
