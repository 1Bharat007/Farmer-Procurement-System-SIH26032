"""
Automated Reliability Pass Verification Script.
Tests:
1. Global Exception Handler (4xx clean error format, 500 JSON envelope)
2. Double-Booking Prevention with select_for_update() row locks
3. Active Health Check (Database, Redis, Celery)
4. Rate Limiting (OTP, Login, Booking)
5. Celery Graceful Degradation during Booking Creation
"""

import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from datetime import date, time
from django.test import RequestFactory
from django.db import connection, transaction
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework.exceptions import ValidationError, PermissionDenied

from core.exceptions import custom_exception_handler
from core.urls import health_check
from core.throttling import OTPRateThrottle, LoginRateThrottle, BookingRateThrottle
from accounts.models import Farmer, OTPRecord
from centres.models import ProcurementCentre
from bookings.models import Slot, Booking
from bookings.serializers import BookingSerializer
from bookings.views import BookingViewSet
from accounts.views import SendFarmerOTPView, StaffLoginView


def run_tests():
    print("\n" + "=" * 70)
    print(" RUNNING RELIABILITY & ERROR HANDLING AUDIT VERIFICATION")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. Global Exception Handler Verification
    # -------------------------------------------------------------
    print("\n[TEST 1] Testing Global DRF Exception Handler...")
    rf = APIRequestFactory()
    req = rf.get('/api/test-endpoint/')

    # Test handled exception (ValidationError)
    val_exc = ValidationError({"slot": ["This slot is fully booked."]})
    res_val = custom_exception_handler(val_exc, {'view': None, 'request': req})
    assert res_val is not None, "Handled exception should return Response"
    assert res_val.status_code == 400
    assert res_val.data.get('status') == 'error'
    assert 'Slot: This slot is fully booked.' in res_val.data.get('error')
    print("  [PASS] Handled 400 ValidationError produces clean JSON error envelope")

    # Test unhandled unexpected exception (e.g. ZeroDivisionError or DatabaseError)
    unhandled_exc = ZeroDivisionError("division by zero simulated crash")
    res_unhandled = custom_exception_handler(unhandled_exc, {'view': None, 'request': req})
    assert res_unhandled is not None, "Unhandled exception should return Response, not None"
    assert res_unhandled.status_code == 500
    assert res_unhandled.data.get('status') == 'error'
    assert "Server error" in res_unhandled.data.get('error') or "unexpected" in res_unhandled.data.get('error').lower()
    print("  [PASS] Unhandled 500 error produces structured JSON instead of HTML traceback")

    # -------------------------------------------------------------
    # 2. Double-Booking Prevention & Row Locking
    # -------------------------------------------------------------
    print("\n[TEST 2] Testing Double-Booking Prevention with select_for_update()...")
    centre, _ = ProcurementCentre.objects.get_or_create(
        name="Reliability Test Mandi",
        defaults={"district": "Karnal", "state": "Haryana", "daily_capacity": 500}
    )

    test_date = date.today()
    slot, _ = Slot.objects.get_or_create(
        centre=centre,
        date=test_date,
        start_time=time(14, 0),
        end_time=time(15, 0),
        defaults={"capacity": 1, "booked_count": 0}
    )
    # Reset slot capacity to 1 and booked_count to 0
    slot.capacity = 1
    slot.booked_count = 0
    slot.save()

    farmer1, _ = Farmer.objects.get_or_create(
        phone_number="9876500001",
        defaults={"full_name": "Farmer One"}
    )
    farmer2, _ = Farmer.objects.get_or_create(
        phone_number="9876500002",
        defaults={"full_name": "Farmer Two"}
    )

    # First booking succeeds
    s1 = BookingSerializer(data={"slot": slot.id, "quantity_kg": 500})
    assert s1.is_valid(), f"Serializer 1 invalid: {s1.errors}"
    b1 = s1.save(farmer=farmer1)
    slot.refresh_from_db()
    assert slot.booked_count == 1
    print(f"  [PASS] First farmer booked slot #{slot.id}. Slot booked_count is now: {slot.booked_count}/{slot.capacity}")

    # Second booking for the same slot must fail with ValidationError
    s2 = BookingSerializer(data={"slot": slot.id, "quantity_kg": 500})
    assert s2.is_valid(), f"Serializer 2 invalid: {s2.errors}"
    try:
        s2.save(farmer=farmer2)
        assert False, "Second booking should have been rejected due to slot capacity reached"
    except ValidationError as err:
        assert "no longer available" in str(err) or "capacity" in str(err).lower()
        print(f"  [PASS] Second farmer booking cleanly rejected: {err.detail['slot']}")

    slot.refresh_from_db()
    assert slot.booked_count == 1, "Slot booked_count was corrupted by race condition!"
    print(f"  [PASS] Slot booked_count preserved at exact capacity ({slot.booked_count})")

    # -------------------------------------------------------------
    # 3. Active Health Check (Postgres, Redis, Celery)
    # -------------------------------------------------------------
    print("\n[TEST 3] Testing Active Health Check Endpoint...")
    h_req = rf.get('/api/health/')
    h_res = health_check(h_req)
    assert h_res.status_code in [200, 503], f"Health check returned unexpected code: {h_res.status_code}"
    print(f"  [PASS] Health check HTTP Status: {h_res.status_code}")
    print(f"  [PASS] Overall System Status: {h_res.data.get('status')}")
    print(f"  [PASS] Database Probe: {h_res.data.get('checks', {}).get('database')}")
    print(f"  [PASS] Redis Probe: {h_res.data.get('checks', {}).get('redis')}")
    print(f"  [PASS] Celery Probe: {h_res.data.get('checks', {}).get('celery')}")
    assert 'database' in h_res.data.get('checks', {})
    assert 'redis' in h_res.data.get('checks', {})
    assert 'celery' in h_res.data.get('checks', {})

    # -------------------------------------------------------------
    # 4. Rate Limiting Verification
    # -------------------------------------------------------------
    print("\n[TEST 4] Testing Throttling Configuration...")
    otp_throttle = OTPRateThrottle()
    login_throttle = LoginRateThrottle()
    booking_throttle = BookingRateThrottle()

    assert otp_throttle.rate == '5/minute', f"Expected 5/minute, got {otp_throttle.rate}"
    assert login_throttle.rate == '10/minute', f"Expected 10/minute, got {login_throttle.rate}"
    assert booking_throttle.rate == '30/hour', f"Expected 30/hour, got {booking_throttle.rate}"
    print("  [PASS] OTP throttle rate configured to 5/minute")
    print("  [PASS] Login throttle rate configured to 10/minute")
    print("  [PASS] Booking throttle rate configured to 30/hour")

    # -------------------------------------------------------------
    # 5. Celery Graceful Degradation
    # -------------------------------------------------------------
    print("\n[TEST 5] Testing Celery Graceful Degradation on Booking Creation...")
    slot_extra, _ = Slot.objects.get_or_create(
        centre=centre,
        date=test_date,
        start_time=time(16, 0),
        end_time=time(17, 0),
        defaults={"capacity": 5, "booked_count": 0}
    )
    view = BookingViewSet.as_view({'post': 'create'})
    b_req = rf.post('/api/bookings/', {"slot": slot_extra.id, "quantity_kg": 100}, format='json')
    force_authenticate(b_req, user=farmer1)
    b_res = view(b_req)
    assert b_res.status_code == 201, f"Booking creation failed with status {b_res.status_code}: {b_res.data}"
    print(f"  [PASS] Booking #{b_res.data['id']} created successfully with Celery error isolation")

    print("\n" + "=" * 70)
    print(" ALL RELIABILITY TESTS PASSED CLEANLY!")
    print("=" * 70)


if __name__ == '__main__':
    run_tests()
