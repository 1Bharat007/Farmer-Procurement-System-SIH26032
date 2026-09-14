import os
import django
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from rest_framework.test import APIClient
from accounts.models import Farmer, CentreOperator, OTPRecord

def test_auth_flows():
    client = APIClient()
    OTPRecord.objects.filter(phone__in=['9800000001', '9870000099', '9875555555']).delete()
    print("\n========================================================")
    print("STARTING AUTHENTICATION SUITE TESTS")
    print("========================================================\n")

    # ----------------------------------------------------
    # TEST 1: Send OTP for Existing Farmer
    # ----------------------------------------------------
    print("[TEST 1] Testing POST /api/auth/farmer/send-otp/ for existing farmer (9800000001)...")
    res1 = client.post('/api/auth/farmer/send-otp/', {'phone_number': '9800000001'}, format='json')
    assert res1.status_code == 200, f"send-otp failed: {res1.data}"
    otp_1 = res1.data['dev_otp']
    print(f" -> Response: {res1.data['message']}")
    print(f" -> OTP generated: {otp_1}, expires_in: {res1.data['expires_in_minutes']} minutes\n")

    # ----------------------------------------------------
    # TEST 2: Verify Wrong OTP
    # ----------------------------------------------------
    print("[TEST 2] Testing POST /api/auth/farmer/verify-otp/ with WRONG OTP...")
    res2 = client.post('/api/auth/farmer/verify-otp/', {'phone_number': '9800000001', 'otp': '000000'}, format='json')
    assert res2.status_code == 400, f"Expected 400 for wrong OTP, got {res2.status_code}"
    print(f" -> Response: {res2.data['detail']}\n")

    # ----------------------------------------------------
    # TEST 3: Verify Expired OTP
    # ----------------------------------------------------
    print("[TEST 3] Testing POST /api/auth/farmer/verify-otp/ with EXPIRED OTP (> 5 minutes)...")
    expired_record = OTPRecord.objects.create(
        phone="9800000001",
        otp_code="888888",
        created_at=timezone.now() - timedelta(minutes=6)
    )
    # Force created_at in the past
    OTPRecord.objects.filter(id=expired_record.id).update(created_at=timezone.now() - timedelta(minutes=6))

    res3 = client.post('/api/auth/farmer/verify-otp/', {'phone_number': '9800000001', 'otp': '888888'}, format='json')
    assert res3.status_code == 400, f"Expected 400 for expired OTP, got {res3.status_code}"
    print(f" -> Response: {res3.data['detail']}\n")

    # ----------------------------------------------------
    # TEST 4: Verify Valid OTP for Existing Farmer (Login)
    # ----------------------------------------------------
    print("[TEST 4] Testing POST /api/auth/farmer/verify-otp/ with VALID OTP for existing farmer...")
    res4 = client.post('/api/auth/farmer/verify-otp/', {'phone_number': '9800000001', 'otp': otp_1}, format='json')
    assert res4.status_code == 200, f"Expected 200, got {res4.status_code}: {res4.data}"
    assert 'access' in res4.data and 'refresh' in res4.data
    farmer_token = res4.data['access']
    print(f" -> Logged in existing farmer: {res4.data['user']['full_name']}")
    print(f" -> JWT Access Token: {farmer_token[:25]}...\n")

    # ----------------------------------------------------
    # TEST 5: Verify Valid OTP for Brand New Farmer (Registration)
    # ----------------------------------------------------
    print("[TEST 5] Testing POST /api/auth/farmer/send-otp/ & verify-otp/ for NEW farmer registration...")
    new_phone = "9870000099"
    Farmer.objects.filter(phone_number=new_phone).delete()
    OTPRecord.objects.filter(phone=new_phone).delete()

    res_new_otp = client.post('/api/auth/farmer/send-otp/', {'phone_number': new_phone}, format='json')
    new_otp = res_new_otp.data['dev_otp']

    res5 = client.post('/api/auth/farmer/verify-otp/', {
        'phone_number': new_phone,
        'otp': new_otp,
        'full_name': 'Santosh Patel',
        'village': 'Sihor',
        'district': 'Bhopal',
        'state': 'Madhya Pradesh',
        'preferred_language': 'hi',
        'crop_type': 'Soybean'
    }, format='json')
    assert res5.status_code in [200, 201], f"Registration failed: {res5.data}"
    print(f" -> New farmer registered: {res5.data['user']['full_name']} from {res5.data['user']['village']}")
    print(f" -> is_new_registration: {res5.data['is_new_registration']}\n")

    # ----------------------------------------------------
    # TEST 6: Rate Limiting (Max 3 OTP requests in 10 minutes)
    # ----------------------------------------------------
    print("[TEST 6] Testing Rate Limiting: 4th OTP request within 10 mins...")
    test_rate_phone = "9875555555"
    OTPRecord.objects.filter(phone=test_rate_phone).delete()
    for i in range(3):
        r = client.post('/api/auth/farmer/send-otp/', {'phone_number': test_rate_phone}, format='json')
        assert r.status_code == 200, f"Request {i+1} failed"

    res_rate_limit = client.post('/api/auth/farmer/send-otp/', {'phone_number': test_rate_phone}, format='json')
    assert res_rate_limit.status_code == 429, f"Expected 429 Too Many Requests, got {res_rate_limit.status_code}"
    print(f" -> Status 429 correctly returned: {res_rate_limit.data['detail']}\n")

    # ----------------------------------------------------
    # TEST 7: Admin / Operator JWT Login (/api/auth/token/)
    # ----------------------------------------------------
    print("[TEST 7] Testing POST /api/auth/token/ for CentreOperator (Harish Chander @ Karnal)...")
    res7 = client.post('/api/auth/token/', {
        'username': '9811111111',
        'password': 'operator123'
    }, format='json')
    assert res7.status_code == 200, f"CentreOperator login failed: {res7.data}"
    operator_token = res7.data['access']
    print(f" -> Operator authenticated: {res7.data['user']['full_name']}")
    print(f" -> Role: {res7.data['user']['role']}, Centre: {res7.data['user']['centre_name']}\n")

    # ----------------------------------------------------
    # TEST 8: Superuser JWT Login (/api/auth/token/)
    # ----------------------------------------------------
    print("[TEST 8] Testing POST /api/auth/token/ for System Admin...")
    res8 = client.post('/api/auth/token/', {
        'username': 'admin',
        'password': 'admin123'
    }, format='json')
    assert res8.status_code == 200, f"Admin login failed: {res8.data}"
    admin_token = res8.data['access']
    print(f" -> Admin authenticated: {res8.data['user']['full_name']}, Role: {res8.data['user']['role']}\n")

    # ----------------------------------------------------
    # TEST 9: GET /api/auth/me/ with Operator Token
    # ----------------------------------------------------
    print("[TEST 9] Testing GET /api/auth/me/ with Operator Token...")
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {operator_token}')
    res9 = client.get('/api/auth/me/')
    assert res9.status_code == 200, f"Operator /api/auth/me/ failed: {res9.data}"
    assert res9.data['role'] == 'centre_operator', f"Expected role centre_operator, got {res9.data['role']}"
    print(f" -> User: {res9.data['full_name']}")
    print(f" -> Role: {res9.data['role']}")
    print(f" -> Centre assigned: {res9.data['profile']['centre_name']} ({res9.data['profile']['badge_number']})\n")

    # ----------------------------------------------------
    # TEST 10: GET /api/auth/me/ with Farmer Token
    # ----------------------------------------------------
    print("[TEST 10] Testing GET /api/auth/me/ with Farmer Token...")
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {farmer_token}')
    res10 = client.get('/api/auth/me/')
    assert res10.status_code == 200, f"Farmer /api/auth/me/ failed: {res10.data}"
    assert res10.data['role'] == 'farmer', f"Expected role farmer, got {res10.data['role']}"
    print(f" -> User: {res10.data['full_name']}")
    print(f" -> Role: {res10.data['role']}")
    print(f" -> Farmer village/crop: {res10.data['profile']['village']}, {res10.data['profile']['crop_type']}\n")

    # ----------------------------------------------------
    # TEST 11: GET /api/auth/me/ with Admin Token
    # ----------------------------------------------------
    print("[TEST 11] Testing GET /api/auth/me/ with Admin Token...")
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {admin_token}')
    res11 = client.get('/api/auth/me/')
    assert res11.status_code == 200, f"Admin /api/auth/me/ failed: {res11.data}"
    assert res11.data['role'] == 'admin', f"Expected role admin, got {res11.data['role']}"
    print(f" -> User: {res11.data['full_name']}")
    print(f" -> Role: {res11.data['role']}\n")

    print("========================================================")
    print("ALL 11 AUTHENTICATION & ROLE TESTS PASSED PERFECTLY!")
    print("========================================================\n")

if __name__ == '__main__':
    test_auth_flows()
