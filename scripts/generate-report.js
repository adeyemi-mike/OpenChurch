/* OpenChurch production-readiness report — docx generation (R1 cover, DM-1 palette, 3-section numbering). */
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer,
  AlignmentType, HeadingLevel, PageNumber, NumberFormat, SectionType, BorderStyle,
  WidthType, ShadingType, TableLayoutType, TableOfContents, PageBreak,
} = require("docx");
const fs = require("fs");

// ---------------------------------------------------------------- palette
const PAL = {
  bg: "162235", accent: "37DCF2",
  cover: { titleColor: "FFFFFF", subtitleColor: "B0B8C0", metaColor: "90989F", footerColor: "687078" },
  table: { headerBg: "1B6B7A", headerText: "FFFFFF", accentLine: "1B6B7A", innerLine: "C8DDE2", surface: "EDF3F5" },
  primary: "0F172A", body: "1A222E", muted: "5A6472",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { ...noBorders, insideHorizontal: NB, insideVertical: NB };

// ------------------------------------------------------- cover helpers (from design-system.md)
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([...",.;:!?", ..."-_/", " ", "\t"]);
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
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  // English chars are ~half CJK width; estimate pt*10 twips per char.
  const charWidth = (pt) => pt * 11;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
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
  const { titleLineCount = 1, titlePt = 36, hasSubtitle = false, hasEnglishLabel = false,
    metaLineCount = 0, fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0 } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  return { topSpacing, midSpacing: Math.max(safeRemaining - topSpacing - bottomSpacing, 0), bottomSpacing };
}

function buildCoverR1(config) {
  const P = config.palette;
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR - 300;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 24);
  const titleSize = titlePt * 2;
  const spacing = calcCoverSpacing({
    titleLineCount: titleLines.length, titlePt,
    hasSubtitle: !!config.subtitle, hasEnglishLabel: !!config.englishLabel,
    metaLineCount: (config.metaLines || []).length, fixedHeight: 400,
  });
  const accentLeft = { style: BorderStyle.SINGLE, size: 8, color: P.accent, space: 12 };
  const children = [];
  children.push(new Paragraph({ spacing: { before: spacing.topSpacing } }));
  if (config.englishLabel) {
    children.push(new Paragraph({
      indent: { left: padL, right: padR }, spacing: { after: 500 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: P.accent, space: 8 } },
      children: [new TextRun({ text: config.englishLabel.split("").join("  "), size: 18, color: P.accent, font: { ascii: "Calibri", eastAsia: "SimHei" }, characterSpacing: 40 })],
    }));
  }
  for (let i = 0; i < titleLines.length; i++) {
    children.push(new Paragraph({
      indent: { left: padL },
      spacing: { after: i < titleLines.length - 1 ? 100 : 300, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
      children: [new TextRun({ text: titleLines[i], size: titleSize, bold: true, color: P.cover.titleColor, font: { eastAsia: "SimHei", ascii: "Arial" } })],
    }));
  }
  if (config.subtitle) {
    children.push(new Paragraph({
      indent: { left: padL }, spacing: { after: 800 },
      children: [new TextRun({ text: config.subtitle, size: 24, color: P.cover.subtitleColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  for (const line of (config.metaLines || [])) {
    children.push(new Paragraph({
      indent: { left: padL + 200 }, spacing: { after: 80 },
      border: { left: accentLeft },
      children: [new TextRun({ text: line, size: 24, color: P.cover.metaColor, font: { eastAsia: "Microsoft YaHei", ascii: "Arial" } })],
    }));
  }
  children.push(new Paragraph({ spacing: { before: spacing.bottomSpacing } }));
  children.push(new Paragraph({
    indent: { left: padL, right: padR },
    border: { top: { style: BorderStyle.SINGLE, size: 2, color: P.accent, space: 8 } },
    spacing: { before: 200 },
    children: [
      new TextRun({ text: config.footerLeft || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
      new TextRun({ text: "                                        " }),
      new TextRun({ text: config.footerRight || "", size: 16, color: P.cover.footerColor, font: { ascii: "Arial" } }),
    ],
  }));
  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top",
        children,
      })],
    })],
  })];
}

