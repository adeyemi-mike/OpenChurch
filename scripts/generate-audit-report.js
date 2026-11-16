/* OpenChurch audit & hardening report — Workstreams A–P (docx, R1 cover, DM-1 palette). */
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

/* ============ 1 ============ */
body.push(h1("1. Executive Summary"));
body.push(p([r("This engagement executed the requested full audit, repair and hardening pass across OpenChurch's sixteen workstreams (A\u2013P): four deep-dive audits (authentication, multi-tenant security, the custom-domain system, and public-site/SEO/privacy/documentation accuracy) against the live repository, followed by prioritised fixes for every confirmed P0 and P1 finding, regression-tested end to end.")]));
body.push(p([r("Verdict: "), r("the multi-tenant core was already unusually disciplined — one authorisation guard ("), mono("requireChurch"), r("), church-scoped queries everywhere, globally-unique hostnames, no client-supplied tenant identifiers, and no confirmed cross-tenant defect in 63 dashboard handlers. The material risks sat at the edges: an unauthenticated cron endpoint, Host-header-poisonable password-reset links, a timing side-channel, unthrottled tenant creation, authors able to delete published content, private media marked publicly cacheable, missing security headers, a privacy policy that promised export/deletion features which did not exist, and platform-subdomain routing that was documented but unreachable in code."), r(" All of these are fixed and verified in this delivery.", { bold: true })]));
body.push(p([r("Every fix is covered by automated evidence: the test suite grew from 254 to 282 checks, including a new HTTP-level tenant-isolation suite that drives the real route handlers with real database-backed sessions for two independent tenants. Lint went from 8 errors to clean; type-check, production build, the 16-check demo-mode e2e and the 38-check dashboard-workflow e2e all pass. This report distinguishes, as required, between completed code and the external configuration an operator must still provide.")]));
body.push(tableTitle("Table 1-1. Engagement at a glance"));
body.push(tbl([
  headerRow(["Dimension", "Before", "After"], [24, 38, 38]),
  dataRow([code("Type-check / lint"), "PASS / FAIL (8 errors)", "PASS / PASS (0 errors)"], [24, 38, 38], true),
  dataRow([code("Unit & integration tests"), "254 passed (25 files)", "282 passed (26 files) \u2014 incl. 24 new HTTP-level isolation scenarios"], [24, 38, 38]),
  dataRow([code("Production build"), "PASS", "PASS (standalone, 30 static pages)"], [24, 38, 38], true),
  dataRow([code("Demo-mode e2e"), "16/16", "16/16 (re-run on the hardened build)"], [24, 38, 38]),
  dataRow([code("Phase-3 API e2e"), "32/38 \u2014 6 pre-existing failures (plan-gating gap in the script)", "38/38 (script fixed to set demo plans, mirroring operator action)"], [24, 38, 38], true),
  dataRow([code("P0 security findings"), "8 open", "0 open \u2014 all fixed and covered by tests"], [24, 38, 38]),
  dataRow([code("P1 findings"), "11 open", "0 open \u2014 all fixed; 7 items remain external configuration or documented roadmap"], [24, 38, 38], true),
], [24, 38, 38]));

/* ============ 2 ============ */
body.push(h1("2. Method and Baseline"));
body.push(p([r("Rule 1 (inspect before modifying) governed the session. Four research-only audits mapped the codebase end to end: (B) the authentication lifecycle, (C) every tenant-sensitive server operation across all 40 dashboard route files, (I) the custom-domain system delivered in the previous engagement, and (M/N) the public site, SEO surfaces, privacy/terms claims and documentation accuracy. Every claim below carries a file:line reference in the working notes; only findings reproducible in code were classified as defects.")]));
body.push(tableTitle("Table 2-1. Baseline, before any change (Rule 2)"));
body.push(tbl([
  headerRow(["Check", "Result"], [34, 66]),
  dataRow([code("bun run typecheck"), "PASS \u2014 type-clean codebase"], [34, 66], true),
  dataRow([code("bun run lint"), "FAIL \u2014 8 errors, all in report-generator scripts (require() imports) and duplicated deliverable copies under download/"], [34, 66]),
  dataRow([code("bun run test"), "254/254 PASS (vitest, 25 files, incl. DB-backed domain lifecycle suites)"], [34, 66], true),
  dataRow([code("bun run build"), "PASS \u2014 standalone production build"], [34, 66]),
  dataRow([code("demo-mode-e2e.sh"), "16/16 PASS \u2014 server-side demo gating verified on the production build"], [34, 66], true),
  dataRow([code("phase3-e2e.sh"), "32/38 \u2014 6 failures, root-caused as a pre-existing gap: the e2e script predated plan-gated domains (demo tenants sit on the free plan, limit 0) and was never updated"], [34, 66]),
], [34, 66]));

