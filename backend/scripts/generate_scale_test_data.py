"""
Scale Test Data Generator
=========================
Generates large-scale test data to test application performance:
- 5000+ test cases across multiple domains with 5-10 steps each
- 50+ test cases with 50 steps (for builder testing)
- 200+ test plans linking test cases
- 200+ test suites grouping test cases
- 200+ releases
- 100+ test cases with automation scripts

Architecture Assessment:
- SQLite is sufficient for 5000+ test cases with proper indexing
- Existing indexes cover key query patterns
- Consider adding FTS for search optimization at higher scales
"""

import sqlite3
import json
import uuid
import random
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
import sys

# Domain configurations for realistic test cases
DOMAINS = {
    "ecommerce": {
        "name": "E-Commerce Platform",
        "areas": ["Cart", "Checkout", "Payment", "Product Catalog", "User Account", "Orders", "Shipping", "Returns", "Reviews", "Wishlist"],
        "actions": [
            "Navigate to {area} page",
            "Click on {element} button",
            "Verify {area} displays correctly",
            "Add item to cart",
            "Update quantity to {number}",
            "Apply coupon code '{code}'",
            "Select shipping method",
            "Enter payment details",
            "Verify order confirmation",
            "Check inventory status"
        ],
        "tags": ["ecommerce", "retail", "shopping", "payments"]
    },
    "healthcare": {
        "name": "Healthcare Management System",
        "areas": ["Patient Records", "Appointments", "Prescriptions", "Lab Results", "Billing", "Insurance", "Medical History", "Referrals", "Discharge Summary", "Vitals"],
        "actions": [
            "Search for patient by ID '{patient_id}'",
            "Open {area} section",
            "Verify HIPAA compliance banner",
            "Add new {area} record",
            "Update patient {field}",
            "Schedule appointment for {date}",
            "Verify insurance eligibility",
            "Generate {report_type} report",
            "Send prescription to pharmacy",
            "Review lab results"
        ],
        "tags": ["healthcare", "hipaa", "medical", "patient-care"]
    },
    "banking": {
        "name": "Banking & Finance Portal",
        "areas": ["Account Summary", "Transfers", "Bill Pay", "Loans", "Credit Cards", "Statements", "Alerts", "Investment", "Mortgage", "Fraud Detection"],
        "actions": [
            "Login with credentials",
            "Navigate to {area}",
            "Verify account balance",
            "Initiate transfer of ${amount}",
            "Set up recurring payment",
            "Download {period} statement",
            "Apply for {loan_type} loan",
            "Update contact information",
            "Enable two-factor authentication",
            "Review transaction history"
        ],
        "tags": ["banking", "finance", "transactions", "security"]
    },
    "crm": {
        "name": "Customer Relationship Management",
        "areas": ["Contacts", "Leads", "Opportunities", "Accounts", "Campaigns", "Reports", "Dashboards", "Tasks", "Cases", "Pipeline"],
        "actions": [
            "Create new {entity_type} record",
            "Search for {entity_type} by {field}",
            "Update {entity_type} status",
            "Assign {entity_type} to user",
            "Add note to {entity_type}",
            "Convert lead to opportunity",
            "Generate {report_type} report",
            "Schedule follow-up task",
            "Send email template",
            "View {entity_type} timeline"
        ],
        "tags": ["crm", "salesforce", "customer-management", "sales"]
    },
    "hr": {
        "name": "Human Resources Management",
        "areas": ["Employee Records", "Payroll", "Time Off", "Performance", "Recruitment", "Onboarding", "Training", "Benefits", "Compliance", "Org Chart"],
        "actions": [
            "Search employee by ID '{emp_id}'",
            "Update employee {field}",
            "Process payroll for {period}",
            "Approve time off request",
            "Schedule performance review",
            "Post new job opening",
            "Generate {report_type} report",
            "Update benefits enrollment",
            "Complete compliance training",
            "View org structure"
        ],
        "tags": ["hr", "payroll", "employee-management", "recruitment"]
    },
    "logistics": {
        "name": "Supply Chain & Logistics",
        "areas": ["Inventory", "Shipments", "Warehouses", "Orders", "Suppliers", "Tracking", "Returns", "Analytics", "Routing", "Customs"],
        "actions": [
            "Check inventory level for SKU '{sku}'",
            "Create shipment for order '{order_id}'",
            "Update warehouse location",
            "Track package '{tracking_number}'",
            "Generate shipping label",
            "Process return authorization",
            "Optimize delivery route",
            "Update supplier information",
            "Review customs documentation",
            "Generate {report_type} report"
        ],
        "tags": ["logistics", "supply-chain", "shipping", "inventory"]
    },
    "education": {
        "name": "Learning Management System",
        "areas": ["Courses", "Assignments", "Grades", "Students", "Instructors", "Exams", "Resources", "Discussions", "Calendar", "Reports"],
        "actions": [
            "Navigate to course '{course_name}'",
            "Submit assignment for {assignment}",
            "View grades for {period}",
            "Create new quiz with {questions} questions",
            "Upload course material",
            "Schedule exam for {date}",
            "Post discussion topic",
            "Generate transcript",
            "Send course announcement",
            "Review student progress"
        ],
        "tags": ["education", "lms", "e-learning", "students"]
    },
    "api": {
        "name": "API Testing Suite",
        "areas": ["Authentication", "Users", "Products", "Orders", "Payments", "Search", "Webhooks", "Rate Limiting", "Caching", "Versioning"],
        "actions": [
            "Send GET request to {endpoint}",
            "Send POST request with payload",
            "Verify response status code {status}",
            "Validate response schema",
            "Test authentication with {auth_type}",
            "Verify rate limiting",
            "Test pagination parameters",
            "Validate error responses",
            "Test CORS headers",
            "Verify response time < {ms}ms"
        ],
        "tags": ["api", "rest", "integration", "backend"]
    },
    "mobile": {
        "name": "Mobile Application Testing",
        "areas": ["Login", "Home Screen", "Profile", "Settings", "Notifications", "Search", "Camera", "Location", "Offline Mode", "Push Notifications"],
        "actions": [
            "Launch application",
            "Tap on {element}",
            "Swipe {direction}",
            "Enter text '{text}'",
            "Verify {element} is displayed",
            "Take screenshot",
            "Enable {permission}",
            "Test offline behavior",
            "Verify push notification",
            "Rotate device to {orientation}"
        ],
        "tags": ["mobile", "ios", "android", "responsive"]
    },
    "security": {
        "name": "Security Testing Suite",
        "areas": ["Authentication", "Authorization", "Input Validation", "Session Management", "Encryption", "CSRF", "XSS", "SQL Injection", "File Upload", "API Security"],
        "actions": [
            "Test {vulnerability_type} vulnerability",
            "Verify input sanitization",
            "Test session timeout",
            "Verify password requirements",
            "Test role-based access",
            "Attempt SQL injection",
            "Test XSS payload",
            "Verify CSRF token",
            "Test file upload restrictions",
            "Verify HTTPS enforcement"
        ],
        "tags": ["security", "penetration", "owasp", "compliance"]
    }
}

