// Normalizes raw OpenRouter catalog entries. Kept free of runtime imports so
// scripts/update-featured.mjs can load it with Node's TypeScript type stripping.
import type { ModelInfo } from './types';

export interface ModelRaw {
  id: string;
  name?: string;
  created?: number;
  hugging_face_id?: string | null;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  supported_parameters?: string[];
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
  top_provider?: { max_completion_tokens?: number | null; context_length?: number };
}

export function normalizeModel(raw: ModelRaw): ModelInfo {
  const inputModalities = raw.architecture?.input_modalities ?? ['text'];
  const outputModalities = raw.architecture?.output_modalities ?? ['text'];
  const model: ModelInfo = {
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
    author: raw.id.replace(/^~/, '').split('/')[0] ?? 'unknown'
  };
  // OpenRouter reports `created` in seconds since epoch.
  if (typeof raw.created === 'number' && raw.created > 0) model.createdAt = raw.created * 1000;
  if (raw.hugging_face_id) model.openWeights = true;
  return model;
}

export function isTextModel(model: ModelInfo): boolean {
  return model.inputModalities.includes('text') && model.outputModalities.includes('text');
}
