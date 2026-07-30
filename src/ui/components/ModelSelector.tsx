import { useMemo, useState } from 'react';
import { formatPricePerMillion } from '../../api/models';
import type { ModelInfo } from '../../domain/types';
import { t, type AppLanguage } from '../i18n';

export interface SelectedModel {
  modelId: string;
  temperature?: number;
  systemPromptExtra?: string;
}

export function ModelSelector({
  models,
  selected,
  onChange,
  language
}: {
  models: ModelInfo[];
  selected: SelectedModel[];
  onChange: (selected: SelectedModel[]) => void;
  language: AppLanguage;
}) {
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('');
  const [minContext, setMinContext] = useState(0);
  const [maxPrice, setMaxPrice] = useState(20);
  const authors = useMemo(() => [...new Set(models.map((model) => model.author))].sort(), [models]);
  const highlights = useMemo(() => buildHighlights(models), [models]);
  const selectedIds = useMemo(() => new Set(selected.map((item) => item.modelId)), [selected]);
  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return models
      .filter((model) => !author || model.author === author)
      .filter((model) => model.contextLength >= minContext)
      .filter((model) => totalPrice(model) <= maxPrice)
      .filter((model) => !normalized || `${model.name} ${model.id}`.toLowerCase().includes(normalized))
      .slice(0, 80);
  }, [author, maxPrice, minContext, models, query]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_384px]">
      <section className="surface overflow-hidden">
        <div className="border-b border-hairline p-6">
          <div className="section-title">CONTENTIO</div>
          <p className="mt-1 text-sm text-ink-muted">{t(language, 'models.subtitle')}</p>
          <div className="mt-6 grid gap-px bg-hairline md:grid-cols-4">
            <HighlightCard title="OpenAI" model={highlights.openai} onAdd={addModel} />
            <HighlightCard title="Claude" model={highlights.claude} onAdd={addModel} />
            <HighlightCard title="Kimi" model={highlights.kimi} onAdd={addModel} />
            <HighlightCard title="Gemini" model={highlights.gemini} onAdd={addModel} />
          </div>
        </div>

        <div className="grid gap-px border-b border-hairline bg-hairline md:grid-cols-[minmax(0,1fr)_180px_144px_144px]">
          <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
            {t(language, 'models.search')}
            <input className="field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
            {t(language, 'models.allAuthors')}
            <select className="field mt-1" value={author} onChange={(event) => setAuthor(event.target.value)}>
              <option value="">{t(language, 'models.allAuthors')}</option>
              {authors.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
            {t(language, 'models.minContext')}
            <input className="field mt-1 numeric text-right" type="number" min={0} step={1000} value={minContext} onChange={(event) => setMinContext(Number(event.target.value))} />
          </label>
          <label className="bg-surface px-4 py-3 text-xs text-ink-muted">
            {t(language, 'models.maxPrice')}
            <input className="field mt-1 numeric text-right" type="number" min={0} step={1} value={maxPrice} onChange={(event) => setMaxPrice(Number(event.target.value))} />
          </label>
        </div>

        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_96px_112px_96px] border-b border-hairline-strong bg-raised px-4 py-2 text-left text-xs">
            <div className="section-title">{t(language, 'models.catalog')}</div>
            <div className="section-title text-right">CTX</div>
            <div className="section-title text-right">PRICE</div>
            <div />
          </div>
          <div className="max-h-[520px] overflow-y-auto">
            {visible.map((model) => {
              const slotIndex = selected.findIndex((item) => item.modelId === model.id);
              return (
                <div key={model.id} className={`grid grid-cols-[minmax(0,1fr)_96px_112px_96px] items-center border-b border-hairline px-4 py-3 transition hover:bg-raised ${selectedIds.has(model.id) ? 'bg-ink text-page' : 'bg-surface'}`}>
                  <div className="min-w-0 border-l-0 pl-0" style={slotIndex >= 0 ? { borderLeft: `3px solid var(--p-${slotIndex % 4 + 1})`, paddingLeft: 12 } : undefined}>
                    <div className="truncate text-sm font-medium">{model.name}</div>
                    <div className={`truncate font-mono text-xs ${selectedIds.has(model.id) ? 'text-page' : 'text-ink-faint'}`}>{model.id}</div>
                    <div className={`text-xs ${selectedIds.has(model.id) ? 'text-page' : 'text-ink-faint'}`}>{model.author}</div>
                  </div>
                  <div className="numeric text-right text-sm">{Math.round(model.contextLength / 1000)}k</div>
                  <div className="numeric text-right text-xs">{formatPricePerMillion(model.pricing.promptPerToken)} / {formatPricePerMillion(model.pricing.completionPerToken)}</div>
                  <button className={selectedIds.has(model.id) ? 'btn-secondary border-page text-page hover:bg-page hover:text-ink' : 'btn-secondary'} disabled={selected.length >= 8} onClick={() => addModel(model)}>
                    {t(language, 'models.add')}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="surface p-6">
        <div className="section-title">ORDO</div>
        <p className="mt-1 text-sm text-ink-muted">{t(language, 'models.team')}</p>
        <div className="mt-6 space-y-4">
          {selected.map((item, index) => {
            const model = models.find((candidate) => candidate.id === item.modelId);
            return (
              <div key={`${item.modelId}-${index}`} className="border border-hairline bg-raised">
                <div className="participant-bar h-1" data-slot={String(index)} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display text-2xl font-medium">{String.fromCharCode(65 + index)}</div>
                      <div className="truncate text-sm font-medium">{model?.name ?? item.modelId}</div>
                      <div className="truncate font-mono text-xs text-ink-faint">{item.modelId}</div>
                    </div>
                    <button className="btn-secondary h-8 px-2 text-xs" onClick={() => onChange(selected.filter((_, selectedIndex) => selectedIndex !== index))}>
                      {t(language, 'models.remove')}
                    </button>
                  </div>
                  <label className="mt-4 block text-xs text-ink-muted">
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
                  <label className="mt-3 block text-xs text-ink-muted">
                    {t(language, 'models.role')}
                    <input className="field mt-1" value={item.systemPromptExtra ?? ''} placeholder="advocatus diaboli, security specialist..." onChange={(event) => update(index, { systemPromptExtra: event.target.value })} />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
        {selected.length < 2 ? <p className="mt-4 border-l-2 border-danger pl-3 text-sm text-danger">{t(language, 'models.minTwo')}</p> : null}
        {selected.length > 5 ? <p className="mt-4 border-l-2 border-ink pl-3 text-sm text-ink-muted">{t(language, 'models.costWarning')}</p> : null}
      </section>
    </div>
  );

  function addModel(model: ModelInfo) {
    if (selected.length >= 8) return;
    onChange([...selected, { modelId: model.id, temperature: 0.7 }]);
  }

  function update(index: number, patch: Partial<SelectedModel>) {
    onChange(selected.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }
}

function HighlightCard({ title, model, onAdd }: { title: string; model?: ModelInfo; onAdd: (model: ModelInfo) => void }) {
  if (!model) return null;
  return (
    <button className="bg-raised p-4 text-left transition hover:bg-ink hover:text-page" onClick={() => onAdd(model)}>
      <div className="section-title">{title}</div>
      <div className="mt-3 truncate text-sm font-medium">{model.name}</div>
      <div className="mt-1 truncate font-mono text-xs">{model.id}</div>
    </button>
  );
}

function buildHighlights(models: ModelInfo[]): Record<'openai' | 'claude' | 'kimi' | 'gemini', ModelInfo | undefined> {
  return {
    openai: pickByPriority(models, [
      'openai/gpt-5.6-sol-pro',
      'openai/gpt-5.6-sol',
      'openai/gpt-5.6-luna-pro',
      'openai/gpt-5.6-terra-pro',
      'openai/gpt-5.5-pro',
      'openai/gpt-5.4-pro',
      'openai/gpt-5.3-chat'
    ], ['openai', 'gpt-5.6', 'gpt-5']),
    claude: pickByPriority(models, [
      'anthropic/claude-opus-5-fast',
      'anthropic/claude-opus-5',
      'anthropic/claude-sonnet-5',
      '~anthropic/claude-opus-latest',
      '~anthropic/claude-sonnet-latest',
      'anthropic/claude-fable-5'
    ], ['anthropic', 'claude', 'opus']),
    kimi: pickByPriority(models, [
      'moonshotai/kimi-k3',
      '~moonshotai/kimi-latest',
      'moonshotai/kimi-k2.7-code',
      'moonshotai/kimi-k2.6',
      'moonshotai/kimi-k2.5'
    ], ['moonshotai', 'kimi']),
    gemini: pickByPriority(models, [
      'google/gemini-3.6-flash',
      '~google/gemini-pro-latest',
      '~google/gemini-flash-latest',
      'google/gemini-3.5-flash',
      'google/gemini-3.1-pro-preview'
    ], ['google', 'gemini'])
  };
}

function pickByPriority(models: ModelInfo[], exactIds: string[], includes: string[]): ModelInfo | undefined {
  for (const id of exactIds) {
    const exact = models.find((model) => model.id === id);
    if (exact) return exact;
  }
  return [...models]
    .filter((model) => includes.every((needle) => `${model.id} ${model.name}`.toLowerCase().includes(needle)))
    .sort((a, b) => recencyScore(b) - recencyScore(a) || b.contextLength - a.contextLength || totalPrice(a) - totalPrice(b))[0];
}

function recencyScore(model: ModelInfo): number {
  const text = `${model.id} ${model.name}`.toLowerCase();
  const version = text.match(/(?:gpt-|opus-|sonnet-|gemini-|kimi-k|glm-|qwen)(\d+(?:\.\d+)?)/)?.[1];
  const numeric = version ? Number(version) : 0;
  const latest = text.includes('latest') ? 100 : 0;
  const fastPenalty = text.includes('lite') || text.includes('nano') ? -5 : 0;
  return latest + numeric + fastPenalty;
}

function totalPrice(model: ModelInfo): number {
  return (model.pricing.promptPerToken + model.pricing.completionPerToken) * 1_000_000;
}
