#!/bin/bash
# Full-route sweep: open every OpenChurch route in the real browser and
# capture UNCAUGHT page errors and any JSON/SyntaxError console output.
# Proves (or refutes) that the "data: {"da" SyntaxError can occur in-app.
set -u
export PATH="$PATH:/home/z/.bun/bin"
BASE="https://preview-chat-692216d1-a0d3-437b-ae39-abd9164058bf.space-z.ai"

ROUTES=(
  "/"
  "/login"
  "/register"
  "/forgot-password"
  "/privacy"
  "/terms"
  "/onboarding"
  "/church/grace-community"
  "/church/grace-community/about"
  "/church/grace-community/ministries"
  "/church/grace-community/events"
  "/church/grace-community/sermons"
  "/church/grace-community/give"
  "/church/grace-community/contact"
  "/church/emmanuel-parish"
  "/church/emmanuel-parish/about"
  "/church/emmanuel-parish/ministries"
  "/church/emmanuel-parish/events"
  "/church/emmanuel-parish/sermons"
  "/church/emmanuel-parish/give"
  "/church/emmanuel-parish/contact"
  "/console"
  "/console/grace-community"
  "/console/grace-community/pages"
  "/console/grace-community/appearance"
  "/console/grace-community/ministries"
  "/console/grace-community/leadership"
  "/console/grace-community/events"
  "/console/grace-community/sermons"
  "/console/grace-community/media"
  "/console/grace-community/navigation"
  "/console/grace-community/forms"
  "/console/grace-community/giving"
  "/console/grace-community/users"
  "/console/grace-community/profile"
  "/console/grace-community/settings"
  "/console/grace-community/activity"
)

FAILED=0
for r in "${ROUTES[@]}"; do
  # Clear accumulated errors/console BEFORE navigating so each route is
  # judged only by what IT produces (agent-browser state is session-wide).
  agent-browser errors --clear >/dev/null 2>&1
  agent-browser console --clear >/dev/null 2>&1
  agent-browser open "$BASE$r" >/dev/null 2>&1
  sleep 3
  errs=$(agent-browser errors 2>/dev/null | rg -v "^\s*$|^stderr:|^$" | head -4)
  syn=$(agent-browser console 2>/dev/null | rg -i "syntaxerror|not valid json|unexpected token" | head -3)
  status=""
  [ -n "$errs" ] && { status="$status PAGE_ERRS:[$errs]"; FAILED=$((FAILED+1)); }
  [ -n "$syn" ] && { status="$status CONSOLE:[$syn]"; FAILED=$((FAILED+1)); }
  if [ -n "$status" ]; then
    echo "✗ $r $status"
  else
    echo "✓ $r"
  fi
done
echo "=============================="
echo "routes with problems: $FAILED / ${#ROUTES[@]}"
