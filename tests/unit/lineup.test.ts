import { describe, expect, it } from 'vitest';
import { normalizeModel } from '../../src/domain/catalog';
import {
  alternativesFor,
  buildPreset,
  familyKey,
  flagshipFor,
  isNew,
  randomArbiter,
  reasonFor,
  recommendedArbiter,
  recordUsage,
  sortByNewest,
  upgradesFor,
  type LineupContext
} from '../../src/domain/lineup';
import type { ModelInfo } from '../../src/domain/types';

const NOW = Date.UTC(2026, 9, 9);
const DAY = 24 * 60 * 60 * 1000;

function m(id: string, daysAgo: number, pricePerM: number, extra: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id,
    name: id.split('/')[1] ?? id,
    author: id.replace(/^~/, '').split('/')[0] ?? 'x',
    contextLength: 200000,
    maxCompletionTokens: 8000,
    pricing: { promptPerToken: pricePerM / 2 / 1e6, completionPerToken: pricePerM / 2 / 1e6 },
    supportedParameters: ['temperature'],
    inputModalities: ['text'],
    outputModalities: ['text'],
    createdAt: NOW - daysAgo * DAY,
    ...extra
  };
}

const catalog: ModelInfo[] = [
  m('anthropic/claude-opus-5', 200, 90),
  m('anthropic/claude-opus-5.5', 6, 90),
  m('anthropic/claude-sonnet-5.5', 6, 18),
  m('anthropic/claude-haiku-5', 60, 5),
  m('openai/gpt-6.1', 12, 40),
  m('openai/gpt-6.1-mini', 12, 2),
  m('openai/gpt-5.6-sol-pro', 300, 160),
  m('google/gemini-3.6-pro', 30, 25),
  m('google/gemini-3.6-flash', 30, 3),
  m('x-ai/grok-5', 20, 30),
  m('deepseek/deepseek-v4', 3, 3, { openWeights: true }),
  m('meta-llama/llama-5-405b', 90, 4, { openWeights: true }),
  m('qwen/qwen4-max', 200, 8),
  m('~anthropic/claude-opus-latest', 6, 90),
  m('openai/gpt-6.1:free', 12, 0),
  m('tiny/model-a', 1, 0.1)
];
const ctx: LineupContext = { models: catalog, now: NOW };

