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

// ─── Startup validation ───────────────────────────────────────────────────────
// Fail fast with clear error if required secrets are missing.
// This prevents silent failures where posts are quietly skipped.
if (!DRY_RUN) {
  const missing = [
    ['BUFFER_API_KEY',            BUFFER_API_KEY],
    ['BUFFER_CHANNEL_ID',         BUFFER_CHANNEL_ID],
    ['AUTOMATION_API_KEY',        process.env.AUTOMATION_API_KEY],
    ['NEXT_PUBLIC_SUPABASE_URL',  process.env.NEXT_PUBLIC_SUPABASE_URL],
    ['SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY],
  ].filter(([, v]) => !v).map(([k]) => k)
  if (missing.length > 0) {
    console.error(`STARTUP FAILURE: missing required env vars: ${missing.join(', ')}`)
    console.error('Set these secrets in GitHub Actions settings → Secrets and variables → Actions')
    process.exit(1)
  }
  if (!LINKEDIN_CHANNEL_ID) {
    console.warn('WARN: LINKEDIN_CHANNEL_ID not set — all LinkedIn posts will fail')
  }
}

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

  // 5. Percentage values sanity — nothing above ±500% (allows YTD returns like +242%)
  const pcts = [...text.matchAll(/([-+]?\d+\.?\d*)%/g)].map(m => parseFloat(m[1]))
  for (const p of pcts) {
    if (Math.abs(p) > 500) issues.push(`Percentage ${p}% looks unrealistic`)
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
async function post(text, imageUrl = null) {
  validatePost(text)

  if (DRY_RUN) {
    console.log('--- DRY RUN ---')
    console.log(text)
    if (imageUrl) console.log(`Image: ${imageUrl}`)
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
    console.log(`Posted — Buffer post ID: ${result.post.id}${imageUrl ? ' (with image)' : ''}`)
  } else {
    const msg = result?.message ?? JSON.stringify(json)
    // Duplicate post — treat as a skip, not a crash
    if (msg && msg.includes("already got this one scheduled")) {
      console.warn(`Skipping duplicate post (already posted recently)`)
      return
    }
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
    } catch (e) {
      console.error(`_getSupabase: createClient failed — ${e.message}`)
      return null
    }
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

// Derive bear/bull scenarios anchored to the cockpit fair value.
// The raw scenarios.bear/bull are from a single DCF model that can diverge
// wildly from cockpitFairValue (e.g. MU: raw base $117, cockpit $660).
// We apply the raw scenarios' proportional spread to the cockpit base instead,
// so bear/bull are always consistent with the fair value we actually display.
function appScenarios(data) {
  const cockpit  = appFairValue(data)
  const rawBase  = data.scenarios?.base?.fairValue
  const rawBear  = data.scenarios?.bear?.fairValue
  const rawBull  = data.scenarios?.bull?.fairValue
  if (!cockpit || !rawBase || !rawBear || !rawBull || rawBase <= 0) return { bear: null, bull: null }
  // Apply same proportional spread to cockpit fair value
  const bear = cockpit * (rawBear / rawBase)
  const bull = cockpit * (rawBull / rawBase)
  // Sanity: bear < cockpit < bull, and spread > 5%
  if (bear >= cockpit || bull <= cockpit) return { bear: null, bull: null }
  if ((bull - bear) / cockpit < 0.05) return { bear: null, bull: null }
  return { bear: Math.round(bear * 100) / 100, bull: Math.round(bull * 100) / 100 }
}

// Only show bear/bull when they bracket fair value sensibly
function validScenarios(bear, bull, fair) {
  if (!bear || !bull || !fair) return false
  if (bear >= bull) return false
  if (bear >= fair) return false
  return true
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
    const { bear, bull } = appScenarios(data)
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
        ? `At ${fmt(price)}, the stock is pricing in ~${pct(impliedG, false)}/yr growth. The model puts fair value at ${fmt(fair)} (${pct(upside)} from here).`
        : `The model puts fair value at ${fmt(fair)} — ${pct(upside)} vs today's ${fmt(price)}.`
      const line2 = validScenarios(bear, bull, fair)
        ? `Bear case ${fmt(bear)} · bull case ${fmt(bull)}.`
        : null
      const line3 = recLabel && roic != null
        ? `Wall St says ${recLabel}. ROIC at ${pct(roic, false)} — the business earns above its cost of capital.`
        : recLabel ? `Wall St says ${recLabel}.` : null
      const histLine = historicalContext(data, ticker)
      dcfBlock = [line1, line2, line3, histLine].filter(Boolean).join('\n')
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

  const earningsLead = whenStr === 'tomorrow'
    ? `$${ticker} drops earnings tomorrow. Before the number lands, here's where the model stands.`
    : whenStr === 'today'
    ? `$${ticker} reports today. The real question isn't beat or miss — it's whether the business is worth the current price.`
    : `$${ticker} reported yesterday after hours. Now that the dust has settled, what does the model say?`

  const lines = [
    earningsLead,
    ``,
    dcfBlock || `The full picture is at insic.app/stock/${ticker}`,
    ``,
    ...(others.length > 0 ? [`Also reporting: ${others.join(' · ')}`] : []),
    ``,
    `Earnings move the price. Rarely do they change the underlying value by that much.`,
    `insic.app/stock/${ticker}`,
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

// Returns a compact ↳ historical context line for any single-stock post.
// Picks the 1-2 most informative signals available and never shows a blank.
function historicalContext(data, ticker) {
  const price        = data.quote?.price
  const fwdPE        = data.analystForwardPE
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const hist3y       = data.cagrAnalysis?.historicalCagr3y
  const analyst1y    = data.cagrAnalysis?.analystEstimate1y
  const roicSpread   = data.scores?.roic?.spread
  const high52       = data.quote?.fiftyTwoWeekHigh
  const low52        = data.quote?.fiftyTwoWeekLow
  const histMultiples = data.historicalMultiples ?? []
  const histPEs      = histMultiples.map(y => y.pe).filter(v => v != null && v > 0 && v < 200)
  const avgHistPE    = histPEs.length >= 2 ? histPEs.reduce((s, v) => s + v, 0) / histPEs.length : null
  const annualMetrics = data.keyMetricsAnnual ?? []
  const roicHistory  = annualMetrics.map(y => y.roic).filter(v => v != null)
  const roicTrend    = roicHistory.length >= 2
    ? (roicHistory[roicHistory.length - 1] > roicHistory[0] ? 'improving' : 'declining') : null

  const parts = []

  // 1. Valuation vs own history
  if (fwdPE != null && avgHistPE != null) {
    const vs = fwdPE / avgHistPE
    const label = vs > 1.2 ? `above` : vs < 0.82 ? `below` : `in line with`
    parts.push(`Fwd P/E ${label} 3Y avg (${avgHistPE.toFixed(0)}×)`)
  }

  // 2. Implied growth vs historical pace
  if (impliedGrowth != null && hist3y != null) {
    const accel = impliedGrowth > hist3y * 1.15 ? `above` : impliedGrowth < hist3y * 0.8 ? `below` : `in line with`
    parts.push(`Market pricing in ${pct(impliedGrowth, false)}/yr — ${accel} 3Y CAGR of ${pct(hist3y, false)}`)
  } else if (hist3y != null && analyst1y != null) {
    const dir = analyst1y > hist3y * 1.1 ? `accelerating` : analyst1y < hist3y * 0.85 ? `decelerating` : `steady`
    parts.push(`Growth ${dir}: analysts ${pct(analyst1y, false)} vs 3Y CAGR ${pct(hist3y, false)}`)
  } else if (hist3y != null) {
    parts.push(`3Y revenue CAGR: ${pct(hist3y, false)}`)
  }

  // 3. ROIC trend as tiebreaker
  if (parts.length < 2 && roicTrend) parts.push(`ROIC ${roicTrend}`)

  // 4. 52W position
  if (parts.length < 2 && high52 != null && price != null) {
    const fromHigh = ((price - high52) / high52 * 100).toFixed(0)
    if (Number(fromHigh) < -15) parts.push(`${Math.abs(fromHigh)}% off 52W high`)
    else if (low52 != null) {
      const fromLow = ((price - low52) / low52 * 100).toFixed(0)
      if (Number(fromLow) < 20) parts.push(`Near 52W low (${Math.abs(fromLow)}% above)`)
    }
  }

  if (parts.length === 0) return null
  return `↳ ${parts.slice(0, 2).join(' · ')}`
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
    insights.push(`Earns ${pct(roic, false)} on invested capital — ${pct(roicSpread, false)} above its cost of capital`)
  } else if (grossMargin != null && grossMargin > 0.50) {
    const netStr = netMargin != null ? ` · net ${pct(netMargin, false)}` : ''
    insights.push(`Gross margin ${pct(grossMargin, false)}${netStr}`)
  } else if (fcfMargin != null && fcfMargin > 0.15) {
    insights.push(`Free cash flow margin ${pct(fcfMargin, false)} — genuinely cash-generative`)
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
  const { bear, bull } = appScenarios(data)
  const revenueM  = data.businessProfile?.revenueM

  // Build the key insight sentence — the most shareable part
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const impliedStr = impliedGrowth != null
    ? `At ${fmt(price)}, the stock is pricing in ~${pct(impliedGrowth, false)}/yr revenue growth over the next 5 years.`
    : null

  const historicalStr = (data.cagrAnalysis?.historicalCagr3y != null)
    ? `$${ticker}'s actual 3-year annual growth rate: ${pct(data.cagrAnalysis.historicalCagr3y, false)}.`
    : null

  const vsHistorical = (impliedGrowth != null && data.cagrAnalysis?.historicalCagr3y != null)
    ? (impliedGrowth < data.cagrAnalysis.historicalCagr3y * 0.85
        ? `That's below its historical pace — the stock may be underestimating this business.`
        : impliedGrowth > data.cagrAnalysis.historicalCagr3y * 1.15
        ? `That's well above its historical pace — a lot of optimism already in the price.`
        : `Roughly in line with what it's actually delivered.`)
    : null

  const dcfLead = impliedStr
    ? `What's $${ticker}'s stock price actually betting on?`
    : `${v.emoji} $${ticker} — ${v.short}`

  const lines = [
    dcfLead,
    ``,
    ...(impliedStr ? [impliedStr] : []),
    ...(historicalStr ? [historicalStr] : []),
    ...(vsHistorical ? [vsHistorical] : []),
    ...(!impliedStr ? [historicalContext(data, ticker)].filter(Boolean) : []),
    ``,
    `Model fair value ~${fmt(fair)} (${pct(upside)} vs today's price)`,
    ...(validScenarios(bear, bull, fair) ? [`Range: ${fmt(bear)} bear → ${fmt(bull)} bull`] : []),
    ``,
    `Worth stress-testing the assumptions at insic.app/stock/${ticker}`,
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
    ...(tickerMentions.length > 0 ? [`Run the updated model on ${tickerMentions.join(', ')}`, ``] : [`insic.app`, ``]),
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
        `Re-run your models with updated rates`,
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
        `See which stocks benefit most`,
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
        `Re-run your valuations with the new rate`,
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
      `Run your models ahead of the release`,
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
    NFP:  `The most important number in markets drops in ${daysAway} day${daysAway > 1 ? 's' : ''}: NFP.\n\nHere's the bet everyone is making right now without realizing it:\n\nIf payrolls beat: the Fed holds. Rates stay elevated. Growth stocks stay under pressure.\n\nIf payrolls miss: cuts come sooner. Discount rates fall. Every DCF model on a growth stock reprices up — mechanically, not because the business got better.\n\nThe prior month revision matters as much as the headline. Markets trade the trend, not the single print. Two consecutive downward revisions move more than one soft number.`,
    FOMC: `Federal Reserve rate decision in ${daysAway} day${daysAway > 1 ? 's' : ''}.\n\nThe rate decision itself is usually priced in. The real signal is the dot plot (where committee members expect rates to go) and Powell's language on the timing of cuts.\n\nEvery basis point shift in the path of rates flows directly into WACC — and into every fair value estimate.`,
  }
  const lines = [
    `${typeEmoji[upcoming.type] ?? '📅'} ${upcoming.label} — ${daysAway} day${daysAway > 1 ? 's' : ''} away`,
    '',
    upcomingContext[upcoming.type] ?? `${upcoming.label} is ${daysAway} days away.`,
    '',
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
      `Free DCF on any NYSE/NASDAQ stock`,
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
      `WACC breakdown for any stock, free`,
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
      `Growth model for any stock`,
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
      `Bear/base/bull scenarios for any stock`,
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
      `ROIC vs WACC for any stock`,
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
      `Free cash flow to the firm, discounted at WACC. The standard approach for operating businesses with stable capital structures. WACC is calculated from CAPM + country risk premium.`,
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
      `Free for any stock`,
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
      `Worth asking before you invest`,
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

  if (stocks.length === 0) {
    console.warn('No valuation data for weekly wrap — skipping')
    return  // exit 0, not a crash
  }

  // Sort: most undervalued first, most overvalued last — shows the spread
  stocks.sort((a, b) => (b.upside ?? 0) - (a.upside ?? 0))

  const allUndervalued = stocks.every(s => (s.upside ?? 0) > 0.10)
  const allOvervalued  = stocks.every(s => (s.upside ?? 0) < -0.05)

  const lines = []

  if (allUndervalued) {
    lines.push(`The model is bullish on all 3 this week. The market disagrees with at least some of that.`)
  } else if (allOvervalued) {
    lines.push(`3 stocks. All three trading above what the model says they're worth. Make of that what you will.`)
  } else {
    lines.push(`3 stocks. Same model. Very different verdicts.`)
  }
  lines.push(``)

  for (const s of stocks) {
    const v = verdictLabel(s.upside)
    const impliedG = s.data?.valuationMethods?.models?.reverseDcf?.impliedCAGR
    const upsideStr = (s.upside * 100).toFixed(0)
    const direction = s.upside > 0.05 ? `model sees ${upsideStr}% upside` : s.upside < -0.05 ? `model sees ${Math.abs(upsideStr)}% downside` : `model says fair`
    lines.push(`${v.emoji} $${s.ticker} — ${fmt(s.price)} → ${fmt(s.fair)} · ${direction}`)
    if (impliedG != null) lines.push(`   Market pricing in ~${pct(impliedG, false)}/yr annual growth`)
    const hist = s.data ? historicalContext(s.data, s.ticker) : null
    if (hist) lines.push(`   ${hist}`)
    lines.push(``)
  }

  // Check if any stock has extreme downside (>50%) — use more provocative CTA
  const hasExtremeDownside = stocks.some(s => (s.upside ?? 0) < -0.50)
  const hasExtremeUpside   = stocks.some(s => (s.upside ?? 0) > 0.50)
  const closingQ = hasExtremeDownside
    ? `Which one would you bet against?`
    : hasExtremeUpside && allUndervalued
    ? `Which one would you add to first?`
    : `Which one would you bet on?`

  lines.push(closingQ)
  lines.push(``)
  // link removed — no card
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
    `Check what any stock is implying`,
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
    `See the full reverse DCF insic.app/stock/NVDA`,
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
    `Free model for any stock`,
    `#DCF #ValueInvesting #Investing`,
  ],
  [
    `Be honest: do you know what growth rate is already priced into the stocks you own?`,
    ``,
    `Most people don't. They buy because the chart looks good, or because someone said it's a great company.`,
    ``,
    `"Great company" and "great investment at this price" are two completely different things.`,
    ``,
    `Check the implied growth for any stock`,
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
  const { bear, bull } = appScenarios(data)
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

  // What is the stock price betting on?
  const impliedStr = impliedGrowth != null
    ? `At ${fmt(price)}, the stock is pricing in ~${pct(impliedGrowth, false)}/yr revenue growth over 5 years.`
    : null

  const historicalStr = historicalCagr != null
    ? `$${ticker}'s actual 3-year annual growth rate: ${pct(historicalCagr, false)}.`
    : null

  // The provocative take — the gap between implied and historical
  const take = (() => {
    if (impliedGrowth == null || historicalCagr == null) {
      return upside > 0.20
        ? `The model sees ${pct(upside)} of upside the market hasn't priced in.`
        : upside < -0.20
        ? `The model says the stock is overpriced by ${pct(Math.abs(upside))}. That's a meaningful gap.`
        : `Model and market are broadly in agreement here.`
    }
    const ratio = impliedGrowth / historicalCagr
    if (ratio > 1.3)  return `To justify ${fmt(price)}, $${ticker} needs to grow faster than it ever has. That's the bet.`
    if (ratio < 0.7)  return `The stock is pricing in a slowdown well below $${ticker}'s historical pace. Is the pessimism justified, or is this an opportunity?`
    return `Implied growth is roughly in line with history. Whether that's sustainable is the real question.`
  })()

  const comparedToAnalysts = recLabel && analyst1y != null && numAnalysts >= 5
    ? `${numAnalysts} analysts expect ${pct(analyst1y, false)}/yr growth and rate it ${recLabel}.`
    : null

  const lines = [
    impliedStr ? `What is $${ticker}'s stock price actually betting on?` : `${v.emoji} $${ticker} — ${v.short}`,
    ``,
    ...(impliedStr ? [impliedStr] : []),
    ...(historicalStr ? [historicalStr] : []),
    ...(take ? [take] : []),
    ``,
    ...(comparedToAnalysts ? [comparedToAnalysts] : []),
    `Model fair value ~${fmt(fair)} (${pct(upside)} vs today's price)`,
    ...(validScenarios(bear, bull, fair) ? [`Range: ${fmt(bear)} → ${fmt(bull)}`] : []),
    ``,
    `One of the oldest questions in markets — is the price right?`,
    `insic.app/stock/${ticker}`,
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
    // Add a context line if QQQ and IWM diverge significantly — that's the real insight
    if (qqq && iwm && Math.abs(qqq.changePct - iwm.changePct) > 1.0) {
      const spread = (qqq.changePct - iwm.changePct).toFixed(1)
      const note = qqq.changePct > iwm.changePct
        ? `Tech (QQQ) leading small caps (IWM) by ${spread}pp. Growth appetite is selective today — not broad-based.`
        : `Small caps (IWM) leading tech (QQQ) by ${Math.abs(Number(spread)).toFixed(1)}pp. Risk appetite is rotating toward cyclicals, not just megacap names.`
      lines.push(``, note)
    }
    // link removed — no card
    lines.push(`#SPY #QQQ #ETF #Markets #Investing`)

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
    // link removed — no card
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
    `Review your positions this weekend`,
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
    `Build your process`,
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

  lines.push(``, `#WeekAhead #Investing #DCF #StockMarket`)

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

  // Lead with the brand hook — the question that frames the whole account's purpose
  // Followed by specific market data. Closing note is session-specific, not repeated daily.
  const openingHook = spyMove > 1.0
    ? `The price moved. Did the value? Strong open — S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% — but a green tape is not a thesis.`
    : spyMove > 0
    ? `The price moved. Did the value? S&P 500 ${spyMove >= 0 ? '+' : ''}${spyMove.toFixed(1)}% to start.`
    : spyMove > -0.5
    ? `The price moved. Did the value? Markets nearly flat — low-conviction morning.`
    : `The price moved. Did the value? S&P ${spyMove.toFixed(1)}% — sellers have the early edge.`

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
    if (e.type === 'FOMC') return `🏦 FOMC decision today. Consensus says no change, but the dot plot and Powell's tone on cut timing is what actually moves markets — any shift in forward guidance ripples straight through discount rates and equity valuations.`
    if (e.type === 'CPI')  return `📊 CPI print this morning. Above expectations keeps rates elevated and compresses fair values. Below expectations opens the path to cuts and lifts growth stocks. Both move DCF assumptions.`
    if (e.type === 'NFP')  return `💼 Payrolls this morning. A strong number pushes back rate cuts. Check the prior month revision — it often tells a different story than the headline.`
    return `📅 ${e.label} today.`
  })

  const earningsNarrative = earningsTickers.length > 0 ? (() => {
    const names = earningsTickers.slice(0, 4).map(t => `$${t.symbol}`)
    const str = names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names.at(-1)
    return `📊 ${str} ${names.length === 1 ? 'reports' : 'report'} today. Beat or miss matters less than whether the result justifies the current valuation.`
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

  const lines = [openingHook + vixNote]
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
    lines.push(``, `On the earnings calendar this week:`)
    for (const [date, tickers] of Object.entries(byDate)) {
      const dayLabel = new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      lines.push(`→ ${dayLabel}: ${tickers.join(' · ')}`)
    }
  }

  if (tomorrowNote) lines.push(``, tomorrowNote)

  // link removed — no card
  lines.push(`#Markets #Investing #DCF`)

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
    const gap = (best.changePct - worst.changePct).toFixed(1)
    if (riskOn && defBad) return `${best.name} up, defensives lagging — ${gap}pp spread. Before calling this risk-on: check whether it's rate-driven (rising 10Y = utilities/healthcare sell off mechanically) or true growth appetite. They look the same in the data, but they're different signals.`
    if (!riskOn && defBad === false) return `Defensive rotation underway — ${best.name} leads while ${worst.name} lags. Market is hedging, not expanding.`
    return `${best.name} leads (+${best.changePct.toFixed(1)}%), ${worst.name} lags (${worst.changePct.toFixed(1)}%). ${gap}pp spread — watch whether this holds into the close.`
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
    if (e.type === 'FOMC') return `🏦 Fed decision this afternoon — everything on hold until Powell speaks.`
    if (e.type === 'CPI')  return `📊 CPI is in — reprices the rate path and every growth stock with it.`
    if (e.type === 'NFP')  return `💼 Jobs data out this morning — rate cut path updated.`
    return `📅 ${e.label} today.`
  })

  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const hooks = [
    'Halfway through. Anything shifting the thesis?',
    "What's driving this rotation — sentiment or fundamentals?",
    "Midday check. What's standing out to you?",
    'Rotation is speaking. Is your model listening?',
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

  lines.push(``, hooks[weekOfYear % hooks.length])
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
      if (e.type === 'FOMC') items.push(`🏦 Fed rate decision tomorrow — everything moves on the statement`)
      if (e.type === 'CPI')  items.push(`📊 CPI tomorrow — will reshape expectations on where rates go from here`)
      if (e.type === 'NFP')  items.push(`💼 Jobs report tomorrow — strong number = fewer cuts, weak number = risk off`)
    })
    if (tnx && tnx.price >= 4.4) items.push(`10Y at ${tnx.price.toFixed(2)}% — if it breaks ${(Math.ceil(tnx.price * 10) / 10).toFixed(1)}%, growth stocks will feel it`)
    if (vix && vix.price >= 20)  items.push(`VIX ${vix.price.toFixed(1)} — don't size up until volatility settles`)
    if (items.length === 0) items.push(`No major catalysts tomorrow. Tape-driven.`)
    return items
  })()

  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const hooks = [
    `The tape closed. The model didn't change. Check which of your positions moved on price vs. fundamentals.`,
    `Worth running the model after a session like this — insic.app`,
    `The market priced something in today. Was it already in your model? insic.app`,
    `Some of these moves will matter. Most won't. Hard part is knowing which. insic.app`,
  ]

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const indexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    indexLine,
    vix ? `VIX ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label.toLowerCase()}` : null,
    ``,
  ].filter(Boolean)

  if (sectorData.length > 0) {
    sectorData.forEach(s => {
      const e = s.changePct >= 1 ? '▲' : s.changePct <= -1 ? '▼' : '→'
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
    lines.push(``)
    watchTomorrow.forEach(w => lines.push(w))
  }

  lines.push(``, hooks[weekOfYear % hooks.length])
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
  // Provides a mental framework for interpreting the open — not just descriptive
  const processNote = spChg > 1.0
    ? `Strong open. Before acting: what actually changed in the fundamentals? A green tape isn't a thesis. A rising price can mean opportunity missed or overvaluation widening — depends on whether value moved with it.`
    : spChg > 0.2
    ? `Positive start. Check whether today's move changes anything in your models, or whether it's the tape making noise without signal.`
    : spChg > -0.2
    ? `Flat open. Low conviction day. The best time to update assumptions is when nothing is happening — not when a catalyst forces your hand.`
    : spChg > -1.0
    ? `Soft open, risk-off tone. If defensives are leading, rate expectations may be quietly shifting — that changes WACC before anyone announces it.`
    : `Risk-off open. The model doesn't panic. Ask which of your positions moved on fundamentals vs. fear — those are different situations.`

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const indexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    `${openEmoji} NYSE open — ${dayName}`,
    ``,
    indexLine,
    vix ? `VIX ${vix.price.toFixed(1)} — ${vixSentiment(vix.price).label.toLowerCase()}` : null,
    ``,
    processNote,
    ``,
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
  XLK: 'Tech leading. Is it rate-driven or earnings-driven? Those are two different stories. Rate relief lifts valuations mechanically. Earnings momentum has to keep delivering.',
  XLE: 'Energy outperforming. Check whether it\'s an oil supply story or a geopolitical premium. For integrated majors, free cash flow at current crude prices is what justifies the multiple.',
  XLF: 'Financials leading — usually the market pricing in a steeper yield curve or better credit. Higher rates help bank margins, but the same rates make every other sector\'s discount calculation harder.',
  XLV: 'Healthcare bid. Defensives leading means the market is hedging. Either growth expectations are getting trimmed or macro risk is rising. Both compress what investors will pay for riskier names.',
  XLU: 'Utilities leading — classic rate-cut signal. The market is front-running lower rates. Lower cost of capital mechanically increases fair value on long-duration assets.',
  XLI: 'Industrials up — cyclical leadership. Usually confirms GDP expectations are stable or rising. Good environment for capex-heavy businesses where returns on invested capital exceed the cost of capital.',
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
      const e = s.changePct >= 1 ? '▲' : s.changePct <= -1 ? '▼' : '→'
      return `${e} ${sectorName[s.symbol] ?? s.symbol} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`
    }),
    ``,
    gapStr,
    stocks.length > 0 ? `Names moving in ${sectorName[best.symbol]}: ${stocks.slice(0, 3).map(t => `$${t}`).join(' · ')}` : null,
    ``,
    `Which sector holds up at current valuations? insic.app/etf`,
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
  const { bear, bull } = appScenarios(data)

  if (!price || !fair) throw new Error(`No price/fair value for ${ticker}`)

  // dcf2 angle: stress-test framing — what has to go RIGHT for this price to make sense
  const impliedGrowth = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const historicalCagr = data.cagrAnalysis?.historicalCagr3y

  // If bear/bull range is unusually wide, make that the story — it IS the insight
  const bearBullRange = validScenarios(bear, bull, fair) ? (bull - bear) / fair : 0
  const isWideRange = bearBullRange > 1.0  // more than 100% spread vs base = unusually wide

  const stressTest = (() => {
    if (isWideRange && validScenarios(bear, bull, fair)) {
      const bearPct = ((bear - price) / price * 100).toFixed(0)
      const bullPct = ((bull - price) / price * 100).toFixed(0)
      const spreadMultiple = (bull / bear).toFixed(1)
      return `$${ticker} has one of the widest scenario spreads in our model.\n\nBear case: ${fmt(bear)} — ${bearPct}% from here.\nBull case: ${fmt(bull)} — +${bullPct}% from here.\n\nThat's a ${spreadMultiple}× gap between outcomes. Not because the model is uncertain — because the business genuinely sits at a fork in the road.`
    }
    if (upside < -0.15 && impliedGrowth != null) {
      return `For $${ticker} at ${fmt(price)} to be fairly valued, you need ~${pct(impliedGrowth, false)}/yr revenue growth for 5 years. Is that realistic?`
    }
    if (upside > 0.20 && impliedGrowth != null) {
      return `$${ticker} at ${fmt(price)} is only pricing in ~${pct(impliedGrowth, false)}/yr growth — well below what this business has historically delivered.`
    }
    if (validScenarios(bear, bull, fair)) {
      return `Bear case ${fmt(bear)} (${pct((bear - price) / price)}). Bull case ${fmt(bull)} (${pct((bull - price) / price)}). Where do you sit?`
    }
    return `Model fair value ${fmt(fair)}. It disagrees with the market by ${pct(Math.abs(upside))}.`
  })()

  const qualityNote = (() => {
    if (roic != null && roicSpread != null && roicSpread > 0.08)
      return `Earns ${pct(roic, false)} on invested capital — ${pct(roicSpread, false)} above its cost of capital. The business consistently creates value.`
    if (grossM != null && grossM > 0.60)
      return `Gross margin of ${pct(grossM, false)} — real pricing power here.`
    if (netM != null && netM < 0 && upside > 0)
      return `Still loss-making (net margin ${pct(netM, false)}), but the growth assumptions carry a path to profitability.`
    return null
  })()

  const lines = [
    stressTest,
    ``,
    ...(historicalCagr != null ? [`$${ticker}'s actual 3-year annual growth rate: ${pct(historicalCagr, false)}.`] : []),
    ...(qualityNote ? [qualityNote] : []),
    ``,
    ...(recLabel ? [`Wall St: ${recLabel}${analyst1y != null && numAnalysts >= 3 ? ` · ${numAnalysts} analysts expect ${pct(analyst1y, false)}/yr growth` : ''}`] : []),
    `Model fair value ${fmt(fair)} (${pct(upside)})${validScenarios(bear, bull, fair) && !isWideRange ? ` · range ${fmt(bear)}–${fmt(bull)}` : ''}`,
    ``,
    `insic.app/stock/${ticker}`,
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
  // More specific closing signal — references the actual tape dynamic, not just direction
  const lateSignal = Math.abs(spChg) > 1.0
    ? spChg > 0
      ? `Strong buyers into the close. When gains hold this well into the final 30 minutes, there's conviction — or at least no one selling into strength. Check whether today's move reflects a change in business value or just a change in appetite.`
      : `Sellers maintaining pressure with 30 minutes left. Price is moving. Whether value moved is the question that will matter tomorrow.`
    : Math.abs(spChg) > 0.3
    ? spChg > 0 ? `Buyers holding control into the close, but muted. The tape isn't making a strong statement today.`
      : `Soft close shaping up. Choppy sessions are where assumptions get tested quietly.`
    : `Indecisive session. Close will set the tone for tomorrow's open — watch whether the last 30 minutes adds conviction in either direction.`

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
  const nqChg = nasdaq?.changePct ?? 0

  // Lead with the sector story, not the index number — more informative for after-hours
  const sectorStory = (() => {
    if (Math.abs(nqChg - spChg) > 1.0) {
      return nqChg > spChg
        ? `Tech outpaced the broader market by ${(nqChg - spChg).toFixed(1)}pp. Growth buyers were active; rate-sensitive names stayed flat.`
        : `Tech underperformed the broader tape by ${(spChg - nqChg).toFixed(1)}pp. Rotation into value was the story today.`
    }
    if (spChg > 1.0) return `Broad-based buying. Every major index closed positive — risk appetite held all session.`
    if (spChg > 0.1) return `Markets edged higher. No single catalyst — tape-driven gains into the close.`
    if (spChg > -0.1) return `Flat close. Market digesting recent moves with no clear conviction in either direction.`
    if (spChg > -1.0) return `Sellers had a slight edge today. Defensives outperformed; cyclicals lagged.`
    return `Heavy selling session. Risk-off tone dominated — check which positions moved on fundamentals vs. sentiment.`
  })()

  const sp = sp500 ? `S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const ahIndexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    ahIndexLine,
    ``,
    sectorStory,
  ]

  if (todayEarners.length > 0) {
    lines.push(``, `Reporting tonight: ${todayEarners.map(t => `$${t.symbol}`).join(' · ')}`)
    lines.push(`The consensus is already priced in. What matters is the guide — and whether the business trajectory changed.`)
  }

  if (tomorrowEarners.length > 0) {
    lines.push(``, `Up tomorrow: ${tomorrowEarners.map(t => `$${t.symbol}`).join(' · ')}`)
  }

  if (macroTomorrow.length > 0) {
    lines.push(``, `Tomorrow: ${macroTomorrow.map(e => e.label).join(' · ')}`)
  } else if (todayEarners.length === 0 && tomorrowEarners.length === 0) {
    lines.push(``, `Nothing on the calendar overnight. Tomorrow's tape is tape-driven — price action without a catalyst is the hardest to read.`)
  }

  lines.push(``, `#AfterHours #Markets #Investing`)

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

// ─── Queue-aware execution ────────────────────────────────────────────────────
// Claims a post_queue row atomically, runs the mode, posts, marks done.
// Falls back to the legacy posted_tweet_events path when no queue row exists.
//
// Error classification for post_queue.failure_reason:
//   config_error  — missing env vars, unconfigured channel
//   content_error — no data found, validatePost rejection
//   api_error     — Buffer/LinkedIn API returned an error
//   unknown       — anything else

function classifyError(err) {
  const msg = err.message || ''
  if (msg.includes('not configured') || msg.includes('missing') || msg.includes('CHANNEL_ID')) return 'config_error'
  if (msg.includes('No ') || msg.includes('no data') || msg.includes('validatePost') || msg.includes('too long') || msg.includes('empty')) return 'content_error'
  if (msg.includes('Buffer') || msg.includes('LinkedIn') || msg.includes('API') || msg.includes('fetch')) return 'api_error'
  return 'unknown'
}

async function claimAndPost(mode, platform, ticker = '') {
  if (!MODES[mode]) {
    console.error(`Unknown MODE="${mode}". Use: ${Object.keys(MODES).join(' | ')}`)
    process.exit(1)
  }

  const today = new Date().toISOString().split('T')[0]  // YYYY-MM-DD in UTC

  // Holiday redirect for intraday modes — happens before any queue/dedup logic
  if (INTRADAY_MODES.has(mode) && isMarketHoliday(today)) {
    console.log(`Market holiday (${today}): replacing ${mode} with holiday_deep_dive`)
    try {
      await runHolidayDeepDive()
      console.log(`Done (mode=holiday_deep_dive, original=${mode})`)
    } catch (err) {
      console.warn(`holiday_deep_dive failed (non-fatal):`, err.message)
    }
    process.exit(0)
  }

  // ── Queue path ──────────────────────────────────────────────────────────────
  // Idempotency key format: platform:mode:YYYY-MM-DD
  // For DEDUP_EXEMPT modes the key is hourly so multiple posts per day are allowed.
  const DEDUP_EXEMPT = new Set(['earnings_results', 'economic_results', 'holiday_deep_dive'])
  const idempotencyKey = DEDUP_EXEMPT.has(mode)
    ? `${platform}:${mode}:${new Date().toISOString().slice(0, 13)}`  // YYYY-MM-DDTHH
    : `${platform}:${mode}:${today}`

  const sb = await _getSupabase()
  let queueRowId = null

  if (sb && !DRY_RUN) {
    // Attempt atomic claim via RPC
    let claimError = null
    try {
      const { data: claimed, error } = await sb.rpc('claim_post', {
        p_idempotency_key: idempotencyKey,
        p_worker_id: `github-actions-${Date.now()}`,
      })
      if (error) claimError = error
      else if (claimed) {
        queueRowId = claimed.id ?? claimed  // RPC may return the row or just the id
        console.log(`Claimed queue row (id=${queueRowId}) for ${mode} [${platform}]`)
      }
    } catch (rpcErr) {
      claimError = rpcErr
    }

    if (claimError) {
      // RPC failed (function may not exist yet) — fall through to legacy path
      console.warn(`claim_post RPC unavailable (${claimError.message}) — using legacy dedup`)
    }

    if (!queueRowId && !claimError) {
      // Claim returned nothing: either already running/posted, or no queue row.
      // Inspect the row to decide which.
      try {
        const { data: existing } = await sb
          .from('post_queue')
          .select('id, status')
          .eq('idempotency_key', idempotencyKey)
          .maybeSingle()

        if (existing?.status === 'posted') {
          console.log(`Skipping ${mode} — already posted (queue, key: ${idempotencyKey})`)
          process.exit(0)
        }
        if (existing?.status === 'running') {
          // Another worker has it — skip silently
          console.log(`Skipping ${mode} — claimed by another worker (queue, key: ${idempotencyKey})`)
          process.exit(0)
        }
        // existing is null (no queue row) or has some other status — fall through to legacy
        if (existing) {
          console.warn(`Unexpected queue status "${existing.status}" for key ${idempotencyKey} — falling through to legacy`)
        }
      } catch (lookupErr) {
        console.warn(`Queue row lookup failed (${lookupErr.message}) — falling through to legacy`)
      }
    }
  }

  // ── Legacy dedup path (when no queue row was found or Supabase unavailable) ─
  const useLegacy = !queueRowId
  const dedupKey = DEDUP_EXEMPT.has(mode)
    ? `mode:${mode}:${new Date().toISOString().slice(0, 13)}`
    : `mode:${mode}:${today}`

  if (useLegacy && !DRY_RUN) {
    if (!sb) {
      // Supabase client unavailable — post without dedup rather than silently skip.
      // This means a double-fire could duplicate, but silence is worse than an occasional dup.
      console.warn(`Dedup unavailable (Supabase client not loaded) — posting ${mode} without dedup guard.`)
    } else {
      // Atomic claim: INSERT ... ON CONFLICT DO NOTHING.
      // Only the first worker to insert the unique key proceeds; others skip.
      try {
        const { count, error } = await sb
          .from('posted_tweet_events')
          .insert({ event_key: dedupKey, tweet_type: mode, ticker: ticker || null, event_date: today, tweet_text: '' })
          .select('id', { count: 'exact', head: true })
        if (error) {
          if (error.code === '23505') {
            console.log(`Skipping ${mode} — already claimed (legacy, key: ${dedupKey})`)
            process.exit(0)
          }
          // Other DB error — post without dedup rather than silently skip
          console.warn(`Dedup insert failed (${error.message}) — posting ${mode} without dedup guard.`)
        } else if (count === 0) {
          console.log(`Skipping ${mode} — already posted (legacy, key: ${dedupKey})`)
          process.exit(0)
        } else {
          console.log(`Claimed dedup slot for ${mode} (key: ${dedupKey})`)
        }
      } catch (dbErr) {
        // DB unreachable — post without dedup rather than silently skip
        console.warn(`Dedup check failed (${dbErr.message}) — posting ${mode} without dedup guard.`)
      }
    }
  }

  // ── Run mode + post ─────────────────────────────────────────────────────────
  // MODES[mode]() is responsible for calling post() or postLinkedIn() internally.
  // The platform argument here is informational — each mode function already knows
  // which channel to post to. We do not call post()/postLinkedIn() again here.
  try {
    await MODES[mode]()

    // ── Mark success ──────────────────────────────────────────────────────────
    if (!DRY_RUN) {
      if (queueRowId && sb) {
        // Update queue row to posted
        try {
          await sb
            .from('post_queue')
            .update({ status: 'posted', posted_at: new Date().toISOString() })
            .eq('id', queueRowId)
        } catch (markErr) {
          console.error(`WARN: post succeeded but queue mark failed (id=${queueRowId}): ${markErr.message}`)
          // Best-effort legacy mark to prevent duplicate next run
          try { await markPostedEvent(dedupKey, mode, ticker || null, today, '') } catch { /* ignore */ }
        }
      } else {
        // Legacy path: dedup slot was claimed pre-post (atomic insert above).
        // Update tweet_text now that we have it (best-effort, not critical).
        try {
          await sb.from('posted_tweet_events')
            .update({ tweet_text: '[posted]' })
            .eq('event_key', dedupKey)
        } catch { /* ignore — slot is already claimed, tweet_text is cosmetic */ }
      }
    }

    console.log(`Done (mode=${mode}, platform=${platform})`)

  } catch (err) {
    // Real failure — exit 1 so GitHub marks the run red
    console.error(`FAILED (mode=${mode}): ${err.message}`)

    if (!DRY_RUN) {
      const failureReason = classifyError(err)

      if (queueRowId && sb) {
        // Update queue row to failed with classification
        try {
          await sb
            .from('post_queue')
            .update({
              status: 'failed',
              failure_reason: failureReason,
              error_message: err.message.slice(0, 500),
              failed_at: new Date().toISOString(),
            })
            .eq('id', queueRowId)
        } catch { /* don't let failure recorder block exit */ }
      } else if (useLegacy && sb) {
        // Legacy path: release the dedup slot so retries can work.
        // We inserted pre-post; on failure we must delete so next run can try again.
        try {
          await sb.from('posted_tweet_events').delete().eq('event_key', dedupKey)
        } catch { /* don't let cleanup block exit */ }
      }
    }

    process.exit(1)
  }
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
      `Did the business actually change, or just the price? Fair value insic.app/stock/${c.ticker}`,
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
  {
    name: 'Energy & Oil',
    emoji: '⛽',
    tickers: ['XOM', 'CVX', 'COP', 'EOG', 'SLB', 'MPC', 'PSX', 'OXY'],
    context: 'Energy stocks are cheap on current earnings — but the multiple reflects commodity risk, not business quality. The real question is what oil price is priced in, and whether the FCF survives a down-cycle.',
    hashtags: '#Energy #OilStocks #Commodities',
  },
  {
    name: 'Industrial & Aerospace',
    emoji: '✈️',
    tickers: ['HON', 'GE', 'RTX', 'LMT', 'NOC', 'CAT', 'DE', 'EMR'],
    context: 'Industrials are boring until they\'re not. Defense names carry geopolitical premiums, capital equipment names are cyclical, and the FCF margins vary wildly. ROIC is the signal here.',
    hashtags: '#Industrials #Aerospace #Defense',
  },
  {
    name: 'Electric Vehicles & Clean Energy',
    emoji: '⚡',
    tickers: ['TSLA', 'RIVN', 'F', 'GM', 'ENPH', 'NEE', 'CEG', 'PLUG'],
    context: 'EV and clean energy stocks split into two camps: established players repricing on execution risk, and pure-plays that haven\'t yet proven their unit economics. DCF is brutally honest here.',
    hashtags: '#EV #CleanEnergy #Tesla',
  },
  {
    name: 'SaaS & Enterprise Software',
    emoji: '📦',
    tickers: ['MSFT', 'CRM', 'NOW', 'ADBE', 'INTU', 'WDAY', 'SNOW', 'MDB'],
    context: 'SaaS multiples compress fast when growth slows. Rule of 40 (growth + FCF margin) is the lens — businesses above 40 deserve a premium. Which names still clear the bar?',
    hashtags: '#SaaS #Software #TechStocks',
  },
  {
    name: 'Healthcare & Managed Care',
    emoji: '🏥',
    tickers: ['UNH', 'CVS', 'HUM', 'CI', 'MCK', 'TMO', 'DHR', 'SYK'],
    context: 'Healthcare splits between defensive compounders and managed-care names facing political and cost pressures. High FCF margins meet regulatory risk — the discount rate is doing a lot of work here.',
    hashtags: '#Healthcare #ManagedCare #MedTech',
  },
  {
    name: 'Real Estate & REITs',
    emoji: '🏢',
    tickers: ['PLD', 'AMT', 'EQIX', 'SPG', 'O', 'PSA', 'WELL', 'CCI'],
    context: 'REITs are rate-sensitive by design — when the 10Y yield moves, their discount rates move with it. The spread between cap rate and WACC is everything. Duration matters more here than in any other sector.',
    hashtags: '#REITs #RealEstate #Investing',
  },
  {
    name: 'Luxury & Premium Consumer',
    emoji: '💎',
    tickers: ['LVMHF', 'CFRUY', 'MONRF', 'RMS', 'TPR', 'RL', 'PVH', 'VFC'],
    context: 'Luxury brands trade on pricing power and brand moat — metrics standard DCF models undervalue. The question is whether aspirational demand holds up in a slower consumer environment.',
    hashtags: '#Luxury #PremiumBrands #Consumer',
  },
  {
    name: 'Warren Buffett Portfolio',
    emoji: '🎩',
    tickers: ['AAPL', 'BAC', 'AXP', 'KO', 'CVX', 'OXY', 'MCO', 'KHC'],
    context: 'Berkshire\'s top holdings run through the same DCF engine. Buffett buys businesses with durable competitive advantages at fair prices. How do his current holdings score on our model?',
    hashtags: '#Buffett #Berkshire #ValueInvesting',
  },
  {
    name: 'Dividend Compounders',
    emoji: '💰',
    tickers: ['JNJ', 'PG', 'KO', 'PEP', 'MMM', 'T', 'VZ', 'MCD'],
    context: 'Dividend stocks are often framed as "safe." They\'re not — they\'re a different risk profile. The question is whether the payout ratio is sustainable and whether the business can grow the dividend faster than inflation.',
    hashtags: '#Dividends #IncomeInvesting #ValueInvesting',
  },
  {
    name: 'Cybersecurity',
    emoji: '🔒',
    tickers: ['CRWD', 'PANW', 'ZS', 'FTNT', 'S', 'OKTA', 'CYBR', 'RPM'],
    context: 'Cybersecurity spend is one of the few categories that\'s genuinely non-discretionary — which is why multiples are elevated. The divide is between profitable compounders and growth names still burning cash.',
    hashtags: '#Cybersecurity #InfoSec #TechStocks',
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
      const fcfM   = d.baseFCF
      const shares = d.quote?.sharesOutstanding
      if (fcfM != null && shares && shares > 0) {
        const fcfPerShare = (fcfM * 1e6) / (shares * 1e6)
        return fcfPerShare > 0 ? price / fcfPerShare : null
      }
      return null
    })()
    const revGrowth  = d.cagrAnalysis?.analystEstimate1y ?? null
    const hist3y     = d.cagrAnalysis?.historicalCagr3y  ?? null
    const roicSpread = d.scores?.roic?.spread ?? null
    const fair       = appFairValue(d)
    const upside     = appUpside(d)
    const high52     = d.quote?.fiftyTwoWeekHigh ?? null
    const low52      = d.quote?.fiftyTwoWeekLow  ?? null

    // Historical P/E average from last 3 years of historicalMultiples
    const histMultiples = d.historicalMultiples ?? []
    const histPEs = histMultiples.map(y => y.pe).filter(v => v != null && v > 0 && v < 200)
    const avgHistPE = histPEs.length >= 2
      ? histPEs.reduce((s, v) => s + v, 0) / histPEs.length
      : null

    // Historical EV/EBITDA average
    const histEvEb = histMultiples.map(y => y.evEbitda).filter(v => v != null && v > 0 && v < 500)
    const avgHistEvEb = histEvEb.length >= 2
      ? histEvEb.reduce((s, v) => s + v, 0) / histEvEb.length
      : null

    // Historical ROIC trend from keyMetricsAnnual
    const annualMetrics = d.keyMetricsAnnual ?? []
    const roicHistory = annualMetrics.map(y => y.roic).filter(v => v != null)
    const roicTrend = roicHistory.length >= 2
      ? (roicHistory[roicHistory.length - 1] > roicHistory[0] ? 'improving' : 'declining')
      : null

    if (!price || !fwdPE) continue

    const v = verdictLabel(upside ?? 0)
    rows.push({
      ticker, price, fwdPE, evEbitda, evRevenue, pfcf,
      revGrowth, hist3y, roicSpread, fair, upside, v,
      high52, low52, avgHistPE, avgHistEvEb, roicTrend,
    })
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

  // Each stock: current metrics + one historical context line where available
  const tableLines = rows.map(r => {
    const parts = [`${r.v.emoji} $${r.ticker}`]
    parts.push(`Fwd P/E: ${r.fwdPE.toFixed(0)}×`)
    if (multipleKey && r[multipleKey] != null) parts.push(`${multipleLabel}: ${r[multipleKey].toFixed(1)}×`)
    if (showGrowth && r.revGrowth  != null) parts.push(`Rev growth: +${(r.revGrowth * 100).toFixed(0)}%`)
    if (showROIC   && r.roicSpread != null) parts.push(`ROIC spread: ${r.roicSpread >= 0 ? '+' : ''}${(r.roicSpread * 100).toFixed(0)}pp`)
    if (r.upside != null) parts.push(`${r.v.short} (${r.upside >= 0 ? '+' : ''}${(r.upside * 100).toFixed(0)}%)`)

    // Historical context — pick the most informative one available
    const histParts = []
    if (r.avgHistPE != null) {
      const vs = r.fwdPE / r.avgHistPE
      const label = vs > 1.15 ? `above` : vs < 0.85 ? `below` : `in line with`
      histParts.push(`Fwd P/E ${label} 3Y avg (${r.avgHistPE.toFixed(0)}×)`)
    }
    if (r.hist3y != null && r.revGrowth != null) {
      const accel = r.revGrowth > r.hist3y * 1.1 ? `accelerating vs` : r.revGrowth < r.hist3y * 0.85 ? `decelerating vs` : `in line with`
      histParts.push(`growth ${accel} 3Y CAGR of +${(r.hist3y * 100).toFixed(0)}%`)
    } else if (r.hist3y != null) {
      histParts.push(`3Y revenue CAGR: +${(r.hist3y * 100).toFixed(0)}%`)
    }
    if (r.roicTrend) histParts.push(`ROIC ${r.roicTrend}`)
    if (r.high52 != null && r.low52 != null && r.price != null) {
      const fromHigh = ((r.price - r.high52) / r.high52 * 100).toFixed(0)
      if (Number(fromHigh) < -15) histParts.push(`${Math.abs(fromHigh)}% off 52W high`)
    }

    const histLine = histParts.length > 0 ? `  ↳ ${histParts.slice(0, 2).join(' · ')}` : null

    return [parts.join(' · '), histLine].filter(Boolean).join('\n')
  })

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
    ``,
    ...insights,
    ``,
    `Full interactive models`,
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
    `Insiders buy for all kinds of reasons. They only sell for one.`,
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
    `$${ticker} is ${pctFrom52Low}% off its 52-week low. The business is still there — the question is whether the price reflects it.`,
    ``,
    fair && upside != null
      ? `Our DCF puts fair value at ${fmt(fair)} — that's ${upside >= 0 ? `${(upside * 100).toFixed(0)}% above` : `${Math.abs(upside * 100).toFixed(0)}% below`} where it trades today.`
      : null,
    fcfM != null ? `Free cash flow margin: ${pct(fcfM, false)}. Still generating cash despite the weakness.` : null,
    roic != null && roic > 0 ? `ROIC ${pct(roic, false)} — nothing's broken at the operating level.` : null,
    data ? historicalContext(data, ticker) : null,
    ``,
    `Price and value diverge all the time. The gap closes eventually — one way or the other.`,
    ``,
    `insic.app/stock/${ticker}`,
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
      if (upside < 0.05) return
      const sector = d?.quote?.sector ?? ''
      const grade  = d?.ratings?.overall?.grade ?? ''
      scored.push({ ticker, upside, fair, price, sector, grade, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('Not enough undervalued stocks found'); return }

  scored.sort((a, b) => b.upside - a.upside)
  const top = scored.slice(0, 5)

  const stockLines = top.flatMap((s, i) => {
    const hist = historicalContext(s.d, s.ticker)
    return [
      `${i + 1}. $${s.ticker} — ${fmt(s.price)} → model: ${fmt(s.fair)} (${pct(s.upside)})`,
      hist ? `   ${hist}` : null,
    ].filter(Boolean)
  })

  const topStock = top[0]
  const biggestUpside = (topStock.upside * 100).toFixed(0)

  const lines = [
    `The 5 most undervalued names from our DCF model right now. $${topStock.ticker} leads — ${biggestUpside}% gap between price and model fair value.`,
    ``,
    ...stockLines,
    ``,
    `Model outputs, not financial advice — but the gap is real. The model says these are cheap. The market disagrees. One of them is right.`,
    ``,
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
      ? `Our DCF on $${ticker} is more bullish than ${c.numAnalysts} analysts. By ${gapPct}%.`
      : `${c.numAnalysts} analysts think $${ticker} is worth more than our model does. The gap is ${gapPct}%.`,
    ``,
    `Our model: ${fmt(c.ourFair)} (${c.ourUpside >= 0 ? '+' : ''}${(c.ourUpside * 100).toFixed(0)}%)`,
    `Street consensus: ${fmt(c.analystTarget)} (${c.analystUpside >= 0 ? '+' : ''}${(c.analystUpside * 100).toFixed(0)}%)`,
    ``,
    growthContext,
    c.d ? historicalContext(c.d, ticker) : null,
    ourIsHigher
      ? `Analysts tend to anchor to near-term numbers. DCF captures the longer arc. If the model's right, there's a gap worth exploring.`
      : `If our growth assumptions are too conservative, the Street wins. If they're too generous, the consensus target doesn't hold. Worth stress-testing either way.`,
    ``,
    `Run the assumptions yourself insic.app/stock/${ticker}`,
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
      `(Live data temporarily unavailable — check insic.app/stock/${anchorTicker} for current numbers.)`,
    ]
  }

  const lines = [
    `${meta.emoji} ${meta.name} — explained with a real example ($${anchorTicker})`,
    ``,
    ...bodyLines,
    ``,
    `See every ratio for any stock, free insic.app/stock/${anchorTicker}`,
    meta.hashtags,
  ].filter(l => l !== null && l !== undefined)

  await post(lines.join('\n'))
}

