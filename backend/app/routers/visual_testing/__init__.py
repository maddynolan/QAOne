"""
Visual Testing Module Routers

Visual regression testing with 6 comparison modes (pixel_perfect,
anti_aliased, perceptual, structural/SSIM, layout, ai_semantic).
Includes baseline management, diff visualization, and batch comparison.

Routers:
- visual_testing_api: /api/visual-testing/* - Compare, baselines, capture, diffs (15 endpoints)
"""
from .visual_testing_api import router as visual_testing_router
