'use client';
import { useI18n, useMe } from '../../lib/repo-context';

/** Page provisoire (contenu livré par les tâches suivantes). */
export function Placeholder({ title, adminOnly = false }: { title: string; adminOnly?: boolean }) {
  const { t } = useI18n();
  const me = useMe();
  const denied = adminOnly && me && me.role !== 'admin';
  return (
    <div className="pagehead" style={{ marginTop: 4 }}>
      <div>
        <h1>{t(title)}</h1>
        <p className="note" style={{ marginTop: 10 }}>{denied ? t('Réservé aux administrateurs.') : t('Cette page arrive bientôt.')}</p>
      </div>
    </div>
  );
}
