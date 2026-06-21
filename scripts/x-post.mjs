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
const LINKEDIN_CHANNEL_ID = process.env.LINKEDIN_CHANNEL_ID || ''

// ─── US Market Holidays ───────────────────────────────────────────────────────
// NYSE is closed on these dates. Intraday modes (market_open, midday_pulse,
// sector_spotlight, pre_close, market_close, after_hours, etf_pulse) should
// not post live market data. Instead they are redirected to holiday_deep_dive.
// Update annually from: https://www.nyse.com/markets/hours-calendars

const US_MARKET_HOLIDAYS = new Set([
  // 2026
  '2026-01-01', // New Year's Day
  '2026-01-19', // Martin Luther King Jr. Day
  '2026-02-16', // Presidents' Day
  '2026-04-03', // Good Friday
  '2026-05-25', // Memorial Day
  '2026-07-03', // Independence Day (observed — July 4 falls on Saturday)
  '2026-09-07', // Labor Day
  '2026-11-26', // Thanksgiving Day
  '2026-12-25', // Christmas Day
  // 2027 (plan ahead)
  '2027-01-01', // New Year's Day
  '2027-01-18', // MLK Day
  '2027-02-15', // Presidents' Day
  '2027-03-26', // Good Friday
  '2027-05-31', // Memorial Day
  '2027-07-05', // Independence Day (observed)
  '2027-09-06', // Labor Day
  '2027-11-25', // Thanksgiving
  '2027-12-24', // Christmas (observed)
])

function isMarketHoliday(dateStr) {
  return US_MARKET_HOLIDAYS.has(dateStr)
}

// Modes that require live intraday data — redirect to holiday content when closed
const INTRADAY_MODES = new Set([
  'market_open', 'sector_spotlight', 'midday_pulse', 'etf_pulse',
  'pre_close', 'market_close', 'after_hours', 'economic_results',
])

// Modes that are fine on holidays (use historical data or are purely educational)
// earnings, dcf, dcf2, dcf_bear, macro, feature, theory_overnight,
// question, weekly_wrap, sentiment, morning_brief, earnings_results
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

/**
 * Post a single tweet. Used for all non-thread posts.
 */
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

// ─── Module-level singletons & cache ─────────────────────────────────────────

// 1-hour valuation cache — avoids re-fetching the same ticker multiple times/day
const _valuationCache = new Map()
const _CACHE_TTL = 3600000

// Supabase singleton — created once, reused across all dedup calls
let _supabaseClient = null
async function _getSupabase() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null
  if (!_supabaseClient) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      _supabaseClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
    } catch { return null }
  }
  return _supabaseClient
}

// fetchWithRetry — module-level, shared by runMacro and runEconomicResults
async function fetchWithRetry(fn, params, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const data = await fetchAlphaVantage(fn, params).catch(() => null)
    const d = latestTwo(data?.data ?? {})
    if (d && isFinite(d.latestVal) && isFinite(d.previousVal)) return d
    if (attempt < maxAttempts) {
      console.log(`AV data not ready (attempt ${attempt}/${maxAttempts}), waiting 60s...`)
      await new Promise(r => setTimeout(r, 60000))
    }
  }
  return null
}

async function fetchValuation(ticker) {
  // Check cache first
  const cached = _valuationCache.get(ticker)
  if (cached && (Date.now() - cached.time) < _CACHE_TTL) {
    console.log(`Cache hit: ${ticker}`)
    return cached.data
  }
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
  const data = await res.json()
  _valuationCache.set(ticker, { data, time: Date.now() })
  return data
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
      const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
      const line1 = impliedG != null
        ? `At ${fmt(price)}, the market is pricing in ~${pct(impliedG, false)}/yr growth. Our model uses ${pct(cagr, false)} and lands at ${fmt(fair)} (${pct(upside)} from here).`
        : `Our model puts fair value at ${fmt(fair)} — ${pct(upside)} vs today's ${fmt(price)}.`
      const line2 = bear && bull
        ? `Downside case: ${fmt(bear)}. Bull case: ${fmt(bull)}.`
        : null
      const line3 = recLabel && roic != null
        ? `Wall St says ${recLabel}. ROIC is ${pct(roic, false)} vs ${pct(wacc, false)} WACC.`
        : recLabel ? `Wall St says ${recLabel}.` : null
      dcfBlock = [line1, line2, line3].filter(Boolean).join('\n')
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
    whenStr === 'tomorrow'
      ? `$${ticker} reports earnings tomorrow.`
      : whenStr === 'today'
      ? `$${ticker} is reporting today.`
      : `$${ticker} reported yesterday after hours.`,
    ``,
    dcfBlock || `See the model before the number → ${APP_URL}/stock/${ticker}`,
    ``,
    ...(others.length > 0 ? [`Also on deck: ${others.join(' · ')}`] : []),
    ``,
    `The number moves the price. The model tells you whether the business actually changed.`,
    `${APP_URL}/stock/${ticker}`,
    `$${ticker} #Earnings #DCF`,
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
  if (!data) { console.warn('No valid DCF data — skipping post'); return }

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

  // Build the key insight sentence — the most shareable part
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const impliedStr = impliedGrowth != null
    ? `At ${fmt(price)}, the market is pricing in ~${pct(impliedGrowth, false)}/yr revenue growth for the next 5 years.`
    : null

  const historicalStr = (data.cagrAnalysis?.historicalCagr3y != null)
    ? `Historical 3Y CAGR: ${pct(data.cagrAnalysis.historicalCagr3y, false)}.`
    : null

  const vsHistorical = (impliedGrowth != null && data.cagrAnalysis?.historicalCagr3y != null)
    ? (impliedGrowth < data.cagrAnalysis.historicalCagr3y * 0.85
        ? `That's below its historical pace — the market may be underestimating it.`
        : impliedGrowth > data.cagrAnalysis.historicalCagr3y * 1.15
        ? `That's well above its historical pace — high expectations baked in.`
        : `Roughly in line with historical pace.`)
    : null

  const lines = [
    impliedStr
      ? `What is $${ticker}'s stock price actually betting on?`
      : `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    ...(impliedStr ? [impliedStr] : []),
    ...(historicalStr ? [historicalStr] : []),
    ...(vsHistorical ? [vsHistorical] : []),
    ``,
    `Model: fair value ~${fmt(fair)} (${pct(upside)} vs current price)`,
    ...(bear && bull ? [`Range: ${fmt(bear)} bear → ${fmt(bull)} bull`] : []),
    ``,
    `Full analysis → ${APP_URL}/stock/${ticker}`,
    `$${ticker} #DCF #Investing`,
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
    ``,
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

    // Uses module-level fetchWithRetry (defined above fetchValuation)

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
        ``,
        chg > 0.3
          ? `Hotter than expected. The Fed has less room to cut. Higher rates for longer means higher WACC — and lower DCF fair values across the board, especially for long-duration growth stocks.`
          : chg < 0
          ? `Cooling inflation. Rate cut expectations rise. Lower discount rates mean higher fair values — especially for high-growth names that benefit most from lower WACC.`
          : `In-line print. Fed likely holds. Market prices remain anchored to current rate expectations.`,
        ``,
        ``,
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
        ``,
        d.latestVal > 250
          ? `Strong labor market. The Fed has no reason to cut. Higher-for-longer rates are the base case — which compresses DCF fair values on growth stocks and keeps value names relatively attractive.`
          : d.latestVal < 100
          ? `Weak jobs print. Rate cut expectations are building. Lower discount rates would lift DCF fair values, especially for long-duration tech and growth names.`
          : `Solid but cooling. The labor market is normalizing — which is exactly what the Fed wants to see before cutting. Neutral for valuations near-term.`,
        ``,
        `A healthy labor market is good for consumer stocks, banks, and cyclicals.`,
        `A weak print is good for rate-sensitive growth names.`,
        ``,
        `See which stocks benefit most → ${APP_URL}`,
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
        ``,
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
      ``,
      `1. Estimate how much free cash flow the business will generate each year`,
      `2. Apply a discount rate (WACC) to reflect risk and the time value of money`,
      `3. Add a terminal value for cash flows beyond the projection period`,
      `4. Subtract debt, add cash → divide by shares outstanding`,
      ``,
      ``,
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
      `Free DCF on any NYSE/NASDAQ stock → ${APP_URL}`,
      `#DCF #Investing #StockValuation #FundamentalAnalysis`,
    ],
  },
  2: { // Tuesday
    lines: [
      `📉 WACC — the number that determines what every stock is worth`,
      ``,
      `WACC (Weighted Average Cost of Capital) is the discount rate in a DCF model. It's arguably the most important single number in equity valuation — and most investors have never heard of it.`,
      ``,
      ``,
      `WACC is the minimum return a business must earn to justify its existence.`,
      ``,
      `If a business earns less than its WACC → it's destroying shareholder value`,
      `If a business earns more than its WACC → it's creating value`,
      ``,
      ``,
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
      ``,
      `• Risk-free rate (US 10-year Treasury yield)`,
      `• Beta (how volatile the stock is vs. the market)`,
      `• Equity risk premium`,
      `• Cost of debt × (1 - tax rate)`,
      `• Capital structure (debt/equity mix)`,
      ``,
      `WACC breakdown for any stock, free → ${APP_URL}`,
      `#WACC #DCF #Investing #InterestRates`,
    ],
  },
  3: { // Wednesday
    lines: [
      `📈 How to think about growth in a DCF model`,
      ``,
      `The growth assumption is the single biggest driver of fair value. Get it wrong and you can be off by 50%. Here's how to think about it rigorously.`,
      ``,
      ``,
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
      ``,
      `No company grows fast forever. Damodaran's research shows that high-growth companies systematically mean-revert toward industry and economy-wide growth rates.`,
      ``,
      `We apply a convergence discount: raw blended growth gets haircut toward a stable long-run rate. This prevents models from pricing in perpetual 40% growth.`,
      ``,
      ``,
      `A stock pricing in 30% perpetual growth is almost always a bad bet.`,
      `A stock pricing in 8% growth on a business delivering 20% might be a great one.`,
      ``,
      `Growth model for any stock → ${APP_URL}`,
      `#Valuation #DCF #GrowthInvesting #FinancialModeling`,
    ],
  },
  4: { // Thursday
    lines: [
      `🐻 Why one fair value number isn't enough — the case for scenario analysis`,
      ``,
      `Every DCF model is built on assumptions. Assumptions can be wrong. The solution isn't to find the "right" number — it's to understand the range.`,
      ``,
      ``,
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
      ``,
      `The width of the range tells you how uncertain the valuation is.`,
      ``,
      `Narrow range ($180–$220): high confidence, fairly predictable business`,
      `Wide range ($80–$300): highly uncertain, depends heavily on assumptions`,
      ``,
      `A stock where the bear case = current price is a stock with no margin of safety.`,
      `A stock where the bear case is 30% below and the bull is 100% above? That's an asymmetric bet.`,
      ``,
      `Bear/base/bull scenarios for any stock → ${APP_URL}`,
      `#DCF #ScenarioAnalysis #Investing #RiskManagement`,
    ],
  },
  5: { // Friday
    lines: [
      `🏆 ROIC vs WACC — the only moat metric that actually matters`,
      ``,
      `Warren Buffett talks about moats. Most investors think about brand or market share. The most rigorous way to measure a moat is ROIC vs WACC.`,
      ``,
      ``,
      `ROIC (Return on Invested Capital): how much profit the business generates per dollar of capital deployed`,
      `WACC (Weighted Average Cost of Capital): the minimum return the business needs to earn to justify that capital`,
      ``,
      ``,
      `ROIC > WACC = value creation. The business earns more than it costs to operate.`,
      `ROIC < WACC = value destruction. Even profitable companies can be destroying shareholder value.`,
      `ROIC = WACC = breakeven. Capital earns exactly what it costs.`,
      ``,
      ``,
      `Apple: ROIC ~50%+. Every dollar deployed returns 50 cents in profit.`,
      `Most retailers: ROIC near WACC. Thin margins, commodity economics.`,
      `Capital-heavy utilities: ROIC often below WACC before regulatory returns.`,
      ``,
      ``,
      `A business that consistently earns ROIC >> WACC deserves a premium multiple.`,
      `A business earning ROIC < WACC deserves to trade below book value.`,
      ``,
      `Most "expensive" stocks look cheap when you account for ROIC spread.`,
      `Many "cheap" stocks are value traps when ROIC is below WACC.`,
      ``,
      `ROIC vs WACC for any stock → ${APP_URL}`,
      `#ROIC #Moat #ValueInvesting #Buffett #DCF`,
    ],
  },
  6: { // Saturday
    lines: [
      `⚡ How insic works — a full walkthrough`,
      ``,
      `insic runs a multi-model DCF valuation on any NYSE or NASDAQ stock. Here's exactly what happens when you type a ticker:`,
      ``,
      ``,
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
      ``,
      `Each model is weighted by company type (growth, financial, dividend, etc.) and blended into a single consensus fair value.`,
      ``,
      `You also see: bear/base/bull scenarios, ROIC vs WACC, Piotroski score, Altman Z-score, Beneish M-score, analyst estimates, EPS surprises, financial statements.`,
      ``,
      ``,
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
      ``,
      `• Where an analyst thinks the stock will trade in 12 months`,
      `• Based on relative multiples, sentiment, and recent catalysts`,
      `• Revised frequently based on news flow`,
      `• Often anchors to recent price (behavioral bias)`,
      `• A prediction about market behavior`,
      ``,
      ``,
      `• What the underlying business is intrinsically worth today`,
      `• Based on discounted future cash flows, independent of market mood`,
      `• Grounded in business fundamentals: growth, margins, WACC`,
      `• Changes only when business fundamentals change`,
      `• A claim about business value, not price movement`,
      ``,
      ``,
      `A stock can be at its analyst price target and still be 40% overvalued by DCF.`,
      `A stock can be well below its price target but still expensive relative to intrinsic value.`,
      ``,
      `In bull markets, price targets chase the stock up — and investors mistake momentum for value.`,
      `In bear markets, price targets get cut and investors mistake fear for cheapness.`,
      ``,
      `DCF doesn't care what the market is doing. It asks one question: what will this business generate in cash, and what's that worth today?`,
      ``,
      `Worth asking before you invest → ${APP_URL}`,
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
  ['AAPL',  'MSFT',  'JPM'],   // Week 0: consumer tech + finance
  ['NVDA',  'GOOGL', 'JNJ'],   // Week 1: semis + search + pharma
  ['AMZN',  'META',  'V'],     // Week 2: e-commerce + social + payments
  ['TSLA',  'LLY',   'GS'],    // Week 3: EV + pharma + banking
  ['COST',  'AVGO',  'XOM'],   // Week 4: consumer + semis + energy
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
      data,
    }))
    .filter(s => s.price && s.fair)

  if (stocks.length === 0) throw new Error('No valuation data for weekly wrap')

  // Sort: most undervalued first, most overvalued last — shows the spread
  stocks.sort((a, b) => (b.upside ?? 0) - (a.upside ?? 0))

  const lines = []
  const verdicts = stocks.map(s => verdictLabel(s.upside))
  const allBullish = verdicts.every(v => (s => s.upside > 0.05)(stocks[verdicts.indexOf(v)]))

  lines.push(`3 stocks. Same DCF engine. The market gets at least one of them wrong.`)
  lines.push(``)

  for (const s of stocks) {
    const v = verdictLabel(s.upside)
    const impliedG = s.data?.valuationMethods?.models?.reverseDcf?.impliedCAGR
    const upsideStr = (s.upside * 100).toFixed(0)
    const direction = s.upside > 0.05 ? `model sees ${upsideStr}% upside` : s.upside < -0.05 ? `model sees ${Math.abs(upsideStr)}% downside` : `model says fair`
    lines.push(`${v.emoji} $${s.ticker} — ${fmt(s.price)} → ${fmt(s.fair)} · ${direction}`)
    if (impliedG != null) lines.push(`   Market pricing in ~${pct(impliedG, false)}/yr growth`)
    lines.push(``)
  }

  lines.push(`Which one is the market most wrong about?`)
  lines.push(``)
  lines.push(`${APP_URL}`)
  lines.push(`#DCF #Investing #ValueInvesting`)

  await post(lines.join('\n'))
}

// ─── Mode: question ───────────────────────────────────────────────────────────
// Sunday — rotating engagement question. Format: provocative framing +
// specific data point from insic + open question. Drives replies.

