# 📊 Data Generation Explained

## How Test Cases Are Generated

### Source: Synthetic Generation
Test cases are **synthetically generated** using templates and patterns, not from real applications. This creates a diverse training corpus covering all test domains.

---

## Test Types Included ✅

### 1. **Functional Tests** ✅
- Happy path scenarios
- Positive test cases
- Core functionality validation

### 2. **Negative Tests** ✅
- Invalid input handling
- Error scenarios
- Validation failures

### 3. **Boundary Tests** ✅
- Edge cases
- Limit testing
- Boundary conditions

### 4. **Security Tests** ✅
- Access control
- Authentication/authorization
- Security vulnerabilities
- ZAP security scanning code

### 5. **Performance Tests** ✅
- Load testing scenarios
- Response time validation
- k6 performance scripts
- Performance under load

### 6. **Accessibility Tests** ✅
- WCAG compliance
- Keyboard navigation
- Screen reader support
- axe-core accessibility scripts

### 7. **API Tests** ✅
- REST API testing
- Endpoint validation
- pytest API test code

### 8. **UI Tests** ✅
- Playwright TypeScript
- Browser automation
- UI interaction testing

---

## Automation Code Generated

For each test type, the script generates **runnable automation code**:

1. **UI**: Playwright TypeScript code
2. **API**: pytest Python code
3. **Performance**: k6 JavaScript scripts
4. **Accessibility**: axe-core JavaScript
5. **Security**: ZAP Python scripts

---

## Data Distribution

### Default Configuration (2000 + 2000)

- **Test Cases**: 2000 examples
  - Mix of all test types (functional, negative, boundary, security, performance, accessibility)
  - Across 6 app types (ecommerce, CRM, Salesforce-like, banking, helpdesk, project management)
  - Multiple feature areas per app type

- **Automation Examples**: 2000 examples
  - UI automation: ~400 examples
  - API automation: ~400 examples
  - Performance: ~400 examples
  - Accessibility: ~400 examples
  - Security: ~400 examples

### Combined for Training

When combined, you get **~4000 total examples** covering:
- ✅ All test types
- ✅ All automation frameworks
- ✅ Multiple app types
- ✅ Various scenarios

---

## App Types Covered

1. **E-commerce**: login, search, cart, checkout, payments, order history
2. **CRM**: contacts, accounts, opportunities, tasks, reports
3. **Salesforce-like**: records, list views, search, workflows, dashboards
4. **Banking**: account overview, transfers, bill pay, statements, cards
5. **Helpdesk**: tickets, assignment, SLA, knowledge base, reporting
6. **Project Management**: projects, boards, tasks, sprints, burndown

---

## Test Type Distribution

Each test case is randomly assigned one of:
- `functional` (40%)
- `negative` (20%)
- `boundary` (15%)
- `security` (10%)
- `performance` (10%)
- `accessibility` (5%)

This ensures comprehensive coverage across all domains.

---

## What Gets Generated

### Task 1: Test Cases (`qa_test_cases.jsonl`)
```json
{
  "task": "generate_test_cases",
  "input": {
    "app_type": "ecommerce",
    "feature_area": "checkout",
    "requirement_text": "...",
    "non_functional_requirements": [...],
    "risk_notes": [...]
  },
  "output": {
    "test_cases": [{
      "id": "TC-ECOM-0001",
      "title": "...",
      "type": "security",  // or performance, accessibility, etc.
      "priority": "P0",
      "steps": [...],
      "expected_results": [...],
      "tags": ["@security", "@ui", "@env:staging"]
    }]
  }
}
```

### Task 2: Automation Code (`qa_automation_examples.jsonl`)
```json
{
  "task": "generate_automation",
  "input": {
    "automation_kind": "security",  // or api, performance, accessibility, ui
    "framework": "zap",
    "test_case": {...}
  },
  "output": {
    "script": "// ZAP security scan code...",
    "framework": "zap",
    "language": "python"
  }
}
```

---

## Training Data Quality

### Strengths
- ✅ Comprehensive coverage of all test types
- ✅ Realistic test scenarios
- ✅ Proper test structure
- ✅ Automation code included
- ✅ Multiple app types

### Limitations
- ⚠️ Synthetic (not from real apps)
- ⚠️ Generic selectors/endpoints
- ⚠️ May need real data later

### Recommendation
- Start with synthetic data (2000-4000 examples)
- Add real enterprise test cases as they become available
- Mix synthetic + real for best results

---

## Current Pipeline Configuration

**Default**: 2000 test cases + 2000 automation examples = **4000 total**

**Breakdown**:
- Functional: ~800
- Negative: ~400
- Boundary: ~300
- Security: ~400
- Performance: ~400
- Accessibility: ~200
- API: ~400
- UI: ~400

**All test types are included!** ✅

---

## Next Steps

The pipeline will:
1. Generate this data automatically
2. Combine into training format
3. Transfer to DGX
4. Use for finetuning

You can increase counts if needed:
```bash
python scripts/dgx_pipeline_optimized.py --test-cases 3000 --automation 3000
```




