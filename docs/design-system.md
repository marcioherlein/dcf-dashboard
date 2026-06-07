# insic Design System Specification

**Version:** 1.0 — 2026-06-07  
**Status:** Canonical specification for Phase 3 implementation  
**TypeUI direction:** Refined (adapted to insic brand)

---

## 1. Brand Principles

**Positioning:** "Invest with a process, not a story."

The insic design system must express these five qualities:

1. **Analytical precision** — every number has a place, a unit, an alignment rule
2. **Institutional calm** — no urgency, no flashing, no alarming reds unless semantically required
3. **Transparent process** — assumptions visible, models labeled, estimates distinguished from actuals
4. **Accessible depth** — premium-feeling but readable by individual investors, not only professionals
5. **Disciplined restraint** — olive is the single brand accent; silence does more work than decoration

The product is a research workspace. It must not feel like a trading terminal, a crypto app, or a generic AI SaaS dashboard.

---

## 2. Design Tokens

### 2.1 Color tokens

All tokens defined as CSS custom properties in `globals.css` and mirrored in `tailwind.config.ts`.

#### Background and surface
```css
--insic-bg:              #FAF9F6;   /* Warm page background */
--insic-bg-subtle:       #F4F3EF;   /* Alternate section background */
--insic-surface:         #FFFFFF;   /* Card / panel surface */
--insic-surface-muted:   #FBFAF7;   /* Muted card surface */
```

> **Migration note:** Current globals.css uses `--color-bg: #FFFFFF` (pure white).
> New spec uses `#FAF9F6` (warm off-white) for page backgrounds only. Cards stay `#FFFFFF`.
> Update `--background` HSL bridge accordingly.

#### Ink (dark backgrounds, text on light)
```css
--insic-ink-950: #06101F;
--insic-ink-900: #0A1424;
--insic-ink-800: #111C2E;
--insic-charcoal: #1E2430;
```

#### Border
```css
--insic-border:        #E3E1DA;   /* Default card/component border */
--insic-border-strong: #CDD1C8;   /* Emphasized border */
```

#### Text hierarchy
```css
--insic-text-primary:   #06101F;   /* Headings, primary data */
--insic-text-secondary: #566174;   /* Supporting text */
--insic-text-muted:     #8A95A6;   /* Labels, captions */
```

#### Brand olive (primary accent)
```css
--insic-olive-700: #536B08;   /* Hover state */
--insic-olive-600: #5F790B;   /* Primary CTA, active nav, fair value */
--insic-olive-500: #718E14;   /* Lighter accent */
--insic-olive-100: #EDF3DD;   /* Soft background tint */
--insic-olive-50:  #F6F9EC;   /* Very soft hover / selected bg */
```

#### Financial semantic colors
These exist only for financial meaning. Never use them decoratively.

```css
--insic-positive:        #11875D;   /* Undervalued, positive FCF, growth */
--insic-positive-soft:   #E8F7EF;   /* Positive soft bg */
--insic-positive-border: #A3D9BE;   /* Positive card border */

--insic-negative:        #D83B3B;   /* Overvalued, losses, negative CAGR */
--insic-negative-soft:   #FCEAEA;   /* Negative soft bg */
--insic-negative-border: #F0B8B8;   /* Negative card border */

--insic-warning:         #B56A00;   /* Uncertain, caution, moderate */
--insic-warning-soft:    #FFF4DA;   /* Warning soft bg */
--insic-warning-border:  #F3D391;   /* Warning card border */

--insic-info:            #2563EB;   /* Secondary actions, analyst targets, links */
--insic-info-soft:       #EAF1FF;   /* Info soft bg */
--insic-info-border:     #93B4F5;   /* Info card border */
```

#### Usage rules
- **Olive** = brand accent. CTAs, active nav, intrinsic fair value emphasis, focus rings.
- **Positive green** = financial upside, undervalued, positive metrics. Not for general "good" states.
- **Negative red** = financial downside, overvalued, losses. Not for errors (use destructive token).
- **Warning amber** = moderate expectation, caution, uncertain. Not for general warnings.
- **Info blue** = secondary action, analyst/external data, links. Not for primary actions.
- Remove: neon, cosmic, amber-gold as decoration, emerald class, slate class, zinc class.

### 2.2 Tailwind CSS variable bridge (shadcn/ui)

