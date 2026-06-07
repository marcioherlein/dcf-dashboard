# insic UI Migration Log

**Started:** 2026-06-07  
**Status:** Gates 1–3 complete. Gate 4 (route migration) in progress.

---

## Files Changed

### New files created
| File | Purpose |
|---|---|
| `docs/ui-audit.md` | Complete repository UI audit |
| `docs/design-system.md` | Canonical design system specification |
| `docs/ui-migration-log.md` | This file |
| `components/ui/metric-card.tsx` | Canonical MetricCard component |
| `components/ui/verdict-card.tsx` | Canonical VerdictCard (replaces 4 duplicate implementations) |
| `components/ui/page-container.tsx` | Canonical PageContainer with max-width variants |
| `components/ui/page-header.tsx` | Canonical PageHeader with h1, subtitle, action slot |
| `components/ui/empty-state.tsx` | Canonical EmptyState component |
| `components/ui/loading-state.tsx` | CardSkeleton, SkeletonGrid, LoadingSpinner |
| `lib/chart-theme.ts` | Canonical Recharts theme (colors, grid, axis, tooltip) |

### Modified files
| File | Change |
|---|---|
| `app/globals.css` | Updated CSS custom properties to insic spec tokens (warm bg, warm borders, corrected ink/olive values, added `--insic-*` canonical vars with legacy aliases) |
| `tailwind.config.ts` | Updated ink/olive/surface palette to spec values; removed 20+ legacy MDM3 tokens and neon colors; added `info`, `up-border`, `down-border`, `warn-border`, `insic-*` tokens |
| `components/ui/card.tsx` | Added `variant` prop; added `padding` prop; fixed CardFooter (removed dark-glass `rgba(10,22,40,0.4)`, replaced with warm `#FBFAF7`); removed `glass-card` dependency |
| `components/ui/badge.tsx` | Added `tone` variants replacing inline badge color strings; kept `variant` pass-through for shadcn compatibility |
| `components/ui/section-header.tsx` | Migrated `text-slate-*` to insic tokens |
| `components/ui/info-tooltip.tsx` | Migrated dark-blue-glass styling to insic ink + warm border token |
| `app/markets/page.tsx` | Migrated all `text-slate-*`, `text-emerald-*`, `text-red-*`, `bg-*` to canonical insic tokens |

---

## Components Created

| Component | File | Replaces |
|---|---|---|
| `MetricCard` | `components/ui/metric-card.tsx` | Ad-hoc metric tiles across all pages |
| `VerdictCard` | `components/ui/verdict-card.tsx` | InvestmentVerdict, InvestorGradeCard, InvestorVerdictCard, VerdictHero |
| `PageContainer` | `components/ui/page-container.tsx` | Inline max-width/padding patterns |
| `PageHeader` | `components/ui/page-header.tsx` | Inline h1/subtitle patterns |
| `EmptyState` | `components/ui/empty-state.tsx` | Inline empty state patterns |
| `CardSkeleton` / `SkeletonGrid` / `LoadingSpinner` | `components/ui/loading-state.tsx` | Inline `Sk()` functions, ad-hoc spinners |
| `chartTheme` | `lib/chart-theme.ts` | Local chart color arrays in each chart component |

---

## Components Consolidated

| Was | Now | Notes |
|---|---|---|
| 4 verdict components | `VerdictCard` | InvestmentVerdict, InvestorGradeCard, InvestorVerdictCard, VerdictHero — canonical component with `size="full|compact"` |
| Inline badge color functions | `Badge tone="..."` | Centralized semantic tone variants |
| CardFooter dark glass | Warm surface | `rgba(10,22,40,0.4)` → `#FBFAF7` |

---

## Token Migration Summary

### CSS custom properties (globals.css)
- Added canonical `--insic-*` variables for ink, bg, border, text, olive, financial semantics
- Updated `--background` to warm `#FAF9F6` (was pure white)
- Updated `--border` to warm `#E3E1DA` (was cold `#E5E5E5`)
- Added `--insic-positive-border`, `--insic-negative-border`, `--insic-warning-border`, `--insic-info-border`
- All legacy `--color-*` aliases preserved to prevent breakage during migration

### Tailwind config
- Updated `ink.*`, `olive.*` to spec values
- Updated surface/border tokens to warm values
- Removed 20+ MDM3 legacy tokens (tertiary-*, surface-container-*, on-primary-container, etc.)
- Removed neon, neon-light, neon-cyan
- Added `info`, `info-soft`, `info-border`, `up-border`, `down-border`, `warn-border` tokens

---

## Routes Migrated

| Route | File | Status |
|---|---|---|
| Markets | `app/markets/page.tsx` | ✅ Token migration complete |

---

## TypeUI Systems Used

| Surface | TypeUI Direction | Applied |
|---|---|---|
| Overall system | Refined (adapted to insic brand) | Card structure, control heights, spacing |
| Data density | Ant table patterns | Table spec in design-system.md |
| All | Warm off-white adapted from Refined | `#FAF9F6` bg token |

---

## Accessibility Improvements

- Migrated market status labels to insic semantic tokens (correct WCAG ratios maintained)
- InfoTooltip trigger: fixed dark-mode artifact colors on light interface
- CardFooter: removed invisible-text risk from dark background on light-mode card
- `aria-label="Loading"` and `role="status"` on LoadingSpinner

---

## Build Status

- TypeScript: ✅ zero errors (verified with `npx tsc --noEmit`)
- Linting: pending — run `npm run lint`
- Tests: pending — run `npm test`
- Build: pending — run `npm run build`

---

## Remaining Work (Gates 4–5)

### High priority (visual impact)
- [ ] Apply `PageContainer` + `PageHeader` to: analyze, valuations, screener, ETF, monitor, pricing
- [ ] Apply `VerdictCard` to stock overview, valuation cockpit, valuations list
- [ ] Apply `MetricCard` to: StockHeroCards, OverviewMetricGrid, ETFMetricsGrid, IndexSnapshotGrid
- [ ] Apply `chartTheme` to all Recharts chart components
- [ ] Consolidate 3 search input implementations into one `SearchInput` component
- [ ] Apply `CardSkeleton` to replace all inline `Sk()` local functions
- [ ] Apply `EmptyState` to valuations, screener, ETF watchlist

### Medium priority
- [ ] Consolidate duplicate `InfoTooltip.tsx` and `info-tooltip.tsx`
- [ ] Migrate remaining `glass-card` CSS usages to `Card variant` prop
- [ ] Apply warm `#FAF9F6` background to Sidebar
- [ ] Migrate pricing/page.tsx inline buttons to Button component
- [ ] Create placeholder pages for `/alerts`, `/settings`, `/help`
- [ ] Apply `SectionHeader` from ui/ to markets sub-components

### Lower priority
- [ ] OG card redesign (`app/api/og/route.tsx`, `app/api/og/square/route.tsx`)
- [ ] Landing page token verification
- [ ] Screenshot matrix at 375/768/1440px
- [ ] Playwright visual smoke tests

---

## Known Limitations

1. **Full route migration not yet complete** — only markets/page.tsx done. All other routes retain hardcoded color values.
2. **VerdictCard not yet wired** — component created but existing implementations still in use.
3. **Chart theme not yet applied** — defined in `lib/chart-theme.ts` but not yet imported by chart components.
4. **SearchInput consolidation pending** — three implementations still in place.
5. **Legacy `--color-*` aliases retained** — to be cleaned up once all components reference `--insic-*` vars.

---

*Log last updated: 2026-06-07*
