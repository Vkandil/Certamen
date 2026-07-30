import { useMemo, useState } from 'react';
import { useRunStore } from '../../store/runStore';
import { useSettingsStore } from '../../store/settingsStore';
import { StatusPill } from '../components/StatusPill';
import { t } from '../i18n';

export function Historia({ navigate }: { navigate: (path: string) => void }) {
  const history = useRunStore((state) => state.history);
  const setCurrent = useRunStore((state) => state.setCurrent);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const [query, setQuery] = useState('');
  const visible = useMemo(() => {
    const q = query.toLowerCase();
    return history.filter((item) => !q || `${item.quaestio.text} ${item.modelIds?.join(' ')}`.toLowerCase().includes(q));
  }, [history, query]);

  return (
    <div className="space-y-6">
      <div>
        <div className="section-title">HISTORIA</div>
        <p className="mt-1 text-sm text-ink-muted">past runs</p>
      </div>
      <label className="surface block p-4 text-xs text-ink-muted">
        {t(uiLanguage, 'history.search')}
        <input className="field mt-1" value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <div className="surface overflow-hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_144px_112px] border-b border-hairline-strong bg-raised px-4 py-2">
          <div className="section-title">Quaestio</div>
          <div className="section-title text-right">Cost</div>
          <div className="section-title text-right">Status</div>
        </div>
        {visible.map((certamen) => (
          <button
            key={certamen.id}
            className="grid w-full grid-cols-[minmax(0,1fr)_144px_112px] items-center border-b border-hairline px-4 py-4 text-left transition hover:bg-raised"
            onClick={async () => {
              await setCurrent(certamen.id);
              navigate(`/certamen/${certamen.id}`);
            }}
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{certamen.quaestio.text}</span>
              <span className="mt-1 block truncate text-xs text-ink-muted">{new Date(certamen.startedAt).toLocaleString()} - {certamen.modelIds?.join(', ')}</span>
            </span>
            <span className="numeric text-right text-sm">{certamen.totalCostUsd.toFixed(4)} USD</span>
            <span className="flex justify-end"><StatusPill status={certamen.status} /></span>
          </button>
        ))}
        {visible.length === 0 ? <div className="p-6 text-sm text-ink-muted">{t(uiLanguage, 'history.empty')}</div> : null}
      </div>
    </div>
  );
}
