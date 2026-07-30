import { describe, expect, it } from 'vitest';
import { systemDisputatio, systemResponsio } from '../../src/domain/prompts';
import { DEFAULT_CONFIG } from '../../src/domain/types';

describe('prompts', () => {
  it('uses English concise prompts', () => {
    const prompt = systemResponsio(DEFAULT_CONFIG, 'English');
    expect(prompt).toContain('Answer the user question directly.');
    expect(prompt).toContain('## Answer');
  });

  it('omits word-target language when disabled', () => {
    const config = { ...DEFAULT_CONFIG, responseWordTarget: 600, useWordTarget: false };
    const responsio = systemResponsio(config, 'English');
    const disputatio = systemDisputatio(config, 'English');
    expect(responsio).not.toMatch(/word|words|target|limit|length/i);
    expect(disputatio).not.toMatch(/word|words|target|limit|length/i);
  });

  it('reflects the configured word target when enabled', () => {
    const config = { ...DEFAULT_CONFIG, responseWordTarget: 900, useWordTarget: true };
    expect(systemResponsio(config, 'English')).toContain('900 words');
    expect(systemDisputatio(config, 'English')).toContain('900 words');
  });
});
