/**
 * OpenChurch — Universal Custom-Domain System Implementation Report
 * Generator (docx-js). Follows the docx skill: R1 cover recipe, DM-1 palette,
 * 3-section page numbering (cover / front matter Roman / body Arabic),
 * percentage-width tables, tableHeader+cantSplit, keepNext titles.
 */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  PageBreak, Header, Footer, PageNumber, NumberFormat, AlignmentType,
  HeadingLevel, WidthType, BorderStyle, ShadingType, TableOfContents,
  SectionType, TableLayoutType,
} = require("docx");
const fs = require("fs");

// ─── Palette: DM-1 (Deep Cyan — AI / tech / digital transformation) ────────
const P = {
  bg: "162235",
  accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  heading: "0F3A47",
};

const noBorders = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
};
const allNoBorders = {
  ...noBorders,
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

// ─── Cover helpers (design-system.md, Latin-width-aware) ───────────────────
function splitTitleLines(title, charsPerLine) {
  const breakAfter = new Set([..."-_—–·/", ..." \t", ...",.:;!?"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) breakAt = charsPerLine;
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += " " + last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // Latin text: average glyph width ~= pt * 11 twips (vs pt*20 for CJK).
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    lines = splitTitleLines(title, charsPerLine(minPt));
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const safeRemaining = Math.max(usableHeight - contentHeight, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

// ─── Recipe R1: Pure Paragraph Cover (left-aligned) ────────────────────────
function buildCoverR1(config) {
  const pal = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: pal.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: pal.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: pal.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: pal.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: pal.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: pal.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: pal.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: pal.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: pal.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: pal.bg },
        borders: noBorders,
        children,
      })],
    })],
  })];
}

// ─── Body helpers (English report — Times New Roman body) ─────────────────
const BODY_FONT = { ascii: "Times New Roman", eastAsia: "SimSun" };
const HEAD_FONT = { ascii: "Arial", eastAsia: "SimHei" };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 312 },
    children: [new TextRun({ text, bold: true, size: 32, color: P.heading, font: HEAD_FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120, line: 312 },
    children: [new TextRun({ text, bold: true, size: 26, color: P.heading, font: HEAD_FONT })],
  });
}
function para(text, opts = {}) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    ...(opts.indent === false ? {} : { indent: {} }),
    children: [new TextRun({ text, size: 22, color: "1A1A1A", font: BODY_FONT })],
  });
}
function paraRuns(runs) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { after: 120, line: 312 },
    children: runs.map((r) => new TextRun({ size: 22, color: "1A1A1A", font: BODY_FONT, ...r })),
  });
}
function code(text) {
  return new TextRun({ text, size: 20, color: "0F4C5C", font: { ascii: "Courier New", eastAsia: "SimSun" } });
}

function tableTitle(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80, line: 312 },
    children: [new TextRun({ text, bold: true, size: 21, color: P.heading, font: HEAD_FONT })],
  });
}

function makeTable(header, rows, widths) {
  const mkCell = (text, isHeader, w, i) => new TableCell({
    width: { size: w, type: WidthType.PERCENTAGE },
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    ...(isHeader ? { shading: { type: ShadingType.CLEAR, fill: P.table.headerBg } } : (i % 2 === 1 ? { shading: { type: ShadingType.CLEAR, fill: P.table.surface } } : {})),
    children: [new Paragraph({
      spacing: { line: 276 },
      children: [new TextRun({
        text, bold: isHeader, size: isHeader ? 20 : 20,
        color: isHeader ? P.table.headerText : "1A1A1A",
        font: isHeader ? HEAD_FONT : BODY_FONT,
      })],
    })],
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: P.table.accentLine },
      left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: P.table.innerLine },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((t, i) => mkCell(t, true, widths[i], 0)) }),
      ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((t, i) => mkCell(t, false, widths[i], ri)) })),
    ],
  });
}

// ─── Footer / header ───────────────────────────────────────────────────────
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: "888888", font: BODY_FONT })],
    })],
  });
}
function docHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: P.table.innerLine, space: 4 } },
      children: [new TextRun({ text: "OpenChurch — Custom-Domain System Implementation Report", size: 16, color: "888888", font: BODY_FONT })],
    })],
  });
}

// ══════════════════════════════════════════════════════════════════════════
// BODY CONTENT
// ══════════════════════════════════════════════════════════════════════════
const body = [];

