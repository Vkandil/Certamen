// Live model lineup: decides which models to suggest from the OpenRouter catalog
// itself (release date, price tier, open weights) instead of hard-coded model ids,
// so a new flagship shows up the day OpenRouter lists it.
// Pure functions only, no runtime imports (scripts/update-featured.mjs loads this file with Node).
import type { ModelInfo } from './types';

/** Labs we suggest by default, in tie-break order. One lab per slot keeps the debate diverse. */
export const MAJOR_LABS = ['anthropic', 'openai', 'google', 'x-ai', 'deepseek', 'moonshotai', 'qwen', 'mistralai', 'z-ai', 'meta-llama'];

export const DAY_MS = 24 * 60 * 60 * 1000;
export const NEW_WINDOW_DAYS = 30;
/** A lab whose flagship is younger than this is considered "hot" and moves up the lineup. */
const FRESH_LAB_DAYS = 45;
/** Flagship candidates must be at most this much older than the lab's newest release. */
const FLAGSHIP_WINDOW_DAYS = 180;

export type PresetKind = 'best' | 'fast' | 'open' | 'usual';
export type SuggestionReason = 'flagship' | 'pinned' | 'fast' | 'open' | 'usual';

/** Optional overlay served as public/featured-models.json (same origin, updated by a weekly workflow). */
export interface FeaturedOverlay {
  updatedAt?: string;
  /** Model ids forced into the "best" lineup (they replace their lab's computed flagship). */
  pin?: string[];
  /** Model ids never suggested. */
  exclude?: string[];
  /** Lab order override for the "best" lineup. */
  labs?: string[];
}

/** Local, per-browser usage counts. Never leaves IndexedDB. */
export type UsageStats = Record<string, { picks: number; lastUsed: number }>;

export interface LineupContext {
  models: ModelInfo[];
  featured?: FeaturedOverlay;
  usage?: UsageStats;
  now?: number;
}

export interface Suggestion {
  model: ModelInfo;
  reason: SuggestionReason;
}

export interface Upgrade {
  fromId: string;
  to: ModelInfo;
  /** 'newer': a newer release of the same family exists. 'missing': the model left the catalog. */
  kind: 'newer' | 'missing';
}

const VARIANT = /(^|[-_ .:/])(mini|nano|lite|tiny|micro|small|haiku|embed(ding)?|guard|moderation|audio|tts|realtime|search|image|vision|ocr|distill)([-_ .:]|$)/i;

export function totalPricePerMillion(model: ModelInfo): number {
  return (model.pricing.promptPerToken + model.pricing.completionPerToken) * 1_000_000;
}

export function ageDays(model: ModelInfo, now = Date.now()): number | undefined {
  return model.createdAt ? Math.max(0, Math.floor((now - model.createdAt) / DAY_MS)) : undefined;
}

export function isNew(model: ModelInfo, now = Date.now()): boolean {
  const age = ageDays(model, now);
  return age !== undefined && age <= NEW_WINDOW_DAYS;
}

/** Router aliases (~vendor/...-latest) and free mirrors duplicate real models. */
function isAliasOrFree(model: ModelInfo): boolean {
  return model.id.startsWith('~') || model.id.endsWith(':free') || model.id.startsWith('openrouter/');
}

function isPriced(model: ModelInfo): boolean {
  return totalPricePerMillion(model) > 0;
}

function suggestible(model: ModelInfo, featured?: FeaturedOverlay): boolean {
  return !isAliasOrFree(model) && isPriced(model) && !(featured?.exclude ?? []).includes(model.id);
}

export function isVariant(model: ModelInfo): boolean {
  return VARIANT.test(model.id.split('/')[1] ?? model.id);
}

function newest(models: ModelInfo[]): number {
  return Math.max(0, ...models.map((model) => model.createdAt ?? 0));
}

