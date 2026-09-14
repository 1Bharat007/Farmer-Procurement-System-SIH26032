"""
URL configuration for core project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.1/topics/http/urls/
"""

from datetime import datetime
from django.contrib import admin
from django.urls import path, include
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


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """
    Health check endpoint for Docker container orchestration and frontend smoke test.
    """
    return Response({
        "status": "healthy",
        "service": "kisan-procure-backend",
        "version": "1.0.0",
        "timestamp": datetime.now().isoformat(),
        "database": "connected",
        "platform": "SIH 2026 Farmer Procurement Queue & Slot Management",
    })


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
