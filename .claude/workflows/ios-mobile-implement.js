export const meta = {
  name: 'ios-mobile-implement',
  description: 'Implement all iOS mobile audit findings across every component and page',
  phases: [
    { title: 'Implement', detail: 'Parallel fix clusters — each agent owns distinct files, no conflicts' },
    { title: 'Verify', detail: 'TypeScript check + count changes' },
  ],
}

// Each agent cluster owns a non-overlapping set of files.
// No worktrees needed since files never overlap between agents.

phase('Implement')

const ROOT = '/Users/i502042/Desktop/dcf-dashboard'

// ─── Cluster 1: globals.css + AppShellClient ─────────────────────────────────
// C-1: TopBar hidden behind Dynamic Island (safe-area-inset-top)
const c1 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files exactly as described. Read each file first, then edit.

━━━ FILE 1: ${ROOT}/app/globals.css ━━━
Find the .glass-toolbar class (or add it if missing). Add padding-top: env(safe-area-inset-top, 0px) to it.

Also find the .glass-bottom-nav class and confirm it already has padding-bottom for safe area (just verify, don't change if correct).

If .glass-toolbar doesn't exist yet, add this at the end of the utilities section:
\`\`\`css
.glass-toolbar {
  padding-top: env(safe-area-inset-top, 0px);
}
\`\`\`

━━━ FILE 2: ${ROOT}/components/layout/AppShellClient.tsx ━━━
Find the conditional className that uses 'pt-[88px]' and 'pt-[52px]' for the inner content area.

The current pattern is something like:
  stockNav ? 'pt-[88px] sm:pt-[52px]' : 'pt-[52px]'

We need these to account for safe-area-inset-top. But since Tailwind can't use env() in arbitrary values directly, use a CSS custom property approach.

In globals.css (already edited above), also add:
\`\`\`css
:root {
  --sat: env(safe-area-inset-top, 0px);
}
\`\`\`
(Add it inside the existing :root block if there is one, or as a new one)

Then in AppShellClient.tsx, change the pt padding approach: instead of Tailwind arbitrary value with env(), add an inline style to the content div:
Find the main content wrapper div that has the pt-[88px] or pt-[52px] class.
Change it to use style prop:
- For stock nav pages: style={{ paddingTop: 'calc(88px + env(safe-area-inset-top, 0px))' }} on mobile, with the sm: breakpoint handled by keeping sm:pt-[52px] but also needing the safe area...

Actually the simplest correct approach: remove the pt-[88px]/pt-[52px] Tailwind classes from the content wrapper and instead set paddingTop via inline style that always includes safe area:
  style={{ paddingTop: stockNav ? 'calc(88px + env(safe-area-inset-top, 0px))' : 'calc(52px + env(safe-area-inset-top, 0px))' }}

But watch out: the stockNav distinction may be inside className. Read the file carefully and make the minimal change that adds env(safe-area-inset-top, 0px) to the top padding on the main content wrapper.

Read both files, make the changes, verify the edits look correct.
`, { label: 'fix:globals+appshell', phase: 'Implement' })

// ─── Cluster 2: TopBar ────────────────────────────────────────────────────────
// C-4: search inputs <16px (auto-zoom), C-7: ticker autocorrect
// H-1: back/close-search button touch targets, H-2: tab row h-9→h-[44px]
const c2 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/layout/TopBar.tsx carefully, then make ALL of these changes:

FIX 1 — Search inputs trigger iOS zoom (C-4):
Find mobile search overlay input (around line 179). Change text-[14px] to text-[16px].
Find desktop/analyze search input (around line 455). Change text-[13px] to text-[16px] sm:text-[13px].

FIX 2 — Ticker search autocorrect (C-7):
Find all search/ticker input elements. Add these props: autoCorrect="off" autoCapitalize="characters" spellCheck={false}
The search is used for stock tickers like AAPL, NVDA — iOS tries to autocorrect them.