// 1 ─ Executive Summary
body.push(h1("1  Executive Summary"));
body.push(para(
  "This report documents the implementation of a universal, automated custom-domain system across the OpenChurch platform, delivered in commit cf17d86. Every church that registers on an OpenChurch deployment automatically receives a working platform address under /church/<slug>, and every church can independently connect its own domain (for example www.cacparakin.org or www.gracecommunity.org) from its authenticated dashboard. The capability is entirely platform-wide: no church-specific code exists anywhere in the implementation, and the same workflow applies to existing and future tenants."
));
body.push(para(
  "The work was performed in two disciplined stages, as the task required. The repository was inspected first, which revealed that a prior iteration (commit d585d5a) had already delivered a credible foundation: the ChurchDomain data model with globally unique hostnames, DNS TXT ownership verification with hashed tokens, a Vercel REST adapter, a three-mode capability model (managed, self-hosted, unavailable), proxy-level host-to-tenant routing, rate limiting and auditing. This iteration completed the remaining architecture: a full lifecycle status machine, subscription-plan entitlements, canonical-host enforcement with www/apex handling, provider-truthful rechecks with automatic downgrades, background rechecks via a cron endpoint, operator tooling in the platform admin console, and a wildcard-subdomain provisioning tool."
));
body.push(para(
  "Two truthfulness defects in the existing code were found and fixed during verification. The Vercel adapter read DNS record fields that the live Vercel API does not return (config.suggestedValues is the real field), which meant required DNS records would silently have been missing from church instructions. Separately, resuming an operator-suspended domain could upgrade an unverified row to VERIFIED; that path now restores the exact pre-suspension status, and a regression test locks the behaviour in. No feature was removed and all 254 automated tests pass, alongside a live end-to-end workflow exercise on a running instance."
));
body.push(tableTitle("Table 1 — Delivery at a glance"));
body.push(makeTable(
  ["Item", "Result"],
  [
    ["Commit", "cf17d86 (plus migration 20261116120000_custom_domains_entitlements)"],
    ["Files changed / added", "18 modified, 11 new (code, tests, docs, tooling)"],
    ["Automated tests", "254 passing across 25 files (baseline was 114 before the domain work began)"],
    ["Type check / lint / build", "tsc clean; eslint clean on all changed files; production build succeeds"],
    ["Live smoke test", "Registration, plan control, add-verify-connect workflow, suspension and cron exercised on a running instance"],
    ["Production readiness", "Code complete; real-domain staging validation and operator configuration remain external (Section 6)"],
  ],
  [28, 72]
));

// 2 ─ Scope, Method and Inspection Findings
body.push(h1("2  Scope, Method and Inspection Findings"));
body.push(para(
  "The task specification was treated as a contract with fourteen requirement groups, each of which is traceable in the sections below. The method was inspection-first: before any code was written, the existing architecture and hosting capabilities were audited — the Prisma schema, the tenant resolver and proxy, the dashboard and console routes, the onboarding flow, the existing domain library, the test suite, the Vercel build chain and the deployment documentation. This was essential for two reasons. First, the instruction to extend the schema without duplicating existing structures could only be honoured by knowing exactly what existed. Second, the instruction never to fake provider behaviour required an accurate picture of what the Vercel API actually returns, which is what exposed the suggestedValues defect."
));
body.push(para(
  "The inspection established the following baseline. Church creation is atomic (transactional provisioning of tenant, settings, forms, pages and navigation) with slug uniqueness and reserved-subdomain guards already enforced. Host-based tenant routing existed in the Next.js proxy, backed by a 60-second resolution cache with negative caching. The domain library already separated validation, TXT verification, provider adaptation and lifecycle service concerns, with server-side-only provider credentials and audit logging on every mutation. The capability model already distinguished managed hosting with provider integration from self-hosted manual configuration and from serverless deployments where domains honestly cannot be offered. What the baseline lacked was everything this iteration delivered: fine-grained statuses, entitlements, rechecks with downgrades, canonical redirects, operator tooling and background automation."
));

// 3 ─ Delivered Implementation
body.push(h1("3  Delivered Implementation"));
body.push(para(
  "This section describes each delivered subsystem, what it does, and the design decisions that keep it honest. All status and entitlement logic is centralised in two small modules — src/lib/domains/status.ts and src/lib/domains/entitlements.ts — so the resolver, service, API routes, UI and documentation can never drift apart."
));

