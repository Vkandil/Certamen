import { expect, test } from '@playwright/test';

test('onboards with intercepted OpenRouter calls', async ({ page }) => {
  await page.addInitScript(() => {
    indexedDB.deleteDatabase('certamen');
  });
  await page.route('https://openrouter.ai/api/v1/credits', async (route) => {
    const auth = route.request().headers().authorization ?? '';
    if (auth.includes('bad')) {
      await route.fulfill({ status: 401, body: JSON.stringify({ error: { message: 'invalid' } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { total_credits: 1, total_usage: 0.1 } }) });
  });
  await page.route('https://openrouter.ai/api/v1/models', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 'test/model-a',
            name: 'Model A',
            context_length: 16000,
            pricing: { prompt: '0.000001', completion: '0.000002' },
            supported_parameters: ['temperature', 'max_tokens'],
            architecture: { input_modalities: ['text'], output_modalities: ['text'] },
            top_provider: { max_completion_tokens: 2048 }
          }
        ]
      })
    });
  });

  await page.goto('/');
  await page.getByLabel('OpenRouter API key').fill('bad');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByText('Invalid or revoked key.')).toBeVisible();
  await page.getByLabel('OpenRouter API key').fill('good');
  await page.getByRole('button', { name: 'Validate' }).click();
  await expect(page.getByLabel('Question')).toBeVisible();
});
