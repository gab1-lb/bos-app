'use client';
import { useI18n, useMe } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

const ROLES = [['analyst', 'Analyste'], ['associate', 'Associé'], ['admin', 'Administrateur']] as const;

/** Public demo only: says the data is fictitious and lets the visitor try each role. */
export function DemoBar() {
  const { t } = useI18n();
  const me = useMe();
  return (
    <div className="demobar" role="note">
      <div className="wrap">
        <span className="demotxt"><Icon name="info" /><b>{t('Démo publique')}</b>
          <span>{t('Données fictives, rien n’est enregistré : recharger la page remet la démo à zéro.')}</span>
          <a className="demoim" href="/demo/IM_Projet_Kepler_fictif.pdf" download>{t('IM fictif à importer (PDF)')}</a></span>
        <span className="demoroles">{t('Voir en tant que')}
          {ROLES.map(([role, label]) => (
            // Full navigation on purpose: the role is chosen by the sign-in route.
            <a key={role} href={`/login?as=${role}`} className={me?.role === role ? 'on' : ''} aria-current={me?.role === role ? 'true' : undefined}>{t(label)}</a>
          ))}
        </span>
      </div>
    </div>
  );
}
