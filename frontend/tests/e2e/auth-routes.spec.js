import { test, expect } from '@playwright/test';
import { login } from './helpers';
import { collectDiagnostics, expectNoIssues } from './diagnostics';

// Deterministic non-deliverable identifiers. Password reset is asserted on
// validation/rejection behaviour only; no real user receives any message.
const UNKNOWN_USER_ID = '000000000000000000000001';
const INVALID_RESET_TOKEN = 'qa-invalid-reset-token';

test.describe('auth routes', () => {
  test('unknown route while signed out redirects to login instead of a dead-end 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('email')).toBeVisible();
  });

  test('unknown route while signed in shows the in-app not-found page', async ({ page }) => {
    await login(page, 'employee');
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText(/404|does not exist/i).first()).toBeVisible();
  });

  test('register renders its form and rejects invalid email input', async ({ page }) => {
    const diagnostics = collectDiagnostics(page);
    diagnostics.currentRoute = '/register';
    await page.goto('/register');

    const email = page.getByLabel(/email/i).first();
    await expect(email).toBeVisible();

    await page.getByRole('button', { name: /register|create|sign up/i }).first().click();
    // Required-field validation must block submission.
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);

    expectNoIssues(diagnostics, 'register page produced diagnostics');
  });

  test('forget password validates the email field before submitting', async ({ page }) => {
    const diagnostics = collectDiagnostics(page);
    diagnostics.currentRoute = '/forgetpassword';
    await page.goto('/forgetpassword');

    await page.getByRole('button', { name: /request new password/i }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
    await expect(page).toHaveURL(/\/forgetpassword$/);

    // Malformed email is rejected inline by Ant Design's email rule.
    const email = page.getByLabel(/email/i).first();
    await email.fill('not-an-email');
    await page.getByRole('button', { name: /request new password/i }).click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();

    expectNoIssues(diagnostics, 'forget password page produced diagnostics');
  });

  test('reset password rejects an invalid reset token without granting access', async ({ page }) => {
    const diagnostics = collectDiagnostics(page);
    diagnostics.currentRoute = '/resetpassword';
    await page.goto(`/resetpassword/${UNKNOWN_USER_ID}/${INVALID_RESET_TOKEN}`);

    await expect(page.locator('#root')).toBeVisible({ timeout: 15_000 });
    // An invalid token must never result in an authenticated session.
    const auth = await page.evaluate(() => localStorage.getItem('auth'));
    expect(auth, 'invalid reset token must not create a session').toBeNull();
    await expect(page).toHaveURL(/\/resetpassword\//);

    expectNoIssues(diagnostics, 'reset password page produced diagnostics');
  });

  test('reset form blocks weak or mismatched passwords and logs in with the updated password', async ({ page }) => {
    const userId = '000000000000000000000002';
    const resetToken = 'a'.repeat(64);
    let resetBody;
    let loginBody;
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url.includes('/api/resetpassword')) {
        resetBody = route.request().postDataJSON();
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, result: null }) });
      } else if (url.includes('/api/login')) {
        loginBody = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, result: { _id: userId, email: 'qa@example.com', role: 'ADMIN', token: 'qa-session-token' } }),
        });
      } else {
        await route.continue();
      }
    });

    await page.goto(`/resetpassword/${userId}/${resetToken}`);
    const password = page.getByLabel('New password', { exact: true });
    const confirmation = page.getByLabel('Confirm new password', { exact: true });
    const submit = page.getByRole('button', { name: /update password/i });

    await password.fill('weak');
    await confirmation.fill('weak');
    await submit.click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
    expect(resetBody).toBeUndefined();

    const newPassword = 'QA-browser-new-password-2026!';
    await password.fill(newPassword);
    await confirmation.fill('different-password-2026!');
    await submit.click();
    await expect(page.locator('.ant-form-item-explain-error').first()).toBeVisible();
    expect(resetBody).toBeUndefined();

    await confirmation.fill(newPassword);
    await submit.click();
    await expect(page).toHaveURL(/\/login$/);
    expect(resetBody).toEqual({ userId, resetToken, password: newPassword });
    expect(await page.evaluate(() => localStorage.getItem('auth'))).toBeNull();

    await page.getByLabel(/email/i).fill('qa@example.com');
    await page.getByLabel(/password/i).fill(newPassword);
    const loginResponsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /log in/i }).click();
    expect(loginBody, 'login should send the new password to the auth endpoint').toMatchObject({ email: 'qa@example.com', password: newPassword });
    const loginResponse = await loginResponsePromise;
    expect(loginResponse.status()).toBe(200);
    expect((await loginResponse.json()).success).toBe(true);
  });

  test('login page links to register and forgot-password flows', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: /register/i }).click();
    await expect(page).toHaveURL(/\/register$/);
    await page.goto('/login');
    await page.getByRole('link', { name: /forgot/i }).click();
    await expect(page).toHaveURL(/\/forgetpassword$/);
  });
});

test.describe('recognition redirect for all roles', () => {
  for (const role of ['admin', 'hr', 'employee']) {
    test(`${role} is redirected to the Shoutout recognition dashboard`, async ({ page }) => {
      await login(page, role);
      await page.goto('/recognition');
      await page.waitForURL(/shoutout-three\.vercel\.app\/dashboard/, { timeout: 20_000 });
      expect(page.url()).toContain('https://shoutout-three.vercel.app/dashboard');
    });
  }
});