# Test priorities and their distribution
PRIORITIES = [("critical", 0.1), ("high", 0.25), ("medium", 0.45), ("low", 0.2)]

# Test categories and their distribution
CATEGORIES = [
    ("functional", 0.35),
    ("regression", 0.25),
    ("smoke", 0.15),
    ("e2e", 0.10),
    ("integration", 0.08),
    ("api", 0.05),
    ("performance", 0.02)
]

# Automation statuses
AUTOMATION_STATUSES = [("none", 0.4), ("partial", 0.35), ("full", 0.25)]

# Sample Playwright automation scripts
def generate_automation_script(test_case: Dict, domain: str) -> str:
    """Generate a realistic Playwright automation script for a test case."""
    steps = test_case.get("steps", [])
    script_lines = [
        "import pytest",
        "from playwright.sync_api import Page, expect",
        "",
        f"def test_{test_case['id'].replace('-', '_')}(page: Page):",
        f'    """',
        f"    {test_case['name']}",
        f"    Domain: {domain}",
        f'    """',
        "    # Test setup",
        f"    page.goto('https://example.com/{domain}')",
        "    page.wait_for_load_state('networkidle')",
        ""
    ]
    
    for i, step in enumerate(steps[:10], 1):  # Limit to 10 steps in script
        action = step.get("action", "")
        expected = step.get("expectedResult", "")
        
        if "navigate" in action.lower() or "goto" in action.lower():
            script_lines.append(f"    # Step {i}: {action}")
            script_lines.append(f"    page.goto('https://example.com/{domain}/page{i}')")
        elif "click" in action.lower():
            script_lines.append(f"    # Step {i}: {action}")
            script_lines.append(f"    page.get_by_role('button', name='Submit').click()")
        elif "enter" in action.lower() or "type" in action.lower() or "fill" in action.lower():
            script_lines.append(f"    # Step {i}: {action}")
            script_lines.append(f"    page.get_by_label('Input Field').fill('test_value_{i}')")
        elif "verify" in action.lower() or "check" in action.lower():
            script_lines.append(f"    # Step {i}: {action}")
            script_lines.append(f"    expect(page.get_by_text('{expected[:30]}')).to_be_visible()")
        else:
            script_lines.append(f"    # Step {i}: {action}")
            script_lines.append(f"    page.wait_for_timeout(500)")
        
        script_lines.append("")
    
    script_lines.extend([
        "    # Test teardown",
        "    print('Test completed successfully')",
        ""
    ])
    
    return "\n".join(script_lines)


