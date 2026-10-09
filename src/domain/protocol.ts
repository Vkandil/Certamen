import pLimit from 'p-limit';
import { renderConcurrentes } from './anonymizer';
import { BudgetGuard, computeMaxTokens, effectiveWordTarget, ensureContextFits } from './budget';
import { detectLanguage, PROMPT_VERSION, renderQuaestio, systemDeterminatio, systemDisputatio, systemResponsio } from './prompts';
import { orphanedIdeas, parseDetermination, parseResponsio } from './parser';
import type { Certamen, ChatMessage, ChatRequest, Contendens, Determinatio, LlmClient, ModelInfo, Responsio, ResponsioStatus, Usage } from './types';

export interface ProtocolHooks {
  onCertamen?: (certamen: Certamen) => void | Promise<void>;
  onResponsio?: (responsio: Responsio) => void | Promise<void>;
  onDeterminatio?: (determinatio: Determinatio) => void | Promise<void>;
  onBudgetExceeded?: (spent: number, cap: number) => void;
}

export interface RunOptions {
  models: ModelInfo[];
  denylist: string[];
  signal?: AbortSignal;
}

export async function runCertamen(certamen: Certamen, client: LlmClient, hooks: ProtocolHooks, options: RunOptions): Promise<Certamen> {
  certamen.status = 'running';
  certamen.promptVersion = PROMPT_VERSION;
  certamen.modelIds = certamen.contendentes.map((item) => item.modelId);
  await hooks.onCertamen?.(certamen);

  const limit = pLimit(certamen.config.maxConcurrency);
  const budget = new BudgetGuard(certamen.config.budgetCapUsd, hooks.onBudgetExceeded);
  const contenders = certamen.contendentes.filter((item) => item.role === 'contendens');

  let active = await runRound(certamen, contenders, 0, [], client, budget, hooks, options, limit);
  if (succeeded(active).length < certamen.config.minQuorum) {
    return finalize(certamen, 'failed', 'quorum_not_met', hooks);
  }

  for (let round = 1; round <= certamen.config.rounds; round += 1) {
    if (budget.exhausted || options.signal?.aborted) break;
    const previous = succeeded(active);
    const current = await runRound(certamen, previous.map((responsio) => contenderBySlot(certamen, responsio.slot)).filter(isContendens), round, previous, client, budget, hooks, options, limit);
    active = mergeKeepingLastValid(previous, current);
    if (succeeded(active).length < certamen.config.minQuorum) break;
  }

  const ok = succeeded(active);
  if (certamen.config.determinatio && ok.length >= certamen.config.minQuorum && !budget.exhausted && !options.signal?.aborted) {
    await runDeterminatio(certamen, ok, client, budget, hooks, options);
  }

  const finalStatus = options.signal?.aborted ? 'aborted' : (ok.length < certamen.config.minQuorum || budget.exhausted || hasFailures(certamen) ? 'partial' : 'completed');
  return finalize(certamen, finalStatus, budget.exhausted ? 'budget_exceeded' : undefined, hooks);
}

/** Slots whose latest answer failed (timeout, provider error...), i.e. what a retry would re-run. */
export function retryableSlots(certamen: Certamen): string[] {
  const latest = latestBySlot(certamen.responsiones);
  return certamen.contendentes
    .filter((item) => item.role === 'contendens')
    .map((item) => item.slot)
    .filter((slot) => {
      const responsio = latest.get(slot);
      return !responsio || succeeded([responsio]).length === 0;
    });
}

/** True when a finished run has failed answers or no usable verdict. */
export function canRetry(certamen: Certamen): boolean {
  if (!['completed', 'partial', 'failed', 'aborted'].includes(certamen.status)) return false;
  const verdictMissing = certamen.config.determinatio && (!certamen.determinatio || certamen.determinatio.status !== 'done');
  return retryableSlots(certamen).length > 0 || verdictMissing;
}

/**
 * Re-runs only the failed answers (each in the round where it failed, with the same peer
 * answers it would have seen), then re-runs the arbiter on the best answer of every slot.
 * The spend so far counts against the budget cap.
 */
