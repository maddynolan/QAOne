"""
Subscription API Router — SaaS trial and plan management.

Endpoints:
    GET  /api/subscriptions/current        - Get current org subscription
    PUT  /api/subscriptions/upgrade         - Upgrade plan (admin only)
    POST /api/subscriptions/extend-trial    - Extend trial (admin only)
    GET  /api/subscriptions/limits          - Get current limits and usage
    POST /api/subscriptions/check-warnings  - Trigger trial warning email check
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

subscription_router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])


# ==================== Request Models ====================

class UpgradeRequest(BaseModel):
    plan: str = Field(..., description="Target plan: free, pro, enterprise")
    stripe_customer_id: Optional[str] = None
    stripe_subscription_id: Optional[str] = None


class ExtendTrialRequest(BaseModel):
    extra_days: int = Field(14, ge=1, le=90, description="Days to extend (1-90)")


# ==================== Helpers ====================

async def _get_org_id_from_token(authorization: Optional[str]) -> str:
    """Extract org_id from JWT token."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.split(" ", 1)[1] if authorization.startswith("Bearer ") else authorization

    from app.services.auth.auth_service import auth_service
    session = await auth_service.get_session(token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    org = session.get("org")
    if not org:
        raise HTTPException(status_code=400, detail="No organization context")

    return org["id"]


# ==================== Endpoints ====================

@subscription_router.get("/current")
async def get_current_subscription(authorization: Optional[str] = Header(None)):
    """
    Get the current subscription for the authenticated user's organization.
    Includes plan, status, days remaining, and limits.
    """
    try:
        org_id = await _get_org_id_from_token(authorization)

        from app.services.core.subscription_service import subscription_service
        sub = await subscription_service.get_subscription(org_id)

        if not sub:
            return {
                "plan": "free",
                "status": "active",
                "days_remaining": -1,
                "max_users": 3,
                "max_test_runs_per_month": 1000,
                "max_projects": 1,
                "message": "No subscription found — using free tier defaults."
            }

        return sub
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get subscription error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get subscription")


@subscription_router.put("/upgrade")
async def upgrade_plan(request: UpgradeRequest, authorization: Optional[str] = Header(None)):
    """
    Upgrade or change the plan for the current org.
    Requires admin/owner role.
    """
    try:
        org_id = await _get_org_id_from_token(authorization)

        valid_plans = {"free", "pro", "enterprise"}
        if request.plan not in valid_plans:
            raise HTTPException(status_code=400, detail=f"Invalid plan. Must be one of: {', '.join(valid_plans)}")

        from app.services.core.subscription_service import subscription_service
        result = await subscription_service.upgrade_plan(
            org_id=org_id,
            plan=request.plan,
            stripe_customer_id=request.stripe_customer_id,
            stripe_subscription_id=request.stripe_subscription_id,
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Upgrade plan error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upgrade plan")


@subscription_router.post("/extend-trial")
async def extend_trial(request: ExtendTrialRequest, authorization: Optional[str] = Header(None)):
    """
    Extend the trial period for the current org.
    Requires admin/owner role.
    """
    try:
        org_id = await _get_org_id_from_token(authorization)

        from app.services.core.subscription_service import subscription_service
        result = await subscription_service.extend_trial(org_id, request.extra_days)
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Extend trial error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to extend trial")


@subscription_router.get("/limits")
async def get_limits(authorization: Optional[str] = Header(None)):
    """
    Get current plan limits and usage for the org.
    """
    try:
        org_id = await _get_org_id_from_token(authorization)

        from app.services.core.subscription_service import subscription_service
        sub = await subscription_service.get_subscription(org_id)

        if not sub:
            # No subscription record = default to trial so users can evaluate all features
            # They'll be prompted to subscribe when the trial period logic kicks in
            from app.services.core.subscription_service import PLAN_LIMITS, FEATURE_TIER_MAP, TIER_HIERARCHY
            trial_limits = PLAN_LIMITS.get("trial", PLAN_LIMITS.get("pro", {}))
            trial_level = TIER_HIERARCHY.get("trial", 3)
            features = {}
            for feat, req_tier in FEATURE_TIER_MAP.items():
                req_level = TIER_HIERARCHY.get(req_tier, 0)
                features[feat] = trial_level >= req_level
            return {
                "plan": "trial",
                "status": "active",
                "days_remaining": 14,
                "limits": {
                    "max_users": trial_limits.get("max_users", 10),
                    "max_test_runs_per_month": trial_limits.get("max_test_runs_per_month", 10000),
                    "max_projects": trial_limits.get("max_projects", 5),
                    "max_playbacks_per_day": trial_limits.get("max_playbacks_per_day", 999),
                },
                "usage": {"users": 0, "test_runs_this_month": 0, "projects": 0},
                "features": features,
            }

        # Get real usage from DB
        usage = await subscription_service.get_usage(org_id)

        from app.services.core.subscription_service import PLAN_LIMITS, FEATURE_TIER_MAP, TIER_HIERARCHY
        plan = sub.get("plan", "free")
        plan_limits = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

        # Build feature availability map
        plan_level = TIER_HIERARCHY.get(plan, 0)
        features = {}
        for feat, req_tier in FEATURE_TIER_MAP.items():
            req_level = TIER_HIERARCHY.get(req_tier, 0)
            features[feat] = plan_level >= req_level

        return {
            "plan": plan,
            "status": sub.get("status", "active"),
            "limits": {
                "max_users": sub.get("max_users", plan_limits.get("max_users", 1)),
                "max_test_runs_per_month": sub.get("max_test_runs_per_month", plan_limits.get("max_test_runs_per_month", 100)),
                "max_projects": sub.get("max_projects", plan_limits.get("max_projects", 1)),
                "max_playbacks_per_day": plan_limits.get("max_playbacks_per_day", 3),
            },
            "usage": usage,
            "days_remaining": sub.get("days_remaining", -1),
            "features": features,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get limits error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get limits")


@subscription_router.post("/check-warnings")
async def check_warnings(authorization: Optional[str] = Header(None)):
    """
    Trigger check for expiring trials and send warning emails.
    Admin-only endpoint for manual or cron-triggered checks.
    """
    try:
        # Verify auth
        await _get_org_id_from_token(authorization)

        from app.services.core.subscription_service import subscription_service
        sent_count = await subscription_service.check_and_send_warnings()
        return {"status": "ok", "emails_sent": sent_count}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Check warnings error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to check warnings")
