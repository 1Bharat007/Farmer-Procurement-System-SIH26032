"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
"""

from datetime import datetime
import logging
from django.conf import settings
from django.db import connection
from django.contrib import admin
from django.urls import path, include
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from accounts.views import (
    CustomTokenObtainPairView,
    SendFarmerOTPView,
    VerifyFarmerOTPView,
    AuthMeView,
)

logger = logging.getLogger('core')


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Active health check verifying PostgreSQL, Redis, and Celery reachability.
    Degrades gracefully: if Redis or Celery are temporarily down, returns 200 OK
    with 'degraded' status so callers and frontend smoke tests don't fail.
    """
    checks = {}
    is_healthy = True

    # 1. Database Connectivity (PostgreSQL / SQLite)
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
            if row and row[0] == 1:
                checks['database'] = {"status": "ok", "detail": "connected"}
            else:
                checks['database'] = {"status": "error", "detail": "unexpected query result"}
                is_healthy = False
    except Exception as exc:
        logger.error(f"[HEALTH CHECK] Database check failed: {exc}")
        checks['database'] = {"status": "error", "detail": str(exc)}
        is_healthy = False

    # 2. Redis Reachability
    redis_reachable = False
    try:
        import redis
        redis_client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=1.0)
        if redis_client.ping():
            redis_reachable = True
            checks['redis'] = {"status": "ok", "detail": "connected"}
        else:
            checks['redis'] = {"status": "degraded", "detail": "ping returned false"}
    except Exception as exc:
        checks['redis'] = {"status": "degraded", "detail": str(exc)}

    # 3. Celery Reachability
    try:
        from celery import current_app
        inspector = current_app.control.inspect(timeout=1.0)
        ping_res = inspector.ping() if inspector else None
        if ping_res:
            checks['celery'] = {"status": "ok", "detail": f"{len(ping_res)} active worker node(s)"}
        else:
            checks['celery'] = {"status": "degraded", "detail": "no active celery workers responded"}
    except Exception as exc:
        checks['celery'] = {"status": "degraded", "detail": str(exc)}

    # Overall system health evaluation
    all_ok = is_healthy and redis_reachable and checks['celery']['status'] == 'ok'
    overall_status = "healthy" if all_ok else ("degraded" if is_healthy else "unhealthy")

    http_status = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE

    return Response({
        "status": overall_status,
        "service": "kisan-procure-backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "database": checks['database']['detail'],
        "platform": "SIH 2026 Farmer Procurement Queue & Slot Management",
        "checks": checks,
    }, status=http_status)


urlpatterns = [
    # Admin Panel
    path('admin/', admin.site.urls),

    # Health Check
    path('api/health/', health_check, name='health-check'),

    # Central Auth API Endpoints (/api/auth/...)
    path('api/auth/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    path('api/auth/farmer/send-otp/', SendFarmerOTPView.as_view(), name='auth_farmer_send_otp'),
    path('api/auth/farmer/verify-otp/', VerifyFarmerOTPView.as_view(), name='auth_farmer_verify_otp'),
    path('api/auth/me/', AuthMeView.as_view(), name='auth_me'),

    # Module API Routes
    path('api/accounts/', include('accounts.urls')),
    path('api/centres/', include('centres.urls')),
    path('api/bookings/', include('bookings.urls')),
    path('api/queue/', include('queue_app.urls')),
    path('api/notifications/', include('notifications.urls')),
]
