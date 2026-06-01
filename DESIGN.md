---
name: Intrinsico
description: DCF-based stock valuation platform for self-directed investors
colors:
  blueprint-blue: "#2563EB"
  blueprint-blue-deep: "#1D4ED8"
  blueprint-blue-hover: "#60A5FA"
  blueprint-blue-tint: "#DBEAFE"
  deep-frame: "#050D1F"
  mid-frame: "#0A1628"
  raised-frame: "#0E1F36"
  page-ground: "#F1F5F9"
  card-surface: "#FFFFFF"
  card-tinted: "#F8FAFC"
  border-default: "#E2E8F0"
  border-strong: "#CBD5E1"
  ink-primary: "#0F172A"
  ink-secondary: "#334155"
  ink-muted: "#64748B"
  semantic-up: "#059669"
  semantic-up-tint: "#D1FAE5"
  semantic-down: "#DC2626"
  semantic-down-tint: "#FEE2E2"
  semantic-warn: "#D97706"
  semantic-warn-tint: "#FEF3C7"
  neon-cyan: "#06B6D4"
typography:
  display:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5.5vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.04em"
  headline:
    fontFamily: "Space Grotesk, system-ui, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  body:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.06em"
  mono:
    fontFamily: "DM Mono, IBM Plex Mono, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  "2xl": "48px"
components:
  button-primary:
    backgroundColor: "{colors.blueprint-blue}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  button-primary-hover:
    backgroundColor: "{colors.blueprint-blue-hover}"
  button-outline:
    backgroundColor: "transparent"
    textColor: "#CBD5E1"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "#94A3B8"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  button-destructive:
    backgroundColor: "rgba(239,68,68,0.1)"
    textColor: "#F87171"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.md}"
    padding: "6px 10px"
  card-glass-light:
    backgroundColor: "rgba(255,255,255,0.62)"
    textColor: "{colors.ink-primary}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card-glass-dark:
    backgroundColor: "rgba(10,22,40,0.50)"
    textColor: "#F8FAFC"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Intrinsico

## 1. Overview

**Creative North Star: "The Research Brief"**

Intrinsico's visual system is built around a single premise: every screen is a deliverable. Not a dashboard to glance at — a research brief to read, trust, and act on. The design translates institutional-quality valuation analysis into a structured, direct artifact: hierarchical, confident, with nothing decorative standing between the investor and the signal.

