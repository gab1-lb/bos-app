'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { Locale } from '../../i18n/format';
import { useI18n } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';
import meta from './tour-meta.json';

export const tourSrc = (locale: Locale) => `/tour-${locale}.mp4`;
export const TOUR_POSTER = '/tour-poster.jpg';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/** Carte « Prendre en main BOS » : vignette, puis la vidéo de démonstration (régénérée par `npm run record:tour`). */
export function TourCard() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const title = t('Prendre en main BOS');
  return (
    <>
      <button type="button" className="card tourcard" onClick={() => setOpen(true)}>
        <span className="tc-thumb">
          {/* eslint-disable-next-line @next/next/no-img-element -- static poster, no optimisation needed */}
          <img src={TOUR_POSTER} alt="" width={1440} height={900} loading="lazy" />
          <span className="tc-play" aria-hidden="true"><Icon name="play" /></span>
          <span className="tc-dur" data-duration>{clock(meta[locale] ?? meta.fr)}</span>
        </span>
        <span className="tc-text">
          <span className="eyebrow"><Icon name="play" />{t('Démonstration')}</span>
          <span className="tc-title">{title}</span>
          <span className="tc-sub">{t('De l’import de l’IM à la note de comité.')}</span>
          <span className="link tc-cta">{t('Voir la vidéo')}<Icon name="chev" /></span>
        </span>
      </button>
      {open && <TourDialog title={title} locale={locale} onClose={() => setOpen(false)} />}
    </>
  );
}

function TourDialog({ title, locale, onClose }: { title: string; locale: Locale; onClose(): void }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const uid = useId();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} className="tourdlg" aria-labelledby={`${uid}-h`} onClose={onClose} onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <header>
        <h3 id={`${uid}-h`}>{title}</h3>
        <button type="button" className="iconbtn close" aria-label={t('Fermer')} onClick={onClose}><Icon name="x" /></button>
      </header>
      {/* Sous-titres incrustés dans l'image : pas de piste séparée. */}
      <video src={tourSrc(locale)} poster={TOUR_POSTER} controls autoPlay muted playsInline preload="auto" />
    </dialog>
  );
}
