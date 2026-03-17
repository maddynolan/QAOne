"""
Seed Demo Data for Flowstral/QAAI Platform
===========================================

Populates PostgreSQL with realistic demo content for sales demos and development.

Usage:
    python -m backend.app.scripts.seed_demo_data

Features:
    - Deterministic UUIDs (aaaaaaaa-XXXX-4000-a000-XXXXXXXXXXXX pattern)
    - Fully idempotent: ON CONFLICT ... DO UPDATE SET for every INSERT
    - Connection logic mirrors auto_migrate.py (DATABASE_URL or component env vars, SSL fallback)
    - Covers: orgs, projects, users, memberships, test plans, test cases (~50),
      test runs (~20), run steps, defects (10), requirements (8), API collections (5),
      API environments (3), accessibility scans (2) with issues (~20),
      performance runs (3) with metrics
"""

import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

# ---------------------------------------------------------------------------
# Deterministic UUID helpers
# ---------------------------------------------------------------------------

def _uuid(hex4: str) -> str:
    """Generate a deterministic UUID: aaaaaaaa-{hex4}-4000-a000-{hex4 * 3}."""
    h = hex4.lower().ljust(4, "0")[:4]
    suffix = (h * 3)[:12]
    return f"aaaaaaaa-{h}-4000-a000-{suffix}"


# ---------------------------------------------------------------------------
# Fixed IDs
# ---------------------------------------------------------------------------

# Organization
ORG_ACME = _uuid("0001")

# Projects
PROJ_WEB = _uuid("0010")
PROJ_MOBILE = _uuid("0011")
PROJ_API = _uuid("0012")

# Users
USER_SARAH = _uuid("0020")
USER_JAMES = _uuid("0021")
USER_EMMA = _uuid("0022")

# Test Plans
PLAN_LOGIN = _uuid("0030")
PLAN_CHECKOUT = _uuid("0031")
PLAN_REGRESSION = _uuid("0032")

# Test Case ID ranges
# Web: 0100..0124  (25 cases)
# Mobile: 0140..0154  (15 cases)
# API: 0170..0179  (10 cases)

# Test Run IDs: 0200..0219  (20 runs)
# Test Run Step IDs: 0300..0599
# Defect IDs: 0600..0609
# Requirement IDs: 0700..0707
# API Collection IDs: 0800..0804
# API Folder IDs: 0810..0819
# API Request IDs: 0820..0859
# API Environment IDs: 0860..0862
# Accessibility Scan IDs: 0900..0901
# Accessibility Issue IDs: 0910..0929
# Perf Run IDs: 0A00..0A02
# Perf Metric seed marker: run_id based (DELETE + INSERT)

NOW = datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Connection (mirrors auto_migrate.py)
# ---------------------------------------------------------------------------

def get_connection():
    """Connect to PostgreSQL using DATABASE_URL or component env vars."""
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 is not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    database_url = os.environ.get("DATABASE_URL", "")

    if not database_url:
        host = os.environ.get("POSTGRES_HOST", os.environ.get("PGHOST", "localhost"))
        port = os.environ.get("POSTGRES_PORT", os.environ.get("PGPORT", "5432"))
        db = os.environ.get("POSTGRES_DB", os.environ.get("PGDATABASE", "qaai"))
        user = os.environ.get("POSTGRES_USER", os.environ.get("PGUSER", "postgres"))
        pw = os.environ.get("POSTGRES_PASSWORD", os.environ.get("PGPASSWORD", "postgres"))
        database_url = f"postgresql://{user}:{pw}@{host}:{port}/{db}"

    sep = "&" if "?" in database_url else "?"
    attempts = [
        ("sslmode=require", database_url + sep + "sslmode=require"),
        ("sslmode=prefer", database_url + sep + "sslmode=prefer"),
        ("sslmode=disable", database_url + sep + "sslmode=disable"),
        ("as-is", database_url),
    ]

    for label, dsn in attempts:
        try:
            conn = psycopg2.connect(dsn, connect_timeout=5)
            conn.autocommit = False
            print(f"[SeedDemo] Connected to PostgreSQL ({label})")
            return conn
        except Exception as e:
            print(f"[SeedDemo] Connection ({label}) failed: {str(e)[:120]}")
            continue

    print("[SeedDemo] ERROR: All connection attempts failed.")
    sys.exit(1)


# ---------------------------------------------------------------------------
# JSON helper
# ---------------------------------------------------------------------------

def J(obj) -> str:
    """Serialize Python object to compact JSON string."""
    return json.dumps(obj, separators=(",", ":"))


# ---------------------------------------------------------------------------
# Seed functions
# ---------------------------------------------------------------------------

def seed_organization(cur):
    cur.execute("""
        INSERT INTO organizations (id, name, slug, description, settings, created_at, updated_at)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            slug = EXCLUDED.slug,
            description = EXCLUDED.description,
            settings = EXCLUDED.settings,
            updated_at = EXCLUDED.updated_at
    """, (
        ORG_ACME, "Acme Corp", "acme-corp",
        "Acme Corporation - Enterprise software company with web, mobile, and API products.",
        J({"theme": "blue", "sso_enabled": True, "max_projects": 20}),
        NOW - timedelta(days=180), NOW,
    ))
    print("  [1/12] Organization: Acme Corp")


def seed_projects(cur):
    projects = [
        (PROJ_WEB, ORG_ACME, "Acme Web Portal", "acme-web",
         "Customer-facing web portal with authentication, product catalog, shopping cart, and checkout.",
         J({"framework": "react", "ci": "github-actions", "environments": ["dev", "staging", "prod"]})),
        (PROJ_MOBILE, ORG_ACME, "Acme Mobile App", "acme-mobile",
         "iOS and Android mobile application with offline support, push notifications, and biometric auth.",
         J({"platforms": ["ios", "android"], "min_ios": "16.0", "min_android": "12"})),
        (PROJ_API, ORG_ACME, "Acme API Platform", "acme-api",
         "RESTful and GraphQL APIs powering the Acme product suite. Includes user, product, and order services.",
         J({"api_gateway": "kong", "rate_limit": 1000, "graphql_enabled": True})),
    ]
    for pid, oid, name, slug, desc, settings in projects:
        cur.execute("""
            INSERT INTO projects (id, org_id, name, slug, description, settings, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, slug = EXCLUDED.slug,
                description = EXCLUDED.description, settings = EXCLUDED.settings,
                updated_at = EXCLUDED.updated_at
        """, (pid, oid, name, slug, desc, settings, NOW - timedelta(days=160), NOW))
    print("  [2/12] Projects: 3 created")


def _hash_password(password: str) -> str:
    """Hash a password using PasswordService (bcrypt or SHA-512 fallback)."""
    from app.services.auth.password_service import PasswordService
    return PasswordService().hash_password(password)


# Pre-compute password hash for seed users (Password123! — meets all complexity requirements)
_SEED_PASSWORD_HASH = _hash_password("Password123!")


def seed_users(cur):
    users = [
        (USER_SARAH, "sarah@acme.com", "Sarah Chen",
         "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
         J({"theme": "dark", "notifications": True, "timezone": "America/New_York"})),
        (USER_JAMES, "james@acme.com", "James Wilson",
         "https://api.dicebear.com/7.x/avataaars/svg?seed=james",
         J({"theme": "light", "notifications": True, "timezone": "America/Chicago"})),
        (USER_EMMA, "emma@acme.com", "Emma Davis",
         "https://api.dicebear.com/7.x/avataaars/svg?seed=emma",
         J({"theme": "system", "notifications": False, "timezone": "Europe/London"})),
    ]
    for uid, email, name, avatar, prefs in users:
        cur.execute("""
            INSERT INTO users (id, email, name, avatar_url, preferences, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                email = EXCLUDED.email, name = EXCLUDED.name,
                avatar_url = EXCLUDED.avatar_url, preferences = EXCLUDED.preferences,
                updated_at = EXCLUDED.updated_at
        """, (uid, email, name, avatar, prefs, NOW - timedelta(days=170), NOW))

    # Set password_hash, auth_provider, is_active, email_verified for all seed users
    for uid, email, name, _, _ in users:
        cur.execute("""
            UPDATE users SET
                password_hash = %s,
                auth_provider = 'local',
                is_active = true,
                email_verified = true,
                email_verified_at = %s
            WHERE id = %s
        """, (_SEED_PASSWORD_HASH, NOW, uid))

    print("  [3/12] Users: 3 created (with password_hash + email_verified)")


def seed_memberships(cur):
    # Org memberships
    org_memberships = [
        (_uuid("0040"), ORG_ACME, USER_SARAH, "owner", None),
        (_uuid("0041"), ORG_ACME, USER_JAMES, "admin", USER_SARAH),
        (_uuid("0042"), ORG_ACME, USER_EMMA, "member", USER_SARAH),
    ]
    for mid, oid, uid, role, invited in org_memberships:
        cur.execute("""
            INSERT INTO org_memberships (id, org_id, user_id, role, invited_by, joined_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (org_id, user_id) DO UPDATE SET
                role = EXCLUDED.role,
                invited_by = EXCLUDED.invited_by
        """, (mid, oid, uid, role, invited, NOW - timedelta(days=170)))

    # Project memberships
    proj_memberships = [
        (_uuid("0050"), PROJ_WEB, USER_SARAH, "owner"),
        (_uuid("0051"), PROJ_WEB, USER_JAMES, "admin"),
        (_uuid("0052"), PROJ_WEB, USER_EMMA, "member"),
        (_uuid("0053"), PROJ_MOBILE, USER_SARAH, "admin"),
        (_uuid("0054"), PROJ_MOBILE, USER_JAMES, "owner"),
        (_uuid("0055"), PROJ_MOBILE, USER_EMMA, "member"),
        (_uuid("0056"), PROJ_API, USER_SARAH, "admin"),
        (_uuid("0057"), PROJ_API, USER_EMMA, "owner"),
        (_uuid("0058"), PROJ_API, USER_JAMES, "member"),
    ]
    for mid, pid, uid, role in proj_memberships:
        cur.execute("""
            INSERT INTO project_memberships (id, project_id, user_id, role)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (project_id, user_id) DO UPDATE SET
                role = EXCLUDED.role
        """, (mid, pid, uid, role))
    print("  [4/12] Memberships: 3 org + 9 project")


def seed_test_plans(cur):
    plans = [
        (PLAN_LOGIN, PROJ_WEB, "Sprint 24 - Login & Auth", "active", USER_SARAH,
         "Comprehensive testing for login, registration, password reset, SSO, and session management flows."),
        (PLAN_CHECKOUT, PROJ_WEB, "Sprint 24 - Checkout Flow", "active", USER_JAMES,
         "End-to-end checkout testing including cart management, payment processing, and order confirmation."),
        (PLAN_REGRESSION, PROJ_MOBILE, "v2.0 Release Regression", "draft", USER_JAMES,
         "Full regression suite for the v2.0 mobile app release covering all critical user journeys."),
    ]
    for pid, proj, name, status, creator, desc in plans:
        cur.execute("""
            INSERT INTO test_plans (id, project_id, name, description, status, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s::test_status, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, description = EXCLUDED.description,
                status = EXCLUDED.status, updated_at = EXCLUDED.updated_at
        """, (pid, proj, name, desc, status, creator, NOW - timedelta(days=14), NOW))
    print("  [5/12] Test Plans: 3 created")


