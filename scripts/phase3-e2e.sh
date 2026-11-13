#!/bin/bash
# phase3-e2e.sh — dashboard workflow + tenant isolation verification via the real API.
# Default: uses the standalone production build with a SQLite DB copy on :3007.
# Set P3_EXTERNAL_BASE="http://127.0.0.1:PORT" to run the same checks against
# an already-running server (e.g. a PostgreSQL-backed instance for provider
# verification). Exercised areas: pages, events, sermons, forms, users/roles,
# giving, media and cross-tenant isolation.
set -u
cd /home/z/my-project

if [ -n "${P3_EXTERNAL_BASE:-}" ]; then
  BASE="$P3_EXTERNAL_BASE"
  PORT="${BASE##*:}"
  echo "(external target: $BASE)"
else
DB_COPY=/tmp/phase3-e2e.db
cp db/custom.db "$DB_COPY"
PORT=3007
BASE="http://127.0.0.1:$PORT"
fi
PASS=0; FAIL=0
check() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "  PASS: $1 ($2)"; else FAIL=$((FAIL+1)); echo "  FAIL: $1 (got $2, want $3)"; fi; }
checkrange() { if echo "$2" | grep -qE "$3"; then PASS=$((PASS+1)); echo "  PASS: $1 ($2)"; else FAIL=$((FAIL+1)); echo "  FAIL: $1 (got $2, want $3)"; fi; }
contains() {
  local desc=$1 hay=$2 needle=$3 want=$4 found
  if echo "$hay" | grep -q "$needle"; then found=yes; else found=no; fi
  if [ "$found" = "$want" ]; then PASS=$((PASS+1)); echo "  PASS: $desc"; else FAIL=$((FAIL+1)); echo "  FAIL: $desc (found=$found want=$want)"; fi
}

jqget() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin); print($2)" 2>/dev/null; }

if [ -z "${P3_EXTERNAL_BASE:-}" ]; then
(cd .next/standalone && DATABASE_URL="file:$DB_COPY" PORT=$PORT HOSTNAME=127.0.0.1 \
   NODE_ENV=production DEMO_MODE=true NEXT_PUBLIC_SITE_URL=$BASE bun server.js > /tmp/phase3.log 2>&1 &)
fi
for i in $(seq 1 30); do curl -s --max-time 2 -o /dev/null "$BASE/login" && break; sleep 1; done

login() { # $1 email, $2 password, $3 cookie-jar
  curl -s --max-time 15 -c "$3" -X POST "$BASE/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" -o /dev/null -w "%{http_code}"
}
api() { # $1 jar, $2 method, $3 path, $4 body(optional) → prints body, status in API_STATUS
  local jar=$1 method=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    API_STATUS=$(curl -s --max-time 20 -b "$jar" -X "$method" "$BASE$path" \
      -H "Content-Type: application/json" -o /tmp/p3-body.json -w "%{http_code}" -d "$body")
  else
    API_STATUS=$(curl -s --max-time 20 -b "$jar" -X "$method" "$BASE$path" \
      -o /tmp/p3-body.json -w "%{http_code}")
  fi
  cat /tmp/p3-body.json
}

echo "=== 1. Authentication ==="
ST=$(login owner@grace.demo 'Demo1234!' /tmp/p3-grace.jar); check "grace owner login" "$ST" "200"
ST=$(login owner@emmanuel.demo 'Demo1234!' /tmp/p3-emma.jar); check "emmanuel owner login" "$ST" "200"
ST=$(login author@grace.demo 'Demo1234!' /tmp/p3-author.jar); check "grace author login" "$ST" "200"