const QUESTIONS = [
  [
    `Hot take: most retail investors are paying for growth that will never materialise.`,
    ``,
    `When you buy $TSLA at 25× revenue, you're implicitly forecasting the company will need to deliver ~30%+ annual growth for the next decade just to justify today's price.`,
    ``,
    `Do you actually believe that? Or are you just buying because it went up?`,
    ``,
    `Check what any stock is implying → ${APP_URL}`,
    `#Investing #Tesla #TSLA #ValueInvesting`,
  ],
  [
    `Unpopular opinion: analyst price targets are mostly useless.`,
    ``,
    `They're based on peer multiples that are themselves overvalued. It's circular.`,
    ``,
    `A stock with a $300 target can still be worth $180 by an independent DCF — and both can be right in different frameworks.`,
    ``,
    `Which framework are you using?`,
    ``,
    `${APP_URL}`,
    `#Investing #Stocks #WallStreet`,
  ],
  [
    `How much growth is already priced into $NVDA?`,
    ``,
    `At today's price, the market is pricing in roughly 40%+ annual revenue growth for the next 5 years.`,
    ``,
    `That's not impossible — NVDA has exceeded that historically. But it's worth knowing that's what you're betting on.`,
    ``,
    `Do you agree with the market's bet?`,
    ``,
    `See the full reverse DCF → ${APP_URL}/stock/NVDA`,
    `$NVDA #Nvidia #DCF #Investing`,
  ],
  [
    `Most investors know what a stock costs. Very few know what it's worth.`,
    ``,
    `The difference is a DCF. You project cash flows, discount them back to today, and compare to price.`,
    ``,
    `If the price is below intrinsic value → margin of safety.`,
    `If it's above → you're paying for optimism.`,
    ``,
    `Which stocks in your portfolio have a real margin of safety right now?`,
    ``,
    `Free model for any stock → ${APP_URL}`,
    `#DCF #ValueInvesting #Investing`,
  ],
  [
    `Be honest: do you know what growth rate is already priced into the stocks you own?`,
    ``,
    `Most people don't. They buy because the chart looks good, or because someone said it's a great company.`,
    ``,
    `"Great company" and "great investment at this price" are two completely different things.`,
    ``,
    `Check the implied growth for any stock → ${APP_URL}`,
    `#Investing #ValueInvesting #StockMarket`,
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
  if (!data) { console.warn('No valid evening DCF data — skipping post'); return }

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

  // Build the implied growth narrative — the most shareable part
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const historicalCagr = data.cagrAnalysis?.historicalCagr3y

  // What is the market pricing in?
  const impliedStr = impliedGrowth != null
    ? `At ${fmt(price)}, the market is pricing in ~${pct(impliedGrowth, false)}/yr revenue growth over 5 years.`
    : null

  const historicalStr = historicalCagr != null
    ? `${ticker}'s actual 3-year revenue CAGR: ${pct(historicalCagr, false)}.`
    : null

  // The provocative take — the gap between implied and historical
  const take = (() => {
    if (impliedGrowth == null || historicalCagr == null) {
      return upside > 0.20
        ? `Our model says the market is underpricing this business by ${pct(upside)}.`
        : upside < -0.20
        ? `Our model says the market is overpricing this business by ${pct(Math.abs(upside))}.`
        : `Market price and our model are broadly aligned.`
    }
    const ratio = impliedGrowth / historicalCagr
    if (ratio > 1.3)  return `The market needs ${ticker} to significantly accelerate beyond its historical pace. That's a bet worth stress-testing.`
    if (ratio < 0.7)  return `The market is pricing in a slowdown well below ${ticker}'s historical pace. Is the pessimism justified?`
    return `The implied growth rate is roughly in line with history. The question is whether that pace is sustainable.`
  })()

  const comparedToAnalysts = recLabel && analyst1y != null && numAnalysts >= 5
    ? `Analysts (${numAnalysts}) expect ${pct(analyst1y, false)}/yr and rate it ${recLabel}.`
    : null

  const lines = [
    impliedStr ? `What is $${ticker}'s stock price actually betting on?` : `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    ...(impliedStr ? [impliedStr] : []),
    ...(historicalStr ? [historicalStr] : []),
    ...(take ? [take] : []),
    ``,
    ...(comparedToAnalysts ? [comparedToAnalysts] : []),
    `Our model: fair value ~${fmt(fair)} (${pct(upside)} vs current price)`,
    ...(bear && bull ? [`Scenario range: ${fmt(bear)} → ${fmt(bull)}`] : []),
    ``,
    `Full model → ${APP_URL}/stock/${ticker}`,
    `$${ticker} #DCF #Investing`,
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
    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const spyStr = spy ? `SPY ${spy.changePct >= 0 ? '+' : ''}${spy.changePct.toFixed(2)}%` : null
    const qqqStr = qqq ? `QQQ ${qqq.changePct >= 0 ? '+' : ''}${qqq.changePct.toFixed(2)}%` : null
    const iwmStr = iwm ? `IWM ${iwm.changePct >= 0 ? '+' : ''}${iwm.changePct.toFixed(2)}%` : null

    const lines = [
      today,
      ``,
      [spyStr, qqqStr, iwmStr].filter(Boolean).join(' · '),
    ]
    if (sentiment && vix) {
      lines.push(`VIX ${vix.price.toFixed(1)} — ${sentiment.label.toLowerCase()}`)
      lines.push(``, sentiment.note)
    }
    lines.push(``, `${APP_URL}`)
    lines.push(`#SPY #QQQ #Markets #Investing`)

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

    const gap = best.changePct - worst.changePct
    const rotationRead = gap > 2
      ? `${gap.toFixed(1)}pp spread — strong rotation signal.`
      : gap > 1 ? `Directional rotation, not extreme.`
      : `Tight day — no clear conviction in the market.`

    const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

    const lines = [
      `${ETF_NAMES[best.symbol]} leading, ${ETF_NAMES[worst.symbol]} lagging — ${today}`,
      ``,
    ]

    for (const s of sectors) {
      const e = s.changePct >= 0.5 ? '▲' : s.changePct <= -0.5 ? '▼' : '→'
      lines.push(`${e} ${ETF_NAMES[s.symbol]} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`)
    }

    lines.push(``, rotationRead)
    lines.push(``, `${APP_URL}`)
    lines.push(`#SectorRotation #${ETF_NAMES[best.symbol].replace(/\s/g,'')} #Markets`)

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
    ``,
    spy.changePct > 3
      ? `Strong week. When prices move this fast, it's worth asking: did the fundamentals change, or did the market just get more optimistic?\n\nOptimism isn't a moat. Check whether your positions still trade below fair value after the move.`
      : spy.changePct < -3
      ? `Tough week for markets. Selloffs are uncomfortable — they're also often when the best buying opportunities appear.\n\nThe question isn't "should I sell?" It's "what has the business actually changed?" If the fundamentals are intact and the price fell, the margin of safety just improved.`
      : `Relatively quiet week. Low-volatility periods are the best time to do valuation work — before the market gets noisy again.`,
    ``,
    ``,
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
    ``,
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
  const todayUtc = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getUTCDay() // 0=Sun, 6=Sat

  // Build next 5 trading days date list (Mon–Fri of coming week)
  const nextMonday = new Date()
  const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek
  nextMonday.setUTCDate(nextMonday.getUTCDate() + daysUntilMonday)
  nextMonday.setUTCHours(0, 0, 0, 0)
  const weekDates = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(nextMonday)
    d.setUTCDate(nextMonday.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })
  const weekDatesSet = new Set(weekDates)

  // 1. Fetch weekly S&P + VIX via Yahoo (live, not stale AV data)
  const [spyChart, vixAV] = await Promise.all([
    fetchYahooChart('SPY').catch(() => null),
    fetchEtfQuote('VIX').catch(() => null),
  ])

  // Weekly S&P change: use 5-day range from Yahoo for actual week performance
  const spyWeekly = await (async () => {
    try {
      const res = await fetch(
        'https://query1.finance.yahoo.com/v8/finance/chart/SPY?interval=1d&range=7d',
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const json = await res.json().catch(() => null)
      const closes = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null)
      if (!closes || closes.length < 2) return null
      const weekChg = ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100
      return { price: closes[closes.length - 1], weekChangePct: weekChg }
    } catch { return null }
  })()

  // 2. Scan for earnings NEXT week from SP500_SAMPLE
  const nextWeekEarners = []
  for (let i = 0; i < SP500_SAMPLE.length; i += 8) {
    const batch = SP500_SAMPLE.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const json = await res.json().catch(() => null)
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta?.earningsTimestampStart) return null
      if ((meta.marketCap ?? 0) < 10_000_000_000) return null
      const d = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      return weekDatesSet.has(d) ? { symbol: t, marketCap: meta.marketCap, date: d } : null
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) nextWeekEarners.push(r.value)
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  nextWeekEarners.sort((a, b) => a.date.localeCompare(b.date) || b.marketCap - a.marketCap)

  // Group by day
  const earnersByDay = {}
  for (const e of nextWeekEarners) {
    if (!earnersByDay[e.date]) earnersByDay[e.date] = []
    earnersByDay[e.date].push(e.symbol)
  }

  // 3. Macro events next week
  const macroNextWeek = MACRO_CALENDAR.filter(e => weekDatesSet.has(e.date))

  // ── Build post ─────────────────────────────────────────────────────────────
  const weekRange = `${new Date(weekDates[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(weekDates[4]).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const spyWeekStr = spyWeekly
    ? `S&P 500 this week: ${spyWeekly.weekChangePct >= 0 ? '+' : ''}${spyWeekly.weekChangePct.toFixed(2)}% (closed at ${spyWeekly.price.toFixed(0)})`
    : spyChart
    ? `S&P 500: ${spyChart.changePct >= 0 ? '+' : ''}${spyChart.changePct.toFixed(2)}% last session (${spyChart.price.toFixed(0)})`
    : null

  const vixStr = vixAV
    ? `VIX: ${vixAV.price.toFixed(1)} — ${vixSentiment(vixAV.price).label}`
    : null

  const weekContextLine = (() => {
    const chg = spyWeekly?.weekChangePct ?? spyChart?.changePct ?? 0
    if (chg > 2) return `Strong week for equities. The question heading into next week: was this fundamental or sentiment-driven? If sentiment, it can reverse. If fundamental — check whether fair values moved with it.`
    if (chg < -2) return `Tough week. Selloffs create noise. Before Monday, ask which positions are down on price only vs. down on deteriorating fundamentals. Those are very different situations.`
    return `Quiet week. Low-volatility periods are when serious investors do their best work — before the catalysts arrive.`
  })()

  const lines = [
    `🔭 What to Watch — Week of ${weekRange}`,
    ``,
    ...(spyWeekStr ? [spyWeekStr] : []),
    ...(vixStr ? [vixStr] : []),
    ``,
    weekContextLine,
  ]

  // Macro events
  if (macroNextWeek.length > 0) {
    lines.push(``, `Macro calendar:`)
    for (const e of macroNextWeek) {
      const dayLabel = new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      const impact = {
        FOMC: 'Rate decision → WACC shifts across every model in your watchlist.',
        CPI:  'Inflation print → hot = higher rates, cool = rate relief. Update WACC assumptions.',
        NFP:  'Jobs report → strong = Fed on hold, weak = cuts ahead. Discount rates at stake.',
      }
      lines.push(`📅 ${e.label} (${dayLabel}) — ${impact[e.type] ?? ''}`)
    }
  } else {
    lines.push(``, `No major macro events next week. Good week to focus on individual company models.`)
  }

  // Earnings next week
  if (Object.keys(earnersByDay).length > 0) {
    lines.push(``, `Earnings next week:`)
    for (const [date, tickers] of Object.entries(earnersByDay)) {
      const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      lines.push(`${dayLabel}: ${tickers.slice(0, 4).map(t => `$${t}`).join(' · ')}`)
    }
    lines.push(``, `Before earnings: run the model. The pre-earnings DCF tells you whether a stock needs to beat just to be fairly valued — or can miss and still be cheap.`)
  }

  lines.push(``, `${APP_URL}`, `#WeekAhead #Investing #DCF #StockMarket`)

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

  const lines = [`Good morning — ${dayName}`, ``, openTone + vixNote]
  if (usIndicesLine) lines.push(usIndicesLine)

  const overnightItems = [
    dax    ? `DAX ${dax.changePct >= 0 ? '+' : ''}${dax.changePct.toFixed(1)}%` : null,
    ftse   ? `FTSE ${ftse.changePct >= 0 ? '+' : ''}${ftse.changePct.toFixed(1)}%` : null,
    nikkei ? `Nikkei ${nikkei.changePct >= 0 ? '+' : ''}${nikkei.changePct.toFixed(1)}%` : null,
  ].filter(Boolean)
  const commodityItems = [
    oil  ? `Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)` : null,
    gold ? `Gold $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(1)}%)` : null,
  ].filter(Boolean)

  if (overnightItems.length > 0 || commodityItems.length > 0) {
    lines.push(``)
    if (overnightItems.length > 0) lines.push(overnightItems.join(' · '))
    if (commodityItems.length > 0) lines.push(commodityItems.join(' · '))
  }

  if (yieldNote || dxyNote) {
    lines.push(``)
    if (yieldNote) lines.push(yieldNote)
    if (dxyNote)   lines.push(dxyNote)
  }

  const hasEvents = macroNarrative.length > 0 || earningsNarrative
  if (hasEvents) {
    lines.push(``)
    lines.push(...macroNarrative)
    if (earningsNarrative) lines.push(earningsNarrative)
  }

  if (earningsWeek.length > 0) {
    const byDate = {}
    for (const e of earningsWeek.slice(0, 8)) {
      if (!byDate[e.date]) byDate[e.date] = []
      byDate[e.date].push(`$${e.symbol}`)
    }
    lines.push(``, `Earnings this week:`)
    for (const [date, tickers] of Object.entries(byDate)) {
      const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      lines.push(`${dayLabel}: ${tickers.join(' · ')}`)
    }
  }

  if (tomorrowNote) lines.push(``, tomorrowNote)

  lines.push(``, `Does your model still support your positions at today's prices?`)
  lines.push(`${APP_URL}`)
  lines.push(`#GoodMorning #Markets #Investing`)

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

  const lines = [`Midday — ${dayName}`, ``, indexLine]
  if (vix) lines.push(`VIX ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label.toLowerCase()}`)

  if (sectorData.length > 0) {
    lines.push(``)
    sectorData.forEach(s => {
      const e = s.changePct >= 1 ? '▲' : s.changePct <= -1 ? '▼' : '→'
      lines.push(`${e} ${s.name} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`)
    })
    if (rotationNote) lines.push(``, rotationNote)
  }

  if (tnx || oil || gold || dxy) {
    lines.push(``)
    if (yieldNote) lines.push(yieldNote)
    if (oil) {
      const oilNote = oil.changePct < -1 ? ` — energy under pressure` : oil.changePct > 1 ? ` — crude rallying` : ``
      lines.push(`Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)${oilNote}`)
    }
    if (gold) lines.push(`Gold $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(1)}%)`)
    if (oilEnergyNote) lines.push(oilEnergyNote)
  }

  if (macroNote.length > 0) lines.push(``, ...macroNote)

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `${APP_URL}`)
  lines.push(`#Markets #StockMarket #Investing`)

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
    `Did today's move change the fundamental case for any position, or just the price?`,
    `One stock moved big today. Did the business change, or just the market's mood?`,
    `Before tomorrow's open: did anything today shift your growth or WACC assumptions?`,
    `The market priced something in today. Was it already in your model?`,
  ]

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const indexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    `Markets closed — ${dayName}`,
    ``,
    indexLine,
    vix ? `VIX ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label.toLowerCase()}` : null,
    ``,
  ].filter(Boolean)

  if (sectorData.length > 0) {
    sectorData.forEach((s, i) => {
      const e = i === 0 ? '▲' : s.changePct < 0 ? '▼' : '→'
      lines.push(`${e} ${s.name} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`)
    })
    lines.push(``)
  }

  if (tnx || oil || gold || dxy) {
    const parts = []
    if (tnx)  parts.push(`10Y ${tnx.price.toFixed(2)}% (${tnx.changePct >= 0 ? '+' : ''}${tnx.changePct.toFixed(2)}%)`)
    if (oil)  parts.push(`Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)`)
    if (gold) parts.push(`Gold $${gold.price.toFixed(0)}`)
    if (dxy)  parts.push(`DXY ${dxy.price.toFixed(1)}`)
    lines.push(parts.join(' · '), ``)
  }

  whatDroveIt.forEach(l => lines.push(l))

  if (watchTomorrow.length > 0) {
    lines.push(``, `Tomorrow watch:`)
    watchTomorrow.forEach(w => lines.push(`→ ${w}`))
  }

  lines.push(``, hooks[weekOfYear % hooks.length], ``, `${APP_URL}`)
  lines.push(`#MarketClose #Investing #StockMarket`)

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

  // Process-oriented insight, not just price reporting
  const processNote = spChg > 1.0
    ? `Strong open. Something shifted sentiment overnight — before you act, ask what changed fundamentally.`
    : spChg > 0.2
    ? `Positive start. Does today's gap up change anything in your models, or is it just noise?`
    : spChg > -0.2
    ? `Flat open. Low conviction. Good day to update your assumptions, not chase moves.`
    : spChg > -1.0
    ? `Soft open. Risk-off tone. If defensives are leading, rate expectations may be quietly shifting.`
    : `Risk-off open. The model doesn't panic — do your positions still have a margin of safety at today's price?`

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const indexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    `${openEmoji} Opening bell — ${dayName}`,
    ``,
    indexLine,
    vix ? `VIX ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label.toLowerCase()}` : null,
    ``,
    processNote,
    ``,
    `${APP_URL}`,
    `#OpeningBell #Markets #Investing`,
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
  XLK: 'Tech leading. Watch what\'s driving it — if it\'s rate relief, WACC assumptions across growth stocks need updating. If it\'s earnings momentum, check whether the move is already baked into valuations.',
  XLE: 'Energy outperforming. Oil supply or geopolitical premium driving this? For integrated majors, check if current crude levels justify the multiple. FCF-heavy names in this environment have real margin of safety.',
  XLF: 'Financials leading — usually means the market is pricing in a steeper yield curve or improving credit conditions. Higher rates = better NIM for banks, but also higher discount rates for the rest of the market.',
  XLV: 'Healthcare bid. When defensives lead, the market is hedging. Either growth expectations are being trimmed, or macro risk is rising. Both affect WACC assumptions across your portfolio.',
  XLU: 'Utilities leading — classic rate-cut signal. The market is pricing in lower rates ahead. If you\'re holding growth stocks, lower WACC means higher fair values. Update your models.',
  XLI: 'Industrials up — cyclical leadership. Typically confirms GDP growth expectations are stable or rising. Good environment for capex-heavy names. Check ROIC vs WACC spread — it widens in expansion.',
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

  const gap = best.changePct - worst.changePct
  const gapStr = gap > 2
    ? `A ${gap.toFixed(1)}pp spread between best and worst — rotation is running hard today.`
    : gap > 1
    ? `${gap.toFixed(1)}pp gap between top and bottom — directional but not extreme.`
    : `Tight spread across sectors. Markets not showing strong conviction in either direction.`

  const lines = [
    `${sectorName[best.symbol] ?? best.symbol} leading, ${sectorName[worst.symbol] ?? worst.symbol} lagging — ${dayName}`,
    ``,
    narrative,
    ``,
    ...sectorData.map(s => {
      const e = s.changePct >= 1 ? '🟢' : s.changePct <= -1 ? '🔴' : '→'
      return `${e} ${sectorName[s.symbol] ?? s.symbol} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
    }),
    ``,
    gapStr,
    stocks.length > 0 ? `Names to watch in ${sectorName[best.symbol]}: ${stocks.slice(0, 3).map(t => `$${t}`).join(' · ')}` : null,
    ``,
    `${APP_URL}`,
    `#SectorRotation #${sectorName[best.symbol]?.replace(/\s/g,'') ?? best.symbol} #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: dcf2 ───────────────────────────────────────────────────────────────
// 1:30 PM ART — Second DCF of the day. Different pool, different offset, never repeats noon pick.

const ROTATION2 = {
  1: ['AAPL','MSFT','GOOGL','META','AMZN','NFLX','ADBE','CRM','NOW','INTU'],  // Monday: mega-cap tech (dcf=semis → different)
  2: ['NVDA','AMD','INTC','QCOM','AVGO','TXN','MU','AMAT','LRCX','ON'],       // Tuesday: semis (dcf=mega-cap tech → different)
  3: ['JNJ','LLY','ABBV','MRK','AMGN','BMY','PFE','UNH','CVS','CI'],          // Wednesday: healthcare (dcf=financials → different; bear=healthcare handled by offset)
  4: ['WMT','COST','HD','TGT','MCD','SBUX','NKE','CMG','YUM','BKNG'],        // Thursday: consumer (dcf=healthcare → different)
  5: ['AAPL','MSFT','GOOGL','META','AMZN','ADBE','CRM','ORCL','NOW','INTU'], // Friday: mega-cap tech (dcf=consumer/energy → different)
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
  if (!data) { console.warn('No valid DCF2 data — skipping post'); return }

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

  // dcf2 angle: stress-test framing — what has to go RIGHT for this price to make sense
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const historicalCagr = data.cagrAnalysis?.historicalCagr3y

  const stressTest = (() => {
    if (upside < -0.15 && impliedGrowth != null) {
      return `For $${ticker} at ${fmt(price)} to be fairly valued, you need to believe in ~${pct(impliedGrowth, false)}/yr revenue growth for 5 years.`
    }
    if (upside > 0.20 && impliedGrowth != null) {
      return `$${ticker} at ${fmt(price)} is only pricing in ~${pct(impliedGrowth, false)}/yr growth — well below what the business has historically delivered.`
    }
    if (bear && bull) {
      return `Under our bear case (${fmt(bear)}), the downside is ${pct((bear - price) / price)}. Under the bull (${fmt(bull)}), the upside is ${pct((bull - price) / price)}.`
    }
    return `Model fair value: ${fmt(fair)}. The market disagrees by ${pct(Math.abs(upside))}.`
  })()

  const qualityNote = (() => {
    if (roic != null && roicSpread != null && roicSpread > 0.08)
      return `ROIC ${pct(roic, false)} vs WACC — ${pct(roicSpread, false)} spread. This business consistently creates value above its cost of capital.`
    if (grossM != null && grossM > 0.60)
      return `Gross margin of ${pct(grossM, false)} suggests real pricing power.`
    if (netM != null && netM < 0 && upside > 0)
      return `Still loss-making (net margin ${pct(netM, false)}), but the model sees a path to profitability in the growth assumptions.`
    return null
  })()

  const lines = [
    stressTest,
    ``,
    ...(historicalCagr != null ? [`Historical 3Y revenue CAGR: ${pct(historicalCagr, false)}.`] : []),
    ...(qualityNote ? [qualityNote] : []),
    ``,
    ...(recLabel ? [`Wall St: ${recLabel}${analyst1y != null && numAnalysts >= 3 ? ` · ${numAnalysts} analysts expect ${pct(analyst1y, false)}/yr growth` : ''}`] : []),
    `Our model: ${fmt(fair)} (${pct(upside)})${bear && bull ? ` · Range ${fmt(bear)}–${fmt(bull)}` : ''}`,
    ``,
    `${APP_URL}/stock/${ticker}`,
    `$${ticker} #DCF #Investing`,
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

  const sp = sp500 ? `S&P ${sp500?.changePct >= 0 ? '+' : ''}${sp500?.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq?.changePct >= 0 ? '+' : ''}${nasdaq?.changePct.toFixed(2)}%` : null
  const indexLine2 = [sp, nq, tnx ? `10Y ${tnx.price.toFixed(2)}%` : null].filter(Boolean).join(' · ')

  const lines = [
    `30 minutes to close — ${dayName}`,
    ``,
    indexLine2,
    ``,
    ...sectors.map(s => {
      const e = s.changePct >= 0.5 ? '▲' : s.changePct <= -0.5 ? '▼' : '→'
      return `${e} ${s.name} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
    }),
    ``,
    lateSignal,
    ...(macroTomorrow.length > 0 ? [``, `Tomorrow: ${macroTomorrow.map(e => e.label).join(' · ')}`] : []),
    ``,
    `${APP_URL}`,
    `#Markets #PreClose #Investing`,
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
  const sessionSummary = spChg > 1 ? `Strong session — S&P closed up ${spChg.toFixed(2)}%.`
    : spChg > 0.1 ? `Markets edged higher — S&P +${spChg.toFixed(2)}% at the close.`
    : spChg > -0.1 ? `Flat day — markets went nowhere in particular.`
    : spChg > -1 ? `Modest selling today — S&P finished ${spChg.toFixed(2)}%.`
    : `Heavy selling session — S&P ${spChg.toFixed(2)}%.`

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const ahIndexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    `After hours — ${dayName}`,
    ``,
    ahIndexLine,
    ``,
    sessionSummary,
  ]

  if (todayEarners.length > 0) {
    lines.push(``, `Reporting tonight: ${todayEarners.map(t => `$${t.symbol}`).join(' · ')}`)
    lines.push(`Worth checking the model before the number drops.`)
  }

  if (tomorrowEarners.length > 0) {
    lines.push(``, `On deck tomorrow: ${tomorrowEarners.map(t => `$${t.symbol}`).join(' · ')}`)
  }

  if (macroTomorrow.length > 0) {
    lines.push(``, `Tomorrow: ${macroTomorrow.map(e => e.label).join(' · ')}`)
  }

  lines.push(``, `${APP_URL}`, `#AfterHours #Earnings #Markets #Investing`)

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
      ``,
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
      ``,
      `P/E ignores capital structure. A company with $10B in debt looks "cheaper" on P/E than one with no debt — but the acquirer takes on that debt.`,
      ``,
      ``,
      `Enterprise Value = Market Cap + Debt - Cash`,
      `It's what you'd actually pay to own the whole business.`,
      ``,
      `EBITDA strips out financing choices. It lets you compare a leveraged buyout candidate with a debt-free tech company on equal footing.`,
      ``,
      ``,
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
      ``,
      `Reported earnings can be manipulated. Revenue is even easier to game. Free cash flow gets distorted by working capital timing.`,
      ``,
      `Owner earnings strips all of that out. It asks: if I owned this entire business, how much cash would actually end up in my pocket each year?`,
      ``,
      ``,
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
      ``,
      `Damodaran's data shows that high-growth companies (>25% revenue CAGR) sustain that growth for an average of 4-5 years before converging toward industry averages.`,
      ``,
      `This is why we apply a convergence discount in our models. It's not pessimism — it's empiricism.`,
      ``,
      ``,
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
      ``,
      `If ROIC = 20% and WACC = 10%, every $1 reinvested creates $0.20 of economic profit above the cost of capital.`,
      ``,
      `Compound that for 20 years with a business that can redeploy most of its earnings at 20% ROIC — that's how generational wealth is created.`,
      ``,
      ``,
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
      ``,
      `Value (low P/B, low P/E) has historically outperformed — but much of that premium disappeared after it was discovered and arbitraged.`,
      ``,
      `Quality (high ROIC, strong balance sheet, stable earnings) has shown persistent outperformance, especially in the modern information economy.`,
      ``,
      ``,
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
      ``,
      `Reverse DCF: instead of estimating growth to get a fair value, you take the current price as given and solve for the growth rate that justifies it.`,
      ``,
      ``,
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
      ``,
      `You spend hours modeling years 1-5 in detail. Then you apply a single terminal growth rate that determines most of the answer.`,
      ``,
      `A 0.5% difference in terminal growth rate can change fair value by 20-30% for a growth stock.`,
      ``,
      ``,
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
      ``,
      `When the Fed raises rates, it raises the risk-free rate. The risk-free rate is the floor of every discount rate. When the floor rises, every asset's present value falls.`,
      ``,
      `It's not sentiment. It's arithmetic.`,
      ``,
      ``,
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
      ``,
      `A 12-month estimate of where an analyst thinks the stock will trade. It's based on relative multiples, recent momentum, sentiment, and what the analyst thinks other investors will pay.`,
      ``,
      `It's a prediction about human psychology.`,
      ``,
      ``,
      `The present value of all future cash flows the business will generate. It's independent of what other investors think. It changes only when the business fundamentals change.`,
      ``,
      `It's a claim about economic reality.`,
      ``,
      ``,
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
  const sb = await _getSupabase()
  if (!sb) return false
  try {
    const { data } = await sb.from('posted_tweet_events').select('id').eq('event_key', eventKey).maybeSingle()
    return !!data
  } catch { return false }
}

async function markPostedEvent(eventKey, tweetType, ticker, eventDate, tweetText) {
  const sb = await _getSupabase()
  if (!sb) return
  try {
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
    // Guard: skip if essential EPS data is missing — prevents $undefined in tweet
    if (!c.epsActual || !c.epsEstimate) {
      console.log(`${c.ticker}: missing EPS actual/estimate — skipping`)
      continue
    }

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
    const beatWord = surprisePct != null ? (surprisePct >= 0 ? 'beat' : 'missed') : ''
    const beatEmoji = surprisePct != null ? (surprisePct >= 0 ? '✅' : '❌') : ''

    // Valuation angle: was the beat/miss priced in?
    const ahContext = ahPct != null
      ? Math.abs(ahPct) < 1.0
        ? 'After-hours reaction was muted — the market may have expected this.'
        : ahPct > 0
        ? `After-hours: +${ahPct.toFixed(1)}% — market rewarded the ${beatWord}.`
        : `After-hours: ${ahPct.toFixed(1)}% — market punished despite the ${beatWord}.`
      : null

    const beat = surprisePct != null && surprisePct >= 0
    const miss = surprisePct != null && surprisePct < 0

    const openLine = beat
      ? `$${c.ticker} beat — EPS $${c.epsActual?.toFixed(2)} vs $${c.epsEstimate?.toFixed(2)} expected${surprisePct != null ? ` (+${surprisePct.toFixed(1)}%)` : ''}.`
      : miss
      ? `$${c.ticker} missed — EPS $${c.epsActual?.toFixed(2)} vs $${c.epsEstimate?.toFixed(2)} expected${surprisePct != null ? ` (${surprisePct.toFixed(1)}%)` : ''}.`
      : `$${c.ticker} reported — EPS $${c.epsActual?.toFixed(2)}.`

    const revLine = c.revenueActual != null
      ? `Revenue: ${fmt(c.revenueActual)}${c.revenueEstimate != null ? ` vs ${fmt(c.revenueEstimate)} est` : ''}.`
      : null

    const reactionLine = ahPct != null
      ? Math.abs(ahPct) < 1.0
        ? `After-hours move was muted — the market already had this priced in.`
        : ahPct > 0
        ? `After-hours ${beat ? 'rewarding the beat' : 'buying despite the miss'}: +${ahPct.toFixed(1)}%.`
        : `After-hours selling ${beat ? 'despite the beat' : 'on the miss'}: ${ahPct.toFixed(1)}%. Something in the detail spooked the market.`
      : null

    const lines = [
      openLine,
      revLine,
      reactionLine,
      ``,
      `Did the business actually change, or just the price? Fair value → ${APP_URL}/stock/${c.ticker}`,
      `#${c.ticker} #Earnings #DCF`,
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

  // Uses module-level fetchWithRetry

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
  const dp = todayEvent.type === 'FOMC' ? 2 : 1
  const unitMap = { CPI: '%', NFP: 'K jobs', FOMC: '%' }
  const unit = unitMap[todayEvent.type] ?? ''

  // Narrative reaction — not just the number
  const narrative = (() => {
    if (todayEvent.type === 'CPI') {
      const hot = chg > 0.1
      const cool = chg < -0.1
      const spReact = sp500 ? (sp500.changePct > 0.5 ? 'markets rallied' : sp500.changePct < -0.5 ? 'markets sold off' : 'markets shrugged') : null
      const tnxReact = tnx ? (tnx.changePct > 0.3 ? 'yields climbed' : tnx.changePct < -0.3 ? 'yields fell' : null) : null
      const reactions = [spReact, tnxReact].filter(Boolean)
      if (hot) return `A hotter print. That moves the Fed's calculus — and through it, every discount rate in your model.${reactions.length > 0 ? ` ${reactions.join(', ')}.` : ''}`
      if (cool) return `A cooler print. Rate cut expectations will adjust — watch what that does to growth stock valuations.${reactions.length > 0 ? ` ${reactions.join(', ')}.` : ''}`
      return `In line with trend. No major surprise — but the cumulative direction still matters for WACC.${reactions.length > 0 ? ` ${reactions.join(', ')}.` : ''}`
    }
    if (todayEvent.type === 'NFP') {
      const strong = chg > 50
      const weak = chg < -50
      if (strong) return `Strong jobs number. Fed stays cautious — rate cuts aren't imminent.${sp500 ? ` S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%.` : ''}`
      if (weak) return `Weak jobs number. Opens the door for rate cuts — good for growth valuations if inflation cooperates.${sp500 ? ` S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%.` : ''}`
      return `Jobs data came in broadly as expected.${sp500 ? ` S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%.` : ''}`
    }
    if (todayEvent.type === 'FOMC') {
      return `Fed held at ${d.latestVal.toFixed(2)}%.${chg !== 0 ? ` That's a ${Math.abs(chg * 100).toFixed(0)}bps ${chg > 0 ? 'hike' : 'cut'} from ${d.previousVal.toFixed(2)}%.` : ''} Every DCF model in the market just updated.${sp500 ? ` S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%.` : ''}`
    }
    return `${todayEvent.label} came in at ${d.latestVal.toFixed(dp)}${unit} vs ${d.previousVal.toFixed(dp)} prior.`
  })()

  const lines = [
    `${todayEvent.label}: ${d.latestVal.toFixed(dp)}${unit ? ` ${unit}` : ''} (prior: ${d.previousVal.toFixed(dp)}, ${chgStr} change)`,
    ``,
    narrative,
    ``,
    `${APP_URL}`,
    `#${todayEvent.type} #Macro #Investing`,
  ].filter(Boolean)

  const tweetText = lines.join('\n')
  await post(tweetText)
  await markPostedEvent(eventKey, 'economic_results', null, todayUtc, tweetText)
}

// ─── Mode: holiday_deep_dive ──────────────────────────────────────────────────
// Fires instead of intraday modes on US market holidays.
// Posts richer educational content grounded in academic research — no live data needed.

const HOLIDAY_POSTS = [
  {
    title: 'The Equity Risk Premium — the most debated number in finance',
    lines: [
      `📚 The Equity Risk Premium — the most debated number in finance`,
      ``,
      `The ERP is the extra return investors demand for owning equities over risk-free bonds.`,
      `It sits inside every WACC calculation. Change it by 1% and fair values shift 15-30%.`,
      ``,
      ``,
      `Dimson, Marsh & Staunton (2022): realized ERP ≈ 3.5-4.5% over 120 years across developed markets.`,
      `Damodaran (2026): implied ERP from S&P 500 prices ≈ 4.0-5.5% in current market.`,
      `Mehra & Prescott (1985): called it the "equity premium puzzle" — too high to explain with rational risk models alone.`,
      ``,
      ``,
      `ERP = 4%: Cost of equity for a beta-1 stock = Rf + 1.0 × 4% = e.g. 8.3%`,
      `ERP = 5%: Same stock = 9.3%`,
      `That 1% difference in ERP compresses a growth stock's fair value by ~20%.`,
      ``,
      `The ERP is not fixed. It expands in recessions, contracts in bull markets.`,
      `When you use insic, we use Damodaran's current implied ERP — updated monthly.`,
      ``,
      `${APP_URL}`,
      `#EquityRiskPremium #WACC #Damodaran #ValueInvesting`,
    ],
  },
  {
    title: 'The Fama-French factors — what actually drives stock returns',
    lines: [
      `📚 What actually drives stock returns? (The Fama-French answer)`,
      ``,
      `In 1993, Eugene Fama and Kenneth French published a model that changed how academia thinks about equity returns.`,
      ``,
      `They found three factors explain most of the variation in stock returns:`,
      ``,
      `1. Market risk (beta) — stocks beat bonds on average`,
      `2. Size — small caps beat large caps historically`,
      `3. Value — cheap stocks (low P/B) beat expensive ones`,
      ``,
      `In 2015, they extended to five factors, adding:`,
      `4. Profitability — high operating profit stocks beat low ones`,
      `5. Investment — companies that invest conservatively beat aggressive investors`,
      ``,
      ``,
      `Factor 3 (value) and 4 (profitability) map directly to DCF.`,
      `Low P/B = trading below book = margin of safety.`,
      `High profitability = high ROIC = durable cash flows.`,
      ``,
      `DCF formalizes what Fama-French quantified empirically.`,
      `You're not doing something different from academic finance — you're doing the same thing with more transparency.`,
      ``,
      `${APP_URL}`,
      `#FamaFrench #FactorInvesting #DCF #AcademicFinance`,
    ],
  },
  {
    title: 'Robert Shiller\'s CAPE ratio — the long-run valuation clock',
    lines: [
      `📚 Shiller's CAPE ratio — what 150 years of market data says about valuation`,
      ``,
      `Robert Shiller (Nobel 2013) developed the Cyclically Adjusted P/E (CAPE) ratio:`,
      `Current price ÷ 10-year average real earnings`,
      ``,
      `The idea: one year of earnings is noisy. Average over a decade and you get signal.`,
      ``,
      ``,
      `Historical average CAPE: ~16-17×`,
      `1929 peak: ~33× (preceded the crash)`,
      `2000 peak: ~44× (dot-com bubble)`,
      `2009 trough: ~13×`,
      `Current (2026): ~28-30×`,
      ``,
      `High CAPE predicts lower 10-year forward returns. Not useless — just long-horizon.`,
      ``,
      ``,
      `Jeremy Siegel: accounting changes make modern earnings look smaller → CAPE overstates valuation`,
      `Damodaran: CAPE says nothing about individual stocks, only the index`,
      ``,
      `The right use of CAPE: macro context, not stock-picking.`,
      `For individual companies, DCF with honest assumptions is more reliable.`,
      ``,
      `${APP_URL}`,
      `#CAPE #Shiller #MarketValuation #ValueInvesting`,
    ],
  },
  {
    title: 'The Modigliani-Miller theorem — why capital structure (mostly) doesn\'t matter',
    lines: [
      `📚 The Modigliani-Miller theorem — the most counterintuitive idea in corporate finance`,
      ``,
      `In 1958, Franco Modigliani and Merton Miller proved something shocking:`,
      `In a perfect market, a firm's value is independent of how it's financed.`,
      `Debt vs equity? Doesn't matter for total firm value.`,
      ``,
      ``,
      `If debt is cheap, it raises leverage risk. Higher risk = investors demand higher return on equity.`,
      `The cost savings from cheap debt are exactly offset by the higher cost of equity.`,
      `Total cost of capital stays the same.`,
      ``,
      ``,
      `Taxes break the perfect market assumption.`,
      `Interest is tax-deductible → debt has a tax shield → some debt adds value.`,
      `This is why WACC includes (1 - tax rate) on the cost of debt in our models.`,
      ``,
      ``,
      `Companies can't create value by shuffling debt and equity.`,
      `Value comes from operations: higher ROIC, better margins, faster growth.`,
      `Financing is just execution. The DCF is what captures the real value.`,
      ``,
      `${APP_URL}`,
      `#ModiglianiMiller #CorporateFinance #WACC #DCF`,
    ],
  },
  {
    title: 'Benjamin Graham\'s Mr. Market — the most useful mental model in investing',
    lines: [
      `📚 Mr. Market — Benjamin Graham's most useful mental model`,
      ``,
      `Graham introduced Mr. Market in The Intelligent Investor (1949).`,
      `The idea is simple but profound:`,
      ``,
      `Imagine you own a share of a business with a partner called Mr. Market.`,
      `Every day, he offers to buy your share or sell you his.`,
      `Some days he's euphoric and offers a high price.`,
      `Some days he's depressed and offers a low price.`,
      ``,
      `You are never obligated to trade with him.`,
      ``,
      ``,
      `Mr. Market is there to serve you, not to guide you.`,
      `His price is useful if you want to buy or sell.`,
      `His price is useless as a measure of business value.`,
      ``,
      `The investor's job: know what the business is worth independently.`,
      `Trade with Mr. Market only when his price is attractive relative to that value.`,
      ``,
      ``,
      `Without an independent valuation, you have no way to judge Mr. Market's offers.`,
      `With one, his volatility becomes opportunity rather than anxiety.`,
      ``,
      `That's exactly what insic is built for.`,
      ``,
      `${APP_URL}`,
      `#Graham #MrMarket #IntelligentInvestor #ValueInvesting`,
    ],
  },
  {
    title: 'The Kelly Criterion — how much to bet on your best ideas',
    lines: [
      `📚 The Kelly Criterion — the math of position sizing`,
      ``,
      `John Kelly (1956) derived a formula for optimal bet sizing:`,
      `f* = (bp - q) / b`,
      `Where: b = odds, p = probability of winning, q = probability of losing`,
      ``,
      `Applied to investing: f* = edge / odds`,
      ``,
      ``,
      `The bigger your edge (margin of safety), the more you should allocate.`,
      `The bigger the uncertainty, the less you should allocate.`,
      ``,
      `Kelly maximizes long-run wealth growth. In practice, investors use half-Kelly or quarter-Kelly to reduce volatility.`,
      ``,
      ``,
      `Kelly requires you to know your edge.`,
      `Edge = (intrinsic value - current price) / intrinsic value = margin of safety`,
      ``,
      `You can't apply Kelly without a valuation model.`,
      `This is why serious investors obsess over DCF — not because the model is perfect, but because sizing requires an estimate.`,
      ``,
      `A 30% margin of safety on a reliable business might warrant 5-10% of portfolio.`,
      `A 5% margin of safety on a speculative one: maybe 1-2%.`,
      ``,
      `${APP_URL}`,
      `#Kelly #PositionSizing #ValueInvesting #RiskManagement`,
    ],
  },
  {
    title: 'The concept of NOPAT and Economic Profit',
    lines: [
      `📚 NOPAT and Economic Profit — why accounting profit misleads investors`,
      ``,
      `Net income is what accountants report. It's not what investors should care about.`,
      ``,
      ``,
      `Net income ignores the cost of equity capital.`,
      `A company can report positive net income while destroying shareholder value.`,
      ``,
      ``,
      `Economic Profit = NOPAT - (Invested Capital × WACC)`,
      `NOPAT = Net Operating Profit After Tax (strips out financing effects)`,
      ``,
      `If Economic Profit > 0: company earns more than its cost of capital → creating value`,
      `If Economic Profit < 0: company earns less than its cost of capital → destroying value`,
      ``,
      `This is mathematically equivalent to ROIC > WACC.`,
      `And it's exactly what we compute in every insic valuation.`,
      ``,
      ``,
      `Companies with persistent positive Economic Profit deserve premium valuations.`,
      `Companies with negative Economic Profit — no matter how "profitable" — are traps.`,
      ``,
      `Net income is noise. Economic Profit is signal.`,
      ``,
      `${APP_URL}`,
      `#NOPAT #EconomicProfit #ROIC #Valuation`,
    ],
  },
]

async function runHolidayDeepDive() {
  const todayUtc  = new Date().toISOString().split('T')[0]
  const dayOfYear = Math.floor(Date.now() / 86400000)

  // Rotate through HOLIDAY_POSTS using day-of-year so it changes daily
  const post_content = HOLIDAY_POSTS[dayOfYear % HOLIDAY_POSTS.length]

  const lines = post_content.lines.map(l => l.replace(/\$\{APP_URL\}/g, APP_URL))
  await post(lines.join('\n'))
}

// ─── Mode: sector_scan ────────────────────────────────────────────────────────
// Weekend deep scan — picks a sector, fetches 8-10 stocks, builds a valuation
// league table with Fwd P/E, EV/EBITDA, Revenue Growth, ROIC spread, and our
// model verdict. Rotates through 6 sectors weekly.

const SECTOR_SCANS = [
  {
    name: 'AI & Cloud',
    emoji: '🤖',
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'META', 'AMZN', 'CRM', 'NOW', 'ORCL'],
    context: 'AI infrastructure spending is reshaping capex cycles. These are the platforms everything else runs on — but the valuations carry optimistic assumptions. Which ones still have margin of safety?',
    hashtags: '#AI #CloudStocks #TechValuation',
  },
  {
    name: 'Mega-Cap Tech',
    emoji: '💻',
    tickers: ['AAPL', 'MSFT', 'GOOGL', 'META', 'AMZN', 'NVDA', 'NFLX', 'ADBE'],
    context: 'The eight most watched stocks on earth. Each one prices in years of high growth. The question isn\'t whether they\'re great businesses — it\'s whether great is already in the price.',
    hashtags: '#BigTech #MegaCap #StockValuation',
  },
  {
    name: 'Big Pharma & Biotech',
    emoji: '💊',
    tickers: ['LLY', 'MRK', 'ABBV', 'BMY', 'AMGN', 'GILD', 'JNJ', 'PFE'],
    context: 'Pharma is a tale of two cities: blockbuster drugs at premium multiples vs. mature pipelines with discount valuations. FCF margins are high — the question is duration.',
    hashtags: '#Pharma #Biotech #Healthcare #DCF',
  },
  {
    name: 'Financials & Payments',
    emoji: '🏦',
    tickers: ['JPM', 'BAC', 'GS', 'V', 'MA', 'BLK', 'BX', 'AXP'],
    context: 'Banks benefit from higher rates (better NIM), but growth stocks in payments face different dynamics. ROIC spread vs WACC is the key metric here — not P/E.',
    hashtags: '#Financials #Banks #PaymentStocks',
  },
  {
    name: 'Consumer & Retail',
    emoji: '🛒',
    tickers: ['WMT', 'COST', 'AMZN', 'HD', 'MCD', 'SBUX', 'NKE', 'CMG'],
    context: 'Consumer names look "safe" but many carry premium multiples on stable earnings. The margin of safety question: how much growth is priced in at current levels?',
    hashtags: '#Consumer #Retail #ValueInvesting',
  },
  {
    name: 'Semiconductors',
    emoji: '🔬',
    tickers: ['NVDA', 'AMD', 'INTC', 'QCOM', 'AVGO', 'TXN', 'MU', 'AMAT'],
    context: 'The cyclicality of semis makes standard P/E useless — FCF margins and ROIC during upcycles are what matter. AI demand has structurally lifted some names. Which still have upside?',
    hashtags: '#Semiconductors #Chips #TechStocks',
  },
]

async function runSectorScan() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const weekOfYear = Math.floor(dayOfYear / 7)
  const scan = SECTOR_SCANS[weekOfYear % SECTOR_SCANS.length]
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  console.log(`Sector scan: ${scan.name} (${scan.tickers.length} tickers)`)

  // Fetch all in parallel — uses cache if same tickers appeared earlier today
  const results = await Promise.allSettled(scan.tickers.map(t => fetchValuation(t)))

  const rows = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status !== 'fulfilled') continue
    const d = r.value
    const ticker     = scan.tickers[i]
    const price      = d.quote?.price
    const fwdPE      = d.analystForwardPE
    const evEbitda   = d.businessProfile?.evToEbitda   ?? null
    const evRevenue  = d.businessProfile?.evToRevenue  ?? null
    const pfcf       = (() => {
      // P/FCF = price / (FCF per share). FCF per share = baseFCF * 1e6 / sharesOutstanding
      const fcfM   = d.baseFCF
      const shares = d.quote?.sharesOutstanding
      if (fcfM != null && shares && shares > 0) {
        const fcfPerShare = (fcfM * 1e6) / (shares * 1e6)
        return fcfPerShare > 0 ? price / fcfPerShare : null
      }
      return null
    })()
    const revGrowth  = d.cagrAnalysis?.analystEstimate1y ?? null
    const roicSpread = d.scores?.roic?.spread ?? null
    const fair       = appFairValue(d)
    const upside     = appUpside(d)

    // Skip rows missing the primary multiple — they break the table
    if (!price || !fwdPE) continue

    const v = verdictLabel(upside ?? 0)
    rows.push({ ticker, price, fwdPE, evEbitda, evRevenue, pfcf, revGrowth, roicSpread, fair, upside, v })
  }

  if (rows.length === 0) throw new Error('No sector scan data returned')

  rows.sort((a, b) => (a.fwdPE ?? 999) - (b.fwdPE ?? 999))

  const cheapest   = rows[0]
  const richest    = rows[rows.length - 1]
  const bestROIC   = [...rows].sort((a, b) => (b.roicSpread ?? -99) - (a.roicSpread ?? -99))[0]
  const bestGrowth = [...rows].filter(r => r.revGrowth != null).sort((a, b) => b.revGrowth - a.revGrowth)[0]
  const threshold  = Math.ceil(rows.length * 0.6)

  // Pick which secondary multiple has enough coverage to show
  const multipleKey   = rows.filter(r => r.evEbitda  != null).length >= threshold ? 'evEbitda'
                      : rows.filter(r => r.evRevenue != null).length >= threshold ? 'evRevenue'
                      : rows.filter(r => r.pfcf      != null).length >= threshold ? 'pfcf'
                      : null
  const multipleLabel = multipleKey === 'evEbitda'  ? 'EV/EBITDA'
                      : multipleKey === 'evRevenue' ? 'EV/Revenue'
                      : multipleKey === 'pfcf'      ? 'P/FCF' : null
  const multipleDesc  = multipleKey === 'evEbitda'  ? 'enterprise value relative to operating earnings'
                      : multipleKey === 'evRevenue' ? 'enterprise value relative to revenue — useful when EBITDA is thin or negative'
                      : multipleKey === 'pfcf'      ? 'price relative to free cash flow — cash earnings, not accounting earnings'
                      : null
  const showGrowth = rows.filter(r => r.revGrowth  != null).length >= threshold
  const showROIC   = rows.filter(r => r.roicSpread != null).length >= threshold

  // Build each row with full labels on every metric — no abbreviations, no header row needed
  const tableLines = rows.map(r => {
    const fwdPELine   = `  Fwd P/E: ${r.fwdPE.toFixed(0)}× — what you pay per dollar of next year's earnings`
    const multLine    = multipleKey && r[multipleKey] != null
      ? `  ${multipleLabel}: ${r[multipleKey].toFixed(1)}×`
      : null
    const growthLine  = showGrowth && r.revGrowth != null
      ? `  Revenue growth: +${(r.revGrowth * 100).toFixed(0)}%/yr (analyst consensus)`
      : null
    const roicLine    = showROIC && r.roicSpread != null
      ? `  ROIC vs WACC: ${r.roicSpread >= 0 ? '+' : ''}${(r.roicSpread * 100).toFixed(0)}pp — ${r.roicSpread > 0.05 ? 'creating value' : r.roicSpread > -0.02 ? 'roughly break-even on capital' : 'destroying value'}`
      : null
    const modelLine   = r.upside != null
      ? `  Model: ${r.v.short} · DCF upside ${r.upside >= 0 ? '+' : ''}${(r.upside * 100).toFixed(0)}% to fair value ${r.fair ? `(${fmt(r.fair)})` : ''}`
      : `  Model: ${r.v.short}`

    return [
      `${r.v.emoji} $${r.ticker}`,
      fwdPELine,
      multLine,
      growthLine,
      roicLine,
      modelLine,
      ``,
    ].filter(Boolean).join('\n')
  })

  // Legend only for metrics that actually appear
  const legendParts = [`Fwd P/E = forward price-to-earnings (lower = cheaper on near-term earnings)`]
  if (multipleLabel && multipleDesc) legendParts.push(`${multipleLabel} = ${multipleDesc}`)
  if (showGrowth)  legendParts.push(`Revenue growth = analyst consensus 1-year forward estimate`)
  if (showROIC)    legendParts.push(`ROIC vs WACC = return on invested capital minus cost of capital — positive means the business creates value`)

  // Narrative insight sentences
  const insights = [
    cheapest   ? `$${cheapest.ticker} trades at the lowest forward multiple in the group (${cheapest.fwdPE.toFixed(0)}×). ${cheapest.revGrowth != null ? `Analysts still expect +${(cheapest.revGrowth * 100).toFixed(0)}%/yr revenue growth — that combination is worth a closer look.` : ``}` : null,
    richest    ? `$${richest.ticker} is the most expensive on Fwd P/E at ${richest.fwdPE.toFixed(0)}×. ${richest.revGrowth != null ? `It needs to sustain +${(richest.revGrowth * 100).toFixed(0)}%/yr growth to justify that multiple — and then some.` : `A premium that demands delivery.`}` : null,
    bestROIC && bestROIC.roicSpread != null && bestROIC.roicSpread > 0.05
      ? `$${bestROIC.ticker} has the widest ROIC spread (+${(bestROIC.roicSpread * 100).toFixed(0)}pp above WACC). That's the kind of moat that compounds — every dollar reinvested earns well above the cost of capital.` : null,
    bestGrowth && bestGrowth.revGrowth != null
      ? `$${bestGrowth.ticker} is the fastest grower analysts expect in this group at +${(bestGrowth.revGrowth * 100).toFixed(0)}%/yr. ${bestGrowth.roicSpread != null && bestGrowth.roicSpread > 0 ? `Paired with a positive ROIC spread, that growth is actually worth something.` : `Whether the multiple prices that in already is the question.`}` : null,
  ].filter(Boolean)

  const lines = [
    `${scan.emoji} ${scan.name} — Valuation Scan · ${dateStr}`,
    ``,
    scan.context,
    ``,
    ...tableLines,
    `─`,
    `How to read this:`,
    ...legendParts.map(l => `· ${l}`),
    ``,
    ...insights,
    ``,
    `Full interactive models → ${APP_URL}`,
    scan.hashtags,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: insider_buy ────────────────────────────────────────────────────────
// Parses SEC EDGAR Form 4 RSS feed for open-market CEO/CFO purchases > $50K.
// No API key required — SEC EDGAR is fully public.
// Link goes in the reply (not the tweet body) to maximise algorithmic reach.

async function runInsiderBuy() {
  // SEC EDGAR Form 4 RSS — real-time filings, no auth needed
  const res = await fetch(
    'https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=4&dateb=&owner=include&count=40&search_text=&output=atom',
    { headers: { 'User-Agent': 'insic.app contact@insic.app' }, signal: AbortSignal.timeout(10000) }
  ).catch(() => null)
  if (!res?.ok) { console.warn('SEC EDGAR unavailable'); return }

  const xml = await res.text()
  // Parse entries from Atom feed
  const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(m => m[1])

  const buys = []
  for (const entry of entries) {
    const title   = (entry.match(/<title>([^<]+)<\/title>/)?.[1] ?? '').trim()
    const updated = entry.match(/<updated>([^<]+)<\/updated>/)?.[1] ?? ''
    const link    = entry.match(/<link[^>]+href="([^"]+)"/)?.[1] ?? ''

    // Form 4 title format: "4 - LASTNAME FIRSTNAME (ticker) (Issuer)"
    // We only want entries that mention a known ticker from our universe
    const tickerMatch = title.match(/\(([A-Z]{1,5})\)/)
    if (!tickerMatch) continue
    const ticker = tickerMatch[1]
    if (!SP500_SAMPLE.includes(ticker)) continue

    // Skip filings older than 2 days
    const age = Date.now() - new Date(updated).getTime()
    if (age > 172_800_000) continue

    buys.push({ ticker, title, link, updated })
    if (buys.length >= 3) break
  }

  if (buys.length === 0) { console.warn('No relevant Form 4 filings found'); return }

  // For the best candidate, fetch our valuation + check the transaction details
  // We pick the one with the largest ticker prominence (first hit is most recent)
  const best = buys[0]
  const ticker = best.ticker

  let data = null
  try { data = await fetchValuation(ticker) } catch { /* proceed without valuation */ }

  const price  = data?.quote?.price
  const fair   = data ? appFairValue(data) : null
  const upside = data ? appUpside(data) : null

  // Parse executive name from title
  const namePart = best.title.replace(/^4 - /, '').replace(/\s*\([^)]+\).*$/, '').trim()

  const modelLine = price && fair && upside != null
    ? `Our model puts fair value at ${fmt(fair)} — ${upside >= 0 ? `${(upside * 100).toFixed(0)}% above` : `${Math.abs(upside * 100).toFixed(0)}% below`} today's price.`
    : null

  const lines = [
    `${namePart} just filed a Form 4 on $${ticker}.`,
    ``,
    `Executives buy with their own money for one reason.`,
    modelLine,
    ``,
    best.link,
    `$${ticker} #InsiderBuying #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: 52w_low ────────────────────────────────────────────────────────────
// Finds S&P 500 stocks near 52-week lows that still have positive FCF.
// Near-52W-low + positive FCF separates potential value from value traps.
// Data: Yahoo Finance quote API (free, no auth).

async function run52wLow() {
  // Screen from our SP500 sample — fetch quotes in batches
  const SCREEN_POOL = SP500_SAMPLE.slice(0, 60)  // 60 tickers, fast enough
  const results = []

  await Promise.all(SCREEN_POOL.map(async ticker => {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1y`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      )
      if (!res.ok) return
      const json = await res.json()
      const q = json?.chart?.result?.[0]
      const closes = q?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      if (closes.length < 50) return

      const current = closes[closes.length - 1]
      const high52  = Math.max(...closes.slice(-252))
      const low52   = Math.min(...closes.slice(-252))
      const range   = high52 - low52
      if (range <= 0) return

      // Position in 52W range: 0 = at low, 1 = at high
      const positionInRange = (current - low52) / range

      // Only interested in bottom 15% of 52W range
      if (positionInRange > 0.15) return

      results.push({ ticker, current, high52, low52, positionInRange })
    } catch { /* skip */ }
  }))

  if (results.length === 0) { console.warn('No 52W low candidates found'); return }

  // Sort by closest to 52W low
  results.sort((a, b) => a.positionInRange - b.positionInRange)

  // Try to find one with positive FCF from our valuation data
  let chosen = null
  let data = null
  for (const candidate of results.slice(0, 5)) {
    try {
      const d = await fetchValuation(candidate.ticker)
      const fcfMargin = d?.businessProfile?.fcfMargin
      // Require positive FCF margin to avoid value traps
      if (fcfMargin != null && fcfMargin > 0.05) {
        chosen = candidate
        data = d
        break
      }
    } catch { /* try next */ }
  }

  // Fallback to first result even without valuation
  if (!chosen) chosen = results[0]

  const ticker  = chosen.ticker
  const pctFrom52Low = ((chosen.current - chosen.low52) / chosen.low52 * 100).toFixed(1)
  const pctFrom52High = ((chosen.current - chosen.high52) / chosen.high52 * 100).toFixed(1)

  const fair   = data ? appFairValue(data) : null
  const upside = data ? appUpside(data) : null
  const fcfM   = data?.businessProfile?.fcfMargin
  const roic   = data?.scores?.roic?.roic

  const lines = [
    `$${ticker} is trading ${pctFrom52Low}% above its 52-week low. ${pctFrom52High}% off the peak.`,
    ``,
    fair && upside != null
      ? `Our model sees ${upside >= 0 ? `${(upside * 100).toFixed(0)}% upside` : `${Math.abs(upside * 100).toFixed(0)}% downside`} to fair value of ${fmt(fair)}.`
      : null,
    fcfM != null ? `FCF margin ${pct(fcfM, false)} — still generating cash despite the drop.` : null,
    roic != null && roic > 0 ? `ROIC ${pct(roic, false)} — the business hasn't deteriorated.` : null,
    ``,
    `Price weakness ≠ business weakness. Worth a closer look.`,
    ``,
    `${APP_URL}/stock/${ticker}`,
    `$${ticker} #ValueInvesting #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: top_undervalued ────────────────────────────────────────────────────
// Weekly post: top 5 most undervalued S&P 500 stocks by our DCF model.
// Pure product showcase — demonstrates the core insic.app value prop.
// Data: our own /api/financials endpoint (already in use elsewhere).

async function runTopUndervalued() {
  // Sample 25 tickers from the rotation pool to find the most undervalued
  const today = new Date().getDay()
  const basePool = ROTATION[today] ?? ROTATION[1]
  // Extend with a fixed quality pool to ensure we always have enough data
  const QUALITY_POOL = ['MSFT','AMZN','GOOGL','META','NVDA','AAPL','JPM','V','MA','UNH',
                        'COST','LLY','AVGO','MRK','PG','HD','KO','PEP','TMO','ABT']
  const pool = [...new Set([...basePool, ...QUALITY_POOL])].slice(0, 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside = appUpside(d)
      const fair   = appFairValue(d)
      const price  = d?.quote?.price
      if (upside == null || !fair || !price) return
      if (upside < 0.05) return  // only genuinely undervalued
      const sector = d?.quote?.sector ?? ''
      const grade  = d?.ratings?.overall?.grade ?? ''
      scored.push({ ticker, upside, fair, price, sector, grade })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('Not enough undervalued stocks found'); return }

  scored.sort((a, b) => b.upside - a.upside)
  const top = scored.slice(0, 5)

  const lines = [
    `📊 5 most undervalued S&P 500 stocks (our DCF model, today)`,
    ``,
    ...top.map((s, i) =>
      `${i + 1}. $${s.ticker} — ${fmt(s.price)} → model: ${fmt(s.fair)} (${pct(s.upside)})`
    ),
    ``,
    `Methodology: DCF + forward P/E + EV/EBITDA blend.`,
    `Not financial advice — these are model outputs, not recommendations.`,
    ``,
    `Run your own analysis free → ${APP_URL}`,
    `#ValueInvesting #DCF #StockMarket #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: market_vs_model ────────────────────────────────────────────────────
// Finds stocks where analyst consensus target and our DCF disagree significantly.
// The disagreement itself is the interesting data point — creates debate, replies.
// Data: Yahoo Finance analystTargetMean (free) + our DCF endpoint.

async function runMarketVsModel() {
  const pool = ROTATION[new Date().getDay()] ?? ROTATION[1]

  const candidates = []
  for (const ticker of pool.slice(0, 12)) {
    try {
      const d = await fetchValuation(ticker)
      const ourFair      = appFairValue(d)
      const analystTarget = d?.quote?.analystTargetMean
      const price        = d?.quote?.price
      const numAnalysts  = d?.cagrAnalysis?.numAnalysts ?? 0
      if (!ourFair || !analystTarget || !price || numAnalysts < 5) continue

      const ourUpside      = (ourFair - price) / price
      const analystUpside  = (analystTarget - price) / price
      const divergence     = ourUpside - analystUpside

      // Interesting when our model and analysts diverge by >15pp
      if (Math.abs(divergence) < 0.15) continue

      candidates.push({ ticker, price, ourFair, analystTarget, ourUpside, analystUpside, divergence, numAnalysts, d })
    } catch { /* skip */ }
  }

  if (candidates.length === 0) { console.warn('No divergent picks found'); return }

  // Pick the biggest divergence
  candidates.sort((a, b) => Math.abs(b.divergence) - Math.abs(a.divergence))
  const c = candidates[0]
  const ticker = c.ticker

  const ourIsHigher     = c.ourFair > c.analystTarget
  const impliedGrowth   = c.d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const historicalCagr  = c.d?.cagrAnalysis?.historicalCagr3y
  const sector          = c.d?.quote?.sector ?? ''

  const gapPct = Math.abs((c.ourFair - c.analystTarget) / c.analystTarget * 100).toFixed(0)
  const growthContext = impliedGrowth != null && historicalCagr != null
    ? `The market is pricing in ${pct(impliedGrowth, false)}/yr growth — historical 3Y was ${pct(historicalCagr, false)}.`
    : null

  const lines = [
    ourIsHigher
      ? `Our DCF on $${ticker} is more bullish than the ${c.numAnalysts}-analyst consensus. Here's the gap.`
      : `${c.numAnalysts} analysts have a higher target on $${ticker} than our DCF. One of them is wrong.`,
    ``,
    `Our model: ${fmt(c.ourFair)} (${c.ourUpside >= 0 ? '+' : ''}${(c.ourUpside * 100).toFixed(0)}%)`,
    `Street consensus: ${fmt(c.analystTarget)} (${c.analystUpside >= 0 ? '+' : ''}${(c.analystUpside * 100).toFixed(0)}%)`,
    `Gap: ${gapPct}%`,
    ``,
    growthContext,
    ourIsHigher
      ? `If analysts are anchored to near-term estimates and the model captures longer-term economics better, the gap is an opportunity.`
      : `If the model's growth assumptions are too conservative, the Street is right. If they're too optimistic, the consensus target doesn't hold.`,
    ``,
    `Run the assumptions yourself → ${APP_URL}/stock/${ticker}`,
    `$${ticker} #DCF #Valuation #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: ratio_explained ────────────────────────────────────────────────────
// Teaches one valuation ratio using a real stock's live numbers as the example.
// Rotates through 10 ratios weekly. Each post: what the ratio is, how to read
// it, what a high/low number means, and what the anchor stock's number says today.
// Data: our /api/financials endpoint (already in use everywhere).
//
// Ratios covered (week % 10):
//   0: P/E           1: Forward P/E   2: PEG
//   3: EV/EBITDA     4: P/FCF         5: EV/Revenue
//   6: P/B           7: Gross Margin  8: ROIC
//   9: FCF Margin

// Anchor stock per ratio — chosen because it's a canonical example of that ratio in action
const RATIO_ANCHORS = [
  'AAPL',  // P/E          — mature compounder, well-known P/E
  'NVDA',  // Forward P/E  — high-growth, forward multiple story
  'AMZN',  // PEG          — earnings growth + P/E interplay
  'META',  // EV/EBITDA    — high-margin ad business
  'MSFT',  // P/FCF        — exceptional cash converter
  'CRM',   // EV/Revenue   — SaaS revenue multiple archetype
  'JPM',   // P/B          — banks priced on book value
  'GOOGL', // Gross Margin — high-margin platform business
  'V',     // ROIC         — best-in-class capital returns
  'COST',  // FCF Margin   — low-margin but strong cash flow machine
]

const RATIO_META = [
  {
    name: 'P/E ratio',
    emoji: '📊',
    hashtags: '#PE #Investing #StockValuation',
    extract: (d) => {
      const pe = d.quote?.peRatio
      const price = d.quote?.price
      const eps = d.quote?.price && d.quote?.peRatio ? d.quote.price / d.quote.peRatio : null
      return pe > 0 ? { val: pe, extra: { price, eps } } : null
    },
    interpret: (val, ticker, extra) => {
      const { price, eps } = extra ?? {}
      const epsStr = eps != null ? `earning $${eps.toFixed(2)}/share` : 'currently earning'
      return [
        `$${ticker} has a P/E of ${val.toFixed(1)}×.`,
        ``,
        `That means you're paying ${val.toFixed(1)}× the company's annual earnings for each share.`,
        `At ${price ? `$${price.toFixed(2)}` : 'current price'}, it's ${epsStr} — and the market is valuing those earnings at ${val.toFixed(1)}× today.`,
        ``,
        `A high P/E means investors expect fast earnings growth ahead.`,
        `A low P/E means either the business is cheap — or growth is slowing.`,
        ``,
        `The P/E alone tells you what the market is paying. The DCF tells you what it should pay.`,
        ``,
        `P/E is a snapshot. FCF and growth assumptions are the movie.`,
      ]
    },
  },
  {
    name: 'Forward P/E',
    emoji: '🔭',
    hashtags: '#ForwardPE #Earnings #Investing',
    extract: (d) => {
      const fpe = d.analystForwardPE
      const pe  = d.quote?.peRatio
      return fpe > 0 ? { val: fpe, extra: { pe } } : null
    },
    interpret: (val, ticker, extra) => {
      const { pe } = extra ?? {}
      const premium = pe && val ? ((pe - val) / val * 100).toFixed(0) : null
      return [
        `$${ticker}'s forward P/E is ${val.toFixed(1)}×.`,
        ``,
        `Forward P/E uses next year's consensus earnings estimate instead of trailing earnings.`,
        `${pe && premium ? `Trailing P/E is ${pe.toFixed(1)}× — so analysts expect earnings to grow ~${premium}% in the next year.` : ''}`,
        ``,
        `Why it matters: if you believe the analyst estimate is right, you're buying at ${val.toFixed(1)}× those future earnings.`,
        `If analysts are too optimistic, the real forward P/E is higher.`,
        ``,
        `The risk with forward P/E: consensus estimates are wrong about 40% of the time in magnitude, even when right on direction.`,
        ``,
        `Check insic's DCF model to see what growth rate is actually priced into the stock — not just what analysts expect.`,
      ]
    },
  },
  {
    name: 'PEG ratio',
    emoji: '📈',
    hashtags: '#PEG #GrowthInvesting #Valuation',
    extract: (d) => {
      const peg = d.quote?.pegRatio
      const pe  = d.quote?.peRatio
      const g   = d.cagrAnalysis?.analystEstimate1y
      return peg > 0 && peg < 10 ? { val: peg, extra: { pe, g } } : null
    },
    interpret: (val, ticker, extra) => {
      const { pe, g } = extra ?? {}
      const cheap = val < 1.0
      const fair   = val >= 1.0 && val <= 2.0
      return [
        `$${ticker} has a PEG ratio of ${val.toFixed(2)}.`,
        ``,
        `PEG = P/E ÷ expected earnings growth rate.`,
        `${pe && g ? `$${ticker}'s P/E is ${pe.toFixed(1)}× and analysts expect ~${(g*100).toFixed(0)}%/yr earnings growth — hence PEG ${val.toFixed(2)}.` : ''}`,
        ``,
        `How to read it:`,
        `  PEG < 1.0 → potentially cheap relative to growth`,
        `  PEG 1.0–2.0 → roughly fair`,
        `  PEG > 2.0 → you're paying a premium for growth expectations`,
        ``,
        `$${ticker} at ${val.toFixed(2)} is ${cheap ? 'below 1 — the market may be undervaluing its growth' : fair ? 'in the "fair" range' : 'above 2 — growth expectations are richly priced'}.`,
        ``,
        `PEG is quick and useful. Its weakness: it relies on analyst growth estimates, which are often wrong.`,
      ]
    },
  },
  {
    name: 'EV/EBITDA',
    emoji: '🏭',
    hashtags: '#EVEBITDA #EnterpriseValue #Valuation',
    extract: (d) => {
      const ev = d.valuationMethods?.models?.multiples?.estimates?.find(e => e.multiple === 'EV/EBITDA')?.actualValue
      return ev > 0 && ev < 200 ? { val: ev, extra: {} } : null
    },
    interpret: (val, ticker, extra) => {
      const cheap = val < 10
      const rich  = val > 25
      return [
        `$${ticker} trades at ${val.toFixed(1)}× EV/EBITDA.`,
        ``,
        `EV/EBITDA compares the total value of the business (enterprise value = market cap + debt − cash) to its operating earnings before interest, taxes, depreciation, and amortisation.`,
        ``,
        `Why EV/EBITDA over P/E?`,
        `It's capital-structure neutral — debt doesn't distort the comparison.`,
        `It's more useful when comparing companies across different tax environments or leverage levels.`,
        ``,
        `How to read $${ticker} at ${val.toFixed(1)}×:`,
        `${cheap ? `Below 10× is often considered value territory — either the business is genuinely cheap or the market sees risk ahead.` : rich ? `Above 25× means the market is pricing in meaningful growth or premium quality. Expensive if growth doesn't materialise.` : `10–25× is the typical range for profitable businesses. Normal, but worth checking the growth assumptions.`}`,
        ``,
        `In insic, we use EV/EBITDA as one of four models in the blended fair value — alongside DCF, forward P/E, and revenue multiples.`,
      ]
    },
  },
  {
    name: 'P/FCF',
    emoji: '💵',
    hashtags: '#PFCF #FreeCashFlow #Investing',
    extract: (d) => {
      const price = d.quote?.price
      const mcap  = d.quote?.marketCap
      const fcf   = d.businessProfile?.fcfMargin && d.businessProfile?.revenueM
        ? d.businessProfile.fcfMargin * d.businessProfile.revenueM * 1e6
        : null
      const shares = d.fairValue?.sharesOutstanding
      if (!price || !fcf || !shares || shares <= 0) return null
      const fcfPerShare = fcf / shares
      const pfcf = price / fcfPerShare
      return pfcf > 0 && pfcf < 200 ? { val: pfcf, extra: { fcfPerShare, price } } : null
    },
    interpret: (val, ticker, extra) => {
      const { fcfPerShare, price } = extra ?? {}
      return [
        `$${ticker} trades at ${val.toFixed(1)}× price-to-free-cash-flow.`,
        ``,
        `P/FCF = share price ÷ free cash flow per share.`,
        `${fcfPerShare ? `$${ticker} generates ~$${fcfPerShare.toFixed(2)}/share in free cash flow. At $${price?.toFixed(2)}, you're paying ${val.toFixed(1)}× that cash.` : ''}`,
        ``,
        `Why P/FCF is often better than P/E:`,
        `Earnings can be manipulated with accounting choices.`,
        `Free cash flow (operating cash − capex) is much harder to fake.`,
        `It's the actual cash the business generated — available to pay debt, buy back shares, or invest in growth.`,
        ``,
        `How to read ${val.toFixed(1)}×:`,
        `  Below 15× → potentially cheap for a profitable business`,
        `  15–30× → normal range for quality companies`,
        `  Above 30× → market expects strong FCF growth ahead`,
        ``,
        `Warren Buffett famously values businesses based on their owner earnings — which is essentially what P/FCF measures.`,
      ]
    },
  },
  {
    name: 'EV/Revenue',
    emoji: '📦',
    hashtags: '#EVRevenue #SaaS #GrowthStocks',
    extract: (d) => {
      const ev = d.valuationMethods?.models?.multiples?.estimates?.find(e => e.multiple === 'EV/Revenue')?.actualValue
      return ev > 0 && ev < 100 ? { val: ev, extra: {} } : null
    },
    interpret: (val, ticker, extra) => {
      const high = val > 10
      const low  = val < 3
      return [
        `$${ticker} trades at ${val.toFixed(1)}× EV/Revenue.`,
        ``,
        `EV/Revenue = enterprise value ÷ annual revenue.`,
        `You're paying ${val.toFixed(1)}× each dollar of $${ticker}'s revenue.`,
        ``,
        `When is EV/Revenue useful?`,
        `When a company is unprofitable or has inconsistent earnings.`,
        `For SaaS and high-growth companies, it's often the primary valuation metric used by professionals.`,
        ``,
        `The catch: revenue doesn't equal profit.`,
        `A company with 80% gross margins at 10× revenue is very different from a company with 20% gross margins at 10× revenue.`,
        `Always pair EV/Revenue with gross margin.`,
        ``,
        `$${ticker} at ${val.toFixed(1)}× is ${high ? `high — the market expects significant margin expansion and sustained revenue growth to justify this multiple` : low ? `low — either the business is cheap or growth expectations are muted` : `in the moderate range — watch gross margin direction`}.`,
      ]
    },
  },
  {
    name: 'Price-to-Book (P/B)',
    emoji: '📒',
    hashtags: '#PriceToBook #Banking #ValueInvesting',
    extract: (d) => {
      const pb = d.valuationMethods?.models?.multiples?.estimates?.find(e => e.multiple === 'P/Book')?.actualValue
        ?? (d.quote?.price && d.businessProfile?.bookValuePerShare ? d.quote.price / d.businessProfile.bookValuePerShare : null)
      return pb > 0 && pb < 50 ? { val: pb, extra: {} } : null
    },
    interpret: (val, ticker, extra) => {
      return [
        `$${ticker} trades at ${val.toFixed(2)}× book value (P/B).`,
        ``,
        `P/B = share price ÷ book value per share.`,
        `Book value is what's left if the company sold all assets and paid all liabilities today.`,
        ``,
        `How to read it:`,
        `  P/B < 1 → you're buying assets for less than their accounting value (common in distress)`,
        `  P/B 1–3 → normal for asset-heavy businesses`,
        `  P/B > 10 → the market values the brand/IP/talent far above the balance sheet`,
        ``,
        `$${ticker} at ${val.toFixed(2)}× means the market values the business at ${val.toFixed(2)}× its net assets.`,
        ``,
        `P/B is most relevant for banks, insurers, and asset-heavy businesses.`,
        `For tech and service companies, intangible assets (brand, code, talent) don't appear on the balance sheet — making P/B less meaningful.`,
        ``,
        `The justified P/B formula: P/B = (ROE − g) / (Ke − g). If ROE is high, a high P/B makes sense.`,
      ]
    },
  },
  {
    name: 'Gross Margin',
    emoji: '🧾',
    hashtags: '#GrossMargin #Profitability #Moat',
    extract: (d) => {
      const gm = d.businessProfile?.grossMargin
      return gm > 0 && gm < 1 ? { val: gm * 100, extra: { sector: d.quote?.sector } } : null
    },
    interpret: (val, ticker, extra) => {
      const { sector } = extra ?? {}
      const high = val > 60
      const mid  = val >= 30 && val <= 60
      return [
        `$${ticker} has a gross margin of ${val.toFixed(1)}%.`,
        ``,
        `Gross margin = (revenue − cost of goods sold) ÷ revenue.`,
        `It's the percentage of each dollar of revenue that remains after paying for what you sold.`,
        ``,
        `Why it matters for valuation:`,
        `High gross margin → pricing power → hard-to-replicate product or service → competitive moat.`,
        `Low gross margin → commoditised → subject to price wars → harder to sustain long-term profitability.`,
        ``,
        `${val.toFixed(1)}% for $${ticker} is ${high ? `exceptional. Very few businesses sustain margins above 60%. It suggests strong pricing power — customers pay without much price resistance.` : mid ? `solid. Above the median for most industries. There's a real business here with room to generate profit after reinvestment.` : `tight. The business competes heavily on price or operates in a low-margin industry. Execution matters more at this margin level.`}`,
        ``,
        `Gross margin alone doesn't determine valuation — but it's one of the clearest indicators of whether a business has a moat.`,
      ]
    },
  },
  {
    name: 'ROIC',
    emoji: '🔄',
    hashtags: '#ROIC #ReturnOnCapital #ValueCreation',
    extract: (d) => {
      const roic = d.scores?.roic?.roic
      const wacc = d.wacc?.wacc
      const spread = d.scores?.roic?.spread
      return roic != null ? { val: roic * 100, extra: { wacc: wacc ? wacc * 100 : null, spread: spread ? spread * 100 : null } } : null
    },
    interpret: (val, ticker, extra) => {
      const { wacc, spread } = extra ?? {}
      const creating = spread != null ? spread > 0 : val > 10
      return [
        `$${ticker} earns a ${val.toFixed(1)}% return on invested capital (ROIC).`,
        ``,
        `ROIC = net operating profit after tax ÷ invested capital.`,
        `It measures how efficiently the business turns invested dollars into profit.`,
        ``,
        `The WACC comparison:`,
        `${wacc ? `$${ticker}'s WACC is ~${wacc.toFixed(1)}%. ROIC of ${val.toFixed(1)}% means ${spread ? `a ${Math.abs(spread).toFixed(1)}pp ${creating ? 'value-creating spread' : 'value-destroying gap'}` : 'it earns above its cost of capital'}.` : `Compare ROIC to WACC: if ROIC > WACC, the business creates value. If ROIC < WACC, it destroys it — even if it's profitable.`}`,
        ``,
        `${creating ? `$${ticker} is creating shareholder value with every dollar it reinvests. That's rare and powerful — it compounds over time.` : `$${ticker} earns less on its capital than investors require as a return. Growth in this scenario actually reduces intrinsic value.`}`,
        ``,
        `This is why ROIC matters more than growth rate alone.`,
        `A business growing at 20% with ROIC of 5% is worth less than one growing at 10% with ROIC of 25%.`,
      ]
    },
  },
  {
    name: 'FCF Margin',
    emoji: '🏦',
    hashtags: '#FCFMargin #CashFlow #QualityInvesting',
    extract: (d) => {
      const fcfm = d.businessProfile?.fcfMargin
      return fcfm != null ? { val: fcfm * 100, extra: { netMargin: d.businessProfile?.netMargin ? d.businessProfile.netMargin * 100 : null } } : null
    },
    interpret: (val, ticker, extra) => {
      const { netMargin } = extra ?? {}
      const gap = netMargin != null ? val - netMargin : null
      return [
        `$${ticker} converts ${val.toFixed(1)}% of its revenue into free cash flow.`,
        ``,
        `FCF margin = free cash flow ÷ revenue.`,
        `Free cash flow = operating cash flow − capital expenditures.`,
        ``,
        `It's the cash left after running the business and maintaining/growing its assets — cash that can be returned to shareholders or reinvested.`,
        ``,
        `${netMargin != null ? `$${ticker}'s net income margin is ${netMargin.toFixed(1)}%. FCF margin is ${val.toFixed(1)}%. ${gap > 2 ? 'FCF > net income often means the company has low capex and strong working capital management — quality signal.' : gap < -3 ? 'FCF < net income can mean heavy reinvestment (growing the business) or working capital strain — worth investigating.' : 'They track closely, which is typical for mature businesses.'}` : ''}`,
        ``,
        `How to read ${val.toFixed(1)}%:`,
        `  Below 5% → thin cash generation, vulnerable to downturns`,
        `  5–15% → solid`,
        `  Above 15% → strong cash machine, often a quality compounder`,
        ``,
        `In our DCF model, FCF margin is one of the core assumptions — it directly determines how much cash we project the business will generate.`,
      ]
    },
  },
]

