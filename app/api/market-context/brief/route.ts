import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { rateLimit } from '@/lib/rateLimit'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, 5, 300_000, 'market-context-brief') // 5 per 5 min
  if (limited) return limited

  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json()
    const { signals, pulse } = body as {
      signals: { id: string; label: string; value: string; regimeLabel: string }[]
      pulse: { vix: number; spxChange1d: number; tnxYield: number; sentimentLabel: string }
    }

    if (!signals?.length) {
      return NextResponse.json({ error: 'signals required' }, { status: 400 })
    }

    const regimeKey = signals.map(s => s.regimeLabel).sort().join('|')

    const supabase = createServiceClient()

    // Return cached brief if still fresh (4 hours)
    const { data: cached } = await supabase
      .from('macro_briefs')
      .select('brief_text, created_at')
      .eq('regime_key', regimeKey)
      .single()

    if (cached) {
      return NextResponse.json({ brief: cached.brief_text, cachedAt: cached.created_at })
    }

    // Generate new brief
    const signalsSummary = signals.map(s => `${s.label}: ${s.value} (${s.regimeLabel})`).join(', ')
    const prompt = `You are a macro strategist. Current market conditions: VIX ${pulse.vix.toFixed(1)} (${signals.find(s => s.id === 'vix')?.regimeLabel ?? ''}), SPX ${pulse.spxChange1d >= 0 ? '+' : ''}${pulse.spxChange1d.toFixed(2)}% today, 10Y Treasury ${pulse.tnxYield.toFixed(2)}% (${signals.find(s => s.id === 'tnx')?.regimeLabel ?? ''}), ${signalsSummary}. Write exactly 2 sentences: the first on the current macro regime and what's driving it, the second on the specific implication for equity DCF valuations today. Be direct and specific — no hedging, no generic statements.`

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const brief = (response.content[0] as { type: 'text'; text: string }).text.trim()

    // Cache with 4-hour expiry
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
    await supabase.from('macro_briefs').upsert(
      { regime_key: regimeKey, brief_text: brief, expires_at: expiresAt },
      { onConflict: 'regime_key' }
    )

    return NextResponse.json({ brief, cachedAt: new Date().toISOString() })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