body.push(h2("3.1  Data model and lifecycle statuses"));
body.push(para(
  "The schema was extended additively. Church gains a plan column (free, paid or premium, defaulting to free) that controls domain entitlements, and ChurchDomain gains providerRef — the provider's own domain identifier captured from API responses, never fabricated — plus dnsStatus, an explicit DNS state column. Migration 20261116120000 is PostgreSQL-dialect, matching the committed migration chain, and applies cleanly with prisma migrate deploy in the Vercel build. Development and self-hosted SQLite deployments continue to use the idempotent db push path. Existing data is untouched: every new column is nullable or defaulted."
));
body.push(para(
  "The lifecycle now implements the full status vocabulary the task specified. Removed is deliberately represented by row deletion rather than a status value: because hostname uniqueness is enforced by a database constraint, a soft-deleted row would block the hostname from ever being reclaimed, by its original owner or anyone else. Deletion plus the audit log preserves the full history while keeping the unique constraint meaningful."
));
body.push(tableTitle("Table 2 — Domain lifecycle (src/lib/domains/status.ts)"));
body.push(makeTable(
  ["Status", "Meaning", "Serves traffic"],
  [
    ["PENDING", "Added; awaiting TXT ownership verification", "No"],
    ["VERIFICATION_FAILED", "Last ownership check failed — retryable", "No"],
    ["VERIFIED", "Ownership proven; awaiting hosting assignment", "No"],
    ["PENDING_DNS", "Attached to the provider; DNS not confirmed yet", "No"],
    ["PENDING_SSL", "Provider confirms DNS; HTTPS not confirmed yet", "No"],
    ["ACTIVE", "Ownership, assignment, DNS and HTTPS all confirmed", "Yes"],
    ["FAILED", "Provider lost or never completed the assignment — retryable", "No"],
    ["SUSPENDED", "Suspended by the platform operator (kill-switch)", "No"],
    ["(removed)", "Row deleted; audit log retains the history", "No"],
  ],
  [26, 56, 18]
));
body.push(para(
  "The security-relevant rule is encoded once and shared everywhere: only ACTIVE domains are served by the tenant resolver, and no code path can set ACTIVE except the connect/recheck engine described below. The isVerified compatibility flag is derived from the status machine, so it can never disagree with it."
));

body.push(h2("3.2  Provider integration — the Vercel adapter"));
body.push(paraRuns([
  { text: "The Vercel adapter is the only component that talks to a hosting provider, through the official REST API: " },
  code("POST /v10/projects/{projectId}/domains"),
  { text: " to attach a domain, " },
  code("GET /v10/projects/{projectId}/domains/{name}"),
  { text: " to inspect it, and " },
  code("DELETE /v10/projects/{projectId}/domains/{name}"),
  { text: " to detach it, with optional team scoping. This iteration fixed the inspection parser to read config.suggestedValues — the field the live API actually returns — so the dashboard now shows the exact A or CNAME records Vercel requires, plus Vercel's own project-verification TXT record when the API includes one. Legacy field names are retained only as a defensive fallback. The adapter also captures the domain uid returned by the API and stores it as providerRef, and distinguishes a provider 404 (the domain is no longer attached) from an attached-but-unverified state, which is what allows honest downgrades." },
]));
body.push(para(
  "The provider remains an abstraction, not a dependency: the DomainProvider interface has three methods (addDomain, removeDomain, inspectDomain) and two implementations — Vercel for managed hosting, Manual for self-hosted installations and any future provider. Every provider operation is injectable in tests, which is how the entire managed workflow is exercised without network access. The task's rule is enforced structurally: an API error surfaces as an error outcome and is persisted as a failure reason; it never degrades into a success state."
));