def _make_steps(*step_tuples):
    """Build steps JSONB from (action, selector_or_url, value_or_expected, expectedResult) tuples."""
    steps = []
    for t in step_tuples:
        s = {"action": t[0]}
        if t[0] in ("navigate", "goto"):
            s["url"] = t[1]
        elif t[0] == "assert":
            s["selector"] = t[1]
            s["expected"] = t[2]
        elif t[0] == "fill":
            s["selector"] = t[1]
            s["value"] = t[2]
        elif t[0] in ("click", "hover", "scroll", "wait"):
            s["selector"] = t[1]
        elif t[0] == "select":
            s["selector"] = t[1]
            s["value"] = t[2]
        elif t[0] == "screenshot":
            s["name"] = t[1]
        s["expectedResult"] = t[-1]
        steps.append(s)
    return steps


def seed_test_cases(cur):
    cases = []
    idx = 0

    # ── Acme Web Portal (25 cases) ─────────────────────────────────────

    # Login flows (5)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Login with valid email and password", "P1", "e2e", "active",
        ["login", "auth", "smoke"], _make_steps(
            ("navigate", "https://acme.com/login", None, "Login page loads with email and password fields"),
            ("fill", "#email", "sarah@acme.com", "Email address entered"),
            ("fill", "#password", "SecurePass123!", "Password entered"),
            ("click", "button[type=submit]", None, "Login form submits"),
            ("assert", ".welcome-banner", "Welcome back, Sarah", "Welcome message displayed with user name"),
        ), ["User has a registered account"], 5, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Login with invalid password shows error", "P1", "e2e", "active",
        ["login", "auth", "negative"], _make_steps(
            ("navigate", "https://acme.com/login", None, "Login page loads"),
            ("fill", "#email", "sarah@acme.com", "Email entered"),
            ("fill", "#password", "WrongPassword!", "Invalid password entered"),
            ("click", "button[type=submit]", None, "Form submits"),
            ("assert", ".error-message", "Invalid credentials", "Error message displayed"),
        ), ["User has a registered account"], 3, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Login with SSO (Google OAuth)", "P2", "e2e", "active",
        ["login", "sso", "oauth"], _make_steps(
            ("navigate", "https://acme.com/login", None, "Login page loads"),
            ("click", "button.google-sso", None, "Google SSO button clicked"),
            ("assert", ".oauth-redirect", "accounts.google.com", "Redirected to Google OAuth"),
        ), ["Google OAuth configured"], 8, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Password reset flow sends email", "P2", "e2e", "active",
        ["auth", "password-reset"], _make_steps(
            ("navigate", "https://acme.com/forgot-password", None, "Forgot password page loads"),
            ("fill", "#email", "sarah@acme.com", "Email entered"),
            ("click", "button[type=submit]", None, "Reset request submitted"),
            ("assert", ".success-message", "Check your email", "Success confirmation shown"),
        ), ["User has a registered account"], 5, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Session expires after 30 minutes of inactivity", "P2", "automated", "active",
        ["auth", "session", "security"], _make_steps(
            ("navigate", "https://acme.com/login", None, "Login page loads"),
            ("fill", "#email", "sarah@acme.com", "Email entered"),
            ("fill", "#password", "SecurePass123!", "Password entered"),
            ("click", "button[type=submit]", None, "Login succeeds"),
            ("wait", "1800000", None, "Wait 30 minutes"),
            ("navigate", "https://acme.com/dashboard", None, "Navigate to protected page"),
            ("assert", "h1", "Sign In", "Redirected to login page"),
        ), ["Session timeout set to 30 minutes"], 35, USER_SARAH)); idx += 1

    # Registration (3)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "New user registration with email", "P1", "e2e", "active",
        ["registration", "auth"], _make_steps(
            ("navigate", "https://acme.com/register", None, "Registration page loads"),
            ("fill", "#name", "Test User", "Name entered"),
            ("fill", "#email", "newuser@test.com", "Email entered"),
            ("fill", "#password", "StrongPass456!", "Password entered"),
            ("fill", "#confirmPassword", "StrongPass456!", "Password confirmed"),
            ("click", "button[type=submit]", None, "Registration form submitted"),
            ("assert", ".verification-notice", "verify your email", "Email verification notice displayed"),
        ), [], 8, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Registration rejects weak password", "P2", "e2e", "active",
        ["registration", "validation", "negative"], _make_steps(
            ("navigate", "https://acme.com/register", None, "Registration page loads"),
            ("fill", "#name", "Test User", "Name entered"),
            ("fill", "#email", "test@test.com", "Email entered"),
            ("fill", "#password", "123", "Weak password entered"),
            ("click", "button[type=submit]", None, "Form submission attempted"),
            ("assert", ".password-error", "at least 8 characters", "Password strength error shown"),
        ), [], 4, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_LOGIN, "Registration blocks duplicate email", "P2", "e2e", "active",
        ["registration", "validation", "negative"], _make_steps(
            ("navigate", "https://acme.com/register", None, "Registration page loads"),
            ("fill", "#name", "Duplicate User", "Name entered"),
            ("fill", "#email", "sarah@acme.com", "Existing email entered"),
            ("fill", "#password", "StrongPass456!", "Password entered"),
            ("click", "button[type=submit]", None, "Form submitted"),
            ("assert", ".error-message", "already registered", "Duplicate email error displayed"),
        ), ["sarah@acme.com already registered"], 4, USER_EMMA)); idx += 1

    # Cart (5)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Add product to shopping cart", "P0", "e2e", "active",
        ["cart", "shopping", "smoke"], _make_steps(
            ("navigate", "https://acme.com/products", None, "Product catalog loads"),
            ("click", ".product-card:first-child .add-to-cart", None, "Add to Cart button clicked"),
            ("assert", ".cart-count", "1", "Cart badge shows 1 item"),
            ("click", ".cart-icon", None, "Cart icon clicked"),
            ("assert", ".cart-item", "1 item in cart", "Cart drawer shows the added product"),
        ), ["User is logged in", "Products exist in catalog"], 5, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Update item quantity in cart", "P1", "e2e", "active",
        ["cart", "shopping"], _make_steps(
            ("navigate", "https://acme.com/cart", None, "Cart page loads"),
            ("click", ".quantity-increase", None, "Increase quantity button clicked"),
            ("assert", ".item-quantity", "2", "Quantity updated to 2"),
            ("assert", ".cart-total", "$49.98", "Total recalculated correctly"),
        ), ["User has 1 item in cart at $24.99"], 5, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Remove item from cart", "P1", "e2e", "active",
        ["cart", "shopping"], _make_steps(
            ("navigate", "https://acme.com/cart", None, "Cart page loads with items"),
            ("click", ".remove-item", None, "Remove button clicked"),
            ("assert", ".empty-cart-message", "Your cart is empty", "Empty cart message displayed"),
        ), ["User has items in cart"], 3, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Apply discount code to cart", "P1", "e2e", "active",
        ["cart", "discount", "promo"], _make_steps(
            ("navigate", "https://acme.com/cart", None, "Cart page loads"),
            ("fill", "#discount-code", "SAVE20", "Discount code entered"),
            ("click", "#apply-discount", None, "Apply button clicked"),
            ("assert", ".discount-amount", "-$10.00", "20% discount applied"),
            ("assert", ".cart-total", "$39.99", "Total updated with discount"),
        ), ["User has $49.99 worth of items in cart", "SAVE20 code is valid for 20% off"], 6, USER_EMMA)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Cart persists across sessions", "P2", "automated", "active",
        ["cart", "persistence", "session"], _make_steps(
            ("navigate", "https://acme.com/products", None, "Product page loads"),
            ("click", ".product-card:first-child .add-to-cart", None, "Product added to cart"),
            ("navigate", "https://acme.com/logout", None, "User logs out"),
            ("navigate", "https://acme.com/login", None, "Login page loads"),
            ("fill", "#email", "sarah@acme.com", "Re-enter email"),
            ("fill", "#password", "SecurePass123!", "Re-enter password"),
            ("click", "button[type=submit]", None, "Login again"),
            ("navigate", "https://acme.com/cart", None, "Navigate to cart"),
            ("assert", ".cart-count", "1", "Cart still has the previously added item"),
        ), ["User is logged in"], 10, USER_SARAH)); idx += 1

    # Checkout (5)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Complete checkout with credit card", "P0", "e2e", "active",
        ["checkout", "payment", "smoke"], _make_steps(
            ("navigate", "https://acme.com/cart", None, "Cart page loads with items"),
            ("click", "#proceed-to-checkout", None, "Proceed to checkout"),
            ("fill", "#shipping-address", "123 Main St, New York, NY 10001", "Shipping address entered"),
            ("click", "#payment-method-card", None, "Credit card payment selected"),
            ("fill", "#card-number", "4242424242424242", "Test card number entered"),
            ("fill", "#card-expiry", "12/28", "Expiry entered"),
            ("fill", "#card-cvc", "123", "CVC entered"),
            ("click", "#place-order", None, "Place Order button clicked"),
            ("assert", ".order-confirmation", "Order placed successfully", "Order confirmation page shown"),
        ), ["User has items in cart", "Stripe test mode enabled"], 12, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Checkout with PayPal", "P1", "e2e", "active",
        ["checkout", "payment", "paypal"], _make_steps(
            ("navigate", "https://acme.com/checkout", None, "Checkout page loads"),
            ("click", "#payment-method-paypal", None, "PayPal payment selected"),
            ("assert", ".paypal-redirect", "paypal.com", "Redirected to PayPal"),
        ), ["User has items in cart", "PayPal sandbox enabled"], 10, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Checkout validates required shipping fields", "P2", "e2e", "active",
        ["checkout", "validation"], _make_steps(
            ("navigate", "https://acme.com/checkout", None, "Checkout page loads"),
            ("click", "#place-order", None, "Submit without filling fields"),
            ("assert", ".field-error-address", "Address is required", "Address validation error shown"),
            ("assert", ".field-error-city", "City is required", "City validation error shown"),
        ), ["User has items in cart"], 5, USER_EMMA)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Order confirmation email is sent", "P1", "e2e", "active",
        ["checkout", "email", "notification"], _make_steps(
            ("navigate", "https://acme.com/checkout", None, "Checkout page loads"),
            ("fill", "#shipping-address", "456 Oak Ave, Chicago, IL 60601", "Address filled"),
            ("click", "#payment-method-card", None, "Card payment selected"),
            ("fill", "#card-number", "4242424242424242", "Card number entered"),
            ("fill", "#card-expiry", "06/27", "Expiry entered"),
            ("fill", "#card-cvc", "456", "CVC entered"),
            ("click", "#place-order", None, "Order placed"),
            ("assert", ".email-sent-notice", "Confirmation email sent", "Email confirmation notice shown"),
        ), ["User has items in cart", "Email service configured"], 15, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, PLAN_CHECKOUT, "Checkout handles payment decline gracefully", "P1", "e2e", "active",
        ["checkout", "payment", "negative", "error-handling"], _make_steps(
            ("navigate", "https://acme.com/checkout", None, "Checkout page loads"),
            ("fill", "#shipping-address", "789 Elm St, Austin, TX 73301", "Address filled"),
            ("click", "#payment-method-card", None, "Card payment selected"),
            ("fill", "#card-number", "4000000000000002", "Decline test card entered"),
            ("fill", "#card-expiry", "12/28", "Expiry entered"),
            ("fill", "#card-cvc", "789", "CVC entered"),
            ("click", "#place-order", None, "Order submission attempted"),
            ("assert", ".payment-error", "Your card was declined", "Decline error message shown"),
        ), ["User has items in cart", "Stripe test mode"], 8, USER_JAMES)); idx += 1

    # Search (3)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Search returns relevant products", "P1", "e2e", "active",
        ["search", "product"], _make_steps(
            ("navigate", "https://acme.com/products", None, "Product catalog loads"),
            ("fill", "#search-input", "wireless headphones", "Search term entered"),
            ("click", "#search-submit", None, "Search submitted"),
            ("assert", ".search-results-count", "results", "Results count displayed"),
            ("assert", ".product-card:first-child .product-title", "headphones", "First result is relevant"),
        ), [], 5, USER_EMMA)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Search with no results shows empty state", "P3", "e2e", "active",
        ["search", "empty-state"], _make_steps(
            ("navigate", "https://acme.com/products", None, "Product catalog loads"),
            ("fill", "#search-input", "xyznonexistent123", "Nonsense search term entered"),
            ("click", "#search-submit", None, "Search submitted"),
            ("assert", ".no-results", "No products found", "Empty state message displayed"),
        ), [], 3, USER_EMMA)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Search filters by category", "P2", "e2e", "active",
        ["search", "filter", "category"], _make_steps(
            ("navigate", "https://acme.com/products", None, "Product catalog loads"),
            ("fill", "#search-input", "laptop", "Search term entered"),
            ("click", "#search-submit", None, "Search submitted"),
            ("select", "#category-filter", "Electronics", "Category filter applied"),
            ("assert", ".product-card", "Electronics", "All results are in Electronics category"),
        ), ["Products exist in Electronics category"], 6, USER_SARAH)); idx += 1

    # Profile (4)
    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Update profile display name", "P2", "ui", "active",
        ["profile", "settings"], _make_steps(
            ("navigate", "https://acme.com/profile", None, "Profile page loads"),
            ("fill", "#display-name", "Sarah J. Chen", "New display name entered"),
            ("click", "#save-profile", None, "Save button clicked"),
            ("assert", ".success-toast", "Profile updated", "Success notification shown"),
        ), ["User is logged in"], 4, USER_SARAH)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Upload profile avatar", "P3", "ui", "active",
        ["profile", "avatar", "upload"], _make_steps(
            ("navigate", "https://acme.com/profile", None, "Profile page loads"),
            ("click", ".avatar-upload", None, "Avatar upload area clicked"),
            ("fill", "input[type=file]", "/path/to/avatar.jpg", "Image file selected"),
            ("assert", ".avatar-preview", "avatar.jpg", "New avatar preview shown"),
            ("click", "#save-profile", None, "Save clicked"),
            ("assert", ".success-toast", "Profile updated", "Avatar saved successfully"),
        ), ["User is logged in"], 6, USER_JAMES)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Change notification preferences", "P3", "ui", "active",
        ["profile", "settings", "notifications"], _make_steps(
            ("navigate", "https://acme.com/settings/notifications", None, "Notification settings page loads"),
            ("click", "#email-notifications-toggle", None, "Email notifications toggled off"),
            ("click", "#save-preferences", None, "Preferences saved"),
            ("assert", ".success-toast", "Preferences updated", "Confirmation shown"),
        ), ["User is logged in"], 3, USER_EMMA)); idx += 1

    cases.append((_uuid(f"01{idx:02x}"), PROJ_WEB, None, "Delete account shows confirmation dialog", "P2", "ui", "active",
        ["profile", "account", "destructive"], _make_steps(
            ("navigate", "https://acme.com/settings/account", None, "Account settings page loads"),
            ("click", "#delete-account-btn", None, "Delete account button clicked"),
            ("assert", ".confirmation-dialog", "Are you sure", "Confirmation dialog appears"),
            ("assert", ".confirmation-dialog .warning", "cannot be undone", "Warning text displayed"),
        ), ["User is logged in"], 3, USER_SARAH)); idx += 1

    # ── Acme Mobile App (15 cases) ─────────────────────────────────────

    midx = 0
    # App launch (2)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "App cold start loads within 3 seconds", "P0", "performance", "active",
        ["mobile", "launch", "performance", "smoke"], _make_steps(
            ("navigate", "acme://launch", None, "App launches"),
            ("assert", ".splash-screen", "Acme", "Splash screen displayed"),
            ("assert", ".home-screen", "Home", "Home screen loaded within 3s"),
        ), ["App installed on device", "Device connected"], 5, USER_JAMES)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "App resumes from background correctly", "P1", "e2e", "active",
        ["mobile", "lifecycle", "background"], _make_steps(
            ("navigate", "acme://home", None, "App is on home screen"),
            ("click", "home-button", None, "Press device home button"),
            ("click", "app-switcher", None, "Return to app from app switcher"),
            ("assert", ".home-screen", "Home", "App resumes to previous state"),
        ), ["App installed and running"], 4, USER_JAMES)); midx += 1

    # Onboarding (3)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "First-time onboarding carousel completes", "P1", "e2e", "active",
        ["mobile", "onboarding", "first-run"], _make_steps(
            ("navigate", "acme://onboarding", None, "Onboarding screen shows for new install"),
            ("assert", ".onboarding-step", "Welcome to Acme", "First carousel slide shown"),
            ("click", ".next-button", None, "Swipe to next slide"),
            ("assert", ".onboarding-step", "Browse Products", "Second slide shown"),
            ("click", ".next-button", None, "Swipe to next slide"),
            ("assert", ".onboarding-step", "Fast Checkout", "Third slide shown"),
            ("click", ".get-started-button", None, "Get Started tapped"),
            ("assert", ".login-screen", "Sign In", "Login screen displayed"),
        ), ["Fresh app install"], 8, USER_JAMES)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Onboarding skip button works", "P2", "e2e", "active",
        ["mobile", "onboarding"], _make_steps(
            ("navigate", "acme://onboarding", None, "Onboarding screen displayed"),
            ("click", ".skip-button", None, "Skip button tapped"),
            ("assert", ".login-screen", "Sign In", "Immediately redirected to login"),
        ), ["Fresh app install"], 3, USER_EMMA)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Onboarding does not show on subsequent launches", "P2", "automated", "active",
        ["mobile", "onboarding", "persistence"], _make_steps(
            ("navigate", "acme://onboarding", None, "Complete onboarding"),
            ("click", ".get-started-button", None, "Finish onboarding"),
            ("navigate", "acme://restart", None, "Restart app"),
            ("assert", ".home-screen", "Home", "Goes directly to home, no onboarding"),
        ), ["Onboarding previously completed"], 5, USER_JAMES)); midx += 1

    # Push notifications (2)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Push notification opens correct deep link", "P1", "e2e", "active",
        ["mobile", "push", "deep-link"], _make_steps(
            ("navigate", "push://order-status/12345", None, "Tap push notification for order update"),
            ("assert", ".order-detail", "Order #12345", "Order detail screen opens"),
            ("assert", ".order-status", "Shipped", "Correct order status displayed"),
        ), ["Push notifications enabled", "Order #12345 exists"], 5, USER_SARAH)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Push notification permission prompt on first launch", "P2", "e2e", "active",
        ["mobile", "push", "permissions"], _make_steps(
            ("navigate", "acme://home", None, "Home screen loads after first login"),
            ("assert", ".permission-prompt", "notifications", "Push permission dialog appears"),
            ("click", ".allow-button", None, "Allow notifications tapped"),
            ("assert", ".notification-enabled", "enabled", "Notifications enabled confirmation"),
        ), ["First launch after login"], 4, USER_JAMES)); midx += 1

    # Offline mode (3)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "App shows cached products when offline", "P1", "e2e", "active",
        ["mobile", "offline", "cache"], _make_steps(
            ("navigate", "acme://products", None, "Products loaded online"),
            ("click", "airplane-mode-on", None, "Enable airplane mode"),
            ("navigate", "acme://products", None, "Navigate to products offline"),
            ("assert", ".product-list", "products", "Cached products displayed"),
            ("assert", ".offline-banner", "Offline", "Offline indicator shown"),
        ), ["Products previously loaded online"], 8, USER_EMMA)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Cart syncs after reconnecting", "P1", "e2e", "active",
        ["mobile", "offline", "sync"], _make_steps(
            ("click", "airplane-mode-on", None, "Enable airplane mode"),
            ("click", ".product-card .add-to-cart", None, "Add item to cart offline"),
            ("click", "airplane-mode-off", None, "Disable airplane mode"),
            ("assert", ".sync-indicator", "Synced", "Cart syncs with server"),
            ("assert", ".cart-count", "1", "Cart item appears on server"),
        ), ["App in airplane mode"], 10, USER_SARAH)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Offline error message when submitting order", "P2", "e2e", "active",
        ["mobile", "offline", "error-handling"], _make_steps(
            ("click", "airplane-mode-on", None, "Enable airplane mode"),
            ("navigate", "acme://checkout", None, "Navigate to checkout"),
            ("click", "#place-order", None, "Attempt to place order offline"),
            ("assert", ".offline-error", "connect to the internet", "Offline error message shown"),
        ), ["Items in cart", "Device in airplane mode"], 5, USER_JAMES)); midx += 1

    # Deep links (2)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, None, "Deep link to product page", "P2", "e2e", "active",
        ["mobile", "deep-link", "product"], _make_steps(
            ("navigate", "acme://product/SKU-12345", None, "Open product deep link"),
            ("assert", ".product-detail", "SKU-12345", "Product detail page loads"),
            ("assert", ".product-title", "Wireless Headphones", "Correct product displayed"),
        ), ["Product SKU-12345 exists"], 4, USER_EMMA)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, None, "Deep link with invalid ID shows error", "P3", "e2e", "active",
        ["mobile", "deep-link", "negative"], _make_steps(
            ("navigate", "acme://product/INVALID-999", None, "Open invalid deep link"),
            ("assert", ".error-screen", "not found", "Product not found error shown"),
            ("assert", ".back-button", "Back", "Back to home button available"),
        ), [], 3, USER_SARAH)); midx += 1

    # Biometric (3)
    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Biometric login with Face ID", "P1", "e2e", "active",
        ["mobile", "biometric", "face-id", "auth"], _make_steps(
            ("navigate", "acme://login", None, "Login screen loads"),
            ("click", ".biometric-login", None, "Tap Face ID login"),
            ("assert", ".biometric-prompt", "Face ID", "Face ID prompt appears"),
            ("click", "simulate-biometric-success", None, "Simulate successful Face ID"),
            ("assert", ".home-screen", "Home", "Logged in via biometric"),
        ), ["Face ID enrolled", "Biometric login enabled in settings"], 5, USER_JAMES)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Biometric fallback to password", "P2", "e2e", "active",
        ["mobile", "biometric", "fallback"], _make_steps(
            ("navigate", "acme://login", None, "Login screen loads"),
            ("click", ".biometric-login", None, "Tap biometric login"),
            ("click", "simulate-biometric-failure", None, "Simulate failed biometric"),
            ("assert", ".password-fallback", "Enter your password", "Password fallback shown"),
        ), ["Biometric login enabled"], 5, USER_SARAH)); midx += 1

    cases.append((_uuid(f"014{midx:01x}"), PROJ_MOBILE, PLAN_REGRESSION, "Biometric enrollment prompt in settings", "P3", "ui", "active",
        ["mobile", "biometric", "settings"], _make_steps(
            ("navigate", "acme://settings/security", None, "Security settings loads"),
            ("click", "#enable-biometric", None, "Enable biometric toggle tapped"),
            ("assert", ".biometric-enrollment", "authenticate", "Biometric enrollment prompt shown"),
        ), ["Biometric hardware available"], 4, USER_EMMA)); midx += 1

    # ── Acme API Platform (10 cases) ───────────────────────────────────

    aidx = 0
    # REST CRUD (4)
    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "GET /api/users returns paginated user list", "P1", "api", "active",
        ["api", "rest", "users", "get"], _make_steps(
            ("navigate", "GET https://api.acme.com/v1/users?page=1&limit=10", None, "Send GET request"),
            ("assert", "status", "200", "Status 200 OK"),
            ("assert", "body.data", "array", "Response contains data array"),
            ("assert", "body.pagination.total", "number", "Pagination metadata present"),
        ), ["API server running", "Auth token valid"], 3, USER_EMMA)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "POST /api/users creates new user", "P1", "api", "active",
        ["api", "rest", "users", "post"], _make_steps(
            ("navigate", "POST https://api.acme.com/v1/users", None, "Send POST request with user payload"),
            ("assert", "status", "201", "Status 201 Created"),
            ("assert", "body.id", "uuid", "New user ID returned"),
            ("assert", "body.email", "newuser@test.com", "Email matches request payload"),
        ), ["API server running", "Auth token with admin role"], 4, USER_EMMA)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "PUT /api/users/:id updates user profile", "P2", "api", "active",
        ["api", "rest", "users", "put"], _make_steps(
            ("navigate", "PUT https://api.acme.com/v1/users/123", None, "Send PUT request with updated data"),
            ("assert", "status", "200", "Status 200 OK"),
            ("assert", "body.name", "Updated Name", "Name field updated"),
            ("assert", "body.updated_at", "timestamp", "Updated timestamp changed"),
        ), ["User 123 exists", "Auth token valid"], 3, USER_SARAH)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "DELETE /api/users/:id returns 204", "P2", "api", "active",
        ["api", "rest", "users", "delete"], _make_steps(
            ("navigate", "DELETE https://api.acme.com/v1/users/456", None, "Send DELETE request"),
            ("assert", "status", "204", "Status 204 No Content"),
            ("navigate", "GET https://api.acme.com/v1/users/456", None, "Verify deletion"),
            ("assert", "status", "404", "User no longer found"),
        ), ["User 456 exists", "Auth token with admin role"], 4, USER_EMMA)); aidx += 1

    # GraphQL (3)
    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "GraphQL query for product details", "P1", "api", "active",
        ["api", "graphql", "product", "query"], _make_steps(
            ("navigate", "POST https://api.acme.com/graphql", None, "Send GraphQL query { product(id: 1) { name price } }"),
            ("assert", "status", "200", "Status 200 OK"),
            ("assert", "body.data.product.name", "string", "Product name returned"),
            ("assert", "body.data.product.price", "number", "Product price returned"),
        ), ["GraphQL endpoint enabled"], 3, USER_SARAH)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "GraphQL mutation creates order", "P1", "api", "active",
        ["api", "graphql", "order", "mutation"], _make_steps(
            ("navigate", "POST https://api.acme.com/graphql", None, "Send createOrder mutation"),
            ("assert", "status", "200", "Status 200 OK"),
            ("assert", "body.data.createOrder.id", "string", "Order ID returned"),
            ("assert", "body.data.createOrder.status", "PENDING", "Order status is PENDING"),
        ), ["GraphQL endpoint enabled", "Valid auth token"], 5, USER_EMMA)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "GraphQL query with invalid field returns error", "P3", "api", "active",
        ["api", "graphql", "negative", "validation"], _make_steps(
            ("navigate", "POST https://api.acme.com/graphql", None, "Send query with invalid field"),
            ("assert", "status", "200", "Status 200 (GraphQL errors in body)"),
            ("assert", "body.errors[0].message", "Cannot query field", "Validation error returned"),
        ), ["GraphQL endpoint enabled"], 3, USER_SARAH)); aidx += 1

    # Auth tokens (2)
    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "Expired JWT returns 401 Unauthorized", "P0", "api", "active",
        ["api", "auth", "jwt", "security"], _make_steps(
            ("navigate", "GET https://api.acme.com/v1/users", None, "Send request with expired JWT"),
            ("assert", "status", "401", "Status 401 Unauthorized"),
            ("assert", "body.error", "Token expired", "Expiry error message returned"),
        ), ["Expired JWT token available"], 3, USER_EMMA)); aidx += 1

    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "Refresh token returns new access token", "P1", "api", "active",
        ["api", "auth", "jwt", "refresh"], _make_steps(
            ("navigate", "POST https://api.acme.com/v1/auth/refresh", None, "Send refresh token request"),
            ("assert", "status", "200", "Status 200 OK"),
            ("assert", "body.access_token", "string", "New access token returned"),
            ("assert", "body.expires_in", "3600", "Token expires in 1 hour"),
        ), ["Valid refresh token available"], 3, USER_SARAH)); aidx += 1

    # Rate limiting (1)
    cases.append((_uuid(f"017{aidx:01x}"), PROJ_API, None, "Rate limiter returns 429 after exceeding quota", "P1", "api", "active",
        ["api", "rate-limit", "security"], _make_steps(
            ("navigate", "GET https://api.acme.com/v1/products (x101)", None, "Send 101 requests rapidly"),
            ("assert", "status", "429", "Status 429 Too Many Requests"),
            ("assert", "headers.Retry-After", "number", "Retry-After header present"),
            ("assert", "body.error", "Rate limit exceeded", "Rate limit error message"),
        ), ["Rate limit set to 100/min"], 5, USER_EMMA)); aidx += 1

    # Insert all cases
    for c in cases:
        cid, proj, plan, title, priority, ttype, status, tags, steps, preconditions, est_time, creator = c
        cur.execute("""
            INSERT INTO test_cases (id, project_id, plan_id, title, priority, test_type, status,
                                    tags, steps, preconditions, estimated_time, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s::test_priority, %s::test_type, %s::test_status,
                    %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, priority = EXCLUDED.priority, test_type = EXCLUDED.test_type,
                status = EXCLUDED.status, tags = EXCLUDED.tags, steps = EXCLUDED.steps,
                preconditions = EXCLUDED.preconditions, estimated_time = EXCLUDED.estimated_time,
                updated_at = EXCLUDED.updated_at
        """, (
            cid, proj, plan, title, priority, ttype, status,
            tags, J(steps), preconditions, est_time, creator,
            NOW - timedelta(days=10), NOW,
        ))

    print(f"  [6/12] Test Cases: {len(cases)} created")
    return [c[0] for c in cases]  # return IDs for linking


