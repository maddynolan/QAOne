# 🧪 SF Tools Comprehensive Testing Guide

This guide walks you through testing EVERY feature in SF Tools. Follow along step by step.

---

## 📋 Prerequisites

Before starting, ensure:
- ✅ You're logged into your Salesforce org in Flowstral
- ✅ You have Account records in the org
- ✅ You have Contact records in the org
- ✅ At least one validation rule exists (on Account or Contact)
- ✅ You're a System Administrator (for Login As testing)

---

## 🔷 PART 1: SOQL Builder (`SF Tools > SOQL`)

### Test 1.1: Basic Query
1. Open **Record** tab in Flowstral
2. Navigate to your Salesforce org in the browser
3. Click **SF Tools** tab on the right panel
4. Click **SOQL** sub-tab
5. Select **Account** from the object dropdown
6. Check fields: `Id`, `Name`, `Industry`, `Type`
7. Click **Run** button
8. ✅ **Expected**: Results table shows Account records

### Test 1.2: Add WHERE Condition
1. Click **+ Add** in WHERE section
2. Select field: `Industry`
3. Select operator: `=`
4. Enter value: `Technology`
5. Click **Run**
6. ✅ **Expected**: Only Technology accounts shown

### Test 1.3: Add Step (+Step Button)
1. Build any query (e.g., `SELECT Id, Name FROM Account LIMIT 5`)
2. Click **+Step** button at bottom
3. ✅ **Expected**: Toast "Added SOQL Query step"
4. ✅ **Expected**: Step appears in Recorded Steps panel

### Test 1.4: Add Assertion (+Assert Button)
1. Build query: `SELECT Id FROM Account WHERE Name LIKE '%Test%'`
2. Click **+Assert** button
3. ✅ **Expected**: Toast "Added SOQL Assertion step"
4. ✅ **Expected**: Assertion step appears in Recorded Steps

### Test 1.5: Row Actions (NEW!)
1. Run query: `SELECT Id, Name, Industry FROM Account LIMIT 10`
2. Hover over any record row in results table
3. ✅ **Expected**: See **Step** and **Assert** buttons appear
4. Click **Step** on a row
5. ✅ **Expected**: Adds step for that specific record
6. Click **Assert** on another row
7. ✅ **Expected**: Adds assertion for that record

---

## 🔷 PART 2: SF Context Dashboard (`SF Tools > SF Context`)

### Test 2.1: Connection Status
1. Click **SF Context** sub-tab
2. ✅ **Expected**: Shows connected org info
3. ✅ **Expected**: Shows current user
4. ✅ **Expected**: Shows session time remaining

### Test 2.2: Login As User
1. Expand "Login As User" section
2. Search for a user (e.g., type "Standard")
3. ✅ **Expected**: Users filtered by search
4. Click on a user from the list
5. ✅ **Expected**: "Login As [User]" step added
6. Click "Open in SF" icon next to a user
7. ✅ **Expected**: Opens new tab with Login As URL

### Test 2.3: Variables
1. Expand "Variables" section
2. Enter variable name: `testAccountId`
3. Enter value: `001XXXXXXXXXXXX` (any 18-char ID)
4. Click **Add**
5. ✅ **Expected**: Variable appears in list
6. Click on variable to copy
7. ✅ **Expected**: Shows `{{testAccountId}}`

### Test 2.4: Recent Records
1. Expand "Recent Records" section
2. Navigate to an Account record in SF browser
3. ✅ **Expected**: Record appears in Recent Records list
4. Click "Use" button on a record
5. ✅ **Expected**: Record ID captured as variable

---

## 🔷 PART 3: Metadata Assertions (`SF Tools > Assert`)

### Test 3.1: Field Exists Assertion
1. Click **Assert** sub-tab
2. Select assertion type: **Field Exists**
3. Select object: **Account**
4. Select field: **Industry**
5. Click **+Add Assertion**
6. ✅ **Expected**: Step added to verify Industry field exists

### Test 3.2: Field Type Assertion
1. Select assertion type: **Field Type**
2. Select object: **Account**
3. Select field: **Name**
4. Expected type: **string**
5. Click **+Add Assertion**
6. ✅ **Expected**: Step added to verify Name is text

### Test 3.3: Field Required Assertion
1. Select assertion type: **Field Required**
2. Select object: **Account**
3. Select field: **Name**
4. Check "Required"
5. Click **+Add Assertion**
6. ✅ **Expected**: Step added to verify Name is required

### Test 3.4: Picklist Values Assertion
1. Select assertion type: **Picklist Values**
2. Select object: **Account**
3. Select field: **Industry**
4. Enter expected values: `Technology, Finance, Healthcare`
5. Click **+Add Assertion**
6. ✅ **Expected**: Step added to verify picklist values

### Test 3.5: Validation Rule Assertion
1. Select assertion type: **Validation Rule Active**
2. Select object: **Account** (or where your rule is)
3. Click refresh to load validation rules
4. Select your validation rule from dropdown
5. Check "Is Active"
6. Click **+Add Assertion**
7. ✅ **Expected**: Step added to verify rule is active

