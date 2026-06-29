import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import WeeklyDigestEmail, { type WatchlistStock, type DigestContent } from '@/emails/WeeklyDigestEmail'

export const maxDuration = 300

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? 'marcioherlein@gmail.com')
  .split(',').map(e => e.trim())

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

async function fetchLivePrices(
  baseUrl: string,
  tickers: string[],
): Promise<Map<string, { price: number; changePct: number }>> {
  const map = new Map<string, { price: number; changePct: number }>()
  if (tickers.length === 0) return map
  try {
    const q = tickers.join(',')
    const res = await fetch(`${baseUrl}/api/quotes?tickers=${encodeURIComponent(q)}`, {
      next: { revalidate: 0 },
    })
    if (!res.ok) return map
    const data = (await res.json()) as Record<string, unknown>[]
    for (const item of data) {
      const ticker = item.symbol as string
      const price = item.regularMarketPrice as number
      const changePct = (item.regularMarketChangePercent as number) ?? 0
      if (ticker && price) map.set(ticker, { price, changePct })
    }
  } catch {
    // Silent — live prices are best-effort
  }
  return map
}

export async function POST(req: NextRequest) {
  // Auth check: admin session OR CRON_SECRET header
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const session = await getServerSession(authOptions)
    if (!ADMIN_EMAILS.includes(session?.user?.email ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })
  }

  const sb = getServiceClient()
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })

  // Parse optional body
  let digestId: string | undefined
  let testEmail: string | undefined
  const bodyOverrides: Partial<{ subject: string; openingParagraph: string; marketSection: string; macroNote: string }> = {}
  try {
    const body = await req.json() as { digestId?: string; testEmail?: string; subject?: string; openingParagraph?: string; marketSection?: string; macroNote?: string }
    digestId = body.digestId
    testEmail = body.testEmail
    if (body.subject) bodyOverrides.subject = body.subject
    if (body.openingParagraph) bodyOverrides.openingParagraph = body.openingParagraph
    if (body.marketSection) bodyOverrides.marketSection = body.marketSection
    if (body.macroNote) bodyOverrides.macroNote = body.macroNote
  } catch {
    // Body is optional — ignore parse errors
  }

  // Load the draft
  let draftQuery = sb.from('digest_drafts').select('*')
  if (digestId) {
    draftQuery = draftQuery.eq('id', digestId)
  } else {
    // Find the latest approved draft, or one that is auto-send-due
    draftQuery = draftQuery
      .in('status', ['approved', 'scheduled'])
      .order('created_at', { ascending: false })
      .limit(1)
  }

  const { data: drafts, error: draftError } = await draftQuery
  if (draftError) {
    return NextResponse.json({ error: draftError.message }, { status: 500 })
  }

  const draft = (drafts ?? [])[0]
  if (!draft) {
    return NextResponse.json({ error: 'No eligible draft found' }, { status: 404 })
  }

  if (draft.status === 'sent') {
    return NextResponse.json({ error: 'already sent' }, { status: 409 })
  }

  // Apply any inline edits from the preview page
  const editorialContent: DigestContent = {
    ...(draft.content as DigestContent),
    ...(bodyOverrides.subject && { subjectLine: bodyOverrides.subject }),
    ...(bodyOverrides.openingParagraph && { opening: bodyOverrides.openingParagraph }),
    ...(bodyOverrides.marketSection && { marketSection: bodyOverrides.marketSection }),
    ...(bodyOverrides.macroNote && { macroNote: bodyOverrides.macroNote }),
  }
  if (!editorialContent) {
    return NextResponse.json({ error: 'Draft has no content' }, { status: 422 })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const baseUrl = process.env.NEXTAUTH_URL ?? 'https://insic.app'

  // TEST MODE — send only to the specified email with sample watchlist
  if (testEmail) {
    try {
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: testEmail,
        subject: `[TEST] ${editorialContent.subjectLine}`,
        react: WeeklyDigestEmail({
          name: 'Marcio',
          watchlist: [
            { ticker: 'MSFT', companyName: 'Microsoft', fairValue: 462, currentPrice: 379, priceAtSave: 360, upsidePct: 0.219, cagr: 0.12, currency: 'USD' },
            { ticker: 'NVDA', companyName: 'NVIDIA', fairValue: 196, currentPrice: 211, priceAtSave: 180, upsidePct: -0.071, cagr: 0.22, currency: 'USD' },
          ],
          content: editorialContent,
        }),
      })
      return NextResponse.json({ sent: 1, test: true, to: testEmail })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Send failed' }, { status: 500 })
    }
  }

  // Load all users with saved valuations
  const { data: rows, error: rowsError } = await sb
    .from('valuations')
    .select(
      `ticker, price_at_save, fair_value, upside_pct, cagr, inputs, user_id, users!inner ( id, email, name, newsletter_opt_in )`,
    )
    .order('saved_at', { ascending: false })

  if (rowsError) {
    console.error('[digest-send] fetch valuations error:', rowsError.message)
    return NextResponse.json({ error: rowsError.message }, { status: 500 })
  }

  // Group valuations by user
  const byUser = new Map<
    string,
    { email: string; name: string | null; tickers: string[]; entries: WatchlistStock[] }
  >()

  for (const row of rows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = (row as any).users
    if (!user?.email) continue
    if (user.newsletter_opt_in === false) continue

    if (!byUser.has(user.id)) {
      byUser.set(user.id, { email: user.email, name: user.name ?? null, tickers: [], entries: [] })
    }

    const entry = byUser.get(user.id)!
    if (!entry.tickers.includes((row as { ticker: string }).ticker)) {
      entry.tickers.push((row as { ticker: string }).ticker)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const inputs = (row as any).inputs ?? {}
      entry.entries.push({
        ticker: (row as { ticker: string }).ticker,
        companyName:
          inputs.companyName ?? inputs.company ?? (row as { ticker: string }).ticker,
        fairValue: (row as { fair_value: number | null }).fair_value,
        currentPrice: null,
        priceAtSave: (row as { price_at_save: number | null }).price_at_save,
        upsidePct: (row as { upside_pct: number | null }).upside_pct,
        cagr: (row as { cagr: number | null }).cagr,
        currency: inputs.currency ?? 'USD',
      })
    }
  }

  if (byUser.size === 0) {
    return NextResponse.json({ sent: 0, message: 'No users with saved valuations' })
  }

  // Fetch live prices for all unique tickers
  const allTickers = Array.from(
    new Set(Array.from(byUser.values()).flatMap(u => u.tickers)),
  )
  const livePrices = await fetchLivePrices(baseUrl, allTickers)

  // Apply live prices to entries
  for (const { entries } of Array.from(byUser.values())) {
    for (const entry of entries) {
      const live = livePrices.get(entry.ticker)
      if (live) {
        entry.currentPrice = live.price
        if (entry.fairValue && live.price > 0) {
          entry.upsidePct = (entry.fairValue - live.price) / live.price
        }
      }
    }
  }

  // Send emails
  let sent = 0
  let failed = 0

  for (const [, { email, name, entries }] of Array.from(byUser.entries())) {
    const sortedEntries = [...entries].sort(
      (a, b) => (b.upsidePct ?? -1) - (a.upsidePct ?? -1),
    )

    try {
      await resend.emails.send({
        from: 'insic <team@insic.app>',
        to: email,
        subject: editorialContent.subjectLine,
        react: WeeklyDigestEmail({
          name,
          watchlist: sortedEntries.slice(0, 10),
          content: editorialContent,
        }),
      })
      sent++
    } catch (err) {
      console.error(
        `[digest-send] failed for ${email}:`,
        err instanceof Error ? err.message : err,
      )
      failed++
    }
  }

  // Mark draft as sent
  const { error: updateError } = await sb
    .from('digest_drafts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', draft.id)

  if (updateError) {
    console.error('[digest-send] failed to update draft status:', updateError.message)
    // Non-fatal — emails already sent, still return success
  }

  console.log(
    `[digest-send] done — sent: ${sent}, failed: ${failed}, week: ${editorialContent.weekOf}, subject: ${editorialContent.subjectLine}`,
  )

  return NextResponse.json({
    sent,
    failed,
    week: editorialContent.weekOf,
    subject: editorialContent.subjectLine,
  })
}
