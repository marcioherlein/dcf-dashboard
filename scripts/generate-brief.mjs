import Anthropic from '@anthropic-ai/sdk'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Date in ART (UTC-3)
const artNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
const dateStr = artNow.toISOString().split('T')[0]  // YYYY-MM-DD
const dateHuman = artNow.toLocaleDateString('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})
const isPM = artNow.getHours() >= 12

// War day counter: War Day 1 = Feb 28, 2026
const warStart = new Date('2026-02-28T00:00:00-03:00')
const warDay = Math.ceil((artNow - warStart) / (1000 * 60 * 60 * 24))

const systemPrompt = readFileSync(join(__dirname, 'brief-prompt.md'), 'utf8')

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

After all searches, generate the complete Morning Brief HTML for War Day ${warDay}. Match the depth, sourcing, and tone of the canonical style in your system prompt exactly. Output ONLY the raw HTML starting with <!DOCTYPE html> — no markdown, no explanation.`

console.log(`Generating brief for ${dateStr} (War Day ${warDay}, ${isPM ? 'Evening' : 'Morning'})...`)

const response = await client.messages.create({
  model: 'claude-sonnet-4-6',
  max_tokens: 16000,
  tools: [{ type: 'web_search_20250305', name: 'web_search' }],
  system: systemPrompt,
  messages: [{ role: 'user', content: userPrompt }],
})

// Extract the final text block (last text block after all tool use rounds)
const html = response.content.filter((b) => b.type === 'text').pop()?.text ?? ''

if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
  throw new Error(`Response is not HTML. Got:\n${html.slice(0, 400)}`)
}

const briefsDir = join(__dirname, '../public/briefs')
mkdirSync(briefsDir, { recursive: true })
writeFileSync(join(briefsDir, `${dateStr}.html`), html, 'utf8')
writeFileSync(join(briefsDir, 'latest.html'), html, 'utf8')
console.log(`✓ Brief saved: ${dateStr}.html (${html.length} chars)`)
