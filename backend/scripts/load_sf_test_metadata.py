"""
Load Test Metadata into Salesforce Org

This script creates realistic validation rules, flows, triggers, and custom objects
to test the Orchestrator discovery and test generation features.
"""

import os
import sys
import json
import time
from pathlib import Path

# Add parent path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from simple_salesforce import Salesforce
from simple_salesforce.exceptions import SalesforceError


def get_sf_connection():
    """Get Salesforce connection from credentials file"""
    creds_path = Path(__file__).parent.parent / "config" / "salesforce_credentials.json"
    
    if not creds_path.exists():
        raise FileNotFoundError(f"Credentials file not found: {creds_path}")
    
    with open(creds_path) as f:
        creds = json.load(f)
    
    print(f"Connecting to {creds['instance_url']}...")
    
    sf = Salesforce(
        instance_url=creds['instance_url'],
        session_id=creds['access_token']
    )
    
    print(f"✓ Connected as {creds['username']}")
    return sf


def create_custom_objects(sf):
    """Create custom objects for testing"""
    print("\n📦 Creating Custom Objects...")
    
    objects_to_create = [
        {
            "fullName": "QA_Test_Suite__c",
            "label": "QA Test Suite",
            "pluralLabel": "QA Test Suites",
            "nameField": {"label": "Test Suite Name", "type": "Text"},
            "deploymentStatus": "Deployed",
            "sharingModel": "ReadWrite",
            "description": "Custom object to track test suites"
        },
        {
            "fullName": "QA_Test_Case__c", 
            "label": "QA Test Case",
            "pluralLabel": "QA Test Cases",
            "nameField": {"label": "Test Case Name", "type": "Text"},
            "deploymentStatus": "Deployed",
            "sharingModel": "ReadWrite",
            "description": "Custom object to track test cases"
        },
        {
            "fullName": "QA_Test_Result__c",
            "label": "QA Test Result",
            "pluralLabel": "QA Test Results", 
            "nameField": {"label": "Result Name", "type": "AutoNumber", "displayFormat": "RES-{0000}"},
            "deploymentStatus": "Deployed",
            "sharingModel": "ReadWrite",
            "description": "Custom object to track test execution results"
        }
    ]
    
    # Check existing custom objects
    try:
        existing = sf.query("SELECT Id, DeveloperName FROM EntityDefinition WHERE IsCustomizable = true AND DeveloperName LIKE 'QA_%'")
        existing_names = [r['DeveloperName'] for r in existing.get('records', [])]
        print(f"  Found existing QA objects: {existing_names}")
    except Exception as e:
        print(f"  Could not check existing objects: {e}")
        existing_names = []
    
    # Note: Creating custom objects requires Metadata API which is complex
    # For demo purposes, we'll use the Tooling API for simpler metadata
    print("  ℹ️  Custom object creation requires Metadata API (skipping for now)")
    print("  ℹ️  Using existing standard objects for testing")
    
    return True


def create_custom_fields(sf):
    """Create custom fields on Account for testing"""
    print("\n🔤 Creating Custom Fields on Account...")
    
    fields_to_create = [
        {
            "object": "Account",
            "field": "QA_Test_Score__c",
            "type": "Number",
            "label": "QA Test Score",
            "precision": 5,
            "scale": 2
        },
        {
            "object": "Account", 
            "field": "QA_Last_Tested__c",
            "type": "DateTime",
            "label": "QA Last Tested"
        },
        {
            "object": "Account",
            "field": "QA_Test_Status__c", 
            "type": "Picklist",
            "label": "QA Test Status",
            "picklistValues": ["Not Tested", "In Progress", "Passed", "Failed", "Blocked"]
        },
        {
            "object": "Account",
            "field": "QA_Priority__c",
            "type": "Picklist", 
            "label": "QA Priority",
            "picklistValues": ["Critical", "High", "Medium", "Low"]
        }
    ]
    
    # Check existing fields
    try:
        result = sf.query("""
            SELECT Id, DeveloperName, QualifiedApiName 
            FROM FieldDefinition 
            WHERE EntityDefinition.QualifiedApiName = 'Account' 
            AND DeveloperName LIKE 'QA_%'
        """)
        existing = [r['DeveloperName'] for r in result.get('records', [])]
        print(f"  Found existing QA fields: {existing}")
    except Exception as e:
        print(f"  Could not check existing fields: {e}")
    
    print("  ℹ️  Custom field creation requires Metadata API (skipping for now)")
    return True


