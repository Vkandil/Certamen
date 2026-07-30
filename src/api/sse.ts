import { createParser, type EventSourceMessage } from 'eventsource-parser';
import { OpenRouterError } from './errors';
import type { CertamenError, StreamEvent, Usage } from '../domain/types';

type Emit = (event: StreamEvent) => void;

export async function* parseSseStream(stream: ReadableStream<Uint8Array>, meta: { generationId?: string; provider?: string } = {}): AsyncGenerator<StreamEvent> {
  const queue: StreamEvent[] = [];
  let done = false;
  const decoder = new TextDecoder();
  const parser = createParser({
    onEvent(event: EventSourceMessage) {
      if (event.data === '[DONE]') {
        done = true;
        return;
      }
      parseOpenRouterEvent(event.data, (item) => queue.push(item));
    },
    onComment() {
      queue.push({ type: 'keepalive' });
    }
  });

  if (meta.generationId || meta.provider) {
    yield { type: 'meta', generationId: meta.generationId, provider: meta.provider };
  }

  const reader = stream.getReader();
  try {
    while (!done) {
      const read = await reader.read();
      if (read.done) break;
      parser.feed(decoder.decode(read.value, { stream: true }));
      while (queue.length) {
        const event = queue.shift();
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
  while (queue.length) {
    const event = queue.shift();
    if (event) yield event;
  }
}

export function parseOpenRouterEvent(data: string, emit: Emit): void {
  let json: unknown;
  try {
    json = JSON.parse(data);
  } catch (error) {
    emit({ type: 'error', err: { code: 'malformed_sse', message: error instanceof Error ? error.message : 'Chunk SSE malforme.', retryable: false } });
    return;
  }
  if (!isRecord(json)) return;
  if (isRecord(json.error)) {
    emit({ type: 'error', err: parseChunkError(json.error) });
  }
  const choice = Array.isArray(json.choices) && isRecord(json.choices[0]) ? json.choices[0] : undefined;
  const delta = isRecord(choice?.delta) ? choice.delta : undefined;
  if (typeof delta?.content === 'string' && delta.content.length > 0) emit({ type: 'delta', text: delta.content });
  if (typeof delta?.reasoning === 'string' && delta.reasoning.length > 0) emit({ type: 'reasoning', text: delta.reasoning });
  if (typeof choice?.finish_reason === 'string' && choice.finish_reason) emit({ type: 'finish', reason: choice.finish_reason });
  const usage = parseUsage(json.usage);
  if (usage) emit({ type: 'usage', usage });
}

export function parseUsage(input: unknown): Usage | undefined {
  if (!isRecord(input)) return undefined;
  const promptTokens = numberValue(input.prompt_tokens);
  const completionTokens = numberValue(input.completion_tokens);
  const costUsd = numberValue(input.cost);
  if (promptTokens === undefined && completionTokens === undefined && costUsd === undefined) return undefined;
  return {
    promptTokens: promptTokens ?? 0,
    completionTokens: completionTokens ?? 0,
    reasoningTokens: numberValue(input.reasoning_tokens),
    cachedTokens: numberValue(input.cached_tokens),
    costUsd: costUsd ?? 0
  };
}

export function toStreamError(error: unknown): StreamEvent {
  if (error instanceof OpenRouterError) return { type: 'error', err: error.certamenError };
  return {
    type: 'error',
    err: { code: 'network_error', message: error instanceof Error ? error.message : String(error), retryable: true }
  };
}

function parseChunkError(input: Record<string, unknown>): CertamenError {
  return {
    code: String(input.code ?? 'stream_error'),
    message: String(input.message ?? 'Erreur fournisseur en cours de flux.'),
    retryable: false
  };
}

function isRecord(input: unknown): input is Record<string, unknown> {
  return typeof input === 'object' && input !== null;
}

function numberValue(input: unknown): number | undefined {
  if (typeof input === 'number') return input;
  if (typeof input === 'string' && input.trim()) {
    const value = Number(input);
    return Number.isFinite(value) ? value : undefined;
  }
  return undefined;
}
