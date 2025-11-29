"""
Code Validation Service
Validates generated test code before execution
- Lint checks
- Type checking
- Dry-run (playwright test --list)
- Auto-fix suggestions
"""

import subprocess
import tempfile
import os
import json
import logging
from typing import Dict, List, Any, Optional
from pathlib import Path

logger = logging.getLogger(__name__)

class CodeValidator:
    """Validates generated test code"""
    
    def __init__(self):
        self.temp_dir = None
    
    async def validate_playwright_code(
        self, 
        code: str, 
        project_type: str = "playwright-ts"
    ) -> Dict[str, Any]:
        """
        Validate Playwright TypeScript code
        
        Args:
            code: Generated test code
            project_type: Type of project template (playwright-ts, pytest, k6)
            
        Returns:
            Dict with validation results:
            {
                "valid": bool,
                "errors": List[str],
                "warnings": List[str],
                "suggestions": List[str],
                "dry_run_output": str
            }
        """
        errors = []
        warnings = []
        suggestions = []
        dry_run_output = ""
        
        try:
            # Create temp directory
            self.temp_dir = tempfile.mkdtemp(prefix="code_validation_")
            
            # Write code to temp file
            test_file = os.path.join(self.temp_dir, "test.spec.ts")
            with open(test_file, 'w', encoding='utf-8') as f:
                f.write(code)
            
            # 1. Basic syntax check (TypeScript compilation)
            ts_errors = await self._check_typescript_syntax(test_file)
            if ts_errors:
                errors.extend(ts_errors)
            
            # 2. Playwright dry-run
            dry_run_result = await self._playwright_dry_run(self.temp_dir)
            if dry_run_result["success"]:
                dry_run_output = dry_run_result["output"]
            else:
                errors.extend(dry_run_result["errors"])
            
            # 3. Lint check (if eslint available)
            lint_result = await self._run_linter(test_file)
            if lint_result["warnings"]:
                warnings.extend(lint_result["warnings"])
            if lint_result["errors"]:
                errors.extend(lint_result["errors"])
            
            # 4. Generate suggestions
            if errors:
                suggestions = self._generate_suggestions(errors, code)
            
        except Exception as e:
            logger.error(f"Validation error: {e}")
            errors.append(f"Validation failed: {str(e)}")
        finally:
            # Cleanup
            if self.temp_dir and os.path.exists(self.temp_dir):
                import shutil
                shutil.rmtree(self.temp_dir, ignore_errors=True)
        
        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "warnings": warnings,
            "suggestions": suggestions,
            "dry_run_output": dry_run_output
        }
    
    async def _check_typescript_syntax(self, file_path: str) -> List[str]:
        """Check TypeScript syntax using tsc"""
        errors = []
        try:
            result = subprocess.run(
                ["npx", "tsc", "--noEmit", file_path],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.dirname(file_path)
            )
            if result.returncode != 0:
                # Parse TypeScript errors
                for line in result.stderr.split('\n'):
                    if 'error TS' in line:
                        errors.append(line.strip())
        except FileNotFoundError:
            # TypeScript not available, skip
            pass
        except subprocess.TimeoutExpired:
            errors.append("TypeScript check timed out")
        except Exception as e:
            logger.warning(f"TypeScript check failed: {e}")
        
        return errors
    
    async def _playwright_dry_run(self, test_dir: str) -> Dict[str, Any]:
        """Run playwright test --list to check if tests are discoverable"""
        errors = []
        output = ""
        
        try:
            # Create minimal playwright.config.ts if not exists
            config_path = os.path.join(test_dir, "playwright.config.ts")
            if not os.path.exists(config_path):
                with open(config_path, 'w') as f:
                    f.write("""import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './',
  use: { headless: true }
});""")
            
            result = subprocess.run(
                ["npx", "playwright", "test", "--list"],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=test_dir
            )
            
            output = result.stdout + result.stderr
            
            if result.returncode != 0:
                errors.append(f"Playwright dry-run failed: {result.stderr}")
            elif "No tests found" in output:
                errors.append("No tests discovered by Playwright")
            
        except FileNotFoundError:
            errors.append("Playwright not installed or not in PATH")
        except subprocess.TimeoutExpired:
            errors.append("Playwright dry-run timed out")
        except Exception as e:
            errors.append(f"Playwright dry-run error: {str(e)}")
        
        return {
            "success": len(errors) == 0,
            "output": output,
            "errors": errors
        }
    
    async def _run_linter(self, file_path: str) -> Dict[str, List[str]]:
        """Run ESLint if available"""
        errors = []
        warnings = []
        
        try:
            result = subprocess.run(
                ["npx", "eslint", file_path],
                capture_output=True,
                text=True,
                timeout=10,
                cwd=os.path.dirname(file_path)
            )
            
            if result.returncode != 0:
                for line in result.stdout.split('\n'):
                    if 'error' in line.lower():
                        errors.append(line.strip())
                    elif 'warning' in line.lower():
                        warnings.append(line.strip())
        except FileNotFoundError:
            # ESLint not available, skip
            pass
        except Exception as e:
            logger.warning(f"Linter check failed: {e}")
        
        return {"errors": errors, "warnings": warnings}
    
    def _generate_suggestions(self, errors: List[str], code: str) -> List[str]:
        """Generate auto-fix suggestions based on errors"""
        suggestions = []
        
        for error in errors:
            if "Cannot find name" in error:
                suggestions.append("Add missing imports at the top of the file")
            elif "Cannot find module" in error:
                suggestions.append("Install missing npm packages: npm install <package>")
            elif "Property" in error and "does not exist" in error:
                suggestions.append("Check property names match the actual API")
            elif "syntax" in error.lower():
                suggestions.append("Fix syntax errors in the code")
        
        return suggestions

# Singleton instance
_code_validator = None

def get_code_validator() -> CodeValidator:
    """Get or create CodeValidator instance"""
    global _code_validator
    if _code_validator is None:
        _code_validator = CodeValidator()
    return _code_validator


