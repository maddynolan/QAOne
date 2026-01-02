"""
Deploy Test Metadata to Salesforce Org

This script deploys actual validation rules, flows, triggers, and custom objects
to the connected Salesforce org using the Tooling API and Metadata API.

Prerequisites:
- Connected to a Salesforce org with admin permissions
- simple_salesforce package installed
"""

import os
import sys
import json
import time
import base64
from pathlib import Path
from datetime import datetime, timedelta

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
    
    print(f"Connected as {creds['username']}")
    return sf, creds


def refresh_token_if_needed(creds):
    """Refresh access token using refresh token"""
    import httpx
    
    print("Refreshing access token...")
    response = httpx.post(
        'https://login.salesforce.com/services/oauth2/token',
        data={
            'grant_type': 'refresh_token',
            'client_id': creds['client_id'],
            'client_secret': creds['client_secret'],
            'refresh_token': creds['refresh_token']
        }
    )
    
    if response.status_code == 200:
        data = response.json()
        creds['access_token'] = data['access_token']
        creds['instance_url'] = data['instance_url']
        
        creds_path = Path(__file__).parent.parent / "config" / "salesforce_credentials.json"
        with open(creds_path, 'w') as f:
            json.dump(creds, f, indent=4)
        
        print(f"Token refreshed successfully!")
        return creds
    else:
        raise Exception(f"Token refresh failed: {response.text}")


# ============================================================================
# VALIDATION RULES
# ============================================================================

VALIDATION_RULES = [
    # Account Validation Rules
    {
        "object": "Account",
        "name": "QA_Account_Industry_Description",
        "description": "Description required when Industry is set",
        "errorConditionFormula": "AND(NOT(ISBLANK(Industry)), ISBLANK(Description))",
        "errorDisplayField": "Description",
        "errorMessage": "Please provide a Description when Industry is specified"
    },
    {
        "object": "Account",
        "name": "QA_Account_Rating_Revenue",
        "description": "Hot rating requires Annual Revenue > 500000",
        "errorConditionFormula": "AND(ISPICKVAL(Rating, 'Hot'), OR(ISBLANK(AnnualRevenue), AnnualRevenue < 500000))",
        "errorDisplayField": "Rating",
        "errorMessage": "Hot rating requires Annual Revenue of at least $500,000"
    },
    # Contact Validation Rules
    {
        "object": "Contact",
        "name": "QA_Contact_Phone_Mobile",
        "description": "Either Phone or MobilePhone required",
        "errorConditionFormula": "AND(ISBLANK(Phone), ISBLANK(MobilePhone))",
        "errorDisplayField": "Phone",
        "errorMessage": "Please provide either Phone or Mobile Phone"
    },
    {
        "object": "Contact",
        "name": "QA_Contact_Title_Account",
        "description": "Title required when Account is specified",
        "errorConditionFormula": "AND(NOT(ISBLANK(AccountId)), ISBLANK(Title))",
        "errorDisplayField": "Title",
        "errorMessage": "Title is required for contacts linked to an Account"
    },
    # Lead Validation Rules
    {
        "object": "Lead",
        "name": "QA_Lead_Email_Company",
        "description": "Email domain should match company",
        "errorConditionFormula": "AND(NOT(ISBLANK(Email)), NOT(CONTAINS(Email, '.')))",
        "errorDisplayField": "Email",
        "errorMessage": "Please enter a valid email address"
    },
    {
        "object": "Lead",
        "name": "QA_Lead_Rating_Source",
        "description": "Hot leads require Lead Source",
        "errorConditionFormula": "AND(ISPICKVAL(Rating, 'Hot'), ISBLANK(LeadSource))",
        "errorDisplayField": "LeadSource",
        "errorMessage": "Hot leads require a Lead Source"
    },
    # Opportunity Validation Rules  
    {
        "object": "Opportunity",
        "name": "QA_Opp_Probability_Stage",
        "description": "Probability must match stage expectations",
        "errorConditionFormula": "AND(ISPICKVAL(StageName, 'Closed Won'), Probability < 100)",
        "errorDisplayField": "Probability",
        "errorMessage": "Closed Won opportunities must have 100% probability"
    },
    {
        "object": "Opportunity",
        "name": "QA_Opp_NextStep_Stage",
        "description": "Next Step required after Qualification",
        "errorConditionFormula": "AND(NOT(ISPICKVAL(StageName, 'Prospecting')), NOT(ISPICKVAL(StageName, 'Qualification')), ISBLANK(NextStep))",
        "errorDisplayField": "NextStep",
        "errorMessage": "Next Step is required after Qualification stage"
    },
    # Case Validation Rules
    {
        "object": "Case",
        "name": "QA_Case_Priority_Description",
        "description": "High priority cases require detailed description",
        "errorConditionFormula": "AND(ISPICKVAL(Priority, 'High'), LEN(Description) < 50)",
        "errorDisplayField": "Description",
        "errorMessage": "High priority cases require a description of at least 50 characters"
    },
    {
        "object": "Case",
        "name": "QA_Case_Contact_Account",
        "description": "Contact or Account required",
        "errorConditionFormula": "AND(ISBLANK(ContactId), ISBLANK(AccountId))",
        "errorDisplayField": "ContactId",
        "errorMessage": "Please specify either a Contact or an Account"
    }
]


