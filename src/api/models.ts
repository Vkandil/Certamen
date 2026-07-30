import { OPENROUTER_BASE_URL, openRouterAttribution } from './attribution';
import type { ModelInfo } from '../domain/types';

export interface ModelRaw {
  id: string;
  name?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  top_provider?: { max_completion_tokens?: number | null; context_length?: number };
}

const BASE = OPENROUTER_BASE_URL;

export async function fetchModels(apiKey?: string): Promise<ModelInfo[]> {
  const response = await fetch(`${BASE}/models`, {
    headers: {
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...openRouterAttribution()
    }
  });
  if (!response.ok) throw new Error(`Catalogue OpenRouter indisponible (${response.status}).`);
  const json = await response.json() as { data?: ModelRaw[] };
  return (json.data ?? []).map(normalizeModel).filter(isTextModel).sort((a, b) => a.name.localeCompare(b.name));
}

export function normalizeModel(raw: ModelRaw): ModelInfo {
  const inputModalities = raw.architecture?.input_modalities ?? ['text'];
  const outputModalities = raw.architecture?.output_modalities ?? ['text'];
  return {
    id: raw.id,
    name: raw.name ?? raw.id,
    contextLength: raw.top_provider?.context_length ?? raw.context_length ?? 8192,
    maxCompletionTokens: raw.top_provider?.max_completion_tokens ?? null,
    pricing: {
      promptPerToken: Number(raw.pricing?.prompt ?? 0),
      completionPerToken: Number(raw.pricing?.completion ?? 0)
    },
    supportedParameters: raw.supported_parameters ?? [],
    inputModalities,
    outputModalities,
    author: raw.id.split('/')[0] ?? 'unknown'
  };
}

export function isTextModel(model: ModelInfo): boolean {
  return model.inputModalities.includes('text') && model.outputModalities.includes('text');
}

export function formatPricePerMillion(pricePerToken: number): string {
  return `$${(pricePerToken * 1_000_000).toFixed(pricePerToken > 0.00001 ? 2 : 4)}/M`;
}
