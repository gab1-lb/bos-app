import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { base } from '../engine/finance';
import { blankDeal } from '../engine/samples';
import { applyExtract, dealNameFromFile, extract, extractKeys, importWrites, pageText, parseNum, parseRow, patchesFor, type ImKey } from './im';

const PAGES = [
  'Projet Atlas\nSecteur : Logiciel métier\nPays : France\nExercice clos en 2025\n',
  'Chiffre d’affaires : 12,4 M€\nEBITDA : 3 100 k€\nRevenus récurrents : 78 %\nChurn clients : 4,5 %\n',
  'Dette nette : 1,2 million d’euros\nPrix demandé : 0,03 milliard\nTop 10 clients : 22 %\nARR : 9 500 000 €\n',
];

describe('extract (IM)', () => {
  it('reads values with units, page references and the header fields', () => {
    const r = extract(PAGES);
    expect(r.year).toBe(2025);
    expect(r.sector).toBe('Logiciel métier');
    expect(r.country).toBe('France');
    expect(r.vals.rev).toMatchObject({ n: 12.4, ref: 'IM p. 2' });
    expect(r.vals.ebitda?.n).toBeCloseTo(3.1);
    expect(r.vals.recurring?.n).toBe(78);
    expect(r.vals.churn?.n).toBe(4.5);
    expect(r.vals.netDebt?.n).toBe(1.2);
    expect(r.vals.askPrice?.n).toBe(30);
    expect(r.vals.top10?.n).toBe(22);
    expect(r.vals.arr?.n).toBe(9.5);
    expect(r.vals.rev?.line).toBe('Chiffre d’affaires : 12,4 M€');
  });

  it('ignores a percentage where an amount is expected, and vice versa', () => {
    const r = extract(['EBITDA : 25 %\nRevenus récurrents : 4 M€']);
    expect(r.vals.ebitda).toBeUndefined();
    expect(r.vals.recurring).toBeUndefined();
  });

  it('returns nothing on unrelated text', () => {
    expect(extract(['Bonjour']).vals).toEqual({});
  });
});

describe('applyExtract', () => {
  it('writes only the selected values on the last year, with sources, without mutating the deal', () => {
    const d = blankDeal('X');
    d.sector = 'Déjà';
    const r = extract(PAGES);
    const all = new Set<ImKey>(['rev', 'ebitda', 'recurring', 'netDebt', 'askPrice']);
    const out = applyExtract(d, r, all, 'atlas.pdf');
    expect(out.hist.years).toEqual([2021, 2022, 2023, 2024, 2025]);
    expect(out.hist.rev[4]).toBe(12.4);
    expect(out.refs.rev).toBe('IM p. 2');
    expect(out.kpi.recurring).toBe(78);
    expect(out.kpi.churn).toBeNull();
    expect(out.bs.netDebt).toBe(1.2);
    expect(out.askPrice).toBe(30);
    expect(out.sector).toBe('Déjà');
    expect(out.country).toBe('France');
    expect(out.source).toBe('atlas.pdf');
    expect(d.hist.rev[4]).toBeNull();
  });

  it('names a new deal after the file', () => {
    expect(dealNameFromFile('IM_projet-atlas.pdf', 'Nouveau dossier')).toBe('IM projet atlas');
    expect(dealNameFromFile('', 'Nouveau dossier')).toBe('Nouveau dossier');
  });
});

describe('patchesFor', () => {
  it('lists leaf changes only, new keys included', () => {
    const d = blankDeal('X');
    const r = extract(['Exercice 2025\nChiffre d’affaires : 10 M€\nDette nette : 2 M€']);
    const out = applyExtract(d, r, new Set<ImKey>(['rev', 'netDebt']));
    const paths = Object.fromEntries(patchesFor(d, out).map(([p, v]) => [p.join('.'), v]));
    expect(paths).toEqual({ 'hist.rev.4': 10, 'refs.rev': 'IM p. 1', 'bs.netDebt': 2, 'refs.netDebt': 'IM p. 1', ...(d.hist.years[4] === 2025 ? {} : Object.fromEntries(d.hist.years.map((_, i) => [`hist.years.${i}`, 2021 + i]))) });
  });
});

