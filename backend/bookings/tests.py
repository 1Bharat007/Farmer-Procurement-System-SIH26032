"""
Critical-path tests for Slot Booking, Race Conditions, Permissions, and Queue Transitions.
Smart India Hackathon 2026 - Problem Statement 26032
"""

import threading
from datetime import date, time, timedelta
from rest_framework import status
from rest_framework.test import APITestCase, APITransactionTestCase
from accounts.models import Farmer, CentreOperator
from centres.models import ProcurementCentre
from bookings.models import Slot, Booking
from queue_app.models import QueueToken


class SlotBookingAndConcurrencyTests(APITransactionTestCase):
    """
    Tests covering:
    - Booking slot with capacity succeeds and increments booked_count
    - Booking full slot fails with clean error
    - Simultaneous booking race condition: only one succeeds on the last slot
    """

    def setUp(self):
        self.centre = ProcurementCentre.objects.create(
            name="Karnal Main Mandi",
            district="Karnal",
            state="Haryana",
            daily_capacity=200,
        )
        self.farmer1 = Farmer.objects.create(
            phone_number="9876540001",
            full_name="Farmer One",
            preferred_language="hi",
        )
        self.farmer2 = Farmer.objects.create(
            phone_number="9876540002",
            full_name="Farmer Two",
            preferred_language="hi",
        )

        today = date.today() + timedelta(days=1)
        self.slot = Slot.objects.create(
            centre=self.centre,
            date=today,
            start_time=time(10, 0),
            end_time=time(11, 0),
            capacity=1,
            booked_count=0,
        )

    def test_book_slot_with_capacity_succeeds_and_increments_count(self):
        """Booking a slot with capacity succeeds and increments booked_count."""
        self.client.force_authenticate(user=self.farmer1)
        response = self.client.post(
            '/api/bookings/',
            {'slot': self.slot.id, 'quantity_kg': 500},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'booked')

        self.slot.refresh_from_db()
        self.assertEqual(self.slot.booked_count, 1)
        self.assertTrue(self.slot.is_full)

    def test_book_full_slot_fails_cleanly(self):
        """Booking a slot that has reached capacity returns 400 Bad Request."""
        # Fill slot to capacity
        self.slot.booked_count = 1
        self.slot.save()

        self.client.force_authenticate(user=self.farmer2)
        response = self.client.post(
            '/api/bookings/',
            {'slot': self.slot.id, 'quantity_kg': 500},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('status'), 'error')
        self.assertIn("no longer available", str(response.data).lower() + str(response.data.get('error', '')).lower())

        self.slot.refresh_from_db()
        self.assertEqual(self.slot.booked_count, 1)

    def test_simultaneous_booking_race_condition_last_slot(self):
        """
        Two simultaneous booking requests for the last remaining slot:
        Exactly one request succeeds and the other gets clean capacity error.
        """
        results = []

        def attempt_booking(farmer_user):
            from django.db import connection
            from rest_framework.test import APIClient
            client = APIClient()
            client.force_authenticate(user=farmer_user)
            try:
                res = client.post(
                    '/api/bookings/',
                    {'slot': self.slot.id, 'quantity_kg': 200},
                    format='json'
                )
                results.append(res.status_code)
            finally:
                connection.close()

        t1 = threading.Thread(target=attempt_booking, args=(self.farmer1,))
        t2 = threading.Thread(target=attempt_booking, args=(self.farmer2,))

        t1.start()
        t2.start()
        t1.join()
        t2.join()

        # One must succeed (201) and one must be rejected (400)
        self.assertEqual(sorted(results), [201, 400])

        self.slot.refresh_from_db()
        self.assertEqual(self.slot.booked_count, 1)
        self.assertEqual(Booking.objects.filter(slot=self.slot).count(), 1)


