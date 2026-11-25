'use client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { N } from '../../engine/finance';
import { newItemId } from '../../domain/dealShape';
import { GROUP_LABEL, MISSING_GROUPS, missingItems, sellerQuestion, type MissingGroup, type MissingItem, type MissingUnit } from '../../domain/missing';
import { useApp, useI18n } from '../../lib/repo-context';
import { Card } from '../ui/Card';
import { Chip } from '../ui/Chip';
import { NumInput, TextInput } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { useProject } from './ProjectContext';

const getIn = (o: unknown, path: string[]): unknown =>
  path.reduce<unknown>((x, k) => (x == null ? x : (x as Record<string, unknown>)[k]), o);

/** « Données manquantes » : tout ce qui reste à renseigner, à compléter sur place ou à demander au vendeur. */
export function MissingData() {
  const { deal: d, meta, id, editable, patch, appendItems } = useProject();
  const { toast } = useApp();
  const { t, unitM } = useI18n();
  const items = useMemo(() => missingItems(d, meta), [d, meta]);
  const groups = MISSING_GROUPS.map((g) => [g, items.filter((m) => m.group === g)] as const).filter(([, xs]) => xs.length > 0);
  // Until the user opens or closes a group, the most important one is open and the others show only their count.
  const [open, setOpen] = useState<Set<MissingGroup> | null>(null);
  const first = groups[0]?.[0];
  const isOpen = (g: MissingGroup) => (open ? open.has(g) : g === first);
  const toggle = (g: MissingGroup) => setOpen((s) => {
    const n = new Set(s ?? (first ? [first] : []));
    if (n.has(g)) n.delete(g); else n.add(g);
    return n;
  });
  const base = `/projet/${encodeURIComponent(id)}`;
  const unit = (u?: MissingUnit) => (u === 'meur' ? unitM() : u === '%' ? '%' : u === 'pctRev' ? t('% du CA') : u === 'fte' ? t('ETP') : null);

  const ask = (it: MissingItem) => {
    const q = sellerQuestion(d, it, t);
    if (!q) return;
    appendItems('questions', [{ id: newItemId(), ...q, status: 'Ouverte', answer: '', awaitedFrom: 'seller', sentAt: null, answeredAt: null }]);
    toast(t('Question ajoutée aux demandes d’infos.'));
  };

  const row = (it: MissingItem) => {
    const label = t(it.labelKey, ...(it.labelArgs ?? []));
    const fid = `m-${it.key}`;
    const u = unit(it.unit);
    const q = it.askSeller ? sellerQuestion(d, it, t) : null;
    return (
      <li className="mrow" key={it.key} data-missing={it.key}>
        <div className="mlbl">
          {it.kind === 'link' ? <b>{label}</b> : <label htmlFor={fid}>{label}</label>}
          {it.crit && <span className="mini">{t('Grille : {0}', t(it.crit))}</span>}
        </div>
        <div className="mctl">
          {it.kind === 'number' && it.path && (
            <span className="ib">
              <NumInput id={fid} label={label} value={N(getIn(d, it.path))} decimals={it.decimals ?? 1} readOnly={!editable}
                onCommit={(v) => patch(it.path!, v)} />
              <span className="unit">{u}</span>
            </span>
          )}
          {it.kind === 'text' && it.path && (
            <TextInput id={fid} label={label} value={String(getIn(d, it.path) ?? '')} readOnly={!editable} className="mtxt"
              onCommit={(v) => patch(it.path!, v)} />
          )}
          {it.kind === 'link' && (
            <Link className="link" href={`${base}/${it.tab ?? 'financiers'}${it.anchor ? '#' + it.anchor : ''}`}>
              {t('Compléter')}<Icon name="chev" />
            </Link>
          )}
          {/* A fixed slot keeps the inputs aligned whether or not the row can be asked to the seller. */}
          {editable && (
            <span className="mask">
              {it.askSeller && (q
                ? <button type="button" className="btn sm" onClick={() => ask(it)}><Icon name="send" />{t('Demander au vendeur')}</button>
                : <Chip>{t('Demandé au vendeur')}</Chip>)}
            </span>
          )}
        </div>
      </li>
    );
  };

  return (
    <Card className="mdata" title={t('Données manquantes')} icon="list"
      right={items.length ? <Chip tone="amber">{t('{0} à compléter', items.length)}</Chip> : <Chip tone="good">{t('Complet')}</Chip>}>
      {items.length === 0 ? (
        <div className="mdone"><span className="iconbox"><Icon name="shield" /></span>{t('Toutes les données sont renseignées')}</div>
      ) : (
        <div className="mgroups">
          {groups.map(([g, xs]) => {
            const on = isOpen(g);
            return (
              <div className={`mgrp ${on ? 'on' : ''}`} key={g}>
                <button type="button" className="mghead" aria-expanded={on} aria-controls={`mg-${g}`} onClick={() => toggle(g)}>
                  <Icon name="chev" />
                  <span>{t(GROUP_LABEL[g])}</span>
                  <span className="mcount">{xs.length}</span>
                </button>
                {on && <ul id={`mg-${g}`} className="mlist">{xs.map(row)}</ul>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
