/* `npm run gen:seed` : régénère supabase/seed.sql et supabase/seed-demo.sql depuis les sources TypeScript.
 * Les sources utilisent des imports sans extension : on les charge via Vite (présent avec Vitest). */
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const server = await createServer({
  root: ROOT, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
});
try {
  const m = await server.ssrLoadModule('/src/lib/seedSql.ts');
  writeFileSync(join(ROOT, 'supabase/seed.sql'), m.buildSeedSql());
  writeFileSync(join(ROOT, 'supabase/seed-demo.sql'), m.buildDemoSeedSql());
  console.log('supabase/seed.sql et supabase/seed-demo.sql écrits.');
} finally {
  await server.close();
}
