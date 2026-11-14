/* OpenChurch master-refactor report — sections A–I (docx, R1 cover, DM-1 palette). */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, NumberFormat, SectionType, BorderStyle,
  WidthType, ShadingType, TableLayoutType, TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");

const PAL = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  primary: "0F172A", body: "1A222E", muted: "5A6472",
};
const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };

function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？…—,.:!?; ", ..."-_/", "\t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  return lines;
}
function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / (pt * 11));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, charsPerLine(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}
function calcCoverSpacing(params) {
  const { titleLineCount = 1, titlePt = 36, metaLineCount = 0 } = params;
  const usable = 16838 - 1200;
  const content = titleLineCount * (titlePt * 23 + 200) + 900 + metaLineCount * 330 + 1600;
  const remaining = Math.max(usable - content, 400);
  const bottom = Math.max(Math.floor(remaining * 0.45), 800);
  const top = Math.max(Math.floor(remaining * 0.45) - Math.max(0, 800 - bottom), 400);
  return { topSpacing: top, bottomSpacing: bottom };
}
function buildCover(config) {
  const padL = 1200, padR = 800;
  const available = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, available, 36, 22);
  const spacing = calcCoverSpacing({ titleLineCount: titleLines.length, titlePt, metaLineCount: (config.metaLines || []).length });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: PAL.accent, space: 12 };
  const children = [new Paragraph({ spacing: { before: spacing.topSpacing } })];
  children.push(new Paragraph({
    indent: { left: padL, right: padR }, spacing: { after: 500 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PAL.accent, space: 8 } },
    children: [new TextRun({ text: config.label.split("").join("  "), size: 18, color: PAL.accent, font: { ascii: "Calibri" }, characterSpacing: 40 })],
  }));
  titleLines.forEach((line, i) => children.push(new Paragraph({
    indent: { left: padL },
    spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
    children: [new TextRun({ text: line, size: titlePt * 2, bold: true, color: PAL.cover.titleColor, font: { ascii: "Arial" } })],
  })));
  if (config.subtitle) children.push(new Paragraph({
    indent: { left: padL }, spacing: { after: 800 },
    children: [new TextRun({ text: config.subtitle, size: 24, color: PAL.cover.subtitleColor, font: { ascii: "Arial" } })],
  }));
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: PAL.cover.metaColor, font: { ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: PAL.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: PAL.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED, borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({ shading: { type: ShadingType.CLEAR, fill: PAL.bg }, borders: noBorders, verticalAlign: "top", children })],
    })],
  })];
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 32, color: PAL.primary, font: { ascii: "Arial" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 120, line: 340, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 28, color: PAL.primary, font: { ascii: "Arial" } })],
  });
}
function r(text, o = {}) {
  return new TextRun({ text, size: o.size ?? 22, bold: o.bold, italics: o.italics, color: o.color ?? PAL.body, font: { ascii: o.mono ? "Consolas" : "Times New Roman" } });
}
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [r(text)];
  return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: opts.after ?? 120 }, children: runs });
}
function mono(text) { return new TextRun({ text, size: 20, color: PAL.primary, font: { ascii: "Courier New" } }); }
function bullet(text, level = 0) {
  return new Paragraph({
    alignment: AlignmentType.LEFT, bullet: { level }, spacing: { line: 312, after: 60 },
    children: Array.isArray(text) ? text : [r(text)],
  });
}
function tableTitle(text) {
  return new Paragraph({ keepNext: true, spacing: { before: 160, after: 80 }, children: [new TextRun({ text, bold: true, size: 21, color: PAL.muted, font: { ascii: "Arial" } })] });
}
const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };
function headerRow(cells, widths) {
  return new TableRow({
    tableHeader: true, cantSplit: true,
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg }, margins: cellMargins,
      children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: c, bold: true, size: 20, color: PAL.table.headerText, font: { ascii: "Arial" } })] })],
    })),
  });
}
function dataRow(cells, widths, zebra) {
  return new TableRow({
    cantSplit: true,
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: zebra ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : undefined, margins: cellMargins,
      children: [new Paragraph({ spacing: { line: 276 }, children: Array.isArray(c) ? c : [new TextRun({ text: c, size: 20, color: PAL.body, font: { ascii: "Times New Roman" } })] })],
    })),
  });
}
function tbl(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: PAL.table.accentLine },
      left: NB, right: NB,
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine },
      insideVertical: NB,
    },
    rows,
  });
}
function code(text) { return [new TextRun({ text, size: 20, color: PAL.primary, font: { ascii: "Courier New" } })]; }

