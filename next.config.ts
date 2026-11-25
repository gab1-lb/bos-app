import type { NextConfig } from "next";

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DATA_MODE === 'memory' &&
  process.env.BOS_ALLOW_MEMORY_BUILD !== '1'
) {
  throw new Error('NEXT_PUBLIC_DATA_MODE=memory must not be used in a production build (set BOS_ALLOW_MEMORY_BUILD=1 to override).');
}

/** Supabase API origin (REST, auth, realtime websocket) for connect-src; fixed at build time like every NEXT_PUBLIC_ value. */
function supabaseOrigins(): string[] {
  try {
    const u = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '');
    return [u.origin, `${u.protocol === 'http:' ? 'ws:' : 'wss:'}//${u.host}`];
  } catch {
    return [];
  }
}

const dev = process.env.NODE_ENV !== 'production';

/** Content Security Policy: only the app's own scripts, workers and media; data goes to Supabase only; never framed. */
const CSP = [
  "default-src 'self'",
  // Next.js inlines its bootstrap scripts (no nonce on statically rendered pages); the dev server also needs eval.
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Google profile pictures of members.
  "img-src 'self' data: blob: https://*.googleusercontent.com",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigins().join(' ')}`.trim(),
  "worker-src 'self' blob:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = [
  { key: 'Content-Security-Policy', value: CSP },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'same-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // `npm run record:tour -- --dev` : pas d'indicateur Next.js dans la vidéo.
  ...(process.env.BOS_HIDE_DEV_INDICATOR === '1' ? { devIndicators: false as const } : {}),
  // pdf.js (IM import) requires the Node-only `canvas` package in a branch browsers never take: not bundled.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  turbopack: { resolveAlias: { canvas: './src/lib/empty-module.ts' } },
};

export default nextConfig;