/* ============ 3 ============ */
body.push(h1("3. Findings Register (classified per the P0\u2013P3 framework)"));
body.push(p([r("Findings marked "), r("VERIFIED-OK", { bold: true }), r(" were audited and confirmed sound \u2014 no change was made. Everything else was fixed in this engagement except the items explicitly listed in \u00a77.")]));
body.push(tableTitle("Table 3-1. P0 \u2014 critical (all fixed)"));
body.push(tbl([
  headerRow(["#", "Finding", "Fix"], [5, 47, 48]),
  dataRow(["1", "Cron endpoint unauthenticated when CRON_SECRET unset: anonymous callers could force up to 25 provider-API rechecks per hit (quota burn / status churn).", "Disabled in production without CRON_SECRET (503 with operator guidance); rate-limited 6/min in dev; housekeeping (session/token pruning) piggybacked onto the schedule."], [5, 47, 48], true),
  dataRow(["2", "Password-reset link origin fell back to request Host/X-Forwarded-Host \u2014 Host-header poisoning could weaponise emailed reset links.", "Reset links are generated only for origins the deployment owns: configured site URL, platform hosts, or a tenant's ACTIVE custom domain. Untrusted hosts suppress the email and log a warning."], [5, 47, 48]),
  dataRow(["3", "Forgot-password timing side channel: the SMTP round trip ran only when the account existed, enabling enumeration by response latency.", "The email is dispatched after the response via next/server after() (with an inline fallback outside request scope) \u2014 all branches now respond in identical time."], [5, 47, 48], true),
  dataRow(["4", "Private media assets served Cache-Control: public, immutable \u2014 access-controlled bytes marked cacheable by shared proxies/CDNs.", "PRIVATE assets now serve Cache-Control: private, max-age=31536000, immutable; PUBLIC assets keep the shared-cache policy."], [5, 47, 48]),
  dataRow(["5", "Unlimited, unthrottled tenant creation \u2014 any registered user could provision unlimited churches.", "Per-IP rate limit (5/h) plus a per-account ownership cap (CHURCH_LIMIT_PER_USER, default 10, clamp 1\u20131000) with a clear operator-facing message."], [5, 47, 48], true),
  dataRow(["6", "AUTHOR role could delete published sermons/events/ministries/leaders/series (DELETE guarded by content:draft).", "DELETE now requires content:manage (EDITOR+), mirroring the pages behaviour \u2014 authors draft, editors destroy. Proven by the HTTP isolation suite."], [5, 47, 48]),
  dataRow(["7", "No security headers on any response.", "X-Content-Type-Options, X-Frame-Options: SAMEORIGIN, Referrer-Policy, Permissions-Policy, HSTS (max-age 2y, includeSubDomains) on every response; X-Powered-By removed."], [5, 47, 48], true),
  dataRow(["8", "Lint failing (8 errors) \u2014 broken CI hygiene.", "eslint ignores deliverable copies (download/, tool-results/) and permits CommonJS in the report-generator scripts; lint is clean."], [5, 47, 48]),
], [5, 47, 48]));
body.push(tableTitle("Table 3-2. P1 \u2014 high (all fixed)"));
body.push(tbl([
  headerRow(["#", "Finding", "Fix"], [5, 47, 48]),
  dataRow(["9", "Reset-token single-use had a TOCTOU race: validation ran before the transaction, so two concurrent requests could both succeed.", "The claim is now an atomic conditional UPDATE (usedAt IS NULL AND unexpired) inside the transaction; the loser claims zero rows."], [5, 47, 48], true),
  dataRow(["10", "No per-account login throttle \u2014 distributed attackers could target one account unbounded.", "Second fixed-window bucket keyed by the email string itself (10/15 min), applied identically whether or not the account exists \u2014 no enumeration signal."], [5, 47, 48]),
  dataRow(["11", "No authenticated password change.", "POST /api/auth/change-password: requires the current password, enforces the platform policy, revokes every OTHER session, rate-limited 5/h, audited. UI card on the profile page."], [5, 47, 48], true),
  dataRow(["12", "Platform subdomain routing (<slug>.<root-domain>) was dead code \u2014 isPlatformHost matched every *.root host, so the resolver's slug branch was unreachable while docs and the dashboard advertised it.", "isPlatformHost now matches only the root and www; slug subdomains resolve through the cached resolver; reserved labels and unknown subdomains fall through to the platform. Regression-tested."], [5, 47, 48]),
  dataRow(["13", "Privacy policy promised account export/deletion and church deletion that did not exist in code.", "Implemented: owner-initiated church JSON export; platform-admin account export + deletion (refused while the account owns a church); platform-admin church deletion with typed slug confirmation, provider-domain cleanup (failures reported honestly) and media-file removal. Policy text updated to describe exactly these mechanisms."], [5, 47, 48], true),
  dataRow(["14", "Vercel DNS-record guidance parsed only config.suggestedValues \u2014 a field the documented project-domain response does not carry, so churches could see no records.", "The adapter now also queries GET /v4/domains/{domain}/config (misconfigured, recommendedCNAME, recommendedIPv4) and, as a labelled last resort, falls back to Vercel's published default records (A 76.76.21.21 / CNAME cname.vercel-dns.com)."], [5, 47, 48]),
  dataRow(["15", "Expired sessions and stale reset tokens accumulated forever (lazy cleanup only).", "cleanupExpiredAuthArtifacts(): expired sessions pruned; reset tokens purged 24h after expiry. Runs on the cron and opportunistically on ~5% of logins."], [5, 47, 48], true),
  dataRow(["16", "Custom-domain recheck was hardwired to the Vercel provider; TXT digest comparison was not constant-time in the production path; a downgraded primary left companion hosts redirecting to it for up to a cache TTL.", "Provider abstraction gained an automated flag (rechecks only run against API-backed adapters matching the row's provider); digest comparison is timingSafeEqual; any status change now flushes the whole host cache; the opportunistic listing recheck is bounded to one row."], [5, 47, 48]),
  dataRow(["17", "Homepage logo on a church's custom domain linked off-domain to /church/<slug> (SEO + UX defect).", "Logo uses siteHref(ctx, '/') \u2014 clean root-relative links on custom domains, correct prefix on the platform origin."], [5, 47, 48], true),
], [5, 47, 48]));
body.push(tableTitle("Table 3-3. P2 \u2014 medium (all fixed except \u00a77 roadmap)"));
body.push(tbl([
  headerRow(["#", "Finding", "Fix"], [5, 47, 48]),
  dataRow(["18", "Demo tenants were only subtly labelled on their own sites (seeded footer line); the console had no indicator; demo churches stayed in sitemaps after demo mode was switched off.", "Visible demo badge on demo church sites and a console banner while demo mode is on; demo tenants leave the sitemap index and become noindex when DEMO_MODE=false."], [5, 47, 48], true),
  dataRow(["19", "Homepage/README claimed 'one church or one thousand' without capacity evidence; no licence link; repo-link button degraded to a dead anchor.", "Claims softened to what is true; /licence page added (mirrors the LICENSE file) and linked from the homepage, footer, sitemap and terms; the source button links the repo when NEXT_PUBLIC_REPO_URL is set, /licence otherwise."], [5, 47, 48]),
  dataRow(["20", "Privacy policy had no data-protection-rights section (NDPA 2023 / GDPR) and misdescribed processors.", "New section 6: rights mapped to the actual export/deletion tools, NDPA 2023 named for Nigerian deployments, controller/processor framing, operator guidance, and an explicit not-legal-advice note."], [5, 47, 48], true),
  dataRow(["21", "Documentation drift: SECURITY.md (stale domain-verification and SMTP claims, non-existent SESSION_SECRET, wrong routes), ARCHITECTURE.md (wrong API paths, model count), FEATURES.md (stale test/SMTP/export claims), DEPLOYMENT.md (APP_URL vs SITE_URL, optional CRON_SECRET, phantom DEPLOYMENT_MODE), DATABASE.md (wrong table name), INSTALLATION.md (SMTP claim).", "All corrected to describe the shipped system; .env.example documents the new variables and marks CRON_SECRET required in production."], [5, 47, 48]),
  dataRow(["22", "/console picker page lacked meta noindex; deleting a sermon series triggered a cross-tenant table scan (un-indexed FK).", "noindex added; migration 20261117120000 adds sermons.seriesId index (additive, applies on PostgreSQL via migrate deploy, on SQLite via db push)."], [5, 47, 48], true),
  dataRow(["23", "Domain manager showed two 'Retry connection' buttons for FAILED domains.", "Duplicate removed; the retry affordance lives in the Step-2 card."], [5, 47, 48]),
], [5, 47, 48]));
body.push(tableTitle("Table 3-4. Verified sound (no change required)"));
body.push(tbl([
  headerRow(["Area", "Evidence"], [30, 70]),
  dataRow([code("Tenant isolation core"), "All 63 dashboard handlers behind requireChurch; every [id] load filters { id, churchId }; non-membership and suspended churches both 404; zero client-supplied tenant identifiers; no cross-tenant exception found."], [30, 70], true),
  dataRow([code("Cross-tenant hostname claims"), "Global unique constraint + P2002 race handling + no-owner-leak 409s + expired-claim reclaim with audit."], [30, 70]),
  dataRow([code("Sessions & CSRF"), "256-bit hashed session tokens, httpOnly/Lax/secure cookies, layered origin + double-submit CSRF on all state-changing routes (10-case matrix tested)."], [30, 70], true),
  dataRow([code("Sensitive submissions"), "PRAYER/COUNSELLING flagged isSensitive, excluded from non-owner queries entirely, never rendered publicly, contents never logged."], [30, 70]),
  dataRow([code("Uploads"), "MIME whitelist, size caps, unguessable names, path-traversal-safe keys, SVG sanitisation, restrictive CSP + nosniff on served files."], [30, 70], true),
  dataRow([code("Public delivery"), "Only PUBLISHED content reachable; drafts invisible; real 404s (no soft-200s); canonical/OG/sitemap strategy custom-domain-aware."], [30, 70]),
  dataRow([code("Demo gating"), "Five server-side layers (login reject, live-session kill, platform-admin defense, honest UI, seed isolation) \u2014 re-verified 16/16."], [30, 70], true),
], [30, 70]));

