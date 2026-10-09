import { expect, test } from '@playwright/test';
import { mockOpenRouter, signIn } from './helpers';

test('runs a certamen with 3, 5 or 6 debaters', async ({ page }) => {
  await mockOpenRouter(page, { answerDelayMs: 1500 });
  await signIn(page);
  const roster = page.locator('section', { has: page.getByText('ORDO') });
  const sizes = page.getByRole('group', { name: 'Debaters' });

  // default: 4, one lab each
  await expect(sizes.getByRole('button', { name: '4' })).toHaveAttribute('aria-pressed', 'true');

  await sizes.getByRole('button', { name: '3' }).click();
  await expect(roster.getByText('Contendentes · 3/8')).toBeVisible();
  await expect(page.getByRole('button', { name: '★ Best right now' })).toHaveAttribute('aria-pressed', 'true');

  await sizes.getByRole('button', { name: '5' }).click();
  await expect(roster.getByText('Contendentes · 5/8')).toBeVisible();
  await expect(page.getByRole('button', { name: '★ Best right now' })).toHaveAttribute('aria-pressed', 'true');
  await expect(roster.getByText('Newest flagship from DeepSeek', { exact: false })).toBeVisible();

  // presets follow the chosen size
  await page.getByRole('button', { name: 'Fast & cheap' }).click();
  await expect(roster.getByText('Contendentes · 5/8')).toBeVisible();
  await page.getByRole('button', { name: '★ Best right now' }).click();

  // one more debater from a new lab, then back to five
  await roster.getByRole('button', { name: /Add a debater/ }).click();
  await expect(roster.getByText('Contendentes · 6/8')).toBeVisible();
  await expect(sizes.getByRole('button', { name: '6' })).toHaveAttribute('aria-pressed', 'true');
  await sizes.getByRole('button', { name: '5' }).click();
  await expect(roster.getByText('Contendentes · 5/8')).toBeVisible();
  await page.locator('section', { has: page.getByText('CONTENTIO') }).screenshot({ path: 'test-results/team-5.png' });

  await page.getByLabel('Question').fill('What should I charge for my SaaS?');
  await page.getByRole('button', { name: /Start certamen/ }).click();
  // five answer cards, labelled A to E
  await expect(page.locator('article')).toHaveCount(5);
  await page.screenshot({ path: 'test-results/run-5.png', fullPage: true });
  await expect(page.getByText('Charge $29/month, one plan, raise after 10 customers.')).toBeVisible({ timeout: 20_000 });
  await page.screenshot({ path: 'test-results/verdict-5.png', fullPage: true });
});