def create_validation_rules(sf):
    """Create validation rules for testing"""
    print("\n✅ Creating Validation Rules...")
    
    validation_rules = [
        {
            "object": "Account",
            "name": "QA_Account_Phone_Required",
            "description": "Phone is required when Type is Customer",
            "errorConditionFormula": "AND(ISPICKVAL(Type, 'Customer'), ISBLANK(Phone))",
            "errorMessage": "Phone is required for Customer accounts"
        },
        {
            "object": "Account",
            "name": "QA_Account_Website_Format",
            "description": "Website must start with http:// or https://",
            "errorConditionFormula": "AND(NOT(ISBLANK(Website)), NOT(OR(BEGINS(Website, 'http://'), BEGINS(Website, 'https://'))))",
            "errorMessage": "Website must start with http:// or https://"
        },
        {
            "object": "Account", 
            "name": "QA_Account_Revenue_Employees",
            "description": "Annual Revenue required when Number of Employees > 100",
            "errorConditionFormula": "AND(NumberOfEmployees > 100, ISBLANK(AnnualRevenue))",
            "errorMessage": "Annual Revenue is required for companies with more than 100 employees"
        },
        {
            "object": "Contact",
            "name": "QA_Contact_Email_Required",
            "description": "Email is required for all contacts",
            "errorConditionFormula": "ISBLANK(Email)",
            "errorMessage": "Email is required for all contacts"
        },
        {
            "object": "Contact",
            "name": "QA_Contact_Name_Length",
            "description": "First name and Last name combined must be at least 4 characters",
            "errorConditionFormula": "LEN(FirstName & LastName) < 4",
            "errorMessage": "Name must be at least 4 characters total"
        },
        {
            "object": "Opportunity",
            "name": "QA_Opp_Close_Date_Future",
            "description": "Close Date must be in the future for new opportunities",
            "errorConditionFormula": "AND(ISNEW(), CloseDate < TODAY())",
            "errorMessage": "Close Date must be in the future"
        },
        {
            "object": "Opportunity",
            "name": "QA_Opp_Amount_Required",
            "description": "Amount is required when Stage is Negotiation",
            "errorConditionFormula": "AND(ISPICKVAL(StageName, 'Negotiation/Review'), ISBLANK(Amount))",
            "errorMessage": "Amount is required when in Negotiation stage"
        },
        {
            "object": "Lead",
            "name": "QA_Lead_Company_Required",
            "description": "Company name must be at least 2 characters",
            "errorConditionFormula": "LEN(Company) < 2",
            "errorMessage": "Company name must be at least 2 characters"
        }
    ]
    
    # Query existing validation rules
    try:
        result = sf.toolingexecute(
            "query/?q=SELECT+Id,ValidationName,EntityDefinition.QualifiedApiName+FROM+ValidationRule+WHERE+ValidationName+LIKE+'QA_%'"
        )
        existing = [(r['EntityDefinition']['QualifiedApiName'], r['ValidationName']) 
                   for r in result.get('records', [])]
        print(f"  Found {len(existing)} existing QA validation rules")
        
        for obj, name in existing:
            print(f"    - {obj}.{name}")
            
    except Exception as e:
        print(f"  Error querying validation rules: {e}")
    
    print(f"  ℹ️  To create via Metadata API, use these definitions:")
    for rule in validation_rules[:3]:  # Show first 3 as examples
        print(f"    - {rule['object']}.{rule['name']}: {rule['description']}")
    
    return validation_rules


