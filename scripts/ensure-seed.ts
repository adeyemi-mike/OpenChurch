/**
 * ensure-seed.ts — auto-repair guard for the dev/deploy entrypoint.
 *
 * The platform's redeploy flow can regenerate .env and recreate an empty
 * SQLite file, which leaves the demo site with "Church not found" errors.
 * This script runs before `next dev` and:
 *   1. Makes sure the database schema exists (prisma db push, idempotent).
 *   2. Seeds demo content ONLY when the churches table is empty/missing.
 *   3. NEVER fails the startup — any error is logged and swallowed, because
 *      a running dev server without seed data is still better than no server.
 *
 * Exit code is always 0.
 */
import { spawnSync } from "node:child_process";
import { Database } from "bun:sqlite";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

/**
 * Resolve the SQLite file path used by this project.
 * Fresh deploy checkouts have no .env, so we derive a project-relative
 * default and make sure both process.env and .env carry it.
 */
function dbFilePath(): string {
  const url = process.env.DATABASE_URL ?? "";
  if (url.startsWith("file:")) {
    const p = url.slice("file:".length).split("?")[0];
    return resolve(p);
  }
  return resolve("db/custom.db");
}

/**
 * Guarantee DATABASE_URL exists in the environment AND in .env (Next.js and
 * Bun both read .env from the project root at startup). Only writes when
 * something is missing — never clobbers operator-provided configuration.
 */
function ensureDatabaseEnv(dbPath: string): string {
  const fileUrl = `file:${dbPath}`;
  let envUrl = process.env.DATABASE_URL ?? "";

  const envPath = resolve(".env");
  let lines: string[] = [];
  if (existsSync(envPath)) {
    lines = readFileSync(envPath, "utf8").split("\n");
    const found = lines.find((l) => l.trim().startsWith("DATABASE_URL="));
    if (found) envUrl = found.slice("DATABASE_URL=".length).trim();
  }

  let changed = false;
  if (!envUrl) {
    envUrl = fileUrl;
    lines = lines.filter((l) => !l.trim().startsWith("DATABASE_URL="));
    lines.push(`DATABASE_URL=${fileUrl}`);
    changed = true;
  }
  // NOTE: we deliberately do NOT write NEXT_PUBLIC_APP_URL /
  // NEXT_PUBLIC_SITE_URL here — a startup script cannot know the deployment's
  // public origin, and guessing "localhost" leaks localhost into canonical
  // URLs, Open Graph tags and sitemaps. Operators configure the canonical
  // origin via NEXT_PUBLIC_SITE_URL (.env / .env.production / platform env).
  if (changed) {
    writeFileSync(envPath, `${lines.filter((l) => l !== "").join("\n")}\n`);
    console.log("[ensure-seed] wrote .env (DATABASE_URL)");
  }

  // Make sure child processes (prisma, seed) see it even if the parent
  // shell did not export it.
  process.env.DATABASE_URL = envUrl;
  return envUrl;
}

function churchesCount(path: string): number | null {
  try {
    if (!existsSync(path)) return null;
    const db = new Database(path, { readonly: true });
    try {
      const hasTable = db
        .query(
          "SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='churches'"
        )
        .get() as { c: number } | undefined;
      if (!hasTable || hasTable.c === 0) return null;
      const row = db.query("SELECT COUNT(*) AS c FROM churches").get() as {
        c: number;
      };
      return row.c;
    } finally {
      db.close();
    }
  } catch {
    return null;
  }
}

function run(cmd: string[], label: string): boolean {
  console.log(`[ensure-seed] ${label}…`);
  const res = spawnSync(cmd[0], cmd.slice(1), {
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    timeout: 180_000,
    env: process.env,
  });
  if (res.status !== 0) {
    const out = `${res.stdout ?? ""}\n${res.stderr ?? ""}`.trim();
    console.error(
      `[ensure-seed] ${label} failed (exit ${res.status}):\n${out.slice(-2000)}`
    );
    return false;
  }
  return true;
}

async function main() {
  const path = dbFilePath();
  mkdirSync(dirname(path), { recursive: true });
  ensureDatabaseEnv(path);

  const count = churchesCount(path);
  if (count !== null && count > 0) {
    console.log(
      `[ensure-seed] database OK (${count} churches) — skipping seed`
    );
    // Backfill the isDemo flag for databases provisioned by an older build.
    // Idempotent and cheap; keeps the server-side demo gate authoritative
    // even when no seeding is needed.
    run(["bun", "scripts/mark-demo-users.ts"], "mark demo users");
    return;
  }

  console.log(
    `[ensure-seed] database empty or missing (churches=${count ?? "n/a"}) — bootstrapping…`
  );

  // Schema first (creates the file + tables when missing).
  const pushed = run(
    ["bunx", "prisma", "db", "push", "--skip-generate", "--accept-data-loss"],
    "prisma db push"
  );

  // Then demo content.
  const seeded = run(["bun", "prisma/seed.ts"], "prisma seed");

  // Backfill the isDemo flag on databases seeded before the flag existed.
  run(["bun", "scripts/mark-demo-users.ts"], "mark demo users");

  if (pushed && seeded) {
    const after = churchesCount(path);
    console.log(`[ensure-seed] bootstrap complete (churches=${after ?? "?"})`);
  } else {
    console.error(
      "[ensure-seed] bootstrap incomplete — starting server anyway"
    );
  }
}

main().catch((err) => {
  console.error("[ensure-seed] unexpected error (continuing):", err);
}).finally(() => {
  // Always succeed so the dev server starts regardless.
  process.exit(0);
});
