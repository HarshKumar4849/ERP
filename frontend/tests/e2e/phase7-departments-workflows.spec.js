import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { collectDiagnostics, expectNoIssues } from './diagnostics';

const departments = [
  { roleKey: 'employee', dept: 'Engineering', name: 'QA Employee A' },
  { roleKey: 'employeeB', dept: 'Marketing', name: 'QA Employee B' },
  { roleKey: 'employeeSales', dept: 'Sales', name: 'QA Employee Sales' },
  { roleKey: 'employeeFinance', dept: 'Finance', name: 'QA Employee Finance' },
  { roleKey: 'employeeManagement', dept: 'Management', name: 'QA Employee Mgmt' },
  { roleKey: 'employeeIT', dept: 'IT', name: 'QA Employee IT' },
];

test.describe('Phase 7: Department Role-Based Access Audit', () => {
  for (const { roleKey, dept, name } of departments) {
    test(`department ${dept} receives standard EMPLOYEE role with no elevated privilege`, async ({ page }) => {
      const diagnostics = collectDiagnostics(page);
      await login(page, roleKey);

      // Verify header tags show the user's department and strictly EMPLOYEE role
      const deptTag = page.locator('.ant-layout-header .ant-tag').filter({ hasText: dept });
      await expect(deptTag).toBeVisible({ timeout: 15_000 });

      const roleTag = page.locator('.ant-layout-header .ant-tag').filter({ hasText: 'EMPLOYEE' });
      await expect(roleTag).toBeVisible();

      // Ensure privileged roles are NOT assigned
      const adminTag = page.locator('.ant-layout-header .ant-tag').filter({ hasText: 'ADMIN' });
      await expect(adminTag).toHaveCount(0);
      const hrTag = page.locator('.ant-layout-header .ant-tag').filter({ hasText: /^HR$/ });
      await expect(hrTag).toHaveCount(0);

      // Ensure restricted sidebar menu items are not present
      const menu = page.locator('.ant-menu');
      for (const restricted of ['Employees', 'Admin', 'IT & Digital Admin', 'Templates', 'Settings']) {
        await expect(menu.getByRole('menuitem', { name: new RegExp(`^${restricted}$`, 'i') })).toHaveCount(0);
      }

      // Directly navigating to privileged routes results in Access Denied
      for (const forbiddenRoute of ['/admin', '/it-admin', '/settings']) {
        await page.goto(forbiddenRoute);
        await expect(page.getByText(/access denied/i)).toBeVisible({ timeout: 15_000 });
      }

      expectNoIssues(diagnostics, `department ${dept} login and navigation`);
    });
  }

  test('ADMIN and HR receive their designated privileges', async ({ page }) => {
    // Admin login
    await login(page, 'admin');
    await expect(page.locator('.ant-layout-header .ant-tag').filter({ hasText: 'ADMIN' })).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByText(/access denied/i)).toHaveCount(0);
    await expect(page.locator('#root')).toBeVisible();

    // HR login
    await login(page, 'hr');
    await expect(page.locator('.ant-layout-header .ant-tag').filter({ hasText: /^HR$/ })).toBeVisible();
    await page.goto('/employees');
    await expect(page.getByText(/access denied/i)).toHaveCount(0);
    await expect(page.locator('#root')).toBeVisible();
    await page.goto('/admin');
    await expect(page.getByText(/access denied/i)).toBeVisible();
  });
});

test.describe('Phase 7: End-to-End Business Workflow UI Audit', () => {
  test('leave submission by employee and review queue visibility for HR/ADMIN', async ({ page }) => {
    // 1. Employee submits leave
    await login(page, 'employee');
    await page.goto('/leave');
    await expect(page.getByRole('tab', { name: /Leave Applications/i })).toBeVisible();

    // Approvals queue tab MUST NOT be present for employee
    await expect(page.getByRole('tab', { name: /Approvals Queue/i })).toHaveCount(0);

    // Open Apply modal
    const applyBtn = page.getByRole('button', { name: /apply for leave/i }).first();
    await applyBtn.click();
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();

    page.on('response', async (res) => {
      if (res.url().includes('leave/apply')) {
        console.log('LEAVE APPLY STATUS:', res.status());
        console.log('LEAVE APPLY BODY:', await res.text().catch(() => ''));
      }
    });

    // Fill reason
    const reasonInput = modal.locator('textarea#reason');
    await reasonInput.waitFor({ state: 'visible' });
    await reasonInput.fill('Phase 7 Playwright e2e leave application');

    // Submit
    const submitBtn = modal.getByRole('button', { name: /submit application/i });
    await submitBtn.click();

    // Modal should close or show success
    await expect(modal).toBeHidden({ timeout: 15_000 });

    // 2. HR logs in and verifies Approvals Queue
    await login(page, 'hr');
    await page.goto('/leave');
    const queueTab = page.getByRole('tab', { name: /Approvals Queue/i });
    await expect(queueTab).toBeVisible();
    await queueTab.click();
    await expect(page.locator('.ant-tabs-tabpane-active').first()).toBeVisible();
  });

  test('private document vault isolation across employees', async ({ page }) => {
    // Employee A visits documents
    await login(page, 'employee');
    await page.goto('/documents');
    await expect(page.getByText(/My Document Vault/i)).toBeVisible();
    // Dropdown to select other employees must NOT exist
    await expect(page.getByRole('combobox', { name: /Select employee/i })).toHaveCount(0);

    // Employee B visits documents
    await login(page, 'employeeB');
    await page.goto('/documents');
    await expect(page.getByText(/My Document Vault/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Select employee/i })).toHaveCount(0);

    // HR visits documents and sees Enterprise Document Vault with selection control
    await login(page, 'hr');
    await page.goto('/documents');
    await expect(page.getByText(/Enterprise Document Vault/i)).toBeVisible();
    await expect(page.getByRole('combobox', { name: /Select employee/i })).toBeVisible();
  });

  test('payroll privacy prevents employee access to other salaries or management actions', async ({ page }) => {
    // Employee visits payroll
    await login(page, 'employee');
    await page.goto('/payroll');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByText(/MY COMPENSATION & SALARY SLIPS/i)).toBeVisible();

    // Privileged action buttons must NOT be present for employee
    await expect(page.getByRole('button', { name: /Process Salary/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Global Audit Trail/i })).toHaveCount(0);

    // HR visits payroll and has administrative controls
    await login(page, 'hr');
    await page.goto('/payroll');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByText(/TECMOTIV PAYROLL & SALARY MANAGEMENT/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Process Salary/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Global Audit Trail/i })).toBeVisible();
  });
});
