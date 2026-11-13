import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Allow the sandbox preview proxy origin to load /_next/* dev resources
  // (Next.js 16 requires explicit opt-in for non-localhost dev origins).
  allowedDevOrigins: ["*.space-z.ai"],
  // Streamed metadata (Next.js >= 15.2 default for dynamic pages) emits a
  // late-resolved `<div hidden>` placeholder as <body>'s first child. The
  // client tree has no such element, so React hydration fails on EVERY page
  // ("server rendered HTML didn't match the client") and regenerates the
  // whole tree client-side. Serving blocking metadata to all agents puts the
  // resolved <head> tags in the initial HTML — no placeholder, no mismatch,
  // no SEO change (generateMetadata still resolves per request; crawlers
  // already received blocking metadata via the default bot list).
  htmlLimitedBots: /.*/,
  typescript: {
    // Fail builds on type errors — the codebase is type-clean; keep it that way.
    ignoreBuildErrors: false,
  },
  reactStrictMode: true,
  devIndicators: false,
};

export default nextConfig;
