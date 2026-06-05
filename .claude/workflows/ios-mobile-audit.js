export const meta = {
  name: 'ios-mobile-audit',
  description: 'Full iOS mobile audit: scan every component and page, plan redesigns, report critical issues with exact fixes',
  phases: [
    { title: 'Discover', detail: 'Collect all components, pages, layout files and globals' },
    { title: 'Layout Audit', detail: 'Audit shell, navigation, safe areas, viewport' },
    { title: 'Component Audit', detail: 'Parallel audit of every component file' },
    { title: 'Page Audit', detail: 'Parallel audit of every page route' },
    { title: 'Synthesize', detail: 'Deduplicate, prioritize, compile final report' },
  ],
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const ISSUE_SCHEMA = {
  type: 'object',
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'category', 'file', 'lineHint', 'problem', 'fix', 'iosImpact'],
        properties: {
          severity:  { type: 'string', enum: ['critical', 'high', 'medium', 'low', 'none'] },
          category:  { type: 'string', enum: [
            'touch-target', 'safe-area', 'viewport', 'overflow',
            'typography', 'layout-collapse', 'navigation', 'form-input',
            'performance', 'animation', 'ios-safari-bug', 'already-good'
          ]},
          file:      { type: 'string' },
          lineHint:  { type: 'string' },
          problem:   { type: 'string' },
          fix:       { type: 'string' },
          iosImpact: { type: 'string' },
        },
      },
    },
    summary: { type: 'string' },
  },
  required: ['issues', 'summary'],
}

// ─── iOS Audit Prompt ────────────────────────────────────────────────────────

function auditPrompt(filePath, context) {
  return `You are a senior iOS mobile optimization engineer auditing a Next.js + Tailwind financial dashboard (insic).

CODEBASE CONTEXT:
- Tailwind breakpoints: sm=640px, md=768px, lg=1024px (mobile = below lg)
- BottomNav bar: 56px + safe-area-inset-bottom, z-50, lg:hidden
- TopBar: fixed, two-row on stock pages (88px total), single-row elsewhere (52px)
- AppShell adds pb-safe-nav (calc(4rem + safe-area-inset-bottom)) on mobile
- Brand: olive accent #5F790B, Inter font, warm cream palette
- viewport: viewportFit=cover is set in layout.tsx — safe area CSS env() is available
- globals.css defines: .pb-safe, .pt-safe, .pb-safe-nav utilities
- Primary routes: /, /analyze, /stock/[ticker], /screener, /markets, /etf, /valuations, /simplifier, /pricing

APPLE IOS STANDARDS TO ENFORCE:
1. Touch targets: minimum 44×44px (buttons, links, interactive elements)
2. Safe areas: env(safe-area-inset-top/bottom/left/right) on fixed/sticky elements near edges
3. Viewport: no horizontal overflow — check for fixed widths, min-w without overflow-x-auto
4. Typography: no font-size below 16px on INPUT fields (triggers iOS zoom); UI labels can be 11px+ if non-interactive
5. iOS Safari quirks: no position:fixed inside scroll containers; -webkit-overflow-scrolling is deprecated; use overscroll-behavior
6. Scrollable areas: overflow-x-auto tables MUST have a scroll parent — overflow-hidden on a parent silently clips it
7. Layout collapse: grids with many columns must collapse (use sm:/md: breakpoints not just lg:)
8. Forms: use correct input type (email, tel, number, search) for iOS keyboard
9. Animation: prefer transform/opacity for animations — layout-affecting animations cause jank on iOS
10. Notch/Dynamic Island: fixed elements at top MUST account for safe-area-inset-top if viewportFit=cover

${context}

FILE TO AUDIT: ${filePath}

Read the file at ${filePath}, then audit it against every standard above.

For each issue found, report:
- severity: critical (breaks UX), high (significant degradation), medium (noticeable), low (minor), none (not applicable/already good)
- category: one of the categories in the schema
- file: exact file path
- lineHint: line number or range (e.g. "line 45" or "lines 120-135")
- problem: precise description of what's wrong
- fix: exact Tailwind class changes or code snippet needed
- iosImpact: what a user on iPhone 15 (390px) actually experiences

Also note elements that are ALREADY correctly handled for mobile (severity: none, category: already-good) — this helps track coverage.

Return a complete ISSUES array. Be specific — do not hallucinate issues. Only report what you actually read in the code.`
}