// ─── LinkedIn posting ─────────────────────────────────────────────────────────
// Separate post() function for LinkedIn — same Buffer API, different channel ID.
// LinkedIn audience: finance professionals, investors, career-oriented.
// Format: longer, more narrative, no character limits, hashtags at end only.

async function postLinkedIn(text, imageUrl = null) {
  if (!LINKEDIN_CHANNEL_ID) {
    // Throw so the caller records a failure — not a silent skip
    throw new Error('LINKEDIN_CHANNEL_ID not configured. Set this GitHub Actions secret.')
  }
  validatePost(text)
  if (DRY_RUN) {
    console.log('--- DRY RUN (LinkedIn) ---')
    console.log(text)
    if (imageUrl) console.log(`Image: ${imageUrl}`)
    console.log(`Length: ${text.length}`)
    return
  }
  const mediaBlock = imageUrl ? `\n          mediaUrls: [${JSON.stringify(imageUrl)}]` : ''
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
    console.log(`LinkedIn posted — Buffer post ID: ${result.post.id}${imageUrl ? ' (with image)' : ''}`)
  } else {
    throw new Error(`LinkedIn post failed: ${result?.message ?? JSON.stringify(json)}`)
  }
}

// ─── Per-mode daily dedup ─────────────────────────────────────────────────────
// Prevents the same mode from posting twice on the same day (e.g. manual + auto).
// Uses the existing posted_tweet_events table with key format: mode:YYYY-MM-DD

async function checkModeToday(mode) {
  if (DRY_RUN) return false  // always allow in dry-run
  const today = new Date().toISOString().split('T')[0]
  return checkPostedEvent(`mode:${mode}:${today}`)
}