// ---------------------------------------------------------------- body builders
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160, line: 380, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 32, color: PAL.primary, font: { ascii: "Arial", eastAsia: "SimHei" } })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 120, line: 340, lineRule: "atLeast" },
    children: [new TextRun({ text, bold: true, size: 28, color: PAL.primary, font: { ascii: "Arial", eastAsia: "SimHei" } })],
  });
}
function p(text, opts = {}) {
  const runs = Array.isArray(text) ? text : [new TextRun({ text, size: 22, color: PAL.body, font: { ascii: "Times New Roman", eastAsia: "SimSun" } })];
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: opts.after ?? 120 },
    children: runs,
  });
}
function r(text, o = {}) {
  return new TextRun({ text, size: o.size ?? 22, bold: o.bold, italics: o.italics, color: o.color ?? PAL.body, font: { ascii: o.mono ? "Consolas" : "Times New Roman", eastAsia: "SimSun" } });
}
function mono(text) {
  return new TextRun({ text, size: 20, color: PAL.primary, font: { ascii: "Courier New", eastAsia: "SimSun" } });
}
function bullet(text, level = 0) {
  return new Paragraph({
    alignment: AlignmentType.LEFT,
    bullet: { level },
    spacing: { line: 312, after: 60 },
    children: Array.isArray(text) ? text : [new TextRun({ text, size: 22, color: PAL.body, font: { ascii: "Times New Roman", eastAsia: "SimSun" } })],
  });
}
function tableTitle(text) {
  return new Paragraph({
    keepNext: true,
    spacing: { before: 160, after: 80 },
    children: [new TextRun({ text, bold: true, size: 21, color: PAL.muted, font: { ascii: "Arial", eastAsia: "SimHei" } })],
  });
}
const cellMargins = { top: 60, bottom: 60, left: 120, right: 120 };
function headerRow(cells, widths) {
  return new TableRow({
    tableHeader: true, cantSplit: true,
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: PAL.table.headerBg },
      margins: cellMargins,
      children: [new Paragraph({ spacing: { line: 276 }, children: [new TextRun({ text: c, bold: true, size: 20, color: PAL.table.headerText, font: { ascii: "Arial" } })] })],
    })),
  });
}
function dataRow(cells, widths, zebra) {
  return new TableRow({
    cantSplit: true,
    children: cells.map((c, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: zebra ? { type: ShadingType.CLEAR, fill: PAL.table.surface } : undefined,
      margins: cellMargins,
      children: [new Paragraph({ spacing: { line: 276 }, children: Array.isArray(c) ? c : [new TextRun({ text: c, size: 20, color: PAL.body, font: { ascii: "Times New Roman" } })] })],
    })),
  });
}
function tbl(rows, widths) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
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

function pageFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: PAL.muted, font: { ascii: "Times New Roman" } })],
    })],
  });
}
function pageHeader() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: PAL.table.innerLine, space: 4 } },
      children: [new TextRun({ text: "OpenChurch — Production-Readiness, Security & Quality Report", size: 16, color: PAL.muted, font: { ascii: "Arial" } })],
    })],
  });
}

// ---------------------------------------------------------------- content
const body = [];

