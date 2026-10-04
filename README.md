<div align="center">
  <img src="src/assets/certamen-logo-transparent.png" alt="Certamen logo" width="112" />

  <h1>Certamen</h1>

  <p>
    <strong>Local-first multi-model debate.</strong><br />
    Ask one question, compare several LLMs, and get an arbitrated synthesis.
  </p>

  <p>
    <a href="#quick-start">Quick start</a>
    |
    <a href="#screenshots">Screenshots</a>
    |
    <a href="#features">Features</a>
    |
    <a href="PRIVACY.md">Privacy</a>
    |
    <a href="SECURITY.md">Security</a>
    |
    <a href="ROADMAP.md">Roadmap</a>
    |
    <a href="docs/GITHUB_PAGES.md">Deploy</a>
    |
    <a href="CONTRIBUTING.md">Contributing</a>
    |
    <a href="https://openrouter.ai/keys">OpenRouter keys</a>
  </p>

  <p>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-111111.svg" /></a>
    <a href="PRIVACY.md"><img alt="Local-first" src="https://img.shields.io/badge/local--first-IndexedDB-5F6B3E.svg" /></a>
    <a href="PRIVACY.md"><img alt="No backend" src="https://img.shields.io/badge/backend-none-A8452F.svg" /></a>
    <a href="https://openrouter.ai"><img alt="Models via OpenRouter" src="https://img.shields.io/badge/models-OpenRouter-2F4E7E.svg" /></a>
    <a href="#security-notes"><img alt="No telemetry" src="https://img.shields.io/badge/telemetry-none-BF8526.svg" /></a>
  </p>
</div>

<p align="center">
  <a href="https://github.com/user-attachments/assets/036586c6-b53a-4742-953f-2f36f5f5ea6b
">
    <img src="docs/media/certamen-promo-poster.jpg" alt="Watch the Certamen film (0:47, sound on)" width="100%" />
  </a>
  <br />
  <sub><a href="https://github.com/user-attachments/assets/036586c6-b53a-4742-953f-2f36f5f5ea6b
"><b>▶ Watch the 47-second film</b></a> (sound on). Made entirely in code; see <a href="video/">video/</a>.</sub>
</p>

---

Certamen is a static web app for questions where one model is not enough. It runs several LLMs through OpenRouter, asks them to review anonymized peer answers, then uses an arbiter model to produce a final synthesis with consensus, dissensus, recommendations, and points to verify.

In Latin, **certamen** means a contest, debate, or trial of strength. Here, it is a structured contest between model answers.

There is no backend and no account system. The user brings an OpenRouter API key; Certamen stores it locally in the browser and only sends it to OpenRouter.

## Why Certamen?

Single-model answers are fast, but they hide disagreement. Certamen is built for questions where disagreement is useful: technical decisions, research synthesis, design review, risk analysis, strategy, and any topic where you want multiple independent attempts before a final recommendation.

Instead of asking one model to "think harder", Certamen runs a small structured protocol:

```text
question -> independent answers -> anonymized disputatio -> arbiter synthesis -> reveal/export
```

Each participant answers independently first. Then each model sees anonymized peer answers as data, not instructions, and revises its answer. Finally, an arbiter model produces a synthesis that highlights consensus, dissensus, recommendations, and points to verify.

## Screenshots

### Connect OpenRouter

Paste an OpenRouter key and start immediately. The key stays local in IndexedDB.

![Connect an OpenRouter key](docs/screenshots/01-openrouter-key.png)

### Compose A Run

Write the question, add optional context, tune the number of disputatio rounds, choose the answer language, set a budget cap, and decide whether answers should target a specific length.

The arbiter can be recommended, random, or manually selected.

![Compose a certamen](docs/screenshots/02-compose-certamen.png)

### Choose The Models

Start from recommended model families, then tune each slot. You can mix frontier models, fast models, cheaper models, and different providers. Certamen keeps the roster explicit so the final result is auditable.

