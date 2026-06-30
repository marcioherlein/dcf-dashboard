import { NextRequest, NextResponse } from 'next/server'

const VALID_MODES = [
  'morning_brief','earnings','feature','dcf','dcf2','dcf_bear',
  'midday_pulse','macro','etf_pulse','economic_results',
  'market_open','sector_spotlight','pre_close',
  'market_close','after_hours','earnings_results',
  'weekly_wrap','question','sentiment','news',
  'theory_overnight','holiday_deep_dive','sector_scan',
  'insider_buy','low_52w','top_undervalued','market_vs_model','ratio_explained',
  'li_valuation','li_market_wrap','li_deep_dive','li_sector_scan',
  'li_morning_brief','li_divergence','li_weekly_picks','li_myth',
  'conviction_score','li_conviction','etf_value_scan','li_etf_scan',
  'movers','undervalued_list','sector_undervalued',
  'biggest_losers_day','biggest_winners_day','ytd_losers','ytd_winners',
  'near_52w_high','most_shorted',
  'li_undervalued_list','li_sector_undervalued','li_biggest_losers_day',
  'li_biggest_winners_day','li_ytd_losers','li_ytd_winners',
  'li_near_52w_high','li_most_shorted','li_movers',
  'etf_vs_etf','profit_forecast_list','etf_ratio_breakdown',
  'sector_momentum_rank','dcf_vs_analyst_framed',
  'lowest_pe','lowest_peg','analyst_top_buys','highest_upside_consensus',
  'high_roic_cheap','dividend_value','weekly_followup','quality_rank',
  'overvalued_list','sector_pe_rank','momentum_leaders','earnings_week_preview',
  'value_vs_growth','cash_rich','daily_list_rotation','morning_stock_pick',
]

export async function GET(req: NextRequest) {
  // Vercel passes Authorization: Bearer <CRON_SECRET> on scheduled calls
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const mode = req.nextUrl.searchParams.get('mode') ?? ''
  if (!VALID_MODES.includes(mode)) {
    return NextResponse.json({ error: `Invalid mode: ${mode}` }, { status: 400 })
  }

  const ghToken = process.env.GH_DISPATCH_TOKEN
  const ghRepo  = process.env.GH_REPO ?? 'marcioherlein/dcf-dashboard'

  if (!ghToken) {
    return NextResponse.json({ error: 'GH_DISPATCH_TOKEN not configured' }, { status: 500 })
  }

  // Trigger the GitHub Actions workflow
  const res = await fetch(
    `https://api.github.com/repos/${ghRepo}/actions/workflows/289941116/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: { mode, ticker: '', dry_run: 'false' },
      }),
    }
  )

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[cron/x-post] GitHub dispatch failed for mode=${mode}: ${res.status} ${body}`)
    return NextResponse.json({ error: 'GitHub dispatch failed', status: res.status }, { status: 500 })
  }

  console.log(`[cron/x-post] Dispatched mode=${mode}`)
  return NextResponse.json({ ok: true, mode })
}
