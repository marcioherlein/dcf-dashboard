import { NextResponse } from 'next/server'
import { getRfRate } from '@/lib/data/fredClient'
import { rateLimit } from '@/lib/rateLimit'

export async function GET() {
  const rate = await getRfRate()
  return NextResponse.json({ rate })
}
