import { describe, expect, it } from 'vitest';
import { parseOpenRouterEvent, parseUsage } from '../../src/api/sse';
import type { StreamEvent } from '../../src/domain/types';

describe('sse', () => {
  it('extracts deltas, reasoning, finish and usage', () => {
    const events: StreamEvent[] = [];
    parseOpenRouterEvent(JSON.stringify({
      choices: [{ delta: { content: 'abc', reasoning: 'r' }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 10, completion_tokens: 2, cost: 0.001 }
    }), (event) => events.push(event));
    expect(events).toEqual([
      { type: 'delta', text: 'abc' },
      { type: 'reasoning', text: 'r' },
      { type: 'finish', reason: 'stop' },
      { type: 'usage', usage: { promptTokens: 10, completionTokens: 2, costUsd: 0.001, reasoningTokens: undefined, cachedTokens: undefined } }
    ]);
  });

  it('turns malformed chunks into non retryable stream errors', () => {
    const events: StreamEvent[] = [];
    parseOpenRouterEvent('{bad', (event) => events.push(event));
    expect(events[0]?.type).toBe('error');
  });

  it('detects mid-stream provider errors', () => {
    const events: StreamEvent[] = [];
    parseOpenRouterEvent(JSON.stringify({ error: { code: 'provider_error', message: 'boom' }, choices: [{ finish_reason: 'error' }] }), (event) => events.push(event));
    expect(events.some((event) => event.type === 'error')).toBe(true);
  });

  it('parses OpenRouter cost as dollars, not dollars per million', () => {
    expect(parseUsage({ prompt_tokens: 1, completion_tokens: 1, cost: '0.00042' })?.costUsd).toBe(0.00042);
  });
});
