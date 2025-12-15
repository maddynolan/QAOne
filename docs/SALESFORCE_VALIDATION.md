# Salesforce Metadata Validation

> **Enterprise-Grade Salesforce Test Validation**  
> Validate test workflows against your Salesforce org metadata

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Setup](#setup)
4. [Usage](#usage)
5. [API Reference](#api-reference)
6. [Validation Types](#validation-types)
7. [Best Practices](#best-practices)

---

## Overview

The Salesforce Metadata Validation feature allows you to validate test workflows against your Salesforce org's metadata before execution. This ensures:

- Object API names are valid
- Field API names exist on the correct objects
- Picklist values are valid
- Selectors use stable patterns (not dynamic IDs)
- Lightning component patterns are correct

---

## Features

### 1. Org Connection
- Connect to Production or Sandbox orgs
- Secure credential handling
- Session-based authentication

### 2. Metadata Caching
- Fetch and cache org metadata locally
- Objects, fields, picklists, record types
- Offline validation using cached data

### 3. Real-time Validation
- Validate selectors as you build workflows
- Per-step validation indicators
- Warnings for unstable patterns

### 4. Smart Suggestions
- Similar name suggestions for typos
- Field autocomplete
- Object autocomplete

---

## Setup

### Prerequisites

1. **Salesforce Credentials**
   - Username (e.g., `user@company.com`)
   - Password
   - Security Token (optional for whitelisted IPs)

2. **Python Package** (Backend)
   ```bash
   pip install simple-salesforce
   ```

### Environment Variables (Optional)

You can pre-configure credentials in `backend/.env`:

```bash
SF_USERNAME=user@company.com
SF_PASSWORD=your-password
SF_SECURITY_TOKEN=your-token
SF_DOMAIN=login  # or "test" for sandbox
```

---

## Usage

### In Workflow Editor

1. **Select Salesforce App Type**
   - Choose "Salesforce/LWC" from the App Type dropdown

2. **Connect to Org (Optional)**
   - Click "Connect" tab in Salesforce Validation panel
   - Enter credentials
   - Click "Connect to Salesforce"

3. **Fetch Metadata**
   - Click "Fetch Metadata" to download org metadata
   - This caches object and field definitions locally

4. **Validate Workflow**
   - Click "Validate Workflow" button
   - View per-step validation results
   - Fix any warnings before execution

### Validation Indicators

Each workflow step shows validation status:

| Indicator | Meaning |
|-----------|---------|
| ☁️ Valid | Selector passes all validations |
| ⚠️ N issues | Step has validation warnings |

### Viewing Issues

Click on any step with warnings to see:
- Specific warnings (e.g., "Aura dynamic ID")
- Suggestions for better selectors
- Referenced fields and components

---

## API Reference

### Connection Endpoints

#### GET `/api/salesforce/status`
Get current connection and cache status.

**Response:**
```json
{
  "loaded": true,
  "objects_count": 25,
  "fields_count": 450,
  "connected_to_org": true,
  "instance_url": "https://your-org.my.salesforce.com"
}
```

#### POST `/api/salesforce/connect`
Connect to a Salesforce org.

**Request:**
```json
{
  "username": "user@company.com",
  "password": "password123",
  "security_token": "abc123",
  "domain": "login"
}
```

### Metadata Endpoints

#### POST `/api/salesforce/metadata/fetch`
Fetch metadata from connected org.

**Request:**
```json
{
  "objects": ["Account", "Contact", "CustomObject__c"]
}
```

#### GET `/api/salesforce/metadata/objects`
List all cached objects.

#### GET `/api/salesforce/metadata/objects/{name}/fields`
Get fields for a specific object.

### Validation Endpoints

#### POST `/api/salesforce/validate/object`
Validate an object API name.

**Request:**
```json
{
  "object_name": "Account"
}
```

**Response:**
```json
{
  "valid": true,
  "object_name": "Account",
  "label": "Account",
  "custom": false,
  "message": "Standard object: Account"
}
```

#### POST `/api/salesforce/validate/field`
Validate a field API name.

**Request:**
```json
{
  "object_name": "Account",
  "field_name": "Industry"
}
```

#### POST `/api/salesforce/validate/selector`
Validate a Salesforce selector.

**Request:**
```json
{
  "selector": "lightning-input[data-field='Email']"
}
```

**Response:**
```json
{
  "valid": true,
  "selector": "lightning-input[data-field='Email']",
  "warnings": [],
  "extracted": {
    "fields": ["Email"],
    "objects": [],
    "components": ["lightning-input"],
    "record_ids": []
  },
  "suggestions": ["Valid Lightning component: lightning-input"]
}
```

#### POST `/api/salesforce/validate/workflow`
Validate an entire workflow.

**Request:**
```json
{
  "nodes": [
    {
      "data": {
        "selector": "lightning-input[name='Email']",
        "type": "input"
      }
    }
  ],
  "app_type": "salesforce"
}
```

**Response:**
```json
{
  "workflow_valid": true,
  "total_steps": 5,
  "valid_steps": 5,
  "warnings_count": 0,
  "steps": [...],
  "summary": {
    "objects_referenced": [],
    "fields_referenced": ["Email"],
    "components_used": ["lightning-input"],
    "invalid_selectors": [],
    "unknown_fields": []
  }
}
```

### Autocomplete Endpoints

#### POST `/api/salesforce/suggest/fields`
Get field suggestions.

**Request:**
```json
{
  "object_name": "Account",
  "partial": "Ind",
  "limit": 10
}
```

#### POST `/api/salesforce/suggest/objects`
Get object suggestions.

**Request:**
```json
{
  "partial": "Acc",
  "limit": 10
}
```

---

## Validation Types

### 1. Object Validation

Validates that object API names exist in your org.

| Check | Example |
|-------|---------|
| Standard objects | Account, Contact, Lead |
| Custom objects | MyCustomObject__c |
| Similar name suggestions | "Acount" → "Account" |

### 2. Field Validation

Validates that fields exist on the specified object.

| Check | Example |
|-------|---------|
| Standard fields | Email, Phone, Name |
| Custom fields | Custom_Field__c |
| Field type | picklist, text, lookup |
| Required fields | Non-nullable fields |

### 3. Picklist Validation

Validates picklist values against active values.

```json
{
  "object_name": "Lead",
  "field_name": "Status",
  "value": "Open - Not Contacted"
}
```

### 4. Selector Validation

Detects unstable selector patterns:

| Pattern | Risk | Alternative |
|---------|------|-------------|
| `auraId_123` | Dynamic | Use `[data-id="..."]` |
| `lwc-456` | Dynamic | Use `lightning-*[name="..."]` |
| `#12345` | Numeric ID | Use `[data-field="..."]` |
| `ember789` | Ember ID | Use accessible selectors |

### 5. Lightning Component Validation

Validates Lightning Web Component patterns:

```javascript
// Supported components
'lightning-input'
'lightning-button'
'lightning-combobox'
'lightning-record-form'
'lightning-datatable'
// ... 20+ more
```

---

## Best Practices

### 1. Fetch Metadata Regularly

```
Before major test creation → Fetch latest metadata
After org deployments → Refresh cache
```

### 2. Use Stable Selectors

**Good:**
```javascript
'[data-id="emailField"]'
'lightning-input[name="Email"]'
'[aria-label="Email"]'
```

**Avoid:**
```javascript
'#auraId_123'
'.slds-456'
'[id="ember789"]'
```

### 3. Validate Before Execution

Always run validation before executing tests against production data.

### 4. Cache for CI/CD

Export metadata cache for offline validation in CI/CD pipelines:

```bash
# Location of cache file
backend/app/services/salesforce/metadata_cache/sf_metadata.json
```

### 5. Handle Custom Objects

When using custom objects:
1. Ensure they're included in metadata fetch
2. Validate field API names carefully
3. Check picklist values for custom fields

---

## Troubleshooting

### Connection Issues

| Issue | Solution |
|-------|----------|
| "Invalid credentials" | Check username/password/token |
| "IP restricted" | Whitelist IP or get security token |
| "Session expired" | Reconnect to org |

### Validation Issues

| Issue | Solution |
|-------|----------|
| "Object not in cache" | Fetch metadata for that object |
| "Field not found" | Check field API name spelling |
| "Unknown component" | May be custom LWC - still valid |

### Cache Issues

| Issue | Solution |
|-------|----------|
| "Stale data" | Re-fetch metadata |
| "Missing objects" | Specify objects in fetch request |

---

*Last updated: December 2024*
