export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
export const APP_TITLE = 'Certamen';

export function openRouterAttribution(): Record<string, string> {
  return {
    'HTTP-Referer': appOrigin(),
    'X-Title': APP_TITLE
  };
}

function appOrigin(): string {
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return 'https://github.com/certamen-app/certamen';
}
