import { afterEach, describe, expect, it, vi } from 'vitest';
import { feedbackEmail, feedbackMailto, feedbackText, type Feedback } from './feedback';

const base: Feedback = { usefulness: 4, missing: 'Un export Excel & PDF', wouldUse: 'yes', comment: 'Très clair #1\nMerci é à', role: 'associate' };

afterEach(() => vi.unstubAllEnvs());

describe('feedbackText', () => {
  it('includes role, score, answers verbatim and the yes answer', () => {
    const s = feedbackText(base, 'fr');
    expect(s).toContain('Associé');
    expect(s).toContain('4 / 5');
    expect(s).toContain(base.missing);
    expect(s).toContain(base.comment);
    expect(s).toContain('Oui');
  });
  it('renders empty answers as a dash', () => {
    const s = feedbackText({ usefulness: null, missing: '', wouldUse: null, comment: '  ', role: 'analyst' }, 'fr');
    expect(s.match(/—/g)?.length).toBe(4);
  });
});

describe('feedbackMailto', () => {
  it('encodes subject and body so they survive', () => {
    const href = feedbackMailto(base, 'a@b.fr', 'fr');
    expect(href.startsWith('mailto:a@b.fr?subject=')).toBe(true);
    const m = /^mailto:a@b\.fr\?subject=([^&]*)&body=([\s\S]*)$/.exec(href);
    expect(m).not.toBeNull();
    expect(decodeURIComponent(m![1])).toBe('Avis sur BOS (démo)');
    expect(decodeURIComponent(m![2])).toBe(feedbackText(base, 'fr'));
  });
});

describe('feedbackEmail', () => {
  it('decodes the build-time variable', () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_B64', btoa('a@b.fr'));
    expect(feedbackEmail()).toBe('a@b.fr');
  });
  it('is null when unset, invalid or without @', () => {
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_B64', '');
    expect(feedbackEmail()).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_B64', '%%%');
    expect(feedbackEmail()).toBeNull();
    vi.stubEnv('NEXT_PUBLIC_FEEDBACK_B64', btoa('nope'));
    expect(feedbackEmail()).toBeNull();
  });
});