const body = [];

/* ============ A ============ */
body.push(h1("A. Architecture Assessment"));
body.push(p([r("Existing stack (unchanged): "), r("Next.js 16 (standalone) on Bun, Prisma with a dual-provider schema (SQLite for development/self-hosting, PostgreSQL migrations for serverless/Neon), session-based authentication with bcrypt + httpOnly cookies, CSRF double-submit, per-tenant data access through server-side guards, and PATH-mode routing with "), r("/church/<slug>", { mono: true }), r(" URLs. Both deployments run the same code: the Space Z instance with seeded demo tenants (Grace, Emmanuel) and the Vercel instance on Neon with the real church CSMC.")]));
body.push(p([r("What the audit found already working: "), r("tenant isolation at the API layer, role-based permissions, demo-mode gating, password-reset lifecycle, forms privacy, media access control and the SEO baseline — all from the previous hardening engagement and all re-verified during this one.")]));
body.push(p([r("What was actually broken or missing (all root-caused live before any change): the platform homepage hardcoded two demo churches, so the Vercel deployment advertised 404 links while its real church was invisible; Emmanuel Parish had published sermon detail pages but no sermon archive (missing page record + nav item) while its detail pages linked back to that 404; onboarding published starter sections containing editor instructions, which CSMC's live site exposed to visitors (\u201cShare a short, warm introduction to your church here\u2026\u201d); and custom domains existed only as a database stub with no verification, provider integration, UI or canonical handling.")]));
body.push(tableTitle("Table A-1. Key changes in this engagement"));
body.push(tbl([
  headerRow(["Area", "Change"], [26, 74]),
  dataRow([code("Deployment consistency"), "Platform homepage is now database-driven: showcase cards, nav links and footer links render real tenant records from the deployment's own database; the section hides entirely when no church is published; demo credentials appear only in demo mode and only for isDemo-flagged churches."], [26, 74], true),
  dataRow([code("Sermon archive"), "Routing invariant added: any church with published sermons always has an accessible /sermons archive — the dedicated page record wins when it exists, otherwise a built-in archive renders; the church sitemap lists the archive whenever it exists; Emmanuel was seeded with its sermons page and nav item."], [26, 74]),
  dataRow([code("Publishing readiness"), "New validation service separates BLOCKING issues (unresolved template instructions reject the publish with the issue list) from WARNINGS (missing alt text, CTA without destination); the public renderer suppresses template-instruction sections from both the DOM and the RSC payload, and the draft preview shows an editor-facing hint instead."], [26, 74], true),
  dataRow([code("Custom domains"), "Full lifecycle: ChurchDomain status machine (PENDING \u2192 VERIFIED \u2192 ACTIVE), DNS TXT ownership verification with hashed expiring tokens, Vercel REST hosting assignment with provider-reported DNS records (or an honest manual mode), primary-domain canonical URLs, host-based routing in the new src/proxy.ts, and a dashboard Custom Domains page with copyable records and truthful status badges."], [26, 74]),
  dataRow([code("SEO & privacy"), "Canonical/OG/sitemap URLs follow the church's primary domain with one consistent canonical host; per-church robots.txt; explicit noindex on register/reset-password/forgot-password (login already had it)."], [26, 74], true),
], [26, 74]));

