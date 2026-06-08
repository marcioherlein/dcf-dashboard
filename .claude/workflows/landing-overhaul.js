export const meta = {
  name: 'landing-overhaul',
  description: 'Harden, polish, and craft improvements for the insic landing page: animated financial hero bg, animation flow, mobile alignment fixes',
  phases: [
    { title: 'Build', detail: 'Fix hero background animation, animation flow, mobile alignment, token drift, copy hardening' },
    { title: 'iOS Audit', detail: 'Run focused iOS audit on landing components' },
    { title: 'Adversarial Review', detail: '3 independent adversarial agents testing mobile, desktop, and design quality' },
    { title: 'Fix', detail: 'Apply adversarial findings' },
  ],
}

const ROOT = '/Users/i502042/Desktop/dcf-dashboard'

// ── PHASE 1: BUILD ────────────────────────────────────────────────────────────
phase('Build')

// Cluster A: Animated hero background + hero mobile fixes
const clusterA = agent(
  `You are improving the insic landing page hero at ${ROOT}/components/landing/LandingHero.tsx.

DESIGN SYSTEM context:
- Background: #000000 (hero is always black)
- Olive accent: #5F790B, lighter olive: #7C9A19
- White text on black hero
- Motion library: motion/react (already imported, use it)
- Reduced motion must always be respected
- No gradient text (absolute ban)
- useReducedMotion hook already used in this file as "reduced"

YOUR TASKS:

## Task 1: Add animated financial background to the hero

Inside LandingHero.tsx, create a new component called HeroBackground that:
- Receives props: { reduced }
- Returns an absolutely-positioned div (inset-0, pointer-events-none, z-0, aria-hidden="true", overflow-hidden)
- Contains an SVG at 100% width/height that shows subtle animated financial chart elements
- All elements have very low opacity (0.06-0.14) so they never compete with content

SVG contents:
1. Horizontal grid lines at y=20%, 40%, 60%, 80% — stroke rgba(255,255,255,0.06), strokeWidth 0.5
2. Vertical tick marks every ~10% of width — small lines, stroke rgba(255,255,255,0.04)
3. A slow-rising olive price line: a curved path from bottom-left to upper-right area, stroke rgba(95,121,11,0.22), strokeWidth 1.5, no fill
4. A secondary white price line at lower opacity: stroke rgba(255,255,255,0.06), strokeWidth 1

Animation approach (CSS @keyframes, not JS for performance):
- Add a <style> tag inside the component (or inline className) with:
  @keyframes chartDrift { 0% { transform: translateY(0px) } 100% { transform: translateY(-12px) } }
- Apply to the price lines: animation: chartDrift 7s ease-in-out infinite alternate
- When reduced is true: do not apply the animation (no style or animation: none)

Place HeroBackground inside the hero section, BEFORE the content div, with absolute positioning.
Also keep the existing radial olive gradient div (it's already there, just add HeroBackground alongside it).

## Task 2: Hero mobile alignment fixes

In the same file:
1. Badge text: find "Institutional-quality valuation tools for individual investors" → change to "DCF-grade analysis tools for individual investors"
2. Headline lines: add style={{ textWrap: 'balance' }} to each motion.div that renders a headline line
3. Product card wrapper: find max-w-[420px] → change to max-w-[360px] sm:max-w-[420px] lg:max-w-none
4. Hero section paddingBottom: change clamp(40px, 5vh, 80px) → clamp(52px, 6vh, 80px)

Read the file carefully, implement both tasks, write back the complete updated file.`,
  { label: 'hero:bg+mobile', phase: 'Build' }
)

