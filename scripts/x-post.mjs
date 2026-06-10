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

// No external imports needed — all data fetched via direct REST APIs

// ─── Config ───────────────────────────────────────────────────────────────────

const MODE                = process.env.MODE                || 'dcf'
const TICKER              = process.env.TICKER              || ''
const APP_URL             = (process.env.APP_URL            || 'https://insic.app').replace(/\/$/, '')
const DRY_RUN             = process.env.DRY_RUN             === 'true'
const BUFFER_API_KEY      = process.env.BUFFER_API_KEY      || ''
const BUFFER_CHANNEL_ID   = process.env.BUFFER_CHANNEL_ID   || ''
const AUTOMATION_API_KEY = process.env.AUTOMATION_API_KEY || ''
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

// Fetch price + % change from Yahoo Finance v8 chart API.
// Works for indices (^TNX, ^GSPC), ETFs, commodities (CL=F, GC=F), forex (DX-Y.NYB).
async function fetchYahooChart(symbol) {
  const encoded = encodeURIComponent(symbol)
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?interval=1d&range=5d`,
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
  ).catch(() => null)
  if (!res?.ok) return null
  const json = await res.json().catch(() => null)
  const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null)
  if (!closes || closes.length < 2) return null
  const price = closes[closes.length - 1]
  const prev  = closes[closes.length - 2]
  const changePct = ((price - prev) / prev) * 100
  return { symbol, price, prev, changePct }
}

// Fetch real market headlines from Yahoo Finance RSS.
// Fetch real financial news headlines from multiple RSS sources.
// Falls back through sources until enough headlines are found.
async function fetchNewsHeadlines(count = 5) {
  const FEEDS = [
    'https://feeds.reuters.com/reuters/businessNews',
    'https://feeds.marketwatch.com/marketwatch/topstories/',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://finance.yahoo.com/news/rssindex',
    'https://feeds.finance.yahoo.com/rss/2.0/headline?s=SPY&region=US&lang=en-US',
  ]

  const JUNK    = /(reverse split|\d{3,}%|OTC|pink sheet|penny stock|soared \d{3,}%)/i
  // Skip personal finance, lifestyle, government benefits — keep market/business/company news only
  const PERSONAL = /(how much will|I inherited|I'm \d+|my husband|my wife|my golf|my friend|wedding|grandchild|I've been invited|what should I do|here's how I knew|I knew his|I knew her|vulnerable senior|raising their grand|spending their retirement|financial toll|job training|budget cut could eliminate|Social Security|SSA benefits|COLA increase|retirement benefit|claiming age|insolvency in 20|pay only \d+% of benefits|calculate the exact impact|summer job into|turn a summer|teens can turn|how teens|extra \$\d+,\d+ in savings|grandparents are spending|raising grandkids|federal budget cut)/i

  function extractTitles(xml) {
    const results = []
    const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
    for (const block of itemBlocks) {
      // Handle both CDATA and plain-text title formats
      const cdataMatch = block.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/)
      const plainMatch = block.match(/<title>([^<]{10,}?)<\/title>/)
      const raw = (cdataMatch?.[1] ?? plainMatch?.[1] ?? '').trim()
      const title = raw
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'").replace(/&quot;/g, '"')
        .replace(/&#x2018;/g, "'").replace(/&#x2019;/g, "'")
        .replace(/&#x201C;/g, '"').replace(/&#x201D;/g, '"')
        .replace(/&#x2014;/g, '—').replace(/&#x2013;/g, '–')
        .replace(/&#\d+;/g, '').trim()
      if (title.length > 25 && !JUNK.test(title) && !PERSONAL.test(title)) results.push(title)
    }
    return results
  }

  const seen = new Set()
  const headlines = []

  for (const url of FEEDS) {
    if (headlines.length >= count) break
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    }).catch(() => null)
    if (!res?.ok) continue
    const xml = await res.text().catch(() => '')
    for (const title of extractTitles(xml)) {
      if (headlines.length >= count) break
      const key = title.slice(0, 50).toLowerCase()
      if (!seen.has(key)) { seen.add(key); headlines.push(title) }
    }
  }

  return headlines
}

// Format a price change line: symbol, price, pct
function fmtChange(data, label, priceDecimals = 2) {
  if (!data) return null
  const sign = data.changePct >= 0 ? '+' : ''
  const emoji = data.changePct >= 1 ? '🟢' : data.changePct <= -1 ? '🔴' : '🟡'
  return `${emoji} ${label}: ${data.price.toFixed(priceDecimals)} (${sign}${data.changePct.toFixed(2)}%)`
}

function pct(n, signed = true) {
  if (n == null || !isFinite(n)) return 'N/A'
  const val = (n * 100).toFixed(1)
  return signed ? `${n > 0 ? '+' : ''}${val}%` : `${val}%`
}

async function fetchValuation(ticker) {
  const url = `${APP_URL}/api/financials?ticker=${ticker}`
  console.log(`Fetching: ${url}`)
  const headers = { 'Content-Type': 'application/json' }
  if (AUTOMATION_API_KEY) headers['x-automation-key'] = AUTOMATION_API_KEY
  let res
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(30000) })
  } catch (err) {
    throw new Error(`Network error fetching ${url}: ${err.message}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API returned ${res.status} for ${ticker}: ${body.slice(0, 200)}`)
  }
  return res.json()
}

// Use cockpitFairValue — same number shown in the app verdict card.
// Falls back to triangulatedFairValue if cockpit wasn't computed (e.g. ETFs).
function appFairValue(data) {
  return data.valuationMethods?.cockpitFairValue ?? data.valuationMethods?.triangulatedFairValue ?? null
}
function appUpside(data) {
  return data.valuationMethods?.cockpitUpsidePct ?? data.valuationMethods?.triangulatedUpsidePct ?? null
}

// Verdict language: analyst-style, not binary buy/sell signals
function verdictLabel(upside) {
  if (upside >  0.25) return { emoji: '🟢', short: 'Attractively priced vs model',    long: 'trades at a meaningful discount to our intrinsic value estimate' }
  if (upside >  0.10) return { emoji: '🟡', short: 'Moderately below fair value',      long: 'appears modestly underpriced relative to our DCF estimate' }
  if (upside >  0.00) return { emoji: '🟡', short: 'Near fair value (slight upside)',  long: 'is trading close to our intrinsic value estimate with limited upside' }
  if (upside > -0.10) return { emoji: '🟡', short: 'Fully valued by our model',        long: 'appears fairly valued — current price reflects our base-case assumptions' }
  if (upside > -0.25) return { emoji: '🔴', short: 'Trading at a premium to model',    long: 'is trading above our intrinsic value estimate — limited margin of safety' }
  return                     { emoji: '🔴', short: 'Significant premium to fair value', long: 'is pricing in optimistic assumptions that our model does not fully support' }
}
// Finds S&P 500 stocks reporting earnings tomorrow, picks the biggest by market cap,
// and posts a DCF-based preview.

// Expanded earnings sample — covers S&P 500 + major NASDAQ earners
const SP500_SAMPLE = [
  // Mega-cap tech & cloud
  'AAPL','MSFT','NVDA','AMZN','GOOGL','META','TSLA','ORCL','ADBE','CRM',
  'NOW','INTU','AMD','NFLX','INTC','QCOM','TXN','AVGO','CSCO','ACN',
  // Semis & hardware
  'MU','AMAT','LRCX','KLAC','TER','SNPS','CDNS','ANSS','MRVL','ON',
  // Cloud/SaaS
  'SNOW','DDOG','ZS','PANW','CRWD','WDAY','TEAM','MDB','NET','GTLB',
  // Financials
  'JPM','BAC','GS','MS','WFC','C','BLK','V','MA','AXP','SCHW','BX',
  // Healthcare & pharma
  'UNH','JNJ','LLY','ABBV','MRK','AMGN','BMY','PFE','CVS','CI','ISRG',
  // Consumer & retail
  'WMT','COST','HD','TGT','MCD','SBUX','NKE','AMZN','LOW','CMG','YUM',
  // Energy
  'XOM','CVX','COP','SLB','EOG','PSX','VLO','MPC',
  // Industrials & aerospace
  'BA','CAT','HON','GE','RTX','LMT','UPS','FDX','DE','MMM','EMR',
  // Other S&P heavyweights
  'PG','KO','PEP','TMO','ABT','NEE','DUK','BRK-B','PLD','AMT',
]

async function runEarnings() {
  console.log('Fetching earnings calendar...')

  const todayStr    = new Date().toISOString().split('T')[0]
  const tomorrow    = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch quotes via Yahoo Finance v7 REST API (no yahoo-finance2 needed)
  async function fetchQuote(ticker) {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    ).catch(() => null)
    if (!res?.ok) return null
    const json = await res.json().catch(() => null)
    const meta = json?.chart?.result?.[0]?.meta
    if (!meta) return null
    return {
      symbol: ticker,
      marketCap: meta.marketCap ?? 0,
      earningsTimestamp: meta.earningsTimestampStart ?? null,
    }
  }

  // Fetch in batches to avoid rate limits
  const results = []
  for (let i = 0; i < SP500_SAMPLE.length; i += 8) {
    const batch = SP500_SAMPLE.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(fetchQuote))
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) results.push(r.value)
    }
    if (i + 8 < SP500_SAMPLE.length) await new Promise(res => setTimeout(res, 500))
  }

  // Check today AND tomorrow — catches pre-market and after-hours reports
  const reporting = results.filter(q => {
    if (!q.earningsTimestamp) return false
    const d = new Date(q.earningsTimestamp * 1000).toISOString().split('T')[0]
    if (d === todayStr || d === tomorrowStr) { q.date = d; return true }
    return false
  })

  if (reporting.length === 0) {
    console.log(`No earnings found for ${todayStr} or ${tomorrowStr} in sample — skipping post`)
    return
  }

  reporting.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
  const featured = reporting[0]
  const ticker = featured.symbol

  console.log(`Featured: ${ticker} (earnings ${tomorrowStr})`)

  let dcfBlock = ''
  try {
    const data = await fetchValuation(ticker)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    const price  = data.quote?.price
    const grade  = data.ratings?.overall?.grade
    const label  = data.ratings?.overall?.label
    const wacc   = data.wacc?.wacc
    const cagr   = data.cagr
    const bear   = data.scenarios?.bear?.fairValue
    const bull   = data.scenarios?.bull?.fairValue
    const grossM = data.businessProfile?.grossMargin
    const netM   = data.businessProfile?.netMargin
    const roic   = data.scores?.roic?.roic
    const analyst1y = data.cagrAnalysis?.analystEstimate1y
    const numAnalysts = data.cagrAnalysis?.numAnalysts ?? 0
    const rec    = data.analystRecommendation ?? ''
    const recLabel = rec === 'strong_buy' ? 'Strong Buy' : rec === 'buy' ? 'Buy' : rec === 'hold' ? 'Hold' : null
    const v = verdictLabel(upside)
    const verdictEmoji = v.emoji
    const verdictText  = v.short

    if (fair && price) {
      const parts = [
        ``,
        `━━━ DCF SNAPSHOT ━━━`,
        `Model view:  ${verdictEmoji} ${verdictText}`,
        `Price:       ${fmt(price)}`,
        `Fair Value:  ${fmt(fair)}  (${pct(upside)} vs current price)`,
        ...(bear && bull ? [`Range:      ${fmt(bear)} bear → ${fmt(bull)} bull`] : []),
        ``,
        `Model inputs: WACC ${pct(wacc, false)} · CAGR ${pct(cagr, false)}${analyst1y != null && numAnalysts >= 3 ? ` (analysts: ${pct(analyst1y, false)}, n=${numAnalysts})` : ''}`,
        ...(grossM != null ? [`Gross margin ${pct(grossM, false)} · Net margin ${netM != null ? pct(netM, false) : 'N/A'} · ROIC ${roic != null ? pct(roic, false) : 'N/A'}`] : []),
        ...(recLabel ? [`Wall St: ${recLabel}`] : []),
        ``,
        `Rating: ${grade ?? ''} ${label ?? ''}`,
        `Full model → ${APP_URL}/stock/${ticker}`,
      ]
      dcfBlock = parts.join('\n')
    }
  } catch (e) {
    console.warn('Could not fetch DCF for featured ticker:', e.message)
  }

  const others = reporting.slice(1, 5).map(q => `$${q.symbol}`)
  const featuredDate = featured.date ?? tomorrowStr
  const whenStr = featuredDate === todayStr ? 'today' : 'tomorrow'

  const lines = [
    `📊 Earnings — $${ticker} reports ${whenStr}`,
    ``,
    dcfBlock || `Run the valuation → ${APP_URL}/stock/${ticker}`,
    ``,
    ...(others.length > 0 ? [`Also reporting ${whenStr}: ${others.join(' · ')}`, ``] : []),
    `Does the business justify its current price? Run the model before the number drops.`,
    `${APP_URL}/stock/${ticker}`,
    ``,
    `#Earnings #${ticker} #DCF #StockMarket`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: dcf ────────────────────────────────────────────────────────────────
// Posts a DCF fair value snapshot for a specified or rotating stock.

// DCF rotation — large diverse pool per day so the same stock never repeats within weeks.
// Monday = Tech/Semis, Tuesday = Mega-cap + Cloud, Wednesday = Financials + Payments,
// Thursday = Healthcare + Pharma, Friday = Consumer + Energy + Industrials + Mixed
const ROTATION = {
  1: [ // Monday: Tech & Semiconductors
    'NVDA','AMD','INTC','QCOM','AVGO','TXN','MU','AMAT','LRCX','KLAC',
    'TSM','ASML','ARM','MRVL','SMCI','ON','SWKS','MPWR','ENTG','WOLF',
  ],
  2: [ // Tuesday: Mega-cap Tech, Cloud & Software
    'AAPL','MSFT','GOOGL','META','AMZN','NFLX','ADBE','CRM','NOW','INTU',
    'ORCL','SAP','SNOW','DDOG','ZS','PANW','CRWD','WDAY','TEAM','MDB',
  ],
  3: [ // Wednesday: Financials, Payments & Insurance
    'JPM','BAC','GS','MS','WFC','C','BLK','BX','KKR','AXP',
    'V','MA','PYPL','SQ','COF','USB','TFC','PNC','SCHW','ICE',
  ],
  4: [ // Thursday: Healthcare, Pharma & Biotech
    'JNJ','LLY','ABBV','MRK','AMGN','BMY','PFE','GILD','REGN','VRTX',
    'CVS','UNH','CI','HUM','ISRG','MDT','ABT','SYK','EW','IDXX',
  ],
  5: [ // Friday: Consumer, Energy, Industrials & Diversified
    'TSLA','AMZN','WMT','COST','TGT','HD','NKE','SBUX','MCD','YUM',
    'XOM','CVX','COP','SLB','EOG','NEE','DUK','SO','BA','CAT',
    'GE','HON','RTX','LMT','DE','UPS','FDX','UBER','ABNB','CMG',
  ],
}


async function runDcf() {
  // Try up to 5 tickers from the pool — skip any that fail or return no data
  const day = new Date().getDay()
  const pool = TICKER ? [TICKER] : (ROTATION[day] ?? ROTATION[1])
  const dayOfYear = Math.floor(Date.now() / 86400000)

  let ticker = null
  let data   = null
  for (let attempt = 0; attempt < Math.min(5, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt) % pool.length]
    try {
      console.log(`Trying DCF for ${candidate}...`)
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result)) {
        ticker = candidate
        data   = result
        break
      }
    } catch { /* try next */ }
  }
  if (!data) throw new Error('No valid DCF data found after attempts')

  const price      = data.quote?.price
  const fair       = appFairValue(data)
  const upside     = appUpside(data)
  const cagr       = data.cagr
  const grade      = data.ratings?.overall?.grade ?? ''
  const label      = data.ratings?.overall?.label ?? ''
  const sector     = data.quote?.sector ?? ''

  const grossMargin  = data.businessProfile?.grossMargin
  const netMargin    = data.businessProfile?.netMargin
  const fcfMargin    = data.businessProfile?.fcfMargin
  const roic         = data.scores?.roic?.roic
  const roicSpread   = data.scores?.roic?.spread
  const analyst1y    = data.cagrAnalysis?.analystEstimate1y
  const numAnalysts  = data.cagrAnalysis?.numAnalysts ?? 0
  const recommendation = data.analystRecommendation ?? ''
  const analystTarget  = data.quote?.analystTargetMean
  const forwardPE      = data.analystForwardPE
  const stock1y = data.holdingReturns?.stock1y
  const spy1y   = data.holdingReturns?.spy1y
  const surprises = data.earningsSurprises ?? []
  const beatCount = surprises.filter(s => (s.surprisePercent ?? 0) > 0).length

  if (!price || !fair) throw new Error(`No price/fair value data for ${ticker}`)

  const v = verdictLabel(upside)

  const insights = []
  if (analyst1y != null && numAnalysts >= 3) {
    const growthVerb = analyst1y >= 0.20 ? 'accelerating' : analyst1y >= 0.08 ? 'growing' : 'slowing'
    insights.push(`Revenue ${growthVerb} at ${pct(analyst1y, false)}/yr (${numAnalysts} analysts) · model uses ${pct(cagr, false)}`)
  } else if (data.cagrAnalysis?.historicalCagr3y != null) {
    insights.push(`3Y revenue CAGR: ${pct(data.cagrAnalysis.historicalCagr3y, false)} · model assumes ${pct(cagr, false)} going forward`)
  }
  if (roicSpread != null && roicSpread > 0.05) {
    insights.push(`ROIC ${pct(roic, false)} vs WACC — ${pct(roicSpread, false)} value spread (creating value)`)
  } else if (grossMargin != null && grossMargin > 0.50) {
    insights.push(`Gross margin: ${pct(grossMargin, false)} · Net margin: ${netMargin != null ? pct(netMargin, false) : 'N/A'}`)
  } else if (fcfMargin != null && fcfMargin > 0.15) {
    insights.push(`FCF margin: ${pct(fcfMargin, false)} — cash-generative business`)
  }
  if (insights.length < 2 && analystTarget && forwardPE) {
    const recLabel = recommendation === 'strong_buy' ? 'Strong Buy' : recommendation === 'buy' ? 'Buy' : recommendation === 'hold' ? 'Hold' : null
    if (recLabel) insights.push(`Wall St: ${recLabel} · target ${fmt(analystTarget)} · fwd P/E ${forwardPE}×`)
  }
  if (insights.length < 2 && stock1y != null && spy1y != null) {
    const vsSpyStr = stock1y > spy1y ? `+${((stock1y - spy1y) * 100).toFixed(0)}pp ahead of S&P 500` : `${((stock1y - spy1y) * 100).toFixed(0)}pp vs S&P 500`
    insights.push(`1Y return: ${pct(stock1y)} (${vsSpyStr})`)
  }
  if (insights.length < 2 && beatCount >= 3) {
    insights.push(`Beat EPS estimates ${beatCount} of last ${surprises.length} quarters`)
  }

  const wacc      = data.wacc?.wacc
  const terminalG = data.terminalG
  const bear      = data.scenarios?.bear?.fairValue
  const bull      = data.scenarios?.bull?.fairValue
  const revenueM  = data.businessProfile?.revenueM

  const lines = [
    `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    `━━━ VALUATION ━━━`,
    `Current price:  ${fmt(price)}`,
    `Fair value est: ${fmt(fair)}`,
    `Difference:     ${pct(upside)} vs current price`,
    `Model view: ${ticker} ${v.long}`,
    ...(bear && bull ? [`Scenario range: ${fmt(bear)} (bear) → ${fmt(bull)} (bull)`] : []),
    ``,
    `━━━ MODEL INPUTS ━━━`,
    `WACC:         ${pct(wacc, false)}`,
    `Revenue CAGR: ${pct(cagr, false)} (model) ${analyst1y != null && numAnalysts >= 3 ? `· ${pct(analyst1y, false)}/yr analyst est (${numAnalysts})` : ''}`,
    ...(terminalG ? [`Terminal growth: ${pct(terminalG, false)}`] : []),
    ``,
    `━━━ BUSINESS QUALITY ━━━`,
    ...(grossMargin != null ? [`Gross margin: ${pct(grossMargin, false)}`] : []),
    ...(netMargin != null ? [`Net margin:   ${pct(netMargin, false)}`] : []),
    ...(fcfMargin != null ? [`FCF margin:   ${pct(fcfMargin, false)}`] : []),
    ...(roic != null ? [`ROIC: ${pct(roic, false)} ${roicSpread != null ? `(${roicSpread > 0 ? '+' : ''}${pct(roicSpread, false)} vs WACC)` : ''}`] : []),
    ...(revenueM ? [`Revenue: ${fmt(revenueM * 1e6)}`] : []),
    ``,
    `━━━ ANALYST CONSENSUS ━━━`,
    ...(recommendation ? [`Wall St: ${recommendation === 'strong_buy' ? 'Strong Buy' : recommendation === 'buy' ? 'Buy' : recommendation === 'hold' ? 'Hold' : recommendation === 'sell' ? 'Sell' : recommendation}`] : []),
    ...(analystTarget ? [`Price target: ${fmt(analystTarget)}`] : []),
    ...(forwardPE ? [`Forward P/E:  ${forwardPE}×`] : []),
    ...(beatCount > 0 ? [`EPS beats: ${beatCount}/${surprises.length} last quarters`] : []),
    ...(stock1y != null && spy1y != null ? [`1Y return: ${pct(stock1y)} vs SPY ${pct(spy1y)}`] : []),
    ``,
    `Rating: ${grade} ${label} · ${sector}`,
    ``,
    `Model view: $${ticker} ${v.long}.`,
    ``,
    `Full interactive model → ${APP_URL}/stock/${ticker}`,
    `#DCF #Valuation #${ticker} #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}


// ─── Mode: news ───────────────────────────────────────────────────────────────
// Pulls top market news headline from Yahoo Finance and posts it with a brief take.

async function runNews() {
  // Yahoo Finance news via direct REST API (no yahoo-finance2 needed)
  const res = await fetch(
    'https://query1.finance.yahoo.com/v1/finance/trending/US?count=5',
    { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) }
  ).catch(() => null)

  let newsItems = []
  if (res?.ok) {
    const json = await res.json().catch(() => null)
    // Trending quotes give us tickers; fetch news from Yahoo search
    const tickers = json?.finance?.result?.[0]?.quotes?.slice(0, 3).map(q => q.symbol) ?? []
    if (tickers.length > 0) {
      const newsRes = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${tickers[0]}&newsCount=3&quotesCount=0`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      ).catch(() => null)
      if (newsRes?.ok) {
        const newsJson = await newsRes.json().catch(() => null)
        newsItems = newsJson?.news ?? []
      }
    }
  }

  if (newsItems.length === 0) {
    console.log('No news found — skipping')
    return
  }

  // Pick the first news item with a title
  const item = newsItems.find(n => n.title?.length > 20) ?? newsItems[0]
  const title = item.title ?? ''
  const link  = item.link  ?? ''

  const tickerMentions = [...new Set((item.relatedTickers ?? []).slice(0, 3).map(t => `$${t}`))]
  const hashPart = tickerMentions.length > 0
    ? tickerMentions.join(' ') + ' #FinancialNews'
    : '#Markets #FinancialNews'

  const lines = [
    `📰 ${title}`,
    ``,
    ...(link ? [link, ``] : []),
    `━━━ WHY THIS MATTERS ━━━`,
    `Every major headline has a valuation angle. Ask yourself:`,
    `• Does this change the company's revenue trajectory?`,
    `• Does it affect the discount rate (WACC)?`,
    `• Does it change the terminal growth assumption?`,
    ``,
    `If yes to any of the above, the fair value just moved.`,
    ``,
    ...(tickerMentions.length > 0 ? [`Run the updated model on ${tickerMentions.join(', ')} → ${APP_URL}`, ``] : [`${APP_URL}`, ``]),
    hashPart,
  ]

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
  { date: '2026-06-10', type: 'CPI',   label: 'CPI Inflation Report' },
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
        `${emoji} CPI Inflation Report — ${d.latestDate}`,
        ``,
        `Index: ${d.latestVal.toFixed(1)}  (prev: ${d.previousVal.toFixed(1)})`,
        `Month-over-month change: ${chg >= 0 ? '+' : ''}${chg.toFixed(2)} pts`,
        ``,
        `━━━ WHAT THIS MEANS ━━━`,
        chg > 0.3
          ? `Hotter than expected. The Fed has less room to cut. Higher rates for longer means higher WACC — and lower DCF fair values across the board, especially for long-duration growth stocks.`
          : chg < 0
          ? `Cooling inflation. Rate cut expectations rise. Lower discount rates mean higher fair values — especially for high-growth names that benefit most from lower WACC.`
          : `In-line print. Fed likely holds. Market prices remain anchored to current rate expectations.`,
        ``,
        `━━━ VALUATION IMPACT ━━━`,
        `A 1% change in WACC typically moves a growth stock's fair value by 15–25%.`,
        `If you're holding stocks with elevated valuations, this print matters.`,
        ``,
        `Re-run your models with updated rates → ${APP_URL}`,
        `#CPI #Inflation #Fed #Macro #Investing`,
      ]
    } else if (todayEvent.type === 'NFP') {
      const data = await fetchAlphaVantage('NONFARM_PAYROLL')
      const d = latestTwo(data.data ?? {})
      if (!d) throw new Error('No NFP data from Alpha Vantage')
      const chgK = Math.round(d.latestVal - d.previousVal)
      const emoji = d.latestVal > 200 ? '🟢' : d.latestVal > 100 ? '🟡' : '🔴'
      lines = [
        `${emoji} Jobs Report (NFP) — ${d.latestDate}`,
        ``,
        `Nonfarm Payrolls: ${d.latestVal.toFixed(0)}K new jobs`,
        `Month-over-month change: ${chgK >= 0 ? '+' : ''}${chgK}K`,
        ``,
        `━━━ WHAT THIS MEANS ━━━`,
        d.latestVal > 250
          ? `Strong labor market. The Fed has no reason to cut. Higher-for-longer rates are the base case — which compresses DCF fair values on growth stocks and keeps value names relatively attractive.`
          : d.latestVal < 100
          ? `Weak jobs print. Rate cut expectations are building. Lower discount rates would lift DCF fair values, especially for long-duration tech and growth names.`
          : `Solid but cooling. The labor market is normalizing — which is exactly what the Fed wants to see before cutting. Neutral for valuations near-term.`,
        ``,
        `A healthy labor market is good for consumer stocks, banks, and cyclicals.`,
        `A weak print is good for rate-sensitive growth names.`,
        ``,
        `Check which stocks benefit → ${APP_URL}`,
        `#NFP #JobsReport #Fed #Macro #Investing`,
      ]
    } else if (todayEvent.type === 'FOMC') {
      const data = await fetchAlphaVantage('FEDERAL_FUNDS_RATE', { interval: 'monthly' })
      const d = latestTwo(data.data ?? {})
      if (!d) throw new Error('No Fed Funds data from Alpha Vantage')
      const chg = d.latestVal - d.previousVal
      const emoji = chg > 0 ? '🔴' : chg < 0 ? '🟢' : '⚪'
      const action = chg > 0 ? `Hiked +${(chg * 100).toFixed(0)}bps` : chg < 0 ? `Cut ${Math.abs(chg * 100).toFixed(0)}bps` : 'Held rates'
      lines = [
        `${emoji} FOMC Decision — Fed ${action}`,
        ``,
        `Fed Funds Rate: ${d.latestVal.toFixed(2)}%  (was: ${d.previousVal.toFixed(2)}%)`,
        ``,
        `━━━ VALUATION IMPACT ━━━`,
        chg > 0
          ? `Higher rates → higher WACC → lower DCF fair values.\n\nGrowth stocks (long duration) take the biggest hit. A 1% WACC increase on a high-growth stock can cut fair value by 20–30%.\n\nValue stocks and dividend payers are relatively insulated — their near-term cash flows discount less.`
          : chg < 0
          ? `Rate cut → lower WACC → higher DCF fair values.\n\nGrowth stocks benefit most. Every 1% drop in WACC adds 15–25% to a typical growth stock's fair value.\n\nAlready priced in? The market usually front-runs cuts — check if the current price already reflects the new rate regime.`
          : `No change — in line with expectations.\n\nThe real signal is in the guidance: how many cuts are projected for the year? Any shift in the dot plot changes the path of WACC, which flows directly into every valuation model.`,
        ``,
        `Re-run your valuations with the new rate → ${APP_URL}`,
        `#FOMC #Fed #InterestRates #Macro #Investing`,
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
      CPI:  `CPI (Consumer Price Index) measures inflation — how much prices are rising across the economy.\n\nWhy investors care: CPI directly influences Fed policy. A hot print keeps rates high. A cool print opens the door to cuts.\n\nRates drive WACC. WACC drives every DCF model. A single CPI print can shift the fair value of every growth stock you own.`,
      NFP:  `Nonfarm Payrolls measures how many jobs the US economy added last month.\n\nWhy investors care: Strong jobs = Fed stays on hold. Weak jobs = Fed cuts sooner.\n\nThe labor market is the Fed's second mandate. When employment is strong, they don't need to cut. When it weakens, rate cuts follow — and DCF fair values rise.`,
      FOMC: `The Federal Reserve announces its rate decision tomorrow.\n\nWhy investors care: The Fed Funds Rate is the anchor for all other rates — including the risk-free rate in every DCF model.\n\nWhen rates change, WACC changes. When WACC changes, every fair value calculation changes. This is the single most important macro event for equity valuation.`,
    }
    const lines = [
      `${typeEmoji[tomorrowEvent.type] ?? '📅'} ${tomorrowEvent.label} — Tomorrow`,
      ``,
      context[tomorrowEvent.type] ?? '',
      ``,
      `What to watch: does the print change your WACC assumptions? That's the question that matters.`,
      ``,
      `Run your models ahead of the release → ${APP_URL}`,
      `#${tomorrowEvent.type} #Macro #FedWatch #Investing`,
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
  const upcomingContext = {
    CPI:  `CPI inflation data in ${daysAway} day${daysAway > 1 ? 's' : ''}.\n\nThis is the single most market-moving release right now. A hot print keeps rates elevated — which raises WACC and compresses fair values on growth stocks. A cool print opens the door to rate cuts and lifts them.\n\nWatch the core CPI number closely. The headline can be distorted by energy.`,
    NFP:  `Jobs report in ${daysAway} day${daysAway > 1 ? 's' : ''}.\n\nStrong payrolls = Fed on hold, rates stay elevated. Weak payrolls = rate cuts come sooner, discount rates fall.\n\nThe prior month revision often matters as much as the headline — markets trade the trend, not the single print.`,
    FOMC: `Federal Reserve rate decision in ${daysAway} day${daysAway > 1 ? 's' : ''}.\n\nThe rate decision itself is usually priced in. The real signal is the dot plot (where committee members expect rates to go) and Powell's language on the timing of cuts.\n\nEvery basis point shift in the path of rates flows directly into WACC — and into every fair value estimate.`,
  }
  const lines = [
    `${typeEmoji[upcoming.type] ?? '📅'} ${upcoming.label} — ${daysAway} day${daysAway > 1 ? 's' : ''} away`,
    '',
    upcomingContext[upcoming.type] ?? `${upcoming.label} is ${daysAway} days away.`,
    '',
    `${APP_URL}`,
    `#${upcoming.type} #Macro #FedWatch`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: feature ────────────────────────────────────────────────────────────
// Daily app education post — rotates through 7 angles (one per day of week).
// Goal: teach the audience how insic works and drive clicks.

const FEATURE_POSTS = {
  1: { // Monday
    lines: [
      `📐 What is DCF — and why does it matter for investors?`,
      ``,
      `DCF (Discounted Cash Flow) is the foundational method for estimating what a business is intrinsically worth.`,
      ``,
      `The core idea is simple: a business is worth the sum of all the cash it will generate in the future, discounted back to today's dollars.`,
      ``,
      `━━━ THE FORMULA IN PLAIN ENGLISH ━━━`,
      `1. Estimate how much free cash flow the business will generate each year`,
      `2. Apply a discount rate (WACC) to reflect risk and the time value of money`,
      `3. Add a terminal value for cash flows beyond the projection period`,
      `4. Subtract debt, add cash → divide by shares outstanding`,
      ``,
      `━━━ WHY IT MATTERS ━━━`,
      `Price tells you what the market currently thinks a stock is worth.`,
      `DCF tells you what the underlying business is worth.`,
      ``,
      `The gap between the two is where investing opportunities live.`,
      ``,
      `A stock trading at $200 with a DCF fair value of $300 has a 50% margin of safety.`,
      `A stock at $200 with a fair value of $120 is pricing in perfection — and then some.`,
      ``,
      `Most investors skip this step and pay whatever the market asks. That's how they overpay.`,
      ``,
      `Run a free DCF on any NYSE/NASDAQ stock → ${APP_URL}`,
      `#DCF #Investing #StockValuation #FundamentalAnalysis`,
    ],
  },
  2: { // Tuesday
    lines: [
      `📉 WACC — the number that determines what every stock is worth`,
      ``,
      `WACC (Weighted Average Cost of Capital) is the discount rate in a DCF model. It's arguably the most important single number in equity valuation — and most investors have never heard of it.`,
      ``,
      `━━━ WHAT WACC REPRESENTS ━━━`,
      `WACC is the minimum return a business must earn to justify its existence.`,
      ``,
      `If a business earns less than its WACC → it's destroying shareholder value`,
      `If a business earns more than its WACC → it's creating value`,
      ``,
      `━━━ WHY IT MOVES VALUATIONS ━━━`,
      `Higher WACC = future cash flows are worth less today → lower fair value`,
      `Lower WACC = future cash flows are worth more today → higher fair value`,
      ``,
      `This is why the Fed matters so much to investors. When rates rise:`,
      `• Risk-free rate goes up`,
      `• WACC goes up`,
      `• DCF fair values go down`,
      ``,
      `A 2% increase in WACC can cut a growth stock's fair value by 20–40%.`,
      ``,
      `━━━ WHAT DRIVES WACC ━━━`,
      `• Risk-free rate (US 10-year Treasury yield)`,
      `• Beta (how volatile the stock is vs. the market)`,
      `• Equity risk premium`,
      `• Cost of debt × (1 - tax rate)`,
      `• Capital structure (debt/equity mix)`,
      ``,
      `See the live WACC breakdown for any stock → ${APP_URL}`,
      `#WACC #DCF #Investing #InterestRates`,
    ],
  },
  3: { // Wednesday
    lines: [
      `📈 How to think about growth in a DCF model`,
      ``,
      `The growth assumption is the single biggest driver of fair value. Get it wrong and you can be off by 50%. Here's how to think about it rigorously.`,
      ``,
      `━━━ THREE GROWTH SIGNALS ━━━`,
      ``,
      `1. Historical CAGR (3-year)`,
      `What the business has actually delivered. Backward-looking, but grounded in reality. High-growth companies often can't sustain their historical rate as they scale.`,
      ``,
      `2. Analyst forward estimates`,
      `Consensus revenue growth from sell-side analysts. More forward-looking, but subject to herding bias. More weight when coverage is deep (10+ analysts).`,
      ``,
      `3. Fundamental growth rate`,
      `Derived from ROE × earnings retention rate. What the business can organically grow without external capital. A sanity check on the other two.`,
      ``,
      `━━━ THE CONVERGENCE DISCOUNT ━━━`,
      `No company grows fast forever. Damodaran's research shows that high-growth companies systematically mean-revert toward industry and economy-wide growth rates.`,
      ``,
      `We apply a convergence discount: raw blended growth gets haircut toward a stable long-run rate. This prevents models from pricing in perpetual 40% growth.`,
      ``,
      `━━━ WHAT THIS MEANS IN PRACTICE ━━━`,
      `A stock pricing in 30% perpetual growth is almost always a bad bet.`,
      `A stock pricing in 8% growth on a business delivering 20% might be a great one.`,
      ``,
      `See the growth model for any stock → ${APP_URL}`,
      `#Valuation #DCF #GrowthInvesting #FinancialModeling`,
    ],
  },
  4: { // Thursday
    lines: [
      `🐻 Why one fair value number isn't enough — the case for scenario analysis`,
      ``,
      `Every DCF model is built on assumptions. Assumptions can be wrong. The solution isn't to find the "right" number — it's to understand the range.`,
      ``,
      `━━━ THREE SCENARIOS ━━━`,
      ``,
      `🐻 Bear case`,
      `Higher WACC (Fed doesn't cut, risk premium expands)`,
      `Lower CAGR (growth disappoints vs. expectations)`,
      `Lower terminal growth`,
      `→ Shows downside if things go wrong`,
      ``,
      `⚖️ Base case`,
      `Our best estimate using blended growth signals and current market rates`,
      `→ The expected outcome`,
      ``,
      `🐂 Bull case`,
      `Lower WACC (rate cuts, multiple expansion)`,
      `Higher CAGR (growth beats expectations)`,
      `Higher terminal growth`,
      `→ Shows upside if things go right`,
      ``,
      `━━━ HOW TO USE THE RANGE ━━━`,
      `The width of the range tells you how uncertain the valuation is.`,
      ``,
      `Narrow range ($180–$220): high confidence, fairly predictable business`,
      `Wide range ($80–$300): highly uncertain, depends heavily on assumptions`,
      ``,
      `A stock where the bear case = current price is a stock with no margin of safety.`,
      `A stock where the bear case is 30% below and the bull is 100% above? That's an asymmetric bet.`,
      ``,
      `See bear/base/bull for any stock → ${APP_URL}`,
      `#DCF #ScenarioAnalysis #Investing #RiskManagement`,
    ],
  },
  5: { // Friday
    lines: [
      `🏆 ROIC vs WACC — the only moat metric that actually matters`,
      ``,
      `Warren Buffett talks about moats. Most investors think about brand or market share. The most rigorous way to measure a moat is ROIC vs WACC.`,
      ``,
      `━━━ DEFINITIONS ━━━`,
      `ROIC (Return on Invested Capital): how much profit the business generates per dollar of capital deployed`,
      `WACC (Weighted Average Cost of Capital): the minimum return the business needs to earn to justify that capital`,
      ``,
      `━━━ THE SPREAD ━━━`,
      `ROIC > WACC = value creation. The business earns more than it costs to operate.`,
      `ROIC < WACC = value destruction. Even profitable companies can be destroying shareholder value.`,
      `ROIC = WACC = breakeven. Capital earns exactly what it costs.`,
      ``,
      `━━━ WHAT SEPARATES GREAT BUSINESSES ━━━`,
      `Apple: ROIC ~50%+. Every dollar deployed returns 50 cents in profit.`,
      `Most retailers: ROIC near WACC. Thin margins, commodity economics.`,
      `Capital-heavy utilities: ROIC often below WACC before regulatory returns.`,
      ``,
      `━━━ THE VALUATION CONNECTION ━━━`,
      `A business that consistently earns ROIC >> WACC deserves a premium multiple.`,
      `A business earning ROIC < WACC deserves to trade below book value.`,
      ``,
      `Most "expensive" stocks look cheap when you account for ROIC spread.`,
      `Many "cheap" stocks are value traps when ROIC is below WACC.`,
      ``,
      `Check ROIC vs WACC for any stock → ${APP_URL}`,
      `#ROIC #Moat #ValueInvesting #Buffett #DCF`,
    ],
  },
  6: { // Saturday
    lines: [
      `⚡ How insic works — a full walkthrough`,
      ``,
      `insic runs a multi-model DCF valuation on any NYSE or NASDAQ stock. Here's exactly what happens when you type a ticker:`,
      ``,
      `━━━ THE 5-MODEL BLEND ━━━`,
      ``,
      `1. FCFF DCF (Unlevered)`,
      `Free cash flow to the firm, discounted at WACC. The Damodaran standard. WACC is calculated from CAPM + country risk premium.`,
      ``,
      `2. FCFE DCF (Levered)`,
      `Free cash flow to equity, discounted at the cost of equity. Strips out the debt layer.`,
      ``,
      `3. DDM (Dividend Discount Model)`,
      `For dividend-paying companies. Prices the dividend stream.`,
      ``,
      `4. Forward P/E multiple`,
      `Relative valuation anchored to analyst consensus EPS.`,
      ``,
      `5. EV/EBITDA multiple`,
      `Enterprise value relative to operating earnings.`,
      ``,
      `━━━ THE OUTPUT ━━━`,
      `Each model is weighted by company type (growth, financial, dividend, etc.) and blended into a single consensus fair value.`,
      ``,
      `You also see: bear/base/bull scenarios, ROIC vs WACC, Piotroski score, Altman Z-score, Beneish M-score, analyst estimates, EPS surprises, financial statements.`,
      ``,
      `━━━ WHAT MAKES IT DIFFERENT ━━━`,
      `Every assumption is shown. You can override WACC, CAGR, and terminal growth and see the fair value update in real time.`,
      ``,
      `No black box. No opinion. Just a transparent model you can stress-test.`,
      ``,
      `Free for any stock → ${APP_URL}`,
      `#DCF #Investing #StockAnalysis #FinancialModeling`,
    ],
  },
  0: { // Sunday
    lines: [
      `💡 Fair value vs price target — they're measuring completely different things`,
      ``,
      `This confusion costs investors money. Here's the difference:`,
      ``,
      `━━━ ANALYST PRICE TARGET ━━━`,
      `• Where an analyst thinks the stock will trade in 12 months`,
      `• Based on relative multiples, sentiment, and recent catalysts`,
      `• Revised frequently based on news flow`,
      `• Often anchors to recent price (behavioral bias)`,
      `• A prediction about market behavior`,
      ``,
      `━━━ DCF FAIR VALUE ━━━`,
      `• What the underlying business is intrinsically worth today`,
      `• Based on discounted future cash flows, independent of market mood`,
      `• Grounded in business fundamentals: growth, margins, WACC`,
      `• Changes only when business fundamentals change`,
      `• A claim about business value, not price movement`,
      ``,
      `━━━ WHY THIS MATTERS ━━━`,
      `A stock can be at its analyst price target and still be 40% overvalued by DCF.`,
      `A stock can be well below its price target but still expensive relative to intrinsic value.`,
      ``,
      `In bull markets, price targets chase the stock up — and investors mistake momentum for value.`,
      `In bear markets, price targets get cut and investors mistake fear for cheapness.`,
      ``,
      `DCF doesn't care what the market is doing. It asks one question: what will this business generate in cash, and what's that worth today?`,
      ``,
      `That's the question worth asking before you invest → ${APP_URL}`,
      `#Investing #ValueInvesting #DCF #StockMarket`,
    ],
  },
}

async function runFeature() {
  const day = new Date().getDay()
  const hour = new Date().getUTCHours()
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  // Vary by day + week + hour bucket so no two posts on the same day ever share content
  const dayKeys = [0, 1, 2, 3, 4, 5, 6]
  const seed = day + weekOfYear * 7 + Math.floor(hour / 3) // shifts every 3 hours
  const shiftedDay = dayKeys[seed % 7]
  const post_content = FEATURE_POSTS[shiftedDay] ?? FEATURE_POSTS[1]
  const text = post_content.lines
    .map(l => l.replace(/\$\{APP_URL\}/g, APP_URL))
    .join('\n')
  await post(text)
}

// ─── Mode: weekly_wrap ────────────────────────────────────────────────────────
// Saturday — top 3 most interesting DCF verdicts of the week.
// Picks 1 undervalued + 1 overvalued + 1 from the weekly rotation.

const WEEKLY_PICKS = [
  ['AAPL', 'MSFT',  'JPM'],
  ['NVDA', 'GOOGL', 'JNJ'],
  ['AMZN', 'META',  'V'],
  ['MSFT', 'AAPL',  'KO'],
  ['GOOGL','NVDA',  'BAC'],
]

async function runWeeklyWrap() {
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const tickers = WEEKLY_PICKS[weekOfYear % WEEKLY_PICKS.length]

  console.log(`Weekly wrap tickers: ${tickers.join(', ')}`)

  const results = await Promise.allSettled(tickers.map(t => fetchValuation(t)))
  const stocks = results
    .map((r, i) => r.status === 'fulfilled' ? { ticker: tickers[i], data: r.value } : null)
    .filter(Boolean)
    .map(({ ticker, data }) => ({
      ticker,
      price: data.quote?.price,
      fair: appFairValue(data),
      upside: appUpside(data),
    }))
    .filter(s => s.price && s.fair)

  if (stocks.length === 0) throw new Error('No valuation data for weekly wrap')

  const lines = [
    `📊 Weekly Valuation Wrap`,
    ``,
    `This week's DCF verdicts on some of the most-watched names:`,
    ``,
  ]

  for (const s of stocks) {
    const v = verdictLabel(s.upside)
    lines.push(`${v.emoji} $${s.ticker}`)
    lines.push(`   Price ${fmt(s.price)} · Fair value est ${fmt(s.fair)} · ${pct(s.upside)} vs current price`)
    lines.push(`   Model view: ${v.short}`)
    lines.push(``)
  }

  lines.push(`These numbers come straight out of a full DCF — WACC, CAGR, terminal growth, 4-model blend.`)
  lines.push(``)
  lines.push(`Not a buy/sell signal. A starting point for your own thinking.`)
  lines.push(``)
  lines.push(`Full interactive models → ${APP_URL}`)
  lines.push(`#Stocks #DCF #Investing #WeeklyWrap`)

  await post(lines.join('\n'))
}

// ─── Mode: question ───────────────────────────────────────────────────────────
// Sunday — rotating engagement question to drive replies and impressions.

const QUESTIONS = [
  [
    `💭 Which metric do you use most to value a stock?`,
    ``,
    `→ P/E ratio`,
    `→ DCF / intrinsic value`,
    `→ Analyst price targets`,
    `→ Revenue growth rate`,
    ``,
    `Reply below 👇`,
    ``,
    `Run a free DCF on any stock → ${APP_URL}`,
    `#Investing #Stocks #StockMarket`,
  ],
  [
    `💭 What's your biggest challenge when researching a stock?`,
    ``,
    `→ Too much data, don't know what matters`,
    `→ Don't understand valuation models`,
    `→ Hard to find reliable free data`,
    `→ Takes too long`,
    ``,
    `Reply below 👇 — we built insic to solve exactly this.`,
    ``,
    `${APP_URL}`,
    `#Investing #Stocks #RetailInvestors`,
  ],
  [
    `💭 Do you think $NVDA is expensive at current prices?`,
    ``,
    `Our model: 🔴 Trading at a significant premium to fair value`,
    `Wall St: Strong Buy`,
    ``,
    `Two very different frameworks. Which one are you using?`,
    `Run the model yourself → ${APP_URL}/stock/NVDA`,
    ``,
    `#NVDA #Nvidia #DCF #Investing`,
  ],
  [
    `💭 Warren Buffett famously avoids tech stocks he can't value.`,
    ``,
    `Do you think DCF works for high-growth tech companies like $AMZN or $MSFT?`,
    ``,
    `→ Yes, with adjusted assumptions`,
    `→ No, different framework needed`,
    `→ Only for mature tech`,
    ``,
    `See how we model it → ${APP_URL}`,
    `#ValueInvesting #Buffett #DCF`,
  ],
]

async function runQuestion() {
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const q = QUESTIONS[weekOfYear % QUESTIONS.length]
  const text = q.map(l => l.replace(/\$\{APP_URL\}/g, APP_URL)).join('\n')
  await post(text)
}


// ─── Mode: dcf_bear ───────────────────────────────────────────────────────────
// Evening DCF — different stock pool from the noon slot, neutral analysis.
// Picks stocks where model vs market price creates interesting discussion.
// No bull/bear framing — just the numbers and what they mean.

// Evening rotation — deliberately uses DIFFERENT sectors than the noon ROTATION
// to guarantee no stock appears twice in the same day.
// Noon:    Mon=Semis,    Tue=Tech/Cloud, Wed=Financials, Thu=Healthcare, Fri=Consumer/Energy
// Evening: Mon=Consumer, Tue=Financials, Wed=Healthcare, Thu=Tech,       Fri=Semis+Industrials
const BEAR_ROTATION = {
  1: ['WMT','COST','HD','TGT','NKE','SBUX','MCD','CMG','YUM','ABNB',  // Monday evening: consumer (noon=semis)
      'BKNG','MAR','HLT','DIS','NFLX','AMZN','LVS','MGM','WYNN','RCL'],
  2: ['JPM','BAC','GS','MS','WFC','C','BLK','BX','KKR','AXP',          // Tuesday evening: financials (noon=tech)
      'V','MA','COF','USB','TFC','PNC','SCHW','ICE','CME','SPGI'],
  3: ['LLY','UNH','JNJ','ABBV','MRK','AMGN','BMY','PFE','CVS','CI',    // Wednesday evening: healthcare (noon=financials)
      'ISRG','MDT','ABT','SYK','EW','IDXX','GILD','REGN','VRTX','BIIB'],
  4: ['NVDA','MSFT','GOOGL','META','ORCL','ADBE','NOW','INTU','CRM','SAP', // Thursday evening: tech (noon=healthcare)
      'SNOW','DDOG','ZS','PANW','CRWD','WDAY','TEAM','MDB','NET','GTLB'],
  5: ['TXN','QCOM','INTC','AMAT','LRCX','MU','KLAC','ON','MRVL','ARM', // Friday evening: semis+industrials (noon=consumer)
      'BA','CAT','HON','GE','RTX','LMT','UPS','FDX','DE','EMR'],
  6: ['XOM','CVX','COP','SLB','EOG','PSX','VLO','MPC','NEE','DUK',     // Saturday: energy+utilities
      'SO','AEP','EXC','PCG','SRE','ETR','WEC','ES','DTE','PPL'],
  0: ['PG','KO','PEP','TMO','ABT','NEE','PLD','AMT','CCI','EQIX',      // Sunday: defensives+REITs
      'BRK-B','MMM','EMR','GD','NOC','HII','L','MKC','CLX','CHD'],
}

async function runDcfBear() {
  const day = new Date().getDay()
  const pool = BEAR_ROTATION[day] ?? BEAR_ROTATION[2]
  const dayOfYear = Math.floor(Date.now() / 86400000)

  // Try up to 8 tickers — need valid price AND fair value data
  let ticker = null
  let data   = null
  for (let attempt = 0; attempt < Math.min(8, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt) % pool.length]
    try {
      console.log(`Trying evening DCF for ${candidate}...`)
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result)) {
        ticker = candidate
        data   = result
        break
      }
    } catch { /* try next */ }
  }
  if (!data) throw new Error('No valid evening DCF data found after attempts')

  const price   = data.quote?.price
  const fair    = appFairValue(data)
  const upside  = appUpside(data)
  const cagr    = data.cagr
  const wacc    = data.wacc?.wacc
  const terminalG = data.terminalG
  const grade   = data.ratings?.overall?.grade ?? ''
  const label   = data.ratings?.overall?.label ?? ''
  const sector  = data.quote?.sector ?? ''
  const grossMargin = data.businessProfile?.grossMargin
  const netMargin   = data.businessProfile?.netMargin
  const fcfMargin   = data.businessProfile?.fcfMargin
  const roic        = data.scores?.roic?.roic
  const roicSpread  = data.scores?.roic?.spread
  const analyst1y   = data.cagrAnalysis?.analystEstimate1y
  const numAnalysts = data.cagrAnalysis?.numAnalysts ?? 0
  const recommendation = data.analystRecommendation ?? ''
  const analystTarget  = data.quote?.analystTargetMean
  const forwardPE      = data.analystForwardPE
  const bear = data.scenarios?.bear?.fairValue
  const bull = data.scenarios?.bull?.fairValue
  const revenueM = data.businessProfile?.revenueM
  const surprises  = data.earningsSurprises ?? []
  const beatCount  = surprises.filter(s => (s.surprisePercent ?? 0) > 0).length
  const stock1y    = data.holdingReturns?.stock1y
  const spy1y      = data.holdingReturns?.spy1y

  if (!price || !fair) throw new Error(`No price/fair value data for ${ticker}`)

  const v = verdictLabel(upside)
  const recLabel = recommendation === 'strong_buy' ? 'Strong Buy'
    : recommendation === 'buy' ? 'Buy'
    : recommendation === 'hold' ? 'Hold'
    : recommendation === 'sell' ? 'Sell' : null

  // Neutral analysis — no bull/bear label. Just model vs market.
  const modelVsMarket = recLabel && Math.abs(upside) > 0.15
    ? `Wall St consensus: ${recLabel}. Model estimate: ${v.short}. The gap is worth understanding.`
    : Math.abs(upside) > 0.25
    ? `Model and market price diverge significantly (${pct(upside)}). One of them is wrong.`
    : `Model and market are broadly aligned on this one.`

  const lines = [
    `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    `━━━ VALUATION ━━━`,
    `Current price:  ${fmt(price)}`,
    `Fair value est: ${fmt(fair)}`,
    `Difference:     ${pct(upside)} vs current price`,
    ...(bear && bull ? [`Scenario range: ${fmt(bear)} (bear) → ${fmt(bull)} (bull)`] : []),
    ``,
    modelVsMarket,
    ``,
    `━━━ MODEL INPUTS ━━━`,
    `WACC:         ${pct(wacc, false)}`,
    `Revenue CAGR: ${pct(cagr, false)} (model)${analyst1y != null && numAnalysts >= 3 ? ` · ${pct(analyst1y, false)}/yr analyst est (${numAnalysts})` : ''}`,
    ...(terminalG ? [`Terminal growth: ${pct(terminalG, false)}`] : []),
    ``,
    `━━━ BUSINESS QUALITY ━━━`,
    ...(grossMargin != null ? [`Gross margin: ${pct(grossMargin, false)}`] : []),
    ...(netMargin != null ? [`Net margin:   ${pct(netMargin, false)}`] : []),
    ...(fcfMargin != null ? [`FCF margin:   ${pct(fcfMargin, false)}`] : []),
    ...(roic != null ? [`ROIC: ${pct(roic, false)}${roicSpread != null ? ` (${roicSpread > 0 ? '+' : ''}${pct(roicSpread, false)} vs WACC)` : ''}`] : []),
    ...(revenueM ? [`Revenue: ${fmt(revenueM * 1e6)}`] : []),
    ``,
    `━━━ ANALYST CONSENSUS ━━━`,
    ...(recLabel ? [`Wall St: ${recLabel}`] : []),
    ...(analystTarget ? [`Price target: ${fmt(analystTarget)}`] : []),
    ...(forwardPE ? [`Forward P/E:  ${forwardPE}×`] : []),
    ...(beatCount > 0 ? [`EPS beats: ${beatCount}/${surprises.length} last quarters`] : []),
    ...(stock1y != null && spy1y != null ? [`1Y return: ${pct(stock1y)} vs SPY ${pct(spy1y)}`] : []),
    ``,
    `Rating: ${grade} ${label} · ${sector}`,
    ``,
    `Full model → ${APP_URL}/stock/${ticker}`,
    `#DCF #Valuation #${ticker} #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}


// ─── Mode: etf_pulse ─────────────────────────────────────────────────────────
// ETF sector snapshot + VIX sentiment — works on weekends too.
// Uses Alpha Vantage GLOBAL_QUOTE (free, 25 req/day).
// Rotates between two templates:
//   A — Broad market (SPY/QQQ/IWM) + VIX fear gauge
//   B — Sector rotation (XLK/XLF/XLE/XLV best+worst)

async function fetchEtfQuote(symbol) {
  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${ALPHA_VANTAGE_KEY}`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) throw new Error(`Alpha Vantage GLOBAL_QUOTE ${symbol} returned ${res.status}`)
  const json = await res.json()
  if (json['Note'] || json['Information']) throw new Error(`Alpha Vantage rate limit`)
  const q = json['Global Quote']
  if (!q || !q['05. price']) throw new Error(`No data for ${symbol}`)
  return {
    symbol,
    price:    parseFloat(q['05. price']),
    change:   parseFloat(q['09. change']),
    changePct: parseFloat(q['10. change percent']),
    prevClose: parseFloat(q['08. previous close']),
    high:     parseFloat(q['03. high']),
    low:      parseFloat(q['04. low']),
    volume:   parseInt(q['06. volume']),
    date:     q['07. latest trading day'],
  }
}

// VIX sentiment label
function vixSentiment(vix) {
  if (vix >= 30) return { label: 'Extreme Fear 😱', note: 'Market is pricing in high uncertainty — historically a contrarian buy signal.' }
  if (vix >= 20) return { label: 'Fear 😰',         note: 'Elevated volatility — investors are nervous.' }
  if (vix >= 15) return { label: 'Neutral 😐',      note: 'Normal market conditions.' }
  return            { label: 'Greed 😎',             note: 'Low volatility — complacency is rising. Watch for reversals.' }
}

const ETF_NAMES = {
  SPY: 'S&P 500', QQQ: 'Nasdaq 100', IWM: 'Russell 2000',
  XLK: 'Tech', XLF: 'Financials', XLE: 'Energy',
  XLV: 'Healthcare', XLU: 'Utilities', XLI: 'Industrials',
}

async function runEtfPulse() {
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const useTemplate = weekOfYear % 2 === 0 ? 'A' : 'B'

  if (useTemplate === 'A') {
    // ── Template A: Broad market — use Yahoo v8 for live data ──
    const [spy, qqq, iwm] = await Promise.all([
      fetchYahooChart('SPY'),
      fetchYahooChart('QQQ'),
      fetchYahooChart('IWM'),
    ])
    // VIX still via Alpha Vantage (Yahoo doesn't support ^VIX well in v8)
    await new Promise(r => setTimeout(r, 1000))
    const vix = await fetchEtfQuote('VIX').catch(() => null)

    const fmtEtf = (q) => {
      const sign = q.changePct >= 0 ? '+' : ''
      const emoji = q.changePct >= 1 ? '🟢' : q.changePct <= -1 ? '🔴' : '🟡'
      return `${emoji} ${ETF_NAMES[q.symbol] ?? q.symbol}: ${sign}${q.changePct.toFixed(2)}% ($${q.price.toFixed(2)})`
    }

    const sentiment = vix ? vixSentiment(vix.price) : null
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    const lines = [
      `📊 Market Pulse — ${today}`,
      ``,
      fmtEtf(spy),
      fmtEtf(qqq),
      fmtEtf(iwm),
    ]
    if (sentiment && vix) {
      lines.push(``)
      lines.push(`VIX: ${vix.price.toFixed(1)} — ${sentiment.label}`)
      lines.push(sentiment.note)
    }
    lines.push(``)
    lines.push(`How does this affect your valuations? → ${APP_URL}`)
    lines.push(`#SPY #QQQ #MarketSentiment #Investing`)

    await post(lines.join('\n'))

  } else {
    // ── Template B: Sector rotation — use Yahoo v8 for live data ──
    const sectorSymbols = ['XLK', 'XLF', 'XLE', 'XLV', 'XLU', 'XLI']
    const sectors = (await Promise.all(sectorSymbols.map(s => fetchYahooChart(s).catch(() => null))))
      .filter(Boolean)
    sectors.sort((a, b) => b.changePct - a.changePct)

    if (sectors.length < 2) throw new Error('Not enough sector ETF data')

    const best  = sectors[0]
    const worst = sectors[sectors.length - 1]
    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const lines = [
      `🔄 Sector Rotation — ${today}`,
      ``,
      `🏆 Best: ${ETF_NAMES[best.symbol]} (${best.symbol}) ${best.changePct >= 0 ? '+' : ''}${best.changePct.toFixed(2)}%`,
      `📉 Worst: ${ETF_NAMES[worst.symbol]} (${worst.symbol}) ${worst.changePct >= 0 ? '+' : ''}${worst.changePct.toFixed(2)}%`,
      ``,
    ]

    // Add all sectors sorted
    for (const s of sectors) {
      const sign = s.changePct >= 0 ? '+' : ''
      const dot = s.changePct >= 0.5 ? '🟢' : s.changePct <= -0.5 ? '🔴' : '🟡'
      lines.push(`${dot} ${ETF_NAMES[s.symbol]}: ${sign}${s.changePct.toFixed(2)}%`)
    }

    lines.push(``)
    lines.push(`Money is rotating into ${ETF_NAMES[best.symbol].toLowerCase()} — see which stocks benefit → ${APP_URL}`)
    lines.push(`#SectorRotation #ETF #StockMarket`)

    await post(lines.join('\n'))
  }
}

// ─── Mode: sentiment ─────────────────────────────────────────────────────────
// Weekend-only: market context + valuation angle.
// Alternates between a "week in review" narrative and a forward-looking take.

const SENTIMENT_POSTS = [
  // Week-in-review
  (spy, vix) => [
    `🗓️ Weekend Market Recap`,
    ``,
    `S&P 500 (SPY): ${spy.changePct >= 0 ? '+' : ''}${spy.changePct.toFixed(2)}% this week`,
    `VIX: ${vix?.price.toFixed(1) ?? 'N/A'} — ${vix ? vixSentiment(vix.price).label : 'unknown'}`,
    ``,
    `━━━ WHAT IT MEANS ━━━`,
    spy.changePct > 3
      ? `Strong week. When prices move this fast, it's worth asking: did the fundamentals change, or did the market just get more optimistic?\n\nOptimism isn't a moat. Check whether your positions still trade below fair value after the move.`
      : spy.changePct < -3
      ? `Tough week for markets. Selloffs are uncomfortable — they're also often when the best buying opportunities appear.\n\nThe question isn't "should I sell?" It's "what has the business actually changed?" If the fundamentals are intact and the price fell, the margin of safety just improved.`
      : `Relatively quiet week. Low-volatility periods are the best time to do valuation work — before the market gets noisy again.`,
    ``,
    `━━━ THE DISCIPLINE ━━━`,
    `Weekly price movements are noise. Business fundamentals change quarterly.`,
    `The investors who build wealth over decades are the ones who stay focused on the second, not the first.`,
    ``,
    `Review your positions this weekend → ${APP_URL}`,
    `#Weekend #StockMarket #Investing #ValueInvesting`,
  ],
  // Forward-looking
  (spy, vix) => [
    `🔭 What to Watch This Week`,
    ``,
    `Current market conditions:`,
    `S&P 500 (SPY): ${spy.changePct >= 0 ? '+' : ''}${spy.changePct.toFixed(2)}% last session`,
    `VIX: ${vix?.price.toFixed(1) ?? 'N/A'} — ${vix ? vixSentiment(vix.price).label : ''}`,
    ``,
    `━━━ BEFORE MARKETS OPEN MONDAY ━━━`,
    ``,
    `1. Re-check your DCF assumptions`,
    `Did anything change last week that should update your growth estimate, WACC, or terminal value? If not, the model stands.`,
    ``,
    `2. Review your earnings calendar`,
    `Any positions reporting this week? The pre-earnings DCF tells you whether the stock needs to beat estimates just to be fairly valued — or whether it can miss and still be cheap.`,
    ``,
    `3. Check the macro calendar`,
    `Any CPI, NFP, or FOMC events? These move WACC and reprices every model in your watchlist.`,
    ``,
    `4. Run the model on one new stock`,
    `The best time to add to your watchlist is when nothing is happening. When the news hits, you'll already have the thesis.`,
    ``,
    `A process beats a prediction. Every time.`,
    ``,
    `Build your process → ${APP_URL}`,
    `#Investing #StockMarket #WeekendInvesting #DCF`,
  ],
]

async function runSentiment() {
  const spy = await fetchEtfQuote('SPY')
  await new Promise(r => setTimeout(r, 1500))
  const vix = await fetchEtfQuote('VIX').catch(() => null)

  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const template = SENTIMENT_POSTS[weekOfYear % SENTIMENT_POSTS.length]
  const lines = template(spy, vix)
  await post(lines.join('\n'))
}


// ─── Mode: morning_brief ──────────────────────────────────────────────────────
// Daily 8AM brief. Full macro picture: overnight markets, key events, real headlines.

async function runMorningBrief() {
  const todayUtc    = new Date().toISOString().split('T')[0]
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const dayName     = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })

  // VIX via Alpha Vantage (Yahoo doesn't support ^VIX well in v8)
  const vix = await fetchEtfQuote('VIX').catch(() => null)
  await new Promise(r => setTimeout(r, 1000))

  // All market data via Yahoo Finance v8 — live, not previous-day close
  const [tnx, dax, ftse, nikkei, oil, gold, dxy, sp500, nasdaq] = await Promise.all([
    fetchYahooChart('^TNX'),
    fetchYahooChart('^GDAXI'),
    fetchYahooChart('^FTSE'),
    fetchYahooChart('^N225'),
    fetchYahooChart('CL=F'),
    fetchYahooChart('GC=F'),
    fetchYahooChart('DX-Y.NYB'),
    fetchYahooChart('^GSPC'),
    fetchYahooChart('^IXIC'),
  ])

  // Earnings today + this week — large caps only (>$10B market cap)
  // Build date set for Mon–Fri of current week
  const now = new Date()
  const dow = now.getUTCDay() // 0=Sun, 1=Mon … 6=Sat
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  monday.setUTCHours(0, 0, 0, 0)
  const weekDates = new Set(
    Array.from({ length: 5 }, (_, i) => {
      const d = new Date(monday)
      d.setUTCDate(monday.getUTCDate() + i)
      return d.toISOString().split('T')[0]
    })
  )

  const earningsTickers = []  // reports today
  const earningsWeek    = []  // reports later this week (not today)

  for (let i = 0; i < SP500_SAMPLE.length; i += 8) {
    const batch = SP500_SAMPLE.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res2 = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res2?.ok) return null
      const json = await res2.json().catch(() => null)
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta?.earningsTimestampStart) return null
      if ((meta.marketCap ?? 0) < 10_000_000_000) return null
      const d = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      return weekDates.has(d) ? { symbol: t, marketCap: meta.marketCap, date: d } : null
    }))
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) {
        if (r.value.date === todayUtc) earningsTickers.push(r.value)
        else earningsWeek.push(r.value)
      }
    }
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  earningsTickers.sort((a, b) => b.marketCap - a.marketCap)
  earningsWeek.sort((a, b) => a.date.localeCompare(b.date) || b.marketCap - a.marketCap)

  // Macro events today + tomorrow
  const macroToday    = MACRO_CALENDAR.filter(e => e.date === todayUtc)
  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === tomorrowUtc)

  // ── Narrative ──────────────────────────────────────────────────────────────

  // Use sp500 (Yahoo v8, live) for opening tone — not stale Alpha Vantage SPY
  const spyMove  = sp500?.changePct ?? 0
  const vixLevel = vix?.price    ?? 0

  // Clean, professional market language — uses live S&P 500 data (^GSPC via Yahoo Finance)
  const openTone = spyMove > 1.5
    ? `US equities opening strongly. S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% — broad-based buying, risk appetite high.`
    : spyMove > 0.5
    ? `US equities in positive territory. S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% — moderate gains at the open.`
    : spyMove > 0.1
    ? `US equities marginally higher. S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% — no clear directional catalyst yet.`
    : spyMove > -0.1
    ? `US equities near flat. S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% — markets in consolidation mode.`
    : spyMove > -0.5
    ? `US equities under mild pressure. S&P 500 ${spyMove.toFixed(1)}% — sellers have a slight edge.`
    : spyMove > -1.5
    ? `US equities declining. S&P 500 ${spyMove.toFixed(1)}% — risk-off tone, defensives and bonds outperforming.`
    : `US equities under significant pressure. S&P 500 ${spyMove.toFixed(1)}% — risk-off conditions, elevated volatility.`
    ? `US futures under pressure (${spyMove.toFixed(1)}%). Risk-off tone early — defensives and bonds outperforming.`
    : `Significant pre-market weakness (${spyMove.toFixed(1)}%). Risk-off conditions — elevated volatility expected at the open.`

  const vixNote = vixLevel >= 30
    ? ` VIX at ${vixLevel.toFixed(0)} signals elevated fear and uncertainty in the options market.`
    : vixLevel >= 22
    ? ` VIX ${vixLevel.toFixed(0)} — options market pricing in above-average volatility.`
    : vixLevel >= 15
    ? ` VIX ${vixLevel.toFixed(0)} — volatility within normal range.`
    : vixLevel > 0
    ? ` VIX ${vixLevel.toFixed(0)} — low volatility environment.`
    : ''

  const yieldNote = tnx ? (() => {
    const y = tnx.price, chg = tnx.changePct
    const dir = chg > 0.5 ? 'rising' : chg < -0.5 ? 'declining' : 'holding steady'
    const context = y >= 4.5 ? `at ${y.toFixed(2)}% — above 4.5% is historically a headwind for growth equities and real estate`
      : y >= 4.0 ? `at ${y.toFixed(2)}% — mid-range; direction matters more than level here`
      : `at ${y.toFixed(2)}% — supportive for equity valuations near-term`
    return `10Y Treasury yield ${dir} ${context}.`
  })() : null

  const dxyNote = dxy ? (() => {
    const chg = dxy.changePct
    const dir = chg > 0.3 ? 'strengthening' : chg < -0.3 ? 'weakening' : 'flat'
    const impact = chg < -0.3 ? ' A weaker dollar is generally supportive for multinational earnings and commodities.'
      : chg > 0.3 ? ' Dollar strength typically pressures commodity prices and emerging market assets.' : ''
    return `US Dollar Index (DXY) ${dir} at ${dxy.price.toFixed(1)}.${impact}`
  })() : null

  const macroNarrative = macroToday.map(e => {
    if (e.type === 'FOMC') return `🏦 FOMC rate decision today. Consensus expects no change. The key signal will be the dot plot and Powell's language on rate cut timing — any shift directly affects WACC assumptions and equity valuations.`
    if (e.type === 'CPI')  return `📊 CPI inflation report today. A reading above expectations keeps rates elevated and compresses DCF fair values. A softer print opens the path to rate cuts and benefits growth stocks.`
    if (e.type === 'NFP')  return `💼 Nonfarm Payrolls report this morning. A strong number reduces the likelihood of near-term rate cuts. Watch the prior month revision — it often tells more than the headline.`
    return `📅 ${e.label} today.`
  })

  const earningsNarrative = earningsTickers.length > 0 ? (() => {
    const names = earningsTickers.slice(0, 4).map(t => `$${t.symbol}`)
    const str = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names.at(-1)
    return `📊 ${str} ${names.length === 1 ? 'reports' : 'report'} earnings today. The key question isn't just beat or miss — it's whether results justify the current valuation. Check the model before the number hits.`
  })() : null

  const tomorrowNote = macroTomorrow.length > 0
    ? `On the calendar tomorrow: ${macroTomorrow.map(e => e.label).join(' · ')}.`
    : null

  // ── Build post ─────────────────────────────────────────────────────────────

  // US indices line
  const usIndicesLine = [
    sp500  ? `S&P 500 ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null,
    nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null,
    vix    ? `VIX ${vix.price.toFixed(1)}` : null,
  ].filter(Boolean).join(' · ')

  const lines = [`🌅 Good Morning — ${dayName}`, ``, openTone + vixNote]
  if (usIndicesLine) lines.push(usIndicesLine)


  const overnightItems = [
    dax    ? `🇩🇪 DAX ${dax.changePct >= 0 ? '+' : ''}${dax.changePct.toFixed(2)}%` : null,
    ftse   ? `🇬🇧 FTSE ${ftse.changePct >= 0 ? '+' : ''}${ftse.changePct.toFixed(2)}%` : null,
    nikkei ? `🇯🇵 Nikkei ${nikkei.changePct >= 0 ? '+' : ''}${nikkei.changePct.toFixed(2)}%` : null,
  ].filter(Boolean)
  const commodityItems = [
    oil  ? `Oil (WTI) $${oil.price.toFixed(2)} ${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(2)}%` : null,
    gold ? `Gold $${gold.price.toFixed(0)} ${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(2)}%` : null,
  ].filter(Boolean)

  if (overnightItems.length > 0 || commodityItems.length > 0) {
    lines.push(``, `━━━ OVERNIGHT ━━━`)
    if (overnightItems.length > 0) lines.push(overnightItems.join('  '))
    if (commodityItems.length > 0) lines.push(commodityItems.join(' · '))
  }

  if (yieldNote || dxyNote) {
    lines.push(``)
    if (yieldNote) lines.push(yieldNote)
    if (dxyNote)   lines.push(dxyNote)
  }

  const hasEvents = macroNarrative.length > 0 || earningsNarrative
  if (hasEvents) {
    lines.push(``, `━━━ TODAY'S EVENTS ━━━`)
    lines.push(...macroNarrative)
    if (earningsNarrative) lines.push(earningsNarrative)
  }

  // Earnings this week (excluding today)
  if (earningsWeek.length > 0) {
    // Group by date
    const byDate = {}
    for (const e of earningsWeek.slice(0, 8)) {
      if (!byDate[e.date]) byDate[e.date] = []
      byDate[e.date].push(`$${e.symbol}`)
    }
    lines.push(``, `━━━ EARNINGS THIS WEEK ━━━`)
    for (const [date, tickers] of Object.entries(byDate)) {
      const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      lines.push(`${dayLabel}: ${tickers.join(' · ')}`)
    }
  }

  // News section removed — RSS feeds mix personal finance with market news,
  // no reliable filter without LLM. Data-only posts are more credible.

  if (tomorrowNote) lines.push(``, tomorrowNote)

  lines.push(``, `${APP_URL}`)
  lines.push(`#GoodMorning #StockMarket #Investing #WallStreet`)

  await post(lines.join('\n'))
}

