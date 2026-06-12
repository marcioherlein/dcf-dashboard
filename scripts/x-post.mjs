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
const ALPHA_VANTAGE_KEY  = process.env.ALPHA_VANTAGE_KEY  || 'demo'
const FINNHUB_KEY        = process.env.FINNHUB_KEY        || ''

// ─── Post Validator ───────────────────────────────────────────────────────────
// Runs before every post. Throws if the content fails quality checks.
// This is the last line of defense before anything hits Twitter.

function validatePost(text) {
  const issues = []

  // 1. NaN anywhere — means a numeric computation failed
  if (/\bNaN\b/.test(text)) {
    issues.push('Contains NaN — a numeric value failed to compute')
  }

  // 2. undefined or [object Object] leaked into output
  if (/\bundefined\b|\[object Object\]/.test(text)) {
    issues.push('Contains undefined or [object Object] — a variable was not resolved')
  }

  // 3. Suspiciously short post (less than 80 chars means something is missing)
  if (text.trim().length < 80) {
    issues.push(`Post is too short (${text.trim().length} chars) — likely missing sections`)
  }

  // 4. Price values must look like real numbers — not 0, not 999, not absurd
  const prices = [...text.matchAll(/\$(\d+(?:\.\d+)?)/g)].map(m => parseFloat(m[1]))
  for (const p of prices) {
    if (p === 0) issues.push(`Price value $0 found — data likely missing`)
    if (p > 100000) issues.push(`Price value $${p} looks unrealistic`)
  }

  // 5. Percentage values sanity — nothing above ±200% in a single move
  const pcts = [...text.matchAll(/([-+]?\d+\.?\d*)%/g)].map(m => parseFloat(m[1]))
  for (const p of pcts) {
    if (Math.abs(p) > 200) issues.push(`Percentage ${p}% looks unrealistic`)
  }

  // 6. Date "999" or single/double digit dates that look like index leakage
  if (/— \d{1,3}$/.test(text.split('\n')[0])) {
    issues.push('First line ends with a suspicious short number — possible index/date error')
  }

  // 7. Must contain at least one real data point (number)
  if (!/\d/.test(text)) {
    issues.push('Post contains no numbers — no data')
  }

  if (issues.length > 0) {
    const report = issues.map(i => `  ✗ ${i}`).join('\n')
    throw new Error(`POST REJECTED by validator:\n${report}\n\nContent:\n${text.slice(0, 300)}`)
  }

  console.log('✓ Validator passed')
}

// ─── Buffer API ───────────────────────────────────────────────────────────────

async function post(text) {
  // Validate before posting — throws if content is broken
  validatePost(text)

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
  const yesterday   = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]
  const tomorrow    = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]
  // Skip Saturday/Sunday for tomorrowStr — advance to Monday if needed
  const tomorrowDay = tomorrow.getUTCDay()
  if (tomorrowDay === 6) { tomorrow.setDate(tomorrow.getDate() + 2) }
  else if (tomorrowDay === 0) { tomorrow.setDate(tomorrow.getDate() + 1) }
  const nextTradingDayStr = tomorrow.toISOString().split('T')[0]

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
    // Check yesterday (AH reporters), today (pre-market or AH), and next trading day
    if (d === yesterdayStr || d === todayStr || d === nextTradingDayStr) { q.date = d; return true }
    return false
  })

  if (reporting.length === 0) {
    console.log(`No earnings found for ${yesterdayStr}/${todayStr}/${nextTradingDayStr} in sample — skipping post`)
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
  const featuredDate = featured.date ?? nextTradingDayStr
  // whenStr and verb are split to avoid "reports reported yesterday" grammar bug
  const whenStr = featuredDate === yesterdayStr ? 'yesterday (AH)'
    : featuredDate === todayStr ? 'today'
    : 'tomorrow'
  const whenVerb = featuredDate === yesterdayStr ? 'reported' : 'reports'

  const lines = [
    `📊 Earnings — $${ticker} ${whenVerb} ${whenStr}`,
    ``,
    dcfBlock || `Run the valuation → ${APP_URL}/stock/${ticker}`,
    ``,
    ...(others.length > 0 ? [`Also ${whenVerb} ${whenStr}: ${others.join(' · ')}`, ``] : []),
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

// Returns the two most recent data points for a series.
// Handles both Alpha Vantage formats:
//   Array: [{date, value}, ...] (CPI, NFP, Fed Funds Rate)
//   Object: {"2026-04-01": "333.020", ...} (legacy)
function latestTwo(data) {
  let pairs // [{date, value}]
  if (Array.isArray(data)) {
    pairs = data
      .filter(r => r.date && r.value !== undefined && r.value !== '.')
      .sort((a, b) => b.date.localeCompare(a.date))
  } else {
    pairs = Object.entries(data)
      .filter(([, v]) => v !== '.')
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, value]) => ({ date, value }))
  }
  if (pairs.length < 2) return null
  const latestVal   = parseFloat(pairs[0].value)
  const previousVal = parseFloat(pairs[1].value)
  if (!isFinite(latestVal) || !isFinite(previousVal)) return null
  return {
    latestDate:  pairs[0].date,
    latestVal,
    previousVal,
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

  // ── RECAP: event is today — fetch live data with retry ────────────────────
  // Alpha Vantage typically updates 2-4 hours after official release.
  // We retry up to 3 times with 10-minute waits to handle AV lag gracefully.
  if (todayEvent) {
    console.log(`Macro event today: ${todayEvent.label}`)
    let lines = []

    // Helper: fetch AV data with up to 3 retries (handles update lag)
    async function fetchWithRetry(fn, params, maxAttempts = 3) {
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const data = await fetchAlphaVantage(fn, params).catch(() => null)
        const d = latestTwo(data?.data ?? {})
        if (d && isFinite(d.latestVal) && isFinite(d.previousVal)) return d
        if (attempt < maxAttempts) {
          console.log(`AV data not ready yet (attempt ${attempt}/${maxAttempts}), waiting 60s...`)
          await new Promise(r => setTimeout(r, 60000))
        }
      }
      return null
    }

    if (todayEvent.type === 'CPI') {
      const d = await fetchWithRetry('CPI', { interval: 'monthly' })
      if (!d) throw new Error('No CPI data from Alpha Vantage after retries')
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
      const d = await fetchWithRetry('NONFARM_PAYROLL', {})
      if (!d) throw new Error('No NFP data from Alpha Vantage after retries')
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
      const d = await fetchWithRetry('FEDERAL_FUNDS_RATE', { interval: 'monthly' })
      if (!d) throw new Error('No Fed Funds data from Alpha Vantage after retries')
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
    // Mark as posted so economic_results mode doesn't double-post on the same event day
    await markPostedEvent(`macro:${todayEvent.type}:${todayUtc}`, 'macro', null, todayUtc, lines.join('\n'))
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
    'Interesting session. What are you watching?',
    'Rotation is clear today. How are you positioned?',
    'Mid-session check. Anything surprising you?',
    'This rotation has a story behind it. What\'s your read?',
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

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `Model any stock free → ${APP_URL}`)
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
    'Tough session or easy one — the model doesn\'t care. What mattered today?',
    'Markets closed. What stood out?',
    'One thing today confirmed or changed in your thesis?',
    'The close tells a story. What\'s yours?',
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

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `Model any stock free → ${APP_URL}`)
  lines.push(`#MarketClose #Investing #WallStreet #StockMarket`)

  await post(lines.join('\n'))
}