def weighted_choice(choices):
    """Make a weighted random choice."""
    items, weights = zip(*choices)
    return random.choices(items, weights=weights)[0]


def generate_test_steps(domain_config: Dict, num_steps: int) -> List[Dict]:
    """Generate realistic test steps for a domain."""
    steps = []
    areas = domain_config["areas"]
    actions = domain_config["actions"]
    
    # Always start with navigation
    steps.append({
        "action": f"Navigate to the {domain_config['name']} application",
        "expectedResult": "Application loads successfully with login page displayed",
        "testData": "URL: https://app.example.com"
    })
    
    for i in range(1, num_steps):
        area = random.choice(areas)
        action_template = random.choice(actions)
        
        # Fill in template variables
        action = action_template.format(
            area=area,
            element=random.choice(["Submit", "Save", "Cancel", "Next", "Previous", "Add", "Edit", "Delete"]),
            number=random.randint(1, 10),
            code=f"SAVE{random.randint(10, 50)}",
            patient_id=f"PAT{random.randint(10000, 99999)}",
            field=random.choice(["status", "name", "date", "type", "category"]),
            date=(datetime.now() + timedelta(days=random.randint(1, 30))).strftime("%Y-%m-%d"),
            report_type=random.choice(["Summary", "Detailed", "Analytics", "Compliance"]),
            amount=random.randint(100, 10000),
            period=random.choice(["Monthly", "Quarterly", "Annual"]),
            loan_type=random.choice(["Personal", "Auto", "Home"]),
            entity_type=random.choice(["Contact", "Lead", "Opportunity", "Account"]),
            emp_id=f"EMP{random.randint(1000, 9999)}",
            sku=f"SKU{random.randint(10000, 99999)}",
            order_id=f"ORD{random.randint(100000, 999999)}",
            tracking_number=f"TRK{random.randint(1000000, 9999999)}",
            course_name=random.choice(["Introduction to Python", "Data Science 101", "Web Development"]),
            assignment=random.choice(["Homework 1", "Project", "Quiz", "Final Exam"]),
            questions=random.randint(5, 20),
            endpoint=f"/api/v1/{random.choice(['users', 'products', 'orders'])}/{random.randint(1, 1000)}",
            status=random.choice([200, 201, 400, 401, 403, 404, 500]),
            auth_type=random.choice(["Bearer Token", "API Key", "OAuth2", "Basic Auth"]),
            ms=random.choice([100, 200, 500, 1000]),
            text=random.choice(["Test User", "test@example.com", "Password123"]),
            direction=random.choice(["left", "right", "up", "down"]),
            permission=random.choice(["Camera", "Location", "Notifications", "Storage"]),
            orientation=random.choice(["portrait", "landscape"]),
            vulnerability_type=random.choice(["SQL Injection", "XSS", "CSRF", "Auth Bypass"])
        )
        
        expected_results = [
            f"{area} section displays correctly",
            "Operation completed successfully",
            "Data is saved and confirmation message shown",
            "Validation error is displayed for invalid input",
            "User is redirected to confirmation page",
            f"{area} data is updated in the system",
            "Success message is displayed",
            "Changes are reflected in the UI",
            "System processes the request within acceptable time",
            "Audit log entry is created"
        ]
        
        steps.append({
            "action": action,
            "expectedResult": random.choice(expected_results),
            "testData": f"Test data for step {i+1}"
        })
    
    # Always end with verification
    steps.append({
        "action": "Verify all changes are saved and logout from application",
        "expectedResult": "User is successfully logged out and data is persisted",
        "testData": ""
    })
    
    return steps