export async function retryFailed(certamen: Certamen, client: LlmClient, hooks: ProtocolHooks, options: RunOptions): Promise<Certamen> {
  certamen.status = 'running';
  certamen.failureReason = undefined;
  await hooks.onCertamen?.(certamen);
  const limit = pLimit(certamen.config.maxConcurrency);
  const budget = new BudgetGuard(Math.max(0, certamen.config.budgetCapUsd - certamen.totalCostUsd), hooks.onBudgetExceeded);
  const latest = latestBySlot(certamen.responsiones);
  const tasks = retryableSlots(certamen).map((slot) => limit(async () => {
    const contendens = contenderBySlot(certamen, slot);
    if (!contendens || !budget.canStartCall() || options.signal?.aborted) return;
    const roundIndex = latest.get(slot)?.roundIndex ?? 0;
    const previous = roundIndex > 0 ? succeeded([...latestBySlot(certamen.responsiones.filter((item) => item.roundIndex === roundIndex - 1)).values()]) : [];
    const responsio = await runOne(certamen, contendens, roundIndex, previous, client, budget, hooks, options);
    certamen.responsiones = [...certamen.responsiones.filter((item) => item.id !== responsio.id), responsio];
    await hooks.onCertamen?.(certamen);
  }));
  await Promise.allSettled(tasks);

  const ok = succeeded([...bestBySlot(certamen.responsiones).values()]);
  if (certamen.config.determinatio && ok.length >= certamen.config.minQuorum && !budget.exhausted && !options.signal?.aborted) {
    await runDeterminatio(certamen, ok, client, budget, hooks, options);
  }
  const verdictOk = !certamen.config.determinatio || certamen.determinatio?.status === 'done';
  const status = options.signal?.aborted ? 'aborted' : ok.length < certamen.config.minQuorum ? 'failed' : retryableSlots(certamen).length === 0 && verdictOk ? 'completed' : 'partial';
  return finalize(certamen, status, budget.exhausted ? 'budget_exceeded' : ok.length < certamen.config.minQuorum ? 'quorum_not_met' : undefined, hooks);
}

export function buildChatRequest(model: ModelInfo | undefined, contendens: Contendens, messages: ChatMessage[], certamen: Certamen): ChatRequest {
  const supported = new Set(model?.supportedParameters ?? []);
  const request: ChatRequest = {
    model: contendens.modelId,
    messages,
    stream: true
  };
  if (supported.has('temperature')) request.temperature = contendens.temperature ?? 0.7;
  if (supported.has('max_tokens')) request.max_tokens = computeMaxTokens(model, effectiveWordTarget(certamen.config.responseWordTarget, certamen.config.useWordTarget), contendens.maxTokens);
  if (supported.has('seed') && certamen.config.seed !== undefined) request.seed = certamen.config.seed;
  return request;
}

async function runRound(
  certamen: Certamen,
  contenders: Contendens[],
  roundIndex: number,
  previous: Responsio[],
  client: LlmClient,
  budget: BudgetGuard,
  hooks: ProtocolHooks,
  options: RunOptions,
  limit: ReturnType<typeof pLimit>
): Promise<Responsio[]> {
  const tasks = contenders.map((contendens) => limit(async () => {
    if (!budget.canStartCall()) return failedSkeleton(certamen, contendens, roundIndex, 'budget_exceeded', 'Budget depasse.');
    if (options.signal?.aborted) return failedSkeleton(certamen, contendens, roundIndex, 'aborted', 'Annule.');
    const responsio = await runOne(certamen, contendens, roundIndex, previous, client, budget, hooks, options);
    certamen.responsiones = [...certamen.responsiones.filter((item) => item.id !== responsio.id), responsio];
    await hooks.onCertamen?.(certamen);
    return responsio;
  }));
  const settled = await Promise.allSettled(tasks);
  return settled.map((result, index) => {
    if (result.status === 'fulfilled') return result.value;
    const contendens = contenders[index];
    if (!contendens) throw result.reason;
    return failedSkeleton(certamen, contendens, roundIndex, 'exception', String(result.reason));
  });
}