FIX 3 — Back button touch target too small (H-1):
Find the mobile back button (ChevronLeft icon button, around line 182-199).
It uses p-1 -ml-1 which gives ~24px. Change to: className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg -ml-2"

FIX 4 — Close-search button touch target (H-1):
Find the X/close button that dismisses the mobile search overlay.
Change p-1 to: className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"

FIX 5 — Stock tab row too short (H-2):
Find the mobile tab strip row container (around line 253) with h-9 (36px).
Change h-9 to h-[44px].
Also update AppShellClient padding if needed: if the stock nav height was calculated as 88px (52px header + 36px tabs = 88px), it needs to become 52px + 44px = 96px.
But be careful: only change AppShellClient if TopBar is also the file defining the combined height. If AppShellClient is a separate file, note this as a comment but don't edit that file here — it's in cluster 1.

Read the file, find each location precisely, make the changes. Do not break existing functionality.
`, { label: 'fix:topbar', phase: 'Implement' })

// ─── Cluster 3: LandingNavbar ─────────────────────────────────────────────────
// C-2: hidden behind Dynamic Island
const c3 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/landing/LandingNavbar.tsx carefully, then fix:

FIX 1 — Navbar hidden behind Dynamic Island (C-2):
The header is position:fixed top-0. It has pt-3 (12px) which is not enough for the Dynamic Island (~59px).
Find the outer <header> element.
Add or change to: style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}
Remove the pt-3 Tailwind class from the header (since we're handling it via style).

FIX 2 — Mobile menu dropdown offset (C-2 follow-up):
The mobile dropdown menu panel that appears below the navbar — find it.
It likely uses top-[88px] or similar. Change to:
style={{ top: 'calc(5.5rem + env(safe-area-inset-top, 0px))' }}
(5.5rem = 88px — the navbar height including the pt-3)

Read the file, locate the exact elements, make precise changes.
`, { label: 'fix:landing-navbar', phase: 'Implement' })

// ─── Cluster 4: ValuationCockpit ─────────────────────────────────────────────
// C-3: CTA hidden behind BottomNav
const c4 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/valuation/ValuationCockpit.tsx carefully, then fix:

FIX — "Edit assumptions" sticky CTA hidden behind BottomNav (C-3):
Find the sticky/fixed bottom CTA element (around lines 522-530).
It uses z-40 which is behind BottomNav's z-50.

Changes needed:
1. Change z-40 to z-[60] (above BottomNav)
2. The bottom padding needs to clear the 56px BottomNav + safe area.
   Find the element's padding-bottom or pb-* class and change to use inline style:
   style={{ paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px) + 12px)' }}
   OR if it's already using a style prop, merge this in.
3. Make sure this CTA is only shown on mobile (lg:hidden) — if it's visible on desktop too, that's fine since BottomNav is lg:hidden.

Read carefully, find the exact element, make the change.
`, { label: 'fix:valuation-cockpit', phase: 'Implement' })

// ─── Cluster 5: overflow-hidden pattern — valuation files ────────────────────
// C-5, H-15: SensitivityTable, ValuationLab, ValuationModelDrawer
const c5 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/valuation/SensitivityTable.tsx ━━━
FIX — overflow-hidden clips horizontal scroll (C-5):
Find the outer wrapper div around line 104 that has: rounded-xl ... overflow-hidden
This overflow-hidden prevents the inner overflow-x-auto table from scrolling on iOS Safari.
Remove overflow-hidden from this wrapper. border-radius works fine without it.
If needed for stacking context, add isolate instead.

━━━ FILE 2: ${ROOT}/components/valuation/ValuationLab.tsx ━━━
FIX 1 — overflow-hidden parent clips table (C-5):
Find the wrapper around line 1044 with overflow-hidden that wraps a scrollable table.
Remove overflow-hidden from it.

FIX 2 — Input font-size triggers iOS zoom (H-15):
Find select elements around line 171 with text-[12px].
Add style={{ fontSize: '16px' }} to each select/input element.
Find CAGR input around line 318 with text-[12px]. Add style={{ fontSize: '16px' }}.
Note: text-[12px] as a Tailwind class overrides the globals.css max(16px,1em) rule.

━━━ FILE 3: ${ROOT}/components/valuation/ValuationModelDrawer.tsx ━━━
FIX 1 — Close button touch target too small (H-4):
Find the close/dismiss button around line 306 that uses text × character with minimal padding.
Change to: className="min-h-[44px] min-w-[44px] flex items-center justify-center ..." (keep existing color/style classes)

FIX 2 — Assumption input triggers iOS zoom (H-5):
Find the number input around line 149 with text-[12px].
Add style={{ fontSize: '16px' }} to it.

Read each file, find precise locations, make changes.
`, { label: 'fix:valuation-files', phase: 'Implement' })

