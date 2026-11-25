import type { NextConfig } from "next";

if (
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PUBLIC_DATA_MODE === 'memory' &&
  process.env.BOS_ALLOW_MEMORY_BUILD !== '1'
) {
  throw new Error('NEXT_PUBLIC_DATA_MODE=memory must not be used in a production build (set BOS_ALLOW_MEMORY_BUILD=1 to override).');
}

const nextConfig: NextConfig = {
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
