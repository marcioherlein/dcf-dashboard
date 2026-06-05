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
  # Dark frame (nav, hero sections, dark CTA blocks)
  ink-950: "#06101F"
  ink-900: "#0A1424"
  ink-800: "#111C2E"
  ink-700: "#1B2A3D"
  # Light content surfaces
  bg: "#F8F7F2"
  bg-soft: "#F3F2EC"
  surface: "#FFFFFF"
  surface-subtle: "#FBFAF7"
  border: "#E3E6E0"
  border-strong: "#CBD1C4"
  # Text hierarchy
  text-primary: "#0A1424"
  text-secondary: "#536174"
  text-muted: "#8A96A8"
  text-faint: "#B6BFCC"
  # Supporting blue (secondary actions, links, info)
  blue-600: "#2563EB"
  blue-100: "#EAF1FF"
  blue-50: "#F4F7FF"
  # Financial semantics
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
    boxShadow: "0 4px 16px rgba(6,16,31,0.05)"
---

# Design System: insic

## 1. Overview

**Creative North Star: "The Research Brief"**

insic's visual language is an opinionated editorial system for financial research. Every screen is a deliverable — not a dashboard to glance at, but a research brief to read, trust, and act on.

The palette is warm-editorial: a cream ground (#F8F7F2) that reads as paper-on-a-desk, not lifestyle-app warmth. Olive (#5F790B) is the single brand accent — it carries all CTA, active state, and verdict authority. The warm ground is intentional contrast against every cool-slate / corporate-blue fintech, not a default. The deep ink navy (#0A1424) holds the dark chrome (nav, hero sections, dark CTA blocks).

**Key Characteristics:**
- Olive (#5F790B) is the sole CTA and active-state color. It carries brand authority. Blue (#2563EB) is a supporting accent for links, secondary actions, and info states only — never the primary CTA.
- Inter is the only UI font at all sizes. Weight + scale contrast carries hierarchy. No display serif, no geometric sans hybrid.
- Warm cream ground (#F8F7F2) is the deliberate identity. Sections alternate between cream and white for rhythm, never cool slate.
- Financial semantics (green/red/amber) always carry a non-color indicator (icon, label, direction text).
- Motion is purposeful: state feedback, scroll reveals, and entrances. Reduced-motion support on every animation.
- The dark ink (#0A1424) zone is used exclusively for the nav bar, hero sections, and the FinalCTA block. Not for cards or content surfaces.

## 2. Colors

### Primary Brand
- **Olive 700** (#5F790B): The sole CTA, active nav, primary accent. Brand authority. CTAs, active states, selected indicators, focus rings. Never used as a data/semantic color.
- **Olive 600** (#6F8F12): Hover state for olive CTAs.
- **Olive 100** (#EEF4DD): Chip backgrounds, badge fills, tinted card accents for "positive/attractive" verdicts.
- **Olive 50** (#F6FAEA): Very light tint for selected states, hover backgrounds.

### Supporting Accent
- **Blue 600** (#2563EB): Secondary actions, links, chart legend markers, info callouts. Never the primary CTA. The "Fairly Valued" verdict state uses this as its accent.

### Content Surfaces
- **BG** (#F8F7F2): Page body background. Warm cream — the deliberate editorial ground. Shared by hero, alternate sections, pricing.
- **BG Soft** (#F3F2EC): Slightly more muted than BG. Used for nested panels, hover states.
- **Surface** (#FFFFFF): Card backgrounds, section alternates (HowItWorks, Testimonials). Provides rhythm between cream and white sections.
- **Surface Subtle** (#FBFAF7): Sidebar panels, secondary content areas.
- **Border** (#E3E6E0): Card edges, table dividers, input strokes.
- **Border Strong** (#CBD1C4): Active input borders, prominent separators.

### Ink (Text)
- **Text Primary** (#0A1424): Headings, primary body copy. Near-black with slight navy tint. Contrast ≥7:1 on all light surfaces.
- **Text Secondary** (#536174): Supporting copy, metadata. Must achieve ≥4.5:1 against BG (#F8F7F2). **Note: #536174 fails on BG (#F8F7F2) at ~2.9:1. Use `#36455A` on BG surfaces; #536174 is safe on Surface (#FFFFFF) at ~4.6:1.**
- **Text Muted** (#8A96A8): Captions, footnotes, disabled labels. Safe on both Surface and BG.
- **Text Faint** (#B6BFCC): Decorative or barely-visible supporting text only.

### Dark Frame
- **Ink 900** (#0A1424): Navigation shell, hero sections, dark CTA block. Near-black navy.
- **Ink 800** (#111C2E): Elevated surfaces within the dark frame.

### Financial Semantics
- **Positive** (#11875D, soft #E8F7EF): Undervalued, gains, upward direction. Always paired with an icon or label.
- **Negative** (#D83B3B, soft #FCEAEA): Overvalued, losses, downward direction. Always paired with a directional indicator.
- **Warn** (#B56A00, soft #FFF4DA): Caution, fair-value zone, moderate signals. Always labeled.

**The One Accent Rule.** Olive is the only color with CTA authority. Blue, green, red, and amber are role-specific: blue for links/info, green/red/amber for financial semantics. Never promote a semantic color to a CTA role.

**The Secondary Text Rule.** `#536174` passes WCAG AA on white (`#FFFFFF`, ratio ~4.6:1) but fails on the cream background (`#F8F7F2`, ratio ~2.9:1). Use `#36455A` for body/secondary text that sits directly on the cream background. On white card surfaces, `#536174` is acceptable.

## 3. Typography

**Font:** Inter (single-family system; weight + scale contrast carries all hierarchy)
**Mono:** DM Mono (financial tables, price series, numeric data)

Inter is the only UI font. Using a second display typeface adds no value and risks picking a reflex-reject (Space Grotesk, DM Sans, Plus Jakarta Sans). The hero heading's weight-800 + letter-spacing tight + large clamp scale makes it read as display without a separate family.

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

Soft shadow system, no glass blur on standard content cards. Glass backdrop-filter is reserved for the fixed nav bar only, where it's structural (physically separates nav layer from scroll content).

- **Card resting**: `0 4px 16px rgba(6,16,31,0.05)` — barely-there shadow, white card on cream ground.
- **Card hover**: `0 12px 32px rgba(6,16,31,0.09)` + 1px upward translate.
- **Card strong**: `0 8px 24px rgba(6,16,31,0.06)` — for cards that need more presence (hero card, verdict card).
- **Nav (glass-toolbar)**: `background: rgba(255,255,255,0.90); backdrop-filter: blur(24px) saturate(180%); border-bottom: 1px solid {colors.border}`.
- **Dark nav**: `background: rgba(6,16,31,0.88); backdrop-filter: blur(32px)` — hero/landing sections only.

## 5. Components

### Buttons
Rounded 10px. 44px minimum height (touch target compliance). Text: 14px Inter 600.

- **Primary** (olive): `bg-[#5F790B]`, white text, `box-shadow: 0 4px 12px rgba(95,121,11,0.25)`. Hover: `bg-[#526A08]`, deeper shadow. The only button that leads with color.
- **Outline** (secondary): White bg, `border: 1px solid #CBD1C4`, ink text. Hover: `bg-[#F6FAEA]`, olive border. Second-rank actions.
- **Ghost**: No bg, no border. Secondary text color. Tertiary / destructive-adjacent actions.

### Cards
`bg-white border border-[#E3E6E0] rounded-xl` (16px). `box-shadow: 0 4px 16px rgba(6,16,31,0.05)`. Hover: y -3px lift, shadow deepens. Internal padding: 20–24px. 12px for compact cards.

### Nav (Landing)
Floating pill. `bg-white/97 backdrop-blur-xl`. Box shadow deepens on scroll. Primary CTA: olive button (right edge). Nav links: Inter 500 14.5px, `#536174` at rest → `#0A1424` on hover.

### Chips / Status Badges
Rounded-full. Semantic tinted backgrounds. Always include a non-color indicator:
- Positive/Attractive: `bg-[#E8F7EF] text-[#11875D] border border-[#A3D9BE]`
- Fairly Valued: `bg-[#EAF1FF] text-[#2563EB] border border-[#BFDBFE]`
- Overvalued/Negative: `bg-[#FCEAEA] text-[#D83B3B] border border-[#F0B8B8]`
- Warn/Moderate: `bg-[#FFF4DA] text-[#B56A00] border border-[#F3D391]`

### Section Backgrounds (Landing Alternation)
- BG (#F8F7F2): Hero, Transparency, Pricing, FinalCTA
- Surface white (#FFFFFF): HowItWorks, Testimonials, ProductDeepDive

This alternation creates rhythm without relying on color variation.

## 6. Do's and Don'ts

### Do:
- Use olive (#5F790B) as the sole CTA and active-state accent. Every other color has a specific semantic role.
- Use `#36455A` (not `#536174`) for secondary text on the cream background (#F8F7F2). `#536174` only passes contrast on white surfaces.
- Pair all financial color signals (green/red/amber) with a directional icon or explicit label.
- Use `text-wrap: balance` on h1–h3, `text-wrap: pretty` on prose blocks.
- Include `useReducedMotion()` guard on every animation. Fallback: `{}` (instant).
- Keep touch targets ≥44px on all interactive elements.
- Alternate section backgrounds (cream / white) for page rhythm.

### Don't:
- Don't use blue (#2563EB) as a primary CTA. Blue is for links, info callouts, and secondary actions. Olive owns the CTA role.
- Don't use `#536174` as body or secondary text on the `#F8F7F2` cream background — it fails WCAG AA contrast. Use `#36455A` instead.
- Don't apply tracked uppercase eyebrows above every section heading. One deliberate kicker as a named brand system is voice; repeated eyebrows on every section is AI grammar.
- Don't apply uniform fade-up entrance animations to every element on a page. Vary by element type and what it reveals.
- Don't use gradient text or side-stripe border accents.
- Don't promote semantic colors (green, red, amber) to CTA or navigation roles.