// === A ===
body.push(h1("A. Summary of Changes"));
body.push(p([r("All work was delivered as five focused commits on the existing codebase. No existing church data, tenant content, visual design or technology choice was changed; the seed data was only corrected where it contained misleading placeholder content (Section C). The changes are listed oldest first.")]));
body.push(tableTitle("Table A-1. Commits delivered in this engagement"));
body.push(tbl([
  headerRow(["Commit", "Area", "What changed"], [16, 20, 64]),
  dataRow([mono("61753e9"), "Security (Phase 1)", "Server-controlled demonstration mode: User.isDemo flag (schema + backfill), login API rejects demo accounts when the mode is off, live demo sessions are invalidated per request, demo users never wield platform-admin rights, and the seed refuses to create demonstration content unless demo mode is explicitly enabled. The login page became a server component so no demo reference exists in client bundles."], [16, 20, 64]),
  dataRow([mono("c3f106f"), "SEO & content accuracy (Phase 2)", "Full platform-homepage metadata (canonical, Open Graph, Twitter card, request-aware origin, never localhost); church sitemaps include published sermon detail pages and exclude drafts; the contradictory \u201cno content yet\u201d placeholder was removed from the sermon detail page; event dates always show the year in the church's timezone; a safeExternalUrl validator hides placeholder and bare-platform social links; the generic https://x.com/ social link was removed from Emmanuel."], [16, 20, 64]),
  dataRow([mono("ef79638"), "Dashboards, mobile & input hardening (Phase 3\u20134)", "API-level end-to-end verification of every dashboard area (page lifecycle, events, sermons, forms, users/roles, giving, media, tenant isolation). Horizontal overflow fixed on the events, sermons, ministries and leadership card lists at mobile widths. Navigation href schema now rejects javascript:/data:/vbscript:, traversal and control characters (isSafeNavHref)."], [16, 20, 64]),
  dataRow([mono("4cb0061"), "Rendering correctness", "Replaced the inline <style> element in the church-site renderer with a CSS custom property on the .ocs-site wrapper (React 19 treats <style> as hoistable, which shifted sibling positions during hydration and failed hydration on every church page). Disabled Next.js streamed metadata via htmlLimitedBots: /.*/ so the resolved <head> is always in the initial HTML. Fixed the demo-mode e2e script to target the real /api/admin endpoint."], [16, 20, 64]),
  dataRow([mono("5bf2211"), "Privacy", "All JSON API GET responses without an explicit cache policy now send Cache-Control: no-store, and /console/* HTML pages send no-store as well, so private tenant data can never persist in the browser cache or back/forward cache after logout. Immutable media caching is preserved."], [16, 20, 64]),
], [16, 20, 64]));

// === B ===
body.push(h1("B. Security Improvements"));
body.push(h2("B.1 Demonstration mode is now a server-side decision"));
body.push(p([r("Previously the demo gate relied on "), mono("NEXT_PUBLIC_DEMO_MODE"), r(", a variable compiled into every browser bundle; disabling it only hid the demo credentials from the UI while the accounts themselves remained fully usable. The gate is now the server-side "), mono("DEMO_MODE"), r(" variable with five independent enforcement layers:")]));
body.push(bullet([r("Login rejection — the login API returns a generic 401 for "), mono("isDemo"), r(" accounts when the mode is off, with no signal that the account exists.")])); 
body.push(bullet([r("Session invalidation — "), mono("getSessionUser()"), r(" re-checks the mode on every request; a live demo session becomes unauthenticated the moment the mode is disabled (verified end-to-end with a hand-crafted session row).")]));
body.push(bullet([r("Privilege containment — "), mono("requirePlatformAdmin()"), r(" refuses platform-administration actions for any demo-flagged user even if some future code path authenticated one; the seeded operator account is never advertised on the login page.")]));
body.push(bullet([r("Seed protection — "), mono("prisma/seed.ts"), r(" refuses to create demonstration content unless demo mode is enabled, and every seeded account carries the isDemo flag; a backfill script marks accounts on legacy databases.")]));
body.push(bullet([r("Fail-safe defaults — with no configuration the mode is OFF in production and ON in development; any value other than \u201ctrue\u201d is treated as off. A legacy database without the flag cannot authenticate through the new path.")]));
body.push(p([r("Verified by "), mono("scripts/demo-mode-e2e.sh"), r(": 16/16 checks across two isolated servers (mode on: demo login works and tenant isolation holds; mode off: demo panel absent from HTML, demo login rejected, live session invalidated, platform-admin API returns 401/403 for a demo admin session).")]));

