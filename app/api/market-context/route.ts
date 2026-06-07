import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'
import { get2YTreasury, getHYSpread } from '@/lib/data/fredClient'
import { createServiceClient } from '@/lib/supabase'
import {
  computeSentimentScore, scoreToLabel,
  computeModelAlerts,
  vixRegime, yieldCurveRegime, hySpreadRegime, dxyRegime, tenYearRegime,
} from '@/lib/market-context/scoring'
import type { MarketContextPayload, MacroSignalTile, SectorBar, ValuationContextBand } from '@/lib/market-context/types'

export const revalidate = 300

// eslint-disable-next-line @typescript-eslint/no-require-imports
const YahooFinance = require('yahoo-finance2').default
const yf = new YahooFinance({ suppressNotices: ['ripHistorical', 'yahooSurvey'] })

const SECTOR_ETFS = [
  { ticker: 'XLK', sector: 'Technology' },
  { ticker: 'XLV', sector: 'Health Care' },
  { ticker: 'XLF', sector: 'Financials' },
  { ticker: 'XLE', sector: 'Energy' },
  { ticker: 'XLI', sector: 'Industrials' },
  { ticker: 'XLP', sector: 'Cons. Staples' },
  { ticker: 'XLY', sector: 'Cons. Disc.' },
]