def create_flows(sf):
    """Create flows for testing"""
    print("\n⚡ Creating Flows...")
    
    flows_to_create = [
        {
            "name": "QA_Account_Auto_Rating",
            "type": "AutoLaunchedFlow",
            "description": "Auto-set Account Rating based on Annual Revenue",
            "trigger": "Account - After Insert/Update",
            "logic": "If AnnualRevenue > 1000000 then Rating = 'Hot', elif > 500000 then 'Warm', else 'Cold'"
        },
        {
            "name": "QA_Contact_Welcome_Email",
            "type": "AutoLaunchedFlow", 
            "description": "Send welcome email when new Contact is created",
            "trigger": "Contact - After Insert",
            "logic": "Send email to Contact.Email with welcome template"
        },
        {
            "name": "QA_Opportunity_Stage_Tracking",
            "type": "AutoLaunchedFlow",
            "description": "Track stage changes on Opportunity",
            "trigger": "Opportunity - After Update",
            "logic": "When StageName changes, create Task for record owner"
        },
        {
            "name": "QA_Lead_Assignment",
            "type": "AutoLaunchedFlow",
            "description": "Assign leads based on industry",
            "trigger": "Lead - After Insert", 
            "logic": "Round-robin assignment based on Lead.Industry"
        },
        {
            "name": "QA_Case_Escalation",
            "type": "AutoLaunchedFlow",
            "description": "Escalate high-priority cases",
            "trigger": "Case - After Insert",
            "logic": "If Priority = 'High', send email to support queue"
        }
    ]
    
    # Query existing flows
    try:
        result = sf.query("""
            SELECT Id, MasterLabel, ProcessType, IsActive 
            FROM FlowDefinition 
            WHERE MasterLabel LIKE 'QA_%'
        """)
        existing = result.get('records', [])
        print(f"  Found {len(existing)} existing QA flows")
        
        for flow in existing:
            status = "✓" if flow.get('IsActive') else "○"
            print(f"    {status} {flow['MasterLabel']} ({flow['ProcessType']})")
            
    except Exception as e:
        print(f"  Error querying flows: {e}")
    
    print(f"  ℹ️  Flow definitions to create:")
    for flow in flows_to_create:
        print(f"    - {flow['name']}: {flow['description']}")
    
    return flows_to_create


def create_apex_triggers(sf):
    """Create Apex triggers for testing"""
    print("\n🔧 Creating Apex Triggers...")
    
    triggers_to_create = [
        {
            "name": "QA_AccountTrigger",
            "object": "Account",
            "description": "Account trigger for QA testing",
            "events": ["before insert", "before update", "after insert", "after update"],
            "code": """
trigger QA_AccountTrigger on Account (before insert, before update, after insert, after update) {
    if (Trigger.isBefore) {
        if (Trigger.isInsert || Trigger.isUpdate) {
            for (Account acc : Trigger.new) {
                // Ensure Name is not null
                if (String.isBlank(acc.Name)) {
                    acc.addError('Account Name cannot be blank');
                }
                // Auto-set Description if empty
                if (Trigger.isInsert && String.isBlank(acc.Description)) {
                    acc.Description = 'Created via trigger on ' + System.now();
                }
            }
        }
    }
    if (Trigger.isAfter) {
        // After trigger logic
        if (Trigger.isInsert) {
            // Could create related records here
        }
    }
}
"""
        },
        {
            "name": "QA_ContactTrigger",
            "object": "Contact",
            "description": "Contact trigger for QA testing",
            "events": ["before insert", "before update"],
            "code": """
trigger QA_ContactTrigger on Contact (before insert, before update) {
    for (Contact con : Trigger.new) {
        // Normalize email to lowercase
        if (!String.isBlank(con.Email)) {
            con.Email = con.Email.toLowerCase();
        }
        // Set MailingCountry default
        if (Trigger.isInsert && String.isBlank(con.MailingCountry)) {
            con.MailingCountry = 'USA';
        }
    }
}
"""
        },
        {
            "name": "QA_OpportunityTrigger",
            "object": "Opportunity", 
            "description": "Opportunity trigger for QA testing",
            "events": ["before update", "after update"],
            "code": """
trigger QA_OpportunityTrigger on Opportunity (before update, after update) {
    if (Trigger.isBefore) {
        for (Opportunity opp : Trigger.new) {
            Opportunity oldOpp = Trigger.oldMap.get(opp.Id);
            // Prevent closing with $0 amount
            if (opp.StageName == 'Closed Won' && (opp.Amount == null || opp.Amount == 0)) {
                opp.addError('Cannot close won with $0 amount');
            }
        }
    }
}
"""
        }
    ]
    
    # Query existing triggers
    try:
        result = sf.query("""
            SELECT Id, Name, TableEnumOrId, Status, IsValid
            FROM ApexTrigger 
            WHERE Name LIKE 'QA_%'
        """)
        existing = result.get('records', [])
        print(f"  Found {len(existing)} existing QA triggers")
        
        for trigger in existing:
            status = "✓" if trigger.get('IsValid') else "✗"
            print(f"    {status} {trigger['Name']} on {trigger['TableEnumOrId']}")
            
    except Exception as e:
        print(f"  Error querying triggers: {e}")
    
    print(f"  ℹ️  Trigger definitions to create:")
    for trigger in triggers_to_create:
        print(f"    - {trigger['name']} on {trigger['object']}")
    
    return triggers_to_create


