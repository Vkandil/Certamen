import { create } from 'zustand';
import { validateCredits, type CreditsInfo } from '../api/openrouter';
import type { AppLanguage } from '../ui/i18n';
import { deleteSetting, getSetting, setSetting } from './db';

const API_KEY = 'openrouter_api_key';
const UI_LANGUAGE = 'ui_language';
const THEME_MODE = 'theme_mode';

export type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsState {
  apiKey?: string;
  uiLanguage: AppLanguage;
  themeMode: ThemeMode;
  credits?: CreditsInfo;
  loading: boolean;
  error?: string;
  load: () => Promise<void>;
  validateAndSaveKey: (apiKey: string) => Promise<void>;
  clearKey: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  setUiLanguage: (language: AppLanguage) => Promise<void>;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  uiLanguage: 'en',
  themeMode: 'system',
  loading: false,
  async load() {
    const [apiKey, uiLanguage, themeMode] = await Promise.all([
      getSetting<string>(API_KEY),
      getSetting<AppLanguage>(UI_LANGUAGE),
      getSetting<ThemeMode>(THEME_MODE)
    ]);
    set({ apiKey, uiLanguage: uiLanguage ?? 'en', themeMode: themeMode ?? 'system' });
  },
  async validateAndSaveKey(apiKey: string) {
    set({ loading: true, error: undefined });
    try {
      const credits = await validateCredits(apiKey);
      await setSetting(API_KEY, apiKey);
      set({ apiKey, credits, loading: false });
    } catch (error) {
      set({ loading: false, error: apiErrorMessage(error) });
      throw error;
    }
  },
  async clearKey() {
    await deleteSetting(API_KEY);
    set({ apiKey: undefined, credits: undefined });
  },
  async refreshCredits() {
    const apiKey = get().apiKey;
    if (!apiKey) return;
    set({ loading: true, error: undefined });
    try {
      const credits = await validateCredits(apiKey);
      set({ credits, loading: false });
    } catch (error) {
      set({ loading: false, error: apiErrorMessage(error) });
    }
  },
  async setUiLanguage(language) {
    await setSetting(UI_LANGUAGE, language);
    set({ uiLanguage: language });
  },
  async setThemeMode(mode) {
    await setSetting(THEME_MODE, mode);
    set({ themeMode: mode });
  }
}));

export function maskedKey(apiKey?: string): string {
  if (!apiKey) return '';
  return `**** ${apiKey.slice(-4)}`;
}

function apiErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401|invalide|revoquee|invalid/i.test(message)) return 'Invalid or revoked key.';
  if (/Failed to fetch|NetworkError|CORS/i.test(message)) return 'Could not reach OpenRouter. Check your connection. If the browser reports CORS, the provider is blocking the backendless mode.';
  return message;
}