// ─── Cluster 6: Screener page ────────────────────────────────────────────────
// C-5: overflow-hidden, H-11: filter buttons, H-6: ScreenerChart
const c6 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/app/screener/page.tsx carefully, then fix:

FIX 1 — overflow-hidden clips table scroll (C-5, H-6):
Find the wrapper div around line 401 with: rounded-xl border border-slate-200 shadow-sm overflow-hidden
This wraps the WarrenTable which has overflow-auto inside.
Remove overflow-hidden. The rounded border still works without it.

FIX 2 — Filter toggle buttons too small (H-11):
Find the exchange filter buttons (around lines 316-327), cap tier buttons (around 380-395), and dividends toggle (around 331).
These use py-2 or similar giving ~36px height.
Change py-2 to py-2.5 min-h-[44px] on each filter button (or add min-h-[44px] to existing classes).

FIX 3 — Double top padding (M-4):
Find the page root div. If it has pt-[52px] applied directly (which stacks on AppShellInner's padding), remove it.
AppShellInner already handles top padding. Only remove if the page root itself has an explicit pt-[52px] that duplicates it.

FIX 4 — min-h-screen → min-h-dvh (M-6):
Find min-h-screen on the page root and change to min-h-dvh.

Read carefully, make precise minimal changes.
`, { label: 'fix:screener-page', phase: 'Implement' })

// ─── Cluster 7: Simplifier files ─────────────────────────────────────────────
// C-6: sticky tabs broken, H-8: overflow-hidden
const c7 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/simplifier/SimplifierTabBar.tsx ━━━
FIX — sticky position broken on iOS Safari (C-6):
iOS Safari: sticky inside overflow-hidden ancestor doesn't work.
The parent (in the page file) will have its overflow-hidden removed (separate fix).
Here, change the sticky offset:
Find: sticky top-0
Change to: sticky top-[52px]
(52px = height of the TopBar, so tabs stick just below the header)

━━━ FILE 2: ${ROOT}/app/simplifier/[ticker]/page.tsx ━━━
FIX — Parent overflow-hidden breaks sticky tabs (C-6):
Find the card/container div around line 145 with: rounded-2xl border ... overflow-hidden shadow-sm
Remove the overflow-hidden from it (the sticky tabs need a non-overflow-hidden ancestor).

━━━ FILE 3: ${ROOT}/app/simplifier/page.tsx ━━━
FIX 1 — overflow-hidden clips WatchlistTable scroll (H-8):
Find the outer card wrapper around line 63 with overflow-hidden.
Remove overflow-hidden.

FIX 2 — min-h-screen → min-h-dvh (M-6):
Find min-h-screen on the page root div and change to min-h-dvh.

Read each file carefully, make precise changes.
`, { label: 'fix:simplifier-files', phase: 'Implement' })

// ─── Cluster 8: ETF files ────────────────────────────────────────────────────
// C-5: ETFComparisonTable, M-3: double padding, ETFCompareContent
const c8 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/etf/ETFComparisonTable.tsx ━━━
FIX — overflow-hidden clips table scroll (C-5):
Find the outer wrapper div around line 47 with overflow-hidden.
This wraps the scrollable comparison table.
Remove overflow-hidden. Keep all other classes (rounded-*, border, etc.).

