#!/usr/bin/env python3
"""
Quick diagnostic script to check for Flowstral errors
Run this to verify all imports and common issues
"""

import sys
import os

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

print("🔍 Checking Flowstral imports and dependencies...\n")

errors = []
warnings = []

# Check 1: Basic imports
try:
    from app.services.flowstral_artifacts import FlowstralArtifactsGenerator
    print("✅ FlowstralArtifactsGenerator imports OK")
except Exception as e:
    errors.append(f"FlowstralArtifactsGenerator: {e}")
    print(f"❌ FlowstralArtifactsGenerator: {e}")

try:
    from app.services.flowstral_websocket_manager import flowstral_ws_manager
    print("✅ FlowstralWebSocketManager imports OK")
except Exception as e:
    errors.append(f"FlowstralWebSocketManager: {e}")
    print(f"❌ FlowstralWebSocketManager: {e}")

try:
    from app.services.flowstral_orchestrator import FlowstralOrchestrator
    print("✅ FlowstralOrchestrator imports OK")
except Exception as e:
    errors.append(f"FlowstralOrchestrator: {e}")
    print(f"❌ FlowstralOrchestrator: {e}")

try:
    from app.routers.flowstral_api import router
    print("✅ Flowstral API router imports OK")
except Exception as e:
    errors.append(f"Flowstral API router: {e}")
    print(f"❌ Flowstral API router: {e}")

# Check 2: Type hints
try:
    from typing import Callable
    print("✅ Callable type hint available")
except Exception as e:
    errors.append(f"Callable type: {e}")
    print(f"❌ Callable type: {e}")

# Check 3: Instantiation
try:
    gen = FlowstralArtifactsGenerator()
    print("✅ FlowstralArtifactsGenerator can be instantiated")
except Exception as e:
    errors.append(f"FlowstralArtifactsGenerator instantiation: {e}")
    print(f"❌ FlowstralArtifactsGenerator instantiation: {e}")

try:
    orch = FlowstralOrchestrator()
    print("✅ FlowstralOrchestrator can be instantiated")
except Exception as e:
    errors.append(f"FlowstralOrchestrator instantiation: {e}")
    print(f"❌ FlowstralOrchestrator instantiation: {e}")

# Check 4: Main app import
try:
    from app.main import app
    print("✅ Main app imports OK")
except Exception as e:
    errors.append(f"Main app: {e}")
    print(f"❌ Main app: {e}")

# Summary
print("\n" + "="*60)
if errors:
    print(f"❌ Found {len(errors)} error(s):")
    for i, error in enumerate(errors, 1):
        print(f"  {i}. {error}")
    sys.exit(1)
else:
    print("✅ All checks passed! No import errors found.")
    print("\n💡 If you're still seeing errors in the backend:")
    print("   1. Check the backend terminal output (where uvicorn is running)")
    print("   2. Look for runtime errors (not import errors)")
    print("   3. Restart the backend: cd backend && python -m uvicorn app.main:app --reload")
    sys.exit(0)