def create_apex_classes(sf):
    """Create Apex test classes for testing"""
    print("\n📝 Creating Apex Classes...")
    
    classes_to_create = [
        {
            "name": "QA_TestDataFactory",
            "description": "Factory class for creating test data",
            "code": """
@isTest
public class QA_TestDataFactory {
    public static Account createAccount(String name) {
        return new Account(Name = name, Industry = 'Technology');
    }
    
    public static Contact createContact(String firstName, String lastName, Id accountId) {
        return new Contact(FirstName = firstName, LastName = lastName, AccountId = accountId, Email = firstName.toLowerCase() + '@test.com');
    }
    
    public static Opportunity createOpportunity(String name, Id accountId, Decimal amount) {
        return new Opportunity(Name = name, AccountId = accountId, Amount = amount, StageName = 'Prospecting', CloseDate = Date.today().addDays(30));
    }
    
    public static Lead createLead(String company, String lastName) {
        return new Lead(Company = company, LastName = lastName, Status = 'Open - Not Contacted');
    }
}
"""
        },
        {
            "name": "QA_AccountService",
            "description": "Service class for Account operations",
            "code": """
public class QA_AccountService {
    public static List<Account> getAccountsByIndustry(String industry) {
        return [SELECT Id, Name, Industry, AnnualRevenue FROM Account WHERE Industry = :industry LIMIT 100];
    }
    
    public static void updateAccountRating(List<Account> accounts) {
        for (Account acc : accounts) {
            if (acc.AnnualRevenue != null) {
                if (acc.AnnualRevenue > 1000000) {
                    acc.Rating = 'Hot';
                } else if (acc.AnnualRevenue > 500000) {
                    acc.Rating = 'Warm';
                } else {
                    acc.Rating = 'Cold';
                }
            }
        }
        update accounts;
    }
    
    public static Map<String, Integer> getAccountCountByType() {
        Map<String, Integer> countByType = new Map<String, Integer>();
        for (AggregateResult ar : [SELECT Type, COUNT(Id) cnt FROM Account GROUP BY Type]) {
            countByType.put((String)ar.get('Type'), (Integer)ar.get('cnt'));
        }
        return countByType;
    }
}
"""
        },
        {
            "name": "QA_AccountServiceTest",
            "description": "Test class for QA_AccountService",
            "code": """
@isTest
public class QA_AccountServiceTest {
    @testSetup
    static void setup() {
        List<Account> accounts = new List<Account>();
        for (Integer i = 0; i < 10; i++) {
            accounts.add(new Account(Name = 'Test Account ' + i, Industry = 'Technology', AnnualRevenue = i * 200000));
        }
        insert accounts;
    }
    
    @isTest
    static void testGetAccountsByIndustry() {
        Test.startTest();
        List<Account> accounts = QA_AccountService.getAccountsByIndustry('Technology');
        Test.stopTest();
        System.assertEquals(10, accounts.size(), 'Should return 10 accounts');
    }
    
    @isTest
    static void testUpdateAccountRating() {
        List<Account> accounts = [SELECT Id, AnnualRevenue, Rating FROM Account];
        Test.startTest();
        QA_AccountService.updateAccountRating(accounts);
        Test.stopTest();
        
        Account hotAccount = [SELECT Rating FROM Account WHERE AnnualRevenue > 1000000 LIMIT 1];
        System.assertEquals('Hot', hotAccount.Rating, 'High revenue accounts should be Hot');
    }
}
"""
        }
    ]
    
    # Query existing classes
    try:
        result = sf.query("""
            SELECT Id, Name, Status, IsValid
            FROM ApexClass 
            WHERE Name LIKE 'QA_%'
        """)
        existing = result.get('records', [])
        print(f"  Found {len(existing)} existing QA classes")
        
        for cls in existing:
            status = "✓" if cls.get('IsValid') else "✗"
            print(f"    {status} {cls['Name']}")
            
    except Exception as e:
        print(f"  Error querying classes: {e}")
    
    print(f"  ℹ️  Class definitions to create:")
    for cls in classes_to_create:
        print(f"    - {cls['name']}: {cls['description']}")
    
    return classes_to_create


