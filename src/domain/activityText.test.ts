import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '../data/repo';
import { demoDeal } from '../engine/samples';
import { activityText, fieldLabel, valueText } from './activityText';

const nb = (s: string | null) => (s ?? '').replace(/[\u00a0\u202f]/g, ' ');
const e = (o: Partial<ActivityEntry>): ActivityEntry => ({
  id: 1, dealId: 'd', actorId: 'u', at: '2026-11-24T10:00:00Z', kind: 'patch', path: null, oldValue: null, newValue: null, ...o,
});
const who = (id: string) => ({ u1: 'Alice', u2: 'Bob' })[id] ?? '?';
const fr = { locale: 'fr' as const, who, deal: demoDeal() };
const en = { ...fr, locale: 'en' as const };

describe('fieldLabel', () => {
  it('names list rows by position and field, FR and EN', () => {
    expect(fieldLabel('fr', 'questions.2.sentAt')).toBe('Question 3 · Envoyée le');
    expect(fieldLabel('en', 'questions.2.sentAt')).toBe('Question 3 · Sent on');
    expect(fieldLabel('fr', 'adjustments.0.amount')).toBe('Retraitement 1 · Montant');
    expect(fieldLabel('fr', 'comps.1.ev')).toBe('Comparable 2 · VE');
    expect(fieldLabel('fr', 'questions')).toBe('Question');
  });
  it('names plain fields, history cells with their year, plan years', () => {
    expect(fieldLabel('fr', 'kpi.churn')).toBe('Churn clients');
    expect(fieldLabel('en', 'kpi.churn')).toBe('Customer churn');
    expect(fieldLabel('fr', 'hist.rev.4', demoDeal())).toBe('Chiffre d’affaires 2025');
    expect(fieldLabel('fr', 'plan.growth.1')).toBe('Croissance an 2');
    expect(fieldLabel('fr', 'whatever.x')).toBe('whatever.x');
  });
});

describe('valueText', () => {
  it('translates stored French values and recipients', () => {
    expect(valueText('Envoyée', en)).toBe('Sent');
    expect(valueText('À confirmer', en)).toBe('To confirm');
    expect(valueText('Financier', fr)).toBe('Financier');
    expect(valueText('seller', fr, 'questions.0.awaitedFrom')).toBe('Vendeur ou banquier');
  });
  it('formats dates, numbers, booleans and long text compactly', () => {
    expect(nb(valueText('2026-11-01', fr))).toBe('1 nov. 2026');
    expect(valueText('2026-11-01', en)).toBe('1 Nov 2026');
    expect(nb(valueText(12.5, fr))).toBe('12,50');
    expect(valueText(true, en)).toBe('Yes');
    expect(valueText('x'.repeat(100), fr)).toHaveLength(60);
    expect(valueText(null, fr)).toBe('—');
  });
  it('summarises rows and arrays', () => {
    expect(valueText({ id: 'q', q: 'Quel churn ?' }, fr)).toBe('« Quel churn ? »');
    expect(valueText([2021, 2022], fr, 'hist.years')).toBe('2021 · 2022');
    expect(nb(valueText(1450, fr, 'kpi.customers'))).toBe('1 450');
    expect(valueText([{}, {}, {}], fr)).toBe('3 éléments');
  });
});

describe('activityText', () => {
  it('patch on a question field', () => {
    const r = activityText(e({ path: 'questions.0.status', oldValue: 'Ouverte', newValue: 'Envoyée' }), en);
    expect(r).toEqual({ action: 'Edit', field: 'Question 1 · Status', from: 'Open', to: 'Sent' });
  });
  it('row added / removed shows the row text once', () => {
    expect(activityText(e({ kind: 'list_add', path: 'questions', newValue: { id: 'a', q: 'Dette ?' } }), fr))
      .toEqual({ action: 'Ajout d’une ligne', field: 'Question', from: null, to: '« Dette ? »' });
    expect(activityText(e({ kind: 'list_remove', path: 'comps', oldValue: { id: 'c', target: 'Cible A' } }), fr))
      .toMatchObject({ field: 'Comparable', from: '« Cible A »', to: null });
  });
  it('phase, decision, owner and contributors use labels and names', () => {
    expect(activityText(e({ kind: 'phase', oldValue: 'analysis', newValue: 'bote_written' }), fr)).toMatchObject({ from: 'Analyse en cours', to: 'BOTe rédigé' });
    expect(activityText(e({ kind: 'decide', oldValue: null, newValue: 'no_go' }), en)).toMatchObject({ from: '—', to: 'No-go' });
    expect(activityText(e({ kind: 'owner', oldValue: 'u1', newValue: 'u2' }), fr)).toMatchObject({ from: 'Alice', to: 'Bob' });
    expect(activityText(e({ kind: 'contributors', oldValue: [], newValue: ['u1', 'u2'] }), fr)).toMatchObject({ to: 'Alice, Bob' });
    expect(activityText(e({ kind: 'create', newValue: { name: 'X' } }), fr)).toMatchObject({ from: null, to: null });
  });
});
