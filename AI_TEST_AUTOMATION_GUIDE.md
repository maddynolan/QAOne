# 🤖 How to Use AI for Automated Test Creation and Execution

## Overview
Your QA AI platform provides powerful AI-driven test automation capabilities. Here's how to use it effectively:

## 🚀 Quick Start Guide

### 1. **Start the Backend Server**
```bash
cd backend
python test_simple.py
```
The server will run on `http://localhost:8001`

### 2. **Generate AI Test Cases**
Use natural language to describe what you want to test:

```python
import requests

# Example: Generate e-commerce checkout tests
response = requests.post("http://localhost:8001/ai/generate-tests", json={
    "org_id": "your_org",
    "project_id": "your_project", 
    "requirements": "Test e-commerce checkout process with payment validation",
    "context": {
        "app_url": "https://yourstore.com",
        "test_environment": "staging"
    }
})

test_cases = response.json()["cases"]
```

### 3. **Execute AI-Generated Tests**
```python
import asyncio
from backend.app.services.playwright_runner import PlaywrightRunner, TestCase, TestStep

async def run_ai_test(test_case_data):
    # Convert AI test case to Playwright format
    test_case = TestCase(
        case_id=test_case_data["case_id"],
        title=test_case_data["title"],
        description=test_case_data["description"],
        priority=test_case_data["priority"],
        tags=test_case_data["tags"],
        steps=[TestStep(**step) for step in test_case_data["steps"]]
    )
    
    # Execute with Playwright
    runner = PlaywrightRunner()
    await runner.initialize()
    result = await runner.run_test_case(test_case)
    await runner.cleanup()
    
    return result

# Run the test
result = asyncio.run(run_ai_test(test_cases[0]))
print(f"Test Status: {result.status}")
print(f"Screenshots: {len(result.screenshots)}")
```

## 🎯 AI Test Generation Examples

### **E-commerce Checkout Flow**
```python
requirements = "Test complete checkout process including cart, shipping, payment, and order confirmation"
context = {
    "app_url": "https://mystore.com",
    "test_environment": "staging"
}
```

**AI Generates:**
- Navigate to shopping cart
- Click checkout button  
- Fill shipping information
- Select payment method
- Enter payment details
- Submit order
- Verify order confirmation

### **User Authentication**
```python
requirements = "Test user login with valid/invalid credentials and password reset"
context = {
    "app_url": "https://myapp.com",
    "test_users": ["valid_user", "invalid_user"]
}
```

**AI Generates:**
- Navigate to login page
- Enter valid credentials
- Click login button
- Verify dashboard access
- Test invalid credentials
- Test password reset flow

### **Search Functionality**
```python
requirements = "Test search functionality with various queries and result validation"
context = {
    "app_url": "https://searchapp.com",
    "search_queries": ["product", "service", "invalid_query"]
}
```

**AI Generates:**
- Navigate to search page
- Enter search query
- Click search button
- Verify search results
- Test empty search
- Test special characters

## 🔧 Available Test Actions

The AI can generate tests with these actions:

| Action | Description | Example Data |
|--------|-------------|--------------|
| `Navigate` | Go to a URL | `{"url": "https://example.com"}` |
| `Click` | Click an element | `{"selector": "#button"}` |
| `Fill` | Fill form fields | `{"selector": "#input", "value": "text"}` |
| `Select` | Select dropdown option | `{"selector": "#select", "value": "option"}` |
| `Check` | Check checkbox | `{"selector": "#checkbox"}` |
| `Wait` | Wait for timeout | `{"timeout": 2000}` |
| `Verify` | Verify page state | `{"expected": "Title contains 'Welcome'"}` |

## 📊 Test Execution Features

### **Screenshot Capture**
Every test step captures screenshots for visual verification:
```python
result = await runner.run_test_case(test_case)
screenshots = result.screenshots  # Base64 encoded images
```

### **Detailed Logging**
Comprehensive execution logs for debugging:
```python
for log in result.logs:
    print(log)  # Step-by-step execution details
```

### **Error Handling**
Automatic error capture and reporting:
```python
if result.error:
    print(f"Test failed: {result.error}")
```

## 🌐 Frontend Integration

### **Using the React Frontend**
1. Start the frontend: `npm run dev`
2. Navigate to the Test Cases page
3. Click "Generate AI Tests"
4. Enter your requirements in natural language
5. Review and execute generated tests

### **API Endpoints**
- `GET /health` - Server health check
- `POST /ai/generate-tests` - Generate test cases from requirements

## 🎨 Customizing AI Test Generation

### **Context Parameters**
Provide context to improve test generation:

```python
context = {
    "app_url": "https://yourapp.com",
    "test_environment": "staging|production",
    "browser": "chrome|firefox|webkit",
    "test_users": ["user1", "user2"],
    "test_data": {"valid_email": "test@example.com"},
    "locator_strategy": "data-testid|id|class"
}
```

### **Requirements Keywords**
Use specific keywords to trigger different test types:

- **"checkout"** → E-commerce checkout flow
- **"login"** → Authentication tests  
- **"search"** → Search functionality tests
- **"form"** → Form validation tests
- **"navigation"** → Navigation tests
- **"api"** → API testing scenarios

## 🚀 Advanced Usage

### **Batch Test Generation**
```python
requirements_list = [
    "Test user registration flow",
    "Test product search and filtering", 
    "Test shopping cart functionality",
    "Test payment processing"
]

all_test_cases = []
for req in requirements_list:
    response = requests.post("http://localhost:8001/ai/generate-tests", json={
        "org_id": "batch_tests",
        "project_id": "ecommerce_suite",
        "requirements": req,
        "context": {"app_url": "https://mystore.com"}
    })
    all_test_cases.extend(response.json()["cases"])
```

### **Test Suite Execution**
```python
async def run_test_suite(test_cases):
    results = []
    for test_case_data in test_cases:
        test_case = convert_to_playwright_test(test_case_data)
        runner = PlaywrightRunner()
        await runner.initialize()
        result = await runner.run_test_case(test_case)
        await runner.cleanup()
        results.append(result)
    return results

# Execute all tests
results = asyncio.run(run_test_suite(all_test_cases))
```

## 📈 Best Practices

### **Writing Effective Requirements**
- Be specific: "Test checkout with credit card payment"
- Include context: "Test login on mobile devices"
- Mention edge cases: "Test checkout with invalid payment info"

### **Test Data Management**
- Use realistic test data
- Include both valid and invalid scenarios
- Consider different user types and permissions

### **Locator Strategy**
- Prefer `data-testid` attributes
- Use semantic selectors when possible
- Include fallback selectors in locator_hints

## 🔍 Troubleshooting

### **Common Issues**
1. **Server not running**: Start with `cd backend && python test_simple.py`
2. **Playwright not installed**: Run `playwright install`
3. **Test failures**: Check locator_hints and page load timing
4. **Unicode errors**: Use ASCII characters in Windows console

### **Debug Mode**
Enable detailed logging:
```python
import logging
logging.basicConfig(level=logging.DEBUG)
```

## 🎉 Success!

You now have a fully functional AI-powered test automation platform that can:
- ✅ Generate test cases from natural language
- ✅ Execute automated browser tests
- ✅ Capture screenshots and logs
- ✅ Handle complex test scenarios
- ✅ Integrate with your existing workflow

Start creating AI-powered tests today!


