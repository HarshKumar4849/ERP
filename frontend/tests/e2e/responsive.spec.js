import { test, expect } from '@playwright/test';
import { login } from './helpers';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 390, height: 844 },
];

const keyRoutes = [
  '/',
  '/attendance',
  '/leave',
  '/tasks',
  '/projects',
  '/payroll',
  '/documents',
  '/calendar',
  '/events',
  '/bulletin',
  '/policies',
];

test.describe('responsive layouts', () => {
  for (const viewport of viewports) {
    test(`${viewport.name} (${viewport.width}x${viewport.height}) renders key modules without horizontal overflow`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await login(page, 'hr');

      for (const route of keyRoutes) {
        await page.goto(route);
        await expect(page.locator('#root'), `${route} did not render at ${viewport.name}`).toBeVisible({ timeout: 15_000 });

        // Allow tables to scroll inside their own container, but the page itself
        // must not push content sideways.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${route} overflows horizontally at ${viewport.name} by ${overflow}px`).toBeLessThanOrEqual(25);
      }
    });
  }

  test('mobile uses the drawer sidebar and dialogs stay inside the viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page, 'employee');

    await page.locator('.mobile-sidebar-btn').click();
    const drawer = page.locator('.ant-drawer-content');
    await expect(drawer).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();

    await page.goto('/leave');
    await page.getByRole('button', { name: /apply for leave/i }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const box = await dialog.boundingBox();
    expect(box.width, 'dialog is wider than the mobile viewport').toBeLessThanOrEqual(520);
    expect(box.x, 'dialog starts outside the viewport').toBeGreaterThanOrEqual(0);
  });

  test('form input survives a viewport change mid-form', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await login(page, 'employee');
    await page.goto('/leave');
    await page.getByRole('button', { name: /apply for leave/i }).first().click();

    const reason = page.getByRole('dialog').getByPlaceholder(/reporting manager|justification|context/i).first();
    await reason.fill('survives viewport change');

    await page.setViewportSize({ width: 768, height: 1024 });
    await expect(reason).toHaveValue('survives viewport change');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(reason).toHaveValue('survives viewport change');
  });
});