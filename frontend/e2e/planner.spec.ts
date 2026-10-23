import { test, expect } from '@playwright/test';

test('offline mission editing, analysis, profile, invalidation and export', async ({ page, baseURL }) => {
  const errors: string[] = [], failedRequests: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`); });
  // Only loopback requests are permitted throughout the workflow.
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (['127.0.0.1', 'localhost'].includes(url.hostname) || url.protocol === 'blob:') return route.continue();
    failedRequests.push('External dependency: ' + url.href); return route.abort();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Example mission', exact: true }).click();
  await expect(page.getByText('Synthetic ridge study', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Example mission', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Analyze route', exact: true }).click();
  await expect(page.getByText('Prediction complete', { exact: true })).toBeVisible({ timeout: 60000 });
  await page.locator('.route-chart rect').nth(70).click({ force: true });
  await expect(page.getByRole('img', { name: 'Radio path, curved terrain and Fresnel zone' })).toBeVisible();
  await expect(page.locator('.link-card')).toHaveCount(3);
  await page.getByRole('button', { name: 'Keep for comparison' }).click();
  await page.getByLabel('Antenna height above ground').fill('8');
  await page.getByLabel('Antenna height above ground').press('Tab');
  await expect(page.getByText('Ready when you are', { exact: true })).toBeVisible();
  await expect(page.getByText('Dashed white: saved comparison', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Analyze route', exact: true }).click();
  await expect(page.getByText('Prediction complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Export mission', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download mission', exact: true }).click();
  const exported = await downloadPromise;
  expect(exported.suggestedFilename()).toMatch(/\.plan$/);
  await page.screenshot({ path: 'test-results/planner-offline.png', fullPage: true });
  expect(errors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('drawing, undo/redo and unknown hardware', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Example mission', exact: true }).click();
  await expect(page.getByText('Synthetic ridge study', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Example mission', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Draw waypoints on map', exact: true }).click();
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 400, y: 340 } });
  await expect(page.locator('.waypoint-row')).toHaveCount(5);
  await page.getByLabel('Undo', { exact: true }).click();
  await expect(page.locator('.waypoint-row')).toHaveCount(4);
  await page.getByLabel('Redo', { exact: true }).click();
  await expect(page.locator('.waypoint-row')).toHaveCount(5);
  await page.getByRole('button', { name: 'Radios', exact: true }).click();
  const power = page.getByLabel('control915 transmit power', { exact: true });
  await power.fill(''); await power.press('Tab');
  await page.getByRole('button', { name: 'Analyze route', exact: true }).click();
  await expect(page.getByText('Prediction complete', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '915 MHz', exact: true }).click();
  await page.locator('.route-chart rect').nth(10).click({ force: true });
  await expect(page.getByText('Enter transmit power and receiver/usable-video threshold', { exact: true })).toBeVisible();
});

test('switching projects persists the latest edit', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Example mission', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Example mission', exact: true })).toBeEnabled();
  const selector = page.getByLabel('Open project', { exact: true });
  const id = await selector.inputValue();
  await page.getByLabel('Antenna height above ground').fill('17');
  await page.getByLabel('Antenna height above ground').press('Tab');
  await page.getByRole('button', { name: 'New', exact: true }).click();
  await expect(selector).not.toHaveValue(id);
  await selector.selectOption(id);
  await expect(page.getByLabel('Antenna height above ground')).toHaveValue('17');
  await page.reload();
  await expect(page.getByLabel('Antenna height above ground')).toHaveValue('17');
});
