"""
Isolated Test Harness for Playwright Generator
Can run independently without full backend infrastructure.
"""

import asyncio
import json
import sys
from pathlib import Path
from typing import Dict, List, Any, Optional
from datetime import datetime

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.flowstral.enhanced_playwright_generator import EnhancedPlaywrightGenerator
from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode


class PlaywrightGeneratorTestHarness:
    """
    Isolated test harness for testing Playwright generator.
    Can be run independently to test generator logic.
    """
    
    def __init__(self):
        self.generator = EnhancedPlaywrightGenerator()
        self.results = []
    
    def create_sample_action_graph(self, scenario: str = "simple") -> ActionGraph:
        """Create sample action graph for testing"""
        graph = ActionGraph()
        
        if scenario == "simple":
            # Simple: navigate + click
            graph.add_node(ActionGraphNode(
                id="node-1",
                event_type="navigate",
                url="https://example.com",
                timestamp=datetime.utcnow().isoformat()
            ))
            graph.add_node(ActionGraphNode(
                id="node-2",
                event_type="click",
                target_selector="button.submit",
                target_text="Submit",
                action_description="CLICK: BUTTON Submit",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "button",
                        "class": "submit",
                        "text_content": "Submit"
                    }
                }
            ))
        
        elif scenario == "nmdp_workflow":
            # Real-world workflow: NMDP donor registry
            graph.add_node(ActionGraphNode(
                id="node-1",
                event_type="navigate",
                url="https://my.nmdp.org/s/?language=en_US",
                timestamp=datetime.utcnow().isoformat()
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-2",
                event_type="click",
                target_selector="a[href*='get-involved']",
                target_text="Get involved",
                action_description="CLICK: LINK Get involved",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "a",
                        "text_content": "Get involved"
                    }
                }
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-3",
                event_type="click",
                target_selector="a[href*='join-donor']",
                target_text="Join donor registry",
                action_description="CLICK: LINK Join donor registry",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "a",
                        "text_content": "Join donor registry"
                    }
                }
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-4",
                event_type="click",
                target_selector="span.slds-checkbox_faux",
                target_text=None,
                action_description="CLICK: SPAN span.slds-checkbox_faux",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "span",
                        "class": "slds-checkbox_faux"
                    }
                }
            ))
        
        elif scenario == "form_fill":
            # Form filling scenario
            graph.add_node(ActionGraphNode(
                id="node-1",
                event_type="navigate",
                url="https://example.com/form",
                timestamp=datetime.utcnow().isoformat()
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-2",
                event_type="input",
                target_selector="input[name='email']",
                target_text=None,
                action_description="FILL_INPUT: INPUT email",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "input",
                        "name": "email",
                        "type": "email"
                    },
                    "value": "test@example.com"
                }
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-3",
                event_type="input",
                target_selector="input[name='password']",
                target_text=None,
                action_description="FILL_INPUT: INPUT password",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "input",
                        "name": "password",
                        "type": "password"
                    },
                    "value": "secret123"
                }
            ))
            
            graph.add_node(ActionGraphNode(
                id="node-4",
                event_type="click",
                target_selector="button[type='submit']",
                target_text="Submit",
                action_description="CLICK: BUTTON Submit",
                timestamp=datetime.utcnow().isoformat(),
                metadata={
                    "interacted_element": {
                        "tag_name": "button",
                        "type": "submit",
                        "text_content": "Submit"
                    }
                }
            ))
        
        return graph
    
    async def test_scenario(self, scenario: str) -> Dict[str, Any]:
        """Test a specific scenario"""
        print(f"\n{'='*60}")
        print(f"Testing scenario: {scenario}")
        print(f"{'='*60}")
        
        # Create action graph
        graph = self.create_sample_action_graph(scenario)
        print(f"Created action graph with {len(graph.nodes)} nodes")
        
        # Generate script
        print("Generating Playwright script...")
        result = await self.generator.generate_script(graph)
        
        # Validate
        print("Validating generated script...")
        validation_errors = self.generator._validate_script_syntax(result["script"])
        
        # Print results
        print(f"\n✅ Generated {result['action_count']} actions")
        print(f"⏱️  Generation time: {result.get('generation_time_ms', 0):.0f}ms")
        
        if validation_errors:
            print(f"❌ Validation errors: {validation_errors}")
        else:
            print("✅ Script syntax is valid")
        
        if result.get("warnings"):
            print(f"⚠️  Warnings: {result['warnings']}")
        
        # Print script preview
        print(f"\n📄 Generated script preview (first 20 lines):")
        script_lines = result["script"].split('\n')
        for i, line in enumerate(script_lines[:20], 1):
            print(f"  {i:2d}: {line}")
        if len(script_lines) > 20:
            print(f"  ... ({len(script_lines) - 20} more lines)")
        
        # Store result
        test_result = {
            "scenario": scenario,
            "success": len(validation_errors) == 0,
            "action_count": result["action_count"],
            "validation_errors": validation_errors,
            "warnings": result.get("warnings", []),
            "script_length": len(result["script"]),
            "generation_time_ms": result.get("generation_time_ms", 0)
        }
        self.results.append(test_result)
        
        return test_result
    
    async def run_all_tests(self):
        """Run all test scenarios"""
        scenarios = ["simple", "nmdp_workflow", "form_fill"]
        
        print("🚀 Starting Playwright Generator Test Harness")
        print(f"Testing {len(scenarios)} scenarios...")
        
        for scenario in scenarios:
            try:
                await self.test_scenario(scenario)
            except Exception as e:
                print(f"❌ Error testing {scenario}: {e}")
                import traceback
                traceback.print_exc()
        
        # Print summary
        self.print_summary()
    
    def print_summary(self):
        """Print test summary"""
        print(f"\n{'='*60}")
        print("TEST SUMMARY")
        print(f"{'='*60}")
        
        total = len(self.results)
        passed = sum(1 for r in self.results if r["success"])
        failed = total - passed
        
        print(f"Total scenarios: {total}")
        print(f"✅ Passed: {passed}")
        print(f"❌ Failed: {failed}")
        
        if failed > 0:
            print("\nFailed scenarios:")
            for result in self.results:
                if not result["success"]:
                    print(f"  - {result['scenario']}: {result['validation_errors']}")
    
    def save_results(self, output_file: str = "test_results.json"):
        """Save test results to file"""
        with open(output_file, 'w') as f:
            json.dump(self.results, f, indent=2)
        print(f"\n💾 Results saved to {output_file}")


async def main():
    """Main entry point"""
    harness = PlaywrightGeneratorTestHarness()
    await harness.run_all_tests()
    harness.save_results()


if __name__ == "__main__":
    asyncio.run(main())



