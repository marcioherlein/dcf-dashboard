# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

### Observation 1: overflow-hidden parent clips overflow-x-auto table on iOS

**Date:** 2026-06-05
**Session context:** iOS mobile audit of ETFHoldingsTable component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Overflow/scrollable areas audit rule

**Issue:** ETFHoldingsTable wraps an `overflow-x-auto` table inside a parent `div` that has `overflow-hidden` (line 30). On iOS Safari, a parent with `overflow-hidden` silently clips the scroll container child — the horizontal scrollbar may not appear and the user cannot scroll the table. This is a known iOS Safari bug.

**Suggested improvement:** The ios-mobile-audit skill's overflow standard (rule 6) correctly states this anti-pattern, but the audit output could benefit from explicitly naming it as a "silent clip" with a concrete fix pattern: either remove `overflow-hidden` from the parent (use `rounded-xl` without `overflow-hidden` and instead apply `overflow-hidden` only to the direct scroll container), or wrap the `overflow-x-auto` div in its own stacking context that is not clipped.

**Principle:** When a scroll container and a clipping container are nested, the outer clip always wins on iOS Safari — the browser does not create a separate scroll layer inside a clipped parent. The fix pattern is: never put `overflow-hidden` on a container that has a scrollable descendant; instead, use border-radius clipping only on non-scroll wrappers, or restructure so the scroll container is the outermost clip boundary.

### Observation 2: Small anchor touch target inside padded wrapper div — parent padding does not extend tap zone

**Date:** 2026-06-05
**Session context:** iOS mobile audit of EarningsCalendar component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target audit rule

**Issue:** EarningsCalendar line 145 has a `<a>` tag inside a `div` with `px-4 py-2.5`. The padding lives on the div, not on the anchor — so the anchor's actual tap zone is only as tall as its text (~16px). The iOS 44px rule applies to the interactive element itself, not its wrapper. This is a recurring pattern: developers add padding to a container div thinking it inflates the tap zone, but the tap zone is determined by the element that receives `pointer-events`, not its ancestor.

**Suggested improvement:** Add an explicit rule to the ios-mobile-audit skill's touch-target section: "Padding on a non-interactive parent div does NOT extend the tap zone of a child anchor or button. Apply `min-h-[44px]` and vertical padding directly on the interactive element, or make the parent element itself the interactive element."

**Principle:** Touch target size is set by the interactive element's own box model, not by ancestor padding. A wrapper div with py-2.5 creates visual spacing but not a larger tap zone for the anchor inside it. Always verify that min-h and padding are on the element with `href` or `onClick`, not a decorative ancestor.

### Observation 3: "View models →" Link touch targets inside 3-column stat cards are critically under-sized

**Date:** 2026-06-05
**Session context:** iOS mobile audit of PortfolioExposure component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target audit rule — conditional links inside flex column cards

**Issue:** PortfolioExposure lines 43-46, 53-56, 63-66 render `<Link>` elements with class `text-[10px] mt-1.5 self-start` inside 3-column grid cards that are ~106px wide on a 390px phone (after 2×px-5 + 2×gap-2 padding). The link has no min-height, no explicit py, and `self-start` collapses it to text height (~12px). The tap zone is roughly 12×45px — far below the 44×44 minimum. The small font (10px) compounds the problem visually.

**Suggested improvement:** Add rule to ios-mobile-audit: "Conditional links appended at the bottom of flex-column cards with `self-start` collapse to text height. Apply `min-h-[44px] flex items-center` or use `py-2` on the link itself to reach the 44px minimum."

**Principle:** `self-start` alignment combined with tiny text and no explicit height produces near-invisible tap zones. Every conditional trailing link in a card must carry its own explicit touch-target sizing — parent card padding does not extend the tap zone.

### Observation 4: Fixed-width slide-over panel collapses to scroll on mobile — audit missed overflow direction