// ─── Mode: midday_pulse ───────────────────────────────────────────────────────
// 1:00 PM ART — full mid-session snapshot: indices, sectors, macro, rotation narrative.

async function runMiddayPulse() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const todayUtc = new Date().toISOString().split('T')[0]

  // US indices
  const [sp500, nasdaq, dow] = await Promise.all([
    fetchYahooChart('^GSPC'), fetchYahooChart('^IXIC'), fetchYahooChart('^DJI'),
  ])
  await new Promise(r => setTimeout(r, 800))

  // Macro instruments
  const [tnx, oil, gold, dxy] = await Promise.all([
    fetchYahooChart('^TNX'), fetchYahooChart('CL=F'),
    fetchYahooChart('GC=F'), fetchYahooChart('DX-Y.NYB'),
  ])
  await new Promise(r => setTimeout(r, 800))

  // All 6 sector ETFs (sequential to avoid rate limits)
  const sectorSymbols = [
    { sym: 'XLK', name: 'Tech' }, { sym: 'XLE', name: 'Energy' },
    { sym: 'XLF', name: 'Financials' }, { sym: 'XLV', name: 'Healthcare' },
    { sym: 'XLU', name: 'Utilities' }, { sym: 'XLI', name: 'Industrials' },
  ]
  const sectorData = []
  for (const { sym, name } of sectorSymbols) {
    const d = await fetchYahooChart(sym).catch(() => null)
    if (d) sectorData.push({ ...d, name })
    await new Promise(r => setTimeout(r, 300))
  }
  sectorData.sort((a, b) => b.changePct - a.changePct)

  const vix = await fetchEtfQuote('VIX').catch(() => null)
  const macroToday = MACRO_CALENDAR.filter(e => e.date === todayUtc)

  // ── Narrative ──────────────────────────────────────────────────────────────
  const indexLine = [
    sp500  ? `S&P 500 ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null,
    nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null,
    dow    ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null,
  ].filter(Boolean).join(' · ')

  const best  = sectorData[0]
  const worst = sectorData[sectorData.length - 1]
  const rotationNote = best && worst ? (() => {
    const riskOn = ['Tech', 'Energy', 'Industrials'].includes(best.name)
    const defBad = ['Utilities', 'Healthcare'].includes(worst.name)
    if (riskOn && defBad) return `Money rotating INTO ${best.name.toLowerCase()}, OUT OF defensives. Classic risk-on signal.`
    if (!riskOn && defBad === false) return `Defensive rotation underway — ${best.name} leads while ${worst.name} lags. Market hedging.`
    return `${best.name} leads (+${best.changePct.toFixed(1)}%), ${worst.name} lags (${worst.changePct.toFixed(1)}%).`
  })() : null

  const yieldNote = tnx ? (() => {
    const y = tnx.price, chg = tnx.changePct
    const dir = chg > 0.5 ? 'ticking up' : chg < -0.5 ? 'easing' : 'steady'
    const context = y >= 4.5 ? 'headwind for growth stocks' : y >= 4.0 ? 'watch for breakout' : 'benign near-term'
    return `10Y yield ${y.toFixed(3)}% (${dir}) — ${context}.`
  })() : null

  const energySector = sectorData.find(s => s.name === 'Energy')
  const oilEnergyNote = oil && energySector
    ? (oil.changePct < -1.0 && energySector.changePct > 0.5
        ? `Note: oil down ${Math.abs(oil.changePct).toFixed(1)}% but energy stocks holding — sector has its own momentum.`
        : oil.changePct > 1.0 && energySector.changePct < 0
        ? `Energy stocks lagging despite oil strength — watch for catch-up or continued divergence.`
        : null)
    : null

  const macroNote = macroToday.map(e => {
    if (e.type === 'FOMC') return `🏦 Fed decision this afternoon — market on hold until Powell speaks.`
    if (e.type === 'CPI')  return `📊 CPI data is in — have you updated your WACC assumptions?`
    if (e.type === 'NFP')  return `💼 Jobs data out this morning — rate cut path updated.`
    return `📅 ${e.label} today.`
  })

  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const hooks = [
    "What's moving in your portfolio right now?",
    'Which sector are you watching this afternoon?',
    'Where are you seeing opportunity mid-session?',
    "What's your read on the rotation today?",
  ]

  const lines = [`📊 Midday Pulse — ${dayName}`, ``, indexLine]
  if (vix) lines.push(`VIX: ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label}`)

  if (sectorData.length > 0) {
    lines.push(``, `━━━ SECTORS ━━━`)
    sectorData.forEach(s => {
      const emoji = s.changePct >= 1 ? '🟢' : s.changePct <= -1 ? '🔴' : '🟡'
      lines.push(`${emoji} ${s.name}: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`)
    })
    if (rotationNote) lines.push(``, `→ ${rotationNote}`)
  }

  if (tnx || oil || gold || dxy) {
    lines.push(``, `━━━ MACRO ━━━`)
    if (yieldNote) lines.push(yieldNote)
    if (oil)  lines.push(`Oil (WTI): $${oil.price.toFixed(2)} ${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(2)}%${oil.changePct < -1 ? ' — energy under pressure' : oil.changePct > 1 ? ' — crude rallying' : ''}`)
    if (gold) lines.push(`Gold: $${gold.price.toFixed(0)} ${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(2)}%${gold.changePct > 0.5 ? ' — safe-haven demand intact' : ''}`)
    if (dxy)  lines.push(`Dollar (DXY): ${dxy.price.toFixed(1)} ${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct.toFixed(2)}%${dxy.changePct < -0.3 ? ' — weak dollar helps multinationals' : ''}`)
    if (oilEnergyNote) lines.push(oilEnergyNote)
  }

  if (macroNote.length > 0) lines.push(``, `━━━ EVENTS ━━━`, ...macroNote)

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `Run the valuations → ${APP_URL}`)
  lines.push(`#Midday #StockMarket #Investing #WallStreet`)

  await post(lines.join('\n'))
}

