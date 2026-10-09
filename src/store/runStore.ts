import { create } from 'zustand';
import { fetchModels } from '../api/models';
import { OpenRouterClient } from '../api/openrouter';
import { assignLabels, buildDenylist } from '../domain/anonymizer';
import { estimateCost, type CostEstimate } from '../domain/budget';
import { recordUsage, type FeaturedOverlay, type UsageStats } from '../domain/lineup';
import { retryFailed, runCertamen } from '../domain/protocol';
import { DEFAULT_CONFIG, type Certamen, type CertamenConfig, type Contendens, type ModelInfo } from '../domain/types';
import { db } from './db';
import { fetchFeatured, loadUsage, saveUsage } from './prefs';

/** Cached catalog is shown instantly; it is refreshed in the background once older than this. */
const CATALOG_REFRESH_MS = 30 * 60 * 1000;

interface RunState {
  models: ModelInfo[];
  modelsError?: string;
  modelsLoading: boolean;
  modelsFetchedAt?: number;
  featured?: FeaturedOverlay;
  usage: UsageStats;
  current?: Certamen;
  history: Certamen[];
  running: boolean;
  estimate?: CostEstimate;
  abortController?: AbortController;
  loadModels: (apiKey?: string, force?: boolean) => Promise<void>;
  loadLineupData: () => Promise<void>;
  retry: (apiKey: string) => Promise<void>;
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
  usage: {},
  history: [],
  running: false,
  async loadModels(apiKey, force = false) {
    // Stale-while-revalidate: show the cached catalog at once, refresh it in the background,
    // so a model released this morning is listed without waiting for a 24 h cache to expire.
    set({ modelsError: undefined });
    const cached = await db.modelsCache.get('openrouter_models').catch(() => undefined);
    if (cached && get().models.length === 0) set({ models: cached.models, modelsFetchedAt: cached.fetchedAt });
    const fresh = cached && Date.now() - cached.fetchedAt < CATALOG_REFRESH_MS;
    if (!force && fresh) return;
    set({ modelsLoading: get().models.length === 0 });
    try {
      const models = await fetchModels(apiKey);
      const fetchedAt = Date.now();
      await db.modelsCache.put({ key: 'openrouter_models', models, fetchedAt });
      set({ models, modelsFetchedAt: fetchedAt, modelsLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set({ modelsError: message, modelsLoading: false });
    }
  },
  async loadLineupData() {
    const [featured, usage] = await Promise.all([fetchFeatured(import.meta.env.BASE_URL ?? '/'), loadUsage().catch(() => ({}))]);
    set({ featured, usage });
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
    const usage = recordUsage(get().usage, certamen.contendentes.filter((item) => item.role === 'contendens').map((item) => item.modelId));
    set({ usage });
    void saveUsage(usage).catch(() => undefined);
    const abortController = new AbortController();
    set({ running: true, abortController, current: certamen });
    const client = new OpenRouterClient(apiKey);
    const models = get().models;
    const denylist = buildDenylist(models);
    const hooks = storeHooks(set);
    try {
      const final = await runCertamen(certamen, client, hooks, { models, denylist, signal: abortController.signal });
      set({ current: { ...final }, running: false, abortController: undefined });
      await get().loadHistory();
    } finally {
      set({ running: false, abortController: undefined });
    }
  },
  async retry(apiKey) {
    const certamen = get().current;
    if (!certamen || get().running) return;
    const abortController = new AbortController();
    set({ running: true, abortController });
    const models = get().models;
    const base = storeHooks(set);
    let replacedVerdict = false;
    const hooks = {
      ...base,
      // a new verdict replaces the stored one; the old one is kept if the arbiter does not run again
      onDeterminatio: async (determinatio: NonNullable<Certamen['determinatio']>) => {
        if (!replacedVerdict) {
          replacedVerdict = true;
          await db.determinationes.where('certamenId').equals(certamen.id).filter((item) => item.id !== determinatio.id).delete();
        }
        await base.onDeterminatio(determinatio);
      }
    };
    const working: Certamen = { ...certamen, responsiones: [...certamen.responsiones] };
    try {
      const final = await retryFailed(working, new OpenRouterClient(apiKey), hooks, { models, denylist: buildDenylist(models), signal: abortController.signal });
      set({ current: { ...final } });
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

type SetRunState = (partial: Partial<RunState> | ((state: RunState) => Partial<RunState>)) => void;

/** Persists every protocol event to IndexedDB and mirrors it into the store. */
function storeHooks(set: SetRunState) {
  return {
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
      set((state) => (state.current ? { current: { ...state.current, determinatio } } : {}));
    }
  };
}
