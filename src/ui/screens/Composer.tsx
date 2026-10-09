import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateCost, estimatePerModel } from '../../domain/budget';
import { buildPreset, flagships, randomArbiter, recommendedArbiter, sortByNewest, type LineupContext } from '../../domain/lineup';
import { DEFAULT_CONFIG, type Certamen } from '../../domain/types';
import { useRunStore } from '../../store/runStore';
import { useSettingsStore } from '../../store/settingsStore';
import { loadComposerPrefs, saveComposerPrefs } from '../../store/prefs';
import { ModelSelector, type SelectedModel } from '../components/ModelSelector';
import { formatUsd, labName } from '../format';
import { t, tf } from '../i18n';

export function Composer({ navigate }: { navigate: (path: string) => void }) {
  const models = useRunStore((state) => state.models);
  const modelsLoading = useRunStore((state) => state.modelsLoading);
  const modelsError = useRunStore((state) => state.modelsError);
  const loadModels = useRunStore((state) => state.loadModels);
  const createDraft = useRunStore((state) => state.createDraft);
  const run = useRunStore((state) => state.run);
  const featured = useRunStore((state) => state.featured);
  const usage = useRunStore((state) => state.usage);
  const apiKey = useSettingsStore((state) => state.apiKey);
  const credits = useSettingsStore((state) => state.credits);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const [text, setText] = useState('');
  const [context, setContext] = useState('');
  const [language, setLanguage] = useState<'auto' | string>('auto');
  const [selected, setSelected] = useState<SelectedModel[]>([]);
  const [budgetCapUsd, setBudgetCapUsd] = useState(0.5);
  const [responseWordTarget, setResponseWordTarget] = useState(600);
  const [useWordTarget, setUseWordTarget] = useState(true);
  const [maxConcurrency, setMaxConcurrency] = useState(4);
  const [rounds, setRounds] = useState(1);
  const [arbiterMode, setArbiterMode] = useState<'recommended' | 'random' | 'manual'>('recommended');
  const [manualArbiterId, setManualArbiterId] = useState('');
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const hadSavedRoster = useRef(false);
  const lineup: LineupContext = useMemo(() => ({ models, featured, usage }), [models, featured, usage]);

  // restore the last roster and settings
  useEffect(() => {
    let cancelled = false;
    void loadComposerPrefs().catch(() => undefined).then((prefs) => {
      if (cancelled) return;
      if (prefs?.selected?.length) {
        hadSavedRoster.current = true;
        setSelected(prefs.selected);
      }
      if (prefs?.language) setLanguage(prefs.language);
      if (prefs?.budgetCapUsd) setBudgetCapUsd(prefs.budgetCapUsd);
      if (prefs?.responseWordTarget) setResponseWordTarget(prefs.responseWordTarget);
      if (typeof prefs?.useWordTarget === 'boolean') setUseWordTarget(prefs.useWordTarget);
      if (prefs?.maxConcurrency) setMaxConcurrency(prefs.maxConcurrency);
      if (typeof prefs?.rounds === 'number') setRounds(prefs.rounds);
      if (prefs?.arbiterMode) setArbiterMode(prefs.arbiterMode);
      if (prefs?.manualArbiterId) setManualArbiterId(prefs.manualArbiterId);
      setPrefsLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  // first visit: start from the best lineup of the moment, so typing a question is enough
  useEffect(() => {
    if (!prefsLoaded || hadSavedRoster.current || selected.length > 0 || models.length === 0) return;
    hadSavedRoster.current = true;
    setSelected(buildPreset('best', lineup).map((item) => ({ modelId: item.model.id, temperature: 0.7 })));
  }, [lineup, models.length, prefsLoaded, selected.length]);

  useEffect(() => {
    if (!prefsLoaded) return;
    void saveComposerPrefs({ selected, language, budgetCapUsd, responseWordTarget, useWordTarget, maxConcurrency, rounds, arbiterMode, manualArbiterId }).catch(() => undefined);
  }, [arbiterMode, budgetCapUsd, language, manualArbiterId, maxConcurrency, prefsLoaded, responseWordTarget, rounds, selected, useWordTarget]);

  const draftEstimate = useMemo(() => {
    if (!text.trim() || selected.length < 2) return undefined;
    return estimateCost(makeEstimateDraft({ text, context, language, selected, budgetCapUsd, responseWordTarget, useWordTarget, maxConcurrency, rounds }), models);
  }, [budgetCapUsd, context, language, maxConcurrency, models, responseWordTarget, rounds, selected, text, useWordTarget]);
  const costById = useMemo(
    () => estimatePerModel(makeEstimateDraft({ text, context, language, selected, budgetCapUsd, responseWordTarget, useWordTarget, maxConcurrency, rounds }), models),
    [budgetCapUsd, context, language, maxConcurrency, models, responseWordTarget, rounds, selected, text, useWordTarget]
  );
  const rosterKey = selected.map((item) => item.modelId).join('|');
  const suggestedArbiter = useMemo(() => recommendedArbiter(rosterKey.split('|'), lineup), [lineup, rosterKey]);
  const drawnArbiter = useMemo(() => randomArbiter(rosterKey.split('|'), lineup), [lineup, rosterKey]);
  const arbiterChoices = useMemo(() => {
    const top = flagships(lineup);
    return [...top, ...sortByNewest(models).filter((model) => !top.includes(model))];
  }, [lineup, models]);
  const selectedArbiterId = (arbiterMode === 'manual' ? manualArbiterId : arbiterMode === 'random' ? drawnArbiter?.id : suggestedArbiter?.id) || suggestedArbiter?.id;
  const expectedUsd = draftEstimate?.expectedUsd;
  const lowCredits = Boolean(credits && expectedUsd !== undefined && credits.remainingCredits < expectedUsd * 1.5);
  const canLaunch = Boolean(apiKey) && !modelsLoading && selected.length >= 2 && Boolean(text.trim());

  return (
    <div className="space-y-6 pb-20">
      <section className="surface overflow-hidden">
        <div className="grid gap-px bg-hairline lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className={`bg-surface p-6 ${text ? '' : 'baseline-grid'}`}>
            <div className="section-title">QUAESTIO</div>
            <p className="mt-1 text-sm text-ink-muted">the question</p>
            <h1 className="mt-4 font-display text-4xl font-medium tracking-normal">{t(uiLanguage, 'composer.title')}</h1>
            <label className="mt-8 block text-sm font-medium">
              {t(uiLanguage, 'composer.question')}
              <textarea
                className="field mt-3 min-h-48 resize-y text-lg leading-relaxed"
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey) && canLaunch) {
                    event.preventDefault();
                    void launch();
                  }
                }}
              />
            </label>
            {!text.trim() ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                <span>{t(uiLanguage, 'composer.examples')}:</span>
                {(['composer.example1', 'composer.example2', 'composer.example3'] as const).map((key) => (
                  <button key={key} type="button" className="chip text-xs" onClick={() => setText(t(uiLanguage, key))}>
                    {t(uiLanguage, key)}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-xs text-ink-faint">{t(uiLanguage, 'composer.shortcut')}</p>
            )}
            <label className="mt-6 block text-sm font-medium">
              {t(uiLanguage, 'composer.context')}
              <textarea className="field mt-3 min-h-32 resize-y" value={context} onChange={(event) => setContext(event.target.value)} />
            </label>
          </div>
          <aside className="bg-raised p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="section-title">MODUS</div>
                <p className="mt-1 text-sm text-ink-muted">{t(uiLanguage, 'composer.settings')}</p>
              </div>
              <button className="btn-secondary h-9 px-3" onClick={() => void loadModels(apiKey, true)} title={t(uiLanguage, 'settings.refreshCatalog')}>
                {t(uiLanguage, 'composer.refresh')}
              </button>
            </div>
            <div className="mt-6 space-y-4">
              <label className="block text-xs text-ink-muted">
                {t(uiLanguage, 'composer.answerLanguage')}
                <select className="field mt-1" value={language} onChange={(event) => setLanguage(event.target.value)}>
                  <option value="auto">{t(uiLanguage, 'composer.auto')}</option>
                  <option value="English">{t(uiLanguage, 'composer.english')}</option>
                  <option value="French">{t(uiLanguage, 'composer.french')}</option>
                  <option value="Spanish">{t(uiLanguage, 'composer.spanish')}</option>
                  <option value="German">{t(uiLanguage, 'composer.german')}</option>
                </select>
              </label>
              <SettingNumber label={t(uiLanguage, 'composer.rounds')} value={rounds} min={0} max={1} step={1} onChange={setRounds} />
              <label className="flex items-center justify-between gap-4 border-b border-hairline pb-3 text-xs text-ink-muted">
                <span>
                  <span className="block text-sm text-ink">{t(uiLanguage, 'composer.useWordTarget')}</span>
                  <span>{useWordTarget ? t(uiLanguage, 'composer.words') : t(uiLanguage, 'composer.letModelDecide')}</span>
                </span>
                <input className="h-4 w-4 accent-current" type="checkbox" checked={useWordTarget} onChange={(event) => setUseWordTarget(event.target.checked)} />
              </label>
              {useWordTarget ? <SettingNumber label={t(uiLanguage, 'composer.words')} value={responseWordTarget} min={200} max={1500} step={50} onChange={setResponseWordTarget} /> : null}
              <SettingNumber label={t(uiLanguage, 'composer.budget')} value={budgetCapUsd} min={0.01} step={0.05} onChange={setBudgetCapUsd} />
              <SettingNumber label={t(uiLanguage, 'composer.concurrency')} value={maxConcurrency} min={1} max={8} step={1} onChange={setMaxConcurrency} />
            </div>
            <div className="mt-8 border-t border-hairline-strong pt-6">
              <div className="section-title">{t(uiLanguage, 'composer.arbiter')}</div>
              <div className="mt-4 grid gap-px bg-hairline">
                <ArbiterOption label={`${t(uiLanguage, 'composer.arbiterRecommended')} - ${suggestedArbiter?.name ?? 'n/a'}`} active={arbiterMode === 'recommended'} selectedLabel={t(uiLanguage, 'composer.selected')} onClick={() => setArbiterMode('recommended')} />
                <ArbiterOption label={`${t(uiLanguage, 'composer.arbiterRandom')} - ${drawnArbiter?.name ?? 'n/a'}`} active={arbiterMode === 'random'} selectedLabel={t(uiLanguage, 'composer.selected')} onClick={() => setArbiterMode('random')} />
                <ArbiterOption label={t(uiLanguage, 'composer.arbiterManual')} active={arbiterMode === 'manual'} selectedLabel={t(uiLanguage, 'composer.selected')} onClick={() => setArbiterMode('manual')} />
              </div>
              {arbiterMode === 'manual' ? (
                <select className="field mt-4" value={manualArbiterId} onChange={(event) => setManualArbiterId(event.target.value)}>
                  <option value="">Choose arbiter</option>
                  {arbiterChoices.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name} · {labName(model.author)}{model.id === suggestedArbiter?.id ? ` (${t(uiLanguage, 'composer.recommended')})` : ''}
                    </option>
                  ))}
                </select>
              ) : null}
              {selectedArbiterId ? <p className="mt-3 font-mono text-xs text-ink-muted">{selectedArbiterId}</p> : null}
            </div>
            {draftEstimate ? (
              <div className="mt-8 grid grid-cols-2 gap-px bg-hairline text-sm">
                <div className="metric col-span-2">
                  <div className="section-title">{t(uiLanguage, 'composer.estimate')}</div>
                  <div className="numeric mt-2 text-xl font-medium">{draftEstimate.lowUsd.toFixed(4)} - {draftEstimate.highUsd.toFixed(4)} USD</div>
                </div>
                <div className="metric">
                  <div className="text-xs text-ink-muted">Input</div>
                  <div className="numeric text-right font-medium">{draftEstimate.inputTokens.toLocaleString()}</div>
                </div>
                <div className="metric">
                  <div className="text-xs text-ink-muted">Output</div>
                  <div className="numeric text-right font-medium">{draftEstimate.outputTokens.toLocaleString()}</div>
                </div>
              </div>
            ) : null}
            {modelsError ? (
              <p className="mt-4 border-l-2 border-danger pl-3 text-xs text-danger">
                {t(uiLanguage, 'composer.catalogError')} <span className="font-mono">{modelsError}</span>
              </p>
            ) : null}
          </aside>
        </div>
      </section>

      <ModelSelector models={models} selected={selected} onChange={setSelected} language={uiLanguage} featured={featured} usage={usage} costById={costById} />

      <div className="sticky bottom-4 z-10 flex flex-col items-end gap-2">
        {lowCredits && credits && expectedUsd !== undefined ? (
          <p className="max-w-md border-l-2 border-danger bg-page px-3 py-2 text-sm text-danger" role="alert">
            {tf(uiLanguage, 'composer.lowCreditsInline', { balance: credits.remainingCredits.toFixed(2), cost: formatUsd(expectedUsd) })}
          </p>
        ) : null}
        <button className="btn-primary h-12 px-6 shadow-[0_8px_24px_rgb(27_26_23/0.18)]" style={{ background: 'var(--page)' }} disabled={!canLaunch} onClick={() => void launch()}>
          {modelsLoading ? '...' : expectedUsd !== undefined ? `${t(uiLanguage, 'composer.launch')} · ≈ $${formatUsd(expectedUsd)}` : t(uiLanguage, 'composer.launch')}
        </button>
      </div>
    </div>
  );

  async function launch() {
    if (!apiKey) return;
    const certamen = createDraft({
      text,
      context,
      language,
      selected,
      arbiterModelId: selectedArbiterId,
      config: { budgetCapUsd, responseWordTarget, useWordTarget, maxConcurrency, rounds }
    });
    navigate(`/certamen/${certamen.id}`);
    await run(apiKey, certamen);
  }
}

