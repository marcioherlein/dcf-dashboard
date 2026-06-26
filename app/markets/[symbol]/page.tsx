'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import InstrumentPriceChart from '@/components/markets/InstrumentPriceChart'
import type { InstrumentDetail } from '@/app/api/markets/instrument/route'

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtPrice(v: number | null, currency = 'USD', decimals = 2): string {
  if (v == null || !isFinite(v)) return 'N/A'
  const prefix = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : ''
  if (Math.abs(v) >= 1000)
    return prefix + v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
  return prefix + v.toFixed(decimals)
}

function fmtPct(v: number | null): string {
  if (v == null || !isFinite(v)) return 'N/A'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function fmtVolume(v: number | null): string {
  if (v == null || !isFinite(v)) return 'N/A'
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(2) + 'B'
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(2) + 'M'
  if (v >= 1_000) return (v / 1_000).toFixed(1) + 'K'
  return v.toLocaleString()
}

function fmtMarketCap(v: number | null): string {
  if (v == null || !isFinite(v)) return 'N/A'
  if (v >= 1_000_000_000_000) return '$' + (v / 1_000_000_000_000).toFixed(2) + 'T'
  if (v >= 1_000_000_000) return '$' + (v / 1_000_000_000).toFixed(2) + 'B'
  if (v >= 1_000_000) return '$' + (v / 1_000_000).toFixed(2) + 'M'
  return '$' + v.toLocaleString()
}

function fmtRange(lo: number | null, hi: number | null, currency: string): string {
  if (lo == null || hi == null) return 'N/A'
  return `${fmtPrice(lo, currency)} – ${fmtPrice(hi, currency)}`
}

function changeCls(v: number | null) {
  if (v == null) return 'text-[#566174]'
  return v > 0 ? 'text-[#11875D]' : v < 0 ? 'text-[#D83B3B]' : 'text-[#566174]'
}

// ── Type badge ──────────────────────────────────────────────────────────────
const TYPE_BADGE: Record<string, { label: string; cls: string }> = {
  index:      { label: 'Index',       cls: 'bg-[#EAF1FF]/15 text-[#93B4F5]' },
  etf:        { label: 'ETF',         cls: 'bg-violet-500/15 text-violet-300' },
  fx:         { label: 'FX',          cls: 'bg-[#FFF4DA]/15 text-amber-300' },
  commodity:  { label: 'Commodity',   cls: 'bg-orange-500/15 text-orange-300' },
  volatility: { label: 'Volatility',  cls: 'bg-rose-500/15 text-rose-300' },
  crypto:     { label: 'Crypto',      cls: 'bg-cyan-500/15 text-cyan-300' },
  other:      { label: 'Instrument',  cls: 'bg-white/8 text-[#8A95A6]' },
}

// ── Skeleton ────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return <div className={cn('motion-safe:animate-pulse rounded bg-white/8', className)} />
}

function PageSkeleton() {
  return (
    <div className="min-h-dvh bg-[#050D1F]">
      <div className="max-w-[900px] mx-auto px-4 py-6 space-y-4">
        <Skeleton className="h-5 w-28" />
        <div className="rounded-xl bg-white/5 border border-white/10 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-baseline gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-6 w-24" />
          </div>
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-[320px] rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      </div>
    </div>
  )
}

// ── Stat tile ───────────────────────────────────────────────────────────────
function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 min-h-0">
      <div className="text-[10px] font-bold text-[#8A95A6] uppercase tracking-wider mb-1">{label}</div>
      <div className="text-[14px] font-semibold text-[#E3E1DA] font-mono tabular-nums truncate" title={value}>
        {value}
      </div>
    </div>
  )
}

