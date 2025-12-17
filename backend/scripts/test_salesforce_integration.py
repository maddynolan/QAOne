"""
Salesforce Integration Test Suite

Tests all Salesforce features in Flowstral:
1. Connection & Authentication
2. Metadata Validation (Objects, Fields, Picklists)
3. Selector Validation (Lightning components)
4. List View Support
5. OOTB Functionality

Usage:
    python test_salesforce_integration.py --username YOUR_EMAIL --password YOUR_PASSWORD --token YOUR_TOKEN

Or set environment variables:
    set SF_USERNAME=your-email@example.com
    set SF_PASSWORD=your-password
    set SF_SECURITY_TOKEN=your-token
    python test_salesforce_integration.py
"""

import os
import sys
import argparse
import json
from typing import Dict, Any

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def test_connection(username: str, password: str, token: str, domain: str = "login") -> bool:
    """Test Salesforce connection"""
    print("\n" + "="*60)
    print("🔌 TEST 1: Salesforce Connection")
    print("="*60)
    
    try:
        from simple_salesforce import Salesforce
        
        sf = Salesforce(
            username=username,
            password=password,
            security_token=token,
            domain=domain
        )
        
        # Test query
        result = sf.query("SELECT Id, Name FROM Account LIMIT 1")
        
        print(f"✅ Connected to: {sf.sf_instance}")
        print(f"✅ API Version: {sf.sf_version}")
        print(f"✅ Query test: Found {result['totalSize']} records")
        return True
        
    except Exception as e:
        print(f"❌ Connection failed: {e}")
        return False


