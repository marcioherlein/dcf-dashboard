import { NextRequest, NextResponse } from 'next/server'
import { getETFData } from '@/lib/data/yahooClient'
import { computeETFScore } from '@/lib/data/etfScore'
import { ALL_TICKERS } from '@/lib/data/etfUniverse'
import { createClient } from '@supabase/supabase-js'

function toMultiple(v: unknown): number | null {
  if (typeof v !== 'number' || v <= 0) return null
  return v < 1 ? Math.round((1 / v) * 10) / 10 : Math.round(v * 10) / 10
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  // Protect: require CRON_SECRET header from Vercel cron or manual admin call
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const client = getServiceClient()
  if (!client) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().slice(0, 10)
  const results: { ticker: string; ok: boolean }[] = []

  // Process in batches of 8 to stay under Yahoo rate limits
  const CONCURRENCY = 8
  for (let i = 0; i < ALL_TICKERS.length; i += CONCURRENCY) {
    const batch = ALL_TICKERS.slice(i, i + CONCURRENCY)
    await Promise.allSettled(
      batch.map(async (ticker) => {
        try {
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 8000)

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const raw: any = await Promise.race([
            getETFData(ticker),
            new Promise<never>((_, reject) =>
              controller.signal.addEventListener('abort', () => reject(new Error('timeout'))),
            ),
          ]).finally(() => clearTimeout(timeout))

          const top = raw?.topHoldings ?? {}
          const fund = raw?.fundProfile ?? {}
          const detail = raw?.summaryDetail ?? {}
          const eq = top.equityHoldings ?? {}

          const peRatio = toMultiple(eq.priceToEarnings)
          const pbRatio = toMultiple(eq.priceToBook)
          const yieldVal: number | null = typeof detail.yield === 'number' ? detail.yield : null
          const fees = fund.feesExpensesInvestment ?? {}
          const expenseRatio: number | null =
            typeof fees.annualReportExpenseRatio === 'number' ? fees.annualReportExpenseRatio :
            typeof fund.expenseRatio === 'number' ? fund.expenseRatio : null

          const { score } = computeETFScore(peRatio, pbRatio, yieldVal, expenseRatio)

          // Upsert one row per ticker per day — idempotent
          await client.from('etf_score_history').upsert(
            {
              ticker,
              score,
              pe_ratio: peRatio,
              pb_ratio: pbRatio,
              yield_val: yieldVal,
              expense_ratio: expenseRatio,
              ts: `${today}T22:00:00Z`,
            },
            // Relies on unique constraint: (ticker, ts::date)
            // If constraint not yet added, this will insert; deduplicated by date in queries
            { onConflict: 'ticker,ts', ignoreDuplicates: true },
          )

          results.push({ ticker, ok: true })
        } catch {
          results.push({ ticker, ok: false })
        }
      }),
    )
    // Brief pause between batches to respect Yahoo rate limits
    if (i + CONCURRENCY < ALL_TICKERS.length) {
      await new Promise((r) => setTimeout(r, 1500))
    }
  }

  const succeeded = results.filter((r) => r.ok).length
  const failed = results.filter((r) => !r.ok).map((r) => r.ticker)

  return NextResponse.json({
    date: today,
    total: ALL_TICKERS.length,
    succeeded,
    failed,
  })
}
