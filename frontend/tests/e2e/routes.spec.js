import { test, expect } from '@playwright/test';
import { login } from './helpers';

const commonRoutes = ['/', '/attendance', '/leave', '/tasks', '/projects', '/payroll', '/documents', '/calendar', '/events', '/bulletin', '/policies', '/profile', '/about'];
const roleRoutes = {
  admin: [...commonRoutes, '/employees', '/admin', '/it-admin', '/templates', '/settings'],
  hr: [...commonRoutes, '/employees', '/templates'],
  employee: commonRoutes,
};

for (const [role, routes] of Object.entries(roleRoutes)) {
  test(`${role} route smoke and runtime diagnostics`, async ({ page }) => {
    const errors = [];
    let currentRoute = 'login';
    page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (!text.includes('deprecated') && !text.includes('Warning:')) {
          errors.push(`console: ${text}`);
        }
      }
    });
    page.on('response', (response) => {
      if (response.status() >= 400) errors.push(`route ${currentRoute} http ${response.status()}: ${response.url()}`);
    });
    await login(page, role);
    for (const route of routes) {
      currentRoute = route;
      await page.goto(route);
      await expect(page.locator('#root'), `route ${route} did not render`).toBeVisible({ timeout: 15_000 });
      await expect(page).not.toHaveTitle(/internal server error/i);
    }
    expect(errors, errors.join('\n')).toEqual([]);
  });
}

test('HR and EMPLOYEE receive frontend access-denied pages for privileged routes', async ({ page }) => {
  for (const role of ['hr', 'employee']) {
    await login(page, role);
    for (const route of ['/admin', '/it-admin', '/settings']) {
      await page.goto(route);
      await expect(page.getByText(/access denied/i)).toBeVisible();
    }
  }
});

test('login form validates malformed and empty input without navigation', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('email').fill('not-an-email');
  await page.getByLabel('password').fill('x');
  await page.getByRole('button', { name: /log in/i }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('responsive navigation renders at mobile width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page, 'employee');
  await expect(page.locator('.mobile-sidebar-btn')).toBeVisible();
  await page.locator('.mobile-sidebar-btn').click();
  await expect(page.getByRole('menu')).toBeVisible();
});
