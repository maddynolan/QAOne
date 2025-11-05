#!/usr/bin/env python3
"""
Robust Data Collection with Better Error Handling
Handles timeouts, retries, and backend connectivity issues
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
MAX_RETRIES = 3
REQUEST_TIMEOUT = 300  # 5 minutes for 14B model
RETRY_DELAY = 5  # Wait 5 seconds between retries


class RobustDataCollector(AutomatedDataCollector):
    """Enhanced collector with retry logic and better error handling"""
    
    def check_backend_health(self) -> bool:
        """Check if backend is accessible"""
        try:
            response = requests.get(f"{BASE_URL}/health", timeout=5)
            return response.ok
        except:
            return False
    
    def wait_for_backend(self, max_wait: int = 60) -> bool:
        """Wait for backend to become available"""
        print(f"  ⏳ Waiting for backend (max {max_wait}s)...")
        for i in range(max_wait // 5):
            if self.check_backend_health():
                print(f"  ✅ Backend is back online")
                return True
            time.sleep(5)
            print(f"  ... still waiting ({i*5}s)")
        return False
    
    def generate_test_case_with_retry(self, requirement: Dict[str, Any], test_type: str) -> Optional[Dict[str, Any]]:
        """Generate test case with retry logic"""
        for attempt in range(MAX_RETRIES):
            try:
                # Check backend health before request
                if not self.check_backend_health():
                    print(f"  ⚠️  Backend unreachable, waiting...")
                    if not self.wait_for_backend():
                        return {
                            "success": False,
                            "error": "Backend unavailable after waiting",
                            "test_type": test_type
                        }
                
                # Make request
                result = self.generate_test_case(requirement, test_type)
                
                if result and result.get("success"):
                    return result
                elif attempt < MAX_RETRIES - 1:
                    print(f"  ⚠️  Attempt {attempt + 1} failed, retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    return result
                    
            except requests.exceptions.Timeout:
                if attempt < MAX_RETRIES - 1:
                    print(f"  ⚠️  Timeout on attempt {attempt + 1}, retrying in {RETRY_DELAY}s...")
                    time.sleep(RETRY_DELAY)
                else:
                    return {
                        "success": False,
                        "error": f"Timeout after {MAX_RETRIES} attempts",
                        "test_type": test_type
                    }
            except requests.exceptions.ConnectionError:
                if attempt < MAX_RETRIES - 1:
                    print(f"  ⚠️  Connection error on attempt {attempt + 1}, retrying in {RETRY_DELAY}s...")
                    if not self.wait_for_backend():
                        return {
                            "success": False,
                            "error": "Backend connection lost",
                            "test_type": test_type
                        }
                    time.sleep(RETRY_DELAY)
                else:
                    return {
                        "success": False,
                        "error": "Connection error after retries",
                        "test_type": test_type
                    }
            except Exception as e:
                if attempt < MAX_RETRIES - 1:
                    print(f"  ⚠️  Error on attempt {attempt + 1}: {str(e)[:100]}, retrying...")
                    time.sleep(RETRY_DELAY)
                else:
                    return {
                        "success": False,
                        "error": str(e),
                        "test_type": test_type
                    }
        
        return None
    
    def collect_and_rate_robust(self, requirements: List[Dict[str, Any]], delay_seconds: float = 3.0):
        """Robust collection with better error handling"""
        print("=" * 70)
        print("🚀 ROBUST DATA COLLECTION & RATING SYSTEM")
        print("=" * 70)
        print(f"\nProcessing {len(requirements)} requirements...")
        print(f"Timeout: {REQUEST_TIMEOUT}s, Max retries: {MAX_RETRIES}\n")
        
        for i, req in enumerate(requirements, 1):
            test_type = req.get("test_type", "manual")
            print(f"[{i}/{len(requirements)}] Generating {test_type} test for: {req['title'][:50]}...")
            
            # Generate with retry
            result = self.generate_test_case_with_retry(req, test_type)
            
            if not result or not result.get("success"):
                print(f"  ❌ Generation failed after retries: {result.get('error', 'unknown') if result else 'no result'}")
                self.stats["failed"] += 1
                continue
            
            generation_id = result.get("generation_id")
            output = result.get("output", "")
            
            print(f"  ✅ Generated (ID: {generation_id[:8] if generation_id else 'unknown'}...)")
            
            # Analyze and rate
            print(f"  📊 Analyzing quality...")
            quality_score, detailed_scores = self.calculate_quality_score(
                output, req, test_type
            )
            
            print(f"  ⭐ Quality Score: {quality_score}/5 stars")
            print(f"     JSON: {detailed_scores['json_validity']:.2f}, "
                  f"Completeness: {detailed_scores['completeness']:.2f}, "
                  f"Structure: {detailed_scores['structure_quality']:.2f}")
            
            # Rate via API (with retry)
            if generation_id:
                feedback = f"Auto-rated: JSON={detailed_scores['json_validity']:.2f}, "
                feedback += f"Completeness={detailed_scores['completeness']:.2f}, "
                feedback += f"Structure={detailed_scores['structure_quality']:.2f}, "
                feedback += f"Coverage={detailed_scores['test_coverage']:.2f}"
                
                # Try rating with retry
                rating_success = False
                for rating_attempt in range(2):  # 2 attempts for rating
                    try:
                        if self.rate_generation(generation_id, quality_score, feedback):
                            rating_success = True
                            print(f"  ✅ Rated and stored")
                            break
                    except Exception as e:
                        if rating_attempt < 1:
                            time.sleep(2)
                            continue
                
                if not rating_success:
                    print(f"  ⚠️  Generated but rating failed (will rate manually later)")
            
            # Track stats
            self.stats["total_generated"] += 1
            self.stats["successful"] += 1
            
            if quality_score >= 4:
                self.stats["high_quality"] += 1
            elif quality_score >= 3:
                self.stats["medium_quality"] += 1
            else:
                self.stats["low_quality"] += 1
            
            # Store result
            self.results.append({
                "generation_id": generation_id,
                "requirement": req,
                "test_type": test_type,
                "quality_score": quality_score,
                "detailed_scores": detailed_scores,
                "output_preview": output[:200] + "..." if len(output) > 200 else output
            })
            
            # Delay between requests (longer to avoid overwhelming backend)
            if i < len(requirements):
                print(f"  ⏸️  Waiting {delay_seconds}s before next request...\n")
                time.sleep(delay_seconds)
        
        # Print summary
        self.print_summary()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Robust automated data collection")
    parser.add_argument("--count", type=int, default=10, help="Number of examples")
    parser.add_argument("--delay", type=float, default=3.0, help="Delay between requests")
    
    args = parser.parse_args()
    
    collector = RobustDataCollector()
    requirements = SAMPLE_REQUIREMENTS[:args.count]
    collector.collect_and_rate_robust(requirements, delay_seconds=args.delay)

