import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATES, defaultRecipient, mailtoHref, renderTemplate, suggestTemplate, type TemplateKey } from './templates';
import { blankDeal, demoDeal, DEFAULT_MANDATE } from '../engine/samples';
import { mkMeta, NOW, ago } from './testutil';
import type { Member } from './permissions';
import type { Wait } from './waits';

const nb = (s: string) => s.replace(/[  ]/g, ' ');
const author: Member = { id: 'u1', email: 'a@x.fr', name: 'Alice', avatarUrl: null, role: 'analyst', status: 'active', locale: 'fr' };
const tpl = (key: TemplateKey, locale: 'fr' | 'en') => DEFAULT_TEMPLATES.find((t) => t.key === key && t.locale === locale)!;
const ctx = (deal = demoDeal(), locale: 'fr' | 'en' = 'fr') => ({ deal, meta: mkMeta(), mandate: DEFAULT_MANDATE, author, locale, now: NOW });

describe('templates', () => {
  it('has 6 x 2', () => expect(DEFAULT_TEMPLATES).toHaveLength(12));
  it('renders committee_note FR', () => {
    const r = renderTemplate(tpl('committee_note', 'fr'), ctx());
    const body = nb(r.body);
    expect(nb(r.subject)).toContain('Projet Hélios');
    expect(body).toContain('15,9 %');
    expect(body).toContain('43,9 M€');
    expect(body).toContain('34,0 – 46,1 M€');
    expect(r.missing).not.toContain('irr');
  });
  it('renders committee_note EN', () => {
    expect(renderTemplate(tpl('committee_note', 'en'), ctx(demoDeal(), 'en')).body).toContain('€43.9m');
  });
  it('flags missing on blank deal', () => {
    const r = renderTemplate(tpl('committee_note', 'fr'), ctx(blankDeal()));
    expect(r.missing).toContain('irr');
    expect(r.body).toContain('[à compléter]');
    expect(renderTemplate(tpl('committee_note', 'en'), ctx(blankDeal(), 'en')).body).toContain('[to complete]');
  });
  it('questionsFor filters by recipient; days from late questions', () => {
    const d = demoDeal();
    d.questions = [
      { id: 'tq1', q: 'Q1', cat: '', priority: '', status: 'Envoyée', answer: '', awaitedFrom: 'seller', sentAt: ago(10), answeredAt: null },
      { id: 'tq2', q: 'Q2', cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: 'director', sentAt: null, answeredAt: null },
      { id: 'tq3', q: 'Q3', cat: '', priority: '', status: 'Répondue', answer: '', awaitedFrom: 'seller', sentAt: ago(20), answeredAt: ago(2) },
    ];
    const r = renderTemplate(tpl('reminder', 'fr'), { ...ctx(d), recipient: 'seller' });
    expect(r.body).toContain('- Q1');
    expect(r.body).not.toContain('Q2');
    expect(r.body).not.toContain('Q3');
    expect(r.body).toContain('depuis 10 jours');
  });
});

describe('review fixes', () => {
  const Q = (q: string, o: object) => ({ id: q, q, cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null, ...o });
  it('go_dd and no_go never disclose max price or hurdle', () => {
    for (const key of ['go_dd', 'no_go'] as const) {
      for (const locale of ['fr', 'en'] as const) {
        const r = renderTemplate(tpl(key, locale), ctx(demoDeal(), locale));
        const text = nb(r.subject + r.body);
        expect(text).not.toMatch(/43[,.]9/);
        expect(text).not.toMatch(/15[,.]0/);
        expect(text).not.toMatch(/34[,.]0|46[,.]1/);
        expect(r.missing).not.toContain('maxPrice');
        expect(r.missing).not.toContain('hurdle');
      }
    }
  });
  it('reminder lists only sent+unanswered for the recipient, days per recipient', () => {
    const d = demoDeal();
    d.questions = [
      Q('S1', { status: 'Envoyée', awaitedFrom: 'seller', sentAt: ago(10) }),
      Q('S2', { status: 'Envoyée', awaitedFrom: 'seller', sentAt: ago(12) }),
      Q('D1', { status: 'Envoyée', awaitedFrom: 'director', sentAt: ago(30) }),
      Q('U1', { awaitedFrom: 'seller' }),
    ];
    const r = renderTemplate(tpl('reminder', 'fr'), { ...ctx(d), recipient: 'seller' });
    expect(r.body).toContain('- S1');
    expect(r.body).toContain('- S2');
    expect(r.body).not.toMatch(/D1|U1/);
    expect(r.body).toContain('depuis 12 jours');
  });
  it('empty question list renders a sentence and is not missing', () => {
    const d = demoDeal();
    d.questions = [];
    const r = renderTemplate(tpl('bote_review', 'fr'), ctx(d));
    expect(r.body).toContain('Aucune question ouverte.');
    expect(r.missing).not.toContain('openQuestions');
    expect(renderTemplate(tpl('bote_review', 'en'), ctx(d, 'en')).body).toContain('No open questions.');
  });
});

