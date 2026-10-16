import { test, expect } from '@playwright/test';
import { login, saveScreenshot } from './helpers';

test('ADMIN can log in and load the dashboard', async ({ page }) => {
  await login(page, 'admin');
  await expect(page.getByText('Dashboard', { exact: true }).first()).toBeVisible();
  await saveScreenshot(page, 'admin-dashboard');
});

test('HR can log in and open employee access', async ({ page }) => {
  await login(page, 'hr');
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/employees$/);
});

test('EMPLOYEE can log in and is denied the admin route', async ({ page }) => {
  await login(page, 'employee');
  await page.goto('/admin');
  await expect(page.getByText(/access denied/i)).toBeVisible();
});

test('Recognition uses the configured external redirect', async ({ page }) => {
  await login(page, 'employee');
  await page.goto('/recognition');
  await expect(page).toHaveURL(/shoutout-three\.vercel\.app\/dashboard/);
});
