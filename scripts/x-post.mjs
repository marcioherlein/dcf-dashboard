/**
 * X (Twitter) automated posting script — posts via Buffer API (GraphQL)
 *
 * Modes (set via MODE env var):
 *   earnings  — "Earnings Tomorrow" preview for stocks reporting next trading day
 *   dcf       — DCF fair value snapshot for one featured stock
 *   news      — Top financial news headline + brief take
 *   macro     — Economic event alert (CPI, NFP, Fed rate) or upcoming macro calendar
 *
 * Usage:
 *   MODE=dcf TICKER=AAPL APP_URL=... BUFFER_API_KEY=... BUFFER_CHANNEL_ID=... node scripts/x-post.mjs
 */

import yahooFinance from 'yahoo-finance2'

// ─── Config ───────────────────────────────────────────────────────────────────

const MODE                = process.env.MODE                || 'dcf'
const TICKER              = process.env.TICKER              || ''
const APP_URL             = (process.env.APP_URL            || 'https://insic.app').replace(/\/$/, '')
const DRY_RUN             = process.env.DRY_RUN             === 'true'
const BUFFER_API_KEY      = process.env.BUFFER_API_KEY      || ''
const BUFFER_CHANNEL_ID   = process.env.BUFFER_CHANNEL_ID   || ''
const ALPHA_VANTAGE_KEY   = process.env.ALPHA_VANTAGE_KEY   || 'demo'

// ─── Buffer API ───────────────────────────────────────────────────────────────