━━━ FILE 2: ${ROOT}/app/etf/[symbol]/page.tsx ━━━
FIX 1 — Double top padding (M-3):
Find the page root div around line 115 that has pt-[52px].
AppShellInner already provides top padding. Remove the pt-[52px] from the page root.
Also remove bg-[#F1F5F9] if it was only there as a debug/override style (check if it's intentional — if it's a background color override, keep it; if it duplicates the shell background, remove it).
Only remove pt-[52px], that's the critical one.

FIX 2 — min-h-screen → min-h-dvh (M-6):
Change any min-h-screen to min-h-dvh on this page.

━━━ FILE 3: ${ROOT}/app/etf/compare/ETFCompareContent.tsx ━━━
FIX — overflow-hidden clips ETFComparisonTable scroll (C-5):
Find the wrapper div that contains ETFComparisonTable.
If it has overflow-hidden, remove it.

Read each file, make precise changes.
`, { label: 'fix:etf-files', phase: 'Implement' })

// ─── Cluster 9: Strategy/Strategies pages ────────────────────────────────────
// C-5: overflow-hidden, M-4: double padding, M-5: webkit, M-8: buttons
const c9 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/app/strategy/page.tsx ━━━
FIX 1 — overflow-hidden clips StrategyScreeningTable (H-12, C-5):
Find the card wrapper around lines 197-204 with overflow-hidden that wraps StrategyScreeningTable.
Remove overflow-hidden.

FIX 2 — Remove deprecated -webkit-overflow-scrolling (M-5):
Find all instances of [-webkit-overflow-scrolling:touch] class or style.
Remove them entirely. Replace with overscroll-x-contain where scroll chaining prevention is needed.

FIX 3 — Strategy close button touch target (M-8):
Find the close button around lines 227-258 for the strategy detail panel.
Add min-h-[44px] min-w-[44px] flex items-center justify-center to it.

FIX 4 — Strategy aside panel safe area (M-8):
Find the overflow-y-auto aside/panel div.
Add pb-safe-nav to it (this utility is defined in globals.css).

FIX 5 — min-h-screen → min-h-dvh (M-6):
Find any min-h-screen and change to min-h-dvh.

━━━ FILE 2: ${ROOT}/app/strategies/page.tsx ━━━
FIX 1 — Remove deprecated -webkit-overflow-scrolling (M-5):
Remove all [-webkit-overflow-scrolling:touch] classes.

FIX 2 — Double top padding (M-4):
If the page root has pt-[52px], remove it (AppShellInner handles this).

FIX 3 — min-h-screen → min-h-dvh (M-6):
Change min-h-screen to min-h-dvh.

━━━ FILE 3: ${ROOT}/components/strategy/StrategyScreeningTable.tsx ━━━
FIX — Remove deprecated -webkit-overflow-scrolling (M-5):
Find and remove [-webkit-overflow-scrolling:touch] around line 132.

Read each file, make precise changes.
`, { label: 'fix:strategy-files', phase: 'Implement' })

// ─── Cluster 10: Factor ranking page ─────────────────────────────────────────
// C-5: overflow-hidden
const c10 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/app/factor-ranking/page.tsx carefully, then fix:

FIX 1 — overflow-hidden clips WarrenTable scroll (C-5):
Find the wrapper around line 254 that has overflow-hidden and contains the WarrenTable/data table.
Remove overflow-hidden.

FIX 2 — min-h-screen → min-h-dvh (M-6):
Find any min-h-screen and change to min-h-dvh.

