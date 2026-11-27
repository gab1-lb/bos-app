'use client';
import { useCallback, useState, useSyncExternalStore } from 'react';
import { useApp, useI18n } from '../../lib/repo-context';
import { PERSONA_BY_ROLE, rememberedDemoRole, type DemoRole } from '../../lib/session';
import { TourDialog } from '../home/TourCard';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';

/* Demo only. "Chosen" = a role remembered by the bos_as cookie at load, or one picked in this page life
   (welcome, demo bar, `?as=`). Module state, so it survives client-side navigation without any cookie. */
let picked = false;
let atLoad: boolean | undefined;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const isChosen = () => picked || (atLoad ??= rememberedDemoRole() !== null);

/** Whether the demo visitor has a role yet, and how to pick one (applied without navigation). */
export function useDemoChosen(): [boolean, (role: DemoRole) => Promise<void>] {
  const { switchPersona } = useApp();
  const chosen = useSyncExternalStore(subscribe, isChosen, () => false);
  const choose = useCallback(async (role: DemoRole) => {
    await switchPersona(PERSONA_BY_ROLE[role].id);
    picked = true;
    listeners.forEach((l) => l());
  }, [switchPersona]);
  return [chosen, choose];
}

const ROLES: [DemoRole, string, string][] = [
  ['associate', 'Je suis associate', 'Relire et valider le BOTe d’un dossier en revue, puis préparer le comité.'],
  ['analyst', 'Je suis analyste', 'Importer un IM, compléter les données et rédiger le BOTe.'],
];

/** Démo publique : première arrivée sans rôle choisi. */
export function Welcome() {
  const { t, locale } = useI18n();
  const [, choose] = useDemoChosen();
  const [video, setVideo] = useState(false);
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
            <button type="button" className={`card wl-role ${i === 0 ? 'rec' : ''}`} onClick={() => { void choose(role); }}>
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
