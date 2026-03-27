import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase'
import Anthropic from '@anthropic-ai/sdk'
import yahooFinance from 'yahoo-finance2'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ART date string
function todayART(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userId = (session.user as { id?: string }).id
  if (!userId) return NextResponse.json({ error: 'No user ID' }, { status: 401 })

  const today = todayART()
  const supabase = createServiceClient()

  // Return cached analysis if already generated today
  const { data: cached } = await supabase
    .from('portfolio_analyses')
    .select('html')
    .eq('user_id', userId)
    .eq('date', today)
    .single()

  if (cached?.html) return NextResponse.json({ html: cached.html })

  // Get positions
  const { data: portfolioData } = await supabase
    .from('portfolios')
    .select('positions')
    .eq('user_id', userId)
    .single()

  if (!portfolioData?.positions?.length) {
    return NextResponse.json({ error: 'No portfolio found' }, { status: 404 })
  }

  type Position = { ticker: string; shares: number; avgCost: number; currency: string }
  const positions: Position[] = portfolioData.positions

  // Fetch current prices in parallel
  const priceResults = await Promise.allSettled(
    positions.map((p) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (yahooFinance.quote as any)(p.ticker).then((q: any) => ({
        ticker: p.ticker,
        price: q.regularMarketPrice ?? 0,
        change: q.regularMarketChangePercent ?? 0,
        name: q.shortName ?? p.ticker,
      }))
    )
  )

  const enriched = positions.map((p, i) => {
    const result = priceResults[i]
    const price = result.status === 'fulfilled' ? result.value.price : 0
    const change = result.status === 'fulfilled' ? result.value.change : 0
    const name = result.status === 'fulfilled' ? result.value.name : p.ticker
    const marketValue = price * p.shares
    const costBasis = p.avgCost * p.shares
    const pnl = marketValue - costBasis
    const pnlPct = costBasis > 0 ? (pnl / costBasis) * 100 : 0
    return { ...p, price, change, name, marketValue, costBasis, pnl, pnlPct }
  })

  const totalValue = enriched.reduce((s, p) => s + p.marketValue, 0)
  const totalCost = enriched.reduce((s, p) => s + p.costBasis, 0)
  const totalPnl = totalValue - totalCost
  const totalPnlPct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0

  const positionsSummary = enriched
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((p) => {
      const weight = totalValue > 0 ? ((p.marketValue / totalValue) * 100).toFixed(1) : '0'
      const sign = p.pnl >= 0 ? '+' : ''
      return `${p.ticker} (${p.name}): ${p.shares} shares @ $${p.avgCost.toFixed(2)} avg | current $${p.price.toFixed(2)} (${p.change >= 0 ? '+' : ''}${p.change.toFixed(2)}% today) | P&L: ${sign}$${p.pnl.toFixed(0)} (${sign}${p.pnlPct.toFixed(1)}%) | weight ${weight}%`
    })
    .join('\n')

  const portfolioSummary = `TOTAL PORTFOLIO VALUE: $${totalValue.toFixed(0)} | Total P&L: ${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)} (${totalPnl >= 0 ? '+' : ''}${totalPnlPct.toFixed(1)}%)`

  const warStart = new Date('2026-02-28T00:00:00-03:00')
  const artNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
  const warDay = Math.ceil((artNow.getTime() - warStart.getTime()) / (1000 * 60 * 60 * 24))

  const systemPrompt = `You are a senior portfolio analyst generating a personalized daily portfolio briefing. Use the same HTML design system as the Morning Brief (same CSS classes, same component patterns). The output must be a complete self-contained HTML file with the full CSS embedded.

CSS design system — embed this verbatim in <style>:
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',-apple-system,sans-serif;background:#f8fafc;color:#0f172a;-webkit-font-smoothing:antialiased}
.wrap{max-width:900px;margin:0 auto;padding:0 18px 60px}
.hdr{padding:24px 28px;border-radius:0 0 20px 20px;margin-bottom:22px;color:#fff;background:linear-gradient(135deg,#1e1b4b,#0f766e)}
.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px}
.hdr-title{font-size:28px;font-weight:700;letter-spacing:-.03em}
.hdr-date{font-size:13px;opacity:.75;margin-top:3px}
.badge{font-size:11px;font-weight:700;padding:5px 12px;border-radius:9999px;letter-spacing:.03em}
.badge-green{background:#22c55e;color:#052e16}.badge-red{background:#ef4444;color:#fff}.badge-amber{background:#f59e0b;color:#1c1917}
.hdr-sub{margin-top:16px;font-size:14px;line-height:1.7;opacity:.9}
.sec-label{font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#9ca3af;margin:28px 0 12px;padding-bottom:8px;border-bottom:2px solid #f3f4f6}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px}
.g4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:18px}
@media(max-width:680px){.g2,.g4{grid-template-columns:1fr 1fr}}
@media(max-width:420px){.g2,.g4{grid-template-columns:1fr}}
.card{background:#fff;border-radius:14px;padding:18px;border:1px solid rgba(0,0,0,.07);box-shadow:0 1px 4px rgba(0,0,0,.05);margin-bottom:14px}
.card-title{font-size:13px;font-weight:600;color:#111827;margin-bottom:10px}
.card-body{font-size:13px;color:#4b5563;line-height:1.75}
.card-body strong{color:#111827;font-weight:600}
.tc{background:#fff;border-radius:12px;padding:14px 16px;border:1px solid rgba(0,0,0,.07);border-top:3px solid var(--ac,#e5e7eb)}
.tc.cred{--ac:#ef4444}.tc.cgreen{--ac:#22c55e}.tc.cblue{--ac:#3b82f6}.tc.camber{--ac:#f59e0b}.tc.cgold{--ac:#d97706}
.tl{font-size:10px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:#9ca3af;margin-bottom:6px}
.tv{font-size:20px;font-weight:700;color:#111827;letter-spacing:-.04em;line-height:1}
.tc-ch{font-size:12px;font-weight:500;margin-top:5px}
.tc-note{font-size:11px;color:#9ca3af;margin-top:3px;line-height:1.4}
.up{color:#16a34a}.dn{color:#dc2626}.fl{color:#6b7280}
.metric{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;border-radius:9px;padding:10px 14px;margin-bottom:7px;border:1px solid #f3f4f6}
.ml{font-size:13px;font-weight:500;color:#374151}
.mv{font-size:13px;font-weight:700}.mv.bad{color:#dc2626}.mv.ok{color:#d97706}.mv.good{color:#16a34a}
.rec{display:flex;gap:11px;padding:10px 0;border-bottom:1px solid #f3f4f6}.rec:last-child{border-bottom:none}
.rec-n{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px}
.rec-body{flex:1;font-size:13px;color:#4b5563;line-height:1.7}
.rec-body strong{color:#111827;font-weight:600}
.scen{border-radius:10px;padding:12px 16px;margin-bottom:10px;font-size:13px;line-height:1.7;border:1px solid}
.scen-red{background:#fef2f2;border-color:#fecaca;color:#374151}.scen-red strong{color:#dc2626}
.scen-amber{background:#fffbeb;border-color:#fde68a;color:#374151}.scen-amber strong{color:#d97706}
.scen-green{background:#f0fdf4;border-color:#bbf7d0;color:#374151}.scen-green strong{color:#16a34a}
.qs{background:#fff;border-radius:14px;padding:22px;border:1px solid rgba(0,0,0,.07);margin-bottom:14px}
.qs-title{font-size:14px;font-weight:700;color:#111827;margin-bottom:14px}
.act-list{list-style:none}
.act-list li{display:flex;gap:10px;padding:7px 0;font-size:13px;color:#374151;line-height:1.65;border-bottom:1px solid #f9fafb}
.act-list li:last-child{border-bottom:none}.act-list li strong{color:#111827}
.dot{width:7px;height:7px;border-radius:50%;background:#2563eb;flex-shrink:0;margin-top:7px}
footer{text-align:center;padding:24px 0;font-size:11.5px;color:#9ca3af}

Output ONLY the raw HTML starting with <!DOCTYPE html>. No markdown fences.`

  const userPrompt = `Today is ${today} ART. War Day ${warDay}.

Portfolio snapshot:
${positionsSummary}

${portfolioSummary}

Generate a personalized portfolio analysis HTML with these sections:
1. Header (gradient #1e1b4b→#0f766e) — today's portfolio value, total P&L, key badge (green if up, red if down)
2. "📊 Today's Performance" — g4 ticker cards for the top 8 positions by weight, showing today's change
3. "💼 Portfolio Breakdown" — table/metrics showing each position: weight, P&L %, today's move, status (good/ok/bad)
4. "⚠️ Risk Analysis" — 3 scenarios (bull/base/bear) for the portfolio in the context of War Day ${warDay}, Iran situation, oil at current levels
5. "📋 Ranked Recommendations" — 5 specific, actionable recommendations based on today's prices and positions
6. Footer — timestamp

Be specific to the actual positions. Reference the war/Iran context where relevant (VIST, YPFD, PBR benefit from high oil; NVDA/QQQ hurt by risk-off). Use real P&L numbers from the data provided.`

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.filter((b) => b.type === 'text').pop()
  let html = (textBlock as { type: 'text'; text: string } | undefined)?.text ?? ''
  if (html.startsWith('```')) html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '').trim()

  if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
    return NextResponse.json({ error: 'Generation failed' }, { status: 500 })
  }

  // Cache for the day
  await supabase.from('portfolio_analyses').upsert({
    user_id: userId,
    date: today,
    html,
  }, { onConflict: 'user_id,date' })

  return NextResponse.json({ html })
}