echo "=== 2. Website Pages lifecycle (grace) ==="
# Real dashboard workflow: create (starts with an empty richtext section),
# PATCH the section content, then publish.
BODY=$(api /tmp/p3-grace.jar POST "/api/dashboard/grace-community/pages" '{"title":"QA Workflow Page","slug":"qa-workflow"}')
PAGE_ID=$(echo "$BODY" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)
echo "  created page: $PAGE_ID"
ST=$(api /tmp/p3-grace.jar PATCH "/api/dashboard/grace-community/pages/$PAGE_ID" '{"sections":"[{\"id\":\"s1\",\"type\":\"richtext\",\"enabled\":true,\"title\":\"\",\"subtitle\":\"\",\"background\":\"plain\",\"body\":\"QA content for the public page\"}]"}' >/dev/null; echo "$API_STATUS")
check "page sections updated (owner)" "$ST" "200"
ST=$(api /tmp/p3-grace.jar POST "/api/dashboard/grace-community/pages/$PAGE_ID/publish" '{"action":"publish"}' >/dev/null; echo "$API_STATUS")
check "publish page (owner)" "$ST" "200"
PUB=$(curl -s --max-time 15 "$BASE/church/grace-community/qa-workflow")
contains "published page renders publicly" "$PUB" "QA content for the public page" yes
ST=$(api /tmp/p3-author.jar POST "/api/dashboard/grace-community/pages/$PAGE_ID/publish" '{"action":"unpublish"}' >/dev/null; echo "$API_STATUS")
checkrange "author cannot unpublish (403)" "$ST" "40[34]"
ST=$(api /tmp/p3-grace.jar POST "/api/dashboard/grace-community/pages/$PAGE_ID/publish" '{"action":"unpublish"}' >/dev/null; echo "$API_STATUS")
check "unpublish page (owner)" "$ST" "200"
PUB=$(curl -s --max-time 15 -o /dev/null -w "%{http_code}" "$BASE/church/grace-community/qa-workflow")
check "unpublished page gone from public site" "$PUB" "404"
ST=$(api /tmp/p3-grace.jar DELETE "/api/dashboard/grace-community/pages/$PAGE_ID" >/dev/null; echo "$API_STATUS")
checkrange "page deleted by owner" "$ST" "20[04]"

echo "=== 3. Events lifecycle (grace) ==="
BODY=$(api /tmp/p3-grace.jar POST "/api/dashboard/grace-community/events" '{"title":"QA Isolation Event","startsAt":"2027-03-01T10:00:00.000Z","status":"PUBLISHED","registrationEnabled":false}')
EVT_ID=$(echo "$BODY" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)
echo "  created event: $EVT_ID"
PUB=$(curl -s --max-time 15 "$BASE/church/grace-community")
contains "event visible on public site" "$PUB" "QA Isolation Event" yes
ST=$(api /tmp/p3-emma.jar PATCH "/api/dashboard/grace-community/events/$EVT_ID" '{"title":"Hacked Event"}' >/dev/null; echo "$API_STATUS")
checkrange "emmanuel owner cannot modify grace event" "$ST" "40[34]"

echo "=== 4. Sermons lifecycle (grace) ==="
BODY=$(api /tmp/p3-grace.jar POST "/api/dashboard/grace-community/sermons" '{"title":"QA Isolation Sermon","speakerName":"QA Speaker","preachedAt":"2027-03-01T10:00:00.000Z","status":"PUBLISHED","audioUrl":"https://example.com/qa.mp3"}')
SRM_ID=$(echo "$BODY" | grep -oE '"id":"[0-9a-f-]{36}"' | head -1 | cut -d'"' -f4)
echo "  created sermon: $SRM_ID"
SM=$(curl -s --max-time 15 "$BASE/sitemap.xml" >/dev/null; curl -s --max-time 15 "$BASE/church/grace-community/sitemap.xml")
contains "published sermon in church sitemap" "$SM" "sermons/$SRM_ID" yes
DETAIL=$(curl -s --max-time 15 "$BASE/church/grace-community/sermons/$SRM_ID")
contains "sermon detail renders" "$DETAIL" "QA Isolation Sermon" yes
contains "audio player on sermon detail" "$DETAIL" "<audio" yes
ST=$(api /tmp/p3-grace.jar DELETE "/api/dashboard/grace-community/sermons/$SRM_ID" >/dev/null; echo "$API_STATUS")
checkrange "sermon deleted by owner" "$ST" "20[04]"
SM=$(curl -s --max-time 15 "$BASE/church/grace-community/sitemap.xml")
contains "deleted sermon gone from sitemap" "$SM" "sermons/$SRM_ID" no

