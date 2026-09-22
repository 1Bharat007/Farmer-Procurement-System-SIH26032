# KisanSlot — 5-Minute Live Presentation Demo Script
**Smart India Hackathon 2026 • Problem Statement 26032**  
*Automated Farmer Crop Procurement & Live Mandi Queue Management Platform*

---

## ⚡ Quick Start: Clean Demo Reset

Before beginning your practice run or taking the stage for jury evaluation, reset the database to a known-good demo state with one command:

```bash
# In the repository root (PowerShell / Terminal):
.\backend\venv\Scripts\python.exe backend/manage.py demo_reset

# If running inside Docker:
docker compose exec backend python manage.py demo_reset
```

> **What this does**: Wipes all transactional clutter (test bookings, queue tokens, payment logs) and restores 25 realistic farmers, 3 Mandis, 14 operating days of slots, and active test accounts.

---

## 🔑 Demo Accounts & Credentials

| Role | Username / Mobile | Password / OTP | Notes |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin` (or `9999999999`) | `admin123` | Full multi-mandi access & global analytics |
| **Karnal Mandi Operator** | `9811111111` | `operator123` | Gate check-in & weighbridge queue manager |
| **Ludhiana Mandi Operator** | `9822222222` | `operator123` | Punjab Mandi hub operator |
| **Demo Farmer (Haryana)** | `9800000001` | `123456` | Ramesh Kumar (Taraori, Karnal) • Hindi |
| **Demo Farmer (Punjab)** | `9800000002` | `123456` | Balwinder Singh (Jagraon) • Gurmukhi Punjabi |
| **New Farmer (Live Sign-up)** | Any 10-digit mobile (e.g. `9876500001`) | `123456` | Tests instant inline Aadhaar registration |

---

## ⏱️ 5-Minute Live Walkthrough Script

### Act 1: The Farmer Mobile Experience (0:00 - 1:00)
**Goal**: Demonstrate mobile-first simplicity, zero password friction, and trilingual accessibility.

1. **Open Landing Page**: Navigate to `http://localhost:3000` (or your staging domain) on a mobile browser or mobile screen width.
2. **Show Language Switcher**:
   * Click **English** $\rightarrow$ **हिंदी** $\rightarrow$ **ਪੰਜਾਬੀ** in the top navigation toggle.
   * Highlight how the entire interface, government headers, and instructions render natively in Gurmukhi script.
   * Switch back to **English** (or preferred presentation language).
3. **Log in as Farmer**:
   * Click the primary blue button: **"Farmer Login"**.
   * Enter mobile number: `9800000001`.
   * Click **"Send OTP"**.
   * Note the banner: *"OTP sent to +91 9800000001"*.
   * Enter 6-digit OTP: `123456`.
   * Click **"Verify OTP & Login"**.
4. **Result**: You are instantly logged into the Farmer Portal with zero password fatigue.

---

### Act 2: Booking a Delivery Slot & QR Generation (1:00 - 2:00)
**Goal**: Show how farmers eliminate Mandi congestion by reserving guaranteed intake windows.

1. **Start Booking**:
   * On the dashboard, click the first card: **"Book Delivery Slot"**.
2. **Step 1 — Mandi Selection**:
   * Click on **"Karnal Central MSP Grain Mandi"** (shows daily capacity & average processing time).
   * Click **"Next: Select Date"**.
3. **Step 2 — Date Selection**:
   * Select **Today's date** (or tomorrow's date).
   * Click **"Next: Pick Time Slot"**.
4. **Step 3 — Time Window & Quantity**:
   * Choose an available 2-hour window: e.g., **"10:00 AM - 12:00 PM"** (displays available spots).
   * Enter Crop Quantity: `2500` kg (Wheat MSP intake).
   * Click **"Confirm Booking"**.
