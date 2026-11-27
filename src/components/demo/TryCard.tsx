'use client';
import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { DealRecord } from '../../data/repo';
import { demoSteps, latchDone, useDemoSignals, useLatchedDone, type StepId } from '../../lib/demo/progress';
import { useI18n, useMe, useRepo } from '../../lib/repo-context';
import { Icon } from '../ui/Icon';

const LABEL: Record<StepId, string> = {
  review_atlas: 'Relire le BOTe d’Atlas, puis le valider ou le renvoyer',
  open_synthese: 'Ouvrir une synthèse et ses données manquantes',
  committee_msg: 'Préparer le message au comité (Cérès)',
  import_im: 'Importer l’IM fictif Kepler',
  fill_missing: 'Compléter une donnée manquante',
  write_bote: 'Passer un dossier en « BOTe rédigé »',
  director_msg: 'Écrire au dirigeant',
  feedback: 'Donner mon avis',
};

/** Démo publique : « À essayer », une courte liste qui se coche toute seule au fil de la visite. */
export function TryCard({ onFeedback }: { onFeedback?: () => void }) {
  const repo = useRepo();
  const me = useMe();
  const { t } = useI18n();
  const signals = useDemoSignals();
  const latched = useLatchedDone();
  const uid = useId();
  const [open, setOpen] = useState(true);
  const [deals, setDeals] = useState<DealRecord[]>([]);

  const seq = useRef(0);
  const load = useCallback(async () => {
    const req = ++seq.current;
    const items = await repo.listDeals().catch(() => null);
    if (items && req === seq.current) setDeals(items);
  }, [repo]);
  useEffect(() => {
    void load();
    return repo.subscribe(null, () => { void load(); });
  }, [repo, load]);

  const steps = demoSteps(me?.role === 'analyst' ? 'analyst' : 'associate', deals, signals, latched);
  const doneKey = steps.filter((s) => s.done).map((s) => s.id).join(' ');
  // Once ticked, a step stays ticked for the page life (Atlas sent back then re-sent, a deal moved past « BOTe rédigé »…).
  useEffect(() => { if (me && doneKey) latchDone(doneKey.split(' ')); }, [me, doneKey]);

  // No list before the member is known: the role decides which list, so no flash of the wrong one.
  if (!me) return null;
  const count = steps.filter((s) => s.done).length;
  const title = t('À essayer');

  return (
    <section className="card trycard" data-try aria-labelledby={`${uid}-h`}>
      <div className="try-head">
        <button type="button" className="toggle" aria-expanded={open} aria-controls={`${uid}-p`}
          aria-label={t(open ? 'Replier {0}' : 'Déplier {0}', title)} onClick={() => setOpen((o) => !o)}>
          <Icon name="chev" />
        </button>
        <h2 id={`${uid}-h`}>{title}</h2>
        <span className={`try-count ${count === steps.length ? 'all' : ''}`} data-try-count
          aria-label={t('{0} sur {1} faits', count, steps.length)}>{count} / {steps.length}</span>
      </div>
      {open && (
        <ol id={`${uid}-p`} className="try-steps">
          {steps.map((s) => {
            const label = t(LABEL[s.id]);
            return (
              <li key={s.id} className={`try-step ${s.done ? 'done' : ''}`} data-step={s.id} data-done={s.done}>
                <span className="try-box" aria-hidden="true">{s.done && <Icon name="check" />}</span>
                <span className="try-text">
                  {s.href ? <Link className="try-label" href={s.href}>{label}</Link>
                    : s.id === 'feedback' ? <button type="button" className="try-label" onClick={() => onFeedback?.()}>{label}</button>
                    : <span className="try-label">{label}</span>}
                  {s.done && <span className="sr-only"> ({t('fait')})</span>}
                  {s.id === 'import_im' && (
                    <a className="try-dl" href="/demo/IM_Projet_Kepler_fictif.pdf" download><Icon name="download" />{t('IM fictif à importer (PDF)')}</a>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
