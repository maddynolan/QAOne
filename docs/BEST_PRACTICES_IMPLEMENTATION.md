# 📚 Best Practices Implementation for Test Case Generation
## Senior QA Expert Standards Applied

---

## ✅ Test Case Naming Convention

### Format: `TC_[Feature]_[Scenario]_[ExpectedResult]`

**Examples:**
- ✅ `TC_Login_ValidCredentials_ShouldAccessDashboard`
- ✅ `TC_Login_InvalidPassword_ShouldShowError`
- ✅ `TC_Checkout_ValidPayment_ShouldCompleteOrder`
- ❌ `test1`, `login_test`, `TC_Login`

**Best Practices:**
- Start with `TC_` prefix
- Include feature name
- Include scenario/condition
- Include expected outcome
- Use PascalCase
- Keep under 60 characters

---

## 📝 Test Case Structure

### Required Fields:
1. **Name**: Descriptive, follows naming convention
2. **Description**: 2-3 sentences explaining scenario
3. **Steps**: 3-7 focused, actionable steps
4. **Expected Result**: Specific, measurable outcome
5. **Priority**: critical, high, medium, low
6. **Tags**: Relevant categories

### Description Best Practices:
- Start with "Verify" or "Test"
- Include context (who, what, when)
- State the expected behavior
- 2-3 sentences maximum

**Example:**
```
"Verify user can successfully log in with valid email and password credentials. 
The system should authenticate the user and redirect to the dashboard upon 
successful login."
```

---

## 🎯 Test Coverage Requirements

### 1. Happy Path (Positive Tests)
- **Purpose**: Verify normal flow works
- **Coverage**: Valid inputs, successful operations
- **Example**: Valid login with correct credentials

### 2. Negative Cases
- **Purpose**: Verify error handling
- **Coverage**: Invalid inputs, error scenarios
- **Examples**: 
  - Invalid email format
  - Wrong password
  - Missing required fields

### 3. Edge Cases
- **Purpose**: Test boundary conditions
- **Coverage**: Limits, extremes, unusual inputs
- **Examples**:
  - Maximum input length
  - Special characters
  - Unicode characters
  - Very long strings

### 4. Boundary Conditions
- **Purpose**: Test limits and boundaries
- **Coverage**: Min/max values, empty/null
- **Examples**:
  - Empty string
  - Null value
  - Minimum value
  - Maximum value
  - One less than min
  - One more than max

---

## ✍️ Step Description Best Practices

### Format:
```
[Action Verb] [Object] [Details] → [Expected Result]
```

### Action Verbs:
- Navigate, Click, Enter, Select, Verify, Check, Submit, Wait, Scroll

### Best Practices:
1. **Start with action verb**
   - ✅ "Click Submit button"
   - ❌ "The submit button should be clicked"

2. **Be specific**
   - ✅ "Enter email 'user@example.com'"
   - ❌ "Enter email"

3. **Include data values**
   - ✅ "Enter password 'SecurePass123!'"
   - ❌ "Enter password"

4. **One action per step**
   - ✅ Step 1: Navigate to page
   - ✅ Step 2: Enter email
   - ❌ Step 1: Navigate to page and enter email

5. **Expected result should be measurable**
   - ✅ "User redirected to dashboard"
   - ✅ "Error message 'Invalid email' displayed"
   - ❌ "Something happens"

### Step Count:
- **Optimal**: 3-7 steps
- **Minimum**: 3 steps (too simple = not a test case)
- **Maximum**: 7 steps (too complex = break into multiple test cases)

---

## 🔄 Automation Test Patterns

### Playwright Best Practices:

1. **Use Stable Selectors**
   ```typescript
   // ✅ Good
   await page.click('[data-testid="login-button"]');
   
   // ❌ Bad
   await page.click('div.container > button:nth-child(3)');
   ```

2. **Proper Waits**
   ```typescript
   // ✅ Good
   await page.waitForSelector('[data-testid="dashboard"]');
   
   // ❌ Bad
   await page.waitForTimeout(5000);
   ```

3. **Clear Assertions**
   ```typescript
   // ✅ Good
   await expect(page.locator('[data-testid="welcome"]')).toBeVisible();
   
   // ❌ Bad
   expect(page.url()).toContain('dashboard');
   ```

---

## ⚡ Performance Test Patterns

### k6 Load Testing:

1. **Virtual Users**
   ```javascript
   export let options = {
     stages: [
       { duration: '2m', target: 100 },  // Ramp up
       { duration: '5m', target: 100 }, // Stay at 100
       { duration: '2m', target: 0 },    // Ramp down
     ],
   };
   ```

2. **Test Scenarios**
   - Load test: Normal expected load
   - Stress test: Beyond normal capacity
   - Spike test: Sudden traffic spikes
   - Endurance test: Long duration

3. **Metrics to Track**
   - Response time (p50, p95, p99)
   - Throughput (requests/second)
   - Error rate
   - Resource utilization

---

## ♿ Accessibility Compliance (WCAG 2.1 AA)

### Hardcoded Templates (No Inference):

All accessibility tests are pre-defined based on WCAG 2.1 AA requirements:

1. **1.1.1 Non-text Content**: Alt text for images
2. **1.3.1 Info and Relationships**: Proper heading hierarchy
3. **1.4.3 Contrast**: Text contrast ratios
4. **2.1.1 Keyboard**: Keyboard accessibility
5. **2.4.1 Bypass Blocks**: Skip navigation links
6. **2.4.2 Page Titled**: Descriptive page titles
7. **2.4.3 Focus Order**: Logical tab order
8. **3.2.1 On Focus**: No context changes on focus
9. **4.1.1 Parsing**: Valid HTML markup
10. **4.1.2 Name, Role, Value**: Accessible names and roles

**Location**: `backend/app/services/accessibility_compliance.py`

**Usage**: No inference needed - all tests hardcoded and ready to use!

---

## 📊 Implementation Status

✅ **Enhanced Prompts**: Updated with best practices  
✅ **Accessibility Templates**: Hardcoded WCAG 2.1 AA compliance  
✅ **Continuous Collection**: Automated batch processing  
✅ **Quality Analysis**: JSON validity, completeness, structure  
✅ **Auto-Rating**: 1-5 star rating system  

---

**All best practices are now integrated into the collection system!** 🚀