async function markModePosted(mode) {
  if (DRY_RUN) return
  const today = new Date().toISOString().split('T')[0]
  await markPostedEvent(`mode:${mode}:${today}`, mode, null, today, '')
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
  const { bear, bull } = appScenarios(data)
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
  if (validScenarios(bear, bull, fair)) {
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

  // ── Build scannable list structure ──────────────────────────────────────
  const bullets = []

  // Valuation
  if (price && fair && upside != null) {
    bullets.push(`💰 Price: ${fmt(price)} · Fair value: ${fmt(fair)} · ${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(0)}% gap`)
  }
  if (validScenarios(bear, bull, fair)) {
    bullets.push(`📊 Range: ${fmt(bear)} bear → ${fmt(bull)} bull`)
  }
  if (fwdPE) bullets.push(`📈 Forward P/E: ${fwdPE}×${peRatio ? ` (trailing: ${peRatio.toFixed(0)}×)` : ''}`)
  if (evEbitda) bullets.push(`📊 EV/EBITDA: ${evEbitda.toFixed(1)}×`)
  if (analystTarget && recLabel) bullets.push(`🎯 Street: ${recLabel} · consensus target ${fmt(analystTarget)}`)

  // Growth
  if (hist3y != null && analyst1y != null && numAnalysts >= 3) {
    const dir = analyst1y > hist3y * 1.1 ? 'accelerating' : analyst1y < hist3y * 0.85 ? 'decelerating' : 'steady'
    bullets.push(`📉 Revenue growth: ${pct(hist3y, false)} historical · ${pct(analyst1y, false)} forecast (${dir})`)
  } else if (hist3y != null) {
    bullets.push(`📉 Revenue growth: ${pct(hist3y, false)} 3-year average`)
  }
  if (lastSurprise && surprises.length >= 3) {
    const avgSurp = surprises.reduce((s, q) => s + (q.surprisePercent ?? 0), 0) / surprises.length
    bullets.push(`✅ EPS beat rate: ${beatCount}/${surprises.length} quarters · avg surprise ${avgSurp >= 0 ? '+' : ''}${avgSurp.toFixed(1)}%`)
  }

  // Quality
  if (grossM != null) {
    bullets.push(`🏭 Margins: gross ${pct(grossM, false)}${netM != null ? ` · net ${pct(netM, false)}` : ''}${fcfM != null ? ` · free cash flow ${pct(fcfM, false)}` : ''}`)
  }
  if (roicPos) {
    bullets.push(`⚡ Returns: ${pct(roic, false)} on invested capital · ${pct(roicSpread, false)} above cost of capital`)
  } else if (roicNeg) {
    bullets.push(`⚠️ Returns: ${pct(roic, false)} on invested capital — below cost of capital`)
  }
  if (roe != null) bullets.push(`📋 ROE: ${pct(roe, false)}`)

  // Capital
  if (hasDiv) bullets.push(`💸 Dividend: ${pct(divYield, false)} yield${payoutRatio != null ? ` · ${pct(payoutRatio, false)} payout` : ''}`)
  if (buybacks && buybacks > 100) bullets.push(`🔄 Buybacks: ${fmt(buybacks * 1e6)} returned last year`)

  // Risk (plain language only — no model names, altmanZone already declared above)
  if (altmanZone && altmanZone !== 'Grey') {
    bullets.push(altmanZone === 'Safe'
      ? `🛡️ Financial health: low distress risk`
      : `⚠️ Financial health: elevated distress signals`)
  }
  if (highShort) bullets.push(`🔻 Short interest: ${pct(shortPct, false)} of float`)
  if (beta != null) bullets.push(`📊 Beta: ${beta.toFixed(2)}`)
  if (insiderPct != null && insiderPct > 0.05) bullets.push(`👤 Insider ownership: ${pct(insiderPct, false)}`)

  const question = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]

  const lines = [
    hook,
    ``,
    ...bullets,
    ``,
    closing,
    ``,
    question,
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

  const sp = sp500 ? `▲ S&P ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null
  const nq = nasdaq ? `Nasdaq ${nasdaq.changePct >= 0 ? '+' : ''}${nasdaq.changePct.toFixed(2)}%` : null
  const dj = dow ? `Dow ${dow.changePct >= 0 ? '+' : ''}${dow.changePct.toFixed(2)}%` : null
  const indexLine = [sp, nq, dj].filter(Boolean).join(' · ')

  const lines = [
    `${dayName} close.`,
    ``,
    indexLine,
    ``,
    ...sectors.map(s => `${s.changePct >= 0.5 ? '▲' : s.changePct <= -0.5 ? '▼' : '→'} ${s.name} ${s.changePct >= 0 ? '+' : ''}${s.changePct.toFixed(2)}%`),
    ``,
    ...[
      tnx  ? `📈 10Y ${tnx.price.toFixed(2)}% (${tnx.changePct >= 0 ? '+' : ''}${tnx.changePct.toFixed(2)}%)` : null,
      oil  ? `🛢️ Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)` : null,
      gold ? `🥇 Gold $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(1)}%)` : null,
    ].filter(Boolean),
    ``,
    ...whatDrove,
    ``,
    `The price moved. Did the value?`,
    ``,
    `#MarketClose #Finance #Investing #StockMarket`,
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
    const hist3y     = d.cagrAnalysis?.historicalCagr3y ?? null
    const high52     = d.quote?.fiftyTwoWeekHigh ?? null
    const low52      = d.quote?.fiftyTwoWeekLow  ?? null
    const histMultiples = d.historicalMultiples ?? []
    const histPEs    = histMultiples.map(y => y.pe).filter(v => v != null && v > 0 && v < 200)
    const avgHistPE  = histPEs.length >= 2 ? histPEs.reduce((s, v) => s + v, 0) / histPEs.length : null
    const histEvEb   = histMultiples.map(y => y.evEbitda).filter(v => v != null && v > 0 && v < 500)
    const avgHistEvEb = histEvEb.length >= 2 ? histEvEb.reduce((s, v) => s + v, 0) / histEvEb.length : null
    const annualMetrics = d.keyMetricsAnnual ?? []
    const roicHistory = annualMetrics.map(y => y.roic).filter(v => v != null)
    const roicTrend  = roicHistory.length >= 2
      ? (roicHistory[roicHistory.length - 1] > roicHistory[0] ? 'improving' : 'declining') : null
    if (!price || !fwdPE) continue
    const v = verdictLabel(upside ?? 0)
    rows.push({ ticker: scan.tickers[i], price, fwdPE, evEbitda, evRevenue, revGrowth, roicSpread, fair, upside, v, hist3y, high52, low52, avgHistPE, avgHistEvEb, roicTrend })
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

  // Each stock: current metrics + historical context line
  const stockBlocks = rows.map(r => {
    const parts = [`${r.v.emoji} $${r.ticker}`]
    parts.push(`Fwd P/E: ${r.fwdPE.toFixed(0)}×`)
    if (multipleKey && r[multipleKey] != null) parts.push(`${multipleLabel}: ${r[multipleKey].toFixed(1)}×`)
    if (showGrowth && r.revGrowth  != null) parts.push(`Rev growth: +${(r.revGrowth * 100).toFixed(0)}%`)
    if (showROIC   && r.roicSpread != null) parts.push(`ROIC spread: ${r.roicSpread >= 0 ? '+' : ''}${(r.roicSpread * 100).toFixed(0)}pp`)
    if (r.upside != null && r.fair) parts.push(`${r.v.short} (${r.upside >= 0 ? '+' : ''}${(r.upside * 100).toFixed(0)}% to ${fmt(r.fair)})`)

    const histParts = []
    if (r.avgHistPE != null) {
      const vs = r.fwdPE / r.avgHistPE
      const label = vs > 1.15 ? `above` : vs < 0.85 ? `below` : `in line with`
      histParts.push(`P/E ${label} 3Y avg (${r.avgHistPE.toFixed(0)}×)`)
    }
    if (r.hist3y != null && r.revGrowth != null) {
      const accel = r.revGrowth > r.hist3y * 1.1 ? `accelerating vs` : r.revGrowth < r.hist3y * 0.85 ? `decelerating vs` : `in line with`
      histParts.push(`growth ${accel} 3Y CAGR of +${(r.hist3y * 100).toFixed(0)}%`)
    } else if (r.hist3y != null) {
      histParts.push(`3Y CAGR: +${(r.hist3y * 100).toFixed(0)}%`)
    }
    if (r.roicTrend) histParts.push(`ROIC ${r.roicTrend}`)
    if (r.high52 != null && r.price != null) {
      const fromHigh = ((r.price - r.high52) / r.high52 * 100).toFixed(0)
      if (Number(fromHigh) < -15) histParts.push(`${Math.abs(fromHigh)}% off 52W high`)
    }
    const histLine = histParts.length > 0 ? `  ↳ ${histParts.slice(0, 2).join(' · ')}` : null

    return [parts.join(' · '), histLine].filter(Boolean).join('\n')
  })

  // Narrative insight paragraphs
  const insights = [
    cheapest ? `$${cheapest.ticker} has the lowest forward multiple in the group at ${cheapest.fwdPE.toFixed(0)}×.${cheapest.avgHistPE != null ? ` Its 3Y average was ${cheapest.avgHistPE.toFixed(0)}× — so it's trading ${cheapest.fwdPE < cheapest.avgHistPE * 0.9 ? 'below' : 'near'} its own history.` : ''}${cheapest.revGrowth != null ? ` Analysts expect +${(cheapest.revGrowth * 100).toFixed(0)}%/yr growth.` : ''}` : null,
    richest  ? `$${richest.ticker} is priced the richest at ${richest.fwdPE.toFixed(0)}×.${richest.avgHistPE != null ? ` Vs its own 3Y average of ${richest.avgHistPE.toFixed(0)}× — ${richest.fwdPE > richest.avgHistPE * 1.15 ? 'elevated relative to history' : 'in historical range'}.` : ''}${richest.revGrowth != null ? ` Needs +${(richest.revGrowth * 100).toFixed(0)}%/yr growth to justify it.` : ''}` : null,
    bestROIC && bestROIC.roicSpread != null && bestROIC.roicSpread > 0.04
      ? `$${bestROIC.ticker} has the widest ROIC spread (+${(bestROIC.roicSpread * 100).toFixed(0)}pp above WACC).${bestROIC.roicTrend ? ` And it's ${bestROIC.roicTrend} — that matters more than a single year's number.` : ''}`
      : null,
    bestGrowth && bestGrowth.revGrowth != null
      ? `$${bestGrowth.ticker} is the fastest-growing name here at +${(bestGrowth.revGrowth * 100).toFixed(0)}%/yr.${bestGrowth.hist3y != null ? ` Historical 3Y CAGR was +${(bestGrowth.hist3y * 100).toFixed(0)}% — analysts expect ${bestGrowth.revGrowth > bestGrowth.hist3y * 1.1 ? 'an acceleration' : bestGrowth.revGrowth < bestGrowth.hist3y * 0.85 ? 'a deceleration' : 'a similar pace'}.` : ''}`
      : null,
  ].filter(Boolean)

  const closing = `A low multiple doesn't mean cheap if growth is decelerating. A high multiple doesn't mean expensive if the business earns well above its cost of capital. Both numbers together tell a more honest story.`

  const lines = [
    `${scan.emoji} ${scan.name} Sector — Valuation Analysis`,
    dateStr,
    ``,
    scan.context,
    ``,
    ...stockBlocks,
    ``,
    ...insights,
    ``,
    closing,
    ``,
    `Which one stands out to you?`,
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
        ? `One to watch: $${focusTicker} at ${fmt(price)}. Market pricing in ~${pct(impliedG, false)}/yr growth — our model sees ${pct(upside)} upside.`
        : `One to watch: $${focusTicker} at ${fmt(price)}. Market pricing in ~${pct(impliedG, false)}/yr growth to justify this price — that's a lot to deliver.`
    }
    return Math.abs(upside ?? 0) > 0.08
      ? `One to watch today: $${focusTicker}. Our model puts fair value at ${fmt(fair)} — ${pct(upside)} ${(upside ?? 0) > 0 ? 'above' : 'below'} current price.`
      : null
  })() : null

  const lines = [
    `${dayName} morning.`,
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
    `What are you watching today?`,
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

  const ourBullishCount = picks.filter(p => p.ourUpside > p.streetUpside).length
  const intro = ourBullishCount >= 2
    ? `Our model sees more upside than Wall Street on these. That's either an opportunity or a disagreement worth understanding.`
    : ourBullishCount === 0
    ? `The Street is more bullish than our model on all three. Here's where the assumptions diverge.`
    : `3 stocks. Our model and Wall Street don't see eye to eye — in both directions.`

  const stockLines = picks.flatMap(p => {
    const ourDir    = p.ourUpside > 0 ? `sees ${(p.ourUpside * 100).toFixed(0)}% upside` : `sees ${Math.abs(p.ourUpside * 100).toFixed(0)}% downside`
    const stDir     = p.streetUpside > 0 ? `+${(p.streetUpside * 100).toFixed(0)}%` : `${(p.streetUpside * 100).toFixed(0)}%`
    const roicNote  = p.roicSpread != null
      ? p.roicSpread < -0.02 ? ` Cost of capital exceeds returns — that's the tension.`
      : p.roicSpread > 0.08  ? ` Returns are well above cost of capital — business quality supports the bull case.`
      : ``
      : ``
    const growthNote = p.impliedG != null && p.hist3y != null
      ? ` Market is pricing in ${pct(p.impliedG, false)}/yr annual growth; the 3-year historical rate was ${pct(p.hist3y, false)}.`
      : ``
    return [
      `$${p.ticker} — price ${fmt(p.price)}`,
      `Our model: ${fmt(p.ourFair)} (${ourDir}) · Street: ${fmt(p.analystTarget)} (${stDir}, ${p.numAnalysts} analysts)`,
      `${growthNote}${roicNote}`.trim() || null,
      ``,
    ].filter(Boolean)
  })

  const closing = ourBullishCount >= 2
    ? `If our assumptions are right, these are being left on the table. If the Street's right, they're not. Run the inputs and see which story holds up.`
    : ourBullishCount === 0
    ? `Analysts may be extrapolating recent momentum. Our model discounts cash flows over the full cycle. One of them is overpaying. Worth stress-testing.`
    : `Same data, different assumptions, different answers. That gap is where investing actually happens.`

  const lines = [
    intro,
    ``,
    ...stockLines,
    closing,
    ``,
    ...(ourBullishCount !== 1 ? [`Which side of this list are you on?`, ``] : []),
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
      ? ` ROIC ${(s.roicSpread * 100).toFixed(0)}pp above cost of capital.`
      : ``
    const growthNote = s.analyst1y != null
      ? ` Analysts see ${pct(s.analyst1y, false)}/yr growth.`
      : s.hist3y != null ? ` 3-year annual growth: ${pct(s.hist3y, false)}.` : ``
    const recNote = s.recLabel && s.recLabel !== 'Hold' ? ` Street says ${s.recLabel}.` : ``
    return [
      `${i + 1}. $${s.ticker} — ${fmt(s.price)} → model fair value ${fmt(s.fair)} (${(s.upside * 100).toFixed(0)}% upside)`,
      `${[growthNote, roicNote, recNote].join('').trim() || null}`,
      ``,
    ].filter(Boolean)
  })

  const lines = [
    `5 stocks the model finds attractive — week of ${dateStr}`,
    ``,
    `These aren't recommendations. They're the names where our DCF shows the biggest gap between what the market is pricing and what the business appears to be worth. Filtered for quality.`,
    ``,
    ...stockLines,
    diverseNote,
    ``,
    `Every model is interactive — change cost of capital, growth rate, or terminal value and see the fair value update in real time. Which one would you investigate first?`,
    ``,
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
    ``,
    `#ValueInvesting #DCF #Valuation #Finance #Investing`,
  ],
]

async function runLiMyth() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const content = LI_MYTHS[dayOfYear % LI_MYTHS.length]
  await postLinkedIn(content.join('\n'))
}

// ─── Conviction Score computation ─────────────────────────────────────────────
// Simplified port of lib/stock/computeConvictionScore.ts.
// No riskDimensions (client-only) or verdict object (not in API).
// Uses all raw fields available from /api/financials.

function computeSimplifiedConviction(data) {
  const clamp = v => Math.round(Math.max(0, Math.min(100, v)))

  const upside      = appUpside(data) ?? 0
  const fwdPE       = data.analystForwardPE ?? null
  const roicSpread  = data.scores?.roic?.spread ?? 0
  const moat        = data.ratings?.moat?.score ?? 2.5
  const prof        = data.ratings?.profitability?.score ?? 2.5
  const liq         = data.ratings?.liquidity?.score ?? 2.5
  const growth      = data.ratings?.growth?.score ?? 2.5
  const altmanZone  = data.scores?.altman?.zone ?? 'Grey'
  const pioScore    = data.scores?.piotroski?.score ?? 4      // 0–9
  const pioLabel    = data.scores?.piotroski?.label ?? null   // Strong/Mixed/Weak
  const beneishFlag = data.scores?.beneish?.flag ?? 'Clean'
  const insiderPct  = data.ownership?.insiderPct ?? 0
  const trend       = data.analystRatingTrend ?? []
  const surprises   = data.earningsSurprises ?? []
  const stock1y     = data.holdingReturns?.stock1y ?? null
  const spy1y       = data.holdingReturns?.spy1y ?? null
  const analystTarget = data.quote?.analystTargetMean ?? null
  const price       = data.quote?.price ?? null

  // ── Dimension 1: Valuation (27%) — matches app ────────────────────────────
  // upsideSignalScore: >25%→100, 10-25%→80, 0-10%→60, -10-0%→40, -25--10%→20, <-25%→0
  const upsideSig = upside > 0.25 ? 100 : upside > 0.10 ? 80 : upside > 0 ? 60 : upside > -0.10 ? 40 : upside > -0.25 ? 20 : 0
  const valRatingNorm = ((data.ratings?.valuation?.score ?? 2.5) - 1) / 4 * 100
  let val = valRatingNorm * 0.60 + upsideSig * 0.40
  if (fwdPE != null && fwdPE > 0 && fwdPE < 100) {
    if (fwdPE < 20) val = Math.min(100, val + 5)
    else if (fwdPE > 40) val = Math.max(0, val - 3)
  }
  if (analystTarget != null && price != null && price > 0) {
    const streetGap = (analystTarget - price) / price
    if (streetGap > 0.15) val = Math.min(100, val + 5)
    else if (streetGap < -0.10) val = Math.max(0, val - 5)
  }
  val = clamp(val)

  // ── Dimension 2: Business Quality (23%) — matches app ────────────────────
  const moatNorm = ((moat - 1) / 4) * 100
  const profNorm = ((prof - 1) / 4) * 100
  const roicMod  = roicSpread > 0.08 ? 7 : roicSpread > 0.02 ? 3 : roicSpread < -0.02 ? -5 : 0
  const qual = clamp(moatNorm * 0.50 + profNorm * 0.50 + roicMod)

  // ── Dimension 3: Financial Health (18%) — matches app ────────────────────
  const altmanMod = altmanZone === 'Safe' ? 100 : altmanZone === 'Grey' ? 50 : 0
  const pioMod    = (pioScore / 9) * 100
  const liqNorm   = ((liq - 1) / 4) * 100
  const health    = clamp(liqNorm * 0.50 + altmanMod * 0.30 + pioMod * 0.20)

  // ── Dimension 4: Growth Momentum (14%) — matches app ─────────────────────
  const growthNorm = ((growth - 1) / 4) * 100
  const alphaMod   = (stock1y != null && spy1y != null)
    ? (stock1y - spy1y > 0.10 ? 5 : stock1y - spy1y < -0.10 ? -5 : 0) : 0
  const growthScore = clamp(growthNorm + alphaMod)

  // ── Dimension 5: Earnings Integrity (5%) — matches app ───────────────────
  const beneishMod  = beneishFlag === 'Clean' ? 100 : beneishFlag === 'Warning' ? 40 : 0
  const accrual     = data.scores?.piotroski?.criteria?.find(c => c.name?.toLowerCase().includes('accrual'))
  const accrualMod  = accrual == null || accrual.pass === null ? 60 : accrual.pass ? 100 : 0
  const integ       = clamp(beneishMod * 0.50 + accrualMod * 0.50)

  // ── Dimension 6: Risk (5%) — approximated ────────────────────────────────
  const riskScore = clamp(
    (altmanZone === 'Safe' ? 80 : altmanZone === 'Grey' ? 55 : 20) * 0.50 +
    (roicSpread > 0 ? 70 : 40) * 0.30 +
    (pioScore >= 6 ? 75 : pioScore >= 4 ? 55 : 35) * 0.20
  )

  // ── Dimension 7: Analyst & Market Sentiment (8%) — matches app ───────────
  let consensusScore = 50
  if (trend.length > 0) {
    const { strongBuy: sb = 0, buy: b = 0, hold: h = 0, sell: s = 0, strongSell: ss = 0 } = trend[0]
    const total = sb + b + h + s + ss
    if (total > 0) consensusScore = clamp((sb * 2 + b - s - ss * 2) / total * 50 + 50)
  }
  const last4     = surprises.slice(0, 4)
  const beats     = last4.filter(q => (q.epsActual ?? 0) > (q.epsEstimate ?? 0)).length
  const beatScore = last4.length > 0 ? (beats / last4.length) * 100 : 50
  let targetScore = 50
  if (analystTarget != null && price != null && price > 0) {
    const gap = (analystTarget - price) / price
    targetScore = clamp(gap > 0 ? gap * 200 : 50 + gap * 100)
  }
  const insiderScore = insiderPct >= 0.10 ? 85 : insiderPct >= 0.05 ? 70 : insiderPct >= 0.01 ? 50 : 35
  const sent = clamp(consensusScore * 0.40 + beatScore * 0.30 + targetScore * 0.20 + insiderScore * 0.10)

  // ── Weighted total — matches app exactly ─────────────────────────────────
  const raw   = val * 0.27 + qual * 0.23 + health * 0.18 + growthScore * 0.14 + integ * 0.05 + riskScore * 0.05 + sent * 0.08
  const score = Math.round(Math.max(0, Math.min(100, raw)))

  const gradeFull = score >= 90 ? 'A+' : score >= 80 ? 'A' : score >= 72 ? 'B+' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F'
  const grade     = gradeFull.replace('+', '')
  const label     = grade === 'A' ? 'Exceptional buy'
    : grade === 'B' ? 'Good business, reasonable price'
    : grade === 'C' ? 'Mixed picture — proceed carefully'
    : grade === 'D' ? 'More risks than rewards'
    : 'High risk — significant concerns'

  // ── Plain-English signal summaries (no jargon) ────────────────────────────
  const valSignal = upside > 0.10
    ? `Price is ${pct(upside)} below our fair value estimate`
    : upside < -0.05
    ? `Price is ${pct(Math.abs(upside))} above our fair value estimate`
    : `Price is near our fair value estimate`

  const moatLabel = data.ratings?.moat?.label ?? 'Moderate'
  const qualSignal = roicSpread > 0.05
    ? `${moatLabel} competitive position · returns ${pct(roicSpread, false)} above cost of capital`
    : roicSpread < -0.02
    ? `${moatLabel} competitive position · returns below cost of capital`
    : `${moatLabel} competitive position · ${data.ratings?.profitability?.label ?? 'fair'} profitability`

  // Health: translate scores to plain language, no model names
  const financialMomentum = pioLabel === 'Strong' ? 'improving' : pioLabel === 'Weak' ? 'deteriorating' : 'stable'
  const balanceSheet = data.ratings?.liquidity?.label ?? (liq >= 3.5 ? 'Strong' : liq >= 2.5 ? 'Fair' : 'Weak')
  const bankruptcyRisk = altmanZone === 'Safe' ? 'low bankruptcy risk'
    : altmanZone === 'Grey' ? 'moderate watch zone'
    : 'elevated financial distress signal'
  const healthSignal = `${balanceSheet} balance sheet · financials ${financialMomentum} · ${bankruptcyRisk}`

  const growthSignal = data.ratings?.growth?.label != null
    ? `${data.ratings.growth.label}${alphaMod !== 0 ? ` · ${alphaMod > 0 ? '+' : ''}${alphaMod}pp vs S&P 500 this year` : ''}`
    : 'Growth data limited'

  // Integrity: no "Beneish" — describe what it means
  const integSignal = beneishFlag === 'Clean'
    ? `Earnings appear reliable · cash flow confirms reported profits`
    : beneishFlag === 'Warning'
    ? `Some accounting flags — reported profits may outrun cash flow`
    : `Earnings quality concerns — significant accounting red flags`

  const riskSignal = altmanZone === 'Safe'
    ? `Low financial distress risk`
    : altmanZone === 'Grey'
    ? `Moderate financial risk — worth monitoring`
    : `Elevated financial distress signals`

  const bullPct = (() => {
    if (!trend.length) return null
    const { strongBuy: sb = 0, buy: b = 0, hold: h = 0, sell: s = 0, strongSell: ss = 0 } = trend[0]
    const total = sb + b + h + s + ss
    return total > 0 ? Math.round(((sb + b) / total) * 100) : null
  })()
  const sentSignal = [
    bullPct != null ? `${bullPct}% of analysts are bullish` : null,
    last4.length > 0 ? `beat earnings estimates ${beats} of last ${last4.length} quarters` : null,
  ].filter(Boolean).join(' · ') || 'Limited analyst data'

  return {
    score, grade, gradeFull, label,
    dimensions: { val, qual, health, growth: growthScore, integ, risk: riskScore, sent },
    signals:    { val: valSignal, qual: qualSignal, health: healthSignal, growth: growthSignal, integ: integSignal, risk: riskSignal, sent: sentSignal },
  }
}

// Validates a conviction result before posting — blocks weird/empty values
function validateConviction(c, ticker) {
  if (!c || typeof c.score !== 'number') throw new Error(`Conviction: no result for ${ticker}`)
  if (isNaN(c.score) || c.score < 0 || c.score > 100) throw new Error(`Conviction: score out of range (${c.score}) for ${ticker}`)
  if (!c.grade || !c.gradeFull || !c.label) throw new Error(`Conviction: missing grade/label for ${ticker}`)
  // Every dimension must be a valid 0-100 integer
  for (const [key, val] of Object.entries(c.dimensions)) {
    if (isNaN(val) || val < 0 || val > 100) throw new Error(`Conviction: dimension ${key}=${val} out of range for ${ticker}`)
  }
  // Every signal must be a non-empty string with no raw jargon terms users won't understand
  const JARGON = ['NaN', 'undefined', '[object', 'Piotroski', 'Beneish', 'Altman', 'WACC', 'n/a', 'N/A']
  for (const [key, sig] of Object.entries(c.signals)) {
    if (!sig || typeof sig !== 'string' || sig.trim() === '') throw new Error(`Conviction: empty signal ${key} for ${ticker}`)
    for (const term of JARGON) {
      if (sig.includes(term)) throw new Error(`Conviction: jargon "${term}" in signal ${key}: "${sig}"`)
    }
  }
  console.log(`✓ Conviction validated: ${ticker} ${c.score}/100 ${c.gradeFull}`)
}


// Builds the phone OG image URL for a given stock + conviction result.
// Attaches to conviction_score and li_conviction posts.
function buildPhoneImageUrl(data, ticker, convScore) {
  if (!APP_URL) return null
  const price   = data.quote?.price
  const fair    = appFairValue(data)
  const upside  = appUpside(data)
  const { bear, bull } = appScenarios(data)
  const currency = data.quote?.currency ?? 'USD'
  const name    = data.quote?.name ?? ''
  const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const mig     = impliedG != null ? impliedG : null
  const migA    = data.cagr ?? null

  // Map conviction score → verdict string for OG image
  const verdict = upside == null ? 'Insufficient Data'
    : upside > 0.10  ? 'Undervalued'
    : upside < -0.10 ? 'Overvalued'
    : 'Fairly Valued'

  // Build 2-3 pass bullets from the strongest signals
  const c = convScore
  const passBullets = []
  const failBullets = []
  if (c.dimensions.qual >= 70) passBullets.push(c.signals.qual.split(' · ')[0])
  if (c.dimensions.sent >= 70) passBullets.push(c.signals.sent.split(' · ')[0])
  if (c.dimensions.health >= 65) passBullets.push(c.signals.health.split(' · ')[0])
  if (c.dimensions.integ >= 80) passBullets.push('Earnings appear reliable')
  if (c.dimensions.qual < 40) failBullets.push(c.signals.qual.split(' · ')[0])
  else if (c.dimensions.val < 40) failBullets.push(c.signals.val)
  else if (c.dimensions.health < 40) failBullets.push(c.signals.health.split(' · ')[0])

  // P/E history for mini bar chart
  const histMultiples = data.historicalMultiples ?? []
  const peHistStr = histMultiples
    .filter(y => y.pe != null && y.pe > 0 && y.pe < 200 && y.fiscalYear)
    .slice(-5)
    .map(y => `${y.fiscalYear}:${y.pe.toFixed(1)}`)
    .join('|')

  const params = new URLSearchParams()
  params.set('ticker', ticker)
  if (name) params.set('name', name.slice(0, 50))
  params.set('verdict', verdict)
  params.set('currency', currency)
  if (price)  params.set('price', price.toFixed(2))
  if (fair)   params.set('fv', fair.toFixed(2))
  if (upside != null) params.set('upside', upside.toFixed(4))
  if (bear)   params.set('bear', bear.toFixed(2))
  if (bull)   params.set('bull', bull.toFixed(2))
  if (mig)    params.set('mig', mig.toFixed(4))
  if (migA)   params.set('migAssumed', migA.toFixed(4))
  if (peHistStr) params.set('peHist', peHistStr)
  // Conviction signals for the card
  params.set('checkPassed', String(Math.round(c.score)))
  params.set('checkTotal', '100')
  params.set('checkLabel', c.score >= 72 ? 'Strong' : c.score >= 50 ? 'Mixed' : 'Weak')
  if (passBullets.length > 0) params.set('passBullets', passBullets.slice(0, 3).join('|'))
  if (failBullets.length > 0) params.set('failBullets', failBullets.slice(0, 1).join('|'))

  return `${APP_URL}/api/og/phone?${params.toString()}`
}