**Date:** 2026-06-05
**Session context:** iOS mobile audit of ScreenerChart component — slide-over chart panel
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Overflow / viewport audit rule — fixed-width panels inside fixed overlays

**Issue:** ScreenerChart line 30 uses `w-[520px]` inside a `fixed inset-0` overlay. On a 390px iPhone, the panel is wider than the viewport. Because the parent is `fixed inset-0` (not `overflow-x-auto`), the panel is simply clipped — the right 130px are invisible and unreachable. The close button and chart resize correctly inside the panel, but the panel's own width overflows. This is a slightly different failure mode from a scrollable table: rather than horizontal scroll, the user just can't see part of the panel.

**Suggested improvement:** Add a rule to ios-mobile-audit's overflow/viewport section: "Slide-over panels with fixed pixel widths (`w-[520px]`, `w-[400px]`, etc.) inside `fixed inset-0` overlays will overflow and clip on narrow viewports. Use `w-full sm:w-[520px]` to make the panel full-width on mobile and constrained on desktop."

**Principle:** A `fixed inset-0` wrapper does not create a scroll context — it clips overflow. Fixed-width children in that container are silently truncated on small screens, with no visual cue for the user. Responsive width classes (`w-full sm:w-[N]`) are required on any panel intended to also render on mobile.

### Observation 5: TooltipTrigger-as-span creates hover-only interaction on iOS — touch users cannot access tooltip content

**Date:** 2026-06-05
**Session context:** iOS mobile audit of InvestorVerdictCard component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target / iOS Safari interaction quirk

**Issue:** InvestorVerdictCard lines 233-241 and 248-256 render TooltipTrigger with `render={<span ... cursor-help .../>}`. Base UI's Tooltip uses pointer hover events to open. On iOS Safari, `cursor-help` has no effect, and span elements do not receive hover events — they only receive tap events. A single tap may fire the tooltip on some implementations, but there is no reliable way for an iOS user to dismiss a tooltip that opened on tap without tapping elsewhere, and double-tap-to-zoom conflicts with the gesture. The `min-h-[32px]` on the span also falls short of the 44px touch target minimum. More critically, the tooltip content (explaining what "Business Quality" and "Model confidence" mean) is inaccessible to touch-only users who cannot hover.

**Suggested improvement:** Add a rule to ios-mobile-audit: "TooltipTrigger elements that wrap non-button, non-link elements (spans, divs) rely on hover events that do not fire reliably on iOS touch. For informational badges with tooltips, either: (a) use a tap-activated popover/sheet instead of a hover tooltip, or (b) ensure the trigger is a <button> so iOS fires both focus and tap events, which most tooltip libraries use as fallbacks. Additionally, min-h-[32px] on the trigger span falls short of the 44px minimum — use min-h-[44px] on interactive triggers."

**Principle:** Hover-only tooltips are a silent iOS gap. Any content that is only visible via tooltip hover is effectively hidden from touch-only users. Interactive information displays that are critical to understanding the UI (like "what does Model confidence: High mean?") must be accessible via tap, not just hover.

### Observation 6: "View full risk analysis →" button has min-h-[44px] but no explicit width — touch zone may be narrow on wrapped text

**Date:** 2026-06-05
**Session context:** iOS mobile audit of OverviewBottomStrip component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target audit rule — inline-style text buttons

**Issue:** OverviewBottomStrip line 119-124 has a `<button>` with `min-h-[44px] flex items-center` but no `w-full` and no explicit min-width. Its label is short ("View full risk analysis →") so on small screens it renders as a single-line text button whose tap width is determined by the text width alone (~180px). While 180px wide × 44px tall meets the standard, the real concern is that the button has no background or border — it is purely a text link styled as a button. Apple HIG recommends 44×44 minimum for *all* interactive elements including text links; the height passes but the minimal visual affordance may mislead auditors reviewing touch target coverage.

