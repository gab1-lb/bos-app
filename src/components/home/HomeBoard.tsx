'use client';
import Link from 'next/link';
import { Component, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DealRecord } from '../../data/repo';
import type { Deal, Mandate } from '../../engine/types';
import { homeCards, homeCounters } from '../../domain/home';
import type { Member } from '../../domain/permissions';
import { DEFAULT_TEMPLATES, suggestTemplate, type Template, type TemplateKey } from '../../domain/templates';
import { useI18n, useMe, useRepo } from '../../lib/repo-context';
import { isDemo } from '../../lib/session';
import { setFeedbackOpen } from '../../lib/demo/feedback';
import { TryCard } from '../demo/TryCard';
import { MessageDialog } from '../messages/MessageDialog';
import { Icon } from '../ui/Icon';
import { Reveal } from '../ui/Reveal';
import { Counters } from './Counters';
import { DealCard } from './DealCard';
import { TourCard } from './TourCard';

/** One card that fails to render shows a link to its deal instead of taking the board down. */
class CardGuard extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

type Data = { items: DealRecord[]; mandate: Mandate; members: Member[]; templates: Template[] };

/** Accueil façon Notion : compteurs puis une carte repliable par deal actif, triées par urgence. Mise à jour en direct. */
export function HomeBoard() {
  const repo = useRepo();
  const me = useMe();
  const { t, locale } = useI18n();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const [msg, setMsg] = useState<{ id: string; key: TemplateKey } | null>(null);

  const seq = useRef(0);
  const load = useCallback(async () => {
    // Stale-response guard: only the latest request may update the board.
    const req = ++seq.current;
    try {
      const [items, mandate, members, templates] = await Promise.all([
        repo.listDeals(),
        repo.mandate(),
        repo.members().catch(() => [] as Member[]),
        repo.templates().catch(() => DEFAULT_TEMPLATES),
      ]);
      if (req !== seq.current) return;
      setData({ items, mandate, members, templates: templates.length ? templates : DEFAULT_TEMPLATES });
      setFailed(false);
      setNow(new Date());
    } catch {
      if (req === seq.current) setFailed(true);
    }
  }, [repo]);

  useEffect(() => {
    void load();
    const off = repo.subscribe(null, () => { void load(); });
    const tick = setInterval(() => setNow(new Date()), 60_000);
    return () => { off(); clearInterval(tick); };
  }, [repo, load]);

  const deals = useMemo(() => new Map<string, Deal>((data?.items ?? []).map((r) => [r.meta.id, r.deal])), [data]);
  const cards = useMemo(
    () => (data ? homeCards(data.items, data.mandate, now, (meta, waits) => suggestTemplate(meta, waits, deals.get(meta.id))) : []),
    [data, now, deals],
  );
  const counts = useMemo(() => homeCounters(cards, now), [cards, now]);
  const today = now.toLocaleDateString(locale === 'en' ? 'en-GB' : 'fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' });
  const firstName = me?.name.split(/\s+/)[0] ?? '';
  const open = msg && data ? data.items.find((r) => r.meta.id === msg.id) : null;
  const openCard = open ? cards.find((c) => c.meta.id === open.meta.id) : null;
  // Demo: the « À essayer » card takes the first Reveal slot after the page head; the rest follow it.
  const demo = isDemo();
  const r0 = demo ? 2 : 1;

  return (
    <>
      <Reveal className="pagehead" index={0}>
        <div>
          <div className="eyebrow">{firstName ? t('Bonjour {0}', firstName) : t('Bonjour')} · {today}</div>
          <h1 style={{ marginTop: 8 }}>{t('Accueil')}</h1>
        </div>
        <div className="actions">
          <Link className="btn" href="/dossiers"><Icon name="folder" />{t('Mes dossiers')}</Link>
        </div>
      </Reveal>

      {demo && <Reveal index={1}><TryCard onFeedback={() => setFeedbackOpen(true)} /></Reveal>}

      {failed && !data && <div className="card panel"><div className="empty">{t('Chargement impossible. Réessayez dans un instant.')}</div></div>}
      {!data && !failed && <div className="loading" aria-busy="true">…</div>}

      {data && (
        <>
          <Reveal index={r0}><Counters counts={counts} /></Reveal>
          <Reveal className="sectionhead" index={r0 + 1}>
            <h2>{t('Deals actifs')}</h2>
            <span className="period"><Icon name="list" />{t('Triés par urgence : attentes en retard d’abord')}</span>
          </Reveal>
          {cards.length === 0 ? (
            <Reveal index={r0 + 2} className="card panel"><div className="empty">{t('Aucun deal actif. Les deals décidés ou archivés sont dans Mes dossiers.')}</div></Reveal>
          ) : (
            <div className="board">
              {cards.map((c, i) => (
                <Reveal key={c.meta.id} index={r0 + 2 + Math.min(i, 8)}>
                  <CardGuard fallback={(
                    <article className="card hcard" data-deal-card={c.meta.id}>
                      <div className="hc-head"><Link className="hc-name" href={`/projet/${encodeURIComponent(c.meta.id)}/synthese`}>{c.name || t('Sans nom')}</Link></div>
                      <p className="note">{t('Affichage impossible de ce dossier sur l’accueil.')}</p>
                    </article>
                  )}>
                    <DealCard card={c} deal={deals.get(c.meta.id) as Deal} members={data.members} now={now}
                      onMessage={(key) => setMsg({ id: c.meta.id, key: key ?? 'info_request' })} />
                  </CardGuard>
                </Reveal>
              ))}
            </div>
          )}
          <Reveal className="mt" index={r0 + 2 + Math.min(cards.length, 8) + 1}><TourCard /></Reveal>
        </>
      )}

      {open && openCard && msg && data && (
        <MessageDialog key={`${msg.id}:${msg.key}:${locale}`} rec={open} waits={openCard.waits} mandate={data.mandate}
          templates={data.templates} initialKey={msg.key} onClose={() => setMsg(null)} />
      )}
    </>
  );
}
