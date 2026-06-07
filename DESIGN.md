---
name: insic
description: DCF-based stock valuation platform for self-directed investors
colors:
  # Brand primary — olive (CTA, active nav, primary accent)
  olive-700: "#5F790B"
  olive-600: "#6F8F12"
  olive-500: "#7C9A19"
  olive-100: "#EEF4DD"
  olive-50: "#F6FAEA"
  # Dark frame (hero sections, FinalCTA block, footer)
  ink-950: "#0A0A0A"
  ink-900: "#111111"
  ink-800: "#1C1C1C"
  ink-700: "#2A2A2A"
  # Light content surfaces
  bg: "#FFFFFF"
  bg-soft: "#F5F5F5"
  surface: "#FFFFFF"
  surface-subtle: "#FAFAFA"
  border: "#E5E5E5"
  border-strong: "#C8C8C8"
  # Text hierarchy
  text-primary: "#111111"
  text-secondary: "#6B6B6B"
  text-muted: "#9B9B9B"
  text-faint: "#C4C4C4"
  # Supporting blue (secondary actions, links, info)
  blue-600: "#2563EB"
  blue-100: "#EAF1FF"
  blue-50: "#F4F7FF"
  # Financial semantics (unchanged — functional color)
  positive: "#11875D"
  positive-soft: "#E8F7EF"
  negative: "#D83B3B"
  negative-soft: "#FCEAEA"
  warn: "#B56A00"
  warn-soft: "#FFF4DA"
