"""
Prompt templates for different test types using Qwen 2.5 models
"""

# Manual Test Generation
PROMPT_REQ_TO_MANUAL_TESTS = """You are a senior QA engineer specializing in manual testing. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 comprehensive manual test cases covering:
- Positive scenarios (happy path)
- Negative scenarios (error handling)
- Edge cases (boundary conditions)
- Validation scenarios (input validation)

Each test case must have:
- title: Clear, descriptive test case name
- description: Detailed description of what is being tested
- preconditions: List of prerequisites (e.g., ["User is logged in", "Product exists in cart"])
- steps: Array of {{"action": "...", "expectedResult": "..."}}
- expected: Overall expected outcome
- priority: "low", "medium", "high", or "critical"
- tags: Array of relevant tags (e.g., ["login", "authentication", "ui"])

Return ONLY a valid JSON array. No explanations or markdown formatting.
[
  {{
    "title": "string",
    "description": "string",
    "preconditions": ["string"],
    "steps": [{{"action": "string", "expectedResult": "string"}}],
    "expected": "string",
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Automation Test Generation (Playwright)
PROMPT_REQ_TO_AUTOMATION_TESTS = """You are a test automation expert specializing in Playwright with TypeScript. Output JSON only.

Input requirement:
{requirement}

Generate 3-5 automation test cases covering:
- Core functionality automation
- UI element interactions
- Form submissions
- Navigation flows
- Error handling