async function runOne(
  certamen: Certamen,
  contendens: Contendens,
  roundIndex: number,
  previous: Responsio[],
  client: LlmClient,
  budget: BudgetGuard,
  hooks: ProtocolHooks,
  options: RunOptions
): Promise<Responsio> {
  const model = options.models.find((item) => item.id === contendens.modelId);
  const language = detectLanguage(certamen.quaestio);
  const messages = buildMessages(certamen, contendens, roundIndex, previous, options.denylist, language);
  const request = buildChatRequest(model, contendens, messages, certamen);
  if (model && request.max_tokens) {
    const context = ensureContextFits(request.messages, request.max_tokens, model);
    if (!context.ok) return failedSkeleton(certamen, contendens, roundIndex, 'context_too_small', 'Fenetre de contexte insuffisante.', request);
    request.max_tokens = context.maxTokens;
  }

  const controller = new AbortController();
  const timeout = windowSafeSetTimeout(() => controller.abort(), certamen.config.perCallTimeoutMs);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const startedAt = Date.now();
  const responsio: Responsio = {
    id: randomId('resp'),
    certamenId: certamen.id,
    roundIndex,
    slot: contendens.slot,
    modelId: contendens.modelId,
    status: 'pending',
    raw: '',
    startedAt,
    requestSnapshot: request
  };
  await hooks.onResponsio?.(responsio);

  try {
    for await (const event of client.stream(request, controller.signal)) {
      if (event.type === 'keepalive') {
        if (!responsio.raw) responsio.status = 'pending';
      } else if (event.type === 'delta') {
        responsio.status = 'streaming';
        responsio.raw += event.text;
      } else if (event.type === 'reasoning') {
        responsio.reasoning = `${responsio.reasoning ?? ''}${event.text}`;
      } else if (event.type === 'usage') {
        responsio.usage = event.usage;
        budget.addUsage(event.usage);
      } else if (event.type === 'meta') {
        responsio.generationId = event.generationId ?? responsio.generationId;
        responsio.provider = event.provider ?? responsio.provider;
      } else if (event.type === 'finish') {
        responsio.finishReason = event.reason;
      } else if (event.type === 'error') {
        responsio.status = 'failed';
        responsio.error = event.err;
      }
      await hooks.onResponsio?.(responsio);
    }
    if (responsio.status !== 'failed') responsio.status = mapFinishReason(responsio.finishReason);
  } catch (error) {
    responsio.status = controller.signal.aborted ? (options.signal?.aborted ? 'aborted' : 'timeout') : 'failed';
    responsio.error = { code: responsio.status, message: error instanceof Error ? error.message : String(error), retryable: responsio.status === 'timeout' };
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }

  responsio.endedAt = Date.now();
  responsio.parsed = parseResponsio(responsio.raw);
  certamen.totalCostUsd = totalCost(certamen.responsiones, responsio.usage);
  await hooks.onResponsio?.(responsio);
  return responsio;
}

async function runDeterminatio(certamen: Certamen, finalResponsiones: Responsio[], client: LlmClient, budget: BudgetGuard, hooks: ProtocolHooks, options: RunOptions): Promise<void> {
  const arbiter = certamen.contendentes.find((item) => item.role === 'arbiter') ?? certamen.contendentes.find((item) => item.role === 'contendens');
  if (!arbiter || !budget.canStartCall()) return;
  const model = options.models.find((item) => item.id === arbiter.modelId);
  const language = detectLanguage(certamen.quaestio);
  const initialBodies = certamen.responsiones.filter((item) => item.roundIndex === 0).map((item) => item.parsed?.body ?? item.raw);
  const finalBodies = finalResponsiones.map((item) => item.parsed?.body ?? item.raw);
  const lost = orphanedIdeas(initialBodies, finalBodies);
  const messages: ChatMessage[] = [
    { role: 'system', content: systemDeterminatio(language) },
    { role: 'user', content: renderQuaestio(certamen.quaestio) },
    {
      role: 'user',
      content: [
        '<responsiones_finales>',
        ...finalResponsiones.map((item) => `<responsio label="${certamen.labelMap[item.slot] ?? '?'}">\n${item.parsed?.body ?? item.raw}\n</responsio>`),
        '</responsiones_finales>',
        '<idees_perdues_heuristique>',
        ...lost.map((idea) => `<idee>${idea.replaceAll('</idee>', '&lt;/idee&gt;')}</idee>`),
        '</idees_perdues_heuristique>'
      ].join('\n')
    }
  ];
  const request = buildChatRequest(model, { ...arbiter, role: 'arbiter' }, messages, certamen);
  const controller = new AbortController();
  const timeout = windowSafeSetTimeout(() => controller.abort(), certamen.config.perCallTimeoutMs);
  options.signal?.addEventListener('abort', () => controller.abort(), { once: true });
  const determinatio: Determinatio = {
    id: randomId('det'),
    certamenId: certamen.id,
    arbiterModelId: arbiter.modelId,
    status: 'pending',
    raw: ''
  };
  await hooks.onDeterminatio?.(determinatio);

  try {
    for await (const event of client.stream(request, controller.signal)) {
      if (event.type === 'delta') {
        determinatio.status = 'streaming';
        determinatio.raw += event.text;
      } else if (event.type === 'usage') {
        determinatio.usage = event.usage;
        budget.addUsage(event.usage);
      } else if (event.type === 'finish') {
        determinatio.status = mapFinishReason(event.reason);
      } else if (event.type === 'error') {
        determinatio.status = 'failed';
      }
      await hooks.onDeterminatio?.(determinatio);
    }
    if (determinatio.status === 'streaming' || determinatio.status === 'pending') determinatio.status = 'done';
  } catch {
    determinatio.status = controller.signal.aborted ? 'timeout' : 'failed';
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
  }
  determinatio.parsed = parseDetermination(determinatio.raw, lost);
  certamen.determinatio = determinatio;
  certamen.totalCostUsd = totalCost(certamen.responsiones, determinatio.usage);
  await hooks.onDeterminatio?.(determinatio);
  await hooks.onCertamen?.(certamen);
}