body.push(h2("B.2 Password reset security (audited and verified)"));
body.push(p([r("The existing recovery flow was audited against every requirement and verified with a dedicated test suite ("), mono("tests/password-reset.test.ts"), r(") running against a throwaway database. All properties hold:")]));
body.push(bullet([r("Tokens are 256-bit random values; only a SHA-256 hash is stored, so a database leak does not expose usable reset links.")]));
body.push(bullet([r("Tokens are single-use and expire after 60 minutes; at most five active tokens exist per user (oldest pruned).")]));
body.push(bullet([r("Rate limits: 5 reset requests per IP per hour and 10 reset attempts per IP per hour (429 beyond that).")]));
body.push(bullet([r("The forgot-password response is generic and never reveals whether an account exists; body parsing failures also return the same generic response.")]));
body.push(bullet([r("A successful reset atomically marks the token used, updates the password hash and deletes every existing session of that user; the event is recorded in the audit log.")]));
body.push(bullet([r("Where SMTP is not configured the UI says so honestly — no email is pretended and no reset link is logged in production.")]));

body.push(h2("B.3 Input validation and additional hardening"));
body.push(bullet([r("Navigation hrefs ("), mono("isSafeNavHref"), r("): reject javascript:, data:, vbscript:, path traversal and control characters; allow site paths, #anchors and http(s) URLs. Covered by unit tests.")]));
body.push(bullet([r("External links ("), mono("safeExternalUrl"), r("): social profiles, event-registration and giving links are validated before rendering — empty, non-http(s), internal-host, placeholder-host (example.com and friends) and bare social-platform homepages all render as nothing instead of broken or misleading links.")]));
body.push(bullet([r("Tenant isolation re-verified at the API layer: cross-tenant event edits, media listings and form-submission listings return 403/404; a Grace owner can never read Emmanuel data or vice versa (both directions tested).")]));
body.push(bullet([r("Cache privacy: private API and console responses now send no-store (commit 5bf2211), closing the back/forward-cache exposure on shared machines.")]));
body.push(bullet([r("CSRF double-submit verification, bcrypt cost 11, httpOnly SameSite=Lax session cookies and secure-cookie-in-production were re-confirmed as in place (existing design, unchanged).")]));

// === C ===
body.push(h1("C. SEO Improvements"));
body.push(bullet([r("Platform homepage: complete, brand-distinct metadata — absolute title, description, canonical URL, Open Graph (type, url, site name, 1200\u00d7630 image with alt), Twitter summary_large_image card. The origin is configuration-first ("), mono("NEXT_PUBLIC_SITE_URL"), r(") with a conservative request-header fallback; localhost can never leak into production metadata.")]));
body.push(bullet([r("Church sitemaps: each church's sitemap now includes its published sermon detail pages (drafts and archived sermons excluded), plus its pages and events; the root sitemap index lists every published church sitemap and robots.txt references the index.")]));
body.push(bullet([r("Sermon detail pages render per-sermon metadata with correct canonical URLs; draft, missing and cross-tenant sermons return deterministic HTTP 404s before the response head flushes.")]));
body.push(bullet([r("Streaming metadata disabled (htmlLimitedBots: /.*/): the resolved title/description/canonical/OG tags are always present in the initial HTML for every visitor, not injected after first paint. Crawlers already received blocking metadata; the change makes behaviour uniform and eliminates the streamed-placeholder markup.")]));
body.push(bullet([r("Verified by "), mono("scripts/phase2-e2e.sh"), r(" (28/28): OG/Twitter/canonical present, no localhost anywhere, sitemap includes both published sermons and excludes the draft, robots references the index, and placeholder/bare social links are absent from rendered pages while a valid profile link still renders.")]));

