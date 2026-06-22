import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// PATCH /api/valuations/[id] — update thesis on a saved valuation
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email ?? null
    if (!userEmail) return NextResponse.json({ error: 'Login required' }, { status: 401 })

    const sb = getServiceClient()
    if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const { id } = await params
    const body = await req.json()

    // Validate — only allow thesis fields
    const thesis       = typeof body.thesis        === 'string'  ? body.thesis.slice(0, 1000) : null
    const thesisPublic = typeof body.thesisPublic  === 'boolean' ? body.thesisPublic           : false

    // Resolve user ID from email
    const { data: userRow } = await sb
      .from('users').select('id').eq('email', userEmail).single()
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 403 })
    const userId = (userRow as { id: string }).id

    // Fetch the row first to get existing model_inputs
    const { data: existing, error: fetchErr } = await sb
      .from('valuations')
      .select('id, user_id, model_inputs')
      .eq('id', id)
      .single()

    if (fetchErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if ((existing as { user_id: string }).user_id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Merge thesis into model_inputs JSONB — no schema change needed
    const currentInputs = (existing as { model_inputs: Record<string, unknown> | null }).model_inputs ?? {}
    const updatedInputs = { ...currentInputs, thesis, thesisPublic }

    const { data: updated, error: updateErr } = await sb
      .from('valuations')
      .update({ model_inputs: updatedInputs })
      .eq('id', id)
      .select()
      .single()

    if (updateErr) throw updateErr
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// DELETE /api/valuations/[id] — remove a saved valuation
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    const userEmail = session?.user?.email ?? null
    if (!userEmail) return NextResponse.json({ error: 'Login required' }, { status: 401 })

    const sb = getServiceClient()
    if (!sb) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 })

    const { id } = await params

    const { data: userRow } = await sb
      .from('users').select('id').eq('email', userEmail).single()
    if (!userRow) return NextResponse.json({ error: 'User not found' }, { status: 403 })
    const userId = (userRow as { id: string }).id

    const { error } = await sb
      .from('valuations')
      .delete()
      .eq('id', id)
      .eq('user_id', userId)

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
