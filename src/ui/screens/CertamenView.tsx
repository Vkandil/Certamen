import { useMemo } from 'react';
import { countWords } from '../../domain/tokens';
import type { Certamen, Responsio } from '../../domain/types';
import { exportJson, exportMarkdown } from '../../export/markdown';
import { certamenToPermalink } from '../../export/permalink';
import { useRunStore } from '../../store/runStore';
import { useSettingsStore } from '../../store/settingsStore';
import { SafeMarkdown } from '../components/SafeMarkdown';
import { StatusPill } from '../components/StatusPill';
import { t } from '../i18n';

export function CertamenView() {
  const current = useRunStore((state) => state.current);
  const running = useRunStore((state) => state.running);
  const abort = useRunStore((state) => state.abort);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const latestBySlot = useMemo(() => {
    const map = new Map<string, Responsio>();
    current?.responsiones.forEach((responsio) => {
      const previous = map.get(responsio.slot);
      if (!previous || previous.roundIndex <= responsio.roundIndex) map.set(responsio.slot, responsio);
    });
    return map;
  }, [current?.responsiones]);

  if (!current) return <div className="surface p-6">{t(uiLanguage, 'certamen.none')}</div>;

  const finished = ['completed', 'partial', 'failed', 'aborted'].includes(current.status);

  return (
    <div className="space-y-8">
      <div className="border-b border-hairline-strong pb-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <StatusPill status={current.status} />
            <span className="numeric text-sm text-ink-muted">{current.totalCostUsd.toFixed(4)} $ / {current.config.budgetCapUsd.toFixed(2)} $</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {running ? <button className="btn-danger" onClick={() => abort()}>{t(uiLanguage, 'certamen.stop')}</button> : null}
            {finished ? (
              <>
                <button className="btn-secondary" onClick={() => download('certamen.md', exportMarkdown(current))}>{t(uiLanguage, 'certamen.markdown')}</button>
                <button className="btn-secondary" onClick={() => download('certamen.json', exportJson(current))}>{t(uiLanguage, 'certamen.json')}</button>
                <button className="btn-secondary" onClick={() => copyPermalink(current)}>{t(uiLanguage, 'certamen.permalink')}</button>
              </>
            ) : null}
          </div>
        </div>
        <h1 className="mt-4 max-w-[68ch] text-2xl font-medium">{current.quaestio.text}</h1>
      </div>

      {finished && current.determinatio ? <Result certamen={current} language={uiLanguage} /> : <Arena certamen={current} latestBySlot={latestBySlot} language={uiLanguage} />}
    </div>
  );
}