def seed_test_runs(cur, case_ids):
    """Create 20 test runs with steps."""
    run_configs = [
        # (run_idx, project, plan, name, status, env, branch, days_ago, creator, step_count)
        (0, PROJ_WEB, PLAN_LOGIN, "Login Suite - Chrome Desktop", "passed", "staging", "main", 1, USER_SARAH, 10),
        (1, PROJ_WEB, PLAN_LOGIN, "Login Suite - Firefox", "passed", "staging", "main", 2, USER_SARAH, 8),
        (2, PROJ_WEB, PLAN_CHECKOUT, "Checkout E2E - Staging", "passed", "staging", "feat/checkout-v2", 2, USER_JAMES, 12),
        (3, PROJ_WEB, PLAN_CHECKOUT, "Checkout E2E - Production", "passed", "production", "main", 3, USER_JAMES, 12),
        (4, PROJ_WEB, None, "Search & Profile Smoke", "passed", "staging", "main", 4, USER_EMMA, 7),
        (5, PROJ_MOBILE, PLAN_REGRESSION, "Mobile Regression - iOS 17", "passed", "staging", "release/2.0", 3, USER_JAMES, 15),
        (6, PROJ_MOBILE, PLAN_REGRESSION, "Mobile Regression - Android 14", "passed", "staging", "release/2.0", 3, USER_JAMES, 14),
        (7, PROJ_API, None, "API Contract Tests", "passed", "dev", "main", 5, USER_EMMA, 10),
        (8, PROJ_API, None, "API Integration - Staging", "passed", "staging", "main", 6, USER_EMMA, 8),
        (9, PROJ_WEB, PLAN_LOGIN, "Full Suite Nightly", "passed", "staging", "main", 7, USER_SARAH, 10),
        (10, PROJ_WEB, PLAN_CHECKOUT, "Checkout - Card Decline Regression", "failed", "staging", "fix/payment-error", 1, USER_JAMES, 8),
        (11, PROJ_WEB, PLAN_LOGIN, "Login Suite - Safari WebKit", "failed", "staging", "main", 2, USER_SARAH, 6),
        (12, PROJ_MOBILE, PLAN_REGRESSION, "Mobile Push Notification Test", "failed", "staging", "feat/push-v3", 4, USER_JAMES, 5),
        (13, PROJ_API, None, "API Rate Limit Stress Test", "failed", "staging", "main", 5, USER_EMMA, 6),
        (14, PROJ_WEB, None, "Cross-Browser Compatibility", "failed", "staging", "main", 8, USER_EMMA, 10),
        (15, PROJ_WEB, PLAN_CHECKOUT, "Checkout Partial - Timeout Issues", "partial", "production", "hotfix/timeout", 1, USER_JAMES, 10),
        (16, PROJ_MOBILE, PLAN_REGRESSION, "Offline Sync Partial Run", "partial", "staging", "feat/offline-v2", 3, USER_SARAH, 8),
        (17, PROJ_API, None, "GraphQL Schema Validation", "partial", "dev", "feat/graphql-v2", 6, USER_EMMA, 7),
        (18, PROJ_WEB, PLAN_LOGIN, "Login Suite - Current Run", "running", "staging", "main", 0, USER_SARAH, 5),
        (19, PROJ_MOBILE, PLAN_REGRESSION, "Mobile E2E - In Progress", "running", "staging", "release/2.0", 0, USER_JAMES, 8),
    ]

    error_messages = [
        "TimeoutError: selector '#submit-btn' not found within 30000ms",
        "AssertionError: expected 'Welcome back' but got 'Error 500'",
        "Error: net::ERR_CONNECTION_REFUSED at https://api.acme.com/v1/auth",
        "TimeoutError: waiting for navigation to 'https://acme.com/checkout' timed out after 60000ms",
        "AssertionError: expected status 200 but received 503 Service Unavailable",
        "ElementNotFoundError: Could not find element matching '.cart-total' on page",
        "NetworkError: fetch failed for POST /api/v1/orders - ECONNRESET",
        "Error: Page crashed! (Chromium renderer process exited with code -1)",
    ]

    run_ids = []
    step_global_idx = 0

    for ri, proj, plan, name, status, env, branch, days_ago, creator, step_count in run_configs:
        run_id = _uuid(f"02{ri:02x}")
        run_ids.append(run_id)

        started = NOW - timedelta(days=days_ago, hours=2)
        completed = started + timedelta(minutes=step_count * 2) if status != "running" else None
        commit_hash = f"a{ri:02x}b{ri:02x}c" + "d" * 34

        cur.execute("""
            INSERT INTO test_runs (id, project_id, plan_id, name, status, environment, branch,
                                   commit, runner_version, started_at, completed_at,
                                   created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s::run_status, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, status = EXCLUDED.status, environment = EXCLUDED.environment,
                branch = EXCLUDED.branch, commit = EXCLUDED.commit,
                started_at = EXCLUDED.started_at, completed_at = EXCLUDED.completed_at,
                updated_at = EXCLUDED.updated_at
        """, (
            run_id, proj, plan, name, status, env, branch,
            commit_hash[:40], "flowstral-runner/3.13.2",
            started, completed, creator,
            started - timedelta(minutes=5), NOW,
        ))

        # Create steps for this run
        # Pick case_ids in a round-robin fashion
        for si in range(step_count):
            step_id = _uuid(f"03{step_global_idx:02x}")
            step_global_idx += 1
            case_id = case_ids[si % len(case_ids)]

            # Determine step status based on run status
            if status == "passed":
                s_status = "passed"
                s_error = None
                s_duration = 200 + (si * 137) % 2800
            elif status == "failed":
                if si == step_count - 1 or (si > 3 and si % 4 == 0):
                    s_status = "failed"
                    s_error = error_messages[step_global_idx % len(error_messages)]
                    s_duration = 30000 + (si * 213) % 5000
                else:
                    s_status = "passed"
                    s_error = None
                    s_duration = 150 + (si * 97) % 2500
            elif status == "partial":
                if si % 3 == 2:
                    s_status = "skipped"
                    s_error = None
                    s_duration = 0
                elif si == step_count - 2:
                    s_status = "failed"
                    s_error = error_messages[(step_global_idx + 3) % len(error_messages)]
                    s_duration = 15000 + (si * 311) % 10000
                else:
                    s_status = "passed"
                    s_error = None
                    s_duration = 300 + (si * 151) % 2000
            elif status == "running":
                if si < step_count // 2:
                    s_status = "passed"
                    s_error = None
                    s_duration = 250 + (si * 181) % 2200
                else:
                    s_status = "pending"
                    s_error = None
                    s_duration = 0
            else:
                s_status = "passed"
                s_error = None
                s_duration = 500

            s_started = started + timedelta(seconds=si * 30) if s_status != "pending" else None
            s_completed = s_started + timedelta(milliseconds=s_duration) if s_started and s_status != "pending" else None

            step_title = f"Step {si + 1}: Test case execution"

            cur.execute("""
                INSERT INTO test_run_steps (id, run_id, case_id, title, status, duration_ms,
                                            error_message, started_at, completed_at, created_at)
                VALUES (%s, %s, %s, %s, %s::step_status, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    title = EXCLUDED.title, status = EXCLUDED.status,
                    duration_ms = EXCLUDED.duration_ms, error_message = EXCLUDED.error_message,
                    started_at = EXCLUDED.started_at, completed_at = EXCLUDED.completed_at
            """, (
                step_id, run_id, case_id, step_title, s_status, s_duration,
                s_error, s_started, s_completed, s_started or started,
            ))

    print(f"  [7/12] Test Runs: {len(run_configs)} runs, ~{step_global_idx} steps")
    return run_ids