async function runRatioExplained() {
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const ratioIdx   = weekOfYear % RATIO_META.length
  const meta       = RATIO_META[ratioIdx]
  const anchorTicker = RATIO_ANCHORS[ratioIdx]

  console.log(`Ratio explained: ${meta.name} using $${anchorTicker}`)

  // Fetch live data for the anchor stock
  let data = null
  try { data = await fetchValuation(anchorTicker) } catch { /* proceed with generic */ }

  const extracted = data ? meta.extract(data) : null

  let bodyLines
  if (extracted != null) {
    bodyLines = meta.interpret(extracted.val, anchorTicker, extracted.extra ?? {})
  } else {
    // Generic fallback — no live numbers, still educational
    bodyLines = [
      `${meta.name} is one of the most-used ratios in equity analysis.`,
      ``,
      `This week we're breaking it down: what it measures, how to read it, and when it's useful vs misleading.`,
      ``,
      `(Live data temporarily unavailable — check ${APP_URL}/stock/${anchorTicker} for current numbers.)`,
    ]
  }

  const lines = [
    `${meta.emoji} ${meta.name} — explained with a real example ($${anchorTicker})`,
    ``,
    ...bodyLines,
    ``,
    `See every ratio for any stock, free → ${APP_URL}/stock/${anchorTicker}`,
    meta.hashtags,
  ].filter(l => l !== null && l !== undefined)

  await post(lines.join('\n'))
}

