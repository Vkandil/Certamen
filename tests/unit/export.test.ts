import { describe, expect, it } from 'vitest';
import { exportJson, exportMarkdown } from '../../src/export/markdown';
import { certamenFromPermalink, certamenToPermalink } from '../../src/export/permalink';
import type { Certamen } from '../../src/domain/types';

describe('export', () => {
  it('does not leak the API key in markdown or json exports', () => {
    const key = 'sk-or-secret';
    const certamen = sampleCertamen();
    expect(exportMarkdown(certamen)).not.toContain(key);
    expect(exportJson(certamen)).not.toContain(key);
  });

  it('round-trips a permalink without request snapshots', () => {
    const link = certamenToPermalink(sampleCertamen(), 'http://localhost:5273/');
    expect(link).toContain('#c=');
    const parsed = certamenFromPermalink(new URL(link ?? '').hash);
    expect(parsed?.id).toBe('c');
    expect(parsed?.responsiones[0]?.requestSnapshot.messages).toEqual([]);
  });

  it('redacts accidental API keys from permalinks', () => {
    const certamen = sampleCertamen();
    certamen.quaestio.text = 'Please review sk-or-v1-secret-token';
    const link = certamenToPermalink(certamen, 'http://localhost:5273/');
    const parsed = certamenFromPermalink(new URL(link ?? '').hash);
    expect(parsed?.quaestio.text).not.toContain('sk-or-v1-secret-token');
    expect(parsed?.quaestio.text).toContain('[redacted-openrouter-key]');
  });
});

function sampleCertamen(): Certamen {
  return {
    id: 'c',
    quaestio: { id: 'q', text: 'Question', language: 'auto', createdAt: 1 },
    config: { rounds: 1, anonymize: true, shufflePerRecipient: true, revealAfter: true, determinatio: true, budgetCapUsd: 1, perCallTimeoutMs: 1000, maxConcurrency: 2, minQuorum: 2, responseWordTarget: 100 },
    contendentes: [{ slot: 's1', modelId: 'm', label: 'A', role: 'contendens' }],
    labelMap: { s1: 'A' },
    status: 'completed',
    responsiones: [
      {
        id: 'r',
        certamenId: 'c',
        roundIndex: 0,
        slot: 's1',
        modelId: 'm',
        status: 'done',
        raw: 'body',
        startedAt: 1,
        requestSnapshot: { model: 'm', messages: [{ role: 'user', content: 'sk-or-secret must not appear because exports contain app state only' }], stream: true }
      }
    ],
    totalCostUsd: 0,
    startedAt: 1,
    appVersion: '0',
    specVersion: '1.0'
  };
}
