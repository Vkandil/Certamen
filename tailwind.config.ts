import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    fontFamily: {
      display: ['Georgia', 'ui-serif', 'serif'],
      sans: ['Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      mono: ['SFMono-Regular', 'Cascadia Code', 'Consolas', 'Liberation Mono', 'ui-monospace', 'monospace']
    },
    colors: {
      transparent: 'transparent',
      current: 'currentColor',
      page: 'var(--page)',
      surface: 'var(--surface)',
      raised: 'var(--raised)',
      hairline: 'var(--hairline)',
      'hairline-strong': 'var(--hairline-strong)',
      ink: 'var(--ink)',
      'ink-muted': 'var(--ink-muted)',
      'ink-faint': 'var(--ink-faint)',
      danger: 'var(--danger)',
      notice: 'var(--notice)'
    },
    extend: {
    }
  },
  plugins: []
} satisfies Config;
