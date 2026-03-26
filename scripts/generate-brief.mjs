import Groq from 'groq-sdk'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Date in ART (UTC-3)
const artNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
const dateStr = artNow.toISOString().split('T')[0]
const dateHuman = artNow.toLocaleDateString('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})
const isPM = artNow.getHours() >= 12
const warStart = new Date('2026-02-28T00:00:00-03:00')
const warDay = Math.ceil((artNow - warStart) / (1000 * 60 * 60 * 24))

// ── Free RSS feeds ────────────────────────────────────────────────────────────
const RSS_FEEDS = [
  'https://feeds.bbci.co.uk/news/world/rss.xml',
  'https://feeds.bbci.co.uk/news/business/rss.xml',
  'https://www.cnbc.com/id/100003114/device/rss/rss.html',
  'https://finance.yahoo.com/news/rssindex',
  'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
  'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',
]

function parseRSS(xml) {
  const items = []
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const c = match[1]
    const title = c.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/s)?.[1]
      ?.trim().replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    const desc = c.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/s)?.[1]
      ?.trim().replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').slice(0, 160)
    if (title && title.length > 5) items.push(`• ${title}${desc ? ': ' + desc : ''}`)
  }
  return items.slice(0, 8)
}

async function fetchFeed(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    return parseRSS(await res.text())
  } catch {
    return []
  }
}

console.log(`Generating brief for ${dateStr} (War Day ${warDay}, ${isPM ? 'Evening' : 'Morning'})...`)
console.log('Fetching news feeds...')

const results = await Promise.all(RSS_FEEDS.map(fetchFeed))
const headlines = results.flat()
console.log(`Got ${headlines.length} headlines from ${results.filter(r => r.length > 0).length}/${RSS_FEEDS.length} feeds`)

const newsContext = headlines.length > 0
  ? `Latest headlines fetched from news feeds:\n${headlines.join('\n')}`
  : 'Note: No live feeds available — use your background knowledge for current context.'

const systemPrompt = readFileSync(join(__dirname, 'brief-prompt.md'), 'utf8')
const userPrompt = `Today is ${dateHuman} (${dateStr}) ART. War Day ${warDay}. This is the ${isPM ? 'Evening (5pm)' : 'Morning (7am)'} Brief.

${newsContext}

Generate the complete Morning Brief HTML for War Day ${warDay}. Output ONLY the raw HTML document starting with <!DOCTYPE html> — no markdown fences, no explanation.`

const response = await groq.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ],
  max_tokens: 6000,
  temperature: 0.3,
})

let html = response.choices[0].message.content.trim()

if (html.startsWith('```')) {
  html = html.replace(/^```(?:html)?\n?/, '').replace(/\n?```$/, '').trim()
}

if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
  throw new Error(`Response is not HTML. Got:\n${html.slice(0, 400)}`)
}

const briefsDir = join(__dirname, '../public/briefs')
mkdirSync(briefsDir, { recursive: true })
writeFileSync(join(briefsDir, `${dateStr}.html`), html, 'utf8')
writeFileSync(join(briefsDir, 'latest.html'), html, 'utf8')
console.log(`✓ Brief saved: ${dateStr}.html (${html.length} chars)`)