// ─── LinkedIn posting ─────────────────────────────────────────────────────────
// Separate post() function for LinkedIn — same Buffer API, different channel ID.
// LinkedIn audience: finance professionals, investors, career-oriented.
// Format: longer, more narrative, no character limits, hashtags at end only.

async function postLinkedIn(text) {
  if (!LINKEDIN_CHANNEL_ID) {
    console.warn('LINKEDIN_CHANNEL_ID not set — skipping LinkedIn post')
    return
  }
  validatePost(text)
  if (DRY_RUN) {
    console.log('--- DRY RUN (LinkedIn) ---')
    console.log(text)
    console.log(`Length: ${text.length}`)
    return
  }
  const res = await fetch('https://api.buffer.com', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${BUFFER_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `mutation {
        createPost(input: {
          channelId: "${LINKEDIN_CHANNEL_ID}"
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
    console.log(`LinkedIn posted — Buffer post ID: ${result.post.id}`)
  } else {
    throw new Error(`LinkedIn post failed: ${result?.message ?? JSON.stringify(json)}`)
  }
}

// ─── LinkedIn Modes ───────────────────────────────────────────────────────────
// LinkedIn-specific content: longer, more analytical, thought-leadership tone.
// 4 modes posted on weekdays + 2 on weekends.

// Mode: li_valuation — LinkedIn version of DCF, more detailed with context
async function runLiValuation() {
  const day = new Date().getDay()
  const pool = TICKER ? [TICKER] : (ROTATION[day] ?? ROTATION[1])
  const dayOfYear = Math.floor(Date.now() / 86400000)

  let ticker = null, data = null
  for (let attempt = 0; attempt < Math.min(5, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt + 7) % pool.length]
    try {
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result)) { ticker = candidate; data = result; break }
    } catch { /* try next */ }
  }
  if (!data) { console.warn('li_valuation: no data — skipping'); return }

  // ── Pull every useful field ──────────────────────────────────────────────
  const price         = data.quote?.price
  const fair          = appFairValue(data)
  const upside        = appUpside(data)
  const v             = verdictLabel(upside ?? 0)
  const cagr          = data.cagr
  const wacc          = data.wacc?.wacc
  const terminalG     = data.terminalG
  const beta          = data.wacc?.inputs?.beta
  const debtToEquity  = data.wacc?.inputs?.debtToEquity
  const grossM        = data.businessProfile?.grossMargin
  const netM          = data.businessProfile?.netMargin
  const fcfM          = data.businessProfile?.fcfMargin
  const revenueM      = data.businessProfile?.revenueM
  const evEbitda      = data.businessProfile?.evToEbitda
  const evRevenue     = data.businessProfile?.evToRevenue
  const priceToBook   = data.businessProfile?.priceToBook
  const priceToSales  = data.businessProfile?.priceToSales
  const roe           = data.businessProfile?.roe
  const roic          = data.scores?.roic?.roic
  const roicSpread    = data.scores?.roic?.spread
  const nopat         = data.scores?.roic?.nopat
  const investedCap   = data.scores?.roic?.investedCapital
  const analyst1y     = data.cagrAnalysis?.analystEstimate1y
  const hist3y        = data.cagrAnalysis?.historicalCagr3y
  const numAnalysts   = data.cagrAnalysis?.numAnalysts ?? 0
  const rec           = data.analystRecommendation ?? ''
  const recLabel      = rec === 'strong_buy' ? 'Strong Buy' : rec === 'buy' ? 'Buy' : rec === 'hold' ? 'Hold' : rec === 'sell' ? 'Sell' : null
  const analystTarget = data.quote?.analystTargetMean
  const targetLow     = data.quote?.analystTargetLow
  const targetHigh    = data.quote?.analystTargetHigh
  const fwdPE         = data.analystForwardPE
  const peRatio       = data.quote?.peRatio
  const pegRatio      = data.quote?.pegRatio
  const divYield      = data.quote?.dividendYield
  const payoutRatio   = data.quote?.payoutRatio
  const marketCap     = data.quote?.marketCap
  const sector        = data.quote?.sector ?? ''
  const industry      = data.quote?.industry ?? ''
  const bear          = data.scenarios?.bear?.fairValue
  const bull          = data.scenarios?.bull?.fairValue
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const piotroski     = data.scores?.piotroski?.score
  const piotroskiLbl  = data.scores?.piotroski?.label
  const altmanZ       = data.scores?.altman?.zScore
  const altmanZone    = data.scores?.altman?.zone
  const beneishFlag   = data.scores?.beneish?.flag
  const overallGrade  = data.ratings?.overall?.grade ?? ''
  const overallLabel  = data.ratings?.overall?.label ?? ''
  const insiderPct    = data.ownership?.insiderPct
  const shortPct      = data.ownership?.shortPct
  const stock1y       = data.holdingReturns?.stock1y
  const spy1y         = data.holdingReturns?.spy1y
  const surprises     = data.earningsSurprises ?? []
  const beatCount     = surprises.filter(s => (s.surprisePercent ?? 0) > 0).length
  const lastSurprise  = surprises[0]
  // Last year of actual financials (non-projected)
  const incomeRows    = (data.financialStatements?.incomeStatement ?? []).filter(r => !r.isProjected)
  const cashFlowRows  = (data.financialStatements?.cashFlow ?? []).filter(r => !r.isProjected)
  const lastIncome    = incomeRows[incomeRows.length - 1]
  const lastCF        = cashFlowRows[cashFlowRows.length - 1]
  const buybacks      = lastCF?.buybacks
  const dividendsPaid = lastCF?.dividendsPaid
  const capex         = lastCF?.capex
  const eps           = lastIncome?.eps
  const ebitda        = lastIncome?.ebitda
  // Forward EPS estimate
  const fwdEps        = data.analystForwardEstimates?.find(e => e.period === '+1y')?.eps?.avg
  const fwdRevGrowth  = data.analystForwardEstimates?.find(e => e.period === '+1y')?.revenue?.growth
  const fwdRevAnalysts = data.analystForwardEstimates?.find(e => e.period === '+1y')?.revenue?.analysts

  // ── Derived context signals ───────────────────────────────────────────────
  const isOverpriced   = (upside ?? 0) < -0.10
  const isAttractive   = (upside ?? 0) > 0.10
  const analystBullish = recLabel === 'Strong Buy' || recLabel === 'Buy'
  const modelVsStreet  = isOverpriced && analystBullish
  const roicNeg        = roicSpread != null && roicSpread < 0
  const roicPos        = roicSpread != null && roicSpread > 0.04
  const hasDiv         = divYield != null && divYield > 0.005
  const highShort      = shortPct != null && shortPct > 0.07
  const mcapB          = marketCap != null ? (marketCap / 1e9).toFixed(1) : null

  // ── Opening hook ─────────────────────────────────────────────────────────
  let hook
  if (impliedGrowth != null && isOverpriced) {
    hook = `At ${fmt(price)}, owning $${ticker} means you believe revenue grows at ~${pct(impliedGrowth, false)}/yr for the next five years. Our model, using ${pct(cagr, false)}, puts fair value at ${fmt(fair)} — a ${Math.abs((upside ?? 0) * 100).toFixed(0)}% gap. That gap is the question worth asking.`
  } else if (impliedGrowth != null && isAttractive) {
    hook = `The market is pricing $${ticker} as if revenue grows just ${pct(impliedGrowth, false)}/yr. Analysts expect ${analyst1y != null && numAnalysts >= 3 ? pct(analyst1y, false) : pct(cagr, false)}. If they're right, the stock looks underpriced at ${fmt(price)} against our ${fmt(fair)} fair value.`
  } else if (modelVsStreet) {
    hook = `$${ticker} at ${fmt(price)}: Wall Street says ${recLabel}${analystTarget ? ` with a ${fmt(analystTarget)} consensus target` : ''}. Our DCF puts fair value at ${fmt(fair)}. That's a ${Math.abs((upside ?? 0) * 100).toFixed(0)}% gap. One of them is wrong — here's the model's case.`
  } else {
    hook = `Running the numbers on $${ticker}. At ${fmt(price)}, our DCF puts fair value at ${fmt(fair)} — ${isAttractive ? `suggesting the market is leaving something on the table` : isOverpriced ? `meaning significant optimism is already priced in` : `roughly in line with where it trades`}.`
  }

  // ── Valuation context paragraph ───────────────────────────────────────────
  const valParts = []
  if (bear && bull) {
    const bearGap = ((bear - price) / price * 100).toFixed(0)
    const bullGap = ((bull - price) / price * 100).toFixed(0)
    valParts.push(`Scenario range: ${fmt(bear)} (bear) to ${fmt(bull)} (bull) — ${bearGap}% downside to ${Number(bullGap) > 0 ? '+' : ''}${bullGap}% upside from here.`)
  }
  if (fwdPE && peRatio) {
    valParts.push(`Trading at ${fwdPE}× forward earnings vs ${peRatio.toFixed(1)}× trailing.`)
  } else if (fwdPE) {
    valParts.push(`Forward P/E: ${fwdPE}×.`)
  }
  if (evEbitda) valParts.push(`EV/EBITDA: ${evEbitda.toFixed(1)}×.`)
  if (pegRatio && pegRatio > 0 && pegRatio < 10) valParts.push(`PEG: ${pegRatio.toFixed(2)} — ${pegRatio < 1 ? 'growth looks underpriced relative to earnings' : pegRatio > 2 ? 'growth premium is elevated' : 'reasonable relative to growth'}.`)
  if (analystTarget && targetLow && targetHigh) {
    valParts.push(`Analyst target range: ${fmt(targetLow)} – ${fmt(targetHigh)} (consensus: ${fmt(analystTarget)}).`)
  }
  const valPara = valParts.length > 0 ? valParts.join(' ') : null

  // ── Business quality paragraph ────────────────────────────────────────────
  const qualParts = []
  if (roicNeg) {
    qualParts.push(`ROIC sits at ${pct(roic, false)}, below the ${pct(wacc, false)} cost of capital — the business is consuming more value than it creates at the current scale.`)
    if (grossM != null) qualParts.push(`Gross margin of ${pct(grossM, false)} shows the core product economics are workable${netM != null ? `; it's operating costs pulling the ROIC down` : ``}.`)
  } else if (roicPos) {
    qualParts.push(`ROIC is ${pct(roic, false)} against a ${pct(wacc, false)} WACC — a ${pct(roicSpread, false)} value-creation spread.`)
    if (nopat && investedCap) qualParts.push(`That's ${fmt(nopat * 1e6)} of NOPAT on ${fmt(investedCap * 1e6)} of invested capital.`)
  }
  if (grossM != null && !roicNeg) qualParts.push(`Margins: gross ${pct(grossM, false)}${netM != null ? `, net ${pct(netM, false)}` : ''}${fcfM != null ? `, FCF ${pct(fcfM, false)}` : ''}.`)
  if (roe != null) qualParts.push(`ROE: ${pct(roe, false)}.`)
  if (revenueM != null) qualParts.push(`Revenue base: ${revenueM >= 1000 ? `$${(revenueM / 1000).toFixed(1)}B` : `$${revenueM.toFixed(0)}M`}.`)
  const qualPara = qualParts.length > 0 ? qualParts.join(' ') : null

  // ── Growth paragraph ──────────────────────────────────────────────────────
  const growthParts = []
  if (hist3y != null && analyst1y != null && numAnalysts >= 3) {
    const accelerating = analyst1y > hist3y * 1.1
    const decelerating = analyst1y < hist3y * 0.85
    growthParts.push(`Historical 3Y revenue CAGR: ${pct(hist3y, false)}. ${numAnalysts} analysts project ${pct(analyst1y, false)} for the next year — ${accelerating ? 'an acceleration' : decelerating ? 'a deceleration' : 'a similar pace'}.`)
  } else if (hist3y != null) {
    growthParts.push(`3Y revenue CAGR: ${pct(hist3y, false)}. Model uses ${pct(cagr, false)}.`)
  }
  if (fwdRevGrowth != null && fwdRevAnalysts != null && fwdRevAnalysts >= 3) {
    growthParts.push(`Forward revenue growth consensus: ${pct(fwdRevGrowth, false)} (${fwdRevAnalysts} analysts).`)
  }
  if (lastSurprise && surprises.length >= 3) {
    const avgSurprise = surprises.reduce((s, q) => s + (q.surprisePercent ?? 0), 0) / surprises.length
    growthParts.push(`EPS beat rate: ${beatCount}/${surprises.length} quarters, avg surprise ${avgSurprise >= 0 ? '+' : ''}${avgSurprise.toFixed(1)}%.`)
  }
  if (fwdEps && eps) {
    growthParts.push(`EPS: ${fmt(eps)} TTM → ${fmt(fwdEps)} consensus estimate next year.`)
  }
  const growthPara = growthParts.length > 0 ? growthParts.join(' ') : null

  // ── Capital allocation / balance sheet ───────────────────────────────────
  const capParts = []
  if (buybacks && buybacks > 100) capParts.push(`Returned ${fmt(buybacks * 1e6)} via buybacks last year.`)
  if (hasDiv) {
    capParts.push(`Dividend yield: ${pct(divYield, false)}${payoutRatio != null ? ` (${pct(payoutRatio, false)} payout ratio)` : ''}.`)
  }
  if (capex && revenueM) {
    const capexPct = Math.abs(capex) / revenueM
    if (capexPct > 0.05) capParts.push(`Capex intensity: ${pct(capexPct, false)} of revenue — ${capexPct > 0.15 ? 'capital-heavy business' : 'moderate reinvestment'}.`)
  }
  if (debtToEquity != null && debtToEquity > 0.5) capParts.push(`D/E ratio: ${debtToEquity.toFixed(2)}×.`)
  const capPara = capParts.length > 0 ? capParts.join(' ') : null

  // ── Risk signals ──────────────────────────────────────────────────────────
  const riskParts = []
  if (piotroski != null) riskParts.push(`Piotroski F-Score: ${piotroski}/9 (${piotroskiLbl ?? (piotroski >= 7 ? 'strong' : piotroski >= 4 ? 'mixed' : 'weak')}).`)
  if (altmanZ != null && altmanZone) riskParts.push(`Altman Z-Score: ${altmanZ.toFixed(2)} — ${altmanZone} zone.`)
  if (beneishFlag && beneishFlag !== 'Clean') riskParts.push(`Beneish M-Score flag: ${beneishFlag} — earnings quality worth checking.`)
  if (highShort) riskParts.push(`Short interest: ${pct(shortPct, false)} of float — elevated.`)
  if (beta != null) riskParts.push(`Beta: ${beta.toFixed(2)} vs S&P 500.`)
  if (insiderPct != null && insiderPct > 0.05) riskParts.push(`Insider ownership: ${pct(insiderPct, false)}.`)
  const riskPara = riskParts.length > 0 ? riskParts.join(' ') : null

  // ── Closing ───────────────────────────────────────────────────────────────
  let closing
  if (modelVsStreet) {
    closing = `The tension between model and consensus is real here. Analysts have channel access and short-term visibility; the DCF has the math. The question is whether the growth rate priced in today is achievable — or aspirational.`
  } else if (isAttractive && roicPos) {
    closing = `A business generating strong returns on capital at a price below model value. Worth understanding what the market is discounting.`
  } else if (isOverpriced && roicNeg) {
    closing = `Expensive and still burning capital. The bull case is a margin turnaround — which can work, but needs to show up in the numbers.`
  } else if (hasDiv && isAttractive) {
    closing = `Getting paid ${pct(divYield, false)} to wait while the gap to fair value potentially closes. That's a reasonable setup.`
  } else {
    closing = `Every model has limits. The right move: stress-test the WACC and growth rate. The sensitivity tells you which assumption carries the most risk.`
  }

  const lines = [
    hook,
    ``,
    ...(valPara   ? [valPara,   ``] : []),
    ...(growthPara ? [growthPara, ``] : []),
    ...(qualPara  ? [qualPara,  ``] : []),
    ...(capPara   ? [capPara,   ``] : []),
    ...(riskPara  ? [riskPara,  ``] : []),
    closing,
    ``,
    `Full interactive model (adjust WACC, growth, terminal rate) → insic.app/stock/${ticker}`,
    ``,
    `#${ticker} #DCF #Investing #Finance${sector ? ` #${sector.replace(/[^a-zA-Z]/g, '')}` : ''}`,
  ].filter(s => s !== undefined)

  await postLinkedIn(lines.join('\n'))
}

// Mode: li_market_wrap — LinkedIn end-of-day professional summary
async function runLiMarketWrap() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const [sp500, nasdaq, dow] = await Promise.all([
    fetchYahooChart('^GSPC'), fetchYahooChart('^IXIC'), fetchYahooChart('^DJI'),
  ])
  await new Promise(r => setTimeout(r, 600))
  const [tnx, oil, gold, dxy] = await Promise.all([
    fetchYahooChart('^TNX'), fetchYahooChart('CL=F'),
    fetchYahooChart('GC=F'), fetchYahooChart('DX-Y.NYB'),
  ])
  await new Promise(r => setTimeout(r, 600))

  const sectorSymbols = [
    { sym: 'XLK', name: 'Technology' }, { sym: 'XLE', name: 'Energy' },
    { sym: 'XLF', name: 'Financials' }, { sym: 'XLV', name: 'Healthcare' },
    { sym: 'XLU', name: 'Utilities' }, { sym: 'XLI', name: 'Industrials' },
  ]
  const sectors = []
  for (const { sym, name } of sectorSymbols) {
    const d = await fetchYahooChart(sym).catch(() => null)
    if (d) sectors.push({ ...d, name })
    await new Promise(r => setTimeout(r, 250))
  }
  sectors.sort((a, b) => b.changePct - a.changePct)

  const best  = sectors[0]
  const worst = sectors[sectors.length - 1]

  const whatDrove = (() => {
    const items = []
    if (best && Math.abs(best.changePct) > 0.3) {
      const riskOn = ['Technology', 'Energy', 'Industrials'].includes(best.name)
      items.push(riskOn
        ? `${best.name} led (+${best.changePct.toFixed(1)}%), reflecting a risk-on tone.`
        : `${best.name} outperformed (+${best.changePct.toFixed(1)}%) as investors rotated into defensives.`)
    }
    if (worst && Math.abs(worst.changePct) > 0.3) items.push(`${worst.name} lagged (${worst.changePct.toFixed(1)}%).`)
    if (tnx && Math.abs(tnx.changePct) > 0.5) items.push(tnx.changePct > 0
      ? `Yields rose (+${tnx.changePct.toFixed(1)}bps) — adding pressure on rate-sensitive assets.`
      : `Yields declined (${tnx.changePct.toFixed(1)}bps), providing relief for growth stocks.`)
    if (oil && Math.abs(oil.changePct) > 1) items.push(oil.changePct < 0
      ? `Oil fell ${Math.abs(oil.changePct).toFixed(1)}%.`
      : `Oil gained ${oil.changePct.toFixed(1)}%.`)
    return items.length > 0 ? items : ['Broad-based session without a clear dominant theme.']
  })()

  const lines = [
    `📊 Market Close — ${dayName}`,
    ``,
    `🇺🇸 US Indices`,
    sp500  ? `S&P 500:   ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}% (${sp500.price.toFixed(0)})` : null,
    nasdaq ? `Nasdaq:    ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}% (${nasdaq.price.toFixed(0)})` : null,
    dow    ? `Dow Jones: ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}% (${dow.price.toFixed(0)})` : null,
    ``,
    `🏭 Sector Performance`,
    ...sectors.map(s => `${s.changePct >= 0.5 ? '▲' : s.changePct <= -0.5 ? '▼' : '→'} ${s.name}: ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`),
    ``,
    `📌 Rates & Commodities`,
    tnx  ? `10Y Treasury: ${tnx.price.toFixed(3)}% (${tnx.changePct >= 0 ? '+' : ''}${tnx.changePct.toFixed(2)}%)` : null,
    oil  ? `WTI Oil: $${oil.price.toFixed(2)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(2)}%)` : null,
    gold ? `Gold: $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(2)}%)` : null,
    dxy  ? `US Dollar (DXY): ${dxy.price.toFixed(1)} (${dxy.changePct >= 0 ? '+' : ''}${dxy.changePct.toFixed(2)}%)` : null,
    ``,
    `🔍 What Drove It`,
    ...whatDrove,
    ``,
    `The key question for investors: did today's move change the fundamental value of your positions, or just the price? Those are very different things.`,
    ``,
    `Run your DCF models → insic.app`,
    ``,
    `#MarketClose #Finance #Investing #StockMarket #DCF`,
  ].filter(Boolean)

  await postLinkedIn(lines.join('\n'))
}

// Mode: li_deep_dive — LinkedIn weekly thought leadership: one concept, deep analysis
const LI_DEEP_DIVES = [
  {
    lines: [
      `Why most investors confuse a great company with a great investment`,
      ``,
      `This is perhaps the most important distinction in investing — and most people get it wrong.`,
      ``,
      `A great company:`,
      `→ Has durable competitive advantages`,
      `→ Generates high returns on invested capital`,
      `→ Grows revenue consistently`,
      `→ Has a management team that allocates capital well`,
      ``,
      `A great investment:`,
      `→ All of the above, purchased at a price below intrinsic value`,
      ``,
      `The difference is the margin of safety.`,
      ``,
      `Apple is objectively one of the greatest businesses ever built. But in 2000, buying it at the wrong multiple would have meant waiting 10 years to break even.`,
      ``,
      `Warren Buffett put it simply: "Price is what you pay. Value is what you get."`,
      ``,
      `The practical implication: before you invest in a company you admire, run the numbers. What growth rate does the current price assume? Is that achievable? What happens if it isn't?`,
      ``,
      `That's what a DCF model does — it converts admiration into a testable hypothesis.`,
      ``,
      `We built insic.app to make this analysis accessible to everyone, not just institutional analysts.`,
      ``,
      `#ValueInvesting #DCF #Finance #InvestmentStrategy #Buffett`,
    ],
  },
  {
    lines: [
      `The one number that tells you if a company is truly creating value`,
      ``,
      `It's not revenue growth. It's not earnings per share. It's not even free cash flow.`,
      ``,
      `It's the spread between ROIC and WACC.`,
      ``,
      `ROIC (Return on Invested Capital) measures how much profit a business generates per dollar of capital deployed.`,
      ``,
      `WACC (Weighted Average Cost of Capital) measures what that capital costs — the minimum return investors require to stay invested.`,
      ``,
      `The spread between them is economic profit: the value actually created above and beyond what's required.`,
      ``,
      `A company earning ROIC = 25% with WACC = 10% is creating 15 cents of economic value per dollar invested.`,
      `A company earning ROIC = 8% with WACC = 10% is destroying shareholder value — even if it reports positive earnings.`,
      ``,
      `This framework is why Buffett focuses on businesses with durable competitive advantages. A true moat means ROIC > WACC sustained for a decade or more — and that compounds into extraordinary returns.`,
      ``,
      `Every stock on insic.app shows this spread in real time. It's one of the first things I check.`,
      ``,
      `#ROIC #WACC #ValueCreation #Finance #InvestmentAnalysis`,
    ],
  },
  {
    lines: [
      `What the Fed actually does to your stock portfolio (the mechanics most investors miss)`,
      ``,
      `When the Federal Reserve changes interest rates, most investors think: "rates up = stocks down."`,
      ``,
      `That's too simple. Here's the actual mechanism:`,
      ``,
      `1. The Fed changes the federal funds rate`,
      `↓`,
      `2. This affects the risk-free rate (typically 10Y Treasury yield)`,
      `↓`,
      `3. The risk-free rate is the foundation of every discount rate (WACC)`,
      `↓`,
      `4. WACC determines how much future cash flows are worth today`,
      `↓`,
      `5. Every DCF fair value estimate changes`,
      ``,
      `The impact is not equal across all stocks:`,
      ``,
      `High-growth stocks (long duration) — most sensitive. When most of a company's value lies in cash flows 10+ years out, even a small increase in WACC dramatically reduces present value.`,
      ``,
      `Value stocks (short duration) — less sensitive. If most cash flows arrive in the next 3–5 years, the discount rate matters less.`,
      ``,
      `This is the math behind why tech stocks fell 30–40% in 2022 while energy and financials held up. It wasn't sentiment — it was arithmetic.`,
      ``,
      `Understanding this lets you anticipate how your portfolio responds to rate decisions before they happen.`,
      ``,
      `#FederalReserve #InterestRates #WACC #DCF #PortfolioManagement`,
    ],
  },
  {
    lines: [
      `Why analysts' price targets are less useful than most investors think`,
      ``,
      `There are roughly 5,000 sell-side analysts on Wall Street, collectively producing hundreds of thousands of price targets each year.`,
      ``,
      `Here's what the academic research consistently finds about them:`,
      ``,
      `1. Price targets cluster near the current price (anchoring bias). Analysts rarely deviate by more than 20% in either direction.`,
      ``,
      `2. They are revised reactively, not predictively. After a stock rises 20%, price targets get raised. After a drop, they get cut.`,
      ``,
      `3. 12-month accuracy is poor. Studies find that analyst price targets outperform a random walk by a statistically insignificant margin.`,
      ``,
      `4. They reflect consensus — by definition, not contrarian.`,
      ``,
      `None of this means sell-side research is worthless. EPS estimates, sector analysis, and management channel checks are genuinely valuable.`,
      ``,
      `But the price target itself? It's a prediction about what other investors will pay in 12 months — not what the business is actually worth.`,
      ``,
      `DCF intrinsic value is different. It asks: if I owned this business forever and collected all its cash flows, what would I pay for it today? That's a more honest question.`,
      ``,
      `The difference matters, especially when markets are moving fast and analyst targets are chasing the price.`,
      ``,
      `#FinancialAnalysis #ValueInvesting #PriceTargets #DCF #InvestmentResearch`,
    ],
  },
  {
    lines: [
      `The terminal value problem: why 70% of your DCF is based on one assumption`,
      ``,
      `If you've ever built a DCF model, you've encountered the terminal value — the lump-sum estimate of all cash flows beyond your explicit forecast period.`,
      ``,
      `Here's the uncomfortable truth: for most growth companies, 60–80% of the total valuation comes from this single terminal value estimate.`,
      ``,
      `You spend hours modeling years 1–5 in detail. You get the margins right, the capex right, the working capital right.`,
      ``,
      `Then you apply one number — the terminal growth rate — and it determines most of the answer.`,
      ``,
      `A 2% terminal growth rate vs. 3% can change a company's fair value by 30%.`,
      ``,
      `Academic guidance (Damodaran):`,
      `→ Terminal growth should not exceed long-run nominal GDP growth of the company's home market`,
      `→ For US companies, this is typically 2–2.5%`,
      `→ Emerging market companies may justify slightly higher, but still anchored to country GDP`,
      ``,
      `The practical takeaway: always run your DCF at multiple terminal growth rates (1.5%, 2.0%, 2.5%). If the investment case only works at the high end, you're making a bet, not an investment.`,
      ``,
      `This is why scenario analysis — bear, base, bull — is more honest than a single point estimate.`,
      ``,
      `#DCF #TerminalValue #Damodaran #Finance #InvestmentModeling`,
    ],
  },
]

async function runLiDeepDive() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const content = LI_DEEP_DIVES[dayOfYear % LI_DEEP_DIVES.length]
  await postLinkedIn(content.lines.join('\n'))
}

