# insic UI Consistency Audit

**Date:** 2026-06-07  
**Auditor:** Claude Sonnet (senior product designer + UX auditor role)  
**Scope:** Full repository — all routes, shared components, layout system, tokens

---

## 0. Stack Overview

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS v3 + CSS custom properties |
| Component primitives | shadcn/ui (via Radix UI) + Base UI |
| Charts | Recharts (most pages) + lightweight-charts (price/history) |
| Tables | @tanstack/react-table |
| Auth | NextAuth v4 (Google OAuth) |
| Payments | Lemon Squeezy |
| Animation | Motion (formerly Framer Motion) |
| Icons | Lucide React |
| Fonts | Inter (UI), system fallback |
| Token system | Tailwind theme extension + CSS custom properties in globals.css |

---

## 1. Complete Route Inventory

### Marketing routes
| Route | File | Shell |
|---|---|---|
| `/` | app/page.tsx | LandingNavbar + LandingFooter |
| `/pricing` | app/pricing/page.tsx | Inline navbar (InsicLogoLockup) |
| `/privacy` | app/privacy/page.tsx | Unknown — likely none |
| `/terms` | app/terms/page.tsx | Unknown |
| `/redeem` | app/redeem/page.tsx | Unknown |

### Application routes (require auth / AppShell)
| Route | File | Notes |
|---|---|---|
| `/analyze` | app/analyze/page.tsx | Primary entry point |
| `/stock/[ticker]` | app/stock/[ticker]/page.tsx | StockNavContext, TabNav, 5 tabs |
| `/screener` | app/screener/page.tsx | Screener |
| `/valuations` | app/valuations/page.tsx | Saved analyses |
| `/etf` | app/etf/page.tsx | ETF universe |
| `/etf/[symbol]` | app/etf/[symbol]/page.tsx | ETF detail |
| `/etf/compare` | app/etf/compare/page.tsx | ETF compare |
| `/markets` | app/markets/page.tsx | Markets overview |
| `/markets/[symbol]` | app/markets/[symbol]/page.tsx | Instrument detail |
| `/monitor` | app/monitor/page.tsx | Portfolio |
| `/simplifier` | app/simplifier/page.tsx | Simplifier landing |
| `/simplifier/[ticker]` | app/simplifier/[ticker]/page.tsx | 5-phase wizard |
| `/strategies` | app/strategies/page.tsx | Strategy list |
| `/strategy` | app/strategy/page.tsx | Strategy detail |
| `/compare` | app/compare/page.tsx | Stock compare |
| `/factor-ranking` | app/factor-ranking/page.tsx | Factor ranking |
| `/ai-stack` | app/ai-stack/page.tsx | AI analysis stack |
| `/ai-stack/report` | app/ai-stack/report/page.tsx | AI report |
| `/trading` | app/trading/page.tsx | Trading signals |
| `/dashboard` | app/dashboard/page.tsx | Dashboard |
| `/admin` | app/admin/page.tsx | Admin panel |

### Missing routes (not found in app directory)
- `/alerts` — referenced in Sidebar and BottomNav but no page.tsx found
- `/settings` — referenced in Sidebar and BottomNav but no page.tsx found
- `/help` — referenced in Sidebar and BottomNav but no page.tsx found
- Login/Register/Forgot-password — handled via NextAuth modal (no dedicated pages)

---

## 2. Shared Layout Inventory

### Shells in use
| Shell | File | Used by |
|---|---|---|
| AppShell | components/layout/AppShell.tsx | All app routes via app/layout.tsx |
| AppShellClient | components/layout/AppShellClient.tsx | Client-side AppShell wrapper |
| No marketing shell component | — | Landing uses inline LandingNavbar + LandingFooter |
| No auth shell | — | Auth uses LoginModal (modal overlay) |

### Navigation components
| Component | File | Viewport |
|---|---|---|
| Sidebar | components/layout/Sidebar.tsx | lg+ |
| TopBar | components/layout/TopBar.tsx | All (52px fixed) |
| BottomNav | components/layout/BottomNav.tsx | < lg |
| TabNav | components/stock/TabNav.tsx | Stock pages only |
| LandingNavbar | components/landing/LandingNavbar.tsx | Landing only |
| StockContextBar | components/stock/StockContextBar.tsx | Stock pages |

---

## 3. Component Inventory