async function post(text) {
  if (DRY_RUN) {
    console.log('--- DRY RUN ---')
    console.log(text)
    console.log(`Length: ${text.length}`)
    return
  }
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${BUFFER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `mutation {
        createPost(input: {
          channelId: "${BUFFER_CHANNEL_ID}"
          text: ${JSON.stringify(text)}
          schedulingType: automatic
          mode: shareNow
        }) {
          ... on PostActionSuccess { post { id status } }
          ... on InvalidInputError { message }
          ... on UnauthorizedError { message }
          ... on LimitReachedError { message }
          ... on RestProxyError    { message code }
          ... on UnexpectedError   { message }
        }
      }`,
    }),
  })
  const json = await res.json()
  const result = json?.data?.createPost
  if (result?.post?.status === 'sent' || result?.post?.status === 'buffer') {
    console.log(`Posted — Buffer post ID: ${result.post.id}`)
  } else {
    const msg = result?.message ?? JSON.stringify(json)
    throw new Error(`Buffer post failed: ${msg}`)
  }
}

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
    `Full valuation → ${APP_URL}/stock/${ticker}`,
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

  const price      = data.quote?.price
  const fair       = data.valuationMethods?.triangulatedFairValue
  const upside     = data.valuationMethods?.triangulatedUpsidePct
  const cagr       = data.cagr
  const grade      = data.ratings?.overall?.grade ?? ''
  const label      = data.ratings?.overall?.label ?? ''
  const sector     = data.quote?.sector ?? ''

  // Business quality signals
  const grossMargin  = data.businessProfile?.grossMargin
  const netMargin    = data.businessProfile?.netMargin
  const fcfMargin    = data.businessProfile?.fcfMargin
  const roic         = data.scores?.roic?.roic
  const roicSpread   = data.scores?.roic?.spread   // ROIC - WACC: positive = value creation
  const piotroski    = data.scores?.piotroski?.score

  // Growth signals
  const hist3y       = data.cagrAnalysis?.historicalCagr3y
  const analyst1y    = data.cagrAnalysis?.analystEstimate1y
  const numAnalysts  = data.cagrAnalysis?.numAnalysts ?? 0

  // Analyst consensus
  const recommendation = data.analystRecommendation ?? ''
  const analystTarget  = data.quote?.analystTargetMean
  const forwardPE      = data.analystForwardPE

  // Price performance vs SPY
  const stock1y = data.holdingReturns?.stock1y
  const spy1y   = data.holdingReturns?.spy1y
  const stock5y = data.holdingReturns?.stock5y

  // EPS beat streak
  const surprises = data.earningsSurprises ?? []
  const beatCount = surprises.filter(s => (s.surprisePercent ?? 0) > 0).length

  if (!price || !fair) throw new Error(`No price/fair value data for ${ticker}`)

  const verdictEmoji = upside > 0.15 ? '🟢' : upside > 0 ? '🟡' : '🔴'
  const verdictText  = upside > 0.15 ? 'Undervalued' : upside > -0.05 ? 'Fairly valued' : 'Overvalued'

  // ── Build insight lines (pick the 2 most interesting signals) ──

  const insights = []

  // 1. Growth narrative
  if (analyst1y != null && numAnalysts >= 3) {
    const growthVerb = analyst1y >= 0.20 ? 'accelerating' : analyst1y >= 0.08 ? 'growing' : 'slowing'
    insights.push(`Revenue ${growthVerb} at ${pct(analyst1y, false)}/yr (${numAnalysts} analysts) · model uses ${pct(cagr, false)}`)
  } else if (hist3y != null) {
    insights.push(`3Y revenue CAGR: ${pct(hist3y, false)} · model assumes ${pct(cagr, false)} going forward`)
  }

  // 2. Profitability / moat signal
  if (roicSpread != null && roicSpread > 0.05) {
    insights.push(`ROIC ${pct(roic, false)} vs WACC — ${pct(roicSpread, false)} value spread (creating value)`)
  } else if (grossMargin != null && grossMargin > 0.50) {
    insights.push(`Gross margin: ${pct(grossMargin, false)} · Net margin: ${netMargin != null ? pct(netMargin, false) : 'N/A'}`)
  } else if (fcfMargin != null && fcfMargin > 0.15) {
    insights.push(`FCF margin: ${pct(fcfMargin, false)} — cash-generative business`)
  }

  // 3. Analyst consensus angle (only if not already 2 insights)
  if (insights.length < 2 && analystTarget && forwardPE) {
    const recLabel = recommendation === 'strong_buy' ? 'Strong Buy'
      : recommendation === 'buy' ? 'Buy'
      : recommendation === 'hold' ? 'Hold'
      : recommendation === 'sell' ? 'Sell' : null
    if (recLabel) insights.push(`Wall St: ${recLabel} · target ${fmt(analystTarget)} · fwd P/E ${forwardPE}×`)
  }

  // 4. Performance vs SPY fallback
  if (insights.length < 2 && stock1y != null && spy1y != null) {
    const vsSpyStr = stock1y > spy1y
      ? `+${((stock1y - spy1y) * 100).toFixed(0)}pp ahead of S&P 500`
      : `${((stock1y - spy1y) * 100).toFixed(0)}pp vs S&P 500`
    insights.push(`1Y return: ${pct(stock1y)} (${vsSpyStr})`)
  }

  // 5. EPS beats fallback
  if (insights.length < 2 && beatCount >= 3) {
    insights.push(`Beat EPS estimates ${beatCount} of last ${surprises.length} quarters`)
  }

  // ── Assemble tweet ──
  const lines = [
    `${verdictEmoji} $${ticker} — ${verdictText}`,
    `Price: ${fmt(price)} · Fair Value: ${fmt(fair)} · Upside: ${pct(upside)}`,
    '',
    ...insights.slice(0, 2),
    '',
    `${grade} ${label} · ${sector} · insic.app/stock/${ticker}`,
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

// ─── Macro calendar — known FOMC/CPI/NFP dates ───────────────────────────────
// Hardcoded 2025-2026 dates (UTC). Update annually.
// Sources: federalreserve.gov, bls.gov release calendars.
const MACRO_CALENDAR = [
  // FOMC meetings
  { date: '2026-01-29', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-03-19', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-05-07', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-06-18', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-07-30', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-09-17', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-11-05', type: 'FOMC',  label: 'FOMC Rate Decision' },
  { date: '2026-12-16', type: 'FOMC',  label: 'FOMC Rate Decision' },
  // CPI releases (BLS, ~2nd week of month)
  { date: '2026-01-15', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-02-12', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-03-12', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-04-10', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-05-13', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-06-11', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-07-15', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-08-12', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-09-11', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-10-14', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-11-12', type: 'CPI',   label: 'CPI Inflation Report' },
  { date: '2026-12-11', type: 'CPI',   label: 'CPI Inflation Report' },
  // NFP releases (BLS, 1st Friday of month)
  { date: '2026-01-09', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-02-06', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-03-06', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-04-03', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-05-08', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-06-05', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-07-10', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-08-07', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-09-04', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-10-02', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-11-06', type: 'NFP',   label: 'Jobs Report (NFP)' },
  { date: '2026-12-04', type: 'NFP',   label: 'Jobs Report (NFP)' },
]

// ─── Alpha Vantage helpers ─────────────────────────────────────────────────────

async function fetchAlphaVantage(fn, params = {}) {
  const url = new URL('https://www.alphavantage.co/query')
  url.searchParams.set('function', fn)
  url.searchParams.set('apikey', ALPHA_VANTAGE_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`Alpha Vantage ${fn} returned ${res.status}`)
  const json = await res.json()
  if (json['Note'] || json['Information']) throw new Error(`Alpha Vantage rate limit hit`)
  return json
}

// Returns the two most recent data points for a series: { latest, previous }
function latestTwo(data) {
  const entries = Object.entries(data).sort((a, b) => b[0].localeCompare(a[0]))
  if (entries.length < 2) return null
  return {
    latestDate:  entries[0][0],
    latestVal:   parseFloat(entries[0][1]),
    previousVal: parseFloat(entries[1][1]),
  }
}

// ─── Mode: macro ──────────────────────────────────────────────────────────────
// Posts either:
//   - A preview tweet the day BEFORE a known FOMC/CPI/NFP event
//   - A recap tweet the day OF the event using latest Alpha Vantage data
//   - A generic "market pulse" if no event is today/tomorrow

async function runMacro() {
  const todayUtc    = new Date().toISOString().split('T')[0]
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const todayEvent    = MACRO_CALENDAR.find(e => e.date === todayUtc)
  const tomorrowEvent = MACRO_CALENDAR.find(e => e.date === tomorrowUtc)

  // ── RECAP: event is today — fetch live data and post results ──
  if (todayEvent) {
    console.log(`Macro event today: ${todayEvent.label}`)
    let lines = []

    if (todayEvent.type === 'CPI') {
      const data = await fetchAlphaVantage('CPI', { interval: 'monthly' })
      const d = latestTwo(data.data ?? {})
      if (!d) throw new Error('No CPI data from Alpha Vantage')
      const chg = d.latestVal - d.previousVal
      const emoji = chg > 0.2 ? '🔴' : chg < -0.1 ? '🟢' : '🟡'
      lines = [
        `${emoji} CPI Inflation — ${d.latestDate}`,
        `Index: ${d.latestVal.toFixed(1)} (prev: ${d.previousVal.toFixed(1)})`,
        `MoM change: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)} pts`,
        '',
        chg > 0.3 ? 'Above expectations — pressure on Fed to stay higher for longer.' :
        chg < 0   ? 'Cooling inflation — builds case for rate cuts ahead.' :
        'In-line print — Fed likely on hold near-term.',
        '',
        `Full macro context → ${APP_URL}`,
        '#CPI #Inflation #Fed #Macro',
      ]
    } else if (todayEvent.type === 'NFP') {
      const data = await fetchAlphaVantage('NONFARM_PAYROLL')
      const d = latestTwo(data.data ?? {})
      if (!d) throw new Error('No NFP data from Alpha Vantage')
      const chgK = Math.round(d.latestVal - d.previousVal)
      const emoji = d.latestVal > 200 ? '🟢' : d.latestVal > 100 ? '🟡' : '🔴'
      lines = [
        `${emoji} Jobs Report (NFP) — ${d.latestDate}`,
        `Nonfarm Payrolls: ${d.latestVal.toFixed(0)}K jobs`,
        `MoM change: ${chgK >= 0 ? '+' : ''}${chgK}K`,
        '',
        d.latestVal > 250 ? 'Strong labor market — Fed less likely to cut soon.' :
        d.latestVal < 100 ? 'Weak jobs print — rate cut expectations rising.' :
        'Solid but cooling labor market.',
        '',
        `Full macro context → ${APP_URL}`,
        '#NFP #JobsReport #Fed #Macro',
      ]
    } else if (todayEvent.type === 'FOMC') {
      const data = await fetchAlphaVantage('FEDERAL_FUNDS_RATE', { interval: 'monthly' })
      const d = latestTwo(data.data ?? {})
      if (!d) throw new Error('No Fed Funds data from Alpha Vantage')
      const chg = d.latestVal - d.previousVal
      const emoji = chg > 0 ? '🔴' : chg < 0 ? '🟢' : '⚪'
      const action = chg > 0 ? `Hiked +${(chg * 100).toFixed(0)}bps` : chg < 0 ? `Cut ${(chg * 100).toFixed(0)}bps` : 'Held rates'
      lines = [
        `${emoji} FOMC Decision — Fed ${action}`,
        `Fed Funds Rate: ${d.latestVal.toFixed(2)}% (prev: ${d.previousVal.toFixed(2)}%)`,
        '',
        chg > 0 ? 'Higher rates → discount rates up → headwind for growth stocks. Check your DCF.' :
        chg < 0 ? 'Rate cut → lower WACC → DCF fair values improve. Run the model.' :
        'No change — market expected this. Watch guidance for next meeting signal.',
        '',
        `Recalculate valuations → ${APP_URL}`,
        '#FOMC #Fed #InterestRates #Macro',
      ]
    }

    await post(lines.join('\n'))
    return
  }

  // ── PREVIEW: event is tomorrow ──
  if (tomorrowEvent) {
    console.log(`Macro event tomorrow: ${tomorrowEvent.label}`)
    const typeEmoji = { CPI: '📊', NFP: '💼', FOMC: '🏦' }
    const context = {
      CPI:  'CPI measures consumer price inflation. A hot print = Fed stays higher longer. A cool print = rate cuts come closer.',
      NFP:  'Nonfarm Payrolls measure US job creation. Strong jobs = Fed on hold. Weak jobs = rate cut pressure builds.',
      FOMC: 'The Fed announces its rate decision. Changes in rates directly affect WACC — and therefore every DCF fair value.',
    }
    const lines = [
      `${typeEmoji[tomorrowEvent.type] ?? '📅'} ${tomorrowEvent.label} — Tomorrow`,
      '',
      context[tomorrowEvent.type] ?? '',
      '',
      `What to watch: how does it change valuations? → ${APP_URL}`,
      `#${tomorrowEvent.type} #Macro #FedWatch`,
    ]
    await post(lines.join('\n'))
    return
  }

  // ── MARKET PULSE: no specific event — post next upcoming event as reminder ──
  const upcoming = MACRO_CALENDAR
    .filter(e => e.date > todayUtc)
    .sort((a, b) => a.date.localeCompare(b.date))[0]

  if (!upcoming) {
    console.log('No upcoming macro events found — skipping')
    return
  }

  const daysAway = Math.round((new Date(upcoming.date) - new Date(todayUtc)) / 86400000)
  const typeEmoji = { CPI: '📊', NFP: '💼', FOMC: '🏦' }
  const lines = [
    `${typeEmoji[upcoming.type] ?? '📅'} Next macro event: ${upcoming.label}`,
    `📅 ${upcoming.date} — ${daysAway} days away`,
    '',
    `${upcoming.type === 'FOMC' ? 'Rate decisions move WACC and DCF fair values.' :
       upcoming.type === 'CPI'  ? 'Inflation data shapes Fed policy and discount rates.' :
       'Jobs data influences Fed rate expectations.'}`,
    '',
    `Monitor valuations → ${APP_URL}`,
    `#${upcoming.type} #Macro #FedWatch`,
  ]
  await post(lines.join('\n'))
}

// ─── Entry point ──────────────────────────────────────────────────────────────

const MODES = { earnings: runEarnings, dcf: runDcf, news: runNews, macro: runMacro }

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
