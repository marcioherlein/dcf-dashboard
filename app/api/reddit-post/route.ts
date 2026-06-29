import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

// ── Constants ──────────────────────────────────────────────────────────────────

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

type Format = 'insight' | 'lesson' | 'observation'
type Sub = 'stocks' | 'investing' | 'ValueInvesting' | 'SecurityAnalysis'

const SUB_BY_DOW: Sub[] = ['stocks', 'investing', 'ValueInvesting', 'SecurityAnalysis', 'stocks']

const LESSONS = [
  'Why a low P/E ratio can be a trap — and what to look for instead',
  'The one number most retail investors ignore: Free Cash Flow yield',
  'What DCF actually tells you (and what it doesn\'t)',
  'Margin of safety: the most important concept in investing nobody teaches',
  'Why EPS growth is meaningless without ROIC context',
  'The difference between enterprise value and market cap (and why it matters)',
  'How to read a 10-K in 20 minutes and find the things analysts miss',
  'Terminal value: the number that controls 70% of every DCF model',
  'Why net income is a terrible measure of business health',
  'What WACC is and why analysts argue about it constantly',
]

// ── Auth helper ────────────────────────────────────────────────────────────────

async function isAdmin(req: NextRequest): Promise<boolean> {
  // Allow cron via CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) return true

  // Allow automation key (for cron auto=1 calls)
  const automationKey = req.headers.get('x-automation-key')
  if (automationKey && automationKey === process.env.AUTOMATION_API_KEY) return true

  // Allow admin session
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.email && ADMIN_EMAILS.includes(session.user.email)) return true
  } catch {
    // getServerSession may not be configured — fall through
  }

  return false
}

// ── Gemini call ────────────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured')

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.82, maxOutputTokens: 1200 },
      }),
    }
  )

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Gemini error ${res.status}: ${err}`)
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  if (!text) throw new Error('Empty response from Gemini')
  return text.trim()
}

// ── Data fetch ─────────────────────────────────────────────────────────────────

async function fetchFinancials(ticker: string, origin: string) {
  const url = `${origin}/api/financials?ticker=${encodeURIComponent(ticker)}`
  const res = await fetch(url, {
    headers: { 'x-automation-key': process.env.AUTOMATION_API_KEY ?? '' },
    next: { revalidate: 0 },
  })
  if (!res.ok) throw new Error(`Financials fetch failed: ${res.status}`)
  return res.json()
}

// ── Prompt builders ────────────────────────────────────────────────────────────

const ANTI_PROMO = `
CRITICAL RULES — violating any of these will make the post get removed:
- Never mention any app, tool, website, or URL
- Never say "I built", "check out", "try this", "sign up", "my app", "a tool I made"
- Write as a thoughtful retail investor sharing original analysis
- No hashtags
- No emojis
- No self-promotion of any kind
- Sound like a regular Redditor who reads 10-Ks and does their own math
`.trim()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildInsightPrompt(data: any, sub: Sub): string {
  const { ticker, quote, fairValue, cagrAnalysis, scenarios, ratings, businessProfile } = data

  const price = quote?.price?.toFixed(2) ?? '?'
  const fv = fairValue?.fairValuePerShare?.toFixed(2) ?? null
  const upsidePct = fairValue?.upsidePct != null
    ? `${fairValue.upsidePct >= 0 ? '+' : ''}${(fairValue.upsidePct * 100).toFixed(1)}%`
    : null
  const impliedCAGR = cagrAnalysis?.blended != null
    ? `${(cagrAnalysis.blended * 100).toFixed(1)}%`
    : null
  const historicalCAGR = cagrAnalysis?.historicalCagr3y != null
    ? `${(cagrAnalysis.historicalCagr3y * 100).toFixed(1)}%`
    : null
  const analystCAGR = cagrAnalysis?.analystEstimate1y != null
    ? `${(cagrAnalysis.analystEstimate1y * 100).toFixed(1)}%`
    : null
  const sector = businessProfile?.sector ?? quote?.sector ?? 'unknown sector'
  const bullFV = scenarios?.bull?.fairValue?.toFixed(2) ?? null
  const bearFV = scenarios?.bear?.fairValue?.toFixed(2) ?? null
  const qualityOverall = ratings?.overall?.label ?? null
  const wacc = data.wacc?.wacc != null ? `${(data.wacc.wacc * 100).toFixed(1)}%` : null

  return `You are writing a Reddit post for r/${sub} about ${ticker}.

${ANTI_PROMO}

FORMAT: "insight" — explain what the market is implying about ${ticker}'s future growth given today's price. This is original content (OC) backed by numbers.

DATA (use these exact numbers):
- Current price: $${price}
${fv ? `- DCF fair value estimate: $${fv}` : ''}
${upsidePct ? `- Upside/downside vs fair value: ${upsidePct}` : ''}
${impliedCAGR ? `- Implied 5-year revenue CAGR the market is pricing in: ${impliedCAGR}` : ''}
${historicalCAGR ? `- Actual 3-year historical revenue CAGR: ${historicalCAGR}` : ''}
${analystCAGR ? `- Analyst 1-year revenue growth estimate: ${analystCAGR}` : ''}
${wacc ? `- WACC used: ${wacc}` : ''}
${bullFV ? `- Bull/bear scenario range: $${bearFV} – $${bullFV}` : ''}
${qualityOverall ? `- Overall business quality: ${qualityOverall}` : ''}
- Sector: ${sector}