Each test case must have:
- title: Clear test case name
- description: What the test automates
- preconditions: Setup requirements
- steps: Array of {{"action": "...", "expectedResult": "...", "selector": "..."}} with Playwright selectors
- expected: Expected outcome
- priority: "low", "medium", "high", or "critical"
- tags: ["automation", "playwright", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "preconditions": ["string"],
    "steps": [{{"action": "string", "expectedResult": "string", "selector": "string"}}],
    "expected": "string",
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Manual Test to Playwright Conversion
PROMPT_MANUAL_TO_PLAYWRIGHT = """You are a test automation expert. Convert the following manual test case to Playwright TypeScript code.

Manual Test Case:
{test_case}

Requirements:
- Use Playwright best practices
- Use data-testid or stable selectors (avoid brittle CSS selectors)
- Include proper imports: {{ test, expect }} from '@playwright/test'
- Add proper assertions using expect()
- Handle async operations correctly
- Include error handling where appropriate

Return ONLY the TypeScript code. No explanations, no markdown code blocks, just the code.
"""

# API Test Generation
PROMPT_REQ_TO_API_TESTS = """You are an API testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 API test cases covering:
- GET requests (retrieval)
- POST requests (creation)
- PUT/PATCH requests (updates)
- DELETE requests (deletion)
- Error handling (400, 401, 403, 404, 500)
- Validation scenarios

Each test case must have:
- title: Clear test case name
- description: What the API test verifies
- method: HTTP method (GET, POST, PUT, PATCH, DELETE)
- endpoint: API endpoint URL
- headers: Object with headers (e.g., {{"Content-Type": "application/json", "Authorization": "Bearer token"}})
- body: Request body (for POST/PUT/PATCH) as object
- query_params: Query parameters as object
- expected_status: Expected HTTP status code
- expected_response: Expected response structure or key fields
- priority: "low", "medium", "high", or "critical"
- tags: ["api", "rest", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "method": "string",
    "endpoint": "string",
    "headers": {{}},
    "body": {{}},
    "query_params": {{}},
    "expected_status": 200,
    "expected_response": {{}},
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Performance Test Generation
PROMPT_REQ_TO_PERFORMANCE_TESTS = """You are a performance testing expert specializing in load, stress, and endurance testing. Output JSON only.

Input requirement:
{requirement}

Generate 3-4 performance test cases covering:
- Load testing (normal expected load)
- Stress testing (above normal capacity)
- Endurance testing (sustained load over time)
- Spike testing (sudden traffic increases)

Each test case must have:
- title: Clear test case name
- description: Performance scenario being tested
- test_type: "load", "stress", "endurance", or "spike"
- virtual_users: Number of virtual users
- duration: Duration in seconds
- ramp_up: Ramp-up time in seconds
- expected_throughput: Expected requests per second
- expected_latency_p95: Expected 95th percentile latency in ms
- expected_error_rate: Maximum acceptable error rate (e.g., 0.01 for 1%)
- priority: "low", "medium", "high", or "critical"
- tags: ["performance", "load", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "test_type": "string",
    "virtual_users": 100,
    "duration": 300,
    "ramp_up": 60,
    "expected_throughput": 50,
    "expected_latency_p95": 200,
    "expected_error_rate": 0.01,
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Security Test Generation
PROMPT_REQ_TO_SECURITY_TESTS = """You are a security testing expert specializing in OWASP Top 10 and security vulnerabilities. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 security test cases covering:
- Authentication vulnerabilities (brute force, session hijacking)
- Authorization bypass attempts
- Injection attacks (SQL, XSS, command injection)
- Cross-Site Scripting (XSS)
- Cross-Site Request Forgery (CSRF)
- Sensitive data exposure
- Broken access control

Each test case must have:
- title: Clear test case name
- description: Security vulnerability being tested
- attack_vector: Type of attack (e.g., "SQL Injection", "XSS", "CSRF")
- payload: Attack payload or malicious input
- expected_behavior: How the system should handle the attack (e.g., "Should reject and return 400", "Should sanitize input")
- severity: "low", "medium", "high", or "critical"
- owasp_category: OWASP Top 10 category if applicable
- priority: "low", "medium", "high", or "critical"
- tags: ["security", "owasp", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "attack_vector": "string",
    "payload": "string",
    "expected_behavior": "string",
    "severity": "string",
    "owasp_category": "string",
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Accessibility Test Generation
PROMPT_REQ_TO_ACCESSIBILITY_TESTS = """You are an accessibility testing expert specializing in WCAG 2.1 AA compliance. Output JSON only.

Input requirement:
{requirement}

Generate 4-5 accessibility test cases covering:
- WCAG 2.1 Level AA compliance
- Keyboard navigation
- Screen reader compatibility
- Color contrast (WCAG AA: 4.5:1 for normal text, 3:1 for large text)
- ARIA labels and roles
- Focus management
- Alt text for images

Each test case must have:
- title: Clear test case name
- description: Accessibility aspect being tested
- wcag_guideline: WCAG guideline reference (e.g., "WCAG 2.1.1 Keyboard", "WCAG 1.4.3 Contrast")
- test_method: How to test (e.g., "Use keyboard only", "Use screen reader", "Check color contrast ratio")
- expected_result: Expected accessible behavior
- level: "A" or "AA" (WCAG compliance level)
- priority: "low", "medium", "high", or "critical"
- tags: ["accessibility", "wcag", "a11y", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "wcag_guideline": "string",
    "test_method": "string",
    "expected_result": "string",
    "level": "string",
    "priority": "string",
    "tags": ["string"]
  }}
]
"""

# Database Test Generation
PROMPT_REQ_TO_DATABASE_TESTS = """You are a database testing expert. Output JSON only.

Input requirement:
{requirement}

Generate 4-6 database test cases covering:
- Data integrity (CRUD operations)
- Transaction handling (rollback, commit)
- Data validation (constraints, foreign keys)
- Performance (query optimization, indexing)
- Data consistency
- Backup and recovery

Each test case must have:
- title: Clear test case name
- description: Database aspect being tested
- test_type: "integrity", "transaction", "validation", "performance", "consistency", or "recovery"
- sql_query: SQL query or operation to execute
- expected_result: Expected database state or query result
- data_setup: Required test data setup
- priority: "low", "medium", "high", or "critical"
- tags: ["database", "sql", ...]

Return ONLY a valid JSON array.
[
  {{
    "title": "string",
    "description": "string",
    "test_type": "string",
    "sql_query": "string",
    "expected_result": "string",
    "data_setup": "string",
    "priority": "string",
    "tags": ["string"]
  }}
]
"""