// ─── Mode: market_open ────────────────────────────────────────────────────────
// 10:30 AM ART — NYSE bell. Intraday opening data, NOT a repeat of morning_brief.

async function runMarketOpen() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const [sp500, nasdaq, dow] = await Promise.all([
    fetchYahooChart('^GSPC'),
    fetchYahooChart('^IXIC'),
    fetchYahooChart('^DJI'),
  ])
  await new Promise(r => setTimeout(r, 800))
  const vix = await fetchEtfQuote('VIX').catch(() => null)

  const spChg = sp500?.changePct ?? 0
  const openEmoji = spChg > 0.5 ? '🟢' : spChg < -0.5 ? '🔴' : '🟡'
  const openLabel = spChg > 1.0 ? 'strong open' : spChg > 0.2 ? 'positive open' : spChg > -0.2 ? 'flat open' : spChg > -1.0 ? 'soft open' : 'risk-off open'

  const lines = [
    `${openEmoji} NYSE Open — ${dayName}`,
    ``,
    `S&P 500: ${sp500?.changePct >= 0 ? '+' : ''}${sp500?.changePct.toFixed(2) ?? 'N/A'}% · ${sp500?.price.toFixed(0) ?? ''}`,
    `Nasdaq:  ${nasdaq?.changePct >= 0 ? '+' : ''}${nasdaq?.changePct.toFixed(2) ?? 'N/A'}%`,
    `Dow:     ${dow?.changePct >= 0 ? '+' : ''}${dow?.changePct.toFixed(2) ?? 'N/A'}%`,
    vix ? `VIX: ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label}` : null,
    ``,
    `${openLabel.charAt(0).toUpperCase() + openLabel.slice(1)}. Watch sector rotation in the first 30 minutes — that sets the tone for the session.`,
    ``,
    `${APP_URL}`,
    `#NYSE #StockMarket #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: sector_spotlight ───────────────────────────────────────────────────
// 11:30 AM ART — Best performing sector mid-morning with narrative.

const SECTOR_STOCKS = {
  XLK: ['AAPL','MSFT','NVDA','GOOGL','META'],
  XLE: ['XOM','CVX','COP','SLB','EOG'],
  XLF: ['JPM','BAC','GS','V','MA'],
  XLV: ['UNH','LLY','JNJ','ABBV','MRK'],
  XLU: ['NEE','DUK','SO','AEP','EXC'],
  XLI: ['HON','GE','CAT','RTX','UPS'],
}

const SECTOR_NARRATIVES = {
  XLK: 'Technology leading — growth expectations rising or rate pressure easing. Watch the mega-caps.',
  XLE: 'Energy outperforming — oil/gas prices or supply concerns moving the sector.',
  XLF: 'Financials in favor — typically signals rising rates or improving credit outlook.',
  XLV: 'Healthcare defensive bid — investors rotating to safety or specific drug catalysts.',
  XLU: 'Utilities leading — classic risk-off rotation. Market pricing in rate cuts or economic slowdown.',
  XLI: 'Industrials up — cyclical strength, infrastructure spending, or global demand optimism.',
}

async function runSectorSpotlight() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  const symbols = Object.keys(SECTOR_STOCKS)
  const sectorData = (await Promise.all(symbols.map(s => fetchYahooChart(s).catch(() => null)))).filter(Boolean)
  sectorData.sort((a, b) => b.changePct - a.changePct)

  if (sectorData.length === 0) throw new Error('No sector data available')

  const best = sectorData[0]
  const worst = sectorData[sectorData.length - 1]
  const sectorName = {
    XLK: 'Technology', XLE: 'Energy', XLF: 'Financials',
    XLV: 'Healthcare', XLU: 'Utilities', XLI: 'Industrials',
  }
  const narrative = SECTOR_NARRATIVES[best.symbol] ?? 'Sector rotation underway.'
  const stocks = SECTOR_STOCKS[best.symbol] ?? []

  const lines = [
    `📌 Sector Spotlight — ${dayName}`,
    ``,
    `🏆 Leading: ${sectorName[best.symbol] ?? best.symbol} ${best.changePct >= 0 ? '+' : ''}${best.changePct.toFixed(2)}%`,
    `📉 Lagging:  ${sectorName[worst.symbol] ?? worst.symbol} ${worst.changePct >= 0 ? '+' : ''}${worst.changePct.toFixed(2)}%`,
    ``,
    narrative,
    ``,
    `━━━ ALL SECTORS ━━━`,
    ...sectorData.map(s => {
      const e = s.changePct >= 1 ? '🟢' : s.changePct <= -1 ? '🔴' : '🟡'
      return `${e} ${sectorName[s.symbol] ?? s.symbol}: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
    }),
    ``,
    `Key names in ${sectorName[best.symbol]}: ${stocks.slice(0, 3).map(t => `$${t}`).join(' · ')}`,
    `Run their DCF models → ${APP_URL}`,
    `#${best.symbol} #SectorRotation #StockMarket`,
  ]

  await post(lines.join('\n'))
}

