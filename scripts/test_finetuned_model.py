#!/usr/bin/env python3
"""
Test Fine-Tuned Model Integration
Quick script to verify the fine-tuned model is working
"""

import asyncio
import sys
import os
from pathlib import Path

# Add backend to path
backend_path = Path(__file__).parent.parent / "backend"
sys.path.insert(0, str(backend_path))

from app.services.ollama_service import OllamaService

async def test_model():
    """Test fine-tuned model generation"""
    print("=" * 60)
    print("🧪 Testing Fine-Tuned Model Integration")
    print("=" * 60)
    print()
    
    # Initialize service
    service = OllamaService()
    await service.initialize()
    
    try:
        # Test 1: Check model selection
        print("Test 1: Model Selection")
        print("-" * 60)
        
        # Test with quick mode (should use fine-tuned)
        model_quick = service._select_model(mode="quick")
        print(f"  Quick mode: {model_quick}")
        
        # Test with no mode (should use fine-tuned if enabled)
        model_default = service._select_model()
        print(f"  Default mode: {model_default}")
        
        # Test with UI mode (should use base 14B)
        model_ui = service._select_model(mode="ui")
        print(f"  UI mode: {model_ui}")
        
        print()
        
        # Test 2: Generate test cases
        print("Test 2: Generate Test Cases")
        print("-" * 60)
        
        prompt = """You are an expert QA engineer. Generate comprehensive test cases from the following requirements.

Requirements:
Test user login on saucedemo.com

Generate test cases in JSON format. Each test case should have:
- name: Clear test case name
- description: Detailed description
- steps: Array of {"action": "...", "expectedResult": "..."}
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags

Respond ONLY with valid JSON array:
[
  {
    "name": "string",
    "description": "string",
    "steps": [{"action": "string", "expectedResult": "string"}],
    "priority": "string",
    "tags": ["string"]
  }
]"""
        
        print("  Generating test cases...")
        print("  (This may take 10-30 seconds)")
        print()
        
        result = await service.generate_json(
            prompt,
            mode="quick",  # Should use fine-tuned model
            max_retries=3
        )
        
        print("  ✅ Generation successful!")
        print(f"  Model used: {result.get('model', 'unknown')}")
        print()
        
        # Display results
        if isinstance(result, dict) and 'response' in result:
            import json
            try:
                parsed = json.loads(result['response']) if isinstance(result['response'], str) else result['response']
                print(f"  Generated {len(parsed) if isinstance(parsed, list) else 1} test case(s)")
                if isinstance(parsed, list) and len(parsed) > 0:
                    print(f"  First test case: {parsed[0].get('name', 'N/A')}")
            except:
                print(f"  Response preview: {str(result['response'])[:200]}...")
        else:
            print(f"  Response: {result}")
        
        print()
        
        # Test 3: Verify model name
        print("Test 3: Model Verification")
        print("-" * 60)
        
        if "qa-expert" in model_quick.lower():
            print("  ✅ Fine-tuned model is being used!")
        else:
            print(f"  ⚠️  Using base model: {model_quick}")
            print("  💡 Check USE_FINETUNED_MODEL environment variable")
        
        print()
        print("=" * 60)
        print("✅ Testing Complete!")
        print("=" * 60)
        
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        await service.cleanup()
    
    return True

if __name__ == "__main__":
    print()
    print("🔧 Configuration:")
    print(f"  OLLAMA_URL: {os.getenv('OLLAMA_URL', 'http://localhost:11434')}")
    print(f"  USE_FINETUNED_MODEL: {os.getenv('USE_FINETUNED_MODEL', 'true')}")
    print(f"  FINETUNED_MODEL_NAME: {os.getenv('FINETUNED_MODEL_NAME', 'qa-expert:7b')}")
    print()
    
    success = asyncio.run(test_model())
    sys.exit(0 if success else 1)