describe('lineup', () => {
  it('reads the release date and open-weights flag from the OpenRouter catalog', () => {
    const model = normalizeModel({ id: 'deepseek/deepseek-v4', created: 1_760_000_000, hugging_face_id: 'deepseek-ai/DeepSeek-V4' });
    expect(model.createdAt).toBe(1_760_000_000_000);
    expect(model.openWeights).toBe(true);
    expect(normalizeModel({ id: '~anthropic/claude-opus-latest' }).author).toBe('anthropic');
  });

  it('picks the newest flagship per lab without hard-coded ids', () => {
    expect(flagshipFor(catalog, 'anthropic')?.id).toBe('anthropic/claude-opus-5.5');
    // the old pricey model is outside the lab's recent window
    expect(flagshipFor(catalog, 'openai')?.id).toBe('openai/gpt-6.1');
    expect(flagshipFor(catalog, 'google')?.id).toBe('google/gemini-3.6-pro');
  });

  it('builds a one-lab-per-slot "best" lineup with hot labs first', () => {
    const best = buildPreset('best', ctx).map((item) => item.model.id);
    expect(best).toHaveLength(4);
    expect(new Set(best.map((id) => id.split('/')[0])).size).toBe(4);
    expect(best).toContain('anthropic/claude-opus-5.5');
    expect(best).toContain('openai/gpt-6.1');
    expect(best).not.toContain('~anthropic/claude-opus-latest');
    expect(best.some((id) => id.endsWith(':free'))).toBe(false);
  });

  it('honours pins and excludes from the featured overlay', () => {
    const featured = { pin: ['qwen/qwen4-max'], exclude: ['openai/gpt-6.1'] };
    const best = buildPreset('best', { ...ctx, featured });
    expect(best[0]).toEqual({ model: expect.objectContaining({ id: 'qwen/qwen4-max' }), reason: 'pinned' });
    expect(best.map((item) => item.model.id)).not.toContain('openai/gpt-6.1');
  });

  it('builds fast and open presets', () => {
    const fast = buildPreset('fast', ctx).map((item) => item.model.id);
    expect(fast).toContain('openai/gpt-6.1-mini');
    expect(fast).toContain('anthropic/claude-haiku-5');
    const open = buildPreset('open', ctx).map((item) => item.model.id);
    expect(open).toEqual(expect.arrayContaining(['deepseek/deepseek-v4', 'meta-llama/llama-5-405b']));
  });

  it('builds the "usual" preset from local usage, most recent habits first', () => {
    let usage = recordUsage({}, ['x-ai/grok-5', 'google/gemini-3.6-pro'], NOW - 60 * DAY);
    usage = recordUsage(usage, ['x-ai/grok-5', 'qwen/qwen4-max'], NOW);
    const usual = buildPreset('usual', { ...ctx, usage }).map((item) => item.model.id);
    expect(usual[0]).toBe('x-ai/grok-5');
    expect(usual).toHaveLength(3);
  });

  it('explains why a model is suggested', () => {
    expect(reasonFor(catalog[1]!, ctx)).toBe('flagship');
    expect(reasonFor(catalog[5]!, ctx)).toBe('fast');
  });

  it('suggests same-lab and other-lab alternatives for a slot', () => {
    const alts = alternativesFor('anthropic/claude-opus-5.5', ['anthropic/claude-opus-5.5', 'openai/gpt-6.1'], ctx).map((item) => item.model.id);
    expect(alts).toHaveLength(3);
    expect(alts).not.toContain('openai/gpt-6.1');
    expect(alts).not.toContain('anthropic/claude-opus-5.5');
  });

  it('detects newer releases and models that left the catalog', () => {
    const upgrades = upgradesFor(['anthropic/claude-opus-5', 'openai/gpt-5.2-gone'], ctx);
    expect(upgrades).toContainEqual({ fromId: 'anthropic/claude-opus-5', to: expect.objectContaining({ id: 'anthropic/claude-opus-5.5' }), kind: 'newer' });
    expect(upgrades).toContainEqual({ fromId: 'openai/gpt-5.2-gone', to: expect.objectContaining({ id: 'openai/gpt-6.1' }), kind: 'missing' });
    expect(familyKey('openai/gpt-6.1-pro')).not.toBe(familyKey('openai/gpt-6.1'));
  });

  it('never picks an arbitrary or tiny model as arbiter', () => {
    const roster = buildPreset('best', ctx).map((item) => item.model.id);
    const arbiter = recommendedArbiter(roster, ctx);
    expect(arbiter).toBeDefined();
    expect(roster).not.toContain(arbiter!.id);
    expect(arbiter!.id).not.toBe('tiny/model-a');
    for (let i = 0; i < 20; i += 1) {
      expect(randomArbiter(roster, ctx, () => i / 20)?.id).not.toBe('tiny/model-a');
    }
  });

  it('flags new models and sorts the catalog newest first', () => {
    expect(isNew(catalog[1]!, NOW)).toBe(true);
    expect(isNew(catalog[0]!, NOW)).toBe(false);
    expect(sortByNewest(catalog)[0]?.id).toBe('tiny/model-a');
  });

  it('still works when the catalog has no release dates', () => {
    const undated = catalog.map((model) => ({ ...model, createdAt: undefined }));
    expect(flagshipFor(undated, 'openai')?.id).toBe('openai/gpt-5.6-sol-pro');
    expect(buildPreset('best', { models: undated })).toHaveLength(4);
  });
});
