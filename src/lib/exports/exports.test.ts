import { describe, expect, it } from 'vitest';
import { DEFAULT_MANDATE, blankDeal, demoDeal } from '../../engine/samples';
import { compute } from '../../components/project/compute';
import type { DealMeta } from '../../domain/phases';
import { slug } from './download';
import { memoFileName, memoHtml } from './memo';
import { xlsxFileName, xlsxSheets } from './xlsx';

const meta = (over: Partial<DealMeta> = {}): DealMeta => ({
  id: 'x', ownerId: 'u', contributorIds: [], phase: 'analysis', phaseEnteredAt: '2026-11-01T00:00:00Z', decision: null, decidedAt: null,
  committeeDate: null, validatedBy: null, validatedAt: null, archived: false, updatedAt: '2026-11-01T00:00:00Z', updatedBy: 'u', ...over,
});

describe('exports', () => {
  it('slugs file names', () => {
    expect(slug('Projet Hélios')).toBe('Projet_Helios');
    expect(slug('')).toBe('dossier');
    expect(memoFileName('fr', demoDeal())).toBe('Note_comite_Projet_Helios.html');
    expect(memoFileName('en', demoDeal())).toBe('IC_memo_Projet_Helios.html');
    expect(xlsxFileName(demoDeal())).toBe('BOS_Projet_Helios.xlsx');
  });

  it('memo: escaped, localised, with phase and decision', () => {
    const d = demoDeal();
    d.thesis = '<script>x</script>';
    const c = compute(d, DEFAULT_MANDATE);
    const html = memoHtml(d, meta({ phase: 'decided', decision: 'go_dd' }), c, 'fr', new Date('2026-11-25T10:00:00Z'));
    expect(html).toContain('<h1>Projet Hélios</h1>');
    expect(html).toContain('Décision · Go DD');
    expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(html).not.toContain('<script>');
    expect(html).toContain('25/11/2026');
    const en = memoHtml(d, meta(), c, 'en', new Date('2026-11-25T10:00:00Z'));
    expect(en).toContain('lang="en"');
    expect(en).toContain('Investment committee pre-read');
    expect(en).toContain('Analysis in progress');
  });

  it('memo: blank deal renders placeholders', () => {
    const d = blankDeal('Vide');
    const html = memoHtml(d, meta(), compute(d, DEFAULT_MANDATE), 'fr');
    expect(html).toContain('<li>—</li>');
    expect(html).toContain('À calculer');
  });

  it('xlsx: sheets and key rows', () => {
    const d = demoDeal();
    const c = compute(d, DEFAULT_MANDATE);
    const sheets = xlsxSheets(d, meta(), c, 'fr');
    expect(sheets.map((s) => s.name)).toEqual(['Synthèse', 'Données financières', 'Comparables', 'DCF', 'Rendement', 'Demandes']);
    const syn = sheets[0].aoa;
    expect(syn[0]).toEqual(['Projet Hélios']);
    expect(syn.find((r) => r[0] === 'Chiffre d’affaires (M€)')?.[1]).toBe(c.b.rev);
    expect(sheets[5].aoa.length).toBe(d.questions.length + 1);
    const blank = xlsxSheets(blankDeal('Vide'), meta(), compute(blankDeal('Vide'), DEFAULT_MANDATE), 'en');
    expect(blank.map((s) => s.name)).not.toContain('Rendement');
    expect(blank[0].aoa.find((r) => r[0] === 'Revenue (€m)')).toBeTruthy();
    expect(sheets.every((s) => s.name.length <= 31)).toBe(true);
  });
});