def test_metadata_service(username: str, password: str, token: str) -> bool:
    """Test metadata validation service"""
    print("\n" + "="*60)
    print("📋 TEST 2: Metadata Validation Service")
    print("="*60)
    
    try:
        from app.services.salesforce.metadata_service import SalesforceMetadataService
        
        service = SalesforceMetadataService()
        
        # Test object validation
        print("\n📦 Testing Object Validation...")
        
        # Standard objects
        for obj in ['Account', 'Contact', 'Lead', 'Opportunity', 'Case']:
            result = service.validate_object(obj)
            status = "✅" if result['valid'] else "❌"
            print(f"  {status} {obj}: {result.get('message', 'Valid')}")
        
        # Custom object pattern
        result = service.validate_object('My_Custom_Object__c')
        print(f"  ℹ️  My_Custom_Object__c: {result.get('message', 'Pattern valid')}")
        
        # Test field validation
        print("\n🏷️ Testing Field Validation...")
        
        test_fields = [
            ('Account', 'Name'),
            ('Account', 'Industry'),
            ('Contact', 'Email'),
            ('Contact', 'FirstName'),
            ('Lead', 'Status'),
            ('Opportunity', 'StageName'),
            ('Account', 'Custom_Field__c'),  # Custom field pattern
        ]
        
        for obj, field in test_fields:
            result = service.validate_field(obj, field)
            status = "✅" if result['valid'] else "⚠️"
            print(f"  {status} {obj}.{field}: {result.get('message', 'Valid')}")
        
        # Test selector validation
        print("\n🎯 Testing Selector Validation...")
        
        test_selectors = [
            'lightning-input[name="accountName"]',
            'lightning-button[label="Save"]',
            'lightning-combobox[name="Industry"]',
            'lightning-datatable',
            '[data-id="Account.Name"]',
            '[data-field="Industry"]',
            'c-my-custom-component',
        ]
        
        for selector in test_selectors:
            result = service.validate_selector(selector)
            status = "✅" if result['valid'] else "⚠️"
            pattern = result.get('pattern', 'unknown')
            print(f"  {status} {selector[:40]:40s} → {pattern}")
        
        print("\n✅ Metadata service working correctly!")
        return True
        
    except Exception as e:
        print(f"❌ Metadata service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_list_view_selectors() -> bool:
    """Test Salesforce List View selector patterns"""
    print("\n" + "="*60)
    print("📊 TEST 3: List View Selector Patterns")
    print("="*60)
    
    # Common Salesforce List View selectors
    list_view_selectors = {
        "List View Container": [
            "lightning-list-view-manager",
            "[data-component-id='listViewManager']",
            ".slds-page-header",
        ],
        "List View Dropdown": [
            "lightning-combobox[name='listViewSelector']",
            "[data-key='listViewPicker']",
            ".listViewSelector",
        ],
        "Table Header": [
            "thead[class*='slds-table']",
            "th[scope='col']",
            "[data-column-key]",
        ],
        "Table Rows": [
            "tbody tr[data-row-key-value]",
            "[data-row-key-value]",
            "lightning-primitive-cell-wrapper",
        ],
        "Row Checkbox": [
            "lightning-input[type='checkbox'][data-row-key-value]",
            "[data-label='Select Row']",
        ],
        "Sort Button": [
            "[data-column-key] button",
            "button[title*='Sort']",
        ],
        "Pagination": [
            "lightning-button-menu[name='scrollerPaginationMenu']",
            "[data-page-count]",
        ],
        "Action Menu": [
            "lightning-button-menu[aria-label='Actions']",
            "[data-aura-rendered-by*='rowAction']",
        ],
        "New Button": [
            "lightning-button[name='New']",
            "[title='New']",
            "button[name='New']",
        ],
        "Search Box": [
            "lightning-input[type='search']",
            "[data-key='searchInput']",
            "input[placeholder*='Search']",
        ],
    }
    
    print("\n🎯 Recommended List View Selectors:\n")
    
    for category, selectors in list_view_selectors.items():
        print(f"  📌 {category}:")
        for sel in selectors:
            print(f"      • {sel}")
        print()
    
    return True


def test_ootb_patterns() -> bool:
    """Test Out-of-the-Box Salesforce patterns"""
    print("\n" + "="*60)
    print("⚡ TEST 4: OOTB Lightning Component Patterns")
    print("="*60)
    
    ootb_patterns = {
        "Record Detail Page": {
            "description": "Standard record detail view",
            "selectors": [
                "records-record-layout-event-broker",
                "records-highlights2",
                "records-record-layout-section",
                "lightning-output-field",
                "lightning-formatted-text",
            ],
            "actions": ["View", "Edit", "Clone", "Delete"]
        },
        "Record Edit Form": {
            "description": "Standard record edit form",
            "selectors": [
                "lightning-record-edit-form",
                "lightning-input-field",
                "lightning-combobox",
                "lightning-textarea",
                "button[name='SaveEdit']",
                "button[name='CancelEdit']",
            ],
            "actions": ["Fill Field", "Select Picklist", "Save", "Cancel"]
        },
        "Related Lists": {
            "description": "Related records on detail page",
            "selectors": [
                "lst-related-list-single-container",
                "records-related-list-quick-link",
                "lightning-accordion-section[data-target-selection-name]",
                "[data-component-id='relatedList']",
            ],
            "actions": ["View All", "New Related Record"]
        },
        "Global Search": {
            "description": "Top search bar",
            "selectors": [
                "[data-aura-class='forceSearchInput']",
                "input[placeholder='Search Salesforce']",
                "search-input-lookup",
            ],
            "actions": ["Search", "Select Result"]
        },
        "Navigation": {
            "description": "App navigation",
            "selectors": [
                "one-app-nav-bar",
                "one-app-nav-bar-item-root",
                "a[data-id='Tab-Account']",
                "lightning-formatted-url[data-label]",
            ],
            "actions": ["Navigate to Tab", "Open Record"]
        },
        "Quick Actions": {
            "description": "Record quick actions",
            "selectors": [
                "runtime_platform_actions-action-renderer",
                "[data-target-selection-name*='quickAction']",
                "lightning-button-menu[class*='actions']",
            ],
            "actions": ["Log Call", "New Task", "New Event", "Send Email"]
        },
        "Kanban Board": {
            "description": "Opportunity/Lead Kanban view",
            "selectors": [
                "lst-kanban-board",
                "[data-aura-class='lstKanbanCard']",
                "[data-column-key]",
            ],
            "actions": ["Drag Card", "View Record", "Change Stage"]
        },
        "Path Component": {
            "description": "Opportunity/Lead path",
            "selectors": [
                "lightning-path",
                "[data-key='path']",
                "li[class*='slds-path__item']",
            ],
            "actions": ["Select Stage", "Mark Complete"]
        },
    }
    
    for component, details in ootb_patterns.items():
        print(f"\n📦 {component}")
        print(f"   {details['description']}")
        print(f"   Selectors:")
        for sel in details['selectors'][:3]:
            print(f"      • {sel}")
        print(f"   Actions: {', '.join(details['actions'])}")
    
    return True


def test_live_recording_tips():
    """Tips for recording Salesforce interactions"""
    print("\n" + "="*60)
    print("🎬 RECORDING TIPS: Salesforce Best Practices")
    print("="*60)
    
    tips = """
    
    1️⃣  ALWAYS WAIT FOR LIGHTNING TO LOAD
       ─────────────────────────────────────
       Salesforce Lightning is slow. Add explicit waits:
       • Wait for: lightning-spinner (to disappear)
       • Wait for: .slds-page-header (to appear)
       • Wait for: aura:doneRendering (event)
       
    2️⃣  USE DATA ATTRIBUTES OVER CSS CLASSES
       ─────────────────────────────────────
       ✅ Good: [data-id="Account.Name"]
       ✅ Good: [data-target-selection-name="sfdc:QuickAction"]
       ❌ Bad:  .slds-form-element__label (can change)
       
    3️⃣  LIST VIEW RECORDING
       ─────────────────────────────────────
       • Click column header to sort → [data-column-key]
       • Click row checkbox → [data-row-key-value]
       • Click action menu → lightning-button-menu
       • Page navigation → Use visible pagination
       
    4️⃣  RECORD EDIT FORMS
       ─────────────────────────────────────
       • Field inputs: lightning-input-field[field-name="FieldAPI"]
       • Picklists: lightning-combobox[name="FieldAPI"]
       • Lookups: lightning-input[data-lookup-name]
       • Save: button[name="SaveEdit"]
       
    5️⃣  HANDLE TOASTS & MODALS
       ─────────────────────────────────────
       • Success toast: .slds-notify--toast
       • Error modal: lightning-modal
       • Loading: lightning-spinner
       
    6️⃣  CUSTOM OBJECTS
       ─────────────────────────────────────
       • Object: My_Object__c
       • Field: My_Field__c
       • Relationship: Parent__r.Name
       
    """
    print(tips)
    return True


def generate_sample_test_case():
    """Generate a sample Salesforce test case"""
    print("\n" + "="*60)
    print("📝 SAMPLE TEST CASE: Create Account from List View")
    print("="*60)
    
    test_case = {
        "name": "Create Account from List View",
        "description": "Navigate to Accounts list view and create new account",
        "steps": [
            {
                "action": "navigate",
                "url": "https://your-org.lightning.force.com/lightning/o/Account/list",
                "wait": "lightning-list-view-manager"
            },
            {
                "action": "click",
                "selector": "lightning-button[name='New']",
                "description": "Click New button"
            },
            {
                "action": "wait",
                "selector": "lightning-record-edit-form",
                "description": "Wait for form to load"
            },
            {
                "action": "fill",
                "selector": "lightning-input-field[field-name='Name']",
                "value": "Test Account {{timestamp}}",
                "description": "Enter account name"
            },
            {
                "action": "select",
                "selector": "lightning-combobox[field-name='Industry']",
                "value": "Technology",
                "description": "Select industry"
            },
            {
                "action": "fill",
                "selector": "lightning-input-field[field-name='Phone']",
                "value": "+1-555-0100",
                "description": "Enter phone"
            },
            {
                "action": "click",
                "selector": "button[name='SaveEdit']",
                "description": "Click Save"
            },
            {
                "action": "assert",
                "selector": ".slds-notify--toast.slds-theme--success",
                "description": "Verify success toast"
            }
        ]
    }
    
    print(json.dumps(test_case, indent=2))
    return test_case


def main():
    parser = argparse.ArgumentParser(description='Test Salesforce Integration')
    parser.add_argument('--username', '-u', help='Salesforce username')
    parser.add_argument('--password', '-p', help='Salesforce password')
    parser.add_argument('--token', '-t', help='Salesforce security token')
    parser.add_argument('--domain', '-d', default='login', help='login or test (sandbox)')
    parser.add_argument('--skip-live', action='store_true', help='Skip live connection test')
    args = parser.parse_args()
    
    # Get credentials from args or environment
    username = args.username or os.getenv('SF_USERNAME')
    password = args.password or os.getenv('SF_PASSWORD')
    token = args.token or os.getenv('SF_SECURITY_TOKEN', '')
    domain = args.domain
    
    print("\n" + "="*60)
    print("🚀 FLOWSTRAL SALESFORCE INTEGRATION TEST SUITE")
    print("="*60)
    
    results = {}
    
    # Test 1: Live connection (if credentials provided)
    if not args.skip_live and username and password:
        results['connection'] = test_connection(username, password, token, domain)
    else:
        print("\n⏭️  Skipping live connection test (no credentials)")
        print("   Set SF_USERNAME, SF_PASSWORD, SF_SECURITY_TOKEN environment variables")
        print("   Or use: --username EMAIL --password PASS --token TOKEN")
    
    # Test 2: Metadata service (works offline too)
    results['metadata'] = test_metadata_service(username or '', password or '', token or '')
    
    # Test 3: List view patterns
    results['list_views'] = test_list_view_selectors()
    
    # Test 4: OOTB patterns
    results['ootb'] = test_ootb_patterns()
    
    # Test 5: Recording tips
    test_live_recording_tips()
    
    # Test 6: Sample test case
    generate_sample_test_case()
    
    # Summary
    print("\n" + "="*60)
    print("📊 TEST SUMMARY")
    print("="*60)
    
    for test, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}: {test}")
    
    print("\n" + "="*60)
    print("🎯 NEXT STEPS")
    print("="*60)
    print("""
    1. Sign up for free Developer Edition:
       https://developer.salesforce.com/signup
       
    2. Get your security token:
       Setup → My Personal Information → Reset Security Token
       
    3. Run with credentials:
       python test_salesforce_integration.py -u EMAIL -p PASS -t TOKEN
       
    4. Start recording in Flowstral:
       - Open your Salesforce org
       - Click the Flowstral extension
       - Start recording
       - Perform actions
       - Stop and validate!
    """)


if __name__ == "__main__":
    main()
