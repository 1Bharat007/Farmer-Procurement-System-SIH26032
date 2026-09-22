"""
Critical-path tests for Farmer OTP Authentication flow.
Smart India Hackathon 2026 - Problem Statement 26032
"""

from datetime import timedelta
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import Farmer, OTPRecord


class FarmerOTPFlowTests(APITestCase):
    """
    Tests covering critical paths for Farmer OTP flow:
    1. send OTP succeeds (200 OK, creates OTP record)
    2. verify with correct OTP logs in existing farmer
    3. verify with correct OTP registers a new farmer
    4. verify with wrong OTP fails cleanly (400 Bad Request)
    5. verify with expired OTP fails cleanly (400 Bad Request)
    """

    def setUp(self):
        self.existing_phone = "9876543210"
        self.new_phone = "9876543299"

        # Create existing farmer
        self.farmer = Farmer.objects.create(
            phone_number=self.existing_phone,
            full_name="Ramesh Kumar",
            village="Taraori",
            district="Karnal",
            state="Haryana",
            preferred_language="hi",
            crop_type="Wheat",
        )

    def test_send_otp_succeeds(self):
        """Test POST /api/auth/farmer/send-otp/ returns 200 and dispatches OTP."""
        response = self.client.post(
            '/api/auth/farmer/send-otp/',
            {'phone_number': self.existing_phone},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data.get('status'), 'success')
        self.assertTrue(response.data.get('is_registered'))
        self.assertIn('dev_otp', response.data)

        # Verify record exists in DB
        record = OTPRecord.objects.filter(phone=self.existing_phone).latest('created_at')
        self.assertEqual(len(record.otp_code), 6)
        self.assertFalse(record.is_verified)

    def test_verify_with_correct_otp_logs_in_existing_farmer(self):
        """Test POST /api/auth/farmer/verify-otp/ logs in existing farmer with tokens."""
        otp_code = "456789"
        OTPRecord.objects.create(phone=self.existing_phone, otp_code=otp_code)

        response = self.client.post(
            '/api/auth/farmer/verify-otp/',
            {'phone_number': self.existing_phone, 'otp': otp_code},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)
        self.assertFalse(response.data.get('is_new_registration'))
        self.assertEqual(response.data.get('user', {}).get('phone_number'), self.existing_phone)

        # Verify OTP record is marked as verified
        record = OTPRecord.objects.filter(phone=self.existing_phone, otp_code=otp_code).first()
        self.assertTrue(record.is_verified)

    def test_verify_with_correct_otp_registers_new_farmer(self):
        """Test POST /api/auth/farmer/verify-otp/ auto-creates new farmer profile."""
        otp_code = "789123"
        OTPRecord.objects.create(phone=self.new_phone, otp_code=otp_code)

        self.assertFalse(Farmer.objects.filter(phone_number=self.new_phone).exists())

        response = self.client.post(
            '/api/auth/farmer/verify-otp/',
            {
                'phone_number': self.new_phone,
                'otp': otp_code,
                'full_name': 'Kuldeep Singh',
                'village': 'Samana',
                'district': 'Patiala',
                'state': 'Punjab',
                'preferred_language': 'pa',
                'crop_type': 'Paddy',
            },
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)
        self.assertTrue(response.data.get('is_new_registration'))

        # Verify new farmer was created in DB
        new_farmer = Farmer.objects.filter(phone_number=self.new_phone).first()
        self.assertIsNotNone(new_farmer)
        self.assertEqual(new_farmer.full_name, 'Kuldeep Singh')
        self.assertEqual(new_farmer.preferred_language, 'pa')

    def test_verify_with_wrong_otp_fails_cleanly(self):
        """Test POST /api/auth/farmer/verify-otp/ with incorrect OTP returns 400."""
        otp_code = "112233"
        OTPRecord.objects.create(phone=self.existing_phone, otp_code=otp_code)

        response = self.client.post(
            '/api/auth/farmer/verify-otp/',
            {'phone_number': self.existing_phone, 'otp': '999999'},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('status'), 'error')
        self.assertIn('Invalid OTP', str(response.data))

    def test_verify_with_expired_otp_fails_cleanly(self):
        """Test POST /api/auth/farmer/verify-otp/ with expired OTP (>5 min) returns 400."""
        otp_code = "445566"
        expired_record = OTPRecord.objects.create(
            phone=self.existing_phone,
            otp_code=otp_code,
        )
        # Manually backdate created_at to 6 minutes ago
        six_minutes_ago = timezone.now() - timedelta(minutes=6)
        OTPRecord.objects.filter(id=expired_record.id).update(created_at=six_minutes_ago)

        response = self.client.post(
            '/api/auth/farmer/verify-otp/',
            {'phone_number': self.existing_phone, 'otp': otp_code},
            format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data.get('status'), 'error')
        self.assertIn('expired', str(response.data).lower())
