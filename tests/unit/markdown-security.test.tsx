import { describe, expect, it } from 'vitest';
import { sanitizeHref } from '../../src/ui/markdownLinks';

describe('markdown security', () => {
  it('allows ordinary links', () => {
    expect(sanitizeHref('https://example.com')).toBe('https://example.com');
    expect(sanitizeHref('/local')).toBe('/local');
    expect(sanitizeHref('#section')).toBe('#section');
  });

  it('blocks executable links', () => {
    expect(sanitizeHref('javascript:alert(1)')).toBeUndefined();
    expect(sanitizeHref('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });
});
