/**
 * Link audit script — scans all TSX/TS source files for internal href/Link
 * destinations and verifies each one maps to a real page route.
 *
 * Run: node scripts/link-audit.mjs
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'fs'
import { join, relative } from 'path'

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '')
const APP_DIR = join(ROOT, 'app')
const SRC_DIRS = [
  join(ROOT, 'app'),
  join(ROOT, 'components'),
]

// ── Discover all real routes from the app/ directory ────────────────────────

function discoverRoutes(dir, prefix = '') {
  const routes = new Set()
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      // Dynamic segments like [ticker] become wildcards
      if (entry.startsWith('[') && entry.endsWith(']')) {
        routes.add(prefix + '/*')
      } else {
        const sub = discoverRoutes(full, prefix + '/' + entry)
        sub.forEach(r => routes.add(r))
        routes.add(prefix + '/' + entry)
      }
    } else if (entry === 'page.tsx' || entry === 'page.ts') {
      routes.add(prefix === '' ? '/' : prefix)
    }
  }
  return routes
}

const REAL_ROUTES = discoverRoutes(APP_DIR)
REAL_ROUTES.add('/')

// Also collect all route prefixes (to handle wildcard matching)
const WILDCARD_PREFIXES = [...REAL_ROUTES]
  .filter(r => r.endsWith('/*'))
  .map(r => r.slice(0, -2))

function routeExists(href) {
  // Strip query string and hash
  const path = href.split('?')[0].split('#')[0]
  if (path === '' || path === '/') return true
  if (REAL_ROUTES.has(path)) return true
  // Wildcard match: /stock/NVDA → /stock exists as /stock/*
  for (const prefix of WILDCARD_PREFIXES) {
    if (path.startsWith(prefix + '/') || path === prefix) return true
  }
  return false
}

// ── Scan source files for href/Link values ──────────────────────────────────

const HREF_RE = /href=["'](\/?[a-zA-Z0-9_\-./][^"'\s]*?)["']/g
const ROUTER_PUSH_RE = /router\.push\(["'](\/?[a-zA-Z0-9_\-./][^"'\s]*?)["']/g

function scanFile(filePath) {
  const src = readFileSync(filePath, 'utf8')
  const issues = []

  for (const re of [HREF_RE, ROUTER_PUSH_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(src)) !== null) {
      const href = m[1]
      // Skip: external URLs, anchors-only, template literals
      if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) continue
      // Skip dynamic references (contain ${)
      if (href.includes('${') || href.includes('{')) continue
      // Skip Next.js API routes — they're real but not page routes
      if (href.startsWith('/api/')) continue

      if (!routeExists(href)) {
        const lineNum = src.substring(0, m.index).split('\n').length
        issues.push({ file: relative(ROOT, filePath), line: lineNum, href })
      }
    }
  }

  return issues
}

function walk(dir) {
  const files = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.claude' || entry === 'worktrees') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) {
      walk(full).forEach(f => files.push(f))
    } else if (entry.endsWith('.tsx') || entry.endsWith('.ts')) {
      files.push(full)
    }
  }
  return files
}

// ── Run ──────────────────────────────────────────────────────────────────────

console.log('Discovered routes:')
;[...REAL_ROUTES].sort().forEach(r => console.log(' ', r))
console.log()

const allFiles = SRC_DIRS.flatMap(walk)
let totalIssues = 0

console.log('Scanning', allFiles.length, 'files...\n')

const allIssues = []
for (const file of allFiles) {
  const issues = scanFile(file)
  allIssues.push(...issues)
  totalIssues += issues.length
}

if (allIssues.length === 0) {
  console.log('✓ No broken internal links found.')
} else {
  console.log(`✗ Found ${totalIssues} broken internal link(s):\n`)
  for (const { file, line, href } of allIssues) {
    console.log(`  ${file}:${line}  →  "${href}"`)
  }
}

process.exit(totalIssues > 0 ? 1 : 0)
