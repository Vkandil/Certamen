# Privacy

Certamen is a local-first, backendless web app. It does not create user accounts and does not run its own server.

The short version: your OpenRouter key and run history stay in your browser, but the question, context, prompts, and model answers required for a run are sent to OpenRouter and the selected model providers.

## What Stays Local

Stored locally in the browser's IndexedDB:

- OpenRouter API key;
- UI language and theme preference;
- cached OpenRouter model catalog;
- run history;
- questions and optional context;
- selected model ids and per-model settings;
- your last roster and composer settings;
- a per-model usage count (how many runs used each model), used only to suggest "Your usual" models;
- prompt snapshots;
- model responses, parsed sections, status, costs, timestamps, and generation ids.

Certamen does not use `localStorage` for the API key, cookies, analytics, tracking pixels, or external fonts.

The app also fetches `featured-models.json` from its own origin (the same GitHub Pages site that serves the app). It is a static file; no data is sent with that request.

You can clear local application data from the Settings page.

## What Goes To OpenRouter

When the app validates a key or runs a certamen, the browser sends requests directly to OpenRouter.

OpenRouter receives:

- the API key in the `Authorization` header;
- requests to fetch the model catalog;
- requests to check available credits;
- chat completion requests for the selected models;
- app attribution headers such as `X-Title` and `HTTP-Referer`;
- normal browser/network metadata such as IP address and user agent.

Certamen does not proxy these requests because there is no backend.

## What Goes To Model Providers

OpenRouter may route completion requests to the model providers selected for a run.

Depending on the provider and model, providers may receive:

- the original question;
- optional context;
- Certamen system prompts;
- anonymized peer answers during disputatio;
- the final anonymized answers sent to the arbiter;
- generation parameters such as temperature, max tokens, and seed when supported.

Provider data handling depends on OpenRouter and the selected provider. Do not include secrets or private data unless you are comfortable sending that content to those services.

## What Is Included In Exports

Markdown and JSON exports can include:

- the question and optional context;
- model ids;
- model settings;
- generated answers;
- parsed consensus, dissensus, recommendation, and verification notes;
- run status;
- costs;
- timestamps;
- prompt version and app/spec versions.

Exports run through secret redaction for OpenRouter-looking API keys and bearer tokens, but redaction is best-effort. If the question or answers contain sensitive content, review exports before sharing.

## What Is Included In Permalinks

Permalinks encode a compressed copy of the run in the URL fragment.

Permalinks include:

- the question and optional context;
- selected model ids and settings;
- generated answers;
- final synthesis;
- run metadata.

Permalinks do not include request snapshots. They also run through the same secret redaction as exports.

Important: URL fragments are not sent to servers during normal navigation, but anyone who receives a permalink can decode and read the embedded run data. Treat permalinks as shareable exports.

## What Certamen Does Not Collect

Certamen does not collect:

- analytics events;
- usage telemetry;
- crash reports;
- account data;
- email addresses;
- payment information;
- hosted copies of runs;
- server-side logs, because there is no Certamen server.

## Recommended Usage

- Use a dedicated OpenRouter API key.
- Set a spending cap in OpenRouter.
- Avoid pasting secrets, personal data, customer data, or proprietary documents into prompts unless you intend to send them to OpenRouter and selected providers.
- Review Markdown, JSON, and permalink exports before sharing.
