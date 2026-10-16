import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { collectDiagnostics, expectNoIssues } from './diagnostics';

const sidebarRoutes = [
  { key: 'attendance', path: '/attendance' },
  { key: 'leave', path: '/leave' },
  { key: 'tasks', path: '/tasks' },
  { key: 'projects', path: '/projects' },
  { key: 'payroll', path: '/payroll' },
  { key: 'documents', path: '/documents' },
  { key: 'calendar', path: '/calendar' },
  { key: 'events', path: '/events' },
  { key: 'bulletin', path: '/bulletin' },
  { key: 'policies', path: '/policies' },
];

const roleLinks = {
  admin: [...sidebarRoutes, { key: 'employees', path: '/employees' }, { key: 'admin', path: '/admin' }, { key: 'itadmin', path: '/it-admin' }, { key: 'templates', path: '/templates' }, { key: 'settings', path: '/settings' }],
  hr: [...sidebarRoutes, { key: 'employees', path: '/employees' }, { key: 'templates', path: '/templates' }],
  employee: sidebarRoutes,
};

// Ant Design suffixes each menu item's data-menu-id with the nav key, which
// gives an unambiguous, stable handle even when labels overlap (e.g. "Admin"
// vs "IT & Digital Admin").
function menuItem(page, key) {
  return page.locator(`.ant-menu [data-menu-id$="-${key}"]`);
}

test('sidebar navigates by click and marks the active item', async ({ page }) => {
  const diagnostics = collectDiagnostics(page);
  await login(page, 'admin');

  for (const { key, path } of roleLinks.admin) {
    await menuItem(page, key).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(menuItem(page, key)).toHaveClass(/ant-menu-item-selected/);
    diagnostics.currentRoute = path;
    await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
  }

  expectNoIssues(diagnostics, 'sidebar click navigation produced diagnostics');
});

test('hidden sidebar items are not rendered for restricted roles', async ({ page }) => {
  await login(page, 'employee');
  const menu = page.locator('.ant-menu');
  for (const label of ['Employees', 'Admin', 'IT & Digital Admin', 'Templates', 'Settings']) {
    await expect(menu.getByRole('menuitem', { name: new RegExp(label, 'i') })).toHaveCount(0);
  }
});

test('HR sidebar exposes employees and templates but not admin-only modules', async ({ page }) => {
  await login(page, 'hr');
  const menu = page.locator('.ant-menu');
  await expect(menu.getByRole('menuitem', { name: /Employees/i })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: /Templates/i })).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: /Settings/i })).toHaveCount(0);
  await expect(menu.getByRole('menuitem', { name: /IT & Digital Admin/i })).toHaveCount(0);
});

test('browser Back and Forward restore previously visited routes', async ({ page }) => {
  await login(page, 'employee');
  await page.goto('/tasks');
  await expect(page).toHaveURL(/\/tasks$/);
  await page.goto('/policies');
  await expect(page).toHaveURL(/\/policies$/);

  await page.goBack();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });

  await page.goForward();
  await expect(page).toHaveURL(/\/policies$/);
  await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
});

test('session persists across a full page reload', async ({ page }) => {
  await login(page, 'hr');
  await page.goto('/employees');
  await expect(page).toHaveURL(/\/employees$/);

  await page.reload();
  await expect(page).toHaveURL(/\/employees$/);
  await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('.ant-menu')).toBeVisible();
});

test('unauthenticated navigation to protected routes redirects to login', async ({ page }) => {
  for (const path of ['/employees', '/payroll', '/admin', '/settings']) {
    await page.goto(path);
    await expect(page, `direct unauthenticated access to ${path} must not render the app`)
      .toHaveURL(/\/login$/);
    await expect(page.getByLabel('email')).toBeVisible();
  }
});