function ArbiterOption({ label, active, selectedLabel, onClick }: { label: string; active: boolean; selectedLabel: string; onClick: () => void }) {
  return (
    <button
      className={`flex min-h-12 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${active ? 'bg-ink font-medium text-page' : 'bg-surface text-ink hover:bg-raised'}`}
      type="button"
      aria-pressed={active}
      onClick={onClick}
    >
      <span className="min-w-0 leading-snug">{label}</span>
      {active ? <span className="shrink-0 border border-page px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-page">{selectedLabel}</span> : null}
    </button>
  );
}

function SettingNumber({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max?: number; step: number; onChange: (value: number) => void }) {
  return (
    <label className="block text-xs text-ink-muted">
      {label}
      <input className="field mt-1 numeric text-right" type="number" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
  );
}

function makeEstimateDraft(input: {
  text: string;
  context: string;
  language: 'auto' | string;
  selected: SelectedModel[];
  budgetCapUsd: number;
  responseWordTarget: number;
  useWordTarget: boolean;
  maxConcurrency: number;
  rounds: number;
}): Certamen {
  return {
    id: 'estimate',
    quaestio: { id: 'estimate', text: input.text, context: input.context, language: input.language, createdAt: Date.now() },
    config: {
      ...DEFAULT_CONFIG,
      budgetCapUsd: input.budgetCapUsd,
      responseWordTarget: input.responseWordTarget,
      useWordTarget: input.useWordTarget,
      maxConcurrency: input.maxConcurrency,
      rounds: input.rounds
    },
    contendentes: input.selected.map((item, index) => ({
      slot: `slot_${index}`,
      modelId: item.modelId,
      label: String.fromCharCode(65 + index),
      temperature: item.temperature,
      systemPromptExtra: item.systemPromptExtra,
      role: 'contendens'
    })),
    labelMap: {},
    status: 'draft',
    responsiones: [],
    totalCostUsd: 0,
    startedAt: Date.now(),
    appVersion: '0.0.0',
    specVersion: '1.0'
  };
}
