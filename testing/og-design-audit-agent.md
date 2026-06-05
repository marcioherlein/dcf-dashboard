# OG Image Design Audit Agent

## Purpose

Audit the share card image routes (`/api/og` and `/api/og/square`) to confirm they stay visually consistent with the insic app design system. Catches regressions when brand tokens, verdict colors, or layout change.

Run any time you edit an OG route, update `lib/brand.ts`, or add a new verdict / color.

---

## Usage

```
/audit-og [TICKER]
```

If no ticker is supplied, use `MSFT` as the default. The agent renders both card formats against a live dev server and audits the output.

---

## Setup

Before running the checks, ensure the dev server is running:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000
```

If it returns anything other than `200`, start it:

```bash
npm run dev &
sleep 8
```

Read these files in full before running any checks:

- `lib/brand.ts` — source of truth for all design tokens (`BRAND`, `VERDICT_DISPLAY`)
- `app/api/og/route.tsx` — landscape card (1200×630)
- `app/api/og/square/route.tsx` — square card (1080×1080)

---

## Phase 1 — Static Source Audit

Before rendering anything, audit the source code directly.

### 1A. Brand token import

Check that both routes import `BRAND` from `@/lib/brand`:

```bash
grep "BRAND" app/api/og/route.tsx app/api/og/square/route.tsx
```

**Pass:** Both files import and use `BRAND`.
**Fail:** Either file uses hardcoded hex values for colors that exist as `BRAND.*` constants. List every offending line with its hardcoded value and which `BRAND` key it should reference.

The exhaustive list of `BRAND` constants to enforce:
- `BRAND.olive700` (`#5F790B`) — primary accent, dot grid, glows, conviction badge, MIG bar, scenario dot, blended card highlight
- `BRAND.olive600` (`#6F8F12`) — may appear as a hover/lighter variant
- `BRAND.olive100` (`#EEF4DD`) — text on olive-tinted backgrounds
- `BRAND.ink900` (`#0A1424`) — card background start
- `BRAND.ink800` (`#111C2E`) — card background mid
- `BRAND.positive` (`#11875D`) — positive upside, bull scenario, method upside
- `BRAND.negative` (`#D83B3B`) — negative downside, bear scenario
- `BRAND.blue600` (`#2563EB`) — **not** the primary accent; should appear nowhere in decorative chrome. Acceptable only in fallback logo text if the logo PNG fails to load AND the design explicitly calls for a blue fallback.

Flag any usage of bare `rgba(37,99,235,...)` or `#2563EB` or `#3B82F6` in decorative positions (backgrounds, borders, glows, dots). These are pre-rebrand blue values.

### 1B. Verdict color routing

Check that `vd.colorHex` from `VERDICT_DISPLAY` is used for every verdict-colored element:

- Top accent bar
- Verdict word text
- Secondary glow (bottom-left)
- Model-assumed growth figure in MIG callout
- Scenario dot border on the bar (should be `BRAND.olive700`, NOT `vd.colorHex` — it represents the blended base, not the verdict)

**Pass:** The above elements reference `vd.colorHex` or `BRAND.olive700` as appropriate.
**Fail:** Any verdict-colored element uses a hardcoded hex. List the line and the correct reference.

### 1C. Background gradient

Confirm both routes build the background gradient from `BRAND.ink900` and `BRAND.ink800`:

