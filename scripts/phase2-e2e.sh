#!/bin/bash
# phase2-e2e.sh — verification of Phase 2 (SEO, sermon detail, event dates, social links).
# Boots the production build on port 3006 and runs HTTP-level checks against
# a temporary, fully isolated QA test church (deleted afterwards).
set -u
cd /home/z/my-project

DB_COPY=/tmp/phase2-e2e.db
cp db/custom.db "$DB_COPY"
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS: $1 ($2)"; else FAIL=$((FAIL+1)); echo "  FAIL: $1 (got $2, want $3)"; fi; }
contains() {
  local desc=$1 hay=$2 needle=$3 want=$4 found
  if echo "$hay" | grep -q "$needle"; then found=yes; else found=no; fi
  if [ "$found" = "$want" ]; then PASS=$((PASS+1)); echo "  PASS: $desc"; else FAIL=$((FAIL+1)); echo "  FAIL: $desc (found=$found want=$want)"; fi
}

# --- create isolated QA tenant with media-state sermons ----------------------
# NOTE: DATABASE_URL is pinned to the COPY for every bun -e call — bun would
# otherwise auto-load .env and write to the live development database.
echo "=== creating QA test tenant ==="
DATABASE_URL="file:$DB_COPY" bun -e '
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
const church = await db.church.create({ data: {
  slug: "qa-test-church", name: "QA Test Church (temporary)", description: "Temporary synthetic tenant for verification.", country: "GB", timezone: "Europe/London", currency: "GBP", status: "ACTIVE", isPublished: true, onboardingCompleted: true,
  settings: { create: { themeKey: "modern", primaryColor: "#0F5C4E", secondaryColor: "#B45309", socialX: "https://x.com", socialFacebook: "https://example.com/page", socialInstagram: "https://instagram.com/realprofile" } },
}}).catch(async (e) => { console.error("create failed:", e.message); process.exit(2); });
const far = new Date("2027-11-14T10:00:00.000Z");
const [noMedia, withAudio, withVideo, draftSermon] = await Promise.all([
  db.sermon.create({ data: { churchId: church.id, title: "QA Sermon No Media", speakerName: "QA Speaker", preachedAt: far, status: "PUBLISHED", scriptureRef: "Psalm 23" } }),
  db.sermon.create({ data: { churchId: church.id, title: "QA Sermon With Audio", speakerName: "QA Speaker", preachedAt: far, status: "PUBLISHED", audioUrl: "https://example.com/audio/qa-sermon.mp3" } }),
  db.sermon.create({ data: { churchId: church.id, title: "QA Sermon With Video", speakerName: "QA Speaker", preachedAt: far, status: "PUBLISHED", videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" } }),
  db.sermon.create({ data: { churchId: church.id, title: "QA Draft Sermon", speakerName: "QA Speaker", preachedAt: far, status: "DRAFT" } }),
]);
await db.event.create({ data: { churchId: church.id, title: "QA Remembrance Style Event", startsAt: far, status: "PUBLISHED" } });
await db.websitePage.create({ data: { churchId: church.id, title: "Home", slug: "", isHomePage: true, status: "PUBLISHED", publishedAt: new Date(), publishedSections: JSON.stringify([
  { id: "qa-hero", type: "hero", enabled: true, title: "Welcome", subtitle: "", background: "soft" },
  { id: "qa-events", type: "events", enabled: true, title: "Events", subtitle: "", background: "plain", maxItems: 3, showPast: false, cta: { label: "", href: "" } },
]) } });
console.log(church.id + "\n" + noMedia.id + "\n" + withAudio.id + "\n" + withVideo.id + "\n" + draftSermon.id);
await db.$disconnect();
' > /tmp/qa-ids.txt 2>/tmp/qa-err.txt
if [ $? -ne 0 ]; then cat /tmp/qa-err.txt; exit 2; fi
CHURCH_ID=$(sed -n 1p /tmp/qa-ids.txt); S_NO_MEDIA=$(sed -n 2p /tmp/qa-ids.txt); S_AUDIO=$(sed -n 3p /tmp/qa-ids.txt); S_VIDEO=$(sed -n 4p /tmp/qa-ids.txt); S_DRAFT=$(sed -n 5p /tmp/qa-ids.txt)
echo "  QA church: $CHURCH_ID"

# --- boot server -------------------------------------------------------------
(cd .next/standalone && DATABASE_URL="file:$DB_COPY" PORT=3006 HOSTNAME=127.0.0.1 \
   NODE_ENV=production DEMO_MODE=true NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3006 bun server.js > /tmp/phase2.log 2>&1 &)
for i in $(seq 1 30); do curl -s --max-time 2 -o /dev/null "http://127.0.0.1:3006/login" && break; sleep 1; done
BASE=http://127.0.0.1:3006

echo "=== 1. Platform homepage metadata ==="
HOME_HTML=$(curl -s --max-time 15 "$BASE/")
contains "og:title present" "$HOME_HTML" 'property="og:title"' yes
contains "og:image with alt/dimensions" "$HOME_HTML" 'og-default.png' yes
contains "twitter:card present" "$HOME_HTML" 'name="twitter:card"' yes
contains "canonical present" "$HOME_HTML" 'rel="canonical"' yes
if echo "$HOME_HTML" | grep -q 'http://localhost'; then FAIL=$((FAIL+1)); echo "  FAIL: no localhost in metadata"; else PASS=$((PASS+1)); echo "  PASS: no localhost in metadata"; fi

echo "=== 2. Sermon detail: contradictory empty state removed ==="
HTML=$(curl -s --max-time 15 "$BASE/church/qa-test-church/sermons/$S_NO_MEDIA")
contains "no 'no content yet' placeholder" "$HTML" "This page has no content yet" no
contains "sermon title rendered" "$HTML" "QA Sermon No Media" yes
contains "speaker rendered" "$HTML" "QA Speaker" yes
contains "year visible on sermon date" "$HTML" "2027" yes
contains "no-recording message shown" "$HTML" "No recording of this sermon is available" yes

HTML=$(curl -s --max-time 15 "$BASE/church/qa-test-church/sermons/$S_AUDIO")
contains "audio player present" "$HTML" "<audio" yes
contains "video absent on audio sermon" "$HTML" "youtube-nocookie" no

HTML=$(curl -s --max-time 15 "$BASE/church/qa-test-church/sermons/$S_VIDEO")
contains "video iframe present" "$HTML" "youtube-nocookie.com/embed" yes
contains "audio absent on video sermon" "$HTML" "<audio" no

echo "=== 3. Sermon access control ==="
CODE=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$BASE/church/qa-test-church/sermons/$S_DRAFT")
check "draft sermon → 404" "$CODE" "404"
CODE=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$BASE/church/qa-test-church/sermons/does-not-exist")
check "missing sermon → 404" "$CODE" "404"
CODE=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$BASE/church/grace-community/sermons/$S_VIDEO")
check "cross-tenant sermon on grace site → 404" "$CODE" "404"

echo "=== 4. Event date: year + weekday ==="
HTML=$(curl -s --max-time 15 "$BASE/church/qa-test-church")
contains "event shows full date with year" "$HTML" "14 November 2027" yes
contains "weekday matches (Sunday)" "$HTML" "Sunday" yes

echo "=== 5. Social link validation ==="
HTML=$(curl -s --max-time 15 "$BASE/church/qa-test-church")
contains "generic x.com link NOT rendered" "$HTML" 'href="https://x.com"' no
contains "placeholder example.com link NOT rendered" "$HTML" 'href="https://example.com/page"' no
contains "valid instagram profile rendered" "$HTML" "instagram.com/realprofile" yes

echo "=== 6. Sitemaps ==="
SITEMAP=$(curl -s --max-time 15 "$BASE/church/qa-test-church/sitemap.xml")
contains "church sitemap includes homepage" "$SITEMAP" "church/qa-test-church</loc>" yes
contains "church sitemap includes published sermon 1" "$SITEMAP" "sermons/$S_NO_MEDIA" yes
contains "church sitemap includes published sermon 2" "$SITEMAP" "sermons/$S_VIDEO" yes
contains "church sitemap excludes draft sermon" "$SITEMAP" "sermons/$S_DRAFT" no
ROOT=$(curl -s --max-time 15 "$BASE/sitemap.xml")
contains "root index lists church sitemap" "$ROOT" "church/qa-test-church/sitemap.xml" yes
ROBOTS=$(curl -s --max-time 15 "$BASE/robots.txt")
contains "robots references sitemap index" "$ROBOTS" "Sitemap: " yes

# --- cleanup: delete the QA tenant (cascades all QA data) --------------------
echo "=== cleanup ==="
DATABASE_URL="file:$DB_COPY" bun -e '
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
await db.church.delete({ where: { slug: "qa-test-church" } });
console.log("  QA tenant deleted");
await db.$disconnect();
'
rm -f "$DB_COPY"
pkill -f "bun server.js" 2>/dev/null; sleep 1
echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ] && echo "ALL PHASE 2 TESTS PASSED" || echo "SOME TESTS FAILED"