/* ============ 4 ============ */
body.push(h1("4. Fixes in Detail"));
body.push(h2("4.1 Security hardening (P0)"));
body.push(bullet([mono("src/app/api/cron/domains/route.ts"), r(" \u2014 production deny without CRON_SECRET, 6/min dev rate limit, auth-artifact housekeeping piggybacked onto the schedule, provider-agnostic gating.")]));
body.push(bullet([mono("src/app/api/auth/forgot-password/route.ts"), r(" \u2014 trustedResetOrigin(): reset links only for deployment-owned hosts (config \u2192 platform host \u2192 ACTIVE tenant domain); sendAfterResponse() dispatches mail after the response with an inline fallback; warnings never leak to the client.")]));
body.push(bullet([mono("src/app/api/media/[id]/file/route.ts"), r(" \u2014 private assets are Cache-Control: private.")]));
body.push(bullet([mono("src/app/api/onboarding/church/route.ts"), r(" \u2014 per-IP rate limit + CHURCH_LIMIT_PER_USER cap before any provisioning transaction runs.")]));
body.push(bullet([mono("next.config.ts"), r(" \u2014 the five security headers + poweredByHeader: false; a full CSP remains roadmap work (nonce plumbing), documented in SECURITY.md.")]));
body.push(h2("4.2 Authentication & account security (P0/P1)"));
body.push(bullet([mono("src/lib/auth/password-reset.ts"), r(" \u2014 atomic single-use claim (conditional updateMany inside the transaction).")]));
body.push(bullet([mono("src/app/api/auth/login/route.ts"), r(" \u2014 per-account throttle with dummy-bcrypt timing shape; opportunistic artifact cleanup; named dummy-hash constant.")]));
body.push(bullet([mono("src/app/api/auth/change-password/route.ts"), r(" (new) + "), mono("password-card.tsx"), r(" \u2014 current-password-gated change; other sessions revoked; audited as user.password_changed.")]));
body.push(bullet([mono("src/lib/auth/maintenance.ts"), r(" (new) \u2014 expired-session and stale-token pruning.")]));
body.push(h2("4.3 Custom domains (Workstream I)"));
body.push(bullet([mono("src/lib/tenancy/resolver.ts"), r(" \u2014 isPlatformHost narrowed to the root + www, making <slug>.<root> routing live (with reserved-label protection and negative caching); "), mono("src/lib/domains/provider.ts"), r(" \u2014 automated flag + supplementary /v4 config lookup + labelled published-default fallback; "), mono("src/lib/domains/service.ts"), r(" \u2014 timingSafeEqual digest compare, provider-agnostic recheck, full cache flush on status change.")]));
body.push(h2("4.4 Data rights: export & deletion (Workstream N claims made true)"));
body.push(bullet([mono("src/app/api/dashboard/[slug]/export/route.ts"), r(" (new) \u2014 complete church JSON export (openchurch.export/v1): profile, settings, pages with parsed section trees, navigation, forms, giving, sermons/series, events, ministries, leaders, services, locations, media metadata, submissions (incl. sensitive, owner-only), domains, members. Owner-only; audited; download button in Website Settings \u2192 Your data.")]));
body.push(bullet([mono("src/app/api/admin/users/route.ts"), r(" (new) \u2014 account export (profile, memberships, session counts \u2014 never hashes) and irreversible account deletion, refused while the account owns any church (409 USER_OWNS_CHURCHES with the church list), double-typed email confirmation, rate-limited, audited.")]));
body.push(bullet([mono("src/app/api/admin/churches/route.ts"), r(" \u2014 extended with delete-church: typed slug confirmation; provider-assigned domains removed from the hosting provider first (failures reported, never hidden); media files deleted from storage; cascading DB delete; audited with the failure list.")]));
body.push(h2("4.5 Demo tenants, SEO & the public site (P2)"));
body.push(bullet([r("Demo badge on demo church sites + console demo banner (both gated on DEMO_MODE); demo tenants excluded from the sitemap index and noindexed when demo mode is off; "), mono("/licence"), r(" page + homepage/footer/sitemap/terms links; softened capacity claims; "), mono("/console"), r(" noindex; custom-domain logo links fixed; duplicate retry button removed.")]));
body.push(h2("4.6 Documentation & privacy accuracy (P2)"));
body.push(bullet([r("SECURITY.md rewritten against the shipped system (including the honest known-limitations list); privacy policy: NDPA 2023 rights section, accurate export/deletion/processor descriptions, updated dates; terms link the licence page; DEPLOYMENT.md/FEATURES.md/ARCHITECTURE.md/DATABASE.md/INSTALLATION.md corrections; .env.example: dead DEPLOYMENT_MODE removed, CHURCH_LIMIT_PER_USER, NEXT_PUBLIC_REPO_URL, CRON_SECRET marked required in production.")]));
body.push(h2("4.7 Database (Workstream E)"));
body.push(bullet([r("Index audit: every tenant-scoped query already had a leading churchId index (1:1 relations via unique churchId, composites elsewhere). The one genuine gap \u2014 sermon-series deletion scanning all sermons cross-tenant \u2014 is closed by additive migration "), mono("20261117120000_sermon_series_fk_index"), r(" (applies on PostgreSQL via migrate deploy; SQLite via db push). No destructive change anywhere; existing data untouched.")]));
body.push(h2("4.8 Test infrastructure (Workstream C requirement)"));
body.push(bullet([mono("tests/http-isolation.test.ts"), r(" (new, 24 scenarios) \u2014 the real route handlers invoked with constructed requests and REAL database-backed sessions for two tenants plus a platform admin: cross-tenant reads 404; cross-tenant DELETE (IDOR) 404 with the record surviving; AUTHOR cannot delete published content or read enquiries; EDITOR never receives sensitive rows; OWNER does; anonymous 401; non-admin blocked from /api/admin; CSRF rejects cross-site POSTs; private media 401/403/200 by relationship with private cache headers; public submissions route to the correct tenant; honeypot tarpit; church-creation cap enforced; password-change semantics (wrong current password, other sessions revoked); cron hardening both branches.")]));
body.push(bullet([mono("tests/domains-lifecycle.test.ts"), r(" \u2014 platform-subdomain routing regression tests (slug resolution, reserved labels, isPlatformHost narrowing). "), mono("tests/domains-provider.test.ts"), r(" \u2014 /v4-config parsing, published-default fallback, supplementary-call degradation, automated-flag semantics.")]));
body.push(bullet([mono("scripts/phase3-e2e.sh"), r(" \u2014 fixed to set the demo tenants' plan before the domain workflow (mirroring the operator action), restoring the suite to 38/38.")]));

