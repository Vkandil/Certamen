import type { Certamen, ChatMessage, ModelInfo, Usage } from './types';
import { estimateMessagesTokens, estimateTokens } from './tokens';

export interface CostEstimate {
  lowUsd: number;
  highUsd: number;
  expectedUsd: number;
  inputTokens: number;
  outputTokens: number;
}

export class BudgetGuard {
  private spent = 0;
  exhausted = false;

  constructor(
    private readonly capUsd: number,
    private readonly onExceeded?: (spent: number, cap: number) => void
  ) {}

  canStartCall(): boolean {
    return !this.exhausted && this.spent < this.capUsd;
  }

  addUsage(usage: Usage): void {
    this.spent += usage.costUsd;
    if (this.spent >= this.capUsd && !this.exhausted) {
      this.exhausted = true;
      this.onExceeded?.(this.spent, this.capUsd);
    }
  }

  getSpent(): number {
    return this.spent;
  }
}

export function estimateCost(certamen: Certamen, models: ModelInfo[]): CostEstimate {
  const contendentes = certamen.contendentes.filter((item) => item.role === 'contendens');
  const modelById = new Map(models.map((model) => [model.id, model]));
  const quaestioTokens = estimateTokens(`${certamen.quaestio.text}\n${certamen.quaestio.context ?? ''}`);
  const wordTarget = effectiveWordTarget(certamen.config.responseWordTarget, certamen.config.useWordTarget);
  const averagePrompt = average(contendentes.map((item) => modelById.get(item.modelId)?.pricing.promptPerToken ?? 0));
  const averageCompletion = average(contendentes.map((item) => modelById.get(item.modelId)?.pricing.completionPerToken ?? 0));
  const n = contendentes.length;
  const round0Input = n * (700 + quaestioTokens);
  const round0Output = n * wordTarget * 1.4;
  const disputatioInput = certamen.config.rounds > 0
    ? n * (900 + quaestioTokens + wordTarget * 1.4 * n)
    : 0;
  const disputatioOutput = certamen.config.rounds > 0 ? n * wordTarget * 1.9 : 0;
  const determinatioInput = certamen.config.determinatio ? quaestioTokens + n * wordTarget * 1.6 : 0;
  const determinatioOutput = certamen.config.determinatio ? wordTarget * 1.5 : 0;
  const inputTokens = Math.ceil(round0Input + disputatioInput + determinatioInput);
  const outputTokens = Math.ceil(round0Output + disputatioOutput + determinatioOutput);
  const expectedUsd = inputTokens * averagePrompt + outputTokens * averageCompletion;
  return {
    lowUsd: expectedUsd * 0.6,
    highUsd: expectedUsd * 1.4,
    expectedUsd,
    inputTokens,
    outputTokens
  };
}

/** Indicative cost of each contender for this question, using that model's own prices. */
export function estimatePerModel(certamen: Certamen, models: ModelInfo[]): Record<string, number> {
  const contendentes = certamen.contendentes.filter((item) => item.role === 'contendens');
  const n = Math.max(1, contendentes.length);
  const quaestioTokens = estimateTokens(`${certamen.quaestio.text}\n${certamen.quaestio.context ?? ''}`);
  const wordTarget = effectiveWordTarget(certamen.config.responseWordTarget, certamen.config.useWordTarget);
  const disputatio = certamen.config.rounds > 0;
  const inputTokens = 700 + quaestioTokens + (disputatio ? 900 + quaestioTokens + wordTarget * 1.4 * n : 0);
  const outputTokens = wordTarget * 1.4 + (disputatio ? wordTarget * 1.9 : 0);
  const out: Record<string, number> = {};
  for (const item of contendentes) {
    const model = models.find((candidate) => candidate.id === item.modelId);
    if (model) out[item.modelId] = inputTokens * model.pricing.promptPerToken + outputTokens * model.pricing.completionPerToken;
  }
  return out;
}

export function computeMaxTokens(model: ModelInfo | undefined, wordTarget: number, requested?: number): number {
  const target = requested ?? Math.ceil(wordTarget * 2.2);
  const providerCap = model?.maxCompletionTokens ?? target;
  return Math.max(1, Math.min(target, providerCap));
}

export function effectiveWordTarget(wordTarget: number, useWordTarget = true): number {
  return useWordTarget ? wordTarget : 900;
}

export function ensureContextFits(messages: ChatMessage[], maxTokens: number, model: ModelInfo): { ok: true; maxTokens: number } | { ok: false } {
  const used = estimateMessagesTokens(messages);
  if (used + maxTokens <= model.contextLength) return { ok: true, maxTokens };
  const reduced = Math.max(512, model.contextLength - used);
  if (used + reduced <= model.contextLength) return { ok: true, maxTokens: reduced };
  return { ok: false };
}

export function average(values: number[]): number {
  const usable = values.filter((value) => Number.isFinite(value));
  if (usable.length === 0) return 0;
  return usable.reduce((sum, value) => sum + value, 0) / usable.length;
}