// Mode: li_sector_scan — LinkedIn version of sector scan, more detailed narrative
async function runLiSectorScan() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const weekOfYear = Math.floor(dayOfYear / 7)
  const scan = SECTOR_SCANS[weekOfYear % SECTOR_SCANS.length]
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  const results = await Promise.allSettled(scan.tickers.map(t => fetchValuation(t)))
  const rows = []
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status !== 'fulfilled') continue
    const d = r.value
    const fwdPE      = d.analystForwardPE
    const evEbitda   = d.businessProfile?.evToEbitda   ?? null
    const evRevenue  = d.businessProfile?.evToRevenue  ?? null
    const revGrowth  = d.cagrAnalysis?.analystEstimate1y ?? null
    const roicSpread = d.scores?.roic?.spread ?? null
    const fair       = appFairValue(d)
    const upside     = appUpside(d)
    const price      = d.quote?.price
    if (!price || !fwdPE) continue
    const v = verdictLabel(upside ?? 0)
    rows.push({ ticker: scan.tickers[i], price, fwdPE, evEbitda, evRevenue, revGrowth, roicSpread, fair, upside, v })
  }

  if (rows.length === 0) throw new Error('No sector scan data')
  rows.sort((a, b) => (a.fwdPE ?? 999) - (b.fwdPE ?? 999))

  const cheapest   = rows[0]
  const richest    = rows[rows.length - 1]
  const bestROIC   = [...rows].sort((a, b) => (b.roicSpread ?? -99) - (a.roicSpread ?? -99))[0]
  const bestGrowth = [...rows].filter(r => r.revGrowth != null).sort((a, b) => b.revGrowth - a.revGrowth)[0]

  // Adaptive column — use whichever multiple has ≥60% coverage
  const evEbitdaCount  = rows.filter(r => r.evEbitda  != null).length
  const evRevenueCount = rows.filter(r => r.evRevenue != null).length
  const threshold = Math.ceil(rows.length * 0.6)
  const multipleKey   = evEbitdaCount  >= threshold ? 'evEbitda'
                      : evRevenueCount >= threshold ? 'evRevenue' : null
  const multipleLabel = multipleKey === 'evEbitda'  ? 'EV/EBITDA'
                      : multipleKey === 'evRevenue' ? 'EV/Revenue' : null
  const multipleDesc  = multipleKey === 'evEbitda'  ? 'enterprise value vs operating earnings — lower means cheaper relative to cash generation'
                      : multipleKey === 'evRevenue' ? 'enterprise value vs revenue — useful when margins are thin or variable'
                      : null
  const showGrowth = rows.filter(r => r.revGrowth  != null).length >= threshold
  const showROIC   = rows.filter(r => r.roicSpread != null).length >= threshold

  // Each stock gets its own mini-block — fully labeled, no abbreviations
  const stockBlocks = rows.map(r => {
    const lines = [`$${r.ticker}`]
    lines.push(`  Forward P/E: ${r.fwdPE.toFixed(0)}× (what you pay per dollar of next year's earnings)`)
    if (multipleKey && r[multipleKey] != null) lines.push(`  ${multipleLabel}: ${r[multipleKey].toFixed(1)}× (${multipleDesc})`)
    if (showGrowth && r.revGrowth != null) lines.push(`  Revenue growth: +${(r.revGrowth * 100).toFixed(0)}%/yr analyst consensus`)
    if (showROIC && r.roicSpread != null) {
      const spreadPp = (r.roicSpread * 100).toFixed(0)
      const comment = r.roicSpread > 0.08 ? `strong value creation — every reinvested dollar earns well above its cost`
        : r.roicSpread > 0.02 ? `creating value above cost of capital`
        : r.roicSpread > -0.02 ? `roughly break-even on capital returns`
        : `returning less than it costs to fund the business`
      lines.push(`  ROIC vs WACC: ${r.roicSpread >= 0 ? '+' : ''}${spreadPp}pp (${comment})`)
    }
    if (r.upside != null && r.fair) {
      lines.push(`  DCF model: ${r.v.short} · fair value ${fmt(r.fair)} · ${r.upside >= 0 ? '+' : ''}${(r.upside * 100).toFixed(0)}% vs current price`)
    }
    return lines.join('\n')
  })

  // Narrative insight paragraphs
  const insights = [
    cheapest ? `$${cheapest.ticker} has the lowest forward multiple in the group at ${cheapest.fwdPE.toFixed(0)}×.${cheapest.revGrowth != null ? ` Analysts still expect +${(cheapest.revGrowth * 100).toFixed(0)}%/yr revenue growth — that combination is worth investigating.` : ''}` : null,
    richest  ? `$${richest.ticker} is priced the richest at ${richest.fwdPE.toFixed(0)}× forward earnings.${richest.revGrowth != null ? ` It needs to sustain +${(richest.revGrowth * 100).toFixed(0)}%/yr growth to justify that premium.` : ' A valuation that demands execution.'}` : null,
    bestROIC && bestROIC.roicSpread != null && bestROIC.roicSpread > 0.04
      ? `$${bestROIC.ticker} has the widest ROIC spread in the group (+${(bestROIC.roicSpread * 100).toFixed(0)}pp above WACC). That's what a durable moat looks like in the numbers — compounding above the cost of capital.`
      : null,
    bestGrowth && bestGrowth.revGrowth != null
      ? `$${bestGrowth.ticker} is the fastest-growing name analysts expect here (+${(bestGrowth.revGrowth * 100).toFixed(0)}%/yr).${bestGrowth.roicSpread != null && bestGrowth.roicSpread > 0 ? ` With a positive ROIC spread, that growth actually creates value rather than just consuming capital.` : ` The question is whether the current price already accounts for it.`}`
      : null,
  ].filter(Boolean)

  const closing = `A low multiple doesn't mean cheap if growth is decelerating. A high multiple doesn't mean expensive if the business earns well above its cost of capital. Both numbers together tell a more honest story.`

  const lines = [
    `${scan.emoji} ${scan.name} Sector — Valuation Analysis`,
    dateStr,
    ``,
    scan.context,
    ``,
    ...stockBlocks.flatMap(b => [b, ``]),
    `─`,
    ...insights,
    ``,
    closing,
    ``,
    `Full interactive DCF models (adjust any assumption) → insic.app`,
    ``,
    `#${scan.name.replace(/[^a-zA-Z]/g, '')} #Valuation #SectorAnalysis #DCF #Finance`,
  ].filter(Boolean)

  await postLinkedIn(lines.join('\n'))
}

