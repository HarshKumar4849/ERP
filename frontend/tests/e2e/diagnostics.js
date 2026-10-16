import { expect } from '@playwright/test';

/**
 * Attaches runtime diagnostics to a page.
 * Callers assert on `issues` themselves so nothing is silently suppressed.
 */
export function collectDiagnostics(page) {
  const state = { issues: [], currentRoute: 'login' };

  page.on('pageerror', (error) => {
    state.issues.push({ route: state.currentRoute, kind: 'pageerror', text: error.message });
  });
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    state.issues.push({ route: state.currentRoute, kind: 'console', text: message.text() });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    state.issues.push({
      route: state.currentRoute,
      kind: 'http',
      text: `${response.status()} ${response.url()}`,
    });
  });
  page.on('requestfailed', (request) => {
    const failure = request.failure();
    // Aborted navigations are a normal Playwright artifact, not an app defect.
    if (failure?.errorText === 'net::ERR_ABORTED') return;
    state.issues.push({
      route: state.currentRoute,
      kind: 'requestfailed',
      text: `${request.url()} ${failure?.errorText || 'unknown'}`,
    });
  });

  return state;
}

export function expectNoIssues(diagnostics, message = 'unexpected runtime diagnostics') {
  const rendered = diagnostics.issues
    .map((issue) => `[${issue.kind}] route=${issue.route} ${issue.text}`)
    .join('\n');
  expect(diagnostics.issues, `${message}\n${rendered}`).toEqual([]);
}