# Roadmap

This roadmap is intentionally short. Certamen should stay small, inspectable, and local-first.

## v0.1 - Polish UI, Exports, Docs

Focus: make the current app feel complete and easy to trust.

- Improve responsive layout on narrow screens.
- Polish empty states, loading states, and error states.
- Make Markdown and JSON exports clearer and easier to read.
- Improve permalink warnings for large or sensitive runs.
- Keep README, screenshots, privacy notes, and protocol docs in sync with the app.
- Add more focused tests around exports, redaction, and run recovery.

## Shipped - Model Lineup And Composer UX

- Live lineup from the OpenRouter catalog (release date, price tier, open weights), one lab per slot.
- Presets: best right now, fast and cheap, open weights, your usual.
- Upgrade hints for newer releases and models that left the catalog.
- Weekly `featured-models.json` workflow for pins and excludes.
- Remembered roster and settings, per-question cost per model, cost on the launch button, inline low-credit warning.
- Retry failed answers and re-run the arbiter.

## v0.2 - Local Model Scores, Better Lost-Ideas Detection

Focus: make Certamen learn from the user's own runs without sending analytics.

- Let users mark which model answer was most useful after a run.
- Build a local-only model score from user feedback.
- Show model usefulness by task type when enough local history exists.
- Replace the simple lost-ideas heuristic with better claim or section comparison.
- Surface minority ideas that were dropped during disputatio.
- Export the local feedback dataset.

## v0.3 - Dataset Import/Export, Replay Runs

Focus: make Certamen useful for repeatable evaluations and open research workflows.

- Import and export evaluation datasets.
- Replay archived runs with current models.
- Warn when archived model ids are unavailable and suggest replacements.
- Compare run outputs across model rosters or prompt versions.
- Add a compact report format for sharing benchmark results.

## Non-Goals For Now

- Hosted accounts.
- Server-side API key storage.
- Provider-specific SDK lock-in.
- Telemetry-driven rankings.