// ─── Mode: conviction_score ───────────────────────────────────────────────────
// Mon/Wed/Fri 2PM ART. Full 7-dimension conviction breakdown for one stock.
// Showcases the Conviction Score tab — insic.app's most differentiating feature.
async function runConvictionScore() {
  const day = new Date().getDay()
  const pool = TICKER ? [TICKER] : (ROTATION[day] ?? ROTATION[1])
  const dayOfYear = Math.floor(Date.now() / 86400000)

  let ticker = null, data = null
  for (let attempt = 0; attempt < Math.min(6, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt + 5) % pool.length]
    try {
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result) && result?.ratings?.moat) {
        ticker = candidate; data = result; break
      }
    } catch { /* try next */ }
  }
  if (!data) { console.warn('conviction_score: no data — skipping'); return }

  const c     = computeSimplifiedConviction(data)
  const fair  = appFairValue(data)
  const price = data.quote?.price

  validateConviction(c, ticker)
  const imageUrl = buildPhoneImageUrl(data, ticker, c)

  const lines = [
    `$${ticker} — Conviction Score: ${c.score}/100 (${c.gradeFull})`,
    `${c.label}.`,
    ``,
    `Valuation:  ${String(c.dimensions.val).padStart(3)}  ${c.signals.val}`,
    `Quality:    ${String(c.dimensions.qual).padStart(3)}  ${c.signals.qual}`,
    `Health:     ${String(c.dimensions.health).padStart(3)}  ${c.signals.health}`,
    `Growth:     ${String(c.dimensions.growth).padStart(3)}  ${c.signals.growth}`,
    `Integrity:  ${String(c.dimensions.integ).padStart(3)}  ${c.signals.integ}`,
    `Risk:       ${String(c.dimensions.risk).padStart(3)}  ${c.signals.risk}`,
    `Sentiment:  ${String(c.dimensions.sent).padStart(3)}  ${c.signals.sent}`,
    ``,
    fair && price ? `Fair value estimate: ${fmt(fair)} · Current price: ${fmt(price)}` : null,
    ``,
    `Full breakdown insic.app/stock/${ticker}`,
    `$${ticker} #ConvictionScore #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'), imageUrl)
}

// ─── Mode: li_conviction ──────────────────────────────────────────────────────
// Tue/Thu 2PM ART. LinkedIn version — each dimension gets a narrative sentence.

async function runLiConviction() {
  const day = new Date().getDay()
  const pool = TICKER ? [TICKER] : (ROTATION[day] ?? ROTATION[1])
  const dayOfYear = Math.floor(Date.now() / 86400000)

  let ticker = null, data = null
  for (let attempt = 0; attempt < Math.min(6, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt + 11) % pool.length]
    try {
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result) && result?.ratings?.moat) {
        ticker = candidate; data = result; break
      }
    } catch { /* try next */ }
  }
  if (!data) { console.warn('li_conviction: no data — skipping'); return }

  const c     = computeSimplifiedConviction(data)
  validateConviction(c, ticker)
  const imageUrl = buildPhoneImageUrl(data, ticker, c)
  const fair  = appFairValue(data)
  const price = data.quote?.price
  const upside = appUpside(data)
  const roicSpread = data.scores?.roic?.spread
  const hist3y = data.cagrAnalysis?.historicalCagr3y
  const analyst1y = data.cagrAnalysis?.analystEstimate1y
  const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const sector = data.quote?.sector ?? ''

  const gradeEmoji = c.grade === 'A' ? '🟢' : c.grade === 'B' ? '🟡' : '🔴'

  // Opening — lead with the score and what it means
  const opening = `${gradeEmoji} $${ticker} — Conviction Score: ${c.score}/100 (${c.gradeFull})\n${c.label}.`

  // Each dimension as a prose sentence
  const dimLines = [
    `Valuation (${c.dimensions.val}/100): ${c.signals.val}.${impliedG != null ? ` The market is pricing in ~${pct(impliedG, false)}/yr revenue growth.` : ''}`,
    ``,
    `Business Quality (${c.dimensions.qual}/100): ${c.signals.qual}.${roicSpread != null ? ` Every dollar reinvested ${roicSpread > 0 ? 'earns above its cost' : 'currently costs more than it returns'}.` : ''}`,
    ``,
    `Financial Health (${c.dimensions.health}/100): ${c.signals.health}.`,
    ``,
    `Growth Momentum (${c.dimensions.growth}/100): ${c.signals.growth}.${hist3y != null && analyst1y != null ? ` Historical 3Y CAGR was ${pct(hist3y, false)}; analysts expect ${pct(analyst1y, false)} ahead.` : ''}`,
    ``,
    `Earnings Integrity (${c.dimensions.integ}/100): ${c.signals.integ}. The score penalises companies where reported profits outrun cash flows.`,
    ``,
    `Risk Profile (${c.dimensions.risk}/100): ${c.signals.risk}.`,
    ``,
    `Analyst & Sentiment (${c.dimensions.sent}/100): ${c.signals.sent}.`,
  ]

  // Closing
  const closing = c.score >= 72
    ? `The combination of a strong quality score and valuation discount is relatively rare. Worth understanding why the gap exists.`
    : c.score >= 50
    ? `The score reflects a mixed picture — some dimensions are strong, others warrant scrutiny. The details matter more than the headline number.`
    : `A low conviction score doesn't mean avoid permanently — it means the current setup has more concerns than strengths. Worth monitoring for a better entry.`

  const lines = [
    opening,
    ``,
    ...dimLines,
    ``,
    closing,
    ``,
    `What would change your view on this one?`,
    ``,
    `#${ticker} #ConvictionScore #ValueInvesting #DCF #Finance${sector ? ` #${sector.replace(/[^a-zA-Z]/g, '')}` : ''}`,
  ].filter(s => s !== undefined)

  await postLinkedIn(lines.join('\n'), imageUrl)
}

// ─── ETF helpers ──────────────────────────────────────────────────────────────

const ETF_META_MAP = {
  // Sector
  XLK: 'Technology', XLV: 'Healthcare', XLF: 'Financials', XLY: 'Cons. Cyclical',
  XLI: 'Industrials', XLC: 'Comm. Services', XLP: 'Cons. Defensive', XLE: 'Energy',
  XLRE: 'Real Estate', XLB: 'Materials', XLU: 'Utilities',
  // Geo
  SPY: 'US Large Cap', EFA: 'Developed World', EEM: 'Emerging Markets',
  EWJ: 'Japan', FXI: 'China', EWZ: 'Brazil', EWU: 'UK', EWG: 'Germany', INDA: 'India',
  // Style
  VTV: 'Value', VUG: 'Growth', VYM: 'High Dividend', USMV: 'Low Volatility', QUAL: 'Quality',
  // Broad
  QQQ: 'Nasdaq 100', IWM: 'Small Cap', GLD: 'Gold', TLT: 'Long Bonds', BIL: 'T-Bills',
}

const ETF_SCORE_LABELS = { 70: 'Deep Value', 50: 'Fair Value', 30: 'Stretched', 0: 'Expensive' }
function etfScoreLabel(score) {
  if (score >= 70) return 'Deep Value'
  if (score >= 50) return 'Fair Value'
  if (score >= 30) return 'Stretched'
  return 'Expensive'
}
function etfScoreEmoji(score) {
  return score >= 70 ? '🟢' : score >= 50 ? '🟡' : '🔴'
}

async function fetchLatestEtfScores() {
  const sb = await _getSupabase()
  if (!sb) {
    console.error('ETF scan: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — ETF modes will skip')
    return []
  }
  const cutoff = new Date(Date.now() - 86400000 * 4).toISOString()
  const { data, error } = await sb
    .from('etf_score_history')
    .select('ticker, score, pe_ratio, pb_ratio, yield_val, expense_ratio, ts')
    .gte('ts', cutoff)
    .order('ts', { ascending: false })
  if (error) { console.warn('ETF scan Supabase error:', error.message); return [] }
  const seen = new Set()
  return (data ?? []).filter(r => {
    if (seen.has(r.ticker)) return false
    seen.add(r.ticker)
    return true
  })
}

// ─── Mode: etf_value_scan ─────────────────────────────────────────────────────
// Saturday 10AM ART. Top 3 best-value and 3 most expensive ETFs from Supabase.
// Showcases the ETF tracker — insic.app/etf

async function runEtfValueScan() {
  const etfs = await fetchLatestEtfScores()
  if (etfs.length < 6) { console.warn('etf_value_scan: insufficient ETF data — skipping'); return }

  etfs.sort((a, b) => b.score - a.score)
  const bestValue  = etfs.slice(0, 3)
  const mostExp    = [...etfs].reverse().slice(0, 3)
  const dateStr    = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const fmtEtfLine = (e) => {
    const name   = ETF_META_MAP[e.ticker] ?? e.ticker
    const pe     = e.pe_ratio  != null ? `P/E ${e.pe_ratio.toFixed(0)}×` : null
    const yld    = e.yield_val != null && e.yield_val > 0 ? `Yield ${(e.yield_val * 100).toFixed(1)}%` : null
    const parts  = [pe, yld].filter(Boolean).join(' · ')
    return `${etfScoreEmoji(e.score)} ${e.ticker} (${name}) — Score ${e.score}${parts ? ` · ${parts}` : ''}`
  }

  const lines = [
    `ETF Value Scan — ${dateStr}`,
    ``,
    `Best value right now:`,
    ...bestValue.map(fmtEtfLine),
    ``,
    `Most expensive right now:`,
    ...mostExp.map(fmtEtfLine),
    ``,
    `The score blends P/E, P/B, yield, and fees into a single number — higher means cheaper relative to what you're getting.`,
    ``,
    `Which sector holds up at current valuations? insic.app/etf`,
    `#ETF #ValueInvesting #SectorRotation #Investing`,
  ]

  await post(lines.join('\n'))
}

// ─── Mode: li_etf_scan ────────────────────────────────────────────────────────
// Sunday 11AM ART. LinkedIn ETF scan — covers sector/geo/style groups with narrative.

async function runLiEtfScan() {
  const etfs = await fetchLatestEtfScores()
  if (etfs.length < 6) { console.warn('li_etf_scan: insufficient ETF data — skipping'); return }

  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  // Group by type
  const SECTOR_TICKERS = ['XLK','XLV','XLF','XLY','XLI','XLC','XLP','XLE','XLRE','XLB','XLU']
  const GEO_TICKERS    = ['SPY','EFA','EEM','EWJ','FXI','EWZ','EWU','EWG','INDA']
  const STYLE_TICKERS  = ['VTV','VUG','VYM','USMV','QUAL']

  const byTicker = Object.fromEntries(etfs.map(e => [e.ticker, e]))

  const sectorEtfs = SECTOR_TICKERS.map(t => byTicker[t]).filter(Boolean).sort((a, b) => b.score - a.score)
  const geoEtfs    = GEO_TICKERS.map(t => byTicker[t]).filter(Boolean).sort((a, b) => b.score - a.score)
  const styleEtfs  = STYLE_TICKERS.map(t => byTicker[t]).filter(Boolean).sort((a, b) => b.score - a.score)

  const fmtBlock = (e) => {
    const name = ETF_META_MAP[e.ticker] ?? e.ticker
    const pe   = e.pe_ratio  != null ? `P/E: ${e.pe_ratio.toFixed(0)}×` : null
    const pb   = e.pb_ratio  != null ? `P/B: ${e.pb_ratio.toFixed(1)}×` : null
    const yld  = e.yield_val != null && e.yield_val > 0 ? `Yield: ${(e.yield_val * 100).toFixed(1)}%` : null
    const exp  = e.expense_ratio != null ? `Expense: ${(e.expense_ratio * 100).toFixed(2)}%` : null
    const metrics = [pe, pb, yld, exp].filter(Boolean).join(' · ')
    return `${etfScoreEmoji(e.score)} ${e.ticker} — ${name} · Score ${e.score} (${etfScoreLabel(e.score)})${metrics ? `\n  ${metrics}` : ''}`
  }

  // Narrative insights
  const sectorBest  = sectorEtfs[0]
  const sectorWorst = sectorEtfs[sectorEtfs.length - 1]
  const geoInsight  = geoEtfs.length >= 2
    ? `${geoEtfs[0] ? `${ETF_META_MAP[geoEtfs[0].ticker] ?? geoEtfs[0].ticker} (${geoEtfs[0].ticker}) scores best geographically at ${geoEtfs[0].score}` : ''} vs ${geoEtfs[geoEtfs.length - 1] ? `${ETF_META_MAP[geoEtfs[geoEtfs.length - 1].ticker] ?? geoEtfs[geoEtfs.length - 1].ticker} at ${geoEtfs[geoEtfs.length - 1].score}` : ''}.`
    : null
  const styleInsight = styleEtfs.length >= 2
    ? `Among style factors, ${ETF_META_MAP[styleEtfs[0].ticker] ?? styleEtfs[0].ticker} (${styleEtfs[0].ticker}, ${etfScoreLabel(styleEtfs[0].score)}) beats ${ETF_META_MAP[styleEtfs[styleEtfs.length - 1].ticker] ?? styleEtfs[styleEtfs.length - 1].ticker} (${styleEtfs[styleEtfs.length - 1].ticker}, ${etfScoreLabel(styleEtfs[styleEtfs.length - 1].score)}) on valuation.`
    : null

  const scoreNote = `The score combines P/E ratio, P/B ratio, dividend yield, and expense ratio into a 0-100 value signal. Deep Value (≥70) means the ETF's holdings are historically cheap on these metrics. Expensive (<30) means you're paying a premium.`

  const lines = [
    `ETF Value Scan — ${dateStr}`,
    ``,
    `🏭 Sector ETFs`,
    ...sectorEtfs.map(fmtBlock),
    sectorBest && sectorWorst ? `\n${ETF_META_MAP[sectorBest.ticker] ?? sectorBest.ticker} is the cheapest sector right now. ${ETF_META_MAP[sectorWorst.ticker] ?? sectorWorst.ticker} is the most expensive.` : null,
    ``,
    `🌍 Geographic ETFs`,
    ...geoEtfs.map(fmtBlock),
    geoInsight ? `\n${geoInsight}` : null,
    ``,
    `📊 Style ETFs`,
    ...styleEtfs.map(fmtBlock),
    styleInsight ? `\n${styleInsight}` : null,
    ``,
    scoreNote,
    ``,
    `Which category looks most interesting to you?`,
    ``,
    `#ETF #ValueInvesting #SectorRotation #AssetAllocation #Finance`,
  ].filter(s => s != null)

  await postLinkedIn(lines.join('\n'))
}

// ─── Mode: movers ─────────────────────────────────────────────────────────────
// Daily top gainers + losers from a large-cap pool.
// Uses the same v8 chart endpoint as other modes — no extra API key needed.
// Fires at 3PM ART (18:00 UTC) Mon–Fri — after most of the session is in.

const MOVERS_POOL = [...new Set([
  'AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','AMD','NFLX','SMCI',
  'PLTR','INTC','QCOM','MU','CRM','NOW','ADBE','ORCL','IBM','AVGO',
  'JPM','GS','BAC','V','MA','XOM','CVX','LLY','UNH','HD',
  'COST','WMT','SBUX','MCD','NKE','PG','KO','PEP','JNJ','PFE',
  'ABBV','MRK','TMO','DHR','HON','CAT','GE','RTX','BA','DE',
  'SPOT','UBER','ABNB','BKNG','DASH','HOOD',
])]

async function runMovers() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  // Fetch quotes for the full pool in batches
  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      const marketCap = meta.marketCap ?? 0
      return { symbol: t, price: meta.regularMarketPrice, chgPct, marketCap }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 5) throw new Error('Not enough mover data')

  results.sort((a, b) => b.chgPct - a.chgPct)
  const gainers = results.slice(0, 3)
  const losers  = results.slice(-3).reverse()
  const biggestMover = Math.abs(gainers[0].chgPct) > Math.abs(losers[0].chgPct) ? gainers[0] : losers[0]
  const isGainer = biggestMover.chgPct > 0

  // Fetch DCF model context on the biggest mover
  let dcfContext = null
  try {
    const data = await fetchValuation(biggestMover.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      if (impliedG != null) {
        dcfContext = isGainer
          ? `After today's move, the market is pricing in ~${pct(impliedG, false)}/yr growth. Our model puts fair value at ${fmt(fair)} — ${upside >= 0 ? `still ${pct(upside)} below that` : `now ${pct(Math.abs(upside))} above that`}.`
          : `After the drop, the market is pricing in ~${pct(impliedG, false)}/yr growth. Our model puts fair value at ${fmt(fair)} — ${upside >= 0 ? `${pct(upside)} above today's price` : `${pct(Math.abs(upside))} below it`}.`
      } else {
        dcfContext = `Our model puts fair value at ${fmt(fair)} — ${pct(upside)} ${upside >= 0 ? 'above' : 'below'} current price.`
      }
    }
  } catch { /* proceed without DCF context */ }

  const fmtMover = (m) => {
    const sign = m.chgPct >= 0 ? '+' : ''
    const arrow = m.chgPct >= 0 ? '▲' : '▼'
    return `${arrow} $${m.symbol} ${sign}${m.chgPct.toFixed(2)}%`
  }

  const bigMoverLine = isGainer
    ? `$${biggestMover.symbol} leads the session at +${biggestMover.chgPct.toFixed(2)}% — the biggest move in today's large-cap universe.`
    : `$${biggestMover.symbol} leads the selling at ${biggestMover.chgPct.toFixed(2)}% — the sharpest drop in today's large-cap universe.`


  const ctaLine = isGainer
    ? `Is $${biggestMover.symbol} worth what it's pricing in after today? insic.app/stock/${biggestMover.symbol}`
    : `$${biggestMover.symbol} down ${Math.abs(biggestMover.chgPct).toFixed(1)}% — the value case just got cheaper or the thesis just broke. insic.app/stock/${biggestMover.symbol}`
  const lines = [
    `Today's biggest movers — ${dayName}`,
    ``,
    `Winners`,
    ...gainers.map(fmtMover),
    ``,
    `Losers`,
    ...losers.map(fmtMover),
    ``,
    bigMoverLine,
    dcfContext,
    ``,
    ctaLine,
    `$${biggestMover.symbol} #Stocks #Markets #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: undervalued_list ───────────────────────────────────────────────────
// Daily weekday post at 2PM ART. Core engagement driver — StockWorthy's
// top-performing format. 5–6 undervalued stocks from a broad quality pool,
// sorted by DCF upside, with rotating question at end to drive replies/bookmarks.

const UNDERVALUED_QUESTIONS = [
  `Are you buying any of these?`,
  `Which one would you add to the watchlist?`,
  `Any of these in your portfolio?`,
  `Which one has the strongest case?`,
  `Which one are you most skeptical about?`,
  `Would you buy at today's price?`,
  `Any surprises on this list?`,
]

const UNDERVALUED_POOL = [...new Set([
  'AAPL','MSFT','GOOGL','META','AMZN','NVDA','TSLA','JPM','V','MA',
  'UNH','LLY','AVGO','MRK','PG','HD','KO','PEP','TMO','ABT',
  'COST','WMT','SBUX','MCD','NKE','JNJ','PFE','ABBV','BMY','GILD',
  'JPM','BAC','GS','MS','BLK','AXP','V','MA',
  'XOM','CVX','COP','EOG','SLB',
  'INTC','AMD','QCOM','TXN','MU','AMAT','AVGO',
  'CRM','NOW','ADBE','ORCL','INTU','WDAY',
  'HON','CAT','GE','RTX','DE','MMM',
  'NFLX','DIS','CMCSA','T','VZ',
])]

async function runUndervaluedList() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const dayOfWeek = new Date().getDay()

  // Rotate which slice of the pool we screen each day
  const sliceStart = (dayOfYear * 13) % (UNDERVALUED_POOL.length - 30)
  const pool = UNDERVALUED_POOL.slice(sliceStart, sliceStart + 30)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside     = appUpside(d)
      const fair       = appFairValue(d)
      const price      = d?.quote?.price
      const roicSpread = d?.scores?.roic?.spread ?? null
      const piotroski  = d?.scores?.piotroski?.score ?? null
      if (upside == null || !fair || !price) return
      if (upside < 0.10) return  // minimum 10% upside
      // Quality filter — exclude businesses destroying capital severely
      if (roicSpread != null && roicSpread < -0.05) return
      if (piotroski != null && piotroski < 3) return
      const sector   = d?.quote?.sector ?? ''
      const fwdPE    = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      scored.push({ ticker, upside, fair, price, sector, fwdPE, analyst1y, roicSpread, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('undervalued_list: not enough data'); return }

  scored.sort((a, b) => b.upside - a.upside)
  const top = scored.slice(0, 6)

  const question = UNDERVALUED_QUESTIONS[dayOfYear % UNDERVALUED_QUESTIONS.length]
  const leader = top[0]
  const leaderUpside = (leader.upside * 100).toFixed(0)

  // Build the list — compact, scannable, no jargon
  const stockLines = top.map((s, i) => {
    const upsideStr = (s.upside * 100).toFixed(0)
    const fwdStr = s.fwdPE != null ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''
    const growthStr = s.analyst1y != null ? ` · ${(s.analyst1y * 100).toFixed(0)}% rev growth` : ''
    return `${i + 1}. $${s.ticker} — ${fmt(s.price)} · fair value ${fmt(s.fair)} (${upsideStr}% upside)${fwdStr}${growthStr}`
  })

  const lines = [
    `${leaderUpside}%+ gap between price and model value on $${leader.ticker}.`,
    ``,
    `Here are ${top.length} stocks our DCF model flags as undervalued right now:`,
    ``,
    ...stockLines,
    ``,
    question,
    ``,
    `Full models`,
    `#ValueInvesting #DCF #Stocks #Investing`,
  ]

  await post(lines.join('\n'))
}

// ─── Mode: sector_undervalued ─────────────────────────────────────────────────
// Weekday afternoon. StockWorthy's "10 undervalued X stocks" format adapted to
// insic.app. Rotates through sectors daily. 5–7 stocks, hook + list + question.

const SECTOR_UNDERVALUED_THEMES = [
  { name: 'AI & cloud',           emoji: '🤖', tickers: ['NVDA','MSFT','GOOGL','META','AMZN','CRM','NOW','ORCL','IBM','ADBE'] },
  { name: 'semiconductor',        emoji: '🔬', tickers: ['NVDA','AMD','INTC','QCOM','AVGO','TXN','MU','AMAT','LRCX','KLAC'] },
  { name: 'healthcare',           emoji: '💊', tickers: ['UNH','LLY','ABBV','MRK','JNJ','PFE','AMGN','BMY','GILD','TMO'] },
  { name: 'financial',            emoji: '🏦', tickers: ['JPM','BAC','GS','MS','V','MA','BLK','AXP','BX','SCHW'] },
  { name: 'consumer',             emoji: '🛒', tickers: ['AAPL','AMZN','WMT','COST','HD','MCD','SBUX','NKE','TGT','CMG'] },
  { name: 'energy',               emoji: '⛽', tickers: ['XOM','CVX','COP','EOG','SLB','MPC','PSX','OXY','DVN','PXD'] },
  { name: 'dividend',             emoji: '💰', tickers: ['JNJ','PG','KO','PEP','MMM','VZ','T','MCD','MO','PM'] },
]

