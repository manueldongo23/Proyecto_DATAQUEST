import { create } from 'zustand';
import type { Locale } from '../i18n/translations';

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const stored = (typeof localStorage !== 'undefined' ? localStorage.getItem('locale') : null) as Locale | null;

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: stored || 'es',
  setLocale: (locale: Locale) => {
    localStorage.setItem('locale', locale);
    set({ locale });
  },
}));