// ─── Mode: dcf2 ───────────────────────────────────────────────────────────────
// 1:30 PM ART — Second DCF of the day. Different pool, different offset, never repeats noon pick.

const ROTATION2 = {
  1: ['AAPL','MSFT','GOOGL','META','AMZN','NFLX','ADBE','CRM','NOW','INTU'],  // Monday: mega-cap tech
  2: ['NVDA','AMD','INTC','QCOM','AVGO','TXN','MU','AMAT','LRCX','ON'],       // Tuesday: semis
  3: ['JPM','BAC','GS','MS','WFC','V','MA','BLK','AXP','C'],                  // Wednesday: financials
  4: ['WMT','COST','HD','TGT','MCD','SBUX','NKE','CMG','YUM','BKNG'],        // Thursday: consumer
  5: ['XOM','CVX','NEE','DUK','COP','SLB','BA','CAT','HON','GE'],            // Friday: energy+industrials
}

async function runDcf2() {
  const day = new Date().getDay()
  const pool = TICKER ? [TICKER] : (ROTATION2[day] ?? ROTATION2[1])
  // Offset by 13 from dayOfYear so it never picks the same stock as runDcf
  const dayOfYear = Math.floor(Date.now() / 86400000) + 13

  let ticker = null
  let data = null
  for (let attempt = 0; attempt < Math.min(5, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt) % pool.length]
    try {
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result)) { ticker = candidate; data = result; break }
    } catch { /* try next */ }
  }
  if (!data) throw new Error('No valid DCF2 data found')

  const price = data.quote?.price
  const fair  = appFairValue(data)
  const upside = appUpside(data)
  const v = verdictLabel(upside)
  const cagr = data.cagr
  const wacc = data.wacc?.wacc
  const grossM = data.businessProfile?.grossMargin
  const netM   = data.businessProfile?.netMargin
  const roic   = data.scores?.roic?.roic
  const roicSpread = data.scores?.roic?.spread
  const analyst1y = data.cagrAnalysis?.analystEstimate1y
  const numAnalysts = data.cagrAnalysis?.numAnalysts ?? 0
  const rec = data.analystRecommendation ?? ''
  const recLabel = rec === 'strong_buy' ? 'Strong Buy' : rec === 'buy' ? 'Buy' : rec === 'hold' ? 'Hold' : rec === 'sell' ? 'Sell' : null
  const grade = data.ratings?.overall?.grade ?? ''
  const label = data.ratings?.overall?.label ?? ''
  const sector = data.quote?.sector ?? ''
  const bear = data.scenarios?.bear?.fairValue
  const bull = data.scenarios?.bull?.fairValue

  if (!price || !fair) throw new Error(`No price/fair value for ${ticker}`)

  const lines = [
    `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    `━━━ VALUATION ━━━`,
    `Current price:  ${fmt(price)}`,
    `Fair value est: ${fmt(fair)}`,
    `Difference:     ${pct(upside)} vs current price`,
    ...(bear && bull ? [`Scenario range: ${fmt(bear)} (bear) → ${fmt(bull)} (bull)`] : []),
    ``,
    `━━━ MODEL INPUTS ━━━`,
    `WACC: ${pct(wacc, false)} · CAGR: ${pct(cagr, false)}${analyst1y != null && numAnalysts >= 3 ? ` (analysts: ${pct(analyst1y, false)}, n=${numAnalysts})` : ''}`,
    ``,
    `━━━ QUALITY ━━━`,
    ...(grossM != null ? [`Gross margin: ${pct(grossM, false)}`] : []),
    ...(netM != null ? [`Net margin:   ${pct(netM, false)}`] : []),
    ...(roic != null ? [`ROIC: ${pct(roic, false)}${roicSpread != null ? ` (${roicSpread > 0 ? '+' : ''}${pct(roicSpread, false)} vs WACC)` : ''}`] : []),
    ``,
    ...(recLabel ? [`Wall St: ${recLabel}`] : []),
    `Rating: ${grade} ${label} · ${sector}`,
    ``,
    `$${ticker} ${v.long}.`,
    `${APP_URL}/stock/${ticker}`,
    `#DCF #${ticker} #Valuation #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: pre_close ──────────────────────────────────────────────────────────
// 3:30 PM ART — 30 min before US close. What's setting up, what to watch.

async function runPreClose() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [sp500, nasdaq, tnx] = await Promise.all([
    fetchYahooChart('^GSPC'),
    fetchYahooChart('^IXIC'),
    fetchYahooChart('^TNX'),
  ])
  await new Promise(r => setTimeout(r, 800))

  const sectorSymbols = ['XLK','XLE','XLF','XLV','XLU','XLI']
  const sectors = []
  for (const sym of sectorSymbols) {
    const d = await fetchYahooChart(sym).catch(() => null)
    if (d) sectors.push({ ...d, name: {XLK:'Tech',XLE:'Energy',XLF:'Financials',XLV:'Healthcare',XLU:'Utilities',XLI:'Industrials'}[sym] })
    await new Promise(r => setTimeout(r, 250))
  }
  sectors.sort((a, b) => b.changePct - a.changePct)

  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === tomorrowUtc)
  const spChg = sp500?.changePct ?? 0
  const lateSignal = Math.abs(spChg) > 0.5
    ? spChg > 0 ? 'Buyers holding control into the close.' : 'Sellers maintaining pressure into the close.'
    : 'Choppy session. Close will matter for tomorrow\'s open.'

  const lines = [
    `⏰ 30 Min to Close — ${dayName}`,
    ``,
    `S&P 500: ${sp500?.changePct >= 0 ? '+' : ''}${sp500?.changePct.toFixed(2) ?? 'N/A'}% · ${sp500?.price.toFixed(0) ?? ''}`,
    `Nasdaq:  ${nasdaq?.changePct >= 0 ? '+' : ''}${nasdaq?.changePct.toFixed(2) ?? 'N/A'}%`,
    tnx ? `10Y Yield: ${tnx.price.toFixed(3)}%` : null,
    ``,
    `━━━ SECTORS INTO CLOSE ━━━`,
    ...sectors.map(s => {
      const e = s.changePct >= 0.5 ? '🟢' : s.changePct <= -0.5 ? '🔴' : '🟡'
      return `${e} ${s.name}: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
    }),
    ``,
    lateSignal,
    ...(macroTomorrow.length > 0 ? [``, `Tomorrow: ${macroTomorrow.map(e => e.label).join(' · ')}`] : []),
    ``,
    `${APP_URL}`,
    `#StockMarket #MarketClose #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: after_hours ────────────────────────────────────────────────────────
// 6:00 PM ART — Post-close final numbers + any after-hours earnings.

async function runAfterHours() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const todayUtc = new Date().toISOString().split('T')[0]
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [sp500, nasdaq, dow] = await Promise.all([
    fetchYahooChart('^GSPC'), fetchYahooChart('^IXIC'), fetchYahooChart('^DJI'),
  ])

  // Scan for companies that report after hours today or pre-market tomorrow
  const ahTickers = []
  for (let i = 0; i < SP500_SAMPLE.length; i += 8) {
    const batch = SP500_SAMPLE.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }).catch(() => null)
      if (!res?.ok) return null
      const json = await res.json().catch(() => null)
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta) return null
      const cap = meta.marketCap ?? 0
      if (cap < 10_000_000_000) return null
      const ts = meta.earningsTimestampStart ?? meta.earningsTimestamp
      if (!ts) return null
      const d = new Date(ts * 1000).toISOString().split('T')[0]
      return (d === todayUtc || d === tomorrowUtc) ? { symbol: t, marketCap: cap, date: d } : null
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) ahTickers.push(r.value)
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  ahTickers.sort((a, b) => a.date.localeCompare(a.date) || b.marketCap - a.marketCap)

  const todayEarners = ahTickers.filter(t => t.date === todayUtc).slice(0, 4)
  const tomorrowEarners = ahTickers.filter(t => t.date === tomorrowUtc).slice(0, 4)

  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === tomorrowUtc)

  const spChg = sp500?.changePct ?? 0
  const sessionSummary = spChg > 1 ? 'Strong session.' : spChg > 0 ? 'Modest gains.' : spChg > -1 ? 'Mild losses.' : 'Significant selling pressure today.'

  const lines = [
    `🔔 After Hours — ${dayName}`,
    ``,
    `━━━ FINAL CLOSE ━━━`,
    `S&P 500: ${sp500?.changePct >= 0 ? '+' : ''}${sp500?.changePct.toFixed(2) ?? 'N/A'}% · ${sp500?.price.toFixed(0) ?? ''}`,
    `Nasdaq:  ${nasdaq?.changePct >= 0 ? '+' : ''}${nasdaq?.changePct.toFixed(2) ?? 'N/A'}%`,
    `Dow:     ${dow?.changePct >= 0 ? '+' : ''}${dow?.changePct.toFixed(2) ?? 'N/A'}%`,
    ``,
    sessionSummary,
  ]

  if (todayEarners.length > 0) {
    lines.push(``, `━━━ REPORTING AFTER HOURS ━━━`)
    todayEarners.forEach(t => lines.push(`📊 $${t.symbol} — run the model before results: ${APP_URL}/stock/${t.symbol}`))
  }

  if (tomorrowEarners.length > 0) {
    lines.push(``, `━━━ TOMORROW'S EARNINGS ━━━`)
    lines.push(tomorrowEarners.map(t => `$${t.symbol}`).join(' · '))
  }

  if (macroTomorrow.length > 0) {
    lines.push(``, `━━━ TOMORROW'S CALENDAR ━━━`)
    macroTomorrow.forEach(e => lines.push(`📅 ${e.label}`))
  }

  lines.push(``, `${APP_URL}`, `#AfterHours #StockMarket #Earnings #Investing`)

  await post(lines.join('\n'))
}

