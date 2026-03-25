import { GoogleGenerativeAI } from '@google/generative-ai'
import { writeFileSync, mkdirSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

// Date in ART (UTC-3)
const artNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }))
const dateStr = artNow.toISOString().split('T')[0]  // YYYY-MM-DD
const dateHuman = artNow.toLocaleDateString('en-US', {
  timeZone: 'America/Argentina/Buenos_Aires',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})
const isPM = artNow.getHours() >= 12

// War day counter: War Day 1 = Feb 28, 2026
const warStart = new Date('2026-02-28T00:00:00-03:00')
const warDay = Math.ceil((artNow - warStart) / (1000 * 60 * 60 * 24))

const systemPrompt = readFileSync(join(__dirname, 'brief-prompt.md'), 'utf8')

const userPrompt = `Today is ${dateHuman} (${dateStr}) ART. War Day ${warDay}. This is the ${isPM ? 'Evening (5pm)' : 'Morning (7am)'} Brief.

Search the web for the latest on all of these topics:
- Iran ceasefire Hormuz war update ${dateStr}
- Trump Iran statement ${dateStr}
- S&P 500 Nasdaq markets ${dateStr}
- Brent WTI oil price ${dateStr}
- Argentina Merval country risk ${dateStr}
- Brazil Ibovespa BRL ${dateStr}
- Gold price ${dateStr}
- SAP stock analyst rating ${dateStr}

Then generate the complete Morning Brief HTML for War Day ${warDay}. Output ONLY the raw HTML document starting with <!DOCTYPE html> — no markdown fences, no explanation.`

console.log(`Generating brief for ${dateStr} (War Day ${warDay}, ${isPM ? 'Evening' : 'Morning'})...`)

const model = genAI.getGenerativeModel({
  model: 'gemini-2.0-flash',
  tools: [{ googleSearch: {} }],
  systemInstruction: systemPrompt,
})

const result = await model.generateContent(userPrompt)
let html = result.response.text().trim()

// Strip markdown fences if Gemini wraps the output despite instructions
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
