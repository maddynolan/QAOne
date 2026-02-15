"""
Prometheus Metrics API
Exposes metrics endpoint for Prometheus scraping.
"""

from fastapi import APIRouter
from fastapi.responses import Response
from app.services.observability.prometheus_exporter import (
    get_metrics,
    get_metrics_content_type
)

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("")
async def prometheus_metrics():
    """
    Prometheus metrics endpoint.
    Returns metrics in Prometheus text format.
    
    This endpoint should be scraped by Prometheus server.
    No authentication required (Prometheus needs access).
    """
    metrics = get_metrics()
    return Response(
        content=metrics,
        media_type=get_metrics_content_type()
    )