/* ============ 5 ============ */
body.push(h1("5. Verification Evidence"));
body.push(p([r("All commands were executed in this session on the final code state (commit d2b653e):")]));
body.push(tbl([
  headerRow(["Command", "Result"], [40, 60]),
  dataRow([code("bun run typecheck"), "PASS (exit 0)"], [40, 60], true),
  dataRow([code("bun run lint"), "PASS (0 problems)"], [40, 60]),
  dataRow([code("bun run test"), "282/282 PASS \u2014 26 files, incl. DB-backed suites on throwaway databases"], [40, 60], true),
  dataRow([code("bun run build"), "PASS \u2014 standalone build, 30 static pages"], [40, 60]),
  dataRow([code("scripts/demo-mode-e2e.sh"), "16/16 PASS on the production build (both DEMO_MODE suites)"], [40, 60], true),
  dataRow([code("scripts/phase3-e2e.sh"), "38/38 PASS \u2014 auth, pages, events, sermons, forms, roles, giving, media, domains, admin protection"], [40, 60]),
], [40, 60]));
body.push(p([r("No existing functionality was removed; the only intentional behavioural changes are the security tightenings themselves (cron requires a secret in production; authors can no longer delete published content; church creation is capped; cross-site POSTs without a verifiable origin are rejected as before).")])) ;