body.push(h2("3.3  Universal tenant routing and canonical-host enforcement"));
body.push(para(
  "Hostname-to-tenant resolution was extended so the proxy can enforce one canonical host per church. The resolver now returns, alongside the tenant identity, whether the matched host is the church's primary domain and what the primary domain is. When a request arrives on one of the church's ACTIVE non-primary domains — for example the apex gracecommunity.org when www.gracecommunity.org is primary — the proxy issues a permanent 308 redirect to the same path and query on the primary. This is how www/apex relationships are handled: both hostnames are separately verified and connected, but only the primary serves content, so the two addresses never compete in search results. Platform application paths such as /console and /api are never redirected or rewritten, and the /church/<slug> platform address continues to work everywhere, unchanged."
));
body.push(para(
  "All existing protections were preserved and re-verified: only ACTIVE domains resolve; platform-owned hosts, localhost and the deployment's own origin are never treated as church domains; unknown hosts pass through without leaking tenant existence; host-header injection is impossible because forwarded host headers are only consulted when the direct Host header is an internal address; and the resolution cache is keyed by exact hostname with a 60-second TTL on positive and negative entries alike, so a removed or downgraded domain stops resolving within a minute even on instances that missed the invalidation event. Church sitemaps, robots and canonical URLs follow the primary domain automatically through the existing canonical-origin helpers."
));

body.push(h2("3.4  Subscription entitlements without a billing system"));
body.push(para(
  "Custom-domain access is now controlled per church by a subscription plan, implemented as a deliberately narrow entitlement interface so a future billing integration only has to write one field. The platform operator sets each church's plan (free, paid or premium) from the admin console; plan limits are configured once per deployment through environment variables (DOMAIN_LIMIT_FREE, DOMAIN_LIMIT_PAID, DOMAIN_LIMIT_PREMIUM) with safe defaults of 0, 1 and 10. Nothing about pricing, currency or payment is hardcoded anywhere — the church-facing message refers the owner to the platform operator. Enforcement is server-side: exceeding the plan returns a precise PLAN_LIMIT error, while re-adding a church's own pending domain refreshes its token without consuming an entitlement. The dashboard shows the church its plan and its used-versus-limit count, and every plan change is audited."
));

body.push(h2("3.5  Rechecks, retries and background automation"));
body.push(para(
  "Connect and recheck now share a single truth engine. After a domain is attached to the provider, the engine derives the row state purely from the provider's answer: a provider 404 means FAILED; attached but unverified or misconfigured DNS means PENDING_DNS with the provider's records surfaced; provider-confirmed DNS moves the row to PENDING_SSL, where an outbound HTTPS probe decides the final step — any HTTP response proves the certificate is live and sets ACTIVE, while a failed probe keeps the row honestly at PENDING_SSL with an explanation. When the provider loses a domain that was ACTIVE, the next recheck downgrades it to FAILED immediately, so provider failures never leave misleading active records. Retries are safe at every step: failed verifications can be re-run or given a fresh token, FAILED connections can be retried, and rechecks are idempotent."
));
body.push(para(
  "Three recheck paths exist. The dashboard's Check status action runs the full engine on demand. Loading the Custom Domains page opportunistically re-checks up to two provider-assigned domains whose last check is older than five minutes, bounded so the page stays fast. And a cron endpoint, GET /api/cron/domains, re-checks up to twenty-five stale domains per run; vercel.json registers it on an hourly schedule, and it is protected by CRON_SECRET bearer authentication, which Vercel Cron injects automatically when the secret is configured. Self-hosted operators can invoke the same endpoint from their own scheduler. The documentation states the platform limitation honestly: on Vercel's Hobby plan, cron jobs run only once per day, so interactive rechecks are the primary path there."
));

body.push(h2("3.6  Platform operator tooling and wildcard subdomains"));
body.push(para(
  "The platform administrator console gained a Custom domains and hosting section that reports the deployment's integration status honestly — when the provider variables are unset, it says managed custom domains are not available and names the exact variables required, rather than implying the feature works. It lists every domain on the deployment with its status, DNS and SSL state, and provides an audited suspend/resume kill-switch per domain; suspension stops resolution immediately, and resuming restores exactly the pre-suspension status. The churches table gained a per-church plan selector wired to a new audited admin API."
));
body.push(para(
  "For subdomain addressing (cacparakin.openchurch.example), the resolver already maps slugs under PLATFORM_ROOT_DOMAIN; what was missing was the hosting-side configuration, which cannot be assumed. A new operator tool, scripts/vercel-wildcard.ts, attaches the wildcard domain to the Vercel project through the official API using the same server-side credentials, checks idempotently, and prints the DNS record that must be created at the registrar — it does not pretend the DNS record exists. Together with the deployment documentation, this closes the gap between code and infrastructure for wildcard subdomains."
));