### UI primitives (components/ui/)
- alert, arc-gauge, badge, button, card, data-table, dialog, drawer, dropdown-menu
- info-tooltip, InfoTooltip (DUPLICATE — two tooltip components)
- input, metric-chip, na-badge, number-display, progress, scroll-area
- section-header, select, separator, sheet, skeleton, source-label
- table, tabs, toggle-group, toggle, tooltip, trend-badge, wizard-steps
- ScenarioRangeBar, Sparkline, InsicLogo, CardBack, FlipCard, DrumRollPicker

### Layout (components/layout/)
- AppShell, AppShellClient, BottomNav, Header (UNUSED?), Sidebar, TopBar

### Stock components (components/stock/)
- InvestmentVerdict, InvestorGradeCard, InvestorVerdictCard (THREE verdict components — major duplicate)
- VerdictHero (components/valuation/cockpit/VerdictHero.tsx) — FOURTH verdict component
- TabNav, StockSidebar, PriceHeader, StockContextBar
- Many data components: FinancialStatements, FinancialCharts, RiskRadar, etc.

### Valuation (components/valuation/)
- ValuationCockpit, ValuationLab, ValuationOverview, ValuationSummary
- cockpit/ — AssumptionHealthPanel, AssumptionsPanel, BusinessChecks, CrossCheckStrip,
  FairValueChart, GuidanceStrip, HistoricalMultiplesChart, KeyAssumptions,
  ModelBreakdownTable, ModelDivergencePanel, MonteCarloPanel, QualityPanel,
  RightSidebar, ScenarioCards, SummaryCards, ValuationMethodCards,
  ValueInvestingPanel, VerdictHero

---

