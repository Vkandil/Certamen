import type { CertamenError } from '../domain/types';

export class OpenRouterError extends Error {
  readonly certamenError: CertamenError;
  readonly status?: number;
  readonly retryAfterMs?: number;

  constructor(error: CertamenError, status?: number, retryAfterMs?: number) {
    super(error.message);
    this.name = 'OpenRouterError';
    this.certamenError = error;
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

export function errorFromStatus(status: number, message: string): CertamenError {
  if (status === 401) return { code: '401', message: 'Cle invalide ou revoquee.', retryable: false };
  if (status === 402) return { code: '402', message: 'Credits OpenRouter insuffisants.', retryable: false };
  if (status === 408) return { code: '408', message, retryable: true };
  if (status === 429) return { code: '429', message: 'Rate limit OpenRouter.', retryable: true };
  if (status === 502) return { code: '502', message: 'Erreur fournisseur.', retryable: true };
  if (status === 503) return { code: '503', message: 'Aucun fournisseur disponible.', retryable: true };
  return { code: String(status), message, retryable: false };
}

export function retryCountForStatus(status?: number): number {
  if (status === 408) return 1;
  if (status === 429) return 3;
  if (status === 502 || status === 503) return 2;
  return 0;
}

export function retryDelay(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs !== undefined) return retryAfterMs;
  const base = Math.min(30_000, 1000 * 2 ** attempt);
  return base + Math.floor(Math.random() * 400);
}

export function isCorsLike(error: unknown): boolean {
  return error instanceof TypeError && /fetch|network|failed|cors/i.test(error.message);
}
