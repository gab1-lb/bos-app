import { describe, it, expect } from 'vitest';
import { fmt, parseNum, t } from './format';

const nb = (s: string) => s.replace(/[  ]/g, ' ');

describe('fmt', () => {
  it('formats fr/en', () => {
    expect(nb(fmt('fr').meur(12.4))).toBe('12,4 M€');
    expect(fmt('en').meur(12.4)).toBe('€12.4m');
    expect(fmt('en').meur(-3)).toBe('−€3.0m');
    expect(fmt('en').pc(15.9)).toBe('15.9%');
    expect(nb(fmt('fr').pc(15.9))).toBe('15,9 %');
    expect(fmt('fr').mx(14.48)).toBe('14,5×');
    expect(fmt('en').sg(3, 0)).toBe('+3%');
    expect(fmt('fr').nf(NaN)).toBe('—');
    expect(fmt('fr').unitM()).toBe('M€');
    expect(fmt('en').unitM()).toBe('€m');
  });
});

describe('parseNum', () => {
  it('parses', () => {
    expect(parseNum('fr', '12,4')).toBe(12.4);
    expect(parseNum('en', '1,250.5')).toBe(1250.5);
    expect(parseNum('en', '12.4')).toBe(12.4);
    expect(parseNum('fr', '')).toBeNull();
    expect(parseNum('fr', 'abc')).toBe('invalid');
    expect(parseNum('fr', '−3,5 %')).toBe(-3.5);
  });
});

describe('t', () => {
  it('translates', () => {
    expect(t('en', 'TRI de {0} au prix d’entrée, au-dessus du seuil de {1}.', '15.9%', '15%')).toBe('IRR of 15.9% at the entry price, above the 15% hurdle.');
    expect(t('en', 'clé inconnue')).toBe('clé inconnue');
    expect(t('fr', 'Valeur {0}', 3)).toBe('Valeur 3');
  });
});
