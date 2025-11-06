#!/usr/bin/env python3
"""
Optimized Data Collection - Uses 7B model for speed, processes sequentially
"""

import json
import os
import sys
import time
import requests
from typing import List, Dict, Any, Optional
from datetime import datetime
from automated_data_collection import AutomatedDataCollector, SAMPLE_REQUIREMENTS

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8001")
REQUEST_TIMEOUT = 300  # 5 minutes
DELAY_BETWEEN_REQUESTS = 10  # 10 seconds to avoid overwhelming


class OptimizedCollector(AutomatedDataCollector):
    """Optimized collector using 7B model for speed"""
    
    def generate_test_case(self, requirement: Dict[str, Any], test_type: str) -> Optional[Dict[str, Any]]:
        """Generate using 7B model for faster responses"""
        org_id = "00000000-0000-0000-0000-000000000000"
        project_id = "11111111-1111-1111-1111-111111111111"
        endpoint = "/ai/generate-tests-enhanced"
        
        requirement_text = f"""Title: {requirement['title']}
Description: {requirement['description']}

Generate comprehensive test cases following QA best practices:

TEST CASE NAMING: TC_[Feature]_[Scenario]_[ExpectedResult]
COVERAGE: Happy path, negative cases, edge cases, boundary conditions
STEPS: 3-7 steps, action verbs, specific data values
"""
        
        payload = {
            "org_id": org_id,
            "project_id": project_id,
            "requirement": requirement_text,
            "test_type": test_type,
            "mode": "quick"  # Use 7B for faster responses (2-3x faster than 14B)
        }
        
        try:
            response = requests.post(f"{BASE_URL}{endpoint}", json=payload, timeout=REQUEST_TIMEOUT)
            if response.ok:
                result = response.json()
                test_cases = result.get("test_cases") or result.get("cases") or []
                if test_cases:
                    output = json.dumps(test_cases, indent=2)
                else:
                    output = (result.get("output") or 
                             result.get("response") or 
                             result.get("tests") or
                             result.get("code") or
                             json.dumps(result.get("testCases", [])) or
                             "")
                
                audit = result.get("audit", {})
                generation_id = (result.get("generation_id") or 
                                audit.get("generation_id") or
                                result.get("id") or
                                None)
                
                model = audit.get("model") if audit else result.get("model", "unknown")
                
                return {
                    "success": True,
                    "generation_id": generation_id,
                    "output": output if isinstance(output, str) else json.dumps(output),
                    "test_type": test_type,
                    "requirement": requirement,
                    "model": model,
                    "raw_response": result
                }
            else:
                return {
                    "success": False,
                    "error": f"HTTP {response.status_code}: {response.text[:200]}",
                    "test_type": test_type
                }
        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": f"Request timeout after {REQUEST_TIMEOUT}s",
                "test_type": test_type
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "test_type": test_type
            }
    
    def collect_optimized(self, requirements: List[Dict[str, Any]], target_count: int = 500):
        """Collect data with optimized settings"""
        print("=" * 70)
        print("🚀 OPTIMIZED DATA COLLECTION")
        print("=" * 70)
        print(f"Strategy: Using 7B model for speed (2-3x faster)")
        print(f"Target: {target_count} examples")
        print(f"Delay: {DELAY_BETWEEN_REQUESTS}s between requests")
        print(f"Timeout: {REQUEST_TIMEOUT}s per request\n")
        
        # Verify backend is working before starting
        print("🔍 Verifying backend is working...")
        try:
            health = requests.get(f"{BASE_URL}/health", timeout=5)
            if not health.ok:
                print("  ❌ Backend health check failed!")
                print("  💡 Please restart backend and try again")
                return
        except Exception as e:
            print(f"  ❌ Backend not reachable: {e}")
            print("  💡 Please start backend and try again")
            return
        
        # Test a single request to verify no errors
        print("  ⏳ Testing single request...")
        test_payload = {
            "org_id": "00000000-0000-0000-0000-000000000000",
            "project_id": "11111111-1111-1111-1111-111111111111",
            "requirement": "Test verification",
            "test_type": "manual",
            "mode": "quick"
        }
        try:
            test_response = requests.post(
                f"{BASE_URL}/ai/generate-tests-enhanced",
                json=test_payload,
                timeout=180
            )
            if not test_response.ok:
                error_text = test_response.text[:200]
                if "asyncio" in error_text:
                    print("  ❌ Backend still has asyncio error!")
                    print("  💡 Please RESTART backend to apply fix")
                    return
                else:
                    print(f"  ⚠️  Backend error: {error_text}")
                    print("  💡 Check backend logs")
                    return
            print("  ✅ Backend is working correctly!\n")
        except Exception as e:
            print(f"  ❌ Backend test failed: {e}")
            print("  💡 Please restart backend and try again")
            return
        
        collected = 0
        batch_num = 0
        
        while collected < target_count:
            batch_num += 1
            batch_requirements = requirements[:min(len(requirements), target_count - collected)]
            
            print(f"\n{'='*70}")
            print(f"BATCH {batch_num} - Processing {len(batch_requirements)} examples")
            print(f"Progress: {collected}/{target_count} ({collected*100//target_count if target_count > 0 else 0}%)")
            print(f"{'='*70}\n")
            
            for i, req in enumerate(batch_requirements, 1):
                test_type = req.get("test_type", "manual")
                print(f"[{i}/{len(batch_requirements)}] {test_type}: {req['title'][:50]}...")
                
                result = self.generate_test_case(req, test_type)
                
                if not result or not result.get("success"):
                    error_msg = result.get('error', 'unknown') if result else 'no result'
                    print(f"  ❌ Failed: {error_msg}")
                    
                    # Check for critical errors that require backend restart
                    if "asyncio" in str(error_msg).lower():
                        print(f"\n  🚨 CRITICAL: Backend has asyncio error!")
                        print(f"  💡 Please RESTART backend and try again")
                        print(f"\n  📊 Progress before stopping: {collected}/{target_count} examples")
                        return
                    
                    self.stats["failed"] += 1
                    if i < len(batch_requirements):
                        print(f"  ⏸️  Waiting {DELAY_BETWEEN_REQUESTS}s before next...\n")
                        time.sleep(DELAY_BETWEEN_REQUESTS)
                    continue
                
                generation_id = result.get("generation_id")
                output = result.get("output", "")
                
                print(f"  ✅ Generated (ID: {generation_id[:8] if generation_id else 'unknown'}...)")
                
                # Analyze and rate
                quality_score, detailed_scores = self.calculate_quality_score(output, req, test_type)
                print(f"  ⭐ Quality: {quality_score}/5 stars")
                
                # Rate (non-blocking - continue even if rating fails)
                if generation_id:
                    try:
                        feedback = f"Auto-rated: {quality_score} stars"
                        self.rate_generation(generation_id, quality_score, feedback)
                    except:
                        pass  # Continue even if rating fails
                
                # Track stats
                self.stats["total_generated"] += 1
                self.stats["successful"] += 1
                collected += 1
                
                if quality_score >= 4:
                    self.stats["high_quality"] += 1
                elif quality_score >= 3:
                    self.stats["medium_quality"] += 1
                else:
                    self.stats["low_quality"] += 1
                
                self.results.append({
                    "generation_id": generation_id,
                    "requirement": req,
                    "test_type": test_type,
                    "quality_score": quality_score,
                    "detailed_scores": detailed_scores
                })
                
                # Wait before next request
                if collected < target_count:
                    print(f"  ⏸️  Waiting {DELAY_BETWEEN_REQUESTS}s before next request...\n")
                    time.sleep(DELAY_BETWEEN_REQUESTS)
            
            # Check if we reached target
            if collected >= target_count:
                print(f"\n✅ TARGET REACHED! Collected {collected} examples")
                break
            
            # Cycle through requirements if needed
            if collected < target_count:
                # Reuse requirements for next batch
                pass
        
        # Final summary
        self.print_summary()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", type=int, default=500)
    parser.add_argument("--delay", type=float, default=10.0)
    
    args = parser.parse_args()
    
    collector = OptimizedCollector()
    # Use diverse requirements
    requirements = SAMPLE_REQUIREMENTS * 50  # Repeat to get enough
    collector.collect_optimized(requirements, target_count=args.target)

