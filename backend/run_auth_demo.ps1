# KisanSlot Authentication Demo Script (PowerShell / curl)
# Demonstrates:
# 1. Farmer OTP Send & Verify (Login & Registration)
# 2. Centre Operator JWT Login (/api/auth/token/)
# 3. Role verification (/api/auth/me/)

$BaseUrl = "http://localhost:8000"

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " 1. FARMER AUTH FLOW (OTP-BASED)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 1: Send OTP
Write-Host "`n[STEP 1] Requesting OTP for farmer +91-9800000001..." -ForegroundColor Yellow
$sendOtpRes = curl.exe -s -X POST "$BaseUrl/api/auth/farmer/send-otp/" `
  -H "Content-Type: application/json" `
  -d '{"phone_number":"9800000001"}' | ConvertFrom-Json

Write-Host "Status: $($sendOtpRes.status)"
Write-Host "Message: $($sendOtpRes.message)"
$otp = $sendOtpRes.dev_otp
Write-Host "Captured Dev OTP: $otp" -ForegroundColor Green

# Step 2: Verify OTP
Write-Host "`n[STEP 2] Verifying OTP and obtaining JWT tokens..." -ForegroundColor Yellow
$verifyRes = curl.exe -s -X POST "$BaseUrl/api/auth/farmer/verify-otp/" `
  -H "Content-Type: application/json" `
  -d "{`"phone_number`":`"9800000001`",`"otp`":`"$otp`"}" | ConvertFrom-Json

$farmerToken = $verifyRes.access
Write-Host "Farmer Authenticated: $($verifyRes.user.full_name) ($($verifyRes.user.phone_number))" -ForegroundColor Green
Write-Host "Role: $($verifyRes.user.role)"
Write-Host "JWT Access Token: $($farmerToken.Substring(0, 30))..."

# Step 3: Check /api/auth/me/ as Farmer
Write-Host "`n[STEP 3] Calling /api/auth/me/ with Farmer Bearer Token..." -ForegroundColor Yellow
$farmerMeRes = curl.exe -s -X GET "$BaseUrl/api/auth/me/" `
  -H "Authorization: Bearer $farmerToken" | ConvertFrom-Json

Write-Host "Resolved Role: $($farmerMeRes.role)" -ForegroundColor Green
Write-Host "Farmer Profile: $($farmerMeRes.profile.village), $($farmerMeRes.profile.district) | Crop: $($farmerMeRes.profile.crop_type)"


Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host " 2. CENTRE OPERATOR AUTH FLOW (JWT /api/auth/token/)" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# Step 4: Operator Login via /api/auth/token/
Write-Host "`n[STEP 4] Logging in Centre Operator (Harish Chander)..." -ForegroundColor Yellow
$opLoginRes = curl.exe -s -X POST "$BaseUrl/api/auth/token/" `
  -H "Content-Type: application/json" `
  -d '{"username":"9811111111","password":"operator123"}' | ConvertFrom-Json

$operatorToken = $opLoginRes.access
Write-Host "Operator Authenticated: $($opLoginRes.user.full_name)" -ForegroundColor Green
Write-Host "Role: $($opLoginRes.user.role) | Assigned Centre: $($opLoginRes.user.centre_name)"
Write-Host "JWT Access Token: $($operatorToken.Substring(0, 30))..."

# Step 5: Check /api/auth/me/ as Operator
Write-Host "`n[STEP 5] Calling /api/auth/me/ with Operator Bearer Token..." -ForegroundColor Yellow
$opMeRes = curl.exe -s -X GET "$BaseUrl/api/auth/me/" `
  -H "Authorization: Bearer $operatorToken" | ConvertFrom-Json

Write-Host "Resolved Role: $($opMeRes.role)" -ForegroundColor Green
Write-Host "Operator Badge: $($opMeRes.profile.badge_number)"
Write-Host "Mandi Centre: $($opMeRes.profile.centre_name) (District: $($opMeRes.profile.centre_district), Capacity: $($opMeRes.profile.daily_capacity))"

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " ALL FLOWS COMPLETED SUCCESSFULLY!" -ForegroundColor Green
Write-Host "========================================================`n"
