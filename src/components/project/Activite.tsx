'use client';
import { useEffect, useRef, useState } from 'react';
import type { ActivityEntry } from '../../data/repo';
import { activityText } from '../../domain/activityText';
import { useI18n, useRepo } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Reveal } from '../ui/Reveal';
import { useProject } from './ProjectContext';

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('');

export function Activite() {
  const repo = useRepo();
  const { id, members, deal } = useProject();
  const { t, locale } = useI18n();
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
  return (
    <Reveal index={0}>
      <Card title={t('Journal d’activité')} icon="clock" sub={log ? String(log.length) : ''}>
        {log === null ? <div className="empty">…</div> : log.length === 0 ? <div className="empty">{t('Aucune activité pour l’instant.')}</div> : (
          <div className="log">
            {log.map((e) => {
              const name = who(e.actorId);
              const x = activityText(e, { locale, who, deal });
              return (
                <div key={e.id} className={`logrow ${seen.current && !seen.current.has(e.id) ? 'fresh' : ''}`}>
                  <span className="avatar" aria-hidden="true">{initials(name)}</span>
                  <div>
                    <b>{name}</b> · {x.action}{x.field && <> · <span className="fld" title={e.path ?? undefined}>{x.field}</span></>}
                    {(x.from !== null || x.to !== null) && (
                      <div className="chg">
                        {x.from !== null && <span className={x.to === null ? 'old gone' : 'old'}>{x.from}</span>}
                        {x.from !== null && x.to !== null && <span aria-hidden="true">→</span>}
                        {x.to !== null && <span>{x.to}</span>}
                      </div>
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
