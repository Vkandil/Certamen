import { useEffect, useMemo, useState } from 'react';
import logoTransparent from './assets/certamen-logo-transparent.png';
import { markInterruptedRuns, purgeOldDrafts } from './store/db';
import { useRunStore } from './store/runStore';
import { useSettingsStore } from './store/settingsStore';
import { CertamenView } from './ui/screens/CertamenView';
import { Composer } from './ui/screens/Composer';
import { Historia } from './ui/screens/Historia';
import { Onboarding } from './ui/screens/Onboarding';
import { SettingsScreen } from './ui/screens/SettingsScreen';
import { Guide } from './ui/screens/Guide';
import { languageNames, t, type AppLanguage } from './ui/i18n';

type Route = 'composer' | 'certamen' | 'historia' | 'settings' | 'guide';

export default function App() {
  const [route, setRoute] = useState<Route>(routeFromLocation());
  const apiKey = useSettingsStore((state) => state.apiKey);
  const uiLanguage = useSettingsStore((state) => state.uiLanguage);
  const themeMode = useSettingsStore((state) => state.themeMode);
  const setUiLanguage = useSettingsStore((state) => state.setUiLanguage);
  const loadSettings = useSettingsStore((state) => state.load);
  const loadModels = useRunStore((state) => state.loadModels);
  const loadHistory = useRunStore((state) => state.loadHistory);
  const current = useRunStore((state) => state.current);

  useEffect(() => {
    void (async () => {
      await markInterruptedRuns();
      await purgeOldDrafts();
      await loadSettings();
      await loadHistory();
    })();
  }, [loadHistory, loadSettings]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode === 'system' ? '' : themeMode;
  }, [themeMode]);

  useEffect(() => {
    if (apiKey) void loadModels(apiKey);
  }, [apiKey, loadModels]);

  useEffect(() => {
    const onPop = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (current?.status === 'running') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [current?.status]);

  const content = useMemo(() => {
    if (route === 'guide') return <Guide />;
    if (!apiKey) return <Onboarding />;
    if (route === 'historia') return <Historia navigate={navigate(setRoute)} />;
    if (route === 'settings') return <SettingsScreen />;
    if (route === 'certamen') return <CertamenView />;
    return <Composer navigate={navigate(setRoute)} />;
  }, [apiKey, route]);

  return (
    <div className="min-h-screen bg-page text-ink">
      <header className="border-b border-hairline-strong">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <button className="flex items-center gap-3 text-left" onClick={() => navigate(setRoute)('/')}>
            <img src={logoTransparent} alt="" className="h-8 w-8 object-contain" />
            <span>
              <span className="block font-display text-base font-medium leading-5">Certamen</span>
              <span className="hidden text-xs text-ink-muted sm:block">multi-model debate</span>
            </span>
          </button>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-1" aria-label="Main navigation">
              {apiKey ? (
                <>
                  <NavButton label={t(uiLanguage, 'nav.compose')} active={route === 'composer'} onClick={() => navigate(setRoute)('/')} />
                  <NavButton label={t(uiLanguage, 'nav.history')} active={route === 'historia'} onClick={() => navigate(setRoute)('/historia')} />
                  <NavButton label={t(uiLanguage, 'nav.settings')} active={route === 'settings'} onClick={() => navigate(setRoute)('/settings')} />
                </>
              ) : null}
              <NavButton label="Guide" active={route === 'guide'} onClick={() => navigate(setRoute)('/guide')} />
            </nav>
            {!apiKey ? <span className="hidden text-sm text-ink-muted sm:inline">{t(uiLanguage, 'nav.localKey')}</span> : null}
            <label className="hidden items-center gap-2 border-l border-hairline-strong pl-4 text-xs text-ink-muted sm:flex">
              <span>LANG</span>
              <select className="bg-transparent outline-none" value={uiLanguage} onChange={(event) => void setUiLanguage(event.target.value as AppLanguage)}>
                {(Object.keys(languageNames) as AppLanguage[]).map((language) => (
                  <option key={language} value={language}>{languageNames[language]}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{content}</main>
    </div>
  );
}

function NavButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button className={`h-10 border px-3 text-sm transition ${active ? 'border-ink bg-ink text-page' : 'border-transparent text-ink-muted hover:border-hairline-strong hover:text-ink'}`} onClick={onClick}>
      {label}
    </button>
  );
}

function routeFromLocation(): Route {
  const pathname = stripBasePath(location.pathname);
  if (pathname.startsWith('/historia')) return 'historia';
  if (pathname.startsWith('/settings')) return 'settings';
  if (pathname.startsWith('/guide')) return 'guide';
  if (pathname.startsWith('/certamen')) return 'certamen';
  return 'composer';
}

function navigate(setRoute: (route: Route) => void) {
  return (path: string) => {
    history.pushState(null, '', withBasePath(path));
    setRoute(routeFromLocation());
  };
}

function stripBasePath(pathname: string): string {
  const base = appBasePath();
  if (base === '/') return pathname;
  const withoutTrailingSlash = base.slice(0, -1);
  if (pathname === withoutTrailingSlash) return '/';
  if (pathname.startsWith(base)) return `/${pathname.slice(base.length)}`;
  return pathname;
}

function withBasePath(path: string): string {
  const base = appBasePath();
  if (base === '/') return path;
  return `${base.slice(0, -1)}${path}`;
}

function appBasePath(): string {
  const base = import.meta.env.BASE_URL || '/';
  if (!base || base === './') return '/';
  return base.startsWith('/') ? (base.endsWith('/') ? base : `${base}/`) : '/';
}
