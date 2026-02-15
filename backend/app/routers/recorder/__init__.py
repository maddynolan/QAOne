"""
Recorder Module Routers

Browser test recording, playback, and automation.
Handles Playwright recording, CDP recording, and Flowstral pipeline.

Routers:
- playwright_recorder_api: /api/playwright/* - Main recording (44 endpoints)
- cdp_recorder_api: /cdp-recorder/* - Chrome DevTools Protocol recording
- flowstral_engine_api: /api/flowstral/engine/* - Flowstral engine operations
- flowstral_api: /api/flowstral/* - Flowstral session management (disabled)
- flowstral_config_api: /api/flowstral/config/* - Flowstral configuration (disabled)
"""
from .playwright_recorder_api import router as playwright_recorder_router
from .cdp_recorder_api import router as cdp_recorder_router
from .flowstral_engine_api import router as flowstral_engine_router
# flowstral_api and flowstral_config_api are currently commented out in main.py
