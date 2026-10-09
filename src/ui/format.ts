const LAB_NAMES: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  'x-ai': 'xAI',
  deepseek: 'DeepSeek',
  moonshotai: 'Moonshot',
  qwen: 'Qwen',
  mistralai: 'Mistral',
  'z-ai': 'Z.ai',
  'meta-llama': 'Meta'
};

/** Display name of an OpenRouter author slug. */
export function labName(author: string): string {
  return LAB_NAMES[author] ?? author;
}

/** Small USD amounts: two decimals, three below one cent. */
export function formatUsd(value: number): string {
  return value >= 0.01 ? value.toFixed(2) : value.toFixed(3);
}
