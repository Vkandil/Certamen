# Certamen Visual System

The interface chrome is monochrome. The four palette colors are reserved exclusively as participant identity: contendens A, B, C, and D. They never appear on buttons, links, focus rings, badges, error states, or decoration.

## Direction

Roman epigraphy and mosaic pavement, rendered with modern restraint: warm stone surfaces, ink text, hairline rules, hard corners, and a visible grid only in the empty composer and arena.

## Implementation

- Tokens live in [tokens.css](/c:/Users/Victor/Desktop/opensource/Certamen/src/styles/tokens.css).
- Tailwind colors are restricted to token-backed names.
- `/guide` explains usage first, then documents the internal protocol and prompts.
- Dark mode follows `prefers-color-scheme` and can be overridden in Settings.