Update `globals.css :root` to map new tokens:
```css
--background:            39 17% 97%;     /* #FAF9F6 */
--foreground:            218 73% 7%;     /* #06101F */
--card:                  0 0% 100%;      /* #FFFFFF */
--border:                36 14% 87%;     /* #E3E1DA */
--primary:               82 80% 23%;     /* #5F790B olive-600 */
--primary-foreground:    0 0% 100%;
--muted:                 36 14% 95%;     /* #F4F3EF */
--muted-foreground:      220 15% 40%;    /* #566174 */
--ring:                  82 80% 23%;     /* olive focus ring */
```

---

## 3. Typography

### 3.1 Fonts
- **UI font:** Inter (variable), system fallback stack
- **Monospace:** DM Mono / IBM Plex Mono (for code/model output only)
- **Serif:** Georgia (landing hero headline only — never inside app screens)
- **Numeric variant:** `font-variant-numeric: tabular-nums` on all financial data

### 3.2 Type scale

| Token | Size | Line height | Weight | Use |
|---|---|---|---|---|
| `text-display` | clamp(2.375rem, 5.5vw, 4rem) | 1.02 | 700 | Landing hero only |
| `text-hero` | 2rem (32px) | 1.2 | 700 | App page titles (desktop) |
| `text-heading` | 1.5rem (24px) | 1.3 | 700 | Section titles |
| `text-subhead` | 1rem (16px) | 1.5 | 650 | Card titles |
| `text-body` | 0.9375rem (15px) | 1.6 | 400 | Body text |
| `text-sm` | 0.875rem (14px) | 1.5 | 400 | Supporting body |
| `text-label` | 0.6875rem (11px) | 1.4 | 700 | Uppercase labels (tracking: 0.08em) |
| `text-micro` | 0.6875rem (11px) | 1.4 | 400 | Captions, disclaimers |

Table/financial values: `text-sm` (14px) with `tabular-nums`.
KPI values: `text-hero` or 28–36px custom for prominent fair-value numbers.
Minimum UI text: **13px** — never smaller.

### 3.3 Heading hierarchy rules
- Every app route has exactly one `<h1>` (page title, via `PageHeader` component)
- Section titles use `<h2>`
- Card titles use `<h3>` or `<div role="heading" aria-level="3">`
- Do not skip levels
- Do not use `font-extrabold` on body text — reserve for display/hero only

---

## 4. Spacing

### 4.1 Base grid
8px base. All spacing values are multiples of 4px.

| Token | Value | Use |
|---|---|---|
| `space-1` | 4px | Tight icon gap |
| `space-2` | 8px | Inline element gap |
| `space-3` | 12px | Small component padding |
| `space-4` | 16px | Standard padding |
| `space-6` | 24px | Section internal gap |
| `space-8` | 32px | Card-to-card gap |
| `space-12` | 48px | Section top/bottom padding |
| `space-16` | 64px | Large section padding |
| `space-20` | 80px | Marketing section padding |
| `space-24` | 96px | Hero section padding |

### 4.2 Content widths

| Zone | Max width | Use |
|---|---|---|
| `--content-xs` | 480px | Auth forms, narrow dialogs |
| `--content-sm` | 640px | Focused content pages |
| `--content-md` | 768px | Articles, onboarding |
| `--content-default` | 1024px | Standard app pages |
| `--content-wide` | 1280px | Data-heavy dashboards, cockpit |
| `--content-full` | 1440px | Marketing pages |

### 4.3 Page padding
Standard page content padding via `PageContainer`:
- Mobile: `px-4` (16px)
- Tablet: `px-6` (24px)
- Desktop: `px-8` (32px)

---

## 5. Border Radius

```css
--radius-sm:   4px;    /* Inline chips, tiny elements */
--radius-md:   8px;    /* Small controls, icon buttons */
--radius-ctrl: 10px;   /* Buttons, inputs, nav items (default control) */
--radius-card: 12px;   /* Standard cards */
--radius-lg:   16px;   /* Elevated cards, dropdowns */
--radius-xl:   20px;   /* Hero cards, featured modules */
--radius-full: 9999px; /* Pills, avatars */
```

Tailwind mapping:
- `rounded` = 8px (md)
- `rounded-md` = 10px (ctrl)
- `rounded-lg` = 12px (card)
- `rounded-xl` = 16px (lg)
- `rounded-2xl` = 20px (xl, hero/featured only)