function buildMessages(certamen: Certamen, contendens: Contendens, roundIndex: number, previous: Responsio[], denylist: string[], language: string): ChatMessage[] {
  if (roundIndex === 0) {
    return [
      { role: 'system', content: systemResponsio(certamen.config, language, contendens.systemPromptExtra) },
      { role: 'user', content: renderQuaestio(certamen.quaestio) }
    ];
  }
  const own = previous.find((item) => item.slot === contendens.slot);
  return [
    { role: 'system', content: systemDisputatio(certamen.config, language, contendens.systemPromptExtra) },
    { role: 'user', content: renderQuaestio(certamen.quaestio) },
    { role: 'assistant', content: own?.parsed?.body ?? own?.raw ?? '' },
    { role: 'user', content: renderConcurrentes(certamen, contendens.slot, previous, denylist) }
  ];
}

function failedSkeleton(certamen: Certamen, contendens: Contendens, roundIndex: number, code: string, message: string, requestSnapshot?: ChatRequest): Responsio {
  return {
    id: randomId('resp'),
    certamenId: certamen.id,
    roundIndex,
    slot: contendens.slot,
    modelId: contendens.modelId,
    status: code === 'aborted' ? 'aborted' : 'failed',
    raw: '',
    error: { code, message, retryable: false },
    startedAt: Date.now(),
    endedAt: Date.now(),
    requestSnapshot: requestSnapshot ?? { model: contendens.modelId, messages: [], stream: true }
  };
}

/** Latest answer per slot (highest round, then most recent attempt). */
function latestBySlot(responsiones: Responsio[]): Map<string, Responsio> {
  const map = new Map<string, Responsio>();
  for (const item of responsiones) {
    const previous = map.get(item.slot);
    if (!previous || item.roundIndex > previous.roundIndex || (item.roundIndex === previous.roundIndex && item.startedAt >= previous.startedAt)) map.set(item.slot, item);
  }
  return map;
}

/** Most advanced usable answer per slot, falling back to the latest attempt. */
function bestBySlot(responsiones: Responsio[]): Map<string, Responsio> {
  const usable = latestBySlot(succeeded(responsiones));
  const latest = latestBySlot(responsiones);
  return new Map([...latest].map(([slot, item]) => [slot, usable.get(slot) ?? item]));
}

function succeeded(responsiones: Responsio[]): Responsio[] {
  return responsiones.filter((item) => item.status === 'done' || item.status === 'truncated' || (item.status === 'failed' && item.raw.length > 200));
}

function mergeKeepingLastValid(previous: Responsio[], current: Responsio[]): Responsio[] {
  const nextBySlot = new Map(current.map((item) => [item.slot, item]));
  return previous.map((old) => {
    const next = nextBySlot.get(old.slot);
    return next && succeeded([next]).length > 0 ? next : old;
  });
}

function contenderBySlot(certamen: Certamen, slot: string): Contendens | undefined {
  return certamen.contendentes.find((item) => item.slot === slot);
}

function isContendens(input: Contendens | undefined): input is Contendens {
  return input !== undefined;
}

function hasFailures(certamen: Certamen): boolean {
  return certamen.responsiones.some((item) => ['failed', 'timeout', 'aborted', 'filtered'].includes(item.status));
}

function mapFinishReason(reason?: string): ResponsioStatus {
  if (reason === 'length') return 'truncated';
  if (reason === 'content_filter') return 'filtered';
  return 'done';
}

function totalCost(responsiones: Responsio[], extra?: Usage): number {
  return responsiones.reduce((sum, item) => sum + (item.usage?.costUsd ?? 0), extra?.costUsd ?? 0);
}

async function finalize(certamen: Certamen, status: Certamen['status'], reason: string | undefined, hooks: ProtocolHooks): Promise<Certamen> {
  certamen.status = status;
  certamen.endedAt = Date.now();
  certamen.failureReason = reason;
  await hooks.onCertamen?.(certamen);
  return certamen;
}

function randomId(prefix: string): string {
  if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function windowSafeSetTimeout(handler: () => void, timeoutMs: number): ReturnType<typeof setTimeout> | undefined {
  if (timeoutMs <= 0) return undefined;
  return setTimeout(handler, timeoutMs);
}
