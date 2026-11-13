#!/bin/bash
# demo-mode-e2e.sh — end-to-end verification of the server-controlled demo gate.
# Boots the standalone production build twice (DEMO_MODE=true / false) against
# a COPY of the current database and exercises auth + tenant isolation.
set -u
cd /home/z/my-project

DB_COPY=/tmp/demo-e2e.db
cp db/custom.db "$DB_COPY"
PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); echo "  PASS: $1"; }
bad()  { FAIL=$((FAIL+1)); echo "  FAIL: $1"; }
check() { # $1 desc, $2 actual, $3 expected
  if [ "$2" = "$3" ]; then ok "$1 ($2)"; else bad "$1 (got $2, want $3)"; fi
}
contains() { # $1 desc, $2 haystack-file, $3 needle, $4 want(yes/no)
  if echo "$2" | grep -q "$3"; then found=yes; else found=no; fi
  if [ "$found" = "$4" ]; then ok "$1"; else bad "$1 (found=$found want=$4)"; fi
}

run_suite() {
  local MODE=$1 PORT=$2 LOG=$3
  echo "=== SUITE $MODE (port $PORT) ==="
  (cd .next/standalone && DATABASE_URL="file:$DB_COPY" PORT=$PORT HOSTNAME=127.0.0.1 \
     NODE_ENV=production DEMO_MODE=$MODE bun server.js > "$LOG" 2>&1 &)
  for i in $(seq 1 30); do
    curl -s --max-time 2 -o /dev/null "http://127.0.0.1:$PORT/login" && break
    sleep 1
  done

  # --- 1. Login page demo references ---
  HTML=$(curl -s --max-time 15 "http://127.0.0.1:$PORT/login")
  if [ "$MODE" = "true" ]; then
    contains "login page advertises demo accounts" "$HTML" "Demonstration accounts" yes
    contains "login page shows demo email" "$HTML" "owner@grace.demo" yes
  else
    contains "login page hides demo accounts" "$HTML" "Demonstration accounts" no
    contains "login page hides demo password hint" "$HTML" "Demo1234!" no
    contains "login page hides demo emails" "$HTML" "@grace.demo" no
  fi

  # --- 2. Demo login via API ---
  CODE=$(curl -s --max-time 15 -X POST "http://127.0.0.1:$PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"owner@grace.demo","password":"Demo1234!"}' \
    -o /tmp/e2e-login.json -w "%{http_code}")
  if [ "$MODE" = "true" ]; then
    check "demo login accepted" "$CODE" "200"
    cp /tmp/e2e-cookies.txt /tmp/grace-jar.txt 2>/dev/null
    curl -s --max-time 15 -X POST "http://127.0.0.1:$PORT/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"owner@grace.demo","password":"Demo1234!"}' \
      -c /tmp/grace-jar.txt -o /dev/null
  else
    check "demo login rejected server-side" "$CODE" "401"
  fi

  # --- 3. Wrong password stays generic 401 ---
  CODE=$(curl -s --max-time 15 -X POST "http://127.0.0.1:$PORT/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"owner@grace.demo","password":"totally-wrong"}' \
    -o /tmp/e2e-bad.json -w "%{http_code}")
  check "wrong password rejected" "$CODE" "401"

  if [ "$MODE" = "true" ]; then
    # --- 4. Tenant isolation with demo session ---
    CODE=$(curl -s --max-time 15 -b /tmp/grace-jar.txt \
      -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/console/grace-community")
    check "grace owner sees own dashboard" "$CODE" "200"
    CODE=$(curl -s --max-time 15 -b /tmp/grace-jar.txt \
      -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/console/emmanuel-parish")
    case "$CODE" in 307|308|404) check "grace owner blocked from emmanuel dashboard" "$CODE" "$CODE";; *) bad "grace owner blocked from emmanuel dashboard (got $CODE)";; esac
    CODE=$(curl -s --max-time 15 -b /tmp/grace-jar.txt \
      -o /tmp/e2e-api.json -w "%{http_code}" \
      "http://127.0.0.1:$PORT/api/dashboard/emmanuel-parish/events")
    case "$CODE" in 403|404) check "grace owner blocked from emmanuel API" "$CODE" "$CODE";; *) bad "grace owner blocked from emmanuel API (got $CODE)";; esac
  fi

  if [ "$MODE" = "false" ]; then
    # --- 5. Normal (non-demo) accounts still work: register + login ---
    CODE=$(curl -s --max-time 15 -X POST "http://127.0.0.1:$PORT/api/auth/register" \
      -H "Content-Type: application/json" \
      -d '{"name":"Test Real User","email":"real-user@e2e-test.example","password":"RealPass123!","acceptedTermsVersion":"2026-11"}' \
      -o /tmp/e2e-reg.json -w "%{http_code}")
    check "non-demo registration works" "$CODE" "200"
    CODE=$(curl -s --max-time 15 -X POST "http://127.0.0.1:$PORT/api/auth/login" \
      -H "Content-Type: application/json" \
      -d '{"email":"real-user@e2e-test.example","password":"RealPass123!"}' \
      -o /tmp/e2e-relogin.json -w "%{http_code}")
    check "non-demo login works" "$CODE" "200"

    # --- 6. Live demo session invalidated when demo mode is off ---
    # Craft a valid session row for a demo user directly in the DB copy.
    TOKEN=$(bun -e '
      import { PrismaClient } from "@prisma/client";
      import { createHash } from "crypto";
      const db = new PrismaClient();
      const u = await db.user.findUnique({ where: { email: "owner@grace.demo" } });
      const token = "e2e" + Date.now().toString(36) + "abc123";
      await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: u.id, expiresAt: new Date(Date.now() + 86400000) } });
      console.log(token);
      await db.$disconnect();
    ' 2>/dev/null | tail -1)
    CODE=$(curl -s --max-time 15 -H "Cookie: openchurch_session=$TOKEN" \
      -o /dev/null -w "%{http_code}" "http://127.0.0.1:$PORT/console/grace-community")
    case "$CODE" in 307|308) check "live demo session invalidated (redirect to login)" "$CODE" "$CODE";; *) bad "live demo session invalidated (got $CODE, want 307/308)";; esac

    # --- 7. Platform-admin API rejected for demo admin account ---
    ADMIN_TOKEN=$(bun -e '
      import { PrismaClient } from "@prisma/client";
      import { createHash, randomBytes } from "crypto";
      const db = new PrismaClient();
      const u = await db.user.findUnique({ where: { email: "admin@openchurch.dev" } });
      const token = randomBytes(16).toString("hex");
      await db.session.create({ data: { tokenHash: createHash("sha256").update(token).digest("hex"), userId: u.id, expiresAt: new Date(Date.now() + 86400000) } });
      console.log(token);
      await db.$disconnect();
    ' 2>/dev/null | tail -1)
    CODE=$(curl -s --max-time 15 -H "Cookie: openchurch_session=$ADMIN_TOKEN" \
      -o /tmp/e2e-admin.json -w "%{http_code}" "http://127.0.0.1:$PORT/api/admin")
    case "$CODE" in 401|403) check "demo platform-admin session cannot use admin API" "$CODE" "$CODE";; *) bad "demo platform-admin session blocked (got $CODE, want 401/403)";; esac
  fi

  # stop server
  pkill -f "PORT=$PORT" 2>/dev/null
  pkill -f "bun server.js" 2>/dev/null
  sleep 1
}

rm -f /tmp/grace-jar.txt /tmp/e2e-cookies.txt
run_suite true 3003 /tmp/e2e-on.log
run_suite false 3004 /tmp/e2e-off.log

echo ""
echo "=== RESULTS: $PASS passed, $FAIL failed ==="
[ "$FAIL" = "0" ] && echo "ALL DEMO-MODE E2E TESTS PASSED" || echo "SOME TESTS FAILED"