// Cluster B: Animation flow fixes
const clusterB = agent(
  `You are fixing animation patterns across the insic landing page. The problem: every section uses identical opacity+y fade-up. Fix each file to use a distinct entrance pattern.

FILES TO FIX:

## 1. ${ROOT}/components/landing/HowItWorksSection.tsx
Change the header motion.div entrance:
- FROM: initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55 }}
- TO: initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6, ease: [0.16,1,0.3,1] }}
The step items already have distinct animations (spring pops, directional slides) — keep those as-is.
The connector line scaleX animation — keep as-is, it's already distinctive.

## 2. ${ROOT}/components/landing/TestimonialsSection.tsx
Change the left column entrance:
- Add filter blur: initial={{ opacity: 0, x: -24, filter: 'blur(6px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
Change the VALUES list items:
- FROM: initial={{ opacity: 0, x: -16 }}
- TO: initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
(Switch from horizontal to vertical for the value list to differentiate from the column entrance)

## 3. ${ROOT}/components/landing/TransparencySection.tsx
Read this full file first.
Change the main section header entrance to a scale reveal:
- initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.55, ease: [0.16,1,0.3,1] }}
For feature cards (if any cards exist): alternate entrance directions — even-indexed cards use y:20, odd-indexed use y:-20

## 4. ${ROOT}/components/landing/FinalCTASection.tsx
Read this full file first.
Change the main heading/CTA block entrance to a clip reveal:
- The main animated div: initial={{ opacity: 0, y: 24 }} → keep opacity but change y to be larger: y: 32
- Add a blur: initial={{ opacity: 0, y: 32, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 0.65, ease: [0.16,1,0.3,1] }}
- The search box (if animated separately): initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} with a slight delay (0.15s after heading)

Read each file, make targeted animation-only changes. Keep all useReducedMotion guards intact. Keep the reduced ? {} : { ... } pattern.`,
  { label: 'animations:flow', phase: 'Build' }
)

// Cluster C: Token drift + copy hardening
const clusterC = agent(
  `You are fixing token drift and copy issues in the insic landing page.

## Task 1: Fix token drift in ${ROOT}/components/landing/ReverseDCFSection.tsx

Read the file. Replace old tokens:
- '#06101F' → '#111111'
- '#566174' → '#6B6B6B'
- '#8A95A6' → '#9B9B9B' (only for decorative/icon uses, NOT body copy)
- '#E6ECF5' → '#E5E5E5'
- Background '#F4F3EF' → '#F5F5F5'
- borderTop/borderBottom '1px solid #E3E1DA' → '1px solid #E5E5E5'

Mobile fixes in ReverseDCFSection:
- Stock card Link elements: add p-4 sm:p-5 (reduce mobile padding)
- The grid gap: style={{ gap: '40px' }} → add a responsive version: className="gap-8 lg:gap-[40px]" and remove the inline gap style

## Task 2: Copy fixes in ${ROOT}/components/landing/HowItWorksSection.tsx

Read the file and change step body copy:
- "Find any public company in seconds." → "Type a ticker — data loads immediately."
- "See what has to be true at today's price." → "Review fair value, upside, and what growth the price requires."
- "Adjust key drivers and explore different scenarios." → "Change growth and margin assumptions to test your own thesis."

## Task 3: Copy fixes in ${ROOT}/components/landing/TestimonialsSection.tsx

Read the file and fix the VALUES array copy:
- "Ignore noise. Follow the process." → "Cut through noise with a repeatable framework."
- "Make better decisions with clarity" → "Build positions based on numbers, not narrative"
Other values — keep as-is.

## Task 4: Bottom safe area in ${ROOT}/components/landing/FinalCTASection.tsx

Read the file. The landing page has a BottomNav (56px + safe area) that shows on mobile via AppShell.
Find the innermost content container div and add pb-safe-nav to it if it does not already have bottom padding that clears mobile nav.
Add: className includes "pb-safe-nav lg:pb-0" or similar. Check what's already there and only add if missing.

Read each file carefully, make all changes, write back.`,
  { label: 'tokens+copy+harden', phase: 'Build' }
)

