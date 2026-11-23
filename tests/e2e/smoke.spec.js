// @ts-check
import { test, expect } from '@playwright/test';

// E2E lane ground rules (AGENTS.md CRITICAL CORE RULES):
// - These specs are READ-ONLY by design. Never create/edit/clear any campaign
//   state here; if a test must enter a campaign, it enters test-campaign only.
// - The campaign-selection screen is the app's first gate, so the smoke tests
//   assert boot health without selecting anything.

const API_PORT = process.env.PORT || 80;

test('app boots to the campaign-selection screen', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('CharSheets');

  // The selection gate lists the repo-tracked campaigns; test-campaign always
  // exists and proves the folder-list API round-tripped through the proxy.
  await expect(
    page.locator('.campaign-button', { hasText: 'test-campaign' })
  ).toBeVisible();
});

test('Express API answers /health through the app port', async ({ request }) => {
  const response = await request.get(`http://localhost:${API_PORT}/health`, {
    timeout: 10_000,
  });
  expect(response.ok()).toBeTruthy();
});
