import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com')
  .split(',')
  .map((e) => e.trim())

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

async function requireAdmin(): Promise<{ email: string } | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return { email: session.user.email }
}

// ---------------------------------------------------------------------------
// GET /api/admin/digest-preview
// Returns the latest digest_drafts row
// ---------------------------------------------------------------------------
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const sb = serviceClient()
  const { data, error } = await sb
    .from('digest_drafts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[digest-preview GET]', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/digest-preview
// Accepts { subject_line?, opening?, market_section?, macro_note?, status? }
// Updates the latest draft row and returns the updated row
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const allowed = ['subject_line', 'opening', 'market_section', 'macro_note', 'status']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 })
  }

  const sb = serviceClient()

  // Find the latest draft id
  const { data: latest, error: findError } = await sb
    .from('digest_drafts')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    console.error('[digest-preview PATCH find]', findError.message)
    return NextResponse.json({ error: findError.message }, { status: 500 })
  }

  if (!latest) {
    return NextResponse.json({ error: 'No draft found' }, { status: 404 })
  }

  const { data: updated, error: updateError } = await sb
    .from('digest_drafts')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', latest.id)
    .select()
    .single()

  if (updateError) {
    console.error('[digest-preview PATCH update]', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json(updated)
}

// ---------------------------------------------------------------------------
// POST /api/admin/digest-preview  (auto-trigger — called by Vercel cron)
// Header: x-cron-secret must match CRON_SECRET env var
// Finds drafts where auto_send_at <= now() and status = 'draft',
// marks each as 'approved' to trigger the downstream send pipeline.
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || req.headers.get('x-cron-secret') !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sb = serviceClient()
  const now = new Date().toISOString()

  const { data: due, error: fetchError } = await sb
    .from('digest_drafts')
    .select('id')
    .eq('status', 'draft')
    .lte('auto_send_at', now)

  if (fetchError) {
    console.error('[digest-preview auto-trigger fetch]', fetchError.message)
    return NextResponse.json({ error: fetchError.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ triggered: 0, message: 'No drafts due for auto-send' })
  }

  const ids = due.map((r) => r.id)

  const { error: updateError } = await sb
    .from('digest_drafts')
    .update({ status: 'approved', updated_at: now })
    .in('id', ids)

  if (updateError) {
    console.error('[digest-preview auto-trigger update]', updateError.message)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  console.log(`[digest-preview auto-trigger] marked ${ids.length} draft(s) as approved:`, ids)

  return NextResponse.json({ triggered: ids.length, ids })
}