// ─── li_morning_brief ─────────────────────────────────────────────────────────
// 7:45 AM ART (10:45 UTC) Mon–Fri. Pre-market setup for LinkedIn's morning
// professional audience. Leads with what matters most today, ends with a
// valuation question that links to the app.

async function runLiMorningBrief() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayUtc = new Date().toISOString().split('T')[0]
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]

  const [sp500, nasdaq, tnx] = await Promise.all([
    fetchYahooChart('^GSPC').catch(() => null),
    fetchYahooChart('^IXIC').catch(() => null),
    fetchYahooChart('^TNX').catch(() => null),
  ])
  await new Promise(r => setTimeout(r, 600))
  const [dax, nikkei, oil, gold] = await Promise.all([
    fetchYahooChart('^GDAXI').catch(() => null),
    fetchYahooChart('^N225').catch(() => null),
    fetchYahooChart('CL=F').catch(() => null),
    fetchYahooChart('GC=F').catch(() => null),
  ])
  await new Promise(r => setTimeout(r, 600))
  const vix = await fetchEtfQuote('VIX').catch(() => null)

  const macroToday    = MACRO_CALENDAR.filter(e => e.date === todayUtc)
  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === tomorrowUtc)

  // Overnight read
  const overnightParts = []
  if (dax)    overnightParts.push(`DAX ${dax.changePct >= 0 ? '+' : ''}${dax.changePct.toFixed(1)}%`)
  if (nikkei) overnightParts.push(`Nikkei ${nikkei.changePct >= 0 ? '+' : ''}${nikkei.changePct.toFixed(1)}%`)
  const spFutures = sp500 ? `S&P futures ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nqFutures = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null

  // Yield context
  const yieldContext = tnx ? (() => {
    const y = tnx.price
    if (y >= 4.5) return `10Y Treasury at ${y.toFixed(2)}% — elevated. Growth stock discount rates are under pressure.`
    if (y >= 4.0) return `10Y Treasury at ${y.toFixed(2)}%. Watching for a breakout above 4.5% — that's the level that changes WACC meaningfully.`
    return `10Y Treasury at ${y.toFixed(2)}% — benign for valuations right now.`
  })() : null

  // What matters most today
  const topItem = (() => {
    if (macroToday.length > 0) {
      const e = macroToday[0]
      if (e.type === 'FOMC') return `Fed decision today. Whatever they say, update your WACC. A 25bps move changes fair values across the board.`
      if (e.type === 'CPI')  return `CPI out this morning. Watch the core print — that's what moves the Fed's calculus, and through it every discount rate in your model.`
      if (e.type === 'NFP')  return `Jobs report this morning. A strong number keeps the Fed on hold. A weak one opens the door to cuts — watch what that does to growth valuations.`
      return `${e.label} today.`
    }
    if (macroTomorrow.length > 0) {
      const e = macroTomorrow[0]
      return `${e.label} tomorrow. Markets will start positioning today — good time to check your WACC assumptions before the number drops.`
    }
    if (oil && Math.abs(oil.changePct) > 1.5) {
      return oil.changePct > 0
        ? `Oil up ${oil.changePct.toFixed(1)}% overnight. Energy sector will be in play early.`
        : `Oil down ${Math.abs(oil.changePct).toFixed(1)}% overnight — macro demand concerns creeping in.`
    }
    if (vix && vix.price > 22) return `VIX at ${vix.price.toFixed(1)} — elevated fear reading. Not a time to be adding risk without checking your margin of safety.`
    return null
  })()

  // Valuation hook — drives to app
  const day = new Date().getDay()
  const pool = ROTATION[day] ?? ROTATION[1]
  const dayOfYear = Math.floor(Date.now() / 86400000)
  let focusTicker = null, focusData = null
  for (let i = 0; i < Math.min(4, pool.length); i++) {
    const t = pool[(dayOfYear + i + 3) % pool.length]
    try {
      const d = await fetchValuation(t)
      if (d?.quote?.price && appFairValue(d)) { focusTicker = t; focusData = d; break }
    } catch { /* try next */ }
  }

  const valuationHook = focusData && focusTicker ? (() => {
    const fair   = appFairValue(focusData)
    const upside = appUpside(focusData)
    const price  = focusData.quote?.price
    const impliedG = focusData.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (impliedG != null && Math.abs(upside ?? 0) > 0.08) {
      return (upside ?? 0) > 0
        ? `One to watch: $${focusTicker} at ${fmt(price)}. Market pricing in ~${pct(impliedG, false)}/yr growth — our model sees ${pct(upside)} upside. → insic.app/stock/${focusTicker}`
        : `One to watch: $${focusTicker} at ${fmt(price)}. Market pricing in ~${pct(impliedG, false)}/yr growth to justify this price — that's a lot to deliver. → insic.app/stock/${focusTicker}`
    }
    return Math.abs(upside ?? 0) > 0.08
      ? `One to watch today: $${focusTicker}. Our model puts fair value at ${fmt(fair)} — ${pct(upside)} ${(upside ?? 0) > 0 ? 'above' : 'below'} current price. → insic.app/stock/${focusTicker}`
      : null
  })() : null

  const lines = [
    `Good morning — ${dayName}`,
    ``,
    [spFutures, nqFutures].filter(Boolean).join(' · '),
    overnightParts.length > 0 ? overnightParts.join(' · ') : null,
    [
      oil  ? `Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)` : null,
      gold ? `Gold $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(1)}%)` : null,
    ].filter(Boolean).join(' · ') || null,
    ``,
    yieldContext,
    topItem ? `\n${topItem}` : null,
    valuationHook ? `\n${valuationHook}` : null,
    ``,
    `Full market models → insic.app`,
    ``,
    `#GoodMorning #Finance #Investing #Markets`,
  ].filter(Boolean)

  await postLinkedIn(lines.join('\n'))
}