// ─── Mode: theory_overnight ───────────────────────────────────────────────────
// 10:00 PM ART — Rotates through all theory posts including 10 new ones.

const THEORY_POSTS = {
  // Existing 7 (0-6) accessed via FEATURE_POSTS — this extends the rotation
  7: {
    lines: [
      `📖 Graham's Margin of Safety — the most important concept in investing`,
      ``,
      `Benjamin Graham said: "The margin of safety is always dependent on the price paid."`,
      ``,
      `It's not about finding great companies. It's about finding great companies at prices that leave room for you to be wrong.`,
      ``,
      `━━━ HOW IT WORKS ━━━`,
      `You estimate intrinsic value: $100`,
      `You only buy at: $70 (30% margin of safety)`,
      ``,
      `If your estimate was wrong and the real value is $80 — you still made money.`,
      `If your estimate was right — you made 43%.`,
      ``,
      `The margin of safety is your protection against: bad luck, bad assumptions, and bad timing.`,
      ``,
      `A DCF model gives you an estimate. The margin of safety is what you demand below it.`,
      ``,
      `${APP_URL}`,
      `#GrahamInvesting #MarginOfSafety #ValueInvesting`,
    ],
  },
  8: {
    lines: [
      `📖 EV/EBITDA vs P/E — why enterprise value matters more than price`,
      ``,
      `P/E is the most quoted multiple in finance. It's also one of the most misleading.`,
      ``,
      `━━━ THE PROBLEM WITH P/E ━━━`,
      `P/E ignores capital structure. A company with $10B in debt looks "cheaper" on P/E than one with no debt — but the acquirer takes on that debt.`,
      ``,
      `━━━ WHY EV/EBITDA IS BETTER ━━━`,
      `Enterprise Value = Market Cap + Debt - Cash`,
      `It's what you'd actually pay to own the whole business.`,
      ``,
      `EBITDA strips out financing choices. It lets you compare a leveraged buyout candidate with a debt-free tech company on equal footing.`,
      ``,
      `━━━ WHEN EACH IS USEFUL ━━━`,
      `P/E: Quick screen, mature profitable businesses, same-sector comparison`,
      `EV/EBITDA: Cross-sector comparison, M&A analysis, capital-intensive businesses`,
      ``,
      `Neither replaces a DCF. Both are shortcuts.`,
      ``,
      `${APP_URL}`,
      `#Valuation #EV #Multiples #Investing`,
    ],
  },
  9: {
    lines: [
      `📖 Buffett's "Owner Earnings" — the metric Wall St ignores`,
      ``,
      `In his 1986 letter, Buffett defined owner earnings as:`,
      ``,
      `Net income + D&A + other non-cash charges − average annual capex − additional working capital needed`,
      ``,
      `In plain English: the cash a business actually generates for its owners — after investing what it needs to maintain its competitive position.`,
      ``,
      `━━━ WHY THIS MATTERS ━━━`,
      `Reported earnings can be manipulated. Revenue is even easier to game. Free cash flow gets distorted by working capital timing.`,
      ``,
      `Owner earnings strips all of that out. It asks: if I owned this entire business, how much cash would actually end up in my pocket each year?`,
      ``,
      `━━━ THE DCF CONNECTION ━━━`,
      `Owner earnings is essentially what we're discounting in a FCFF model. The best investors aren't doing anything exotic — they're just being rigorous about this one number.`,
      ``,
      `${APP_URL}`,
      `#Buffett #OwnerEarnings #ValueInvesting #DCF`,
    ],
  },
  10: {
    lines: [
      `📖 Mean reversion in valuations — why trees don't grow to the sky`,
      ``,
      `The most consistent pattern in 100 years of equity market data: valuation multiples mean revert.`,
      ``,
      `Companies that trade at 50× earnings today rarely still trade at 50× in 10 years. Companies at 8× rarely stay at 8×.`,
      ``,
      `━━━ THE EVIDENCE ━━━`,
      `Damodaran's data shows that high-growth companies (>25% revenue CAGR) sustain that growth for an average of 4-5 years before converging toward industry averages.`,
      ``,
      `This is why we apply a convergence discount in our models. It's not pessimism — it's empiricism.`,
      ``,
      `━━━ THE INVESTOR IMPLICATION ━━━`,
      `Paying for perpetual high growth is almost always a mistake.`,
      `The opportunity is when the market prices in mean reversion faster than it actually happens.`,
      ``,
      `That gap — between the market's implied CAGR and your estimate — is where the edge lives.`,
      ``,
      `${APP_URL}`,
      `#MeanReversion #Valuation #DCF #ValueInvesting`,
    ],
  },
  11: {
    lines: [
      `📖 Why ROIC > WACC is the only moat signal that compounds`,
      ``,
      `Everyone talks about moats: brand, network effects, switching costs, cost advantages.`,
      ``,
      `These are qualitative observations. ROIC vs WACC is the quantitative proof.`,
      ``,
      `━━━ THE MATH ━━━`,
      `If ROIC = 20% and WACC = 10%, every $1 reinvested creates $0.20 of economic profit above the cost of capital.`,
      ``,
      `Compound that for 20 years with a business that can redeploy most of its earnings at 20% ROIC — that's how generational wealth is created.`,
      ``,
      `━━━ WHY MOST COMPANIES DON'T HAVE IT ━━━`,
      `ROIC > WACC attracts competition. Competition erodes returns. Most businesses converge to ROIC ≈ WACC over time.`,
      ``,
      `The question isn't "does this company have a moat today?" — it's "how long can they sustain ROIC > WACC?"`,
      ``,
      `That duration is what separates a 10× stock from the rest.`,
      ``,
      `${APP_URL}`,
      `#ROIC #Moat #CompoundingReturns #ValueInvesting`,
    ],
  },
  12: {
    lines: [
      `📖 The quality vs value debate — and why it's a false choice`,
      ``,
      `Classic value investing: buy cheap things.`,
      `Quality investing: buy great things.`,
      ``,
      `The debate between them has consumed decades of academic research. Both sides have data. Both sides are right some of the time.`,
      ``,
      `━━━ WHAT THE DATA ACTUALLY SHOWS ━━━`,
      `Value (low P/B, low P/E) has historically outperformed — but much of that premium disappeared after it was discovered and arbitraged.`,
      ``,
      `Quality (high ROIC, strong balance sheet, stable earnings) has shown persistent outperformance, especially in the modern information economy.`,
      ``,
      `━━━ THE SYNTHESIS ━━━`,
      `The real edge is buying quality at a discount to intrinsic value.`,
      ``,
      `Not: buy anything cheap. Not: buy quality at any price.`,
      `But: buy businesses with durable competitive advantages at prices below what those advantages justify.`,
      ``,
      `That's what a DCF tries to systematize.`,
      ``,
      `${APP_URL}`,
      `#ValueInvesting #QualityInvesting #DCF #Damodaran`,
    ],
  },
  13: {
    lines: [
      `📖 The implied CAGR — the question that changes how you see every stock`,
      ``,
      `Most investors ask: "is this stock cheap?"`,
      ``,
      `A better question: "what growth rate is the current price assuming?"`,
      ``,
      `━━━ WHAT IS THE IMPLIED CAGR? ━━━`,
      `Reverse DCF: instead of estimating growth to get a fair value, you take the current price as given and solve for the growth rate that justifies it.`,
      ``,
      `━━━ WHY IT'S MORE USEFUL ━━━`,
      `"NVDA at $200 — is it cheap or expensive?"`,
      `→ Hard to say.`,
      ``,
      `"NVDA at $200 implies 47% revenue CAGR for 5 years — do you believe that?"`,
      `→ Now you're asking the right question.`,
      ``,
      `The implied CAGR converts a price judgment into a business belief. You don't need to know if the stock is cheap. You need to decide if you believe in the business trajectory the price is embedding.`,
      ``,
      `${APP_URL}`,
      `#ReverseDCF #ImpliedGrowth #Valuation #Investing`,
    ],
  },
  14: {
    lines: [
      `📖 Terminal value — the number that drives 60-80% of your DCF`,
      ``,
      `Here is an uncomfortable truth about DCF modeling:`,
      ``,
      `For most growth companies, 60-80% of the total valuation comes from the terminal value — the value assigned to all cash flows after your explicit forecast period.`,
      ``,
      `━━━ WHAT THIS MEANS ━━━`,
      `You spend hours modeling years 1-5 in detail. Then you apply a single terminal growth rate that determines most of the answer.`,
      ``,
      `A 0.5% difference in terminal growth rate can change fair value by 20-30% for a growth stock.`,
      ``,
      `━━━ HOW TO BE RIGOROUS ABOUT IT ━━━`,
      `1. Terminal growth should approximate long-run nominal GDP growth (2-3% for developed markets)`,
      `2. Never use a terminal growth rate above the growth rate of the economy the company operates in`,
      `3. Apply a convergence discount from high near-term growth down to terminal`,
      `4. Run sensitivity: what does fair value look like at 1.5%, 2.0%, 2.5%?`,
      ``,
      `The terminal value is where most valuation errors hide.`,
      ``,
      `${APP_URL}`,
      `#TerminalValue #DCF #Valuation #ValueInvesting`,
    ],
  },
  15: {
    lines: [
      `📖 Why the discount rate is the most important number in finance`,
      ``,
      `Every asset in finance is priced by discounting future cash flows. The discount rate is the rate you use.`,
      ``,
      `Change the discount rate — and every valuation on earth changes simultaneously.`,
      ``,
      `━━━ THIS IS WHY INTEREST RATES MATTER SO MUCH ━━━`,
      `When the Fed raises rates, it raises the risk-free rate. The risk-free rate is the floor of every discount rate. When the floor rises, every asset's present value falls.`,
      ``,
      `It's not sentiment. It's arithmetic.`,
      ``,
      `━━━ WACC IS YOUR PERSONAL DISCOUNT RATE ━━━`,
      `WACC (Weighted Average Cost of Capital) is the discount rate for a specific business — it reflects the riskiness of that business's cash flows, its capital structure, and the current interest rate environment.`,
      ``,
      `When you see "NVDA WACC: 13.8%" — that means you're demanding 13.8% annual return to justify the risk of owning NVDA's future cash flows. At current prices, does NVDA deliver that?`,
      ``,
      `That's the only question that matters.`,
      ``,
      `${APP_URL}`,
      `#WACC #DiscountRate #DCF #FedPolicy #Investing`,
    ],
  },
  16: {
    lines: [
      `📖 Intrinsic value vs price target — and why confusing them is dangerous`,
      ``,
      `Wall St analysts produce price targets. These are not valuations.`,
      ``,
      `━━━ WHAT A PRICE TARGET IS ━━━`,
      `A 12-month estimate of where an analyst thinks the stock will trade. It's based on relative multiples, recent momentum, sentiment, and what the analyst thinks other investors will pay.`,
      ``,
      `It's a prediction about human psychology.`,
      ``,
      `━━━ WHAT INTRINSIC VALUE IS ━━━`,
      `The present value of all future cash flows the business will generate. It's independent of what other investors think. It changes only when the business fundamentals change.`,
      ``,
      `It's a claim about economic reality.`,
      ``,
      `━━━ WHY THIS MATTERS ━━━`,
      `Price targets cluster near the current price (anchoring bias). They rise after stocks rise and fall after stocks fall. They are reactive, not predictive.`,
      ``,
      `Intrinsic value is the anchor you use when the market is being irrational — in either direction.`,
      ``,
      `${APP_URL}`,
      `#IntrinsicValue #PriceTarget #ValueInvesting #DCF`,
    ],
  },
}