```
background: `linear-gradient(…,${BRAND.ink900} 0%,${BRAND.ink800} …%,#091525 100%)`
```

The `#091525` terminal stop is intentionally darker than `BRAND.ink800` and has no named constant — this is acceptable.

**Pass:** Gradient uses `BRAND.ink900` and `BRAND.ink800`.
**Fail:** Gradient uses hardcoded `#050D1F` or `#0A1628` (pre-rebrand values). Flag both.

### 1D. Upside / downside colors

Confirm:
- Positive upside uses `BRAND.positive` (not `#10B981` or `#22C55E`)
- Negative downside uses `BRAND.negative` (not `#EF4444` or `#DC2626`)

These apply to: upside badge text color, upside badge background (as an alpha-suffixed variant like `${BRAND.positive}22`), method upside text, bear/bull scenario label text.

### 1E. `@vercel/og` compatibility

Check for CSS properties that `@vercel/og` does not support. Known unsupported values:
- `width: 'fit-content'` — use a fixed width or omit the property
- `marginTop: 'auto'` in flex columns — pin with `position: 'absolute'` instead
- `gap` shorthand in non-flex contexts

```bash
grep -n "fit-content\|marginTop.*auto" app/api/og/route.tsx app/api/og/square/route.tsx
```

**Pass:** No unsupported values found.
**Fail:** List the file, line, property, and suggested fix.

---

## Phase 2 — Rendered Image Audit

Render both cards for the given ticker and visually inspect the output.

### 2A. Build the render URL

Construct a realistic test URL. Use the ticker supplied, or MSFT defaults:

```
TICKER=MSFT
METHODS='[{"label":"Forward P/E","fv":507.12},{"label":"EV/EBITDA","fv":498.44},{"label":"Revenue Multiple","fv":531.20}]'
ENCODED=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$METHODS")

LANDSCAPE="http://localhost:3000/api/og?ticker=${TICKER}&name=Microsoft+Corp&price=428.05&fv=518.53&upside=0.211&bear=488.90&bull=571.46&currency=USD&verdict=Undervalued&conviction=Moderate+confidence&methods=${ENCODED}&mig=0.082&migAssumed=0.14"

SQUARE="http://localhost:3000/api/og/square?ticker=${TICKER}&name=Microsoft+Corp&price=428.05&fv=518.53&upside=0.211&bear=488.90&bull=571.46&currency=USD&verdict=Undervalued&conviction=Moderate+confidence&methods=${ENCODED}&mig=0.082&migAssumed=0.14"
```

If the ticker is not MSFT, call `GET /api/financials?ticker={TICKER}` first and extract: `price`, `blendedFairValue`, `upsidePct`, `scenarios.bear.fairValue`, `scenarios.bull.fairValue`, `verdict`, `divergence.overallConfidence`, and the top 3 `methods[]` to build a real URL.

### 2B. Render and check HTTP status

```bash
curl -s -o /tmp/og-landscape.png -w "%{http_code}" "$LANDSCAPE"
curl -s -o /tmp/og-square.png    -w "%{http_code}" "$SQUARE"
```

**Pass:** Both return `200` and produce a non-empty PNG.
**Fail:** Non-200 status or zero-byte file. Read the last 30 lines of the dev server log for the error.

### 2C. Visual inspection checklist

Read both `/tmp/og-landscape.png` and `/tmp/og-square.png` using the image read tool. For each card, verify:

| Check | What to look for | Pass condition |
|---|---|---|
| Background | Dark navy — no pure black, no off-white | Gradient visible |
| Accent bar | Top edge, colored by verdict (olive for Undervalued) | Present, correct color |
| Logo | insic logo visible in top-left | Logo rendered (not fallback text) |
| Conviction badge | Top-right, olive-tinted pill | Olive background/border, NOT blue |
| Verdict headline | Ticker bold white, "looks" muted, verdict word in verdict color | Colors correct |
| Upside badge | Colored background matching upside direction | Green bg for positive |
| Model consensus | 3 method cards + Blended card with olive tint | Olive tint on Blended, NOT blue |
| MIG callout | Olive-bordered box with olive left bar | Olive, NOT blue |
| Scenario bar | Red-to-green gradient, white dot with olive border | Dot border olive |
| Footer | Separator line, disclaimer and site URL | Present |

**Pass:** All checks green.
**Fail:** For any visual regression, describe exactly which element is wrong and what color it actually shows vs what it should show. Include a description of the location on the card.

### 2D. Overvalued / Insufficient Data smoke test

Render one additional card for each alternate verdict to verify verdict-color routing:

```bash
# Overvalued
curl -s -o /tmp/og-overvalued.png -w "%{http_code}" \
  "http://localhost:3000/api/og?ticker=TEST&price=100&fv=70&upside=-0.30&verdict=Overvalued&currency=USD"

# Insufficient Data  
curl -s -o /tmp/og-insufficient.png -w "%{http_code}" \
  "http://localhost:3000/api/og?ticker=TEST&price=100&verdict=Insufficient+Data&currency=USD"
```

Read both images. Verify:
- Overvalued: accent bar and verdict word are red (`BRAND.negative` = `#D83B3B`)
- Insufficient Data: accent bar and verdict word are slate (`#64748B`)

**Pass:** Colors match expected verdict palette.
**Fail:** Verdict colors swapped or incorrect — likely a `VERDICT_DISPLAY` mapping issue in `lib/brand.ts`.

---

## Phase 3 — Brand Drift Prevention Checklist

These are forward-looking questions to catch future regressions before they happen.

### 3A. Are new hardcoded values creeping in?

```bash
grep -n "#[0-9a-fA-F]\{6\}" app/api/og/route.tsx app/api/og/square/route.tsx \
  | grep -v "white\|#09152\|#64748B\|#94A3B8\|#475569\|#334155"
```

Any hex not in the above exclusion list (neutral grays and the intentionally-constant dark stop) should either be a `BRAND.*` reference or explicitly justified. Flag all matches.

### 3B. Does `lib/brand.ts` export `BRAND`?

```bash
grep "^export const BRAND" lib/brand.ts
```

**Pass:** Found.
**Fail:** `BRAND` was renamed or removed — the OG routes will break at build time. Check git log for the change.

### 3C. Are all four `VERDICT_DISPLAY` entries covered?

Confirm `VERDICT_DISPLAY` in `lib/brand.ts` has entries for all four keys:
`'Undervalued'`, `'Fairly Valued'`, `'Overvalued'`, `'Insufficient Data'`

The OG routes fall back to `'Insufficient Data'` for unknown verdicts — if a new verdict is added to the app without adding it to `VERDICT_DISPLAY`, cards will silently show the wrong color.

---

## Reporting

Produce a single summary block after all phases complete:

```
## OG Image Design Audit — [TICKER] — [date]

### Phase 1 — Source
- 1A Brand tokens:   PASS / FAIL — [details]
- 1B Verdict colors: PASS / FAIL — [details]
- 1C Background:     PASS / FAIL — [details]
- 1D Upside colors:  PASS / FAIL — [details]
- 1E OG compat:      PASS / FAIL — [details]

### Phase 2 — Rendered
- 2B HTTP status:         PASS / FAIL
- 2C Visual (landscape):  PASS / FAIL — [any failing checks]
- 2C Visual (square):     PASS / FAIL — [any failing checks]
- 2D Verdict smoke:       PASS / FAIL

### Phase 3 — Drift prevention
- 3A Hardcoded hex:     PASS / FAIL — [count + list]
- 3B BRAND export:      PASS / FAIL
- 3C Verdict coverage:  PASS / FAIL

### Overall: PASS / FAIL
[If any FAIL: list the specific files and lines to fix, in priority order]
```

Do not mark PASS on any check that has outstanding findings. One FAIL anywhere means Overall FAIL.