async function runSectorUndervalued() {
  const dayOfYear  = Math.floor(Date.now() / 86400000)
  const theme = SECTOR_UNDERVALUED_THEMES[dayOfYear % SECTOR_UNDERVALUED_THEMES.length]
  const question = UNDERVALUED_QUESTIONS[(dayOfYear + 3) % UNDERVALUED_QUESTIONS.length]

  const scored = []
  await Promise.all(theme.tickers.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside  = appUpside(d)
      const fair    = appFairValue(d)
      const price   = d?.quote?.price
      const fwdPE   = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      const roicSpread = d?.scores?.roic?.spread ?? null
      if (upside == null || !fair || !price) return
      scored.push({ ticker, upside, fair, price, fwdPE, analyst1y, roicSpread, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn(`sector_undervalued: not enough ${theme.name} data`); return }

  // Show all — sorted by upside, top 6 max
  scored.sort((a, b) => b.upside - a.upside)
  const undervalued = scored.filter(s => s.upside > 0.05).slice(0, 6)
  const overvalued  = scored.filter(s => s.upside < -0.05).sort((a, b) => a.upside - b.upside).slice(0, 2)

  if (undervalued.length === 0) { console.warn('No undervalued names in sector'); return }

  const leader = undervalued[0]
  const leaderUpside = (leader.upside * 100).toFixed(0)

  const uvLines = undervalued.map((s, i) => {
    const upsideStr = (s.upside * 100).toFixed(0)
    const fwdStr  = s.fwdPE     != null ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''
    const growStr = s.analyst1y != null ? ` · ${(s.analyst1y * 100).toFixed(0)}% est growth` : ''
    return `${i + 1}. $${s.ticker} — ${fmt(s.price)} · fair value ${fmt(s.fair)} (${upsideStr}% upside)${fwdStr}${growStr}`
  })

  const ovLines = overvalued.length > 0
    ? [``, `Also in the ${theme.name} space — trading above model:`,
       ...overvalued.map(s => `▼ $${s.ticker} — ${fmt(s.price)} · model ${fmt(s.fair)} (${(s.upside * 100).toFixed(0)}%)`)]
    : []

  const lines = [
    `${theme.emoji} ${leaderUpside}% upside on $${leader.ticker} — the best-valued name in the ${theme.name} space right now.`,
    ``,
    `Here's how the full sector stacks up on our DCF model:`,
    ``,
    ...uvLines,
    ...ovLines,
    ``,
    question,
    ``,
    `Run any of these`,
    `#${theme.name.replace(/[^a-zA-Z]/g, '')} #ValueInvesting #DCF #Stocks`,
  ]

  await post(lines.join('\n'))
}

// Shared question pools used across list modes
const LIST_QUESTIONS_BULLISH = [
  `Are you buying any of these?`,
  `Which one would you add to the watchlist?`,
  `Any of these in your portfolio?`,
  `Which one has the strongest case?`,
  `Any surprises on this list?`,
  `Which one would you bet on?`,
  `Would you buy at today's price?`,
]
const LIST_QUESTIONS_BEARISH = [
  `Which one do you think bounces first?`,
  `Any of these turnaround candidates?`,
  `Which one would you avoid?`,
  `Capitulation or value trap?`,
  `Any of these worth a closer look?`,
  `Which one has the weakest thesis right now?`,
  `Would you buy the dip on any of these?`,
]
const LIST_QUESTIONS_MIXED = [
  `Which side of this list are you on?`,
  `Any surprises here?`,
  `Which one stands out to you?`,
  `Would you buy, hold, or sell any of these?`,
  `Which one do you think the market has most wrong?`,
]

// ─── Mode: biggest_losers_day ─────────────────────────────────────────────────
// Today's biggest session losers from a large-cap pool — with DCF context.
// The key question: price drop or business problem? Drives debate and replies.
// Fires at 5:30PM ART (20:30 UTC) Mon-Fri — after the close.

async function runBiggestLosersDay() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      if (chgPct > -1.5) return null  // only meaningful drops
      return { symbol: t, price: meta.regularMarketPrice, chgPct, marketCap: meta.marketCap ?? 0 }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('biggest_losers_day: not enough data'); return }

  results.sort((a, b) => a.chgPct - b.chgPct)  // worst first
  const losers = results.slice(0, 5)
  const worst = losers[0]

  // Get DCF context on the biggest loser
  let dcfLine = null
  try {
    const data = await fetchValuation(worst.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLine = impliedG != null
        ? `After the drop, $${worst.symbol} is pricing in ~${pct(impliedG, false)}/yr growth. Model fair value: ${fmt(fair)} (${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(0)}% from here).`
        : `Model puts fair value at ${fmt(fair)} — ${upside >= 0 ? `${(upside * 100).toFixed(0)}% above` : `${Math.abs(upside * 100).toFixed(0)}% below`} today's close.`
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BEARISH[dayOfYear % LIST_QUESTIONS_BEARISH.length]

  const lines = [
    `Today's biggest losers — ${dayName}`,
    ``,
    `$${worst.symbol} leads the selling at ${worst.chgPct.toFixed(1)}%.`,
    ``,
    ...losers.map((s, i) => `${i + 1}. $${s.symbol} — ${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    dcfLine,
    ``,
    `Price drops ≠ business breaks. Worth checking which.`,
    question,
    ``,
    `#StockMarket #Losers #Investing #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: biggest_winners_day ────────────────────────────────────────────────
// Today's biggest session winners — with DCF context on whether the move
// is justified or euphoric. Fires at 5:30PM ART (20:30 UTC) alternating days.

async function runBiggestWinnersDay() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      if (chgPct < 1.5) return null  // only meaningful moves
      return { symbol: t, price: meta.regularMarketPrice, chgPct, marketCap: meta.marketCap ?? 0 }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('biggest_winners_day: not enough data'); return }

  results.sort((a, b) => b.chgPct - a.chgPct)  // best first
  const winners = results.slice(0, 5)
  const best = winners[0]

  let dcfLine = null
  try {
    const data = await fetchValuation(best.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      const note = upside < -0.10
        ? `Model says fair value is ${fmt(fair)} — still ${Math.abs((upside * 100).toFixed(0))}% below today's price even after the move.`
        : upside > 0.10
        ? `Model says fair value is ${fmt(fair)} — still ${(upside * 100).toFixed(0)}% above today's price. The move may have more room.`
        : `Model puts fair value near ${fmt(fair)} — roughly where it's trading now.`
      dcfLine = note
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `Today's biggest winners — ${dayName}`,
    ``,
    `$${best.symbol} leads at +${best.chgPct.toFixed(1)}%.`,
    ``,
    ...winners.map((s, i) => `${i + 1}. $${s.symbol} — +${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    dcfLine,
    ``,
    `A big move is information. The question is whether the business changed or just the price.`,
    question,
    ``,
    `#StockMarket #Winners #Investing #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: ytd_losers ─────────────────────────────────────────────────────────
// Stocks down the most year-to-date from the large-cap pool.
// The most controversial list — every name has a contrarian bull thesis.
// Fires Saturday afternoon — high weekend engagement.

async function runYtdLosers() {
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      // Use 1y range to get YTD change
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=ytd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const result = d?.chart?.result?.[0]
      const closes = result?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta = result?.meta
      if (closes.length < 10 || !meta?.regularMarketPrice) return null
      const ytdStart = closes[0]
      const ytdChg = (meta.regularMarketPrice - ytdStart) / ytdStart * 100
      if (ytdChg > -10) return null  // only meaningful YTD losers
      return { symbol: t, price: meta.regularMarketPrice, ytdChg, high52: meta.fiftyTwoWeekHigh ?? null }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('ytd_losers: not enough data'); return }

  results.sort((a, b) => a.ytdChg - b.ytdChg)
  const losers = results.slice(0, 6)
  const worst = losers[0]

  // Get DCF context on the worst YTD loser
  let dcfLine = null
  try {
    const data = await fetchValuation(worst.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    if (fair && upside != null) {
      dcfLine = upside > 0.10
        ? `Our model on $${worst.symbol}: fair value ${fmt(fair)} — ${(upside * 100).toFixed(0)}% above today's price. The selloff may have created an entry.`
        : upside < -0.05
        ? `Our model on $${worst.symbol}: fair value ${fmt(fair)} — still ${Math.abs((upside * 100).toFixed(0))}% below current price even after the drop.`
        : `Our model on $${worst.symbol}: fair value near ${fmt(fair)} — roughly fair at current levels.`
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BEARISH[(dayOfYear + 2) % LIST_QUESTIONS_BEARISH.length]

  const lines = [
    `The biggest large-cap losers of ${new Date().getFullYear()} so far.`,
    ``,
    `$${worst.symbol} leads — down ${Math.abs(worst.ytdChg).toFixed(0)}% year-to-date.`,
    ``,
    ...losers.map((s, i) => {
      const fromHigh = s.high52 ? ` · ${Math.abs(((s.price - s.high52) / s.high52) * 100).toFixed(0)}% off high` : ''
      return `${i + 1}. $${s.symbol} — ${s.ytdChg.toFixed(0)}% YTD · now ${fmt(s.price)}${fromHigh}`
    }),
    ``,
    dcfLine,
    ``,
    question,
    ``,
    `#StockMarket #YTD #ValueInvesting #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: ytd_winners ────────────────────────────────────────────────────────
// Stocks up the most year-to-date — with valuation check.
// "Are these still cheap after the run?" drives engagement.
// Fires Sunday afternoon.

async function runYtdWinners() {
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=ytd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const result = d?.chart?.result?.[0]
      const closes = result?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta = result?.meta
      if (closes.length < 10 || !meta?.regularMarketPrice) return null
      const ytdStart = closes[0]
      const ytdChg = (meta.regularMarketPrice - ytdStart) / ytdStart * 100
      if (ytdChg < 15) return null  // only meaningful YTD winners
      return { symbol: t, price: meta.regularMarketPrice, ytdChg }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('ytd_winners: not enough data'); return }

  results.sort((a, b) => b.ytdChg - a.ytdChg)
  const winners = results.slice(0, 6)
  const best = winners[0]

  let dcfLine = null
  try {
    const data = await fetchValuation(best.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLine = upside < -0.15
        ? `After a ${best.ytdChg.toFixed(0)}% run, our model puts $${best.symbol} fair value at ${fmt(fair)} — the stock is now ${Math.abs((upside * 100).toFixed(0))}% above it. A lot of good news is priced in.`
        : upside > 0.10
        ? `Despite the ${best.ytdChg.toFixed(0)}% run, model still sees ${(upside * 100).toFixed(0)}% upside on $${best.symbol}. Fair value: ${fmt(fair)}.`
        : `Model puts $${best.symbol} fair value near ${fmt(fair)} — roughly in line with today's price after the run.`
      if (impliedG != null) dcfLine += ` Market pricing in ~${pct(impliedG, false)}/yr growth.`
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `The best-performing large caps of ${new Date().getFullYear()} so far.`,
    ``,
    `$${best.symbol} leads — up ${best.ytdChg.toFixed(0)}% year-to-date.`,
    ``,
    ...winners.map((s, i) => `${i + 1}. $${s.symbol} — +${s.ytdChg.toFixed(0)}% YTD · now ${fmt(s.price)}`),
    ``,
    dcfLine,
    ``,
    question,
    ``,
    `#StockMarket #YTD #Investing #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: near_52w_high ──────────────────────────────────────────────────────
// Stocks approaching or at 52-week highs — momentum + valuation tension.
// "Breaking out or running out of room?" is the question readers want answered.

async function runNear52wHigh() {
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1y`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice || !meta?.fiftyTwoWeekHigh) return null
      const pctFromHigh = (meta.regularMarketPrice - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh * 100
      if (pctFromHigh < -5) return null  // only within 5% of 52W high
      return { symbol: t, price: meta.regularMarketPrice, high52: meta.fiftyTwoWeekHigh, pctFromHigh }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('near_52w_high: not enough data'); return }

  results.sort((a, b) => b.pctFromHigh - a.pctFromHigh)  // closest to high first
  const picks = results.slice(0, 6)

  // DCF check on the one at highest relative to its peak
  const featured = picks[0]
  let dcfLine = null
  try {
    const data = await fetchValuation(featured.symbol)
    const fair   = appFairValue(data)
    const upside = appUpside(data)
    if (fair && upside != null) {
      dcfLine = upside < -0.15
        ? `$${featured.symbol} at a 52-week high — and our model puts fair value at ${fmt(fair)}, ${Math.abs((upside * 100).toFixed(0))}% below current price. Momentum vs fundamentals.`
        : upside > 0.10
        ? `Interesting: $${featured.symbol} near a 52-week high and the model still sees ${(upside * 100).toFixed(0)}% upside. Fair value: ${fmt(fair)}.`
        : `Model puts $${featured.symbol} fair value near ${fmt(fair)} — consistent with where it's trading at the high.`
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_MIXED[(dayOfYear + 1) % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `These large caps are trading at or near 52-week highs right now.`,
    ``,
    ...picks.map((s, i) => {
      const atHigh = s.pctFromHigh >= -0.5 ? ' — AT HIGH' : ` — ${Math.abs(s.pctFromHigh).toFixed(1)}% below high`
      return `${i + 1}. $${s.symbol} — ${fmt(s.price)}${atHigh}`
    }),
    ``,
    dcfLine,
    ``,
    `Breaking out, or running out of room?`,
    question,
    ``,
    `#StockMarket #Breakout #52WeekHigh #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: most_shorted ───────────────────────────────────────────────────────
// Stocks with the highest short interest in our large-cap universe.
// High short interest + positive ROIC = squeeze candidate. Drives debate.
// Uses Yahoo Finance data (shortPercentOfFloat available in quote).

async function runMostShorted() {
  const dayOfYear = Math.floor(Date.now() / 86400000)

  // Fetch short interest data via Yahoo v7 quote endpoint
  const BATCH = MOVERS_POOL.slice(0, 40)
  const results = []
  for (let i = 0; i < BATCH.length; i += 8) {
    const batch = BATCH.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      return { symbol: t, price: meta.regularMarketPrice, chgPct: ((meta.regularMarketPrice - (meta.chartPreviousClose ?? meta.regularMarketPrice)) / (meta.chartPreviousClose ?? meta.regularMarketPrice)) * 100 }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < BATCH.length) await new Promise(r => setTimeout(r, 300))
  }

  // Get short interest from /api/financials for a sample
  const candidates = []
  for (const r of results.slice(0, 20)) {
    try {
      const data = await fetchValuation(r.symbol)
      const shortPct = data?.ownership?.shortPct ?? null
      if (!shortPct || shortPct < 0.04) continue  // >4% short interest
      const upside    = appUpside(data)
      const fair      = appFairValue(data)
      const roicSpread = data?.scores?.roic?.spread ?? null
      candidates.push({ symbol: r.symbol, price: r.price, shortPct, upside, fair, roicSpread })
    } catch { /* skip */ }
  }

  if (candidates.length < 3) { console.warn('most_shorted: not enough data'); return }

  candidates.sort((a, b) => b.shortPct - a.shortPct)
  const picks = candidates.slice(0, 5)
  const featured = picks[0]

  const squeezeNote = (() => {
    const highShort = picks.filter(p => p.shortPct > 0.08)
    const bullishModel = picks.filter(p => (p.upside ?? 0) > 0.10)
    if (highShort.length > 0 && bullishModel.length > 0) {
      const overlap = highShort.filter(p => bullishModel.find(b => b.symbol === p.symbol))
      if (overlap.length > 0) return `$${overlap[0].symbol} is heavily shorted — and our model sees ${(overlap[0].upside * 100).toFixed(0)}% upside. That's a setup worth watching.`
    }
    return `High short interest can mean the market is right, or it can mean crowded pessimism. The model helps separate the two.`
  })()

  const question = LIST_QUESTIONS_MIXED[(dayOfYear + 4) % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `The most shorted large-cap stocks right now.`,
    ``,
    `High short interest = the market is betting against these.`,
    ``,
    ...picks.map((s, i) => {
      const shortStr = `${(s.shortPct * 100).toFixed(1)}% of float shorted`
      const modelStr = s.upside != null && s.fair != null
        ? ` · model ${(s.upside >= 0 ? '+' : '') + (s.upside * 100).toFixed(0)}% to ${fmt(s.fair)}`
        : ''
      return `${i + 1}. $${s.symbol} — ${shortStr}${modelStr}`
    }),
    ``,
    squeezeNote,
    ``,
    question,
    ``,
    `#ShortSqueeze #StockMarket #Investing #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── LinkedIn versions of new list modes ──────────────────────────────────────
// Same data as X equivalents, same emoji-bullet structure, more context per item.

async function runLiUndervaluedList() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 13) % (UNDERVALUED_POOL.length - 30)
  const pool = UNDERVALUED_POOL.slice(sliceStart, sliceStart + 30)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside = appUpside(d); const fair = appFairValue(d); const price = d?.quote?.price
      const roicSpread = d?.scores?.roic?.spread ?? null
      const piotroski  = d?.scores?.piotroski?.score ?? null
      if (upside == null || !fair || !price || upside < 0.10) return
      if (roicSpread != null && roicSpread < -0.05) return
      if (piotroski != null && piotroski < 3) return
      const fwdPE = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      const hist3y = d?.cagrAnalysis?.historicalCagr3y ?? null
      const sector = d?.quote?.sector ?? ''
      scored.push({ ticker, upside, fair, price, fwdPE, analyst1y, hist3y, roicSpread, sector, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('li_undervalued_list: not enough data'); return }
  scored.sort((a, b) => b.upside - a.upside)
  const top = scored.slice(0, 6)
  const leader = top[0]
  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const stockLines = top.flatMap(s => {
    const upsideStr = (s.upside * 100).toFixed(0)
    const roicNote = s.roicSpread != null && s.roicSpread > 0.05
      ? ` · returns ${(s.roicSpread * 100).toFixed(0)}pp above cost of capital`
      : s.roicSpread != null && s.roicSpread < -0.02 ? ` · returns below cost of capital` : ''
    const growthNote = s.analyst1y != null ? ` · ${(s.analyst1y * 100).toFixed(0)}% revenue growth forecast` : s.hist3y != null ? ` · ${(s.hist3y * 100).toFixed(0)}% 3Y growth` : ''
    const peNote = s.fwdPE != null ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''
    return [
      `💰 $${s.ticker} — ${fmt(s.price)} → model ${fmt(s.fair)} (+${upsideStr}% upside)${peNote}${growthNote}${roicNote}`,
      historicalContext(s.d, s.ticker) ? `   ${historicalContext(s.d, s.ticker)}` : null,
    ].filter(Boolean)
  })

  const lines = [
    `${(leader.upside * 100).toFixed(0)}% gap between price and fair value on $${leader.ticker}.`,
    ``,
    `Here are ${top.length} stocks our DCF model flags as undervalued right now:`,
    ``,
    ...stockLines,
    ``,
    question,
    ``,
    `#ValueInvesting #DCF #Stocks #Investing`,
  ]
  await postLinkedIn(lines.join('\n'))
}

async function runLiSectorUndervalued() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const theme = SECTOR_UNDERVALUED_THEMES[dayOfYear % SECTOR_UNDERVALUED_THEMES.length]
  const question = LIST_QUESTIONS_BULLISH[(dayOfYear + 3) % LIST_QUESTIONS_BULLISH.length]

  const scored = []
  await Promise.all(theme.tickers.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside = appUpside(d); const fair = appFairValue(d); const price = d?.quote?.price
      const fwdPE = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      const roicSpread = d?.scores?.roic?.spread ?? null
      const hist3y = d?.cagrAnalysis?.historicalCagr3y ?? null
      if (upside == null || !fair || !price) return
      scored.push({ ticker, upside, fair, price, fwdPE, analyst1y, roicSpread, hist3y, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn(`li_sector_undervalued: not enough data`); return }
  scored.sort((a, b) => b.upside - a.upside)
  const undervalued = scored.filter(s => s.upside > 0.05).slice(0, 6)
  const overvalued  = scored.filter(s => s.upside < -0.05).sort((a, b) => a.upside - b.upside).slice(0, 2)
  if (undervalued.length === 0) { console.warn('li_sector_undervalued: no undervalued names'); return }

  const leader = undervalued[0]
  const uvLines = undervalued.flatMap(s => {
    const upsideStr = (s.upside * 100).toFixed(0)
    const peNote = s.fwdPE != null ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''
    const growthNote = s.analyst1y != null ? ` · ${(s.analyst1y * 100).toFixed(0)}% growth forecast` : ''
    const roicNote = s.roicSpread != null && s.roicSpread > 0.05 ? ` · strong returns` : s.roicSpread != null && s.roicSpread < -0.02 ? ` · returns below cost of capital` : ''
    return [
      `▲ $${s.ticker} — ${fmt(s.price)} → ${fmt(s.fair)} (+${upsideStr}% upside)${peNote}${growthNote}${roicNote}`,
      historicalContext(s.d, s.ticker) ? `   ${historicalContext(s.d, s.ticker)}` : null,
    ].filter(Boolean)
  })
  const ovLines = overvalued.length > 0
    ? [``, `Trading above model in the same space:`,
       ...overvalued.map(s => `▼ $${s.ticker} — ${fmt(s.price)} · model ${fmt(s.fair)} (${(s.upside * 100).toFixed(0)}%)`)]
    : []

  const lines = [
    `${theme.emoji} ${(leader.upside * 100).toFixed(0)}% upside on $${leader.ticker} — the best-valued name in the ${theme.name} space right now.`,
    ``,
    `Full breakdown across the sector:`,
    ``,
    ...uvLines,
    ...ovLines,
    ``,
    question,
    ``,
    `#${theme.name.replace(/[^a-zA-Z]/g, '')} #ValueInvesting #DCF #Investing`,
  ]
  await postLinkedIn(lines.join('\n'))
}

async function runLiBiggestLosersDay() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      if (chgPct > -1.5) return null
      return { symbol: t, price: meta.regularMarketPrice, chgPct }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('li_biggest_losers_day: not enough data'); return }
  results.sort((a, b) => a.chgPct - b.chgPct)
  const losers = results.slice(0, 5)
  const worst = losers[0]

  let dcfLines = []
  try {
    const data = await fetchValuation(worst.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLines.push(impliedG != null
        ? `After the drop, $${worst.symbol} is pricing in ~${pct(impliedG, false)}/yr growth. Model fair value: ${fmt(fair)} (${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(0)}% from here).`
        : `Model puts $${worst.symbol} fair value at ${fmt(fair)} — ${upside >= 0 ? `${(upside * 100).toFixed(0)}% above` : `${Math.abs(upside * 100).toFixed(0)}% below`} today's close.`)
      const hist = historicalContext(data, worst.symbol)
      if (hist) dcfLines.push(`   ${hist}`)
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BEARISH[dayOfYear % LIST_QUESTIONS_BEARISH.length]

  const lines = [
    `Today's biggest large-cap losers — ${dayName}`,
    ``,
    `$${worst.symbol} leads the selling at ${worst.chgPct.toFixed(1)}%.`,
    ``,
    ...losers.map((s, i) => `${i + 1}. $${s.symbol} — ${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    ...dcfLines,
    ``,
    `Price drops and business deterioration are very different things. Worth checking which this is.`,
    question,
    ``,
    `#StockMarket #Investing #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiBiggestWinnersDay() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      if (chgPct < 1.5) return null
      return { symbol: t, price: meta.regularMarketPrice, chgPct }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('li_biggest_winners_day: not enough data'); return }
  results.sort((a, b) => b.chgPct - a.chgPct)
  const winners = results.slice(0, 5)
  const best = winners[0]

  let dcfLines = []
  try {
    const data = await fetchValuation(best.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      const note = upside < -0.10
        ? `Model puts $${best.symbol} fair value at ${fmt(fair)} — ${Math.abs((upside * 100).toFixed(0))}% below today's price even after the move. Momentum vs fundamentals.`
        : upside > 0.10
        ? `Model still sees ${(upside * 100).toFixed(0)}% upside on $${best.symbol} at ${fmt(fair)} — the move may have more room.`
        : `Model puts $${best.symbol} fair value near ${fmt(fair)} — roughly consistent with where it's trading at today's high.`
      dcfLines.push(note)
      if (impliedG) dcfLines.push(`At today's price, the market is pricing in ~${pct(impliedG, false)}/yr growth.`)
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `Today's biggest large-cap winners — ${dayName}`,
    ``,
    `$${best.symbol} leads at +${best.chgPct.toFixed(1)}%.`,
    ``,
    ...winners.map((s, i) => `${i + 1}. $${s.symbol} — +${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    ...dcfLines,
    ``,
    `A big move is information. The question is whether the business actually changed.`,
    question,
    ``,
    `#StockMarket #Investing #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiYtdLosers() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=ytd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const result = d?.chart?.result?.[0]
      const closes = result?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta = result?.meta
      if (closes.length < 10 || !meta?.regularMarketPrice) return null
      const ytdChg = (meta.regularMarketPrice - closes[0]) / closes[0] * 100
      if (ytdChg > -10) return null
      return { symbol: t, price: meta.regularMarketPrice, ytdChg, high52: meta.fiftyTwoWeekHigh ?? null }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('li_ytd_losers: not enough data'); return }
  results.sort((a, b) => a.ytdChg - b.ytdChg)
  const losers = results.slice(0, 6)
  const worst = losers[0]

  let dcfLines = []
  try {
    const data = await fetchValuation(worst.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    if (fair && upside != null) {
      dcfLines.push(upside > 0.10
        ? `Our model on $${worst.symbol}: fair value ${fmt(fair)} — ${(upside * 100).toFixed(0)}% above today's price. The selloff may have created an entry point.`
        : upside < -0.05
        ? `Our model on $${worst.symbol}: fair value ${fmt(fair)} — still ${Math.abs((upside * 100).toFixed(0))}% below current price even after the drop.`
        : `Our model on $${worst.symbol}: fair value near ${fmt(fair)} — roughly fair at current levels.`)
      const hist = historicalContext(data, worst.symbol)
      if (hist) dcfLines.push(`   ${hist}`)
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_BEARISH[(dayOfYear + 2) % LIST_QUESTIONS_BEARISH.length]

  const lines = [
    `The biggest large-cap losers of ${new Date().getFullYear()} so far.`,
    ``,
    `$${worst.symbol} leads — down ${Math.abs(worst.ytdChg).toFixed(0)}% year-to-date.`,
    ``,
    ...losers.map((s, i) => {
      const fromHigh = s.high52 ? ` · ${Math.abs(((s.price - s.high52) / s.high52) * 100).toFixed(0)}% off 52W high` : ''
      return `${i + 1}. $${s.symbol} — ${s.ytdChg.toFixed(0)}% YTD · now ${fmt(s.price)}${fromHigh}`
    }),
    ``,
    ...dcfLines,
    ``,
    question,
    ``,
    `#Investing #YTD #ValueInvesting #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiYtdWinners() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=ytd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const result = d?.chart?.result?.[0]
      const closes = result?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta = result?.meta
      if (closes.length < 10 || !meta?.regularMarketPrice) return null
      const ytdChg = (meta.regularMarketPrice - closes[0]) / closes[0] * 100
      if (ytdChg < 15) return null
      return { symbol: t, price: meta.regularMarketPrice, ytdChg }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('li_ytd_winners: not enough data'); return }
  results.sort((a, b) => b.ytdChg - a.ytdChg)
  const winners = results.slice(0, 6)
  const best = winners[0]

  let dcfLines = []
  try {
    const data = await fetchValuation(best.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLines.push(upside < -0.15
        ? `After a ${best.ytdChg.toFixed(0)}% run, our model puts $${best.symbol} fair value at ${fmt(fair)} — the stock is now ${Math.abs((upside * 100).toFixed(0))}% above it.`
        : upside > 0.10
        ? `Despite the ${best.ytdChg.toFixed(0)}% run, model still sees ${(upside * 100).toFixed(0)}% upside on $${best.symbol}. Fair value: ${fmt(fair)}.`
        : `Model puts $${best.symbol} fair value near ${fmt(fair)} — roughly in line with today's price after the run.`)
      if (impliedG) dcfLines.push(`The market is pricing in ~${pct(impliedG, false)}/yr growth.`)
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `The best-performing large caps of ${new Date().getFullYear()} so far.`,
    ``,
    `$${best.symbol} leads — up ${best.ytdChg.toFixed(0)}% year-to-date.`,
    ``,
    ...winners.map((s, i) => `${i + 1}. $${s.symbol} — +${s.ytdChg.toFixed(0)}% YTD · now ${fmt(s.price)}`),
    ``,
    ...dcfLines,
    ``,
    question,
    ``,
    `#Investing #YTD #DCF #StockMarket`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiNear52wHigh() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1y`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice || !meta?.fiftyTwoWeekHigh) return null
      const pctFromHigh = (meta.regularMarketPrice - meta.fiftyTwoWeekHigh) / meta.fiftyTwoWeekHigh * 100
      if (pctFromHigh < -5) return null
      return { symbol: t, price: meta.regularMarketPrice, high52: meta.fiftyTwoWeekHigh, pctFromHigh }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 3) { console.warn('li_near_52w_high: not enough data'); return }
  results.sort((a, b) => b.pctFromHigh - a.pctFromHigh)
  const picks = results.slice(0, 6)
  const featured = picks[0]

  let dcfLines = []
  try {
    const data = await fetchValuation(featured.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    if (fair && upside != null) {
      dcfLines.push(upside < -0.15
        ? `$${featured.symbol} at a 52-week high — our model puts fair value at ${fmt(fair)}, ${Math.abs((upside * 100).toFixed(0))}% below current price. Momentum and fundamentals are diverging.`
        : upside > 0.10
        ? `Interesting: $${featured.symbol} near a 52-week high and the model still sees ${(upside * 100).toFixed(0)}% upside. Fair value: ${fmt(fair)}.`
        : `Model puts $${featured.symbol} fair value near ${fmt(fair)} — consistent with the current price at the high.`)
    }
  } catch { /* proceed without */ }

  const question = LIST_QUESTIONS_MIXED[(dayOfYear + 1) % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `These large caps are trading at or near 52-week highs.`,
    ``,
    ...picks.map((s, i) => {
      const atHigh = s.pctFromHigh >= -0.5 ? ' — at the high' : ` — ${Math.abs(s.pctFromHigh).toFixed(1)}% below high`
      return `${i + 1}. $${s.symbol} — ${fmt(s.price)}${atHigh}`
    }),
    ``,
    ...dcfLines,
    ``,
    `Breaking out, or running out of room?`,
    question,
    ``,
    `#StockMarket #Investing #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiMostShorted() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const BATCH = MOVERS_POOL.slice(0, 40)
  const results = []
  for (let i = 0; i < BATCH.length; i += 8) {
    const batch = BATCH.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      return { symbol: t, price: meta.regularMarketPrice }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < BATCH.length) await new Promise(r => setTimeout(r, 300))
  }

  const candidates = []
  for (const r of results.slice(0, 20)) {
    try {
      const data = await fetchValuation(r.symbol)
      const shortPct = data?.ownership?.shortPct ?? null
      if (!shortPct || shortPct < 0.04) continue
      const upside = appUpside(data); const fair = appFairValue(data)
      const roicSpread = data?.scores?.roic?.spread ?? null
      candidates.push({ symbol: r.symbol, price: r.price, shortPct, upside, fair, roicSpread, data: data })
    } catch { /* skip */ }
  }

  if (candidates.length < 3) { console.warn('li_most_shorted: not enough data'); return }
  candidates.sort((a, b) => b.shortPct - a.shortPct)
  const picks = candidates.slice(0, 5)

  const squeezeNote = (() => {
    const highShort = picks.filter(p => p.shortPct > 0.08)
    const bullishModel = picks.filter(p => (p.upside ?? 0) > 0.10)
    const overlap = highShort.filter(p => bullishModel.find(b => b.symbol === p.symbol))
    if (overlap.length > 0) return `$${overlap[0].symbol} is heavily shorted — and our model sees ${(overlap[0].upside * 100).toFixed(0)}% upside. High short interest + undervalued by the model is a setup worth watching.`
    return `High short interest can mean the market is right, or it can mean crowded pessimism. The DCF model separates the two.`
  })()

  const question = LIST_QUESTIONS_MIXED[(dayOfYear + 4) % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `The most shorted large-cap stocks right now.`,
    ``,
    `High short interest means the market is actively betting against these names.`,
    ``,
    ...picks.map((s, i) => {
      const shortStr = `${(s.shortPct * 100).toFixed(1)}% of float shorted`
      const modelStr = s.upside != null && s.fair != null
        ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside * 100).toFixed(0)}% (${fmt(s.fair)})`
        : ''
      return `${i + 1}. $${s.symbol} — ${shortStr}${modelStr}`
    }),
    ``,
    squeezeNote,
    ``,
    question,
    ``,
    `#ShortSelling #StockMarket #Investing #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

async function runLiMovers() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const results = []
  for (let i = 0; i < MOVERS_POOL.length; i += 8) {
    const batch = MOVERS_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.regularMarketPrice) return null
      const prev = meta.chartPreviousClose ?? meta.previousClose ?? null
      if (!prev) return null
      const chgPct = (meta.regularMarketPrice - prev) / prev * 100
      return { symbol: t, price: meta.regularMarketPrice, chgPct }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < MOVERS_POOL.length) await new Promise(r => setTimeout(r, 300))
  }

  if (results.length < 5) { console.warn('li_movers: not enough data'); return }
  results.sort((a, b) => b.chgPct - a.chgPct)
  const gainers = results.slice(0, 3)
  const losers  = results.slice(-3).reverse()
  const biggestMover = Math.abs(gainers[0].chgPct) > Math.abs(losers[0].chgPct) ? gainers[0] : losers[0]
  const isGainer = biggestMover.chgPct > 0

  let dcfLines = []
  try {
    const data = await fetchValuation(biggestMover.symbol)
    const fair = appFairValue(data); const upside = appUpside(data)
    const impliedG = data.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLines.push(impliedG != null
        ? `After today's move, $${biggestMover.symbol} is pricing in ~${pct(impliedG, false)}/yr growth. Model fair value: ${fmt(fair)} (${upside >= 0 ? '+' : ''}${(upside * 100).toFixed(0)}% from here).`
        : `Model puts $${biggestMover.symbol} fair value at ${fmt(fair)} — ${upside >= 0 ? `${(upside * 100).toFixed(0)}% above` : `${Math.abs(upside * 100).toFixed(0)}% below`} today's price.`)
      const hist = historicalContext(data, biggestMover.symbol)
      if (hist) dcfLines.push(`   ${hist}`)
    }
  } catch { /* proceed without */ }

  const question = isGainer
    ? LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]
    : LIST_QUESTIONS_BEARISH[dayOfYear % LIST_QUESTIONS_BEARISH.length]

  const lines = [
    `Today's biggest movers — ${dayName}`,
    ``,
    `Winners`,
    ...gainers.map((s, i) => `${i + 1}. $${s.symbol} — +${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    `Losers`,
    ...losers.map((s, i) => `${i + 1}. $${s.symbol} — ${s.chgPct.toFixed(2)}% · now ${fmt(s.price)}`),
    ``,
    ...dcfLines,
    ``,
    `A big move is information. The question is whether it changed the underlying value.`,
    question,
    ``,
    `#StockMarket #Investing #DCF`,
  ].filter(Boolean)
  await postLinkedIn(lines.join('\n'))
}

// ─── Mode: etf_vs_etf ────────────────────────────────────────────────────────
// Head-to-head ETF comparison using our value scores.
// Picks two contrasting ETFs from scored universe: highest vs lowest,
// or value vs growth. Ends with a "which would you pick?" question.
// Fires Tue/Thu afternoon — drives replies/engagement.

const ETF_VS_PAIRS = [
  // Value vs Growth style
  { a: 'VTV', b: 'VUG',  angle: 'Value vs Growth' },
  // US vs Emerging
  { a: 'SPY', b: 'EEM',  angle: 'US vs Emerging Markets' },
  // Tech vs Energy
  { a: 'XLK', b: 'XLE',  angle: 'Technology vs Energy' },
  // Healthcare vs Financials
  { a: 'XLV', b: 'XLF',  angle: 'Healthcare vs Financials' },
  // US vs Developed World
  { a: 'SPY', b: 'EFA',  angle: 'US vs Developed World' },
  // High Dividend vs Low Vol
  { a: 'VYM', b: 'USMV', angle: 'High Dividend vs Low Volatility' },
  // Nasdaq vs S&P 500
  { a: 'QQQ', b: 'SPY',  angle: 'Nasdaq vs S&P 500' },
  // Industrials vs Consumer
  { a: 'XLI', b: 'XLY',  angle: 'Industrials vs Consumer Cyclical' },
]

const ETF_VS_QUESTIONS = [
  `Which would you pick right now?`,
  `Which side are you on?`,
  `Where's the better entry?`,
  `Which one do you own?`,
  `Make your case.`,
  `Which has more room to run?`,
  `Where would you put $10K today?`,
]

async function runEtfVsEtf() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const pair = ETF_VS_PAIRS[dayOfYear % ETF_VS_PAIRS.length]
  const question = ETF_VS_QUESTIONS[dayOfYear % ETF_VS_QUESTIONS.length]

  const etfs = await fetchLatestEtfScores()
  if (etfs.length < 4) { console.warn('etf_vs_etf: insufficient ETF data — skipping'); return }

  const byTicker = Object.fromEntries(etfs.map(e => [e.ticker, e]))
  const a = byTicker[pair.a]
  const b = byTicker[pair.b]
  if (!a || !b) { console.warn(`etf_vs_etf: missing data for ${pair.a} or ${pair.b}`); return }

  const nameA = ETF_META_MAP[pair.a] ?? pair.a
  const nameB = ETF_META_MAP[pair.b] ?? pair.b

  const fmtStat = (label, val, suffix = '') => val != null ? `${label}: ${val}${suffix}` : null

  const statsA = [
    fmtStat('Score', a.score, '/100'),
    fmtStat('P/E', a.pe_ratio != null ? a.pe_ratio.toFixed(0) + '×' : null),
    fmtStat('Yield', a.yield_val != null && a.yield_val > 0 ? (a.yield_val * 100).toFixed(1) + '%' : null),
    fmtStat('Expense', a.expense_ratio != null ? (a.expense_ratio * 100).toFixed(2) + '%' : null),
  ].filter(Boolean).join(' · ')

  const statsB = [
    fmtStat('Score', b.score, '/100'),
    fmtStat('P/E', b.pe_ratio != null ? b.pe_ratio.toFixed(0) + '×' : null),
    fmtStat('Yield', b.yield_val != null && b.yield_val > 0 ? (b.yield_val * 100).toFixed(1) + '%' : null),
    fmtStat('Expense', b.expense_ratio != null ? (b.expense_ratio * 100).toFixed(2) + '%' : null),
  ].filter(Boolean).join(' · ')

  const winner = a.score > b.score ? pair.a : b.score > a.score ? pair.b : null
  const scoreDiff = Math.abs(a.score - b.score)
  const verdict = winner
    ? `Our value score favors $${winner} by ${scoreDiff} points — cheaper on P/E, P/B, and yield combined.`
    : `Our model scores them equal — the call comes down to what you're optimizing for.`

  const lines = [
    `$${pair.a} or $${pair.b}? — ${pair.angle}`,
    ``,
    `${etfScoreEmoji(a.score)} $${pair.a} (${nameA})`,
    statsA,
    ``,
    `${etfScoreEmoji(b.score)} $${pair.b} (${nameB})`,
    statsB,
    ``,
    verdict,
    ``,
    question,
    ``,
    `#ETF #${pair.a} #${pair.b} #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: profit_forecast_list ───────────────────────────────────────────────
// "Most profitable companies in X" using analyst forward EPS × shares.
// Sorted by projected net income. Drives bookmarks.

async function runProfitForecastList() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const year = new Date().getFullYear() + 1

  const FORECAST_POOL = [
    'AAPL','MSFT','GOOGL','META','NVDA','AMZN','JPMC','V','MA',
    'UNH','LLY','AVGO','XOM','CVX','JNJ','PG','KO','MCD','COST','BRK-B',
  ]
  // Use a rotating subset of 12 each time
  const sliceStart = (dayOfYear * 7) % (FORECAST_POOL.length - 12)
  const pool = FORECAST_POOL.slice(sliceStart, sliceStart + 12)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      // Get forward EPS estimate for next year
      const fwdEps = d?.analystForwardEstimates?.find(e => e?.period === '+1y')?.eps?.avg ?? null
      const shares = d?.quote?.sharesOutstanding ?? null  // in millions (from API)
      const price  = d?.quote?.price ?? null
      const name   = d?.quote?.name ?? ticker
      const sector = d?.quote?.sector ?? ''
      if (!fwdEps || !shares || fwdEps <= 0) return
      // sharesOutstanding is absolute (e.g. 24.2B for NVDA), fwdEps is per share
      // Net income (B) = fwdEps × sharesOutstanding / 1e9
      const projNetIncomeB = (fwdEps * shares) / 1e9  // in billions
      if (projNetIncomeB <= 0) return
      scored.push({ ticker, name, projNetIncomeB, fwdEps, price, sector })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('profit_forecast_list: not enough data'); return }
  scored.sort((a, b) => b.projNetIncomeB - a.projNetIncomeB)
  const top = scored.slice(0, 5)

  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `The most profitable companies on earth by ${year}.`,
    ``,
    `Profit estimates (analyst consensus):`,
    ...top.map((s, i) =>
      `${i + 1}. $${s.ticker} ~$${s.projNetIncomeB >= 100 ? s.projNetIncomeB.toFixed(0) : s.projNetIncomeB.toFixed(1)}B`
    ),
    ``,
    `These aren't just big companies. They're businesses generating more cash than most countries collect in taxes.`,
    ``,
    question,
    ``,
    `#Stocks #Investing #Earnings`,
  ]

  await post(lines.join('\n'))
}

// ─── Mode: etf_ratio_breakdown ────────────────────────────────────────────────
// Deep-dive one ETF per day — all key metrics in one post.
// Rotates through a curated list. Educational + data-rich.

const ETF_BREAKDOWN_TICKERS = [
  'SPY','QQQ','VTI','XLK','XLE','XLF','XLV','EEM','EFA','VTV','VUG','VYM','USMV','IWM','GLD',
]

async function runEtfRatioBreakdown() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const ticker = ETF_BREAKDOWN_TICKERS[dayOfYear % ETF_BREAKDOWN_TICKERS.length]
  const name = ETF_META_MAP[ticker] ?? ticker

  const etfs = await fetchLatestEtfScores()
  const etf = etfs.find(e => e.ticker === ticker)

  // Also fetch 1Y performance from Yahoo
  let ytdChange = null
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=ytd`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
    ).catch(() => null)
    if (res?.ok) {
      const d = await res.json().catch(() => null)
      const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta   = d?.chart?.result?.[0]?.meta
      if (closes.length > 5 && meta?.regularMarketPrice) {
        ytdChange = (meta.regularMarketPrice - closes[0]) / closes[0] * 100
      }
    }
  } catch { /* proceed without */ }

  if (!etf) { console.warn(`etf_ratio_breakdown: no data for ${ticker}`); return }

  const score = etf.score
  const pe    = etf.pe_ratio
  const pb    = etf.pb_ratio
  const yld   = etf.yield_val
  const exp   = etf.expense_ratio

  // Benchmark context
  const peCtx  = pe != null ? (pe < 15 ? 'cheap vs historical norms' : pe < 22 ? 'within normal range' : 'elevated — pricing in growth') : null
  const yldCtx = yld != null && yld > 0 ? (yld > 0.03 ? 'strong yield' : yld > 0.015 ? 'moderate yield' : 'low yield') : null
  const expCtx = exp != null ? (exp < 0.002 ? 'ultra-low cost' : exp < 0.005 ? 'competitive' : 'worth noting') : null

  const statLines = [
    pe   != null ? `▸ P/E: ${pe.toFixed(0)}× — ${peCtx}` : null,
    pb   != null ? `▸ P/B: ${pb.toFixed(1)}×` : null,
    yld  != null && yld > 0 ? `▸ Yield: ${(yld * 100).toFixed(2)}% — ${yldCtx}` : null,
    exp  != null ? `▸ Expense ratio: ${(exp * 100).toFixed(2)}% — ${expCtx}` : null,
    ytdChange != null ? `▸ YTD return: ${ytdChange >= 0 ? '+' : ''}${ytdChange.toFixed(1)}%` : null,
    `▸ Value score: ${score}/100 (${etfScoreLabel(score)})`,
  ].filter(Boolean)

  const lines = [
    `Everything you need to know about $${ticker} (${name}):`,
    ``,
    ...statLines,
    ``,
    `The expense ratio is what you pay every year just to hold it — compounded over 20 years, even 0.1% is real money.`,
    ``,
    `#ETF #${ticker} #Investing #PassiveInvesting`,
  ]

  await post(lines.join('\n'))
}

// ─── Mode: sector_momentum_rank ───────────────────────────────────────────────
// Weekly sector ranking: YTD performance + current P/E vs history + our score.
// The "which sectors are cheap AND performing?" question.

async function runSectorMomentumRank() {
  const dayOfYear = Math.floor(Date.now() / 86400000)

  const SECTOR_ETFS = ['XLK','XLE','XLF','XLV','XLU','XLI','XLP','XLY','XLC','XLB','XLRE']
  const SECTOR_NAMES = {
    XLK:'Technology', XLE:'Energy', XLF:'Financials', XLV:'Healthcare',
    XLU:'Utilities', XLI:'Industrials', XLP:'Cons. Defensive',
    XLY:'Cons. Cyclical', XLC:'Comm. Services', XLB:'Materials', XLRE:'Real Estate',
  }

  // Fetch YTD performance for each sector ETF
  const results = []
  for (let i = 0; i < SECTOR_ETFS.length; i += 4) {
    const batch = SECTOR_ETFS.slice(i, i + 4)
    const settled = await Promise.allSettled(batch.map(async sym => {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?interval=1d&range=ytd`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      ).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta   = d?.chart?.result?.[0]?.meta
      if (closes.length < 5 || !meta?.regularMarketPrice) return null
      const ytdChg = (meta.regularMarketPrice - closes[0]) / closes[0] * 100
      return { sym, ytdChg }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    await new Promise(r => setTimeout(r, 400))
  }

  if (results.length < 5) { console.warn('sector_momentum_rank: not enough data'); return }

  // Get ETF scores
  const etfs = await fetchLatestEtfScores()
  const byTicker = Object.fromEntries(etfs.map(e => [e.ticker, e]))

  // Combine: YTD performance + value score
  const ranked = results
    .map(r => ({
      sym: r.sym,
      name: SECTOR_NAMES[r.sym] ?? r.sym,
      ytdChg: r.ytdChg,
      score: byTicker[r.sym]?.score ?? null,
      pe: byTicker[r.sym]?.pe_ratio ?? null,
    }))
    .sort((a, b) => b.ytdChg - a.ytdChg)

  const best  = ranked[0]
  const worst = ranked[ranked.length - 1]
  // "Sweet spot" — top half performer + high value score
  const sweetSpot = [...ranked]
    .filter(r => r.score != null)
    .sort((a, b) => {
      const aRank = ranked.indexOf(a)
      const bRank = ranked.indexOf(b)
      // Score that rewards both strong momentum AND cheap valuation
      const aScore = (ranked.length - aRank) + (a.score / 10)
      const bScore = (ranked.length - bRank) + (b.score / 10)
      return bScore - aScore
    })[0]

  const lines = [
    `Sector performance YTD — ranked:`,
    ``,
    ...ranked.map((r, i) => {
      const arrow = r.ytdChg >= 2 ? '▲' : r.ytdChg <= -2 ? '▼' : '→'
      const scoreStr = r.score != null ? ` · Score ${r.score}` : ''
      const peStr    = r.pe   != null ? ` · P/E ${r.pe.toFixed(0)}×` : ''
      return `${i + 1}. $${r.sym} (${r.name}) ${arrow} ${r.ytdChg >= 0 ? '+' : ''}${r.ytdChg.toFixed(1)}%${peStr}${scoreStr}`
    }),
    ``,
    sweetSpot
      ? `${SECTOR_NAMES[sweetSpot.sym]} ($${sweetSpot.sym}) stands out — strong performance AND a high value score. The rarest combination.`
      : `${best.name} leads on momentum. ${worst.name} is lagging but may be worth a closer look on valuation.`,
    ``,
    `Which sector are you rotating into?`,
    ``,
    `#Stocks #SectorRotation #ETF #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: dcf_vs_analyst_framed ─────────────────────────────────────────────
// "Analysts say $X is worth $Y. Our model says $Z."
// Framed as a comparison post rather than just divergence.
// More engaging than market_vs_model — leads with the tension directly.

async function runDcfVsAnalystFramed() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const day = new Date().getDay()
  const pool = ROTATION[day] ?? ROTATION[1]

  const candidates = []
  for (const ticker of pool.slice(0, 15)) {
    try {
      const d = await fetchValuation(ticker)
      const ourFair      = appFairValue(d)
      const analystTarget = d?.quote?.analystTargetMean
      const targetLow    = d?.quote?.analystTargetLow
      const targetHigh   = d?.quote?.analystTargetHigh
      const price        = d?.quote?.price
      const numAnalysts  = d?.cagrAnalysis?.numAnalysts ?? 0
      if (!ourFair || !analystTarget || !price || numAnalysts < 5) continue
      const ourUpside     = (ourFair - price) / price
      const streetUpside  = (analystTarget - price) / price
      const divergence    = Math.abs(ourUpside - streetUpside)
      if (divergence < 0.12) continue
      const impliedG   = d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
      const hist3y     = d?.cagrAnalysis?.historicalCagr3y
      candidates.push({ ticker, price, ourFair, analystTarget, targetLow, targetHigh,
                         ourUpside, streetUpside, divergence, numAnalysts, impliedG, hist3y, d })
    } catch { /* skip */ }
  }

  if (candidates.length === 0) { console.warn('dcf_vs_analyst_framed: no divergent picks'); return }
  candidates.sort((a, b) => b.divergence - a.divergence)
  const c = candidates[0]
  const ourIsHigher = c.ourFair > c.analystTarget
  const gapPct = ((c.ourFair - c.analystTarget) / c.analystTarget * 100).toFixed(0)

  const impliedLine = c.impliedG != null && c.hist3y != null
    ? `At ${fmt(c.price)}, the market prices in ${pct(c.impliedG, false)}/yr growth. Historical pace: ${pct(c.hist3y, false)}.`
    : null

  const rangeStr = c.targetLow && c.targetHigh
    ? ` (range: ${fmt(c.targetLow)}–${fmt(c.targetHigh)})`
    : ''

  const lines = [
    ourIsHigher
      ? `${c.numAnalysts} analysts say $${c.ticker} is worth ${fmt(c.analystTarget)}${rangeStr}.`
      : `${c.numAnalysts} analysts say $${c.ticker} is worth ${fmt(c.analystTarget)}${rangeStr}.`,
    ``,
    `Our DCF says ${fmt(c.ourFair)}.`,
    ``,
    `That's a ${Math.abs(Number(gapPct))}% gap. ${ourIsHigher
      ? `We're more bullish. Analysts may be anchored to near-term numbers.`
      : `Analysts are more bullish. Our model doesn't support the target at current assumptions.`}`,
    ``,
    impliedLine,
    ``,
    `Who's right?`,
    ``,
    `$${c.ticker} #DCF #StockMarket #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Shared large-cap pool for new list modes ─────────────────────────────────
const BROAD_POOL = [...new Set([
  'AAPL','MSFT','GOOGL','META','AMZN','NVDA','TSLA','AMD','NFLX','SMCI',
  'PLTR','INTC','QCOM','MU','CRM','NOW','ADBE','ORCL','IBM','AVGO',
  'JPM','BAC','GS','MS','V','MA','BLK','AXP','BX','SCHW',
  'UNH','LLY','ABBV','MRK','JNJ','PFE','AMGN','BMY','GILD','TMO',
  'XOM','CVX','COP','EOG','SLB','MPC','PSX',
  'WMT','COST','AMZN','HD','MCD','SBUX','NKE','CMG','TGT',
  'PG','KO','PEP','MMM','T','VZ','MO',
  'HON','CAT','GE','RTX','DE','BA','LMT',
  'INTU','WDAY','SNOW','PANW','CRWD','ZS',
])]

// ─── Mode: lowest_pe ─────────────────────────────────────────────────────────
// Stocks with lowest forward P/E in the large-cap universe — but quality-filtered.
// Low P/E only means something if the business is healthy.

async function runLowestPe() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 11) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const fwdPE = d?.analystForwardPE ?? null
      const roicSpread = d?.scores?.roic?.spread ?? null
      const piotroski = d?.scores?.piotroski?.score ?? null
      const price = d?.quote?.price
      const fair = appFairValue(d)
      const upside = appUpside(d)
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      const sector = d?.quote?.sector ?? ''
      if (!fwdPE || fwdPE <= 0 || fwdPE > 50 || !price) return
      // Quality filter — must not be destroying capital
      if (roicSpread != null && roicSpread < -0.04) return
      if (piotroski != null && piotroski < 3) return
      scored.push({ ticker, fwdPE, price, fair, upside, analyst1y, roicSpread, sector, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('lowest_pe: not enough data'); return }
  scored.sort((a, b) => a.fwdPE - b.fwdPE)
  const top = scored.slice(0, 6)
  const leader = top[0]
  const dayOfYear2 = Math.floor(Date.now() / 86400000)
  const question = LIST_QUESTIONS_MIXED[dayOfYear2 % LIST_QUESTIONS_MIXED.length]

  const lines = [
    `The 6 cheapest large caps on forward earnings right now.`,
    ``,
    `Low P/E only matters if the business is healthy. These pass the quality filter.`,
    ``,
    ...top.map((s, i) => {
      const roicNote = s.roicSpread != null && s.roicSpread > 0.04 ? ` · ROIC spread +${(s.roicSpread*100).toFixed(0)}pp` : ''
      const growthNote = s.analyst1y != null ? ` · ${(s.analyst1y*100).toFixed(0)}% growth` : ''
      const modelNote = s.upside != null && s.fair ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%` : ''
      return `${i+1}. $${s.ticker} — ${s.fwdPE.toFixed(0)}× fwd P/E${growthNote}${roicNote}${modelNote}`
    }),
    ``,
    `$${leader.ticker} at ${leader.fwdPE.toFixed(0)}× is the cheapest. ${leader.upside != null && leader.upside > 0.05 ? `Our model agrees — ${(leader.upside*100).toFixed(0)}% below fair value.` : leader.upside != null && leader.upside < -0.05 ? `Our model is less convinced — fair value is lower.` : `Our model sees it near fair value.`}`,
    ``,
    question,
    ``,
    `#Stocks #ValueInvesting #PE #Investing`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: lowest_peg ────────────────────────────────────────────────────────
// PEG ratio = forward P/E ÷ earnings growth rate. Below 1.0 = potentially cheap.
// The growth-at-a-reasonable-price (GARP) screen.

async function runLowestPeg() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 17) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const pegRatio = d?.quote?.pegRatio ?? null
      const fwdPE = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      const price = d?.quote?.price
      const upside = appUpside(d)
      const fair = appFairValue(d)
      if (!pegRatio || pegRatio <= 0 || pegRatio > 3 || !price || !fwdPE) return
      // Need positive growth to make PEG meaningful
      if (!analyst1y || analyst1y < 0.05) return
      scored.push({ ticker, pegRatio, fwdPE, analyst1y, price, upside, fair, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('lowest_peg: not enough data'); return }
  scored.sort((a, b) => a.pegRatio - b.pegRatio)
  const top = scored.slice(0, 6)
  const leader = top[0]
  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `PEG ratio below 1.0 = paying less than $1 per dollar of growth. Here's who qualifies.`,
    ``,
    ...top.map((s, i) => {
      const growthStr = `${(s.analyst1y*100).toFixed(0)}% growth`
      const modelNote = s.upside != null ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%` : ''
      return `${i+1}. $${s.ticker} — PEG ${s.pegRatio.toFixed(2)} · ${s.fwdPE.toFixed(0)}× P/E · ${growthStr}${modelNote}`
    }),
    ``,
    `$${leader.ticker} has the lowest PEG at ${leader.pegRatio.toFixed(2)}. That means you're paying ${leader.fwdPE.toFixed(0)}× earnings for ${(leader.analyst1y*100).toFixed(0)}% growth.`,
    ``,
    question,
    ``,
    `#GARP #ValueInvesting #Stocks #Investing`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: analyst_top_buys ───────────────────────────────────────────────────
// Most analyst Buy/Strong Buy ratings + our model's verdict on each.
// The tension when analysts love something our model doesn't = engagement.

async function runAnalystTopBuys() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 13) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const trend = d?.analystRatingTrend ?? []
      if (!trend.length) return
      const latest = trend[0]
      const sb = latest.strongBuy ?? 0
      const b  = latest.buy ?? 0
      const h  = latest.hold ?? 0
      const s  = latest.sell ?? 0
      const ss = latest.strongSell ?? 0
      const total = sb + b + h + s + ss
      if (total < 5) return
      const bullPct = Math.round(((sb + b) / total) * 100)
      if (bullPct < 60) return
      const price = d?.quote?.price
      const fair = appFairValue(d)
      const upside = appUpside(d)
      const target = d?.quote?.analystTargetMean ?? null
      if (!price) return
      scored.push({ ticker, bullPct, total, sb, b, price, fair, upside, target, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('analyst_top_buys: not enough data'); return }
  scored.sort((a, b) => b.bullPct - a.bullPct)
  const top = scored.slice(0, 6)
  const leader = top[0]
  const question = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]

  // Find the most interesting tension — analyst loves it but our model disagrees
  const tension = top.find(s => s.upside != null && s.upside < -0.10)
  const agreement = top.find(s => s.upside != null && s.upside > 0.10)

  // Hook-first: lead with the tension, not the list
  const hookLine = tension
    ? [`${tension.bullPct}% of analysts are bullish on $${tension.ticker}.`, ``, `Our model says it's ${Math.abs((tension.upside*100)).toFixed(0)}% above fair value.`, ``, `Someone is wrong.`]
    : agreement
    ? [`$${agreement.ticker}: ${agreement.bullPct}% analyst consensus AND our model sees ${(agreement.upside*100).toFixed(0)}% upside.`, ``, `Both sides agree — that combination is rare.`]
    : [`${leader.bullPct}% of analysts are bullish on $${leader.ticker}. Here's what the model says.`]

  const lines = [
    ...hookLine,
    ``,
    `Wall Street's most-loved stocks right now:`,
    ``,
    ...top.map((s, i) => {
      const targetNote = s.target ? ` · target ${fmt(s.target)}` : ''
      const modelNote = s.upside != null ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%` : ''
      return `${i+1}. $${s.ticker} — ${s.bullPct}% bullish (${s.total} analysts)${targetNote}${modelNote}`
    }),
    ``,
    question,
    ``,
    `#Stocks #AnalystRatings #WallStreet #Investing`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: highest_upside_consensus ──────────────────────────────────────────
// Biggest gap between current price and analyst consensus target.
// "What if the Street is right?" — drives debate.

async function runHighestUpsideConsensus() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 7) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const price = d?.quote?.price
      const target = d?.quote?.analystTargetMean ?? null
      const numAnalysts = d?.cagrAnalysis?.numAnalysts ?? 0
      if (!price || !target || numAnalysts < 5 || target <= price) return
      const streetUpside = (target - price) / price
      if (streetUpside < 0.10) return
      const ourUpside = appUpside(d)
      const fair = appFairValue(d)
      const sector = d?.quote?.sector ?? ''
      scored.push({ ticker, price, target, streetUpside, ourUpside, fair, numAnalysts, sector })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('highest_upside_consensus: not enough data'); return }
  scored.sort((a, b) => b.streetUpside - a.streetUpside)
  const top = scored.slice(0, 6)
  const leader = top[0]
  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `These stocks have the biggest gap between price and analyst consensus target.`,
    ``,
    ...top.map((s, i) => {
      const modelNote = s.ourUpside != null
        ? ` · model: ${s.ourUpside >= 0 ? '+' : ''}${(s.ourUpside*100).toFixed(0)}%`
        : ''
      return `${i+1}. $${s.ticker} — ${(s.streetUpside*100).toFixed(0)}% to target · ${s.numAnalysts} analysts${modelNote}`
    }),
    ``,
    // Flag extreme outliers where our model sharply disagrees with street
    leader.ourUpside != null && leader.ourUpside < -0.15
      ? `$${leader.ticker} at ${(leader.streetUpside*100).toFixed(0)}% to the analyst target — but our model says it's already ${Math.abs((leader.ourUpside*100)).toFixed(0)}% above fair value. Either the street is modeling a trajectory the fundamentals don't yet show, or the model is too conservative. That's the disagreement worth resolving.`
      : leader.ourUpside != null && leader.ourUpside > 0.10
      ? `$${leader.ticker}: Street target implies ${(leader.streetUpside*100).toFixed(0)}% upside. Our model agrees — and then some. When both agree on direction, the question is execution and timing.`
      : `$${leader.ticker} has ${(leader.streetUpside*100).toFixed(0)}% upside to the analyst target of ${fmt(leader.target)}. Run the DCF before trusting the consensus.`,
    ``,
    question,
    ``,
    `#Stocks #AnalystTargets #Upside #Investing`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: high_roic_cheap ────────────────────────────────────────────────────
// The combination most investors miss: high ROIC spread AND trading below fair value.
// Compounders at a discount — rarest and highest quality screen.

async function runHighRoicCheap() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 19) % (BROAD_POOL.length - 30)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 30)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const roicSpread = d?.scores?.roic?.spread ?? null
      const roic = d?.scores?.roic?.roic ?? null
      const upside = appUpside(d)
      const fair = appFairValue(d)
      const price = d?.quote?.price
      const fwdPE = d?.analystForwardPE ?? null
      const analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
      if (!roicSpread || roicSpread < 0.05 || !upside || upside < 0.05 || !price || !fair) return
      // ROIC spread > 5pp AND model sees upside
      scored.push({ ticker, roicSpread, roic, upside, fair, price, fwdPE, analyst1y, d })
    } catch { /* skip */ }
  }))

  if (scored.length < 3) { console.warn('high_roic_cheap: not enough data'); return }
  // Sort by combined score: roicSpread * upside (both matter equally)
  scored.sort((a, b) => (b.roicSpread * b.upside) - (a.roicSpread * a.upside))
  const top = scored.slice(0, 5)
  const leader = top[0]
  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const roicInsight = `$${leader.ticker} is the standout: ${(leader.roicSpread*100).toFixed(0)}pp ROIC spread and still ${(leader.upside*100).toFixed(0)}% below our fair value estimate. When a business earns well above its cost of capital and trades below intrinsic value, the usual question isn't whether to look — it's what the market is seeing that you're not. That's the actual question worth answering before building a position.`

  const lines = [
    `High ROIC + trading below fair value. The rarest combination in large caps.`,
    ``,
    `Most investors find one or the other. Both at once is where the real opportunity is.`,
    ``,
    ...top.map((s, i) => {
      const roicStr = `ROIC +${(s.roicSpread*100).toFixed(0)}pp above cost of capital`
      const upsideStr = `${(s.upside*100).toFixed(0)}% below model fair value`
      return `${i+1}. $${s.ticker} — ${roicStr} · ${upsideStr}`
    }),
    ``,
    roicInsight,
    ``,
    `#ROIC #ValueInvesting #Compounders #Investing`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: dividend_value ─────────────────────────────────────────────────────
// High dividend yield + undervalued by model + sustainable payout.
// Income + value in one list — bookmarkable.

async function runDividendValue() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const DIV_POOL = [
    'JNJ','PG','KO','PEP','MMM','T','VZ','MO','PM','MCD',
    'XOM','CVX','ABT','ABBV','MRK','BMY','LMT','RTX','NEE','D',
    'O','SCHD','VYM','V','MA','JPM','BAC','WMT','HD','COST',
  ]

  const scored = []
  await Promise.all(DIV_POOL.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const divYield = d?.quote?.dividendYield ?? null
      const payoutRatio = d?.quote?.payoutRatio ?? null
      const upside = appUpside(d)
      const fair = appFairValue(d)
      const price = d?.quote?.price
      const fcfMargin = d?.businessProfile?.fcfMargin ?? null
      if (!divYield || divYield < 0.015 || !price) return
      if (payoutRatio != null && payoutRatio > 0.85) return // unsustainable payout
      if (fcfMargin != null && fcfMargin < 0.05) return // not generating enough cash
      scored.push({ ticker, divYield, payoutRatio, upside, fair, price, fcfMargin })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('dividend_value: not enough data'); return }
  // Sort by dividend yield × (1 + upside) — rewards both income and value
  scored.sort((a, b) => {
    const aScore = a.divYield * (1 + Math.max(0, a.upside ?? 0))
    const bScore = b.divYield * (1 + Math.max(0, b.upside ?? 0))
    return bScore - aScore
  })
  const top = scored.slice(0, 6)
  const leader = top[0]
  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const lines = [
    `High yield + undervalued by our model. Rare combination.`,
    ``,
    ...top.map((s, i) => {
      const yieldStr = `${(s.divYield*100).toFixed(1)}% yield`
      const modelNote = s.upside != null
        ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%`
        : ''
      const payoutNote = s.payoutRatio != null ? ` · ${(s.payoutRatio*100).toFixed(0)}% payout` : ''
      return `${i+1}. $${s.ticker} — ${yieldStr}${payoutNote}${modelNote}`
    }),
    ``,
    `$${leader.ticker} leads: ${(leader.divYield*100).toFixed(1)}% yield${leader.upside != null && leader.upside > 0.05 ? ` and ${(leader.upside*100).toFixed(0)}% below our fair value estimate` : ''}. ${leader.payoutRatio != null && leader.payoutRatio < 0.6 ? 'Payout ratio is sustainable.' : ''}`,
    ``,
    question,
    ``,
    `#Dividends #IncomeInvesting #ValueInvesting #Stocks`,
  ]
  await post(lines.join('\n'))
}

// ─── Mode: weekly_followup ────────────────────────────────────────────────────
// Follow-up on a stock that was featured last week.
// "Last week we said $X was undervalued at $Y. Here's what happened."
// Drives return visits and builds credibility over time.

const FOLLOWUP_TICKERS_BY_WEEK = [
  ['MSFT','META','GOOGL'],  // week 0
  ['NVDA','AAPL','AMZN'],   // week 1
  ['JPM','V','MA'],         // week 2
  ['LLY','UNH','ABBV'],     // week 3
  ['XOM','CVX','COP'],      // week 4
  ['AMD','INTC','QCOM'],    // week 5
  ['COST','WMT','HD'],      // week 6
  ['CRM','NOW','ADBE'],     // week 7
]

async function runWeeklyFollowup() {
  const weekOfYear = Math.floor(Date.now() / (86400000 * 7))
  const tickers = FOLLOWUP_TICKERS_BY_WEEK[weekOfYear % FOLLOWUP_TICKERS_BY_WEEK.length]
  const dayOfYear = Math.floor(Date.now() / 86400000)
  // Pick one ticker from this week's group
  const ticker = tickers[dayOfYear % tickers.length]

  let data = null
  try { data = await fetchValuation(ticker) } catch { console.warn('weekly_followup: no data'); return }

  const price = data?.quote?.price
  const fair = appFairValue(data)
  const upside = appUpside(data)
  const impliedG = data?.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const hist3y = data?.cagrAnalysis?.historicalCagr3y
  const analystTarget = data?.quote?.analystTargetMean
  const { bear, bull } = appScenarios(data)
  const roicSpread = data?.scores?.roic?.spread ?? null

  if (!price || !fair) { console.warn('weekly_followup: insufficient data'); return }

  const hist = historicalContext(data, ticker)
  const v = verdictLabel(upside ?? 0)

  const performanceNote = (() => {
    const stock1y = data?.holdingReturns?.stock1y
    const spy1y = data?.holdingReturns?.spy1y
    if (stock1y != null && spy1y != null) {
      const diff = (stock1y - spy1y) * 100
      return diff > 5 ? `Up ${(stock1y*100).toFixed(0)}% in the past year — ${diff.toFixed(0)}pp ahead of the S&P.`
        : diff < -5 ? `Down ${Math.abs((stock1y*100)).toFixed(0)}% YTD — ${Math.abs(diff).toFixed(0)}pp behind the S&P.`
        : `Roughly in line with the S&P this year.`
    }
    return null
  })()

  const lines = [
    `Checking back on $${ticker} — one of the most-discussed stocks on this account.`,
    ``,
    `${v.emoji} Currently at ${fmt(price)}. Our model puts fair value at ${fmt(fair)} (${pct(upside)} ${(upside ?? 0) > 0 ? 'upside' : 'premium'}).`,
    impliedG != null ? `Market is pricing in ~${pct(impliedG, false)}/yr growth.${hist3y != null ? ` Historical pace: ${pct(hist3y, false)}.` : ''}` : null,
    validScenarios(bear, bull, fair) ? `Scenario range: ${fmt(bear)} bear → ${fmt(bull)} bull.` : null,
    roicSpread != null ? `ROIC spread: ${roicSpread >= 0 ? '+' : ''}${(roicSpread*100).toFixed(0)}pp above cost of capital.` : null,
    analystTarget ? `${data?.cagrAnalysis?.numAnalysts ?? '?'} analysts have a ${fmt(analystTarget)} target.` : null,
    hist,
    performanceNote,
    ``,
    `Has the story changed, or is this still the same setup?`,
    ``,
    `insic.app/stock/${ticker}`,
    `$${ticker} #Stocks #DCF #ValueInvesting`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: quality_rank ───────────────────────────────────────────────────────
// Combined quality ranking: ROIC + FCF margin + gross margin + Piotroski.
// "Best quality businesses at current prices" — bookmarkable.

async function runQualityRank() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 23) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)

  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const roicSpread = d?.scores?.roic?.spread ?? null
      const fcfMargin = d?.businessProfile?.fcfMargin ?? null
      const grossMargin = d?.businessProfile?.grossMargin ?? null
      const piotroski = d?.scores?.piotroski?.score ?? null
      const price = d?.quote?.price
      const upside = appUpside(d)
      const fair = appFairValue(d)
      if (!price || roicSpread == null || fcfMargin == null) return
      // Composite quality score (0-100)
      const roicScore = Math.min(100, Math.max(0, (roicSpread + 0.05) / 0.30 * 40))
      const fcfScore  = Math.min(100, Math.max(0, fcfMargin / 0.35 * 30))
      const gmScore   = grossMargin != null ? Math.min(100, Math.max(0, grossMargin / 0.70 * 20)) : 10
      const pioScore  = piotroski != null ? (piotroski / 9) * 10 : 5
      const qualScore = roicScore + fcfScore + gmScore + pioScore
      scored.push({ ticker, qualScore, roicSpread, fcfMargin, grossMargin, piotroski, upside, fair, price })
    } catch { /* skip */ }
  }))

  if (scored.length < 4) { console.warn('quality_rank: not enough data'); return }
  scored.sort((a, b) => b.qualScore - a.qualScore)
  const top = scored.slice(0, 5)
  const leader = top[0]
  const question = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]

  const qualityInsight = leader.upside != null && leader.upside > 0.08
    ? `$${leader.ticker} scores highest — and it's still ${(leader.upside*100).toFixed(0)}% below our fair value estimate. Quality at a discount is rare. When you find it, the question isn't whether to look — it's whether the bear case at current prices is acceptable.`
    : leader.upside != null && leader.upside < -0.08
    ? `$${leader.ticker} scores highest. But it's ${Math.abs((leader.upside*100)).toFixed(0)}% above our fair value estimate. Quality has a price — and at this level, most of the quality premium is already in the stock. You're not buying a hidden gem; you're paying full freight for a business that has earned it. That's a different bet.`
    : `$${leader.ticker} scores highest. Trading near fair value — the quality is real and the price reflects it.`

  const lines = [
    `Quality ranking: ROIC, FCF margin, gross margin, and financial momentum combined.`,
    ``,
    ...top.map((s, i) => {
      const roicStr = `ROIC +${(s.roicSpread*100).toFixed(0)}pp`
      const fcfStr = `FCF ${(s.fcfMargin*100).toFixed(0)}%`
      const modelNote = s.upside != null ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%` : ''
      return `${i+1}. $${s.ticker} — ${roicStr} · ${fcfStr}${modelNote}`
    }),
    ``,
    qualityInsight,
    ``,
    `#Quality #ROIC #ValueInvesting #Stocks`,
  ]
  await post(lines.join('\n'))
}

const MODES = {
  dcf:               runDcf,
  dcf2:              runDcf2,
  earnings:          runEarnings,
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
  movers:             runMovers,
  undervalued_list:   runUndervaluedList,
  sector_undervalued: runSectorUndervalued,
  biggest_losers_day: runBiggestLosersDay,
  biggest_winners_day: runBiggestWinnersDay,
  ytd_losers:         runYtdLosers,
  ytd_winners:        runYtdWinners,
  near_52w_high:      runNear52wHigh,
  most_shorted:             runMostShorted,
  lowest_pe:                runLowestPe,
  lowest_peg:               runLowestPeg,
  analyst_top_buys:         runAnalystTopBuys,
  highest_upside_consensus: runHighestUpsideConsensus,
  high_roic_cheap:          runHighRoicCheap,
  dividend_value:           runDividendValue,
  weekly_followup:          runWeeklyFollowup,
  quality_rank:             runQualityRank,
  etf_vs_etf:           runEtfVsEtf,
  profit_forecast_list: runProfitForecastList,
  etf_ratio_breakdown:  runEtfRatioBreakdown,
  sector_momentum_rank: runSectorMomentumRank,
  dcf_vs_analyst_framed: runDcfVsAnalystFramed,
  conviction_score:  runConvictionScore,
  li_conviction:     runLiConviction,
  etf_value_scan:    runEtfValueScan,
  li_etf_scan:            runLiEtfScan,
  li_undervalued_list:    runLiUndervaluedList,
  li_sector_undervalued:  runLiSectorUndervalued,
  li_biggest_losers_day:  runLiBiggestLosersDay,
  li_biggest_winners_day: runLiBiggestWinnersDay,
  li_ytd_losers:          runLiYtdLosers,
  li_ytd_winners:         runLiYtdWinners,
  li_near_52w_high:       runLiNear52wHigh,
  li_most_shorted:        runLiMostShorted,
  li_movers:              runLiMovers,
}

// ─── Additional engagement modes ──────────────────────────────────────────────
// All modes below rotate using dayOfYear so the same tickers never repeat.

async function runOvervaluedList() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 17) % (BROAD_POOL.length - 25)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 25)
  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const upside = appUpside(d), fair = appFairValue(d), price = d?.quote?.price
      const fwdPE = d?.analystForwardPE ?? null
      const impliedG = d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
      const hist3y = d?.cagrAnalysis?.historicalCagr3y
      if (!upside || !fair || !price || upside > -0.08) return
      scored.push({ ticker, upside, fair, price, fwdPE, impliedG, hist3y })
    } catch { /* skip */ }
  }))
  if (scored.length < 3) { console.warn('overvalued_list: not enough data'); return }
  scored.sort((a, b) => a.upside - b.upside)
  const top = scored.slice(0, 6), worst = top[0]
  const q = LIST_QUESTIONS_BEARISH[dayOfYear % LIST_QUESTIONS_BEARISH.length]
  const lines = [
    `6 large caps trading the furthest above our fair value estimate.`,
    ``,
    `Premium priced ≠ bad business. But it means expectations are high.`,
    ``,
    ...top.map((s, i) => {
      const peNote = s.fwdPE ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''
      const implied = s.impliedG != null ? ` · market pricing ${pct(s.impliedG, false)}/yr` : ''
      return `${i+1}. $${s.ticker} — ${Math.abs((s.upside*100)).toFixed(0)}% above model${peNote}${implied}`
    }),
    ``,
    `$${worst.ticker} leads at ${Math.abs((worst.upside*100)).toFixed(0)}% above fair value.${worst.impliedG && worst.hist3y ? ` Market pricing ${pct(worst.impliedG, false)}/yr vs ${pct(worst.hist3y, false)} historical.` : ''}`,
    ``, q, ``,
    `#Stocks #Overvalued #DCF #Investing`,
  ]
  await post(lines.join('\n'))
}

async function runSectorPeRank() {
  const SECTOR_ETFS = [
    {sym:'XLK',name:'Technology'},{sym:'XLV',name:'Healthcare'},{sym:'XLF',name:'Financials'},
    {sym:'XLY',name:'Cons. Cyclical'},{sym:'XLI',name:'Industrials'},{sym:'XLC',name:'Comm. Services'},
    {sym:'XLP',name:'Cons. Defensive'},{sym:'XLE',name:'Energy'},{sym:'XLRE',name:'Real Estate'},
    {sym:'XLB',name:'Materials'},{sym:'XLU',name:'Utilities'},
  ]
  const etfs = await fetchLatestEtfScores()
  const byTicker = Object.fromEntries(etfs.map(e => [e.ticker, e]))
  const rows = SECTOR_ETFS
    .map(s => ({ ...s, pe: byTicker[s.sym]?.pe_ratio ?? null, score: byTicker[s.sym]?.score ?? null }))
    .filter(s => s.pe != null).sort((a, b) => (a.pe ?? 999) - (b.pe ?? 999))
  if (rows.length < 5) { console.warn('sector_pe_rank: not enough data'); return }
  const cheapest = rows[0], richest = rows[rows.length - 1]
  const lines = [
    `All 11 sectors ranked by P/E right now.`,
    ``,
    ...rows.map((r, i) => `${i+1}. ${r.name} — ${r.pe.toFixed(0)}×${r.score != null ? ` · score ${r.score}` : ''}`),
    ``,
    `${((richest.pe ?? 0) - (cheapest.pe ?? 0)).toFixed(0)}× spread between cheapest and richest. ${cheapest.name} looks cheap; ${richest.name} is pricing in growth.`,
    ``,
    `Which sector has the best risk/reward?`,
    ``,
    `#SectorRotation #ETF #Investing`,
  ]
  await post(lines.join('\n'))
}

async function runMomentumLeaders() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const results = []
  for (let i = 0; i < BROAD_POOL.length; i += 8) {
    const batch = BROAD_POOL.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1mo`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const closes = d?.chart?.result?.[0]?.indicators?.quote?.[0]?.close?.filter(v => v != null) ?? []
      const meta = d?.chart?.result?.[0]?.meta
      if (closes.length < 10 || !meta?.regularMarketPrice) return null
      const moChg = (meta.regularMarketPrice - closes[0]) / closes[0] * 100
      if (moChg < 5) return null
      return { symbol: t, price: meta.regularMarketPrice, moChg }
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) results.push(r.value)
    if (i + 8 < BROAD_POOL.length) await new Promise(r => setTimeout(r, 300))
  }
  if (results.length < 4) { console.warn('momentum_leaders: not enough data'); return }
  results.sort((a, b) => b.moChg - a.moChg)
  const top = results.slice(0, 6), leader = top[0]
  let dcfLine = null
  try {
    const data = await fetchValuation(leader.symbol)
    const fair = appFairValue(data), upside = appUpside(data)
    const impliedG = data?.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null) {
      dcfLine = upside < -0.15
        ? `$${leader.symbol} up ${leader.moChg.toFixed(0)}% in a month — model puts fair value at ${fmt(fair)}, ${Math.abs((upside*100)).toFixed(0)}% below today.`
        : upside > 0.10
        ? `$${leader.symbol} up ${leader.moChg.toFixed(0)}% — model still sees ${(upside*100).toFixed(0)}% upside.`
        : `$${leader.symbol} up ${leader.moChg.toFixed(0)}% — near fair value.`
      if (impliedG) dcfLine += ` Pricing in ~${pct(impliedG, false)}/yr growth.`
    }
  } catch { /* skip */ }
  const q = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]
  // Context-aware momentum insight — names what the data actually shows
  const momentumInsight = dcfLine
    ? dcfLine.includes('below today')
      ? `That's momentum without fundamental confirmation. If you're buying here, you're making a turnaround bet, not a value bet. Know which trade you're in.`
      : dcfLine.includes('upside')
      ? `Momentum and fundamentals aligned — the rarest combination. Worth understanding why the model still sees upside after a ${leader.moChg.toFixed(0)}% run.`
      : `Near fair value after the run. The thesis holds but the margin of safety has compressed.`
    : null
  const lines = [
    `Strongest 1-month momentum in large caps.`,
    ``,
    ...top.map((s, i) => `${i+1}. $${s.symbol} — +${s.moChg.toFixed(1)}% in 30 days · ${fmt(s.price)}`),
    ``,
    dcfLine, ``,
    momentumInsight,
    q, ``,
    `#Momentum #Stocks #Investing`,
  ].filter(Boolean)
  await post(lines.join('\n'))
}