class MultiTenantPermissionTests(APITestCase):
    """
    Tests covering:
    - Farmer A cannot view or cancel Farmer B's bookings
    - Centre operator cannot view or modify bookings for an unassigned centre
    """

    def setUp(self):
        self.centre_a = ProcurementCentre.objects.create(
            name="Mandi Alpha",
            district="Karnal",
            state="Haryana",
            daily_capacity=100,
        )
        self.centre_b = ProcurementCentre.objects.create(
            name="Mandi Beta",
            district="Ambala",
            state="Haryana",
            daily_capacity=100,
        )

        self.farmer_a = Farmer.objects.create(
            phone_number="9876500010",
            full_name="Farmer Alpha",
        )
        self.farmer_b = Farmer.objects.create(
            phone_number="9876500020",
            full_name="Farmer Beta",
        )

        today = date.today() + timedelta(days=2)
        self.slot_a = Slot.objects.create(
            centre=self.centre_a,
            date=today,
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )
        self.slot_b = Slot.objects.create(
            centre=self.centre_b,
            date=today,
            start_time=time(9, 0),
            end_time=time(10, 0),
            capacity=10,
        )

        self.booking_a = Booking.objects.create(
            farmer=self.farmer_a,
            slot=self.slot_a,
            quantity_kg=300,
            status='booked',
        )
        self.booking_b = Booking.objects.create(
            farmer=self.farmer_b,
            slot=self.slot_b,
            quantity_kg=400,
            status='booked',
        )

        # Operator assigned only to Centre A
        self.operator_user = Farmer.objects.create(
            phone_number="9876500099",
            full_name="Operator Alpha",
            is_staff=True,
        )
        self.operator = CentreOperator.objects.create(
            user=self.operator_user,
            centre=self.centre_a,
            badge_number="OP-A-01",
            is_active=True,
        )

    def test_farmer_cannot_view_or_cancel_other_farmer_bookings(self):
        """Farmer A cannot access or cancel Farmer B's booking."""
        self.client.force_authenticate(user=self.farmer_a)

        # List bookings returns only Farmer A's booking
        res_list = self.client.get('/api/bookings/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        ids = [b['id'] for b in (res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', []))]
        self.assertIn(self.booking_a.id, ids)
        self.assertNotIn(self.booking_b.id, ids)

        # Direct GET of Farmer B's booking returns 404 (scoped queryset)
        res_detail = self.client.get(f'/api/bookings/{self.booking_b.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

        # Cancellation attempt of Farmer B's booking fails
        res_cancel = self.client.post(f'/api/bookings/{self.booking_b.id}/cancel/')
        self.assertIn(res_cancel.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])

    def test_centre_operator_cannot_view_or_modify_other_centre_bookings(self):
        """Centre Operator assigned to Mandi A cannot access or check in Mandi B bookings."""
        self.client.force_authenticate(user=self.operator_user)

        # List bookings shows Mandi A booking, not Mandi B
        res_list = self.client.get('/api/bookings/')
        self.assertEqual(res_list.status_code, status.HTTP_200_OK)
        ids = [b['id'] for b in (res_list.data if isinstance(res_list.data, list) else res_list.data.get('results', []))]
        self.assertIn(self.booking_a.id, ids)
        self.assertNotIn(self.booking_b.id, ids)

        # Cannot retrieve Mandi B booking
        res_detail = self.client.get(f'/api/bookings/{self.booking_b.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_404_NOT_FOUND)

        # Cannot check in Mandi B booking
        res_checkin = self.client.post(f'/api/bookings/{self.booking_b.id}/check-in/')
        self.assertIn(res_checkin.status_code, [status.HTTP_404_NOT_FOUND, status.HTTP_403_FORBIDDEN])


class QueueStatusTransitionTests(APITestCase):
    """
    Tests covering:
    - Valid lifecycle transitions: booked -> checked_in -> completed
    - Invalid transitions: checking in an already-completed booking is rejected
    """

    def setUp(self):
        self.centre = ProcurementCentre.objects.create(
            name="Pehowa Grain Mandi",
            district="Kurukshetra",
            state="Haryana",
            daily_capacity=150,
        )
        self.farmer = Farmer.objects.create(
            phone_number="9876511111",
            full_name="Sukhwinder Singh",
        )
        self.staff_user = Farmer.objects.create(
            phone_number="9876522222",
            full_name="Staff Gatekeeper",
            is_staff=True,
        )
        self.operator = CentreOperator.objects.create(
            user=self.staff_user,
            centre=self.centre,
            badge_number="GATE-01",
            is_active=True,
        )

        today = date.today()
        self.slot = Slot.objects.create(
            centre=self.centre,
            date=today,
            start_time=time(11, 0),
            end_time=time(12, 0),
            capacity=10,
        )
        self.booking = Booking.objects.create(
            farmer=self.farmer,
            slot=self.slot,
            quantity_kg=1200,
            status='booked',
        )

    def test_valid_booking_lifecycle_transitions(self):
        """Status moves correctly: booked -> checked_in -> completed."""
        self.client.force_authenticate(user=self.staff_user)

        # 1. Gate check-in via QR or check-in endpoint
        res_in = self.client.post(f'/api/bookings/{self.booking.id}/check-in/')
        self.assertEqual(res_in.status_code, status.HTTP_200_OK)
        self.booking.refresh_from_db()
        self.assertEqual(self.booking.status, 'checked_in')

        token = QueueToken.objects.filter(booking=self.booking).first()
        self.assertIsNotNone(token)
        self.assertEqual(token.status, 'waiting')

        # 2. Complete token intake via queue endpoint
        res_complete = self.client.post(f'/api/queue/{token.id}/complete/')
        self.assertEqual(res_complete.status_code, status.HTTP_200_OK)

        self.booking.refresh_from_db()
        token.refresh_from_db()
        self.assertEqual(self.booking.status, 'completed')
        self.assertEqual(token.status, 'completed')

    def test_invalid_transition_on_completed_booking_rejected(self):
        """Checking in an already-completed booking is rejected cleanly with 400."""
        self.booking.status = 'completed'
        self.booking.save()

        self.client.force_authenticate(user=self.staff_user)
        res = self.client.post(f'/api/bookings/{self.booking.id}/check-in/')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot check in", str(res.data).lower())

        # Also cannot cancel a completed booking
        res_cancel = self.client.post(f'/api/bookings/{self.booking.id}/cancel/')
        self.assertEqual(res_cancel.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("cannot cancel", str(res_cancel.data).lower())
