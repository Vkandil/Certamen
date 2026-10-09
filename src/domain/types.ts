export interface ModelInfo {
  id: string;
  name: string;
  contextLength: number;
  maxCompletionTokens: number | null;
  pricing: { promptPerToken: number; completionPerToken: number };
  supportedParameters: string[];
  inputModalities: string[];
  outputModalities: string[];
  author: string;
  /** When OpenRouter added the model (ms since epoch), if the catalog provides it. */
  createdAt?: number;
  /** True when the catalog links the model to published weights (Hugging Face). */
  openWeights?: boolean;
}

export interface Contendens {
  slot: string;
  modelId: string;
  label: string;
  temperature?: number;
  maxTokens?: number;
  systemPromptExtra?: string;
  role: 'contendens' | 'arbiter';
}

export interface Quaestio {
  id: string;
  text: string;
  context?: string;
  language: 'auto' | string;
  createdAt: number;
}

export interface CertamenConfig {
  rounds: number;
  anonymize: boolean;
  shufflePerRecipient: boolean;
  revealAfter: boolean;
  determinatio: boolean;
  budgetCapUsd: number;
  perCallTimeoutMs: number;
  maxConcurrency: number;
  minQuorum: number;
  responseWordTarget: number;
  useWordTarget?: boolean;
  seed?: number;
}

export type ResponsioStatus =
  | 'pending'
  | 'streaming'
  | 'done'
  | 'failed'
  | 'timeout'
  | 'aborted'
  | 'truncated'
  | 'filtered';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  model: string;
  messages: ChatMessage[];
  stream: true;
  temperature?: number;
  max_tokens?: number;
  seed?: number;
  response_format?: { type: 'json_object' };
}

export interface Usage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  costUsd: number;
}

export interface CertamenError {
  code: string;
  message: string;
  retryable: boolean;
}

export type StreamEvent =
  | { type: 'delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'usage'; usage: Usage }
  | { type: 'meta'; generationId?: string; provider?: string }
  | { type: 'finish'; reason: string }
  | { type: 'error'; err: CertamenError }
  | { type: 'keepalive' };

export interface Responsio {
  id: string;
  certamenId: string;
  roundIndex: number;
  slot: string;
  modelId: string;
  status: ResponsioStatus;
  raw: string;
  parsed?: {
    objectiones?: Array<{ targetLabel: string; text: string }>;
    concessiones?: Array<{ sourceLabel: string; text: string }>;
    body: string;
  };
  reasoning?: string;
  usage?: Usage;
  generationId?: string;
  provider?: string;
  finishReason?: string;
  error?: CertamenError;
  startedAt: number;
  endedAt?: number;
  requestSnapshot: ChatRequest;
}

export interface Determinatio {
  id: string;
  certamenId: string;
  arbiterModelId: string;
  status: ResponsioStatus;
  raw: string;
  parsed?: {
    consensus: string[];
    dissensus: Array<{ point: string; positions: Array<{ label: string; stance: string }> }>;
    synthesis: string;
    recommendation: string;
    openQuestions: string[];
    orphanedIdeas?: string[];
  };
  usage?: Responsio['usage'];
}

export type CertamenStatus = 'draft' | 'running' | 'completed' | 'partial' | 'aborted' | 'failed';

export interface Certamen {
  id: string;
  quaestio: Quaestio;
  config: CertamenConfig;
  contendentes: Contendens[];
  labelMap: Record<string, string>;
  status: CertamenStatus;
  responsiones: Responsio[];
  determinatio?: Determinatio;
  totalCostUsd: number;
  startedAt: number;
  endedAt?: number;
  appVersion: string;
  specVersion: '1.0';
  promptVersion?: string;
  modelIds?: string[];
  failureReason?: string;
}

export interface LlmClient {
  stream(req: ChatRequest, signal: AbortSignal): AsyncIterable<StreamEvent>;
}

export const DEFAULT_CONFIG: CertamenConfig = {
  rounds: 1,
  anonymize: true,
  shufflePerRecipient: true,
  revealAfter: true,
  determinatio: true,
  budgetCapUsd: 0.5,
  perCallTimeoutMs: 180_000,
  maxConcurrency: 4,
  minQuorum: 2,
  responseWordTarget: 600,
  useWordTarget: true
};
