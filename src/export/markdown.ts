import type { Certamen } from '../domain/types';
import { redactSecrets } from './redact';

export function exportMarkdown(certamen: Certamen, reveal = true): string {
  const title = truncate(certamen.quaestio.text.replace(/\s+/g, ' '), 80);
  const lines = [
    `# Certamen - ${title}`,
    `${new Date(certamen.startedAt).toLocaleString()} · ${certamen.contendentes.filter((item) => item.role === 'contendens').length} contendentes · ${certamen.config.rounds} round(s) · cout reel ${certamen.totalCostUsd.toFixed(4)} $`,
    '',
    '## Quaestio',
    certamen.quaestio.text,
    certamen.quaestio.context ? `\n### Contextus\n${certamen.quaestio.context}` : '',
    '',
    '## Determinatio',
    '### Recommandation',
    certamen.determinatio?.parsed?.recommendation ?? '',
    '### Synthese',
    certamen.determinatio?.parsed?.synthesis ?? certamen.determinatio?.raw ?? '',
    '### Dissensus',
    ...(certamen.determinatio?.parsed?.dissensus.map((item) => `- ${item.point}`) ?? []),
    '### Consensus',
    ...(certamen.determinatio?.parsed?.consensus.map((item) => `- ${item}`) ?? []),
    '### A verifier',
    ...(certamen.determinatio?.parsed?.openQuestions.map((item) => `- ${item}`) ?? []),
    '',
    '## Idees perdues en route',
    ...(certamen.determinatio?.parsed?.orphanedIdeas?.map((item) => `- ${item}`) ?? ['- Aucune idee detectee par l heuristique.']),
    '',
    '## Responsiones',
    ...certamen.contendentes.filter((item) => item.role === 'contendens').flatMap((contendens) => {
      const label = certamen.labelMap[contendens.slot] ?? contendens.label;
      const model = reveal ? ` - ${contendens.modelId}` : '';
      const items = certamen.responsiones.filter((item) => item.slot === contendens.slot).sort((a, b) => a.roundIndex - b.roundIndex);
      return [
        `### ${label}${model}`,
        ...items.flatMap((responsio) => [
          `#### ${responsio.roundIndex === 0 ? 'Initiale' : 'Revisee'} (${responsio.status})`,
          responsio.parsed?.body ?? responsio.raw,
          responsio.parsed?.objectiones?.length ? '#### Objectiones' : '',
          ...(responsio.parsed?.objectiones?.map((item) => `- ${item.targetLabel}: ${item.text}`) ?? []),
          responsio.parsed?.concessiones?.length ? '#### Concessiones' : '',
          ...(responsio.parsed?.concessiones?.map((item) => `- ${item.sourceLabel}: ${item.text}`) ?? [])
        ])
      ];
    }),
    '',
    '## Annexe - configuration et couts',
    `Statut: ${certamen.status}`,
    `Plafond: ${certamen.config.budgetCapUsd.toFixed(2)} $`,
    `Cout reel: ${certamen.totalCostUsd.toFixed(6)} $`,
    `Spec: ${certamen.specVersion}`,
    `Prompts: ${certamen.promptVersion ?? 'n/a'}`
  ];
  return redactSecrets(lines.filter((line) => line !== '').join('\n'));
}

export function exportJson(certamen: Certamen): string {
  return redactSecrets(JSON.stringify(certamen, null, 2));
}

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 1)}…`;
}