## 4. Typography Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| T-01 | markets/page.tsx:71 | `text-slate-900` | Off-token — uses Tailwind default, not insic ink | Replace with `text-[#111111]` or `text-ink-900` |
| T-02 | markets/page.tsx:72 | `text-slate-500` | Off-token | Replace with `text-[#6B6B6B]` |
| T-03 | markets/page.tsx:172 | `font-extrabold text-slate-900` | Page title uses slate instead of ink; no canonical PageHeader used | Use PageHeader component |
| T-04 | markets/page.tsx:206 | `text-amber-600` / `text-blue-600` | Market status using non-semantic amber/blue (not insic financial semantic tokens) | Use `text-[#B56A00]` / `text-[#2563EB]` |
| T-05 | analyze/page.tsx:65–75 | Various badge class strings | Inline badge color logic duplicated in page, not using Badge component | Centralize in Badge `tone` variants |
| T-06 | pricing/page.tsx | No page title component | Pricing page has no shared page header, inline h1 only | Use PageHeader or canonical section title |
| T-07 | components/markets/* | `text-slate-*`, `text-emerald-*` | Multiple market sub-components use Tailwind default palette | Migrate to insic tokens |
| T-08 | Sidebar | `text-[10px] font-bold uppercase` section labels | Hard-coded, not reusable | Extract SectionLabel as shared component (already local, promote to ui/) |
| T-09 | stock/PriceHeader.tsx | Mixed font sizes for price/change | No single tabular-nums heading convention | Define KPI heading token |
| T-10 | Card component | `font-heading text-base` | `font-heading` maps to same as sans — redundant alias | Remove font-heading alias; use font-sans consistently |

---

## 5. Color Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| C-01 | markets/page.tsx | `text-emerald-600`, `text-red-500`, `bg-emerald-50`, `bg-amber-50` | Using Tailwind emerald/red/amber instead of insic semantic tokens | Replace with `text-[#11875D]`, `text-[#D83B3B]`, `bg-up-soft`, `bg-warn-soft` |
| C-02 | card.tsx (CardFooter) | `bg-[rgba(10,22,40,0.4)]`, `border-[rgba(59,130,246,0.12)]` | Dark glass-card footer — looks like legacy dark-theme remnant, inconsistent with light card body | Remove dark footer background; use `bg-[#FAFAFA] border-t border-[#E5E5E5]` |
| C-03 | tailwind.config.ts | 40+ legacy MDM3 tokens still defined | `primary-container`, `tertiary`, `surface-container-*`, etc. — Material Design 3 remnants never removed | Remove or namespace legacy tokens |
| C-04 | tailwind.config.ts | `'neon'`, `'neon-light'`, `'neon-cyan'` | Generic SaaS neon colors that conflict with insic identity | Remove |
| C-05 | tailwind.config.ts | `'deep': '#000000'`, `'mid': '#111111'`, `'raised': '#1C1C1C'` | Parallel ink system — overlaps with `ink.950/900/800` | Remove; use ink.* |
| C-06 | globals.css | `--nav-bg: rgba(0,0,0,0.92)` | Dark-nav CSS var referenced nowhere in current layout | Remove stale token |
| C-07 | globals.css | `--glass-bg`, `--glass-border` | Dark glass tokens — not used by current white layout | Remove or document as dark-mode only |
| C-08 | Sidebar/TopBar | Hardcoded `#5F790B`, `#EEF4DD`, `#9B9B9B` inline | 1742 hardcoded hex values across components | Migrate to Tailwind token utilities |
| C-09 | InvestmentVerdict.tsx | `TOKEN` object with hardcoded hex | Local token object instead of shared CSS vars | Use shared semantic color classes |
| C-10 | markets/page.tsx | `text-amber-600` for market status | Amber-600 ≠ insic warn token `#B56A00` (different value) | Replace with insic warn class |

---

## 6. Spacing Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| S-01 | Multiple pages | `px-4`, `px-6`, `px-8`, `px-4 sm:px-6 lg:px-8` | 1054 max-width references, no consistent page padding wrapper | Create `PageContainer` with canonical padding |
| S-02 | stock/TabNav | `px-4 sm:px-6 lg:px-8` | Different from analyze `px-4 sm:px-6` | Align to one system |
| S-03 | ValuationCockpit | Custom grid gutters | Each section uses ad-hoc gap values | Use canonical gap scale |
| S-04 | Card component | `py-4` default, `py-3` for sm | No `lg` padding variant for hero cards | Add `padding="lg"` variant |
| S-05 | Landing sections | Sections vary between `py-16`, `py-20`, `py-24` | No consistent section vertical rhythm | Define `--section-y` token |

---

## 7. Border Radius Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| R-01 | Button | `rounded-[10px]` baseline with `rounded-[9px]` for sm, `rounded-[8px]` for xs | Good system, but xs/xxs use same radius | Simplify: 10px standard, 8px small |
| R-02 | Card | `rounded-xl` = 16px | Some market cards use `rounded-2xl` = 20px inline | Standardize to `rounded-xl` for cards, `rounded-2xl` for hero/featured |
| R-03 | Sidebar NavItem | `rounded-[10px]` | Good |  |
| R-04 | TabNav active indicator | `rounded-full` | Inconsistent with bar-tab convention used in ValuationCockpit | Standardize tab style |
| R-05 | ValuationCockpit tabs | Different tab radius | Cockpit uses pill tabs, stock TabNav uses underline tabs | Decide canonical: recommend underline for document-style tabs |
| R-06 | markets/page.tsx | `rounded-xl`, `rounded-2xl` mixed | Ad-hoc radius choices | Apply canonical card radius token |

---

## 8. Shadow Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| SH-01 | InvestmentVerdict | `box-shadow: '0 4px 16px rgba(0,0,0,0.05)'` inline style | Not using shadow token | Use `shadow-card` utility |
| SH-02 | Sidebar | No shadow | Correct — sidebar is edge-anchored |  |
| SH-03 | glass-card vs Card | `glass-card-light` uses `0 8px 32px rgba(0,0,0,0.10)` vs card shadow `0 8px 24px rgba(0,0,0,0.06)` | Two card shadow values | Consolidate to `shadow-card` = `0 8px 24px rgba(0,0,0,0.06)` |
| SH-04 | CardFooter | `bg-[rgba(10,22,40,0.4)]` dark backdrop | Legacy dark-mode artifact with no shadow | Remove dark background, add standard top border |
| SH-05 | TopBar | `box-shadow: 0 4px 20px rgba(0,0,0,0.05)` via glass-toolbar | Good, matches `shadow-nav` token |  |

---

## 9. Button Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| B-01 | TopBar sign-in | `bg-[#5F790B] hover:bg-[#526A08]` inline | Duplicates `Button variant="default"` | Use `<Button variant="default" size="sm">` |
| B-02 | Sidebar sign-in | Same inline olive button | Same | Same fix |
| B-03 | Landing sections | Mix of `<button>` + `<Link>` styled as buttons | Inconsistent tag/component | Use `<Button asChild>` |
| B-04 | TopBar "Save" button | `border border-olive-700 text-olive-700 hover:bg-olive-50` | Close to `variant="outline"` but custom | Use `<Button variant="outline">` |
| B-05 | pricing/page.tsx | `signIn('google')` buttons inline styled | Not using Button component | Migrate to Button |
| B-06 | BottomNav close button | `hover:bg-[#F5F5F5]` inline | Should use `Button variant="ghost" size="icon-sm"` |  |
| B-07 | ValuationCockpit | Mix of Base UI Button and custom styled buttons | Two button systems | Use Button component throughout |

---

## 10. Input and Form Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| I-01 | TopBar search | Custom rounded-pill input with glass background | Not using Input component | Design canonical SearchInput |
| I-02 | Analyze search hero | Second completely custom search implementation | Duplicates TopBar search logic + styling | Shared SearchInput component |
| I-03 | ETF search bar | ETFSearchBar.tsx — third search implementation | Three search implementations | Consolidate |
| I-04 | Input component | `components/ui/input.tsx` exists but barely used | Standard Input not applied to search fields | Use consistently |
| I-05 | Screener filters | Custom filter UI | Not using canonical Select | Migrate to Select component |

---

## 11. Card Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| CA-01 | Card component | `glass-card glass-card-hover` classes | Card component uses a glass class that doesn't exist in non-glass context | Remove glass-card from canonical Card; let page opt-in |
| CA-02 | CardFooter | `bg-[rgba(10,22,40,0.4)]` dark bg | Dark footer on light card — legacy remnant | Fix: `bg-[#FAFAFA] border-t border-[#E5E5E5]` |
| CA-03 | Market page cards | `rounded-2xl bg-white/70 border border-slate-100` | Skeleton uses slate color, not insic token | Migrate |
| CA-04 | Modelling components | Cards in ValuationCockpit use inline styles | Not using Card component | Migrate |
| CA-05 | ETF cards | ETFWatchlistCard, ETFProfileCard — separate card styling | Should use canonical MetricCard or Card | Evaluate and consolidate |
| CA-06 | Simplifier cards | QuestionCard, QuestionCardLight — two card variants | Similar purpose, different styling | Unify |

---

## 12. Chart Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| CH-01 | FinancialCharts | Recharts with local color array | No shared chart theme | Create ChartTheme |
| CH-02 | ValuationCockpit/FairValueChart | lightweight-charts | Different library from Recharts components | Document: lightweight-charts for price history only, Recharts for all others |
| CH-03 | MultiTickerChart | Recharts with its own color scheme | Third chart style | Apply shared theme |
| CH-04 | Screener/BubbleMap | Custom SVG or Recharts scatter | Separate styling | Apply shared theme |
| CH-05 | ETF charts | ETFComparisonChart, ETFValuationHistory | Local colors | Apply shared theme |
| CH-06 | Chart grid color | `stroke="#E5E5E5"` hardcoded in many | Should be CSS var | Use `stroke="var(--color-border)"` |
| CH-07 | Tooltip styling | Each chart has inline tooltip | Should be one tooltip style | Create ChartTooltip component |
| CH-08 | Scenario colors | Bear/Base/Bull inconsistent across charts | Sometimes red/olive/green, sometimes other combos | Canonicalize: bear=#D83B3B, base=#5F790B, bull=#11875D |

---

## 13. Table Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| TB-01 | FinancialStatements | Custom table with local styles | Not using data-table | Evaluate migration |
| TB-02 | ValuationTable | components/valuations/ValuationTable.tsx — custom | Separate from FinancialTable | Unify via DataTable |
| TB-03 | ScreenerWarrenTable | components/screener/WarrenTable.tsx — custom | Another custom table | Apply canonical table styles |
| TB-04 | RankingTable | components/factor/RankingTable.tsx — custom | Another custom table | Apply canonical table styles |
| TB-05 | PriceTable | components/markets/PriceTable.tsx | Custom + slate colors | Migrate to insic tokens |
| TB-06 | Right-alignment | Mixed — some financial values left-aligned | Financial values must be right-aligned with tabular-nums | Enforce via DataTable config |
| TB-07 | Empty values | Mix of `—`, `N/A`, `-`, blank | Should always be em dash `—` | Standardize |
| TB-08 | Sticky header | Not consistent across all tables | Add sticky to shared DataTable | Build into component |

---

## 14. Navigation Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| N-01 | Sidebar width | `w-[220px]` | Brief mentions 232–248px target | Adjust to 240px |
| N-02 | TopBar height | `52px` | Matches sidebar header height — good |  |
| N-03 | BottomNav height | `56px` | Slightly taller than TopBar — acceptable |  |
| N-04 | Stock TabNav | `sticky z-20` offset `top: calc(52px + ...)` | Correct offset for TopBar |  |
| N-05 | Landing Navbar | Separate component, separate styling | Landing nav not using TopBar | For consistency, landing nav should share visual language |
| N-06 | Pricing page | Inline `InsicLogoLockup` + custom header | No shared navbar component | Use LandingNavbar |
| N-07 | Sidebar active state | Left indicator `w-[3px]` + `bg-[#EEF4DD]` | Good design, slightly different from BottomNav | BottomNav has no left indicator — add consistent active treatment |
| N-08 | BottomNav More drawer | Opens above nav bar | Good mobile pattern |  |
| N-09 | Missing routes in nav | /alerts, /settings, /help have nav links but no pages | Dead links | Create placeholder pages |

---

## 15. Modal Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| M-01 | LoginModal | components/auth/LoginModal.tsx | Uses Dialog from Radix, custom styling | Good base — should use canonical Modal wrapper |
| M-02 | LoginToSaveModal | components/auth/LoginToSaveModal.tsx | Similar to LoginModal, slightly different layout | Can consolidate into LoginModal with variant |
| M-03 | PaywallModal | components/monetization/PaywallModal.tsx | Custom paywall dialog | Should use Dialog component |
| M-04 | SaveToWatchlistDialog | components/watchlist/SaveToWatchlistDialog.tsx | Uses Dialog | Consistent with M-01 approach |
| M-05 | ValuationModelDrawer | components/valuation/ValuationModelDrawer.tsx | Uses Drawer component | Good |
| M-06 | ShareCardModal | components/valuation/ShareCardModal.tsx | Custom modal for share card | Use Dialog base |
| M-07 | PromptDrawer | components/simplifier/PromptDrawer.tsx | Uses Drawer | Good |
| M-08 | Focus trapping | Not verified across all modals | Should trap focus per WCAG | Audit per modal |
| M-09 | Escape-to-close | Radix handles this automatically | Good |  |

---

## 16. Mobile Inconsistencies

| ID | Location | Current | Problem | Fix |
|---|---|---|---|---|
| MO-01 | Stock tabs | Horizontal scroll on mobile — good |  |  |
| MO-02 | Financial tables | No horizontal scroll on all table implementations | On narrow screens, tables overflow | Add `overflow-x-auto` wrapper |
| MO-03 | Markets page | Skeleton uses `rounded-2xl bg-white/70` — subtle loading state | Good |  |
| MO-04 | TopBar mobile search | Opens inline — good UX |  |  |
| MO-05 | Charts | No explicit mobile height minimum | Charts may collapse | Set `minHeight: 200` on all chart containers |
| MO-06 | Cards | Some cards don't stack at 375px | Check grid breakpoints | Add `sm:grid-cols-2 grid-cols-1` consistently |
| MO-07 | Landing hero | No mobile-specific font size | Uses `clamp()` — good |  |
| MO-08 | Valuation cockpit | Complex 3-column layout has no mobile fallback | Cockpit squeezed on tablet | Add `lg:grid-cols-3 grid-cols-1` |
| MO-09 | BottomNav safe area | Uses `env(safe-area-inset-bottom)` | Good — handles notch |  |

---

## 17. Accessibility Problems

| ID | Location | Issue | Fix |
|---|---|---|---|
| A-01 | TopBar search | `aria-expanded`, `aria-haspopup`, `aria-autocomplete` present | Good |  |
| A-02 | TabNav | `role="tablist"`, `role="tab"`, `aria-selected`, keyboard navigation | Good |  |
| A-03 | Card | No `role` or landmark | Cards containing primary content should have `aria-label` where needed |  |
| A-04 | Charts | No accessible text alternatives | Add `aria-label` or `<title>` SVG elements to charts |  |
| A-05 | Color-only status | Financial up/down communicated only through color (#11875D / #D83B3B) | Add +/- symbol prefix or icon alongside color |  |
| A-06 | Modal focus trap | Not verified for all custom modals | Radix Dialog handles this — verify custom implementations |  |
| A-07 | markets/page.tsx | `●` live-market indicator — Unicode bullet may not read well in screen readers | Use `aria-label="Market Open"` |  |
| A-08 | Form inputs | Labels verified for auth inputs? | LoginModal should have explicit `<label>` or `aria-label` |  |
| A-09 | Heading order | Each page needs `h1 > h2 > h3` hierarchy — not verified | Audit per page |  |
| A-10 | Touch targets | BottomNav nav items `min-w-[60px]` — may be under 44px tall | Ensure `min-h-[44px]` on all touch targets |  |
| A-11 | Reduced motion | Most animations wrapped in `useReducedMotion()` | Good — maintain |  |

---

## 18. Duplicate Components

| Element | Duplicates Found | Files | Proposed Canonical |
|---|---|---|---|
| Verdict component | 4 | InvestmentVerdict, InvestorGradeCard, InvestorVerdictCard, VerdictHero | `VerdictCard` with variants |
| Search input | 3 | TopBar search, Analyze SearchHero, ETFSearchBar | `SearchInput` component |
| Auth modal | 2 | LoginModal, LoginToSaveModal | `LoginModal` with `variant="save"` |
| Tooltip | 2 | components/ui/InfoTooltip.tsx, components/ui/info-tooltip.tsx (same component, two files) | Consolidate to `InfoTooltip` |
| Company logo | 2 | CompanyLogo in TopBar, CompanyLogo in Analyze | `CompanyLogo` in ui/ |
| User avatar | 2 | UserAvatar in TopBar, user avatar in Sidebar | `UserAvatar` in ui/ |
| Section header | 3+ | SectionHeader inline in markets/page.tsx, section-header.tsx in ui/, SectionLabel in Sidebar | `SectionHeader` in ui/ |
| Badge classes | Multiple inline | analyze/page.tsx statusBadge(), expectationCls(), various hardcoded | `Badge` component with `tone` variant |
| Page title h1 | Multiple inline | Each page writes its own `h1` style | `PageHeader` component |
| Card skeleton | Multiple inline | `Sk` component in markets, skeleton components per feature | `CardSkeleton` in ui/ |

---

## 19. Hardcoded Style Values

1742 hardcoded hex colors in components (grep result). Key patterns:

- `#5F790B` / `#526A08` / `#4A5E07` — olive variants (should be `olive-700`, `olive-600`, `olive-500`)
- `#EEF4DD` — olive-100 (should be `olive-100`)
- `#111111` — ink (should be `text-ink-900` or CSS var)
- `#6B6B6B` — secondary text (should be `text-secondary`)
- `#9B9B9B` — muted text (should be `text-muted`)
- `#E5E5E5` — border (should be `border-warm` or CSS var)
- `#11875D` — positive (should be `text-up`)
- `#D83B3B` — negative (should be `text-down`)
- `#B56A00` — warning (should be `text-warn`)
- `rgba(0,0,0,0.06)` — box shadows (should use `shadow-card`)

Markets page additionally uses off-system values:
- `text-slate-*`, `text-emerald-*`, `text-red-*`, `bg-emerald-*` (Tailwind defaults, not insic tokens)

---

## 20. Inconsistency Matrix

| Element | Variants Found | Routes Affected | Proposed Canonical |
|---|---|---|---|
| Primary button | 7+ (inline olive, Button default, custom Link-styled, glass button, inline signIn button...) | Landing, Pricing, TopBar, Sidebar, Stock, Auth | `<Button variant="default">` |
| Page header (h1 + subtitle) | 6+ (each page writes its own) | Analyze, Markets, Valuations, Screener, ETF, Monitor | `<PageHeader title="" subtitle="">` |
| Section header (h2) | 5+ implementations | Markets, Screener, ETF, Stock, Landing | `<SectionHeader>` from ui/ |
| Metric/KPI card | 9+ (StockHeroCards, OverviewMetricGrid, ETFMetricsGrid, IndexSnapshotGrid, ...) | Overview, ETF, Markets, Screener | `<MetricCard>` |
| Verdict/grade | 4 | Stock Overview, Stock Valuation, Valuations list, AI Stack | `<VerdictCard>` |
| Status badge | 6+ (inline cls strings, Badge, TrendBadge, VerdictBadge, NaBadge...) | Analyze, Valuations, Screener, Stock | `<Badge tone="positive|negative|warning|informational|neutral">` |
| Table | 5+ (DataTable, WarrenTable, ValuationTable, RankingTable, PriceTable) | Screener, Valuations, Markets, Factor, Stock Financials | `<DataTable>` with insic column types |
| Chart | 2 libraries, many local themes | All data pages | Recharts + shared `chartTheme` config |
| Search input | 3 | TopBar, Analyze, ETF | `<SearchInput>` |
| Card | Card component + glass-card + custom inline cards | All | `<Card variant="default|elevated|flat">` |
| Auth gate | LoginModal, LoginToSaveModal, StockLoginWall, AuthBanner | Stock, Analyze, Valuations | `<AuthGate variant="modal|wall|banner">` |
| Loading state | Multiple: Skeleton, Sk(), motion-pulse, spinner | All | `<LoadingState>` + `<CardSkeleton>` |
| Empty state | Multiple inline | Valuations, Screener, Analyze | `<EmptyState>` |
| Page container | Inconsistent max-width + padding | All app routes | `<PageContainer>` with 1280px max, canonical padding |

---

## TypeUI Design Direction Assessment

TypeUI available: **yes** — authenticated, 24 design systems accessible.

### Systems evaluated for insic

| System | Verdict | Reason |
|---|---|---|
| **Refined** | ✅ **Selected** | "Elegant and understated, precise spacing, subtle contrast, polished details, premium, professional" — exact language matches insic brief: serious, calm, institutional, analytical |
| **Paper** | Considered | Warm and tactile — close second. Slightly too cozy for a financial research tool |
| **Clean** | Considered | Minimal — good structure, but could read generic SaaS; lacks the premium editorial quality |
| **Ant** | Rejected | Enterprise-focused but reads as generic enterprise software, not premium research |
| **Application** | Rejected | Purple-themed aesthetic — directly conflicts with insic olive/ink identity |
| **Corporate** | Rejected | Too stiff and formal — reads as enterprise HR software, not investment research |
| **Codex** | Rejected | Radically minimal, typography-only — appropriate for developer tools, not financial data density |
| **Claude** | Runner-up | "Restrained editorial style inspired by research journals" — warm ivory, near-black ink, sparse accents. Very close to insic brief. Would work well for landing/marketing. |
| **Neobrutalism/Bold/Energetic/Colorful** | Rejected | Wrong category entirely — loud, high-energy, conflict with "disciplined, not exciting" brief |
| **Luxury** | Rejected | Fashion/luxury positioning, not investment research |
| **Agentic** | Rejected | AI-chatbot aesthetic — not appropriate |

### Selected direction: Refined (adapted to insic brand)

**What TypeUI Refined provides:**
- Precise spacing system
- Subtle shadow hierarchy
- Professional control heights
- Restrained color use
- Clean card construction with clear elevation
- Premium sidebar and shell patterns

**How it will be adapted (not copied):**
- Replace Refined's neutral accent with insic olive (#5F790B)
- Replace any cool gray backgrounds with insic warm off-whites (#FAF9F6, #F4F3EF)
- Replace generic typography scale with insic-specific scale from DESIGN.md
- Remove any blue primary color from Refined — olive is the only primary accent
- Preserve all structural layout guidance: sidebar width, header height, content max-width, spacing grid
- Apply insic financial semantic colors for positive/negative/warning
- Use Refined's card construction as the canonical card blueprint

**Rejected patterns from Refined:**
- Any dark-mode or glassmorphism defaults
- Any decorative gradients
- Blue-primary button style

### TypeUI patterns to use for each major surface

| Surface | TypeUI guidance to apply |
|---|---|
| Application shell | Refined sidebar + topbar shell |
| Sidebar | Refined sidebar navigation patterns |
| Dashboard/overview | Refined card grid layout |
| Landing hero | Refined marketing hero structure, adapted to insic ink/olive |
| Pricing | Refined pricing table patterns |
| Authentication | Refined auth screen layout |
| Tables | Ant table density (data-heavy), Refined visual styling |
| Charts | Refined chart card patterns |
| Modals | Refined dialog/drawer patterns |

---

## Implementation Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| Breaking valuation calculations during component migration | High | Touch only markup and styles, never logic |
| Hardcoded color migration introducing regressions | Medium | Migrate token by token, test build after each batch |
| Chart library changes | Low — not changing library | Only applying theme config changes |
| Navigation changes breaking deep links | Low — URLs not changing | Preserve all href values |
| Legacy MDM3 token removal | Low | Verify no component references them first |
| CardFooter dark background breaking existing cards | Medium | Search all CardFooter usages before changing |
| Missing route pages (/alerts, /settings, /help) | Medium | Create minimal placeholder pages |

---

*End of Phase 1 Audit — 2026-06-07*
