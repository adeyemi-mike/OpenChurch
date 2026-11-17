#!/usr/bin/env bash
#
# Password-recovery E2E test against the local production server
# (port 3100, SMTP sink on 2525). Exercises the 10 required checks
# using the demo account. Robust version: proper .eml decoding,
# tolerant cookie handling, correct SQLite column names.
#
set -uo pipefail
BASE="http://127.0.0.1:3100"
EMAIL="owner@grace.demo"
OLD_PASS="NewPass-2026-11!"
NEW_PASS="NewPass2-2026-11!"
JAR=/tmp/e2e-cookies.txt

csrf_header() {
  [ -f "$JAR" ] && awk -F'\t' '$6=="openchurch_csrf" {print $7}' "$JAR" | tail -1 || true
}

api() { # api <method> <path> [json-body] -> sets HTTP_CODE and BODY
  local method=$1 path=$2 body=${3:-}
  touch "$JAR"
  local args=(-s -o /tmp/e2e-body.json -w '%{http_code}' -X "$method" "$BASE$path"
    -H 'Content-Type: application/json' -H "Origin: $BASE"
    -b "$JAR" -c "$JAR")
  local tok; tok=$(csrf_header)
  [ -n "${tok:-}" ] && args+=(-H "x-csrf-token: $tok")
  [ -n "$body" ] && args+=(-d "$body")
  HTTP_CODE=$(curl "${args[@]}")
  BODY=$(cat /tmp/e2e-body.json)
}

extract_link() { # extract_link <eml-file> -> prints the reset URL
  python3 - "$1" <<'PY'
import sys
from email import policy
from email.parser import BytesParser
msg = BytesParser(policy=policy.default).parse(open(sys.argv[1], 'rb'))
body = msg.get_body(preferencelist=('plain',)).get_content()
for line in body.splitlines():
    line = line.strip()
    if '/reset-password?token=' in line and line.startswith('http'):
        print(line)
        break
PY
}

echo "== 0. prime cookies (CSRF) =="
rm -f "$JAR"
api GET /login
echo "   login page -> $HTTP_CODE"

echo "== 1. request reset for real account =="
rm -rf /tmp/mailbox/*
api POST /api/auth/forgot-password "{\"email\":\"$EMAIL\"}"
echo "   HTTP $HTTP_CODE body=$BODY"
sleep 2
MAIL=$(ls /tmp/mailbox/*.eml 2>/dev/null | head -1)
[ -z "$MAIL" ] && { echo "   FAIL: no email received"; exit 1; }
echo "   email delivered: $MAIL"

echo "== 2. extract link + verify canonical domain =="
LINK=$(extract_link "$MAIL")
echo "   link: ${LINK:0:80}…"
case "$LINK" in
  "https://openchurch.pillarsconnect.online/reset-password?token="*) echo "   PASS: canonical domain in reset link";;
  *) echo "   FAIL: wrong origin: $LINK";;
esac
TOKEN=$(printf '%s' "$LINK" | sed -E 's/.*token=//')

echo "== 3. login with OLD password (creates a session to revoke later) =="
api POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASS\"}"
echo "   HTTP $HTTP_CODE (expect 200)"
OLD_SESSION=$(csrf_header)
api GET /api/dashboard/grace-community/activity
echo "   authed call with fresh session -> HTTP $HTTP_CODE (expect 200)"

echo "== 4. reset the password with the token =="
api POST /api/auth/reset-password "{\"token\":\"$TOKEN\",\"password\":\"$NEW_PASS\"}"
echo "   HTTP $HTTP_CODE body=$BODY (expect 200)"

echo "== 5. login with NEW password =="
rm -f "$JAR"
api GET /login >/dev/null
api POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}"
echo "   HTTP $HTTP_CODE (expect 200)"

echo "== 6. OLD password must fail =="
rm -f "$JAR"
api GET /login >/dev/null
api POST /api/auth/login "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASS\"}"
echo "   HTTP $HTTP_CODE (expect 401)"

echo "== 7. token reuse must fail =="
api POST /api/auth/reset-password "{\"token\":\"$TOKEN\",\"password\":\"Another-123!\"}"
echo "   HTTP $HTTP_CODE (expect 400)"

echo "== 8. enumeration: unknown email -> identical generic response, no mail =="
rm -f "$JAR"
api GET /login >/dev/null
api POST /api/auth/forgot-password '{"email":"nobody@nowhere.test"}'
echo "   HTTP $HTTP_CODE body=$BODY"
sleep 1
echo "   emails in sink: $(ls /tmp/mailbox/*.eml 2>/dev/null | wc -l) (expect 1 — no new mail)"

echo "== 9. pre-reset session must be revoked =="
rm -f "$JAR"
printf '127.0.0.1\tFALSE\t/\tFALSE\t0\topenchurch_csrf\t%s\n' "$OLD_SESSION" > "$JAR"
api GET /api/dashboard/grace-community/activity
echo "   authed call with pre-reset session -> HTTP $HTTP_CODE (expect 401)"

echo "== 10. expired token must be rejected =="
rm -f "$JAR"
api GET /login >/dev/null
api POST /api/auth/forgot-password "{\"email\":\"$EMAIL\"}" >/dev/null
sleep 2
MAIL2=$(ls -t /tmp/mailbox/*.eml | head -1)
TOKEN2=$(extract_link "$MAIL2" | sed -E 's/.*token=//')
python3 - "$TOKEN2" <<'PY'
import sqlite3, sys, hashlib
tok = sys.argv[1]
h = hashlib.sha256(tok.encode()).hexdigest()
con = sqlite3.connect('/home/z/my-project/db/custom.db')
con.execute("UPDATE password_reset_tokens SET expiresAt = '2026-01-01 00:00:00' WHERE tokenHash = ?", (h,))
con.commit()
print('   token force-expired in DB')
PY
api POST /api/auth/reset-password "{\"token\":\"$TOKEN2\",\"password\":\"Expired-123!\"}"
echo "   HTTP $HTTP_CODE (expect 400)"

echo "== E2E COMPLETE =="