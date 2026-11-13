# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# OpenChurch — production image (Next.js standalone)
# Build:  docker build -t openchurch .
# Run:    docker run -p 3000:3000 --env-file .env openchurch
# ─────────────────────────────────────────────────────────────

FROM oven/bun:1.1-slim AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1.1-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# .dockerignore includes .env.production (deployment config: canonical public
# URL + demo flag, no secrets) — next build loads it under NODE_ENV=production
# so NEXT_PUBLIC_* values are baked into the client bundle correctly.
# Build with the bundled SQLite datasource by default. For PostgreSQL images,
# override at runtime — the app reads DATABASE_URL when it starts.
RUN bun run build

FROM oven/bun:1.1-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

# Standalone server + static assets + public files
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Deployment env (canonical public URL, demo mode) for the standalone server:
# @next/env loads .env.production at runtime with NODE_ENV=production.
# Override per-deployment with `docker run -e NEXT_PUBLIC_SITE_URL=...` —
# real environment variables always take precedence over env files.
COPY --from=builder --chown=nextjs:nodejs /app/.env.production ./

# Prisma schema + CLI for migrations at container start, and the seed for
# operators who want demo content.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# Persistent media storage
RUN mkdir -p /app/storage/uploads && chown -R nextjs:nodejs /app/storage
VOLUME ["/app/storage/uploads"]

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD bun -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

# db:ensure bootstraps the database (schema push + seed when the churches
# table is empty) and always exits 0, then the standalone server starts.
CMD ["sh", "-c", "bun run db:ensure && exec bun server.js"]