// ─── Synthesis Prompt ────────────────────────────────────────────────────────

function synthesisPrompt(allIssues) {
  return `You are synthesizing a full iOS mobile audit of the insic Next.js dashboard.

Here are all issues found across every component and page:

${JSON.stringify(allIssues, null, 2)}

Your job:
1. DEDUPLICATE issues that reference the same root cause across files
2. PRIORITIZE: critical first, then high, then medium
3. IDENTIFY PATTERNS: e.g. "touch targets are systematically too small in 12 files" → one root-cause fix
4. FLAG QUICK WINS: changes under 5 lines that fix critical/high issues
5. GROUP by theme: Navigation, Layout, Tables/Data, Forms, Typography, Safe Areas, Scroll

Produce a final structured report in markdown with:

## iOS Mobile Audit Report — insic Dashboard

### Executive Summary
(2-3 sentences on overall mobile readiness)

### Critical Issues (breaks usability on iPhone)
For each: **File** | **Problem** | **Exact Fix**

### High Priority
Same format.

### Medium Priority
Same format.

### Quick Wins (≤5 line changes, critical/high severity)
For each: file path, exact before/after code change

### Pattern Fixes (one change that fixes multiple files)
For each: the pattern, all affected files, the fix

### Already Well-Handled
What's already correct and doesn't need changes.

### Coverage Stats
- Total files audited
- Critical: N, High: N, Medium: N, Low: N
- Quick wins: N

Be precise. Name exact files and line numbers. Do not invent issues.`
}

// ─── Main Workflow ───────────────────────────────────────────────────────────

phase('Discover')

const discovery = await agent(
  `List all auditable files in the insic Next.js dashboard at /Users/i502042/Desktop/dcf-dashboard.

Run these commands:
1. find /Users/i502042/Desktop/dcf-dashboard/components -name "*.tsx" | sort
2. find /Users/i502042/Desktop/dcf-dashboard/app -name "*.tsx" | grep -v "route.tsx" | sort
3. cat /Users/i502042/Desktop/dcf-dashboard/components/layout/AppShellClient.tsx
4. cat /Users/i502042/Desktop/dcf-dashboard/app/globals.css | grep -A3 "safe\\|pb-safe\\|pt-safe\\|bottom-nav"

Return a JSON object with:
{
  "components": [...list of all component .tsx paths...],
  "pages": [...list of all page .tsx paths...],
  "appShellSummary": "...key mobile classes from AppShellClient...",
  "safeAreaUtils": "...safe area utilities defined in globals.css..."
}`,
  {
    label: 'discover:files',
    phase: 'Discover',
    schema: {
      type: 'object',
      required: ['components', 'pages', 'appShellSummary', 'safeAreaUtils'],
      properties: {
        components:       { type: 'array', items: { type: 'string' } },
        pages:            { type: 'array', items: { type: 'string' } },
        appShellSummary:  { type: 'string' },
        safeAreaUtils:    { type: 'string' },
      },
    },
  }
)

const { components, pages, appShellSummary, safeAreaUtils } = discovery

log(`Discovered ${components.length} components and ${pages.length} pages — starting parallel audit`)

const sharedContext = `
AppShell mobile classes: ${appShellSummary}
Safe area utilities in globals.css: ${safeAreaUtils}
`

// ─── Layout Audit (sequential — foundational) ────────────────────────────────

phase('Layout Audit')

