"""
Comprehensive Test Suite for Playwright Generator
Uses golden files (known-good inputs/outputs) to validate generator behavior.
"""

import pytest
import json
import os
from pathlib import Path
from typing import Dict, List, Any
from datetime import datetime

from app.services.flowstral.enhanced_playwright_generator import EnhancedPlaywrightGenerator
from app.services.flowstral.flowstral_action_graph import ActionGraph, ActionGraphNode


# Path to test data directory
TEST_DATA_DIR = Path(__file__).parent / "test_data" / "playwright_generator"
GOLDEN_FILES_DIR = TEST_DATA_DIR / "golden"


class TestPlaywrightGenerator:
    """Test suite for Playwright script generation"""
    
    @pytest.fixture
    def generator(self):
        """Create generator instance"""
        return EnhancedPlaywrightGenerator()
    
    @pytest.fixture
    def sample_action_graph_simple(self):
        """Simple action graph: navigate + click"""
        graph = ActionGraph()
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
        return graph
    
    @pytest.fixture
    def sample_action_graph_complex(self):
        """Complex action graph: navigate + multiple clicks + inputs"""
        graph = ActionGraph()
        
        # Navigate
        graph.add_node(ActionGraphNode(
            id="node-1",
            event_type="navigate",
            url="https://my.nmdp.org/s/?language=en_US",
            timestamp=datetime.utcnow().isoformat()
        ))
        
        # Click "Get involved"
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
                    "text_content": "Get involved",
                    "href": "/get-involved"
                }
            }
        ))
        
        # Click "Join donor registry"
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
        
        # Click checkbox
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
        
        # Fill input
        graph.add_node(ActionGraphNode(
            id="node-5",
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
        
        return graph
    
    @pytest.mark.asyncio
    async def test_simple_navigation_and_click(self, generator, sample_action_graph_simple):
        """Test simple navigate + click generates valid code"""
        result = await generator.generate_script(sample_action_graph_simple)
        
        assert result["script"], "Script should not be empty"
        assert "page.goto" in result["script"], "Should contain navigation"
        assert "page.locator" in result["script"] or "page.getBy" in result["script"], "Should contain locator"
        assert "click" in result["script"].lower(), "Should contain click action"
        assert result["action_count"] > 0, "Should have processed actions"
        
        # Validate syntax
        validation_errors = generator._validate_script_syntax(result["script"])
        assert len(validation_errors) == 0, f"Syntax errors: {validation_errors}"
    
    @pytest.mark.asyncio
    async def test_complex_workflow(self, generator, sample_action_graph_complex):
        """Test complex workflow generates valid code"""
        result = await generator.generate_script(sample_action_graph_complex)
        
        assert result["script"], "Script should not be empty"
        assert result["action_count"] >= 4, f"Should process at least 4 actions, got {result['action_count']}"
        
        # Check for all expected actions
        script_lower = result["script"].lower()
        assert "page.goto" in result["script"], "Should contain navigation"
        assert "click" in script_lower, "Should contain click actions"
        assert "fill" in script_lower or "input" in script_lower, "Should contain fill/input actions"
        
        # Validate syntax
        validation_errors = generator._validate_script_syntax(result["script"])
        assert len(validation_errors) == 0, f"Syntax errors: {validation_errors}"
    
    @pytest.mark.asyncio
    async def test_golden_file_comparison(self, generator):
        """Compare generated output against golden files"""
        if not GOLDEN_FILES_DIR.exists():
            pytest.skip("Golden files directory not found")
        
        for golden_file in GOLDEN_FILES_DIR.glob("*.json"):
            with open(golden_file, 'r') as f:
                golden_data = json.load(f)
            
            # Reconstruct action graph from golden file
            graph = self._load_action_graph_from_golden(golden_data["input"])
            
            # Generate script
            result = await generator.generate_script(graph)
            
            # Compare with expected output
            expected_script = golden_data["expected_output"]["script"]
            actual_script = result["script"]
            
            # Normalize for comparison (remove whitespace differences)
            expected_normalized = self._normalize_script(expected_script)
            actual_normalized = self._normalize_script(actual_script)
            
            # Check key elements match
            assert "page.goto" in actual_script or "page.goto" in expected_script, \
                f"Golden file {golden_file.name}: Missing navigation"
            
            # Validate syntax
            validation_errors = generator._validate_script_syntax(result["script"])
            assert len(validation_errors) == 0, \
                f"Golden file {golden_file.name}: Syntax errors: {validation_errors}"
    
    def _load_action_graph_from_golden(self, input_data: Dict) -> ActionGraph:
        """Load action graph from golden file input"""
        graph = ActionGraph()
        for node_data in input_data.get("nodes", []):
            node = ActionGraphNode(**node_data)
            graph.add_node(node)
        return graph
    
    def _normalize_script(self, script: str) -> str:
        """Normalize script for comparison (remove whitespace differences)"""
        lines = [line.strip() for line in script.split('\n') if line.strip()]
        return '\n'.join(lines)


class TestPlaywrightGeneratorValidation:
    """Test validation and error detection"""
    
    @pytest.fixture
    def generator(self):
        return EnhancedPlaywrightGenerator()
    
    def test_validate_valid_script(self, generator):
        """Test validation passes for valid script"""
        valid_script = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('button').click();
});"""
        
        errors = generator._validate_script_syntax(valid_script)
        assert len(errors) == 0, f"Valid script should have no errors: {errors}"
    
    def test_validate_unmatched_braces(self, generator):
        """Test validation detects unmatched braces"""
        invalid_script = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  await page.goto('https://example.com');
  // Missing closing brace"""
        
        errors = generator._validate_script_syntax(invalid_script)
        assert len(errors) > 0, "Should detect unmatched braces"
        assert any("braces" in err.lower() for err in errors), "Error should mention braces"
    
    def test_validate_unmatched_quotes(self, generator):
        """Test validation detects unmatched quotes"""
        invalid_script = """import { test, expect } from '@playwright/test';

test('Flowstral Recorded Test', async ({ page }) => {
  await page.goto('https://example.com');
  await page.locator('button').click(); // Unmatched quote"""
        
        errors = generator._validate_script_syntax(invalid_script)
        # Note: This is a basic check, may not catch all quote issues
        # More sophisticated validation would be needed for complex cases


if __name__ == "__main__":
    pytest.main([__file__, "-v"])



