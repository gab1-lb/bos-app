import { describe, expect, it } from 'vitest';
import { onlyNonBuildChanges } from '../../scripts/netlify-ignore.mjs';

describe('onlyNonBuildChanges', () => {
  it('is true when only docs, e2e, tests and markdown changed', () => {
    expect(onlyNonBuildChanges(['docs/a.md', 'e2e/x.spec.ts', 'src/domain/home.test.ts', 'README.md'])).toBe(true);
  });
  it('is false when app code changed too', () => {
    expect(onlyNonBuildChanges(['docs/a.md', 'src/app/page.tsx'])).toBe(false);
  });
  it('is false for build config', () => {
    expect(onlyNonBuildChanges(['netlify.toml'])).toBe(false);
  });
  it('is false for an empty diff (unknown, so build)', () => {
    expect(onlyNonBuildChanges([])).toBe(false);
  });
});
