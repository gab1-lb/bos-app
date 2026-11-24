'use client';
import { useEffect, useRef, useState } from 'react';
import type { ActivityEntry } from '../../data/repo';
import { decisionLabel, phaseLabel, type Decision, type Phase } from '../../domain/phases';
import { useI18n, useRepo } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Reveal } from '../ui/Reveal';
import { useProject } from './ProjectContext';

const KIND: Record<string, string> = {
  create: 'Création du dossier', import: 'Import du dossier', patch: 'Modification', phase: 'Changement de phase',
  validate: 'Validation du BOTe', decide: 'Décision', archive: 'Archivage', delete: 'Suppression',
  committee: 'Date de comité', contributors: 'Contributeurs', owner: 'Responsable',
};

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function Activite() {
  const repo = useRepo();
  const { id, members } = useProject();
  const { t, locale, nf } = useI18n();
  const [log, setLog] = useState<ActivityEntry[] | null>(null);
  const seen = useRef<Set<number> | null>(null);

  useEffect(() => {
    let live = true;
    const load = () => repo.activity(id).then((l) => { if (live) setLog(l); }).catch(() => { if (live) setLog([]); });
    void load();
    const off = repo.subscribe(id, () => { void load(); });
    return () => { live = false; off(); };
  }, [repo, id]);

  useEffect(() => {
    if (log && !seen.current) seen.current = new Set(log.map((e) => e.id));
  }, [log]);

  const who = (actorId: string) => members.find((m) => m.id === actorId)?.name ?? t('Membre inconnu');
  const when = (iso: string) => new Date(iso).toLocaleString(locale === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Paris' });
  const show = (e: ActivityEntry, v: unknown): string => {
    if (v == null || v === '') return '—';
    if (e.kind === 'phase') return phaseLabel(locale, v as Phase);
    if (e.kind === 'decide') return decisionLabel(locale, v as Decision);
    if (e.kind === 'owner' || e.kind === 'validate') return who(String(v));
    if (typeof v === 'number') return nf(v, Number.isInteger(v) ? 0 : 2);
    if (typeof v === 'boolean') return v ? t('Oui') : t('Non');
    if (typeof v === 'string') return v.length > 80 ? v.slice(0, 79) + '…' : v;
    if (Array.isArray(v)) return t('{0} éléments', v.length);
    const s = JSON.stringify(v);
    return s.length > 80 ? s.slice(0, 79) + '…' : s;
  };

  return (
    <Reveal index={0}>
      <Card title={t('Journal d’activité')} icon="clock" sub={log ? String(log.length) : ''}>
        {log === null ? <div className="empty">…</div> : log.length === 0 ? <div className="empty">{t('Aucune activité pour l’instant.')}</div> : (
          <div className="log">
            {log.map((e) => {
              const name = who(e.actorId);
              return (
                <div key={e.id} className={`logrow ${seen.current && !seen.current.has(e.id) ? 'fresh' : ''}`}>
                  <span className="avatar" aria-hidden="true">{initials(name)}</span>
                  <div>
                    <b>{name}</b> · {t(KIND[e.kind] ?? e.kind)}{e.path && <> <code>{e.path}</code></>}
                    {(e.kind !== 'create' && e.kind !== 'import') && (
                      <div className="chg"><span className="old">{show(e, e.oldValue)}</span><span aria-hidden="true">→</span><span>{show(e, e.newValue)}</span></div>
                    )}
                  </div>
                  <time dateTime={e.at}>{when(e.at)}</time>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </Reveal>
  );
}
