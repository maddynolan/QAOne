"""Test OllamaService directly"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# CRITICAL: Set OLLAMA_URL before importing
from dotenv import load_dotenv
import os

load_dotenv('.env', override=True)
if not os.getenv('OLLAMA_URL'):
    os.environ['OLLAMA_URL'] = 'http://localhost:31143'
    print(f"[FIX] Set OLLAMA_URL to: {os.getenv('OLLAMA_URL')}")

from app.services.llm.ollama_service import OllamaService

async def test():
    service = OllamaService()
    print(f"\n[INFO] Ollama URL: {service.ollama_base_url}")
    
    await service.initialize()
    
    try:
        print("\n[TEST] Simple prompt...")
        result = await service.generate('Say hello', use_fast_model=True)
        print(f"Result type: {type(result)}")
        print(f"Result keys: {list(result.keys()) if isinstance(result, dict) else 'N/A'}")
        print(f"Response length: {len(result.get('response', ''))}")
        print(f"Response: {result.get('response', '')[:200]}")
        print(f"Model: {result.get('model', 'N/A')}")
        
        if result.get('response'):
            print("\n[SUCCESS] Got response!")
        else:
            print("\n[FAIL] Empty response!")
            
    except Exception as e:
        print(f"\n[ERROR] Exception: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await service.cleanup()

if __name__ == "__main__":
    asyncio.run(test())



