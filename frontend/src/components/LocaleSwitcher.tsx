import React from 'react';
import { useLocaleStore } from '../store/localeStore';
import type { Locale } from '../i18n/translations';

const locales: { code: Locale; label: string; flag: string }[] = [
  { code: 'es', label: 'ES', flag: '🇪🇸' },
  { code: 'en', label: 'EN', flag: '🇺🇸' },
  { code: 'pt-BR', label: 'PT', flag: '🇧🇷' },
];

export const LocaleSwitcher: React.FC = () => {
  const { locale, setLocale } = useLocaleStore();

  return (
    <div className="flex items-center gap-1">
      {locales.map((l) => (
        <button
          key={l.code}
          onClick={() => setLocale(l.code)}
          aria-label={`Cambiar idioma a ${l.label}`}
          aria-current={locale === l.code ? 'true' : undefined}
          className={`px-2 py-1 text-xs rounded font-medium transition-all ${
            locale === l.code
              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
              : 'text-slate-500 hover:text-slate-300 border border-transparent'
          }`}
          title={l.label}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
};
