# Skill Observation Log

Observations captured during task-oriented work. Each entry identifies a
potential skill improvement or new skill opportunity.

**Status key:** OPEN = not yet actioned | ACTIONED = skill updated/created |
DECLINED = user decided not to pursue

---

## 2026-06-05

### Observation 1: ios-mobile-audit — two-column grid collapse is the dominant issue class

**Date:** 2026-06-05
**Session context:** iOS mobile audit of ValuationOutputTable.tsx
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** layout-collapse — grid/column responsive collapse

**Issue:** The component uses `grid grid-cols-2` with no responsive breakpoint modifier. At 390px (iPhone 15) each column is ~151px of usable space after padding. This is the most impactful issue in the component and likely recurs across other financial dashboard components that use side-by-side column layouts for UFCF vs LFCF comparisons.

**Suggested improvement:** Add a pattern to the ios-mobile-audit skill that specifically flags `grid-cols-N` (where N >= 2) without a `sm:` or `md:` counterpart as a high-severity layout-collapse issue. The fix pattern — `grid-cols-1 sm:grid-cols-2` — should be called out explicitly as the canonical resolution.

**Principle:** Hard multi-column grids without a single-column mobile fallback are the single most common layout-collapse failure in financial dashboards. Any `grid-cols-2` (or higher) without a mobile breakpoint should be treated as high-severity by default in the audit rubric.

### Observation 2: ios-mobile-audit — sub-44px touch target on toggle button

**Date:** 2026-06-05
**Session context:** iOS mobile audit of RiskTab.tsx and QuestionCircle.tsx
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** touch-target — small toggle buttons

**Issue:** The "Add note / Hide note" button in QuestionCircle.tsx (line 104) uses `text-[11px]` with no explicit height or min-height. Its rendered height is approximately 18-20px — well under the 44px iOS minimum. On iPhone 15 the tap area is too small, causing mis-taps that toggle visibility unexpectedly instead of cycling the answer state.

**Suggested improvement:** Add `min-h-[44px] px-1` to the toggle button, or wrap it with a `py-2` to expand the vertical tap area to at least 44px. The ios-mobile-audit skill should explicitly call out text-only toggle/chevron buttons as a recurring sub-44px pattern to check.

**Principle:** Inline text-only buttons (expand/collapse, show/hide, add note) are systematically under-sized on mobile because they take the line-height of the label text. The audit rubric should include a dedicated check for these alongside icon-only buttons.

### Observation 3: ios-mobile-audit — fixed-width WeightBar label clips on narrow viewports

**Date:** 2026-06-05
**Session context:** iOS mobile audit of CAGRAnalysis.tsx
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** overflow — fixed-width flex children in a flex row

**Issue:** The WeightBar sub-component (line 37) uses `w-24` (96px) for the label span and `w-8` (32px) for the percentage span inside a flex row. At 390px viewport the card has p-6 (24px each side), leaving ~342px for the bar row. The fixed widths themselves are fine, but the pattern of hard fixed-width spans in a flex row without a `min-w-0` guard on the growing child is a common source of overflow. In this case the flex-1 bar absorbs the remainder safely, but the pattern is worth flagging as a category.

**Suggested improvement:** The ios-mobile-audit skill should add a check: "In a flex row with fixed-width children and one flex-1/flex-grow child, verify the flex-1 child has min-w-0 to prevent it from overflowing its parent when sibling content is large." This catches WeightBar-style layouts where the grow child can be starved on small screens.

**Principle:** Fixed-width flex siblings without a min-w-0 guard on the flex-grow child are a latent overflow hazard on narrow viewports. The audit rubric should include this check alongside explicit overflow-x checks.

### Observation 4: ios-mobile-audit — touch targets on text-link buttons

**Date:** 2026-06-05
**Session context:** iOS mobile audit of OverviewSidebar.tsx
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target enforcement

**Issue:** The three "View …" CTA buttons in OverviewSidebar (lines 201, 268, 298) render as bare inline text with text-[12px] and only mt-3 vertical spacing, giving them an effective tap height well below 44px. The audit correctly flags these as high-severity touch-target violations. The skill instructions are clear on the 44×44px rule; no gap in guidance here — the violation is straightforward.

**Suggested improvement:** No change needed to the skill itself for this case. The existing touch-target rule is sufficient and was applied correctly.

**Principle:** Inline text-only buttons styled purely with font classes and no explicit min-height/padding are the most common touch-target failure mode in sidebar components. The skill's touch-target standard already covers this.

### Observation 5: ios-mobile-audit — action buttons inside data rows are the densest touch-target failure zone

**Date:** 2026-06-05
**Session context:** iOS mobile audit of AssumptionHealthPanel.tsx (valuation cockpit)
**Skill:** ios-mobile-audit
**Type:** open-source
**Phase/Area:** Touch target enforcement

**Issue:** AssumptionHealthPanel contains three distinct button types that all fail the 44px minimum: (1) the per-row expand/collapse toggle uses `p-1` + `size=12` icon = 20×20px; (2) the per-row "Use X" apply button uses `py-1 px-2 text-[10px]` = ~18px tall; (3) the "Apply all suggestions" footer button has zero padding and `text-[11px]` = ~16px tall. These are action buttons that modify financial model values — the smallest, highest-consequence buttons in the component.

**Suggested improvement:** Add a rule to the ios-mobile-audit skill: "Data-row action buttons (apply, dismiss, toggle) are the highest-risk touch-target failure zone because they are visually compressed to match row density but still perform destructive or irreversible actions. Minimum fix pattern: `min-h-[44px] min-w-[44px]` with `flex items-center justify-center`, or a transparent hit-area wrapper (`relative after:absolute after:inset-[-12px]`)."

**Principle:** The more consequential a button's action, the more critical it is that it meets the 44px touch target — yet these buttons are systematically undersized because designers prioritize visual compactness in data rows over tappability. The audit should call out action-type buttons in data rows separately from decorative or purely informational interactive elements.
