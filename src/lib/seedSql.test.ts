import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { buildDemoSeedSql, buildSeedSql } from './seedSql';

const read = (f: string) => readFileSync(path.resolve(__dirname, '../../supabase', f), 'utf8');

describe('seed SQL', () => {
  it('seed.sql committed = généré (lancer npm run gen:seed)', () => {
    expect(read('seed.sql')).toBe(buildSeedSql());
  });
  it('seed-demo.sql committed = généré (lancer npm run gen:seed)', () => {
    expect(read('seed-demo.sql')).toBe(buildDemoSeedSql());
  });
  it('seed.sql contient les placeholders et 12 modèles, sans dossier', () => {
    const s = buildSeedSql();
    expect(s).toContain('__ALLOWED_DOMAIN__');
    expect(s).toContain('__ADMIN_EMAIL__');
    expect((s.match(/^  \('/gm) ?? []).length).toBe(12);
    expect(s).not.toContain('public.deals');
  });
});