Read the file, make precise minimal changes.
`, { label: 'fix:factor-ranking', phase: 'Implement' })

// ─── Cluster 11: Modelling files ──────────────────────────────────────────────
// H-15: font-size on inputs
const c11 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/modelling/ForecastTable.tsx ━━━
FIX — Input font-size triggers iOS zoom (H-15):
Find all input/select elements with text-xs or text-[12px] or text-[13px] classes (around lines 191-201, 897, 934).
For each interactive input/select element, add style={{ fontSize: '16px' }}.
This prevents iOS Safari from zooming the viewport when the user taps an input.
Note: Do NOT change font size for non-interactive display cells, only actual <input> and <select> elements.

━━━ FILE 2: ${ROOT}/components/modelling/AssumptionPanel.tsx ━━━
FIX — Input font-size triggers iOS zoom (H-15):
Find input/select elements around line 63 with text-[13px] or text-xs.
Add style={{ fontSize: '16px' }} to each <input> and <select>.

Read each file, make precise changes.
`, { label: 'fix:modelling-files', phase: 'Implement' })

// ─── Cluster 12: Stock components ────────────────────────────────────────────
// H-9: AssumptionSlider, H-10: StockUpgradeWall, H-7: FinancialStatements
const c12 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/stock/AssumptionSlider.tsx ━━━
FIX — Range input thumb too small to tap (H-9):
Find the range input container div around line 73.
Wrap or modify the container to add py-3 so the tappable area is ~44px tall:
Change: <div className="relative ...">
To: <div className="relative py-3">
(The py-3 expands the touch area without visually changing the slider)

━━━ FILE 2: ${ROOT}/components/stock/StockUpgradeWall.tsx ━━━
FIX — "Have a code?" and "Go back" buttons too small (H-10):
Find both small text buttons around lines 124-137.
Add min-h-[44px] px-3 inline-flex items-center to each.

━━━ FILE 3: ${ROOT}/components/stock/FinancialStatements.tsx ━━━
FIX — overflow-hidden ancestor breaks sticky columns (H-7, C-5):
Find any overflow-hidden wrapper around lines 200-208 that is an ancestor of the table's overflow-x-auto container.
Sticky left-0 cells on iOS Safari stop working if any ancestor has overflow-hidden.
Remove overflow-hidden from the card wrapper (keep rounded-* and border classes).

Read each file, make precise changes.
`, { label: 'fix:stock-components', phase: 'Implement' })

// ─── Cluster 13: Auth/Modals ──────────────────────────────────────────────────
// H-4: close button touch targets
const c13 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/auth/LoginModal.tsx ━━━
FIX — Close button touch target ~26px (H-4):
Find the close button around line 62 with p-1 rounded-lg.
Change p-1 to: min-h-[44px] min-w-[44px] flex items-center justify-center
Keep rounded-lg and color classes.

━━━ FILE 2: ${ROOT}/components/monetization/PaywallModal.tsx ━━━
FIX — Close button touch target too small (H-4):
Find the close button around line 47.
Same fix: add min-h-[44px] min-w-[44px] flex items-center justify-center.

━━━ FILE 3: ${ROOT}/components/valuation/ShareCardModal.tsx ━━━
FIX — Close button w-7 h-7 = 28px (H-4):
Find the close button around line 157 with w-7 h-7.
Change to w-11 h-11 (44px).

Read each file, find precise locations, make changes.
`, { label: 'fix:auth-modals', phase: 'Implement' })

// ─── Cluster 14: Charts ───────────────────────────────────────────────────────
// M-1: period selector buttons, H-15: font-size
const c14 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/charts/MultiTickerChart.tsx ━━━
FIX 1 — Period selector buttons too small (M-1):
Find period toggle buttons around lines 361-393 with py-0.5 or py-1.
Change py-0.5 or py-1 to py-2.5 to make them ~40-44px tall.
If the buttons already have min-h, just ensure min-h-[44px].

FIX 2 — Chart fontSize below 16px (H-15):
Find any input element with fontSize: 11 around line 121 or text-xs/text-[NNpx].
Add style={{ fontSize: '16px' }} to interactive inputs. Non-interactive chart labels are fine.

━━━ FILE 2: ${ROOT}/components/stock/PriceChart.tsx ━━━
FIX — Period selector buttons too small (M-1):
Find period/timeframe toggle buttons around lines 468-473 and 523-535.
These likely use py-1 or p-1. Change to py-2.5 min-h-[44px].