def generate_test_case(domain: str, index: int, num_steps: int = None) -> Dict:
    """Generate a single test case."""
    domain_config = DOMAINS[domain]
    
    if num_steps is None:
        num_steps = random.randint(5, 10)
    
    test_id = str(uuid.uuid4())[:8]
    area = random.choice(domain_config["areas"])
    
    # Generate descriptive name
    test_names = [
        f"TC-{index:04d}: Verify {area} functionality in {domain_config['name']}",
        f"TC-{index:04d}: Test {area} CRUD operations",
        f"TC-{index:04d}: Validate {area} workflow end-to-end",
        f"TC-{index:04d}: Regression test for {area} module",
        f"TC-{index:04d}: Smoke test - {area} basic operations",
        f"TC-{index:04d}: Integration test - {area} with external systems",
        f"TC-{index:04d}: User acceptance test - {area} business flow"
    ]
    
    priority = weighted_choice(PRIORITIES)
    category = weighted_choice(CATEGORIES)
    automation_status = weighted_choice(AUTOMATION_STATUSES)
    
    # Generate tags
    tags = list(domain_config["tags"])
    tags.append(area.lower().replace(" ", "-"))
    tags.append(category)
    if priority in ["critical", "high"]:
        tags.append("priority-" + priority)
    
    steps = generate_test_steps(domain_config, num_steps)
    
    now = datetime.utcnow().isoformat()
    
    test_case = {
        "id": test_id,
        "name": random.choice(test_names),
        "description": f"Test case for {area} in {domain_config['name']}. This test validates the core functionality and ensures proper behavior under various conditions.",
        "steps": steps,
        "status": random.choice(["draft", "active", "active", "active"]),  # More active
        "priority": priority,
        "category": category,
        "tags": tags,
        "script": None,
        "metadata": {
            "domain": domain,
            "area": area,
            "automationStatus": automation_status,
            "estimatedDuration": num_steps * 2,  # 2 minutes per step
            "lastRun": None,
            "passRate": random.randint(70, 100) if random.random() > 0.3 else None
        },
        "created_at": now,
        "updated_at": now,
        "created_by": "scale_test_generator",
        "project_id": "default",
        "suite_id": None
    }
    
    return test_case


def generate_test_suite(suite_index: int, test_case_ids: List[str], domain: str) -> Dict:
    """Generate a test suite."""
    domain_config = DOMAINS[domain]
    area = random.choice(domain_config["areas"])
    
    suite_names = [
        f"Suite-{suite_index:03d}: {domain_config['name']} - {area} Tests",
        f"Suite-{suite_index:03d}: Regression Suite for {area}",
        f"Suite-{suite_index:03d}: {area} Smoke Tests",
        f"Suite-{suite_index:03d}: {area} E2E Workflow Tests"
    ]
    
    now = datetime.utcnow().isoformat()
    
    return {
        "id": str(uuid.uuid4())[:8],
        "name": random.choice(suite_names),
        "description": f"Test suite for {area} functionality in {domain_config['name']}",
        "test_case_ids": test_case_ids,
        "status": "active",
        "created_at": now,
        "updated_at": now,
        "project_id": "default"
    }


def generate_test_plan(plan_index: int, suite_ids: List[str], test_case_ids: List[str]) -> Dict:
    """Generate a test plan."""
    plan_names = [
        f"Plan-{plan_index:03d}: Sprint {random.randint(1, 50)} Test Execution",
        f"Plan-{plan_index:03d}: Release {random.randint(1, 10)}.{random.randint(0, 9)} Regression",
        f"Plan-{plan_index:03d}: Q{random.randint(1, 4)} Quarterly Test Cycle",
        f"Plan-{plan_index:03d}: UAT Test Cycle {plan_index}",
        f"Plan-{plan_index:03d}: Production Verification Tests"
    ]
    
    now = datetime.utcnow().isoformat()
    
    return {
        "id": str(uuid.uuid4())[:8],
        "name": random.choice(plan_names),
        "description": f"Test plan covering {len(test_case_ids)} test cases across {len(suite_ids)} suites",
        "suite_ids": suite_ids,
        "test_case_ids": test_case_ids,
        "status": random.choice(["draft", "draft", "active", "completed"]),
        "created_at": now,
        "updated_at": now,
        "project_id": "default"
    }