const layoutFiles = [
  '/Users/i502042/Desktop/dcf-dashboard/components/layout/AppShellClient.tsx',
  '/Users/i502042/Desktop/dcf-dashboard/components/layout/TopBar.tsx',
  '/Users/i502042/Desktop/dcf-dashboard/components/layout/BottomNav.tsx',
  '/Users/i502042/Desktop/dcf-dashboard/components/layout/Sidebar.tsx',
  '/Users/i502042/Desktop/dcf-dashboard/components/layout/Header.tsx',
  '/Users/i502042/Desktop/dcf-dashboard/app/layout.tsx',
]

const layoutResults = await parallel(
  layoutFiles.map(f => () => agent(
    auditPrompt(f, sharedContext),
    { label: `layout:${f.split('/').pop()}`, phase: 'Layout Audit', schema: ISSUE_SCHEMA }
  ))
)

const layoutIssues = layoutResults
  .filter(Boolean)
  .flatMap(r => r.issues)

log(`Layout audit complete — ${layoutIssues.length} issues found across ${layoutFiles.length} layout files`)

// ─── Component Audit (parallel batches) ─────────────────────────────────────

phase('Component Audit')

// Skip pure shadcn/ui primitives — they're library code, not custom
const SKIP_PATTERNS = [
  '/components/ui/alert.tsx',
  '/components/ui/badge.tsx',
  '/components/ui/button.tsx',
  '/components/ui/card.tsx',
  '/components/ui/dialog.tsx',
  '/components/ui/drawer.tsx',
  '/components/ui/dropdown-menu.tsx',
  '/components/ui/input.tsx',
  '/components/ui/progress.tsx',
  '/components/ui/scroll-area.tsx',
  '/components/ui/select.tsx',
  '/components/ui/separator.tsx',
  '/components/ui/sheet.tsx',
  '/components/ui/skeleton.tsx',
  '/components/ui/table.tsx',
  '/components/ui/tabs.tsx',
  '/components/ui/toggle.tsx',
  '/components/ui/toggle-group.tsx',
  '/components/ui/tooltip.tsx',
]

const auditableComponents = components.filter(
  f => !SKIP_PATTERNS.some(skip => f.endsWith(skip))
)

log(`Auditing ${auditableComponents.length} custom components (skipping ${components.length - auditableComponents.length} shadcn primitives)`)

const componentResults = await pipeline(
  auditableComponents,
  f => agent(
    auditPrompt(f, sharedContext),
    { label: `component:${f.split('/').slice(-2).join('/')}`, phase: 'Component Audit', schema: ISSUE_SCHEMA }
  )
)

const componentIssues = componentResults
  .filter(Boolean)
  .flatMap(r => r.issues)

log(`Component audit complete — ${componentIssues.length} issues across ${auditableComponents.length} components`)

// ─── Page Audit (parallel) ───────────────────────────────────────────────────

phase('Page Audit')

const auditablePages = pages.filter(f =>
  !f.includes('/api/') &&
  !f.endsWith('error.tsx') &&
  !f.endsWith('providers.tsx') &&
  !f.endsWith('ETFCompareContent.tsx')
)

const pageResults = await pipeline(
  auditablePages,
  f => agent(
    auditPrompt(f, sharedContext),
    { label: `page:${f.split('/').slice(-3).join('/')}`, phase: 'Page Audit', schema: ISSUE_SCHEMA }
  )
)

const pageIssues = pageResults
  .filter(Boolean)
  .flatMap(r => r.issues)

log(`Page audit complete — ${pageIssues.length} issues across ${auditablePages.length} pages`)

// ─── Synthesize ──────────────────────────────────────────────────────────────

phase('Synthesize')

const allIssues = [...layoutIssues, ...componentIssues, ...pageIssues]

const criticalCount = allIssues.filter(i => i.severity === 'critical').length
const highCount     = allIssues.filter(i => i.severity === 'high').length
const mediumCount   = allIssues.filter(i => i.severity === 'medium').length

log(`Total issues: ${allIssues.length} (${criticalCount} critical, ${highCount} high, ${mediumCount} medium) — synthesizing final report`)

const finalReport = await agent(
  synthesisPrompt(allIssues),
  {
    label: 'synthesize:final-report',
    phase: 'Synthesize',
  }
)

return finalReport
