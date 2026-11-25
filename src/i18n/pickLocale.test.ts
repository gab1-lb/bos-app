import { describe, expect, it } from 'vitest';
import { pickLocale } from './pickLocale';

describe('pickLocale', () => {
  it('prefers the cookie', () => {
    expect(pickLocale('en', 'fr-FR')).toBe('en');
    expect(pickLocale('fr', 'en-US')).toBe('fr');
  });
  it('reads Accept-Language with quality values', () => {
    expect(pickLocale(undefined, 'en-US,en;q=0.9')).toBe('en');
    expect(pickLocale(undefined, 'de-DE,de;q=0.9,en;q=0.8,fr;q=0.7')).toBe('en');
    expect(pickLocale(undefined, 'en;q=0.5,fr-CH;q=0.8')).toBe('fr');
    expect(pickLocale('xx', 'en-GB')).toBe('en');
  });
  it('defaults to French', () => {
    expect(pickLocale(null, null)).toBe('fr');
    expect(pickLocale(undefined, 'de-DE,es')).toBe('fr');
    expect(pickLocale(undefined, '*')).toBe('fr');
  });
});
