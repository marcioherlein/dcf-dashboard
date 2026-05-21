/**
 * Creator Agent — analyzes the Rationale codebase and proposes
 * product improvements, new features, and UX enhancements that make
 * the app stronger, more useful, and more competitive.
 *
 * Usage:
 *   node scripts/creator-agent.mjs
 *
 * Requires: ANTHROPIC_API_KEY in .env.local or environment.
 */

import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Load .env.local ──────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local')
  if (!fs.existsSync(envPath)) return
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnv()

// ─── File collector ───────────────────────────────────────────────────────────
function readFile(relPath) {
  const abs = path.join(ROOT, relPath)
  if (!fs.existsSync(abs)) return null
  const content = fs.readFileSync(abs, 'utf8')
  // Trim very long files to keep context manageable
  const lines = content.split('\n')
  if (lines.length > 250) {
    return lines.slice(0, 250).join('\n') + '\n... (truncated)'
  }
  return content
}

function collectCodebase() {
  const files = [
    // Product structure
    'package.json',
    'app/pricing/page.tsx',
    'app/page.tsx',
    'app/layout.tsx',
    'app/monitor/page.tsx',
    'app/valuations/page.tsx',
    'app/markets/page.tsx',
    'app/simplifier/page.tsx',
    'app/ai-stack/page.tsx',
    'app/factor-ranking/page.tsx',
    'app/strategy/page.tsx',
    'app/trading/page.tsx',
    // Key components
    'components/layout/TopBar.tsx',
    'components/layout/BottomNav.tsx',
    'components/modelling/ModellingWorkspace.tsx',
    'components/valuation/ValuationLab.tsx',
    'components/home/Portfolio.tsx',
    'components/monetization/PaywallModal.tsx',
    'components/auth/LoginGateProvider.tsx',
    // API routes (reveal data capabilities)
    'app/api/brief/generate/route.ts',
    'app/api/portfolio/analyze/route.ts',
    'app/api/valuations/route.ts',
    'app/api/watchlist/route.ts',
    'app/api/factor-ranking/route.ts',
    'app/api/financials/route.ts',
    'app/api/market-context/route.ts',
    'app/api/trading/live-signal/route.ts',
    // Config
    'config/valuation.config.ts',
    'lib/supabase.ts',
  ]

  const sections = []
  for (const relPath of files) {
    const content = readFile(relPath)
    if (!content) continue
    sections.push(`### FILE: ${relPath}\n\`\`\`\n${content}\n\`\`\``)
  }
  return sections.join('\n\n')
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN
  if (!apiKey) {
    console.error('❌  No Anthropic API key found.')
    console.error('    Add ANTHROPIC_API_KEY=sk-ant-... to .env.local')
    console.error('    Get a key at: https://console.anthropic.com/settings/keys')
    process.exit(1)
  }

  const clientOpts = { apiKey }
  if (process.env.ANTHROPIC_BASE_URL) {
    clientOpts.baseURL = process.env.ANTHROPIC_BASE_URL
  }
  const client = new Anthropic(clientOpts)

  console.log('📂  Collecting codebase files...')
  const codebase = collectCodebase()
  console.log(`    ${codebase.split('\n').length.toLocaleString()} lines across key files\n`)

  console.log('🤖  Sending to Claude for analysis (with prompt caching)...\n')

  const systemPrompt = `You are a senior product designer, full-stack engineer, and investing-app specialist. You have deep expertise in both software product development and fundamental equity analysis.

You will analyse the complete source code of "Rationale" — a Next.js stock-valuation dashboard for individual investors — and produce a thorough product-improvement report.

Your job is NOT primarily about monetization. It is about making Rationale the best possible tool for an individual investor who wants to value stocks rigorously and make better investment decisions. Think about what a sophisticated retail investor actually needs, where the current product falls short, and what additions would make them use this every day instead of opening a competitor.

Organise your output into FOUR sections:

---

### SECTION 1 — Core Product Gaps
What is the product missing that a serious investor would expect? Think about:
- Missing data or metrics that are standard in investing (e.g., free cash flow yield, earnings quality, insider ownership, short interest, analyst estimates vs actuals)
- Workflow holes (e.g., can the user compare two stocks side by side? can they see how assumptions affect the model in real-time? can they annotate their reasoning?)
- Valuation model weaknesses (e.g., are the DCF assumptions well-calibrated? is WACC computed correctly? are edge cases handled — negative earnings, hypergrowth, cyclicals?)
- Data freshness / reliability issues visible from the code

For each gap: name it, explain why it matters to the user, rate difficulty (S/M/L), and give concrete implementation notes.

---

### SECTION 2 — UX & Interaction Improvements
Where does the current interface make users work too hard or feel confused? Think about:
- Information hierarchy — is the most important number (fair value vs price) the most prominent thing on screen?
- Missing feedback loops (e.g., when the user changes the CAGR slider, do they instantly see which assumptions are most sensitive?)
- Onboarding — would a new user know what to do or where to start?
- Mobile experience gaps
- Empty states — what happens when data is missing or an API call fails?
- Loading states and perceived performance

For each issue: name it, explain the user impact, rate difficulty (S/M/L), and give concrete implementation notes.

---

### SECTION 3 — High-Value New Features
What genuinely new capabilities would make users significantly more effective investors? Think about:
- Comparative analysis (peer comparison, sector context, historical comparison)
- Qualitative analysis tools (competitive moat scoring, management quality, ESG signals)
- Portfolio-level thinking (correlation, concentration risk, portfolio-level fair value)
- Alert and monitoring workflows
- AI-powered features where Claude can add unique insight not available elsewhere
- Integrations with widely-used investor workflows (export to Excel, share to Twitter, etc.)

For each feature: name it, explain the investor value, rate difficulty (S/M/L), give concrete implementation notes, and note if it has monetization potential.

---

### SECTION 4 — Technical & Reliability Improvements
What under-the-hood improvements would make the app faster, more reliable, and more maintainable? Think about:
- API rate-limit exposure (Yahoo Finance has strict limits — where is the app vulnerable?)
- Caching strategy (what should be cached that isn't?)
- Error handling — where does the app silently fail?
- Data validation — where could bad data from Yahoo/FMP corrupt a valuation output?
- Performance bottlenecks visible from the code structure

For each item: name it, explain the risk/impact, rate difficulty (S/M/L), and give concrete fix notes.

---

End with a **"Top 5 Things to Build Next"** table ranked by (impact on user × implementation speed).

Format everything as clean Markdown. Be specific — reference actual file names, component names, and API routes from the codebase. Avoid vague advice. Every recommendation must be actionable by a solo developer in the next sprint.`

  // Prompt caching: the large codebase context is the stable prefix — mark it
  // with cache_control so repeated runs (e.g. after minor tweaks) reuse it.
  const response = await client.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 10000,
    thinking: { type: 'adaptive' },
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            // The codebase is the large, stable prefix — cache it
            text: `Here is the full Rationale codebase snapshot:\n\n${codebase}`,
            cache_control: { type: 'ephemeral' },
          },
          {
            type: 'text',
            text: `Today's date is ${new Date().toISOString().slice(0, 10)}.

Please analyse the codebase above and produce the product-improvement report as described in your instructions.

As you read the code, pay close attention to:
- What data is already being fetched but not fully displayed or leveraged (Yahoo Finance, FMP, FRED data payloads)
- Places where the UX could frustrate a first-time user or make a power user feel limited
- Valuation logic in \`app/api/financials/route.ts\` and \`config/valuation.config.ts\` — are the model assumptions sound?
- The AI features already in place (brief generation, portfolio analysis) — how could they be deeper or more accurate?
- The gap between what the pricing page promises and what is actually built
- Anything that looks fragile, hardcoded, or likely to break at scale`,
          },
        ],
      },
    ],
  })

  // Print cache stats
  const usage = response.usage
  console.log('📊  Token usage:')
  console.log(`    Input tokens:        ${usage.input_tokens.toLocaleString()}`)
  if (usage.cache_creation_input_tokens) {
    console.log(`    Cache write tokens:  ${usage.cache_creation_input_tokens.toLocaleString()} (1.25× cost — cached for future runs)`)
  }
  if (usage.cache_read_input_tokens) {
    console.log(`    Cache read tokens:   ${usage.cache_read_input_tokens.toLocaleString()} (0.1× cost — from cache)`)
  }
  console.log(`    Output tokens:       ${usage.output_tokens.toLocaleString()}`)
  console.log()

  // Extract text from response (skip thinking blocks)
  const report = response.content
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('\n\n')

  // Save report to file
  const timestamp = new Date().toISOString().slice(0, 10)
  const outPath = path.join(ROOT, `scripts/product-ideas-${timestamp}.md`)
  const fullReport = `# Rationale — Product Improvement Report\n_Generated ${new Date().toISOString()}_\n\n${report}`
  fs.writeFileSync(outPath, fullReport, 'utf8')

  // Print to stdout as well
  console.log('─'.repeat(72))
  console.log(report)
  console.log('─'.repeat(72))
  console.log(`\n✅  Report saved to: ${path.relative(ROOT, outPath)}`)
}

main().catch(err => {
  console.error('❌  Error:', err.message)
  process.exit(1)
})