describe('pageText (PDF)', () => {
  it('joins split glyph items without inserting spaces inside words', () => {
    const items = [{ str: 'C' }, { str: 'hiff' }, { str: 're' }, { str: ' ' }, { str: 'd’affaires' }, { str: ' ' }, { str: ':' }, { str: ' ' }, { str: '15,2' }, { str: ' ' }, { str: 'M€', hasEOL: true }, { str: 'Pays' }];
    expect(pageText(items)).toBe('Chiffre d’affaires : 15,2 M€\nPays');
    expect(extract([pageText(items)]).vals.rev?.n).toBe(15.2);
  });
  it('reads header fields when the PDF dropped the colon', () => {
    const r = extract(['Secteur  Logiciel vertical\nPays  France\n']);
    expect([r.sector, r.country]).toEqual(['Logiciel vertical', 'France']);
  });
});

/** Text of the fictitious Kepler IM exactly as pageText reads it from e2e/fixtures/im-kepler.pdf. */
const KEPLER = readFileSync(join(__dirname, '../../e2e/fixtures/im-kepler.txt'), 'utf8').split(/^=== page \d+\n/m).slice(1);

describe('extract (full IM, Kepler fixture)', () => {
  const r = extract(KEPLER);
  it('keeps the key figures, year, sector and country', () => {
    expect(KEPLER).toHaveLength(6);
    expect(r.year).toBe(2025);
    expect([r.sector, r.country]).toEqual(['Logiciel vertical B2B SaaS', 'France']);
    expect(Object.fromEntries(Object.entries(r.vals).map(([k, v]) => [k, v.n]))).toEqual({
      rev: 15.2, ebitda: 3.8, arr: 12.6, recurring: 81, churn: 3.8, top10: 19, netDebt: 2.4, askPrice: 52,
    });
  });
  it('reads the historical table', () => {
    expect(r.hist.rev).toMatchObject({ years: [2021, 2022, 2023, 2024, 2025], vals: [7.9, 9.4, 11, 12.9, 15.2], ref: 'IM p. 4' });
    expect(r.hist.ebitda?.vals).toEqual([1.2, 1.6, 2.2, 2.9, 3.8]);
    expect(r.hist.capex?.vals).toEqual([0.4, 0.5, 0.5, 0.6, 0.7]);
  });
  it('reads the management plan', () => {
    expect(r.plan.growth).toMatchObject({ years: [2026, 2027, 2028, 2029, 2030], vals: [15, 13, 12, 10, 9], ref: 'IM p. 5' });
    expect(r.plan.targetMargin?.vals.at(-1)).toBe(29);
    expect(r.plan.capexPct?.vals.at(-1)).toBe(4.5);
  });
  it('reads the seller adjustments only (not the advisor note)', () => {
    expect(r.adjustments.map(({ label, amount, included }) => ({ label, amount, included }))).toEqual([
      { label: 'Rémunération du dirigeant ramenée au marché', amount: 0.2, included: true },
      { label: 'Honoraires de conseil liés à la cession', amount: 0.15, included: false },
    ]);
  });
  it('reads the other values', () => {
    expect(Object.fromEntries(Object.entries(r.other).map(([k, v]) => [k, v.n]))).toEqual({
      debtLike: 0.6, nwcPct: -9, taxRate: 25, customers: 2300, employees: 118, nrr: 106, synCost: 0.4, synRevenue: 0.3,
    });
    expect(r.other.customers?.ref).toBe('IM p. 3');
  });
  it('fills a new deal with everything selected, so the synthesis shows the growth without typing', () => {
    const d = applyExtract(blankDeal('Kepler'), r, new Set(extractKeys(r)), 'im-kepler.pdf');
    expect(d.hist).toEqual({ years: [2021, 2022, 2023, 2024, 2025], rev: [7.9, 9.4, 11, 12.9, 15.2], ebitda: [1.2, 1.6, 2.2, 2.9, 3.8], capex: [0.4, 0.5, 0.5, 0.6, 0.7] });
    expect(d.kpi).toEqual({ arr: 12.6, recurring: 81, churn: 3.8, nrr: 106, top10: 19, customers: 2300, employees: 118 });
    expect(d.bs).toEqual({ netDebt: 2.4, debtLike: 0.6 });
    expect(d.askPrice).toBe(52);
    expect(d.plan).toMatchObject({ growth: [15, 13, 12, 10, 9], targetMargin: 29, capexPct: 4.5, nwcPct: -9, taxRate: 25 });
    expect([d.synergies.cost, d.synergies.revenue]).toEqual([0.4, 0.3]);
    expect(d.adjustments.map(({ label, amount, included, status }) => [label, amount, included, status])).toEqual([
      ['Rémunération du dirigeant ramenée au marché', 0.2, true, 'À confirmer'],
      ['Honoraires de conseil liés à la cession', 0.15, false, 'À confirmer'],
    ]);
    expect(new Set(d.adjustments.map((a) => a.id)).size).toBe(2);
    expect([d.sector, d.country, d.source]).toEqual(['Logiciel vertical B2B SaaS', 'France', 'im-kepler.pdf']);
    expect(base(d).growth).toBeCloseTo(17.83, 2);
  });
  it('lets the key figure win over the table for the last year, and the table fill older years', () => {
    const r2 = extract(['Exercice clos en 2025\nChiffre d’affaires : 15,3 M€\nExercice 2023 2024 2025\nVentes 11,0 12,9 15,2']);
    const d = applyExtract(blankDeal('X'), r2, new Set(extractKeys(r2)));
    expect(d.hist.rev).toEqual([null, null, 11, 12.9, 15.3]);
    const onlyTable = applyExtract(blankDeal('X'), r2, new Set(['hist.rev']));
    expect(onlyTable.hist.rev[4]).toBe(15.2);
  });
});