![Choose models](docs/screenshots/03-choose-models.png)

## Features

- Local-first React app with no backend.
- OpenRouter model catalog loaded live.
- Multi-language UI and answer language selection.
- Per-model temperature and optional role/stance.
- Recommended, random, or manual arbiter selection.
- Streaming responses with OpenRouter SSE handling.
- Cost estimates before launch and real OpenRouter cost after calls.
- IndexedDB history for previous runs.
- Markdown, JSON, and permalink export.
- Prompt snapshots stored for auditability.
- Strict CSP and no external fonts or analytics.

## Quick Start

```bash
npm install
npm run dev
```

The app opens at:

```text
http://localhost:5273
```

Create an OpenRouter key at https://openrouter.ai/keys, paste it into Certamen, and start a run.

## Hosted Demo

Certamen can be deployed as a static GitHub Pages app. The workflow is already included in `.github/workflows/deploy-pages.yml`.

See [docs/GITHUB_PAGES.md](docs/GITHUB_PAGES.md) for setup details.

## Privacy Model

Certamen is designed to be easy to inspect. See [PRIVACY.md](PRIVACY.md) for the full data-flow breakdown.

- the OpenRouter API key is stored in IndexedDB;
- the key is not stored in `localStorage`, cookies, URLs, Markdown exports, JSON exports, or permalinks;
- application network requests are limited by CSP to `self` and `https://openrouter.ai`;
- no telemetry, analytics, external fonts, or tracking pixels are loaded;
- model output is rendered through Markdown without raw HTML;
- Markdown links are sanitized before rendering;
- exports and permalinks redact OpenRouter-looking secrets.

Important limitation: because Certamen has no backend, your browser sends your key, question, context, and selected model prompts directly to OpenRouter. OpenRouter and the selected model providers receive the content required to run the debate.

Use a dedicated OpenRouter key with a spending cap.

## What Gets Stored Locally

Each run can store:

- the question and optional context;
- selected model ids and settings;
- prompt snapshots;
- generated answers and parsed sections;
- status, costs, timestamps, and generation ids.

You can clear local data from the Settings page.

## Security Notes

Certamen includes guardrails, not magic:

- peer answers are escaped and anonymized before being sent to other models;
- peer answers are framed as data rather than instructions;
- raw HTML rendering is disabled;
- `dangerouslySetInnerHTML` is blocked by ESLint;
- tests cover secret redaction, permalink snapshot stripping, SSE parsing, prompt behavior, and Markdown link sanitization.

Prompt injection cannot be formally eliminated. Treat model output as untrusted text and verify important claims.

## Scripts

```bash
npm run dev        # start the local Vite server
npm run build      # typecheck and build static assets
npm run lint       # run ESLint
npm run test       # run unit tests
npm run e2e        # run Playwright onboarding test
```

## Project Structure

```text
src/api/       OpenRouter client, model catalog, SSE parsing
src/domain/    Certamen protocol, prompts, parsing, budget logic
src/store/     IndexedDB and Zustand stores
src/ui/        Screens, components, translations
src/export/    Markdown, JSON, permalink, redaction
tests/         Unit and Playwright tests
docs/          Protocol, design notes, screenshots
```

## Known Limits

- Exact reproducibility is not guaranteed, even when a model supports `seed`.
- Multi-agent debate can converge too early and lose a useful minority idea.
- Cost estimates are heuristics; final cost comes from OpenRouter usage data.
- OpenRouter model ids and pricing can change over time.
- Very long questions or rosters can exceed provider context limits.

## Roadmap

See [ROADMAP.md](ROADMAP.md) for the short release plan.

## Contributing

Contributions are welcome. Please keep changes small, tested, and aligned with the local-first privacy model.

Any change to `src/domain/prompts.ts` should increment `PROMPT_VERSION` and explain why the prompt changed.

## License

MIT




