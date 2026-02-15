# Salesforce Routers

Backend API routers for Salesforce-specific testing operations including OAuth2 authentication, SOQL queries, Apex execution, metadata inspection, CRUD operations, and bulk data management.

## Router Inventory

| File | Lines | Prefix | Endpoints | Purpose |
|------|-------|--------|-----------|---------|
| `salesforce_api.py` | 1,826 | `/api/salesforce` | 28 | Full Salesforce integration -- SOQL, CRUD, metadata, Apex, reports, bulk operations, field analysis |
| `salesforce_auth.py` | 364 | `/api/salesforce/auth` | 11 | OAuth2 authentication -- connect, callback, token refresh, org info, session management |

**Total: 39 endpoints across 2 routers**

## Key Endpoints

| Endpoint | Method | Router | Purpose |
|----------|--------|--------|---------|
| `/api/salesforce/auth/connect` | POST | salesforce_auth | Initiate OAuth2 connection to Salesforce org |
| `/api/salesforce/auth/callback` | GET | salesforce_auth | OAuth2 callback handler |
| `/api/salesforce/auth/refresh` | POST | salesforce_auth | Refresh access token |
| `/api/salesforce/query` | POST | salesforce_api | Execute SOQL query |
| `/api/salesforce/describe/{object}` | GET | salesforce_api | Get SObject metadata/describe |
| `/api/salesforce/apex/execute` | POST | salesforce_api | Execute anonymous Apex code |
| `/api/salesforce/records` | POST/PUT/DELETE | salesforce_api | Record CRUD operations |
| `/api/salesforce/metadata` | GET | salesforce_api | Retrieve org metadata |
| `/api/salesforce/bulk` | POST | salesforce_api | Bulk data operations |

## Related Backend Services

| Service Directory | Purpose |
|-------------------|---------|
| `backend/app/services/flowstral/` | salesforce_playwright_generator.py, robust_salesforce_generator.py (SF-specific code generation) |

## Related Frontend Module

- `src/modules/salesforce/` -- SalesforceToolsPage, 23 components, 5 lib files for SF API client and test data factory
