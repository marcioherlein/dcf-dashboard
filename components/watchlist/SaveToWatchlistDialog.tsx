'use client'

import { useState } from 'react'
import { AlertTriangle, Bookmark, CheckCircle2, Loader2 } from 'lucide-react'
import { useSession } from 'next-auth/react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import { saveWatchlistEntry, getWatchlistEntry } from '@/lib/simplifier/watchlistStore'
import type { WatchlistEntry } from '@/lib/simplifier/types'

type ListTag = 'buy' | 'watch' | 'pass'

const DECISION_OPTIONS: Array<{
  tag: ListTag
  label: string
  description: string
  active: string
  inactive: string
}> = [
  {
    tag: 'buy',
    label: '🟢 Buy',
    description: "I'm convinced this is undervalued",
    active:   'bg-[#E8F7EF] border-[#CDD1C8] text-[#11875D]',
    inactive: 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#CDD1C8]',
  },
  {
    tag: 'watch',
    label: '🟡 Watch',
    description: "Interesting — monitoring for a better entry",
    active:   'bg-[#FFF4DA] border-[#E3E1DA] text-[#B56A00]',
    inactive: 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#E3E1DA]',
  },
  {
    tag: 'pass',
    label: '🔴 Pass',
    description: "Not at this price — saving for reference",
    active:   'bg-[#FCEAEA] border-[#E3E1DA] text-[#D83B3B]',
    inactive: 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#E3E1DA]',
  },
]

export interface WatchlistSavePayload {
  ticker: string
  name: string
  assetType: 'stock' | 'etf'
  // only for stocks
  fairValue?: number | null
  upsidePct?: number | null
  valuationSnapshot?: {
    price_at_save: number
    fair_value: number
    wacc: number
    beta: number
    terminal_g: number
    cagr: number
    upside_pct: number
    inputs: Record<string, number>
    scenarios: { bull: number; base: number; bear: number }
  } | null
  nextEarningsDate?: string | null
  // Extended live metrics passed at save time
  liveMetrics?: {
    peRatio?: number | null
    pegRatio?: number | null
    evToEbitda?: number | null
    dividendYield?: number | null
    return1y?: number | null
    return3y?: number | null
    return5y?: number | null
    spy1y?: number | null
    spy3y?: number | null
    spy5y?: number | null
    piotroski?: number | null
  } | null
}

interface Props {
  open: boolean
  payload: WatchlistSavePayload | null
  onClose: () => void
  onReviewAssumptions: () => void
}