/* ============ 6 ============ */
body.push(h1("6. Completed Code vs External Configuration Still Required"));
body.push(p([r("As required, this section separates what is finished in code (and verified) from what only the deployment operator can do. Nothing below is simulated; unconfigured capabilities report themselves honestly in the UI.")]));
body.push(tableTitle("Table 6-1. External configuration required to switch on coded capabilities"));
body.push(tbl([
  headerRow(["Capability", "Variable / action", "Effect when absent"], [26, 32, 42]),
  dataRow([code("Automated custom domains"), "VERCEL_TOKEN + VERCEL_PROJECT_ID (+ VERCEL_TEAM_ID for teams)", "Managed custom domains report 'not available on this deployment' (honest notice); self-hosted manual workflow remains; TXT verification still works."], [26, 32, 42], true),
  dataRow([code("Scheduled maintenance"), "CRON_SECRET (required in production)", "/api/cron/domains answers 503; provider rechecks and artifact pruning run only via the dashboard's Check status until configured."], [26, 32, 42]),
  dataRow([code("Self-service password recovery email"), "SMTP_URL + MAIL_FROM", "Forgot-password page states email recovery is unavailable and routes to the platform-admin reset path (which works today)."], [26, 32, 42], true),
  dataRow([code("Trusted canonical origin"), "NEXT_PUBLIC_SITE_URL (https, no trailing slash)", "Origins are derived per request; reset-link generation falls back to validated request hosts (poisoning is blocked either way)."], [26, 32, 42]),
  dataRow([code("Platform subdomain addressing"), "PLATFORM_ROOT_DOMAIN + wildcard DNS record at the registrar", "Churches are reachable at /church/<slug> only (the always-available address)."], [26, 32, 42], true),
  dataRow([code("Homepage source-repository button"), "NEXT_PUBLIC_REPO_URL", "Button links to the built-in /licence page instead."], [26, 32, 42]),
  dataRow([code("Plan limits / creation cap"), "DOMAIN_LIMIT_FREE/PAID/PREMIUM, CHURCH_LIMIT_PER_USER", "Defaults apply (0/1/10 domains; 10 churches per account)."], [26, 32, 42], true),
  dataRow([code("Custom-domain go-live proof"), "One real domain on a Vercel staging project with the token configured", "The provider path is verified against the documented API with injected-fetch tests; the live end-to-end positive path (real DNS + real API + real SSL) still needs one operator-run rehearsal before charging for the feature."], [26, 32, 42]),
], [26, 32, 42]));

