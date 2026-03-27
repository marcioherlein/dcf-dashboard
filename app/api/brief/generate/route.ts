import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })
  }

  const promptPath = join(process.cwd(), 'scripts', 'brief-prompt.md')
  if (!existsSync(promptPath)) {
    return NextResponse.json({ error: 'brief-prompt.md not found' }, { status: 500 })
  }
  const systemPrompt = readFileSync(promptPath, 'utf8')

  // Date in ART (UTC-3)
  const artNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const dateStr = artNow.toISOString().split('T')[0]
  const dateHuman = artNow.toLocaleDateString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  const isPM = artNow.getHours() >= 12
  const warStart = new Date('2026-02-28T00:00:00-03:00')
  const warDay = Math.ceil((artNow.getTime() - warStart.getTime()) / (1000 * 60 * 60 * 24))
  const timeStr = artNow.toLocaleTimeString('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })

  const userPrompt = `Today is ${dateHuman} (${dateStr}) ART. War Day ${warDay}. This is the ${isPM ? 'Evening (5pm)' : 'Morning (7am)'} Brief.

Use web_search to find the latest on each topic below. For each search, extract specific numbers (prices, % changes, bps), source URLs, and direct quotes. Cite every claim with an inline <a href="URL">source</a> link.

Search for:
1. "Iran war ceasefire Hormuz ${dateStr}"
2. "Trump Iran statement ${dateStr}"
3. "S&P 500 Nasdaq close ${dateStr}"
4. "Brent WTI crude oil price ${dateStr}"
5. "gold price ${dateStr}"
6. "Argentina Merval country risk ${dateStr}"
7. "Brazil Ibovespa real BRL ${dateStr}"
8. "SAP stock news analyst ${dateStr}"
9. "NVDA Nvidia stock ${dateStr}"

After all searches, generate the complete ${isPM ? 'Evening' : 'Morning'} Brief HTML for War Day ${warDay}. Include exactly this timestamp stamp in the brief header: "Generated ${timeStr} ART". Match the depth, sourcing, and tone of the canonical style in your system prompt exactly. Output ONLY the raw HTML starting with <!DOCTYPE html> — no markdown, no explanation.`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      tools: [{ type: 'web_search_20250305' as const, name: 'web_search' }],
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })

    const textBlock = response.content.filter((b) => b.type === 'text').pop()
    const html = (textBlock as { type: 'text'; text: string } | undefined)?.text ?? ''

    if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
      return NextResponse.json({ error: 'Response is not HTML', details: html.slice(0, 300) }, { status: 500 })
    }

    // Write to filesystem (works in dev; read-only in Vercel production — ignored)
    try {
      const briefsDir = join(process.cwd(), 'public', 'briefs')
      mkdirSync(briefsDir, { recursive: true })
      writeFileSync(join(briefsDir, `${dateStr}.html`), html, 'utf8')
      writeFileSync(join(briefsDir, 'latest.html'), html, 'utf8')
    } catch {
      // Filesystem not writable (Vercel prod) — HTML is returned in response
    }

    return NextResponse.json({ html, generatedAt: new Date().toISOString() })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
