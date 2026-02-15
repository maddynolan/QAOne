"""
Platform Module Routers

Core platform infrastructure including health checks, dashboard metrics,
licensing, database operations, project management, defect tracking,
requirements management, traceability, and system monitoring.

Routers:
- health_api: /health/* - Health checks and readiness probes
- dashboard_api: /dashboard/* - Dashboard metrics and activity feed
- download_api: /api/download/* - File download endpoints
- license_api: /api/license/* - License management and validation
- plugin_api: /api/plugins/* - Plugin management
- app_first_flow: /api/app-first-flow/* - First-run setup wizard
- secrets_api: /api/secrets/* - Secrets vault management
- database_api: /api/db/* - Database CRUD operations
- tenants_api: /api/tenants/* - Multi-tenant management
- leads_api: /api/leads/* - Lead capture and management
- oauth2_api: /api/oauth2/* - OAuth2 authentication flows
- metrics_api: /api/metrics/* - Application metrics collection
- system_monitoring_api: /api/system/* - System health monitoring
- server_monitoring_api: /api/server/* - Server resource monitoring
- defects_api: /defects/* - Defect tracking and management
- requirements_api: /api/requirements/* - Requirements management
- traceability_api: /api/traceability/* - Requirements-to-test traceability
- project_management_api: /api/projects/* - Project management with boards
- framework_analyzer_api: /api/framework/* - Framework detection and analysis
- code_alchemy_api: /api/code-alchemy/* - Repository import and code analysis
- owasp_security_api: /api/owasp/* - OWASP security scanning
"""
from .health_api import router as health_router
from .dashboard_api import router as dashboard_router
from .download_api import router as download_router
from .license_api import router as license_router
from .plugin_api import router as plugin_router
from .app_first_flow import router as app_first_flow_router
from .secrets_api import router as secrets_router
from .database_api import router as database_router
from .tenants_api import router as tenants_router
from .leads_api import router as leads_router
from .oauth2_api import router as oauth2_router
from .metrics_api import router as metrics_router
from .system_monitoring_api import router as system_monitoring_router
from .server_monitoring_api import router as server_monitoring_router
from .defects_api import router as defects_router
from .requirements_api import router as requirements_router
from .traceability_api import router as traceability_router
from .project_management_api import router as project_management_router
from .framework_analyzer_api import router as framework_analyzer_router
from .code_alchemy_api import router as code_alchemy_router
from .owasp_security_api import router as owasp_security_router
