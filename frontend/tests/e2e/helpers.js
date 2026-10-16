import { expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

export function fixtureCredentials(role) {
  const runId = (process.env.QA_RUN_ID || 'browser-audit-2026').toLowerCase();
  return {
    email: `qa-${role.toLowerCase()}-${runId}@example.com`,
    password: process.env.QA_FIXTURE_PASSWORD || 'TecMotiv-QA-Only-2026!',
  };
}

export async function login(page, role) {
  const credentials = fixtureCredentials(role);
  await page.context().clearCookies();
  await page.goto('/login');
  await page.evaluate(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {}
  });
  await page.goto('/login');
  const emailInput = page.locator('#normal_login_email');
  await emailInput.waitFor({ state: 'visible', timeout: 15_000 });
  await emailInput.fill(credentials.email);
  const passwordInput = page.locator('#normal_login_password');
  await passwordInput.waitFor({ state: 'visible', timeout: 15_000 });
  await passwordInput.fill(credentials.password);
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15_000 });
  return credentials;
}

export async function saveScreenshot(page, name) {
  mkdirSync('test-results/screenshots', { recursive: true });
  await page.screenshot({
    path: `test-results/screenshots/${name}.png`,
    fullPage: true,
  });
}
