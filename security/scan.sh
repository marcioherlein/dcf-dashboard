#!/usr/bin/env bash
# insic.app security scan — ffuf-based
# Target: https://insic.app
# Run from: /Users/i502042/Desktop/dcf-dashboard/security/
#
# Prerequisites:
#   brew install ffuf
#
# Usage:
#   chmod +x scan.sh
#   ./scan.sh             # all phases
#   ./scan.sh phase1      # single phase
#
# Results land in ./results/

set -euo pipefail

TARGET="https://insic.app"
WL="$(pwd)/wordlists"
OUT="$(pwd)/results"
mkdir -p "$OUT"

# Stealth settings — production target
RATE=5        # requests/sec
THREADS=5

PHASE="${1:-all}"

banner() { echo; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; echo "  $1"; echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"; }

# ────────────────────────────────────────────────────────────────
# PHASE 1 — Page route discovery
# Goal: find any pages the Next.js router exposes beyond the known list.
# Expect 200 (page rendered) or 307 redirect-to-login for auth-gated pages.
# Unexpected 200s on unknown routes are findings.
# ────────────────────────────────────────────────────────────────
phase1() {
  banner "Phase 1 — Page route discovery"
  ffuf \
    -w "$WL/pages.txt" \
    -u "$TARGET/FUZZ" \
    -ac \
    -mc 200,301,302,307,403,500 \
    -rate $RATE \
    -t $THREADS \
    -c -v \
    -o "$OUT/phase1-pages.json" \
    -of json
  echo "Results: $OUT/phase1-pages.json"
}

# ────────────────────────────────────────────────────────────────
# PHASE 2 — API endpoint enumeration
# Goal: find all /api/* routes, including undocumented/legacy ones.
# Key findings to watch for:
#   - 200/201 on unknown routes (unauthenticated data leak)
#   - 400 (route exists but bad params — confirms existence)
#   - 500 (route exists and threw an error)
#   - 403 vs 401 discrepancy (auth logic inconsistency)
# ────────────────────────────────────────────────────────────────
phase2() {
  banner "Phase 2 — API endpoint enumeration"
  ffuf \
    -w "$WL/api-routes.txt" \
    -u "$TARGET/api/FUZZ" \
    -ac \
    -mc 200,201,400,401,403,405,500 \
    -rate $RATE \
    -t $THREADS \
    -c -v \
    -o "$OUT/phase2-api.json" \
    -of json
  echo "Results: $OUT/phase2-api.json"
}

# ────────────────────────────────────────────────────────────────
# PHASE 3a — Ticker param fuzzing on unauthenticated data routes
# Routes confirmed as no-session-check from codebase:
#   /api/financials, /api/historical, /api/news, /api/peers,
#   /api/insiders, /api/statements, /api/valuations, /api/price-history
# Goal: test injection/traversal via the ticker param.
# ────────────────────────────────────────────────────────────────
phase3a() {
  banner "Phase 3a — Ticker param injection (financials)"
  for endpoint in financials historical news peers insiders statements valuations price-history; do
    echo "  → /api/$endpoint?ticker=FUZZ"
    ffuf \
      -w "$WL/params-ticker.txt" \
      -u "$TARGET/api/$endpoint?ticker=FUZZ" \
      -ac \
      -mc 200,400,500 \
      -rate $RATE \
      -t $THREADS \
      -c \
      -o "$OUT/phase3a-$endpoint.json" \
      -of json
  done
  echo "Results: $OUT/phase3a-*.json"
}

# ────────────────────────────────────────────────────────────────
# PHASE 3b — Search param fuzzing
# /api/search?q= is unauthenticated and directly queries stock data
# ────────────────────────────────────────────────────────────────
phase3b() {
  banner "Phase 3b — Search param fuzzing"
  ffuf \
    -w "$WL/params-ticker.txt" \
    -u "$TARGET/api/search?q=FUZZ" \
    -ac \
    -mc 200,400,500 \
    -rate $RATE \
    -t $THREADS \
    -c \
    -o "$OUT/phase3b-search.json" \
    -of json
  echo "Results: $OUT/phase3b-search.json"
}

# ────────────────────────────────────────────────────────────────
# PHASE 3c — DCF recalculate param fuzzing
# /api/recalculate is unauthenticated and accepts many numeric params.
# Test for edge cases that could cause server errors or unexpected behavior.
# ────────────────────────────────────────────────────────────────
phase3c() {
  banner "Phase 3c — /api/recalculate numeric param edge cases"
  local NUMERIC_PROBES="$OUT/numeric-probes.txt"
  cat > "$NUMERIC_PROBES" << 'EOF'
0
-1
-999999
999999999
NaN
null
undefined
Infinity
-Infinity
1e308
0.0000001
%00
../
<script>alert(1)</script>
' OR 1=1--
EOF

  for param in baseFCF cagr wacc terminalG sharesM currentPrice; do
    echo "  → /api/recalculate?$param=FUZZ&baseFCF=100&cagr=0.1&wacc=0.1&terminalG=0.03&sharesM=1&currentPrice=100"
    ffuf \
      -w "$NUMERIC_PROBES" \
      -u "$TARGET/api/recalculate?baseFCF=100&cagr=0.1&wacc=0.1&terminalG=0.03&sharesM=1&currentPrice=100&${param}=FUZZ" \
      -ac \
      -mc 200,400,500 \
      -rate $RATE \
      -t $THREADS \
      -c \
      -o "$OUT/phase3c-recalculate-$param.json" \
      -of json
  done
  echo "Results: $OUT/phase3c-*.json"
}

# ────────────────────────────────────────────────────────────────
# PHASE 4 — Auth boundary & email endpoint abuse
#
# 4a: Confirm admin routes return 403 (not 200) without auth cookie.
#     If any return 200, that's a critical finding.
#
# 4b: /api/email/welcome is UNAUTHENTICATED and sends real emails via Resend.
#     This is a significant finding — probe to understand the impact.
#     We'll send a single controlled test request (not fuzzing) and confirm
#     the endpoint works without any auth.
# ────────────────────────────────────────────────────────────────
phase4() {
  banner "Phase 4 — Auth boundary checks"

  echo "  → Probing admin routes (expect 403)"
  for route in admin/users admin/stats admin/broadcast; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/$route")
    echo "    /api/$route → HTTP $STATUS $([ "$STATUS" = "403" ] && echo '✓ correctly blocked' || echo '⚠ UNEXPECTED')"
  done

  echo
  echo "  → /api/user/plan (should require auth)"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/user/plan")
  echo "    /api/user/plan → HTTP $STATUS"

  echo
  echo "  → /api/stock-views (should require auth)"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/stock-views")
  echo "    /api/stock-views → HTTP $STATUS"

  echo
  echo "  → /api/portfolio (should require auth)"
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$TARGET/api/portfolio")
  echo "    /api/portfolio → HTTP $STATUS"

  echo
  echo "  [FINDING PROBE] /api/email/welcome — unauthenticated POST"
  echo "  Sending controlled test (no real email — using invalid address to test endpoint exposure):"
  RESP=$(curl -s -X POST "$TARGET/api/email/welcome" \
    -H "Content-Type: application/json" \
    -d '{"email":""}' \
    -w "\nHTTP_STATUS:%{http_code}")
  echo "    Response: $RESP"
  echo "  Note: If this returned 400 (missing email), the endpoint is reachable without auth."
  echo "  If it returns 200 with a real email, that is a critical finding."
}

# ────────────────────────────────────────────────────────────────
# PHASE 5 — NextAuth endpoint probing
# Check for misconfigured auth endpoints, session leakage, CSRF bypass.
# ────────────────────────────────────────────────────────────────
phase5() {
  banner "Phase 5 — NextAuth endpoint audit"

  declare -a NEXTAUTH_ENDPOINTS=(
    "/api/auth/session"
    "/api/auth/csrf"
    "/api/auth/providers"
    "/api/auth/signin"
    "/api/auth/signout"
    "/api/auth/error"
    "/api/auth/callback/google"
    "/api/auth/_log"
  )

  for ep in "${NEXTAUTH_ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /tmp/nextauth_resp.txt -w "%{http_code}" "$TARGET$ep")
    BODY=$(cat /tmp/nextauth_resp.txt | head -c 200)
    echo "  $ep → $STATUS"
    echo "    body: $BODY"
    echo
  done
}

# ────────────────────────────────────────────────────────────────
# Run
# ────────────────────────────────────────────────────────────────
case "$PHASE" in
  phase1) phase1 ;;
  phase2) phase2 ;;
  phase3a) phase3a ;;
  phase3b) phase3b ;;
  phase3c) phase3c ;;
  phase4) phase4 ;;
  phase5) phase5 ;;
  all)
    phase1
    phase2
    phase3a
    phase3b
    phase3c
    phase4
    phase5
    banner "All phases complete — results in $OUT/"
    ;;
  *)
    echo "Usage: $0 [phase1|phase2|phase3a|phase3b|phase3c|phase4|phase5|all]"
    exit 1
    ;;
esac
