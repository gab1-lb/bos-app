'use client';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { useDemoChosen } from '../../lib/demo/role';
import { useI18n } from '../../lib/repo-context';
import type { DemoRole } from '../../lib/session';
import { TourDialog } from '../home/TourCard';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';

const ROLES: [DemoRole, string, string][] = [
  ['associate', 'Je suis associate', 'Relire et valider le BOTe d’un dossier en revue, puis préparer le comité.'],
  ['analyst', 'Je suis analyste', 'Importer un IM, compléter les données et rédiger le BOTe.'],
];

/** Démo publique : première arrivée sans rôle choisi. */
export function Welcome() {
  const { t, locale } = useI18n();
  const [, choose] = useDemoChosen();
  const router = useRouter();
  const path = usePathname();
  const [video, setVideo] = useState(false);
  // The choice leads to the Accueil in that role, whatever page the visitor arrived on.
  const enter = async (role: DemoRole) => {
    await choose(role);
    if (path !== '/') router.push('/');
  };
  return (
    <div className="welcome">
      <Reveal as="section" className="hero">
        {/* eslint-disable-next-line @next/next/no-img-element -- decorative static SVG */}
        <img className="terrain" src="/terrain.svg" alt="" />
        <div className="eyebrow"><Icon name="info" />{t('Démo publique')}</div>
        <h1>{t('Bienvenue dans la démo BOS')}</h1>
        <p>{t('L’outil de l’analyste M&A pour le BOTe : de l’IM reçu à la décision du comité.')}<br />
          {t('Données fictives, rien n’est enregistré.')}</p>
        <div className="herofoot">
          <button type="button" className="link wl-video" onClick={() => setVideo(true)}>
            <Icon name="play" />{t('Voir la vidéo (1 min)')}
          </button>
        </div>
      </Reveal>
      <div className="wl-roles">
        {ROLES.map(([role, title, line], i) => (
          <Reveal key={role} index={i + 1}>
            <button type="button" className={`card wl-role ${i === 0 ? 'rec' : ''}`} onClick={() => { void enter(role); }}>
              <span className="wl-top"><b>{t(title)}</b>{i === 0 && <span className="wl-badge">{t('Recommandé')}</span>}</span>
              <span className="wl-sub">{t(line)}</span>
              <span className="link wl-go">{t('Entrer dans la démo')}<Icon name="chev" /></span>
            </button>
          </Reveal>
        ))}
      </div>
      {video && <TourDialog title={t('Prendre en main BOS')} locale={locale} onClose={() => setVideo(false)} />}
    </div>
  );
}