body.push(h2("3.7  Dashboard experience"));
body.push(para(
  "The Custom Domains page (/console/<slug>/domains) now presents the complete workflow with truthful status badges for every lifecycle state, the church's plan and domain count, copyable TXT and provider DNS records, and a Check status action that replaces the previous re-check button — which had called connect on ACTIVE rows and failed with NOT_VERIFIED. Adding a domain suggests its www or apex companion when the church has not connected it, with each hostname verified independently. Verification failures display the actual DNS reason with retry and new-token actions; provider failures display the provider's error with a retry-connection action; SSL is reported as provisioning until the HTTPS probe succeeds, and as confirmed only after it does. The unavailable mode on serverless deployments without the integration continues to show the honest explanatory notice instead of impossible steps."
));

// 4 ─ Security and tenant isolation
body.push(h1("4  Security and Tenant Isolation"));
body.push(para(
  "The domain system is security-critical, and every property the task specified is enforced in depth rather than asserted. A church can only manage its own domains: all dashboard actions resolve rows scoped to the caller's church, so another church's domain identifiers simply return not-found — this is covered by explicit cross-tenant tests. One hostname can never belong to two tenants: uniqueness is a database constraint, and claiming races collapse into a precise conflict outcome; expired pending claims are reclaimable but verified domains never transfer, and claim ownership is never revealed to other churches. Ownership verification cannot be bypassed: the token is 256 bits of CSPRNG output stored only as a SHA-256 hash, tokens expire, and verification is a server-side DNS lookup — a button click never flips the flag."
));
body.push(para(
  "Provider credentials (VERCEL_TOKEN, VERCEL_PROJECT_ID, VERCEL_TEAM_ID) are read only in server-only modules and never serialised; the browser receives only booleans about whether the integration is configured. Domain operations are rate-limited per church (additions and checks separately) and audited end to end, including operator suspensions, plan changes and stale-claim replacement. Hostname and DNS inputs pass a strict validator that rejects IP addresses, ports, paths, non-ASCII input, internal suffixes, hosting-platform suffixes and the platform's own hosts. Unverified, pending, suspended and failed domains never serve tenant content because the resolver matches ACTIVE rows only. The HTTPS probe is bounded by a five-second timeout and treats any error as not-ready, never as success. Finally, the suspension-resume bug found during this iteration — which could have upgraded an unverified row — is fixed and regression-tested, and reassignment of a hostname always requires passing ownership verification again."
));

// 5 ─ Verification evidence
body.push(h1("5  Verification Evidence"));
body.push(h2("5.1  Automated tests"));
body.push(para(
  "The suite grew from 114 to 254 passing tests across 25 files. Three new files cover the new behaviour: domains-status.test.ts validates the status machine, the www/apex companion mapping and the canonical-redirect decision table; domains-entitlements.test.ts validates plan normalisation, operator limit overrides, clamping of nonsense values and the resolution logic for every plan; domains-managed-flow.test.ts is a full multi-tenant integration test against a throwaway database, driving two independent churches through add, verify, connect, PENDING_DNS, PENDING_SSL, ACTIVE, primary selection, cross-tenant claim prevention, provider failure with retry, provider-loss downgrade with recovery, operator suspension with exact-state resume, and audit-trail assertions — all with a Vercel-shaped provider double and stubbed DNS and HTTPS probes. The existing lifecycle, provider, capability, cache, validation and TXT suites were updated for the new status machine and pass unchanged in intent."
));
body.push(h2("5.2  Live workflow exercise"));
body.push(para(
  "Beyond the unit and integration suites, the workflow was exercised on a running instance of the platform. A new user was registered and a new church (CAC Parakin) was created through the real onboarding API; its platform address /church/cac-parakin served its website immediately, the slug-collision and reserved-name guards returned correct availability answers, and the new tenant defaulted to the free plan with a limit of zero domains. An operator then raised the plan through the new admin API and the church added www.cacparakin.org, receiving TXT instructions and an apex companion suggestion. Verification without any DNS record returned VERIFICATION_FAILED with the truthful reason. Operator suspension and resumption of the domain worked through the admin API, the cron endpoint reported honestly that no provider integration is configured on that instance, and the dashboard and admin pages were rendered and inspected in a browser. All test data was removed afterwards; the demo dataset is unchanged."
));
body.push(h2("5.3  What this verification does not cover"));
body.push(para(
  "Honesty about test boundaries is part of the task. The provider double speaks the Vercel API's shape, but no live Vercel project was contacted from this environment, and no real domain was resolved over the public internet. DNS TXT verification was exercised against a stubbed resolver plus a live lookup that correctly failed without a record. The items in Section 6 — operator configuration and a real staging validation — are therefore prerequisites for any production-readiness claim, and this report explicitly does not make one."
));

