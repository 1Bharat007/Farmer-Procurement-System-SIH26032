"""
Throttling classes for KisanSlot Platform.
Smart India Hackathon 2026 - Problem Statement 26032

Protects:
- OTP dispatch (phone & IP)
- Staff/Farmer Login (prevents brute-force)
- Booking creation (prevents slot hoarding / booking spam)
"""

from rest_framework.throttling import AnonRateThrottle, UserRateThrottle, SimpleRateThrottle


class OTPRateThrottle(SimpleRateThrottle):
    """
    Limits the number of OTP requests that can be made per phone or IP.
    Rate: 5 requests per minute.
    """
    scope = 'otp'

    def get_cache_key(self, request, view):
        phone = (
            request.data.get('phone_number') or
            request.data.get('phone') or
            ''
        )
        if phone:
            clean_phone = str(phone).strip().replace(" ", "").replace("-", "")
            return f"throttle_otp_{clean_phone}"
        return self.get_ident(request)


class LoginRateThrottle(AnonRateThrottle):
    """
    Protects login endpoints against brute-force password guessing.
    Rate: 10 requests per minute per IP.
    """
    scope = 'login'


class BookingRateThrottle(UserRateThrottle):
    """
    Limits the number of bookings a user or IP can create within a window.
    Rate: 30 requests per hour.
    """
    scope = 'booking'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            return f"throttle_booking_user_{request.user.pk}"
        return f"throttle_booking_anon_{self.get_ident(request)}"
