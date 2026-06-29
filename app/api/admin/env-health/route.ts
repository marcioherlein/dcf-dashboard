import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marciofabrizio@gmail.com').split(',').map(e => e.trim())

const REQUIRED_VARS = [
  'RESEND_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
]

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const adminKey = req.headers.get('x-admin-key')
  const isAdmin = ADMIN_EMAILS.includes(session?.user?.email ?? '') || adminKey === process.env.ADMIN_STATUS_KEY
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const results = REQUIRED_VARS.map(key => ({
    key,
    set: !!process.env[key],
    // Never show the value — only whether it is set
  }))

  const allSet = results.every(r => r.set)
  return NextResponse.json({ ok: allSet, vars: results }, { status: allSet ? 200 : 503 })
}
