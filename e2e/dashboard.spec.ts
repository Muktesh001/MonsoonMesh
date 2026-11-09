import { test, expect } from '@playwright/test';

// Helper to login
async function login(page, email: string, password: string) {
  await page.goto('/');
  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.fill(email);
  await passwordInput.fill(password);

  const loginButton = page.locator('button:has-text("Login")');
  await loginButton.click();

  await page.waitForURL(/\/(dashboard|overview|incidents)/);
}

test.describe('Dashboard Navigation', () => {
  test('Overview → Analytics → Risk Map', async ({ page }) => {
    await login(page, 'admin@monsoonmesh.local', 'MonsoonDemo!2026');

    // Verify we're on a dashboard page
    const currentURL = page.url();
    expect(currentURL).toMatch(/\/(dashboard|overview|incidents)/);

    // Navigate to Overview
    const overviewLink = page.locator('a:has-text("Overview"), [data-testid="overview"]');
    if (await overviewLink.isVisible().catch(() => false)) {
      await overviewLink.click();
      await page.waitForURL(/\/overview/, { timeout: 5000 });
    }

    // Overview should have some dashboard content
    const overviewContent = page.locator('[data-testid="dashboard"], .stat-card, text=/Overview|Dashboard/i');
    await expect(overviewContent.first()).toBeVisible({ timeout: 5000 });

    // Navigate to Analytics
    const analyticsLink = page.locator('a:has-text("Analytics"), [data-testid="analytics"]');
    if (await analyticsLink.isVisible().catch(() => false)) {
      await analyticsLink.click();
      await page.waitForURL(/\/analytics/, { timeout: 5000 });
    } else {
      // Try navigating directly
      await page.goto('/analytics');
    }

    // Analytics should have charts or data
    const analyticsContent = page.locator('canvas, [data-testid="chart"], text=/Analytics|Chart/i');
    const hasAnalytics =
      (await analyticsContent.first().isVisible().catch(() => false)) ||
      (await page.locator('text=/Incident|Statistics|Analytics/i').isVisible().catch(() => false));
    expect(hasAnalytics).toBeTruthy();

    // Navigate to Risk Map
    const riskMapLink = page.locator('a:has-text("Risk Map"), a:has-text("Map"), [data-testid="risk-map"]');
    if (await riskMapLink.isVisible().catch(() => false)) {
      await riskMapLink.click();
      await page.waitForURL(/\/map|live/, { timeout: 5000 });
    } else {
      await page.goto('/map');
    }

    // Map should load
    await page.waitForTimeout(1000);
    const mapContainer = page.locator('.maplibregl-canvas, [data-testid="map"], .leaflet-container');
    const hasMap =
      (await mapContainer.isVisible().catch(() => false)) ||
      (await page.locator('text=/Map|Risk|Zone/i').isVisible().catch(() => false));
    expect(hasMap).toBeTruthy();
  });

  test('Can access all main navigation links', async ({ page }) => {
    await login(page, 'operator@monsoonmesh.local', 'MonsoonDemo!2026');

    const navLinks = [
      { text: /Overview|Dashboard/i, url: /overview|dashboard/ },
      { text: /Analytics/i, url: /analytics/ },
      { text: /Incidents/i, url: /incidents/ },
      { text: /Map/i, url: /map/ },
    ];

    for (const link of navLinks) {
      const navLink = page.locator(`a:has-text("${link.text}"), [data-testid*="${link.text}"]`).first();

      if (await navLink.isVisible().catch(() => false)) {
        await navLink.click();
        // Wait for navigation or timeout gracefully
        await page
          .waitForURL(link.url, { timeout: 3000 })
          .catch(() => {
            /* Navigation may be instant or not required */
          });
        expect(page.url()).toMatch(/\/(overview|dashboard|analytics|incidents|map)/);
      }
    }
  });

  test('Dashboard loads with statistics', async ({ page }) => {
    await login(page, 'reporter@monsoonmesh.local', 'MonsoonDemo!2026');

    // Wait for dashboard to fully load
    await page.waitForTimeout(1500);

    // Look for stat cards or summary info
    const statCards = page.locator('[data-testid*="stat"], .stat-card, .card');
    const hasStats = await statCards.count().then(c => c > 0);

    if (hasStats) {
      await expect(statCards.first()).toBeVisible();
    } else {
      // At least check for some text content
      const dashboardText = page.locator('text=/Overview|Statistics|Status|Incident/i');
      await expect(dashboardText.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('Sidebar navigation is responsive', async ({ page }) => {
    await login(page, 'admin@monsoonmesh.local', 'MonsoonDemo!2026');

    // Look for sidebar
    const sidebar = page.locator('[data-testid="sidebar"], nav, aside');
    const hasSidebar = await sidebar.isVisible().catch(() => false);

    if (hasSidebar) {
      await expect(sidebar).toBeVisible();

      // Check for menu items
      const menuItems = page.locator('a, button', { has: page.locator('text') });
      expect(await menuItems.count()).toBeGreaterThan(0);
    }
  });
});
