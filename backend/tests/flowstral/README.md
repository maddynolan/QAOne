# Playwright Generator Testing Framework

This directory contains a comprehensive testing and validation framework for the Playwright script generator, replacing trial-and-error with systematic testing.

## Structure

```
tests/flowstral/
├── test_playwright_generator.py    # Main test suite with pytest
├── test_harness.py                  # Isolated test harness (can run independently)
├── validation_pipeline.py          # Multi-level validation pipeline
├── debug_generator.py               # Debugging utilities
├── test_data/
│   └── playwright_generator/
│       └── golden/                  # Golden files (known-good inputs/outputs)
│           └── simple_click.json
└── README.md                        # This file
```

## Quick Start

### 1. Run Isolated Test Harness

Test the generator independently without full backend:

```bash
cd backend
python -m tests.flowstral.test_harness
```

This will:
- Test multiple scenarios (simple, nmdp_workflow, form_fill)
- Generate scripts and validate them
- Print detailed results
- Save results to `test_results.json`

### 2. Run Pytest Suite

Run comprehensive unit tests:

```bash
cd backend
pytest tests/flowstral/test_playwright_generator.py -v
```

### 3. Use Debugging Utilities

Add debugging to your code:

```python
from tests.flowstral.debug_generator import create_debug_generator

debugger = create_debug_generator(verbose=True)
# ... use debugger to trace generation ...
debugger.print_trace_summary()
debugger.save_trace("my_trace.json")
```

### 4. Use Validation Pipeline

Validate generated scripts:

```python
from tests.flowstral.validation_pipeline import get_playwright_validator

validator = get_playwright_validator()
result = await validator.validate(generated_script, strict=True)

if not result["valid"]:
    print("Errors:", result["errors"])
    print("Warnings:", result["warnings"])
```

## Golden Files

Golden files are known-good test cases with expected outputs. They serve as regression tests.

Format:
```json
{
  "description": "Test description",
  "input": {
    "nodes": [...]
  },
  "expected_output": {
    "script": "...",
    "action_count": 2,
    "has_navigation": true,
    "has_click": true
  }
}
```

## Adding New Test Cases

1. **Create a golden file** in `test_data/playwright_generator/golden/`
2. **Add a test scenario** to `test_harness.py`'s `create_sample_action_graph()`
3. **Run tests** to verify

## Validation Levels

The validation pipeline checks:

1. **Syntax Validation**: Unmatched quotes, braces, parentheses
2. **Structure Validation**: Test structure, best practices
3. **Playwright API Validation**: Correct API usage
4. **TypeScript Validation**: Compilation check (if tsc available)
5. **Playwright Dry-Run**: Actual Playwright test discovery (if available)

## Debugging Workflow

1. **Run test harness** to see what's generated
2. **Check trace output** for step-by-step processing
3. **Review validation results** for issues
4. **Fix issues** and re-run tests
5. **Update golden files** if output changes intentionally

## Best Practices

1. **Always run tests** before committing changes
2. **Update golden files** when intentionally changing output format
3. **Add new test cases** for bugs you fix
4. **Use validation pipeline** in production code
5. **Save traces** when debugging complex issues

## Integration with Generator

To integrate validation into the generator:

```python
from tests.flowstral.validation_pipeline import get_playwright_validator

# In generate_script():
validator = get_playwright_validator()
validation_result = await validator.validate(script, strict=False)

if not validation_result["valid"]:
    logger.warning(f"Validation errors: {validation_result['errors']}")
    # Optionally: fix errors or raise exception
```

## Troubleshooting

### Tests fail with import errors
- Make sure you're running from the `backend` directory
- Check that `PYTHONPATH` includes the backend directory

### Validation fails but script works
- Check if validation is too strict
- Some warnings are acceptable (e.g., missing error handling)

### Golden file comparison fails
- Output format may have changed intentionally
- Update the golden file with new expected output



