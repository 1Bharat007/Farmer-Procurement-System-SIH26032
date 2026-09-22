import os
import sys
import asyncio
import django
import uuid
from datetime import time

# Setup Django environment
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from core.asgi import application
from django.utils import timezone
from centres.models import ProcurementCentre
from bookings.models import Slot, Booking
from accounts.models import Farmer
from rest_framework.test import APIClient

def prepare_data():
    today = timezone.localdate()
    centre, _ = ProcurementCentre.objects.get_or_create(
        name="Test Mandi WS",
        defaults={"district": "Karnal", "state": "Haryana", "daily_capacity": 50}
    )
    farmer, _ = Farmer.objects.get_or_create(
        phone_number="9988776655",
        defaults={"full_name": "Test WS Farmer", "preferred_language": "hi"}
    )
    slot, _ = Slot.objects.get_or_create(
        centre=centre,
        date=today,
        start_time=time(10, 0),
        end_time=time(11, 0),
        defaults={"capacity": 10, "booked_count": 0}
    )

    qr_token = str(uuid.uuid4())
    booking = Booking.objects.create(
        farmer=farmer,
        slot=slot,
        status='booked',
        quantity_kg=500,
        qr_code_token=qr_token
    )
    return centre.id, booking.id, qr_token

def perform_check_in(qr_token):
    client = APIClient()
    admin = Farmer.objects.filter(is_staff=True).first()
    client.force_authenticate(user=admin)
    return client.post('/api/bookings/check-in-qr/', {'qr_code_token': qr_token}, format='json')

async def test_websocket_broadcast():
    print("[TEST 1] Starting WebSocket broadcast test...")

    centre_id, booking_id, qr_token = await sync_to_async(prepare_data)()

    # 1. Connect WebSocket client to ws/queue/<centre_id>/
    communicator = WebsocketCommunicator(application, f"/ws/queue/{centre_id}/")
    connected, subprotocol = await communicator.connect()
    assert connected, f"Failed to connect to /ws/queue/{centre_id}/"
    print(f"   [PASS] WebSocket client connected to /ws/queue/{centre_id}/")

    # 2. Trigger check-in via check-in-qr endpoint
    response = await sync_to_async(perform_check_in)(qr_token)
    assert response.status_code == 200, f"Check-in failed: {response.data}"
    print("   [PASS] check-in-qr API call succeeded (HTTP 200)")

    # 3. Confirm WebSocket client receives the farmer_checked_in event
    received = await communicator.receive_json_from(timeout=5)
    print(f"   [PASS] WebSocket event received in real time: {received}")
    assert received.get('event') == 'farmer_checked_in'
    assert received.get('booking_id') == booking_id
    assert received.get('farmer_name') == "Test WS Farmer"
    print("   [SUCCESS] WebSocket consumer verified end-to-end!")

    await communicator.disconnect()

if __name__ == '__main__':
    asyncio.run(test_websocket_broadcast())
