import { describe, expect, it } from 'vitest';
import { blankDeal } from '../engine/samples';
import { applyExtract, dealNameFromFile, extract, patchesFor, type ImKey } from './im';

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
