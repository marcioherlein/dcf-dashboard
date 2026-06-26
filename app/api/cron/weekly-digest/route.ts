import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { type DigestContent } from '@/emails/WeeklyDigestEmail'

export const maxDuration = 300 // 5-minute timeout for AI generation

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

function weekLabel(): string {
  return new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Fetch market context (SPY perf, sectors, macro signals) ──────────────────

async function fetchMarketContext(baseUrl: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${baseUrl}/api/market-context`, { next: { revalidate: 0 } })
    if (!res.ok) return {}
    return await res.json()
  } catch {
    return {}
  }
}

// ── Fetch top stock ideas from screener ───────────────────────────────────────

async function fetchStockIdeas(baseUrl: string): Promise<Record<string, unknown>[]> {
  try {
    const res = await fetch(`${baseUrl}/api/ideas`, { next: { revalidate: 0 } })
    if (!res.ok) return []
    const data = await res.json()
    // Return top undervalued + margin_of_safety stocks
    const ideas: Record<string, unknown>[] = []
    for (const cat of ['undervalued', 'margin_of_safety', 'high_conviction']) {
      const catItems = (data[cat] ?? []) as Record<string, unknown>[]
      ideas.push(...catItems.slice(0, 3))
    }
    // Deduplicate by ticker
    const seen = new Set<string>()
    return ideas.filter(s => {
      const ticker = s.ticker as string
      if (seen.has(ticker)) return false
      seen.add(ticker)
      return true
    }).slice(0, 6)
  } catch {
    return []
  }
}

// ── Generate editorial content with Claude ────────────────────────────────────

async function generateEditorialContent(
  marketCtx: Record<string, unknown>,
  spotlightStocks: Record<string, unknown>[],
  weekOf: string,
): Promise<DigestContent> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  // Build a compact context for Claude
  const sentiment = (marketCtx.sentimentLabel as string) ?? 'Neutral'
  const spxChange = (marketCtx.spxDayChangePct as number) ?? null
  const vix = (marketCtx.vix as number) ?? null
  const yieldTen = (marketCtx.tenYearYield as number) ?? null
  const macroBrief = (marketCtx.macroBrief as string) ?? ''

  // Sector performance
  const sectors = (marketCtx.sectorMomentum as Array<{ sector: string; tone: string; momentum: number }> ?? [])
    .slice(0, 5)
    .map(s => `${s.sector}: ${s.tone} (${(s.momentum * 100).toFixed(1)}%)`)
    .join(', ')

  // Spotlight stocks summary
  const stocksCtx = spotlightStocks.slice(0, 3).map(s => ({
    ticker: s.ticker,
    name: s.companyName ?? s.name,
    currentPrice: s.currentPrice ?? s.price,
    fairValue: s.fairValue ?? s.insicFairValue,
    upsidePct: s.upsidePct ?? s.upside,
    impliedCagr: s.impliedCagr,
    historicalCagr: s.historicalCagr3y,
    signal: (s.upsidePct as number ?? 0) > 0.15 ? 'undervalued' : (s.upsidePct as number ?? 0) > -0.05 ? 'fairly-valued' : 'overvalued',
  }))

  const prompt = `You are the editor of insic, a stock valuation newsletter for serious individual investors. Write this week's digest in a confident, editorial, data-grounded voice — think a smart friend who reads Bloomberg and knows DCF models, not a hype newsletter. Be direct. Use numbers. Avoid clichés.

Market context this week:
- Overall sentiment: ${sentiment}
- S&P 500 weekly change: ${spxChange != null ? `${spxChange > 0 ? '+' : ''}${(spxChange * 100).toFixed(2)}%` : 'unavailable'}
- VIX: ${vix ?? 'unavailable'}
- 10Y Treasury yield: ${yieldTen != null ? `${(yieldTen * 100).toFixed(2)}%` : 'unavailable'}
- Sector performance: ${sectors || 'unavailable'}
- Macro brief: ${macroBrief || 'no macro brief available'}

3 stocks from our screener this week:
${stocksCtx.map(s => {
    const price = typeof s.currentPrice === 'number' ? s.currentPrice.toFixed(2) : '—'
    const fv = typeof s.fairValue === 'number' ? s.fairValue.toFixed(2) : '—'
    const up = typeof s.upsidePct === 'number' ? `${(s.upsidePct * 100).toFixed(1)}%` : '—'
    const ic = typeof s.impliedCagr === 'number' ? `${(s.impliedCagr * 100).toFixed(1)}%` : '—'
    return `- ${s.ticker} (${s.name}): price $${price}, fair value $${fv}, upside ${up}, implied CAGR ${ic}`
  }).join('\n')}

Write the following. Return ONLY a valid JSON object, no markdown fences, no extra text:
{
  "subjectLine": "A compelling 8-12 word subject line for the email. Should reference something specific from this week's market or stocks. No emojis.",
  "opening": "2-3 sentences. Specific, opinionated, grounded in the week's data. Tell the reader what kind of week it was and what it means for investors. Reference real numbers.",
  "marketSection": "120-160 words. Editorial market recap. Cover: what moved, what the data signals, which sectors led/lagged, what rate/macro moves mean for equities. Use specific numbers. Write like a smart investor talking to another smart investor. No bullet points — flowing prose.",
  "stockSpotlight": [
    {
      "ticker": "TICKER",
      "companyName": "Full company name",
      "thesis": "2 sentences. Why this stock is interesting right now. Be specific about the valuation gap or the opportunity. Reference the implied CAGR vs historical if relevant.",
      "signal": "undervalued OR fairly-valued OR overvalued",
      "fairValue": 123.45,
      "currentPrice": 100.00,
      "upsidePct": 0.234,
      "currency": "USD"
    }
  ],
  "macroNote": "1-2 sentences. A closing thought that connects the macro picture to valuation discipline. Something the reader will remember. Insightful, not generic."
}

Use exactly 3 stocks in stockSpotlight. Use the exact ticker symbols and prices provided. Keep the editorial voice consistent — grounded, confident, data-first.`

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (message.content[0] as { type: string; text: string }).text.trim()
    // Strip markdown fences if present
    const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(json) as DigestContent
    parsed.weekOf = weekOf
    return parsed
  } catch (err) {
    console.error('[weekly-digest] Claude generation failed:', err)
    // Fallback content
    return {
      subjectLine: `Your insic watchlist — week of ${weekOf}`,
      opening: `Here's your weekly valuation update from insic. Markets moved this week — here's what it means for your watchlist.`,
      marketSection: macroBrief || `Markets continued their pattern this week. Check your saved analyses below to see how your positions stack up against fair value.`,
      stockSpotlight: stocksCtx.slice(0, 3).map(s => ({
        ticker: s.ticker as string,
        companyName: s.name as string ?? s.ticker as string,
        thesis: `Trading at ${s.upsidePct != null ? `a ${((s.upsidePct as number) * 100).toFixed(0)}% discount` : 'fair value'} to our model. Worth a closer look this week.`,
        signal: s.signal as 'undervalued' | 'fairly-valued' | 'overvalued',
        fairValue: s.fairValue as number ?? 0,
        currentPrice: s.currentPrice as number ?? 0,
        upsidePct: s.upsidePct as number ?? 0,
        currency: 'USD',
      })),
      macroNote: `In volatile markets, the discipline of valuation is what separates investors from speculators. Keep your process.`,
      weekOf,
    }
  }
}

// ── Main cron handler ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  // Auth check
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  const weekOf = weekLabel()
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://insic.app'

  // ── Step 1: Fetch global market data and stock ideas ──────────────────────
  const [marketCtx, stockIdeas] = await Promise.all([
    fetchMarketContext(baseUrl),
    fetchStockIdeas(baseUrl),
  ])

  // ── Step 2: Generate editorial content with Claude (one call for all users) ─
  const editorialContent = await generateEditorialContent(marketCtx, stockIdeas, weekOf)

  // ── Step 3: Upsert draft into digest_drafts (keyed by week_label) ─────────
  const autoSendAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()

  const { error: upsertError } = await sb
    .from('digest_drafts')
    .upsert(
      {
        week_label: weekOf,
        status: 'draft',
        auto_send_at: autoSendAt,
        subject_line: editorialContent.subjectLine,
        opening: editorialContent.opening,
        market_section: editorialContent.marketSection,
        stock_spotlight: editorialContent.stockSpotlight,
        macro_note: editorialContent.macroNote,
        week_of: editorialContent.weekOf,
      },
      { onConflict: 'week_label' },
    )

  if (upsertError) {
    console.error('[weekly-digest] upsert error:', upsertError.message)
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  console.log(`[weekly-digest] draft saved — week: ${weekOf}, subject: ${editorialContent.subjectLine}`)
  return NextResponse.json({
    status: 'draft',
    week: weekOf,
    subject: editorialContent.subjectLine,
    opening: editorialContent.opening,
    auto_send_at: autoSendAt,
  })
}