5. **Step 4 — Confirmation & QR Code**:
   * Delivery slot confirmed!
   * Highlight the **client-side QR code** rendered on screen with the booking token.
   * Mention: *"The farmer receives an immediate confirmation SMS via Fast2SMS with their slot details and token number."*
   * Click **"View in Upcoming Bookings"** to show the booking card saved under the farmer's account.

---

### Act 3: Mandi Gate Operator & Fast QR Check-In (2:00 - 2:45)
**Goal**: Demonstrate sub-second gate check-in preventing Mandi traffic bottlenecks.

1. **Open Admin Console**:
   * In a separate window or tab, go to `http://localhost:3000/login/admin`.
   * Sign in with:
     * Username: `9811111111`
     * Password: `operator123`
   * Click **"Sign In to Admin Console"**.
2. **Perform QR Check-In**:
   * Click the **"Gate Check-In"** tab.
   * Copy the QR code token from the farmer's booking (or click the quick Check-In action on the pending bookings table).
   * Paste the token into the QR Check-In field and click **"Verify & Gate Check-In"**.
3. **Result**:
   * Green confirmation banner appears: *"Farmer Ramesh Kumar checked in successfully!"*
   * Token Number (e.g. `Token #12`) is automatically assigned.

---

### Act 4: Live Queue & Real-Time Broadcast (2:45 - 3:45)
**Goal**: Highlight the real-time WebSocket channel layer keeping farmers and staff synchronized.

1. **Open the Live Queue Tab**:
   * In Admin Console, click **"Live Queue"**.
   * Point to the top-right status badge: **"Live: Connected"** (green indicator).
   * Point out the farmer who just checked in appearing in the **Waiting List** with their Token number, crop quantity, and estimated wait minutes.
2. **Process Intake**:
   * Locate the checked-in farmer in the queue table.
   * Click **"Call to Weighbridge"** (moves status to `in_queue`).
   * Click **"Mark Completed"** when weighment is finished.
3. **Result**:
   * Direct Benefit Transfer (DBT) payment record is automatically generated at official MSP rate (`₹22.75/kg` = `₹56,875.00`).
   * The queue list updates dynamically across all open browser windows without page reload.

---

### Act 5: Real-Time Mandi Analytics Dashboard (3:45 - 5:00)
**Goal**: Prove transparency, data-driven governance, and automated throughput monitoring for ministry officials.

1. **Navigate to Analytics**:
   * In Admin Console, click the **"Analytics"** tab.
2. **Present 4 Real-Time Metrics**:
   * **Today's Footfall Count**: Points to the exact count of farmers who passed the gate today (with live breakdown of checked-in vs completed).
   * **Average Intake Wait Time**: Shows real duration from gate entry to completion (e.g. `18.5 min`, beating the 30-minute target).
   * **No-Show Rate**: Automatically computed percentage of missed delivery slots so procurement officers can reallocate capacity.
   * **Today's Slot Fill Rate**: Shows total capacity utilized for the day.
3. **Show Time-Slot Distribution Bar Chart**:
   * Highlight the **Bookings per Time Slot** chart.
   * Point out the **10:00 AM - 12:00 PM** bar showing live bookings vs capacity.
   * Show how the bar color and badge dynamically reflect capacity state (`Open` $\rightarrow$ `Active` $\rightarrow$ `Full`).
4. **Multi-Mandi Switching**:
   * Use the **Mandi dropdown** at the top right of the Analytics bar to toggle between **Karnal Mandi**, **Ludhiana Hub**, and **Indore Terminal**.
   * Note how all metrics, footfall counts, and slot distributions recalculate immediately for each procurement centre.

---

## 🚨 Emergency Cheat Sheet

If an error or network drop occurs during rehearsal or live evaluation:

1. **Reset State**: Run `python backend/manage.py demo_reset` in your terminal. It takes 2 seconds and restores every account and booking.
2. **Fast Login Bypass**: Master OTP is `123456` for any farmer number.
3. **Offline Mode**: If internet drops, all frontend pages gracefully fall back to local cached storage, and WebSocket auto-reconnects with exponential backoff.
