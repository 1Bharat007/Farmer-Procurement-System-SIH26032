import { test, expect } from '@playwright/test';

const mobileViewports = [
  { name: 'iPhone SE (375px)', width: 375, height: 667 },
  { name: 'iPhone 14 / 15 (390px)', width: 390, height: 844 },
  { name: 'Samsung Galaxy / Pixel (412px)', width: 412, height: 915 },
];

for (const vp of mobileViewports) {
  test.describe(`Mobile Browser Audit: ${vp.name}`, () => {

    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
    });

    test('1. Landing page: No horizontal overflow & tap targets >= 40px', async ({ page }) => {
      await page.goto('/');

      // Check no horizontal scroll / overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Verify tap target dimensions on primary action buttons
      const farmerBtn = page.getByRole('button', { name: /Farmer Login/i });
      const adminBtn = page.getByRole('button', { name: /Centre Staff Login/i });

      const farmerBox = await farmerBtn.boundingBox();
      const adminBox = await adminBtn.boundingBox();

      expect(farmerBox?.height).toBeGreaterThanOrEqual(40);
      expect(adminBox?.height).toBeGreaterThanOrEqual(40);
    });

    test('2. Farmer Login: Clean input layout without horizontal scroll', async ({ page }) => {
      await page.goto('/login/farmer');

      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      const phoneInput = page.getByPlaceholder(/10-digit mobile number/i);
      const phoneBox = await phoneInput.boundingBox();
      expect(phoneBox?.height).toBeGreaterThanOrEqual(36);
    });

    test('3. Farmer Dashboard with QR code: QR centered and within screen bounds', async ({ page, context }) => {
      await context.addCookies([
        { name: 'ks_session', value: '1', domain: 'localhost', path: '/' },
        { name: 'ks_role', value: 'farmer', domain: 'localhost', path: '/' },
      ]);

      await page.addInitScript(() => {
        localStorage.setItem('kisanslot_access_token', 'mock-access-token-xyz');
        localStorage.setItem(
          'kisanslot_user',
          JSON.stringify({
            id: 1,
            phone_number: '9800000001',
            full_name: 'Ramesh Kumar',
            role: 'farmer',
            preferred_language: 'en',
          })
        );
      });

      await page.route('**/api/bookings/**', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([
            {
              id: 101,
              status: 'booked',
              quantity_kg: '2500.00',
              qr_code_token: 'mock-qr-token-uuid-1234',
              slot: 1,
              slot_details: {
                id: 1,
                date: '2026-09-25',
                start_time: '10:00:00',
                end_time: '12:00:00',
                centre_details: {
                  id: 1,
                  name: 'Karnal Central Grain Mandi',
                  district: 'Karnal',
                  state: 'Haryana',
                },
              },
            },
          ]),
        });
      });

      await page.route('**/api/centres/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.goto('/farmer');

      // Click Upcoming Bookings
      const upcomingBtn = page.getByText(/Upcoming Bookings/i).first();
      await upcomingBtn.click();

      // Check no horizontal overflow
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Verify QR Code image is visible and fits inside screen
      const qrImg = page.locator('img[alt="Booking Check-In QR"]').first();
      await expect(qrImg).toBeVisible({ timeout: 5000 });
      const qrBox = await qrImg.boundingBox();
      expect(qrBox?.width).toBeLessThanOrEqual(vp.width);
    });

    test('4. Admin Analytics Dashboard: Responsive cards and chart fit mobile screen', async ({ page, context }) => {
      await context.addCookies([
        { name: 'ks_session', value: '1', domain: 'localhost', path: '/' },
        { name: 'ks_role', value: 'admin', domain: 'localhost', path: '/' },
      ]);

      await page.addInitScript(() => {
        localStorage.setItem('kisanslot_access_token', 'mock-admin-token-xyz');
        localStorage.setItem(
          'kisanslot_user',
          JSON.stringify({
            id: 2,
            username: 'admin',
            full_name: 'Admin Officer',
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
            footfall_today: 14,
            footfall_breakdown: { checked_in: 2, in_queue: 4, completed: 8 },
            avg_wait_time_minutes: 18.5,
            no_show_rate_percent: 7.1,
            no_show_count: 1,
            total_capacity_today: 50,
            total_booked_today: 32,
            slots_distribution: [
              { slot_id: 1, label: '08:00 AM - 10:00 AM', booked_count: 10, capacity: 12, fill_percentage: 83.3 },
              { slot_id: 2, label: '10:00 AM - 12:00 PM', booked_count: 12, capacity: 12, fill_percentage: 100 },
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
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      });

      await page.goto('/admin');

      // Click Analytics tab
      const analyticsTab = page.getByRole('button', { name: /Analytics/i });
      await analyticsTab.click();

      // Verify no horizontal overflow in analytics view on mobile
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      expect(hasHorizontalOverflow).toBe(false);

      // Verify footfall and wait time cards render cleanly
      await expect(page.getByText(/Today's Footfall/i).first()).toBeVisible({ timeout: 10000 });
      await expect(page.getByText(/Avg Intake Wait Time/i).first()).toBeVisible();
    });

  });
}
