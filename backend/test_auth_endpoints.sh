#!/usr/bin/env bash
# ==============================================================================
# KisanSlot Authentication Flow Test Script (cURL / Bash)
# SIH 2026 - Problem Statement 26032
# ==============================================================================

BASE_URL="http://localhost:8000"

echo -e "\n============================================================"
echo -e " 🌾 TESTING KISANSLOT AUTHENTICATION ENDPOINTS (cURL) "
echo -e "============================================================\n"

# 1. Send OTP
echo "[1] Requesting OTP for Farmer 9800000001..."
OTP_RESP=$(curl -s -X POST "$BASE_URL/api/auth/farmer/send-otp/" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "9800000001"}')
echo "   Response: $OTP_RESP"
DEV_OTP=$(echo "$OTP_RESP" | grep -o '"dev_otp":"[0-9]*"' | cut -d'"' -f4)
if [ -z "$DEV_OTP" ]; then
  DEV_OTP="123456"
fi
echo "   Using OTP: $DEV_OTP"

# 2. Verify OTP
echo -e "\n[2] Verifying OTP and obtaining JWT tokens..."
VERIFY_RESP=$(curl -s -X POST "$BASE_URL/api/auth/farmer/verify-otp/" \
  -H "Content-Type: application/json" \
  -d "{\"phone_number\": \"9800000001\", \"otp\": \"$DEV_OTP\"}")
FARMER_TOKEN=$(echo "$VERIFY_RESP" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
echo "   Farmer Access Token: ${FARMER_TOKEN:0:30}..."

# 3. GET /api/auth/me/
echo -e "\n[3] Calling /api/auth/me/ with Farmer Bearer Token..."
curl -s -X GET "$BASE_URL/api/auth/me/" \
  -H "Authorization: Bearer $FARMER_TOKEN"
echo ""

# 4. Operator Login
echo -e "\n[4] Logging in Centre Operator (9811111111 / operator123)..."
OP_RESP=$(curl -s -X POST "$BASE_URL/api/auth/token/" \
  -H "Content-Type: application/json" \
  -d '{"username": "9811111111", "password": "operator123"}')
OP_TOKEN=$(echo "$OP_RESP" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)
echo "   Operator Access Token: ${OP_TOKEN:0:30}..."

# 5. GET /api/auth/me/ with Operator Token
echo -e "\n[5] Calling /api/auth/me/ with Operator Bearer Token..."
curl -s -X GET "$BASE_URL/api/auth/me/" \
  -H "Authorization: Bearer $OP_TOKEN"
echo -e "\n\n[SUCCESS] Authentication cURL tests completed!\n"
