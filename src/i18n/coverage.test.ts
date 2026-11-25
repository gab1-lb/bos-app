import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from './en';

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
});

describe('i18n coverage', () => {
  it('every literal t(…) key used in the app has an English entry', () => {
    const missing = new Set<string>();
    // t('…') and t(locale, '…'), single-quoted literals only (dynamic keys are covered by their label tables).
    const re = /\bt\(\s*(?:[a-zA-Z_.]+\s*,\s*)?'((?:[^'\\\n]|\\.)+)'/g;
    for (const f of files(join(__dirname, '..'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(re)) {
        const key = m[1].replace(/\\(.)/g, '$1');
        if (!(key in EN)) missing.add(`${key}  (${f.split('/src/')[1]})`);
      }
    }
    expect([...missing]).toEqual([]);
  });
});
