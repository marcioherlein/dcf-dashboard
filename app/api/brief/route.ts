import { NextResponse } from 'next/server'
import { existsSync, statSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'

export async function GET() {
  const briefPath = join(process.cwd(), 'public', 'briefs', 'latest.html')
  if (!existsSync(briefPath)) return NextResponse.json({ available: false })
  const { mtime } = statSync(briefPath)
  return NextResponse.json({ available: true, generatedAt: mtime.toISOString() })
}