// === D ===
body.push(h1("D. Dashboard Module Test Results"));
body.push(p([r("Every dashboard area was exercised two ways: (1) API end-to-end tests against a production standalone build with a copied database ("), mono("scripts/phase3-e2e.sh"), r(", 28 checks) and (2) interactive browser verification of all 15 sections, including a real create\u2192publish\u2192public-render workflow. Status legend — Tested: verification performed this engagement; Passed: all checks green; Outstanding: residual work listed in Section F.")]));
body.push(tableTitle("Table D-1. Module-by-module results (15/15 tested, 15/15 passed)"));
const D = [
  ["Overview", "Browser + API", "Stats render; owner scoping correct"],
  ["Website Pages", "API e2e + browser", "Full lifecycle: create \u2192 PATCH sections \u2192 publish \u2192 public render \u2192 unpublish \u2192 404 \u2192 delete; author blocked from publish (403)"],
  ["Appearance", "Browser", "Theme/colour/logo/hero settings render and save; public site reflects changes"],
  ["Navigation", "API e2e + unit tests", "Update accepted for owner; href schema validation (114 unit tests incl. nav)"],
  ["Ministries", "Browser + mobile", "CRUD renders; mobile overflow fixed (grid-cols-1)"],
  ["Leadership", "Browser + mobile", "CRUD renders; mobile overflow fixed"],
  ["Events", "API e2e + browser", "Create\u2192publish\u2192public render; cross-tenant edit blocked (404); dates render with year and weekday in church timezone"],
  ["Sermons", "API e2e + browser", "CRUD + sitemap add/remove on publish/delete; detail renders speaker/date/series/scripture; draft \u2192 404; cross-tenant \u2192 404"],
  ["Media Library", "API e2e + browser", "Upload limit enforced (413 above 5 MB); cross-tenant listing blocked (404)"],
  ["Forms & Enquiries", "API e2e", "Public prayer submission reaches owner dashboard; invisible to other tenant; cross-tenant listing 404"],
  ["Giving Settings", "API e2e", "Owner can update; author blocked (403, ADMIN permission)"],
  ["Users & Roles", "API e2e", "Author cannot list (403) or create users (403); owner management verified"],
  ["Church Profile", "Browser", "Profile fields render and persist; public footer reflects profile"],
  ["Website Settings", "Browser", "SEO defaults, timezone, social links (validated) verified"],
  ["Activity Log", "Browser", "Entries recorded for audited actions; renders for owner"],
];
body.push(tbl([
  headerRow(["Module", "Verification", "Result / notes"], [22, 22, 56]),
  ...D.map((row, i) => dataRow(row, [22, 22, 56], i % 2 === 1)),
], [22, 22, 56]));
body.push(p([r("No module failed. Forms, media and user management were additionally verified for privacy: submissions and files are visible only within the owning tenant, in both the UI and the API.")]));

// === E ===
body.push(h1("E. Responsive & Accessibility Results"));
body.push(h2("E.1 Responsive layout"));
body.push(p([r("Six key pages were rendered at 1440, 1280, 768, 390 and 360 px and inspected for horizontal overflow (document scroll width vs. viewport) plus offending elements:")]));
body.push(tableTitle("Table E-1. Horizontal overflow results (0 px at every cell = pass)"));
const E1 = [
  ["Platform home", "0", "0", "0", "0", "0"],
  ["Grace church site", "0", "0", "0", "0", "0"],
  ["Emmanuel church site", "0", "0", "0", "0", "0"],
  ["Sermon detail (no media)", "0", "\u2014", "0", "0", "0"],
  ["Grace events list", "0", "\u2014", "0", "0", "0"],
  ["Emmanuel events list", "0", "\u2014", "0", "0", "0"],
  ["Console dashboard", "0", "\u2014", "\u2014", "0", "\u2014"],
];
body.push(tbl([
  headerRow(["Page", "1440 px", "1280 px", "768 px", "390 px", "360 px"], [30, 14, 14, 14, 14, 14]),
  ...E1.map((row, i) => dataRow(row, [30, 14, 14, 14, 14, 14], i % 2 === 1)),
], [30, 14, 14, 14, 14, 14]));
body.push(p([r("The only absolute-positioned element flagged by the deep scan (a decorative blob at 768 px on the platform home) is clipped by an overflow-hidden parent and produces no scroll — confirmed by the zero scroll-width deltas above. Earlier in the engagement a real 121 px overflow was found and fixed on the mobile events list (nowrap titles inflating an auto grid track); the same fix was applied to the sermons, ministries and leadership card lists.")]));