/* ============ B ============ */
body.push(h1("B. Multi-Tenancy"));
body.push(h2("B.1 Tenant resolution is centralised"));
body.push(p([r("All hostname \u2192 tenant resolution flows through one server-side function ("), mono("resolveChurchByHost"), r(") used by "), mono("src/proxy.ts"), r(" (Next.js 16 proxy, Node runtime). Only domains with status ACTIVE resolve; unverified, pending or removed hostnames never select a tenant. Lookups are cached per hostname for 60 seconds — positive AND negative results — with process-local invalidation on every domain mutation; the TTL bounds staleness on multi-instance deployments.")]));
body.push(p([r("The proxy rewrites custom-host requests to the church route ("), mono("/about"), r(" \u2192 "), mono("/church/<slug>/about"), r("), serves the church sitemap and robots at the domain root, and never rewrites platform paths (/console, /api, /login\u2026). Platform hosts (the configured origin, PLATFORM_ROOT_DOMAIN, localhost) are excluded before any database lookup. Host header handling: Host is used directly; X-Forwarded-Host is trusted only when Host is an internal address — arbitrary forwarded values cannot inject a tenant.")]));
body.push(h2("B.2 Database changes (additive migrations)"));
body.push(bullet([r("Church.isDemo (Boolean, default false) — demo tenants are now identifiable; the seed flags Grace and Emmanuel. Old rows default to false and are unaffected.")]));
body.push(bullet([r("ChurchDomain lifecycle columns: status (PENDING|VERIFIED|ACTIVE), isPrimary, verificationTokenHash (SHA-256; the old plaintext column is replaced — it never held data), tokenExpiresAt, provider, providerStatus, sslStatus, failureReason, verifiedAt/lastCheckedAt/removedAt, updatedAt, plus a status index. The unique constraint on domain (one hostname \u2260 two tenants) was already present and now carries the claim-race handling.")]));
body.push(bullet([r("PostgreSQL migration 20261114100547_church_demo_flag_and_domain_lifecycle (verified on a fresh database); SQLite self-hosts apply the same schema via prisma db push. CSMC's data on Neon is untouched by the migration (additive columns only).")]));
body.push(h2("B.3 Isolation test results"));
body.push(bullet("Cross-tenant API access (pages, ministries, media, submissions, events) returns 404 in both directions — re-verified this engagement (phase3 e2e 37/37)."));
body.push(bullet("Domain claim race: a second church adding a domain another church holds PENDING receives 409 CLAIM_PENDING; verified/active domains receive 409 DOMAIN_TAKEN without revealing the owner; a claim whose token expired is reclaimed with an audit entry — never silently transferred."));
body.push(bullet("Host isolation: an ACTIVE domain resolves only to its owning church (verified with two churches live); an unknown host never selects a tenant; a removed domain stops resolving within the 60s TTL bound (verified live)."));
body.push(bullet("Role enforcement: authors cannot manage domains (403, phase3 e2e); editors/authors never see the Custom Domains page; every domain API requires the new domains:manage permission (OWNER/ADMIN)."));

/* ============ C ============ */
body.push(h1("C. Custom-Domain Integration"));
body.push(h2("C.1 Workflow (what a church administrator does)"));
body.push(bullet([r("Dashboard \u2192 Custom Domains \u2192 "), r("enter the domain (apex, www or subdomain; validated — IPs, localhost, ports, paths and hosting-platform suffixes like *.vercel.app are rejected).")]));
body.push(bullet([mono("_openchurch-verify.<domain>"), r(" TXT "), mono("openchurch-verify=<token>"), r(" — ownership (shown by the dashboard with copy buttons).")]));
body.push(bullet("Connect hosting: on Vercel deployments (VERCEL_TOKEN + VERCEL_PROJECT_ID configured) the domain is added to the Vercel project and the provider's required DNS records (CNAME/A, provider-reported) are displayed with copy buttons; on self-hosted deployments the dashboard shows the manual DNS instructions and the owner confirms after pointing DNS at the server."));
body.push(bullet("Set as primary: canonical URLs, sitemap and Open Graph follow the primary domain; the platform /church/<slug> address keeps working (and canonicals point at the primary domain so the two URLs never compete in search)."));
body.push(h2("C.2 Verification security"));
body.push(bullet("Tokens are 256-bit CSPRNG values; only their SHA-256 hash is stored, so a database leak exposes nothing usable. Tokens expire after 72 hours; regeneration invalidates the old token. DNS TXT character-string splitting (long values) is handled. Comparison is constant-time on digests."));
body.push(bullet("Every lifecycle transition (added, verified, connected, primary changed, removed, stale-claim replacement, token regenerated) writes an audit entry with actor and domain."));
body.push(h2("C.3 Hosting-provider integration & SSL — truthful states"));
body.push(p([r("The Vercel adapter (REST, Bearer "), mono("VERCEL_TOKEN"), r(", optional "), mono("VERCEL_TEAM_ID"), r(") adds/removes/inspects project domains. Status comes from the provider: "), mono("verified"), r(", "), mono("misconfigured"), r(", and the required DNS records are read from the provider's config payload — nothing is hardcoded and no success is fabricated; API errors (409 conflict, 401, 5xx) surface as errors. SSL is provisioned by the hosting provider once DNS activates; the dashboard reports the provider's state (\u201cPROVISIONING\u201d until the provider confirms, \u201cmanaged by your hosting proxy\u201d in manual mode) — there is no fake green tick. The adapter was implemented against the documented Vercel API and unit-tested with an injected fetch (including conflict/auth/misconfiguration paths); a live end-to-end run against the real API requires the operator's VERCEL_TOKEN and is listed as outstanding.")]));
body.push(h2("C.4 Current limitations (honest)"));
body.push(bullet("Host-cache invalidation is process-local: on multi-instance serverless deployments a domain change can take up to 60 seconds to propagate (documented)."));
body.push(bullet("The Space Z deployment has no hosting API — churches there get the manual workflow (TXT verification still fully automated; hosting assignment is owner-confirmed and labelled as such)."));
body.push(bullet("www \u2192 apex redirect configuration is not automated; both domains can be ACTIVE with one primary (canonical strategy prevents duplicate indexing)."));
body.push(bullet("Vercel-adapter live API calls and real-DNS TXT verification (positive path) are unit/integration-tested with stubs; the positive live path requires a real domain + token (outstanding)."));

