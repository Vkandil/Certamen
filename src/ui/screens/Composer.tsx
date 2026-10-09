import { useEffect, useMemo, useRef, useState } from 'react';
import { estimateCost, estimatePerModel } from '../../domain/budget';
import { buildPreset, flagships, randomArbiter, recommendedArbiter, sortByNewest, type LineupContext } from '../../domain/lineup';
import { DEFAULT_CONFIG, type Certamen } from '../../domain/types';
import { useRunStore } from '../../store/runStore';
import { useSettingsStore } from '../../store/settingsStore';
import { loadComposerPrefs, saveComposerPrefs } from '../../store/prefs';
import { AutoTextarea } from '../components/AutoTextarea';
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
  const [showContext, setShowContext] = useState(false);
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
  const arbiterName = models.find((model) => model.id === selectedArbiterId)?.name ?? selectedArbiterId;
  const lowCredits = Boolean(credits && expectedUsd !== undefined && credits.remainingCredits < expectedUsd * 1.5);
  const canLaunch = Boolean(apiKey) && !modelsLoading && selected.length >= 2 && Boolean(text.trim());

  return (
    <div className="space-y-6 pb-20">
      <section className={`surface p-6 ${text ? '' : 'baseline-grid'}`}>
        <div className="section-title">QUAESTIO</div>
        <h1 className="mt-2 font-display text-3xl font-medium tracking-normal">{t(uiLanguage, 'composer.title')}</h1>
        <label className="mt-5 block text-sm font-medium">
          {t(uiLanguage, 'composer.question')}
          <AutoTextarea
            className="field mt-2 text-lg leading-relaxed"
            minRows={2}
            maxHeight={420}
            placeholder={t(uiLanguage, 'composer.questionPlaceholder')}
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
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {!text.trim() ? (
            <>
              <span>{t(uiLanguage, 'composer.examples')}:</span>
              {(['composer.example1', 'composer.example2', 'composer.example3'] as const).map((key) => (
                <button key={key} type="button" className="chip text-xs" onClick={() => setText(t(uiLanguage, key))}>
                  {t(uiLanguage, key)}
                </button>
              ))}
            </>
          ) : (
            <span className="text-ink-faint">{t(uiLanguage, 'composer.shortcut')}</span>
          )}
        </div>
        {showContext ? (
          <div className="mt-5 text-sm font-medium">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="certamen-context">{t(uiLanguage, 'composer.context')}</label>
              <button type="button" className="text-xs font-normal text-ink-muted underline-offset-2 hover:underline" onClick={() => { setContext(''); setShowContext(false); }}>
                {t(uiLanguage, 'composer.removeContext')}
              </button>
            </div>
            <AutoTextarea id="certamen-context" className="field mt-2" minRows={2} maxHeight={320} placeholder={t(uiLanguage, 'composer.contextPlaceholder')} value={context} onChange={(event) => setContext(event.target.value)} autoFocus={!context} />
          </div>
        ) : (
          <button type="button" className="mt-4 text-sm text-ink-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => setShowContext(true)}>
            {t(uiLanguage, 'composer.addContext')}
          </button>
        )}
      </section>

      <ModelSelector models={models} selected={selected} onChange={setSelected} language={uiLanguage} featured={featured} usage={usage} costById={costById} />


      <section className="surface p-6">
        <div className="section-title">MODUS</div>
        <div className="mt-4 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <label className="flex items-start justify-between gap-3 text-sm">
            <span>
              <span className="block font-medium">{t(uiLanguage, 'composer.debateRound')}</span>
              <span className="mt-1 block text-xs text-ink-muted">{t(uiLanguage, 'composer.debateRoundHint')}</span>
            </span>
            <input className="mt-1 h-4 w-4 shrink-0 accent-current" type="checkbox" checked={rounds > 0} onChange={(event) => setRounds(event.target.checked ? 1 : 0)} />
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t(uiLanguage, 'composer.answerLength')}</span>
            <select className="field mt-1" value={lengthChoice(useWordTarget, responseWordTarget)} onChange={(event) => applyLength(event.target.value as LengthChoice)}>
              <option value="short">{t(uiLanguage, 'composer.lengthShort')}</option>
              <option value="standard">{t(uiLanguage, 'composer.lengthStandard')}</option>
              <option value="long">{t(uiLanguage, 'composer.lengthLong')}</option>
              <option value="free">{t(uiLanguage, 'composer.lengthFree')}</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="font-medium">{t(uiLanguage, 'composer.budget')}</span>
            <input className="field mt-1 numeric" type="number" min={0.01} step={0.05} value={budgetCapUsd} onChange={(event) => setBudgetCapUsd(Number(event.target.value))} />
            <span className="mt-1 block text-xs text-ink-muted">
              {draftEstimate ? tf(uiLanguage, 'composer.estimateRange', { low: formatUsd(draftEstimate.lowUsd), high: formatUsd(draftEstimate.highUsd) }) : t(uiLanguage, 'composer.budgetHint')}
            </span>
            {draftEstimate && draftEstimate.highUsd > budgetCapUsd ? (
              <span className="mt-1 block text-xs text-danger">
                {t(uiLanguage, 'composer.budgetTooLow')}{' '}
                <button type="button" className="font-medium text-ink underline underline-offset-2" onClick={() => setBudgetCapUsd(suggestedBudget(draftEstimate.highUsd))}>
                  {tf(uiLanguage, 'composer.raiseBudget', { amount: suggestedBudget(draftEstimate.highUsd).toFixed(2) })}
                </button>
              </span>
            ) : null}
          </label>
          <div className="text-sm">
            <span className="font-medium">{t(uiLanguage, 'composer.arbiter')}</span>
            <div className="mt-1 truncate" title={selectedArbiterId}>{arbiterName ?? 'n/a'}</div>
            <div className="mt-2 flex gap-px bg-hairline-strong p-px" role="group" aria-label={t(uiLanguage, 'composer.arbiter')}>
              {(['recommended', 'random', 'manual'] as const).map((mode) => (
                <button key={mode} type="button" className="chip min-h-8 flex-1 justify-center border-0 px-2 text-xs" aria-pressed={arbiterMode === mode} onClick={() => setArbiterMode(mode)}>
                  {t(uiLanguage, mode === 'recommended' ? 'composer.arbiterRecommended' : mode === 'random' ? 'composer.arbiterRandom' : 'composer.arbiterManual')}
                </button>
              ))}
            </div>
            {arbiterMode === 'manual' ? (
              <select className="field mt-2" aria-label={t(uiLanguage, 'composer.chooseArbiter')} value={manualArbiterId} onChange={(event) => setManualArbiterId(event.target.value)}>
                <option value="">{t(uiLanguage, 'composer.chooseArbiter')}</option>
                {arbiterChoices.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name} · {labName(model.author)}{model.id === suggestedArbiter?.id ? ` (${t(uiLanguage, 'composer.recommended')})` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mt-1 block text-xs text-ink-muted">{t(uiLanguage, 'composer.arbiterHint')}</span>
            )}
          </div>
        </div>
        <details className="mt-6 border-t border-hairline pt-4 text-sm">
          <summary className="cursor-pointer select-none text-ink-muted">{t(uiLanguage, 'composer.moreSettings')}</summary>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            <label className="block text-sm">
              {t(uiLanguage, 'composer.answerLanguage')}
              <select className="field mt-1" value={language} onChange={(event) => setLanguage(event.target.value)}>
                <option value="auto">{t(uiLanguage, 'composer.auto')}</option>
                <option value="English">{t(uiLanguage, 'composer.english')}</option>
                <option value="French">{t(uiLanguage, 'composer.french')}</option>
                <option value="Spanish">{t(uiLanguage, 'composer.spanish')}</option>
                <option value="German">{t(uiLanguage, 'composer.german')}</option>
              </select>
            </label>
            <SettingNumber label={t(uiLanguage, 'composer.concurrency')} value={maxConcurrency} min={1} max={8} step={1} onChange={setMaxConcurrency} />
            <div className="text-sm">
              {t(uiLanguage, 'settings.catalogData')}
              <button type="button" className="btn-secondary mt-2 h-9 px-3" onClick={() => void loadModels(apiKey, true)}>
                {t(uiLanguage, 'composer.refresh')}
              </button>
            </div>
          </div>
        </details>
        {modelsError ? (
          <p className="mt-4 border-l-2 border-danger pl-3 text-xs text-danger">
            {t(uiLanguage, 'composer.catalogError')} <span className="font-mono">{modelsError}</span>
          </p>
        ) : null}
      </section>

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

  function applyLength(choice: LengthChoice) {
    setUseWordTarget(choice !== 'free');
    if (choice !== 'free') setResponseWordTarget(LENGTH_WORDS[choice]);
  }

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

type LengthChoice = 'short' | 'standard' | 'long' | 'free';
const LENGTH_WORDS: Record<Exclude<LengthChoice, 'free'>, number> = { short: 300, standard: 600, long: 1000 };

/** Budget that covers the high estimate with a margin, rounded up to $0.50. */
function suggestedBudget(highUsd: number): number {
  return Math.max(0.5, Math.ceil((highUsd * 1.2) / 0.5) * 0.5);
}

function lengthChoice(useWordTarget: boolean, words: number): LengthChoice {
  if (!useWordTarget) return 'free';
  if (words <= 400) return 'short';
  if (words <= 800) return 'standard';
  return 'long';
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