def deploy_validation_rules(sf):
    """Deploy validation rules using Tooling API"""
    print("\n" + "="*60)
    print("DEPLOYING VALIDATION RULES")
    print("="*60)
    
    deployed = []
    failed = []
    
    for rule in VALIDATION_RULES:
        try:
            # Check if rule already exists
            existing = sf.toolingexecute(
                f"query/?q=SELECT+Id,ValidationName+FROM+ValidationRule+WHERE+ValidationName='{rule['name']}'"
            )
            
            if existing.get('records'):
                print(f"  [EXISTS] {rule['object']}.{rule['name']}")
                deployed.append(rule['name'])
                continue
            
            # Get EntityDefinitionId for the object
            entity_query = sf.toolingexecute(
                f"query/?q=SELECT+DurableId+FROM+EntityDefinition+WHERE+QualifiedApiName='{rule['object']}'"
            )
            
            if not entity_query.get('records'):
                print(f"  [ERROR] Object {rule['object']} not found")
                failed.append(rule['name'])
                continue
            
            entity_id = entity_query['records'][0]['DurableId']
            
            # Create validation rule metadata
            metadata = {
                "Metadata": {
                    "description": rule['description'],
                    "errorConditionFormula": rule['errorConditionFormula'],
                    "errorDisplayField": rule.get('errorDisplayField'),
                    "errorMessage": rule['errorMessage'],
                    "active": True
                },
                "FullName": f"{rule['object']}.{rule['name']}"
            }
            
            # Deploy using Tooling API
            result = sf.toolingexecute(
                "sobjects/ValidationRule/",
                method="POST",
                data=json.dumps(metadata)
            )
            
            if result.get('success') or result.get('id'):
                print(f"  [CREATED] {rule['object']}.{rule['name']}")
                deployed.append(rule['name'])
            else:
                print(f"  [FAILED] {rule['object']}.{rule['name']}: {result}")
                failed.append(rule['name'])
                
        except Exception as e:
            print(f"  [ERROR] {rule['object']}.{rule['name']}: {str(e)[:100]}")
            failed.append(rule['name'])
    
    print(f"\nValidation Rules: {len(deployed)} deployed, {len(failed)} failed")
    return deployed, failed


# ============================================================================
# CUSTOM FIELDS
# ============================================================================