body.push(h2("E.2 Accessibility"));
body.push(bullet([r("Semantics: exactly one h1 per audited page (platform home, both church sites, sermon detail, five dashboard sections); heading levels never skip; landmarks header/nav/main/footer present; lang attribute set. I checked this programmatically on every audited page.")]));
body.push(bullet([r("Images and controls: zero images without alt text, zero unlabelled buttons and zero nameless links across audited pages; decorative icons are aria-hidden.")]));
body.push(bullet([r("Keyboard: skip-to-content link present on church sites with a resolvable target; focus-visible styles confirmed on sampled interactive elements; dashboard navigation operable by keyboard.")]));
body.push(bullet([r("Console hygiene: zero console errors after the rendering fixes across the platform home, both church sites, sermon detail, events, login, register, forgot-password and five dashboard sections (checked in clean browser sessions on the standalone production build).")]));
body.push(bullet([r("Full WCAG 2.2 AA conformance auditing (colour-contrast ratio measurement across all themes, screen-reader passes) was not performed — see Section F.")]));

// === F ===
body.push(h1("F. Outstanding Items"));
body.push(p([r("Nothing untested is reported as passing. The following items are explicitly open:")]));
body.push(tableTitle("Table F-1. Outstanding work"));
body.push(tbl([
  headerRow(["#", "Item", "Why it remains open"], [8, 34, 58]),
  dataRow(["1", "Production redeployment", "All fixes are committed locally and verified on a standalone production build, but the hosted deployment (v12hk9yeagh1-d.space-z.ai) still serves the previous build. Deployment is a platform-side action: the operator must run the build/publish step (e.g. Deploy in the z.ai console) to ship the new bundle."], [8, 34, 58]),
  dataRow(["2", "SMTP delivery", "SMTP is not configured in this deployment, so reset emails cannot actually be sent. The honest \u201cemail not configured\u201d path is in place and verified; a live-delivery test awaits a real SMTP configuration."], [8, 34, 58]),
  dataRow(["3", "Automated UI test suite", "Browser verification was performed interactively (agent-browser) and API flows are scripted, but there is no standing Playwright/ci suite. Regression protection currently relies on 114 unit tests + 3 bash e2e suites."], [8, 34, 58]),
  dataRow(["4", "WCAG conformance audit", "Accessibility was verified structurally (headings, labels, landmarks, focus, skip link). A measured contrast audit against WCAG 2.2 AA across all themes and a screen-reader pass were not performed."], [8, 34, 58]),
  dataRow(["5", "Load & performance testing", "Verified statically (lazy-loaded below-fold images, immutable media caching, no-store on private data, hydration now clean) but no Lighthouse/k6 baseline or load test was run."], [8, 34, 58]),
  dataRow(["6", "Emmanuel social profiles", "Only a valid Instagram profile remains; other networks are hidden by design until real profile URLs are configured in Church Profile \u2192 Website Settings."], [8, 34, 58]),
  dataRow(["7", "Backup/restore drill", "SQLite backup strategy exists but a restore drill on production data was not performed."], [8, 34, 58]),
], [8, 34, 58]));

