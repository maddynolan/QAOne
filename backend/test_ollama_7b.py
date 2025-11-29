"""Quick test to verify 7B model connection"""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
import os

# Load .env - try multiple locations BEFORE importing services
env_paths = [
    Path(__file__).parent.parent / '.env',  # Root .env
    Path(__file__).parent / '.env',  # Backend .env
    Path('.env')  # Current directory
]

loaded = False
for env_path in env_paths:
    if env_path.exists():
        load_dotenv(env_path, override=True)
        print(f"[OK] Loaded .env from: {env_path}")
        loaded = True
        break

if not loaded:
    # Try loading from current directory as fallback
    load_dotenv(override=True)
    print(f"[WARN] Using default .env loading")

# Verify OLLAMA_URL is loaded
ollama_url = os.getenv('OLLAMA_URL', 'NOT SET')
print(f"\n[INFO] OLLAMA_URL from environment: {ollama_url}")

# Set it explicitly if it's in .env but not loaded
if ollama_url == 'NOT SET':
    # Try reading .env directly
    root_env = Path(__file__).parent.parent / '.env'
    if root_env.exists():
        with open(root_env, 'r') as f:
            for line in f:
                if line.startswith('OLLAMA_URL='):
                    url = line.split('=', 1)[1].strip()
                    os.environ['OLLAMA_URL'] = url
                    print(f"[FIX] Manually set OLLAMA_URL to: {url}")
                    break

# NOW import services AFTER .env is loaded
from app.services.ollama_service import OllamaService

# Create service
service = OllamaService()
print(f"[INFO] OllamaService.ollama_base_url: {service.ollama_base_url}")
print(f"[INFO] OllamaService.ollama_api_url: {service.ollama_api_url}")
print(f"[INFO] Test case model: {service.test_case_model}")
print(f"[INFO] Use 7B for test cases: {service.use_7b_for_test_cases}")

# Test model selection
selected = service._select_model(mode="quick", task_type="test_design", use_fast_model=True)
print(f"\n[INFO] Selected model: {selected}")

# Test direct API call
import asyncio
async def test():
    await service.initialize()
    try:
        result = await service.generate(
            prompt="Say hello",
            mode="quick",
            task_type="test_design",
            use_fast_model=True
        )
        print(f"\n[SUCCESS] Model used: {result.get('model', 'unknown')}")
        print(f"[SUCCESS] Response: {result.get('response', '')[:100]}")
    except Exception as e:
        print(f"\n[ERROR] {e}")
    finally:
        await service.cleanup()

asyncio.run(test())

