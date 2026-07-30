import type { Certamen, ModelInfo, Responsio } from './types';
import { truncateToTokenBudget } from './tokens';

const STATIC_DENYLIST = [
  'openai',
  'chatgpt',
  'gpt',
  'anthropic',
  'claude',
  'google',
  'gemini',
  'deepseek',
  'mistral',
  'meta',
  'llama',
  'xai',
  'grok',
  'cohere',
  'qwen',
  'kimi',
  'moonshot'
];

export function labels(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String.fromCharCode(65 + index));
}

export function assignLabels(contendentes: Array<{ slot: string }>): Record<string, string> {
  const next = labels(contendentes.length);
  return contendentes.reduce<Record<string, string>>((map, contendens, index) => {
    map[contendens.slot] = next[index] ?? `P${index + 1}`;
    return map;
  }, {});
}

export function buildDenylist(models: ModelInfo[]): string[] {
  const terms = new Set<string>(STATIC_DENYLIST);
  for (const model of models) {
    terms.add(model.author);
    terms.add(model.name);
    terms.add(model.id.split('/')[0] ?? model.id);
    for (const part of model.name.split(/[\s:()/_-]+/)) {
      if (part.length >= 4) terms.add(part);
    }
  }
  return [...terms].filter((term) => term.trim().length >= 3);
}

export function scrubAnonymity(text: string, denylist: string[]): string {
  return denylist.reduce((current, term) => {
    const normalized = term.trim();
    if (!normalized) return current;
    const pattern = normalized
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/[-_\s]+/g, '[-_\\s]*');
    return current.replace(new RegExp(pattern, 'gi'), '[participant]');
  }, text);
}

export function seededShuffle<T>(items: readonly T[], seedText: string): T[] {
  const result = [...items];
  let seed = hash(seedText);
  for (let i = result.length - 1; i > 0; i -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const j = seed % (i + 1);
    const a = result[i];
    const b = result[j];
    if (a !== undefined && b !== undefined) {
      result[i] = b;
      result[j] = a;
    }
  }
  return result;
}

export function renderConcurrentes(
  certamen: Certamen,
  recipientSlot: string,
  previous: Responsio[],
  denylist: string[],
  tokenBudgetPerResponsio?: number
): string {
  const others = previous.filter((responsio) => responsio.slot !== recipientSlot && responsio.status !== 'filtered');
  const ordered = certamen.config.shufflePerRecipient
    ? seededShuffle(others, `${certamen.id}:${recipientSlot}:${certamen.config.seed ?? ''}`)
    : others;
  const body = ordered.map((responsio) => {
    const label = certamen.labelMap[responsio.slot] ?? '?';
    const suffix = responsio.status === 'truncated' ? '\n\n[reponse tronquee]' : '';
    const raw = `${responsio.parsed?.body ?? responsio.raw}${suffix}`;
    const scrubbed = certamen.config.anonymize ? scrubAnonymity(raw, denylist) : raw;
    const trimmed = tokenBudgetPerResponsio ? truncateToTokenBudget(scrubbed, tokenBudgetPerResponsio) : scrubbed;
    return `<responsio label="${label}">\n${trimmed.replaceAll('</responsio>', '&lt;/responsio&gt;')}\n</responsio>`;
  });
  return `<responsiones_concurrentes>\n${body.join('\n')}\n</responsiones_concurrentes>`;
}

function hash(text: string): number {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}
