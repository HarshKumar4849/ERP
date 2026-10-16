import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { collectDiagnostics } from './diagnostics';

const modulesWithTabs = ['/attendance', '/leave', '/tasks', '/calendar', '/events', '/bulletin', '/projects', '/payroll', '/documents', '/admin', '/it-admin', '/templates', '/employees', '/policies'];

const roles = ['admin', 'hr', 'employee'];

// Regression guard for a class of defects already found twice in this codebase:
// components referencing an identifier that is never declared (isManagementOrHr,
// isHrOrMgmt). The symptom is a React unmount, so assert #root stays populated
// after activating every tab.
for (const role of roles) {
  test(`${role}: every module tab renders without a runtime crash`, async ({ page }) => {
    // This sweep visits every module and activates every tab, so it needs a
    // longer budget than the per-test default.
    test.setTimeout(300_000);
    const diagnostics = collectDiagnostics(page);
    const crashes = [];
    await login(page, role);

    for (const route of modulesWithTabs) {
      diagnostics.currentRoute = route;
      await page.goto(route);
      await expect(page.locator('#root'), `route ${route} did not render for ${role}`).toBeVisible({ timeout: 15_000 });

      const tabs = page.getByRole('tab');
      const count = await tabs.count();
      for (let index = 0; index < count; index += 1) {
        const tab = page.getByRole('tab').nth(index);
        const name = (await tab.innerText().catch(() => `tab-${index}`)).trim();
        const before = diagnostics.issues.length;
        await tab.click().catch(() => {});
        await expect(page.locator('#root'), `route ${route} tab "${name}" unmounted the app for ${role}`)
          .toBeVisible({ timeout: 15_000 });
        const newIssues = diagnostics.issues.slice(before).filter((issue) => issue.kind === 'pageerror');
        if (newIssues.length) crashes.push(`${route} [${name}] :: ${newIssues.map((i) => i.text).join(' | ')}`);
      }
    }

    expect(crashes, `uncaught runtime errors while activating tabs:\n${crashes.join('\n')}`).toEqual([]);
  });
}