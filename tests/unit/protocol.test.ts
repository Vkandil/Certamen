import { describe, expect, it } from 'vitest';
import { canRetry, retryFailed, retryableSlots, runCertamen } from '../../src/domain/protocol';
import type { Certamen, ChatRequest, LlmClient, ModelInfo, StreamEvent } from '../../src/domain/types';

describe('protocol', () => {
  it('runs round 0, disputatio and determinatio with identical model ids but distinct slots', async () => {
    const certamen = sampleCertamen();
    const client = new StubClient();
    const result = await runCertamen(certamen, client, {}, { models: [model], denylist: [] });
    expect(result.status).toBe('completed');
    expect(result.responsiones.filter((item) => item.roundIndex === 0)).toHaveLength(3);
    expect(result.responsiones.filter((item) => item.roundIndex === 1)).toHaveLength(3);
    expect(result.determinatio?.status).toBe('done');
    expect(new Set(result.contendentes.map((item) => item.slot)).size).toBe(4);
  });

  it('fails when quorum is not reached', async () => {
    const certamen = sampleCertamen();
    const client = new FailingClient();
    const result = await runCertamen(certamen, client, {}, { models: [model], denylist: [] });
    expect(result.status).toBe('failed');
    expect(result.failureReason).toBe('quorum_not_met');
  });

  it('retries only the failed answers, then re-runs the arbiter', async () => {
    const certamen = sampleCertamen();
    certamen.config.rounds = 0;
    const first = await runCertamen(certamen, new FlakyClient('s2'), {}, { models: [model], denylist: [] });
    expect(first.status).toBe('partial');
    expect(retryableSlots(first)).toEqual(['s2']);
    expect(canRetry(first)).toBe(true);
    const calls: string[] = [];
    const retried = await retryFailed(first, new StubClient(calls), {}, { models: [model], denylist: [] });
    expect(retried.status).toBe('completed');
    expect(retryableSlots(retried)).toEqual([]);
    expect(canRetry(retried)).toBe(false);
    // one contender call (the failed slot) + one arbiter call
    expect(calls).toHaveLength(2);
    expect(retried.determinatio?.status).toBe('done');
  });
});

class FlakyClient implements LlmClient {
  private seen = 0;
  constructor(private readonly failOnCall: string) {}
  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    this.seen += 1;
    // the second contender call of round 0 fails (calls are made in slot order)
    if (this.failOnCall === 's2' && this.seen === 2) {
      yield { type: 'error', err: { code: '503', message: 'down', retryable: true } };
      return;
    }
    yield* new StubClient().stream(req);
  }
}

class StubClient implements LlmClient {
  constructor(private readonly calls: string[] = []) {}
  async *stream(req: ChatRequest): AsyncIterable<StreamEvent> {
    this.calls.push(req.model);
    yield { type: 'delta', text: req.messages[0]?.content.includes('arbiter') ? '## Consensus\n- ok\n## Dissensus\n- A: oui; B: non\n## Synthese\nS\n## Recommandation\nR\n## A verifier\n- V' : '## Reponse\nTexte utile de plus de deux cents caracteres pour pouvoir rester exploitable meme si un fournisseur interrompt le flux plus tard. '.repeat(3) };
    yield { type: 'usage', usage: { promptTokens: 1, completionTokens: 1, costUsd: 0.0001 } };
    yield { type: 'finish', reason: 'stop' };
  }
}

class FailingClient implements LlmClient {
  async *stream(): AsyncIterable<StreamEvent> {
    yield { type: 'error', err: { code: '503', message: 'down', retryable: false } };
  }
}

const model: ModelInfo = {
  id: 'same/model',
  name: 'Same Model',
  author: 'same',
  contextLength: 100000,
  maxCompletionTokens: 4000,
  pricing: { promptPerToken: 1e-7, completionPerToken: 2e-7 },
  supportedParameters: ['temperature', 'max_tokens', 'seed'],
  inputModalities: ['text'],
  outputModalities: ['text']
};

function sampleCertamen(): Certamen {
  return {
    id: 'c',
    quaestio: { id: 'q', text: 'Question', language: 'auto', createdAt: 1 },
    config: { rounds: 1, anonymize: true, shufflePerRecipient: true, revealAfter: true, determinatio: true, budgetCapUsd: 1, perCallTimeoutMs: 1000, maxConcurrency: 3, minQuorum: 2, responseWordTarget: 100 },
    contendentes: [
      { slot: 's1', modelId: 'same/model', label: 'A', role: 'contendens' },
      { slot: 's2', modelId: 'same/model', label: 'B', role: 'contendens', temperature: 0.9 },
      { slot: 's3', modelId: 'same/model', label: 'C', role: 'contendens', systemPromptExtra: 'advocatus diaboli' },
      { slot: 'arb', modelId: 'same/model', label: 'ARB', role: 'arbiter' }
    ],
    labelMap: { s1: 'A', s2: 'B', s3: 'C' },
    status: 'draft',
    responsiones: [],
    totalCostUsd: 0,
    startedAt: 1,
    appVersion: '0',
    specVersion: '1.0'
  };
}