// === G ===
body.push(h1("G. Production-Readiness Assessment"));
body.push(p([r([
  r("Verdict: ", { bold: true }),
  r("controlled demonstration, ready for limited production testing. ", { bold: true }),
  r("The hosted instance is explicitly configured as a public demonstration (DEMO_MODE=true with seeded demo tenants), and every claim in this report was verified under that configuration against a production standalone build."),
])]));
body.push(p([r("Basis for the verdict. The platform passed the full verification matrix — 114/114 unit tests, 16/16 demo-mode security checks, 28/28 SEO and content-accuracy checks, 28/28 dashboard and tenant-isolation checks, clean console across all audited pages, and zero horizontal overflow at five breakpoints. Security-critical behaviour (server-side demo gating, tenant isolation, password-reset token lifecycle, CSRF, cache privacy) is enforced server-side and covered by automated checks. The application is honest about its limits: SMTP-not-configured states are stated rather than faked, and unconfigured social links are hidden rather than rendered as placeholders.")]));
body.push(p([r("Conditions to move from controlled demonstration to limited production testing:")]));
body.push(bullet([r("Ship the current build: run the platform build/publish step so the deployed bundle matches these commits (item F-1).")]));
body.push(bullet([r("Set DEMO_MODE=false (and remove SEED_DEMO_DATA) for a real congregation instance; demo accounts then cannot authenticate at all, with or without a prior session.")]));
body.push(bullet([r("Set NEXT_PUBLIC_SITE_URL to the real public origin so canonical/OG/sitemap URLs resolve to it.")]));
body.push(bullet([r("Configure SMTP so password recovery sends real email; until then the login page states plainly that email recovery is unavailable.")]));
body.push(bullet([r("Create the first real tenant through onboarding; seeded churches remain demonstration content and the seed will not recreate them while the mode is off.")]));
body.push(p("Full production deployment (public launch with real congregations and data) additionally warrants the open items in Section F — most importantly a standing automated UI test suite, a measured WCAG audit and a backup/restore drill — before launch rather than after.", { after: 60 }));

// ---------------------------------------------------------------- document
const doc = new Document({
  styles: {
    default: {
      document: {
        run: { font: { ascii: "Times New Roman", eastAsia: "SimSun" }, size: 22, color: PAL.body },
        paragraph: { spacing: { line: 312 } },
      },
    },
  },
  sections: [
    { // Section 1: cover — margin 0, no footer
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
      children: buildCoverR1({
        title: "OpenChurch Production-Readiness, Security & Quality Report",
        subtitle: "Server-side demo gating, SEO completeness, dashboard verification and release testing",
        englishLabel: "ENGINEERING REPORT",
        metaLines: [
          "Project: OpenChurch — multi-tenant church website platform",
          "Deployment: https://v12hk9yeagh1-d.space-z.ai",
          "Date: 11 November 2026",
          "Scope: Phases 1\u20134 — Security, SEO, Functionality, Quality",
        ],
        footerLeft: "OpenChurch Engineering",
        footerRight: "November 2026",
        palette: PAL,
      }),
    },
    { // Section 2: TOC — Roman numerals
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN },
        },
      },
      footers: { default: pageFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 360 },
          children: [new TextRun({ text: "Table of Contents", bold: true, size: 32, font: { eastAsia: "SimHei", ascii: "Times New Roman" }, color: PAL.primary })],
        }),
        new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }),
        new Paragraph({
          spacing: { before: 200 },
          children: [new TextRun({ text: "Note: this Table of Contents is generated via field codes. After editing, right-click the TOC and choose \u201cUpdate Field\u201d to refresh page numbers.", italics: true, size: 18, color: "888888" })],
        }),
        // No trailing PageBreak: the body is its own section (NEXT_PAGE), so a
        // PageBreak here would create a blank page between TOC and body.
      ],
    },
    { // Section 3: body — Arabic numerals from 1
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, bottom: 1440, left: 1701, right: 1417 },
          pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL },
        },
      },
      headers: { default: pageHeader() },
      footers: { default: pageFooter() },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = "/home/z/my-project/download/OpenChurch_Production-Readiness_Report.docx";
  fs.writeFileSync(out, buf);
  console.log("written:", out, buf.length, "bytes");
});
