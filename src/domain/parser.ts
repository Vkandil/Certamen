import type { Determinatio, Responsio } from './types';

export function parseResponsio(raw: string): Responsio['parsed'] | undefined {
  const sections = splitSections(raw);
  if (sections.size === 0) return undefined;
  const revised = sections.get('revised answer') ?? sections.get('responsio revisa');
  const answer = revised ?? sections.get('answer') ?? sections.get('reponse');
  if (!answer) return undefined;
  return {
    body: answer.trim(),
    objectiones: parseLabelBullets(sections.get('objections') ?? sections.get('objectiones') ?? '', 'targetLabel'),
    concessiones: parseLabelBullets(sections.get('concessions') ?? sections.get('concessiones') ?? '', 'sourceLabel')
  };
}

export function parseDetermination(raw: string, orphanedIdeas: string[] = []): Determinatio['parsed'] | undefined {
  const sections = splitSections(raw);
  if (sections.size === 0) return undefined;
  return {
    consensus: toLines(sections.get('consensus') ?? ''),
    dissensus: parseDissensus(sections.get('dissensus') ?? ''),
    synthesis: (sections.get('synthesis') ?? sections.get('synthese') ?? '').trim(),
    recommendation: (sections.get('recommendation') ?? sections.get('recommandation') ?? '').trim(),
    openQuestions: toLines(sections.get('to verify') ?? sections.get('a verifier') ?? ''),
    orphanedIdeas
  };
}

export function orphanedIdeas(initialBodies: string[], finalBodies: string[], threshold = 0.35): string[] {
  const finalText = finalBodies.join('\n\n');
  return initialBodies
    .flatMap((body) => body.split(/\n{2,}|(?<=[.!?])\s+(?=[A-ZÀÂÇÉÈÊÎÔÙÛ])/))
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 80)
    .filter((fragment) => ngramOverlap(fragment, finalText) < threshold)
    .slice(0, 12);
}

function splitSections(raw: string): Map<string, string> {
  const sections = new Map<string, string>();
  const matches = [...raw.matchAll(/^##\s+(.+?)\s*$/gm)];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const next = matches[index + 1];
    if (!match || match.index === undefined || !match[1]) continue;
    const key = normalizeHeading(match[1]);
    const start = match.index + match[0].length;
    const end = next?.index ?? raw.length;
    sections.set(key, raw.slice(start, end).trim());
  }
  return sections;
}

function normalizeHeading(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

function toLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

function parseLabelBullets(text: string, key: 'targetLabel' | 'sourceLabel') {
  return toLines(text).map((line) => {
    const label = line.match(/\b([A-H])\b/)?.[1] ?? '?';
    return { [key]: label, text: line } as { targetLabel: string; text: string } & { sourceLabel: string; text: string };
  });
}

function parseDissensus(text: string): Array<{ point: string; positions: Array<{ label: string; stance: string }> }> {
  return toLines(text).map((line) => ({
    point: line,
    positions: [...line.matchAll(/\b([A-H])\s*[:=-]\s*([^;]+)/g)].map((match) => ({
      label: match[1] ?? '?',
      stance: match[2]?.trim() ?? ''
    }))
  }));
}

function ngramOverlap(a: string, b: string): number {
  const left = ngrams(a);
  const right = ngrams(b);
  if (left.size === 0) return 1;
  let shared = 0;
  for (const item of left) {
    if (right.has(item)) shared += 1;
  }
  return shared / left.size;
}

function ngrams(text: string): Set<string> {
  const words = text.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const grams = new Set<string>();
  for (let i = 0; i < words.length - 2; i += 1) {
    const a = words[i];
    const b = words[i + 1];
    const c = words[i + 2];
    if (a && b && c) grams.add(`${a} ${b} ${c}`);
  }
  return grams;
}