async function runEarningsWeekPreview() {
  const now = new Date()
  const dow = now.getUTCDay()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - (dow === 0 ? 6 : dow - 1))
  monday.setUTCHours(0, 0, 0, 0)
  const weekDates = new Set(Array.from({length: 5}, (_, i) => {
    const d = new Date(monday); d.setUTCDate(monday.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  }))
  const reporting = []
  for (let i = 0; i < SP500_SAMPLE.length; i += 8) {
    const batch = SP500_SAMPLE.slice(i, i + 8)
    const settled = await Promise.allSettled(batch.map(async t => {
      const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }).catch(() => null)
      if (!res?.ok) return null
      const d = await res.json().catch(() => null)
      const meta = d?.chart?.result?.[0]?.meta
      if (!meta?.earningsTimestampStart || (meta.marketCap ?? 0) < 20_000_000_000) return null
      const date = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      return weekDates.has(date) ? { symbol: t, date, marketCap: meta.marketCap ?? 0 } : null
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) reporting.push(r.value)
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  if (reporting.length === 0) { console.warn('earnings_week_preview: no earnings found'); return }
  reporting.sort((a, b) => b.marketCap - a.marketCap)
  const top = reporting.slice(0, 8)
  const lines = [
    `Every large cap reporting this week. Run the model before the number hits.`,
    ``,
    ...top.map(e => {
      const dayLabel = new Date(e.date + 'T12:00:00Z').toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric'})
      return `▸ $${e.symbol} — ${dayLabel}`
    }),
    ``,
    `The beat/miss moves the price. Whether the intrinsic value changed is the real question.`,
    ``,
    `#Earnings #Stocks #EarningsSeason`,
  ]
  await post(lines.join('\n'))
}

async function runValueVsGrowth() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const VALUE_TICKERS = ['JPM','BAC','XOM','CVX','JNJ','PG','KO','PEP','VZ','T','WMT','MO','LMT','MMM']
  const GROWTH_TICKERS = ['NVDA','META','GOOGL','AMZN','MSFT','NFLX','ADBE','CRM','NOW','AVGO','AMD','PLTR']
  const sliceV = (dayOfYear * 3) % (VALUE_TICKERS.length - 5)
  const sliceG = (dayOfYear * 5) % (GROWTH_TICKERS.length - 4)
  const fetchGroup = async (tickers) => {
    const results = []
    await Promise.all(tickers.map(async t => {
      try {
        const d = await fetchValuation(t)
        const upside = appUpside(d), fair = appFairValue(d), price = d?.quote?.price
        const fwdPE = d?.analystForwardPE ?? null, analyst1y = d?.cagrAnalysis?.analystEstimate1y ?? null
        if (!price || !fair) return
        results.push({ ticker: t, upside, fair, price, fwdPE, analyst1y })
      } catch { /* skip */ }
    }))
    return results
  }
  const [valueStocks, growthStocks] = await Promise.all([
    fetchGroup(VALUE_TICKERS.slice(sliceV, sliceV+5)),
    fetchGroup(GROWTH_TICKERS.slice(sliceG, sliceG+4)),
  ])
  valueStocks.sort((a, b) => (b.upside ?? -1) - (a.upside ?? -1))
  growthStocks.sort((a, b) => (b.analyst1y ?? 0) - (a.analyst1y ?? 0))
  const topV = valueStocks.slice(0, 3), topG = growthStocks.slice(0, 3)
  if (topV.length < 2 || topG.length < 2) { console.warn('value_vs_growth: not enough data'); return }
  const q = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]
  const lines = [
    `Value vs Growth — same DCF engine, different philosophies.`,
    ``,
    `Value picks:`,
    ...topV.map((s, i) => `${i+1}. $${s.ticker} — ${s.upside != null ? `${(s.upside*100).toFixed(0)}% upside` : 'fair'}${s.fwdPE ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''}`),
    ``,
    `Growth picks:`,
    ...topG.map((s, i) => `${i+1}. $${s.ticker} — ${s.analyst1y != null ? `+${(s.analyst1y*100).toFixed(0)}% est. revenue growth` : 'high growth'}${s.fwdPE ? ` · ${s.fwdPE.toFixed(0)}× fwd P/E` : ''}`),
    ``,
    `Value = margin of safety. Growth = compounding. The best investments offer both.`,
    q, ``,
    `#ValueInvesting #GrowthStocks #Investing`,
  ]
  await post(lines.join('\n'))
}