### Test 3.6: Flow Active Assertion
1. Select assertion type: **Flow Active**
2. Click refresh to load flows
3. Select a flow from dropdown
4. Click **+Add Assertion**
5. ✅ **Expected**: Step added to verify flow is active

---

## 🔷 PART 4: Stage Transitions (`SF Tools > Stages`)

### Test 4.1: Select Object and Stage Field
1. Click **Stages** sub-tab
2. Select object: **Opportunity**
3. ✅ **Expected**: Stage field auto-detected (StageName)
4. ✅ **Expected**: Stage values loaded

### Test 4.2: Build Stage Progression
1. Click stages in order: `Prospecting` → `Qualification` → `Proposal` → `Closed Won`
2. ✅ **Expected**: Each stage shows as selected
3. ✅ **Expected**: Flow diagram shows progression

### Test 4.3: Generate Test Steps
1. With stages selected, click **Generate Test Steps**
2. ✅ **Expected**: Multiple steps added:
   - Create Opportunity at first stage
   - Update stage transitions
   - Assertions after each transition

### Test 4.4: Add Single Transition
1. Clear selection
2. Select just 2 stages: `Prospecting` → `Qualification`
3. Click **+Add Transition**
4. ✅ **Expected**: Single transition step added

---

## 🔷 PART 5: Quick Actions (`SF Tools > Quick`)

### Test 5.1: Quick Account Creation
1. Click **Quick** sub-tab
2. Click **Account** quick action
3. ✅ **Expected**: Form appears with Account fields
4. Fill in Name, Industry
5. Click **Create**
6. ✅ **Expected**: CreateRecord step added to test

### Test 5.2: Quick Contact Creation
1. Click **Contact** quick action
2. Fill in FirstName, LastName, Email
3. Optional: Link to Account using `{{accountId}}` variable
4. Click **Create**
5. ✅ **Expected**: CreateRecord step added

### Test 5.3: Quick Lead Creation
1. Click **Lead** quick action
2. Fill required fields
3. Click **Create**
4. ✅ **Expected**: CreateRecord step added

### Test 5.4: Quick Opportunity Creation
1. Click **Opportunity** quick action
2. Fill Name, Stage, Close Date
3. Click **Create**
4. ✅ **Expected**: CreateRecord step added

---

## 🔷 PART 6: Runtime Execution Test

### Test 6.1: Execute a SF Step
1. In Recorded Steps, you should have several SF steps
2. Click **Builder** button to go to test builder
3. In Builder, click **Run** to execute the test
4. ✅ **Expected**: Navigate step works
5. ✅ **Expected**: SOQL queries execute and return data
6. ✅ **Expected**: Assertions pass/fail correctly

### Test 6.2: Variable Resolution
1. Add a SOQL step that stores result: `storeAs: {{accountId}}`
2. Add a step that uses the variable: `WHERE Id = '{{accountId}}'`
3. Run the test
4. ✅ **Expected**: Variable is populated from first query
5. ✅ **Expected**: Variable is used in second query

---

## 🔷 PART 7: Login As Permission Testing

### Test 7.1: Test as Standard User
1. Add Login As step for a Standard User
2. Add SOQL step: `SELECT Id FROM Account LIMIT 1`
3. Run the test
4. ✅ **Expected**: Login As changes session
5. ✅ **Expected**: Query runs with Standard User permissions
6. ✅ **Expected**: Only visible records returned (based on sharing)

### Test 7.2: Test Field-Level Security
1. Add Login As step for user without access to certain fields
2. Try to query restricted fields
3. ✅ **Expected**: Field access follows FLS rules

---

## ✅ Test Completion Checklist

| Feature | Tested | Notes |
|---------|--------|-------|
| SOQL - Basic Query | ☐ | |
| SOQL - WHERE Conditions | ☐ | |
| SOQL - ORDER BY | ☐ | |
| SOQL - LIMIT | ☐ | |
| SOQL - +Step Button | ☐ | |
| SOQL - +Assert Button | ☐ | |
| SOQL - Row +Step | ☐ | |
| SOQL - Row +Assert | ☐ | |
| SF Context - Connection | ☐ | |
| SF Context - Login As | ☐ | |
| SF Context - Variables | ☐ | |
| SF Context - Recent Records | ☐ | |
| Assert - Field Exists | ☐ | |
| Assert - Field Type | ☐ | |
| Assert - Field Required | ☐ | |
| Assert - Picklist Values | ☐ | |
| Assert - Validation Rule | ☐ | |
| Assert - Flow Active | ☐ | |
| Stages - Select Stages | ☐ | |
| Stages - Generate Test | ☐ | |
| Stages - Single Transition | ☐ | |
| Quick - Create Account | ☐ | |
| Quick - Create Contact | ☐ | |
| Quick - Create Lead | ☐ | |
| Quick - Create Opportunity | ☐ | |
| Runtime - Execute Steps | ☐ | |
| Runtime - Variables | ☐ | |
| Login As - Standard User | ☐ | |

---

## 🐛 Report Issues

If any feature doesn't work as expected:
1. Note the feature name
2. Describe expected vs actual behavior
3. Check browser console for errors (F12)
4. Share the error message

Happy Testing! 🚀