STRUCTURE:
1. Title (start with [OC], include the ticker, be specific about the insight — max 200 chars)
2. Body (800–1600 chars):
   - Open with the key tension: what the price implies vs what the historical track record shows
   - Explain the reverse DCF logic simply (no jargon — explain what CAGR means, what WACC means if you use it)
   - Discuss what would need to be true for the stock to be worth buying at this price
   - Close with a genuine question to spark discussion
   - No conclusion that sounds like a recommendation

OUTPUT FORMAT — return exactly this JSON:
{"title": "...", "body": "..."}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildObservationPrompt(_data: any, sub: Sub): string {
  return `You are writing a Reddit post for r/${sub} about stock market valuation.

${ANTI_PROMO}

FORMAT: "observation" — share a market-wide data observation about valuations, sector PE spreads, or unusual pricing patterns you've noticed recently.

Pick ONE of these angles and develop it with specific data points and genuine analysis:
- Why certain sectors trade at dramatically different P/E multiples (e.g. tech vs utilities vs financials) and what that tells us about investor psychology
- How the spread between P/E and earnings growth (PEG ratio) has widened in specific sectors
- The relationship between interest rates and growth stock valuations — and why some investors still ignore it
- Why forward P/E is often misleading (analyst estimates are systematically optimistic — cite the data)
- How market cap concentration at the top 10 S&P500 stocks compares to historical norms

Be specific, use real approximate numbers, and be intellectually honest about uncertainty.

STRUCTURE:
1. Title (specific and data-driven, max 200 chars)
2. Body (900–1600 chars): data point → explanation → implication → genuine question for discussion

OUTPUT FORMAT — return exactly this JSON:
{"title": "...", "body": "..."}`
}

function buildLessonPrompt(sub: Sub, topic: string): string {
  return `You are writing a Reddit post for r/${sub} about investing education.

${ANTI_PROMO}

FORMAT: "lesson" — teach one investing concept clearly. The goal is that after reading, someone understands something they didn't before.

TOPIC: ${topic}

STRUCTURE:
1. Title (engaging, specific — avoid generic "How to..." starts, be more interesting — max 200 chars)
2. Body (900–1600 chars):
   - Start with a concrete example or common mistake people make
   - Explain the concept clearly with a simple worked example or analogy
   - Give a practical takeaway — what to actually do with this knowledge
   - Acknowledge the limits of the concept
   - End with a question to the community

TONE: Thoughtful, curious, not preachy. You've been burned by ignoring this before. Write like that.

OUTPUT FORMAT — return exactly this JSON:
{"title": "...", "body": "..."}`
}

// ── Parse Gemini output ────────────────────────────────────────────────────────

function parseGeminiOutput(raw: string): { title: string; body: string } {
  // Try direct JSON parse
  try {
    const parsed = JSON.parse(raw)
    if (parsed.title && parsed.body) return parsed
  } catch { /* continue */ }

  // Try extracting JSON block
  const match = raw.match(/\{[\s\S]*"title"[\s\S]*"body"[\s\S]*\}/)
  if (match) {
    try {
      const parsed = JSON.parse(match[0])
      if (parsed.title && parsed.body) return parsed
    } catch { /* continue */ }
  }

  // Fallback: split on first blank line
  const lines = raw.split('\n').filter(l => l.trim())
  const title = lines[0]?.replace(/^["*#]+|["*#]+$/g, '').trim() ?? 'Untitled'
  const body = lines.slice(1).join('\n').trim()
  return { title, body }
}

// ── Main handler ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!(await isAdmin(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const origin = req.nextUrl.origin

  // Format
  const rawFormat = searchParams.get('format')
  const dow = new Date().getDay() // 0=Sun, 1=Mon ... 5=Fri
  const formats: Format[] = ['insight', 'lesson', 'observation']
  const format: Format = (rawFormat as Format) ?? formats[(dow - 1 + 3) % 3]

  // Subreddit
  const rawSub = searchParams.get('sub')
  const sub: Sub = (rawSub as Sub) ?? SUB_BY_DOW[Math.max(0, Math.min(4, dow - 1))]

  // Ticker
  let ticker = (searchParams.get('ticker') ?? '').toUpperCase()

  let stockData = null
  if (format !== 'lesson') {
    // Pick default ticker if not provided
    if (!ticker) {
      try {
        const statsRes = await fetch(`${origin}/api/admin/stats`)
        const stats = await statsRes.json()
        ticker = stats?.topTickers?.[0]?.ticker ?? 'AAPL'
      } catch {
        ticker = 'AAPL'
      }
    }

    try {
      stockData = await fetchFinancials(ticker, origin)
    } catch (e) {
      console.error('[reddit-post] financials fetch error:', e)
      // Fall back to lesson if data unavailable
    }
  }

  // Build prompt
  let prompt: string
  const lessonTopic = LESSONS[new Date().getDate() % LESSONS.length]

  if (format === 'insight' && stockData) {
    prompt = buildInsightPrompt(stockData, sub)
  } else if (format === 'observation') {
    prompt = buildObservationPrompt(stockData, sub)
  } else {
    prompt = buildLessonPrompt(sub, lessonTopic)
    ticker = ''
  }

  // Generate
  let title: string
  let body: string
  try {
    const raw = await callGemini(prompt)
    const parsed = parseGeminiOutput(raw)
    title = parsed.title
    body = parsed.body
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[reddit-post] Gemini error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({
    title,
    body,
    sub,
    format,
    ticker: ticker || null,
    generatedAt: new Date().toISOString(),
  })
}
