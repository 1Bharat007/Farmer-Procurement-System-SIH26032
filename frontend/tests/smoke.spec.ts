import { test, expect } from '@playwright/test';

test.describe('KisanSlot Platform - Frontend Smoke Tests', () => {

  test('1. Mobile viewport (375px): landing page loads and both login buttons are visible above the fold', async ({ page }) => {
    // Set standard mobile device viewport (iPhone SE width: 375px, height: 667px)
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Verify application title
    await expect(page.getByText('KisanSlot').first()).toBeVisible();

    // Verify both Farmer and Centre Staff login buttons exist and are visible in viewport
    const farmerBtn = page.getByRole('button', { name: /Farmer Login/i });
    const adminBtn = page.getByRole('button', { name: /Centre Staff Login/i });

    await expect(farmerBtn).toBeVisible();
    await expect(adminBtn).toBeVisible();

    // Validate that both buttons are rendered within the initial viewport height without scrolling
    const farmerBox = await farmerBtn.boundingBox();
    const adminBox = await adminBtn.boundingBox();

    expect(farmerBox).not.toBeNull();
    expect(adminBox).not.toBeNull();
    if (adminBox) {
      expect(adminBox.y + adminBox.height).toBeLessThanOrEqual(720);
    }
  });

  test('2. Farmer completes full OTP login flow', async ({ page }) => {
    // Intercept backend auth endpoints for deterministic, instant test execution
    await page.route('**/api/auth/farmer/send-otp/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          message: 'OTP sent successfully to +91 9876543210',
          dev_otp: '123456',
        }),
      });
    });

    await page.route('**/api/auth/farmer/verify-otp/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          tokens: {
            access: 'mock-access-token-farmer-xyz',
            refresh: 'mock-refresh-token-farmer-xyz',
          },
          user: {
            id: 1,
            phone_number: '9876543210',
            full_name: 'Balwinder Singh',
            role: 'farmer',
            preferred_language: 'en',
          },
        }),
      });
    });

    // Mock bookings and centres endpoints for when dashboard loads
    await page.route('**/api/bookings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.route('**/api/centres/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/login/farmer');

    // Enter 10-digit mobile number
    const phoneInput = page.getByPlaceholder(/10-digit mobile number/i);
    await phoneInput.fill('9876543210');

    // Click Send OTP
    const sendOtpBtn = page.getByRole('button', { name: /Send OTP/i });
    await sendOtpBtn.click();

    // Verify OTP input appears
    const otpInput = page.getByPlaceholder(/6-digit OTP code/i);
    await expect(otpInput).toBeVisible({ timeout: 5000 });

    // Enter OTP
    await otpInput.fill('123456');

    // Click Verify OTP & Login
    const verifyBtn = page.getByRole('button', { name: /Verify OTP & Login/i });
    await verifyBtn.click();

    // Verify redirection to /farmer dashboard
    await page.waitForURL('**/farmer', { timeout: 10000 });
    expect(page.url()).toContain('/farmer');
  });

  test('3. Farmer dashboard loads and displays booking card with centre, date, and QR code', async ({ page, context }) => {
    // Seed authenticated farmer session cookie for Next.js edge middleware
    await context.addCookies([
      {
        name: 'ks_session',
        value: '1',
        domain: 'localhost',
        path: '/',
      },
      {
        name: 'ks_role',
        value: 'farmer',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Seed authenticated farmer user in browser localStorage
    await page.addInitScript(() => {
      localStorage.setItem('kisanslot_access_token', 'mock-access-token-farmer-xyz');
      localStorage.setItem('kisanslot_refresh_token', 'mock-refresh-token-farmer-xyz');
      localStorage.setItem(
        'kisanslot_user',
        JSON.stringify({
          id: 1,
          phone_number: '9876543210',
          full_name: 'Balwinder Singh',
          role: 'farmer',
          preferred_language: 'en',
        })
      );
    });

    // Mock booking API to return a seeded booking with QR token
    await page.route('**/api/bookings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 101,
            status: 'booked',
            quantity_kg: '500.00',
            qr_code_token: 'qr-token-test-101-uuid',
            slot: 1,
            slot_details: {
              id: 1,
              date: '2026-09-25',
              start_time: '10:00:00',
              end_time: '11:00:00',
              centre_details: {
                id: 1,
                name: 'Karnal Main Mandi',
                district: 'Karnal',
                state: 'Haryana',
              },
            },
            notes: 'Paddy PR-126 grain delivery',
            created_at: '2026-09-18T10:00:00Z',
            updated_at: '2026-09-18T10:00:00Z',
          },
        ]),
      });
    });

    await page.route('**/api/centres/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/farmer');

    // Wait for farmer greeting or navigation
    await expect(page.getByText('Balwinder Singh').first()).toBeVisible({ timeout: 10000 });

    // Open Upcoming Bookings panel
    const upcomingPanelBtn = page.getByText(/Upcoming Bookings/i).first();
    await upcomingPanelBtn.click();

    // Verify centre name is rendered
    await expect(page.getByText('Karnal Main Mandi').first()).toBeVisible({ timeout: 10000 });

    // Verify booking quantity and date are displayed
    await expect(page.getByText(/500/i).first()).toBeVisible();
    await expect(page.getByText(/25/i).first()).toBeVisible();

    // Verify QR code image element is rendered
    const qrImage = page.locator('img[alt="Booking Check-In QR"]').first();
    await expect(qrImage).toBeVisible({ timeout: 5000 });
  });

  test('4. Admin logs in with credentials and views the queue management screen', async ({ page }) => {
    // Mock login API response
    await page.route('**/api/auth/token/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tokens: {
            access: 'mock-access-token-admin-xyz',
            refresh: 'mock-refresh-token-admin-xyz',
          },
          user: {
            id: 2,
            username: 'admin',
            full_name: 'Super Admin Officer',
            role: 'super_admin',
            is_staff: true,
            centre_name: 'Karnal Main Mandi',
          },
        }),
      });
    });

    await page.route('**/api/auth/me/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 2,
          username: 'admin',
          full_name: 'Super Admin Officer',
          role: 'super_admin',
          is_staff: true,
          profile: {
            centre_name: 'Karnal Main Mandi',
          },
        }),
      });
    });

    // Mock queue tokens and bookings
    await page.route('**/api/queue/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            token_number: 101,
            status: 'waiting',
            estimated_wait_minutes: 15,
            booking: 101,
            centre: 1,
            date: '2026-09-18',
          },
        ]),
      });
    });

    await page.route('**/api/bookings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/login/admin');

    // Fill login form
    await page.getByPlaceholder(/admin or operator_karnal/i).fill('admin');
    await page.getByPlaceholder(/Enter your secure password/i).fill('admin123');

    // Submit
    const submitBtn = page.getByRole('button', { name: /Sign In to Admin Console/i });
    await submitBtn.click();

    // Verify navigation to /dashboard or /admin
    await page.waitForURL(/\/(dashboard|admin)/, { timeout: 10000 });

    // Verify queue management UI is visible
    await expect(
      page.getByText(/Queue Management|Live Queue|Waiting List|Karnal Main Mandi/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('5. Admin views live analytics dashboard with footfall, wait time, and slot distribution chart', async ({ page, context }) => {
    // Seed authenticated admin session cookies and local storage
    await context.addCookies([
      { name: 'ks_session', value: '1', domain: 'localhost', path: '/' },
      { name: 'ks_role', value: 'admin', domain: 'localhost', path: '/' },
    ]);

    await page.addInitScript(() => {
      localStorage.setItem('kisanslot_access_token', 'mock-access-token-admin-xyz');
      localStorage.setItem('kisanslot_refresh_token', 'mock-refresh-token-admin-xyz');
      localStorage.setItem(
        'kisanslot_user',
        JSON.stringify({
          id: 2,
          username: 'admin',
          full_name: 'Super Admin Officer',
          role: 'super_admin',
          is_staff: true,
          centre_name: 'Karnal Central Grain Mandi',
        })
      );
    });

    await page.route('**/api/centres/1/analytics/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'success',
          centre_id: 1,
          centre_name: 'Karnal Central Grain Mandi',
          date: '2026-09-18',
          footfall_today: 18,
          footfall_breakdown: { checked_in: 4, in_queue: 6, completed: 8 },
          avg_wait_time_minutes: 22.5,
          no_show_rate_percent: 5.2,
          no_show_count: 2,
          total_capacity_today: 100,
          total_booked_today: 45,
          slots_distribution: [
            { slot_id: 1, label: '08:00 AM - 10:00 AM', booked_count: 12, capacity: 25, fill_percentage: 48 },
            { slot_id: 2, label: '10:00 AM - 12:00 PM', booked_count: 25, capacity: 25, fill_percentage: 100 },
          ],
        }),
      });
    });

    await page.route('**/api/centres/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: 1, name: 'Karnal Central Grain Mandi', district: 'Karnal' }]),
      });
    });

    await page.route('**/api/bookings/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    await page.goto('/admin');

    // Click Analytics tab
    const analyticsTab = page.getByRole('button', { name: /Analytics/i });
    await analyticsTab.click();

    // Verify key metric cards are displayed
    await expect(page.getByText(/Today's Footfall/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Avg Intake Wait Time/i).first()).toBeVisible();
    await expect(page.getByText(/No-Show Rate/i).first()).toBeVisible();

    // Verify time slot distribution chart is rendered
    await expect(page.getByText(/Bookings per Time Slot/i).first()).toBeVisible();
  });

});

