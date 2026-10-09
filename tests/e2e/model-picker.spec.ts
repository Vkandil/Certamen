import { expect, test, type Page } from '@playwright/test';

const DAY = 24 * 60 * 60;
const now = Math.floor(Date.now() / 1000);

function model(id: string, name: string, daysAgo: number, pricePerM: number, extra: Record<string, unknown> = {}) {
  const perToken = String(pricePerM / 2 / 1e6);
  return {
    id,
    name,
    created: now - daysAgo * DAY,
    context_length: 200000,
    pricing: { prompt: perToken, completion: perToken },
    supported_parameters: ['temperature', 'max_tokens'],
    architecture: { input_modalities: ['text'], output_modalities: ['text'] },
    top_provider: { max_completion_tokens: 8000 },
    ...extra
  };
}

const catalog = [
  model('anthropic/claude-opus-5', 'Anthropic: Claude Opus 5', 220, 90),
  model('anthropic/claude-opus-5.5', 'Anthropic: Claude Opus 5.5', 6, 90),
  model('anthropic/claude-haiku-5', 'Anthropic: Claude Haiku 5', 60, 5),
  model('openai/gpt-6.1', 'OpenAI: GPT-6.1', 12, 40),
  model('openai/gpt-6.1-mini', 'OpenAI: GPT-6.1 mini', 12, 2),
  model('google/gemini-3.6-pro', 'Google: Gemini 3.6 Pro', 30, 25),
  model('google/gemini-3.6-flash', 'Google: Gemini 3.6 Flash', 30, 3),
  model('x-ai/grok-5', 'xAI: Grok 5', 20, 30),
  model('deepseek/deepseek-v4', 'DeepSeek: V4', 3, 3, { hugging_face_id: 'deepseek-ai/DeepSeek-V4' }),
  model('meta-llama/llama-5-405b', 'Meta: Llama 5 405B', 90, 4, { hugging_face_id: 'meta-llama/Llama-5-405B' })
];

async function mockOpenRouter(page: Page) {
  await page.addInitScript(() => {
    // wipe local data once per test, not on reloads (the reload checks persistence)
    if (!sessionStorage.getItem('certamen-e2e-wiped')) {
      sessionStorage.setItem('certamen-e2e-wiped', '1');
      indexedDB.deleteDatabase('certamen');
    }
  });
  await page.route('https://openrouter.ai/api/v1/credits', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { total_credits: 10, total_usage: 1 } }) }));
  await page.route('https://openrouter.ai/api/v1/models', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: catalog }) }));
}

test('prefills the newest flagship of each lab and lets you switch presets', async ({ page }) => {
  await mockOpenRouter(page);
  await page.goto('/');
  await page.getByLabel('OpenRouter API key').fill('good');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByLabel('Question')).toBeVisible();

  // first visit: the roster is already filled with one flagship per lab
  const roster = page.locator('section', { has: page.getByText('ORDO') });
  await expect(roster.getByText('Anthropic: Claude Opus 5.5')).toBeVisible();
  await expect(roster.getByText('OpenAI: GPT-6.1', { exact: true })).toBeVisible();
  await expect(roster.getByText('Newest flagship from Anthropic', { exact: false })).toBeVisible();
  await expect(roster.getByText('NEW').first()).toBeVisible();
  await expect(roster.getByText('Anthropic: Claude Opus 5', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: '★ Best right now' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Question').fill('What should I charge for my SaaS?');
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