// ─── li_divergence ────────────────────────────────────────────────────────────
// Tue/Thu 12:30 PM ART. Finds 3 stocks where our DCF and Wall St consensus
// disagree the most. The tension drives engagement and visits.

async function runLiDivergence() {
  const POOL = [
    'AAPL','MSFT','GOOGL','META','AMZN','NVDA','TSLA','JPM','V','MA',
    'UNH','LLY','AVGO','ORCL','CRM','ADBE','NOW','COST','HD','WMT',
    'JNJ','PFE','MRK','ABBV','BAC','GS','MS','AMD','INTC','QCOM',
  ]

  const candidates = []
  await Promise.all(POOL.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const ourFair     = appFairValue(d)
      const price       = d?.quote?.price
      const analystTarget = d?.quote?.analystTargetMean
      const numAnalysts   = d?.cagrAnalysis?.numAnalysts ?? 0
      if (!ourFair || !price || !analystTarget || numAnalysts < 5) return
      const ourUpside     = (ourFair - price) / price
      const streetUpside  = (analystTarget - price) / price
      const divergence    = Math.abs(ourUpside - streetUpside)
      if (divergence < 0.10) return
      const impliedG    = d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
      const hist3y      = d?.cagrAnalysis?.historicalCagr3y
      const roicSpread  = d?.scores?.roic?.spread
      const sector      = d?.quote?.sector ?? ''
      candidates.push({ ticker, price, ourFair, ourUpside, analystTarget, streetUpside, divergence, numAnalysts, impliedG, hist3y, roicSpread, sector })
    } catch { /* skip */ }
  }))

  if (candidates.length < 3) { console.warn('li_divergence: not enough divergent stocks — skipping'); return }

  candidates.sort((a, b) => b.divergence - a.divergence)
  const picks = candidates.slice(0, 3)

  const intro = picks.some(p => p.ourUpside < p.streetUpside)
    ? `3 stocks where our DCF and Wall Street don't agree. The gap is the conversation.`
    : `Our model is more bearish than the Street on each of these. Here's why that matters.`

  const stockLines = picks.flatMap(p => {
    const ourDir    = p.ourUpside > 0 ? `sees ${(p.ourUpside * 100).toFixed(0)}% upside` : `sees ${Math.abs(p.ourUpside * 100).toFixed(0)}% downside`
    const stDir     = p.streetUpside > 0 ? `+${(p.streetUpside * 100).toFixed(0)}%` : `${(p.streetUpside * 100).toFixed(0)}%`
    const roicNote  = p.roicSpread != null
      ? p.roicSpread < -0.02 ? ` ROIC below WACC — that's the tension.`
      : p.roicSpread > 0.08  ? ` ROIC well above WACC — business quality supports the bull case.`
      : ``
      : ``
    const growthNote = p.impliedG != null && p.hist3y != null
      ? ` Market pricing in ${pct(p.impliedG, false)}/yr; historical rate was ${pct(p.hist3y, false)}.`
      : ``
    return [
      `$${p.ticker} — price ${fmt(p.price)}`,
      `Our model: ${fmt(p.ourFair)} (${ourDir}) · Street: ${fmt(p.analystTarget)} (${stDir}, ${p.numAnalysts} analysts)`,
      `${growthNote}${roicNote}`.trim() || null,
      ``,
    ].filter(Boolean)
  })

  const closing = `The divergence isn't a bug — it's the question. Which assumptions are wrong: ours or theirs? Run the model and change the inputs yourself.`

  const lines = [
    intro,
    ``,
    ...stockLines,
    closing,
    ``,
    `Adjust any assumption → insic.app`,
    ``,
    `#DCF #Valuation #Investing #Finance #StockMarket`,
  ]

  await postLinkedIn(lines.join('\n'))
}