async function runTheoryOvernight() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const hour = new Date().getUTCHours()
  // Rotate through all 17 theory posts (7 in FEATURE_POSTS + 10 new ones)
  const totalPosts = 17
  const seed = (dayOfYear * 3 + Math.floor(hour / 6)) % totalPosts

  // Posts 0-6 come from FEATURE_POSTS, posts 7-16 come from THEORY_POSTS
  let lines
  if (seed <= 6) {
    const day = seed // use seed as day index into FEATURE_POSTS
    const content = FEATURE_POSTS[day] ?? FEATURE_POSTS[1]
    lines = content.lines.map(l => l.replace(/\$\{APP_URL\}/g, APP_URL))
  } else {
    const content = THEORY_POSTS[seed] ?? THEORY_POSTS[7]
    lines = content.lines.map(l => l.replace(/\$\{APP_URL\}/g, APP_URL))
  }

  await post(lines.join('\n'))
}

// ─── Mode: earnings_results ───────────────────────────────────────────────────
// Fires at 11PM UTC (8PM ART) weekdays — 1.5h after typical AH earnings release.
// Scans for companies that reported yesterday or today, tweets EPS result + AH reaction.
// Uses Finnhub for EPS actual/estimate/revenue OR falls back to Yahoo earningsSurprises.