// Cluster D: ProductDeepDive + pricing mobile
const clusterD = agent(
  `You are fixing the ProductDeepDive and Pricing sections of the insic landing page.

## Task 1: Fix ${ROOT}/components/landing/ProductDeepDiveSection.tsx

Read the full file. Fix:
1. Any gradient text (background-clip: text + gradient background) → replace with solid #111111 or #5F790B
2. Any side-stripe borders (border-left/border-right > 1px as colored accent on cards) → remove or replace with full border + bg tint
3. Section header animation: if using opacity+y fade, change to scale reveal: initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} duration 0.55
4. Mobile overflow: any container with fixed widths that could overflow on mobile → add max-w-full overflow-hidden
5. Old tokens: '#06101F' → '#111111', '#566174' → '#6B6B6B'

## Task 2: Fix ${ROOT}/components/landing/PricingSection.tsx mobile

Read the full file. Fix:
1. Pricing cards grid: ensure it is grid-cols-1 sm:grid-cols-2 (not side-by-side on mobile)
2. CTA buttons inside pricing cards: ensure min-h-[52px] py-3.5 (not py-2 or py-2.5)
3. The Pro card highlight: should use bg-[#F6FAEA] border-[#5F790B] olive system, not blue accent for the highlighted/popular card
4. Feature list check icons: ensure the text items have break-words (not truncate) — features need to wrap on mobile
5. If there's a pricing toggle that might be too narrow on mobile: ensure it works at 320px without overflow

## Task 3: Fix ${ROOT}/components/landing/MarketTeaserSection.tsx

Read the full file. Fix:
1. Old token colors: replace '#566174' → '#6B6B6B', '#8A95A6' → '#9B9B9B', '#06101F' → '#111111'
2. Any whileInView props: if this file uses whileInView instead of the useInView + animate pattern used by other sections, convert to useInView pattern for consistency (only if the section currently uses whileInView — check first)
3. Mobile padding: if the data section has px-8 or px-6, reduce to px-4 sm:px-8 on mobile for breathing room

Read each file, make targeted fixes, write back.`,
  { label: 'deepdive+pricing+teaser', phase: 'Build' }
)

await parallel([
  () => clusterA,
  () => clusterB,
  () => clusterC,
  () => clusterD,
])

log('Build phase complete — running iOS audit on landing')

// ── PHASE 2: iOS AUDIT ────────────────────────────────────────────────────────
phase('iOS Audit')

const iosAudit = await agent(
  `Run a focused iOS mobile audit specifically on the insic landing page components at ${ROOT}.

Read these files:
1. ${ROOT}/components/landing/LandingNavbar.tsx
2. ${ROOT}/components/landing/LandingHero.tsx
3. ${ROOT}/components/landing/HowItWorksSection.tsx
4. ${ROOT}/components/landing/PricingSection.tsx
5. ${ROOT}/components/landing/FinalCTASection.tsx
6. ${ROOT}/components/landing/LandingFooter.tsx

For each file, check:
- Touch targets: are all buttons/links min-h-[44px]?
- Input font sizes: any input with font-size < 16px triggers iOS zoom
- overflow-hidden parents clipping scrollable children
- min-h-screen that should be min-h-dvh
- Text that overflows at 390px width (long strings without word-wrap)
- Bottom safe area clearance on the last section

Return JSON: { issues: [{ file, line, issue, fix, severity }] }`,
  {
    label: 'ios:landing-audit',
    phase: 'iOS Audit',
    schema: {
      type: 'object',
      required: ['issues'],
      properties: {
        issues: {
          type: 'array',
          items: {
            type: 'object',
            required: ['file', 'line', 'issue', 'fix', 'severity'],
            properties: {
              file: { type: 'string' },
              line: { type: 'string' },
              issue: { type: 'string' },
              fix: { type: 'string' },
              severity: { type: 'string', enum: ['critical', 'high', 'medium'] },
            },
          },
        },
      },
    },
  }
)

const critCount = (iosAudit.issues || []).filter(i => i.severity === 'critical').length
const highCount = (iosAudit.issues || []).filter(i => i.severity === 'high').length
log(`iOS audit: ${critCount} critical, ${highCount} high`)

if (iosAudit.issues && iosAudit.issues.length > 0) {
  await agent(
    `Apply these iOS mobile fixes to the insic landing page components at ${ROOT}.

Issues:
${JSON.stringify(iosAudit.issues.filter(i => i.severity !== 'medium'), null, 2)}

For each: read the file, apply the fix, write back. Skip if the fix is already present.`,
    { label: 'ios:apply-fixes', phase: 'iOS Audit' }
  )
}