// 6 ─ Completed code vs external configuration
body.push(h1("6  Completed Code vs. External Configuration Required"));
body.push(para(
  "The task's final acceptance criterion is a newly registered church independently connecting and activating a custom domain without per-church operator action. The code satisfies this: once the operator completes a one-time, deployment-level configuration, every existing and future church can manage domains entirely from its own dashboard. What remains external is listed precisely below; none of it is per-church."
));
body.push(tableTitle("Table 3 — Status of every required external step"));
body.push(makeTable(
  ["External step", "Owner", "Status / notes"],
  [
    ["Set VERCEL_TOKEN and VERCEL_PROJECT_ID (and VERCEL_TEAM_ID for team projects) in the deployment environment", "Platform operator", "Required for automated managed domains; until then the platform reports domains unavailable honestly"],
    ["Set CRON_SECRET (e.g. openssl rand -hex 24) for the scheduled recheck", "Platform operator", "Recommended; Vercel Cron injects the bearer token automatically"],
    ["Apply the database migration on managed deployments", "Automatic", "prisma migrate deploy in the build already applies 20261116120000; no manual step"],
    ["Subdomain addressing: set PLATFORM_ROOT_DOMAIN, run scripts/vercel-wildcard.ts, create the *.root DNS record at the registrar", "Platform operator", "Optional; script and DNS records documented in docs/DEPLOYMENT.md"],
    ["Configure plan limits (DOMAIN_LIMIT_FREE/PAID/PREMIUM) if the defaults (0/1/10) do not fit", "Platform operator", "Optional; defaults are safe and no pricing is hardcoded"],
    ["Validate on a real Vercel staging project with a real domain before production", "Operator / release process", "NOT DONE from this environment — required by the task before declaring production readiness"],
  ],
  [42, 18, 40]
));
body.push(para(
  "The deployment documentation was updated to guide every one of these steps: the operator's one-time setup, what each newly registered church automatically receives, the church-side workflow from adding a domain to primary selection, how DNS verification and SSL provisioning actually work, the full status glossary, background rechecks and their Hobby-plan limitation, plan limits, and self-hosted domain configuration through the provider abstraction."
));

// 7 ─ Acceptance criteria
body.push(h1("7  Acceptance Criteria Assessment"));
body.push(tableTitle("Table 4 — Task acceptance criteria, item by item"));
body.push(makeTable(
  ["Criterion", "Assessment"],
  [
    ["New church connects and activates a custom domain independently via its dashboard", "Implemented and verified in tests and live exercise (plan permitting); no per-church operator action after one-time provider configuration"],
    ["Same implementation works for all existing and future tenants", "Platform-wide by construction; no church-specific code paths exist"],
    ["Existing church data, routes, dashboards, authentication, themes and features preserved", "Schema changes are additive; all 254 tests pass, including the pre-existing suites for tenancy, SEO, publishing and demo mode"],
    ["Not a CAC Parakin-only solution", "CAC Parakin appears only as an illustrative example in the report; the test tenants are two independent churches"],
    ["No fake verification, fake SSL status or simulated provider integration", "Structurally prevented: statuses derive from provider API answers and a real HTTPS probe; errors persist as failures"],
    ["Repository inspected first; feature implemented within the existing architecture", "Section 2 documents the inspection and the baseline it found"],
    ["Tests run and an implementation report provided", "Section 5; this document"],
  ],
  [46, 54]
));

