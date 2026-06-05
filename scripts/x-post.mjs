/**
 * X (Twitter) automated posting script
 *
 * Modes (set via MODE env var):
 *   earnings  — "Earnings Tomorrow" preview for stocks reporting next trading day
 *   dcf       — DCF fair value snapshot for one featured stock
 *   news      — Top financial news headline + brief take
 *
 * Usage:
 *   MODE=earnings APP_URL=... X_API_KEY=... node scripts/x-post.mjs
 *   MODE=dcf      TICKER=AAPL APP_URL=... node scripts/x-post.mjs
 *   MODE=news      node scripts/x-post.mjs
 */

import { TwitterApi } from 'twitter-api-v2'
import yahooFinance from 'yahoo-finance2'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODE    = process.env.MODE    || 'dcf'
const TICKER  = process.env.TICKER  || ''
const APP_URL = (process.env.APP_URL || 'https://www.intrinsico.app').replace(/\/$/, '')
const DRY_RUN = process.env.DRY_RUN === 'true'

// X API credentials (Twitter API v2 OAuth 1.0a)
const xClient = new TwitterApi({
  appKey:            process.env.X_API_KEY,
  appSecret:         process.env.X_API_SECRET,
  accessToken:       process.env.X_ACCESS_TOKEN,
  accessSecret:      process.env.X_ACCESS_SECRET,
})
const rwClient = xClient.readWrite

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n, digits = 2) {
  if (n == null || !isFinite(n)) return 'N/A'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `$${(n / 1e12).toFixed(1)}T`
  if (abs >= 1e9)  return `$${(n / 1e9).toFixed(1)}B`
  if (abs >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`
  return `$${n.toFixed(digits)}`
}

function pct(n, signed = true) {
  if (n == null || !isFinite(n)) return 'N/A'
  const val = (n * 100).toFixed(1)
  return signed ? `${n >= 0 ? '+' : ''}${val}%` : `${val}%`
}

async function fetchValuation(ticker) {
  const url = `${APP_URL}/api/financials?ticker=${ticker}`
  console.log(`Fetching: ${url}`)
  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(30000) })
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API returned ${res.status} for ${ticker}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

async function post(text) {
  if (DRY_RUN) {
    console.log('--- DRY RUN ---')
    console.log(text)
    console.log(`Length: ${text.length}`)
    return
  }
  const tweet = await rwClient.v2.tweet(text)
  console.log(`Posted: https://twitter.com/i/web/status/${tweet.data.id}`)
}

// ─── Mode: earnings ───────────────────────────────────────────────────────────
// Finds S&P 500 stocks reporting earnings tomorrow, picks the biggest by market cap,
// and posts a DCF-based preview.

const SP500_SAMPLE = [
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','BRK-B','JPM','V',
  'UNH','JNJ','XOM','PG','MA','HD','CVX','MRK','ABBV','LLY',
  'PEP','KO','AVGO','COST','MCD','CSCO','TMO','BAC','ACN','WMT',
  'ADBE','CRM','AMD','NFLX','INTC','QCOM','TXN','NEE','UPS','RTX',
  'AMGN','HON','LOW','GS','CAT','BA','SBUX','MMM','IBM','GE',
]

async function runEarnings() {
  console.log('Fetching earnings calendar...')

  // Get quotes with earningsTimestamp for each ticker in our sample
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch quotes in parallel batches of 10
  const results = []
  for (let i = 0; i < SP500_SAMPLE.length; i += 10) {
    const batch = SP500_SAMPLE.slice(i, i + 10)
    const settled = await Promise.allSettled(
      batch.map(t => yahooFinance.quote(t, { fields: ['earningsTimestamp','marketCap','symbol','shortName'] }))
    )
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
  }

  // Filter: earnings timestamp falls on tomorrow (UTC date match)
  const reporting = results.filter(q => {
    if (!q.earningsTimestamp) return false
    const d = new Date(q.earningsTimestamp * 1000).toISOString().split('T')[0]
    return d === tomorrowStr
  })

  if (reporting.length === 0) {
    console.log(`No earnings found for ${tomorrowStr} in sample — skipping post`)
    return
  }

  // Pick the largest by market cap
  reporting.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
  const featured = reporting[0]
  const ticker = featured.symbol

  console.log(`Featured: ${ticker} (earnings ${tomorrowStr})`)

  let dcfLine = ''
  let upsideLine = ''
  try {
    const data = await fetchValuation(ticker)
    const fair = data.valuationMethods?.triangulatedFairValue
    const upside = data.valuationMethods?.triangulatedUpsidePct
    const price = data.quote?.price
    const grade = data.ratings?.overall?.grade
    if (fair && price) {
      dcfLine  = `DCF Fair Value: ${fmt(fair)} (current: ${fmt(price)})`
      upsideLine = upside != null ? `Implied upside: ${pct(upside)}` : ''
      if (grade) dcfLine += ` · ${grade}`
    }
  } catch (e) {
    console.warn('Could not fetch DCF for featured ticker:', e.message)
  }

  const others = reporting.slice(1, 4).map(q => `$${q.symbol}`)
  const alsoLine = others.length > 0 ? `Also reporting: ${others.join(', ')}` : ''

  const lines = [
    `$${ticker} reports earnings tomorrow 📊`,
    dcfLine,
    upsideLine,
    alsoLine,
    '',
    `Full valuation → ${APP_URL}/?ticker=${ticker}`,
    '#Earnings #Stocks #DCF',
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: dcf ────────────────────────────────────────────────────────────────
// Posts a DCF fair value snapshot for a specified or rotating stock.

// Weekly rotation: different sector each day Mon–Fri
const ROTATION = {
  1: ['NVDA','AMD','INTC','QCOM','AVGO'],   // Monday: semiconductors
  2: ['AAPL','MSFT','GOOGL','META','AMZN'], // Tuesday: mega-cap tech
  3: ['JPM','BAC','GS','V','MA'],           // Wednesday: financials
  4: ['JNJ','LLY','ABBV','MRK','AMGN'],    // Thursday: healthcare
  5: ['TSLA','RIVN','F','GM','TM'],         // Friday: autos/EV
}

async function runDcf() {
  let ticker = TICKER
  if (!ticker) {
    const day = new Date().getDay() // 0=Sun … 6=Sat
    const pool = ROTATION[day] ?? ROTATION[1]
    // Pick deterministically based on week-of-year so it rotates weekly
    const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
    ticker = pool[weekOfYear % pool.length]
  }

  console.log(`Fetching DCF for ${ticker}...`)
  const data = await fetchValuation(ticker)

  const name    = data.businessProfile?.description?.split('.')[0]?.slice(0, 60) ?? ticker
  const price   = data.quote?.price
  const fair    = data.valuationMethods?.triangulatedFairValue
  const upside  = data.valuationMethods?.triangulatedUpsidePct
  const wacc    = data.wacc?.wacc
  const cagr    = data.cagr
  const tg      = data.terminalG
  const grade   = data.ratings?.overall?.grade ?? ''
  const label   = data.ratings?.overall?.label ?? ''
  const sector  = data.quote?.sector ?? ''

  if (!price || !fair) throw new Error(`No price/fair value data for ${ticker}`)

  const verdictEmoji = upside > 0.15 ? '🟢' : upside > 0 ? '🟡' : '🔴'
  const verdictText  = upside > 0.15 ? 'Undervalued' : upside > -0.05 ? 'Fairly valued' : 'Overvalued'

  const lines = [
    `${verdictEmoji} $${ticker} — DCF Snapshot`,
    `Current: ${fmt(price)} · Fair Value: ${fmt(fair)}`,
    `Implied upside: ${pct(upside)} (${verdictText})`,
    '',
    `WACC: ${pct(wacc, false)} · CAGR est: ${pct(cagr, false)} · Terminal g: ${pct(tg, false)}`,
    `Rating: ${grade} ${label}${sector ? ` · ${sector}` : ''}`,
    '',
    `Full model → ${APP_URL}/?ticker=${ticker}`,
    '#DCF #Valuation #Stocks',
  ]

  await post(lines.join('\n'))
}

// ─── Mode: news ───────────────────────────────────────────────────────────────
// Pulls top market news headline from Yahoo Finance and posts it with a brief take.

async function runNews() {
  // Yahoo Finance trending tickers as a news proxy
  const trendingRes = await yahooFinance.search('market', { newsCount: 5 }).catch(() => null)
  const newsItems = trendingRes?.news ?? []

  if (newsItems.length === 0) {
    console.log('No news found — skipping')
    return
  }

  // Pick the first news item with a title
  const item = newsItems.find(n => n.title?.length > 20) ?? newsItems[0]
  const title = item.title ?? ''
  const link  = item.link  ?? ''

  // Extract ticker mentions from the headline for hashtags
  const tickers = [...new Set(
    (item.relatedTickers ?? []).slice(0, 2).map(t => `$${t}`)
  )]
  const hashPart = tickers.length > 0
    ? tickers.join(' ') + ' #FinancialNews'
    : '#Markets #FinancialNews'

  const lines = [
    `📰 ${title}`,
    '',
    hashPart,
  ]

  // Only include the source link if it's short enough to fit
  const baseText = lines.join('\n')
  if (link && baseText.length + link.length + 2 < 270) {
    lines.splice(2, 0, link)
  }

  await post(lines.join('\n'))
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const MODES = { earnings: runEarnings, dcf: runDcf, news: runNews }

if (!MODES[MODE]) {
  console.error(`Unknown MODE="${MODE}". Use: earnings | dcf | news`)
  process.exit(1)
}

try {
  await MODES[MODE]()
  console.log(`Done (mode=${MODE})`)
} catch (err) {
  console.error(`Failed (mode=${MODE}):`, err.message)
  process.exit(1)
}