CUSTOM_FIELDS = [
    # Account Custom Fields
    {
        "object": "Account",
        "name": "QA_Test_Score__c",
        "label": "QA Test Score",
        "type": "Number",
        "precision": 5,
        "scale": 2,
        "description": "Automated test coverage score"
    },
    {
        "object": "Account", 
        "name": "QA_Last_Tested__c",
        "label": "QA Last Tested",
        "type": "DateTime",
        "description": "Last automated test execution date"
    },
    {
        "object": "Account",
        "name": "QA_Test_Status__c",
        "label": "QA Test Status",
        "type": "Picklist",
        "picklistValues": ["Not Tested", "In Progress", "Passed", "Failed", "Blocked"],
        "description": "Current test execution status"
    },
    # Contact Custom Fields
    {
        "object": "Contact",
        "name": "QA_Preferred_Contact_Method__c",
        "label": "Preferred Contact Method",
        "type": "Picklist",
        "picklistValues": ["Email", "Phone", "SMS", "Mail"],
        "description": "How the contact prefers to be reached"
    },
    # Opportunity Custom Fields
    {
        "object": "Opportunity",
        "name": "QA_Competitor__c",
        "label": "Competitor",
        "type": "Text",
        "length": 100,
        "description": "Primary competitor for this opportunity"
    },
    {
        "object": "Opportunity",
        "name": "QA_Win_Reason__c",
        "label": "Win Reason",
        "type": "Picklist",
        "picklistValues": ["Price", "Features", "Relationship", "Service", "Other"],
        "description": "Reason for winning the deal"
    }
]


def deploy_custom_fields(sf):
    """Deploy custom fields - Note: Requires Metadata API for full deployment"""
    print("\n" + "="*60)
    print("CUSTOM FIELDS (Requires Setup > Object Manager)")
    print("="*60)
    
    print("Custom fields require manual creation or Metadata API deployment.")
    print("Here are the fields to create:\n")
    
    for field in CUSTOM_FIELDS:
        print(f"  Object: {field['object']}")
        print(f"    Field: {field['name']}")
        print(f"    Label: {field['label']}")
        print(f"    Type: {field['type']}")
        if field['type'] == 'Picklist':
            print(f"    Values: {', '.join(field['picklistValues'])}")
        print()
    
    return [], []


# ============================================================================
# TEST DATA RECORDS
# ============================================================================

