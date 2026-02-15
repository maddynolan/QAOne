"""
Performance Testing Module Routers

Load testing, protocol recording, and scale APIs.
Virtual user simulation with 8 load patterns (constant, ramp, spike, stress,
soak, breakpoint, wave, custom), HTTP traffic capture, and paginated queries
for high-volume test data.

Routers:
- performance_api: /performance/* - Load testing engine and metrics (80 endpoints)
- protocol_recording_api: /api/protocol-recording/* - HTTP traffic capture (13 endpoints)
- scale_api: /api/v2/* - Paginated queries for 100K+ test cases (8 endpoints)
"""
from .performance_api import router as performance_router
from .protocol_recording_api import router as protocol_recording_router
from .scale_api import router as scale_api_router
