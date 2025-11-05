#!/usr/bin/env python3
"""
Automated Data Collection & Rating System
Generates, executes, analyzes, and rates training data automatically
"""

import json
import os
import sys
import requests
import time
import re
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from collections import defaultdict

# Backend API base URL
BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8001")

# Quality rating criteria
QUALITY_CRITERIA = {
    "json_validity": {"weight": 0.3, "max_score": 1.0},
    "completeness": {"weight": 0.2, "max_score": 1.0},
    "structure_quality": {"weight": 0.2, "max_score": 1.0},
    "test_coverage": {"weight": 0.15, "max_score": 1.0},
    "code_quality": {"weight": 0.15, "max_score": 1.0}
}


class AutomatedDataCollector:
    """Automated system for collecting and rating training data"""
    
    def __init__(self):
        self.results = []
        self.stats = {
            "total_generated": 0,
            "successful": 0,
            "failed": 0,
            "high_quality": 0,
            "medium_quality": 0,
            "low_quality": 0
        }
    
    def generate_test_case(self, requirement: Dict[str, Any], test_type: str) -> Optional[Dict[str, Any]]:
        """Generate a test case from requirement"""
        # Get default org/project IDs
        org_id = "00000000-0000-0000-0000-000000000000"
        project_id = "11111111-1111-1111-1111-111111111111"
        
        # Use enhanced endpoint which supports all test types
        endpoint = "/ai/generate-tests-enhanced"
        
        # Enhanced prompt with best practices
        requirement_text = f"""Title: {requirement['title']}
Description: {requirement['description']}

Generate comprehensive test cases following QA best practices:

TEST CASE NAMING CONVENTION:
- Use descriptive names: "TC_[Feature]_[Scenario]_[ExpectedResult]"
- Example: "TC_Login_ValidCredentials_ShouldAccessDashboard"
- Include test type: "TC_Login_InvalidPassword_ShouldShowError"

TEST CASE STRUCTURE:
- Name: Clear, descriptive test case name
- Description: Detailed scenario description (2-3 sentences)
- Steps: 3-7 steps maximum (focused and actionable)
- Expected Result: Specific, measurable outcome

COVERAGE REQUIREMENTS:
1. Happy Path (Positive): Valid inputs, successful flow
2. Negative Cases: Invalid inputs, error handling
3. Edge Cases: Boundary values, limits, extremes
4. Boundary Conditions: Min/max values, empty/null inputs

STEP DESCRIPTION BEST PRACTICES:
- Start with action verb (Navigate, Click, Enter, Verify)
- Be specific and unambiguous
- Include data values when relevant
- One action per step
- Expected result should be measurable

Example format:
{{
  "name": "TC_Login_ValidEmailPassword_ShouldAuthenticateUser",
  "description": "Verify user can successfully log in with valid email and password credentials",
  "steps": [
    {{"action": "Navigate to login page", "expectedResult": "Login page displays with email and password fields"}},
    {{"action": "Enter valid email 'user@example.com'", "expectedResult": "Email field populated"}},
    {{"action": "Enter valid password 'SecurePass123!'", "expectedResult": "Password field populated"}},
    {{"action": "Click Login button", "expectedResult": "User redirected to dashboard"}},
    {{"action": "Verify user is authenticated", "expectedResult": "User session active, welcome message displayed"}}
  ],
  "priority": "high",
  "tags": ["login", "authentication", "positive"]
}}"""
        
        payload = {
            "org_id": org_id,
            "project_id": project_id,
            "requirement": requirement_text,
            "test_type": test_type,
            "mode": "ui"  # Use 14B model for better quality
        }
        
        try:
            response = requests.post(f"{BASE_URL}{endpoint}", json=payload, timeout=180)
            if response.ok:
                result = response.json()
                
                # Extract output - could be in different fields
                test_cases = result.get("test_cases") or result.get("cases") or []
                if test_cases:
                    # Convert to JSON string
                    output = json.dumps(test_cases, indent=2)
                else:
                    # Try other fields
                    output = (result.get("output") or 
                             result.get("response") or 
                             result.get("tests") or
                             result.get("code") or
                             json.dumps(result.get("testCases", [])) or
                             "")
                
                # Extract generation_id from audit or response
                audit = result.get("audit", {})
                generation_id = (result.get("generation_id") or 
                                audit.get("generation_id") or
                                result.get("id") or
                                None)
                
                # Get model from audit
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
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "test_type": test_type
            }
    
    def analyze_json_validity(self, output: str) -> Tuple[bool, float]:
        """Check if output is valid JSON and score it"""
        try:
            # Try to parse as JSON
            parsed = json.loads(output)
            
            # Check if it's a list (test cases usually are)
            if isinstance(parsed, list):
                if len(parsed) > 0:
                    return True, 1.0
                else:
                    return True, 0.5  # Valid but empty
            elif isinstance(parsed, dict):
                # Check if it has expected structure
                if "testCases" in parsed or "test_cases" in parsed:
                    return True, 0.9
                return True, 0.8
            else:
                return True, 0.6  # Valid JSON but unexpected format
        except json.JSONDecodeError:
            # Try to extract JSON from markdown
            json_match = re.search(r'```json\s*(\[.*?\]|\{.*?\})\s*```', output, re.DOTALL)
            if json_match:
                try:
                    json.loads(json_match.group(1))
                    return True, 0.7  # Valid JSON in markdown
                except:
                    pass
            
            # Try to find JSON array/object
            json_match = re.search(r'(\[.*?\]|\{.*?\})', output, re.DOTALL)
            if json_match:
                try:
                    json.loads(json_match.group(1))
                    return True, 0.6  # Valid JSON but not well-formatted
                except:
                    pass
            
            return False, 0.0
    
    def analyze_completeness(self, output: str, requirement: Dict[str, Any]) -> float:
        """Analyze if output covers the requirement comprehensively"""
        score = 0.0
        
        # Check for required fields
        required_fields = ["name", "description", "steps", "expectedResult"]
        found_fields = sum(1 for field in required_fields if field.lower() in output.lower())
        score += (found_fields / len(required_fields)) * 0.4
        
        # Check for multiple test cases
        if "testCase" in output.lower() or "test_case" in output.lower():
            # Try to count test cases
            test_case_count = output.lower().count('"name"') or output.lower().count('"title"')
            if test_case_count >= 3:
                score += 0.3
            elif test_case_count >= 2:
                score += 0.2
            else:
                score += 0.1
        
        # Check for edge cases mentioned
        edge_case_keywords = ["negative", "edge", "boundary", "invalid", "error", "exception"]
        found_keywords = sum(1 for keyword in edge_case_keywords if keyword in output.lower())
        score += min(found_keywords / 3, 1.0) * 0.3
        
        return min(score, 1.0)
    
    def analyze_structure_quality(self, output: str) -> float:
        """Analyze structural quality of the output"""
        score = 0.0
        
        # Check for proper structure
        try:
            parsed = json.loads(output)
            if isinstance(parsed, list):
                # Check structure of first item
                if len(parsed) > 0 and isinstance(parsed[0], dict):
                    has_name = "name" in parsed[0] or "title" in parsed[0]
                    has_steps = "steps" in parsed[0] or "testSteps" in parsed[0]
                    has_expected = "expectedResult" in parsed[0] or "expected" in parsed[0]
                    
                    structure_score = sum([has_name, has_steps, has_expected]) / 3
                    score += structure_score * 0.6
                    
                    # Check consistency across items
                    if len(parsed) > 1:
                        consistent = all(
                            isinstance(item, dict) and 
                            (has_name == ("name" in item or "title" in item))
                            for item in parsed[1:3]  # Check first 3
                        )
                        if consistent:
                            score += 0.4
                else:
                    score += 0.3  # List but not well-structured
        except:
            # If not JSON, check for structured text
            if "step" in output.lower() and "expected" in output.lower():
                score += 0.5
        
        return min(score, 1.0)
    
    def analyze_test_coverage(self, output: str, requirement: Dict[str, Any]) -> float:
        """Analyze test coverage of requirements"""
        score = 0.0
        
        req_title_lower = requirement['title'].lower()
        req_desc_lower = requirement['description'].lower()
        output_lower = output.lower()
        
        # Check if requirement title keywords are covered
        title_words = set(req_title_lower.split())
        covered_words = sum(1 for word in title_words if word in output_lower and len(word) > 3)
        if len(title_words) > 0:
            score += (covered_words / len(title_words)) * 0.4
        
        # Check if requirement description is addressed
        desc_keywords = set([w for w in req_desc_lower.split() if len(w) > 4])
        covered_keywords = sum(1 for kw in desc_keywords if kw in output_lower)
        if len(desc_keywords) > 0:
            score += min(covered_keywords / len(desc_keywords), 1.0) * 0.3
        
        # Check for positive/negative/edge cases
        has_positive = any(kw in output_lower for kw in ["positive", "valid", "success", "should"])
        has_negative = any(kw in output_lower for kw in ["negative", "invalid", "error", "fail", "should not"])
        has_edge = any(kw in output_lower for kw in ["edge", "boundary", "limit", "extreme"])
        
        coverage_score = sum([has_positive, has_negative, has_edge]) / 3
        score += coverage_score * 0.3
        
        return min(score, 1.0)
    
    def analyze_code_quality(self, output: str, test_type: str) -> float:
        """Analyze code quality (for automation tests)"""
        if test_type != "automation":
            return 1.0  # Not applicable
        
        score = 0.0
        output_lower = output.lower()
        
        # Check for proper code structure
        has_imports = "import" in output_lower or "from" in output_lower
        has_async = "async" in output_lower or "await" in output_lower
        has_assertions = "assert" in output_lower or "expect" in output_lower
        
        if has_imports:
            score += 0.3
        if has_async:
            score += 0.3
        if has_assertions:
            score += 0.4
        
        # Check for proper test structure
        has_test_function = "def test" in output_lower or "test(" in output_lower
        has_setup = "setup" in output_lower or "before" in output_lower
        has_teardown = "teardown" in output_lower or "after" in output_lower
        
        structure_score = sum([has_test_function, has_setup, has_teardown]) / 3
        score += structure_score * 0.3
        
        return min(score, 1.0)
    
    def calculate_quality_score(self, output: str, requirement: Dict[str, Any], test_type: str) -> Tuple[float, Dict[str, float]]:
        """Calculate overall quality score"""
        scores = {}
        
        # JSON validity
        is_valid, json_score = self.analyze_json_validity(output)
        scores["json_validity"] = json_score
        
        # Completeness
        scores["completeness"] = self.analyze_completeness(output, requirement)
        
        # Structure quality
        scores["structure_quality"] = self.analyze_structure_quality(output)
        
        # Test coverage
        scores["test_coverage"] = self.analyze_test_coverage(output, requirement)
        
        # Code quality
        scores["code_quality"] = self.analyze_code_quality(output, test_type)
        
        # Calculate weighted score
        total_score = sum(
            scores[key] * QUALITY_CRITERIA[key]["weight"]
            for key in scores.keys()
        )
        
        # Convert to 1-5 star rating
        star_rating = min(5, max(1, int((total_score * 4) + 1)))
        
        return star_rating, scores
    
    def rate_generation(self, generation_id: str, quality_score: int, feedback: str = None) -> bool:
        """Rate a generation via API"""
        payload = {
            "quality_score": quality_score,
            "is_approved": quality_score >= 4,
            "feedback": feedback or f"Auto-rated: {quality_score} stars"
        }
        
        try:
            response = requests.post(
                f"{BASE_URL}/ai/generations/{generation_id}/rate",
                json=payload,
                timeout=10
            )
            return response.ok
        except Exception as e:
            print(f"  ⚠️  Error rating generation: {e}")
            return False
    
    def collect_and_rate(self, requirements: List[Dict[str, Any]], delay_seconds: float = 2.0):
        """Collect data and auto-rate"""
        print("=" * 70)
        print("🚀 AUTOMATED DATA COLLECTION & RATING SYSTEM")
        print("=" * 70)
        print(f"\nProcessing {len(requirements)} requirements...\n")
        
        for i, req in enumerate(requirements, 1):
            test_type = req.get("test_type", "manual")
            print(f"[{i}/{len(requirements)}] Generating {test_type} test for: {req['title'][:50]}...")
            
            # Generate
            result = self.generate_test_case(req, test_type)
            
            if not result.get("success"):
                print(f"  ❌ Generation failed: {result.get('error', 'unknown')}")
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
            
            # Rate via API
            if generation_id:
                feedback = f"Auto-rated: JSON={detailed_scores['json_validity']:.2f}, "
                feedback += f"Completeness={detailed_scores['completeness']:.2f}, "
                feedback += f"Structure={detailed_scores['structure_quality']:.2f}, "
                feedback += f"Coverage={detailed_scores['test_coverage']:.2f}"
                
                if self.rate_generation(generation_id, quality_score, feedback):
                    print(f"  ✅ Rated and stored")
                else:
                    print(f"  ⚠️  Generated but rating failed")
            
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
            
            if i < len(requirements):
                time.sleep(delay_seconds)
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print collection summary"""
        print("\n" + "=" * 70)
        print("📊 COLLECTION SUMMARY")
        print("=" * 70)
        
        print(f"\n✅ Successful: {self.stats['successful']}")
        print(f"❌ Failed: {self.stats['failed']}")
        print(f"\n⭐ Quality Distribution:")
        print(f"   High (4-5 stars): {self.stats['high_quality']}")
        print(f"   Medium (3 stars): {self.stats['medium_quality']}")
        print(f"   Low (1-2 stars): {self.stats['low_quality']}")
        
        if self.stats['successful'] > 0:
            avg_quality = sum(r['quality_score'] for r in self.results) / len(self.results)
            print(f"\n📈 Average Quality: {avg_quality:.2f}/5 stars")
        
        print(f"\n💡 Next Steps:")
        print(f"   1. Review ratings: python scripts/collect_training_data.py --status")
        print(f"   2. Cross-verify high-quality examples in UI")
        print(f"   3. Adjust ratings if needed")
        print(f"   4. Continue collection for more examples")
        
        print("\n" + "=" * 70)
        
        # Save detailed results
        results_file = f"data_collection_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_file, "w") as f:
            json.dump({
                "timestamp": datetime.now().isoformat(),
                "stats": self.stats,
                "results": self.results
            }, f, indent=2)
        
        print(f"\n📄 Detailed results saved to: {results_file}")


# Sample requirements for testing
SAMPLE_REQUIREMENTS = [
    {"title": "User Login", "description": "User should log in with email and password", "test_type": "manual"},
    {"title": "API Authentication", "description": "API requires valid authentication token", "test_type": "api"},
    {"title": "Shopping Cart", "description": "User can add items to cart and checkout", "test_type": "automation"},
    {"title": "Password Reset", "description": "User can reset password via email", "test_type": "manual"},
    {"title": "API Rate Limiting", "description": "API enforces rate limits per user", "test_type": "api"},
    {"title": "Form Validation", "description": "Forms validate required fields", "test_type": "automation"},
    {"title": "Search Functionality", "description": "Users can search for products", "test_type": "automation"},
    {"title": "Payment Processing", "description": "Payment gateway integration works", "test_type": "api"},
    {"title": "User Profile", "description": "Users can update profile information", "test_type": "manual"},
    {"title": "Data Export", "description": "Users can export their data", "test_type": "automation"},
]


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Automated data collection and rating")
    parser.add_argument("--count", type=int, default=10, help="Number of examples to generate")
    parser.add_argument("--delay", type=float, default=2.0, help="Delay between requests (seconds)")
    parser.add_argument("--file", type=str, help="JSON file with requirements")
    
    args = parser.parse_args()
    
    collector = AutomatedDataCollector()
    
    if args.file and os.path.exists(args.file):
        with open(args.file, "r") as f:
            requirements = json.load(f)
    else:
        requirements = SAMPLE_REQUIREMENTS[:args.count]
    
    collector.collect_and_rate(requirements, delay_seconds=args.delay)