def seed_defects(cur, run_ids):
    defects = [
        (_uuid("0600"), PROJ_WEB, run_ids[10], "Login button unresponsive on mobile viewport",
         "Login button does not respond to taps on screens narrower than 375px. The click target area is too small and overlaps with the social login buttons.",
         "P0", "open", USER_JAMES, None, USER_SARAH),
        (_uuid("0601"), PROJ_WEB, run_ids[10], "Cart total miscalculated with discount codes",
         "When applying discount code SAVE20 to a cart with 3+ items, the total shows a negative discount amount. The percentage calculation does not account for per-item pricing tiers.",
         "P0", "in-progress", USER_SARAH, "ACME-1234", USER_JAMES),
        (_uuid("0602"), PROJ_WEB, run_ids[11], "Safari WebKit: CSS grid layout broken on checkout page",
         "The checkout page shipping address form uses CSS grid with subgrid which is not fully supported in older WebKit versions. Fields overlap on Safari 16.x.",
         "P1", "open", USER_EMMA, "ACME-1235", USER_SARAH),
        (_uuid("0603"), PROJ_MOBILE, run_ids[12], "Push notification deep link navigates to wrong screen",
         "Tapping a push notification for order status opens the product listing instead of the order detail page. The deep link URL scheme parser mishandles the order-status prefix.",
         "P1", "in-progress", USER_JAMES, "ACME-1236", USER_JAMES),
        (_uuid("0604"), PROJ_API, run_ids[13], "API rate limiter returns 500 instead of 429",
         "When exceeding the rate limit threshold, the API returns HTTP 500 Internal Server Error with a stack trace instead of the expected 429 Too Many Requests with Retry-After header.",
         "P1", "resolved", USER_EMMA, "ACME-1237", USER_EMMA),
        (_uuid("0605"), PROJ_WEB, run_ids[14], "Search autocomplete dropdown flickers on fast typing",
         "The search autocomplete dropdown flickers rapidly when typing more than 3 characters per second. Each keystroke triggers a full re-render of the dropdown component.",
         "P2", "open", USER_SARAH, None, USER_EMMA),
        (_uuid("0606"), PROJ_WEB, run_ids[15], "Checkout timeout on slow 3G connections",
         "The checkout payment processing step times out after 30 seconds on throttled connections. The timeout should be extended to 60 seconds or show a retry option.",
         "P2", "in-progress", USER_JAMES, "ACME-1238", USER_JAMES),
        (_uuid("0607"), PROJ_MOBILE, run_ids[16], "Offline cart items duplicated after sync",
         "Items added to cart while offline appear twice after reconnecting. The sync mechanism does not deduplicate based on product ID before merging.",
         "P2", "resolved", USER_SARAH, "ACME-1239", USER_SARAH),
        (_uuid("0608"), PROJ_WEB, run_ids[14], "Profile avatar upload accepts files larger than 5MB",
         "The avatar upload does not enforce the 5MB file size limit on the client side. Large files are sent to the server which then returns a 413 error.",
         "P3", "closed", USER_EMMA, None, USER_EMMA),
        (_uuid("0609"), PROJ_API, run_ids[17], "GraphQL introspection query leaks internal field names",
         "The GraphQL introspection endpoint exposes internal field names like _internalScore and __debugInfo that should be hidden in production environments.",
         "P3", "closed", USER_EMMA, "ACME-1240", USER_SARAH),
    ]
    for did, proj, run, title, desc, priority, status, assigned, jira, creator in defects:
        cur.execute("""
            INSERT INTO defects (id, project_id, run_id, title, description, priority, status,
                                 assigned_to, jira_id, created_by, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s::test_priority, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                priority = EXCLUDED.priority, status = EXCLUDED.status,
                assigned_to = EXCLUDED.assigned_to, jira_id = EXCLUDED.jira_id,
                updated_at = EXCLUDED.updated_at
        """, (
            did, proj, run, title, desc, priority, status,
            assigned, jira, creator,
            NOW - timedelta(days=5), NOW,
        ))
    print(f"  [8/12] Defects: {len(defects)} created")


