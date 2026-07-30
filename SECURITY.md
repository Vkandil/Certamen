# Security

Certamen is backendless. The OpenRouter API key is stored locally in IndexedDB and is only sent to OpenRouter API endpoints.

Security properties currently enforced:

- strict CSP in `index.html` with `connect-src` limited to `self` and `https://openrouter.ai`;
- no telemetry, analytics, external fonts, or tracking pixels;
- no `dangerouslySetInnerHTML`; model output is rendered as Markdown without raw HTML;
- generated Markdown links are sanitized before rendering;
- Markdown and JSON exports run through secret redaction;
- permalinks remove request snapshots and run through the same secret redaction;
- automated tests cover export redaction, permalink snapshot stripping, prompt behavior, SSE parsing, and Markdown link sanitization.

Residual risks:

- the API key is visible to the local browser profile because there is no backend vault;
- questions, context, and model answers are sent to OpenRouter and the model providers selected for a run;
- if a user intentionally includes private data in a question, that data may be stored in IndexedDB and shared through exports unless deleted or manually removed;
- prompt injection resistance is best-effort, not a formal guarantee.

For responsible disclosure, use GitHub private vulnerability reporting if enabled on the repository, or open a minimal security issue without exploit details and request a private contact channel.