function byNewest(a: ModelInfo, b: ModelInfo): number {
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

/** The most capable recent model of a lab: priciest non-variant release in the lab's recent window. */
export function flagshipFor(models: ModelInfo[], lab: string, featured?: FeaturedOverlay): ModelInfo | undefined {
  const pool = models.filter((model) => model.author === lab && suggestible(model, featured) && !isVariant(model));
  if (pool.length === 0) return undefined;
  const latest = newest(pool);
  const recent = latest > 0 ? pool.filter((model) => (model.createdAt ?? 0) >= latest - FLAGSHIP_WINDOW_DAYS * DAY_MS) : pool;
  return [...recent].sort((a, b) => totalPricePerMillion(b) - totalPricePerMillion(a) || byNewest(a, b))[0];
}

/** A cheap, recent model of a lab: cheapest among the lab's five newest releases. */
export function fastFor(models: ModelInfo[], lab: string, featured?: FeaturedOverlay): ModelInfo | undefined {
  const pool = models.filter((model) => model.author === lab && suggestible(model, featured));
  if (pool.length === 0) return undefined;
  const recent = [...pool].sort(byNewest).slice(0, 5);
  return recent.sort((a, b) => totalPricePerMillion(a) - totalPricePerMillion(b) || byNewest(a, b))[0];
}

/** Best open-weights model of a lab. */
export function openFor(models: ModelInfo[], lab: string, featured?: FeaturedOverlay): ModelInfo | undefined {
  return flagshipFor(models.filter((model) => model.openWeights), lab, featured);
}

function pinnedModels(ctx: LineupContext): ModelInfo[] {
  return (ctx.featured?.pin ?? [])
    .map((id) => ctx.models.find((model) => model.id === id))
    .filter((model): model is ModelInfo => model !== undefined && !(ctx.featured?.exclude ?? []).includes(model.id));
}

/** Labs ordered for the "best" lineup: overlay order, else hot labs first, then the default order. */
export function rankedLabs(ctx: LineupContext): string[] {
  const now = ctx.now ?? Date.now();
  const present = new Set(ctx.models.map((model) => model.author));
  const base = ctx.featured?.labs?.length ? ctx.featured.labs : MAJOR_LABS;
  const labs = base.filter((lab) => present.has(lab));
  const fresh = (lab: string) => {
    const flagship = flagshipFor(ctx.models, lab, ctx.featured);
    const age = flagship ? ageDays(flagship, now) : undefined;
    return age !== undefined && age <= FRESH_LAB_DAYS;
  };
  if (ctx.featured?.labs?.length) return labs;
  return [...labs].sort((a, b) => Number(fresh(b)) - Number(fresh(a)) || labs.indexOf(a) - labs.indexOf(b));
}

export function usualModels(ctx: LineupContext, count = 4): ModelInfo[] {
  const now = ctx.now ?? Date.now();
  const usage = ctx.usage ?? {};
  const score = (id: string) => {
    const row = usage[id];
    if (!row) return 0;
    const weeks = Math.max(0, (now - row.lastUsed) / (7 * DAY_MS));
    return row.picks / (1 + weeks);
  };
  return ctx.models
    .filter((model) => (usage[model.id]?.picks ?? 0) > 0 && !(ctx.featured?.exclude ?? []).includes(model.id))
    .sort((a, b) => score(b.id) - score(a.id))
    .slice(0, count);
}

/** One-click rosters. Every preset uses one model per lab. */
export function buildPreset(kind: PresetKind, ctx: LineupContext, count = 4): Suggestion[] {
  if (kind === 'usual') return usualModels(ctx, count).map((model) => ({ model, reason: 'usual' }));
  const picks: Suggestion[] = [];
  const usedLabs = new Set<string>();
  const add = (model: ModelInfo | undefined, reason: SuggestionReason) => {
    if (!model || usedLabs.has(model.author) || picks.length >= count) return;
    usedLabs.add(model.author);
    picks.push({ model, reason });
  };
  if (kind === 'best') pinnedModels(ctx).forEach((model) => add(model, 'pinned'));
  for (const lab of rankedLabs(ctx)) {
    if (kind === 'best') add(flagshipFor(ctx.models, lab, ctx.featured), 'flagship');
    else if (kind === 'fast') add(fastFor(ctx.models, lab, ctx.featured), 'fast');
    else add(openFor(ctx.models, lab, ctx.featured), 'open');
  }
  if (kind === 'open' && picks.length < count) {
    // Labs outside the default list also publish open weights.
    const labs = [...new Set(ctx.models.filter((model) => model.openWeights).map((model) => model.author))];
    labs.map((lab) => openFor(ctx.models, lab, ctx.featured)).filter((model): model is ModelInfo => !!model).sort(byNewest).forEach((model) => add(model, 'open'));
  }
  return picks;
}

/** Why a model is in the roster, for the "reason" line under each slot. */
export function reasonFor(model: ModelInfo, ctx: LineupContext): SuggestionReason | undefined {
  if ((ctx.featured?.pin ?? []).includes(model.id)) return 'pinned';
  if (flagshipFor(ctx.models, model.author, ctx.featured)?.id === model.id) return 'flagship';
  if (model.openWeights && openFor(ctx.models, model.author, ctx.featured)?.id === model.id) return 'open';
  if (fastFor(ctx.models, model.author, ctx.featured)?.id === model.id) return 'fast';
  if ((ctx.usage?.[model.id]?.picks ?? 0) >= 2) return 'usual';
  return undefined;
}

/** Up to three swaps for a slot: same lab (top / cheaper), then another lab's flagship. */
export function alternativesFor(modelId: string, rosterIds: string[], ctx: LineupContext, count = 3): Suggestion[] {
  const current = ctx.models.find((model) => model.id === modelId);
  const taken = new Set(rosterIds);
  const out: Suggestion[] = [];
  const add = (model: ModelInfo | undefined, reason: SuggestionReason) => {
    if (!model || taken.has(model.id) || out.some((item) => item.model.id === model.id) || out.length >= count) return;
    out.push({ model, reason });
  };
  const lab = current?.author ?? modelId.split('/')[0] ?? '';
  add(flagshipFor(ctx.models, lab, ctx.featured), 'flagship');
  add(fastFor(ctx.models, lab, ctx.featured), 'fast');
  const rosterLabs = new Set(rosterIds.map((id) => ctx.models.find((model) => model.id === id)?.author ?? id.split('/')[0]));
  for (const other of rankedLabs(ctx)) {
    if (!rosterLabs.has(other)) add(flagshipFor(ctx.models, other, ctx.featured), 'flagship');
  }
  return out;
}

/** "opus-5" and "opus-5.5" share a family; "gpt-6.1" and "gpt-6.1-pro" do not. */
export function familyKey(id: string): string {
  return id.replace(/:.*$/, '').replace(/\d+(?:[.-]\d+)*/g, '#');
}

/** Newer releases of the roster's models, and replacements for models that left the catalog. */
export function upgradesFor(rosterIds: string[], ctx: LineupContext): Upgrade[] {
  const out: Upgrade[] = [];
  for (const id of rosterIds) {
    const current = ctx.models.find((model) => model.id === id);
    if (!current) {
      if (ctx.models.length === 0) continue;
      const lab = id.split('/')[0] ?? '';
      const replacement = flagshipFor(ctx.models, lab, ctx.featured);
      if (replacement && !rosterIds.includes(replacement.id)) out.push({ fromId: id, to: replacement, kind: 'missing' });
      continue;
    }
    if (!current.createdAt) continue;
    const family = familyKey(id);
    const newer = ctx.models
      .filter((model) => model.id !== id && familyKey(model.id) === family && suggestible(model, ctx.featured))
      .filter((model) => (model.createdAt ?? 0) > (current.createdAt ?? 0) + DAY_MS && !rosterIds.includes(model.id))
      // same family name but a much cheaper SKU is a smaller size, not an upgrade
      .filter((model) => totalPricePerMillion(model) >= totalPricePerMillion(current) * 0.5)
      .sort(byNewest)[0];
    if (newer) out.push({ fromId: id, to: newer, kind: 'newer' });
  }
  return out;
}

/** All labs' flagships, best lineup order first. Used for arbiter picks. */
export function flagships(ctx: LineupContext): ModelInfo[] {
  const ordered = rankedLabs(ctx);
  const others = [...new Set(ctx.models.map((model) => model.author))].filter((lab) => !ordered.includes(lab));
  return [...pinnedModels(ctx), ...[...ordered, ...others].map((lab) => flagshipFor(ctx.models, lab, ctx.featured))]
    .filter((model, index, all): model is ModelInfo => !!model && all.findIndex((other) => other?.id === model.id) === index);
}

/** The strongest model that is not debating; never an arbitrary catalog entry. */
function majorFlagships(ctx: LineupContext): ModelInfo[] {
  return flagships(ctx).filter((model) => MAJOR_LABS.includes(model.author) || (ctx.featured?.labs ?? []).includes(model.author) || (ctx.featured?.pin ?? []).includes(model.id));
}

export function recommendedArbiter(rosterIds: string[], ctx: LineupContext): ModelInfo | undefined {
  const pool = flagships(ctx);
  const major = majorFlagships(ctx);
  return major.find((model) => !rosterIds.includes(model.id))
    ?? pool.find((model) => !rosterIds.includes(model.id))
    ?? major[0]
    ?? [...ctx.models].filter((model) => suggestible(model, ctx.featured)).sort((a, b) => totalPricePerMillion(b) - totalPricePerMillion(a))[0];
}

/** A random arbiter, drawn among flagships only (never a tiny model). */
export function randomArbiter(rosterIds: string[], ctx: LineupContext, random: () => number = Math.random): ModelInfo | undefined {
  const pool = majorFlagships(ctx).filter((model) => !rosterIds.includes(model.id));
  if (pool.length === 0) return recommendedArbiter(rosterIds, ctx);
  return pool[Math.floor(random() * pool.length)] ?? pool[0];
}

/** The next debater to add: the best flagship from a lab that is not in the roster yet. */
export function nextSuggestion(rosterIds: string[], ctx: LineupContext): Suggestion | undefined {
  const rosterLabs = new Set(rosterIds.map((id) => ctx.models.find((model) => model.id === id)?.author ?? id.split('/')[0]));
  const fresh = buildPreset('best', ctx, MAJOR_LABS.length + (ctx.featured?.pin?.length ?? 0))
    .find((item) => !rosterIds.includes(item.model.id) && !rosterLabs.has(item.model.author));
  if (fresh) return fresh;
  const any = flagships(ctx).find((model) => !rosterIds.includes(model.id));
  return any ? { model: any, reason: 'flagship' } : undefined;
}

/** Resize a roster: shrink from the end, grow with next suggestions (one new lab each time). */
export function resizeRoster(rosterIds: string[], size: number, ctx: LineupContext): string[] {
  const next = rosterIds.slice(0, size);
  while (next.length < size) {
    const suggestion = nextSuggestion(next, ctx);
    if (!suggestion) break;
    next.push(suggestion.model.id);
  }
  return next;
}

/** Catalog order: newest first, models without a date last (by name). */
export function sortByNewest(models: ModelInfo[]): ModelInfo[] {
  return [...models].sort((a, b) => byNewest(a, b) || a.name.localeCompare(b.name));
}

/** Record that these models were used in a run. */
export function recordUsage(usage: UsageStats, modelIds: string[], now = Date.now()): UsageStats {
  const next: UsageStats = { ...usage };
  for (const id of new Set(modelIds)) next[id] = { picks: (next[id]?.picks ?? 0) + 1, lastUsed: now };
  return next;
}
