import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import * as XLSX from 'xlsx'

interface Position {
  ticker: string
  shares: number
  avgCost: number
  currency: string
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)

  const positions: Position[] = rows
    .map((row) => {
      const ticker = String(row['Ticker'] ?? row['ticker'] ?? row['TICKER'] ?? '').trim().toUpperCase()
      const shares = Number(row['Shares'] ?? row['shares'] ?? row['SHARES'] ?? 0)
      const avgCost = Number(row['Avg Cost'] ?? row['avg_cost'] ?? row['AvgCost'] ?? row['Average Cost'] ?? 0)
      const currency = String(row['Currency'] ?? row['currency'] ?? 'USD').trim().toUpperCase()
      return { ticker, shares, avgCost, currency }
    })
    .filter((p) => p.ticker && p.shares > 0)

  if (positions.length === 0) {
    return NextResponse.json({ error: 'No valid positions found. Expected columns: Ticker, Shares, Avg Cost' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('portfolios')
    .upsert({
      user_id: userId,
      user_email: session.user.email,
      positions,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ positions })
}
