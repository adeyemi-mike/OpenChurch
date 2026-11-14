#!/bin/bash
# Authenticated smoke test for OpenChurch — logs in as demo owner and checks
# every dashboard route + key API endpoints.
set -u
BASE="http://localhost:3000"
JAR=/tmp/oc-cookies.txt
rm -f "$JAR"

login() {
  curl -s -c "$JAR" -X POST "$BASE/api/auth/login" \
    -H 'Content-Type: application/json' \
    -H "Origin: $BASE" \
    -d '{"email":"owner@grace.demo","password":"Demo1234!"}' | head -c 120
  echo
}

echo "== login =="
login

check() {
  code=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE$1")
  printf "%-58s %s\n" "$1" "$code"
}

echo "== console pages =="
for p in /console/grace-community \
         /console/grace-community/pages \
         /console/grace-community/appearance \
         /console/grace-community/ministries \
         /console/grace-community/leadership \
         /console/grace-community/events \
         /console/grace-community/sermons \
         /console/grace-community/media \
         /console/grace-community/navigation \
         /console/grace-community/forms \
         /console/grace-community/giving \
         /console/grace-community/users \
         /console/grace-community/profile \
         /console/grace-community/settings \
         /console/grace-community/domains \
         /console/grace-community/activity; do
  check "$p"
done

echo "== platform admin (as church owner — expect redirect 307) =="
check /admin

echo "== builder page (grab a page id first) =="
PAGE_ID=$(curl -s -b "$JAR" "$BASE/api/dashboard/grace-community/pages" | python3 -c "import json,sys; d=json.load(sys.stdin); print([p['id'] for p in d['data']['pages'] if p['slug']=='about'][0])")
check "/console/grace-community/pages/$PAGE_ID"

echo "== APIs =="
check "/api/dashboard/grace-community/pages"
check "/api/dashboard/grace-community/ministries"
check "/api/dashboard/grace-community/leaders"
check "/api/dashboard/grace-community/events"
check "/api/dashboard/grace-community/sermons"
check "/api/dashboard/grace-community/series"
check "/api/dashboard/grace-community/media?kind=IMAGE"
check "/api/dashboard/grace-community/navigation"
check "/api/dashboard/grace-community/submissions"
check "/api/dashboard/grace-community/forms"
check "/api/dashboard/grace-community/giving"
check "/api/dashboard/grace-community/users"
check "/api/dashboard/grace-community/services"
check "/api/dashboard/grace-community/locations"
check "/api/dashboard/grace-community/activity"
check "/api/dashboard/grace-community/domains"
check "/api/dashboard/grace-community/profile"

echo "== tenant isolation: Grace owner tries Emmanuel APIs =="
check "/api/dashboard/emmanuel-parish/pages"
check "/api/dashboard/emmanuel-parish/ministries"

echo "== public forms & seo =="
check "/church/grace-community"
check "/church/grace-community/about"
check "/church/grace-community/sermons"
check "/church/grace-community/give"
check "/church/emmanuel-parish"
check "/church/grace-community/sitemap.xml"
check "/robots.txt"

echo "== CSRF behind Host-rewriting gateway (double-submit fallback) =="
# Simulate the managed-gateway topology: browser Origin = public edge host,
# Host header = internal address. A valid double-submit (cookie + header)
# must pass (route then returns 400 for the invalid body); a missing header
# must be rejected with 403 before body validation.
rm -f /tmp/oc-csrf-jar.txt
CSRF=$(curl -s -c /tmp/oc-csrf-jar.txt "$BASE/church/grace-community/contact" -D - -o /dev/null | tr -d '\r' | awk 'tolower($0) ~ /^set-cookie: openchurch_csrf=/ {print $2}' | cut -d';' -f1 | cut -d= -f2)
PUB="https://preview-chat-692216d1-a0d3-437b-ae39-abd9164058bf.space-z.ai"
code=$(curl -s -b /tmp/oc-csrf-jar.txt -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/api/public/grace-community/submit" \
  -H 'Content-Type: application/json' -H "Origin: $PUB" -H "x-csrf-token: $CSRF" \
  -d '{"name":"CSRF Probe","type":"CONTACT","message":"probe","email":"not-an-email"}')
[ "$code" = "400" ] && echo "double-submit + gateway Origin     PASS (400 = csrf ok, body invalid)" || echo "double-submit + gateway Origin     FAIL ($code)"
code=$(curl -s -b /tmp/oc-csrf-jar.txt -o /dev/null -w "%{http_code}" -X POST \
  "$BASE/api/public/grace-community/submit" \
  -H 'Content-Type: application/json' -H "Origin: $PUB" \
  -d '{"name":"CSRF Probe","type":"CONTACT","message":"probe"}')
[ "$code" = "403" ] && echo "gateway Origin without header      PASS (403 blocked)" || echo "gateway Origin without header      FAIL ($code)"

echo "== platform-admin isolation (demo credentials must NOT reach admin) =="
rm -f "$JAR"
# The hardened seed gives the platform admin a RANDOM password; the shared
# demo password must never authenticate as admin (privilege-escalation guard).
ADMIN_LOGIN=$(curl -s -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -H "Origin: $BASE" -d '{"email":"admin@openchurch.dev","password":"Demo1234!"}')
echo "$ADMIN_LOGIN" | rg -q '"ok":true' && echo "demo password on admin account     FAIL (escalation!)" || echo "demo password on admin account     PASS (rejected)"
# And a logged-in church owner must not access platform admin routes.
curl -s -c "$JAR" -X POST "$BASE/api/auth/login" -H 'Content-Type: application/json' -H "Origin: $BASE" -d '{"email":"owner@grace.demo","password":"Demo1234!"}' > /dev/null
code=$(curl -s -b "$JAR" -o /dev/null -w "%{http_code}" "$BASE/admin")
[ "$code" = "307" ] || [ "$code" = "403" ] && echo "church owner -> /admin             PASS ($code)" || echo "church owner -> /admin             FAIL ($code)"
