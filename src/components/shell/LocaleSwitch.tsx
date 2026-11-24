'use client';
import type { Locale } from '../../i18n/format';
import { useApp, useI18n } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

export function LocaleSwitch() {
  const { locale, setLocale } = useApp();
  const { t } = useI18n();
  return (
    <label className="lang">
      <Icon name="globe" />
      <select aria-label={t('Langue')} value={locale} onChange={(e) => void setLocale(e.target.value as Locale)}>
        <option value="fr">Français</option>
        <option value="en">English</option>
      </select>
    </label>
  );
}