// ─── Mode: market_close ───────────────────────────────────────────────────────
// 7:00 PM ART — EOD recap: final close, sector scorecard, what drove it, what to watch.

async function runMarketClose() {
  const dayName     = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  // Final close data
  const [sp500, nasdaq, dow] = await Promise.all([
    fetchYahooChart('^GSPC'), fetchYahooChart('^IXIC'), fetchYahooChart('^DJI'),
  ])
  await new Promise(r => setTimeout(r, 800))

  const [tnx, oil, gold, dxy] = await Promise.all([
    fetchYahooChart('^TNX'), fetchYahooChart('CL=F'),
    fetchYahooChart('GC=F'), fetchYahooChart('DX-Y.NYB'),
  ])
  await new Promise(r => setTimeout(r, 800))

  // All sectors
  const sectorSymbols = [
    { sym: 'XLK', name: 'Tech' }, { sym: 'XLE', name: 'Energy' },
    { sym: 'XLF', name: 'Financials' }, { sym: 'XLV', name: 'Healthcare' },
    { sym: 'XLU', name: 'Utilities' }, { sym: 'XLI', name: 'Industrials' },
  ]
  const sectorData = []
  for (const { sym, name } of sectorSymbols) {
    const d = await fetchYahooChart(sym).catch(() => null)
    if (d) sectorData.push({ ...d, name })
    await new Promise(r => setTimeout(r, 300))
  }
  sectorData.sort((a, b) => b.changePct - a.changePct)

  const vix = await fetchEtfQuote('VIX').catch(() => null)
  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === tomorrowUtc)

  // ── Narrative ──────────────────────────────────────────────────────────────
  const best  = sectorData[0]
  const worst = sectorData[sectorData.length - 1]

  const whatDroveIt = (() => {
    const out = []
    if (best && Math.abs(best.changePct) > 0.5) {
      const riskOn = ['Tech', 'Energy', 'Industrials'].includes(best.name)
      out.push(riskOn
        ? `${best.name} led the session (+${best.changePct.toFixed(1)}%) — risk appetite was the theme.`
        : `${best.name} led (+${best.changePct.toFixed(1)}%) as investors rotated into defensives.`)
    }
    if (worst && Math.abs(worst.changePct) > 0.5) out.push(`${worst.name} was the laggard (${worst.changePct.toFixed(1)}%).`)
    if (tnx && Math.abs(tnx.changePct) > 0.5) out.push(tnx.changePct > 0
      ? `Rising yields (+${tnx.changePct.toFixed(1)}bps) added pressure on rate-sensitive assets.`
      : `Falling yields (${tnx.changePct.toFixed(1)}bps) provided relief for growth stocks.`)
    if (oil && Math.abs(oil.changePct) > 1.0) out.push(oil.changePct < 0
      ? `Oil fell ${Math.abs(oil.changePct).toFixed(1)}% — macro demand concerns in play.`
      : `Oil surged ${oil.changePct.toFixed(1)}% — energy complex outperformed.`)
    if (out.length === 0) out.push((sp500?.changePct ?? 0) > 0
      ? 'Buyers maintained control through the close.'
      : 'Sellers in control — broad-based pressure.')
    return out
  })()

  const watchTomorrow = (() => {
    const items = []
    macroTomorrow.forEach(e => {
      if (e.type === 'FOMC') items.push(`🏦 Fed rate decision — most important event for equity valuations`)
      if (e.type === 'CPI')  items.push(`📊 CPI inflation print — will move WACC assumptions across the board`)
      if (e.type === 'NFP')  items.push(`💼 Jobs report — key input for Fed rate path and discount rates`)
    })
    if (tnx && tnx.price >= 4.4) items.push(`10Y at ${tnx.price.toFixed(2)}% — if it breaks ${(Math.ceil(tnx.price * 10) / 10).toFixed(1)}%, growth stocks will feel it`)
    if (vix && vix.price >= 20)  items.push(`VIX ${vix.price.toFixed(1)} — elevated volatility, position sizing matters tomorrow`)
    if (items.length === 0) items.push(`Watch premarket futures for overnight direction`)
    return items
  })()

  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const hooks = [
    'What was your read on today?',
    'How did you play it today?',
    "Any setups you're watching for tomorrow?",
    'Biggest lesson from today\'s session?',
  ]

  const lines = [
    `🔔 Markets Closed — ${dayName}`, ``,
    `━━━ FINAL CLOSE ━━━`,
    sp500  ? `S&P 500: ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}% · ${sp500.price.toFixed(0)}` : null,
    nasdaq ? `Nasdaq:  ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}% · ${nasdaq.price.toFixed(0)}` : null,
    dow    ? `Dow:     ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}% · ${dow.price.toFixed(0)}` : null,
    vix    ? `VIX: ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label}` : null,
  ].filter(Boolean)

  if (sectorData.length > 0) {
    lines.push(``, `━━━ SECTOR SCORECARD ━━━`)
    sectorData.forEach((s, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : s.changePct < 0 ? '📉' : '  '
      lines.push(`${medal} ${s.name} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`)
    })
  }

  if (tnx || oil || gold || dxy) {
    lines.push(``, `━━━ COMMODITIES & RATES ━━━`)
    if (tnx)  lines.push(`10Y Yield: ${tnx.price.toFixed(3)}% (${tnx.changePct >= 0 ? '+' : ''}${tnx.changePct.toFixed(2)}%)`)
    if (oil)  lines.push(`Oil (WTI): $${oil.price.toFixed(2)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(2)}%)`)
    if (gold) lines.push(`Gold: $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(2)}%)`)
    if (dxy)  lines.push(`Dollar (DXY): ${dxy.price.toFixed(1)} (${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct.toFixed(2)}%)`)
  }

  lines.push(``, `━━━ WHAT DROVE IT ━━━`)
  whatDroveIt.forEach(l => lines.push(l))

  lines.push(``, `━━━ WHAT TO WATCH TOMORROW ━━━`)
  watchTomorrow.forEach(w => lines.push(`→ ${w}`))

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `Run the valuations → ${APP_URL}`)
  lines.push(`#MarketClose #Investing #WallStreet #StockMarket`)

  await post(lines.join('\n'))
}

const MODES = {
  earnings:       runEarnings,
  dcf:            runDcf,
  dcf_bear:       runDcfBear,
  news:           runNews,
  macro:          runMacro,
  feature:        runFeature,
  weekly_wrap:    runWeeklyWrap,
  question:       runQuestion,
  etf_pulse:      runEtfPulse,
  sentiment:      runSentiment,
  morning_brief:  runMorningBrief,
  midday_pulse:   runMiddayPulse,
  market_close:   runMarketClose,
}

if (!MODES[MODE]) {
  console.error(`Unknown MODE="${MODE}". Use: ${Object.keys(MODES).join(' | ')}`)
  process.exit(1)
}

try {
  await MODES[MODE]()
  console.log(`Done (mode=${MODE})`)
} catch (err) {
  console.error(`Failed (mode=${MODE}):`, err.message)
  process.exit(1)
}
