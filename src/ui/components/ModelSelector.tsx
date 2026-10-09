import { useMemo, useState } from 'react';
import { formatPricePerMillion } from '../../api/models';
import {
  ageDays,
  alternativesFor,
  buildPreset,
  isNew,
  nextSuggestion,
  reasonFor,
  resizeRoster,
  sortByNewest,
  totalPricePerMillion,
  upgradesFor,
  type FeaturedOverlay,
  type LineupContext,
  type PresetKind,
  type SuggestionReason,
  type UsageStats
} from '../../domain/lineup';
import type { ModelInfo } from '../../domain/types';
import { formatUsd, labName } from '../format';
import { t, tf, type AppLanguage } from '../i18n';

export interface SelectedModel {
  modelId: string;
  temperature?: number;
  systemPromptExtra?: string;
}

const MAX_SLOTS = 8;
const PRESETS: PresetKind[] = ['best', 'fast', 'open', 'usual'];
const SIZES = [2, 3, 4, 5, 6];
const DEFAULT_SIZE = 4;
export function ModelSelector({
  models,
  selected,
  onChange,
  language,
  featured,
  usage,
  costById = {}
}: {
  models: ModelInfo[];
  selected: SelectedModel[];
  onChange: (selected: SelectedModel[]) => void;
  language: AppLanguage;
  featured?: FeaturedOverlay;
  usage?: UsageStats;
  costById?: Record<string, number>;
}) {
  const ctx: LineupContext = useMemo(() => ({ models, featured, usage }), [models, featured, usage]);
  const selectedIds = useMemo(() => selected.map((item) => item.modelId), [selected]);
  const teamSize = selected.length >= 2 ? selected.length : DEFAULT_SIZE;
  const presets = useMemo(() => Object.fromEntries(PRESETS.map((kind) => [kind, buildPreset(kind, ctx, teamSize)])) as Record<PresetKind, ReturnType<typeof buildPreset>>, [ctx, teamSize]);
  const nextDebater = useMemo(() => nextSuggestion(selectedIds, ctx), [ctx, selectedIds]);
  const activePreset = PRESETS.find((kind) => presets[kind].length > 0 && sameIds(presets[kind].map((item) => item.model.id), selectedIds));
  const upgrades = useMemo(() => (models.length ? upgradesFor(selectedIds, ctx) : []), [ctx, models.length, selectedIds]);
  const [swapOpen, setSwapOpen] = useState<number | undefined>();

  return (
    <div className="space-y-6">
      <section className="surface overflow-hidden">
        <div className="border-b border-hairline p-6">
          <div className="section-title">CONTENTIO</div>
          <h2 className="mt-2 font-display text-2xl font-medium">{t(language, 'models.pickTitle')}</h2>
          <p className="mt-1 max-w-[70ch] text-sm text-ink-muted">{t(language, 'models.pickSubtitle')}</p>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-xs text-ink-muted" title={t(language, 'models.sizeHint')}>{t(language, 'models.debaters')}</span>
            <div className="flex gap-px bg-hairline-strong p-px" role="group" aria-label={t(language, 'models.debaters')}>
              {SIZES.map((size) => (
                <button key={size} type="button" className="chip h-9 w-10 justify-center border-0 px-0 font-mono" aria-pressed={selected.length === size} disabled={models.length === 0} onClick={() => resize(size)}>
                  {size}
                </button>
              ))}
            </div>
            <span className="hidden text-xs text-ink-faint md:inline">{t(language, 'models.sizeHint')}</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Presets">
            {PRESETS.map((kind) => {
              const disabled = presets[kind].length < 2;
              return (
                <button
                  key={kind}
                  type="button"
                  className="chip"
                  aria-pressed={activePreset === kind}
                  disabled={disabled}
                  aria-label={t(language, `preset.${kind}`)}
                  title={kind === 'usual' && disabled ? t(language, 'preset.usualEmpty') : undefined}
                  onClick={() => onChange(presets[kind].map((item) => ({ modelId: item.model.id, temperature: 0.7 })))}
                >
                  {t(language, `preset.${kind}`)}
                </button>
              );
            })}
          </div>
        </div>

        {upgrades.length > 0 ? (
          <div className="border-b border-hairline bg-raised px-6 py-4" role="status">
            <ul className="space-y-2 text-sm">
              {upgrades.map((upgrade) => (
                <li key={upgrade.fromId} className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    {upgrade.kind === 'newer'
                      ? tf(language, 'models.upgradeNewer', { to: upgrade.to.name, from: models.find((model) => model.id === upgrade.fromId)?.name ?? upgrade.fromId })
                      : tf(language, 'models.upgradeMissing', { to: upgrade.to.name, from: upgrade.fromId })}
                  </span>
                  <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => replace(upgrade.fromId, upgrade.to.id)}>
                    {t(language, 'models.replace')}
                  </button>
                </li>
              ))}
            </ul>
            {upgrades.length > 1 ? (
              <button type="button" className="btn-secondary mt-3 h-8 px-3 text-xs" onClick={() => onChange(upgrades.reduce((roster, upgrade) => roster.map((item) => (item.modelId === upgrade.fromId ? { ...item, modelId: upgrade.to.id } : item)), selected))}>
                {t(language, 'models.replaceAll')}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="p-6">
          <div className="flex items-baseline justify-between gap-4">
            <div className="section-title">ORDO</div>
            <span className="text-xs text-ink-muted">{t(language, 'models.team')} · {selected.length}/{MAX_SLOTS}</span>
          </div>
          {selected.length === 0 ? <p className="mt-4 text-sm text-ink-muted">{models.length ? t(language, 'models.empty') : t(language, 'models.loading')}</p> : null}
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {selected.map((item, index) => {
              const model = models.find((candidate) => candidate.id === item.modelId);
              const reason: SuggestionReason | 'manual' = model ? reasonFor(model, ctx) ?? 'manual' : 'manual';
              const cost = costById[item.modelId];
              return (
                <div key={`${item.modelId}-${index}`} className="border border-hairline bg-raised">
                  <div className="participant-bar h-1" data-slot={String(index)} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="font-display text-3xl font-medium leading-none">{String.fromCharCode(65 + index)}</div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate text-base font-medium">{model?.name ?? item.modelId}</span>
                            {model && isNew(model) ? <NewBadge language={language} /> : null}
                          </div>
                          <div className="mt-0.5 text-xs text-ink-muted">{reasonLine(reason, model, language)}</div>
                          <div className="truncate font-mono text-xs text-ink-faint">{item.modelId}</div>
                        </div>
                      </div>
                      {cost !== undefined ? <div className="numeric shrink-0 text-right text-xs text-ink-muted">{tf(language, 'models.costHere', { cost: formatUsd(cost) })}</div> : null}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary h-8 px-3 text-xs" aria-expanded={swapOpen === index} onClick={() => setSwapOpen(swapOpen === index ? undefined : index)}>
                        ↻ {t(language, 'models.swap')}
                      </button>
                      <button type="button" className="btn-secondary h-8 px-3 text-xs" onClick={() => remove(index)}>
                        {t(language, 'models.remove')}
                      </button>
                    </div>
                    {swapOpen === index ? (
                      <div className="mt-3 border-t border-hairline pt-3">
                        <div className="text-xs text-ink-muted">{t(language, 'models.swapTitle')}</div>
                        <div className="mt-2 grid gap-px bg-hairline">
                          {alternativesFor(item.modelId, selectedIds, ctx).map((alt) => (
                            <button key={alt.model.id} type="button" className="bg-surface px-3 py-2 text-left text-sm transition hover:bg-ink hover:text-page" onClick={() => { replace(item.modelId, alt.model.id); setSwapOpen(undefined); }}>
                              <span className="font-medium">{alt.model.name}</span>
                              <span className="block text-xs opacity-75">{reasonLine(alt.reason, alt.model, language)}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <details className="mt-3 text-xs text-ink-muted">
                      <summary className="cursor-pointer select-none">{t(language, 'models.options')}</summary>
                      <label className="mt-3 block">
                        {t(language, 'models.temperature')}
                        <input
                          className="field mt-1 numeric text-right"
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={item.temperature ?? 0.7}
                          disabled={model ? !model.supportedParameters.includes('temperature') : false}
                          onChange={(event) => update(index, { temperature: Number(event.target.value) })}
                        />
                      </label>
                      <label className="mt-3 block">
                        {t(language, 'models.role')}
                        <input className="field mt-1" value={item.systemPromptExtra ?? ''} placeholder="advocatus diaboli, security specialist..." onChange={(event) => update(index, { systemPromptExtra: event.target.value })} />
                      </label>
                    </details>
                  </div>
                </div>
              );
            })}
            {selected.length > 0 && selected.length < MAX_SLOTS && nextDebater ? (
              <button type="button" className="flex min-h-36 flex-col items-start justify-center gap-1 border border-dashed border-hairline-strong p-4 text-left transition hover:border-ink hover:bg-raised" onClick={() => onChange([...selected, { modelId: nextDebater.model.id, temperature: 0.7 }])}>
                <span className="font-display text-3xl leading-none text-ink-faint">{String.fromCharCode(65 + selected.length)}</span>
                <span className="text-sm font-medium">+ {t(language, 'models.addDebater')}</span>
                <span className="text-xs text-ink-muted">{nextDebater.model.name} · {reasonLine(nextDebater.reason, nextDebater.model, language)}</span>
              </button>
            ) : null}
          </div>
          {selected.length === 1 ? <p className="mt-4 border-l-2 border-danger pl-3 text-sm text-danger">{t(language, 'models.minTwo')}</p> : null}
          {selected.length > 5 ? <p className="mt-4 border-l-2 border-ink pl-3 text-sm text-ink-muted">{t(language, 'models.costWarning')}</p> : null}
        </div>
      </section>

      <Catalog models={models} selectedIds={selectedIds} language={language} onAdd={add} />
    </div>
  );

  function resize(size: number) {
    setSwapOpen(undefined);
    const preset = activePreset && activePreset !== 'usual' ? buildPreset(activePreset, ctx, size) : [];
    const ids = preset.length === size ? preset.map((item) => item.model.id) : resizeRoster(selectedIds, size, ctx);
    onChange(ids.map((id) => selected.find((item) => item.modelId === id) ?? { modelId: id, temperature: 0.7 }));
  }

  function add(model: ModelInfo) {
    if (selected.length >= MAX_SLOTS) return;
    onChange([...selected, { modelId: model.id, temperature: 0.7 }]);
  }

  function remove(index: number) {
    setSwapOpen(undefined);
    onChange(selected.filter((_, selectedIndex) => selectedIndex !== index));
  }

  function replace(fromId: string, toId: string) {
    onChange(selected.map((item) => (item.modelId === fromId ? { ...item, modelId: toId } : item)));
  }

  function update(index: number, patch: Partial<SelectedModel>) {
    onChange(selected.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

type SortKey = 'newest' | 'name' | 'price';

function Catalog({ models, selectedIds, language, onAdd }: { models: ModelInfo[]; selectedIds: string[]; language: AppLanguage; onAdd: (model: ModelInfo) => void }) {
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [sort, setSort] = useState<SortKey>('newest');
  const [maxPrice, setMaxPrice] = useState(0);
  const authors = useMemo(() => [...new Set(models.map((model) => model.author))].sort(), [models]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const list = models
      .filter((model) => !author || model.author === author)
      .filter((model) => !maxPrice || totalPricePerMillion(model) <= maxPrice)
      .filter((model) => !normalized || `${model.name} ${model.id}`.toLowerCase().includes(normalized));
    if (sort === 'newest') return sortByNewest(list);
    if (sort === 'price') return [...list].sort((a, b) => totalPricePerMillion(a) - totalPricePerMillion(b));
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [author, maxPrice, models, query, sort]);
  const visible = filtered.slice(0, 120);
  const selected = new Set(selectedIds);

  return (
    <section className="surface overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-hairline px-6 py-4">
        <div className="section-title">{t(language, 'models.catalog')}</div>
        <span className="text-xs text-ink-muted">{tf(language, 'models.showing', { shown: visible.length, total: filtered.length })}</span>
      </div>
      <div className="grid gap-px border-b border-hairline bg-hairline md:grid-cols-[minmax(0,1fr)_170px_150px_130px]">
        <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
          {t(language, 'models.search')}
          <input className="field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
          {t(language, 'models.allAuthors')}
          <select className="field mt-1" value={author} onChange={(event) => setAuthor(event.target.value)}>
            <option value="">{t(language, 'models.allAuthors')}</option>
            {authors.map((item) => <option key={item} value={item}>{labName(item)}</option>)}
          </select>
        </label>
        <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
          {t(language, 'models.sort')}
          <select className="field mt-1" value={sort} onChange={(event) => setSort(event.target.value as SortKey)}>
            <option value="newest">{t(language, 'models.sortNewest')}</option>
            <option value="price">{t(language, 'models.sortPrice')}</option>
            <option value="name">{t(language, 'models.sortName')}</option>
          </select>
        </label>
        <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
          {t(language, 'models.maxPrice')}
          <input className="field mt-1 numeric text-right" type="number" min={0} step={1} value={maxPrice || ''} placeholder="∞" onChange={(event) => setMaxPrice(Number(event.target.value))} />
        </label>
      </div>
      <div className="max-h-[520px] overflow-y-auto">
        {visible.map((model) => {
          const isSelected = selected.has(model.id);
          return (
            <div key={model.id} className={`grid grid-cols-[minmax(0,1fr)_88px_120px_84px] items-center gap-2 border-b border-hairline px-4 py-3 ${isSelected ? 'bg-ink text-page' : 'bg-surface hover:bg-raised'}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{model.name}</span>
                  {isNew(model) ? <NewBadge language={language} inverted={isSelected} /> : null}
                </div>
                <div className={`truncate font-mono text-xs ${isSelected ? 'text-page' : 'text-ink-faint'}`}>{model.id}</div>
                <div className={`text-xs ${isSelected ? 'text-page' : 'text-ink-faint'}`}>{labName(model.author)}{ageLabel(model, language) ? ` · ${ageLabel(model, language)}` : ''}</div>
              </div>
              <div className="numeric text-right text-sm">{Math.round(model.contextLength / 1000)}k</div>
              <div className="numeric text-right text-xs">{formatPricePerMillion(model.pricing.promptPerToken)} / {formatPricePerMillion(model.pricing.completionPerToken)}</div>
              <button type="button" className={isSelected ? 'btn-secondary border-page text-page' : 'btn-secondary'} disabled={isSelected || selectedIds.length >= MAX_SLOTS} onClick={() => onAdd(model)}>
                {t(language, 'models.add')}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function NewBadge({ language, inverted = false }: { language: AppLanguage; inverted?: boolean }) {
  return <span className={`shrink-0 border px-1.5 py-px font-mono text-[10px] tracking-[0.12em] ${inverted ? 'border-page' : 'border-ink'}`}>{t(language, 'models.new')}</span>;
}

function ageLabel(model: ModelInfo | undefined, language: AppLanguage): string {
  const days = model ? ageDays(model) : undefined;
  if (days === undefined) return '';
  if (days < 1) return t(language, 'age.today');
  if (days < 60) return tf(language, 'age.days', { n: days });
  return tf(language, 'age.months', { n: Math.round(days / 30) });
}

function reasonLine(reason: SuggestionReason | 'manual', model: ModelInfo | undefined, language: AppLanguage): string {
  const lab = labName(model?.author ?? '');
  const text = tf(language, `reason.${reason}`, { lab });
  const age = ageLabel(model, language);
  return age ? `${text} · ${age}` : text;
}

function sameIds(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id) => b.includes(id));
}
