# Test Plan

## How to Run

```bash
npm test                  # run all tests once
npm test -- --watch       # watch mode
npm test -- --passWithNoTests  # CI-safe (no error if no tests matched)
npm run typecheck         # TypeScript type-check only
```

## CI Trigger

The GitHub Actions workflow (`.github/workflows/ci.yml`) runs automatically on every push and pull request targeting `main`. Steps:

1. `npm ci` — clean install
2. `npx tsc --noEmit` — type check
3. `npm test -- --passWithNoTests` — unit tests
4. `npx next lint --dir . --max-warnings 0` — lint (continue-on-error)

## Tests That Now Exist

| File | What it covers |
|------|---------------|
| `lib/valuation/__tests__/guards.test.ts` | Type guard functions in the valuation module |
| `lib/valuation/__tests__/dcf.test.ts` | DCF formula calculations (NPV, terminal value, etc.) |
| `lib/data/__tests__/fredClient.test.ts` | `getRfRate()` — verifies FRED returns decimal (0.0429) not percent (4.29); covers success, network error, and HTTP error paths |
| `lib/valuation/__tests__/bridge.test.ts` | `computeBridge` and `computeEquityBridge` — EV-to-equity bridge math, null propagation, division-by-zero guard |

### Note on engine.manual.ts

`lib/valuation/__tests__/engine.manual.ts` (formerly `engine.test.ts`) is a manual integration script with no Jest `describe`/`test` blocks. It has been renamed to `.manual.ts` so Jest does not pick it up. Run it directly:

```bash
npx ts-node --project tsconfig.json lib/valuation/__tests__/engine.manual.ts
```

## Known Bugs Caught by Tests

**FRED HTTP-error path** (`fredClient.ts` line 10): when `!res.ok`, the original code returned `4.29` (percent) instead of `0.0429` (decimal). The `fredClient.test.ts` "returns decimal fallback when HTTP error" test documents the correct behavior; if the bug is not yet fixed it will fail, acting as a regression guard.

## What Is Still Missing

| Area | Gap |
|------|-----|
| Playwright E2E | No browser-level tests for the dashboard UI flows (simplifier wizard, DCF result page, AI Stack page) |
| WACC integration tests | `lib/valuation/wacc.ts` is untested — no coverage for cost-of-equity, cost-of-debt, or blended WACC calculation |
| FX conversion tests | Currency conversion logic used in international company valuations has no unit tests |
| Yahoo Finance adapter tests | `lib/data/yahooClient.ts` and the valuation adapter (`lib/valuation/adapter.ts`) have no tests covering field mapping or missing-data handling |
| Supabase persistence tests | `lib/data/supabaseClient.ts` read/write paths are untested |
| Scenario engine tests | Bull/base/bear scenario generation in `lib/valuation/engine.ts` is only covered by the manual script |
