import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import type { WatchlistEntry } from '@/lib/simplifier/types'

const TABLE = 'simplifier_watchlist'

export async function GET(req: NextRequest) {
  const userEmail = req.nextUrl.searchParams.get('user')
  if (!userEmail) return NextResponse.json([], { status: 400 })

  try {
    const client = createServiceClient()
    const { data, error } = await client
      .from(TABLE)
      .select('*')
      .eq('user_id', userEmail)
      .order('updated_at', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { userEmail: string; entry: WatchlistEntry }
    const { userEmail, entry } = body
    if (!userEmail || !entry?.ticker) {
      return NextResponse.json({ error: 'userEmail and entry.ticker required' }, { status: 400 })
    }

    const client = createServiceClient()
    const { data, error } = await client
      .from(TABLE)
      .upsert(
        {
          user_id: userEmail,
          ticker: entry.ticker,
          company_name: entry.companyName,
          updated_at: entry.updatedAt,
          current_phase: entry.currentPhase,
          answers: entry.answers,
          notes: entry.notes,
          phase_scores: entry.phaseScores,
          overall_score: entry.overallScore,
          financial_snapshot: entry.snapshot,
        },
        { onConflict: 'user_id,ticker' },
      )
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const userEmail = req.nextUrl.searchParams.get('user')
  const ticker    = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!userEmail || !ticker) {
    return NextResponse.json({ error: 'user and ticker required' }, { status: 400 })
  }

  try {
    const client = createServiceClient()
    const { error } = await client
      .from(TABLE)
      .delete()
      .eq('user_id', userEmail)
      .eq('ticker', ticker)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