async function checkPostedEvent(eventKey) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return false
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    const { data } = await sb.from('posted_tweet_events').select('id').eq('event_key', eventKey).maybeSingle()
    return !!data
  } catch { return false }
}

async function markPostedEvent(eventKey, tweetType, ticker, eventDate, tweetText) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    await sb.from('posted_tweet_events').upsert({ event_key: eventKey, tweet_type: tweetType, ticker, event_date: eventDate, tweet_text: tweetText })
  } catch (e) { console.warn('Could not mark event as posted:', e.message) }
}

async function runEarningsResults() {
  const todayUtc     = new Date().toISOString().split('T')[0]
  const yesterday    = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayUtc = yesterday.toISOString().split('T')[0]

  console.log(`Scanning for earnings results on ${yesterdayUtc} or ${todayUtc}...`)

  // Try Finnhub first (has EPS actual + estimate + revenue + AH flag in one call)
  let finnhubResults = []
  if (FINNHUB_KEY) {
    try {
      const url = `https://finnhub.io/api/v1/calendar/earnings?from=${yesterdayUtc}&to=${todayUtc}&token=${FINNHUB_KEY}`
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null)
      if (res?.ok) {
        const json = await res.json().catch(() => null)
        finnhubResults = (json?.earningsCalendar ?? []).filter(e =>
          e.epsActual != null && e.epsEstimate != null && SP500_SAMPLE.includes(e.symbol)
        )
        console.log(`Finnhub: ${finnhubResults.length} results with actuals`)
      }
    } catch (e) { console.warn('Finnhub fetch failed:', e.message) }
  }

  // Build list of tickers to tweet about
  const candidates = finnhubResults.length > 0
    ? finnhubResults.map(e => ({
        ticker: e.symbol,
        epsActual: e.epsActual,
        epsEstimate: e.epsEstimate,
        revenueActual: e.revenueActual ?? null,
        revenueEstimate: e.revenueEstimate ?? null,
        hour: e.hour ?? 'unknown',   // bmo/amc/dmh
        date: e.date,
        source: 'finnhub',
      }))
    : [] // fallback: scan SP500_SAMPLE via Yahoo earningsSurprises (handled below)

  // Fallback: if no Finnhub key, scan SP500_SAMPLE via Yahoo
  if (candidates.length === 0) {
    for (let i = 0; i < SP500_SAMPLE.slice(0, 30).length; i += 5) {
      const batch = SP500_SAMPLE.slice(i, i + 5)
      const settled = await Promise.allSettled(batch.map(async t => {
        const data = await fetchValuation(t).catch(() => null)
        if (!data?.earningsSurprises?.length) return null
        const latest = data.earningsSurprises[0]
        if (!latest?.epsActual || !latest?.date) return null
        // Only include if the date matches yesterday or today
        if (latest.date !== yesterdayUtc && latest.date !== todayUtc) return null
        return {
          ticker: t,
          epsActual: latest.epsActual,
          epsEstimate: latest.epsEstimate,
          surprisePercent: latest.surprisePercent,
          date: latest.date,
          postMarketChangePct: data.quote?.postMarketChangePct ?? null,
          source: 'yahoo',
        }
      }))
      for (const r of settled) if (r.status === 'fulfilled' && r.value) candidates.push(r.value)
      await new Promise(r => setTimeout(r, 500))
    }
  }

  if (candidates.length === 0) {
    console.log('No earnings results found for yesterday/today — skipping')
    return
  }

  // Sort by market cap (largest first) — use SP500_SAMPLE order as proxy
  candidates.sort((a, b) => SP500_SAMPLE.indexOf(a.ticker) - SP500_SAMPLE.indexOf(b.ticker))

  let posted = 0
  for (const c of candidates.slice(0, 3)) {
    const eventKey = `earnings_results:${c.ticker}:${c.date}`
    if (await checkPostedEvent(eventKey)) {
      console.log(`Already posted ${eventKey} — skipping`)
      continue
    }

    // Fetch AH price if not from Finnhub
    let ahPct = null
    if (c.source === 'finnhub') {
      // Fetch from Yahoo for AH reaction
      const data = await fetchValuation(c.ticker).catch(() => null)
      ahPct = data?.quote?.postMarketChangePct ?? null
    } else {
      ahPct = c.postMarketChangePct
    }

    const surprisePct = c.surprisePercent ??
      (c.epsEstimate && c.epsActual ? ((c.epsActual - c.epsEstimate) / Math.abs(c.epsEstimate) * 100) : null)
    const beat = surprisePct != null ? (surprisePct >= 0 ? '✅ beat' : '❌ missed') : ''
    const v = verdictLabel(ahPct != null ? ahPct / 100 : 0)

    const lines = [
      `📊 $${c.ticker} earnings results`,
      ``,
      `EPS: $${c.epsActual?.toFixed(2)} vs $${c.epsEstimate?.toFixed(2)} est ${beat ? `(${beat}${surprisePct != null ? `, ${surprisePct > 0 ? '+' : ''}${surprisePct.toFixed(1)}%` : ''})` : ''}`,
      ...(c.revenueActual != null ? [`Revenue: ${fmt(c.revenueActual)}${c.revenueEstimate != null ? ` vs ${fmt(c.revenueEstimate)} est` : ''}`] : []),
      ...(ahPct != null ? [`After-hours: ${ahPct >= 0 ? '+' : ''}${ahPct.toFixed(2)}%`] : []),
      ``,
      `Full model → ${APP_URL}/stock/${c.ticker}`,
      `#${c.ticker} #Earnings #Investing`,
    ].filter(Boolean)

    const tweetText = lines.join('\n')
    await post(tweetText)
    await markPostedEvent(eventKey, 'earnings_results', c.ticker, c.date, tweetText)
    posted++
    if (posted < candidates.length) await new Promise(r => setTimeout(r, 10000))
  }

  if (posted === 0) console.log('All earnings results already posted — skipping')
}

