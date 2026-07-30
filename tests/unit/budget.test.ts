import { describe, expect, it, vi } from 'vitest';
import { BudgetGuard, computeMaxTokens, ensureContextFits, estimateCost } from '../../src/domain/budget';
import type { Certamen, ModelInfo } from '../../src/domain/types';

describe('budget', () => {
  const model: ModelInfo = {
    id: 'a/model',
    name: 'Model',
    author: 'a',
    contextLength: 8192,
    maxCompletionTokens: 2048,
    pricing: { promptPerToken: 0.000001, completionPerToken: 0.000002 },
    supportedParameters: ['max_tokens'],
    inputModalities: ['text'],
    outputModalities: ['text']
  };

  it('estimates a cost range', () => {
    const estimate = estimateCost(sampleCertamen(), [model]);
    expect(estimate.highUsd).toBeGreaterThan(estimate.lowUsd);
  });

  it('tracks hard cap before starting new calls', () => {
    const onExceeded = vi.fn();
    const guard = new BudgetGuard(0.01, onExceeded);
    guard.addUsage({ promptTokens: 1, completionTokens: 1, costUsd: 0.02 });
    expect(guard.canStartCall()).toBe(false);
    expect(onExceeded).toHaveBeenCalled();
  });

  it('caps max tokens by provider maximum', () => {
    expect(computeMaxTokens(model, 2000)).toBe(2048);
  });

  it('rejects impossible contexts', () => {
    expect(ensureContextFits([{ role: 'user', content: 'x'.repeat(100000) }], 1000, model)).toEqual({ ok: false });
  });
});

function sampleCertamen(): Certamen {
  return {
    id: 'c',
    quaestio: { id: 'q', text: 'Question', language: 'auto', createdAt: 1 },
    config: { rounds: 1, anonymize: true, shufflePerRecipient: true, revealAfter: true, determinatio: true, budgetCapUsd: 1, perCallTimeoutMs: 1000, maxConcurrency: 2, minQuorum: 2, responseWordTarget: 600 },
    contendentes: [
      { slot: 's1', modelId: 'a/model', label: 'A', role: 'contendens' },
      { slot: 's2', modelId: 'a/model', label: 'B', role: 'contendens' }
    ],
    labelMap: { s1: 'A', s2: 'B' },
    status: 'draft',
    responsiones: [],
    totalCostUsd: 0,
    startedAt: 1,
    appVersion: '0',
    specVersion: '1.0'
  };
}
