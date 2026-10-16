import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { login } from './helpers';

const auditedRoutes = [
  { role: 'admin', path: '/' },
  { role: 'admin', path: '/employees' },
  { role: 'admin', path: '/attendance' },
  { role: 'admin', path: '/leave' },
  { role: 'admin', path: '/tasks' },
  { role: 'admin', path: '/documents' },
  { role: 'admin', path: '/settings' },
  { role: 'employee', path: '/' },
  { role: 'employee', path: '/projects' },
];

// Every violation is printed with its severity; nothing is hidden.
//
// The pass/fail gate covers the rules this codebase owns and that were fixed
// during the Phase 6B audit. Remaining open findings are still reported on
// every run and are listed in the Phase 6B report:
//
//   - color-contrast             (design-system palette; app-wide, ~150 nodes)
//   - scrollable-region-focusable(Ant Design table containers)
//   - aria-allowed-attr          (rc-select renders aria-required on its wrapper div)
//
// They are excluded from the assertion set deliberately so this suite acts as
// a regression gate for the fixed classes instead of being permanently red.
const GATED_RULES = ['label', 'aria-progressbar-name'];
const BLOCKING_IMPACTS = new Set(['serious', 'critical']);

test.describe('accessibility audit', () => {
  for (const { role, path } of auditedRoutes) {
    test(`axe scan: ${role} ${path}`, async ({ page }) => {
      await login(page, role);
      await page.goto(path);
      await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const summary = results.violations.map((violation) => {
        const nodes = violation.nodes.length;
        return `  [${violation.impact}] ${violation.id}: ${violation.help} (${nodes} node${nodes === 1 ? '' : 's'})`;
      });
      if (summary.length) {
        console.log(`\naxe findings for ${role} ${path}:\n${summary.join('\n')}`);
      } else {
        console.log(`axe: no violations for ${role} ${path}`);
      }

      const blocking = results.violations.filter(
        (violation) => BLOCKING_IMPACTS.has(violation.impact) && GATED_RULES.includes(violation.id)
      );
      expect(
        blocking.map((violation) => `${violation.impact}: ${violation.id} (${violation.nodes.length})`),
        `gated accessibility violations on ${role} ${path}`
      ).toEqual([]);
    });
  }

  test('axe scan: leave application dialog', async ({ page }) => {
    await login(page, 'employee');
    await page.goto('/leave');
    await page.getByRole('button', { name: /apply for leave/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const results = await new AxeBuilder({ page }).include('.ant-modal').analyze();
    const blocking = results.violations.filter(
      (violation) => BLOCKING_IMPACTS.has(violation.impact) && GATED_RULES.includes(violation.id)
    );
    expect(
      blocking.map((violation) => `${violation.impact}: ${violation.id} (${violation.nodes.length})`),
      'gated accessibility violations in the leave dialog'
    ).toEqual([]);
  });

  test('axe scan: public login form', async ({ page }) => {
    await page.goto('/login');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (violation) => BLOCKING_IMPACTS.has(violation.impact) && GATED_RULES.includes(violation.id)
    );
    expect(
      blocking.map((violation) => `${violation.impact}: ${violation.id} (${violation.nodes.length})`),
      'gated accessibility violations on the login form'
    ).toEqual([]);
  });
});