---

## 6. Shadows

```css
--shadow-sm:    0 1px 4px rgba(0, 0, 0, 0.05);
--shadow-card:  0 2px 8px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
--shadow-md:    0 4px 16px rgba(0, 0, 0, 0.08);
--shadow-lg:    0 8px 32px rgba(0, 0, 0, 0.10);
--shadow-nav:   0 1px 0 var(--insic-border);
--shadow-float: 0 16px 48px rgba(0, 0, 0, 0.14);
```

Rules:
- Prefer `border + minimal shadow` over heavy drop shadows
- No decorative colored glows on cards (olive glow only on CTA focus state)
- No 3D or perspective shadows

---

## 7. Layout System

### 7.1 Application shell dimensions

| Element | Value | Token |
|---|---|---|
| Sidebar width | 240px | `--sidebar-width` |
| Topbar height | 52px | `--topbar-height` |
| Stock TabNav height | 44px | `--tabnav-height` |
| Main content offset | `pl-[240px]` on lg+ | — |
| Page top offset | `pt-[52px]` | — |

### 7.2 Breakpoints

| Name | Value | Use |
|---|---|---|
| `sm` | 640px | Small tablet / large phone |
| `md` | 768px | Tablet |
| `lg` | 1024px | Desktop (sidebar appears) |
| `xl` | 1280px | Wide desktop |
| `2xl` | 1440px | Large desktop |

Mobile-first. Sidebar only on `lg+`. BottomNav only below `lg`.

### 7.3 Control heights

| Control | Height | Token |
|---|---|---|
| Large button / input | 44px | `--h-ctrl-lg` |
| Default button / input | 40px | `--h-ctrl-md` |
| Compact control | 36px | `--h-ctrl-sm` |
| Extra-compact | 32px | `--h-ctrl-xs` |
| Touch target minimum | 44px | WCAG 2.5.5 |

---

## 8. Navigation

### 8.1 Sidebar (desktop, lg+)