async function runCashRich() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 13) % (BROAD_POOL.length - 20)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 20)
  const scored = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const balanceSheet = d?.financialStatements?.balanceSheet ?? []
      const latest = balanceSheet.filter(r => !r.isProjected).slice(-1)[0]
      const cash = latest?.cash ?? null, longTermDebt = latest?.longTermDebt ?? null
      const marketCap = d?.quote?.marketCap ?? null, price = d?.quote?.price
      const upside = appUpside(d), fair = appFairValue(d)
      if (!cash || !marketCap || marketCap <= 0 || !price) return
      const netCashPct = ((cash - (longTermDebt ?? 0)) * 1e6) / marketCap * 100
      const netCashB = (cash - (longTermDebt ?? 0)) / 1000
      if (netCashPct < 5) return
      scored.push({ ticker, netCashPct, netCashB, price, upside, fair })
    } catch { /* skip */ }
  }))
  if (scored.length < 3) { console.warn('cash_rich: not enough data'); return }
  scored.sort((a, b) => b.netCashPct - a.netCashPct)
  const top = scored.slice(0, 5), leader = top[0]
  const q = LIST_QUESTIONS_MIXED[dayOfYear % LIST_QUESTIONS_MIXED.length]
  const lines = [
    `Large caps sitting on the most cash relative to market cap.`,
    ``,
    `Net cash = total cash minus long-term debt. High cash = optionality.`,
    ``,
    ...top.map((s, i) => {
      const modelNote = s.upside != null ? ` · model ${s.upside >= 0 ? '+' : ''}${(s.upside*100).toFixed(0)}%` : ''
      return `${i+1}. $${s.ticker} — ${s.netCashB.toFixed(1)}B net cash (${s.netCashPct.toFixed(0)}% of mkt cap)${modelNote}`
    }),
    ``,
    `$${leader.ticker} holds ${leader.netCashB.toFixed(1)}B net cash — ${leader.netCashPct.toFixed(0)}% of its market cap. That's dry powder.`,
    q, ``,
    `#CashRich #Stocks #ValueInvesting`,
  ]
  await post(lines.join('\n'))
}

async function runDailyListRotation() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const fns = [
    runLowestPe, runLowestPeg, runAnalystTopBuys, runHighestUpsideConsensus,
    runHighRoicCheap, runOvervaluedList, runValueVsGrowth, runCashRich,
    runMomentumLeaders, runQualityRank, runDividendValue, runLowestPe,
  ]
  await fns[dayOfYear % fns.length]()
}

async function runMorningStockPick() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const day = new Date().getDay()
  const pool = ROTATION2[day] ?? ROTATION2[1]
  let ticker = null, data = null
  for (let attempt = 0; attempt < Math.min(6, pool.length); attempt++) {
    const candidate = pool[(dayOfYear + attempt + 3) % pool.length]
    try {
      const result = await fetchValuation(candidate)
      if (result?.quote?.price && appFairValue(result) && result?.ratings?.moat) {
        ticker = candidate; data = result; break
      }
    } catch { /* try next */ }
  }
  if (!data) { console.warn('morning_stock_pick: no data'); return }
  const price = data.quote?.price, fair = appFairValue(data), upside = appUpside(data)
  const impliedG = data?.valuationMethods?.models?.reverseDcf?.impliedCAGR
  const hist3y = data?.cagrAnalysis?.historicalCagr3y
  const analyst1y = data?.cagrAnalysis?.analystEstimate1y, numAnalysts = data?.cagrAnalysis?.numAnalysts ?? 0
  const roicSpread = data?.scores?.roic?.spread
  const v = verdictLabel(upside ?? 0)
  const hist = historicalContext(data, ticker)
  const recLabel = (() => {
    const r = data?.analystRecommendation ?? ''
    return r === 'strong_buy' ? 'Strong Buy' : r === 'buy' ? 'Buy' : r === 'hold' ? 'Hold' : null
  })()
  const lines = [
    `${v.emoji} $${ticker} — this morning's pick`,
    ``,
    impliedG != null
      ? `At ${fmt(price)}, the market prices in ~${pct(impliedG, false)}/yr growth.${hist3y ? ` Historical pace: ${pct(hist3y, false)}.` : ''}`
      : `${v.short} at ${fmt(price)}. Model fair value: ${fmt(fair)} (${pct(upside)}).`,
    analyst1y != null && numAnalysts >= 3 ? `${numAnalysts} analysts expect ${pct(analyst1y, false)}/yr revenue growth.` : null,
    roicSpread != null && Math.abs(roicSpread) > 0.03 ? `ROIC ${roicSpread > 0 ? '+' : ''}${(roicSpread*100).toFixed(0)}pp vs cost of capital.` : null,
    recLabel ? `Wall St: ${recLabel}.` : null,
    hist, ``,
    `insic.app/stock/${ticker}`,
    `$${ticker} #StockPick #DCF #Investing`,
  ].filter(Boolean)
  await post(lines.join('\n'))
}

// ─── Mode: calendar_today ─────────────────────────────────────────────────────
// What's on the economic/earnings calendar today + what it means for stocks.