// ── PHASE 3: ADVERSARIAL REVIEW ───────────────────────────────────────────────
phase('Adversarial Review')

const [mobileReview, desktopReview, designReview] = await parallel([

  () => agent(
    `You are an adversarial mobile UX reviewer. Find every problem with the insic landing page on a 390px wide iPhone 15.

Read these files at ${ROOT}/components/landing/:
LandingHero.tsx, LandingNavbar.tsx, HowItWorksSection.tsx, MarketTeaserSection.tsx, TestimonialsSection.tsx, PricingSection.tsx, FinalCTASection.tsx

Be brutal. Find:
1. Text that overflows or wraps badly at 390px
2. Touch targets smaller than 44px
3. Padding too large (wastes vertical space) or too small (content touches screen edges)
4. Font sizes too small to read comfortably (below 13px for body content)
5. Animations that will be janky on mobile or feel wrong
6. Content hidden or clipped on mobile that users need
7. CTAs that are awkward to tap (too close together, too small)
8. Safe area issues
9. The hero animated background: will SVG animation work on mobile without lag?
10. Does the page feel complete and purposeful on mobile?

For each problem: file, location, problem, fix, severity (critical/high/medium/low).
Return JSON: { problems: [{ file, location, problem, fix, severity }] }`,
    {
      label: 'adversarial:mobile',
      phase: 'Adversarial Review',
      schema: {
        type: 'object',
        required: ['problems'],
        properties: {
          problems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'location', 'problem', 'fix', 'severity'],
              properties: {
                file: { type: 'string' },
                location: { type: 'string' },
                problem: { type: 'string' },
                fix: { type: 'string' },
                severity: { type: 'string' },
              },
            },
          },
        },
      },
    }
  ),

  () => agent(
    `You are an adversarial desktop UX reviewer. Find every problem with the insic landing page on a 1440px desktop.

Read these files at ${ROOT}/components/landing/:
LandingHero.tsx, HowItWorksSection.tsx, MarketTeaserSection.tsx, ReverseDCFSection.tsx, TestimonialsSection.tsx, TransparencySection.tsx, PricingSection.tsx, FinalCTASection.tsx

Find:
1. Layout issues at wide screens (max-width, centering, container behavior)
2. Typography problems (line lengths too wide, hierarchy issues, heading sizes)
3. Spacing issues (too much or too little whitespace between sections)
4. Animation issues (entrances that look wrong at desktop, timing problems)
5. Color contrast failures (gray text on colored backgrounds)
6. Absolute bans violations: gradient text, side-stripe borders, identical card grids, tiny uppercase tracked eyebrows on every section
7. Section rhythm: do the black/white/#F5F5F5 alternating sections create good rhythm?
8. Narrative: does the section order tell a clear story?
9. Hero: is the mock card appropriately sized at desktop? Does it fill the right column well?
10. Brand voice: does the page feel sharp, confident, and opinionated?

For each problem: file, location, problem, fix, severity.
Return JSON: { problems: [{ file, location, problem, fix, severity }] }`,
    {
      label: 'adversarial:desktop',
      phase: 'Adversarial Review',
      schema: {
        type: 'object',
        required: ['problems'],
        properties: {
          problems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'location', 'problem', 'fix', 'severity'],
              properties: {
                file: { type: 'string' },
                location: { type: 'string' },
                problem: { type: 'string' },
                fix: { type: 'string' },
                severity: { type: 'string' },
              },
            },
          },
        },
      },
    }
  ),

  () => agent(
    `You are an adversarial design quality reviewer for a fintech landing page. Find design quality issues, AI slop, and brand inconsistencies.

Read these files at ${ROOT}/components/landing/:
LandingHero.tsx, HowItWorksSection.tsx, ReverseDCFSection.tsx, TestimonialsSection.tsx, TransparencySection.tsx, PricingSection.tsx, FinalCTASection.tsx, LandingFooter.tsx

DESIGN RULES to check against:
- Olive #5F790B is the ONLY CTA color. Blue #2563EB is for secondary/info/links ONLY — never primary CTA
- Black/white/#F5F5F5 three-tier section system
- No gradient text (background-clip: text + gradient)
- No side-stripe borders (border-left/right > 1px as colored accent on cards)
- No tiny uppercase tracked eyebrows above every single section (one deliberate one is fine)
- No identical card grids (icon + heading + text, repeated 3-4 times)
- Text primary: #111111, secondary: #6B6B6B, muted (decorative only): #9B9B9B
- #9B9B9B FAILS WCAG AA on white — must NOT be body copy
- No em-dashes. No buzzwords (seamless/empower/supercharge/transform/world-class/enterprise-grade)
- Button labels: verb + object

Find:
1. Blue CTAs that should be olive
2. #9B9B9B used as body text (contrast failure)
3. Gradient text
4. Section eyebrows on every heading (AI grammar)
5. Identical card grids
6. Em-dashes or buzzwords in copy
7. Uniform fade-up animation on every section (the reflex — all sections same entrance)
8. Anything that screams AI-generated
9. Missing interaction states on key elements
10. Copy that sounds generic, not like the sharp/confident/opinionated brand

For each problem: file, location, problem, fix, severity.
Return JSON: { problems: [{ file, location, problem, fix, severity }] }`,
    {
      label: 'adversarial:design',
      phase: 'Adversarial Review',
      schema: {
        type: 'object',
        required: ['problems'],
        properties: {
          problems: {
            type: 'array',
            items: {
              type: 'object',
              required: ['file', 'location', 'problem', 'fix', 'severity'],
              properties: {
                file: { type: 'string' },
                location: { type: 'string' },
                problem: { type: 'string' },
                fix: { type: 'string' },
                severity: { type: 'string' },
              },
            },
          },
        },
      },
    }
  ),
])

