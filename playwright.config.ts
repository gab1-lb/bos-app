import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3107);
const PORT_SB = PORT + 1;
const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  // French browsers by default (the team's language); English is tested explicitly with test.use({ locale }).
  use: { trace: 'off', locale: 'fr-FR', launchOptions: existsSync(chromium) ? { executablePath: chromium } : {} },
  projects: [
    { name: 'memory', testIgnore: /supabase-mode/, use: { baseURL: `http://localhost:${PORT}` } },
    { name: 'supabase', testMatch: /supabase-mode/, use: { baseURL: `http://localhost:${PORT_SB}` } },
  ],
  webServer: [
    {
      command: `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}/login`,
      timeout: 120_000,
      env: { NEXT_PUBLIC_DATA_MODE: 'memory' },
    },
    {
      // Supabase mode with dummy credentials: no session means no network call.
      command: `npx next dev -p ${PORT_SB} --turbopack`,
      url: `http://localhost:${PORT_SB}/login`,
      timeout: 120_000,
      env: {
        NEXT_PUBLIC_DATA_MODE: 'supabase',
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'dummy-anon-key',
        NEXT_DIST_DIR: '.next-sb',
      },
    },
  ],
});
