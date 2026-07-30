import { useState } from 'react';
import { clearAllData } from '../../store/db';
import { useRunStore } from '../../store/runStore';
import { maskedKey, useSettingsStore, type ThemeMode } from '../../store/settingsStore';
import { languageNames, t, type AppLanguage } from '../i18n';

export function SettingsScreen() {
  const apiKey = useSettingsStore((state) => state.apiKey);
  const credits = useSettingsStore((state) => state.credits);
  const clearKey = useSettingsStore((state) => state.clearKey);
  const refreshCredits = useSettingsStore((state) => state.refreshCredits);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const setUiLanguage = useSettingsStore((state) => state.setUiLanguage);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const loadModels = useRunStore((state) => state.loadModels);
  const [confirm, setConfirm] = useState('');

  return (
    <div className="space-y-6">
      <div>
        <div className="section-title">TABULAE</div>
        <p className="mt-1 text-sm text-ink-muted">settings</p>
      </div>
      <div className="grid gap-px bg-hairline lg:grid-cols-2">
        <section className="bg-surface p-6">
          <div className="section-title">{t(uiLanguage, 'settings.keyCredits')}</div>
          <div className="numeric mt-6 border border-hairline bg-raised p-3 text-sm">{maskedKey(apiKey)}</div>
          <div className="mt-4 text-sm text-ink-muted">
            {t(uiLanguage, 'settings.balance')}: {credits ? `${credits.remainingCredits.toFixed(4)} USD` : t(uiLanguage, 'settings.notLoaded')}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-secondary" onClick={() => void refreshCredits()}>{t(uiLanguage, 'settings.refreshCredits')}</button>
            <button className="btn-secondary" onClick={() => void clearKey()}>{t(uiLanguage, 'settings.clearKey')}</button>
          </div>
        </section>

        <section className="bg-surface p-6">
          <div className="section-title">{t(uiLanguage, 'settings.catalogData')}</div>
          <label className="mt-6 block text-sm font-medium">
            {t(uiLanguage, 'settings.uiLanguage')}
            <select className="field mt-2" value={uiLanguage} onChange={(event) => void setUiLanguage(event.target.value as AppLanguage)}>
              {(Object.keys(languageNames) as AppLanguage[]).map((language) => (
                <option key={language} value={language}>{languageNames[language]}</option>
              ))}
            </select>
          </label>
          <label className="mt-6 block text-sm font-medium">
            {t(uiLanguage, 'settings.theme')}
            <select className="field mt-2" value={themeMode} onChange={(event) => void setThemeMode(event.target.value as ThemeMode)}>
              <option value="system">{t(uiLanguage, 'settings.themeSystem')}</option>
              <option value="light">{t(uiLanguage, 'settings.themeLight')}</option>
              <option value="dark">{t(uiLanguage, 'settings.themeDark')}</option>
            </select>
          </label>
          <button className="btn-secondary mt-6" onClick={() => void loadModels(apiKey, true)}>{t(uiLanguage, 'settings.refreshCatalog')}</button>
          <div className="mt-8 border-t border-hairline-strong pt-6">
            <label className="block text-sm">
              {t(uiLanguage, 'settings.deletePrompt')}
              <input className="field mt-2" value={confirm} onChange={(event) => setConfirm(event.target.value)} />
            </label>
            <button
              className="btn-danger mt-4"
              disabled={confirm !== 'DELETE'}
              onClick={async () => {
                await clearAllData();
                location.reload();
              }}
            >
              {t(uiLanguage, 'settings.deleteAll')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
