import { describe, expect, it } from 'vitest';
import { blankDeal, demoDeal } from '../engine/samples';
import type { Deal } from '../engine/types';
import { MISSING_GROUPS, SELLER_QUESTIONS, hasSimilarQuestion, missingItems, sellerQuestion } from './missing';
import { mkMeta } from './testutil';

const meta = mkMeta();
const keys = (d: Deal) => missingItems(d, meta).map((m) => m.key);

/** Démo complétée : toutes les données renseignées. */
function filled(): Deal {
  const d = demoDeal();
  d.kpi.top10 = 19;
  return d;
}

describe('missingItems', () => {
  it('demo deal: only the top 10 customers share is missing, in the scorecard group', () => {
    const items = missingItems(demoDeal(), meta);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      key: 'kpi.top10', group: 'grid', labelKey: 'Top 10 clients', path: ['kpi', 'top10'], kind: 'number',
      unit: 'pctRev', askSeller: true, topic: 'top10', crit: 'Poids des 10 premiers clients',
    });
  });

  it('filled deal: nothing is missing', () => {
    expect(missingItems(filled(), meta)).toEqual([]);
  });

  it('blank deal: many items across every group, each listed once', () => {
    const d = blankDeal('x');
    const items = missingItems(d, meta);
    const ks = items.map((m) => m.key);
    expect(new Set(ks).size).toBe(ks.length);
    // comparables are claimed by the scorecard (price criterion), so the valuation group is empty
    expect(new Set(items.map((m) => m.group))).toEqual(new Set(MISSING_GROUPS.filter((g) => g !== 'val')));
    const L = d.hist.years.length - 1;
    // the scorecard group claims last-year revenue / EBITDA, previous-year revenue, net debt, asking price and comps
    const grid = items.filter((m) => m.group === 'grid').map((m) => m.key);
    expect(grid).toEqual(expect.arrayContaining([
      `hist.rev.${L}`, `hist.rev.${L - 1}`, `hist.ebitda.${L}`, 'kpi.recurring', 'kpi.churn', 'kpi.top10', 'bs.netDebt', 'askPrice', 'comps',
    ]));
    expect(ks).toEqual(expect.arrayContaining(['kpi.arr', 'kpi.nrr', 'bs.debtLike', 'kpi.customers', 'kpi.employees',
      'hist.rev', 'hist.ebitda', 'hist.capex', 'thesis', 'risks', 'sector', 'country']));
    // the history rows only list the years not already asked above
    const rev = items.find((m) => m.key === 'hist.rev')!;
    expect(rev.labelArgs).toEqual([d.hist.years.slice(0, L - 1).join(', ')]);
    expect(rev.anchor).toBe('f-hist.rev.0');
    expect(items.find((m) => m.key === 'hist.capex')!.labelArgs).toEqual([d.hist.years.join(', ')]);
    // DCF parameters and plan growth have defaults on a blank deal; the target margin does not
    expect(ks).not.toContain('dcf');
    expect(ks.filter((k) => k.startsWith('plan.'))).toEqual(['plan.targetMargin']);
  });

  it('plan and DCF gaps', () => {
    const d = filled();
    d.plan.targetMargin = null;
    d.plan.growth[2] = null;
    d.dcf.g = 12;
    const items = missingItems(d, meta);
    expect(items.map((m) => [m.key, m.group])).toEqual([
      ['plan.targetMargin', 'plan'], ['plan.growth.2', 'plan'], ['dcf', 'val'],
    ]);
    expect(items[1].labelArgs).toEqual([3]);
    expect(items[2]).toMatchObject({ kind: 'link', tab: 'valorisation', anchor: 'f-dcf.wacc' });
  });

  it('price criterion needs an included comparable with EV/EBITDA', () => {
    const d = filled();
    d.comps = d.comps.map((c) => ({ ...c, include: false }));
    const items = missingItems(d, meta);
    expect(items).toEqual([expect.objectContaining({ key: 'comps', group: 'grid', kind: 'link', tab: 'valorisation', crit: 'Prix demandé / médiane comparables' })]);
  });

  it('growth needs the previous year revenue', () => {
    const d = filled();
    d.hist.rev[3] = null;
    expect(missingItems(d, meta)).toEqual([expect.objectContaining({
      key: 'hist.rev.3', group: 'grid', path: ['hist', 'rev', '3'], labelArgs: [2024], crit: 'Croissance du CA', topic: 'history',
    })]);
  });

  it('a criterion that cannot be rated with all inputs present links to the figures', () => {
    const d = filled();
    d.hist.ebitda[4] = -1;
    d.adjustments = [];
    const ks = keys(d);
    expect(ks).toContain('crit.leverage');
    expect(ks).toContain('crit.price');
  });

  it('thesis, sheet and text fields', () => {
    const d = filled();
    d.thesis = '  ';
    d.country = '';
    const items = missingItems(d, meta);
    expect(items.map((m) => m.key)).toEqual(['thesis', 'country']);
    expect(items[1]).toMatchObject({ kind: 'text', path: ['country'], group: 'sheet' });
    expect(items[0]).toMatchObject({ kind: 'link', tab: 'demandes', anchor: 'f-thesis' });
  });

  it('no seller question offered once the deal is decided', () => {
    const items = missingItems(demoDeal(), mkMeta({ phase: 'decided' }));
    expect(items[0].askSeller).toBeFalsy();
  });
});

describe('sellerQuestion', () => {
  it('skips a question already asked (demo: top 10)', () => {
    const d = demoDeal();
    const it0 = missingItems(d, meta)[0];
    expect(sellerQuestion(d, it0)).toBeNull();
    d.questions = [];
    expect(sellerQuestion(d, it0)).toEqual({ q: SELLER_QUESTIONS.top10.q, cat: 'Commercial', priority: 'Décisive' });
  });

  it('net debt question, translated, then detected as a duplicate in either language', () => {
    const d = filled();
    d.bs.netDebt = null;
    const item = missingItems(d, meta).find((m) => m.key === 'bs.netDebt')!;
    expect(item.askSeller).toBe(true);
    const tr = (k: string) => (k === SELLER_QUESTIONS.netDebt.q ? 'Net financial debt at closing, with details' : k);
    const q = sellerQuestion(d, item, tr)!;
    expect(q.q).toBe('Net financial debt at closing, with details');
    d.questions.push({ id: 'x', q: q.q, cat: q.cat, priority: q.priority, status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null });
    expect(sellerQuestion(d, item, tr)).toBeNull();
    expect(hasSimilarQuestion(d.questions, SELLER_QUESTIONS.netDebt.q, tr)).toBe(true);
  });

  it('items without a seller topic never produce a question', () => {
    const d = filled();
    d.kpi.nrr = null;
    const item = missingItems(d, meta)[0];
    expect(item.key).toBe('kpi.nrr');
    expect(item.askSeller).toBeFalsy();
    expect(sellerQuestion(d, item)).toBeNull();
  });
});