async function runCalendarToday() {
  const todayUtc = new Date().toISOString().split('T')[0]

  // Check MACRO_CALENDAR for today
  const macroToday = MACRO_CALENDAR.filter(e => e.date === todayUtc)

  // Scan for earnings today from SP500_SAMPLE
  const earningsToday = []
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
      if ((meta.marketCap ?? 0) < 5_000_000_000) return null
      const d = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      return d === todayUtc ? { symbol: t, marketCap: meta.marketCap } : null
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) earningsToday.push(r.value)
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  earningsToday.sort((a, b) => b.marketCap - a.marketCap)

  if (macroToday.length === 0 && earningsToday.length === 0) {
    console.log(`No calendar events for ${todayUtc} — skipping`)
    process.exit(0)
  }

  const dayLabel = new Date(todayUtc + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const lines = [`What's moving markets today — ${dayLabel}`, ``]

  if (macroToday.length > 0) {
    const macroImpact = {
      FOMC: `Fed rate decision. Whatever they decide, the dot plot and Powell's guidance on cut timing matters more than the headline number. Any shift in the rate path reprices WACC on every stock in your watchlist.`,
      CPI:  `Inflation data. Watch the core print — that's what actually moves the Fed's calculus. Above consensus = rates stay elevated, DCF fair values compress. Below = path to cuts opens, especially for growth names.`,
      NFP:  `Jobs report. Strong = Fed stays on hold, discount rates stay high. Weak = cuts are coming, growth stocks benefit. Don't ignore the prior month revision — it often changes the story.`,
    }
    for (const e of macroToday) {
      const emoji = { FOMC: '🏦', CPI: '📊', NFP: '💼' }[e.type] ?? '📅'
      lines.push(`${emoji} ${e.label}`)
      if (macroImpact[e.type]) lines.push(macroImpact[e.type])
      lines.push(``)
    }
  }

  if (earningsToday.length > 0) {
    const names = earningsToday.slice(0, 5).map(t => `$${t.symbol}`)
    lines.push(`📊 Earnings today: ${names.join(' · ')}`)
    lines.push(`Beat or miss matters less than whether the result justifies the valuation. Run the model before the print, not after.`)
    lines.push(``)
  }

  lines.push(`The calendar tells you when. The model tells you what it's worth.`)
  lines.push(`#Earnings #Macro #Markets #Investing`)

  await post(lines.join('\n'))
}

// ─── Mode: calendar_tomorrow ──────────────────────────────────────────────────
// What to watch tomorrow — macro events + earnings + why it matters.

async function runCalendarTomorrow() {
  const tomorrowUtc = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  // Skip weekend: advance to Monday if tomorrow is Saturday/Sunday
  const tomorrowDay = new Date(tomorrowUtc).getUTCDay()
  let targetDate = tomorrowUtc
  if (tomorrowDay === 6) targetDate = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  else if (tomorrowDay === 0) targetDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0]

  const macroTomorrow = MACRO_CALENDAR.filter(e => e.date === targetDate)

  // Scan for earnings tomorrow
  const earningsTomorrow = []
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
      if ((meta.marketCap ?? 0) < 5_000_000_000) return null
      const d = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      return d === targetDate ? { symbol: t, marketCap: meta.marketCap } : null
    }))
    for (const r of settled) if (r.status === 'fulfilled' && r.value) earningsTomorrow.push(r.value)
    if (i + 8 < SP500_SAMPLE.length) await new Promise(r => setTimeout(r, 300))
  }
  earningsTomorrow.sort((a, b) => b.marketCap - a.marketCap)

  if (macroTomorrow.length === 0 && earningsTomorrow.length === 0) {
    console.log(`No calendar events for ${targetDate} — skipping`)
    process.exit(0)
  }

  const dayLabel = new Date(targetDate + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const lines = [`What to watch tomorrow — ${dayLabel}`, ``]

  if (macroTomorrow.length > 0) {
    const context = {
      FOMC: `The Fed decision is the single most market-moving event of any quarter. Markets will start positioning today. The rate number itself is usually priced in — the surprise lives in the dot plot and language around cuts.`,
      CPI:  `Inflation report tomorrow. A hot print = rates stay elevated, WACC stays high, growth stock fair values stay compressed. A cool print = door opens to cuts, discount rates fall. Both scenarios update every DCF model you run.`,
      NFP:  `Jobs report tomorrow. Strong payrolls keep the Fed on hold. Weak payrolls pull rate cuts closer. The prior month revision frequently changes the interpretation of the headline.`,
    }
    for (const e of macroTomorrow) {
      const emoji = { FOMC: '🏦', CPI: '📊', NFP: '💼' }[e.type] ?? '📅'
      lines.push(`${emoji} ${e.label} — tomorrow`)
      if (context[e.type]) lines.push(context[e.type])
      lines.push(``)
    }
  }

  if (earningsTomorrow.length > 0) {
    const names = earningsTomorrow.slice(0, 5).map(t => `$${t.symbol}`)
    lines.push(`📊 Reporting tomorrow: ${names.join(' · ')}`)
    lines.push(`The best time to run the pre-earnings model is now — before the noise. What growth rate does the current price already assume?`)
    lines.push(``)
  }

  lines.push(`Why it matters for investors: calendars move prices in the short term. Fundamentals determine value in the long term. Know which you're trading.`)
  lines.push(`#Calendar #Earnings #Macro #Investing`)

  await post(lines.join('\n'))
}

// ─── Mode: macro_preview ──────────────────────────────────────────────────────
// Deep dive on the next upcoming CPI/NFP/FOMC event.

async function runMacroPreview() {
  const todayUtc = new Date().toISOString().split('T')[0]

  // Find the next upcoming event — prefer CPI/NFP/FOMC in that priority for depth
  const upcoming = MACRO_CALENDAR
    .filter(e => e.date > todayUtc)
    .sort((a, b) => a.date.localeCompare(b.date))

  if (upcoming.length === 0) {
    console.log('No upcoming macro events found — skipping')
    process.exit(0)
  }

  // Pick the soonest event
  const next = upcoming[0]
  const daysAway = Math.round((new Date(next.date) - new Date(todayUtc)) / 86400000)

  const eventDate = new Date(next.date + 'T12:00:00Z').toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
  })

  const typeEmoji = { CPI: '📊', NFP: '💼', FOMC: '🏦' }
  const hookMap = {
    CPI:  `CPI drops in ${daysAway} day${daysAway !== 1 ? 's' : ''}. Here's what matters:`,
    NFP:  `Jobs report in ${daysAway} day${daysAway !== 1 ? 's' : ''}. Here's what's at stake:`,
    FOMC: `Fed decision in ${daysAway} day${daysAway !== 1 ? 's' : ''}. Here's what actually moves markets:`,
  }

  const expectationsMap = {
    CPI: `What consensus expects: core CPI near 0.3% month-over-month. A beat (above 0.4%) keeps rates elevated. A miss (below 0.2%) opens the door to earlier cuts.`,
    NFP: `What consensus expects: ~150–200K new jobs. Above 250K = Fed stays on hold well into the year. Below 100K = rate cuts move up the calendar.`,
    FOMC: `What consensus expects: no change at this meeting. The real signal is the dot plot — how many cuts are projected for the year — and any shift in Powell's language on the timing.`,
  }

  const beatMissMap = {
    CPI: {
      beat: `Beat (hot print): yields spike, WACC rises, fair values across the market compress. Growth stocks — especially long-duration tech — take the biggest hit. A 1% rise in WACC reduces a typical growth stock's fair value by 15–25%.`,
      miss: `Miss (cool print): yields fall, rate cut expectations accelerate, discount rates drop. Growth stocks and REITs benefit most. The sectors most sensitive: tech, utilities, and real estate.`,
      sectors: `Rate relief benefits: tech, utilities, REITs. Higher-for-longer benefits: financials (NIM expansion), energy (demand signal).`,
    },
    NFP: {
      beat: `Beat (strong jobs, >200K): Fed stays on hold. Rates higher for longer = pressure on rate-sensitive sectors. Banks and consumer discretionary benefit from employment strength.`,
      miss: `Miss (weak jobs, <150K): cuts move up the calendar. Lower discount rates lift growth stocks and REITs. But a deteriorating labor market also cuts revenue forecasts for consumer-facing tech and advertising — the net effect depends on which channel dominates.`,
      sectors: `Jobs beat benefits: banks, consumer discretionary, industrials. Jobs miss benefits: long-duration tech, utilities, REITs.\n\nThe Fed needs payrolls consistently below 150K to gain confidence to cut. A single soft print won't move them — but a trend will. Watch the prior-month revision: markets trade the direction, not the headline number.`,
    },
    FOMC: {
      beat: `Hawkish surprise (hold or hike): yields rise, WACC rises, growth stocks reprice lower. Value and dividend names are relatively insulated — their near-term cash flows discount less.`,
      miss: `Dovish surprise (cut or dovish tone): yields fall, growth stocks rally. But if markets already priced in cuts, the real alpha comes from stocks where fair value hasn't caught up to the new rate regime yet.`,
      sectors: `Dovish outcome benefits: long-duration growth (tech), REITs, utilities. Hawkish outcome benefits: banks, insurance, short-duration value stocks.`,
    },
  }

  const detail = expectationsMap[next.type] ?? `${next.label} is ${daysAway} days away.`
  const beat = beatMissMap[next.type]?.beat ?? ''
  const miss = beatMissMap[next.type]?.miss ?? ''
  const sectors = beatMissMap[next.type]?.sectors ?? ''

  const lines = [
    `${typeEmoji[next.type] ?? '📅'} ${hookMap[next.type] ?? `${next.label} in ${daysAway} days:`}`,
    ``,
    detail,
    ``,
    `Beat: ${beat}`,
    ``,
    `Miss: ${miss}`,
    ``,
    sectors ? sectors : null,
    ``,
    `The number moves prices for a day. The rate path it implies moves valuations for a year.`,
    `#${next.type} #Macro #FedWatch #Rates #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: rate_impact ────────────────────────────────────────────────────────
// How current interest rates affect stock valuations — illustrated with
// 3 rate-sensitive stocks (REIT, tech, utility).

async function runRateImpact() {
  // Fetch 10Y yield from Yahoo Finance
  const tnx = await fetchYahooChart('^TNX').catch(() => null)

  if (!tnx || !isFinite(tnx.price)) {
    console.warn('Could not fetch 10Y yield — skipping')
    process.exit(0)
  }

  const yieldNow = tnx.price
  const yieldDir = tnx.changePct > 0.3 ? 'rising' : tnx.changePct < -0.3 ? 'falling' : 'steady'

  // Rate-sensitive picks: REIT, growth tech, utility
  const RATE_TICKERS = ['PLD', 'MSFT', 'NEE'] // industrial REIT, tech, utility
  const results = await Promise.allSettled(RATE_TICKERS.map(t => fetchValuation(t)))
  const stocks = results
    .map((r, i) => r.status === 'fulfilled' && r.value ? { ticker: RATE_TICKERS[i], data: r.value } : null)
    .filter(Boolean)
    .map(({ ticker, data }) => ({
      ticker,
      price:  data.quote?.price,
      fair:   appFairValue(data),
      upside: appUpside(data),
      wacc:   data.wacc?.wacc,
      sector: data.quote?.sector ?? '',
      data,
    }))
    .filter(s => s.price && s.fair)

  if (stocks.length === 0) {
    console.warn('No rate-sensitive stock data — skipping')
    process.exit(0)
  }

  const waccNote = yieldNow >= 4.5
    ? `At ${yieldNow.toFixed(2)}%, the 10Y yield is above the level where it meaningfully compresses growth stock valuations. A 4.5%+ risk-free rate pushes WACC up, which reduces DCF fair values — particularly for long-duration growth.`
    : yieldNow >= 4.0
    ? `At ${yieldNow.toFixed(2)}%, the 10Y yield is in mid-range. Direction matters more than level here — a move toward 4.5% would begin to pressure growth stock valuations.`
    : `At ${yieldNow.toFixed(2)}%, the 10Y yield is relatively benign for equity valuations. Lower rates reduce WACC and lift DCF fair values, especially for long-duration assets.`

  const stockLines = stocks.flatMap(s => {
    const waccStr = s.wacc != null ? ` WACC: ${(s.wacc * 100).toFixed(1)}%.` : ''
    const upsideStr = s.upside != null ? ` Model: ${pct(s.upside)} vs price.` : ''
    const label = s.sector.includes('Real Estate') ? 'REIT'
      : s.sector.includes('Utilities') ? 'Utility'
      : s.sector.includes('Technology') ? 'Growth tech' : s.sector
    return [`$${s.ticker} (${label}):${waccStr}${upsideStr}`]
  })

  const lines = [
    `10Y yield ${yieldNow.toFixed(2)}% and ${yieldDir}. Here's what that means for valuations:`,
    ``,
    waccNote,
    ``,
    `Rule of thumb: every 100bps rise in the 10Y yield pushes WACC up ~50–70bps for most stocks (higher for equity-heavy, high-beta businesses — lower for leveraged, low-beta names where the tax shield on debt partially offsets the move). For a growth stock where 70% of value sits in the terminal period, that cuts fair value by 20–30%.`,
    ``,
    `3 rate-sensitive names and where the model stands:`,
    ``,
    ...stockLines,
    ``,
    `Growth stocks (long duration) feel rate moves most. Value stocks and dividend payers are relatively insulated — their near-term cash flows discount less.`,
    ``,
    `#InterestRates #WACC #DCF #Bonds #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: sector_catalyst ────────────────────────────────────────────────────
// Upcoming catalysts for a rotating sector — earnings + macro + valuation.

const SECTOR_ROTATION_WEEKLY = [
  { sym: 'XLK', name: 'Tech',        tickers: ['AAPL','MSFT','NVDA','GOOGL','META'] },
  { sym: 'XLF', name: 'Financials',  tickers: ['JPM','BAC','GS','V','MA'] },
  { sym: 'XLV', name: 'Healthcare',  tickers: ['UNH','LLY','JNJ','ABBV','MRK'] },
  { sym: 'XLE', name: 'Energy',      tickers: ['XOM','CVX','COP','SLB','EOG'] },
  { sym: 'XLU', name: 'Utilities',   tickers: ['NEE','DUK','SO','AEP','EXC'] },
  { sym: 'XLI', name: 'Industrials', tickers: ['HON','GE','CAT','RTX','UPS'] },
]

async function runSectorCatalyst() {
  const weekOfYear = Math.floor((Date.now() / 86400000 + 4) / 7)
  const sector = SECTOR_ROTATION_WEEKLY[weekOfYear % SECTOR_ROTATION_WEEKLY.length]

  const todayUtc = new Date().toISOString().split('T')[0]

  // Get current week's Mon–Fri dates
  const now = new Date()
  const dow = now.getUTCDay()
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

  // Scan sector tickers for earnings this week
  const earningsThisWeek = []
  for (const t of sector.tickers) {
    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${t}?interval=1d&range=1d`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      ).catch(() => null)
      if (!res?.ok) continue
      const json = await res.json().catch(() => null)
      const meta = json?.chart?.result?.[0]?.meta
      if (!meta?.earningsTimestampStart) continue
      const d = new Date(meta.earningsTimestampStart * 1000).toISOString().split('T')[0]
      if (weekDates.has(d)) earningsThisWeek.push({ symbol: t, date: d, marketCap: meta.marketCap ?? 0 })
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 250))
  }

  // Macro events this week relevant to this sector
  const macroThisWeek = MACRO_CALENDAR.filter(e => weekDates.has(e.date))

  // Fetch ETF performance
  const etf = await fetchYahooChart(sector.sym).catch(() => null)

  // Fetch valuation for the largest name in sector
  let featuredData = null
  let featuredTicker = null
  for (const t of sector.tickers) {
    try {
      const d = await fetchValuation(t)
      if (d?.quote?.price && appFairValue(d)) { featuredData = d; featuredTicker = t; break }
    } catch { /* try next */ }
  }

  if (!etf && !featuredData) {
    console.warn('No sector catalyst data — skipping')
    process.exit(0)
  }

  // Context-aware sector narrative — explains the WHY, not just the what
  const etfChg = etf?.changePct ?? 0
  const etfStr = etf
    ? `${sector.name} ETF (${sector.sym}): ${etf.changePct >= 0 ? '+' : ''}${etf.changePct.toFixed(2)}% today`
    : null

  const valuationStr = featuredData && featuredTicker
    ? (() => {
        const fair   = appFairValue(featuredData)
        const upside = appUpside(featuredData)
        const price  = featuredData.quote?.price
        const impliedG = featuredData.valuationMethods?.models?.reverseDcf?.impliedCAGR
        if (impliedG != null) return `$${featuredTicker} at ${fmt(price)} prices in ~${pct(impliedG, false)}/yr growth. Model sees ${pct(upside)}.`
        return `$${featuredTicker}: price ${fmt(price)}, model fair value ${fmt(fair)} (${pct(upside)}).`
      })()
    : null

  const earningsStr = earningsThisWeek.length > 0
    ? `Earnings this week: ${earningsThisWeek.map(e => `$${e.symbol}`).join(' · ')}`
    : null

  const macroStr = macroThisWeek.length > 0
    ? `Macro this week: ${macroThisWeek.map(e => e.label).join(' · ')}`
    : null

  const sectorContext = (() => {
    if (!etf) return null
    // Sector-specific narratives for why it's moving
    const narratives = {
      XLK: etfChg > 0
        ? `Tech is leading. Before calling it risk-on: is this rate-driven or earnings-driven? Rate relief lifts every tech name mechanically. Earnings momentum is selective. The two look identical in the price action — they aren't.`
        : `Tech is lagging. When the biggest sector in the index underperforms, the macro picture is usually changing. Watch the 10Y — rate pressure on growth multiples shows up here first.`,
      XLF: etfChg > 0
        ? `Financials leading — the market is pricing in a steeper yield curve or better credit. Higher rates expand bank margins but compress every other sector's valuation. Both things can be true simultaneously.`
        : `Financials selling off. When banks lag in a risk-on session, check whether credit concerns or rate-path uncertainty is driving it — those have very different implications for the rest of the market.`,
      XLV: etfChg > 0
        ? `Healthcare bid. When defensives lead, investors are hedging. Either growth expectations are getting trimmed or macro risk is rising — either reduces what they'll pay for higher-beta names.`
        : `Healthcare lagging while the market runs — classic rotation out of defensives into risk. This compresses valuations in healthcare without any change to the underlying business. That gap is where opportunities form.`,
      XLE: etfChg > 0
        ? `Energy outperforming. Check whether it's an oil supply story or a geopolitical premium. For integrated majors, the FCF at current crude prices is what justifies the multiple — not the commodity move itself.`
        : `Energy selling off despite the broader tape. When oil stocks fall while the market rises, it's usually a demand signal — slowing economic expectations often hit energy before consumer sentiment catches up.`,
      XLU: etfChg > 0
        ? `Utilities leading — classic rate-cut signal. The market is front-running lower rates. Utilities are long-duration assets; lower cost of capital mechanically increases their fair value.`
        : `Utilities lagging — risk-on rotation. When investors sell safety for growth, the implicit bet is that growth assumptions are about to be revised upward. That may or may not be justified.`,
      XLI: etfChg > 0
        ? `Industrials up — cyclical leadership. This usually confirms GDP expectations are stable or rising. Good environment for capex-heavy businesses where ROIC is above the cost of capital.`
        : `Industrials lagging — cyclical softness. When this sector underperforms, the market may be signaling that near-term growth expectations are being trimmed.`,
    }
    return narratives[sector.sym] ?? `${sector.name} is moving — understanding the why matters more than the direction.`
  })()

  const lines = [
    `${sector.name} sector — what's in play this week`,
    ``,
    ...(etfStr ? [etfStr] : []),
    ...(sectorContext ? [sectorContext] : []),
    ...(earningsStr ? [``, earningsStr] : []),
    ...(macroStr ? [macroStr] : []),
    ``,
    ...(valuationStr ? [valuationStr] : []),
    ``,
    ...(sector.tickers.length > 0 ? [`Names to watch in ${sector.name}: ${sector.tickers.slice(0, 3).map(t => `$${t}`).join(' · ')}`] : []),
    ``,
    `Is ${sector.name} on your radar right now?`,
    `#${sector.name.replace(/\s/g, '')} #SectorRotation #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

// ─── Mode: earnings_surprise_hist ─────────────────────────────────────────────
// Stocks with the best historical EPS surprise rate from our /api/financials data.

async function runEarningsSurpriseHist() {
  const dayOfYear = Math.floor(Date.now() / 86400000)
  const sliceStart = (dayOfYear * 11) % Math.max(1, BROAD_POOL.length - 20)
  const pool = BROAD_POOL.slice(sliceStart, sliceStart + 20)

  const candidates = []
  await Promise.all(pool.map(async ticker => {
    try {
      const d = await fetchValuation(ticker)
      const surprises = d?.earningsSurprises ?? []
      if (surprises.length < 4) return
      const beatCount = surprises.filter(s => (s.surprisePercent ?? 0) > 0).length
      const beatRate  = beatCount / surprises.length
      if (beatRate < 0.60) return
      const avgSurprise = surprises.reduce((sum, s) => sum + (s.surprisePercent ?? 0), 0) / surprises.length
      const price  = d?.quote?.price
      const fair   = appFairValue(d)
      const upside = appUpside(d)
      const impliedG = d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
      candidates.push({ ticker, beatRate, beatCount, total: surprises.length, avgSurprise, price, fair, upside, impliedG, d })
    } catch { /* skip */ }
  }))

  if (candidates.length < 2) {
    console.warn('Not enough earnings surprise data — skipping')
    process.exit(0)
  }

  candidates.sort((a, b) => b.beatRate - a.beatRate || b.avgSurprise - a.avgSurprise)
  const top = candidates.slice(0, 4)

  const question = LIST_QUESTIONS_BULLISH[dayOfYear % LIST_QUESTIONS_BULLISH.length]

  const stockLines = top.flatMap(s => {
    const valStr = s.price && s.fair
      ? ` Model: ${pct(s.upside)} vs price.`
      : ''
    const impliedStr = s.impliedG != null ? ` Market pricing in ~${pct(s.impliedG, false)}/yr growth.` : ''
    return [
      `$${s.ticker} — beat ${s.beatCount}/${s.total} quarters (avg surprise ${s.avgSurprise >= 0 ? '+' : ''}${s.avgSurprise.toFixed(1)}%)${valStr}${impliedStr}`,
    ]
  })

  const leader = top[0]
  const lines = [
    `These companies beat earnings estimates most consistently:`,
    ``,
    ...stockLines,
    ``,
    `Beat rate matters, but what matters more is whether consistent execution is already in the price. A stock that always beats can still be overvalued if the market's grown used to it.`,
    ``,
    question,
    ``,
    `#Earnings #EPS #Surprises #Investing #DCF`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}

Object.assign(MODES, {
  overvalued_list:          runOvervaluedList,
  sector_pe_rank:           runSectorPeRank,
  momentum_leaders:         runMomentumLeaders,
  earnings_week_preview:    runEarningsWeekPreview,
  value_vs_growth:          runValueVsGrowth,
  cash_rich:                runCashRich,
  daily_list_rotation:      runDailyListRotation,
  morning_stock_pick:       runMorningStockPick,
  calendar_today:           runCalendarToday,
  calendar_tomorrow:        runCalendarTomorrow,
  macro_preview:            runMacroPreview,
  rate_impact:              runRateImpact,
  sector_catalyst:          runSectorCatalyst,
  earnings_surprise_hist:   runEarningsSurpriseHist,
  european_open:            runEuropeanOpen,
})

// ─── Mode: european_open ──────────────────────────────────────────────────────
// 5:00 AM ART (8:00 UTC) — European market open brief.
// European traders are hitting their desks. Give them overnight context,
// key levels, and one stock idea before London open.
async function runEuropeanOpen() {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
  const dayOfYear = Math.floor(Date.now() / 86400000)

  // Fetch overnight movers + European indices
  const [sp500, nasdaq, dax, ftse, nikkei, oil, gold, tnx] = await Promise.all([
    fetchYahooChart('^GSPC').catch(() => null),
    fetchYahooChart('^IXIC').catch(() => null),
    fetchYahooChart('^GDAXI').catch(() => null),
    fetchYahooChart('^FTSE').catch(() => null),
    fetchYahooChart('^N225').catch(() => null),
    fetchYahooChart('CL=F').catch(() => null),
    fetchYahooChart('GC=F').catch(() => null),
    fetchYahooChart('^TNX').catch(() => null),
  ])

  // Tone from US futures direction
  const spChg = sp500?.changePct ?? 0
  const tone = spChg > 0.5 ? 'US futures pointing higher. Risk-on tone heading into the European session.'
    : spChg < -0.5 ? 'US futures under pressure. Caution warranted at the European open.'
    : 'US futures flat. Europe sets its own tone today.'

  // European indices
  const euLines = [
    dax   ? `DAX ${dax.changePct >= 0 ? '+' : ''}${dax.changePct.toFixed(2)}%` : null,
    ftse  ? `FTSE ${ftse.changePct >= 0 ? '+' : ''}${ftse.changePct.toFixed(2)}%` : null,
    nikkei ? `Nikkei ${nikkei.changePct >= 0 ? '+' : ''}${nikkei.changePct.toFixed(2)}%` : null,
  ].filter(Boolean)

  // Commodities
  const commLines = [
    oil  ? `Oil $${oil.price.toFixed(0)} (${oil.changePct >= 0 ? '+' : ''}${oil.changePct.toFixed(1)}%)` : null,
    gold ? `Gold $${gold.price.toFixed(0)} (${gold.changePct >= 0 ? '+' : ''}${gold.changePct.toFixed(1)}%)` : null,
    tnx  ? `10Y ${tnx.price.toFixed(2)}%` : null,
  ].filter(Boolean)

  // Pick one stock relevant to European traders (large caps with EU exposure)
  const EU_EXPOSED = ['LVMHF','SAP','ASML','NESN','NOVO-B.CO','SHEL','TTE','BHP','RIO','HSBA.L']
  const US_EU = ['MSFT','GOOGL','META','NVDA','AAPL','JPM','UNH','XOM','V','MA']
  const pool = US_EU  // use US tickers since we have valuation data for these
  let stockLine = null
  try {
    const pick = pool[(dayOfYear * 7) % pool.length]
    const d = await fetchValuation(pick)
    const fair = appFairValue(d), upside = appUpside(d), price = d?.quote?.price
    const impliedG = d?.valuationMethods?.models?.reverseDcf?.impliedCAGR
    if (fair && upside != null && price) {
      stockLine = impliedG != null
        ? `On the radar: $${pick} at ${fmt(price)}. Market pricing in ~${pct(impliedG, false)}/yr growth. Model fair value: ${fmt(fair)} (${pct(upside)}).`
        : `On the radar: $${pick} at ${fmt(price)}. Model fair value: ${fmt(fair)} (${pct(upside)}).`
    }
  } catch { /* skip */ }

  // Macro events today for EU traders
  const todayUtc = new Date().toISOString().split('T')[0]
  const macroToday = MACRO_CALENDAR.filter(e => e.date === todayUtc)
  const macroLine = macroToday.length > 0
    ? `On the calendar today: ${macroToday.map(e => e.label).join(' · ')}.`
    : null

  // Build opening hook: lead with stock tension, not generic "risk-on tone"
  // If we have a named stock with a meaningful valuation gap, lead with it
  const openHook = stockLine && spChg !== 0
    ? `European open. ${stockLine.replace('On the radar: ', '').replace(/\. Model.*$/, '')} is pricing in ${spChg > 0 ? 'a risk-on morning' : 'caution'} — but here's what the model says.`
    : spChg > 0.5 ? `European open. US futures pointing higher — but a rising tide doesn't raise all fair values equally.`
    : spChg < -0.5 ? `European open. US futures under pressure. Check your positions before London sets the tone.`
    : `European open. Flat US futures — Europe sets its own direction today.`

  const lines = [
    openHook,
    ``,
    ...(stockLine ? [stockLine] : []),
    ``,
    euLines.length > 0 ? euLines.join(' · ') : null,
    sp500 ? `S&P futures ${sp500.changePct >= 0 ? '+' : ''}${sp500.changePct.toFixed(2)}%` : null,
    commLines.length > 0 ? commLines.join(' · ') : null,
    ``,
    macroLine,
    ``,
    `#EuropeanMarkets #Premarket #DCF #Investing`,
  ].filter(Boolean)

  await post(lines.join('\n'))
}


if (!MODES[MODE]) {
  console.error(`Unknown MODE="${MODE}". Use: ${Object.keys(MODES).join(' | ')}`)
  process.exit(1)
}

// ─── Execution block ──────────────────────────────────────────────────────────
// Routes through claimAndPost() which handles:
//   - Queue-row atomic claim (post_queue table via claim_post RPC)
//   - Legacy fallback (posted_tweet_events) when queue row not found
//   - Holiday redirect for intraday modes
//   - Dedup (daily or hourly for DEDUP_EXEMPT modes)
//   - Failure recording with error classification
//
// Platform is inferred from MODE prefix:
//   li_*  → 'linkedin'
//   else  → 'twitter'
//
// - Skip (exit 0): already posted, holiday redirect, no data available
// - Failure (exit 1): real errors — Buffer down, invalid content, missing config
//   GitHub marks the run red so failures are visible. The 48 explicit cron entries
//   (not */15) mean GitHub won't disable the workflow after failures.

const platform = MODE.startsWith('li_') ? 'linkedin' : 'twitter'

await claimAndPost(MODE, platform, TICKER)