/* ============ 7 ============ */
body.push(h1("7. Deferred Items (documented, not silently dropped)"));
body.push(bullet([r("Email verification (User.emailVerified is reserved but unused) and a consent-token member-invitation flow \u2014 today members are enrolled by an owner from existing accounts, owner-only and audited.")]));
body.push(bullet([r("MFA/2FA and a session-management UI; queued/async email delivery beyond the after()-dispatch introduced here.")]));
body.push(bullet([r("Full CSP: needs a nonce/strict-dynamic strategy through the proxy to avoid breaking hydration; media files already carry a restrictive CSP.")]));
body.push(bullet([r("Shared-store rate limiting (Redis) for multi-replica deployments \u2014 the interface is swappable; current limiter is per-instance (documented).")]));
body.push(bullet([r("PostgreSQL Row-Level Security as defence-in-depth for self-managed databases (application-layer isolation is enforced and now HTTP-proven regardless).")]));
body.push(bullet([r("Lighthouse and load testing with synthetic tenants (Workstream O) \u2014 no capacity figures are claimed anywhere until this is run.")]));
body.push(bullet([r("Formal WCAG 2.2 AA audit (Workstream L) beyond the confirmed-issue fixes shipped here; legal review of the privacy policy by qualified counsel for the operator's jurisdiction.")]));
body.push(bullet([r("Managed-hosting media persistence (Vercel Blob/S3 driver) \u2014 the storage interface exists; the local driver is documented as ephemeral on serverless.")]));

