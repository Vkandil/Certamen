import type { FeaturedOverlay, UsageStats } from '../domain/lineup';
import { getSetting, setSetting } from './db';

const COMPOSER_PREFS = 'composer_prefs';
const MODEL_USAGE = 'model_usage';

/** Composer state remembered between visits (the question itself is not stored). */
export interface ComposerPrefs {
  selected: Array<{ modelId: string; temperature?: number; systemPromptExtra?: string }>;
  language: 'auto' | string;
  budgetCapUsd: number;
  responseWordTarget: number;
  useWordTarget: boolean;
  maxConcurrency: number;
  rounds: number;
  arbiterMode: 'recommended' | 'random' | 'manual';
  manualArbiterId: string;
}

export async function loadComposerPrefs(): Promise<Partial<ComposerPrefs> | undefined> {
  return getSetting<Partial<ComposerPrefs>>(COMPOSER_PREFS);
}

export async function saveComposerPrefs(prefs: ComposerPrefs): Promise<void> {
  await setSetting(COMPOSER_PREFS, prefs);
}

export async function loadUsage(): Promise<UsageStats> {
  return (await getSetting<UsageStats>(MODEL_USAGE)) ?? {};
}

export async function saveUsage(usage: UsageStats): Promise<void> {
  await setSetting(MODEL_USAGE, usage);
}

/** Reads the weekly featured overlay shipped with the app (same origin, so the CSP allows it). */
export async function fetchFeatured(baseUrl: string): Promise<FeaturedOverlay | undefined> {
  try {
    const response = await fetch(`${baseUrl}featured-models.json`, { cache: 'no-cache' });
    if (!response.ok) return undefined;
    return sanitizeFeatured(await response.json());
  } catch {
    return undefined;
  }
}

export function sanitizeFeatured(input: unknown): FeaturedOverlay | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const ids = (value: unknown) => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length < 200).slice(0, 50) : undefined);
  return {
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
    pin: ids(raw.pin),
    exclude: ids(raw.exclude),
    labs: ids(raw.labs)
  };
}
