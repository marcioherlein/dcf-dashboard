/**
 * /api/cron/valuation-batch
 *
 * Nightly batch that runs the full 4-model cockpit pipeline for each ticker
 * in IDEAS_UNIVERSE and stores results in the daily_valuations Supabase table.
 *
 * The Ideas API then reads from this table instead of running its own
 * lightweight single-model DCF — so ideas page fair values match the stock page.
 *
 * Schedule: Sunday 23:00 UTC (weekly — valuations don't change daily)
 * Concurrency: 3 tickers at a time — each calls /api/financials which itself
 * makes ~10 external API calls; too much parallelism hits Yahoo rate limits.
 *
 * Protected by CRON_SECRET (same pattern as etf-snapshot cron).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// ── Ideas universe (same list as Ideas API) ───────────────────────────────────

const IDEAS_UNIVERSE = [
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'BRK-B', 'JPM', 'V',
  'UNH', 'JNJ', 'WMT', 'MA', 'HD', 'PG', 'MRK', 'KO', 'PEP', 'CVX',
  'LLY', 'ABBV', 'ORCL', 'BAC', 'XOM', 'COST', 'NFLX', 'CRM', 'ADBE', 'AMD',
  'INTC', 'QCOM', 'TXN', 'IBM', 'NOW', 'UBER', 'SPOT', 'SQ', 'PYPL', 'SNAP',
  'ZM', 'DOCU', 'SHOP', 'MDB', 'SNOW', 'PLTR', 'COIN', 'RBLX',
  'ABNB', 'DASH', 'TSM', 'ASML', 'SAP',
  'AMAT', 'MU', 'DELL', 'ACN', 'INTU', 'PANW', 'CRWD', 'NET', 'WDAY', 'DDOG',
  'TM', 'SONY', 'BHP', 'RIO', 'VALE', 'FCX', 'NEM', 'BIDU', 'BABA', 'JD', 'PDD',
  'GS', 'MS', 'C', 'WFC', 'AXP', 'BLK', 'SCHW', 'CB', 'SPGI', 'ICE', 'COF', 'PNC', 'MMC',
  'MCD', 'SBUX', 'YUM', 'CMG', 'NKE', 'TGT', 'LOW', 'TJX', 'BKNG', 'MAR', 'HLT', 'LULU', 'F', 'GM',
  'ABT', 'BSX', 'SYK', 'MDT', 'ISRG', 'REGN', 'VRTX', 'GILD', 'CVS', 'PFE', 'AMGN', 'CI',
  'CAT', 'DE', 'HON', 'UPS', 'FDX', 'CSX', 'UNP', 'GE', 'RTX', 'LMT', 'MMM',
  'DIS', 'CMCSA', 'T', 'VZ', 'TMUS', 'CHTR', 'EA', 'TTWO',
  'SLB', 'EOG', 'MPC', 'ENB', 'EPD', 'ET',
  'LIN', 'APD', 'DOW',
  'MO', 'PM', 'BTI', 'WPC', 'O', 'VICI',
  'SPG', 'PLD', 'AMT', 'CCI', 'DLR', 'EQIX', 'PSA', 'EXR',
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface ValuationRow {
  ticker: string
  date: string
  price: number
  fair_value: number | null
  upside_pct: number | null
  verdict: string | null
  dcf_fv: number | null
  forward_pe_fv: number | null
  ev_ebitda_fv: number | null
  rev_multiple_fv: number | null
  method_count: number | null
  confidence: string | null
  wacc: number | null
  cagr: number | null
  analyst_target: number | null
  analyst_rating: number | null
  market_cap: number | null
  sector: string | null
  data_source: string
  error: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRow(ticker: string, date: string, data: any): ValuationRow {
  const price: number = data?.quote?.price ?? 0
  const vm = data?.valuationMethods ?? {}
  const fairValue: number | null = vm.cockpitFairValue ?? null
  const upsidePct: number | null = fairValue != null && price > 0
    ? (fairValue - price) / price
    : vm.cockpitUpsidePct ?? null

  // Derive verdict from upside
  let verdict: string | null = null
  if (fairValue != null && price > 0) {
    if (upsidePct != null && upsidePct >= 0.15) verdict = 'Undervalued'
    else if (upsidePct != null && upsidePct >= -0.15) verdict = 'Fairly Valued'
    else verdict = 'Overvalued'
  }

  // Individual method fair values
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const methods: any[] = vm.methods ?? []
  const methodFV = (id: string): number | null =>
    methods.find((m: { id: string; fairValue: number | null }) => m.id === id)?.fairValue ?? null

  const validMethods = methods.filter((m: { fairValue: number | null }) => m.fairValue != null && m.fairValue > 0).length

  // Confidence: derived from method count + divergence
  let confidence: string | null = null
  if (validMethods >= 3) confidence = 'high'
  else if (validMethods >= 2) confidence = 'medium'
  else if (validMethods >= 1) confidence = 'low'

  return {
    ticker,
    date,
    price,
    fair_value: fairValue,
    upside_pct: upsidePct,
    verdict,
    dcf_fv: methodFV('core_dcf'),
    forward_pe_fv: methodFV('forward_pe'),
    ev_ebitda_fv: methodFV('ev_ebitda'),
    rev_multiple_fv: methodFV('revenue_multiple'),
    method_count: validMethods > 0 ? validMethods : null,
    confidence,
    wacc: data?.wacc?.wacc ?? null,
    cagr: data?.cagr ?? null,
    analyst_target: data?.quote?.analystTargetMean ?? null,
    analyst_rating: data?.analystRecommendation ? ratingToNumber(data.analystRecommendation) : null,
    market_cap: data?.quote?.marketCap ?? null,
    sector: data?.quote?.sector ?? null,
    data_source: 'cockpit_v1',
    error: null,
  }
}

function ratingToNumber(key: string): number | null {
  const map: Record<string, number> = {
    'strongBuy': 1.5, 'buy': 2.0, 'outperform': 2.2,
    'hold': 3.0, 'neutral': 3.0, 'underperform': 4.0, 'sell': 5.0,
  }
  return map[key] ?? null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth: require CRON_SECRET header
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!sbUrl || !sbKey) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const sb = createClient(sbUrl, sbKey)
  const today = new Date().toISOString().slice(0, 10)

  // Build the base URL for internal API calls (Vercel provides VERCEL_URL)
  const host = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const results: { ticker: string; ok: boolean; error?: string }[] = []

  // Process CONCURRENCY=3 tickers at a time
  // Each /api/financials call makes ~10 external API calls itself — too much parallel
  // traffic hits Yahoo and FMP rate limits.
  const CONCURRENCY = 3

  for (let i = 0; i < IDEAS_UNIVERSE.length; i += CONCURRENCY) {
    const batch = IDEAS_UNIVERSE.slice(i, i + CONCURRENCY)

    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          // Call the full financials pipeline — same endpoint the stock page uses
          const res = await fetch(`${host}/api/financials?ticker=${encodeURIComponent(ticker)}`, {
            headers: {
              // The financials route checks AUTOMATION_API_KEY for server-to-server calls
              'X-Automation-Key': process.env.AUTOMATION_API_KEY ?? '',
            },
            // 20s timeout per ticker — the financials route is slow on cold
            signal: AbortSignal.timeout(20_000),
          })

          if (!res.ok) {
            // Non-2xx (rate-limited, exchange restriction, etc.) — upsert error row
            const errText = await res.text().catch(() => `HTTP ${res.status}`)
            await sb.from('daily_valuations').upsert({
              ticker,
              date: today,
              price: 0,
              fair_value: null,
              upside_pct: null,
              verdict: null,
              data_source: 'cockpit_v1',
              error: errText.slice(0, 200),
            }, { onConflict: 'ticker,date', ignoreDuplicates: false })
            results.push({ ticker, ok: false, error: `HTTP ${res.status}` })
            return
          }

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const data: any = await res.json()
          const row = extractRow(ticker, today, data)

          await sb.from('daily_valuations').upsert(row, {
            onConflict: 'ticker,date',
            ignoreDuplicates: false,
          })

          results.push({ ticker, ok: true })
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          results.push({ ticker, ok: false, error: errMsg })
          // Still upsert an error row so we can track failures
          try {
            await sb.from('daily_valuations').upsert({
              ticker,
              date: today,
              price: 0,
              fair_value: null,
              upside_pct: null,
              verdict: null,
              data_source: 'cockpit_v1',
              error: errMsg.slice(0, 200),
            }, { onConflict: 'ticker,date', ignoreDuplicates: false })
          } catch { /* ignore secondary failure */ }
        }
      })
    )

    // Pause between batches — Yahoo rate limits at ~10 req/s across all callers
    if (i + CONCURRENCY < IDEAS_UNIVERSE.length) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  const succeeded = results.filter(r => r.ok).length
  const failed = results.filter(r => !r.ok)

  return NextResponse.json({
    date: today,
    total: IDEAS_UNIVERSE.length,
    succeeded,
    failed: failed.map(r => ({ ticker: r.ticker, error: r.error })),
  })
}