- Width: 240px, fixed, `z-30`
- Background: `--insic-surface` (#FFFFFF), border-right `--insic-border`
- Logo zone: 52px height, matching topbar
- Nav section labels: 11px, uppercase, tracking 0.08em, `--insic-text-muted`
- Nav items: 13.5px Inter medium, `rounded-md` (10px), height 36px, gap 10px
- Active state: `bg-[--insic-olive-50]` + left 3px olive indicator bar + olive icon
- Inactive: `--insic-text-secondary` text + `--insic-text-muted` icon
- Hover: `bg-[--insic-olive-50]` + `--insic-text-primary`
- User footer: 36px avatar, name, sign-out — 56px total zone

### 8.2 TopBar (all viewports)

- Height: 52px, fixed, `z-40`, border-bottom `--insic-border`
- Background: white/98, `backdrop-filter: blur(24px)` (glass-toolbar)
- Left: logo (hidden on lg+ — sidebar owns it), InsicAppIcon on mobile, lockup on sm–md
- Center: universal search (non-stock) or stock identity + price (stock pages)
- Right: Save button (stock pages), auth state
- Mobile stock context: ticker + price + daily change + search icon + save icon

### 8.3 Stock TabNav

- Sticky below topbar: `top: calc(52px + env(safe-area-inset-top, 0px))`
- Same glass-toolbar background
- Tabs: underline style. Active: `border-b-2 border-[--insic-olive-600]`, olive text
- Horizontal scroll on mobile, `scrollbar-hide`
- Tab height: 44px minimum
- Primary tabs (Overview, Valuation) 13px; secondary (Financials, Risks, News) 12px

### 8.4 Bottom navigation (mobile, below lg)

- Fixed bottom, safe-area-aware
- Center Analyze button: 48px olive circle, elevated above bar
- 4 flanking items: Markets, Screener | ETFs, More
- More drawer: slides up above nav bar
- Active: olive icon + olive label
- Touch target: minimum 44×44px

### 8.5 Landing Navbar

- Transparent on load, solid on scroll (glass-toolbar)
- Left: InsicLogoLockup; Right: Pricing, Sign in, Get started CTA
- Mobile: hamburger to drawer

---

## 9. Buttons

```tsx
<Button variant="default"     />  // Olive — primary CTA
<Button variant="outline"     />  // White + border — secondary
<Button variant="secondary"   />  // Tinted surface — tertiary
<Button variant="ghost"       />  // No border — icon/inline
<Button variant="destructive" />  // Red — irreversible actions only
<Button variant="link"        />  // Text link style
<Button variant="ink"         />  // Dark on dark-section contexts
```

Sizes: `landing` (44px), `default` (40px), `sm` (36px), `xs` (32px), `xxs` (28px), `icon`, `icon-sm`, `icon-xs`

Rules:
- One primary CTA per view
- Olive = primary only; never use for secondary/ghost
- Focus: 2px olive ring at 2px offset
- Inline `<button>` styled ad-hoc must be migrated to `<Button>`

---

## 10. Inputs and Forms

### Input
- Height: 40px
- Background: white, border `--insic-border`
- Radius: 10px
- Focus: `ring-2 ring-[rgba(95,121,11,0.25)] border-[--insic-olive-600]`
- Placeholder: `--insic-text-muted`

### SearchInput (specialized)
- Pill shape (`rounded-full`)
- Leading search icon, trailing clear button when populated
- Dropdown: white card, `rounded-xl`, `shadow-lg`
- Result rows: 44px minimum height
- **Consolidate** TopBar search, Analyze SearchHero, and ETFSearchBar into one `<SearchInput>` component

### Form layout
- Labels above inputs, 12px medium
- Error messages below, 12px, `--insic-negative`
- Helper text below, 11px, `--insic-text-muted`
- Group spacing: 16px between fields

---

## 11. Cards

### Variants
| Variant | Background | Border | Shadow | Use |
|---|---|---|---|---|
| `default` | white | `--insic-border` | `--shadow-card` | Most cards |
| `elevated` | white | `--insic-border` | `--shadow-md` | Featured modules |
| `flat` | `--insic-surface-muted` | `--insic-border` | none | Inline data blocks |
| `olive` | `--insic-olive-50` | `--insic-olive-100` | none | Highlighted context |
| `positive` | `--insic-positive-soft` | `--insic-positive-border` | none | Undervalued verdict |
| `negative` | `--insic-negative-soft` | `--insic-negative-border` | none | Overvalued verdict |
| `warning` | `--insic-warning-soft` | `--insic-warning-border` | none | Uncertain verdict |

### Card padding
| Size | Padding | Use |
|---|---|---|
| `sm` | 12px | Dense dashboard tiles |
| `default` | 16px | Standard cards |
| `lg` | 24px | Featured/hero cards |

### CardFooter
- Background: `--insic-surface-muted` (`#FBFAF7`)
- Border-top: `--insic-border`
- **Remove** current dark-glass footer (`rgba(10,22,40,0.4)`) — legacy artifact

---

## 12. MetricCard

```tsx
<MetricCard
  label="Fair value"
  value="$185.30"
  sub="DCF consensus"
  tone="positive"      // neutral | positive | negative | warning
  delta="+12.4%"
  deltaDirection="up"
/>
```

- Label: 11px uppercase, tracking 0.08em, `--insic-text-muted`
- Value: 24–28px, tabular-nums, `--insic-text-primary`
- Sub: 12px, `--insic-text-secondary`

---

## 13. Verdict System

### VerdictCard

Single canonical component replacing InvestmentVerdict, InvestorGradeCard, InvestorVerdictCard, and VerdictHero.

```tsx
<VerdictCard
  verdict="Undervalued"
  confidence="high"
  fairValue={185.30}
  currentPrice={164.20}
  upsidePct={0.129}
  currency="$"
  scenarioBear={140}
  scenarioBase={185}
  scenarioBull={230}
  modelCount={4}
  explanation="Market is pricing in 8.4% annual revenue CAGR..."
  primaryAction={{ label: "View full model", href: "/stock/AAPL/valuation" }}
/>
```

### Verdict state colors
| Verdict | Text | Bg | Border |
|---|---|---|---|
| Undervalued / Attractive | `#5F790B` olive | `--insic-olive-50` | `--insic-olive-100` |
| Fairly Priced | `#2563EB` info | `--insic-info-soft` | `--insic-info-border` |
| Expensive | `#B56A00` warning | `--insic-warning-soft` | `--insic-warning-border` |
| Overvalued | `#D83B3B` negative | `--insic-negative-soft` | `--insic-negative-border` |
| Uncertain | `#8A95A6` muted | `--insic-bg-subtle` | `--insic-border` |

Rules:
- No large alarming red backgrounds — soft tints only
- Always show confidence level and model count
- Never call a verdict a "prediction" — always "model output" or "estimate"
- Scenario range rendered as a gradient slider (Bear → Base → Bull)
- Current price shown as tick mark on scenario track

---

## 14. Badges

```tsx
<Badge tone="positive" />      // olive — undervalued, positive metric
<Badge tone="negative" />      // red — overvalued, negative metric
<Badge tone="warning" />       // amber — uncertain, moderate
<Badge tone="informational" /> // blue — analyst target, external data
<Badge tone="neutral" />       // gray — N/A, inactive
<Badge tone="brand" />         // olive brand — primary emphasis
```

- Height: 20px; Font: 11px medium; Radius: `rounded-full`; Padding: 6px horizontal
- Never use badge for non-status information

---

## 15. Tabs

### Line tabs (document-style — stock pages, data views)
- Active: `border-b-2 border-[--insic-olive-600]`, olive text
- Inactive: `--insic-text-secondary`, hover `--insic-text-primary`
- Background: transparent (no pill background)

### Pill tabs (compact switching — Monthly/Annual toggle)
- Active: `bg-[--insic-olive-100]` + `text-[--insic-olive-600]`
- Inactive: transparent, `--insic-text-secondary`
- Radius: 10px; Height: 32px

---

## 16. Tables

All tables use canonical `DataTable` built on `@tanstack/react-table`.

### Visual rules
- Header: 11px uppercase bold, `--insic-text-muted`, tracking 0.06em
- Row height: 40px default; 32px compact (financials)
- Financial values: **right-aligned**, `tabular-nums`
- Text values: left-aligned
- Empty value: em dash `—` (never N/A, dash, or blank)
- TTM column: `font-semibold` + `--insic-olive-50` bg tint
- Sticky header: `position: sticky; top: 0; z-index: 10; background: white`
- Sticky first column where needed
- Hover: `bg-[--insic-bg-subtle]`
- Border: bottom only `--insic-border` (no vertical borders)
- Mobile: `overflow-x-auto` wrapper

---

## 17. Charts

### Libraries
- **Recharts** — all financial/data charts
- **lightweight-charts** — price history only
- No mixing within the same module

### Canonical chart theme
```ts
export const chartTheme = {
  grid:   { stroke: 'var(--insic-border)', strokeDasharray: '2 4', opacity: 0.8 },
  axis:   { stroke: 'var(--insic-border)', tick: { fill: 'var(--insic-text-muted)', fontSize: 11 } },
  tooltip:{ bg: '#FFFFFF', border: 'var(--insic-border)', shadow: 'var(--shadow-lg)' },
  legend: { fontSize: 12, color: 'var(--insic-text-secondary)' },
  series: {
    marketPrice:   '#0A1424',  // ink — market price
    fairValue:     '#5F790B',  // olive — model fair value
    analystTarget: '#2563EB',  // info blue — external data
    revenue:       '#2563EB',  // blue — revenue bars
    income:        '#11875D',  // positive — net income / FCF
    loss:          '#D83B3B',  // negative — losses
    benchmark:     '#8A95A6',  // muted — index/benchmark
    bear:          '#D83B3B',  // bear scenario
    base:          '#5F790B',  // base scenario
    bull:          '#11875D',  // bull scenario
  },
  estimate: { strokeDasharray: '6 3' },
  strokeWidth: { default: 2, thin: 1.5, thick: 2.5 },
}
```

### Rules
- No 3D charts, no decorative glow, no neon colors
- Estimates always dashed
- `aria-label` on all chart containers
- `ResponsiveContainer` with `minHeight={200}` on all Recharts charts

---

## 18. Tooltips

```tsx
<InfoTooltip content="Explanation of this metric" />
```

- Max width: 280px; Background: `--insic-ink-900`; Text: white 12px
- Radius: 8px; Delay: 300ms open
- **Consolidate** `InfoTooltip.tsx` and `info-tooltip.tsx` into one file

---

## 19. Modals and Drawers

### Modal (Dialog)
- Overlay: `rgba(6, 16, 31, 0.5)`
- Panel: white, `rounded-2xl`, `shadow-float`, max-width 480px
- Close: `Button variant="ghost" size="icon-sm"` top-right
- Focus trap: required; Escape to close: required
- Animate: fade + scale 95%→100%

### Auth modals
Consolidate to `LoginModal variant="default" | "save" | "upgrade"`.

---

## 20. Empty States

```tsx
<EmptyState
  icon={<Bookmark />}
  title="No saved analyses yet"
  description="Search for a stock and save your first valuation."
  action={{ label: "Analyze a stock", href: "/analyze" }}
/>
```

- Icon: 40px, `--insic-text-muted`, centered
- Title: 16px medium; Description: 14px secondary
- Min height: 200px, vertically centered

---

## 21. Loading States

### CardSkeleton
- Background: `--insic-bg-subtle` (#F4F3EF) with `animate-pulse`
- Radius matches card radius
- Warm off-white — not cold gray or blue

### Page loading
- Skeleton cards in layout positions — no full-page spinner

---

## 22. Error States

Same structure as EmptyState. Icon: alert triangle, `--insic-negative`.
No alarming full-page red backgrounds.

---

## 23. Social Sharing Cards

Built via `@vercel/og` in `app/api/og/route.tsx` and `app/api/og/square/route.tsx`.

**Dimensions:** 1200×630 (OG) and 1080×1080 (square)

**Required elements:**
insic logo · company name + ticker · verdict badge · fair value (olive, large) · current price · upside/downside · scenario range bar · model outputs (up to 3) · market-implied CAGR · confidence indicator · `insic.app` · date · disclaimer strip

**Visual rules:**
- Background: `#FAF9F6` (light) or `#0A1424` (dark variant)
- Same typography, colors, and brand voice as the app
- No separate editorial or luxury aesthetic

---

## 24. Application Shell

### Desktop (lg+)
```
TopBar (52px, fixed, z-40) spans full width
Sidebar (240px, fixed, z-30) left column
Main content: pl-[240px] pt-[52px] max-w PageContainer
```

### Mobile (< lg)
```
TopBar (52px, fixed, z-40)
Main content: pt-[52px] pb-safe-nav
BottomNav (56px + safe area, fixed z-50)
```

### Stock pages
```
TopBar (stock context) → TabNav (sticky 44px) → Tab content
```

---

## 25. Marketing Shell

Alternating sections: ink hero → white → `--insic-bg-subtle` → white → ink FinalCTA.
All sections: same horizontal padding, `--content-full` (1440px) max-width.
Same Button, Badge, Card, typography as app — no separate marketing design language.

---

## 26. Authentication Shell

Modal-based auth (maintain current pattern). Requirements:
- insic logo, olive CTA, warm white background
- Canonical Input, Button components
- No generic auth templates

---

## 27. Accessibility

| Requirement | Standard | Status |
|---|---|---|
| Text contrast (body) | WCAG AA 4.5:1 | `--insic-text-primary` on white = 12:1 ✓ |
| `--insic-text-secondary` on white | WCAG AA | `#566174` = 5.2:1 ✓ |
| `--insic-text-muted` on white | Info only | 3.1:1 — not for body text |
| Focus rings | WCAG 2.4.7 | 2px olive ring, 2px offset |
| Touch targets | WCAG 2.5.5 | 44×44px minimum |
| Keyboard nav | WCAG 2.1.1 | Arrow keys on tabs, Escape on modals |
| Focus trapping | WCAG 2.1.2 | All modals/drawers |
| Color independence | WCAG 1.4.1 | Icons/labels alongside color for all status |
| Reduced motion | WCAG 2.3.3 | `useReducedMotion()` on all animations |
| Semantic headings | WCAG 1.3.1 | h1 per page, h2 sections, h3 cards |
| Chart descriptions | WCAG 1.1.1 | `aria-label` on all chart containers |

---

## 28. Migration Order (Phase 5)

1. Token migration — globals.css + tailwind.config.ts
2. Shared primitives — Badge (tone), Card (fix footer), MetricCard, VerdictCard
3. PageContainer, PageHeader, SectionHeader
4. AppShell dimensions + BottomNav
5. Analyze page
6. Stock pages (all 5 tabs)
7. Valuations / Screener — DataTable migration
8. Markets — color token migration
9. ETF / Portfolio / Monitor
10. Pricing — Button, Card, Badge
11. Landing — verify alignment
12. Modals consolidation
13. Charts — apply chartTheme
14. OG cards redesign
15. Empty / Loading / Error states
16. Remaining routes
17. QA sweep

---

*End of Design System Specification — 2026-06-07*
