import os
import sys
import threading
import django
from datetime import date, time, timedelta

# Setup Django environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from centres.models import ProcurementCentre
from bookings.models import Slot, Booking
from accounts.models import Farmer
from rest_framework.test import APIClient

def test_simultaneous_booking_last_slot():
    print("[TEST 2] Starting simultaneous booking concurrency test on last slot (capacity=1, booked_count=0)...")

    centre, _ = ProcurementCentre.objects.get_or_create(
        name="Race Test Mandi",
        defaults={"district": "Karnal", "state": "Haryana", "daily_capacity": 50}
    )

    farmer_a, _ = Farmer.objects.get_or_create(
        phone_number="9871110001",
        defaults={"full_name": "Farmer Race A", "preferred_language": "hi"}
    )
    farmer_b, _ = Farmer.objects.get_or_create(
        phone_number="9871110002",
        defaults={"full_name": "Farmer Race B", "preferred_language": "hi"}
    )

    tomorrow = date.today() + timedelta(days=2)
    Slot.objects.filter(centre=centre, date=tomorrow, start_time=time(14, 0), end_time=time(16, 0)).delete()
    slot = Slot.objects.create(
        centre=centre,
        date=tomorrow,
        start_time=time(14, 0),
        end_time=time(16, 0),
        capacity=1,
        booked_count=0
    )

    results = []
    responses = []

    def make_booking(user):
        from django.db import connection
        try:
            client = APIClient()
            client.force_authenticate(user=user)
            res = client.post(
                '/api/bookings/',
                {'slot': slot.id, 'quantity_kg': 1000},
                format='json'
            )
            results.append(res.status_code)
            responses.append(res.data)
        finally:
            connection.close()

    t1 = threading.Thread(target=make_booking, args=(farmer_a,))
    t2 = threading.Thread(target=make_booking, args=(farmer_b,))

    t1.start()
    t2.start()
    t1.join()
    t2.join()

    print(f"   Results status codes: {results}")
    print(f"   Responses: {responses}")

    assert sorted(results) == [201, 400], f"Expected exactly [201, 400], got {results}"
    print("   [PASS] Exactly one request succeeded (201) and the other was rejected (400)!")

    # Check error message of rejected request
    err_res = [r for r in responses if isinstance(r, dict) and ('fully booked' in str(r).lower() or 'no longer available' in str(r).lower() or 'error' in str(r).lower())]
    assert len(err_res) >= 1, f"Expected clean error response, got {responses}"
    print("   [PASS] Rejected request received clean error message (no 500 error)")

    slot.refresh_from_db()
    print(f"   Slot booked_count in database: {slot.booked_count}")
    assert slot.booked_count == 1, f"Expected booked_count == 1, got {slot.booked_count}"
    print("   [PASS] Slot.booked_count correctly reflects 1 (not 2, not 0)!")

    total_bookings = Booking.objects.filter(slot=slot).count()
    assert total_bookings == 1, f"Expected 1 booking, got {total_bookings}"
    print("   [PASS] Exactly 1 Booking created in database!")
    print("   [SUCCESS] Slot capacity enforcement and concurrency locking verified end-to-end!")

if __name__ == '__main__':
    test_simultaneous_booking_last_slot()