echo "=== 5. Forms: public submission + dashboard visibility + privacy ==="
FORMS=$(api /tmp/p3-grace.jar GET "/api/dashboard/grace-community/forms")
FORM_ID=$(echo "$FORMS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
data=d.get('data') or d
items=data if isinstance(data,list) else data.get('items') or data.get('forms') or []
public=[f for f in items if f.get('isPublic')]
print(public[0]['id'] if public else (items[0]['id'] if items else ''))" 2>/dev/null)
echo "  public form id: $FORM_ID"
if [ -n "$FORM_ID" ]; then
  SUB=$(curl -s --max-time 15 -X POST "$BASE/api/public/grace-community/submit" -H "Content-Type: application/json" \
    -d '{"type":"PRAYER","name":"QA Visitor","email":"qa-visitor@test.example","message":"QA confidential prayer request XYZZY"}')
  SUB_OK=$(echo "$SUB" | head -c 40)
  echo "  submit response: $SUB_OK"
  SUBS=$(api /tmp/p3-grace.jar GET "/api/dashboard/grace-community/submissions")
  contains "submission visible to grace owner" "$SUBS" "XYZZY" yes
  SUBS_E=$(api /tmp/p3-emma.jar GET "/api/dashboard/emmanuel-parish/submissions")
  contains "submission NOT visible to emmanuel owner" "$SUBS_E" "XYZZY" no
  ST=$(api /tmp/p3-emma.jar GET "/api/dashboard/grace-community/submissions" >/dev/null; echo "$API_STATUS")
  checkrange "emmanuel owner cannot list grace submissions" "$ST" "40[34]"
else
  echo "  (no public forms found — skipping submit test)"
fi

echo "=== 6. Users & roles ==="
ST=$(api /tmp/p3-author.jar GET "/api/dashboard/grace-community/users" >/dev/null; echo "$API_STATUS")
checkrange "author cannot list users (owner-only)" "$ST" "40[34]"
ST=$(api /tmp/p3-author.jar POST "/api/dashboard/grace-community/users" '{"email":"hacker@test.example","role":"ADMIN"}' >/dev/null; echo "$API_STATUS")
checkrange "author cannot create users" "$ST" "40[34]"

echo "=== 7. Giving settings ==="
ST=$(api /tmp/p3-grace.jar PUT "/api/dashboard/grace-community/giving" '{"isEnabled":true,"mode":"BANK","bankDetails":"QA bank details for verification"}' >/dev/null; echo "$API_STATUS")
check "owner updates giving settings" "$ST" "200"
ST=$(api /tmp/p3-author.jar PUT "/api/dashboard/grace-community/giving" '{"isEnabled":false,"mode":"BANK","bankDetails":"hacked"}' >/dev/null; echo "$API_STATUS")
checkrange "author cannot change giving (ADMIN perm)" "$ST" "40[34]"
G=$(api /tmp/p3-grace.jar GET "/api/dashboard/grace-community/giving")
contains "grace giving settings load" "$G" '"isEnabled"' yes

echo "=== 8. Media access control ==="
ST=$(api /tmp/p3-emma.jar GET "/api/dashboard/grace-community/media" >/dev/null; echo "$API_STATUS")
checkrange "emmanuel owner cannot list grace media" "$ST" "40[34]"

echo "=== 9. Navigation validation ==="
ST=$(api /tmp/p3-grace.jar PUT "/api/dashboard/grace-community/navigation" '{"location":"HEADER","items":[{"label":"QA Nav","href":"/about"}]}' >/dev/null; echo "$API_STATUS")
checkrange "navigation update accepted (owner)" "$ST" "20[04]"

echo "=== 10. Platform admin protection ==="
ST=$(api /tmp/p3-grace.jar GET "/api/admin" >/dev/null; echo "$API_STATUS")
check "church owner blocked from platform admin API" "$ST" "403"

pkill -f "bun server.js" 2>/dev/null; sleep 1
echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ] && echo "ALL PHASE 3 API TESTS PASSED" || echo "SOME TESTS FAILED"
