"""
Permission Decorators
Convenience decorators for RBAC enforcement.
Re-exports from rbac_middleware for easier imports.
"""

from app.middleware.rbac_middleware import (
    require_permission,
    require_role,
    require_any_permission
)

__all__ = [
    "require_permission",
    "require_role",
    "require_any_permission"
]

