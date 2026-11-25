import { describe, expect, it } from 'vitest';
import type { Question } from '../../engine/types';
import { withAnswered, withSent } from './compute';

const q = (o: Partial<Question> = {}): Question => ({
  id: 'q1', q: 'x', cat: 'Financier', priority: 'Normale', status: 'Ouverte', answer: '', awaitedFrom: null, sentAt: null, answeredAt: null, ...o,
});

describe('question dates', () => {
  it('sending an open question marks it Envoyée', () => {
    expect(withSent(q(), '2026-11-01')).toMatchObject({ sentAt: '2026-11-01', status: 'Envoyée' });
  });
  it('clearing the sent date reopens it', () => {
    expect(withSent(q({ sentAt: '2026-11-01', status: 'Envoyée' }), null)).toMatchObject({ sentAt: null, status: 'Ouverte' });
  });
  it('changing the sent date of an answered question keeps Répondue', () => {
    expect(withSent(q({ sentAt: '2026-11-01', answeredAt: '2026-11-05', status: 'Répondue' }), '2026-11-02').status).toBe('Répondue');
  });
  it('answering marks Répondue; clearing falls back to Envoyée or Ouverte', () => {
    const sent = q({ sentAt: '2026-11-01', status: 'Envoyée' });
    const ans = withAnswered(sent, '2026-11-03');
    expect(ans).toMatchObject({ answeredAt: '2026-11-03', status: 'Répondue' });
    expect(withAnswered(ans, null)).toMatchObject({ answeredAt: null, status: 'Envoyée' });
    expect(withAnswered(q({ answeredAt: '2026-11-03', status: 'Répondue' }), null).status).toBe('Ouverte');
  });
});