def create_test_records(sf):
    """Create test records for API testing"""
    print("\n📄 Creating Test Records...")
    
    try:
        # Create test Accounts
        accounts = []
        for i in range(5):
            acc = sf.Account.create({
                'Name': f'QA Test Account {i+1}',
                'Industry': ['Technology', 'Finance', 'Healthcare', 'Retail', 'Manufacturing'][i],
                'Type': 'Customer',
                'Phone': f'555-000-{1000+i}',
                'Website': f'https://qatest{i+1}.com',
                'AnnualRevenue': (i+1) * 250000,
                'NumberOfEmployees': (i+1) * 50,
                'Description': f'Test account created for QA testing - {i+1}'
            })
            accounts.append(acc)
            print(f"  ✓ Created Account: QA Test Account {i+1} ({acc['id']})")
        
        # Create test Contacts for each Account
        for i, acc in enumerate(accounts):
            contact = sf.Contact.create({
                'FirstName': f'QA',
                'LastName': f'Tester {i+1}',
                'AccountId': acc['id'],
                'Email': f'qa.tester{i+1}@test.com',
                'Phone': f'555-001-{1000+i}',
                'Title': ['CEO', 'CTO', 'VP Sales', 'Manager', 'Engineer'][i]
            })
            print(f"  ✓ Created Contact: QA Tester {i+1} ({contact['id']})")
        
        # Create test Opportunities
        for i, acc in enumerate(accounts[:3]):
            opp = sf.Opportunity.create({
                'Name': f'QA Test Opportunity {i+1}',
                'AccountId': acc['id'],
                'StageName': ['Prospecting', 'Qualification', 'Proposal/Price Quote'][i],
                'CloseDate': '2025-06-30',
                'Amount': (i+1) * 50000,
                'Probability': [10, 25, 50][i]
            })
            print(f"  ✓ Created Opportunity: QA Test Opportunity {i+1} ({opp['id']})")
        
        # Create test Leads
        for i in range(3):
            lead = sf.Lead.create({
                'FirstName': f'QA Lead',
                'LastName': f'Prospect {i+1}',
                'Company': f'QA Prospect Company {i+1}',
                'Email': f'qa.lead{i+1}@prospect.com',
                'Status': 'Open - Not Contacted',
                'Industry': ['Technology', 'Finance', 'Healthcare'][i],
                'LeadSource': ['Web', 'Phone Inquiry', 'Partner Referral'][i]
            })
            print(f"  ✓ Created Lead: QA Lead Prospect {i+1} ({lead['id']})")
        
        print(f"\n  ✅ Created {len(accounts)} Accounts, {len(accounts)} Contacts, 3 Opportunities, 3 Leads")
        return True
        
    except SalesforceError as e:
        print(f"  ✗ Error creating records: {e}")
        return False


