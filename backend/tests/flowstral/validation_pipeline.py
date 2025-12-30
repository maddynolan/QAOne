"""
Validation Pipeline for Playwright Script Generation
Validates generated scripts at multiple levels before returning.
"""

import logging
import subprocess
import tempfile
import os
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
import json

logger = logging.getLogger(__name__)


class PlaywrightScriptValidator:
    """
    Multi-level validation pipeline for generated Playwright scripts.
    """
    
    def __init__(self):
        self.validation_results = []
    
    async def validate(
        self,
        script: str,
        strict: bool = True
    ) -> Dict[str, Any]:
        """
        Validate generated Playwright script at multiple levels.
        
        Returns:
            {
                "valid": bool,
                "errors": List[str],
                "warnings": List[str],
                "validation_steps": List[Dict]
            }
        """
        errors = []
        warnings = []
        validation_steps = []
        
        # Step 1: Basic syntax validation
        step1 = await self._validate_syntax(script)
        validation_steps.append(step1)
        if not step1["passed"]:
            errors.extend(step1["errors"])
        
        # Step 2: Structure validation
        step2 = await self._validate_structure(script)
        validation_steps.append(step2)
        if not step2["passed"]:
            errors.extend(step2["errors"])
        warnings.extend(step2["warnings"])
        
        # Step 3: Playwright API validation
        step3 = await self._validate_playwright_api(script)
        validation_steps.append(step3)
        if not step3["passed"]:
            errors.extend(step3["errors"])
        warnings.extend(step3["warnings"])
        
        # Step 4: TypeScript compilation check (if available)
        step4 = await self._validate_typescript(script)
        if step4:
            validation_steps.append(step4)
            if not step4["passed"]:
                if strict:
                    errors.extend(step4["errors"])
                else:
                    warnings.extend(step4["errors"])
        
        # Step 5: Playwright dry-run (if available)
        step5 = await self._validate_playwright_dry_run(script)
        if step5:
            validation_steps.append(step5)
            if not step5["passed"]:
                if strict:
                    errors.extend(step5["errors"])
                else:
                    warnings.extend(step5["errors"])
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "validation_steps": validation_steps
        }
    
    async def _validate_syntax(self, script: str) -> Dict[str, Any]:
        """Basic JavaScript/TypeScript syntax validation"""
        errors = []
        
        # Check for unmatched quotes
        single_quotes = script.count("'") - script.count("\\'")
        if single_quotes % 2 != 0:
            errors.append("Unmatched single quotes")
        
        # Check for unmatched braces
        open_braces = script.count("{")
        close_braces = script.count("}")
        if open_braces != close_braces:
            errors.append(f"Unmatched braces: {open_braces} open, {close_braces} close")
        
        # Check for unmatched parentheses
        open_parens = script.count("(")
        close_parens = script.count(")")
        if open_parens != close_parens:
            errors.append(f"Unmatched parentheses: {open_parens} open, {close_parens} close")
        
        # Check for basic structure
        required_patterns = [
            ("import.*@playwright/test", "Missing Playwright import"),
            ("test\\(", "Missing test function"),
            ("async.*page", "Missing async page parameter"),
        ]
        
        import re
        for pattern, error_msg in required_patterns:
            if not re.search(pattern, script):
                errors.append(error_msg)
        
        return {
            "step": "syntax_validation",
            "passed": len(errors) == 0,
            "errors": errors
        }
    
    async def _validate_structure(self, script: str) -> Dict[str, Any]:
        """Validate script structure and best practices"""
        errors = []
        warnings = []
        
        # Check for test structure
        if "test('Flowstral Recorded Test'" not in script:
            errors.append("Missing or incorrect test function name")
        
        # Check for configuration constants
        if "ACTION_TIMEOUT" not in script and "timeout" not in script.lower():
            warnings.append("No timeout configuration found - consider adding timeouts")
        
        # Check for navigation
        if "page.goto" not in script:
            warnings.append("No page.goto() found - test may not navigate to a page")
        
        # Check for proper async/await usage
        if "async" in script and "await" not in script:
            errors.append("Async function without await statements")
        
        # Check for proper error handling (optional)
        if "try" not in script and "catch" not in script:
            warnings.append("No error handling - consider adding try/catch for robustness")
        
        return {
            "step": "structure_validation",
            "passed": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    async def _validate_playwright_api(self, script: str) -> Dict[str, Any]:
        """Validate Playwright API usage"""
        errors = []
        warnings = []
        
        import re
        
        # Check for deprecated methods
        deprecated_methods = ["page.click", "page.fill"]  # These should use locators
        for method in deprecated_methods:
            if re.search(rf"page\.{method}\(", script):
                warnings.append(f"Using deprecated {method} - prefer locator-based API")
        
        # Check for proper locator usage
        if "page.locator" in script or "page.getBy" in script:
            # Good - using locator API
            pass
        elif "page.click" in script or "page.fill" in script:
            warnings.append("Using direct page methods instead of locators - less reliable")
        
        # Check for proper wait strategies
        if "waitForLoadState" not in script and "page.goto" in script:
            warnings.append("Navigation without waitForLoadState - may cause flakiness")
        
        return {
            "step": "playwright_api_validation",
            "passed": len(errors) == 0,
            "errors": errors,
            "warnings": warnings
        }
    
    async def _validate_typescript(self, script: str) -> Optional[Dict[str, Any]]:
        """Validate TypeScript compilation (if tsc is available)"""
        try:
            # Check if tsc is available
            result = subprocess.run(
                ["tsc", "--version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode != 0:
                return None  # TypeScript not available
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None  # TypeScript not available
        
        # Create temp file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.ts', delete=False) as f:
            f.write(script)
            temp_file = f.name
        
        try:
            # Try to compile
            result = subprocess.run(
                ["tsc", "--noEmit", temp_file],
                capture_output=True,
                text=True,
                timeout=10
            )
            
            errors = []
            if result.returncode != 0:
                errors.append(f"TypeScript compilation failed: {result.stderr}")
            
            return {
                "step": "typescript_validation",
                "passed": len(errors) == 0,
                "errors": errors
            }
        except Exception as e:
            logger.warning(f"TypeScript validation failed: {e}")
            return None
        finally:
            # Cleanup
            try:
                os.unlink(temp_file)
            except:
                pass
    
    async def _validate_playwright_dry_run(self, script: str) -> Optional[Dict[str, Any]]:
        """Validate using Playwright dry-run (if available)"""
        try:
            # Check if playwright is available
            result = subprocess.run(
                ["npx", "playwright", "--version"],
                capture_output=True,
                timeout=5
            )
            if result.returncode != 0:
                return None  # Playwright not available
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return None  # Playwright not available
        
        # Create temp test file
        temp_dir = tempfile.mkdtemp()
        test_file = os.path.join(temp_dir, "test.spec.ts")
        
        try:
            with open(test_file, 'w') as f:
                f.write(script)
            
            # Try dry-run
            result = subprocess.run(
                ["npx", "playwright", "test", "--list", test_file],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=temp_dir
            )
            
            errors = []
            if result.returncode != 0:
                errors.append(f"Playwright dry-run failed: {result.stderr}")
            
            return {
                "step": "playwright_dry_run",
                "passed": len(errors) == 0,
                "errors": errors
            }
        except Exception as e:
            logger.warning(f"Playwright dry-run validation failed: {e}")
            return None
        finally:
            # Cleanup
            import shutil
            try:
                shutil.rmtree(temp_dir)
            except:
                pass


# Global validator instance
_validator = None

def get_playwright_validator() -> PlaywrightScriptValidator:
    """Get or create global validator instance"""
    global _validator
    if _validator is None:
        _validator = PlaywrightScriptValidator()
    return _validator



