// Netlify build entry. The same repository feeds two sites:
//  - the team site (Supabase, Google sign-in): default;
//  - the public demo (BOS_DEMO=1 set in that site's Netlify settings): fictitious data kept in the
//    visitor's browser, no account, nothing stored anywhere.
import { spawnSync } from 'node:child_process';

const env = { ...process.env };
// Netlify's own address for this site: absolute links in the preview card shown when the link is shared.
if (env.URL && !env.NEXT_PUBLIC_SITE_URL) env.NEXT_PUBLIC_SITE_URL = env.URL;
if (env.BOS_DEMO === '1') {
  Object.assign(env, { NEXT_PUBLIC_DATA_MODE: 'memory', NEXT_PUBLIC_DEMO: '1', BOS_ALLOW_MEMORY_BUILD: '1' });
  // Founder's address for the feedback dialog: base64 only, never logged.
  if (env.BOS_FEEDBACK_EMAIL?.trim()) env.NEXT_PUBLIC_FEEDBACK_B64 = Buffer.from(env.BOS_FEEDBACK_EMAIL.trim()).toString('base64');
  console.log('BOS: building the public demo (memory data, no sign-in).');
}
const r = spawnSync('npx', ['next', 'build'], { stdio: 'inherit', env });
process.exit(r.status ?? 1);