def seed_requirements(cur):
    reqs = [
        (_uuid("0700"), PROJ_WEB, "jira", "ACME-100",
         "REQ-001: Users can register with email and password",
         "Users must be able to create an account using a valid email address and a password meeting complexity requirements (8+ chars, 1 uppercase, 1 number, 1 special char).",
         "User can fill registration form and submit\nEmail verification is sent\nPassword strength indicator shows feedback"),
        (_uuid("0701"), PROJ_WEB, "jira", "ACME-101",
         "REQ-002: Users can log in with SSO providers",
         "The platform must support Google and Microsoft SSO via OAuth 2.0 / OIDC. Users clicking SSO buttons are redirected to the provider and returned with an active session.",
         "Google SSO button redirects to Google\nMicrosoft SSO button redirects to Microsoft\nSession is created after redirect back"),
        (_uuid("0702"), PROJ_WEB, "jira", "ACME-102",
         "REQ-003: Shopping cart persists across browser sessions",
         "Cart contents must be stored server-side and survive browser restarts, logouts, and device switches for authenticated users.",
         "Cart items persist after logout/login\nCart items sync across devices\nGuest cart merges on login"),
        (_uuid("0703"), PROJ_WEB, "jira", "ACME-103",
         "REQ-004: Checkout supports credit card and PayPal payments",
         "The checkout flow must accept Visa, Mastercard, and American Express via Stripe, plus PayPal as an alternative. Failed payments show clear error messages.",
         "Credit card form validates card number\nPayPal redirects to PayPal\nDeclined cards show user-friendly error"),
        (_uuid("0704"), PROJ_MOBILE, "jira", "ACME-200",
         "REQ-005: Mobile app supports offline product browsing",
         "The mobile app must cache the product catalog locally and allow browsing products, viewing details, and adding to cart while offline. Changes sync when connectivity returns.",
         "Products viewable offline\nCart operations work offline\nSync occurs on reconnection"),
        (_uuid("0705"), PROJ_MOBILE, "manual", None,
         "REQ-006: Push notifications open relevant deep links",
         "Tapping a push notification must navigate the user to the relevant in-app screen using the deep link URL scheme.",
         "Order notifications open order detail\nPromo notifications open product page\nGeneric notifications open home screen"),
        (_uuid("0706"), PROJ_API, "jira", "ACME-300",
         "REQ-007: API enforces rate limiting at 100 requests per minute",
         "All API endpoints must enforce a sliding-window rate limit of 100 requests per minute per API key. Exceeded requests receive HTTP 429 with Retry-After header.",
         "Requests within limit succeed\n101st request returns 429\nRetry-After header present"),
        (_uuid("0707"), PROJ_API, "manual", None,
         "REQ-008: GraphQL API supports query complexity limits",
         "The GraphQL endpoint must reject queries exceeding a complexity score of 1000 to prevent abuse. Introspection should be disabled in production.",
         "Simple queries succeed\nComplex queries rejected with error\nIntrospection disabled in prod"),
    ]
    for rid, proj, source, source_ref, title, desc, acceptance in reqs:
        cur.execute("""
            INSERT INTO requirements (id, project_id, source, source_ref, title, description,
                                      acceptance_criteria, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title, description = EXCLUDED.description,
                source = EXCLUDED.source, source_ref = EXCLUDED.source_ref,
                acceptance_criteria = EXCLUDED.acceptance_criteria,
                updated_at = EXCLUDED.updated_at
        """, (
            rid, proj, source, source_ref, title, desc, acceptance,
            NOW - timedelta(days=30), NOW,
        ))
    print(f"  [9/12] Requirements: {len(reqs)} created")