describe('suggestTemplate', () => {
  const w = (level: Wait['level'], source: Wait['source'] = 'question'): Wait =>
    ({ dealId: 'd1', source, label: '', from: 'seller', since: ago(9), days: 9, level });
  const deal = demoDeal();
  deal.questions = [{ id: 'tq4', q: 'Q', cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null }];
  it('maps cases', () => {
    expect(suggestTemplate(mkMeta(), [w('late')])).toBe('reminder');
    expect(suggestTemplate(mkMeta(), [w('overdue')])).toBe('reminder');
    expect(suggestTemplate(mkMeta(), [w('late', 'phase')])).toBeNull();
    expect(suggestTemplate(mkMeta({ phase: 'analysis' }), [], deal)).toBe('info_request');
    expect(suggestTemplate(mkMeta({ phase: 'bote_written' }), [])).toBe('bote_review');
    expect(suggestTemplate(mkMeta({ phase: 'associate_review', validatedAt: ago(1) }), [])).toBe('committee_note');
    expect(suggestTemplate(mkMeta({ phase: 'associate_review' }), [])).toBeNull();
    expect(suggestTemplate(mkMeta({ phase: 'decided', decision: 'no_go' }), [])).toBe('no_go');
    expect(suggestTemplate(mkMeta({ phase: 'decided', decision: 'go_dd' }), [])).toBe('go_dd');
  });
  it('a decided deal suggests its decision message, even with late questions', () => {
    expect(suggestTemplate(mkMeta({ phase: 'decided', decision: 'no_go' }), [w('late')])).toBe('no_go');
    expect(suggestTemplate(mkMeta({ phase: 'decided', decision: 'indicative_offer' }), [w('late')])).toBe('reminder');
  });
});

describe('mailtoHref', () => {
  it('encodes newlines as CRLF', () => {
    const h = mailtoHref('Sujet é', 'a\nb', 'x@y.fr');
    expect(h.startsWith('mailto:x@y.fr?subject=')).toBe(true);
    expect(h).toContain('body=a%0D%0Ab');
  });
});

describe('home dialog helpers', () => {
  const Q = (q: string, o: object) => ({ id: q, q, cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null, ...o });
  const wait = (from: Wait['from'], days: number): Wait => ({ dealId: 'd', source: 'question', label: 'x', from, since: ago(days), days, level: days > 7 ? 'late' : 'ok' });
  it('reminder to the director includes sent questions with no explicit recipient (same default as waits)', () => {
    const d = demoDeal();
    d.questions = [Q('N1', { status: 'Envoyée', sentAt: ago(9) }), Q('S1', { status: 'Envoyée', awaitedFrom: 'seller', sentAt: ago(9) })];
    const r = renderTemplate(tpl('reminder', 'fr'), { ...ctx(d), recipient: 'director' });
    expect(r.body).toContain('- N1');
    expect(r.body).not.toContain('S1');
  });
  it('defaultRecipient: oldest question wait for reminder, most frequent explicit recipient for info_request', () => {
    const d = demoDeal();
    d.questions = [Q('A', { awaitedFrom: 'seller' }), Q('B', { awaitedFrom: 'seller' }), Q('C', { awaitedFrom: 'director' }), Q('D', {})];
    expect(defaultRecipient('reminder', d, [wait('director', 3), wait('seller', 12)])).toBe('seller');
    expect(defaultRecipient('reminder', d, [])).toBeUndefined();
    expect(defaultRecipient('info_request', d, [])).toBe('seller');
    expect(defaultRecipient('info_request', demoDeal(), [])).toBeUndefined();
    expect(defaultRecipient('bote_review', d, [wait('seller', 12)])).toBeUndefined();
  });
});
