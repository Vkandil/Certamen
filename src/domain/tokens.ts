import type { ChatMessage } from './types';

export function estimateTokens(text: string): number {
  return Math.ceil((text.length / 3.6) * 1.15);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
  return messages.reduce((sum, msg) => sum + estimateTokens(`${msg.role}: ${msg.content}`), 0);
}

export function countWords(text: string): number {
  const matches = text.trim().match(/\S+/g);
  return matches?.length ?? 0;
}

export function truncateToTokenBudget(text: string, tokenBudget: number): string {
  if (estimateTokens(text) <= tokenBudget) return text;
  const charBudget = Math.max(0, Math.floor((tokenBudget / 1.15) * 3.6));
  const candidate = text.slice(0, charBudget);
  const paragraphBoundary = Math.max(candidate.lastIndexOf('\n\n'), candidate.lastIndexOf('\n'));
  const cut = paragraphBoundary > 160 ? candidate.slice(0, paragraphBoundary) : candidate;
  return `${cut.trimEnd()}\n\n[...tronque...]`;
}