━━━ FILE 3: ${ROOT}/components/markets/InstrumentPriceChart.tsx ━━━
FIX — Period selector buttons too small (M-1):
Find buttons around lines 110-121.
Change py-0.5 or py-1 to py-2.5 min-h-[44px].

━━━ FILE 4: ${ROOT}/components/valuation/cockpit/ValuationMethodCards.tsx ━━━
FIX — Period/metric toggle buttons too small (M-1):
Find toggle buttons around lines 367-374.
Change py-1 to py-2.5 min-h-[44px].

Read each file, make precise minimal changes.
`, { label: 'fix:chart-components', phase: 'Implement' })

// ─── Cluster 15: Markets components ──────────────────────────────────────────
// M-5: webkit, M-7: calendar overflow, M-9: safe area, M-4: double padding
const c15 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/components/home/MarketMonitor.tsx ━━━
FIX 1 — Remove deprecated -webkit-overflow-scrolling (M-5):
Find and remove all [-webkit-overflow-scrolling:touch] around lines 254 and 293.

FIX 2 — ChartPanel footer safe area (M-9):
Find the ChartPanel footer div around line 110.
Add safe area bottom padding: change pb-* to style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}

━━━ FILE 2: ${ROOT}/components/markets/EconomicCalendar.tsx ━━━
FIX — Grid rows crush on narrow screens (M-7):
Find the grid container around lines 76-84 with gridTemplateColumns inline style or Tailwind grid classes.
Wrap the grid rows in an outer div with: className="overflow-x-auto"
And give the inner grid a min-width: style={{ minWidth: '480px' }}
This enables horizontal scrolling instead of column crushing on mobile.

━━━ FILE 3: ${ROOT}/components/markets/EarningsCalendar.tsx ━━━
FIX — Same grid crushing issue (M-7):
Find the calendar grid around lines 84-108.
Apply same fix: wrap in overflow-x-auto div with min-width: 480px on the inner grid.

━━━ FILE 4: ${ROOT}/app/markets/page.tsx ━━━
FIX 1 — Double top padding (M-4):
Find the page root div. If it has pt-[52px] directly on the root div, remove it.

FIX 2 — min-h-screen → min-h-dvh (M-6):
Change any min-h-screen to min-h-dvh.

Read each file, make precise minimal changes.
`, { label: 'fix:markets-files', phase: 'Implement' })

// ─── Cluster 16: InfoTooltip ──────────────────────────────────────────────────
// H-13: touch target + tap handler
const c16 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/ui/info-tooltip.tsx carefully, then fix:

FIX — Tooltip trigger is 14×14px and hover-only (H-13):
On iOS Safari, :hover never fires. Tooltips must also respond to touch/click.

Current issue: the trigger button uses w-3.5 h-3.5 (14px) — way below 44px.

Fix approach:
1. Add a click/touch handler to toggle the tooltip on mobile.
   The tooltip is likely using Radix UI TooltipTrigger or similar.
   If using Radix Tooltip, change to: <Tooltip open={open} onOpenChange={setOpen}>
   And add 'use client' + useState if not already present.

2. Expand the touch target using a pseudo-element approach:
   Change the trigger button className to include:
   "relative after:absolute after:inset-[-13px] after:content-['']"
   This keeps the visual size but expands the hit area to ~40px without layout shift.

Actually if this is a Radix Tooltip, the simplest iOS fix is to ensure the Tooltip has:
   disableHoverableContent={false}
And wrap trigger with onClick to toggle open state.

Read the file, understand the current implementation, then make the minimal change that:
a) Expands the touch area
b) Makes it respond to tap on iOS