export default function SaveToWatchlistDialog({ open, payload, onClose, onReviewAssumptions }: Props) {
  const { data: session } = useSession()
  const userEmail = session?.user?.email ?? null
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [listTag,  setListTag]  = useState<ListTag>('watch')

  if (!payload) return null

  const isETF = payload.assetType === 'etf'

  async function handleSave() {
    if (!payload) return
    setStatus('saving')
    setErrorMsg('')
    try {
      const existing = getWatchlistEntry(payload.ticker)
      const lm = payload.liveMetrics
      const now = new Date().toISOString()
      const entry: WatchlistEntry = existing
        ? {
            ...existing,
            listTag,
            updatedAt: now,
            snapshot: {
              ...existing.snapshot,
              upsidePct: payload.upsidePct ?? existing.snapshot.upsidePct,
              price: payload.valuationSnapshot?.price_at_save ?? existing.snapshot.price,
              beta: payload.valuationSnapshot?.beta ?? existing.snapshot.beta,
              fairValue: payload.fairValue ?? existing.snapshot.fairValue,
              bearScenario: payload.valuationSnapshot?.scenarios.bear ?? existing.snapshot.bearScenario,
              baseScenario: payload.valuationSnapshot?.scenarios.base ?? existing.snapshot.baseScenario,
              bullScenario: payload.valuationSnapshot?.scenarios.bull ?? existing.snapshot.bullScenario,
              // Persist user-edited assumptions so My Valuations can show what thesis was saved
              ...(payload.valuationSnapshot?.inputs != null ? {
                savedWacc:         payload.valuationSnapshot.inputs.wacc          ?? undefined,
                savedCagr:         payload.valuationSnapshot.inputs.cagr          ?? undefined,
                savedNetMargin:    payload.valuationSnapshot.inputs.netMargin     ?? undefined,
                savedExitPE:       payload.valuationSnapshot.inputs.exitPE        ?? undefined,
                savedExitMultiple: payload.valuationSnapshot.inputs.exitMultiple  ?? undefined,
                savedRevMultiple:  payload.valuationSnapshot.inputs.revenueMultiple ?? undefined,
              } : {}),
              ...(payload.nextEarningsDate !== undefined ? { nextEarningsDate: payload.nextEarningsDate } : {}),
              ...(lm != null ? {
                peRatio: lm.peRatio, pegRatio: lm.pegRatio, evToEbitda: lm.evToEbitda,
                dividendYield: lm.dividendYield,
                return1y: lm.return1y, return3y: lm.return3y, return5y: lm.return5y,
                spy1y: lm.spy1y, spy3y: lm.spy3y, spy5y: lm.spy5y,
                piotroski: lm.piotroski,
                metricsUpdatedAt: now,
              } : {}),
            },
          }
        : {
            ticker: payload.ticker,
            companyName: payload.name,
            updatedAt: now,
            currentPhase: 1,
            answers: {},
            notes: {},
            phaseScores: {},
            overallScore: null,
            listTag,
            snapshot: {
              grossMargin: null, fcfMargin: null, moatScore: null,
              roic: null, cagr3y: null, insiderPct: null,
              beta: payload.valuationSnapshot?.beta ?? null,
              upsidePct: payload.upsidePct ?? null,
              price: payload.valuationSnapshot?.price_at_save ?? null,
              marketCap: null,
              fairValue: payload.fairValue ?? null,
              bearScenario: payload.valuationSnapshot?.scenarios.bear ?? null,
              baseScenario: payload.valuationSnapshot?.scenarios.base ?? null,
              bullScenario: payload.valuationSnapshot?.scenarios.bull ?? null,
              savedWacc:         payload.valuationSnapshot?.inputs.wacc          ?? null,
              savedCagr:         payload.valuationSnapshot?.inputs.cagr          ?? null,
              savedNetMargin:    payload.valuationSnapshot?.inputs.netMargin     ?? null,
              savedExitPE:       payload.valuationSnapshot?.inputs.exitPE        ?? null,
              savedExitMultiple: payload.valuationSnapshot?.inputs.exitMultiple  ?? null,
              savedRevMultiple:  payload.valuationSnapshot?.inputs.revenueMultiple ?? null,
              nextEarningsDate:  payload.nextEarningsDate ?? null,
              peRatio: lm?.peRatio, pegRatio: lm?.pegRatio, evToEbitda: lm?.evToEbitda,
              dividendYield: lm?.dividendYield,
              return1y: lm?.return1y, return3y: lm?.return3y, return5y: lm?.return5y,
              spy1y: lm?.spy1y, spy3y: lm?.spy3y, spy5y: lm?.spy5y,
              piotroski: lm?.piotroski,
              metricsUpdatedAt: lm != null ? now : null,
            },
          }

      await saveWatchlistEntry(entry, userEmail)

      // Also persist detailed valuation snapshot (non-blocking, best-effort)
      if (!isETF && payload.valuationSnapshot) {
        fetch('/api/valuations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker: payload.ticker, company: payload.name, ...payload.valuationSnapshot }),
        }).catch(() => {})
      }

      setStatus('done')
      setTimeout(() => { setStatus('idle'); onClose() }, 1200)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong')
      setStatus('error')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setStatus('idle'); onClose() } }}>
      <DialogContent showCloseButton={false} className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark size={16} className="text-[#2563EB]" />
            {isETF ? `Save ${payload.ticker} to Watchlist` : `Save ${payload.ticker} Analysis`}
          </DialogTitle>
        </DialogHeader>

        {status === 'done' ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle2 size={32} className="text-[#11875D]" />
            <p className="text-sm font-semibold text-[#8A95A6]">Saved to Watchlist</p>
          </div>
        ) : (
          <>
            {/* Valuation summary for stocks */}
            {!isETF && payload.fairValue != null && (
              <div className="rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#566174]">Fair Value</span>
                  <span className="font-semibold text-[#8A95A6]">{fmtPrice(payload.fairValue)}</span>
                </div>
                {payload.upsidePct != null && (
                  <div className="flex justify-between mt-1">
                    <span className="text-[#566174]">Upside</span>
                    <span className={`font-semibold ${payload.upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}>
                      {fmtPct(payload.upsidePct)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Decision picker */}
            {!isETF && (
              <div>
                <p className="text-xs font-semibold text-[#8A95A6] mb-2 uppercase tracking-wider">Your conviction</p>
                <div className="grid grid-cols-3 gap-2">
                  {DECISION_OPTIONS.map(opt => (
                    <button
                      key={opt.tag}
                      onClick={() => setListTag(opt.tag)}
                      className={cn(
                        'flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-2.5 text-center transition-all',
                        listTag === opt.tag ? opt.active : opt.inactive,
                      )}
                    >
                      <span className="text-sm font-bold">{opt.label}</span>
                      <span className="text-[10px] leading-tight opacity-75">{opt.description}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Warning for stocks */}
            {!isETF && (
              <div className="flex gap-3 rounded-lg border border-[#E3E1DA] bg-[#FFF4DA] p-3">
                <AlertTriangle size={16} className="text-[#B56A00] shrink-0 mt-0.5" />
                <div className="text-xs text-[#B56A00] leading-relaxed">
                  <p className="font-semibold mb-0.5">Review assumptions before saving</p>
                  <p>These inputs were auto-derived from Yahoo Finance data. Growth rates, WACC, and multiples may not reflect your own research. Don&apos;t rely on the model blindly.</p>
                  <button
                    onClick={() => { onClose(); onReviewAssumptions() }}
                    className="mt-1.5 underline font-semibold hover:text-[#B56A00]"
                  >
                    Review assumptions →
                  </button>
                </div>
              </div>
            )}

            {/* ETF simple message */}
            {isETF && (
              <p className="text-sm text-[#566174]">
                {payload.name} will be added to your watchlist. No valuation is stored for ETFs.
              </p>
            )}

            {status === 'error' && (
              errorMsg === 'FREE_LIMIT' ? (
                <div className="rounded-lg border border-[#93B4F5] bg-[#EAF1FF] p-3 text-xs text-[#2563EB]">
                  <p className="font-semibold mb-0.5">Free tier limit reached (3 saves)</p>
                  <p>Upgrade to Pro for unlimited watchlist saves.</p>
                  <a href="/pricing" className="mt-1.5 inline-block underline font-semibold hover:text-[#2563EB]">
                    View Pro plans →
                  </a>
                </div>
              ) : (
                <p className="text-xs text-[#D83B3B]">{errorMsg}</p>
              )
            )}
          </>
        )}

        {status !== 'done' && (
          <DialogFooter>
            <button
              onClick={() => { setStatus('idle'); onClose() }}
              className="flex-1 rounded-lg border border-[#E3E1DA] py-2 text-sm text-[#566174] hover:bg-[#F0F1F6] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={status === 'saving'}
              className="flex-1 rounded-lg bg-olive-700 py-2 text-sm font-semibold text-white hover:bg-olive-500 disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5"
            >
              {status === 'saving'
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : isETF ? 'Save to Watchlist →'
                : listTag === 'buy'   ? 'Save as Buy →'
                : listTag === 'pass'  ? 'Save as Pass →'
                : 'Save to Watchlist →'
              }
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