/* ============ D ============ */
body.push(h1("D. Routing and Publishing"));
body.push(bullet([r("Emmanuel sermon archive repaired: "), r("the missing page record and nav item were seeded, and the deeper routing flaw is fixed structurally — the built-in fallback archive guarantees every church with published sermons an accessible /sermons route even without a page record. The sermon detail page's \u201cAll sermons\u201d back-link now always resolves (verified on the production build: 3 published sermons listed).")]));
body.push(bullet([r("Homepage demo links repaired: "), r("no marketing link can 404 any more — every showcase link comes from a real tenant record in the deployment's own database (Vercel now shows CSMC; Space Z shows Grace and Emmanuel; an instance with no published churches hides the section).")]));
body.push(bullet([r("Publishing readiness: "), r("publishing a page with unresolved template instructions is rejected with the exact issue list (READINESS_BLOCKED); warnings (missing alt text, CTA without destination, video without URL) accompany a successful publish. The public renderer suppresses template-instruction sections entirely — absent from the rendered DOM and the RSC payload — which also fixes already-published pages like CSMC's homepage without touching their data. The draft preview shows a dashed editor hint for the same sections.")]));
body.push(bullet("Navigation consistency: unpublished pages never appear in public navigation (existing behaviour, re-verified); the sermon archive enters the sitemap whenever it exists."));

/* ============ E ============ */
body.push(h1("E. Security"));
body.push(bullet("Demo mode remains a server-side decision with five enforcement layers (login rejection, per-request session invalidation, privilege containment, seed protection, fail-safe defaults) — re-verified 16/16 this engagement; the homepage now additionally hides demo tenants entirely on deployments with demo mode off."));
body.push(bullet("Authentication (bcrypt cost 11, hashed session tokens, httpOnly SameSite=Lax cookies, secure in production), password-reset lifecycle (hashed single-use 60-minute tokens, rate limits, generic responses, session revocation) — unchanged, re-verified."));
body.push(bullet("Role enforcement extended with domains:manage (OWNER/ADMIN); server-side on every domain API and page (frontend hiding is never the boundary)."));
body.push(bullet("Forms & media privacy re-verified: prayer/counselling submissions are church-scoped with sensitive handling; cross-tenant submission and media listings 404; media uploads keep size/type limits."));
body.push(bullet("Auth/recovery pages now all carry explicit noindex,nofollow metadata (register and reset-password via server layouts, forgot-password inline) in addition to robots.txt."));
body.push(bullet("CSRF works unchanged on custom domains: browser Origin equals request Host on provider-routed domains (rule 1), and the double-submit fallback covers Host-rewriting gateways (rule 3) — both paths re-verified."));

