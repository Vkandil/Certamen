import type { Page } from '@playwright/test';

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

/** A small catalog with recent and older releases from several labs. */
export const catalog = [
  model('anthropic/claude-opus-5', 'Anthropic: Claude Opus 5', 220, 90),
  model('anthropic/claude-opus-5.5', 'Anthropic: Claude Opus 5.5', 6, 90),
  model('anthropic/claude-haiku-5', 'Anthropic: Claude Haiku 5', 60, 5),
  model('openai/gpt-6.1', 'OpenAI: GPT-6.1', 12, 40),
  model('openai/gpt-6.1-mini', 'OpenAI: GPT-6.1 mini', 12, 2),
  model('google/gemini-3.6-pro', 'Google: Gemini 3.6 Pro', 30, 25),
  model('google/gemini-3.6-flash', 'Google: Gemini 3.6 Flash', 30, 3),
  model('x-ai/grok-5', 'xAI: Grok 5', 20, 30),
  model('deepseek/deepseek-v4', 'DeepSeek: V4', 3, 3, { hugging_face_id: 'deepseek-ai/DeepSeek-V4' }),
  model('moonshotai/kimi-k3', 'MoonshotAI: Kimi K3', 40, 6),
  model('qwen/qwen4-max', 'Qwen: Qwen4 Max', 70, 8),
  model('meta-llama/llama-5-405b', 'Meta: Llama 5 405B', 90, 4, { hugging_face_id: 'meta-llama/Llama-5-405B' })
];

function sse(text: string): string {
  return [
    `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`,
    `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 900, completion_tokens: 600, cost: 0.004 } })}`,
    'data: [DONE]',
    ''
  ].join('\n\n');
}

const ANSWER = '## Answer\nStart around $29/month with a single plan, then raise prices once ten customers have paid without pushback. Price on the value you create, not on your costs, and keep a yearly option. ';
const VERDICT = [
  '## Consensus',
  '- One simple plan beats a pricing grid at launch.',
  '## Dissensus',
  '- A: $29/month; B: usage-based; C: $49/month',
  '## Synthese',
  'Launch at $29/month with one plan and revisit after the first ten customers.',
  '## Recommandation',
  'Charge $29/month, one plan, raise after 10 customers.',
  '## A verifier',
  '- Churn after the first price increase'
].join('\n');

/** Wipes local data once per test (not on reloads) and fakes OpenRouter. */
export async function mockOpenRouter(page: Page, options: { answerDelayMs?: number } = {}) {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('certamen-e2e-wiped')) {
      sessionStorage.setItem('certamen-e2e-wiped', '1');
      indexedDB.deleteDatabase('certamen');
    }
  });
  await page.route('https://openrouter.ai/api/v1/credits', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: { total_credits: 10, total_usage: 1 } }) }));
  await page.route('https://openrouter.ai/api/v1/models', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: catalog }) }));
  await page.route('https://openrouter.ai/api/v1/chat/completions', async (route) => {
    const body = route.request().postDataJSON() as { messages?: Array<{ content?: string }> };
    const arbiter = body.messages?.[0]?.content?.startsWith('Arbitrate');
    if (!arbiter && options.answerDelayMs) await new Promise((resolve) => setTimeout(resolve, options.answerDelayMs));
    await route.fulfill({ status: 200, contentType: 'text/event-stream', body: sse(arbiter ? VERDICT : ANSWER.repeat(3)) });
  });
}

export async function signIn(page: Page) {
  await page.goto('/');
  await page.getByLabel('OpenRouter API key').fill('good');
  await page.getByRole('button', { name: 'Validate' }).click();
  await page.getByLabel('Question').waitFor();
}