// ── News item ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function NewsItem({ item }: { item: any }) {
  const inner = (
    <div className="px-4 py-4 min-h-[44px] hover:bg-white/5 transition-colors group">
      <p className="text-[12.5px] font-medium text-[#CDD1C8] leading-snug line-clamp-2 group-hover:text-[#E3E1DA]">
        {item.title}
      </p>
      <div className="flex items-center gap-2 mt-1.5">
        {item.publisher && (
          <span className="text-[10px] text-[#8A95A6] font-medium">{item.publisher}</span>
        )}
        {item.providerPublishTime && (
          <span className="text-[10px] text-[#8A95A6]">
            {new Date(item.providerPublishTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {item.link && (
          <ExternalLink className="w-3 h-3 text-[#8A95A6] group-hover:text-[#8A95A6] ml-auto shrink-0" />
        )}
      </div>
    </div>
  )

  return item.link ? (
    <a href={item.link} target="_blank" rel="noopener noreferrer" className="block">
      {inner}
    </a>
  ) : <div>{inner}</div>
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function InstrumentDetailPage() {
  const params = useParams<{ symbol: string }>()
  const symbol = params?.symbol ?? ''

  const [detail, setDetail]   = useState<InstrumentDetail | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [news, setNews]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!symbol) return
    setLoading(true)
    setError(null)

    const enc = encodeURIComponent(symbol)

    Promise.all([
      fetch(`/api/markets/instrument?symbol=${enc}`).then(r => r.json()),
      fetch(`/api/news?ticker=${enc}`).then(r => r.json()).catch(() => []),
    ]).then(([d, n]) => {
      if (d?.error) { setError(d.error); return }
      setDetail(d as InstrumentDetail)
      setNews(Array.isArray(n) ? n.slice(0, 8) : [])
    }).catch(e => {
      setError(String(e))
    }).finally(() => {
      setLoading(false)
    })
  }, [symbol])

  if (loading) return <PageSkeleton />

  if (error || !detail) {
    return (
      <div className="min-h-dvh bg-[#050D1F]">
        <div className="max-w-[900px] mx-auto px-4 py-6">
          <Link href="/markets" className="inline-flex items-center gap-1.5 text-[13px] text-[#8A95A6] hover:text-[#E3E1DA] transition-colors mb-4 min-h-[44px]">
            <ArrowLeft className="w-4 h-4" /> Back to Markets
          </Link>
          <div className="rounded-xl bg-[#FCEAEA]/10 border border-red-500/30 px-6 py-5">
            <p className="text-sm font-semibold text-[#D83B3B] mb-1">Unable to load instrument data</p>
            <p className="text-xs text-[#D83B3B]">{error ?? 'Unknown error'}</p>
          </div>
        </div>
      </div>
    )
  }

  const typeBadge = TYPE_BADGE[detail.type] ?? TYPE_BADGE.other
  const priceDecimals = detail.type === 'fx' || (detail.price != null && detail.price < 5) ? 4 : 2

  return (
    <div className="min-h-dvh bg-[#050D1F]">
      <div className="max-w-[900px] mx-auto px-4 py-4 sm:py-6 space-y-4">

        {/* Back link */}
        <Link
          href="/markets"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#8A95A6] hover:text-[#E3E1DA] transition-colors min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Markets
        </Link>

        {/* ── Header card ──────────────────────────────────────────────────── */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-4 sm:px-6 py-4 sm:py-5">
          {/* Symbol + name + badges */}
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <h1 className="text-[20px] sm:text-[22px] font-bold text-[#E3E1DA] tracking-tight">
              {symbol.replace(/=X$/, '').replace(/^[\^]/, '').replace(/-USD$/, 'USD').replace(/=F$/, '')}
            </h1>
            <span className="text-[14px] sm:text-[15px] text-[#566174] font-medium">{detail.name}</span>
            <span className={cn('px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide', typeBadge.cls)}>
              {typeBadge.label}
            </span>
            {detail.category && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-white/8 text-[#8A95A6]">
                {detail.category}
              </span>
            )}
            {detail.exchange && (
              <span className="text-[11px] text-[#8A95A6]">{detail.exchange}</span>
            )}
          </div>

          {/* Price + change */}
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3 mb-4">
            <span className="text-[28px] sm:text-[32px] font-bold font-mono tabular-nums text-[#E3E1DA] leading-none">
              {fmtPrice(detail.price, detail.currency, priceDecimals)}
            </span>
            <span className={cn('text-[14px] sm:text-[16px] font-semibold font-mono tabular-nums', changeCls(detail.changePct))}>
              {detail.change != null && isFinite(detail.change)
                ? (detail.change >= 0 ? '+' : '') + fmtPrice(detail.change, '', priceDecimals)
                : ''
              }
              {' '}
              ({fmtPct(detail.changePct)})
            </span>
            <span className="text-[11px] text-[#8A95A6] sm:ml-auto self-end">
              {new Date(detail.updatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>

          {/* Description */}
          <p className="text-[13px] text-[#8A95A6] leading-relaxed">{detail.description}</p>

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2 mt-3">
            {detail.region && (
              <span className="text-[11px] text-[#566174]">
                <span className="font-semibold">Region:</span> {detail.region}
              </span>
            )}
            {detail.assetClass && (
              <span className="text-[11px] text-[#8A95A6]">·</span>
            )}
            {detail.assetClass && (
              <span className="text-[11px] text-[#566174]">
                <span className="font-semibold">Class:</span> {detail.assetClass}
              </span>
            )}
            {detail.expenseRatio != null && (
              <>
                <span className="text-[11px] text-[#8A95A6]">·</span>
                <span className="text-[11px] text-[#566174]">
                  <span className="font-semibold">Expense Ratio:</span> {(detail.expenseRatio * 100).toFixed(2)}%
                </span>
              </>
            )}
          </div>
        </div>

        {/* ── Price chart ──────────────────────────────────────────────────── */}
        <InstrumentPriceChart symbol={symbol} currency={detail.currency} />

        {/* ── Key stats grid ────────────────────────────────────────────────── */}
        <div>
          <h2 className="text-[11px] font-bold text-[#566174] uppercase tracking-wider mb-2">Key Statistics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatTile label="Previous Close" value={fmtPrice(detail.previousClose, detail.currency, priceDecimals)} />
            <StatTile label="Open"           value={fmtPrice(detail.open, detail.currency, priceDecimals)} />
            <StatTile label="Day Range"      value={fmtRange(detail.dayLow, detail.dayHigh, detail.currency)} />
            <StatTile label="52W Range"      value={fmtRange(detail.fiftyTwoWeekLow, detail.fiftyTwoWeekHigh, detail.currency)} />
            <StatTile label="Volume"         value={fmtVolume(detail.volume)} />
            <StatTile label="Avg Volume"     value={fmtVolume(detail.avgVolume)} />
            <StatTile label={detail.type === 'etf' ? 'AUM' : 'Market Cap'} value={fmtMarketCap(detail.marketCap)} />
            {detail.expenseRatio != null
              ? <StatTile label="Expense Ratio" value={(detail.expenseRatio * 100).toFixed(3) + '%'} />
              : <StatTile label="Currency"      value={detail.currency || 'USD'} />
            }
          </div>
        </div>

        {/* ── Related instruments ───────────────────────────────────────────── */}
        {detail.relatedSymbols && detail.relatedSymbols.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold text-[#566174] uppercase tracking-wider mb-2">Related Instruments</h2>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {detail.relatedSymbols.map(sym => (
                <Link
                  key={sym}
                  href={`/markets/${encodeURIComponent(sym)}`}
                className="flex-shrink-0 rounded-xl bg-white/5 border border-white/10 px-4 py-3 hover:border-[#5F790B]/40 hover:bg-[#EAF1FF]/10 transition-colors"
                >
                  <div className="text-[13px] font-semibold text-[#CDD1C8] tabular-nums">
                    {sym.replace(/=X$/, '').replace(/^[\^]/, '').replace(/-USD$/, 'USD').replace(/=F$/, '')}
                  </div>
                  <div className="text-[10px] text-[#8A95A6] mt-0.5">View →</div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── News ─────────────────────────────────────────────────────────── */}
        {news.length > 0 && (
          <div>
            <h2 className="text-[11px] font-bold text-[#566174] uppercase tracking-wider mb-2">Recent News</h2>
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden divide-y divide-white/5">
              {news.map((item, i) => (
                <NewsItem key={i} item={item} />
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
