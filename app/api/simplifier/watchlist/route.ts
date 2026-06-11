import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import type { WatchlistEntry, ListTag } from '@/lib/simplifier/types'

const TABLE = 'simplifier_watchlist'

export async function GET() {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json([], { status: 401 })

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
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as { entry: WatchlistEntry }
    const { entry } = body
    if (!entry?.ticker) {
      return NextResponse.json({ error: 'entry.ticker required' }, { status: 400 })
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
          list_tag: entry.listTag ?? null,
          group_name: entry.groupName ?? null,
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
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const ticker = req.nextUrl.searchParams.get('ticker')?.toUpperCase()
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 })
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

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const userEmail = session?.user?.email
  if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = await req.json() as { ticker: string; listTag?: ListTag; groupName?: string | null }
    const { ticker, listTag, groupName } = body
    if (!ticker) {
      return NextResponse.json({ error: 'ticker required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (listTag !== undefined)  updates.list_tag   = listTag
    if (groupName !== undefined) updates.group_name = groupName

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    const client = createServiceClient()
    const { error } = await client
      .from(TABLE)
      .update(updates)
      .eq('user_id', userEmail)
      .eq('ticker', ticker.toUpperCase())

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
