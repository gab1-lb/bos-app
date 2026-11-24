import { describe, it, expect } from 'vitest';
import { DEFAULT_TEMPLATES, mailtoHref, renderTemplate, suggestTemplate, type TemplateKey } from './templates';
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
      { q: 'Q1', cat: '', priority: '', status: 'Envoyée', answer: '', awaitedFrom: 'seller', sentAt: ago(10), answeredAt: null },
      { q: 'Q2', cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: 'director', sentAt: null, answeredAt: null },
      { q: 'Q3', cat: '', priority: '', status: 'Répondue', answer: '', awaitedFrom: 'seller', sentAt: ago(20), answeredAt: ago(2) },
    ];
    const r = renderTemplate(tpl('reminder', 'fr'), { ...ctx(d), recipient: 'seller' });
    expect(r.body).toContain('- Q1');
    expect(r.body).not.toContain('Q2');
    expect(r.body).not.toContain('Q3');
    expect(r.body).toContain('depuis 10 jours');
  });
});

describe('suggestTemplate', () => {
  const w = (level: Wait['level'], source: Wait['source'] = 'question'): Wait =>
    ({ dealId: 'd1', source, label: '', from: 'seller', since: ago(9), days: 9, level });
  const deal = demoDeal();
  deal.questions = [{ q: 'Q', cat: '', priority: '', status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null }];
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
});

describe('mailtoHref', () => {
  it('encodes newlines as CRLF', () => {
    const h = mailtoHref('Sujet é', 'a\nb', 'x@y.fr');
    expect(h.startsWith('mailto:x@y.fr?subject=')).toBe(true);
    expect(h).toContain('body=a%0D%0Ab');
  });
});
