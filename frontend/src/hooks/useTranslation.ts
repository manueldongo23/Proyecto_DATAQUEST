import { useCallback } from 'react';
import { useLocaleStore } from '../store/localeStore';
import { translations } from '../i18n/translations';

export function useTranslation() {
  const locale = useLocaleStore((state) => state.locale);

  const t = useCallback((key: string, params?: Record<string, string>): string => {
    let text = translations[locale]?.[key] || translations['es']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        text = text.replace(`{{${k}}}`, v);
      });
    }
    return text;
  }, [locale]);

  return { t, locale };
}