describe('extract (tables and values, synthetic)', () => {
  it('parses French and English numbers', () => {
    expect([parseNum('7,9'), parseNum('11,0'), parseNum('2 300'), parseNum('1,250.5'), parseNum('1.250,5'), parseNum('−0,4'), parseNum('(1,2)'), parseNum('1,250,000')])
      .toEqual([7.9, 11, 2300, 1250.5, 1250.5, -0.4, -1.2, 1250000]);
    expect(parseNum('abc')).toBeNull();
  });
  it('regroups thousands split by spaces and keeps the last n cells', () => {
    expect(parseRow('Nombre de clients 1 200 1 500 1 980', 3)).toEqual({ label: 'Nombre de clients', vals: [1200, 1500, 1980], pct: false });
    expect(parseRow('Top 10 clients 22 % 20 %', 2)).toEqual({ label: 'Top 10 clients', vals: [22, 20], pct: true });
    expect(parseRow('Ventes 7,9 n.d. 11,0', 3)?.vals).toEqual([7.9, null, 11]);
    expect(parseRow('Ventes 7,9', 3)).toBeNull();
  });
  it('reads English tables, splits history and plan columns of one table, pads the growth', () => {
    const r = extract([[
      'Key financials (EURm)',
      'FY 2022 2023 2024 2025e 2026e 2027e',
      'Net sales 1,250.5 1,400.0 1,610.2 1,800.0 2,000.0 2,150.0',
      'EBITDA 250.1 280.0 322.0 380.0 430.0 470.0',
      'EBITDA margin 20.0% 20.0% 20.0% 21.1% 21.5% 21.9%',
      'Revenue growth 12.0% 12.0% 15.0% 11.8% 11.1% 7.5%',
      'Capex % of revenue 3.0% 3.0% 3.0% 3.5% 3.5% 3.5%',
      'Annual recurring revenue 900.0 1,000.0 1,150.0 1,300.0 1,400.0 1,500.0',
    ].join('\n'), 'Fiscal year 2024'].concat([]));
    expect(r.year).toBe(2024);
    expect(r.hist.rev).toMatchObject({ years: [2022, 2023, 2024], vals: [1250.5, 1400, 1610.2] });
    expect(r.hist.ebitda?.vals).toEqual([250.1, 280, 322]);
    expect(r.vals.arr?.n).toBe(1150);
    expect(r.plan.growth).toMatchObject({ years: [2025, 2026, 2027], vals: [11.8, 11.1, 7.5] });
    expect(r.plan.targetMargin?.vals.at(-1)).toBe(21.9);
    expect(r.plan.capexPct?.vals.at(-1)).toBe(3.5);
    const d = applyExtract(blankDeal('X'), r, new Set(extractKeys(r)));
    expect(d.hist.years).toEqual([2020, 2021, 2022, 2023, 2024]);
    expect(d.hist.rev).toEqual([null, null, 1250.5, 1400, 1610.2]);
    expect(d.plan.growth).toEqual([11.8, 11.1, 7.5, 7.5, 7.5]);
  });
  it('takes the year from the table when no fiscal year is stated, and ignores a table header as the year', () => {
    const r = extract(['Exercice 2022 2023 2024\nChiffre d’affaires 5,0 6,0 7,0\nEBE 1,0 1,2 1,5']);
    expect(r.year).toBe(2024);
    expect(r.hist.ebitda?.vals).toEqual([1, 1.2, 1.5]);
  });
  it('prefers the reported EBITDA row over an adjusted one', () => {
    const r = extract(['Exercice 2024 2025\nEBITDA retraité 2,0 2,5\nEBITDA 1,8 2,2']);
    expect(r.hist.ebitda?.vals).toEqual([1.8, 2.2]);
  });
  it('reads adjustments with or without colon and parentheses, with a sign when present, in k€', () => {
    const r = extract([[
      'Retraitements',
      'Loyer du siège détenu par le dirigeant − 0,10 M€ (non inclus)',
      'Prime exceptionnelle  +150 k€ inclus',
      'Management fees: 0.05 M€ (not included)',
      'Note : 0,40 M€ de R&D capitalisée',
    ].join('\n')]);
    expect(r.adjustments.map(({ label, amount, included }) => [label, amount, included])).toEqual([
      ['Loyer du siège détenu par le dirigeant', -0.1, false],
      ['Prime exceptionnelle', 0.15, true],
      ['Management fees', 0.05, false],
    ]);
  });
  it('reads the other values in English and with a positive working capital', () => {
    const r = extract(['Debt-like items: 1.2 M€. Working capital of 12% of revenue. Tax rate 28 %. Net revenue retention 112 %. 350 employees and 4,200 customers.']);
    expect(Object.fromEntries(Object.entries(r.other).map(([k, v]) => [k, v.n]))).toEqual({
      debtLike: 1.2, nwcPct: 12, taxRate: 28, customers: 4200, employees: 350, nrr: 112,
    });
  });
  it('does not take a top-10 mention for a customer count', () => {
    expect(extract(['Top 10 clients : 19 %']).other.customers).toBeUndefined();
  });
});

describe('importWrites', () => {
  it('patches leaves outside the lists and appends new adjustments by id, without duplicating labels', () => {
    const d = blankDeal('X');
    d.adjustments = [{ id: 'a1', label: 'Honoraires de conseil liés à la cession', amount: 0.1, included: false, status: 'Accepté' }];
    const r = extract(KEPLER);
    const out = applyExtract(d, r, new Set(extractKeys(r)));
    const { patches, items } = importWrites(d, out);
    expect(patches.some(([p]) => p[0] === 'adjustments')).toBe(false);
    expect(patches).toContainEqual([['hist', 'rev', '0'], 7.9]);
    expect(patches).toContainEqual([['plan', 'growth', '0'], 15]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ list: 'adjustments', item: { label: 'Rémunération du dirigeant ramenée au marché', amount: 0.2, included: true, status: 'À confirmer' } });
    expect(typeof items[0].item.id).toBe('string');
  });
});
