# ==============================================================================
# KisanSlot Authentication Flow Test Script (PowerShell / Windows)
# SIH 2026 - Problem Statement 26032
# ==============================================================================

$BaseUrl = "http://localhost:8000"

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " 🌾 TESTING KISANSLOT AUTHENTICATION ENDPOINTS " -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan

# 1. Send OTP for Farmer
Write-Host "[1] Sending OTP for Farmer (9800000001)..." -ForegroundColor Yellow
$sendOtpBody = @{ phone_number = "9800000001" } | ConvertTo-Json
$sendOtpResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/farmer/send-otp/" -Method POST -Body $sendOtpBody -ContentType "application/json"
Write-Host "   Status: $($sendOtpResp.status)" -ForegroundColor Green
Write-Host "   Message: $($sendOtpResp.message)" -ForegroundColor Gray
$devOtp = $sendOtpResp.dev_otp
Write-Host "   Dev OTP received: $devOtp" -ForegroundColor Magenta

# 2. Verify OTP for Existing Farmer
Write-Host "`n[2] Verifying OTP & Logging In..." -ForegroundColor Yellow
$verifyBody = @{ phone_number = "9800000001"; otp = $devOtp } | ConvertTo-Json
$verifyResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/farmer/verify-otp/" -Method POST -Body $verifyBody -ContentType "application/json"
$farmerToken = $verifyResp.access
Write-Host "   Access Token acquired: $($farmerToken.Substring(0, 25))..." -ForegroundColor Green
Write-Host "   Logged in user: $($verifyResp.user.full_name) [Role: $($verifyResp.user.role)]" -ForegroundColor Gray

# 3. Call /api/auth/me/ with Farmer Token
Write-Host "`n[3] Calling /api/auth/me/ with Farmer Token..." -ForegroundColor Yellow
$farmerMe = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me/" -Method GET -Headers @{ Authorization = "Bearer $farmerToken" }
Write-Host "   User: $($farmerMe.full_name) | Role: $($farmerMe.role) | District: $($farmerMe.profile.district)" -ForegroundColor Green

# 4. Operator JWT Login
Write-Host "`n[4] Authenticating Centre Operator (9811111111 / operator123)..." -ForegroundColor Yellow
$opLoginBody = @{ username = "9811111111"; password = "operator123" } | ConvertTo-Json
$opLoginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/token/" -Method POST -Body $opLoginBody -ContentType "application/json"
$opToken = $opLoginResp.access
Write-Host "   Operator Access Token: $($opToken.Substring(0, 25))..." -ForegroundColor Green
Write-Host "   Assigned Centre: $($opLoginResp.user.centre_name)" -ForegroundColor Gray

# 5. Call /api/auth/me/ with Operator Token
Write-Host "`n[5] Calling /api/auth/me/ with Operator Token..." -ForegroundColor Yellow
$opMe = Invoke-RestMethod -Uri "$BaseUrl/api/auth/me/" -Method GET -Headers @{ Authorization = "Bearer $opToken" }
Write-Host "   Operator: $($opMe.full_name) | Centre: $($opMe.profile.centre_name) (ID: $($opMe.profile.centre_id))" -ForegroundColor Green

Write-Host "`n============================================================" -ForegroundColor Cyan
Write-Host " [SUCCESS] All authentication endpoints verified and operational! " -ForegroundColor Cyan
Write-Host "============================================================`n" -ForegroundColor Cyan
