'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { N } from '../../engine/finance';
import { blankDeal } from '../../engine/samples';
import type { Mandate } from '../../engine/types';
import { NO_FILTERS, dealRows, dossierStats, filterRows, type DealRow, type Filters, type StatusFilter, type Verdict } from '../../domain/dossiers';
import { can, type Member } from '../../domain/permissions';
import { PHASES, phaseLabel, type Phase } from '../../domain/phases';
import { useApp, useI18n } from '../../lib/repo-context';
import { TAG } from '../project/verdict';
import { CountUp } from '../ui/CountUp';
import { Icon, type IconName } from '../ui/Icon';
import { Metric } from '../ui/Metric';
import { Reveal } from '../ui/Reveal';
import { DealTable } from './DealTable';
import { ImDialog } from './ImDialog';
import { ImportDialog } from './ImportDialog';

type Data = { rows: DealRow[]; mandate: Mandate; members: Member[] };

const STATUS: [StatusFilter, string][] = [
  ['current', 'En cours et décidés'], ['active', 'En cours'], ['decided', 'Décidés'], ['archived', 'Archivés'], ['all', 'Tous, archivés compris'],
];
const VERDICTS: Verdict[] = ['go', 'nego', 'wait', 'stop'];

/** Mes dossiers : compteurs, filtres, tableau ; création, duplication, archivage, suppression, imports. */
export function Dossiers() {
  const { repo, me, toast } = useApp();
  const { t, locale, pc } = useI18n();
  const router = useRouter();
  const uid = useId();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'json' | 'im' | null>(null);
  const [now, setNow] = useState(() => new Date());

  const seq = useRef(0);
  const load = useCallback(async () => {
    const req = ++seq.current;
    try {
      const [items, mandate, members] = await Promise.all([repo.listDeals(), repo.mandate(), repo.members().catch(() => [] as Member[])]);
      if (req !== seq.current) return;
      setData({ rows: dealRows(items, mandate), mandate, members });
      setFailed(false);
      setNow(new Date());
    } catch {
      if (req === seq.current) setFailed(true);
    }
  }, [repo]);

  useEffect(() => {
    void load();
    return repo.subscribe(null, () => { void load(); });
  }, [repo, load]);

  const shown = useMemo(() => (data ? filterRows(data.rows, filters) : []), [data, filters]);
  const stats = useMemo(() => dossierStats(data?.rows ?? []), [data]);
  const owners = useMemo(() => {
    const ids = new Set((data?.rows ?? []).map((r) => r.meta.ownerId));
    return (data?.members ?? []).filter((m) => ids.has(m.id) || (m.status === 'active' && m.role && m.role !== 'reader'))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);

  const run = async (id: string, fn: () => Promise<void>) => {
    setBusy(id);
    try { await fn(); } catch (e) { toast(t('Action impossible : {0}', (e as Error)?.message ?? ''), true); }
    finally { setBusy(null); void load(); }
  };

  const canCreate = !!me && can(me, 'create');
  const canImport = !!me && can(me, 'import');
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setFilters((f) => ({ ...f, [k]: v }));
  const filtered = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  const create = () => run('new', async () => {
    const id = await repo.createDeal(blankDeal(t('Nouveau dossier')));
    router.push(`/projet/${encodeURIComponent(id)}/synthese`);
  });
  const duplicate = (r: DealRow) => run(r.meta.id, async () => {
    const copy = structuredClone(r.deal);
    copy.name = t('{0} (copie)', r.deal.name || t('Sans nom'));
    copy.example = false;
    copy.updatedAt = Date.now();
    await repo.createDeal(copy);
    toast(t('Dossier dupliqué : {0}', copy.name));
  });
  const archive = (r: DealRow, v: boolean) => run(r.meta.id, async () => {
    await repo.archive(r.meta.id, v);
    toast(t(v ? 'Dossier archivé : {0}' : 'Dossier désarchivé : {0}', r.deal.name));
  });
  const remove = (r: DealRow) => run(r.meta.id, async () => {
    await repo.deleteDeal(r.meta.id);
    toast(t('Dossier supprimé : {0}', r.deal.name));
  });

  const statItems: [string, IconName, number][] = [
    ['Dossiers en cours', 'folder', stats.active], ['À poursuivre', 'trend', stats.go],
    ['À négocier ou compléter', 'clock', stats.toWork], ['Questions décisives ouvertes', 'flag', stats.openDecisive],
  ];

  return (
    <>
      <Reveal className="pagehead" index={0}>
        <div>
          <h1>{t('Mes dossiers')}</h1>
          {data && (
            <div className="meta">
              <span><Icon name="target" />{t('Mandat')} : {data.mandate.name}</span><i className="sep">·</i>
              <span>{t('TRI cible')} {pc(N(data.mandate.hurdle) as number, 0)}</span>
            </div>
          )}
        </div>
        <div className="actions">
          {canImport && <button type="button" className="btn" onClick={() => setDialog('json')}><Icon name="download" />{t('Importer des dossiers')}</button>}
          {canCreate && <button type="button" className="btn" onClick={() => setDialog('im')}><Icon name="upload" />{t('Importer un IM')}</button>}
          {canCreate && <button type="button" className="btn primary" disabled={busy === 'new'} onClick={create}><Icon name="plus" />{t('Nouveau dossier')}</button>}
        </div>
      </Reveal>

      {failed && !data && <div className="card panel"><div className="empty">{t('Chargement impossible. Réessayez dans un instant.')}</div></div>}
      {!data && !failed && <div className="loading" aria-busy="true">…</div>}

      {data && (
        <>
          <Reveal className="g4" index={1}>
            {statItems.map(([label, icon, v]) => (
              <Metric key={label} label={t(label)} icon={icon} naLabel="—" value={<CountUp value={v} format={(n) => String(Math.round(n))} />} />
            ))}
          </Reveal>

          <Reveal as="section" className="card panel mt" index={2}>
            <div className="cardhead">
              <h2><Icon name="list" />{t('Journal des deals')} <span className="sub">{filtered ? `${shown.length} / ${data.rows.length}` : data.rows.length}</span></h2>
              <div className="filters" role="group" aria-label={t('Filtres')}>
                <div className="filter"><label htmlFor={`${uid}-status`}>{t('Statut')}</label>
                  <select id={`${uid}-status`} className="in" value={filters.status} onChange={(e) => set('status', e.target.value as StatusFilter)}>
                    {STATUS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                  </select>
                </div>
                <div className="filter"><label htmlFor={`${uid}-phase`}>{t('Phase')}</label>
                  <select id={`${uid}-phase`} className="in" value={filters.phase} onChange={(e) => set('phase', e.target.value as Phase | '')}>
                    <option value="">{t('Toutes')}</option>
                    {PHASES.map((p) => <option key={p} value={p}>{phaseLabel(locale, p)}</option>)}
                  </select>
                </div>
                <div className="filter"><label htmlFor={`${uid}-owner`}>{t('Responsable')}</label>
                  <select id={`${uid}-owner`} className="in" value={filters.owner} onChange={(e) => set('owner', e.target.value)}>
                    <option value="">{t('Tous')}</option>
                    {owners.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="filter"><label htmlFor={`${uid}-verdict`}>{t('Avis')}</label>
                  <select id={`${uid}-verdict`} className="in" value={filters.verdict} onChange={(e) => set('verdict', e.target.value as Verdict | '')}>
                    <option value="">{t('Tous')}</option>
                    {VERDICTS.map((v) => <option key={v} value={v}>{t(TAG[v])}</option>)}
                  </select>
                </div>
                {filtered && <button type="button" className="link" onClick={() => setFilters(NO_FILTERS)}>{t('Réinitialiser')}</button>}
              </div>
            </div>
            {data.rows.length === 0 ? (
              <div className="empty">{t('Aucun dossier. Créez-en un ou importez un IM.')}</div>
            ) : shown.length === 0 ? (
              <div className="empty">{t('Aucun dossier ne correspond aux filtres.')}</div>
            ) : (
              <DealTable rows={shown} members={data.members} me={me} now={now} busy={busy}
                onDuplicate={duplicate} onArchive={archive} onDelete={remove} />
            )}
          </Reveal>
        </>
      )}

      {dialog === 'json' && <ImportDialog onClose={() => setDialog(null)} />}
      {dialog === 'im' && <ImDialog onClose={() => setDialog(null)} />}
    </>
  );
}