/* ============ F ============ */
body.push(h1("F. SEO"));
body.push(bullet([r("Canonical strategy: one canonical host per church — the ACTIVE primary domain when set (even when the page is visited via the platform slug route), else the serving custom domain, else the platform origin. Applied to canonical links, Open Graph, Twitter cards, the church sitemap and per-sermon metadata.")]));
body.push(bullet("Church sitemap lists published pages, the sermon archive (page record or fallback) and published sermon details; drafts/archived excluded (re-verified 28/28 phase2 e2e)."));
body.push(bullet("Per-church robots.txt at the custom-domain root references the church sitemap on its canonical origin; the platform robots.txt continues to exclude console/auth/admin routes."));
body.push(bullet("Under a custom domain, internal links are root-relative (/about) — clean URLs, no /church/<slug> leakage; canonical and OG image URLs resolve on the church's own origin."));

/* ============ G ============ */
body.push(h1("G. Testing Results"));
body.push(tableTitle("Table G-1. Verification matrix (this engagement)"));
body.push(tbl([
  headerRow(["Area", "Method", "Result"], [30, 34, 36]),
  dataRow(["Unit / integration tests", "vitest, 21 files", "195/195 passed (was 114; +81 new: domain validation, TXT logic, cache TTL/isolation, provider adapter incl. failure paths, readiness, lifecycle against a throwaway DB)"], [30, 34, 36], true),
  dataRow(["Dashboard & tenant isolation e2e", "phase3-e2e.sh (HTTP, standalone build)", "37/37 passed (+9 new custom-domain checks: add, honest DNS failure, cross-tenant claim block, invalid/suffix rejection, author 403, removal)"], [30, 34, 36]),
  dataRow(["SEO e2e", "phase2-e2e.sh", "28/28 passed"], [30, 34, 36], true),
  dataRow(["Demo-mode security e2e", "demo-mode-e2e.sh (two isolated servers)", "16/16 passed"], [30, 34, 36]),
  dataRow(["Route smoke (console incl. Domains, APIs, public sites)", "smoke-test.sh", "All 200s / expected redirects; cross-tenant 404s"], [30, 34, 36], true),
  dataRow(["Custom-domain routing (proxy rewrite, canonical, sitemap, robots, clean links, removal TTL, tenant isolation by host)", "Live curl with Host overrides on dev server + production standalone build", "All behaviours verified live (documented in Sections C/F); negative-cache TTL bound confirmed"], [30, 34, 36]),
  dataRow(["Production build", "bun run build + standalone boot + route sweep", "Boots and serves all routes; Emmanuel archive live with 3 sermons"], [30, 34, 36], true),
  dataRow(["Vercel adapter against the LIVE Vercel API", "Not tested", "Requires the operator's VERCEL_TOKEN/PROJECT_ID; implemented against documented API and unit-tested with stubbed fetch (conflict, auth, misconfiguration paths)"], [30, 34, 36]),
  dataRow(["Positive real-DNS TXT verification", "Not tested (live)", "Negative path verified live (honest failure reasons); positive path covered by unit tests with a stubbed resolver — requires a real registrar domain"], [30, 34, 36], true),
  dataRow(["Responsive sweep of the new Domains page (5 breakpoints)", "Spot-checked in dev at desktop/mobile widths", "Layout is standard dashboard patterns; the full automated sweep was not re-run — outstanding"], [30, 34, 36]),
], [30, 34, 36]));

