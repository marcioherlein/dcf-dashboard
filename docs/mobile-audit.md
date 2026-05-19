# Mobile Audit — DCF Dashboard Stock Pages

**Date:** 2026-05-19  
**Scope:** `/stock/[ticker]` pages + shared layout components  
**Tickers tested:** VIST, AAPL, TSLA, NVDA, MSFT, MELI, GGAL, JPM, XOM

---

## Viewports Tested

| Viewport | Browser | Notes |
|---|---|---|
| 320 × 568 | Chrome (iPhone SE emulation) | Smallest supported |
| 375 × 667 | Chrome / Safari WebKit | iPhone 8 |
| 390 × 844 | Chrome / Safari WebKit | iPhone 14 |
| 414 × 896 | Chrome | iPhone 11 Pro Max |
| 430 × 932 | Chrome | iPhone 15 Pro Max |

---

## Issues Found

### ISSUE-01 — TabNav sticks at `top-0`, hidden behind TopBar
**Severity:** Critical  
**Affects:** Chrome, Safari, all viewports  
**Component:** `components/stock/TabNav.tsx`  
**Root cause:** `sticky top-0 z-20`. The TopBar is `fixed top-0 z-40` at 52px height. When the user scrolls past the breadcrumb, the tab bar sticks at `top: 0`, which places it behind the TopBar. All 5 tabs become invisible until the TopBar is cleared.  
**Fix:** Change to `sticky top-[52px] z-20`.

---

### ISSUE-02 — AppShell top padding shortfall (4px content bleeds under TopBar)
**Severity:** Critical  
**Affects:** Chrome, Safari, all viewports  
**Component:** `components/layout/AppShell.tsx`  
**Root cause:** `pt-12` = 48px, but TopBar height is 52px (explicit inline style). Top 4px of page content is hidden behind the TopBar.  
**Fix:** Change `pt-12` to `pt-[52px]`.

---

### ISSUE-03 — BottomNav safe-area clearance insufficient on iPhone 12+
**Severity:** Critical  
**Affects:** Safari on iPhone 12/13/14/15 (home-indicator devices)  
**Component:** `components/layout/AppShell.tsx`, `components/layout/BottomNav.tsx`  
**Root cause:** AppShell applies `pb-16` (64px) as bottom clearance for the BottomNav. BottomNav is `h-14` (56px) + `padding-bottom: env(safe-area-inset-bottom)`. On iPhone 12+ with home indicator, `env(safe-area-inset-bottom) ≈ 34px`, making the nav 90px tall. Content gets hidden behind the bottom 26px of the nav bar.  
**Fix:** Replace `pb-16 lg:pb-0` with a CSS utility class that uses `calc(4rem + env(safe-area-inset-bottom, 0px))`, applied only on mobile.

---

### ISSUE-04 — Search input triggers iOS Safari auto-zoom (font-size < 16px)
**Severity:** Critical (user experience degradation on every search)  
**Affects:** Safari iOS, all viewports  
**Component:** `components/layout/TopBar.tsx`  
**Root cause:** `<input className="... text-[13px] ..." />`. iOS Safari auto-zooms the page when an input with `font-size < 16px` receives focus, causing a jarring layout shift.  
**Fix:** Change input font size to `text-[16px]` (16px prevents iOS zoom).

---

### ISSUE-05 — Compare input triggers iOS Safari auto-zoom (font-size 11px)
**Severity:** Critical  
**Affects:** Safari iOS  
**Component:** `components/stock/PriceChart.tsx`  
**Root cause:** `<input className="text-[11px] ..." />` for the compare ticker input. Same iOS zoom issue.  
**Fix:** Change to `text-[16px]` on the input.

---

### ISSUE-06 — AuthBanner overlaps TabNav when both are sticky
**Severity:** High  
**Affects:** Chrome, Safari — signed-out users on 2nd+ page view  
**Component:** `components/auth/AuthBanner.tsx`  
**Root cause:** `sticky top-[52px] z-10`. When TabNav (height ~43px) is also sticky at `top-[52px]`, they occupy the same vertical space. TabNav wins (z-20 > z-10) but the AuthBanner renders directly on top of the TabNav visually.  
**Fix:** Change to `sticky top-[95px] z-[19]` (52px TopBar + 43px TabNav = 95px).

---

### ISSUE-07 — PriceChart valuation label SVG overflow on narrow viewports
**Severity:** High  
**Affects:** Chrome, Safari — viewports ≤ 390px, when valuation reference lines exist  
**Component:** `components/stock/PriceChart.tsx`  
**Root cause:** When `hasAnyLine = true`, `rightMargin = 96`. The `PriceTag` SVG label renders at `x + chartAreaWidth + 6`. Label text width is up to ~100px. On a 360px screen: chart container ≈ 328px, after YAxis (50px) + rightMargin (96px) = chart area 182px. Label starts at 50+182+6=238px, ends at 238+100=338px > 328px SVG width → 10px overflow causes page-level horizontal scroll.  
**Fix:** On mobile viewports, reduce rightMargin to 8px and replace inline SVG labels with a compact legend row below the period selector. Show full inline labels only on sm+ screens.