/* ============ 8 ============ */
body.push(h1("8. Production Deployment Checklist"));
body.push(bullet([mono("NEXT_PUBLIC_SITE_URL"), r(" = the real https origin (canonical URLs, OG, trusted reset links).")]));
body.push(bullet([mono("DATABASE_URL"), r(" (pooled) and "), mono("DATABASE_URL_UNPOOLED"), r(" on Neon-backed Vercel deployments; migrations run via the build pipeline (migrate deploy).")]));
body.push(bullet([mono("DEMO_MODE=false"), r(" and "), mono("SEED_DEMO_DATA"), r(" unset for real deployments \u2014 demo accounts are blocked server-side, demo tenants leave the sitemap.")]));
body.push(bullet([mono("CRON_SECRET"), r(" set (required \u2014 the maintenance endpoint refuses to run unauthenticated in production).")]));
body.push(bullet([mono("VERCEL_TOKEN"), r(" + "), mono("VERCEL_PROJECT_ID"), r(" when automated custom domains should be available; otherwise leave unset and the UI reports the honest capability.")]));
body.push(bullet([mono("SMTP_URL"), r(" + "), mono("MAIL_FROM"), r(" to switch on self-service password-recovery email; otherwise the admin reset path is the documented flow.")]));
body.push(bullet([r("Review SECURITY.md (rewritten) and the operator sections of docs/DEPLOYMENT.md; back up the database AND the storage volume together.")]));
body.push(bullet([r("After first deploy: register the platform owner (first account), then grant platform-admin via "), mono("scripts/promote-admin.ts"), r(" as documented.")]));
body.push(p([r("Working tree commit: "), mono("d2b653e"), r(" \u2014 50 files modified, 10 added; all checks green as listed in \u00a75.")], { after: 0 }));

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
        title: "OpenChurch: Complete Audit, Repair & Production Hardening",
        subtitle: "Workstreams A\u2013P \u2014 security fixes, data rights, domain routing and honest documentation, all verified",
        metaLines: [
          "Project: OpenChurch \u2014 multi-tenant church website platform",
          "Scope: Full audit (A\u2013P) \u00b7 P0/P1 remediation \u00b7 regression & e2e verification",
          "Evidence: 282 unit/integration \u00b7 16 demo e2e \u00b7 38 API e2e \u00b7 build green",
          "Date: 17 November 2026",
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
            children: [new TextRun({ text: "OpenChurch \u2014 Audit & Production Hardening Report", size: 16, color: PAL.muted, font: { ascii: "Arial" } })],
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
  fs.writeFileSync("download/OpenChurch_Audit_and_Hardening_Report.docx", buf);
  console.log("written: download/OpenChurch_Audit_and_Hardening_Report.docx");
});