**Suggested improvement:** No change required for touch-target compliance (the min-h-[44px] + flex-items-center already satisfies the 44px height minimum, and the natural width exceeds 44px). However, add a note to the ios-mobile-audit skill clarifying that text-link-style buttons pass the 44px height check when min-h-[44px] is present, but auditors should also verify the natural rendered width exceeds 44px for short labels.

**Principle:** A button styled as plain text (no bg, no border) passes the height check if min-h-[44px] is set, but auditors must also verify the rendered width for very short labels (1-2 words). If label text is shorter than 44px wide, the button needs a min-w-[44px] or explicit padding to comply.

### Observation 7: transition-all on width property triggers layout jank on iOS — animation category needs "width" called out explicitly

**Date:** 2026-06-05
**Session context:** iOS mobile audit of FinancialsSidebar component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Animation audit rule — layout-affecting CSS transitions
**Status:** OPEN

**Issue:** FinancialsSidebar line 80 uses `transition-all` on the MarginBar fill div whose only animated property is `width` (via `style={{ width: \`${pct}%\` }}`). `transition-all` on a width change triggers CSS layout recalculation on every frame of the animation — a known iOS Safari performance regression. The animation standard says "prefer transform/opacity" but doesn't explicitly call out `width` transitions, which are the most common layout-affecting animation in data-visualization components (bar fills, progress bars, sparkline bars).

**Suggested improvement:** Add an explicit example to the ios-mobile-audit animation rule: "Width transitions (`transition-all` or `transition-[width]` on elements whose `width` changes dynamically) trigger layout recalculation on every frame on iOS Safari. Replace with `transform: scaleX()` + `transform-origin: left` to achieve the same visual effect using GPU-composited transforms. Example fix: remove `style={{ width: \`${pct}%\` }}` and replace with `style={{ transform: \`scaleX(${pct / 100})\`, transformOrigin: 'left' }}` on a full-width div."

**Principle:** `transition-all` is the most common source of layout-affecting animations in React components because it's the default reach-for class. Any element whose `width` or `height` changes dynamically and uses `transition-all` is animating a layout property. The fix is always `scaleX()`/`scaleY()` with `transform-origin`, not `transition: width`.

### Observation 8: Group-hover opacity pattern makes DCF navigation link invisible on iOS touch

**Date:** 2026-06-26
**Session context:** iOS mobile audit of ETFHoldingsTable component
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target / iOS Safari interaction quirk — hover-gated UI affordances
**Status:** OPEN

**Issue:** ETFHoldingsTable lines 74-79 render a Link with `opacity-0 group-hover:opacity-100` on the "DCF" label text. The ExternalLink icon (size=12, 12×12px) is always visible, but the navigation label is permanently hidden on iOS because `group-hover` requires a pointer hover event that iOS touch does not fire. The icon alone has no explicit padding on the Link element — the surrounding td provides py-2.5 visually but the Link's own click zone is limited to the 12px icon dimensions, far below the 44×44px iOS minimum. The combination of a sub-minimum touch target *and* a permanently hidden label means mobile users see a tiny icon with no visible purpose label and must tap with pixel-precision.

**Suggested improvement:** Add a rule to ios-mobile-audit: "Patterns that combine `opacity-0` with `group-hover:opacity-*` to reveal UI affordances (labels, secondary actions) are permanently hidden on iOS touch. If the hidden element is a label for a navigation target, its concealment leaves the touch affordance without a visible description. Fix: replace `opacity-0 group-hover:opacity-100` with either (a) always-visible label text, or (b) `sm:opacity-0 sm:group-hover:opacity-100` so the label is always visible on mobile and hover-gated only on desktop. Separately, ensure the interactive element itself has min-h-[44px] min-w-[44px] regardless of label visibility."

**Principle:** Hover-gated visibility patterns (group-hover, peer-hover, hover:opacity) are iOS accessibility anti-patterns whenever the hidden element communicates purpose or action intent. Combine this with a sub-minimum touch target and the element is both imperceptible and untappable on mobile. The fix has two parts: make the label mobile-visible, and size the interactive element to 44×44px.
