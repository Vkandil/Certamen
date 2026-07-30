import { useState } from 'react';
import logoTransparent from '../../assets/certamen-logo-transparent.png';
import { useSettingsStore } from '../../store/settingsStore';
import { languageNames, t, type AppLanguage } from '../i18n';

export function Onboarding() {
  const [apiKey, setApiKey] = useState('');
  const [visible, setVisible] = useState(false);
  const validateAndSaveKey = useSettingsStore((state) => state.validateAndSaveKey);
  const loading = useSettingsStore((state) => state.loading);
  const error = useSettingsStore((state) => state.error);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const setUiLanguage = useSettingsStore((state) => state.setUiLanguage);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_424px]">
      <section className="surface baseline-grid flex min-h-[424px] flex-col justify-between p-8">
        <div>
          <div className="section-title">QUAESTIO</div>
          <h1 className="mt-4 max-w-[12ch] font-display text-5xl font-medium leading-tight tracking-normal">Certamen</h1>
          <p className="mt-4 max-w-[58ch] text-base text-ink-muted">
            Multi-model debate, locally controlled. Compare independent answers, force a structured disputatio, and get an arbitrated synthesis without a backend.
          </p>
        </div>
        <div className="grid gap-px border border-hairline bg-hairline sm:grid-cols-3">
          <TrustItem title="Local key" body="IndexedDB only" />
          <TrustItem title="Auditable" body="Every prompt logged" />
          <TrustItem title="Exportable" body="Markdown and JSON" />
        </div>
      </section>

      <section className="surface bg-raised p-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src={logoTransparent} alt="" className="h-12 w-12 object-contain" />
            <div>
              <h2 className="text-xl font-medium">{t(uiLanguage, 'onboarding.title')}</h2>
              <a className="text-sm text-ink underline decoration-hairline-strong underline-offset-4" href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer">
                {t(uiLanguage, 'onboarding.link')}
              </a>
            </div>
          </div>
          <label className="flex items-center gap-2 border-l border-hairline-strong pl-3 text-xs text-ink-muted">
            <span>LANG</span>
            <select className="bg-transparent outline-none" value={uiLanguage} onChange={(event) => void setUiLanguage(event.target.value as AppLanguage)}>
              {(Object.keys(languageNames) as AppLanguage[]).map((language) => (
                <option key={language} value={language}>{languageNames[language]}</option>
              ))}
            </select>
          </label>
        </div>
        <form
          className="space-y-6"
          onSubmit={(event) => {
            event.preventDefault();
            void validateAndSaveKey(apiKey.trim()).catch(() => undefined);
          }}
        >
          <label className="block text-sm font-medium">
            {t(uiLanguage, 'onboarding.field')}
            <div className="mt-2 flex gap-3">
              <input className="field" type={visible ? 'text' : 'password'} value={apiKey} onChange={(event) => setApiKey(event.target.value)} autoComplete="off" />
              <button className="btn-secondary w-16 px-2" type="button" onClick={() => setVisible((value) => !value)}>
                {visible ? t(uiLanguage, 'onboarding.hide') : t(uiLanguage, 'onboarding.show')}
              </button>
            </div>
          </label>
          <p className="border-l-2 border-ink pl-3 text-sm text-ink-muted">{t(uiLanguage, 'onboarding.note')}</p>
          {error ? <p className="border-l-2 border-danger pl-3 text-sm text-danger">{error}</p> : null}
          <button className="btn-primary w-full" disabled={!apiKey.trim() || loading}>
            {loading ? '...' : t(uiLanguage, 'onboarding.validate')}
          </button>
        </form>
      </section>
    </div>
  );
}

function TrustItem({ title, body }: { title: string; body: string }) {
  return (
    <div className="bg-raised p-4">
      <div className="text-sm font-medium">{title}</div>
      <div className="mt-1 text-xs text-ink-muted">{body}</div>
    </div>
  );
}
