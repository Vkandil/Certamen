import { describe, expect, it } from 'vitest';
import { orphanedIdeas, parseDetermination, parseResponsio } from '../../src/domain/parser';

describe('parser', () => {
  it('extracts response sections tolerantly', () => {
    const parsed = parseResponsio('## Objectiones\n- A: fragile\n## Concessiones\n- B: utile\n## Responsio revisa\nCorps final.');
    expect(parsed?.body).toBe('Corps final.');
    expect(parsed?.objectiones?.[0]?.targetLabel).toBe('A');
  });

  it('returns undefined when expected headings are absent', () => {
    expect(parseResponsio('texte sans titres, avec ``` et <xml>')).toBeUndefined();
  });

  it('parses determinatio headings', () => {
    const parsed = parseDetermination('## Consensus\n- ok\n## Dissensus\n- A: oui; B: non\n## Synthese\nS\n## Recommandation\nR\n## A verifier\n- V', ['lost']);
    expect(parsed?.recommendation).toBe('R');
    expect(parsed?.orphanedIdeas).toEqual(['lost']);
  });

  it('detects orphaned ideas with an explicit heuristic', () => {
    const lost = orphanedIdeas(['Une idee precise sur la conservation du signal minoritaire doit rester visible dans le resultat final pour eviter la convergence prematuree.'], ['Autre conclusion sans rapport.']);
    expect(lost.length).toBe(1);
  });
});