function Arena({ certamen, latestBySlot, language }: { certamen: Certamen; latestBySlot: Map<string, Responsio>; language: ReturnType<typeof useSettingsStore.getState>['uiLanguage'] }) {
  const contenders = certamen.contendentes.filter((item) => item.role === 'contendens');
  const round = Math.max(0, ...certamen.responsiones.map((item) => item.roundIndex));
  return (
    <div className="baseline-grid space-y-0 border border-hairline bg-surface">
      <div className="border-b border-hairline-strong bg-raised px-4 py-3 text-sm text-ink-muted">
        <span className="section-title">ARENA</span>
        <span className="ml-3">Round {round} - {round >= 1 ? t(language, 'certamen.disputatio') : t(language, 'certamen.initial')}</span>
      </div>
      <div className="grid gap-px bg-hairline lg:grid-cols-3">
        {contenders.map((contendens, index) => {
          const responsio = latestBySlot.get(contendens.slot);
          return (
            <article key={contendens.slot} className="flex min-h-96 flex-col bg-surface">
              <div className="participant-bar h-1" data-slot={String(index)} />
              <header className="border-b border-hairline bg-raised p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-display text-3xl font-medium leading-none">{certamen.labelMap[contendens.slot]}</div>
                    <div className="mt-2 truncate font-mono text-xs text-ink-muted">{contendens.modelId}</div>
                  </div>
                  <StatusPill status={responsio?.status ?? 'pending'} />
                </div>
                <div className="numeric mt-3 text-xs text-ink-muted">{responsio ? countWords(responsio.raw) : 0} words</div>
              </header>
              <div className="flex-1 overflow-auto p-4 text-[0.9375rem]">
                <SafeMarkdown>{responsio?.raw || t(language, 'certamen.waiting')}</SafeMarkdown>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function Result({ certamen, language }: { certamen: Certamen; language: ReturnType<typeof useSettingsStore.getState>['uiLanguage'] }) {
  const det = certamen.determinatio;
  return (
    <div className="space-y-8">
      <section className="my-16 border-y-2 border-ink bg-raised py-16">
        <div className="mx-auto max-w-4xl px-4">
          <div className="section-title">DETERMINATIO</div>
          <p className="mt-1 text-sm text-ink-muted">the verdict</p>
          <h2 className="mt-8 text-xl font-medium">{t(language, 'certamen.recommendation')}</h2>
          <SafeMarkdown>{det?.parsed?.recommendation || det?.raw || ''}</SafeMarkdown>
          <h2 className="mt-8 text-xl font-medium">{t(language, 'certamen.synthesis')}</h2>
          <SafeMarkdown>{det?.parsed?.synthesis || ''}</SafeMarkdown>
        </div>
      </section>

      <section className="grid gap-px bg-hairline lg:grid-cols-2">
        <div className="bg-surface p-6">
          <div className="section-title">{t(language, 'certamen.dissensus')}</div>
          <ul className="mt-4 space-y-4 text-sm">
            {det?.parsed?.dissensus.map((item, index) => (
              <li key={index} className="border-b border-hairline pb-4 last:border-b-0">
                <DissensusChips certamen={certamen} labels={item.positions.map((position) => position.label)} />
                <div className="mt-2">{item.point}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-surface p-6">
          <div className="section-title">{t(language, 'certamen.consensus')}</div>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
            {det?.parsed?.consensus.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        </div>
      </section>

      <section className="surface p-6">
        <div className="section-title">{t(language, 'certamen.lostIdeas')}</div>
        <p className="mt-1 text-sm text-ink-muted">{t(language, 'certamen.heuristic')}</p>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          {(det?.parsed?.orphanedIdeas ?? []).map((item, index) => <li key={index}>{item}</li>)}
        </ul>
      </section>

      <section className="surface p-6">
        <div className="section-title">{t(language, 'certamen.responses')}</div>
        <div className="mt-4 space-y-3">
          {certamen.contendentes.filter((item) => item.role === 'contendens').map((contendens, index) => (
            <details key={contendens.slot} className="border border-hairline bg-raised">
              <summary className="cursor-pointer p-3 font-medium">
                <span className="participant-chip mr-2" data-slot={String(index)} /> {certamen.labelMap[contendens.slot]} {'->'} <span className="font-mono text-xs">{contendens.modelId}</span>
              </summary>
              {certamen.responsiones.filter((item) => item.slot === contendens.slot).sort((a, b) => a.roundIndex - b.roundIndex).map((responsio) => (
                <div key={responsio.id} className="border-t border-hairline p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-4">
                    <span className="text-sm font-medium">Round {responsio.roundIndex}</span>
                    <StatusPill status={responsio.status} />
                    <span className="numeric text-xs text-ink-muted">{countWords(responsio.raw)} words - {(responsio.usage?.costUsd ?? 0).toFixed(5)} USD</span>
                  </div>
                  <SafeMarkdown>{responsio.raw}</SafeMarkdown>
                </div>
              ))}
            </details>
          ))}
        </div>
      </section>

      <section className="surface p-6">
        <div className="section-title">{t(language, 'certamen.callLog')}</div>
        <div className="mt-4 space-y-3">
          {certamen.responsiones.map((responsio) => (
            <details key={responsio.id} className="border border-hairline bg-raised">
              <summary className="cursor-pointer p-3 text-sm">{certamen.labelMap[responsio.slot]} round {responsio.roundIndex} - <span className="font-mono">{responsio.generationId ?? 'unknown generation'}</span></summary>
              <pre className="numeric overflow-auto border-t border-hairline bg-surface p-4 text-xs">{JSON.stringify(responsio.requestSnapshot, null, 2)}</pre>
            </details>
          ))}
        </div>
      </section>
    </div>
  );
}

function DissensusChips({ certamen, labels }: { certamen: Certamen; labels: string[] }) {
  const contenderLabels = certamen.contendentes.filter((item) => item.role === 'contendens').map((item) => certamen.labelMap[item.slot]);
  const usable = labels.length > 0 ? labels : contenderLabels;
  return (
    <span className="inline-flex gap-1">
      {usable.slice(0, 4).map((label) => {
        const index = contenderLabels.indexOf(label);
        return <span key={label} className="participant-chip" data-slot={String(Math.max(0, index))} title={label} />;
      })}
    </span>
  );
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyPermalink(certamen: Certamen) {
  const link = certamenToPermalink(certamen);
  if (!link) {
    download('certamen.json', exportJson(certamen));
    return;
  }
  await navigator.clipboard.writeText(link);
}