// ── PHASE 4: APPLY ADVERSARIAL FIXES ──────────────────────────────────────────
phase('Fix')

const allProblems = [
  ...((mobileReview && mobileReview.problems) ? mobileReview.problems.filter(p => p.severity === 'critical' || p.severity === 'high') : []),
  ...((desktopReview && desktopReview.problems) ? desktopReview.problems.filter(p => p.severity === 'critical' || p.severity === 'high') : []),
  ...((designReview && designReview.problems) ? designReview.problems.filter(p => p.severity === 'critical' || p.severity === 'high') : []),
]

log(`Applying ${allProblems.length} critical/high findings from adversarial agents`)

if (allProblems.length > 0) {
  // Group by file
  const byFile = {}
  for (const p of allProblems) {
    const key = p.file || 'unknown'
    if (!byFile[key]) byFile[key] = []
    byFile[key].push(p)
  }

  await parallel(
    Object.entries(byFile).map(([file, fileProblems]) => () => agent(
      `Apply adversarial review fixes to the insic landing component.

File: ${ROOT}/${file.replace(/^\/+/, '')}

Problems to fix:
${JSON.stringify(fileProblems, null, 2)}

Instructions:
1. Read the file first
2. Apply each fix exactly as described
3. If two fixes conflict, apply the more conservative one
4. Keep all useReducedMotion guards
5. No gradient text, no blue CTAs

Write the updated file back.`,
      { label: `fix:${file.split('/').pop()}`, phase: 'Fix' }
    ))
  )
}

// Final TypeScript check
const tsCheck = await agent(
  `Run TypeScript check on the landing components at ${ROOT}.

Execute: cd ${ROOT} && npx tsc --noEmit 2>&1 | head -40

Report errors if any. Then run: git diff --stat components/landing/ app/page.tsx app/globals.css

Report results concisely.`,
  { label: 'verify:tsc+diff', phase: 'Fix' }
)

return {
  buildClusters: 4,
  iosIssues: (iosAudit && iosAudit.issues) ? iosAudit.issues.length : 0,
  adversarialProblems: allProblems.length,
  mobileProblems: (mobileReview && mobileReview.problems) ? mobileReview.problems.length : 0,
  desktopProblems: (desktopReview && desktopReview.problems) ? desktopReview.problems.length : 0,
  designProblems: (designReview && designReview.problems) ? designReview.problems.length : 0,
  tsCheck,
}
