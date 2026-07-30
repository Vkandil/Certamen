const OPENROUTER_KEY = /\bsk-or-[A-Za-z0-9_-]+\b/g;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/g;

export function redactSecrets(text: string): string {
  return text
    .replace(OPENROUTER_KEY, '[redacted-openrouter-key]')
    .replace(BEARER_TOKEN, 'Bearer [redacted-token]');
}
