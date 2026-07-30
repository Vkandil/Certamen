import { DEFAULT_CONFIG } from '../../domain/types';
import { systemDeterminatio, systemDisputatio, systemResponsio } from '../../domain/prompts';

export function Guide() {
  const promptConfig = { ...DEFAULT_CONFIG, responseWordTarget: 600, useWordTarget: true };
  return (
    <div className="space-y-8">
      <section className="surface baseline-grid p-8">
        <div className="section-title">PRAXIS</div>
        <p className="mt-1 text-sm text-ink-muted">how to use the tool</p>
        <h1 className="mt-6 max-w-[16ch] font-display text-4xl font-medium leading-tight">Using Certamen well</h1>
        <div className="mt-8 grid gap-px bg-hairline md:grid-cols-3">
          <GuideStep number="I" title="Ask one real question" body="Use a decision, investigation, design review, or synthesis task. Certamen is strongest when disagreement is useful." />
          <GuideStep number="II" title="Choose a mixed roster" body="Prefer different model families: one frontier model, one fast model, one lower-cost or open-weight model." />
          <GuideStep number="III" title="Read the dissensus first" body="The final value is not the average answer. Look at what survived, what split, and what disappeared." />
        </div>
      </section>

      <section className="grid gap-px bg-hairline lg:grid-cols-2">
        <div className="bg-surface p-6">
          <div className="section-title">QUAESTIO</div>
          <p className="mt-1 text-sm text-ink-muted">writing better questions</p>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-sm">
            <li>State the decision you need, not only the topic.</li>
            <li>Add constraints in the context field: budget, timeline, audience, risks, source material.</li>
            <li>Use answer language when you need a specific output language; otherwise Auto follows the question.</li>
            <li>Disable target words when you want the models to decide the useful length.</li>
          </ul>
        </div>
        <div className="bg-raised p-6">
          <div className="section-title">CONTENTIO</div>
          <p className="mt-1 text-sm text-ink-muted">choosing models</p>
          <ul className="mt-6 list-disc space-y-3 pl-5 text-sm">
            <li>Use at least three contenders for substantive topics.</li>
            <li>Mix providers to reduce shared blind spots.</li>
            <li>Use one strong arbiter that is not also a contender when possible.</li>
            <li>Watch the estimate: disputatio grows with the number and length of responses.</li>
          </ul>
        </div>
      </section>

      <section className="surface p-6">
        <div className="section-title">MACHINA</div>
        <p className="mt-1 text-sm text-ink-muted">how it works internally</p>
        <ol className="mt-6 grid gap-px bg-hairline md:grid-cols-4">
          <Mechanic title="Round 0" body="Every contendens answers independently. No model sees the others yet." />
          <Mechanic title="Disputatio" body="Each successful answer is anonymized, scrubbed, shuffled per recipient, and sent to the other models." />
          <Mechanic title="Determinatio" body="The arbiter receives the final answers and lost-idea heuristic, then produces the verdict." />
          <Mechanic title="Audit" body="Requests, streamed text, status, usage, costs, and generation ids are persisted locally." />
        </ol>
      </section>

      <section className="space-y-4">
        <div>
          <div className="section-title">PROMPTA</div>
          <p className="mt-1 text-sm text-ink-muted">the system prompts used by Certamen</p>
        </div>
        <PromptBlock title="SYSTEM_RESPONSIO" body={systemResponsio(promptConfig, 'English')} />
        <PromptBlock title="SYSTEM_DISPUTATIO" body={systemDisputatio(promptConfig, 'English')} />
        <PromptBlock title="SYSTEM_DETERMINATIO" body={systemDeterminatio('English')} />
      </section>
    </div>
  );
}

function GuideStep({ number, title, body }: { number: string; title: string; body: string }) {
  return (
    <article className="bg-raised p-5">
      <div className="font-display text-3xl font-medium">{number}</div>
      <h2 className="mt-4 text-lg font-medium">{title}</h2>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </article>
  );
}

function Mechanic({ title, body }: { title: string; body: string }) {
  return (
    <li className="list-none bg-surface p-5">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{body}</p>
    </li>
  );
}

function PromptBlock({ title, body }: { title: string; body: string }) {
  return (
    <details className="surface">
      <summary className="cursor-pointer border-b border-hairline bg-raised p-4 font-mono text-sm">{title}</summary>
      <pre className="numeric max-h-96 overflow-auto p-4 text-xs leading-relaxed">{body}</pre>
    </details>
  );
}
