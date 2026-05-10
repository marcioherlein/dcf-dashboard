# Provider Status Audit — Data Integrity Fixes (2026-05-10)

## Summary

Three targeted data integrity bugs were fixed. No existing fields were renamed or moved. `tsc --noEmit` passes with zero errors after all changes.

---

## FIX 1 — FRED unit bug (`lib/data/fredClient.ts`)

**Problem:** The `!res.ok` error branch returned `4.29` (percent), while the rest of the function divides the API value by 100 and all other fallback paths return `0.0429` (decimal). Any HTTP error from FRED silently inflated the risk-free rate by 100×, producing a wildly overstated WACC.

**Fix:** Changed `return 4.29` to `return 0.0429` and added a comment explaining the unit contract. The function signature (`Promise<number>`) is unchanged — callers are unaffected. The no-api-key fallback on line 5 already returned `0.0429` correctly; this brings the error path into alignment.

---

## FIX 2 — `providerStatus` envelope (`app/api/financials/route.ts`)

**Problem:** The API response gave no indication of which upstream providers succeeded, making it impossible to distinguish stale/fallback data from live data in the client or in logs.

**Fix:** Added a `providerStatus` field at the end of the response JSON (all existing fields are untouched):

```typescript
providerStatus: {
  fmp:  { ok: boolean; error?: string }
  fred: { ok: true; rfRate: number; source: 'api' | 'fallback' }
  fx:   { rate: number; source: 'api' | 'parity' }
}
```

- `fmp.ok` is `false` (with `error: "No FMP income statement data"`) when FMP returned no income statements.
- `fred.source` is `'fallback'` when `rfRate === 0.0429` exactly (covers both the no-api-key and the now-fixed HTTP-error paths).
- `fx.source` is `'parity'` when `fxRate === 1` (no currency conversion needed), `'api'` otherwise.

---

## FIX 3 — Piotroski null safety (`lib/dcf/calculateScores.ts`)

**Problem:** `ta0`, `ta1`, `ni0`, `ni1`, and `ocf0` all fell back to `0` via `?? 0`. A genuinely absent `totalAssets` of `0` caused division-by-zero in ROA and leverage ratios, producing meaningless (always-zero) criteria that silently passed or failed with no signal.

**Fix:** The five critical inputs now capture `null` first:

- `ta0Raw`, `ta1Raw` — `totalAssets` for current and prior year
- `ni0Raw`, `ni1Raw` — `netIncome` for current and prior year
- `ocf0Raw` — operating cash flow for current year

When any of these is `null`, the dependent criterion is set to `pass: false` with `detail: "data unavailable"` instead of computing a ratio against zero. Criteria with `pass: false` are already excluded from the `score` count (line 117: `criteria.filter((c) => c.pass).length`), so unavailable data correctly scores 0 — no scoring logic change was needed.

Criteria affected by the guards:
- **ROA positive** — requires `ta0Raw` and `ni0Raw`
- **Operating CF positive** — requires `ocf0Raw`
- **ROA improving** — requires both `roa0` and `roa1` (i.e. both years' assets and income)
- **Accrual quality (OCF > Net Income)** — requires `ocf0Raw` and `ni0Raw`