The UI operates in two physical zones. The **light content zone** — white cards on cool slate (#F1F5F9) — is where analysis lives: DCF tables, fair value estimates, company overviews. The **deep frame zone** — navigation and chrome in near-black navy (#050D1F) — holds the UI together without competing. The two zones are unified by a single accent: Blueprint Blue (#2563EB), used sparingly and with intent. Elevation is expressed through iOS Liquid Glass — frosted planes, blur, white hairline highlights — giving surfaces physical presence without adding decorative mass.

This system explicitly rejects four fintech aesthetic families. Bloomberg Terminal: dense, unreadable without years of training, hierarchy-free data walls. Robinhood: gamified, confetti-on-gains, chart theater and casino energy. Generic SaaS dashboard: metric-card grids, gradient text, eyebrows above every section — the saturated AI reflex. Traditional broker portals: dated tables, bureaucratic shells, 2005-era enterprise fatigue. When in doubt about a design decision, test it against all four. If it reads as any of them, rethink.

**Key Characteristics:**
- Two-zone system (light content / deep frame) unified by a single accent blue
- Glass layering as the primary elevation system: blur depth, opacity, and white highlight seams
- Space Grotesk display + Inter body: geometric confidence paired with analytical precision
- Financial semantics (up/down/warn) always carry a non-color indicator
- Motion is purposeful — state feedback, scroll reveals, and entrances only; no choreography for its own sake
- Mono numbers in tabular financial data; Inter everywhere else

## 2. Colors: The Blueprint Navy Palette

Two zones, one accent — everything else earns its presence through meaning.

### Primary
- **Blueprint Blue** (#2563EB): The single UI authority. CTAs, active states, focus rings, links, and progress indicators. Its presence is a signal, not decoration. Used on ≤30% of any surface. Hover state: Blueprint Blue Deep (#1D4ED8). Brightened state: Blueprint Blue Hover (#60A5FA) for active highlights.
- **Blueprint Blue Tint** (#DBEAFE): Background fills for info callouts, selected states, and badge fills. Never a body background.

### Secondary
- **Neon Cyan** (#06B6D4): Secondary chart accent for contrast with primary blue in data visualization. UI chrome only when directly paired with a data series — never standalone navigation.

### Tertiary (financial semantics)
- **Semantic Up** (#059669, tint #D1FAE5): Positive values, gains, undervalued signals. Always paired with a directional icon or label — never color alone.
- **Semantic Down** (#DC2626, tint #FEE2E2): Negative values, loss, downside. Always paired with a directional indicator.
- **Semantic Warn** (#D97706, tint #FEF3C7): Caution states, fair-value zones, pricing signals. Always labeled.

### Neutral
- **Page Ground** (#F1F5F9): Body background. Cool slate — never warm, never cream. This is the difference between a research tool and a lifestyle app.
- **Card Surface** (#FFFFFF): White card surfaces on the light zone. No tint.
- **Card Tinted** (#F8FAFC): Slightly elevated card, alternating rows, nested surfaces.
- **Border Default** (#E2E8F0): Card edges, table dividers, input strokes at rest.
- **Border Strong** (#CBD5E1): Prominent separators, active input borders.
- **Ink Primary** (#0F172A): Headings, primary body copy. Near-black.
- **Ink Secondary** (#334155): Supporting copy, metadata, descriptions.
- **Ink Muted** (#64748B): Captions, footnotes, disabled labels. Must achieve ≥4.5:1 against Page Ground — test before shipping.
- **Deep Frame** (#050D1F): Navigation shell, dark hero background.
- **Mid Frame** (#0A1628): Elevated surfaces within the dark frame.
- **Raised Frame** (#0E1F36): Cards rendered inside the deep frame zone.

**The One Accent Rule.** Blueprint Blue is the only color with UI authority. Cyan, green, red, and amber are semantic data colors — they describe what the numbers mean. They never carry navigation, CTA, or branding roles. Promoting a semantic color to a UI role is the one unforgivable palette failure.

**The Cool Ground Rule.** The page background stays at #F1F5F9. The warm-neutral band (cream, sand, paper, linen, bone) is the saturated AI default of 2026. Intrinsico's analytical character lives in cool slate. If warmth is needed, it comes through brand accents and imagery, not the body background.

## 3. Typography

**Display Font:** Space Grotesk (with system-ui, sans-serif fallback)
**Body Font:** Inter (with system-ui, sans-serif fallback)
**Mono Font:** DM Mono (with IBM Plex Mono, monospace fallback)

**Character:** Space Grotesk's geometric confidence anchors display hierarchy; Inter's neutral precision carries analysis copy without competing. DM Mono holds the numbers. The pairing reads as a research analyst's toolkit: no warmth for its own sake, no decorative letterforms, no ambiguity.

### Hierarchy
- **Display** (Space Grotesk 700, clamp(2rem, 5.5vw, 4.25rem), lh 1.05, ls -0.04em): Landing hero headline only. One per page.
- **Headline** (Space Grotesk 800, 1.75rem, lh 1.2, ls -0.02em): Stock page primary title, major section anchors.
- **Title** (Inter 700, 1.25rem, lh 1.3): Section headers, prominent card titles, modal titles.
- **Subhead** (Inter 600, 1rem, lh 1.4): Sub-section labels, strong metadata, callout leads.
- **Body** (Inter 400, 1rem, lh 1.5): Analysis copy, descriptions. Max line length 65–75ch.
- **Label** (Inter 700, 0.6875rem, lh 1.4, ls 0.06em): Metric labels, table column headers, status badges. Uppercase only for strings ≤4 words.
- **Micro** (Inter 400, 0.6875rem, lh 1.4): Timestamps, source attribution, footnotes.
- **Mono** (DM Mono 400, 0.875rem, lh 1.5): DCF projections, price series, ratios in financial tables. Always `font-variant-numeric: tabular-nums`.

**The Mono Number Rule.** Tabular numerical data renders in DM Mono with tabular-nums. Body copy and labels stay in Inter. Mixing mono into prose is a visual tell; mixing Inter into financial tables loses column alignment. The distinction is the line between clarity and noise.

**The Scale Rule.** Hero/display ceiling is clamp(2rem, 5.5vw, 4.25rem). Above 4.25rem the page is announcing itself, not informing. Financial users are not here to admire typography — they are reading to decide.

## 4. Elevation: The Glass Layering System

Intrinsico uses iOS Liquid Glass as its elevation system. Depth is expressed through blur depth, opacity, and white highlight intensity — not shadow darkness. Flat surfaces are at rest; glass surfaces are raised. The hierarchy from most to least elevated: glass-bottom-nav > glass-toolbar > glass-card-light > glass-panel.

### Glass Vocabulary

- **Glass Card Light** (`background: rgba(255,255,255,0.62); backdrop-filter: blur(28px) saturate(200%) brightness(1.05); border: 1px solid rgba(255,255,255,0.72); border-top-color: rgba(255,255,255,0.90); box-shadow: 0 1px 0 rgba(255,255,255,0.95) inset, 0 4px 24px rgba(99,102,241,0.08), 0 2px 8px rgba(0,0,0,0.05)`): Primary card surface on the light page zone. The white hairline seam at the top edge is the tactile signature of this system. Hover lifts 1px and deepens the shadow.
- **Glass Card Dark** (`background: rgba(10,22,40,0.50); backdrop-filter: blur(28px) saturate(200%); border: 1px solid rgba(255,255,255,0.10); box-shadow: 0 0 30px rgba(59,130,246,0.06), inset 0 1px 0 rgba(255,255,255,0.07)`): Cards within the deep frame zone.
- **Glass Toolbar** (`background: rgba(255,255,255,0.78); backdrop-filter: blur(32px) saturate(200%) brightness(1.04); border-bottom: 1px solid rgba(255,255,255,0.72); box-shadow: 0 1px 0 rgba(255,255,255,0.92) inset, 0 2px 16px rgba(99,102,241,0.06), 0 1px 4px rgba(0,0,0,0.04)`): Fixed navigation bars. More opaque than cards; the border divider is a gradient white seam.
- **Glass Bottom Nav** (`background: rgba(255,255,255,0.82); backdrop-filter: blur(40px) saturate(210%) brightness(1.05); border-top: 1px solid rgba(255,255,255,0.80)`): Most opaque glass surface. White seam at the top edge. Used for mobile bottom navigation only.
- **Glass Panel** (`background: rgba(248,250,252,0.58); backdrop-filter: blur(24px) saturate(180%) brightness(1.03)`): Sidebar panels, secondary content surfaces. Less prominent than cards.

### Legacy Shadow Vocabulary (supplementary)
- **card** (`0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`): Ambient resting state. Fallback for `backdrop-filter` unsupported.
- **card-md** (`0 4px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.05)`): Hover lift state.
- **glow-sm** (`0 0 12px rgba(37,99,235,0.2), 0 0 4px rgba(37,99,235,0.1)`): Blueprint Blue focus halo. Used on primary buttons and active nav items.
- **glow-md / glow-lg**: Reserved for hero accent elements only. Not for interactive components.

**The Glass-First Rule.** New components on the light surface use glass-card-light. New components in the dark frame use glass-card. The legacy flat `card` shadow is a fallback for no-`backdrop-filter` contexts, not a design choice. Never combine glass treatment AND a heavy box-shadow on the same element; the glass already provides lift.

**The Purposeful Glass Rule.** Glass is a structural material separating surface layers, not a decorative texture. Applied to elements that do not need elevation separation, it is glassmorphism — and that is on the prohibited list.

## 5. Components

### Buttons

Gently rounded (8px, `rounded-md`), unambiguous, scale-consistent at 32px default height. The border-radius is fixed — never pill-shaped, never sharp.

- **Primary:** #2563EB background, white text, `glow-sm` shadow at rest. Hover: brightens to #60A5FA, glow deepens. The only button that leads with color. Used once per action group.
- **Outline:** Transparent background, `rgba(59,130,246,0.3)` border, slate-200 text. Hover: border to `rgba(59,130,246,0.5)`, `white/5` background tint. Secondary actions in the dark frame.
- **Secondary:** `rgba(59,130,246,0.1)` glass background, `rgba(59,130,246,0.2)` border, blue-300 text. Paired actions that support but don't lead.
- **Ghost:** No border, no background. Slate-400 text at rest, white on hover. Tertiary actions, icon-only triggers.
- **Destructive:** `rgba(239,68,68,0.1)` glass background, `rgba(239,68,68,0.2)` border, red-400 text. Confirmation dialogs only — never a primary CTA.

### Input Fields

Transparent ground, stroke-defined boundary. Height 32px, 8px radius. Border is slate-200 at rest; shifts to ring (blue-600) on focus with a `ring-3 ring-ring/50` halo. No filled background except `dark:bg-input/30` within the dark frame. Label stays above the field — no float animation. `font-size: max(16px, 1em)` prevents iOS auto-zoom.

### Cards

**Glass Card Light** on the page ground. 12px radius (`rounded-xl`). 16px internal padding; 12px for small cards. `CardFooter` uses a `rgba(10,22,40,0.4)` tinted background with a blue-tinted top border — signals secondary context without a hard border rule. Hover: 1px upward translate, shadow deepens.

**Glass Card Dark** within the deep frame. Same radius and padding, navy glass treatment.

### Navigation — TopBar

Fixed. Glass toolbar treatment. Dark-framed with `glass-nav` backdrop filter. Contains: logo left, primary links center, search and user right. Tab navigation for stock detail pages sits inline — active state is a blue underline indicator, not a filled pill. No left-border stripes; no sidebar indicators.

### Navigation — BottomNav (mobile)

`glass-bottom-nav`. Five-item tab bar. Icon 24px + label 10px, Inter 700, letter-spacing 0.06em. Active: Blueprint Blue icon, full-opacity label. Inactive: slate-400, muted label. Touch targets ≥44px. The white seam at the top edge is the visual anchor; no top border drawn separately.

### Chips / Status Badges

Rounded-full. Semantic tinted backgrounds with matching text and border colors. Always a non-color indicator alongside (directional label or icon):
- Positive: `bg-emerald-50 text-emerald-700 border border-emerald-200`
- Caution / fair: `bg-amber-50 text-amber-700 border border-amber-200`
- Negative: `bg-red-50 text-red-600 border border-red-200`
- Info: `bg-blue-50 text-blue-700 border border-blue-200`

### DCF Data Tables (signature component)

The system's most distinctive surface. Clean tabular layout, sticky first column (company name / metric label). DM Mono numbers with tabular-nums. Column groups: historical (white), TTM (#FEFCE8 amber tint), projected (#EFF6FF blue tint). Column headers in Label style. Row hover: `bg-slate-50`. No decorative chrome — the structure is the design.

## 6. Do's and Don'ts

### Do:
- **Do** use Blueprint Blue (#2563EB) as the sole navigation and CTA accent color. Every other color in this palette has a semantic or data role.
- **Do** pair all color-coded financial values (green/red/amber) with a directional icon or explicit text label. Color alone fails color-blind users and the WCAG AA baseline.
- **Do** render tabular financial data in DM Mono with `font-variant-numeric: tabular-nums`. Mono in tables, Inter everywhere else — never mixed.
- **Do** use glass-card-light for new cards on the page-ground surface, and glass-card for cards in the dark frame zone.
- **Do** keep body copy within 65–75ch. Financial analysis is dense; line length is the single highest-leverage readability control.
- **Do** keep the page background at #F1F5F9. This is a research tool. The cool slate is not a mood; it is a judgment call.
- **Do** express elevation through blur depth and glass opacity. Depth in this system is physical, not tonal.
- **Do** include `@media (prefers-reduced-motion: reduce)` alternatives for every animation. Crossfade or instant state change. Financial users on medication, vestibular conditions, or simply in focus mode need the static version.
- **Do** use `text-wrap: balance` on h1–h3 and `text-wrap: pretty` on analysis prose to prevent orphan words.

### Don't:
- **Don't** design toward Bloomberg Terminal density: hierarchy-free data walls, packed monochromatic rows, no primary call to attention. Every screen has a leading element; every table has a reading order.
- **Don't** use Robinhood-style gamification: animated price tickers on hover, green confetti, chart theater, or any element that performs excitement rather than delivers clarity. Users making investment decisions want confidence, not stimulation.
- **Don't** use generic SaaS dashboard conventions: hero-metric templates (big number + small label + gradient), identical card grids repeating icon + heading + text, tiny tracked uppercase eyebrows above every section. This is the saturated AI reflex — it signals that no one made a choice.
- **Don't** echo traditional broker portal aesthetics: heavy tables with no hierarchy, legacy form controls, bureaucratic shells without any visual rhythm or brand presence.
- **Don't** use gradient text (`background-clip: text` with a gradient background). Blueprint Blue is already the voice. It does not need to glow.
- **Don't** use `border-left` greater than 1px as a colored accent stripe on cards, list items, or callouts. Rewrite with a background tint, a leading icon, a number, or nothing.
- **Don't** warm the page background. The warm-neutral band — cream, sand, linen, bone, paper, parchment — is the AI default of 2026. Intrinsico runs on #F1F5F9. Warmth is carried by accents and content, not the ground.
- **Don't** promote semantic colors (green, red, amber) to navigation or CTA roles. A green "Start Free Trial" button or a red "Analyze" CTA is a semantic mismatch that erodes trust in the data colors.
- **Don't** apply glass treatment to decorative elements that do not need elevation separation. Glass is structural. Decorative glass is glassmorphism — prohibited.
- **Don't** use glow-md or glow-lg on interactive components. The large glows are hero-only accents. On buttons or cards they read as SaaS cliché, not precision.
