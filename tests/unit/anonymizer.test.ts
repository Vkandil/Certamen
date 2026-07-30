import { describe, expect, it } from 'vitest';
import { assignLabels, buildDenylist, renderConcurrentes, scrubAnonymity, seededShuffle } from '../../src/domain/anonymizer';
import type { Certamen, ModelInfo, Responsio } from '../../src/domain/types';

describe('anonymizer', () => {
  const models: ModelInfo[] = [
    {
      id: 'anthropic/claude-test',
      name: 'Claude Test',
      author: 'anthropic',
      contextLength: 10000,
      maxCompletionTokens: 1000,
      pricing: { promptPerToken: 1e-7, completionPerToken: 2e-7 },
      supportedParameters: [],
      inputModalities: ['text'],
      outputModalities: ['text']
    }
  ];

  it('assigns stable labels by slot', () => {
    expect(assignLabels([{ slot: 's1' }, { slot: 's2' }])).toEqual({ s1: 'A', s2: 'B' });
  });

  it('scrubs dynamic model identity terms', () => {
    const scrubbed = scrubAnonymity('En tant que Claude par Anthropic', buildDenylist(models));
    expect(scrubbed.toLowerCase()).not.toContain('claude');
    expect(scrubbed.toLowerCase()).not.toContain('anthropic');
  });

  it('uses deterministic but recipient-specific permutations', () => {
    const items = ['A', 'B', 'C', 'D', 'E'];
    expect(seededShuffle(items, 'cert:s1')).toEqual(seededShuffle(items, 'cert:s1'));
    expect(seededShuffle(items, 'cert:s1')).not.toEqual(seededShuffle(items, 'cert:s2'));
  });

  it('never serializes the recipient own answer and escapes closing XML tags', () => {
    const certamen = sampleCertamen();
    const xml = renderConcurrentes(certamen, 's1', sampleResponsiones(), buildDenylist(models));
    expect(xml).not.toContain('own');
    expect(xml).toContain('&lt;/responsio&gt;');
  });
});

function sampleCertamen(): Certamen {
  return {
    id: 'c',
    quaestio: { id: 'q', text: '?', language: 'auto', createdAt: 1 },
    config: { rounds: 1, anonymize: true, shufflePerRecipient: true, revealAfter: true, determinatio: true, budgetCapUsd: 1, perCallTimeoutMs: 1000, maxConcurrency: 2, minQuorum: 2, responseWordTarget: 100 },
    contendentes: [],
    labelMap: { s1: 'A', s2: 'B' },
    status: 'draft',
    responsiones: [],
    totalCostUsd: 0,
    startedAt: 1,
    appVersion: '0',
    specVersion: '1.0'
  };
}

function sampleResponsiones(): Responsio[] {
  return [
    { id: 'r1', certamenId: 'c', roundIndex: 0, slot: 's1', modelId: 'm', status: 'done', raw: 'own', startedAt: 1, requestSnapshot: { model: 'm', messages: [], stream: true } },
    { id: 'r2', certamenId: 'c', roundIndex: 0, slot: 's2', modelId: 'm', status: 'done', raw: 'other </responsio>', startedAt: 1, requestSnapshot: { model: 'm', messages: [], stream: true } }
  ];
}