`, { label: 'fix:info-tooltip', phase: 'Implement' })

// ─── Cluster 17: App pages — pagination + misc ────────────────────────────────
// M-2: pagination, M-6: min-h-screen, H-15: font-size inputs
const c17 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Fix these files:

━━━ FILE 1: ${ROOT}/app/valuations/page.tsx ━━━
FIX 1 — Pagination buttons too small (M-2):
Find chevron/arrow pagination buttons around lines 444-465.
Change p-1.5 or min-h-[36px] to min-h-[44px] min-w-[44px] flex items-center justify-center.

FIX 2 — Input font-size triggers iOS zoom (H-15):
Find input/select elements around lines 480, 757, 766 with text-[12px].
Add style={{ fontSize: '16px' }} to each.

FIX 3 — min-h-screen → min-h-dvh (M-6):
Change min-h-screen to min-h-dvh.

━━━ FILE 2: ${ROOT}/app/trading/page.tsx ━━━
FIX — Input font-size triggers iOS zoom (H-15):
Find inputs around lines 219 and 519 with text-sm or text-xs.
Add style={{ fontSize: '16px' }} to interactive input/select elements only.

━━━ FILE 3: ${ROOT}/app/analyze/page.tsx ━━━
FIX 1 — overflow-hidden clips table (C-5):
Find wrapper around line 555 (MarketPricingLeaderboard outer section) with overflow-hidden.
If it wraps a scrollable table/list, remove overflow-hidden.

FIX 2 — min-h-screen → min-h-dvh (M-6):
Change any min-h-screen to min-h-dvh.

━━━ FILE 4: ${ROOT}/app/compare/page.tsx ━━━
FIX — min-h-screen → min-h-dvh (M-6):
Change min-h-screen to min-h-dvh.

Read each file, make precise changes. Only change what's described.
`, { label: 'fix:app-pages', phase: 'Implement' })

// ─── Cluster 18: Screener WarrenTable pagination ──────────────────────────────
// M-2: pagination buttons
const c18 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/screener/WarrenTable.tsx carefully, then fix:

FIX — Pagination buttons too small (M-2):
Find pagination chevron buttons around lines 231-246.
These use p-1 or p-1.5 giving 26-32px.
Change to: min-h-[44px] min-w-[44px] flex items-center justify-center
Keep existing rounded-* and color classes.

Also check if there are any text inputs in this component. If so, add style={{ fontSize: '16px' }} to prevent iOS zoom.

Read the file, make precise changes.
`, { label: 'fix:warren-table', phase: 'Implement' })

// ─── Cluster 19: SectorPerformanceCard ───────────────────────────────────────
// Quick win QW-6 from audit
const c19 = async () => agent(`
You are implementing iOS mobile fixes for the insic Next.js dashboard.
Read ${ROOT}/components/markets/SectorPerformanceCard.tsx carefully, then fix:

FIX — "show all" button too small (Quick Win):
Find the show-all / expand button around line 78.
It uses text-[11px] with no explicit min-height.
Add: min-h-[44px] flex items-center to the button.

Read the file, find the button, make the change.
`, { label: 'fix:sector-card', phase: 'Implement' })

// ─── Run all clusters in parallel ────────────────────────────────────────────
log('Starting all 19 fix clusters in parallel...')

const results = await parallel([
  c1, c2, c3, c4, c5, c6, c7, c8, c9, c10,
  c11, c12, c13, c14, c15, c16, c17, c18, c19,
])

const succeeded = results.filter(Boolean).length
log(`${succeeded}/19 clusters completed successfully`)

// ─── Verify ───────────────────────────────────────────────────────────────────
phase('Verify')

const verification = await agent(`
Run a TypeScript type-check on the insic dashboard project to verify the iOS fixes didn't break anything.

Run: cd ${ROOT} && npx tsc --noEmit 2>&1 | head -80

If there are errors, report them precisely (file, line, message).
If clean, say "TypeScript: no errors".

Also run: cd ${ROOT} && git diff --stat | head -40
To show which files were changed and a line-count summary.

Report the results.
`, { label: 'verify:tsc', phase: 'Verify' })

return { clustersCompleted: succeeded, verification }
