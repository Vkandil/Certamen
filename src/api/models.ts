import { OPENROUTER_BASE_URL, openRouterAttribution } from './attribution';
import { isTextModel, normalizeModel, type ModelRaw } from '../domain/catalog';
import type { ModelInfo } from '../domain/types';

export { isTextModel, normalizeModel, type ModelRaw };

const BASE = OPENROUTER_BASE_URL;

export async function fetchModels(apiKey?: string): Promise<ModelInfo[]> {
  const response = await fetch(`${BASE}/models`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...openRouterAttribution()
    }
  });
  if (!response.ok) throw new Error(`OpenRouter catalog unavailable (${response.status}).`);
  const json = await response.json() as { data?: ModelRaw[] };
  return (json.data ?? []).map(normalizeModel).filter(isTextModel).sort((a, b) => a.name.localeCompare(b.name));
}

export function formatPricePerMillion(pricePerToken: number): string {
  return `$${(pricePerToken * 1_000_000).toFixed(pricePerToken > 0.00001 ? 2 : 4)}/M`;
}