def seed_api_collections(cur):
    collections = [
        (_uuid("0800"), PROJ_API, "User Service API",
         "RESTful API for user management — registration, authentication, profile CRUD, and role management.",
         "https://api.acme.com/v1", USER_EMMA),
        (_uuid("0801"), PROJ_API, "Product Catalog API",
         "Product catalog endpoints for listing, searching, filtering, and managing products.",
         "https://api.acme.com/v1", USER_SARAH),
        (_uuid("0802"), PROJ_API, "Order Service GraphQL",
         "GraphQL API for order management — create, update, query orders and order items.",
         "https://api.acme.com/graphql", USER_EMMA),
        (_uuid("0803"), PROJ_WEB, "Payment Gateway",
         "Stripe-based payment processing endpoints for charges, refunds, and status checks.",
         "https://api.acme.com/v1/payments", USER_JAMES),
        (_uuid("0804"), PROJ_MOBILE, "Mobile Backend",
         "Mobile-specific backend endpoints for device registration, push configuration, feature flags, and analytics.",
         "https://mobile-api.acme.com/v1", USER_JAMES),
    ]
    for cid, proj, name, desc, base_url, creator in collections:
        cur.execute("""
            INSERT INTO api_collections (id, project_id, name, description, base_url, created_by,
                                         created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, description = EXCLUDED.description,
                base_url = EXCLUDED.base_url, updated_at = EXCLUDED.updated_at
        """, (cid, proj, name, desc, base_url, creator, NOW - timedelta(days=20), NOW))

    # Folders
    folders = [
        (_uuid("0810"), _uuid("0800"), None, "Authentication", 0),
        (_uuid("0811"), _uuid("0800"), None, "User Management", 1),
        (_uuid("0812"), _uuid("0801"), None, "Products", 0),
        (_uuid("0813"), _uuid("0801"), None, "Categories", 1),
        (_uuid("0814"), _uuid("0802"), None, "Queries", 0),
        (_uuid("0815"), _uuid("0802"), None, "Mutations", 1),
        (_uuid("0816"), _uuid("0803"), None, "Transactions", 0),
        (_uuid("0817"), _uuid("0804"), None, "Device", 0),
        (_uuid("0818"), _uuid("0804"), None, "Configuration", 1),
    ]
    for fid, cid, parent, name, order in folders:
        cur.execute("""
            INSERT INTO api_collection_folders (id, collection_id, parent_folder_id, name, sort_order, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, sort_order = EXCLUDED.sort_order
        """, (fid, cid, parent, name, order, NOW - timedelta(days=18)))

    # Requests
    auth_header = J([{"key": "Authorization", "value": "Bearer {{access_token}}"}])
    content_json = J([{"key": "Content-Type", "value": "application/json"}])
    both_headers = J([
        {"key": "Authorization", "value": "Bearer {{access_token}}"},
        {"key": "Content-Type", "value": "application/json"},
    ])

    requests_data = [
        # User Service: Authentication folder
        (_uuid("0820"), _uuid("0800"), _uuid("0810"), "Login", "POST",
         "{{base_url}}/auth/login", "/auth/login", both_headers,
         '{"email": "sarah@acme.com", "password": "SecurePass123!"}', "json", 0),
        (_uuid("0821"), _uuid("0800"), _uuid("0810"), "Register", "POST",
         "{{base_url}}/auth/register", "/auth/register", content_json,
         '{"name": "New User", "email": "new@acme.com", "password": "StrongPass456!"}', "json", 1),
        (_uuid("0822"), _uuid("0800"), _uuid("0810"), "Refresh Token", "POST",
         "{{base_url}}/auth/refresh", "/auth/refresh", both_headers,
         '{"refresh_token": "{{refresh_token}}"}', "json", 2),

        # User Service: User Management folder
        (_uuid("0823"), _uuid("0800"), _uuid("0811"), "List Users", "GET",
         "{{base_url}}/users?page=1&limit=20", "/users", auth_header,
         None, "none", 0),
        (_uuid("0824"), _uuid("0800"), _uuid("0811"), "Get User by ID", "GET",
         "{{base_url}}/users/{{user_id}}", "/users/:id", auth_header,
         None, "none", 1),
        (_uuid("0825"), _uuid("0800"), _uuid("0811"), "Update User", "PUT",
         "{{base_url}}/users/{{user_id}}", "/users/:id", both_headers,
         '{"name": "Updated Name", "email": "updated@acme.com"}', "json", 2),
        (_uuid("0826"), _uuid("0800"), _uuid("0811"), "Delete User", "DELETE",
         "{{base_url}}/users/{{user_id}}", "/users/:id", auth_header,
         None, "none", 3),
        (_uuid("0827"), _uuid("0800"), _uuid("0811"), "Get User Profile", "GET",
         "{{base_url}}/users/me/profile", "/users/me/profile", auth_header,
         None, "none", 4),

        # Product Catalog: Products folder
        (_uuid("0828"), _uuid("0801"), _uuid("0812"), "List Products", "GET",
         "{{base_url}}/products?page=1&limit=20", "/products", auth_header,
         None, "none", 0),
        (_uuid("0829"), _uuid("0801"), _uuid("0812"), "Get Product", "GET",
         "{{base_url}}/products/{{product_id}}", "/products/:id", auth_header,
         None, "none", 1),
        (_uuid("082a"), _uuid("0801"), _uuid("0812"), "Search Products", "GET",
         "{{base_url}}/products/search?q=wireless+headphones&limit=10", "/products/search", auth_header,
         None, "none", 2),
        (_uuid("082b"), _uuid("0801"), _uuid("0812"), "Create Product", "POST",
         "{{base_url}}/products", "/products", both_headers,
         '{"name": "Wireless Headphones Pro", "price": 79.99, "category": "electronics", "sku": "WHP-001"}', "json", 3),
        (_uuid("082c"), _uuid("0801"), _uuid("0812"), "Update Product", "PUT",
         "{{base_url}}/products/{{product_id}}", "/products/:id", both_headers,
         '{"name": "Wireless Headphones Pro v2", "price": 89.99}', "json", 4),

        # Product Catalog: Categories folder
        (_uuid("082d"), _uuid("0801"), _uuid("0813"), "List Categories", "GET",
         "{{base_url}}/categories", "/categories", auth_header,
         None, "none", 0),

        # Order Service GraphQL: Queries folder
        (_uuid("082e"), _uuid("0802"), _uuid("0814"), "Get Order by ID", "POST",
         "{{base_url}}", "/graphql", both_headers,
         '{"query": "query GetOrder($id: ID!) { order(id: $id) { id status total items { productId quantity price } createdAt } }", "variables": {"id": "ORD-12345"}}',
         "json", 0),
        (_uuid("082f"), _uuid("0802"), _uuid("0814"), "List My Orders", "POST",
         "{{base_url}}", "/graphql", both_headers,
         '{"query": "query MyOrders($page: Int, $limit: Int) { myOrders(page: $page, limit: $limit) { id status total createdAt } }", "variables": {"page": 1, "limit": 10}}',
         "json", 1),

        # Order Service GraphQL: Mutations folder
        (_uuid("0830"), _uuid("0802"), _uuid("0815"), "Create Order", "POST",
         "{{base_url}}", "/graphql", both_headers,
         '{"query": "mutation CreateOrder($input: OrderInput!) { createOrder(input: $input) { id status total } }", "variables": {"input": {"items": [{"productId": "PROD-001", "quantity": 2}], "shippingAddress": "123 Main St"}}}',
         "json", 0),
        (_uuid("0831"), _uuid("0802"), _uuid("0815"), "Cancel Order", "POST",
         "{{base_url}}", "/graphql", both_headers,
         '{"query": "mutation CancelOrder($id: ID!, $reason: String) { cancelOrder(id: $id, reason: $reason) { id status cancelledAt } }", "variables": {"id": "ORD-12345", "reason": "Changed my mind"}}',
         "json", 1),

        # Payment Gateway: Transactions folder
        (_uuid("0832"), _uuid("0803"), _uuid("0816"), "Charge Card", "POST",
         "{{base_url}}/charge", "/charge", both_headers,
         '{"amount": 4999, "currency": "usd", "source": "tok_visa", "description": "Order #12345"}', "json", 0),
        (_uuid("0833"), _uuid("0803"), _uuid("0816"), "Refund Charge", "POST",
         "{{base_url}}/refund", "/refund", both_headers,
         '{"charge_id": "ch_1234567890", "amount": 4999, "reason": "customer_request"}', "json", 1),
        (_uuid("0834"), _uuid("0803"), _uuid("0816"), "Get Payment Status", "GET",
         "{{base_url}}/status/{{charge_id}}", "/status/:id", auth_header,
         None, "none", 2),

        # Mobile Backend: Device folder
        (_uuid("0835"), _uuid("0804"), _uuid("0817"), "Register Device", "POST",
         "{{base_url}}/devices", "/devices", both_headers,
         '{"device_id": "D-ABC123", "platform": "ios", "os_version": "17.2", "app_version": "2.0.1", "push_token": "apns://token123"}',
         "json", 0),
        (_uuid("0836"), _uuid("0804"), _uuid("0817"), "Send Push Config", "POST",
         "{{base_url}}/push/config", "/push/config", both_headers,
         '{"device_id": "D-ABC123", "categories": ["orders", "promos", "security"], "quiet_hours": {"start": "22:00", "end": "08:00"}}',
         "json", 1),

        # Mobile Backend: Configuration folder
        (_uuid("0837"), _uuid("0804"), _uuid("0818"), "Get App Config", "GET",
         "{{base_url}}/config", "/config", auth_header,
         None, "none", 0),
        (_uuid("0838"), _uuid("0804"), _uuid("0818"), "Get Feature Flags", "GET",
         "{{base_url}}/feature-flags?platform=ios&version=2.0.1", "/feature-flags", auth_header,
         None, "none", 1),
        (_uuid("0839"), _uuid("0804"), _uuid("0818"), "Post Analytics Event", "POST",
         "{{base_url}}/analytics/events", "/analytics/events", both_headers,
         '{"events": [{"name": "product_viewed", "properties": {"product_id": "PROD-001"}, "timestamp": "2026-02-24T10:30:00Z"}]}',
         "json", 2),
    ]

    for rid, cid, fid, name, method, url, path, headers, body, body_type, order in requests_data:
        cur.execute("""
            INSERT INTO api_collection_requests (id, collection_id, folder_id, name, method, url, path,
                                                  headers, body, body_type, sort_order,
                                                  created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, method = EXCLUDED.method, url = EXCLUDED.url,
                path = EXCLUDED.path, headers = EXCLUDED.headers, body = EXCLUDED.body,
                body_type = EXCLUDED.body_type, sort_order = EXCLUDED.sort_order,
                updated_at = EXCLUDED.updated_at
        """, (
            rid, cid, fid, name, method, url, path,
            headers, body, body_type, order,
            NOW - timedelta(days=15), NOW,
        ))

    print(f"  [10a/12] API Collections: {len(collections)} collections, "
          f"{len(folders)} folders, {len(requests_data)} requests")