// Compute 2-window relative strength momentum
// window1 = recent 20 days vs window2 = prior 20 days
// Returns momentum = RS_recent - RS_prior
function computeMomentum(sectorPrices: number[], spxPrices: number[]): number {
  if (sectorPrices.length < 40 || spxPrices.length < 40) return 0
  const s = sectorPrices.slice(-40)
  const m = spxPrices.slice(-40)
  const sRet1 = s[19] > 0 ? (s[39] - s[19]) / s[19] : 0
  const sRet2 = s[0]  > 0 ? (s[19] - s[0])  / s[0]  : 0
  const mRet1 = m[19] > 0 ? (m[39] - m[19]) / m[19] : 0
  const mRet2 = m[0]  > 0 ? (m[19] - m[0])  / m[0]  : 0
  const rs1 = mRet1 !== 0 ? sRet1 / Math.abs(mRet1) : 0
  const rs2 = mRet2 !== 0 ? sRet2 / Math.abs(mRet2) : 0
  return rs1 - rs2
}

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, 3, 60_000, 'market-context')
  if (limited) return limited

  try {
    const period2 = new Date()
    const period1 = new Date()
    period1.setDate(period1.getDate() - 60) // fetch 60 days to guarantee 40 trading days

    const p1str = period1.toISOString().split('T')[0]
    const p2str = period2.toISOString().split('T')[0]

    // Parallel fetches
    const [
      quoteResults,
      spyQuote,
      spxHist,
      sectorHists,
      fredDgs2,
      fredHy,
    ] = await Promise.all([
      // Spot quotes: SPX, VIX, 10Y, DXY
      Promise.allSettled([
        yf.quote('^GSPC'),
        yf.quote('^VIX'),
        yf.quote('^TNX'),
        yf.quote('DX-Y.NYB'),
      ]),
      // SPY for forward P/E
      yf.quoteSummary('SPY', { modules: ['defaultKeyStatistics'] }).catch(() => null),
      // SPX history for sector RS
      yf.historical('^GSPC', { period1: p1str, period2: p2str, interval: '1d' }).catch(() => []),
      // Sector ETF histories
      Promise.allSettled(
        SECTOR_ETFS.map(({ ticker }) =>
          yf.historical(ticker, { period1: p1str, period2: p2str, interval: '1d' }).catch(() => [])
        )
      ),
      get2YTreasury(),
      getHYSpread(),
    ])

    // ── Parse spot quotes ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const getQ = (i: number): any => quoteResults[i].status === 'fulfilled' ? (quoteResults[i] as PromiseFulfilledResult<any>).value : null
    const spxQ  = getQ(0)
    const vixQ  = getQ(1)
    const tnxQ  = getQ(2)
    const dxyQ  = getQ(3)

    const spxChange1d  = (spxQ?.regularMarketChangePercent ?? 0) as number
    const vix          = (vixQ?.regularMarketPrice ?? 20) as number
    const tnxYield     = (tnxQ?.regularMarketPrice ?? 4.3) as number   // Yahoo ^TNX is in percent directly
    const dxy          = (dxyQ?.regularMarketPrice ?? null) as number | null

    // ── Rate context ──────────────────────────────────────────────────────────
    // getRfRate returns decimal; TNX from Yahoo is in percent (e.g. 4.3 = 4.30%)
    const dgs2      = fredDgs2   // decimal (e.g. 0.044) or null
    const hySpread  = fredHy     // percentage points from FRED BAMLH0A0HYM2 (e.g. 3.23 = 3.23% ≈ 323 bps)

    // ── Sentiment ─────────────────────────────────────────────────────────────
    const sentimentScore = computeSentimentScore(vix, spxChange1d, hySpread)
    const sentimentLabel = scoreToLabel(sentimentScore)

    // ── 6 Signal tiles ────────────────────────────────────────────────────────
    const vixR  = vixRegime(vix)
    const ycR   = yieldCurveRegime(dgs2 != null ? dgs2 * 100 : null, tnxYield)
    const hyR   = hySpreadRegime(hySpread)
    const dxyR  = dxyRegime(dxy)
    const tnxR  = tenYearRegime(tnxYield)
    const dgs2R = dgs2 != null
      ? { label: dgs2 * 100 > 4.5 ? 'Restrictive' : 'Moderate', tone: dgs2 * 100 > 4.5 ? 'warning' as const : 'neutral' as const, implication: 'Short-term funding cost baseline' }
      : { label: 'Unavailable', tone: 'neutral' as const, implication: '' }

    const signals: MacroSignalTile[] = [
      { id: 'vix',   label: 'VIX',         value: vix.toFixed(1),           regimeLabel: vixR.label,  tone: vixR.tone,  equityImplication: vixR.implication  },
      { id: 'tnx',   label: '10Y Treasury', value: `${tnxYield.toFixed(2)}%`, regimeLabel: tnxR.label,  tone: tnxR.tone,  equityImplication: tnxR.implication  },
      { id: 'dgs2',  label: '2Y Treasury',  value: dgs2 != null ? `${(dgs2 * 100).toFixed(2)}%` : '—', regimeLabel: dgs2R.label, tone: dgs2R.tone, equityImplication: dgs2R.implication },
      { id: 'curve', label: 'Yield Curve',  value: dgs2 != null ? `${(tnxYield - dgs2 * 100).toFixed(2)}%` : '—', sub: '10Y − 2Y', regimeLabel: ycR.label, tone: ycR.tone, equityImplication: ycR.implication },
      { id: 'hy',    label: 'HY Spread',    value: hySpread != null ? `${hySpread.toFixed(2)}%` : '—', regimeLabel: hyR.label, tone: hyR.tone, equityImplication: hyR.implication },
      { id: 'dxy',   label: 'USD Index',    value: dxy != null ? dxy.toFixed(1) : '—', regimeLabel: dxyR.label, tone: dxyR.tone, equityImplication: dxyR.implication },
    ]

    // ── Sector momentum ───────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spxPrices: number[] = (spxHist as any[]).map((r: any) => r.close ?? r.adjClose).filter((v: unknown) => typeof v === 'number')
    const sectors: SectorBar[] = SECTOR_ETFS.map(({ ticker, sector }, i) => {
      const hist = sectorHists[i].status === 'fulfilled'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (sectorHists[i] as PromiseFulfilledResult<any[]>).value
        : []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const prices: number[] = (hist as any[]).map((r: any) => r.close ?? r.adjClose).filter((v: unknown) => typeof v === 'number')
      const momentum = computeMomentum(prices, spxPrices)
      return {
        ticker,
        sector,
        momentum: +momentum.toFixed(4),
        tone: (momentum > 0.02 ? 'positive' : momentum < -0.02 ? 'negative' : 'neutral') as SectorBar['tone'],
      }
    }).sort((a, b) => b.momentum - a.momentum)

    // ── Valuation context ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const spyFwdPE: number | null = (spyQuote as any)?.defaultKeyStatistics?.forwardPE ?? null
    const erp: number | null = spyFwdPE != null && spyFwdPE > 0
      ? (1 / spyFwdPE) - tnxYield / 100
      : null

    const forwardPEBands: ValuationContextBand[] = [
      { label: 'Cheap (<14×)',     min: 0,  max: 14  },
      { label: 'Fair (14–18×)',    min: 14, max: 18  },
      { label: 'Elevated (18–22×)', min: 18, max: 22 },
      { label: 'Expensive (>22×)', min: 22, max: 999 },
    ].map(b => ({
      ...b,
      current: spyFwdPE != null && spyFwdPE >= b.min && spyFwdPE < b.max,
    }))

    const erpBands: ValuationContextBand[] = [
      { label: 'Attractive (>3.5%)',  min: 3.5,   max: 999  },
      { label: 'Fair (2–3.5%)',       min: 2,     max: 3.5  },
      { label: 'Compressed (0–2%)',   min: 0,     max: 2    },
      { label: 'Negative (<0%)',      min: -999,  max: 0    },
    ].map(b => ({
      ...b,
      current: erp != null && erp * 100 >= b.min && erp * 100 < b.max,
    }))

    // ── Model alerts from Supabase valuations (session-scoped) ────────────────
    let modelAlerts: import('@/lib/market-context/types').ModelAlert[] = []
    let portfolioExposure: { sector: string; count: number; pct: number }[] = []
    try {
      const session = await getServerSession(authOptions)
      const userEmail = session?.user?.email
      if (userEmail) {
        const supabase = createServiceClient()
        // First resolve user UUID from email
        const { data: userRow } = await supabase
          .from('users')
          .select('id')
          .eq('email', userEmail)
          .single()
        if (userRow?.id) {
          const { data: valuations } = await supabase
            .from('valuations')
            .select('ticker, company, wacc, cagr, terminal_g')
            .eq('user_id', userRow.id)
            .order('saved_at', { ascending: false })
            .limit(50)

      if (valuations?.length) {
          modelAlerts = computeModelAlerts(valuations, dgs2 != null ? dgs2 * 100 : null, tnxYield)
          const uniqueTickers = Array.from(new Set(valuations.map((v: { ticker: string }) => v.ticker)))
          const total = uniqueTickers.length
          if (total > 0) {
            portfolioExposure = [{ sector: 'Saved Valuations', count: total, pct: 100 }]
          }
        }
        }
      }
    } catch {
      // Supabase may not be configured in dev
    }

    // ── Macro brief from Supabase cache ───────────────────────────────────────
    let macroBrief: string | null = null
    let briefCachedAt: string | null = null
    try {
      const supabase = createServiceClient()
      const regimeKey = signals.map(s => s.regimeLabel).sort().join('|')
      const { data: cached } = await supabase
        .from('macro_briefs')
        .select('brief_text, created_at, expires_at')
        .eq('regime_key', regimeKey)
        .single()
      if (cached && new Date(cached.expires_at) > new Date()) {
        macroBrief = cached.brief_text
        briefCachedAt = cached.created_at
      }
    } catch {
      // table may not exist yet
    }

    const payload: MarketContextPayload = {
      pulse: { spxChange1d, vix, tnxYield, sentimentLabel, sentimentScore },
      signals,
      sectors,
      valuation: { spyForwardPE: spyFwdPE, erp, forwardPEBands, erpBands },
      rateContext: { dgs2: dgs2 != null ? dgs2 * 100 : null, hySpread, fedFundsTarget: 4.33 },
      modelAlerts,
      portfolioExposure,
      macroBrief,
      briefCachedAt,
      fetchedAt: new Date().toISOString(),
    }

    return NextResponse.json(payload)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
