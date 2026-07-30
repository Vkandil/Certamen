import { OpenRouterError, errorFromStatus, retryCountForStatus, retryDelay } from './errors';
import { parseSseStream, toStreamError } from './sse';
import { OPENROUTER_BASE_URL, openRouterAttribution } from './attribution';
import type { ChatRequest, LlmClient, StreamEvent } from '../domain/types';

export interface CreditsInfo {
  totalCredits: number;
  totalUsage: number;
  remainingCredits: number;
}

export class OpenRouterClient implements LlmClient {
  constructor(private readonly apiKey: string) {}

  async *stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent> {
    let attempt = 0;
    let emittedToken = false;
    while (true) {
      try {
        const response = await fetch(`${BASE}/chat/completions`, {
          method: 'POST',
          signal,
          headers: this.headers(),
          body: JSON.stringify(req)
        });
        if (!response.ok) throw await statusError(response);
        if (!response.body) throw new OpenRouterError({ code: 'empty_body', message: 'Flux OpenRouter vide.', retryable: true }, response.status);
        const generationId = response.headers.get('X-Generation-Id') ?? undefined;
        const provider = response.headers.get('X-Provider') ?? undefined;
        for await (const event of parseSseStream(response.body, { generationId, provider })) {
          if (event.type === 'delta') emittedToken = true;
          yield event;
        }
        return;
      } catch (error) {
        const openRouterError = error instanceof OpenRouterError ? error : undefined;
        const maxRetries = emittedToken ? 0 : retryCountForStatus(openRouterError?.status);
        if (attempt >= maxRetries || signal.aborted) {
          yield toStreamError(error);
          return;
        }
        await sleep(retryDelay(attempt, openRouterError?.retryAfterMs), signal);
        attempt += 1;
      }
    }
  }

  private headers(): HeadersInit {
    return {
      ...openRouterAttribution(),
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
}

export async function validateCredits(apiKey: string): Promise<CreditsInfo> {
  const response = await fetch(`${BASE}/credits`, {
    headers: {
      ...openRouterAttribution(),
      Authorization: `Bearer ${apiKey}`
    }
  });
  if (!response.ok) throw await statusError(response);
  const json = await response.json() as { data?: { total_credits?: number; total_usage?: number } };
  const totalCredits = Number(json.data?.total_credits ?? 0);
  const totalUsage = Number(json.data?.total_usage ?? 0);
  return {
    totalCredits,
    totalUsage,
    remainingCredits: Math.max(0, totalCredits - totalUsage)
  };
}

const BASE = OPENROUTER_BASE_URL;

async function statusError(response: Response): Promise<OpenRouterError> {
  let message = response.statusText;
  try {
    const json = await response.json() as { error?: { message?: string } };
    message = json.error?.message ?? message;
  } catch {
    // Keep status text.
  }
  const retryAfter = response.headers.get('Retry-After');
  const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : undefined;
  return new OpenRouterError(errorFromStatus(response.status, message), response.status, retryAfterMs);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}