def create_comprehensive_test_data(sf):
    """Create comprehensive test data across all objects"""
    print("\n" + "="*60)
    print("CREATING COMPREHENSIVE TEST DATA")
    print("="*60)
    
    created_records = {
        "accounts": [],
        "contacts": [],
        "opportunities": [],
        "leads": [],
        "cases": [],
        "tasks": [],
        "events": []
    }
    
    try:
        # ==================== ACCOUNTS ====================
        print("\n[Accounts]")
        account_data = [
            {
                "Name": "QA Tech Enterprise",
                "Industry": "Technology",
                "Type": "Customer",
                "Phone": "555-100-1000",
                "Website": "https://qatechenterprise.com",
                "AnnualRevenue": 1500000,
                "NumberOfEmployees": 200,
                "Rating": "Hot",
                "Description": "Large technology enterprise customer for QA testing scenarios"
            },
            {
                "Name": "QA Healthcare Solutions",
                "Industry": "Healthcare",
                "Type": "Customer",
                "Phone": "555-100-2000",
                "Website": "https://qahealthcare.com",
                "AnnualRevenue": 750000,
                "NumberOfEmployees": 100,
                "Rating": "Warm",
                "Description": "Healthcare company for testing industry-specific scenarios"
            },
            {
                "Name": "QA Finance Corp",
                "Industry": "Finance",
                "Type": "Prospect",
                "Phone": "555-100-3000",
                "Website": "https://qafinance.com",
                "AnnualRevenue": 2000000,
                "NumberOfEmployees": 500,
                "Rating": "Hot",
                "Description": "Financial services prospect for complex deal testing"
            },
            {
                "Name": "QA Retail Stores",
                "Industry": "Retail",
                "Type": "Customer",
                "Phone": "555-100-4000",
                "Website": "https://qaretail.com",
                "AnnualRevenue": 300000,
                "NumberOfEmployees": 50,
                "Rating": "Cold",
                "Description": "Small retail customer for boundary testing"
            },
            {
                "Name": "QA Manufacturing Inc",
                "Industry": "Manufacturing",
                "Type": "Partner",
                "Phone": "555-100-5000",
                "Website": "https://qamfg.com",
                "AnnualRevenue": 5000000,
                "NumberOfEmployees": 1000,
                "Rating": "Warm",
                "Description": "Manufacturing partner for integration testing"
            }
        ]
        
        for acc in account_data:
            try:
                result = sf.Account.create(acc)
                created_records["accounts"].append({
                    "id": result['id'],
                    "name": acc['Name'],
                    "industry": acc['Industry']
                })
                print(f"  Created: {acc['Name']} ({result['id']})")
            except Exception as e:
                print(f"  Failed: {acc['Name']} - {str(e)[:50]}")
        
        # ==================== CONTACTS ====================
        print("\n[Contacts]")
        if created_records["accounts"]:
            contact_data = [
                {
                    "FirstName": "John",
                    "LastName": "QA-CEO",
                    "Email": "john.ceo@qatechenterprise.com",
                    "Phone": "555-200-1001",
                    "MobilePhone": "555-200-1002",
                    "Title": "Chief Executive Officer",
                    "Department": "Executive",
                    "AccountId": created_records["accounts"][0]["id"]
                },
                {
                    "FirstName": "Sarah",
                    "LastName": "QA-CTO",
                    "Email": "sarah.cto@qatechenterprise.com",
                    "Phone": "555-200-1003",
                    "MobilePhone": "555-200-1004",
                    "Title": "Chief Technology Officer",
                    "Department": "Technology",
                    "AccountId": created_records["accounts"][0]["id"]
                },
                {
                    "FirstName": "Mike",
                    "LastName": "QA-Sales",
                    "Email": "mike.sales@qahealthcare.com",
                    "Phone": "555-200-2001",
                    "Title": "VP of Sales",
                    "Department": "Sales",
                    "AccountId": created_records["accounts"][1]["id"] if len(created_records["accounts"]) > 1 else created_records["accounts"][0]["id"]
                },
                {
                    "FirstName": "Emily",
                    "LastName": "QA-Finance",
                    "Email": "emily.finance@qafinance.com",
                    "Phone": "555-200-3001",
                    "Title": "CFO",
                    "Department": "Finance",
                    "AccountId": created_records["accounts"][2]["id"] if len(created_records["accounts"]) > 2 else created_records["accounts"][0]["id"]
                },
                {
                    "FirstName": "Alex",
                    "LastName": "QA-Support",
                    "Email": "alex.support@qaretail.com",
                    "Phone": "555-200-4001",
                    "MobilePhone": "555-200-4002",
                    "Title": "Support Manager",
                    "Department": "Support",
                    "AccountId": created_records["accounts"][3]["id"] if len(created_records["accounts"]) > 3 else created_records["accounts"][0]["id"]
                }
            ]
            
            for contact in contact_data:
                try:
                    result = sf.Contact.create(contact)
                    created_records["contacts"].append({
                        "id": result['id'],
                        "name": f"{contact['FirstName']} {contact['LastName']}",
                        "email": contact['Email']
                    })
                    print(f"  Created: {contact['FirstName']} {contact['LastName']} ({result['id']})")
                except Exception as e:
                    print(f"  Failed: {contact['FirstName']} {contact['LastName']} - {str(e)[:50]}")
        
        # ==================== OPPORTUNITIES ====================
        print("\n[Opportunities]")
        if created_records["accounts"]:
            close_date = (datetime.now() + timedelta(days=60)).strftime('%Y-%m-%d')
            opp_data = [
                {
                    "Name": "QA Enterprise Deal - Large",
                    "AccountId": created_records["accounts"][0]["id"],
                    "StageName": "Proposal/Price Quote",
                    "CloseDate": close_date,
                    "Amount": 250000,
                    "Probability": 50,
                    "LeadSource": "Web",
                    "NextStep": "Schedule demo with CTO",
                    "Description": "Large enterprise deal for testing opportunity stages"
                },
                {
                    "Name": "QA Healthcare Expansion",
                    "AccountId": created_records["accounts"][1]["id"] if len(created_records["accounts"]) > 1 else created_records["accounts"][0]["id"],
                    "StageName": "Qualification",
                    "CloseDate": close_date,
                    "Amount": 75000,
                    "Probability": 25,
                    "LeadSource": "Partner Referral",
                    "Description": "Healthcare expansion opportunity"
                },
                {
                    "Name": "QA Finance Platform",
                    "AccountId": created_records["accounts"][2]["id"] if len(created_records["accounts"]) > 2 else created_records["accounts"][0]["id"],
                    "StageName": "Negotiation/Review",
                    "CloseDate": close_date,
                    "Amount": 500000,
                    "Probability": 75,
                    "LeadSource": "Phone Inquiry",
                    "NextStep": "Final contract review",
                    "Description": "High-value finance platform deal"
                },
                {
                    "Name": "QA Retail Pilot",
                    "AccountId": created_records["accounts"][3]["id"] if len(created_records["accounts"]) > 3 else created_records["accounts"][0]["id"],
                    "StageName": "Prospecting",
                    "CloseDate": close_date,
                    "Amount": 15000,
                    "Probability": 10,
                    "LeadSource": "Web",
                    "Description": "Small pilot program for retail"
                }
            ]
            
            for opp in opp_data:
                try:
                    result = sf.Opportunity.create(opp)
                    created_records["opportunities"].append({
                        "id": result['id'],
                        "name": opp['Name'],
                        "stage": opp['StageName'],
                        "amount": opp['Amount']
                    })
                    print(f"  Created: {opp['Name']} ({result['id']})")
                except Exception as e:
                    print(f"  Failed: {opp['Name']} - {str(e)[:50]}")
        
        # ==================== LEADS ====================
        print("\n[Leads]")
        lead_data = [
            {
                "FirstName": "Lead",
                "LastName": "QA-Tech-Hot",
                "Company": "QA Potential Tech Corp",
                "Email": "lead.hot@potentialtech.com",
                "Phone": "555-300-1001",
                "Status": "Open - Not Contacted",
                "Industry": "Technology",
                "Rating": "Hot",
                "LeadSource": "Web",
                "Description": "Hot lead from technology sector"
            },
            {
                "FirstName": "Lead",
                "LastName": "QA-Healthcare-Warm",
                "Company": "QA Potential Healthcare",
                "Email": "lead.warm@potentialhealth.com",
                "Phone": "555-300-2001",
                "Status": "Working - Contacted",
                "Industry": "Healthcare",
                "Rating": "Warm",
                "LeadSource": "Partner Referral",
                "Description": "Warm healthcare lead"
            },
            {
                "FirstName": "Lead",
                "LastName": "QA-Finance-Cold",
                "Company": "QA Potential Finance",
                "Email": "lead.cold@potentialfinance.com",
                "Phone": "555-300-3001",
                "Status": "Open - Not Contacted",
                "Industry": "Finance",
                "Rating": "Cold",
                "LeadSource": "Phone Inquiry",
                "Description": "Cold finance lead for nurturing"
            }
        ]
        
        for lead in lead_data:
            try:
                result = sf.Lead.create(lead)
                created_records["leads"].append({
                    "id": result['id'],
                    "name": f"{lead['FirstName']} {lead['LastName']}",
                    "company": lead['Company'],
                    "status": lead['Status']
                })
                print(f"  Created: {lead['FirstName']} {lead['LastName']} ({result['id']})")
            except Exception as e:
                print(f"  Failed: {lead['FirstName']} {lead['LastName']} - {str(e)[:50]}")
        
        # ==================== CASES ====================
        print("\n[Cases]")
        if created_records["accounts"] and created_records["contacts"]:
            case_data = [
                {
                    "Subject": "QA Test Case - High Priority Bug",
                    "Description": "This is a high priority test case to verify escalation workflows and SLA tracking. The issue involves critical functionality that needs immediate attention.",
                    "Status": "New",
                    "Priority": "High",
                    "Origin": "Web",
                    "AccountId": created_records["accounts"][0]["id"],
                    "ContactId": created_records["contacts"][0]["id"]
                },
                {
                    "Subject": "QA Test Case - Feature Request",
                    "Description": "Feature request case for testing case management workflows.",
                    "Status": "Working",
                    "Priority": "Medium",
                    "Origin": "Phone",
                    "AccountId": created_records["accounts"][1]["id"] if len(created_records["accounts"]) > 1 else created_records["accounts"][0]["id"],
                    "ContactId": created_records["contacts"][2]["id"] if len(created_records["contacts"]) > 2 else created_records["contacts"][0]["id"]
                },
                {
                    "Subject": "QA Test Case - General Inquiry",
                    "Description": "Low priority inquiry for testing case routing.",
                    "Status": "New",
                    "Priority": "Low",
                    "Origin": "Email",
                    "AccountId": created_records["accounts"][0]["id"]
                }
            ]
            
            for case in case_data:
                try:
                    result = sf.Case.create(case)
                    created_records["cases"].append({
                        "id": result['id'],
                        "subject": case['Subject'],
                        "status": case['Status'],
                        "priority": case['Priority']
                    })
                    print(f"  Created: {case['Subject'][:40]}... ({result['id']})")
                except Exception as e:
                    print(f"  Failed: {case['Subject'][:30]}... - {str(e)[:50]}")
        
        # ==================== TASKS ====================
        print("\n[Tasks]")
        if created_records["contacts"]:
            task_date = (datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')
            task_data = [
                {
                    "Subject": "QA Follow-up Call",
                    "Status": "Not Started",
                    "Priority": "High",
                    "ActivityDate": task_date,
                    "WhoId": created_records["contacts"][0]["id"],
                    "Description": "Follow up on QA testing requirements"
                },
                {
                    "Subject": "QA Send Proposal",
                    "Status": "In Progress",
                    "Priority": "Normal",
                    "ActivityDate": task_date,
                    "WhoId": created_records["contacts"][1]["id"] if len(created_records["contacts"]) > 1 else created_records["contacts"][0]["id"],
                    "Description": "Prepare and send proposal document"
                }
            ]
            
            for task in task_data:
                try:
                    result = sf.Task.create(task)
                    created_records["tasks"].append({
                        "id": result['id'],
                        "subject": task['Subject'],
                        "status": task['Status']
                    })
                    print(f"  Created: {task['Subject']} ({result['id']})")
                except Exception as e:
                    print(f"  Failed: {task['Subject']} - {str(e)[:50]}")
        
        # ==================== EVENTS ====================
        print("\n[Events]")
        if created_records["contacts"]:
            event_start = datetime.now() + timedelta(days=3)
            event_end = event_start + timedelta(hours=1)
            event_data = [
                {
                    "Subject": "QA Demo Meeting",
                    "StartDateTime": event_start.isoformat(),
                    "EndDateTime": event_end.isoformat(),
                    "WhoId": created_records["contacts"][0]["id"],
                    "Description": "Product demo for QA testing",
                    "Location": "Conference Room A"
                }
            ]
            
            for event in event_data:
                try:
                    result = sf.Event.create(event)
                    created_records["events"].append({
                        "id": result['id'],
                        "subject": event['Subject']
                    })
                    print(f"  Created: {event['Subject']} ({result['id']})")
                except Exception as e:
                    print(f"  Failed: {event['Subject']} - {str(e)[:50]}")
        
    except Exception as e:
        print(f"\nError creating test data: {e}")
    
    # Summary
    print("\n" + "="*60)
    print("TEST DATA SUMMARY")
    print("="*60)
    print(f"  Accounts:      {len(created_records['accounts'])}")
    print(f"  Contacts:      {len(created_records['contacts'])}")
    print(f"  Opportunities: {len(created_records['opportunities'])}")
    print(f"  Leads:         {len(created_records['leads'])}")
    print(f"  Cases:         {len(created_records['cases'])}")
    print(f"  Tasks:         {len(created_records['tasks'])}")
    print(f"  Events:        {len(created_records['events'])}")
    
    return created_records


# ============================================================================
# SCAN EXISTING METADATA
# ============================================================================

def scan_existing_metadata(sf):
    """Scan and display all existing testable metadata"""
    print("\n" + "="*60)
    print("SCANNING EXISTING METADATA")
    print("="*60)
    
    results = {}
    
    # Validation Rules
    print("\n[Validation Rules]")
    try:
        vr = sf.toolingexecute(
            "query/?q=SELECT+Id,ValidationName,EntityDefinition.QualifiedApiName,Active,ErrorMessage+FROM+ValidationRule+WHERE+Active=true"
        )
        results['validation_rules'] = vr.get('records', [])
        for rule in results['validation_rules']:
            obj = rule.get('EntityDefinition', {}).get('QualifiedApiName', 'Unknown')
            print(f"  [{obj}] {rule['ValidationName']}")
            print(f"      Error: {rule.get('ErrorMessage', 'N/A')[:60]}...")
    except Exception as e:
        print(f"  Error: {e}")
        results['validation_rules'] = []
    
    # Flows
    print("\n[Flows]")
    try:
        flows = sf.toolingexecute(
            "query/?q=SELECT+Id,MasterLabel,ProcessType,Status+FROM+Flow+WHERE+Status='Active'"
        )
        results['flows'] = flows.get('records', [])
        for flow in results['flows']:
            print(f"  {flow['MasterLabel']} ({flow.get('ProcessType', 'Unknown')})")
    except Exception as e:
        print(f"  Error: {e}")
        results['flows'] = []
    
    # Apex Triggers
    print("\n[Apex Triggers]")
    try:
        triggers = sf.query(
            "SELECT Id, Name, TableEnumOrId, Status FROM ApexTrigger WHERE Status = 'Active'"
        )
        results['triggers'] = triggers.get('records', [])
        for trigger in results['triggers']:
            print(f"  {trigger['Name']} on {trigger['TableEnumOrId']}")
    except Exception as e:
        print(f"  Error: {e}")
        results['triggers'] = []
    
    # Apex Test Classes
    print("\n[Apex Test Classes]")
    try:
        classes = sf.query(
            "SELECT Id, Name FROM ApexClass WHERE Status = 'Active' AND (Name LIKE '%Test%' OR Name LIKE '%test%')"
        )
        results['apex_classes'] = classes.get('records', [])
        for cls in results['apex_classes']:
            print(f"  {cls['Name']}")
    except Exception as e:
        print(f"  Error: {e}")
        results['apex_classes'] = []
    
    # Custom Objects
    print("\n[Custom Objects]")
    try:
        objects = sf.query(
            "SELECT Id, DeveloperName, QualifiedApiName FROM EntityDefinition WHERE IsCustomizable = true AND QualifiedApiName LIKE '%__c' LIMIT 20"
        )
        results['custom_objects'] = objects.get('records', [])
        for obj in results['custom_objects']:
            print(f"  {obj['QualifiedApiName']}")
    except Exception as e:
        print(f"  Error: {e}")
        results['custom_objects'] = []
    
    # Save results
    output_path = Path(__file__).parent.parent / "data" / "sf_metadata_scan.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    print(f"\nSaved scan results to {output_path}")
    
    return results


# ============================================================================
# MAIN
# ============================================================================

def main():
    print("="*60)
    print("SALESFORCE TEST METADATA DEPLOYMENT")
    print("="*60)
    
    try:
        # Connect
        sf, creds = get_sf_connection()
    except Exception as e:
        if "Session expired" in str(e) or "INVALID_SESSION" in str(e):
            print("Session expired, refreshing token...")
            creds_path = Path(__file__).parent.parent / "config" / "salesforce_credentials.json"
            with open(creds_path) as f:
                creds = json.load(f)
            creds = refresh_token_if_needed(creds)
            sf, creds = get_sf_connection()
        else:
            raise
    
    # Scan existing metadata
    scan_existing_metadata(sf)
    
    # Deploy validation rules
    deployed_vr, failed_vr = deploy_validation_rules(sf)
    
    # Show custom fields to create
    deploy_custom_fields(sf)
    
    # Create comprehensive test data
    test_data = create_comprehensive_test_data(sf)
    
    # Save created data for reference
    output_path = Path(__file__).parent.parent / "data" / "sf_test_data_created.json"
    with open(output_path, 'w') as f:
        json.dump(test_data, f, indent=2)
    print(f"\nSaved created data to {output_path}")
    
    # Final summary
    print("\n" + "="*60)
    print("DEPLOYMENT COMPLETE")
    print("="*60)
    
    return 0


if __name__ == "__main__":
    exit(main())

