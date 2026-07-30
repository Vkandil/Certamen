import { create } from 'zustand';
import { fetchModels } from '../api/models';
import { OpenRouterClient } from '../api/openrouter';
import { assignLabels, buildDenylist } from '../domain/anonymizer';
import { estimateCost, type CostEstimate } from '../domain/budget';
import { runCertamen } from '../domain/protocol';
import { DEFAULT_CONFIG, type Certamen, type CertamenConfig, type Contendens, type ModelInfo } from '../domain/types';
import { db } from './db';

interface RunState {
  models: ModelInfo[];
  modelsError?: string;
  modelsLoading: boolean;
  current?: Certamen;
  history: Certamen[];
  running: boolean;
  estimate?: CostEstimate;
  abortController?: AbortController;
  loadModels: (apiKey?: string, force?: boolean) => Promise<void>;
  loadHistory: () => Promise<void>;
  createDraft: (input: DraftInput) => Certamen;
  run: (apiKey: string, certamen: Certamen) => Promise<void>;
  abort: () => void;
  setCurrent: (id: string) => Promise<void>;
}

export interface DraftInput {
  text: string;
  context?: string;
  language: 'auto' | string;
  selected: Array<{ modelId: string; temperature?: number; systemPromptExtra?: string }>;
  arbiterModelId?: string;
  config?: Partial<CertamenConfig>;
}

export const useRunStore = create<RunState>((set, get) => ({
  models: [],
  modelsLoading: false,
  history: [],
  running: false,
  async loadModels(apiKey, force = false) {
    set({ modelsLoading: true, modelsError: undefined });
    try {
      const cached = await db.modelsCache.get('openrouter_models');
      if (!force && cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
        set({ models: cached.models, modelsLoading: false });
        return;
      }
      const models = await fetchModels(apiKey);
      await db.modelsCache.put({ key: 'openrouter_models', models, fetchedAt: Date.now() });
      set({ models, modelsLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (get().models.length === 0) set({ models: fallbackModels() });
      set({ modelsError: message, modelsLoading: false });
    }
  },
  async loadHistory() {
    const history = await db.certamens.orderBy('startedAt').reverse().toArray();
    set({ history });
  },
  createDraft(input) {
    const contenders: Contendens[] = input.selected.map((item) => ({
      slot: randomId('slot'),
      modelId: item.modelId,
      label: '',
      temperature: item.temperature ?? 0.7,
      systemPromptExtra: item.systemPromptExtra,
      role: 'contendens'
    }));
    const selectedIds = new Set(input.selected.map((item) => item.modelId));
    const arbiterModelId = input.arbiterModelId ?? get().models.find((model) => !selectedIds.has(model.id))?.id ?? input.selected[0]?.modelId ?? '';
    const arbiter: Contendens = {
      slot: randomId('arbiter'),
      modelId: arbiterModelId,
      label: 'ARB',
      role: 'arbiter',
      temperature: 0.3
    };
    const labelMap = assignLabels(contenders);
    const certamen: Certamen = {
      id: randomId('certamen'),
      quaestio: {
        id: randomId('quaestio'),
        text: input.text,
        context: input.context,
        language: input.language,
        createdAt: Date.now()
      },
      config: { ...DEFAULT_CONFIG, ...input.config },
      contendentes: [...contenders.map((item) => ({ ...item, label: labelMap[item.slot] ?? '?' })), arbiter],
      labelMap,
      status: 'draft',
      responsiones: [],
      totalCostUsd: 0,
      startedAt: Date.now(),
      appVersion: '0.0.0',
      specVersion: '1.0',
      modelIds: contenders.map((item) => item.modelId)
    };
    const estimate = estimateCost(certamen, get().models);
    set({ current: certamen, estimate });
    void db.certamens.put(certamen);
    return certamen;
  },
  async run(apiKey, certamen) {
    const abortController = new AbortController();
    set({ running: true, abortController, current: certamen });
    const client = new OpenRouterClient(apiKey);
    const models = get().models;
    const denylist = buildDenylist(models);
    const hooks = {
      onCertamen: async (next: Certamen) => {
        await db.certamens.put({ ...next, modelIds: next.contendentes.map((item) => item.modelId) });
        set({ current: { ...next } });
      },
      onResponsio: async (responsio: Certamen['responsiones'][number]) => {
        await db.responsiones.put(responsio);
        set((state) => {
          const current = state.current;
          if (!current) return {};
          const responsiones = [...current.responsiones.filter((item) => item.id !== responsio.id), responsio];
          return { current: { ...current, responsiones } };
        });
      },
      onDeterminatio: async (determinatio: NonNullable<Certamen['determinatio']>) => {
        await db.determinationes.put(determinatio);
        set((state) => state.current ? { current: { ...state.current, determinatio } } : {});
      }
    };
    try {
      const final = await runCertamen(certamen, client, hooks, { models, denylist, signal: abortController.signal });
      set({ current: { ...final }, running: false, abortController: undefined });
      await get().loadHistory();
    } finally {
      set({ running: false, abortController: undefined });
    }
  },
  abort() {
    get().abortController?.abort();
  },
  async setCurrent(id) {
    const certamen = await db.certamens.get(id);
    if (!certamen) return;
    const responsiones = await db.responsiones.where('certamenId').equals(id).toArray();
    const determinatio = await db.determinationes.where('certamenId').equals(id).first();
    set({ current: { ...certamen, responsiones, determinatio } });
  }
}));

function randomId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function fallbackModels(): ModelInfo[] {
  return [
    {
      id: 'openai/gpt-4o-mini',
      name: 'GPT-4o mini',
      author: 'openai',
      contextLength: 128000,
      maxCompletionTokens: 16384,
      pricing: { promptPerToken: 0.00000015, completionPerToken: 0.0000006 },
      supportedParameters: ['temperature', 'max_tokens', 'seed'],
      inputModalities: ['text'],
      outputModalities: ['text']
    },
    {
      id: 'anthropic/claude-3.5-haiku',
      name: 'Claude 3.5 Haiku',
      author: 'anthropic',
      contextLength: 200000,
      maxCompletionTokens: 8192,
      pricing: { promptPerToken: 0.0000008, completionPerToken: 0.000004 },
      supportedParameters: ['temperature', 'max_tokens'],
      inputModalities: ['text'],
      outputModalities: ['text']
    },
    {
      id: 'mistralai/mistral-small',
      name: 'Mistral Small',
      author: 'mistralai',
      contextLength: 32000,
      maxCompletionTokens: 8192,
      pricing: { promptPerToken: 0.0000002, completionPerToken: 0.0000006 },
      supportedParameters: ['temperature', 'max_tokens'],
      inputModalities: ['text'],
      outputModalities: ['text']
    }
  ];
}
