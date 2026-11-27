'use client';
import { useI18n, useMe } from '../../lib/repo-context';
import { PERSONA_BY_ROLE } from '../../lib/session';
import { useDemoChosen } from '../demo/Welcome';
import { Icon } from '../ui/Icon';

const ROLES = [['associate', 'Associé'], ['analyst', 'Analyste'], ['admin', 'Administrateur']] as const;

/** Public demo only: says the data is fictitious and lets the visitor try each role. */
export function DemoBar() {
  const { t } = useI18n();
  const me = useMe();
  const [chosen, choose] = useDemoChosen();
  return (
    <div className="demobar" role="note">
      <div className="wrap">
        <span className="demotxt"><Icon name="info" /><b>{t('Démo publique')}</b>
          <span>{t('Données fictives, rien n’est enregistré : recharger la page remet la démo à zéro.')}</span>
          <a className="demoim" href="/demo/IM_Projet_Kepler_fictif.pdf" download>{t('IM fictif à importer (PDF)')}</a></span>
        <span className="demoroles">{t('Voir en tant que')}
          {ROLES.map(([role, label]) => {
            const on = chosen && me?.id === PERSONA_BY_ROLE[role].id;
            // No navigation: the in-memory deals (and any change made to them) carry over to the new role.
            return <button key={role} type="button" className={on ? 'on' : ''} aria-pressed={on} onClick={() => { void choose(role); }}>{t(label)}</button>;
          })}
        </span>
      </div>
    </div>
  );
}