/* ============ H ============ */
body.push(h1("H. Deployment Instructions"));
body.push(h2("H.1 Environment variables (server-side only)"));
body.push(tableTitle("Table H-1. Variables for this release"));
body.push(tbl([
  headerRow(["Variable", "Required", "Purpose"], [30, 16, 54]),
  dataRow([code("VERCEL_TOKEN"), "Automated domains", "Enables automated Vercel domain assignment together with VERCEL_PROJECT_ID"], [30, 16, 54], true),
  dataRow([code("VERCEL_PROJECT_ID"), "Automated domains", "The Vercel project domains are attached to"], [30, 16, 54]),
  dataRow([code("VERCEL_TEAM_ID"), "No", "Vercel team scope when applicable"], [30, 16, 54], true),
  dataRow([code("NEXT_PUBLIC_SITE_URL"), "Recommended", "Platform origin — also blocks it from being claimed as a church domain"], [30, 16, 54]),
  dataRow([code("DEMO_MODE"), "No", "Keep unset/false on real instances (fail-safe default)"], [30, 16, 54], true),
], [30, 16, 54]));
body.push(h2("H.2 Migrations"));
body.push(bullet([r("Vercel/Neon: nothing manual — "), mono("scripts/vercel-build.sh"), r(" runs "), mono("prisma migrate deploy"), r(" on every build; the new migration applies automatically (additive, CSMC data untouched).")]));
body.push(bullet("Self-hosted PostgreSQL: run prisma migrate deploy. SQLite self-hosts: bun run db:push."));
body.push(h2("H.3 DNS records a church adds (its own registrar)"));
body.push(bullet([mono("_openchurch-verify.<domain>"), r(" TXT "), mono("openchurch-verify=<token>"), r(" — ownership (shown by the dashboard with copy buttons).")]));
body.push(bullet([r("The hosting record the provider reports — e.g. Vercel CNAME for subdomains/www or A for the apex — displayed per-domain in the dashboard; never hardcoded in this document.")]));
body.push(h2("H.4 Steps that still require a human"));
body.push(bullet("Push this code to GitHub (adeyemi-mike/OpenChurch) and let Vercel redeploy; the Space Z instance needs a platform-side Deploy click for its artifact."));
body.push(bullet("Create a Vercel access token with Domain scope and set VERCEL_TOKEN + VERCEL_PROJECT_ID to switch churches from manual to automated domain connection; until then the manual workflow is honest and fully usable."));
body.push(bullet("The first real custom-domain end-to-end test (real registrar + Vercel API) after those variables are set."));

/* ============ I ============ */
body.push(h1("I. Production-Readiness Assessment"));
body.push(p([r("Verdict: "), r("Limited production testing ready.", { bold: true }), r(" Basis: the full verification matrix above passed (195/195 unit/integration incl. the domain lifecycle against a real database; 37/37 dashboard+domain e2e; 28/28 SEO; 16/16 demo-mode security; live verification of custom-domain routing, canonical strategy, sitemap/robots and removal semantics on a production standalone build; no advertised 404s remain on either deployment's homepage). The custom-domain feature is production-shaped but its provider integration and positive DNS path have been verified with stubs, not against the live Vercel API and a real registrar — those two live validations, plus a responsive sweep of the new dashboard page, are the explicit conditions for moving to full production readiness.")]));
body.push(p([r("Recommended sequence: deploy this build to both hosts; set the Vercel domain variables; connect one real church domain end-to-end as the acceptance test; then run the outstanding sweep. The platform honestly labels every not-yet-live capability (manual mode, provider statuses, SSL states) rather than faking success states.")]));

/* ============ document ============ */
const doc = new Document({
  features: { updateFields: true },
  styles: {
    default: {
      document: { run: { font: "Times New Roman", size: 22, color: PAL.body } },
    },
  },
  sections: [
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 720, bottom: 720, left: 1080, right: 1080 } } },
      children: buildCover({
        label: "ENGINEERING REPORT",
        title: "OpenChurch Master Refactor: Multi-Tenant Consistency, Routing & Custom Domains",
        subtitle: "Deployment-consistent marketing, guaranteed sermon archives, publishing readiness, and a verified custom-domain lifecycle",
        metaLines: [
          "Project: OpenChurch — multi-tenant church website platform",
          "Deployments: v12hk9yeagh1-d.space-z.ai · open-church-one.vercel.app",
          "Date: 14 November 2026",
          "Scope: Priorities 1–5 + security/SEO/QA phases",
        ],
        footerLeft: "OpenChurch Engineering", footerRight: "November 2026",
      }),
    },
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: { width: 11906, height: 16838 }, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 }, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine, space: 4 } },
            children: [new TextRun({ text: "OpenChurch — Master Refactor & Custom Domains Report", size: 16, color: PAL.muted, font: { ascii: "Arial" } })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: PAL.muted, font: { ascii: "Times New Roman" } })],
          })],
        }),
      },
      children: [
        new Paragraph({ spacing: { before: 0, after: 240 }, children: [new TextRun({ text: "Table of Contents", bold: true, size: 30, color: PAL.primary, font: { ascii: "Arial" } })] }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({ children: [new PageBreak()] }),
        ...body,
      ],
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("download/OpenChurch_Master-Refactor_Report.docx", buf);
  console.log("written: download/OpenChurch_Master-Refactor_Report.docx");
});