def scan_org_metadata(sf):
    """Scan the org for all testable metadata"""
    print("\n🔍 Scanning Org Metadata...")
    
    results = {
        "validation_rules": [],
        "flows": [],
        "triggers": [],
        "apex_classes": [],
        "custom_objects": [],
        "profiles": [],
        "permission_sets": []
    }
    
    # Scan Validation Rules
    try:
        vr_result = sf.toolingexecute("query/?q=SELECT+Id,ValidationName,EntityDefinition.QualifiedApiName,Active,ErrorMessage+FROM+ValidationRule")
        results["validation_rules"] = vr_result.get('records', [])
        print(f"  ✓ Found {len(results['validation_rules'])} Validation Rules")
    except Exception as e:
        print(f"  ✗ Error scanning validation rules: {e}")
    
    # Scan Flows
    try:
        flow_result = sf.query("SELECT Id, MasterLabel, ProcessType, IsActive, Description FROM FlowDefinition")
        results["flows"] = flow_result.get('records', [])
        print(f"  ✓ Found {len(results['flows'])} Flows")
    except Exception as e:
        print(f"  ✗ Error scanning flows: {e}")
    
    # Scan Apex Triggers
    try:
        trigger_result = sf.query("SELECT Id, Name, TableEnumOrId, Status, IsValid FROM ApexTrigger")
        results["triggers"] = trigger_result.get('records', [])
        print(f"  ✓ Found {len(results['triggers'])} Apex Triggers")
    except Exception as e:
        print(f"  ✗ Error scanning triggers: {e}")
    
    # Scan Apex Classes (test classes)
    try:
        class_result = sf.query("SELECT Id, Name, Status, IsValid FROM ApexClass WHERE Name LIKE '%Test%' OR Name LIKE '%test%'")
        results["apex_classes"] = class_result.get('records', [])
        print(f"  ✓ Found {len(results['apex_classes'])} Apex Test Classes")
    except Exception as e:
        print(f"  ✗ Error scanning apex classes: {e}")
    
    # Scan Custom Objects
    try:
        obj_result = sf.query("SELECT Id, DeveloperName, Description FROM EntityDefinition WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c'")
        results["custom_objects"] = obj_result.get('records', [])
        print(f"  ✓ Found {len(results['custom_objects'])} Custom Objects")
    except Exception as e:
        print(f"  ✗ Error scanning custom objects: {e}")
    
    return results


def save_scan_results(results):
    """Save scan results to JSON file"""
    output_path = Path(__file__).parent.parent / "data" / "sf_org_scan.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    print(f"\n💾 Saved scan results to {output_path}")
    return output_path


def main():
    """Main function to load test metadata"""
    print("=" * 60)
    print("🚀 Salesforce Test Metadata Loader")
    print("=" * 60)
    
    try:
        # Connect to SF
        sf = get_sf_connection()
        
        # Scan existing metadata first
        scan_results = scan_org_metadata(sf)
        save_scan_results(scan_results)
        
        # Show what we'd create
        validation_rules = create_validation_rules(sf)
        flows = create_flows(sf)
        triggers = create_apex_triggers(sf)
        classes = create_apex_classes(sf)
        
        # Create test records (these can be created via API)
        print("\n" + "=" * 60)
        print("Creating test records in org...")
        create_test_records(sf)
        
        print("\n" + "=" * 60)
        print("✅ Metadata scan complete!")
        print("=" * 60)
        
        # Summary
        print(f"""
Summary:
  - Validation Rules in org: {len(scan_results['validation_rules'])}
  - Flows in org: {len(scan_results['flows'])}
  - Apex Triggers: {len(scan_results['triggers'])}
  - Apex Test Classes: {len(scan_results['apex_classes'])}
  - Custom Objects: {len(scan_results['custom_objects'])}

To implement in Orchestrator:
  1. Use scan_org_metadata() to discover testable items
  2. Generate tests based on validation rules and flows
  3. Execute via API and capture results
        """)
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit(main())