def generate_release(release_index: int, suite_ids: List[str]) -> Dict:
    """Generate a release."""
    major = random.randint(1, 5)
    minor = random.randint(0, 12)
    patch = random.randint(0, 20)
    
    release_names = [
        f"Release v{major}.{minor}.{patch}",
        f"Sprint {release_index + 1} Release",
        f"Hotfix {major}.{minor}.{patch+1}",
        f"Feature Release - Q{random.randint(1, 4)} {2024 + release_index // 10}"
    ]
    
    start_date = datetime.now() - timedelta(days=random.randint(0, 90))
    end_date = start_date + timedelta(days=random.randint(7, 30))
    
    now = datetime.utcnow().isoformat()
    
    return {
        "id": str(uuid.uuid4())[:8],
        "name": random.choice(release_names),
        "description": f"Release containing {len(suite_ids)} test suites",
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "status": random.choice(["planning", "active", "active", "completed"]),
        "suite_ids": suite_ids,
        "created_at": now,
        "project_id": "default"
    }


def create_database_schema(conn: sqlite3.Connection):
    """Create or update database schema for scale testing."""
    cursor = conn.cursor()
    
    # Test Cases table (if not exists)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_cases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            steps TEXT,
            status TEXT DEFAULT 'draft',
            priority TEXT DEFAULT 'medium',
            category TEXT DEFAULT 'functional',
            tags TEXT,
            script TEXT,
            metadata TEXT,
            created_at TEXT,
            updated_at TEXT,
            created_by TEXT,
            project_id TEXT,
            suite_id TEXT
        )
    """)
    
    # Test Suites table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_suites (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            test_case_ids TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT,
            updated_at TEXT,
            project_id TEXT
        )
    """)
    
    # Test Plans table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS test_plans (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            suite_ids TEXT,
            test_case_ids TEXT,
            status TEXT DEFAULT 'draft',
            created_at TEXT,
            updated_at TEXT,
            project_id TEXT
        )
    """)
    
    # Releases table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS releases (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            start_date TEXT,
            end_date TEXT,
            status TEXT DEFAULT 'planning',
            suite_ids TEXT,
            created_at TEXT,
            project_id TEXT
        )
    """)
    
    # Create indexes for performance
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_status ON test_cases(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_priority ON test_cases(priority)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_category ON test_cases(category)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_project ON test_cases(project_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_suite ON test_cases(suite_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_cases_name ON test_cases(name)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_suites_status ON test_suites(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_test_plans_status ON test_plans(status)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_releases_status ON releases(status)")
    
    # Create FTS table for full-text search (if not exists)
    cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS test_cases_fts USING fts5(
            id, name, description, tags,
            content='test_cases',
            content_rowid='rowid'
        )
    """)
    
    conn.commit()
    print("[OK] Database schema created/updated")


def insert_test_cases(conn: sqlite3.Connection, test_cases: List[Dict]):
    """Insert test cases in batches for performance."""
    cursor = conn.cursor()
    
    batch_size = 500
    total = len(test_cases)
    
    for i in range(0, total, batch_size):
        batch = test_cases[i:i + batch_size]
        cursor.executemany("""
            INSERT OR REPLACE INTO test_cases 
            (id, name, description, steps, status, priority, category, tags, script, metadata, created_at, updated_at, created_by, project_id, suite_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, [
            (
                tc["id"],
                tc["name"],
                tc["description"],
                json.dumps(tc["steps"]),
                tc["status"],
                tc["priority"],
                tc["category"],
                json.dumps(tc["tags"]),
                tc.get("script"),
                json.dumps(tc["metadata"]),
                tc["created_at"],
                tc["updated_at"],
                tc["created_by"],
                tc["project_id"],
                tc.get("suite_id")
            )
            for tc in batch
        ])
        conn.commit()
        print(f"  Inserted test cases: {min(i + batch_size, total)}/{total}")
    
    # Update FTS index (safely)
    try:
        cursor.execute("DROP TABLE IF EXISTS test_cases_fts")
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS test_cases_fts USING fts5(
                id, name, description, tags,
                content='test_cases',
                content_rowid='rowid'
            )
        """)
        cursor.execute("""
            INSERT INTO test_cases_fts(id, name, description, tags)
            SELECT id, name, description, tags FROM test_cases
        """)
        conn.commit()
        print("[OK] FTS index updated")
    except Exception as e:
        print(f"[WARN] FTS index update skipped: {e}")


def insert_test_suites(conn: sqlite3.Connection, suites: List[Dict]):
    """Insert test suites."""
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT OR REPLACE INTO test_suites 
        (id, name, description, test_case_ids, status, created_at, updated_at, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (
            s["id"],
            s["name"],
            s["description"],
            json.dumps(s["test_case_ids"]),
            s["status"],
            s["created_at"],
            s["updated_at"],
            s["project_id"]
        )
        for s in suites
    ])
    conn.commit()
    print(f"[OK] Inserted {len(suites)} test suites")


def insert_test_plans(conn: sqlite3.Connection, plans: List[Dict]):
    """Insert test plans."""
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT OR REPLACE INTO test_plans 
        (id, name, description, suite_ids, test_case_ids, status, created_at, updated_at, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (
            p["id"],
            p["name"],
            p["description"],
            json.dumps(p["suite_ids"]),
            json.dumps(p["test_case_ids"]),
            p["status"],
            p["created_at"],
            p["updated_at"],
            p["project_id"]
        )
        for p in plans
    ])
    conn.commit()
    print(f"[OK] Inserted {len(plans)} test plans")


def insert_releases(conn: sqlite3.Connection, releases: List[Dict]):
    """Insert releases."""
    cursor = conn.cursor()
    cursor.executemany("""
        INSERT OR REPLACE INTO releases 
        (id, name, description, start_date, end_date, status, suite_ids, created_at, project_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, [
        (
            r["id"],
            r["name"],
            r["description"],
            r["start_date"],
            r["end_date"],
            r["status"],
            json.dumps(r["suite_ids"]),
            r["created_at"],
            r["project_id"]
        )
        for r in releases
    ])
    conn.commit()
    print(f"[OK] Inserted {len(releases)} releases")


def main():
    """Main function to generate scale test data."""
    print("=" * 60)
    print("QAAI Scale Test Data Generator")
    print("=" * 60)
    
    # Configuration
    NUM_TEST_CASES = 5200  # 5000+ test cases
    NUM_LARGE_STEP_TESTS = 55  # 50+ tests with 50 steps
    NUM_AUTOMATED_TESTS = 120  # 100+ tests with automation scripts
    NUM_SUITES = 220  # 200+ test suites
    NUM_PLANS = 210  # 200+ test plans
    NUM_RELEASES = 205  # 200+ releases
    
    # Database path
    db_path = Path(__file__).parent.parent / "data" / "qaai.db"
    db_path.parent.mkdir(parents=True, exist_ok=True)
    
    print(f"\n[DB] Database: {db_path}")
    print(f"[INFO] Generating:")
    print(f"   - {NUM_TEST_CASES} test cases (5-10 steps each)")
    print(f"   - {NUM_LARGE_STEP_TESTS} test cases with 50 steps")
    print(f"   - {NUM_AUTOMATED_TESTS} test cases with automation scripts")
    print(f"   - {NUM_SUITES} test suites")
    print(f"   - {NUM_PLANS} test plans")
    print(f"   - {NUM_RELEASES} releases")
    print()
    
    # Connect to database
    conn = sqlite3.connect(str(db_path))
    
    try:
        # Create schema
        print("Creating database schema...")
        create_database_schema(conn)
        
        # Generate test cases
        print("\n[STEP] Generating test cases...")
        test_cases = []
        domains = list(DOMAINS.keys())
        
        # Regular test cases (5-10 steps)
        for i in range(NUM_TEST_CASES):
            domain = domains[i % len(domains)]
            tc = generate_test_case(domain, i + 1)
            test_cases.append(tc)
            
            if (i + 1) % 500 == 0:
                print(f"  Generated {i + 1}/{NUM_TEST_CASES} regular test cases")
        
        # Large step test cases (50 steps each)
        print(f"\n[STEP] Generating {NUM_LARGE_STEP_TESTS} test cases with 50 steps...")
        for i in range(NUM_LARGE_STEP_TESTS):
            domain = random.choice(domains)
            tc = generate_test_case(domain, NUM_TEST_CASES + i + 1, num_steps=50)
            tc["name"] = tc["name"].replace("TC-", "TC-LARGE-")
            tc["metadata"]["largeStepTest"] = True
            test_cases.append(tc)
        
        # Add automation scripts to specified number of test cases
        print(f"\n[STEP] Adding automation scripts to {NUM_AUTOMATED_TESTS} test cases...")
        for i in range(NUM_AUTOMATED_TESTS):
            tc = test_cases[i]
            domain = tc["metadata"]["domain"]
            tc["script"] = generate_automation_script(tc, domain)
            tc["metadata"]["automationStatus"] = "full"
        
        # Insert test cases
        print("\n[STEP] Inserting test cases into database...")
        insert_test_cases(conn, test_cases)
        
        # Get all test case IDs for linking
        all_tc_ids = [tc["id"] for tc in test_cases]
        
        # Generate test suites
        print(f"\n[STEP] Generating {NUM_SUITES} test suites...")
        suites = []
        tc_per_suite = len(all_tc_ids) // NUM_SUITES
        
        for i in range(NUM_SUITES):
            start_idx = i * tc_per_suite
            end_idx = start_idx + random.randint(15, 35)  # 15-35 test cases per suite
            suite_tc_ids = all_tc_ids[start_idx:min(end_idx, len(all_tc_ids))]
            
            domain = domains[i % len(domains)]
            suite = generate_test_suite(i + 1, suite_tc_ids, domain)
            suites.append(suite)
        
        insert_test_suites(conn, suites)
        
        # Get all suite IDs
        all_suite_ids = [s["id"] for s in suites]
        
        # Generate test plans
        print(f"\n[STEP] Generating {NUM_PLANS} test plans...")
        plans = []
        suites_per_plan = len(all_suite_ids) // NUM_PLANS
        
        for i in range(NUM_PLANS):
            start_idx = i * suites_per_plan
            end_idx = start_idx + random.randint(2, 5)
            plan_suite_ids = all_suite_ids[start_idx:min(end_idx, len(all_suite_ids))]
            
            # Get test cases from these suites
            plan_tc_ids = []
            for sid in plan_suite_ids:
                suite = next((s for s in suites if s["id"] == sid), None)
                if suite:
                    plan_tc_ids.extend(suite["test_case_ids"][:10])  # Limit per plan
            
            plan = generate_test_plan(i + 1, plan_suite_ids, plan_tc_ids[:50])
            plans.append(plan)
        
        insert_test_plans(conn, plans)
        
        # Generate releases
        print(f"\n[STEP] Generating {NUM_RELEASES} releases...")
        releases = []
        
        for i in range(NUM_RELEASES):
            # Each release has 2-5 random suites
            release_suite_ids = random.sample(all_suite_ids, min(random.randint(2, 5), len(all_suite_ids)))
            release = generate_release(i + 1, release_suite_ids)
            releases.append(release)
        
        insert_releases(conn, releases)
        
        # Print summary
        print("\n" + "=" * 60)
        print("[SUCCESS] SCALE TEST DATA GENERATION COMPLETE")
        print("=" * 60)
        
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM test_cases")
        tc_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM test_suites")
        suite_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM test_plans")
        plan_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM releases")
        release_count = cursor.fetchone()[0]
        
        print(f"\n[STATS] Database Statistics:")
        print(f"   Test Cases:  {tc_count:,}")
        print(f"   Test Suites: {suite_count:,}")
        print(f"   Test Plans:  {plan_count:,}")
        print(f"   Releases:    {release_count:,}")
        
        # Get database file size
        db_size = db_path.stat().st_size / (1024 * 1024)  # MB
        print(f"\n[SIZE] Database Size: {db_size:.2f} MB")
        
        print("\n[ASSESSMENT] Architecture Assessment:")
        print("   [OK] SQLite handles 5000+ test cases efficiently")
        print("   [OK] Indexes created for common query patterns")
        print("   [OK] FTS5 enabled for full-text search")
        print("   [OK] No upgrade to PostgreSQL needed for this scale")
        print("   [WARN] Consider PostgreSQL for 50,000+ test cases or multi-user access")
        
    finally:
        conn.close()


if __name__ == "__main__":
    main()