// ─── Mode: economic_results ───────────────────────────────────────────────────
// Fires at 5PM UTC (2PM ART) on macro event days — gives AV 4.5h to update after release.
// Posts: actual value + change from prior + market reaction. No consensus (not available free).

async function runEconomicResults() {
  const todayUtc = new Date().toISOString().split('T')[0]
  const todayEvent = MACRO_CALENDAR.find(e => e.date === todayUtc)

  if (!todayEvent) {
    console.log(`No macro event today (${todayUtc}) — skipping economic_results`)
    return
  }

  const eventKey = `economic_results:${todayEvent.type}:${todayUtc}`
  // Check both own dedup AND whether macro mode already posted this event today
  const macroKey  = `macro:${todayEvent.type}:${todayUtc}`
  if (await checkPostedEvent(eventKey) || await checkPostedEvent(macroKey)) {
    console.log(`Already posted ${eventKey} or ${macroKey} — skipping`)
    return
  }

  console.log(`Fetching ${todayEvent.type} results for ${todayUtc}...`)

  // Fetch macro data with retry
  async function fetchWithRetry(fn, params, maxAttempts = 3) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const data = await fetchAlphaVantage(fn, params).catch(() => null)
      const d = latestTwo(data?.data ?? {})
      if (d && isFinite(d.latestVal) && isFinite(d.previousVal)) return d
      if (attempt < maxAttempts) {
        console.log(`AV not ready (attempt ${attempt}/${maxAttempts}), waiting 60s...`)
        await new Promise(r => setTimeout(r, 60000))
      }
    }
    return null
  }

  let d = null
  const avFnMap = { CPI: ['CPI', { interval: 'monthly' }], NFP: ['NONFARM_PAYROLL', {}], FOMC: ['FEDERAL_FUNDS_RATE', { interval: 'monthly' }] }
  const [fn, params] = avFnMap[todayEvent.type] ?? [null, null]
  if (fn) d = await fetchWithRetry(fn, params)

  if (!d) {
    console.log(`${todayEvent.type} data not available from AV after retries — skipping`)
    return
  }

  // Fetch market reaction
  const [sp500, tnx] = await Promise.all([
    fetchYahooChart('^GSPC').catch(() => null),
    fetchYahooChart('^TNX').catch(() => null),
  ])

  const chg = d.latestVal - d.previousVal
  const chgStr = `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}`

  const typeEmoji = { CPI: '📊', NFP: '💼', FOMC: '🏦' }
  const unitMap = { CPI: 'index', NFP: 'K jobs', FOMC: '%' }
  const unit = unitMap[todayEvent.type] ?? ''

  const lines = [
    `${typeEmoji[todayEvent.type] ?? '📅'} ${todayEvent.label} — Results`,
    ``,
    `Actual: ${d.latestVal.toFixed(todayEvent.type === 'FOMC' ? 2 : 1)}${unit ? ' ' + unit : ''}`,
    `Prior:  ${d.previousVal.toFixed(todayEvent.type === 'FOMC' ? 2 : 1)} (${chgStr} change)`,
    ``,
    `Market reaction:`,
    ...(sp500 ? [`S&P 500: ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%`] : []),
    ...(tnx ? [`10Y Yield: ${tnx.changePct >= 0 ? '+' : ''}${tnx.changePct.toFixed(2)}%`] : []),
    ``,
    `${APP_URL}`,
    `#${todayEvent.type} #Macro #Fed #Investing`,
  ].filter(Boolean)

  const tweetText = lines.join('\n')
  await post(tweetText)
  await markPostedEvent(eventKey, 'economic_results', null, todayUtc, tweetText)
}

const MODES = {
  earnings:          runEarnings,
  dcf:               runDcf,
  dcf2:              runDcf2,
  dcf_bear:          runDcfBear,
  news:              runNews,
  macro:             runMacro,
  feature:           runFeature,
  weekly_wrap:       runWeeklyWrap,
  question:          runQuestion,
  etf_pulse:         runEtfPulse,
  sentiment:         runSentiment,
  morning_brief:     runMorningBrief,
  midday_pulse:      runMiddayPulse,
  market_close:      runMarketClose,
  market_open:       runMarketOpen,
  sector_spotlight:  runSectorSpotlight,
  pre_close:         runPreClose,
  after_hours:       runAfterHours,
  theory_overnight:  runTheoryOvernight,
  earnings_results:  runEarningsResults,
  economic_results:  runEconomicResults,
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