// ─── li_weekly_picks ──────────────────────────────────────────────────────────
// Friday 1:00 PM ART. Top 5 most attractively priced stocks from our model
// this week — pure product showcase, drives visits, saves/bookmarks on LinkedIn.

async function runLiWeeklyPicks() {
  const QUALITY_POOL = [
    'MSFT','AMZN','GOOGL','META','NVDA','AAPL','JPM','V','MA','UNH',
    'COST','LLY','AVGO','MRK','PG','HD','KO','PEP','TMO','ABT',
    'ADBE','CRM','NOW','INTU','ORCL','TXN','QCOM','AMD','AMAT','LOW',
    'GS','BAC','MS','BLK','SCHW','AXP','CB','MMC','SPG','PLD',
  ]

  const scored = []
  await Promise.all(QUALITY_POOL.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside   = appUpside(d)
      const fair     = appFairValue(d)
      const price    = d?.quote?.price
      const roicSpread = d?.scores?.roic?.spread
      const piotroski = d?.scores?.piotroski?.score
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y
      const hist3y    = d?.cagrAnalysis?.historicalCagr3y
      const fwdPE     = d?.analystForwardPE
      const sector    = d?.quote?.sector ?? ''
      const recLabel  = (() => {
        const r = d?.analystRecommendation ?? ''
        return r === 'strong_buy' ? 'Strong Buy' : r === 'buy' ? 'Buy' : r === 'hold' ? 'Hold' : null
      })()
      if (!upside || !fair || !price || upside < 0.08) return
      // Quality filter: prefer positive ROIC spread or decent Piotroski
      const qualityOk = (roicSpread != null && roicSpread > -0.02) || (piotroski != null && piotroski >= 5)
      if (!qualityOk) return
      scored.push({ ticker, upside, fair, price, roicSpread, piotroski, analyst1y, hist3y, fwdPE, sector, recLabel })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('li_weekly_picks: not enough data'); return }

  scored.sort((a, b) => b.upside - a.upside)
  const top = scored.slice(0, 5)

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  const sectorSet = [...new Set(top.map(s => s.sector).filter(Boolean))]
  const diverseNote = sectorSet.length >= 4
    ? `Spread across ${sectorSet.length} sectors — not a concentrated bet.`
    : sectorSet.length >= 2 ? `Across ${sectorSet.join(', ')}.` : ``

  const stockLines = top.flatMap((s, i) => {
    const roicNote = s.roicSpread != null && s.roicSpread > 0.04
      ? ` ROIC ${(s.roicSpread * 100).toFixed(0)}pp above WACC.`
      : ``
    const growthNote = s.analyst1y != null
      ? ` Analysts see ${pct(s.analyst1y, false)}/yr growth.`
      : s.hist3y != null ? ` 3Y CAGR ${pct(s.hist3y, false)}.` : ``
    const recNote = s.recLabel && s.recLabel !== 'Hold' ? ` Street says ${s.recLabel}.` : ``
    return [
      `${i + 1}. $${s.ticker} — ${fmt(s.price)} → model fair value ${fmt(s.fair)} (${(s.upside * 100).toFixed(0)}% upside)`,
      `${[growthNote, roicNote, recNote].join('').trim() || null}`,
      ``,
    ].filter(Boolean)
  })

  const lines = [
    `5 attractively priced stocks — week of ${dateStr}`,
    ``,
    `These aren't recommendations. They're the 5 stocks where our DCF model shows the largest gap between price and fair value, filtered for business quality.`,
    ``,
    ...stockLines,
    diverseNote,
    ``,
    `All models are interactive — change WACC, growth rate, or terminal value and see fair value move in real time.`,
    ``,
    `insic.app`,
    ``,
    `#ValueInvesting #DCF #StockPicks #Finance #Investing`,
  ].filter(Boolean)

  await postLinkedIn(lines.join('\n'))
}

// ─── li_myth ──────────────────────────────────────────────────────────────────
// Mon/Wed 11:00 AM ART. Rotating myth-busting posts — highest share rate on
// LinkedIn finance content. Each post challenges a common belief with data.
// Static rotation, no API calls needed — 100% token-free.

const LI_MYTHS = [
  [
    `"Just buy index funds and don't think about valuations."`,
    ``,
    `This advice is fine for most people most of the time. But it contains a hidden assumption: that the index is reasonably priced.`,
    ``,
    `In January 2000, the S&P 500 traded at a cyclically adjusted P/E of 44×. Index investors at that point waited 13 years to break even in real terms.`,
    ``,
    `In March 2009, the same advice — "just buy the index" — would have returned 500%+ over the next decade.`,
    ``,
    `The strategy is identical. The outcome is completely different. The variable is price paid.`,
    ``,
    `Understanding valuation doesn't mean you should avoid index funds. It means you understand what you're buying and at what price. That's always worth knowing.`,
    ``,
    `Current S&P 500 implied growth and fair value breakdown → insic.app`,
    ``,
    `#IndexFunds #ValueInvesting #Finance #Investing`,
  ],
  [
    `"A stock with a high P/E is expensive."`,
    ``,
    `This is one of the most repeated rules in investing — and one of the most misleading.`,
    ``,
    `A P/E ratio tells you what you're paying per dollar of today's earnings. It says nothing about tomorrow's.`,
    ``,
    `A company growing earnings at 30%/yr with a P/E of 35× may be far cheaper than a company with a P/E of 12× and flat earnings.`,
    ``,
    `The metric that actually captures this: PEG ratio (P/E ÷ earnings growth rate). A PEG below 1.0 suggests you're not overpaying for the growth.`,
    ``,
    `Better still: a DCF model. It forces you to make the growth assumption explicit, then discounts it at the appropriate rate. No shortcuts.`,
    ``,
    `High P/E ≠ expensive. Low P/E ≠ cheap. Context is everything.`,
    ``,
    `Run a proper valuation → insic.app`,
    ``,
    `#PERatio #DCF #Valuation #Finance #Investing`,
  ],
  [
    `"Revenue growth is what matters most."`,
    ``,
    `Revenue growth gets the headlines. It's what management teams optimize for in their investor presentations.`,
    ``,
    `But revenue without returns is just activity.`,
    ``,
    `The number that actually matters: ROIC vs WACC.`,
    ``,
    `A company growing at 20%/yr with ROIC of 8% and WACC of 10% is destroying value with every dollar it reinvests. Revenue goes up. Intrinsic value goes down.`,
    ``,
    `A company growing at 8%/yr with ROIC of 25% and WACC of 9% compounds value relentlessly. That 16pp spread means every dollar reinvested creates 16 cents of economic profit.`,
    ``,
    `This is why Buffett focuses on moats — a durable competitive advantage is what sustains ROIC above WACC for a decade or more. That's where wealth is actually created.`,
    ``,
    `Insic.app shows ROIC, WACC, and the spread for every stock. It's one of the first things worth checking.`,
    ``,
    `#ROIC #ValueCreation #Finance #Investing #Buffett`,
  ],
  [
    `"Analysts' price targets tell you where a stock is going."`,
    ``,
    `They don't. Here's what academic research actually shows:`,
    ``,
    `→ Price targets cluster near the current price. Analysts rarely deviate more than 20% — in either direction.`,
    `→ They revise reactively. Target goes up after the stock rises. Down after it falls.`,
    `→ 12-month accuracy is statistically indistinguishable from a coin flip when controlling for momentum.`,
    `→ They reflect consensus by design — the exact opposite of what generates alpha.`,
    ``,
    `None of this means sell-side research is useless. The EPS models, industry analysis, and management channel checks are genuinely valuable inputs.`,
    ``,
    `But the price target number itself? That's a prediction about what other investors will pay in 12 months — not what the business is worth.`,
    ``,
    `DCF intrinsic value asks a different question: if I owned this business forever and collected all its cash flows, what would I pay for it today? That's the more honest frame.`,
    ``,
    `insic.app`,
    ``,
    `#AnalystTargets #DCF #ValueInvesting #Finance`,
  ],
  [
    `"Profitable companies can't go bankrupt."`,
    ``,
    `They can. And they do. More often than most investors expect.`,
    ``,
    `The mechanism: a company can report positive net income while burning cash. Accounting profit ≠ cash flow.`,
    ``,
    `Revenue is recognized when earned. Cash arrives later. If receivables build faster than collections, net income rises while the cash account drains.`,
    ``,
    `The Altman Z-Score was designed precisely for this — it combines five financial ratios to predict financial distress 2 years out. A Z-Score below 1.81 puts a company in the "distress zone" regardless of reported earnings.`,
    ``,
    `The Beneish M-Score is the other side: it detects whether the earnings being reported are real, or the result of aggressive accounting.`,
    ``,
    `Neither score is a sentence. Both are flags worth investigating.`,
    ``,
    `Insic.app shows both scores for every stock in our coverage.`,
    ``,
    `#AltmanZScore #Beneish #FinancialHealth #Investing #Finance`,
  ],
  [
    `"If a stock dropped 50%, it must be a bargain."`,
    ``,
    `One of the most expensive assumptions in investing.`,
    ``,
    `A stock that falls 50% from $100 to $50 needs to double just to get back to where it was.`,
    ``,
    `But the question isn't "where was it?" — it's "what is it worth?"`,
    ``,
    `If the business deteriorated — margins compressed, growth slowed, debt increased — the fair value may now be $30. In that case $50 is still expensive.`,
    ``,
    `If the business is intact and the drop was sentiment-driven, the $50 price might be a genuine opportunity.`,
    ``,
    `The only way to tell the difference: build the model. Look at the FCF, the ROIC trend, the debt load, the growth runway. Don't anchor to the old price.`,
    ``,
    `Price history is irrelevant to intrinsic value. The business fundamentals are not.`,
    ``,
    `insic.app`,
    ``,
    `#ValueInvesting #DCF #Valuation #Finance #Investing`,
  ],
]

async function runLiMyth() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const content = LI_MYTHS[dayOfYear % LI_MYTHS.length]
  await postLinkedIn(content.join('\n'))
}

const MODES = {
  dcf:               runDcf,
  dcf2:              runDcf2,
  insider_buy:       runInsiderBuy,
  low_52w:           run52wLow,
  top_undervalued:   runTopUndervalued,
  market_vs_model:   runMarketVsModel,
  ratio_explained:   runRatioExplained,
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
  holiday_deep_dive: runHolidayDeepDive,
  sector_scan:       runSectorScan,
  li_valuation:      runLiValuation,
  li_market_wrap:    runLiMarketWrap,
  li_deep_dive:      runLiDeepDive,
  li_sector_scan:    runLiSectorScan,
  li_morning_brief:  runLiMorningBrief,
  li_divergence:     runLiDivergence,
  li_weekly_picks:   runLiWeeklyPicks,
  li_myth:           runLiMyth,
}

if (!MODES[MODE]) {
  console.error(`Unknown MODE="${MODE}". Use: ${Object.keys(MODES).join(' | ')}`)
  process.exit(1)
}

// ─── Holiday redirect ─────────────────────────────────────────────────────────
// If today is a US market holiday and this mode depends on live intraday data,
// replace it with a holiday_deep_dive post instead of posting stale/wrong data.
const todayForHolidayCheck = new Date().toISOString().split('T')[0]
if (INTRADAY_MODES.has(MODE) && isMarketHoliday(todayForHolidayCheck)) {
  console.log(`🏖️ Market holiday (${todayForHolidayCheck}): replacing ${MODE} with holiday_deep_dive`)
  try {
    await runHolidayDeepDive()
    console.log(`Done (mode=holiday_deep_dive, original=${MODE})`)
  } catch (err) {
    console.error(`Failed (mode=holiday_deep_dive):`, err.message)
    process.exit(1)
  }
  process.exit(0)
}

try {
  await MODES[MODE]()
  console.log(`Done (mode=${MODE})`)
} catch (err) {
  console.error(`Failed (mode=${MODE}):`, err.message)
  process.exit(1)
}