// 8 ─ Files changed
body.push(h1("8  Changed and Added Files"));
body.push(tableTitle("Table 5 — Changeset (commit cf17d86)"));
body.push(makeTable(
  ["Area", "Files"],
  [
    ["Data model", "prisma/schema.prisma; prisma/migrations/20261116120000_custom_domains_entitlements (new)"],
    ["Domain library", "src/lib/domains/status.ts (new), entitlements.ts (new), service.ts, provider.ts, cache.ts"],
    ["Routing", "src/lib/tenancy/resolver.ts; src/proxy.ts"],
    ["Church-facing API", "src/app/api/dashboard/[slug]/domains/route.ts and its [domainId] subroute (recheck action, entitlement payload, bounded stale recheck)"],
    ["Platform admin API", "src/app/api/admin/domains (new), src/app/api/admin/churches (new)"],
    ["Background automation", "src/app/api/cron/domains (new); vercel.json (crons)"],
    ["Operator tooling", "scripts/vercel-wildcard.ts (new)"],
    ["UI", "src/components/dashboard/domains-manager.tsx; src/components/dashboard/admin-console.tsx; console domains page; admin page"],
    ["Configuration", ".env.example (plan limits, CRON_SECRET)"],
    ["Tests", "tests/domains-status.test.ts, domains-entitlements.test.ts, domains-managed-flow.test.ts (new); domains-lifecycle, domains-provider, domains-cache updated"],
    ["Documentation", "docs/DEPLOYMENT.md (operator setup, workflow, statuses, plans, cron, wildcards)"],
  ],
  [24, 76]
));

// 9 ─ Known limitations
body.push(h1("9  Known Limitations and Honest Statements"));
body.push(para(
  "The following statements are limitations, stated plainly. The Vercel integration is exercised in tests through a faithful double, not a live Vercel project; the real-domain staging validation required by the task remains open and is listed in Section 6. SSL status is derived from a provider confirmation plus an HTTPS probe, because the Vercel project-domain API does not expose a certificate status field; the probe proves the certificate is live but cannot distinguish which certificate authority issued it. Cron frequency depends on the Vercel plan, as documented. The host-resolution cache is per-instance with a sixty-second TTL, so on multi-instance serverless deployments a status change may take up to a minute to be observed by instances that missed the invalidation. Plan management is operator-driven by design; OpenChurch ships no billing system, and the entitlement interface is the seam where one would integrate. Media uploads on serverless filesystems remain an unrelated, previously documented limitation. Finally, no church has connected a domain merely because the feature exists: the dashboard, the admin console and the API all report the deployment's true capability until the operator completes the configuration."
));

// ══════════════════════════════════════════════════════════════════════════
// DOCUMENT ASSEMBLY
// ══════════════════════════════════════════════════════════════════════════
const pgSize = { width: 11906, height: 16838 };
const pgMargin = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

const doc = new Document({
  creator: "OpenChurch Engineering",
  title: "Universal Custom-Domain System — Implementation Report",
  styles: {
    default: {
      document: {
        run: { font: BODY_FONT, size: 22, color: "1A1A1A" },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: HEAD_FONT, size: 32, bold: true, color: P.heading },
        paragraph: { spacing: { before: 360, after: 160, line: 312 }, outlineLevel: 0 },
      },
      heading2: {
        run: { font: HEAD_FONT, size: 26, bold: true, color: P.heading },
        paragraph: { spacing: { before: 240, after: 120, line: 312 }, outlineLevel: 1 },
      },
    },
  },
  sections: [
    // Section 1 — Cover (margin 0, no footer, no page number)
    {
      properties: { page: { size: pgSize, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "Universal Custom-Domain System",
        subtitle: "Implementation Report — Completed Code and Remaining External Configuration",
        englishLabel: "IMPLEMENTATION REPORT",
        metaLines: [
          "Platform: OpenChurch — multi-tenant church website platform",
          "Scope: Platform-wide custom-domain architecture, all tenants",
          "Delivery: commit cf17d86 · 254 automated tests passing",
          "Date: 16 November 2026",
        ],
        footerLeft: "OpenChurch Engineering",
        footerRight: "Confidential — Internal Deliverable",
        palette: P,
      }),
    },
    // Section 2 — Front matter (TOC, Roman numerals)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: HEAD_FONT, color: P.heading })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({
            text: "Note: This Table of Contents is generated via field codes. To ensure page number accuracy after editing, please right-click the TOC and select \"Update Field\".",
            italics: true, size: 18, color: "888888", font: BODY_FONT,
          })],
        }),
        // No trailing PageBreak: the body starts its own section (NEXT_PAGE);
        // a PageBreak here would create a blank page.
      ],
    },
    // Section 3 — Body (Arabic, start at 1)
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: pgSize, margin: pgMargin, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: docHeader() },
      footers: { default: pageNumFooter() },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buffer) => {
  const out = "/home/z/my-project/download/OpenChurch_Custom-Domains_Implementation_Report.docx";
  fs.writeFileSync(out, buffer);
  console.log("Written:", out, buffer.length, "bytes");
});
