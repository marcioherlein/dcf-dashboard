import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 401 })

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('portfolios')
    .select('positions, updated_at')
    .eq('user_id', userId)
    .single()

  if (error || !data) return NextResponse.json({ positions: null })
  return NextResponse.json(data)
}
