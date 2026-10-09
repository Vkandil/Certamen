import { expect, test } from '@playwright/test';
import { mockOpenRouter, signIn } from './helpers';

test('prefills the newest flagship of each lab and lets you switch presets', async ({ page }) => {
  await mockOpenRouter(page);
  await signIn(page);

  // first visit: the roster is already filled with one flagship per lab
  const roster = page.locator('section', { has: page.getByText('ORDO') });
  await expect(roster.getByText('Anthropic: Claude Opus 5.5')).toBeVisible();
  await expect(roster.getByText('OpenAI: GPT-6.1', { exact: true })).toBeVisible();
  await expect(roster.getByText('Newest flagship from Anthropic', { exact: false })).toBeVisible();
  await expect(roster.getByText('NEW').first()).toBeVisible();
  await expect(roster.getByText('Anthropic: Claude Opus 5', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '★ Best right now' })).toHaveAttribute('aria-pressed', 'true');

  // context is folded away until asked for
  await expect(page.getByLabel('Optional context')).toHaveCount(0);
  await page.getByRole('button', { name: /Add context/ }).click();
  await page.getByLabel('Optional context').fill('Bootstrapped, 40 customers.');

  await page.getByLabel('Question').fill('What should I charge for my SaaS?');
  // frontier lineups cost more than the default $0.50 cap: one click raises it
  const budget = page.getByLabel('Budget cap USD');
  await expect(page.getByText('The estimate is above your budget', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: /Raise to \$/ }).click();
  await expect(page.getByText('The estimate is above your budget', { exact: false })).toHaveCount(0);
  expect(Number(await budget.inputValue())).toBeGreaterThan(0.5);
  await expect(page.getByRole('button', { name: /Start certamen · ≈ \$/ })).toBeEnabled();

  await page.getByRole('button', { name: 'Fast & cheap' }).click();
  await expect(roster.getByText('OpenAI: GPT-6.1 mini')).toBeVisible();
  await page.getByRole('button', { name: 'Open weights' }).click();
  await expect(roster.getByText('DeepSeek: V4')).toBeVisible();

  // the roster is remembered across visits
  await expect(page.getByRole('button', { name: 'Open weights' })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(roster.getByText('DeepSeek: V4')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open weights' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'test-results/model-picker.png', fullPage: true });
});
