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
  poweredByHeader: false,
  // Baseline security headers for every response. A full CSP is deliberately
  // NOT set here: Next.js App Router needs a nonce/strict-dynamic strategy
  // plumbed through the proxy to avoid breaking hydration and church-site
  // content; media files already carry their own restrictive CSP at the route
  // level. See SECURITY.md for the hardening roadmap.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          // Ignored by browsers over plain HTTP (dev/self-hosted), enforced on
          // every HTTPS deployment.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },
};

export default nextConfig;
