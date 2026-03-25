import { NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { join } from 'path'

// No revalidation needed — this just checks the local filesystem
export const dynamic = 'force-dynamic'

export async function GET() {
  const briefPath = join(process.cwd(), 'public', 'briefs', 'latest.html')
  return NextResponse.json({ available: existsSync(briefPath) })
}