def seed_api_environments(cur):
    envs = [
        (_uuid("0860"), PROJ_API, "Development", True, USER_EMMA,
         J([
             {"key": "base_url", "value": "http://localhost:3000/v1", "secret": False},
             {"key": "access_token", "value": "dev-token-abc123", "secret": True},
             {"key": "refresh_token", "value": "dev-refresh-xyz789", "secret": True},
             {"key": "user_id", "value": "usr-dev-001", "secret": False},
             {"key": "product_id", "value": "prod-dev-001", "secret": False},
         ])),
        (_uuid("0861"), PROJ_API, "Staging", False, USER_EMMA,
         J([
             {"key": "base_url", "value": "https://staging-api.acme.com/v1", "secret": False},
             {"key": "access_token", "value": "stg-token-def456", "secret": True},
             {"key": "refresh_token", "value": "stg-refresh-uvw321", "secret": True},
             {"key": "user_id", "value": "usr-stg-001", "secret": False},
             {"key": "product_id", "value": "prod-stg-001", "secret": False},
         ])),
        (_uuid("0862"), PROJ_API, "Production", False, USER_SARAH,
         J([
             {"key": "base_url", "value": "https://api.acme.com/v1", "secret": False},
             {"key": "access_token", "value": "", "secret": True},
             {"key": "refresh_token", "value": "", "secret": True},
             {"key": "user_id", "value": "", "secret": False},
             {"key": "product_id", "value": "", "secret": False},
         ])),
    ]
    for eid, proj, name, is_active, creator, variables in envs:
        cur.execute("""
            INSERT INTO api_environments (id, project_id, name, variables, is_active, created_by,
                                          created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name, variables = EXCLUDED.variables,
                is_active = EXCLUDED.is_active, updated_at = EXCLUDED.updated_at
        """, (eid, proj, name, variables, is_active, creator, NOW - timedelta(days=18), NOW))
    print(f"  [10b/12] API Environments: {len(envs)} created")


def seed_accessibility(cur):
    scans = [
        (_uuid("0900"), "https://acme.com", PROJ_WEB),
        (_uuid("0901"), "https://acme.com/checkout", PROJ_WEB),
    ]
    for sid, url, proj in scans:
        cur.execute("""
            INSERT INTO accessibility_scans (id, url, project_id, created_at)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                url = EXCLUDED.url, project_id = EXCLUDED.project_id
        """, (sid, url, proj, NOW - timedelta(days=7)))

    issues = [
        # Scan 1: acme.com (12 issues)
        (_uuid("0910"), _uuid("0900"), "missing_alt_text", "critical",
         "Image element is missing alt text attribute, making it inaccessible to screen reader users.",
         "img.hero-banner", "1.1.1", '<img src="/images/hero-banner.jpg" class="hero-banner">'),
        (_uuid("0911"), _uuid("0900"), "missing_alt_text", "critical",
         "Product thumbnail image lacks alternative text description.",
         "img.product-thumb", "1.1.1", '<img src="/images/product-001.jpg" class="product-thumb">'),
        (_uuid("0912"), _uuid("0900"), "low_contrast", "serious",
         "Text color has insufficient contrast ratio of 2.8:1 against background. Minimum required is 4.5:1 for normal text.",
         "p.subtitle", "1.4.3", '<p class="subtitle" style="color: #999;">Browse our catalog</p>'),
        (_uuid("0913"), _uuid("0900"), "heading_hierarchy", "serious",
         "Heading hierarchy is broken: h4 element follows h2 without an h3 in between.",
         "h4.section-title", "1.3.1", '<h4 class="section-title">Featured Products</h4>'),
        (_uuid("0914"), _uuid("0900"), "missing_form_label", "serious",
         "Search input field does not have an associated label element or aria-label attribute.",
         "input#search", "1.3.1", '<input id="search" type="text" placeholder="Search...">'),
        (_uuid("0915"), _uuid("0900"), "keyboard_trap", "critical",
         "Modal dialog traps keyboard focus. Users cannot navigate out of the modal using Tab or Escape keys.",
         "div.promo-modal", "2.1.1", '<div class="promo-modal" tabindex="-1">'),
        (_uuid("0916"), _uuid("0900"), "missing_skip_link", "moderate",
         "Page does not contain a skip navigation link, requiring keyboard users to tab through all navigation items.",
         "body", "2.4.1", '<body><nav class="main-nav">...100+ links...</nav>'),
        (_uuid("0917"), _uuid("0900"), "missing_aria_label", "moderate",
         "Interactive button element has no accessible name. Screen readers will announce it as an unnamed button.",
         "button.icon-only", "4.1.2", '<button class="icon-only"><svg>...</svg></button>'),
        (_uuid("0918"), _uuid("0900"), "low_contrast", "moderate",
         "Footer link text has insufficient contrast ratio of 3.2:1 against dark background.",
         "a.footer-link", "1.4.3", '<a class="footer-link" style="color: #666;">Privacy Policy</a>'),
        (_uuid("0919"), _uuid("0900"), "missing_language", "minor",
         "The html element does not specify a lang attribute, which helps screen readers use correct pronunciation.",
         "html", "3.1.1", '<html>'),
        (_uuid("091a"), _uuid("0900"), "link_purpose", "minor",
         "Link text 'click here' does not describe its purpose. Use descriptive link text instead.",
         "a.generic-link", "2.4.4", '<a class="generic-link" href="/promo">click here</a>'),
        (_uuid("091b"), _uuid("0900"), "resize_text", "minor",
         "Text in the pricing card does not reflow properly when zoomed to 200%, causing horizontal scrolling.",
         "div.pricing-card", "1.4.4", '<div class="pricing-card" style="width: 300px;">'),

        # Scan 2: acme.com/checkout (8 issues)
        (_uuid("091c"), _uuid("0901"), "missing_form_label", "critical",
         "Credit card number input field has no associated label. Screen readers cannot identify this field.",
         "input#card-number", "1.3.1", '<input id="card-number" type="text" placeholder="Card Number">'),
        (_uuid("091d"), _uuid("0901"), "missing_form_label", "critical",
         "Expiration date input field lacks a label element or aria-label attribute.",
         "input#card-expiry", "1.3.1", '<input id="card-expiry" type="text" placeholder="MM/YY">'),
        (_uuid("091e"), _uuid("0901"), "error_identification", "serious",
         "Form validation errors are only indicated by red color, not by text. Users with color vision deficiency cannot identify errors.",
         "div.form-errors", "1.3.1", '<div class="form-errors" style="color: red;">Invalid</div>'),
        (_uuid("091f"), _uuid("0901"), "missing_aria_label", "serious",
         "The payment method radio buttons group has no fieldset/legend or group label.",
         "div.payment-methods", "4.1.2", '<div class="payment-methods"><input type="radio" name="payment">'),
        (_uuid("0920"), _uuid("0901"), "keyboard_navigation", "serious",
         "The Place Order button cannot be reached via keyboard navigation. Tab order skips from CVC field to footer.",
         "button#place-order", "2.1.1", '<button id="place-order" tabindex="-1">Place Order</button>'),
        (_uuid("0921"), _uuid("0901"), "low_contrast", "moderate",
         "Placeholder text in address fields has a contrast ratio of only 2.1:1, below the 4.5:1 minimum.",
         "input#address", "1.4.3", '<input id="address" placeholder="Enter your address" style="color: #bbb;">'),
        (_uuid("0922"), _uuid("0901"), "focus_visible", "moderate",
         "Focus indicator is removed from form inputs, making it impossible for keyboard users to see which field is active.",
         "input.checkout-input", "2.4.7", '<input class="checkout-input" style="outline: none;">'),
        (_uuid("0923"), _uuid("0901"), "timing_adjustable", "minor",
         "The checkout session expires after 15 minutes without option to extend, which may not be enough for users with disabilities.",
         "div.session-timer", "2.2.1", '<div class="session-timer">15:00 remaining</div>'),
    ]
    for iid, sid, itype, severity, desc, element, wcag, snippet in issues:
        proj = PROJ_WEB
        cur.execute("""
            INSERT INTO accessibility_issues (id, scan_id, type, severity, description, element,
                                              wcag_reference, code_snippet, project_id, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                type = EXCLUDED.type, severity = EXCLUDED.severity,
                description = EXCLUDED.description, element = EXCLUDED.element,
                wcag_reference = EXCLUDED.wcag_reference, code_snippet = EXCLUDED.code_snippet
        """, (iid, sid, itype, severity, desc, element, wcag, snippet, proj, NOW - timedelta(days=7)))

    print(f"  [11/12] Accessibility: {len(scans)} scans, {len(issues)} issues")


