"""
Salesforce Module Routers

Salesforce-specific testing tools including metadata validation, org
management, and OAuth2 authentication. Supports multi-org connections
and Salesforce-aware test code generation.

Routers:
- salesforce_api: /api/salesforce/* - Metadata validation, org management, auto-connect
- salesforce_auth: /api/salesforce/auth/* - Salesforce OAuth2 authentication flow
"""
from .salesforce_api import router as salesforce_router
from .salesforce_api import auto_connect_salesforce
from .salesforce_auth import router as salesforce_auth_router