typography:
  display:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(2rem, 9.5vw, 3.75rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.015em"
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
  lg: "10px"
  xl: "16px"
  "2xl": "20px"
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
    backgroundColor: "{colors.olive-700}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
    minHeight: "44px"
  button-outline:
    backgroundColor: "#ffffff"
    textColor: "{colors.text-primary}"
    border: "1px solid {colors.border-strong}"
    rounded: "{rounded.lg}"
    padding: "10px 24px"
    minHeight: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "#ffffff"
    border: "1px solid {colors.border}"
    rounded: "{rounded.xl}"
    padding: "20px"
    boxShadow: "0 4px 16px rgba(0,0,0,0.05)"
---

# Design System: insic

## 1. Overview

**Creative North Star: "The Research Brief"**

insic's visual language is an opinionated editorial system for financial research. Every screen is a deliverable — not a dashboard to glance at, but a research brief to read, trust, and act on.

The palette is black-and-white with a single olive accent. Pure white ground (#FFFFFF) reads as clinical precision — the blank page of a research document. Olive (#5F790B) is the single brand accent carrying all CTA, active state, and verdict authority. The contrast between the white body, the pure black hero/FinalCTA dark anchors, and the olive accent creates a confident editorial identity distinct from every other fintech aesthetic.

**Key Characteristics:**
- Olive (#5F790B) is the sole CTA and active-state color. It carries brand authority. Blue (#2563EB) is a supporting accent for links, secondary actions, and info states only — never the primary CTA.
- Inter is the only UI font at all sizes. Weight + scale contrast carries hierarchy. No display serif, no geometric sans hybrid.
- Pure white ground (#FFFFFF) is the deliberate identity. Section rhythm is created through dark anchor blocks (hero, FinalCTA), structural off-white (#F5F5F5) for alternating sections, and borders/spacing — not through warm tinting.
- Financial semantics (green/red/amber) always carry a non-color indicator (icon, label, direction text).
- Motion is purposeful: state feedback, scroll reveals, and entrances. Reduced-motion support on every animation.
- The pure black (#000000 / #111111) zone is used exclusively for the hero section and FinalCTA block. Not for cards or content surfaces.

## 2. Colors

### Primary Brand
- **Olive 700** (#5F790B): The sole CTA, active nav, primary accent. Brand authority. CTAs, active states, selected indicators, focus rings, DCF projected column tint. Never used as a data/semantic color.
- **Olive 600** (#6F8F12): Hover state for olive CTAs.
- **Olive 100** (#EEF4DD): Chip backgrounds, badge fills, tinted card accents for "positive/attractive" verdicts.
- **Olive 50** (#F6FAEA): Very light tint for selected states, DCF projected column background, hover backgrounds.

### Supporting Accent
- **Blue 600** (#2563EB): Secondary actions, links, chart legend markers, info callouts. Never the primary CTA. The "Fairly Valued" verdict state uses this as its accent.

### Content Surfaces
- **BG / Surface** (#FFFFFF): Page body background and card backgrounds. Clean white — the deliberate editorial ground.
- **BG Soft** (#F5F5F5): Alternating landing sections (Transparency, Pricing), nested panels, hover states. Creates section rhythm without warm tinting.
- **Surface Subtle** (#FAFAFA): Sidebar panels, secondary content areas, subtle row hover.
- **Border** (#E5E5E5): Card edges, table dividers, input strokes.
- **Border Strong** (#C8C8C8): Active input borders, prominent separators.

### Ink (Text)
- **Text Primary** (#111111): Headings, primary body copy. Near-black, pure neutral. Contrast ≥16:1 on white.
- **Text Secondary** (#6B6B6B): Supporting copy, metadata. ~5.74:1 on white — WCAG AA. ~4.8:1 on #F5F5F5 — WCAG AA.
- **Text Muted** (#9B9B9B): Captions, footnotes, disabled labels. ~2.85:1 on white — decorative only, not body copy.
- **Text Faint** (#C4C4C4): Decorative or icon tints only.

### Dark Anchors (Landing Only)
- **Pure Black** (#000000): Hero section and FinalCTA block backgrounds. Creates bookend contrast on the landing page.
- **Near Black** (#111111): Footer background (slightly lifted from pure black for depth).
- **Ink 800** (#1C1C1C): Elevated surfaces within dark zones.

### Financial Semantics (Unchanged)
- **Positive** (#11875D, soft #E8F7EF): Undervalued, gains, upward direction. Always paired with an icon or label.
- **Negative** (#D83B3B, soft #FCEAEA): Overvalued, losses, downward direction. Always paired with a directional indicator.
- **Warn** (#B56A00, soft #FFF4DA): Caution, fair-value zone, moderate signals. Always labeled.

**The One Accent Rule.** Olive is the only color with CTA authority. Blue, green, red, and amber are role-specific: blue for links/info, green/red/amber for financial semantics. Never promote a semantic color to a CTA role.

**The Muted Text Rule.** `#9B9B9B` (~2.85:1 on white) does NOT pass WCAG AA for body text. Use it only for decorative elements, disabled states, or icon fills. For any readable label or caption, use `#6B6B6B` minimum.

## 3. Typography

**Font:** Inter (single-family system; weight + scale contrast carries all hierarchy)
**Mono:** DM Mono (financial tables, price series, numeric data)

Inter is the only UI font. The hero heading's weight-800 + letter-spacing tight + large clamp scale makes it read as display without a separate family.

### Scale
- **Display** (Inter 800, clamp(2rem, 9.5vw, 3.75rem), lh 1.05, ls -0.035em): Landing hero headline only.
- **Headline** (Inter 700, clamp(1.5rem, 3vw, 2rem), lh 1.15, ls -0.025em): Section anchors, major page titles.
- **Title** (Inter 700, 1.25rem, lh 1.3, ls -0.015em): Section headers, card titles.
- **Subhead** (Inter 600, 1rem, lh 1.4): Sub-section labels, callout leads.
- **Body** (Inter 400, 1rem, lh 1.5): Copy, descriptions. Max 65–75ch line length.
- **Label** (Inter 700, 0.6875rem, lh 1.4, ls 0.06em): Metric labels, badges. Uppercase only for ≤4 words.
- **Micro** (Inter 400, 0.6875rem, lh 1.4): Timestamps, footnotes.
- **Mono** (DM Mono 400, 0.875rem, lh 1.5): Financial tables and numeric data. Always `font-variant-numeric: tabular-nums`.

## 4. Elevation

Soft shadow system using pure black at low opacity. No glass blur on standard content cards. Glass backdrop-filter is reserved for the fixed nav bar only.

- **Card resting**: `0 4px 16px rgba(0,0,0,0.05)` — barely-there shadow, white card on white ground (border carries more weight now).
- **Card hover**: `0 12px 32px rgba(0,0,0,0.09)` + 1px upward translate.
- **Card strong**: `0 8px 24px rgba(0,0,0,0.06)` — for cards that need more presence.
- **Nav (glass-toolbar)**: `background: rgba(255,255,255,0.90); backdrop-filter: blur(24px) saturate(180%); border-bottom: 1px solid #E5E5E5`.
- **Dark hero/FinalCTA**: `background: #000000` — pure black, no glass.

**Note on white-on-white elevation:** On a white ground, card shadows are very subtle. Borders (#E5E5E5) carry more visual weight than they did on the cream ground. This is intentional — the design relies on structure (borders, spacing, typography) rather than shadow depth.

## 5. Components

### Buttons
Rounded 10px. 44px minimum height (touch target compliance). Text: 14px Inter 600.

- **Primary** (olive): `bg-[#5F790B]`, white text, `box-shadow: 0 4px 12px rgba(95,121,11,0.25)`. Hover: `bg-[#526A08]`, deeper shadow. The only button that leads with color.
- **Outline** (secondary): White bg, `border: 1px solid #C8C8C8`, ink text. Hover: `bg-[#F6FAEA]`, olive border. Second-rank actions.
- **Ghost**: No bg, no border. `#6B6B6B` text. Tertiary / destructive-adjacent actions.

### Cards
`bg-white border border-[#E5E5E5] rounded-xl` (16px). `box-shadow: 0 4px 16px rgba(0,0,0,0.05)`. Hover: y -3px lift, shadow deepens. Internal padding: 20–24px. 12px for compact cards.

### Nav (Landing)
Floating pill. `bg-white/97 backdrop-blur-xl`. Box shadow deepens on scroll. Primary CTA: olive button (right edge). Nav links: Inter 500 14.5px, `#6B6B6B` at rest → `#111111` on hover.

### Chips / Status Badges
Rounded-full. Semantic tinted backgrounds. Always include a non-color indicator:
- Positive/Attractive: `bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]`
- Fairly Valued: `bg-[#EAF1FF] text-[#2563EB] border border-[#BFDBFE]`
- Overvalued/Negative: `bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]`
- Warn/Moderate: `bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]`
- Neutral/Insufficient: `bg-[#F5F5F5] text-[#6B6B6B] border border-[#E5E5E5]`

### Section Backgrounds (Landing Three-Tier System)
- **Black anchors** (#000000): Hero section, FinalCTA block — create bookend dark contrast
- **White content** (#FFFFFF): HowItWorks, Testimonials, ProductDeepDive, Navbar
- **Off-white structural** (#F5F5F5): Transparency, Pricing — provides rhythm between black anchors and white sections
- **Olive accent moment** (#F6FAEA + olive border): Pricing Pro card highlight only

This three-tier system (black / white / off-white) replaces the old cream/white alternation and creates stronger editorial contrast.

## 6. Do's and Don'ts

### Do:
- Use olive (#5F790B) as the sole CTA and active-state accent. Every other color has a specific semantic role.
- Use `#6B6B6B` (not `#9B9B9B`) for any secondary text that needs to be readable. `#9B9B9B` is decorative only.
- Pair all financial color signals (green/red/amber) with a directional icon or explicit label.
- Use `text-wrap: balance` on h1–h3, `text-wrap: pretty` on prose blocks.
- Include `useReducedMotion()` guard on every animation. Fallback: `{}` (instant).
- Keep touch targets ≥44px on all interactive elements.
- Use borders (#E5E5E5) as the primary surface separator — shadows are now very subtle on white-on-white.
- Use the three-tier section system (black / white / #F5F5F5) for landing page rhythm.

### Don't:
- Don't use blue (#2563EB) as a primary CTA. Blue is for links, info callouts, and secondary actions. Olive owns the CTA role.
- Don't use `#9B9B9B` for body text — it fails WCAG AA on white. Use `#6B6B6B` minimum for readable copy.
- Don't apply tracked uppercase eyebrows above every section heading.
- Don't apply uniform fade-up entrance animations to every element on a page. Vary by element type and what it reveals.
- Don't use gradient text or side-stripe border accents.
- Don't promote semantic colors (green, red, amber) to CTA or navigation roles.
- Don't rely on card shadows alone for surface separation on white — use borders.