def seed_performance(cur):
    perf_runs = [
        (_uuid("0a00"), PROJ_WEB, "Homepage Load Test",
         "// Flowstral Load Test: Homepage\nimport http from 'k6/http';\nimport { check } from 'k6';\n\nexport default function() {\n  const res = http.get('https://acme.com');\n  check(res, { 'status 200': (r) => r.status === 200 });\n}",
         J({"virtual_users": 50, "duration_seconds": 60, "ramp_up_seconds": 10, "load_pattern": "ramp"}),
         J({
             "summary": {
                 "total_requests": 4820, "successful_requests": 4795, "failed_requests": 25,
                 "avg_response_time_ms": 245, "p50_ms": 180, "p95_ms": 520, "p99_ms": 1250,
                 "requests_per_second": 80.3, "error_rate_percent": 0.52,
                 "min_response_time_ms": 42, "max_response_time_ms": 3200,
             },
             "status": "completed", "started_at": (NOW - timedelta(days=5)).isoformat(),
             "completed_at": (NOW - timedelta(days=5) + timedelta(seconds=70)).isoformat(),
         })),
        (_uuid("0a01"), PROJ_API, "API Stress Test",
         "// Flowstral Load Test: API Stress\nimport http from 'k6/http';\n\nexport default function() {\n  http.get('https://api.acme.com/v1/products');\n  http.post('https://api.acme.com/v1/orders', JSON.stringify({items: [{id: 1, qty: 1}]}));\n}",
         J({"virtual_users": 200, "duration_seconds": 120, "ramp_up_seconds": 30, "load_pattern": "stress"}),
         J({
             "summary": {
                 "total_requests": 28400, "successful_requests": 27100, "failed_requests": 1300,
                 "avg_response_time_ms": 890, "p50_ms": 650, "p95_ms": 2100, "p99_ms": 4500,
                 "requests_per_second": 236.7, "error_rate_percent": 4.58,
                 "min_response_time_ms": 85, "max_response_time_ms": 12000,
             },
             "status": "completed", "started_at": (NOW - timedelta(days=3)).isoformat(),
             "completed_at": (NOW - timedelta(days=3) + timedelta(seconds=150)).isoformat(),
         })),
        (_uuid("0a02"), PROJ_WEB, "Checkout Flow Soak",
         "// Flowstral Load Test: Checkout Soak\nimport http from 'k6/http';\nimport { sleep } from 'k6';\n\nexport default function() {\n  http.get('https://acme.com/cart');\n  sleep(1);\n  http.post('https://acme.com/checkout', JSON.stringify({card: 'tok_visa'}));\n}",
         J({"virtual_users": 20, "duration_seconds": 300, "ramp_up_seconds": 15, "load_pattern": "soak"}),
         J({
             "summary": {
                 "total_requests": 5800, "successful_requests": 5780, "failed_requests": 20,
                 "avg_response_time_ms": 310, "p50_ms": 260, "p95_ms": 680, "p99_ms": 1100,
                 "requests_per_second": 19.3, "error_rate_percent": 0.34,
                 "min_response_time_ms": 95, "max_response_time_ms": 2800,
             },
             "status": "completed", "started_at": (NOW - timedelta(days=2)).isoformat(),
             "completed_at": (NOW - timedelta(days=2) + timedelta(seconds=315)).isoformat(),
         })),
    ]

    # Delete existing seed perf_metrics before reinserting (BIGSERIAL PK, not UUID)
    for run_id, proj, name, script, opts, result in perf_runs:
        cur.execute("DELETE FROM perf_metrics WHERE run_id = %s", (run_id,))

    for run_id, proj, name, script, opts, result in perf_runs:
        cur.execute("""
            INSERT INTO perf_runs (id, project_id, test_script, options, result, created_at)
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                test_script = EXCLUDED.test_script, options = EXCLUDED.options,
                result = EXCLUDED.result
        """, (run_id, proj, script, opts, result, NOW - timedelta(days=5)))

    # Metrics for each run
    metric_count = 0
    metrics_templates = [
        # (metric_name, value_fn, unit) — value_fn receives run_index and metric_index
        ("http_req_duration_avg", lambda ri, mi: 245 + ri * 300 + mi * 5, "ms"),
        ("http_req_duration_p50", lambda ri, mi: 180 + ri * 250 + mi * 4, "ms"),
        ("http_req_duration_p95", lambda ri, mi: 520 + ri * 700 + mi * 12, "ms"),
        ("http_req_duration_p99", lambda ri, mi: 1250 + ri * 1500 + mi * 25, "ms"),
        ("http_req_failed", lambda ri, mi: 0.5 + ri * 2.0 + mi * 0.1, "percent"),
        ("http_reqs", lambda ri, mi: 80 + ri * 75 - mi * 2, "rps"),
        ("vus", lambda ri, mi: [50, 200, 20][ri], "count"),
        ("http_req_sending", lambda ri, mi: 2 + ri * 0.5 + mi * 0.2, "ms"),
        ("http_req_receiving", lambda ri, mi: 8 + ri * 3 + mi * 0.5, "ms"),
        ("http_req_waiting", lambda ri, mi: 200 + ri * 280 + mi * 4, "ms"),
        ("data_sent", lambda ri, mi: 1.2 + ri * 3.5 + mi * 0.1, "MB"),
        ("data_received", lambda ri, mi: 5.8 + ri * 12 + mi * 0.3, "MB"),
    ]

    for ri, (run_id, proj, name, script, opts, result) in enumerate(perf_runs):
        duration = [60, 120, 300][ri]
        num_points = min(15, duration // 10)
        for mi in range(num_points):
            ts = NOW - timedelta(days=5 - ri) + timedelta(seconds=mi * (duration // num_points))
            for metric_name, value_fn, unit in metrics_templates:
                val = round(value_fn(ri, mi), 4)
                cur.execute("""
                    INSERT INTO perf_metrics (run_id, metric_name, value, unit, timestamp, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, (run_id, metric_name, val, unit, ts, ts))
                metric_count += 1

    print(f"  [12/12] Performance: {len(perf_runs)} runs, {metric_count} metrics")


def seed_subscriptions(cur):
    """Seed a trial subscription for the Acme Corp org."""
    sub_id = _uuid("0E00")
    cur.execute("""
        INSERT INTO subscriptions (id, org_id, plan, status, trial_start, trial_end,
            max_users, max_test_runs_per_month, max_projects, created_at, updated_at)
        VALUES (%s, %s, 'trial', 'active', %s, %s, 10, 5000, 5, %s, %s)
        ON CONFLICT (org_id) DO UPDATE SET
            plan = EXCLUDED.plan,
            status = EXCLUDED.status,
            trial_start = EXCLUDED.trial_start,
            trial_end = EXCLUDED.trial_end,
            updated_at = EXCLUDED.updated_at
    """, (sub_id, ORG_ACME, NOW, NOW + timedelta(days=14), NOW, NOW))
    print("  [13/13] Subscriptions: 1 trial (14 days)")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def _safe_seed(conn, cur, label, fn, *args):
    """Run a seed function inside a SAVEPOINT so failures don't rollback critical data."""
    try:
        cur.execute(f"SAVEPOINT sp_{label}")
        fn(cur, *args) if args else fn(cur)
    except Exception as e:
        cur.execute(f"ROLLBACK TO SAVEPOINT sp_{label}")
        print(f"  [{label}] SKIPPED: {str(e)[:100]}")


def main():
    print("=" * 60)
    print("  Flowstral Demo Data Seeder")
    print("=" * 60)

    conn = get_connection()
    cur = conn.cursor()

    # Check if already seeded (look for our sentinel org)
    cur.execute("SELECT EXISTS(SELECT 1 FROM organizations WHERE id = %s)", (ORG_ACME,))
    already_seeded = cur.fetchone()[0]
    if already_seeded:
        print(f"\n[SeedDemo] Demo data already exists (found Acme Corp).")
        print("[SeedDemo] Re-running in upsert mode (ON CONFLICT DO UPDATE)...\n")
    else:
        print(f"\n[SeedDemo] Fresh seed — inserting demo data...\n")

    try:
        # ── CRITICAL: Auth data (must succeed for login to work) ──────────
        seed_organization(cur)
        seed_projects(cur)
        seed_users(cur)
        seed_memberships(cur)

        # Commit auth data immediately so login works even if later seeds fail
        conn.commit()
        print("  [AUTH] Core auth data committed (org, projects, users, memberships)")

        # ── NON-CRITICAL: Test data (each wrapped in SAVEPOINT) ──────────
        _safe_seed(conn, cur, "5-plans", seed_test_plans)

        case_ids = []
        try:
            cur.execute("SAVEPOINT sp_cases")
            case_ids = seed_test_cases(cur)
        except Exception as e:
            cur.execute("ROLLBACK TO SAVEPOINT sp_cases")
            print(f"  [6-cases] SKIPPED: {str(e)[:100]}")

        run_ids = []
        if case_ids:
            try:
                cur.execute("SAVEPOINT sp_runs")
                run_ids = seed_test_runs(cur, case_ids)
            except Exception as e:
                cur.execute("ROLLBACK TO SAVEPOINT sp_runs")
                print(f"  [7-runs] SKIPPED: {str(e)[:100]}")

        if run_ids:
            _safe_seed(conn, cur, "8-defects", seed_defects, run_ids)

        _safe_seed(conn, cur, "9-reqs", seed_requirements)
        _safe_seed(conn, cur, "10-api", seed_api_collections)
        _safe_seed(conn, cur, "11-env", seed_api_environments)
        _safe_seed(conn, cur, "12-a11y", seed_accessibility)
        _safe_seed(conn, cur, "12-perf", seed_performance)
        _safe_seed(conn, cur, "13-subs", seed_subscriptions)

        conn.commit()
        print("\n" + "=" * 60)
        print("  Seed complete! All data committed.")
        print("=" * 60)

        # Print summary (each count in its own savepoint to handle missing tables)
        tables = [
            "organizations", "projects", "users", "org_memberships", "project_memberships",
            "test_plans", "test_cases", "test_runs", "test_run_steps", "defects",
            "requirements", "subscriptions",
        ]
        print("\n  Table Row Counts:")
        for table in tables:
            try:
                cur.execute(f"SAVEPOINT sp_count")
                cur.execute(f"SELECT COUNT(*) FROM {table}")  # noqa: S608
                count = cur.fetchone()[0]
                print(f"    {table:.<40s} {count}")
            except Exception:
                cur.execute("ROLLBACK TO SAVEPOINT sp_count")
                print(f"    {table:.<40s} (table not found)")

    except Exception as e:
        conn.rollback()
        print(f"\n[SeedDemo] ERROR in critical auth seed: {e}")
        import traceback
        traceback.print_exc()
        # Don't sys.exit(1) — let the app start even if seeding fails
        # The auto_migrate caller will log the warning
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()