---

### ISSUE-08 — `min-h-screen` (100vh) causes layout jump on iOS Safari
**Severity:** High  
**Affects:** Safari iOS  
**Component:** `components/layout/AppShell.tsx`, `app/stock/[ticker]/page.tsx`  
**Root cause:** `min-h-screen` = `min-height: 100vh`. On iOS Safari, `100vh` is the full viewport height including the collapsible address bar. When the address bar collapses (user scrolls), the actual visible area grows but `100vh` does not update, causing blank space or layout shift at the bottom.  
**Fix:** Replace `min-h-screen` with `min-h-dvh` (dynamic viewport height, supported Safari 15.4+).

---

### ISSUE-09 — PriceChart indicator toggle buttons: touch targets too small
**Severity:** Medium  
**Affects:** Chrome, Safari — touch devices  
**Component:** `components/stock/PriceChart.tsx`  
**Root cause:** MA indicator toggle buttons: `rounded px-2 py-0.5 text-[10px]` → ~20px tall. Sub-panel buttons: same. Period selector: `rounded-lg px-3 py-1 text-xs` → ~28px tall. All below the 44px recommended minimum touch target.  
**Fix:** On mobile, use `py-2` for indicator toggles and period buttons to reach ~36px. For the sub-panel toggles, use `py-1.5`.

---

### ISSUE-10 — FinancialStatements tab labels overflow on 320px screens
**Severity:** Medium  
**Affects:** Chrome, Safari — iPhone SE (320px)  
**Component:** `components/stock/FinancialStatements.tsx`  
**Root cause:** Tab group holds three buttons: "Income Statement" (14 chars), "Balance Sheet" (13 chars), "Cash Flow" (9 chars) in `px-3 py-1.5 text-xs`. Total required ≈ 284px. Available on iPhone SE after `px-6` card padding: 272px → wraps/overflows.  
**Fix:** Show abbreviated labels on mobile: "Income" / "Balance" / "Cash Flow" with `<span class="sm:hidden">` variants.

---

### ISSUE-11 — Dismiss button in AuthBanner too small for touch
**Severity:** Low  
**Affects:** Touch devices  
**Component:** `components/auth/AuthBanner.tsx`  
**Root cause:** `<button>` wrapping `<X size={16} />` with no padding → 16×16px target.  
**Fix:** Add `p-2` to the button for a 40×40px touch area.

---

### ISSUE-12 — `100vw` risk: no identified explicit `100vw` overflow, but fixed-width labels
**Severity:** Low  
**Affects:** Narrow viewports  
**Note:** No `width: 100vw` found in stock page components. Overflow is localized to PriceChart SVG (Issue-07). Page-level horizontal scroll is only triggered by that issue.

---

## Components Changed

| File | Issues Fixed |
|---|---|
| `app/globals.css` | ISSUE-03 (safe-area utility), ISSUE-08 (dvh support) |
| `components/layout/AppShell.tsx` | ISSUE-02, ISSUE-03, ISSUE-08 |
| `components/stock/TabNav.tsx` | ISSUE-01 |
| `components/auth/AuthBanner.tsx` | ISSUE-06, ISSUE-11 |
| `components/layout/TopBar.tsx` | ISSUE-04 |
| `components/stock/PriceChart.tsx` | ISSUE-05, ISSUE-07, ISSUE-09 |
| `components/stock/FinancialStatements.tsx` | ISSUE-10 |
| `app/stock/[ticker]/page.tsx` | ISSUE-08 |

---

## How to Verify Locally

1. Start dev server: `npm run dev`
2. Open Chrome DevTools → Toggle Device Toolbar (Cmd+Shift+M)
3. Test each viewport: 320×568, 375×667, 390×844
4. Navigate to `/stock/VIST`, `/stock/AAPL`, `/stock/NVDA`

**Check ISSUE-01 (TabNav):** Scroll slowly on any stock page. Tab bar should always remain visible just below the top nav bar — never disappear.

**Check ISSUE-02/03 (padding):** Verify no content bleeds under top bar; verify bottom content not hidden behind bottom nav on a real iPhone (use Safari via USB or BrowserStack).

**Check ISSUE-04/05 (iOS zoom):** On iOS Safari (real device or Simulator), tap the search field in the top bar. Page should NOT zoom. Tap the "Compare" input in the price chart. No zoom.

**Check ISSUE-07 (chart overflow):** In Chrome mobile emulation at 375px, open `/stock/NVDA`. Verify no horizontal page scroll. The price chart should show valuation lines but labels appear in a compact legend row above the chart, not overflowing the right edge.

**Check ISSUE-10 (tab labels):** At 320px emulation in Financials tab, verify "Income" / "Balance" / "Cash Flow" fit without wrapping.

---

## Remaining Known Limitations

- `ValuationLab` (Valuation tab) was not fully audited — it has complex slider and chart layouts that may need a separate pass.
- Financial tables intentionally require horizontal scroll on mobile (correct behavior — scroll is contained inside `overflow-x-auto` wrapper).
- The compare ticker feature in PriceChart is desktop-oriented; on mobile the input is functional but not optimized UX.
